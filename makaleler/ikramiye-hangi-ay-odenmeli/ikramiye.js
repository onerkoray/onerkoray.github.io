/*!
 * İkramiye/primin zamanlaması: yıllık vergi ve prim yükünü değiştirir mi?
 *
 * NEDEN AYRI MODÜL
 * ----------------
 * Kural üç yerde lazım: yazının tabloları, testi ve ileride akademik
 * çalışmanın yeniden üretimi. Üçüne ayrı yazılsaydı biri güncellenip
 * ötekiler sessizce eskirdi. Buradaki hiçbir sayı elle yazılmıyor;
 * hepsi bordro motorundan geliyor.
 *
 * ÖNERMELER
 * ---------
 * Ö1 (ZAMANLAMA NÖTRLÜĞÜ). Gelir vergisi kümülatif matrah üzerinden
 *    hesaplandığı için, bir ayın vergisi tarife(birikim + matrah) −
 *    tarife(birikim) kadardır. On iki ay toplandığında teleskopik olarak
 *    tarife(yıllık matrah) kalır: yıl içi dağılım düşer. Asgari ücret
 *    istisnası da fiili ücretten bağımsız, her ay aynı tutarda uygulanır.
 *    Dolayısıyla ödemenin hangi ayda yapıldığı yıllık yükü DEĞİŞTİRMEZ.
 *
 * Ö2 (TAVAN ÖNERMEYİ KIRAR). Sosyal güvenlik primi aylık bir TAVANLA
 *    sınırlı. Ödeme bir aya toplandığında o ayın prime esas kazancı
 *    tavana dayanır ve aşan kısımdan prim alınmaz; yayıldığında her ay
 *    tavanın altında kalıp tam prim alınır. Yani Ö1, ancak aylık kazanç
 *    tavanı aşmadığı sürece geçerli.
 *
 * Ö3 (TERS AKIŞ). Prim, gelir vergisi matrahından düşülüyor. Toplama
 *    yüzünden az prim ödenince matrah büyür ve gelir vergisi ARTAR. İki
 *    etki ters yönlü; net sonuç yine de çalışan lehine kalıyor çünkü
 *    prim tasarrufu vergi artışından büyük.
 *
 * Ö4 (AY SEÇİMİ, TAVAN SABİTSE). Ö1 gereği ay seçimi nötr. Ama asgari
 *    ücret yıl ortasında zamlanan yıllarda TAVAN DA değişiyor; o zaman
 *    ay seçimi fark etmeye başlıyor ve tavanın düşük olduğu dönem daha
 *    avantajlı oluyor. 2022 ve 2023 böyle yıllar.
 *
 * KAPSAM
 * ------
 * Ücret ayın tamamında ve asgari ücretin altına düşmeyen bir brütle
 * çalışılıyor varsayılıyor. İkramiye brüt tutar olarak veriliyor ve
 * ücretle aynı ayda, aynı işverence ödeniyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.Ikramiye = fabrika(kok.BordroMotor);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  function asgariTavani(P) {
    return (P.donemler || []).reduce(function (e, d) {
      return Math.max(e, d.asgariBrut);
    }, 0);
  }

  function kapsamKontrol(aylikBrut, yil) {
    var P = B.parametre(yil);
    var taban = asgariTavani(P);
    if (!(aylikBrut >= taban)) {
      throw new Error("Kapsam dışı: aylık brüt " + aylikBrut + " TL, " + yil +
        " asgari brütünün (" + taban + " TL) altında.");
    }
    return P;
  }

  /* Yıl içinde SGK tavanı değişiyor mu? Ö4'ün kapısı bu. */
  function tavanSabitMi(yil) {
    var d = B.parametre(yil).donemler || [];
    for (var i = 1; i < d.length; i++) {
      if (d[i].sgkTavan !== d[0].sgkTavan) return false;
    }
    return true;
  }

  function tavanlar(yil) {
    return (B.parametre(yil).donemler || []).map(function (d) {
      return { ay: d.ay, sgkTavan: d.sgkTavan };
    });
  }

  /* O ayda geçerli tavan. */
  function ayinTavani(yil, ay) {
    return B.donem(B.parametre(yil), ay).sgkTavan;
  }

  /* İkramiye n parçaya bölünüp seçilen aylara dağıtılınca yıllık özet.
     aylar verilmezse parçalar yıla eşit aralıklarla yerleştirilir. */
  function dagit(aylikBrut, ikramiye, yil, parca, aylar) {
    kapsamKontrol(aylikBrut, yil);
    if (!(parca >= 1 && parca <= 12)) throw new Error("Parça 1–12 arası olmalı.");
    if (!aylar) {
      aylar = [];
      for (var k = 0; k < parca; k++) {
        /* Sondan geriye eşit aralık: tek parçada Aralık, ikide Haziran
           ve Aralık. Seçim Ö1 gereği sonucu değiştirmiyor (tavan sabit
           olan yıllarda); yine de belirli olsun diye kural yazılı. */
        aylar.push(12 - Math.round(k * 12 / parca));
      }
    }
    var brutler = [];
    for (var i = 1; i <= 12; i++) {
      var pay = 0;
      aylar.forEach(function (a) { if (a === i) pay += ikramiye / parca; });
      brutler.push(aylikBrut + pay);
    }
    var r = B.hesaplaYil(brutler, yil);
    var t = r.toplam;
    return {
      parca: parca, aylar: aylar.slice(), brutler: brutler,
      brut: t.brut, gelirVergisi: t.gelirVergisi,
      sgk: t.sgk + t.issizlik, damga: t.damga, istisna: t.istisna,
      net: t.net, isverenMaliyeti: t.isverenMaliyeti
    };
  }

  /* İkramiye tek bir ayda ödenirse; ay 1–12. */
  function tekAy(aylikBrut, ikramiye, yil, ay) {
    return dagit(aylikBrut, ikramiye, yil, 1, [ay]);
  }

  /* Ö1/Ö4 ölçümü: on iki ayın her biri için yıllık net. */
  function aylaraGore(aylikBrut, ikramiye, yil) {
    var out = [];
    for (var ay = 1; ay <= 12; ay++) {
      var r = tekAy(aylikBrut, ikramiye, yil, ay);
      out.push({ ay: ay, net: r.net, sgk: r.sgk,
        gelirVergisi: r.gelirVergisi, sgkTavan: ayinTavani(yil, ay) });
    }
    return out;
  }

  /* Ay seçimi gerçekten fark ediyor mu — ve ne kadar? */
  function aySecimiFarki(aylikBrut, ikramiye, yil) {
    var l = aylaraGore(aylikBrut, ikramiye, yil).map(function (x) { return x.net; });
    var enAz = Math.min.apply(null, l), enCok = Math.max.apply(null, l);
    return { enAz: enAz, enCok: enCok, fark: enCok - enAz };
  }

  /* Ö2: tek ayda ödendiğinde o ayın prime esas kazancı tavanı aşıyor mu? */
  function tavanAsiliyorMu(aylikBrut, ikramiye, yil, ay) {
    return aylikBrut + ikramiye > ayinTavani(yil, ay || 12);
  }

  /* Ö2'nin eşiği: hangi ikramiye tutarından sonra dağılım fark etmeye
     başlıyor? Tam olarak tavanı aşıran tutar. */
  function kirilmaEsigi(aylikBrut, yil, ay) {
    kapsamKontrol(aylikBrut, yil);
    return Math.max(0, ayinTavani(yil, ay || 12) - aylikBrut);
  }

  /* Parça sayısına göre karşılaştırma. Tek parça referans alınıyor. */
  function parcaKarsilastirmasi(aylikBrut, ikramiye, yil, parcalar) {
    parcalar = parcalar || [1, 2, 3, 4, 6, 12];
    var temel = dagit(aylikBrut, ikramiye, yil, 1);
    return parcalar.map(function (p) {
      var r = dagit(aylikBrut, ikramiye, yil, p);
      return {
        parca: p, net: r.net, sgk: r.sgk, gelirVergisi: r.gelirVergisi,
        isverenMaliyeti: r.isverenMaliyeti,
        netFark: r.net - temel.net,
        isverenFark: r.isverenMaliyeti - temel.isverenMaliyeti
      };
    });
  }

  function kapsananYillar() { return B.yillar(); }

  return {
    tavanSabitMi: tavanSabitMi,
    tavanlar: tavanlar,
    ayinTavani: ayinTavani,
    dagit: dagit,
    tekAy: tekAy,
    aylaraGore: aylaraGore,
    aySecimiFarki: aySecimiFarki,
    tavanAsiliyorMu: tavanAsiliyorMu,
    kirilmaEsigi: kirilmaEsigi,
    parcaKarsilastirmasi: parcaKarsilastirmasi,
    kapsananYillar: kapsananYillar
  };
});
