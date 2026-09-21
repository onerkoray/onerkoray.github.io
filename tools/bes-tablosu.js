#!/usr/bin/env node
/*!
 * "BES devlet katkısı ne kadar değerli?" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Efektif oran sütunu KAPALI FORMDAN hesaplanıyor: m·min(C,A)/C. Elle
 * yazılsaydı, tavan ya da oran değiştiğinde tablo sessizce yanlış kalırdı
 * — ki bu sitede tam olarak bu oldu: devlet katkısı oranı dokuz ay
 * boyunca yedi ayrı yerde %30 yazılı kaldı. Tablo modülden türeyince
 * sayı tek yerde değişiyor.
 *
 * ÜÇ TABLO
 *   BES-ORAN     Oranın 2013'ten bugüne seyri ve azami yıllık katkı.
 *   BES-EFEKTIF  Katkı düzeyine göre efektif eşleşme oranının erimesi.
 *   BES-UFUK     Kesişim yılı ve kısa ufukta kesinti/katkı dengesi.
 *
 *   node tools/bes-tablosu.js           # yaz
 *   node tools/bes-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "bes-devlet-katkisi-ne-kadar-degerli");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KLASOR, "bes.js"));

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function tl(n) { return nf0.format(Math.round(n)) + " TL"; }
function yuzde(o, basamak) {
  var v = o * 100;
  var s = (basamak === undefined && v === Math.round(v))
    ? String(v) : v.toFixed(basamak === undefined ? 1 : basamak);
  return "%" + s.replace(".", ",");
}

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(iso) {
  var p = iso.split("-");
  return parseInt(p[2], 10) + " " + AYLAR[parseInt(p[1], 10) - 1] + " " + p[0];
}

/* ------------------------------------------------------------------ */
function oranTablosu() {
  var s = ["<!-- BES-ORAN:BASLANGIC -->",
    "        <div class=\"ed-tablo-sarmal\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Devlet katkısı oranının seyri ve 2026 parametreleriyle azami yıllık katkı</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Dönem</th><th scope=\"col\">Oran</th>" +
    "<th scope=\"col\">2026 tavanıyla azami yıllık katkı</th></tr>",
    "            </thead>",
    "            <tbody>"];

  B.ORANLAR.forEach(function (o) {
    var donem = tarih(o.baslangic) + " – " +
      (o.bitis === null ? "bugün" : tarih(o.bitis));
    s.push("              <tr><th scope=\"row\">" + donem + "</th>" +
      "<td>" + yuzde(o.oran) + "</td>" +
      "<td>" + tl(B.azamiKatki(o.oran)) + "</td></tr>");
  });

  s.push("            </tbody>",
    "          </table>",
    "        </div>",
    "<!-- BES-ORAN:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function efektifTablosu() {
  /* Tavanın katları: oran tam da bu katlara bölünerek eriyor. */
  var katlar = [0.5, 1, 1.5, 2, 3, 4];

  var s = ["<!-- BES-EFEKTIF:BASLANGIC -->",
    "        <div class=\"ed-tablo-sarmal\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Yıllık katkı arttıkça efektif eşleşme oranı nasıl eriyor (2026, yasal oran " +
    yuzde(B.guncelOran()) + ")</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Yıllık katkı payı</th>" +
    "<th scope=\"col\">Aylık karşılığı</th>" +
    "<th scope=\"col\">Devlet katkısı</th>" +
    "<th scope=\"col\">Efektif oran</th></tr>",
    "            </thead>",
    "            <tbody>"];

  katlar.forEach(function (k) {
    var C = B.tavan() * k;
    var ef = B.efektifOran(C);
    s.push("              <tr><th scope=\"row\">" + tl(C) + "</th>" +
      "<td>" + tl(C / 12) + "</td>" +
      "<td>" + tl(C * ef) + "</td>" +
      "<td>" + yuzde(ef, ef * 100 === Math.round(ef * 100) ? 0 : 1) + "</td></tr>");
  });

  s.push("            </tbody>",
    "            <tfoot>",
    "              <tr><th scope=\"row\" colspan=\"3\">Tavan</th><td>" +
    tl(B.tavan()) + "</td></tr>",
    "            </tfoot>",
    "          </table>",
    "        </div>",
    "<!-- BES-EFEKTIF:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function ufukTablosu() {
  var s = ["<!-- BES-UFUK:BASLANGIC -->",
    "        <div class=\"ed-tablo-sarmal\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Sistemde geçirilen süreye göre teşvikin durumu</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Süre</th><th scope=\"col\">Hak edilen katkı</th>" +
    "<th scope=\"col\">Durum</th></tr>",
    "            </thead>",
    "            <tbody>"];

  B.KISA_UFUK.forEach(function (k) {
    s.push("              <tr><th scope=\"row\">" + k.yil + " yıl</th>" +
      "<td>" + yuzde(B.hakEdis(k.yil)) + "</td>" +
      "<td>Kesintiler hak edilen katkının <strong>" +
      yuzde(k.kesintiPayi) + "</strong>'i — teşvik net negatif</td></tr>");
  });

  s.push("              <tr><th scope=\"row\">" + B.POZITIFE_DONUS_YILI +
    " yıl</th><td>" + yuzde(B.hakEdis(B.POZITIFE_DONUS_YILI)) +
    "</td><td>Teşvik net pozitife döner (hak ediş yükselir, gider iadesi başlar)</td></tr>");

  s.push("              <tr><th scope=\"row\">" + B.KESISIM.oran20 +
    ". yıl</th><td>" + yuzde(B.hakEdis(B.KESISIM.oran20)) +
    "</td><td><strong>Kesişim:</strong> fon gider kesintisi katkıyı aşar " +
    "(fon gideri " + yuzde(B.KESISIM.fonKesinti, 2) + ")</td></tr>");

  s.push("            </tbody>",
    "            <tfoot>",
    "              <tr><th scope=\"row\" colspan=\"2\">Eşleşme " +
    yuzde(B.oncekiOran()) + " iken kesişim</th><td>" +
    B.KESISIM.oran30 + ". yıl — indirim kesişimi <strong>" +
    B.ufukKaybi() + " yıl</strong> öne çekti</td></tr>",
    "            </tfoot>",
    "          </table>",
    "        </div>",
    "<!-- BES-UFUK:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "BES-ORAN", uret: oranTablosu },
  { ad: "BES-EFEKTIF", uret: efektifTablosu },
  { ad: "BES-UFUK", uret: ufukTablosu }
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
  if (!degisen) { console.log("BES tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " BES tablosu güncel değil — " +
      "'node tools/bes-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " BES tablosu yazıldı.");
  return 0;
}

process.exit(main());
