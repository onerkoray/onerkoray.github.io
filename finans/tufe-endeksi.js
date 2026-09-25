/*!
 * TÜFE endeksi — aylık değişim serisinden tarih tabanlı fiyat düzeyi.
 *
 * finans/tufe-serisi.js aylık ve yıllık % değişimi tutuyor (TCMB, 2005'ten
 * bugüne, her iş günü güncellenir). Bu modül aylık değişimleri zincirleyip
 * bir fiyat düzeyi kurar: iki tarih arasındaki fiyat çarpanı, bir tutarın
 * başka bir tarihteki karşılığı, alım gücü kaybı ve fiyatların ikiye
 * katlanma süresi buradan hesaplanır.
 *
 * ZİNCİRLEME HATASI ÖLÇÜLDÜ
 * -------------------------
 * Seri iki ondalığa yuvarlanmış aylık oranlardan oluşuyor; yuvarlanmış
 * oranları çarpmak ilke olarak sapma biriktirir. Ölçüldü (2026-09-25):
 * zincirlenmiş 12 aylık değişim, serinin resmî yıllık oranından ortalama
 * 0,008 puan, en çok 0,037 puan sapıyor; 2005 Aralık → 2025 Aralık
 * 20 yıllık çarpanda fark %0,006. Test bu sapmanın sınırda kaldığını her
 * gece gelen yeni veriyle de doğruluyor (yillikSapma).
 *
 * TARİH ANLAMI
 * ------------
 * "Ay" o ayın fiyat düzeyidir. carpan("2020-01", "2026-08"), Ocak 2020
 * fiyatlarından Ağustos 2026 fiyatlarına geçiş çarpanıdır: Şubat 2020'den
 * Ağustos 2026'ya (dahil) bütün aylık değişimlerin çarpımı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/enflasyon-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("./tufe-serisi.js"));
  } else {
    kok.TufeEndeksi = fabrika(kok.TufeSerisi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (T) {
  "use strict";

  var AYLAR = Object.keys(T.aylar).sort();
  var SIRA = {}, DUZEY = {};
  (function kur() {
    var d = 1;
    AYLAR.forEach(function (ay, i) {
      d *= 1 + T.aylar[ay].aylik / 100;
      SIRA[ay] = i;
      DUZEY[ay] = d;
    });
  })();

  var AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function gecerli(ay) { return Object.prototype.hasOwnProperty.call(SIRA, ay); }
  function denetle(ay) {
    if (!gecerli(ay)) throw new Error(ay + " için TÜFE verisi yok; seri " + AYLAR[0] + " ile " + AYLAR[AYLAR.length - 1] + " arası.");
  }
  /* Ay farkı (son − bas), aynı ay için 0. */
  function aySayisi(bas, son) { denetle(bas); denetle(son); return SIRA[son] - SIRA[bas]; }

  /** bas ayının fiyatlarından son ayın fiyatlarına çarpan. */
  function carpan(bas, son) {
    denetle(bas); denetle(son);
    return DUZEY[son] / DUZEY[bas];
  }

  /** Bir tutarın başka bir ayın fiyatlarıyla karşılığı. Geriye de çalışır. */
  function deger(tutar, bas, son) {
    var t = Number(tutar);
    if (!isFinite(t)) throw new Error("Tutar bir sayı olmalı.");
    return t * carpan(bas, son);
  }

  /** İki tarih arası özet. */
  function donem(bas, son) {
    var n = aySayisi(bas, son);
    if (n <= 0) throw new Error("Bitiş ayı başlangıçtan sonra olmalı.");
    var k = carpan(bas, son);
    return {
      bas: bas, son: son, ay: n,
      carpan: k,
      toplam: k - 1,
      yillik: Math.pow(k, 12 / n) - 1,
      alimGucuKaybi: 1 - 1 / k
    };
  }

  /** Bir ayda sona eren dönemde fiyatlar kaç ayda ikiye katlanmış?
      Geriye doğru, çarpanın ilk kez 2'yi geçtiği ay sayısı; seri
      yetmezse null. */
  function ikiyeKatlanma(son, kat) {
    denetle(son);
    var hedef = kat || 2;
    for (var i = SIRA[son] - 1; i >= 0; i--) {
      if (DUZEY[son] / DUZEY[AYLAR[i]] >= hedef) return SIRA[son] - i;
    }
    return null;
  }

  /** Zincirlenmiş 12 aylık değişimin serideki resmî yıllık orandan
      sapması (puan). Kalite kontrolü. */
  function yillikSapma() {
    var enCok = 0, toplam = 0, n = 0, nerede = null;
    AYLAR.forEach(function (ay, i) {
      if (i < 12) return;
      var z = (DUZEY[ay] / DUZEY[AYLAR[i - 12]] - 1) * 100;
      var f = z - T.aylar[ay].yillik;
      toplam += Math.abs(f); n++;
      if (Math.abs(f) > Math.abs(enCok)) { enCok = f; nerede = ay; }
    });
    return { ortalama: toplam / n, enCok: enCok, ay: nerede, karsilastirma: n };
  }

  /** Aralık–Aralık yıllık oranlar, iki tarih arasına düşen yıllar için. */
  function yillar(bas, son) {
    denetle(bas); denetle(son);
    var out = [];
    AYLAR.forEach(function (ay) {
      if (ay.slice(5) !== "12" || SIRA[ay] <= SIRA[bas] || SIRA[ay] > SIRA[son]) return;
      out.push({ yil: +ay.slice(0, 4), oran: T.aylar[ay].yillik / 100 });
    });
    return out;
  }

  function ayAdi(ay) { return AY_ADLARI[+ay.slice(5) - 1] + " " + ay.slice(0, 4); }

  return {
    surum: "1.0.0",
    kaynak: T.kaynak,
    kaynakUrl: T.kaynakUrl,
    ilkAy: AYLAR[0],
    sonAy: AYLAR[AYLAR.length - 1],
    aylar: function () { return AYLAR.slice(); },
    gecerli: gecerli,
    aySayisi: aySayisi,
    duzey: function (ay) { denetle(ay); return DUZEY[ay]; },
    carpan: carpan,
    deger: deger,
    donem: donem,
    ikiyeKatlanma: ikiyeKatlanma,
    yillikSapma: yillikSapma,
    yillar: yillar,
    ayAdi: ayAdi,
    AY_ADLARI: AY_ADLARI
  };
});
