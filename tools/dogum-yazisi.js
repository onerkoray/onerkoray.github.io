#!/usr/bin/env node
/*
 * "Doğum parası ne kadar?" yazısının gövde görselleri ve tablosu:
 *   DOGUM-ZAMAN  izin süreleri diyagramı (hafta, doğum = 0)
 *   DOGUM-TABLO  brüt maaşa göre ödenek ve izin yılının net farkı
 *   DOGUM-AYLAR  60.000 TL brüt örneğin on iki ayı
 *   DOGUM-EGRI   izin yılının net farkı, brüt maaşa göre
 * Rakamlar makaleler/dogum-parasi-ne-kadar/dogum.js'ten, o da rapor
 * parası çekirdeğinden ve bordro motorundan. Renkler CSS'ten (--dv-*):
 * SVG temayı izler, sayfa metniyle aynı yazı tipini kullanır.
 *
 * Kullanım:
 *   node tools/dogum-yazisi.js           # yazıya yerleştir
 *   node tools/dogum-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var D = require(path.join(KOK, "makaleler", "dogum-parasi-ne-kadar", "dogum.js"));
var YAZI = path.join(KOK, "makaleler", "dogum-parasi-ne-kadar", "index.html");

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function tl(v) { return nf0.format(Math.round(v)) + " TL"; }
function isaretli(v) { var r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + nf0.format(Math.abs(r)); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function f1(x) { return (Math.round(x * 10) / 10).toString(); }
var AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
var AY_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(s) { var p = s.split("-"); return +p[2] + " " + AY_UZUN[+p[1] - 1] + " " + p[0]; }

function figur(id, baslik, alt, svg, aciklama, tablo) {
  return [
    '<figure class="ed-grafik" aria-labelledby="' + id + '-b">',
    '<p class="ed-grafik-baslik" id="' + id + '-b">' + esc(baslik) + "</p>",
    '<p class="ed-grafik-alt">' + esc(alt) + "</p>",
    '<div class="ed-grafik-kap">' + svg + "</div>",
    "<figcaption>" + aciklama + "</figcaption>",
    tablo || "",
    "</figure>"
  ].filter(Boolean).join("\n");
}

/* ------------------------------------------------ 1. zaman çizelgesi */
function zamanSvg() {
  var satirlar = D.zaman();
  var W = 640, SOL = 176, SAG = 560, UST = 30, SATIR = 50, H = UST + satirlar.length * SATIR + 34;
  var BAS = -10, SON = 22;
  function x(h) { return SOL + (h - BAS) / (SON - BAS) * (SAG - SOL); }
  var acik = satirlar.map(function (s) {
    return s.ad + ": doğumdan önce " + s.once + " hafta, sonra " + (s.baba ? s.gun + " gün" : s.sonra + " hafta") + ", " + s.gun + " gün";
  }).join("; ");
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="dz-t dz-d">',
    '<title id="dz-t">Doğum izni süreleri</title><desc id="dz-d">' + esc(acik) + "</desc>"];
  for (var h = -8; h <= SON; h += 4) {
    var gx = x(h).toFixed(1);
    p.push('<path class="izgara" d="M' + gx + " " + (UST - 8) + " V" + (H - 30) + '"/>');
    p.push('<text x="' + gx + '" y="' + (H - 12) + '" text-anchor="middle">' + (h > 0 ? "+" : h < 0 ? "−" : "") + Math.abs(h) + "</text>");
  }
  p.push('<text x="0" y="' + (H - 12) + '">hafta</text>');
  satirlar.forEach(function (s, i) {
    var y = UST + i * SATIR, h = 16, cy = y + h / 2;
    var ad = s.ad.length > 24 ? s.ad.replace(/^(.{1,24}) (.*)$/, function (m, a, b) { return a + '</tspan><tspan x="0" dy="15">' + b; }) : esc(s.ad);
    p.push('<text class="deger" x="0" y="' + (cy + (s.ad.length > 24 ? -3 : 5)) + '"><tspan>' + ad + "</tspan></text>");
    if (s.baba) {
      p.push('<rect class="seri-3" x="' + x(0).toFixed(1) + '" y="' + y + '" width="' + (x(s.sonra) - x(0)).toFixed(1) + '" height="' + h + '" rx="3"/>');
      p.push('<text x="' + (x(s.sonra) + 8).toFixed(1) + '" y="' + (cy + 5) + '">' + s.gun + " gün ücretli izin, işveren öder</text>");
      return;
    }
    if (s.once < D.ANALIK.once) {
      p.push('<rect class="calisma" x="' + x(-D.ANALIK.once).toFixed(1) + '" y="' + (y + 1) + '" width="' + (x(-s.once) - x(-D.ANALIK.once) - 2).toFixed(1) + '" height="' + (h - 2) + '" rx="3"/>');
      p.push('<text class="kucuk" x="' + ((x(-D.ANALIK.once) + x(-s.once)) / 2).toFixed(1) + '" y="' + (y - 4) + '" text-anchor="middle">çalışıyor</text>');
    }
    p.push('<rect class="seri-1" x="' + x(-s.once).toFixed(1) + '" y="' + y + '" width="' + (x(0) - x(-s.once) - 1).toFixed(1) + '" height="' + h + '" rx="3"/>');
    p.push('<rect class="seri-2" x="' + (x(0) + 1).toFixed(1) + '" y="' + y + '" width="' + (x(s.sonra) - x(0) - 1).toFixed(1) + '" height="' + h + '" rx="3"/>');
    p.push('<text class="deger" x="' + (x(s.sonra) + 8).toFixed(1) + '" y="' + (cy + 5) + '">' + s.gun + " gün</text>");
    p.push('<text class="kucuk" x="' + (x(s.sonra) + 8).toFixed(1) + '" y="' + (cy + 20) + '">' + s.once + " + " + s.sonra + " hafta</text>");
  });
  p.push('<path class="sifir" d="M' + x(0).toFixed(1) + " " + (UST - 14) + " V" + (H - 30) + '"/>');
  p.push('<text class="deger" x="' + x(0).toFixed(1) + '" y="' + (UST - 18) + '" text-anchor="middle">doğum</text>');
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 2. tablo */
function tabloHtml() {
  var t = D.tablo();
  var satir = t.map(function (k) {
    var ad = k.brut === D.ASGARI ? "Asgari ücret (" + nf0.format(k.brut) + ")" : k.brut === D.TAVAN ? "SGK tavanı (" + nf0.format(k.brut) + ")" : nf0.format(k.brut);
    return "<tr><th scope=\"row\">" + ad + '</th><td class="num">' + nf2.format(k.gunlukKazanc) + '</td><td class="num">' + nf2.format(k.gunluk) +
      '</td><td class="num">' + tl(k.toplam) + '</td><td class="num">' + tl(k.kayipNet) + '</td><td class="num"><strong>' + isaretli(k.yilFarki) + " TL</strong></td></tr>";
  }).join("\n");
  return [
    '<div class="table-scroll">',
    '<table class="data-table">',
    "<caption>Doğum " + tarih(D.DOGUM) + ", önceki on iki ayda aynı brüt, işveren izinde ücret ödemiyor. Tutarlar TL.</caption>",
    '<thead><tr><th scope="col">Aylık brüt</th><th scope="col" class="num">Günlük kazanç</th><th scope="col" class="num">Günlük ödenek</th><th scope="col" class="num">' +
      D.kisi(D.ORNEK_BRUT).sonuc.raporGunu + ' günlük ödenek</th><th scope="col" class="num">İzinde kaybolan net</th><th scope="col" class="num">İzin yılının net farkı</th></tr></thead>',
    "<tbody>", satir, "</tbody>",
    "</table>",
    "</div>"
  ].join("\n");
}

