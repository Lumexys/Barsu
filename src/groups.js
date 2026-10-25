// Группы: общая лента, вопросы к зачёту, участники. Данные в Firestore, правила доступа проверяет сервер.
import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, signInWithCredential, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, orderBy, limit, where, Timestamp, onSnapshot, writeBatch, serverTimestamp } from "firebase/firestore";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import { FIREBASE, OWNER_EMAIL } from "./firebase-config.js";

const app = initializeApp(FIREBASE);
// В приложении вход идёт через нативный Google, на сайте — через окно Google в браузере
const NATIVE = Capacitor.isNativePlatform();
const auth = NATIVE
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
if (!NATIVE) getRedirectResult(auth).catch(() => {});
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// Вход только через Google. Анонимные сессии (старые версии приложения) сбрасываются.
function me() {
  return new Promise(res => {
    const un = auth.onAuthStateChanged(async u => {
      un();
      if (u && u.isAnonymous) { try { await signOut(auth); } catch (e) {} res(null); return; }
      res(u || null);
    });
  });
}
async function ready() {
  const u = await me();
  if (!u) throw Object.assign(new Error("auth-required"), { code: "auth-required" });
  return u;
}
const jwtEmail = t => {
  try { const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(decodeURIComponent(escape(atob(p)))).email || ""; }
  catch (e) { return ""; }
};
// Вход на сайте: всплывающее окно Google, если браузер его заблокировал — переход на страницу входа
async function webSignIn() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    const c = (e && e.code) || "";
    if (/popup-blocked|operation-not-supported/.test(c)) { await signInWithRedirect(auth, p); return new Promise(() => {}); }
    if (/popup-closed|cancelled-popup/.test(c)) throw Object.assign(new Error("cancel"), { code: "cancel" });
    throw e;
  }
}
async function googleIdToken() {
  const r = await FirebaseAuthentication.signInWithGoogle();
  const idToken = r && r.credential && r.credential.idToken;
  if (!idToken) throw Object.assign(new Error("no-token"), { code: "no-token" });
  return idToken;
}

const gRef = g => doc(db, "groups", g);
const mRef = (g, u) => doc(db, "groups", g, "members", u);
const rRef = (g, u) => doc(db, "groups", g, "requests", u);
const uRef = u => doc(db, "users", u);
const pCol = (g, sc) => sc === "all" ? collection(db, "groups", g, "posts") : collection(db, "groups", g, "subs", sc, "posts");
const fCol = (g, sc) => sc === "all" ? collection(db, "groups", g, "gfiles") : collection(db, "groups", g, "subs", sc, "files");
const tRef = k => doc(db, "taken", k);
// Ключ группы БарГУ: одна и та же группа всегда даёт один и тот же ключ (регистр, пробелы, «/» не важны)
const groupKey = n => String(n || "").trim().toUpperCase().replace(/\s+/g, "").replace(/\//g, "_");
const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, x => CH[x % 32]).join(""); };

const norm = (id, data) => {
  const o = { id };
  Object.keys(data).forEach(k => { const v = data[k]; o[k] = v && typeof v.toMillis === "function" ? v.toMillis() : v; });
  return o;
};
const on = (q, cb, err) => onSnapshot(q, s => cb(s.docs.map(d => norm(d.id, d.data({ serverTimestamps: "estimate" })))), e => err && err(e));

