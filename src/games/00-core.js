/* ===== Раздел «Игры»: ядро ===== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (a) for (const k in a) {
    const v = a[k];
    if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let RAND = Math.random; // в онлайн-партии заменяется общим для всех случайным генератором
const rnd = n => Math.floor(RAND() * n), pick = a => a[rnd(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, a, b, c) => { const m = n % 10, k = n % 100; return n + ' ' + (m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 12 || k > 14) ? b : c); };

const MEM = {};
const LS = {
  get(k, d) { if (k in MEM) return MEM[k]; try { const v = localStorage.getItem('bgames_' + k); if (v != null) return MEM[k] = JSON.parse(v); } catch (e) { } return d; },
  set(k, v) { MEM[k] = v; try { localStorage.setItem('bgames_' + k, JSON.stringify(v)); } catch (e) { } }
};

const FACS = [
  { id: 'if', short: 'ИФ', name: 'Инженерный факультет', color: '#f08a24' },
  { id: 'lf', short: 'ЛФ', name: 'Лингвистический факультет', color: '#e5486d' },
  { id: 'fpp', short: 'ФПП', name: 'Факультет педагогики и психологии', color: '#7a5cf6' },
  { id: 'fep', short: 'ФЭП', name: 'Факультет экономики и права', color: '#1fa971' }
];
const fac = id => FACS.find(f => f.id === id) || { id: '', short: '—', name: 'Без факультета', color: '#98a0bd' };
const facBadge = id => h('span', { class: 'gfb', style: { background: fac(id).color } }, fac(id).short);
const CATS = { arcade: 'Аркады', puzzle: 'Головоломки', words: 'Слова и знания', strategy: 'Стратегия', cards: 'Карточные', board: 'Настольные', party: 'Словесные и компанейские', realtime: 'В реальном времени' };
const SOLO_CATS = ['arcade', 'puzzle', 'words', 'strategy'];
// Игры, в которые уже можно играть онлайн: [мин, макс] мест (то же самое в games-server.js)
const ONLINE = { reversi: [2, 2], connect4: [2, 2], gomoku: [2, 2], checkers: [2, 2], chess: [2, 2], battleship: [2, 2], nardy: [2, 2], billiards: [2, 2], durak: [2, 2], uno: [2, 4], airhockey: [2, 2], haxball: [2, 6], bomber: [2, 4], tanks: [2, 4] };

const GAMES = [];
function game(def) { GAMES.push(def); }
const gameById = id => GAMES.find(g => g.id === id);
const isMP = g => !SOLO_CATS.includes(g.cat);
function fmtScore(g, v) {
  if (v == null) return '—';
  if (isMP(g)) return Math.round(v) + '';
  if (g.unit === 'time') { const s = Math.round(v); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  return Math.round(v).toLocaleString('ru-RU');
}
const better = (g, a, b) => (g.unit === 'time' && !isMP(g)) ? a < b : a > b;

/* ===== Связь с сервером ===== */
const NET = {
  native: false, base: '', dev: null,
  get ok() { return !NET.native || !!NET.base; },
  async token(force) { if (NET.dev) return 'dev'; try { return window.GroupsApi ? await window.GroupsApi.idToken(force) : null; } catch (e) { return null; } },
  headers(t, json) { const hd = {}; if (NET.dev) hd['X-Dev-User'] = NET.dev; else if (t) hd.Authorization = 'Bearer ' + t; if (json) hd['Content-Type'] = 'application/json'; return hd; },
  async req(path, body, opt = {}) {
    if (!NET.ok) throw Object.assign(new Error('Сервер игр не настроен'), { status: 0 });
    let t = await NET.token(false); if (!t) throw Object.assign(new Error('Нужен вход через Google'), { status: 401 });
    for (let k = 0; k < 2; k++) {
      let r;
      try { r = await fetch(NET.base + '/api/g' + path, { method: opt.method || (body ? 'POST' : 'GET'), headers: NET.headers(t, !!body), body: body ? JSON.stringify(body) : undefined }); }
      catch (e) { throw Object.assign(new Error('Нет связи с сервером'), { status: 0, offline: true }); }
      let j = {}; try { j = await r.json(); } catch (e) { }
      if (r.status === 401 && k === 0 && !NET.dev) { t = await NET.token(true); continue; }
      if (!r.ok) throw Object.assign(new Error(j.error || 'Ошибка сервера ' + r.status), { status: r.status, data: j });
      return j;
    }
  },
  async ws(path) {
    const t = await NET.token(false);
    const base = NET.base || location.origin;
    const q = NET.dev ? 'dev=' + encodeURIComponent(NET.dev) : 'token=' + encodeURIComponent(t || '');
    return new WebSocket(base.replace(/^http/, 'ws') + '/api/g' + path + (path.includes('?') ? '&' : '?') + q);
  }
};

