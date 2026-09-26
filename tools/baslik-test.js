#!/usr/bin/env node
/*!
 * Site başlığı her sayfada aynı mı?
 *
 * NEDEN VAR
 * ---------
 * Eylül 2026'da site sahibi, ana sayfadaki hareketli "Koray Öner"
 * adının bir makalede düz ve farklı boyutta açıldığını gördü. Ölçüldü:
 * başlık beş ayrı biçimde yazılmıştı. 43 sayfada ad `brand-name`
 * sınıfını taşımıyordu. 31 sayfa script.js'i hiç yüklemiyordu: tema
 * düğmesi tıklanınca hiçbir şey olmuyor, seçilen renk ve koyu tema o
 * sayfada kayboluyordu. 15 yazının menüsünde MTV yazısından kopyalanmış
 * "ÖTV · MTV" vardı. KeyMint alt sayfalarında tema düğmesini iki betik
 * birden dinliyordu: tek tıklama temayı iki adım ilerletiyordu.
 * Kapıların hiçbiri başlığa bakmıyordu (makale-kabugu-test.js bilerek
 * dışarıda bırakmıştı).
 *
 * İDDİALAR (site-header taşıyan her sayfada)
 * ------------------------------------------
 *   1. <header class="site-header" role="banner">
 *   2. marka bağlantısı aria-label="Koray Öner ana sayfa" taşıyor, ad
 *      <span class="brand-name"> içinde
 *   3. gezinme aria-label="Birincil"
 *   4. ana sayfa dışında menünün ilk üç öğesi Ana Sayfa · Araçlar ·
 *      Makaleler ve gerçekten oraya gidiyor
 *   5. <head> içinde, ertelenmeden tema-erken.js (tema ilk boyamadan
 *      önce uygulanır, sayfa geçişinde açık/koyu yanıp sönmez)
 *   6. sitenin script.js'i yükleniyor
 *   7. tema düğmesini script.js dışında dinleyen betik yok
 *   8. menü tek satıra sığıyor. Tarayıcıda ölçüldü (Eylül 2026, 153
 *      sayfa): menü genişliği ≈ harf × 7,17 px + öğe arası 20 px. Ölçülen
 *      en geniş sığan menü 665 px (teklif-karsilastirma); bordro 721 px
 *      ile 1280 px ekranda tema düğmesini dışarı itiyordu. Sınır 680.
 *
 * Kullanım: node tools/baslik-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
/* Kendi markasını taşıyan alt projeler ve arama motoru doğrulama dosyası. */
var ATLA = ["node_modules", ".git", "_cekirdek", "_karsilastirma", "docs", "decorpalette", "dither-studio"];

function dosyalar(dizin, toplam) {
  toplam = toplam || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (g) {
    if (ATLA.indexOf(g.name) >= 0) return;
    var tam = path.join(dizin, g.name);
    if (g.isDirectory()) dosyalar(tam, toplam);
    else if (/\.html$/.test(g.name)) toplam.push(tam);
  });
  return toplam;
}

function cozumle(href, sayfa) {
  var taban = "https://korayoner.dev/" + sayfa.replace(/index\.html$/, "");
  var u = new URL(href, taban);
  return u.pathname + u.hash;
}

var hatalar = {};
function hata(ad, p, detay) { (hatalar[ad] = hatalar[ad] || []).push(p + (detay ? " -> " + detay : "")); }

var sayfa = 0;
dosyalar(KOK).forEach(function (tam) {
  var p = path.relative(KOK, tam).replace(/\\/g, "/");
  var s = fs.readFileSync(tam, "utf8");
  var h = (s.match(/<header class="site-header"[^>]*>[\s\S]*?<\/header>/) || [])[0];
  if (!h) return;
  sayfa++;

  if (h.indexOf('<header class="site-header" role="banner">') !== 0) hata("header role=banner", p);
  if (!/<a class="brand" href="[^"]+" aria-label="Koray Öner ana sayfa">/.test(h)) hata("marka aria-label", p);
  if (h.indexOf('<span class="brand-name">Koray Öner</span>') < 0) hata("marka adı .brand-name", p);
  if (h.indexOf('<nav class="site-nav" aria-label="Birincil">') < 0) hata("gezinme aria-label Birincil", p);

  if (p !== "index.html") {
    var ogeler = [];
    var re = /<li><a [^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a><\/li>/g, m;
    while ((m = re.exec(h))) ogeler.push([m[2].replace(/<[^>]+>/g, "").trim(), cozumle(m[1], p)]);
    var beklenen = [["Ana Sayfa", "/"], ["Araçlar", "/#projects"], ["Makaleler", "/makaleler/"]];
    var ilk = ogeler.slice(0, 3).map(function (o) { return o.join(" "); }).join(" · ");
    var ist = beklenen.map(function (o) { return o.join(" "); }).join(" · ");
    if (ilk !== ist) hata("menü Ana Sayfa · Araçlar · Makaleler ile başlıyor", p, ilk);
    var harf = ogeler.reduce(function (t, o) { return t + Array.from(o[0]).length; }, 0);
    var genislik = Math.round(harf * 7.17 + (ogeler.length - 1) * 20);
    if (genislik > 680) hata("menü tek satıra sığıyor", p, genislik + " px");
  }

  var bas = s.slice(0, s.indexOf("</head>"));
  var erken = bas.match(/<script[^>]*src="[^"]*tema-erken\.js(?:\?v=[0-9a-f]+)?"[^>]*>/);
  if (!erken) hata("tema-erken.js <head> içinde", p);
  else if (/\b(defer|async)\b/.test(erken[0])) hata("tema-erken.js ertelenmemeli", p, erken[0]);

  var betikler = [];
  var sr = /<script[^>]+src="([^"?]+)/g, b;
  while ((b = sr.exec(s))) betikler.push(cozumle(b[1], p));
  if (betikler.indexOf("/script.js") < 0) hata("sitenin script.js'i yükleniyor", p);
  betikler.forEach(function (yol) {
    if (yol === "/script.js") return;
    var dosya = path.join(KOK, yol);
    if (!fs.existsSync(dosya)) return;
    var icerik = fs.readFileSync(dosya, "utf8");
    if (/themeToggle/.test(icerik) && /addEventListener\(\s*["']click/.test(icerik) &&
        /getElementById\(\s*["']themeToggle/.test(icerik)) hata("tema düğmesini yalnız script.js dinliyor", p, yol);
  });
});

console.log("Site başlığı tek standartta\n\n  taranan sayfa: " + sayfa + "\n");
var IDDIALAR = ["header role=banner", "marka aria-label", "marka adı .brand-name", "gezinme aria-label Birincil",
  "menü Ana Sayfa · Araçlar · Makaleler ile başlıyor", "tema-erken.js <head> içinde", "tema-erken.js ertelenmemeli",
  "sitenin script.js'i yükleniyor", "tema düğmesini yalnız script.js dinliyor", "menü tek satıra sığıyor"];
var kalan = 0;
IDDIALAR.forEach(function (ad) {
  var l = hatalar[ad] || [];
  if (!l.length) { console.log("  tamam      " + ad); return; }
  kalan++;
  console.error("  BASARISIZ  " + ad + " (" + l.length + ")\n      " + l.slice(0, 8).join("\n      ") +
    (l.length > 8 ? "\n      ... +" + (l.length - 8) : ""));
});
if (sayfa < 150) { kalan++; console.error("  BASARISIZ  tarama kör: yalnızca " + sayfa + " sayfa bulundu"); }
console.log("\n" + (IDDIALAR.length - kalan) + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
