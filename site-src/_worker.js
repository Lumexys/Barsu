import { handleGames, GameHub, GamePixel, GameRoom } from "./games-server.js";
export { GameHub, GamePixel, GameRoom };

// Сайт «Студенту БарГУ» на Cloudflare: отдаёт страницу и файлы, а /api/* запрашивает расписание с rasp.barsu.by.
// Работает и как Cloudflare Pages (_worker.js в папке сайта), и как Worker со статическими файлами (binding ASSETS).
const BASE = "https://rasp.barsu.by/";
const CP1251 = "\u0402\u0403\u201a\u0453\u201e\u2026\u2020\u2021\u20ac\u2030\u0409\u2039\u040a\u040c\u040b\u040f\u0452\u2018\u2019\u201c\u201d\u2022\u2013\u2014\ufffd\u2122\u0459\u203a\u045a\u045c\u045b\u045f\u00a0\u040e\u045e\u0408\u00a4\u0490\u00a6\u00a7\u0401\u00a9\u0404\u00ab\u00ac\u00ad\u00ae\u0407\u00b0\u00b1\u0406\u0456\u0491\u00b5\u00b6\u00b7\u0451\u2116\u0454\u00bb\u0458\u0405\u0455\u0457\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f";
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

const dec = s => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const ok = v => typeof v === "string" && v.length <= 200;

