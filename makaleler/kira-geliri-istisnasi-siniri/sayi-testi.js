#!/usr/bin/env node
/*
 * "Kira geliri istisnası sınırı" yazısının sayıları.
 * bordro/gmsi-motor.js'ten (2026). Sınır tarifenin üçüncü dilim tutarı;
 * istisna ve götürü gider oranı parametrelerden.
 *
 * Kullanım: node makaleler/kira-geliri-istisnasi-siniri/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var G = require(path.join(S.KOK, "bordro", "gmsi-motor.js"));
var B = S.bordro();
var t = S.yazi(__dirname);

var P = B.parametre(2026), UST = P.dilimler[2][0];
function vergi(kira, diger) { var r = G.hesapla({ yil: 2026, konutKira: kira, brutGelirToplami: diger }); return Math.min(r.goturu.kiraVergisi, r.gercek.kiraVergisi); }
var sicrama = {};
[120000, 240000, 360000, 600000].forEach(function (k) {
  var esik = UST - k, alt = vergi(k, esik), ust = vergi(k, esik + 1);
  sicrama[k] = ust - alt;
  t.gecsin("satır " + k, S.tam(k) + " TL " + S.tam(esik) + " TL " + S.tam(esik / 12) + " TL " + S.tl(alt) + " TL " + S.tl(ust) + " TL " + S.tl(ust - alt) + " TL");
  t.dogru("sınırın 1 TL altında istisna var " + k, G.hesapla({ yil: 2026, konutKira: k, brutGelirToplami: esik }).istisna === P.gmsi.meskenIstisnasi);
  t.dogru("sınırın 1 TL üstünde istisna yok " + k, G.hesapla({ yil: 2026, konutKira: k, brutGelirToplami: esik + 1 }).istisna === 0);
});
t.gecsin("başlık", "1 lira fazla gelir, " + S.tam(sicrama[240000]) + " TL fazla vergi");
t.gecsin("giriş", "1.500.000 TL'yi 1 lira aştığında " + S.tam(P.gmsi.meskenIstisnasi) + " TL'lik istisnayı");
t.gecsin("giriş vergi", "kira vergisi " + S.tam(vergi(240000, UST - 240000)) + " TL'den " + S.tam(vergi(240000, UST - 240000 + 1)) + " TL'ye çıkar");
t.gecsin("giriş maaş", "aylık brüt maaş " + S.tam((UST - 240000) / 12) + " TL");
t.gecsin("sınır", "(2026'da " + S.tam(UST) + " TL)");
t.gecsin("600 bin", "aylık brüt maaşı " + S.tam((UST - 600000) / 12) + " TL'yi aştığında");
t.gecsin("SSS sıçrama", "vergi " + S.tam(vergi(240000, UST - 240000)) + " TL'den " + S.tam(vergi(240000, UST - 240000 + 1)) + " TL'ye çıkar: " + S.tam(sicrama[240000]) + " TL fazla");
t.bitir();
