#!/usr/bin/env node
/*
 * Mali takvim sayfasının listesi. Tarihler finans/mali-takvim.js kuralından;
 * sayfa statik listeyi taşır, geçmiş satırları tarayıcıda gizlenir.
 *
 * Kullanım:
 *   node tools/takvim-sayfa.js           # yaz
 *   node tools/takvim-sayfa.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var M = require(path.join(KOK, "finans", "mali-takvim.js"));
var YAZI = path.join(KOK, "mali-takvim", "index.html");
var ETIKET = { veri: "Veri", vergi: "Vergi", yururluk: "Yürürlük" };

function gunAdi(iso) { return String(+iso.slice(8)); }

function liste() {
  var aylar = {}, h = [];
  M.olaylar().forEach(function (o) { (aylar[o.tarih.slice(0, 7)] = aylar[o.tarih.slice(0, 7)] || []).push(o); });
  Object.keys(aylar).sort().forEach(function (ay) {
    h.push('<section class="mt-ay" data-ay="' + ay + '">\n<h3>' + M.ayAdi(ay) + '</h3>\n<ol class="mt-liste">');
    aylar[ay].forEach(function (o) {
      var bag = o.araclar.map(function (a) { return '<a href="../' + a.yol + '">' + a.ad + "</a>"; }).join(" · ");
      h.push('<li class="mt-olay" data-tarih="' + o.tarih + '"><time class="mt-gun" datetime="' + o.tarih + '">' + gunAdi(o.tarih) + "</time>" +
        '<div class="mt-icerik"><p class="mt-ad"><strong>' + o.ad + '</strong> <span class="mt-tur">' + ETIKET[o.tur] + "</span></p><p>" + o.etki + "</p>" +
        (bag ? '<p class="mt-bag">' + bag + "</p>" : "") + "</div></li>");
    });
    h.push("</ol>\n</section>");
  });
  return h.join("\n");
}

function bekleyen() {
  return '<ul class="mt-bekleyen">\n' + M.BEKLEYENLER.map(function (b) {
    return '<li><strong>' + b.ad + "</strong> " + b.not + ' <a href="../' + b.arac.yol + '">' + b.arac.ad + "</a></li>";
  }).join("\n") + "\n</ul>";
}

function blok(s, ad, ic) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->", i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + ad);
  return s.slice(0, i + bas.length) + "\n" + ic + "\n" + s.slice(j);
}

function main() {
  var eski = fs.readFileSync(YAZI, "utf8");
  var yeni = blok(blok(eski, "TAKVIM-LISTE", liste()), "TAKVIM-BEKLEYEN", bekleyen());
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== eski) { console.log("Takvim sayfası güncel değil: node tools/takvim-sayfa.js"); return 1; }
    console.log("Takvim sayfası güncel.");
    return 0;
  }
  if (yeni !== eski) { fs.writeFileSync(YAZI, yeni, "utf8"); console.log("Takvim sayfası yazıldı."); } else console.log("Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
