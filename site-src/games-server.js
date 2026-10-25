// Сервер раздела «Игры»: профили, рекорды, рейтинги, лига, пиксель-батл, комнаты для игры онлайн.
// Подключается из _worker.js. Данные хранятся в Durable Objects (Cloudflare), Firestore не используется.
// GameHub — один на всё приложение (профили, рекорды, лига, подбор соперников, список комнат),
// GamePixel — одно полотно пиксель-батла, GameRoom — по одному на каждую комнату с кодом.

const PROJECT = "barsu-student";               // проект Firebase: по нему проверяется вход Google
const OWNER = "vgostahunorberta362@gmail.com"; // владелец приложения — доступ к панели игр
const FACS = ["if", "lf", "fpp", "fep"];
const LEAGUE_TOP = 8, LEAGUE_MIN = 10, FAC_TOP = 20, PX = 128;

// Проверка результатов: минимальная длительность партии, очков в секунду, максимум, время (для игр на время)
const META = {
  "2048": { s: 10, max: 4e6 }, flappy: { r: 1.6, s: 3, max: 3000 }, doodle: { r: 90, s: 3, max: 3e5 }, ninja: { r: 7, s: 5, max: 1e4 },
  snake: { r: 3, s: 3, max: 400 }, stack: { r: 3, s: 3, max: 2000 }, clicker: { s: 10, max: 1e13, noLeague: 1 }, match3: { s: 15, max: 1e6 },
  blocks: { s: 10, max: 1e6 }, sudoku: { s: 30, mt: 45, t: 1 }, mines: { s: 4, mt: 5, t: 1 }, nonogram: { s: 20, mt: 25, t: 1 },
  connect: { s: 15, max: 100 }, crossword: { s: 30, mt: 40, t: 1 }, wordle: { s: 5, max: 5000 }, flags: { r: 15, s: 15, max: 300 },
  klondike: { s: 40, mt: 60, t: 1 }, td: { s: 30, max: 1000 },
  uno: { mp: 1 }, durak: { mp: 1 }, poker: { mp: 1 }, reversi: { mp: 1 }, connect4: { mp: 1 }, gomoku: { mp: 1 }, battleship: { mp: 1 },
  checkers: { mp: 1 }, chess: { mp: 1 }, nardy: { mp: 1 }, billiards: { mp: 1 }, haxball: { mp: 1 }, airhockey: { mp: 1 }, bomber: { mp: 1 },
  slither: { mp: 1 }, tanks: { mp: 1 },
  mafia: { party: 1 }, crocodile: { party: 1 }, balda: { party: 1 }, hangman: { party: 1 }, whosaid: { party: 1 }
};
// Сколько мест в комнате (min..max) у игр, которые уже работают онлайн
const ROOMS = {
  reversi: [2, 2], connect4: [2, 2], gomoku: [2, 2], checkers: [2, 2], chess: [2, 2], battleship: [2, 2], nardy: [2, 2], billiards: [2, 2],
  durak: [2, 2], uno: [2, 4], airhockey: [2, 2], haxball: [2, 6], bomber: [2, 4], tanks: [2, 4]
};

function seasonOf(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();
  return m >= 8 ? { id: y + "-autumn", name: "Осень " + y, end: Date.UTC(y, 11, 31, 21, 0) } : { id: y + "-spring", name: "Весна " + y, end: Date.UTC(y, 5, 30, 21, 0) };
}
const dayKey = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10); // день по Минску
const BAD = /(хуй|хуе|хуё|пизд|бля|ебa|еба|ёба|ебл|сука|суки|муда|пидо|пидр|fuck|shit|nigg|сучк|залуп|гандон|шлюх|долбо)/i;
function nameError(n) {
  if (typeof n !== "string") return "Нет имени";
  n = n.trim();
  if (n.length < 3 || n.length > 40) return "Имя — от 3 до 40 символов";
  if (!/^[0-9A-Za-zА-Яа-яЁёІіЎў'’ ._-]+$/.test(n) || (n.match(/[A-Za-zА-Яа-яЁёІіЎў]/g) || []).length < 2) return "Только буквы, цифры, пробел и дефис";
  if (BAD.test(n)) return "Имя не прошло фильтр";
  return null;
}
const J = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {}) });
const rnd = n => Math.floor(Math.random() * n);

/* ================= Проверка входа Google (Firebase ID token) ================= */
let JWKS = null, JWKS_AT = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function verifyToken(tok) {
  const [h, p, s] = tok.split(".");
  if (!s) throw new Error("bad token");
  const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  const now = Date.now() / 1000;
  if (pay.aud !== PROJECT || pay.iss !== "https://securetoken.google.com/" + PROJECT || pay.exp < now || pay.iat > now + 300 || !pay.sub) throw new Error("bad claims");
  if (!JWKS || Date.now() - JWKS_AT > 3600e3) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    JWKS = (await r.json()).keys; JWKS_AT = Date.now();
  }
  const jwk = JWKS.find(k => k.kid === head.kid);
  if (!jwk) { JWKS = null; throw new Error("unknown key"); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(h + "." + p));
  if (!ok) throw new Error("bad signature");
  const prov = pay.firebase && pay.firebase.sign_in_provider;
  if (prov !== "google.com") throw new Error("google only");
  return { uid: pay.sub, email: pay.email || "", admin: pay.email === OWNER && pay.email_verified === true };
}
async function identify(req, env, url) {
  if (env.DEV_AUTH === "1") { // только для локальной проверки (файл .dev.vars), на сервере этой переменной нет
    const d = req.headers.get("X-Dev-User") || url.searchParams.get("dev");
    if (d) { const [uid, email] = d.split("|"); return { uid, email: email || "", admin: email === OWNER }; }
  }
  const a = req.headers.get("Authorization") || "", t = a.startsWith("Bearer ") ? a.slice(7) : url.searchParams.get("token");
  if (!t) return null;
  try { return await verifyToken(t); } catch (e) { return null; }
}

