/*!
 * Katılım bankacılığının %15 hedefi: iki ölçüt, iki sonuç.
 *
 * HEDEF (TKBB)
 *   Türkiye Katılım Bankacılığı Strateji Belgesi (2015-2025): 2025'te
 *   bankacılık sektöründe %15 pay. Strateji Güncelleme Raporu (2021-2025)
 *   bu hedefi korur ve buna göre 2025'te katılım aktiflerinin 1,77 trilyon
 *   TL'ye ulaşmasını bekler. Haberlerde geçen "300 milyar dolar aktif"
 *   hedefi güncelleme raporunda yok ve 2015 belgesinin kendisine
 *   erişilemedi (TKBB sunucusu dosyayı vermiyor); bu yüzden kullanılmıyor.
 *
 * VERİ (BDDK Aylık Bülten, bddk-2026-08.json)
 *   Toplam aktif, üç banka grubu: mevduat, katılım, kalkınma ve yatırım.
 *   Sektör = üçünün toplamı. TL ve USD. Aralık sonları ve son ay.
 *   Aralık 2025 katılım aktifi 4.327.036 milyon TL ve payı %9,22: TKBB 2025
 *   Faaliyet Raporu'ndaki "4 trilyon 327 milyar TL" ve "%9,2" ile aynı.
 *
 * ENFLASYON (finans/endeksleme-serileri.js)
 *   Aralık–Aralık TÜFE; 2020 sonundan 2025 sonuna birikmiş çarpan.
 *
 * DÜNYA (dunya-2024.json)
 *   ICD–LSEG Islamic Finance Development Report 2025, TKBB 2025 Faaliyet
 *   Raporu s.44'teki aktarımıyla: 2024 İslami bankacılık varlıkları ve ilk
 *   on ülke. Raporun kendisine erişilemedi; IFSB sitesi otomatik istekleri
 *   engelliyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("./bddk-2026-08.json"), require("./dunya-2024.json"),
      require("../../finans/endeksleme-serileri.js"));
  } else {
    kok.Katilim = fabrika(kok.KATILIM_BDDK, kok.KATILIM_DUNYA, kok.EndekslemeSerileri);
  }
})(typeof self !== "undefined" ? self : this, function (V, W, S) {
  "use strict";

  var HEDEF = { yil: 2025, pay: 15, tlTrilyon: 1.77 };
  var BASLANGIC = 2015;            // hedefin konduğu yıl
  var GUNCELLEME = 2020;           // güncelleme raporu 2020 sonu verisiyle yazıldı
  var SON = Object.keys(V.TL).sort().pop();

  function anahtar(y) { return typeof y === "number" ? y + "-12" : y; }
  function satir(y, para) {
    var r = V[para || "TL"][anahtar(y)];
    if (!r) throw new Error("BDDK verisi yok: " + y);
    return { mevduat: r.mevduat, katilim: r.katilim, kalkinma: r.kalkinma, sektor: r.mevduat + r.katilim + r.kalkinma };
  }
  function pay(y) { var r = satir(y); return r.katilim / r.sektor * 100; }

  /** Aralık sonları ve son ay: pay seri. */
  function seri() {
    return Object.keys(V.TL).sort().map(function (k) {
      var r = satir(k), u = satir(k, "USD");
      return { ay: k, yil: +k.slice(0, 4), aralik: k.slice(5) === "12", pay: r.katilim / r.sektor * 100, katilimTL: r.katilim, sektorTL: r.sektor, katilimUSD: u.katilim, sektorUSD: u.sektor };
    });
  }

  /** İki ölçüt: pay ve TL aktif. Gerçekleşen / hedef. */
  function olcutler() {
    var r = satir(HEDEF.yil);
    var p = r.katilim / r.sektor * 100, tl = r.katilim / 1e6;
    return [
      { ad: "Sektördeki pay", hedef: HEDEF.pay, gercek: p, birim: "%", oran: p / HEDEF.pay },
      { ad: "Aktif büyüklüğü", hedef: HEDEF.tlTrilyon, gercek: tl, birim: "trilyon TL", oran: tl / HEDEF.tlTrilyon }
    ];
  }

  /** TL hedefini enflasyon tek başına aşar mıydı? */
  function enflasyon() {
    var k = S.birikmisTufe(GUNCELLEME + 1, HEDEF.yil + 1);   // Ara 2020 → Ara 2025
    var a = satir(GUNCELLEME), b = satir(HEDEF.yil);
    return {
      tufe: k,
      katilim2020: a.katilim, katilim2025: b.katilim,
      sadeceEnflasyon: a.katilim * k,                          // reel büyüme sıfır olsaydı
      katilimNominal: b.katilim / a.katilim, katilimReel: b.katilim / a.katilim / k,
      sektorNominal: b.sektor / a.sektor, sektorReel: b.sektor / a.sektor / k,
      /* Güncelleme raporunun örtük varsayımı: 1,77 trilyon TL = sektörün %15'i. */
      ortukSektor: HEDEF.tlTrilyon * 1e6 / (HEDEF.pay / 100), gercekSektor: b.sektor
    };
  }

  /** %15 için 2025 sonunda gereken katılım aktifi (diğer gruplar sabitken). */
  function gereken() {
    var r = satir(HEDEF.yil), diger = r.mevduat + r.kalkinma;
    var k = HEDEF.pay / (100 - HEDEF.pay) * diger;
    return { tutar: k, kat: k / r.katilim };
  }

  /** Bu hızla %15 ne zaman? Aritmetik; tahmin değil. */
  function hiz() {
    var p0 = pay(BASLANGIC), p1 = pay(HEDEF.yil), p2 = pay(SON);
    var ay = (+SON.slice(0, 4) - HEDEF.yil) * 12 + (+SON.slice(5) - 12);
    var yillik10 = (p1 - p0) / (HEDEF.yil - BASLANGIC), yillikSon = (p2 - p1) / (ay / 12);
    function yil(baslangicYil, p, h) { return baslangicYil + (HEDEF.pay - p) / h; }
    return {
      pay2015: p0, pay2025: p1, paySon: p2, son: SON, ay: ay,
      yillik10: yillik10, yil10: yil(HEDEF.yil, p1, yillik10),
      yillikSon: yillikSon, yilSon: yil(+SON.slice(0, 4) + (+SON.slice(5)) / 12, p2, yillikSon)
    };
  }

  /** Dolar bazında büyüme 2015 → 2025. */
  function dolar() {
    var a = satir(BASLANGIC, "USD"), b = satir(HEDEF.yil, "USD");
    return { katilim2015: a.katilim, katilim2025: b.katilim, katilimKat: b.katilim / a.katilim, sektorKat: b.sektor / a.sektor };
  }

  function dunya() {
    var t = W.ulkeler.slice().sort(function (a, b) { return b.milyar - a.milyar; });
    var tr = t.filter(function (u) { return u.ulke === "Türkiye"; })[0];
    return { toplam: W.toplamMilyar, ulkeler: t, turkiye: tr, sira: t.indexOf(tr) + 1, payi: tr.milyar / W.toplamMilyar * 100 };
  }

  return { HEDEF: HEDEF, SON: SON, VERI: V, DUNYA: W, satir: satir, pay: pay, seri: seri, olcutler: olcutler,
    enflasyon: enflasyon, gereken: gereken, hiz: hiz, dolar: dolar, dunya: dunya };
});