/* ===== Состояние ===== */
const G = { uid: null, me: null, season: null, stats: {}, elo: {}, admin: false, server: false, league: null, popular: null, user: null };
const localStats = () => LS.get('stats', {});
function statOf(id) { const s = localStats()[id] || {}; return { best: s.best ?? null, plays: s.plays || 0, elo: s.elo || 1000, w: s.w || 0, l: s.l || 0, d: s.d || 0 }; }
function setStat(id, s) { const all = localStats(); all[id] = s; LS.set('stats', all); }
// лучший результат: серверный (если есть) или сохранённый на телефоне
function bestOf(g) { const sv = G.stats[g.id], lc = statOf(g.id).best; const b = sv && sv.b != null ? sv.b : null; if (b == null) return lc; if (lc == null) return b; return better(g, lc, b) ? lc : b; }
async function loadMe() {
  const r = await NET.req('/me');
  G.uid = r.uid; G.me = r.profile; G.season = r.season; G.stats = r.stats || {}; G.elo = r.elo || {}; G.admin = r.admin; G.server = true;
  return r;
}
async function loadLeague(force) { if (!G.league || force || Date.now() - G.league._t > 60e3) { G.league = await NET.req('/league'); G.league._t = Date.now(); tileText(); } return G.league; }
async function loadPopular() { if (!G.popular || Date.now() - G.popular._t > 120e3) { G.popular = await NET.req('/popular'); G.popular._t = Date.now(); } return G.popular; }
function tileText() {
  try {
    const L = G.league, i = L && G.me ? L.facs.findIndex(f => f.id === G.me.fac) : -1;
    localStorage.setItem('games_tile', i >= 0 ? fac(G.me.fac).short + ' — ' + (i + 1) + '-е место в лиге' : 'Лига, рекорды, пиксель-батл');
  } catch (e) { }
}
// результаты, которые не ушли из-за отсутствия интернета, отправляются позже
async function flushQueue() {
  const q = LS.get('queue', []); if (!q.length || !G.server) return;
  const rest = [];
  for (const x of q) { try { const r = await NET.req('/submit', x); if (r.ok && r.best != null) G.stats[x.game] = { ...(G.stats[x.game] || {}), b: r.best }; } catch (e) { if (e.offline || e.status >= 500) rest.push(x); } }
  LS.set('queue', rest);
}

/* ===== Интерфейс ===== */
function toast(t, ms = 2600) { const e = h('div', { class: 'gtoast', role: 'status' }, t); document.body.append(e); setTimeout(() => e.remove(), ms); }
// «Назад» на Android и в браузере закрывает игру или нижний лист, а не всё приложение
const BACK = []; let PUSHED = false, IGNORE = 0;
function pushBack(fn) {
  BACK.push(fn);
  if (!PUSHED) { PUSHED = true; try { history.pushState({ bgx: 1 }, ''); } catch (e) { } }
  return () => { const i = BACK.indexOf(fn); if (i >= 0) BACK.splice(i, 1); unpush(); };
}
// одна запись в истории на все открытые окна; снимаем её, только когда закрылось последнее
function unpush() { setTimeout(() => { if (!BACK.length && PUSHED) { PUSHED = false; IGNORE++; try { history.back(); } catch (e) { IGNORE--; } } }, 30); }
addEventListener('popstate', () => {
  if (IGNORE) { IGNORE--; return; }
  if (!PUSHED) return;
  PUSHED = false; const fn = BACK.pop(); if (fn) fn();
  if (BACK.length) { PUSHED = true; try { history.pushState({ bgx: 1 }, ''); } catch (e) { } }
});
function sheet(build, onClose) {
  const s = h('div', { class: 'sheet on bgx' }); const box = h('div'); s.append(box);
  let closed = false, release = null;
  const close = (fromBack) => { if (closed) return; closed = true; s.remove(); if (!fromBack && release) release(); onClose && onClose(); };
  release = pushBack(() => close(true));
  s.addEventListener('click', e => { if (e.target === s) close(); });
  box.append(h('div', { class: 'grab' })); build(box, close);
  document.body.append(s); return close;
}
function icon(g, size = 46) { return h('div', { class: 'ico', style: { background: `linear-gradient(135deg,${g.c1},${g.c2})`, width: size + 'px', height: size + 'px', fontSize: size * .52 + 'px' } }, g.icon); }
const loading = t => h('div', { class: 'none' }, t || 'Загружаем…');
const errBox = (e, retry) => h('div', { class: 'card' }, h('b', null, e.offline ? 'Нет связи с сервером' : 'Не получилось загрузить'), h('p', { class: 'hint' }, e.offline ? 'Одиночные игры работают и без интернета — результаты отправятся позже.' : e.message), retry ? h('button', { class: 'nb', style: { width: '100%' }, onclick: retry }, 'Повторить') : null);

