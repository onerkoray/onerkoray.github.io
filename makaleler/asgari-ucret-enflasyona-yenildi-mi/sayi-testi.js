#!/usr/bin/env node
/*
 * "Asgari ücret enflasyona yenildi mi?" yazısının sayıları.
 *
 * Resmî net asgari ücret bordro/parametreler.js'ten (motor üzerinden),
 * fiyatlar finans/tufe-endeksi.js'ten. Her şey Ağustos 2026 lirasıyla;
 * geçmiş aylar değişmediği için yeni TÜFE verisi bu testi etkilemez.
 *
 * Kullanım: node makaleler/asgari-ucret-enflasyona-yenildi-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var R = require(path.join(S.KOK, "finans", "reel-maas.js"));
var t = S.yazi(__dirname);

var SON = "2026-08";
function ay(y, m) { return y + "-" + String(m).padStart(2, "0"); }
function reel(a) { return R.asgariNet(a) * E.carpan(a, SON); }
var KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/* Dönem tablosu. */
var erimeler = [];
[2020, 2021, 2022, 2023, 2024, 2025, 2026].forEach(function (y) {
  var d = B.parametre(y).donemler;
  d.forEach(function (x, i) {
    var bas = ay(y, x.ay), bitAy = i + 1 < d.length ? d[i + 1].ay - 1 : 12, son = ay(y, bitAy);
    if (son > SON) { son = SON; bitAy = +SON.slice(5); }
    var r1 = reel(bas), r2 = reel(son), er = r2 / r1 - 1;
    erimeler.push({ y: y, er: er, r1: r1 });
    t.gecsin("dönem " + bas, KISA[x.ay] + "–" + KISA[bitAy] + " " + y + " " + S.tl(x.asgariNet) + " TL " +
      S.tam(r1) + " TL " + S.tam(r2) + " TL " + S.eksi("-") + "%" + S.yuzde(-er, 1));
  });
});
var enAz = Math.min.apply(null, erimeler.map(function (e) { return -e.er; }));
var enCok = Math.max.apply(null, erimeler.map(function (e) { return -e.er; }));
t.gecsin("erime aralığı", "%" + S.yuzde(enAz, 1) + " ile %" + S.yuzde(enCok, 1) + " arasında alım");
var cokEriyen = erimeler.filter(function (e) { return -e.er === enCok; })[0];
t.dogru("en sert erime 2024", cokEriyen.y === 2024, cokEriyen.y);

/* Yıllık ortalama. */
var ort = {};
[2020, 2021, 2022, 2023, 2024, 2025, 2026].forEach(function (y) {
  var s = 0, n = 0;
  for (var m = 1; m <= 12; m++) { if (ay(y, m) > SON) break; s += reel(ay(y, m)); n++; }
  ort[y] = s / n;
});
Object.keys(ort).forEach(function (y) {
  var fark = ort[y] / ort[2020] - 1;
  t.gecsin("ortalama " + y, y + " " + S.tam(ort[y]) + " TL " + (+y === 2020 ? "—" : "+%" + S.yuzde(fark, 1)));
});
t.gecsin("girişteki artış", "2020'den 2024'e %" + Math.round((ort[2024] / ort[2020] - 1) * 100) + " arttı");
var zirve = Object.keys(ort).reduce(function (a, b) { return ort[a] > ort[b] ? a : b; });
t.dogru("zirve 2024", zirve === "2024", zirve);

/* Sıkışma: ocak neti / net asgari, iki rejimde sabit. */
function kat(y, k) {
  var P = B.parametre(y), d = P.donemler[0];
  return B.hesaplaYil(d.asgariBrut * k, y).aylar[0].net / d.asgariNet;
}
[[2, "2 kat"], [3, "3 kat"], [5, "5 kat"]].forEach(function (k) {
  var eski = [2020, 2021].map(function (y) { return kat(y, k[0]); });
  var yeni = [2022, 2023, 2024, 2025, 2026].map(function (y) { return kat(y, k[0]); });
  var hep = function (a) { return a.every(function (v) { return Math.abs(v - a[0]) < 0.0005; }); };
  t.dogru(k[1] + " eski rejimde sabit", hep(eski), eski.join(","));
  t.dogru(k[1] + " yeni rejimde sabit", hep(yeni), yeni.join(","));
  t.gecsin(k[1] + " satırı", k[1] + " " + eski[0].toFixed(3).replace(".", ",") + " " + yeni[0].toFixed(3).replace(".", ","));
});
t.gecsin("metindeki 3 kat", "2," + kat(2020, 3).toFixed(2).slice(2) + " değil 2," + kat(2022, 3).toFixed(2).slice(2) + " katını");

t.bitir();
