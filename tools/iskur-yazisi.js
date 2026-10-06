#!/usr/bin/env node
/*
 * İŞKUR GÜÇ yazısı ve hesaplayıcı sayfasının statik bölümleri:
 *   Yazı (makaleler/iskur-19-bin-tl-gercekte-ne/):
 *     ISK-HARITA  beş program: kim, ne alır, durumu (diyagram)
 *     ISK-AYLAR   aynı gün başlayan iki gencin ay ay cep harçlığı
 *     ISK-HEDEF   Ağustos 2026 hedef ve gerçekleşme
 *     data-s alanları
 *   Araç (iskur-genclik-programi-hesaplama/):
 *     data-s alanları ve SSS yapısal verisi (GÖRÜNEN metinden)
 * Rakamlar yazının modülünden (guc.js) ve aracın çekirdeğinden (hesap.js).
 * SVG renkleri editoryal.css'teki .ed-grafik sınıflarından (--dv-*).
 *
 * Kullanım:
 *   node tools/iskur-yazisi.js           # yaz
 *   node tools/iskur-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var G = require(path.join(KOK, "makaleler", "iskur-19-bin-tl-gercekte-ne", "guc.js"));
var I = G.I;
var YAZI = path.join(KOK, "makaleler", "iskur-19-bin-tl-gercekte-ne", "index.html");
var ARAC = path.join(KOK, "iskur-genclik-programi-hesaplama", "index.html");

var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function tl(v) { return nf.format(Math.round(v)) + " TL"; }
function tl2(v) { return nf2.format(v) + " TL"; }
function yuzde(v) { return "%" + (v * 100).toFixed(1).replace(".", ","); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
var AYK = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function figur(id, baslik, alt, svg, aciklama) {
  return ['<figure class="ed-grafik" aria-labelledby="' + id + '-b">',
    '<p class="ed-grafik-baslik" id="' + id + '-b">' + esc(baslik) + "</p>",
    '<p class="ed-grafik-alt">' + esc(alt) + "</p>",
    '<div class="ed-grafik-kap">' + svg + "</div>",
    "<figcaption>" + aciklama + "</figcaption>", "</figure>"].join("\n");
}

/* ------------------------------------------------ 1. harita */
function haritaSvg() {
  /* [kod, kim (kalın), kim (ayrıntı), program, ne alır, 1.375 TL bu programda mı] */
  var satir = [
    ["genclik", "Üniversite öğrencisi", "devlet üniversitesi, örgün", "İŞKUR Gençlik Programı", "Günde " + tl(I.gunluk(2026)) + "; haftada en çok 3 gün", true],
    ["niup", "NEET genç", "ne okulda ne işte", "NEET İşgücü Uyum Programı", "Günde " + tl(I.gunluk(2026)) + "; ilk 4 hafta 5 gün", true],
    ["ilkadim", "İlk işine giren", "18–25 yaş, özel sektör", "İşe İlk Adım", "İlk 6 ayın ücreti ve primi devletten", false],
    ["staj", "Staj yapacak öğrenci", "yükseköğretim", "Staj desteği", "Staj yeri; mali destek ve sigorta", false],
    ["meslek", "Meslek lisesi, MYO", "son sınıf", "Geleceğim Meslekte", "Bire bir danışmanlık; harçlık yok", false]
  ];
  var W = 640, SATIR = 60, UST = 28, H = UST + satir.length * SATIR;
  var KX = 186, KW = 262, DX = 462, DW = 84;
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ih-t ih-d">',
    '<title id="ih-t">GÜÇ kapsamındaki beş program</title>',
    '<desc id="ih-d">' + esc(satir.map(function (s) {
      var pr = G.program(s[0]);
      return s[1] + " (" + s[2] + "): " + s[3] + ", " + s[4] + ", Ağustos 2026'da " + nf.format(pr.gerceklesen) + " genç";
    }).join("; ") + ". 1.375 TL günlük ödeme yalnız ilk iki programda.") + "</desc>"];
  p.push('<text class="kucuk" x="0" y="12">KİM</text><text class="kucuk" x="' + KX + '" y="12">PROGRAM</text><text class="kucuk" x="' + DX + '" y="12">AĞUSTOS 2026</text>');
  satir.forEach(function (s, i) {
    var y = UST + i * SATIR, pr = G.program(s[0]), basladi = pr.gerceklesen > 0, orta = y + (SATIR - 10) / 2;
    p.push('<text class="deger" x="0" y="' + (orta - 3) + '">' + esc(s[1]) + "</text>");
    p.push('<text class="kucuk" x="0" y="' + (orta + 13) + '">' + esc(s[2]) + "</text>");
    p.push('<path class="izgara" d="M' + (KX - 18) + " " + orta + " H" + KX + '"/>');
    p.push('<rect class="' + (s[5] ? "kutu-vurgu" : "kutu") + '" x="' + KX + '" y="' + y + '" width="' + KW + '" height="' + (SATIR - 10) + '" rx="6"/>');
    p.push('<text class="deger" x="' + (KX + 12) + '" y="' + (orta - 3) + '">' + esc(s[3]) + "</text>");
    p.push('<text class="kucuk" x="' + (KX + 12) + '" y="' + (orta + 13) + '">' + esc(s[4]) + "</text>");
    p.push('<rect class="' + (basladi ? "durum-iyi" : "durum-yok") + '" x="' + DX + '" y="' + (orta - 17) + '" width="' + DW + '" height="18" rx="9"/>');
    p.push('<text class="durum-yazi" x="' + (DX + DW / 2) + '" y="' + (orta - 4) + '" text-anchor="middle">' + (basladi ? "yürüyor" : "başlamadı") + "</text>");
    p.push('<text class="kucuk" x="' + DX + '" y="' + (orta + 15) + '">' + nf.format(pr.gerceklesen) + " genç</text>");
  });
  var y1 = UST, y2 = UST + 2 * SATIR - 10, bx = DX + DW + 14;
  p.push('<path class="sifir" d="M' + bx + " " + y1 + " h6 V" + y2 + " h-6" + '"/>');
  p.push('<text class="deger" x="' + (bx + 14) + '" y="' + ((y1 + y2) / 2 - 3) + '">1.375</text><text class="kucuk" x="' + (bx + 14) + '" y="' + ((y1 + y2) / 2 + 12) + '">TL/gün</text>');
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 2. ay ay */
function aylarSvg() {
  var o = G.ornekler(), a = o.genclik.aylar, b = o.iup.aylar;
  var aylar = []; a.concat(b).forEach(function (x) { if (aylar.indexOf(x.ay) < 0) aylar.push(x.ay); }); aylar.sort();
  function bul(l, k) { var r = l.filter(function (x) { return x.ay === k; })[0]; return r ? r.tutar : 0; }
  var W = 640, SOL = 46, SAG = 632, UST = 30, ALT = 220, H = 262;
  var enCok = Math.max.apply(null, aylar.map(function (k) { return Math.max(bul(a, k), bul(b, k)); }));
  var tavan = Math.ceil(enCok / 5000) * 5000;
  function y(v) { return ALT - v / tavan * (ALT - UST); }
  var gen = (SAG - SOL) / aylar.length, w = Math.min(16, gen * 0.32);
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ia-t ia-d">',
    '<title id="ia-t">Ay ay cep harçlığı: üniversiteli ve NEET genç</title>',
    '<desc id="ia-d">' + esc(aylar.map(function (k) { return k + ": Gençlik " + tl(bul(a, k)) + ", NEET " + tl(bul(b, k)); }).join("; ")) + "</desc>"];
  p.push('<rect class="seri-1" x="' + SOL + '" y="4" width="11" height="11" rx="2"/><text x="' + (SOL + 16) + '" y="14">Üniversiteli, haftada 3 gün</text>');
  p.push('<rect class="seri-2" x="' + (SOL + 200) + '" y="4" width="11" height="11" rx="2"/><text x="' + (SOL + 216) + '" y="14">NEET programı</text>');
  p.push('<path class="normal" d="M' + (SOL + 330) + ' 9.5 h14"/><text x="' + (SOL + 350) + '" y="14">19.250 TL (14 gün)</text>');
  for (var v = 0; v <= tavan; v += 5000) {
    p.push('<path class="' + (v ? "izgara" : "sifir") + '" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v / 1000) + (v ? " bin" : "") + "</text>");
  }
  p.push('<path class="normal" d="M' + SOL + " " + y(19250).toFixed(1) + " H" + SAG + '"/>');
  aylar.forEach(function (k, i) {
    var cx = SOL + gen * (i + 0.5);
    [[a, "seri-1", -1], [b, "seri-2", 1]].forEach(function (s) {
      var t = bul(s[0], k);
      if (t) p.push('<rect class="' + s[1] + '" x="' + (cx + (s[2] < 0 ? -w - 1 : 1)).toFixed(1) + '" y="' + y(t).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (ALT - y(t)).toFixed(1) + '" rx="2"/>');
    });
    p.push('<text x="' + cx.toFixed(1) + '" y="' + (ALT + 16) + '" text-anchor="middle">' + AYK[+k.slice(5) - 1] + "</text>");
    if (k.slice(5) === "01" || i === 0) p.push('<text class="kucuk" x="' + cx.toFixed(1) + '" y="' + (ALT + 32) + '" text-anchor="middle">' + k.slice(0, 4) + "</text>");
  });
  var ilk = b[0];
  p.push('<text class="deger" x="' + (SOL + gen * 0.5 + w + 4).toFixed(1) + '" y="' + (y(ilk.tutar) + 4).toFixed(1) + '">' + tl(ilk.tutar) + "</text>");
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 3. hedef */
function hedefSvg() {
  var d = G.VERI.programlar.slice().sort(function (x, y) { return G.oran(y) - G.oran(x); });
  var W = 640, SOL = 196, SAG = 560, UST = 8, SATIR = 40, H = UST + d.length * SATIR + 24;
  var MAX = 1.1;
  function x(o) { return SOL + Math.min(o, MAX) / MAX * (SAG - SOL); }
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ie-t ie-d">',
    '<title id="ie-t">GÜÇ programlarında hedef ve gerçekleşme, Ağustos 2026</title>',
    '<desc id="ie-d">' + esc(d.map(function (s) { return s.ad + ": " + nf.format(s.gerceklesen) + " / " + nf.format(s.hedef) + ", " + yuzde(G.oran(s)); }).join("; ")) + "</desc>"];
  [0, 0.25, 0.5, 0.75, 1].forEach(function (o) {
    p.push('<path class="' + (o === 1 ? "esik" : "izgara") + '" d="M' + x(o).toFixed(1) + " " + UST + " V" + (UST + d.length * SATIR) + '"/>');
    p.push('<text class="kucuk" x="' + x(o).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + "%" + Math.round(o * 100) + "</text>");
  });
  d.forEach(function (s, i) {
    var cy = UST + i * SATIR + SATIR / 2, o = G.oran(s);
    p.push('<text class="deger" x="' + (SOL - 10) + '" y="' + (cy - 2) + '" text-anchor="end">' + esc(s.ad) + "</text>");
    p.push('<text class="kucuk" x="' + (SOL - 10) + '" y="' + (cy + 13) + '" text-anchor="end">' + nf.format(s.gerceklesen) + " / " + nf.format(s.hedef) + "</text>");
    if (o > 0) p.push('<rect class="seri-1" x="' + SOL + '" y="' + (cy - 8) + '" width="' + Math.max(2, x(o) - SOL).toFixed(1) + '" height="16" rx="3"/>');
    p.push('<text class="deger" x="' + (x(o) + 8).toFixed(1) + '" y="' + (cy + 5) + '">' + yuzde(o) + "</text>");
  });
  p.push("</svg>");
  return p.join("");
}

