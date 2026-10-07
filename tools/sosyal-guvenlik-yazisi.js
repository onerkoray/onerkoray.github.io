#!/usr/bin/env node
/*
 * "Türkiye'de sosyal güvenliğin dönüşümü" yazısının statik bölümleri:
 *   SG-ZAMAN   üç kural, iki eşik: kanunlar ve neyi değiştirdikleri
 *   SG-YAS     ilk giriş yılına göre tam emeklilik yaşı (bugünkü ve 2023 öncesi kural)
 *   SG-TABLO   seçili giriş tarihleri için yaş, prim yılı ve dayanak
 *   SG-ABO     aynı prim gününde iki kuralın aylık bağlama oranı
 *   SG-NUFUS   yaşlı bağımlılık oranı, 1960–2025
 *   data-s alanları
 * Her sayı yazının modülünden (donusum.js); o da sitenin emeklilik
 * çekirdeklerini ve Dünya Bankası anlık görüntüsünü kullanır.
 * Renkler editoryal.css'teki .ed-grafik sınıflarından (--dv-*).
 *
 * Kullanım:
 *   node tools/sosyal-guvenlik-yazisi.js           # yaz
 *   node tools/sosyal-guvenlik-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var KLASOR = path.join(KOK, "makaleler", "turkiyede-sosyal-guvenligin-donusumu");
var D = require(path.join(KLASOR, "donusum.js"));
var YAZI = path.join(KLASOR, "index.html");

var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function bir(v) { return v.toFixed(1).replace(".", ","); }
function yuzde1(o) { return "%" + bir(o * 100); }
function yuzde0(o) { return "%" + Math.round(o * 100); }
function yas(v) { return Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : bir(v); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function figur(id, baslik, alt, svg, aciklama) {
  return ['<figure class="ed-grafik" aria-labelledby="' + id + '-b">',
    '<p class="ed-grafik-baslik" id="' + id + '-b">' + esc(baslik) + "</p>",
    '<p class="ed-grafik-alt">' + esc(alt) + "</p>",
    '<div class="ed-grafik-kap">' + svg + "</div>",
    "<figcaption>" + aciklama + "</figcaption>", "</figure>"].join("\n");
}

/* Ölçülen değerler tek yerde. */
function olcum() {
  var K = D.seri("kadin"), E = D.seri("erkek");
  function bul(S, y) { return S.filter(function (k) { return k.giris === y + "-01-01"; })[0]; }
  var ek = D.esikler("kadin"), ee = D.esikler("erkek");
  var kademe = K.filter(function (k) { return k.grup === "yeni" && k.yas > ek.eyt[1].yas; })[0];
  return { K: K, E: E, bul: bul, ek: ek, ee: ee, kademeIlk: +kademe.giris.slice(0, 4),
    k2000: bul(K, 2000), k2025: bul(K, 2025), e2025: bul(E, 2025) };
}

