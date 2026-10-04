#!/usr/bin/env node
/*!
 * Engelli araç ÖTV istisnası sayfasının statik bölümlerini üretir:
 *   EA-KARAR   hangi bent: karar diyagramı
 *   EA-UCURUM  fiyat sınırının uçurumu: çizgi grafik
 *   EA-SINIF   motor sınıfına göre sınırdaki en büyük indirim: çubuk + tablo
 *   EA-ORNEK   sayfanın açılış örneği
 *   EA-TAKVIM  satış ve yeni istisna: zaman çizelgesi
 *   data-s alanları ve SSS yapısal verisi (GÖRÜNEN metinden).
 * Her rakam engelli-arac-otv-istisnasi-hesaplama/hesap.js'ten; o da ÖTV ve
 * MTV araçlarının tarife modüllerinden okur. SVG'ler temayı CSS'ten izler.
 *
 * Kullanım:
 *   node tools/engelli-arac-ornek.js          # yaz
 *   node tools/engelli-arac-ornek.js --check  # sayfa hesapla aynı mı (CI)
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "engelli-arac-otv-istisnasi-hesaplama");
var SAYFA = path.join(KLASOR, "index.html");
var E = require(path.join(KLASOR, "hesap.js"));

var YIL = 2026;
var BUGUN = "2026-10-04";                  // örneğin sabit tarihi: sayfa metni her gün değişmesin
var ORNEK = { kisi: { oran: 90 }, arac: { sinif: "binek", otv: { tur: "icten", hacim: 1400 }, yerliKatki: "evet" }, fiyat: 1850000, fiyatTip: "anahtar" };
var SINIFLAR = [
  ["1400 cm³'e kadar benzin, dizel", { tur: "icten", hacim: 1400 }, "Benzin, dizel ≤1400 cm³"],
  ["1400–1600 cm³ benzin, dizel", { tur: "icten", hacim: 1600 }, "Benzin, dizel 1401–1600"],
  ["1600–2000 cm³ benzin, dizel", { tur: "icten", hacim: 2000 }, "Benzin, dizel 1601–2000"],
  ["Hibrit, 1800 cm³'e kadar, elektrik motoru 50 kW üstü", { tur: "hibrit", hacim: 1800, elektrikKw: 60 }, "Hibrit ≤1800 cm³, 50 kW+"],
  ["Şarj edilebilir hibrit, 1600 cm³'e kadar", { tur: "phev", hacim: 1600, co2: 20, menzil: 80 }, "Şarj edilebilir hibrit"],
  ["Elektrikli, 160 kW'a kadar", { tur: "elektrik", kw: 150 }, "Elektrikli ≤160 kW"],
  ["Elektrikli, 160 kW üstü", { tur: "elektrik", kw: 200 }, "Elektrikli >160 kW"]
];

var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(v) { return nf.format(Math.round(v)) + " TL"; }
function yuzde(v, b) { return "%" + (v * 100).toFixed(b == null ? 1 : b).replace(".", ","); }
function milyon(v) { return (Math.round(v / 10000) / 100).toFixed(2).replace(".", ",") + " milyon TL"; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(s) { var p = s.split("-"); return +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0]; }
function f1(x) { return (Math.round(x * 10) / 10).toString(); }

function sekil(id, baslik, alt, svg, aciklama, ek) {
  return [
    '<figure class="ea-sekil" aria-labelledby="' + id + '-b">',
    '<p class="ea-sekil-baslik" id="' + id + '-b">' + esc(baslik) + "</p>",
    alt ? '<p class="ea-sekil-alt">' + esc(alt) + "</p>" : "",
    '<div class="ea-sekil-kap">' + svg + "</div>",
    "<figcaption>" + aciklama + "</figcaption>",
    ek || "",
    "</figure>"
  ].filter(Boolean).join("\n");
}

/* ------------------------------------------------ veriler */
function veriler() {
  var S = E.sinir(YIL);
  var ornek = E.hesapla(Object.assign({ bugun: BUGUN }, ORNEK));
  if (ornek.durum !== "uygun" || !ornek.hesap) throw new Error("Örnek uygun çıkmadı.");
  /* Örnek metni matrahın 650–900 bin TL bandında (%75) olduğunu söylüyor. */
  if (ornek.hesap.normal.oran !== 75 || ornek.hesap.normal.matrah <= 650000 || ornek.hesap.normal.matrah > 900000) throw new Error("Örnek ÖTV bandı metinle ayrıştı.");
  var siniflar = SINIFLAR.map(function (s) {
    var arac = { sinif: "binek", otv: s[1] };
    var m = E.sinirdakiMatrah(arac, S), v = E.vergi(arac, m), ist = m * (1 + E.KDV);
    return { ad: s[0], kisa: s[2], otv: s[1], matrah: m, oran: v.oran, toplam: v.toplam, istisnali: ist, tasarruf: v.toplam - ist, pay: (v.toplam - ist) / v.toplam };
  });
  var a1400 = { sinif: "binek", otv: { tur: "icten", hacim: 1400 } };
  var m1400 = E.sinirdakiMatrah(a1400, S);
  var ucurum = { matrah: m1400, tasarruf: E.vergi(a1400, Math.floor(m1400)).toplam - Math.floor(m1400) * (1 + E.KDV) };
  return { S: S, ornek: ornek, siniflar: siniflar, ucurum: ucurum, a1400: a1400 };
}

