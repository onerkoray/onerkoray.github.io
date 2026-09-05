#!/usr/bin/env node
/*
 * bordro/index.html içindeki parametre tablolarını bordro/parametreler.js'ten üretir.
 *
 * Neden: parametre tablosunun SEO için statik HTML olması gerekiyor, ama elle
 * yazılırsa motorla sapar. Bu script tek doğruluk kaynağını okuyup işaretçiler
 * arasını yeniden yazar.
 *
 * İki ayrı tablo üretilir: uzun tarife metni tek bir hücreye sığmadığı ve tabloyu
 * yatay kaydırmaya zorladığı için asgari ücret/SGK sınırlarından ayrıldı.
 *
 * Kullanım:
 *   node tools/bordro-tablo.js          # tabloları güncelle
 *   node tools/bordro-tablo.js --check  # güncel mi diye bak, yazma (CI için)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var SAYFA = path.join(KOK, "bordro", "index.html");
var BAS = "<!-- PARAMETRE-TABLOSU:BASLANGIC -->";
var BIT = "<!-- PARAMETRE-TABLOSU:BITIS -->";

var MATRIS_SAYFA = path.join(KOK, "isten-ayrilma-hesaplama", "index.html");
var MBAS = "<!-- HAK-MATRISI:BASLANGIC -->";
var MBIT = "<!-- HAK-MATRISI:BITIS -->";

var B = require(path.join(KOK, "bordro", "motor.js"));
var C = require(path.join(KOK, "bordro", "cikis.js"));

var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(n) { return nf.format(n); }
function tam(n) { return nf0.format(n); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Ay adı + Türkçe ayrılma hâli eki (ünlü uyumu ve ünsüz benzeşmesiyle).
var AYLAR = ["Ocak'tan", "Şubat'tan", "Mart'tan", "Nisan'dan", "Mayıs'tan", "Haziran'dan",
  "Temmuz'dan", "Ağustos'tan", "Eylül'den", "Ekim'den", "Kasım'dan", "Aralık'tan"];

function sinirSatirlari() {
  return B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return P.donemler.map(function (d) {
      var donemAdi = P.donemler.length > 1
        ? yil + " · " + AYLAR[d.ay - 1] + " itibaren"
        : String(yil);
      return "            <tr>" +
        '<th scope="row">' + donemAdi + "</th>" +
        "<td>" + tl(d.asgariBrut) + "</td>" +
        "<td>" + tl(d.asgariNet) + "</td>" +
        "<td>" + tl(d.sgkTavan) + "</td>" +
        "<td>" + (P.istisnaRejimi === "agi" ? "AGİ" : "Asgari ücret istisnası") + "</td>" +
        "<td>" + (P.damgaIstisnasi ? "asgari ücreti aşan kısım" : "brütün tamamı") + "</td>" +
        "</tr>";
    }).join("\n");
  }).join("\n");
}

function tarifeSatirlari() {
  return B.yillar().map(function (yil) {
    var hucreler = B.parametre(yil).dilimler.map(function (d) {
      return "<td>" + (d[0] === null ? "üzeri" : tam(d[0])) + "</td>";
    }).join("");
    return '            <tr><th scope="row">' + yil + "</th>" + hucreler + "</tr>";
  }).join("\n");
}

function tarifeBasliklari() {
  return B.parametre(B.sonYil()).dilimler.map(function (d) {
    return '              <th scope="col">%' + Math.round(d[1] * 100) + "</th>";
  }).join("\n");
}

function dayanaklar() {
  return B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return "          <dt>" + yil + "</dt>\n          <dd>" + esc(P.dayanak) +
      (P.notlar ? " — " + esc(P.notlar) : "") + "</dd>";
  }).join("\n");
}

function uret() {
  var o = B.parametre(B.sonYil()).oranlar;

  return [
    BAS,
    "        <h3>Asgari ücret, SGK sınırları ve istisna rejimi</h3>",
    '        <div class="table-scroll">',
    '          <table class="payroll param-table param-limits">',
    '            <caption class="visually-hidden">2020-2026 asgari ücret, SGK prim tavanı ve istisna rejimi</caption>',
    "            <thead><tr>",
    '              <th scope="col">Dönem</th>',
    '              <th scope="col">Asgari ücret (brüt)</th>',
    '              <th scope="col">Asgari ücret (net)</th>',
    '              <th scope="col">SGK prim tavanı</th>',
    '              <th scope="col">İstisna rejimi</th>',
    '              <th scope="col">Damga vergisi tabanı</th>',
    "            </tr></thead>",
    "            <tbody>",
    sinirSatirlari(),
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Tutarlar aylık ve TL cinsindendir. Tüm yıllarda kesinti oranları sabittir:",
    "          SGK işçi payı %" + Math.round(o.sgkIsci * 100) +
      ", işsizlik sigortası işçi payı %" + Math.round(o.issizlikIsci * 100) + ",",
    "          damga vergisi binde " + (o.damga * 1000).toFixed(2).replace(".", ",") + ",",
    "          işveren SGK payı %" + (o.sgkIsveren * 100).toFixed(2).replace(".", ",") +
      " ve işveren işsizlik payı %" + Math.round(o.issizlikIsveren * 100) + " (teşviksiz).",
    "        </p>",
    "",
    "        <h3>Gelir vergisi tarifesi (ücret gelirleri)</h3>",
    '        <div class="table-scroll">',
    '          <table class="payroll param-table param-rates">',
    '            <caption class="visually-hidden">2020-2026 ücret gelirleri gelir vergisi tarifesi</caption>',
    "            <thead><tr>",
    '              <th scope="col">Yıl</th>',
    tarifeBasliklari(),
    "            </tr></thead>",
    "            <tbody>",
    tarifeSatirlari(),
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Sütun başlıkları vergi oranını, hücrelerdeki tutarlar o dilimin",
    "          <strong>üst sınırını</strong> gösterir (TL). Son sütun, o sınırın üzerinde kalan",
    "          matraha uygulanan orandır. Tarife, yıl içinde biriken kümülatif matraha uygulanır.",
    "        </p>",
    "",
    "        <h3>Yıl bazında yasal dayanak</h3>",
    '        <dl class="changelog">',
    dayanaklar(),
    "        </dl>",
    "        " + BIT
  ].join("\n");
}

/* Fesih türü / hak matrisi — bordro/cikis.js içindeki FESIH_TURLERI tablosundan.
   Sayfadaki görünür matris ile hesabın kullandığı matris aynı kaynaktan gelir. */
