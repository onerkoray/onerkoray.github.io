#!/usr/bin/env node
/*
 * Karar laboratuvari regresyonlari.
 *
 * NEDEN: bu motor secenekleri SIRALIYOR. Yanlis bir siralama, makul
 * gorunen ama para kaybettiren bir tavsiye demek -- ve bu kod tabaninda
 * bir kez yasandi (dagitim motorunun ilk surumu ucuz borcu otomatik
 * kapatiyordu). Kural o zaman kondu: motor oneriyi degil, secenegin
 * BEDELINI verir ve her siralamayi basabas noktasiyla birlikte sunar.
 */
"use strict";
var P = require("./profil.js");
var I = require("./ikiz-motoru.js");
var K = require("./karar-motoru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.5 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

function profil(ek) {
  var t = {
    kisi: { dogumYili: 1990 },
    gelirler: [{ ad: "Maas", tur: "ucret", aylikBrut: 140000 }],
    giderler: [{ ad: "Kira", aylik: 22000, zorunlu: true },
               { ad: "Diger", aylik: 34500, zorunlu: true }],
    varliklar: [{ ad: "Mevduat", tur: "mevduat", deger: 300000 }],
    borclar: [], olaylar: [], hedefler: [],
    varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30,
      yatirimGetirisi: 0.35, ufukYil: 20 }
  };
  for (var k in (ek || {})) if (Object.prototype.hasOwnProperty.call(ek, k)) t[k] = ek[k];
  return P.normalize(t);
}
function borcla(aylikFaiz, anapara, odeme) {
  return profil({ borclar: [{ ad: "Kredi", tur: "ihtiyac",
    kalanAnapara: anapara || 800000, aylikFaiz: aylikFaiz,
    kalanVadeAy: 60, aylikOdeme: odeme || 28000 }] });
}

/* ------------------------------------------------------------------ */
console.log("VARLIK GETIRI SINIFLARI — nakit, mevduat ve konut AYNI DEGIL");
/* Ilk surumde konut/arac disindaki her sey senaryo getirisini
   kazaniyordu, nakit dahil. Yastik altindaki paranin yilda %35 kazanmasi
   sacma ve "nakitte mi tutayim yatirayim mi" sorusunu sorulamaz hale
   getiriyordu: iki secenek de ayni sonucu veriyordu. */
function tekVarlik(tur) {
  return P.normalize({
    gelirler: [], giderler: [], borclar: [], olaylar: [], hedefler: [],
    varliklar: [{ ad: "X", tur: tur, deger: 1000000 }],
    varsayimlar: { enflasyon: 0.30, ucretArtisi: 0, yatirimGetirisi: 0.35, ufukYil: 10 }
  });
}
var mev = I.projeksiyon(tekVarlik("mevduat"), "baz").yillar[9].reelNetDeger;
var nak = I.projeksiyon(tekVarlik("nakit"), "baz").yillar[9].reelNetDeger;
var kon = I.projeksiyon(tekVarlik("konut"), "baz").yillar[9].reelNetDeger;
dogru("mevduat reel olarak BUYUYOR", mev > 1000000 * 1.3);
esit("konut reel degerini KORUYOR", kon, 1000000, 5);
/* Nakit: 1.000.000 / 1,30^10 = 72.538. Alim gucunun %93'u erimis. */
esit("nakit reel olarak ERIYOR", nak, 1000000 / Math.pow(1.30, 10), 500);
dogru("uc sinif birbirinden farkli", mev > kon && kon > nak);

/* ------------------------------------------------------------------ */
console.log("\nOZDESLIK — basabas, kredinin EFEKTIF YILLIK FAIZI");
/* Iki BAGIMSIZ motorun ayni sayiyi vermesi gerekiyor:
   karar laboratuvari yasam boyu projeksiyondan ikiye bolmeyle basabasi
   buluyor; kredinin efektif faizi ise duz bir bilesik hesap.
   Tutmuyorsa modelde bir yerde nakit kaybolmus ya da iki kez sayilmis
   demektir. Erken kapatma aracindaki ayni ozdesligin yasam boyu
   olcegindeki karsiligi. */
[0.021, 0.032, 0.045].forEach(function (ay) {
  var efektif = Math.pow(1 + ay, 12) - 1;
  var bb = K.basabas(borcla(ay), 1000000, "yatirim", "borc");
  dogru("aylik %" + (ay * 100).toFixed(1) + ": basabas bulundu", bb.bulundu === true);
  esit("aylik %" + (ay * 100).toFixed(1) + ": basabas = efektif yillik faiz",
    bb.getiri, efektif, 0.01);
  dogru("aylik %" + (ay * 100).toFixed(1) + ": esigin ustunde YATIRIM onde",
    bb.ustunde === "yatirim");
  dogru("aylik %" + (ay * 100).toFixed(1) + ": esigin altinda BORC onde",
    bb.altinda === "borc");
});

console.log("\nBorcsuzken basabas YOK — uydurulmuyor");
var bbYok = K.basabas(profil(), 1000000, "yatirim", "borc");
dogru("donmuyor diye bildiriliyor",
  bbYok.bulundu === false && bbYok.sebep === "donmuyor");
dogru("getiri alani UYDURULMUYOR", bbYok.getiri === undefined);

console.log("\nGecersiz girdi");
dogru("tutar sifirsa hata", !!K.karsilastir(profil(), 0).hata);
dogru("bilinmeyen secenek yok sayiliyor",
  K.basabas(profil(), 1000, "uydurma", "borc").sebep === "secenek-yok");

