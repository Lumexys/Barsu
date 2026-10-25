import { build, transform } from "esbuild";
import fs from "fs";
fs.mkdirSync("www", { recursive: true });
fs.copyFileSync("src/index.html", "www/index.html");
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "iife",
  outfile: "www/app.bundle.js",
  minify: true,
  target: "es2020"
});
console.log("bundle ok");

// Раздел «Игры»: отдельный файл www/games.js, загружается только при открытии раздела.
// Файлы из src/games склеиваются по алфавиту (00-core.js первым, 99-boot.js последним) в одну функцию.
const dir = "src/games";
const parts = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort((a, b) => {
  const k = f => f.startsWith("99") ? 2 : /^\d/.test(f) ? 0 : 1;
  return k(a) - k(b) || a.localeCompare(b);
});
const css = fs.readFileSync(dir + "/games.css", "utf8");
const src = "(function(){'use strict';\n" +
  "if(window.BarsuGames)return;\n" +
  "var st=document.createElement('style');st.id='games-css';st.textContent=" + JSON.stringify(css) + ";document.head.appendChild(st);\n" +
  parts.map(f => "/* " + f + " */\n" + fs.readFileSync(dir + "/" + f, "utf8")).join("\n") + "\n})();";
const out = await transform(src, { minify: true, target: "es2020", charset: "utf8" });
fs.writeFileSync("www/games.js", out.code);
console.log("games ok: " + parts.length + " файлов, " + Math.round(out.code.length / 1024) + " КБ");
