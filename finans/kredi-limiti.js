/*!
 * Ne kadar kredi çekebilirim? — taksit bütçesinden kredi tutarı.
 *
 * Kredi aracının tersi. Taksit formülü ve vergilendirme kredi aracından
 * (kredi-hesaplama/hesap.js): aylık maliyet = faiz × (1 + KKDF + BSMV),
 *   T = A · r / (1 − (1+r)^−n)   ⇒   A = T · (1 − (1+r)^−n) / r
 * Bulunan tutar 100 TL'ye aşağı yuvarlanır ve kredi aracının ödeme planıyla
 * yeniden hesaplanır: plandaki taksit bütçeyi aşmamalı. Test bunu sınar.
 *
 * Taksit bütçesi doğrudan verilebilir ya da gelirden kurulur:
 *   bütçe = aylık net gelir × ayrılabilecek pay − mevcut taksitler
 * Pay bir VARSAYIMDIR (varsayılan %40); bankanın kredi politikası, kredi
 * notu ve BDDK'nın vade ve kredi/değer sınırları ayrıca uygulanır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/ne-kadar-kredi-cekebilirim/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../kredi-hesaplama/hesap.js"));
  else kok.KrediLimiti = fabrika(kok.Kredi);
})(typeof globalThis !== "undefined" ? globalThis : this, function (KH) {
  "use strict";

  var ADIM = 100;

  function dogrula(g) {
    var o = {
      tur: g.tur || "ihtiyac", aylikFaiz: Number(g.aylikFaiz), vade: Math.round(Number(g.vade)),
      taksit: g.taksit == null || g.taksit === "" ? null : Number(g.taksit),
      gelir: Number(g.gelir || 0), pay: g.pay == null ? 0.4 : Number(g.pay), mevcut: Number(g.mevcut || 0)
    };
    var t = KH.turBilgi(o.tur);
    o.kkdf = g.kkdf == null ? t.kkdf : Number(g.kkdf);
    o.bsmv = g.bsmv == null ? t.bsmv : Number(g.bsmv);
    if (!(o.aylikFaiz >= 0 && o.aylikFaiz <= 20)) throw new Error("Aylık faiz %0 ile %20 arasında olmalı.");
    if (!(o.vade >= 1 && o.vade <= 360)) throw new Error("Vade 1 ile 360 ay arasında olmalı.");
    if (!(o.kkdf >= 0 && o.bsmv >= 0)) throw new Error("Vergi oranları negatif olamaz.");
    if (o.taksit === null) {
      if (!(o.gelir > 0)) throw new Error("Aylık net gelir ya da taksit bütçesi girin.");
      if (!(o.pay > 0 && o.pay <= 1)) throw new Error("Gelirden ayrılabilecek pay %1 ile %100 arasında olmalı.");
      if (!(o.mevcut >= 0)) throw new Error("Mevcut taksitler negatif olamaz.");
      o.taksit = o.gelir * o.pay - o.mevcut;
      o.butceKaynagi = "gelir";
    } else o.butceKaynagi = "dogrudan";
    if (!(o.taksit > 0)) throw new Error("Taksit bütçesi pozitif olmalı: mevcut taksitler ayrılan payı aşıyor.");
    return o;
  }

  function tutar(taksit, r, n) {
    return r === 0 ? taksit * n : taksit * (1 - Math.pow(1 + r, -n)) / r;
  }

  function hesapla(girdi) {
    var g = dogrula(girdi);
    var r = KH.brutOran(g.aylikFaiz, g.kkdf, g.bsmv);
    var tam = tutar(g.taksit, r, g.vade);
    var A = Math.floor(tam / ADIM) * ADIM;
    if (!(A > 0)) throw new Error("Bu bütçeyle " + ADIM + " TL'lik kredi bile çekilemiyor.");
    var plan = KH.plan({ anapara: A, aylikFaiz: g.aylikFaiz, vade: g.vade, kkdf: g.kkdf, bsmv: g.bsmv });
    function alt(d) { return Math.floor(tutar(g.taksit, KH.brutOran(Math.max(0, g.aylikFaiz + d), g.kkdf, g.bsmv), g.vade) / ADIM) * ADIM; }
    return {
      girdi: g, aylikMaliyetOrani: r, tamTutar: tam, anapara: A, plan: plan,
      faizBirPuanDusuk: g.aylikFaiz >= 1 ? alt(-1) - A : null,
      faizBirPuanYuksek: alt(1) - A
    };
  }

  /* Vade × faiz tablosu: aynı taksitle çekilebilecek tutar. */
  function tablo(girdi, vadeler, faizler) {
    var g = dogrula(girdi);
    return faizler.map(function (f) {
      var r = KH.brutOran(f, g.kkdf, g.bsmv);
      return { faiz: f, tutarlar: vadeler.map(function (n) { return Math.floor(tutar(g.taksit, r, n) / ADIM) * ADIM; }) };
    });
  }

  return { surum: "1.0.0", ADIM: ADIM, hesapla: hesapla, tablo: tablo };
});
