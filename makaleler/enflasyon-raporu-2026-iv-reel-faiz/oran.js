/*!
 * TCMB Enflasyon Raporu 2026-IV (12 Kasım 2026) ve politika faizi:
 * ileriye dönük ve gerçekleşen reel faiz, ara hedef değişikliğinin fiyat
 * düzeyine etkisi, mevduatta başabaş faiz. Saf modül; gövde
 * tools/kasim-2026-gundem-yazilari.js, sınama sayi-testi.js.
 *
 * KAYNAKLAR (23 Kasım 2026'da okundu)
 *   Enflasyon Raporu 2026-IV, Bölüm 3 "Orta Vadeli Öngörüler" (3b26_iv.pdf),
 *     s.59–61: ekim TÜFE %29,8; tahminler 2026 sonu %29,5, 2027 sonu %21,
 *     2028 sonu %13,5, 2029 %9, orta vade %5; ara hedefler 2026 %24
 *     (korundu), 2027 %15 → %21, 2028 %9 → %13,5; tahmin aralığı paylaşımına
 *     ER 2026-II'den beri ara verildi.
 *   PPK basın duyurusu 2026-45 (22 Ekim 2026): bir hafta vadeli repo %37 → %36;
 *     gecelik borç verme %39, borç alma %34,5. Sonraki PPK: 10 Aralık 2026.
 *   Mevduat stopajı: finans/varlik-motoru.js (GİB rehberi; 6 aya kadar vade).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../../finans/varlik-motoru.js"));
  else kok.EnflasyonRaporu2026IV = fabrika(kok.VarlikMotoru);
})(typeof self !== "undefined" ? self : this, function (V) {
  "use strict";

  var RAPOR = { ad: "Enflasyon Raporu 2026-IV", tarih: "2026-11-12", sayfa: "59–61" };
  var PPK = { tarih: "2026-10-22", duyuru: "2026-45", faiz: 36, onceki: 37, borcVerme: 39, borcAlma: 34.5, sonraki: "2026-12-10" };
  var EKIM_TUFE = 29.8;
  var TAHMIN = { 2026: 29.5, 2027: 21, 2028: 13.5, 2029: 9, ortaVade: 5 };
  var ARA_HEDEF = { yeni: { 2026: 24, 2027: 21, 2028: 13.5 }, eski: { 2026: 24, 2027: 15, 2028: 9 } };
  var STOPAJ_TARIH = "2026-11-23";

  /* Fisher: (1 + i) / (1 + π) − 1, yüzde. */
  function reel(faiz, enf) { return ((1 + faiz / 100) / (1 + enf / 100) - 1) * 100; }
  function ileriye() { return reel(PPK.faiz, TAHMIN[2027]); }            // ex ante: 2027 sonu tahmini
  function gerceklesen() { return reel(PPK.faiz, EKIM_TUFE); }           // ex post: ekim TÜFE
  /* 2026 sonundaki 100 TL'lik sepetin 2028 sonu fiyatı, ara hedeflere göre. */
  function fiyatDuzeyi(yol) { return 100 * (1 + yol[2027] / 100) * (1 + yol[2028] / 100); }
  function duzeyFarki() { return (fiyatDuzeyi(ARA_HEDEF.yeni) / fiyatDuzeyi(ARA_HEDEF.eski) - 1) * 100; }
  /* 6 ay vadeli mevduat, yılda iki kez yenilenir, faiz anaparaya eklenir:
     net yıllık getiri (1 + r/2 × (1 − s))² − 1. Başabaş brüt r, net getiri = hedef enflasyon. */
  function stopaj() { return V.stopaj(STOPAJ_TARIH).oran; }
  function netYillik(brut) { var s = stopaj() / 100; return (Math.pow(1 + brut / 100 / 2 * (1 - s), 2) - 1) * 100; }
  function basabasBrut(enf) { var s = stopaj() / 100; return (Math.sqrt(1 + enf / 100) - 1) * 2 / (1 - s) * 100; }

  return {
    RAPOR: RAPOR, PPK: PPK, EKIM_TUFE: EKIM_TUFE, TAHMIN: TAHMIN, ARA_HEDEF: ARA_HEDEF,
    reel: reel, ileriye: ileriye, gerceklesen: gerceklesen, fiyatDuzeyi: fiyatDuzeyi,
    duzeyFarki: duzeyFarki, stopaj: stopaj, netYillik: netYillik, basabasBrut: basabasBrut
  };
});
