#!/usr/bin/env node
/*
 * Yasal parametrelerin bordro/parametreler.js dışına kopyalanmasını engeller.
 *
 * Neden: kıdem tavanı tablosu bir süre hem kidem-tazminati-hesaplama/script.js
 * hem de bordro/parametreler.js içinde durdu. Bu tür kopyalar sessizce ayrışır —
 * bir yeri güncellersiniz, diğeri eski değerle hesaplamaya devam eder ve hiçbir
 * test patlamaz. Bu kontrol, tek doğruluk kaynağı kuralını CI'da zorunlu kılar.
 *
 * Kullanım:
 *   node tools/parametre-kopyasi.js          # bulguları listele
 *   node tools/parametre-kopyasi.js --check  # bulgu varsa hata ver (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);

/* Taranmayacak yollar: parametrelerin asıl yeri ve üretim araçları. */
var MUAF = ["bordro", "tools", "node_modules", ".git", "images"];

/* Yalnızca bu dosyada bulunması gereken, ayırt edici parametre değerleri.
   Genel sayılar (0.20, 12, 30…) bilinçli olarak listelenmedi — yanlış alarm üretir. */
var IMZALAR = [
  { desen: /\b33030(\.\d+)?\b/, ad: "2026 brüt asgari ücret" },
  { desen: /\b28075\.5\d*\b/, ad: "2026 net asgari ücret" },
  { desen: /\b297270(\.\d+)?\b/, ad: "2026 SGK prim tavanı" },
  { desen: /\b26005\.5\d*\b/, ad: "2025 brüt asgari ücret" },
  { desen: /\b195041\.25\b/, ad: "2025 SGK prim tavanı" },
  { desen: /\b0\.00759\b/, ad: "damga vergisi oranı" },
  { desen: /\b73729\.84\b/, ad: "2026/II kıdem tavanı" },
  { desen: /\b64948\.77\b/, ad: "2026/I kıdem tavanı" },
  { desen: /\b53919\.68\b/, ad: "2025/II kıdem tavanı" },
  { desen: /\b46655\.43\b/, ad: "2025/I kıdem tavanı" },
  { desen: /\b190000\b[\s\S]{0,40}\b400000\b/, ad: "2026 gelir vergisi tarifesi" },
  { desen: /\b1500000\b[\s\S]{0,40}\b5300000\b/, ad: "2026 gelir vergisi tarifesi" }
];

function dosyalar(dizin, bulunan) {
  bulunan = bulunan || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (g) {
    var tam = path.join(dizin, g.name);
    var göreli = path.relative(KOK, tam).split(path.sep)[0];
    if (MUAF.indexOf(göreli) !== -1 || g.name.charAt(0) === ".") return;
    if (g.isDirectory()) dosyalar(tam, bulunan);
    else if (g.name.slice(-3) === ".js") bulunan.push(tam);
  });
  return bulunan;
}

function main() {
  var bulgular = [];
  dosyalar(KOK).forEach(function (dosya) {
    var metin = fs.readFileSync(dosya, "utf8");
    IMZALAR.forEach(function (im) {
      var m = metin.match(im.desen);
      if (!m) return;
      // Satır numarasını bul
      var satir = metin.slice(0, metin.indexOf(m[0])).split("\n").length;
      bulgular.push({
        dosya: path.relative(KOK, dosya).replace(/\\/g, "/"),
        satir: satir,
        ad: im.ad,
        deger: m[0]
      });
    });
  });

  if (!bulgular.length) {
    console.log("Parametre kopyası yok — tek doğruluk kaynağı korunuyor.");
    return 0;
  }

  console.error("Yasal parametre bordro/parametreler.js dışında bulundu:\n");
  bulgular.forEach(function (b) {
    console.error("  " + b.dosya + ":" + b.satir + "  " + b.ad + " (" + b.deger + ")");
  });
  console.error("\nBu değerleri bordro/parametreler.js'ten okuyun; kopyalar sessizce ayrışır.");
  return 1;
}

var kod = main();
if (process.argv.indexOf("--check") !== -1) process.exit(kod);
