#!/usr/bin/env node
/*
 * Asgari ücret zammı senaryosu — sayfadaki kural ve SSS örnekleri.
 * Senaryo girdileri sabit; baz yıl 2026'ya çivili (2027 parametreleri
 * girildiğinde bu test kırılır ve sayfanın 2028'e çevrilmesi gerekir).
 *
 * Kullanım: node asgari-ucret-zam-senaryosu/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var A = require(path.join(S.KOK, "bordro", "asgari-senaryo.js"));
var t = S.yazi(__dirname);

t.dogru("baz yıl 2026", A.bazYil() === 2026, String(A.bazYil()));
var r = A.hesapla({ asgariArtis: 0.25, tarifeArtis: 0.15, brut: 60000 });
var E = A.hesapla({ asgariArtis: 0, tarifeArtis: 0 });
t.gecsin("brüt asgari", S.tam(E.asgari.eski.brut) + " TL'den " + S.tl(r.asgari.yeni.brut) + " TL'ye");
t.gecsin("net asgari", "net " + S.tl(r.asgari.yeni.net) + " TL olur");
t.gecsin("tavan", "SGK tavanı " + S.tl(r.asgari.yeni.tavan) + " TL'ye");
t.gecsin("zamlı brüt", "%25 artıp " + S.tam(r.ucret.yeniBrut) + " TL olursa");
t.gecsin("yıllık net", "yıllık net " + S.tl(r.ucret.eski.toplam.net) + " TL'den " + S.tl(r.ucret.yeni.toplam.net) + " TL'ye");
t.gecsin("net artış", "%" + S.yuzde(r.ucret.netArtis) + " artış");
t.gecsin("endeks farkı", "yıllık net " + S.tl(r.ucret.endeksFarki) + " TL daha yüksek");

/* Kural satırı: ikinci eşik ve oranlar parametreden */
var D = E.dilimler.eski;
t.gecsin("kayma kuralı", "kayıp = " + S.tam(D[1][0]) + " TL × (asgari ücret zammı − dilim artışı) × (%" +
  Math.round(D[2][1] * 100) + " − %" + Math.round(D[1][1] * 100) + ")");
t.dogru("kural örnekle tutarlı", Math.abs(r.ucret.endeksFarki - D[1][0] * 0.10 * (D[2][1] - D[1][1])) < 0.01);
t.gecsin("tavan katsayısı", "brüt asgari ücretin\n          9 katı".replace(/\s+/g, " "));
t.dogru("tavan katsayısı parametreden", require(path.join(S.KOK, "bordro", "motor.js")).parametre(2026).tavanKatsayisi === 9);
t.gecsin("net oranı", "net, brütün %85'idir");
t.bitir();
