/*!
 * Karar Laboratuvarı — "elimdeki parayı ne yapmalıyım?"
 *
 * Sitedeki erken kapatma aracı bu soruyu TEK BİR KREDİ ölçeğinde
 * cevaplıyor. Bu, aynı soruyu YAŞAM BOYU ölçeğinde soruyor: seçenek
 * profilin tamamına uygulanıyor, üç senaryoda yirmi yıl koşuluyor ve
 * sonuçlar karşılaştırılıyor.
 *
 * ÜÇ KURAL — üçü de daha önce bu kod tabanında öğrenildi
 *
 * 1. "OPTİMUM" DENMEZ. Beklenen getiri varsayımını iki puan oynatmak
 *    sıralamayı tamamen değiştirebiliyor. Dağıtım motorunun ilk sürümü
 *    ucuz borcu otomatik kapatıp bunu elle yazılmış bir gerekçeyle
 *    sunuyordu — matematiğin vermediği bir cevabı vermek. Kural o zaman
 *    kondu: motor öneriyi değil, seçeneğin BEDELİNİ verir.
 *
 * 2. HER SIRALAMA BAŞABAŞ NOKTASIYLA BİRLİKTE SUNULUR. "Yatırım önde"
 *    cümlesi tek başına eksik; "%X'in üstünde önde, altında değil"
 *    cümlesi karardır. Başabaş, yaklaşık formülle değil ikiye bölmeyle
 *    ve her adımda projeksiyonun tamamı yeniden koşularak bulunuyor.
 *
 * 3. EN YÜKSEK SONUÇ İLE EN DAYANIKLI SONUÇ AYRI RAPORLANIR. Baz
 *    senaryoda en çok biriktiren seçenek, kötümser senaryoda en kötüsü
 *    olabilir. İkisini tek bir "kazanan"a indirmek, riski gizlemek olur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ikiz/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var P = nodeMi ? require("./profil.js") : root.Profil;
  var I = nodeMi ? require("./ikiz-motoru.js") : root.IkizMotoru;
  var v = factory(P, I);
  if (nodeMi) module.exports = v;
  else root.KararMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (P, I) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }
  function kopya(p) { return JSON.parse(JSON.stringify(p)); }

  /* ---------------------------- seçenekler ------------------------------ */

  /** En pahalı borçtan başlayarak tutarı borca uygular. */
  function borcaUygula(p, tutar) {
    var k = kopya(p);
    var kalan = tutar;
    k.borclar.sort(function (a, b) { return b.aylikFaiz - a.aylikFaiz; });
    for (var i = 0; i < k.borclar.length && kalan > 0; i++) {
      var b = k.borclar[i];
      var odenen = Math.min(kalan, b.kalanAnapara);
      b.kalanAnapara -= odenen;
      kalan -= odenen;
      /* AYLIK ÖDEME AYNEN KALIYOR. Anapara azaldığı için borç daha erken
         biter ve o taksit serbest kalır — "fark yatırılır" kuralının
         borç tarafındaki karşılığı. Ödemeyi de düşürmek, kazancın bir
         kısmını görünmez kılardı. */
    }
    k.borclar = k.borclar.filter(function (b) { return b.kalanAnapara > 0.005; });
    /* Borçlar bittiyse artan para yatırıma gider — eldeki parayı yok
       saymak sonucu yanlış yönde bozardı. */
    if (kalan > 0) {
      k.varliklar.push({ ad: "Kalan tutar", tur: "mevduat", deger: kalan });
    }
    return k;
  }

  function yatirimaUygula(p, tutar) {
    var k = kopya(p);
    k.varliklar.push({ ad: "Ek yatırım", tur: "fon", deger: tutar });
    return k;
  }

  function nakiteUygula(p, tutar) {
    var k = kopya(p);
    k.varliklar.push({ ad: "Nakit rezerv", tur: "nakit", deger: tutar });
    return k;
  }

  function karmaUygula(p, tutar) {
    return yatirimaUygula(borcaUygula(p, tutar / 2), tutar / 2);
  }

  var SECENEKLER = [
    { id: "borc", ad: "Borcu kapat",
      aciklama: "En yüksek faizli borçtan başlayarak. Taksit aynı kalır, " +
        "borç daha erken biter ve o ödeme serbest kalır.",
      uygula: borcaUygula },
    { id: "yatirim", ad: "Yatırıma koy",
      aciklama: "Senaryo getirisiyle büyür. Getirinin gerçekleşeceği " +
        "garanti değildir; borç kapatmanın getirisi ise kesindir.",
      uygula: yatirimaUygula },
    { id: "nakit", ad: "Nakitte tut",
      aciklama: "Nominal olarak durur, reel olarak enflasyon kadar erir. " +
        "Karşılığında anında ulaşılabilir.",
      uygula: nakiteUygula },
    { id: "karma", ad: "Yarı yarıya",
      aciklama: "Yarısı borca, yarısı yatırıma.",
      uygula: karmaUygula }
  ];

  function secenekBul(id) {
    for (var i = 0; i < SECENEKLER.length; i++) {
      if (SECENEKLER[i].id === id) return SECENEKLER[i];
    }
    return null;
  }

  /* --------------------------- karşılaştırma ---------------------------- */

  function olc(p, secenek, tutar) {
    var uygulanmis = P.normalize(secenek.uygula(P.normalize(p), tutar));
    var s = {};
    ["kotumser", "baz", "iyimser"].forEach(function (ad) {
      var pr = I.projeksiyon(uygulanmis, ad);
      s[ad] = {
        sonReelNetDeger: pr.sonReelNetDeger,
        tukenmeYili: pr.tukenmeYili
      };
    });
    var ozet = P.ozet(uygulanmis);
    return {
      id: secenek.id, ad: secenek.ad, aciklama: secenek.aciklama,
      senaryolar: s,
      baz: s.baz.sonReelNetDeger,
      kotumser: s.kotumser.sonReelNetDeger,
      iyimser: s.iyimser.sonReelNetDeger,
      /* Dayanma süresi: seçeneğin LİKİDİTE bedeli. Borcu kapatmak serveti
         büyütürken dayanma süresini kısaltabiliyor ve bu görünmeli. */
      dayanmaAy: ozet.dayanmaAy,
      kotumserdeTukenme: s.kotumser.tukenmeYili
    };
  }

  /**
   * @param {Object} profil
   * @param {number} tutar   elde olan toplu para
   * @param {Array}  idler   karşılaştırılacak seçenek id'leri (varsayılan hepsi)
   */
  function karsilastir(profil, tutar, idler) {
    var p = P.normalize(profil);
    var t = Math.max(0, Number(tutar) || 0);
    if (!(t > 0)) return { hata: "Karşılaştırılacak tutar sıfırdan büyük olmalı." };

    var secilen = (idler && idler.length
      ? idler.map(secenekBul).filter(Boolean) : SECENEKLER);
    if (!secilen.length) return { hata: "En az bir seçenek gerekli." };

    var sonuclar = secilen.map(function (s) { return olc(p, s, t); });

    /* İKİ AYRI KAZANAN. Tek bir "en iyi" göstermek riski gizlerdi. */
    var enIyiBaz = sonuclar.reduce(function (a, b) { return b.baz > a.baz ? b : a; });
    var enIyiKotumser = sonuclar.reduce(function (a, b) {
      return b.kotumser > a.kotumser ? b : a;
    });

    return {
      tutar: r2(t),
      secenekler: sonuclar.slice().sort(function (a, b) { return b.baz - a.baz; }),
      enIyiBaz: enIyiBaz.id,
      enIyiKotumser: enIyiKotumser.id,
      /* Aynıysa karar sağlam; farklıysa kullanıcı bir TERCİH yapıyor:
         beklenen sonuç mu, dayanıklılık mı? */
      ayniKazanan: enIyiBaz.id === enIyiKotumser.id,
      fark: r2(enIyiBaz.baz - sonuclar[sonuclar.length - 1].baz)
    };
  }

  /**
   * İki seçeneğin sıralamasının döndüğü YATIRIM GETİRİSİ.
   *
   * Yaklaşık formül yok: her adımda profilin varsayımı değiştirilip
   * projeksiyonun tamamı yeniden koşuluyor. Sebebi, vergi, borç itfası
   * ve olayların araya girmesiyle farkın doğrusal olmaması.
   *
   * Doner: {bulundu, getiri, ustunde, altinda} ya da {bulundu:false, sebep}
   */
  function basabas(profil, tutar, idA, idB) {
    var p = P.normalize(profil);
    var a = secenekBul(idA), b = secenekBul(idB);
    if (!a || !b) return { bulundu: false, sebep: "secenek-yok" };
    var t = Math.max(0, Number(tutar) || 0);
    if (!(t > 0)) return { bulundu: false, sebep: "tutar-yok" };

    function farkIcin(getiri) {
      var k = kopya(p);
      k.varsayimlar.yatirimGetirisi = getiri;
      var pa = I.projeksiyon(P.normalize(a.uygula(P.normalize(k), t)), "baz");
      var pb = I.projeksiyon(P.normalize(b.uygula(P.normalize(k), t)), "baz");
      return pa.sonReelNetDeger - pb.sonReelNetDeger;
    }

    var alt = 0, ust = 2.0;
    var fAlt = farkIcin(alt), fUst = farkIcin(ust);
    /* İşaret değişmiyorsa başabaş yok: bu aralıkta biri hep önde.
       Uydurma bir sayı döndürmek yerine bunu söylüyoruz. */
    if (fAlt === 0 || fUst === 0 || (fAlt > 0) === (fUst > 0)) {
      return { bulundu: false, sebep: "donmuyor",
        surekliOnde: fUst > 0 ? idA : idB };
    }
    for (var i = 0; i < 34; i++) {
      var orta = (alt + ust) / 2;
      if ((farkIcin(alt) > 0) === (farkIcin(orta) > 0)) alt = orta; else ust = orta;
      if (ust - alt < 0.0005) break;
    }
    var g = (alt + ust) / 2;
    return {
      bulundu: true,
      getiri: Math.round(g * 10000) / 10000,
      /* Getiri bu eşiğin ÜSTÜNDEYSE hangisi önde? */
      ustunde: farkIcin(Math.min(2.0, g + 0.02)) > 0 ? idA : idB,
      altinda: farkIcin(Math.max(0, g - 0.02)) > 0 ? idA : idB
    };
  }

  return {
    SECENEKLER: SECENEKLER,
    secenekBul: secenekBul,
    karsilastir: karsilastir,
    basabas: basabas
  };
});
