#!/usr/bin/env node
/*
 * Finansal Ikiz projeksiyon motoru regresyonlari.
 *
 * NEDEN: 20 yillik bir projeksiyonun hatalari GORUNMEZ. Grafik yine
 * cizilir, sayilar yine makuldur; yalnizca yanlistir. Asagidaki
 * kontroller once MUHASEBE OZDESLIKLERINI (her yilda giren-cikan
 * mutabakati), sonra modelin acikca yazili varsayimlarini sabitliyor.
 */
"use strict";
var P = require("./profil.js");
var I = require("./ikiz-motoru.js");
var B = require("../bordro/motor.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.02 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

function profil(ek) {
  var t = {
    kisi: { dogumYili: 1990 },
    gelirler: [{ ad: "Maas", tur: "ucret", aylikBrut: 100000 }],
    giderler: [{ ad: "Kira", aylik: 22000, zorunlu: true },
               { ad: "Market", aylik: 14000, zorunlu: true }],
    varliklar: [{ ad: "Mevduat", tur: "mevduat", deger: 300000 }],
    borclar: [],
    varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0.35, ufukYil: 20 }
  };
  for (var k in (ek || {})) if (Object.prototype.hasOwnProperty.call(ek, k)) t[k] = ek[k];
  return P.normalize(t);
}

/* ------------------------------------------------------------------ */
console.log("Yapisal butunluk");
var r = I.projeksiyon(profil(), "baz");
esit("20 yil uretildi", r.yillar.length, 20, 0);
esit("ilk yil bu yil", r.yillar[0].yil, new Date().getFullYear(), 0);
dogru("yillar artan sirada", r.yillar.every(function (y, i) {
  return i === 0 || y.yil === r.yillar[i - 1].yil + 1;
}));
esit("yas hesaplaniyor", r.yillar[0].yas, new Date().getFullYear() - 1990, 0);
dogru("her yilda butun alanlar sayi", r.yillar.every(function (y) {
  return ["gelir", "gider", "borcOdemesi", "tasarruf", "getiri",
          "varlik", "borc", "netDeger", "reelNetDeger"].every(function (a) {
    return isFinite(y[a]);
  });
}));

/* ------------------------------------------------------------------ */
console.log("\nMUHASEBE OZDESLIGI — her yilda giren = cikan");
/* tasarruf = gelir - gider - borc odemesi. Tutmuyorsa bir kalem iki kez
   sayiliyor ya da hic sayilmiyor demektir. */
dogru("tasarruf = gelir - gider - borc odemesi", r.yillar.every(function (y) {
  return Math.abs(y.tasarruf - (y.gelir - y.gider - y.borcOdemesi)) < 0.5;
}));
/* varlik(t) = varlik(t-1) + getiri + tasarruf */
var oncekiVarlik = 300000;
dogru("varlik = onceki + getiri + tasarruf", r.yillar.every(function (y) {
  var ok = Math.abs(y.varlik - (oncekiVarlik + y.getiri + y.tasarruf)) < 1;
  oncekiVarlik = y.varlik;
  return ok;
}));
dogru("net deger = varlik - borc", r.yillar.every(function (y) {
  return Math.abs(y.netDeger - (y.varlik - y.borc)) < 0.5;
}));

console.log("\nReel deger, nominalden kucuk (pozitif enflasyonda)");
dogru("son yilda reel < nominal",
  r.yillar[19].reelNetDeger < r.yillar[19].netDeger);
/* Enflasyon sifirsa ikisi AYNI olmali. */
var sifirEnf = I.projeksiyon(profil({
  varsayimlar: { enflasyon: 0, ucretArtisi: 0, yatirimGetirisi: 0.10, ufukYil: 5 }
}), "baz");
dogru("enflasyon sifirken reel = nominal", sifirEnf.yillar.every(function (y) {
  return Math.abs(y.reelNetDeger - y.netDeger) < 1;
}));

