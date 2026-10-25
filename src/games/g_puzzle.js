/* ===== Головоломки ===== */
function timer(ctx) { const t0 = Date.now(); const id = ctx.every(() => ctx.score((Date.now() - t0) / 1000), 500); ctx.score(0); return () => { clearInterval(id); return Math.round((Date.now() - t0) / 1000); }; }
function kbRU(el, onKey, enterLabel = 'ОК') {
  const rows = ['йцукенгшщзхъ', 'фывапролджэ', '⌫ячсмитьбю↵'];
  const kb = h('div', { class: 'kb' }); const keys = {};
  rows.forEach(r => { const d = h('div'); [...r].forEach(ch => { const b = h('button', { class: '⌫↵'.includes(ch) ? 'wide' : '', onclick: () => onKey(ch === '⌫' ? 'BS' : ch === '↵' ? 'EN' : ch) }, ch === '↵' ? enterLabel : ch); keys[ch] = b; d.append(b); }); kb.append(d); });
  el.append(kb); return keys;
}
function physKeys(ctx, onKey) { ctx.key(e => { if (e.ctrlKey || e.metaKey) return; if (e.key === 'Backspace') onKey('BS'); else if (e.key === 'Enter') onKey('EN'); else if (/^[а-яё]$/i.test(e.key)) onKey(e.key.toLowerCase().replace('ё', 'е')); }); }

game({
  id: '2048', name: '2048', like: 'классика', cat: 'puzzle', icon: '🔢', c1: '#f6bd60', c2: '#f28482', demo: [600, 36000], minSec: 10,
  rules: ['Свайп или стрелки сдвигают все плитки.', 'Две одинаковые плитки при столкновении сливаются в одну.', 'Очки — сумма всех слияний. Игра заканчивается, когда ходов нет.'],
  run(el, ctx) {
    let g = Array(16).fill(0), sc = 0, over = false;
    const C = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', background: '#bbada0', padding: '8px', borderRadius: '14px', touchAction: 'none' } });
    el.append(bd); info(el, 'Свайп по полю или стрелки');
    const add = () => { const e = g.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) g[pick(e)] = Math.random() < .9 ? 2 : 4; };
    const draw = (nw = -1) => { bd.innerHTML = ''; g.forEach((v, i) => bd.append(h('div', { style: { background: v ? (C[v] || '#3c3a32') : 'rgba(238,228,218,.35)', color: v > 4 ? '#fff' : '#776e65', fontSize: v > 999 ? '22px' : v > 99 ? '28px' : '34px', fontFamily: 'var(--f-num)', borderRadius: '8px', animation: i === nw ? 'in .2s' : '' } }, v || ''))); ctx.score(sc); };
    const line = a => { const b = a.filter(Boolean); for (let i = 0; i < b.length - 1; i++) if (b[i] === b[i + 1]) { b[i] *= 2; sc += b[i]; b.splice(i + 1, 1); } while (b.length < 4) b.push(0); return b; };
    const move = k => {
      if (over) return; const old = g.join();
      for (let r = 0; r < 4; r++) {
        const idx = [0, 1, 2, 3].map(c => k === 'L' ? r * 4 + c : k === 'R' ? r * 4 + 3 - c : k === 'U' ? c * 4 + r : (3 - c) * 4 + r);
        const res = line(idx.map(i => g[i])); idx.forEach((i, j) => g[i] = res[j]);
      }
      if (g.join() !== old) { add(); draw(); }
      const can = g.some((v, i) => !v || (i % 4 < 3 && v === g[i + 1]) || (i < 12 && v === g[i + 4]));
      if (!can) { over = true; ctx.finish(sc, 'Лучшая плитка: ' + Math.max(...g)); }
    };
    swipe(ctx, bd, move); add(); add(); draw();
  }
});

