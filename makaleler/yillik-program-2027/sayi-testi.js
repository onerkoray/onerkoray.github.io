#!/usr/bin/env node
/*
 * "2027 Yıllık Programı: emekli, maaş ve SGK" yazısının sayıları.
 *
 * 1. Aktarma: program.json'daki SGK ve İSF tabloları kendi içinde tutarlı mı
 *    (gelir = prim + diğer, gider = kalemler toplamı, fark = gelir − gider) ve
 *    programın metin cümleleriyle (7.889,6 / 9.844,7 / 1.955,1 milyar TL) aynı mı.
 * 2. Hesap: oranlar, hedef–gerçekleşme farkı ve zam aritmetiği modülden
 *    bağımsız yeniden kurulur ve sayfada aranır.
 * 3. Çapraz kontrol: programın 2026 rakamları sitenin parametreleriyle aynı.
 * 4. Site kuralı: yazıda parti, milletvekili ya da siyasetçi adı yok.
 *
 * Kullanım: node makaleler/yillik-program-2027/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./program.js");
var T = require("../../finans/tufe-serisi.js");
var TS = require("../../finans/toplu-sozlesme.js").oranlar;
var P = M.P;
var t = S.yazi(__dirname);

function v1(x) { return x.toFixed(1).replace(".", ","); }
function mly(x) { return (Math.round(x / 100) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/^-/, "−"); }

/* 1. Aktarma */
var g = P.sgk;
g.yillar.forEach(function (y, i) {
  t.dogru("SGK " + y + ": gelir = prim + diğer", Math.abs(g.prim[i] + g.digerGelir[i] - g.gelirler[i]) <= 2, g.prim[i] + g.digerGelir[i] - g.gelirler[i]);
  t.dogru("SGK " + y + ": gider = kalemler", Math.abs(g.sigortaOdemeleri[i] + g.saglik[i] + g.yatirim[i] + g.digerGider[i] - g.giderler[i]) <= 2);
  t.dogru("SGK " + y + ": fark = gelir − gider", Math.abs(g.gelirler[i] - g.giderler[i] - g.fark[i]) <= 2, g.gelirler[i] - g.giderler[i] - g.fark[i]);
});
t.dogru("2027 metin cümlesi tabloyla aynı", g.metin2027.indexOf(mly(g.gelirler[3])) >= 0 && g.metin2027.indexOf(mly(g.giderler[3])) >= 0 &&
  g.metin2027.indexOf(mly(-g.fark[3]).replace("−", "")) >= 0);
var f = P.isf;
f.yillar.forEach(function (y, i) {
  t.dogru("İSF " + y + ": gider ≤ gelir", f.giderler[i] <= f.gelirler[i]);
  t.dogru("İSF " + y + ": prim ≤ gelir", f.prim[i] <= f.gelirler[i]);
});

/* 2. Hesap */
var son = g.yillar.length - 1;
var primSig = g.prim[son] / g.sigortaOdemeleri[son], primSig26 = g.prim[2] / g.sigortaOdemeleri[2];
t.dogru("2027'de prim aylık ödemelerin altında", primSig < 1 && primSig26 > 1);
t.gecsin("prim / aylık 2027", "%" + v1(primSig * 100));
t.gecsin("prim / aylık 2026", "%" + v1(primSig26 * 100));
t.gecsin("2027 gelir-gider farkı (milyar TL)", mly(g.fark[son]));
t.gecsin("2027 bütçe transferi (milyar TL)", mly(g.butceTransferi[son]));
t.gecsin("diğer gelirler düşüşü", mly(g.digerGelir[2]) + " milyar TL'den " + mly(g.digerGelir[3]));

P.gecmisHedefler.forEach(function (h) {
  var gercek = T.aylar[h.program + "-12"];
  t.gecsin(h.program + " hedefi", "%" + v1(h.hedef));
  if (gercek) {
    t.gecsin(h.program + " gerçekleşen", "%" + gercek.yillik.toFixed(2).replace(".", ","));
    t.dogru(h.program + ": gerçekleşen hedefin üstünde", gercek.yillik > h.hedef);
  }
});

var h21 = P.hedefler.tufeYilSonu["2027"] / 100, yari = Math.sqrt(1 + h21) - 1;
var fark = Math.max(0, Math.round(((1 + yari) / (1 + TS["2027-1"]) - 1) * 10000) / 10000);
var memur = (1 + fark) * (1 + TS["2027-2"]) - 1;
t.gecsin("%21 → Temmuz 2027 SSK zammı", "%" + v1(yari * 100));
t.gecsin("%21 → Temmuz 2027 memur zammı", "%" + (Math.round(memur * 10000) / 100).toFixed(2).replace(".", ","));
t.gecsin("%21 → aylık ortalama", "%" + (Math.round((Math.pow(1 + h21, 1 / 12) - 1) * 10000) / 100).toFixed(2).replace(".", ","));
t.gecsin("aktif/pasif 2025", "2025'te " + P.aktifPasif["2025"].toFixed(2).replace(".", ","));

/* 3. Çapraz kontrol */
var c = M.capraz();
c.forEach(function (r) { t.dogru("çapraz: " + r.ad, r.ayni, r.program + " / " + r.site); });
t.gecsin("çapraz özet", c.length + " kalemin " + c.length + "'i aynı");

/* 4. Site kuralı: siyasi isim yok */
var ham = require("fs").readFileSync(require("path").join(__dirname, "index.html"), "utf8");
t.dogru("yazıda parti ya da siyasetçi adı yok",
  !/(AK Parti|\bAKP\b|\bCHP\b|\bMHP\b|DEM Parti|İYİ Parti|Milletvekili [A-ZÇĞİÖŞÜ]|ERDOĞAN|Erdoğan|Cevdet Yılmaz|Mehmet Şimşek|Işıkhan)/.test(ham));

t.bitir("2027 Yıllık Programı");
