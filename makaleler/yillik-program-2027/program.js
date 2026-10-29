/*!
 * "2027 Yıllık Programı: emekli, maaş ve SGK" yazısının hesabı.
 *
 * Veri: program.json — 2027 Yılı Cumhurbaşkanlığı Yıllık Programı'ndan
 * (RG 27.10.2026, 33413 Mükerrer) sayfa numarasıyla aktarılan tablolar ve
 * önceki programların kendi yılları için koyduğu yıl sonu TÜFE hedefleri.
 * Gerçekleşen enflasyon sitenin TÜFE serisinden (TÜİK, TCMB tablosu);
 * zam aritmetiği sitenin zam motorundan; çapraz kontrol bordro ve emeklilik
 * parametrelerinden.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var P = require("./program.json");
var T = require("../../finans/tufe-serisi.js");
var Z = require("../../finans/emekli-zammi-motoru.js");
var B = require("../../bordro/motor.js");
var EP = require("../../bordro/emeklilik-parametreleri.js");

/* ------------------------------------------------ SGK */

function sgk() {
  var s = P.sgk;
  return s.yillar.map(function (y, i) {
    return {
      yil: y, durum: s.durum[i],
      gelir: s.gelirler[i], prim: s.prim[i], gider: s.giderler[i], sigorta: s.sigortaOdemeleri[i],
      fark: s.fark[i], transfer: s.butceTransferi[i],
      primGider: s.prim[i] / s.giderler[i],          // prim, toplam giderin ne kadarını karşılıyor
      primSigorta: s.prim[i] / s.sigortaOdemeleri[i], // prim, aylık ve gelirleri karşılıyor mu
      transferGider: s.butceTransferi[i] / s.giderler[i]
    };
  });
}

/* ------------------------------------------------ hedef ve gerçekleşme */

function aralikYillik(yil) { var v = T.aylar[yil + "-12"]; return v ? v.yillik : null; }

function isabet() {
  return P.gecmisHedefler.map(function (h) {
    var g = aralikYillik(h.program);
    var tahmin = g == null && P.hedefler.tufeYilSonu[String(h.program)] != null && h.program !== 2027
      ? P.hedefler.tufeYilSonu[String(h.program)] : null;
    var sonuc = g != null ? g : tahmin;
    return { program: h.program, hedef: h.hedef, gerceklesen: g, tahmin: tahmin,
      sapma: sonuc == null ? null : sonuc - h.hedef, kaynak: h.sayfa, url: h.url };
  });
}

/* ------------------------------------------------ zam aritmetiği */

/* Yıllık enflasyon h ise ve yılın iki yarısı eşit ilerlerse her yarı (1+h)^(1/2)−1.
   Temmuz 2027 SSK/Bağ-Kur zammı ilk yarıya, memur zammı ilk yarı + toplu sözleşmeye bağlı. */
function zam2027(h) {
  var yari = Math.sqrt(1 + h) - 1;
  var m = Z.memurZammi(yari, 2027, 7);
  return { yillik: h, aylik: Math.pow(1 + h, 1 / 12) - 1, yari: yari, emekliTemmuz: yari, memurTemmuz: m.toplam, memurFark: m.fark };
}

/* Son açıklanan üç ayın aylık ortalaması (karşılaştırma için). */
function sonUcAy() {
  var k = Object.keys(T.aylar).sort().slice(-3);
  var b = k.reduce(function (t, a) { return t * (1 + T.aylar[a].aylik / 100); }, 1);
  return { aylar: k, aylik: Math.pow(b, 1 / 3) - 1 };
}

/* ------------------------------------------------ çapraz kontrol */

function capraz() {
  var y = P.yururluk2026, p = B.parametre(2026);
  var ilk = p.donemler[0];
  var o = Z.donem(2026, 1, T).birikim, t = Z.donem(2026, 7, T).birikim;
  function bir(x) { return Math.round(x * 1000) / 10; }
  return [
    ["Brüt asgari ücret (TL)", y.asgariBrut, ilk.asgariBrut, "bordro/parametreler.js"],
    ["Net asgari ücret (TL)", y.asgariNet, ilk.asgariNet, "bordro/parametreler.js"],
    ["Prim tavanı (asgari ücretin katı)", y.tavanKatsayisi, p.tavanKatsayisi, "bordro/parametreler.js"],
    ["Borçlanma primi (%)", y.borclanmaOrani, Math.round(p.sigortalilik.borclanmaOrani * 100), "bordro/parametreler.js"],
    ["GSS primi, kendi ödeyen (%)", y.gssOrani, Math.round(p.sigortalilik.gssOrani * 100), "bordro/parametreler.js"],
    ["İşveren teşviki, imalat dışı (puan)", y.tesvikImalatDisi, Math.round(p.oranlar.sgkIsverenIndirim * 100), "bordro/parametreler.js"],
    ["SSK/Bağ-Kur zammı, Ocak 2026 (%)", y.emekliOcak, bir(o), "TÜFE serisi, zam motoru"],
    ["SSK/Bağ-Kur zammı, Temmuz 2026 (%)", y.emekliTemmuz, bir(t), "TÜFE serisi, zam motoru"],
    ["Memur emeklisi zammı, Ocak 2026 (%)", y.memurEmekliOcak, bir(Z.memurZammi(o, 2026, 1).toplam), "zam motoru, toplu sözleşme"],
    ["Memur emeklisi zammı, Temmuz 2026 (%)", y.memurEmekliTemmuz, bir(Z.memurZammi(t, 2026, 7).toplam), "zam motoru, toplu sözleşme"],
    ["En düşük emekli aylığı (TL)", y.enDusukAylik, EP.altSinirAylik("2026-09-01").tutar, "bordro/emeklilik-parametreleri.js"]
  ].map(function (r) { return { ad: r[0], program: r[1], site: r[2], kaynak: r[3], ayni: r[1] === r[2] }; });
}

module.exports = { P: P, sgk: sgk, isabet: isabet, zam2027: zam2027, sonUcAy: sonUcAy, capraz: capraz, aralikYillik: aralikYillik };
