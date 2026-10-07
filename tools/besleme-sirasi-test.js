#!/usr/bin/env node
/*!
 * Atom akışları doğru sırada ve damgaları gerçek mi?
 *
 * NEDEN VAR
 * ---------
 * Besleme her yeni girdiye `T00:00:00` basıyordu. Aynı gün yayımlanan
 * girdiler böylece eşitleniyor ve aralarındaki sıra keyfî kalıyordu:
 * 21 Eylül 2026'da dört girdi vardı ve besleme okuyucusu günün yeni
 * yazısını en üstte değil, üçüncü sırada gösteriyordu.
 *
 * 7 Ekim 2026'dan beri üç akış içerik manifestinden üretiliyor
 * (scripts/build-feeds.mjs): atom.xml, makaleler/atom.xml, araclar/atom.xml.
 * Her girdi <published> (ilk yayın damgası, bir kez yazılır) ve <updated>
 * (özlü son commit'in zamanı) taşıyor. Sıra yayın damgasına göre: akış
 * "yeni ne var" sorusunu cevaplar, günlük yenilenen sayfa her gün en üste
 * çıkmaz.
 *
 * NE YAKALIYOR (her akışta)
 * -------------------------
 *   1. Girdiler yayın damgasına göre en yeniden eskiye sıralı.
 *   2. Akışın <updated>'ı girdilerin en yeni <updated>'ı.
 *   3. Her damga tam ISO biçiminde; updated, published'dan önce değil.
 *   4. Gece yarısı yayın damgası yalnız muaf girdilerde (git geçmişiyle
 *      tutmayan üç eski kayıt; uydurulmuş saat yazılmadı).
 *   5. Her girdi bir kategori taşıyor (genel akışta grafik/metodoloji
 *      dahil; kategori sözlüğü manifestte).
 *   6. Manifest üreteci yeni sayfaya gece yarısı damgası basmıyor.
 *
 * Kullanım: node tools/besleme-sirasi-test.js
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");

var GECE_YARISI_MUAF = [
  "https://korayoner.dev/bordro/",
  "https://korayoner.dev/fazla-mesai-hesaplama/",
  "https://korayoner.dev/isveren-maliyeti-hesaplama/"
];
var AKISLAR = ["atom.xml", "makaleler/atom.xml", "araclar/atom.xml"];
var BICIM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/;

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}
function t(s) { return new Date(s).getTime(); }

console.log("Atom akışları: sıra ve damgalar\n");
var toplam = 0, geceYarisiGorulen = {};
AKISLAR.forEach(function (ad) {
  var s = fs.readFileSync(path.join(KOK, ad), "utf8");
  var girdiler = (s.match(/<entry>[\s\S]*?<\/entry>/g) || []).map(function (g) {
    return {
      id: (g.match(/<id>([^<]+)<\/id>/) || [, ""])[1],
      yayin: (g.match(/<published>([^<]+)<\/published>/) || [, ""])[1],
      guncel: (g.match(/<updated>([^<]+)<\/updated>/) || [, ""])[1],
      kategori: /<category term="[a-z-]+"/.test(g)
    };
  });
  toplam += girdiler.length;
  console.log(ad + " — " + girdiler.length + " girdi");
  var bozuk = [];
  for (var i = 1; i < girdiler.length; i++) if (t(girdiler[i].yayin) > t(girdiler[i - 1].yayin)) bozuk.push(girdiler[i].id);
  dogru(ad + ": yayın damgasına göre en yeniden eskiye", bozuk.length === 0, bozuk.slice(0, 5).join("\n      "));
  var bas = s.match(/<\/subtitle>[\s\S]*?<updated>([^<]+)<\/updated>/);
  var enYeni = girdiler.reduce(function (m, g) { return !m || t(g.guncel) > t(m) ? g.guncel : m; }, "");
  dogru(ad + ": akış damgası en yeni değişiklik", !!bas && t(bas[1]) === t(enYeni), (bas ? bas[1] : "yok") + " != " + enYeni);
  var bicimsiz = girdiler.filter(function (g) { return !BICIM.test(g.yayin) || !BICIM.test(g.guncel); });
  dogru(ad + ": her damga tam ISO biçiminde", bicimsiz.length === 0, bicimsiz.slice(0, 5).map(function (g) { return g.id; }).join("\n      "));
  var geri = girdiler.filter(function (g) { return t(g.guncel) < t(g.yayin); });
  dogru(ad + ": updated yayından önce değil", geri.length === 0, geri.slice(0, 5).map(function (g) { return g.id + " " + g.guncel + " < " + g.yayin; }).join("\n      "));
  var geceYarisi = girdiler.filter(function (g) { return /T00:00:00\+03:00$/.test(g.yayin); });
  geceYarisi.forEach(function (g) { geceYarisiGorulen[g.id] = true; });
  var beklenmeyen = geceYarisi.filter(function (g) { return GECE_YARISI_MUAF.indexOf(g.id) < 0; });
  dogru(ad + ": muaf olmayan gece yarısı yayın damgası yok", beklenmeyen.length === 0, beklenmeyen.map(function (g) { return g.id; }).join("\n      "));
  var kategorisiz = girdiler.filter(function (g) { return !g.kategori; });
  dogru(ad + ": her girdide kategori", kategorisiz.length === 0, kategorisiz.slice(0, 5).map(function (g) { return g.id; }).join("\n      "));
});

/* Üreteç kararını sabitle: yeni sayfa için simdi(), gece yarısı değil. */
var uretec = fs.readFileSync(path.join(KOK, "scripts", "build-manifest.mjs"), "utf8");
dogru("manifest yeni sayfaya gece yarısı damgası basmıyor", !/\+\s*"T00:00:00\+03:00"\)\s*\|\|\s*ilkCommit/.test(uretec) && /\|\|\s*simdi\(\)/.test(uretec));

dogru("KONTROL: seksenden fazla girdi okundu", toplam > 80, String(toplam));
var gereksizMuaf = GECE_YARISI_MUAF.filter(function (u) { return !geceYarisiGorulen[u]; });
dogru("KONTROL: muaf listesinde artık gece yarısı olmayan girdi yok", gereksizMuaf.length === 0, gereksizMuaf.join(", "));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (besleme sırası)");
if (hata) process.exit(1);
