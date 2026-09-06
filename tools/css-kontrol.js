#!/usr/bin/env node
/*
 * CSS dosyalarında süslü parantez dengesini denetler.
 *
 * Neden: style.css'te bir blok elle silinirken fazladan bir "}" kaldı.
 * CSS ayrıştırıcısı hata vermez — sessizce toparlanmaya çalışır ve o noktadan
 * sonraki İLK kuralı düşürür. Sonuç: yazdığınız kural hiç uygulanmaz, hiçbir
 * araç uyarmaz, tarayıcı konsolunda iz kalmaz. Bu tam bir gün kaybettirir.
 *
 * Kullanım:
 *   node tools/css-kontrol.js          # bulguları listele
 *   node tools/css-kontrol.js --check  # bulgu varsa hata ver (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var MUAF = ["node_modules", ".git", "images", "tools"];

function cssDosyalari(dizin, bulunan) {
  bulunan = bulunan || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (g) {
    if (g.name.charAt(0) === ".") return;
    var tam = path.join(dizin, g.name);
    var ust = path.relative(KOK, tam).split(path.sep)[0];
    if (MUAF.indexOf(ust) !== -1) return;
    if (g.isDirectory()) cssDosyalari(tam, bulunan);
    else if (g.name.slice(-4) === ".css") bulunan.push(tam);
  });
  return bulunan;
}

/* Yorumları, içindeki satır sonlarını koruyarak boşlukla değiştirir;
   böylece bulunan hatanın satır numarası doğru kalır. */
function yorumsuz(metin) {
  return metin.replace(/\/\*[\s\S]*?\*\//g, function (y) {
    return y.replace(/[^\n]/g, " ");
  });
}

function denetle(dosya) {
  var ham = fs.readFileSync(dosya, "utf8");
  var metin = yorumsuz(ham);
  var satirlar = metin.split("\n");
  var hamSatirlar = ham.split("\n");
  var derinlik = 0;
  var bulgular = [];

  satirlar.forEach(function (satir, i) {
    for (var k = 0; k < satir.length; k++) {
      if (satir[k] === "{") derinlik++;
      else if (satir[k] === "}") {
        derinlik--;
        if (derinlik < 0) {
          bulgular.push({
            satir: i + 1,
            tur: "fazladan }",
            metin: (hamSatirlar[i] || "").trim().slice(0, 70)
          });
          derinlik = 0;
        }
      }
    }
  });

  if (derinlik > 0) {
    bulgular.push({ satir: satirlar.length, tur: "kapanmamış " + derinlik + " blok", metin: "" });
  }
  return bulgular;
}

function main() {
  var toplam = 0;
  cssDosyalari(KOK).forEach(function (dosya) {
    var b = denetle(dosya);
    if (!b.length) return;
    toplam += b.length;
    var yol = path.relative(KOK, dosya).replace(/\\/g, "/");
    b.forEach(function (x) {
      console.error("  " + yol + ":" + x.satir + "  " + x.tur + (x.metin ? "  → " + x.metin : ""));
    });
  });

  if (!toplam) {
    console.log("CSS parantez dengesi tamam.");
    return 0;
  }
  console.error("\n" + toplam + " sorun. Dengesiz parantez, sonraki kuralı sessizce düşürür.");
  return 1;
}

var kod = main();
if (process.argv.indexOf("--check") !== -1) process.exit(kod);
