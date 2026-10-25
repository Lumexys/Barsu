/* ===== Настольные игры, часть 2: шахматы, нарды, бильярд ===== */
const CH = (() => {
  const V = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const isW = p => p && p === p.toUpperCase(), side = p => p ? (isW(p) ? 'w' : 'b') : null;
  const N8 = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], K8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const init = () => { const r = 'rnbqkbnr'; const b = Array(64).fill(''); for (let c = 0; c < 8; c++) { b[c] = r[c]; b[8 + c] = 'p'; b[48 + c] = 'P'; b[56 + c] = r[c].toUpperCase(); } return { b, t: 'w', cs: { K: 1, Q: 1, k: 1, q: 1 }, ep: -1 }; };
  const attacked = (b, sq, by) => {
    const r = sq >> 3, c = sq & 7, at = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null;
    const pr = by === 'w' ? r + 1 : r - 1; for (const dc of [-1, 1]) if (at(pr, c + dc) === (by === 'w' ? 'P' : 'p')) return true;
    for (const [a, d] of N8) if (at(r + a, c + d) === (by === 'w' ? 'N' : 'n')) return true;
    for (const [a, d] of K8) if (at(r + a, c + d) === (by === 'w' ? 'K' : 'k')) return true;
    for (const [dirs, ps] of [[DIAG, 'bq'], [ORTH, 'rq']]) for (const [a, d] of dirs) { let rr = r + a, cc = c + d; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const p = b[rr * 8 + cc]; if (p) { if (side(p) === by && ps.includes(p.toLowerCase())) return true; break; } rr += a; cc += d; } }
    return false;
  };
  const kingSq = (b, s) => b.indexOf(s === 'w' ? 'K' : 'k');
  const pseudo = st => {
    const { b, t } = st, ms = [], opp = t === 'w' ? 'b' : 'w';
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || side(p) !== t) continue; const r = i >> 3, c = i & 7, k = p.toLowerCase();
      const add = (to, x = {}) => ms.push({ f: i, t: to, p, cap: b[to], ...x });
      if (k === 'p') {
        const d = t === 'w' ? -1 : 1, r1 = r + d, last = t === 'w' ? 0 : 7;
        if (r1 >= 0 && r1 < 8 && !b[r1 * 8 + c]) { add(r1 * 8 + c, r1 === last ? { pr: 1 } : {}); if ((t === 'w' ? r === 6 : r === 1) && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c, { dbl: 1 }); }
        for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7 || r1 < 0 || r1 > 7) continue; const to = r1 * 8 + cc; if (b[to] && side(b[to]) === opp) add(to, r1 === last ? { pr: 1 } : {}); else if (to === st.ep) add(to, { epc: 1, cap: t === 'w' ? 'p' : 'P' }); }
      } else if (k === 'n' || k === 'k') {
        for (const [a, d] of k === 'n' ? N8 : K8) { const rr = r + a, cc = c + d; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const to = rr * 8 + cc; if (!b[to] || side(b[to]) === opp) add(to); }
        if (k === 'k') {
          const row = t === 'w' ? 56 : 0; const cs = st.cs;
          if (i === row + 4 && !attacked(b, i, opp)) {
            if (cs[t === 'w' ? 'K' : 'k'] && !b[row + 5] && !b[row + 6] && !attacked(b, row + 5, opp) && !attacked(b, row + 6, opp)) add(row + 6, { castle: 'k' });
            if (cs[t === 'w' ? 'Q' : 'q'] && !b[row + 3] && !b[row + 2] && !b[row + 1] && !attacked(b, row + 3, opp) && !attacked(b, row + 2, opp)) add(row + 2, { castle: 'q' });
          }
        }
      } else {
        const dirs = k === 'b' ? DIAG : k === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [a, d] of dirs) { let rr = r + a, cc = c + d; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const to = rr * 8 + cc; if (b[to]) { if (side(b[to]) === opp) add(to); break; } add(to); rr += a; cc += d; } }
      }
    }
    return ms;
  };
  const make = (st, m) => {
    const b = st.b.slice(), t = st.t, cs = { ...st.cs };
    b[m.t] = m.pr ? (t === 'w' ? 'Q' : 'q') : m.p; b[m.f] = '';
    if (m.epc) b[m.t + (t === 'w' ? 8 : -8)] = '';
    if (m.castle) { const row = t === 'w' ? 56 : 0; if (m.castle === 'k') { b[row + 5] = b[row + 7]; b[row + 7] = ''; } else { b[row + 3] = b[row]; b[row] = ''; } }
    if (m.p === 'K') cs.K = cs.Q = 0; if (m.p === 'k') cs.k = cs.q = 0;
    [[56, 'Q'], [63, 'K'], [0, 'q'], [7, 'k']].forEach(([s, k]) => { if (m.f === s || m.t === s) cs[k] = 0; });
    return { b, t: t === 'w' ? 'b' : 'w', cs, ep: m.dbl ? (m.f + m.t) / 2 : -1 };
  };
  const legal = st => pseudo(st).filter(m => { const n = make(st, m); return !attacked(n.b, kingSq(n.b, st.t), n.t); });
  const inCheck = st => attacked(st.b, kingSq(st.b, st.t), st.t === 'w' ? 'b' : 'w');
  const evalS = b => { let s = 0; for (let i = 0; i < 64; i++) { const p = b[i]; if (!p) continue; const k = p.toLowerCase(), r = i >> 3, c = i & 7; let v = V[k]; const cen = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c)); if (k === 'n' || k === 'b') v += cen * 8; if (k === 'p') v += (isW(p) ? 6 - r : r - 1) * 6 + (c > 1 && c < 6 ? 6 : 0); if (k === 'q') v += cen * 3; s += isW(p) ? v : -v; } return s; };
  const search = (st, d, al, be) => {
    if (!d) return (st.t === 'w' ? 1 : -1) * evalS(st.b);
    const ms = legal(st);
    if (!ms.length) return inCheck(st) ? -99999 - d : 0;
    ms.sort((a, b) => (b.cap ? V[b.cap.toLowerCase()] : 0) - (a.cap ? V[a.cap.toLowerCase()] : 0));
    for (const m of ms) { const v = -search(make(st, m), d - 1, -be, -al); if (v > al) al = v; if (al >= be) break; }
    return al;
  };
  const best = (st, d) => { const ms = shuffle(legal(st)); let bm = ms[0], bv = -1e9; ms.sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0)); for (const m of ms) { const v = -search(make(st, m), d - 1, -1e9, -bv); if (v > bv) { bv = v; bm = m; } } return bm; };
  return { init, legal, make, inCheck, best, isW };
})();
game({
  id: 'chess', name: 'Шахматы', like: 'классика', cat: 'board', icon: '♞', c1: '#adb5bd', c2: '#212529',
  rules: ['Полные правила: рокировка, взятие на проходе, превращение пешки (всегда в ферзя).', 'Нажмите фигуру — подсветятся возможные ходы.', 'Бот думает на 3 полухода вперёд — уровень новичка.', 'Мат — победа, пат — ничья.'],
  run(el, ctx) {
    let st = CH.init(), sel = null, last = null, over = false, busy = false;
    const P = duel(ctx, ['Белые', 'Чёрные']), names = P.names, side = () => st.t === 'w' ? 0 : 1, flip = P.on && P.net.seat === 1;
    const GL = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(8,1fr)', gap: 0, border: '6px solid var(--board2)', borderRadius: '10px', overflow: 'hidden' } });
    const say = turnInfo(ctx, el); el.append(bd);
    const draw = () => {
      const L = sel != null ? CH.legal(st).filter(m => m.f === sel) : [], tg = new Set(L.map(m => m.t)); const chk = CH.inCheck(st) ? st.b.indexOf(st.t === 'w' ? 'K' : 'k') : -1;
      bd.innerHTML = '';
      (flip ? st.b.map((_, k) => 63 - k) : st.b.map((_, k) => k)).forEach(i => { const p = st.b[i]; const dark = ((i >> 3) + (i & 7)) % 2; bd.append(h('button', { onclick: () => tap(i), style: { aspectRatio: 1, borderRadius: 0, position: 'relative', background: i === sel ? '#c9a227' : i === chk ? '#e5484d' : last && (i === last.f || i === last.t) ? (dark ? '#a8a24a' : '#d6d27a') : dark ? 'var(--board2)' : 'var(--board)', fontSize: 'min(8.5vw,40px)', lineHeight: 1, color: p && CH.isW(p) ? '#fff' : '#111', textShadow: p && CH.isW(p) ? '0 0 2px #000,0 0 1px #000,0 1px 2px rgba(0,0,0,.6)' : '0 0 1px rgba(255,255,255,.4)' } }, p ? GL[p.toLowerCase()] + '︎' : '', tg.has(i) ? h('span', { style: { position: 'absolute', inset: p ? '4%' : '36%', borderRadius: '50%', background: p ? 'transparent' : 'rgba(0,0,0,.25)', boxShadow: p ? 'inset 0 0 0 4px rgba(0,0,0,.3)' : '' } }) : null)); });
      say(over ? '' : `Ходят <b>${st.t === 'w' ? names[0] : names[1]}</b>` + (chk >= 0 ? ' · <b style="color:var(--rd)">шах!</b>' : '') + (busy ? ' · бот думает…' : ''));
    };
    const check = () => { const L = CH.legal(st); if (!L.length) { over = true; draw(); if (CH.inCheck(st)) endTwo(ctx, st.t === 'w' ? 1 : 0, names); else endTwo(ctx, -1, names); return true; } return false; };
    const move = m => { st = CH.make(st, m); last = m; sel = null; if (check()) return; draw(); if (P.bot(1) && st.t === 'b') { busy = true; draw(); ctx.later(() => { const bm = CH.best(st, 3); busy = false; move(bm); }, 60); } };
    const tap = i => {
      if (over || busy || !P.mine(side())) return;
      if (sel != null) { const m = CH.legal(st).find(m => m.f === sel && m.t === i); if (m) return P.move({ f: m.f, t: m.t }, () => move(m)); }
      sel = st.b[i] && (CH.isW(st.b[i]) ? 'w' : 'b') === st.t ? i : null; draw();
    };
    P.listen((s, a) => { if (over || s !== side()) return; const m = CH.legal(st).find(m => m.f === a.f && m.t === a.t); if (m) move(m); });
    draw();
  }
});

