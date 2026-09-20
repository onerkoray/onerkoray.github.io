/*!
 * Tasarruf kimde, finansman ihtiyacı kimde: çalışmanın verileri.
 *
 * KAYNAK
 * ------
 *   Öner, K. (2026). OECD Verileriyle Türkiye Ekonomisinin Finansal
 *   Haritası: Tasarruf, Yatırım, Borçluluk ve Sermaye Akımları. Zenodo.
 *   https://doi.org/10.5281/zenodo.22819842
 *
 * Birincil kaynaklar: OECD Financing SMEs and Entrepreneurs (Tablo 45.1),
 * TÜİK hanehalkı tüketim harcaması ve kurumsal sektör hesapları, TCMB
 * finansal hesaplar ve ödemeler dengesi.
 *
 * TÜRETİLEBİLİR HİÇBİR ŞEY SAKLANMIYOR
 * ------------------------------------
 * Modülde ham gözlemler var: kredi stokları, harcama payları, tasarrufun
 * kurumsal dağılımı, yıl sonu TÜFE. Nominal ve reel büyüme, stoktaki pay
 * ve sepet senaryoları BURADA hesaplanıyor. Böylece çalışmanın sayıları
 * kopyalanmıyor, BAĞIMSIZ OLARAK YENİDEN ÜRETİLİYOR.
 *
 * İKİ FARKLI "FARK" KARIŞTIRILMASIN
 * ---------------------------------
 * Çalışmada iki ayrı fark var ve ikisi de yüzde puanla ölçülüyor:
 *   – PAY FARKI: gıda + konut-kira harcamasının bütçedeki payı, alt ve
 *     üst gelir grubu arasında 28,7 puan ayrışıyor.
 *   – MALİYET FARKI: bu iki kategoride %10'luk ortak fiyat artışının
 *     sepet maliyetine etkisi, iki grup arasında 2,87 puan ayrışıyor.
 * Birincisi bileşim, ikincisi o bileşimin sonucu.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Harita = fabrika();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Reel dönüşümde kullanılan yıl sonu TÜFE (2024). */
  var TUFE_2024 = 44.38;

  /* --- Tablo 2: gayrisafi tasarrufun kurumsal dağılımı, 2024 (GSYH %) */
  var TASARRUF = [
    { sektor: "Mali olmayan şirketler", oran: 18.9 },
    { sektor: "Hanehalkı", oran: 6.9 },
    { sektor: "Mali şirketler", oran: 2.7 },
    { sektor: "Genel devlet", oran: 1.5 }
  ];
  /* Çalışmanın yayımladığı toplam. Bileşenlerin toplamından farklı
     olması yuvarlamadandır ve çalışma bunu kendi notunda söylüyor. */
  var TASARRUF_YAYIN_TOPLAM = 30.1;

  /* Hanehalkının kendi harcanabilir gelirine göre gayrisafi tasarruf
     oranı — yukarıdaki 6,9 ile AYNI ŞEY DEĞİL. */
  var HANE_TASARRUF_ORANI = { 2023: 11.8, 2024: 11.3 };

  /* --- Harcama payları: gıda + konut-kira (izafi kira dahil) -------- */
  var PAYLAR = { alt: 0.636, ust: 0.349 };

  /* Çalışmanın tablosundaki fiyat senaryoları (%). */
  var SENARYOLAR = [5, 10, 20];

  /* --- Tablo 4: KOBİ ve toplam işletme kredileri (milyar TL) -------- */
  var KREDI = [
    { yil: 2022, kobi: 2026.6, toplam: 6033.9, yeniKobi: 1954.3,
      kisaVadePayi: 41.79, kobiTakip: 2.81, toplamTakip: 2.18 },
    { yil: 2023, kobi: 3199.2, toplam: 8958.0, yeniKobi: 3342.8,
      kisaVadePayi: 32.22, kobiTakip: 1.75, toplamTakip: 1.62 },
    { yil: 2024, kobi: 4274.8, toplam: 12153.6, yeniKobi: 4788.8,
      kisaVadePayi: 34.10, kobiTakip: 1.98, toplamTakip: 1.49 }
  ];

  /* ----------------------------------------------------------------- */

  function yil(y) {
    for (var i = 0; i < KREDI.length; i++) if (KREDI[i].yil === y) return KREDI[i];
    return null;
  }

  /* Nominal büyüme (oran). */
  function nominalBuyume(y, alan) {
    var a = yil(y - 1), b = yil(y);
    if (!a || !b) return null;
    return b[alan] / a[alan] - 1;
  }

  /* Reel büyüme: Fisher, yıl sonu TÜFE ile. */
  function reelBuyume(y, alan, tufe) {
    var n = nominalBuyume(y, alan);
    if (n === null) return null;
    return (1 + n) / (1 + (tufe === undefined ? TUFE_2024 : tufe) / 100) - 1;
  }

  /* KOBİ'nin toplam işletme kredi stokundaki payı. */
  function kobiPayi(y) {
    var k = yil(y);
    return k ? k.kobi / k.toplam : null;
  }

  /* Sabit sepet hesabı: iki kategoride ortak fiyat artışının, mevcut
     sepetin maliyetine etkisi. Miktarlar ve diğer fiyatlar sabit. */
  function sepetArtisi(grup, yuzde) {
    return PAYLAR[grup] * (yuzde / 100);
  }
  function sepetFarki(yuzde) {
    return sepetArtisi("alt", yuzde) - sepetArtisi("ust", yuzde);
  }

  /* Bileşim farkı: payların kendisi arasındaki ayrışma (yüzde puan). */
  function payFarki() { return PAYLAR.alt - PAYLAR.ust; }

  /* Bileşenlerin toplamı — yayımlanan toplamla arasındaki yuvarlama
     farkı görünür kalsın diye ayrı hesaplanıyor. */
  function tasarrufBilesenToplami() {
    return TASARRUF.reduce(function (a, s) { return a + s.oran; }, 0);
  }

  /* Tasarrufun en büyük payını hangi sektör tutuyor? Çalışmanın
     çerçevesi buna dayanıyor: tasarrufu yapan ile finansmana ihtiyaç
     duyan aynı birim değil. */
  function enBuyukTasarrufcu() {
    return TASARRUF.slice().sort(function (a, b) { return b.oran - a.oran; })[0];
  }

  return {
    TUFE_2024: TUFE_2024,
    TASARRUF: TASARRUF,
    TASARRUF_YAYIN_TOPLAM: TASARRUF_YAYIN_TOPLAM,
    HANE_TASARRUF_ORANI: HANE_TASARRUF_ORANI,
    PAYLAR: PAYLAR,
    SENARYOLAR: SENARYOLAR,
    KREDI: KREDI,
    yil: yil,
    nominalBuyume: nominalBuyume,
    reelBuyume: reelBuyume,
    kobiPayi: kobiPayi,
    sepetArtisi: sepetArtisi,
    sepetFarki: sepetFarki,
    payFarki: payFarki,
    tasarrufBilesenToplami: tasarrufBilesenToplami,
    enBuyukTasarrufcu: enBuyukTasarrufcu
  };
});
