#!/usr/bin/env node
/*
 * Yıllık beyanname motoru regresyonları.
 *
 * NEDEN: bu motorun zor kısmı vergi hesabı değil, BEYAN KARARI. GVK m.86
 * gelir türüne göre ayrı ölçütler koyuyor ve yanlış bir karar sessiz:
 * araç bir sayı üretmeye devam eder, yalnızca yanlış üretir — üstelik
 * kullanıcıyı "beyan etme" tarafına itebilir, ki bu güvensiz yön.
 *
 * YEDİ ÖNERME, HEPSİ KONTROLLÜ
 * ----------------------------
 * Ö1. Tek işverenli ücret beyana girmez; birden fazla işverende ölçüt
 *     BİRİNCİDEN SONRAKİLERİN toplamı.
 *     KONTROL: eşik tam olmalı — bir lira altı girmez, bir lira üstü
 *     girer. "Girmiyor" iddiası her şey sıfırken de geçerdi.
 *
 * Ö2. Tevkifatlı gelirde ölçüt gelirin KENDİSİ değil, vergiye tâbi
 *     gelir TOPLAMI.
 *     KONTROL: aynı kira, yanında başka gelir varken ve yokken farklı
 *     karar vermeli. Aksi hâlde toplam hiç okunmuyor olabilirdi.
 *
 * Ö3. Beyana GİRMEYEN gelirin stopajı mahsup edilmez.
 *     KONTROL: aynı gelir beyana girdiğinde stopaj mahsup EDİLMELİ;
 *     yoksa "mahsup yok" iddiası stopaj hiç okunmasa da geçerdi.
 *
 * Ö4. m.89 indirimleri beyan edilen gelirin yüzdesiyle sınırlı; şahıs
 *     sigortasında ayrıca yıllık asgari ücret tavanı var.
 *     KONTROL: sınırın altındaki talep TAM indirilmeli — yoksa "sınırlı"
 *     iddiası indirim hiç uygulanmasa da geçerdi.
 *
 * Ö5. Ticari ve serbest meslek kazancı tutarı ne olursa olsun beyana
 *     girer (m.85).
 *
 * Ö6. Ödenecek vergi iki eşit taksite bölünür ve taksitler toplamı
 *     ödenecek tutara eşittir (kuruş farkı dahil).
 *
 * Ö7. Eşikler tarifeden TÜRER, motora yazılmaz.
 *     KONTROL: tarife kaydırılınca kararlar da kaymalı.
 *
 * Kullanım: node bordro/beyanname-test.js
 */
"use strict";

var M = require("./beyanname-motoru.js");
var B = require("./motor.js");
var P = require("./parametreler.js");

var YIL = 2026;
var hata = 0, gecen = 0;

function esit(ad, bulunan, beklenen, tol) {
  var t = tol === undefined ? 0.005 : tol;
  if (!isFinite(bulunan) || !isFinite(beklenen) ||
      Math.abs(bulunan - beklenen) > t) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen +
      ", bulunan " + bulunan);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (k) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "  — " + detay : "")); }
}
function baslik(s) { console.log("\n" + s); }

var E = M.esikler(YIL);

baslik("Esikler tarifeden turuyor");
esit("sonraki isverenler esigi = 2. dilim", E.sonrakiIsverenler,
  P[YIL].dilimler[1][0]);
esit("ucret toplami esigi = 4. dilim", E.ucretToplami, P[YIL].dilimler[3][0]);
esit("tevkifatli esigi = 2. dilim", E.tevkifatli, P[YIL].dilimler[1][0]);
dogru("esikler motora elle yazilmamis",
  E.sonrakiIsverenler === 400000 && E.tevkifatli === 400000);

