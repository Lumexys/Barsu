import JSZip from "jszip";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications as LN } from "@capacitor/local-notifications";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { installApi } from "./api.js";
import { GAMES_URL } from "./firebase-config.js";
import "./groups.js";
import "./sync.js";

window.JSZip = JSZip;
const NATIVE = Capacitor.isNativePlatform();
// раздел «Игры»: в приложении запросы идут на сайт, на сайте — на тот же адрес
window.BARSU_GAMES = { native: NATIVE, base: NATIVE ? GAMES_URL : "" };
const Native = registerPlugin("BarsuNative");
installApi();

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const pad2 = n => String(n).padStart(2, "0");
const fmt = m => Math.floor(m / 60) + ":" + pad2(m % 60);
const selKey = s => !s ? "" : (s.k === "stud" ? "s|" + s.fac + "|" + s.spec + "|" + s.grp : "t|" + s.teacher);
const $id = id => document.getElementById(id);

// ---------- «моё расписание»: пары для виджетов и напоминаний ----------
function lessonsMap(days, parseT) {
  const res = {};
  days.forEach(d => {
    const list = [];
    d.grp.forEach(g => {
      const t = parseT(g.time);
      if (!t) return;
      const aud = g.its.map(x => x.b.find(z => /ауд/i.test(z))).find(Boolean) || "";
      list.push({
        s: t.s, e: t.e, t: g.its.map(x => x.b[0]).join(" / "), a: aud,
        p: g.its.map(x => ({ g: x.sg || "", t: x.b[0], a: x.b.find(z => /ауд/i.test(z)) || "" }))
      });
    });
    res[d.date] = list;
  });
  return res;
}

// Напоминания о начале пары убраны. Здесь только чистим то, что могло остаться от прошлых версий.
async function cancelAll() {
  try {
    const p = await LN.getPending();
    if (p.notifications.length) await LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
  } catch (e) {}
}
// Разрешение на уведомления нужно только для сообщений об изменениях в расписании.
async function askPermissions() {
  try { const p = await LN.requestPermissions(); return p.display === "granted"; } catch (e) { return false; }
}
async function rescheduleFromNative() { if (NATIVE) await cancelAll(); }

// Канал для уведомлений об изменениях в расписании (тот же, что создаёт нативная часть)
async function ensureChannel() {
  try { await LN.createChannel({ id: "changes", name: "Изменения в расписании", importance: 4 }); } catch (e) {}
}

function buildRow(out, days, parseT, sel) {
  const f = LS.get("notif_follow", null), mine = f && f.key === selKey(sel);
  const row = document.createElement("div");
  row.className = "bellrow";
  row.style.cssText = "margin:12px 0;display:flex;flex-direction:column;gap:8px";
  const btn = document.createElement("button");
  btn.className = "nb";
  btn.type = "button";
  const hint = document.createElement("div");
  hint.className = "hint";
  const refresh = () => { row.remove(); buildRow(out, days, parseT, sel); };
  if (mine) {
    btn.textContent = "🔕 Отключить «моё расписание»";
    btn.onclick = async () => {
      LS.set("notif_follow", null);
      try { await Native.clearFollow(); } catch (e) {}
      await cancelAll();
      refresh();
    };
    row.appendChild(btn);
    const subs = [];
    days.forEach(d => d.grp.forEach(g => g.its.forEach(x => { if (x.sg && !subs.includes(x.sg)) subs.push(x.sg); })));
    subs.sort();
    if (subs.length) {
      const ss = document.createElement("select");
      const o0 = document.createElement("option");
      o0.value = ""; o0.textContent = "Моя подгруппа: показывать все";
      ss.appendChild(o0);
      subs.forEach(v => {
        const o = document.createElement("option");
        o.value = v; o.textContent = "Моя подгруппа: " + v;
        if (v === (f.sub || "")) o.selected = true;
        ss.appendChild(o);
      });
      ss.onchange = async () => {
        f.sub = ss.value;
        LS.set("notif_follow", f);
        try { await Native.setFollow({ json: JSON.stringify(f) }); } catch (e) {}
        try { Native.syncNow(); } catch (e) {}
        if (window.__rerenderSched) window.__rerenderSched(); else refresh();
      };
      row.appendChild(ss);
    }
    hint.textContent = "Включены виджеты и уведомления об изменениях в расписании. Данные обновляются в фоне." + (subs.length ? " Выберите свою подгруппу: в виджете останутся только ваши пары." : "");
  } else {
    btn.textContent = "📌 Сделать моим расписанием";
    btn.onclick = async () => {
      btn.disabled = true;
      hint.textContent = "Настраиваем…";
      try {
        if (!(await askPermissions())) {
          hint.textContent = "Разрешите уведомления для приложения в настройках телефона.";
          btn.disabled = false;
          return;
        }
        const b = Object.assign({}, window.__BODY || {});
        delete b.week;
        const nf = Object.assign({ key: selKey(sel), label: sel.label }, b);
        LS.set("notif_follow", nf);
        await Native.setFollow({ json: JSON.stringify(nf) });
        await Native.setLessons({ json: JSON.stringify(lessonsMap(days, parseT)) });
        await Native.syncNow();
        await rescheduleFromNative();
        await Native.scheduleSync();
      } catch (e) {
        hint.textContent = "Не удалось включить: " + (e && e.message ? e.message : e);
        btn.disabled = false;
        return;
      }
      refresh();
    };
    row.appendChild(btn);
    hint.textContent = f
      ? "Сейчас «моё расписание»: " + f.label + ". Нажатие заменит его."
      : "Включит виджеты на рабочий стол и уведомления, когда расписание меняется.";
  }
  row.appendChild(hint);
  out.appendChild(row);
}

