/* ===== Комнаты и онлайн-партии ===== */
const PHRASES = ['Привет! 👋', 'Готов(а)', 'Минутку…', 'Удачи!', 'Хорошая игра 🤝', 'Ещё раз?'];
const BOT_OK = { uno: 1 }; // в каких играх можно посадить бота на пустое место (им управляет хозяин комнаты)

function chooseMode(g) {
  const R = ONLINE[g.id];
  sheet((b, close) => {
    b.append(h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px' } }, icon(g, 52), h('div', null, h('b', { style: { fontSize: '18px' } }, g.name), h('div', { class: 'hint', style: { marginTop: 0 } }, g.players || (R ? (R[0] === R[1] ? R[0] : R[0] + '–' + R[1]) + ' игрока' : '')))));
    const item = (ic, t, s, fn, dis) => b.append(h('button', { class: 'gmode', type: 'button', disabled: dis, onclick: fn }, h('span', null, ic), h('div', null, h('b', null, t), h('small', null, s))));
    const lab = t => b.append(h('div', { class: 'glab' }, t));
    if (R) {
      lab('Онлайн');
      if (!G.server) b.append(h('p', { class: 'hint' }, NET.ok ? 'Нет связи с сервером — онлайн сейчас недоступен.' : 'Сервер игр не настроен.'));
      else {
        item('⚡', 'Быстрая игра', 'Подберём соперника с похожим рейтингом · рейтинговая', () => { close(); quickMatch(g); });
        item('🔒', 'Комната для друзей', 'Код, ссылка или приглашение из группы · без рейтинга', () => { close(); createRoom(g); });
        item('🔢', 'Войти по коду', 'Друг назвал 4 цифры', () => { close(); joinByCode(g); });
        item('📋', 'Открытые комнаты', 'Присоединиться к тем, кто уже ждёт', () => { close(); openRooms(g); });
      }
    } else if (g.cat !== 'party') { lab('Онлайн'); b.append(h('p', { class: 'hint', style: { margin: '4px 2px' } }, 'Онлайн для этой игры появится в следующем обновлении.')); }
    const M = { bot: ['🤖', 'Тренировка с ботом', 'Без интернета, на рейтинг не влияет'], hot: ['📱', 'На одном телефоне', 'Передавайте телефон друг другу'], live: ['🎤', 'Ведущий для живой игры', 'Все рядом, приложение ведёт партию'] };
    lab('Без интернета');
    (g.modes || ['bot', 'hot']).forEach(m => item(M[m][0], M[m][1], M[m][2], () => { close(); openGame(g, m); }));
    b.append(h('button', { class: 'go sec', type: 'button', onclick: () => rules(g) }, 'Правила'));
  });
}

/* ⚡ Быстрая игра: очередь подбора на сервере */
function quickMatch(g) {
  let stop = false, t0 = Date.now();
  sheet((b, close) => {
    const box = h('div', { class: 'gres' }); b.append(box);
    const draw = (st) => {
      box.innerHTML = '';
      const sec = Math.floor((Date.now() - t0) / 1000);
      box.append(icon(g, 56), h('h2', { style: { justifyContent: 'center' } }, 'Ищем соперника…'), h('div', { class: 'big', style: { fontSize: '36px' } }, Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')),
        h('p', { class: 'hint' }, `Ваш рейтинг ${G.elo[g.id] || 1000}. Разница — до ±${st ? st.range : 100}. Каждые 10 секунд диапазон расширяется.` + (st && st.inQueue > 1 ? ` В очереди: ${st.inQueue}.` : '')),
        h('div', { class: 'qbar' }, h('i')));
      if (sec >= 30) box.append(h('div', { class: 'card', style: { boxShadow: 'none', background: 'var(--bg)' } }, h('p', { class: 'hint', style: { marginTop: 0 } }, 'Пока никого нет. Можно подождать или сыграть с ботом — без рейтинга.'), h('button', { class: 'nb', type: 'button', style: { width: '100%' }, onclick: () => { close(); openGame(g, 'bot'); } }, 'Сыграть с ботом')));
      box.append(h('button', { class: 'go sec', type: 'button', onclick: () => close() }, 'Отменить поиск'));
    };
    draw();
    (async () => {
      while (!stop) {
        try {
          const r = await NET.req('/queue', { game: g.id });
          if (stop) break;
          if (r.state === 'found') { stop = true; close(); lobby(g, r.code, { quick: true }); return; }
          draw(r);
        } catch (e) { if (!stop) { box.innerHTML = ''; box.append(errBox(e)); stop = true; } return; }
        await sleep(2000);
      }
    })();
  }, () => { if (!stop) { stop = true; NET.req('/queue', { game: g.id, cancel: true }).catch(() => { }); } stop = true; });
}

/* 🔒 Комната для друзей */
function createRoom(g) {
  const R = ONLINE[g.id], set = { n: g.id === 'haxball' ? 2 : R[1], open: false };
  sheet((b, close) => {
    const draw = () => {
      b.innerHTML = ''; b.append(h('div', { class: 'grab' }), h('h2', { style: { marginTop: 0 } }, 'Новая комната: ' + g.name));
      const seg = (label, opts, get, setv) => { const s = h('div', { class: 'seg' }); opts.forEach(([v, t]) => s.append(h('button', { class: get() === v ? 'on' : '', type: 'button', onclick: () => { setv(v); draw(); } }, t))); b.append(h('label', null, label), s); };
      if (g.id === 'haxball') seg('Формат', [[2, '1×1'], [4, '2×2'], [6, '3×3']], () => set.n, v => set.n = v);
      else if (R[1] > R[0]) seg('Сколько игроков', [...Array(R[1] - R[0] + 1)].map((_, i) => [R[0] + i, String(R[0] + i)]), () => set.n, v => set.n = v);
      seg('Кто может войти', [[false, 'Только по коду'], [true, 'Все']], () => set.open, v => set.open = v);
      const msg = h('div', { class: 'msg' });
      const bt = h('button', { class: 'go', type: 'button', onclick: async () => { bt.disabled = true; msg.textContent = 'Создаём…'; try { const r = await NET.req('/rooms/create', { game: g.id, max: set.n, open: set.open }); close(); lobby(g, r.code, { host: true }); } catch (e) { msg.textContent = e.message; bt.disabled = false; } } }, 'Создать комнату');
      b.append(h('p', { class: 'hint' }, set.open ? 'Комната появится в списке открытых, войти может любой студент.' : 'Комнату видят только те, кому вы дадите код.'),
        h('p', { class: 'hint' }, 'Комнаты для друзей всегда без рейтинга: иначе можно было бы договориться и «сливать» партии друг другу.'), bt, msg);
    };
    draw();
  });
}
function joinByCode(g) {
  sheet((b, close) => {
    const inp = h('input', { id: 'rcode', inputmode: 'numeric', maxlength: 4, placeholder: '0000', style: { fontSize: '32px', textAlign: 'center', letterSpacing: '10px', fontFamily: 'var(--f-num)' } });
    const er = h('div', { class: 'err' });
    const go = async () => {
      const c = inp.value.trim(); if (!/^\d{4}$/.test(c)) { er.textContent = 'Код — это 4 цифры'; return; }
      er.textContent = 'Ищем…';
      try { const r = await NET.req('/rooms/check', { code: c }); const gg = gameById(r.game) || g; close(); lobby(gg, c, {}); } catch (e) { er.textContent = e.message; }
    };
    inp.addEventListener('keydown', e => e.key === 'Enter' && go());
    b.append(h('h2', { style: { marginTop: 0 } }, 'Вход по коду'), inp, er, h('button', { class: 'go', type: 'button', onclick: go }, 'Войти'));
    setTimeout(() => inp.focus(), 60);
  });
}
function openRooms(g) {
  sheet(async (b, close) => {
    b.append(h('h2', { style: { marginTop: 0 } }, 'Открытые комнаты', h('span', { class: 'chip' }, g.name)));
    const lb = h('div', { class: 'glb', style: { boxShadow: 'none', background: 'var(--bg)' } }, loading()); b.append(lb);
    b.append(h('p', { class: 'hint' }, 'Здесь видны только комнаты с открытым входом и свободными местами.'), h('button', { class: 'go sec', type: 'button', onclick: () => { close(); createRoom(g); } }, 'Создать свою'));
    try {
      const r = await NET.req('/rooms?game=' + g.id); lb.innerHTML = '';
      if (!r.rooms.length) lb.append(h('div', { class: 'none' }, 'Сейчас открытых комнат нет. Создайте свою — её увидят другие.'));
      r.rooms.forEach(x => lb.append(h('button', { class: 'glbr', type: 'button', style: { width: '100%', textAlign: 'left', gridTemplateColumns: '1fr auto' }, onclick: () => { close(); lobby(g, x.code, {}); } },
        h('span', { class: 'nm' }, h('span', { class: 'dotf', style: { background: fac(x.hostFac).color } }), h('span', null, h('b', null, 'Комната ' + (x.hostName || x.code)), h('small', { style: { display: 'block', color: 'var(--mu)', fontSize: '12px' } }, `${x.n} из ${x.max} игроков`))),
        h('span', { class: 'chip g' }, 'Войти'))));
    } catch (e) { lb.innerHTML = ''; lb.append(errBox(e)); }
  });
}

/* Лобби комнаты и сама онлайн-партия: одно соединение WebSocket на всё время */
function lobby(g, code, opt) {
  let ws = null, room = null, closeSheet = null, session = null, myUid = null, alive = true, sheetBox = null, chat = [], groupMates = null, online = [], invited = {}, retry = 0;
  const isAdmin = !!opt.admin;
  const myIdx = () => room ? room.seats.findIndex(s => s.uid === myUid) : -1;
  const connect = async () => {
    try { ws = await NET.ws('/room/' + code + '/ws' + (isAdmin ? '?watch=1' : '')); } catch (e) { toast('Нет связи'); return; }
    ws.onopen = () => { retry = 0; sendM({ t: 'hello' }); };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = ev => {
      if (!alive) return;
      if (ev.code === 4001) { toast('Вас удалили из комнаты'); end(); return; }
      if (ev.code === 4000) { toast('Комната закрыта'); end(); return; }
      if (!room) { toast('Не удалось войти в комнату'); end(); return; }
      if (retry++ < 8) setTimeout(connect, 1000 * Math.min(5, retry)); else { toast('Связь с комнатой потеряна'); end(); }
    };
  };
  const sendM = m => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify(m)); } catch (e) { } };
  const end = () => { if (!alive) return; alive = false; try { ws && ws.close(); } catch (e) { } if (closeSheet) { const c = closeSheet; closeSheet = null; c(); } if (session && CUR && CUR.ctx.net === session) { session.detached = true; closeGame(); } };
  const onMsg = m => {
    if (m.t === 'room') {
      const first = !room; room = m.room;
      if (myUid == null) myUid = G.uid;
      if (session) session.updateRoom(room);
      if (room.status === 'lobby' && !session) drawLobby();
      if (first && room.status === 'play' && !session) startGame(room.seed, []);
    }
    else if (m.t === 'start') { if (session && CUR && CUR.ctx.net === session) { session.detached = true; closeGame(true); } session = null; startGame(m.seed, []); }
    else if (m.t === 'replay') { if (!session) startGame(m.seed, m.acts); else session.replay(m.acts); }
    else if (session) session.msg(m);
    else if (m.t === 'chat') { chat.push(m); drawLobby(); }
    else if (m.t === 'err') toast(m.m);
    else if (m.t === 'kicked') { toast('Вас удалили из комнаты'); end(); }
    else if (m.t === 'closed') { toast(m.m || 'Комната закрыта'); end(); }
  };
  const startGame = (seed, acts) => {
    session = new NetSession(g, room, myUid, seed, sendM, isAdmin, () => { lobbyAgain(); }, () => end());
    if (closeSheet) { const c = closeSheet; closeSheet = null; c(); }
    session.pending = acts.slice();
    openGame(g, 'online', { net: session });
  };
  const lobbyAgain = () => { session = null; if (alive) { if (room && room.status === 'lobby') drawLobby(); else sendM({ t: 'rematch' }); } };
  const loadMates = async () => {
    if (groupMates) return;
    groupMates = [];
    try {
      const st = await window.GroupsApi.status(); if (!st || st.state !== 'member') return;
      const off = window.GroupsApi.watchMembers(st.gid, list => {
        groupMates = list.filter(x => x.id !== st.uid).map(x => ({ uid: x.id, name: x.name }));
        if (groupMates.length) NET.req('/online?ids=' + groupMates.map(x => x.uid).join(',')).then(r => { online = r.online; drawLobby(); }).catch(() => { });
        drawLobby(); try { off(); } catch (e) { }
      });
    } catch (e) { }
  };
  const drawLobby = () => {
    if (!alive || !room || session) return;
    if (!closeSheet) closeSheet = sheet(b => { sheetBox = b; }, () => { closeSheet = null; if (!session && alive) { sendM({ t: 'leave' }); end(); } });
    const b = sheetBox; b.innerHTML = ''; b.append(h('div', { class: 'grab' }));
    const i = myIdx(), me = room.seats[i], amHost = me && me.host;
    b.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, icon(g, 40), h('div', { style: { flex: 1 } }, h('b', null, 'Комната ' + g.name), h('div', { class: 'hint', style: { margin: 0 } }, (room.rated ? 'рейтинговая партия' : (room.open ? 'открытая' : 'по коду') + ' · без рейтинга') + (isAdmin ? ' · вы администратор' : '')))));
    if (!room.rated) b.append(h('div', { class: 'codebox' }, h('small', null, 'Код комнаты'), h('b', null, room.code),
      h('button', { class: 'nb', type: 'button', style: { width: '100%', marginTop: '8px' }, onclick: () => { const t = `Заходи в «Студенту БарГУ» → Игры → ${g.name} → Войти по коду: ${room.code}`; try { navigator.clipboard.writeText(t).then(() => toast('Приглашение скопировано'), () => toast(t, 5000)); } catch (e) { toast(t, 5000); } } }, '🔗 Скопировать приглашение')));
    const lb = h('div', { class: 'glb', style: { boxShadow: 'none', background: 'var(--bg)', marginTop: '10px' } });
    const team = k => g.id === 'haxball' ? (k % 2 ? 'Красные' : 'Синие') : null;
    for (let k = 0; k < Math.max(room.max, room.seats.length); k++) {
      const p = room.seats[k];
      if (!p) { lb.append(h('div', { class: 'glbr' }, h('span', { class: 'n' }, '·'), h('span', { class: 'nm' }, h('span', { style: { color: 'var(--mu)', fontWeight: 500 } }, 'Свободное место')), h('span', { style: { display: 'flex', gap: '6px' } }, team(k) ? h('span', { class: 'chip' }, team(k)) : null, (amHost || isAdmin) && BOT_OK[g.id] ? h('button', { class: 'chip', type: 'button', style: { border: 0 }, onclick: () => sendM({ t: 'addbot' }) }, '+ бот') : null, me && g.id === 'haxball' && k !== i ? h('button', { class: 'chip', type: 'button', style: { border: 0 }, onclick: () => sendM({ t: 'team', to: k }) }, 'сюда') : null))); continue; }
      lb.append(h('div', { class: 'glbr' + (k === i ? ' mine' : '') },
        h('span', { class: 'n' }, p.host ? '👑' : p.bot ? '🤖' : p.admin ? '🛠' : '🙂'),
        h('span', { class: 'nm' }, h('span', { class: 'dotf', style: { background: fac(p.fac).color } }), h('span', null, p.name + (k === i ? ' (вы)' : '') + (p.off ? ' · нет связи' : ''))),
        h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, team(k) ? h('span', { class: 'chip', style: { background: k % 2 ? 'var(--rdb)' : 'var(--ac2)', color: k % 2 ? 'var(--rd)' : 'var(--ac)' } }, team(k)) : null,
          h('span', { class: 'chip ' + (p.ready ? 'g' : 'w') }, p.ready ? 'готов' : 'не готов'),
          (amHost || isAdmin) && k !== i ? h('button', { class: 'x2', type: 'button', 'aria-label': 'Убрать', onclick: () => sendM({ t: 'kick', uid: p.uid }) }, '✕') : null)));
    }
    b.append(h('label', null, `Игроки · ${room.seats.length} из ${room.max}` + (room.watchers ? ` · наблюдают: ${room.watchers}` : '')), lb);
    if (!room.rated && room.seats.length < room.max && groupMates && groupMates.length) {
      const gl = h('div', { style: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' } });
      groupMates.filter(x => !room.seats.some(s => s.uid === x.uid)).sort((a, c) => online.includes(c.uid) - online.includes(a.uid)).forEach(x => {
        const on = online.includes(x.uid);
        gl.append(h('button', { class: 'nb', type: 'button', style: { flex: 'none', opacity: on ? 1 : .6 }, disabled: !!invited[x.uid], onclick: async () => { invited[x.uid] = 1; drawLobby(); try { await NET.req('/invite', { to: x.uid, code: room.code }); toast('Приглашение отправлено: ' + x.name); } catch (e) { toast(e.message); } } }, (on ? '🟢 ' : '⚪ ') + x.name + (invited[x.uid] ? ' · отправлено' : '')));
      });
      b.append(h('label', null, 'Позвать из вашей группы'), gl, h('p', { class: 'hint', style: { marginTop: '2px' } }, 'Зелёные — сейчас в приложении. Приглашение появится у них в разделе «Игры».'));
    }
    const ch = h('div', { class: 'chat' }); chat.slice(-4).forEach(m => ch.append(h('div', null, h('b', null, m.name + ': '), PHRASES[m.i] || ''))); if (!chat.length) ch.append(h('div', { class: 'hint', style: { margin: 0 } }, 'Чат — только готовые фразы'));
    const ph = h('div', { style: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' } }); PHRASES.forEach((t, k) => ph.append(h('button', { class: 'chip', type: 'button', style: { border: 0, cursor: 'pointer' }, onclick: () => sendM({ t: 'chat', i: k }) }, t)));
    b.append(h('label', null, 'Чат'), ch, ph);
    const enough = room.seats.length >= room.min, allReady = room.seats.every(s => s.ready);
    if (room.rated) b.append(h('p', { class: 'hint', style: { textAlign: 'center' } }, 'Партия начнётся, когда подключатся все игроки.'));
    else if (amHost || isAdmin) b.append(h('button', { class: 'go', type: 'button', disabled: !(enough && allReady), onclick: () => sendM({ t: 'start' }) }, !enough ? 'Нужен ещё ' + plural(room.min - room.seats.length, 'игрок', 'игрока', 'игроков') : !allReady ? 'Ждём, пока все будут готовы' : 'Начать игру'));
    if (me && !room.rated && !amHost) b.append(h('button', { class: 'go', type: 'button', onclick: () => sendM({ t: 'ready', v: !me.ready }) }, me.ready ? 'Я не готов(а)' : 'Я готов(а)'), h('p', { class: 'hint', style: { textAlign: 'center' } }, 'Игру запускает хозяин комнаты 👑'));
    if (isAdmin && i < 0) b.append(h('button', { class: 'nb', type: 'button', style: { width: '100%', marginTop: '8px' }, onclick: () => sendM({ t: 'sit' }) }, '🛠 Сесть за стол (даже если мест нет)'));
    b.append(h('button', { class: 'go sec', type: 'button', onclick: () => { sendM({ t: 'leave' }); end(); } }, 'Выйти из комнаты'));
  };
  if (!isAdmin) loadMates();
  connect();
}

/* Сеанс онлайн-партии: общий генератор случайностей, порядок ходов с сервера, итог */
class NetSession {
  constructor(g, room, myUid, seed, sendM, admin, onLobby, quit) {
    this.g = g; this.room = room; this.myUid = myUid; this.seed = seed; this.sendM = sendM; this.admin = admin; this.onLobby = onLobby; this.quit = quit;
    this.rand = mulberry(seed); this.applied = 0; this.pending = []; this.h = {}; this.ctx = null; this.adminAs = null; this.ended = false; this.detached = false;
    this.seats = room.seats.map(s => ({ ...s }));
  }
  get seat() { const i = this.seats.findIndex(s => s.uid === this.myUid); if (i >= 0) return i; return this.adminAs == null ? -1 : this.adminAs; }
  get watching() { return this.seats.findIndex(s => s.uid === this.myUid) < 0; }
  isMe(s) { return s.uid === this.myUid; }
  // кто ходит за ботов и вышедших: первый живой игрок
  get isHost() { const k = this.seats.findIndex(s => !s.bot && !s.left && !s.off); return k >= 0 && this.seats[k].uid === this.myUid; }
  updateRoom(r) { this.room = r; r.seats.forEach((s, i) => { if (this.seats[i] && this.seats[i].uid === s.uid) Object.assign(this.seats[i], { off: s.off, left: s.left }); }); if (this.h.room) this.h.room(); }
  attach(ctx) { this.ctx = ctx; RAND = this.rand; if (this.admin) this.adminBar(); }
  ready() { this.started = true; this.replay(this.pending); this.pending = []; }
  replay(acts) { acts.forEach(e => { if (e.n >= this.applied) this.apply(e); }); }
  apply(e) { if (e.n !== this.applied) { if (e.n > this.applied) this.sendM({ t: 'ping' }); return; } this.applied++; try { this.h.act && this.h.act(e.s, e.a); } catch (er) { console.error(er); } }
  msg(m) {
    if (m.t === 'act') { if (!this.started) this.pending.push(m); else this.apply(m); }
    else if (m.t === 'in') { this.h.input && this.h.input(m.s, m.d); }
    else if (m.t === 'state') { this.h.state && this.h.state(m.d); }
    else if (m.t === 'left') { if (this.seats[m.s]) this.seats[m.s].left = true; this.h.left && this.h.left(m.s); if (this.ctx) this.ctx.toast(this.seats[m.s].name + ' вышел(ла) из игры'); }
    else if (m.t === 'chat') { if (this.ctx) this.ctx.toast(m.name + ': ' + (PHRASES[m.i] || ''), 1800); }
    else if (m.t === 'end') this.showEnd(m);
    else if (m.t === 'err') { if (this.ctx) this.ctx.toast(m.m); }
  }
  onAct(fn) { this.h.act = fn; } onInput(fn) { this.h.input = fn; } onState(fn) { this.h.state = fn; } onLeft(fn) { this.h.left = fn; } onRoom(fn) { this.h.room = fn; }
  send(a) { if (this.ended) return; if (this.watching) { if (this.adminAs == null) return this.ctx && this.ctx.toast('Выберите, за кого ходить'); this.sendM({ t: 'act', a, as: this.adminAs }); } else this.sendM({ t: 'act', a }); }
  botSend(seat, a) { this.sendM({ t: 'act', a, bot: seat }); }
  input(d) { this.sendM({ t: 'in', d }); }
  state(d) { this.sendM({ t: 'state', d }); }
  result(ranks, note) {
    this.note = note;
    if (this.watching) return;
    this.sendM({ t: 'result', ranks });
    this.wait = setTimeout(() => { if (!this.ended && this.ctx) this.ctx.toast('Ждём, пока соперник подтвердит итог…', 3000); }, 1500);
  }
  showEnd(m) {
    if (this.ended) return; this.ended = true; clearTimeout(this.wait);
    const g = this.g, i = this.seat, ranks = m.ranks;
    let res = 'draw';
    if (ranks && i >= 0) { const best = Math.min(...ranks); res = ranks[i] === best ? (ranks.filter(r => r === best).length > 1 ? 'draw' : 'win') : 'loss'; }
    const title = m.how === 'desync' ? 'Партия не засчитана' : m.how === 'admin' ? 'Партию завершил администратор' : this.watching ? 'Партия окончена' : ({ win: 'Победа!', loss: 'Поражение', draw: 'Ничья' }[res]);
    const delta = m.rated && m.rated.delta && i >= 0 ? m.rated.delta[i] : null;
    if (m.rated && m.rated.elo && i >= 0) G.elo[g.id] = m.rated.elo[i];
    G.popular = null;
    setTimeout(() => {
      if (!CUR || CUR.ctx.net !== this) return;
      sheet((b, close) => {
        const box = h('div', { class: 'gres' }, icon(g, 56), h('h2', { style: { justifyContent: 'center' } }, title));
        if (this.note) box.append(h('p', { class: 'hint' }, this.note));
        if (ranks && this.seats.length > 2) box.append(h('div', { class: 'glb', style: { boxShadow: 'none', background: 'var(--bg)', textAlign: 'left' } }, ...this.seats.map((s, k) => ({ s, r: ranks[k] })).sort((a, c) => a.r - c.r).map(x => h('div', { class: 'glbr' }, h('span', { class: 'n' }, x.r + 1), h('span', { class: 'nm' }, h('span', null, x.s.name)), h('span')))));
        if (delta != null) box.append(h('div', { class: 'big', style: { color: delta >= 0 ? 'var(--ok)' : 'var(--rd)' } }, (delta >= 0 ? '+' : '') + delta), h('p', { class: 'hint' }, 'Рейтинг: ' + G.elo[g.id]));
        else box.append(h('p', { class: 'hint' }, m.how === 'desync' ? 'Ходы на телефонах разошлись (обычно из-за плохой связи). Рейтинг не изменился.' : this.room.rated ? '' : 'Комната для друзей — без рейтинга.'));
        b.append(box);
        if (!this.room.rated && !this.watching) b.append(h('button', { class: 'go', type: 'button', onclick: () => { close(); this.sendM({ t: 'rematch' }); this.detached = true; closeGame(true); this.onLobby(); } }, 'Ещё раз в этой комнате'));
        b.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'nb', type: 'button', onclick: () => { close(); closeGame(); } }, 'К играм')));
      });
    }, 600);
  }
  detach() {
    if (this.detached) return; this.detached = true;
    this.sendM({ t: 'leave' }); this.quit();
  }
  adminBar() {
    const bar = h('div', { class: 'gadm' });
    const sel = h('select', { onchange: e => { this.adminAs = e.target.value === '' ? null : +e.target.value; } }, h('option', { value: '' }, 'Только смотреть'), ...this.seats.map((s, k) => h('option', { value: k }, 'Ходить за: ' + s.name)));
    const endSel = h('select', null, h('option', { value: '' }, 'Завершить партию…'), ...this.seats.map((s, k) => h('option', { value: 'w' + k }, 'Победил(а): ' + s.name)), h('option', { value: 'd' }, 'Ничья'));
    endSel.onchange = () => { const v = endSel.value; if (!v) return; const ranks = this.seats.map((s, k) => v === 'd' ? 0 : ('w' + k === v ? 0 : 1)); this.sendM({ t: 'result', ranks }); endSel.value = ''; };
    const kick = h('select', null, h('option', { value: '' }, 'Выгнать…'), ...this.seats.filter(s => !s.bot).map(s => h('option', { value: s.uid }, s.name)));
    kick.onchange = () => { if (kick.value) this.sendM({ t: 'kick', uid: kick.value }); kick.value = ''; };
    bar.append(h('b', null, '🛠'), sel, endSel, kick);
    if (this.watching) this.ctx.el.prepend(bar); else this.ctx.el.prepend(h('div', { class: 'gadm' }, h('b', null, '🛠'), endSel, kick));
  }
}

/* Приглашения от одногруппников */
let INV = [], INVSEEN = new Set(), INVT = null;
async function pollInvites() {
  if (!G.server || document.hidden) return;
  try { const r = await NET.req('/inbox'); INV = r.invites || []; INV.forEach(x => { const k = x.code + x.t; if (!INVSEEN.has(k)) { INVSEEN.add(k); const gg = gameById(x.game); toast(`${x.from} зовёт вас в «${gg ? gg.name : x.game}»`, 4000); } }); if (VIEW === 'hub' && ROOT) { const e = $('#ginv', ROOT); if (e) drawInvites(e); } } catch (e) { }
}
function drawInvites(el) {
  el.id = 'ginv'; el.innerHTML = '';
  INV.forEach(x => { const gg = gameById(x.game); if (!gg) return; el.append(h('div', { class: 'ginvite' }, icon(gg, 36), h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, x.from), h('small', null, 'зовёт в «' + gg.name + '» · код ' + x.code)), h('button', { class: 'nb', type: 'button', onclick: () => { INV = INV.filter(y => y !== x); NET.req('/inbox?clear=1').catch(() => { }); lobby(gg, x.code, {}); } }, 'Войти'))); });
}