/* ------------------------------------------------------------------ */
console.log("\nUCRET VERGISI — tarife enflasyonla endeksli varsayimi");
/* Varsayimin gozlemlenebilir sonucu: ucret artisi enflasyona ESITSE
   REEL net ucret sabit kalmali. Tarife endekslenmeseydi kullanici her
   yil ust dilime kayar ve reel net duserdi. */
var esit_ = I.projeksiyon(profil({
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0.30, ufukYil: 10 }
}), "baz");
var reelGelir = esit_.yillar.map(function (y, i) {
  return y.gelir / Math.pow(1.30, i + 1);
});
dogru("reel gelir yillar boyunca sabit (%2 tolerans)",
  reelGelir.every(function (g) {
    return Math.abs(g / reelGelir[0] - 1) < 0.02;
  }));
/* OZDESLIK: ucret yilda bir sicradigi icin ILK YIL maas sabittir;
   dolayisiyla ilk yilin geliri, bordro motorunun duz bir yil icin
   verdigi nete BIREBIR esit olmali.

   Ilk yazimda bu test "%6 tolerans" ile yazilmisti ve dustu: motor
   ucreti AYLIK bilesikliyordu, yani maas surekli artiyordu ve ilk yil
   geliri artis yolunun ortalamasi kadar yuksek cikiyordu. Gercek hayatta
   zam yilda bir gelir, fiyatlar her ay artar; bu faz farki tasarruf
   oraninin yil icinde erimesinin sebebidir. Model duzeltildi ve test
   toleranstan OZDESLIGE cevrildi -- yaklasik bir kontrol bu hatayi bir
   daha yakalayamayabilirdi. */
var bordroNet = B.hesaplaYil(100000, B.sonYil()).toplam.net;
esit("ilk yil geliri = bordro motorunun yillik neti",
  esit_.yillar[0].gelir, bordroNet, 0.5);

/* Ikinci yilin brutu tam olarak %30 yukarida olmali (sicrama, sureklilik
   degil). Aylik bilesiklenseydi bu oran tutmazdi. */
var ikiYil = I.projeksiyon(profil({
  giderler: [], varliklar: [],
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0, ufukYil: 2 }
}), "baz");
esit("ikinci yil geliri, birincinin 1,3 kati",
  ikiYil.yillar[1].gelir / ikiYil.yillar[0].gelir, 1.30, 0.01);

console.log("\nUcret artisi enflasyonun USTUNDEyse reel gelir artiyor");
var hizli = I.projeksiyon(profil({
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.40, yatirimGetirisi: 0.30, ufukYil: 10 }
}), "baz");
dogru("reel gelir artiyor",
  hizli.yillar[9].gelir / Math.pow(1.30, 10) >
  hizli.yillar[0].gelir / Math.pow(1.30, 1) * 1.5);

/* ------------------------------------------------------------------ */
console.log("\nGIDER ENDEKSLEME AYRIMI");
/* Enflasyona endeksli OLMAYAN gider reel olarak her yil ucuzlar.
   Ikisini ayirmadan yapilan projeksiyon sistematik olarak yanlistir. */
var endeksli = I.projeksiyon(profil({
  giderler: [{ ad: "A", aylik: 30000, enflasyonaEndeksli: true }]
}), "baz");
var sabit = I.projeksiyon(profil({
  giderler: [{ ad: "A", aylik: 30000, enflasyonaEndeksli: false }]
}), "baz");
dogru("sabit giderli senaryo daha cok birikiyor",
  sabit.sonReelNetDeger > endeksli.sonReelNetDeger);
esit("ilk ay ikisi de ayni", endeksli.yillar[0].gider > sabit.yillar[0].gider ? 1 : 0, 1, 0);
/* Sabit giderin 20. yildaki reel yuku neredeyse sifira inmeli. */
var sonReelGider = sabit.yillar[19].gider / Math.pow(1.30, 20);
dogru("sabit giderin reel yuku erimis", sonReelGider < 30000 * 12 * 0.02);

console.log("\nBitis yili olan gider duruyor");
var biten = I.projeksiyon(profil({
  giderler: [{ ad: "Okul", aylik: 20000, bitisYili: new Date().getFullYear() + 2 }]
}), "baz");
dogru("3. yildan sonra gider sifir", biten.yillar[4].gider < 1);
dogru("ilk yilda gider var", biten.yillar[0].gider > 1);

