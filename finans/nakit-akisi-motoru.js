/*!
 * Nakit Akışı — akış modeli ve ömür bedeli
 *
 * SORU: paranız nereden gelip nereye gidiyor, ve o gidişlerin her biri
 * size ÖMÜR BOYU neye mal oluyor?
 *
 * BU ARAÇ NEDEN VAR: sitedeki diğer araçlar tek bir kararı inceliyor.
 * Bu, sistemin TAMAMINI tek resimde gösteriyor — işveren maliyetinden
 * başlayıp gelecekteki reel servete kadar. Aradaki her düğüm bir karar
 * noktası ve her giderin bir ömür bedeli var.
 *
 * ÜÇ TASARIM KARARI
 *
 * 1. AKIŞ İŞVEREN MALİYETİNDEN BAŞLAR, BRÜTTEN DEĞİL.
 *    Brütten başlamak, ücretin üzerindeki yükün yarısını görünmez kılıyor.
 *    İşveren SGK payı da sizin emeğinizin karşılığıdır; harcanabilir
 *    gelire dönüşmemesi onu yok saymayı gerektirmez.
 *
 * 2. TASARRUF ORANI NET GELİR ÜZERİNDEN TANIMLANIR.
 *    Brüt üzerinden hesaplanan tasarruf oranı daha küçük ve daha
 *    "kötü" görünür ama karar açısından anlamsızdır: vergiyi harcama
 *    olarak kısamazsınız. Finansal bağımsızlık literatüründeki oran da
 *    harcanabilir gelir üzerinedir. Araç bunu açıkça yazıyor.
 *
 * 3. ÖMÜR BEDELİ REEL HESAPLANIR.
 *    Aylık bir gider enflasyonla büyür; yatırım getirisi nominaldir.
 *    İkisini nominal olarak toplamak, giderin bedelini abartır. Burada
 *    reel getiri (bölme yöntemiyle) kullanılıyor ve sonuç BUGÜNÜN
 *    PARASIYLA veriliyor.
 *
 * Bordro matematiği bordro/motor.js'ten, zaman değeri
 * finans/zaman-motoru.js'ten, reel dönüşüm finans/enflasyon-motoru.js'ten
 * geliyor. Burada yeni finansal formül yazılmadı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/nakit-akisi-analizi/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var B = nodeMi ? require("../bordro/motor.js") : root.Bordro;
  var Z = nodeMi ? require("./zaman-motoru.js") : root.ZamanMotoru;
  var E = nodeMi ? require("./enflasyon-motoru.js") : root.EnflasyonMotoru;
  var v = factory(B, Z, E);
  if (nodeMi) module.exports = v;
  else root.NakitAkisiMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, Z, E) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  /**
   * Ücretten nete: bordro motorunun 12 aylık hesabının aylık ortalaması.
   *
   * NEDEN ORTALAMA: kümülatif tarifede net ücret yıl içinde DÜŞER
   * (dilim ilerledikçe). Tek bir ayı almak, hangi ayı seçtiğinize göre
   * farklı bir resim çizerdi. Yıllık toplamı 12'ye bölmek, akışın
   * tamamını temsil eden tek dürüst sayıdır — ve sayfa bunu söylüyor.
   */
  function ucretten(brutAylik, yil, sec) {
    var y = B.hesaplaYil(brutAylik, yil, sec).toplam;
    return {
      brut: r2(y.brut / 12),
      gelirVergisi: r2(y.gelirVergisi / 12),
      sgkIsci: r2((y.sgk + y.issizlik) / 12),
      damga: r2(y.damga / 12),
      net: r2(y.net / 12),
      isverenMaliyeti: r2(y.isverenMaliyeti / 12),
      isverenPayi: r2((y.isverenMaliyeti - y.brut) / 12)
    };
  }

  /**
   * @param {Object} g
   *   aylikBrut      TL (ücret geliri)
   *   digerGelir     TL/ay — kira, freelance vb. (vergisi kullanıcıdan net)
   *   giderler       [{ad, tutar, zorunlu}] TL/ay
   *   yil            bordro yılı
   *   getiri         yatırımın NOMİNAL yıllık getirisi (ondalık)
   *   enflasyon      yıllık (ondalık)
   *   ufukYil        ömür bedeli ufku (yıl)
   *   secenekler     bordro motoruna geçer
   */
  function analiz(g) {
    var yil = Number(g.yil) || B.sonYil();
    var sec = g.secenekler || {};
    var brut = Math.max(0, Number(g.aylikBrut) || 0);
    var diger = Math.max(0, Number(g.digerGelir) || 0);
    var getiri = Number(g.getiri) || 0;
    var enf = Number(g.enflasyon) || 0;
    var ufuk = Math.max(1, Math.round(Number(g.ufukYil) || 10));

    var kalemler = (g.giderler || []).map(function (k) {
      return {
        ad: String(k.ad || "Gider"),
        tutar: Math.max(0, Number(k.tutar) || 0),
        zorunlu: !!k.zorunlu
      };
    }).filter(function (k) { return k.tutar > 0; });

    if (!(brut > 0) && !(diger > 0)) {
      return { hata: "Gelir sıfırdan büyük olmalı." };
    }

    var u = brut > 0 ? ucretten(brut, yil, sec) : {
      brut: 0, gelirVergisi: 0, sgkIsci: 0, damga: 0, net: 0,
      isverenMaliyeti: 0, isverenPayi: 0
    };

    var netGelir = r2(u.net + diger);
    var giderToplam = r2(kalemler.reduce(function (a, k) { return a + k.tutar; }, 0));
    var zorunluToplam = r2(kalemler.reduce(function (a, k) {
      return a + (k.zorunlu ? k.tutar : 0);
    }, 0));
    var tasarruf = r2(netGelir - giderToplam);

    /* Tasarruf oranı NET gelir üzerinden (bkz. dosya başı, karar 2). */
    var tasarrufOrani = netGelir > 0 ? tasarruf / netGelir : 0;

    /* Vergi kaması: işveren maliyetinin ne kadarı size ulaşmıyor. */
    var kama = u.isverenMaliyeti > 0
      ? (u.isverenMaliyeti - u.net) / u.isverenMaliyeti : 0;

    var reelGetiri = E.reel(getiri, enf);
    var ayReel = Math.pow(1 + reelGetiri, 1 / 12) - 1;

    /* Ömür bedeli: aylık gider enflasyonla büyür, yatırım nominal getirir;
       ikisi REEL çerçevede buluşturulur ve sonuç bugünün parasıyla verilir. */
    function omurBedeli(aylik) {
      var n = ufuk * 12;
      if (Math.abs(ayReel) < 1e-9) return r2(aylik * n);
      return r2(aylik * (Math.pow(1 + ayReel, n) - 1) / ayReel);
    }

    var gider = kalemler.map(function (k) {
      return {
        ad: k.ad,
        tutar: k.tutar,
        zorunlu: k.zorunlu,
        pay: netGelir > 0 ? k.tutar / netGelir : 0,
        omurBedeli: omurBedeli(k.tutar)
      };
    }).sort(function (a, b) { return b.tutar - a.tutar; });

    var birikimUfukta = omurBedeli(Math.max(0, tasarruf));

    return {
      yil: yil,
      ufukYil: ufuk,
      ucret: u,
      digerGelir: r2(diger),
      netGelir: netGelir,
      giderToplam: giderToplam,
      zorunluToplam: zorunluToplam,
      isteğeBagliToplam: r2(giderToplam - zorunluToplam),
      tasarruf: tasarruf,
      tasarrufOrani: tasarrufOrani,
      acikVarMi: tasarruf < 0,
      vergiKamasi: kama,
      giderler: gider,
      reelGetiri: reelGetiri,
      birikimUfukta: birikimUfukta,
      /* Zorunlu giderler üzerinden dayanma süresi hesabı için taban. */
      aylikZorunlu: zorunluToplam
    };
  }

  /**
   * Sankey düğüm ve bağlantıları.
   *
   * Şema: İşveren maliyeti → (işveren SGK) + Brüt → (vergi, SGK, damga)
   *       + Net → (gider kalemleri) + Tasarruf → ufuktaki reel birikim.
   * Diğer gelir doğrudan Net'e bağlanır.
   */
  function akis(r) {
    if (r.hata) return { dugumler: [], baglantilar: [] };
    var d = [], b = [];
    function dugum(id, ad, tur) { d.push({ id: id, ad: ad, tur: tur }); return id; }
    function bag(kaynak, hedef, deger, tur) {
      if (deger > 0.005) b.push({ kaynak: kaynak, hedef: hedef, deger: r2(deger), tur: tur });
    }

    var u = r.ucret;
    if (u.isverenMaliyeti > 0) {
      dugum("maliyet", "İşveren maliyeti", "kaynak");
      dugum("brut", "Brüt ücret", "ara");
      dugum("isvSgk", "İşveren SGK payı", "kesinti");
      bag("maliyet", "isvSgk", u.isverenPayi, "kesinti");
      bag("maliyet", "brut", u.brut, "akis");

      dugum("vergi", "Gelir vergisi", "kesinti");
      dugum("sgk", "SGK + işsizlik", "kesinti");
      dugum("damga", "Damga vergisi", "kesinti");
      bag("brut", "vergi", u.gelirVergisi, "kesinti");
      bag("brut", "sgk", u.sgkIsci, "kesinti");
      bag("brut", "damga", u.damga, "kesinti");
    }

    dugum("net", "Harcanabilir gelir", "ara");
    if (u.net > 0) bag("brut", "net", u.net, "akis");
    if (r.digerGelir > 0) {
      dugum("diger", "Diğer gelir", "kaynak");
      bag("diger", "net", r.digerGelir, "akis");
    }

    r.giderler.forEach(function (k, i) {
      var id = "g" + i;
      dugum(id, k.ad, k.zorunlu ? "zorunlu" : "istege-bagli");
      bag("net", id, k.tutar, "gider");
    });

    if (r.tasarruf > 0) {
      dugum("tasarruf", "Tasarruf", "tasarruf");
      bag("net", "tasarruf", r.tasarruf, "tasarruf");
      /* UFUKTAKİ BİRİKİM DİYAGRAMA GİRMİYOR — bilinçli.
         Bir Sankey'in tek değişmezi, bütün kolların AYNI BİRİMDE olmasıdır.
         Aylık akışın ucuna "10 yıl sonraki birikim" düğümü eklemek stok ile
         akışı aynı ölçekte çizmek olurdu; ilk sürümde tam bunu yapıyordu ve
         düğüm, ufuktaki tutarı değil aylık tasarrufu etiketliyordu — yani
         okuyucuya yanlış bir sayı gösteriyordu. Ufuktaki tutar diyagramın
         değil, özet kartının işi. */
    } else if (r.tasarruf < 0) {
      dugum("acik", "Açık", "acik");
      bag("net", "acik", -r.tasarruf, "acik");
    }

    return { dugumler: d, baglantilar: b };
  }

  /**
   * Bir gideri kısmanın ömür etkisi.
   * Kullanıcının kararı "bu kalemi %X azaltsam" biçiminde; cevap bugünün
   * parasıyla ufuktaki fark.
   */
  function kisintiEtkisi(r, ad, oran) {
    var k = null;
    for (var i = 0; i < r.giderler.length; i++) {
      if (r.giderler[i].ad === ad) k = r.giderler[i];
    }
    if (!k) return null;
    var o = Math.min(1, Math.max(0, Number(oran) || 0));
    return {
      ad: k.ad,
      aylikKazanc: r2(k.tutar * o),
      omurKazanci: r2(k.omurBedeli * o),
      yeniTasarruf: r2(r.tasarruf + k.tutar * o),
      yeniOran: r.netGelir > 0 ? (r.tasarruf + k.tutar * o) / r.netGelir : 0
    };
  }

  /**
   * Isı haritası için: x = tasarruf oranı, y = ufuk (yıl).
   * Değer, ufuktaki reel birikimin BUGÜNKÜ zorunlu gider cinsinden
   * karşılığı — yani "kaç yıllık yaşam masrafı" — eksi 1 yıl.
   *
   * NEDEN BU ÖLÇEK: TL tutarı tek başına büyük ve anlamsız görünüyor.
   * "Kaç yıl yaşarım" ölçüsü hem kullanıcının kendi giderine göreli,
   * hem de iki tarafa ayrışan (1 yıldan az / fazla) bir karar değeri.
   */
  function duyarlilik(g, r, secenek) {
    secenek = secenek || {};
    var xler = secenek.x || [0.05, 0.10, 0.15, 0.20, 0.30, 0.40];
    var yler = secenek.y || [5, 10, 15, 20, 25, 30];
    var yillikZorunlu = Math.max(1, r.aylikZorunlu * 12);
    var reel = r.reelGetiri;
    var ayReel = Math.pow(1 + reel, 1 / 12) - 1;

    var hucreler = [], enBuyuk = 0, arti = false, eksi = false;
    for (var j = 0; j < yler.length; j++) {
      var satir = [];
      for (var i = 0; i < xler.length; i++) {
        var aylik = r.netGelir * xler[i];
        var n = yler[j] * 12;
        var bir = Math.abs(ayReel) < 1e-9
          ? aylik * n
          : aylik * (Math.pow(1 + ayReel, n) - 1) / ayReel;
        var yilKarsiligi = bir / yillikZorunlu;
        var deger = r2(yilKarsiligi - 1);
        if (deger > 0) arti = true; else if (deger < 0) eksi = true;
        if (Math.abs(deger) > enBuyuk) enBuyuk = Math.abs(deger);
        satir.push({ x: xler[i], y: yler[j], deger: deger, yil: r2(yilKarsiligi) });
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
    akis: akis,
    kisintiEtkisi: kisintiEtkisi,
    duyarlilik: duyarlilik,
    ucretten: ucretten
  };
});
