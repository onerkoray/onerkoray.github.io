/*!
 * Türkiye Bordro Parametreleri — 2020-2026
 * Kaynak: GVK m.103 / m.32, 5510 sayılı Kanun m.82, 488 sayılı DVK,
 *         Asgari Ücret Tespit Komisyonu kararları (Resmî Gazete).
 *
 * Bu dosya motorun tek doğruluk kaynağıdır (single source of truth).
 * Yeni bir bordro yılı eklemek için: yeni bir yıl bloğu + bordro/test.js
 * içindeki resmî net asgari ücret referansı. Başka hiçbir yeri değiştirmeye
 * gerek yoktur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/bordro/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BORDRO_PARAMETRELERI = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Tüm yıllarda değişmeyen kesinti oranları.
     Bir yıl bunlardan sapıyorsa yıl bloğunda "oranlar" ile ezilir. */
  var VARSAYILAN_ORANLAR = {
    sgkIsci: 0.14,          // SGK işçi payı (malullük/yaşlılık/ölüm + GSS)
    issizlikIsci: 0.01,     // işsizlik sigortası işçi payı
    sgkIsveren: 0.2175,     // SGK işveren payı — teşviksiz
    /* 5510 m.81/ı: şartları sağlayan işverende SGK işveren payından 5 puan
       indirilir (prim borcu yoksa, bildirge zamanında verilmişse). İşsizlik
       işveren payına uygulanmaz. */
    sgkIsverenIndirim: 0.05,
    issizlikIsveren: 0.02,  // işsizlik sigortası işveren payı
    damga: 0.00759          // damga vergisi — binde 7,59 (2013'ten beri sabit)
  };

  /* 2020-2021 asgari geçim indirimi (AGİ) oranları — GVK m.32 (mülga).
     AGİ = aylık brüt asgari ücret x toplam oran x %15 */
  var AGI_ORANLARI = {
    kendisi: 0.50,
    calismayanEs: 0.10,
    ilkIkiCocuk: 0.075,   // her biri
    ucuncuCocuk: 0.10,
    digerCocuk: 0.05
  };

  /* İşsizlik ödeneği — 4447 sayılı Kanun m.50.
     Oran ve tavan yıllardır değişmedi; bir yıl saparsa yıl bloğunda ezilir. */
  var ISSIZLIK_VARSAYILAN = {
    oran: 0.40,           // son 4 ayın prime esas kazanç ortalamasının %40'ı
    tavanOrani: 0.80,     // ödenek, brüt asgari ücretin %80'ini aşamaz
    basvuruGunu: 30,      // fesihten itibaren İŞKUR'a başvuru süresi
    // [son 3 yıldaki asgari prim günü, ödenek gün sayısı]
    sureler: [[1080, 300], [900, 240], [600, 180]]
  };

  return {
    2026: {
      yil: 2026,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",   // ücretin asgari ücrete isabet eden kısmı istisna
      damgaIstisnasi: true,
      tavanKatsayisi: 9,
      oranlar: VARSAYILAN_ORANLAR,
      dilimler: [[190000, 0.15], [400000, 0.20], [1500000, 0.27], [5300000, 0.35], [null, 0.40]],
      // Ücret dışı gelirler (serbest meslek, ticari, kira) için ayrı tarife:
      // üçüncü dilimin üst sınırı ücret tarifesinden farklıdır (1.000.000 / 1.500.000).
      dilimlerUcretDisi: [[190000, 0.15], [400000, 0.20], [1000000, 0.27], [5300000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 33030.00, asgariNet: 28075.50, sgkTavan: 297270.00 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      kidemTavanlari: [
        { ay: 1, tutar: 64948.77 },
        { ay: 7, tutar: 73729.87 }
      ],
      /* Şirketleşme ve bağımsız çalışma parametreleri.
         Beyan haddi ayrıca tanımlanmaz: GVK m.86 uyarınca tarifenin ikinci
         diliminin üst sınırıdır, yani dilimler[1][0]. */
      sirket: {
        kurumlarVergisi: 0.25,          // KVK m.32 genel oran
        karPayiStopaji: 0.15,           // GVK 94/6-b, 9286 sayılı CB Kararı (Ara. 2024)
        karPayiIstisnaOrani: 0.50,      // GVK m.22 — kâr payının yarısı istisna
        hizmetIhracatiIndirimi: 0.80,   // GVK m.89/13 — yurt dışına verilen hizmetlerde
        serbestMeslekStopaji: 0.20,     // GVK m.94/2 — kurum/işletmelere kesilen makbuzda
        bagkurOrani: 0.3475,            // 4/b: %20 MYÖ + %12,5 GSS + %2 kısa vadeli
        bagkurIndirimliOran: 0.2975,    // borcu olmayan düzenli ödeyende 5 puanlık indirim
        dayanak: "KVK m.32, GVK m.22, m.86, m.89/13, m.94; 5510 m.80-81"
      },
      dayanak: "GVK m.103 (2026 tarifesi), GVK m.32 asgari ücret istisnası, 5510/82 (tavan = taban x 9)"
    },

    2025: {
      yil: 2025,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      dilimler: [[158000, 0.15], [330000, 0.20], [1200000, 0.27], [4300000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 26005.50, asgariNet: 22104.67, sgkTavan: 195041.25 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      kidemTavanlari: [
        { ay: 1, tutar: 46655.43 },
        { ay: 7, tutar: 53919.68 }
      ],
      dayanak: "GVK m.103 (2025 tarifesi), GVK m.32, 5510/82 (tavan = taban x 7,5)"
    },

    2024: {
      yil: 2024,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      dilimler: [[110000, 0.15], [230000, 0.20], [870000, 0.27], [3000000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 20002.50, asgariNet: 17002.12, sgkTavan: 150018.75 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      dayanak: "GVK m.103 (2024 tarifesi), GVK m.32, 5510/82"
    },

    2023: {
      yil: 2023,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      dilimler: [[70000, 0.15], [150000, 0.20], [550000, 0.27], [1900000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 10008.00, asgariNet: 8506.80, sgkTavan: 75060.00 },
        { ay: 7, asgariBrut: 13414.50, asgariNet: 11402.32, sgkTavan: 100608.75 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      notlar: "Asgari ücret 1 Temmuz 2023'te yeniden belirlendi; istisna, damga ve SGK tavanı Temmuz'dan itibaren yeni tutar üzerinden uygulanır.",
      dayanak: "GVK m.103 (2023 tarifesi), GVK m.32, 5510/82"
    },

    2022: {
      yil: 2022,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",   // 7349 sayılı Kanun ile 1 Ocak 2022'de yürürlüğe girdi
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      dilimler: [[32000, 0.15], [70000, 0.20], [250000, 0.27], [880000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 5004.00, asgariNet: 4253.40, sgkTavan: 37530.00 },
        { ay: 7, asgariBrut: 6471.00, asgariNet: 5500.35, sgkTavan: 48532.50 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      notlar: "AGİ 7349 sayılı Kanun ile kaldırıldı; yerine tüm ücretlilere asgari ücret gelir ve damga vergisi istisnası getirildi. Asgari ücret 1 Temmuz 2022'de yeniden belirlendi.",
      dayanak: "7349 sayılı Kanun, GVK m.103 (2022 tarifesi), GVK m.32, 5510/82"
    },

    2021: {
      yil: 2021,
      guncelleme: "2026-07-16",
      istisnaRejimi: "agi",
      damgaIstisnasi: false,           // damga vergisi brütün tamamı üzerinden
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      agiOranlari: AGI_ORANLARI,
      dilimler: [[24000, 0.15], [53000, 0.20], [190000, 0.27], [650000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 3577.50, asgariNet: 2825.90, sgkTavan: 26831.25 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      netAsgariTaban: 2825.90,
      notlar: "AGİ rejimi. Asgari ücretlinin net ücreti, yıl içinde vergi dilimi ilerlese de ilave AGİ ile 2.825,90 TL'nin altına düşürülmez.",
      dayanak: "GVK m.103 (2021 tarifesi), GVK m.32 (mülga AGİ), 5510/82"
    },

    2020: {
      yil: 2020,
      guncelleme: "2026-07-16",
      istisnaRejimi: "agi",
      damgaIstisnasi: false,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      agiOranlari: AGI_ORANLARI,
      dilimler: [[22000, 0.15], [49000, 0.20], [180000, 0.27], [600000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 2943.00, asgariNet: 2324.71, sgkTavan: 22072.50 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      notlar: "AGİ rejimi. Bu yılda asgari ücretlinin neti için taban koruma uygulaması bulunmadığından, yıl sonuna doğru vergi dilimi ilerledikçe net ücret Ocak ayının altına düşer.",
      dayanak: "GVK m.103 (2020 tarifesi), GVK m.32 (mülga AGİ), 5510/82"
    }
  };
});
