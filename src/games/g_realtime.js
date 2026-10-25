/* ===== Игры в реальном времени (в прототипе — против ботов) ===== */
function dpad(el, ctx, actLabel, onAct) {
  const st = { dx: 0, dy: 0 }, keys = {};
  const btn = (t, dx, dy) => { const b = h('button', { class: 'nb', style: { width: '58px', height: '52px', fontSize: '22px', touchAction: 'none', padding: 0 } }, t); const on = e => { e.preventDefault(); st.dx = dx; st.dy = dy; }, off = () => { if (st.dx === dx && st.dy === dy) st.dx = st.dy = 0; }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); return b; };
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,58px)', gap: '4px' } }, h('i'), btn('▲', 0, -1), h('i'), btn('◀', -1, 0), h('i'), btn('▶', 1, 0), h('i'), btn('▼', 0, 1), h('i'));
  const act = h('button', { class: 'nb', style: { width: '96px', height: '96px', borderRadius: '50%', background: 'var(--rd)', color: '#fff', fontSize: '15px', touchAction: 'none' } }, actLabel);
  act.addEventListener('pointerdown', e => { e.preventDefault(); onAct(); });
  el.append(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 'min(100%,400px)' } }, grid, act));
  const K = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  ctx.key(e => { if (K[e.key]) { e.preventDefault(); keys[e.key] = 1; [st.dx, st.dy] = K[e.key]; } if (e.code === 'Space') { e.preventDefault(); onAct(); } });
  ctx.on(window, 'keyup', e => { if (K[e.key]) { delete keys[e.key]; const k = Object.keys(keys).pop(); [st.dx, st.dy] = k ? K[k] : [0, 0]; } });
  return st;
}
function joystick(ctx, c) { // перетаскивание пальца — направление
  const st = { x: 0, y: 0, o: null };
  ctx.on(c, 'pointerdown', e => { st.o = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
  ctx.on(c, 'pointermove', e => { if (!st.o) return; const dx = e.clientX - st.o.x, dy = e.clientY - st.o.y, d = Math.hypot(dx, dy); if (d < 4) { st.x = st.y = 0; return; } const k = Math.min(1, d / 40) / d; st.x = dx * k; st.y = dy * k; });
  const up = () => { st.o = null; st.x = st.y = 0; }; ctx.on(c, 'pointerup', up); ctx.on(c, 'pointercancel', up);
  const keys = {}; ctx.key(e => { keys[e.key] = 1; }); ctx.on(window, 'keyup', e => delete keys[e.key]);
  st.read = () => { let x0 = st.x, y0 = st.y; const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0); if (kx || ky) { const L = Math.hypot(kx, ky); x0 = kx / L; y0 = ky / L; } return [x0, y0]; };
  return st;
}

game({
  id: 'haxball', name: 'Футбол', like: 'похоже на Haxball', cat: 'realtime', icon: '⚽', c1: '#52b788', c2: '#1b4332', modes: ['bot'], players: '1×1, 2×2 или 3×3',
  rules: ['Синие защищают нижние ворота, красные — верхние. Ведите палец по полю — игрок бежит в ту сторону (или стрелки).', 'Кнопка «Удар» (или пробел) пинает мяч, если он рядом.', 'Матч до 3 голов или 2 минуты.', 'Онлайн — 1×1, 2×2 и 3×3: команды чередуются по местам в комнате.'],
  run(el, ctx) {
    const W = 340, H = 520, GW = 110, [c, x] = canvas(el, W, H), js = joystick(ctx, c), NH = hostNet(ctx), on = !!NH, host = !on || NH.host;
    const n = on ? ctx.net.seats.length : 2, me = on ? ctx.net.seat : 0, team = i => i % 2, per = Math.ceil(n / 2);
    const home = i => { const t = team(i), k = Math.floor(i / 2); return { x: W / 2 + (k - (per - 1) / 2) * 70, y: t ? 90 : H - 90 }; };
    const PL = [...Array(n)].map((_, i) => ({ ...home(i), vx: 0, vy: 0, r: 15, kf: 0 })), ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9 };
    let sc = [0, 0], t = 120, over = false, kickF = 0, pause = 0;
    btns(el, [['⚡ Удар', () => kickF = .15]]); ctx.key(e => { if (e.code === 'Space') { e.preventDefault(); kickF = .15; } });
    if (on && me >= 0) ctx.toast(team(me) ? 'Вы за красных: ваши ворота сверху' : 'Вы за синих: ваши ворота снизу', 2500);
    const reset = () => { PL.forEach((p, i) => Object.assign(p, home(i), { vx: 0, vy: 0 })); Object.assign(ball, { x: W / 2, y: H / 2, vx: 0, vy: 0 }); pause = 1; };
    const kick = p => { const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy); if (d < p.r + ball.r + 8) { ball.vx += dx / d * 420; ball.vy += dy / d * 420; p.kf = .15; return true; } };
    const coll = p => { const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy), m = p.r + ball.r; if (d < m && d > 0) { const nx = dx / d, ny = dy / d; ball.x = p.x + nx * m; ball.y = p.y + ny * m; const rel = (ball.vx - p.vx) * nx + (ball.vy - p.vy) * ny; if (rel < 0) { ball.vx -= 1.6 * rel * nx; ball.vy -= 1.6 * rel * ny; } } };
    const finish = () => {
      over = true; const w = sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1, note = 'Счёт ' + sc[0] + ':' + sc[1];
      if (on) ctx.ranks(PL.map((_, i) => w < 0 ? 0 : team(i) === w ? 0 : 1), note);
      else ctx.match(w < 0 ? 'draw' : w === 0 ? 'win' : 'loss', note);
    };
    const bot = p => { // бот играет за красных (верх) и атакует нижние ворота
      let bx = ball.x - p.x, by = ball.y - 22 - p.y; if (p.y > ball.y) { bx = ball.x + (p.x < ball.x ? -30 : 30) - p.x; by = ball.y - 30 - p.y; }
      const bl = Math.hypot(bx, by) || 1; return [bx / bl * .87, by / bl * .87, Math.hypot(ball.x - p.x, ball.y - p.y) < 30 && ball.y > p.y && Math.random() < .07];
    };
    ctx.loop(dt => {
      if (host) {
        if (!over && pause <= 0) {
          t -= dt;
          PL.forEach((p, i) => {
            let ix = 0, iy = 0, kk = false;
            if (i === me) { [ix, iy] = js.read(); kk = kickF > 0; }
            else if (on) { const d = NH.inputs[i]; if (d) { ix = clamp(+d.x || 0, -1, 1); iy = clamp(+d.y || 0, -1, 1); kk = !!d.k; } }
            else [ix, iy, kk] = bot(p);
            p.vx += (ix * 190 - p.vx) * Math.min(1, dt * 7); p.vy += (iy * 190 - p.vy) * Math.min(1, dt * 7);
            if (kk && kick(p) && i === me) kickF = 0;
            p.kf -= dt;
          });
          if (kickF > 0) kickF -= dt;
          PL.forEach(p => { p.x = clamp(p.x + p.vx * dt, p.r, W - p.r); p.y = clamp(p.y + p.vy * dt, p.r, H - p.r); coll(p); });
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = PL[i], b = PL[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 30 && d > 0) { const nx = (a.x - b.x) / d, ny = (a.y - b.y) / d, o = (30 - d) / 2; a.x += nx * o; a.y += ny * o; b.x -= nx * o; b.y -= ny * o; } }
          ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx *= 1 - dt * .9; ball.vy *= 1 - dt * .9;
          if (ball.x < ball.r || ball.x > W - ball.r) { ball.vx *= -.8; ball.x = clamp(ball.x, ball.r, W - ball.r); }
          const inGoal = Math.abs(ball.x - W / 2) < GW / 2;
          if (ball.y < ball.r) { if (inGoal) { sc[0]++; ctx.toast(on ? 'Гол синих!' : 'ГОЛ! ⚽'); reset(); } else { ball.vy *= -.8; ball.y = ball.r; } }
          if (ball.y > H - ball.r) { if (inGoal) { sc[1]++; ctx.toast(on ? 'Гол красных!' : 'Пропустили…'); reset(); } else { ball.vy *= -.8; ball.y = H - ball.r; } }
          if (sc[0] >= 3 || sc[1] >= 3 || t <= 0) finish();
        } else pause -= dt;
        if (on) NH.send({ p: PL.map(p => [r1(p.x), r1(p.y), p.kf > 0 ? 1 : 0]), b: [r1(ball.x), r1(ball.y)], s: sc, t: Math.ceil(t), e: over ? 1 : 0 }, over);
      } else {
        const [ix, iy] = js.read(); NH.input({ x: Math.round(ix * 100) / 100, y: Math.round(iy * 100) / 100, k: kickF > 0 ? 1 : 0 }); if (kickF > 0) kickF -= dt;
        const d = NH.last;
        if (d) { const k = Math.min(1, dt * 18); d.p.forEach((q, i) => { if (PL[i]) { PL[i].x += (q[0] - PL[i].x) * k; PL[i].y += (q[1] - PL[i].y) * k; PL[i].kf = q[2] ? .1 : 0; } }); ball.x += (d.b[0] - ball.x) * k; ball.y += (d.b[1] - ball.y) * k; if (d.s[0] + d.s[1] > sc[0] + sc[1]) ctx.toast(d.s[0] > sc[0] ? 'Гол синих!' : 'Гол красных!'); sc = d.s; t = d.t; if (d.e && !over) finish(); }
      }
      ctx.score(sc[0] + ':' + sc[1]);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#5fae5f' : '#68b968'; x.fillRect(0, i * H / 8, W, H / 8); }
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.strokeRect(2, 2, W - 4, H - 4); x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke(); x.beginPath(); x.arc(W / 2, H / 2, 50, 0, 7); x.stroke();
      x.fillStyle = '#e63946'; x.fillRect(W / 2 - GW / 2, 0, GW, 5); x.fillStyle = '#3a86ff'; x.fillRect(W / 2 - GW / 2, H - 5, GW, 5);
      PL.forEach((p, i) => { x.fillStyle = team(i) ? '#e63946' : '#3a86ff'; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); x.strokeStyle = p.kf > 0 ? '#fff' : i === me ? '#ffd166' : 'rgba(0,0,0,.4)'; x.lineWidth = 3; x.stroke(); if (on && ctx.net.seats[i]) { x.fillStyle = '#fff'; x.font = '700 10px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ctx.net.seats[i].name.split(' ')[0].slice(0, 8), p.x, p.y - 24); } });
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = 'rgba(0,0,0,.35)'; rr(x, W / 2 - 34, H / 2 - 13, 68, 26, 8); x.fill(); x.fillStyle = '#fff'; x.font = '700 15px Rubik,system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(Math.floor(Math.max(0, t) / 60) + ':' + String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0'), W / 2, H / 2);
    });
  }
});

