#!/usr/bin/env node
/*
 * Dizine açık maaş sayfaları birbirine ne kadar benziyor?
 *
 * NEDEN VAR
 * ---------
 * Search Console verisi (Eylül 2026): dizine girmesi amaçlanan sekiz maaş
 * sayfasının ALTISI dizinde değil — dördü hiç taranmamış, ikisi taranıp
 * alınmamış. Sebep ölçüldü: bu sekiz sayfa, sekiz kelimelik dizilerinin
 * yaklaşık dörtte birini birbiriyle paylaşıyor. Makalelerde aynı ölçü
 * binde bir. Yani maaş sayfaları makalelerden yüzlerce kat daha benzer ve
 * Google bunlardan birkaçını temsilci alıp gerisini elemiş durumda.
 *
 * BU TEST BENZERLİĞİ ÇÖZMÜYOR, GERİLEMESİNİ ENGELLİYOR
 * ---------------------------------------------------
 * Üretimle farklılaştırma iki kez denendi ve ikisi de ölçüldü:
 *   1. Banda göre dallanan paragraflar — ÖZGÜ PAYI DÜŞÜRDÜ (%37,1 -> %33,2).
 *      Sekiz sayfanın beşi üç eksende de aynı banda düştüğü için üç özdeş
 *      paragraf alıyorlardı. Metin eklemek ortak kütleyi büyütüyor.
 *   2. Nesirsiz, yalnızca sayı taşıyan tanım listesi — nötr (%36,9).
 *
 * Çıkarılan sonuç: "X TL brüt ne kadar net" sorusuna cevap veren sekiz
 * sayfa, yapı olarak aynı sayfadır ve üretimle ayrıştırılamaz. Ayrışma
 * ancak sayfa sayısını azaltıp elle yazılan analizi artırmakla olur; bu
 * editoryal bir karardır, üreteç işi değildir.
 *
 * Testin işi bu yüzden koruma: eşikler BUGÜNKÜ ölçümün biraz gerisine
 * konuyor. Şablona yeni ortak metin eklenirse test kırmızıya döner ve
 * kararın bilinçli alınması gerekir.
 *
 * Kullanım: node tools/maas-benzerlik-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
/* Uretec BIR BETIK: yuklenince main() calisip surece exit veriyor.
   Bu yuzden require EDILMIYOR; dizine acik sayfalar dosya sisteminden
   robots etiketine bakarak bulunuyor -- boylece liste de elle
   yazilmamis oluyor. */

/* Dizine açık sayfalar, robots etiketinden OKUNUYOR — liste elle
   yazılmıyor ki üreteçteki KALICI dizisiyle ayrışmasın. */
function dizineAcikSayfalar() {
  var kok = path.join(KOK, "maas-hesaplama");
  return fs.readdirSync(kok).filter(function (d) {
    var p = path.join(kok, d, "index.html");
    if (!/-tl-brut-ne-kadar-net$/.test(d) || !fs.existsSync(p)) return false;
    return fs.readFileSync(p, "utf8").indexOf('content="noindex') < 0;
  }).map(function (d) { return path.join(kok, d, "index.html"); });
}

function govde(p) {
  var s = fs.readFileSync(p, "utf8");
  var m = s.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return (m ? m[1] : s)
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ").trim();
}

function nGram(metin, n) {
  var k = metin.split(" ");
  var s = Object.create(null), adet = 0;
  for (var i = 0; i + n <= k.length; i++) {
    var g = k.slice(i, i + n).join(" ");
    if (!s[g]) { s[g] = true; adet++; }
  }
  return { kume: s, adet: adet };
}

function jaccard(a, b) {
  var kesisim = 0;
  for (var g in a.kume) if (b.kume[g]) kesisim++;
  var birlesim = a.adet + b.adet - kesisim;
  return birlesim ? kesisim / birlesim : 0;
}

/* ------------------------------------------------------------------ */
/* Eşikler. Bugünkü ölçüm: benzerlik 0,229 — özgü pay %36,9.
   Eşikler bir miktar pay bırakıyor ki biçimsel düzeltmeler testi
   düşürmesin; ama şablona paragraf eklemek düşürsün. */
var AZAMI_BENZERLIK = 0.26;
var ASGARI_OZGU_PAYI = 0.33;

var gecen = 0, hata = 0;
function dogru(ad, k, detay) {
  if (k) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "  — " + detay : "")); }
}

console.log("Maaş sayfalarının birbirine benzerliği\n");

