/* ===== Стратегия ===== */
const RANKS_RU = ['Т', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'В', 'Д', 'К'];
function miniCard(c, o = {}) {
  const w = o.w || 46, hh = Math.round(w * 1.4);
  const e = h('div', { style: { width: w + 'px', height: hh + 'px', borderRadius: '6px', flex: 'none', position: 'relative', boxShadow: o.sel ? '0 0 0 3px #f5c400' : '0 1px 3px rgba(0,0,0,.35)', background: c && c.up ? '#fff' : 'repeating-linear-gradient(45deg,#5b5bf0 0 5px,#7a6cf6 5px 10px)', border: c && c.up ? '1px solid #ccc' : '2px solid #fff', color: c && RED(c.s) ? '#d42a3a' : '#1a1a1a', fontWeight: 800, fontFamily: 'var(--f-num)', fontSize: Math.round(w * .3) + 'px', lineHeight: 1, padding: '3px', overflow: 'hidden' } });
  if (c && c.up) { e.append(h('div', null, RANKS_RU[c.r] + c.s), h('div', { style: { position: 'absolute', right: '3px', bottom: '2px', fontSize: Math.round(w * .5) + 'px' } }, c.s)); }
  return e;
}
game({
  id: 'klondike', name: 'Косынка', like: 'пасьянс', cat: 'strategy', icon: '🃏', c1: '#52b788', c2: '#1b4332', unit: 'time', demo: [180, 1200], minSec: 40, minTime: 60,
  rules: ['Соберите все карты в четыре «дома» наверху — по мастям, от туза до короля.', 'На поле карты кладутся по убыванию с чередованием цвета: на чёрную 9 — красную 8.', 'На пустое место можно положить только короля.', 'Нажмите карту, потом место, куда её перенести. Двойное нажатие отправляет карту в дом.', 'Колода открывается по одной карте.'],
  run(el, ctx) {
    const deck = shuffle(SUITS.flatMap(s => [...Array(13)].map((_, r) => ({ s, r, up: false }))));
    const T = [...Array(7)].map((_, i) => { const p = deck.splice(0, i + 1); p[i].up = true; return p; });
    let stock = deck, waste = [], F = [[], [], [], []], sel = null, moves = 0; const stop = timer(ctx);
    const W = Math.min(52, Math.floor((Math.min(innerWidth, 480) - 24 - 16 - 6 * 5) / 7));
    const area = h('div', { style: { width: 'min(100%,480px)', background: 'var(--felt)', borderRadius: '18px', padding: '10px 8px', minHeight: '520px' } });
    const inf = info(el); el.append(area);
    btns(el, [['Авто в дома', () => auto(true)], ['Сдаться', () => { stop(); overlayMsg(el, 'Партия окончена', 'Результат засчитывается только за собранный пасьянс.', 'Новая раздача', () => { closeGame(true); openGame(ctx.g); }); }]]);
    const canF = (c, f) => f.length ? f[f.length - 1].s === c.s && f[f.length - 1].r === c.r - 1 : c.r === 0;
    const canT = (c, t) => t.length ? (t[t.length - 1].up && RED(t[t.length - 1].s) !== RED(c.s) && t[t.length - 1].r === c.r + 1) : c.r === 12;
    const src = () => sel.from === 'w' ? waste : sel.from === 'f' ? F[sel.i] : T[sel.i];
    const take = () => { const p = src(); const cards = p.splice(sel.k); if (sel.from === 't' && p.length && !p[p.length - 1].up) p[p.length - 1].up = true; return cards; };
    const tryMove = (to, i) => {
      if (!sel) return false; const p = src(), cards = p.slice(sel.k), c = cards[0];
      if (to === 'f' && cards.length === 1 && canF(c, F[i])) { take(); F[i].push(c); }
      else if (to === 't' && canT(c, T[i]) && !(sel.from === 't' && sel.i === i)) { T[i].push(...take()); }
      else return false;
      moves++; sel = null; return true;
    };
    const toFound = (from, i, k) => { sel = { from, i, k }; for (let f = 0; f < 4; f++) if (tryMove('f', f)) return true; sel = null; return false; };
    const auto = all => {
      let moved = true; while (moved) { moved = false; if (waste.length && toFound('w', 0, waste.length - 1)) moved = true; for (let i = 0; i < 7; i++) if (T[i].length && T[i][T[i].length - 1].up && toFound('t', i, T[i].length - 1)) moved = true; if (!all) break; }
      draw(); win();
    };
    const win = () => { if (F.every(f => f.length === 13)) ctx.finish(stop(), 'Ходов: ' + moves); };
    let lastTap = { t: 0, k: '' };
    const tap = (from, i, k) => {
      const key = from + i + ':' + k, dbl = Date.now() - lastTap.t < 350 && lastTap.k === key; lastTap = { t: Date.now(), k: key };
      if (dbl) { if (toFound(from, i, k)) { draw(); win(); return; } }
      if (sel) { if (from === 't' && tryMove('t', i) || from === 'f' && tryMove('f', i)) { draw(); win(); return; } }
      const p = from === 'w' ? waste : from === 'f' ? F[i] : T[i];
      if (k >= 0 && p[k] && p[k].up) sel = (sel && sel.from === from && sel.i === i && sel.k === k) ? null : { from, i, k }; else sel = null;
      draw();
    };
    const draw = () => {
      area.innerHTML = '';
      const top = h('div', { style: { display: 'flex', gap: '5px', marginBottom: '12px' } });
      const slot = (child, onclick) => { const d = h('div', { style: { width: W + 'px', height: Math.round(W * 1.4) + 'px', borderRadius: '6px', border: '2px dashed rgba(255,255,255,.3)', flex: 'none', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.5)', fontSize: '20px', cursor: 'pointer' }, onclick }); if (child) { d.style.border = '0'; d.innerHTML = ''; d.append(child); } return d; };
      top.append(slot(stock.length ? miniCard({ up: false }, { w: W }) : h('span', null, '↻'), () => { if (stock.length) { const c = stock.pop(); c.up = true; waste.push(c); } else { stock = waste.reverse().map(c => ({ ...c, up: false })); waste = []; } sel = null; moves++; draw(); }));
      top.append(slot(waste.length ? miniCard(waste[waste.length - 1], { w: W, sel: sel && sel.from === 'w' }) : null, () => waste.length && tap('w', 0, waste.length - 1)));
      top.append(h('div', { style: { width: W + 'px', flex: 'none' } }));
      F.forEach((f, i) => top.append(slot(f.length ? miniCard(f[f.length - 1], { w: W, sel: sel && sel.from === 'f' && sel.i === i }) : h('span', null, SUITS[i]), () => tap('f', i, f.length - 1))));
      area.append(top);
      const tab = h('div', { style: { display: 'flex', gap: '5px', alignItems: 'flex-start' } });
      T.forEach((t, i) => {
        const col = h('div', { style: { width: W + 'px', flex: 'none', position: 'relative', minHeight: Math.round(W * 1.4) + 'px', cursor: 'pointer' }, onclick: e => { if (e.target === col) tap('t', i, -1); } });
        if (!t.length) col.append(slot(null, () => tap('t', i, -1)));
        let y = 0; t.forEach((c, k) => { const m = miniCard(c, { w: W, sel: sel && sel.from === 't' && sel.i === i && k >= sel.k }); m.style.position = 'absolute'; m.style.top = y + 'px'; m.onclick = e => { e.stopPropagation(); tap('t', i, k); }; col.append(m); y += c.up ? Math.round(W * .48) : Math.round(W * .22); });
        col.style.height = (y + W * 1.4) + 'px'; tab.append(col);
      });
      area.append(tab);
      inf.innerHTML = `Ходов: <b>${moves}</b> · в домах: <b>${F.reduce((s, f) => s + f.length, 0)}</b> из 52`;
    };
    draw();
  }
});

game({
  id: 'td', name: 'Оборона корпуса', like: 'башенная защита', cat: 'strategy', icon: '🏰', c1: '#ffb703', c2: '#d00000', demo: [3, 32], minSec: 30,
  rules: ['По дорожке к корпусу ползут дедлайны 📄, хвосты 📚 и внезапные проверки ⏰.', 'Выберите башню внизу и нажмите на свободную клетку. Нажатие на башню — улучшение.', '☕ Кофе — быстрый и слабый, 📖 Конспект — медленный и мощный, 🧘 Спокойствие замедляет врагов.', 'Пропустили 20 врагов — корпус пал. Очки — пройденные волны.'],
  run(el, ctx) {
    const C = 40, CW = 9, CH = 12, W = CW * C, H = CH * C, [c, x] = canvas(el, W, H);
    const pathC = [[0, 1], [7, 1], [7, 4], [1, 4], [1, 7], [7, 7], [7, 10], [4, 10], [4, 11]];
    const path = []; const road = new Set();
    for (let i = 0; i < pathC.length - 1; i++) { const [ax, ay] = pathC[i], [bx, by] = pathC[i + 1]; const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= n; k++) road.add((ax + Math.sign(bx - ax) * k) + ',' + (ay + Math.sign(by - ay) * k)); }
    pathC.forEach(([px, py]) => path.push({ x: px * C + C / 2, y: py * C + C / 2 })); path[0].x = -20;
    const TT = { cof: { i: '☕', n: 'Кофе', p: 50, r: 90, d: 6, cd: .35, col: '#8d5524' }, kon: { i: '📖', n: 'Конспект', p: 90, r: 110, d: 30, cd: 1.4, col: '#3a86ff' }, cal: { i: '🧘', n: 'Спокойствие', p: 70, r: 80, d: 1, cd: .5, slow: .5, col: '#2a9d8f' } };
    let towers = [], en = [], shots = [], money = 140, lives = 20, wave = 0, spawning = 0, spT = 0, chosen = 'cof', over = false, auto = false;
    const bar = h('div', { class: 'bar2' }); el.append(bar); const inf = info(el);
    const drawBar = () => { bar.innerHTML = ''; Object.entries(TT).forEach(([k, t]) => bar.append(h('button', { class: 'nb', style: { background: chosen === k ? 'var(--ac)' : '', color: chosen === k ? '#fff' : '' }, onclick: () => { chosen = k; drawBar(); } }, t.i + ' ' + t.p))); bar.append(h('button', { class: 'nb', style: { background: 'var(--ok)', color: '#fff' }, onclick: startWave }, spawning || en.length ? (auto ? 'Авто ✓' : 'Авто') : '▶ Волна ' + (wave + 1))); };
    const startWave = () => { if (spawning || en.length) { auto = !auto; drawBar(); return; } wave++; spawning = 6 + wave * 2; spT = 0; drawBar(); };
    ctx.on(c, 'pointerdown', e => {
      if (over) return; const p = c.pos(e), gx = Math.floor(p.x / C), gy = Math.floor(p.y / C); if (gy >= CH || gx >= CW) return;
      const t = towers.find(t => t.gx === gx && t.gy === gy);
      if (t) { const cost = TT[t.k].p * t.lv; if (t.lv >= 3) return ctx.toast('Максимальный уровень'); if (money < cost) return ctx.toast('Улучшение стоит ' + cost); money -= cost; t.lv++; ctx.toast(TT[t.k].n + ': уровень ' + t.lv, 900); return; }
      if (road.has(gx + ',' + gy) || gy === 11) return;
      const tt = TT[chosen]; if (money < tt.p) return ctx.toast('Не хватает монет: нужно ' + tt.p);
      money -= tt.p; towers.push({ gx, gy, k: chosen, lv: 1, cd: 0 });
    });
    ctx.loop(dt => {
      if (!over) {
        if (spawning > 0) { spT -= dt; if (spT <= 0) { spT = .8; spawning--; const r = Math.random(); const k = wave > 2 && r < .2 ? 'fast' : wave > 3 && r < .4 ? 'tank' : 'norm'; const hp = (k === 'tank' ? 90 : k === 'fast' ? 20 : 35) * (1 + wave * .28); en.push({ k, hp, max: hp, s: k === 'fast' ? 85 : k === 'tank' ? 32 : 48, seg: 0, x: path[0].x, y: path[0].y, slow: 0, e: k === 'fast' ? '⏰' : k === 'tank' ? '📚' : '📄' }); } }
        en.forEach(e => {
          let mv = e.s * (e.slow > 0 ? .5 : 1) * dt; e.slow -= dt;
          while (mv > 0 && e.seg < path.length - 1) { const t = path[e.seg + 1], dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (d <= mv) { e.x = t.x; e.y = t.y; e.seg++; mv -= d; } else { e.x += dx / d * mv; e.y += dy / d * mv; mv = 0; } }
          if (e.seg >= path.length - 1) { e.hp = -1; e.out = true; lives--; }
        });
        towers.forEach(t => {
          const T0 = TT[t.k]; t.cd -= dt; if (t.cd > 0) return;
          const tx = t.gx * C + C / 2, ty = t.gy * C + C / 2, r = T0.r + (t.lv - 1) * 15;
          const tg = en.filter(e => e.hp > 0 && Math.hypot(e.x - tx, e.y - ty) < r).sort((a, b) => b.seg - a.seg)[0];
          if (!tg) return; t.cd = T0.cd; tg.hp -= T0.d * (1 + (t.lv - 1) * .7); if (T0.slow) tg.slow = 1.2;
          shots.push({ x1: tx, y1: ty, x2: tg.x, y2: tg.y, l: .12, col: T0.col });
        });
        en = en.filter(e => { if (e.hp <= 0 && !e.out) money += e.k === 'tank' ? 12 : 6; return e.hp > 0; });
        if (!spawning && !en.length && wave > 0 && !over) { ctx.score(wave); if (bar.lastChild.textContent.startsWith('Авто')) drawBar(); if (auto) startWave(); }
        if (lives <= 0) { over = true; ctx.finish(wave - 1, 'Корпус пал на волне ' + wave); }
      }
      shots.forEach(s => s.l -= dt); shots = shots.filter(s => s.l > 0);
      for (let i = 0; i < CW; i++) for (let j = 0; j < CH; j++) { x.fillStyle = road.has(i + ',' + j) ? '#d6c4a0' : (i + j) % 2 ? '#7fb069' : '#88b874'; x.fillRect(i * C, j * C, C, C); }
      x.fillStyle = '#5b5bf0'; x.fillRect(3 * C, 11 * C, 3 * C, C); x.fillStyle = '#fff'; x.font = '700 14px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🏛 Корпус БарГУ', 4.5 * C, 11.5 * C);
      x.font = '24px system-ui';
      towers.forEach(t => { x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(t.gx * C + C / 2, t.gy * C + C / 2, 17, 0, 7); x.fill(); x.fillText(TT[t.k].i, t.gx * C + C / 2, t.gy * C + C / 2 + 1); for (let l = 0; l < t.lv; l++) { x.fillStyle = '#ffb703'; x.fillRect(t.gx * C + 8 + l * 9, t.gy * C + 34, 7, 4); } });
      shots.forEach(s => { x.strokeStyle = s.col; x.lineWidth = 3; x.beginPath(); x.moveTo(s.x1, s.y1); x.lineTo(s.x2, s.y2); x.stroke(); });
      x.font = '22px system-ui';
      en.forEach(e => { x.fillText(e.e, e.x, e.y); x.fillStyle = '#300'; x.fillRect(e.x - 14, e.y - 18, 28, 4); x.fillStyle = e.slow > 0 ? '#2a9d8f' : '#e63946'; x.fillRect(e.x - 14, e.y - 18, 28 * Math.max(0, e.hp / e.max), 4); });
      inf.innerHTML = `🪙 <b>${money}</b> · ❤️ <b>${Math.max(0, lives)}</b> · волна <b>${wave}</b>`;
    });
    drawBar();
  }
});
