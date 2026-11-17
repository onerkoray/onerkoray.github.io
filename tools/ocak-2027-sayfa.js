#!/usr/bin/env node
/*
 * /ocak-2027/ panosunun gövdesi: ocak-2027/durum.js'ten.
 *
 * Gece veri işi ve veri günü yoklaması bu üreteci koşar: TÜFE serisi
 * uzadıkça emekli ve memur satırları senaryodan kesine kendiliğinden döner;
 * 2027 parametresi, yeniden değerleme tebliği ya da yeni taban kanunu
 * girildiğinde ilgili satır da öyle.
 *
 * Kullanım:
 *   node tools/ocak-2027-sayfa.js           # yaz
 *   node tools/ocak-2027-sayfa.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var D = require(path.join(KOK, "ocak-2027", "durum.js"));
var M = require(path.join(KOK, "finans", "mali-takvim.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var SAYFA = path.join(KOK, "ocak-2027", "index.html");

var DURUM = {
  kesin: ["Kesin", "Resmî rakam açıklandı ya da kanundaki formülün bütün girdileri açıklandı."],
  hesaplandi: ["Hesaplandı", "Girdiler kesin; resmî metin bekleniyor."],
  senaryo: ["Senaryo", "Girdilerin bir kısmı açıklandı; kalan aylar varsayımla."],
  bekleniyor: ["Bekleniyor", "Karar verilmedi; bugünkü değer gösteriliyor."]
};
var SIRA = ["kesin", "hesaplandi", "senaryo", "bekleniyor"];

function deger(k) {
  if (k.deger == null) return "—";
  if (k.birim === "oran") return "%" + D.yuzde(k.deger);
  return D.tl(k.deger) + " TL";
}
function rozet(d) { return '<span class="op-durum op-durum--' + d + '">' + DURUM[d][0] + "</span>"; }

function ozetBlok() {
  var o = D.ozet();
  return '<ul class="op-sayac" aria-label="Kalemlerin durumu">' + SIRA.filter(function (d) { return o.say[d]; }).map(function (d) {
    return "<li>" + rozet(d) + "<b>" + o.say[d] + "</b></li>";
  }).join("") + "</ul>";
}

function tablo() {
  var satir = D.kalemler().map(function (k) {
    return "<tr><th scope=\"row\"><a href=\"../" + k.baglanti + "\">" + k.ad + "</a></th><td>" + rozet(k.durum) +
      "</td><td class=\"num\">" + deger(k) + "</td><td>" + (k.ne ? '<time datetime="' + k.ne + '">' + M.tarihAdi(k.ne) + "</time>" : "Belli değil") +
      "</td><td>" + k.merci + "</td></tr>\n<tr class=\"op-not\"><td colspan=\"5\">" + k.aciklama + "</td></tr>";
  });
  return '<div class="table-scroll"><table class="data-table op-tablo">\n<caption>Ocak 2027\'de değişen kalemler, bugünkü durum</caption>\n' +
    '<thead><tr><th scope="col">Kalem</th><th scope="col">Durum</th><th scope="col" class="num">Bugünkü değer</th><th scope="col">Kesinleşme</th><th scope="col">Karar</th></tr></thead>\n<tbody>\n' +
    satir.join("\n") + "\n</tbody></table></div>";
}

function sonVeri() {
  var t = D.tufeAltiAy(), son = T.sonAy, v = T.aylar[son];
  /* Sıradaki açıklama bugüne değil seriye göre seçilir: --check güne göre değişmez. */
  var y = +son.slice(0, 4), a = +son.slice(5, 7);
  var ertesi = (a === 12 ? y + 1 : y) + "-" + (a === 12 ? "01" : (a < 9 ? "0" : "") + (a + 1));
  var sonraki = M.olaylar().filter(function (o) { return o.ad.indexOf(M.ayAdi(ertesi) + " enflasyonu") === 0; })[0];
  return '<div class="op-veri">\n<p class="op-veri-etiket">Son açıklanan veri</p>\n' +
    "<p><strong>" + M.ayAdi(son) + " enflasyonu</strong>: aylık %" + D.sayi(v.aylik, 2) + ", yıllık %" + D.sayi(v.yillik, 2) + ". " +
    "Ocak zammına sayılan altı ayın " + t.aylar.length + "'i açıklandı; birikim %" + D.yuzde(t.birikim) + ".</p>\n" +
    (sonraki ? "<p>Sıradaki: <strong>" + sonraki.ad + "</strong>, <time datetime=\"" + sonraki.tarih + "\">" + M.tarihAdi(sonraki.tarih) + "</time>. " +
      "Site, TÜİK açıklamasından sonraki ilk yoklamada güncellenir (açıklama günü yarım saatte bir).</p>\n" : "") +
    "</div>";
}

function govde() {
  return [ozetBlok(), sonVeri(), tablo(),
    '<p class="op-aciklama">' + SIRA.map(function (d) { return rozet(d) + " " + DURUM[d][1]; }).join(" ") + "</p>"].join("\n");
}

function main() {
  var bas = "<!-- OCAK-PANO:BASLANGIC -->", bit = "<!-- OCAK-PANO:BITIS -->";
  var s = fs.readFileSync(SAYFA, "utf8"), i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: OCAK-PANO");
  var yeni = s.slice(0, i + bas.length) + "\n" + govde() + "\n" + s.slice(j);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== s) { console.log("Ocak 2027 panosu güncel değil: node tools/ocak-2027-sayfa.js"); return 1; }
    console.log("Ocak 2027 panosu güncel.");
    return 0;
  }
  if (yeni !== s) { fs.writeFileSync(SAYFA, yeni, "utf8"); console.log("Ocak 2027 panosu yazıldı."); } else console.log("Ocak 2027 panosu: değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { govde: govde, DURUM: DURUM };