game({
  id: 'airhockey', name: 'Аэрохоккей', like: 'на одном телефоне вдвоём', cat: 'realtime', icon: '🏒', c1: '#4cc9f0', c2: '#7209b7', modes: ['bot', 'hot'],
  rules: ['Двигайте свою биту пальцем в своей половине поля.', 'Забейте шайбу в ворота соперника. До 7 голов.', 'На одном телефоне: один держит палец в верхней половине, другой — в нижней.', 'Онлайн у каждого своя бита снизу экрана.'],
  run(el, ctx) {
    const W = 340, H = 540, GW = 120, R = 22, PR = 13, [c, x] = canvas(el, W, H);
    const hot = ctx.mode === 'hot', NH = hostNet(ctx), on = !!NH, host = !on || NH.host, flip = on && ctx.net.seat === 1;
    const m = [{ x: W / 2, y: H - 70, vx: 0, vy: 0 }, { x: W / 2, y: 70, vx: 0, vy: 0 }], pk = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    const tgt = [null, null], ptr = {}; let sc = [0, 0], over = false, myT = null;
    const toHost = p => flip ? { x: W - p.x, y: H - p.y } : p; // у гостя поле перевёрнуто: его бита снизу
    ctx.on(c, 'pointerdown', e => { const p = toHost(c.pos(e)), who = on ? ctx.net.seat : (p.y > H / 2 ? 0 : 1); if (who < 0 || (!on && !hot && who === 1)) return; ptr[e.pointerId] = who; if (who === (on ? ctx.net.seat : who)) { tgt[who] = p; myT = p; } c.setPointerCapture(e.pointerId); });
    ctx.on(c, 'pointermove', e => { const who = ptr[e.pointerId]; const p = toHost(c.pos(e)); if (who != null) { tgt[who] = p; myT = p; } else if (e.pointerType === 'mouse' && !on) tgt[0] = p; });
    const up = e => { delete ptr[e.pointerId]; }; ctx.on(c, 'pointerup', up); ctx.on(c, 'pointercancel', up);
    const reset = side => { Object.assign(pk, { x: W / 2, y: side ? H / 2 + 60 : H / 2 - 60, vx: 0, vy: 0 }); };
    reset(1);
    const finish = () => {
      over = true; const w = sc[0] > sc[1] ? 0 : 1;
      if (on) ctx.ranks(w === 0 ? [0, 1] : [1, 0], 'Счёт ' + sc[0] + ':' + sc[1]);
      else if (hot) ctx.match('draw', (w === 0 ? 'Нижний' : 'Верхний') + ' игрок победил ' + Math.max(...sc) + ':' + Math.min(...sc));
      else ctx.match(w === 0 ? 'win' : 'loss', 'Счёт ' + sc[0] + ':' + sc[1]);
    };
    ctx.loop(dt => {
      if (host) {
        if (!over) {
          if (on) { const d = NH.inputs[1]; if (d) tgt[1] = { x: +d.x, y: +d.y }; }
          else if (!hot) { const ty = pk.y < H / 2 ? Math.max(40, pk.y - 26) : 70, tx = pk.x + (pk.vy < 0 ? 0 : (W / 2 - pk.x) * .2); tgt[1] = { x: tx, y: ty }; }
          m.forEach((q, i) => { const t = tgt[i]; if (!t || !isFinite(t.x) || !isFinite(t.y)) { q.vx = q.vy = 0; return; } const lo = i ? R : H / 2 + R, hi = i ? H / 2 - R : H - R; const nx = clamp(t.x, R, W - R), ny = clamp(t.y, lo, hi); const sp = i === 1 && !hot && !on ? 380 : 2500; let dx = nx - q.x, dy = ny - q.y; const d = Math.hypot(dx, dy); if (d > sp * dt) { dx = dx / d * sp * dt; dy = dy / d * sp * dt; } q.vx = dx / dt; q.vy = dy / dt; q.x += dx; q.y += dy; });
          for (let s = 0; s < 3; s++) {
            pk.x += pk.vx * dt / 3; pk.y += pk.vy * dt / 3;
            if (pk.x < PR || pk.x > W - PR) { pk.vx *= -.9; pk.x = clamp(pk.x, PR, W - PR); }
            const inG = Math.abs(pk.x - W / 2) < GW / 2;
            if (pk.y < PR && !inG) { pk.vy = Math.abs(pk.vy) * .9; pk.y = PR; } if (pk.y > H - PR && !inG) { pk.vy = -Math.abs(pk.vy) * .9; pk.y = H - PR; }
            if (pk.y < -PR) { sc[0]++; ctx.toast(hot ? 'Гол нижнего!' : on ? 'Гол!' : 'ГОЛ! 🏒'); reset(0); } if (pk.y > H + PR) { sc[1]++; ctx.toast(hot ? 'Гол верхнего!' : on ? 'Гол!' : 'Пропустили'); reset(1); }
            m.forEach(q => { const dx = pk.x - q.x, dy = pk.y - q.y, d = Math.hypot(dx, dy); if (d < R + PR && d > 0) { const nx = dx / d, ny = dy / d; pk.x = q.x + nx * (R + PR); pk.y = q.y + ny * (R + PR); const rel = (pk.vx - q.vx) * nx + (pk.vy - q.vy) * ny; if (rel < 0) { pk.vx -= 1.9 * rel * nx; pk.vy -= 1.9 * rel * ny; } } });
          }
          const sp = Math.hypot(pk.vx, pk.vy); if (sp > 1300) { pk.vx *= 1300 / sp; pk.vy *= 1300 / sp; } pk.vx *= 1 - dt * .25; pk.vy *= 1 - dt * .25;
          if (sc[0] >= 7 || sc[1] >= 7) finish();
        }
        if (on) NH.send({ p: [r1(pk.x), r1(pk.y), r1(pk.vx), r1(pk.vy)], m: m.map(q => [r1(q.x), r1(q.y)]), s: sc, e: over ? 1 : 0 }, over);
      } else {
        if (myT) NH.input({ x: Math.round(myT.x), y: Math.round(myT.y) });
        const d = NH.last;
        if (d) { const k = Math.min(1, dt * 20); pk.x += (d.p[0] + d.p[2] * .03 - pk.x) * k; pk.y += (d.p[1] + d.p[3] * .03 - pk.y) * k; m[0].x += (d.m[0][0] - m[0].x) * k; m[0].y += (d.m[0][1] - m[0].y) * k; if (myT) { m[1].x = clamp(myT.x, R, W - R); m[1].y = clamp(myT.y, R, H / 2 - R); } else { m[1].x = d.m[1][0]; m[1].y = d.m[1][1]; } if (d.s[0] + d.s[1] > sc[0] + sc[1]) ctx.toast('Гол!'); sc = d.s; if (d.e && !over) finish(); }
      }
      ctx.score(flip ? sc[0] + ':' + sc[1] : sc[1] + ':' + sc[0]);
      x.save(); if (flip) { x.translate(W, H); x.rotate(Math.PI); }
      x.fillStyle = '#eaf4fb'; x.fillRect(0, 0, W, H); x.strokeStyle = '#90caf9'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke(); x.beginPath(); x.arc(W / 2, H / 2, 46, 0, 7); x.stroke();
      x.strokeStyle = '#ef9a9a'; x.beginPath(); x.arc(W / 2, 0, 70, 0, Math.PI); x.stroke(); x.beginPath(); x.arc(W / 2, H, 70, Math.PI, 0); x.stroke();
      x.fillStyle = '#263238'; x.fillRect(W / 2 - GW / 2, 0, GW, 6); x.fillRect(W / 2 - GW / 2, H - 6, GW, 6);
      x.fillStyle = '#222'; x.beginPath(); x.arc(pk.x, pk.y, PR, 0, 7); x.fill();
      [['#3a86ff', 0], ['#e63946', 1]].forEach(([col, i]) => { const q = m[i]; x.fillStyle = col; x.beginPath(); x.arc(q.x, q.y, R, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(q.x, q.y, R * .5, 0, 7); x.fill(); });
      x.restore();
      x.fillStyle = 'rgba(38,50,56,.25)'; x.font = '800 60px Rubik,system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(flip ? sc[0] : sc[1], W / 2, H / 4); x.fillText(flip ? sc[1] : sc[0], W / 2, H * 3 / 4);
    });
  }
});

game({
  id: 'bomber', name: 'Бомбер', like: 'похоже на Bomberman', cat: 'realtime', icon: '💥', c1: '#f77f00', c2: '#003049', players: 'с ботами — 4, онлайн — 2–4', modes: ['bot'],
  rules: ['Взрывайте кирпичные стены бомбами, ищите бонусы: 🔥 — дальше взрыв, 💣 — больше бомб.', 'Взрыв идёт крестом и убивает всех, включая вас. Спрячьтесь за угол!', 'Последний выживший побеждает.', 'Кнопки внизу или стрелки и пробел.'],
  run(el, ctx) {
    const CW = 13, CH = 11, S = 26, [c, x] = canvas(el, CW * S, CH * S), NH = hostNet(ctx), on = !!NH, host = !on || NH.host;
    const me = on ? ctx.net.seat : 0;
    const g = []; for (let y = 0; y < CH; y++) for (let x0 = 0; x0 < CW; x0++) g.push(x0 === 0 || y === 0 || x0 === CW - 1 || y === CH - 1 || (x0 % 2 === 0 && y % 2 === 0) ? 1 : 0);
    const corners = [[1, 1], [CW - 2, CH - 2], [CW - 2, 1], [1, CH - 2]];
    const safe = (x0, y) => corners.some(([a, b]) => Math.abs(a - x0) + Math.abs(b - y) <= 2);
    for (let i = 0; i < g.length; i++) { const x0 = i % CW, y = i / CW | 0; if (!g[i] && !safe(x0, y) && Math.random() < .7) g[i] = 2; }
    let items = {}, gver = 1, sentVer = 0, frame = 0, myBombs = 0;
    const n = on ? ctx.net.seats.length : 4, lastB = {};
    const P = corners.slice(0, n).map(([a, b], i) => ({ x: a, y: b, px: a, py: b, alive: true, bombs: 1, range: 2, col: ['#3a86ff', '#e63946', '#2a9d8f', '#f4a261'][i], bot: !on && i > 0, mv: 0, cd: 0, dt: 0 }));
    let bombs = [], fire = [], over = false;
    const at = (x0, y) => g[y * CW + x0];
    const bombAt = (x0, y) => bombs.find(b => b.x === x0 && b.y === y);
    const free = (x0, y) => x0 >= 0 && y >= 0 && x0 < CW && y < CH && !at(x0, y) && !bombAt(x0, y);
    const blast = b => { const out = [[b.x, b.y]]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= b.r; k++) { const xx = b.x + dx * k, yy = b.y + dy * k; const v = at(xx, yy); if (v === 1) break; out.push([xx, yy]); if (v === 2) break; } return out; };
    const danger = () => { const d = new Set(); bombs.forEach(b => blast(b).forEach(([a, c2]) => d.add(a + ',' + c2))); fire.forEach(f => d.add(f.x + ',' + f.y)); return d; };
    const place = p => { if (!p.alive || bombs.filter(b => b.o === p).length >= p.bombs || bombAt(p.x, p.y)) return; bombs.push({ x: p.x, y: p.y, t: 2.2, r: p.range, o: p }); };
    const pad = dpad(el, ctx, '💣 Бомба', () => { if (host) { if (P[me]) place(P[me]); } else myBombs++; });
    const bfs = (p, goal, avoid) => { const q = [[p.x, p.y, null]], seen = new Set([p.x + ',' + p.y]); while (q.length) { const [a, b, first] = q.shift(); if (goal(a, b) && first) return first; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy, k = nx + ',' + ny; if (seen.has(k) || !free(nx, ny) || (avoid && avoid.has(k) && !goal(nx, ny))) continue; seen.add(k); q.push([nx, ny, first || [dx, dy]]); } } return null; };
    const botThink = p => {
      const D = danger(), k = p.x + ',' + p.y;
      if (D.has(k)) return bfs(p, (a, b) => !D.has(a + ',' + b)) || [0, 0];
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(p.x + dx, p.y + dy) === 2) || P.some(o => o !== p && o.alive && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) <= 2);
      if (near && p.cd <= 0 && Math.random() < .6) { const fake = { x: p.x, y: p.y, r: p.range }; const nd = new Set(D); blast(fake).forEach(([a, b]) => nd.add(a + ',' + b)); bombs.push({ ...fake, t: 99, o: p, fake: 1 }); const esc = bfs(p, (a, b) => !nd.has(a + ',' + b)); bombs.pop(); if (esc) { place(p); p.cd = 1.2; return esc; } }
      const it = bfs(p, (a, b) => items[a + ',' + b], D); if (it) return it;
      const tg = bfs(p, (a, b) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(a + dx, b + dy) === 2) || P.some(o => o !== p && o.alive && o.x === a && o.y === b), D);
      if (tg) return tg;
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => free(p.x + dx, p.y + dy) && !D.has((p.x + dx) + ',' + (p.y + dy)));
      return opts.length ? pick(opts) : [0, 0];
    };
    const ranks = () => { const key = p => p.alive ? 1e9 : p.dt; const ks = P.map(key).sort((a, b) => b - a); return P.map(p => ks.indexOf(key(p))); };
    const finishOnline = rk => { over = true; const i = me; ctx.ranks(rk, i >= 0 && rk[i] === 0 ? 'Вы последний выживший!' : 'Партия окончена'); };
    ctx.loop(dt => {
      if (host && !over) {
        frame++;
        P.forEach((p, i) => {
          if (!p.alive) return; p.mv -= dt; p.cd -= dt;
          if (on && i !== me) { const d = NH.inputs[i]; if (d && d.b > (lastB[i] || 0)) { lastB[i] = d.b; place(p); } }
          if (p.mv > 0) return;
          let dx = 0, dy = 0;
          if (p.bot) [dx, dy] = botThink(p);
          else if (i === me) { dx = pad.dx; dy = pad.dy; }
          else { const d = NH.inputs[i]; if (d) { dx = clamp(d.dx | 0, -1, 1); dy = clamp(d.dy | 0, -1, 1); if (dx && dy) dy = 0; } }
          if ((dx || dy) && free(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; p.mv = p.bot ? .2 : .15; const k = p.x + ',' + p.y; if (items[k]) { if (items[k] === 'r') p.range++; else p.bombs++; delete items[k]; } }
        });
        bombs.forEach(b => b.t -= dt);
        const boom = b => { bombs = bombs.filter(q => q !== b); blast(b).forEach(([a, c2]) => { fire.push({ x: a, y: c2, t: .45 }); if (at(a, c2) === 2) { g[c2 * CW + a] = 0; gver++; if (Math.random() < .3) items[a + ',' + c2] = Math.random() < .5 ? 'r' : 'b'; } const ch = bombAt(a, c2); if (ch) ch.t = Math.min(ch.t, .05); }); };
        bombs.filter(b => b.t <= 0).forEach(boom);
        fire.forEach(f => f.t -= dt); fire = fire.filter(f => f.t > 0);
        P.forEach((p, i) => { if (p.alive && fire.some(f => f.x === p.x && f.y === p.y)) { p.alive = false; p.dt = frame; if (i === me) ctx.toast('Вас взорвало 💥'); } });
        const al = P.filter(p => p.alive);
        if (on) { if (al.length <= 1) finishOnline(ranks()); }
        else if (!P[0].alive) { over = true; ctx.match('loss', 'Вы выбыли. Осталось игроков: ' + al.length); }
        else if (al.length === 1) { over = true; ctx.match('win', 'Вы последний выживший!'); }
      }
      if (on && host) {
        const st = { P: P.map(p => [p.x, p.y, p.alive ? 1 : 0]), B: bombs.map(b => [b.x, b.y]), F: fire.map(f => [f.x, f.y]), I: Object.entries(items).map(([k, v]) => k + ',' + v), e: over ? 1 : 0, rk: over ? ranks() : null };
        if (sentVer !== gver || frame % 45 === 0) { st.g = g.join(''); sentVer = gver; }
        NH.send(st, over);
      }
      if (on && !host) {
        NH.input({ dx: pad.dx, dy: pad.dy, b: myBombs });
        const d = NH.last;
        if (d) {
          if (d.g) for (let i = 0; i < g.length; i++) g[i] = +d.g[i];
          d.P.forEach((q, i) => { if (P[i]) { P[i].x = q[0]; P[i].y = q[1]; if (P[i].alive && !q[2] && i === me) ctx.toast('Вас взорвало 💥'); P[i].alive = !!q[2]; } });
          bombs = d.B.map(([bx, by]) => ({ x: bx, y: by, t: 1 })); fire = d.F.map(([fx, fy]) => ({ x: fx, y: fy, t: .3 }));
          items = {}; d.I.forEach(s2 => { const [a, b2, v] = s2.split(','); items[a + ',' + b2] = v; });
          if (d.e && !over && d.rk) finishOnline(d.rk);
        }
      }
      P.forEach(p => { p.px += (p.x - p.px) * Math.min(1, dt * 14); p.py += (p.y - p.py) * Math.min(1, dt * 14); });
      ctx.score(P.filter(p => p.alive).length + ' в игре');
      for (let i = 0; i < g.length; i++) { const a = i % CW, b = i / CW | 0; x.fillStyle = g[i] === 1 ? '#4a5568' : g[i] === 2 ? '#c2703d' : (a + b) % 2 ? '#7cb55a' : '#86bf63'; x.fillRect(a * S, b * S, S, S); if (g[i] === 2) { x.strokeStyle = '#8c4a24'; x.lineWidth = 1; x.strokeRect(a * S + 1, b * S + 1, S - 2, S / 2 - 1); x.strokeRect(a * S + 1, b * S + S / 2, S - 2, S / 2 - 1); } if (g[i] === 1) { x.fillStyle = '#5a6578'; x.fillRect(a * S + 2, b * S + 2, S - 4, 4); } }
      x.font = '17px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      Object.entries(items).forEach(([k, v]) => { const [a, b] = k.split(',').map(Number); x.fillText(v === 'r' ? '🔥' : '💣', a * S + S / 2, b * S + S / 2 + 1); });
      const tt = performance.now() / 1000;
      bombs.forEach(b => { const s2 = 1 + Math.sin(tt * 12) * .08; x.fillStyle = '#111'; x.beginPath(); x.arc(b.x * S + S / 2, b.y * S + S / 2 + 1, S * .36 * s2, 0, 7); x.fill(); x.fillStyle = '#ff6b00'; x.fillRect(b.x * S + S / 2 + 3, b.y * S + 4, 3, 4); });
      fire.forEach(f => { x.fillStyle = `rgba(255,${120 + f.t * 200 | 0},0,.85)`; x.fillRect(f.x * S + 2, f.y * S + 2, S - 4, S - 4); });
      P.forEach((p, i) => { if (!p.alive) return; x.fillStyle = p.col; x.beginPath(); x.arc(p.px * S + S / 2, p.py * S + S / 2, S * .38, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(p.px * S + S / 2 - 4, p.py * S + S / 2 - 2, 3, 0, 7); x.arc(p.px * S + S / 2 + 4, p.py * S + S / 2 - 2, 3, 0, 7); x.fill(); if (i === me) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(p.px * S + S / 2, p.py * S + S / 2, S * .38, 0, 7); x.stroke(); } });
    });
  }
});

