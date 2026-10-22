#!/usr/bin/env node
/*
 * SGK idari para cezası: aracın ve yazının statik bölümleri.
 *   Araç (sgk-idari-para-cezasi-hesaplama/):
 *     SGK-TABLO   2026 tutarları, fiil fiil
 *     data-s alanları ve SSS yapısal verisi (GÖRÜNEN metinden)
 *   Yazı (makaleler/ise-giris-bildirgesi-gecikirse-ceza/):
 *     SGK-YOLLAR  aynı geç bildirgenin beş yolu (tablo; grafik kapak görselinde)
 *     SGK-KISI    sigortalı sayısı arttıkça işe giriş ve beyanname cezası
 *     data-s alanları
 * Bütün rakamlar aracın çekirdeğinden (hesap.js); örnek ay ORNEK.
 *
 * Kullanım:
 *   node tools/sgk-ceza-sayfa.js           # yaz
 *   node tools/sgk-ceza-sayfa.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var C = require(path.join(KOK, "sgk-idari-para-cezasi-hesaplama", "hesap.js"));
var ARAC = path.join(KOK, "sgk-idari-para-cezasi-hesaplama", "index.html");
var YAZI = path.join(KOK, "makaleler", "ise-giris-bildirgesi-gecikirse-ceza", "index.html");
var ORNEK = { yil: 2026, ay: 10 };

var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(v) { return nf.format(v) + " TL"; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function h(g) { return C.hesapla(Object.assign({}, ORNEK, g)); }

function yollar() { return C.yollar(Object.assign({ fiil: "iseGiris", sigortali: 1 }, ORNEK)); }

function alanlar() {
  var y = yollar(), au = C.asgari(ORNEK.yil, ORNEK.ay);
  var k30 = h({ fiil: "iseGiris", sigortali: 1, kendiliginden30: true });
  var k = h({ fiil: "iseGiris", sigortali: 1, kendiliginden30: false });
  var t2 = h({ fiil: "iseGiris", sigortali: 1, iseGiris: "tespit" });
  var t5 = h({ fiil: "iseGiris", sigortali: 1, iseGiris: "tekrar" });
  var mphb = h({ fiil: "mphbAsil", sigortali: 1 });
  var mphbTavan = h({ fiil: "mphbAsil", sigortali: 10 });
  if (!mphbTavan.tavanUygulandi && mphbTavan.teblig !== 2 * au) throw new Error("Beyanname tavanı 10 sigortalıda değil.");
  return {
    au: tl(au),
    iseK30: tl(k30.pesin), iseK: tl(k.pesin),
    iseTespit: tl(t2.pesin), iseTespitTeblig: tl(t2.teblig),
    iseTekrar: tl(t5.pesin), iseTekrarTeblig: tl(t5.teblig),
    mphbKisi: tl(mphb.teblig), ikiAu: tl(2 * au), mphbTavanPesin: tl(mphbTavan.pesin),
    enAz: tl(y[0].tutar), enCok: tl(y[y.length - 1].tutar),
    kat: String(Math.round(y[y.length - 1].tutar / y[0].tutar)),
    birGun: tl(k.pesin - k30.pesin),
    on30: tl(h({ fiil: "iseGiris", sigortali: 10, kendiliginden30: true }).pesin),
    onTespit: tl(h({ fiil: "iseGiris", sigortali: 10, iseGiris: "tespit" }).pesin)
  };
}

/* ------------------------------------------------ araç: tutar tablosu */
function tablo() {
  var satir = [
    ["İşe giriş bildirgesi geç (kendiliğinden)", { fiil: "iseGiris", sigortali: 1 }, "1 sigortalı", true],
    ["İşe giriş, denetimde tespit", { fiil: "iseGiris", sigortali: 1, iseGiris: "tespit" }, "1 sigortalı, 2 kat", false],
    ["İşe giriş, bir yıl içinde yeniden tespit", { fiil: "iseGiris", sigortali: 1, iseGiris: "tekrar" }, "1 sigortalı, 5 kat", false],
    ["İşten ayrılış bildirgesi geç", { fiil: "istenCikis", sigortali: 1, defter: "bilanco" }, "1 sigortalı, 1/10; aylık tavan 12 / 6 / 3", true],
    ["İşyeri bildirgesi geç, bilanço", { fiil: "isyeri", defter: "bilanco" }, "3 kat", true],
    ["İşyeri bildirgesi geç, işletme defteri", { fiil: "isyeri", defter: "diger" }, "2 kat", true],
    ["İşyeri bildirgesi geç, defter yok", { fiil: "isyeri", defter: "yok" }, "1 kat", true],
    ["Beyanname (asıl) geç, sigortalı başına", { fiil: "mphbAsil", sigortali: 1 }, "1/5; en çok 2 kat (10 sigortalı)", false],
    ["Ek beyanname, sigortalı başına", { fiil: "mphbEk", sigortali: 1 }, "1/8; en çok 2 kat (16 sigortalı)", false],
    ["Eksik gün için istenen ek beyanname, bir ay geçti", { fiil: "mphbResen", sigortali: 1 }, "1/2; en çok 2 kat (4 sigortalı)", false],
    ["Denetimde bildirilmemiş sigortalı, bilanço", { fiil: "mphbTespit", sigortali: 1, defter: "bilanco" }, "kişi başı 1, en çok 3 kat", false],
    ["Defter ve belge ibraz etmeme, bilanço", { fiil: "defterIbraz", defter: "bilanco" }, "12 kat (işletme 6, defter yok 3)", false],
    ["Eksik işçilik, ay başına", { fiil: "eksikIscilik", aySayisi: 1 }, "2 kat", false]
  ];
  var p = ['<div class="table-scroll">', '<table class="data-table data-table--text pc-tablo">',
    "<caption>SGK idari para cezaları, " + ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][ORNEK.ay - 1] + " " + ORNEK.yil + " (brüt asgari ücret " + tl(C.asgari(ORNEK.yil, ORNEK.ay)) + ")</caption>",
    '<thead><tr><th scope="col">Fiil</th><th scope="col">Kural</th><th scope="col">Tebliğ</th><th scope="col">15 günde ödenirse</th><th scope="col">30 gün içinde kendiliğinden + 15 gün</th></tr></thead>', "<tbody>"];
  satir.forEach(function (s) {
    var a = h(Object.assign({ kendiliginden30: false }, s[1]));
    var b = s[3] ? h(Object.assign({ kendiliginden30: true }, s[1])) : null;
    p.push('<tr><th scope="row">' + esc(s[0]) + "</th><td>" + esc(s[2]) + "</td><td>" + tl(a.teblig) + "</td><td>" + tl(a.pesin) + "</td><td>" + (b ? tl(b.pesin) : "uygulanmaz") + "</td></tr>");
  });
  p.push("</tbody>", "</table>", "</div>");
  return p.join("\n");
}

