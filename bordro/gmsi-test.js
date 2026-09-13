#!/usr/bin/env node
/*
 * Kira geliri (GMSİ) motoru regresyonları.
 *
 * NEDEN: istisna, beyan sınırı ve iki gider yöntemi birbirine giren
 * kurallar. Biri yanlış olursa sonuç makul görünmeye devam eder ama
 * yanlış olur. Aşağıdaki beklenen değerler elle hesaplandı.
 *
 * Kullanım: node bordro/gmsi-test.js
 */
"use strict";

var M = require("./gmsi-motor.js");
var P = require("./parametreler.js");
var hata = 0;
var gecen = 0;

function esit(ad, bulunan, beklenen, tol) {
  var t = tol === undefined ? 0.005 : tol;
  if (Math.abs(bulunan - beklenen) > t) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen + ", bulunan " + bulunan);
  } else {
    gecen++;
    console.log("  tamam      " + ad);
  }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1); }

var K = P[2026].gmsi;

console.log("Parametreler yerinde");
esit("mesken istisnasi 58.000", K.meskenIstisnasi, 58000);
esit("istisna ust siniri 1.900.000", K.istisnaUstSinir, 1900000);
esit("goturu gider orani %15", K.goturuGiderOrani, 0.15, 1e-12);
esit("isyeri beyan siniri 400.000", K.isyeriBeyanSiniri, 400000);
esit("isyeri stopaji %20", K.isyeriStopaji, 0.20, 1e-12);

console.log("\nKonut kirasi — istisna ve iki yontem");
/* 120.000 - 58.000 = 62.000 kalan.
   Goturu: 62.000 x %15 = 9.300 gider -> safi 52.700 -> ilk dilim %15 = 7.905
   Gercek (gider yok): 62.000 -> %15 = 9.300 */
var a = M.hesapla({ yil: 2026, konutKira: 120000 });
esit("istisna tam uygulandi", a.istisna, 58000);
esit("istisna sonrasi kalan", a.konutKalan, 62000);
esit("goturu gider 9.300", a.goturu.gider, 9300);
esit("goturu safi irat 52.700", a.goturu.safiIrat, 52700);
esit("goturu vergi 7.905", a.goturu.kiraVergisi, 7905);
esit("gercek vergi 9.300", a.gercek.kiraVergisi, 9300);
dogru("gider yokken goturu avantajli", a.avantajli === "goturu");
esit("fark 1.395", a.fark, 1395);

console.log("\nIstisna altinda kalan konut kirasi");
var b = M.hesapla({ yil: 2026, konutKira: 40000 });
esit("istisna kira kadar", b.istisna, 40000);
esit("matraha bir sey kalmiyor", b.konutKalan, 0);
esit("vergi cikmiyor", b.goturu.odenecek, 0);

console.log("\nGercek gider avantajli oldugunda");
/* 300.000 - 58.000 = 242.000.
   Goturu: 36.300 -> safi 205.700 -> 190.000x%15 + 15.700x%20 = 31.640
   Gercek: 90.000 -> safi 152.000 -> x%15 = 22.800 */
var c = M.hesapla({ yil: 2026, konutKira: 300000, gercekGider: 90000 });
esit("goturu vergi 31.640", c.goturu.kiraVergisi, 31640);
esit("gercek vergi 22.800", c.gercek.kiraVergisi, 22800);
dogru("gercek gider avantajli", c.avantajli === "gercek");
esit("fark 8.840", c.fark, 8840);

console.log("\nIsyeri kirasi — beyan siniri bir ESIK, muafiyet degil");
var d = M.hesapla({ yil: 2026, isyeriKira: 350000 });
dogru("sinir altinda beyana girmiyor", d.isyeriBeyanaGirer === false);
esit("beyana girmeyince vergi yok", d.goturu.odenecek, 0);

var e = M.hesapla({ yil: 2026, isyeriKira: 600000 });
dogru("sinir asilinca beyana giriyor", e.isyeriBeyanaGirer === true);
esit("stopaj mahsubu 600.000 x %20", e.isyeriStopaj, 120000);
/* Goturu: 600.000 x %15 = 90.000 -> safi 510.000
   Vergi: 190.000x.15=28.500 + 210.000x.20=42.000 + 110.000x.27=29.700 = 100.200
   Stopaj 120.000 > vergi -> odenecek 0 */
esit("goturu vergi 100.200", e.goturu.kiraVergisi, 100200);
esit("stopaj vergiyi asinca odenecek 0", e.goturu.odenecek, 0);

console.log("\nIstisna hakkinin dusmesi");
var f = M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 2000000 });
dogru("ust sinir asildi, istisna yok", f.istisnaHakki === false);
esit("istisna 0", f.istisna, 0);
dogru("kullaniciya nedeni soyleniyor",
  f.notlar.some(function (n) { return n.indexOf("1.900.000") > -1; }));

console.log("\nKumulatif tarife — kira, diger gelirin USTUNE biniyor");
var g1 = M.hesapla({ yil: 2026, konutKira: 200000 });
var g2 = M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 1000000 });
dogru("ayni kira, yuksek gelirde daha cok vergi",
  g2.goturu.kiraVergisi > g1.goturu.kiraVergisi);
dogru("efektif oran da yukseliyor",
  g2.goturu.efektifOran > g1.goturu.efektifOran);

console.log("\nKredi faizi indirimi kaldirildi uyarisi");
dogru("uyari her sonucta var",
  a.notlar.some(function (n) { return n.indexOf("7566") > -1; }));

console.log("\nGecersiz girdi");
dogru("kira girilmezse hata", !!M.hesapla({ yil: 2026 }).hata);

console.log("\nMonotonluk — kira arttikca vergi azalmamali");
var onceki = -1;
for (var k = 0; k <= 2000000; k += 50000) {
  var r = M.hesapla({ yil: 2026, konutKira: k || 1 });
  if (r.goturu.kiraVergisi < onceki - 0.01) {
    hata++; console.error("  BASARISIZ  " + k + " TL kirada vergi geriledi"); break;
  }
  onceki = r.goturu.kiraVergisi;
}
if (!hata) console.log("  tamam      vergi kira ile birlikte artiyor");

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (kira geliri kontrolleri)");
