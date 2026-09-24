#!/usr/bin/env node
/*
 * "Şahıs mı, limited mi, maaşlı mı?" yazısının düzyazıdaki iddiaları.
 *
 * İki tabloyu tools/bordro-tablo.js çalışma biçimi motorundan
 * (bordro/calisma-bicimi.js) yazıyor. Düzyazı ise bu tabloların ÖZETİNİ
 * söylüyor: hangi gelir bandında kim önde, fark ne kadar. Tablo her yıl
 * yeniden üretilir, özet üretilmez. Bu test özeti aynı taramayla
 * (400 bin – 12 milyon, 100 bin adım, 200 bin gider) yeniden kurar.
 *
 * 2026-09-24: yazı Bağ-Kur'u indirimsiz tutarla (137.700 TL) anlatıyor ve
 * "5 puanlık prim indirimi"ni kapsam dışı sayıyordu. Oysa tablolar ve
 * araç indirimi varsayılan olarak uyguluyor. Metin hesaba uyduruldu:
 * indirimle 117.900 TL, indirimsiz tutar parantezde.
 *
 * Kullanım: node makaleler/sahis-mi-limited-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var CB = require(path.join(S.KOK, "bordro", "calisma-bicimi.js"));
var t = S.yazi(__dirname);

var YIL = 2026, P = B.parametre(YIL), SP = P.sirket, GIDER = 200000;

function tara(ihracat) {
  var out = [];
  for (var m = 400000; m <= 12000000; m += 100000) {
    var r = CB.karsilastir({ yil: YIL, yillikMaliyet: m, yillikGider: GIDER, ihracatOrani: ihracat });
    var h = {}; r.senaryolar.forEach(function (x) { h[x.kod] = x; });
    var ikinci = r.senaryolar.slice().sort(function (a, b) { return b.net - a.net; })[1];
    var sahis = h.sahis.net, ltd = Math.max(h.limited.net, h.limitedUcret.net);
    out.push({ m: m, kazanan: r.enIyi.kod, fark: (r.enIyi.net - ikinci.net) / r.enIyi.net,
      sahisLtd: Math.abs(sahis - ltd) / Math.max(sahis, ltd) });
  }
  return out;
}
function aralik(liste, a, b) { return liste.filter(function (x) { return x.m >= a && x.m <= b; }); }
function hepsi(liste, f) { return liste.length > 0 && liste.every(f); }

var normal = tara(0);

/* "500 bin ile 1,3 milyon arasında maaşlı çalışma önde; 500 binde fark %22" */
t.dogru("500 bin – 1,2 milyon çalışan önde", hepsi(aralik(normal, 500000, 1200000), function (x) { return x.kazanan === "calisan"; }));
t.dogru("1,3 milyonda çalışan artık önde değil", aralik(normal, 1300000, 1300000)[0].kazanan !== "calisan");
t.gecsin("500 binde fark", "500 bin TL düzeyinde fark %" + Math.round(aralik(normal, 500000, 500000)[0].fark * 100));

/* "1,7 milyonun üstünde şahıs–limited farkı çoğu noktada %3'ün altında" */
var ust = aralik(normal, 1700000, 12000000);
var altinda = ust.filter(function (x) { return x.sahisLtd < 0.03; }).length;
t.dogru("1,7 milyon üstü: çoğu noktada %3'ün altı", altinda / ust.length > 0.5, altinda + "/" + ust.length);

/* "4,7 ile 7,3 milyon arasında fark binde birlere iniyor" — şahıs önde, fark %1'in altında. */
var dar = aralik(normal, 4700000, 7200000);
t.dogru("4,7–7,2 milyon şahıs önde", hepsi(dar, function (x) { return x.kazanan === "sahis"; }));
t.dogru("4,7–7,2 milyon fark binde düzeyinde", hepsi(dar, function (x) { return x.fark < 0.01; }));
t.dogru("7,3 milyonda kazanan değişiyor", aralik(normal, 7300000, 7300000)[0].kazanan !== "sahis");

/* Hizmet ihracatı: şahıs 900 binden itibaren önde, yaklaşık %6. */
var ihr = tara(1);
t.dogru("ihracatta 800 binde şahıs önde değil", aralik(ihr, 800000, 800000)[0].kazanan !== "sahis");
t.dogru("ihracatta 900 bin – 3 milyon şahıs önde", hepsi(aralik(ihr, 900000, 3000000), function (x) { return x.kazanan === "sahis"; }));
t.gecsin("ihracatta 900 bindeki fark", "yaklaşık %" + Math.round(aralik(ihr, 900000, 900000)[0].fark * 100) + " önüne");
t.gecsin("ihracat indirimi oranı", "kazancın %" + Math.round(SP.hizmetIhracatiIndirimi * 100) + "'i beyannamede");

/* Parametre cümleleri. */
var kv = SP.kurumlarVergisi, st = SP.karPayiStopaji;
var yuk = 100 * kv + 100 * (1 - kv) * st;
t.gecsin("kurumlar vergisi", "%" + Math.round(kv * 100) + " kurumlar vergisi");
t.gecsin("kâr payı stopajı", "kâr payından %" + Math.round(st * 100) + " stopaj");
t.gecsin("toplam yük", "100 TL kâr için toplam yük " + yuk.toFixed(2).replace(".", ",") + " TL");
t.gecsin("stopaj adımı", "kalan " + 100 * (1 - kv) + " TL'de " + (100 * (1 - kv) * st).toFixed(2).replace(".", ",") + " TL stopaj");
t.gecsin("serbest meslek stopajı", "kurumlara %" + Math.round(SP.serbestMeslekStopaji * 100) + " stopaj");
t.gecsin("işveren primi", "yaklaşık %" + S.yuzde(P.oranlar.sgkIsveren + P.oranlar.issizlikIsveren) + " prim");

var asgari = P.donemler[0].asgariBrut;
var bkIndirimli = CB.bagkurYillik(P, asgari, true).yillik, bkTam = CB.bagkurYillik(P, asgari, false).yillik;
function yuzluk(n) { return (Math.round(n / 100) * 100).toLocaleString("tr-TR"); }
t.gecsin("Bağ-Kur indirimli", "yıllık yaklaşık " + yuzluk(bkIndirimli) + " TL");
t.gecsin("Bağ-Kur indirimsiz", "indirimsiz " + yuzluk(bkTam) + " TL");
t.dogru("600 binde Bağ-Kur beşte bir civarı", Math.abs(bkIndirimli / 600000 - 0.2) < 0.01, (bkIndirimli / 600000).toFixed(3));
t.gecmesin("eski indirimsiz iddia", "gelirinin dörtte birine yakındır");

t.bitir();
