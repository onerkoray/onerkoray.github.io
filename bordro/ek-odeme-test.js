#!/usr/bin/env node
/*
 * Prim / ikramiye ek ödeme motoru regresyonları.
 *
 * NEDEN: bu araç yaygın bir inanışı YANLIŞLIYOR ("ikramiyeni Aralık'ta al,
 * vergiden kaç"). Böyle bir iddiada bulunan bir sayfanın, iddiasını her
 * push'ta yeniden ölçmesi gerekir. Aşağıdaki üç değişmez aracın tezidir;
 * biri kayarsa sayfa sessizce yanlış bir şey söylemeye başlar.
 */
"use strict";
var E = require("./ek-odeme-motoru.js");
var B = require("./motor.js");
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

function duz(m) { var a = []; for (var i = 0; i < 12; i++) a.push(m); return a; }
function zamli(once, sonra, zamAy) {
  var a = [];
  for (var i = 1; i <= 12; i++) a.push(i < zamAy ? once : sonra);
  return a;
}

/* ------------------------------------------------------------------ */
console.log("Muhasebe ozdesligi — kurus kaybolmaz");
/* Ek odemenin tamami dort yere gider: cebe, gelir vergisine, SGK'ya,
   damgaya. Toplam tutmuyorsa bir kalem iki kez sayiliyor demektir. */
[[100000, 300000, 12], [45000, 20000, 3], [250000, 1000000, 7]].forEach(function (v) {
  var r = E.analiz({ aylikBrut: v[0], tutar: v[1], ay: v[2], yil: 2026 });
  esit("maas " + v[0] + " / odeme " + v[1] + " kalemleri toplami",
    r.eleGecen + r.gelirVergisi + r.sgk + r.damga, v[1], 0.05);
});

/* ------------------------------------------------------------------ */
console.log("\nDEGISMEZ 1 — duz maasta AY, gelir vergisini DEGISTIRMEZ");
/* Kumulatif tarifede aylik vergi artislari teleskopik toplanir: yil
   toplami yalnizca YIL TOPLAM MATRAHINA baglidir. Aracin en carpici
   iddiasi bu; dort maas seviyesinde birden olculuyor. */
[45000, 100000, 200000, 400000].forEach(function (maas) {
  var r = E.analiz({ aylikBrut: maas, tutar: 150000, ay: 6, yil: 2026 });
  esit("maas " + maas + ": 12 ay arasinda gelir vergisi yayilimi sifir",
    r.vergiYayilimi, 0, 0.05);
  esit("maas " + maas + ": ele gecen de degismiyor", r.ayFarki, 0, 0.05);
  dogru("maas " + maas + ": ay onemsiz isaretlendi", r.ayOnemliMi === false);
});

/* ------------------------------------------------------------------ */
console.log("\nDEGISMEZ 2 — taban maas degisiyorsa AY, SGK TAVANI uzerinden fark eder");
/* Tavan AYLIK. Odemeyi taban ucretin zaten yuksek oldugu aya koyunca
   odemenin daha buyuk kismi tavanin ustunde kalir ve prim kesilmez. */
var z = E.analiz({ aylikBrut: zamli(80000, 160000, 7), tutar: 200000, ay: 1, yil: 2026 });
dogru("bu senaryoda ay ONEMLI", z.ayOnemliMi === true);
esit("en iyi ay Temmuz (zammin ilk ayi)", z.enIyiAy.ay, 7, 0);
dogru("en kotu ay zam oncesinde", z.enKotuAy.ay < 7);
esit("olculen fark 6.868,94 TL", z.ayFarki, 6868.94, 1);
/* Farkin KAYNAGI SGK olmali, tarifenin kendisi degil: */
dogru("SGK yayilimi vergi yayiliminin uzerinde", z.sgkYayilimi > z.vergiYayilimi);
dogru("zam sonrasi butun aylar esit iyi",
  z.aylar.slice(6).every(function (s) {
    return Math.abs(s.eleGecen - z.enIyiAy.eleGecen) < 0.05;
  }));

