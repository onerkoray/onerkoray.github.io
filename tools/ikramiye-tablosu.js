#!/usr/bin/env node
/*!
 * "İkramiye hangi ay ödenmeli?" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tabloların tamamı bordro/parametreler.js'ten türüyor: SGK tavanı, asgari
 * ücret dönemleri, gelir vergisi tarifesi. Elle yazılsaydı 2027 girildiği
 * anda sessizce eskirdi — sayfa açılır, tablo hizalı durur, yalnızca
 * yanlıştır.
 *
 * ÜÇ TABLO
 * --------
 *   AY       Yıllara göre SGK tavanı ve ay seçiminin fark edip etmediği.
 *            Yazının en ters bulgusu burada: tavan yıl içinde değişmiyorsa
 *            ay seçimi TAM olarak nötr, değişiyorsa değil.
 *   ESIK     Zamanlamanın fark etmeye başladığı ikramiye tutarı.
 *   PARCA    Aynı ikramiyeyi kaç parçada ödemenin ne getirdiği.
 *
 *   node tools/ikramiye-tablosu.js           # tabloları yaz
 *   node tools/ikramiye-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "ikramiye-hangi-ay-odenmeli");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KOK, "bordro", "motor.js"));
var I = require(path.join(KLASOR, "ikramiye.js"));

var YIL = B.sonYil();

/* Ay tablosundaki örnek: tavanı aşacak kadar büyük olmalı, yoksa hiçbir
   yılda fark çıkmaz ve tablo "her yerde nötr" gibi yanlış okunur.
   Tutar, o yılın asgari ücretinin katı olarak türetiliyor — elle yazılan
   bir lira tutarı 2027'de anlamını kaybederdi. */
var AYLIK_KAT = 5;      // aylık brüt = 5 × asgari ücret
var IKRAMIYE_KAT = 20;  // ikramiye  = 20 × asgari ücret

/* Eşik tablosundaki örnek aylık brütler, yine asgari ücretin katı olarak. */
var ESIK_KATLARI = [2, 4, 6, 8];

/* Parça tablosundaki bölünme sayıları. */
var PARCALAR = [1, 2, 3, 4, 6, 12];

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar)
    .concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

function asgari(yil) {
  return B.donem(B.parametre(yil), 1).asgariBrut;
}

/* ---------------------------------------------------------------- 1 */
function ayTablosu() {
  var yillar = I.kapsananYillar().slice().sort(function (a, b) { return a - b; });
  var s = yillar.map(function (y) {
    var a = asgari(y);
    var f = I.aySecimiFarki(a * AYLIK_KAT, a * IKRAMIYE_KAT, y);
    var t = I.tavanlar(y);
    var tavanMetni = t.map(function (x) { return tam(x.sgkTavan); }).join(" → ");
    return "            <tr><th scope=\"row\">" + y + "</th>" +
      "<td>" + tavanMetni + "</td>" +
      "<td>" + (I.tavanSabitMi(y) ? "Evet" : "Hayır, Temmuz'da değişiyor") + "</td>" +
      "<td>" + (f.fark < 0.005 ? "Fark yok" : tam(f.fark) + " TL") + "</td></tr>";
  });
  return blok("IKRAMIYE-AY", [
    "          <table class=\"payroll\">",
    "            <caption>Ay seçimi yıllık neti değiştiriyor mu?</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Yıl</th>",
    "                <th scope=\"col\">Aylık SGK tavanı (TL)</th>",
    "                <th scope=\"col\">Tavan yıl boyunca sabit mi?</th>",
    "                <th scope=\"col\">En iyi ve en kötü ay arasındaki fark</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 2 */
function esikTablosu() {
  var a = asgari(YIL);
  var tavan = I.ayinTavani(YIL, 12);
  var s = ESIK_KATLARI.map(function (kat) {
    var brut = a * kat;
    var esik = I.kirilmaEsigi(brut, YIL, 12);
    return "            <tr><th scope=\"row\">" + tam(brut) + " TL</th>" +
      "<td>" + kat + "× asgari ücret</td>" +
      "<td>" + tam(esik) + " TL</td>" +
      "<td>" + tam(tavan) + " TL</td></tr>";
  });
  return blok("IKRAMIYE-ESIK", [
    "          <table class=\"payroll\">",
    "            <caption>Zamanlamanın fark etmeye başladığı ikramiye tutarı (" + YIL + ")</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Aylık brüt ücret</th>",
    "                <th scope=\"col\">Asgari ücretin katı</th>",
    "                <th scope=\"col\">Bu tutara kadar fark yok</th>",
    "                <th scope=\"col\">Aylık SGK tavanı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 3 */
function parcaTablosu() {
  var a = asgari(YIL);
  var brut = a * AYLIK_KAT, ik = a * IKRAMIYE_KAT;
  var liste = I.parcaKarsilastirmasi(brut, ik, YIL, PARCALAR);
  var s = liste.map(function (x) {
    return "            <tr><th scope=\"row\">" + x.parca + " ödemede</th>" +
      "<td>" + tam(x.sgk) + " TL</td>" +
      "<td>" + tam(x.gelirVergisi) + " TL</td>" +
      "<td>" + tam(x.net) + " TL</td>" +
      "<td>" + (Math.abs(x.netFark) < 0.5 ? "—" : tam(x.netFark) + " TL") + "</td>" +
      "<td>" + (Math.abs(x.isverenFark) < 0.5 ? "—" : tam(x.isverenFark) + " TL") + "</td></tr>";
  });
  return blok("IKRAMIYE-PARCA", [
    "          <table class=\"payroll\">",
    "            <caption>Aynı ikramiye kaç ödemeye bölünürse (" + YIL + ", aylık brüt " +
      tam(brut) + " TL, ikramiye " + tam(ik) + " TL)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Ödeme sayısı</th>",
    "                <th scope=\"col\">Yıllık SGK ve işsizlik</th>",
    "                <th scope=\"col\">Yıllık gelir vergisi</th>",
    "                <th scope=\"col\">Yıllık net</th>",
    "                <th scope=\"col\">Tek ödemeye göre net</th>",
    "                <th scope=\"col\">Tek ödemeye göre işveren maliyeti</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "IKRAMIYE-AY", uret: ayTablosu },
  { ad: "IKRAMIYE-ESIK", uret: esikTablosu },
  { ad: "IKRAMIYE-PARCA", uret: parcaTablosu }
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

  if (!degisen) {
    console.log("İkramiye tabloları güncel.");
    return 0;
  }
  if (kontrol) {
    console.error(degisen + " ikramiye tablosu güncel değil — " +
      "'node tools/ikramiye-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " ikramiye tablosu yazıldı.");
  return 0;
}

process.exit(main());