/* ------------------------------------------------ 1. zaman çizelgesi */
function zamanSvg() {
  var satir = [
    ["17.7.1964", "506 sayılı Kanun", "Sosyal sigortaların temel kanunu; işçiler için yaşlılık aylığı", false],
    ["8.9.1999", "4447 sayılı Kanun", "Yeni girene 58/60 yaş; öncesine kademeli yaş. 2000'den itibaren yeni aylık bağlama oranları", true],
    ["23.5.2002", "4759 sayılı Kanun", "1999 öncesi girişlilerin yaş tablosu, 23 Mayıs 2002'deki süreye göre", false],
    ["1.5.2008", "5510 sayılı Kanun", "Yeni girene 7.200 gün; yaş 2036–2048 arasında 65'e. Ekim 2008'den her yıla %2", true],
    ["1.3.2023", "7438 sayılı Kanun (EYT)", "1999 öncesi girişlilerin yaş şartı kalktı; gün ve süre şartı yerinde", false]
  ];
  var W = 640, SATIR = 62, UST = 14, H = UST + satir.length * SATIR, X = 112;
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sz-t sz-d">',
    '<title id="sz-t">Emeklilik kurallarını değiştiren beş kanun</title>',
    '<desc id="sz-d">' + esc(satir.map(function (s) { return s[0] + ", " + s[1] + ": " + s[2]; }).join("; ")) + ". İki eşik: 8 Eylül 1999 ve 1 Mayıs 2008.</desc>"];
  p.push('<path class="izgara" d="M' + X + " " + (UST + 8) + " V" + (H - SATIR / 2 + 6) + '"/>');
  satir.forEach(function (s, i) {
    var y = UST + i * SATIR;
    p.push('<text class="kucuk" x="' + (X - 16) + '" y="' + (y + 14) + '" text-anchor="end">' + s[0] + "</text>");
    if (s[3]) {
      p.push('<rect class="kutu-vurgu" x="' + (X + 18) + '" y="' + (y - 4) + '" width="' + (W - X - 20) + '" height="' + (SATIR - 12) + '" rx="6"/>');
      p.push('<circle class="nokta" cx="' + X + '" cy="' + (y + 10) + '" r="6"/>');
    } else {
      p.push('<circle cx="' + X + '" cy="' + (y + 10) + '" r="4.5" class="nokta"/>');
    }
    p.push('<text class="deger" x="' + (X + 30) + '" y="' + (y + 14) + '">' + esc(s[1]) + (s[3] ? "  · eşik" : "") + "</text>");
    p.push('<text class="kucuk" x="' + (X + 30) + '" y="' + (y + 33) + '">' + esc(s[2]) + "</text>");
  });
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 2. emeklilik yaşı */
function yasSvg(o) {
  var W = 640, SOL = 46, SAG = 560, UST = 34, ALT = 290, H = 330, X0 = 1985, X1 = 2026, Y0 = 35, Y1 = 67;
  function x(t) { return SOL + (t - X0) / (X1 - X0) * (SAG - SOL); }
  function y(v) { return ALT - (v - Y0) / (Y1 - Y0) * (ALT - UST); }
  function yil(iso) { var p = iso.split("-"); return +p[0] + ((+p[1] - 1) * 30.4 + (+p[2] - 1)) / 365.25; }
  /* Basamak: her örnek bir sonrakine kadar geçerli. 8 Eylül 1999 örneği eklenir. */
  function basamak(S, ek, alan) {
    var nok = S.map(function (k) { return [yil(k.giris), alan(k)]; }).filter(function (n) { return n[1] !== null; });
    if (ek) { nok.push([yil(ek.giris), alan(ek)]); nok.sort(function (a, b) { return a[0] - b[0]; }); }
    var d = "";
    nok.forEach(function (n, i) {
      var sonraki = i + 1 < nok.length ? nok[i + 1][0] : X1;
      d += (i ? " L" : "M") + x(n[0]).toFixed(1) + " " + y(n[1]).toFixed(1) + " H" + x(sonraki).toFixed(1);
    });
    return d;
  }
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sy-t sy-d">',
    '<title id="sy-t">İlk giriş yılına göre tam emeklilik yaşı</title>',
    '<desc id="sy-d">' + esc("20 yaşında başlayıp yılda 360 gün prim ödeyen 4/a sigortalı. Bugünkü kanunla: 1985–8 Eylül 1999 girişleri kadın " + yas(o.ek.eyt[0].yas) + ", erkek " + yas(o.ee.eyt[0].yas) + "; 8 Eylül 1999–2015 girişleri kadın " + yas(o.ek.eyt[1].yas) + ", erkek " + yas(o.ee.eyt[1].yas) + "; 2025 girişi kadın " + yas(o.k2025.yas) + ", erkek " + yas(o.e2025.yas) + ". 2023 öncesi kuralla 1985 girişli kadın " + yas(o.bul(o.K, 1985).eytOncesi.yas) + ", 1999 başı girişli kadın " + yas(o.bul(o.K, 1999).eytOncesi.yas) + ".") + "</desc>"];
  p.push('<path class="cizgi-1" d="M' + SOL + ' 12 h16"/><text x="' + (SOL + 22) + '" y="16">Kadın</text>');
  p.push('<path class="cizgi-2" d="M' + (SOL + 80) + ' 12 h16"/><text x="' + (SOL + 102) + '" y="16">Erkek</text>');
  p.push('<path class="cizgi-1 kesik" d="M' + (SOL + 164) + ' 12 h16"/><text x="' + (SOL + 186) + '" y="16">2023 öncesi kural</text>');
  [40, 45, 50, 55, 60, 65].forEach(function (v) {
    p.push('<path class="izgara" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + "</text>");
  });
  [[o.ek.eyt[1].giris, "8 Eylül 1999"], [o.ek.yeni[1].giris, "1 Mayıs 2008"]].forEach(function (e) {
    var xe = x(yil(e[0]));
    p.push('<path class="esik" d="M' + xe.toFixed(1) + " " + UST + " V" + ALT + '"/>');
    p.push('<text class="esik-yazi" x="' + (xe + 4).toFixed(1) + '" y="' + (UST + 10) + '">' + e[1] + "</text>");
  });
  var eytK = o.K.filter(function (k) { return k.eytOncesi; }), eytE = o.E.filter(function (k) { return k.eytOncesi; });
  p.push('<path class="cizgi-1 kesik" d="' + basamak(eytK, null, function (k) { return k.eytOncesi.yas; }).replace(/H[\d.]+$/, "H" + x(yil(o.ek.eyt[1].giris)).toFixed(1)) + '"/>');
  p.push('<path class="cizgi-2 kesik" d="' + basamak(eytE, null, function (k) { return k.eytOncesi.yas; }).replace(/H[\d.]+$/, "H" + x(yil(o.ee.eyt[1].giris)).toFixed(1)) + '"/>');
  p.push('<path class="cizgi-1" d="' + basamak(o.K, o.ek.eyt[1], function (k) { return k.yas; }) + '"/>');
  p.push('<path class="cizgi-2" d="' + basamak(o.E, o.ee.eyt[1], function (k) { return k.yas; }) + '"/>');
  p.push('<text class="yazi-1" x="' + (SAG + 6) + '" y="' + (y(o.k2025.yas) + 4).toFixed(1) + '">' + yas(o.k2025.yas) + "</text>");
  p.push('<text class="yazi-2" x="' + (SAG + 6) + '" y="' + (y(o.e2025.yas) + 4).toFixed(1) + '">' + yas(o.e2025.yas) + "</text>");
  p.push('<text class="yazi-1" x="' + (x(1985) + 4).toFixed(1) + '" y="' + (y(o.ek.eyt[0].yas) + 15).toFixed(1) + '">' + yas(o.ek.eyt[0].yas) + "</text>");
  p.push('<text class="yazi-2" x="' + (x(1985) + 4).toFixed(1) + '" y="' + (y(o.ee.eyt[0].yas) - 6).toFixed(1) + '">' + yas(o.ee.eyt[0].yas) + "</text>");
  [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025].forEach(function (t) {
    p.push('<text x="' + x(t).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + t + "</text>");
  });
  p.push('<text class="kucuk" x="' + SAG + '" y="' + (ALT + 36) + '" text-anchor="end">ilk sigortalılık yılı</text>');
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 3. tablo */
function tabloHtml(o) {
  var satirlar = [
    ["1985", o.bul(o.K, 1985), o.bul(o.E, 1985)],
    ["1995", o.bul(o.K, 1995), o.bul(o.E, 1995)],
    ["7 Eylül 1999", o.ek.eyt[0], o.ee.eyt[0]],
    ["8 Eylül 1999", o.ek.eyt[1], o.ee.eyt[1]],
    ["1 Mayıs 2008", o.ek.yeni[1], o.ee.yeni[1]],
    [String(o.kademeIlk), o.bul(o.K, o.kademeIlk), o.bul(o.E, o.kademeIlk)],
    ["2020", o.bul(o.K, 2020), o.bul(o.E, 2020)],
    ["2025", o.k2025, o.e2025]
  ];
  var GRUP = { eyt: "1999 öncesi", gecis: "1999–2008", yeni: "2008 sonrası" };
  function hucre(k) { return yas(k.yas) + " yaş · " + yas(k.calisma) + " yıl" + (k.eytOncesi ? ' <span class="muted">(2023 öncesi ' + yas(k.eytOncesi.yas) + ")</span>" : ""); }
  var h = ['<div class="table-scroll">', '<table class="data-table data-table--text">',
    "<caption>Model sigortalı: tam emeklilik yaşı ve prim ödenen yıl, bugünkü kanunla</caption>",
    '<thead><tr><th scope="col">İlk giriş</th><th scope="col">Kural grubu</th><th scope="col">Kadın</th><th scope="col">Erkek</th><th scope="col">Dayanak</th></tr></thead>', "<tbody>"];
  satirlar.forEach(function (s) {
    h.push("<tr><th scope=\"row\">" + s[0] + "</th><td>" + GRUP[s[1].grup] + "</td><td>" + hucre(s[1]) + "</td><td>" + hucre(s[2]) + "</td><td>" + esc(s[1].dayanak.replace(/-\([^)]*\)/, "")) + "</td></tr>");
  });
  h.push("</tbody>", "</table>", "</div>");
  return h.join("\n");
}