/* ------------------------------------------------------------------ */
console.log("\nSIRALAMA — pahali borc varken borc kapatmak onde");
var pahali = K.karsilastir(borcla(0.032), 1000000);
esit("dort secenek olculdu", pahali.secenekler.length, 4, 0);
dogru("baz senaryoda borc kapatmak kazaniyor", pahali.enIyiBaz === "borc");
dogru("kotumser senaryoda da borc kapatmak", pahali.enIyiKotumser === "borc");
dogru("ayni kazanan isaretlendi", pahali.ayniKazanan === true);
dogru("sonuclar baza gore sirali", pahali.secenekler.every(function (s, i) {
  return i === 0 || s.baz <= pahali.secenekler[i - 1].baz + 1;
}));

console.log("\nUcuz borc varken yatirim onde");
/* Aylik %1 -> yillik %12,7; %35 getiri bunun cok ustunde. */
var ucuz = K.karsilastir(borcla(0.01), 1000000);
dogru("yatirim kazaniyor", ucuz.enIyiBaz === "yatirim");

console.log("\nNAKIT HER ZAMAN EN KOTUSU (pozitif enflasyonda)");
/* Nakit nominal olarak durur; reel olarak erir. Hicbir senaryoda
   yatirimi ya da borc kapatmayi gecemez. */
[borcla(0.032), borcla(0.01), profil()].forEach(function (pr, i) {
  var r = K.karsilastir(pr, 1000000);
  var nakitS = r.secenekler.filter(function (s) { return s.id === "nakit"; })[0];
  dogru("profil " + (i + 1) + ": nakit en dusuk baz sonucu",
    r.secenekler.every(function (s) { return s.baz >= nakitS.baz - 1; }));
});

console.log("\nLIKIDITE BEDELI GORUNUYOR");
/* Borcu kapatmak serveti buyutup dayanma suresini KISALTABILIR ve bu
   gorunmeli; tek bir "kazanan" gostermek riski gizlerdi. */
var likidite = K.karsilastir(borcla(0.032), 1000000);
var borcS = likidite.secenekler.filter(function (s) { return s.id === "borc"; })[0];
var yatS = likidite.secenekler.filter(function (s) { return s.id === "yatirim"; })[0];
dogru("borc kapatmak dayanma suresini kisaltiyor", borcS.dayanmaAy < yatS.dayanmaAy);
dogru("ama baz sonucu daha yuksek", borcS.baz > yatS.baz);

/* ------------------------------------------------------------------ */
console.log("\nMUHASEBE — para kaybolmuyor, iki kez de sayilmiyor");
/* Borca uygulanan tutar borcu tam kapatiyorsa artan YATIRIMA gitmeli;
   yok sayilirsa sonuc yanlis yonde bozulur. */
var kucukBorc = borcla(0.032, 200000, 10000);
var buyukTutar = K.karsilastir(kucukBorc, 1000000, ["borc", "yatirim"]);
var b2 = buyukTutar.secenekler.filter(function (s) { return s.id === "borc"; })[0];
var y2 = buyukTutar.secenekler.filter(function (s) { return s.id === "yatirim"; })[0];
/* 200.000'lik borc 1.000.000 ile kapaniyor; 800.000 yatirima gidiyor.
   Sonuc yatirim secenegine YAKIN olmali, cok altinda degil. */
dogru("artan tutar yatirima gitti (sonuc makul aralikta)",
  b2.baz > y2.baz * 0.9 && b2.baz < y2.baz * 1.3);

console.log("\nTutar buyudukce sonuc buyuyor");
var onceki = -Infinity;
[250000, 500000, 1000000, 2000000].forEach(function (t) {
  var r = K.karsilastir(borcla(0.032), t, ["yatirim"]);
  dogru("tutar " + t + ": sonuc artiyor", r.secenekler[0].baz > onceki);
  onceki = r.secenekler[0].baz;
});

console.log("\nSecenek suzme");
var ikisi = K.karsilastir(borcla(0.032), 1000000, ["borc", "nakit"]);
esit("yalnizca istenen secenekler", ikisi.secenekler.length, 2, 0);
dogru("dogru secenekler", ikisi.secenekler.every(function (s) {
  return s.id === "borc" || s.id === "nakit";
}));

console.log("\nTekrarlanabilirlik ve yan etkisizlik");
var pr0 = borcla(0.032);
var borcSayisi = pr0.borclar.length;
var varlikSayisi = pr0.varliklar.length;
K.karsilastir(pr0, 1000000);
K.basabas(pr0, 1000000, "yatirim", "borc");
esit("profilin borclari degismedi", pr0.borclar.length, borcSayisi, 0);
esit("profilin varliklari degismedi", pr0.varliklar.length, varlikSayisi, 0);
esit("borc anaparasi degismedi", pr0.borclar[0].kalanAnapara, 800000, 0);
esit("ayni girdi ayni sonuc",
  K.karsilastir(pr0, 1000000).secenekler[0].baz,
  K.karsilastir(pr0, 1000000).secenekler[0].baz, 0);

console.log("\nHicbir yerde 'optimum' iddiasi yok");
/* Motor oneri uretmiyor, olcum uretiyor. Ciktida "optimum/en iyi karar"
   gibi bir alan bulunmamali; yalnizca hangi secenegin hangi olcute gore
   onde oldugu. */
var cikti = JSON.stringify(K.karsilastir(borcla(0.032), 1000000));
dogru("ciktida 'optimum' yok", cikti.indexOf("optimum") < 0);
dogru("ciktida 'tavsiye' yok", cikti.indexOf("tavsiye") < 0);
dogru("iki ayri kazanan raporlaniyor",
  "enIyiBaz" in K.karsilastir(borcla(0.032), 1000000) &&
  "enIyiKotumser" in K.karsilastir(borcla(0.032), 1000000));

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (karar laboratuvari kontrolleri)");
