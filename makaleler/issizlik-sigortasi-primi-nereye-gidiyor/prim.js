/*
 * İşsizlik sigortası: sabit 2026 ücret/rule senaryosu.
 * Oranlar, tavan ve ödenek süreleri sitenin bordro parametrelerinden okunur.
 * Bu bir kişinin geçmiş prim kaydı ya da fon hesabı değildir.
 */
"use strict";

var B = require("../../tools/makale-sayi.js").bordro();
var P = B.parametre(2026);
var D = B.donem(P, 1);
var I = P.issizlik;

function kurus(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function model(brut, ay) {
  if (!Number.isFinite(brut) || brut < D.asgariBrut || !Number.isInteger(ay) || ay < 0 || ay > 36) {
    throw new RangeError("Brüt ücret 2026 asgari ücretinin altında olamaz; süre 0–36 tam ay olmalı.");
  }
  var matrah = Math.min(brut, D.sgkTavan);
  var isci = kurus(matrah * P.oranlar.issizlikIsci);
  var isveren = kurus(matrah * P.oranlar.issizlikIsveren);
  var devlet = kurus(matrah * I.devletPayi); // 11258 sayılı Karar: 1 Mayıs 2026'dan beri %0,5.
  var brutOdenek = kurus(Math.min(matrah * I.oran, D.asgariBrut * I.tavanOrani));
  var netOdenek = kurus(brutOdenek * (1 - P.oranlar.damga));
  var gun = ay * 30;
  var hakGun = I.sureler.find(function (s) { return gun >= s[0]; });
  var hakAy = hakGun ? hakGun[1] / 30 : 0;
  return {
    brut: brut, ay: ay, primGunu: gun, matrah: matrah, isciAy: isci,
    isverenAy: isveren, devletAy: devlet,
    isciToplam: kurus(isci * ay), isverenToplam: kurus(isveren * ay),
    devletToplam: kurus(devlet * ay),
    fonPrimToplam: kurus((isci + isveren + devlet) * ay),
    brutOdenek: brutOdenek, netOdenek: netOdenek,
    hakGun: hakGun ? hakGun[1] : 0, hakAy: hakAy,
    enCokNet: kurus(netOdenek * hakAy)
  };
}

module.exports = {
  model: model, yil: 2026, asgariBrut: D.asgariBrut, sgkTavan: D.sgkTavan,
  oranlar: { isci: P.oranlar.issizlikIsci, isveren: P.oranlar.issizlikIsveren, devlet: I.devletPayi }
};
