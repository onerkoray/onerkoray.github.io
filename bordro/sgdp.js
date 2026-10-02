/*!
 * Emekli çalışan (SGDP) — karşılaştırma motoru.
 *
 * Bordro Motoru'nun sgdp seçeneğinin üstünde çalışır; yasal sayı içermez.
 * Oranlar bordro/parametreler.js'te, tek ay hesabı bordro/motor.js'tedir.
 * Bu dosyanın işi soruları cevaplamak:
 *
 *   karsilastir()  aynı brütte ya da aynı nette emekli ve emekli olmayan
 *                  çalışanın 12 aylık bordrosu, farklar, emekli aylığıyla
 *                  ele geçen toplam, işe yıl içinde giriş
 *   egri()         ücret aralığında yıllık maliyet ve net farkı (grafik)
 *   esikNet()      net anlaşmada emeklinin ucuzlamaya başladığı net tutar
 *
 * Asgari ücret sınırı motorun değil sözleşmenin kuralıdır: brüt, o ayın
 * brüt asgari ücretinden az olamaz. Netten bulunan brüt bu sınırın
 * altına düşerse asgari ücrete çekilir ve çalışan hedeften fazla net
 * alır. Net anlaşmada emeklinin işverene pahalı kaldığı bölge budur:
 * 2026'da emekli asgari ücretlinin neti 30.181,16 TL, emekli olmayanınki
 * 28.075,50 TL; aradaki netlerde emekliye fazladan ödenir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/emekli-calisan-maas-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("./motor.js"));
  else kok.Sgdp = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  var TESVIKLER = ["", "genel", "imalat"];

  function hata(m) { throw new Error(m); }

  function yilParam(yil) {
    var y = yil == null ? B.sonYil() : Number(yil);
    if (B.yillar().indexOf(y) < 0) hata(y + " yılı için bordro parametresi yok (" + B.yillar().slice(-1)[0] + "–" + B.sonYil() + ").");
    return B.parametre(y);
  }

  /* İşe giriş ayı: o aydan önce bordro yok, o aydan sonra tam ay.
     Kıst ay motorda yalnız asgari ücret istisnası rejiminde (2022+). */
  function gunler(P, girisAyi) {
    var g = girisAyi == null ? 1 : Number(girisAyi);
    if (!(g >= 1 && g <= 12 && Math.round(g) === g)) hata("İşe giriş ayı 1 ile 12 arasında olmalı.");
    if (g === 1) return null;
    if (P.istisnaRejimi !== "asgari-ucret") hata("Yıl içinde işe giriş 2022 ve sonrası için hesaplanır.");
    var d = [];
    for (var i = 1; i <= 12; i++) d.push(i < g ? 0 : 30);
    return d;
  }

  function secenek(tur, tesvik, gun) {
    var s = tur === "emekli" ? { sgdp: true } : (tesvik ? { tesvik: tesvik } : {});
    if (gun) s.gun = gun;
    return s;
  }

  /* Anlaşmanın 12 aylık brütü. Net modda motorun çözümü asgari ücrete
     kırpılır; kırpılan aylar ayrıca döner. */
  function brutler(P, mod, tutar, sec) {
    var gun = sec.gun, liste, kirpilan = [];
    if (mod === "net") {
      var hedef = [];
      for (var i = 0; i < 12; i++) hedef.push(gun && !gun[i] ? 0 : tutar);
      liste = B.nettenBruteYil(hedef, P.yil, sec);
    } else {
      liste = [];
      for (var j = 0; j < 12; j++) liste.push(gun && !gun[j] ? 0 : tutar);
    }
    liste = liste.map(function (b, k) {
      if (gun && !gun[k]) return 0;
      var alt = B.donem(P, k + 1).asgariBrut;
      if (b < alt - 0.005) { kirpilan.push(k + 1); return alt; }
      return b;
    });
    return { liste: liste, kirpilan: kirpilan };
  }

  function dogrula(g) {
    if (!g || typeof g !== "object") hata("Girdi bir nesne olmalı.");
    var tutar = Number(g.tutar);
    if (!(tutar > 0) || !isFinite(tutar)) hata("Tutar sıfırdan büyük bir sayı olmalı.");
    var mod = g.mod || "brut";
    if (mod !== "brut" && mod !== "net") hata("Anlaşma brüt ya da net olmalı.");
    var tesvik = g.tesvik || "";
    if (TESVIKLER.indexOf(tesvik) < 0) hata("Prim indirimi yok, genel ya da imalat olmalı.");
    var aylik = g.aylik == null || g.aylik === "" ? 0 : Number(g.aylik);
    if (!(aylik >= 0) || !isFinite(aylik)) hata("Emekli aylığı sıfır ya da pozitif olmalı.");
    var P = yilParam(g.yil);
    if (mod === "brut") {
      var alt = B.donem(P, 1).asgariBrut;
      for (var a = 2; a <= 12; a++) alt = Math.min(alt, B.donem(P, a).asgariBrut);
      if (tutar < alt - 0.005) hata("Brüt ücret asgari ücretten (" + alt.toLocaleString("tr-TR") + " TL) az olamaz.");
    }
    return { P: P, tutar: tutar, mod: mod, tesvik: tesvik, aylik: aylik, gun: gunler(P, g.girisAyi) };
  }

  function karsilastir(g) {
    var x = dogrula(g), P = x.P;
    var sE = secenek("emekli", x.tesvik, x.gun), sN = secenek("normal", x.tesvik, x.gun);
    var bE = brutler(P, x.mod, x.tutar, sE), bN = brutler(P, x.mod, x.tutar, sN);
    var e = B.hesaplaYil(bE.liste, P.yil, sE), n = B.hesaplaYil(bN.liste, P.yil, sN);
    var calisilan = e.aylar.filter(function (a) { return a.gun > 0; }).length;

    var aylar = e.aylar.map(function (a, i) {
      var b = n.aylar[i];
      return {
        ay: a.ay, ayAdi: a.ayAdi, calisti: a.gun > 0,
        emekli: a, normal: b,
        netFarki: a.net - b.net,
        maliyetFarki: a.isverenMaliyeti - b.isverenMaliyeti,
        eleGecen: x.aylik + a.net,
        dilimGecisi: a.gun > 0 && !!a.dilimGecisi
      };
    });
    var maliyetFarki = e.toplam.isverenMaliyeti - n.toplam.isverenMaliyeti;
    var netFarki = e.toplam.net - n.toplam.net;
    var o = B.oranlarAy(P, 1);

    return {
      yil: P.yil, mod: x.mod, tutar: x.tutar, tesvik: x.tesvik, aylik: x.aylik,
      calisilanAy: calisilan,
      emekli: e, normal: n, aylar: aylar,
      kirpilan: { emekli: bE.kirpilan, normal: bN.kirpilan },
      oranlar: {
        emekliIsci: o.sgdpIsci,
        emekliIsveren: o.sgdpIsveren + o.kisaVadeli,
        normalIsci: o.sgkIsci + o.issizlikIsci,
        normalIsveren: o.sgkIsveren - B.tesvikOrani(o, sN) + o.issizlikIsveren,
        tesvikPuan: B.tesvikOrani(o, sN)
      },
      fark: {
        netYil: netFarki,
        maliyetYil: maliyetFarki,
        netOcak: aylar[0].netFarki,
        maliyetOcak: aylar[0].maliyetFarki
      },
      /* İşverenin tek cümlelik cevabı: emekli pahalı mı ucuz mu? */
      hukum: {
        yon: Math.abs(maliyetFarki) < 0.005 ? "esit" : (maliyetFarki > 0 ? "pahali" : "ucuz"),
        tutar: Math.abs(maliyetFarki)
      },
      birNet: {
        emekli: e.toplam.isverenMaliyeti / e.toplam.net,
        normal: n.toplam.isverenMaliyeti / n.toplam.net
      },
      toplamGelir: {
        aylikOrtalama: x.aylik + e.toplam.net / calisilan,
        yillik: x.aylik * 12 + e.toplam.net
      },
      tavanda: e.aylar.some(function (a) { return a.gun > 0 && a.primEsas < a.brut - 0.5; })
    };
  }

  /* Ocak ayı asgari ücretinden tavanın ustOran katına, iki anlaşma
     biçiminde yıllık maliyet ve net farkı. İşe giriş ayı yok sayılır. */
  function egri(g) {
    g = g || {};
    var P = yilParam(g.yil), tesvik = g.tesvik || "";
    if (TESVIKLER.indexOf(tesvik) < 0) hata("Prim indirimi yok, genel ya da imalat olmalı.");
    var adim = g.nokta || 48;
    var d1 = B.donem(P, 1), tavan = P.donemler[P.donemler.length - 1].sgkTavan;
    var ust = g.ust || tavan * 1.2;
    var asgariNet = B.hesaplaYil(d1.asgariBrut, P.yil).aylar[0].net;
    function seri(mod) {
      var alt = mod === "net" ? asgariNet : d1.asgariBrut;
      var noktalar = [];
      for (var i = 0; i <= adim; i++) {
        var t = alt + (ust - alt) * i / adim;
        var r = karsilastir({ tutar: t, mod: mod, yil: P.yil, tesvik: tesvik });
        noktalar.push({ tutar: t, maliyetFarki: r.fark.maliyetYil, netFarki: r.fark.netYil });
      }
      return noktalar;
    }
    return { yil: P.yil, tesvik: tesvik, tavan: tavan, asgariBrut: d1.asgariBrut, asgariNet: asgariNet,
      brut: seri("brut"), net: seri("net"), esikNet: esikNet({ yil: P.yil, tesvik: tesvik }) };
  }

  /* Net anlaşmada yıllık maliyet farkının sıfıra indiği net (TL, kuruş).
     Altında emekli pahalı, üstünde ucuz. Fark nette azalan; ikiye bölme. */
  function esikNet(g) {
    g = g || {};
    var P = yilParam(g.yil), tesvik = g.tesvik || "";
    function f(t) { return karsilastir({ tutar: t, mod: "net", yil: P.yil, tesvik: tesvik }).fark.maliyetYil; }
    var alt = B.hesaplaYil(B.donem(P, 1).asgariBrut, P.yil).aylar[0].net * 0.9;
    var ust = B.hesaplaYil(B.donem(P, 1).asgariBrut, P.yil, { sgdp: true }).aylar[0].net * 1.6;
    if (f(alt) <= 0) return alt;
    if (f(ust) > 0) return null;
    for (var i = 0; i < 50; i++) {
      var m = (alt + ust) / 2;
      if (f(m) > 0) alt = m; else ust = m;
    }
    return Math.round(ust * 100) / 100;
  }

  return { karsilastir: karsilastir, egri: egri, esikNet: esikNet, TESVIKLER: TESVIKLER };
});
