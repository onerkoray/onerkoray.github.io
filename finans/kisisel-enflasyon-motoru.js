/*!
 * Kişisel Enflasyon — kendi sepetinizin fiyat artışı
 *
 * SORU: "Resmî enflasyon %X" deniyor ama sizin hayatınız o kadar mı
 * pahalandı? Cevap sizin sepetinize bağlı ve HESAPLANABİLİR.
 *
 * NEDEN BÖYLE KURULDU: bu araç bir TÜFE serisi TAŞIMIYOR. Sitenin
 * kuralı, yayımlanan her parametrenin doğrulanabilir bir kaynağı olması;
 * hafızadan yazılmış bir endeks tablosu o kuralı çiğnerdi. Burada bütün
 * veri KULLANICININ KENDİ HARCAMASI — ve zaten anlatılmak istenen şey de
 * o: resmî oran bir sepet ORTALAMASIDIR, sizin sepetiniz ortalama değil.
 *
 * İKİ FARKLI SORU, İKİ FARKLI SAYI — VE BU AYRIM ARACIN KENDİSİ
 *
 * İlk yazımda tek bir oran üretiliyordu: bütün kalemlerin harcama payıyla
 * ağırlıklandırılmış değişimi. Test onu yakaladı, çünkü o sayı bir
 * ENFLASYON DEĞİL: harcama paylarıyla kurulduğunda cebirsel olarak toplam
 * harcama değişimine ÖZDEŞTİR —
 *
 *     Σ (xᵢ⁰/X⁰)·(xᵢ¹/xᵢ⁰ − 1) = Σ (xᵢ¹ − xᵢ⁰)/X⁰ = X¹/X⁰ − 1
 *
 * Yani "kişisel enflasyonunuz %40" diye sunulan şey aslında "harcamanız
 * %40 arttı" cümlesinin süslü hâliydi. İkisi aynı şey değil: daha ucuz
 * eve taşınmak harcamayı düşürür ama kiralar yine de artmıştır.
 *
 * Ayrım şöyle kuruluyor:
 *
 *   FİYAT ENDEKSİ (kişisel enflasyon) — yalnızca MİKTARI DEĞİŞMEYEN
 *   kalemler üzerinden, taban yıl ağırlıklarıyla Laspeyres:
 *       Σ ( wᵢ⁰ × (pᵢ¹/pᵢ⁰ − 1) ),  wᵢ⁰ = o kalemin sabit sepetteki payı
 *   Sabit sepet varsayımı burada gerçekten sağlanıyor, varsayılmıyor:
 *   kullanıcı miktarı değişen kalemi işaretliyor ve o kalem endeksten
 *   çıkıyor.
 *
 *   HARCAMA DEĞİŞİMİ — cüzdanınıza gerçekte ne olduğu. Miktar değişimi,
 *   yeni kalemler, bırakılan alışkanlıklar dahil.
 *
 *   SEPET ETKİSİ = harcama değişimi − fiyat endeksi. "Harcamanız %70
 *   arttı; bunun 50 puanı fiyat, 20 puanı sizin tercihleriniz."
 *
 * KATKI AYRIŞTIRMASI fiyat endeksinin üzerinde yapılıyor: her kalemin
 * orana kaç PUAN eklediği. "Enflasyonunuz %52" bir sayı; "bunun 19 puanı
 * kiradan geliyor" bir karardır.
 *
 * Reel dönüşüm finans/enflasyon-motoru.js'ten geliyor; burada ikinci bir
 * uygulama yazılmadı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/kisisel-enflasyon/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var E = nodeMi ? require("./enflasyon-motoru.js") : root.EnflasyonMotoru;
  var v = factory(E);
  if (nodeMi) module.exports = v;
  else root.KisiselEnflasyonMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (E) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }
  function r4(n) { return Math.round(n * 10000) / 10000; }

  /**
   * @param {Object} g
   *   kalemler    [{ad, once, simdi, miktarDegisti}] aylık TL
   *   gelirOnce   geçen yılki aylık net gelir (TL)
   *   gelirSimdi  bugünkü aylık net gelir (TL)
   *   resmiOran   karşılaştırma için resmî yıllık oran (ondalık, isteğe bağlı)
   */
  function analiz(g) {
    var kalemler = (g.kalemler || []).map(function (k) {
      return {
        ad: String(k.ad || "Kalem"),
        once: Math.max(0, Number(k.once) || 0),
        simdi: Math.max(0, Number(k.simdi) || 0),
        miktarDegisti: !!k.miktarDegisti
      };
    }).filter(function (k) { return k.once > 0 || k.simdi > 0; });

    if (!kalemler.length) return { hata: "En az bir gider kalemi girin." };

    var tabanToplam = kalemler.reduce(function (a, k) { return a + k.once; }, 0);
    var simdiToplam = kalemler.reduce(function (a, k) { return a + k.simdi; }, 0);
    if (!(tabanToplam > 0)) {
      return { hata: "Geçen yılın tutarları sıfırdan büyük olmalı." };
    }

    /* SABİT SEPET: miktarı değişmeyen ve geçen yıl da var olan kalemler.
       Fiyat endeksi YALNIZCA bunlar üzerinden kuruluyor; ağırlıklar da bu
       alt sepetin kendi içindeki paylar (tüm sepetin payları değil, yoksa
       ağırlıklar 1'e toplanmazdı). */
    var sabitler = kalemler.filter(function (k) {
      return !k.miktarDegisti && k.once > 0;
    });
    var sabitTaban = sabitler.reduce(function (a, k) { return a + k.once; }, 0);

    var katkilar = kalemler.map(function (k) {
      var yeniMi = k.once === 0;
      var sabitMi = !k.miktarDegisti && !yeniMi;
      var degisim = yeniMi ? null : (k.simdi / k.once) - 1;
      /* Endeks ağırlığı yalnızca sabit sepet üyelerinde tanımlı. */
      var agirlik = (sabitMi && sabitTaban > 0) ? k.once / sabitTaban : 0;
      return {
        ad: k.ad,
        once: r2(k.once),
        simdi: r2(k.simdi),
        /* Sepetteki payı (bilgi amaçlı, tüm sepet üzerinden) */
        pay: r4(k.once / tabanToplam),
        agirlik: r4(agirlik),
        degisim: degisim === null ? null : r4(degisim),
        katki: sabitMi ? r4(agirlik * degisim) : 0,
        endekste: sabitMi,
        miktarDegisti: k.miktarDegisti,
        yeniMi: yeniMi
      };
    });

    /* FİYAT ENDEKSİ — sabit sepet yoksa hesaplanamaz, uydurulmaz. */
    var kisisel = sabitTaban > 0
      ? r4(katkilar.reduce(function (a, k) { return a + k.katki; }, 0))
      : null;

    /* HARCAMA DEĞİŞİMİ — cüzdana gerçekte ne olduğu. */
    var harcamaDegisimi = r4(simdiToplam / tabanToplam - 1);

    /* SEPET ETKİSİ — ikisinin farkı: fiyat olmayan kısım. */
    var sepetEtkisi = kisisel === null ? null : r4(harcamaDegisimi - kisisel);

    var sirali = katkilar.slice().sort(function (a, b) { return b.katki - a.katki; });
    var endekstekiler = sirali.filter(function (k) { return k.endekste; });
    var enBuyuk = endekstekiler[0] || null;

    /* Gelir tarafı: zam kişisel enflasyonu geçti mi? */
    var gOnce = Math.max(0, Number(g.gelirOnce) || 0);
    var gSimdi = Math.max(0, Number(g.gelirSimdi) || 0);
    var gelirArtisi = gOnce > 0 ? r4(gSimdi / gOnce - 1) : null;
    /* Reel değişim BÖLME ile. Çıkarma, yüksek oranlarda puanlarca sapar.
       Karşılaştırma FİYAT ENDEKSİNE göre: alım gücü sorusunun muhatabı
       fiyatlardır, sizin tercihleriniz değil. */
    var reelDegisim = (gelirArtisi === null || kisisel === null)
      ? null : r4(E.reel(gelirArtisi, kisisel));

    var resmi = (g.resmiOran === undefined || g.resmiOran === null ||
      !isFinite(Number(g.resmiOran))) ? null : Number(g.resmiOran);
    var resmiFark = (resmi === null || kisisel === null) ? null : r4(kisisel - resmi);
    var reelResmi = (gelirArtisi === null || resmi === null)
      ? null : r4(E.reel(gelirArtisi, resmi));

    return {
      kisiselEnflasyon: kisisel,
      harcamaDegisimi: harcamaDegisimi,
      sepetEtkisi: sepetEtkisi,
      sabitSepetPayi: r4(sabitTaban / tabanToplam),
      miktarDegisenVar: katkilar.some(function (k) { return k.miktarDegisti; }),
      yeniKalemVar: katkilar.some(function (k) { return k.yeniMi; }),
      katkilar: sirali,
      enBuyukKatki: enBuyuk,
      tabanToplam: r2(tabanToplam),
      simdiToplam: r2(simdiToplam),
      gelirOnce: r2(gOnce),
      gelirSimdi: r2(gSimdi),
      gelirArtisi: gelirArtisi,
      reelDegisim: reelDegisim,
      gelirYetti: reelDegisim === null ? null : reelDegisim >= 0,
      resmiOran: resmi,
      resmiFark: resmiFark,
      reelResmiyle: reelResmi,
      /* Zam, fiyat endeksini tam karşılasaydı gelir ne olmalıydı? */
      gerekenGelir: (gOnce > 0 && kisisel !== null) ? r2(gOnce * (1 + kisisel)) : null,
      gelirAcigi: (gOnce > 0 && gSimdi > 0 && kisisel !== null)
        ? r2(gOnce * (1 + kisisel) - gSimdi) : null
    };
  }

  /**
   * Alım gücü: bugünkü tutar, kişisel enflasyon bu hızda sürerse
   * N yıl sonra bugünün parasıyla ne eder?
   */
  function alimGucu(tutar, oran, yillar) {
    var t = Math.max(0, Number(tutar) || 0);
    var o = Number(oran) || 0;
    var n = Math.max(0, Math.round(Number(yillar) || 0));
    var seri = [];
    for (var i = 0; i <= n; i++) {
      seri.push({
        yil: i,
        deger: r2(t / Math.pow(1 + o, i)),
        oran: r4(1 / Math.pow(1 + o, i))
      });
    }
    return {
      seri: seri,
      sonDeger: seri.length ? seri[seri.length - 1].deger : t,
      yarilanma: o > 0 ? r2(Math.log(2) / Math.log(1 + o)) : null
    };
  }

  return { analiz: analiz, alimGucu: alimGucu };
});
