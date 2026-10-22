#!/usr/bin/env node
/*
 * "2026 yeniden değerleme oranı Ekim verisi gelmeden neredeyse belli"
 * yazısının statik bölümleri:
 *   YDO-SENARYO  Ekim'in aylık değişimine göre yıllık Yİ-ÜFE ve oran
 *                (tablo; grafiği kapak görselinde)
 *   YDO-GERIYE   aynı yöntem 2021–2025 Eylül'ünde uygulansaydı
 *   YDO-DILIM    2027 gelir vergisi dilimleri için pencere
 *   data-s alanları
 * Rakamlar yazının modülünden (makaleler/yeniden-degerleme-orani-2026/oran.js);
 * TÜFE karşılaştırması sitenin TÜFE serisinden (finans/tufe-serisi.js).
 *
 * Kullanım:
 *   node tools/ydo-2026-yazisi.js           # yaz
 *   node tools/ydo-2026-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var KLASOR = path.join(KOK, "makaleler", "yeniden-degerleme-orani-2026");
var O = require(path.join(KLASOR, "oran.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var YAZI = path.join(KLASOR, "index.html");

var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(v) { return nf.format(Math.floor(v)) + " TL"; }
function yz(v, b) { return (v < 0 ? "−" : "") + "%" + Math.abs(v).toFixed(b == null ? 2 : b).replace(".", ","); }
function puan(v) { return v.toFixed(2).replace(".", ","); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function ayAdi(k) { return AY[+k.slice(5) - 1] + " " + k.slice(0, 4); }

function ufeYillik(k) {
  var E = O.VERI.endeks, onceki = (+k.slice(0, 4) - 1) + k.slice(4);
  return (E[k] / E[onceki] - 1) * 100;
}
function ufeBandi() {
  var ks = Object.keys(O.VERI.endeks).sort().filter(function (k) { return k >= "2025-11" && k <= "2026-09"; });
  var v = ks.map(ufeYillik);
  return { min: Math.min.apply(null, v), max: Math.max.apply(null, v), ay: ks.length };
}
function tufeEylul() {
  var s = T.aylar["2026-09"];
  if (!s) throw new Error("TÜFE Eylül 2026 serisi yok.");
  return s.yillik;
}

function senaryolar() {
  var a = O.aralik(), gecen = (O.VERI.endeks["2025-10"] / O.VERI.endeks["2025-09"] - 1) * 100;
  return [
    { ad: "Ekim'de fiyatlar %5 düşer (uç durum)", x: -5 },
    { ad: "Ekim'de hiç artış yok", x: 0 },
    { ad: "Son 24 ayın en yavaş ayı (" + ayAdi(a.altAy) + ")", x: a.alt.aylik },
    { ad: "Geçen Ekim kadar (Ekim 2025)", x: gecen },
    { ad: "Son 24 ayın en hızlı ayı (" + ayAdi(a.ustAy) + ")", x: a.ust.aylik },
    { ad: "Ekim'de fiyatlar %10 artar (uç durum)", x: 10 }
  ].map(function (s) { var r = O.senaryo(s.x); r.ad = s.ad; return r; });
}

function alanlar() {
  var a = O.aralik(), g21 = O.geriyeDonuk(2021), d = O.dilimPenceresi(a.alt.oran, a.ust.oran);
  var b = ufeBandi(), m1 = O.mtvOrnek(a.alt.oran), m2 = O.mtvOrnek(a.ust.oran);
  return {
    oranAlt: yz(a.alt.oran), oranUst: yz(a.ust.oran), oran0: yz(O.senaryo(0).oran),
    altAylik: yz(a.alt.aylik), ustAylik: yz(a.ust.aylik), altAy: ayAdi(a.altAy), ustAy: ayAdi(a.ustAy),
    duyar: puan(O.duyarlilik()),
    stresAlt: yz(O.senaryo(-5).oran), stresUst: yz(O.senaryo(10).oran),
    ekim2021: yz(g21.ekimAylik), max2021: yz(g21.maxAylik), sapma2021: puan(g21.sapma),
    dilim1Fark: nf.format(Math.round(d[0].hamUst - d[0].hamAlt)) + " TL",
    mtv2026: yz(m1.uygulanan2026 * 100), mtvTutar: tl(m1.tutar2026), mtvAlt: tl(m1.kanunOrani), mtvUst: tl(m2.kanunOrani),
    tufeEylul: yz(tufeEylul()), ufeEylul: yz(ufeYillik("2026-09")), ufeMin: yz(b.min), ufeMax: yz(b.max)
  };
}

/* ------------------------------------------------ senaryo tablosu (aynı ilişkinin grafiği kapak görselinde) */
function senaryoBlok() {
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>Ekim 2026'nın aylık Yİ-ÜFE değişimine göre Ekim'in yıllık ÜFE'si ve yeniden değerleme oranı</caption>",
    '<thead><tr><th scope="col">Ekim için senaryo</th><th scope="col">Aylık değişim</th><th scope="col">Ekim yıllık Yİ-ÜFE</th><th scope="col">Yeniden değerleme oranı</th></tr></thead>', "<tbody>"];
  senaryolar().forEach(function (s) {
    t.push('<tr><th scope="row">' + esc(s.ad) + "</th><td>" + yz(s.aylik) + "</td><td>" + yz(s.ekimYillik) + "</td><td>" + yz(s.oran) + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

function geriyeBlok() {
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>Eylül verisiyle kurulan aralık ve ilan edilen oran, 2021–2025</caption>",
    '<thead><tr><th scope="col">Yıl</th><th scope="col">Önceki 24 ayın aylık aralığı</th><th scope="col">Oran aralığı</th><th scope="col">İlan edilen</th><th scope="col">Ekim gerçekte</th><th scope="col">Sonuç</th></tr></thead>', "<tbody>"];
  [2021, 2022, 2023, 2024, 2025].forEach(function (y) {
    var g = O.geriyeDonuk(y);
    t.push('<tr><th scope="row">' + y + "</th><td>" + yz(g.minAylik) + " – " + yz(g.maxAylik) + "</td><td>" + yz(g.alt) + " – " + yz(g.ust) + "</td><td>" + yz(g.ilan) + "</td><td>" + yz(g.ekimAylik) + "</td><td>" + (g.icinde ? "içinde" : puan(g.sapma) + " puan dışında") + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

function dilimBlok() {
  var a = O.aralik(), d = O.dilimPenceresi(a.alt.oran, a.ust.oran);
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>2027 gelir vergisi dilimleri: oran aralığıyla hesaplanan tutar ve %5 kesir atılırsa en düşük ilan (TL)</caption>",
    '<thead><tr><th scope="col">Dilim</th><th scope="col">2026</th><th scope="col">Oranla, alt uç</th><th scope="col">Oranla, üst uç</th><th scope="col">En düşük ilan</th></tr></thead>', "<tbody>"];
  d.forEach(function (r) {
    t.push('<tr><th scope="row">' + r.sira + ". eşik (%" + Math.round(r.oran * 100) + " → %" + Math.round([0.20, 0.27, 0.35, 0.40][r.sira - 1] * 100) + ")</th><td>" + nf.format(r.tutar2026) + "</td><td>" + nf.format(Math.floor(r.hamAlt)) + "</td><td>" + nf.format(Math.floor(r.hamUst)) + "</td><td>" + nf.format(Math.ceil(r.enAz)) + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

/* ------------------------------------------------ ortak */
function blok(html, ad, icerik) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("Blok bulunamadı: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}
function kacis(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function alanYaz(html) {
  var m = alanlar();
  return html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z0-9]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (t, ac, et, k, ic, kapa) {
    if (!(k in m)) throw new Error("Bilinmeyen data-s: " + k);
    return ac + kacis(m[k]) + kapa;
  });
}
function uret(html) {
  html = blok(html, "YDO-SENARYO", senaryoBlok());
  html = blok(html, "YDO-GERIYE", geriyeBlok());
  html = blok(html, "YDO-DILIM", dilimBlok());
  return alanYaz(html);
}

if (require.main === module) {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var eski = fs.readFileSync(YAZI, "utf8"), yeni = uret(eski);
  if (yeni !== eski) {
    if (kontrol) { console.error("Bayat: " + path.relative(KOK, YAZI) + " — 'node tools/ydo-2026-yazisi.js' çalıştırın."); process.exit(1); }
    fs.writeFileSync(YAZI, yeni);
  }
  console.log(kontrol ? "Yeniden değerleme 2026 yazısı hesapla aynı." : "Yeniden değerleme 2026 yazısı yazıldı.");
}
module.exports = { alanlar: alanlar, senaryolar: senaryolar, ufeBandi: ufeBandi, tufeEylul: tufeEylul, ufeYillik: ufeYillik };
