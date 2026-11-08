#!/usr/bin/env node
/*
 * Ana sayfanın gündem şeridi: takvimden sıradaki tarihler ve son açıklanan veri.
 *
 * Tarih listesi bugüne bağlı değildir: pencerenin bütün tarihleri yazılır,
 * geçenleri tarayıcı (home.js) gizler. Böylece --check güne göre değişmez;
 * yalnız takvim kuralı ya da TÜFE serisi değişince blok değişir. Gece veri
 * işi build-all'u koştuğu için son veri kartı açıklamanın ertesi günü yenilenir.
 *
 * Kullanım:
 *   node tools/gundem.js           # yaz
 *   node tools/gundem.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var M = require(path.join(KOK, "finans", "mali-takvim.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var KT = require(path.join(KOK, "finans", "kira-tufe.js"));
var Z = require(path.join(KOK, "finans", "emekli-zammi-motoru.js"));
var SAYFA = path.join(KOK, "index.html");
var BAS = "<!-- ANA-GUNDEM:BASLANGIC -->", BIT = "<!-- ANA-GUNDEM:BITIS -->";

function kac(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function blok() {
  var son = M.sonVeri({ T: T, Z: Z, KT: KT });
  var tarihler = M.olaylar().map(function (o) {
    var hedef = o.araclar.length ? o.araclar[0].yol : "mali-takvim/";
    return '              <li data-tarih="' + o.tarih + '" hidden><span class="gn-gun"></span><a href="' + hedef + '">' + kac(o.ad) +
      '</a><time datetime="' + o.tarih + '">' + M.tarihAdi(o.tarih) + "</time></li>";
  });
  return [
    BAS,
    '        <div class="gn-serit">',
    '          <div class="gn-kart" id="gn-tarih">',
    '            <p class="gn-etiket">Sıradaki tarihler</p>',
    '            <ol class="gn-olaylar">',
    tarihler.join("\n"),
    "            </ol>",
    '            <p class="gn-alt"><a href="mali-takvim/">Mali takvimin tamamı</a></p>',
    "          </div>",
    '          <div class="gn-kart">',
    '            <p class="gn-etiket">Son veri · ' + son.ayAdi + "</p>",
    '            <p class="gn-sayi">' + son.yillik + ' <span class="gn-birim">yıllık enflasyon</span></p>',
    '            <p class="gn-alt">' + son.alt + ' · <a href="enflasyon-hesaplama/">Enflasyon hesaplama</a></p>',
    "          </div>",
    "        </div>",
    "        " + BIT
  ].join("\n");
}

function main() {
  var s = fs.readFileSync(SAYFA, "utf8"), i = s.indexOf(BAS), j = s.indexOf(BIT);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: ANA-GUNDEM");
  var yeni = s.slice(0, i) + blok() + s.slice(j + BIT.length);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== s) { console.log("Gündem şeridi güncel değil: node tools/gundem.js"); return 1; }
    console.log("Gündem şeridi güncel.");
    return 0;
  }
  if (yeni !== s) { fs.writeFileSync(SAYFA, yeni, "utf8"); console.log("Gündem şeridi yazıldı."); } else console.log("Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { blok: blok };
