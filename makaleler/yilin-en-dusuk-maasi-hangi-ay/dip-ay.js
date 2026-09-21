/*!
 * Yılın en düşük net maaşı hangi ay? — tarama ve türetmeleri.
 *
 * SORU
 * ----
 * "Aralık yılın en kötü ayıdır" yaygın bir kabul. Ölçüldüğünde çoğu brüt
 * ücrette doğru değil: net, yılın dibini Aralık'tan önce görüyor ve bir
 * kısmında yıl sonuna doğru geri çıkıyor.
 *
 * İKİ KUVVET
 * ----------
 * Yıl içinde neti iki şey hareket ettirir ve ters yönlere çekerler:
 *
 *   AŞAĞI — Kendi kümülatif matrahınız üst dilimlere girdikçe vergi artar.
 *           Bu geçişler brüt yükseldikçe yılın daha erken aylarına kayar.
 *
 *   YUKARI — Asgari ücret istisnası (GVK m.23/1-18) asgari ücretlinin o ay
 *            ödeyeceği vergi kadardır. Asgari ücretlinin kümülatif matrahı
 *            2026'da yedinci ayda tarifenin ilk dilimini aşıyor; o aydan
 *            itibaren istisna üst dilimden hesaplanıp büyüyor. İstisna
 *            büyürken sizin verginiz aynı kalıyorsa net YÜKSELİR.
 *
 * Yılın dibi, aşağı kuvvetin son kez kazandığı aydır.
 *
 * MEKANİZMA İDDİASI YOK
 * ---------------------
 * Dip ayının brüte göre nasıl yürüdüğü BURADA ÖLÇÜLÜYOR, bir kuraldan
 * türetilmiyor. İki ayrı kapalı kural denendi ve ikisi de ölçümle
 * çürütüldü ("yıllık matrah dilim sınırını ilk aştığı brüt" 0/3;
 * "temmuz sonrası kazanç-kayıp yarışı" %57,9). Bu yüzden eşikler
 * taramadan geliyor; okura da böyle sunuluyor.
 *
 * TARAMA
 * ------
 * Asgari ücretten ADIM_SON'a kadar ADIM TL aralıklarla her brüt için 12
 * aylık bordro çıkarılıp dip ayı bulunuyor. Sonuç, dip ayının aynı
 * kaldığı bitişik brüt aralıklarına sıkıştırılıyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.DipAy = fabrika(kok.Bordro);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  var YIL = 2026;

  /* Tarama çözünürlüğü. 100 TL, eşikleri yüzlüğe yuvarlanmış olarak
     verir; daha incesi tabloyu değiştirmiyor, yalnızca yavaşlatıyor. */
  var ADIM = 100;
  var ADIM_SON = 600000;

  function parametre() { return B.parametre(YIL); }
  function asgariBrutAy() { return parametre().donemler[0].asgariBrut; }

  /* Taramanın başladığı brüt: asgari ücretin üstündeki ilk ADIM katı.
     Asgari ücretin kendisinde istisna ücretin tamamını karşılar; yılın
     şekli sorusu orada anlamsızdır. */
  function baslangic() {
    return Math.ceil(asgariBrutAy() / ADIM) * ADIM;
  }

  /* Bir brüt ücretin yıl içindeki şekli. */
  function sekil(brut) {
    var aylar = B.hesaplaYil(brut, YIL).aylar;
    var net = aylar.map(function (a) { return a.net; });

    /* Dip: ilk asgari değer. Eşitlik hâlinde ERKEN ay seçiliyor --
       "net bu ayda dibe vurdu ve bir daha inmedi" demek istiyoruz. */
    var dip = 0;
    for (var i = 1; i < 12; i++) if (net[i] < net[dip] - 0.005) dip = i;

    /* Netin yükseldiği aylar ve yükselişi istisnaya bağlanabilenler.
       İkinci koşul olmadan sebebi bilinmeyen bir hareketi istisnaya
       yazmış oluruz. */
    var yukselen = [], istisnaliYukselis = [];
    for (var j = 1; j < 12; j++) {
      var dn = net[j] - net[j - 1];
      if (dn > 0.005) {
        yukselen.push(j);
        if (aylar[j].istisna - aylar[j - 1].istisna > 0.005) istisnaliYukselis.push(j);
      }
    }

    return {
      brut: brut,
      net: net,
      dipAy: dip,
      dip: net[dip],
      ocak: net[0],
      aralik: net[11],
      /* Dipten yıl sonuna kadar geri kazanılan tutar. */
      geriCikis: net[11] - net[dip],
      yukselen: yukselen,
      istisnaliYukselis: istisnaliYukselis
    };
  }

  /* Bütün taramanın ham hâli. Ağır olduğu için bir kez hesaplanıp
     saklanıyor; sayfa da test de aynı diziyi kullanıyor. */
  var _tarama = null;
  function tarama() {
    if (_tarama) return _tarama;
    var out = [];
    for (var b = baslangic(); b <= ADIM_SON; b += ADIM) out.push(sekil(b));
    _tarama = out;
    return out;
  }

  /* Dip ayının ve "geri çıkış var mı" durumunun aynı kaldığı bitişik
     brüt aralıkları. Tablonun satırları bunlar. */
  var _bantlar = null;
  function bantlar() {
    if (_bantlar) return _bantlar;
    var out = [], onceki = null;
    tarama().forEach(function (s) {
      var anahtar = s.dipAy + "|" + (s.geriCikis > 0.005);
      if (anahtar !== onceki) {
        if (out.length) out[out.length - 1].son = s.brut - ADIM;
        out.push({ bas: s.brut, dipAy: s.dipAy, geriCikis: s.geriCikis });
        onceki = anahtar;
      }
    });
    out[out.length - 1].son = ADIM_SON;
    _bantlar = out;
    return out;
  }

  /* --- Taramadan çıkan oranlar ------------------------------------- */

  function oran(sart) {
    var t = tarama();
    return t.filter(sart).length / t.length * 100;
  }

  /* Dibi Aralık'tan ÖNCE olan brütlerin payı. */
  function dibiAralikOncesiYuzde() {
    return oran(function (s) { return s.dipAy !== 11; });
  }

  /* Yıl sonunda gerçekten para geri kazanan brütlerin payı. */
  function geriCikanYuzde() {
    return oran(function (s) { return s.geriCikis > 0.005; });
  }

  /* Net'in yıl boyunca HİÇ yükselmediği, yani düşüşün gerçekten
     tekdüze olduğu brütlerin payı. */
  function tekduzeYuzde() {
    return oran(function (s) { return s.yukselen.length === 0; });
  }

  /* Dip ayının Aralık'a sıfırlandığı brütler -- tablodaki sıçramalar. */
  function sifirlamalar() {
    var out = [], oncekiDip = null;
    bantlar().forEach(function (b) {
      if (oncekiDip !== null && b.dipAy === 11 && oncekiDip !== 11) out.push(b.bas);
      oncekiDip = b.dipAy;
    });
    return out;
  }

  /* İstisnanın büyüdüğü aylar ve büyüme tutarları. Yalnızca asgari
     ücrete bağlı olduğu için her brütte aynı; tavanın üstündeki bir
     brütten okunuyor. */
  function istisnaArtislari() {
    var aylar = B.hesaplaYil(parametre().sgkTavan || 500000, YIL).aylar;
    var out = [];
    for (var i = 1; i < 12; i++) {
      var d = aylar[i].istisna - aylar[i - 1].istisna;
      if (d > 0.005) out.push({ ay: i, tutar: d });
    }
    return out;
  }

  /* Asgari ücretlinin kümülatif matrahı kaçıncı ayda ilk dilimi aşıyor?
     İstisnanın neden yıl ortasında büyüdüğünün cevabı bu. */
  function asgariDilimAyi() {
    var P = parametre();
    var aylar = B.hesaplaYil(asgariBrutAy(), YIL).aylar;
    var kum = 0;
    for (var i = 0; i < 12; i++) {
      var onceki = kum;
      kum += aylar[i].brut - aylar[i].sgk - aylar[i].issizlik;
      if (onceki <= P.dilimler[0][0] && kum > P.dilimler[0][0]) return i + 1;
    }
    return null;
  }

  return {
    YIL: YIL, ADIM: ADIM, ADIM_SON: ADIM_SON,
    parametre: parametre,
    asgariBrutAy: asgariBrutAy,
    baslangic: baslangic,
    sekil: sekil,
    tarama: tarama,
    bantlar: bantlar,
    dibiAralikOncesiYuzde: dibiAralikOncesiYuzde,
    geriCikanYuzde: geriCikanYuzde,
    tekduzeYuzde: tekduzeYuzde,
    sifirlamalar: sifirlamalar,
    istisnaArtislari: istisnaArtislari,
    asgariDilimAyi: asgariDilimAyi
  };
});