/* ================= Маршрутизатор /api/g/* (вызывается из _worker.js) ================= */
const ORIGINS = ["https://localhost", "http://localhost", "capacitor://localhost"];
function cors(req) {
  const o = req.headers.get("Origin");
  if (!o || !ORIGINS.includes(o)) return {};
  return { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Dev-User", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
export async function handleGames(req, env) {
  const url = new URL(req.url), c = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  const withC = r => { if (r.webSocket || r.status === 101) return r; const h = new Headers(r.headers); for (const k in c) h.set(k, c[k]); return new Response(r.body, { status: r.status, headers: h }); };
  if (!env.GAMEHUB) return withC(J(503, { error: "Сервер игр ещё не настроен (нет привязки GAMEHUB в wrangler.toml)" }));
  const who = await identify(req, env, url);
  if (!who) return withC(J(401, { error: "Нужен вход через Google" }));
  const path = url.pathname.slice("/api/g".length) || "/";
  if (path.startsWith("/int")) return withC(J(404, { error: "not found" }));
  if (path.startsWith("/admin") && !who.admin) return withC(J(403, { error: "Только для владельца приложения" }));
  const fwd = (ns, name, p) => {
    const h = new Headers(req.headers); h.set("X-Uid", who.uid); h.set("X-Admin", who.admin ? "1" : "0"); h.delete("Authorization");
    const u = new URL(req.url); u.pathname = p;
    return env[ns].get(env[ns].idFromName(name)).fetch(new Request(u.toString(), { method: req.method, headers: h, body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body }));
  };
  const hubMe = async () => (await env.GAMEHUB.get(env.GAMEHUB.idFromName("hub")).fetch(new Request("https://hub/me", { headers: { "X-Uid": who.uid, "X-Admin": who.admin ? "1" : "0" } }))).json();
  // пиксель-батл: полотно знает факультет игрока, поэтому сначала узнаём профиль
  if (path.startsWith("/pixel") || path.startsWith("/admin/pixel")) {
    const pr = await hubMe();
    const h = new Headers(req.headers); h.set("X-Uid", who.uid); h.set("X-Admin", who.admin ? "1" : "0"); h.set("X-Fac", pr.profile ? pr.profile.fac || "" : ""); h.set("X-Banned", pr.profile && pr.profile.banned ? "1" : "0"); h.delete("Authorization");
    const u = new URL(req.url); u.pathname = path.replace("/admin/pixel", "/admin");
    const stub = env.GAMEPIXEL.get(env.GAMEPIXEL.idFromName("canvas"));
    return withC(await stub.fetch(new Request(u.toString(), { method: req.method, headers: h, body: req.method === "GET" ? undefined : req.body })));
  }
  // комната: /room/1234/ws — подключение по WebSocket
  const rm = /^\/room\/(\d{4})\/ws$/.exec(path);
  if (rm) {
    const pr = await hubMe();
    if ((!pr.profile || !pr.profile.name) && !who.admin) return withC(J(400, { error: "Сначала укажите имя и факультет" }));
    const prof = pr.profile && pr.profile.name ? pr.profile : { name: "Администратор", fac: "" };
    const h = new Headers(req.headers); h.set("X-Uid", who.uid); h.set("X-Admin", who.admin ? "1" : "0");
    h.set("X-Name", encodeURIComponent(prof.name)); h.set("X-Fac", prof.fac || ""); h.set("X-Elo", JSON.stringify(pr.elo || {}));
    const u = new URL(req.url); u.pathname = "/ws";
    return env.GAMEROOM.get(env.GAMEROOM.idFromName(rm[1])).fetch(new Request(u.toString(), { headers: h }));
  }
  return withC(await fwd("GAMEHUB", "hub", path));
}

/* ================= Общая обёртка Durable Object ================= */
// Логика написана без особенностей Cloudflare, чтобы её можно было проверить локально.
class Base {
  constructor(state, env) {
    this.state = state; this.env = env; this.store = state.storage;
    this.ready = state.blockConcurrencyWhile ? state.blockConcurrencyWhile(() => this.load()) : this.load();
  }
  async load() { }
  sockets(tag) { return this.state.getWebSockets ? this.state.getWebSockets(tag) : []; }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  setAtt(ws, a) { try { ws.serializeAttachment(a); } catch (e) { } }
  accept(req, attach, tags) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, tags || []);
    this.setAtt(server, attach);
    return { res: new Response(null, { status: 101, webSocket: client }), ws: server };
  }
  hub() { return this.env.GAMEHUB.get(this.env.GAMEHUB.idFromName("hub")); }
}
const send = (ws, m) => { try { ws.send(typeof m === "string" ? m : JSON.stringify(m)); } catch (e) { } };

