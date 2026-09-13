#!/usr/bin/env node
/*!
 * Favicon sistemi regresyonları.
 *
 * NEDEN: faviconun bozulması SESSİZ bir hatadır. Sayfa açılır, araç
 * çalışır, yalnızca sekme şeridinde yanlış ya da eksik bir simge durur —
 * ve kimse hata bildirmez. Bu sistem 2026-09-13'te tam da bu yüzden
 * yeniden yazıldı: 28 sayfa genel markaya düşüyordu ve kap rengi sitenin
 * beş paletinin dördüyle çelişiyordu.
 *
 * Korunan dört kural:
 *   1. Faviconun renkleri style.css'ten KOPMAZ (tek doğruluk kaynağı).
 *   2. Her sayfanın bağlandığı favicon dosyası GERÇEKTEN VARDIR.
 *   3. Eski yeşil gradyan geri gelmez.
 *   4. decorpalette kendi markasını korur (KeyMint 2026-09-13'te katıldı).
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek) {
  if (b !== bek) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (!k) {
    hata++;
    console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : ""));
  } else { gecen++; console.log("  tamam      " + ad); }
}
function oku(p) { return fs.readFileSync(path.join(KOK, p), "utf8"); }

/* Sitedeki bütün favicon.svg dosyaları. */
var ATLA = { ".git": 1, "_cekirdek": 1, node_modules: 1, __pycache__: 1 };
function tara(dizin, out) {
  fs.readdirSync(path.join(KOK, dizin || "."), { withFileTypes: true })
    .forEach(function (d) {
      var p = dizin ? dizin + "/" + d.name : d.name;
      if (d.isDirectory()) { if (!ATLA[d.name]) tara(p, out); }
      else if (d.name === "favicon.svg") out.push(p);
    });
  return out;
}
var hepsi = tara("", []);
/* KeyMint 2026-09-13'te sisteme katildi; tek alt proje decorpalette
   kaldi (paleti UC RENKLI NOKTAYLA anlam tasiyor). */
var ALT_PROJE = /^decorpalette\//;
var bizim = hepsi.filter(function (p) { return !ALT_PROJE.test(p); });

/* ------------------------------------------------------------------ */
console.log("Renkler style.css'ten kopmuyor");
var css = oku("style.css");
function token(ad) {
  var m = css.match(new RegExp("--" + ad + ":\\s*(#[0-9a-f]{3,8})", "i"));
  return m ? m[1].toLowerCase() : null;
}
var MUREKKEP = token("text");      // #17201d
var KAGIT = token("bg");           // #f5f7f6
var VURGU = token("accent");       // #0e7c66
dogru("--text okundu", !!MUREKKEP, String(MUREKKEP));
dogru("--bg okundu", !!KAGIT, String(KAGIT));
dogru("--accent okundu", !!VURGU, String(VURGU));

var ornek = oku("favicon.svg");
dogru("kap rengi --text ile aynı", ornek.indexOf("fill: " + MUREKKEP) >= 0,
  "favicon.svg kap rengi style.css --text ile eşleşmiyor");
dogru("sembol rengi --bg ile aynı", ornek.indexOf("stroke: " + KAGIT) >= 0,
  "favicon.svg sembol rengi style.css --bg ile eşleşmiyor");
dogru("vurgu rengi --accent ile aynı", ornek.indexOf('fill="' + VURGU + '"') >= 0,
  "favicon.svg vurgu rengi style.css --accent ile eşleşmiyor");

/* script.js'teki varsayilan, statik dosyadakiyle ayni olmali: ayrisirsa
   varsayilan palette bile gereksiz bir data URI uretilir. */
var js = oku("script.js");
var m = js.match(/FV_VARSAYILAN\s*=\s*"(#[0-9a-f]{6})"/i);
dogru("script.js FV_VARSAYILAN tanımlı", !!m);
if (m) esit("FV_VARSAYILAN = --accent", m[1].toLowerCase(), VURGU);

/* ------------------------------------------------------------------ */
console.log("\nHer favicon aynı sistemi kullanıyor (" + bizim.length + " dosya)");
var eksikKural = [];
bizim.forEach(function (p) {
  var s = oku(p);
  var sorun = [];
  if (s.indexOf('viewBox="0 0 32 32"') < 0) sorun.push("viewBox 32 değil");
  if (s.indexOf('rx="2"') < 0) sorun.push("köşe 2px değil");
  if (s.indexOf("prefers-color-scheme: dark") < 0) sorun.push("koyu tema yok");
  if (s.indexOf('class="fv-vurgu"') < 0) sorun.push("vurgu çubuğu yok");
  if (s.indexOf('aria-label="') < 0) sorun.push("aria-label yok");
  if (sorun.length) eksikKural.push(p + ": " + sorun.join(", "));
});
dogru("hepsi şablona uyuyor", eksikKural.length === 0, eksikKural.slice(0, 6).join("\n      "));