game({
  id: 'match3', name: 'Три в ряд', like: 'классика', cat: 'puzzle', icon: '💎', c1: '#c77dff', c2: '#5a189a', demo: [800, 9000], minSec: 15,
  rules: ['Поменяйте местами две соседние фишки (нажмите одну, потом другую или проведите пальцем).', 'Три и больше одинаковых в ряд исчезают, сверху падают новые.', 'У вас 25 ходов. Цепочки дают бонус.'],
  run(el, ctx) {
    const N = 8, T = [['#ef476f', '♥'], ['#ffd166', '★'], ['#06d6a0', '♣'], ['#118ab2', '◆'], ['#9b5de5', '●'], ['#f78c6b', '▲']];
    let g, sel = null, moves = 25, sc = 0, busy = false;
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: `repeat(${N},1fr)`, background: 'var(--card)', padding: '6px', borderRadius: '16px', boxShadow: 'var(--sh)', touchAction: 'none' } });
    const inf = info(el); el.append(bd);
    const matches = () => { const m = new Set(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = g[r * N + c]; if (v < 0) continue; if (c < N - 2 && g[r * N + c + 1] === v && g[r * N + c + 2] === v) [0, 1, 2].forEach(k => m.add(r * N + c + k)); if (r < N - 2 && g[(r + 1) * N + c] === v && g[(r + 2) * N + c] === v) [0, 1, 2].forEach(k => m.add((r + k) * N + c)); } return m; };
    do { g = Array.from({ length: N * N }, () => rnd(6)); } while (matches().size);
    const draw = (gone = new Set()) => {
      bd.innerHTML = ''; g.forEach((v, i) => { const [col, sym] = v >= 0 ? T[v] : ['transparent', '']; const d = h('div', { 'data-i': i, style: { background: col, color: 'rgba(255,255,255,.9)', fontSize: '20px', borderRadius: '10px', boxShadow: sel === i ? '0 0 0 3px var(--tx)' : 'inset 0 -3px 0 rgba(0,0,0,.18)', transform: gone.has(i) ? 'scale(.2)' : sel === i ? 'scale(.9)' : '', opacity: gone.has(i) ? .3 : 1, transition: 'transform .18s,opacity .18s', cursor: 'pointer' } }, sym); bd.append(d); });
      inf.innerHTML = `Ходов осталось: <b>${moves}</b>`; ctx.score(sc);
    };
    const resolve = async () => {
      let chain = 1, m;
      while ((m = matches()).size) {
        sc += m.size * 10 * chain; draw(m); await sleep(220); if (!ctx.alive) return;
        m.forEach(i => g[i] = -1);
        for (let c = 0; c < N; c++) { const col = []; for (let r = N - 1; r >= 0; r--) if (g[r * N + c] >= 0) col.push(g[r * N + c]); for (let r = N - 1, k = 0; r >= 0; r--, k++) g[r * N + c] = k < col.length ? col[k] : rnd(6); }
        draw(); await sleep(180); chain++;
        if (chain === 3) ctx.toast('Цепочка ×' + chain, 900);
      }
    };
    const trySwap = async (a, b) => {
      if (busy || moves <= 0) return; const ra = a / N | 0, rb = b / N | 0; if (Math.abs(ra - rb) + Math.abs(a % N - b % N) !== 1) { sel = b; draw(); return; }
      busy = true; sel = null;[g[a], g[b]] = [g[b], g[a]]; draw();
      if (!matches().size) { await sleep(200);[g[a], g[b]] = [g[b], g[a]]; draw(); busy = false; return; }
      moves--; await resolve(); busy = false; draw();
      if (moves <= 0) ctx.finish(sc);
    };
    let st = null;
    ctx.on(bd, 'pointerdown', e => { const t = e.target.closest('[data-i]'); if (!t) return; st = { i: +t.dataset.i, x: e.clientX, y: e.clientY }; });
    ctx.on(bd, 'pointerup', e => {
      if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y, i = st.i; st = null;
      if (Math.hypot(dx, dy) > 20) { const j = Math.abs(dx) > Math.abs(dy) ? i + Math.sign(dx) : i + Math.sign(dy) * N; if (j >= 0 && j < N * N && (Math.abs(dx) <= Math.abs(dy) || (j / N | 0) === (i / N | 0))) trySwap(i, j); return; }
      if (sel == null) { sel = i; draw(); } else if (sel === i) { sel = null; draw(); } else trySwap(sel, i);
    });
    draw();
  }
});

