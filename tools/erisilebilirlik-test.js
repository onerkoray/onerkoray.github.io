#!/usr/bin/env node
/*!
 * Erişilebilirlik: makinece kesin karar verilebilen kontroller.
 *
 * NEDEN VAR
 * ---------
 * Site erişilebilirlik iddia ediyor — Person.knowsAbout içinde "Web
 * erişilebilirliği (WCAG)" yazıyor ve araç sayfaları skip-link, ARIA
 * rolleri ve görünmez başlıklar taşıyor. Ama hiçbir kontrol bu ekseni
 * ölçmüyordu. Ölçülmeyen bir iddia, iddiadır.
 *
 * İlk tarama 143 sayfada bir gerçek kusur buldu: dither-studio'daki
 * dithering yöntemi seçicisinin erişilebilir adı yoktu. <legend>
 * fieldset'i adlandırır, içindeki kontrolü değil.
 *
 * YALNIZCA KESİN OLANLAR
 * ----------------------
 * Kontrast, odak sırası, ekran okuyucu deneyimi ve "alt metni anlamlı
 * mı" statik olarak karara bağlanamaz. Bunları denemek uydurma bulgu
 * üretirdi; kapı yalnızca ikili cevabı olan şeyleri soruyor.
 *
 * GİZLİ ALAN KUSUR DEĞİLDİR
 * -------------------------
 * hidden ya da aria-hidden bir alan erişilebilirlik ağacında yoktur;
 * görünür bir düğme onu tetikliyorsa ad o düğmededir. İlk sürüm bunu
 * bilmiyordu ve dither-studio'nun dosya seçicisini haksız işaretledi.
 *
 * Kullanım: node tools/erisilebilirlik-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var ATLA = { "node_modules": 1, ".git": 1, "_cekirdek": 1, ".github": 1,
             images: 1, docs: 1 };

/* Arama motoru doğrulama dosyası: gövdesi yok, lang ve h1 beklenmez. */
var MUAF = ["google96cf4fdc28fcda5f.html"];

function sayfalar(dizin, out) {
  out = out || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (d) {
    var p = path.join(dizin, d.name);
    if (d.isDirectory()) {
      if (!ATLA[d.name] && d.name.charAt(0) !== ".") sayfalar(p, out);
    } else if (d.name.endsWith(".html")) {
      out.push(path.relative(KOK, p).replace(/\\/g, "/"));
    }
  });
  return out;
}

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

console.log("Erişilebilirlik kontrolleri\n");

var hepsi = sayfalar(KOK).filter(function (p) { return MUAF.indexOf(p) < 0; });
console.log("  taranan sayfa: " + hepsi.length + "\n");

var altsiz = [], etiketsiz = [], langsiz = [], h1siz = [], cokH1 = [], bosBag = [];

hepsi.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  var g = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");

  (g.match(/<img\b[^>]*>/g) || []).forEach(function (m) {
    if (m.indexOf("alt=") < 0) altsiz.push(p + "  " + m.slice(0, 70));
  });

  var etiketler = {};
  (g.match(/<label[^>]+for="([^"]+)"/g) || []).forEach(function (m) {
    etiketler[m.replace(/[\s\S]*for="([^"]+)"/, "$1")] = true;
  });

  var alanKal = /<(input|select|textarea)\b([^>]*)>/g, m;
  while ((m = alanKal.exec(g)) !== null) {
    var oz = m[2];
    var tip = /type="([^"]+)"/.exec(oz);
    if (tip && /^(hidden|submit|button|reset|image)$/.test(tip[1])) continue;
    /* Gizli alan erişilebilirlik ağacında yok; adı tetikleyen düğmede. */
    if (/\bhidden\b/.test(oz) || /aria-hidden="true"/.test(oz)) continue;
    if (/aria-label(ledby)?=/.test(oz)) continue;
    var kid = /id="([^"]+)"/.exec(oz);
    if (kid && etiketler[kid[1]]) continue;
    /* <label> içine sarılmış alan da adlandırılmıştır. */
    var bas = g.lastIndexOf("<label", m.index);
    var kapa = bas >= 0 ? g.indexOf("</label>", bas) : -1;
    if (bas >= 0 && kapa > m.index) continue;
    etiketsiz.push(p + "  " + m[0].slice(0, 70));
  }

  if (!/<html[^>]+lang="/.test(s)) langsiz.push(p);
  var h1 = (g.match(/<h1\b/g) || []).length;
  if (h1 === 0) h1siz.push(p);
  if (h1 > 1) cokH1.push(p + " (" + h1 + ")");

  var bagKal = /<a\b([^>]*)>([\s\S]{0,200}?)<\/a>/g, b;
  while ((b = bagKal.exec(g)) !== null) {
    if (/aria-label=|aria-hidden="true"/.test(b[1])) continue;
    if (b[2].replace(/<[^>]+>/g, "").trim()) continue;
    if (/<img\b/.test(b[2])) continue;          // görsel bağlantı: alt taşır
    bosBag.push(p + "  " + b[0].slice(0, 70));
  }
});

