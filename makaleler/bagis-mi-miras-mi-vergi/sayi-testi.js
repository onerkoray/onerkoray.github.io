#!/usr/bin/env node
/*
 * "Evi çocuğa bağışlamak mı, miras bırakmak mı?" yazısının sayıları.
 * Hepsi finans/veraset.js'ten, 2026 tutarlarıyla (yıla çivili).
 *
 * Kullanım: node makaleler/bagis-mi-miras-mi-vergi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var V = require(path.join(S.KOK, "finans", "veraset.js"));
var t = S.yazi(__dirname);

var YIL = 2026, P = V.parametre(YIL);
function bagis(v) { return V.bagis({ yil: YIL, deger: v, yakin: true }).vergi; }
function miras(v, c) { return V.miras({ yil: YIL, tereke: v, aile: { es: false, cocuk: c } }).toplamVergi; }
function oran(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }

/* Kurallar tablosu. */
t.gecsin("istisna satırı", "İstisna (çocuk başına) " + S.tam(P.istisna.furugVeEs) + " TL " + S.tam(P.istisna.ivazsiz) + " TL");
P.dilimler.forEach(function (d, i) {
  t.gecsin("dilim " + (i + 1), oran(d[1]) + " " + oran(d[2] * P.yakinIndirimi));
});

/* Karşılaştırma tablosu. */
var DEGERLER = [1e6, 2e6, 3e6, 5e6, 10e6, 20e6];
DEGERLER.forEach(function (v) {
  t.gecsin("satır " + v, S.tam(v) + " TL " + S.tl(bagis(v)) + " TL " + S.tl(2 * bagis(v / 2)) + " TL " +
    S.tl(miras(v, 1)) + " TL " + S.tl(miras(v, 2)) + " TL");
  t.dogru("bölünmüş bağış daha düşük " + v, 2 * bagis(v / 2) <= bagis(v));
  t.dogru("miras bağıştan ucuz " + v, miras(v, 1) < bagis(v));
});

/* Katlar. */
[[3e6, "158 katı"], [5e6, "14 katı"], [10e6, "4,4 katı"], [20e6, "2,8 katı"]].forEach(function (k) {
  var o = bagis(k[0]) / miras(k[0], 1);
  var yazi = o >= 10 ? Math.round(o) + " katı" : o.toFixed(1).replace(".", ",") + " katı";
  t.dogru("kat " + k[0], yazi === k[1], yazi);
});
t.gecsin("girişteki bağış", "bağışla geçerse " + S.tam(bagis(3e6)) + " TL");
t.gecsin("girişteki miras", "mirasla geçerse " + S.tam(miras(3e6, 1)) + " TL");
t.gecsin("kısa cevap aralığı", S.tam(bagis(1e6)) + " ile " + S.tam(bagis(2e6)) + " TL");
t.bitir();