async function afterRender(days, parseT, sel) {
  if (!NATIVE || !sel) return;
  const out = $id("sOut");
  if (!out || !out.querySelector(".day")) return;
  const old = out.querySelector(".bellrow");
  if (old) old.remove();
  const f = LS.get("notif_follow", null);
  if (f && f.key === selKey(sel)) {
    try {
      await Native.setLessons({ json: JSON.stringify(lessonsMap(days, parseT)) });
      rescheduleFromNative();
    } catch (e) {}
  }
  if (!out.querySelector(".bellrow")) buildRow(out, days, parseT, sel);
}

// ---------- задания: общее хранилище со страницей и виджетом ----------
function rerenderTasks() {
  // Вкладка «Задания» и блок дедлайнов на главной перерисовываются из общего хранилища
  try { if (window.__rerenderTasks) window.__rerenderTasks(); } catch (e) {}
}
async function pullTasks() {
  try {
    const r = await Native.getTasks();
    const lts = +localStorage.getItem("app_tasks_ts") || 0;
    if (r.ts > lts) {
      localStorage.setItem("tasks", r.json);
      localStorage.setItem("app_tasks_ts", String(r.ts));
      rerenderTasks();
    } else if (r.ts === 0) {
      const cur = localStorage.getItem("tasks");
      if (cur && cur !== "[]") {
        const s = await Native.setTasks({ json: cur });
        localStorage.setItem("app_tasks_ts", String(s.ts));
      }
    }
  } catch (e) {}
}
function onSet(k, v) {
  if (!NATIVE || k !== "tasks") return;
  Native.setTasks({ json: JSON.stringify(v) })
    .then(r => { try { localStorage.setItem("app_tasks_ts", String(r.ts)); } catch (e) {} })
    .catch(() => {});
}

