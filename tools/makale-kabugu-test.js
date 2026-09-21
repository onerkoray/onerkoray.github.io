#!/usr/bin/env node
/*!
 * Makale sayfaları site kabuğunu taşıyor mu, sınıfları gerçek mi?
 *
 * NEDEN VAR
 * ---------
 * Yeni bir makale yazarken gövdeyi ezberden kurdum ve şablona
 * benzemiyordu: sarmal olarak `.wrap` kullanmamıştım. Genişliği
 * sınırlayan sınıf o; olmayınca sayfa tam genişliğe yayıldı, yatay
 * kaydırma çıktı ve yazı sitedeki hiçbir makaleye benzemedi.
 *
 * Bunu KULLANICI gördü, CI görmedi. 113 kontrolün hepsi yeşildi;
 * çünkü hiçbiri "bu sayfa makale gibi duruyor mu" diye sormuyordu.
 * Bu kapı o soruyu soruyor.
 *
 * İKİ İDDİA
 * ---------
 *   1. KABUK. Her makale breadcrumb, `.wrap prose` ve `.wrap
 *      footer-legal` taşımalı. Bunlar 36 makalenin 36'sında var.
 *      `site-header` BİLEREK dışarıda: iki meşru kabuk var ve
 *      makalelerin 18'inde üst menü yok. Var olmayan bir tekdüzeliği
 *      dayatmak, gerçek bir kuralı test etmekten farklı bir şeydir.
 *
 *   2. SINIFLAR GERÇEK Mİ. Kullanılan her `ed-` sınıfının bir CSS
 *      kuralı olmalı. Uydurma sınıf sessizdir: sayfa açılır, hiçbir
 *      şey patlamaz, yalnızca istenen biçim uygulanmaz. Bu sitede
 *      tam olarak bu oldu — `.ed-tablo-sarmal` hiç tanımlı değildi ve
 *      iki yazının tabloları dar ekranda taşıyordu.
 *
 * Kullanım: node tools/makale-kabugu-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var MAKALELER = path.join(KOK, "makaleler");

/* Her makalede bulunması gereken kabuk parçaları. */
var KABUK = {
  "breadcrumb": 'class="breadcrumb wrap"',
  "wrap prose": '<div class="wrap prose">',
  "footer-legal": 'class="wrap footer-legal"'
};

/* CSS kuralı beklenmeyen ed- sınıfları. Bugün dördü kuralsız; üçü bu
   kapıdan önce de öyleydi ve ne yapılacağı editoryal bir karar, o
   yüzden burada MUAF olarak duruyorlar -- gizlenmiyorlar, sayılıyorlar.
   Birine CSS yazıldığında listeden çıkarılmalı. */
var KURALSIZ_MUAF = ["ed-note", "ed-kaynak-notu", "ed-tablo"];

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

console.log("Makale kabuğu ve sınıfları\n");

/* --- makale sayfaları --------------------------------------------- */
var sayfalar = fs.readdirSync(MAKALELER, { withFileTypes: true })
  .filter(function (d) { return d.isDirectory(); })
  .map(function (d) { return "makaleler/" + d.name + "/index.html"; })
  .filter(function (p) { return fs.existsSync(path.join(KOK, p)); });

var eksik = [];
var sarmalsiz = [];

/* Sarmalin VARLIGINI aramak zayifti: ayni sinif sayfada birden cok
   yerde gectigi icin birini bozmak testi yesil birakiyordu -- bugunku
   hatanin ta kendisi mutasyonda kacti. Bu yuzden iddia tersine
   cevrildi: prose, breadcrumb ve footer-legal ASLA .wrap'siz
   gecmemeli. 36 makalede tek istisna yok, yani gercek bir kural. */
var SARMAL_SART = ["prose", "breadcrumb", "footer-legal"];

sayfalar.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  Object.keys(KABUK).forEach(function (ad) {
    if (s.indexOf(KABUK[ad]) < 0) eksik.push(p + " -> " + ad);
  });
  (s.match(/class="[^"]*"/g) || []).forEach(function (m) {
    var c = m.slice(7, -1).split(/\s+/);
    if (c.indexOf("wrap") >= 0) return;
    SARMAL_SART.forEach(function (h) {
      if (c.indexOf(h) >= 0) sarmalsiz.push(p + " -> " + m);
    });
  });
});

console.log("  taranan makale: " + sayfalar.length + "\n");
dogru("her makale site kabuğunu taşıyor", eksik.length === 0,
  eksik.slice(0, 8).join("\n      ") +
  (eksik.length > 8 ? "\n      ... +" + (eksik.length - 8) : ""));
dogru("prose/breadcrumb/footer-legal her yerde .wrap ile birlikte",
  sarmalsiz.length === 0,
  sarmalsiz.slice(0, 8).join("\n      ") +
  (sarmalsiz.length > 8 ? "\n      ... +" + (sarmalsiz.length - 8) : ""));

/* --- ed- sınıflarının CSS karşılığı ------------------------------- */
var css = fs.readFileSync(path.join(KOK, "style.css"), "utf8") +
  fs.readFileSync(path.join(MAKALELER, "editoryal.css"), "utf8");
var tanimli = {};
(css.match(/\.ed-[A-Za-z0-9_-]+/g) || []).forEach(function (c) {
  tanimli[c.slice(1)] = true;
});

/* Sınıflar makale sayfalarında ve ana sayfadaki kart listesinde geçiyor. */
var taranacak = sayfalar.concat(["makaleler/index.html", "index.html"])
  .filter(function (p) { return fs.existsSync(path.join(KOK, p)); });

var kuralsiz = {};
taranacak.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  (s.match(/class="[^"]*"/g) || []).forEach(function (m) {
    m.slice(7, -1).split(/\s+/).forEach(function (c) {
      if (c.indexOf("ed-") !== 0) return;
      if (tanimli[c]) return;
      if (KURALSIZ_MUAF.indexOf(c) >= 0) return;
      (kuralsiz[c] = kuralsiz[c] || []).push(p);
    });
  });
});

var kuralsizAdlar = Object.keys(kuralsiz);
dogru("kullanılan her ed- sınıfının CSS kuralı var", kuralsizAdlar.length === 0,
  kuralsizAdlar.map(function (c) {
    return c + " (" + kuralsiz[c].length + " yerde, ör. " + kuralsiz[c][0] + ")";
  }).join("\n      "));

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: otuzdan fazla makale tarandı", sayfalar.length > 30,
  String(sayfalar.length));
dogru("KONTROL: CSS'te en az yirmi ed- sınıfı bulundu",
  Object.keys(tanimli).length >= 20, String(Object.keys(tanimli).length));
dogru("KONTROL: kabuk listesi boş değil", Object.keys(KABUK).length === 3);
/* Muaf listesi bayatlamasın: muaf bir sınıfa CSS yazıldıysa listeden
   çıkarılmalı, yoksa liste gerçek bulguları da gizlemeye başlar. */
var gereksizMuaf = KURALSIZ_MUAF.filter(function (c) { return tanimli[c]; });
dogru("KONTROL: muaf listesinde artık CSS'i olan sınıf yok",
  gereksizMuaf.length === 0, gereksizMuaf.join(", "));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (makale kabuğu)");
process.exit(hata ? 1 : 0);
