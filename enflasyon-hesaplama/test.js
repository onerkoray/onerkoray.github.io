#!/usr/bin/env node
/*
 * Enflasyon hesaplama — sayfadaki sabit örnekler.
 *
 * Örnekler geçmiş iki tarih arasında seçildi: TÜİK geçmiş ayları
 * değiştirmez ve güncelleme betiği geçmişin değişmesini reddeder, bu yüzden
 * bu sayılar yeni veri geldikçe de doğru kalır. Motorun kendisi
 * finans/tufe-endeksi-test.js'te.
 *
 * Kullanım: node enflasyon-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var t = S.yazi(__dirname);

var d20 = E.donem("2020-01", "2026-08");
t.gecsin("2020 → 2026 karşılık", "Ağustos 2026 fiyatlarıyla 9.603,60 TL");
t.yakin("2020 → 2026 çarpanı", 1000 * d20.carpan, 9603.60, 0.005);
t.gecsin("2020 → 2026 yıllık ortalama", "Yıllık ortalama enflasyon %" + S.yuzde(d20.yillik));
t.gecsin("2020 → 2026 alım gücü", "alım gücü kaybı %" + S.yuzde(d20.alimGucuKaybi));
t.gecsin("SSS: 9,6 kat", nf1(d20.carpan) + " kat para");
t.gecsin("2005 → 2026 karşılık", S.tl(1000 * E.carpan("2005-01", "2026-08")) + " TL");

/* En kısa ikiye katlanma: bütün seride ara, sayfadaki iddiayla karşılaştır. */
var enKisa = Infinity, ay = null;
E.aylar().forEach(function (a) { var k = E.ikiyeKatlanma(a); if (k !== null && k < enKisa) { enKisa = k; ay = a; } });
t.gecsin("en kısa ikiye katlanma", E.ayAdi(ay) + "'te biten dönemde");
t.gecsin("en kısa ikiye katlanma süresi", enKisa + " aya");

/* SSS: aylık %3 yılda %42,58. */
t.gecsin("aylık %3 bileşik", "%" + S.yuzde(Math.pow(1.03, 12) - 1));
t.gecsin("aylık %3 toplama", "%" + Math.round(0.03 * 12 * 100) + " değil");

function nf1(n) { return n.toFixed(1).replace(".", ","); }
t.bitir();
