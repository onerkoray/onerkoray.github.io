#!/usr/bin/env node
/*
 * "Kredi vadesini uzatmanın bedeli" yazısının sayıları.
 * Tutarlar finans/kredi-limiti.js'ten; taksit ve vergi kredi aracından.
 *
 * Kullanım: node makaleler/kredi-vadesini-uzatmanin-bedeli/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var L = require(path.join(S.KOK, "finans", "kredi-limiti.js"));
var KH = require(path.join(S.KOK, "kredi-hesaplama", "hesap.js"));
var t = S.yazi(__dirname);

var T = 20000;
function h(n, faiz, tur) { return L.hesapla({ taksit: T, aylikFaiz: faiz, vade: n, tur: tur }); }
var ti = KH.turBilgi("ihtiyac"), ri = KH.brutOran(3.99, ti.kkdf, ti.bsmv), tavan = T / ri;
var tutar = {};
[12, 24, 36, 48, 60, 120].forEach(function (n) {
  var x = h(n, 3.99, "ihtiyac"); tutar[n] = x.anapara;
  t.gecsin("satır " + n, n + " ay " + S.tam(x.anapara) + " TL " + S.tl(x.plan.toplamGeriOdeme) + " TL " +
    S.tl(x.plan.toplamGeriOdeme - x.anapara) + " TL %" + S.yuzde(x.anapara / tavan));
});
t.gecsin("tavan", "tutar " + S.tam(tavan) + " TL'yi geçemez");
t.gecsin("aylık maliyet", "aylık maliyet %" + S.yuzde(ri, 3) + ", tavan " + S.tam(tavan) + " TL");
t.gecsin("36 ve 60 oranı", "36 ay bu tavanın %" + S.yuzde(tutar[36] / tavan, 1) + "'ine, 60 ay %" + S.yuzde(tutar[60] / tavan, 1) + "'sine");
t.gecsin("iki yıl uzatma", S.tam(tutar[60] - tutar[36]) + " TL fazla kredi getirir ama " + S.tam(h(60, 3.99, "ihtiyac").plan.toplamGeriOdeme - h(36, 3.99, "ihtiyac").plan.toplamGeriOdeme) + " TL fazla ödetir");
t.gecsin("marjinal", "12 aydan 24 aya " + S.tam(tutar[24] - tutar[12]) + " TL, 24'ten 36'ya " + S.tam(tutar[36] - tutar[24]) + " TL, 36'dan 48'e " +
  S.tam(tutar[48] - tutar[36]) + " TL, 48'den 60'a " + S.tam(tutar[60] - tutar[48]) + " TL");
/* Paylaşım metni: "her ek yıl bir öncekinin kabaca yarısı kadar". Oran
   her adımda %50–%60 aralığında (yaklaşık %54,5) ve azalan getiri kesin. */
var adimlar = [12, 24, 36, 48, 60].map(function (n) { return tutar[n]; });
var artislar = adimlar.slice(1).map(function (x, i) { return x - adimlar[i]; });
t.dogru("her ek yıl daha az kredi getirir", artislar.every(function (x, i) { return i === 0 || x < artislar[i - 1]; }));
t.dogru("her ek yıl öncekinin kabaca yarısı (%50–%60)", artislar.slice(1).every(function (x, i) { var o = x / artislar[i]; return o > 0.5 && o < 0.6; }),
  artislar.slice(1).map(function (x, i) { return (x / artislar[i]).toFixed(3); }).join(" "));
var tk = KH.turBilgi("konut"), rk = KH.brutOran(2.99, tk.kkdf, tk.bsmv);
var k = {}; [60, 120, 240].forEach(function (n) { k[n] = h(n, 2.99, "konut").anapara; });
t.gecsin("konut tavan", "tavanı " + S.tam(T / rk) + " TL");
t.gecsin("konut vadeler", "60 ay " + S.tam(k[60]) + " TL, 120 ay " + S.tam(k[120]) + " TL, 240 ay " + S.tam(k[240]) + " TL");
t.gecsin("konut 120→240", S.tam(k[240] - k[120]) + " TL fazla kredi için " + S.tam(120 * T) + " TL fazla");
t.bitir();
