/*!
 * Borç ve kredi kartı parametreleri — tek doğruluk kaynağı
 *
 * Kaynak:
 *   - TCMB, Kredi Kartı İşlemlerinde Uygulanacak Azami Faiz Oranları
 *     (aylık akdi ve gecikme faizi tavanları, dönem borcu dilimlerine göre)
 *   - BDDK, 26.09.2024 kararı: asgari ödeme oranı kart LİMİTİNE bağlandı
 *
 * NOT: TCMB oranları TAVAN'dır, bankanın uyguladığı oran değil. Araç bu
 * yüzden oranı kullanıcıdan alır, tavanı yalnızca varsayılan ve üst sınır
 * uyarısı olarak kullanır. Kendi ekstrenizdeki oranı yazmak her zaman
 * daha doğru sonuç verir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/borc-kapatma-plani/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BORC_PARAMETRELERI = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Bireysel kredi kartı aylık azami oranlar; dönem borcu dilimine göre.
     [dilim üst sınırı (TL), akdi faiz, gecikme faizi] — son dilim null. */
  var KART_TAVAN = [
    [30000, 0.0325, 0.0355],
    [180000, 0.0375, 0.0405],
    [null, 0.0425, 0.0455]
  ];

  var NAKIT_AVANS = { akdi: 0.0425, gecikme: 0.0455 };
  var KURUMSAL = { akdi: 0.0425, gecikme: 0.0455 };

  /* BDDK: asgari ödeme oranı kart limitine göre sabit yüzde.
     [limit üst sınırı, oran] — son dilim null. */
  var ASGARI_ORAN = [
    [50000, 0.20],
    [null, 0.40]
  ];

  function kartTavani(donemBorcu) {
    for (var i = 0; i < KART_TAVAN.length; i++) {
      var ust = KART_TAVAN[i][0];
      if (ust === null || donemBorcu < ust) {
        return { akdi: KART_TAVAN[i][1], gecikme: KART_TAVAN[i][2] };
      }
    }
    return { akdi: KART_TAVAN[2][1], gecikme: KART_TAVAN[2][2] };
  }

  function asgariOran(kartLimiti) {
    for (var i = 0; i < ASGARI_ORAN.length; i++) {
      var ust = ASGARI_ORAN[i][0];
      if (ust === null || kartLimiti <= ust) return ASGARI_ORAN[i][1];
    }
    return ASGARI_ORAN[ASGARI_ORAN.length - 1][1];
  }

  return {
    kartTavan: KART_TAVAN,
    nakitAvans: NAKIT_AVANS,
    kurumsal: KURUMSAL,
    asgariOranTablosu: ASGARI_ORAN,
    kartTavani: kartTavani,
    asgariOran: asgariOran,
    guncelleme: "2026-09-12",
    dayanak: "TCMB azami kredi kartı faiz oranları; BDDK 26.09.2024 asgari ödeme kararı"
  };
});