function alanlar() {
  var o = G.ornekler(), k = I.asgariKarsilastirma(2026, 10), gun = I.gunluk(2026);
  var genc = G.program("genclik"), niup = G.program("niup");
  return {
    yil: "2026",
    gunluk: tl(gun),
    aylik14: tl(14 * gun),
    ay15: tl(15 * gun),
    ay12: tl(12 * gun),
    tavan: tl(I.AZAMI_FIILI_GUN * gun),
    hane3: tl2(I.haneSiniri("genclik", 2026, 10)).replace(",00 TL", " TL"),
    hane2: tl2(I.haneSiniri("iup", 2026, 10)).replace(",00 TL", " TL"),
    genclikGun: String(o.genclik.toplamGun),
    genclikToplam: tl(o.genclik.toplam),
    saatlik: tl2(k.saatlik),
    asgariSaatlik: tl2(k.asgariSaatlik),
    asgariOran: yuzde(k.oran),
    toplamGenc: nf.format(G.VERI.toplam.hizmetSunulan),
    niupOran: yuzde(G.oran(niup)),
    niupKadin: yuzde(niup.kadin / niup.gerceklesen),
    genclikOran: yuzde(G.oran(genc))
  };
}

function bloklar() {
  var o = G.ornekler();
  return {
    "ISK-HARITA": figur("ih", "Kim hangi programa girer?", "GÜÇ kapsamındaki beş program; Ağustos 2026 itibarıyla yararlanan genç sayısı.", haritaSvg(),
      "Vurgulu iki program, sosyal medyada \"19 bin TL\" diye birleştirilen günlük 1.375 TL'nin ödendiği programlar. Kaynak: İŞKUR program sayfaları ve GÜÇ portalı, 6 Ekim 2026'da okundu."),
    "ISK-AYLAR": figur("ia", "İki genç, ay ay", "2 Kasım 2026'da başlayan bir üniversiteli (haftada 3 gün) ve bir NEET programı katılımcısı.", aylarSvg(),
      "Sütunlar her ayın katılım günü × 1.375 TL. Kesikli çizgi İŞKUR'un açıkladığı aylık 19.250 TL. NEET programında ilk dört hafta 5 gün; toplam " + o.iup.toplamGun + " güne ulaşıp " + tl(o.iup.toplam) + " ediyor. 2027 ayları 2026 tutarıyla."),
    "ISK-HEDEF": figur("ie", "Hedefe ne kadar ulaşıldı?", "Ağustos 2026; yararlanan genç sayısı ÷ programın yıllık hedefi.", hedefSvg(),
      "Gençlik Programı için 2025-2026 öğretim yılı. Kesikli çizgi hedefin tamamı. Kaynak: GÜÇ portalı (guc.iskur.gov.tr) göstergeleri.")
  };
}

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

function uretYazi(html) {
  var b = bloklar();
  Object.keys(b).forEach(function (ad) { html = blok(html, ad, b[ad]); });
  return alanYaz(html);
}
function uretArac(html) { return sss(alanYaz(html)); }

if (require.main === module) {
  var kontrol = process.argv.indexOf("--check") >= 0, bayat = [];
  [[YAZI, uretYazi], [ARAC, uretArac]].forEach(function (x) {
    var eski = fs.readFileSync(x[0], "utf8"), yeni = x[1](eski);
    if (yeni !== eski) { if (kontrol) bayat.push(path.relative(KOK, x[0])); else fs.writeFileSync(x[0], yeni); }
  });
  if (kontrol) {
    if (bayat.length) { console.error("Bayat: " + bayat.join(", ") + " — 'node tools/iskur-yazisi.js' çalıştırın."); process.exit(1); }
    console.log("İŞKUR yazısı ve aracı hesapla aynı.");
  } else console.log("İŞKUR yazısı ve aracı yazıldı.");
}
module.exports = { alanlar: alanlar, bloklar: bloklar };