/* --- Длинные нарды --- */
game({
  id: 'nardy', name: 'Нарды', like: 'длинные', cat: 'board', icon: '🎲', c1: '#bc6c25', c2: '#283618',
  rules: ['У каждого 15 шашек на «голове». Обе стороны ходят против часовой стрелки, белые — снизу справа.', 'Бросьте кости и переставляйте шашки на выпавшее число пунктов. Дубль — 4 хода.', 'Нельзя ставить шашку на пункт, где стоит хотя бы одна шашка соперника.', 'С головы за ход можно снять одну шашку (в первый ход при дублях 6-6, 4-4, 3-3 — две).', 'Когда все 15 шашек в доме (последняя четверть пути), их можно выбрасывать. Кто первым выбросил все — победил.', 'Упрощение прототипа: не проверяется правило «шести пунктов подряд» и обязательность хода большим числом.'],
  run(el, ctx) {
    const own = Array(24).fill(-1), cnt = Array(24).fill(0), off = [0, 0];
    const pt = (p, t) => p === 0 ? t : (t + 12) % 24, tr = (p, x) => p === 0 ? x : (x + 12) % 24;
    own[pt(0, 0)] = 0; cnt[pt(0, 0)] = 15; own[pt(1, 0)] = 1; cnt[pt(1, 0)] = 15;
    const P = duel(ctx, ['Белые', 'Чёрные']), hot = P.hot, names = P.names;
    let turn = 0, dice = [], rolled = [], headTaken = 0, headLimit = 1, first = [true, true], sel = null, over = false;
    const allHome = p => { let n = off[p]; for (let x = 0; x < 24; x++) if (own[x] === p && tr(p, x) >= 18) n += cnt[x]; return n === 15; };
    const minTrack = p => { let m = 99; for (let x = 0; x < 24; x++) if (own[x] === p) m = Math.min(m, tr(p, x)); return m; };
    const can = (p, t, d) => {
      if (t === 0 && headTaken >= headLimit) return null;
      const nt = t + d;
      if (nt < 24) { const x = pt(p, nt); return own[x] === 1 - p ? null : nt; }
      if (!allHome(p)) return null;
      return nt === 24 || t === minTrack(p) ? 'off' : null;
    };
    const moves = p => { const o = []; for (const d of new Set(dice)) for (let x = 0; x < 24; x++) if (own[x] === p) { const t = tr(p, x), r = can(p, t, d); if (r != null) o.push({ t, d, to: r }); } return o; };
    const apply = (p, m) => {
      const x = pt(p, m.t); cnt[x]--; if (!cnt[x]) own[x] = -1; if (m.t === 0) headTaken++;
      if (m.to === 'off') off[p]++; else { const y = pt(p, m.to); own[y] = p; cnt[y]++; }
      dice.splice(dice.indexOf(m.d), 1);
    };
    const wrap = h('div', { style: { width: 'min(100%,460px)', background: '#6b4423', borderRadius: '16px', padding: '8px', display: 'grid', gap: '8px' } });
    const say = turnInfo(ctx, el); el.append(wrap); const ctl = h('div', { class: 'bar2' }); el.append(ctl);
    const point = (x, top) => {
      const tgts = sel != null ? moves(turn).filter(m => m.t === sel && m.to !== 'off').map(m => pt(turn, m.to)) : [];
      const isSel = sel != null && pt(turn, sel) === x;
      const d = h('button', { onclick: () => tap(x), style: { position: 'relative', height: '150px', display: 'flex', flexDirection: top ? 'column' : 'column-reverse', alignItems: 'center', padding: '2px 0', gap: '1px', borderRadius: 0, background: tgts.includes(x) ? 'rgba(122,158,61,.55)' : isSel ? 'rgba(201,162,39,.5)' : 'transparent' } });
      d.append(h('div', { style: { position: 'absolute', inset: 0, background: x % 2 ? '#e9c46a' : '#9c2a1f', clipPath: top ? 'polygon(0 0,100% 0,50% 100%)' : 'polygon(50% 0,100% 100%,0 100%)', opacity: .9, zIndex: 0 } }));
      const n = cnt[x]; for (let k = 0; k < Math.min(n, 6); k++) d.append(h('div', { style: { width: '88%', aspectRatio: 1, borderRadius: '50%', zIndex: 1, background: own[x] === 0 ? 'radial-gradient(circle at 35% 30%,#fff,#d6cfc0)' : 'radial-gradient(circle at 35% 30%,#555,#111)', boxShadow: '0 1px 2px rgba(0,0,0,.5)', fontSize: '10px', fontWeight: 800, display: 'grid', placeItems: 'center', color: own[x] === 0 ? '#333' : '#fff', marginTop: top && k ? '-4px' : 0, marginBottom: !top && k ? '-4px' : 0 } }, k === 5 && n > 6 ? n : ''));
      return d;
    };
    const draw = () => {
      wrap.innerHTML = '';
      const row = top => { const r = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr) 8px repeat(6,1fr)', background: '#d4a373', borderRadius: '8px' } }); const xs = top ? [...Array(12)].map((_, i) => 12 + i) : [...Array(12)].map((_, i) => 11 - i); xs.forEach((x, i) => { if (i === 6) r.append(h('div', { style: { background: '#6b4423' } })); r.append(point(x, top)); }); return r; };
      const mid = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: '13px', padding: '0 6px' } }, h('span', null, '⚫ выброшено ' + off[1]), h('span', { style: { fontSize: '26px', letterSpacing: '4px' } }, rolled.map(v => '⚀⚁⚂⚃⚄⚅'[v - 1]).join('')), h('span', null, '⚪ выброшено ' + off[0]));
      wrap.append(row(true), mid, row(false));
      ctl.innerHTML = '';
      const human = !over && P.mine(turn) && !rolling;
      if (human && !dice.length) ctl.append(h('button', { class: 'nb', type: 'button', style: { background: 'var(--ac)', color: '#fff' }, onclick: () => P.move({ roll: 1 }, roll) }, '🎲 Бросить кости'));
      if (human && sel != null && moves(turn).some(m => m.t === sel && m.to === 'off')) ctl.append(h('button', { class: 'nb', type: 'button', style: { background: 'var(--ok)', color: '#fff' }, onclick: () => { const m = moves(turn).filter(m => m.t === sel && m.to === 'off').sort((a, b) => a.d - b.d)[0]; P.move({ mv: [m.t, m.d] }, () => { apply(turn, m); sel = null; after(); }); } }, 'Выбросить шашку'));
      say(over ? '' : `Ходят <b>${names[turn]}</b>` + (dice.length ? ' · осталось ходов: ' + dice.length : ''));
    };
    const roll = () => {
      const a = 1 + rnd(6), b = 1 + rnd(6); rolled = [a, b]; dice = a === b ? [a, a, a, a] : [a, b]; headTaken = 0;
      headLimit = first[turn] && a === b && [6, 4, 3].includes(a) ? 2 : 1; first[turn] = false;
      if (!moves(turn).length) { ctx.toast(names[turn] + ': ходов нет'); dice = []; rolling = true; draw(); ctx.later(pass, 900); return; }
      draw(); if (P.bot(turn)) ctx.later(botStep, 600);
    };
    let rolling = false;
    const pass = () => { rolling = false; turn = 1 - turn; dice = []; sel = null; draw(); if (P.bot(turn)) ctx.later(roll, 700); };
    const after = () => { if (off[turn] === 15) { over = true; draw(); endTwo(ctx, turn, names); return; } if (!dice.length || !moves(turn).length) { rolling = true; draw(); ctx.later(pass, 600); return; } draw(); if (P.bot(turn)) ctx.later(botStep, 450); };
    const botStep = () => { const ms = moves(1); if (!ms.length) return after(); const m = ms.sort((a, b) => (b.to === 'off') - (a.to === 'off') || (b.t === 0) - (a.t === 0) || a.t - b.t + (Math.random() - .5) * 6)[0]; apply(1, m); after(); };
    const tap = x => {
      if (over || !dice.length || !P.mine(turn) || rolling) return;
      if (sel != null) { const m = moves(turn).find(m => m.t === sel && m.to !== 'off' && pt(turn, m.to) === x); if (m) { P.move({ mv: [m.t, m.d] }, () => { apply(turn, m); sel = null; after(); }); return; } }
      sel = own[x] === turn && moves(turn).some(m => m.t === tr(turn, x)) ? tr(turn, x) : null; draw();
    };
    P.listen((s, a) => {
      if (over || s !== turn || rolling) return;
      if (a.roll && !dice.length) { roll(); return; }
      if (a.mv && dice.length) { const m = moves(turn).find(m => m.t === a.mv[0] && m.d === a.mv[1]); if (m) { apply(turn, m); sel = null; after(); } }
    });
    if (P.on && P.net.seat === 1) ctx.toast('Вы играете чёрными', 2500);
    draw();
  }
});

