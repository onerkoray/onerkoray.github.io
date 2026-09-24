/*
 * Makale sayı testleri için ortak yardımcı.
 *
 * NEDEN VAR: Eylül 2026'da 39 yazının 17'sinde metindeki rakamları
 * denetleyen hiçbir şey yoktu. Her yazının kendi sayi-testi.js'i bu
 * yardımcıyla rakamı motordan yeniden üretir ve sayfada GÖRÜNDÜĞÜNÜ
 * doğrular. Sayfada olmayan bir değeri doğrulamak hiçbir şeyi korumaz.
 *
 * Biçimler sitenin yazım kuralını izler: binlik nokta, ondalık virgül,
 * eksi için U+2212.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);

function yazi(klasor) {
  var html = fs.readFileSync(path.join(klasor, "index.html"), "utf8");
  var t = { html: html, gecen: 0, kalan: 0, ad: path.basename(klasor) };

  /* Okurun gördüğü metin: etiketler ve varlıklar çözülmüş, boşluk tek. */
  t.metin = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“")
    .replace(/&minus;/g, "−").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(+n); })
    .replace(/\s+/g, " ");

  t.dogru = function (ad, kosul, detay) {
    if (kosul) { t.gecen++; return; }
    t.kalan++;
    console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
  };
  /* Değer sayfada okurun göreceği metinde en az bir kez geçiyor mu. */
  t.gecsin = function (ad, s) {
    t.dogru(ad, t.metin.indexOf(s) !== -1, "sayfada yok: " + s);
  };
  /* Bayat bir değer sayfada KALMAMALI. */
  t.gecmesin = function (ad, s) {
    t.dogru(ad, t.metin.indexOf(s) === -1, "sayfada hâlâ var: " + s);
  };
  t.yakin = function (ad, a, b, tol) {
    t.dogru(ad, Math.abs(a - b) <= (tol == null ? 0.005 : tol), a + " ≠ " + b);
  };
  t.bitir = function (ozet) {
    if (t.kalan) {
      console.log(t.ad + ": " + t.kalan + " başarısız, " + t.gecen + " geçti.");
      process.exit(1);
    }
    console.log(t.ad + ": " + t.gecen + " sayı doğrulandı." + (ozet ? " " + ozet : ""));
  };
  return t;
}

function tl(n) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
/* Yüzde, virgüllü: yuzde(0.1575, 2) -> "15,75" */
function yuzde(o, basamak) {
  return (o * 100).toFixed(basamak == null ? 2 : basamak).replace(".", ",");
}
function eksi(s) { return s.replace(/^-/, "−"); }
function kurus(n) { return Math.round(n * 100) / 100; }

module.exports = {
  KOK: KOK,
  yazi: yazi,
  tl: tl, tam: tam, yuzde: yuzde, eksi: eksi, kurus: kurus,
  bordro: function () { return require(path.join(KOK, "bordro", "motor.js")); },
  parametreler: function () { return require(path.join(KOK, "bordro", "parametreler.js")); }
};
