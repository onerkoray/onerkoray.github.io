/*!
 * İki iş teklifini yıllık toplam üzerinden karşılaştırır.
 *
 * NEDEN VAR
 * ---------
 * Sitedeki "net maaş mı brüt maaş mı" yazısı okura şunu söylüyor:
 * "iki teklifi ancak yıllık toplam nette adil karşılaştırırsınız."
 * Ama karşılaştırmanın kendisini okura bırakıyor — maaş aracında iki
 * kez hesapla, not al, çıkar. Bu modül o adımı kapatıyor.
 *
 * YENİ YASAL PARAMETRE TANIMLAMAZ
 * -------------------------------
 * Bütün sayılar bordro/motor.js'ten gelir. Net sözleşme için
 * nettenBruteYil(), brüt sözleşme için hesaplaYil() kullanılır.
 *
 * ASIL BULGU: TERSİNME
 * --------------------
 * Ocakta önde olan teklif yıl toplamında geride kalabilir. Net
 * sözleşmede dilim kaymasını işveren üstlenir ve net sabit kalır;
 * brüt sözleşmede çalışanın neti yıl içinde düşer. Ölçüldü: 60.000 ile
 * 400.000 TL arasında taranan brüt tekliflerin 69'unda ocakta önde
 * olan teklif yılda geride kalıyor. Örnek: 90.000 TL brüt teklif
 * ocakta 4.816 TL önde, yılda 7.524 TL geride.
 *
 * Tersinme VARSA söylenir, yoksa söylenmez — uydurulmaz.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../bordro/motor.js"));
  } else {
    kok.TeklifKarsilastirma = fabrika(kok.Bordro);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  var TURLER = ["brut", "net"];

  function say(v) { return typeof v === "number" && isFinite(v); }

  /* Bir teklifin 12 aylık bordrosu.
       brut: brüt sabit, net yıl içinde düşer.
       net : net sabit, brüt yıl içinde yükselir (işveren üstlenir). */
  function aylar(teklif, yil) {
    if (teklif.tur === "net") {
      return B.hesaplaYil(B.nettenBruteYil(teklif.tutar, yil), yil).aylar;
    }
    return B.hesaplaYil(teklif.tutar, yil).aylar;
  }

  function ozet(teklif, yil) {
    var a = aylar(teklif, yil);
    var net = a.map(function (x) { return x.net; });
    var toplamNet = 0, maliyet = 0, toplamBrut = 0;
    a.forEach(function (x) {
      toplamNet += x.net;
      maliyet += x.isverenMaliyeti;
      toplamBrut += x.brut;
    });

    /* Dip: netin en düşük olduğu ilk ay. Eşitlikte erken ay seçilir --
       sorulan şey netin NE ZAMAN dibe vurduğu. */
    var dip = 0;
    for (var i = 1; i < 12; i++) if (net[i] < net[dip] - 0.005) dip = i;

    /* Dilim yolculuğu: tekrarsız, sırayla. */
    var yol = [];
    a.forEach(function (x) {
      if (!yol.length || yol[yol.length - 1] !== x.dilim) yol.push(x.dilim);
    });

    return {
      ad: teklif.ad,
      tur: teklif.tur,
      tutar: teklif.tutar,
      aylar: a,
      ocakNet: net[0],
      aralikNet: net[11],
      dipAy: dip,
      dipAdi: a[dip].ayAdi,
      dipNet: net[dip],
      yilNet: toplamNet,
      ortalamaNet: toplamNet / 12,
      yilBrut: toplamBrut,
      isverenMaliyeti: maliyet,
      dilimYolu: yol
    };
  }

  function dogrula(t, ad) {
    if (!t || !say(t.tutar) || t.tutar <= 0) {
      throw new Error(ad + " için tutar girilmeli.");
    }
    if (TURLER.indexOf(t.tur) < 0) {
      throw new Error(ad + " için sözleşme türü brüt ya da net olmalı.");
    }
  }

  function karsilastir(girdi) {
    var yil = (girdi && girdi.yil) || B.sonYil();
    dogrula(girdi && girdi.a, "Birinci teklif");
    dogrula(girdi && girdi.b, "İkinci teklif");

    var A = ozet(girdi.a, yil);
    var C = ozet(girdi.b, yil);

    var yilFark = A.yilNet - C.yilNet;
    var ocakFark = A.ocakNet - C.ocakNet;

    /* TERSİNME: ocakta önde olan, yılda geride. Eşitlik sayılmaz. */
    var tersinme = (ocakFark > 0.005 && yilFark < -0.005) ||
                   (ocakFark < -0.005 && yilFark > 0.005);

    var kazanan = Math.abs(yilFark) <= 0.005 ? null : (yilFark > 0 ? "a" : "b");

    return {
      yil: yil,
      a: A,
      b: C,
      fark: {
        yilNet: yilFark,
        ocakNet: ocakFark,
        ortalamaNet: A.ortalamaNet - C.ortalamaNet,
        isverenMaliyeti: A.isverenMaliyeti - C.isverenMaliyeti,
        tersinme: tersinme,
        kazanan: kazanan,
        /* Ocak farkına bakıp karar verseydi kişi ne kadar yanılırdı? */
        ocaktanYilaSapma: Math.abs(yilFark - ocakFark * 12)
      }
    };
  }

  return {
    TURLER: TURLER,
    aylar: aylar,
    ozet: ozet,
    karsilastir: karsilastir
  };
});
