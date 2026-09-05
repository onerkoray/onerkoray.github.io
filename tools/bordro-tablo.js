#!/usr/bin/env node
/*
 * bordro/index.html içindeki parametre tablosunu bordro/parametreler.js'ten üretir.
 *
 * Neden: parametre tablosunun SEO için statik HTML olması gerekiyor, ama elle
 * yazılırsa motorla sapar. Bu script tek doğruluk kaynağını okuyup işaretçiler
 * arasını yeniden yazar.
 *
 * Kullanım:
 *   node tools/bordro-tablo.js          # tabloyu güncelle
 *   node tools/bordro-tablo.js --check  # güncel mi diye bak, yazma (CI için)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var SAYFA = path.join(KOK, "bordro", "index.html");
var BAS = "<!-- PARAMETRE-TABLOSU:BASLANGIC -->";
var BIT = "<!-- PARAMETRE-TABLOSU:BITIS -->";

var B = require(path.join(KOK, "bordro", "motor.js"));

var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(n) { return nf.format(n); }
function tam(n) { return nf0.format(n); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Ay adı + Türkçe ayrılma hâli eki (ünlü uyumu ve ünsüz benzeşmesiyle).
var AYLAR = ["Ocak'tan", "Şubat'tan", "Mart'tan", "Nisan'dan", "Mayıs'tan", "Haziran'dan",
  "Temmuz'dan", "Ağustos'tan", "Eylül'den", "Ekim'den", "Kasım'dan", "Aralık'tan"];

function tarife(P) {
  return P.dilimler.map(function (d) {
    var oran = "%" + Math.round(d[1] * 100);
    return d[0] === null ? "üzeri " + oran : tam(d[0]) + " TL'ye kadar " + oran;
  }).join("; ");
}

function uret() {
  var satirlar = B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return P.donemler.map(function (d, i) {
      var donemAdi = P.donemler.length > 1 ? yil + " · " + AYLAR[d.ay - 1] + " itibaren" : String(yil);
      return "            <tr>" +
        "<th scope=\"row\">" + donemAdi + "</th>" +
        "<td>" + tl(d.asgariBrut) + "</td>" +
        "<td>" + tl(d.asgariNet) + "</td>" +
        "<td>" + tl(d.sgkTavan) + "</td>" +
        "<td>" + (i === 0 ? esc(tarife(P)) : "aynı") + "</td>" +
        "<td>" + (P.istisnaRejimi === "agi" ? "AGİ" : "Asgari ücret istisnası") + "</td>" +
        "<td>" + (P.damgaIstisnasi ? "asgari ücreti aşan kısım" : "brütün tamamı") + "</td>" +
        "</tr>";
    }).join("\n");
  }).join("\n");

  var dayanaklar = B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return "          <dt>" + yil + "</dt>\n          <dd>" + esc(P.dayanak) +
      (P.notlar ? " — " + esc(P.notlar) : "") + "</dd>";
  }).join("\n");

  var o = B.parametre(B.sonYil()).oranlar;

  return [
    BAS,
    "        <div class=\"table-scroll\">",
    "          <table class=\"payroll param-table\">",
    "            <caption class=\"visually-hidden\">2020-2026 bordro parametreleri</caption>",
    "            <thead><tr>",
    "              <th scope=\"col\">Dönem</th>",
    "              <th scope=\"col\">Asgari ücret (brüt)</th>",
    "              <th scope=\"col\">Asgari ücret (net)</th>",
    "              <th scope=\"col\">SGK prim tavanı</th>",
    "              <th scope=\"col\">Gelir vergisi tarifesi (ücret)</th>",
    "              <th scope=\"col\">İstisna rejimi</th>",
    "              <th scope=\"col\">Damga vergisi tabanı</th>",
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    "        <p class=\"muted-note\">",
    "          Tutarlar aylık ve TL cinsindendir. Tüm yıllarda kesinti oranları sabittir:",
    "          SGK işçi payı %" + Math.round(o.sgkIsci * 100) + ", işsizlik sigortası işçi payı %" + Math.round(o.issizlikIsci * 100) + ",",
    "          damga vergisi binde " + (o.damga * 1000).toFixed(2).replace(".", ",") + ",",
    "          işveren SGK payı %" + (o.sgkIsveren * 100).toFixed(2).replace(".", ",") + " ve işveren işsizlik payı %" + Math.round(o.issizlikIsveren * 100) + " (teşviksiz).",
    "        </p>",
    "",
    "        <h3>Yıl bazında yasal dayanak</h3>",
    "        <dl class=\"changelog\">",
    dayanaklar,
    "        </dl>",
    "        " + BIT
  ].join("\n");
}

function main() {
  var html = fs.readFileSync(SAYFA, "utf8");
  var i = html.indexOf(BAS), j = html.indexOf(BIT);
  if (i === -1 || j === -1) {
    console.error("İşaretçiler bulunamadı: " + BAS + " / " + BIT);
    process.exit(2);
  }
  var yeni = html.slice(0, i) + uret() + html.slice(j + BIT.length);

  if (process.argv.indexOf("--check") !== -1) {
    if (yeni === html) { console.log("Parametre tablosu güncel."); process.exit(0); }
    console.error("Parametre tablosu güncel değil — 'node tools/bordro-tablo.js' çalıştırın.");
    process.exit(1);
  }

  if (yeni === html) { console.log("Değişiklik yok."); return; }
  fs.writeFileSync(SAYFA, yeni, "utf8");
  console.log("bordro/index.html parametre tablosu güncellendi (" + B.yillar().length + " yıl).");
}

main();
