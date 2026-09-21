#!/usr/bin/env node
/*!
 * "Yılın en düşük maaşı hangi ay?" yazısının iki tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tablonun her satırı 5.670 brüt değerinin taranmasından çıkıyor; elle
 * yazılacak bir şey değil. Daha önemlisi, eşikler tarifeye ve asgari
 * ücrete bağlı: 2027 parametreleri girildiğinde bütün satırlar kayar.
 * Elle yazılsaydı sessizce yanlış kalırdı — bu sitede maaş sayfalarında
 * tam olarak bu oldu, 28 sayfa dokuz ay boyunca netin yıl boyunca
 * tekdüze düştüğünü söyledi.
 *
 * İKİ TABLO
 *   DIP-BANT      Brüt aralığına göre netin dibe vurduğu ay.
 *   DIP-ISTISNA   İstisnanın büyüdüğü aylar ve tutarları.
 *
 *   node tools/dip-ay-tablosu.js           # yaz
 *   node tools/dip-ay-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "yilin-en-dusuk-maasi-hangi-ay");
var SAYFA = path.join(KLASOR, "index.html");
var D = require(path.join(KLASOR, "dip-ay.js"));

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat("tr-TR",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
function tl2(n) { return nf2.format(n) + " TL"; }

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/* ------------------------------------------------------------------ */
function bantTablosu() {
  var s = ["<!-- DIP-BANT:BASLANGIC -->",
    "        <div class=\"table-scroll\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Brüt ücrete göre netin yılın dibini gördüğü ay — " +
      D.YIL + " parametreleriyle, " + tl0(D.baslangic()) + " ile " +
      tl0(D.ADIM_SON) + " arası " + nf0.format(D.ADIM) + " TL adımlarla taranmıştır</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Aylık brüt ücret</th>" +
      "<th scope=\"col\">Netin dibe vurduğu ay</th>" +
      "<th scope=\"col\">Yıl sonuna kadar geri kazanılan</th></tr>",
    "            </thead>",
    "            <tbody>"];

  D.bantlar().forEach(function (b) {
    var aralik = tl0(b.bas) + " – " + tl0(b.son);
    /* Geri çıkış yoksa "yok" yazmak yanıltıcı olurdu: net dipte kalıyor,
       yani dip ayı aynı zamanda Aralık netidir. */
    var geri = b.geriCikis > 0.005
      ? tl2(b.geriCikis)
      : "yıl sonuna kadar dipte kalır";
    s.push("              <tr><th scope=\"row\">" + aralik + "</th>" +
      "<td>" + AYLAR[b.dipAy] + "</td>" +
      "<td>" + geri + "</td></tr>");
  });

  s.push("            </tbody>",
    "          </table>",
    "        </div>",
    "<!-- DIP-BANT:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function istisnaTablosu() {
  var artis = D.istisnaArtislari();
  var s = ["<!-- DIP-ISTISNA:BASLANGIC -->",
    "        <div class=\"table-scroll\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Asgari ücret istisnasının " + D.YIL +
      " içinde büyüdüğü aylar — tutarlar brüt ücretten bağımsızdır, " +
      "yalnızca asgari ücrete bağlıdır</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Ay</th>" +
      "<th scope=\"col\">İstisnanın büyümesi</th>" +
      "<th scope=\"col\">Bu ayda netin yönü</th></tr>",
    "            </thead>",
    "            <tbody>"];

  artis.forEach(function (a) {
    s.push("              <tr><th scope=\"row\">" + AYLAR[a.ay] + "</th>" +
      "<td>" + tl2(a.tutar) + "</td>" +
      "<td>kendi dilim geçişiniz daha küçükse net yükselir</td></tr>");
  });

  s.push("            </tbody>",
    "          </table>",
    "        </div>",
    "<!-- DIP-ISTISNA:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "DIP-BANT", uret: bantTablosu },
  { ad: "DIP-ISTISNA", uret: istisnaTablosu }
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
  if (!degisen) { console.log("Dip ayı tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " dip ayı tablosu güncel değil — " +
      "'node tools/dip-ay-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " dip ayı tablosu yazıldı.");
  return 0;
}

process.exit(main());
