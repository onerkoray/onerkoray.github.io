#!/usr/bin/env node
/*
 * Veri görselleştirme renklerinin kurallarını CI'da zorunlu kılar.
 *
 * NEDEN VAR
 * ---------
 * Sitenin vurgu rengi KULLANICI TERCİHİ: beş palet arasından seçiliyor
 * (yeşil, mavi, mor, turuncu, gül). Bir grafik serisi var(--brand) veya
 * var(--accent) kullanırsa, verinin ANLAMI kullanıcının tema tercihiyle
 * değişir. Bu teorik bir risk değil; 2026-09-13'te ölçüldü:
 *
 *   finansal-emniyet-testi  .yol-secili (brand) vs .yol-batik (#c0392b)
 *     yeşil    CVD ΔE 5,0   (taban 6)  — renk körü ayırt edemiyor
 *     turuncu  normal ΔE 8,1 (taban 15) — kimse ayırt edemiyor
 *     gül      normal ΔE 11,7
 *   vergi-kamasi-hesaplama  .seri-ort (brand)
 *     yeşil    kroma 0,079  (taban 0,10) — veri işareti GRİ okunuyor
 *
 * Ayrıca aynı palet dört ayrı stil dosyasında kopyalanmıştı (--seri-1..3).
 * Kopyalar sessizce ayrışır: birini güncellersiniz, diğeri eski kalır.
 *
 * KURALLAR
 * --------
 *   1. --dv-* tokenları YALNIZCA style.css içinde tanımlanır.
 *   2. --seri-* gibi paralel bir palet uzayı açılmaz.
 *   3. SVG veri işaretleri (stroke/fill) --brand veya --accent kullanamaz.
 *      Tek istisna MUAF listesindedir ve her girdinin gerekçesi yazılıdır.
 *
 * Kullanım:
 *   node tools/veri-renkleri.js           # bulguları listele
 *   node tools/veri-renkleri.js --check   # bulgu varsa hata ver (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var ATLA = [".git", "node_modules", "_cekirdek", "__pycache__", "images"];

/* Tek seri işaretinde marka rengi SERBEST: ayırt edilecek ikinci seri yok,
   dolayısıyla tema değişince anlam kaymıyor. Dekoratif diyagramlar da
   veri işareti değil. Her istisna gerekçesiyle birlikte duruyor. */
var MUAF = {
  "doviz-kurlari/grafik.css":
    "tek serili kur çizgisi — ayırt edilecek ikinci seri yok",
  "bordro/diyagram.css":
    "mimari diyagram; veri işareti değil, dekoratif akış göstergesi",
  "style.css":
    "token tanımlarının kendisi ve .diyagram dekoratif düğümleri",
  "finansal-ozgurluk-hesaplama/style.css":
    "tek serili ortanca çizgisi — bant zaten nötr tonda",
  "borc-mu-birikim-mi/style.css":
    "vurgu deseni: bir hue + gri (mevduat çubuğu --text-muted ile ayrışıyor)"
};

/* stroke/fill = SVG veri işareti. background/border = arayüz bileşeni
   (buton, çip, rozet) ve bunlar marka rengini kullanmalı zaten. */
var ISARET = /(^|[;{\s])(stroke|fill)\s*:\s*var\(\s*--(brand|accent)/;
var DV_TANIM = /--dv-[a-z0-9-]+\s*:/;
var PARALEL = /--seri-[a-z0-9-]+\s*:/;

function cssDosyalari(dizin, cikti) {
  cikti = cikti || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (e) {
    if (ATLA.indexOf(e.name) > -1) return;
    var tam = path.join(dizin, e.name);
    if (e.isDirectory()) cssDosyalari(tam, cikti);
    else if (e.name.endsWith(".css")) cikti.push(tam);
  });
  return cikti;
}

var bulgular = [];
cssDosyalari(KOK).forEach(function (tam) {
  var göreli = path.relative(KOK, tam).split(path.sep).join("/");
  var satirlar = fs.readFileSync(tam, "utf8").split(/\r?\n/);

  satirlar.forEach(function (satir, i) {
    var no = i + 1;
    var temiz = satir.trim();
    if (temiz.startsWith("/*") || temiz.startsWith("*")) return;

    if (DV_TANIM.test(satir) && göreli !== "style.css") {
      bulgular.push([göreli, no, "--dv-* yalnızca style.css'te tanımlanmalı", temiz]);
    }
    if (PARALEL.test(satir)) {
      bulgular.push([göreli, no, "paralel palet uzayı (--seri-*); --dv-* kullan", temiz]);
    }
    if (ISARET.test(satir) && !MUAF[göreli]) {
      bulgular.push([göreli, no, "veri işareti marka/vurgu rengi kullanıyor", temiz]);
    }
  });
});

var kontrol = process.argv.indexOf("--check") > -1;

if (!bulgular.length) {
  console.log("Veri renkleri kurallara uygun (" + Object.keys(MUAF).length + " muaf dosya).");
  process.exit(0);
}

console.error("\nVeri rengi kuralı ihlali: " + bulgular.length + "\n");
bulgular.forEach(function (b) {
  console.error("  " + b[0] + ":" + b[1]);
  console.error("    " + b[2]);
  console.error("    " + b[3].slice(0, 92));
});
console.error("\nKural ve ölçümler: style.css içindeki --dv-* blok yorumu.");
console.error("Tek serili bir işaret marka rengini kullanabiliyorsa dosyayı");
console.error("tools/veri-renkleri.js içindeki MUAF listesine GEREKÇESİYLE ekle.\n");
process.exit(kontrol ? 1 : 0);
