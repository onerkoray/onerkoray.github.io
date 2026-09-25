#!/usr/bin/env node
/*
 * Veraset ve intikal vergisi — regresyon testleri.
 *
 * 1. 2026 tutarları tebliğle aynı (VİVK GT Seri 57): istisnalar ve
 *    dilimler. Değer değişirse bilinçli bir güncelleme olmalı.
 * 2. Tarife: dilim sınırlarında toplam vergi elle hesaplanmış değerlere
 *    eşit; ivazsız yakın akrabada tam yarısı.
 * 3. Miras payları TMK m.495–499: toplam 1, oranlar doğru.
 * 4. İstisna: çocuk ve eşe var, ana-babaya YOK; çocuksuz eşe iki katı.
 * 5. Vergisiz sınır tanımına uyuyor: sınırın bir lira altı sıfır vergi.
 *
 * Kullanım: node finans/veraset-test.js
 */
"use strict";

var path = require("path");
var V = require(path.join(__dirname, "veraset.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.005 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var P = V.parametre(2026);

/* 1. Tebliğ tutarları. */
gecer("çocuk ve eş istisnası", P.istisna.furugVeEs === 2907136);
gecer("çocuksuz eş istisnası", P.istisna.esFurugYoksa === 5817845);
gecer("ivazsız istisnası", P.istisna.ivazsiz === 66935);
gecer("dilim genişlikleri", P.dilimler.map(function (d) { return d[0]; }).join(",") === "3000000,7000000,15000000,30000000,");
gecer("veraset oranları", P.dilimler.map(function (d) { return d[1]; }).join(",") === "0.01,0.03,0.05,0.07,0.1");
gecer("ivazsız oranları", P.dilimler.map(function (d) { return d[2]; }).join(",") === "0.1,0.15,0.2,0.25,0.3");

/* 2. Tarife sınırlarında toplam vergi. */
var SINIR = [3e6, 10e6, 25e6, 55e6];
var VERASET = [30000, 240000, 990000, 3090000];
var IVAZSIZ = [300000, 1350000, 4350000, 11850000];
SINIR.forEach(function (s, i) {
  gecer("veraset " + s, yakin(V.vergi(s, "veraset").vergi, VERASET[i]), V.vergi(s, "veraset").vergi);
  gecer("ivazsız " + s, yakin(V.vergi(s, "ivazsiz").vergi, IVAZSIZ[i]), V.vergi(s, "ivazsiz").vergi);
  gecer("yakın ivazsız yarısı " + s, yakin(V.vergi(s, "ivazsiz", true).vergi, IVAZSIZ[i] / 2));
  gecer("veraset yakınlık indirimi almaz " + s, yakin(V.vergi(s, "veraset", true).vergi, VERASET[i]));
});
gecer("son dilim %10", yakin(V.vergi(56e6, "veraset").vergi - V.vergi(55e6, "veraset").vergi, 100000));
gecer("sıfır matrah sıfır vergi", V.vergi(0, "veraset").vergi === 0);

/* 3. Miras payları. */
function toplam(p) { return p.reduce(function (s, x) { return s + x.pay; }, 0); }
var aileler = [
  [{ es: true, cocuk: 2 }, { es: 0.25, cocuk: 0.375 }],
  [{ es: true, cocuk: 3 }, { es: 0.25, cocuk: 0.25 }],
  [{ es: false, cocuk: 4 }, { cocuk: 0.25 }],
  [{ es: true, cocuk: 0, ebeveyn: 2 }, { es: 0.5, ebeveyn: 0.25 }],
  [{ es: true, cocuk: 0, ebeveyn: 1 }, { es: 0.5, ebeveyn: 0.5 }],
  [{ es: false, cocuk: 0, ebeveyn: 2 }, { ebeveyn: 0.5 }],
  [{ es: true }, { es: 1 }]
];
aileler.forEach(function (a) {
  var p = V.paylar(a[0]);
  gecer("paylar toplamı 1 " + JSON.stringify(a[0]), yakin(toplam(p), 1, 1e-12));
  p.forEach(function (x) { gecer("pay " + x.kim + " " + JSON.stringify(a[0]), yakin(x.pay, a[1][x.kim], 1e-12)); });
});
gecer("mirasçısız reddedilir", atar(function () { V.paylar({ es: false, cocuk: 0, ebeveyn: 0 }); }));

/* 4. İstisnalar. */
var m1 = V.miras({ tereke: 8e6, aile: { es: true, cocuk: 2 } });
m1.mirascilar.forEach(function (x) { gecer("istisna 2.907.136 " + x.ad, x.istisna === 2907136); });
var m2 = V.miras({ tereke: 8e6, aile: { es: true, cocuk: 0, ebeveyn: 2 } });
gecer("çocuksuz eşe iki kat istisna", m2.mirascilar[0].istisna === 5817845);
gecer("ana-babaya istisna yok", m2.mirascilar.filter(function (x) { return x.kim === "ebeveyn"; }).every(function (x) { return x.istisna === 0; }));
gecer("ana-baba ilk liradan vergilenir", yakin(m2.mirascilar[1].vergi, 2e6 * 0.01));
gecer("toplam vergi mirasçıların toplamı", yakin(m1.toplamVergi, m1.mirascilar.reduce(function (s, x) { return s + x.vergi; }, 0)));
gecer("taksit altıda bir", yakin(m1.mirascilar[1].taksit * 6, m1.mirascilar[1].vergi));

/* Tereke: borç ve cenaze düşülür, eksiye inmez. */
var t = V.tereke({ tasinmaz: 5e6, mevduat: 1e6, arac: 5e5, diger: 0, borc: 7e5, cenaze: 5e4 });
gecer("tereke net", t.net === 5e6 + 1e6 + 5e5 - 7e5 - 5e4);
gecer("borç terekeyi aşarsa sıfır", V.tereke({ mevduat: 1e5, borc: 5e5 }).net === 0);

/* 5. Vergisiz sınır. */
[{ es: true, cocuk: 1 }, { es: true, cocuk: 2 }, { es: true, cocuk: 3 }, { es: false, cocuk: 2 }, { es: true }].forEach(function (a) {
  var s = V.vergisizSinir(a);
  gecer("sınırın altı vergisiz " + JSON.stringify(a), V.miras({ tereke: s - 1, aile: a }).toplamVergi === 0);
  gecer("sınırın üstü vergili " + JSON.stringify(a), V.miras({ tereke: s + 1000, aile: a }).toplamVergi > 0);
});
gecer("ana-baba mirasçıysa sınır sıfır", V.vergisizSinir({ es: true, cocuk: 0, ebeveyn: 2 }) === 0);

/* Bağış. */
var b = V.bagis({ deger: 3e6, yakin: true });
gecer("bağış istisnası düşülür", b.matrah === 3e6 - 66935);
gecer("bağış yakın: %5", yakin(b.vergi, (3e6 - 66935) * 0.05));
gecer("bağış yakın değil: iki katı", yakin(V.bagis({ deger: 3e6 }).vergi, 2 * b.vergi));
gecer("istisna altı bağış vergisiz", V.bagis({ deger: 66935, yakin: true }).vergi === 0);
gecer("tanımsız yıl reddedilir", atar(function () { V.parametre(2019); }));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (veraset)");
process.exit(kalan ? 1 : 0);
