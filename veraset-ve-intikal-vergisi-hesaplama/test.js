#!/usr/bin/env node
/*
 * Veraset ve intikal vergisi hesaplama — sayfadaki sabit sayılar.
 * Tarife tablosu, istisnalar, SSS örnekleri finans/veraset.js'ten.
 *
 * Kullanım: node veraset-ve-intikal-vergisi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var V = require(path.join(S.KOK, "finans", "veraset.js"));
var t = S.yazi(__dirname);

var P = V.parametre(2026);
function oran(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }

/* Tarife tablosu. */
var bas = 0;
P.dilimler.forEach(function (d, i) {
  var etiket = i === 0 ? "İlk " + S.tam(d[0]) + " TL"
    : d[0] === null ? S.tam(bas) + " TL'yi aşan"
    : "Sonraki " + S.tam(d[0]) + " TL";
  t.gecsin("tarife satırı " + (i + 1), etiket + " " + oran(d[1]) + " " + oran(d[2]) + " " + oran(d[2] * P.yakinIndirimi));
  if (d[0] !== null) bas += d[0];
});

/* İstisnalar. */
t.gecsin("çocuk ve eş istisnası", S.tam(P.istisna.furugVeEs) + " TL");
t.gecsin("çocuksuz eş", S.tam(P.istisna.esFurugYoksa) + " TL");
t.gecsin("bağış istisnası", S.tam(P.istisna.ivazsiz) + " TL");

/* SSS örnekleri. */
t.gecsin("eş + iki çocuk vergisiz sınır", "net tereke " + S.tam(Math.ceil(V.vergisizSinir({ es: true, cocuk: 2 }))) + " TL'yi aşınca");
var b = V.bagis({ deger: 3e6, yakin: true });
var m = V.miras({ tereke: 3e6, aile: { es: false, cocuk: 1 } });
t.gecsin("bağış örneği", "çocuğa bağışlanırsa vergi " + S.tl(b.vergi) + " TL");
t.gecsin("miras örneği", "miras kalsaydı vergi " + S.tl(m.toplamVergi) + " TL");
t.dogru("altı taksit", P.taksit === 6);
t.bitir();
