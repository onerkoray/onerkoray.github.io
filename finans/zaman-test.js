#!/usr/bin/env node
/*
 * Zaman ve Nakit Akışı Motoru regresyonları.
 *
 * NEDEN AĞIR: bu motorun üstüne Faz 1'in bütün büyük araçları binecek.
 * Buradaki bir hata tek bir sayfayı değil, ona bağlanan her aracı sessizce
 * yanlışa çevirir. Bu yüzden beklenen değerlerin çoğu ELLE hesaplandı ve
 * yorumda gösterildi; testin kendisi motoru tekrar etmiyor.
 *
 * Kullanım: node finans/zaman-test.js
 */
"use strict";
var Z = require("./zaman-motoru.js");
var hata = 0;

function esit(ad, bulunan, beklenen, tol) {
  var t = tol === undefined ? 1e-6 : tol;
  if (!isFinite(bulunan) || Math.abs(bulunan - beklenen) > t) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen + ", bulunan " + bulunan);
  } else console.log("  tamam      " + ad);
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

console.log("Oran donusumleri");
/* 1,0375^12 = 1,5554543... */
esit("aylik %3,75 -> yillik %55,545", Z.efektifYillik(0.0375), 0.55545433, 1e-7);
esit("aylik %1 -> yillik %12,6825", Z.efektifYillik(0.01), 0.12682503, 1e-7);
esit("donusum tersi kendini buluyor", Z.aylikEsdeger(Z.efektifYillik(0.0375)), 0.0375, 1e-12);
esit("sifir oran sifir kalir", Z.efektifYillik(0), 0, 1e-15);
/* 2^(1/5) - 1 = 0,148698... */
esit("CAGR 1000->2000, 5 yil", Z.cagr(1000, 2000, 5), 0.14869835, 1e-7);
esit("CAGR degisim yoksa sifir", Z.cagr(1000, 1000, 3), 0, 1e-12);

console.log("\nNPV — elle hesaplanmis");
/* -1000 + 500/1,1 + 500/1,21 + 500/1,331
   = -1000 + 454,545455 + 413,223140 + 375,657400 = 243,425995 */
esit("NPV([-1000,500,500,500], %10)", Z.npv([-1000, 500, 500, 500], 0.10), 243.425995, 1e-5);
esit("sifir oranda NPV = toplam", Z.npv([-1000, 500, 500, 500], 0), 500, 1e-9);
esit("tek akis iskonto edilmez", Z.npv([-1000], 0.25), -1000, 1e-12);

console.log("\nIRR — NPV'yi sifirlamali");
var a = [-1000, 500, 500, 500];
var r = Z.irr(a);
dogru("IRR bulundu", r !== null);
esit("IRR ~ %23,375", r.oran, 0.23375, 5e-4);
esit("IRR'de NPV sifir", Z.npv(a, r.oran), 0, 1e-6);
dogru("tek isaret degisimi -> tekMi", r.tekMi === true);

/* Bilinen kolay vaka: -100 bugun, +110 bir donem sonra -> %10 */
esit("IRR([-100,110]) = %10", Z.irr([-100, 110]).oran, 0.10, 1e-9);
/* -100, +0, +121 -> iki donemde 1,21 kat -> %10 */
esit("IRR([-100,0,121]) = %10", Z.irr([-100, 0, 121]).oran, 0.10, 1e-7);

console.log("\nIRR — var olmadigi durumlar");
dogru("hep negatif akista IRR yok", Z.irr([-100, -50, -20]) === null);
dogru("hep pozitif akista IRR yok", Z.irr([100, 50, 20]) === null);
dogru("tek elemanli akista IRR yok", Z.irr([-100]) === null);
dogru("bos akista IRR yok", Z.irr([]) === null);

console.log("\nIRR — coklu isaret degisimi bildiriliyor");
/* -100, +250, -150: iki isaret degisimi, birden fazla kok olabilir */
var c = Z.irr([-100, 250, -150]);
if (c) dogru("coklu degisim tekMi=false ile isaretleniyor", c.tekMi === false);
else dogru("coklu degisimde kok bulunamadi (kabul edilebilir)", true);
esit("isaret degisimi sayaci", Z.isaretDegisimi([-100, 250, -150]), 2, 0);
esit("sifirlar sayilmiyor", Z.isaretDegisimi([-100, 0, 0, 110]), 1, 0);

console.log("\nXNPV / XIRR — actual/365");
/* 365 gun sonra 110 -> tam olarak %10 */
var x1 = [{ tarih: "2026-01-01", tutar: -100 }, { tarih: "2027-01-01", tutar: 110 }];
esit("XIRR bir yilda %10", Z.xirr(x1).oran, 0.10, 1e-6);
/* 2026 artik yil degil, 2027 de degil: 2026-01-01 -> 2028-01-01 = 730 gun */
var x2 = [{ tarih: "2026-01-01", tutar: -100 }, { tarih: "2028-01-01", tutar: 121 }];
esit("XIRR iki yilda %10 (121 = 1,1^2)", Z.xirr(x2).oran, 0.10, 1e-5);
esit("XIRR oraninda XNPV sifir", Z.xnpv(x1, Z.xirr(x1).oran), 0, 1e-6);
esit("sifir oranda XNPV = toplam", Z.xnpv(x1, 0), 10, 1e-9);

