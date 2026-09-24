#!/usr/bin/env node
/*
 * "İşsizlik maaşı ne kadar?" yazısının sayıları.
 *
 * Oranlar ve süreler bordro/parametreler.js'teki işsizlik bloğundan,
 * asgari ücret ve damga oranı 2026 parametrelerinden okunuyor; formül
 * işsizlik ödeneği aracının ve tools/issizlik-tablosu.js'in kullandığı
 * formülün aynısı (4447 m.50):
 *
 *   brüt ödenek = min(ortalama × %40, brüt asgari × %80)
 *   net         = brüt − brüt × damga
 *
 * O üreteç aracın sayfasındaki tabloyu yazıyor, bu yazıyı değil. Bu test
 * olmadan asgari ücret değiştiğinde yazı sessizce eskirdi.
 *
 * YILA ÇİVİLİ: yazı "2026" diyor.
 *
 * Kullanım: node makaleler/issizlik-maasi-ne-kadar/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var t = S.yazi(__dirname);

var YIL = 2026;
var P = B.parametre(YIL), I = P.issizlik, DAMGA = P.oranlar.damga;
var d = B.donem(P, 1), ASGARI = d.asgariBrut;

function odenek(ort) {
  var ham = ort * I.oran;
  var brut = Math.min(ham, ASGARI * I.tavanOrani);
  return { ham: ham, tavanda: ham > ASGARI * I.tavanOrani, net: brut - brut * DAMGA };
}

var taban = odenek(ASGARI), tavan = odenek(ASGARI * I.tavanOrani / I.oran);
var tavanNoktasi = ASGARI * I.tavanOrani / I.oran;
var netAsgari = B.hesaplaYil(ASGARI, YIL).aylar[0].net;

t.gecsin("oran", "%" + I.oran * 100 + "’ıdır");
t.gecsin("tavan oranı", "brüt asgari ücretin %" + I.tavanOrani * 100 + "’ini aşamaz");
t.gecsin("taban", "en az " + S.tl(taban.net) + " TL");
t.gecsin("tavan", "en çok " + S.tl(tavan.net) + " TL");
t.gecsin("tavanın dolduğu kazanç", "ortalaması " + S.tam(tavanNoktasi) + " TL");
t.gecsin("net asgari ücret", "net asgari ücreti " + S.tl(netAsgari) + " TL");
t.gecsin("girişteki fark", S.tam(netAsgari - tavan.net) + " lira altında");
t.gecsin("farkın tablosu", S.eksi("-" + S.tl(netAsgari - tavan.net)) + " TL");
t.gecsin("net asgarinin brüte oranı", "brütün %" + Math.round(netAsgari / ASGARI * 100) + "’ine denk");

/* Ana tablo: ortalama brüt → ham, net, 10 ay. */
var satirlar = [
  [ASGARI, S.tam(ASGARI) + " TL (asgari ücret)"],
  [45000, "45.000 TL"], [60000, "60.000 TL"],
  [tavanNoktasi, S.tam(tavanNoktasi) + " TL (tavanın dolduğu nokta)"],
  [90000, "90.000 TL"], [250000, "250.000 TL"]
];
satirlar.forEach(function (s) {
  var o = odenek(s[0]);
  t.gecsin(s[1] + " satırı", s[1] + " " + S.tl(o.ham) + " TL" + (o.tavanda ? " → tavan" : "") + " " +
    S.tl(o.net) + " TL " + S.tl(o.net * 10) + " TL");
});

/* Süreler parametrelerden. */
var aralik = { 1080: "1.080 gün ve üzeri", 900: "900 – 1.079 gün", 600: "600 – 899 gün" };
I.sureler.forEach(function (s) {
  t.gecsin(s[0] + " gün satırı", aralik[s[0]] + " " + s[1] + " gün " + s[1] / 30 + " ay");
});
t.gecsin("süre özeti", "600 günde 6 ay, 900 günde 8 ay, 1080 gün ve üzerinde 10 ay");
t.gecsin("başvuru süresi", "Fesihten itibaren " + I.basvuruGunu + " gün içinde");

t.bitir();
