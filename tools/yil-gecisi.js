#!/usr/bin/env node
/*
 * Yeni yılın bordro parametrelerini bordro/parametreler.js'e tek girdiyle yazar.
 *
 * Asgari ücret açıklandığı gün dosyayı elle düzenlemek hem yavaş hem riskli:
 * yanlış giriş sessizdir, site yanlış hesaplamaya devam eder. Bu araç son yılın
 * bloğunu kopyalar, yalnız girdide verilen değerleri değiştirir, SGK tavanını
 * katsayıdan türetir ve elle bakılması gereken kalemleri listeler.
 *
 * Girdi (JSON):
 *   { "yil": 2027, "asgariBrut": 0, "asgariNet": 0,
 *     "dilimler": [[...]], "dilimlerUcretDisi": [[...]], "engellilik": [a, b, c],
 *     "meskenIstisnasi": 0, "tevkifatsizHad": 0,
 *     "kidemTavanlari": [{ "ay": 1, "tutar": 0 }] }
 *
 * Kullanım: node tools/yil-gecisi.js girdi.json [--kok DİZİN]
 * Sonrası : node bordro/test.js, ardından bütün CI ve kırılan üreteçler.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ZORUNLU = ["yil", "asgariBrut", "asgariNet", "dilimler", "dilimlerUcretDisi", "engellilik", "meskenIstisnasi", "tevkifatsizHad", "kidemTavanlari"];

function dizi(x) { return JSON.stringify(x).replace(/,/g, ", ").replace(/\[\[/, "[[").replace(/\], \[/g, "], ["); }

function degistir(blok, desen, yeni, ad) {
  if ((blok.match(new RegExp(desen.source, desen.flags.replace("g", "") + "g")) || []).length !== 1) throw new Error("Blokta tek eşleşme yok: " + ad);
  return blok.replace(desen, function () { return yeni; });
}

/* Son yılın bloğunu bulur: dosyada yıllar yeniden eskiye sıralı. */
function sonBlok(s) {
  var m = /^ {4}(\d{4}): \{$/m.exec(s);
  if (!m) throw new Error("Yıl bloğu bulunamadı.");
  var son = s.indexOf("\n    },\n", m.index);
  if (son < 0) throw new Error("Yıl bloğunun sonu bulunamadı.");
  return { yil: +m[1], bas: m.index, bit: son + "\n    },\n".length };
}

function kur(s, g, bugun) {
  ZORUNLU.forEach(function (k) { if (g[k] == null) throw new Error("Girdide eksik: " + k); });
  var b = sonBlok(s);
  if (g.yil !== b.yil + 1) throw new Error("Sıradaki yıl " + (b.yil + 1) + " olmalı, girdi " + g.yil + ".");
  var blok = s.slice(b.bas, b.bit);
  var kat = +(/tavanKatsayisi: ([\d.]+)/.exec(blok) || [])[1];
  if (!kat) throw new Error("tavanKatsayisi okunamadı.");
  var tavan = Math.round(g.asgariBrut * kat * 100) / 100;

  blok = degistir(blok, new RegExp("^ {4}" + b.yil + ": \\{$", "m"), "    " + g.yil + ": {", "yıl anahtarı");
  blok = degistir(blok, /yil: \d{4},/, "yil: " + g.yil + ",", "yil");
  blok = degistir(blok, /guncelleme: "[^"]*"/, 'guncelleme: "' + bugun + '"', "guncelleme");
  blok = degistir(blok, /^ {6}dilimler: .*$/m, "      dilimler: " + dizi(g.dilimler) + ",", "dilimler");
  blok = degistir(blok, /^ {6}dilimlerUcretDisi: .*$/m, "      dilimlerUcretDisi: " + dizi(g.dilimlerUcretDisi) + ",", "dilimlerUcretDisi");
  blok = degistir(blok, /^ {6}engellilik: .*$/m, "      engellilik: " + dizi(g.engellilik) + ",", "engellilik");
  blok = degistir(blok, /meskenIstisnasi: \d+/, "meskenIstisnasi: " + g.meskenIstisnasi, "meskenIstisnasi");
  blok = degistir(blok, /tevkifatsizHad: \d+/, "tevkifatsizHad: " + g.tevkifatsizHad, "tevkifatsizHad");
  blok = degistir(blok, /donemler: \[[\s\S]*?\n {6}\],/,
    "donemler: [\n        { ay: 1, asgariBrut: " + g.asgariBrut.toFixed(2) + ", asgariNet: " + g.asgariNet.toFixed(2) + ", sgkTavan: " + tavan.toFixed(2) + " }\n      ],", "donemler");
  blok = degistir(blok, /kidemTavanlari: \[[\s\S]*?\n {6}\],/,
    "kidemTavanlari: [\n" + g.kidemTavanlari.map(function (k) { return "        { ay: " + k.ay + ", tutar: " + k.tutar.toFixed(2) + " }"; }).join(",\n") + "\n      ],", "kidemTavanlari");

  var bak = blok.split("\n").map(function (l, i) { return [i, l]; }).filter(function (x) { return new RegExp("\\b" + b.yil + "\\b").test(x[1]); });
  return { metin: s.slice(0, b.bas) + blok + "\n" + s.slice(b.bas), tavan: tavan, onceki: b.yil, bak: bak.map(function (x) { return x[1].trim(); }) };
}

function main() {
  var a = process.argv.slice(2), i = a.indexOf("--kok");
  var kok = i >= 0 ? a[i + 1] : path.dirname(__dirname);
  var dosya = a.filter(function (x, j) { return x !== "--kok" && j !== i + 1 || i < 0; })[0];
  if (!dosya) { console.error("Kullanım: node tools/yil-gecisi.js girdi.json [--kok DİZİN]"); return 1; }
  var hedef = path.join(kok, "bordro", "parametreler.js");
  var r = kur(fs.readFileSync(hedef, "utf8"), JSON.parse(fs.readFileSync(dosya, "utf8")), new Date().toISOString().slice(0, 10));
  fs.writeFileSync(hedef, r.metin, "utf8");
  console.log("Yazıldı. SGK tavanı " + r.tavan.toFixed(2) + " TL (katsayıdan türetildi).");
  console.log("Elle bakılacak: oranlar, issizlik.devletPayi, sirket, sigortalilik, dayanak.");
  console.log(r.onceki + " yılını anan satırlar (" + r.bak.length + "):");
  r.bak.forEach(function (l) { console.log("  " + l.slice(0, 100)); });
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { kur: kur, sonBlok: sonBlok };
