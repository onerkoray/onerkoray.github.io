/*!
 * Türkiye Bordro Parametreleri — 2020-2026
 * Kaynak: GVK m.103 / m.23/18 (2022+), m.32 (2020–2021 AGİ, mülga), 5510 sayılı Kanun m.82, 488 sayılı DVK,
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

  /* 2020'den bu yana değişmeyen kesinti oranları. Bir yıl bunlardan
     sapıyorsa yıl bloğunda oranlarIle({...}) ile ezilir; yıl İÇİNDE bir
     oran değişiyorsa yıl bloğunun oranDegisimleri listesine o aydan
     itibaren geçerli değer yazılır (motor: Bordro.oranlarAy).

     İŞVEREN PAYI SABİT DEĞİL. İlk sürümde 2026'nın %21,75'i bütün yıllara
     yazılmıştı; 2020–2025 işveren maliyeti bu yüzden 1–1,25 puan yüksek
     çıkıyordu (düzeltme günlüğü, 2026-09-25). Seyir, ÇSGB'nin yıllık
     "asgari ücretin işverene maliyeti" tablolarıyla aynı:
       2020 – Ağu 2024  %20,5   MYÖ 11 + GSS 7,5 + kısa vadeli 2
       Eyl 2024 – 2025  %20,75  kısa vadeli %2,25 (7524 s.K. m.28, 2024/Eylül)
       2026             %21,75  MYÖ işveren 12 (7566 s.K., 1 Ocak 2026)
     İşçi payı (%14 = MYÖ 9 + GSS 5) bu değişikliklerden etkilenmedi. */
  var VARSAYILAN_ORANLAR = {
    sgkIsci: 0.14,          // SGK işçi payı (malullük/yaşlılık/ölüm + GSS)
    issizlikIsci: 0.01,     // işsizlik sigortası işçi payı
    sgkIsveren: 0.205,      // SGK işveren payı — teşviksiz
    /* 5510 m.81/ı: şartları sağlayan özel sektör işvereninde MYÖ işveren
       hissesinden indirim (prim borcu yoksa, bildirge zamanında verilmişse).
       İşsizlik işveren payına uygulanmaz. Oran da sabit değil:
         Ocak 2025'e kadar  5 puan, bütün sektörler
         Şubat 2025         imalat dışı 4 puan (7538 s.K.)
         2026               imalat dışı 2 puan (7566 s.K.)
       İmalat (NACE C) 5 puanda kaldı (5510 geçici m.108). Motor iki
       seçeneği ayrı tutar: tesvik "genel" ya da "imalat". */
    sgkIsverenIndirim: 0.05,
    sgkIsverenIndirimImalat: 0.05,
    issizlikIsveren: 0.02,  // işsizlik sigortası işveren payı
    damga: 0.00759          // damga vergisi — binde 7,59 (2013'ten beri sabit)
  };
  function oranlarIle(ek) {
    var o = {};
    for (var k in VARSAYILAN_ORANLAR) o[k] = VARSAYILAN_ORANLAR[k];
    for (var j in ek) o[j] = ek[j];
    return o;
  }

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
  /* 4857 sayılı İş Kanunu'nun fazla çalışma hükümleri. Yıllara göre
     değişmediği için tek yerde tutulur; bir yıl saparsa yıl bloğunda ezilir.

     aylikSaat 225: m.63 uyarınca günlük 7,5 saat üzerinden 30 × 7,5.
     Saat ücreti aylık brüt ücretin bu sayıya bölünmesiyle bulunur. */
  var FAZLA_MESAI_VARSAYILAN = {
    aylikSaat: 225,           // saat ücretinin böleni (m.63)
    fazlaCalismaKat: 1.50,    // m.41: haftalık 45 saati aşan çalışma
    fazlaSureliKat: 1.25,     // m.41: sözleşmeyle 45'ten az belirlenmişse
    yillikUstSinirSaat: 270,  // m.41: yılda en çok 270 saat fazla çalışma
    /* Serbest zaman, ücret zammının ZAMAN cinsinden aynasıdır ve kanunda
       ikiye ayrılır: fazla çalışmada 1 saat 30 dakika, fazla sürelerle
       çalışmada 1 saat 15 dakika. Tek katsayı tutulduğunda araç ikisine de
       1,5 uyguluyor ve %25'lik çalışmada izni beşte bir fazla gösteriyordu. */
    serbestZamanFazlaCalismaKat: 1.50,  // m.41/4: 1 saat 30 dakika
    serbestZamanFazlaSureliKat: 1.25,   // m.41/4: 1 saat 15 dakika
    serbestZamanAyPenceresi: 6          // m.41/5: altı ay içinde kullanılır
  };

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
      // 7566 s.K. ile 7,5'ten 9'a cikarildi (1 Ocak 2026'dan gecerli).
      // Motor bu alani OKUMUYOR; sgkTavan ile iliskisini bordro/test.js
      // bagliyor (tavan = asgariBrut x tavanKatsayisi).
      tavanKatsayisi: 9,
      // 7566 s.K.: MYÖ işveren hissesi %11 → %12; m.81/ı imalat dışı 2 puan.
      oranlar: oranlarIle({ sgkIsveren: 0.2175, sgkIsverenIndirim: 0.02 }),
      dilimler: [[190000, 0.15], [400000, 0.20], [1500000, 0.27], [5300000, 0.35], [null, 0.40]],
      // Ücret dışı gelirler (serbest meslek, ticari, kira) için ayrı tarife:
      // üçüncü dilimin üst sınırı ücret tarifesinden farklıdır (1.000.000 / 1.500.000).
      dilimlerUcretDisi: [[190000, 0.15], [400000, 0.20], [1000000, 0.27], [5300000, 0.35], [null, 0.40]],
      /* Gayrimenkul sermaye iradi (kira geliri) beyan parametreleri.
         Dayanak: GVK m.21 (mesken istisnasi), m.74 (giderler), m.86 (beyan
         sinirlari), m.94 (tevkifat). Tutarlar her yil yeniden degerleme ile
         guncelleniyor; yeni yil eklerken burayi da tazele. */
      /* Istisna ust siniri BURADA TANIMLANMAZ. GVK m.21 onu "103 uncu
         maddede yazili tarifenin ucuncu diliminde UCRET GELIRLERI icin yer
         alan tutar" olarak tanimlar, yani dilimler[2][0]. Elle yazildiginda
         bayatladi: 2023'un 1.900.000'i 2026'da da duruyordu ve toplam geliri
         1.500.000-1.900.000 arasinda olan herkese istisna hakki gosteriyordu.
         Beyan haddinde de ayni yol izleniyor (asagida, dilimler[1][0]). */
      gmsi: {
        meskenIstisnasi: 58000,      // GVK m.21 — konut kira geliri istisnasi
        goturuGiderOrani: 0.15,      // istisna dusuldukten SONRA kalan tutarin %15'i
        isyeriStopaji: 0.20,         // GVK m.94 — isyeri kira odemelerinde tevkifat
        tevkifatsizHad: 22000,       // tevkifata/istisnaya tabi olmayan MSI-GMSI haddi
        kredFaiziIndirimi: false     // 7566 s.K.: konut kredisi faizi indirimi kaldirildi
      },
      donemler: [
        { ay: 1, asgariBrut: 33030.00, asgariNet: 28075.50, sgkTavan: 297270.00 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      kidemTavanlari: [
        { ay: 1, tutar: 64948.77 },
        { ay: 7, tutar: 73729.87 }
      ],
      /* Şirketleşme ve bağımsız çalışma parametreleri.
         Beyan haddi ayrıca tanımlanmaz: GVK m.86 uyarınca tarifenin ikinci
         diliminin üst sınırıdır, yani dilimler[1][0]. */
      /* Yillik beyanname indirimleri (GVK m.89) ve beyan esiklerinin
         hangi dilimden turedigi.

         BURADA TUTAR YOK, ORAN VAR. m.89 indirimleri "beyan edilen
         gelirin yuzde su kadari" diye tanimli; yeniden degerlemeyle
         bayatlayacak bir rakam icermiyorlar. Tek istisna sahis sigortasi
         primindeki asgari ucret tavani -- o da donemler[].asgariBrut'tan
         TURETILIYOR, buraya yazilmiyor. */
      beyan: {
        egitimSaglikOrani: 0.10,     // m.89/2 — beyan edilen gelirin %10'u
        bagisOrani: 0.05,            // m.89/4 — beyan edilen gelirin %5'i
        sahisSigortaOrani: 0.15,     // m.89/1 — beyan edilen gelirin %15'i
                                     // ve yillik asgari ucreti asamaz
        sponsorlukAmator: 1.00,      // m.89/8 — amator spor dallarinda tamami
        sponsorlukProfesyonel: 0.50, // m.89/8 — profesyonel dallarda yarisi
        /* Esikler DILIM SIRASI olarak duruyor, tutar olarak degil:
           kanun onlari "tarifenin ikinci/dorduncu gelir diliminde yer
           alan tutar" diye tanimliyor. */
        sonrakiIsverenDilimi: 1,     // m.86/1-b parantezi
        ucretToplamiDilimi: 3,       // m.86/1-b, 7194 s.K. ile eklenen sinir
        tevkifatliDilimi: 1,         // m.86/1-c — MSI, GMSI, cok isverenli ucret
        taksitAylari: [3, 7],        // Mart ve Temmuz
        dayanak: "GVK m.85, m.86, m.89, m.92, m.117"
      },

      sirket: {
        kurumlarVergisi: 0.25,          // KVK m.32 genel oran
        karPayiStopaji: 0.15,           // GVK 94/6-b, 9286 sayılı CB Kararı (Ara. 2024)
        karPayiIstisnaOrani: 0.50,      // GVK m.22 — kâr payının yarısı istisna
        hizmetIhracatiIndirimi: 0.80,   // GVK m.89/13 — yurt dışına verilen hizmetlerde
        serbestMeslekStopaji: 0.20,     // GVK m.94/2 — kurum/işletmelere kesilen makbuzda
        /* 4/b: %21 MYÖ (7566 s.K.) + %12,5 GSS + %2,25 kısa vadeli = %35,75.
           2026 en düşük prim 33.030 × %35,75 = 11.808,23 TL. İlk sürümde
           2025'in %34,75'i kalmıştı (düzeltme günlüğü, 2026-09-25). */
        bagkurOrani: 0.3575,
        bagkurIndirimliOran: 0.3075,    // borcu olmayan düzenli ödeyende 5 puanlık indirim
        dayanak: "KVK m.32, GVK m.22, m.86, m.89/13, m.94; 5510 m.80-81"
      },
      dayanak: "GVK m.103 (2026 tarifesi), GVK m.23/18 asgari ücret istisnası, 5510/82 + 7566 s.K. (tavan = taban x 9; MYÖ işveren %12, işveren payı %21,75; m.81/ı imalat dışı 2 puan)"
    },

    2025: {
      yil: 2025,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: oranlarIle({ sgkIsveren: 0.2075 }),
      // 7538 s.K. (RG 15.01.2025): imalat dışı indirim 1 Şubat 2025'ten 4 puan.
      oranDegisimleri: [{ ay: 2, sgkIsverenIndirim: 0.04 }],
      dilimler: [[158000, 0.15], [330000, 0.20], [1200000, 0.27], [4300000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 26005.50, asgariNet: 22104.67, sgkTavan: 195041.25 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      kidemTavanlari: [
        { ay: 1, tutar: 46655.43 },
        { ay: 7, tutar: 53919.68 }
      ],
      dayanak: "GVK m.103 (2025 tarifesi), GVK m.23/18, 5510/82 (tavan = taban x 7,5); işveren payı %20,75; 7538 s.K. (m.81/ı imalat dışı 4 puan, Şubat 2025)"
    },

    2024: {
      yil: 2024,
      guncelleme: "2026-07-16",
      istisnaRejimi: "asgari-ucret",
      damgaIstisnasi: true,
      tavanKatsayisi: 7.5,
      oranlar: VARSAYILAN_ORANLAR,
      // 7524 s.K. m.28 (RG 02.08.2024): kısa vadeli %2 → %2,25, 2024/Eylül'den.
      oranDegisimleri: [{ ay: 9, sgkIsveren: 0.2075 }],
      dilimler: [[110000, 0.15], [230000, 0.20], [870000, 0.27], [3000000, 0.35], [null, 0.40]],
      donemler: [
        { ay: 1, asgariBrut: 20002.50, asgariNet: 17002.12, sgkTavan: 150018.75 }
      ],
      kidemTavanlari: [
        { ay: 1, tutar: 35058.58 },
        { ay: 7, tutar: 41828.42 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      dayanak: "GVK m.103 (2024 tarifesi), GVK m.23/18, 5510/82; kıdem tavanı: Hazine ve Maliye Bakanlığı Mali ve Sosyal Haklar Genelgeleri; 7524 s.K. m.28 (kısa vadeli %2,25, işveren payı %20,75, Eylül 2024)"
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
      kidemTavanlari: [
        { ay: 1, tutar: 19982.83 },
        { ay: 7, tutar: 23489.83 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      notlar: "Asgari ücret 1 Temmuz 2023'te yeniden belirlendi; istisna, damga ve SGK tavanı Temmuz'dan itibaren yeni tutar üzerinden uygulanır.",
      dayanak: "GVK m.103 (2023 tarifesi), GVK m.23/18, 5510/82; kıdem tavanı: Hazine ve Maliye Bakanlığı Mali ve Sosyal Haklar Genelgeleri"
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
      kidemTavanlari: [
        { ay: 1, tutar: 10848.59 },
        { ay: 7, tutar: 15371.40 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      notlar: "AGİ 7349 sayılı Kanun ile kaldırıldı; yerine tüm ücretlilere asgari ücret gelir ve damga vergisi istisnası getirildi. Asgari ücret 1 Temmuz 2022'de yeniden belirlendi.",
      dayanak: "7349 sayılı Kanun, GVK m.103 (2022 tarifesi), GVK m.23/18, 5510/82"
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
      kidemTavanlari: [
        { ay: 1, tutar: 7638.96 },
        { ay: 7, tutar: 8284.51 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
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
      kidemTavanlari: [
        { ay: 1, tutar: 6730.15 },
        { ay: 7, tutar: 7117.17 }
      ],
      issizlik: ISSIZLIK_VARSAYILAN,
      fazlaMesai: FAZLA_MESAI_VARSAYILAN,
      notlar: "AGİ rejimi. Bu yılda asgari ücretlinin neti için taban koruma uygulaması bulunmadığından, yıl sonuna doğru vergi dilimi ilerledikçe net ücret Ocak ayının altına düşer.",
      dayanak: "GVK m.103 (2020 tarifesi), GVK m.32 (mülga AGİ), 5510/82"
    }
  };
});