let ROOT = null, OPTS = {}, VIEW = 'hub';
function show(v, arg) {
  if (!ROOT) return;
  VIEW = v; ROOT.innerHTML = '';
  const fn = { hub: renderHub, lb: renderLB, league: renderLeague, pixel: renderPixel, me: renderMe, setup: renderSetup, signin: renderSignin }[v] || renderHub;
  try { scrollTo(0, 0); } catch (e) { }
  fn(arg);
}
function gamesHead(cur) {
  const w = h('div');
  if (OPTS.back) w.append(h('button', { class: 'back', type: 'button', onclick: () => OPTS.back() }, '‹ Ещё'));
  w.append(h('div', { class: 'gtop' }, h('h1', null, 'Игры'),
    G.me ? h('button', { class: 'gme', onclick: () => show('me') }, h('i', { style: { background: fac(G.me.fac).color } }, (G.me.name || '?')[0].toUpperCase()), h('span', null, G.me.name)) : null));
  const seg = h('div', { class: 'seg gseg' });
  [['hub', 'Каталог'], ['lb', 'Рейтинги'], ['league', 'Лига'], ['pixel', 'Пиксели']].forEach(([k, t]) => seg.append(h('button', { class: cur === k ? 'on' : '', type: 'button', onclick: () => show(k) }, t)));
  w.append(seg);
  if (!G.server) w.append(h('div', { class: 'gwarn' }, NET.ok ? '⚠️ Нет связи с сервером. Можно играть в одиночные игры, рекорды отправятся позже.' : '⚠️ Сервер игр не настроен: рейтинги и онлайн-игры недоступны.'));
  return w;
}

/* ----- Вход и настройка профиля: имя как в группе + факультет ----- */
function renderSignin() {
  ROOT.append(OPTS.back ? h('button', { class: 'back', onclick: () => OPTS.back() }, '‹ Ещё') : '', h('div', { style: { textAlign: 'center', margin: '24px 0 18px' } }, h('div', { style: { fontSize: '54px' } }, '🎮'), h('h1', null, 'Игры БарГУ'), h('p', { class: 'sub' }, 'Играйте, ставьте рекорды и приносите очки своему факультету')));
  const msg = h('div', { class: 'msg' });
  const b = h('button', { class: 'go', onclick: async () => { b.disabled = true; msg.textContent = 'Входим…'; try { await window.GroupsApi.signIn(); mount(ROOT, OPTS); } catch (e) { msg.textContent = 'Не удалось войти. ' + (e && e.message || ''); b.disabled = false; } } }, 'Войти через Google');
  ROOT.append(h('div', { class: 'card' }, h('b', null, 'Нужен вход через Google'), h('p', { class: 'hint' }, 'Тот же аккаунт, что и для раздела «Группа». Другие игроки видят только ваше имя и факультет, почту — никто.'), b, msg),
    h('button', { class: 'nb', style: { width: '100%', marginTop: '8px' }, onclick: () => { G.server = false; show('hub'); } }, 'Играть без входа (без рейтингов)'));
}
async function groupName() {
  try { const st = await window.GroupsApi.status(); if (st && st.state === 'member') return { name: st.name, gid: st.gid }; } catch (e) { }
  try { const n = JSON.parse(localStorage.getItem('grp_name') || '""'); if (n) return { name: n }; } catch (e) { }
  return { name: '' };
}
async function renderSetup() {
  const gn = await groupName();
  const nm = (G.me && G.me.name) || gn.name || '';
  let fid = G.me && !G.me.needFac ? G.me.fac : '';
  ROOT.innerHTML = '';
  ROOT.append(OPTS.back ? h('button', { class: 'back', onclick: () => OPTS.back() }, '‹ Ещё') : '', h('h1', null, G.me && G.me.needFac ? 'Новый сезон!' : 'Добро пожаловать'), h('p', { class: 'sub' }, G.me && G.me.needFac ? `Начался сезон «${G.season.name}». Выберите факультет, за который будете играть.` : 'Два шага — и можно играть'));
  const inp = h('input', { id: 'gName', maxlength: 40, value: nm, placeholder: 'Фамилия Имя', autocomplete: 'name' });
  const list = h('div', { style: { display: 'grid', gap: '8px' } });
  const msg = h('div', { class: 'msg' });
  const go = h('button', { class: 'go', type: 'button' }, 'Начать играть');
  const draw = () => { list.innerHTML = ''; FACS.forEach(f => list.append(h('button', { class: 'gmode', type: 'button', style: fid === f.id ? { boxShadow: `inset 0 0 0 2px ${f.color}` } : null, onclick: () => { fid = f.id; draw(); } }, h('span', { class: 'dotf', style: { background: f.color, width: '16px', height: '16px' } }), h('div', null, h('b', null, f.short), h('small', null, f.name))))); go.disabled = !fid; };
  go.onclick = async () => {
    const n = inp.value.trim().replace(/\s+/g, ' '); if (n.length < 3) { msg.textContent = 'Напишите фамилию и имя — так, как вас видят в группе.'; return; }
    go.disabled = true; msg.textContent = 'Сохраняем…';
    try {
      const r = await NET.req('/profile', { name: n, fac: fid }); G.me = r.profile;
      if (n !== gn.name) await syncGroupName(n, gn.gid);
      toast('Готово! Вы играете за ' + fac(fid).short); show('hub'); startInvites();
    } catch (e) { msg.textContent = e.message; go.disabled = false; }
  };
  draw();
  ROOT.append(h('div', { class: 'card' }, h('label', { for: 'gName' }, 'Имя'), inp, h('p', { class: 'hint' }, gn.gid ? 'Это ваше имя из раздела «Группа». Если поменяете его здесь, оно поменяется и в группе.' : 'Это имя увидят другие игроки. Оно же будет использоваться в разделе «Группа».')),
    h('div', { class: 'card' }, h('label', null, 'Факультет'), list, h('p', { class: 'hint' }, `Выбирается один раз на сезон «${G.season ? G.season.name : ''}». Сменить можно только в новом сезоне.`)), go, msg);
}
async function syncGroupName(n, gid) {
  try { localStorage.setItem('grp_name', JSON.stringify(n)); } catch (e) { }
  if (gid && window.GroupsApi && window.GroupsApi.setMyName) { try { await window.GroupsApi.setMyName(gid, n); } catch (e) { } }
}

