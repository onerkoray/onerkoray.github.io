#!/usr/bin/env node
/*!
 * Profil köprüsü denetimi.
 *
 * NEDEN VAR: köprü, araç sayfalarına HTML id'leriyle bağlanıyor. Bir alan
 * yeniden adlandırıldığında hiçbir şey patlamıyor — buton yine çıkıyor,
 * kullanıcı yine tıklıyor, yalnızca "Profil okunamadı" yazıyor ya da
 * alanların bir kısmı sessizce boş kalıyor. Bu, tam olarak bu kod
 * tabanında bir kez yaşanmış sessiz bozulma türü.
 *
 * Denetim şunları arıyor:
 *   1. Köprünün $("...") / el("...") ile dokunduğu her id, o aracın
 *      HTML'inde GERÇEKTEN var mı?
 *   2. profil.js ve profil-kopru.js sayfaya bağlı mı ve DOĞRU SIRADA mı?
 *   3. kopruKur() tanımlanmışsa çağrılmış mı? (tanımlayıp çağırmamak,
 *      köprüyü hiç eklememekle aynı şey ama fark edilmesi çok daha zor.)
 *
 * Not: id listesi ELLE YAZILMIYOR, köprü kodundan çıkarılıyor. Elle
 * tutulan bir liste, korumaya çalıştığı kodla birlikte eskir.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var hata = 0;
var bakilan = 0;

function oku(p) {
  try { return fs.readFileSync(path.join(KOK, p), "utf8"); }
  catch (e) { return null; }
}

/* Köprü bloğunu betikten kesip çıkarır: "PROFİL KÖPRÜSÜ" yorumundan ya da
   bagla({ çağrısından başlayıp parantez dengesiyle biter. */
function kopruBlogu(js) {
  var i = js.indexOf(".bagla({");
  if (i < 0) return null;
  var derinlik = 0;
  var j = js.indexOf("{", i);
  var basla = j;
  for (; j < js.length; j++) {
    if (js[j] === "{") derinlik++;
    else if (js[j] === "}") { derinlik--; if (!derinlik) return js.slice(basla, j + 1); }
  }
  return js.slice(basla);
}

var ARACLAR = [];
fs.readdirSync(KOK, { withFileTypes: true }).forEach(function (d) {
  if (!d.isDirectory() || d.name[0] === "." || d.name === "node_modules") return;
  var js = oku(d.name + "/script.js");
  if (js && js.indexOf(".bagla({") >= 0) ARACLAR.push(d.name);
});

if (!ARACLAR.length) {
  console.error("Köprü bağlı hiçbir araç bulunamadı — denetim anlamsız.");
  process.exit(1);
}

ARACLAR.sort().forEach(function (arac) {
  var html = oku(arac + "/index.html");
  var js = oku(arac + "/script.js");
  if (!html) { console.error("HTML yok: " + arac); hata++; return; }
  bakilan++;

  var blok = kopruBlogu(js);
  var idler = {};
  /* $("x"), el("x"), getElementById("x") — üç yazım da kullanılıyor. */
  var desen = /(?:\$|el|getElementById)\(\s*"([a-z][a-z0-9-]*)"\s*\)/g;
  var m;
  while ((m = desen.exec(blok))) idler[m[1]] = true;

  var eksik = Object.keys(idler).filter(function (id) {
    return html.indexOf('id="' + id + '"') < 0;
  });
  eksik.forEach(function (id) {
    console.error("  EKSİK ALAN   " + arac + " → id=\"" + id + "\" HTML'de yok");
    hata++;
  });

  ["finans/profil.js", "finans/profil-kopru.js"].forEach(function (d) {
    if (html.indexOf(d) < 0) {
      console.error("  BAĞLI DEĞİL  " + arac + " → " + d);
      hata++;
    }
  });

  var a = html.indexOf("finans/profil.js");
  var b = html.indexOf("finans/profil-kopru.js");
  var s = html.search(/<script src="script\.js(?:\?v=[0-9a-f]+)?"/);
  if (a >= 0 && b >= 0 && s >= 0 && !(a < b && b < s)) {
    console.error("  SIRA YANLIŞ  " + arac +
      " → profil.js, profil-kopru.js ve script.js bu sırada olmalı");
    hata++;
  }

  /* Tanimlayip cagirmamak: kopru hic yokmus gibi davranir.
     YORUMLAR ONCE SILINIYOR -- ilk surumde silinmiyordu ve yorum satirina
     alinmis bir "//kopruKur();" cagri sayiliyordu; yani denetimin tam da
     yakalamasi gereken durum onu kandiriyordu. */
  var kodsuz = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  if (kodsuz.indexOf("function kopruKur") >= 0 &&
      !/(?:^|[^a-zA-Z.$_])kopruKur\(\s*\);/m.test(
        kodsuz.replace("function kopruKur", ""))) {
    console.error("  ÇAĞRILMAMIŞ  " + arac + " → kopruKur() tanımlı ama çağrılmıyor");
    hata++;
  }

  console.log("  " + (eksik.length ? "!" : "✓") + " " + arac +
    " (" + Object.keys(idler).length + " alan)");
});

if (hata) {
  console.error("\n" + hata + " köprü bulgusu.");
  process.exit(1);
}
console.log("\nProfil köprüsü " + bakilan + " araçta tutarlı.");
