/*!
 * Bordro Motoru — Türkiye ücret bordrosu hesaplama çekirdeği (2020-2026)
 *
 * Bağımlılıksız. Hem tarayıcıda (window.Bordro) hem Node'da (require) çalışır.
 * Kümülatif gelir vergisi tarifesi, SGK taban/tavan, asgari ücret istisnası,
 * AGİ rejimi (2020-2021), damga vergisi, yıl içi asgari ücret değişiklikleri
 * ve netten brüte iteratif çözüm.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/bordro/
 */
(function (root, factory) {
  "use strict";
  var params = (typeof module === "object" && module.exports)
    ? require("./parametreler.js")
    : root.BORDRO_PARAMETRELERI;
  var v = factory(params);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Bordro = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PARAMETRELER) {
  "use strict";

  var AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  /* ---------- parametre erişimi ---------- */

  function yillar() {
    return Object.keys(PARAMETRELER).map(Number).sort(function (a, b) { return b - a; });
  }

  function sonYil() { return yillar()[0]; }

  function parametre(yil) {
    var P = PARAMETRELER[yil];
    if (!P) throw new Error("Bordro: " + yil + " yılı için parametre tanımlı değil.");
    return P;
  }

  /* Ayın (1-12) geçerli olduğu dönem: yıl içi asgari ücret değişikliklerini karşılar. */
  function donem(P, ay) {
    var d = P.donemler[0];
    for (var i = 1; i < P.donemler.length; i++) {
      if (P.donemler[i].ay <= ay) d = P.donemler[i];
    }
    return d;
  }

  /* ---------- tarife ---------- */

  /* Kümülatif matrah üzerinden tarifeye göre toplam gelir vergisi. */
  function tarifeVergisi(matrah, dilimler) {
    if (matrah <= 0) return 0;
    var vergi = 0, onceki = 0;
    for (var i = 0; i < dilimler.length; i++) {
      var ust = dilimler[i][0] === null ? Infinity : dilimler[i][0];
      var oran = dilimler[i][1];
      if (matrah > ust) { vergi += (ust - onceki) * oran; onceki = ust; }
      else { vergi += (matrah - onceki) * oran; break; }
    }
    return vergi;
  }

  /* Verilen kümülatif matrahın içinde bulunduğu dilimin marjinal oranı. */
  function dilimOrani(matrah, dilimler) {
    for (var i = 0; i < dilimler.length; i++) {
      var ust = dilimler[i][0] === null ? Infinity : dilimler[i][0];
      if (matrah <= ust) return dilimler[i][1];
    }
    return dilimler[dilimler.length - 1][1];
  }

  /* ---------- tek ay ---------- */

  /* birikim: { matrah, asgariMatrah } — yerinde güncellenir. */
  function hesaplaAy(brut, ay, P, birikim, secenekler) {
    var d = donem(P, ay);
    var o = P.oranlar;

    /* secenekler.primsiz: ücret geliri var ama 4/a primi yok.
       Tipik örnek, limited şirket ortağına ödenen huzur hakkı/ücret — ortak
       zaten 4/b sigortalısı olduğu için bu ödemeden SGK primi kesilmez, ama
       ödeme ücret sayıldığından gelir ve damga vergisine tabidir. */
    var primsiz = !!(secenekler && secenekler.primsiz);

    // Prime esas kazanç: alt sınır asgari ücret, üst sınır SGK tavanı.
    var primEsas = primsiz ? 0 : Math.min(Math.max(brut, d.asgariBrut), d.sgkTavan);
    var sgk = primEsas * o.sgkIsci;
    var issizlik = primEsas * o.issizlikIsci;

    var matrah = brut - sgk - issizlik;
    var kumulOnce = birikim.matrah;
    var vergiTarife = tarifeVergisi(kumulOnce + matrah, P.dilimler) - tarifeVergisi(kumulOnce, P.dilimler);

    // İstisna / indirim
    var istisna = 0, agi = 0, asgariMatrah = 0;
    if (P.istisnaRejimi === "asgari-ucret") {
      asgariMatrah = d.asgariBrut * (1 - o.sgkIsci - o.issizlikIsci);
      istisna = tarifeVergisi(birikim.asgariMatrah + asgariMatrah, P.dilimler)
              - tarifeVergisi(birikim.asgariMatrah, P.dilimler);
    } else {
      var oran = (secenekler && typeof secenekler.agiOrani === "number")
        ? secenekler.agiOrani : P.agiOranlari.kendisi;
      agi = d.asgariBrut * oran * 0.15;
      istisna = agi;
    }
    var gelirVergisi = Math.max(0, vergiTarife - istisna);

    var damga = P.damgaIstisnasi
      ? Math.max(0, brut - d.asgariBrut) * o.damga
      : brut * o.damga;

    var net = brut - sgk - issizlik - gelirVergisi - damga;

    // 2021 uygulaması: asgari ücretlinin neti yıl içinde taban tutarın altına düşmez.
    var ilaveAgi = 0;
    if (P.netAsgariTaban && brut <= d.asgariBrut + 0.005 && net < P.netAsgariTaban) {
      ilaveAgi = P.netAsgariTaban - net;
      gelirVergisi = Math.max(0, gelirVergisi - ilaveAgi);
      net = brut - sgk - issizlik - gelirVergisi - damga;
    }

    birikim.matrah += matrah;
    birikim.asgariMatrah += asgariMatrah;

    return {
      ay: ay,
      ayAdi: AY_ADLARI[ay - 1],
      brut: brut,
      primEsas: primEsas,
      sgk: sgk,
      issizlik: issizlik,
      matrah: matrah,
      kumulatifMatrah: birikim.matrah,
      dilim: dilimOrani(birikim.matrah, P.dilimler),
      vergiTarife: vergiTarife,
      istisna: Math.min(istisna + ilaveAgi, vergiTarife),
      agi: agi + ilaveAgi,
      gelirVergisi: gelirVergisi,
      damga: damga,
      net: net,
      isverenMaliyeti: brut + primEsas * (o.sgkIsveren + o.issizlikIsveren),
      asgariBrut: d.asgariBrut,
      sgkTavan: d.sgkTavan
    };
  }

  /* ---------- 12 ay ---------- */

  /* brut: sayı (her ay aynı) veya 12 elemanlı dizi. */
  function hesaplaYil(brut, yil, secenekler) {
    var P = parametre(yil);
    var birikim = { matrah: 0, asgariMatrah: 0 };
    var aylar = [];
    for (var ay = 1; ay <= 12; ay++) {
      var g = Array.isArray(brut) ? brut[ay - 1] : brut;
      aylar.push(hesaplaAy(g, ay, P, birikim, secenekler));
    }
    // Dilim geçişi olan ayı işaretle — "maaşım neden düştü" sorusunun cevabı.
    for (var i = 1; i < aylar.length; i++) {
      aylar[i].dilimGecisi = aylar[i].dilim !== aylar[i - 1].dilim;
    }
    aylar[0].dilimGecisi = false;

    return { yil: yil, parametre: P, aylar: aylar, toplam: ozet(aylar) };
  }

  function ozet(aylar) {
    var t = { brut: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, damga: 0, istisna: 0, net: 0, isverenMaliyeti: 0 };
    aylar.forEach(function (a) {
      t.brut += a.brut; t.sgk += a.sgk; t.issizlik += a.issizlik;
      t.gelirVergisi += a.gelirVergisi; t.damga += a.damga; t.istisna += a.istisna;
      t.net += a.net; t.isverenMaliyeti += a.isverenMaliyeti;
    });
    t.ortalamaNet = t.net / 12;
    t.ilkAyNet = aylar[0].net;
    t.sonAyNet = aylar[11].net;
    return t;
  }

  /* ---------- netten brüte ---------- */

  /* Hedef neti verilen ayda (0 = Ocak) sağlayan brütü ikili aramayla çözer. */
  function nettenBrute(hedefNet, yil, ayIndex, secenekler) {
    ayIndex = ayIndex || 0;
    function netAt(g) { return hesaplaYil(g, yil, secenekler).aylar[ayIndex].net; }
    var alt = hedefNet, ust = hedefNet * 2.2 + 1000, guvenlik = 0;
    while (netAt(ust) < hedefNet && guvenlik++ < 60) ust *= 1.5;
    for (var i = 0; i < 60; i++) {
      var orta = (alt + ust) / 2;
      if (netAt(orta) < hedefNet) alt = orta; else ust = orta;
    }
    return Math.round(ust * 100) / 100;
  }

  return {
    surum: "1.0.1",
    AY_ADLARI: AY_ADLARI,
    parametreler: PARAMETRELER,
    yillar: yillar,
    sonYil: sonYil,
    parametre: parametre,
    donem: donem,
    tarifeVergisi: tarifeVergisi,
    dilimOrani: dilimOrani,
    hesaplaAy: hesaplaAy,
    hesaplaYil: hesaplaYil,
    nettenBrute: nettenBrute
  };
});
