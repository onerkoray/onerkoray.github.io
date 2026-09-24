#!/usr/bin/env node
/*
 * "Asgari ücret nasıl belirlenir?" yazısının düzyazıdaki sayıları.
 *
 * İki tabloyu tools/bordro-tablo.js yazıyor ve CI denetliyor. Bu test
 * tabloların DIŞINDAKİ cümleleri koruyor: tablo her yıl yeniden üretilir,
 * düzyazı üretilmez. Asgari ücret değiştiğinde tablo yeni rakamı gösterip
 * cümle eskisinde kalırsa bu test kırmızıya döner.
 *
 * 2026-09-24: cümle "yılda 57.881,20 TL daha az gelir ve damga vergisi"
 * diyordu. 57.881,20 TL yalnız gelir vergisi istisnası; damga istisnası
 * (asgari brüt × binde 7,59 × 12) eklenince 60.889,57 TL. Düzeltildi.
 *
 * Kullanım: node makaleler/asgari-ucret-nasil-belirlenir/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var t = S.yazi(__dirname);

var YIL = 2026, P = B.parametre(YIL);

function istisnalar(brut) {
  var y = B.hesaplaYil(brut, YIL), damga = 0;
  y.aylar.forEach(function (a) { damga += a.asgariBrut * P.oranlar.damga; });
  return { gelir: y.toplam.istisna, damga: damga };
}
var i35 = istisnalar(35000), i400 = istisnalar(400000);
t.yakin("istisna brütten bağımsız (gelir)", i35.gelir, i400.gelir);
t.yakin("istisna brütten bağımsız (damga)", i35.damga, i400.damga);

t.gecsin("gelir vergisi istisnası", "yılda " + S.tl(i35.gelir) + " TL daha az gelir vergisi");
t.gecsin("damga dahil toplam", "bu tutar " + S.tl(i35.gelir + i35.damga) + " TL olur");
t.gecsin("SSS cevabı", "— " + S.tl(i35.gelir) + " TL — gelir vergisi istisnası");
t.gecmesin("eski birleşik iddia", "TL daha az gelir ve damga vergisi");

t.gecsin("SGK tavanı", "2026'da " + S.tam(B.donem(P, 1).sgkTavan) + " TL");
t.gecsin("işsizlik ödeneği tavanı", "brüt asgari ücretin %" + P.issizlik.tavanOrani * 100);

t.bitir();