/* ------------------------------------------------ 3. on iki ay */
function aylarSvg() {
  var a = D.yilAylari(D.ORNEK_BRUT);
  var W = 640, SOL = 46, SAG = 632, UST = 34, ALT = 228, H = 290;
  var enCok = a.reduce(function (m, x) { return Math.max(m, x.normal, x.maas + x.odenek); }, 0);
  var tavan = Math.ceil(enCok / 10000) * 10000;
  function y(v) { return ALT - v / tavan * (ALT - UST); }
  var gen = (SAG - SOL) / 12, w = 30;
  var acik = a.map(function (x) { return AY_UZUN[x.ay - 1] + ": maaş " + tl(x.maas) + ", ödenek " + tl(x.odenek) + ", izinsiz " + tl(x.normal); }).join("; ");
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="da-t da-d">',
    '<title id="da-t">60.000 TL brüt maaşta doğum izni yılının on iki ayı</title><desc id="da-d">' + esc(acik) + "</desc>"];
  p.push('<rect class="seri-1" x="' + SOL + '" y="4" width="11" height="11" rx="2"/><text x="' + (SOL + 16) + '" y="14">Maaşın neti</text>');
  p.push('<rect class="seri-2" x="' + (SOL + 112) + '" y="4" width="11" height="11" rx="2"/><text x="' + (SOL + 128) + '" y="14">SGK ödeneği</text>');
  p.push('<path class="normal" d="M' + (SOL + 232) + " 9.5 h14\"/><text x=\"" + (SOL + 252) + '" y="14">İzin olmasaydı net</text>');
  for (var v = 0; v <= tavan; v += 10000) {
    p.push('<path class="' + (v ? "izgara" : "sifir") + '" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v / 1000) + (v ? " bin" : "") + "</text>");
  }
  a.forEach(function (x, i) {
    var cx = SOL + gen * (i + 0.5), x0 = cx - w / 2;
    if (x.maas > 0) p.push('<rect class="seri-1" x="' + x0.toFixed(1) + '" y="' + y(x.maas).toFixed(1) + '" width="' + w + '" height="' + (ALT - y(x.maas)).toFixed(1) + '" rx="2"/>');
    if (x.odenek > 0) {
      var alt = x.maas > 0 ? y(x.maas) - 2 : ALT;
      p.push('<rect class="seri-2" x="' + x0.toFixed(1) + '" y="' + y(x.maas + x.odenek).toFixed(1) + '" width="' + w + '" height="' + Math.max(1, alt - y(x.maas + x.odenek)).toFixed(1) + '" rx="2"/>');
    }
    p.push('<path class="normal" d="M' + (x0 - 4).toFixed(1) + " " + y(x.normal).toFixed(1) + " h" + (w + 8) + '"/>');
    p.push('<text x="' + cx.toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + AY[i] + "</text>");
    var fark = x.maas + x.odenek - x.normal;
    if (Math.abs(fark) >= 1) p.push('<text class="kucuk" x="' + cx.toFixed(1) + '" y="' + (ALT + 36) + '" text-anchor="middle">' + isaretli(fark) + "</text>");
  });
  p.push('<text class="kucuk" x="' + SOL + '" y="' + (H - 6) + '">alt satır: izin olmasaydı nete göre fark, TL</text>');
  p.push("</svg>");
  return p.join("");
}

