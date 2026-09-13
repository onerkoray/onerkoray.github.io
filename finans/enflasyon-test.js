#!/usr/bin/env node
/*
 * Enflasyon Motoru regresyonları.
 *
 * NEDEN: reel getiri hatası sessizdir ve hep AYNI yöne sapar — kullanıcı
 * lehine. Çıkarma kullanan bir hesap, getirisini olduğundan iyi gösterir.
 * Testler bu sapmayı ölçüyor ve motorun bölme yaptığını sabitliyor.
 */
"use strict";
var E = require("./enflasyon-motoru.js");
var hata = 0;
var gecen = 0;
function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 1e-9 : tol;
  if (!isFinite(b) || Math.abs(b - bek) > t) {
    hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

console.log("Reel getiri — bolme, cikarma degil");
/* (1,346 / 1,30) - 1 = 0,0353846... */
esit("%34,6 nominal, %30 enflasyon -> %3,538", E.reel(0.346, 0.30), 0.03538461, 1e-7);
esit("enflasyon sifirsa reel = nominal", E.reel(0.42, 0), 0.42, 1e-12);
esit("nominal = enflasyon ise reel sifir", E.reel(0.30, 0.30), 0, 1e-12);
dogru("nominal < enflasyon ise reel negatif", E.reel(0.25, 0.30) < 0);

console.log("\nCikarma yaklasiminin sapmasi olculuyor");
/* cikarma: 0,346 - 0,30 = 0,046 ; dogru: 0,035385 ; sapma 0,010615 */
esit("sapma 1,06 puan", E.cikarmaSapmasi(0.346, 0.30), 0.01061538, 1e-7);
dogru("sapma HEP kullanici lehine (pozitif)", E.cikarmaSapmasi(0.42, 0.35) > 0);
dogru("dusuk enflasyonda sapma kuculuyor",
  E.cikarmaSapmasi(0.05, 0.02) < E.cikarmaSapmasi(0.50, 0.40));

console.log("\nTersinirlik");
esit("nominal(reel(x)) = x", E.nominal(E.reel(0.42, 0.30), 0.30), 0.42, 1e-12);
esit("reel(nominal(x)) = x", E.reel(E.nominal(0.05, 0.30), 0.30), 0.05, 1e-12);

console.log("\nBilesik enflasyon — toplama degil carpma");
/* 1,02 x 1,03 - 1 = 0,0506 */
esit("%2 ve %3 art arda -> %5,06", E.bilesik([0.02, 0.03]), 0.0506, 1e-12);
dogru("toplamadan farkli", Math.abs(E.bilesik([0.02, 0.03]) - 0.05) > 1e-4);
esit("tek donem kendisi", E.bilesik([0.30]), 0.30, 1e-12);
esit("bos seri sifir", E.bilesik([]), 0, 1e-12);
/* 1,30^3 - 1 = 1,197 */
esit("%30, 3 yil -> %119,7", E.yillikBilesik(0.30, 3), 1.197, 1e-12);

console.log("\nTUFE endeksinden donem enflasyonu");
esit("endeks 100 -> 130 = %30", E.donemEnflasyonu(100, 130), 0.30, 1e-12);
esit("endeks degismezse sifir", E.donemEnflasyonu(2456.7, 2456.7), 0, 1e-12);
dogru("sifir endekste NaN", isNaN(E.donemEnflasyonu(0, 130)));

console.log("\nDeflate / inflate ve baz yil");
var d = E.bugunkuDeger(1000, 0.30, 2, "2026 fiyatlari");
/* 1000 / 1,69 = 591,716 */
esit("2 yil, %30 -> 591,72", d.tutar, 591.7159763, 1e-6);
dogru("baz etiketi tasiniyor", d.baz === "2026 fiyatlari");
esit("varsayilan baz etiketi var", E.bugunkuDeger(100, 0.3, 1).baz === "bugün" ? 1 : 0, 1, 0);
esit("inflate, deflate'in tersi",
  E.bugunkuDeger(E.gelecekDeger(1000, 0.30, 4), 0.30, 4).tutar, 1000, 1e-9);

console.log("\nAlim gucu");
/* 1 / 1,30^5 = 0,269329 */
esit("%30, 5 yil -> 0,2693", E.alimGucu(0.30, 5), 0.26932907, 1e-7);
esit("sifir yilda alim gucu 1", E.alimGucu(0.30, 0), 1, 1e-12);
/* ln2 / ln1,30 = 2,641927 yil */
esit("%30'da yarilanma 2,641927 yil", E.yarilanmaSuresi(0.30), 2.641927, 1e-6);
/* ln2 / ln1,72 = 1,278105 */
esit("%72'de yarilanma 1,278105 yil", E.yarilanmaSuresi(0.72), 1.278105, 1e-6);
dogru("enflasyon yoksa yarilanma sonsuz", E.yarilanmaSuresi(0) === Infinity);

console.log("\nSeri reellestirme");
var s = E.seriyiReellestir(
  [{ donem: 2026, tutar: 100 }, { donem: 2027, tutar: 130 }, { donem: 2028, tutar: 169 }],
  0.30, "2026");
esit("ilk donem degismez", s[0].reel, 100, 1e-9);
esit("enflasyonla tam ayni artan seri REEL sabit kalir", s[1].reel, 100, 1e-9);
esit("ucuncu donem de sabit", s[2].reel, 100, 1e-9);
dogru("nominal degerler korunuyor", s[1].nominal === 130);
dogru("her satirda baz var", s.every(function (x) { return x.baz === "2026"; }));

console.log("\nMonotonluk");
var onceki = Infinity, bozuk = false;
for (var y = 0; y <= 30; y++) {
  var g = E.alimGucu(0.30, y);
  if (g > onceki + 1e-12) { bozuk = true; break; }
  onceki = g;
}
dogru("alim gucu yilla azaliyor", !bozuk);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (enflasyon motoru kontrolleri)");