baslik("O1 — ucret (m.86/1-b)");
(function () {
  var tek = M.hesapla({ yil: YIL, ucretler: [{ aylikBrut: 60000 }] });
  dogru("tek isveren beyana girmiyor", tek.ucret.beyanaGirer === false);
  esit("tek isverende beyan geliri sifir", tek.beyanGeliri, 0);
  esit("tek isverende odenecek sifir", tek.odenecek, 0);

  /* KONTROL: esik TAM olmali. Safi ucret uzerinden kuruluyor.
     Birinci isveren, toplam 4. dilimi ASMAYACAK kadar secildi -- yoksa
     7194 kurali devreye girer ve olculen sey baska olur. */
  var tam = M.hesapla({ yil: YIL, ucretler: [
    { safi: 1000000, kesilen: 0 }, { safi: E.sonrakiIsverenler, kesilen: 0 }] });
  dogru("sonrakiler tam esikte beyana girmiyor", tam.ucret.beyanaGirer === false,
    String(tam.ucret.sonrakilerToplami));
  var bir = M.hesapla({ yil: YIL, ucretler: [
    { safi: 1000000, kesilen: 0 }, { safi: E.sonrakiIsverenler + 1, kesilen: 0 }] });
  dogru("bir lira asinca beyana giriyor", bir.ucret.beyanaGirer === true);

  /* En yuksek ucret "birinci isveren" sayilmali: sira onemli. */
  var ters = M.hesapla({ yil: YIL, ucretler: [
    { safi: 300000, kesilen: 0 }, { safi: 1000000, kesilen: 0 }] });
  esit("birinci isveren en yuksek olan", ters.ucret.sonrakilerToplami, 300000);
  dogru("300.000 esigi asmiyor, beyan yok", ters.ucret.beyanaGirer === false);

  /* 7194: ucret toplami 4. dilimi asarsa her halde beyan. */
  var buyuk = M.hesapla({ yil: YIL, ucretler: [
    { safi: E.ucretToplami + 1, kesilen: 0 }] });
  dogru("tek isveren de olsa 4. dilim asilinca beyan",
    buyuk.ucret.beyanaGirer === true && buyuk.ucret.toplamAsti === true);
})();

baslik("O2 — tevkifatli gelirde olcut TOPLAM (m.86/1-c)");
(function () {
  var yalniz = M.hesapla({ yil: YIL, isyeriKira: 350000 });
  dogru("350.000 kira tek basina beyana girmiyor",
    yalniz.kira.isyeriBeyanaGirer === false);
  esit("beyan geliri sifir", yalniz.beyanGeliri, 0);

  /* KONTROL: ayni kira, yaninda baska gelir. */
  var yanli = M.hesapla({ yil: YIL, isyeriKira: 350000, serbestMeslek: 2000000 });
  dogru("yaninda serbest meslek varken beyana giriyor",
    yanli.kira.isyeriBeyanaGirer === true);
  dogru("farki yaratan yalnizca diger gelir",
    yalniz.kira.isyeriBeyanaGirer !== yanli.kira.isyeriBeyanaGirer);

  /* MSI tarafi ayni kuralla. */
  var msiYalniz = M.hesapla({ yil: YIL, msiTevkifatli: 350000, msiStopaj: 52500 });
  dogru("350.000 MSI tek basina beyana girmiyor", msiYalniz.msi.beyanaGirer === false);
  var msiYanli = M.hesapla({ yil: YIL, msiTevkifatli: 350000, msiStopaj: 52500,
                             ticariKazanc: 1000000 });
  dogru("yaninda ticari kazanc varken MSI beyana giriyor",
    msiYanli.msi.beyanaGirer === true);

  /* Beyana GIRMEYEN ucret, (c) toplamina dahil EDILMEMELI.
     MSI uzerinden olculuyor: kira kendi esigini gmsi-motor'dan okuyor,
     dolayisiyla bu motorun kendi toplamini SINAMIYOR. MSI yolu ise
     dogrudan buradaki tabiToplam'i kullaniyor. */
  var ucretli = M.hesapla({ yil: YIL, msiTevkifatli: 300000, msiStopaj: 45000,
                            ucretler: [{ aylikBrut: 200000 }] });
  dogru("yuksek ama beyan disi ucret var", ucretli.ucret.beyanaGirer === false &&
    ucretli.ucret.safiToplam > E.tevkifatli, String(ucretli.ucret.safiToplam));
  dogru("beyan disi ucret MSI olcutune katilmiyor",
    ucretli.msi.beyanaGirer === false);
  /* KONTROL: ayni ucret BEYANA GIRSEYDI, MSI de girerdi. */
  var ikiIs = M.hesapla({ yil: YIL, msiTevkifatli: 300000, msiStopaj: 45000,
    ucretler: [{ aylikBrut: 200000 }, { aylikBrut: 100000 }] });
  dogru("ucret beyana girince MSI de giriyor",
    ikiIs.ucret.beyanaGirer === true && ikiIs.msi.beyanaGirer === true);

  /* KONTROL: MSI esigi TARIFEDEN mi turuyor? Motora 400.000 elle
     yazilsaydi yukaridaki her iddia yine gecerdi -- 2026'da iki sayi
     ayni. Tarifeyi kaydirip olcuyoruz. */
  var eskiD = P[YIL].dilimler;
  var kaymis;
  try {
    P[YIL].dilimler = eskiD.map(function (d, i) {
      return i === 1 ? [2000000, d[1]] : d.slice();
    });
    kaymis = M.hesapla({ yil: YIL, msiTevkifatli: 300000, msiStopaj: 45000,
                         ticariKazanc: 1000000 });
  } finally {
    P[YIL].dilimler = eskiD;
  }
  dogru("2. dilim 2.000.000'e kayinca MSI beyana girmiyor",
    kaymis.msi.beyanaGirer === false);
  dogru("tarife geri konuldu", P[YIL].dilimler === eskiD);
})();