console.log("\nXIRR — tarih sirasi onemsiz");
var karisik = [{ tarih: "2027-01-01", tutar: 110 }, { tarih: "2026-01-01", tutar: -100 }];
esit("ters sirali akis ayni sonucu verir", Z.xirr(karisik).oran, 0.10, 1e-6);

console.log("\nArtik yil");
/* 2028 artik yil: 2028-01-01 -> 2029-01-01 = 366 gun.
   366/365 yil sonra 110 -> oran 110/100 ^ (365/366) - 1 = 0,0996...  */
var artik = [{ tarih: "2028-01-01", tutar: -100 }, { tarih: "2029-01-01", tutar: 110 }];
esit("366 gun 365'ten farkli sonuc verir",
  Math.abs(Z.xirr(artik).oran - 0.10) > 1e-5 ? 1 : 0, 1, 0);
esit("gun farki artik yili sayiyor", Z.gunFarki("2028-01-01", "2029-01-01"), 366, 0);
esit("gun farki normal yil", Z.gunFarki("2026-01-01", "2027-01-01"), 365, 0);

console.log("\nAnuite — elle hesaplanmis");
/* 100.000, aylik %1, 12 ay:
   1,01^12 = 1,12682503
   P = 100000 x 0,01 x 1,12682503 / 0,12682503 = 8.884,88 */
esit("taksit 8.884,88", Z.anuite(100000, 0.01, 12), 8884.8788, 1e-3);
esit("faizsiz kredide taksit = anapara/vade", Z.anuite(120000, 0, 12), 10000, 1e-9);

console.log("\nOdeme plani — finansal ozdeslikler");
var plan = Z.odemePlani(100000, 0.01, 12);
esit("12 satir", plan.satirlar.length, 12, 0);
esit("son bakiye tam sifir", plan.satirlar[11].kalan, 0, 1e-9);
var anaToplam = plan.satirlar.reduce(function (t, s) { return t + s.anapara; }, 0);
esit("anapara toplami = kredi tutari", anaToplam, 100000, 0.02);
var faizToplam = plan.satirlar.reduce(function (t, s) { return t + s.faiz; }, 0);
esit("faiz toplami raporla tutuyor", faizToplam, plan.faizToplam, 0.02);
esit("anapara + faiz = toplam odeme", anaToplam + faizToplam, plan.odemeToplam, 0.02);
/* Ilk ay faizi tam olarak bakiyenin %1'i */
esit("ilk ay faizi 1.000", plan.satirlar[0].faiz, 1000, 1e-9);
dogru("bakiye monoton azaliyor", plan.satirlar.every(function (s, i, d) {
  return i === 0 || s.kalan <= d[i - 1].kalan + 1e-9;
}));
dogru("her satirda anapara pozitif", plan.satirlar.every(function (s) { return s.anapara > 0; }));

console.log("\nCapraz dogrulama — planin XIRR'i aylik faize esit olmali");
/* Kredi akisinin ic verimi, kredinin efektif yillik maliyetidir. */
var akis = Z.planiAkisaCevir(plan, "2026-01-01", 100000);
var kx = Z.xirr(akis);
dogru("plandan XIRR hesaplanabiliyor", kx !== null);
esit("XIRR ~ efektif yillik (%12,68)", kx.oran, Z.efektifYillik(0.01), 3e-3);

console.log("\nUc degerler");
esit("cok yuksek aylik faizde taksit sonlu",
  isFinite(Z.anuite(10000, 0.50, 24)) ? 1 : 0, 1, 0);
dogru("negatif anaparada NaN", isNaN(Z.anuite(-1000, 0.01, 12)));
dogru("sifir vadede NaN", isNaN(Z.anuite(1000, 0.01, 0)));
dogru("gecersiz tarih hata firlatiyor", (function () {
  try { Z.gunFarki("olmayan-tarih", "2026-01-01"); return false; }
  catch (e) { return true; }
})());

console.log("\nMonotonluk — iskonto orani arttikca NPV azalmali");
var oncekiNpv = Infinity, bozuk = false;
for (var o = 0; o <= 1.0; o += 0.05) {
  var n = Z.npv([-1000, 400, 400, 400, 400], o);
  if (n > oncekiNpv + 1e-9) { bozuk = true; break; }
  oncekiNpv = n;
}
dogru("NPV oranla azaliyor", !bozuk);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\nButun zaman motoru kontrolleri gecti.");