function bildir(ad, liste) {
  dogru(ad, liste.length === 0,
    liste.slice(0, 6).join("\n      ") +
    (liste.length > 6 ? "\n      ... +" + (liste.length - 6) : ""));
}

bildir("her görselin alt özniteliği var", altsiz);
bildir("her form alanının erişilebilir adı var", etiketsiz);
bildir("her sayfada lang özniteliği var", langsiz);
bildir("her sayfada tam olarak bir h1 var", h1siz.concat(cokH1));
bildir("hiçbir bağlantı metinsiz değil", bosBag);

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: yüzden fazla sayfa tarandı", hepsi.length > 100,
  String(hepsi.length));
/* Tarama gerçekten form alanı görüyor mu? Sıfır alan bulan bir tarama
   "etiketsiz alan yok" derdi ve bu hiçbir şey anlatmazdı. */
var alanSayisi = 0;
hepsi.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  alanSayisi += (s.match(/<(input|select|textarea)\b/g) || []).length;
});
dogru("KONTROL: sitede yüzlerce form alanı var", alanSayisi > 200,
  String(alanSayisi));
var gorselSayisi = 0;
hepsi.forEach(function (p) {
  gorselSayisi += (fs.readFileSync(path.join(KOK, p), "utf8")
    .match(/<img\b/g) || []).length;
});
dogru("KONTROL: sitede yüzlerce görsel var", gorselSayisi > 100,
  String(gorselSayisi));

/* Marka zemini üstündeki yazı. 6 Kasım 2026'ya kadar koyu temada marka rengi
   açılıyor, yazı beyaz kalıyordu: bütün birincil düğmelerde kontrast 2,2–2,6.
   Oran token düzeyinde hesaplanır; sayfadaki ölçüm tools/form-test.js'te. */
var css = fs.readFileSync(path.join(KOK, "style.css"), "utf8");
function parlaklik(h) {
  var c = [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }).map(function (x) {
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function kontrast(a, b) {
  var x = parlaklik(a), y = parlaklik(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
var koyuYazi = (/--brand: var\(--accent-bright\);[^}]*?--brand-contrast: (#[0-9a-fA-F]{6})/.exec(css) || [])[1];
dogru("koyu temada marka yazısı tanımlı", !!koyuYazi);
var paletler = [["grafit", /:root[^{]*\{[^}]*?--accent: (#[0-9a-fA-F]{6})[^}]*?--accent-bright: (#[0-9a-fA-F]{6})/.exec(css)]];
["yesil", "lacivert", "bordo"].forEach(function (p) {
  paletler.push([p, new RegExp('data-accent="' + p + '"\\]\\s*\\{[^}]*?--accent:\\s*(#[0-9a-fA-F]{6})[^}]*?--accent-bright:\\s*(#[0-9a-fA-F]{6})').exec(css)]);
});
paletler.forEach(function (p) {
  dogru(p[0] + " paleti okundu", !!p[1]);
  if (!p[1]) return;
  var acik = kontrast(p[1][1], "#ffffff"), koyu = kontrast(p[1][2], koyuYazi || "#ffffff");
  dogru(p[0] + ": açık temada marka üstü yazı ≥ 4,5", acik >= 4.5, acik.toFixed(2));
  dogru(p[0] + ": koyu temada marka üstü yazı ≥ 4,5", koyu >= 4.5, koyu.toFixed(2));
});
var sabit = [];
[path.join(KOK, "style.css")].concat(fs.readdirSync(KOK).map(function (d) { return path.join(KOK, d, "style.css"); }).filter(function (f) { return fs.existsSync(f); })).forEach(function (f) {
  var m, re = /([^{}]+)\{([^{}]*)\}/g, t = fs.readFileSync(f, "utf8");
  while ((m = re.exec(t))) {
    if (/background(-color)?:\s*var\(--brand\b/.test(m[2]) && /(^|[;\s])color:\s*(#fff\b|#ffffff\b|white\b)/.test(m[2])) sabit.push(path.basename(path.dirname(f)) + " " + m[1].trim().slice(0, 50));
  }
});
dogru("marka zemininde sabit beyaz yazı yok", sabit.length === 0, sabit.join(" | "));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (erişilebilirlik)");
process.exit(hata ? 1 : 0);
