/*!
 * Grafikler sayfasının hesabı — seriler ve sayfadaki her rakam buradan çıkar.
 *
 * Tarayıcıda grafikleri, node'da sayfa üretecini (tools/grafikler-sayfa.js)
 * ve testi (grafikler/test.js) aynı fonksiyon besler. Sayfadaki bir rakam
 * elle yazılmaz; seri güncellenince metin de onunla birlikte değişir.
 *
 * Girdi : TufeSerisi (finans/tufe-serisi.js), GrafikVerisi
 *         (finans/grafik-verisi.js), Bordro (bordro/motor.js).
 *
 * Tanımlar (sayfada da açıkça yazılı):
 *   fiyat endeksi   Aralık 2004 = 100; her ay TÜFE aylık değişimiyle zincirlenir.
 *   reel faiz       Fisher: (1 + politika faizi) / (1 + yıllık TÜFE) − 1,
 *                   ay sonunda yürürlükteki faiz ile o ayın yıllık TÜFE'si.
 *   kur             ayın son iş günü TCMB döviz satış kuru.
 *   asgari ücret    resmî net (bekâr, çocuksuz); dolar karşılığı o ayın
 *                   son iş günü kuruyla, reel karşılığı son ayın fiyatlarıyla.
 *   altın (gram TL) Dünya Bankası aylık ortalama ons fiyatı × ay sonu dolar
 *                   kuru ÷ 31,1034768. Ortalama ile ay sonu karışımı bilinçli:
 *                   aylık ortalama kur yok; 21 yıllık katta fark ihmal edilir.
 *   vergi eşiği     ikinci ve üçüncü gelir vergisi eşiği ÷ (Ocak asgari
 *                   brütü × 12) — dilim kayması yazısıyla aynı tanım.
 *   dünya           BIS aylık yıllık TÜFE ve ay sonu politika faizi; sıralama,
 *                   o seride bütün ekonomilerin verisi olan son ay.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GrafikHesap = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function ayAdi(ay) {
    var p = ay.split("-");
    return AYLAR[+p[1] - 1] + " " + p[0];
  }

  function aySayisi(a, b) {           // a'dan b'ye kaç ay
    var x = a.split("-"), y = b.split("-");
    return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]);
  }

  function sonrakiAy(ay) {
    var p = ay.split("-"), y = +p[0], m = +p[1] + 1;
    if (m === 13) { y++; m = 1; }
    return y + "-" + (m < 10 ? "0" : "") + m;
  }

  /* ---- I. Fiyat seviyesi ------------------------------------------------ */
  function fiyatEndeksi(T) {
    var v = 100, seri = [];
    Object.keys(T.aylar).sort().forEach(function (ay) {
      v *= 1 + T.aylar[ay].aylik / 100;
      seri.push({ ay: ay, endeks: v, yillik: T.aylar[ay].yillik });
    });
    return seri;
  }

  /* Fiyatlar 200'ü, 400'ü, 800'ü... ilk geçtiği ay. */
  function ikiyeKatlanmalar(fiyat) {
    var esik = 200, onceki = "2004-12", liste = [];
    fiyat.forEach(function (n) {
      while (n.endeks >= esik) {
        liste.push({ ay: n.ay, esik: esik, sure: aySayisi(onceki, n.ay) });
        onceki = n.ay;
        esik *= 2;
      }
    });
    return liste;
  }

  /* ---- III. Politika faizi ve reel faiz -------------------------------- */
  function faizAylik(fiyat, kararlar) {
    var seri = [];
    var ilk = kararlar[0][0].slice(0, 7);
    fiyat.forEach(function (n) {
      if (n.ay < ilk) return;
      var ayinSonu = n.ay + "-31", faiz = null;
      for (var i = 0; i < kararlar.length; i++) {
        if (kararlar[i][0] <= ayinSonu) faiz = kararlar[i][1];
      }
      var reel = 100 * ((1 + faiz / 100) / (1 + n.yillik / 100) - 1);
      seri.push({ ay: n.ay, faiz: faiz, tufe: n.yillik, reel: reel });
    });
    return seri;
  }

  function negatifDonemler(faiz) {
    var donem = [], acik = null;
    faiz.forEach(function (n) {
      if (n.reel < 0) {
        if (!acik) { acik = { bas: n.ay, son: n.ay, ay: 0, dip: n }; donem.push(acik); }
        acik.son = n.ay; acik.ay++;
        if (n.reel < acik.dip.reel) acik.dip = n;
      } else acik = null;
    });
    return donem;
  }

  /* ---- IV. Kur ve fiyatlar ---------------------------------------------- */
  function kurSerisi(fiyat, kur) {
    var tufeTaban = null, usdTaban = null, eurTaban = null, seri = [];
    fiyat.forEach(function (n) {
      var k = kur[n.ay];
      if (!k) return;
      if (tufeTaban === null) { tufeTaban = n.endeks; usdTaban = k.USD; eurTaban = k.EUR; }
      seri.push({
        ay: n.ay, usd: k.USD, eur: k.EUR,
        usdEndeks: 100 * k.USD / usdTaban,
        eurEndeks: 100 * k.EUR / eurTaban,
        tufeEndeks: 100 * n.endeks / tufeTaban
      });
    });
    return seri;
  }

  /* ---- V. Asgari ücret -------------------------------------------------- */
  function asgariSerisi(fiyat, kur, Bordro) {
    var endeks = {};
    fiyat.forEach(function (n) { endeks[n.ay] = n.endeks; });
    var sonAy = fiyat[fiyat.length - 1].ay;
    var seri = [];
    for (var ay = "2020-01"; ay <= sonAy; ay = sonrakiAy(ay)) {
      if (!kur[ay]) break;
      var yil = +ay.slice(0, 4), m = +ay.slice(5, 7);
      var donem = null;
      Bordro.parametre(yil).donemler.forEach(function (d) { if (d.ay <= m) donem = d; });
      var net = donem.asgariNet;
      seri.push({
        ay: ay, net: net, brut: donem.asgariBrut,
        reel: net * endeks[sonAy] / endeks[ay],
        usd: net / kur[ay].USD
      });
    }
    return seri;
  }

  /* ---- VI. Dünya -------------------------------------------------------- */
  function dunyaSiralama(G) {
    var ortak = null;
    G.ulkeler.forEach(function (u) {
      var yillar = Object.keys(G.dunya[u[0]]);
      ortak = ortak === null ? yillar : ortak.filter(function (y) { return yillar.indexOf(y) >= 0; });
    });
    var yil = ortak.sort()[ortak.length - 1];
    var liste = G.ulkeler.map(function (u) {
      return { kod: u[0], ad: u[1], deger: G.dunya[u[0]][yil] };
    }).sort(function (a, b) { return b.deger - a.deger; });
    liste.forEach(function (x, i) { x.sira = i + 1; });
    var degerler = liste.map(function (x) { return x.deger; }).sort(function (a, b) { return a - b; });
    var n = degerler.length;
    var ortanca = n % 2 ? degerler[(n - 1) / 2] : (degerler[n / 2 - 1] + degerler[n / 2]) / 2;
    return { yil: yil, liste: liste, ortanca: ortanca };
  }

  function dunyaSerileri(G, kodlar) {
    return kodlar.map(function (kod) {
      var ad = G.ulkeler.filter(function (u) { return u[0] === kod; })[0][1];
      var d = G.dunya[kod];
      return { kod: kod, ad: ad, nokta: Object.keys(d).sort().map(function (y) { return { yil: +y, deger: d[y] }; }) };
    });
  }

  /* ---- II-b. Aylık enflasyon ısı haritası --------------------------------- */
  function isiHaritasi(T) {
    var yillar = {};
    Object.keys(T.aylar).sort().forEach(function (ay) {
      var y = ay.slice(0, 4);
      if (!yillar[y]) yillar[y] = [null, null, null, null, null, null, null, null, null, null, null, null];
      yillar[y][+ay.slice(5, 7) - 1] = T.aylar[ay].aylik;
    });
    return Object.keys(yillar).sort().map(function (y) { return { yil: +y, aylar: yillar[y] }; });
  }

  /* ---- IV-b. 2005'te 100 TL: dolar, euro, altın, fiyatlar ------------------ */
  var GRAM_ONS = 31.1034768;
  function birikim(fiyat, kur, altin) {
    var altinAy = {};
    var a0 = altin.ilk.split("-"), y0 = +a0[0], m0 = +a0[1];
    altin.usdOns.forEach(function (v, i) {
      var t = (y0 * 12 + m0 - 1) + i, yy = Math.floor(t / 12), mm = t - yy * 12 + 1;
      altinAy[yy + "-" + (mm < 10 ? "0" : "") + mm] = v;
    });
    var seri = [], taban = null;
    fiyat.forEach(function (n) {
      var k = kur[n.ay], o = altinAy[n.ay];
      if (!k || o == null) return;
      var gram = o * k.USD / GRAM_ONS;
      if (!taban) taban = { usd: k.USD, eur: k.EUR, gram: gram, endeks: n.endeks };
      seri.push({
        ay: n.ay, gram: gram, usdOns: o,
        dolar: 100 * k.USD / taban.usd, euro: 100 * k.EUR / taban.eur,
        altin: 100 * gram / taban.gram, fiyat: 100 * n.endeks / taban.endeks
      });
    });
    return seri;
  }

  /* ---- V-b. Vergi eşikleri ve asgari ücret --------------------------------- */
  function vergiEsikleri(Bordro, sonYil) {
    var seri = [];
    for (var y = 2020; y <= sonYil; y++) {
      var P;
      try { P = Bordro.parametre(y); } catch (e) { break; }
      var ya = P.donemler[0].asgariBrut * 12;
      seri.push({ yil: y, yillikAsgari: ya, ikinci: P.dilimler[1][0], ucuncu: P.dilimler[2][0],
        ikinciKat: P.dilimler[1][0] / ya, ucuncuKat: P.dilimler[2][0] / ya });
    }
    return seri;
  }

  /* ---- VI. BIS: aylık dünya -------------------------------------------------- */
  function bisAy(bis, i) {
    var p = bis.ilk.split("-"), t = +p[0] * 12 + (+p[1] - 1) + i, y = Math.floor(t / 12), m = t - y * 12 + 1;
    return y + "-" + (m < 10 ? "0" : "") + m;
  }
  /* Bütün alanlarda verisi olan son ay; "haric" listesindekiler aranmaz. */
  function ortakSonAy(bis, alan, haric) {
    var n = bis[alan].TR.length;
    for (var i = n - 1; i >= 0; i--) {
      var tam = bis.alanlar.every(function (a) {
        return (haric || []).indexOf(a[0]) >= 0 || bis[alan][a[0]][i] != null;
      });
      if (tam) return i;
    }
    return -1;
  }
  function sonGozlem(dizi) {
    for (var i = dizi.length - 1; i >= 0; i--) if (dizi[i] != null) return i;
    return -1;
  }
  function ortanca(degerler) {
    var d = degerler.slice().sort(function (a, b) { return a - b; }), n = d.length;
    return n % 2 ? d[(n - 1) / 2] : (d[n / 2 - 1] + d[n / 2]) / 2;
  }
  function dunyaAylik(bis) {
    var enfI = ortakSonAy(bis, "tufe");
    // Faiz serisi altı aydan fazla geride kalan alan (Arjantin: BIS'te Haziran
    // 2025'te bitiyor) reel faiz sıralamasına alınmaz; hangisi olduğu yazılır.
    var enSon = sonGozlem(bis.faiz.TR);
    var eskiyen = bis.alanlar.filter(function (a) { return enSon - sonGozlem(bis.faiz[a[0]]) > 6; })
      .map(function (a) { return a[0]; });
    var reelI = Math.min(ortakSonAy(bis, "faiz", eskiyen), enfI);
    var enf = bis.alanlar.map(function (a) { return { kod: a[0], ad: a[1], deger: bis.tufe[a[0]][enfI] }; })
      .sort(function (a, b) { return b.deger - a.deger; });
    enf.forEach(function (x, i) { x.sira = i + 1; });
    var reel = bis.alanlar.filter(function (a) { return eskiyen.indexOf(a[0]) < 0; }).map(function (a) {
      var f = bis.faiz[a[0]][reelI], t = bis.tufe[a[0]][reelI];
      return { kod: a[0], ad: a[1], faiz: f, tufe: t, deger: 100 * ((1 + f / 100) / (1 + t / 100) - 1) };
    }).sort(function (a, b) { return b.deger - a.deger; });
    reel.forEach(function (x, i) { x.sira = i + 1; });
    return {
      enfAy: bisAy(bis, enfI), enf: enf, enfOrtanca: ortanca(enf.map(function (x) { return x.deger; })),
      reelAy: bisAy(bis, reelI), reel: reel, eskiyen: eskiyen.map(function (k) {
        var a = bis.alanlar.filter(function (x) { return x[0] === k; })[0];
        return { kod: k, ad: a[1], sonAy: bisAy(bis, sonGozlem(bis.faiz[k])) };
      }),
      seriler: ["TR", "BR", "RU", "US", "XM"].map(function (k) {
        var a = bis.alanlar.filter(function (x) { return x[0] === k; })[0];
        return { kod: k, ad: a[1], nokta: bis.tufe[k].map(function (v, i) { return { ay: bisAy(bis, i), deger: v }; }) };
      })
    };
  }

  /* ---- VII. Büyüme ve gelir (Dünya Bankası, yıllık) ------------------------- */
  function makroSeri(G, ad) {
    var m = G.makro[ad], tur = m.TUR, yillar = Object.keys(tur).sort();
    return yillar.map(function (y) {
      var hepsi = G.ulkeler.map(function (u) { return m[u[0]][y]; }).filter(function (v) { return v != null; });
      return { yil: +y, tur: tur[y], ortanca: hepsi.length >= 15 ? ortanca(hepsi) : null, n: hepsi.length };
    });
  }
  function makroSira(G, ad) {
    var m = G.makro[ad], yil = null;
    Object.keys(m.TUR).sort().forEach(function (y) {
      if (G.ulkeler.every(function (u) { return m[u[0]][y] != null; })) yil = y;
    });
    var liste = G.ulkeler.map(function (u) { return { kod: u[0], ad: u[1], deger: m[u[0]][yil] }; })
      .sort(function (a, b) { return b.deger - a.deger; });
    liste.forEach(function (x, i) { x.sira = i + 1; });
    return { yil: yil, liste: liste };
  }

  /* ---- Zaman makinesi: seçilen ayın 100 TL'si ve doları bugün ------------ */
  function zamanMakinesi(r, ay) {
    var f = r.fiyat, son = f[f.length - 1], n = null, k = null, ks = r.kur[r.kur.length - 1];
    f.forEach(function (x) { if (x.ay === ay) n = x; });
    r.kur.forEach(function (x) { if (x.ay === ay) k = x; });
    if (!n) return null;
    return {
      ay: ay, sonAy: son.ay,
      sepet: 100 * son.endeks / n.endeks,
      kat: son.endeks / n.endeks,
      usdOnce: k ? k.usd : null, usdSon: ks.usd, kurAy: ks.ay,
      usdKat: k ? ks.usd / k.usd : null
    };
  }

  /* ---- Hepsi ------------------------------------------------------------ */
  function hesapla(T, G, Bordro) {
    var fiyat = fiyatEndeksi(T);
    var son = fiyat[fiyat.length - 1];
    var katlar = ikiyeKatlanmalar(fiyat);
    var tepe = fiyat.reduce(function (a, b) { return b.yillik > a.yillik ? b : a; });

    var faiz = faizAylik(fiyat, G.politikaFaizi);
    var faizSon = faiz[faiz.length - 1];
    var sonKarar = G.politikaFaizi[G.politikaFaizi.length - 1];
    var negatif = negatifDonemler(faiz);
    var enUzun = negatif.reduce(function (a, b) { return b.ay > a.ay ? b : a; });
    var dip = faiz.reduce(function (a, b) { return b.reel < a.reel ? b : a; });
    var negatifAy = faiz.filter(function (n) { return n.reel < 0; }).length;

    var kur = kurSerisi(fiyat, G.kur);
    var kurSon = kur[kur.length - 1], kurIlk = kur[0];

    var asgari = asgariSerisi(fiyat, G.kur, Bordro);
    var usdTepe = asgari.reduce(function (a, b) { return b.usd > a.usd ? b : a; });
    var usdDip = asgari.reduce(function (a, b) { return b.usd < a.usd ? b : a; });
    var reelTepe = asgari.reduce(function (a, b) { return b.reel > a.reel ? b : a; });
    var reelDip = asgari.reduce(function (a, b) { return b.reel < a.reel ? b : a; });
    var asgariSon = asgari[asgari.length - 1];

    var bant = fiyat.filter(function (n) { return n.ay < "2018-01"; });
    var bantIci = bant.filter(function (n) { return n.yillik >= 6 && n.yillik <= 12; }).length;
    var tepe2018 = fiyat.filter(function (n) { return n.ay.slice(0, 4) === "2018"; })
      .reduce(function (a, b) { return b.yillik > a.yillik ? b : a; });
    // Son zam dönemi: net tutarın son değiştiği ay; o aydan bu yana alım gücü
    var donemBas = asgari[0];
    asgari.forEach(function (n, i) { if (i && n.net !== asgari[i - 1].net) donemBas = n; });

    var isi = isiHaritasi(T);
    var aylikTepe = fiyat.reduce(function (a, b) { return T.aylar[b.ay].aylik > T.aylar[a.ay].aylik ? b : a; });
    var ocaklar = fiyat.filter(function (n) { return n.ay.slice(5) === "01" && n.ay >= "2022-01"; });
    var digerAylar = fiyat.filter(function (n) { return n.ay.slice(5) !== "01" && n.ay >= "2022-01"; });
    function ortalama(d, f) { return d.reduce(function (t, n) { return t + f(n); }, 0) / d.length; }

    var bir = G.altin ? birikim(fiyat, G.kur, G.altin) : [];
    var birSon = bir[bir.length - 1];

    var vergi = vergiEsikleri(Bordro, +son.ay.slice(0, 4));
    var dunyaAy = G.bis ? dunyaAylik(G.bis) : null;
    var turEnf = dunyaAy && dunyaAy.enf.filter(function (x) { return x.kod === "TR"; })[0];
    var turReel = dunyaAy && dunyaAy.reel.filter(function (x) { return x.kod === "TR"; })[0];

    var makro = G.makro ? {
      kisiBasi: makroSeri(G, "kisiBasi"), buyume: makroSeri(G, "buyume"),
      issizlik: makroSeri(G, "issizlik"), cari: makroSeri(G, "cari"),
      kisiBasiSira: makroSira(G, "kisiBasi")
    } : null;

    var siralama = dunyaSiralama(G);
    var tur = siralama.liste.filter(function (x) { return x.kod === "TUR"; })[0];

    return {
      sonAy: son.ay,
      fiyat: fiyat,
      katlar: katlar,
      faiz: faiz,
      kur: kur,
      asgari: asgari,
      siralama: siralama,
      dunya: dunyaSerileri(G, ["TUR", "ARG", "BRA", "RUS", "USA", "EMU"]),
      isi: isi,
      birikim: bir,
      vergi: vergi,
      dunyaAy: dunyaAy,
      makro: makro,
      ozet: {
        fiyatKat: son.endeks / 100,
        sonTufe: son.yillik,
        tepeTufe: { ay: tepe.ay, deger: tepe.yillik },
        katSayisi: katlar.length,
        sonKatlanma: katlar[katlar.length - 1],
        ilkKatlanma: katlar[0],

        faiz: faizSon.faiz,
        faizTarih: sonKarar[0],
        reelSon: faizSon.reel,
        reelFaizDip: { ay: dip.ay, deger: dip.reel, faiz: dip.faiz, tufe: dip.tufe },
        negatifAy: negatifAy,
        faizAySayisi: faiz.length,
        enUzunNegatif: { bas: enUzun.bas, son: enUzun.son, ay: enUzun.ay },

        usdIlk: kurIlk.usd, usdSon: kurSon.usd, kurAy: kurSon.ay,
        usdKat: kurSon.usd / kurIlk.usd,
        tufeKatKur: kurSon.tufeEndeks / 100,

        asgariSon: { ay: asgariSon.ay, net: asgariSon.net, usd: asgariSon.usd, reel: asgariSon.reel },
        usdTepe: { ay: usdTepe.ay, usd: usdTepe.usd },
        usdDip: { ay: usdDip.ay, usd: usdDip.usd },
        reelTepe: { ay: reelTepe.ay, reel: reelTepe.reel },
        reelDip: { ay: reelDip.ay, reel: reelDip.reel },

        bantAy: bant.length, bantIci: bantIci,
        tepe2018: { ay: tepe2018.ay, deger: tepe2018.yillik },
        donemBas: { ay: donemBas.ay, reel: donemBas.reel, usd: donemBas.usd },
        donemErime: 1 - asgariSon.reel / donemBas.reel,

        aylikTepe: { ay: aylikTepe.ay, deger: T.aylar[aylikTepe.ay].aylik },
        ocakOrt: ortalama(ocaklar, function (n) { return T.aylar[n.ay].aylik; }),
        digerOrt: ortalama(digerAylar, function (n) { return T.aylar[n.ay].aylik; }),
        aylikUstu5: fiyat.filter(function (n) { return T.aylar[n.ay].aylik >= 5; }).length,
        aylikUstu5Liste: fiyat.filter(function (n) { return T.aylar[n.ay].aylik >= 5; }).map(function (n) { return n.ay; }),

        birikimAy: birSon ? birSon.ay : null,
        altinKat: birSon ? birSon.altin / 100 : null,
        dolarKatB: birSon ? birSon.dolar / 100 : null,
        euroKat: birSon ? birSon.euro / 100 : null,
        fiyatKatB: birSon ? birSon.fiyat / 100 : null,
        gramSon: birSon ? birSon.gram : null,
        gramIlk: bir.length ? bir[0].gram : null,
        onsSon: birSon ? birSon.usdOns : null,

        vergiIlk: vergi[0], vergiSon: vergi[vergi.length - 1],

        bisEnfAy: dunyaAy && dunyaAy.enfAy, bisTurEnf: turEnf, bisEnfOrtanca: dunyaAy && dunyaAy.enfOrtanca,
        bisEnfBirinci: dunyaAy && dunyaAy.enf[0], bisAlanSayisi: dunyaAy && dunyaAy.enf.length,
        bisReelAy: dunyaAy && dunyaAy.reelAy, bisTurReel: turReel, bisReelBirinci: dunyaAy && dunyaAy.reel[0],
        bisReelSon: dunyaAy && dunyaAy.reel[dunyaAy.reel.length - 1], bisReelSayisi: dunyaAy && dunyaAy.reel.length,
        bisEskiyen: dunyaAy && dunyaAy.eskiyen,

        kisiBasiSon: makro && makro.kisiBasi[makro.kisiBasi.length - 1],
        kisiBasiTepe: makro && makro.kisiBasi.reduce(function (a, b) { return b.tur > a.tur ? b : a; }),
        kisiBasiSira: makro && makro.kisiBasiSira.liste.filter(function (x) { return x.kod === "TUR"; })[0],
        kisiBasiSiraYil: makro && makro.kisiBasiSira.yil,
        buyumeOrt: makro && ortalama(makro.buyume, function (n) { return n.tur; }),
        buyumeIlkYil: makro && makro.buyume[0].yil, buyumeSonYil: makro && makro.buyume[makro.buyume.length - 1].yil,
        buyumeDip: makro && makro.buyume.reduce(function (a, b) { return b.tur < a.tur ? b : a; }),
        buyumeTepe: makro && makro.buyume.reduce(function (a, b) { return b.tur > a.tur ? b : a; }),
        issizlikSon: makro && makro.issizlik[makro.issizlik.length - 1],
        cariSon: makro && makro.cari[makro.cari.length - 1],
        cariAcikYil: makro && makro.cari.filter(function (n) { return n.tur < 0; }).length,
        cariFazlaYillari: makro && makro.cari.filter(function (n) { return n.tur >= 0; }).map(function (n) { return n.yil; }),
        daralmaYillari: makro && makro.buyume.filter(function (n) { return n.tur < 0; }).map(function (n) { return n.yil; }),
        cariYil: makro && makro.cari.length,

        dunyaYil: siralama.yil,
        turSira: tur.sira, turDeger: tur.deger,
        ulkeSayisi: siralama.liste.length,
        ortanca: siralama.ortanca,
        birinci: siralama.liste[0]
      }
    };
  }

  return {
    hesapla: hesapla,
    zamanMakinesi: zamanMakinesi,
    isiHaritasi: isiHaritasi,
    birikim: birikim,
    vergiEsikleri: vergiEsikleri,
    dunyaAylik: dunyaAylik,
    GRAM_ONS: GRAM_ONS,
    ayAdi: ayAdi,
    aySayisi: aySayisi,
    fiyatEndeksi: fiyatEndeksi,
    ikiyeKatlanmalar: ikiyeKatlanmalar,
    faizAylik: faizAylik,
    kurSerisi: kurSerisi,
    asgariSerisi: asgariSerisi,
    dunyaSiralama: dunyaSiralama
  };
});
