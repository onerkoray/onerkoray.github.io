#!/usr/bin/env node
/*
 * "SGK prim indirimi 2 puana indi" yazısının sayıları.
 * bordro/motor.js'ten; işveren payı ve indirim yıla ve aya göre parametrelerden.
 *
 * Kullanım: node makaleler/sgk-prim-indirimi-2-puan/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var t = S.yazi(__dirname);

function net(y, ay, tur) { var o = B.oranlarAy(B.parametre(y), ay); return o.sgkIsveren - B.tesvikOrani(o, { tesvik: tur }); }
[["Ocak 2025", 2025, 1], ["Şubat–Aralık 2025", 2025, 2], ["2026", 2026, 1]].forEach(function (d) {
  t.gecsin("oran " + d[0], d[0] + " %" + S.yuzde(net(d[1], d[2], "genel")) + " %" + S.yuzde(net(d[1], d[2], "imalat")));
});
function mal(b, tur) { return B.hesaplaYil(b, 2026, tur ? { tesvik: tur } : {}).aylar[0].isverenMaliyeti; }
function yil(b, tur) { return B.hesaplaYil(b, 2026, { tesvik: tur }).toplam.isverenMaliyeti; }
[[33030, "33.030 TL (asgari)"], [50000, "50.000 TL"], [100000, "100.000 TL"], [297270, "297.270 TL (tavan)"]].forEach(function (k) {
  t.gecsin("maliyet " + k[0], k[1] + " " + S.tl(mal(k[0])) + " TL " + S.tl(mal(k[0], "genel")) + " TL " + S.tl(mal(k[0], "imalat")) + " TL " + S.tl(yil(k[0], "genel") - yil(k[0], "imalat")) + " TL");
});
var fark = net(2026, 1, "genel") - net(2025, 2, "genel");
t.dogru("imalat dışında 3 puan", Math.abs(fark - 0.03) < 1e-12);
t.dogru("imalatta 1 puan", Math.abs(net(2026, 1, "imalat") - net(2025, 2, "imalat") - 0.01) < 1e-12);
t.gecsin("giriş oranları", "2025 Şubat'ta %" + S.yuzde(net(2025, 2, "genel")) + "'ti, 2026'da %" + S.yuzde(net(2026, 1, "genel")));
t.gecsin("yıllık ek yük", "yıllık ek yük " + S.tl(33030 * fark * 12) + " TL");
t.gecsin("aylık", "Asgari ücretli için ayda " + S.tl(33030 * fark) + " TL");
t.dogru("imalat dışı-imalat farkı = 2025'e göre ek yük", Math.abs((yil(33030, "genel") - yil(33030, "imalat")) - 33030 * fark * 12) < 0.01);
t.bitir();