console.log("\nEski yeşil gradyan geri gelmedi");
var gradyan = bizim.filter(function (p) {
  var s = oku(p);
  return /linearGradient|#14b28e|#0a5f4e|rx="14"/.test(s);
});
dogru("gradyan/yuvarlak kap yok", gradyan.length === 0, gradyan.join(", "));

console.log("\nAlt proje kendi markasını koruyor (decorpalette)");
var alt = hepsi.filter(function (p) { return ALT_PROJE.test(p); });
dogru("alt proje faviconu var", alt.length > 0, "hiç bulunamadı");
alt.forEach(function (p) {
  dogru(p + " dokunulmamış", oku(p).indexOf('class="fv-vurgu"') < 0,
    "alt proje bu sisteme çekilmiş");
});

/* ------------------------------------------------------------------ */
console.log("\nKeyMint alt araçlarının her biri kendi simgesini taşıyor");
/* Once sekizi de ayni yesil kilidi tasiyordu; sekme seridinde hangi
   aracin acik oldugu gorunmuyordu. Kullanicinin istedigi sey tam
   olarak buydu: her araca ozgu bir simge. */
var kmAraclar = ["keymint", "keymint/sifre-guc-testi", "keymint/pin-uretici",
  "keymint/parola-cumlesi", "keymint/wifi-sifresi", "keymint/hash-uretici",
  "keymint/base64", "keymint/uuid-uretici"];
var kmSembol = {};
kmAraclar.forEach(function (a) {
  var p = a + "/favicon.svg";
  if (!fs.existsSync(path.join(KOK, p))) {
    hata++; console.error("  BASARISIZ  " + p + " yok");
    return;
  }
  var ic = oku(p).match(/<g class="fv-sem"[^>]*>([\s\S]*?)<\/g>/);
  kmSembol[a] = ic ? ic[1].trim() : "";
});
dogru("sekizinin de faviconu var", Object.keys(kmSembol).length === 8);
var benzersiz = {};
Object.keys(kmSembol).forEach(function (a) { benzersiz[kmSembol[a]] = 1; });
dogru("sekiz AYRI sembol", Object.keys(benzersiz).length === 8,
  Object.keys(benzersiz).length + " farklı sembol bulundu");

console.log("\nHer sayfanın bağlandığı favicon GERÇEKTEN var");
function sayfalar(dizin, out) {
  fs.readdirSync(path.join(KOK, dizin || "."), { withFileTypes: true })
    .forEach(function (d) {
      var p = dizin ? dizin + "/" + d.name : d.name;
      if (d.isDirectory()) { if (!ATLA[d.name]) sayfalar(p, out); }
      else if (d.name.endsWith(".html")) out.push(p);
    });
  return out;
}
var kirik = [];
var kokeDusen = [];
var htmlListe = sayfalar("", []);
htmlListe.forEach(function (p) {
  var s = oku(p);
  var mm = s.match(/rel="icon" href="([^"]*?favicon\.svg)(?:\?[^"]*)?"/);
  if (!mm) return;
  var hedef = path.posix.normalize(path.posix.join(path.posix.dirname(p), mm[1]));
  if (!fs.existsSync(path.join(KOK, hedef))) kirik.push(p + " -> " + mm[1]);
  else if (hedef === "favicon.svg" && p !== "index.html") kokeDusen.push(p);
});
dogru("kırık favicon bağlantısı yok", kirik.length === 0, kirik.slice(0, 6).join("\n      "));

/* KOKE DUSEN SAYFA SAYISI SINIRLI. Kok markayi hak eden sayfalar var
   (hakkimda, iletisim, yasal metinler) ama bir ARAC ya da MAKALE koke
   duserse bu bir gerilemedir: 2026-09-13 oncesi 28 sayfa boyleydi. */
var beklenenKok = ["gizlilik/index.html", "hakkimda/index.html",
  "iletisim/index.html", "kullanim-kosullari/index.html",
  "yayin-ilkeleri/index.html", "404.html"];
var fazla = kokeDusen.filter(function (p) { return beklenenKok.indexOf(p) < 0; });
dogru("kök markaya yalnızca hak eden sayfalar düşüyor", fazla.length === 0,
  "beklenmeyen: " + fazla.slice(0, 8).join(", "));

console.log("\nRaster yedekler var");
["favicon.ico", "apple-touch-icon.png"].forEach(function (f) {
  var v = fs.existsSync(path.join(KOK, f));
  dogru(f + " var", v);
  if (v) dogru(f + " boş değil", fs.statSync(path.join(KOK, f)).size > 500);
});

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (favicon sistemi kontrolleri)");