/* ------------------------------------------------ 4. aylık bağlama oranı */
function aboSvg() {
  var W = 640, SOL = 46, SAG = 600, UST = 34, ALT = 270, H = 308, G1 = 14400;
  function x(g) { return SOL + g / G1 * (SAG - SOL); }
  function y(o) { return ALT - o / 0.9 * (ALT - UST); }
  var g82 = [], m29 = [];
  for (var g = 0; g <= G1; g += 360) { var a = D.abo(g); g82.push([g, a.gecici82]); m29.push([g, a.m29]); }
  function d(S) { return S.map(function (n, i) { return (i ? "L" : "M") + x(n[0]).toFixed(1) + " " + y(n[1]).toFixed(1); }).join(" "); }
  var o9 = D.abo(9000), o36 = D.abo(3600);
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sa-t sa-d">',
    '<title id="sa-t">Aynı prim gününde aylık bağlama oranı: iki kural</title>',
    '<desc id="sa-d">' + esc(D.ABO_GUNLERI.map(function (g) { var a = D.abo(g); return nf.format(g) + " gün: 2000–2008 kuralı " + yuzde1(a.gecici82) + ", bugünkü kural " + yuzde1(a.m29); }).join("; ")) + "</desc>"];
  p.push('<path class="cizgi-1" d="M' + SOL + ' 12 h16"/><text x="' + (SOL + 22) + '" y="16">2000–2008 kuralı (506 Geçici m.82)</text>');
  p.push('<path class="cizgi-2" d="M' + (SOL + 280) + ' 12 h16"/><text x="' + (SOL + 302) + '" y="16">Bugünkü kural (5510 m.29)</text>');
  [0, 0.2, 0.4, 0.6, 0.8].forEach(function (v) {
    p.push('<path class="' + (v ? "izgara" : "sifir") + '" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">%' + Math.round(v * 100) + "</text>");
  });
  p.push('<path class="esik" d="M' + x(3600).toFixed(1) + " " + UST + " V" + ALT + '"/><text class="esik-yazi" x="' + (x(3600) + 4).toFixed(1) + '" y="' + (UST + 10) + '">3.600 gün</text>');
  p.push('<path class="cizgi-1" d="' + d(g82) + '"/>');
  p.push('<path class="cizgi-2" d="' + d(m29) + '"/>');
  p.push('<circle class="nokta" cx="' + x(9000).toFixed(1) + '" cy="' + y(o9.gecici82).toFixed(1) + '" r="4"/>');
  p.push('<circle class="nokta-2" cx="' + x(9000).toFixed(1) + '" cy="' + y(o9.m29).toFixed(1) + '" r="4"/>');
  p.push('<text class="yazi-1" x="' + (x(9000) - 8).toFixed(1) + '" y="' + (y(o9.gecici82) - 9).toFixed(1) + '" text-anchor="end">' + yuzde0(o9.gecici82) + "</text>");
  p.push('<text class="yazi-2" x="' + (x(9000) + 8).toFixed(1) + '" y="' + (y(o9.m29) + 16).toFixed(1) + '">' + yuzde0(o9.m29) + "</text>");
  p.push('<text class="kucuk" x="' + (x(9000)).toFixed(1) + '" y="' + (ALT - 6) + '" text-anchor="middle">9.000 gün</text>');
  [0, 3600, 7200, 10800, 14400].forEach(function (g) {
    p.push('<text x="' + x(g).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + nf.format(g) + "</text>");
  });
  p.push('<text class="kucuk" x="' + SAG + '" y="' + (ALT + 34) + '" text-anchor="end">prim günü</text>');
  void o36;
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 5. nüfus */
function nufusSvg() {
  var S = D.DB.bagimlilik.seri, W = 640, SOL = 46, SAG = 596, UST = 26, ALT = 230, H = 266, X0 = 1960, X1 = 2025, Y1 = 18;
  function x(t) { return SOL + (t - X0) / (X1 - X0) * (SAG - SOL); }
  function y(v) { return ALT - v / Y1 * (ALT - UST); }
  var son = S[S.length - 1], ilk = S[0];
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sn-t sn-d">',
    '<title id="sn-t">Yaşlı bağımlılık oranı, Türkiye, 1960–' + son[0] + "</title>",
    '<desc id="sn-d">' + esc("65 yaş üstü nüfusun 15–64 yaş nüfusuna oranı (yüzde). " + [1960, 1965, 1999, 2008, 2023, son[0]].map(function (t) { return t + ": " + bir(D.nufus("bagimlilik", t)); }).join("; ") + ". Kaynak: Dünya Bankası.") + "</desc>"];
  [0, 5, 10, 15].forEach(function (v) {
    p.push('<path class="' + (v ? "izgara" : "sifir") + '" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + "</text>");
  });
  [[1999, "4447"], [2008, "5510"], [2023, "7438"]].forEach(function (e) {
    p.push('<path class="esik" d="M' + x(e[0]).toFixed(1) + " " + UST + " V" + ALT + '"/>');
    p.push('<text class="esik-yazi" x="' + (x(e[0]) - 4).toFixed(1) + '" y="' + (UST + 8) + '" text-anchor="end">' + e[1] + "</text>");
  });
  p.push('<path class="cizgi-1" d="' + S.map(function (n, i) { return (i ? "L" : "M") + x(n[0]).toFixed(1) + " " + y(n[1]).toFixed(1); }).join(" ") + '"/>');
  [[ilk[0], ilk[1], "start", 10], [1999, D.nufus("bagimlilik", 1999), "middle", -10], [son[0], son[1], "end", -10]].forEach(function (n) {
    p.push('<circle class="nokta" cx="' + x(n[0]).toFixed(1) + '" cy="' + y(n[1]).toFixed(1) + '" r="3.5"/>');
    p.push('<text class="deger" x="' + (x(n[0]) + (n[2] === "start" ? 6 : 0)).toFixed(1) + '" y="' + (y(n[1]) + n[3] + (n[3] > 0 ? 4 : 0)).toFixed(1) + '" text-anchor="' + n[2] + '">' + bir(n[1]) + "</text>");
  });
  [1960, 1970, 1980, 1990, 2000, 2010, 2020].forEach(function (t) {
    p.push('<text x="' + x(t).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + t + "</text>");
  });
  p.push("</svg>");
  return p.join("");
}

