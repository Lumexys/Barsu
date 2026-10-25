// Сборка сайта: та же страница и тот же бандл, что в приложении + воркер Cloudflare и APK для скачивания.
// Запуск: npm run site (сначала собирается бандл, затем папка site/)
import fs from "fs";
const out = "site";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ["index.html", "app.bundle.js", "games.js"]) fs.copyFileSync("www/" + f, out + "/" + f);
for (const f of ["_worker.js", "games-server.js", ".assetsignore", "studentu-bargu.apk"]) {
  if (fs.existsSync("site-src/" + f)) fs.copyFileSync("site-src/" + f, out + "/" + f);
  // APK сюда кладёт сборка в GitHub (build.yml) сразу после сборки приложения
}
console.log("site ok");
