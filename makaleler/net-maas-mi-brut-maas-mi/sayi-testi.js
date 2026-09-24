#!/usr/bin/env node
/*
 * "Net maaşta mı, brüt maaşta mı anlaşmalı?" yazısının sayıları.
 *
 * Yazı 2026 parametreleriyle iki sözleşmeyi karşılaştırıyor: ocakta aynı
 * 60.000 TL neti veren net sözleşme ve sabit brüt sözleşme. Test bütün
 * tabloları ve metindeki özet farkları motordan yeniden üretir.
 *
 * YILA ÇİVİLİ: yazı "2026" diyor. 2027 parametreleri girildiğinde bu
 * sayılar değişmemeli; yeni yıl tablosu bilinçli bir güncellemedir.
 *
 * KURAL: net sözleşmenin yıllık neti SÖZLEŞMEDEKİ tutardır (12 × 60.000).
 * Motor her ayın brütünü kuruşa yuvarladığı için 720.000,01 bulur;
 * yazının kuralı sözleşme tutarını esas almak ve farklar ona göre.
 *
 * 2026-09-24: ara başlık "fark 106 bin lira" diyordu, tablo ve giriş
 * 101.440 lira. Başlık düzeltildi; bayat değer bir daha girmesin diye
 * aşağıda ayrıca denetleniyor.
 *
 * Kullanım: node makaleler/net-maas-mi-brut-maas-mi/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var t = S.yazi(__dirname);

var YIL = 2026, NET = 60000;

var ocakBrut = B.nettenBrute(NET, YIL, 0);
var netBrutler = B.nettenBruteYil(NET, YIL);
var netY = B.hesaplaYil(netBrutler, YIL);
var brutY = B.hesaplaYil(ocakBrut, YIL);

t.gecsin("ocak brütü", S.tl(ocakBrut) + " TL");

[0, 3, 6, 11].forEach(function (i) {
  var ay = B.AY_ADLARI[i];
  t.gecsin(ay + " net sözleşme brütü", S.tl(netBrutler[i]) + " TL");
  t.gecsin(ay + " brüt sözleşme neti", S.tl(brutY.aylar[i].net) + " TL");
  t.gecsin(ay + " işveren maliyeti", S.tl(netY.aylar[i].isverenMaliyeti) + " TL");
  t.yakin(ay + " net sözleşme neti sabit", netY.aylar[i].net, NET, 0.01);
});

var netToplam = NET * 12;
var brutToplamNet = brutY.toplam.net;
var calisanFark = netToplam - brutToplamNet;
var isvNet = netY.toplam.isverenMaliyeti, isvBrut = brutY.toplam.isverenMaliyeti;
var isvFark = isvNet - isvBrut;

t.gecsin("net sözleşme yıllık net", S.tl(netToplam) + " TL");
t.gecsin("brüt sözleşme yıllık net", S.tl(brutToplamNet) + " TL");
t.gecsin("çalışan farkı", S.tl(calisanFark) + " TL");
t.gecsin("işveren yıllık maliyet (net)", S.tl(isvNet) + " TL");
t.gecsin("işveren yıllık maliyet (brüt)", S.tl(isvBrut) + " TL");
t.gecsin("işveren farkı", S.tl(isvFark) + " TL");
t.gecsin("vergiye ve prime giden", S.tl(isvFark - calisanFark) + " TL");

/* Girişteki yuvarlanmış özetler ve ara başlık. */
t.gecsin("girişte çalışan farkı", S.tam(calisanFark) + " lira");
t.gecsin("girişte işveren farkı", S.tam(isvFark) + " lira");
t.gecsin("işveren ara başlığı", "fark " + Math.floor(isvFark / 1000) + " bin lira");
t.gecmesin("bayat ara başlık", "fark 106 bin lira");

/* Önermeler. */
var dip = brutY.aylar.reduce(function (a, x) { return x.net < a.net ? x : a; });
t.dogru("brüt sözleşmede dip temmuz", dip.ay === 7, "dip ayı " + dip.ay);
var tepe = netBrutler.indexOf(Math.max.apply(null, netBrutler));
t.dogru("net sözleşmede brüt temmuzda tepe", tepe === 6, "tepe ayı " + (tepe + 1));
t.dogru("aralık brütü temmuzdan düşük", netBrutler[11] < netBrutler[6]);
t.dogru("aralık neti temmuzdan yüksek", brutY.aylar[11].net > brutY.aylar[6].net);
t.dogru("işverene maliyet iki katından fazla", isvFark > 2 * calisanFark,
  (isvFark / calisanFark).toFixed(3));

t.bitir();