game({
  id: 'blocks', name: 'Блоки', like: 'похоже на Block Blast', cat: 'puzzle', icon: '🟧', c1: '#4cc9f0', c2: '#3a0ca3', demo: [150, 4000], minSec: 10,
  rules: ['Перетащите фигуру на поле 8×8.', 'Заполненная строка или столбец исчезают и дают очки.', 'Несколько линий сразу и серии подряд — бонус.', 'Игра заканчивается, когда ни одна фигура не помещается.'],
  run(el, ctx) {
    const N = 8, COL = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f78c6b', '#4cc9f0'];
    const SH = [[[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 1], [2, 2]]];
    let g = Array(N * N).fill(-1), tray = [], sc = 0, streak = 0;
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: `repeat(${N},1fr)`, background: '#1b1f3b', padding: '6px', borderRadius: '16px', gap: '3px', touchAction: 'none' } });
    const tr = h('div', { style: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: 'min(100%,440px)', minHeight: '110px', touchAction: 'none' } });
    el.append(bd, tr); info(el, 'Тяните фигуру пальцем на поле');
    const fill = () => { tray = [0, 1, 2].map(() => ({ s: pick(SH), c: rnd(COL.length) })); };
    const fits = (s, r, c) => s.every(([a, b]) => r + a >= 0 && r + a < N && c + b >= 0 && c + b < N && g[(r + a) * N + c + b] < 0);
    const anyFit = s => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(s, r, c)) return true; return false; };
    let ghost = null;
    const draw = () => { drawB(); drawT(); };
    const drawB = () => {
      bd.innerHTML = '';
      g.forEach((v, i) => { const gh = ghost && ghost.cells.includes(i); bd.append(h('div', { style: { background: v >= 0 ? COL[v] : gh ? COL[ghost.c] + '88' : 'rgba(255,255,255,.06)', borderRadius: '5px', boxShadow: v >= 0 ? 'inset 0 -3px 0 rgba(0,0,0,.2)' : '' } })); });
      ctx.score(sc);
    };
    const drawT = () => {
      tr.innerHTML = '';
      tray.forEach((p, k) => {
        if (!p) { tr.append(h('div', { style: { width: '70px' } })); return; }
        const R = Math.max(...p.s.map(q => q[0])) + 1, C = Math.max(...p.s.map(q => q[1])) + 1;
        const pe = h('div', { 'data-k': k, style: { display: 'grid', gridTemplateColumns: `repeat(${C},16px)`, gridTemplateRows: `repeat(${R},16px)`, gap: '2px', padding: '8px', cursor: 'grab', opacity: anyFit(p.s) ? 1 : .35 } });
        p.s.forEach(([a, b]) => pe.append(h('i', { style: { gridRow: a + 1, gridColumn: b + 1, background: COL[p.c], borderRadius: '3px' } })));
        tr.append(pe);
      });
      ctx.score(sc);
    };
    let drag = null;
    ctx.on(tr, 'pointerdown', e => {
      const pe = e.target.closest('[data-k]'); if (!pe) return; const k = +pe.dataset.k, p = tray[k];
      const cs = bd.getBoundingClientRect().width / N;
      const R = Math.max(...p.s.map(q => q[0])) + 1, C = Math.max(...p.s.map(q => q[1])) + 1;
      const fl = h('div', { style: { position: 'fixed', zIndex: 50, pointerEvents: 'none', display: 'grid', gridTemplateColumns: `repeat(${C},${cs - 3}px)`, gridTemplateRows: `repeat(${R},${cs - 3}px)`, gap: '3px', opacity: .9 } });
      p.s.forEach(([a, b]) => fl.append(h('i', { style: { gridRow: a + 1, gridColumn: b + 1, background: COL[p.c], borderRadius: '5px' } })));
      document.body.append(fl); drag = { k, p, fl, R, C, cs }; pe.style.opacity = .2; mv(e);
    });
    const mv = e => {
      if (!drag) return; const { fl, R, C, cs, p } = drag; const lx = e.clientX - C * cs / 2, ly = e.clientY - R * cs - 40;
      fl.style.left = lx + 'px'; fl.style.top = ly + 'px';
      const r0 = bd.getBoundingClientRect(); const r = Math.round((ly - r0.top - 6) / cs), c = Math.round((lx - r0.left - 6) / cs);
      drag.r = r; drag.c = c; const ok = fits(p.s, r, c); const prev = ghost && ghost.cells.join();
      ghost = ok ? { cells: p.s.map(([a, b]) => (r + a) * N + c + b), c: p.c } : null;
      if ((ghost && ghost.cells.join()) !== prev) drawB();
    };
    ctx.on(window, 'pointermove', mv);
    ctx.on(window, 'pointerup', () => {
      if (!drag) return; const { k, p, r, c, fl } = drag; fl.remove(); drag = null; ghost = null;
      if (fits(p.s, r, c)) {
        p.s.forEach(([a, b]) => g[(r + a) * N + c + b] = p.c); sc += p.s.length; tray[k] = null;
        const full = []; for (let i = 0; i < N; i++) { const row = [...Array(N)].map((_, j) => i * N + j), col = [...Array(N)].map((_, j) => j * N + i); if (row.every(q => g[q] >= 0)) full.push(row); if (col.every(q => g[q] >= 0)) full.push(col); }
        if (full.length) { streak++; const pts = full.length * 10 * full.length * streak; sc += pts; full.flat().forEach(q => g[q] = -1); ctx.toast((full.length > 1 ? 'Линий: ' + full.length + '! ' : '') + (streak > 1 ? 'Серия ×' + streak + ' ' : '') + '+' + pts, 900); } else streak = 0;
        if (tray.every(t => !t)) fill();
      }
      draw();
      if (tray.filter(Boolean).every(t => !anyFit(t.s))) ctx.later(() => ctx.finish(sc, 'Фигуры больше не помещаются'), 500);
    });
    fill(); draw();
  }
});