/* ================= GameHub ================= */
export class GameHub extends Base {
  async load() {
    // профили и результаты хранятся отдельными записями: p:uid и s:сезон:игра (у каждой записи предел 2 МБ)
    this.season = seasonOf(); this.prof = {}; this.sc = {};
    for (const [k, v] of await this.store.list({ prefix: "p:" })) this.prof[k.slice(2)] = v;       // uid → {name, fac, season, nameAt, banned}
    for (const [k, v] of await this.store.list({ prefix: "s:" + this.season.id + ":" })) this.sc[k.split(":")[2]] = v; // game → uid → {b, e, w, l, d, n}
    this.pop = (await this.store.get("pop")) || {};             // день → game → n
    this.pairs = (await this.store.get("pairs")) || {};         // день → "uidA|uidB" → n
    this.pixelBonus = (await this.store.get("pxbonus:" + this.season.id)) || {};
    this.rooms = {}; this.queue = {}; this.subs = {}; this.seen = {}; this.invites = {}; this.lcache = null;
  }
  async saveProf(uid) { await this.store.put("p:" + uid, this.prof[uid]); }
  async saveSc(g) { this.lcache = null; await this.store.put("s:" + this.season.id + ":" + g, this.sc[g] || {}); }
  checkSeason() { const s = seasonOf(); if (s.id !== this.season.id) { this.season = s; this.sc = {}; this.pixelBonus = {}; this.lcache = null; } }
  my(uid) { const o = {}; for (const g in this.sc) if (this.sc[g][uid]) o[g] = this.sc[g][uid]; return o; }
  elo(uid) { const o = {}; for (const g in this.sc) if (this.sc[g][uid] && this.sc[g][uid].e != null) o[g] = this.sc[g][uid].e; return o; }
  async fetch(req) {
    await this.ready; this.checkSeason();
    const url = new URL(req.url), p = url.pathname, uid = req.headers.get("X-Uid"), admin = req.headers.get("X-Admin") === "1";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    try {
      if (uid && !p.startsWith("/int")) this.seen[uid] = Date.now();
      const r = await this.route(p, url, uid, admin, body);
      return r instanceof Response ? r : J(200, r);
    } catch (e) { return J(e.status || 500, { error: e.message || String(e) }); }
  }
  async route(p, url, uid, admin, b) {
    const S = this.season, me = this.prof[uid];
    const err = (s, m) => Object.assign(new Error(m), { status: s });
    switch (p) {
      case "/me": return { uid, profile: me ? { ...me, needFac: me.season !== S.id } : null, season: { id: S.id, name: S.name, end: S.end }, stats: this.my(uid), elo: this.elo(uid), admin };
      case "/profile": {
        const now = Date.now(), cur = this.prof[uid] || { nameAt: 0 };
        const out = { ...cur };
        if (b.name != null && b.name.trim() !== cur.name) {
          const e = nameError(b.name); if (e) throw err(400, e);
          if (cur.name && !admin && now - (cur.nameAt || 0) < 864e5) throw err(400, "Имя можно менять раз в сутки");
          out.name = b.name.trim().replace(/\s+/g, " "); out.nameAt = cur.name ? now : 0;
        }
        if (b.fac != null && b.fac !== cur.fac) {
          if (!FACS.includes(b.fac)) throw err(400, "Нет такого факультета");
          if (cur.season === S.id && cur.fac && !admin) throw err(400, "Факультет можно сменить только в новом сезоне");
          out.fac = b.fac;
        }
        if (b.fac || !out.season) out.season = out.fac ? S.id : out.season;
        if (!out.name) throw err(400, "Укажите имя");
        this.prof[uid] = out; await this.saveProf(uid);
        return { profile: { ...out, needFac: out.season !== S.id } };
      }
      case "/submit": {
        if (!me || !me.name) throw err(400, "Сначала укажите имя");
        if (me.banned) throw err(403, "Ваши результаты временно не принимаются");
        const g = b.game, m = META[g]; if (!m || m.mp || m.party) throw err(400, "Эта игра не принимает очки");
        const score = Number(b.score), sec = Number(b.sec);
        if (!isFinite(score) || score < 0 || !isFinite(sec) || sec < 0) throw err(400, "Неверные данные");
        const now = Date.now(), log = (this.subs[uid] = (this.subs[uid] || []).filter(x => now - x.t < 3600e3));
        if (log.length >= 60) throw err(429, "Слишком много результатов за час (лимит 60)");
        if (log.filter(x => x.g === g).length >= 20) throw err(429, "По этой игре уже 20 результатов за час. Сделайте перерыв.");
        let bad = null;
        if (sec < (m.s || 3)) bad = "Партия слишком короткая — результат не засчитан.";
        else if (m.r && score / Math.max(1, sec) > m.r) bad = "Очки набраны быстрее, чем это возможно.";
        else if (m.t && score < (m.mt || 1)) bad = "Подозрительно быстро.";
        else if (m.max && score > m.max) bad = "Слишком большой результат.";
        else if (m.t && Math.abs(score - sec) > 15) bad = "Время партии не совпадает.";
        log.push({ t: now, g });
        this.pop[dayKey()] = this.pop[dayKey()] || {}; this.pop[dayKey()][g] = (this.pop[dayKey()][g] || 0) + 1; this.trimPop();
        if (bad) { await this.store.put("pop", this.pop); return { ok: false, error: bad }; }
        const t = (this.sc[g] = this.sc[g] || {}), cur = (t[uid] = t[uid] || { n: 0 });
        cur.n++; let rec = false;
        if (cur.b == null || (m.t ? score < cur.b : score > cur.b)) { cur.b = score; rec = true; }
        await this.saveSc(g); await this.store.put("pop", this.pop);
        const bd = this.board(g), pos = bd.findIndex(x => x.uid === uid) + 1;
        return { ok: true, rec, best: cur.b, place: pos, of: bd.length };
      }
      case "/board": {
        const g = url.searchParams.get("game"), f = url.searchParams.get("fac");
        if (!META[g]) throw err(400, "Нет такой игры");
        let bd = this.board(g); if (f) bd = bd.filter(x => x.fac === f);
        const i = bd.findIndex(x => x.uid === uid);
        return { rows: bd.slice(0, 100).map((x, k) => ({ ...x, me: x.uid === uid, place: k + 1, uid: undefined })), mine: i >= 100 ? { ...bd[i], place: i + 1, me: true, uid: undefined } : null, total: bd.length };
      }
      case "/league": return this.league(uid);
      case "/popular": {
        const tot = {}, days = Object.keys(this.pop).sort().slice(-7);
        days.forEach(d => { for (const g in this.pop[d]) tot[g] = (tot[g] || 0) + this.pop[d][g]; });
        return { plays: tot };
      }
      case "/played": { // партия в онлайн/бот-играх для «Популярных» (без очков)
        const g = b.game; if (!META[g]) throw err(400, "Нет такой игры");
        const now = Date.now(), log = (this.subs[uid] = (this.subs[uid] || []).filter(x => now - x.t < 3600e3));
        if (log.length < 80) { log.push({ t: now, g: "_" }); this.pop[dayKey()] = this.pop[dayKey()] || {}; this.pop[dayKey()][g] = (this.pop[dayKey()][g] || 0) + 1; this.trimPop(); await this.store.put("pop", this.pop); }
        return { ok: true };
      }
      /* ---- комнаты ---- */
      case "/rooms": {
        const g = url.searchParams.get("game");
        return { rooms: Object.entries(this.rooms).filter(([c, r]) => r.open && r.status === "lobby" && r.n >= 1 && r.n < r.max && (!g || r.game === g) && Date.now() - r.upd < 30 * 60e3).map(([code, r]) => ({ code, ...r })) };
      }
      case "/rooms/create": {
        if (!me || !me.name) throw err(400, "Сначала укажите имя");
        const R = ROOMS[b.game]; if (!R) throw err(400, "В эту игру пока нельзя играть онлайн");
        const max = Math.max(R[0], Math.min(R[1], b.max | 0 || R[1]));
        const code = this.newCode();
        await this.initRoom(code, { game: b.game, max, min: R[0], open: !!b.open, rated: false, time: b.time || null, team: b.team || null, host: uid });
        return { code };
      }
      case "/rooms/check": { const r = this.rooms[b.code]; if (!r) throw err(404, "Комната не найдена. Проверьте код — он действует, пока комната открыта."); return { code: b.code, game: r.game }; }
      case "/queue": {
        if (!me || !me.name) throw err(400, "Сначала укажите имя");
        const g = b.game; const R = ROOMS[g]; if (!R) throw err(400, "В эту игру пока нельзя играть онлайн");
        if (b.cancel) { for (const k in this.queue) this.queue[k] = this.queue[k].filter(x => x.uid !== uid); return { state: "off" }; }
        const q = (this.queue[g] = (this.queue[g] || []).filter(x => Date.now() - x.seen < 8000 || x.found));
        let e = q.find(x => x.uid === uid);
        if (e && e.found) { this.queue[g] = q.filter(x => x !== e); return { state: "found", code: e.found }; }
        const elo = (this.sc[g] && this.sc[g][uid] && this.sc[g][uid].e) || 1000;
        if (!e) { e = { uid, name: me.name, fac: me.fac, elo, t: Date.now() }; q.push(e); }
        e.seen = Date.now();
        await this.match(g);
        if (e.found) { this.queue[g] = this.queue[g].filter(x => x !== e); return { state: "found", code: e.found }; }
        const w = Math.floor((Date.now() - e.t) / 1000);
        return { state: "wait", sec: w, range: w < 10 ? 100 : w < 20 ? 200 : 400, inQueue: q.filter(x => !x.found).length };
      }
      case "/invite": {
        if (!me || !me.name) throw err(400, "Сначала укажите имя");
        const to = String(b.to || ""); if (!to || !b.code || !this.rooms[b.code]) throw err(400, "Комната не найдена");
        (this.invites[to] = (this.invites[to] || []).filter(x => Date.now() - x.t < 5 * 60e3 && x.code !== b.code)).push({ from: me.name, game: this.rooms[b.code].game, code: b.code, t: Date.now() });
        return { ok: true };
      }
      case "/inbox": {
        const ok = x => { const r = this.rooms[x.code]; return r && r.status === "lobby" && r.n < r.max && Date.now() - x.t < 5 * 60e3; };
        const seen = new Set(), list = (this.invites[uid] || []).filter(ok).sort((a, b) => b.t - a.t).filter(x => !seen.has(x.from) && seen.add(x.from));
        if (b.clear || url.searchParams.get("clear")) delete this.invites[uid];
        return { invites: list };
      }
      case "/online": { // кто из списка (одногруппники) сейчас в приложении
        const ids = String(url.searchParams.get("ids") || "").split(",").slice(0, 80);
        return { online: ids.filter(i => this.seen[i] && Date.now() - this.seen[i] < 3 * 60e3) };
      }
      /* ---- внутренние вызовы от комнат и полотна ---- */
      case "/int/room": {
        if (b.closed) delete this.rooms[b.code]; else this.rooms[b.code] = { ...(this.rooms[b.code] || {}), ...b.info, upd: Date.now() };
        return { ok: true };
      }
      case "/int/rated": return this.rated(b);
      case "/int/pxbonus": { this.pixelBonus = b.bonus; await this.store.put("pxbonus:" + this.season.id, this.pixelBonus); this.lcache = null; return { ok: true }; }
      case "/int/fac": return { fac: this.prof[b.uid] ? this.prof[b.uid].fac : "" };
      /* ---- панель владельца ---- */
      case "/admin/players": {
        const q = String(url.searchParams.get("q") || "").toLowerCase();
        const list = Object.entries(this.prof).filter(([u, x]) => !q || (x.name || "").toLowerCase().includes(q) || u === q).slice(0, 60)
          .map(([u, x]) => ({ uid: u, ...x, games: Object.keys(this.my(u)).length, seen: this.seen[u] || 0 }));
        return { players: list, total: Object.keys(this.prof).length };
      }
      case "/admin/player": {
        const u = String(b.uid || ""); if (!this.prof[u] && !b.scores) throw err(404, "Нет такого игрока");
        if (b.get) return { uid: u, profile: this.prof[u], stats: this.my(u) };
        const pr = this.prof[u] = this.prof[u] || {};
        if (b.name != null) { const e = nameError(b.name); if (e) throw err(400, e); pr.name = b.name.trim(); }
        if (b.fac != null) { if (!FACS.includes(b.fac)) throw err(400, "Нет такого факультета"); pr.fac = b.fac; pr.season = this.season.id; }
        if (b.banned != null) pr.banned = !!b.banned;
        if (b.scores) for (const g in b.scores) {
          if (!META[g]) continue; const v = b.scores[g], t = (this.sc[g] = this.sc[g] || {});
          if (v === null) { delete t[u]; continue; }
          const cur = (t[u] = t[u] || { n: 0 });
          if (v.b !== undefined) { if (v.b === null || v.b === "") delete cur.b; else cur.b = Number(v.b); }
          if (v.e !== undefined) { if (v.e === null || v.e === "") delete cur.e; else cur.e = Math.round(Number(v.e)); }
          if (cur.b == null && cur.e == null) delete t[u];
        }
        if (b.resetAll) for (const g in this.sc) delete this.sc[g][u];
        await this.saveProf(u);
        for (const g in this.sc) if (b.resetAll || (b.scores && g in b.scores)) await this.saveSc(g);
        return { ok: true, profile: pr, stats: this.my(u) };
      }
      case "/admin/rooms": return { rooms: Object.entries(this.rooms).map(([code, r]) => ({ code, ...r })) };
      case "/admin/close-room": {
        const stub = this.env.GAMEROOM.get(this.env.GAMEROOM.idFromName(b.code));
        await stub.fetch(new Request("https://room/int/close", { method: "POST", body: "{}" })); delete this.rooms[b.code]; return { ok: true };
      }
      case "/admin/pxbonus": { this.pixelBonus = b.bonus || {}; await this.store.put("pxbonus:" + this.season.id, this.pixelBonus); this.lcache = null; return { ok: true }; }
    }
    throw err(404, "not found");
  }
  trimPop() { const ks = Object.keys(this.pop).sort(); while (ks.length > 8) delete this.pop[ks.shift()]; }
  board(g) {
    const m = META[g], t = this.sc[g] || {}, out = [];
    for (const u in t) {
      const p = this.prof[u]; if (!p || p.banned || !p.name) continue;
      const v = m.mp ? t[u].e : t[u].b; if (v == null) continue;
      out.push({ uid: u, name: p.name, fac: p.fac, score: v, w: t[u].w, l: t[u].l });
    }
    out.sort((a, b) => m.t ? a.score - b.score : b.score - a.score);
    return out;
  }
  league(uid) {
    if (!this.lcache || Date.now() - this.lcache.t > 60e3) {
      const pl = {};
      for (const g in META) {
        if (META[g].noLeague || META[g].party) continue;
        const bd = this.board(g), n = bd.length; if (n < LEAGUE_MIN) continue;
        // таблица уже отсортирована от лучшего к худшему: «хуже меня» = все ниже последнего с таким же результатом
        let end = n - 1;
        for (let i = n - 1; i >= 0; i--) {
          if (i < n - 1 && bd[i].score !== bd[i + 1].score) end = i;
          const x = bd[i], worse = n - 1 - end;
          (pl[x.uid] = pl[x.uid] || { name: x.name, fac: x.fac, list: [] }).list.push({ g, pts: 100 * worse / (n - 1) });
        }
      }
      for (const u in pl) { const p = pl[u]; p.list.sort((a, b) => b.pts - a.pts); p.pts = p.list.slice(0, LEAGUE_TOP).reduce((s, x) => s + x.pts, 0); }
      const facs = FACS.map(f => {
        const top = Object.entries(pl).filter(([u, p]) => p.fac === f).sort((a, b) => b[1].pts - a[1].pts).slice(0, FAC_TOP);
        const games = top.reduce((s, [u, p]) => s + p.pts, 0), px = this.pixelBonus[f] || 0;
        return { id: f, games: Math.round(games), pixel: px, total: Math.round(games + px), top: top.slice(0, 5).map(([u, p]) => ({ name: p.name, pts: Math.round(p.pts) })) };
      }).sort((a, b) => b.total - a.total);
      this.lcache = { t: Date.now(), facs, pl };
    }
    const L = this.lcache, mine = L.pl[uid];
    let rank = 0, need = 0;
    if (mine) { const same = Object.values(L.pl).filter(p => p.fac === mine.fac).sort((a, b) => b.pts - a.pts); rank = same.indexOf(mine) + 1; if (rank > FAC_TOP) need = Math.ceil(same[FAC_TOP - 1].pts - mine.pts + 1); }
    return { season: { id: this.season.id, name: this.season.name, end: this.season.end }, facs: L.facs, me: mine ? { pts: Math.round(mine.pts), rank, need, list: mine.list.map(x => ({ g: x.g, pts: Math.round(x.pts) })) } : null };
  }
  newCode() { for (let i = 0; i < 200; i++) { const c = String(1000 + rnd(9000)); if (!this.rooms[c]) return c; } throw new Error("Нет свободных кодов"); }
  async initRoom(code, cfg) {
    this.rooms[code] = { game: cfg.game, open: cfg.open, max: cfg.max, n: 0, status: "lobby", rated: cfg.rated, hostName: (this.prof[cfg.host] || {}).name || "", hostFac: (this.prof[cfg.host] || {}).fac || "", upd: Date.now() };
    const stub = this.env.GAMEROOM.get(this.env.GAMEROOM.idFromName(code));
    await stub.fetch(new Request("https://room/int/init", { method: "POST", body: JSON.stringify({ code, ...cfg }) }));
  }
  async match(g) {
    const q = this.queue[g].filter(x => !x.found); if (q.length < 2) return;
    const R = ROOMS[g], want = R[1] > 2 ? Math.min(R[1], 4) : 2, now = Date.now(), day = dayKey();
    const pairs = (this.pairs[day] = this.pairs[day] || {});
    for (const ks of Object.keys(this.pairs)) if (ks !== day) delete this.pairs[ks];
    q.sort((a, b) => a.t - b.t);
    for (const a of q) {
      if (a.found) continue;
      const wa = (now - a.t) / 1000, ra = wa < 10 ? 100 : wa < 20 ? 200 : 400;
      const grp = [a];
      for (const b of q) {
        if (b === a || b.found || grp.length >= want) continue;
        const wb = (now - b.t) / 1000, rb = wb < 10 ? 100 : wb < 20 ? 200 : 400;
        if (Math.abs(a.elo - b.elo) > Math.min(ra, rb)) continue;
        if (grp.some(x => (pairs[[x.uid, b.uid].sort().join("|")] || 0) >= 3)) continue;
        grp.push(b);
      }
      const oldest = Math.min(...grp.map(x => x.t));
      if (grp.length >= want || (grp.length >= 2 && now - oldest > 20e3)) {
        const code = this.newCode();
        await this.initRoom(code, { game: g, max: grp.length, min: grp.length, open: false, rated: true, reserved: grp.map(x => x.uid), host: grp[0].uid });
        grp.forEach(x => x.found = code);
      }
    }
  }
  async rated(b) {
    // b: {game, seats:[uid], ranks:[0 = первое место ...]} — пересчёт Эло попарно
    const g = b.game, t = (this.sc[g] = this.sc[g] || {}), n = b.seats.length;
    const E = b.seats.map(u => (t[u] && t[u].e) || 1000), K = 32 / Math.max(1, n - 1), delta = b.seats.map(() => 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const s = b.ranks[i] < b.ranks[j] ? 1 : b.ranks[i] === b.ranks[j] ? .5 : 0, ex = 1 / (1 + 10 ** ((E[j] - E[i]) / 400));
      delta[i] += K * (s - ex);
    }
    const day = dayKey(); this.pairs[day] = this.pairs[day] || {};
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const k = [b.seats[i], b.seats[j]].sort().join("|"); this.pairs[day][k] = (this.pairs[day][k] || 0) + 1; }
    b.seats.forEach((u, i) => {
      const cur = (t[u] = t[u] || { n: 0 }); cur.e = Math.round(E[i] + delta[i]); cur.n = (cur.n || 0) + 1;
      const best = Math.min(...b.ranks); if (b.ranks[i] === best && b.ranks.filter(r => r === best).length === 1) cur.w = (cur.w || 0) + 1; else if (b.ranks[i] === best) cur.d = (cur.d || 0) + 1; else cur.l = (cur.l || 0) + 1;
    });
    this.pop[day] = this.pop[day] || {}; this.pop[day][g] = (this.pop[day][g] || 0) + n;
    await this.saveSc(g); await this.store.put("pairs", this.pairs); await this.store.put("pop", this.pop);
    return { delta: delta.map(Math.round), elo: b.seats.map(u => t[u].e) };
  }
}