/* ------------------------------------------------ 1. karar diyagramı */
/* Hesaplayıcı sayfasında SVG yazısı mono (style.css): kutular mono
   genişliğine göre (12,5 px'te ~7,6 px/harf) ölçülü. */
function kararSvg() {
  var W = 640, H = 452;
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ek-t ek-d">',
    '<title id="ek-t">Engelli araç ÖTV istisnası: hangi bent?</title>',
    '<desc id="ek-d">Engellilik oranı yüzde 90 ve üzeriyse: tekerlekli sandalye ya da sedye ve yük-yolcu veya 9 kişilik araç varsa (b) bendi, fiyat sınırı yok; değilse (a) bendi, sınır var. Yüzde 90 altındaysa: raporda özel tertibat zorunluluğu ve sürücü belgesinde kod varsa (c) bendi bizzat kullanım; ortopedik engel yüzde 40 ve üzeri ve sürücü belgesi alamıyorsa (c) bendi ortopedik; hiçbiri değilse istisna yok. Her yolda ortak şart: yerli katkı yüzde 40, on yılda bir, sınırlı bentlerde vergiler dahil bedel sınırı.</desc>',
    '<defs><marker id="ek-ok" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="k-ok-uc" d="M0 0 L8 4 L0 8 Z"/></marker></defs>'];
  function kutu(x, y, w, h, sinif, satirlar, ana) {
    p.push('<rect class="' + sinif + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"/>');
    var y0 = y + h / 2 - (satirlar.length - 1) * 8 + 4;
    satirlar.forEach(function (s, i) {
      var kalin = ana === "hepsi" || (i === 0 && ana !== false);
      p.push('<text x="' + (x + w / 2) + '" y="' + (y0 + i * 16) + '" text-anchor="middle"' + (kalin ? ' class="t-ana"' : "") + ">" + esc(s) + "</text>");
    });
  }
  function ok(d, yazi, yx, yy, anchor) {
    p.push('<path class="k-ok" d="' + d + '" marker-end="url(#ek-ok)"/>');
    if (yazi) p.push('<text class="t-kucuk" x="' + yx + '" y="' + yy + '" text-anchor="' + (anchor || "middle") + '">' + yazi + "</text>");
  }
  kutu(180, 8, 280, 40, "k-soru", ["Engellilik oranı %90 ve üzeri mi?"]);
  ok("M250 48 L165 90", "evet", 200, 66, "end");
  ok("M390 48 L475 90", "hayır", 440, 66, "start");
  kutu(20, 92, 290, 52, "k-soru", ["Tekerlekli sandalye ya da sedye", "ve panelvan, kombi ya da 9 kişilik?"], false);
  kutu(330, 92, 290, 52, "k-soru", ["Raporda özel tertibat zorunluluğu", "ve sürücü belgesinde kodu?"], false);
  ok("M90 144 L80 196", "evet", 80, 172, "end");
  ok("M240 144 L230 196", "hayır", 242, 172, "start");
  ok("M400 144 L410 196", "evet", 398, 172, "end");
  ok("M560 144 L560 196", "hayır", 566, 172, "start");
  kutu(10, 198, 150, 56, "k-sonuc", ["(b) bendi", "fiyat sınırı yok"]);
  kutu(170, 198, 150, 56, "k-sonuc", ["(a) bendi", "sınır " + nf.format(E.sinir(YIL)) + " TL"]);
  kutu(335, 198, 150, 56, "k-sonuc", ["(c) bizzat", "kullanım, aynı sınır"]);
  kutu(495, 198, 135, 56, "k-soru", ["Ortopedik %40+,", "sürücü belgesi", "alamıyor mu?"], false);
  ok("M530 254 L485 300", "evet", 500, 280, "end");
  ok("M600 254 L600 300", "hayır", 606, 280, "start");
  kutu(380, 302, 150, 52, "k-sonuc", ["(c) ortopedik", "aynı sınır"]);
  kutu(540, 302, 90, 52, "k-yok", ["İstisna", "yok"], "hepsi");
  ok("M85 254 L85 384", null); ok("M245 254 L245 384", null); ok("M410 254 L360 384", null); ok("M455 354 L430 384", null);
  kutu(10, 386, 620, 58, "k-ortak", ["Her yolda: yerli katkı %40 · on yılda bir · ilk tescil engellinin adına", "(a) ve (c): istisna olmasaydı ödenecek vergiler dahil bedel sınırı aşmamalı"]);
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 2. uçurum */
function ucurumSvg(v) {
  var a = v.a1400, S = v.S;
  var W = 640, SOL = 70, SAG = 618, UST = 30, ALT = 276, H = 330;
  var XMIN = 500000, XMAX = 1500000, YMIN = 0, YMAX = 3500000;
  function x(m) { return SOL + (m - XMIN) / (XMAX - XMIN) * (SAG - SOL); }
  function y(t) { return ALT - (t - YMIN) / (YMAX - YMIN) * (ALT - UST); }
  var mS = Math.floor(v.ucurum.matrah);
  var normal = [], ist = [];
  for (var m = XMIN; m <= XMAX; m += 2500) normal.push([m, E.vergi(a, m).toplam]);
  /* Eşiklerde sıçrama: eşik ve eşiğin hemen üstü ayrı nokta. */
  [650000, 900000, 1100000].forEach(function (e) { normal.push([e, E.vergi(a, e).toplam]); normal.push([e + 0.01, E.vergi(a, e + 0.01).toplam]); });
  normal.sort(function (p, q) { return p[0] - q[0]; });
  function yol(nk) { return nk.map(function (q, i) { return (i ? "L" : "M") + x(q[0]).toFixed(1) + " " + y(q[1]).toFixed(1); }).join(" "); }
  ist = [[XMIN, XMIN * 1.2], [mS, mS * 1.2], [mS + 0.01, E.vergi(a, mS + 0.01).toplam], [XMAX, E.vergi(a, XMAX).toplam]];
  var alan = "M" + x(XMIN) + " " + y(XMIN * 1.2) + " L" + x(mS).toFixed(1) + " " + y(mS * 1.2).toFixed(1) + " L" + x(mS).toFixed(1) + " " + y(E.vergi(a, mS).toplam).toFixed(1) + " " +
    normal.filter(function (q) { return q[0] <= mS; }).reverse().map(function (q) { return "L" + x(q[0]).toFixed(1) + " " + y(q[1]).toFixed(1); }).join(" ") + " Z";
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="eu-t eu-d">',
    '<title id="eu-t">Vergisiz fiyata göre anahtar teslim fiyat, istisnalı ve istisnasız</title>',
    '<desc id="eu-d">' + esc("1400 cm³'e kadar benzinli otomobilde vergisiz fiyat " + tl(mS) + " olana kadar istisnalı fiyat, istisnasız fiyatın çok altında; bu noktada fark " + milyon(v.ucurum.tasarruf) + ". Bir lira daha pahalı araçta istisna uygulanmaz ve iki fiyat çakışır.") + "</desc>"];
  for (var t = 0; t <= YMAX; t += 500000) {
    p.push('<path class="izgara" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text class="t-mono" x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + (t === 0 ? "0" : f1(t / 1e6).replace(".", ",") + " mn") + "</text>");
  }
  [500000, 750000, 1000000, 1250000, 1500000].forEach(function (m) {
    p.push('<text class="t-mono" x="' + x(m).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="' + (m === XMAX ? "end" : m === XMIN ? "start" : "middle") + '">' + nf.format(m / 1000) + " bin</text>");
  });
  p.push('<text x="' + SAG + '" y="' + (ALT + 38) + '" text-anchor="end">vergisiz fiyat (ÖTV matrahı), TL</text>');
  p.push('<path class="sinir" d="M' + SOL + " " + y(S).toFixed(1) + " H" + SAG + '"/>');
  p.push('<text class="t-kucuk sol" x="' + (SOL + 6) + '" y="' + (y(S) - 6).toFixed(1) + '">sınır: vergiler dahil ' + nf.format(S) + " TL</text>");
  p.push('<path class="alan-kazanc sol" d="' + alan + '"/>');
  p.push('<path class="s-normal ciz" d="' + yol(normal) + '"/>');
  p.push('<path class="s-istisna ciz" d="' + yol(ist) + '"/>');
  p.push('<circle class="nokta-1" cx="' + x(mS).toFixed(1) + '" cy="' + y(mS * 1.2).toFixed(1) + '" r="4.5"/>');
  p.push('<circle class="nokta-2" cx="' + x(mS).toFixed(1) + '" cy="' + y(E.vergi(a, mS).toplam).toFixed(1) + '" r="4.5"/>');
  var orta = (y(mS * 1.2) + y(E.vergi(a, mS).toplam)) / 2;
  p.push('<text class="t-ana sol" x="' + (x(mS) - 10).toFixed(1) + '" y="' + (orta + 4).toFixed(1) + '" text-anchor="end">' + milyon(v.ucurum.tasarruf) + " fark</text>");
  p.push('<text class="t-kucuk sol" x="' + (x(mS) + 10).toFixed(1) + '" y="' + (y(mS * 1.2) + 18).toFixed(1) + '">1 TL sonra: fark yok</text>');
  /* lejant */
  p.push('<rect class="lej-2" x="' + SOL + '" y="6" width="11" height="11" rx="2"/><text x="' + (SOL + 16) + '" y="15">İstisnasız (liste fiyatı)</text>');
  p.push('<rect class="lej-1" x="' + (SOL + 214) + '" y="6" width="11" height="11" rx="2"/><text x="' + (SOL + 230) + '" y="15">İstisnayla</text>');
  p.push('<rect class="lej-k" x="' + (SOL + 330) + '" y="6" width="11" height="11" rx="2"/><text x="' + (SOL + 346) + '" y="15">tasarruf</text>');
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 3. sınıflar */
function sinifSvg(v) {
  var d = v.siniflar.slice().sort(function (a, b) { return b.tasarruf - a.tasarruf; });
  var W = 640, SOL = 210, SAG = 560, UST = 8, SATIR = 34, H = UST + d.length * SATIR + 8;
  var enCok = Math.ceil(d[0].tasarruf / 500000) * 500000;
  function x(t) { return SOL + t / enCok * (SAG - SOL); }
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="es-t es-d">',
    '<title id="es-t">Motor sınıfına göre sınırdaki en büyük tasarruf</title>',
    '<desc id="es-d">' + esc(d.map(function (s) { return s.ad + ": " + tl(s.tasarruf); }).join("; ")) + "</desc>"];
  d.forEach(function (s, i) {
    var cy = UST + i * SATIR + SATIR / 2;
    p.push('<text x="' + (SOL - 10) + '" y="' + (cy + 4) + '" text-anchor="end"' + (i === 0 ? ' class="t-ana"' : "") + ">" + esc(s.kisa) + "</text>");
    p.push('<rect class="cubuk-zemin" x="' + SOL + '" y="' + (cy - 7) + '" width="' + (SAG - SOL) + '" height="14" rx="3"/>');
    p.push('<rect class="cubuk uza" x="' + SOL + '" y="' + (cy - 7) + '" width="' + Math.max(2, x(s.tasarruf) - SOL).toFixed(1) + '" height="14" rx="3"/>');
    p.push('<text class="t-mono t-ana sol" x="' + (x(s.tasarruf) + 8).toFixed(1) + '" y="' + (cy + 4) + '">' + milyon(s.tasarruf).replace(" milyon TL", " mn") + "</text>");
  });
  p.push("</svg>");
  return p.join("");
}
function sinifTablo(v) {
  return [
    '<div class="table-scroll">', '<table class="data-table">',
    "<caption>Sınırın altında kalabilecek en pahalı araç, motor sınıfına göre. Liste fiyatı her satırda " + tl(v.S) + "; 160 kW'a kadar elektrikli otomobilde " + tl(v.siniflar.filter(function (s) { return s.otv.tur === "elektrik" && s.otv.kw <= 160; })[0].toplam) + ".</caption>",
    '<thead><tr><th scope="col">Motor</th><th scope="col">Vergisiz fiyat</th><th scope="col">ÖTV</th><th scope="col">İstisnayla</th><th scope="col">Tasarruf</th></tr></thead>',
    "<tbody>",
    v.siniflar.map(function (s) {
      return "<tr><th scope=\"row\">" + esc(s.kisa) + "</th><td>" + tl(s.matrah) + "</td><td>%" + s.oran + "</td><td>" + tl(s.istisnali) +
        "</td><td><strong>" + tl(s.tasarruf) + "</strong> (" + yuzde(s.pay) + ")</td></tr>";
    }).join("\n"),
    "</tbody>", "</table>", "</div>"
  ].join("\n");
}

/* ------------------------------------------------ 4. örnek */
function ornekBlok(v) {
  var r = v.ornek, h = r.hesap;
  return [
    '<div class="ea-ornek">',
    "<p>Engellilik oranı %90 olan biri, yerli katkı oranı %40'ın üstünde, 1400 cm³ benzinli bir otomobil alıyor. Liste fiyatı " + tl(ORNEK.fiyat) + " ve daha önce istisnadan yararlanmamış.</p>",
    "<dl>",
    "<dt>Vergisiz fiyat</dt><dd>" + tl(h.normal.matrah) + " (matrah 650.000–900.000 TL aralığında: ÖTV %" + h.normal.oran + ")</dd>",
    "<dt>Liste fiyatındaki ÖTV</dt><dd>" + tl(h.normal.otv) + "</dd>",
    "<dt>Vergiler dahil bedel</dt><dd>" + tl(h.normal.toplam) + ": sınırın " + tl(h.sinirKalan) + " altında</dd>",
    "<dt>İstisnayla ödenecek</dt><dd>" + tl(h.istisnali.toplam) + " (vergisiz fiyat + %20 KDV)</dd>",
    "<dt>Tasarruf</dt><dd>" + tl(h.tasarruf) + " (" + yuzde(h.indirimOrani) + "): ÖTV " + tl(h.tasarrufOtv) + " ve onun KDV'si " + tl(h.tasarrufKdv) + "</dd>",
    "<dt>MTV</dt><dd>muaf; normal alıcı ilk yıl " + tl(r.mtv.normalIlkYil) + ", ilk beş yılda " + tl(r.mtv.normalBesYil) + " öderdi</dd>",
    "<dt>Satış</dt><dd>" + tarih(r.takvim.serbestSatis) + "'e kadar istisnasız birine satılırsa alıcı yaklaşık " + tl(r.takvim.erkenSatisOtv) + " ÖTV öder</dd>",
    "<dt>Yeni istisna</dt><dd>en erken " + tarih(r.takvim.yeniIstisna) + "</dd>",
    "</dl>",
    "</div>"
  ].join("\n");
}

/* ------------------------------------------------ 5. takvim */
function takvimSvg() {
  var W = 640, SOL = 20, SAG = 620, H = 150;
  function x(yil) { return SOL + yil / 10 * (SAG - SOL); }
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="et-t et-d">',
    '<title id="et-t">İstisnalı araçta satış ve yeni istisna takvimi</title>',
    '<desc id="et-d">İlk beş yıl: istisnasız birine satışta alıcı ÖTV öder, başka bir engelliye satış vergisiz. Beşinci yıldan sonra satış serbest. Onuncu yıl dolunca yeni bir istisnalı araç alınabilir; eldeki aracı satmak gerekmez.</desc>'];
  p.push('<rect class="z-kirmizi" x="' + x(0) + '" y="34" width="' + (x(5) - x(0) - 2) + '" height="30" rx="5"/>');
  p.push('<rect class="z-gri" x="' + (x(5) + 2) + '" y="34" width="' + (x(10) - x(5) - 2) + '" height="30" rx="5"/>');
  p.push('<text class="t-ana" x="' + (x(0) + 10) + '" y="53">0–5 yıl: istisnasız alıcı ÖTV öder</text>');
  p.push('<text class="t-ana" x="' + (x(5) + 12) + '" y="53">5–10 yıl: satış serbest</text>');
  p.push('<rect class="z-yesil" x="' + (x(10) - 4) + '" y="28" width="8" height="42" rx="3"/>');
  for (var yl = 0; yl <= 10; yl++) {
    p.push('<path class="izgara" d="M' + x(yl).toFixed(1) + " 72 V80\"/>");
    p.push('<text class="t-mono" x="' + x(yl).toFixed(1) + '" y="94" text-anchor="middle">' + yl + "</text>");
  }
  p.push('<text class="t-kucuk" x="' + x(0) + '" y="20">alış (ilk tescil)</text>');
  p.push('<text class="t-kucuk" x="' + x(10) + '" y="20" text-anchor="end">yeni istisna hakkı</text>');
  p.push('<text class="t-kucuk" x="' + x(0) + '" y="118">Başka bir engelliye satış her zaman ÖTV\'siz.</text>');
  p.push('<text class="t-kucuk" x="' + x(0) + '" y="136">Erken satış ve ÖTV ödenmesi on yılı kısaltmaz; on yıl dolunca eldeki aracı satmak gerekmez.</text>');
  p.push("</svg>");
  return p.join("");
}

function alanlar(v) {
  return {
    yil: String(YIL),
    sinir: tl(v.S),
    ornekMtv5: tl(v.ornek.mtv.normalBesYil)
  };
}

function bloklar(v) {
  var enIyi = v.siniflar.slice().sort(function (a, b) { return b.tasarruf - a.tasarruf; })[0];
  var ev = v.siniflar.filter(function (s) { return s.otv.tur === "elektrik" && s.otv.kw <= 160; })[0];
  return {
    "EA-KARAR": sekil("ek", "Hangi bentten yararlanırsınız?", "4760 s.K. m.7/1-2'nin alt bentleri, kanundaki sırayla.", kararSvg(),
      "Yük-yolcu araç: panelvan, kombi gibi yük taşımasında kullanılıp yolcu kapasitesi istiap haddinin %50'sinin altında olan taşıt. Kaynak: 4760 s.K. m.7/1-2; ÖTV (II) Sayılı Liste Uygulama Genel Tebliği II/C-1."),
    "EA-UCURUM": sekil("eu", "Bir lira farkla " + milyon(v.ucurum.tasarruf), "1400 cm³'e kadar benzinli otomobil; anahtar teslim fiyat, vergisiz fiyata göre.", ucurumSvg(v),
      "Turuncu çizgi istisnasız liste fiyatı: ÖTV eşiklerinde (650, 900 ve 1.100 bin TL) sıçrar, çünkü üst oran bütün matraha uygulanır. Mavi çizgi istisnalı fiyat: vergisiz fiyat + %20 KDV. Liste fiyatı " +
      tl(v.S) + "'ye değdiği noktada (vergisiz " + tl(Math.floor(v.ucurum.matrah)) + ") istisna biter ve iki çizgi birleşir."),
    "EA-SINIF": sekil("es", "Sınırdaki en büyük tasarruf, motor sınıfına göre", "Her sınıfta liste fiyatı sınırın altında kalan en pahalı araç.", sinifSvg(v),
      "En büyük indirim " + esc(enIyi.ad.toLowerCase()) + " sınıfında: ÖTV oranı %" + enIyi.oran + " olduğu için sınıra ucuz bir araçla ulaşılır ama ÖTV'si büyüktür. 160 kW'a kadar elektrikli otomobilde ÖTV %25'te kaldığı sürece liste fiyatı sınıra yaklaşamaz; en büyük tasarruf " +
      tl(ev.tasarruf) + ".", sinifTablo(v)),
    "EA-ORNEK": ornekBlok(v),
    "EA-TAKVIM": sekil("et", "Satış ve yeni istisna takvimi", "Yıl; ilk tescilden itibaren.", takvimSvg(),
      "Kaynak: 4760 s.K. m.7/1-2 ve m.15/2-a; ÖTV (II) Sayılı Liste Uygulama Genel Tebliği IV/F-1.1.")
  };
}

function blok(html, ad, icerik) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("Blok bulunamadı: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}
function duz(x) {
  return x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function kacis(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function uret(html) {
  var v = veriler();
  var b = bloklar(v);
  Object.keys(b).forEach(function (ad) { html = blok(html, ad, b[ad]); });
  var m = alanlar(v);
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z0-9]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (t, ac, et, k, ic, kapa) {
    if (!(k in m)) throw new Error("Bilinmeyen data-s: " + k);
    return ac + kacis(m[k]) + kapa;
  });
  var i = html.indexOf('<h2 id="sss">'), j = html.indexOf("<!-- SSS:BITIS -->", i);
  if (i < 0 || j < 0) throw new Error("SSS bölümü bulunamadı.");
  var parca = html.slice(i, j), faq = [], re = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, x;
  while ((x = re.exec(parca))) faq.push({ "@type": "Question", name: duz(x[1]), acceptedAnswer: { "@type": "Answer", text: duz(x[2]) } });
  var ac = '<script type="application/ld+json">';
  var ldBas = html.indexOf(ac), ldSon = html.indexOf("</script>", ldBas);
  var ld = JSON.parse(html.slice(ldBas + ac.length, ldSon));
  ld["@graph"].forEach(function (n) { if (n["@type"] === "FAQPage") n.mainEntity = faq; });
  var yeni = "\n" + JSON.stringify(ld, null, 2).split("\n").map(function (s) { return "  " + s; }).join("\n") + "\n  ";
  return html.slice(0, ldBas + ac.length) + yeni + html.slice(ldSon);
}

if (require.main === module) {
  var eski = fs.readFileSync(SAYFA, "utf8");
  var yeni = uret(eski);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== eski) { console.error("Engelli araç sayfası bayat — 'node tools/engelli-arac-ornek.js' çalıştırın."); process.exit(1); }
    console.log("Engelli araç sayfası hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(SAYFA, yeni);
    console.log(yeni !== eski ? "Engelli araç sayfası yazıldı." : "Engelli araç sayfası zaten güncel.");
  }
}
module.exports = { uret: uret, veriler: veriler, ORNEK: ORNEK, BUGUN: BUGUN };