/* Судоку: генерация полного решения и удаление цифр с проверкой единственности */
function sudokuGen(holes) {
  const g = Array(81).fill(0);
  const ok = (g, i, v) => { const r = i / 9 | 0, c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + (k / 3 | 0)) * 9 + bc + k % 3] === v) return false; return true; };
  const fillG = i => { if (i === 81) return true; if (g[i]) return fillG(i + 1); for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (ok(g, i, v)) { g[i] = v; if (fillG(i + 1)) return true; } g[i] = 0; return false; };
  fillG(0); const sol = g.slice();
  const count = (p, lim) => { let n = 0; const rec = () => { const i = p.indexOf(0); if (i < 0) { n++; return; } for (let v = 1; v <= 9 && n < lim; v++) if (ok(p, i, v)) { p[i] = v; rec(); p[i] = 0; } }; rec(); return n; };
  const puz = sol.slice(); let removed = 0;
  for (const i of shuffle([...Array(81).keys()])) { if (removed >= holes) break; const v = puz[i]; puz[i] = 0; if (count(puz.slice(), 2) !== 1) puz[i] = v; else removed++; }
  return { puz, sol };
}
game({
  id: 'sudoku', name: 'Судоку', like: 'классика', cat: 'puzzle', icon: '9️⃣', c1: '#90e0ef', c2: '#0077b6', unit: 'time', demo: [200, 1400], minSec: 30, minTime: 45,
  rules: ['Заполните поле так, чтобы в каждой строке, столбце и квадрате 3×3 были цифры от 1 до 9 без повторов.', 'Выберите клетку, затем цифру внизу.', 'Ошибки подсвечиваются красным. Рейтинг — по времени, у лёгкого и среднего уровня таблица общая (в приложении будут раздельные).'],
  run(el, ctx) {
    const lv = h('div', { class: 'seg', style: { width: 'min(100%,320px)' } }); el.append(h('div', { class: 'card', style: { width: 'min(100%,360px)', textAlign: 'center' } }, h('b', null, 'Выберите уровень'), h('div', { style: { height: '10px' } }), lv));
    ctx.score('');
    [['Лёгкий', 38], ['Средний', 48], ['Сложный', 55]].forEach(([t, n]) => lv.append(h('button', { onclick: () => { el.innerHTML = ''; play(n); } }, t)));
    const play = holes => {
      const { puz, sol } = sudokuGen(holes); const g = puz.slice(); let sel = -1, errs = 0; const stop = timer(ctx);
      const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(9,1fr)', gap: '0', background: 'var(--tx)', padding: '2px', borderRadius: '10px', width: 'min(100%,420px)' } });
      const pad = h('div', { class: 'bar2', style: { flexWrap: 'nowrap' } }); const inf = info(el);
      el.append(bd, pad);
      const draw = () => {
        bd.innerHTML = ''; const sv = sel >= 0 ? g[sel] : 0;
        g.forEach((v, i) => {
          const r = i / 9 | 0, c = i % 9, same = sel >= 0 && (r === (sel / 9 | 0) || c === sel % 9 || ((r / 3 | 0) === ((sel / 9 | 0) / 3 | 0) && (c / 3 | 0) === ((sel % 9) / 3 | 0)));
          const bad = v && v !== sol[i];
          bd.append(h('button', { onclick: () => { sel = i; draw(); }, style: { aspectRatio: 1, background: i === sel ? 'var(--ac)' : (v && v === sv) ? 'var(--ac2)' : same ? 'color-mix(in srgb,var(--ac2) 55%,var(--card))' : 'var(--card)', color: i === sel ? '#fff' : bad ? 'var(--rd)' : puz[i] ? 'var(--tx)' : 'var(--ac)', fontWeight: puz[i] ? 800 : 600, fontSize: '19px', fontFamily: 'var(--f-num)', borderRight: c % 3 === 2 && c < 8 ? '2px solid var(--tx)' : '1px solid var(--br)', borderBottom: r % 3 === 2 && r < 8 ? '2px solid var(--tx)' : '1px solid var(--br)', borderRadius: 0 } }, v || ''));
        });
        inf.innerHTML = `Ошибок: <b>${errs}</b> · пустых клеток: <b>${g.filter(v => !v).length}</b>`;
      };
      const put = v => {
        if (sel < 0 || puz[sel]) return; g[sel] = v; if (v && v !== sol[sel]) errs++; draw();
        if (g.every((x, i) => x === sol[i])) { const t = stop(); ctx.finish(t, 'Ошибок: ' + errs); }
      };
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(n => pad.append(h('button', { class: 'nb', style: { minWidth: 0, padding: '12px 0', fontSize: '18px', fontFamily: 'var(--f-num)' }, onclick: () => put(n) }, n)));
      pad.append(h('button', { class: 'nb red', style: { minWidth: 0, padding: '12px 0' }, onclick: () => put(0) }, '⌫'));
      ctx.key(e => { if (/^[1-9]$/.test(e.key)) put(+e.key); if (e.key === 'Backspace' || e.key === '0') put(0); const m = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; if (m && sel >= 0) { sel = clamp(sel + m, 0, 80); draw(); e.preventDefault(); } });
      draw();
    };
  }
});

game({
  id: 'mines', name: 'Сапёр', like: 'классика', cat: 'puzzle', icon: '💣', c1: '#adb5bd', c2: '#495057', unit: 'time', demo: [20, 240], minSec: 4, minTime: 5,
  rules: ['Откройте все клетки без мин. Цифра — сколько мин рядом.', 'Режим «Флажок» или долгое нажатие ставит флажок.', 'Первое нажатие всегда безопасно. Поле 9×9, 10 мин.'],
  run(el, ctx) {
    const N = 9, M = 10; let mines = null, open = Array(N * N).fill(false), flag = Array(N * N).fill(false), fm = false, over = false, stop = null;
    const nb = i => { const r = i / N | 0, c = i % N, o = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && r + a >= 0 && r + a < N && c + b >= 0 && c + b < N) o.push((r + a) * N + c + b); return o; };
    const cnt = i => nb(i).filter(j => mines[j]).length;
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: `repeat(${N},1fr)`, gap: '3px', width: 'min(100%,400px)' } });
    const mb = h('button', { class: 'nb' }); const inf = info(el); el.append(bd, h('div', { class: 'bar2' }, mb));
    mb.onclick = () => { fm = !fm; draw(); }; ctx.score(0);
    const NC = ['', '#1d4ed8', '#15803d', '#dc2626', '#7c3aed', '#b45309', '#0e7490', '#111', '#6b7280'];
    const draw = (boom = -1) => {
      bd.innerHTML = '';
      for (let i = 0; i < N * N; i++) {
        const o = open[i], m = mines && mines[i], n = o && !m ? cnt(i) : 0;
        bd.append(h('button', { 'data-i': i, style: { background: o ? (i === boom ? 'var(--rd)' : 'var(--card)') : 'linear-gradient(145deg,#8d99ae,#6c7a91)', borderRadius: '6px', color: NC[n], fontSize: '17px', fontFamily: 'var(--f-num)', boxShadow: o ? 'inset 0 0 0 1px var(--br)' : 'inset 0 -3px 0 rgba(0,0,0,.2)' } }, o ? (m ? '💣' : n || '') : flag[i] ? '🚩' : ''));
      }
      mb.textContent = fm ? '🚩 Режим: флажки' : '⛏ Режим: открывать'; mb.className = 'nb' + (fm ? ' red' : '');
      inf.innerHTML = `Мин: <b>${M}</b> · флажков: <b>${flag.filter(Boolean).length}</b>`;
    };
    const boom = i => { if (over) return; over = true; mines.forEach((m, j) => { if (m) open[j] = true; }); draw(i); stop(); ctx.later(() => { overlayMsg(el, 'Бах! 💥', 'Это была мина. Результат не засчитывается.', 'Сыграть ещё', () => { closeGame(true); openGame(ctx.g); }); }, 300); };
    const reveal = i => { if (open[i] || flag[i]) return; open[i] = true; if (!mines[i] && cnt(i) === 0) nb(i).forEach(reveal); };
    const act = (i, asFlag) => {
      if (over) return;
      if (asFlag) { if (!open[i]) flag[i] = !flag[i]; draw(); return; }
      if (flag[i]) return;
      if (!mines) { mines = Array(N * N).fill(false); const safe = new Set([i, ...nb(i)]); let k = 0; while (k < M) { const j = rnd(N * N); if (!mines[j] && !safe.has(j)) { mines[j] = true; k++; } } stop = timer(ctx); }
      if (open[i]) { const f = nb(i).filter(j => flag[j]).length; if (f === cnt(i)) nb(i).forEach(j => { if (!flag[j] && !open[j]) { if (mines[j]) { boom(j); } else reveal(j); } }); if (over) return; }
      else if (mines[i]) { boom(i); return; }
      else reveal(i);
      draw();
      if (!over && open.filter(Boolean).length === N * N - M) { over = true; ctx.finish(stop()); }
    };
    let pt = null, lp = false;
    ctx.on(bd, 'pointerdown', e => { const b = e.target.closest('[data-i]'); if (!b) return; lp = false; pt = setTimeout(() => { lp = true; act(+b.dataset.i, true); if (navigator.vibrate) navigator.vibrate(20); }, 420); });
    ctx.on(bd, 'pointerup', e => { clearTimeout(pt); const b = e.target.closest('[data-i]'); if (!b || lp) return; act(+b.dataset.i, fm); });
    ctx.on(bd, 'contextmenu', e => e.preventDefault());
    draw();
  }
});

