// Синхронизация личных данных между приложением и сайтом через аккаунт Google.
// Хранится в Firestore: users/{uid}/sync/main (правила уже разрешают доступ только владельцу аккаунта).
// Каждый ключ localStorage синхронизируется отдельно: побеждает более позднее изменение.
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./groups.js";

const KEYS = ["tasks", "abs", "cd", "gpa", "contacts", "subjects", "sch_fav", "sch_me", "home_sel",
  "usr_me", "usr_draft", "grp_name", "grp_added", "theme"];
// Списки с id: при первом входе на устройстве, где уже есть свои данные, объединяем, а не затираем
const MERGE = new Set(["tasks", "abs", "cd", "contacts"]);
const MK = "sync_meta";

const st = { on: false, email: "", last: 0, err: "", busy: false };
const subs = new Set();
const emit = () => subs.forEach(f => { try { f(Object.assign({}, st)); } catch (e) {} });

const getMeta = () => { try { return JSON.parse(localStorage.getItem(MK) || "null"); } catch (e) { return null; } };
const putMeta = m => { try { localStorage.setItem(MK, JSON.stringify(m)); } catch (e) {} };
const raw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function setRaw(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

function union(a, b) {
  try {
    const x = JSON.parse(a), y = JSON.parse(b);
    if (!Array.isArray(x) || !Array.isArray(y)) return b;
    const seen = new Set(y.map(o => o && o.id)), out = y.slice();
    x.forEach(o => { if (o && o.id && !seen.has(o.id)) out.push(o); });
    return JSON.stringify(out);
  } catch (e) { return b; }
}

let ref = null, unsub = null, meta = null, timer = null, pushT = null;
const dirty = new Set();

// Ищем ключи, изменённые на этом устройстве (любым способом: страница, виджет, старый код)
function scan() {
  if (!meta) return;
  const now = Date.now();
  KEYS.forEach(k => {
    const cur = raw(k);
    if (cur !== (meta.snap[k] === undefined ? null : meta.snap[k])) { meta.snap[k] = cur; meta.ts[k] = now; dirty.add(k); }
  });
  if (dirty.size) { putMeta(meta); schedulePush(); }
}
function schedulePush() { clearTimeout(pushT); pushT = setTimeout(push, 800); }
async function push() {
  if (!ref || !dirty.size) return;
  const keys = [...dirty]; dirty.clear();
  const d = {}, t = {};
  keys.forEach(k => { d[k] = meta.snap[k] === undefined ? null : meta.snap[k]; t[k] = meta.ts[k] || Date.now(); });
  st.busy = true; emit();
  try {
    await setDoc(ref, { d, t, u: serverTimestamp() }, { merge: true });
    st.last = Date.now(); st.err = "";
  } catch (e) {
    keys.forEach(k => dirty.add(k));
    st.err = /permission/i.test(String(e && e.code)) ? "Нет доступа к данным аккаунта" : "Нет связи, повторим позже";
  }
  st.busy = false; emit();
}

function apply(remote) {
  const rd = remote.d || {}, rt = remote.t || {}, changed = [];
  scan();
  const first = !!meta.first;
  KEYS.forEach(k => {
    if (!(k in rd)) { if (first && raw(k) != null) { meta.ts[k] = meta.ts[k] || Date.now(); dirty.add(k); } return; }
    const r = rd[k], t = +rt[k] || 0, lt = meta.ts[k] || 0, loc = raw(k);
    if (first && loc != null && r != null && loc !== r) {
      // устройство уже пользовалось приложением без входа: объединяем списки, остальное берём из аккаунта
      const v = MERGE.has(k) ? union(loc, r) : (lt > t ? loc : r);
      if (v !== loc) { setRaw(k, v); changed.push(k); }
      meta.snap[k] = v; meta.ts[k] = Date.now(); if (v !== r) dirty.add(k);
      return;
    }
    if (t > lt && r !== loc) { setRaw(k, r); meta.snap[k] = r; meta.ts[k] = t; changed.push(k); }
    else if (t > lt) { meta.ts[k] = t; meta.snap[k] = r; }
    else if (lt > t && loc !== r) dirty.add(k);
  });
  meta.first = false; putMeta(meta);
  st.last = Date.now(); emit();
  if (dirty.size) schedulePush();
  if (changed.length) window.dispatchEvent(new CustomEvent("barsuSync", { detail: changed }));
}

function start(u) {
  stop();
  st.on = true; st.email = u.email || ""; st.err = ""; emit();
  meta = getMeta();
  if (!meta || meta.uid !== u.uid) {
    // новый аккаунт на этом устройстве: текущие данные считаем «старыми», чтобы данные аккаунта имели приоритет
    meta = { uid: u.uid, ts: {}, snap: {}, first: true };
    KEYS.forEach(k => { meta.snap[k] = raw(k); });
  }
  putMeta(meta);
  ref = doc(db, "users", u.uid, "sync", "main");
  unsub = onSnapshot(ref, s => apply(s.exists() ? s.data() : {}), e => { st.err = "Нет связи, повторим позже"; emit(); });
  timer = setInterval(scan, 3000);
}
function stop() {
  if (unsub) { try { unsub(); } catch (e) {} }
  unsub = null; ref = null; clearInterval(timer); timer = null;
  if (st.on) { st.on = false; st.email = ""; emit(); }
}

onAuthStateChanged(auth, u => { if (u && !u.isAnonymous) start(u); else stop(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { scan(); push(); } else scan(); });
window.addEventListener("pagehide", () => { scan(); push(); });

window.SyncApi = {
  status: () => Object.assign({}, st),
  onStatus(f) { subs.add(f); return () => subs.delete(f); },
  now() { scan(); return push(); }
};