/* ------------------------------------------------ 4. eğri */
function egriSvg() {
  var e = D.egri(), b = D.basabas(), z = D.zirve();
  var W = 640, SOL = 58, SAG = 612, UST = 26, ALT = 250, H = 292;
  var XMIN = 25000, XMAX = D.EGRI_SON;
  var YMIN = -50000, YMAX = 100000;
  function x(v) { return SOL + (v - XMIN) / (XMAX - XMIN) * (SAG - SOL); }
  function y(v) { return ALT - (v - YMIN) / (YMAX - YMIN) * (ALT - UST); }
  e.forEach(function (p) { if (p.fark < YMIN || p.fark > YMAX) throw new Error("Eğri ölçek dışına taştı: " + p.brut + " → " + p.fark); });
  var p = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="de-t de-d">',
    '<title id="de-t">İzin yılının net farkı, brüt maaşa göre</title>',
    '<desc id="de-d">' + esc("Fark " + nf0.format(Math.round(b.alt)) + " TL brütün altında eksi, " + nf0.format(Math.round(b.alt)) + " ile " +
      nf0.format(Math.round(b.ust)) + " TL arasında artı; en yüksek " + nf0.format(z.brut) + " TL brütte " + isaretli(z.fark) + " TL.") + "</desc>"];
  for (var v = -40000; v <= YMAX; v += 20000) {
    p.push('<path class="' + (v ? "izgara" : "sifir") + '" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
    p.push('<text x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + isaretli(v / 1000) + (v ? " bin" : "") + "</text>");
  }
  [50000, 100000, 150000, 200000, 250000, 300000].forEach(function (v) {
    p.push('<text x="' + x(v).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + (v / 1000) + " bin</text>");
  });
  p.push('<text x="' + SAG + '" y="' + (ALT + 36) + '" text-anchor="end">aylık brüt maaş, TL</text>');
  [[D.TAVAN_ONCEKI, "2025 tavanı"], [D.TAVAN, "2026 tavanı"]].forEach(function (t) {
    p.push('<path class="esik" d="M' + x(t[0]).toFixed(1) + " " + UST + " V" + ALT + '"/>');
    var sag = t[0] === D.TAVAN;
    p.push('<text class="esik-yazi" x="' + (x(t[0]) + (sag ? -4 : 4)).toFixed(1) + '" y="' + (UST + 10) + '" text-anchor="' + (sag ? "end" : "start") + '">' + t[1] + "</text>");
  });
  var yol = e.map(function (q, i) { return (i ? "L" : "M") + x(q.brut).toFixed(1) + " " + y(q.fark).toFixed(1); }).join(" ");
  p.push('<path class="cizgi-1" d="' + yol + '"/>');
  [[b.alt, "start"], [b.ust, "end"]].forEach(function (k) {
    p.push('<circle class="nokta" cx="' + x(k[0]).toFixed(1) + '" cy="' + y(0).toFixed(1) + '" r="4.5"/>');
    p.push('<text class="deger" x="' + (x(k[0]) + (k[1] === "start" ? 8 : -8)).toFixed(1) + '" y="' + (y(0) + 18).toFixed(1) + '" text-anchor="' + k[1] + '">' + nf0.format(Math.round(k[0])) + " TL</text>");
  });
  p.push('<circle class="nokta" cx="' + x(z.brut).toFixed(1) + '" cy="' + y(z.fark).toFixed(1) + '" r="4.5"/>');
  p.push('<text class="deger" x="' + (x(z.brut) - 10).toFixed(1) + '" y="' + (y(z.fark) + 4).toFixed(1) + '" text-anchor="end">' + isaretli(z.fark) + " TL</text>");
  var as = e[0];
  p.push('<circle class="nokta" cx="' + x(as.brut).toFixed(1) + '" cy="' + y(as.fark).toFixed(1) + '" r="4.5"/>');
  p.push('<text class="deger" x="' + (x(as.brut) + 8).toFixed(1) + '" y="' + (y(as.fark) + 18).toFixed(1) + '">asgari ücret ' + isaretli(as.fark) + " TL</text>");
  p.push("</svg>");
  return p.join("");
}

function bloklar() {
  var b = D.basabas(), z = D.zirve(), k = D.kisi(D.ORNEK_BRUT);
  return {
    "DOGUM-ZAMAN": figur("dz", "Kim, doğumun neresinde, kaç gün?", "Hafta; doğum günü sıfır. Annenin izni ve SGK ödeneği aynı süreyi kapsar.", zamanSvg(),
      "Doğum öncesi sekiz haftanın altısında doktor onayıyla çalışılabilir; çalışılan süre doğum sonrasına eklenir ve ödenen gün sayısı değişmez. " +
      "Kaynak: 4857 s.K. m.74 ve Ek m.2, 5510 s.K. m.18; hepsi 7578 sayılı Kanunla değişik."),
    "DOGUM-TABLO": tabloHtml(),
    "DOGUM-AYLAR": figur("da", "60.000 TL brüt: izin yılının on iki ayı", "Doğum " + tarih(D.DOGUM) + "; izin " + tarih(k.sonuc.segmentler[0].bas) + " – " + tarih(k.sonuc.bitis) + ".", aylarSvg(),
      "Mayıs–Eylül arası maaş yok, yalnız ödenek var; ödenek izinsiz netin biraz altında kalıyor. Kasım ve Aralık'ta izin aylarında düşen vergi matrahı yüzünden net, izinsiz yıldan yüksek. Yılın toplamı: " +
      isaretli(k.yilFarki) + " TL."),
    "DOGUM-EGRI": figur("de", "İzin yılı nette kayıp mı, kazanç mı?", "Yıllık net fark (maaş + ödenek − izinsiz yılın neti), aylık brüt maaşa göre. Doğum " + tarih(D.DOGUM) + ".", egriSvg(),
      "Kesikli çizgiler SGK tavanları. Ödenek, on iki ayın her birinin kendi tavanıyla sınırlı kazançtan hesaplanıyor; bu örnekte yedi ay 2025'te kaldığı için 2025 tavanının üstündeki maaşta ödenek, kaybolan netten yavaş büyüyor.")
  };
}

function yerlestir(html) {
  var b = bloklar();
  Object.keys(b).forEach(function (ad) {
    var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
    var i = html.indexOf(bas), j = html.indexOf(bit);
    if (i < 0 || j < 0) throw new Error("Blok bulunamadı: " + ad);
    html = html.slice(0, i + bas.length) + "\n" + b[ad] + "\n" + html.slice(j);
  });
  return html;
}

if (require.main === module) {
  var eski = fs.readFileSync(YAZI, "utf8"), yeni = yerlestir(eski);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== eski) { console.error("Doğum parası yazısının görselleri bayat — 'node tools/dogum-yazisi.js' çalıştırın."); process.exit(1); }
    console.log("Doğum parası yazısının görselleri hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(YAZI, yeni);
    console.log(yeni !== eski ? "Doğum parası yazısı güncellendi." : "Doğum parası yazısı zaten güncel.");
  }
}
module.exports = { bloklar: bloklar };