/* ----- Каталог ----- */
let HUBF = 'all';
function tileOf(g, extra) {
  const mp = isMP(g), b = bestOf(g), e = G.elo[g.id];
  return h('button', { class: 'gt', type: 'button', onclick: () => openGame(g) }, icon(g),
    mp ? h('span', { class: 'mp' }, ONLINE[g.id] ? '🌐' : '👥') : null,
    h('div', null, h('b', null, g.name), h('small', null, g.like || '')),
    h('span', { class: 'rec' }, extra || (mp ? (e ? 'Рейтинг ' + e : 'Не играли') : (b != null ? 'Рекорд ' + fmtScore(g, b) : 'Не играли'))));
}
function renderHub() {
  ROOT.append(gamesHead('hub'));
  const inv = h('div'); ROOT.append(inv); drawInvites(inv);
  const lgBox = h('div'); ROOT.append(lgBox);
  if (G.server) {
    lgBox.append(h('div', { class: 'gleague', style: { minHeight: '170px' } }, h('small', null, 'Лига факультетов'), h('b', { class: 't' }, 'Загружаем…')));
    loadLeague().then(L => { if (VIEW !== 'hub') return; lgBox.innerHTML = ''; lgBox.append(leagueCard(L)); }).catch(e => { lgBox.innerHTML = ''; });
    const pc = h('canvas', { width: 128, height: 128 }), ps = h('small', null, 'Загружаем…');
    ROOT.append(h('button', { class: 'gpx', type: 'button', onclick: () => show('pixel') }, pc, h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, 'Пиксель-батл'), ps)));
    pxThumb(pc, ps);
  }
  const fl = h('div', { class: 'fl' });
  [['all', 'Все'], ['pop', '🔥 Популярные'], ['solo', 'Одиночные'], ['mp', 'С друзьями'], ...Object.entries(CATS)].forEach(([k, t]) => fl.append(h('button', { class: HUBF === k ? 'on' : '', type: 'button', onclick: () => { HUBF = k; show('hub'); } }, t)));
  ROOT.append(h('h2', null, 'Во что сыграем?'), fl);
  const body = h('div'); ROOT.append(body);
  const fmtN = n => plural(n, 'партия', 'партии', 'партий');
  const popList = () => { const pl = (G.popular && G.popular.plays) || {}; return GAMES.map(g => ({ g, n: pl[g.id] || 0 })).sort((a, b) => b.n - a.n); };
  const drawBody = () => {
    body.innerHTML = '';
    if (HUBF === 'pop') {
      if (!G.server) { body.append(h('div', { class: 'none' }, 'Популярное видно, когда есть связь с сервером')); return; }
      const P = popList(), top = Math.max(1, P[0].n), lb = h('div', { class: 'glb' });
      P.forEach(({ g, n }, i) => lb.append(h('button', { class: 'glbr pop', type: 'button', onclick: () => openGame(g) }, h('span', { class: 'n' }, i + 1), h('span', { class: 'nm' }, icon(g, 34), h('span', null, h('b', null, g.name), h('small', null, h('i', { class: 'gpbar', style: { width: (n / top * 100) + '%' } })))), h('span', { class: 'sc', style: { fontSize: '13px' } }, fmtN(n)))));
      body.append(h('p', { class: 'sub' }, 'Сколько раз сыграли за последние 7 дней — все студенты вместе'), lb);
      return;
    }
    if (HUBF === 'all' && G.popular) { const P = popList().filter(x => x.n > 0).slice(0, 4); if (P.length >= 2) { const grid = h('div', { class: 'grid' }); P.forEach(({ g, n }) => grid.append(tileOf(g, '🔥 ' + fmtN(n) + ' за неделю'))); body.append(h('h2', null, '🔥 Популярное', h('button', { type: 'button', onclick: () => { HUBF = 'pop'; show('hub'); } }, 'весь список')), grid); } }
    for (const [cat, title] of Object.entries(CATS)) {
      if (HUBF === 'solo' && !SOLO_CATS.includes(cat) || HUBF === 'mp' && SOLO_CATS.includes(cat) || !['all', 'solo', 'mp', cat].includes(HUBF)) continue;
      const gs = GAMES.filter(g => g.cat === cat); if (!gs.length) continue;
      const grid = h('div', { class: 'grid' }); gs.forEach(g => grid.append(tileOf(g)));
      body.append(h('h2', null, title, h('span', { class: 'chip' }, gs.length)), grid);
    }
  };
  drawBody();
  if (G.server) loadPopular().then(() => { if (VIEW === 'hub') drawBody(); }).catch(() => { });
}
function leagueCard(L) {
  const max = Math.max(1, L.facs[0].total);
  const lg = h('button', { class: 'gleague', type: 'button', onclick: () => show('league') }, h('small', null, 'Лига факультетов · ' + L.season.name), h('b', { class: 't' }, L.facs[0].total ? fac(L.facs[0].id).short + ' лидирует' : 'Сезон только начался'));
  L.facs.forEach((f, i) => lg.append(h('div', { class: 'lrow' }, h('em', null, i + 1), h('span', { class: 's' }, h('i', { style: { background: fac(f.id).color } }), fac(f.id).short), h('span', { class: 'bar' }, h('i', { style: { width: (f.total / max * 100) + '%' } })), h('span', { class: 'p' }, f.total.toLocaleString('ru-RU')))));
  const days = Math.max(0, Math.ceil((L.season.end - Date.now()) / 864e5));
  lg.append(h('div', { class: 'ft' }, h('span', null, L.me ? `Ваш вклад: ${L.me.pts} из 800` : 'Сыграйте, чтобы принести очки'), h('span', null, 'до конца ' + days + ' дн.')));
  return lg;
}

