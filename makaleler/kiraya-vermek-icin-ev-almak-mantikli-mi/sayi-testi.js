#!/usr/bin/env node
/*
 * "Kiraya vermek için ev almak mantıklı mı?" yazısının sayıları.
 * finans/kira-getirisi.js'ten (vergi kira geliri motoru, 2026).
 *
 * Kullanım: node makaleler/kiraya-vermek-icin-ev-almak-mantikli-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var K = require(path.join(S.KOK, "finans", "kira-getirisi.js"));
var t = S.yazi(__dirname);

function h(bg, m) {
  return K.hesapla({ fiyat: 5e6, alimMasraf: 0.02, aylikKira: 5e6 * bg / 12, yillikGider: 15000, kiraArtis: 0.25, degerArtis: 0.25, mevduatFaiz: m, sure: 10 });
}
function yz(o) { return S.yuzde(o).replace(/,?0+$/, "").replace(/,$/, ""); }
var BG = [[0.03, "%3"], [0.04, "%4"], [0.048, "%4,8"], [0.06, "%6"]];
BG.forEach(function (b) {
  t.gecsin("eşik satırı " + b[1], b[1] + " " + [30, 37, 45].map(function (m) { return "%" + S.yuzde(h(b[0], m).basabasDegerArtis); }).join(" "));
  var x = h(b[0], 37);
  t.gecsin("net satırı " + b[1], b[1] + " %" + S.yuzde(x.netGetiri) + " " + x.amortisman.toFixed(1).replace(".", ",") + " yıl");
});
var ana = h(0.048, 37);
t.gecsin("giriş", "brüt %4,8; gider ve vergiden sonra %" + S.yuzde(ana.netGetiri));
t.gecsin("mevduat", "%" + S.yuzde(ana.mevduatNet) + " kazanıyor");
t.gecsin("başabaş", "yılda en az %" + S.yuzde(ana.basabasDegerArtis, 1) + " değer kazanması");
var dus = h(0.03, 37).basabasDegerArtis - h(0.06, 37).basabasDegerArtis;
t.gecsin("getiri etkisi", "yalnız " + S.yuzde(dus, 1) + " puan düşürüyor");
t.gecsin("SSS getiri", "yalnız " + S.yuzde(dus, 1) + " puan değişiyor");
t.dogru("faiz 8 puan eşiği 7 puandan fazla oynatır", h(0.048, 45).basabasDegerArtis - h(0.048, 37).basabasDegerArtis > 0.07);
t.gecsin("vergi", "2026'da " + S.tam(ana.ilkYil.vergi) + " TL");
t.bitir();