/* --- Бильярд (американка) --- */
game({
  id: 'billiards', name: 'Бильярд', like: 'американка', cat: 'board', icon: '🎱', c1: '#2d6a4f', c2: '#1b263b',
  rules: ['Забивайте любые шары, кроме белого. Кто первым забьёт 8 шаров — победил.', 'Оттяните палец от белого шара назад, как рогатку, и отпустите. Чем дальше оттянули — тем сильнее удар.', 'Забили — бьёте ещё раз. Не забили или забили белый — ход переходит.'],
  run(el, ctx) {
    const W = 320, H = 580, M = 22, R = 9, PR = 16, [c, x] = canvas(el, W, H);
    const pockets = [[M, M], [W - M, M], [M, H / 2], [W - M, H / 2], [M, H - M], [W - M, H - M]];
    const balls = [{ x: W / 2, y: H * .75, vx: 0, vy: 0, cue: 1 }];
    let k = 0; for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) balls.push({ x: W / 2 + (i - row / 2) * (R * 2 + .5), y: H * .28 - row * (R * 1.75), vx: 0, vy: 0, n: ++k });
    const P = duel(ctx, ['Игрок 1', 'Игрок 2']), hot = P.hot, names = P.names;
    let turn = 0, score = [0, 0], moving = false, aim = null, potted = [], cueIn = false, over = false, waitSync = false;
    const say = turnInfo(ctx, el);
    const cue = () => balls[0];
    const stopped = () => balls.every(b => b.in || Math.hypot(b.vx, b.vy) < 2);
    const shoot = (dx, dy, pw) => { const L = Math.hypot(dx, dy) || 1; cue().vx = dx / L * pw; cue().vy = dy / L * pw; moving = true; potted = []; cueIn = false; };
    ctx.on(c, 'pointerdown', e => { if (moving || over || waitSync || !P.mine(turn)) return; aim = c.pos(e); c.setPointerCapture(e.pointerId); });
    ctx.on(c, 'pointermove', e => { if (aim) aim = c.pos(e); });
    ctx.on(c, 'pointerup', e => { if (!aim) return; const p = c.pos(e), dx = cue().x - p.x, dy = cue().y - p.y, d = Math.hypot(dx, dy); aim = null; if (d < 12) return; const pw = Math.min(d, 170) / 170 * 1100; P.move({ shot: [dx, dy, pw] }, () => shoot(dx, dy, pw)); });
    // онлайн: удар применяется у всех, а итог (положение шаров, счёт) присылает тот, кто бил
    P.listen((s, a) => {
      if (a.shot && s === turn && !moving && !waitSync) { shoot(a.shot[0], a.shot[1], a.shot[2]); shooter = s; return; }
      if (a.sync && s !== (P.on ? P.net.seat : -1)) { a.sync.b.forEach(([bx, by, bin], k) => { const b = balls[k]; if (b) { b.x = bx; b.y = by; b.in = !!bin; b.vx = b.vy = 0; } }); moving = false; score = a.sync.score; turn = a.sync.turn; waitSync = false; if (a.sync.win != null) { over = true; endTwo(ctx, a.sync.win, names); } }
    });
    let shooter = -1;
    const botShot = () => {
      let best = null;
      for (const b of balls) { if (b.cue || b.in) continue; for (const [px, py] of pockets) { const dx = px - b.x, dy = py - b.y, L = Math.hypot(dx, dy); const gx = b.x - dx / L * R * 2, gy = b.y - dy / L * R * 2; const ax = gx - cue().x, ay = gy - cue().y, AL = Math.hypot(ax, ay); const cos = (ax * dx + ay * dy) / (AL * L); if (cos < .35) continue; const v = cos * 2 - (AL + L) / 600; if (!best || v > best.v) best = { v, ax, ay, d: AL + L }; } }
      if (!best) { const t = balls.find(b => !b.cue && !b.in); best = { ax: t.x - cue().x, ay: t.y - cue().y, d: 300 }; }
      const ang = Math.atan2(best.ay, best.ax) + (Math.random() - .5) * .06;
      shoot(Math.cos(ang), Math.sin(ang), clamp(350 + best.d * 1.3, 450, 1050));
    };
    ctx.loop(dt => {
      if (moving) {
        for (let s = 0; s < 4; s++) {
          const h0 = dt / 4;
          for (const b of balls) {
            if (b.in) continue; b.x += b.vx * h0; b.y += b.vy * h0; const sp = Math.hypot(b.vx, b.vy); if (sp > 0) { const f = Math.max(0, sp - 160 * h0) / sp; b.vx *= f; b.vy *= f; }
            if (pockets.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < PR)) { b.in = true; b.vx = b.vy = 0; if (b.cue) cueIn = true; else potted.push(b); continue; }
            if (b.x < M + R) { b.x = M + R; b.vx = Math.abs(b.vx) * .8; } if (b.x > W - M - R) { b.x = W - M - R; b.vx = -Math.abs(b.vx) * .8; }
            if (b.y < M + R) { b.y = M + R; b.vy = Math.abs(b.vy) * .8; } if (b.y > H - M - R) { b.y = H - M - R; b.vy = -Math.abs(b.vy) * .8; }
          }
          for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i], b = balls[j]; if (a.in || b.in) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d < R * 2 && d > 0) { const nx = dx / d, ny = dy / d, ov = (R * 2 - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (p > 0) { a.vx -= p * nx * .97; a.vy -= p * ny * .97; b.vx += p * nx * .97; b.vy += p * ny * .97; } }
          }
        }
        if (stopped()) {
          moving = false; balls.forEach(b => { if (!b.in) b.vx = b.vy = 0; });
          if (cueIn) { const cb = cue(); cb.in = false; cb.x = W / 2; cb.y = H * .75; while (balls.some(b => b !== cb && !b.in && Math.hypot(b.x - cb.x, b.y - cb.y) < R * 2)) cb.y -= R * 2; }
          if (P.on && shooter !== P.net.seat) { waitSync = true; return; } // ждём итог от того, кто бил
          const was = turn;
          score[turn] += potted.length;
          if (score[turn] >= 8) { over = true; endTwo(ctx, turn, names); }
          else if (!potted.length || cueIn) { turn = 1 - turn; if (cueIn) ctx.toast('Белый в лузе — переход хода', 1200); }
          else ctx.toast('Забит! Бьёте ещё', 900);
          if (P.on) P.net.send({ sync: { b: balls.map(b => [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, b.in ? 1 : 0]), score, turn, win: over ? was : null } });
          if (!over && P.bot(turn)) ctx.later(botShot, 900);
        }
      }
      x.fillStyle = '#5c3a1e'; rr(x, 0, 0, W, H, 18); x.fill();
      x.fillStyle = '#1f7a4d'; x.fillRect(M, M, W - 2 * M, H - 2 * M);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(M, H * .75, W - 2 * M, 1);
      pockets.forEach(([px, py]) => { x.fillStyle = '#111'; x.beginPath(); x.arc(px, py, PR, 0, 7); x.fill(); });
      if (aim && !moving) { const cb = cue(), dx = cb.x - aim.x, dy = cb.y - aim.y, d = Math.hypot(dx, dy) || 1, pw = Math.min(d, 170) / 170; x.strokeStyle = 'rgba(255,255,255,.55)'; x.setLineDash([6, 6]); x.lineWidth = 2; x.beginPath(); x.moveTo(cb.x, cb.y); x.lineTo(cb.x + dx / d * 260, cb.y + dy / d * 260); x.stroke(); x.setLineDash([]); x.strokeStyle = '#d4a373'; x.lineWidth = 5; x.beginPath(); x.moveTo(cb.x - dx / d * (14 + pw * 40), cb.y - dy / d * (14 + pw * 40)); x.lineTo(cb.x - dx / d * (160 + pw * 40), cb.y - dy / d * (160 + pw * 40)); x.stroke(); x.fillStyle = `hsl(${120 - pw * 120},80%,55%)`; x.fillRect(M + 6, H - M - 12, (W - 2 * M - 12) * pw, 6); }
      balls.forEach(b => { if (b.in) return; x.fillStyle = b.cue ? '#fff' : '#f1e3c4'; x.beginPath(); x.arc(b.x, b.y, R, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.stroke(); if (!b.cue) { x.fillStyle = '#333'; x.font = '700 9px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.n, b.x, b.y + .5); } });
      say(`${names[0]}: <b>${score[0]}</b> · ${names[1]}: <b>${score[1]}</b> · бьёт <b>${names[turn]}</b>`);
    });
  }
});