/* ----- Рейтинги ----- */
let LBG = null, LBF = 'all';
async function renderLB() {
  ROOT.append(gamesHead('lb'));
  if (!G.server) { ROOT.append(h('div', { class: 'none' }, 'Рейтинги видны, когда есть связь с сервером')); return; }
  if (!LBG) LBG = 'snake';
  const g = gameById(LBG);
  const sel = h('select', { id: 'lbgame', onchange: e => { LBG = e.target.value; show('lb'); } });
  Object.entries(CATS).forEach(([c, t]) => { if (c === 'party') return; const og = h('optgroup', { label: t }); GAMES.filter(x => x.cat === c).forEach(x => og.append(h('option', { value: x.id, selected: x.id === LBG }, x.icon + ' ' + x.name))); sel.append(og); });
  const how = g.noLeague ? 'Таблица для интереса, в лигу не идёт.' : isMP(g) ? 'Рейтинг Эло только за онлайн-партии в «Быстрой игре».' : g.unit === 'time' ? 'Лучшее время, чем быстрее — тем выше.' : 'Лучший результат каждого игрока за сезон.';
  ROOT.append(h('p', { class: 'sub' }, how), sel);
  const seg = h('div', { class: 'seg', style: { margin: '10px 0', background: 'var(--card)', boxShadow: 'var(--sh)' } });
  [['all', 'Все'], ['fac', 'Мой факультет']].forEach(([k, t]) => seg.append(h('button', { class: LBF === k ? 'on' : '', type: 'button', onclick: () => { LBF = k; show('lb'); } }, t)));
  ROOT.append(seg);
  const lb = h('div', { class: 'glb' }, loading()); ROOT.append(lb, h('button', { class: 'go', type: 'button', onclick: () => openGame(g) }, 'Играть: ' + g.name));
  if (isMP(g) && statOf(g.id).plays) ROOT.append(h('p', { class: 'hint' }, `Ваш тренировочный рейтинг против бота: ${statOf(g.id).elo}. Он не попадает в таблицу.`));
  try {
    const r = await NET.req('/board?game=' + g.id + (LBF === 'fac' && G.me ? '&fac=' + G.me.fac : ''));
    lb.innerHTML = '';
    const row = (p, i) => h('div', { class: 'glbr' + (p.me ? ' mine' : '') + (i < 3 ? ' top' + (i + 1) : '') }, h('span', { class: 'n' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : p.place),
      h('span', { class: 'nm' }, h('span', { class: 'dotf', style: { background: fac(p.fac).color } }), h('span', null, p.name + (p.me ? ' (вы)' : ''))), h('span', { class: 'sc' }, fmtScore(g, p.score)));
    r.rows.forEach((p, i) => lb.append(row(p, i)));
    if (r.mine) lb.append(row(r.mine, 99));
    if (!r.rows.length) lb.append(h('div', { class: 'none' }, 'Пока никто не играл — будьте первым!'));
  } catch (e) { lb.innerHTML = ''; lb.append(errBox(e, () => show('lb'))); }
}

/* ----- Лига ----- */
async function renderLeague() {
  ROOT.append(gamesHead('league'));
  if (!G.server) { ROOT.append(h('div', { class: 'none' }, 'Лига видна, когда есть связь с сервером')); return; }
  const box = h('div', null, loading()); ROOT.append(box);
  let L; try { L = await loadLeague(true); } catch (e) { box.innerHTML = ''; box.append(errBox(e, () => show('league'))); return; }
  box.innerHTML = '';
  box.append(h('p', { class: 'sub' }, L.season.name + ' · осталось ' + Math.max(0, Math.ceil((L.season.end - Date.now()) / 864e5)) + ' дн.'));
  L.facs.forEach((f, i) => {
    const c = h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('b', { style: { fontSize: '22px', fontFamily: 'var(--f-num)', width: '26px' } }, i + 1), facBadge(f.id), h('b', { style: { flex: 1 } }, ''), h('b', { class: 'tn', style: { fontSize: '20px', fontFamily: 'var(--f-num)' } }, f.total.toLocaleString('ru-RU'))),
      h('div', { class: 'hint' }, fac(f.id).name + ` · игры ${f.games.toLocaleString('ru-RU')} + пиксель-батл ${f.pixel}`),
      f.top.length ? h('div', { class: 'hint' }, 'Лучшие: ' + f.top.map(p => p.name + ' ' + p.pts).join(', ')) : null);
    if (G.me && f.id === G.me.fac) c.style.boxShadow = `var(--sh), inset 0 0 0 2px ${fac(f.id).color}`;
    box.append(c);
  });
  const you = h('div', { class: 'gnote' }, h('h3', null, 'Ваш вклад'));
  if (!L.me) you.append(h('p', null, 'Вы ещё не попали в лигу. Игра начинает давать очки, когда в неё сыграли хотя бы 10 человек.'));
  else {
    you.append(h('p', null, `${L.me.pts} из 800 очков — ${L.me.rank}-е место на факультете. ` + (L.me.rank <= 20 ? 'Вы в двадцатке, ваши очки идут в лигу.' : `В лигу идут 20 лучших, до двадцатки не хватает ${L.me.need} очк.`)));
    const lb = h('div', { class: 'glb', style: { boxShadow: 'none', background: 'var(--bg)' } });
    L.me.list.forEach((x, i) => { const g = gameById(x.g); if (g) lb.append(h('div', { class: 'glbr', style: { opacity: i < 8 ? 1 : .45 } }, h('span', { class: 'n' }, g.icon), h('span', { class: 'nm' }, h('span', null, g.name + (i < 8 ? '' : ' — не в зачёте'))), h('span', { class: 'sc' }, x.pts))); });
    you.append(h('p', { class: 'hint' }, 'Зачётные игры (засчитываются 8 лучших):'), lb);
  }
  box.append(you, h('div', { class: 'gnote' }, h('h3', null, 'Как считаются очки'),
    h('ul', null,
      h('li', null, 'В каждой игре важно место среди всех игроков: лучше всех — 100, лучше половины — 50, последний — 0. Так все игры весят одинаково.'),
      h('li', null, 'Каждому засчитываются 8 лучших игр — максимум 800 очков.'),
      h('li', null, 'Игра попадает в лигу, когда в неё сыграли хотя бы 10 человек за сезон.'),
      h('li', null, 'Факультету засчитываются 20 лучших игроков.'),
      h('li', null, 'Пиксель-батл: 150 / 100 / 50 / 0 за место в недельном раунде.'),
      h('li', null, 'Не считаются: кликер, игры с ботом, игры на одном телефоне, компанейские игры и комнаты для друзей. Рейтинг дают только онлайн-партии в «Быстрой игре».'))));
}