game({
  id: 'nonogram', name: 'Японский рисунок', like: 'нонограммы', cat: 'puzzle', icon: '🖼️', c1: '#ffafcc', c2: '#cdb4db', unit: 'time', demo: [90, 900], minSec: 20, minTime: 25,
  rules: ['Числа слева и сверху — длины закрашенных отрезков в строке и столбце, по порядку.', 'Между отрезками хотя бы одна пустая клетка.', 'Режим «крестик» помечает клетки, которые точно пустые.', 'Принимается любое решение, подходящее под все подсказки.'],
  run(el, ctx) {
    const N = 10; let sol;
    do { sol = Array.from({ length: N * N }, () => Math.random() < .58); } while (sol.filter(Boolean).length < 45);
    const runs = a => { const o = []; let k = 0; a.forEach(v => { if (v) k++; else if (k) { o.push(k); k = 0; } }); if (k) o.push(k); return o.length ? o : [0]; };
    const row = (g, r) => g.slice(r * N, r * N + N), col = (g, c) => [...Array(N)].map((_, r) => g[r * N + c]);
    const RC = [...Array(N)].map((_, r) => runs(row(sol, r))), CC = [...Array(N)].map((_, c) => runs(col(sol, c)));
    const g = Array(N * N).fill(0); let mode = 1, stop = timer(ctx), done = false;
    const wrap = h('div', { style: { display: 'grid', gridTemplateColumns: `auto repeat(${N},1fr)`, gap: '2px', width: 'min(100%,430px)', touchAction: 'none', fontFamily: 'var(--f-num)' } });
    const mb = h('button', { class: 'nb' }); el.append(wrap, h('div', { class: 'bar2' }, mb));
    mb.onclick = () => { mode = mode === 1 ? 2 : 1; draw(); };
    const ok = (g) => [...Array(N)].every((_, i) => runs(row(g.map(v => v === 1), i)).join() === RC[i].join() && runs(col(g.map(v => v === 1), i)).join() === CC[i].join());
    const draw = () => {
      wrap.innerHTML = ''; wrap.append(h('div'));
      const cur = g.map(v => v === 1);
      CC.forEach((c, i) => wrap.append(h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', fontSize: '11px', fontWeight: 700, lineHeight: 1.15, color: runs(col(cur, i)).join() === c.join() ? 'var(--ok)' : 'var(--mu)', paddingBottom: '3px' } }, ...c.map(n => h('span', null, n)))));
      for (let r = 0; r < N; r++) {
        wrap.append(h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end', fontSize: '11px', fontWeight: 700, paddingRight: '4px', color: runs(row(cur, r)).join() === RC[r].join() ? 'var(--ok)' : 'var(--mu)', whiteSpace: 'nowrap' } }, RC[r].join(' ')));
        for (let c = 0; c < N; c++) { const i = r * N + c, v = g[i]; wrap.append(h('div', { 'data-i': i, style: { aspectRatio: 1, background: v === 1 ? '#3d2c8d' : 'var(--card)', borderRadius: '4px', display: 'grid', placeItems: 'center', color: 'var(--mu)', fontSize: '13px', boxShadow: 'inset 0 0 0 1px var(--br)', marginRight: c % 5 === 4 && c < N - 1 ? '3px' : 0, marginBottom: r % 5 === 4 && r < N - 1 ? '3px' : 0 } }, v === 2 ? '✕' : '')); }
      }
      mb.textContent = mode === 1 ? '■ Режим: закрашивать' : '✕ Режим: крестики';
    };
    let paint = null;
    const at = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.closest('[data-i]') ? +t.closest('[data-i]').dataset.i : -1; };
    ctx.on(wrap, 'pointerdown', e => { const i = at(e); if (i < 0 || done) return; paint = g[i] === mode ? 0 : mode; g[i] = paint; draw(); });
    ctx.on(window, 'pointermove', e => { if (paint == null) return; const i = at(e); if (i >= 0 && g[i] !== paint) { g[i] = paint; draw(); } });
    ctx.on(window, 'pointerup', () => { if (paint == null) return; paint = null; if (ok(g)) { done = true; ctx.finish(stop(), 'Получился узор из ' + g.filter(v => v === 1).length + ' клеток'); } });
    draw();
  }
});

const CONNECT = [
  [['Шоколадные батончики', ['Марс', 'Сникерс', 'Твикс', 'Баунти']], ['Планеты', ['Венера', 'Сатурн', 'Нептун', 'Юпитер']], ['Танцы', ['Вальс', 'Танго', 'Полька', 'Самба']], ['Реки Беларуси', ['Неман', 'Припять', 'Березина', 'Сож']]],
  [['Студенческая жизнь', ['Зачёт', 'Сессия', 'Пара', 'Стипендия']], ['Шахматные фигуры', ['Ладья', 'Конь', 'Ферзь', 'Слон']], ['Знаки зодиака', ['Овен', 'Телец', 'Лев', 'Весы']], ['Животные Африки', ['Жираф', 'Зебра', 'Бегемот', 'Носорог']]],
  [['Части компьютера', ['Мышь', 'Монитор', 'Процессор', 'Клавиатура']], ['Грызуны', ['Хомяк', 'Белка', 'Бобр', 'Крыса']], ['Ягоды', ['Клюква', 'Черника', 'Малина', 'Брусника']], ['Музыкальные инструменты', ['Гитара', 'Скрипка', 'Арфа', 'Флейта']]],
  [['Города Беларуси', ['Барановичи', 'Пинск', 'Лида', 'Орша']], ['Женские имена', ['Вера', 'Надежда', 'Любовь', 'Ирина']], ['Оттенки цвета', ['Бирюзовый', 'Алый', 'Лазурный', 'Сиреневый']], ['Погода', ['Ливень', 'Метель', 'Гроза', 'Туман']]],
  [['Педагоги', ['Макаренко', 'Ушинский', 'Сухомлинский', 'Коменский']], ['В математике', ['Корень', 'Степень', 'Дробь', 'Модуль']], ['Части дерева', ['Ствол', 'Ветка', 'Лист', 'Кора']], ['Зимний спорт', ['Хоккей', 'Биатлон', 'Слалом', 'Керлинг']]],
  [['Столицы', ['Минск', 'Вильнюс', 'Рига', 'Варшава']], ['Мультгерои', ['Колобок', 'Буратино', 'Чебурашка', 'Незнайка']], ['Кухонная посуда', ['Кастрюля', 'Сковорода', 'Чайник', 'Половник']], ['Кофе', ['Латте', 'Капучино', 'Эспрессо', 'Раф']]]
];
game({
  id: 'connect', name: 'Четвёрки', like: 'похоже на «Связи»', cat: 'puzzle', icon: '🧩', c1: '#ffd166', c2: '#ef476f', demo: [20, 100], minSec: 15,
  rules: ['16 слов делятся на 4 группы по 4 слова.', 'Выберите четыре слова, которые считаете группой, и нажмите «Проверить».', 'Можно ошибиться 3 раза, четвёртая ошибка — конец.', 'Остерегайтесь ловушек: некоторые слова подходят к двум темам.', 'Очки: 100 минус 20 за каждую ошибку.'],
  run(el, ctx) {
    const P = CONNECT[rnd(CONNECT.length)], CL = ['#f9df6d', '#a0c35a', '#b0c4ef', '#ba81c5'];
    let left = shuffle(P.flatMap(([t, ws], k) => ws.map(w => ({ w, k })))), sel = [], solved = [], mist = 0;
    const sv = h('div', { style: { display: 'grid', gap: '6px', width: 'min(100%,440px)' } });
    const bd = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', width: 'min(100%,440px)' } });
    const inf = info(el); el.append(sv, bd);
    const bb = btns(el, [['Перемешать', () => { shuffle(left); draw(); }], ['Снять выбор', () => { sel = []; draw(); }], ['Проверить', () => check()]]);
    ctx.score(0);
    const draw = () => {
      sv.innerHTML = ''; solved.forEach(k => sv.append(h('div', { style: { background: CL[k], color: '#1a1a1a', borderRadius: '12px', padding: '10px', textAlign: 'center' } }, h('b', { style: { display: 'block', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '.04em' } }, P[k][0]), h('span', { style: { fontSize: '14px' } }, P[k][1].join(', ')))));
      bd.innerHTML = ''; left.forEach(it => bd.append(h('button', { onclick: () => { const i = sel.indexOf(it); if (i >= 0) sel.splice(i, 1); else if (sel.length < 4) sel.push(it); draw(); }, style: { height: '62px', borderRadius: '12px', background: sel.includes(it) ? 'var(--tx)' : 'var(--card)', color: sel.includes(it) ? 'var(--bg)' : 'var(--tx)', boxShadow: 'var(--sh)', fontWeight: 700, fontSize: it.w.length > 9 ? '11px' : it.w.length > 7 ? '12.5px' : '14px', textTransform: 'uppercase', padding: '2px', overflowWrap: 'anywhere' } }, it.w)));
      inf.innerHTML = 'Ошибок осталось: ' + '●'.repeat(4 - mist) + '○'.repeat(mist);
    };
    const check = () => {
      if (sel.length !== 4) return ctx.toast('Выберите ровно 4 слова');
      const ks = sel.map(s => s.k);
      if (ks.every(k => k === ks[0])) { solved.push(ks[0]); left = left.filter(i => !sel.includes(i)); sel = []; draw(); if (solved.length === 4) ctx.finish(100 - mist * 20, 'Ошибок: ' + mist); }
      else { mist++; const near = Math.max(...[0, 1, 2, 3].map(k => ks.filter(x => x === k).length)) === 3; ctx.toast(near ? 'Почти! Одно слово лишнее' : 'Это не группа'); draw(); if (mist >= 4) { const got = solved.length; solved = solved.concat([0, 1, 2, 3].filter(k => !solved.includes(k))); left = []; draw(); ctx.finish(got * 10, 'Ошибки закончились. Угадано групп: ' + got); } }
    };
    draw();
  }
});

const CW_WORDS = [['сессия', 'Время экзаменов'], ['зачёт', 'Оценка без баллов: сдал или нет'], ['декан', 'Руководитель факультета'], ['ректор', 'Руководитель университета'], ['лекция', 'Занятие, где говорит в основном преподаватель'], ['конспект', 'Краткая запись лекции'], ['стипендия', 'Ежемесячная выплата студенту'], ['кафедра', 'Подразделение факультета'], ['диплом', 'Документ об окончании вуза'], ['курсовая', 'Большая работа раз в год'], ['аудитория', 'Комната для занятий'], ['староста', 'Главный в группе'], ['общежитие', 'Где живут иногородние студенты'], ['семинар', 'Занятие с обсуждением'], ['педагог', 'Учитель, воспитатель'], ['урок', 'Занятие в школе'], ['оценка', 'Пятёрка, например'], ['журнал', 'Туда ставят отметки'], ['звонок', 'Сигнал конца урока'], ['мел', 'Им пишут на доске'], ['доска', 'На ней пишут мелом'], ['пенал', 'Футляр для ручек'], ['тетрадь', 'В клетку или в линейку'], ['учебник', 'Книга для занятий'], ['каникулы', 'Перерыв в учёбе'], ['экзамен', 'Главное испытание сессии'], ['билет', 'Его тянут на экзамене'], ['шпаргалка', 'Тайная подсказка'], ['библиотека', 'Где выдают книги'], ['практика', 'Работа в школе или на предприятии во время учёбы'], ['реферат', 'Небольшая письменная работа по источникам'], ['вожатый', 'Работает с детьми в лагере'], ['отряд', 'Группа в лагере'], ['лагерь', 'Летом туда едут дети'], ['барановичи', 'Город, где находится БарГУ'], ['минск', 'Столица Беларуси'], ['неман', 'Самая длинная река Беларуси в её пределах'], ['зубр', 'Символ Беловежской пущи'], ['аист', 'Птица, символ Беларуси'], ['драники', 'Картофельное блюдо'], ['пуща', 'Беловежская …'], ['озеро', 'Нарочь — самое большое …'], ['глобус', 'Модель Земли'], ['атлас', 'Сборник карт'], ['формула', 'E = mc², например'], ['теорема', 'Утверждение, которое доказывают'], ['алфавит', 'Все буквы по порядку'], ['словарь', 'Книга со значениями слов'], ['поэма', 'Большое стихотворение'], ['роман', 'Большое прозаическое произведение'], ['кофе', 'Напиток перед первой парой'], ['перемена', 'Перерыв между уроками'], ['ручка', 'Ею пишут'], ['рюкзак', 'Носят на спине'], ['наука', 'Систематическое знание'], ['опыт', 'Эксперимент'], ['метод', 'Способ, приём'], ['игра', 'То, во что вы сейчас играете'], ['декабрь', 'Месяц зимней сессии'], ['январь', 'Месяц, когда сессия заканчивается']];
function cwGen(target = 11, S = 15) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const words = shuffle(CW_WORDS.map(([w, c]) => [w.replace('ё', 'е'), c])), G = {}, placed = [];
    const at = (x, y) => G[x + ',' + y];
    const can = (w, x, y, dx, dy) => {
      let cross = 0;
      if (at(x - dx, y - dy) || at(x + dx * w.length, y + dy * w.length)) return -1;
      for (let i = 0; i < w.length; i++) {
        const cx = x + dx * i, cy = y + dy * i; if (cx < 0 || cy < 0 || cx >= S || cy >= S) return -1;
        const c = at(cx, cy);
        if (c) { if (c !== w[i]) return -1; cross++; }
        else if (at(cx + dy, cy + dx) || at(cx - dy, cy - dx)) return -1;
      }
      return cross;
    };
    const put = (w, c, x, y, dx, dy) => { for (let i = 0; i < w.length; i++) G[(x + dx * i) + ',' + (y + dy * i)] = w[i]; placed.push({ w, c, x, y, dx, dy }); };
    const first = words.find(([w]) => w.length >= 7 && w.length <= S); put(first[0], first[1], Math.floor((S - first[0].length) / 2), 7, 1, 0);
    for (const [w, c] of words) {
      if (placed.length >= target) break; if (placed.some(p => p.w === w) || w.length > S) continue;
      let best = null;
      for (const p of placed) for (let i = 0; i < p.w.length; i++) for (let j = 0; j < w.length; j++) {
        if (p.w[i] !== w[j]) continue; const dx = p.dy, dy = p.dx, x = p.x + p.dx * i - dx * j, y = p.y + p.dy * i - dy * j;
        const k = can(w, x, y, dx, dy); if (k > 0 && (!best || k > best.k)) best = { x, y, dx, dy, k };
      }
      if (best) put(w, c, best.x, best.y, best.dx, best.dy);
    }
    if (placed.length >= target - 1 || attempt === 29) {
      let x0 = S, y0 = S, x1 = 0, y1 = 0; Object.keys(G).forEach(k => { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      placed.forEach(p => { p.x -= x0; p.y -= y0; });
      return { placed, w: x1 - x0 + 1, hh: y1 - y0 + 1 };
    }
  }
}
game({
  id: 'crossword', name: 'Кроссворд', like: 'студенческий', cat: 'puzzle', icon: '✏️', c1: '#e9edc9', c2: '#a3b18a', unit: 'time', demo: [150, 1100], minSec: 30, minTime: 40,
  rules: ['Нажмите на клетку или вопрос, чтобы выбрать слово. Повторное нажатие на клетку меняет направление.', 'Вводите буквы с экранной клавиатуры. Буква «ё» пишется как «е».', 'Неверные буквы подсвечиваются после проверки. Рейтинг — по времени.'],
  run(el, ctx) {
    const { placed, w: W, hh: H } = cwGen();
    placed.sort((a, b) => a.y - b.y || a.x - b.x);
    const cells = {}; let num = 1; const starts = {};
    placed.forEach(p => { const k = p.x + ',' + p.y; if (!starts[k]) starts[k] = num++; p.n = starts[k]; for (let i = 0; i < p.w.length; i++) cells[(p.x + p.dx * i) + ',' + (p.y + p.dy * i)] = { a: p.w[i], v: '', bad: false }; });
    let cur = placed[0], pos = 0; const stop = timer(ctx);
    const bd = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${W},1fr)`, gap: '2px', width: `min(100%,${Math.min(440, W * 34)}px)` } });
    const clue = h('div', { class: 'card', style: { width: 'min(100%,440px)', margin: 0, padding: '10px 14px', fontSize: '15px' } });
    el.append(clue, bd);
    const kb = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center' } }); el.append(kb);
    const list = h('div', { style: { width: 'min(100%,440px)', fontSize: '13px', lineHeight: 1.5 } }); el.append(list);
    const cellOf = (p, i) => (p.x + p.dx * i) + ',' + (p.y + p.dy * i);
    const draw = () => {
      bd.innerHTML = ''; const on = new Set([...Array(cur.w.length)].map((_, i) => cellOf(cur, i)));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = x + ',' + y, c = cells[k];
        if (!c) { bd.append(h('div', { style: { aspectRatio: 1 } })); continue; }
        const isCur = k === cellOf(cur, pos);
        bd.append(h('button', { 'data-k': k, style: { aspectRatio: 1, position: 'relative', background: isCur ? 'var(--ac)' : on.has(k) ? 'var(--ac2)' : 'var(--card)', color: isCur ? '#fff' : c.bad ? 'var(--rd)' : 'var(--tx)', borderRadius: '4px', boxShadow: 'inset 0 0 0 1px var(--br)', fontWeight: 700, fontSize: 'min(4.2vw,17px)', textTransform: 'uppercase' } }, starts[k] ? h('span', { style: { position: 'absolute', left: '2px', top: '0', fontSize: '8px', fontWeight: 600, opacity: .75 } }, starts[k]) : null, c.v));
      }
      clue.innerHTML = `<b>${cur.n} ${cur.dx ? '→' : '↓'}</b> ${esc(cur.c)} <span class="hint">(${cur.w.length} б.)</span>`;
      list.innerHTML = ''; [['По горизонтали', 1], ['По вертикали', 0]].forEach(([t, d]) => { list.append(h('b', { style: { display: 'block', marginTop: '6px' } }, t)); placed.filter(p => p.dx === d).forEach(p => list.append(h('div', { style: { cursor: 'pointer', color: p === cur ? 'var(--ac)' : [...p.w].every((_, i) => cells[cellOf(p, i)].v) ? 'var(--mu)' : 'var(--tx)' }, onclick: () => { cur = p; pos = 0; draw(); } }, p.n + '. ' + p.c))); });
    };
    ctx.on(bd, 'click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k;
      const ws = placed.filter(p => [...p.w].some((_, i) => cellOf(p, i) === k));
      if (ws.includes(cur) && cellOf(cur, pos) === k && ws.length > 1) cur = ws.find(p => p !== cur); else if (!ws.includes(cur)) cur = ws[0];
      pos = [...cur.w].findIndex((_, i) => cellOf(cur, i) === k); draw();
    });
    const key = ch => {
      if (ch === 'BS') { const k = cellOf(cur, pos); if (!cells[k].v && pos > 0) pos--; cells[cellOf(cur, pos)].v = ''; draw(); return; }
      if (ch === 'EN') { check(true); return; }
      const c = cells[cellOf(cur, pos)]; c.v = ch; c.bad = false; if (pos < cur.w.length - 1) pos++;
      else { const i = placed.indexOf(cur); const nx = placed.slice(i + 1).concat(placed.slice(0, i)).find(p => [...p.w].some((_, j) => !cells[cellOf(p, j)].v)); if (nx) { cur = nx; pos = [...nx.w].findIndex((_, j) => !cells[cellOf(nx, j)].v); } }
      draw(); check(false);
    };
    const check = show => {
      const all = Object.values(cells); if (all.every(c => c.v === c.a)) { ctx.finish(stop()); return; }
      if (show) { all.forEach(c => c.bad = c.v && c.v !== c.a); draw(); ctx.toast('Неверные буквы подсвечены красным'); }
    };
    kbRU(kb, key, '✓'); physKeys(ctx, key); draw();
  }
});
