#!/usr/bin/env node
/*!
 * "Kredi tavanı ve banka kârlılığı" yazısının dört tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tabloların sayıları yayımlanmış bir çalışmadan geliyor ama TÜRETİLEN
 * sütunlar burada hesaplanıyor: reel faiz, reel kârlılık, yıllık tavan.
 * Elle yazılsalardı çalışmanın aritmetiğini kopyalamış olurduk; şimdi
 * yeniden üretiyoruz. Tablo ile modül arasında bir sapma çıkarsa
 * --check bunu söyler.
 *
 * DÖRT TABLO
 *   BANKA-REJIM    Politika faizi, enflasyon, reel faiz ve rejim.
 *   BANKA-KAR      Özkaynak kârlılığı, enflasyon, reel kârlılık.
 *   BANKA-TAVAN    Sekiz haftalık sınırlar ve ima ettikleri yıllık tavan.
 *   BANKA-TAKIP    Takibe dönüşüm oranının seyri.
 *
 *   node tools/banka-tablosu.js           # tabloları yaz
 *   node tools/banka-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "kredi-tavani-ve-banka-karliligi");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KLASOR, "banka.js"));

function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde1(o) { return "%" + y1(o * 100); }
function yuzde2(o) { return "%" + y2(o * 100); }
/* Negatif değerlerde tipografik eksi kullanılıyor (yazının geri kalanıyla
   aynı işaret). */
function isaretli(o, basamak) {
  var v = o * 100;
  var s = (basamak === 2 ? y2(Math.abs(v)) : y1(Math.abs(v)));
  return (v < 0 ? "−" : "+") + "%" + s;
}

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar).concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1 */
function rejimTablosu() {
  var s = B.POLITIKA.map(function (p, i) {
    return "            <tr><th scope=\"row\">" + p.donem + "</th>" +
      "<td>%" + y1(p.faiz) + "</td>" +
      "<td>%" + y2(p.tufe) + "</td>" +
      "<td>" + isaretli(B.reelPolitikaFaizi(i), 2) + "</td>" +
      "<td>" + p.rejim + "</td></tr>";
  });
  return blok("BANKA-REJIM", [
    "          <table class=\"payroll\">",
    "            <caption>Politika faizi, enflasyon ve ex-post reel politika faizi (dönem sonu)</caption>",
    "            <thead><tr><th scope=\"col\">Dönem</th>" +
      "<th scope=\"col\">Politika faizi</th><th scope=\"col\">Yıllık TÜFE</th>" +
      "<th scope=\"col\">Reel faiz</th><th scope=\"col\">Rejim</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 2 */
function karTablosu() {
  var s = B.KARLILIK.map(function (k, i) {
    return "            <tr><th scope=\"row\">" + k.yil +
      (k.yillandirilmis ? " <small>(yıllandırılmış)</small>" : "") + "</th>" +
      "<td>%" + y1(k.ok) + "</td>" +
      "<td>%" + y2(k.tufe) + "</td>" +
      "<td>" + isaretli(B.reelKarlilik(i), 2) + "</td></tr>";
  });
  return blok("BANKA-KAR", [
    "          <table class=\"payroll\">",
    "            <caption>Özkaynak kârlılığı, enflasyon ve reel özkaynak kârlılığı</caption>",
    "            <thead><tr><th scope=\"col\">Yıl</th>" +
      "<th scope=\"col\">Özkaynak kârlılığı</th><th scope=\"col\">Yıllık TÜFE</th>" +
      "<th scope=\"col\">Reel kârlılık</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 3 */
function tavanTablosu() {
  var s = B.SINIRLAR.map(function (x) {
    return "            <tr><th scope=\"row\">" + x.tur + "</th>" +
      "<td>%" + y1(x.once) + "</td>" +
      "<td>" + yuzde1(B.yillikTavan(x.once)) + "</td>" +
      "<td>%" + y1(x.sonra) + "</td>" +
      "<td>" + yuzde1(B.yillikTavan(x.sonra)) + "</td></tr>";
  });
  var t = B.takoz();
  s.push("            <tr class=\"vurgu\"><th scope=\"row\">Gerçekleşen (yıllandırılmış)</th>" +
    "<td colspan=\"3\">—</td><td>" + yuzde1(t.gerceklesen) + "</td></tr>");
  return blok("BANKA-TAVAN", [
    "          <table class=\"payroll\">",
    "            <caption>Sekiz haftalık kredi büyüme sınırları ve ima ettikleri yıllık tavan</caption>",
    "            <thead><tr><th scope=\"col\">Kredi türü</th>" +
      "<th scope=\"col\">Sınır (Mayıs 2026 öncesi)</th><th scope=\"col\">Yıllık tavan</th>" +
      "<th scope=\"col\">Sınır (sonrası)</th><th scope=\"col\">Yıllık tavan</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 4 */
function takipTablosu() {
  var ilk = B.TAKIP[0].oran;
  var s = B.TAKIP.map(function (t) {
    return "            <tr><th scope=\"row\">" + t.donem + "</th>" +
      "<td>%" + y2(t.oran) + "</td>" +
      "<td>" + y2(t.oran / ilk) + "×</td></tr>";
  });
  return blok("BANKA-TAKIP", [
    "          <table class=\"payroll\">",
    "            <caption>Kredilerin takibe dönüşüm oranı ve ilk gözleme göre katı</caption>",
    "            <thead><tr><th scope=\"col\">Dönem</th>" +
      "<th scope=\"col\">Takibe dönüşüm oranı</th>" +
      "<th scope=\"col\">Ocak 2025’e göre</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "BANKA-REJIM", uret: rejimTablosu },
  { ad: "BANKA-KAR", uret: karTablosu },
  { ad: "BANKA-TAVAN", uret: tavanTablosu },
  { ad: "BANKA-TAKIP", uret: takipTablosu }
];

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var s = fs.readFileSync(SAYFA, "utf8");
  var degisen = 0;
  for (var k = 0; k < TABLOLAR.length; k++) {
    var t = TABLOLAR[k];
    var bas = "<!-- " + t.ad + ":BASLANGIC -->";
    var bit = "<!-- " + t.ad + ":BITIS -->";
    var i = s.indexOf(bas), j = s.indexOf(bit);
    if (i < 0 || j < 0) {
      console.error("Sayfada tablo işareti yok: " + bas + " / " + bit);
      return 1;
    }
    var mevcut = s.slice(i, j + bit.length);
    var yeni = t.uret();
    if (mevcut !== yeni) {
      degisen++;
      if (!kontrol) s = s.slice(0, i) + yeni + s.slice(j + bit.length);
    }
  }
  if (!degisen) { console.log("Banka tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " banka tablosu güncel değil — " +
      "'node tools/banka-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " banka tablosu yazıldı.");
  return 0;
}

process.exit(main());
