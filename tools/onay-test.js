#!/usr/bin/env node
/*!
 * Ölçüm onayı regresyonları.
 *
 * NEDEN: bu dosyanın koruduğu şey bir özellik değil, bir SÖZ. Site
 * "hesap araçlarına girdiğiniz veriler cihazınızdan çıkmaz" diyor ve
 * Finansal İkiz'le birlikte bu söz çok ağırlaştı. Onay kapısı sessizce
 * bozulursa — bir yükleme yolu erken tetiklenirse, ret kaydedilmezse,
 * çerezler geri alma sonrası kalırsa — kimse fark etmez: sayfa açılır,
 * araçlar çalışır, yalnızca söz tutulmamıştır.
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
console.log("KARAR VERILMEDEN GOOGLE'A HICBIR ISTEK GITMEZ");
/* Consent Mode'un "denied" varsayilani bile Google'a cerezsiz bir sinyal
   gonderir. Burada gtag betigi HIC yuklenmiyor; test tam olarak bunu
   olcuyor. */
var o1 = sahteOrtam();
var K1 = kapiYukle(o1);
esit("durum: henuz sorulmadi", K1.durum(), null);
esit("hicbir betik yuklenmedi", o1.eklenenBetikler.length, 0);
esit("dataLayer olusturulmadi", typeof o1.pencere.dataLayer, "undefined");
esit("gtag tanimlanmadi", typeof o1.pencere.gtag, "undefined");
dogru("serit gosterildi", o1.govde.length === 1);
esit("serit sinifi", o1.govde[0].sinif, "onay-serit");

console.log("\nREDDETMEK KABUL ETMEK KADAR KOLAY");
/* Reddi soluk bir baglantiya indirmek teknik olarak "secenek sunmak" ama
   pratikte yonlendirmedir; reddi zorlastiran bir onay hukuken de
   alinmamis sayilir. Iki dugme ayni sinifta ve ayni katmanda. */
var dugmeler = o1.govde[0].cocuklar.filter(function (c) { return c.sinif === "onay-dugmeler"; });
esit("dugme kabi var", dugmeler.length, 1);
var ikisi = dugmeler[0].cocuklar;
esit("tam iki dugme", ikisi.length, 2);
esit("ikisi de ayni sinifta", ikisi[0].sinif, ikisi[1].sinif);
esit("once RET geliyor", ikisi[0].metin, "Ölçme");
esit("sonra KABUL", ikisi[1].metin, "Ölçebilirsin");
/* Kapatma carpisi YOK: carpi "sonra sorarim" mi "kabul" mu belli olmaz
   ve bu belirsizlik hep sitenin lehine yorumlanir. Seritte TOPLAM iki
   dugme olmali -- ucuncu bir dugme cikarsa bu kontrol kirilir. */
function dugmeSay(e) {
  var n = (e.metin === "Ölçme" || e.metin === "Ölçebilirsin") ? 1 : 0;
  (e.cocuklar || []).forEach(function (c) { n += dugmeSay(c); });
  return n;
}
esit("seritte TOPLAM iki dugme", dugmeSay(o1.govde[0]), 2);
esit("seridin iki cocugu var (metin + dugmeler)", o1.govde[0].cocuklar.length, 2);

console.log("\nRET: hicbir sey yuklenmez, karar SAKLANIR");
ikisi[0].dinleyiciler.click();
esit("durum ret", K1.durum(), "ret");
esit("betik yok", o1.eklenenBetikler.length, 0);
esit("serit kaldirildi", o1.govde.length, 0);
esit("karar depoda", o1.kutu["korayoner.olcum-onayi"], "ret");

console.log("\nKABUL: gtag YUKLENIR ve dogru kimlikle");
var o2 = sahteOrtam();
var K2 = kapiYukle(o2);
var d2 = o2.govde[0].cocuklar.filter(function (c) { return c.sinif === "onay-dugmeler"; })[0];
d2.cocuklar[1].dinleyiciler.click();
esit("durum kabul", K2.durum(), "kabul");
esit("tek betik yuklendi", o2.eklenenBetikler.length, 1);
dogru("gtag betigi", /googletagmanager\.com\/gtag\/js\?id=G-/.test(o2.eklenenBetikler[0]));
dogru("config cagrisi yapildi", (o2.pencere.dataLayer || []).some(function (a) {
  return a[0] === "config";
}));

console.log("\nIkinci yuklemede karar HATIRLANIR, serit cikmaz");
var o3 = sahteOrtam({ baslangic: { "korayoner.olcum-onayi": "kabul" } });
var K3 = kapiYukle(o3);
esit("kabul hatirlandi", K3.durum(), "kabul");
esit("serit YOK", o3.govde.length, 0);
esit("gtag dogrudan yuklendi", o3.eklenenBetikler.length, 1);

