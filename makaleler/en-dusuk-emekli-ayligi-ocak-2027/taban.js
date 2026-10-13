/*
 * "Ocak 2027 zammı en düşük emekli aylığına yansır mı?" yazısının hesabı.
 *
 * Kaynaklar:
 *   - 5510 sayılı Kanun ek m.19: dosya bazında aylıklar ve ek ödeme toplamı
 *     bu maddedeki tutardan az olamaz; fark Hazineden tahsil edilir. Tutarın
 *     her değişikliği aşağıda kanun numarasıyla (Mevzuat Bilgi Sistemi
 *     dipnotları ve yürürlük tablosu, 13 Ekim 2026'da okundu).
 *   - finans/emekli-zammi-motoru.js: 5510 m.55 artışı (altı aylık TÜFE),
 *     finans/tufe-serisi.js üzerinden. Yazı EYLÜL 2026'ya kadar açıklanmış
 *     veriyle yazıldı; seri burada o aya kesilir ki gece güncellenen seri
 *     yazının rakamlarını kendiliğinden değiştirmesin.
 * Bu dosya yasal tutar uydurmaz; senaryolar varsayım olarak adlandırılır.
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..", "..");
var Z = require(path.join(KOK, "finans", "emekli-zammi-motoru.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));

var VERI_AYI = "2026-09";
/* Seriyi yazının veri ayına kes. */
var SERI = (function () {
  var aylar = {};
  Object.keys(T.aylar).forEach(function (k) { if (k <= VERI_AYI) aylar[k] = T.aylar[k]; });
  var kopya = {};
  Object.keys(T).forEach(function (k) { kopya[k] = T[k]; });
  kopya.aylar = aylar; kopya.sonAy = VERI_AYI;
  return kopya;
})();

/* 5510 ek m.19 tutarı: kanun, kabul tarihi, uygulandığı ilk ödeme dönemi. */
var TABAN = [
  { tutar: 1000, kanun: 7161, kabul: "2019-01-17", donem: "2019-01", donemAdi: "Ocak 2019" },
  { tutar: 1500, kanun: 7226, kabul: "2020-03-25", donem: "2020-04", donemAdi: "Nisan 2020" },
  { tutar: 2500, kanun: 7351, kabul: "2022-01-19", donem: "2022-01", donemAdi: "Ocak 2022" },
  { tutar: 3500, kanun: 7417, kabul: "2022-07-01", donem: "2022-07", donemAdi: "Temmuz 2022" },
  { tutar: 5500, kanun: 7431, kabul: "2023-01-12", donem: "2023-01", donemAdi: "Ocak 2023" },
  { tutar: 7500, kanun: 7447, kabul: "2023-03-30", donem: "2023-04", donemAdi: "Nisan 2023" },
  { tutar: 10000, kanun: 7495, kabul: "2024-01-25", donem: "2024-01", donemAdi: "Ocak 2024" },
  { tutar: 12500, kanun: 7524, kabul: "2024-07-28", donem: "2024-07", donemAdi: "Temmuz 2024" },
  { tutar: 14469, kanun: 7539, kabul: "2025-01-31", donem: "2025-01", donemAdi: "Ocak 2025" },
  { tutar: 16881, kanun: 7553, kabul: "2025-07-10", donem: "2025-07", donemAdi: "Temmuz 2025" },
  { tutar: 20000, kanun: 7573, kabul: "2026-01-23", donem: "2026-01", donemAdi: "Ocak 2026" },
  { tutar: 23552, kanun: 7590, kabul: "2026-07-24", donem: "2026-07", donemAdi: "Temmuz 2026" }
];
var BUGUNKU_TABAN = TABAN[TABAN.length - 1].tutar;

/* Bir ödeme döneminde (YYYY-AA) geçerli taban. */
function tabanDonem(yyyyaa) {
  var t = null;
  TABAN.forEach(function (x) { if (x.donem <= yyyyaa) t = x; });
  return t;
}