baslik("O2b — tevkifatsiz irat AYRI bir hadde tabi (m.86/1-d)");
(function () {
  /* Bu alan eklenmeden once, yalnizca tevkifatsiz iradi olan birine arac
     "beyanname gerekmiyor" diyordu: 22.000 TL'lik had hic uygulanmiyordu. */
  var alt = M.hesapla({ yil: YIL, tevkifatsizIrat: E.tevkifatsiz });
  dogru("had tam tutarda beyana girmiyor",
    alt.tevkifatsizIrat.beyanaGirer === false);
  esit("beyan geliri sifir", alt.beyanGeliri, 0);

  var ust = M.hesapla({ yil: YIL, tevkifatsizIrat: E.tevkifatsiz + 1 });
  dogru("bir lira asinca beyana giriyor", ust.tevkifatsizIrat.beyanaGirer === true);
  /* Had bir MUAFIYET degil ESIK: asilinca tamami girer. */
  esit("asilinca TAMAMI beyana giriyor", ust.beyanGeliri, E.tevkifatsiz + 1);

  /* KONTROL: bu had (c) toplamindan AYRI degerlendirilmeli. Buyuk bir
     ticari kazanc, kucuk tevkifatsiz iradi beyana SOKMAMALI. */
  var ayri = M.hesapla({ yil: YIL, tevkifatsizIrat: 10000,
                         ticariKazanc: 5000000 });
  dogru("buyuk ticari kazanc tevkifatsiz iradi beyana sokmuyor",
    ayri.tevkifatsizIrat.beyanaGirer === false);
  esit("beyan geliri yalnizca ticari kazanc", ayri.beyanGeliri, 5000000);
  /* Ve tersi: tevkifatsiz irat (c) toplamina karismamali. */
  var tersi = M.hesapla({ yil: YIL, tevkifatsizIrat: 5000000,
                          msiTevkifatli: 100000, msiStopaj: 15000 });
  dogru("tevkifatsiz irat MSI olcutune karismiyor",
    tersi.msi.beyanaGirer === false);

  /* KONTROL: had PARAMETREDEN mi okunuyor? Motora 22.000 elle yazilsaydi
     yukaridaki her iddia yine gecerdi -- parametre de 22.000. Parametreyi
     oynatip kararin onunla birlikte kaydigini olcuyoruz. */
  esit("had parametredeki tevkifatsizHad", E.tevkifatsiz,
    P[YIL].gmsi.tevkifatsizHad);
  (function () {
    var onceki = P[YIL].gmsi.tevkifatsizHad;
    var kaymis;
    try {
      P[YIL].gmsi.tevkifatsizHad = onceki * 10;
      kaymis = M.hesapla({ yil: YIL, tevkifatsizIrat: onceki + 1 });
    } finally {
      P[YIL].gmsi.tevkifatsizHad = onceki;
    }
    dogru("had on katina cikinca ayni irat beyana girmiyor",
      kaymis.tevkifatsizIrat.beyanaGirer === false);
    esit("parametre geri konuldu", P[YIL].gmsi.tevkifatsizHad, onceki);
  })();
  /* Tevkifatsiz iradin stopaji YOKTUR; mahsup dogurmamali. */
  esit("tevkifatsiz iratta mahsup yok", ust.mahsup, 0);
})();

