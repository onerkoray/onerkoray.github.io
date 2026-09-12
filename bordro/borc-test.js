#!/usr/bin/env node
/*
 * Borç kapatma simülatörü regresyonları.
 *
 * NEDEN: simülasyon hataları sessizdir. Faiz bir ay kaydırılırsa ya da
 * kapanan borcun asgarisi serbest bırakılmazsa sonuç yine makul görünür,
 * yalnızca yanlış olur. Aşağıdaki kontroller hem elle hesaplanmış tek
 * borçlu vakalara hem de stratejiler arası DEĞİŞMEZLERE bakıyor.
 */
"use strict";
var M = require("./borc-motor.js");
var P = require("./borc-parametreleri.js");
var hata = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.02 : tol;
  if (Math.abs(b - bek) > t) { hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b); }
  else console.log("  tamam      " + ad);
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

console.log("TCMB / BDDK parametreleri");
esit("kart tavani <30.000 akdi %3,25", P.kartTavani(20000).akdi, 0.0325, 1e-12);
esit("kart tavani 30-180k akdi %3,75", P.kartTavani(100000).akdi, 0.0375, 1e-12);
esit("kart tavani >180k akdi %4,25", P.kartTavani(200000).akdi, 0.0425, 1e-12);
esit("gecikme faizi <30.000 %3,55", P.kartTavani(20000).gecikme, 0.0355, 1e-12);
esit("asgari oran limit <=50.000 %20", P.asgariOran(50000), 0.20, 1e-12);
esit("asgari oran limit >50.000 %40", P.asgariOran(60000), 0.40, 1e-12);

console.log("\nTek borc, elle dogrulanabilir");
/* 10.000 TL, aylik %3, sabit 5.000 TL taksit.
   Ay1: faiz 300 -> 10.300, odeme 5.000 -> 5.300
   Ay2: faiz 159 -> 5.459,  odeme 5.000 -> 459
   Ay3: faiz 13,77 -> 472,77, odeme 472,77 -> 0
   Toplam faiz = 300 + 159 + 13,77 = 472,77 */
var t1 = M.simule([{ ad: "K", bakiye: 10000, faiz: 0.03, tur: "taksit", taksit: 5000 }], 5000, "cig");
esit("3 ayda kapaniyor", t1.ay, 3, 0);
esit("toplam faiz 472,77", t1.faizToplam, 472.77, 0.02);
esit("toplam odeme 10.472,77", t1.odemeToplam, 10472.77, 0.02);
esit("anapara + faiz = odeme", t1.anapara + t1.faizToplam, t1.odemeToplam, 0.02);

console.log("\nAsgari odeme tuzagi — faizi karsilamayan asgari");
/* Aylik faiz %5, asgari oran %2 -> bakiye her ay buyur. */
var tuzak = M.simule([{ ad: "Kart", bakiye: 50000, faiz: 0.05, tur: "kart", asgariOran: 0.02 }], 1200, "asgari");
dogru("kapanmiyor olarak isaretleniyor", tuzak.kapandi === false);
dogru("buyuyen borc tespit ediliyor", tuzak.buyuyenler.indexOf("Kart") > -1);

console.log("\nButce yetersizligi");
var yetersiz = M.planla([{ ad: "Kart", bakiye: 100000, faiz: 0.0375, tur: "kart", asgariOran: 0.20 }], 5000);
dogru("yetersiz butce reddediliyor", yetersiz.hata === "butce-yetersiz");
esit("gereken asgari 20.000", yetersiz.gerekenAsgari, 20000, 0.02);

console.log("\nStratejiler arasi degismezler");
var borclar = [
  { ad: "A", bakiye: 45000, faiz: 0.0375, tur: "kart", asgariOran: 0.20 },
  { ad: "B", bakiye: 12000, faiz: 0.0325, tur: "kart", asgariOran: 0.20 },
  { ad: "C", bakiye: 80000, faiz: 0.029, tur: "taksit", taksit: 3500 }
];
var p = M.planla(borclar, 20000);
dogru("uc strateji de kapaniyor", p.asgari.kapandi && p.cig.kapandi && p.kartopu.kapandi);
dogru("cig, asgariden az faiz odetir", p.cig.faizToplam < p.asgari.faizToplam);
dogru("cig, kartopundan fazla faiz odetmez", p.cig.faizToplam <= p.kartopu.faizToplam + 0.02);
dogru("en iyi strateji cig", p.enIyi === "cig");
dogru("tasarruf pozitif", p.tasarruf > 0);
[p.asgari, p.cig, p.kartopu].forEach(function (s, i) {
  esit("anapara+faiz=odeme (strateji " + i + ")", s.anapara + s.faizToplam, s.odemeToplam, 0.05);
});
dogru("cig, asgariden hizli biter", p.cig.ay < p.asgari.ay);

console.log("\nCig gercekten en yuksek faizliyi hedefliyor");
var c = M.planla([
  { ad: "Ucuz", bakiye: 10000, faiz: 0.01, tur: "kart", asgariOran: 0.20 },
  { ad: "Pahali", bakiye: 10000, faiz: 0.05, tur: "kart", asgariOran: 0.20 }
], 8000);
var pahaliKapanis = c.cig.borclar.filter(function (b) { return b.ad === "Pahali"; })[0].kapandiAy;
var ucuzKapanis = c.cig.borclar.filter(function (b) { return b.ad === "Ucuz"; })[0].kapandiAy;
dogru("pahali borc once kapaniyor", pahaliKapanis <= ucuzKapanis);

console.log("\nKartopu gercekten en kucugu hedefliyor");
var k = M.planla([
  { ad: "Buyuk", bakiye: 60000, faiz: 0.05, tur: "kart", asgariOran: 0.20 },
  { ad: "Kucuk", bakiye: 5000, faiz: 0.01, tur: "kart", asgariOran: 0.20 }
], 20000);
var kk = k.kartopu.borclar.filter(function (b) { return b.ad === "Kucuk"; })[0].kapandiAy;
var kb = k.kartopu.borclar.filter(function (b) { return b.ad === "Buyuk"; })[0].kapandiAy;
dogru("kucuk borc once kapaniyor", kk <= kb);
dogru("bu senaryoda kartopu cigdan pahali", k.kartopu.faizToplam >= k.cig.faizToplam);

console.log("\nButce arttikca sonuc kotulesmemeli");
var onceAy = Infinity, onceFaiz = Infinity;
for (var b = 15000; b <= 60000; b += 5000) {
  var s = M.planla(borclar, b);
  if (s.hata) continue;
  if (s.cig.ay > onceAy + 0.001 || s.cig.faizToplam > onceFaiz + 0.02) {
    hata++; console.error("  BASARISIZ  butce " + b + " TL'de sonuc kotulesti"); break;
  }
  onceAy = s.cig.ay; onceFaiz = s.cig.faizToplam;
}
if (!hata) console.log("  tamam      butce artinca sure ve faiz azaliyor");

console.log("\nGecersiz girdi");
dogru("borc yoksa hata", !!M.planla([], 5000).hata);
dogru("butce sifirsa hata", !!M.planla(borclar, 0).hata);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\nButun borc plani kontrolleri gecti.");
