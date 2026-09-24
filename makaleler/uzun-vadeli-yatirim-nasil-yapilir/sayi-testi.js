#!/usr/bin/env node
/*
 * "Uzun vadeli yatırım nasıl yapılır?" yazısının sayıları.
 *
 *  - Reel getiri tablosu: çıkarma (yanlış) ile Fisher (doğru) karşılaştırması.
 *  - Stopajın reel getiriye etkisi.
 *  - Aylık ↔ yıllık oran dönüşümü.
 *  - BES oranları: devlet katkısı, çıkış stopajları, emeklilik şartı ve
 *    örnekteki mevduat stopajı BES çekirdeğinin varsayılanlarından
 *    (birikim-hesaplama/hesap.js → VARSAYILAN). Yazı "BES ve Birikim
 *    Hesaplama"ya yönlendiriyor; ikisi farklı oran söyleyemez.
 *
 * Kullanım: node makaleler/uzun-vadeli-yatirim-nasil-yapilir/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var BES = require(path.join(S.KOK, "birikim-hesaplama", "hesap.js"));
var V = BES.VARSAYILAN;
var t = S.yazi(__dirname);

function y(o, b) {
  var s = (Math.abs(o) * 100).toFixed(b == null ? 2 : b).replace(".", ",");
  return (o < -1e-12 ? "−" : "") + "%" + s;
}

/* Fisher tablosu. */
var ENF = 0.40;
[0.45, 0.50, 0.60, 0.40, 0.35].forEach(function (n) {
  t.gecsin("satır %" + Math.round(n * 100), "%" + Math.round(n * 100) + " %" + Math.round(ENF * 100) + " " +
    y(n - ENF) + " " + y((1 + n) / (1 + ENF) - 1));
});
t.gecsin("formül örneği", "(1,45 ÷ 1,40) − 1 = " + y(1.45 / 1.40 - 1));

/* Stopajın etkisi, BES çekirdeğinin mevduat stopajıyla. */
var st = V.mevduatStopajYuzde / 100, brut = 0.45;
var net = brut * (1 - st), reel = (1 + net) / (1 + ENF) - 1;
t.gecsin("stopaj oranı", "%" + V.mevduatStopajYuzde + " stopajlı bir mevduat");
t.gecsin("stopaj tutarı", "Stopaj (%" + V.mevduatStopajYuzde + ", getiri üzerinden) − " + y(brut * st));
t.gecsin("net nominal", "Net nominal getiri " + y(net));
t.gecsin("reel sonuç", "(" + (1 + net).toFixed(4).replace(".", ",") + " ÷ 1,40 − 1) " + y(reel));
t.dogru("vergi öncesi kazandırıyor, sonrası kaybettiriyor", (1 + brut) / (1 + ENF) - 1 > 0 && reel < 0);

/* Aylık ↔ yıllık. */
var aylikBolme = 0.45 / 12, aylikDogru = Math.pow(1.45, 1 / 12) - 1;
t.gecsin("12'ye bölme", "12'ye bölme " + y(aylikBolme) + " verir; doğrusu " + y(aylikDogru));
t.gecsin("bölmenin yıllık karşılığı", "yıllık " + y(Math.pow(1 + aylikBolme, 12) - 1, 1));

/* BES. */
t.gecsin("devlet katkısı", "katkı payının %" + V.devletKatkiYuzde + "'si");
t.gecsin("çıkış stopajları", "10 yıldan önce %" + V.stopaj.erken + ", 10 yıl dolup emekli olmadan %" +
  V.stopaj.onYil + ", emeklilikte %" + V.stopaj.emeklilik);
t.gecsin("emeklilik şartı", V.emeklilikYas + " yaş + " + V.emeklilikYil + " yıl");

t.bitir();
