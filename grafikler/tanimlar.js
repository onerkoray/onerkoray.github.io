/*!
 * Grafikler sayfasının grafik tanımları: hangi seri, hangi ölçek, hangi not.
 *
 * tools/grafikler-sayfa.js bunları 1000 px genişlikte statik SVG olarak
 * sayfaya yazar; grafikler/grafikler.js tarayıcıda ekran genişliğinde ve
 * okurun seçtiği seçenekle (log/doğrusal, dolar/TL) yeniden çizer.
 * Eksen aralıkları veriden türer: seri uzadıkça grafik kendiliğinden genişler.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory(root.GrafikCizim);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GrafikTanim = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Cizim) {
  "use strict";
  if (!Cizim && typeof require === "function") Cizim = require("./cizim.js");
  var sayi = Cizim.sayi, ayEtiket = Cizim.ayEtiket;

  function yukariYuvarla(v, adim) { return Math.ceil(v / adim) * adim; }
  function asagiYuvarla(v, adim) { return Math.floor(v / adim) * adim; }
  function adimlar(min, max, adim) { var a = []; for (var v = min; v <= max + 1e-9; v += adim) a.push(v); return a; }
  function ikininKuvvetleri(ust) { var a = []; for (var v = 100; v <= ust; v *= 2) a.push(v); return a; }
  /* Türkçe yazımda eksi işareti yüzdenin önüne gelir: −%20. */
  function yuzde(v) { return v < 0 ? "−%" + sayi(-v) : "%" + sayi(v); }
  function enBuyuk(a, f) { return Math.max.apply(null, a.map(f)); }
  function enKucuk(a, f) { return Math.min.apply(null, a.map(f)); }

  var TANIM = {
    /* I. Fiyat seviyesi, Aralık 2004 = 100 */
    fiyat: function (r, W, s) {
      var log = (s && s.olcek) !== "lin";
      var noktalar = [{ x: "2004-12", y: 100 }].concat(r.fiyat.map(function (n) { return { x: n.ay, y: n.endeks }; }));
      var son = r.fiyat[r.fiyat.length - 1];
      var ust = son.endeks;
      var y = log
        ? { tip: "log", min: 80, max: ust * 1.35, izgara: ikininKuvvetleri(ust * 1.2), bicim: function (v) { return sayi(v); } }
        : { tip: "lin", min: 0, max: yukariYuvarla(ust * 1.08, 1000), izgara: adimlar(0, yukariYuvarla(ust * 1.08, 1000), 1000), bicim: function (v) { return sayi(v); } };
      return {
        tur: "cizgi",
        id: "fiyat", genislik: W, yukseklik: (s && s.yukseklik) || (W < 560 ? 300 : 400),
        etiket: "Tüketici fiyat endeksi, Aralık 2004 = 100. " + ayEtiket(son.ay) + " itibarıyla " + sayi(son.endeks) + ".",
        baz: true,
        x: { tip: "ay", min: "2004-12", max: son.ay },
        y: y,
        seriler: [{ ad: "Fiyat endeksi", sinif: "gr-s-ana", alan: true, noktalar: noktalar }],
        isaretler: r.katlar.map(function (k) {
          return { x: k.ay, y: k.esik, metin: W < 560 ? "×2" : "×2 · " + k.sure + " ay" };
        }),
        notlar: [{ x: son.ay, y: son.endeks, metin: sayi(son.endeks), alt: ayEtiket(son.ay), hiza: "sag", sinif: "gr-not--son" }]
      };
    },

    /* II. Yıllık enflasyon */
    enflasyon: function (r, W) {
      var son = r.fiyat[r.fiyat.length - 1], tepe = r.ozet.tepeTufe;
      var ust = yukariYuvarla(enBuyuk(r.fiyat, function (n) { return n.yillik; }) * 1.08, 20);
      return {
        tur: "cizgi",
        id: "enflasyon", genislik: W, yukseklik: W < 560 ? 260 : 320,
        etiket: "Yıllık TÜFE, 2005–" + son.ay.slice(0, 4) + ". Tepe " + ayEtiket(tepe.ay) + " %" + sayi(tepe.deger, 2) + ".",
        x: { tip: "ay", min: "2005-01", max: son.ay },
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 20), bicim: yuzde },
        notBicim: function (v) { return "%" + sayi(v, 2); },
        seriler: [{ ad: "Yıllık TÜFE", sinif: "gr-s-ana", alan: true, noktalar: r.fiyat.map(function (n) { return { x: n.ay, y: n.yillik }; }) }],
        notlar: [
          { x: tepe.ay, y: tepe.deger, metin: "%" + sayi(tepe.deger, 2), alt: ayEtiket(tepe.ay), hiza: "sol" },
          { x: son.ay, y: son.yillik, metin: "%" + sayi(son.yillik, 2), alt: ayEtiket(son.ay), hiza: "sag", sinif: "gr-not--son" }
        ]
      };
    },

    /* III. Politika faizi ve enflasyon */
    faiz: function (r, W) {
      var f = r.faiz, son = f[f.length - 1];
      var ust = yukariYuvarla(Math.max(enBuyuk(f, function (n) { return n.tufe; }), enBuyuk(f, function (n) { return n.faiz; })) * 1.08, 20);
      return {
        tur: "cizgi",
        id: "faiz", genislik: W, yukseklik: W < 560 ? 260 : 320,
        etiket: "TCMB politika faizi ve yıllık TÜFE, " + ayEtiket(f[0].ay) + "–" + ayEtiket(son.ay) + ".",
        notBicim: function (v) { return "%" + sayi(v, 2); },
        x: { tip: "ay", min: f[0].ay, max: son.ay },
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 20), bicim: yuzde },
        seriler: [
          { ad: "Yıllık TÜFE", sinif: "gr-s-iki", noktalar: f.map(function (n) { return { x: n.ay, y: n.tufe }; }) },
          { ad: "Politika faizi", sinif: "gr-s-bir", adim: true, noktalar: f.map(function (n) { return { x: n.ay, y: n.faiz }; }) }
        ],
        notlar: [
          { x: son.ay, y: son.faiz, metin: "faiz %" + sayi(son.faiz, 2), hiza: "sag", dy: son.faiz > son.tufe ? -14 : 18, sinif: "gr-not--son gr-not--bir" },
          { x: son.ay, y: son.tufe, metin: "TÜFE %" + sayi(son.tufe, 2), hiza: "sag", dy: son.faiz > son.tufe ? 18 : -14, sinif: "gr-not--iki" }
        ]
      };
    },

    /* III-b. Reel politika faizi */
    reel: function (r, W) {
      var f = r.faiz;
      var alt = asagiYuvarla(enKucuk(f, function (n) { return n.reel; }) * 1.05, 10);
      var ust = yukariYuvarla(Math.max(10, enBuyuk(f, function (n) { return n.reel; }) * 1.2), 10);
      return {
        tur: "cubukAyrisan",
        id: "reel", genislik: W, yukseklik: W < 560 ? 220 : 260,
        etiket: "Reel politika faizi, " + ayEtiket(f[0].ay) + "–" + ayEtiket(f[f.length - 1].ay) + ": " +
          r.ozet.negatifAy + " ayda negatif.",
        x: { min: f[0].ay, max: f[f.length - 1].ay },
        y: { min: alt, max: ust, izgara: adimlar(alt, ust, 10).filter(function (v) { return v % 20 === 0; }), bicim: yuzde },
        noktalar: f.map(function (n) { return { x: n.ay, y: n.reel }; })
      };
    },

    /* IV. Dolar ve fiyatlar, Ocak 2005 = 100 */
    kur: function (r, W) {
      var k = r.kur, son = k[k.length - 1];
      var ust = Math.max(son.usdEndeks, son.tufeEndeks, enBuyuk(k, function (n) { return n.usdEndeks; }));
      var dolarUstte = son.usdEndeks > son.tufeEndeks;
      return {
        tur: "cizgi",
        id: "kur", genislik: W, yukseklik: W < 560 ? 300 : 380,
        etiket: "Dolar kuru ve tüketici fiyatları, Ocak 2005 = 100, logaritmik ölçek.",
        baz: true,
        x: { tip: "ay", min: k[0].ay, max: son.ay },
        y: { tip: "log", min: 60, max: ust * 1.4, izgara: ikininKuvvetleri(ust * 1.2), bicim: function (v) { return sayi(v); } },
        seriler: [
          { ad: "Fiyatlar (TÜFE)", sinif: "gr-s-bir", noktalar: k.map(function (n) { return { x: n.ay, y: n.tufeEndeks }; }) },
          { ad: "Dolar kuru", sinif: "gr-s-iki", noktalar: k.map(function (n) { return { x: n.ay, y: n.usdEndeks }; }) }
        ],
        notlar: [
          { x: son.ay, y: son.tufeEndeks, metin: "fiyatlar ×" + sayi(son.tufeEndeks / 100, 1), hiza: "sag",
            dy: dolarUstte ? 18 : -14, sinif: "gr-not--bir" },
          { x: son.ay, y: son.usdEndeks, metin: "dolar ×" + sayi(son.usdEndeks / 100, 1), hiza: "sag",
            dy: dolarUstte ? -14 : 18, sinif: "gr-not--son gr-not--iki" }
        ]
      };
    },

    /* IV-b. Reel dolar: dolar endeksi / fiyat endeksi */
    reelKur: function (r, W) {
      var k = r.kur;
      var n = k.map(function (x) { return { x: x.ay, y: 100 * x.usdEndeks / x.tufeEndeks }; });
      var mn = n.reduce(function (a, b) { return b.y < a.y ? b : a; });
      var mx = n.reduce(function (a, b) { return b.y > a.y ? b : a; });
      var son = n[n.length - 1];
      var ust = yukariYuvarla(mx.y * 1.1, 50), alt = asagiYuvarla(mn.y * 0.85, 50);
      return {
        tur: "cizgi",
        id: "reelKur", genislik: W, yukseklik: W < 560 ? 240 : 280,
        etiket: "Fiyatlara göre dolar, Ocak 2005 = 100. En düşük " + ayEtiket(mn.x) + ", en yüksek " + ayEtiket(mx.x) + ".",
        baz: true, notBicim: function (v) { return sayi(v, 1); },
        x: { tip: "ay", min: k[0].ay, max: k[k.length - 1].ay },
        y: { tip: "lin", min: alt, max: ust, izgara: adimlar(alt, ust, 50), bicim: function (v) { return sayi(v); } },
        seriler: [{ ad: "Reel dolar", sinif: "gr-s-iki", noktalar: n }],
        notlar: [
          { x: mn.x, y: mn.y, metin: sayi(mn.y, 1), alt: ayEtiket(mn.x), hiza: "sol" },
          { x: mx.x, y: mx.y, metin: sayi(mx.y, 1), alt: ayEtiket(mx.x), hiza: "sag" },
          { x: son.x, y: son.y, metin: sayi(son.y, 1), alt: ayEtiket(son.x), hiza: "sag", dy: 22, sinif: "gr-not--son" }
        ],
        referans: 100
      };
    },

    /* V. Net asgari ücret: dolar ya da bugünün TL'si */
    asgari: function (r, W, s) {
      var tl = (s && s.birim) === "tl", a = r.asgari, son = a[a.length - 1];
      var alan = tl ? "reel" : "usd";
      var tepe = a.reduce(function (p, c) { return c[alan] > p[alan] ? c : p; });
      var dip = a.reduce(function (p, c) { return c[alan] < p[alan] ? c : p; });
      var ust = tl ? yukariYuvarla(tepe.reel * 1.12, 10000) : yukariYuvarla(tepe.usd * 1.12, 100);
      var bicim = tl ? function (v) { return sayi(v / 1000) + "b"; } : function (v) { return "$" + sayi(v); };
      var yaz = tl ? function (v) { return sayi(v) + " TL"; } : function (v) { return "$" + sayi(v); };
      return {
        tur: "cizgi",
        id: "asgari", genislik: W, yukseklik: W < 560 ? 260 : 320,
        etiket: "Net asgari ücret, " + (tl ? ayEtiket(son.ay) + " fiyatlarıyla TL" : "dolar karşılığı") + ", " +
          ayEtiket(a[0].ay) + "–" + ayEtiket(son.ay) + ".",
        x: { tip: "ay", min: a[0].ay, max: son.ay },
        notBicim: yaz,
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, tl ? 10000 : 100), bicim: bicim },
        seriler: [{ ad: tl ? "Bugünün TL'si" : "Dolar", sinif: tl ? "gr-s-bir" : "gr-s-iki", adim: true, alan: true,
          noktalar: a.map(function (n) { return { x: n.ay, y: n[alan] }; }) }],
        notlar: [
          { x: tepe.ay, y: tepe[alan], metin: yaz(tepe[alan]), alt: ayEtiket(tepe.ay), hiza: "sag" },
          { x: dip.ay, y: dip[alan], metin: yaz(dip[alan]), alt: ayEtiket(dip.ay), hiza: "sol" },
          { x: son.ay, y: son[alan], metin: yaz(son[alan]), alt: ayEtiket(son.ay), hiza: "sag", dy: 22, sinif: "gr-not--son" }
        ].filter(function (n, i, dizi) {       // aynı ay iki kez not almasın
          return dizi.map(function (m) { return m.x; }).indexOf(n.x) === i || n.sinif;
        })
      };
    },

    /* II-b. Aylık TÜFE ısı haritası */
    isi: function (r, W) {
      return {
        tur: "isi", id: "isi", genislik: W,
        etiket: "Aylık TÜFE değişimi, yıl ve ay, 2005–" + r.sonAy.slice(0, 4) + ". En yüksek ay " +
          ayEtiket(r.ozet.aylikTepe.ay) + " %" + sayi(r.ozet.aylikTepe.deger, 2) + ".",
        satirlar: r.isi.map(function (s) { return { yil: s.yil, aylar: s.aylar }; }),
        esikler: [1, 2, 3, 5, 8]
      };
    },

    /* IV-c. 2005'te 100 TL: dolar, euro, altın, fiyatlar */
    birikim: function (r, W) {
      var b = r.birikim, son = b[b.length - 1];
      var ust = Math.max(son.altin, son.dolar, son.fiyat, son.euro);
      return {
        tur: "cizgi", id: "birikim", genislik: W, yukseklik: W < 560 ? 300 : 380,
        etiket: "Ocak 2005'te 100 TL: altın, dolar, euro ve fiyatlar, logaritmik. " + ayEtiket(son.ay) +
          " itibarıyla altın ×" + sayi(son.altin / 100, 1) + ".",
        baz: true,
        x: { tip: "ay", min: b[0].ay, max: son.ay },
        y: { tip: "log", min: 60, max: ust * 1.5, izgara: ikininKuvvetleri(ust * 1.3), bicim: function (v) { return sayi(v); } },
        seriler: [
          { ad: "Euro", sinif: "gr-s-soluk", noktalar: b.map(function (n) { return { x: n.ay, y: n.euro }; }) },
          { ad: "Fiyatlar", sinif: "gr-s-bir", noktalar: b.map(function (n) { return { x: n.ay, y: n.fiyat }; }) },
          { ad: "Dolar", sinif: "gr-s-iki", noktalar: b.map(function (n) { return { x: n.ay, y: n.dolar }; }) },
          { ad: "Altın", sinif: "gr-s-uc gr-s-kalin", noktalar: b.map(function (n) { return { x: n.ay, y: n.altin }; }) }
        ],
        notlar: [
          { x: son.ay, y: son.altin, metin: "altın ×" + sayi(son.altin / 100, 1), hiza: "sag", dy: -14, sinif: "gr-not--son gr-not--uc" },
          { x: son.ay, y: son.fiyat, metin: "fiyatlar ×" + sayi(son.fiyat / 100, 1), hiza: "sag", dy: 20, sinif: "gr-not--bir" }
        ]
      };
    },

    /* V-b. Vergi eşikleri, yıllık asgari ücretin katı */
    vergi: function (r, W) {
      var v = r.vergi, son = v[v.length - 1], ilk = v[0];
      var ust = yukariYuvarla(enBuyuk(v, function (n) { return n.ucuncuKat; }) * 1.12, 1);
      return {
        tur: "cizgi", id: "vergi", genislik: W, yukseklik: W < 560 ? 240 : 280,
        etiket: "İkinci ve üçüncü gelir vergisi eşiği, yıllık asgari ücretin katı, " + ilk.yil + "–" + son.yil + ".",
        x: { tip: "yil", min: ilk.yil, max: son.yil },
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 1), bicim: function (x) { return sayi(x) + "×"; } },
        referans: 1,
        seriler: [
          { ad: "Üçüncü eşik", sinif: "gr-s-bir", noktalar: v.map(function (n) { return { x: n.yil, y: n.ucuncuKat }; }) },
          { ad: "İkinci eşik", sinif: "gr-s-iki gr-s-kalin", noktalar: v.map(function (n) { return { x: n.yil, y: n.ikinciKat }; }) }
        ],
        notlar: [
          { x: ilk.yil, y: ilk.ikinciKat, metin: sayi(ilk.ikinciKat, 2) + "×", hiza: "sol", dy: -12, sinif: "gr-not--iki" },
          { x: son.yil, y: son.ikinciKat, metin: sayi(son.ikinciKat, 2) + "×", alt: "ikinci eşik", hiza: "sag", dy: -14, sinif: "gr-not--son gr-not--iki" },
          { x: ilk.yil, y: ilk.ucuncuKat, metin: sayi(ilk.ucuncuKat, 2) + "×", hiza: "sol", dy: -12, sinif: "gr-not--bir" },
          { x: son.yil, y: son.ucuncuKat, metin: sayi(son.ucuncuKat, 2) + "×", alt: "üçüncü eşik", hiza: "sag", dy: -14, sinif: "gr-not--bir" }
        ]
      };
    },

    /* VI. G20'de aylık enflasyon, sıralı (BIS) */
    dunyaEnf: function (r, W) {
      var d = r.dunyaAy;
      var ust = yukariYuvarla(d.enf[0].deger * 1.18, 10);
      return {
        tur: "siraCubuk", id: "dunyaEnf", genislik: W,
        etiket: ayEtiket(d.enfAy) + " yıllık enflasyon, " + d.enf.length + " ekonomi. Türkiye " +
          r.ozet.bisTurEnf.sira + ". sırada, %" + sayi(r.ozet.bisTurEnf.deger, 1) + ".",
        liste: d.enf.map(function (u) { return { ad: u.ad, deger: u.deger, vurgu: u.kod === "TR" }; }),
        x: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 10) },
        ortanca: d.enfOrtanca
      };
    },

    /* VI-b. Reel politika faizi, sıralı (BIS) */
    dunyaReel: function (r, W) {
      var d = r.dunyaAy;
      var alt = asagiYuvarla(Math.min(0, d.reel[d.reel.length - 1].deger) - 1, 2);
      var ust = yukariYuvarla(d.reel[0].deger * 1.2, 2);
      return {
        tur: "siraCubuk", id: "dunyaReel", genislik: W,
        etiket: ayEtiket(d.reelAy) + " reel politika faizi, " + d.reel.length + " ekonomi. Türkiye " +
          r.ozet.bisTurReel.sira + ". sırada, %" + sayi(r.ozet.bisTurReel.deger, 1) + ".",
        liste: d.reel.map(function (u) { return { ad: u.ad, deger: u.deger, vurgu: u.kod === "TR" }; }),
        x: { tip: "lin", min: alt, max: ust, izgara: adimlar(alt, ust, 2).filter(function (v) { return v % 4 === 0; }), bicim: yuzde }
      };
    },

    /* VI-c. Yirmi bir yıl, aylık: Türkiye ve dört ekonomi (BIS) */
    dunyaSeri: function (r, W, s) {
      var secili = s && s.ulkeler;      // [{ kod, yuva }] — yuva rengi belirler, ülke seçili kaldıkça değişmez
      var seriler = secili
        ? [r.dunyaAy.seriler[0]].concat(secili.map(function (u) { var x = r.ulkeSerisi(u.kod); x.yuva = u.yuva; return x; }))
        : r.dunyaAy.seriler;
      var tum = [];
      seriler.forEach(function (s) { s.nokta.forEach(function (n) { if (n.deger != null) tum.push(n); }); });
      var ust = yukariYuvarla(enBuyuk(tum, function (n) { return n.deger; }) * 1.08, 20);
      var son = seriler[0].nokta.filter(function (n) { return n.deger != null; });
      var turSon = son[son.length - 1];
      return {
        tur: "cizgi", id: "dunyaSeri", genislik: W, yukseklik: W < 560 ? 280 : 340,
        etiket: "Yıllık enflasyon, aylık, 2005–" + turSon.ay.slice(0, 4) + ": " +
          seriler.map(function (x) { return x.ad; }).join(", ") + ".",
        notBicim: function (v) { return "%" + sayi(v, 1); },
        x: { tip: "ay", min: seriler[0].nokta[0].ay, max: seriler[0].nokta[seriler[0].nokta.length - 1].ay },
        y: { tip: "lin", min: -10, max: ust, izgara: adimlar(0, ust, 20), bicim: yuzde },
        sifir: true,
        seriler: seriler.slice(1).map(function (s) {
          return { ad: s.ad, kod: s.kod, sinif: s.yuva == null ? "gr-s-soluk" : YUVA[s.yuva],
            noktalar: s.nokta.map(function (n) { return { x: n.ay, y: n.deger }; }) };
        }).concat([{ ad: seriler[0].ad, kod: "TR", sinif: "gr-s-iki gr-s-kalin",
          noktalar: seriler[0].nokta.map(function (n) { return { x: n.ay, y: n.deger }; }) }]),
        notlar: [{ x: turSon.ay, y: turSon.deger, metin: "Türkiye %" + sayi(turSon.deger, 1), alt: ayEtiket(turSon.ay), hiza: "sag", dy: -26, sinif: "gr-not--son" }]
      };
    },

    /* VII. Kişi başı gelir, cari $ */
    kisiBasi: function (r, W) {
      var m = r.makro.kisiBasi, son = m[m.length - 1];
      var ust = yukariYuvarla(Math.max(enBuyuk(m, function (n) { return n.tur; }),
        enBuyuk(m, function (n) { return n.ortanca || 0; })) * 1.12, 10000);
      return {
        tur: "cizgi", id: "kisiBasi", genislik: W, yukseklik: W < 560 ? 240 : 280,
        etiket: "Kişi başı GSYH, cari dolar, " + m[0].yil + "–" + son.yil + ": Türkiye ve G20 ortancası.",
        x: { tip: "yil", min: m[0].yil, max: son.yil },
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 10000), bicim: function (v) { return "$" + sayi(v / 1000) + "b"; } },
        seriler: [
          { ad: "G20 ortancası", sinif: "gr-s-soluk", noktalar: m.map(function (n) { return { x: n.yil, y: n.ortanca }; }) },
          { ad: "Türkiye", sinif: "gr-s-iki gr-s-kalin", noktalar: m.map(function (n) { return { x: n.yil, y: n.tur }; }) }
        ],
        notlar: [{ x: son.yil, y: son.tur, metin: "$" + sayi(son.tur), alt: String(son.yil), hiza: "sag", dy: -18, sinif: "gr-not--son" }]
      };
    },

    /* VII-b. Reel büyüme */
    buyume: function (r, W) {
      var m = r.makro.buyume;
      var alt = asagiYuvarla(enKucuk(m, function (n) { return n.tur; }) - 1, 4);
      var ust = yukariYuvarla(enBuyuk(m, function (n) { return n.tur; }) + 1, 4);
      return {
        tur: "cubukAyrisan", id: "buyume", genislik: W, yukseklik: W < 560 ? 220 : 260,
        etiket: "Reel GSYH büyümesi, Türkiye, " + m[0].yil + "–" + m[m.length - 1].yil + ".",
        x: { tip: "yil", min: m[0].yil, max: m[m.length - 1].yil },
        y: { min: alt, max: ust, izgara: adimlar(alt, ust, 4), bicim: yuzde },
        noktalar: m.map(function (n) { return { x: n.yil, y: n.tur }; })
      };
    },

    /* VII-c. İşsizlik */
    issizlik: function (r, W) {
      var m = r.makro.issizlik, son = m[m.length - 1];
      var ust = yukariYuvarla(enBuyuk(m, function (n) { return n.tur; }) * 1.15, 4);
      return {
        tur: "cizgi", id: "issizlik", genislik: W, yukseklik: W < 560 ? 240 : 280,
        etiket: "İşsizlik oranı (ILO modeli), Türkiye ve G20 ortancası, " + m[0].yil + "–" + son.yil + ".",
        x: { tip: "yil", min: m[0].yil, max: son.yil },
        y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 4), bicim: yuzde },
        seriler: [
          { ad: "G20 ortancası", sinif: "gr-s-soluk", noktalar: m.map(function (n) { return { x: n.yil, y: n.ortanca }; }) },
          { ad: "Türkiye", sinif: "gr-s-iki gr-s-kalin", noktalar: m.map(function (n) { return { x: n.yil, y: n.tur }; }) }
        ],
        notlar: [{ x: son.yil, y: son.tur, metin: "%" + sayi(son.tur, 1), alt: String(son.yil), hiza: "sag", dy: -20, sinif: "gr-not--son" }]
      };
    },

    /* VII-d. Cari denge */
    cari: function (r, W) {
      var m = r.makro.cari;
      var alt = asagiYuvarla(enKucuk(m, function (n) { return n.tur; }) - 1, 2);
      var ust = yukariYuvarla(Math.max(2, enBuyuk(m, function (n) { return n.tur; }) + 1), 2);
      return {
        tur: "cubukAyrisan", id: "cari", genislik: W, yukseklik: W < 560 ? 220 : 260,
        etiket: "Cari işlemler dengesi, GSYH'nin yüzdesi, Türkiye, " + m[0].yil + "–" + m[m.length - 1].yil + ".",
        x: { tip: "yil", min: m[0].yil, max: m[m.length - 1].yil },
        y: { min: alt, max: ust, izgara: adimlar(alt, ust, 2).filter(function (v) { return v % 4 === 0; }), bicim: yuzde },
        noktalar: m.map(function (n) { return { x: n.yil, y: n.tur }; })
      };
    }
  };

  /* VIII. En düşük emekli aylığı: bugünün TL'si ve net asgari ücrete oranı. */
  TANIM.taban = function (r, W) {
    var e = r.emekli, o = r.emekliOzet, son = o.son;
    var ust = yukariYuvarla(o.reelTepe.reel * 1.12, 5000);
    function yaz(v) { return sayi(v) + " TL"; }
    return {
      tur: "cizgi", id: "taban", genislik: W, yukseklik: W < 560 ? 240 : 280,
      etiket: "En düşük emekli aylığı, " + ayEtiket(son.ay) + " fiyatlarıyla TL, " + ayEtiket(e[0].ay) + "–" + ayEtiket(son.ay) + ".",
      x: { tip: "ay", min: e[0].ay, max: son.ay },
      notBicim: yaz,
      y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 5000), bicim: function (v) { return sayi(v / 1000) + "b"; } },
      seriler: [{ ad: "Bugünün TL'si", sinif: "gr-s-bir", alan: true, noktalar: e.map(function (n) { return { x: n.ay, y: n.reel }; }) }],
      notlar: [
        { x: o.reelDip.ay, y: o.reelDip.reel, metin: yaz(o.reelDip.reel), alt: ayEtiket(o.reelDip.ay), hiza: "sol", dy: 22 },
        { x: o.reelTepe.ay, y: o.reelTepe.reel, metin: yaz(o.reelTepe.reel), alt: ayEtiket(o.reelTepe.ay), hiza: "sag", dy: -14 },
        { x: son.ay, y: son.reel, metin: yaz(son.reel), alt: ayEtiket(son.ay), hiza: "sag", dy: 26, sinif: "gr-not--son" }
      ]
    };
  };
  TANIM.tabanOran = function (r, W) {
    var e = r.emekli, o = r.emekliOzet, son = o.son;
    var ust = yukariYuvarla(Math.max(100, o.oranTepe.oran) * 1.08, 20);
    function yaz(v) { return "%" + sayi(v, 1); }
    return {
      tur: "cizgi", id: "tabanOran", genislik: W, yukseklik: W < 560 ? 240 : 280,
      etiket: "En düşük emekli aylığının net asgari ücrete oranı, " + ayEtiket(e[0].ay) + "–" + ayEtiket(son.ay) +
        ": %" + sayi(o.ilk.oran, 1) + " ile başladı, bugün %" + sayi(son.oran, 1) + ".",
      x: { tip: "ay", min: e[0].ay, max: son.ay },
      notBicim: yaz,
      y: { tip: "lin", min: 0, max: ust, izgara: adimlar(0, ust, 20), bicim: yuzde },
      referans: 100,
      seriler: [{ ad: "Taban ÷ net asgari ücret", sinif: "gr-s-iki", adim: true, noktalar: e.map(function (n) { return { x: n.ay, y: n.oran }; }) }],
      notlar: [
        { x: o.ilk.ay, y: o.ilk.oran, metin: yaz(o.ilk.oran), alt: ayEtiket(o.ilk.ay), hiza: "sol", dy: -14 },
        { x: o.oranTepe.ay, y: o.oranTepe.oran, metin: yaz(o.oranTepe.oran), alt: ayEtiket(o.oranTepe.ay), hiza: "sag", dy: -14 },
        { x: son.ay, y: son.oran, metin: yaz(son.oran), alt: ayEtiket(son.ay), hiza: "sag", dy: 26, sinif: "gr-not--son" }
      ].filter(function (n, i, dizi) { return dizi.map(function (m) { return m.x; }).indexOf(n.x) === i || n.sinif; })
    };
  };

  /* Okurun seçtiği karşılaştırma ülkelerinin çizgi sınıfı: yuva sırası.
     Renk iki ton, ikinci kodlama çizgi biçimi (düz / kesik). */
  var YUVA = ["gr-s-bir", "gr-s-uc", "gr-s-bir gr-s-kesik", "gr-s-uc gr-s-kesik"];

  /* ---- dönem: aylık grafiği "bas" ayından itibaren göster -------------------
     Statik sayfa (üreteç) bunu çağırmaz; yalnız tarayıcıda, okur dönem seçince.
     Eksen, ızgara ve notlar görünen aralıktan yeniden kurulur. "baz" taşıyan
     endeks grafiklerinde her seri dönem başında 100'e çekilir: "son beş yılda
     kaç kat" sorusu grafikten okunur. Çarpanlar t.carpan'da durur. */
  function guzelAdim(aralik, hedef) {
    var ham = aralik / hedef, us = Math.pow(10, Math.floor(Math.log(ham) / Math.LN10)), k = ham / us;
    return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * us;
  }
  function logIzgara(alt, ust) {
    var a = [], us = Math.pow(10, Math.floor(Math.log(alt) / Math.LN10));
    for (; us <= ust; us *= 10) [1, 2, 5].forEach(function (k) { var v = k * us; if (v >= alt && v <= ust) a.push(v); });
    if (a.length >= 3) return a;
    var adim = guzelAdim(ust - alt, 4), b = [];
    for (var v = Math.ceil(alt / adim) * adim; v <= ust; v += adim) b.push(v);
    return b;
  }
  function donemUygula(t, bas, zorla) {
    if (!bas) return t;
    if (t.tur === "isi") {
      t.satirlar = t.satirlar.filter(function (s) { return s.yil >= +bas.slice(0, 4); });
      t.donem = bas;
      return t;
    }
    if (!t.x || t.x.tip === "yil" || t.tur === "siraCubuk" || (bas <= t.x.min && !zorla)) return t;
    if (bas > t.x.min) { t.x.min = bas; t.donem = bas; } else bas = t.x.min;
    var son = " Gösterilen dönem: " + ayEtiket(bas) + "–" + ayEtiket(t.x.max);
    if (t.tur === "cubukAyrisan") {
      t.noktalar = t.noktalar.filter(function (n) { return n.x >= bas; });
      var lo = Math.min(0, enKucuk(t.noktalar, function (n) { return n.y; })), hi = Math.max(0, enBuyuk(t.noktalar, function (n) { return n.y; }));
      var ad = guzelAdim((hi - lo) || 1, 4);
      t.y.min = Math.floor(lo / ad) * ad; t.y.max = Math.ceil(hi / ad) * ad || ad;
      t.y.izgara = adimlar(t.y.min, t.y.max, ad);
      t.etiket += son + ".";
      return t;
    }
    var hepsi = [];
    var baz = t.baz && !!t.donem;
    t.carpan = t.seriler.map(function (s) {
      s.noktalar = s.noktalar.filter(function (n) { return n.x >= bas; });
      var c = 1;
      if (baz) {
        var ilk = s.noktalar.filter(function (n) { return n.y != null; })[0];
        c = ilk ? 100 / ilk.y : 1;
        s.noktalar = s.noktalar.map(function (n) { return { x: n.x, y: n.y == null ? null : n.y * c }; });
      }
      s.noktalar.forEach(function (n) { if (n.y != null) hepsi.push(n.y); });
      return c;
    });
    var enAz = Math.min.apply(null, hepsi), enCok = Math.max.apply(null, hepsi);
    if (t.y.tip === "log") {
      t.y.min = enAz * 0.9; t.y.max = enCok * 1.25;
      t.y.izgara = logIzgara(t.y.min, t.y.max);
    } else {
      var sifirdan = t.y.min === 0 && enAz >= 0;
      var alt0 = sifirdan ? 0 : enAz, adim = guzelAdim((enCok - alt0) * 1.1 || 1, 5);
      t.y.min = sifirdan ? 0 : Math.floor(enAz / adim) * adim;
      t.y.max = Math.ceil(enCok * 1.04 / adim) * adim;
      if (t.y.max <= enCok) t.y.max += adim;
      t.y.izgara = adimlar(t.y.min, t.y.max, adim);
      /* Az eksi (ör. bir ayda −%1 enflasyon) ekseni bir tam adım aşağı itmesin:
         alt sınır adımın beşte biriyle yuvarlanır, ızgara sıfırdan başlar. */
      if (enAz < 0 && enAz > -adim && enCok > 0) {
        var ince = adim / 5;
        t.y.min = Math.floor(enAz / ince) * ince;
        t.y.izgara = adimlar(0, t.y.max, adim);
      }
    }
    if (t.referans != null && (t.referans < t.y.min || t.referans > t.y.max)) t.referans = null;
    t.isaretler = [];
    t.bantlar = [];
    /* Notlar: her (soluk olmayan) serinin son değeri; tek seride tepe de. */
    var bicim = t.notBicim || t.y.bicim || function (v) { return sayi(v); };
    var H = t.yukseklik, ust = 18, altK = H - 30;
    function py(v) {
      return t.y.tip === "log"
        ? altK - (Math.log(v) - Math.log(t.y.min)) / (Math.log(t.y.max) - Math.log(t.y.min)) * (altK - ust)
        : altK - (v - t.y.min) / (t.y.max - t.y.min) * (altK - ust);
    }
    var cok = t.seriler.length > 1, notlar = [];
    t.seriler.forEach(function (s) {
      var dolu = s.noktalar.filter(function (n) { return n.y != null; });
      if (!dolu.length || /gr-s-soluk/.test(s.sinif)) return;
      var n = dolu[dolu.length - 1];
      var renk = /gr-s-iki/.test(s.sinif) ? " gr-not--iki" : /gr-s-uc/.test(s.sinif) ? " gr-not--uc" : /gr-s-bir/.test(s.sinif) ? " gr-not--bir" : "";
      var deger = baz ? "×" + sayi(n.y / 100, 2) : bicim(n.y);
      var sonSeri = s === t.seriler[t.seriler.length - 1];
      notlar.push({ x: n.x, y: n.y, metin: (cok ? s.ad + " " : "") + deger, hiza: "sag", sinif: (sonSeri ? "gr-not--son" : "") + renk, _py: py(n.y) });
      if (!cok) {
        var tepe = dolu.reduce(function (a, b) { return b.y > a.y ? b : a; });
        if (tepe.x !== n.x) notlar.push({ x: tepe.x, y: tepe.y, metin: baz ? "×" + sayi(tepe.y / 100, 2) : bicim(tepe.y), alt: ayEtiket(tepe.x),
          hiza: tepe.x > ayOrta(bas, t.x.max) ? "sag" : "sol", dy: -14, _tepe: true });
      }
    });
    /* Bitiş etiketleri üst üste binmesin: yukarıdan aşağı en az 15 px. */
    var bitis = notlar.filter(function (n) { return !n._tepe; }).sort(function (a, b) { return a._py - b._py; });
    var onceki = -1e9;
    bitis.forEach(function (n) {
      var hedef = Math.max(n._py - 12, onceki + 15);
      n.dy = hedef - n._py; onceki = hedef;
    });
    if (bitis.length === 1 && !cok) { bitis[0].alt = ayEtiket(bitis[0].x); bitis[0].dy = bitis[0]._py < ust + 40 ? 26 : -14; }
    t.notlar = notlar;
    if (t.donem) t.etiket += son + (baz ? "; dönem başı = 100." : ".");
    return t;
  }
  function ayOrta(a, b) {
    var i = (Cizim.ayIndeksi(a) + Cizim.ayIndeksi(b)) >> 1, y = Math.floor(i / 12), m = i - y * 12 + 1;
    return y + "-" + (m < 10 ? "0" : "") + m;
  }

  function ciz(ad, r, genislik, secenek) {
    var t = TANIM[ad](r, genislik, secenek || {});
    if (secenek && secenek.bas) t = donemUygula(t, secenek.bas, !!secenek.ulkeler);
    else if (secenek && secenek.ulkeler) t = donemUygula(t, t.x.min, true);   // seçilen ülkeler bitiş etiketi alsın
    var cikti = Cizim[t.tur](t);
    cikti.tanim = t;
    return cikti;
  }

  /* Zaman makinesi cümlesi: üreteç (varsayılan ay) ve tarayıcı (seçilen ay)
     aynı metni kurar. */
  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function ayUzun(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }
  function zamanMetni(z) {
    var m = "<strong>" + ayUzun(z.ay) + "</strong> sonunda 100 TL olan sepet, " + ayUzun(z.sonAy) +
      " sonunda <strong>" + sayi(z.sepet) + " TL</strong>: fiyatlar ×" + sayi(z.kat, 1) + ".";
    if (z.usdOnce) {
      m += " Aynı sürede dolar " + sayi(z.usdOnce, 2) + " TL'den " + sayi(z.usdSon, 2) + " TL'ye çıktı: ×" + sayi(z.usdKat, 1) + ".";
    }
    return m;
  }

  return { ciz: ciz, adlar: Object.keys(TANIM), zamanMetni: zamanMetni, ayUzun: ayUzun, YUVA: YUVA, donemUygula: donemUygula };
});
