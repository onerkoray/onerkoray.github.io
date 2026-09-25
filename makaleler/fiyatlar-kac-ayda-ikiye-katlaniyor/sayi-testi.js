#!/usr/bin/env node
/*
 * "Fiyatlar kaç ayda ikiye katlanıyor?" yazısının sayıları.
 *
 * Tablonun her hücresi ve metindeki her süre finans/tufe-endeksi.js'ten
 * yeniden üretilir. Yazı Ağustos 2026'ya çivilidir: TÜİK geçmiş ayları
 * değiştirmez, güncelleme betiği geçmişin değişmesini reddeder; bu yüzden
 * yeni aylar gelince bu test yeşil kalır ve kalmalıdır.
 *
 * Kullanım: node makaleler/fiyatlar-kac-ayda-ikiye-katlaniyor/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var T = require(path.join(S.KOK, "finans", "tufe-serisi.js"));
var t = S.yazi(__dirname);

var SON = "2026-08";
function ima(ay) { return Math.log(2) / Math.log(1 + T.aylar[ay].yillik / 100) * 12; }
function bir(n) { return n.toFixed(1).replace(".", ","); }

/* Tablo: 2013–2025 aralıkları ve Ağustos 2026. */
var satirlar = [];
for (var y = 2013; y <= 2025; y++) satirlar.push(y + "-12");
satirlar.push(SON);
satirlar.forEach(function (ay) {
  var k = E.ikiyeKatlanma(ay);
  t.gecsin("satır " + ay, E.ayAdi(ay) + " " + k + " ay %" + S.yuzde(T.aylar[ay].yillik / 100) + " " + bir(ima(ay)) + " ay");
});

/* İlk tanımlı ay. */
var ilk = E.aylar().filter(function (a) { return E.ikiyeKatlanma(a) !== null; })[0];
t.dogru("ölçü ilk kez Aralık 2013'te tanımlı", ilk === "2013-12", ilk);

/* En kısa ve en uzun, Ağustos 2026'ya kadar. */
var enKisa = [Infinity], enUzun = [-1];
E.aylar().filter(function (a) { return a <= SON; }).forEach(function (a) {
  var k = E.ikiyeKatlanma(a);
  if (k === null) return;
  if (k < enKisa[0]) enKisa = [k, a];
  if (k > enUzun[0]) enUzun = [k, a];
});
t.gecsin("en kısa süre", E.ayAdi(enKisa[1]) + "'te biten dönemde: fiyatlar " + enKisa[0] + " ayda");
t.gecsin("en uzun süre", E.ayAdi(enUzun[1]) + "'da ölçüldü: " + enUzun[0] + " ay");

/* Katlar. */
[[2, 29], [4, 47], [8, 64], [16, 130]].forEach(function (k) {
  t.dogru(k[0] + " kat " + k[1] + " ay", E.ikiyeKatlanma(SON, k[0]) === k[1], E.ikiyeKatlanma(SON, k[0]));
});
t.gecsin("katlar cümlesi", "29 ay önceki fiyatların iki katı, 47 ay önceki fiyatların dört katı, 64 ay önceki fiyatların sekiz katı");
t.gecsin("on altı kat", "130 ay geriye");

/* Kısa cevaptaki iki gecikme örneği. */
t.gecsin("2021 yıllık oran", "yıllık %" + S.yuzde(T.aylar["2021-12"].yillik / 100) + "'lik oran \"fiyatlar " + Math.round(ima("2021-12")) + " ayda");
t.gecsin("2021 gerçek süre", E.ikiyeKatlanma("2021-12") + " ay sürmüştü");
t.gecsin("2024 ima", "oran " + Math.round(ima("2024-12")) + " ay diyordu, gerçek süre " + E.ikiyeKatlanma("2024-12") + " aydı");
t.dogru("yükselişte gerçek süre uzun", E.ikiyeKatlanma("2021-12") > ima("2021-12"));
t.dogru("düşüşte gerçek süre kısa", E.ikiyeKatlanma("2024-12") < ima("2024-12"));

t.bitir();
