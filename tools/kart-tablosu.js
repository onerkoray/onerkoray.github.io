#!/usr/bin/env node
/*!
 * "Asgari ödersem borcum ne zaman biter?" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tablolar TCMB'nin azami faiz oranlarından ve BDDK'nın asgari ödeme
 * kuralından türüyor. İkisi de değişiyor — TCMB oranları aylık
 * güncellenebiliyor. Elle yazılsaydı sayfa açılır, tablo hizalı görünür,
 * yalnızca yanlış olurdu.
 *
 * ÜÇ TABLO
 * --------
 *   BANTLAR   Faiz bantları ve her bant için borcun büyüme eşiği. Yazının
 *             ana önermesi burada görünür hale geliyor: yasal asgari,
 *             eşiğin dört katından fazlası.
 *   SEYIR     Örnek borçların bir yıl sonraki hâli ve toplam faiz yükü.
 *   BASABAS   Borcu sabit tutan aylık harcama — asıl tuzak.
 *
 *   node tools/kart-tablosu.js           # tabloları yaz
 *   node tools/kart-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "kredi-karti-asgari-odeme");
var SAYFA = path.join(KLASOR, "index.html");
var K = require(path.join(KLASOR, "kart.js"));

/* Örnek borç/limit çiftleri.
   Limit seçimi keyfi değil: asgari oran limite bağlı olduğu için her iki
   asgari grubunun da tabloda görünmesi gerekiyor. Borçların hepsi kendi
   limitinin altında — modül zaten aksini reddediyor. */
var ORNEKLER = [
  { borc: 30000, limit: 50000 },
  { borc: 50000, limit: 50000 },
  { borc: 80000, limit: 150000 },
  { borc: 150000, limit: 200000 }
];

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde2(o) { return "%" + y2(o * 100); }

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar)
    .concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1 */
function bantTablosu() {
  var s = K.BANTLAR.map(function (b) {
    var esik = K.buyumeEsigi(b.akdi);
    return "            <tr><th scope=\"row\">" + b.ad + "</th>" +
      "<td>" + yuzde2(b.akdi) + "</td>" +
      "<td>" + yuzde2(K.vergiliOran(b.akdi)) + "</td>" +
      "<td>" + yuzde2(esik) + "</td>" +
      "<td>" + y1(K.ASGARI_DUSUK / esik) + " kat</td></tr>";
  });
  return blok("KART-BANTLAR", [
    "          <table class=\"payroll\">",
    "            <caption>Faiz bantları ve borcun büyümeye başlayacağı asgari ödeme eşiği</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Dönem borcu</th>",
    "                <th scope=\"col\">Aylık azami akdi faiz</th>",
    "                <th scope=\"col\">KKDF ve BSMV dahil</th>",
    "                <th scope=\"col\">Borcun büyüme eşiği</th>",
    "                <th scope=\"col\">Yasal asgari (%20) eşiğin kaç katı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 2 */
function seyirTablosu() {
  var s = ORNEKLER.map(function (o) {
    var r = K.simule(o.borc, o.limit);
    var kalan = K.yilSonuKalan(o.borc, o.limit);
    return "            <tr><th scope=\"row\">" + tam(o.borc) + " TL</th>" +
      "<td>" + tam(o.limit) + " TL</td>" +
      "<td>" + yuzde2(r.asgariOran) + "</td>" +
      "<td>" + tam(kalan) + " TL</td>" +
      "<td>" + yuzde2(1 - kalan / o.borc) + "</td>" +
      "<td>" + tam(r.faizToplam) + " TL</td>" +
      "<td>" + yuzde2(r.faizOrani) + "</td></tr>";
  });
  return blok("KART-SEYIR", [
    "          <table class=\"payroll\">",
    "            <caption>Yalnızca asgari ödenirse borcun seyri (yeni harcama yok)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Borç</th>",
    "                <th scope=\"col\">Kart limiti</th>",
    "                <th scope=\"col\">Asgari oran</th>",
    "                <th scope=\"col\">12 ay sonra kalan</th>",
    "                <th scope=\"col\">Eriyen kısım</th>",
    "                <th scope=\"col\">Toplam faiz ve vergi</th>",
    "                <th scope=\"col\">Anaparaya oranı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 3 */
function basabasTablosu() {
  var s = ORNEKLER.map(function (o) {
    var b = K.basabasHarcama(o.borc, o.limit);
    return "            <tr><th scope=\"row\">" + tam(o.borc) + " TL</th>" +
      "<td>" + yuzde2(K.asgariOrani(o.limit)) + "</td>" +
      "<td>" + tam(b.odeme) + " TL</td>" +
      "<td>" + tam(b.faiz) + " TL</td>" +
      "<td>" + tam(b.basabas) + " TL</td></tr>";
  });
  return blok("KART-BASABAS", [
    "          <table class=\"payroll\">",
    "            <caption>Borcu olduğu yerde tutan aylık harcama</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Borç</th>",
    "                <th scope=\"col\">Asgari oran</th>",
    "                <th scope=\"col\">Ayda ödenen asgari</th>",
    "                <th scope=\"col\">O ayın faizi</th>",
    "                <th scope=\"col\">Borcu sabit tutan harcama</th>",
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
  { ad: "KART-BANTLAR", uret: bantTablosu },
  { ad: "KART-SEYIR", uret: seyirTablosu },
  { ad: "KART-BASABAS", uret: basabasTablosu }
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
    console.log("Kart tabloları güncel.");
    return 0;
  }
  if (kontrol) {
    console.error(degisen + " kart tablosu güncel değil — " +
      "'node tools/kart-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " kart tablosu yazıldı.");
  return 0;
}

process.exit(main());
