#!/usr/bin/env node
/*
 * "Miras kalan ev için vergi ödenir mi?" yazısının sayıları.
 * Hepsi finans/veraset.js'ten, 2026 tutarlarıyla (yıla çivili).
 *
 * Kullanım: node makaleler/miras-kalan-ev-icin-vergi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var V = require(path.join(S.KOK, "finans", "veraset.js"));
var t = S.yazi(__dirname);

var YIL = 2026, TEREKE = 8e6;
var AILELER = [
  ["Eş + 3 çocuk", { es: true, cocuk: 3 }],
  ["Eş + 2 çocuk", { es: true, cocuk: 2 }],
  ["Eş + 1 çocuk", { es: true, cocuk: 1 }],
  ["İki çocuk", { es: false, cocuk: 2 }],
  ["Tek çocuk", { es: false, cocuk: 1 }],
  ["Yalnız eş", { es: true }],
  ["Eş + anne ve baba", { es: true, cocuk: 0, ebeveyn: 2 }],
  ["Anne ve baba", { es: false, cocuk: 0, ebeveyn: 2 }]
];
var vergiler = {};
AILELER.forEach(function (a) {
  var r = V.miras({ yil: YIL, tereke: TEREKE, aile: a[1] });
  var s = V.vergisizSinir(a[1], YIL);
  vergiler[a[0]] = r.toplamVergi;
  t.gecsin("satır " + a[0], a[0] + " " + S.tl(r.toplamVergi) + " TL %" + S.yuzde(r.efektif) + " " +
    (s > 0 ? S.tam(Math.ceil(s)) + " TL" : "ilk liradan"));
});
t.dogru("en düşük eş + 3 çocuk", vergiler["Eş + 3 çocuk"] === 0);
t.gecsin("girişteki en yüksek", "yalnız anne-baba mirasçı olduğunda " + S.tam(vergiler["Anne ve baba"]) + " TL");
t.dogru("en yüksek anne ve baba", Object.keys(vergiler).every(function (k) { return vergiler[k] <= vergiler["Anne ve baba"]; }));

var P = V.parametre(YIL);
t.gecsin("istisna", "2.907.136 TL istisna düşülür");
t.dogru("istisna tebliğle aynı", P.istisna.furugVeEs === 2907136);
t.gecsin("eş + 2 çocuk sınırı", "net tereke " + S.tam(Math.ceil(V.vergisizSinir({ es: true, cocuk: 2 }, YIL))) + " TL'yi aşana kadar");

var r15 = V.miras({ yil: YIL, tereke: 15e6, aile: { es: true, cocuk: 2 } });
t.gecsin("15 milyon örneği", "15.000.000 TL net terekede toplam " + S.tl(r15.toplamVergi) + " TL vergi");
t.gecsin("15 milyon oranı", "terekenin %" + S.yuzde(r15.efektif));
t.gecsin("eşin payı", "Eşin payı (" + S.tam(r15.mirascilar[0].hisse) + " TL)");
t.dogru("verginin çoğu çocuklardan", r15.mirascilar[0].vergi < r15.mirascilar[1].vergi);
t.bitir();
