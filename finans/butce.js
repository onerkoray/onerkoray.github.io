/*!
 * Merkezî yönetim bütçesi — OVP hedefleri ve bütçe teklifi.
 *
 * Kaynak: Orta Vadeli Program (2027-2029), Cumhurbaşkanı Kararı 11752,
 * Resmî Gazete 6 Eylül 2026, sayı 33362 (1. mükerrer):
 *   Tablo 1.1 Temel Ekonomik Büyüklükler, Tablo 1.6 Merkezî Yönetim Bütçesi.
 * Tutarlar milyar TL, tabloda yazıldığı gibi; GSYH milyar TL, nüfus ve
 * istihdam bin kişi. 2025 gerçekleşme, 2026 gerçekleşme tahmini, 2027-2029
 * program.
 *
 * teklif: 2027 Merkezî Yönetim Bütçe Kanunu Teklifi Meclis'e sunulunca
 * (Anayasa m.162: mali yıl başından en az 75 gün önce, yani en geç
 * 17 Ekim 2026) aynı kalemlerle doldurulacak. O zamana kadar null.
 *
 * Bu dosyada hesap yok, yalnız tablo ve tablonun kendi kimlikleri
 * (kalemlerin toplamı, denge = gelir − gider) için yardımcı. Testler
 * makaleler/butce-2027-faiz-vergi/sayi-testi.js içinde.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/makaleler/butce-2027-faiz-vergi/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Butce = fabrika();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var YILLAR = [2025, 2026, 2027, 2028, 2029];
  var DURUM = { 2025: "gerçekleşme", 2026: "gerçekleşme tahmini", 2027: "program", 2028: "program", 2029: "program" };

  /* Tablo 1.6 — milyar TL. Kalem sırası tablodaki gibi. */
  var OVP = {
    harcamalar:         [14640.4, 19660.1, 27273.0, 32139.4, 36519.1],
    faizHaricHarcama:   [12586.0, 16835.2, 23298.0, 27445.6, 31274.3],
    personel:           [3634.0, 5090.3, 6318.5, 7715.4, 9036.2],
    sgkDevletPrimi:     [454.5, 645.2, 798.5, 978.1, 1100.4],
    malHizmet:          [1072.9, 1512.3, 2184.3, 2524.8, 2787.8],
    cariTransfer:       [5408.6, 7045.8, 10240.1, 12204.4, 13606.8],
    sermayeGideri:      [1345.9, 1782.3, 1851.7, 2346.6, 2923.4],
    sermayeTransferi:   [360.1, 325.1, 750.4, 408.3, 446.9],
    borcVerme:          [310.0, 434.3, 613.0, 629.2, 646.9],
    yedekOdenek:        [0.0, 0.0, 541.6, 638.8, 725.9],
    faiz:               [2054.4, 2824.9, 3975.0, 4693.9, 5244.8],
    gelirler:           [12826.9, 17028.2, 23408.0, 27968.7, 32159.5],
    vergi:              [11049.8, 14585.7, 19906.0, 23973.1, 27718.5],
    digerGelir:         [1777.0, 2442.5, 3502.0, 3995.5, 4441.1],
    denge:              [-1813.5, -2631.9, -3865.0, -4170.8, -4359.5],
    faizDisiDenge:      [240.8, 193.0, 110.0, 523.1, 885.2]
  };

  /* Tablo 1.1 — GSYH milyar TL (cari), nüfus ve istihdam bin kişi,
     TÜFE yıl sonu ve GSYH deflatörü yüzde. */
  var MAKRO = {
    gsyh:      [63241, 85346, 111207, 133184, 153141],
    nufus:     [85825, 86321, 86856, 87252, 87636],
    istihdam:  [32566, 32579, 33236, 33925, 34711],
    tufe:      [30.9, 28.4, 21.0, 13.5, 9.0],
    deflator:  [36.5, 30.6, 25.0, 14.5, 9.5]
  };

  var KAYNAK = {
    ovp: "Orta Vadeli Program (2027-2029), Tablo 1.1 ve 1.6 — Resmî Gazete 06.09.2026, 33362 (1. mükerrer), Cumhurbaşkanı Kararı 11752",
    ovpUrl: "https://www.resmigazete.gov.tr/eskiler/2026/09/20260906M1-1.pdf",
    teklif: null,
    teklifUrl: null
  };

  /* 2027 Merkezî Yönetim Bütçe Kanunu Teklifi: OVP ile aynı adlar, milyar TL,
     yalnız 2027. Sunulunca doldurulur ve KAYNAK.teklif yazılır. */
  var TEKLIF = null;

  function indeks(yil) {
    var i = YILLAR.indexOf(Number(yil));
    if (i < 0) throw new Error("Bütçe: " + yil + " yılı tabloda yok (" + YILLAR[0] + "–" + YILLAR[YILLAR.length - 1] + ").");
    return i;
  }

  /* Bir yılın kalemleri. kaynak: "ovp" (varsayılan) ya da "teklif". */
  function yil(y, kaynak) {
    if (kaynak === "teklif") {
      if (!TEKLIF) return null;
      if (Number(y) !== 2027) throw new Error("Bütçe: teklif yalnız 2027 için.");
      return Object.assign({ yil: 2027, durum: "teklif" }, TEKLIF);
    }
    var i = indeks(y), o = { yil: Number(y), durum: DURUM[y] };
    Object.keys(OVP).forEach(function (k) { o[k] = OVP[k][i]; });
    Object.keys(MAKRO).forEach(function (k) { o[k] = MAKRO[k][i]; });
    return o;
  }

  return {
    YILLAR: YILLAR.slice(),
    KAYNAK: KAYNAK,
    yil: yil,
    teklifVar: function () { return !!TEKLIF; }
  };
});
