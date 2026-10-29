#!/usr/bin/env node
/*
 * "Ocak 2027 memur zammı ne kadar olacak?" yazısının sayıları.
 * Toplu sözleşme oranı finans/toplu-sozlesme.js'ten, altı aylık enflasyon
 * TÜFE serisinden okunur; fark ve zam formülü motordan bağımsız olarak
 * yeniden kurulur ve sayfada aranır. Önce formül açıklanmış iki memur
 * zammını (Ocak 2025 %11,54, Temmuz 2025 %15,57) veriyor mu, ona bakılır.
 * Bloğu tools/ocak-zam-yazisi.js yazar.
 *
 * Kullanım: node makaleler/ocak-2027-memur-zammi/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var O = require("../ocak-2027-emekli-zammi/ocak.js");
var T = require("../../finans/tufe-serisi.js");
var TS = require("../../finans/toplu-sozlesme.js").oranlar;
var t = S.yazi(__dirname);

function y2(v) { return "%" + (Math.round(v * 10000) / 100).toFixed(2).replace(".", ","); }
function ay(y, a) { var v = T.aylar[y + "-" + (a < 10 ? "0" : "") + a]; return v ? v.aylik / 100 : null; }
function bilesik(o) { return o.reduce(function (k, x) { return k * (1 + x); }, 1) - 1; }
function zam(birikim, onceki, yeni) {
  var fark = Math.max(0, Math.round(((1 + birikim) / (1 + onceki) - 1) * 10000) / 10000);
  return { fark: fark, zam: (1 + fark) * (1 + yeni) - 1 };
}

/* Formül geçmişte açıklanan iki zammı veriyor mu? */
var o25 = zam(bilesik([7, 8, 9, 10, 11, 12].map(function (a) { return ay(2024, a); })), TS["2024-2"], TS["2025-1"]).zam;
var t25 = zam(bilesik([1, 2, 3, 4, 5, 6].map(function (a) { return ay(2025, a); })), TS["2025-1"], TS["2025-2"]).zam;
t.dogru("Ocak 2025 memur zammı %11,54", y2(o25) === "%11,54", y2(o25));
t.dogru("Temmuz 2025 memur zammı %15,57", y2(t25) === "%15,57", y2(t25));

var bilinen = [7, 8, 9, 10, 11, 12].map(function (a) { return ay(2026, a); }).filter(function (x) { return x != null; });
var kesin = bilesik(bilinen);
var onceki = TS["2026-2"], yeni = TS["2027-1"];
t.gecsin("toplu sözleşme Ocak oranı", "toplu sözleşmedeki " + y2(yeni));
t.gecsin("toplu sözleşme önceki yarı", y2(onceki) + "'yi aşan");

var esik = (1 + onceki) / (1 + kesin) - 1;
t.yakin("fark eşiği modülle aynı", O.farkEsigi(), esik, 1e-12);
t.gecsin("fark eşiği", "toplam " + y2(esik) + " artış");

var sen = O.senaryolar();
sen.forEach(function (s) {
  var z = zam(s.emekli, onceki, yeni);
  t.yakin(s.ad + " fark modülle aynı", s.fark, z.fark, 1e-12);
  t.dogru(s.ad + " zam modülle aynı (ilan biçimi)", y2(s.memur) === y2(z.zam), y2(s.memur) + " / " + y2(z.zam));
  t.gecsin(s.ad + " memur zammı sayfada", y2(z.zam));
  t.gecsin(s.ad + " fark sayfada", y2(z.fark));
  t.dogru(s.ad + ": memur emekliden geride", s.emekli - z.zam > 0.015 && s.emekli - z.zam < 0.025, s.emekli - z.zam);
});
var carpan = (1 + yeni) / (1 + onceki);
t.gecsin("çarpan", carpan.toFixed(4).replace(".", ","));

t.bitir("Ocak 2027 memur zammı");
