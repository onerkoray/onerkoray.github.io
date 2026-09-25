#!/usr/bin/env node
/*
 * "2027 vergi dilimleri ve asgari ücret" yazısının sayıları.
 * bordro/asgari-senaryo.js'ten; baz yıl 2026'ya çivili (2027 parametreleri
 * girilince bu test kırılır ve yazının sonuç yazısına dönmesi gerekir).
 *
 * Kullanım: node makaleler/vergi-dilimleri-2027-asgari-ucret/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var A = require(path.join(S.KOK, "bordro", "asgari-senaryo.js"));
var B = S.bordro();
var t = S.yazi(__dirname);

t.dogru("baz yıl 2026", A.bazYil() === 2026, String(A.bazYil()));
[[33030, "33.030 TL (asgari)"], [60000, "60.000 TL"], [100000, "100.000 TL"], [200000, "200.000 TL"]].forEach(function (k) {
  var h = [0.25, 0.20, 0.15, 0.10].map(function (ta) { return S.tl(A.hesapla({ asgariArtis: 0.25, tarifeArtis: ta, brut: k[0] }).ucret.endeksFarki) + " TL"; });
  t.gecsin("satır " + k[0], k[1] + " " + h.join(" "));
});
var P = B.parametre(2026), D = P.dilimler;
var ik = D[1][0] * 0.10 * (D[2][1] - D[1][1]), uc = D[2][0] * 0.10 * (D[3][1] - D[2][1]);
t.gecsin("ikinci eşik kuralı", S.tam(D[1][0]) + " × 0,10 × (%" + Math.round(D[2][1] * 100) + " − %" + Math.round(D[1][1] * 100) + ") = " + S.tam(ik) + " TL");
t.gecsin("üçüncü eşik kuralı", S.tam(D[2][0]) + " × 0,10 × (%" + Math.round(D[3][1] * 100) + " − %" + Math.round(D[2][1] * 100) + ") = " + S.tam(uc) + " TL daha, toplam " + S.tam(ik + uc) + " TL");
t.gecsin("giriş", "yılda " + S.tam(ik) + " TL fazla vergi öder; üçüncü eşiği de aşan " + S.tam(ik + uc) + " TL");
t.gecsin("eşikler", "ikinci eşik " + S.tam(D[1][0]) + " TL (%20 → %27), üçüncü " + S.tam(D[2][0]) + " TL (%27 → %35)");
var o = P.oranlar, esik = D[1][0] * 1.25 / 12 / (1 - o.sgkIsci - o.issizlikIsci);
t.gecsin("etkilenme sınırı", "aylık brüt yaklaşık " + S.tam(Math.round(esik / 10) * 10) + " TL");
t.bitir();
