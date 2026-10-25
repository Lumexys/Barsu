/* ===== Аркады ===== */
game({
  id: 'flappy', name: 'Птичка', like: 'похоже на Flappy Bird', cat: 'arcade', icon: '🐦', c1: '#4cc9f0', c2: '#4361ee', demo: [3, 70], rate: 1.6, minSec: 3,
  rules: ['Касание экрана или пробел — взмах крыльями.', 'Пролетайте между колоннами. Одна колонна — одно очко.', 'Скорость понемногу растёт.'],
  run(el, ctx) {
    const W = 360, H = 560, [c, x] = canvas(el, W, H);
    let b, pipes, t, sc, state = 'ready';
    const reset = () => { b = { y: 260, v: 0 }; pipes = []; t = 0; sc = 0; ctx.score(0); };
    reset();
    const flap = () => { if (state === 'ready') state = 'play'; if (state === 'play') b.v = -390; };
    ctx.on(c, 'pointerdown', flap); ctx.key(e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } });
    const clouds = [...Array(5)].map(() => ({ x: rnd(W), y: rnd(250), s: .6 + Math.random() }));
    ctx.loop(dt => {
      const sp = 140 + sc * 3;
      if (state === 'play') {
        b.v += 1250 * dt; b.y += b.v * dt; t += dt;
        if (!pipes.length || pipes[pipes.length - 1].x < W - 200) pipes.push({ x: W + 30, gap: 120 + rnd(260), ok: false });
        pipes.forEach(p => { p.x -= sp * dt; if (!p.ok && p.x + 30 < 90) { p.ok = true; sc++; ctx.score(sc); } });
        pipes = pipes.filter(p => p.x > -80);
        const hit = pipes.some(p => p.x < 90 + 14 && p.x + 60 > 90 - 14 && (b.y - 13 < p.gap - 72 || b.y + 13 > p.gap + 72));
        if (hit || b.y > H - 60 || b.y < -40) { state = 'over'; ctx.finish(sc); }
      } else if (state === 'ready') b.y = 260 + Math.sin(performance.now() / 300) * 8;
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6ec6ff'); g.addColorStop(1, '#cdeffd'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,.85)'; clouds.forEach(cl => { cl.x -= sp * .15 * cl.s * dt; if (cl.x < -60) cl.x = W + 40; x.beginPath(); x.ellipse(cl.x, cl.y, 34 * cl.s, 14 * cl.s, 0, 0, 7); x.fill(); });
      pipes.forEach(p => {
        [[0, p.gap - 72], [p.gap + 72, H]].forEach(([a, z]) => { x.fillStyle = '#43aa8b'; x.fillRect(p.x, a, 60, z - a); x.fillStyle = '#2d8a6e'; x.fillRect(p.x + 44, a, 16, z - a); x.fillStyle = '#52c49f'; x.fillRect(p.x - 4, a === 0 ? z - 18 : a, 68, 18); });
      });
      x.fillStyle = '#e9c46a'; x.fillRect(0, H - 60, W, 60); x.fillStyle = '#90be6d'; x.fillRect(0, H - 60, W, 12);
      x.save(); x.translate(90, b.y); x.rotate(clamp(b.v / 700, -.5, 1.1));
      x.fillStyle = '#ffb703'; x.beginPath(); x.ellipse(0, 0, 17, 14, 0, 0, 7); x.fill();
      x.fillStyle = '#fb8500'; x.beginPath(); x.moveTo(13, 0); x.lineTo(24, 4); x.lineTo(13, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(7, -5, 5, 0, 7); x.fill(); x.fillStyle = '#222'; x.beginPath(); x.arc(9, -5, 2.4, 0, 7); x.fill();
      x.fillStyle = '#ffd166'; x.beginPath(); x.ellipse(-5, 2, 8, 5, Math.sin(performance.now() / 60) * .5, 0, 7); x.fill();
      x.restore();
      if (state === 'ready') { x.fillStyle = 'rgba(22,26,44,.75)'; rr(x, 70, 170, 220, 46, 14); x.fill(); x.fillStyle = '#fff'; x.font = '700 17px system-ui'; x.textAlign = 'center'; x.fillText('Нажмите, чтобы лететь', 180, 199); }
      x.fillStyle = '#fff'; x.font = '800 44px Rubik,system-ui'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeText(sc, W / 2, 70); x.fillText(sc, W / 2, 70);
    });
  }
});

