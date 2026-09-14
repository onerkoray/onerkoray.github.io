#!/usr/bin/env node
/*!
 * Görsel SEO regresyonları.
 *
 * NEDEN VAR
 * ---------
 * Görsel tarafındaki bozulmalar SESSİZDİR: sayfa açılır, grafik görünür,
 * yalnızca Google onu bulamaz ya da paylaşım kartı boş çıkar. Kimse hata
 * bildirmez.
 *
 * 2026-09-14 denetimi iki boşluk buldu:
 *   1. 21 makalenin 12'sinin gövdesinde HİÇ <img> yoktu — veri görselleri
 *      CSS ile çiziliyordu ve görsel aramaya görünmezdi.
 *   2. Beş makalede primaryImageOfPage eksikti (on altısında vardı).
 *
 * Bu test o iki boşluğun geri açılmasını ve mevcut hijyenin bozulmasını
 * engelliyor. Hijyen ölçüldü ve TAMDI: 323 <img>, sıfır eksik alt, sıfır
 * eksik width/height, lazy yüklenen hero yok. Korunan şey bu.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var hata = 0, gecen = 0;

function dogru(ad, k, detay) {
  if (!k) { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
  else { gecen++; console.log("  tamam      " + ad); }
}
function esit(ad, b, bek) {
  if (b !== bek) { hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b); }
  else { gecen++; console.log("  tamam      " + ad); }
}

var ATLA = { ".git": 1, node_modules: 1, _cekirdek: 1, ".github": 1, images: 1, docs: 1 };
function sayfalar(dizin, out) {
  fs.readdirSync(path.join(KOK, dizin || "."), { withFileTypes: true }).forEach(function (d) {
    var p = dizin ? dizin + "/" + d.name : d.name;
    if (d.isDirectory()) { if (!ATLA[d.name] && d.name.charAt(0) !== ".") sayfalar(p, out); }
    else if (d.name.endsWith(".html")) out.push(p);
  });
  return out;
}
var hepsi = sayfalar("", []);
function oku(p) { return fs.readFileSync(path.join(KOK, p), "utf8"); }
function govde(s) { return s.replace(/<head[\s\S]*?<\/head>/, ""); }

/* ---------------------------------------------------------------- *
 * 1. Hijyen: alt, width/height, lazy hero
 * ---------------------------------------------------------------- */
console.log("Görsel hijyeni (tüm site)");
var altsiz = [], boyutsuz = [], lazyIlk = [];
var toplamImg = 0;
hepsi.forEach(function (p) {
  var g = govde(oku(p));
  var imgs = g.match(/<img[^>]*>/g) || [];
  imgs.forEach(function (t, i) {
    toplamImg++;
    if (t.indexOf("alt=") < 0) altsiz.push(p);
    if (!/\bwidth=/.test(t) || !/\bheight=/.test(t)) boyutsuz.push(p + " :: " + t.slice(0, 60));
    /* Sayfanin ILK icerik gorseli LCP adayidir; lazy olursa LCP gecikir.
       Marka isareti ve yazar portresi disarida: ikisi de kucuk ve
       kasitli olarak lazy. */
    if (i === 0 && t.indexOf('loading="lazy"') >= 0 &&
        t.indexOf("brand-mark") < 0 && t.indexOf("portre") < 0) lazyIlk.push(p);
  });
});
dogru("her <img> alt taşıyor (" + toplamImg + " görsel)", altsiz.length === 0,
  altsiz.slice(0, 5).join("\n      "));
dogru("her <img> width ve height taşıyor (CLS)", boyutsuz.length === 0,
  boyutsuz.slice(0, 5).join("\n      "));
dogru("ilk içerik görseli hiçbir sayfada lazy değil", lazyIlk.length === 0,
  lazyIlk.slice(0, 5).join(", "));

/* ---------------------------------------------------------------- *
 * 2. Paylaşım metadatası sayfa BAŞINA özgün
 * ---------------------------------------------------------------- */