var sayfalar = dizineAcikSayfalar();
dogru("dizine açık sayfa bulundu", sayfalar.length >= 2,
  "bulunan: " + sayfalar.length);
if (sayfalar.length < 2) {
  console.log("\n" + gecen + " gecti, " + hata + " kaldi.");
  process.exit(hata ? 1 : 0);
}

var metin = sayfalar.map(govde);
var gram = metin.map(function (m) { return nGram(m, 8); });

/* --- 1) Sayfalar birbirine ne kadar benziyor? ---------------------- */
var ciftler = [];
for (var i = 0; i < gram.length; i++) {
  for (var j = i + 1; j < gram.length; j++) {
    ciftler.push({ j: jaccard(gram[i], gram[j]), a: sayfalar[i], b: sayfalar[j] });
  }
}
var ortalama = ciftler.reduce(function (t, c) { return t + c.j; }, 0) / ciftler.length;
var enYuksek = ciftler.reduce(function (e, c) { return c.j > e.j ? c : e; });

console.log("  ortalama benzerlik : " + ortalama.toFixed(3));
console.log("  en benzer çift     : " + enYuksek.j.toFixed(3));
dogru("ortalama benzerlik eşiğin altında", ortalama <= AZAMI_BENZERLIK,
  ortalama.toFixed(3) + " > " + AZAMI_BENZERLIK);

/* --- 2) Her sayfanın kendine özgü metni ne kadar? ------------------ */
var enDusukOzgu = 1;
sayfalar.forEach(function (p, ix) {
  var k = metin[ix].split(" ");
  var baskasinda = Object.create(null);
  gram.forEach(function (g, iy) {
    if (iy === ix) return;
    for (var x in g.kume) baskasinda[x] = true;
  });
  var isaretli = new Array(k.length);
  for (var i2 = 0; i2 + 8 <= k.length; i2++) {
    if (baskasinda[k.slice(i2, i2 + 8).join(" ")]) {
      for (var j2 = i2; j2 < i2 + 8; j2++) isaretli[j2] = true;
    }
  }
  var ortak = 0;
  for (var z = 0; z < isaretli.length; z++) if (isaretli[z]) ortak++;
  var pay = (k.length - ortak) / k.length;
  if (pay < enDusukOzgu) enDusukOzgu = pay;
});

console.log("  en düşük özgü payı : %" + (enDusukOzgu * 100).toFixed(1));
dogru("her sayfanın özgü payı tabanın üstünde", enDusukOzgu >= ASGARI_OZGU_PAYI,
  (enDusukOzgu * 100).toFixed(1) + "% < " + (ASGARI_OZGU_PAYI * 100) + "%");

/* --- KONTROL: ölçüm gerçekten çalışıyor mu? -----------------------
   Bir sayfayı kendisiyle karşılaştırmak 1,0 vermeli; iki alakasız
   metin ise sıfıra yakın. Bu olmadan yukarıdaki iddialar, benzerlik
   fonksiyonu hep 0 dönse de geçerdi. */
dogru("aynı metin kendisiyle tam benzer",
  Math.abs(jaccard(gram[0], gram[0]) - 1) < 1e-9);
var sahte = nGram("bu tamamen alakasiz bir metin parcasi olup hicbir " +
  "sekilde maas sayfalariyla ortak dizgi tasimaz", 8);
dogru("alakasız metinle benzerlik sıfıra yakın",
  jaccard(gram[0], sahte) < 0.01, String(jaccard(gram[0], sahte)));

/* --- Karşılaştırma tabanı: makaleler ------------------------------- */
var mk = fs.readdirSync(path.join(KOK, "makaleler")).filter(function (d) {
  return fs.existsSync(path.join(KOK, "makaleler", d, "index.html"));
}).slice(0, 8).map(function (d) {
  return nGram(govde(path.join(KOK, "makaleler", d, "index.html")), 8);
});
var mc = [];
for (var a1 = 0; a1 < mk.length; a1++) {
  for (var b1 = a1 + 1; b1 < mk.length; b1++) mc.push(jaccard(mk[a1], mk[b1]));
}
var makOrt = mc.reduce(function (t, x) { return t + x; }, 0) / mc.length;
console.log("  (karşılaştırma) makaleler arası: " + makOrt.toFixed(3));
dogru("makaleler maaş sayfalarından belirgin daha az benzer",
  makOrt < ortalama / 5, makOrt.toFixed(3) + " vs " + ortalama.toFixed(3));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (maas sayfa benzerligi)");
process.exit(hata ? 1 : 0);