/* ------------------------------------------------ yazı: beş yol (grafik kapak görselinde) */
function yollarBlok() {
  var y = yollar();
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>Tek sigortalı, Ekim 2026; tebliğ edilen ve ödenen tutar</caption>",
    '<thead><tr><th scope="col">Yol</th><th scope="col">Tebliğ</th><th scope="col">Ödenen</th><th scope="col">Tebliğe oranı</th></tr></thead>', "<tbody>"];
  y.forEach(function (r) {
    t.push('<tr><th scope="row">' + esc(r.ad) + (r.odeme === "gec" ? " (ayrıca gecikme cezası ve zammı)" : "") + "</th><td>" + tl(r.h.teblig) + "</td><td>" + tl(r.tutar) + "</td><td>%" + (r.tutar / r.h.teblig * 100).toFixed(2).replace(".", ",").replace(/,00$/, "") + "</td></tr>");
  });
  t.push("</tbody>", "</table>", "</div>");
  return t.join("\n");
}

/* ------------------------------------------------ yazı: kişi sayısı */
function kisiBlok() {
  var t = ['<div class="table-scroll">', '<table class="data-table">',
    "<caption>15 gün içinde ödenen ceza, sigortalı sayısına göre (Ekim 2026)</caption>",
    '<thead><tr><th scope="col">Sigortalı</th><th scope="col">İşe giriş, 30 gün içinde kendiliğinden</th><th scope="col">İşe giriş, denetimde tespit</th><th scope="col">Beyanname (asıl) geç</th></tr></thead>', "<tbody>"];
  [1, 3, 10, 25].forEach(function (n) {
    t.push('<tr><th scope="row">' + n + "</th><td>" + tl(h({ fiil: "iseGiris", sigortali: n, kendiliginden30: true }).pesin) + "</td><td>" + tl(h({ fiil: "iseGiris", sigortali: n, iseGiris: "tespit" }).pesin) + "</td><td>" + tl(h({ fiil: "mphbAsil", sigortali: n }).pesin) + "</td></tr>");
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
function duz(x) { return x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
function alanYaz(html) {
  var m = alanlar();
  return html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z0-9]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (t, ac, et, k, ic, kapa) {
    if (!(k in m)) throw new Error("Bilinmeyen data-s: " + k);
    return ac + kacis(m[k]) + kapa;
  });
}
function sss(html) {
  var i = html.indexOf('<h2 id="sss">'), j = html.indexOf("<!-- SSS:BITIS -->", i);
  if (i < 0 || j < 0) throw new Error("SSS bölümü bulunamadı.");
  var parca = html.slice(i, j), faq = [], re = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, x;
  while ((x = re.exec(parca))) faq.push({ "@type": "Question", name: duz(x[1]), acceptedAnswer: { "@type": "Answer", text: duz(x[2]) } });
  var ac = '<script type="application/ld+json">';
  var a = html.indexOf(ac), b = html.indexOf("</script>", a);
  var ld = JSON.parse(html.slice(a + ac.length, b));
  ld["@graph"].forEach(function (n) { if (n["@type"] === "FAQPage") n.mainEntity = faq; });
  return html.slice(0, a + ac.length) + "\n" + JSON.stringify(ld, null, 2).split("\n").map(function (s) { return "  " + s; }).join("\n") + "\n  " + html.slice(b);
}

function uretArac(html) { return sss(alanYaz(blok(html, "SGK-TABLO", tablo()))); }
function uretYazi(html) { return alanYaz(blok(blok(html, "SGK-YOLLAR", yollarBlok()), "SGK-KISI", kisiBlok())); }

if (require.main === module) {
  var kontrol = process.argv.indexOf("--check") >= 0, bayat = [];
  [[ARAC, uretArac], [YAZI, uretYazi]].forEach(function (x) {
    var eski = fs.readFileSync(x[0], "utf8"), yeni = x[1](eski);
    if (yeni !== eski) { if (kontrol) bayat.push(path.relative(KOK, x[0])); else fs.writeFileSync(x[0], yeni); }
  });
  if (kontrol) {
    if (bayat.length) { console.error("Bayat: " + bayat.join(", ") + " — 'node tools/sgk-ceza-sayfa.js' çalıştırın."); process.exit(1); }
    console.log("SGK ceza aracı ve yazısı hesapla aynı.");
  } else console.log("SGK ceza aracı ve yazısı yazıldı.");
}
module.exports = { alanlar: alanlar, yollar: yollar, ORNEK: ORNEK };