/* ------------------------------------------------------------------ */
console.log("\nBORCLAR — amortisman ve serbest kalan nakit");
var borclu = I.projeksiyon(profil({
  borclar: [{ ad: "Ihtiyac", tur: "ihtiyac", kalanAnapara: 120000,
              aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }]
}), "baz");
dogru("borc bitis tarihi raporlandi", borclu.borcBitisleri.length === 1);
dogru("borc 2-3 yil icinde bitti",
  borclu.borcBitisleri[0].ay > 12 && borclu.borcBitisleri[0].ay <= 36);
dogru("odenmemis borc yok", borclu.odenmemisBorc === false);
/* Borc bittikten sonraki yilda borc odemesi SIFIR olmali (serbest kalan
   nakit tasarrufa gecmeli). */
var bitisYilIdx = Math.floor((borclu.borcBitisleri[0].ay - 1) / 12);
dogru("bitisin ertesi yilinda borc odemesi sifir",
  borclu.yillar[bitisYilIdx + 1].borcOdemesi < 1);
dogru("borcsuz senaryo daha cok birikiyor",
  I.projeksiyon(profil(), "baz").sonReelNetDeger > borclu.sonReelNetDeger);

console.log("\nOdeme faizi karsilamiyorsa borc BUYUR");
var batak = I.projeksiyon(profil({
  borclar: [{ ad: "Kart", tur: "kart", kalanAnapara: 200000,
              aylikFaiz: 0.04, kalanVadeAy: 60, aylikOdeme: 1000 }]
}), "baz");
dogru("borc odenmemis isaretlendi", batak.odenmemisBorc === true);
dogru("borc buyudu", batak.yillar[19].borc > 200000);
dogru("bitis tarihi yok", batak.borcBitisleri.length === 0);

/* ------------------------------------------------------------------ */
console.log("\nTUKENME — ve tukenmis sonrasinin ISARETLENMESI");
var acikli = profil({
  giderler: [{ ad: "Gider", aylik: 150000, zorunlu: true }],
  varliklar: [{ ad: "Mevduat", tur: "mevduat", deger: 300000 }]
});
var t = I.projeksiyon(acikli, "baz");
dogru("tukenme yakalandi", t.tukenmeYili !== null);
dogru("tukenme ufuk icinde", t.tukenmeYili <= t.yillar[t.yillar.length - 1].yil);
/* Tukendikten SONRAKI yillar bir tahmin degil, acigin buyuklugu.
   Isaretlenmezse arayuz onlari servet gibi cizerdi. */
var isaretli = t.yillar.filter(function (y) { return y.tukenmisSonrasi; });
dogru("tukenme sonrasi yillar isaretli", isaretli.length > 0);
dogru("ilk isaretli yil, tukenme yiliyla ayni", isaretli[0].yil === t.tukenmeYili);
dogru("tukenmeden onceki yillar isaretsiz",
  t.yillar.filter(function (y) { return y.yil < t.tukenmeYili; })
    .every(function (y) { return !y.tukenmisSonrasi; }));
dogru("saglikli profilde tukenme yok", I.projeksiyon(profil(), "baz").tukenmeYili === null);
dogru("saglikli profilde hicbir yil isaretsiz",
  I.projeksiyon(profil(), "baz").yillar.every(function (y) { return !y.tukenmisSonrasi; }));

/* ------------------------------------------------------------------ */
console.log("\nUC SENARYO — siralama ve band");
var u = I.ucSenaryo(profil());
esit("uc projeksiyon var", [u.kotumser, u.baz, u.iyimser].length, 3, 0);
esit("band uzunlugu yil sayisi kadar", u.bant.length, 20, 0);
dogru("her yilda alt <= orta <= ust", u.bant.every(function (b) {
  return b.alt <= b.orta + 1 && b.orta <= b.ust + 1;
}));
dogru("iyimser en cok birikiyor",
  u.iyimser.sonReelNetDeger > u.baz.sonReelNetDeger &&
  u.baz.sonReelNetDeger > u.kotumser.sonReelNetDeger);
