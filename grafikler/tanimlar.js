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
        id: "fiyat", genislik: W, yukseklik: W < 560 ? 300 : 400,
        etiket: "Tüketici fiyat endeksi, Aralık 2004 = 100. " + ayEtiket(son.ay) + " itibarıyla " + sayi(son.endeks) + ".",
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

    /* VI. G20'de enflasyon, sıralı */
    dunya: function (r, W) {
      var s = r.siralama;
      return {
        tur: "siraCubuk",
        id: "dunya", genislik: W,
        etiket: s.yil + " yılında G20 ekonomilerinde enflasyon. Türkiye " + r.ozet.turSira + ". sırada, %" + sayi(r.ozet.turDeger, 1) + ".",
        liste: s.liste.map(function (u) { return { ad: u.ad, deger: u.deger, vurgu: u.kod === "TUR" }; }),
        x: { min: 0.1, max: yukariYuvarla(s.liste[0].deger * 1.6, 100), izgara: [0.1, 1, 10, 100] },
        ortanca: s.ortanca
      };
    },

    /* VI-b. Yirmi beş yıl: Türkiye ve beş ekonomi */
    dunyaSeri: function (r, W) {
      var seriler = r.dunya.filter(function (s) { return s.kod !== "ARG"; });
      var tum = [];
      seriler.forEach(function (s) { s.nokta.forEach(function (n) { tum.push(n); }); });
      var ust = yukariYuvarla(enBuyuk(tum, function (n) { return n.deger; }) * 1.08, 20);
      var yil0 = enKucuk(tum, function (n) { return n.yil; }), yil1 = enBuyuk(tum, function (n) { return n.yil; });
      return {
        tur: "cizgi",
        id: "dunyaSeri", genislik: W, yukseklik: W < 560 ? 280 : 340,
        etiket: "Yıllık enflasyon " + yil0 + "–" + yil1 + ": Türkiye, Brezilya, Rusya, ABD ve euro bölgesi.",
        x: { tip: "yil", min: yil0, max: yil1 },
        y: { tip: "lin", min: -10, max: ust, izgara: adimlar(0, ust, 20), bicim: yuzde },
        sifir: true,
        seriler: seriler.map(function (s) {
          return { ad: s.ad, kod: s.kod, sinif: s.kod === "TUR" ? "gr-s-iki gr-s-kalin" : "gr-s-soluk",
            noktalar: s.nokta.map(function (n) { return { x: n.yil, y: n.deger }; }) };
        }),
        notlar: seriler.filter(function (s) { return s.kod === "TUR"; }).map(function (s) {
          var n = s.nokta[s.nokta.length - 1];
          return { x: n.yil, y: n.deger, metin: "Türkiye %" + sayi(n.deger, 1), alt: String(n.yil), hiza: "sag", sinif: "gr-not--son" };
        })
      };
    }
  };

  function ciz(ad, r, genislik, secenek) {
    var t = TANIM[ad](r, genislik, secenek || {});
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

  return { ciz: ciz, adlar: Object.keys(TANIM), zamanMetni: zamanMetni, ayUzun: ayUzun };
});