/* ----- Профиль ----- */
async function renderMe() {
  ROOT.append(h('button', { class: 'back', type: 'button', onclick: () => show('hub') }, '‹ Игры'));
  if (!G.me) { ROOT.append(h('div', { class: 'none' }, 'Профиль доступен после входа')); return; }
  const gn = await groupName();
  const st = G.stats, played = Object.values(st).reduce((s, x) => s + (x.n || 0), 0);
  const inp = h('input', { id: 'gName2', value: G.me.name, maxlength: 40 }), msg = h('div', { class: 'msg' });
  ROOT.append(h('h1', null, G.me.name), h('p', { class: 'sub' }, fac(G.me.fac).name),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', null, h('small', { class: 'hint' }, 'Партий в этом сезоне'), h('b', { style: { display: 'block', fontSize: '24px', fontFamily: 'var(--f-num)' } }, played)), h('div', null, h('small', { class: 'hint' }, 'Игр с рекордами'), h('b', { style: { display: 'block', fontSize: '24px', fontFamily: 'var(--f-num)' } }, Object.keys(st).length)))),
    h('div', { class: 'card' }, h('label', { for: 'gName2' }, 'Имя (как в группе)'), h('div', { class: 'row' }, inp, h('button', {
      class: 'nb', type: 'button', style: { flex: '0 0 auto' }, onclick: async () => {
        const n = inp.value.trim().replace(/\s+/g, ' '); if (n === G.me.name) return;
        msg.textContent = 'Сохраняем…';
        try { const r = await NET.req('/profile', { name: n }); G.me = r.profile; await syncGroupName(n, gn.gid); toast('Имя изменено' + (gn.gid ? ' — и в группе тоже' : '')); show('me'); } catch (e) { msg.textContent = e.message; }
      }
    }, 'Сохранить')), msg, h('p', { class: 'hint' }, 'Одно имя для группы и для игр. Менять можно раз в сутки.'),
      h('label', null, 'Факультет'), h('div', null, facBadge(G.me.fac), ' ', h('span', { class: 'hint' }, 'закреплён до конца сезона «' + G.season.name + '»'))));
}