game({
  id: 'doodle', name: 'Прыгун', like: 'похоже на Doodle Jump', cat: 'arcade', icon: '🐸', c1: '#80ed99', c2: '#38a3a5', demo: [300, 6000], rate: 90, minSec: 3,
  rules: ['Герой прыгает сам. Держите палец на левой или правой половине экрана, чтобы двигаться (или стрелки).', 'Синие платформы двигаются, коричневые ломаются.', 'Края экрана связаны: ушли влево — появитесь справа.', 'Очки — высота подъёма.'],
  run(el, ctx) {
    const W = 360, H = 560, [c, x] = canvas(el, W, H);
    const p = { x: 180, y: 420, vx: 0, vy: -650 }; let cam = 0, best = 0, dir = 0, over = false;
    const plats = []; let topY = 540;
    const add = y => { const k = best / 10; const r = Math.random(); plats.push({ x: rnd(W - 60), y, t: k > 80 && r < .18 ? 'b' : k > 30 && r < .35 ? 'm' : 'n', v: 60 + rnd(60), dead: false }); };
    plats.push({ x: 150, y: 520, t: 'n' }); while (topY > -100) { topY -= 60 + rnd(30); add(topY); }
    ctx.on(c, 'pointerdown', e => { dir = c.pos(e).x < W / 2 ? -1 : 1; c.setPointerCapture(e.pointerId); });
    ctx.on(c, 'pointermove', e => { if (e.buttons) dir = c.pos(e).x < W / 2 ? -1 : 1; });
    ctx.on(c, 'pointerup', () => dir = 0);
    const keys = {}; ctx.key(e => { keys[e.key] = 1; }); ctx.on(window, 'keyup', e => { keys[e.key] = 0; });
    ctx.loop(dt => {
      if (!over) {
        const d = dir || (keys.ArrowLeft ? -1 : keys.ArrowRight ? 1 : 0);
        p.vx += (d * 520 - p.vx) * Math.min(1, dt * 8); p.x += p.vx * dt; if (p.x < -15) p.x = W + 15; if (p.x > W + 15) p.x = -15;
        const py = p.y; p.vy += 1300 * dt; p.y += p.vy * dt;
        if (p.vy > 0) for (const q of plats) if (!q.dead && p.x > q.x - 10 && p.x < q.x + 70 && py + 18 <= q.y && p.y + 18 >= q.y) { if (q.t === 'b') { q.dead = true; } else { p.vy = -650; } }
        plats.forEach(q => { if (q.t === 'm') { q.x += q.v * dt; if (q.x < 0 || q.x > W - 60) q.v *= -1; } if (q.dead) q.y += 300 * dt; });
        if (p.y < cam + 240) cam = p.y - 240;
        const h0 = Math.round((420 - p.y) / 10); if (h0 > best) { best = h0; ctx.score(best); }
        while (topY > cam - 100) { topY -= 55 + rnd(35) + Math.min(40, best / 100); add(topY); }
        for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > cam + H + 50) plats.splice(i, 1);
        if (p.y > cam + H + 30) { over = true; ctx.finish(best); }
      }
      x.fillStyle = '#fbf8ef'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(80,140,200,.15)'; x.lineWidth = 1; for (let gy = -((cam % 20) + 20) % 20; gy < H; gy += 20) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
      for (let gx = 0; gx < W; gx += 20) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
      plats.forEach(q => { x.fillStyle = q.t === 'm' ? '#4ea8de' : q.t === 'b' ? '#a47148' : '#57cc99'; rr(x, q.x, q.y - cam, 60, 12, 6); x.fill(); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(q.x + 4, q.y - cam + 8, 52, 3); });
      const sy = p.y - cam;
      x.fillStyle = '#80b918'; rr(x, p.x - 16, sy - 18, 32, 34, 12); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x - 6 + p.vx / 200, sy - 8, 5, 0, 7); x.arc(p.x + 7 + p.vx / 200, sy - 8, 5, 0, 7); x.fill();
      x.fillStyle = '#222'; x.beginPath(); x.arc(p.x - 5 + p.vx / 150, sy - 8, 2.2, 0, 7); x.arc(p.x + 8 + p.vx / 150, sy - 8, 2.2, 0, 7); x.fill();
      x.fillStyle = '#55a630'; x.fillRect(p.x - 12, sy + 14, 7, 6); x.fillRect(p.x + 5, sy + 14, 7, 6);
    });
  }
});