/* ================= GamePixel ================= */
export class GamePixel extends Base {
  async load() {
    const s = await this.store.get("px");
    this.px = s ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(PX * PX);
    this.last = (await this.store.get("last")) || {};   // uid → время последней клетки
    this.cfg = (await this.store.get("cfg")) || { cd: 180, end: nextSunday(), round: 1, mine: {} };
    this.pending = []; this.dirty = false;
  }
  enc() { let s = ""; for (let i = 0; i < this.px.length; i += 8192) s += String.fromCharCode.apply(null, this.px.subarray(i, i + 8192)); return btoa(s); }
  async save() { await this.store.put("px", this.enc()); await this.store.put("last", this.last); await this.store.put("cfg", this.cfg); }
  shares() { const c = [0, 0, 0, 0, 0]; for (const v of this.px) c[v]++; const o = {}; FACS.forEach((f, i) => o[f] = c[i + 1]); return o; }
  broadcast(cells) { const m = JSON.stringify({ t: "px", c: cells }); this.sockets().forEach(ws => send(ws, m)); }
  async roundCheck() {
    if (Date.now() < this.cfg.end) return;
    // раунд закончился: места по доле полотна → бонус в лигу, новое полотно
    const sh = this.shares(), order = FACS.slice().sort((a, b) => sh[b] - sh[a]), pts = [150, 100, 50, 0];
    const prev = (await this.store.get("bonus:" + seasonOf().id)) || {};
    order.forEach((f, i) => prev[f] = (prev[f] || 0) + pts[i]);
    await this.store.put("bonus:" + seasonOf().id, prev);
    try { await this.hub().fetch(new Request("https://hub/int/pxbonus", { method: "POST", body: JSON.stringify({ bonus: prev }) })); } catch (e) { }
    this.cfg.history = (this.cfg.history || []).concat([{ round: this.cfg.round, end: this.cfg.end, order, shares: sh }]).slice(-20);
    this.cfg.round++; this.cfg.end = nextSunday(); this.px = new Uint8Array(PX * PX); this.cfg.mine = {};
    await this.save(); this.broadcast("reset");
  }
  async fetch(req) {
    await this.ready; await this.roundCheck();
    const url = new URL(req.url), p = url.pathname, uid = req.headers.get("X-Uid"), admin = req.headers.get("X-Admin") === "1";
    const fac = req.headers.get("X-Fac"), fi = FACS.indexOf(fac) + 1;
    if (p.endsWith("/ws")) return this.accept(req, { uid }).res;
    const info = () => ({ cd: this.cfg.cd, next: Math.max(0, (this.last[uid] || 0) + this.cfg.cd * 1000 - Date.now()), end: this.cfg.end, round: this.cfg.round, shares: this.shares(), mine: (this.cfg.mine || {})[uid] || 0, history: (this.cfg.history || []).slice(-3) });
    if (req.method === "GET" && (p === "/pixel" || p === "/admin")) return J(200, { data: this.enc(), ...info() });
    const b = await req.json().catch(() => ({}));
    if (p === "/pixel") {
      if (!fi) return J(400, { error: "Сначала выберите факультет" });
      if (req.headers.get("X-Banned") === "1") return J(403, { error: "Вам временно нельзя ставить клетки" });
      const x = b.x | 0, y = b.y | 0; if (x < 0 || y < 0 || x >= PX || y >= PX) return J(400, { error: "Мимо полотна" });
      const left = (this.last[uid] || 0) + this.cfg.cd * 1000 - Date.now();
      if (left > 0 && !admin) return J(429, { error: "Ещё рано", next: left });
      if (this.px[y * PX + x] === fi) return J(400, { error: "Клетка уже вашего цвета" });
      this.px[y * PX + x] = fi; this.last[uid] = Date.now(); this.cfg.mine = this.cfg.mine || {}; this.cfg.mine[uid] = (this.cfg.mine[uid] || 0) + 1;
      await this.save(); this.broadcast([[x, y, fi]]);
      return J(200, { ok: true, ...info() });
    }
    if (p === "/admin") {
      if (!admin) return J(403, { error: "Только для владельца" });
      const cells = [];
      if (b.op === "paint") (b.cells || []).slice(0, 5000).forEach(([x, y, c]) => { if (x >= 0 && y >= 0 && x < PX && y < PX && c >= 0 && c <= 4) { this.px[y * PX + x] = c; cells.push([x, y, c]); } });
      else if (b.op === "rect") { const x0 = Math.max(0, Math.min(b.x0, b.x1)), x1 = Math.min(PX - 1, Math.max(b.x0, b.x1)), y0 = Math.max(0, Math.min(b.y0, b.y1)), y1 = Math.min(PX - 1, Math.max(b.y0, b.y1)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.px[y * PX + x] = b.c; cells.push([x, y, b.c]); } }
      else if (b.op === "clear") { this.px = new Uint8Array(PX * PX); await this.save(); this.broadcast("reset"); return J(200, { ok: true, ...info() }); }
      else if (b.op === "cooldown") { this.cfg.cd = Math.max(0, Math.min(86400, b.sec | 0)); }
      else if (b.op === "end") { if (b.ts) this.cfg.end = +b.ts; else { this.cfg.end = Date.now() - 1; await this.roundCheck(); return J(200, { ok: true, ...info() }); } }
      else if (b.op === "resetCooldowns") { this.last = {}; }
      await this.save(); if (cells.length) this.broadcast(cells.length > 3000 ? "reset" : cells);
      return J(200, { ok: true, ...info() });
    }
    return J(404, { error: "not found" });
  }
  webSocketMessage(ws, m) { if (m === "ping") send(ws, "pong"); }
  webSocketClose(ws) { try { ws.close(); } catch (e) { } }
}
function nextSunday() { const d = new Date(Date.now() + 3 * 3600e3); const add = (7 - d.getUTCDay()) % 7; d.setUTCDate(d.getUTCDate() + add); d.setUTCHours(20, 59, 0, 0); let t = d.getTime(); if (t < Date.now()) t += 7 * 864e5; return t; }

