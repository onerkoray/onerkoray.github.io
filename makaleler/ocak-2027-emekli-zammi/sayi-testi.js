#!/usr/bin/env node
/*
 * "Ocak 2027 emekli zammı ne kadar olacak?" yazısının sayıları.
 * Birikim ve senaryolar modülden bağımsız olarak doğrudan TÜFE serisinden
 * yeniden kurulur (bileşik oran, 5510 m.55) ve sayfada aranır. Bloğu
 * tools/ocak-zam-yazisi.js yazar.
 *
 * Kullanım: node makaleler/ocak-2027-emekli-zammi/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var O = require("./ocak.js");
var T = require("../../finans/tufe-serisi.js");
var t = S.yazi(__dirname);

function y2(v) { return "%" + (Math.round(v * 10000) / 100).toFixed(2).replace(".", ","); }
function ay(y, a) { var v = T.aylar[y + "-" + (a < 10 ? "0" : "") + a]; return v ? v.aylik / 100 : null; }
function bilesik(o) { return o.reduce(function (k, x) { return k * (1 + x); }, 1) - 1; }

/* Temmuz–Aralık 2026: açıklanan aylar seriden. */
var bilinen = [7, 8, 9, 10, 11, 12].map(function (a) { return ay(2026, a); }).filter(function (x) { return x != null; });
var kesin = bilesik(bilinen);
t.yakin("modül birikimi seriyle aynı", O.donem().birikim, kesin, 1e-12);
t.gecsin("kesin birikim", "birikim " + y2(kesin));
bilinen.forEach(function (o) { t.gecsin("açıklanan ay " + y2(o), y2(o)); });

/* İlk yarı: Ocak–Haziran 2026 (Temmuz 2026 zammı). */
var ilk = bilesik([1, 2, 3, 4, 5, 6].map(function (a) { return ay(2026, a); }));
t.yakin("ilk yarı modülle aynı", O.ilkYari(), ilk, 1e-12);

/* Senaryolar bağımsız kurulur. */
var kalan = 6 - bilinen.length;
var hiz = Math.pow(1 + kesin, 1 / bilinen.length) - 1;
var gecen = [7, 8, 9, 10, 11, 12].slice(bilinen.length).map(function (a) { return ay(2025, a); });
var beklenen = [
  (1 + kesin) * Math.pow(1 + hiz, kalan) - 1,
  (1 + kesin) * (1 + bilesik(gecen)) - 1,
  (1 + 0.284) / (1 + ilk) - 1
];
var sen = O.senaryolar();
beklenen.forEach(function (b, i) {
  t.yakin(sen[i].ad + " modülle aynı", sen[i].emekli, b, 1e-12);
  t.gecsin(sen[i].ad + " sayfada", y2(b));
});
t.gecsin("aralık kısa cevapta", y2(Math.min.apply(null, beklenen)) + " ile " + y2(Math.max.apply(null, beklenen)));
O.DUYARLILIK.forEach(function (m) { t.gecsin("duyarlılık " + m, y2((1 + kesin) * Math.pow(1 + m, kalan) - 1)); });

/* Örnek aylık: ilan oranı iki ondalık, kuruşa yuvarlanır. */
var ilan = Math.round(beklenen[1] * 10000) / 10000;
t.gecsin("30.000 TL aylık, geçen yıl senaryosu", Math.round(Math.round(30000 * (1 + ilan) * 100) / 100).toLocaleString("tr-TR") + " TL");

t.bitir("Ocak 2027 emekli zammı");
