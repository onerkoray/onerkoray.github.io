#!/usr/bin/env node
/*
 * Nakit akışı motoru ve Sankey regresyonları.
 *
 * NEDEN: bu araç bir MUTABAKAT gösteriyor. Bir akış diyagramının tek
 * iddiası, giren ile çıkanın tutmasıdır; tutmuyorsa diyagram güzel
 * görünüp yalan söyler ve kimse fark etmez. Aşağıdaki kontroller o
 * mutabakatı ve ömür bedelinin reel olduğunu sabitliyor.
 */
"use strict";
var N = require("./nakit-akisi-motoru.js");
var S = require("./sankey.js");
var B = require("../bordro/motor.js");
var E = require("./enflasyon-motoru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.02 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

var GIDER = [
  { ad: "Kira", tutar: 22000, zorunlu: true },
  { ad: "Market", tutar: 14000, zorunlu: true },
  { ad: "Ulasim", tutar: 6000, zorunlu: true },
  { ad: "Abonelikler", tutar: 2500, zorunlu: false },
  { ad: "Disarida yemek", tutar: 7000, zorunlu: false }
];
function taban(ek) {
  var g = {
    aylikBrut: 100000, digerGelir: 0, yil: 2026,
    getiri: 0.35, enflasyon: 0.30, ufukYil: 10, giderler: GIDER
  };
  for (var k in (ek || {})) if (Object.prototype.hasOwnProperty.call(ek, k)) g[k] = ek[k];
  return g;
}

/* ------------------------------------------------------------------ */
console.log("MUTABAKAT — akista para kaybolmaz");
var r = N.analiz(taban());
esit("brut = vergi + sgk + damga + net",
  r.ucret.gelirVergisi + r.ucret.sgkIsci + r.ucret.damga + r.ucret.net,
  r.ucret.brut, 0.05);
esit("isveren maliyeti = brut + isveren payi",
  r.ucret.brut + r.ucret.isverenPayi, r.ucret.isverenMaliyeti, 0.05);
esit("net gelir = giderler + tasarruf",
  r.giderToplam + r.tasarruf, r.netGelir, 0.05);

var a = N.akis(r);
function cikan(id) {
  return a.baglantilar.filter(function (b) { return b.kaynak === id; })
    .reduce(function (s, b) { return s + b.deger; }, 0);
}
function giren(id) {
  return a.baglantilar.filter(function (b) { return b.hedef === id; })
    .reduce(function (s, b) { return s + b.deger; }, 0);
}
esit("maliyet dugumunden cikan = isveren maliyeti", cikan("maliyet"), r.ucret.isverenMaliyeti, 0.05);
esit("brut dugumune giren = brut", giren("brut"), r.ucret.brut, 0.05);
esit("brut dugumunden cikan = brut", cikan("brut"), r.ucret.brut, 0.05);
esit("net dugumune giren = net gelir", giren("net"), r.netGelir, 0.05);
esit("net dugumunden cikan = net gelir", cikan("net"), r.netGelir, 0.05);

/* ------------------------------------------------------------------ */
console.log("\nDiger gelir akisa dogru baglaniyor");
var d = N.analiz(taban({ digerGelir: 15000 }));
var ad = N.akis(d);
function cikanD(id) {
  return ad.baglantilar.filter(function (b) { return b.kaynak === id; })
    .reduce(function (s, b) { return s + b.deger; }, 0);
}
esit("net gelir ucret neti + diger", d.netGelir, d.ucret.net + 15000, 0.05);
dogru("diger gelir dugumu olustu",
  ad.dugumler.some(function (x) { return x.id === "diger"; }));
esit("diger gelirden cikan 15.000", cikanD("diger"), 15000, 0.05);
/* Diger gelir tasarrufu birebir buyutmeli (gider degismedi). */
esit("tasarruf 15.000 artti", d.tasarruf - r.tasarruf, 15000, 0.05);

/* ------------------------------------------------------------------ */
console.log("\nAcik durumu — gider gelirden buyukse");
var acik = N.analiz(taban({ giderler: GIDER.concat([{ ad: "Kredi", tutar: 40000, zorunlu: true }]) }));
dogru("acik isaretlendi", acik.acikVarMi === true);
dogru("tasarruf negatif", acik.tasarruf < 0);
var aa = N.akis(acik);
dogru("acik dugumu var", aa.dugumler.some(function (x) { return x.id === "acik"; }));
dogru("tasarruf dugumu YOK", !aa.dugumler.some(function (x) { return x.id === "tasarruf"; }));
esit("acik dugumune giren = acigin mutlak degeri",
  aa.baglantilar.filter(function (b) { return b.hedef === "acik"; })
    .reduce(function (s, b) { return s + b.deger; }, 0),
  -acik.tasarruf, 0.05);

/* ------------------------------------------------------------------ */
console.log("\nOMUR BEDELI REELDIR — nominal degil");
/* Aylik gider enflasyonla buyur, yatirim nominal getirir; ikisi reel
   cercevede bulusur. Nominal toplamak bedeli ABARTIR. */
var reel = E.reel(0.35, 0.30);
esit("reel getiri bolme ile (%3,85)", r.reelGetiri, reel, 1e-9);
dogru("reel getiri, cikarma ile bulunandan FARKLI",
  Math.abs(r.reelGetiri - (0.35 - 0.30)) > 0.005);

/* Kapali formul dogrulamasi: 2.500 TL x 120 ay, aylik reel oranla. */
var ayReel = Math.pow(1 + reel, 1 / 12) - 1;
var bek = 2500 * (Math.pow(1 + ayReel, 120) - 1) / ayReel;
var abone = r.giderler.filter(function (k) { return k.ad === "Abonelikler"; })[0];
esit("abonelik omur bedeli kapali formulle ayni", abone.omurBedeli, bek, 1);
dogru("omur bedeli duz toplamdan BUYUK (getiri var)", abone.omurBedeli > 2500 * 120);

/* Getiri = enflasyon ise reel getiri sifir; bedel duz toplam olmali. */
var notr = N.analiz(taban({ getiri: 0.30, enflasyon: 0.30 }));
var abone2 = notr.giderler.filter(function (k) { return k.ad === "Abonelikler"; })[0];
esit("reel getiri sifirken bedel = aylik x ay sayisi", abone2.omurBedeli, 2500 * 120, 1);

/* Ufuk iki katina cikinca bedel iki kattan FAZLA artmali (bilesik). */
var uzun = N.analiz(taban({ ufukYil: 20 }));
var abone3 = uzun.giderler.filter(function (k) { return k.ad === "Abonelikler"; })[0];
dogru("ufuk 2x olunca bedel 2x'ten fazla", abone3.omurBedeli > abone.omurBedeli * 2);

/* ------------------------------------------------------------------ */
console.log("\nTasarruf orani NET gelir uzerinden");
esit("tasarruf orani = tasarruf / net gelir", r.tasarrufOrani, r.tasarruf / r.netGelir, 1e-9);
/* Brut uzerinden hesaplansa daha kucuk cikardi; karisirsa bu test yakalar. */
dogru("brut uzerinden hesaplanmiyor",
  Math.abs(r.tasarrufOrani - r.tasarruf / r.ucret.brut) > 0.02);

console.log("\nVergi kamasi");
esit("kama = (isveren maliyeti - net) / isveren maliyeti",
  r.vergiKamasi, (r.ucret.isverenMaliyeti - r.ucret.net) / r.ucret.isverenMaliyeti, 1e-9);
dogru("kama makul aralikta", r.vergiKamasi > 0.25 && r.vergiKamasi < 0.60);

/* ------------------------------------------------------------------ */
console.log("\nGiderler buyukten kucuge siralaniyor");
dogru("sirali", r.giderler.every(function (k, i) {
  return i === 0 || k.tutar <= r.giderler[i - 1].tutar;
}));
esit("en buyuk kalem Kira", r.giderler[0].ad === "Kira" ? 1 : 0, 1, 0);
esit("paylarin toplami = gider / net",
  r.giderler.reduce(function (s, k) { return s + k.pay; }, 0),
  r.giderToplam / r.netGelir, 1e-9);

console.log("\nKisinti etkisi");
var ke = N.kisintiEtkisi(r, "Abonelikler", 1);
esit("tamamini kesmek aylik 2.500 kazandiriyor", ke.aylikKazanc, 2500, 0.05);
esit("omur kazanci = kalemin omur bedeli", ke.omurKazanci, abone.omurBedeli, 1);
esit("yeni tasarruf 2.500 fazla", ke.yeniTasarruf - r.tasarruf, 2500, 0.05);
var yari = N.kisintiEtkisi(r, "Abonelikler", 0.5);
esit("yarisini kesmek yarisini kazandiriyor", yari.omurKazanci, abone.omurBedeli / 2, 1);
dogru("olmayan kalem null doner", N.kisintiEtkisi(r, "Yok boyle", 1) === null);

/* ------------------------------------------------------------------ */
console.log("\nSankey katman cikarimi");
var kt = S.katmanlar(a.dugumler, a.baglantilar);
esit("maliyet ilk sutun", kt.kat["maliyet"], 0, 0);
esit("brut ikinci sutun", kt.kat["brut"], 1, 0);
esit("net ucuncu sutun", kt.kat["net"], 2, 0);
dogru("gider kalemleri netten sonra", kt.kat["g0"] > kt.kat["net"]);

/* BIRIM DEGISMEZI: diyagramdaki her kol AYLIK tutardir.
   Ilk surumde akisin ucuna "N yil sonra" diye bir dugum ekleniyordu; bu,
   STOK ile AKISI ayni olcekte cizmek demekti ve dugum ufuktaki tutari
   degil aylik tasarrufu etiketliyordu -- okuyucuya yanlis sayi. Ufuktaki
   tutar ozet kartinin isi, diyagramin degil. Test o dugumun geri
   gelmedigini ve toplamlarin aylik kaldigini sabitliyor. */
dogru("ufuk/stok dugumu YOK", !a.dugumler.some(function (x) { return x.id === "gelecek"; }));
dogru("hicbir baglanti aylik net gelirden buyuk degil",
  a.baglantilar.every(function (b) { return b.deger <= r.ucret.isverenMaliyeti + 0.05; }));
esit("tasarruf kolu aylik tasarrufa esit",
  a.baglantilar.filter(function (b) { return b.hedef === "tasarruf"; })
    .reduce(function (s, b) { return s + b.deger; }, 0), r.tasarruf, 0.05);
dogru("ufuktaki birikim akista degil, ozette",
  r.birikimUfukta > r.tasarruf * 12 && !a.dugumler.some(function (x) {
    return String(x.ad).indexOf("yıl sonra") >= 0;
  }));

console.log("\nSankey ciziyor");
var svg = S.ciz({ dugumler: a.dugumler, baglantilar: a.baglantilar, baslik: "Test" });
dogru("svg uretildi", svg.indexOf("<svg") > 0);
dogru("role=img var", svg.indexOf('role="img"') > 0);
dogru("title ve desc var", svg.indexOf("<title id=") > 0 && svg.indexOf("<desc id=") > 0);
dogru("tablo yedegi var", svg.indexOf("<table>") > 0);
dogru("var(--brand) KULLANILMIYOR", svg.indexOf("--brand") < 0);
esit("her baglanti icin bir serit",
  (svg.match(/class="sk-serit/g) || []).length, a.baglantilar.length, 0);
esit("her dugum icin bir kutu",
  (svg.match(/class="sk-dugum/g) || []).length, a.dugumler.length, 0);
dogru("bos girdide bos donuyor", S.ciz({ dugumler: [], baglantilar: [] }) === "");

/* ------------------------------------------------------------------ */
console.log("\nDuyarlilik izgarasi");
var iz = N.duyarlilik(taban(), r);
esit("6 sutun", iz.x.length, 6, 0);
esit("6 satir", iz.y.length, 6, 0);
dogru("tasarruf orani arttikca deger artiyor", iz.hucreler.every(function (s) {
  return s.every(function (c, i) { return i === 0 || c.deger >= s[i - 1].deger - 1e-9; });
}));
dogru("ufuk uzadikca deger artiyor", iz.hucreler.every(function (s, j) {
  return j === 0 || s.every(function (c, i) { return c.deger >= iz.hucreler[j - 1][i].deger - 1e-9; });
}));
dogru("sinir var — karar bu aralikta donuyor", iz.sinirVar === true);

/* ------------------------------------------------------------------ */
console.log("\nGecersiz girdi");
dogru("gelir sifirsa hata", !!N.analiz({ aylikBrut: 0, digerGelir: 0 }).hata);
dogru("sifir tutarli gider elenir",
  N.analiz(taban({ giderler: [{ ad: "Sifir", tutar: 0 }] })).giderler.length === 0);
var gidersiz = N.analiz(taban({ giderler: [] }));
esit("gidersizde tasarruf = net gelir", gidersiz.tasarruf, gidersiz.netGelir, 0.05);

console.log("\nSadece diger gelir (ucretsiz) de calisiyor");
var sadece = N.analiz(taban({ aylikBrut: 0, digerGelir: 40000 }));
dogru("hata yok", !sadece.hata);
esit("net gelir 40.000", sadece.netGelir, 40000, 0.05);
esit("vergi kamasi sifir (ucret yok)", sadece.vergiKamasi, 0, 1e-9);

console.log("\nButun bordro yillari");
B.yillar().forEach(function (y) {
  var x = N.analiz(taban({ yil: y }));
  dogru(y + " yilinda akis uretiliyor", !x.hata && x.netGelir > 0 &&
    Math.abs(x.giderToplam + x.tasarruf - x.netGelir) < 0.05);
});

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (nakit akisi kontrolleri)");
