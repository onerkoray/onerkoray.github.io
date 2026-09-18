#!/usr/bin/env node
/*!
 * "Yeniden değerleme oranı nedir?" yazısının dört tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tabloların tamamı iki kaynaktan türüyor: bordro/parametreler.js'teki
 * tarifeler ve dilim kayması yazısının seriler.js'indeki oranlar. Elle
 * yazılsaydı 2027 girildiğinde sessizce eskirdi.
 *
 * DÖRT TABLO
 * ----------
 *   ORAN    Yıllara göre yeniden değerleme oranı ve TÜFE — ikisinin aynı
 *           şey olmadığını gösteren tablo.
 *   KURAL   2026 tarifesinin aritmetiği, adım adım: önceki dilim, orana
 *           göre hesaplanan tutar, ilan edilen tutar, atılan kesir.
 *   OZET    Aynı denetimin bütün yıllar için sonucu.
 *   BEDEL   Yuvarlamanın birikmiş etkisi ve bunun bordrodaki karşılığı.
 *
 *   node tools/ydo-tablosu.js           # tabloları yaz
 *   node tools/ydo-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "yeniden-degerleme-orani-nedir");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KOK, "bordro", "motor.js"));
var Y = require(path.join(KLASOR, "ydo.js"));

var SON = B.sonYil();
var BAS = 2021;   /* birikmiş farkın başlangıç yılı: oran serisinin bir öncesi */

/* Bedel tablosundaki ücret düzeyleri, asgari ücretin katı olarak. */
var KATLAR = [1, 2, 3, 5, 8];

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde(o) { return "%" + y2(o * 100); }

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar).concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1 */
function oranTablosu() {
  var s = Y.oranliYillar().map(function (yil) {
    var d = Y.seri(yil);
    var fark = d.ydo - d.tufe;
    return "            <tr><th scope=\"row\">" + yil + "</th>" +
      "<td>" + yuzde(d.ydo / 100) + "</td>" +
      "<td>" + yuzde(d.tufe / 100) + "</td>" +
      "<td>" + (fark >= 0 ? "+" : "−") + y2(Math.abs(fark)) + " puan</td></tr>";
  });
  return blok("YDO-ORAN", [
    "          <table class=\"payroll\">",
    "            <caption>Yeniden değerleme oranı ile tüketici enflasyonu aynı şey değil</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Tarife yılı</th>",
    "                <th scope=\"col\">Yeniden değerleme oranı</th>",
    "                <th scope=\"col\">Önceki yıl TÜFE</th>",
    "                <th scope=\"col\">Fark</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 2 */
function kuralTablosu() {
  var d = Y.tarifeDenetimi(SON);
  var s = d.dilimler.map(function (x) {
    return "            <tr><th scope=\"row\">" + x.sira + ". dilim</th>" +
      "<td>" + tam(x.onceki) + "</td>" +
      "<td>" + tam(x.ham) + "</td>" +
      "<td>" + tam(x.ilan) + "</td>" +
      "<td>" + tam(x.atilan) + "</td>" +
      "<td>" + yuzde(x.atilanOran) + "</td></tr>";
  });
  return blok("YDO-KURAL", [
    "          <table class=\"payroll\">",
    "            <caption>" + SON + " tarifesi adım adım (oran " +
      yuzde(d.ydo / 100) + ", tutarlar TL)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Dilim</th>",
    "                <th scope=\"col\">" + (SON - 1) + " tutarı</th>",
    "                <th scope=\"col\">Oran uygulanınca</th>",
    "                <th scope=\"col\">İlan edilen</th>",
    "                <th scope=\"col\">Atılan kesir</th>",
    "                <th scope=\"col\">Atılan oranı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 3 */
function ozetTablosu() {
  var s = Y.tumDenetim().map(function (d) {
    var n = d.dilimler.length;
    var uyan = d.dilimler.filter(function (x) { return x.uygun; }).length;
    var enCok = d.dilimler.reduce(function (e, x) {
      return Math.max(e, x.atilanOran);
    }, 0);
    var toplamAtilan = d.dilimler.reduce(function (t, x) { return t + x.atilan; }, 0);
    return "            <tr><th scope=\"row\">" + d.yil + "</th>" +
      "<td>" + yuzde(d.ydo / 100) + "</td>" +
      "<td>" + uyan + " / " + n + "</td>" +
      "<td>" + yuzde(enCok) + "</td>" +
      "<td>" + tam(toplamAtilan) + " TL</td></tr>";
  });
  return blok("YDO-OZET", [
    "          <table class=\"payroll\">",
    "            <caption>Kural her yıl tarifeyi birebir üretiyor mu?</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Tarife yılı</th>",
    "                <th scope=\"col\">Yeniden değerleme oranı</th>",
    "                <th scope=\"col\">Kurala uyan dilim</th>",
    "                <th scope=\"col\">En büyük atılan kesir</th>",
    "                <th scope=\"col\">Toplam atılan</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ---------------------------------------------------------------- 4 */
function bedelTablosu() {
  var asgari = B.donem(B.parametre(SON), 1).asgariBrut;
  var s = KATLAR.map(function (kat) {
    var brut = asgari * kat;
    var r = Y.fazlaVergi(brut, BAS, SON);
    return "            <tr><th scope=\"row\">" + kat + "× asgari ücret</th>" +
      "<td>" + tam(brut) + "</td>" +
      "<td>" + tam(r.gercek) + "</td>" +
      "<td>" + tam(r.yuvarlamasiz) + "</td>" +
      "<td>" + (r.fazla < 0.5 ? "—" : tam(r.fazla) + " TL") + "</td></tr>";
  });
  return blok("YDO-BEDEL", [
    "          <table class=\"payroll\">",
    "            <caption>Yuvarlama olmasaydı: " + SON +
      " yılında ödenen fazla gelir vergisi (TL/yıl)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Ücret düzeyi</th>",
    "                <th scope=\"col\">Aylık brüt</th>",
    "                <th scope=\"col\">Ödenen yıllık vergi</th>",
    "                <th scope=\"col\">Yuvarlamasız tarifeyle</th>",
    "                <th scope=\"col\">Fazla ödenen</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat(["            </tbody>", "          </table>"]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "YDO-ORAN", uret: oranTablosu },
  { ad: "YDO-KURAL", uret: kuralTablosu },
  { ad: "YDO-OZET", uret: ozetTablosu },
  { ad: "YDO-BEDEL", uret: bedelTablosu }
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
  if (!degisen) { console.log("YDO tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " YDO tablosu güncel değil — " +
      "'node tools/ydo-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " YDO tablosu yazıldı.");
  return 0;
}

process.exit(main());
