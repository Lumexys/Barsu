/* ===== Панель владельца: игроки и рейтинги, пиксель-батл, комнаты ===== */
let ATAB = 'players', AROOT = null, AOPTS = {};
async function adminMount(root, opts) {
  AROOT = root; AOPTS = opts || {};
  root.innerHTML = ''; root.append(loading('Подключаемся к серверу игр…'));
  try { await loadMe(); } catch (e) { root.innerHTML = ''; root.append(errBox(e, () => adminMount(root, opts))); return; }
  if (!G.admin) { root.innerHTML = ''; root.append(h('div', { class: 'card' }, h('b', null, 'Нет доступа'), h('p', { class: 'hint' }, 'Сервер игр не признал этот аккаунт владельцем. Войдите почтой владельца.'))); return; }
  adminDraw();
}
function adminDraw() {
  const root = AROOT; root.innerHTML = '';
  PXEDIT = false; try { PXWS && PXWS.close(); } catch (e) { }
  if (AOPTS.back) root.append(h('button', { class: 'nb', type: 'button', onclick: () => { PXEDIT = false; AOPTS.back(); } }, '← Панель владельца'));
  root.append(h('h2', null, '🎮 Игры: управление'));
  const seg = h('div', { class: 'seg gseg' });
  [['players', 'Игроки'], ['pixel', 'Пиксели'], ['rooms', 'Комнаты']].forEach(([k, t]) => seg.append(h('button', { class: ATAB === k ? 'on' : '', type: 'button', onclick: () => { ATAB = k; adminDraw(); } }, t)));
  const body = h('div'); root.append(seg, body);
  ({ players: adminPlayers, pixel: adminPixel, rooms: adminRooms })[ATAB](body);
}
async function adminPlayers(body) {
  const q = h('input', { id: 'aq', placeholder: 'Поиск по имени или uid' }), list = h('div', { class: 'glb', style: { marginTop: '10px' } });
  let t = null; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
  body.append(q, list);
  const load = async () => {
    list.innerHTML = ''; list.append(loading());
    try {
      const r = await NET.req('/admin/players?q=' + encodeURIComponent(q.value.trim())); list.innerHTML = '';
      list.append(h('div', { class: 'hint', style: { padding: '8px 14px' } }, 'Всего игроков: ' + r.total));
      r.players.forEach(p => list.append(h('button', { class: 'glbr', type: 'button', style: { width: '100%', textAlign: 'left' }, onclick: () => adminPlayer(body, p.uid) },
        h('span', { class: 'n' }, p.banned ? '⛔' : Date.now() - p.seen < 3 * 60e3 ? '🟢' : '·'), h('span', { class: 'nm' }, h('span', { class: 'dotf', style: { background: fac(p.fac).color } }), h('span', null, p.name || '(без имени)')), h('span', { class: 'sc', style: { fontSize: '12px' } }, plural(p.games, 'игра', 'игры', 'игр')))));
      if (!r.players.length) list.append(h('div', { class: 'none' }, 'Никого не нашли'));
    } catch (e) { list.innerHTML = ''; list.append(errBox(e, load)); }
  };
  load();
}
async function adminPlayer(body, uid) {
  body.innerHTML = ''; body.append(loading());
  let r; try { r = await NET.req('/admin/player', { uid, get: true }); } catch (e) { body.innerHTML = ''; body.append(errBox(e)); return; }
  body.innerHTML = '';
  const p = r.profile || {}, stats = r.stats || {};
  const name = h('input', { value: p.name || '', maxlength: 40 }), facS = h('select', null, ...FACS.map(f => h('option', { value: f.id, selected: f.id === p.fac }, f.short + ' — ' + f.name)));
  const ban = h('input', { type: 'checkbox', style: { width: 'auto' } }); ban.checked = !!p.banned;
  const msg = h('div', { class: 'msg' });
  body.append(h('button', { class: 'back', type: 'button', onclick: () => adminDraw() }, '‹ К списку'),
    h('div', { class: 'card' }, h('label', null, 'Имя'), name, h('label', null, 'Факультет'), facS,
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, ban, 'Скрыть из рейтингов и не принимать результаты'),
      h('div', { class: 'hint' }, 'uid: ' + uid)));
  const rows = [];
  const tb = h('div', { class: 'glb' });
  GAMES.filter(g => g.cat !== 'party').forEach(g => {
    const s = stats[g.id] || {}, mp = isMP(g);
    const inp = h('input', { value: mp ? (s.e ?? '') : (s.b ?? ''), placeholder: mp ? 'Эло' : g.unit === 'time' ? 'секунды' : 'очки', inputmode: 'decimal', style: { width: '110px', padding: '8px 10px' } });
    rows.push({ g, inp, mp, was: inp.value });
    tb.append(h('div', { class: 'glbr', style: { gridTemplateColumns: '30px 1fr auto' } }, h('span', { class: 'n' }, g.icon), h('span', { class: 'nm' }, h('span', null, g.name + (s.n ? ' · ' + plural(s.n, 'партия', 'партии', 'партий') : '') + (mp && (s.w || s.l) ? ` · ${s.w || 0}/${s.l || 0}` : ''))), inp));
  });
  body.append(h('h2', null, 'Результаты сезона', h('span', { class: 'chip' }, mpNote())), h('p', { class: 'hint' }, 'Одиночные игры — лучший результат (для игр на время — в секундах). Игры с соперником — рейтинг Эло. Пустое поле удаляет результат.'), tb);
  const save = h('button', { class: 'go', type: 'button', onclick: async () => {
    save.disabled = true; msg.textContent = 'Сохраняем…';
    const scores = {}; rows.forEach(x => { if (x.inp.value.trim() !== x.was) scores[x.g.id] = x.mp ? { e: x.inp.value.trim() === '' ? null : +x.inp.value } : { b: x.inp.value.trim() === '' ? null : +x.inp.value.replace(',', '.') }; });
    try { await NET.req('/admin/player', { uid, name: name.value.trim(), fac: facS.value, banned: ban.checked, scores }); msg.textContent = 'Сохранено'; toast('Сохранено'); adminPlayer(body, uid); }
    catch (e) { msg.textContent = e.message; save.disabled = false; }
  } }, 'Сохранить');
  let sure = false;
  const reset = h('button', { class: 'nb red', type: 'button', style: { width: '100%', marginTop: '8px' }, onclick: async () => {
    if (!sure) { sure = true; reset.textContent = 'Точно обнулить все результаты? Нажмите ещё раз'; return; }
    try { await NET.req('/admin/player', { uid, resetAll: true }); toast('Результаты обнулены'); adminPlayer(body, uid); } catch (e) { msg.textContent = e.message; }
  } }, 'Обнулить все результаты игрока');
  body.append(save, reset, msg);
}
const mpNote = () => G.season ? G.season.name : '';
async function adminPixel(body) {
  body.append(loading());
  try { const r = await NET.req('/admin/pixel'); PXD = { ...r, px: pxDecode(r.data), at: Date.now() }; } catch (e) { body.innerHTML = ''; body.append(errBox(e, () => adminDraw())); return; }
  body.innerHTML = ''; PXEDIT = true;
  let color = 1, mode = 'brush', size = 1;
  const V = pxCanvas(c => { if (mode === 'move') return; paint(cellsAround(c)); });
  const cellsAround = c => { const o = []; const r = size >> 1; for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (x >= 0 && y >= 0 && x < PX && y < PX) o.push([x, y, color]); return o; };
  let stroke = new Map();
  V.paintDrag = (a, b) => {
    if (mode === 'move') return false;
    if (mode === 'rect') { V.rect = { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; V.draw(); return; }
    cellsAround(b).forEach(c => { stroke.set(c[0] + ',' + c[1], c); PXD.px[c[1] * PX + c[0]] = color; }); V.draw();
  };
  V.paintEnd = async (a, b) => {
    if (mode === 'rect') { V.rect = null; try { await NET.req('/admin/pixel', { op: 'rect', x0: a.x, y0: a.y, x1: b.x, y1: b.y, c: color }); } catch (e) { toast(e.message); } return; }
    if (mode === 'brush' && stroke.size) { const cells = [...stroke.values()]; stroke = new Map(); paint(cells); }
  };
  const origDrag = V.paintDrag; Object.defineProperty(V, 'paintDrag', { get: () => mode === 'move' ? null : origDrag });
  const paint = async cells => { cells.forEach(([x, y, c]) => PXD.px[y * PX + x] = c); V.draw(); try { await NET.req('/admin/pixel', { op: 'paint', cells }); } catch (e) { toast(e.message); } };
  const pal = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' } });
  const tools = h('div', { class: 'seg', style: { marginBottom: '8px' } }), sizes = h('div', { class: 'seg' });
  const drawTools = () => {
    pal.innerHTML = ''; [{ c: 0, n: 'Стереть', col: 'var(--bg)' }, ...FACS.map((f, i) => ({ c: i + 1, n: f.short, col: f.color }))].forEach(o => pal.append(h('button', { type: 'button', class: 'chip', style: { border: 0, cursor: 'pointer', background: o.col, color: o.c ? '#fff' : 'var(--tx)', boxShadow: color === o.c ? '0 0 0 3px var(--tx)' : 'inset 0 0 0 1px var(--br)', padding: '6px 12px' }, onclick: () => { color = o.c; drawTools(); } }, o.n)));
    tools.innerHTML = ''; [['brush', '🖌 Кисть'], ['rect', '▭ Прямоугольник'], ['move', '✋ Двигать']].forEach(([k, t]) => tools.append(h('button', { type: 'button', class: mode === k ? 'on' : '', onclick: () => { mode = k; drawTools(); } }, t)));
    sizes.innerHTML = ''; [1, 3, 7].forEach(s => sizes.append(h('button', { type: 'button', class: size === s ? 'on' : '', onclick: () => { size = s; drawTools(); } }, 'Кисть ' + s + '×' + s)));
  };
  drawTools();
  const cd = h('input', { value: PXD.cd, inputmode: 'numeric', style: { width: '100px' } });
  const endI = h('input', { type: 'datetime-local', value: new Date(PXD.end - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16) });
  const bonus = {}, bonusBox = h('div', { class: 'row' });
  FACS.forEach(f => { bonus[f.id] = h('input', { placeholder: f.short, inputmode: 'numeric', style: { minWidth: '0' } }); bonusBox.append(h('div', null, h('small', { class: 'hint' }, f.short), bonus[f.id])); });
  let sureClear = false, sureEnd = false;
  const op = async (b, ok) => { try { const r = await NET.req('/admin/pixel', b); Object.assign(PXD, { cd: r.cd, end: r.end, round: r.round }); toast(ok); } catch (e) { toast(e.message); } };
  const clearB = h('button', { class: 'nb red', type: 'button', onclick: async () => { if (!sureClear) { sureClear = true; clearB.textContent = 'Точно очистить всё полотно? Ещё раз'; return; } await op({ op: 'clear' }, 'Полотно очищено'); await pxLoad(true); V.draw(); sureClear = false; clearB.textContent = 'Очистить всё полотно'; } }, 'Очистить всё полотно');
  const endB = h('button', { class: 'nb red', type: 'button', onclick: async () => { if (!sureEnd) { sureEnd = true; endB.textContent = 'Подвести итоги и начать новый раунд? Ещё раз'; return; } await op({ op: 'end' }, 'Раунд завершён, очки начислены'); await pxLoad(true); V.draw(); sureEnd = false; endB.textContent = 'Завершить раунд сейчас'; } }, 'Завершить раунд сейчас');
  body.append(h('p', { class: 'hint' }, 'Кисть ставит клетки любого цвета без паузы. Прямоугольник — проведите пальцем от угла до угла. Изменения сразу видят все игроки.'), pal, tools, sizes, V.cv, V.zoom,
    h('div', { class: 'card' },
      h('label', null, 'Пауза между клетками, секунд'), h('div', { class: 'row' }, cd, h('button', { class: 'nb', type: 'button', style: { flex: '0 0 auto' }, onclick: () => op({ op: 'cooldown', sec: +cd.value }, 'Пауза изменена') }, 'Сохранить')),
      h('label', null, 'Конец текущего раунда (' + PXD.round + ')'), h('div', { class: 'row' }, endI, h('button', { class: 'nb', type: 'button', style: { flex: '0 0 auto' }, onclick: () => op({ op: 'end', ts: new Date(endI.value).getTime() }, 'Дата изменена') }, 'Сохранить')),
      h('div', { style: { display: 'grid', gap: '8px', marginTop: '12px' } }, h('button', { class: 'nb', type: 'button', onclick: () => op({ op: 'resetCooldowns' }, 'Паузы сброшены у всех') }, 'Сбросить паузы у всех игроков'), clearB, endB)),
    h('div', { class: 'card' }, h('label', null, 'Очки лиги за пиксель-батл в этом сезоне (вручную)'), bonusBox,
      h('button', { class: 'nb', type: 'button', style: { width: '100%', marginTop: '8px' }, onclick: async () => { const b = {}; FACS.forEach(f => { if (bonus[f.id].value.trim() !== '') b[f.id] = +bonus[f.id].value; }); try { await NET.req('/admin/pxbonus', { bonus: b }); toast('Сохранено'); } catch (e) { toast(e.message); } } }, 'Записать очки'), h('p', { class: 'hint' }, 'Заменяет накопленные за сезон очки пиксель-батла у указанных факультетов. Пустые поля — 0.')));
  V.draw();
  pxConnect(() => V.draw());
}
async function adminRooms(body) {
  const list = h('div', { class: 'glb' }, loading());
  const code = h('input', { placeholder: 'Код комнаты', inputmode: 'numeric', maxlength: 4, style: { width: '140px' } });
  body.append(h('div', { class: 'row', style: { marginBottom: '10px' } }, code, h('button', { class: 'nb', type: 'button', style: { flex: '0 0 auto' }, onclick: async () => { try { const r = await NET.req('/rooms/check', { code: code.value.trim() }); lobby(gameById(r.game), code.value.trim(), { admin: true }); } catch (e) { toast(e.message); } } }, 'Войти по коду')),
    h('p', { class: 'hint' }, 'Владелец входит в любую комнату, даже заполненную или с уже идущей партией: может смотреть, ходить за любого игрока, выгнать игрока, завершить партию с любым итогом или закрыть комнату.'), list,
    h('button', { class: 'nb', type: 'button', style: { width: '100%', marginTop: '8px' }, onclick: () => adminDraw() }, 'Обновить'));
  try {
    const r = await NET.req('/admin/rooms'); list.innerHTML = '';
    if (!r.rooms.length) list.append(h('div', { class: 'none' }, 'Сейчас комнат нет'));
    r.rooms.sort((a, b) => b.upd - a.upd).forEach(x => {
      const g = gameById(x.game); if (!g) return;
      list.append(h('div', { class: 'glbr', style: { gridTemplateColumns: '36px 1fr auto' } }, icon(g, 32),
        h('span', { class: 'nm' }, h('span', null, h('b', null, g.name + ' · ' + x.code), h('small', { style: { display: 'block', color: 'var(--mu)', fontSize: '12px' } }, `${x.n}/${x.max} · ${x.status === 'play' ? 'идёт партия' : x.status === 'end' ? 'партия окончена' : 'ждут'}${x.rated ? ' · рейтинг' : ''}${x.names && x.names.length ? ' · ' + x.names.join(', ') : ''}`))),
        h('span', { style: { display: 'flex', gap: '6px' } }, h('button', { class: 'chip g', type: 'button', style: { border: 0 }, onclick: () => lobby(g, x.code, { admin: true }) }, 'Войти'), h('button', { class: 'chip r', type: 'button', style: { border: 0 }, onclick: async () => { try { await NET.req('/admin/close-room', { code: x.code }); toast('Комната закрыта'); adminDraw(); } catch (e) { toast(e.message); } } }, 'Закрыть'))));
    });
  } catch (e) { list.innerHTML = ''; list.append(errBox(e)); }
}
