#!/usr/bin/env node
/*!
 * Ölçüm tercihi regresyonları.
 *
 * Ölçüm VARSAYILAN OLARAK AÇIK; site sahibinin kararı bu. Geriye üç söz
 * kalıyor ve üçü de sessizce bozulabilir:
 *   - GPC/DNT gönderen tarayıcı ölçülmez,
 *   - gizlilik sayfasından çıkış tek düğmedir ve çerezleri siler,
 *   - kapatıldıktan sonra ölçüm geri gelmez.
 * Üçü de bozulduğunda sayfa açılmaya devam eder, araçlar çalışır; fark
 * eden olmaz. Bu yüzden testle sabitleniyorlar.
 *
 * Node'da DOM yok; kapının dokunduğu yüzey küçük olduğu için sahte bir
 * belge yetiyor: createElement, head.appendChild, body.appendChild,
 * addEventListener ve document.cookie.
 */
"use strict";
var path = require("path");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek) {
  if (b !== bek) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, !!k, true); }

/* ------------------------------------------------------------ sahte ortam */

function sahteOrtam(secenek) {
  var o = secenek || {};
  var depoVar = o.depoVar !== false;
  var kutu = o.baslangic || {};
  var eklenen = [];
  var cerezler = o.cerezler || [];
  var govde = [];

  function eleman() {
    var e = {
      cocuklar: [], dinleyiciler: {}, metin: "", sinif: "", nitelik: {},
      appendChild: function (c) { e.cocuklar.push(c); return c; },
      setAttribute: function (a, v) { e.nitelik[a] = v; },
      addEventListener: function (t, f) { e.dinleyiciler[t] = f; },
      removeChild: function (c) {
        var i = e.cocuklar.indexOf(c);
        if (i >= 0) e.cocuklar.splice(i, 1);
      }
    };
    Object.defineProperty(e, "textContent", {
      get: function () { return e.metin; },
      set: function (v) { e.metin = v; }
    });
    Object.defineProperty(e, "className", {
      get: function () { return e.sinif; },
      set: function (v) { e.sinif = v; }
    });
    Object.defineProperty(e, "innerHTML", {
      get: function () { return e.ic || ""; },
      set: function (v) { e.ic = v; }
    });
    return e;
  }

  var head = eleman();
  var body = eleman();
  body.appendChild = function (c) { govde.push(c); c.parentNode = body; return c; };
  body.removeChild = function (c) {
    var i = govde.indexOf(c);
    if (i >= 0) govde.splice(i, 1);
  };
  head.appendChild = function (c) { eklenen.push(c.src); return c; };

  var belge = {
    readyState: "interactive",
    head: head, body: body,
    createElement: function () { return eleman(); },
    addEventListener: function () {}
  };
  Object.defineProperty(belge, "cookie", {
    get: function () { return cerezler.join("; "); },
    set: function (v) {
      var ad = v.split("=")[0].trim();
      if (/Max-Age=0/.test(v)) {
        cerezler = cerezler.filter(function (c) { return c.split("=")[0].trim() !== ad; });
      }
    }
  });

  var pencere = {
    location: { hostname: o.host || "korayoner.dev" },
    navigator: o.navigator || {},
    localStorage: depoVar ? {
      getItem: function (a) {
        return Object.prototype.hasOwnProperty.call(kutu, a) ? kutu[a] : null;
      },
      setItem: function (a, v) { kutu[a] = String(v); },
      removeItem: function (a) { delete kutu[a]; }
    } : null
  };
  if (!depoVar) {
    /* Gizli sekme: erisimin kendisi PATLAR, null donmez. */
    Object.defineProperty(pencere, "localStorage", {
      get: function () { throw new Error("depo kapali"); }
    });
  }

  return {
    pencere: pencere, belge: belge,
    eklenenBetikler: eklenen,
    govde: govde,
    kutu: kutu,
    cerezler: function () { return cerezler; }
  };
}

/* Modül her yüklendiğinde kapı yeniden kurulur; require önbelleği
   temizlenmezse ikinci senaryo birincinin durumunu miras alırdı. */
function kapiYukle(ortam) {
  var yol = path.join(__dirname, "..", "onay.js");
  delete require.cache[require.resolve(yol)];
  global.window = ortam.pencere;
  global.document = ortam.belge;
  require(yol);
  return ortam.pencere.Onay;
}

/* ------------------------------------------------------------------ */
console.log("VARSAYILAN: olcum ACIK, hicbir sey sorulmaz");
var o1 = sahteOrtam();
var K1 = kapiYukle(o1);
esit("durum kabul", K1.durum(), "kabul");
esit("secim yapilmadi", K1.secimYapildi(), false);
esit("serit YOK", o1.govde.length, 0);
esit("gtag yuklendi", o1.eklenenBetikler.length, 1);
dogru("gtag betigi", /googletagmanager\.com\/gtag\/js\?id=G-/.test(o1.eklenenBetikler[0]));
dogru("config cagrisi", (o1.pencere.dataLayer || []).some(function (a) {
  return a[0] === "config";
}));

