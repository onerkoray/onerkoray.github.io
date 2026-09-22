#!/usr/bin/env node
/*!
 * Teklif karşılaştırma testleri.
 *
 * EN KRİTİK İDDİA
 * ---------------
 * Net sözleşmede net yıl boyunca SABİT kalmalı. Kalmıyorsa modül
 * nettenBruteYil()'i yanlış kullanıyor demektir ve araç iki teklifi
 * yanlış karşılaştırır — hangi işi kabul edeceğine bakan birine
 * yanlış cevap vermek, hiç cevap vermemekten kötüdür.
 *
 * İKİNCİ İDDİA: TERSİNME
 * ----------------------
 * "Ocakta önde olan yılda geride kalabilir" iddiası ölçümle kuruldu.
 * Test hem böyle bir çiftin VAR olduğunu hem de tersinmenin gereksiz
 * yere bildirilmediğini sınıyor.
 *
 * Kullanım: node teklif-karsilastirma/test.js
 */
"use strict";

var path = require("path");
var T = require(path.join(__dirname, "teklif.js"));
var B = require(path.join(__dirname, "..", "bordro", "motor.js"));

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}
function esit(ad, a, b, tol) {
  dogru(ad, Math.abs(a - b) <= (tol === undefined ? 0.01 : tol), a + " != " + b);
}

var YIL = B.sonYil();
console.log("Teklif karşılaştırma — " + YIL + "\n");

/* --- 1. Net sözleşmede net sabit kalmalı --------------------------- */
[40000, 75000, 150000].forEach(function (n) {
  var o = T.ozet({ ad: "net", tur: "net", tutar: n }, YIL);
  var sapma = 0;
  o.aylar.forEach(function (a) { sapma = Math.max(sapma, Math.abs(a.net - n)); });
  dogru("net sözleşmede net sabit: " + n + " TL", sapma <= 0.02, "sapma " + sapma);
  esit("net sözleşmede yıllık net = 12 x net: " + n, o.yilNet, n * 12, 0.25);
});

/* --- 2. Brüt sözleşmede net DÜŞMELİ -------------------------------- */
[75000, 150000].forEach(function (b) {
  var o = T.ozet({ ad: "brut", tur: "brut", tutar: b }, YIL);
  dogru("brüt sözleşmede aralık neti ocaktan düşük: " + b,
    o.aralikNet < o.ocakNet - 1,
    o.ocakNet + " -> " + o.aralikNet);
  dogru("brüt sözleşmede brüt her ay aynı: " + b,
    o.aylar.every(function (a) { return Math.abs(a.brut - b) < 0.005; }));
});

/* --- 3. Motorla tutarlılık ----------------------------------------- */
(function () {
  var b = 90000;
  var motor = B.hesaplaYil(b, YIL);
  var o = T.ozet({ ad: "x", tur: "brut", tutar: b }, YIL);
  esit("yıllık net motorun toplamıyla aynı", o.yilNet, motor.toplam.net, 0.02);
  esit("işveren maliyeti motorunkiyle aynı",
    o.isverenMaliyeti, motor.toplam.isverenMaliyeti, 0.02);
  esit("ortalama net motorunkiyle aynı", o.ortalamaNet, motor.toplam.ortalamaNet, 0.02);
})();

/* --- 4. TERSİNME gerçekten var mı ---------------------------------- */
(function () {
  /* Ölçümle bulunmuş bir çift: brüt 90.000 vs net 63.988. */
  var r = T.karsilastir({
    yil: YIL,
    a: { ad: "Brüt teklif", tur: "brut", tutar: 90000 },
    b: { ad: "Net teklif", tur: "net", tutar: 63988 }
  });
  dogru("ocakta brüt teklif önde", r.fark.ocakNet > 0, String(r.fark.ocakNet));
  dogru("yılda net teklif önde", r.fark.yilNet < 0, String(r.fark.yilNet));
  dogru("tersinme bildiriliyor", r.fark.tersinme === true);
  dogru("kazanan ikinci teklif", r.fark.kazanan === "b");
})();

/* --- 5. Tersinme OLMAYAN durumda bildirilmemeli --------------------- */
(function () {
  var r = T.karsilastir({
    yil: YIL,
    a: { ad: "Yüksek", tur: "brut", tutar: 120000 },
    b: { ad: "Düşük", tur: "brut", tutar: 60000 }
  });
  dogru("açık farkta tersinme YOK", r.fark.tersinme === false);
  dogru("açık farkta kazanan birinci", r.fark.kazanan === "a");
  dogru("ocak ve yıl aynı yönde",
    (r.fark.ocakNet > 0) === (r.fark.yilNet > 0));
})();

/* --- 6. Aynı teklif: fark sıfır, kazanan yok ------------------------ */
(function () {
  var t = { ad: "x", tur: "brut", tutar: 80000 };
  var r = T.karsilastir({ yil: YIL, a: t, b: { ad: "y", tur: "brut", tutar: 80000 } });
  esit("aynı teklifte yıl farkı sıfır", r.fark.yilNet, 0);
  dogru("aynı teklifte kazanan yok", r.fark.kazanan === null);
  dogru("aynı teklifte tersinme yok", r.fark.tersinme === false);
})();

