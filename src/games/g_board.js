/* ===== Настольные игры, часть 1 ===== */
function turnInfo(ctx, el) { const i = info(el); return t => i.innerHTML = t; }

game({
  id: 'reversi', name: 'Реверси', like: 'отелло', cat: 'board', icon: '⚫', c1: '#40916c', c2: '#081c15',
  rules: ['Ставьте фишку так, чтобы зажать ряд фишек соперника между своими — они перевернутся.', 'Можно ходить только туда, где что-то переворачивается (такие клетки подсвечены).', 'Нет ходов — пропуск. Побеждает тот, у кого больше фишек в конце.'],
  run(el, ctx) {
    const N = 8, b = Array(64).fill(0); b[27] = b[36] = 2; b[28] = b[35] = 1; let turn = 1, busy = false;
    const P = duel(ctx, ['Чёрные', 'Белые']), names = P.names;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const flips = (b, i, p) => { if (b[i]) return []; const o = [], r = i / 8 | 0, c = i % 8; for (const [dr, dc] of D) { const t = []; let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 3 - p) { t.push(rr * 8 + cc); rr += dr; cc += dc; } if (t.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === p) o.push(...t); } return o; };
    const legal = p => [...Array(64).keys()].filter(i => flips(b, i, p).length);
    const WT = [100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(8,1fr)', background: '#2d6a4f', padding: '6px', borderRadius: '14px', gap: '2px' } });
    const say = turnInfo(ctx, el); el.append(bd);
    const draw = () => {
      const L = turn ? legal(turn) : []; bd.innerHTML = '';
      b.forEach((v, i) => bd.append(h('button', { style: { background: '#40916c', borderRadius: '4px', padding: '12%' }, onclick: () => human(i) }, v ? h('div', { style: { width: '100%', height: '100%', borderRadius: '50%', background: v === 1 ? 'radial-gradient(circle at 35% 30%,#555,#111)' : 'radial-gradient(circle at 35% 30%,#fff,#ccc)', boxShadow: '0 2px 3px rgba(0,0,0,.4)' } }) : L.includes(i) && P.mine(turn - 1) ? h('div', { style: { width: '30%', height: '30%', borderRadius: '50%', background: 'rgba(255,255,255,.35)', margin: 'auto' } }) : '')));
      const c1 = b.filter(v => v === 1).length, c2 = b.filter(v => v === 2).length; ctx.score(c1 + ':' + c2);
      say(turn ? `Ходят <b>${names[turn - 1]}</b> · ⚫ ${c1} — ⚪ ${c2}` : '');
    };
    const place = (i, p) => { flips(b, i, p).forEach(j => b[j] = p); b[i] = p; };
    const next = () => {
      const o = 3 - turn;
      if (legal(o).length) turn = o; else if (!legal(turn).length) { draw(); const c1 = b.filter(v => v === 1).length, c2 = b.filter(v => v === 2).length; turn = 0; endTwo(ctx, c1 === c2 ? -1 : c1 > c2 ? 0 : 1, names); return; } else ctx.toast(names[o - 1] + ': ходов нет, пропуск');
      draw(); if (P.bot(turn - 1)) { busy = true; ctx.later(() => { const L = legal(2); const m = L.sort((a, c) => (WT[c] + flips(b, c, 2).length) - (WT[a] + flips(b, a, 2).length))[0]; place(m, 2); busy = false; next(); }, 600); }
    };
    const human = i => { if (busy || !turn || !P.mine(turn - 1)) return; if (!flips(b, i, turn).length) return; P.move({ i }, m => { place(m.i, turn); next(); }); };
    P.listen((s, a) => { if (!turn || s !== turn - 1 || !flips(b, a.i, turn).length) return; place(a.i, turn); next(); });
    draw();
  }
});

