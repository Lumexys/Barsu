/* ===== Карточные игры ===== */
/* --- Цвета (как Уно) --- */
const UNO_C = { r: '#e63946', y: '#f4b400', g: '#2a9d5c', b: '#1f6fd1', w: '#222' }, UNO_N = { r: 'красный', y: 'жёлтый', g: 'зелёный', b: 'синий' };
function unoEl(c, o = {}) {
  const lbl = { skip: '⊘', rev: '⇄', '+2': '+2', wild: '★', '+4': '+4' }[c.v] || c.v;
  const e = h('div', { style: { width: (o.w || 52) + 'px', height: Math.round((o.w || 52) * 1.45) + 'px', borderRadius: '9px', background: UNO_C[c.c], border: '3px solid #fff', boxShadow: o.sel ? '0 0 0 3px #f5c400' : '0 2px 5px rgba(0,0,0,.3)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: Math.round((o.w || 52) * .42) + 'px', fontFamily: 'var(--f-num)', flex: 'none', opacity: o.dim ? .45 : 1, cursor: o.onclick ? 'pointer' : 'default', textShadow: '0 2px 0 rgba(0,0,0,.25)' } },
    c.c === 'w' ? h('div', { style: { width: '62%', aspectRatio: 1, borderRadius: '50%', background: 'conic-gradient(#e63946 0 25%,#f4b400 0 50%,#2a9d5c 0 75%,#1f6fd1 0)', display: 'grid', placeItems: 'center', fontSize: '.7em' } }, c.v === '+4' ? '+4' : '') : lbl);
  if (o.onclick) e.addEventListener('click', o.onclick);
  return e;
}
game({
  id: 'uno', name: 'Цвета', like: 'похоже на Уно', cat: 'cards', icon: '🎴', c1: '#e63946', c2: '#1f6fd1', players: '2–4 игрока',
  rules: ['Кладите карту того же цвета или того же значения, что сверху.', '⊘ — следующий пропускает ход, ⇄ — меняет направление, +2 — следующий берёт 2 карты и пропускает ход.', '★ — выбрать цвет. +4 — выбрать цвет, следующий берёт 4.', 'Нет подходящей карты — возьмите одну из колоды. Первым избавился от всех карт — победил.', 'С ботом играют четверо, на одном телефоне — двое, онлайн — от двух до четырёх.'],
  run(el, ctx) {
    const net = ctx.net, on = !!net, hot = ctx.mode === 'hot', myName = G.me && G.me.name || 'Вы';
    const deck = []; ['r', 'y', 'g', 'b'].forEach(c => { deck.push({ c, v: '0' }); for (let k = 0; k < 2; k++) { for (let n = 1; n <= 9; n++) deck.push({ c, v: '' + n }); ['skip', 'rev', '+2'].forEach(v => deck.push({ c, v })); } });
    for (let k = 0; k < 4; k++) { deck.push({ c: 'w', v: 'wild' }); deck.push({ c: 'w', v: '+4' }); }
    shuffle(deck);
    const P = on ? net.seats.map(s => ({ n: s.name + (net.isMe(s) ? ' (вы)' : ''), bot: !!s.bot })) : hot ? [{ n: 'Игрок 1' }, { n: 'Игрок 2' }] : [{ n: myName }, { n: 'Бот Вася', bot: 1 }, { n: 'Бот Оля', bot: 1 }, { n: 'Бот Петя', bot: 1 }];
    P.forEach(p => p.h = deck.splice(0, 7));
    let top; do { top = deck.shift(); if (top.c === 'w') deck.push(top); } while (top.c === 'w');
    let pile = [], color = top.c, turn = 0, dir = 1, drew = false, viewer = 0, over = false, msg = '';
    const autoSeat = i => on ? (P[i].bot || net.seats[i].left) : P[i].bot; // за этого игрока ходит программа
    const mine = i => on ? net.seat === i : hot ? true : !P[i].bot;
    const draw1 = p => { if (!deck.length) { deck.push(...shuffle(pile)); pile = []; } if (!deck.length) return; p.h.push(deck.pop()); };
    const ok = c => c && (c.c === 'w' || c.c === color || c.v === top.v);
    const felt = h('div', { class: 'felt' }), hand = h('div', { class: 'hand' }), ctl = h('div', { class: 'bar2' });
    el.append(felt, hand, ctl);
    const nextI = (k = 1) => (turn + dir * k + P.length * 4) % P.length;
    const finishWin = pi => {
      over = true; render();
      if (on) ctx.ranks(P.map((p, i) => i === pi ? 0 : 1), P[pi].n + ' побеждает');
      else if (hot) ctx.match('draw', P[pi].n + ' победил!'); else ctx.match(pi === 0 ? 'win' : 'loss', pi === 0 ? 'Победа!' : P[pi].n + ' победил');
    };
    const play = (pi, card, chosen) => {
      const p = P[pi]; p.h.splice(p.h.indexOf(card), 1); pile.push(top); top = card; color = card.c === 'w' ? chosen : card.c; drew = false;
      msg = p.n + ': ' + (card.c === 'w' ? 'цвет — ' + UNO_N[color] : 'ход сделан');
      if (!p.h.length) { finishWin(pi); return; }
      if (p.h.length === 1) ctx.toast(p.n + ': «Последняя!»', 1200);
      if (card.v === 'rev') { dir *= -1; if (P.length === 2) turn = nextI(); }
      if (card.v === 'skip') turn = nextI();
      if (card.v === '+2') { const t = P[nextI()]; draw1(t); draw1(t); turn = nextI(); }
      if (card.v === '+4') { const t = P[nextI()]; for (let k = 0; k < 4; k++) draw1(t); turn = nextI(); }
      turn = nextI(); step();
    };
    // все действия: {p: номер карты в руке, c: цвет} — сыграть, {d:1} — взять, {s:1} — пропустить после взятия
    const apply = (i, a) => {
      if (over || i !== turn) return;
      const p = P[i];
      if (a.p != null) { const card = p.h[a.p]; if (!ok(card)) return; if (card.c === 'w' && !UNO_N[a.c]) return; play(i, card, a.c); return; }
      if (a.d && !drew) {
        draw1(p); drew = true;
        if (!ok(p.h[p.h.length - 1])) { msg = p.n + ': карта не подошла, ход переходит'; drew = false; turn = nextI(); render(); ctx.later(step, 600); return; }
        msg = mine(i) ? 'Можно сыграть взятую карту или пропустить ход' : p.n + ' взял(а) карту'; render(); if (autoSeat(i)) step(); return;
      }
      if (a.s && drew) { drew = false; turn = nextI(); step(); }
    };
    const act = a => { if (on) net.send(a); else apply(turn, a); };
    if (on) net.onAct((s, a) => apply(s, a));
    const step = () => {
      if (over) return;
      const p = P[turn];
      if (autoSeat(turn)) { render(); if (!on || net.isHost) { const i = turn; ctx.later(() => { if (turn === i && !over) botMove(i); }, 750); } return; }
      if (hot && viewer !== turn) { viewer = turn; render(true); passScreen(el, p.n, () => render()); return; }
      if (!on) viewer = turn;
      msg = (mine(turn) ? (hot ? p.n + ', ваш ход' : 'Ваш ход') : 'Ходит ' + p.n) + ' · цвет: ' + UNO_N[color]; render();
    };
    const botMove = i => {
      const p = P[i], k = p.h.findIndex(c => c.c !== 'w' && ok(c)), k2 = k >= 0 ? k : p.h.findIndex(ok);
      const cnt = {}; p.h.forEach(x => x.c !== 'w' && (cnt[x.c] = (cnt[x.c] || 0) + 1));
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || 'r';
      const a = k2 >= 0 ? { p: k2, c: best } : drew ? { s: 1 } : { d: 1 };
      if (on) net.botSend(i, a); else apply(i, a);
    };
    const chooseColor = idx => { ctl.innerHTML = ''; ['r', 'y', 'g', 'b'].forEach(c => ctl.append(h('button', { class: 'nb', type: 'button', style: { background: UNO_C[c], color: '#fff' }, onclick: () => act({ p: idx, c }) }, UNO_N[c]))); };
    const render = (hide) => {
      if (on) viewer = Math.max(0, net.seat);
      felt.innerHTML = '';
      const opp = h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' } });
      P.forEach((p, i) => { if (i === viewer && !p.bot) return; opp.append(h('div', { class: 'seat' + (i === turn ? ' turn' : '') }, h('span', { class: 'av' }, p.bot ? '🤖' : '🙂'), h('span', null, p.n, h('br'), h('small', null, p.h.length + ' карт')))); });
      felt.append(opp, h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center' } },
        h('div', { style: { width: '52px', height: '75px', borderRadius: '9px', background: 'repeating-linear-gradient(45deg,#222 0 6px,#444 6px 12px)', border: '3px solid #fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '12px' }, onclick: () => humanDraw() }, deck.length),
        unoEl(top, { w: 58 }), h('div', { style: { textAlign: 'center', fontSize: '12px' } }, h('div', { style: { width: '28px', height: '28px', borderRadius: '50%', background: UNO_C[color], margin: '0 auto 4px', border: '2px solid #fff' } }), dir > 0 ? '↻' : '↺')),
        h('div', { style: { fontSize: '13px', opacity: .9 } }, msg));
      hand.innerHTML = ''; ctl.innerHTML = '';
      if (hide) return;
      const me = P[viewer], my = turn === viewer && mine(turn) && !autoSeat(turn) && !over;
      me.h.forEach((c, idx) => hand.append(unoEl(c, { w: 46, dim: my && !ok(c), onclick: my && ok(c) ? () => { if (c.c === 'w') chooseColor(idx); else act({ p: idx }); } : null })));
      if (my) ctl.append(h('button', { class: 'nb', type: 'button', onclick: humanDraw }, drew ? 'Пропустить ход' : 'Взять карту'));
    };
    const humanDraw = () => { if (over || autoSeat(turn) || turn !== viewer || !mine(turn)) return; act(drew ? { s: 1 } : { d: 1 }); };
    if (on) { net.onLeft(() => { render(); if (autoSeat(turn) && net.isHost) step(); }); net.onRoom(() => { if (!over && autoSeat(turn) && net.isHost) step(); }); }
    ctx.score('');
    step();
  }
});

/* --- Дурак (подкидной, 36 карт) --- */
const DR = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
game({
  id: 'durak', name: 'Дурак', like: 'подкидной', cat: 'cards', icon: '🂡', c1: '#f4a261', c2: '#9d0208',
  rules: ['36 карт, у каждого по 6. Последняя карта колоды — козырь.', 'Атакующий кладёт карту, защитник бьёт её старшей картой той же масти или козырем.', 'Атакующий может подкидывать карты того же достоинства, что уже на столе (до 6).', 'Не можете отбиться — «Беру». Всё отбито — «Бито», и вы атакуете.', 'Кто остался с картами, когда колода кончилась, — дурак.', 'Чтобы отбить, нажмите на свою карту: она побьёт первую неотбитую карту, которую может.'],
  run(el, ctx) {
    const net = ctx.net, on = !!net, hot = ctx.mode === 'hot';
    const deck = shuffle(['♠', '♥', '♦', '♣'].flatMap(s => DR.map((r, v) => ({ s, r, v }))));
    const trump = deck[deck.length - 1];
    const nm = i => on ? net.seats[i].name + (net.isMe(net.seats[i]) ? ' (вы)' : '') : hot ? 'Игрок ' + (i + 1) : i ? 'Бот Гриша' : (G.me && G.me.name || 'Вы');
    const P = [{ n: nm(0), h: [] }, { n: nm(1), h: [], bot: !on && !hot }];
    const fill = i => { while (P[i].h.length < 6 && deck.length) P[i].h.push(deck.shift()); };
    fill(0); fill(1);
    const lowT = p => Math.min(...p.h.filter(c => c.s === trump.s).map(c => c.v), 99);
    let att = lowT(P[0]) <= lowT(P[1]) ? 0 : 1, table = [], taking = false, over = false, viewer = on ? Math.max(0, net.seat) : hot ? att : 0, msg = '';
    const mine = i => on ? net.seat === i : hot ? true : i === 0;
    const def = () => 1 - att;
    const beats = (a, d) => d.s === a.s ? d.v > a.v : d.s === trump.s && a.s !== trump.s;
    const canAdd = c => (!table.length || table.some(p => p.a.r === c.r || (p.d && p.d.r === c.r))) && table.length < 6 && table.filter(p => !p.d).length < P[def()].h.length;
    const felt = h('div', { class: 'felt' }), hand = h('div', { class: 'hand' }), ctl = h('div', { class: 'bar2' }); el.append(felt, hand, ctl);
    const sortH = hh => hh.slice().sort((a, b) => (a.s === trump.s) - (b.s === trump.s) || a.v - b.v);
    const endRound = took => {
      if (took) { P[def()].h.push(...table.flatMap(p => p.d ? [p.a, p.d] : [p.a])); msg = P[def()].n + ' забирает карты'; }
      else msg = 'Бито';
      table = []; taking = false; fill(att); fill(def());
      if (!took) att = def();
      if (!deck.length && (!P[0].h.length || !P[1].h.length)) {
        over = true; render();
        const e0 = !P[0].h.length, e1 = !P[1].h.length;
        if (on) ctx.ranks(e0 && e1 ? [0, 0] : e0 ? [0, 1] : [1, 0], e0 && e1 ? 'Ничья' : (e0 ? P[1] : P[0]).n + ' — дурак!');
        else if (e0 && e1) ctx.match('draw', 'Ничья');
        else if (hot) ctx.match('draw', (e0 ? P[1] : P[0]).n + ' — дурак!');
        else ctx.match(e0 ? 'win' : 'loss', e0 ? 'Победа! Бот остался в дураках' : 'Вы остались в дураках');
        return;
      }
      tick();
    };
    const active = () => (table.some(p => !p.d) && !taking) ? def() : att;
    const tick = () => {
      if (over) return;
      const a = active();
      if (P[a].bot) { render(); ctx.later(() => bot(a), 800); return; }
      if (hot && viewer !== a) { viewer = a; render(true); passScreen(el, P[a].n, () => render()); return; }
      render();
    };
    // действия: {a: карта} — атаковать/подкинуть, {d: карта} — отбить, {take:1} — беру, {end:1} — бито / пусть забирает
    const apply = (i, x) => {
      if (over || i !== active()) return;
      const p = P[i], key = c => c && c.s + c.r, find = k => p.h.find(c => key(c) === k);
      if (x.d && i === def() && !taking) { const c = find(x.d), t = c && table.find(t => !t.d && beats(t.a, c)); if (!t) return; p.h.splice(p.h.indexOf(c), 1); t.d = c; msg = ''; tick(); return; }
      if (x.a && i === att) { const c = find(x.a); if (!c || !canAdd(c)) return; p.h.splice(p.h.indexOf(c), 1); table.push({ a: c }); msg = table.length > 1 ? p.n + ' подкидывает' : ''; tick(); return; }
      if (x.take && i === def() && !taking && table.some(t => !t.d)) { taking = true; msg = p.n + ': «Беру». Можно подкинуть'; tick(); return; }
      if (x.end && i === att && table.length && table.every(t => t.d || taking)) endRound(taking);
    };
    const act = x => { if (on) net.send(x); else apply(active(), x); };
    if (on) net.onAct((s, x) => apply(s, x));
    const bot = i => {
      const p = P[i];
      if (i === def()) {
        const un = table.filter(t => !t.d);
        for (const t of un) { const c = sortH(p.h.filter(c => beats(t.a, c)))[0]; if (!c || (c.s === trump.s && c.v > 5 && deck.length > 6 && Math.random() < .5)) { taking = true; msg = p.n + ': «Беру»'; tick(); return; } p.h.splice(p.h.indexOf(c), 1); t.d = c; }
        msg = p.n + ' отбился'; tick(); return;
      }
      const opts = sortH(p.h.filter(canAdd)).filter(c => !table.length || c.s !== trump.s || !deck.length);
      if (opts.length && (!table.length || opts[0].v < 5 || !deck.length || taking)) { const c = opts[0]; p.h.splice(p.h.indexOf(c), 1); table.push({ a: c }); msg = p.n + (table.length > 1 ? ' подкидывает' : ' ходит'); tick(); return; }
      if (taking) endRound(true); else endRound(false);
    };
    const tapCard = c => {
      if (over || active() !== viewer || !mine(viewer)) return;
      const k = c.s + c.r;
      if (viewer === def() && !taking) { if (!table.find(t => !t.d && beats(t.a, c))) return ctx.toast('Этой картой нечего побить'); act({ d: k }); return; }
      if (viewer === att) { if (!canAdd(c)) return ctx.toast(table.length ? 'Подкинуть можно только карту того же достоинства' : 'Нельзя'); act({ a: k }); }
    };
    const render = hide => {
      if (on) viewer = Math.max(0, net.seat);
      felt.innerHTML = ''; const o = P[1 - viewer];
      felt.append(h('div', { class: 'seat' + (active() !== viewer ? ' turn' : '') }, h('span', { class: 'av' }, o.bot ? '🤖' : '🙂'), o.n + ' · ' + o.h.length + ' карт'));
      felt.append(h('div', { style: { display: 'flex', gap: '4px' } }, ...o.h.map(() => h('div', { class: 'pc pcb', style: { width: '22px', height: '34px', padding: 0 } }))));
      const tb = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', minHeight: '90px', alignItems: 'center' } });
      table.forEach(t => tb.append(h('div', { style: { position: 'relative', width: '60px', height: '86px' } }, cardEl(t.a), t.d ? h('div', { style: { position: 'absolute', left: '12px', top: '16px' } }, cardEl(t.d)) : null)));
      if (!table.length) tb.append(h('span', { style: { opacity: .6, fontSize: '13px' } }, 'Стол пуст'));
      felt.append(h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' } }, deck.length ? h('div', { style: { position: 'relative', width: '62px', height: '70px' } }, h('div', { style: { position: 'absolute', left: 0, top: 0, transform: 'rotate(90deg) translate(2px,-4px)' } }, cardEl(trump)), h('div', { class: 'pc pcb', style: { position: 'absolute', left: 0, top: 0 } })) : null, h('span', null, 'Козырь ' + trump.s + ' · в колоде ' + deck.length)), tb, h('div', { style: { fontSize: '13px' } }, msg || (active() === viewer ? (viewer === att ? 'Вы атакуете' : 'Вы защищаетесь') : 'Ходит ' + P[active()].n)));
      hand.innerHTML = ''; ctl.innerHTML = ''; if (hide) return;
      sortH(P[viewer].h).forEach(c => hand.append(cardEl(c, { onclick: () => tapCard(c) })));
      if (active() === viewer && mine(viewer) && !over) {
        if (viewer === def() && !taking && table.some(t => !t.d)) ctl.append(h('button', { class: 'nb red', type: 'button', onclick: () => act({ take: 1 }) }, 'Беру'));
        if (viewer === att && table.length && table.every(t => t.d || taking)) ctl.append(h('button', { class: 'nb', type: 'button', onclick: () => act({ end: 1 }) }, taking ? 'Пусть забирает' : 'Бито'));
      }
    };
    ctx.score(''); msg = P[att].n + ' ходит первым (младший козырь)'; tick();
  }
});

/* --- Покер (техасский холдем на фишки) --- */
function eval7(cs) {
  const byS = {}; cs.forEach(c => (byS[c.s] = byS[c.s] || []).push(c.r));
  const sHi = rs => { const u = [...new Set(rs)].sort((a, b) => b - a); if (u.includes(14)) u.push(1); let run = 1; for (let i = 1; i < u.length; i++) { if (u[i] === u[i - 1] - 1) { if (++run >= 5) return u[i] + 4; } else run = 1; } return 0; };
  for (const s in byS) if (byS[s].length >= 5) { const v = sHi(byS[s]); if (v) return [8, v]; }
  const cnt = {}; cs.forEach(c => cnt[c.r] = (cnt[c.r] || 0) + 1);
  const g = Object.entries(cnt).map(([r, n]) => [+r, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const rs = cs.map(c => c.r).sort((a, b) => b - a), kick = (ex, n) => rs.filter(r => !ex.includes(r)).slice(0, n);
  if (g[0][1] === 4) return [7, g[0][0], ...kick([g[0][0]], 1)];
  if (g[0][1] === 3 && g[1] && g[1][1] >= 2) return [6, g[0][0], g[1][0]];
  for (const s in byS) if (byS[s].length >= 5) return [5, ...byS[s].sort((a, b) => b - a).slice(0, 5)];
  const st = sHi(rs); if (st) return [4, st];
  if (g[0][1] === 3) return [3, g[0][0], ...kick([g[0][0]], 2)];
  if (g[0][1] === 2 && g[1] && g[1][1] === 2) return [2, g[0][0], g[1][0], ...kick([g[0][0], g[1][0]], 1)];
  if (g[0][1] === 2) return [1, g[0][0], ...kick([g[0][0]], 3)];
  return [0, ...rs.slice(0, 5)];
}
const cmpH = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };
const HAND_N = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш'];
game({
  id: 'poker', name: 'Покер', like: 'техасский холдем', cat: 'cards', icon: '♠️', c1: '#2d6a4f', c2: '#081c15', players: 'вы и 3 бота', modes: ['bot'],
  rules: ['Играем на виртуальные фишки, их нельзя купить или вывести. У всех по 1000.', 'Каждому 2 карты, на стол выкладываются 5 общих. Побеждает лучшая комбинация из 5 карт.', 'Старшинство: старшая карта, пара, две пары, сет, стрит, флеш, фулл-хаус, каре, стрит-флеш.', 'Блайнды 10/20. Упрощение: в раздаче нельзя поставить больше самого маленького стека за столом.', '«Встать из-за стола» — победа, если фишек больше 1000.'],
  run(el, ctx) {
    const P = [{ n: G.me && G.me.name || 'Вы', chips: 1000 }, { n: 'Бот Лёва', chips: 1000, bot: 1, ag: .6 }, { n: 'Бот Ника', chips: 1000, bot: 1, ag: .35 }, { n: 'Бот Сэм', chips: 1000, bot: 1, ag: .8 }];
    const RN = { 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' }; const card = c => ({ r: RN[c.r] || '' + c.r, s: c.s });
    let dealer = rnd(4), board = [], pot = 0, deck, cap, curBet, msg = '', showdown = false, resolveHuman = null, handNo = 0, over = false;
    const felt = h('div', { class: 'felt' }), hand = h('div', { class: 'hand' }), ctl = h('div', { class: 'bar2' }); el.append(felt, hand, ctl);
    const render = () => {
      felt.innerHTML = '';
      const seats = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', width: '100%' } });
      P.slice(1).forEach(p => seats.append(h('div', { style: { textAlign: 'center', fontSize: '12px', opacity: p.out || p.fold ? .45 : 1 } },
        h('div', { class: 'seat' + (p.turn ? ' turn' : ''), style: { justifyContent: 'center' } }, h('span', { class: 'av' }, '🤖')), h('b', null, p.n), h('div', null, '💰 ' + p.chips), p.bet ? h('div', { style: { color: '#ffd166' } }, 'ставка ' + p.bet) : null,
        h('div', { style: { display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '3px', transform: 'scale(.7)', transformOrigin: 'top' } }, ...(p.hole && !p.out ? p.hole.map(c => showdown && !p.fold ? cardEl(card(c)) : cardEl(null, { back: 1 })) : [])),
        p.last ? h('div', { style: { opacity: .85 } }, p.last) : null)));
      felt.append(seats, h('div', { style: { display: 'flex', gap: '4px', minHeight: '70px' } }, ...board.map(c => cardEl(card(c)))), h('b', null, 'Банк: ' + pot), h('div', { style: { fontSize: '13px', textAlign: 'center' } }, msg));
      hand.innerHTML = ''; const me = P[0];
      if (me.hole) me.hole.forEach(c => hand.append(cardEl(card(c))));
      hand.append(h('div', { style: { alignSelf: 'center', marginLeft: '10px', fontSize: '14px' } }, h('b', null, '💰 ' + me.chips), me.bet ? h('div', { class: 'hint', style: { margin: 0 } }, 'ваша ставка ' + me.bet) : null, me.hole && board.length ? h('div', { class: 'hint', style: { margin: 0 } }, HAND_N[eval7(me.hole.concat(board))[0]]) : null));
      ctx.score(me.chips);
    };
    const act = async (i, need) => {
      const p = P[i], toCall = curBet - p.bet; p.turn = true; render();
      let a;
      if (p.bot) {
        await sleep(650); if (!ctx.alive) return 'fold';
        let s; if (!board.length) { const [x, y] = p.hole; s = x.r === y.r ? .5 + x.r / 30 : (x.r + y.r) / 34 + (x.s === y.s ? .06 : 0); }
        else { const e = eval7(p.hole.concat(board)); s = [.15 + e[1] / 100, .45, .62, .72, .82, .86, .92, .97, 1][e[0]]; }
        s += (Math.random() - .5) * .2;
        if (s > .72 && Math.random() < p.ag) a = { t: 'raise' }; else if (toCall === 0) a = { t: 'call' }; else if (s > .35 || toCall <= 20 && s > .2) a = { t: 'call' }; else a = { t: 'fold' };
      } else {
        a = await new Promise(r => { resolveHuman = r; ctl.innerHTML = ''; const rz = Math.min(cap - p.bet, curBet - p.bet + Math.max(20, Math.round(pot / 2 / 10) * 10));
          ctl.append(h('button', { class: 'nb red', onclick: () => r({ t: 'fold' }) }, 'Пас'), h('button', { class: 'nb', onclick: () => r({ t: 'call' }) }, toCall ? 'Колл ' + Math.min(toCall, p.chips) : 'Чек'));
          if (cap > curBet) ctl.append(h('button', { class: 'nb', onclick: () => r({ t: 'raise', to: p.bet + rz }) }, 'Рейз до ' + (p.bet + rz)), h('button', { class: 'nb', style: { background: 'var(--wa)', color: '#fff' }, onclick: () => r({ t: 'raise', to: cap }) }, 'Ва-банк ' + cap)); });
        ctl.innerHTML = '';
      }
      p.turn = false;
      const pay = to => { const d = Math.min(to - p.bet, p.chips); p.chips -= d; p.bet += d; pot += d; };
      if (a.t === 'fold' && toCall > 0) { p.fold = true; p.last = 'пас'; }
      else if (a.t === 'raise' && cap > curBet) { const to = Math.min(cap, a.to || curBet + Math.max(20, Math.round(pot / 20) * 10)); pay(to); curBet = Math.max(curBet, p.bet); p.last = 'рейз ' + p.bet; return 'raise'; }
      else { pay(curBet); p.last = toCall ? 'колл' : 'чек'; }
      return a.t;
    };
    const live = () => P.filter(p => !p.out && !p.fold);
    const betting = async start => {
      let need = new Set(live().filter(p => p.chips > 0).map(p => P.indexOf(p))), i = start;
      let guard = 0;
      while (need.size && live().length > 1 && guard++ < 100) {
        const p = P[i];
        if (need.has(i) && !p.fold && !p.out) {
          if (p.chips === 0) need.delete(i);
          else { const r = await act(i); if (!ctx.alive) return; need.delete(i); if (r === 'raise') live().forEach(q => { const k = P.indexOf(q); if (k !== i && q.chips > 0) need.add(k); }); }
          render();
        }
        i = (i + 1) % 4;
      }
      P.forEach(p => p.bet = 0); curBet = 0;
    };
    const nextAlive = i => { do i = (i + 1) % 4; while (P[i].out); return i; };
    const handLoop = async () => {
      while (ctx.alive && !over) {
        handNo++; showdown = false; board = []; pot = 0; msg = 'Раздача ' + handNo;
        deck = shuffle(SUITS.flatMap(s => [...Array(13)].map((_, k) => ({ s, r: k + 2 }))));
        P.forEach(p => { p.fold = false; p.bet = 0; p.last = ''; p.hole = p.out ? null : [deck.pop(), deck.pop()]; });
        cap = Math.min(...P.filter(p => !p.out).map(p => p.chips)); curBet = 0;
        dealer = nextAlive(dealer); const sb = nextAlive(dealer), bb = nextAlive(sb);
        const blind = (i, v) => { const d = Math.min(v, P[i].chips, cap); P[i].chips -= d; P[i].bet = d; pot += d; curBet = Math.max(curBet, d); };
        blind(sb, 10); blind(bb, 20); render();
        await betting(nextAlive(bb)); if (!ctx.alive) return;
        for (const n of [3, 1, 1]) { if (live().length < 2) break; board.push(...deck.splice(0, n)); msg = ['', 'Тёрн', '', 'Флоп'][n] || 'Ривер'; msg = board.length === 3 ? 'Флоп' : board.length === 4 ? 'Тёрн' : 'Ривер'; render(); await sleep(400); await betting(nextAlive(dealer)); if (!ctx.alive) return; }
        const L = live(); let win;
        if (L.length === 1) { win = L; msg = L[0].n + ' забирает банк ' + pot; }
        else { showdown = true; const ev = L.map(p => ({ p, e: eval7(p.hole.concat(board)) })); ev.sort((a, b) => cmpH(b.e, a.e)); win = ev.filter(x => cmpH(x.e, ev[0].e) === 0).map(x => x.p); msg = win.map(p => p.n).join(' и ') + ': ' + HAND_N[ev[0].e[0]] + ' · банк ' + pot; }
        const share = Math.floor(pot / win.length); win.forEach(p => p.chips += share); pot = 0;
        P.forEach(p => { if (p.chips <= 0) p.out = true; }); render();
        if (P[0].out) { over = true; ctx.match('loss', 'Фишки закончились'); return; }
        if (P.slice(1).every(p => p.out)) { over = true; ctx.match('win', 'Вы обыграли всех ботов!'); return; }
        ctl.innerHTML = ''; await new Promise(r => { ctl.append(h('button', { class: 'nb', onclick: r }, 'Следующая раздача'), h('button', { class: 'nb red', onclick: () => { over = true; r(); const c = P[0].chips; ctx.match(c > 1000 ? 'win' : c < 1000 ? 'loss' : 'draw', 'Итог: ' + c + ' фишек'); } }, 'Встать из-за стола')); });
        ctl.innerHTML = '';
      }
    };
    ctx.cleanup(() => resolveHuman && resolveHuman({ t: 'fold' }));
    handLoop();
  }
});
