#!/usr/bin/env node
/*!
 * "Torba yasa beklentileri tuttu mu?" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tablolardaki yıl kırılımı, "beklentiden gelen" sayıları ve pencere
 * içi/dışı ayrımı modülde HESAPLANIYOR. Elle yazılsalardı, bir kanun
 * eklendiğinde ya da bir beklenti karşılandığında tablo ile modül sessizce
 * ayrışırdı -- ki bu yazının tek iddiası tam olarak o sayılar. --check
 * sapmayı CI'da söyler.
 *
 * ÜÇ TABLO
 *   BEKLENTI-KANUN   Pencere içindeki büyük torba kanunlar, RG künyeleri
 *                    ve her birinin beklenti listesinden getirdiği madde.
 *   BEKLENTI-DURUM   Tekrarlayan beklentiler ve bugünkü hukuki durumları.
 *   BEKLENTI-ARAC    Hangi beklenti hangi araçla karara bağlanıyor.
 *
 *   node tools/beklenti-tablosu.js           # tabloları yaz
 *   node tools/beklenti-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "torba-yasa-beklenti-tutuyor-mu");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KLASOR, "beklenti.js"));

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/* "2023-03-12" -> "12 Mart 2023" */
function tarih(iso) {
  var p = iso.split("-");
  return parseInt(p[2], 10) + " " + AYLAR[parseInt(p[1], 10) - 1] + " " + p[0];
}

/* Resmî Gazete künyesi. Sayı numarası doğrulanamadıysa UYDURULMUYOR --
   tarih tek başına yazılıyor. Tabloda boş hücre yok, eksik bilgi de
   gizlenmiyor. */
function kunye(k) {
  return tarih(k.rg) + (k.sayi === null ? "" : ", sayı " + k.sayi);
}

/* ------------------------------------------------------------------ */
function kanunTablosu() {
  var s = ["<!-- BEKLENTI-KANUN:BASLANGIC -->",
    "        <div class=\"table-scroll\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Gözlem penceresindeki büyük torba kanunlar ve beklenti listesinden getirdikleri</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Yıl</th><th scope=\"col\">Kanun</th>" +
    "<th scope=\"col\">Resmî Gazete</th><th scope=\"col\">Ne getirdi</th>" +
    "<th scope=\"col\">Beklentiden</th></tr>",
    "            </thead>",
    "            <tbody>"];

  B.yillar().forEach(function (y) {
    B.kanunlarYil(y).forEach(function (k, ix) {
      var gelen = k.getirdi.map(function (id) {
        var b = B.beklenti(id);
        return b ? b.ad : id;
      }).join(", ");
      s.push("              <tr>" +
        "<th scope=\"row\">" + (ix === 0 ? y : "") + "</th>" +
        "<td>" + k.no + "</td>" +
        "<td>" + kunye(k) + "</td>" +
        "<td>" + k.ozet + "</td>" +
        "<td>" + (gelen || "—") + "</td></tr>");
    });
  });

  s.push("            </tbody>",
    "            <tfoot>",
    "              <tr><th scope=\"row\" colspan=\"4\">Beklenti listesinden gelen toplam madde</th>" +
    "<td>" + B.pencereIciKarsilanan().length + "</td></tr>",
    "            </tfoot>",
    "          </table>",
    "        </div>",
    "<!-- BEKLENTI-KANUN:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function durumTablosu() {
  var s = ["<!-- BEKLENTI-DURUM:BASLANGIC -->",
    "        <div class=\"table-scroll\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Tekrarlayan beklentilerin " + B.ILK_YIL + "–" +
    B.SON_YIL + " penceresindeki durumu</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Beklenti</th><th scope=\"col\">Durum</th>" +
    "<th scope=\"col\">Dayanak</th></tr>",
    "            </thead>",
    "            <tbody>"];

  B.BEKLENTILER.forEach(function (b) {
    var durum, dayanak;
    if (!b.karsilandi) {
      durum = "Yasalaşmadı";
      dayanak = b.not;
    } else if (b.karsilandi.yil < B.ILK_YIL) {
      durum = "Pencere öncesi (" + b.karsilandi.yil + ")";
      dayanak = b.not;
    } else {
      durum = "Yasalaştı — " + b.karsilandi.yil;
      var k = B.kanun(b.karsilandi.kanun);
      dayanak = b.karsilandi.kanun + " sayılı Kanun" +
        (k ? ", " + kunye(k) : "") + (b.not ? " " + b.not : "");
    }
    s.push("              <tr><th scope=\"row\">" + b.ad + "</th>" +
      "<td>" + durum + "</td><td>" + dayanak + "</td></tr>");
  });

  s.push("            </tbody>",
    "          </table>",
    "        </div>",
    "<!-- BEKLENTI-DURUM:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function aracTablosu() {
  var s = ["<!-- BEKLENTI-ARAC:BASLANGIC -->",
    "        <div class=\"table-scroll\">",
    "          <table class=\"ed-tablo\">",
    "            <caption>Hangi başlık hangi araçla karara bağlanıyor</caption>",
    "            <thead>",
    "              <tr><th scope=\"col\">Başlık</th><th scope=\"col\">Karar aracı</th>" +
    "<th scope=\"col\">Torba kanunla gelebilir mi?</th></tr>",
    "            </thead>",
    "            <tbody>"];

  B.ARACLAR.forEach(function (a) {
    s.push("              <tr><th scope=\"row\">" + a.konu + "</th>" +
      "<td>" + a.arac + "</td>" +
      "<td>" + (a.torbaMi ? "Evet" : "Hayır") + "</td></tr>");
  });

  s.push("            </tbody>",
    "          </table>",
    "        </div>",
    "<!-- BEKLENTI-ARAC:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "BEKLENTI-KANUN", uret: kanunTablosu },
  { ad: "BEKLENTI-DURUM", uret: durumTablosu },
  { ad: "BEKLENTI-ARAC", uret: aracTablosu }
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
  if (!degisen) { console.log("Beklenti tabloları güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " beklenti tablosu güncel değil — " +
      "'node tools/beklenti-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " beklenti tablosu yazıldı.");
  return 0;
}

process.exit(main());
