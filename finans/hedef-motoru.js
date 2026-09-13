/*!
 * Hedef Motoru — "istediğim oluyor mu?"
 *
 * Projeksiyon "ne olacak" sorusunu cevaplıyor. Bu, soruyu tersine
 * çeviriyor: hedefime ulaşıyor muyum, ulaşmıyorsam ne kadar eksik, ve
 * neyi değiştirirsem ulaşırım?
 *
 * EN ÖNEMLİ KARAR: "3 SENARYODAN 2'Sİ" BİR OLASILIK DEĞİLDİR.
 *
 * Bu motor bir hedefi üç senaryoda ayrı ayrı sınıyor ve "2/3 tutuyor"
 * diyor. Bunu "%67 olasılıkla tutar" diye sunmak, bu ürünün baştan beri
 * reddettiği şeyi yapmak olurdu: elimizde olmayan bir dağılımı varmış
 * gibi göstermek. Üç senaryo bir örneklem değil, kullanıcının seçtiği üç
 * varsayım kümesi. Sayım bir SAYIMDIR; olasılık değildir ve arayüz de
 * öyle sunar.
 *
 * Bir Monte Carlo motoru "%84 başarı" diyebilir çünkü orada bir dağılım
 * VARSAYILMIŞTIR — ve sitedeki FIRE aracı tam da bunu, varsayımlarını
 * yazarak yapıyor. Burada dağılım yok, dolayısıyla yüzde de yok.
 *
 * ÜÇ HEDEF TÜRÜ, ÜÇ FARKLI ÖLÇÜ
 *   servet      → reel NET DEĞER (varlık − borç)
 *   harcama     → reel YATIRIM VARLIĞI (konut/araç hariç). Ev peşinatı
 *                 ödeyecekseniz oturduğunuz evin değeri işe yaramaz.
 *   borcsuzluk  → o yıl borcun kalmamış olması
 * İkisini karıştırmak "hedefe ulaştınız" deyip ödeyememeye yol açardı.
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
  else root.HedefMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (P, I) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  var SENARYOLAR = ["kotumser", "baz", "iyimser"];

  /** Hedefin ölçüldüğü değer: türe göre farklı alan. */
  function olcu(yilSatiri, tur) {
    if (!yilSatiri) return null;
    if (tur === "harcama") return yilSatiri.reelYatirimVarligi;
    if (tur === "borcsuzluk") return -yilSatiri.borc;   // borç 0 ise 0, varsa negatif
    return yilSatiri.reelNetDeger;
  }

  function esik(hedef) {
    /* Borçsuzlukta hedef "borç ≤ 0"; ölçü −borç olduğu için eşik 0. */
    return hedef.tur === "borcsuzluk" ? 0 : hedef.tutar;
  }

  function yilBul(yillar, yil) {
    for (var i = 0; i < yillar.length; i++) if (yillar[i].yil === yil) return yillar[i];
    return null;
  }

  /**
   * Tek bir hedefi tek bir projeksiyonda sınar.
   * Doner: {tuttu, ulasilan, acik, ilkTutanYil}
   */
  function sina(proj, hedef) {
    var satir = yilBul(proj.yillar, hedef.yil);
    if (!satir) {
      return { tuttu: null, ulasilan: null, acik: null, ilkTutanYil: null,
        sebep: "ufuk-disi" };
    }
    var deger = olcu(satir, hedef.tur);
    var e = esik(hedef);
    /* Borçsuzlukta kuruş toleransı: 0,005 altındaki kalan borç kapanmış
       sayılıyor (motorun kendi eşiğiyle aynı). */
    var tuttu = hedef.tur === "borcsuzluk" ? deger >= -0.005 : deger >= e;

    /* Hedefe ULAŞILAN İLK YIL — hedef yılından önce de tutuyor olabilir,
       sonra da. "Ne zaman ulaşırım" sorusunun cevabı bu. */
    var ilk = null;
    for (var i = 0; i < proj.yillar.length; i++) {
      var d = olcu(proj.yillar[i], hedef.tur);
      var t = hedef.tur === "borcsuzluk" ? d >= -0.005 : d >= e;
      if (t) { ilk = proj.yillar[i].yil; break; }
    }

    return {
      tuttu: tuttu,
      ulasilan: r2(hedef.tur === "borcsuzluk" ? -deger : deger),
      acik: tuttu ? 0 : r2(e - deger),
      ilkTutanYil: ilk,
      sebep: null
    };
  }

  /**
   * Bütün hedefleri üç senaryoda sınar.
   * @param {Object} profil
   * @param {Object} onbellek  isteğe bağlı {kotumser, baz, iyimser} projeksiyonlar
   */
  function kontrol(profil, onbellek) {
    var p = P.normalize(profil);
    var proj = onbellek || {};
    SENARYOLAR.forEach(function (s) {
      if (!proj[s]) proj[s] = I.projeksiyon(p, s);
    });

    var hedefler = p.hedefler.map(function (h) {
      var sonuc = {};
      var tutan = 0, ufukDisi = false;
      SENARYOLAR.forEach(function (s) {
        var r = sina(proj[s], h);
        sonuc[s] = r;
        if (r.sebep === "ufuk-disi") ufukDisi = true;
        else if (r.tuttu) tutan++;
      });
      return {
        id: h.id, ad: h.ad, tur: h.tur, yil: h.yil, tutar: h.tutar,
        senaryolar: sonuc,
        /* SAYIM, OLASILIK DEĞİL. Arayüz "2/3" yazar, "%67" yazmaz. */
        tutanSenaryoSayisi: tutan,
        toplamSenaryo: SENARYOLAR.length,
        ufukDisi: ufukDisi,
        /* Baz senaryo referans: kullanıcının kendi merkez varsayımı. */
        bazTuttu: sonuc.baz.tuttu,
        bazAcik: sonuc.baz.acik,
        bazIlkTutanYil: sonuc.baz.ilkTutanYil
      };
    });

    return {
      hedefler: hedefler,
      tumSenaryolardaTutan: hedefler.filter(function (h) {
        return !h.ufukDisi && h.tutanSenaryoSayisi === SENARYOLAR.length;
      }).length,
      hicTutmayan: hedefler.filter(function (h) {
        return !h.ufukDisi && h.tutanSenaryoSayisi === 0;
      }).length
    };
  }

  /**
   * Hedefe ulaşmak için AYLIK ne kadar fazladan biriktirmek gerekir?
   *
   * Yaklaşık formülle değil, İKİYE BÖLMEYLE: her denemede projeksiyonun
   * tamamı yeniden koşuyor. Sebebi, ek tasarrufun etkisinin doğrusal
   * olmaması — vergi, borç itfası ve olaylar araya giriyor.
   *
   * Doner: {bulundu, aylik, sebep}
   */
  function gerekenEkTasarruf(profil, hedef, senaryoAdi) {
    var p = P.normalize(profil);
    var s = senaryoAdi || "baz";

    function tutarMi(ek) {
      var kopya = JSON.parse(JSON.stringify(p));
      /* Ek tasarruf, NET bir gelir kalemi olarak ekleniyor.
       *
       * İlk yazımda negatif bir GİDER kalemi olarak ekleniyordu ve sessizce
       * çalışmıyordu: profil şeması negatif tutarı reddedip sıfıra çekiyor,
       * yani her denemede aynı sonuç dönüyordu ve ikiye bölme hep
       * "ulaşılamaz" diyordu. Şema doğru davranıyordu — hata, veri
       * katmanının kuralını dolanmaya çalışmaktı.
       *
       * Nakit akışında "ayda X daha biriktirmek" ile "ayda X daha net
       * gelir" aynı şeydir: ikisi de aynı miktarda serbest nakit üretir.
       * Diğer gelir zaten NET girildiği için ayrıca vergilenmiyor. */
      kopya.gelirler.push({
        id: "ek-tasarruf", ad: "Ek tasarruf", tur: "diger", aylikNet: ek
      });
      return sina(I.projeksiyon(kopya, s), hedef).tuttu;
    }

    if (tutarMi(0)) return { bulundu: true, aylik: 0, sebep: "zaten-tutuyor" };

    /* Üst sınır: aylık gelirin birkaç katı. Bu kadarıyla da tutmuyorsa
       sorun tasarruf oranında değil, hedefin kendisinde. */
    var ozet = P.ozet(p);
    var ust = Math.max(100000, (ozet.ucretBrut + ozet.digerNet) * 3);
    if (!tutarMi(ust)) {
      return { bulundu: false, aylik: null, sebep: "ulasilamaz" };
    }

    var alt = 0;
    for (var i = 0; i < 40; i++) {
      var orta = (alt + ust) / 2;
      if (tutarMi(orta)) ust = orta; else alt = orta;
      if (ust - alt < 50) break;
    }
    return { bulundu: true, aylik: Math.ceil(ust), sebep: null };
  }

  /**
   * Hedefe ulaşmak için hedef yılını kaç yıl ERTELEMEK gerekir?
   * Bazen doğru cevap daha çok biriktirmek değil, daha uzun beklemek.
   */
  function gerekenErteleme(profil, hedef, senaryoAdi) {
    var p = P.normalize(profil);
    var proj = I.projeksiyon(p, senaryoAdi || "baz");
    var r = sina(proj, hedef);
    if (r.tuttu) return { gerekli: false, yil: 0 };
    if (r.ilkTutanYil === null) return { gerekli: true, yil: null, sebep: "ufukta-yok" };
    return { gerekli: true, yil: r.ilkTutanYil - hedef.yil, hedefYili: r.ilkTutanYil };
  }

  return {
    SENARYOLAR: SENARYOLAR,
    kontrol: kontrol,
    sina: sina,
    gerekenEkTasarruf: gerekenEkTasarruf,
    gerekenErteleme: gerekenErteleme
  };
});
