/* ===== Точка входа: приложение вызывает BarsuGames.mount(...) ===== */
let INVSTARTED = false;
async function mount(root, opts = {}) {
  ROOT = root; OPTS = opts; root.classList.add('bgx');
  NET.native = !!opts.native; NET.base = (opts.base || '').replace(/\/$/, ''); NET.dev = opts.dev || null;
  root.innerHTML = ''; root.append(loading());
  if (!NET.dev) {
    let user = null; try { user = window.GroupsApi ? await window.GroupsApi.user() : null; } catch (e) { }
    if (!user) { G.server = false; return show(window.GroupsApi ? 'signin' : 'hub'); }
  }
  try { await loadMe(); flushQueue(); try { if (G.me && G.me.name && !JSON.parse(localStorage.getItem('grp_name') || '""')) localStorage.setItem('grp_name', JSON.stringify(G.me.name)); } catch (e) { } }
  catch (e) { if (e.status === 401) return show('signin'); G.server = false; }
  if (G.server && (!G.me || !G.me.name || G.me.needFac)) return show('setup');
  show(opts.view || 'hub');
  startInvites();
}
function startInvites() { if (!INVSTARTED && G.server) { INVSTARTED = true; pollInvites(); INVT = setInterval(() => { if (ROOT && ROOT.isConnected && ROOT.offsetParent) pollInvites(); }, 15000); } }
window.BarsuGames = {
  mount,
  admin: (root, opts = {}) => { NET.native = !!opts.native; NET.base = (opts.base || '').replace(/\/$/, ''); NET.dev = opts.dev || null; return adminMount(root, opts); },
  // для плитки на главной: место факультета в лиге (берётся из кэша)
  tile: () => { try { return localStorage.getItem('games_tile') || ''; } catch (e) { return ''; } },
  get open() { return !!CUR; },
  close: () => closeGame(true),
  // для автопроверок: список игр и запуск по id
  _ids: () => GAMES.map(g => [g.id, isMP(g) ? (g.modes || ['bot', 'hot']) : ['solo']]),
  _px: () => PXD ? [...PXD.px].reduce((a, v) => (a[v]++, a), [0, 0, 0, 0, 0]) : null,
  _inv: () => INV.length,
  _open: (id, mode) => openGame(gameById(id), mode === 'solo' ? undefined : mode)
};