console.log("\nPaylaşım görselleri sayfaya özgü");
function icerik(p) {
  return (/^makaleler\/.+\//.test(p) && p !== "makaleler/index.html") ||
         (p.split("/").length === 2 && p.endsWith("index.html"));
}
var ogEksik = [], twEksik = [], paylasim = {};
hepsi.filter(icerik).forEach(function (p) {
  if (p.indexOf("decorpalette") === 0) return;   // alt proje, kendi markası
  var s = oku(p);
  var og = s.match(/<meta property="og:image" content="([^"]+)"/);
  var tw = s.match(/<meta name="twitter:image" content="([^"]+)"/);
  if (!og) ogEksik.push(p); else (paylasim[og[1]] = paylasim[og[1]] || []).push(p);
  if (!tw) twEksik.push(p);
});
dogru("her içerik sayfasında og:image var", ogEksik.length === 0, ogEksik.slice(0, 5).join(", "));
dogru("her içerik sayfasında twitter:image var", twEksik.length === 0, twEksik.slice(0, 5).join(", "));
/* Ayni gorsel cok sayfada paylasilirsa o sayfalar birbirinden ayirt
   edilemez hale gelir. Bordro iki sayfa paylasiyor (arac + metodoloji),
   ucu asan bir kume gerileme demektir. */
var cokPaylasilan = Object.keys(paylasim).filter(function (k) { return paylasim[k].length > 2; });
dogru("hiçbir paylaşım görseli ikiden fazla sayfada kullanılmıyor",
  cokPaylasilan.length === 0,
  cokPaylasilan.map(function (k) {
    return k.split("/").pop() + " -> " + paylasim[k].length + " sayfa";
  }).join(", "));

/* ---------------------------------------------------------------- *
 * 3. Makalelerin veri görseli CRAWL EDİLEBİLİR
 * ---------------------------------------------------------------- */
console.log("\nMakalelerin gövdesinde gerçek <img> var");
var manifest = JSON.parse(oku("tools/makaleler.json"));
var govdesizler = [], eksikDosya = [], altsizLead = [];
manifest.forEach(function (k) {
  var p = "makaleler/" + k.slug + "/index.html";
  if (!fs.existsSync(path.join(KOK, p))) return;
  var g = govde(oku(p));
  var imgs = (g.match(/<img[^>]*>/g) || []).filter(function (t) {
    return t.indexOf("portre") < 0 && t.indexOf("brand-mark") < 0;
  });
  if (imgs.length === 0) { govdesizler.push(k.slug); return; }
  /* Lead blogu varsa: gorsel dosyasi gercekten var mi, alt bos mu. */
  var lead = g.match(/<figure class="ed-veri-gorseli">[\s\S]*?<\/figure>/);
  if (lead) {
    var src = (lead[0].match(/src="([^"]+)"/) || [])[1] || "";
    var dosya = path.join(KOK, "makaleler", k.slug, src);
    if (!fs.existsSync(dosya)) eksikDosya.push(k.slug + " -> " + src);
    var alt = (lead[0].match(/alt="([^"]*)"/) || [])[1] || "";
    if (alt.trim().length < 20) altsizLead.push(k.slug);
  }
});
dogru("hiçbir makale gövdesiz kalmıyor", govdesizler.length === 0,
  govdesizler.join(", "));
dogru("lead görselinin dosyası gerçekten var", eksikDosya.length === 0,
  eksikDosya.join(", "));
dogru("lead alt metni açıklayıcı (20+ karakter)", altsizLead.length === 0,
  altsizLead.join(", "));

/* Alt ve altyazi AYNI OLMAMALI: ayni yazilirsa alt gereksizlesir ve
   kritik veri yalniz alt icinde kalma riskine doner. */
console.log("\nAlt metni ile altyazı ayrı şeyler söylüyor");
var ayniOlan = [];
manifest.forEach(function (k) {
  if (!k.altyazi) return;
  if (k.alt && k.alt.trim() === k.altyazi.trim()) ayniOlan.push(k.slug);
});
dogru("hiçbir makalede alt ve altyazı birebir aynı değil", ayniOlan.length === 0,
  ayniOlan.join(", "));

/* ---------------------------------------------------------------- *
 * 4. Yapısal veri: Article.image ve primaryImageOfPage
 * ---------------------------------------------------------------- */
