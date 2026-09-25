#!/usr/bin/env node
/*
 * TÜFE endeksi — regresyon testleri.
 *
 * Seri her gece değişebildiği için testler SABİT SAYI değil İLİŞKİ sınar:
 * zincirleme hatası sınırda mı, çarpanlar birleşiyor mu, aralık yıllık
 * oranlar serinin resmî yıllık oranlarıyla aynı mı, ikiye katlanma süresi
 * tanımına uyuyor mu. Yeni bir ayın verisi bozuk gelirse (ör. yüzde yerine
 * binde) sapma kontrolü kırmızıya döner.
 *
 * Kullanım: node finans/tufe-endeksi-test.js
 */
"use strict";

var path = require("path");
var E = require(path.join(__dirname, "tufe-endeksi.js"));
var T = require(path.join(__dirname, "tufe-serisi.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var AY = E.aylar();

/* Kapsam. */
gecer("seri 2005 Ocak'tan başlıyor", E.ilkAy === "2005-01");
gecer("seri kesintisiz", AY.every(function (a, i) {
  if (i === 0) return true;
  var p = AY[i - 1], y = +p.slice(0, 4), m = +p.slice(5);
  var beklenen = m === 12 ? (y + 1) + "-01" : y + "-" + String(m + 1).padStart(2, "0");
  return a === beklenen;
}), AY.length + " ay");

/* Zincirleme hatası: yuvarlanmış aylıkların çarpımı resmî yıllıktan
   kopmamalı. Ölçülen: ortalama 0,008, en çok 0,037 puan. */
var s = E.yillikSapma();
gecer("12 aylık zincir resmî yıllıkla uyumlu (ortalama)", s.ortalama < 0.02, s.ortalama.toFixed(4));
gecer("12 aylık zincir resmî yıllıkla uyumlu (en kötü ay)", Math.abs(s.enCok) < 0.1, s.enCok.toFixed(4) + " " + s.ay);

/* Çarpan cebri. */
var a = "2010-03", b = "2018-07", c = E.sonAy;
gecer("aynı ay çarpanı 1", yakin(E.carpan(a, a), 1));
gecer("çarpanlar birleşir", yakin(E.carpan(a, b) * E.carpan(b, c), E.carpan(a, c), 1e-9));
gecer("ters yön tersi", yakin(E.carpan(c, a) * E.carpan(a, c), 1, 1e-12));
gecer("değer gidiş-dönüş", yakin(E.deger(E.deger(1000, a, c), c, a), 1000, 1e-9));
gecer("bir aylık çarpan serinin aylığı", yakin(E.carpan("2024-01", "2024-02"), 1 + T.aylar["2024-02"].aylik / 100, 1e-12));

/* Aralık–Aralık çarpanı serinin yıllık oranıyla aynı olmalı (zincir
   toleransı içinde). */
AY.filter(function (x) { return x.slice(5) === "12" && x > "2005-12"; }).forEach(function (x) {
  var onceki = (+x.slice(0, 4) - 1) + "-12";
  var z = (E.carpan(onceki, x) - 1) * 100;
  gecer("Aralık–Aralık " + x.slice(0, 4), yakin(z, T.aylar[x].yillik, 0.1), z.toFixed(3) + " vs " + T.aylar[x].yillik);
});

/* Dönem özeti tutarlı. */
var d = E.donem("2020-01", c);
gecer("dönem ay sayısı", d.ay === E.aySayisi("2020-01", c));
gecer("yıllıklaştırılmış oran çarpanı verir", yakin(Math.pow(1 + d.yillik, d.ay / 12), d.carpan, 1e-9));
gecer("alım gücü kaybı tanımı", yakin(1 - d.alimGucuKaybi, 1 / d.carpan, 1e-12));
var ys = E.yillar("2019-12", "2022-12");
gecer("aralık yılları", ys.map(function (y) { return y.yil; }).join(",") === "2020,2021,2022");

/* İkiye katlanma: tanım kontrolü, her ayda. */
var tanimli = 0, ihlal = 0;
AY.forEach(function (x) {
  var k = E.ikiyeKatlanma(x);
  if (k === null) return;
  tanimli++;
  var i = AY.indexOf(x);
  if (!(E.carpan(AY[i - k], x) >= 2 && E.carpan(AY[i - k + 1], x) < 2)) ihlal++;
});
gecer("ikiye katlanma tanımına uyuyor", ihlal === 0 && tanimli > 100, tanimli + " ay, " + ihlal + " ihlal");

/* Geçersiz girdi. */
gecer("seri dışı ay reddedilir", atar(function () { E.carpan("2004-12", c); }));
gecer("ters dönem reddedilir", atar(function () { E.donem(c, "2020-01"); }));
gecer("sayı olmayan tutar reddedilir", atar(function () { E.deger("x", a, b); }));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (TÜFE endeksi)");
process.exit(kalan ? 1 : 0);
