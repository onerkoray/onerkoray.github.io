#!/usr/bin/env node
/*
 * "Katılım bankacılığı 2025'te %15 olacaktı: ne oldu?" yazısının statik
 * bölümleri:
 *   KAT-OLCUT  iki ölçüt (pay, TL aktif): hedef ve gerçekleşen
 *   KAT-SERI   Aralık sonları 2015–2025 ve son ay: aktif, pay, dolar
 *   KAT-DUNYA  İslami bankacılık varlıkları, ilk on ülke (2024)
 *   data-s alanları
 * Rakamlar yazının modülünden (makaleler/katilim-bankaciligi-yuzde-15-hedefi/katilim.js).
 *
 * Kullanım:
 *   node tools/katilim-yazisi.js           # yaz
 *   node tools/katilim-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var KLASOR = path.join(KOK, "makaleler", "katilim-bankaciligi-yuzde-15-hedefi");
var K = require(path.join(KLASOR, "katilim.js"));
var YAZI = path.join(KLASOR, "index.html");

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function ondalik(v, b) { return v.toFixed(b).replace(".", ","); }
function yz(v, b) { return "%" + ondalik(v, b == null ? 2 : b); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function ayAdi(k) { return AY[+k.slice(5) - 1] + " " + k.slice(0, 4); }

function alanlar() {
  var o = K.olcutler(), e = K.enflasyon(), g = K.gereken(), h = K.hiz(), d = K.dolar(), w = K.dunya();
  var iran = w.ulkeler.filter(function (u) { return u.ulke === "İran"; })[0];
  return {
    pay2025: yz(o[0].gercek), pay2015: yz(h.pay2015), paySon: yz(h.paySon), sonAy: ayAdi(h.son),
    hedefOran: "%" + Math.round(o[0].oran * 100), artis10: ondalik(h.pay2025 - h.pay2015, 2),
    tlHedef: ondalik(K.HEDEF.tlTrilyon, 2) + " trilyon TL", tl2025: ondalik(o[1].gercek, 2) + " trilyon TL",
    tufe: ondalik(e.tufe, 2), kat2020: nf0.format(Math.round(e.katilim2020 / 1000)) + " milyar TL",
    sadeceEnf: ondalik(e.sadeceEnflasyon / 1e6, 2) + " trilyon TL", sadeceEnfKat: ondalik(e.sadeceEnflasyon / 1e6 / K.HEDEF.tlTrilyon, 1),
    ortukSektor: ondalik(e.ortukSektor / 1e6, 1) + " trilyon TL", gercekSektor: ondalik(e.gercekSektor / 1e6, 1) + " trilyon TL",
    sektorKat: ondalik(e.gercekSektor / e.ortukSektor, 1),
    katReel: "%" + Math.round((e.katilimReel - 1) * 100), sektorReel: "%" + Math.round((e.sektorReel - 1) * 100),
    usd2015: ondalik(d.katilim2015 / 1000, 1) + " milyar dolar", usd2025: ondalik(d.katilim2025 / 1000, 1) + " milyar dolar",
    usdKat: ondalik(d.katilimKat, 1), sektorUsdKat: ondalik(d.sektorKat, 2),
    usd2024: ondalik(K.satir(2024, "USD").katilim / 1000, 1) + " milyar dolar",
    gereken: ondalik(g.tutar / 1e6, 2) + " trilyon TL", gerekenKat: ondalik(g.kat, 2),
    yillik10: ondalik(h.yillik10, 2), yil10: String(Math.floor(h.yil10)),
    yillikSon: ondalik(h.yillikSon, 2), yilSon: String(Math.floor(h.yilSon)),
    dunyaToplam: ondalik(w.toplam / 1000, 1) + " trilyon dolar", trMilyar: w.turkiye.milyar + " milyar dolar",
    trSira: String(w.sira), trPay: yz(w.payi, 1), iranPay: yz(iran.milyar / w.toplam * 100, 1)
  };
}

function olcutBlok() {
  var o = K.olcutler();
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>TKBB'nin 2025 hedefleri ve BDDK verisiyle gerçekleşen (Aralık 2025)</caption>",
    '<thead><tr><th scope="col">Ölçüt</th><th scope="col">Hedef</th><th scope="col">Gerçekleşen</th><th scope="col">Gerçekleşen / hedef</th></tr></thead>', "<tbody>"];
  o.forEach(function (r) {
    var f = r.birim === "%" ? function (v) { return yz(v, v === Math.round(v) ? 0 : 2); } : function (v) { return ondalik(v, 2) + " " + r.birim; };
    t.push('<tr><th scope="row">' + esc(r.ad) + "</th><td>" + f(r.hedef) + "</td><td>" + f(r.gercek) + "</td><td>%" + Math.round(r.oran * 100) + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

function seriBlok() {
  var s = K.seri().filter(function (r) { return r.yil >= 2015; });
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>Katılım bankaları, Aralık sonları ve son ay (BDDK)</caption>",
    '<thead><tr><th scope="col">Dönem</th><th scope="col">Katılım aktifi, milyar TL</th><th scope="col">Sektör, trilyon TL</th><th scope="col">Pay</th><th scope="col">Katılım aktifi, milyar $</th></tr></thead>', "<tbody>"];
  s.forEach(function (r) {
    t.push('<tr><th scope="row">' + (r.aralik ? r.yil : ayAdi(r.ay)) + "</th><td>" + nf0.format(Math.round(r.katilimTL / 1000)) + "</td><td>" + ondalik(r.sektorTL / 1e6, 1) +
      "</td><td>" + yz(r.pay) + "</td><td>" + ondalik(r.katilimUSD / 1000, 1) + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

function dunyaBlok() {
  var w = K.dunya();
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>İslami bankacılık varlıkları, ilk on ülke, 2024 (ICD–LSEG, TKBB 2025 Faaliyet Raporu aktarımı)</caption>",
    '<thead><tr><th scope="col">Sıra</th><th scope="col">Ülke</th><th scope="col">Milyar $</th><th scope="col">Dünyadaki payı</th></tr></thead>', "<tbody>"];
  w.ulkeler.forEach(function (u, i) {
    t.push("<tr><td>" + (i + 1) + '</td><th scope="row">' + esc(u.ulke) + "</th><td>" + nf0.format(u.milyar) + "</td><td>" + yz(u.milyar / w.toplam * 100, 1) + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

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
  html = blok(html, "KAT-OLCUT", olcutBlok());
  html = blok(html, "KAT-SERI", seriBlok());
  html = blok(html, "KAT-DUNYA", dunyaBlok());
  return alanYaz(html);
}

if (require.main === module) {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var eski = fs.readFileSync(YAZI, "utf8"), yeni = uret(eski);
  if (yeni !== eski) {
    if (kontrol) { console.error("Bayat: " + path.relative(KOK, YAZI) + " — 'node tools/katilim-yazisi.js' çalıştırın."); process.exit(1); }
    fs.writeFileSync(YAZI, yeni);
  }
  console.log(kontrol ? "Katılım bankacılığı yazısı hesapla aynı." : "Katılım bankacılığı yazısı yazıldı.");
}
module.exports = { alanlar: alanlar };
