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

/* --- Olcut: kiranin kendisi DEGIL, vergiye tabi gelir TOPLAMI --------
   Eskiden karar yalnizca brut kiraya bakiyordu ve diger geliri TAMAMEN
   yok sayiyordu: 350.000 TL isyeri kirasi + 5.000.000 TL diger gelirde
   motor "beyan edilmez" diyordu. Hata guvensiz yondeydi.

   Kural: (brut isyeri kirasi + diger vergiye tabi gelir) > had.
   Kira toplama BRUT tutariyla giriyor -- GIB rehberi ve yerlesik
   uygulama beyan sinirini brut kira uzerinden olcuyor. */
console.log("\nBeyan olcutu — vergiye tabi gelir toplami");

var t1 = M.hesapla({ yil: 2026, isyeriKira: 350000, digerGelir: 5000000 });
dogru("diger gelir haddi asiriyorsa beyana girer", t1.isyeriBeyanaGirer === true);
esit("olcute giren toplam", t1.vergiyeTabiToplam, 5350000);

var t2 = M.hesapla({ yil: 2026, isyeriKira: 350000 });
dogru("diger gelir yoksa ayni kira beyana girmiyor", t2.isyeriBeyanaGirer === false);
esit("tek basina toplam kiranin kendisi", t2.vergiyeTabiToplam, 350000);
/* KONTROL: iki sonucu ayiran tek sey diger gelir. Olcut diger geliri
   yok sayarsa bu iki satir birbirine esitlenir ve test duser. */
dogru("farki yaratan yalnizca diger gelir",
  t1.isyeriBeyanaGirer !== t2.isyeriBeyanaGirer);

/* Kira BRUT giriyor: 450.000 TL brut haddi asiyor. Bir ara safi okumasi
   dusunulmustu -- goturu gider sonrasi 382.500 TL haddin altinda kalir
   ve bu kisi beyandan cikardi. Kaynak brutu soyluyor. */
var t3 = M.hesapla({ yil: 2026, isyeriKira: 450000 });
dogru("brut haddi asiyorsa beyana girer", t3.isyeriBeyanaGirer === true);
esit("toplam brut tutarla olculuyor", t3.vergiyeTabiToplam, 450000);
dogru("gider dusulmus tutarla olculmuyor",
  t3.vergiyeTabiToplam !== t3.goturu.safiIrat);

/* Kacak kapandi: birlesim kuralinda bu dava hala "beyan etme"
   tarafindaydi (brut 350.000 altinda, goturu sonrasi safi toplam
   357.500 de altinda), oysa toplam 410.000. */
var t4 = M.hesapla({ yil: 2026, isyeriKira: 350000, digerGelir: 60000 });
esit("toplam 410.000", t4.vergiyeTabiToplam, 410000);
dogru("haddi ancak TOPLAMDA asan dava beyana giriyor",
  t4.isyeriBeyanaGirer === true);

/* Esik "asan" diyor: tam tutar yetmiyor, bir lira yetiyor. */
dogru("tam had beyana girmiyor",
  M.hesapla({ yil: 2026, isyeriKira: 400000 }).isyeriBeyanaGirer === false);
dogru("haddi bir lira asmak yetiyor",
  M.hesapla({ yil: 2026, isyeriKira: 400001 }).isyeriBeyanaGirer === true);

/* Kira yoksa bu karar da yok. Olcut diger geliri de topladigi icin,
   "isyeri > 0" korumasi dusseydi yalnizca maasi olan birine "isyeri
   kiraniz beyana giriyor" denirdi. */
(function () {
  var r = M.hesapla({ yil: 2026, konutKira: 100000, digerGelir: 5000000 });
  dogru("isyeri kirasi yokken beyan karari uretilmiyor",
    r.isyeriBeyanaGirer === false);
  esit("olmayan kiranin stopaji sifir", r.isyeriStopaj, 0);
})();

/* KONUT KIRASI BU OLCUTE GIRMIYOR. Tevkifatli isyeri kirasi m.86/1-c,
   tevkifatsiz konut kirasi m.86/1-d kapsaminda ve ikisi AYRI AYRI
   degerlendiriliyor. Konut kirasinin kendi esigi mesken istisnasidir
   (m.21) ve yukarida ayrica uygulaniyor.

   Test bunu cakiyor cunku davranis sessizce kayabilir: konut kirasi
   toplama eklenirse, istisnayi asan bir konut kirasi olan herkesin
   isyeri kirasi da beyana girmeye baslar. */
(function () {
  var r = M.hesapla({ yil: 2026, konutKira: 900000, isyeriKira: 350000 });
  esit("olcut yalnizca isyeri kirasini sayiyor", r.vergiyeTabiToplam, 350000);
  dogru("buyuk konut kirasi isyeri kirasini beyana sokmuyor",
    r.isyeriBeyanaGirer === false);
  /* KONTROL: konut kirasi gercekten islenmis olmali, yoksa yukaridaki
     iddia "konut girdisi hic okunmuyor" demekten ibaret kalir. */
  dogru("konut kirasi yine de vergilendiriliyor", r.goturu.kiraVergisi > 0);
  esit("mesken istisnasi uygulanmis", r.istisna, 58000);
})();

/* Had tarifeden turedigi icin yila bagli; 2026'da ikinci dilim 400.000. */
esit("olcutun haddi tarifenin ikinci dilimi", P[2026].dilimler[1][0], 400000);