// ---------- переходы из виджетов и уведомлений ----------
// Куда ведёт каждый виджет: [вкладка, инструмент во вкладке «Ещё»]
const OPEN_TARGETS = { tasks: ["tasks", null], gpa: ["more", "gpa"], sched: ["sched", null] };
function applyTarget(t) {
  const e = OPEN_TARGETS[t];
  if (!e || !window.showTab) return false;
  if (e[1] && !window.openTool) return false;
  window.showTab(e[0]);
  if (e[1]) window.openTool(e[1]);
  return true;
}
async function launchTarget(n = 0) {
  let t = "";
  try {
    const r = await Native.consumeLaunch();
    t = (r && r.target) || "";
  } catch (e) {
    // мост ещё не готов (холодный старт): пробуем ещё несколько раз
    if (n < 6) setTimeout(() => launchTarget(n + 1), 300);
    return;
  }
  if (!t) return;
  // На холодном старте страница может дорисоваться позже: пробуем, пока всё не готово, и один раз повторяем
  let tries = 0;
  const go = () => { try { if (!applyTarget(t) && ++tries < 25) setTimeout(go, 120); } catch (e) {} };
  go();
  setTimeout(() => { try { applyTarget(t); } catch (e) {} }, 800);
}
// Задания, добавленные с виджета: файлы лежат в папке приложения, переносим их в хранилище страницы
async function importPending() {
  try {
    const a = JSON.parse(localStorage.getItem("tasks") || "[]");
    let ch = false;
    for (const t of a) {
      if (!t.pf || !t.pf.length || !window.fPut) continue;
      t.f = t.f || [];
      for (const f of t.pf.slice()) {
        try {
          const r = await Native.pendingPath({ id: f.id });
          let blob;
          try {
            const res = await fetch(Capacitor.convertFileSrc("file://" + r.path));
            if (!res.ok) throw new Error("fetch");
            blob = await res.blob();
          } catch (e) {
            const rf = await Filesystem.readFile({ path: "file://" + r.path });
            const bin = atob(rf.data), u8 = new Uint8Array(bin.length);
            for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
            blob = new Blob([u8], { type: f.mime || "application/octet-stream" });
          }
          if (!blob.type && f.mime) blob = new Blob([blob], { type: f.mime });
          await window.fPut(f.id, blob);
          t.f.push({ id: f.id, name: f.name, mime: f.mime, size: f.size });
          Native.deletePending({ id: f.id }).catch(() => {});
          t.pf = t.pf.filter(x => x.id !== f.id);
          ch = true;
        } catch (e) {
          // не вышло сейчас: файл останется в очереди до следующего открытия
        }
      }
      if (!t.pf.length) delete t.pf;
    }
    if (ch) {
      const j = JSON.stringify(a);
      localStorage.setItem("tasks", j);
      const s = await Native.setTasks({ json: j });
      localStorage.setItem("app_tasks_ts", String(s.ts));
      rerenderTasks();
    }
  } catch (e) {}
}
async function onResume() {
  if (!NATIVE) return;
  await launchTarget();
  await pullTasks();
  await importPending();
  await rescheduleFromNative();
}

// ---------- сохранение файлов ----------
const asciiName = n => n.replace(/[^\w.\-]+/g, "_");
async function writeAndShare(data, name, opts) {
  let r;
  try {
    r = await Filesystem.writeFile(Object.assign({ path: name, data, directory: Directory.Cache }, opts));
  } catch (e) {
    r = await Filesystem.writeFile(Object.assign({ path: asciiName(name), data, directory: Directory.Cache }, opts));
  }
  await Share.share({ title: name, url: r.uri, dialogTitle: "Сохранить или отправить" });
}
const toB64 = blob => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1]);
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(blob);
});
// Сначала сохраняем прямо в «Загрузки». Если не вышло (старый Android), открываем меню «Поделиться».
async function saveFile(blob, name) {
  let b64;
  try { b64 = await toB64(blob); } catch (e) { return { ok: false }; }
  const mime = blob.type || "application/octet-stream";
  try {
    const r = await Native.saveToDownloads({ name, mime, data: b64 });
    return { ok: true, saved: true, uri: r.uri, name: r.name || name, mime };
  } catch (e) {}
  try {
    await writeAndShare(b64, name, {});
    return { ok: true, saved: false };
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || e))) return { ok: true, saved: false };
    return { ok: false };
  }
}
async function openFile(uri, mime) {
  try { await Native.openFile({ uri, mime }); return true; } catch (e) { return false; }
}
async function shareFile(blob, name) {
  try { await writeAndShare(await toB64(blob), name, {}); } catch (e) {}
}
async function saveIcs(text, name) {
  try {
    await writeAndShare(text, name, { encoding: Encoding.UTF8 });
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || e))) return;
    const m = $id("sMsg");
    if (m) m.textContent = "Не удалось сохранить файл календаря.";
  }
}
async function pinWidget(name) {
  try { const r = await Native.pinWidget({ name }); return !!(r && r.ok); } catch (e) { return false; }
}

window.AppNative = { isNative: NATIVE, afterRender, saveIcs, saveFile, openFile, shareFile, pinWidget, onSet };

if (NATIVE) {
  const hide = () => { const b = $id("shBtn"); if (b) b.style.display = "none"; };
  document.addEventListener("DOMContentLoaded", hide);
  hide();
  ensureChannel();
  window.addEventListener("load", () => {
    const f = LS.get("notif_follow", null);
    if (f) Native.setFollow({ json: JSON.stringify(f) }).catch(() => {});
    Native.scheduleSync().catch(() => {});
    onResume();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) onResume(); });
  // Нативная часть сама сообщает странице, что виджет открыл приложение уже запущенным
  window.addEventListener("barsuOpen", () => { launchTarget(); });
}
