#!/usr/bin/env node
/*
 * "Vergi borcunu geciktirmek kârlı mı?" yazısının sayıları.
 * Gecikme zammı finans/gecikme-zammi.js'ten (GİB tablosu), enflasyon
 * finans/tufe-endeksi.js'ten. Vadeler 2019–2025, ödemeler 2020–2026 Mart;
 * hepsi geçmiş aylar, yeni veri testi etkilemez.
 *
 * Kullanım: node makaleler/vergi-borcunu-geciktirmek-karli-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var G = require(path.join(S.KOK, "finans", "gecikme-zammi.js"));
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var t = S.yazi(__dirname);

function isaret(n) { return (n >= 0 ? "+" : "−") + S.tl(Math.abs(n)); }
var reeller = {};
for (var y = 2019; y <= 2025; y++) {
  var r = G.hesapla({ tutar: 100000, vade: y + "-03-31", odeme: (y + 1) + "-03-31" });
  var c = E.carpan(y + "-03", (y + 1) + "-03");
  var reel = (100000 + r.zam) / c - 100000;
  reeller[y] = reel;
  t.gecsin("satır " + y, "31.03." + y + " " + S.tl(r.zam) + " TL %" + S.yuzde(c - 1) + " " + isaret(reel) + " TL");
}
t.dogru("2021–2023 reel kazanç", reeller[2021] < 0 && reeller[2022] < 0 && reeller[2023] < 0);
t.dogru("2019, 2020, 2024, 2025 reel bedel", reeller[2019] > 0 && reeller[2020] > 0 && reeller[2024] > 0 && reeller[2025] > 0);
t.gecsin("girişteki 2021", "19.200 TL zam ödedi");
t.gecsin("girişteki erime", "borcunun " + S.tam(-reeller[2021]) + " TL'sini eritmiş");
t.gecsin("SSS 2021", "reel olarak " + S.tam(-reeller[2021]) + " TL eridi");

var son = G.ORANLAR[G.ORANLAR.length - 1].oran;
function bir(o) { return String(Math.round(o * 1000) / 10).replace(".", ","); }
t.gecsin("güncel oran", "aylık %" + bir(son) + ", yani yılda basit %" + bir(son * 12));
var tufe = E.donem("2025-08", "2026-08").toplam;
t.gecsin("yıllık enflasyon", "enflasyon %" + bir(tufe));
t.gecsin("bugünkü reel bedel", "yaklaşık " + S.tam(Math.round(((1 + son * 12) / (1 + tufe) - 1) * 100000 / 100) * 100) + " TL reel bedel");
t.gecsin("%1,6 dönemi", "aylık %1,6'da kaldı: yılda basit %19,2");
t.bitir();
