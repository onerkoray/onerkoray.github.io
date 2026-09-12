/*!
 * Emeklilik (yaşlılık aylığı) parametreleri — tek doğruluk kaynağı
 *
 * Kaynak:
 *   - 5510 sayılı Kanun m.29 (2008/10 sonrası aylık bağlama oranı ve
 *     güncelleme katsayısı)
 *   - 506 sayılı Kanun Geçici m.82 (2000–2008/09 dönemi ABO kademeleri;
 *     4447 sayılı Kanun ile eklendi, 5510 ile yürürlükten kaldırıldı ancak
 *     o dönemde geçen hizmetler için uygulanmaya devam ediyor)
 *   - 5510 sayılı Kanun Geçici m.2 (dönemlerin kısmî aylık olarak
 *     birleştirilmesi)
 *
 * NEDEN AYRI DOSYA: bordro/parametreler.js bir YIL HARİTASI döndürüyor
 * (2020…2026). Emeklilik kurallarının çoğu yıla bağlı değil, kalıcı kanun
 * hükmü; alt sınır aylık ise yıl değil DÖNEM bazlı (Ocak/Temmuz zamları).
 * Yıl haritasına sokmak ikisini de bozardı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/emekli-ayligi-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.EMEKLILIK_PARAMETRELERI = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Hizmet dönemlerinin sınırları.
     DİKKAT: bu tarihler HİZMETİN geçtiği dönemi ayırır, sigortalılık
     başlangıcını değil. "8 Eylül 1999" tarihi EYT/kademeli emeklilik
     KAPSAMI için önemlidir ve buraya karışmamalıdır — aylık hesabında
     rejim değişimleri 1 Ocak 2000 ve 1 Ekim 2008'dir. */
  var DONEMLER = [
    {
      kod: "gosterge",
      ad: "1999 sonu ve öncesi",
      bitis: "1999-12-31",
      sistem: "gösterge",
      dayanak: "506 s.K. (4447 öncesi hâli)"
    },
    {
      kod: "gecici82",
      ad: "1 Ocak 2000 – 30 Eylül 2008",
      baslangic: "2000-01-01",
      bitis: "2008-09-30",
      sistem: "kademeli-abo",
      dayanak: "506 s.K. Geçici m.82"
    },
    {
      kod: "m29",
      ad: "1 Ekim 2008 ve sonrası",
      baslangic: "2008-10-01",
      sistem: "sabit-abo",
      dayanak: "5510 s.K. m.29"
    }
  ];

  /* 506 Geçici m.82 — aylık bağlama oranı kademeleri.
     Her kademe: [bu kademenin kapsadığı gün sayısı, her 360 gün için oran].
     Son kademenin gün sayısı null: kalan bütün günler. */
  var ABO_GECICI82 = {
    kademeler: [
      [3600, 0.035],   // ilk 3.600 gün → her 360 gün için %3,5
      [5400, 0.020],   // sonraki 5.400 gün (3.601–9.000) → %2
      [null, 0.015]    // 9.000 günden sonrası → %1,5
    ],
    tavan: null        // bu dönem için kanunda ABO tavanı yok
  };

  /* 5510 m.29 — her 360 gün için %2, tavan %90. */
  var ABO_M29 = {
    kademeler: [[null, 0.020]],
    tavan: 0.90
  };

  /* Alt sınır aylık (en düşük emekli aylığı).
     Kök aylık bunun altında kalırsa fark Hazine desteğiyle tamamlanır;
     yani ödenen aylık bu tutarın altına düşmez. Dönem başlangıcına göre
     sıralı — en yeni en üstte. */
  var ALT_SINIR_AYLIK = [
    { gecerli: "2026-07-01", tutar: 23552, not: "Temmuz 2026 zammı (%17,76)" },
    { gecerli: "2026-01-01", tutar: 20000, not: "Ocak 2026 zammı (%18,48)" },
    { gecerli: "2025-07-01", tutar: 16881, not: "Temmuz 2025" }
  ];

  function altSinirAylik(tarihISO) {
    var t = tarihISO || new Date().toISOString().slice(0, 10);
    for (var i = 0; i < ALT_SINIR_AYLIK.length; i++) {
      if (t >= ALT_SINIR_AYLIK[i].gecerli) return ALT_SINIR_AYLIK[i];
    }
    return ALT_SINIR_AYLIK[ALT_SINIR_AYLIK.length - 1];
  }

  /* Kademeli ABO hesabı. gun: TOPLAM prim gün sayısı.
     Kademeler toplam gün üzerinden yürütülür; dönemin kendi günü değil.
     Bu, kısmî aylık yönteminin can alıcı noktası: her dönem kendi
     kuralıyla TOPLAM güne bakar, sonra kendi gün payı kadar hesaba girer. */
  function aboHesapla(kural, gun) {
    var kalan = gun, oran = 0;
    for (var i = 0; i < kural.kademeler.length && kalan > 0; i++) {
      var kapsam = kural.kademeler[i][0];
      var birim = kural.kademeler[i][1];
      var pay = (kapsam === null) ? kalan : Math.min(kalan, kapsam);
      oran += (pay / 360) * birim;
      kalan -= pay;
    }
    if (kural.tavan !== null && oran > kural.tavan) oran = kural.tavan;
    return oran;
  }

  return {
    donemler: DONEMLER,
    abo: { gecici82: ABO_GECICI82, m29: ABO_M29 },
    aboHesapla: aboHesapla,
    altSinirTablosu: ALT_SINIR_AYLIK,
    altSinirAylik: altSinirAylik,
    guncelleme: "2026-09-12",
    dayanak: "5510 s.K. m.29 ve Geçici m.2; 506 s.K. Geçici m.82"
  };
});
