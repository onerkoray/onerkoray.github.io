/*!
 * Asgari ücret zammı senaryosu — gelecek yılın bordrosu, açıklanmadan önce.
 *
 * Gelecek yılın parametreleri açıklanmadan bilinmez. Bu modül tahmin
 * YAPMAZ: kullanıcının verdiği iki orandan varsayımsal bir yıl kurar ve
 * bordroyu sitenin motoruyla hesaplar.
 *
 *   asgariArtis — brüt asgari ücretin artışı
 *   tarifeArtis — gelir vergisi dilimlerinin artışı (kanunen yeniden
 *                 değerleme oranı; burada kesir atılmadan uygulanır)
 *
 * Varsayımsal yıl, son tanımlı yılın parametrelerinin kopyasıdır. Yalnızca
 * üç şey değişir: dilim sınırları, brüt asgari ücret ve SGK tavanı. Tavan
 * kanundaki kuralla asgari ücretten türer (tavanKatsayisi, 7566 s.K. ile 9);
 * net asgari ücret elle yazılmaz, motorun ocak bordrosundan okunur. Oranlar
 * (prim, damga, vergi oranları) değişmez.
 *
 * AYRIŞTIRMA
 * ----------
 * Bir ücretlinin yıllık netindeki değişim dört adımda, sırayla ayrılır:
 *   1. ücret   — zamlı ücret, bu yılın kurallarıyla
 *   2. tarife  — dilim sınırları yeni yıla taşınır
 *   3. asgari  — asgari ücret (istisna ve prim tabanı) yeni yıla taşınır
 *   4. tavan   — SGK tavanı yeni yıla taşınır
 * Dört etkinin toplamı toplam değişime eşittir; sıralı ayrıştırma olduğu
 * için her adımın payı sıraya bağlıdır ve sayfa bunu söyler.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/asgari-ucret-zam-senaryosu/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("./motor.js"));
  else kok.AsgariSenaryo = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  function bazYil() { return B.sonYil(); }

  function kopya(P) {
    var Q = {};
    for (var k in P) if (Object.prototype.hasOwnProperty.call(P, k)) Q[k] = P[k];
    return Q;
  }

  /* Yılın son asgari ücret dönemi: yıl içinde zam yapılan yıllarda
     yeni yılın çıkış noktası aralıktaki tutardır. */
  function sonDonem(P) { return P.donemler[P.donemler.length - 1]; }

  function netAsgari(Q, asgariBrut) {
    return B.hesaplaAy(asgariBrut, 1, Q, { matrah: 0, asgariMatrah: 0 }).net;
  }

  /* Varsayımsal parametre. parca: hangi kalemler yeni yıla taşınsın. */
  function parametre(asgariArtis, tarifeArtis, parca) {
    var P = B.parametre(bazYil()), d = sonDonem(P);
    parca = parca || { tarife: true, asgari: true, tavan: true };
    var Q = kopya(P);
    Q.yil = P.yil + 1;
    Q.varsayimsal = true;
    if (parca.tarife) {
      Q.dilimler = P.dilimler.map(function (x) { return [x[0] === null ? null : x[0] * (1 + tarifeArtis), x[1]]; });
    }
    var asgariBrut = parca.asgari ? Math.round(d.asgariBrut * (1 + asgariArtis) * 100) / 100 : d.asgariBrut;
    var tavan = parca.tavan ? Math.round(asgariBrut * P.tavanKatsayisi * 100) / 100 : d.sgkTavan;
    Q.donemler = [{ ay: 1, asgariBrut: asgariBrut, asgariNet: null, sgkTavan: tavan }];
    Q.donemler[0].asgariNet = Math.round(netAsgari(Q, asgariBrut) * 100) / 100;
    return Q;
  }

  function yil12(brut, P) {
    var birikim = { matrah: 0, asgariMatrah: 0 }, aylar = [];
    var t = { brut: 0, net: 0, gelirVergisi: 0, istisna: 0, sgk: 0, issizlik: 0, damga: 0, isverenMaliyeti: 0 };
    for (var ay = 1; ay <= 12; ay++) {
      var a = B.hesaplaAy(brut, ay, P, birikim);
      aylar.push(a);
      for (var k in t) t[k] += a[k];
    }
    var gecis = [];
    for (var i = 1; i < 12; i++) if (aylar[i].dilim !== aylar[i - 1].dilim) gecis.push({ ay: i + 1, oran: aylar[i].dilim });
    return { aylar: aylar, toplam: t, ocakNet: aylar[0].net, aralikNet: aylar[11].net, dilimGecisleri: gecis };
  }

  /* Yıllık asgari ücret matrahının (istisna matrahı) ulaştığı dilim, 0'dan. */
  function asgariDilimi(P) {
    var d = sonDonem(P), o = P.oranlar;
    var m = d.asgariBrut * (1 - o.sgkIsci - o.issizlikIsci) * 12;
    for (var i = 0; i < P.dilimler.length; i++) {
      if (P.dilimler[i][0] === null || m <= P.dilimler[i][0]) return { matrah: m, dilim: i, oran: P.dilimler[i][1] };
    }
  }

  function dogrula(g) {
    var o = { asgariArtis: Number(g.asgariArtis), tarifeArtis: Number(g.tarifeArtis) };
    if (!(o.asgariArtis >= -0.5 && o.asgariArtis <= 3)) throw new Error("Asgari ücret artışı %-50 ile %300 arasında olmalı.");
    if (!(o.tarifeArtis >= -0.5 && o.tarifeArtis <= 3)) throw new Error("Tarife artışı %-50 ile %300 arasında olmalı.");
    if (g.brut != null && g.brut !== "") {
      o.brut = Number(g.brut);
      if (!(o.brut > 0)) throw new Error("Brüt ücret pozitif olmalı.");
      o.ucretArtis = g.ucretArtis == null || g.ucretArtis === "" ? o.asgariArtis : Number(g.ucretArtis);
      if (!(o.ucretArtis >= -0.5 && o.ucretArtis <= 3)) throw new Error("Ücret artışı %-50 ile %300 arasında olmalı.");
    }
    return o;
  }

  function hesapla(girdi) {
    var g = dogrula(girdi);
    var P = B.parametre(bazYil()), Q = parametre(g.asgariArtis, g.tarifeArtis);
    var dE = sonDonem(P), dY = Q.donemler[0], o = P.oranlar;
    var isveren = function (brut) { return brut * (1 + o.sgkIsveren + o.issizlikIsveren); };
    var r = {
      girdi: g, baz: P.yil, hedef: Q.yil, parametre: Q,
      asgari: {
        eski: { brut: dE.asgariBrut, net: dE.asgariNet, tavan: dE.sgkTavan, maliyet: isveren(dE.asgariBrut) },
        yeni: { brut: dY.asgariBrut, net: dY.asgariNet, tavan: dY.sgkTavan, maliyet: isveren(dY.asgariBrut) }
      },
      dilimler: { eski: P.dilimler, yeni: Q.dilimler },
      asgariDilimi: { eski: asgariDilimi(P), yeni: asgariDilimi(Q) }
    };
    if (g.brut == null) return r;

    var yeniBrut = Math.round(g.brut * (1 + g.ucretArtis) * 100) / 100;
    var adimlar = [
      { kod: "baz", ad: P.yil + " ücreti, " + P.yil + " kuralları", s: yil12(g.brut, P) },
      { kod: "ucret", ad: "Zamlı ücret", s: yil12(yeniBrut, P) },
      { kod: "tarife", ad: "Dilim sınırları", s: yil12(yeniBrut, parametre(g.asgariArtis, g.tarifeArtis, { tarife: true })) },
      { kod: "asgari", ad: "Asgari ücret istisnası ve tabanı", s: yil12(yeniBrut, parametre(g.asgariArtis, g.tarifeArtis, { tarife: true, asgari: true })) },
      { kod: "tavan", ad: "SGK tavanı", s: yil12(yeniBrut, Q) }
    ];
    var etkiler = [];
    for (var i = 1; i < adimlar.length; i++) {
      etkiler.push({ kod: adimlar[i].kod, ad: adimlar[i].ad, net: adimlar[i].s.toplam.net - adimlar[i - 1].s.toplam.net });
    }
    var eski = adimlar[0].s, yeni = adimlar[4].s;
    /* Karşı-olgu: dilimler asgari ücretle aynı oranda artsaydı. */
    var esit = yil12(yeniBrut, parametre(g.asgariArtis, g.asgariArtis));
    r.ucret = {
      eskiBrut: g.brut, yeniBrut: yeniBrut, eski: eski, yeni: yeni, etkiler: etkiler,
      netDegisim: yeni.toplam.net - eski.toplam.net,
      netArtis: yeni.toplam.net / eski.toplam.net - 1,
      brutArtis: yeniBrut / g.brut - 1,
      asgariKati: { eski: g.brut / dE.asgariBrut, yeni: yeniBrut / dY.asgariBrut },
      esitEndeksNet: esit.toplam.net,
      endeksFarki: esit.toplam.net - yeni.toplam.net
    };
    return r;
  }

  return { surum: "1.0.0", bazYil: bazYil, parametre: parametre, hesapla: hesapla, yil12: yil12, asgariDilimi: asgariDilimi };
});
