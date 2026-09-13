#!/usr/bin/env node
/*
 * Kisisel enflasyon motoru regresyonlari.
 *
 * NEDEN: bu arac bir ENDEKS hesapliyor ve endekslerin hatalari sessizdir.
 * Agirlik yanlis tarafa konursa (Paasche/Laspeyres karismasi) sonuc makul
 * gorunur, yalnizca sistematik olarak yanlis olur. Asagidaki kontroller
 * yontemi ve katki ayristirmasinin toplaminini sabitliyor.
 */
"use strict";
var K = require("./kisisel-enflasyon-motoru.js");
var E = require("./enflasyon-motoru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 1e-6 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

/* Elle hesaplanabilir sepet: taban 10.000, iki kalem. */
var BASIT = [
  { ad: "Kira", once: 6000, simdi: 9000 },      // +%50, agirlik 0,6 -> katki 0,30
  { ad: "Market", once: 4000, simdi: 5000 }     // +%25, agirlik 0,4 -> katki 0,10
];

/* ------------------------------------------------------------------ */
console.log("Elle dogrulanabilir sepet");
var r = K.analiz({ kalemler: BASIT });
esit("kira agirligi 0,6", r.katkilar.filter(function (k) { return k.ad === "Kira"; })[0].agirlik, 0.6);
esit("kira degisimi %50", r.katkilar.filter(function (k) { return k.ad === "Kira"; })[0].degisim, 0.5);
esit("kira katkisi 0,30", r.katkilar.filter(function (k) { return k.ad === "Kira"; })[0].katki, 0.30);
esit("market katkisi 0,10", r.katkilar.filter(function (k) { return k.ad === "Market"; })[0].katki, 0.10);
esit("kisisel enflasyon %40", r.kisiselEnflasyon, 0.40);
/* Hicbir kalemin miktari degismediyse fiyat endeksi ile harcama degisimi
   OZDESTIR; bu bir tesaduf degil cebir. Ilk surumdeki hata, bu ozdesligin
   HER durumda kurulmasiydi -- miktar degisse bile. */
esit("sabit sepette fiyat endeksi = harcama degisimi",
  r.kisiselEnflasyon, r.harcamaDegisimi, 1e-4);
esit("sepet etkisi sifir", r.sepetEtkisi, 0, 1e-4);

/* ------------------------------------------------------------------ */
console.log("\nDEGISMEZ — katkilar toplami ORANA esittir");
/* Ayristirmanin tek iddiasi bu. Tutmuyorsa "bunun N puani kiradan
   geliyor" cumlesi yalan olur. */
[BASIT,
 [{ ad: "A", once: 1, simdi: 3 }, { ad: "B", once: 999, simdi: 1000 }],
 [{ ad: "X", once: 5000, simdi: 4000 }, { ad: "Y", once: 5000, simdi: 12000 }]
].forEach(function (sepet, i) {
  var x = K.analiz({ kalemler: sepet });
  var toplam = x.katkilar.reduce(function (a, k) { return a + k.katki; }, 0);
  esit("sepet " + (i + 1) + ": katkilar toplami = kisisel enflasyon",
    toplam, x.kisiselEnflasyon, 1e-4);
});

console.log("\nDEGISMEZ — agirliklar toplami 1");
[BASIT, [{ ad: "A", once: 7, simdi: 9 }, { ad: "B", once: 13, simdi: 11 },
         { ad: "C", once: 80, simdi: 100 }]].forEach(function (sepet, i) {
  var x = K.analiz({ kalemler: sepet });
  var t = x.katkilar.filter(function (k) { return !k.yeniMi; })
    .reduce(function (a, k) { return a + k.agirlik; }, 0);
  esit("sepet " + (i + 1) + ": agirliklar 1'e toplaniyor", t, 1, 1e-4);
});

/* ------------------------------------------------------------------ */
console.log("\nLASPEYRES — agirlik GECEN YILIN, bugunun degil");
/* Ayrim burada gorunur: pahalanan kalemin BUGUNKU payi buyuktur, bu yuzden
   bugunun paylariyla (Paasche) agirliklandirmak farkli bir sayi verir.
   Ikisi karisirsa bu test yakalar. */
var p = K.analiz({ kalemler: BASIT });
var bugunToplam = 9000 + 5000;
var paasche = (9000 / bugunToplam) * 0.5 + (5000 / bugunToplam) * 0.25;
dogru("sonuc Laspeyres, Paasche degil", Math.abs(p.kisiselEnflasyon - paasche) > 0.01);
/* Ilk yazimda burada "Paasche daha DUSUK cikar" yaziyordu ve dustu.
   O beklenti IKAME varsayimindan geliyor: tuketici pahalanandan kacinirsa
   miktar payi duser. Burada miktarlar sabit; hizli artan kalemin BUGUNKU
   harcama payi BUYUDUGU icin Paasche daha YUKSEK cikiyor. */
esit("bu sepette Paasche daha YUKSEK", paasche > p.kisiselEnflasyon ? 1 : 0, 1, 0);

/* ------------------------------------------------------------------ */
console.log("\nHarcama degisimi, enflasyondan FARKLI olabilir");
/* Miktar degisirse ikisi ayrisir: ayni sepette daha az tuketmek harcamayi
   dusurur ama fiyatlar yine artmistir. */
var mik = K.analiz({ kalemler: [
  { ad: "Kira", once: 6000, simdi: 9000 },
  { ad: "Disarida yemek", once: 4000, simdi: 2000, miktarDegisti: true }
] });
esit("harcama degisimi %10", mik.harcamaDegisimi, 0.10, 1e-4);
/* Fiyat endeksi yalnizca miktari degismeyen kalemden (kira) kuruluyor. */
esit("fiyat endeksi = kiranin degisimi %50", mik.kisiselEnflasyon, 0.50, 1e-4);
dogru("fiyat endeksi harcama degisiminden FARKLI",
  Math.abs(mik.kisiselEnflasyon - mik.harcamaDegisimi) > 0.001);
esit("sepet etkisi = harcama - fiyat", mik.sepetEtkisi,
  mik.harcamaDegisimi - mik.kisiselEnflasyon, 1e-4);
dogru("sepet etkisi negatif (daha az tuketildi)", mik.sepetEtkisi < 0);
dogru("miktari degisen kalem isaretlendi", mik.miktarDegisenVar === true);
esit("sabit sepet, tabanin %60'i", mik.sabitSepetPayi, 0.6, 1e-4);

console.log("\nYeni kalem (gecen yil yoktu) enflasyona girmez");
var yeni = K.analiz({ kalemler: [
  { ad: "Kira", once: 10000, simdi: 15000 },
  { ad: "Spor salonu", once: 0, simdi: 2000 }
] });
dogru("yeni kalem isaretlendi", yeni.yeniKalemVar === true);
esit("yeni kalemin katkisi sifir",
  yeni.katkilar.filter(function (k) { return k.ad === "Spor salonu"; })[0].katki, 0);
esit("enflasyon yalnizca kiradan %50", yeni.kisiselEnflasyon, 0.50, 1e-4);
/* Ama harcama degisimi yeni kalemi GORUR: 10.000 -> 17.000 */
esit("harcama degisimi %70", yeni.harcamaDegisimi, 0.70, 1e-4);

/* ------------------------------------------------------------------ */
console.log("\nDusen fiyat negatif katki verir");
var dus = K.analiz({ kalemler: [
  { ad: "Kira", once: 5000, simdi: 7500 },
  { ad: "Elektronik", once: 5000, simdi: 4000 }
] });
esit("elektronik katkisi -0,10",
  dus.katkilar.filter(function (k) { return k.ad === "Elektronik"; })[0].katki, -0.10);
esit("net enflasyon %15", dus.kisiselEnflasyon, 0.15, 1e-4);

/* ------------------------------------------------------------------ */
console.log("\nEn buyuk katki dogru kalemi gosteriyor");
esit("en buyuk katki Kira", r.enBuyukKatki.ad === "Kira" ? 1 : 0, 1, 0);
dogru("katkilar buyukten kucuge sirali", r.katkilar.every(function (k, i) {
  return i === 0 || k.katki <= r.katkilar[i - 1].katki + 1e-12;
}));
/* En BUYUK PAY ile en buyuk KATKI ayni kalem olmak zorunda degil. */
var ayri = K.analiz({ kalemler: [
  { ad: "Buyuk kalem", once: 9000, simdi: 9450 },   // pay 0,9 ama +%5  -> katki 0,045
  { ad: "Kucuk kalem", once: 1000, simdi: 3000 }    // pay 0,1 ama +%200 -> katki 0,20
] });
esit("en buyuk katki, en buyuk kalem DEGIL",
  ayri.enBuyukKatki.ad === "Kucuk kalem" ? 1 : 0, 1, 0);

/* ------------------------------------------------------------------ */
console.log("\nGelir tarafi — zam enflasyonu gecti mi");
var z = K.analiz({ kalemler: BASIT, gelirOnce: 50000, gelirSimdi: 65000 });
esit("zam %30", z.gelirArtisi, 0.30, 1e-6);
/* Reel degisim BOLME ile: 1,30 / 1,40 - 1 = -%7,14 */
esit("reel degisim bolme ile (-%7,14)", z.reelDegisim, 1.30 / 1.40 - 1, 1e-4);
dogru("cikarma ile bulunandan FARKLI",
  Math.abs(z.reelDegisim - (0.30 - 0.40)) > 0.005);
dogru("zam yetmedi", z.gelirYetti === false);
esit("gereken gelir 50.000 x 1,40", z.gerekenGelir, 70000, 0.5);
esit("gelir acigi 5.000", z.gelirAcigi, 5000, 0.5);

var yeterli = K.analiz({ kalemler: BASIT, gelirOnce: 50000, gelirSimdi: 75000 });
dogru("zam yetti", yeterli.gelirYetti === true);
dogru("reel degisim pozitif", yeterli.reelDegisim > 0);

console.log("\nResmi oranla karsilastirma");
/* Resmi oran zammin ALTINDA, kisisel oran USTUNDE: aracin tezi tam burada.
   Ayni zam, resmi olcutle "enflasyonun ustunde", kisisel olcutle altinda. */
var kar = K.analiz({ kalemler: BASIT, gelirOnce: 50000, gelirSimdi: 65000, resmiOran: 0.25 });
esit("resmi fark 15 puan", kar.resmiFark, 0.15, 1e-4);
/* Ayni zam, resmi orana gore POZITIF reel cikiyor -- aracin tezi bu. */
dogru("resmi oranla reel pozitif", kar.reelResmiyle > 0);
dogru("kisisel oranla reel negatif", kar.reelDegisim < 0);

/* ------------------------------------------------------------------ */
console.log("\nAlim gucu");
var a = K.alimGucu(100000, 0.40, 5);
esit("bugun tam tutar", a.seri[0].deger, 100000, 0.5);
esit("1 yil sonra 100.000 / 1,40", a.seri[1].deger, 100000 / 1.4, 0.5);
esit("5 yil sonra", a.sonDeger, 100000 / Math.pow(1.4, 5), 0.5);
dogru("seri azaliyor", a.seri.every(function (n, i) {
  return i === 0 || n.deger <= a.seri[i - 1].deger;
}));
/* Yarilanma suresi enflasyon motorundakiyle ayni olmali. */
esit("yarilanma = ln2 / ln(1+o)", a.yarilanma, Math.log(2) / Math.log(1.4), 0.01);
esit("sifir enflasyonda deger degismiyor", K.alimGucu(1000, 0, 10).sonDeger, 1000, 0.01);
dogru("sifir enflasyonda yarilanma yok", K.alimGucu(1000, 0, 10).yarilanma === null);

/* ------------------------------------------------------------------ */
console.log("\nGecersiz girdi");
dogru("bos sepette hata", !!K.analiz({ kalemler: [] }).hata);
dogru("gecen yil tamami sifirsa hata",
  !!K.analiz({ kalemler: [{ ad: "A", once: 0, simdi: 100 }, { ad: "B", once: 0, simdi: 50 }] }).hata);
dogru("gelir verilmezse alanlar null",
  K.analiz({ kalemler: BASIT }).reelDegisim === null);
dogru("resmi oran verilmezse null",
  K.analiz({ kalemler: BASIT }).resmiFark === null);

console.log("\nEnflasyon motoruyla tutarlilik");
/* Motor oranlari 4 basamaga yuvarliyor (gosterim icin); tolerans o
   inceligi karsilamali. */
esit("reel, enflasyon motorununkiyle ayni",
  z.reelDegisim, E.reel(0.30, z.kisiselEnflasyon), 1e-4);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (kisisel enflasyon kontrolleri)");