var o4 = sahteOrtam({ baslangic: { "korayoner.olcum-onayi": "ret" } });
var K4 = kapiYukle(o4);
esit("ret hatirlandi", K4.durum(), "ret");
esit("ret sonrasi serit YOK", o4.govde.length, 0);
esit("ret sonrasi betik YOK", o4.eklenenBetikler.length, 0);

console.log("\nGERI ALMAK VERMEK KADAR KOLAY — ve cerezler SILINIR");
/* Yalnizca "bir daha yukleme" demek, ORTADA DURAN veriyi birakmak olurdu. */
var o5 = sahteOrtam({
  baslangic: { "korayoner.olcum-onayi": "kabul" },
  cerezler: ["_ga=GA1.1.123", "_ga_ABC=GS1.1.9", "_gid=GA1.2.7", "tema=koyu"]
});
var K5 = kapiYukle(o5);
K5.ver(false);
esit("durum ret", K5.durum(), "ret");
var kalan = o5.cerezler();
dogru("_ga silindi", !kalan.some(function (c) { return /^_ga=/.test(c); }));
dogru("_ga_ABC silindi", !kalan.some(function (c) { return /^_ga_ABC=/.test(c); }));
dogru("_gid silindi", !kalan.some(function (c) { return /^_gid=/.test(c); }));
dogru("ILGISIZ cerez korundu", kalan.some(function (c) { return /^tema=/.test(c); }));

console.log("\nTARAYICI ZATEN HAYIR DIYORSA SORULMAZ");
/* GPC bazi yargi alanlarinda baglayici; DNT degil ama acikca ifade
   edilmis bir tercih. Ikisi de "sorma, cevap belli" demek -- ustune
   banner gostermek verilen cevabi yok saymak olur. */
var o6 = sahteOrtam({ navigator: { globalPrivacyControl: true } });
var K6 = kapiYukle(o6);
esit("GPC: durum ret", K6.durum(), "ret");
esit("GPC: serit YOK", o6.govde.length, 0);
esit("GPC: betik YOK", o6.eklenenBetikler.length, 0);

var o7 = sahteOrtam({ navigator: { doNotTrack: "1" } });
var K7 = kapiYukle(o7);
esit("DNT: durum ret", K7.durum(), "ret");
esit("DNT: betik YOK", o7.eklenenBetikler.length, 0);

/* Ama ACIK bir kabul, tarayici sinyalini yener: kullanicinin kendi
   sitede verdigi karar daha sonraki ve daha ozgul bir beyandir. */
var o8 = sahteOrtam({
  navigator: { doNotTrack: "1" },
  baslangic: { "korayoner.olcum-onayi": "kabul" }
});
var K8 = kapiYukle(o8);
esit("acik kabul DNT'yi yener", K8.durum(), "kabul");

console.log("\nDEPO YOKKEN (gizli sekme) SAYFA PATLAMAZ");
/* Onay sorgusu patlarsa sayfa hic acilmaz. Depo erisimi gizli sekmede
   null donmez, ISTISNA ATAR. */
var o9 = sahteOrtam({ depoVar: false });
var K9 = null;
try { K9 = kapiYukle(o9); } catch (e) { hata++; console.error("  BASARISIZ  kapi yuklenirken patladi: " + e.message); }
if (K9) {
  esit("durum: sorulmadi", K9.durum(), null);
  esit("serit yine gosterildi", o9.govde.length, 1);
  /* Karar saklanamasa bile o oturumda uygulanir: kabul edildiyse olcum
     baslar, yalnizca sonraki ziyarette tekrar sorulur. */
  K9.ver(true);
  esit("depo olmasa da olcum basladi", o9.eklenenBetikler.length, 1);
}

console.log("\nKarar duyurulur (live.js sehir tahminini buna bagliyor)");
var o10 = sahteOrtam();
var K10 = kapiYukle(o10);
var duyurulan = [];
K10.dinle(function (d) { duyurulan.push(d); });
K10.dinle(function () { throw new Error("bozuk dinleyici"); });
var sonDuyuru = [];
K10.dinle(function (d) { sonDuyuru.push(d); });
K10.ver(true);
esit("dinleyici cagrildi", duyurulan[0], "kabul");
esit("bozuk dinleyici digerlerini engellemedi", sonDuyuru[0], "kabul");

console.log("\nOlcum iki kez baslatilmaz");
var o11 = sahteOrtam({ baslangic: { "korayoner.olcum-onayi": "kabul" } });
var K11 = kapiYukle(o11);
K11.ver(true);
K11.ver(true);
esit("betik tek", o11.eklenenBetikler.length, 1);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (olcum onayi kontrolleri)");