const api = {
  async uid() { return (await ready()).uid; },
  async user() { const u = await me(); return u ? { uid: u.uid, email: u.email || "", name: u.displayName || "" } : null; },
  async signIn() {
    if (!NATIVE) await webSignIn();
    else {
      const idToken = await googleIdToken();
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    }
    const u = auth.currentUser;
    await u.getIdToken(true);
    return { uid: u.uid, email: u.email || "", name: u.displayName || "" };
  },
  // токен входа для сервера игр (Cloudflare проверяет его подпись)
  async idToken(force) { const u = await me(); return u && !u.isAnonymous ? u.getIdToken(!!force) : null; },
  // одно имя для группы и игр: меняем его в карточке участника и в профиле
  async setMyName(gid, name) {
    const u = await ready(), b = writeBatch(db);
    b.update(mRef(gid, u.uid), { name });
    b.set(uRef(u.uid), { name }, { merge: true });
    await b.commit();
  },
  async signOutAcc() { if (NATIVE) { try { await FirebaseAuthentication.signOut(); } catch (e) {} } await signOut(auth); },
  isOwner() { const u = auth.currentUser; return !!u && !u.isAnonymous && u.email === OWNER_EMAIL; },

  async status() {
    const u = await ready(), s = await getDoc(uRef(u.uid));
    if (!s.exists() || !s.data().gid) return { state: "none", uid: u.uid };
    const { gid, name, groupName } = s.data();
    let m = null;
    try { m = await getDoc(mRef(gid, u.uid)); } catch (e) {}
    if (m && m.exists()) {
      const g = await getDoc(gRef(gid));
      return { state: "member", uid: u.uid, gid, name: m.data().name || name, role: m.data().role, sub: m.data().sub || "", group: norm(gid, g.data()) };
    }
    let r = null;
    try { r = await getDoc(rRef(gid, u.uid)); } catch (e) {}
    if (r && r.exists()) return { state: "pending", uid: u.uid, gid, name, groupName };
    try { await deleteDoc(uRef(u.uid)); } catch (e) {}
    return { state: "none", uid: u.uid, lost: true };
  },

  // Занятые группы: id документа = ключ группы. Список нужен, чтобы подсветить их красным.
  async takenKeys() {
    await ready();
    const s = await getDocs(collection(db, "taken"));
    return s.docs.map(d => d.id);
  },
  groupKey,
  async createGroup(name, myName) {
    const u = await ready(), key = groupKey(name), code = genCode(), gr = doc(collection(db, "groups")), b = writeBatch(db);
    if (key.length < 2) throw Object.assign(new Error("bad-name"), { code: "bad-name" });
    // Быстрая проверка, чтобы показать понятное сообщение; окончательно запрет держат правила Firestore
    let ex = null;
    try { ex = await getDoc(tRef(key)); } catch (e) {}
    if (ex && ex.exists()) throw Object.assign(new Error("taken"), { code: "taken" });
    b.set(gr, { name, key, adminUid: u.uid, code, createdAt: serverTimestamp() });
    b.set(doc(gr, "members", u.uid), { name: myName, role: "admin", joinedAt: serverTimestamp() });
    b.set(tRef(key), { gid: gr.id, name });
    b.set(doc(db, "codes", code), { gid: gr.id, name });
    b.set(uRef(u.uid), { gid: gr.id, name: myName, groupName: name });
    try { await b.commit(); }
    catch (e) {
      // Если пока мы создавали, группу занял кто-то другой, правила отклонят запись
      try { const t = await getDoc(tRef(key)); if (t.exists()) throw Object.assign(new Error("taken"), { code: "taken" }); } catch (e2) { if (e2 && e2.code === "taken") throw e2; }
      throw e;
    }
    return gr.id;
  },
  async requestJoin(code, myName) {
    const u = await ready(), s = await getDoc(doc(db, "codes", code.trim().toUpperCase()));
    if (!s.exists()) return null;
    const c = s.data();
    await setDoc(rRef(c.gid, u.uid), { name: myName, ts: serverTimestamp() });
    await setDoc(uRef(u.uid), { gid: c.gid, name: myName, groupName: c.name });
    return c;
  },
  async cancelRequest(gid) {
    const u = await ready();
    try { await deleteDoc(rRef(gid, u.uid)); } catch (e) {}
    await deleteDoc(uRef(u.uid));
  },
  async leave(gid) {
    const u = await ready();
    await deleteDoc(mRef(gid, u.uid));
    await deleteDoc(uRef(u.uid));
  },
  // Староста уходит, передав роль другому участнику
  async handOverAndLeave(gid, newUid) {
    const u = await ready(), b = writeBatch(db);
    b.update(gRef(gid), { adminUid: newUid });
    b.update(mRef(gid, newUid), { role: "admin" });
    b.delete(mRef(gid, u.uid));
    b.delete(uRef(u.uid));
    await b.commit();
  },
  // Староста, оставшийся один, удаляет группу: название БарГУ освобождается
  async deleteGroupAsAdmin(gid, g) {
    const u = await ready(), b = writeBatch(db);
    for (const sc of ["requests", "banned"]) {
      try { (await getDocs(collection(db, "groups", gid, sc))).docs.slice(0, 200).forEach(d => b.delete(d.ref)); } catch (e) {}
    }
    b.delete(mRef(gid, u.uid));
    b.delete(uRef(u.uid));
    if (g && g.code) b.delete(doc(db, "codes", g.code));
    if (g && g.key) b.delete(tRef(g.key));
    b.delete(gRef(gid));
    await b.commit();
  },
  watchMember(gid, cb) { return ready().then(u => onSnapshot(mRef(gid, u.uid), s => cb(s.exists()), () => {})); },

  // Записи: «all» — общие, «1»/«2» — подгруппы. У каждой подгруппы своя коллекция, доступ проверяют правила.
  watchFeed(gid, scopes, cb, err) {
    const store = {}, offs = [];
    const emit = () => cb([].concat(...Object.values(store)).sort((a, b) => (b.ts || 0) - (a.ts || 0)));
    scopes.forEach(sc => offs.push(on(query(pCol(gid, sc), orderBy("ts", "desc"), limit(60)),
      arr => { store[sc] = arr.map(p => Object.assign(p, { sub: sc })); emit(); },
      e => { delete store[sc]; if (err) err(e); })));
    return () => offs.forEach(f => { try { f(); } catch (e) {} });
  },
  async watchMe(gid, cb) { const u = await ready(); return onSnapshot(mRef(gid, u.uid), s => cb(s.exists() ? s.data() : null), () => {}); },
  watchQuestions: (gid, cb, err) => on(query(collection(db, "groups", gid, "questions"), orderBy("ts", "desc"), limit(300)), cb, err),
  watchMembers: (gid, cb, err) => on(collection(db, "groups", gid, "members"), cb, err),
  watchRequests: (gid, cb, err) => on(collection(db, "groups", gid, "requests"), cb, err),
  watchLog: (gid, cb, err) => on(query(collection(db, "groups", gid, "log"), orderBy("ts", "desc"), limit(15)), cb, err),
  async watchLearned(cb) { const u = await ready(); return on(collection(db, "users", u.uid, "learned"), cb); },

  async addPost(gid, p, myName) {
    const u = await ready();
    const d = { type: p.type, subject: p.subject || "", text: p.text, authorUid: u.uid, authorName: myName, ts: serverTimestamp(), deleted: false };
    if (p.due) d.due = p.due;
    if (p.files && p.files.length) d.files = p.files;
    await addDoc(pCol(gid, p.sc), d);
  },
  // Вложения: файл целиком (base64) лежит отдельным документом рядом с записями той же подгруппы
  async uploadFile(gid, sc, f) {
    const u = await ready();
    const r = await addDoc(fCol(gid, sc), { name: f.name, mime: f.mime, size: f.size, data: f.data, authorUid: u.uid, ts: serverTimestamp() });
    return r.id;
  },
  async getFile(gid, sc, id) {
    const s = await getDoc(doc(fCol(gid, sc), id));
    return s.exists() ? { name: s.data().name, mime: s.data().mime, data: s.data().data } : null;
  },
  async deleteFiles(gid, sc, files) {
    for (const f of files || []) { try { await deleteDoc(doc(fCol(gid, sc), f.id)); } catch (e) {} }
  },
  // Автоочистка: файлы старше days дней удаляются (записи остаются, вместо файла будет «Вложение удалено»).
  // Запускает староста, зам или модератор; сервер разрешает им удалять любые файлы доступных им разделов.
  async cleanupOldFiles(gid, scopes, days) {
    await ready();
    const cutoff = Timestamp.fromMillis(Date.now() - days * 86400000);
    let n = 0;
    for (const sc of scopes) {
      for (let round = 0; round < 5; round++) {
        let s;
        try { s = await getDocs(query(fCol(gid, sc), where("ts", "<", cutoff), limit(10))); } catch (e) { break; }
        for (const d of s.docs) { try { await deleteDoc(d.ref); n++; } catch (e) {} }
        if (s.docs.length < 10) break;
      }
    }
    return n;
  },
  // ----- Материалы: разделы и файлы (файл режется на части по ~700 КБ, всё в Firestore) -----
  watchSections: (gid, cb, err) => on(query(collection(db, "groups", gid, "msections"), orderBy("ts", "asc")), cb, err),
  watchMFiles: (gid, cb, err) => on(query(collection(db, "groups", gid, "mfiles"), orderBy("ts", "desc"), limit(300)), cb, err),
  async addSection(gid, name, myName) {
    const u = await ready();
    await addDoc(collection(db, "groups", gid, "msections"), { name, authorName: myName, authorUid: u.uid, ts: serverTimestamp() });
  },
  renameSection: (gid, sid, name) => updateDoc(doc(db, "groups", gid, "msections", sid), { name }),
  async deleteSection(gid, sid, files) {
    for (const f of files || []) await api.deleteMFile(gid, f.id);
    await deleteDoc(doc(db, "groups", gid, "msections", sid));
  },
  async uploadMFile(gid, sid, file, myName, onP) {
    const u = await ready(), PART = 700000;
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const n = Math.max(1, Math.ceil(b64.length / PART)), ref = doc(collection(db, "groups", gid, "mfiles")), done = [];
    try {
      for (let i = 0; i < n; i++) {
        if (onP) onP(i + 1, n);
        await setDoc(doc(ref, "parts", String(i)), { i, d: b64.slice(i * PART, (i + 1) * PART) });
        done.push(i);
      }
      await setDoc(ref, { sid, name: file.name.slice(-120), mime: (file.type || "application/octet-stream").slice(0, 100), size: file.size, n, authorUid: u.uid, authorName: myName, ts: serverTimestamp() });
    } catch (e) {
      for (const i of done) { try { await deleteDoc(doc(ref, "parts", String(i))); } catch (_) {} }
      throw e;
    }
    return ref.id;
  },
  async getMFile(gid, f) {
    const s = await getDocs(collection(db, "groups", gid, "mfiles", f.id, "parts"));
    if (s.size < (f.n || 1)) return null;
    return s.docs.map(d => d.data()).sort((x, y) => x.i - y.i).map(x => x.d).join("");
  },
  async deleteMFile(gid, fid) {
    const s = await getDocs(collection(db, "groups", gid, "mfiles", fid, "parts"));
    for (const d of s.docs) { try { await deleteDoc(d.ref); } catch (_) {} }
    await deleteDoc(doc(db, "groups", gid, "mfiles", fid));
  },
  setSub: (gid, uid, sub) => updateDoc(mRef(gid, uid), { sub }),
  setPostDeleted: (gid, sc, id, v) => updateDoc(doc(pCol(gid, sc), id), { deleted: v }),
  async addQuestion(gid, subject, text, myName) {
    const u = await ready();
    await addDoc(collection(db, "groups", gid, "questions"), { subject, text, authorUid: u.uid, authorName: myName, ts: serverTimestamp(), deleted: false });
  },
  setQuestionDeleted: (gid, id, v) => updateDoc(doc(db, "groups", gid, "questions", id), { deleted: v }),
  async setLearned(qid, gid, v) {
    const u = await ready(), r = doc(db, "users", u.uid, "learned", qid);
    if (v) await setDoc(r, { gid, done: true }); else await deleteDoc(r);
  },

  async log(gid, text, byName) { try { await addDoc(collection(db, "groups", gid, "log"), { text, byName, ts: serverTimestamp() }); } catch (e) {} },
  async approve(gid, uid, name) {
    const b = writeBatch(db);
    b.set(mRef(gid, uid), { name, role: "member", joinedAt: serverTimestamp() });
    b.delete(rRef(gid, uid));
    await b.commit();
  },
  reject: (gid, uid) => deleteDoc(rRef(gid, uid)),
  kick: (gid, uid) => deleteDoc(mRef(gid, uid)),
  async ban(gid, uid, name) {
    const b = writeBatch(db);
    b.set(doc(db, "groups", gid, "banned", uid), { name: name || "" });
    b.delete(mRef(gid, uid));
    b.delete(rRef(gid, uid));
    await b.commit();
  },
  setRole: (gid, uid, role) => updateDoc(mRef(gid, uid), { role }),
  async makeAdmin(gid, newUid) {
    const g = await getDoc(gRef(gid)), old = g.data().adminUid, b = writeBatch(db);
    b.update(gRef(gid), { adminUid: newUid });
    b.update(mRef(gid, newUid), { role: "admin" });
    if (old && old !== newUid) {
      const om = await getDoc(mRef(gid, old));
      if (om.exists()) b.update(mRef(gid, old), { role: "moderator" });
    }
    await b.commit();
  },
  async changeCode(gid, name, oldCode) {
    const code = genCode(), b = writeBatch(db);
    b.update(gRef(gid), { code });
    b.set(doc(db, "codes", code), { gid, name });
    b.delete(doc(db, "codes", oldCode));
    await b.commit();
    return code;
  },

  // ----- владелец приложения -----
  async ownerLogin() {
    if (api.isOwner()) return auth.currentUser.email;
    if (!NATIVE) {
      await webSignIn();
      if (!api.isOwner()) { await signOut(auth); throw Object.assign(new Error("not-owner"), { code: "not-owner" }); }
      return auth.currentUser.email;
    }
    const idToken = await googleIdToken();
    // Сначала проверяем почту в самом токене, чтобы не трогать текущую сессию чужим аккаунтом
    if (jwtEmail(idToken) !== OWNER_EMAIL) throw Object.assign(new Error("not-owner"), { code: "not-owner" });
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    await auth.currentUser.getIdToken(true);
    return auth.currentUser.email;
  },
  async ownerGroups() {
    await ready();
    const s = await getDocs(collection(db, "groups"));
    return s.docs.map(d => norm(d.id, d.data()));
  },
  async ownerDeleteGroup(gid, code, key) {
    for (const sc of [["members"], ["requests"], ["banned"], ["posts"], ["gfiles"], ["questions"], ["log"],
      ["subs", "1", "posts"], ["subs", "1", "files"], ["subs", "2", "posts"], ["subs", "2", "files"], ["msections"], ["mfiles"]]) {
      if (sc[0] === "mfiles") {
        const mf = await getDocs(collection(db, "groups", gid, "mfiles"));
        for (const m of mf.docs) {
          const ps = await getDocs(collection(db, "groups", gid, "mfiles", m.id, "parts"));
          for (let i = 0; i < ps.docs.length; i += 400) {
            const pb = writeBatch(db);
            ps.docs.slice(i, i + 400).forEach(d => pb.delete(d.ref));
            await pb.commit();
          }
        }
      }
      const s = await getDocs(collection(db, "groups", gid, ...sc));
      for (let i = 0; i < s.docs.length; i += 400) {
        const b = writeBatch(db);
        s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
        await b.commit();
      }
    }
    try { await deleteDoc(doc(db, "codes", code)); } catch (e) {}
    if (key) { try { await deleteDoc(tRef(key)); } catch (e) {} }
    await deleteDoc(gRef(gid));
  },
  async getGroup(gid) { const g = await getDoc(gRef(gid)); return g.exists() ? norm(gid, g.data()) : null; }
};
window.GroupsApi = api;
export { auth, db };