function hakHucresi(v) {
  if (v === true) return '<td class="yes">Var</td>';
  if (v === false) return '<td class="no">Yok</td>';
  return '<td class="maybe">Sözleşmeye bağlı</td>';
}

function uretMatris() {
  var satirlar = C.FESIH_TURLERI.map(function (t) {
    return "            <tr>" +
      '<th scope="row">' + esc(t.kisa) + "</th>" +
      hakHucresi(t.kidem) +
      hakHucresi(t.ihbar) +
      hakHucresi(t.issizlik) +
      "<td>" + esc(t.dayanak) + "</td>" +
      "</tr>";
  }).join("\n");

  return [
    MBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll matris">',
    '            <caption class="visually-hidden">Fesih türüne göre kıdem, ihbar ve işsizlik ödeneği hakları</caption>',
    "            <thead><tr>",
    '              <th scope="col">Sözleşme nasıl sona erdi?</th>',
    '              <th scope="col">Kıdem tazminatı</th>',
    '              <th scope="col">İhbar tazminatı</th>',
    '              <th scope="col">İşsizlik ödeneği</th>',
    '              <th scope="col">Yasal dayanak</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          &ldquo;İhbar tazminatı&rdquo; sütunu <strong>işçiye ödenip ödenmediğini</strong> gösterir.",
    "          İstifada işçinin kendisi ihbar süresine uymazsa işverene ihbar tazminatı ödemek",
    "          durumunda kalabilir. Kıdem tazminatı için ayrıca en az bir yıl çalışmış olmak şarttır.",
    "        </p>",
    "        " + MBIT
  ].join("\n");
}

function isle(dosya, bas, bit, uretici, ad) {
  var html = fs.readFileSync(dosya, "utf8");
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i === -1 || j === -1) {
    console.error("İşaretçiler bulunamadı (" + ad + "): " + bas + " / " + bit);
    process.exit(2);
  }
  var yeni = html.slice(0, i) + uretici() + html.slice(j + bit.length);
  return { dosya: dosya, eski: html, yeni: yeni, ad: ad, degisti: yeni !== html };
}

function main() {
  var isler = [
    isle(SAYFA, BAS, BIT, uret, "parametre tabloları"),
    isle(MATRIS_SAYFA, MBAS, MBIT, uretMatris, "hak matrisi")
  ];
  var degisen = isler.filter(function (x) { return x.degisti; });

  if (process.argv.indexOf("--check") !== -1) {
    if (!degisen.length) { console.log("Üretilen tablolar güncel."); process.exit(0); }
    console.error("Güncel değil (" + degisen.map(function (x) { return x.ad; }).join(", ") +
      ") — 'node tools/bordro-tablo.js' çalıştırın.");
    process.exit(1);
  }

  if (!degisen.length) { console.log("Değişiklik yok."); return; }
  degisen.forEach(function (x) {
    fs.writeFileSync(x.dosya, x.yeni, "utf8");
    console.log(path.relative(KOK, x.dosya) + " — " + x.ad + " güncellendi.");
  });
}

main();