/* --- 7. Dip ayı ve dilim yolu -------------------------------------- */
(function () {
  var o = T.ozet({ ad: "x", tur: "brut", tutar: 150000 }, YIL);
  dogru("dip ayı 0-11 arasında", o.dipAy >= 0 && o.dipAy <= 11, String(o.dipAy));
  dogru("dip net, aylık netlerin en küçüğü",
    o.aylar.every(function (a) { return a.net >= o.dipNet - 0.005; }));
  dogru("dilim yolu tekrarsız",
    o.dilimYolu.every(function (d, i) { return i === 0 || d !== o.dilimYolu[i - 1]; }),
    JSON.stringify(o.dilimYolu));
  dogru("net sözleşmede de dilim yolu üretiliyor",
    T.ozet({ ad: "y", tur: "net", tutar: 100000 }, YIL).dilimYolu.length >= 1);
})();

/* --- 8. Girdi doğrulama -------------------------------------------- */
function patlar(f) { try { f(); return false; } catch (e) { return true; } }
dogru("tutarsız çağrı hata veriyor",
  patlar(function () { T.karsilastir({ a: { tur: "brut" }, b: { tur: "net", tutar: 1 } }); }));
dogru("geçersiz tür hata veriyor",
  patlar(function () {
    T.karsilastir({ a: { tur: "elde", tutar: 1 }, b: { tur: "net", tutar: 1 } });
  }));
dogru("negatif tutar hata veriyor",
  patlar(function () {
    T.karsilastir({ a: { tur: "brut", tutar: -5 }, b: { tur: "net", tutar: 1 } });
  }));

/* --- 9. Mutasyonun actigi iki acik ---------------------------------
   Ikisi de mutasyon kactiktan SONRA eklendi. */

/* (a) TERSINME IKI YONLU. Ilk testler yalnizca "birinci teklif ocakta
       onde, ikincisi yilda onde" durumunu sinadi; kosulu tek yone
       indiren mutasyon bu yuzden kacti. Ayni cift ters sirayla. */
(function () {
  var r = T.karsilastir({
    yil: YIL,
    a: { ad: "Net teklif", tur: "net", tutar: 63988 },
    b: { ad: "Brut teklif", tur: "brut", tutar: 90000 }
  });
  dogru("ters sirada da ocakta ikinci teklif onde", r.fark.ocakNet < 0,
    String(r.fark.ocakNet));
  dogru("ters sirada da yilda birinci teklif onde", r.fark.yilNet > 0,
    String(r.fark.yilNet));
  dogru("ters sirada da tersinme bildiriliyor", r.fark.tersinme === true);
  dogru("ters sirada kazanan birinci", r.fark.kazanan === "a");
})();

/* (b) DIP AYI EN ERKEN olmali. 348 brut degerinde en dusuk neti
       birden cok ay paylasiyor; 47.500 TL'de Kasim ve Aralik esit.
       Sorulan sey netin NE ZAMAN dibe vurdugu, en son ne zaman esit
       kaldigi degil. Dip secimini son aya kaydiran mutasyon, esitlik
       sinanmadigi icin kacmisti. */
(function () {
  var o = T.ozet({ ad: "x", tur: "brut", tutar: 47500 }, YIL);
  var net = o.aylar.map(function (a) { return a.net; });
  var enKucuk = Math.min.apply(null, net);
  var esitAylar = [];
  net.forEach(function (v, i) {
    if (Math.abs(v - enKucuk) < 0.005) esitAylar.push(i);
  });
  dogru("KONTROL: 47.500 TL'de dip birden cok ayda esit",
    esitAylar.length > 1, JSON.stringify(esitAylar));
  dogru("dip ayi, esit aylarin EN ERKENI",
    o.dipAy === esitAylar[0],
    "dipAy=" + o.dipAy + " beklenen=" + esitAylar[0]);
})();

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: iki sözleşme türü tanımlı", T.TURLER.length === 2);
dogru("KONTROL: modül yasal sabit tanımlamıyor", (function () {
  var kod = require("fs").readFileSync(path.join(__dirname, "teklif.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  return (kod.match(/\b\d{4,}\b/g) || []).length === 0;
})(), "koda gömülü dört haneli sayı var");
/* Tersinme testi anlamlı mı: böyle bir çift bulunamıyorsa 4. bölüm
   hiçbir şey sınamıyor demektir. */
dogru("KONTROL: net ve brüt sözleşme yıllık toplamı farklı üretiyor",
  Math.abs(T.ozet({ ad: "a", tur: "net", tutar: 60000 }, YIL).yilNet -
           T.ozet({ ad: "b", tur: "brut", tutar: 60000 }, YIL).yilNet) > 1000);

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (teklif karşılaştırma)");
process.exit(hata ? 1 : 0);
