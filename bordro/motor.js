/*!
 * Bordro Motoru — Türkiye ücret bordrosu hesaplama çekirdeği (2020-2026)
 *
 * Bağımlılıksız. Hem tarayıcıda (window.Bordro) hem Node'da (require) çalışır.
 * Kümülatif gelir vergisi tarifesi, SGK taban/tavan, asgari ücret istisnası,
 * AGİ rejimi (2020-2021), damga vergisi, yıl içi asgari ücret değişiklikleri,
 * kıst ay (eksik gün), engellilik indirimi, BES otomatik katılım kesintisi
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

  /* Ayın (1-12) geçerli kesinti oranları: yıl oranları + o aya kadar
     yürürlüğe girmiş oranDegisimleri. Yıl içinde değişen oran yoksa
     P.oranlar'ın kendisi döner. */
  function oranlarAy(P, ay) {
    var d = P.oranDegisimleri;
    if (!d || !d.length) return P.oranlar;
    var o = {};
    for (var k in P.oranlar) o[k] = P.oranlar[k];
    d.forEach(function (x) {
      if (x.ay <= ay) for (var j in x) if (j !== "ay") o[j] = x[j];
    });
    return o;
  }

  /* 5510 m.81/ı indirimi, puan cinsinden oran. secenekler.tesvik:
     "genel" (özel sektör, imalat dışı) ya da "imalat" (NACE C). Eski ad
     tesvik5Puan "imalat" sayılır: 5 puan yalnız orada kaldı. */
  function tesvikOrani(o, secenekler) {
    if (!secenekler) return 0;
    var t = secenekler.tesvik || (secenekler.tesvik5Puan ? "imalat" : null);
    if (t === "imalat") return o.sgkIsverenIndirimImalat != null ? o.sgkIsverenIndirimImalat : (o.sgkIsverenIndirim || 0);
    if (t === "genel") return o.sgkIsverenIndirim || 0;
    return 0;
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

  /* ---------- seçenek yardımcıları ---------- */

  /* secenekler.gun: ayın prim gün sayısı (0-30). Sayı ya da 12 elemanlı dizi;
     verilmezse 30. Kıst ay: ay içinde işe başlama/ayrılma ya da kısmi süreli
     çalışma. Brüt, o ay GERÇEKTEN ödenen tutardır; motor onu gün oranıyla
     bölmez, yalnızca SGK alt ve üst sınırını güne indirir. */
  function gunAy(secenekler, ay) {
    var g = secenekler && secenekler.gun;
    if (g == null) return 30;
    if (Array.isArray(g)) g = g[ay - 1];
    g = Number(g);
    if (!isFinite(g) || g < 0 || g > 30 || Math.round(g) !== g) {
      throw new Error("Bordro: gün sayısı 0 ile 30 arasında tam sayı olmalı.");
    }
    return g;
  }

  /* secenekler.engellilik: 1, 2 ya da 3 (derece). GVK m.31. */
  function engellilikTutari(P, secenekler) {
    var d = secenekler && secenekler.engellilik;
    if (!d) return 0;
    if ([1, 2, 3].indexOf(Number(d)) < 0) throw new Error("Bordro: engellilik derecesi 1, 2 ya da 3 olmalı.");
    if (!P.engellilik) throw new Error("Bordro: " + P.yil + " yılı için engellilik indirimi tutarı tanımlı değil.");
    return P.engellilik[Number(d) - 1];
  }

  /* ---------- tek ay ---------- */

  /* birikim: { matrah, asgariMatrah } — yerinde güncellenir. */
  function hesaplaAy(brut, ay, P, birikim, secenekler) {
    var d = donem(P, ay);
    var o = oranlarAy(P, ay);
    var gun = gunAy(secenekler, ay);
    /* Kıst ay 2022 öncesinde modellenmez: AGİ'nin eksik günde nasıl
       uygulandığı bu motorda kaynakla doğrulanmadı. */
    if (gun < 30 && P.istisnaRejimi !== "asgari-ucret") {
      throw new Error("Bordro: kıst ay (30 günden az) yalnızca 2022 ve sonrası için hesaplanır.");
    }
    if (gun === 0) brut = 0; // o ay ücret ödenmedi (işe başlamadan önce / ayrıldıktan sonra)

    /* secenekler.primsiz: ücret geliri var ama 4/a primi yok.
       Tipik örnek, limited şirket ortağına ödenen huzur hakkı/ücret — ortak
       zaten 4/b sigortalısı olduğu için bu ödemeden SGK primi kesilmez, ama
       ödeme ücret sayıldığından gelir ve damga vergisine tabidir. */
    var primsiz = !!(secenekler && secenekler.primsiz);
    /* secenekler.tesvik: 5510 m.81/ı indirimi ("genel" | "imalat");
       oranı yıla ve aya göre tesvikOrani() verir. */
    var isvSgkOran = o.sgkIsveren - tesvikOrani(o, secenekler);

    /* Prime esas kazanç: alt sınır asgari ücret, üst sınır SGK tavanı; kıst
       ayda ikisi de prim gün sayısına indirilir (günlük tutar × gün). Gün 0
       ise o ay bordro yoktur. */
    var primEsas = (primsiz || gun === 0) ? 0
      : Math.min(Math.max(brut, d.asgariBrut * gun / 30), d.sgkTavan * gun / 30);
    var sgk = primEsas * o.sgkIsci;
    var issizlik = primEsas * o.issizlikIsci;

    /* Engellilik indirimi (GVK m.31) tarifeden önce matrahtan düşülür (318
       Seri No'lu GVGT m.6/1). Matrahtan büyük olamaz; artan kısım devretmez. */
    var matrahOnce = brut - sgk - issizlik;
    var engellilik = Math.min(Math.max(0, matrahOnce), engellilikTutari(P, secenekler));
    var matrah = matrahOnce - engellilik;
    var kumulOnce = birikim.matrah;
    var vergiTarife = tarifeVergisi(kumulOnce + matrah, P.dilimler) - tarifeVergisi(kumulOnce, P.dilimler);

    /* secenekler.istisnasiz: ikinci (ve sonraki) isverenin bordrosu.
       GVK 23/18 ve 488 sayili Kanuna ekli (2) sayili tablo, asgari ucret
       istisnasini "birden fazla isverenden ucret alinmasi halinde
       yalnizca EN YUKSEK olan ucrete" bagliyor. Yani ikinci isveren ne
       gelir vergisi istisnasini ne de damga istisnasini uygular; iki
       bordroda birden uygulanmasi hatali bir kesintidir.
       Tarife yine SIFIRDAN baslar -- kumulatif matrah isverene ozeldir --
       istisna uygulanmaz. */
    var istisnasiz = !!(secenekler && secenekler.istisnasiz);

    // İstisna / indirim
    var istisna = 0, agi = 0, asgariMatrah = 0;
    if (istisnasiz) {
      /* asgariMatrah 0 kalir: birikim kirlenmesin. */
    } else if (P.istisnaRejimi === "asgari-ucret") {
      /* Kıst ayda da istisna TAM uygulanır: "yeni işe başlayan ve işten
         ayrılan hizmet erbabına yapılan kıst ücret ödemelerine istisna tam
         olarak uygulanacaktır" (318 Seri No'lu GVGT m.6/2). Asgari ücretlinin
         birikimi işe başlamadan önceki aylarda da ilerler: istisna, asgari
         ücretin O AYDAKİ vergisidir. Menfaat hesaplanan vergiyi aşamaz
         (aşağıda max(0, ...)). */
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

    var damga = (P.damgaIstisnasi && !istisnasiz)
      ? Math.max(0, brut - d.asgariBrut) * o.damga
      : brut * o.damga;

    var net = brut - sgk - issizlik - gelirVergisi - damga;

    // 2021 uygulaması: asgari ücretlinin neti yıl içinde taban tutarın altına düşmez.
    var ilaveAgi = 0;
    if (P.netAsgariTaban && gun === 30 && brut <= d.asgariBrut + 0.005 && net < P.netAsgariTaban) {
      ilaveAgi = P.netAsgariTaban - net;
      gelirVergisi = Math.max(0, gelirVergisi - ilaveAgi);
      net = brut - sgk - issizlik - gelirVergisi - damga;
    }

    birikim.matrah += matrah;
    birikim.asgariMatrah += asgariMatrah;

    /* BES otomatik katılım (4632 s.K. ek m.2): prime esas kazancın oranı
       (yasal varsayılan %3) netten kesilip emeklilik şirketine aktarılır.
       Vergi matrahını ve neti DEĞİŞTİRMEZ; ele geçen tutarı azaltır. */
    var besOran = (secenekler && secenekler.bes) ? Number(secenekler.bes) : 0;
    if (!isFinite(besOran) || besOran < 0 || besOran > 1) throw new Error("Bordro: BES oranı 0 ile 1 arasında olmalı.");
    var bes = primEsas * besOran;

    return {
      ay: ay,
      ayAdi: AY_ADLARI[ay - 1],
      gun: gun,
      brut: brut,
      primEsas: primEsas,
      sgk: sgk,
      issizlik: issizlik,
      matrah: matrah,
      engellilik: engellilik,
      kumulatifMatrah: birikim.matrah,
      dilim: dilimOrani(birikim.matrah, P.dilimler),
      vergiTarife: vergiTarife,
      istisna: Math.min(istisna + ilaveAgi, vergiTarife),
      agi: agi + ilaveAgi,
      gelirVergisi: gelirVergisi,
      damga: damga,
      net: net,
      bes: bes,
      eleGecen: net - bes,
      isverenSgk: primEsas * isvSgkOran,
      isverenIssizlik: primEsas * o.issizlikIsveren,
      isverenMaliyeti: brut + primEsas * (isvSgkOran + o.issizlikIsveren),
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
    var t = { brut: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, damga: 0, istisna: 0, net: 0, isverenMaliyeti: 0,
      engellilik: 0, bes: 0, eleGecen: 0 };
    aylar.forEach(function (a) {
      t.brut += a.brut; t.sgk += a.sgk; t.issizlik += a.issizlik;
      t.gelirVergisi += a.gelirVergisi; t.damga += a.damga; t.istisna += a.istisna;
      t.net += a.net; t.isverenMaliyeti += a.isverenMaliyeti;
      t.engellilik += a.engellilik; t.bes += a.bes; t.eleGecen += a.eleGecen;
    });
    t.ortalamaNet = t.net / 12;
    t.ilkAyNet = aylar[0].net;
    t.sonAyNet = aylar[11].net;
    return t;
  }

  /* ---------- netten brüte ---------- */

  /* Net ücret sözleşmesinin 12 aylık brütü.

     Neden ayrı bir fonksiyon: nettenBrute() tek bir ayı çözerken o brütün yıl
     boyunca SABİT olduğunu varsayar. Net sözleşmede brüt her ay değişir, bu
     yüzden kümülatif matrah başka türlü birikir; aylık çözümleri tek tek alıp
     yan yana koymak neti bazı aylarda hedefin üstüne çıkarıyordu. Burada her
     ay, o aya kadar GERÇEKLEŞEN birikimle çözülür ve çözüldükten sonra birikim
     o brütle ilerletilir. */
  /* hedefNet: sayı ya da 12 elemanlı dizi (kıst ayda o ayın hedefi). Gün
     sayısı 0 olan ayda brüt 0'dır; birikim yine ilerletilir. */
  function nettenBruteYil(hedefNet, yil, secenekler) {
    var P = parametre(yil);
    var birikim = { matrah: 0, asgariMatrah: 0 };
    var brutler = [];

    function netAt(x, ay) {
      var kopya = {};
      for (var k in birikim) if (Object.prototype.hasOwnProperty.call(birikim, k)) kopya[k] = birikim[k];
      return hesaplaAy(x, ay, P, kopya, secenekler).net;
    }

    for (var ay = 1; ay <= 12; ay++) {
      var hedef = Array.isArray(hedefNet) ? hedefNet[ay - 1] : hedefNet;
      if (gunAy(secenekler, ay) === 0 || !(hedef > 0)) {
        brutler.push(0);
        hesaplaAy(0, ay, P, birikim, secenekler);
        continue;
      }
      var alt = hedef, ust = hedef * 2.2 + 1000, guvenlik = 0;
      while (netAt(ust, ay) < hedef && guvenlik++ < 60) ust *= 1.5;
      for (var i = 0; i < 60; i++) {
        var orta = (alt + ust) / 2;
        if (netAt(orta, ay) < hedef) alt = orta; else ust = orta;
      }
      var g = Math.round(ust * 100) / 100;
      brutler.push(g);
      hesaplaAy(g, ay, P, birikim, secenekler); // birikimi bu brütle ilerlet
    }
    return brutler;
  }


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
    surum: "1.2.0",
    AY_ADLARI: AY_ADLARI,
    parametreler: PARAMETRELER,
    yillar: yillar,
    sonYil: sonYil,
    parametre: parametre,
    donem: donem,
    oranlarAy: oranlarAy,
    tesvikOrani: tesvikOrani,
    gunAy: gunAy,
    engellilikTutari: engellilikTutari,
    tarifeVergisi: tarifeVergisi,
    dilimOrani: dilimOrani,
    hesaplaAy: hesaplaAy,
    hesaplaYil: hesaplaYil,
    nettenBrute: nettenBrute,
    nettenBruteYil: nettenBruteYil
  };
});
