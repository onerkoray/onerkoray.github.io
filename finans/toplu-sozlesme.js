/*!
 * Kamu görevlileri toplu sözleşme maaş artış oranları (altı aylık dönemler).
 *
 * Memur maaşları ve 5434 sayılı Kanun'a tabi memur emeklilerinin aylıkları
 * her altı ayda toplu sözleşme oranı kadar artar. O altı ayın TÜFE artışı
 * toplu sözleşme oranını aşarsa aradaki fark bir sonraki dönemin başında
 * "enflasyon farkı" olarak eklenir.
 *
 * KAYNAKLAR
 *   7. dönem (2024–2025): Kamu Görevlileri Hakem Kurulu Kararı (Resmî
 *     Gazete, Eylül 2023; oranlar AA haberinden teyitli) — 2024: %15 + %10,
 *     2025: %6 + %5. RG sayısı teyit edilemediği için yazılmadı.
 *   8. dönem (2026–2027): Kamu Görevlileri Hakem Kurulu Kararı,
 *     RG 27 Ağustos 2025 (sayı 32561) — 2026: %11 + %7, 2027: %5 + %4.
 *
 * DOĞRULAMA: bu oranlar ve TÜFE serisiyle hesaplanan zam, açıklanmış iki
 * memur zammını veriyor (Ocak 2025 %11,54 · Temmuz 2025 %15,57) —
 * finans/emekli-zammi-test.js.
 *
 * 9. dönem (2028–2029) Ağustos 2027'de belirlenecek. O güne kadar
 * Ocak 2028 hesaplanamaz; motor bunu açıkça söyler, sayfa üreteci CI'ı
 * kırmızıya çevirir.
 *
 * Anahtar: "YYYY-1" ilk yarı (Ocak–Haziran), "YYYY-2" ikinci yarı.
 * Oranlar kesir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.TopluSozlesme = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    oranlar: {
      "2024-1": 0.15, "2024-2": 0.10,
      "2025-1": 0.06, "2025-2": 0.05,
      "2026-1": 0.11, "2026-2": 0.07,
      "2027-1": 0.05, "2027-2": 0.04
    },
    kaynaklar: {
      "7": "Kamu Görevlileri Hakem Kurulu Kararı (Resmî Gazete, Eylül 2023)",
      "8": "Kamu Görevlileri Hakem Kurulu Kararı, RG 27.8.2025/32561"
    }
  };
});