/* ===== Экран игры ===== */
let CUR = null;
function openGame(g, mode, extra) {
  if (isMP(g) && !mode) return chooseMode(g);
  closeGame(true);
  const gv = h('div', { class: 'gv bgx' });
  const sc = h('div', { class: 'sc' + (isMP(g) ? ' hide' : '') }, '0');
  const sub = h('small', null, g.like || CATS[g.cat]);
  gv.append(h('div', { class: 'ghd' }, h('button', { class: 'gib', type: 'button', 'aria-label': 'Назад', onclick: () => closeGame() }, '←'),
    h('div', { class: 'tt' }, h('b', null, g.name), sub), sc,
    h('button', { class: 'gib', type: 'button', 'aria-label': 'Правила', onclick: () => rules(g) }, '?')));
  const stage = h('div', { class: 'stage' }); gv.append(stage);
  document.body.append(gv); document.body.style.overflow = 'hidden';
  const cleanups = [], t0 = Date.now();
  let done = false;
  const ctx = {
    mode: mode || 'solo', g, el: stage, net: extra && extra.net || null,
    score(v) { sc.textContent = typeof v === 'number' ? fmtScore(g, v) : v; sc.classList.toggle('hide', v === ''); },
    status(t) { sub.textContent = t; },
    toast,
    on(t, ev, fn, o) { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); },
    key(fn) { ctx.on(window, 'keydown', fn); },
    every(fn, ms) { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
    later(fn, ms) { const id = setTimeout(() => { if (!done) fn(); }, ms); cleanups.push(() => clearTimeout(id)); return id; },
    loop(fn) { let on = true, last = performance.now(); const f = t => { if (!on) return; const dt = Math.min(.05, (t - last) / 1000); last = t; fn(dt); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f); const stop = () => on = false; cleanups.push(stop); return stop; },
    cleanup(fn) { cleanups.push(fn); },
    get alive() { return !done; },
    finish(score, note) { // одиночные игры
      if (done) return; done = true;
      const sec = Math.round((Date.now() - t0) / 1000);
      const st = statOf(g.id); st.plays++; let rec = false;
      if (st.best == null || better(g, score, st.best)) { st.best = score; rec = true; }
      setStat(g.id, st);
      const r = { score, rec, note, mode: ctx.mode, sec };
      setTimeout(() => result(g, r), 500);
      if (G.server && !g.noSubmit) {
        r.pending = NET.req('/submit', { game: g.id, score, sec }).then(x => { if (x.ok) G.stats[g.id] = { ...(G.stats[g.id] || {}), b: x.best }; G.popular = null; return x; })
          .catch(e => { if (e.offline || e.status >= 500) { const q = LS.get('queue', []); q.push({ game: g.id, score, sec }); LS.set('queue', q.slice(-50)); return { queued: true }; } return { ok: false, error: e.message }; });
      }
    },
    match(res, note) { // игры с ботом и на одном телефоне: 'win' | 'loss' | 'draw'
      if (done) return; done = true;
      let delta = null;
      if (ctx.mode === 'bot') {
        const st = statOf(g.id); const opp = 1150, ex = 1 / (1 + 10 ** ((opp - st.elo) / 400)), s = res === 'win' ? 1 : res === 'draw' ? .5 : 0;
        delta = Math.round(32 * (s - ex)); st.elo += delta; st.plays++; st[res[0]]++; setStat(g.id, st);
      }
      if (G.server) NET.req('/played', { game: g.id }).catch(() => { });
      setTimeout(() => result(g, { res, delta, note, mode: ctx.mode }), 700);
    },
    // онлайн: места по итогам партии (0 — первое место) — в сервер; окно итога покажет rooms.js
    ranks(r, note) { if (done) return; done = true; if (ctx.net) ctx.net.result(r, note); }
  };
  const release = pushBack(() => closeGame(true, true));
  CUR = { g, gv, cleanups, ctx, release };
  if (ctx.net) ctx.net.attach(ctx);
  try { const c = g.run(stage, ctx); if (typeof c === 'function') cleanups.push(c); }
  catch (e) { console.error(e); stage.append(h('div', { class: 'none' }, 'Ошибка запуска игры: ' + e.message)); }
  if (ctx.net) ctx.net.ready();
}
function closeGame(silent, fromBack) {
  if (!CUR) return;
  const c = CUR; CUR = null;
  c.ctx.finish = c.ctx.match = c.ctx.ranks = () => { };
  c.cleanups.forEach(f => { try { f(); } catch (e) { } });
  if (c.ctx.net) c.ctx.net.detach();
  RAND = Math.random;
  c.gv.remove(); document.body.style.overflow = '';
  if (!fromBack) c.release();
  $$('.sheet.bgx').forEach(s => s.remove());
  if (!silent || fromBack) show(VIEW === 'setup' || VIEW === 'signin' ? 'hub' : VIEW);
}
function rules(g) {
  sheet((b, close) => {
    b.append(h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, icon(g, 52), h('div', null, h('b', { style: { fontSize: '18px' } }, g.name), h('div', { class: 'hint', style: { marginTop: 0 } }, CATS[g.cat] + (g.like ? ' · ' + g.like : '')))),
      h('div', { class: 'gnote', style: { boxShadow: 'none', padding: '10px 0 0' } }, h('ul', null, g.rules.map(r => h('li', null, r)))),
      h('button', { class: 'go', type: 'button', onclick: () => close() }, 'Понятно'));
  });
}
function result(g, r) {
  if (!CUR || CUR.g !== g) return;
  sheet((b, close) => {
    const box = h('div', { class: 'gres' }, icon(g, 56));
    if (r.res) {
      const st = statOf(g.id), t = r.note || ({ win: 'Победа!', loss: 'Поражение', draw: 'Ничья' }[r.res]);
      box.append(h('h2', { style: { justifyContent: 'center' } }, t));
      if (r.delta != null) box.append(h('div', { class: 'big', style: { color: r.delta >= 0 ? 'var(--ok)' : 'var(--rd)' } }, (r.delta >= 0 ? '+' : '') + r.delta), h('p', { class: 'hint' }, 'Тренировочный рейтинг против бота: ' + st.elo + ` · побед ${st.w}, поражений ${st.l}. В лигу идут только онлайн-партии.`));
      else if (r.mode !== 'bot') box.append(h('p', { class: 'hint' }, 'Игра на одном телефоне не влияет на рейтинг.'));
    } else {
      const head = h('h2', { style: { justifyContent: 'center' } }, r.rec ? 'Новый рекорд!' : 'Игра окончена');
      const line = h('p', { class: 'hint' }, G.server ? 'Отправляем результат…' : 'Нет связи с сервером: рекорд сохранён на телефоне.');
      box.append(head, h('div', { class: 'big' }, fmtScore(g, r.score)));
      if (r.note) box.append(h('p', { class: 'hint' }, r.note));
      box.append(line);
      if (r.pending) r.pending.then(x => {
        if (x.queued) line.textContent = 'Нет интернета — результат отправится позже.';
        else if (!x.ok) { head.textContent = 'Результат не засчитан'; line.className = 'err'; line.textContent = x.error; }
        else { if (x.rec) head.textContent = 'Новый рекорд!'; line.textContent = `Лучший результат: ${fmtScore(g, x.best)} · место ${x.place} из ${x.of}`; }
      });
    }
    b.append(box, h('button', { class: 'go', type: 'button', onclick: () => { close(); openGame(g, r.mode === 'solo' ? undefined : r.mode); } }, 'Ещё раз'),
      h('div', { class: 'row', style: { marginTop: '8px' } }, G.server ? h('button', { class: 'nb', type: 'button', onclick: () => { close(); LBG = g.id; closeGame(true); show('lb'); } }, 'Рейтинг') : null, h('button', { class: 'nb', type: 'button', onclick: () => { close(); closeGame(); } }, 'К играм')));
  });
}

