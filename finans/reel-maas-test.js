#!/usr/bin/env node
/*
 * Reel maaş — regresyon testleri.
 *
 * Özdeşlikler sınanır, sabit sayılar değil (TÜFE serisi her gece
 * uzayabilir; geçmiş aylar değişmez):
 *   - reel değişim = nominal oran / fiyat çarpanı
 *   - olması gereken net × (1 + reel) = yeni net × ... tutarlılığı
 *   - vergi etkisi = (1 − yeni kesinti) / (1 − eski kesinti) − 1
 *   - resmî net asgari ücret girilince asgari katı tam 1
 *   - brüt asgari ücretin OCAK neti resmî net asgari ücret
 *
 * Kullanım: node finans/reel-maas-test.js
 */
"use strict";

var path = require("path");
var R = require(path.join(__dirname, "reel-maas.js"));
var E = require(path.join(__dirname, "tufe-endeksi.js"));
var B = require(path.join(__dirname, "..", "bordro", "motor.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var r = R.karsilastir({ eski: { ay: "2023-01", tutar: 30000, tur: "net" }, yeni: { ay: "2026-08", tutar: 60000, tur: "net" } });
gecer("fiyat çarpanı TÜFE endeksinden", yakin(r.fiyatCarpani, E.carpan("2023-01", "2026-08")));
gecer("nominal değişim", yakin(r.nominalDegisim, 1));
gecer("reel değişim tanımı", yakin(1 + r.reelDegisim, 2 / r.fiyatCarpani));
gecer("olması gereken net", yakin(r.gerekenNet, 30000 * r.fiyatCarpani));
gecer("açık = gereken − yeni", yakin(r.acik, r.gerekenNet - 60000));
gecer("yıllık reel bileşik", yakin(Math.pow(1 + r.yillikReel, r.donem.ay / 12), 1 + r.reelDegisim, 1e-9));

/* Asgari ücret: resmî net girilince katı 1; brüt asgarinin her dönem başı neti resmî net. */
R.bordroYillari().forEach(function (y) {
  var P = B.parametre(y);
  P.donemler.forEach(function (d) {
    var ay = y + "-" + String(d.ay).padStart(2, "0");
    if (!E.gecerli(ay)) return;
    gecer("asgari net " + ay, yakin(R.asgariNet(ay), d.asgariNet));
    var x = R.karsilastir({ eski: { ay: ay, tutar: d.asgariNet, tur: "net" }, yeni: { ay: E.sonAy, tutar: 1, tur: "net" } });
    gecer("asgari katı 1 " + ay, yakin(x.eski.asgariKati, 1));
  });
  /* Ocak: brüt asgari ücretin neti resmî net asgari ücrete eşit (2021
     ilave AGİ, 2022+ istisna sayesinde). */
  var ocak = y + "-01";
  if (E.gecerli(ocak) && y >= 2021) {
    gecer("brüt asgarinin ocak neti " + y, yakin(R.brutNet(P.donemler[0].asgariBrut, ocak).net, P.donemler[0].asgariNet, 0.01),
      R.brutNet(P.donemler[0].asgariBrut, ocak).net + " vs " + P.donemler[0].asgariNet);
  }
});

/* Brüt uçlar: vergi etkisi kesinti oranlarından da bulunmalı. */
var b = R.karsilastir({ eski: { ay: "2022-01", tutar: 15000, tur: "brut" }, yeni: { ay: "2026-08", tutar: 100000, tur: "brut" } });
gecer("brüt ucun neti bordrodan", yakin(b.eski.net, B.hesaplaYil(15000, 2022).aylar[0].net));
gecer("yeni brüt ucun neti ağustos bordrosu", yakin(b.yeni.net, B.hesaplaYil(100000, 2026).aylar[7].net));
gecer("vergi etkisi = kesinti oranı değişimi",
  yakin(1 + b.vergiEtkisi, (1 - b.yeni.kesinti) / (1 - b.eski.kesinti), 1e-12));
gecer("net reel = brüt reel × vergi etkisi",
  yakin(1 + b.reelDegisim, (1 + b.brutReel) * (1 + b.vergiEtkisi), 1e-12));
gecer("net girildiğinde vergi etkisi yok", r.vergiEtkisi === undefined);

/* Geçersiz girdi. */
gecer("bordro yılı dışında brüt reddedilir", atar(function () {
  R.karsilastir({ eski: { ay: "2015-01", tutar: 5000, tur: "brut" }, yeni: { ay: "2026-01", tutar: 1, tur: "net" } });
}));
gecer("ters sıra reddedilir", atar(function () {
  R.karsilastir({ eski: { ay: "2026-01", tutar: 1, tur: "net" }, yeni: { ay: "2025-01", tutar: 1, tur: "net" } });
}));
gecer("sıfır tutar reddedilir", atar(function () {
  R.karsilastir({ eski: { ay: "2025-01", tutar: 0, tur: "net" }, yeni: { ay: "2026-01", tutar: 1, tur: "net" } });
}));
gecer("seri dışı ay reddedilir", atar(function () {
  R.karsilastir({ eski: { ay: "2004-01", tutar: 1, tur: "net" }, yeni: { ay: "2026-01", tutar: 1, tur: "net" } });
}));
gecer("2020 öncesi net kabul edilir, asgari katı yok", (function () {
  var x = R.karsilastir({ eski: { ay: "2015-06", tutar: 3000, tur: "net" }, yeni: { ay: "2026-01", tutar: 50000, tur: "net" } });
  return x.eski.asgariKati === null && isFinite(x.reelDegisim);
})());

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (reel maaş)");
process.exit(kalan ? 1 : 0);