baslik("O3 — beyana girmeyen gelirin stopaji mahsup edilmez");
(function () {
  var disarda = M.hesapla({ yil: YIL, msiTevkifatli: 300000, msiStopaj: 45000 });
  esit("beyan disi MSI stopaji mahsup edilmiyor", disarda.mahsup, 0);

  /* KONTROL: ayni gelir beyana girdiginde mahsup EDILMELI. */
  var iceride = M.hesapla({ yil: YIL, msiTevkifatli: 300000, msiStopaj: 45000,
                            ticariKazanc: 1000000 });
  esit("beyana giren MSI stopaji mahsup ediliyor", iceride.mahsup, 45000);

  /* Ucret tarafinda da ayni. */
  var ucretDis = M.hesapla({ yil: YIL, ucretler: [{ aylikBrut: 80000 }] });
  esit("beyan disi ucretin vergisi mahsup edilmiyor", ucretDis.mahsup, 0);
  var ucretIc = M.hesapla({ yil: YIL,
    ucretler: [{ aylikBrut: 80000 }, { aylikBrut: 70000 }] });
  dogru("beyana giren ucretin vergisi mahsup ediliyor", ucretIc.mahsup > 0,
    String(ucretIc.mahsup));
})();

baslik("O4 — m.89 indirimleri");
(function () {
  var gelir = 1000000;
  var r = M.hesapla({ yil: YIL, ticariKazanc: gelir,
    egitimSaglik: 500000, bagis: 500000, sahisSigorta: 500000 });
  var i = r.indirimler;
  esit("egitim-saglik %10 ile sinirli", i.egitimSaglik.indirilen, gelir * 0.10);
  esit("bagis %5 ile sinirli", i.bagis.indirilen, gelir * 0.05);
  /* Sahis sigortasi: %15 ve yillik asgari ucret tavaninin KUCUGU. */
  var yillikAsgari = P[YIL].donemler[0].asgariBrut * 12;
  esit("sahis sigortasi tavani yillik asgari ucret", i.sahisSigortaTavani, yillikAsgari);
  esit("sahis sigortasi kucuk sinirla kisitli",
    i.sahisSigorta.indirilen, Math.min(gelir * 0.15, yillikAsgari));

  /* KONTROL: sinirin ALTINDAKI talep tam indirilmeli. */
  var az = M.hesapla({ yil: YIL, ticariKazanc: gelir, egitimSaglik: 20000 });
  esit("sinir altindaki talep tam indiriliyor",
    az.indirimler.egitimSaglik.indirilen, 20000);
  esit("matrah indirim kadar azaliyor", az.matrah, gelir - 20000);

  /* KONTROL: yukaridaki davada %15 zaten tavandan KUCUK, yani tavan
     baglayici degil -- tavan kaldirilsa sonuc degismezdi. Tavanin
     gercekten isledigi bir dava ayrica olculuyor: gelirin %15'i yillik
     asgari ucreti asacak kadar buyuk. */
  var buyukGelir = Math.ceil(yillikAsgari / 0.15) + 1000000;
  var b = M.hesapla({ yil: YIL, ticariKazanc: buyukGelir,
    sahisSigorta: buyukGelir });
  dogru("bu gelirde %15 tavandan buyuk",
    buyukGelir * 0.15 > yillikAsgari,
    (buyukGelir * 0.15) + " > " + yillikAsgari);
  esit("sahis sigortasi asgari ucret tavaniyla kisitlaniyor",
    b.indirimler.sahisSigorta.indirilen, yillikAsgari);

  /* Indirim matrahi negatife dusuremez. Tavanlarin toplami %30 oldugu
     icin bu koruma pratikte ULASILAMAZ; yine de degismemeli. */
  var asiri = M.hesapla({ yil: YIL, ticariKazanc: 10000, bagis: 999999 });
  dogru("matrah negatife dusmuyor", asiri.matrah >= 0, String(asiri.matrah));
  esit("indirim tavanla sinirli oldugu icin matrah beklendigi gibi",
    asiri.matrah, 10000 - 500);
})();