/* ================= GameRoom ================= */
// Сервер не знает правил каждой игры: он держит места, порядок ходов и пересылает их всем участникам.
// Каждый телефон проверяет ходы сам; итог засчитывается в рейтинг, только если все игроки сообщили одинаковый результат.
export class GameRoom extends Base {
  async load() { this.s = (await this.store.get("s")) || null; }
  async save() { await this.store.put("s", this.s); }
  async report(closed) {
    if (!this.s) return;
    const s = this.s, host = s.seats.find(x => x.host);
    const info = { game: s.game, open: s.open, max: s.max, n: s.seats.length, status: s.status, rated: s.rated, hostName: host ? host.name : "", hostFac: host ? host.fac : "", names: s.seats.map(x => x.name) };
    try { await this.hub().fetch(new Request("https://hub/int/room", { method: "POST", body: JSON.stringify({ code: s.code, info, closed }) })); } catch (e) { }
  }
  snap(uid) {
    const s = this.s;
    return { t: "room", room: { code: s.code, game: s.game, max: s.max, min: s.min, open: s.open, rated: s.rated, time: s.time, team: s.team, status: s.status, seed: s.seed, result: s.result || null, seats: s.seats.map(x => ({ uid: x.uid, name: x.name, fac: x.fac, elo: x.elo, ready: x.ready, host: !!x.host, off: !!x.off, bot: !!x.bot, left: !!x.left, admin: !!x.admin })), watchers: this.sockets().filter(w => this.att(w).watch).length } };
  }
  bc(m, except) { const str = JSON.stringify(m); this.sockets().forEach(ws => { if (ws !== except) send(ws, str); }); }
  bcRoom() { this.sockets().forEach(ws => send(ws, this.snap(this.att(ws).uid))); }
  seatOf(uid) { return this.s.seats.findIndex(x => x.uid === uid); }
  async fetch(req) {
    await this.ready;
    const url = new URL(req.url), p = url.pathname;
    if (p === "/int/init") {
      const b = await req.json();
      this.s = { code: b.code, game: b.game, max: b.max, min: b.min, open: b.open, rated: b.rated, time: b.time, team: b.team, reserved: b.reserved || null, hostUid: b.host, seats: [], status: "lobby", seed: 0, acts: [], created: Date.now(), reports: {} };
      await this.save(); await this.state.storage.setAlarm(Date.now() + 120e3);
      return J(200, { ok: true });
    }
    if (p === "/int/close") { this.bc({ t: "closed", m: "Комнату закрыл администратор" }); this.sockets().forEach(ws => { try { ws.close(4000, "closed"); } catch (e) { } }); this.s = null; try { await this.store.deleteAlarm(); } catch (e) { } await this.store.deleteAll(); return J(200, { ok: true }); }
    if (p !== "/ws") return J(404, { error: "not found" });
    if (!this.s) return J(404, { error: "Комната не найдена или уже закрыта" });
    const uid = req.headers.get("X-Uid"), admin = req.headers.get("X-Admin") === "1", name = decodeURIComponent(req.headers.get("X-Name") || "Игрок"), fac = req.headers.get("X-Fac") || "";
    let elo = 1000; try { elo = JSON.parse(req.headers.get("X-Elo") || "{}")[this.s.game] || 1000; } catch (e) { }
    const s = this.s; let i = this.seatOf(uid), watch = false;
    if (i < 0) {
      if (admin && url.searchParams.get("watch") === "1") watch = true;
      else if (s.status === "lobby" && s.seats.length < s.max && (!s.reserved || s.reserved.includes(uid))) {
        const host = !s.seats.some(x => x.host) && (!s.reserved || uid === s.hostUid || s.seats.length === 0);
        s.seats.push({ uid, name, fac, elo, ready: !!s.reserved || host, host });
        i = s.seats.length - 1;
      } else if (admin) watch = true;
      else return J(409, { error: s.status !== "lobby" ? "Партия уже идёт" : s.seats.length >= s.max ? "Мест нет" : "Это закрытая рейтинговая партия" });
    } else { s.seats[i].off = false; delete s.seats[i].offAt; }
    const { res } = this.accept(req, { uid, admin, watch, name });
    await this.save(); await this.report();
    // остальным — обновлённый состав; новичок получит всё состояние, когда пришлёт «hello»
    this.sockets().forEach(w => { if (this.att(w).uid !== uid) send(w, this.snap(this.att(w).uid)); });
    return res;
  }
  async autoStart() {
    const s = this.s; if (!s || s.status !== "lobby" || !s.reserved) return;
    if (s.seats.length === s.reserved.length && s.seats.every(x => !x.off)) await this.start();
  }
  async start() {
    const s = this.s; s.status = "play"; s.seed = 1 + rnd(2 ** 31 - 2); s.acts = []; s.reports = {}; s.result = null; s.n = 0;
    s.seats.forEach(x => { x.left = false; });
    await this.save(); await this.report();
    this.bc({ t: "start", seed: s.seed }); this.bcRoom();
  }
  async webSocketMessage(ws, raw) {
    await this.ready; if (!this.s) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const a = this.att(ws), s = this.s, i = this.seatOf(a.uid), me = s.seats[i], isHost = me && me.host;
    const err = t => send(ws, { t: "err", m: t });
    switch (m.t) {
      case "ping": send(ws, { t: "pong" }); return;
      case "hello":
        send(ws, this.snap(a.uid));
        if (s.status === "play") send(ws, { t: "replay", acts: s.acts, seed: s.seed });
        await this.autoStart(); return;
      case "ready": if (me && s.status === "lobby") { me.ready = !!m.v; await this.save(); this.bcRoom(); } return;
      case "start":
        if (s.status !== "lobby") return;
        if (!isHost && !a.admin) return err("Начать может только хозяин комнаты");
        if (s.seats.length < s.min) return err("Не хватает игроков");
        if (!s.seats.every(x => x.ready)) return err("Не все готовы");
        await this.start(); return;
      case "addbot":
        if ((isHost || a.admin) && s.status === "lobby" && s.seats.length < s.max) { s.seats.push({ uid: "bot" + rnd(1e9), name: "Бот " + "АБВГДЕЖ"[s.seats.length], fac: "", elo: 1000, ready: true, bot: true }); await this.save(); await this.report(); this.bcRoom(); }
        return;
      case "kick": {
        if (!(isHost || a.admin)) return;
        const k = s.seats.findIndex(x => x.uid === m.uid); if (k < 0 || s.seats[k].host && !a.admin) return;
        if (s.status === "play") { s.seats[k].left = true; await this.save(); this.bc({ t: "left", s: k }); }
        else s.seats.splice(k, 1);
        this.sockets().forEach(w => { if (this.att(w).uid === m.uid) { send(w, { t: "kicked" }); try { w.close(4001, "kicked"); } catch (e) { } } });
        await this.save(); await this.report(); this.bcRoom(); return;
      }
      case "team": // в футболе: поменяться местами (места чередуются: синие/красные)
        if (s.status === "lobby" && me && m.to >= 0 && m.to < s.seats.length) { const t = s.seats[m.to]; s.seats[m.to] = me; s.seats[i] = t; await this.save(); this.bcRoom(); }
        return;
      case "act": {
        if (s.status !== "play") return;
        let seat = i;
        if (a.admin && m.as != null) seat = m.as | 0; // владелец может ходить за любого игрока
        else if (i < 0) return;
        if (m.bot != null) { const b = s.seats[m.bot]; if (!b || !(b.bot || b.left) || !isHost) return; seat = m.bot; } // хозяин ходит за ботов и вышедших
        const e = { s: seat, a: m.a, n: s.acts.length };
        if (s.acts.length < 20000) s.acts.push(e);
        this.bc({ t: "act", ...e, adm: a.admin && m.as != null ? 1 : 0 });
        if (s.acts.length % 20 === 0) await this.save();
        return;
      }
      case "in": // ввод игрока в играх реального времени → только хозяину партии (место 0)
        if (s.status !== "play" || i < 0) return;
        this.sockets().forEach(w => { const x = this.att(w); if (s.seats[0] && x.uid === s.seats[0].uid) send(w, { t: "in", s: i, d: m.d }); });
        return;
      case "state": // состояние игры от хозяина партии → всем остальным
        if (s.status !== "play" || i !== 0) return;
        this.bc({ t: "state", d: m.d }, ws); return;
      case "chat": if (me || a.admin) this.bc({ t: "chat", name: a.admin && !me ? "Администратор" : me.name, i: m.i | 0 }); return;
      case "result": {
        if (s.status !== "play" || (i < 0 && !a.admin)) return;
        if (a.admin) { await this.finish(m.ranks, "admin"); return; }
        s.reports[a.uid] = JSON.stringify(m.ranks);
        const humans = s.seats.filter(x => !x.bot && !x.left && !x.off);
        const vals = humans.map(x => s.reports[x.uid]).filter(Boolean);
        if (vals.length >= humans.length) {
          if (vals.every(v => v === vals[0])) await this.finish(JSON.parse(vals[0]), "ok");
          else await this.finish(null, "desync");
        }
        await this.save(); return;
      }
      case "leave": await this.leave(i, ws); return;
      case "rematch":
        if (s.status === "end" && me) { s.status = "lobby"; s.seats = s.seats.filter(x => !x.left); s.seats.forEach(x => x.ready = !!x.bot || !!x.host); s.reserved = null; s.rated = false; s.acts = []; await this.save(); await this.report(); this.bcRoom(); }
        return;
      case "sit": // владелец садится за стол, даже если мест нет
        if (a.admin && s.status === "lobby" && i < 0) { s.seats.push({ uid: a.uid, name: a.name || "Администратор", fac: "", elo: 1000, ready: true, admin: true }); s.max = Math.max(s.max, s.seats.length); this.setAtt(ws, { ...a, watch: false }); await this.save(); await this.report(); this.bcRoom(); }
        return;
    }
  }
  async finish(ranks, how) {
    const s = this.s; if (s.status !== "play") return;
    s.status = "end"; let rated = null;
    if (ranks && how === "ok" && s.rated && s.seats.every(x => !x.bot)) {
      try { rated = await (await this.hub().fetch(new Request("https://hub/int/rated", { method: "POST", body: JSON.stringify({ game: s.game, seats: s.seats.map(x => x.uid), ranks }) }))).json(); } catch (e) { }
    }
    s.result = { ranks, how, rated };
    await this.save(); await this.report();
    this.bc({ t: "end", ranks, how, rated }); this.bcRoom();
  }
  async leave(i, ws) {
    const s = this.s; if (i < 0) { try { ws.close(1000, "bye"); } catch (e) { } return; }
    if (s.status === "lobby") {
      const was = s.seats[i].host; s.seats.splice(i, 1);
      if (was && s.seats.length) { const h = s.seats.find(x => !x.bot); if (h) { h.host = true; h.ready = true; } }
      if (s.reserved) s.reserved = s.reserved.filter(u => s.seats.some(x => x.uid === u));
    } else if (s.status === "play") {
      s.seats[i].left = true; this.bc({ t: "left", s: i });
      const alive = s.seats.map((x, k) => k).filter(k => !s.seats[k].left && !s.seats[k].bot);
      if (alive.length <= 1) { const ranks = s.seats.map((x, k) => alive.includes(k) ? 0 : 1); await this.finish(ranks, "ok"); }
    }
    try { ws.close(1000, "bye"); } catch (e) { }
    await this.save(); await this.report(); this.bcRoom();
  }
  async webSocketClose(ws) {
    await this.ready; if (!this.s) return;
    const a = this.att(ws), i = this.seatOf(a.uid);
    if (i >= 0 && !this.sockets().some(w => w !== ws && this.att(w).uid === a.uid)) { this.s.seats[i].off = true; this.s.seats[i].offAt = Date.now(); await this.save(); this.bcRoom(); }
    await this.state.storage.setAlarm(Date.now() + 15e3);
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }
  async alarm() {
    await this.ready; const s = this.s; if (!s) return;
    const now = Date.now();
    // отключившиеся: в лобби место освобождается через 30 с, в партии через 60 с — техническое поражение
    for (let i = s.seats.length - 1; i >= 0; i--) {
      const x = s.seats[i]; if (!x.off || x.left) continue;
      if (s.status === "lobby" && now - x.offAt > 30e3) { const w = this.sockets()[0]; await this.leave(i, { close() { } }); }
      else if (s.status === "play" && now - x.offAt > 60e3) await this.leave(i, { close() { } });
    }
    const live = this.sockets().length;
    if (!live && (!s.seats.length || now - s.created > 10 * 60e3)) { s.emptyAt = s.emptyAt || now; }
    else s.emptyAt = 0;
    if (s.emptyAt && now - s.emptyAt > 10 * 60e3 || (!live && s.status === "end")) { await this.report(true); this.s = null; try { await this.store.deleteAlarm(); } catch (e) { } await this.store.deleteAll(); return; }
    if (!live && !s.seats.length && now - s.created > 120e3) { await this.report(true); this.s = null; try { await this.store.deleteAlarm(); } catch (e) { } await this.store.deleteAll(); return; }
    await this.save(); await this.report(); await this.state.storage.setAlarm(now + 20e3);
  }
}
