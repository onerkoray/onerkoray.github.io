#!/usr/bin/env node
/*!
 * "Tasarruf kimde, finansman kimde?" yazısının üç tablosunu üretir.
 *
 * Türetilen sütunlar burada hesaplanıyor: reel büyüme, KOBİ payı, sepet
 * maliyeti artışı. Elle yazılsalardı çalışmanın sonuçları kopyalanmış
 * olurdu; şimdi yeniden üretiliyor.
 *
 *   HARITA-TASARRUF  Gayrisafi tasarrufun kurumsal dağılımı.
 *   HARITA-SEPET     Gıda ve konut-kira için koşullu fiyat senaryosu.
 *   HARITA-KREDI     KOBİ ve toplam işletme kredileri.
 *
 *   node tools/harita-tablosu.js           # tabloları yaz
 *   node tools/harita-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "tasarruf-kimde-finansman-kimde");
var SAYFA = path.join(KLASOR, "index.html");
var H = require(path.join(KLASOR, "harita.js"));

function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function tam(n) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function isaretli(o) {
  var v = o * 100;
  return (v < 0 ? "−" : "+") + "%" + y2(Math.abs(v));
}
function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar).concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1 */
function tasarrufTablosu() {
  var enBuyuk = H.enBuyukTasarrufcu();
  var s = H.TASARRUF.map(function (t) {
    return "            <tr" + (t.sektor === enBuyuk.sektor ? " class=\"vurgu\"" : "") +
      "><th scope=\"row\">" + t.sektor + "</th>" +
      "<td>%" + y1(t.oran) + "</td></tr>";
  });
  s.push("            <tr class=\"bey-alt\"><th scope=\"row\">Bileşenlerin toplamı</th>" +
    "<td>%" + y1(H.tasarrufBilesenToplami()) + "</td></tr>");
  s.push("            <tr class=\"bey-alt\"><th scope=\"row\">Yayımlanan toplam</th>" +
    "<td>%" + y1(H.TASARRUF_YAYIN_TOPLAM) + "</td></tr>");
  return blok("HARITA-TASARRUF", [
    "          <table class=\"payroll\">",
    "            <caption>Gayrisafi tasarrufun kurumsal dağılımı, 2024 (GSYH’ye oran)</caption>",
    "            <thead><tr><th scope=\"col\">Kurumsal sektör</th>" +
      "<th scope=\"col\">GSYH’ye oran</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 2 */
function sepetTablosu() {
  var s = H.SENARYOLAR.map(function (p) {
    return "            <tr><th scope=\"row\">%" + p + "</th>" +
      "<td>%" + y2(H.sepetArtisi("alt", p) * 100) + "</td>" +
      "<td>%" + y2(H.sepetArtisi("ust", p) * 100) + "</td>" +
      "<td>" + y2(H.sepetFarki(p) * 100) + " puan</td></tr>";
  });
  return blok("HARITA-SEPET", [
    "          <table class=\"payroll\">",
    "            <caption>Gıda ve konut-kira fiyatlarındaki ortak artışın sepet maliyetine etkisi</caption>",
    "            <thead><tr><th scope=\"col\">İki kategoride ortak fiyat artışı</th>" +
      "<th scope=\"col\">Alt gelir grubu</th><th scope=\"col\">Üst gelir grubu</th>" +
      "<th scope=\"col\">Fark</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 3 */
function krediTablosu() {
  var s = H.KREDI.map(function (k) {
    var nominal = H.nominalBuyume(k.yil, "kobi");
    var reel = H.reelBuyume(k.yil, "kobi");
    return "            <tr><th scope=\"row\">" + k.yil + "</th>" +
      "<td>" + tam(k.kobi) + "</td>" +
      "<td>" + tam(k.toplam) + "</td>" +
      "<td>%" + y2(H.kobiPayi(k.yil) * 100) + "</td>" +
      "<td>" + (nominal === null ? "—" : isaretli(nominal)) + "</td>" +
      "<td>" + (reel === null ? "—" : isaretli(reel)) + "</td></tr>";
  });
  return blok("HARITA-KREDI", [
    "          <table class=\"payroll\">",
    "            <caption>KOBİ ve toplam işletme kredi stoku (milyar TL) ve KOBİ kredisinin değişimi</caption>",
    "            <thead><tr><th scope=\"col\">Yıl</th>" +
      "<th scope=\"col\">KOBİ kredi stoku</th><th scope=\"col\">Toplam işletme</th>" +
      "<th scope=\"col\">KOBİ payı</th><th scope=\"col\">KOBİ nominal değişim</th>" +
      "<th scope=\"col\">KOBİ reel değişim</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "HARITA-TASARRUF", uret: tasarrufTablosu },
  { ad: "HARITA-SEPET", uret: sepetTablosu },
  { ad: "HARITA-KREDI", uret: krediTablosu }
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
  if (!degisen) { console.log("Harita tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " harita tablosu güncel değil — " +
      "'node tools/harita-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " harita tablosu yazıldı.");
  return 0;
}

process.exit(main());