game({
  id: 'ninja', name: 'Нарезка', like: 'похоже на Fruit Ninja', cat: 'arcade', icon: '🍉', c1: '#ff6b6b', c2: '#c9184a', demo: [20, 320], rate: 7, minSec: 5,
  rules: ['Проводите пальцем по фруктам, чтобы разрезать их.', 'Не задевайте бомбы 💣 — игра закончится.', 'Пропустили 3 фрукта — тоже конец.', 'Несколько фруктов одним движением — бонус.'],
  run(el, ctx) {
    const W = 360, H = 560, [c, x] = canvas(el, W, H);
    const F = ['🍉', '🍊', '🍎', '🍋', '🍇', '🥝', '🍑', '🍍'], JC = { '🍉': '#ef476f', '🍊': '#f8961e', '🍎': '#e63946', '🍋': '#ffd60a', '🍇': '#7b2cbf', '🥝': '#80b918', '🍑': '#ffb4a2', '🍍': '#ffd166' };
    let items = [], parts = [], trail = [], sc = 0, lives = 3, t = 0, next = .6, over = false, down = false;
    const spawn = () => { const n = 1 + rnd(Math.min(4, 1 + t / 20)); for (let i = 0; i < n; i++) { const bomb = Math.random() < Math.min(.25, .08 + t / 300); items.push({ x: 50 + rnd(W - 100), y: H + 30, vx: (Math.random() - .5) * 160, vy: -(560 + rnd(200)), e: bomb ? '💣' : pick(F), bomb, r: 24, rot: 0, vr: (Math.random() - .5) * 6, cut: false }); } };
    ctx.on(c, 'pointerdown', e => { down = true; trail = [{ ...c.pos(e), t: performance.now() }]; c.setPointerCapture(e.pointerId); });
    ctx.on(c, 'pointerup', () => { down = false; });
    ctx.on(c, 'pointermove', e => {
      if (!down || over) return; const q = c.pos(e), p = trail[trail.length - 1]; trail.push({ ...q, t: performance.now() });
      if (!p) return; let combo = 0;
      for (const it of items) {
        if (it.cut) continue;
        const dx = q.x - p.x, dy = q.y - p.y, L = dx * dx + dy * dy || 1, k = clamp(((it.x - p.x) * dx + (it.y - p.y) * dy) / L, 0, 1);
        if (Math.hypot(p.x + dx * k - it.x, p.y + dy * k - it.y) < it.r) {
          it.cut = true;
          if (it.bomb) { over = true; for (let i = 0; i < 30; i++) parts.push({ x: it.x, y: it.y, vx: (Math.random() - .5) * 600, vy: (Math.random() - .5) * 600, l: 1, c: i % 2 ? '#222' : '#ffb703' }); ctx.later(() => ctx.finish(sc, 'Попалась бомба'), 400); }
          else { combo++; sc++; for (let i = 0; i < 12; i++) parts.push({ x: it.x, y: it.y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, l: 1, c: JC[it.e] }); }
        }
      }
      if (combo >= 3) { sc += combo; ctx.toast('Комбо ×' + combo + '! +' + combo); }
      ctx.score(sc);
    });
    ctx.loop(dt => {
      if (!over) { t += dt; next -= dt; if (next <= 0) { spawn(); next = Math.max(.55, 1.4 - t / 60); } }
      items.forEach(it => { it.vy += 520 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; });
      items = items.filter(it => { if (it.y > H + 60 && it.vy > 0) { if (!it.cut && !it.bomb && !over) { lives--; if (lives <= 0) { over = true; ctx.finish(sc, 'Пропущено 3 фрукта'); } } return false; } return !it.cut || it.bomb; });
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.l -= dt * 1.5; }); parts = parts.filter(p => p.l > 0);
      const now = performance.now(); trail = trail.filter(p => now - p.t < 160);
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5e3b28'); g.addColorStop(1, '#3a2418'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, i * 100 + 40); x.lineTo(W, i * 100 + 60); x.stroke(); }
      parts.forEach(p => { x.globalAlpha = Math.max(0, p.l); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, 4, 0, 7); x.fill(); }); x.globalAlpha = 1;
      x.font = '44px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      items.forEach(it => { if (it.cut) return; x.save(); x.translate(it.x, it.y); x.rotate(it.rot); x.fillText(it.e, 0, 0); x.restore(); });
      if (trail.length > 1) { x.strokeStyle = '#fff'; x.lineCap = 'round'; for (let i = 1; i < trail.length; i++) { x.lineWidth = i / trail.length * 7; x.beginPath(); x.moveTo(trail[i - 1].x, trail[i - 1].y); x.lineTo(trail[i].x, trail[i].y); x.stroke(); } }
      x.textBaseline = 'alphabetic'; x.font = '22px system-ui'; x.textAlign = 'left'; x.fillText('❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(3 - Math.max(0, lives)), 12, 34);
    });
  }
});