console.log("\nTARAYICI RET DIYORSA OLCULMEZ");
/* GPC bazi yargi alanlarinda baglayici; DNT degil ama acikca ifade
   edilmis bir tercih. Ikisi de ziyaretcilerin cok kucuk bir azinligi --
   yani bu kurala uymanin olcum hacmine bedeli yok. */
var o2 = sahteOrtam({ navigator: { globalPrivacyControl: true } });
var K2 = kapiYukle(o2);
esit("GPC: durum ret", K2.durum(), "ret");
esit("GPC: betik YOK", o2.eklenenBetikler.length, 0);
esit("GPC: dataLayer yok", typeof o2.pencere.dataLayer, "undefined");

var o3 = sahteOrtam({ navigator: { doNotTrack: "1" } });
var K3 = kapiYukle(o3);
esit("DNT: durum ret", K3.durum(), "ret");
esit("DNT: betik YOK", o3.eklenenBetikler.length, 0);

/* ACIK kabul tarayici sinyalini yener: kullanicinin bu sitede verdigi
   karar daha sonraki ve daha ozgul bir beyandir. */
var o4 = sahteOrtam({
  navigator: { doNotTrack: "1" },
  baslangic: { "korayoner.olcum-onayi": "kabul" }
});
var K4 = kapiYukle(o4);
esit("acik kabul DNT'yi yener", K4.durum(), "kabul");
esit("acik kabulde olcum basliyor", o4.eklenenBetikler.length, 1);

console.log("\nCIKIS: kapatilinca olcum baslamaz ve KALICI olur");
var o5 = sahteOrtam({ baslangic: { "korayoner.olcum-onayi": "ret" } });
var K5 = kapiYukle(o5);
esit("ret durumu", K5.durum(), "ret");
esit("secim yapildi", K5.secimYapildi(), true);
esit("betik YOK", o5.eklenenBetikler.length, 0);

console.log("\nCIKIS CEREZLERI DE SILER");
/* Yalnizca "bir daha yukleme" demek, ORTADA DURAN veriyi birakmak olurdu. */
var o6 = sahteOrtam({
  cerezler: ["_ga=GA1.1.123", "_ga_ABC=GS1.1.9", "_gid=GA1.2.7", "tema=koyu"]
});
var K6 = kapiYukle(o6);
K6.ver(false);
esit("durum ret", K6.durum(), "ret");
esit("karar depoda", o6.kutu["korayoner.olcum-onayi"], "ret");
var kalan = o6.cerezler();
dogru("_ga silindi", !kalan.some(function (c) { return /^_ga=/.test(c); }));
dogru("_ga_ABC silindi", !kalan.some(function (c) { return /^_ga_ABC=/.test(c); }));
dogru("_gid silindi", !kalan.some(function (c) { return /^_gid=/.test(c); }));
dogru("ILGISIZ cerez korundu", kalan.some(function (c) { return /^tema=/.test(c); }));

console.log("\nDEPO YOKKEN (gizli sekme) SAYFA PATLAMAZ");
/* Depo erisimi gizli sekmede null donmez, ISTISNA ATAR. Tercih sorgusu
   patlarsa sayfa hic acilmaz. */
var o7 = sahteOrtam({ depoVar: false });
var K7 = null;
try { K7 = kapiYukle(o7); } catch (e) {
  hata++; console.error("  BASARISIZ  yuklenirken patladi: " + e.message);
}
if (K7) {
  esit("varsayilan yine calisti", K7.durum(), "kabul");
  /* Karar saklanamasa bile O OTURUMDA uygulanir; aksi halde "kapat"
     dugmesi hicbir sey yapmiyormus gibi gorunurdu. */
  K7.ver(false);
  esit("kapatma o oturumda gecerli", K7.durum(), "ret");
}

console.log("\nKarar duyurulur (live.js sehir tahminini buna bagliyor)");
var o8 = sahteOrtam();
var K8 = kapiYukle(o8);
var duyurulan = [];
K8.dinle(function (d) { duyurulan.push(d); });
K8.dinle(function () { throw new Error("bozuk dinleyici"); });
var sonDuyuru = [];
K8.dinle(function (d) { sonDuyuru.push(d); });
K8.ver(false);
esit("dinleyici cagrildi", duyurulan[0], "ret");
esit("bozuk dinleyici digerlerini engellemedi", sonDuyuru[0], "ret");

console.log("\nOlcum iki kez baslatilmaz");
var o9 = sahteOrtam();
var K9 = kapiYukle(o9);
K9.ver(true);
K9.ver(true);
esit("betik tek", o9.eklenenBetikler.length, 1);

console.log("\nKapatip yeniden acmak olcumu geri getirir");
var o10 = sahteOrtam({ baslangic: { "korayoner.olcum-onayi": "ret" } });
var K10 = kapiYukle(o10);
esit("once kapali", o10.eklenenBetikler.length, 0);
K10.ver(true);
esit("acinca basladi", o10.eklenenBetikler.length, 1);
esit("durum kabul", K10.durum(), "kabul");

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (olcum tercihi kontrolleri)");