function alanlar() {
  var o = olcum(), a9 = D.abo(9000);
  var d99 = D.nufus("bagimlilik", 1999), d25 = D.nufus("bagimlilik", 2025);
  return {
    kEyt: yas(o.ek.eyt[0].yas), kGecis: yas(o.ek.eyt[1].yas), k2025: yas(o.k2025.yas),
    eEyt: yas(o.ee.eyt[0].yas), e2025: yas(o.e2025.yas),
    kCalismaEyt: yas(o.ek.eyt[0].calisma), kCalisma2025: yas(o.k2025.calisma),
    abo9000g82: yuzde0(a9.gecici82), abo9000m29: yuzde0(a9.m29),
    kademeIlk: String(o.kademeIlk),
    kEytOnce1985: yas(o.bul(o.K, 1985).eytOncesi.yas), kEytOnce1995: yas(o.bul(o.K, 1995).eytOncesi.yas),
    aboK2000: yuzde1(D.fiiliAbo(o.k2000)), aboK2025: yuzde1(D.fiiliAbo(o.k2025)), aboE2025: yuzde1(D.fiiliAbo(o.e2025)),
    gunK2000: nf.format(o.k2000.primGun), gunK2025: nf.format(o.k2025.primGun),
    esikFarki: yas(o.ek.eyt[1].yas - o.ek.eyt[0].yas),
    dep1965: bir(D.nufus("bagimlilik", 1965)), dep1999: bir(d99), dep2025: bir(d25),
    depArtis: "%" + Math.round((d25 / d99 - 1) * 100),
    le1965: bir(D.nufus("yasam", 1965)), le2024: bir(D.nufus("yasam", 2024))
  };
}

