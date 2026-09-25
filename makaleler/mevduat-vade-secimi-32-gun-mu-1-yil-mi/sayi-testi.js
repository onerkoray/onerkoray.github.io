#!/usr/bin/env node
/*
 * "Mevduatta 32 gün mü, 1 yıl mı?" yazısının sayıları.
 * finans/faiz-donustur.js'ten; mevduat neti finans/kurallar.js'ten.
 *
 * Kullanım: node makaleler/mevduat-vade-secimi-32-gun-mu-1-yil-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var Z = require(path.join(S.KOK, "finans", "faiz-donustur.js"));
var t = S.yazi(__dirname);

var BRUT = 0.37;
function st(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }
[32, 92, 181, 182, 365, 366, 730].forEach(function (g) {
  var m = Z.mevduat(BRUT, g);
  t.gecsin("satır " + g, g + " gün " + st(m.stopajOrani) + " %" + S.yuzde(m.yillikNetBasit) + " %" + S.yuzde(m.yillikNetBilesik));
});
var k = Z.mevduat(BRUT, 32).yillikNetBilesik, y = Z.mevduat(BRUT, 365).yillikNetBilesik;
t.gecsin("giriş", "stopaj sonrası %" + S.yuzde(k) + " getirir; bir yıllık vade %" + S.yuzde(y));
t.gecsin("fark", "bir yıllık vadeyi " + S.yuzde(k - y, 1) + " puan geçiyor");
/* Eşitleyen brüt faiz: yenilemeli 32 günle aynı yıllık bileşik getiri */
function esit(gun) {
  var hedefVade = Math.pow(1 + k, gun / 365) - 1, stopaj = Z.mevduat(BRUT, gun).stopajOrani;
  return hedefVade / (gun / 365) / (1 - stopaj);
}
t.gecsin("365 eşit", "brüt faizi %" + S.yuzde(esit(365)) + " olmalı; 366 günlük vadede (stopaj %10) %" + S.yuzde(esit(366)) + ", iki yıllık vadede %" + S.yuzde(esit(730)));
[365, 366, 730].forEach(function (g) {
  t.dogru("eşit faizle getiri eşit " + g, Math.abs(Z.mevduat(esit(g), g).yillikNetBilesik - k) < 1e-9);
});
t.bitir();
