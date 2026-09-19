#!/usr/bin/env node
/*!
 * "SGK prim tavanı 9 kata çıktı" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Üç tablo da tek kaynaktan türüyor: bordro/parametreler.js'teki tavan ve
 * asgari ücret serisi ile emeklilik motoru. Elle yazılsaydı katsayı bir
 * daha değiştiğinde sessizce eskirdi — sayfa açılır, tablo hizalı durur,
 * yalnızca yanlıştır.
 *
 * KARŞI OLGU DA ÜRETİLİYOR. "Tavan 7,5 katta kalsaydı" sütunu buraya 7,5
 * yazılarak değil, bir önceki yılın tavanKatsayisi'si okunarak kuruluyor
 * (bkz. tavan.js).
 *
 * ÜÇ TABLO
 * --------
 *   DEGISIM  Katsayının yıllara göre seyri ve tavanın karşılığı.
 *   ETKI     Aylık brüte göre ek prim, net kayıp, vergi kalkanı, işveren.
 *   GERI     Emeklilik geri dönüşü: kariyer biçimine göre başabaş.
 *
 *   node tools/tavan-tablosu.js           # tabloları yaz
 *   node tools/tavan-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "sgk-prim-tavani-9-kat");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KOK, "bordro", "motor.js"));
var T = require(path.join(KLASOR, "tavan.js"));

var YIL = B.sonYil();

/* Etki tablosundaki brütler: eşiğin altı, bandın içi, doyum ve üstü.
   Sabit sayı yazmamak için eşiklerden türetiliyor. */
function etkiBrutleri() {
  var e = T.esikler(YIL);
  var bant = e.doyar - e.baslar;
  return [
    Math.round(e.baslar - bant * 0.4),
    Math.round(e.baslar),
    Math.round(e.baslar + bant * 0.45),
    Math.round(e.doyar),
    Math.round(e.doyar * 1.35),
    Math.round(e.doyar * 3)
  ];
}

/* Geri dönüş tablosundaki kariyer biçimleri: [geçmiş yıl, kalan yıl]. */
var KARIYERLER = [[20, 5], [20, 10], [20, 15], [10, 20], [5, 25]];

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde(o) { return "%" + y1(o * 100); }
function kat(n) { return y1(n).replace(",0", "") + " kat"; }

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar).concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1
   Katsayının yıllara göre seyri. Tavanın gerçekten asgari ücretin
   katsayı katı olduğunu da gösteriyor — ilişki bordro/test.js'te
   kuruşuna kadar bağlı. */
function degisimTablosu() {
  var yillar = B.yillar().slice().sort(function (a, b) { return a - b; });
  var s = yillar.map(function (yil) {
    var P = B.parametre(yil);
    var d = P.donemler[0];
    var onceki = yil > yillar[0] ? B.parametre(yil - 1).tavanKatsayisi : null;
    var degisti = onceki !== null && onceki !== P.tavanKatsayisi;
    return "            <tr" + (degisti ? " class=\"vurgu\"" : "") + ">" +
      "<th scope=\"row\">" + yil + "</th>" +
      "<td>" + tam(d.asgariBrut) + " TL</td>" +
      "<td>" + kat(P.tavanKatsayisi) + "</td>" +
      "<td>" + tam(d.sgkTavan) + " TL</td>" +
      "<td>" + (degisti ? "katsayı değişti" : "—") + "</td></tr>";
  });
  return blok("TAVAN-DEGISIM", [
    "          <table class=\"payroll\">",
    "            <caption>Asgari ücret, tavan katsayısı ve aylık prim tavanı</caption>",
    "            <thead><tr><th scope=\"col\">Yıl</th>" +
      "<th scope=\"col\">Asgari ücret (brüt)</th>" +
      "<th scope=\"col\">Tavan katsayısı</th>" +
      "<th scope=\"col\">Aylık prim tavanı</th>" +
      "<th scope=\"col\">Not</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 2
   Etkinin brüte göre seyri. Vergi kalkanı sütunu asıl bulguyu taşıyor:
   kalkan marjinal dilimle birlikte büyüdüğü için net kayıp en yüksek
   ücretlilerde AZALIYOR. */
function etkiTablosu() {
  var s = etkiBrutleri().map(function (brut) {
    var e = T.etki(brut, YIL);
    return "            <tr><th scope=\"row\">" + tam(brut) + " TL</th>" +
      "<td>" + tam(e.ekPrim) + " TL</td>" +
      "<td>" + (e.ekPrim > 0 ? yuzde(e.vergiKalkani) : "—") + "</td>" +
      "<td>" + tam(e.netKayip) + " TL</td>" +
      "<td>" + tam(e.isverenKayip) + " TL</td></tr>";
  });
  return blok("TAVAN-ETKI", [
    "          <table class=\"payroll\">",
    "            <caption>" + YIL + " — aylık brüte göre yıllık etki</caption>",
    "            <thead><tr><th scope=\"col\">Aylık brüt</th>" +
      "<th scope=\"col\">Ek işçi primi (yıllık)</th>" +
      "<th scope=\"col\">Vergi kalkanı</th>" +
      "<th scope=\"col\">Net kayıp (yıllık)</th>" +
      "<th scope=\"col\">İşveren artışı (yıllık)</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 3
   Emeklilik geri dönüşü. Başabaş süresinin kariyer biçiminden
   neredeyse bağımsız çıkması tablonun asıl anlattığı şey. */
function geriTablosu() {
  var s = KARIYERLER.map(function (k) {
    var r = T.emeklilikGeriDonusu(k[0] * 360, k[1] * 360, YIL);
    return "            <tr><th scope=\"row\">" + k[0] + " + " + k[1] + " yıl</th>" +
      "<td>" + tam(r.ortalamaPekYeni) + " TL</td>" +
      "<td>" + tam(r.aylikArtis) + " TL</td>" +
      "<td>" + tam(r.toplamMaliyet) + " TL</td>" +
      "<td>" + y1(r.basabasYil) + " yıl</td></tr>";
  });
  return blok("TAVAN-GERI", [
    "          <table class=\"payroll\">",
    "            <caption>Fazla primin emekli aylığı üzerinden geri dönüşü</caption>",
    "            <thead><tr><th scope=\"col\">Geçmiş + kalan hizmet</th>" +
      "<th scope=\"col\">Ortalama PEK</th>" +
      "<th scope=\"col\">Aylık artışı</th>" +
      "<th scope=\"col\">Toplam net maliyet</th>" +
      "<th scope=\"col\">Başabaş</th></tr></thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "TAVAN-DEGISIM", uret: degisimTablosu },
  { ad: "TAVAN-ETKI", uret: etkiTablosu },
  { ad: "TAVAN-GERI", uret: geriTablosu }
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
  if (!degisen) { console.log("Tavan tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " tavan tablosu güncel değil — " +
      "'node tools/tavan-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " tavan tablosu yazıldı.");
  return 0;
}

process.exit(main());