/* KONTROL: parametrenin dosyadan silinmis olmasi YETMEZ -- motorun
   turetilmis degeri gercekten OKUDUGUNU da olcmek gerekiyor. Motor
   iceride 400.000'i elle tasisaydi yukaridaki satirlarin hepsi yine
   gecerdi, cunku 2026'da iki sayi ayni. Tarifeyi gecici olarak kaydirip
   kararin onunla birlikte kaydigini olcuyoruz: 2027'de olacak sey budur. */
(function () {
  var eski = P[2026].dilimler;
  var girdi = { yil: 2026, isyeriKira: 450000 };
  var once = M.hesapla(girdi).isyeriBeyanaGirer;
  var sonra;
  try {
    P[2026].dilimler = eski.map(function (d, i) {
      return i === 1 ? [500000, d[1]] : d.slice();
    });
    sonra = M.hesapla(girdi).isyeriBeyanaGirer;
  } finally {
    P[2026].dilimler = eski;
  }
  dogru("tarife kaymadan once beyana giriyor", once === true);
  dogru("ikinci dilim 500.000'e kayinca girmiyor", sonra === false);
  dogru("tarife geri konuldu", P[2026].dilimler === eski);
})();

/* Beyana GIRMEYEN kiranin stopaji mahsup EDILMEZ: o stopaj nihai
   vergidir, iade dogurmaz. Mahsup edilseydi baska gelirin vergisini
   dusurur ve motor olmayan bir alacak uretirdi. */
(function () {
  /* Dava AYRISMA BOLGESININ DISINDA secildi: 300.000 brut kira, gerçek
     gider sifir olsa bile toplam 350.000 ile haddin altinda kaliyor,
     dolayisiyla iki yontem de "beyan edilmez" diyor. */
  var r = M.hesapla({ yil: 2026, isyeriKira: 300000, digerGelir: 50000,
                      digerStopaj: 5000 });
  dogru("bu kira beyana girmiyor", r.isyeriBeyanaGirer === false);
  esit("olcute giren toplam 350.000", r.vergiyeTabiToplam, 350000);
  esit("girmeyen kiranin stopaji sifir", r.isyeriStopaj, 0);
  esit("mahsupta yalnizca diger stopaj var", r.goturu.mahsup, 5000);
})();

/* --- Karar gider yontemine BAGLI DEGIL ---------------------------------
   Olcut brut kira + diger gelir oldugu icin, hangi gider yontemi
   secilirse secilsin beyan karari ayni cikiyor. Bir ara safi okumasi
   denendiginde karar yonteme bagliydi ve iki yontem ayrisabiliyordu;
   kaynak brutu soyleyince bu belirsizlik ortadan kalkti. Test bunu
   sabitliyor ki eski yapiya sessizce donulmesin. */
(function () {
  var a = M.hesapla({ yil: 2026, isyeriKira: 450000, digerGelir: 100000 });
  var b = M.hesapla({ yil: 2026, isyeriKira: 450000, digerGelir: 100000,
                      gercekGider: 300000 });
  dogru("buyuk gider beyan kararini degistirmiyor",
    a.isyeriBeyanaGirer === b.isyeriBeyanaGirer && a.isyeriBeyanaGirer === true);
  esit("olcute giren toplam giderden etkilenmiyor",
    b.vergiyeTabiToplam, a.vergiyeTabiToplam);
  /* KONTROL: gider gercekten uygulanmis olmali, yoksa yukaridaki iddia
     "hicbir sey degismedi" demekten ibaret kalir. */
  dogru("gider yine de vergiyi degistiriyor",
    b.gercek.kiraVergisi < a.gercek.kiraVergisi);
})();

/* --- Sayfadaki iddia motorla ayni seyi mi soyluyor? --------------------
   Sayfa artik somut bir ornek veriyor: 350.000 TL isyeri kirasi tek
   basina beyan gerektirmez, yaninda 2.000.000 TL baska gelir varsa
   gerektirir. Metin ile motor ayri yerlerde durdugu icin sessizce
   ayrisabilirler; iddia burada motora baglaniyor.

   HTML yoksa atlaniyor: bu test _cekirdek paketinde sayfasiz kosuyor. */
(function () {
  var fs = require("fs"), path = require("path");
  var yol = path.join(__dirname, "..", "kira-geliri-vergisi-hesaplama", "index.html");
  if (!fs.existsSync(yol)) return;
  var html = fs.readFileSync(yol, "utf8");

  console.log("\nSayfadaki iddia motorla uyusuyor mu");

  /* Ornegin iki sayisi sayfada duruyor mu -- metin degisirse test
     dusmeli, yoksa asagidaki motor olcumu bosa doner. */
  dogru("sayfa 350.000 TL ornegini veriyor", html.indexOf("350.000 TL i\u015fyeri kiras\u0131") >= 0);
  dogru("sayfa 2.000.000 TL karsi ornegini veriyor",
    html.indexOf("2.000.000 TL ba\u015fka gelir") >= 0);
  dogru("sayfa haddi m.86/1-c'ye dayandiriyor", html.indexOf("m.86/1-c") >= 0);

  var tek = M.hesapla({ yil: 2026, isyeriKira: 350000 });
  var yanli = M.hesapla({ yil: 2026, isyeriKira: 350000, digerGelir: 2000000 });
  dogru("motor: 350.000 tek basina beyan gerektirmiyor",
    tek.isyeriBeyanaGirer === false);
  dogru("motor: yaninda 2.000.000 varsa gerektiriyor",
    yanli.isyeriBeyanaGirer === true);
})();

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