game({
  id: 'snake', name: 'Змейка', like: 'классика', cat: 'arcade', icon: '🐍', c1: '#70e000', c2: '#007200', demo: [5, 90], rate: 3, minSec: 3,
  rules: ['Свайп или стрелки — поворот.', 'Ешьте яблоки, змейка растёт и ускоряется.', 'Нельзя врезаться в стены и в себя.'],
  run(el, ctx) {
    const N = 20, S = 18, [c, x] = canvas(el, N * S, N * S);
    let sn = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], d = { x: 1, y: 0 }, q = [], ap, sc = 0, acc = 0, over = false;
    const place = () => { do ap = { x: rnd(N), y: rnd(N) }; while (sn.some(s => s.x === ap.x && s.y === ap.y)); }; place();
    const D = { L: { x: -1, y: 0 }, R: { x: 1, y: 0 }, U: { x: 0, y: -1 }, D: { x: 0, y: 1 } };
    swipe(ctx, c, k => { const n = D[k], last = q.length ? q[q.length - 1] : d; if (n.x !== -last.x || n.y !== -last.y) q.push(n); });
    ctx.loop(dt => {
      if (!over) {
        acc += dt; const step = Math.max(.06, .14 - sc * .002);
        while (acc > step) {
          acc -= step; if (q.length) d = q.shift();
          const hd = { x: sn[0].x + d.x, y: sn[0].y + d.y };
          if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || sn.some(s => s.x === hd.x && s.y === hd.y)) { over = true; ctx.finish(sc); break; }
          sn.unshift(hd); if (hd.x === ap.x && hd.y === ap.y) { sc++; ctx.score(sc); place(); } else sn.pop();
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { x.fillStyle = (i + j) % 2 ? '#a7c957' : '#b5d66b'; x.fillRect(i * S, j * S, S, S); }
      x.font = '16px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🍎', ap.x * S + S / 2, ap.y * S + S / 2 + 1);
      sn.forEach((s, i) => { x.fillStyle = i ? (i % 2 ? '#386641' : '#3f7a4b') : '#1b4332'; rr(x, s.x * S + 1, s.y * S + 1, S - 2, S - 2, 5); x.fill(); });
      const hd = sn[0]; x.fillStyle = '#fff'; x.beginPath(); x.arc(hd.x * S + S / 2 + d.x * 3 - d.y * 4, hd.y * S + S / 2 + d.y * 3 - d.x * 4, 2.5, 0, 7); x.arc(hd.x * S + S / 2 + d.x * 3 + d.y * 4, hd.y * S + S / 2 + d.y * 3 + d.x * 4, 2.5, 0, 7); x.fill();
    });
    info(el, 'Свайп по полю или стрелки на клавиатуре');
  }
});