game({
  id: 'connect4', name: 'Четыре в ряд', like: 'классика', cat: 'board', icon: '🔴', c1: '#ffbe0b', c2: '#fb5607',
  rules: ['Бросайте фишки в столбцы, они падают вниз.', 'Соберите 4 своих фишки в ряд по горизонтали, вертикали или диагонали.', 'Нажмите на столбец, чтобы бросить фишку.'],
  run(el, ctx) {
    const C = 7, R = 6, b = Array(42).fill(0); let turn = 1, over = false, busy = false, lastI = -1;
    const P = duel(ctx, ['Красные', 'Жёлтые']), names = P.names;
    const win = (b, p) => { for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let k = 0; for (; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr * C + cc] !== p) break; } if (k === 4) return true; } return false; };
    const drop = (b, c, p) => { for (let r = R - 1; r >= 0; r--) if (!b[r * C + c]) { b[r * C + c] = p; return r * C + c; } return -1; };
    const evalB = b => { let s = 0; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let a = 0, o = 0; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C) { a = o = -9; break; } const v = b[rr * C + cc]; if (v === 2) a++; else if (v === 1) o++; } if (a >= 0 && o >= 0) { if (!o) s += [0, 1, 5, 40, 1000][a]; if (!a) s -= [0, 1, 6, 50, 1000][o]; } } for (let r = 0; r < R; r++) s += (b[r * C + 3] === 2 ? 3 : b[r * C + 3] === 1 ? -3 : 0); return s; };
    const mm = (b, d, al, be, max) => {
      if (win(b, 2)) return 100000 + d; if (win(b, 1)) return -100000 - d; if (!d || b.every(Boolean)) return evalB(b);
      let best = max ? -1e9 : 1e9;
      for (const c of [3, 2, 4, 1, 5, 0, 6]) { const i = drop(b, c, max ? 2 : 1); if (i < 0) continue; const v = mm(b, d - 1, al, be, !max); b[i] = 0; if (max) { best = Math.max(best, v); al = Math.max(al, v); } else { best = Math.min(best, v); be = Math.min(be, v); } if (al >= be) break; }
      return best;
    };
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: `repeat(${C},1fr)`, background: '#1d4ed8', padding: '8px', borderRadius: '16px', gap: '6px' } });
    const say = turnInfo(ctx, el); el.append(bd);
    const draw = () => { bd.innerHTML = ''; b.forEach((v, i) => bd.append(h('button', { onclick: () => human(i % C), style: { borderRadius: '50%', background: v === 1 ? 'radial-gradient(circle at 35% 30%,#ff6b6b,#d00000)' : v === 2 ? 'radial-gradient(circle at 35% 30%,#ffe066,#f4a100)' : 'var(--bg)', boxShadow: i === lastI ? '0 0 0 3px #fff' : 'inset 0 3px 4px rgba(0,0,0,.25)' } }))); say(over ? '' : `Ходят <b>${names[turn - 1]}</b>`); };
    const after = (p) => { if (win(b, p)) { over = true; draw(); endTwo(ctx, p - 1, names); return true; } if (b.every(Boolean)) { over = true; draw(); endTwo(ctx, -1, names); return true; } return false; };
    const human = c => { if (over || busy || !P.mine(turn - 1) || b[c]) return; P.move({ c }, m => doDrop(m.c)); };
    P.listen((s, a) => { if (over || s !== turn - 1 || b[a.c]) return; doDrop(a.c); });
    const doDrop = c => {
      const i = drop(b, c, turn); if (i < 0) return; lastI = i;
      if (after(turn)) return; turn = 3 - turn; draw();
      if (P.bot(turn - 1)) { busy = true; ctx.later(() => { let bc = 3, bv = -1e10; for (const c of [3, 2, 4, 1, 5, 0, 6]) { const i = drop(b, c, 2); if (i < 0) continue; const v = mm(b, 5, -1e9, 1e9, false) + Math.random(); b[i] = 0; if (v > bv) { bv = v; bc = c; } } lastI = drop(b, bc, 2); busy = false; if (after(2)) return; turn = 1; draw(); }, 350); }
    };
    draw();
  }
});

