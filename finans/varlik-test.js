#!/usr/bin/env node
/*!
 * Varlık karşılaştırma motorunun testi — her sonuç ikinci bir yoldan.
 *
 *   - gram altın, grafikler sayfasının kendi hesabıyla (grafikler/hesap.js)
 *     ay ay aynı olmalı: iki sayfa aynı altını farklı söylemesin;
 *   - mevduat bağımsız bir döngüyle (gün sayısı ayrı yoldan, stopaj elle
 *     yazılmış dönem listesinden) yeniden hesaplanır;
 *   - TÜFE çarpanı, tufe-serisi.js'in aylık değişimleri zincirlenerek;
 *   - kazanan haritası, her başlangıç için ozet() ile tek tek;
 *   - stopaj tablosunun bütün sınır günleri, GİB rehberindeki tarihlerle.
 *
 * Kullanım: node finans/varlik-test.js
 */
"use strict";

var path = require("path");
var V = require(path.join(__dirname, "varlik-motoru.js"));
var G = require(path.join(__dirname, "grafik-verisi.js"));
var T = require(path.join(__dirname, "tufe-serisi.js"));
var E = require(path.join(__dirname, "tufe-endeksi.js"));
var M = require(path.join(__dirname, "mevduat-faizi.js"));
var H = require(path.join(__dirname, "..", "grafikler", "hesap.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol) * Math.max(1, Math.abs(b)); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

/* ---- 1. stopaj: GİB rehberindeki her sınır günü ------------------------- */
console.log("Stopaj tablosu (TL mevduat, 6 aya kadar)");
[
  ["2006-01-01", 15], ["2018-08-30", 15], ["2018-08-31", 5], ["2018-11-30", 5], ["2018-12-01", 15],
  ["2020-09-29", 15], ["2020-09-30", 5], ["2024-04-30", 5], ["2024-05-01", 7.5], ["2024-10-31", 7.5],
  ["2024-11-01", 10], ["2025-01-31", 10], ["2025-02-01", 15], ["2025-07-08", 15], ["2025-07-09", 17.5],
  ["2026-09-01", 17.5]
].forEach(function (c) { dogru(c[0] + " → %" + c[1], V.stopaj(c[0]).oran === c[1], String(V.stopaj(c[0]).oran)); });
dogru("2006 öncesi reddedilir", atar(function () { V.stopaj("2005-12-31"); }));
dogru("tablo tarih sırasında", V.STOPAJ.every(function (s, i) { return i === 0 || V.STOPAJ[i - 1].bas < s.bas; }));

/* ---- 2. aralık -------------------------------------------------------------- */
console.log("Aralık");
dogru("ilk başlangıç Aralık 2005", V.ILK === "2005-12");
var son = [Object.keys(G.kur).sort().pop(), G.altin.sonAy, E.sonAy, M.sonAy].sort()[0];
esit("son ay dört serinin en eskisi", V.SON, son);
function esit(ad, a, b) { dogru(ad, a === b, JSON.stringify(a) + " ≠ " + JSON.stringify(b)); }
dogru("aylar kesintisiz", V.AYLAR.every(function (a, i) { return i === 0 || V.ayEkle(V.AYLAR[i - 1], 1) === a; }));

/* ---- 3. gram altın = grafikler sayfası -------------------------------------- */
console.log("Gram altın, grafikler sayfasıyla");
(function () {
  var fiyat = V.AYLAR.map(function (a) { return { ay: a, endeks: E.duzey(a) }; });
  var seri = H.birikim(fiyat, G.kur, G.altin), fark = 0;
  seri.forEach(function (x) { fark = Math.max(fark, Math.abs(x.gram - V.fiyat(x.ay).gram) / x.gram); });
  dogru("grafikler/hesap.js ile " + seri.length + " ay aynı (en büyük göreli fark " + fark.toExponential(1) + ")",
    seri.length === V.AYLAR.length && fark < 1e-12);
})();

/* ---- 4. mevduat: bağımsız döngü ---------------------------------------------- */
console.log("Mevduat, ikinci yoldan");
var DONEMLER = [ // [ilk yenileme ayı, oran] — GİB tarihleri, ayın 1'inde yenilenen hesap için
  ["2006-01", 15], ["2018-09", 5], ["2018-12", 15], ["2020-10", 5], ["2024-05", 7.5], ["2024-11", 10],
  ["2025-02", 15], ["2025-08", 17.5]
];
function stopajAy(ay) { var o = 15; DONEMLER.forEach(function (d) { if (d[0] <= ay) o = d[1]; }); return o; }
function gun(ay) { var y = +ay.slice(0, 4), m = +ay.slice(5, 7); return [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
function mevduatElle(bas, bit, brut) {
  var d = 1, ay = bas;
  while (ay < bit) {
    var y = +ay.slice(0, 4), m = +ay.slice(5, 7) + 1; if (m === 13) { y++; m = 1; }
    ay = y + "-" + (m < 10 ? "0" : "") + m;
    d *= 1 + M.oranlar[ay] / 100 * gun(ay) / 365 * (brut ? 1 : 1 - stopajAy(ay) / 100);
  }
  return d;
}
[["2005-12", V.SON], ["2018-07", "2019-01"], ["2020-08", "2020-12"], ["2024-03", "2025-09" > V.SON ? V.SON : "2025-09"], ["2010-01", "2015-06"]]
  .forEach(function (c) {
    var o = V.ozet({ tutar: 1, bas: c[0], son: c[1] });
    dogru("net " + c[0] + " → " + c[1], yakin(o.sonuclar.mevduat.deger, mevduatElle(c[0], c[1], false)),
      o.sonuclar.mevduat.deger + " vs " + mevduatElle(c[0], c[1], false));
    var s = o.yol[o.yol.length - 1];
    dogru("brüt " + c[0] + " → " + c[1], yakin(s.mevduatBrut, mevduatElle(c[0], c[1], true)));
  });
dogru("29 Şubat 2024: 29 gün", V.gunSayisi("2024-02") === 29 && V.gunSayisi("2100-02") === 28);
(function () {
  var f = V.mevduatAyi("2024-07", false);
  dogru("Temmuz 2024: %" + M.oranlar["2024-07"] + " × 31/365 × (1 − %7,5)",
    yakin(f, 1 + M.oranlar["2024-07"] / 100 * 31 / 365 * 0.925));
})();

/* ---- 5. döviz ve TÜFE ----------------------------------------------------------- */
console.log("Döviz ve TÜFE");
(function () {
  var o = V.ozet({ tutar: 100000, bas: "2005-12", son: V.SON });
  dogru("dolar = tutar × ay sonu kur oranı",
    yakin(o.sonuclar.dolar.deger, 100000 * G.kur[V.SON].USD / G.kur["2005-12"].USD));
  dogru("euro = tutar × ay sonu kur oranı",
    yakin(o.sonuclar.euro.deger, 100000 * G.kur[V.SON].EUR / G.kur["2005-12"].EUR));
  var c = 1;
  Object.keys(T.aylar).sort().forEach(function (a) { if (a > "2005-12" && a <= V.SON) c *= 1 + T.aylar[a].aylik / 100; });
  dogru("TÜFE çarpanı aylık değişimlerin zinciri", yakin(o.tufe.carpan, c));
  dogru("nakit TL'nin reel kaybı 1 − 1/çarpan", yakin(o.sonuclar.nakit.reel, 1 / c - 1));
  dogru("stopaj maliyeti pozitif", o.stopajMaliyeti > 0);
  var o2 = V.ozet({ tutar: 1, bas: "2005-12", son: V.SON });
  dogru("tutar orantılı: 100.000 TL = 100.000 × 1 TL", V.VARLIKLAR.every(function (k) {
    return yakin(o.sonuclar[k].deger, 100000 * o2.sonuclar[k].deger);
  }));
  dogru("yıllık bileşik geri dönüşümlü", yakin(Math.pow(1 + o.sonuclar.altin.yillikNominal, o.ay / 12), 1 + o.sonuclar.altin.nominal));
  dogru("sıra değerlere göre", o.sira.every(function (k, i) { return i === 0 || o.sonuclar[o.sira[i - 1]].deger >= o.sonuclar[k].deger; }));
})();

/* ---- 6. kazanan haritası = tek tek ozet --------------------------------------- */
console.log("Kazanan haritası");
[12, 60].forEach(function (sure) {
  var h = V.harita(sure), uyusmaz = [];
  h.forEach(function (x, i) {
    if (i % 7) return; // her 7. başlangıç: yeterli örnek, hızlı
    var o = V.ozet({ tutar: 1, bas: x.bas, son: x.son });
    if (o.kazanan !== x.kazanan || (o.sonuclar[o.kazanan].deger > o.tufe.carpan) !== x.enflasyonuYendi) uyusmaz.push(x.bas);
  });
  dogru(sure / 12 + " yıllık haritada örneklenen başlangıçlar ozet() ile aynı", uyusmaz.length === 0, uyusmaz.join(","));
  esit(sure / 12 + " yıl: başlangıç sayısı", h.length, V.AYLAR.length - sure);
  var k = V.kazanmaSayilari(sure);
  esit(sure / 12 + " yıl: sayılar toplamı", k.say.altin + k.say.dolar + k.say.euro + k.say.mevduat, k.toplam);
});

/* ---- 7. hatalı girdi ----------------------------------------------------------- */
console.log("Hatalı girdi");
dogru("bitiş başlangıçtan önce", atar(function () { V.ozet({ tutar: 1, bas: "2020-01", son: "2019-01" }); }));
dogru("aralık dışı ay", atar(function () { V.ozet({ tutar: 1, bas: "2004-01", son: "2019-01" }); }));
dogru("sıfır tutar", atar(function () { V.ozet({ tutar: 0, bas: "2010-01", son: "2019-01" }); }));

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kontrol kaldı.");
process.exit(kalan ? 1 : 0);
