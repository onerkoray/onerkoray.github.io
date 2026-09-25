/*!
 * Reel maaş — iki tarihteki maaşın alım gücü karşılaştırması.
 *
 * Bordro motoru (2020–2026) ile TÜFE endeksini birleştirir. Net girilen
 * maaş olduğu gibi alınır; brüt girilirse neti o ayın GERÇEK bordrosundan
 * hesaplanır. Aynı brüt, kümülatif vergi yüzünden yılın her ayında farklı
 * net verir; "aylık net" demek bir ay seçmeyi gerektirir.
 *
 * Üç ölçü:
 *   reelDegisim   = (yeniNet / eskiNet) / TÜFE çarpanı − 1
 *   gerekenNet    = eskiNet × TÜFE çarpanı   (alım gücünü korumak için)
 *   asgari katı   = net / o ayın resmî net asgari ücreti
 * Brüt iki uçta da verilmişse vergi etkisi ayrıca ayrılır: netin reel
 * değişimi ile brütün reel değişimi arasındaki fark, kesinti oranındaki
 * değişimden gelir.
 *
 * Yasal sayı yoktur: asgari ücret ve bordro bordro/parametreler.js'ten,
 * fiyatlar finans/tufe-serisi.js'ten.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/reel-maas-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../bordro/motor.js"), require("./tufe-endeksi.js"));
  } else {
    kok.ReelMaas = fabrika(kok.Bordro, kok.TufeEndeksi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, E) {
  "use strict";

  function parca(ay) { return { yil: +ay.slice(0, 4), ay: +ay.slice(5) }; }
  function bordroYiliVar(yil) { return B.yillar().indexOf(yil) !== -1; }

  /** O ayın resmî net asgari ücreti; bordro yılı yoksa null. */
  function asgariNet(ay) {
    var p = parca(ay);
    if (!bordroYiliVar(p.yil)) return null;
    return B.donem(B.parametre(p.yil), p.ay).asgariNet;
  }
  function asgariBrut(ay) {
    var p = parca(ay);
    if (!bordroYiliVar(p.yil)) return null;
    return B.donem(B.parametre(p.yil), p.ay).asgariBrut;
  }

  /** Sabit brütün o aydaki neti ve kesinti oranı (12 aylık bordrodan). */
  function brutNet(brut, ay) {
    var p = parca(ay);
    if (!bordroYiliVar(p.yil)) {
      throw new Error(p.yil + " için bordro parametresi yok; brüt yerine net girin (bordro " +
        B.yillar().slice().sort()[0] + "–" + B.sonYil() + ").");
    }
    var a = B.hesaplaYil(brut, p.yil).aylar[p.ay - 1];
    return { net: a.net, kesinti: 1 - a.net / brut };
  }

  function uc(g, ad) {
    var tutar = Number(g && g.tutar);
    if (!isFinite(tutar) || tutar <= 0) throw new Error(ad + " maaş pozitif bir sayı olmalı.");
    if (!E.gecerli(g.ay)) throw new Error(ad + " maaşın ayı için TÜFE verisi yok (" + E.ilkAy + " – " + E.sonAy + ").");
    if (g.tur !== "net" && g.tur !== "brut") throw new Error("Maaş türü net ya da brüt olmalı.");
    var out = { ay: g.ay, tur: g.tur, tutar: tutar };
    if (g.tur === "brut") {
      var b = brutNet(tutar, g.ay);
      out.brut = tutar; out.net = b.net; out.kesinti = b.kesinti;
    } else {
      out.net = tutar;
    }
    out.asgariNet = asgariNet(g.ay);
    out.asgariKati = out.asgariNet ? out.net / out.asgariNet : null;
    return out;
  }

  function karsilastir(girdi) {
    var eski = uc(girdi.eski, "Eski"), yeni = uc(girdi.yeni, "Yeni");
    if (!(eski.ay < yeni.ay)) throw new Error("Eski maaşın ayı yeni maaşın ayından önce olmalı.");
    var d = E.donem(eski.ay, yeni.ay);
    var r = {
      eski: eski, yeni: yeni, donem: d,
      fiyatCarpani: d.carpan,
      nominalDegisim: yeni.net / eski.net - 1,
      reelDegisim: yeni.net / eski.net / d.carpan - 1,
      gerekenNet: eski.net * d.carpan
    };
    r.acik = r.gerekenNet - yeni.net;
    r.yillikReel = Math.pow(1 + r.reelDegisim, 12 / d.ay) - 1;
    if (eski.brut && yeni.brut) {
      r.brutReel = yeni.brut / eski.brut / d.carpan - 1;
      /* Vergi etkisi: net reel değişimi ile brüt reel değişimi arasındaki
         fark. (1 − yeni kesinti) / (1 − eski kesinti) − 1 ile aynıdır. */
      r.vergiEtkisi = (1 + r.reelDegisim) / (1 + r.brutReel) - 1;
    }
    return r;
  }

  return {
    surum: "1.0.0",
    asgariNet: asgariNet,
    asgariBrut: asgariBrut,
    brutNet: brutNet,
    karsilastir: karsilastir,
    bordroYillari: function () { return B.yillar().slice().sort(); }
  };
});
