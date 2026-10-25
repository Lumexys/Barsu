/* ===== Общая логика очереди ходов для игр с соперником (бот, один телефон, онлайн) ===== */
function endTwo(ctx, winner, names) { // winner: 0 — первый игрок, 1 — второй, -1 — ничья
  if (ctx.net) ctx.ranks(winner < 0 ? [0, 0] : winner === 0 ? [0, 1] : [1, 0], winner < 0 ? 'Ничья' : names[winner] + ' побеждает');
  else if (ctx.mode === 'hot') ctx.match('draw', winner < 0 ? 'Ничья' : names[winner] + ' победил!');
  else ctx.match(winner < 0 ? 'draw' : winner === 0 ? 'win' : 'loss');
}
// p — номер игрока (0 или 1, в онлайне это номер места за столом)
function duel(ctx, hotNames) {
  const net = ctx.net, on = !!net, hot = ctx.mode === 'hot';
  const D = {
    on, hot, net,
    names: on ? net.seats.map(s => s.name) : hot ? hotNames : ['Вы', 'Бот'],
    label(p) { return on && net.seat === p ? 'вы' : D.names[p]; },
    mine(p) { return on ? net.seat === p : hot ? true : p === 0; },
    bot(p) { return !on && !hot && p === 1; },
    // свой ход: в онлайне отправляем на сервер (применится, когда вернётся), иначе применяем сразу
    waiting: false,
    move(m, apply) { if (on) { if (D.waiting) return; D.waiting = true; setTimeout(() => D.waiting = false, 4000); net.send(m); } else apply(m); },
    listen(fn) { if (on) net.onAct((s, a) => { D.waiting = false; try { fn(s, a); } catch (e) { console.error(e); } }); }
  };
  if (on) D.names = D.names.map((n, i) => net.seats[i] && net.isMe(net.seats[i]) ? n + ' (вы)' : n);
  return D;
}

/* ===== Игры реального времени онлайн: место 0 считает игру, остальные присылают ввод ===== */
function hostNet(ctx) {
  const net = ctx.net; if (!net) return null;
  const R = { net, host: net.seat === 0, seat: net.seat, inputs: {}, last: null };
  net.onInput((s, d) => { R.inputs[s] = d; });
  net.onState(d => { R.last = d; });
  net.onLeft(s => { R.inputs[s] = null; });
  let lastSent = 0, lastIn = '', lastInT = 0;
  // состояние — 15 раз в секунду, ввод — только когда меняется (не чаще 20 раз в секунду)
  R.send = (d, force) => { const t = performance.now(); if (force || t - lastSent > 66) { lastSent = t; net.state(d); } };
  R.input = d => { if (net.seat < 0) return; const s = JSON.stringify(d), t = performance.now(); if ((s !== lastIn && t - lastInT > 50) || t - lastInT > 700) { lastIn = s; lastInT = t; net.input(d); } };
  return R;
}
const r1 = v => Math.round(v * 10) / 10;