console.log("\nYapısal veride görsel");
var imageSiz = [], primarySiz = [], bozukLd = [];
manifest.forEach(function (k) {
  var p = "makaleler/" + k.slug + "/index.html";
  if (!fs.existsSync(path.join(KOK, p))) return;
  var s = oku(p);
  var bloklar = s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  var dugumler = [];
  bloklar.forEach(function (b) {
    try {
      var d = JSON.parse(b.replace(/<[^>]+>/g, ""));
      dugumler = dugumler.concat(d["@graph"] || [d]);
    } catch (e) { bozukLd.push(k.slug + ": " + e.message); }
  });
  var makale = dugumler.filter(function (n) {
    return n["@type"] === "Article" || n["@type"] === "ScholarlyArticle";
  })[0];
  if (!makale || !makale.image) imageSiz.push(k.slug);
  var sayfa = dugumler.filter(function (n) { return n["@type"] === "WebPage"; })[0];
  if (!sayfa || !sayfa.primaryImageOfPage) primarySiz.push(k.slug);
});
dogru("JSON-LD sözdizimi geçerli", bozukLd.length === 0, bozukLd.slice(0, 3).join("\n      "));
dogru("her makalede Article.image var", imageSiz.length === 0, imageSiz.join(", "));
dogru("her makalede primaryImageOfPage var", primarySiz.length === 0, primarySiz.join(", "));

/* Araclar WebPage dugumu tasimaz; WebApplication kendi image alanini
   tasir. Sirf primaryImageOfPage icin ikinci bir sayfa varligi acmak
   cakisan iki tanim uretirdi — bu yuzden orada ARANMIYOR, ama
   WebApplication.image'in varligi araniyor. */
console.log("\nAraçlarda WebApplication.image");
var aracImageSiz = [];
hepsi.filter(function (p) {
  return p.split("/").length === 2 && p.endsWith("index.html") &&
         p.indexOf("decorpalette") !== 0 && p.indexOf("makaleler") !== 0;
}).forEach(function (p) {
  var s = oku(p);
  var bloklar = s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  var bulundu = false;
  bloklar.forEach(function (b) {
    try {
      var d = JSON.parse(b.replace(/<[^>]+>/g, ""));
      (d["@graph"] || [d]).forEach(function (n) {
        /* Sayfalar tek bir varlik tipi kullanmiyor ve kullanmamali:
           arac WebApplication, bordro TechArticle, hakkimda ProfilePage.
           Her tip sayfayi temsil eden gorseli KENDI alaniyla soyler —
           CreativeWork tureyenlerde `image`, WebPage tureyenlerde
           `primaryImageOfPage`. Test hepsine ayni etiketi dayatmiyor,
           tipe uygun olani ariyor. */
        var t = n["@type"];
        if ((t === "WebApplication" || t === "SoftwareApplication" ||
             t === "TechArticle") && n.image) bulundu = true;
        if ((t === "WebPage" || t === "ProfilePage" || t === "ContactPage") &&
            n.primaryImageOfPage) bulundu = true;
      });
    } catch (e) { /* sozdizimi ayri kontrol ediliyor */ }
  });
  if (!bulundu) aracImageSiz.push(p);
});
dogru("her araç sayfası yapısal veride görselini söylüyor", aracImageSiz.length === 0,
  aracImageSiz.slice(0, 6).join(", "));

/* ---------------------------------------------------------------- *
 * 5. Sitemap görselleri gerçekten var
 * ---------------------------------------------------------------- */
console.log("\nSitemap'teki görsel adresleri diskte var");
var sm = oku("sitemap.xml");
var kirik = [];
(sm.match(/<image:loc>([^<]+)<\/image:loc>/g) || []).forEach(function (m) {
  var url = m.replace(/<\/?image:loc>/g, "");
  var yol = url.replace("https://korayoner.dev/", "");
  if (!fs.existsSync(path.join(KOK, yol))) kirik.push(url);
});
dogru("sitemap görsellerinin hepsi diskte", kirik.length === 0, kirik.slice(0, 5).join("\n      "));

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (görsel SEO kontrolleri)");
