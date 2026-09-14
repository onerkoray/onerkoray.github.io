#!/usr/bin/env node
/*!
 * Kıdem tazminatı tavanının yıllara göre tablosunu sayfaya yazar.
 *
 * NEDEN VAR
 * ---------
 * Search Console'da "kıdem tazminatı tavanı 2019", "kidem tazminati tavani
 * 2021", "kıdem tazminatı tavan 2024" gibi yedi sorgu gösterim alıyor ve
 * hepsi 70–95. sıralarda düşüyor. Sayfada ise geçmiş yıllara ait tek bir
 * tutar yoktu.
 *
 * BU BOŞLUK İÇİN AYRI SAYFA AÇILMADI. Her yıl için ince bir sayfa üretmek,
 * aynı arama niyetini bölmekten başka işe yaramaz; tek güçlü sayfa içindeki
 * bir tablo hem okuyucu hem arama için daha iyi. Aynı gerekçe
 * tools/issizlik-tablosu.js'te de yazılı — orada bir kez karar verildi.
 *
 * SAYILAR ELLE YAZILMIYOR
 * -----------------------
 * Tablo bordro/parametreler.js'teki kidemTavanlari serisinden üretiliyor.
 * Elle yazılsaydı her yeni genelgede sessizce eskirdi: sayfa açılır, tablo
 * hizalı görünür, yalnızca yanlıştır.
 *
 * "Bir gün farkı" sütunu da hesaplanıyor, çünkü tablonun asıl anlattığı şey
 * bu: tavan yılda iki kez değişiyor ve uygulanan tavan FESİH TARİHİNİN
 * dönemine göre belirleniyor. 30 Haziran ile 1 Temmuz arasındaki fark,
 * tavanın üzerinde maaş alan biri için on yıllık kıdemde altı haneli
 * olabiliyor.
 *
 *   node tools/kidem-tavan-tablosu.js           # tabloyu yaz
 *   node tools/kidem-tavan-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "makaleler", "kidem-tazminati-tavani", "index.html");
var BAS = "<!-- KIDEM-TAVAN-TABLOSU:BASLANGIC -->";
var BIT = "<!-- KIDEM-TAVAN-TABLOSU:BITIS -->";

/* Örnek çalışan: tam on yıl, tavanın belirgin üzerinde ücret. On yıl
   seçildi çünkü farkı yıl sayısı çarpıyor ve on yıl okunabilir bir
   büyüklük veriyor; ücret tavanın üzerinde olduğu sürece hangi ücret
   olduğu sonucu DEĞİŞTİRMEZ — tavan zaten devreye giriyor. */
var ORNEK_YIL = 10;

function tl(n) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }

function uret() {
  /* Modül yılları doğrudan dışa açıyor; ileride bir sarmalayıcı eklenirse
     diye ikisi de kabul ediliyor. */
  var M = require(path.join(KOK, "bordro", "parametreler.js"));
  var P = M.parametreler || M;
  var yillar = Object.keys(P)
    .filter(function (k) { return /^\d{4}$/.test(k) && P[k].kidemTavanlari; })
    .map(Number)
    .sort(function (a, b) { return b - a; });      // yeniden eskiye

  var satir = [];
  yillar.forEach(function (yil) {
    var liste = P[yil].kidemTavanlari;
    var ocak = null, temmuz = null;
    liste.forEach(function (k) {
      if (k.ay === 1) ocak = k.tutar;
      if (k.ay === 7) temmuz = k.tutar;
    });
    if (ocak === null || temmuz === null) return;

    /* Bir günlük fark: on yıllık kıdemde iki tavan arasındaki brüt fark. */
    var fark = (temmuz - ocak) * ORNEK_YIL;
    var yuzde = (temmuz / ocak - 1) * 100;

    satir.push(
      "            <tr><th scope=\"row\">" + yil + "</th>" +
      "<td>" + tl(ocak) + "</td>" +
      "<td>" + tl(temmuz) + "</td>" +
      "<td>%" + yuzde.toFixed(1).replace(".", ",") + "</td>" +
      "<td>" + tam(fark) + " TL</td></tr>"
    );
  });

  return [
    BAS,
    "          <table class=\"payroll\">",
    "            <caption>Kıdem tazminatı tavanı, yıllara ve dönemlere göre (TL)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Yıl</th>",
    "                <th scope=\"col\">Ocak–Haziran</th>",
    "                <th scope=\"col\">Temmuz–Aralık</th>",
    "                <th scope=\"col\">Artış</th>",
    "                <th scope=\"col\">10 yıllık kıdemde bir gün farkı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(satir).concat([
    "            </tbody>",
    "          </table>",
    BIT
  ]).join("\n");
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var s = fs.readFileSync(SAYFA, "utf8");
  var i = s.indexOf(BAS), j = s.indexOf(BIT);
  if (i < 0 || j < 0) {
    console.error("Sayfada tablo işareti yok: " + BAS + " / " + BIT);
    return 1;
  }
  var mevcut = s.slice(i, j + BIT.length);
  var yeni = uret();

  if (mevcut === yeni) {
    console.log("Kıdem tavanı tablosu güncel.");
    return 0;
  }
  if (kontrol) {
    console.error("Kıdem tavanı tablosu güncel değil — " +
      "'node tools/kidem-tavan-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s.slice(0, i) + yeni + s.slice(j + BIT.length), "utf8");
  console.log("Kıdem tavanı tablosu yazıldı.");
  return 0;
}

process.exit(main());
