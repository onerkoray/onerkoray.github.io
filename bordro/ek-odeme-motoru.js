/*!
 * Prim / ikramiye / ek ödeme — marjinal vergi ve zamanlama motoru
 *
 * SORU: maaşınızın üstüne gelen tek seferlik bir ödemenin (prim, ikramiye,
 * bonus, huzur hakkı, birikmiş fazla mesai, izin ödemesi) NE KADARI elinize
 * geçer — ve zamanlaması bunu değiştirir mi?
 *
 * BURADA YENİ VERGİ MATEMATİĞİ YOK. Her sonuç, bordro motorunun 12 aylık
 * hesabının İKİ KEZ koşulup farkının alınmasıyla üretiliyor. Sebebi: ek
 * ödemenin vergisi kendi başına hesaplanamaz, çünkü kümülatif matrahın
 * üstüne biner. "Ortalama vergi oranım %22, demek ki primin %22'si gider"
 * yaygın ve pahalı bir yanılgı; doğru cevap MARJİNAL orandır.
 *
 * ÜÇ ÖLÇÜLMÜŞ GERÇEK (varsayım değil; testlerde sabitlendi)
 *
 *   1. YIL İÇİNDE HANGİ AY ALDIĞINIZ GELİR VERGİSİNİ DEĞİŞTİRMEZ.
 *      Kümülatif tarifede aylık vergi artışları teleskopik toplanır:
 *      yıl toplamı yalnızca YIL TOPLAM MATRAHINA bağlıdır, dağılımına
 *      değil. Piyasadaki "ikramiyeni Aralık'ta al, vergiden kaç" tavsiyesi
 *      bu yüzden yanlıştır.
 *
 *   2. AY YİNE DE FARK EDER — AMA SGK TAVANI ÜZERİNDEN.
 *      Tavan AYLIKTIR. Ödemeyi taban ücretinizin zaten yüksek olduğu bir
 *      aya koyarsanız, ödemenin daha büyük kısmı tavanın ÜSTÜNDE kalır ve
 *      prim kesilmez. Temmuzda zam alan 80.000 -> 160.000 TL'lik bir örnekte
 *      200.000 TL'lik ödeme için ölçülen fark: 6.869 TL net.
 *      (Bu bir "kaçırma" değil: tavan üstü kazançtan prim alınmaması
 *      kanunun kendisidir. Karşılığında emeklilik matrahına da girmez —
 *      araç bunu kullanıcıya söylüyor.)
 *
 *   3. TEK SEFERDE ALMAK, BÖLEREK ALMAKTAN İYİDİR (net eline geçen için).
 *      Aynı sebep: bölerek alınca her parça tavanın altında kalır ve
 *      tamamından prim kesilir. 100.000 TL maaş + 300.000 TL ödeme örneğinde
 *      ölçülen fark: 11.249 TL.
 *
 * YIL SINIRI KONUSUNDA DÜRÜSTLÜK: "gelecek yıla ertele" tavsiyesi, iki yıl
 * AYNI ise matematiksel olarak sıfır kazandırır (simetri). Gelecek yılın
 * tarifesi de açıklanmadığı için bu motor bir kazanç VAADETMEZ; yalnızca
 * iki yılın farklı olduğu durumu (zam, işten ayrılma, kısmi yıl) kullanıcı
 * girdisiyle hesaplar.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/prim-ikramiye-vergisi/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var B = nodeMi ? require("./motor.js") : root.Bordro;
  var v = factory(B);
  if (nodeMi) module.exports = v;
  else root.EkOdemeMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  /** Taban maaş dizisi: sayı ise 12 aya yayılır, dizi ise olduğu gibi. */
  function tabanDizi(aylikBrut) {
    if (Array.isArray(aylikBrut)) {
      var d = [];
      for (var i = 0; i < 12; i++) d.push(Number(aylikBrut[i]) || 0);
      return d;
    }
    var m = Number(aylikBrut) || 0, a = [];
    for (var j = 0; j < 12; j++) a.push(m);
    return a;
  }

  /** Diziye, verilen aylara verilen tutarları ekler (kopya döner). */
  function ekle(taban, dagitim) {
    var a = taban.slice();
    for (var ay in dagitim) {
      if (!Object.prototype.hasOwnProperty.call(dagitim, ay)) continue;
      var i = Number(ay) - 1;
      if (i >= 0 && i < 12) a[i] += dagitim[ay];
    }
    return a;
  }

  function yilOzeti(brut12, yil, sec) {
    return B.hesaplaYil(brut12, yil, sec).toplam;
  }

  /**
   * Bir dağıtımın MARJİNAL etkisi: ödemeli yıl ile ödemesiz yılın farkı.
   * Ek ödemenin vergisi başka türlü doğru hesaplanamaz.
   */
  function marjinal(taban, dagitim, yil, sec) {
    var yok = yilOzeti(taban, yil, sec);
    var var_ = yilOzeti(ekle(taban, dagitim), yil, sec);
    var tutar = 0;
    for (var k in dagitim) {
      if (Object.prototype.hasOwnProperty.call(dagitim, k)) tutar += dagitim[k];
    }
    return {
      tutar: r2(tutar),
      eleGecen: r2(var_.net - yok.net),
      gelirVergisi: r2(var_.gelirVergisi - yok.gelirVergisi),
      sgk: r2(var_.sgk - yok.sgk),
      issizlik: r2(var_.issizlik - yok.issizlik),
      damga: r2(var_.damga - yok.damga),
      isverenMaliyeti: r2(var_.isverenMaliyeti - yok.isverenMaliyeti),
      yilNeti: r2(var_.net),
      yilNetiEksiz: r2(yok.net)
    };
  }

  /**
   * @param {Object} g
   *   aylikBrut   sayı veya 12 elemanlı dizi (TL, brüt)
   *   tutar       ek ödeme (TL, brüt)
   *   ay          ödemenin yapılacağı ay (1-12)
   *   yil         bordro yılı
   *   secenekler  bordro motoruna geçer (primsiz, tesvik5Puan, agiOrani)
   */
  function analiz(g) {
    var yil = Number(g.yil) || B.sonYil();
    var sec = g.secenekler || {};
    var tutar = Math.max(0, Number(g.tutar) || 0);
    var ay = Math.min(12, Math.max(1, Math.round(Number(g.ay) || 1)));
    var taban = tabanDizi(g.aylikBrut);

    if (!(tutar > 0)) return { hata: "Ek ödeme tutarı sıfırdan büyük olmalı." };
    if (!taban.some(function (x) { return x > 0; })) {
      return { hata: "Aylık brüt maaş sıfırdan büyük olmalı." };
    }

    var d = {}; d[ay] = tutar;
    var m = marjinal(taban, d, yil, sec);

    /* Ödemenin kendi üzerindeki efektif kesinti oranı. Kullanıcının
       aklındaki "vergi dilimim" bu değildir: SGK ve damga da buraya girer,
       asgari ücret istisnası ise düşürür. */
    var efektifKesinti = tutar > 0 ? (tutar - m.eleGecen) / tutar : 0;

    /* MAAŞIN ORTALAMA KESİNTİ ORANI ile karşılaştırma.
     *
     * "Ortalama kesintim %30, primin de %30'u gider" yaygın hesap. Yanlış —
     * ama ÖLÇTÜĞÜMÜZDE hangi yöne yanlış olduğu sabit değil, SGK tavanına
     * göre YÖN DEĞİŞTİRİYOR:
     *   tavanın ALTINDAKİ maaşta marjinal > ortalama (artan oranlı tarife
     *     baskın; 100.000 TL maaşta ölçülen: %38,6'ya karşı %30,5),
     *   tavanın ÜSTÜNDEKİ maaşta marjinal < ortalama (ek ödemeden hiç prim
     *     kesilmez; 300.000 TL maaşta ölçülen: %35,8'e karşı %39,4).
     * Yani ortalamayla yapılan tahmin kimini fazla, kimini eksik korkutuyor.
     * Arayüz bunu söyleyebilsin diye iki oran da dönüyor.
     */
    var yilOzet = B.hesaplaYil(taban, yil, sec).toplam;
    var ortalamaKesinti = yilOzet.brut > 0
      ? (yilOzet.brut - yilOzet.net) / yilOzet.brut : 0;

    /* 12 ayın tamamı koşuluyor. Yaklaşık formül kullanılmıyor çünkü SGK
       tavanı aylık ve taban maaş aylar arasında değişebiliyor. */
    var aylar = [];
    var enIyi = null, enKotu = null;
    for (var k = 1; k <= 12; k++) {
      var dk = {}; dk[k] = tutar;
      var mk = marjinal(taban, dk, yil, sec);
      var satir = {
        ay: k, ayAdi: B.AY_ADLARI[k - 1],
        eleGecen: mk.eleGecen, sgk: r2(mk.sgk + mk.issizlik),
        gelirVergisi: mk.gelirVergisi, damga: mk.damga,
        tabanBrut: r2(taban[k - 1])
      };
      aylar.push(satir);
      if (!enIyi || satir.eleGecen > enIyi.eleGecen) enIyi = satir;
      if (!enKotu || satir.eleGecen < enKotu.eleGecen) enKotu = satir;
    }
    var ayFarki = r2(enIyi.eleGecen - enKotu.eleGecen);

    /* Gelir vergisi ayla DEĞİŞMİYOR mu? İddia edilmiyor, ölçülüyor.
       Değişiyorsa sebebi SGK matrahının değişmesidir (tavan), tarifenin
       kendisi değil — arayüz bu ayrımı kullanıcıya söyleyebilsin diye
       ayrı bir alan olarak dönüyor. */
    var vergiler = aylar.map(function (s) { return s.gelirVergisi; });
    var vergiYayilimi = r2(Math.max.apply(null, vergiler) - Math.min.apply(null, vergiler));
    var sgkler = aylar.map(function (s) { return s.sgk; });
    var sgkYayilimi = r2(Math.max.apply(null, sgkler) - Math.min.apply(null, sgkler));

    return {
      yil: yil,
      ay: ay,
      ayAdi: B.AY_ADLARI[ay - 1],
      tutar: r2(tutar),
      eleGecen: m.eleGecen,
      gelirVergisi: m.gelirVergisi,
      sgk: r2(m.sgk + m.issizlik),
      damga: m.damga,
      isverenMaliyeti: m.isverenMaliyeti,
      efektifKesinti: efektifKesinti,
      ortalamaKesinti: ortalamaKesinti,
      /* "+" ise ortalamayla yapılan tahmin ek ödemeyi OLDUĞUNDAN İYİ
         gösteriyor demektir (gerçek kesinti daha yüksek), "−" ise tersi. */
      marjinalFarki: efektifKesinti - ortalamaKesinti,
      yilNeti: m.yilNeti,
      yilNetiEksiz: m.yilNetiEksiz,
      aylar: aylar,
      enIyiAy: enIyi,
      enKotuAy: enKotu,
      ayFarki: ayFarki,
      ayOnemliMi: ayFarki > 1,
      vergiYayilimi: vergiYayilimi,
      sgkYayilimi: sgkYayilimi
    };
  }

  /**
   * Tek seferde mi, parçalara bölerek mi?
   * SGK tavanı aylık olduğu için bölmek kesintiyi ARTIRIR; bu fonksiyon
   * farkı tahmin etmiyor, her seçeneği ayrı ayrı koşuyor.
   */
  function bolmeKarsilastirmasi(g, parcalar) {
    var yil = Number(g.yil) || B.sonYil();
    var sec = g.secenekler || {};
    var tutar = Math.max(0, Number(g.tutar) || 0);
    var ay = Math.min(12, Math.max(1, Math.round(Number(g.ay) || 1)));
    var taban = tabanDizi(g.aylikBrut);
    var liste = parcalar || [1, 2, 3, 4, 6, 12];

    var sonuc = liste.map(function (n) {
      var d = {};
      /* Parçalar seçilen aydan başlayarak ardışık aylara dağıtılıyor;
         yıl sonunu aşanlar başa sarmıyor, sıkıştırılıyor ki 12 aylık
         çerçevenin dışına taşan sahte bir senaryo üretilmesin. */
      var baslangic = Math.min(ay, 12 - n + 1);
      if (baslangic < 1) baslangic = 1;
      for (var i = 0; i < n; i++) {
        var a = baslangic + i;
        d[a] = (d[a] || 0) + tutar / n;
      }
      var m = marjinal(taban, d, yil, sec);
      return {
        parca: n,
        baslangicAy: baslangic,
        eleGecen: m.eleGecen,
        sgk: r2(m.sgk + m.issizlik),
        gelirVergisi: m.gelirVergisi
      };
    });

    var enIyi = sonuc.reduce(function (a, b) { return b.eleGecen > a.eleGecen ? b : a; });
    var enKotu = sonuc.reduce(function (a, b) { return b.eleGecen < a.eleGecen ? b : a; });
    return {
      secenekler: sonuc,
      enIyi: enIyi,
      enKotu: enKotu,
      fark: r2(enIyi.eleGecen - enKotu.eleGecen)
    };
  }

  /**
   * Ödeme büyüdükçe elde kalan oran nasıl değişiyor?
   *
   * BEKLENEN CEVAP YANLIŞ. "Ödeme büyüdükçe oran düşer" sezgisi, ölçünce
   * tutmuyor: oran önce ARTIYOR, sonra azalıyor. Sebep iki kuvvetin ters
   * yönde çalışması —
   *   SGK tavanı: ödeme büyüdükçe daha fazlası tavanın üstünde kalır,
   *               prim yükü ORANSAL OLARAK DÜŞER (tek yönlü),
   *   tarife    : ödeme büyüdükçe üst dilimlere girilir, gelir vergisi
   *               yükü ORANSAL OLARAK ARTAR (tek yönlü).
   * Toplam bu ikisinin yarışıdır ve bir TEPE noktası vardır: prim rahatlaması
   * tükendiği, tarifenin devraldığı tutar. 100.000 TL maaşta ölçülen tepe
   * 500.000 TL civarındadır (%67,9 elde kalır); 3.000.000 TL'de %64,9'a iner.
   *
   * Eğri bu yüzden formülle değil, her noktada tam hesap koşularak üretiliyor.
   */
  function tutarEgrisi(g, noktalar) {
    var yil = Number(g.yil) || B.sonYil();
    var sec = g.secenekler || {};
    var ay = Math.min(12, Math.max(1, Math.round(Number(g.ay) || 1)));
    var taban = tabanDizi(g.aylikBrut);
    var tutar = Math.max(0, Number(g.tutar) || 0);

    var liste = noktalar;
    if (!liste || !liste.length) {
      /* Kullanıcının tutarı eğrinin ORTASINDA kalsın ki kendi noktasını
         eğri üzerinde görebilsin; uçlar tepeyi kapsayacak kadar geniş. */
      var ust = Math.max(tutar * 4, 600000);
      liste = [];
      for (var i = 1; i <= 12; i++) liste.push(Math.round(ust * i / 12 / 1000) * 1000);
      if (tutar > 0 && liste.indexOf(tutar) < 0) liste.push(Math.round(tutar));
      liste.sort(function (a, b) { return a - b; });
    }

    var egri = liste.filter(function (t) { return t > 0; }).map(function (t) {
      var d = {}; d[ay] = t;
      var m = marjinal(taban, d, yil, sec);
      return {
        tutar: t,
        eleGecen: m.eleGecen,
        kalanOran: m.eleGecen / t,
        vergiOrani: m.gelirVergisi / t,
        sgkOrani: (m.sgk + m.issizlik) / t
      };
    });

    var tepe = egri.reduce(function (a, b) { return b.kalanOran > a.kalanOran ? b : a; }, egri[0]);
    return {
      egri: egri,
      tepe: tepe,
      /* Tepe uçlarda değilse eğri gerçekten tek yönlü değil demektir. */
      tekYonluDegil: !!(egri.length > 2 && tepe !== egri[0] && tepe !== egri[egri.length - 1])
    };
  }

  /**
   * Isı haritası için: x = ödeme ayı, y = ödeme tutarı.
   * Hücre değeri, o ayda almanın 12 ay ORTALAMASINA göre farkı — iki yana
   * ayrışan bir değer, çünkü soru "hangi aylar iyi, hangileri kötü".
   */
  function duyarlilik(g, secenek) {
    secenek = secenek || {};
    var xler = secenek.x || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    var yler = secenek.y;
    if (!yler || !yler.length) {
      var t = Math.max(0, Number(g.tutar) || 0);
      yler = [];
      for (var p = 1; p <= 5; p++) yler.push(Math.round(t * p / 3 / 1000) * 1000);
    }
    var yil = Number(g.yil) || B.sonYil();
    var sec = g.secenekler || {};
    var taban = tabanDizi(g.aylikBrut);

    var hucreler = [], enBuyuk = 0, arti = false, eksi = false;
    for (var j = 0; j < yler.length; j++) {
      var ham = [], toplam = 0;
      for (var k = 0; k < xler.length; k++) {
        var d = {}; d[xler[k]] = yler[j];
        var e = yler[j] > 0 ? marjinal(taban, d, yil, sec).eleGecen : 0;
        ham.push(e); toplam += e;
      }
      var ort = toplam / (xler.length || 1);
      var satir = [];
      for (var n = 0; n < xler.length; n++) {
        var fark = r2(ham[n] - ort);
        if (fark > 0) arti = true; else if (fark < 0) eksi = true;
        if (Math.abs(fark) > enBuyuk) enBuyuk = Math.abs(fark);
        satir.push({ x: xler[n], y: yler[j], deger: fark, eleGecen: ham[n] });
      }
      hucreler.push(satir);
    }
    return {
      x: xler, y: yler, hucreler: hucreler,
      enBuyukMutlak: enBuyuk, sinirVar: arti && eksi
    };
  }

  return {
    analiz: analiz,
    marjinal: marjinal,
    tutarEgrisi: tutarEgrisi,
    bolmeKarsilastirmasi: bolmeKarsilastirmasi,
    duyarlilik: duyarlilik,
    tabanDizi: tabanDizi,
    ekle: ekle
  };
});