/* ===== Помощники для игр ===== */
function canvas(el, W, H) {
  const c = h('canvas', { class: 'gc' }); const d = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * d; c.height = H * d; c.style.aspectRatio = W + '/' + H; c.style.width = W + 'px';
  const x = c.getContext('2d'); x.scale(d, d); el.append(c);
  c.pos = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  return [c, x];
}
function rr(x, X, Y, W, H, r) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, W, H, r) : x.rect(X, Y, W, H); }
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function swipe(ctx, el, fn) {
  let s = null;
  ctx.on(el, 'pointerdown', e => { s = { x: e.clientX, y: e.clientY }; });
  ctx.on(el, 'pointerup', e => { if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y; s = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')); });
  ctx.key(e => { const k = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' }[e.key]; if (k) { e.preventDefault(); fn(k); } });
}
function info(el, t) { const e = h('div', { class: 'info' }); e.innerHTML = t || ''; el.append(e); return e; }
function btns(el, list) { const b = h('div', { class: 'bar2' }); list.forEach(([t, f, cls]) => b.append(h('button', { class: 'nb ' + (cls || ''), type: 'button', onclick: f }, t))); el.append(b); return b; }
function overlayMsg(el, title, text, btn, fn) {
  const o = h('div', { class: 'card', style: { textAlign: 'center', width: 'min(100%,360px)' } }, h('b', { style: { fontSize: '18px', display: 'block' } }, title), h('p', { class: 'hint' }, text), btn ? h('button', { class: 'go', type: 'button', onclick: () => { o.remove(); fn(); } }, btn) : null);
  el.append(o); return o;
}
const SUITS = ['♠', '♥', '♦', '♣'], RED = s => s === '♥' || s === '♦';
function cardEl(c, o = {}) {
  if (!c || o.back) return h('div', { class: 'pc pcb' });
  const e = h('div', { class: 'pc' + (RED(c.s) ? ' red' : '') + (o.sel ? ' sel' : '') + (o.dim ? ' dim' : '') }, h('span', null, c.r + c.s), h('span', { class: 'c' }, c.s), h('span', { class: 'b' }, c.r + c.s));
  if (o.onclick) { e.style.cursor = 'pointer'; e.addEventListener('click', o.onclick); }
  return e;
}
// экран «передайте телефон» для игры вдвоём на одном устройстве
function passScreen(el, who, fn) {
  const o = h('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 5, display: 'grid', placeItems: 'center', padding: '20px' } },
    h('div', { class: 'card', style: { textAlign: 'center', maxWidth: '320px' } }, h('div', { style: { fontSize: '44px' } }, '📱'), h('b', { style: { fontSize: '19px', display: 'block' } }, 'Передайте телефон: ' + who), h('p', { class: 'hint' }, 'Соперник не должен видеть ваши карты'), h('button', { class: 'go', type: 'button', onclick: () => { o.remove(); fn(); } }, 'Я ' + who + ', показать')));
  el.style.position = 'relative'; el.append(o);
}
// имена в партии: в онлайне — настоящие игроки, иначе «Вы» и «Бот»
function seatNames(ctx, def) { return ctx.net ? ctx.net.seats.map(s => s.name + (ctx.net.isMe(s) ? ' (вы)' : '')) : def; }