dogru("band orani raporlaniyor", u.bantOrani !== null && isFinite(u.bantOrani));
/* KALIBRASYON KONTROLU: band orani 20 yilda birkac kat olmali. Cok
   kucukse senaryolar anlamsizca yakin, cok buyukse (ilk surumdeki gibi)
   band hicbir sey anlatmiyor demektir. */
dogru("band orani makul araliкta (0,5 - 8 kat)",
  u.bantOrani > 0.5 && u.bantOrani < 8);

console.log("\nBelirsizlik ufukla BUYUR");
var kisa = I.ucSenaryo(profil({
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0.35, ufukYil: 5 }
}));
dogru("5 yilda band, 20 yildakinden dar", kisa.bantOrani < u.bantOrani);

/* ------------------------------------------------------------------ */
console.log("\nDUYARLILIK — hangi varsayim en cok degistiriyor");
var d = I.duyarlilik(profil());
esit("bes kalem olculdu", d.kalemler.length, 5, 0);
dogru("etkiye gore sirali", d.kalemler.every(function (k, i) {
  return i === 0 || Math.abs(k.etki) <= Math.abs(d.kalemler[i - 1].etki) + 1;
}));
dogru("enflasyon artisi NEGATIF etki",
  d.kalemler.filter(function (k) { return k.ad === "Enflasyon"; })[0].etki < 0);
dogru("getiri artisi POZITIF etki",
  d.kalemler.filter(function (k) { return k.ad === "Yatırım getirisi"; })[0].etki > 0);
dogru("gider kisintisi POZITIF etki",
  d.kalemler.filter(function (k) { return k.ad === "Aylık gider"; })[0].etki > 0);
dogru("taban raporlaniyor", isFinite(d.taban));
/* Duyarlilik TAM YENIDEN KOSUM, yaklasik turev degil: sifir sapmada
   etkinin tam sifir olmasi gerekir. */
var sifirSapma = I.duyarlilik(profil(), 0);
dogru("sifir sapmada oran kalemleri sifir", sifirSapma.kalemler
  .filter(function (k) { return /puan/.test(k.birim); })
  .every(function (k) { return Math.abs(k.etki) < 1; }));

/* ------------------------------------------------------------------ */
console.log("\nSINIR DURUMLAR");
var bos = I.projeksiyon(P.bos(), "baz");
dogru("bos profil patlamiyor", bos.yillar.length > 0);
esit("bos profilde net deger sifir", bos.yillar[0].netDeger, 0, 1);
dogru("gelirsiz profilde tukenme yok (gider de yok)", bos.tukenmeYili === null);

var tekAy = I.projeksiyon(profil({
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0.35, ufukYil: 1 }
}), "baz");
esit("bir yillik ufuk calisiyor", tekAy.yillar.length, 1, 0);

dogru("bilinmeyen senaryo adi baza duser",
  Math.abs(I.projeksiyon(profil(), "uydurma").sonReelNetDeger -
           I.projeksiyon(profil(), "baz").sonReelNetDeger) < 1);
dogru("senaryo adi verilmezse baz",
  Math.abs(I.projeksiyon(profil()).sonReelNetDeger -
           I.projeksiyon(profil(), "baz").sonReelNetDeger) < 1);

console.log("\nTekrarlanabilirlik");
/* Rastgelelik YOK: ayni girdi ayni sayiyi vermeli. Uc senaryo
   yaklasiminin Monte Carlo'ya gore bir ustunlugu de bu. */
esit("ayni girdi ayni sonuc",
  I.projeksiyon(profil(), "baz").sonReelNetDeger,
  I.projeksiyon(profil(), "baz").sonReelNetDeger, 0);

console.log("\nProfil KOPYALANIYOR, degistirilmiyor");
var p0 = profil();
var oncekiGider = p0.giderler[0].aylik;
I.duyarlilik(p0);
esit("duyarlilik profili bozmadi", p0.giderler[0].aylik, oncekiGider, 0);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (ikiz projeksiyon kontrolleri)");