game({
  id: 'stack', name: 'Башня', like: 'похоже на Stack', cat: 'arcade', icon: '🧱', c1: '#f72585', c2: '#7209b7', demo: [8, 90], rate: 3, minSec: 3,
  rules: ['Блок ездит туда-сюда. Нажмите, чтобы опустить его на башню.', 'Всё, что свисает, отрезается — блок становится уже.', 'Точное попадание сохраняет ширину.'],
  run(el, ctx) {
    const W = 360, H = 560, [c, x] = canvas(el, W, H), BH = 26;
    let st = [{ x: 80, w: 200, hue: 200 }], cur, cam = 0, sc = 0, over = false, falls = [];
    const nw = () => { const t = st[st.length - 1]; cur = { x: sc % 2 ? -t.w : W, w: t.w, hue: (t.hue + 9) % 360, v: (sc % 2 ? 1 : -1) * (150 + Math.min(200, sc * 6)) }; };
    nw();
    const drop = () => {
      if (over) return; const t = st[st.length - 1];
      const l = Math.max(cur.x, t.x), r = Math.min(cur.x + cur.w, t.x + t.w);
      if (r <= l) { over = true; falls.push({ ...cur, y: st.length, vy: 0 }); ctx.later(() => ctx.finish(sc), 600); return; }
      if (Math.abs(cur.x - t.x) < 5) { cur.x = t.x; ctx.toast('Идеально!', 700); }
      else { const cutX = cur.x < t.x ? cur.x : r, cutW = cur.w - (r - l); falls.push({ x: cutX, w: cutW, hue: cur.hue, y: st.length, vy: 0 }); cur.x = l; cur.w = r - l; }
      st.push({ x: cur.x, w: cur.w, hue: cur.hue }); sc++; ctx.score(sc); nw();
    };
    ctx.on(c, 'pointerdown', drop); ctx.key(e => { if (e.code === 'Space') { e.preventDefault(); drop(); } });
    ctx.loop(dt => {
      if (!over) { cur.x += cur.v * dt; if (cur.x < -cur.w - 20 && cur.v < 0 || cur.x > W + 20 && cur.v > 0) cur.v *= -1; }
      const target = Math.max(0, st.length * BH - 300); cam += (target - cam) * Math.min(1, dt * 5);
      const g = x.createLinearGradient(0, 0, 0, H); const hu = st[st.length - 1].hue; g.addColorStop(0, `hsl(${hu},55%,28%)`); g.addColorStop(1, `hsl(${(hu + 40) % 360},55%,14%)`); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const Y = i => H - 40 - (i + 1) * BH + cam;
      const blk = (b, y) => { x.fillStyle = `hsl(${b.hue},70%,60%)`; x.fillRect(b.x, y, b.w, BH); x.fillStyle = `hsl(${b.hue},70%,72%)`; x.fillRect(b.x, y, b.w, 5); x.fillStyle = `hsl(${b.hue},60%,45%)`; x.fillRect(b.x, y + BH - 4, b.w, 4); };
      st.forEach((b, i) => { const y = Y(i); if (y < H + 30) blk(b, y); });
      falls.forEach(f => { f.vy += 900 * dt; f.y -= f.vy * dt / BH; blk(f, Y(f.y)); }); falls = falls.filter(f => Y(f.y) < H + 40);
      if (!over) blk(cur, Y(st.length));
      x.fillStyle = '#fff'; x.font = '800 48px Rubik,system-ui'; x.textAlign = 'center'; x.fillText(sc, W / 2, 80);
    });
  }
});

