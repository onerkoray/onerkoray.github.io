/*!
 * 2/4042 esas numaralı kanun teklifinin (TBMM, 12/11/2026) SGK maddeleri:
 * hesaplar ve kaynak künyeleri. Saf modül; yazının gövdesi
 * tools/kasim-2026-gundem-yazilari.js, sınaması sayi-testi.js.
 *
 * KAYNAKLAR (23 Kasım 2026'da okundu)
 *   Teklif metni ve gerekçesi: cdn.tbmm.gov.tr, Dönem 28, Yasama Yılı 5,
 *     Esas No 2/4042, Başkanlığa geliş 12/11/2026. Madde 2 (3308 geçici 12),
 *     Madde 3 (4447 geçici 10), Madde 10 (5510'a geçici madde 114),
 *     Madde 14 (yürürlük).
 *   4447 sayılı Kanun geçici madde 10 (mevzuat.gov.tr metni): destek, 5510
 *     m.81'deki sigorta primlerinin işveren hisselerine ait tutar; prime esas
 *     kazanç üzerinden; m.81/1-(ı) indirimi uygulandıktan sonra kalan oran;
 *     İşsizlik Sigortası Fonundan. Süreler aşağıda (SURELER).
 *   5510 sayılı Kanun m.60/1-(g) ve m.82 (mevzuat.gov.tr metni).
 *   Kişi sayısı ve tutar teklif metninde YOK: teklif sahiplerinin basın
 *     açıklaması, Anadolu Ajansı haberi (aa.com.tr, 12 Kasım 2026).
 *   2026 parametreleri: bordro/parametreler.js (tek kaynak; kopyalanmaz).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../../bordro/parametreler.js"));
  else kok.TorbaTeklifSgk = fabrika(kok.BordroParametreleri);
})(typeof self !== "undefined" ? self : this, function (P) {
  "use strict";

  var Y = P[2026], O = Y.oranlar;
  var ASGARI_BRUT = Y.donemler[0].asgariBrut;            // 33.030 TL (2026)
  var GSS_60G_ORANI = Y.sigortalilik.gssOrani;            // %6, asgari ücret üzerinden (2026)

  var TEKLIF = {
    esasNo: "2/4042", gelis: "2026-11-12", maddeSayisi: 15, durum: "Komisyonda",
    tesvikBitisEski: "2025-12-31", tesvikYetkiEski: "2026-12-31",   // 4447 g.10 onikinci fıkra (7495 s.K.)
    tesvikBitisYeni: "2028-12-31", tesvikYetkiYeni: "2029-12-31",   // teklif m.3
    cbKarari: { no: 10769, rg: "2025-12-25", bitis: "2026-12-31" }, // mevcut uzatma
    gssKesim: "2017-01-01", gssMadde: "5510 geçici madde 114 (teklif m.10)",
    stajYuruluk: "2026-09-14"                                       // teklif m.14/a
  };

  /* 4447 geçici 10, ikinci fıkra: destek süresi (ay). */
  var SURELER = [
    { grup: "18 yaş üstü kadın ya da 18–29 yaş erkek, mesleki yeterlik belgeli", ay: 48 },
    { grup: "18 yaş üstü kadın ya da 18–29 yaş erkek, mesleki/teknik eğitim ya da İŞKUR kursu bitirmiş", ay: 36 },
    { grup: "18 yaş üstü kadın ya da 18–29 yaş erkek, belgesiz", ay: 24 },
    { grup: "29 yaş üstü erkek, belgeli", ay: 24 },
    { grup: "Çalışırken belge alan 4/a sigortalı", ay: 12 },
    { grup: "Yukarıdakilere girmeyen, İŞKUR kayıtlı işsiz", ay: 6 }
  ];
  var ISKUR_EK_AY = 6;   // (c) bendi: (a) ve (b) kapsamındakiler İŞKUR kayıtlı işsizden alınırsa

  /* Açıklanan rakamlar (teklif metninde yok). */
  var GSS_ACIKLAMA = { kisi: 2199869, tutar: 5627666000 };

  /* İşverenin prim oranı ve teşvikin karşıladığı oran (2026).
     sgkIsveren: MYÖ 12 + kısa vadeli 2,25 + GSS 7,5 = %21,75.
     m.81/ı: imalat dışı 2, imalat 5 puan. Teşvik kalan işveren hissesi;
     işsizlik sigortası işveren payı (%2) 5510 m.81'de değil, kapsam dışı. */
  function indirim(imalat) { return imalat ? O.sgkIsverenIndirimImalat : O.sgkIsverenIndirim; }
  function tesvikOrani(imalat) { return O.sgkIsveren - indirim(imalat); }
  function tesvikAylik(brut, imalat) { return brut * tesvikOrani(imalat); }
  function isverenMaliyeti(brut, imalat, tesvikli) {
    var sgk = brut * (O.sgkIsveren - indirim(imalat)), issizlik = brut * O.issizlikIsveren;
    return brut + sgk + issizlik - (tesvikli ? tesvikAylik(brut, imalat) : 0);
  }
  function maliyetDususu(brut, imalat) {
    return 1 - isverenMaliyeti(brut, imalat, true) / isverenMaliyeti(brut, imalat, false);
  }
  /* Süre boyunca toplam: 2026 tutarı sabit tutulur (nominal; asgari ücret artarsa büyür). */
  function toplam(ay, brut, imalat) { return ay * tesvikAylik(brut, imalat); }

  function gssKisiBasi() { return GSS_ACIKLAMA.tutar / GSS_ACIKLAMA.kisi; }
  function gss60gAylik() { return ASGARI_BRUT * GSS_60G_ORANI; }

  return {
    TEKLIF: TEKLIF, SURELER: SURELER, ISKUR_EK_AY: ISKUR_EK_AY, GSS_ACIKLAMA: GSS_ACIKLAMA,
    ASGARI_BRUT: ASGARI_BRUT, GSS_60G_ORANI: GSS_60G_ORANI, ORANLAR: O,
    tesvikOrani: tesvikOrani, tesvikAylik: tesvikAylik, isverenMaliyeti: isverenMaliyeti,
    maliyetDususu: maliyetDususu, toplam: toplam, gssKisiBasi: gssKisiBasi, gss60gAylik: gss60gAylik
  };
});