/* 5510 m.55 dönemleri (Temmuz 2019 → Temmuz 2026) ve her birinde taban ne oldu. */
function donemler() {
  return Z.gecmis(2019, SERI).slice().reverse().filter(function (d) {
    return d.zamYili > 2019 || d.zamAyi === 7;
  }).map(function (d) {
    var anahtar = d.zamYili + "-" + (d.zamAyi === 1 ? "01" : "07");
    var onceki = d.zamAyi === 1 ? (d.zamYili - 1) + "-12" : d.zamYili + "-06";
    var once = tabanDonem(onceki), sonra = tabanDonem(anahtar);
    return { ad: d.ad, anahtar: anahtar, zam: d.oran, tabanOnce: once.tutar, tabanSonra: sonra.tutar,
      tabanArtisi: sonra.tutar / once.tutar - 1, kanun: sonra.tutar !== once.tutar ? sonra.kanun : null };
  });
}

/* Ara dönem (Nisan) artışları: zam dönemine denk gelmeyen kararlar. */
function araDonemKararlari() { return TABAN.filter(function (x) { return /-04$/.test(x.donem); }); }

/* 2019'da tam tabanda olan biri: kendi aylığı her dönem yalnız m.55 oranıyla artar. */
function modelEmekli() {
  var D = donemler(), carpan = 1;
  D.forEach(function (d) { carpan *= 1 + d.zam; });
  var kendi = TABAN[0].tutar * carpan;
  return { carpan: carpan, kendiAyligi: kendi, tabanOrani: kendi / BUGUNKU_TABAN, tabanCarpani: BUGUNKU_TABAN / TABAN[0].tutar };
}

/* Taban dondurulsa, kendi aylığı tabanı kaç dönem sonra geçer (her dönem aynı zamla). */
function gecmeDonemi(kendi, zam) {
  var n = 0, a = kendi;
  while (a <= BUGUNKU_TABAN) { a *= 1 + zam; n++; if (n > 100) throw new Error("geçmiyor"); }
  return n;
}

/* Ocak 2027: açıklanan aylar ve senaryolar. */
function ocak2027() {
  var d = Z.donem(2027, 1, SERI);
  var gy = Z.gecenYilAyniAylar(d, SERI);
  return {
    donem: d, kesinBirikim: d.birikim, eksik: d.eksikSayisi,
    senaryolar: [
      { ad: "Kalan üç ay her biri %1", oran: Z.senaryo(d, 0.01) },
      { ad: "Kalan üç ay geçen yılın aynı aylarıyla", oran: Z.senaryo(d, gy), aylar: gy },
      { ad: "Kalan üç ay her biri %2", oran: Z.senaryo(d, 0.02) }
    ]
  };
}

/* Ocak 2027'de ek ödeme dahil toplam aylığı A olan dosyanın ödemesi.
   tabanArtisi: tabanın Ocak'ta artış oranı (0 = kanun çıkmazsa). */
function ocakOdemesi(A, zam, tabanArtisi) {
  var yeniTaban = BUGUNKU_TABAN * (1 + (tabanArtisi || 0));
  var once = Math.max(A, BUGUNKU_TABAN), sonra = Math.max(A * (1 + zam), yeniTaban);
  return { once: once, sonra: sonra, artis: sonra - once, oran: sonra / once - 1 };
}

/* Taban değişmezse Ocak zammının hiç yansımadığı toplam aylık sınırı. */
function esik(zam) { return BUGUNKU_TABAN / (1 + zam); }

module.exports = {
  Z: Z, SERI: SERI, VERI_AYI: VERI_AYI, TABAN: TABAN, BUGUNKU_TABAN: BUGUNKU_TABAN,
  tabanDonem: tabanDonem, donemler: donemler, araDonemKararlari: araDonemKararlari,
  modelEmekli: modelEmekli, gecmeDonemi: gecmeDonemi, ocak2027: ocak2027, ocakOdemesi: ocakOdemesi, esik: esik
};
