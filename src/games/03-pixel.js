/* ===== Пиксель-батл: общее полотно 128×128 на сервере ===== */
const PX = 128, PXN = PX * PX;
let PXD = null, PXWS = null, PXTIMER = null;
const pxDecode = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function pxLoad(force) {
  if (PXD && !force && Date.now() - PXD.at < 20e3) return PXD;
  const r = await NET.req('/pixel');
  PXD = { ...r, px: pxDecode(r.data), at: Date.now() }; delete PXD.data;
  return PXD;
}
const pxLeft = () => PXD ? Math.max(0, PXD.next - (Date.now() - PXD.at)) : 0;
function pxShares() { const c = [0, 0, 0, 0, 0]; for (const v of PXD.px) c[v]++; return c; }
function pxImage(px) {
  const img = new ImageData(PX, PX), cols = [[0, 0, 0, 0], ...FACS.map(f => { const n = parseInt(f.color.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255, 255]; })];
  for (let i = 0; i < PXN; i++) img.data.set(cols[px[i]] || cols[0], i * 4);
  return img;
}
async function pxThumb(c, st) {
  try {
    await pxLoad(); c.getContext('2d').putImageData(pxImage(PXD.px), 0, 0);
    const sh = pxShares(), best = FACS.map((f, i) => [f, sh[i + 1]]).sort((a, b) => b[1] - a[1])[0];
    const left = pxLeft();
    st.textContent = (best[1] ? `Лидирует ${best[0].short} · ${(best[1] / PXN * 100).toFixed(1)}% полотна · ` : 'Полотно пока пустое · ') + (left ? 'клетка через ' + Math.ceil(left / 1000) + ' с' : 'можно поставить клетку');
  } catch (e) { st.textContent = 'Нет связи с сервером'; }
}
function pxConnect(onUpd) {
  try { if (PXWS) PXWS.close(); } catch (e) { }
  NET.ws('/pixel/ws').then(ws => {
    PXWS = ws;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t !== 'px' || !PXD) return;
      if (m.c === 'reset') { pxLoad(true).then(onUpd); return; }
      m.c.forEach(([x, y, c]) => { PXD.px[y * PX + x] = c; }); onUpd();
    };
    ws.onclose = () => { if (PXWS === ws) { PXWS = null; setTimeout(() => { if (VIEW === 'pixel' || PXEDIT) pxConnect(onUpd); }, 3000); } };
  }).catch(() => { });
}
// холст с приближением: используется и в игре, и в панели владельца
function pxCanvas(onPick) {
  const S = Math.min(448, (ROOT ? ROOT.clientWidth : innerWidth - 32) || 360);
  const cv = h('canvas', { width: S * 2, height: S * 2, style: { width: S + 'px', height: S + 'px', borderRadius: '16px', boxShadow: 'var(--sh)', touchAction: 'none', display: 'block', background: 'var(--card)', imageRendering: 'pixelated', maxWidth: '100%' } });
  const x = cv.getContext('2d'), off = h('canvas', { width: PX, height: PX }), ox = off.getContext('2d');
  const V = { z: 1, cx: 64, cy: 64, sel: null, rect: null, color: '#5b5bf0' };
  V.draw = () => {
    if (!PXD) return;
    ox.putImageData(pxImage(PXD.px), 0, 0);
    const cell = S * 2 / PX * V.z, vw = PX / V.z;
    V.cx = clamp(V.cx, vw / 2, PX - vw / 2); V.cy = clamp(V.cy, vw / 2, PX - vw / 2);
    x.fillStyle = cssv('--card') || '#fff'; x.fillRect(0, 0, S * 2, S * 2);
    x.imageSmoothingEnabled = false;
    x.globalAlpha = .12; x.fillStyle = cssv('--mu') || '#888'; x.fillRect(0, 0, S * 2, S * 2); x.globalAlpha = 1;
    x.drawImage(off, (V.cx - vw / 2) * -cell, (V.cy - vw / 2) * -cell, PX * cell, PX * cell);
    if (V.z >= 4) { x.strokeStyle = 'rgba(128,128,160,.25)'; x.lineWidth = 1; for (let i = 0; i <= vw + 1; i++) { const p = (i - (V.cx - vw / 2) % 1) * cell; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S * 2); x.moveTo(0, p); x.lineTo(S * 2, p); x.stroke(); } }
    const box = (a, b, w, hh) => { const sx = (a - (V.cx - vw / 2)) * cell, sy = (b - (V.cy - vw / 2)) * cell; x.lineWidth = 3; x.strokeStyle = V.color; x.strokeRect(sx - 2, sy - 2, cell * w + 4, cell * hh + 4); };
    if (V.sel) box(V.sel.x, V.sel.y, 1, 1);
    if (V.rect) box(Math.min(V.rect.x0, V.rect.x1), Math.min(V.rect.y0, V.rect.y1), Math.abs(V.rect.x1 - V.rect.x0) + 1, Math.abs(V.rect.y1 - V.rect.y0) + 1);
  };
  const toCell = e => { const r = cv.getBoundingClientRect(), vw = PX / V.z; return { x: Math.floor(V.cx - vw / 2 + (e.clientX - r.left) / r.width * vw), y: Math.floor(V.cy - vw / 2 + (e.clientY - r.top) / r.height * vw) }; };
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: V.cx, cy: V.cy, moved: false, c0: toCell(e) }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved && V.paintDrag) { V.paintDrag(drag.c0, toCell(e)); return; }
    if (drag.moved) { const r = cv.getBoundingClientRect(), k = PX / V.z / r.width; V.cx = drag.cx - dx * k; V.cy = drag.cy - dy * k; V.draw(); }
  });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved) { const c = toCell(e); if (c.x >= 0 && c.y >= 0 && c.x < PX && c.y < PX) onPick(c); } else if (drag && V.paintEnd) V.paintEnd(drag.c0, toCell(e)); drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); V.z = clamp(e.deltaY < 0 ? V.z * 2 : V.z / 2, 1, 16); V.draw(); }, { passive: false });
  V.cv = cv;
  V.zoom = h('div', { class: 'row', style: { margin: '10px 0' } }, h('button', { class: 'nb', type: 'button', onclick: () => { V.z = clamp(V.z / 2, 1, 16); V.draw(); } }, '− Отдалить'), h('button', { class: 'nb', type: 'button', onclick: () => { V.z = clamp(V.z * 2, 1, 16); V.draw(); } }, '+ Приблизить'));
  return V;
}
async function renderPixel() {
  ROOT.append(gamesHead('pixel'));
  if (!G.server) { ROOT.append(h('div', { class: 'none' }, 'Пиксель-батл работает, когда есть связь с сервером')); return; }
  const box = h('div', null, loading()); ROOT.append(box);
  try { await pxLoad(true); } catch (e) { box.innerHTML = ''; box.append(errBox(e, () => show('pixel'))); return; }
  box.innerHTML = '';
  const myColor = fac(G.me && G.me.fac).color;
  const V = pxCanvas(c => { V.sel = c; if (V.z < 4) { V.z = 8; V.cx = c.x + .5; V.cy = c.y + .5; } V.draw(); upd(); });
  V.color = myColor;
  const put = h('button', { class: 'go', type: 'button' }), st = h('div', { class: 'card' }), sub = h('p', { class: 'sub' });
  const upd = () => {
    if (VIEW !== 'pixel') return;
    const left = pxLeft();
    if (left) { put.disabled = true; const s = Math.ceil(left / 1000); put.textContent = 'Следующая клетка через ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    else { put.disabled = !V.sel; put.textContent = V.sel ? `Закрасить клетку ${V.sel.x}:${V.sel.y}` : 'Выберите клетку на полотне'; }
    put.style.background = myColor;
    const c = pxShares(); st.innerHTML = '';
    st.append(h('div', { style: { display: 'flex', height: '12px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg)' } }, ...FACS.map((f, i) => h('i', { style: { width: c[i + 1] / PXN * 100 + '%', background: f.color } }))));
    FACS.map((f, i) => [f, c[i + 1]]).sort((a, b) => b[1] - a[1]).forEach(([f, n], i) => st.append(h('div', { class: 'glbr', style: { padding: '8px 0', gridTemplateColumns: '24px 1fr auto' } }, h('span', { class: 'n' }, i + 1), h('span', { class: 'nm' }, h('span', { class: 'dotf', style: { background: f.color } }), h('span', null, f.short + (G.me && f.id === G.me.fac ? ' (ваш)' : ''))), h('span', { class: 'sc' }, (n / PXN * 100).toFixed(1) + '%'))));
    const hrs = Math.max(0, Math.round((PXD.end - Date.now()) / 36e5));
    sub.textContent = `Раунд ${PXD.round} · до воскресенья, 23:59 (осталось ~${plural(hrs, 'час', 'часа', 'часов')}) · вы поставили ${plural(PXD.mine || 0, 'клетку', 'клетки', 'клеток')}`;
  };
  put.onclick = async () => {
    if (!V.sel) return; put.disabled = true;
    try { const r = await NET.req('/pixel', { x: V.sel.x, y: V.sel.y }); Object.assign(PXD, { next: r.next, at: Date.now(), mine: r.mine, shares: r.shares }); PXD.px[V.sel.y * PX + V.sel.x] = FACS.findIndex(f => f.id === G.me.fac) + 1; toast('Клетка закрашена!'); }
    catch (e) { if (e.data && e.data.next) { PXD.next = e.data.next; PXD.at = Date.now(); } toast(e.message); }
    V.draw(); upd();
  };
  box.append(sub, V.cv, V.zoom, put, h('h2', null, 'Кто сколько захватил'), st,
    h('div', { class: 'gnote' }, h('h3', null, 'Правила'),
      h('ul', null, h('li', null, 'Полотно 128 × 128 = 16 384 клетки, общее для всего университета.'), h('li', null, `Одна клетка раз в ${Math.round(PXD.cd / 60) || 1} мин, только цветом своего факультета.`), h('li', null, 'Чужие клетки можно перекрашивать.'), h('li', null, 'Раунд длится неделю. Места по доле полотна дают лиге 150 / 100 / 50 / 0 очков, потом полотно очищается.'), h('li', null, 'Касание — выбрать клетку и приблизить, перетаскивание — двигать полотно.'))));
  V.draw(); upd();
  pxConnect(() => { V.draw(); upd(); });
  clearInterval(PXTIMER); PXTIMER = setInterval(() => { if (VIEW !== 'pixel' || !ROOT || !ROOT.isConnected || !ROOT.offsetParent) { clearInterval(PXTIMER); try { PXWS && PXWS.close(); } catch (e) { } PXWS = null; return; } upd(); }, 1000);
}
let PXEDIT = false;
