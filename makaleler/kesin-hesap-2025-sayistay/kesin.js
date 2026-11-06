/*!
 * "2025 kesin hesabı" yazısının hesabı.
 *
 * Veri: kesin-hesap.json — Sayıştay Genel Uygunluk Bildirimleri (2023, 2024,
 * 2025) ve 2025 Dış Denetim Genel Değerlendirme Raporu tabloları, TL.
 * 2027 teklifindeki açık finans/butce.js'ten.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var V = require("./kesin-hesap.json");
var Bu = require("../../finans/butce.js");

function ozet() {
  var k = V.konsolide, g = V.genelButce, l = V.limit["2025"];
  var acikTahmin = g.gelirTahmin - g.odenek, acik = g.gelir - g.gider;
  return {
    baslangic: k.baslangic, brutGider: k.brutGider, yilSonu: k.yilSonu, kullanilmayan: k.kullanilmayan,
    giderSapma: k.brutGider / k.baslangic - 1,
    gbGiderSapma: g.gider / g.odenek - 1, gbGelirSapma: g.gelir / g.gelirTahmin - 1, vergiSapma: g.vergi / g.vergiTahmin - 1,
    acikTahmin: acikTahmin, acik: acik, acikSapma: acik / acikTahmin - 1,
    borcAcikFarki: l.net + acik,
    vergiBasiBorc: l.net / g.vergi * 100,
    stokArtis: V.borcStoku["2025"] / V.borcStoku["2024"] - 1
  };
}

function limitler() {
  return Object.keys(V.limit).sort().map(function (y) {
    var l = V.limit[y], ham = l.odenek - l.gelir, yuzdeli = ham * Math.pow(1.05, l.artis);
    return { yil: +y, ham: ham, yuzdeli: yuzdeli, artis: l.artis, ek: l.ek, son: l.son, net: l.net,
      kullanim: l.net / ham, genisleme: l.son / ham - 1, ekOlmadanAsim: l.net - yuzdeli };
  });
}

var ALT_SINIR = 30e9;   // küçük idarelerin yüzdesi yanıltır

function kurumlar() {
  var h = V.kurumlar.map(function (r) {
    return { ad: r.ad, baslangic: r.baslangic, toplam: r.toplam, gider: r.gider, kullanilmayan: r.kullanilmayan, sapma: r.gider / r.baslangic - 1 };
  }).filter(function (r) { return r.baslangic >= ALT_SINIR; }).sort(function (a, b) { return b.sapma - a.sapma; });
  var enCok = V.kurumlar.slice().sort(function (a, b) { return b.kullanilmayan - a.kullanilmayan; })[0];
  return { secilen: h.slice(0, 3).concat(h.slice(-3)), enCokKullanilmayan: enCok, kullanilmayanPay: enCok.kullanilmayan / V.genelToplam.kullanilmayan };
}

function yirmiYedi() {
  var acik = -Bu.yil(2027).denge * 1e9;
  return { acik: acik, yuzdeli: acik * 1.05 * 1.05 };
}

module.exports = { V: V, ozet: ozet, limitler: limitler, kurumlar: kurumlar, yirmiYedi: yirmiYedi };
