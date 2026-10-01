#!/usr/bin/env node
/*!
 * Görsel ve hareket standardı kapısı. Çalıştırma: node tools/hareket-test.js
 *
 * AGENTS.md "5. Görsel ve hareket standardı" bölümünün makinece denetlenebilen
 * kısmı. Kaynak: @claudecode84'ün paylaştığı stüdyo tanımı (CLAUDE.md 01/08,
 * 1 Ekim 2026), bu siteye uyarlandı. Gözle yapılacak gözden geçirme kapısı
 * (kontak sayfası, puanlama) tools/kontak-sayfasi.py ile; burası yalnızca
 * geri dönüşü olmayan yasakları tutar:
 *
 *   1. Kaldırılan dekor geri gelmez: imleci izleyen hare, bulanık gradyan
 *      lekeler, parçacık ağı. Bunlar bir kez display:none ile gizlenmiş ama
 *      kodu yüklenmeye ve her imleç hareketinde çizim döngüsü çalıştırmaya
 *      devam etmişti (30 Eylül 2026'ya kadar).
 *   2. Görsel katman deterministiktir: Math.random yalnız kimlik üretiminde.
 *      Aynı sayfa her açılışta aynı kareyi çizer; gürültü gerekirse sabit tohum.
 *   3. Taşan (overshoot) yumuşatma yalnız izinli arayüz tepkilerinde. Metne ve
 *      veri işaretine taşma yok: bir veri noktası değerinden büyük görünemez.
 *   4. Hiçbir animasyon bir öğeyi büyütüp geri sektirmez (scale > 1,05 → 1).
 *   5. Buzlu cam (backdrop-filter) yalnız işlevsel katmanlarda: yapışkan
 *      başlık, komut paleti örtüsü, grafik araç çubuğu.
 *   6. "Hareketi azalt" tercihi bütün siteyi kapsar (style.css genel kuralı).
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var ATLA = { ".git": 1, node_modules: 1, _cekirdek: 1, tools: 1 };

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "\n      " + ek : "")); }
}
function dosyalar(uzantilar, dizin, out) {
  dizin = dizin || ""; out = out || [];
  fs.readdirSync(path.join(KOK, dizin || "."), { withFileTypes: true }).forEach(function (d) {
    var p = dizin ? dizin + "/" + d.name : d.name;
    if (d.isDirectory()) { if (!ATLA[d.name]) dosyalar(uzantilar, p, out); }
    else if (uzantilar.some(function (u) { return d.name.endsWith(u); })) out.push(p);
  });
  return out;
}
function oku(p) { return fs.readFileSync(path.join(KOK, p), "utf8"); }
function testDosyasi(p) { return /(^|\/)(test|[^/]*-test|sayi-testi)\.js$/.test(p); }

var css = dosyalar([".css"]);
var js = dosyalar([".js"]).filter(function (p) { return !testDosyasi(p); });
var html = dosyalar([".html"]);

console.log("\n1. Kaldırılan dekor geri gelmedi");
[["cursor-glow", "imleci izleyen hare"], ["hero-bg", "bulanık gradyan lekeler"], ["bg-net", "parçacık ağı"],
 ["bg-network.js", "parçacık ağı betiği"]].forEach(function (x) {
  var bulunan = css.concat(js, html).filter(function (p) { return oku(p).indexOf(x[0]) >= 0; });
  ok(x[1] + " (" + x[0] + ") yok", bulunan.length === 0, bulunan.slice(0, 5).join(", "));
});

console.log("\n2. Görsel katman deterministik");
/* Kimlik üretimi rastgelelik ister; çizim istemez. */
var KIMLIK = { "fatura-olusturma/arsiv.js": 1, "finans/profil.js": 1 };
var rastgele = js.filter(function (p) { return !KIMLIK[p] && /Math\.random\s*\(/.test(oku(p)); });
ok("Math.random yalnız kimlik üretiminde", rastgele.length === 0, rastgele.join(", "));

console.log("\n3. Taşan yumuşatma yalnız izinli arayüz tepkilerinde");
/* Kart karosunun üzerine gelince ikon ve karo hafifçe esner: arayüz tepkisi,
   metin ya da veri değil. Tanım bunu açıkça serbest bırakıyor. */
var TASMA_IZINLI = [/^\.karo$/, /^\.karo-ikon$/, /^\.karo::after$/];
function kurallar(metin) {
  var out = [], re = /([^{}]+)\{([^{}]*)\}/g, m;
  metin = metin.replace(/\/\*[\s\S]*?\*\//g, "");
  while ((m = re.exec(metin))) out.push({ secici: m[1].trim(), govde: m[2] });
  return out;
}
var tasan = [];
css.forEach(function (p) {
  kurallar(oku(p)).forEach(function (k) {
    var re = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g, m;
    while ((m = re.exec(k.govde))) {
      var y1 = +m[2], y2 = +m[4];
      if (y1 >= 0 && y1 <= 1 && y2 >= 0 && y2 <= 1) continue;
      var seciciler = k.secici.split(",").map(function (s) { return s.trim(); });
      var izinli = seciciler.every(function (s) { return TASMA_IZINLI.some(function (r) { return r.test(s); }); });
      if (!izinli) tasan.push(p + " → " + k.secici.slice(0, 60) + " " + m[0]);
    }
  });
});
ok("taşan eğri izin listesi dışında kullanılmıyor", tasan.length === 0, tasan.slice(0, 6).join("\n      "));

console.log("\n4. Büyütüp geri sektiren animasyon yok");
var sekme = [];
css.forEach(function (p) {
  var metin = oku(p).replace(/\/\*[\s\S]*?\*\//g, ""), re = /@keyframes\s+([\w-]+)\s*\{([\s\S]*?\}\s*)\}/g, m;
  while ((m = re.exec(metin))) {
    var olcek = [], r2 = /scale\(\s*([\d.]+)/g, s;
    while ((s = r2.exec(m[2]))) olcek.push(+s[1]);
    if (olcek.length >= 2 && olcek[olcek.length - 1] === 1 && Math.max.apply(null, olcek) > 1.05) sekme.push(p + " → @keyframes " + m[1]);
  }
});
ok("hiçbir @keyframes 1,05'ten büyüğe çıkıp 1'e dönmüyor", sekme.length === 0, sekme.join("\n      "));

console.log("\n5. Buzlu cam yalnız işlevsel katmanlarda");
var CAM_IZINLI = [/^\.site-header$/, /^\.cmdk-backdrop$/, /^\.gr-hud-ic$/];
var cam = [];
css.forEach(function (p) {
  kurallar(oku(p)).forEach(function (k) {
    var m = k.govde.match(/(?:^|;|\s)backdrop-filter\s*:\s*([^;]+)/);
    if (!m || /^\s*none\s*$/.test(m[1])) return;
    var izinli = k.secici.split(",").every(function (s) { return CAM_IZINLI.some(function (r) { return r.test(s.trim()); }); });
    if (!izinli) cam.push(p + " → " + k.secici.slice(0, 60));
  });
});
ok("backdrop-filter izin listesi dışında yok", cam.length === 0, cam.join("\n      "));

console.log("\n6. Hareketi azalt tercihi bütün siteyi kapsıyor");
var stil = oku("style.css").replace(/\/\*[\s\S]*?\*\//g, "");
var genel = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^@]*\*,\s*\*::before,\s*\*::after\s*\{[^}]*animation-duration:\s*\.001ms/.test(stil);
ok("style.css'te genel azaltma kuralı (*, ::before, ::after)", genel);
var stilsiz = html.filter(function (p) {
  var s = oku(p);
  return /@keyframes|animation\s*:/.test(s) && !/href="[^"]*style\.css/.test(s) && !/noindex/.test(s);
});
ok("satır içi animasyonu olan her sayfa style.css'i yüklüyor", stilsiz.length === 0, stilsiz.slice(0, 5).join(", "));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı");
process.exit(kalan ? 1 : 0);
