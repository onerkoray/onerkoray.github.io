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

/* Son 24 ayın yıllık enflasyonu: çizgi, alan ve her ay için görünmez okuma bölgesi. */
function grafik() {
  var aylar = Object.keys(T.aylar).sort().slice(-24), d = aylar.map(function (a) { return T.aylar[a].yillik; });
  var W = 360, H = 96, SOL = 4, SAG = 356, UST = 14, ALT = 78, enAz = Math.min.apply(null, d), enCok = Math.max.apply(null, d), ar = enCok - enAz || 1;
  function x(i) { return SOL + (SAG - SOL) * i / (aylar.length - 1); }
  function y(v) { return ALT - (v - enAz) / ar * (ALT - UST); }
  function yz(v) { return "%" + v.toFixed(2).replace(".", ","); }
  var yol = d.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
  var s = '<svg id="gn-cizim" viewBox="0 0 ' + W + " " + H + '" data-alt="' + ALT + '" role="img" aria-label="Yıllık enflasyon: ' + M.ayAdi(aylar[0]) + " " + yz(d[0]) +
    ", " + M.ayAdi(aylar[aylar.length - 1]) + " " + yz(d[d.length - 1]) + '.">';
  s += '<path class="gn-alan" d="' + yol + " L" + x(d.length - 1).toFixed(1) + " " + ALT + " L" + x(0).toFixed(1) + " " + ALT + ' Z"/><path class="gn-cizgi" d="' + yol + '"/>';
  s += '<path class="gn-imlec" d=""/><circle class="gn-son" r="4" cx="' + x(d.length - 1).toFixed(1) + '" cy="' + y(d[d.length - 1]).toFixed(1) + '"/><circle class="gn-vurgu" r="5"/>';
  s += '<text x="' + SOL + '" y="' + (H - 4) + '">' + M.ayAdi(aylar[0]) + '</text><text x="' + SAG + '" y="' + (H - 4) + '" text-anchor="end">' + M.ayAdi(aylar[aylar.length - 1]) + "</text>";
  var gen = (SAG - SOL) / (aylar.length - 1);
  aylar.forEach(function (a, i) {
    s += '<rect class="gn-bolge" x="' + (x(i) - gen / 2).toFixed(1) + '" y="0" width="' + gen.toFixed(1) + '" height="' + H + '" data-x="' + x(i).toFixed(1) + '" data-y="' + y(d[i]).toFixed(1) +
      '" data-ad="' + M.ayAdi(a) + '" data-deger="' + yz(d[i]) + '" data-aylik="' + yz(T.aylar[a].aylik) + '"/>';
  });
  return { svg: s + "</svg>", ilk: M.ayAdi(aylar[0]), ilkDeger: yz(d[0]) };
}

function blok() {
  var gr = grafik();
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
    '            <div class="gn-grafik">' + gr.svg + "</div>",
    '            <p class="gn-okuma" id="gn-okuma">' + "İki yıl önce " + gr.ilkDeger + " idi. Ayların üzerine gelin.</p>",
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
