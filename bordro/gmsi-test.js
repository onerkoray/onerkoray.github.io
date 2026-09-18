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
  /* NaN KORUMASI: bulunan undefined ise fark NaN olur ve NaN > t her
     zaman false dondugu icin iddia SESSIZCE GECERDI. Parametre
     silindiginde test bunu fark etmedi; testin en temel isi olan
     "deger yerinde mi" sorusu calismiyordu. */
  if (!isFinite(bulunan) || !isFinite(beklenen) ||
      Math.abs(bulunan - beklenen) > t) {
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
/* Ust sinir ARTIK PARAMETRE DEGIL: GVK m.21 onu tarifenin ucuncu
   diliminde ucret gelirleri icin yer alan tutar olarak tanimliyor.
   Elle yazilan kopya 2023'ten kalmis ve 1.900.000 diyordu; dogrusu
   2026 icin 1.500.000. Test her iki tarafi da bagliyor: parametre
   geri gelmemeli VE turetilen deger tarifeyle ayni olmali. */
dogru("ust sinir elle yazilmiyor", K.istisnaUstSinir === undefined);
esit("ucret tarifesi ucuncu dilim 1.500.000", P[2026].dilimler[2][0], 1500000);
esit("goturu gider orani %15", K.goturuGiderOrani, 0.15, 1e-12);
/* Beyan haddi de ARTIK PARAMETRE DEGIL: GVK m.86/1-c onu tarifenin
   ikinci gelir diliminde yer alan tutar olarak tanimliyor. Ust sinirda
   oldugu gibi test iki tarafi birden bagliyor: parametre geri gelmemeli
   VE turetilen deger tarifenin ikinci dilimiyle ayni olmali. */
dogru("beyan haddi elle yazilmiyor", K.isyeriBeyanSiniri === undefined);
esit("tarifenin ikinci dilimi 400.000", P[2026].dilimler[1][0], 400000);
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
  f.notlar.some(function (n) { return n.indexOf("1.500.000") > -1; }));

/* SINIRIN TAM USTU VE TAM KENDISI. Kanun "asanlar" der: sinirin
   KENDISI istisnayi kaybettirmez. */
var s1 = M.hesapla({ yil: 2026, konutKira: 200000, brutGelirToplami: 1300000 });
esit("toplam tam 1.500.000 — istisna duruyor", s1.istisna, 58000);
var s2 = M.hesapla({ yil: 2026, konutKira: 200000, brutGelirToplami: 1300001 });
esit("bir lira ustu — istisna dusuyor", s2.istisna, 0);

/* Kanun (b) bendini yalnizca "istisna haddinin uzerinde hasilat elde
   edenler" icin isletir: hasilati 58.000'in altinda olan yuksek gelirli
   biri istisnayi KAYBETMEZ. */
var s3 = M.hesapla({ yil: 2026, konutKira: 50000, brutGelirToplami: 5000000 });
esit("hasilat istisna haddinin altinda — sinir isletilmez", s3.istisna, 50000);

console.log("\nTicari/zirai/mesleki beyan mecburiyeti (GVK m.21)");
/* Bu kosul sayfada UC YERDE yaziyordu ama form hic sormuyordu; yani
   serbest meslek erbabi da istisnayi aliyordu. */
var t1 = M.hesapla({ yil: 2026, konutKira: 200000, ticariBeyan: true });
esit("ticari beyan varsa istisna 0", t1.istisna, 0);
dogru("tutara bakilmadigi soyleniyor",
  t1.notlar.some(function (n) { return n.indexOf("bir onemi yoktur") > -1 ||
    n.indexOf("bir önemi yoktur") > -1; }));
var t2 = M.hesapla({ yil: 2026, konutKira: 200000, ticariBeyan: false });
esit("ticari beyan yoksa istisna duruyor", t2.istisna, 58000);
dogru("ticari beyan, gelir sinirindan BAGIMSIZ",
  M.hesapla({ yil: 2026, konutKira: 200000, brutGelirToplami: 0,
    ticariBeyan: true }).istisna === 0);

console.log("\nUst sinir tabani: beyan edilen degil, GAYRI SAFI toplam");
/* GVK m.21 "beyani gerekip gerekmedigine bakilmaksizin" der. Stopajla
   vergilenip beyan edilmeyen ucret de bu toplama girer. */
var b1 = M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 0,
  brutGelirToplami: 1400000 });
esit("beyan edilen 0 ama brut 1,4 mn — istisna dusuyor", b1.istisna, 0);
var b2 = M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 0 });
esit("brut verilmezse eski davranis (digerGelir)", b2.istisna, 58000);
dogru("brut, vergi matrahini DEGISTIRMEZ (yalniz sinir testi)",
  M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 0 }).goturu.kiraVergisi ===
  M.hesapla({ yil: 2026, konutKira: 200000, digerGelir: 0,
    brutGelirToplami: 0 }).goturu.kiraVergisi);

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
