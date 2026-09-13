#!/usr/bin/env node
/*!
 * İşsizlik ödeneğinin yıllara göre alt ve üst sınırını sayfaya yazar.
 *
 * NEDEN VAR
 * ---------
 * Search Console'da "işsizlik maaşı ne kadar 2023" ve "2023 yılı işsizlik
 * maaşı ne kadar" sorguları gösterim alıyor; sayfada ise geçmiş yıllara ait
 * tek bir sayı yoktu. Aynı zamanda "alt sınır" hiç geçmiyordu.
 *
 * Bu iki boşluk için AYRI SAYFA AÇILMADI. Her yıl için ince bir sayfa
 * üretmek, aynı arama niyetini bölmekten başka bir işe yaramaz; tek güçlü
 * sayfa içinde bir tablo hem kullanıcı hem arama için daha iyi.
 *
 * SAYILAR ELLE YAZILMIYOR
 * -----------------------
 * Tablo bordro/parametreler.js'ten, aracın KENDİ formülüyle türetiliyor:
 *
 *   üst sınır brüt = asgari brüt × tavanOrani (%80)
 *   alt sınır brüt = asgari brüt × oran (%40)
 *   net            = brüt − brüt × damga (binde 7,59)
 *
 * Alt sınır yasada ayrı bir tutar olarak yazmıyor; prime esas kazanç asgari
 * ücretin altına inemediği için fiilen oradan doğuyor. Sayfada da böyle
 * anlatılıyor — "yasal alt sınır" diye sunmak yanlış olurdu.
 *
 * Elle yazılsaydı asgari ücret her değiştiğinde tablo sessizce eskirdi ve
 * hata tam olarak bu sitenin kaçındığı türden olurdu: sayfa açılır, tablo
 * hizalı görünür, yalnızca yanlıştır.
 *
 *   node tools/issizlik-tablosu.js           # tabloyu yaz
 *   node tools/issizlik-tablosu.js --check   # güncel mi (CI)
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "issizlik-maasi-hesaplama", "index.html");
var BAS = "<!-- ISSIZLIK-TABLOSU:BASLANGIC -->";
var BIT = "<!-- ISSIZLIK-TABLOSU:BITIS -->";

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function tl(n) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/** Dönem etiketi: tek dönemse "Tüm yıl", iki dönemse ay aralığı. */
function donemAdi(donemler, i) {
  if (donemler.length === 1) return "Tüm yıl";
  var bas = donemler[i].ay;
  var son = (i + 1 < donemler.length) ? donemler[i + 1].ay - 1 : 12;
  return AYLAR[bas - 1] + "–" + AYLAR[son - 1];
}

function uret() {
  var B = require(path.join(KOK, "bordro", "parametreler.js"));
  var P = B.parametreler || B;
  /* Damga oranı YIL BAZINDA okunuyor: parametre dosyasında her yılın
     kendi oranlar bloğu var ve oran ileride değişebilir. Tek bir üst
     düzey orana bağlanmak, o değişikliği sessizce kaçırırdı. */
  var yillar = Object.keys(P)
    .filter(function (k) { return /^\d{4}$/.test(k); })
    .map(Number).sort(function (a, b) { return b - a; });   // yeniden eskiye

  var satir = [];
  yillar.forEach(function (y) {
    var p = P[y];
    if (!p.issizlik) return;
    var damga = p.oranlar && p.oranlar.damga;
    if (!damga) throw new Error(y + " için damga oranı yok");
    p.donemler.forEach(function (d, i) {
      var ustBrut = d.asgariBrut * p.issizlik.tavanOrani;
      var altBrut = d.asgariBrut * p.issizlik.oran;
      satir.push(
        "<tr><th scope=\"row\">" + y +
        (p.donemler.length > 1 ? " <small>" + donemAdi(p.donemler, i) + "</small>" : "") +
        "</th><td>" + tl(d.asgariBrut) + "</td><td>" +
        tl(altBrut * (1 - damga)) + "</td><td>" +
        tl(ustBrut * (1 - damga)) + "</td></tr>");
    });
  });

  var oran = Math.round(P[yillar[0]].issizlik.oran * 100);
  var tavanOran = Math.round(P[yillar[0]].issizlik.tavanOrani * 100);

  return BAS + "\n" +
    '        <div class="table-scroll">\n' +
    '          <table class="payroll">\n' +
    '            <caption>Yıllara göre işsizlik ödeneği sınırları (net, aylık)</caption>\n' +
    "            <thead><tr>" +
    '<th scope="col">Dönem</th>' +
    '<th scope="col">Brüt asgari ücret</th>' +
    '<th scope="col">Alt sınır</th>' +
    '<th scope="col">Üst sınır</th>' +
    "</tr></thead>\n" +
    "            <tbody>\n              " + satir.join("\n              ") +
    "\n            </tbody>\n" +
    "          </table>\n" +
    "        </div>\n" +
    '        <p class="muted-note">Tutarlar aracın kendi formülünden türetilmiştir: ' +
    "üst sınır brüt asgari ücretin %" + tavanOran + "'i, alt sınır %" + oran + "'ı; " +
    "her ikisinden de binde 7,59 damga vergisi düşülmüştür. " +
    "<strong>Alt sınır kanunda ayrı bir tutar olarak yazmaz</strong> — prime esas " +
    "kazanç asgari ücretin altına inemediği için fiilen buradan doğar. " +
    "Ödeneğin başvuru tarihindeki asgari ücrete göre belirlendiğini unutmayın.</p>\n" +
    "        " + BIT;
}

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var s = fs.readFileSync(SAYFA, "utf8");
  var i = s.indexOf(BAS);
  var j = s.indexOf(BIT);
  if (i < 0 || j < 0) {
    console.error("Tablo işaretleri sayfada yok: " + BAS);
    return 1;
  }
  var yeni = s.slice(0, i) + uret() + s.slice(j + BIT.length);
  if (yeni === s) {
    console.log("İşsizlik tablosu güncel.");
    return 0;
  }
  if (kontrol) {
    console.error("İşsizlik tablosu bayat — parametreler değişmiş.");
    console.error("Calistir: node tools/issizlik-tablosu.js");
    return 1;
  }
  fs.writeFileSync(SAYFA, yeni);
  console.log("İşsizlik tablosu yazıldı.");
  return 0;
}

process.exit(main());