game({
  id: 'clicker', name: 'Кликер', like: 'копите на стипендию', cat: 'arcade', noLeague: true, icon: '🪙', c1: '#ffd60a', c2: '#e85d04', demo: [2000, 900000], minSec: 10,
  rules: ['Нажимайте на монету — получаете рубли.', 'Покупайте улучшения: одни дают больше за нажатие, другие копят сами.', 'Прогресс сохраняется. Кнопка «Записать результат» отправляет в рейтинг всё, что заработано.', 'Больше 15 нажатий в секунду не засчитываются — это защита от автокликеров.', 'Кликер не входит в лигу факультетов: здесь очки растут просто от времени.'],
  run(el, ctx) {
    const U = [
      { id: 'kon', n: 'Конспект', d: '+1 за нажатие', p: 25, tap: 1 },
      { id: 'cof', n: 'Кофе из автомата', d: '+1 в секунду', p: 60, ps: 1 },
      { id: 'sta', n: 'Староста помогает', d: '+6 в секунду', p: 500, ps: 6 },
      { id: 'zac', n: 'Зачётка с пятёрками', d: '+8 за нажатие', p: 1500, tap: 8 },
      { id: 'lib', n: 'Абонемент в библиотеку', d: '+40 в секунду', p: 6000, ps: 40 },
      { id: 'gra', n: 'Грант ректора', d: '+250 в секунду', p: 50000, ps: 250 }];
    const S = Object.assign({ m: 0, tot: 0, own: {} }, LS.get('clicker', {}));
    const tap = () => 1 + U.reduce((s, u) => s + (u.tap || 0) * (S.own[u.id] || 0), 0);
    const ps = () => U.reduce((s, u) => s + (u.ps || 0) * (S.own[u.id] || 0), 0);
    const price = u => Math.round(u.p * 1.15 ** (S.own[u.id] || 0));
    const fmt = n => Math.floor(n).toLocaleString('ru-RU');
    const big = h('div', { style: { fontSize: '34px', fontWeight: 800, fontFamily: 'var(--f-num)' } });
    const sub = h('div', { class: 'hint', style: { textAlign: 'center' } });
    const coin = h('button', { 'aria-label': 'Монета', style: { width: '170px', height: '170px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#fff3b0,#ffd60a 45%,#e85d04)', boxShadow: '0 10px 30px rgba(232,93,4,.45), inset 0 -8px 0 rgba(0,0,0,.15)', fontSize: '28px', fontWeight: 800, color: '#7a3c00', transition: 'transform .06s', touchAction: 'manipulation' } }, 'БарГУ');
    const list = h('div', { style: { display: 'grid', gap: '8px', width: 'min(100%,440px)' } });
    let win = [];
    coin.addEventListener('pointerdown', e => {
      const now = Date.now(); win = win.filter(t => now - t < 1000); if (win.length >= 15) return; win.push(now);
      S.m += tap(); S.tot += tap(); coin.style.transform = 'scale(.94)'; setTimeout(() => coin.style.transform = '', 70);
      const f = h('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY - 20 + 'px', fontWeight: 800, color: 'var(--wa)', pointerEvents: 'none', transition: 'all .7s', zIndex: 50 } }, '+' + tap());
      document.body.append(f); requestAnimationFrame(() => { f.style.transform = 'translateY(-50px)'; f.style.opacity = 0; }); setTimeout(() => f.remove(), 700); draw();
    });
    const draw = () => {
      big.textContent = fmt(S.m) + ' ₽'; sub.textContent = `${tap()} за нажатие · ${ps()} в секунду · всего заработано ${fmt(S.tot)}`;
      ctx.score(S.tot); list.innerHTML = '';
      U.forEach(u => list.append(h('button', { class: 'mode', style: { margin: 0, background: 'var(--card)', boxShadow: 'var(--sh)' }, disabled: S.m < price(u), onclick: () => { if (S.m < price(u)) return; S.m -= price(u); S.own[u.id] = (S.own[u.id] || 0) + 1; draw(); } },
        h('div', { style: { flex: 1 } }, h('b', null, u.n + (S.own[u.id] ? ' ×' + S.own[u.id] : '')), h('small', null, u.d)), h('b', { class: 'tn' }, fmt(price(u)) + ' ₽'))));
      LS.set('clicker', S);
    };
    ctx.every(() => { S.m += ps() / 4; S.tot += ps() / 4; big.textContent = fmt(S.m) + ' ₽'; ctx.score(S.tot); }, 250);
    ctx.every(draw, 2000);
    el.append(big, sub, coin, list);
    btns(el, [['Записать результат в рейтинг', () => ctx.finish(Math.floor(S.tot), 'Прогресс сохранён, можно продолжать копить.')]]);
    draw();
    return () => LS.set('clicker', S);
  }
});
