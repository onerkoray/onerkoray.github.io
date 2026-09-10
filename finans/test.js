"use strict";
var assert = require("node:assert/strict");
var F = require("./kurallar.js");
var n = 0;
function check(name, fn) { fn(); n++; }
check("2026 mevduat referans sonucu", function () {
  var r = F.mevduat(100000, 45, 32, "2026-09-10", "tl");
  assert.equal(r.taxPct, 17.5); assert.equal(r.net.toFixed(2), "3254.79");
  assert.equal(r.maturity.toFixed(2), "103254.79");
});
check("Altı ay sınırı takvim ayı; ertesi gün yeni dilim", function () {
  assert.equal(F.mevduat(1000, 30, 181, "2026-01-01", "tl").taxPct, 17.5);
  assert.equal(F.mevduat(1000, 30, 182, "2026-01-01", "tl").taxPct, 15);
});
check("Yıl sınırı ve artık yıl", function () {
  assert.equal(F.mevduat(1000, 30, 366, "2028-01-01", "tl").taxPct, 15);
  assert.equal(F.mevduat(1000, 30, 367, "2028-01-01", "tl").taxPct, 10);
});
check("Ay sonunda altı ay sınırı", function () {
  assert.equal(F.mevduat(1000, 30, 181, "2025-08-31", "tl").taxPct, 17.5);
  assert.equal(F.mevduat(1000, 30, 182, "2025-08-31", "tl").taxPct, 15);
});
check("Döviz stopajı", function () { assert.equal(F.mevduat(1000, 5, 400, "2026-09-10", "doviz").taxPct, 25); });
check("Desteklenmeyen tarih ve geçersiz giriş reddedilir", function () {
  assert.throws(function () { F.mevduat(1000, 45, 32, "2024-01-01", "tl"); });
  assert.throws(function () { F.mevduat(1000, -45, 32, "2026-09-10", "tl"); });
  assert.throws(function () { F.mevduat(1000, 45, 1.5, "2026-09-10", "tl"); });
  assert.throws(function () { F.mevduat(1000, 45, 32, "2026-02-30", "tl"); });
});
check("İş yeri dahil TÜFE tavanı", function () { assert.deepEqual(F.kira(20000, 38, 60), {rate:38,rent:27600,limited:true}); });
check("Düşük sözleşme oranı ve sıfır oran korunur", function () {
  assert.equal(F.kira(20000, 38, 20).rent, 24000); assert.equal(F.kira(20000, 38, 0).rent, 20000);
  assert.equal(F.kira(20000, 38, null).rent, 27600);
});
check("Eksik ve negatif oran tahmin edilmez", function () {
  assert.throws(function () { F.kira(20000, NaN, 60); }); assert.throws(function () { F.kira(20000, 38, -5); });
});
check("Ondalıklı döviz kuru 100 kat büyümez", function () {
  assert.equal(F.sayi("54.25", true), 54.25); assert.equal(F.sayi("1.234,56", false), 1234.56);
  assert.equal(F.sayi("1.5", true), 1.5); assert.ok(Number.isNaN(F.sayi("12abc", false)));
});
check("İthalatta yalnızca bilinen masraflar toplanır", function () {
  assert.equal(F.ithalat(50, 54.25, 100, 500, 200), 3512.5);
  assert.throws(function () { F.ithalat(50, 54.25, 100, NaN, 200); });
});
console.log(n + " finans regresyon senaryosu geçti.");
