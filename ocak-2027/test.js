#!/usr/bin/env node
/*
 * Ocak 2027 panosu — her satır ikinci bir yoldan.
 *
 * Emekli ve memur zammı Ocak zammı yazısının modülüyle (ocak.js), durumlar
 * şemanın kuralıyla, sayfa üreteçle karşılaştırılır. Durumun veriden
 * türediğini sınamak için seri ve parametre geçici olarak uzatılır.
 *
 * Kullanım: node ocak-2027/test.js
 */
"use strict";

var path = require("path");
var fs = require("fs");
var KOK = path.join(__dirname, "..");
var D = require("./durum.js");
var U = require(path.join(KOK, "tools", "ocak-2027-sayfa.js"));
var O = require(path.join(KOK, "makaleler", "ocak-2027-emekli-zammi", "ocak.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var E = require(path.join(KOK, "finans", "emekli-taban.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function satir(id) { return D.kalemler().filter(function (k) { return k.id === id; })[0]; }

console.log("Ocak 2027 panosu\n");

/* 1. Altı ay birikimi elle. */
var t = D.tufeAltiAy(), el = 1, say = 0;
D.AYLAR.forEach(function (a) { if (T.aylar[a]) { el *= 1 + T.aylar[a].aylik / 100; say++; } });
dogru("açıklanan ay sayısı", t.aylar.length === say, say);
dogru("birikim aylık oranların çarpımı", yakin(t.birikim, el - 1));

/* 2. Orta senaryo, Ocak zammı yazısının "geçen yılın aynı ayları" senaryosuyla aynı. */
var sen = O.senaryolar().filter(function (s) { return /Geçen yılın/.test(s.ad); })[0];
var em = satir("emekli"), me = satir("memur");
if (t.kalan) {
  dogru("emekli: yazının senaryosuyla aynı", yakin(em.deger, sen.emekli, 1e-9), em.deger + " / " + sen.emekli);
  dogru("memur: yazının senaryosuyla aynı", yakin(me.deger, sen.memur, 5e-5), me.deger + " / " + sen.memur);
} else {
  dogru("emekli: altı ay açıklandı, değer birikimin kendisi", yakin(em.deger, el - 1));
}
dogru("memur = (1 + toplu) × (1 + fark) − 1", yakin(me.deger, (1 + me.toplu) * (1 + me.fark) - 1));

/* 3. Durum kuralları. */
dogru("emekli durumu kalan aya göre", em.durum === (t.kalan ? "senaryo" : "kesin"));
var var27 = (function () { try { return !!B.parametre(2027); } catch (e) { return false; } })();
dogru("asgari durumu 2027 parametresine göre", satir("asgari").durum === (var27 ? "kesin" : "bekleniyor"));
dogru("SGK tavanı = asgari brüt × 9", satir("sgk").deger === satir("asgari").deger * 9);
dogru("taban satırı tek kaynaktan", satir("taban").deger === E.TABAN[E.TABAN.length - 1].tutar || satir("taban").durum === "kesin");
var d = satir("dilim");
dogru("ilk dilim, 2026 tutarı × (1 + YDO), kesir atılmış", var27 || d.deger === Math.floor(B.parametre(2026).dilimler[0][0] * (1 + satir("ydo").deger)));
dogru("her satır tanımlı bir durumda", D.kalemler().every(function (k) { return !!U.DURUM[k.durum]; }));

/* 4. Durum veriden türüyor: seriyi geçici olarak Aralık'a uzat. */
var yedek = {};
["2026-11", "2026-12"].forEach(function (a) { yedek[a] = T.aylar[a]; if (!T.aylar[a]) T.aylar[a] = { aylik: 1, yillik: 30 }; });
var em2 = satir("emekli");
dogru("altı ay tamamlanınca emekli satırı kesin olur", em2.durum === "kesin" && em2.kalanAy === 0);
Object.keys(yedek).forEach(function (a) { if (yedek[a] === undefined) delete T.aylar[a]; });
dogru("geçici uzatma geri alındı", D.tufeAltiAy().kalan === t.kalan);

/* 5. Sayfa. */
var s = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var g = U.govde();
dogru("sayfa üreteçle güncel", s.indexOf("<!-- OCAK-PANO:BASLANGIC -->\n" + g + "\n<!-- OCAK-PANO:BITIS -->") >= 0);
dogru("emekli değeri sayfada", s.indexOf("%" + D.yuzde(em.deger)) >= 0);
dogru("kişi ya da parti adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|\bAK Parti\b|\bMHP\b|\bCHP\b/.test(s));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (ocak-2027)");
process.exit(kalan ? 1 : 0);
