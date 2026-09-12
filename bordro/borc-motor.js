/*!
 * Borç kapatma simülatörü — çoklu borç, ay ay, strateji karşılaştırmalı
 *
 * NE YAPAR: birden fazla borcu ay ay ilerletir ve üç ödeme stratejisini
 * aynı bütçeyle yarıştırır:
 *
 *   asgari  — yalnızca asgari ödemeler. "Borç dönüyor" hissinin matematiği.
 *   cig     — asgarilerin üstündeki artan para EN YÜKSEK FAİZLİ borca.
 *             Toplam faizi matematiksel olarak en aza indiren sıradır.
 *   kartopu — artan para EN KÜÇÜK BAKİYELİ borca. Faiz açısından çığdan
 *             kötüdür ama ilk kapanışı öne çeker; davranışsal olarak
 *             sürdürülebilir bulunur. Fark lira olarak gösteriliyor ki
 *             tercih bilinçli yapılsın.
 *
 * NEDEN SİMÜLASYON, NEDEN FORMÜL DEĞİL: çoklu borçta kapanan her borcun
 * asgarisi serbest kalır ve sonraki borca eklenir (kartopu etkisi). Bu
 * yüzden kapanma sırası ödeme akışını değiştirir; kapalı form bir formülü
 * yoktur. Ay ay yürütmek tek dürüst yol.
 *
 * FAİZ KONVANSİYONU: aylık nominal oran, dönem sonu bakiyesine uygulanır.
 * Ödeme ay içinde yapılır; önce faiz işler, sonra ödeme düşülür. Bu,
 * kredi kartı ekstresinin çalışma biçimine yakın ve KARAMSAR taraftadır —
 * aracın gerçekten ödeyeceğinizden az göstermemesi tercih edildi.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/borc-kapatma-plani/
 */
