/*!
 * SGK primleri — Bağ-Kur (4/b), isteğe bağlı sigorta, GSS (60/g) ve
 * hizmet borçlanması.
 *
 * Oranlar bordro/parametreler.js'ten okunur (yıl bloğunda sigortalilik ve
 * sirket.bagkurOrani); bu dosyada yasal sayı yok. Sınırlar:
 *   aylık kazanç: brüt asgari ücret ≤ kazanç ≤ SGK tavanı (5510 m.82)
 *   günlük kazanç: aylık sınırların otuzda biri
 *
 *   Bağ-Kur primi      = kazanç × %35,75   (5 puan indirimle %30,75)
 *   isteğe bağlı prim  = kazanç × %33
 *   GSS primi          = brüt asgari ücret × %6  (kişi başı hane geliri
 *                        asgari ücretin 1/3'ünden azsa 0; prim devletçe ödenir)
 *   borçlanma          = gün × günlük kazanç × %45  (doğum borçlanmasında %32)
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/bag-kur-ve-borclanma-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("./motor.js"));
  else kok.SgkPrim = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  function kurus(n) { return Math.round(n * 100 + 1e-9) / 100; }

  function yilParam(yil) {
    var P = B.parametre(yil == null ? B.sonYil() : yil);
    if (!P.sigortalilik || !P.sirket) throw new Error(P.yil + " için sigortalılık oranları tanımlı değil.");
    var d = P.donemler[P.donemler.length - 1];
    return { P: P, S: P.sigortalilik, asgari: d.asgariBrut, tavan: d.sgkTavan };
  }

  function sinirlar(yil) {
    var y = yilParam(yil);
    return { yil: y.P.yil, aylikAlt: y.asgari, aylikUst: y.tavan, gunlukAlt: y.asgari / 30, gunlukUst: y.tavan / 30 };
  }

  function kazancDogrula(k, y) {
    k = Number(k);
    if (!isFinite(k)) throw new Error("Kazanç sayı olmalı.");
    if (k < y.asgari - 0.005 || k > y.tavan + 0.005) {
      throw new Error("Prime esas kazanç " + y.asgari.toLocaleString("tr-TR") + " TL ile " + y.tavan.toLocaleString("tr-TR") + " TL arasında olmalı.");
    }
    return k;
  }

  function bagkur(kazanc, yil) {
    var y = yilParam(yil), k = kazancDogrula(kazanc, y), sr = y.P.sirket;
    return { kazanc: k, oran: sr.bagkurOrani, indirimliOran: sr.bagkurIndirimliOran,
             prim: kurus(k * sr.bagkurOrani), indirimli: kurus(k * sr.bagkurIndirimliOran),
             yillik: kurus(k * sr.bagkurOrani) * 12, yillikIndirimli: kurus(k * sr.bagkurIndirimliOran) * 12 };
  }

  function istegeBagli(kazanc, yil) {
    var y = yilParam(yil), k = kazancDogrula(kazanc, y);
    return { kazanc: k, oran: y.S.istegeBagliOrani, prim: kurus(k * y.S.istegeBagliOrani), yillik: kurus(k * y.S.istegeBagliOrani) * 12 };
  }

  /* kisiBasiGelir: hanenin aylık toplam geliri ÷ hane nüfusu. */
  function gss(kisiBasiGelir, yil) {
    var y = yilParam(yil), g = Number(kisiBasiGelir);
    if (!(g >= 0)) throw new Error("Kişi başı gelir sıfır ya da pozitif olmalı.");
    var esik = y.asgari * y.S.gssGelirTestiKati;
    var devlet = g < esik;
    var prim = devlet ? 0 : kurus(y.asgari * y.S.gssOrani);
    return { esik: esik, devletOder: devlet, oran: y.S.gssOrani, prim: prim, yillik: prim * 12 };
  }

  /* tur: "genel" (askerlik, yurt dışı, doktora vb.) ya da "dogum". */
  function borclanma(gun, gunlukKazanc, tur, yil) {
    var y = yilParam(yil), n = Math.round(Number(gun)), k = Number(gunlukKazanc);
    if (!(n >= 1 && n <= 3650)) throw new Error("Borçlanılacak gün 1 ile 3650 arasında olmalı.");
    var alt = y.asgari / 30, ust = y.tavan / 30;
    if (!(k >= alt - 0.005 && k <= ust + 0.005)) throw new Error("Günlük kazanç " + alt.toLocaleString("tr-TR") + " TL ile " + ust.toLocaleString("tr-TR") + " TL arasında olmalı.");
    var oran = tur === "dogum" ? y.S.dogumBorclanmaOrani : y.S.borclanmaOrani;
    var gunluk = kurus(k * oran);
    return { gun: n, gunlukKazanc: k, oran: oran, gunluk: gunluk, toplam: kurus(gunluk * n),
             enAz: kurus(kurus(alt * oran) * n), enCok: kurus(kurus(ust * oran) * n) };
  }

  /* Asgari ücretin katlarına göre Bağ-Kur ve isteğe bağlı prim tablosu. */
  function katTablosu(katlar, yil) {
    var y = yilParam(yil);
    return katlar.map(function (kat) {
      var k = Math.min(y.asgari * kat, y.tavan);
      return { kat: kat, kazanc: k, bagkur: bagkur(k, yil).prim, bagkurIndirimli: bagkur(k, yil).indirimli, istegeBagli: istegeBagli(k, yil).prim };
    });
  }

  return { surum: "1.0.0", sinirlar: sinirlar, bagkur: bagkur, istegeBagli: istegeBagli, gss: gss,
           borclanma: borclanma, katTablosu: katTablosu };
});
