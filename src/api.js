// Порт логики воркера: запросы к rasp.barsu.by идут напрямую с телефона.
import { registerPlugin, Capacitor } from "@capacitor/core";

const Http = registerPlugin("BarsuHttp");
const BASE = "https://rasp.barsu.by/";

const dec = s => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const ok = v => typeof v === "string" && v.length <= 200;

function b64ToBytes(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function charsetOf(ct, buf) {
  const m1 = /charset=([\w-]+)/i.exec(ct || "");
  let cs;
  if (m1) cs = m1[1].toLowerCase();
  else {
    const m = /charset=["']?([\w-]+)/i.exec(new TextDecoder("latin1").decode(buf.slice(0, 2048)));
    cs = m ? m[1].toLowerCase() : "utf-8";
  }
  return cs === "cp1251" ? "windows-1251" : cs;
}
function decode(buf, cs) {
  try { return new TextDecoder(cs).decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
async function req(o) {
  const r = await Http.request(o);
  const buf = b64ToBytes(r.data);
  const cs = charsetOf(r.contentType, buf);
  return { status: r.status, url: r.url, cs, text: decode(buf, cs) };
}

let rev;
function enc(s, cs) {
  if (cs !== "windows-1251") return encodeURIComponent(s).replace(/%20/g, "+");
  if (!rev) {
    rev = new Map();
    const d = new TextDecoder("windows-1251");
    for (let b = 0x80; b < 256; b++) rev.set(d.decode(Uint8Array.of(b)), b);
  }
  let o = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) o += /[A-Za-z0-9*\-._]/.test(ch) ? ch : (ch === " " ? "+" : "%" + c.toString(16).toUpperCase().padStart(2, "0"));
    else if (rev.has(ch)) o += "%" + rev.get(ch).toString(16).toUpperCase().padStart(2, "0");
  }
  return o;
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
  const page = kind === "teach" ? "teach.php" : "stud.php";
  const r = await req({ url: BASE + page, method: "GET" });
  if (r.status !== 200) return { status: 502, body: { error: "upstream", status: r.status } };
  const data = selects(r.text);
  if (!Object.keys(data).length) return { status: 502, body: { error: "no selects found" } };
  return { status: 200, body: data };
}

async function schedule(b) {
  const st = b.kind !== "teach", p = {};
  if (![b.week, ...(st ? [b.faculty, b.speciality, b.groups] : [b.kafedra, b.teacher])].every(ok))
    return { status: 400, body: { error: "bad input" } };
  if (st) { p.faculty = b.faculty; p.speciality = b.speciality; p.groups = b.groups; p.weekbegindate = b.week; p.date = ""; }
  else { p.kafedra = b.kafedra; p.teacher = b.teacher; p.weekbegindate = b.week; }
  p.go = "Показать";
  const target = BASE + (st ? "stud.php" : "teach.php");
  const g = await req({ url: target, method: "GET" }); // получаем cookie и кодировку
  const body = Object.entries(p).map(([k, v]) => enc(k, g.cs) + "=" + enc(v, g.cs)).join("&");
  const r = await req({ url: target, method: "POST", body, referer: target });
  const h = r.text;
  let i = h.search(/Расписание\s+на\s+неделю/i);
  if (i < 0) {
    let best = -1, bestLen = 0;
    for (const m of h.matchAll(/<table[\s\S]*?<\/table>/gi)) if (m[0].length > bestLen) { bestLen = m[0].length; best = m.index; }
    if (bestLen > 1500) i = best;
  }
  if (i < 0) return { status: 200, body: { html: "" } };
  const e = h.indexOf("</table>", i);
  const html = h.slice(i, e < 0 ? undefined : e + 8)
    .replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  return { status: 200, body: { html } };
}

// Подменяем fetch("/api/...") на локальные вызовы, чтобы страница работала без изменений.
export function installApi() {
  if (!Capacitor.isNativePlatform()) return;
  const orig = window.fetch.bind(window);
  window.fetch = async (u, o) => {
    const s = typeof u === "string" ? u : (u && u.url) || "";
    if (s.startsWith("/api/")) {
      try {
        let res;
        if (s.startsWith("/api/options")) res = await options(new URL(s, "http://x").searchParams.get("kind"));
        else if (s.startsWith("/api/schedule")) res = await schedule(JSON.parse(o.body));
        else res = { status: 404, body: { error: "not found" } };
        return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "upstream", detail: String(e && e.message || e) }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
    }
    return orig(u, o);
  };
}
