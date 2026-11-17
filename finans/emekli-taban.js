/*!
 * En düşük emekli aylığı (5510 sayılı Kanun ek m.19) — tutarın geçmişi.
 *
 * Dosya bazında aylıklar ve ek ödeme toplamı bu maddedeki tutardan az olamaz;
 * fark Hazineden karşılanır. Her değişiklik kanun numarası, kabul tarihi ve
 * uygulandığı ilk ödeme dönemiyle (Mevzuat Bilgi Sistemi dipnotları ve
 * yürürlük tablosu, 13 Ekim 2026'da okundu).
 *
 * Tek kaynak: "en düşük emekli aylığı" yazısı (taban.js) ve grafikler sayfası
 * buradan okur. Bordro çekirdeğindeki altSinirTablosu yalnız son dönemleri
 * taşır; ortak dönemlerde ikisi aynı olmalıdır (grafikler/test.js sınar).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.EmekliTaban = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  /* Bir ödeme döneminde (YYYY-AA) geçerli taban; ilk kayıttan önce null. */
  function donem(yyyyaa) {
    var t = null;
    TABAN.forEach(function (x) { if (x.donem <= yyyyaa) t = x; });
    return t;
  }

  return { TABAN: TABAN, donem: donem, dayanak: "5510 s.K. ek m.19" };
});