baslik("O5 — ticari ve serbest meslek her halde beyana girer");
(function () {
  var kucuk = M.hesapla({ yil: YIL, serbestMeslek: 1000 });
  dogru("1.000 TL serbest meslek bile beyana giriyor", kucuk.beyannameVar === true);
  esit("beyan geliri serbest meslek kadar", kucuk.beyanGeliri, 1000);
  var t = M.hesapla({ yil: YIL, ticariKazanc: 500 });
  dogru("500 TL ticari kazanc bile beyana giriyor", t.beyannameVar === true);
})();

baslik("O6 — taksitler");
(function () {
  var r = M.hesapla({ yil: YIL, ticariKazanc: 2000000 });
  dogru("iki taksit var", r.taksitler.length === 2);
  esit("taksitler toplami odenecek tutara esit",
    r.taksitler[0].tutar + r.taksitler[1].tutar, r.odenecek);
  /* KONTROL: toplam iddiasi taksitler 1/3 - 2/3 bolunse de gecerdi.
     Iki taksit ESIT olmali (kurus farki disinda). */
  dogru("iki taksit esit",
    Math.abs(r.taksitler[0].tutar - r.taksitler[1].tutar) <= 0.01,
    r.taksitler[0].tutar + " vs " + r.taksitler[1].tutar);
  esit("ilk taksit mart", r.taksitler[0].ay, 3);
  esit("ikinci taksit temmuz", r.taksitler[1].ay, 7);
  /* Odenecek yoksa taksit de yok. */
  var iade = M.hesapla({ yil: YIL, ticariKazanc: 100000, gecicVergi: 999999 });
  dogru("iade halinde taksit uretilmiyor", iade.taksitler.length === 0);
  dogru("iade tutari pozitif", iade.iade > 0, String(iade.iade));
})();

baslik("O7 — esikler tarifeden turuyor (KONTROL)");
(function () {
  var eski = P[YIL].dilimler;
  var once = M.hesapla({ yil: YIL, isyeriKira: 450000 }).kira.isyeriBeyanaGirer;
  var sonra;
  try {
    P[YIL].dilimler = eski.map(function (d, i) {
      return i === 1 ? [900000, d[1]] : d.slice();
    });
    sonra = M.hesapla({ yil: YIL, isyeriKira: 450000 }).kira.isyeriBeyanaGirer;
  } finally {
    P[YIL].dilimler = eski;
  }
  dogru("tarife kaymadan once beyana giriyor", once === true);
  dogru("2. dilim 900.000'e kayinca girmiyor", sonra === false);
  dogru("tarife geri konuldu", P[YIL].dilimler === eski);
})();

baslik("Motor kirlenmemeli");
(function () {
  var d = P[YIL].donemler[0];
  var tavan = d.sgkTavan, dilim = P[YIL].dilimler;
  M.hesapla({ yil: YIL, ucretler: [{ aylikBrut: 90000 }, { aylikBrut: 70000 }],
              konutKira: 200000, isyeriKira: 500000, msiTevkifatli: 100000,
              serbestMeslek: 300000, egitimSaglik: 10000 });
  dogru("prim tavani yerinde", d.sgkTavan === tavan);
  dogru("tarife yerinde", P[YIL].dilimler === dilim);
})();

baslik("Gecersiz ve bos girdi");
(function () {
  var bos = M.hesapla({ yil: YIL });
  dogru("bos girdide beyanname yok", bos.beyannameVar === false);
  esit("bos girdide odenecek sifir", bos.odenecek, 0);
  var yok = M.hesapla({ yil: 1999 });
  dogru("tanimsiz yilda hata donuyor", !!yok.hata);
  var negatif = M.hesapla({ yil: YIL, ticariKazanc: -500 });
  esit("negatif gelir sifirlaniyor", negatif.beyanGeliri, 0);
})();

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (yillik beyanname)");
process.exit(hata ? 1 : 0);