/* ------------------------------------------------------------------ */
console.log("\nDEGISMEZ 3 — tek seferde almak, bolerek almaktan iyidir");
var b = E.bolmeKarsilastirmasi({ aylikBrut: 100000, tutar: 300000, ay: 12, yil: 2026 });
esit("en iyi secenek tek parca", b.enIyi.parca, 1, 0);
esit("olculen fark 11.248,94 TL", b.fark, 11248.94, 1);
dogru("bolununce SGK artiyor", b.enKotu.sgk > b.enIyi.sgk);
/* Bolme sayisi arttikca ele gecen ARTMAMALI (tavan etkisi tek yonlu). */
var sirali = b.secenekler.slice().sort(function (x, y) { return x.parca - y.parca; });
dogru("parca sayisi arttikca ele gecen artmiyor", sirali.every(function (s, i) {
  return i === 0 || s.eleGecen <= sirali[i - 1].eleGecen + 0.05;
}));

/* Tavanin ALTINDA kalan bir odemede bolme fark etmemeli: */
var kucuk = E.bolmeKarsilastirmasi({ aylikBrut: 40000, tutar: 24000, ay: 1, yil: 2026 });
esit("tavan altinda bolme fark etmiyor", kucuk.fark, 0, 1);

/* ------------------------------------------------------------------ */
console.log("\nMarjinal oran, ORTALAMA oran degildir — ve YONU degisir");
/* Ilk yazimda bu test "marjinal her zaman ortalamanin uzerindedir"
   diyordu ve dustu. Kod dogruydu: SGK TAVANI isin yonunu ceviriyor.
   Tavanin altinda artan oranli tarife baskin, ustunde ise ek odemeden
   hic prim kesilmedigi icin marjinal ORTALAMANIN ALTINA iniyor.
   Aracin ikinci carpici iddiasi bu; iki yonu de sabitleniyor. */
var TAVAN = B.parametre(2026).donemler[0].sgkTavan;

var altta = E.analiz({ aylikBrut: 100000, tutar: 200000, ay: 6, yil: 2026 });
dogru("tavan ALTINDA marjinal > ortalama", altta.marjinalFarki > 0.05);
esit("tavan altinda ortalama ~%30,5", altta.ortalamaKesinti, 0.305, 0.004);
esit("tavan altinda marjinal ~%38,6", altta.efektifKesinti, 0.386, 0.004);

var ustte2 = E.analiz({ aylikBrut: TAVAN + 3000, tutar: 200000, ay: 6, yil: 2026 });
dogru("tavan USTUNDE marjinal < ortalama", ustte2.marjinalFarki < 0);
esit("tavan ustunde ek odemeden prim kesilmiyor", ustte2.sgk, 0, 0.05);

/* Iki yon arasinda bir gecis olmali: maas buyudukce fark isaret degistirir. */
var isaretler = [80000, 120000, 200000, 400000].map(function (m) {
  return E.analiz({ aylikBrut: m, tutar: 200000, ay: 6, yil: 2026 }).marjinalFarki > 0;
});
dogru("dusuk maasta pozitif, yuksek maasta negatif",
  isaretler[0] === true && isaretler[isaretler.length - 1] === false);

/* Asgari ucrete yakin gelirde istisna sayesinde kesinti dusuk kalir. */
var alt = E.analiz({ aylikBrut: 35000, tutar: 10000, ay: 2, yil: 2026 });
dogru("dusuk gelirde kesinti orani daha dusuk", alt.efektifKesinti < altta.efektifKesinti);

/* ------------------------------------------------------------------ */
console.log("\nTutar egrisi — elde kalan oran TEK YONLU DEGIL");
/* Ilk yazimda bu test "odeme buyudukce elde kalan oran azalir" diyordu ve
   dustu. Kod dogruydu, beklenti yanlisti: iki kuvvet ters yonde calisiyor.
   Simdi iki tek yonlu bileseni ayri ayri, toplami ise TEPE noktasiyla
   sabitleniyor -- asil anlatilmaya deger sekil bu. */
var eg = E.tutarEgrisi({ aylikBrut: 100000, ay: 6, yil: 2026 },
  [50000, 100000, 200000, 300000, 500000, 1000000, 1500000, 3000000]);

dogru("SGK yuku oransal olarak TEK YONLU azaliyor", eg.egri.every(function (n, i) {
  return i === 0 || n.sgkOrani <= eg.egri[i - 1].sgkOrani + 1e-9;
}));
dogru("gelir vergisi yuku oransal olarak TEK YONLU artiyor", eg.egri.every(function (n, i) {
  return i === 0 || n.vergiOrani >= eg.egri[i - 1].vergiOrani - 1e-9;
}));
dogru("toplam ise tek yonlu DEGIL — ic noktada tepe var", eg.tekYonluDegil === true);
esit("tepe 500.000 TL civarinda", eg.tepe.tutar, 500000, 1);
dogru("tepede elde kalan oran ~%67,9", Math.abs(eg.tepe.kalanOran - 0.6792) < 0.002);
dogru("cok buyuk odemede oran tepenin altina iniyor",
  eg.egri[eg.egri.length - 1].kalanOran < eg.tepe.kalanOran - 0.01);
