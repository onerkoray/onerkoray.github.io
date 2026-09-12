#!/usr/bin/env node
/*
 * Emeklilik motoru regresyonları.
 *
 * NEDEN: aylık bağlama oranı yanlış girilirse hiçbir şey görünürde bozulmaz;
 * sayfa çalışmaya devam eder, yalnızca sonuçlar sessizce yanlış olur. Bu
 * yüzden kanundaki kademeler, kamuoyunda BİLİNEN referans değerlerle
 * doğrulanıyor: 506 Geçici m.82'ye göre 9.000 gün (25 yıl) ABO'su %65,
 * 5510 m.29'a göre aynı gün sayısı %50. Bu iki sayı motordan SIFIRDAN
 * üretilmiyorsa kademelerde hata var demektir.
 *
 * Kullanım: node bordro/emeklilik-test.js
 */
"use strict";

var M = require("./emeklilik-motor.js");
var P = require("./emeklilik-parametreleri.js");

var hata = 0;

function esit(ad, bulunan, beklenen, tolerans) {
  var t = tolerans === undefined ? 1e-9 : tolerans;
  var ok = Math.abs(bulunan - beklenen) <= t;
  if (!ok) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen + ", bulunan " + bulunan);
  } else {
    console.log("  tamam      " + ad);
  }
}

console.log("506 Gecici m.82 — ABO kademeleri");
esit("3.600 gun  -> %35", P.aboHesapla(P.abo.gecici82, 3600), 0.35, 1e-12);
esit("9.000 gun  -> %65 (bilinen referans)", P.aboHesapla(P.abo.gecici82, 9000), 0.65, 1e-12);
esit("10.800 gun -> %72,5", P.aboHesapla(P.abo.gecici82, 10800), 0.725, 1e-12);
esit("1.800 gun  -> %17,5 (ilk kademe icinde)", P.aboHesapla(P.abo.gecici82, 1800), 0.175, 1e-12);

console.log("\n5510 m.29 — sabit oran ve tavan");
esit("3.600 gun  -> %20", P.aboHesapla(P.abo.m29, 3600), 0.20, 1e-12);
esit("9.000 gun  -> %50 (bilinen referans)", P.aboHesapla(P.abo.m29, 9000), 0.50, 1e-12);
esit("16.200 gun -> %90 (tavana tam oturur)", P.aboHesapla(P.abo.m29, 16200), 0.90, 1e-12);
esit("20.000 gun -> %90 (tavan asilamaz)", P.aboHesapla(P.abo.m29, 20000), 0.90, 1e-12);

console.log("\nAlt sinir aylik — donem secimi");
esit("2026-09 tarihinde 23.552", P.altSinirAylik("2026-09-01").tutar, 23552);
esit("2026-03 tarihinde 20.000", P.altSinirAylik("2026-03-01").tutar, 20000);
esit("2025-08 tarihinde 16.881", P.altSinirAylik("2025-08-01").tutar, 16881);

console.log("\nKismi aylik birlestirme");
var tekDonem = M.hesapla({
  baslangic: "2010-01-01", bitis: "2026-09-01", primGun: 5400, ortalamaKazanc: 45000
});
esit("tek donem ABO %30", tekDonem.karmaAbo, 0.30, 1e-12);
esit("tek donem kok aylik 45.000 x %30", tekDonem.kokAylik, 13500, 1e-6);
esit("alt sinir devreye girdi", tekDonem.odenenAylik, 23552, 1e-6);

var ikiDonem = M.hesapla({
  baslangic: "2000-01-01", bitis: "2026-09-01", primGun: 9000, ortalamaKazanc: 80000
});
esit("iki donemde gun paylari toplami 1", ikiDonem.satirlar.reduce(function (t, s) {
  return t + s.payOrani;
}, 0), 1, 1e-9);
esit("kismi aylik toplami kok aylige esit", ikiDonem.satirlar.reduce(function (t, s) {
  return t + s.kismiAylik;
}, 0), ikiDonem.kokAylik, 1e-9);
esit("karma ABO iki donem arasinda", (ikiDonem.karmaAbo > 0.50 && ikiDonem.karmaAbo < 0.65) ? 1 : 0, 1);

console.log("\nKapsam disi ve gecersiz girdiler");
esit("2000 oncesi hizmet hesaplanmiyor", M.hesapla({
  baslangic: "1995-01-01", bitis: "2026-09-01", primGun: 9000, ortalamaKazanc: 50000
}).hata === "gosterge" ? 1 : 0, 1);
esit("ters tarih reddediliyor", M.hesapla({
  baslangic: "2026-01-01", bitis: "2020-01-01", primGun: 5000, ortalamaKazanc: 50000
}).hata ? 1 : 0, 1);
esit("sifir prim gunu reddediliyor", M.hesapla({
  baslangic: "2010-01-01", bitis: "2026-01-01", primGun: 0, ortalamaKazanc: 50000
}).hata ? 1 : 0, 1);

console.log("\nMonotonluk — daha cok gun daha yuksek ABO vermeli");
var oncekiA = 0, oncekiB = 0;
for (var g = 360; g <= 18000; g += 360) {
  var a = P.aboHesapla(P.abo.gecici82, g);
  var b = P.aboHesapla(P.abo.m29, g);
  if (a < oncekiA - 1e-12 || b < oncekiB - 1e-12) {
    hata++;
    console.error("  BASARISIZ  ABO " + g + " gunde geriledi");
    break;
  }
  oncekiA = a; oncekiB = b;
}
if (!hata) console.log("  tamam      ABO her iki rejimde de azalmiyor");

if (hata) {
  console.error("\n" + hata + " kontrol basarisiz.");
  process.exit(1);
}
console.log("\nButun emeklilik kontrolleri gecti.");
