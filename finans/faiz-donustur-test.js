#!/usr/bin/env node
/*
 * Faiz dönüştürücü — regresyon testleri.
 *
 *   - dört biçim arasında gidiş-dönüş aynı oranı verir
 *   - kredi maliyeti kredi aracının brutOran'ıyla aynı; konut vergisiz
 *   - mevduat neti mevduat fonksiyonuyla aynı; stopaj kademeleri
 *   - reel faiz tanımı; bileşik ≥ basit (pozitif oranda)
 *
 * Kullanım: node finans/faiz-donustur-test.js
 */
"use strict";

var path = require("path");
var Z = require(path.join(__dirname, "faiz-donustur.js"));
var KH = require(path.join(__dirname, "..", "kredi-hesaplama", "hesap.js"));
var F = require(path.join(__dirname, "kurallar.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-12 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

/* Gidiş-dönüş: her türden her türe */
[0.005, 0.03, 0.0425, 0.1, -0.01].forEach(function (a) {
  var d = Z.donustur(a, "aylik");
  Z.TURLER.forEach(function (tur) {
    var geri = Z.donustur(d[tur], tur);
    gecer("gidiş-dönüş " + a + " " + tur, yakin(geri.aylik, a, 1e-12), String(geri.aylik));
  });
  gecer("yıllık basit = aylık × 12 (" + a + ")", yakin(d.yillikBasit, a * 12));
  gecer("bileşik tanımı (" + a + ")", yakin(d.yillikBilesik, Math.pow(1 + a, 12) - 1));
  if (a > 0) gecer("pozitifte bileşik > basit (" + a + ")", d.yillikBilesik > d.yillikBasit);
});
var uc = Z.donustur(0.03, "aylik");
gecer("aylık %3 → yıllık bileşik %42,58", yakin(uc.yillikBilesik, 0.4257608868461793, 1e-12), String(uc.yillikBilesik));
gecer("ikiye katlanma ln2 ÷ ln(1+y)", yakin(uc.ikiyeKatlanmaYil, Math.log(2) / Math.log(1.03) / 12, 1e-12));
gecer("sıfır ve negatif oranda ikiye katlanma yok", Z.donustur(0, "aylik").ikiyeKatlanmaYil === null && Z.donustur(-0.01, "aylik").ikiyeKatlanmaYil === null);

/* Kredi */
var ih = Z.kredi(0.0399, "ihtiyac");
gecer("ihtiyaç: KKDF %15 + BSMV %15 → × 1,30", yakin(ih.aylikMaliyet, 0.0399 * 1.3, 1e-15));
gecer("kredi aracının brutOran'ı ile aynı", yakin(ih.aylikMaliyet, KH.brutOran(3.99, 15, 15), 1e-15));
gecer("vergi payı %30 ÷ 130", yakin(ih.vergiPayi, 0.3 / 1.3, 1e-12));
var ko = Z.kredi(0.0299, "konut");
gecer("konut kredisi vergisiz", yakin(ko.aylikMaliyet, 0.0299) && ko.vergiPayi === 0);
var ti = Z.kredi(0.03, "ticari");
gecer("ticari: yalnız BSMV %5", yakin(ti.aylikMaliyet, 0.03 * 1.05, 1e-15));
gecer("elle girilen vergi oranı", yakin(Z.kredi(0.03, "ihtiyac", 0, 10).aylikMaliyet, 0.033, 1e-15));
gecer("kredi yıllık bileşik", yakin(ih.yillikBilesik, Math.pow(1 + 0.0399 * 1.3, 12) - 1));

/* Mevduat */
[[32, 0.175], [92, 0.175], [181, 0.175], [182, 0.15], [365, 0.15], [366, 0.10]].forEach(function (k) {
  var m = Z.mevduat(0.37, k[0]);
  gecer("mevduat stopajı " + k[0] + " gün", m.stopajOrani === k[1]);
  gecer("vade neti mevduat() ile aynı " + k[0], yakin(m.vadeNet, F.mevduat(1e6, 37, k[0], "2026-01-01", "tl").net / 1e6, 1e-12));
  gecer("vade neti = brüt × gün/365 × (1 − stopaj) " + k[0], yakin(m.vadeNet, 0.37 * k[0] / 365 * (1 - k[1]), 1e-12));
  gecer("yenilemeli bileşik tanımı " + k[0], yakin(m.yillikNetBilesik, Math.pow(1 + m.vadeNet, 365 / k[0]) - 1, 1e-12));
});
gecer("365 günde yıllık net basit = brüt × 0,85", yakin(Z.mevduat(0.37, 365).yillikNetBasit, 0.3145, 1e-12));
gecer("sıfır faizli mevduat", Z.mevduat(0, 32).vadeNet === 0);

/* Reel */
gecer("reel tanımı", yakin(Z.reel(0.40, 0.30), 1.4 / 1.3 - 1));
gecer("nominal = enflasyon ⇒ reel 0", yakin(Z.reel(0.315, 0.315), 0));
gecer("nominal < enflasyon ⇒ reel negatif", Z.reel(0.2, 0.3) < 0);

/* Hatalı girdi */
gecer("bilinmeyen tür", atar(function () { Z.donustur(0.1, "haftalik"); }));
gecer("yıllık bileşik −%100", atar(function () { Z.donustur(-1, "yillikBilesik"); }));
gecer("negatif kredi faizi", atar(function () { Z.kredi(-0.01, "ihtiyac"); }));
gecer("vade 0", atar(function () { Z.mevduat(0.3, 0); }));
gecer("sayı olmayan oran", atar(function () { Z.donustur(NaN, "aylik"); }));

console.log(gecen + " geçti, " + kalan + " kaldı. (faiz dönüştürücü)");
process.exit(kalan ? 1 : 0);
