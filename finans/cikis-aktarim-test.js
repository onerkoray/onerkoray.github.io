#!/usr/bin/env node
/*!
 * Çıkış aktarımı — doğrulama. Çalıştırma: node finans/cikis-aktarim-test.js
 *
 * Asıl iddia: aktarılan girdiyle dayanma aracı, İşten Ayrılma Paketi'nin
 * gösterdiği paketin aynısını hesaplar. Karşılaştırma bütün sonuç nesnesi
 * üzerinden yapılır; eksik taşınan tek alan testi kırar.
 */
"use strict";
var A = require("./cikis-aktarim.js");
var C = require("../bordro/cikis.js");
var D = require("../finansal-emniyet-testi/hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function depo() {
  var m = {};
  return {
    m: m,
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = v; },
    removeItem: function (k) { delete m[k]; }
  };
}
/* Sonucun girdi yankısı anahtar sırasıyla ayrılır; karşılaştırılan hesaptır. */
function hesap(r) { var k = Object.assign({}, r); delete k.girdi; return JSON.stringify(k); }
function ornek(ek) {
  var g = { iseGiris: "2019-03-15", cikis: "2026-09-30", ciplakBrut: 60000, giydirmeEkleri: 5000,
    fesihTuru: "isveren", ihbarSuresiCalisildi: false, kullanilmayanIzinGunu: 14,
    son4AyBrutOrtalama: 65000, son3YilPrimGunu: 1080, sigortaBaslangici: null };
  Object.keys(ek || {}).forEach(function (k) { g[k] = ek[k]; });
  return g;
}

console.log("Tek seferlik aktarım");
var d = depo(), g = ornek();
ok("yazılır", A.yaz(d, g) === true);
ok("okunan yazılanla aynı", JSON.stringify(A.al(d)) === JSON.stringify(g));
ok("ikinci okuma boş", A.al(d) === null);
ok("okuyunca depo temizlenir", Object.keys(d.m).length === 0);

console.log("Bozuk kayıt");
d = depo();
d.setItem(A.ANAHTAR, "{bozuk");
ok("JSON bozuksa null", A.al(d) === null);
ok("bozuk kayıt da silinir", Object.keys(d.m).length === 0);
d.setItem(A.ANAHTAR, JSON.stringify({ surum: A.SURUM + 1, girdi: g }));
ok("başka şema sürümü null", A.al(d) === null);
ok("eksi tutar yazılmaz", A.yaz(depo(), ornek({ ciplakBrut: -1 })) === false);
ok("NaN tutar yazılmaz", A.yaz(depo(), ornek({ ciplakBrut: NaN })) === false);
ok("biçimsiz tarih yazılmaz", A.yaz(depo(), ornek({ cikis: "30.09.2026" })) === false);
ok("boş girdi yazılmaz", A.yaz(depo(), null) === false);
ok("kapalı depo hata atmaz", A.yaz({ setItem: function () { throw new Error("kapalı"); } }, g) === false);
ok("okunamayan depo hata atmaz", A.al({ getItem: function () { throw new Error("kapalı"); } }) === null);

console.log("İki araç aynı paketi hesaplar");
[
  ornek(),
  ornek({ fesihTuru: "istifa" }),
  ornek({ ihbarSuresiCalisildi: true, giydirmeEkleri: 12000 }),
  ornek({ son4AyBrutOrtalama: 95000, ciplakBrut: 90000 }),
  ornek({ sigortaBaslangici: "2005-02-01", fesihTuru: "emeklilik" })
].forEach(function (x) {
  var d2 = depo();
  A.yaz(d2, x);
  var ikinci = D.cikisPaketi(A.al(d2));
  ok(x.fesihTuru + ", brüt " + x.ciplakBrut + ", ek " + x.giydirmeEkleri,
    hesap(ikinci) === hesap(C.hesapla(x)));
});
ok("aktarımsız girdide ortalama brüte düşer",
  hesap(D.cikisPaketi({ iseGiris: "2019-03-15", cikis: "2026-09-30", ciplakBrut: 60000 })) ===
  hesap(C.hesapla({ iseGiris: "2019-03-15", cikis: "2026-09-30", ciplakBrut: 60000, giydirmeEkleri: 0,
    fesihTuru: "isveren", son3YilPrimGunu: 0, kullanilmayanIzinGunu: 0, ihbarSuresiCalisildi: false })));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
