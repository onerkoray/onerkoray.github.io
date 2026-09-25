#!/usr/bin/env node
/*
 * "Askerlik borçlanması 2026" yazısının sayıları.
 * bordro/sgk-prim.js'ten; oranlar 2025 ve 2026 sigortalilik bloklarından.
 *
 * Kullanım: node makaleler/askerlik-borclanmasi-2026/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var P = require(path.join(S.KOK, "bordro", "sgk-prim.js"));
var t = S.yazi(__dirname);

var s25 = P.sinirlar(2025), s26 = P.sinirlar(2026);
function b(n, k, tur, y) { return P.borclanma(n, k, tur, y); }
[180, 360, 540, 720].forEach(function (n) {
  t.gecsin("satır " + n, n + " gün " + S.tl(b(n, s25.gunlukAlt, "genel", 2025).toplam) + " TL " + S.tl(b(n, s26.gunlukAlt, "genel", 2026).toplam) + " TL " +
    S.tl(b(n, s26.gunlukUst, "genel", 2026).toplam) + " TL");
});
var g25 = b(1, s25.gunlukAlt, "genel", 2025).gunluk, g26 = b(1, s26.gunlukAlt, "genel", 2026).gunluk, d26 = b(1, s26.gunlukAlt, "dogum", 2026).gunluk;
t.gecsin("giriş günlük", "2026'da " + S.tl(g26) + " TL; 2025'te " + S.tl(g25) + " TL'ydi");
t.gecsin("artış", "Artış %" + S.yuzde(g26 / g25 - 1, 1));
t.gecsin("540 gün", "540 günlük askerlik en az " + S.tam(b(540, s26.gunlukAlt, "genel", 2026).toplam) + " TL");
var asg = s26.aylikAlt / s25.aylikAlt, oran = 0.45 / 0.32;
t.gecsin("çarpanlar", "asgari ücret " + asg.toFixed(4).replace(".", ",") + " kat, oran " + oran.toFixed(4).replace(".", ",") + " kat. Çarpımları " + (asg * oran).toFixed(4).replace(".", ","));
t.dogru("çarpım günlük artışla aynı", Math.abs(asg * oran - g26 / g25) < 1e-4);
t.gecsin("doğum 720", "2025'te " + S.tl(b(720, s25.gunlukAlt, "dogum", 2025).toplam) + " TL, 2026'da " + S.tl(b(720, s26.gunlukAlt, "dogum", 2026).toplam) + " TL");
t.gecsin("fark", "2026'da " + S.tl(b(720, s26.gunlukAlt, "genel", 2026).toplam - b(720, s26.gunlukAlt, "dogum", 2026).toplam) + " TL");
t.gecsin("doğum günlük", "günü en az " + S.tl(d26) + " TL");
t.gecsin("en yüksek günlük", "günü " + S.tl(b(1, s26.gunlukUst, "genel", 2026).gunluk) + " TL");
t.gecsin("alt ve üst sınır", "(2026'da " + S.tam(s26.gunlukAlt) + " TL), en çok tavanın otuzda biri (" + S.tam(s26.gunlukUst) + " TL)");
t.bitir();