/* Tavanin ALTINDA kalan iki odeme ayni orani vermeli (henuz rahatlama yok). */
dogru("tavan altinda oran sabit",
  Math.abs(eg.egri[0].kalanOran - eg.egri[1].kalanOran) < 1e-6);

/* Kullanicinin kendi tutari egride yer almali ki noktasini gorebilsin. */
var eg2 = E.tutarEgrisi({ aylikBrut: 100000, tutar: 237000, ay: 6, yil: 2026 });
dogru("kullanicinin tutari egriye ekleniyor",
  eg2.egri.some(function (n) { return n.tutar === 237000; }));

/* ------------------------------------------------------------------ */
console.log("\nSGK tavani — tabani zaten tavanin ustunde olan aya ek prim yok");
var P = B.parametre(2026);
var tavan = P.donemler[0].sgkTavan;
var ustte = E.analiz({ aylikBrut: tavan + 50000, tutar: 100000, ay: 4, yil: 2026 });
esit("tavan ustu maasta ek odemeden SGK kesilmiyor", ustte.sgk, 0, 0.05);
dogru("gelir vergisi yine de var", ustte.gelirVergisi > 0);

/* ------------------------------------------------------------------ */
console.log("\nIsi haritasi izgarasi");
var g = E.duyarlilik({ aylikBrut: zamli(80000, 160000, 7), tutar: 200000, yil: 2026 });
esit("12 sutun", g.x.length, 12, 0);
dogru("her satirin ortalamasi sifir (fark olcegi)", g.hucreler.every(function (s) {
  var t = s.reduce(function (a, c) { return a + c.deger; }, 0);
  return Math.abs(t) < 1;
}));
dogru("sinir var — karar bu aralikta donuyor", g.sinirVar === true);
var duzG = E.duyarlilik({ aylikBrut: 100000, tutar: 200000, yil: 2026 });
dogru("duz maasta yuzey dumduz", duzG.enBuyukMutlak < 1);

/* ------------------------------------------------------------------ */
console.log("\nIsveren maliyeti");
var im = E.analiz({ aylikBrut: 100000, tutar: 100000, ay: 5, yil: 2026 });
dogru("isveren maliyeti brut odemeden buyuk", im.isverenMaliyeti > im.tutar);
dogru("ele gecen, isveren maliyetinin yarisindan az degil",
  im.eleGecen > im.isverenMaliyeti * 0.4);

/* ------------------------------------------------------------------ */
console.log("\n12 elemanli dizi girdi");
var dz = E.tabanDizi([1, 2, 3]);
esit("eksik aylar sifirlanir", dz.length, 12, 0);
esit("dorduncu ay sifir", dz[3], 0, 0);
esit("sayi girdisi 12 aya yayilir", E.tabanDizi(5000)[11], 5000, 0);

/* ------------------------------------------------------------------ */
console.log("\nGecersiz girdi");
dogru("tutar sifirsa hata", !!E.analiz({ aylikBrut: 100000, tutar: 0 }).hata);
dogru("maas sifirsa hata", !!E.analiz({ aylikBrut: 0, tutar: 1000 }).hata);
/* Ay araligi disina tasan girdi hata degil, sinira cekilir: */
esit("ay 0 -> Ocak", E.analiz({ aylikBrut: 100000, tutar: 1000, ay: 0, yil: 2026 }).ay, 1, 0);
esit("ay 99 -> Aralik", E.analiz({ aylikBrut: 100000, tutar: 1000, ay: 99, yil: 2026 }).ay, 12, 0);

/* ------------------------------------------------------------------ */
console.log("\nGecmis yillar da calisiyor");
B.yillar().forEach(function (y) {
  var r = E.analiz({ aylikBrut: 60000, tutar: 50000, ay: 6, yil: y });
  dogru(y + " yilinda hesap uretiliyor", !r.hata && r.eleGecen > 0 && r.eleGecen < 50000);
});

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (ek odeme kontrolleri)");