function bloklar() {
  var o = olcum();
  return {
    "SG-ZAMAN": figur("sz", "Üç kural, iki eşik", "Emeklilik koşullarını değiştiren kanunlar; vurgulu satırlar yeni kuralın başladığı eşikler.", zamanSvg(),
      "Koşulları belirleyen, ilk sigortalılık tarihidir: her kanun mevcut sigortalıları eski kurala bağlı bıraktı. Kaynak: 506 ve 5510 sayılı Kanunların güncel metinleri (mevzuat.gov.tr) ve değişiklik notları."),
    "SG-YAS": figur("sy", "Aynı kariyer, farklı giriş yılı", "20 yaşında başlayıp yılda 360 gün prim ödeyen 4/a sigortalının tam emeklilik yaşı.", yasSvg(o),
      "Düz çizgiler bugünkü kanun; kesikli çizgiler 1999 öncesi girişlilerin 2023 öncesi kuralla emeklilik yaşı. Hesap: sitenin emeklilik tarihi çekirdeği (506 Geçici m.81/B, 5510 Geçici m.9, m.28, Geçici m.95)."),
    "SG-TABLO": tabloHtml(o),
    "SG-ABO": figur("sa", "Aynı gün, iki oran", "Toplam prim gününe göre aylık bağlama oranı; aylık, güncellenmiş ortalama kazanç × bu oran.", aboSvg(),
      "İlk 3.600 günde eski kural her yıla %3,5, bugünkü kural %2 veriyor; fark bu noktadan sonra 15 puanda sabit. Bugünkü kuralın tavanı %90. Kaynak: 506 Geçici m.82, 5510 m.29."),
    "SG-NUFUS": figur("sn", "Yaşlanma reformlarla hızlandı", "65 yaş üstü nüfusun, 15–64 yaş nüfusuna oranı (yüzde). Kesikli çizgiler reform yılları.", nufusSvg(),
      "Kaynak: Dünya Bankası, World Development Indicators (SP.POP.DPND.OL), BM nüfus tahminlerine dayanır; " + esc(D.DB.okundu.split("-").reverse().join(".")) + " tarihinde indirildi.")
  };
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
  var b = bloklar();
  Object.keys(b).forEach(function (ad) { html = blok(html, ad, b[ad]); });
  return alanYaz(html);
}

if (require.main === module) {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var eski = fs.readFileSync(YAZI, "utf8"), yeni = uret(eski);
  if (kontrol) {
    if (yeni !== eski) { console.error("Bayat: sosyal güvenlik yazısı — 'node tools/sosyal-guvenlik-yazisi.js' çalıştırın."); process.exit(1); }
    console.log("Sosyal güvenlik yazısı hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(YAZI, yeni);
    console.log("Sosyal güvenlik yazısı yazıldı.");
  }
}
module.exports = { alanlar: alanlar, olcum: olcum };