(function (root, factory) {
  "use strict";
  var P = (typeof module === "object" && module.exports)
    ? require("./borc-parametreleri.js")
    : root.BORC_PARAMETRELERI;
  var v = factory(P);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BorcMotor = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (P) {
  "use strict";

  var MAX_AY = 720;          // 60 yıl; bunu aşan senaryo "kapanmıyor" sayılır
  var KURUS = 0.005;

  function r2(n) { return Math.round(n * 100) / 100; }

  /* Bir borcun o ayki asgari ödemesi.
     kart  : bakiyenin oranı, ama taban tutarın altına düşmez
     taksit: sabit taksit (kalan bakiyeyi aşamaz) */
  function asgariOdeme(b, bakiye) {
    if (bakiye <= 0) return 0;
    if (b.tur === "taksit") return Math.min(b.taksit, bakiye);
    var oran = b.asgariOran;
    var tutar = bakiye * oran;
    return Math.min(Math.max(tutar, b.asgariTaban || 0), bakiye);
  }

  function siralayici(strateji) {
    if (strateji === "cig") {
      /* En yüksek faiz önce. Eşitlikte küçük bakiye öne alınır: aynı
         faizde küçük olanı kapatmak bir sonraki ayın akışını erken
         serbest bırakır, toplam faizi düşürür. */
      return function (a, b) { return (b.faiz - a.faiz) || (a.bakiye - b.bakiye); };
    }
    if (strateji === "kartopu") {
      return function (a, b) { return (a.bakiye - b.bakiye) || (b.faiz - a.faiz); };
    }
    return null; // asgari: hedef yok
  }

  /**
   * @param {Array} borclar  [{ad, bakiye, faiz(aylık ondalık), tur:"kart"|"taksit",
   *                           asgariOran?, asgariTaban?, taksit?}]
   * @param {number} butce   aylık toplam ödeme kapasitesi (TL)
   * @param {string} strateji "asgari" | "cig" | "kartopu"
   */
  function simule(borclar, butce, strateji) {
    var durum = borclar.map(function (b, i) {
      return {
        i: i, ad: b.ad, faiz: Number(b.faiz) || 0, tur: b.tur || "kart",
        asgariOran: Number(b.asgariOran) || 0.20,
        asgariTaban: Number(b.asgariTaban) || 0,
        taksit: Number(b.taksit) || 0,
        bakiye: Number(b.bakiye) || 0,
        baslangic: Number(b.bakiye) || 0,
        faizToplam: 0, odenenToplam: 0, kapandiAy: null
      };
    }).filter(function (d) { return d.bakiye > 0; });

    if (!durum.length) return { hata: "En az bir borç girin." };
    if (!(butce > 0)) return { hata: "Aylık ödeme bütçesi sıfırdan büyük olmalı." };

    /* Bütçe, ilk ayın asgarilerini bile karşılamıyorsa simülasyon anlamsız. */
    var ilkAsgari = durum.reduce(function (t, d) { return t + asgariOdeme(d, d.bakiye); }, 0);
    if (butce + KURUS < ilkAsgari) {
      return {
        hata: "butce-yetersiz",
        gerekenAsgari: r2(ilkAsgari),
        mesaj: "Aylık bütçeniz, borçlarınızın asgari ödemelerini (" +
          r2(ilkAsgari).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) +
          " TL) karşılamıyor."
      };
    }

    var sirala = siralayici(strateji);
    var seri = [];      // aylık toplam bakiye — grafik için
    var takvim = [];    // hangi borç hangi ayda kapandı
    var faizToplam = 0, odemeToplam = 0, ay = 0;

    while (ay < MAX_AY) {
      var acik = durum.filter(function (d) { return d.bakiye > KURUS; });
      if (!acik.length) break;
      ay++;

      /* 1) faiz */
      acik.forEach(function (d) {
        var f = d.bakiye * d.faiz;
        d.bakiye += f; d.faizToplam += f; faizToplam += f;
      });

      /* 2) asgariler */
      var kalanButce = butce;
      acik.forEach(function (d) {
        var a = Math.min(asgariOdeme(d, d.bakiye), kalanButce);
        d.bakiye -= a; d.odenenToplam += a; kalanButce -= a; odemeToplam += a;
      });

      /* 3) artan para hedefe (asgari stratejisinde hedef yok) */
      if (sirala && kalanButce > KURUS) {
        var hedefler = durum.filter(function (d) { return d.bakiye > KURUS; }).sort(sirala);
        for (var h = 0; h < hedefler.length && kalanButce > KURUS; h++) {
          var d2 = hedefler[h];
          var ek = Math.min(d2.bakiye, kalanButce);
          d2.bakiye -= ek; d2.odenenToplam += ek; kalanButce -= ek; odemeToplam += ek;
        }
      }

      /* 4) kapananları işaretle */
      durum.forEach(function (d) {
        if (d.kapandiAy === null && d.bakiye <= KURUS) {
          d.bakiye = 0; d.kapandiAy = ay;
          takvim.push({ ad: d.ad, ay: ay, odenen: r2(d.odenenToplam), faiz: r2(d.faizToplam) });
        }
      });

      seri.push(r2(durum.reduce(function (t, d) { return t + d.bakiye; }, 0)));
    }

    var kapandi = durum.every(function (d) { return d.bakiye <= KURUS; });

    /* Kapanmayan borçlarda "sonsuz" demek yerine NEDENİNİ söylüyoruz:
       asgari ödeme aylık faizi karşılamıyorsa bakiye büyüyor. */
    var buyuyenler = durum.filter(function (d) {
      return d.bakiye > KURUS && asgariOdeme(d, d.bakiye) < d.bakiye * d.faiz;
    }).map(function (d) { return d.ad; });

    return {
      strateji: strateji,
      kapandi: kapandi,
      ay: kapandi ? ay : null,
      faizToplam: r2(faizToplam),
      odemeToplam: r2(odemeToplam),
      anapara: r2(durum.reduce(function (t, d) { return t + d.baslangic; }, 0)),
      takvim: takvim,
      buyuyenler: buyuyenler,
      seri: seri,
      borclar: durum.map(function (d) {
        return {
          ad: d.ad, baslangic: r2(d.baslangic), faiz: d.faiz,
          faizToplam: r2(d.faizToplam), odenen: r2(d.odenenToplam),
          kapandiAy: d.kapandiAy
        };
      })
    };
  }

  /** Üç stratejiyi aynı bütçeyle koşturur ve karşılaştırır. */
  function planla(borclar, butce) {
    var asgari = simule(borclar, butce, "asgari");
    if (asgari.hata) return asgari;
    var cig = simule(borclar, butce, "cig");
    var kartopu = simule(borclar, butce, "kartopu");

    /* Kazanan: kapanan stratejiler arasında en az faiz ödeyen.
       Çığ teorik olarak optimaldir; yine de hesaplanıp doğrulanıyor. */
    var adaylar = [cig, kartopu].filter(function (s) { return s.kapandi; });
    var enIyi = adaylar.length
      ? adaylar.reduce(function (a, b) { return b.faizToplam < a.faizToplam ? b : a; })
      : null;

    var tasarruf = (enIyi && asgari.kapandi)
      ? r2(asgari.faizToplam - enIyi.faizToplam) : null;

    return {
      butce: r2(butce),
      asgari: asgari, cig: cig, kartopu: kartopu,
      enIyi: enIyi ? enIyi.strateji : null,
      tasarruf: tasarruf,
      /* Kartopunun çığa göre lira maliyeti — tercihi bilinçli yapmak için. */
      kartopuFarki: (cig.kapandi && kartopu.kapandi)
        ? r2(kartopu.faizToplam - cig.faizToplam) : null
    };
  }

  return { simule: simule, planla: planla, parametreler: P, MAX_AY: MAX_AY };
});