game({
  id: 'gomoku', name: 'Пять в ряд', like: 'крестики-нолики 15×15', cat: 'board', icon: '❌', c1: '#ff477e', c2: '#3a86ff',
  rules: ['Поле 15×15. Ставьте по очереди крестики и нолики.', 'Побеждает тот, кто первым выстроит 5 своих знаков подряд по горизонтали, вертикали или диагонали.', 'Крестики ходят первыми.'],
  run(el, ctx) {
    const N = 15, b = Array(N * N).fill(0); let turn = 1, over = false, busy = false, last = -1;
    const P = duel(ctx, ['Крестики', 'Нолики']), names = P.names;
    const DIR = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const line = (i, p, dr, dc) => { const r = i / N | 0, c = i % N; let n = 1, open = 0; for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === p) { n++; rr += dr * s; cc += dc * s; } if (rr >= 0 && rr < N && cc >= 0 && cc < N && !b[rr * N + cc]) open++; } return [n, open]; };
    const five = i => DIR.some(([dr, dc]) => line(i, b[i], dr, dc)[0] >= 5);
    const score = (i, p) => { let s = 0; for (const [dr, dc] of DIR) { const [n, o] = line(i, p, dr, dc); s += n >= 5 ? 1e6 : n === 4 ? (o === 2 ? 5e4 : o ? 4000 : 0) : n === 3 ? (o === 2 ? 3000 : o ? 200 : 0) : n === 2 ? (o === 2 ? 100 : o ? 10 : 0) : o; } return s; };
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: `repeat(${N},1fr)`, gap: '1px', background: '#b08968', padding: '4px', borderRadius: '10px', width: 'min(100%,460px)' } });
    const say = turnInfo(ctx, el); el.append(bd);
    const draw = () => { bd.innerHTML = ''; b.forEach((v, i) => bd.append(h('button', { onclick: () => human(i), style: { background: i === last ? '#f3d9b1' : '#e6ccb2', borderRadius: '2px', fontSize: 'min(4.6vw,22px)', lineHeight: 1, color: v === 1 ? '#d00000' : '#1d4ed8', fontWeight: 900 } }, v === 1 ? '×' : v === 2 ? '○' : ''))); say(over ? '' : `Ходят <b>${names[turn - 1]}</b>`); };
    const put = (i, p) => { b[i] = p; last = i; if (five(i)) { over = true; draw(); endTwo(ctx, p - 1, names); return true; } if (b.every(Boolean)) { over = true; draw(); endTwo(ctx, -1, names); return true; } return false; };
    const bot = () => {
      let best = -1, bv = -1;
      for (let i = 0; i < N * N; i++) { if (b[i]) continue; const r = i / N | 0, c = i % N; let near = false; for (let a = -2; a <= 2 && !near; a++) for (let d = -2; d <= 2; d++) { const rr = r + a, cc = c + d; if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc]) { near = true; break; } } if (!near) continue; b[i] = 2; const at = score(i, 2); b[i] = 1; const df = score(i, 1); b[i] = 0; const v = at * 1.1 + df + Math.random(); if (v > bv) { bv = v; best = i; } }
      if (best < 0) best = 112; return best;
    };
    const doPut = i => { if (put(i, turn)) return; turn = 3 - turn; draw(); if (P.bot(turn - 1)) { busy = true; ctx.later(() => { busy = false; if (put(bot(), 2)) return; turn = 1; draw(); }, 350); } };
    const human = i => { if (over || busy || b[i] || !P.mine(turn - 1)) return; P.move({ i }, m => doPut(m.i)); };
    P.listen((s, a) => { if (over || s !== turn - 1 || b[a.i] || a.i < 0 || a.i >= N * N) return; doPut(a.i); });
    draw();
  }
});

