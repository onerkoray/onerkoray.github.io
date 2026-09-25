#!/usr/bin/env node
/*
 * Asgari ücret zammı senaryosu — regresyon testleri.
 *
 * Özdeşlikler sınanır:
 *   - dört etkinin toplamı toplam net değişimdir
 *   - sıfır senaryoda varsayımsal yıl bu yılın aynısıdır; türetilen net
 *     asgari ücret resmî tutara eşittir
 *   - asgari ücretlinin her ayki neti brütün %85'idir (istisna tam korur)
 *   - SGK tavanı = asgari ücret × tavan katsayısı
 *   - dilimler asgari ücretten g kadar az artarsa, ikinci eşiği geçen ama
 *     üçüncüye varmayan ücretlinin kaybı ikinci eşik × g × oran farkıdır;
 *     birinci eşiğin etkisini istisna nötrler
 *   - modül bu yılın parametrelerini değiştirmez
 *
 * Kullanım: node bordro/asgari-senaryo-test.js
 */
"use strict";

var path = require("path");
var A = require(path.join(__dirname, "asgari-senaryo.js"));
var B = require(path.join(__dirname, "motor.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var P = B.parametre(A.bazYil());
var d0 = P.donemler[P.donemler.length - 1], o = P.oranlar;
var once = JSON.stringify(P);

/* Sıfır senaryo */
var z = A.hesapla({ asgariArtis: 0, tarifeArtis: 0, brut: 90000, ucretArtis: 0 });
gecer("sıfır: hedef yıl baz + 1", z.hedef === P.yil + 1);
gecer("sıfır: türetilen net asgari resmî tutar", yakin(z.asgari.yeni.net, d0.asgariNet, 0.005), z.asgari.yeni.net + " / " + d0.asgariNet);
gecer("sıfır: tavan aynı", yakin(z.asgari.yeni.tavan, d0.sgkTavan));
gecer("sıfır: dilimler aynı", JSON.stringify(z.dilimler.yeni) === JSON.stringify(P.dilimler));
gecer("sıfır: net değişmez", yakin(z.ucret.netDegisim, 0));
gecer("sıfır: etkiler sıfır", z.ucret.etkiler.every(function (e) { return yakin(e.net, 0); }));
gecer("sıfır: motorla aynı yıllık net", yakin(z.ucret.eski.toplam.net, B.hesaplaYil(90000, P.yil).toplam.net));

/* Senaryolar */
var SENARYOLAR = [[0.25, 0.25], [0.25, 0.15], [0.30, 0.20], [0.35, 0.25], [0.20, 0.30], [0.4, 0.1]];
var UCRETLER = [d0.asgariBrut, 45000, 60000, 100000, 200000, 400000];
SENARYOLAR.forEach(function (s) {
  var ad = "%" + s[0] * 100 + "/%" + s[1] * 100;
  var r0 = A.hesapla({ asgariArtis: s[0], tarifeArtis: s[1] });
  gecer(ad + " asgari brüt", yakin(r0.asgari.yeni.brut, Math.round(d0.asgariBrut * (1 + s[0]) * 100) / 100, 1e-9));
  gecer(ad + " net asgari = brüt × (1 − işçi primleri)", yakin(r0.asgari.yeni.net, r0.asgari.yeni.brut * (1 - o.sgkIsci - o.issizlikIsci), 0.006));
  gecer(ad + " tavan = asgari × katsayı", yakin(r0.asgari.yeni.tavan, r0.asgari.yeni.brut * P.tavanKatsayisi, 0.006));
  gecer(ad + " dilimler endekslendi", r0.dilimler.yeni.every(function (x, i) {
    return x[1] === P.dilimler[i][1] && (x[0] === null ? P.dilimler[i][0] === null : yakin(x[0], P.dilimler[i][0] * (1 + s[1])));
  }));
  var asg = A.hesapla({ asgariArtis: s[0], tarifeArtis: s[1], brut: d0.asgariBrut });
  gecer(ad + " asgari ücretli her ay net asgari", asg.ucret.yeni.aylar.every(function (a) { return yakin(a.net, r0.asgari.yeni.net, 0.006); }));
  gecer(ad + " asgari ücretlinin net artışı asgari artışı", yakin(asg.ucret.netArtis, s[0], 1e-6));
  UCRETLER.forEach(function (b) {
    var r = A.hesapla({ asgariArtis: s[0], tarifeArtis: s[1], brut: b });
    var top = r.ucret.etkiler.reduce(function (t, e) { return t + e.net; }, 0);
    gecer(ad + " " + b + " etkiler toplamı", yakin(top, r.ucret.netDegisim, 1e-4));
    gecer(ad + " " + b + " son adım tam senaryo", yakin(r.ucret.yeni.toplam.net, A.yil12(r.ucret.yeniBrut, A.parametre(s[0], s[1])).toplam.net));
    gecer(ad + " " + b + " eşit endeks farkı tanımı", yakin(r.ucret.endeksFarki, r.ucret.esitEndeksNet - r.ucret.yeni.toplam.net, 1e-6));
    if (b < d0.sgkTavan / (1 + s[0]) * 0.99 && b * (1 + s[0]) < d0.sgkTavan) {
      gecer(ad + " " + b + " tavan altı: tavan etkisi yok", yakin(r.ucret.etkiler[3].net, 0));
    }
  });
});

/* Kayma kuralı: ikinci eşik × fark × (3. oran − 2. oran) */
var e2 = P.dilimler[1][0], of = P.dilimler[2][1] - P.dilimler[1][1];
[[0.25, 0.15], [0.30, 0.20], [0.35, 0.30], [0.30, 0.25]].forEach(function (s) {
  [60000, 100000].forEach(function (b) {
    var r = A.hesapla({ asgariArtis: s[0], tarifeArtis: s[1], brut: b });
    var ym = r.ucret.yeni.toplam.brut - r.ucret.yeni.toplam.sgk - r.ucret.yeni.toplam.issizlik;
    var ikinciyiGecer = ym > e2 * (1 + s[0]) && ym < P.dilimler[2][0] * (1 + s[1]);
    gecer("kayma kuralı ön koşul " + b + " " + s.join("/"), ikinciyiGecer);
    gecer("kayma kuralı " + b + " " + s.join("/"), yakin(r.ucret.endeksFarki, e2 * (s[0] - s[1]) * of, 0.01), r.ucret.endeksFarki.toFixed(2));
  });
});
/* Homojenlik: ücret, asgari ücret ve dilimler aynı oranda artarsa net de aynı oranda artar */
[0.1, 0.25, 0.4].forEach(function (k) {
  UCRETLER.forEach(function (b) {
    var r = A.hesapla({ asgariArtis: k, tarifeArtis: k, brut: b, ucretArtis: k });
    gecer("homojenlik %" + k * 100 + " " + b, yakin(r.ucret.netArtis, k, 1e-6), (r.ucret.netArtis * 100).toFixed(6));
  });
});

/* Eşit endekste fark yok */
gecer("eşit endekste fark yok", yakin(A.hesapla({ asgariArtis: 0.3, tarifeArtis: 0.3, brut: 150000 }).ucret.endeksFarki, 0));

/* Yön: tarife daha çok artarsa net azalmaz */
var n1 = A.hesapla({ asgariArtis: 0.3, tarifeArtis: 0.1, brut: 100000 }).ucret.yeni.toplam.net;
var n2 = A.hesapla({ asgariArtis: 0.3, tarifeArtis: 0.3, brut: 100000 }).ucret.yeni.toplam.net;
gecer("tarife artışı neti artırır", n2 > n1);
/* Tavanın üstündeki ücretlide tavan artışı neti düşürür */
var yuk = A.hesapla({ asgariArtis: 0.3, tarifeArtis: 0.3, brut: 400000 });
gecer("tavan üstünde tavan etkisi negatif", yuk.ucret.etkiler[3].net < 0);

/* Asgari ücret matrahının dilimi */
var ad0 = A.asgariDilimi(P);
gecer("asgari matrah = brüt × 0,85 × 12", yakin(ad0.matrah, d0.asgariBrut * (1 - o.sgkIsci - o.issizlikIsci) * 12));
gecer("asgari matrahın dilimi tarifeden", ad0.matrah > P.dilimler[ad0.dilim - 1 < 0 ? 0 : ad0.dilim - 1][0] || ad0.dilim === 0);

/* Ücret artışı verilmezse asgari artışı kullanılır */
var v = A.hesapla({ asgariArtis: 0.2, tarifeArtis: 0.2, brut: 50000 });
gecer("varsayılan ücret artışı = asgari artışı", yakin(v.ucret.brutArtis, 0.2, 1e-9));

/* Hatalı girdi */
gecer("asgari artışı sayı olmalı", atar(function () { A.hesapla({ asgariArtis: "x", tarifeArtis: 0.1 }); }));
gecer("tarife artışı üst sınır", atar(function () { A.hesapla({ asgariArtis: 0.1, tarifeArtis: 5 }); }));
gecer("brüt 0 reddedilir", atar(function () { A.hesapla({ asgariArtis: 0.1, tarifeArtis: 0.1, brut: 0 }); }));

/* Bu yılın parametreleri değişmedi */
gecer("baz parametreler değişmedi", JSON.stringify(P) === once);

console.log(gecen + " geçti, " + kalan + " kaldı. (asgari ücret zammı senaryosu)");
process.exit(kalan ? 1 : 0);
