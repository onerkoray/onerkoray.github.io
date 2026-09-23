/*!
 * Emekli Zammı Motoru — SSK ve Bağ-Kur aylıklarının Ocak/Temmuz artışı
 *
 * KURAL (5510 s.K. m.55)
 *   Aylıklar her yıl Ocak ve Temmuz'da, bir önceki altı aylık dönemin TÜFE
 *   değişim oranı kadar artırılır:
 *       Ocak zammı   = önceki yılın Temmuz–Aralık TÜFE değişimi
 *       Temmuz zammı = aynı yılın Ocak–Haziran TÜFE değişimi
 *   Değişim aylık oranların BİLEŞİĞİDİR, toplamı değil: altı ay %2 art arda
 *   %12 değil %12,62 eder.
 *
 * DOĞRULAMA
 *   Seriden hesaplanan oran, açıklanmış dört resmî artışı iki ondalığa kadar
 *   veriyor (Ocak 2024 %37,57 · Temmuz 2024 %24,73 · Ocak 2025 %15,75 ·
 *   Temmuz 2025 %16,67). Test bunları sabitliyor.
 *
 * NE YAPMAZ
 *   Tahmin yapmaz. Açıklanmamış aylar için yalnızca senaryo hesaplar ve
 *   senaryonun varsayımını sonuçla birlikte döndürür. Kanunla verilen ek
 *   artışları (refah payı, seyyanen artış) ve en düşük aylık tabanını
 *   bilmez: onlar ayrı kanun ister, bu kural değil.
 *   4/c (memur) emeklileri bu kurala değil memur maaş artışına tabidir.
 *
 * Birimler: oranlar kesir (0.1575 = %15,75).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./tufe-serisi.js"));
  } else {
    root.EmekliZammiMotoru = factory(root.TufeSerisi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Tufe) {
  "use strict";

  var AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function anahtar(yil, ay) { return yil + "-" + (ay < 10 ? "0" : "") + ay; }

  function zamAyiDogrula(zamAyi) {
    if (zamAyi !== 1 && zamAyi !== 7) throw new Error("Zam ayı Ocak (1) ya da Temmuz (7) olmalı.");
  }

  /** Bir zammın dayandığı altı ay, sırayla: [{yil, ay}]. */
  function donemAylari(zamYili, zamAyi) {
    zamAyiDogrula(zamAyi);
    var out = [];
    for (var i = 0; i < 6; i++) {
      out.push(zamAyi === 1 ? { yil: zamYili - 1, ay: 7 + i } : { yil: zamYili, ay: 1 + i });
    }
    return out;
  }

  /** Bileşik değişim. Oranlar kesir. */
  function bilesik(oranlar) {
    var k = 1;
    for (var i = 0; i < oranlar.length; i++) k *= 1 + oranlar[i];
    return k - 1;
  }

  /**
   * Bir zam döneminin durumu: hangi aylar açıklandı, birikim ne.
   * seri verilmezse depodaki TÜFE serisi kullanılır (test için enjekte edilebilir).
   */
  function donem(zamYili, zamAyi, seri) {
    seri = seri || Tufe;
    var aylar = donemAylari(zamYili, zamAyi).map(function (a) {
      var k = anahtar(a.yil, a.ay);
      var v = seri.aylar[k];
      return {
        yil: a.yil, ay: a.ay, anahtar: k, ad: AY_ADLARI[a.ay - 1] + " " + a.yil,
        oran: v ? v.aylik / 100 : null
      };
    });
    var aciklanan = aylar.filter(function (a) { return a.oran !== null; });
    // Açıklanan aylar dönemin BAŞINDAN ardışık olmalı; araya boşluk düşmez.
    for (var i = 0; i < aciklanan.length; i++) {
      if (aylar[i].oran === null) throw new Error("Seride dönem içinde boşluk var: " + aylar[i].anahtar);
    }
    return {
      zamYili: zamYili,
      zamAyi: zamAyi,
      ad: AY_ADLARI[zamAyi - 1] + " " + zamYili,
      aylar: aylar,
      aciklananSayisi: aciklanan.length,
      eksikSayisi: 6 - aciklanan.length,
      birikim: bilesik(aciklanan.map(function (a) { return a.oran; })),
      kesin: aciklanan.length === 6
    };
  }

  /**
   * Eksik aylar için senaryo. aylikVarsayim: tek oran (her eksik aya) ya da
   * eksik ay sayısı kadar oran dizisi.
   */
  function senaryo(d, aylikVarsayim) {
    var ek = [];
    for (var i = 0; i < d.eksikSayisi; i++) {
      ek.push(Array.isArray(aylikVarsayim) ? aylikVarsayim[i] : aylikVarsayim);
    }
    ek.forEach(function (o) {
      if (typeof o !== "number" || !isFinite(o) || o <= -1) throw new Error("Geçersiz aylık varsayım.");
    });
    return (1 + d.birikim) * (1 + bilesik(ek)) - 1;
  }

  /** Geçen yılın aynı aylarının oranları — veriye dayalı, tahmin olmayan bir senaryo. */
  function gecenYilAyniAylar(d, seri) {
    seri = seri || Tufe;
    return d.aylar.slice(d.aciklananSayisi).map(function (a) {
      var v = seri.aylar[anahtar(a.yil - 1, a.ay)];
      if (!v) throw new Error("Geçen yılın verisi yok: " + anahtar(a.yil - 1, a.ay));
      return v.aylik / 100;
    });
  }

  /** Serinin son ayına göre sıradaki (ya da yeni kesinleşen) zam. */
  function siradaki(seri) {
    seri = seri || Tufe;
    var p = seri.sonAy.split("-");
    var yil = +p[0], ay = +p[1];
    return ay <= 6 ? { zamYili: yil, zamAyi: 7 } : { zamYili: yil + 1, zamAyi: 1 };
  }

  /** Resmî oran iki ondalıkla ilan edilir; aylığa o oran uygulanır. */
  function ilanOrani(oran) { return Math.round(oran * 10000) / 10000; }

  function yeniAylik(aylik, oran) {
    if (typeof aylik !== "number" || !isFinite(aylik) || aylik <= 0) throw new Error("Geçerli bir aylık girin.");
    return Math.round(aylik * (1 + ilanOrani(oran)) * 100) / 100;
  }

  /** Kesinleşmiş dönemler, yeniden eskiye. */
  function gecmis(ilkYil, seri) {
    seri = seri || Tufe;
    var s = siradaki(seri), out = [];
    var y = s.zamYili, a = s.zamAyi;
    for (;;) {
      var d = donem(y, a, seri);
      if (d.kesin) out.push({ ad: d.ad, zamYili: y, zamAyi: a, oran: d.birikim });
      if (a === 7) { a = 1; } else { a = 7; y--; }
      if (y < ilkYil) break;
    }
    return out;
  }

  return {
    AY_ADLARI: AY_ADLARI,
    donemAylari: donemAylari,
    bilesik: bilesik,
    donem: donem,
    senaryo: senaryo,
    gecenYilAyniAylar: gecenYilAyniAylar,
    siradaki: siradaki,
    ilanOrani: ilanOrani,
    yeniAylik: yeniAylik,
    gecmis: gecmis,
    kaynak: Tufe ? Tufe.kaynak : null,
    kaynakUrl: Tufe ? Tufe.kaynakUrl : null
  };
});