game({
  id: 'battleship', name: 'Морской бой', like: 'классика', cat: 'board', icon: '🚢', c1: '#4cc9f0', c2: '#03045e',
  rules: ['Флот: один 4-палубный, два 3-палубных, три 2-палубных, четыре однопалубных. Корабли не касаются друг друга.', 'Расставьте флот кнопкой «Перемешать», затем стреляйте по полю соперника.', 'Попали — стреляете ещё раз. Побеждает тот, кто первым потопит весь флот.'],
  run(el, ctx) {
    const N = 10, P = duel(ctx, ['Игрок 1', 'Игрок 2']), names = P.names, hot = P.hot;
    // расстановка случайная у каждого своя (Math.random), в онлайне флот отправляется сопернику по кнопке «Готово»
    const gen = () => { for (; ;) { const g = Array(100).fill(0), ships = []; let ok = true; for (const L of [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]) { let t = 0, placed = false; while (t++ < 200 && !placed) { const v = Math.random() < .5, r = Math.floor(Math.random() * (v ? N - L + 1 : N)), c = Math.floor(Math.random() * (v ? N : N - L + 1)); const cells = [...Array(L)].map((_, k) => (r + (v ? k : 0)) * N + c + (v ? 0 : k)); if (cells.every(i => { const rr = i / N | 0, cc = i % N; for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const x = rr + a, y = cc + d; if (x >= 0 && x < N && y >= 0 && y < N && g[x * N + y]) return false; } return true; })) { const id = ships.length + 1; cells.forEach(i => g[i] = id); ships.push(cells); placed = true; } } if (!placed) { ok = false; break; } } if (ok) return { g, ships, shot: Array(100).fill(0) }; } };
    const fromShips = ships => { const g = Array(100).fill(0); ships.forEach((c, k) => c.forEach(i => g[i] = k + 1)); return { g, ships, shot: Array(100).fill(0) }; };
    const validFleet = sh => Array.isArray(sh) && sh.length === 10 && sh.every(c => Array.isArray(c) && c.every(i => Number.isInteger(i) && i >= 0 && i < 100)) && sh.map(c => c.length).sort().join() === '1,1,1,1,2,2,2,3,3,4';
    const me = () => P.on ? Math.max(0, P.net.seat) : 0;
    const F = [gen(), gen()], ready = [false, false]; let phase = 'place', turn = 0, viewer = me(), over = false, busy = false;
    const say = turnInfo(ctx, el);
    const big = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(10,1fr)', gap: '2px', width: 'min(100%,380px)' } });
    const small = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(10,1fr)', gap: '1px', width: 'min(60%,220px)' } });
    const ctl = h('div', { class: 'bar2' }); el.append(big, ctl, small);
    const sunk = (f, id) => f.ships[id - 1].every(i => f.shot[i]);
    const shoot = (fi, i) => {
      const f = F[fi]; if (f.shot[i]) return null; f.shot[i] = 1; const id = f.g[i];
      if (id && sunk(f, id)) f.ships[id - 1].forEach(j => { const r = j / N | 0, c = j % N; for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const x = r + a, y = c + d; if (x >= 0 && x < N && y >= 0 && y < N && !f.g[x * N + y]) f.shot[x * N + y] = 1; } });
      return id ? (sunk(f, id) ? 'sunk' : 'hit') : 'miss';
    };
    const alive = f => f.ships.some(s => s.some(i => !f.shot[i]));
    const cell = (f, i, own) => { const s = f.shot[i], id = f.g[i]; return h('div', { style: { background: s && id ? (sunk(f, id) ? '#9d0208' : '#e85d04') : s ? 'color-mix(in srgb,var(--ac2) 60%,var(--card))' : own && id ? '#6c757d' : 'var(--ac2)', borderRadius: '3px', color: '#fff', fontSize: '12px' } }, s && id ? '✕' : s ? '·' : ''); };
    const draw = () => {
      big.innerHTML = ''; small.innerHTML = ''; ctl.innerHTML = '';
      if (phase === 'place') {
        F[viewer].g.forEach((_, i) => big.append(cell(F[viewer], i, true)));
        if (P.on && ready[viewer]) { say('Флот готов. Ждём, пока расставит соперник…'); return; }
        ctl.append(h('button', { class: 'nb', type: 'button', onclick: () => { F[viewer] = gen(); draw(); } }, '🔀 Перемешать'), h('button', { class: 'nb', type: 'button', style: { background: 'var(--ac)', color: '#fff' }, onclick: done }, 'Готово'));
        say(`<b>${P.on ? 'Вы' : names[viewer]}</b>, расставьте флот`); return;
      }
      const enemy = F[1 - viewer];
      enemy.g.forEach((_, i) => { const c = cell(enemy, i, over); c.style.cursor = 'pointer'; c.onclick = () => fire(i); big.append(c); });
      F[viewer].g.forEach((_, i) => small.append(cell(F[viewer], i, true)));
      say(over ? '' : (turn === viewer ? `<b>${P.on ? 'Ваш выстрел' : names[viewer] + ', стреляйте'}</b> по полю соперника` : 'Стреляет ' + names[turn]) + ' · внизу — ваш флот');
    };
    const startWar = () => { phase = 'war'; turn = 0; draw(); };
    const done = () => {
      if (P.on) { P.net.send({ fleet: F[viewer].ships }); return; }
      if (hot && viewer === 0) { viewer = 1; draw(); passScreen(el, names[1], draw); return; }
      viewer = 0; phase = 'war'; turn = 0; if (hot) { draw(); passScreen(el, names[0], draw); } else draw();
    };
    const applyShot = (s, i) => {
      const r = shoot(1 - s, i); if (!r) return;
      if (r !== 'miss') ctx.toast(r === 'sunk' ? 'Потоплен!' : 'Попал!', 800);
      if (!alive(F[1 - s])) { over = true; draw(); endTwo(ctx, s, names); return; }
      if (r === 'miss') turn = 1 - s;
      draw();
    };
    const fire = i => {
      if (over || busy || turn !== viewer || phase !== 'war' || F[1 - turn].shot[i]) return;
      if (P.on) { P.move({ i }, () => { }); return; }
      const r = shoot(1 - turn, i); if (!r) return;
      if (r !== 'miss') ctx.toast(r === 'sunk' ? 'Потоплен!' : 'Попал!', 800);
      if (!alive(F[1 - turn])) { over = true; draw(); endTwo(ctx, turn, names); return; }
      if (r === 'miss') { busy = true; draw(); ctx.later(() => { busy = false; turn = 1 - turn; if (hot) { viewer = turn; draw(); passScreen(el, names[turn], draw); } else botTurn(); }, 700); } else draw();
    };
    P.listen((s, a) => {
      if (a.fleet) { if (phase !== 'place' || ready[s] || !validFleet(a.fleet)) return; F[s] = fromShips(a.fleet); ready[s] = true; if (ready[0] && ready[1]) startWar(); else draw(); return; }
      if (phase === 'war' && !over && s === turn && Number.isInteger(a.i) && a.i >= 0 && a.i < 100) applyShot(s, a.i);
    });
    if (P.on) P.net.onRoom(() => { const v = me(); if (v !== viewer) { viewer = v; draw(); } });
    let hunt = [];
    const botTurn = () => {
      const f = F[0]; let i;
      hunt = hunt.filter(j => !f.shot[j]);
      if (hunt.length) i = hunt.shift(); else { const free = [...Array(100).keys()].filter(j => !f.shot[j] && ((j / 10 | 0) + j) % 2 === 0); i = free.length ? pick(free) : [...Array(100).keys()].find(j => !f.shot[j]); }
      const r = shoot(0, i); draw();
      if (r === 'hit') { const rr = i / N | 0, c = i % N; hunt.unshift(...[[rr - 1, c], [rr + 1, c], [rr, c - 1], [rr, c + 1]].filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N).map(([a, b]) => a * N + b)); }
      if (r === 'sunk') hunt = [];
      if (!alive(f)) { over = true; draw(); endTwo(ctx, 1, names); return; }
      if (r === 'miss') { turn = 0; draw(); } else ctx.later(botTurn, 650);
    };
    draw();
  }
});

