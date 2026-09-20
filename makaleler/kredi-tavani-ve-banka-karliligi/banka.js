/*!
 * Banka kârlılığı, faiz ve kredi tavanı: çalışmanın verileri ve türetmeleri.
 *
 * KAYNAK
 * ------
 * Bu modül, aşağıdaki çalışmanın yayımlanmış tablolarını taşır:
 *   Öner, K. (2026). Faiz Oranı Değişimlerinin Banka Kârlılığı ve Kredi
 *   Büyümesine Etkisi: Türkiye'de Fiyat ve Miktar Araçlarının Ayrışması
 *   (2021–2026). Zenodo. https://doi.org/10.5281/zenodo.22852342
 *
 * Verilerin birincil kaynakları: TCMB PPK duyuruları ve Makroihtiyati
 * Çerçeve basın duyuruları, BDDK Türk Bankacılık Sektörü Ana
 * Göstergeleri, TÜİK TÜFE, Resmî Gazete (Zorunlu Karşılıklar Tebliği).
 *
 * TÜRETİLEBİLİR HİÇBİR ŞEY SAKLANMIYOR
 * ------------------------------------
 * Modülde yalnızca HAM gözlemler duruyor: politika faizi, TÜFE, sekiz
 * haftalık kredi büyüme sınırları, özkaynak kârlılığı, bilanço tutarları,
 * takibe dönüşüm oranı. Reel faiz, yıllık tavan, yıllandırılmış büyüme ve
 * reel kârlılık BURADA HESAPLANIYOR.
 *
 * Bunun sebebi yalnızca tekrar önlemek değil: makalenin yayımlanmış
 * sayıları böylece BAĞIMSIZ OLARAK YENİDEN ÜRETİLİYOR. Test, sitedeki
 * yazının değil çalışmanın aritmetiğini de denetliyor.
 *
 * YUVARLAMA NOTU
 * --------------
 * Çalışmanın tablolarındaki girdiler yuvarlanmış yayımlanmıştır (ör.
 * özkaynak kârlılığı "23,2"). Türetilen değerler bu yuvarlanmış
 * girdilerden hesaplandığında, yayımlanan sonuçtan en çok 0,02 puan
 * ayrılabiliyor. Test bu payı açıkça tanıyor; gizlemiyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Banka = fabrika();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Sekiz haftalık sınır, yıllık tavana bu üsle çevriliyor: bir yılda
     52/8 = 6,5 sekiz haftalık dönem var. */
  var DONEM_KATI = 52 / 8;

  /* --- Tablo 1: politika faizi ve enflasyon (dönem sonu, %) --------- */
  var POLITIKA = [
    { donem: "Aralık 2021", faiz: 14.0, tufe: 36.08, rejim: "I. Gevşeme" },
    { donem: "Aralık 2022", faiz: 9.0, tufe: 64.27, rejim: "I. Gevşeme" },
    { donem: "Aralık 2023", faiz: 42.5, tufe: 64.77, rejim: "II. Sıkılaştırma" },
    { donem: "Aralık 2024", faiz: 47.5, tufe: 44.38, rejim: "II. Sıkılaştırma" },
    { donem: "Aralık 2025", faiz: 38.0, tufe: 30.89, rejim: "III. Normalleşme" },
    { donem: "Ağustos 2026", faiz: 37.0, tufe: 31.51, rejim: "III. Plato" }
  ];

  /* --- Tablo 2: sekiz haftalık kredi büyüme sınırları (%) ----------- */
  var SINIRLAR = [
    { tur: "İhtiyaç kredisi", once: 4.0, sonra: 3.0 },
    { tur: "Taşıt kredisi", once: 4.0, sonra: 3.0 },
    { tur: "Kredili mevduat hesabı", once: 2.0, sonra: 1.0 },
    { tur: "KOBİ TL kredileri", once: 5.0, sonra: 4.5 },
    { tur: "KOBİ dışı TL kredileri", once: 3.0, sonra: 2.0 }
  ];

  /* --- Tablo 3: özkaynak kârlılığı ve enflasyon (%) ----------------- */
  var KARLILIK = [
    { yil: 2020, ok: 10.5, tufe: 14.60 },
    { yil: 2021, ok: 14.0, tufe: 36.08 },
    { yil: 2022, ok: 40.3, tufe: 64.27 },
    { yil: 2023, ok: 34.5, tufe: 64.77 },
    { yil: 2024, ok: 26.5, tufe: 44.38 },
    { yil: 2025, ok: 27.2, tufe: 30.89 },
    { yil: 2026, ok: 23.2, tufe: 31.51, yillandirilmis: true }
  ];

  /* --- Tablo 4: Temmuz 2026 bilançosu (milyar TL, yedi aylık) ------- */
  var BILANCO = {
    ay: 7,
    kalemler: [
      { ad: "Toplam aktifler", tutar: 53817, buyume: 14.6 },
      { ad: "Krediler", tutar: 27448, buyume: 18.7 },
      { ad: "Menkul değerler", tutar: 7790, buyume: 11.1 },
      { ad: "Mevduat", tutar: 30924, buyume: 13.6 },
      { ad: "Özkaynaklar", tutar: 4650, buyume: 11.9 }
    ]
  };

  /* --- Tablo 6: kredilerin takibe dönüşüm oranı (%) ----------------- */
  var TAKIP = [
    { donem: "Ocak 2025", oran: 1.87 },
    { donem: "Nisan 2025", oran: 2.03 },
    { donem: "Aralık 2025", oran: 2.47 },
    { donem: "Ocak 2026", oran: 2.57 },
    { donem: "Nisan 2026", oran: 2.65 },
    { donem: "Mayıs 2026", oran: 2.69 },
    { donem: "Temmuz 2026", oran: 2.86 }
  ];

  /* --- Marj gözlemleri (baz puan ve %) ------------------------------ */
  var MARJ = {
    eylul2025: { netFaizMarji: 5.2, degisimBp: +156, makas: 1.17, makasBp: +59 },
    nisan2026: { brutMarj: 6.0, degisimBp: -86, makasOnce: 6.09, makasSonra: 3.79 }
  };

  /* ----------------------------------------------------------------- */

  /* Fisher: nominal orandan reel orana. Makale boyunca tek formül. */
  function reel(nominal, enflasyon) {
    return (1 + nominal / 100) / (1 + enflasyon / 100) - 1;
  }

  /* Sekiz haftalık sınırın ima ettiği yıllık tavan. */
  function yillikTavan(sekizHaftalik) {
    return Math.pow(1 + sekizHaftalik / 100, DONEM_KATI) - 1;
  }

  /* Kısmi yıl büyümesini yıllandırma. */
  function yillandir(buyume, ay) {
    return Math.pow(1 + buyume / 100, 12 / ay) - 1;
  }

  function reelPolitikaFaizi(i) { return reel(POLITIKA[i].faiz, POLITIKA[i].tufe); }
  function reelKarlilik(i) { return reel(KARLILIK[i].ok, KARLILIK[i].tufe); }

  function kalem(ad) {
    for (var i = 0; i < BILANCO.kalemler.length; i++) {
      if (BILANCO.kalemler[i].ad === ad) return BILANCO.kalemler[i];
    }
    return null;
  }

  /* Kredinin yıllandırılmış nominal ve reel büyümesi. */
  function krediBuyumesi() {
    var k = kalem("Krediler");
    var nominal = yillandir(k.buyume, BILANCO.ay);
    var son = POLITIKA[POLITIKA.length - 1].tufe;
    return { nominal: nominal, reel: (1 + nominal) / (1 + son / 100) - 1 };
  }

  /* REGÜLASYON TAKOZU — çalışmanın merkezî bulgusu.
     Mayıs 2026 sonrası tavanların ima ettiği yıllık aralık ile
     gerçekleşen yıllandırılmış kredi büyümesi arasındaki fark. */
  function takoz() {
    var tavanlar = SINIRLAR.map(function (s) { return yillikTavan(s.sonra); });
    var enDusuk = Math.min.apply(null, tavanlar);
    var enYuksek = Math.max.apply(null, tavanlar);
    var gerceklesen = krediBuyumesi().nominal;
    return {
      enDusuk: enDusuk,
      enYuksek: enYuksek,
      gerceklesen: gerceklesen,
      /* Gerçekleşme, tavan aralığının ÜST sınırını da aşıyor mu? */
      ustSiniriAsiyor: gerceklesen > enYuksek,
      fark: gerceklesen - enYuksek
    };
  }

  /* Takibe dönüşümün ilk gözlemden son gözleme katı. */
  function takipKati() {
    return TAKIP[TAKIP.length - 1].oran / TAKIP[0].oran;
  }

  /* Rejim ortalamaları (Tablo 5). Yıllar rejime elle atanmıyor;
     POLITIKA dizisindeki rejim etiketinden türetiliyor. */
  function rejimler() {
    var harita = {
      "I": [2021, 2022], "II": [2023, 2024], "III": [2025, 2026]
    };
    return Object.keys(harita).map(function (r) {
      var yillar = harita[r];
      var ok = ortalama(yillar.map(function (y) { return kar(y).ok; }));
      var reelOk = ortalama(yillar.map(function (y) {
        return reel(kar(y).ok, kar(y).tufe) * 100;
      }));
      var rf = ortalama(POLITIKA.filter(function (p) {
        return p.rejim.indexOf(r + ".") === 0;
      }).map(function (p) { return reel(p.faiz, p.tufe) * 100; }));
      return { rejim: r, yillar: yillar, ortNominalOk: ok,
               ortReelOk: reelOk, ortReelFaiz: rf };
    });
  }
  function kar(yil) {
    for (var i = 0; i < KARLILIK.length; i++) {
      if (KARLILIK[i].yil === yil) return KARLILIK[i];
    }
    return null;
  }
  function ortalama(d) {
    return d.reduce(function (a, b) { return a + b; }, 0) / d.length;
  }

  return {
    DONEM_KATI: DONEM_KATI,
    POLITIKA: POLITIKA, SINIRLAR: SINIRLAR, KARLILIK: KARLILIK,
    BILANCO: BILANCO, TAKIP: TAKIP, MARJ: MARJ,
    reel: reel,
    yillikTavan: yillikTavan,
    yillandir: yillandir,
    reelPolitikaFaizi: reelPolitikaFaizi,
    reelKarlilik: reelKarlilik,
    kalem: kalem,
    krediBuyumesi: krediBuyumesi,
    takoz: takoz,
    takipKati: takipKati,
    rejimler: rejimler
  };
});