game({
  id: 'slither', name: 'Змейки онлайн', like: 'похоже на slither.io', cat: 'realtime', icon: '🪱', c1: '#f15bb5', c2: '#00bbf9', players: 'вы и 7 ботов', modes: ['bot'],
  rules: ['Ведите пальцем по экрану — змейка ползёт в сторону пальца (или стрелки).', 'Ешьте светящиеся шарики, чтобы расти. Кнопка «Рывок» ускоряет, но тратит длину.', 'Врезались головой в другую змейку — проиграли. Если в вас врезались — их тело становится едой.', 'Продержитесь 2 минуты: победа, если вы самая длинная змейка.'],
  run(el, ctx) {
    const W = 340, H = 520, WR = 900, [c, x] = canvas(el, W, H);
    const food = []; const addFood = (fx, fy, v = 1) => food.push({ x: fx ?? Math.random() * WR * 2 - WR, y: fy ?? Math.random() * WR * 2 - WR, v, hue: rnd(360) });
    for (let i = 0; i < 400; i++) addFood();
    const mk = (bot, hue) => { const a = Math.random() * 6.28, r = Math.random() * WR * .7; const s = { bot, hue, a, x: Math.cos(a) * r, y: Math.sin(a) * r, len: 30, body: [], alive: true, boost: false, turnT: 0 }; for (let i = 0; i < 30; i++) s.body.push({ x: s.x, y: s.y }); return s; };
    const me = mk(false, 200); me.x = me.y = 0; me.body.forEach(p => { p.x = 0; p.y = 0; });
    const S = [me, ...[...Array(7)].map((_, i) => mk(true, i * 50))];
    let t = 120, over = false, aim = null, boostBtn = false;
    ctx.on(c, 'pointerdown', e => { aim = c.pos(e); c.setPointerCapture(e.pointerId); }); ctx.on(c, 'pointermove', e => { if (aim || e.pointerType === 'mouse') aim = c.pos(e); }); ctx.on(c, 'pointerup', e => { if (e.pointerType !== 'mouse') aim = null; });
    const keys = {}; ctx.key(e => { keys[e.key] = 1; if (e.code === 'Space') boostBtn = true; }); ctx.on(window, 'keyup', e => { delete keys[e.key]; if (e.code === 'Space') boostBtn = false; });
    const bb = h('button', { class: 'nb', style: { touchAction: 'none', width: 'min(100%,340px)', padding: '14px' } }, '🚀 Рывок (держать)'); el.append(bb);
    bb.addEventListener('pointerdown', e => { e.preventDefault(); boostBtn = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => bb.addEventListener(ev, () => boostBtn = false));
    const kill = s => { s.alive = false; s.body.forEach((p, i) => { if (i % 3 === 0) addFood(p.x + Math.random() * 6, p.y + Math.random() * 6, 2); }); if (s.bot) ctx.later(() => { const n = mk(true, s.hue); Object.assign(s, n); }, 3000); };
    ctx.loop(dt => {
      if (!over) {
        t -= dt;
        S.forEach(s => {
          if (!s.alive) return;
          let ta = s.a;
          if (!s.bot) { if (aim) ta = Math.atan2(aim.y - H / 2, aim.x - W / 2); const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0); if (kx || ky) ta = Math.atan2(ky, kx); s.boost = boostBtn && s.len > 20; }
          else { s.turnT -= dt; let f = null, fd = 1e9; for (let i = 0; i < food.length; i += 3) { const d = Math.hypot(food[i].x - s.x, food[i].y - s.y); if (d < fd) { fd = d; f = food[i]; } } if (f) ta = Math.atan2(f.y - s.y, f.x - s.x); if (Math.hypot(s.x, s.y) > WR - 80) ta = Math.atan2(-s.y, -s.x); for (const o of S) if (o !== s && o.alive) for (let i = 0; i < o.body.length; i += 4) { const p = o.body[i]; if (Math.hypot(p.x - s.x, p.y - s.y) < 40) { ta = Math.atan2(s.y - p.y, s.x - p.x); break; } } s.boost = false; }
          let da = ((ta - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; s.a += clamp(da, -4 * dt, 4 * dt);
          const sp = s.boost ? 210 : 115; s.x += Math.cos(s.a) * sp * dt; s.y += Math.sin(s.a) * sp * dt;
          if (s.boost) { s.len -= dt * 6; if (Math.random() < dt * 6) { const tl = s.body[s.body.length - 1]; addFood(tl.x, tl.y); } }
          s.body.unshift({ x: s.x, y: s.y }); while (s.body.length > s.len) s.body.pop();
          if (Math.hypot(s.x, s.y) > WR) kill(s);
          for (let i = food.length - 1; i >= 0; i--) { const f = food[i]; if (Math.abs(f.x - s.x) < 14 && Math.abs(f.y - s.y) < 14) { s.len += f.v * .8; food.splice(i, 1); } }
        });
        S.forEach(s => { if (!s.alive) return; for (const o of S) { if (o === s || !o.alive) continue; for (let i = 0; i < o.body.length; i += 2) { const p = o.body[i]; if (Math.hypot(p.x - s.x, p.y - s.y) < 10) { kill(s); break; } } if (!s.alive) break; } });
        while (food.length < 400) addFood();
        ctx.score(Math.round(me.len));
        if (!me.alive) { over = true; ctx.match('loss', 'Вы врезались. Длина: ' + Math.round(me.len)); }
        else if (t <= 0) { over = true; const top = Math.max(...S.filter(s => s.bot && s.alive).map(s => s.len)); ctx.match(me.len >= top ? 'win' : 'draw', me.len >= top ? 'Вы самая длинная змейка!' : 'Время вышло. Вы живы, но есть змейка длиннее.'); }
      }
      const cx = me.x - W / 2, cy = me.y - H / 2;
      x.fillStyle = '#161a2e'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1; for (let gx = -((cx % 40) + 40) % 40; gx < W; gx += 40) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } for (let gy = -((cy % 40) + 40) % 40; gy < H; gy += 40) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
      x.strokeStyle = '#e5484d'; x.lineWidth = 4; x.beginPath(); x.arc(-cx, -cy, WR, 0, 7); x.stroke();
      food.forEach(f => { const fx = f.x - cx, fy = f.y - cy; if (fx < -5 || fy < -5 || fx > W + 5 || fy > H + 5) return; x.fillStyle = `hsl(${f.hue},90%,65%)`; x.beginPath(); x.arc(fx, fy, f.v > 1 ? 5 : 3.5, 0, 7); x.fill(); });
      S.forEach(s => { if (!s.alive) return; const w = 7 + Math.min(10, s.len / 40); for (let i = s.body.length - 1; i >= 0; i -= 2) { const p = s.body[i]; x.fillStyle = `hsl(${s.hue},80%,${i % 6 < 3 ? 55 : 62}%)`; x.beginPath(); x.arc(p.x - cx, p.y - cy, w, 0, 7); x.fill(); } x.fillStyle = '#fff'; const hx = s.x - cx, hy = s.y - cy; [-1, 1].forEach(k => { x.beginPath(); x.arc(hx + Math.cos(s.a + k * .6) * w * .6, hy + Math.sin(s.a + k * .6) * w * .6, 3, 0, 7); x.fill(); }); if (!s.bot) { x.fillStyle = '#fff'; x.font = '700 11px system-ui'; x.textAlign = 'center'; x.fillText(G.me && G.me.name || 'Вы', hx, hy - w - 6); } });
      x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '700 13px Rubik,system-ui'; x.textAlign = 'left'; x.fillText('⏱ ' + Math.max(0, Math.ceil(t)) + ' c', 10, 20);
      const top = S.filter(s => s.alive).sort((a, b) => b.len - a.len).slice(0, 3); x.textAlign = 'right'; top.forEach((s, i) => x.fillText((i + 1) + '. ' + (s.bot ? 'Бот' : 'Вы') + ' ' + Math.round(s.len), W - 10, 20 + i * 16));
    });
  }
});

game({
  id: 'tanks', name: 'Танчики', like: 'как на «Денди»', cat: 'realtime', icon: '🛡️', c1: '#a3b18a', c2: '#344e41', players: 'с ботами — 3, онлайн — 2–4', modes: ['bot'],
  rules: ['Управляйте танком кнопками или стрелками, «Огонь» — пробел.', 'Кирпичи разрушаются, бетон — нет.', 'У каждого 3 жизни. Последний оставшийся танк побеждает.'],
  run(el, ctx) {
    const N = 13, S = 26, [c, x] = canvas(el, N * S, N * S), NH = hostNet(ctx), on = !!NH, host = !on || NH.host, me = on ? ctx.net.seat : 0;
    const g = Array(N * N).fill(0);
    for (let i = 0; i < N * N; i++) { const a = i % N, b = i / N | 0; if ((a % 2 === 1 && b % 2 === 1)) g[i] = Math.random() < .25 ? 2 : 1; else if (Math.random() < .12) g[i] = 1; }
    const n = on ? ctx.net.seats.length : 3;
    const spawns = (on ? [[6, 12], [6, 0], [0, 6], [12, 6]] : [[6, 12], [0, 0], [12, 0]]).slice(0, n);
    spawns.forEach(([a, b]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = a + dx, yy = b + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N) g[yy * N + xx] = 0; } });
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]], di = d => DIRS.findIndex(q => q[0] === d[0] && q[1] === d[1]);
    const T = spawns.map(([a, b], i) => ({ x: a * S + S / 2, y: b * S + S / 2, d: b === 0 ? [0, 1] : b === 12 ? [0, -1] : a === 0 ? [1, 0] : [-1, 0], lives: 3, alive: true, cd: 0, col: ['#ffd166', '#e63946', '#3a86ff', '#80ed99'][i], bot: !on && i > 0, think: 0, inv: 2, sp: i, dt: 0 }));
    let bullets = [], over = false, boomFx = [], gver = 1, sentVer = 0, frame = 0, myShots = 0; const lastF = {};
    const pad = dpad(el, ctx, '🔥 Огонь', () => { if (host) fire(T[me]); else myShots++; });
    const solid = (px, py) => { const a = Math.floor(px / S), b = Math.floor(py / S); return a < 0 || b < 0 || a >= N || b >= N || g[b * N + a] > 0; };
    const canAt = (t, nx, ny) => { const r = S * .4; return ![[-r, -r], [r, -r], [-r, r], [r, r]].some(([dx, dy]) => solid(nx + dx, ny + dy)) && !T.some(o => o !== t && o.alive && Math.abs(o.x - nx) < S * .8 && Math.abs(o.y - ny) < S * .8); };
    const fire = t => { if (!t || !t.alive || t.cd > 0 || over) return; t.cd = t.bot ? 1.1 : .5; bullets.push({ x: t.x + t.d[0] * S * .5, y: t.y + t.d[1] * S * .5, d: t.d, o: t }); };
    const clearLine = (a, b) => { const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8); for (let i = 1; i < steps; i++) if (solid(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false; return true; };
    const ranks = () => { const key = t => t.alive ? 1e9 : t.dt; const ks = T.map(key).sort((a, b) => b - a); return T.map(t => ks.indexOf(key(t))); };
    const finishOnline = rk => { over = true; ctx.ranks(rk, me >= 0 && rk[me] === 0 ? 'Ваш танк остался последним!' : 'Партия окончена'); };
    ctx.loop(dt => {
      if (host && !over) {
        frame++;
        T.forEach((t, i) => {
          if (!t.alive) return; t.cd -= dt; t.inv -= dt;
          let dx = 0, dy = 0;
          if (t.bot) {
            t.think -= dt; const foe = T.filter(o => o !== t && o.alive).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
            if (foe && (Math.abs(foe.x - t.x) < S * .4 || Math.abs(foe.y - t.y) < S * .4) && clearLine(t, foe)) { t.d = Math.abs(foe.x - t.x) < S * .4 ? [0, Math.sign(foe.y - t.y)] : [Math.sign(foe.x - t.x), 0]; fire(t); }
            else if (Math.random() < dt * .8) fire(t);
            if (t.think <= 0 || !canAt(t, t.x + t.d[0] * 3, t.y + t.d[1] * 3)) { t.think = .6 + Math.random(); const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => canAt(t, t.x + d[0] * 4, t.y + d[1] * 4)); if (foe && Math.random() < .6) { const pref = Math.abs(foe.x - t.x) > Math.abs(foe.y - t.y) ? [Math.sign(foe.x - t.x), 0] : [0, Math.sign(foe.y - t.y)]; t.mvd = opts.find(o => o[0] === pref[0] && o[1] === pref[1]) || pick(opts.length ? opts : [[0, 0]]); } else t.mvd = pick(opts.length ? opts : [[0, 0]]); }
            [dx, dy] = t.mvd || [0, 0];
          } else if (i === me) { dx = pad.dx; dy = pad.dy; if (dx && dy) dy = 0; }
          else { const d = NH.inputs[i]; if (d) { dx = clamp(d.dx | 0, -1, 1); dy = clamp(d.dy | 0, -1, 1); if (dx && dy) dy = 0; if (d.f > (lastF[i] || 0)) { lastF[i] = d.f; fire(t); } } }
          if (dx || dy) {
            t.d = [dx, dy]; const sp = t.bot ? 62 : 80; let nx = t.x + dx * sp * dt, ny = t.y + dy * sp * dt;
            if (dx) ny += ((Math.floor(t.y / S) + .5) * S - t.y) * Math.min(1, dt * 10); if (dy) nx += ((Math.floor(t.x / S) + .5) * S - t.x) * Math.min(1, dt * 10);
            if (canAt(t, nx, ny)) { t.x = nx; t.y = ny; }
          }
        });
        bullets.forEach(b => { b.x += b.d[0] * 260 * dt; b.y += b.d[1] * 260 * dt; const a = Math.floor(b.x / S), c2 = Math.floor(b.y / S); if (a < 0 || c2 < 0 || a >= N || c2 >= N) { b.dead = true; return; } const v = g[c2 * N + a]; if (v) { b.dead = true; if (v === 1) { g[c2 * N + a] = 0; gver++; } boomFx.push({ x: b.x, y: b.y, t: .25 }); return; } T.forEach((t, ti) => { if (t.alive && t !== b.o && Math.abs(t.x - b.x) < S * .45 && Math.abs(t.y - b.y) < S * .45) { b.dead = true; boomFx.push({ x: t.x, y: t.y, t: .4 }); if (t.inv > 0) return; t.lives--; if (t.lives <= 0) { t.alive = false; t.dt = frame; if (ti === me) ctx.toast('Ваш танк уничтожен'); } else { const [sa, sb] = spawns[t.sp]; t.x = sa * S + S / 2; t.y = sb * S + S / 2; t.inv = 2; } } }); });
        bullets = bullets.filter(b => !b.dead);
        const al = T.filter(t => t.alive);
        if (on) { if (al.length <= 1) finishOnline(ranks()); }
        else if (!T[0].alive) { over = true; ctx.match('loss', 'Танк уничтожен'); } else if (T.slice(1).every(t => !t.alive)) { over = true; ctx.match('win', 'Все вражеские танки уничтожены!'); }
      }
      if (on && host) {
        const st = { T: T.map(t => [r1(t.x), r1(t.y), di(t.d), t.alive ? 1 : 0, t.lives, t.inv > 0 ? 1 : 0]), U: bullets.map(b => [r1(b.x), r1(b.y)]), X: boomFx.map(f => [r1(f.x), r1(f.y)]), e: over ? 1 : 0, rk: over ? ranks() : null };
        if (sentVer !== gver || frame % 45 === 0) { st.g = g.join(''); sentVer = gver; }
        NH.send(st, over);
      }
      if (on && !host) {
        NH.input({ dx: pad.dx, dy: pad.dy, f: myShots });
        const d = NH.last;
        if (d) {
          if (d.g) for (let i = 0; i < g.length; i++) g[i] = +d.g[i];
          const k = Math.min(1, dt * 18);
          d.T.forEach((q, i) => { const t = T[i]; if (!t) return; t.x += (q[0] - t.x) * k; t.y += (q[1] - t.y) * k; t.d = DIRS[q[2]] || t.d; if (t.alive && !q[3] && i === me) ctx.toast('Ваш танк уничтожен'); t.alive = !!q[3]; t.lives = q[4]; t.inv = q[5] ? .5 : 0; });
          bullets = d.U.map(([bx, by]) => ({ x: bx, y: by })); if (d.X.length) boomFx = d.X.map(([fx, fy]) => ({ x: fx, y: fy, t: .3 }));
          if (d.e && !over && d.rk) finishOnline(d.rk);
        }
      }
      boomFx.forEach(f => f.t -= dt); boomFx = boomFx.filter(f => f.t > 0);
      ctx.score('❤️' + Math.max(0, T[Math.max(0, me)].lives));
      x.fillStyle = '#1b1b1b'; x.fillRect(0, 0, N * S, N * S);
      for (let i = 0; i < N * N; i++) { const a = i % N, b = i / N | 0; if (g[i] === 1) { x.fillStyle = '#b5532c'; x.fillRect(a * S, b * S, S, S); x.strokeStyle = '#7a3418'; x.lineWidth = 1; for (let k = 0; k < 4; k++) { x.strokeRect(a * S + (k % 2) * S / 2 + (b % 2 ? S / 4 : 0) - (k % 2 && b % 2 ? S / 2 : 0), b * S + (k >> 1) * S / 2, S / 2, S / 2); } } if (g[i] === 2) { x.fillStyle = '#9aa5b1'; x.fillRect(a * S, b * S, S, S); x.fillStyle = '#d7dde3'; x.fillRect(a * S + 4, b * S + 4, S - 8, S - 8); } }
      T.forEach((t, i) => { if (!t.alive) return; if (t.inv > 0 && Math.floor(performance.now() / 100) % 2) return; x.save(); x.translate(t.x, t.y); x.rotate(Math.atan2(t.d[1], t.d[0]) + Math.PI / 2); x.fillStyle = '#333'; x.fillRect(-11, -11, 6, 22); x.fillRect(5, -11, 6, 22); x.fillStyle = t.col; x.fillRect(-7, -8, 14, 16); x.fillRect(-2, -14, 4, 10); x.restore(); if (i === me) { x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(t.x - 13, t.y - 13, 26, 26); } });
      x.fillStyle = '#fff'; bullets.forEach(b => { x.beginPath(); x.arc(b.x, b.y, 3, 0, 7); x.fill(); });
      boomFx.forEach(f => { x.fillStyle = `rgba(255,${150 + f.t * 200 | 0},0,${Math.min(1, f.t * 2)})`; x.beginPath(); x.arc(f.x, f.y, 14 * (1 - f.t), 0, 7); x.fill(); });
      x.font = '700 11px system-ui'; x.textAlign = 'left'; T.forEach((t, i) => { x.fillStyle = t.col; const nm = on ? (ctx.net.seats[i] ? ctx.net.seats[i].name.split(' ')[0].slice(0, 7) : '') : (i ? 'Бот ' + i : 'Вы'); x.fillText(nm + ' ' + '♥'.repeat(Math.max(0, t.lives)), 4 + i * (N * S / n), N * S - 5); });
    });
  }
});