/* --- Русские шашки --- */
function ckMoves(b, side) { // b: 64, 1/2 белые простые/дамки, -1/-2 чёрные
  const own = v => side > 0 ? v > 0 : v < 0, opp = v => side > 0 ? v < 0 : v > 0, fwd = side > 0 ? -1 : 1;
  const caps = [], steps = [];
  const rec = (b, i, king, path, taken) => {
    let found = false; const r = i >> 3, c = i & 7;
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (king) {
        let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !b[rr * 8 + cc]) { rr += dr; cc += dc; }
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && opp(b[rr * 8 + cc]) && !taken.includes(rr * 8 + cc)) {
          const t = rr * 8 + cc; let lr = rr + dr, lc = cc + dc;
          while (lr >= 0 && lr < 8 && lc >= 0 && lc < 8 && !b[lr * 8 + lc]) { found = true; const L = lr * 8 + lc; const nb = b.slice(); nb[L] = nb[i]; nb[i] = 0; rec(nb, L, true, path.concat(L), taken.concat(t)); lr += dr; lc += dc; }
        }
      } else {
        const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
        if (lr >= 0 && lr < 8 && lc >= 0 && lc < 8 && opp(b[mr * 8 + mc]) && !taken.includes(mr * 8 + mc) && !b[lr * 8 + lc]) {
          found = true; const L = lr * 8 + lc, nb = b.slice(); nb[L] = nb[i]; nb[i] = 0; const kg = side > 0 ? lr === 0 : lr === 7; rec(nb, L, kg, path.concat(L), taken.concat(mr * 8 + mc));
        }
      }
    }
    if (!found && taken.length) caps.push({ path, taken });
  };
  for (let i = 0; i < 64; i++) if (own(b[i])) {
    const king = Math.abs(b[i]) === 2; rec(b, i, king, [i], []);
    if (!caps.length) for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { if (!king && dr !== fwd) continue; let rr = (i >> 3) + dr, cc = (i & 7) + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !b[rr * 8 + cc]) { steps.push({ path: [i, rr * 8 + cc], taken: [] }); if (!king) break; rr += dr; cc += dc; } }
  }
  return caps.length ? caps : steps;
}
function ckApply(b, m, side) { const nb = b.slice(); const from = m.path[0], to = m.path[m.path.length - 1]; let v = nb[from]; nb[from] = 0; m.taken.forEach(t => nb[t] = 0); if (m.path.some(p => side > 0 ? p >> 3 === 0 : p >> 3 === 7)) v = side * 2; nb[to] = v; return nb; }
game({
  id: 'checkers', name: 'Шашки', like: 'русские', cat: 'board', icon: '⛀', c1: '#d4a373', c2: '#6f4518',
  rules: ['Простая шашка ходит по диагонали вперёд на одну клетку, бьёт и вперёд, и назад.', 'Бить обязательно. Если после взятия можно бить дальше — бой продолжается.', 'Дошла до последней горизонтали — становится дамкой и ходит на любое расстояние.', 'Выберите шашку, затем клетку. Для боя нажимайте клетки по очереди.'],
  run(el, ctx) {
    let b = Array(64).fill(0); for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7; if ((r + c) % 2) { if (r < 3) b[i] = -1; if (r > 4) b[i] = 1; } }
    let side = 1, sel = null, part = [], over = false, busy = false;
    const P = duel(ctx, ['Белые', 'Чёрные']), names = P.names, pi = () => side > 0 ? 0 : 1, flip = P.on && P.net.seat === 1;
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(8,1fr)', gap: 0, borderRadius: '10px', overflow: 'hidden', border: '6px solid var(--board2)' } });
    const say = turnInfo(ctx, el); el.append(bd);
    const evalB = b => b.reduce((s, v) => s + (v === -1 ? 1 : v === -2 ? 3.2 : v === 1 ? -1 : v === 2 ? -3.2 : 0), 0);
    const mm = (b, d, s, al, be) => { const ms = ckMoves(b, s); if (!ms.length) return s < 0 ? -100 : 100; if (!d) return evalB(b); let best = s < 0 ? -1e9 : 1e9; for (const m of ms) { const v = mm(ckApply(b, m, s), d - 1, -s, al, be); if (s < 0) { best = Math.max(best, v); al = Math.max(al, v); } else { best = Math.min(best, v); be = Math.min(be, v); } if (al >= be) break; } return best; };
    const draw = () => {
      const ms = ckMoves(b, side), cand = sel != null ? ms.filter(m => m.path[0] === sel && part.every((p, k) => m.path[k + 1] === p)) : [];
      const tgt = new Set(cand.map(m => m.path[part.length + 1]));
      const movable = new Set(ms.map(m => m.path[0]));
      bd.innerHTML = '';
      (flip ? b.map((_, k) => 63 - k) : b.map((_, k) => k)).forEach(i => { const v = b[i]; const dark = ((i >> 3) + (i & 7)) % 2; bd.append(h('button', { onclick: () => tap(i), style: { aspectRatio: 1, borderRadius: 0, background: i === sel ? '#c9a227' : tgt.has(i) ? '#7a9e3d' : dark ? 'var(--board2)' : 'var(--board)', padding: '10%' } }, v ? h('div', { style: { width: '100%', height: '100%', borderRadius: '50%', background: v > 0 ? 'radial-gradient(circle at 35% 30%,#fff,#d8d2c4)' : 'radial-gradient(circle at 35% 30%,#555,#111)', boxShadow: '0 3px 0 rgba(0,0,0,.35)' + (P.mine(pi()) && movable.has(i) && sel == null && !over ? ',0 0 0 2px #ffd166' : ''), display: 'grid', placeItems: 'center', color: v > 0 ? '#a07800' : '#ffd166', fontSize: '16px' } }, Math.abs(v) === 2 ? '♛' : '') : '')); });
      say(over ? '' : `Ходят <b>${names[side > 0 ? 0 : 1]}</b>` + (ms[0] && ms[0].taken.length ? ' · бить обязательно' : ''));
    };
    const finishMove = m => { b = ckApply(b, m, side); sel = null; part = []; side = -side; const ms = ckMoves(b, side); if (!ms.length) { over = true; draw(); endTwo(ctx, side > 0 ? 1 : 0, names); return; } draw(); if (P.bot(pi())) { busy = true; ctx.later(botMove, 500); } };
    const botMove = () => { const ms = ckMoves(b, -1); let best = ms[0], bv = -1e9; for (const m of ms) { const v = mm(ckApply(b, m, -1), 4, 1, -1e9, 1e9) + Math.random() * .3; if (v > bv) { bv = v; best = m; } } busy = false; finishMove(best); };
    const tap = i => {
      if (over || busy || !P.mine(pi())) return;
      const ms = ckMoves(b, side);
      if (sel == null || (part.length === 0 && ms.some(m => m.path[0] === i))) { if (ms.some(m => m.path[0] === i)) { sel = i; part = []; } draw(); return; }
      const cand = ms.filter(m => m.path[0] === sel && part.every((p, k) => m.path[k + 1] === p) && m.path[part.length + 1] === i);
      if (!cand.length) { sel = null; part = []; draw(); return; }
      part.push(i); const full = cand.find(m => m.path.length === part.length + 1);
      if (full && (cand.length === 1 || cand.every(m => m.path.length === part.length + 1))) P.move({ path: full.path }, a => finishMove(full)); else draw();
    };
    P.listen((s, a) => { if (over || s !== pi()) return; const m = ckMoves(b, side).find(x => x.path.join() === (a.path || []).join()); if (m) finishMove(m); });
    draw();
  }
});