function charsetOf(ct, buf) {
  const m1 = /charset=([\w-]+)/i.exec(ct || "");
  let cs;
  if (m1) cs = m1[1].toLowerCase();
  else {
    let head = "";
    for (let i = 0; i < Math.min(buf.length, 2048); i++) head += String.fromCharCode(buf[i]);
    const m = /charset=["']?([\w-]+)/i.exec(head);
    cs = m ? m[1].toLowerCase() : "utf-8";
  }
  return cs === "cp1251" || cs === "windows1251" ? "windows-1251" : cs;
}
function decode(buf, cs) {
  if (cs === "windows-1251") {
    let o = "";
    for (let i = 0; i < buf.length; i++) { const b = buf[i]; o += b < 128 ? String.fromCharCode(b) : CP1251[b - 128]; }
    return o;
  }
  try { return new TextDecoder(cs).decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
let rev;
function enc(s, cs) {
  if (cs !== "windows-1251") return encodeURIComponent(s).replace(/%20/g, "+");
  if (!rev) { rev = new Map(); for (let i = 0; i < 128; i++) rev.set(CP1251[i], i + 128); }
  let o = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) o += /[A-Za-z0-9*\-._]/.test(ch) ? ch : (ch === " " ? "+" : "%" + c.toString(16).toUpperCase().padStart(2, "0"));
    else if (rev.has(ch)) o += "%" + rev.get(ch).toString(16).toUpperCase().padStart(2, "0");
  }
  return o;
}
async function req(url, opt = {}) {
  const h = { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "ru,en;q=0.8" };
  if (opt.cookie) h.Cookie = opt.cookie;
  if (opt.body) { h["Content-Type"] = "application/x-www-form-urlencoded"; h.Referer = opt.referer || url; h.Origin = "https://rasp.barsu.by"; }
  const r = await fetch(url, { method: opt.body ? "POST" : "GET", headers: h, body: opt.body, redirect: "follow" });
  const buf = new Uint8Array(await r.arrayBuffer());
  const cs = charsetOf(r.headers.get("content-type"), buf);
  let cookie = "";
  const sc = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : (r.headers.get("set-cookie") ? [r.headers.get("set-cookie")] : []);
  cookie = sc.map(c => c.split(";")[0]).filter(Boolean).join("; ");
  return { status: r.status, cs, cookie, text: decode(buf, cs) };
}
function selects(h) {
  const out = {};
  for (const m of h.matchAll(/<select[^>]*\bname=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/select>/gi)) {
    out[m[1]] = [...m[2].matchAll(/<option([^>]*)>([^<]*)/gi)].map(o => {
      const v = /value=["']([^"']*)["']/i.exec(o[1]), c = /class=["']([^"']*)["']/i.exec(o[1]);
      return { v: dec(v ? v[1] : o[2]).trim(), t: dec(o[2]).trim(), c: c ? dec(c[1]).trim() : "" };
    }).filter(o => o.v && o.v !== "selectcard");
  }
  return out;
}
async function options(kind) {
  const r = await req(BASE + (kind === "teach" ? "teach.php" : "stud.php"));
  if (r.status !== 200) return [502, { error: "upstream", status: r.status }];
  const data = selects(r.text);
  if (!Object.keys(data).length) return [502, { error: "no selects found" }];
  return [200, data];
}
async function schedule(b) {
  const st = b.kind !== "teach", p = {};
  if (![b.week, ...(st ? [b.faculty, b.speciality, b.groups] : [b.kafedra, b.teacher])].every(ok)) return [400, { error: "bad input" }];
  if (st) { p.faculty = b.faculty; p.speciality = b.speciality; p.groups = b.groups; p.weekbegindate = b.week; p.date = ""; }
  else { p.kafedra = b.kafedra; p.teacher = b.teacher; p.weekbegindate = b.week; }
  p.go = "Показать";
  const target = BASE + (st ? "stud.php" : "teach.php");
  const g = await req(target); // cookie сессии и кодировка страницы
  const body = Object.entries(p).map(([k, v]) => enc(k, g.cs) + "=" + enc(v, g.cs)).join("&");
  const r = await req(target, { body, referer: target, cookie: g.cookie });
  const h = r.text;
  let i = h.search(/Расписание\s+на\s+неделю/i);
  if (i < 0) {
    let best = -1, bestLen = 0;
    for (const m of h.matchAll(/<table[\s\S]*?<\/table>/gi)) if (m[0].length > bestLen) { bestLen = m[0].length; best = m.index; }
    if (bestLen > 1500) i = best;
  }
  if (i < 0) return [200, { html: "" }];
  const e = h.indexOf("</table>", i);
  const html = h.slice(i, e < 0 ? undefined : e + 8)
    .replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  return [200, { html }];
}
const json = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {}) });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // раздел «Игры»: профили, рейтинги, пиксель-батл, комнаты (см. games-server.js)
    if (url.pathname.startsWith("/api/g/") || url.pathname === "/api/g") {
      try { return await handleGames(request, env); }
      catch (e) { return json(500, { error: "games", detail: String(e && e.message || e) }); }
    }
    if (url.pathname.startsWith("/api/")) {
      try {
        if (url.pathname === "/api/options" && request.method === "GET") {
          const kind = url.searchParams.get("kind") === "teach" ? "teach" : "stud";
          // списки групп меняются редко: кешируем на 30 минут
          const cache = caches.default, key = new Request(url.origin + "/api/options?kind=" + kind);
          const hit = await cache.match(key);
          if (hit) return hit;
          const [s, b] = await options(kind);
          const res = json(s, b, s === 200 ? { "Cache-Control": "public, max-age=1800" } : null);
          if (s === 200) ctx.waitUntil(cache.put(key, res.clone()));
          return res;
        }
        if (url.pathname === "/api/schedule" && request.method === "POST") {
          let b; try { b = await request.json(); } catch (e) { return json(400, { error: "bad json" }); }
          const [s, body] = await schedule(b || {});
          return json(s, body);
        }
        return json(404, { error: "not found" });
      } catch (e) {
        return json(502, { error: "upstream", detail: String(e && e.message || e) });
      }
    }
    const res = await env.ASSETS.fetch(request);
    if (url.pathname.endsWith(".apk") && res.ok) {
      const h = new Headers(res.headers);
      h.set("Content-Type", "application/vnd.android.package-archive");
      h.set("Content-Disposition", 'attachment; filename="studentu-bargu.apk"');
      h.set("Cache-Control", "no-cache");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  }
};
