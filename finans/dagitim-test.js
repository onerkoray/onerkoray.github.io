#!/usr/bin/env node
/*
 * Marjinal sermaye dagitimi regresyonlari.
 *
 * NEDEN: bu araç bir ÖNERİ üretiyor. Yanlış bir öncelik sırası, makul
 * görünen ama kullanıcıya para kaybettiren bir tavsiye demek. Aşağıdaki
 * kontroller hem aritmetiği hem de ÖNCELİK KURALLARINI sabitliyor.
 */
"use strict";
var D = require("./dagitim-motor.js");
var F = require("./kurallar.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.02 : tol;
  if (Math.abs(b - bek) > t) { hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b); }
  else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

console.log("Aritmetik");
esit("aylik %3,75 -> yillik %55,55", D.yillikBilesik(0.0375), 0.55545, 0.0002);
esit("aylik %1 -> yillik %12,68", D.yillikBilesik(0.01), 0.1268, 0.0005);
/* Reel getiri bolme ile: (1+0,346)/(1+0,30)-1 = %3,54 */
esit("nominal %34,6 & enflasyon %30 -> reel %3,54", D.reel(0.346, 0.30), 0.0354, 0.0005);
dogru("reel, cikarmadan FARKLI olmali", Math.abs(D.reel(0.346, 0.30) - 0.046) > 0.005);

console.log("\nStopaj kademesi kurallar.js'ten geliyor");
esit("92 gun -> %17,5", F.stopajOraniGun(92, "tl"), 17.5);
/* SINIR: tarife "1 yila kadar %15, 1 yildan UZUN %10" diyor. Tam 365 gun
   yildonumune denk geliyor, yani "1 yila kadar" — %15. Eski test burada
   %10 bekliyordu ve yalnizca UTC+3'te geciyordu: saat dilimi hatasi,
   sinirin yanlis tarafini dogruymus gibi gosteriyordu. Iki kontrol birden
   yaziliyor ki sinir bir daha sessizce kaymasin. */
esit("365 gun (tam bir yil) -> %15", F.stopajOraniGun(365, "tl"), 15);
esit("366 gun (bir yildan uzun) -> %10", F.stopajOraniGun(366, "tl"), 10);

var TABAN = {
  aylikFazla: 10000, acilFonMevcut: 0, aylikZorunluGider: 20000, acilFonAy: 3,
  borclar: [], mevduatYillikBrut: 0.42, vadeGun: 92, enflasyon: 0.30
};
function ile(ek) {
  var o = {}; Object.keys(TABAN).forEach(function (k) { o[k] = TABAN[k]; });
  Object.keys(ek).forEach(function (k) { o[k] = ek[k]; });
  return D.dagit(o);
}
function hedefi(r, i) { return r.dagitim[i] ? r.dagitim[i].hedef : null; }

console.log("\nOncelik 1 — tampon, en pahali borcun bile onunde");
var a = ile({ borclar: [{ ad: "Kart", bakiye: 50000, aylikFaiz: 0.0375 }] });
dogru("fon sifirken ilk hedef tampon", /tampon/i.test(hedefi(a, 0)));
dogru("kart kuyrukta bekliyor", a.kuyruk.some(function (k) { return k.ad === "Kart"; }));

console.log("\nOncelik 2 — tampon dolunca pahali borc one geciyor");
/* Fazla para, hem karti hem fon acigini karsilayacak kadar buyuk
   secildi; kucuk bir fazlada kartin tamami yutar ve ikinci kalem hic
   olusmaz — ilk yazimda test tam bunu yakalamisti. */
var b = ile({ acilFonMevcut: 20000, aylikFazla: 120000,
  borclar: [{ ad: "Kart", bakiye: 50000, aylikFaiz: 0.0375 }] });
esit("ilk hedef kart", hedefi(b, 0) === "Kart" ? 1 : 0, 1, 0);
dogru("fon tamamlama karttan SONRA", /tamamlama/i.test(hedefi(b, 1) || ""));
var kucuk = ile({ acilFonMevcut: 20000, aylikFazla: 10000,
  borclar: [{ ad: "Kart", bakiye: 50000, aylikFaiz: 0.0375 }] });
esit("kucuk fazlada tek kalem", kucuk.dagitim.length, 1, 0);

console.log("\nOncelik 3 — ucuz borc mevduattan sonra gelmez, TERCIH olur");
var c = ile({ acilFonMevcut: 60000, borclar: [{ ad: "Konut", bakiye: 800000, aylikFaiz: 0.012 }] });
dogru("para mevduata gidiyor", /Mevduat/i.test(hedefi(c, 0)));
dogru("ucuz borc tercih olarak raporlaniyor", c.ucuzBorclar.length === 1);
dogru("tercihin bedeli sayiyla veriliyor", c.ucuzBorclar[0].fark > 0);

console.log("\nPahali/ucuz esigi mevduat NETI (brut degil)");
/* Brut %42, 92 gun -> stopaj %17,5 -> net %34,65.
   Yillik %34,65'e denk aylik oran ~%2,50. Bunun ustu pahali sayilmali. */
var net = ile({}).mevduat.net;
esit("mevduat neti %34,65", net, 0.3465, 0.001);
var pahali = ile({ acilFonMevcut: 60000, borclar: [{ ad: "P", bakiye: 10000, aylikFaiz: 0.030 }] });
dogru("aylik %3 pahali sayiliyor", hedefi(pahali, 0) === "P");
var ucuz = ile({ acilFonMevcut: 60000, borclar: [{ ad: "U", bakiye: 10000, aylikFaiz: 0.015 }] });
dogru("aylik %1,5 ucuz sayiliyor", /Mevduat/i.test(hedefi(ucuz, 0)));

console.log("\nSiralama — pahali borclar kendi icinde yuksekten dusuge");
var s = ile({
  acilFonMevcut: 60000, aylikFazla: 500000,
  borclar: [{ ad: "Dusuk", bakiye: 10000, aylikFaiz: 0.028 },
            { ad: "Yuksek", bakiye: 10000, aylikFaiz: 0.042 }]
});
dogru("once yuksek faizli", hedefi(s, 0) === "Yuksek");

console.log("\nButunluk");
var t = ile({ aylikFazla: 12345, acilFonMevcut: 60000,
  borclar: [{ ad: "K", bakiye: 5000, aylikFaiz: 0.04 }] });
var toplam = t.dagitim.reduce(function (x, d) { return x + d.tutar; }, 0);
esit("dagitim toplami aylik fazlaya esit", toplam, 12345, 0.05);
dogru("hicbir kalem negatif degil", t.dagitim.every(function (d) { return d.tutar > 0; }));

console.log("\nAcil fon raporu");
var f = ile({ aylikZorunluGider: 20000, acilFonAy: 3, acilFonMevcut: 15000, aylikFazla: 5000 });
esit("hedef 60.000", f.acilFon.hedef, 60000);
esit("acik 45.000", f.acilFon.acik, 45000);
esit("9 ayda dolar", f.acilFon.kacAyda, 9, 0);

console.log("\nGecersiz girdi");
dogru("fazla para sifirsa hata", !!D.dagit({ aylikFazla: 0 }).hata);

console.log("\nDegismez — pahali borc varken plan mevduattan iyi olmali");
var k = ile({ acilFonMevcut: 60000, borclar: [{ ad: "Kart", bakiye: 100000, aylikFaiz: 0.0375 }] });
dogru("plan, hepsini mevduata koymaktan iyi", k.kiyas.fark > 0);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (dagitim kontrolleri)");
