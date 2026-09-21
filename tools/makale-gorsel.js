#!/usr/bin/env node
/*
 * Makale kapak görsellerini üretir: 1200x630, açık zeminde veri illüstrasyonu.
 *
 * Neden veri illüstrasyonu: bu sitenin kimliği "hesaplanmış, kaynaklı, açık".
 * Stok fotoğraf ya da soyut görsel yerine, her kapak o yazının ARGÜMANININ
 * kendisi — ve rakamlar bordro motorundan gelir, yani yazıdaki tablolarla
 * asla ayrışamaz. Araç karoları koyu yeşil; makale kapakları açık zemin.
 * Bu ayrım iki bölümü ilk bakışta ayırır.
 *
 * Renk: kategorik seriler dataviz doğrulayıcısından geçirilmiş üçlüdür
 * (#2a78d6 / #eb6834 / #1baf7a — krem zeminde tüm kontroller PASS).
 * Marka yeşili #0e7c66 kategorik seri olarak KULLANILMAZ: kroma tabanının
 * altında kalıyor ve veri işareti olarak gri okunuyor. Tek serili grafiklerde
 * ise ayırt etme sorunu olmadığı ve kontrastı daha iyi olduğu için kullanılır.
 *
 * Kullanım:
 *   node tools/makale-gorsel.js            # hepsini üret
 *   node tools/makale-gorsel.js <slug>     # tekini üret
 *   node tools/makale-gorsel.js --list     # üretilecekleri listele
 */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var { execFileSync } = require("child_process");

var KOK = path.dirname(__dirname);
var CIKTI = path.join(KOK, "images", "makale");
var B = require(path.join(KOK, "bordro", "motor.js"));
var CB = require(path.join(KOK, "bordro", "calisma-bicimi.js"));
var CK = require(path.join(KOK, "bordro", "cikis.js"));
var MTV = require(path.join(KOK, "mtv-hesaplama", "tarife.js"));

var CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

/* --- renk rolleri --- */
/* OTV kapagi tarifeyi DOGRUDAN araciN modulunden okur: kapaktaki
   sicrama ile aracin hesabi ayrisamaz. */
var OTV = require(path.join(__dirname, "..", "otv-hesaplama", "tarife.js"));
/* Fazla mesai kapagi zam katsayilarini ve saat bolenini bordro
   parametrelerinden okur; yazidaki tabloyla ayrisamaz. */
var BORDRO = require(path.join(__dirname, "..", "bordro", "parametreler.js"));

var R = {
  zemin: "#f7f5f0",
  murekkep: "#17201d",
  ikincil: "#56605c",
  izgara: "#e2ddd2",
  marka: "#0e7c66",     // tek serili işaretler
  s1: "#2a78d6",        // kategorik 1 — çalışan
  s2: "#eb6834",        // kategorik 2 — şahıs
  s3: "#1baf7a"         // kategorik 3 — limited
};

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------- grafik parçaları (inline SVG) ---------- */

/* Tek seri çizgi: 12 aylık net maaş. Dipte ve yükselişte nokta + etiket. */
function cizgiNetMaas() {
  var aylar = B.hesaplaYil(80000, 2026).aylar;
  var net = aylar.map(function (a) { return a.net; });
  var enAz = Math.min.apply(null, net), enCok = Math.max.apply(null, net);
  var W = 600, H = 360, P = 28;
  var x = function (i) { return P + i * (W - 2 * P) / 11; };
  var y = function (v) { return H - P - 34 - (v - enAz) / (enCok - enAz) * (H - 2 * P - 46); };

  var d = net.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
  var dipIdx = net.indexOf(enAz);
  var yukselisIdx = dipIdx + 1 < 12 ? dipIdx + 1 : dipIdx;

  var izgara = [0, 0.5, 1].map(function (t) {
    var yy = P + t * (H - 2 * P);
    return '<line x1="' + P + '" y1="' + yy + '" x2="' + (W - P) + '" y2="' + yy +
      '" stroke="' + R.izgara + '" stroke-width="1"/>';
  }).join("");

  function nokta(i, renk) {
    return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(net[i]).toFixed(1) +
      '" r="7" fill="' + renk + '" stroke="' + R.zemin + '" stroke-width="2.5"/>';
  }

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="2026 yilinda 80.000 TL brut ucretin aylik net seyri">' +
    izgara +
    '<path d="' + d + '" fill="none" stroke="' + R.marka +
    '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    nokta(0, R.marka) + nokta(dipIdx, R.s2) + nokta(yukselisIdx, R.s3) +
    '<text x="' + (x(dipIdx) - 14) + '" y="' + (y(net[dipIdx]) + 6) +
    '" text-anchor="end" font-size="16" font-weight="700" fill="' + R.s2 + '">Temmuz</text>' +
    '<text x="' + (x(yukselisIdx) + 14) + '" y="' + (y(net[yukselisIdx]) - 18) +
    '" text-anchor="start" font-size="16" font-weight="700" fill="' + R.s3 + '">Ağustos ↑</text>' +
    '<text x="' + P + '" y="' + (H - 4) + '" font-size="14" fill="' + R.ikincil + '">Ocak</text>' +
    '<text x="' + (W - P) + '" y="' + (H - 4) + '" font-size="14" text-anchor="end" fill="' +
    R.ikincil + '">Aralık</text>' +
    "</svg>";
}

/* Kategorik bant: gelir ekseninde kazanan çalışma biçimi.
   Kapak boyutunda dört çizgi okunmaz; bant yazının tezini doğrudan gösterir. */
function bantKazanan() {
  var GIDER = 200000, ALT = 400000, UST = 8000000, ADIM = 100000;
  var renk = { calisan: R.s1, sahis: R.s2, limited: R.s3, limitedUcret: R.s3 };
  var ad = { calisan: "Çalışan", sahis: "Şahıs", limited: "Limited", limitedUcret: "Limited" };

  var dilimler = [];
  for (var m = ALT; m <= UST; m += ADIM) {
    var k = CB.karsilastir({ yillikMaliyet: m, yillikGider: GIDER, ihracatOrani: 0 }).enIyi.kod;
    var son = dilimler[dilimler.length - 1];
    if (son && son.kod === k) son.bit = m;
    else dilimler.push({ kod: k, bas: m, bit: m });
  }

  var W = 600, H = 360, P = 28, BY = 132, BH = 88;
  var x = function (v) { return P + (v - ALT) / (UST - ALT) * (W - 2 * P); };

  var parcalar = dilimler.map(function (d) {
    var x0 = x(d.bas), x1 = x(d.bit + ADIM);
    var w = Math.max(0, x1 - x0 - 2);   // 2px yüzey boşluğu
    var etiket = "";
    if (w > 64) {
      etiket = '<text x="' + (x0 + w / 2) + '" y="' + (BY + BH / 2 + 6) +
        '" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">' +
        esc(ad[d.kod]) + "</text>";
    }
    return '<rect x="' + x0.toFixed(1) + '" y="' + BY + '" width="' + w.toFixed(1) +
      '" height="' + BH + '" rx="4" fill="' + renk[d.kod] + '"/>' + etiket;
  }).join("");

  var eksen = [400000, 2000000, 4000000, 6000000, 8000000].map(function (v) {
    return '<text x="' + x(v).toFixed(1) + '" y="' + (BY + BH + 26) +
      '" text-anchor="middle" font-size="13" fill="' + R.ikincil + '">' +
      (v >= 1000000 ? (v / 1000000) + " mn" : nf0.format(v / 1000) + " bin") + "</text>";
  }).join("");

  /* Lejant: bantlarin bir kismi etiket alamayacak kadar dar; kimlik
     renge birakilamaz (dataviz kurali: >=2 seri icin lejant zorunlu). */
  var lejantOgeleri = [["calisan", R.s1], ["sahis", R.s2], ["limited", R.s3]];
  var lx = P;
  var lejant = lejantOgeleri.map(function (o) {
    var g = '<rect x="' + lx + '" y="' + (BY + BH + 52) + '" width="13" height="13" rx="3" fill="' + o[1] + '"/>' +
      '<text x="' + (lx + 20) + '" y="' + (BY + BH + 63) + '" font-size="14" fill="' + R.murekkep + '">' +
      esc(ad[o[0]]) + "</text>";
    lx += 26 + esc(ad[o[0]]).length * 8.4;
    return g;
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Gelir duzeyine gore en cok net birakan calisma bicimi">' +
    '<text x="' + P + '" y="' + (BY - 26) + '" font-size="16" font-weight="700" fill="' +
    R.murekkep + '">Hangi gelirde hangisi kazanıyor?</text>' +
    parcalar + eksen + lejant +
    '<text x="' + P + '" y="' + (BY + BH + 96) + '" font-size="13" fill="' + R.ikincil +
    '">yıllık toplam maliyet · gider 200 bin TL</text>' +
    "</svg>";
}

/* Tek hue sütun: istisnanın yıllar içindeki büyümesi (magnitude). */
function sutunIstisna() {
  var yillar = B.yillar().filter(function (y) {
    return B.parametre(y).istisnaRejimi === "asgari-ucret";
  }).sort();
  var veri = yillar.map(function (y) {
    var P = B.parametre(y), d = P.donemler[P.donemler.length - 1];
    return { yil: y, deger: B.hesaplaYil(d.asgariBrut * 6, y).toplam.istisna };
  });
  var enCok = Math.max.apply(null, veri.map(function (v) { return v.deger; }));

  var W = 600, H = 360, P = 28, TY = 282;
  var gen = (W - 2 * P) / veri.length;

  var cubuklar = veri.map(function (v, i) {
    var h = v.deger / enCok * 150;
    var x0 = P + i * gen + 6;
    var w = gen - 14;                          // çubuklar arası yüzey boşluğu
    var koyuluk = 0.42 + 0.58 * (v.deger / enCok);   // tek hue, çok olan koyu
    return '<rect x="' + x0.toFixed(1) + '" y="' + (TY - h).toFixed(1) + '" width="' + w.toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="4" fill="' + R.marka + '" fill-opacity="' + koyuluk.toFixed(2) + '"/>' +
      '<text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (TY - h - 10).toFixed(1) +
      '" text-anchor="middle" font-size="14" font-weight="700" fill="' + R.murekkep + '">' +
      nf0.format(Math.round(v.deger / 1000)) + "K</text>" +
      '<text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (TY + 22) +
      '" text-anchor="middle" font-size="14" fill="' + R.ikincil + '">' + v.yil + "</text>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Yillara gore her calisanin yillik asgari ucret istisnasi">' +
    '<line x1="' + P + '" y1="' + TY + '" x2="' + (W - P) + '" y2="' + TY +
    '" stroke="' + R.izgara + '" stroke-width="1.5"/>' +
    '<text x="' + P + '" y="60" font-size="15" font-weight="700" fill="' + R.murekkep +
    '">Her çalışanın yıllık istisnası (TL)</text>' + cubuklar +
    "</svg>";
}

/* Veri olmayan yazılar için tipografik işaret: durum göstergesi. */
function durumIsareti(satirlar) {
  var W = 600, H = 360, P = 28;
  var ic = satirlar.map(function (s, i) {
    var y = 96 + i * 86;
    var renk = s.durum === "var" ? R.s3 : (s.durum === "yok" ? R.s2 : R.ikincil);
    var simge = s.durum === "var" ? "✓" : (s.durum === "yok" ? "✕" : "•");
    return '<circle cx="' + (P + 18) + '" cy="' + (y - 6) + '" r="17" fill="' + renk + '" fill-opacity="0.14"/>' +
      '<text x="' + (P + 18) + '" y="' + (y + 1) + '" text-anchor="middle" font-size="19" font-weight="700" fill="' +
      renk + '">' + simge + "</text>" +
      '<text x="' + (P + 50) + '" y="' + (y - 10) + '" font-size="18" font-weight="700" fill="' +
      R.murekkep + '">' + esc(s.baslik) + "</text>" +
      '<text x="' + (P + 50) + '" y="' + (y + 13) + '" font-size="14" fill="' + R.ikincil + '">' +
      esc(s.alt) + "</text>";
  }).join("");
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Yazinin ele aldigi baslikların guncel durumu">' + ic + "</svg>";
}

/* Yatay sütun: aynı kişi, aynı ücret, farklı ayrılma şekli.
   Tek ölçü (para) olduğu için tek hue — kategorik palet kullanılmıyor. */
function sutunAyrilmaSekli() {
  var ort = { ciplakBrut: 60000, giydirmeEkleri: 7000,
              iseGiris: "2016-09-01", cikis: "2026-09-01" };
  function hesap(tur) {
    var r = CK.hesapla({ fesihTuru: tur, ciplakBrut: ort.ciplakBrut,
      giydirmeEkleri: ort.giydirmeEkleri, iseGiris: ort.iseGiris, cikis: ort.cikis });
    var k = r.kidem.hak ? r.kidem.net : 0;
    var i = (r.ihbar && r.ihbar.hak) ? r.ihbar.net : 0;
    return k + i;
  }
  var satirlar = [
    { ad: "Gerekçesiz istifa", alt: "Kıdem yok, ihbar yok", v: hesap("istifa") },
    { ad: "Evlilik · askerlik · haklı fesih", alt: "Kıdem doğar", v: hesap("evlilik") },
    { ad: "İşveren feshi", alt: "Kıdem + ihbar", v: hesap("isveren") }
  ];
  var enCok = Math.max.apply(null, satirlar.map(function (s) { return s.v; })) || 1;
  var W = 600, H = 360, P = 28, BG = W - 2 * P - 150;

  var ic = satirlar.map(function (s, i) {
    var yb = 78 + i * 100;
    var gen = Math.max(2, s.v / enCok * BG);
    var sifir = s.v <= 0;
    return '<text x="' + P + '" y="' + (yb - 26) + '" font-size="18" font-weight="700" fill="' +
      R.murekkep + '">' + esc(s.ad) + "</text>" +
      '<text x="' + P + '" y="' + (yb - 7) + '" font-size="13" fill="' + R.ikincil + '">' +
      esc(s.alt) + "</text>" +
      (sifir
        ? '<rect x="' + P + '" y="' + yb + '" width="46" height="26" rx="4" fill="' +
          R.s2 + '" fill-opacity="0.16"/>'
        : '<rect x="' + P + '" y="' + yb + '" width="' + gen.toFixed(1) +
          '" height="26" rx="4" fill="' + R.marka + '"/>') +
      '<text x="' + (sifir ? P + 58 : P + gen + 12) + '" y="' + (yb + 19) +
      '" font-size="19" font-weight="800" fill="' + (sifir ? R.s2 : R.murekkep) + '">' +
      (sifir ? "0 TL" : nf0.format(s.v) + " TL") + "</text>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Ayni ucret ve kidemde ayrilma seklinin tazminata etkisi">' +
    '<text x="' + P + '" y="' + (P + 6) + '" font-size="15" fill="' + R.ikincil +
    '">10 yıl kıdem · 60.000 TL brüt + 7.000 TL yol-yemek · net</text>' + ic + "</svg>";
}

/* Kıdem tazminatının giydirilmiş ücrete göre seyri: tavandan sonra düzleşir.
   Yazının tezi tam olarak bu kırılma, o yüzden kırılma noktası işaretli. */
function cizgiTavan() {
  var giris = "2016-09-01", cikis = "2026-09-01";
  function kidem(giydirilmis) {
    return CK.hesapla({ fesihTuru: "isveren", ciplakBrut: giydirilmis,
      giydirmeEkleri: 0, iseGiris: giris, cikis: cikis }).kidem.net;
  }
  var tavan = CK.hesapla({ fesihTuru: "isveren", ciplakBrut: 50000, giydirmeEkleri: 0,
    iseGiris: giris, cikis: cikis }).kidem.tavan;

  var x0 = 40000, x1 = 160000, N = 40;
  var noktalar = [];
  for (var i = 0; i <= N; i++) {
    var g = x0 + (x1 - x0) * i / N;
    noktalar.push([g, kidem(g)]);
  }
  var enCok = noktalar[N][1];
  var W = 600, H = 360, P = 30, TA = 44;
  var px = function (g) { return P + 4 + (g - x0) / (x1 - x0) * (W - 2 * P - 8); };
  var py = function (v) { return H - TA - v / enCok * (H - P - TA - 26); };

  var d = noktalar.map(function (n, i) {
    return (i ? "L" : "M") + px(n[0]).toFixed(1) + " " + py(n[1]).toFixed(1);
  }).join(" ");

  var izgara = [0, 0.5, 1].map(function (t) {
    var yy = P + t * (H - P - TA - 26);
    return '<line x1="' + P + '" y1="' + yy + '" x2="' + (W - P) + '" y2="' + yy +
      '" stroke="' + R.izgara + '" stroke-width="1"/>';
  }).join("");

  var kx = px(tavan), ky = py(kidem(tavan));
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Kidem tazminatinin giydirilmis ucrete gore seyri ve tavan kirilmasi">' +
    izgara +
    '<line x1="' + kx.toFixed(1) + '" y1="' + (P - 4) + '" x2="' + kx.toFixed(1) + '" y2="' +
    (H - TA) + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="5 4"/>' +
    '<path d="' + d + '" fill="none" stroke="' + R.marka +
    '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + kx.toFixed(1) + '" cy="' + ky.toFixed(1) + '" r="7" fill="' + R.s2 +
    '" stroke="' + R.zemin + '" stroke-width="2.5"/>' +
    /* Etiketler dirseğin ALTINA: üstte seri başlığı ve düz çizgi var,
       oraya yazınca üst üste biniyorlardı. */
    '<text x="' + (kx + 14) + '" y="' + (ky + 30) + '" font-size="16" font-weight="700" fill="' +
    R.s2 + '">Tavan ' + nf0.format(tavan) + " TL</text>" +
    '<text x="' + (kx + 14) + '" y="' + (ky + 50) + '" font-size="14" fill="' + R.ikincil +
    '">bu noktadan sonra düz</text>' +
    '<text x="' + P + '" y="' + (P + 6) + '" font-size="15" fill="' + R.ikincil +
    '">10 yıllık kıdem tazminatı (net)</text>' +
    '<text x="' + P + '" y="' + (H - 10) + '" font-size="14" fill="' + R.ikincil +
    '">40 bin</text>' +
    '<text x="' + (W - P) + '" y="' + (H - 10) + '" font-size="14" text-anchor="end" fill="' +
    R.ikincil + '">giydirilmiş brüt · 160 bin</text>' +
    "</svg>";
}

/* İki seri: aynı ocak netinden başlayan net ve brüt anlaşmanın 12 aylık seyri.
   İki seri olduğu için kategorik palet ve lejant zorunlu; marka yeşili
   kategorik seri olarak kullanılamıyor (kroma tabanının altında). */
function cizgiNetBrutAnlasma() {
  var HEDEF = 60000;
  var brutOcak = B.nettenBrute(HEDEF, 2026, 0);
  var sabit = B.hesaplaYil(brutOcak, 2026).aylar.map(function (a) { return a.net; });
  var net = [];
  for (var i = 0; i < 12; i++) net.push(HEDEF);

  var hepsi = sabit.concat(net);
  var enAz = Math.min.apply(null, hepsi), tepe = Math.max.apply(null, hepsi);
  // Ust seri tam tavana oturuyordu; cizgi ust kenara yapisik duruyordu.
  var enCok = tepe + (tepe - enAz) * 0.14;
  var W = 600, H = 360, P = 30, UST = 84, ALT = 34;
  var x = function (i) { return P + i * (W - 2 * P) / 11; };
  var y = function (v) { return H - ALT - (v - enAz) / (enCok - enAz) * (H - UST - ALT); };
  function yol(dizi) {
    return dizi.map(function (v, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    }).join(" ");
  }
  var izgara = [0, 0.5, 1].map(function (t) {
    var yy = UST + t * (H - UST - ALT);
    return '<line x1="' + P + '" y1="' + yy + '" x2="' + (W - P) + '" y2="' + yy +
      '" stroke="' + R.izgara + '" stroke-width="1"/>';
  }).join("");

  function lejant(cx, renk, metin) {
    return '<rect x="' + cx + '" y="52" width="13" height="13" rx="3" fill="' + renk + '"/>' +
      '<text x="' + (cx + 19) + '" y="63" font-size="15" fill="' + R.murekkep + '">' +
      esc(metin) + "</text>";
  }

  var fark = HEDEF - sabit[11];
  var yillik = 0;
  for (var j = 0; j < 12; j++) yillik += HEDEF - sabit[j];
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Net anlasma ile brut anlasmanin 12 aylik net maas seyri">' +
    '<text x="' + P + '" y="30" font-size="15" fill="' + R.ikincil +
    '">Aylık net maaş · 2026 · ikisi de ocakta 60.000 TL</text>' +
    lejant(P, R.s1, "Net anlaşma") + lejant(P + 175, R.s2, "Brüt anlaşma") +
    izgara +
    '<path d="' + yol(net) + '" fill="none" stroke="' + R.s1 + '" stroke-width="3"/>' +
    '<path d="' + yol(sabit) + '" fill="none" stroke="' + R.s2 +
    '" stroke-width="3" stroke-linejoin="round"/>' +
    '<line x1="' + x(11).toFixed(1) + '" y1="' + y(HEDEF).toFixed(1) + '" x2="' +
    x(11).toFixed(1) + '" y2="' + y(sabit[11]).toFixed(1) + '" stroke="' + R.murekkep +
    '" stroke-width="1.5" stroke-dasharray="4 3"/>' +
    /* Iki rakam birlikte: yalnizca aralik farki yazilinca kapaktaki
       "yilda 50 bin lira" ifadesiyle celisiyor gibi okunuyordu. */
    '<text x="' + (x(11) - 12) + '" y="' + ((y(HEDEF) + y(sabit[11])) / 2 - 2) +
    '" text-anchor="end" font-size="15" font-weight="700" fill="' + R.s2 + '">Aralık: ' +
    nf0.format(fark) + " TL</text>" +
    '<text x="' + (x(11) - 12) + '" y="' + ((y(HEDEF) + y(sabit[11])) / 2 + 18) +
    '" text-anchor="end" font-size="17" font-weight="800" fill="' + R.s2 + '">yılda ' +
    nf0.format(yillik) + " TL</text>" +
    '<text x="' + P + '" y="' + (H - 8) + '" font-size="14" fill="' + R.ikincil + '">Ocak</text>' +
    '<text x="' + (W - P) + '" y="' + (H - 8) + '" font-size="14" text-anchor="end" fill="' +
    R.ikincil + '">Aralık</text>' +
    "</svg>";
}

/* İşsizlik ödeneği: iki tutar ve referans olarak net asgari ücret.
   Tek ölçü (aylık TL) olduğu için tek hue; asgari ücret bir SERİ değil,
   kıyas çizgisi — kesikli çizgiyle veriliyor. */
function sutunIssizlikTavani() {
  var P26 = B.parametre(2026), d = B.donem(P26, 9), I = P26.issizlik;
  var damga = P26.oranlar.damga;
  var tabanBrut = d.asgariBrut * I.oran;
  var tavanBrut = d.asgariBrut * I.tavanOrani;
  var taban = tabanBrut * (1 - damga);
  var tavan = tavanBrut * (1 - damga);
  var netAsgari = B.hesaplaYil(d.asgariBrut, 2026).aylar[0].net;

  var W = 600, H = 360, P = 28, SOL = 150;
  var enCok = netAsgari * 1.12;
  var gen = function (v) { return v / enCok * (W - P - SOL - 96); };
  var satirlar = [
    { ad: "Asgari ücretli", alt: "ödeneğin tabanı", v: taban },
    { ad: "66.060 TL ve üstü", alt: "ödeneğin tavanı", v: tavan }
  ];
  var ic = satirlar.map(function (s, i) {
    var yb = 132 + i * 96;
    return '<text x="' + P + '" y="' + (yb - 24) + '" font-size="18" font-weight="700" fill="' +
      R.murekkep + '">' + esc(s.ad) + "</text>" +
      '<text x="' + P + '" y="' + (yb - 5) + '" font-size="13" fill="' + R.ikincil + '">' +
      esc(s.alt) + "</text>" +
      '<rect x="' + P + '" y="' + yb + '" width="' + gen(s.v).toFixed(1) +
      '" height="26" rx="4" fill="' + R.marka + '"/>' +
      '<text x="' + (P + gen(s.v) + 12) + '" y="' + (yb + 19) +
      '" font-size="18" font-weight="800" fill="' + R.murekkep + '">' +
      nf0.format(s.v) + " TL</text>";
  }).join("");

  var rx = P + gen(netAsgari);
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Issizlik odeneginin taban ve tavani net asgari ucretle karsilastirmali">' +
    '<text x="' + P + '" y="' + (P + 4) + '" font-size="15" fill="' + R.ikincil +
    '">Aylık işsizlik ödeneği (net) · 2026</text>' +
    '<line x1="' + rx.toFixed(1) + '" y1="64" x2="' + rx.toFixed(1) + '" y2="' + (H - 54) +
    '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="5 4"/>' +
    '<text x="' + (rx - 8) + '" y="76" text-anchor="end" font-size="15" font-weight="700" fill="' +
    R.s2 + '">net asgari ücret ' + nf0.format(netAsgari) + " TL</text>" +
    ic +
    '<text x="' + P + '" y="' + (H - 22) + '" font-size="15" fill="' + R.ikincil +
    '">Tavan bile net asgari ücretin ' + nf0.format(netAsgari - tavan) + " TL altında.</text>" +
    "</svg>";
}

/* MTV iki tarife farki — "mtv-2026-ne-kadar" kapagi.
   Yazinin argumani tek bir cumle: iki tarife 1600 cm3'e kadar AYNI, 1601'den
   itibaren (I) tam %10 yukarida. Bunu gostermenin en durust yolu tutarlari
   yan yana koymak degil -- 5.750 ile 251.554 arasinda 44 kat var, yan yana
   cizimde kucuk satirlar goze gorunmez olurdu. Bu yuzden cizilen sey FARKIN
   KENDISI: ilk iki satirda sifir, sonra sabit oranla buyuyen bir seri.
   Sifir cubuklar da bilgi tasiyor -- tarifelerin ortustugu yeri gosteriyor.
   Tek seri oldugu icin marka yesili kullanilabilir. */
function farkMtv() {
  var W = 600, H = 360, P = 28, SOL = 138;
  var satirlar = MTV.HACIM_ETIKET.map(function (e, i) {
    return {
      ad: e,
      fark: MTV.TARIFE_I[i].satir[0][0] - MTV.TARIFE_IA[i][0]
    };
  });
  var enCok = Math.max.apply(null, satirlar.map(function (s) { return s.fark; }));
  var alan = W - SOL - P - 86;
  var gen = function (v) { return v <= 0 ? 0 : Math.max(2, v / enCok * alan); };

  var y0 = 84, adim = 27;
  var ic = satirlar.map(function (s, i) {
    var y = y0 + i * adim;
    var sifir = s.fark === 0;
    var etiket = sifir ? "fark yok" : "+" + nf0.format(s.fark) + " TL";
    return '<text x="' + (SOL - 10) + '" y="' + (y + 12) +
      '" text-anchor="end" font-size="13" fill="' +
      (sifir ? R.ikincil : R.murekkep) + '">' + esc(s.ad) + "</text>" +
      (sifir
        ? '<line x1="' + SOL + '" y1="' + (y + 8) + '" x2="' + (SOL + 16) + '" y2="' + (y + 8) +
          '" stroke="' + R.ikincil + '" stroke-width="2"/>'
        : '<rect x="' + SOL + '" y="' + y + '" width="' + gen(s.fark).toFixed(1) +
          '" height="16" rx="3" fill="' + R.marka + '"/>') +
      '<text x="' + (SOL + (sifir ? 26 : gen(s.fark) + 10)) + '" y="' + (y + 13) +
      '" font-size="13" font-weight="' + (sifir ? "400" : "700") + '" fill="' +
      (sifir ? R.ikincil : R.murekkep) + '">' + esc(etiket) + "</text>";
  }).join("");

  /* Ayrisma cizgisi: ilk iki satirin altina, tam olarak tarifelerin
     ayrildigi yere. */
  var ay = y0 + 2 * adim - 6;
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Motor hacmine gore iki MTV tarifesi arasindaki fark; 1600 santimetrekupe kadar fark yok, sonra yuzde on">' +
    '<text x="' + P + '" y="' + (P + 2) + '" font-size="15" fill="' + R.ikincil +
    '">2018 sonrası tescil, aynı araç için ne kadar fazla? · 2026, 1–3 yaş</text>' +
    '<line x1="' + P + '" y1="' + ay + '" x2="' + (W - P) + '" y2="' + ay +
    '" stroke="' + R.s2 + '" stroke-width="1.5" stroke-dasharray="4 4"/>' +
    '<text x="' + (W - P) + '" y="' + (ay - 7) + '" text-anchor="end" font-size="12" fill="' +
    R.s2 + '">buradan sonra her satırda tam %10</text>' +
    ic +
    '<text x="' + P + '" y="' + (H - 18) + '" font-size="14" fill="' + R.ikincil +
    '">1600 cm³ ve altında iki tarife birebir aynıdır.</text>' +
    "</svg>";
}

/* Dilim kaymasi — "vergi-dilimleri-asgari-ucrete-yetisemiyor" kapagi.
   Yazinin argumani bir EGILIM: ilk iki vergi diliminin bittigi nokta, yillik
   asgari ucretin kati olarak yedi yilda asagi iniyor. Liraya gore cizmek bu
   egilimi tamamen gizlerdi -- lira tutarlari yukari gidiyor. Olcu birimi
   asgari ucret oldugu icin okur "dilim buyudu ama yetismedi"yi gorebiliyor.
   Iki kategorik seri oldugu icin marka yesili KULLANILMIYOR. */
function dilimKaymasi() {
  var W = 600, H = 360, P = 34, SOL = 52, ALT = 54;
  var yillar = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  var seriler = [
    { ad: "1. dilimin sonu", renk: R.s1, i: 0 },
    { ad: "2. dilimin sonu", renk: R.s2, i: 1 }
  ];
  var veri = yillar.map(function (y) {
    var Pr = B.parametre(y), d = B.donem(Pr, 1), ya = d.asgariBrut * 12;
    return { yil: y, k: [Pr.dilimler[0][0] / ya, Pr.dilimler[1][0] / ya] };
  });

  var enCok = 1.5, enAz = 0.4;
  var x = function (i) { return SOL + i * (W - SOL - P) / (yillar.length - 1); };
  var yy = function (v) {
    return (H - ALT) - (v - enAz) / (enCok - enAz) * (H - ALT - 74);
  };

  var izgara = [0.5, 1.0, 1.5].map(function (v) {
    return '<line x1="' + SOL + '" y1="' + yy(v).toFixed(1) + '" x2="' + (W - P) +
      '" y2="' + yy(v).toFixed(1) + '" stroke="' + R.izgara + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (yy(v) + 4).toFixed(1) +
      '" text-anchor="end" font-size="12" fill="' + R.ikincil + '">' +
      v.toFixed(1).replace(".", ",") + "</text>";
  }).join("");

  var cizgiler = seriler.map(function (s) {
    var d = veri.map(function (v, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v.k[s.i]).toFixed(1);
    }).join(" ");
    var noktalar = veri.map(function (v, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + yy(v.k[s.i]).toFixed(1) +
        '" r="4" fill="' + s.renk + '" stroke="' + R.zemin + '" stroke-width="2"/>';
    }).join("");
    var son = veri[veri.length - 1].k[s.i];
    return '<path d="' + d + '" fill="none" stroke="' + s.renk + '" stroke-width="2"/>' +
      noktalar +
      '<text x="' + (x(veri.length - 1) - 6) + '" y="' + (yy(son) - 12).toFixed(1) +
      '" text-anchor="end" font-size="14" font-weight="700" fill="' + s.renk + '">' +
      son.toFixed(2).replace(".", ",") + "</text>";
  }).join("");

  var eksen = yillar.map(function (y, i) {
    return '<text x="' + x(i).toFixed(1) + '" y="' + (H - ALT + 20) +
      '" text-anchor="middle" font-size="12" fill="' + R.ikincil + '">' + y + '</text>';
  }).join("");

  var gosterge = seriler.map(function (s, i) {
    return '<g transform="translate(' + (SOL + i * 168) + ',' + (H - 16) + ')">' +
      '<circle cx="5" cy="-4" r="4" fill="' + s.renk + '"/>' +
      '<text x="16" y="0" font-size="13" fill="' + R.ikincil + '">' + esc(s.ad) + "</text></g>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Ilk ve ikinci vergi diliminin bittigi nokta, yillik asgari ucretin kati olarak, 2020 den 2026 ya azaliyor">' +
    '<text x="' + P + '" y="' + (P - 6) + '" font-size="15" fill="' + R.ikincil +
    '">Dilimin bittiği nokta, yıllık asgari ücretin katı olarak</text>' +
    izgara + cizgiler + eksen + gosterge + "</svg>";
}

/* Serbest meslek makbuzu — "serbest-meslek-makbuzu-stopaj-kdv" kapagi.
   Yazinin cekirdegi bir YANILSAMA: 100.000 TL brut makbuzda hesaba gecen
   para da 100.000 TL, cunku iki oran esit. Kapak bunu tek bir cubuk
   dizisiyle anlatiyor: fatura toplami, kesilen stopaj, hesaba gecen ve
   asil kalan. Sayilar yazininkiyle ayni sabitlerden hesaplaniyor. */
function makbuzAkisi() {
  var W = 600, H = 360, P = 34, SOL = 190;
  var brut = 100000, s = 0.20, k = 0.20;
  var kdv = brut * k, stopaj = brut * s;
  var satirlar = [
    { ad: "Fatura toplamı",     alt: "brüt + KDV",              v: brut + kdv, renk: R.s1 },
    { ad: "Hesabınıza geçen",   alt: "stopaj kesildikten sonra", v: brut - stopaj + kdv, renk: R.s1 },
    { ad: "Size kalan",         alt: "KDV devletin",            v: brut - stopaj, renk: R.marka }
  ];
  var enCok = brut + kdv;
  var alan = W - SOL - P - 92;
  var gen = function (v) { return v / enCok * alan; };

  var y0 = 96, adim = 74;
  var ic = satirlar.map(function (r, i) {
    var y = y0 + i * adim;
    return '<text x="' + (SOL - 12) + '" y="' + (y + 14) + '" text-anchor="end" ' +
      'font-size="15" font-weight="700" fill="' + R.murekkep + '">' + esc(r.ad) + "</text>" +
      '<text x="' + (SOL - 12) + '" y="' + (y + 32) + '" text-anchor="end" ' +
      'font-size="12" fill="' + R.ikincil + '">' + esc(r.alt) + "</text>" +
      '<rect x="' + SOL + '" y="' + y + '" width="' + gen(r.v).toFixed(1) +
      '" height="30" rx="4" fill="' + r.renk + '"/>' +
      '<text x="' + (SOL + gen(r.v) + 12) + '" y="' + (y + 21) +
      '" font-size="17" font-weight="800" fill="' + R.murekkep + '">' +
      nf0.format(r.v) + "</text>";
  }).join("");

  /* Ilk iki cubugun ucu ayni hizada DEGIL ama degerleri farkli; asil
     carpici olan ilk ve ikinci satirin ARASINDAKI 20.000'lik stopaj.
     Onu cubuklarin arasina yaziyoruz. */
  var ax = SOL + gen(brut - stopaj + kdv);
  var bx = SOL + gen(brut + kdv);
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="100 bin lira brut makbuzda fatura toplami, hesaba gecen tutar ve gercekte kalan">' +
    '<text x="' + P + '" y="' + (P + 4) + '" font-size="15" fill="' + R.ikincil +
    '">100.000 TL brüt serbest meslek makbuzu · 2026</text>' +
    '<line x1="' + ax.toFixed(1) + '" y1="' + (y0 + 34) + '" x2="' + bx.toFixed(1) +
    '" y2="' + (y0 + 34) + '" stroke="' + R.s2 + '" stroke-width="2"/>' +
    '<text x="' + ((ax + bx) / 2) + '" y="' + (y0 + 52) + '" text-anchor="middle" ' +
    'font-size="12" font-weight="700" fill="' + R.s2 + '">stopaj ' + nf0.format(stopaj) + "</text>" +
    ic +
    '<text x="' + P + '" y="' + (H - 20) + '" font-size="14" fill="' + R.ikincil +
    '">Hesaba geçen tutar brüt ücrete eşit; arada iki ayrı ' + nf0.format(kdv) + ' TL var.</text>' +
    "</svg>";
}

/* Tasarruf-finansman — "tasarruf-kimde-finansman-kimde" kapagi.
   Tez: AYNI kredi stoku, iki olcuyle iki ayri yone gidiyor. Bu yuzden
   sifir cizgisinden iki yana acilan cubuklar kullanildi; nominal yukari,
   reel asagi.

   Yan yana iki cubuk olsaydi ikisi de pozitif eksende durur ve "iki ayri
   yon" iddiasi gorunmezdi. Isaretin kendisi burada bilginin ta kendisi.

   Iki cubuk ayri KATEGORI oldugu icin iki kategorik renk kullaniliyor;
   kazanc/kayip renkleri degil, cunku bunlar bir sonucun iki olcumu. */
function tasarrufNominalReel() {
  var W = 600, H = 360, SOL = 96, SAG = 40, UST = 78, ALT = 60;
  var H2 = require(path.join(KOK, "makaleler", "tasarruf-kimde-finansman-kimde",
    "harita.js"));

  var seri = [
    { ad: "KOBİ kredisi", nominal: H2.nominalBuyume(2024, "kobi"),
      reel: H2.reelBuyume(2024, "kobi") },
    { ad: "Toplam işletme", nominal: H2.nominalBuyume(2024, "toplam"),
      reel: H2.reelBuyume(2024, "toplam") }
  ];

  var enCok = 0;
  seri.forEach(function (o) {
    enCok = Math.max(enCok, Math.abs(o.nominal), Math.abs(o.reel));
  });
  var yMax = Math.ceil(enCok * 100 / 10) * 10 / 100;

  var sifir = (UST + (H - ALT)) / 2;
  var yarim = (H - ALT - UST) / 2;
  var yy = function (v) { return sifir - (v / yMax) * yarim; };

  var izgara = "", eksen = "";
  for (var t = -yMax; t <= yMax + 1e-9; t += yMax / 2) {
    var y = yy(t);
    izgara += '<line x1="' + SOL + '" y1="' + y.toFixed(1) + '" x2="' + (W - SAG) +
      '" y2="' + y.toFixed(1) + '" stroke="' +
      (Math.abs(t) < 1e-9 ? R.ikincil : R.izgara) + '" stroke-width="1"/>';
    eksen += '<text x="' + (SOL - 10) + '" y="' + (y + 4).toFixed(1) +
      '" font-size="11" fill="' + R.ikincil + '" text-anchor="end">' +
      (t > 0 ? "+" : "") + Math.round(t * 100) + '%</text>';
  }

  var grupGen = (W - SOL - SAG) / seri.length;
  var cubukGen = Math.min(58, grupGen * 0.3);
  var cubuk = seri.map(function (o, i) {
    var merkez = SOL + grupGen * (i + 0.5);
    function ciz(v, dx, renk, etiket) {
      var x0 = merkez + dx - cubukGen / 2;
      var ust = v >= 0 ? yy(v) : sifir;
      var yuk = Math.abs(yy(v) - sifir);
      var ty = v >= 0 ? yy(v) - 8 : yy(v) + 16;
      return '<rect x="' + x0.toFixed(1) + '" y="' + ust.toFixed(1) +
        '" width="' + cubukGen.toFixed(1) + '" height="' + Math.max(2, yuk).toFixed(1) +
        '" rx="3" fill="' + renk + '"/>' +
        '<text x="' + (x0 + cubukGen / 2).toFixed(1) + '" y="' + ty.toFixed(1) +
        '" font-size="12" fill="' + R.murekkep + '" text-anchor="middle">' +
        (v >= 0 ? "+" : "−") + '%' +
        Math.abs(v * 100).toFixed(2).replace(".", ",") + '</text>';
    }
    return ciz(o.nominal, -cubukGen * 0.58, R.s1) +
      ciz(o.reel, cubukGen * 0.58, R.s2) +
      '<text x="' + merkez.toFixed(1) + '" y="' + (H - ALT + 22) +
      '" font-size="12" fill="' + R.murekkep + '" text-anchor="middle">' +
      esc(o.ad) + '</text>';
  }).join("");

  /* Gosterge, alt basligin ALTINA konuyor. UST-34'te iken alt basligin
     temel cizgisiyle cakisiyordu; iki metin ust uste biniyordu. */
  var gy = UST - 14;
  var gosterge =
    '<rect x="' + SOL + '" y="' + (gy - 9) + '" width="11" height="11" rx="2" fill="' +
    R.s1 + '"/><text x="' + (SOL + 17) + '" y="' + gy +
    '" font-size="12" fill="' + R.ikincil + '">nominal</text>' +
    '<rect x="' + (SOL + 88) + '" y="' + (gy - 9) + '" width="11" height="11" rx="2" fill="' +
    R.s2 + '"/><text x="' + (SOL + 105) + '" y="' + gy +
    '" font-size="12" fill="' + R.ikincil + '">reel (TÜFE ile)</text>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="2024 KOBI ve toplam isletme kredisinin nominal ve ' +
    'reel degisimi">' +
    izgara + cubuk + eksen + gosterge +
    '<text x="' + SOL + '" y="30" font-size="15" fill="' + R.murekkep + '">' +
    'Aynı kredi stoku, iki ölçü (2024)</text>' +
    '<text x="' + SOL + '" y="50" font-size="13" fill="' + R.ikincil + '">' +
    'Nominal büyüyor, enflasyondan arındırılınca küçülüyor</text>' +
    '</svg>';
}

/* Kredi tavani — "kredi-tavani-ve-banka-karliligi" kapagi.
   Tez tek bir karsilastirmada: her tavan, gerceklesen buyumenin ALTINDA.
   Bu yuzden yatay cubuklar (tavanlar) ve onlari kesen tek bir dikey
   referans cizgisi (gerceklesme) kullanildi.

   Cizgi grafigi olmazdi: burada bir zaman serisi yok, bes ayri esigin
   ayni olcekte siralanmasi var. Cubuklar siralamayi, referans cizgisi de
   "hicbiri yetismiyor" iddiasini tek bakista veriyor.

   Tek seri oldugu icin marka disi tek renk; gerceklesme cizgisi ikinci
   kategorik renkle ayriliyor cunku o bir TAVAN degil, GOZLEM. */
function krediTavaniTakoz() {
  var W = 600, H = 360, SOL = 150, SAG = 34, UST = 74, ALT = 56;
  var B = require(path.join(KOK, "makaleler", "kredi-tavani-ve-banka-karliligi",
    "banka.js"));
  var t = B.takoz();

  var satir = B.SINIRLAR.map(function (x) {
    return { ad: x.tur, oran: B.yillikTavan(x.sonra) };
  }).sort(function (a, b) { return a.oran - b.oran; });

  var xMax = Math.ceil(Math.max(t.gerceklesen, satir[satir.length - 1].oran)
    * 100 / 5 + 1) * 5 / 100;
  var x = function (o) { return SOL + (o / xMax) * (W - SOL - SAG); };

  var n = satir.length;
  var bandH = (H - UST - ALT) / n;
  var cubukH = Math.min(26, bandH * 0.56);

  var izgara = "", eksen = "";
  for (var v = 0; v <= xMax + 1e-9; v += 0.10) {
    var xx = x(v);
    izgara += '<line x1="' + xx.toFixed(1) + '" y1="' + UST + '" x2="' + xx.toFixed(1) +
      '" y2="' + (H - ALT) + '" stroke="' + R.izgara + '" stroke-width="1"/>';
    eksen += '<text x="' + xx.toFixed(1) + '" y="' + (H - ALT + 20) +
      '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">%' +
      Math.round(v * 100) + '</text>';
  }

  var cubuk = satir.map(function (o, i) {
    var yy = UST + i * bandH + (bandH - cubukH) / 2;
    var gen = Math.max(2, x(o.oran) - x(0));
    return '<rect x="' + x(0).toFixed(1) + '" y="' + yy.toFixed(1) +
      '" width="' + gen.toFixed(1) + '" height="' + cubukH.toFixed(1) +
      '" rx="4" fill="' + R.s2 + '"/>' +
      '<text x="' + (SOL - 10) + '" y="' + (yy + cubukH / 2 + 5).toFixed(1) +
      '" font-size="12" fill="' + R.murekkep + '" text-anchor="end">' +
      esc(o.ad) + '</text>' +
      degerEtiketi(o.oran, yy + cubukH / 2 + 5);
  }).join("");

  /* Deger etiketi, gerceklesme cizgisine YAKINSA cubugun ICINE aliniyor.
     Disarida birakilinca en uzun cubugun etiketi kesikli cizgiye degiyor
     ve iki sayi birbirine karisiyor. */
  function degerEtiketi(oran, ty) {
    var bitis = x(oran), cizgi = x(t.gerceklesen);
    var metin = "%" + (oran * 100).toFixed(1).replace(".", ",");
    var icerde = (cizgi - bitis) < 44;
    return '<text x="' + (icerde ? bitis - 8 : bitis + 8).toFixed(1) +
      '" y="' + ty.toFixed(1) + '" font-size="12" fill="' +
      (icerde ? R.zemin : R.murekkep) + '" text-anchor="' +
      (icerde ? "end" : "start") + '">' + metin + '</text>';
  }

  /* Gerceklesme: butun cubuklarin sagindan gecen dikey cizgi. */
  var gx = x(t.gerceklesen);
  var gercek = '<line x1="' + gx.toFixed(1) + '" y1="' + (UST - 12) +
    '" x2="' + gx.toFixed(1) + '" y2="' + (H - ALT) +
    '" stroke="' + R.s1 + '" stroke-width="2.5" stroke-dasharray="5 3"/>' +
    '<text x="' + gx.toFixed(1) + '" y="' + (UST - 18) +
    '" font-size="12" fill="' + R.s1 + '" text-anchor="middle">gerçekleşen %' +
    (t.gerceklesen * 100).toFixed(1).replace(".", ",") + '</text>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Kredi buyume tavanlarinin yillik karsiliklari ve ' +
    'gerceklesen kredi buyumesi">' +
    izgara + cubuk + gercek + eksen +
    '<text x="' + SOL + '" y="30" font-size="15" fill="' + R.murekkep + '">' +
    'Tavanlar ve gerçekleşme, yıllık</text>' +
    '<text x="' + SOL + '" y="50" font-size="13" fill="' + R.ikincil + '">' +
    'En gevşek tavan bile gerçekleşmenin altında kalıyor</text>' +
    '</svg>';
}

/* Prim tavani — "sgk-prim-tavani-9-kat" kapagi.
   Yazinin tezi tek bir SEKIL: yuk dar bir bantta toplaniyor ve en tepede
   GERI CEKILIYOR. Cizgi grafigi secildi cunku anlatilan sey bir siralama
   degil, bir egrinin bicimi -- nerede basladigi, nerede doydugu, nerede
   dustugu.

   Cubuk kullanilsaydi ucuncu kirilim (479.270 TL'deki dusus) birkac
   cubugun yukseklik farkina indirgenirdi ve egrinin "plato sonra dusus"
   bicimi kaybolurdu.

   Tek seri oldugu icin marka disi tek renk yetiyor; iki dikey referans
   cizgisi esikleri isaretliyor. */
function sgkTavanEtkisi() {
  var W = 600, H = 360, SOL = 74, SAG = 28, UST = 76, ALT = 58;
  var T = require(path.join(KOK, "makaleler", "sgk-prim-tavani-9-kat",
    "tavan.js"));
  var yil = B.sonYil();
  var e = T.esikler(yil);

  /* Ornekleme araligi: esigin biraz altindan, doyumun besbucuk katina.
     Elle secilmis sinirlar degil -- esiklerden tureniyor. */
  var x0 = e.baslar * 0.82, x1 = e.doyar * 2.6, adim = (x1 - x0) / 120;
  var nokta = [];
  for (var v = x0; v <= x1 + 1e-6; v += adim) {
    nokta.push({ brut: v, kayip: T.etki(Math.round(v), yil).netKayip });
  }
  var enCok = nokta.reduce(function (m, p) { return Math.max(m, p.kayip); }, 0);
  var yMax = Math.ceil(enCok / 10000) * 10000;

  var px = function (v) { return SOL + (v - x0) / (x1 - x0) * (W - SOL - SAG); };
  var py = function (v) { return H - ALT - (v / yMax) * (H - UST - ALT); };

  var izgara = "", eksenY = "";
  for (var t = 0; t <= yMax + 1e-9; t += yMax / 4) {
    var yy = py(t);
    izgara += '<line x1="' + SOL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - SAG) +
      '" y2="' + yy.toFixed(1) + '" stroke="' + R.izgara + '" stroke-width="1"/>';
    eksenY += '<text x="' + (SOL - 9) + '" y="' + (yy + 4).toFixed(1) +
      '" font-size="11" fill="' + R.ikincil + '" text-anchor="end">' +
      (t === 0 ? "0" : nf0.format(Math.round(t / 1000)) + "b") + '</text>';
  }

  /* Esik cizgileri: etkinin basladigi ve doydugu yerler. */
  function esik(v, etiket, kaydir) {
    var xx = px(v);
    return '<line x1="' + xx.toFixed(1) + '" y1="' + UST + '" x2="' + xx.toFixed(1) +
      '" y2="' + (H - ALT) + '" stroke="' + R.ikincil +
      '" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>' +
      '<text x="' + (xx + kaydir).toFixed(1) + '" y="' + (UST - 8) +
      '" font-size="11" fill="' + R.ikincil + '" text-anchor="middle">' +
      etiket + '</text>';
  }

  var d = nokta.map(function (p, i) {
    return (i ? "L" : "M") + px(p.brut).toFixed(1) + " " + py(p.kayip).toFixed(1);
  }).join(" ");

  var eksenX = "";
  [e.baslar, e.doyar, e.doyar * 2].forEach(function (v) {
    eksenX += '<text x="' + px(v).toFixed(1) + '" y="' + (H - ALT + 20) +
      '" font-size="11" fill="' + R.ikincil + '" text-anchor="middle">' +
      nf0.format(Math.round(v / 1000)) + 'b</text>';
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Prim tavanının yükselmesinin aylık brüt ücrete ' +
    'göre yıllık net etkisi">' +
    izgara +
    esik(e.baslar, "eski tavan", -2) + esik(e.doyar, "yeni tavan", 26) +
    '<path d="' + d + '" fill="none" stroke="' + R.s2 +
    '" stroke-width="2.5" stroke-linejoin="round"/>' +
    eksenY + eksenX +
    '<text x="' + SOL + '" y="30" font-size="15" fill="' + R.murekkep + '">' +
    'Tavan yükselmesinin yıllık net maliyeti</text>' +
    '<text x="' + SOL + '" y="50" font-size="13" fill="' + R.ikincil + '">' +
    'Dar bir bantta yükseliyor, doyuyor — ve en üst gelirlerde geri çekiliyor</text>' +
    '<text x="' + (W - SAG) + '" y="' + (H - 12) + '" font-size="11" fill="' +
    R.ikincil + '" text-anchor="end">aylık brüt ücret (TL)</text>' +
    '</svg>';
}

/* Yeniden degerleme — "yeniden-degerleme-orani-nedir" kapagi.
   Anlatilan sey tek bir yilin yuvarlamasi degil, BES YILDA BIRIKEN fark.
   O yuzden cizim yillik kesirleri degil, 2026 dilimlerinin tam
   endekslemeye gore ne kadar geride kaldigini gosteriyor.

   Iki cubuk yerine TEK cubuk ve referans cizgisi kullanildi: "gercek" ile
   "olurdu" yan yana konsaydi fark gozle okunamazdi (%6-13 araligi, mutlak
   degerler 190 bin ile 5,6 milyon arasinda). Yuzde olcegi dort dilimi
   karsilastirilabilir kiliyor.

   Tek seri oldugu icin marka disi tek renk yetiyor. */
function ydoBirikmisFark() {
  var W = 600, H = 360, SOL = 74, SAG = 96, UST = 72, ALT = 54;
  var Y = require(path.join(KOK, "makaleler", "yeniden-degerleme-orani-nedir",
    "ydo.js"));
  var son = B.sonYil();
  var liste = Y.birikmisFark(2021, son);

  var enCok = liste.reduce(function (e, x) { return Math.max(e, x.eksikOran); }, 0);
  var xMax = Math.ceil(enCok * 100 + 2) / 100;
  var x = function (o) { return SOL + (o / xMax) * (W - SOL - SAG); };

  var n = liste.length;
  var bandH = (H - UST - ALT) / n;
  var cubukH = Math.min(30, bandH * 0.56);

  var izgara = "", eksen = "";
  for (var t = 0; t <= xMax + 1e-9; t += 0.05) {
    var xx = x(t);
    izgara += '<line x1="' + xx.toFixed(1) + '" y1="' + UST + '" x2="' + xx.toFixed(1) +
      '" y2="' + (H - ALT) + '" stroke="' + R.izgara + '" stroke-width="1"/>';
    eksen += '<text x="' + xx.toFixed(1) + '" y="' + (H - ALT + 20) +
      '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">%' +
      Math.round(t * 100) + '</text>';
  }

  var cubuk = liste.map(function (o, i) {
    var yy = UST + i * bandH + (bandH - cubukH) / 2;
    var gen = Math.max(2, x(o.eksikOran) - x(0));
    return '<rect x="' + x(0).toFixed(1) + '" y="' + yy.toFixed(1) +
      '" width="' + gen.toFixed(1) + '" height="' + cubukH.toFixed(1) +
      '" rx="4" fill="' + R.s2 + '"/>' +
      '<text x="' + (SOL - 10) + '" y="' + (yy + cubukH / 2 + 5).toFixed(1) +
      '" font-size="14" fill="' + R.murekkep + '" text-anchor="end">' +
      o.sira + '. dilim</text>' +
      '<text x="' + (x(o.eksikOran) + 9).toFixed(1) + '" y="' +
      (yy + cubukH / 2 + 5).toFixed(1) +
      '" font-size="13" fill="' + R.murekkep + '">%' +
      (o.eksikOran * 100).toFixed(2).replace(".", ",") + '</text>';
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="' + son + ' gelir vergisi dilimlerinin tam ' +
    'endekslemeye gore ne kadar geride kaldigi">' +
    izgara + cubuk + eksen +
    '<text x="' + SOL + '" y="32" font-size="15" fill="' + R.murekkep + '">' +
    son + ' dilimleri tam endekslemenin ne kadar gerisinde?</text>' +
    '<text x="' + SOL + '" y="52" font-size="13" fill="' + R.ikincil + '">' +
    '2021’den beri her yıl kesir atıldı — fark bileşik olarak birikti</text>' +
    '</svg>';
}

/* Ikramiyenin zamanlamasi — "ikramiye-hangi-ay-odenmeli" kapagi.
   Anlatilan sey bir EGILIM degil, bir BASAMAK: odeme sayisi arttikca
   yillik net dusuyor ama bir yerde DURUYOR -- her taksit prim tavaninin
   altina indigi anda etki bitiyor. Duz bir azalan cizgi bu doyumu
   gizlerdi; cubuk ve uzerindeki fark etiketi gosteriyor.

   Referans cizgisi tek odemenin neti: dususlerin neye gore olculdugu
   belirsiz kalmasin. Tek seri oldugu icin marka disi tek renk yetiyor. */
function ikramiyeParcalari() {
  var W = 600, H = 360, SOL = 60, SAG = 26, UST = 74, ALT = 56;
  var I = require(path.join(KOK, "makaleler", "ikramiye-hangi-ay-odenmeli",
    "ikramiye.js"));
  var P = B.parametre(B.sonYil());
  var asgari = B.donem(P, 1).asgariBrut;
  var brut = asgari * 5, ik = asgari * 20;
  var liste = I.parcaKarsilastirmasi(brut, ik, B.sonYil(), [1, 2, 3, 4, 6, 12]);

  var netler = liste.map(function (x) { return x.net; });
  var enCok = Math.max.apply(null, netler);
  var enAz = Math.min.apply(null, netler);
  var alt = enAz - (enCok - enAz) * 0.55;   /* taban sifir degil: fark okunsun */

  var n = liste.length;
  var alan = W - SOL - SAG;
  var gen = alan / n * 0.58;
  var x = function (i) { return SOL + (i + 0.5) * alan / n; };
  var y = function (v) { return H - ALT - (v - alt) / (enCok - alt) * (H - UST - ALT); };

  var izgara = "";
  [0, 0.5, 1].forEach(function (t) {
    var yy = UST + t * (H - UST - ALT);
    izgara += '<line x1="' + SOL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - SAG) +
      '" y2="' + yy.toFixed(1) + '" stroke="' + R.izgara + '" stroke-width="1"/>';
  });

  /* Tek odemenin duzeyi: kesikli referans. */
  var ref = '<line x1="' + SOL + '" y1="' + y(netler[0]).toFixed(1) +
    '" x2="' + (W - SAG) + '" y2="' + y(netler[0]).toFixed(1) +
    '" stroke="' + R.murekkep + '" stroke-width="1.5" stroke-dasharray="4 4"/>';

  var cubuk = liste.map(function (o, i) {
    var yy = y(o.net), h = H - ALT - yy;
    var etiket = i === 0 ? "referans" : nf0.format(Math.round(o.netFark));
    return '<rect x="' + (x(i) - gen / 2).toFixed(1) + '" y="' + yy.toFixed(1) +
      '" width="' + gen.toFixed(1) + '" height="' + Math.max(2, h).toFixed(1) +
      '" rx="3" fill="' + R.s1 + '"/>' +
      '<text x="' + x(i).toFixed(1) + '" y="' + (yy - 8).toFixed(1) +
      '" font-size="12" fill="' + R.murekkep + '" text-anchor="middle">' + etiket + '</text>' +
      '<text x="' + x(i).toFixed(1) + '" y="' + (H - ALT + 19) +
      '" font-size="13" fill="' + R.ikincil + '" text-anchor="middle">' + o.parca + '</text>';
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Ayni ikramiye kac odemeye bolunurse yillik netin nasil dustugu">' +
    izgara + ref + cubuk +
    '<text x="' + SOL + '" y="30" font-size="15" fill="' + R.murekkep + '">' +
    'Aynı ikramiye, farklı sayıda ödemede</text>' +
    '<text x="' + SOL + '" y="50" font-size="13" fill="' + R.ikincil + '">' +
    'tek ödemeye göre yıllık net farkı (TL) — 6’dan sonra değişmiyor</text>' +
    '<text x="' + (W - SAG) + '" y="' + (H - ALT + 38) +
    '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">ödeme sayısı</text>' +
    '</svg>';
}

/* Asgari odeme — "kredi-karti-asgari-odeme" kapagi.
   Yazinin bulgusu bir YON: borc her ay eriyor, ve erime hizi asgari orana
   bagli. Tek bir egri cizmek "eriyor"u gosterirdi ama asil anlatilan sey
   IKI ORANIN ARASINDAKI FARK; o yuzden iki seri yan yana duruyor ve ikisi
   de ayni baslangic noktasindan cikiyor.

   Eksen 12 ay: borcun son kurusuna kadar kapanmasi yillar alabiliyor ama
   o kuyruk anlatiyi tasimiyor; ilk yil tasiyor. Sifira inisi abartmamak
   icin eksen tabanda kesilmiyor, gercek deger etiketleniyor.

   Iki kategorik seri oldugu icin marka yesili KULLANILMIYOR. */
function kartErimesi() {
  var W = 600, H = 360, SOL = 58, SAG = 92, UST = 62, ALT = 52;
  var K = require(path.join(KOK, "makaleler", "kredi-karti-asgari-odeme",
    "kart.js"));

  var AY = 12;
  var seriler = [
    { ad: "asgari %20", borc: 50000, limit: 50000, renk: R.s2 },
    { ad: "asgari %40", borc: 50000, limit: 150000, renk: R.s1 }
  ];

  seriler.forEach(function (o) {
    var r = K.simule(o.borc, o.limit, { enCokAy: AY, bitisEsigi: 0.005 });
    o.nokta = [o.borc].concat(r.seyir.map(function (a) { return a.kalan; }));
    o.son = o.nokta[o.nokta.length - 1];
  });

  var enCok = seriler[0].borc;
  var x = function (i) { return SOL + i * (W - SOL - SAG) / AY; };
  var y = function (v) { return H - ALT - (v / enCok) * (H - UST - ALT); };

  var izgara = "", etiket = "";
  [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
    var yy = y(enCok * t);
    izgara += '<line x1="' + SOL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - SAG) +
      '" y2="' + yy.toFixed(1) + '" stroke="' + R.izgara + '" stroke-width="1"/>';
    etiket += '<text x="' + (SOL - 8) + '" y="' + (yy + 4).toFixed(1) +
      '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">' +
      nf0.format(Math.round(enCok * t / 1000)) + 'B</text>';
  });

  var aylar = "";
  [0, 3, 6, 9, 12].forEach(function (i) {
    aylar += '<text x="' + x(i).toFixed(1) + '" y="' + (H - ALT + 20) +
      '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' +
      (i === 0 ? "başlangıç" : i + ". ay") + '</text>';
  });

  var egri = seriler.map(function (o) {
    var d = o.nokta.map(function (v, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    }).join(" ");
    return '<path d="' + d + '" fill="none" stroke="' + o.renk +
      '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + x(AY).toFixed(1) + '" cy="' + y(o.son).toFixed(1) +
      '" r="5" fill="' + o.renk + '" stroke="' + R.zemin + '" stroke-width="2"/>' +
      '<text x="' + (x(AY) + 10).toFixed(1) + '" y="' + (y(o.son) + 4).toFixed(1) +
      '" font-size="13" fill="' + R.murekkep + '">' + nf0.format(Math.round(o.son)) +
      ' TL</text>';
  }).join("");

  var lejant = seriler.map(function (o, i) {
    var lx = SOL + i * 150;
    return '<rect x="' + lx + '" y="42" width="11" height="11" rx="2" fill="' +
      o.renk + '"/>' +
      '<text x="' + (lx + 18) + '" y="52" font-size="13" fill="' + R.murekkep +
      '">' + o.ad + '</text>';
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="50.000 TL kart borcunun yalnizca asgari odenerek ' +
    'on iki ayda erimesi, yuzde 20 ve yuzde 40 asgari oranlari icin">' +
    izgara + etiket + aylar + egri + lejant +
    '<text x="' + SOL + '" y="26" font-size="15" fill="' + R.murekkep + '">' +
    '50.000 TL borç, yalnızca asgari ödenirse</text>' +
    '</svg>';
}

/* Beyan penceresi — "iki-isten-maas-beyanname-siniri" kapagi.
   Yazinin bulgusu bir EGILIM DEGIL, bir DARLIK: ikinci isin beyanname
   dogurmadan kalabildigi aralik her yil asgari ucretin hemen ustunde
   bitiyor. Lira ile cizmek bunu tamamen gizlerdi -- tutarlar bes yilda
   alti katina cikiyor ve erken yillar ezilirdi. Olcu birimi asgari ucret
   oldugu icin bes yil ayni eksende karsilastirilabiliyor ve okur
   "aralik dar" ifadesini olcerek gorebiliyor.

   Esigin OTESI de ciziliyor: yalnizca guvenli bandi gostermek, sinirin
   bir tarafi oldugunu unutturur. Otesi soluk bir alan olarak duruyor,
   veri degil zemin oldugu icin doygunlugu dusuk. */
function beyanPenceresi() {
  var W = 600, H = 360, SOL = 56, SAG = 30, UST = 64, ALT = 52;
  var Beyan = require(path.join(KOK, "makaleler",
    "iki-isten-maas-beyanname-siniri", "beyan.js"));

  var yillar = Beyan.kapsananYillar().slice().sort(function (a, b) { return a - b; });
  var veri = yillar.map(function (y) {
    var p = Beyan.pencere(y);
    return { yil: y, oran: p.oran, tavan: p.guvenli, asgari: p.alt };
  });

  var enCok = veri.reduce(function (e, v) { return Math.max(e, v.oran); }, 1);
  var xMax = Math.ceil((enCok + 0.08) * 10) / 10;
  var x = function (o) { return SOL + (o - 1) / (xMax - 1) * (W - SOL - SAG); };

  var n = veri.length;
  var bandH = (H - UST - ALT) / n;
  var cubukH = Math.min(26, bandH * 0.56);

  /* Esigin otesi SATIR SATIR ciziliyor. Ilk hali butun cizim alanini
     kapliyordu ve "sagindaki alan" neyin sagi belirsiz kaliyordu; beyan
     bolgesi her yil icin O YILIN esiginde basladigi icin bant bant
     dogru olan bu. */
  var otesi = "";

  /* Dikey izgara: 1,0 / 1,1 / 1,2 / 1,3 ... */
  var izgara = "", etiketler = "";
  for (var t = 1; t <= xMax + 1e-9; t += 0.1) {
    var xx = x(t);
    izgara += '<line x1="' + xx.toFixed(1) + '" y1="' + UST + '" x2="' + xx.toFixed(1) +
      '" y2="' + (H - ALT) + '" stroke="' + R.zemin + '" stroke-width="1"/>';
    etiketler += '<text x="' + xx.toFixed(1) + '" y="' + (H - ALT + 20) +
      '" font-size="13" fill="' + R.ikincil + '" text-anchor="middle">' +
      t.toFixed(1).replace(".", ",") + '×</text>';
  }

  var cubuklar = veri.map(function (v, i) {
    var yy = UST + i * bandH + (bandH - cubukH) / 2;
    var x0 = x(1), x1 = x(v.oran);
    /* Bu yilin beyan bolgesi: esikten sag kenara. Veri degil zemin. */
    otesi += '<rect x="' + x1.toFixed(1) + '" y="' + yy.toFixed(1) +
      '" width="' + Math.max(0, W - SAG - x1).toFixed(1) +
      '" height="' + cubukH.toFixed(1) + '" rx="4" fill="' + R.izgara + '"/>';
    return '<rect x="' + x0.toFixed(1) + '" y="' + yy.toFixed(1) +
      '" width="' + Math.max(2, x1 - x0).toFixed(1) + '" height="' + cubukH.toFixed(1) +
      '" rx="4" fill="' + R.s1 + '"/>' +
      '<text x="' + (SOL - 10) + '" y="' + (yy + cubukH / 2 + 5).toFixed(1) +
      '" font-size="15" fill="' + R.murekkep + '" text-anchor="end">' + v.yil + '</text>' +
      '<text x="' + (x1 + 9).toFixed(1) + '" y="' + (yy + cubukH / 2 + 5).toFixed(1) +
      '" font-size="14" fill="' + R.murekkep + '">' +
      v.oran.toFixed(2).replace(".", ",") + '× · ' + nf0.format(v.tavan) + ' TL</text>';
  }).join("");

  /* Asgari ucret cizgisi: bandin sol ucu. */
  var taban = '<line x1="' + x(1).toFixed(1) + '" y1="' + (UST - 8) +
    '" x2="' + x(1).toFixed(1) + '" y2="' + (H - ALT + 4) +
    '" stroke="' + R.murekkep + '" stroke-width="2"/>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Ikinci isin beyanname dogurmadan kalabildigi aralik, ' +
    'asgari ucretin kati olarak, ' + yillar[0] + '-' + yillar[yillar.length - 1] + '">' +
    izgara + otesi + taban + cubuklar + etiketler +
    '<text x="' + SOL + '" y="30" font-size="15" fill="' + R.murekkep + '">' +
    'Beyansız kalabilen ikinci iş (aylık brüt)</text>' +
    '<text x="' + SOL + '" y="50" font-size="13" fill="' + R.ikincil + '">' +
    'asgari ücretin katı — her çubuğun sağındaki soluk alanda beyanname zorunlu</text>' +
    '</svg>';
}

/* Dilim kaymasi — "dilim-kaymasi-2022-2026" kapagi.
   Yazinin bulgusu tek yonlu DEGIL ve kapagin bunu gostermesi gerekiyor:
   esikler 2023'te zirve yapip sonra uc yil ust uste eriyor, ama 2026'da
   hala 2022'nin ustunde. Duz bir "eriyor" grafigi yaniltici olurdu; o
   yuzden 2022 duzeyi referans cizgisi olarak duruyor ve egriler onun
   ustunde kaliyor. Iki kategorik seri oldugu icin marka yesili
   KULLANILMIYOR.

   ADLANDIRMA: bu fonksiyon once "dilimKaymasi" adiyla eklendi ve ayni
   dosyadaki bir onceki yazinin ayni adli cizimini SESSIZCE golgeledi --
   iki kayit da buna baglanmis, eski yazinin kapagi yanlis grafikle
   uretilecek durumdaydi. Ad artik ayrisik. */
function dilimKaymasiReel() {
  var W = 600, H = 360, P = 34, SOL = 52, ALT = 58;
  var SERI = require(path.join(KOK, "makaleler", "dilim-kaymasi-2022-2026",
    "seriler.js"));
  var yillar = SERI.YILLAR;
  var taban = B.parametre(yillar[0]).dilimler;
  var seriler = [
    { ad: "1. eşik", i: 0, renk: R.s1 },
    { ad: "2. eşik", i: 1, renk: R.s2 }
  ];
  var veri = yillar.map(function (y) {
    var d = B.parametre(y).dilimler;
    return {
      yil: y,
      e: seriler.map(function (s) {
        return 100 * SERI.reellestir(d[s.i][0], y, yillar[0]) / taban[s.i][0];
      })
    };
  });

  var enAz = 95, enCok = 140;
  var x = function (i) { return SOL + i * (W - SOL - P) / (yillar.length - 1); };
  var yy = function (v) {
    return (H - ALT) - (v - enAz) / (enCok - enAz) * (H - ALT - 76);
  };

  var izgara = [100, 110, 120, 130, 140].map(function (v) {
    var ana = v === 100;
    return '<line x1="' + SOL + '" y1="' + yy(v).toFixed(1) + '" x2="' + (W - P) +
      '" y2="' + yy(v).toFixed(1) + '" stroke="' + (ana ? R.ikincil : R.izgara) +
      '" stroke-width="' + (ana ? 1.5 : 1) + '"' +
      (ana ? ' stroke-dasharray="4 4"' : "") + "/>" +
      '<text x="' + (SOL - 8) + '" y="' + (yy(v) + 4).toFixed(1) +
      '" text-anchor="end" font-size="12" fill="' + R.ikincil + '">' + v + "</text>";
  }).join("");

  var cizgiler = seriler.map(function (s, k) {
    var d = veri.map(function (v, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v.e[k]).toFixed(1);
    }).join(" ");
    var nokta = veri.map(function (v, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + yy(v.e[k]).toFixed(1) +
        '" r="4" fill="' + s.renk + '" stroke="' + R.zemin + '" stroke-width="2"/>';
    }).join("");
    var son = veri[veri.length - 1].e[k];
    return '<path d="' + d + '" fill="none" stroke="' + s.renk + '" stroke-width="2"/>' +
      nokta + '<text x="' + (x(veri.length - 1) - 8) + '" y="' + (yy(son) + 20).toFixed(1) +
      '" text-anchor="end" font-size="14" font-weight="700" fill="' + s.renk + '">' +
      son.toFixed(1).replace(".", ",") + "</text>";
  }).join("");

  var eksen = yillar.map(function (y, i) {
    return '<text x="' + x(i).toFixed(1) + '" y="' + (H - ALT + 20) +
      '" text-anchor="middle" font-size="12" fill="' + R.ikincil + '">' + y + "</text>";
  }).join("");

  var gosterge = seriler.map(function (s, i) {
    return '<g transform="translate(' + (SOL + i * 120) + ',' + (H - 18) + ')">' +
      '<circle cx="5" cy="-4" r="4" fill="' + s.renk + '"/>' +
      '<text x="16" y="0" font-size="13" fill="' + R.ikincil + '">' + esc(s.ad) + "</text></g>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Tarife esiklerinin reel degeri 2022 esittir 100: 2023 te zirve, sonra uc yil erime, 2026 da hala 100 un ustunde">' +
    '<text x="' + P + '" y="' + (P - 8) + '" font-size="15" fill="' + R.ikincil +
    '">Eşiklerin reel değeri (2022 = 100)</text>' +
    izgara + cizgiler + eksen + gosterge +
    '<text x="' + (W - P) + '" y="' + (yy(100) - 8).toFixed(1) +
    '" text-anchor="end" font-size="12" fill="' + R.ikincil + '">2022 düzeyi</text>' +
    "</svg>";
}

/* ---------- kapaklar ---------- */

/* Emeklilik makalesi: OECD tanimiyla 100 calisma cagindaki kisiye dusen 65+.
   Kapak icin bu seri secildi cunku yazinin demografik omurgasi ve tek bir
   GECIS anlatiyor: Turkiye bugun OECD'nin yarisinda, 2084 projeksiyonunda
   ustunde. Iki kategorik seri oldugu icin marka yesili KULLANILMIYOR. */
function sutunBagimlilik() {
  var veri = [
    { yil: "2024", not: "gözlem", tr: 16.8, oecd: 32.6 },
    { yil: "2054", not: "projeksiyon", tr: 42.5, oecd: 55.2 },
    { yil: "2084", not: "projeksiyon", tr: 75.4, oecd: 67.7 }
  ];
  var enCok = 80;
  var W = 620, H = 400, TY = 300, SOL = 54;
  var gen = (W - SOL - 24) / veri.length;

  var govde = veri.map(function (v, i) {
    var x0 = SOL + i * gen;
    var w = (gen - 34) / 2;
    var htr = v.tr / enCok * 190;
    var ho = v.oecd / enCok * 190;
    function cubuk(x, h, renk, deger) {
      return '<rect x="' + x.toFixed(1) + '" y="' + (TY - h).toFixed(1) +
        '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="3" fill="' + renk + '"/>' +
        '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (TY - h - 9).toFixed(1) +
        '" text-anchor="middle" font-size="17" font-weight="700" fill="' + renk + '">' +
        deger.toFixed(1).replace(".", ",") + '</text>';
    }
    return cubuk(x0, htr, R.s1, v.tr) + cubuk(x0 + w + 10, ho, R.s2, v.oecd) +
      '<text x="' + (x0 + w + 5).toFixed(1) + '" y="' + (TY + 24) +
      '" text-anchor="middle" font-size="18" font-weight="600" fill="' + R.murekkep + '">' + v.yil + '</text>' +
      '<text x="' + (x0 + w + 5).toFixed(1) + '" y="' + (TY + 44) +
      '" text-anchor="middle" font-size="14" fill="' + R.ikincil + '">' + v.not + '</text>';
  }).join("");

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="100 calisma cagindaki kisiye dusen 65 yas ustu nufus: Turkiye ve OECD ortalamasi">' +
    '<text x="24" y="30" font-size="22" font-weight="800" fill="' + R.murekkep + '">100 çalışma çağındaki kişiye düşen 65+</text>' +
    '<text x="24" y="56" font-size="16" fill="' + R.ikincil + '">OECD tanımı: payda 20-64 yaş</text>' +
    '<rect x="24" y="70" width="11" height="11" rx="2" fill="' + R.s1 + '"/>' +
    '<text x="42" y="80" font-size="15" fill="' + R.ikincil + '">Türkiye</text>' +
    '<rect x="120" y="70" width="11" height="11" rx="2" fill="' + R.s2 + '"/>' +
    '<text x="138" y="80" font-size="15" fill="' + R.ikincil + '">OECD ortalaması</text>' +
    '<line x1="' + SOL + '" y1="' + TY + '" x2="' + (W - 24) + '" y2="' + TY + '" stroke="' + R.izgara + '" stroke-width="1"/>' +
    '<text x="24" y="' + (TY + 5) + '" font-size="14" fill="' + R.ikincil + '">0</text>' +
    '<text x="24" y="' + (TY - 190 + 5) + '" font-size="14" fill="' + R.ikincil + '">80</text>' +
    govde +
    '<text x="24" y="' + (H - 12) + '" font-size="15" fill="' + R.ikincil + '">Kaynak: OECD (2025, Tablo 6.2) · 2054 ve 2084 BM orta varyantı</text></svg>';
}

/* Torba yasa beklentileri — "torba-yasa-beklenti-tutuyor-mu" kapagi.

   Yazinin bulgusu TEK SERILI anlatilamiyor: kanunlar cikmaya devam etti,
   beklentiden gelen madde ise durdu. Yalnizca "gelen madde" cizilse dort
   cubuktan ucu sifir olurdu ve okuyucu "o yil kanun da cikmadi" sanardi.
   Yan yana iki seri bu yanlis okumayi kapatiyor.

   Iki KATEGORIK seri oldugu icin marka yesili kullanilmiyor; s1/s2 var.
   Sifir degerler cubuk uretmiyor, o yuzden taban uzerinde ince bir kutuk
   ve acik "0" etiketi var -- yoksa o yillar cizimden dusup gorunmez olur. */
function torbaBeklentiCubuk() {
  var W = 600, H = 360, TABAN = 278, TAVAN = 128;
  var B = require(path.join(KOK, "makaleler",
    "torba-yasa-beklenti-tutuyor-mu", "beklenti.js"));

  var yillar = B.yillar();
  var seri = yillar.map(function (y) {
    return { yil: y, kanun: B.kanunlarYil(y).length, getiri: B.getiriYil(y) };
  });
  var enBuyuk = 0;
  seri.forEach(function (d) {
    if (d.kanun > enBuyuk) enBuyuk = d.kanun;
    if (d.getiri > enBuyuk) enBuyuk = d.getiri;
  });

  var SOL = 56, SAG = 572;
  var grupG = (SAG - SOL) / seri.length;
  var cubukG = 46, ARA = 2;
  function yuk(v) { return enBuyuk ? (TABAN - TAVAN) * (v / enBuyuk) : 0; }

  var parca = [];
  seri.forEach(function (d, i) {
    var merkez = SOL + grupG * i + grupG / 2;
    var x1 = merkez - cubukG - ARA / 2;
    var x2 = merkez + ARA / 2;

    [[x1, d.kanun, R.s1], [x2, d.getiri, R.s2]].forEach(function (c) {
      var x = c[0], v = c[1], renk = c[2];
      var h = yuk(v);
      if (h > 0) {
        parca.push('<rect x="' + x.toFixed(1) + '" y="' + (TABAN - h).toFixed(1) +
          '" width="' + cubukG + '" height="' + h.toFixed(1) +
          '" rx="4" fill="' + renk + '"/>');
        parca.push('<text x="' + (x + cubukG / 2).toFixed(1) + '" y="' +
          (TABAN - h - 9).toFixed(1) + '" text-anchor="middle" font-size="19" ' +
          'font-weight="800" fill="' + renk + '">' + v + '</text>');
      } else {
        /* Sifir cubuk cizmiyor; kutuk ve etiket olmazsa yil yok olur. */
        parca.push('<rect x="' + x.toFixed(1) + '" y="' + (TABAN - 3) +
          '" width="' + cubukG + '" height="3" rx="1.5" fill="' + renk +
          '" fill-opacity="0.3"/>');
        parca.push('<text x="' + (x + cubukG / 2).toFixed(1) + '" y="' +
          (TABAN - 11) + '" text-anchor="middle" font-size="19" ' +
          'font-weight="800" fill="' + R.ikincil + '">0</text>');
      }
    });

    parca.push('<text x="' + merkez.toFixed(1) + '" y="' + (TABAN + 24) +
      '" text-anchor="middle" font-size="17" font-weight="700" fill="' +
      R.murekkep + '">' + d.yil + '</text>');
  });

  function lejant(x, renk, metin) {
    return '<rect x="' + x + '" y="326" width="13" height="13" rx="3" fill="' +
      renk + '"/><text x="' + (x + 20) + '" y="337" font-size="15" fill="' +
      R.ikincil + '">' + esc(metin) + '</text>';
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
    '" role="img" aria-label="Yillara gore cikan torba kanun sayisi ile ' +
    'beklenti listesinden gelen madde sayisinin karsilastirmasi">' +
    '<text x="24" y="34" font-size="16" fill="' + R.ikincil +
    '">' + B.ILK_YIL + '\u2013' + B.SON_YIL + ' \u00b7 b\u00fcy\u00fck torba kanunlar</text>' +
    '<text x="24" y="84" font-size="34" font-weight="800" fill="' + R.murekkep +
    '">Kanunlar \u00e7\u0131kt\u0131, beklenti durdu</text>' +
    '<path d="M' + SOL + ' ' + TABAN + ' H' + SAG + '" stroke="' + R.izgara +
    '" stroke-width="2"/>' +
    parca.join("") +
    lejant(24, R.s1, "\u00c7\u0131kan torba kanun") +
    lejant(210, R.s2, "Beklenti listesinden gelen madde") +
    '</svg>';
}

/* BES efektif orani -- "bes-devlet-katkisi-ne-kadar-degerli" kapagi.

   Yazinin bulgusu bir EGRI: tavana kadar oran sabit, sonra hiperbolik
   olarak eriyor. Cubuk grafik bunu anlatamaz cunku kirilma noktasinin
   YERI bilginin kendisi; cizgi kirilmayi gosterir.

   Tek seri oldugu icin marka rengi kullanilabilir. Tavan cizgisi
   ikincil renkte ve kesikli: veri degil, referans. */
function besEfektifOran() {
  var W = 600, H = 360, SOL = 64, SAG = 566, TABAN = 268, TAVAN_Y = 120;
  var B = require(path.join(KOK, "makaleler", "bes-devlet-katkisi-ne-kadar-degerli", "bes.js"));

  var A = B.tavan();
  var enCok = A * 4;                       // yatay eksen sonu
  var m = B.guncelOran();

  function x(c) { return SOL + (SAG - SOL) * (c / enCok); }
  function y(o) { return TABAN - (TABAN - TAVAN_Y) * (o / m); }

  /* Egri: tavana kadar duz, sonra m*A/C hiperbolu. */
  var nokta = [];
  for (var i = 0; i <= 120; i++) {
    var c = enCok * (i / 120);
    if (c <= 0) continue;
    nokta.push((nokta.length ? "L" : "M") + x(c).toFixed(1) + " " +
               y(B.efektifOran(c)).toFixed(1));
  }

  function etiket(c, metin, kaydir) {
    return '<circle cx="' + x(c).toFixed(1) + '" cy="' + y(B.efektifOran(c)).toFixed(1) +
      '" r="6" fill="' + R.marka + '"/>' +
      '<text x="' + (x(c) + (kaydir || 10)).toFixed(1) + '" y="' +
      (y(B.efektifOran(c)) - 12).toFixed(1) + '" font-size="17" font-weight="800" fill="' +
      R.marka + '">' + metin + '</text>';
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
    '" role="img" aria-label="Yillik katki arttikca efektif esleisme oraninin ' +
    'tavandan sonra hiperbolik bicimde erimesi">' +
    '<text x="24" y="34" font-size="16" fill="' + R.ikincil +
    '">2026 \u00b7 yasal oran %' + (m * 100) + '</text>' +
    '<text x="24" y="84" font-size="34" font-weight="800" fill="' + R.murekkep +
    '">Tavandan sonra oran eriyor</text>' +
    /* taban ve tavan referansi */
    '<path d="M' + SOL + ' ' + TABAN + ' H' + SAG + '" stroke="' + R.izgara +
    '" stroke-width="2"/>' +
    '<path d="M' + x(A).toFixed(1) + ' ' + TAVAN_Y + ' V' + TABAN +
    '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="5 4"/>' +
    '<text x="' + (x(A) + 8).toFixed(1) + '" y="' + (TAVAN_Y + 16) +
    '" font-size="15" font-weight="700" fill="' + R.s2 + '">Tavan</text>' +
    /* egri */
    '<path d="' + nokta.join(" ") + '" fill="none" stroke="' + R.marka +
    '" stroke-width="3"/>' +
    etiket(A, "%" + (m * 100), -46) +
    etiket(A * 2, "%" + (m * 100 / 2)) +
    etiket(A * 4, "%" + (m * 100 / 4), -40) +
    /* yatay eksen etiketleri */
    '<g font-size="15" fill="' + R.ikincil + '" text-anchor="middle">' +
    '<text x="' + x(A).toFixed(1) + '" y="' + (TABAN + 22) + '">1\u00d7</text>' +
    '<text x="' + x(A * 2).toFixed(1) + '" y="' + (TABAN + 22) + '">2\u00d7</text>' +
    '<text x="' + x(A * 4).toFixed(1) + '" y="' + (TABAN + 22) + '">4\u00d7</text>' +
    '</g>' +
    '<text x="24" y="' + (H - 18) + '" font-size="15" fill="' + R.ikincil +
    '">Yatay eksen: y\u0131ll\u0131k katk\u0131 pay\u0131n\u0131n tavana oran\u0131</text>' +
    '</svg>';
}

var KAPAKLAR = {
  "bes-devlet-katkisi-ne-kadar-degerli": {
    kicker: "Emeklilik \u00b7 \u00d6l\u00e7\u00fcm",
    baslik: "Devlet katk\u0131s\u0131 ne kadar de\u011ferli?",
    alt: "Tavandan sonra yasal oran ile ald\u0131\u011f\u0131n\u0131z oran ayr\u0131\u015f\u0131yor",
    cizim: besEfektifOran
  },
  "torba-yasa-beklenti-tutuyor-mu": {
    kicker: "Mevzuat \u00b7 \u00d6l\u00e7\u00fcm",
    baslik: "Beklentiler tuttu mu?",
    alt: "D\u00f6rt yasama y\u0131l\u0131, sekiz torba kanun, tek dolu y\u0131l",
    cizim: torbaBeklentiCubuk
  },
  "krediyi-erken-kapatmak-mantikli-mi": {
    kicker: "Finans · Karar rehberi",
    baslik: "Krediyi kapatmak mı, mevduat mı?",
    alt: "Aynı para. Aynı bütçe. İki farklı yol.",
    cizim: function () {
      var son = 100000 * Math.pow(1.02, 12);
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" role="img" aria-label="Varsayımsal karşılaştırmada aylık net yüzde 2 eşik noktası">' +
        '<text x="24" y="30" font-size="16" fill="#56605c">100.000 TL · 12 ay · örnek senaryo</text>' +
        '<text x="24" y="89" font-size="46" font-weight="800" fill="#17201d">Eşik: aylık net %2</text>' +
        '<text x="24" y="120" font-size="17" fill="#56605c">İki yolun son birikimi: ' + nf0.format(son) + ' TL</text>' +
        '<path d="M50 167 H550" stroke="#b9c9c2" stroke-width="3"/>' +
        '<circle cx="70" cy="167" r="6" fill="#0e7c66"/><circle cx="300" cy="167" r="9" fill="#17201d"/><circle cx="530" cy="167" r="6" fill="#205dab"/>' +
        '<rect x="24" y="196" width="171" height="96" rx="12" fill="#e3efe8"/>' +
        '<rect x="214" y="196" width="171" height="96" rx="12" fill="#e8e7e1"/>' +
        '<rect x="404" y="196" width="171" height="96" rx="12" fill="#e4ebf6"/>' +
        '<g font-size="30" font-weight="800" text-anchor="middle"><text x="109" y="235" fill="#0e7c66">%1</text><text x="299" y="235" fill="#17201d">%2</text><text x="489" y="235" fill="#205dab">%3</text></g>' +
        '<g font-size="17" font-weight="600" text-anchor="middle" fill="#17201d"><text x="109" y="268">Kapatma önde</text><text x="299" y="268">Eşit sonuç</text><text x="489" y="268">Mevduat önde</text></g>' +
        '<text x="24" y="337" font-size="15" fill="#56605c">Serbest kalan taksitler biriktirilir. Getiriler varsayımsaldır.</text></svg>';
    }
  },
  "emekliligin-finansal-matematigi": {
    kicker: "Akademik",
    baslik: "Emekliliğin finansal matematiği",
    alt: "Türkiye bugün OECD'nin yarısında; 2084'te üstünde",
    cizim: sutunBagimlilik
  },
  "mevduat-faizi-enflasyon-reel-getiri": {
    kicker: "Finans",
    baslik: "Mevduat faizi enflasyonu geçiyor mu?",
    alt: "Aynı bakiye, üç farklı satın alma gücü",
    cizim: function () {
      var net = 0.45 * 32 / 365 * (1 - 0.175);
      var zero = 218, scale = 90;
      var bars = [0.02, 0.03, 0.04].map(function (inflation, i) {
        var real = ((1 + net) / (1 + inflation) - 1) * 100;
        var x = 96 + i * 172, height = Math.abs(real) * scale;
        var color = real >= 0 ? R.marka : R.s2;
        return '<rect x="' + x + '" y="' + (real >= 0 ? zero - height : zero) + '" width="92" height="' + height + '" rx="5" fill="' + color + '"/>' +
          '<text x="' + (x + 46) + '" y="' + (real >= 0 ? zero - height - 14 : zero + height + 28) + '" text-anchor="middle" font-size="26" font-weight="800" fill="' + color + '">' + (real >= 0 ? '+' : '−') + '%' + Math.abs(real).toFixed(2).replace('.', ',') + '</text>' +
          '<text x="' + (x + 46) + '" y="340" text-anchor="middle" font-size="20" fill="' + R.murekkep + '">%' + Math.round(inflation * 100) + ' enflasyon</text>';
      }).join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 400">' +
        '<text x="30" y="34" font-size="24" font-weight="800" fill="' + R.murekkep + '">32 günde reel getiri</text>' +
        '<text x="30" y="63" font-size="18" fill="' + R.ikincil + '">Net dönem getirisi: %3,2548</text>' +
        '<line x1="66" y1="218" x2="590" y2="218" stroke="' + R.ikincil + '" stroke-width="1"/>' +
        '<text x="18" y="224" font-size="18" fill="' + R.ikincil + '">%0</text>' + bars +
        '<text x="30" y="384" font-size="17" fill="' + R.ikincil + '">Aynı döneme ait varsayımsal enflasyon senaryoları</text></svg>';
    }
  },
  "maasim-neden-dustu": {
    kicker: "Bordro",
    baslik: "Maaşım neden düştü?",
    alt: "Kümülatif vergi matrahı, ay ay",
    cizim: cizgiNetMaas
  },
  "sahis-mi-limited-mi": {
    kicker: "Vergi",
    baslik: "Şahıs mı, limited mi?",
    alt: "Tek bir eşik yok — kazanan beş kez değişiyor",
    cizim: bantKazanan
  },
  "asgari-ucret-nasil-belirlenir": {
    kicker: "Bordro",
    baslik: "Asgari ücret nasıl belirlenir?",
    alt: "Ve neden yalnızca asgari ücretliyi ilgilendirmez",
    cizim: sutunIstisna
  },
  "torba-yasa-ne-var-ne-yok": {
    kicker: "Mevzuat",
    baslik: "Torba yasada ne var, ne yok?",
    alt: "Beklenti ile yürürlükteki hükmü ayırmak",
    cizim: function () {
      return durumIsareti([
        { durum: "yok", baslik: "Yeni torba kanun teklifi", alt: "Henüz sunulmadı" },
        { durum: "var", baslik: "7582 · 7589 · 7590", alt: "2026 yazında yürürlüğe girdi" },
        { durum: "bekliyor", baslik: "Yasama yılı", alt: "1 Ekim 2026'da açılıyor" }
      ]);
    }
  },
  "istifa-edince-kidem-tazminati": {
    kicker: "Tazminat",
    baslik: "İstifa edince kıdem alınır mı?",
    alt: "Aynı ücret, aynı kıdem — fark 665 bin lira",
    cizim: sutunAyrilmaSekli
  },
  "kidem-tazminati-tavani": {
    kicker: "Tazminat",
    baslik: "Kıdem tazminatı tavanı",
    alt: "Maaş artıyor, tazminat artmıyor",
    cizim: cizgiTavan
  },
  "net-maas-mi-brut-maas-mi": {
    kicker: "Bordro",
    baslik: "Net maaşta mı, brüt maaşta mı?",
    alt: "Aynı rakam, yılda 50 bin lira fark",
    cizim: cizgiNetBrutAnlasma
  },
  "issizlik-maasi-ne-kadar": {
    kicker: "Sosyal Güvenlik",
    baslik: "İşsizlik maaşı ne kadar?",
    alt: "Tavanı bile net asgari ücretin altında",
    cizim: sutunIssizlikTavani
  },
  "fazla-mesai-zammi-yuzde-kac": {
    kicker: "Çalışma hayatı",
    baslik: "Fazla mesai zammı yüzde kaç?",
    alt: "Oranı, ne kadar çalıştığınız değil sözleşmeniz belirler",
    cizim: katmanliHafta
  },
  "vergi-dilimleri-asgari-ucrete-yetisemiyor": {
    kicker: "Vergi",
    baslik: "Dilimler asgari ücrete yetişemiyor",
    alt: "Aynı katta maaş alan biri her yıl daha hızlı tırmanıyor",
    cizim: dilimKaymasi
  },
  "tasarruf-kimde-finansman-kimde": {
    kicker: "Makro",
    baslik: "Tasarruf kimde, finansman kimde?",
    alt: "Nominal büyüyen kredi, reel olarak küçülüyor",
    cizim: tasarrufNominalReel
  },
  "kredi-tavani-ve-banka-karliligi": {
    kicker: "Para politikası",
    baslik: "Kredi tavanı tutuyor mu?",
    alt: "En gevşek tavan bile gerçekleşmenin altında",
    cizim: krediTavaniTakoz
  },
  "sgk-prim-tavani-9-kat": {
    kicker: "Sosyal güvenlik",
    baslik: "SGK prim tavanı 9 kata çıktı",
    alt: "Yük dar bir bantta — ve en tepede geri çekiliyor",
    cizim: sgkTavanEtkisi
  },
  "yeniden-degerleme-orani-nedir": {
    kicker: "Vergi",
    baslik: "Yeniden değerleme oranı nedir?",
    alt: "Kesir hep aşağı atılıyor — fark beş yılda birikti",
    cizim: ydoBirikmisFark
  },
  "ikramiye-hangi-ay-odenmeli": {
    kicker: "Vergi",
    baslik: "İkramiye hangi ay ödenirse daha az kesilir?",
    alt: "Ay fark etmiyor — kaç ödemeye bölündüğü ediyor",
    cizim: ikramiyeParcalari
  },
  "kredi-karti-asgari-odeme": {
    kicker: "Finans",
    baslik: "Asgari ödersem borcum ne zaman biter?",
    alt: "Borç her ay eriyor — hızı asgari orana bağlı",
    cizim: kartErimesi
  },
  "iki-isten-maas-beyanname-siniri": {
    kicker: "Vergi",
    baslik: "İki işten maaş alan beyanname verir mi?",
    alt: "Beyansız kalabilen aralık asgari ücretin hemen üstünde bitiyor",
    cizim: beyanPenceresi
  },
  "dilim-kaymasi-2022-2026": {
    kicker: "Vergi",
    baslik: "Dilim kayması gerçekten oluyor mu?",
    alt: "2023’te zirve, sonra üç yıl erime — ama hâlâ 2022’nin üstünde",
    cizim: dilimKaymasiReel
  },
  "serbest-meslek-makbuzu-stopaj-kdv": {
    kicker: "Vergi",
    baslik: "Makbuzda elinizde ne kalıyor?",
    alt: "Hesaba geçen para brüt ücrete eşit — ama sizin değil",
    cizim: makbuzAkisi
  },
  "mtv-2026-ne-kadar": {
    kicker: "Vergi",
    baslik: "2026 MTV ne kadar?",
    alt: "Aynı araca tescil tarihine göre iki farklı tarife",
    cizim: farkMtv
  },
  "otv-basamak-etkisi": {
    kicker: "Vergi",
    baslik: "ÖTV'nin basamak etkisi",
    alt: "Eşiğin bir lira üstü, fiyatı bir sıçrayışla yukarı taşır",
    cizim: basamakOtv
  },
  "kredi-yillik-maliyet-orani": {
    kicker: "Finans",
    baslik: "Yıllık maliyet oranı nedir?",
    alt: "Bankanın söylediği faiz, ödediğiniz bedel değil",
    cizim: merdivenYmo
  },
  "proforma-fatura-nedir": {
    kicker: "Fatura ve Belge",
    baslik: "Proforma fatura nedir?",
    alt: "Vergisel sonucu yok, hukuki sonucu olabilir",
    cizim: function () {
      return durumIsareti([
        { durum: "yok", baslik: "Muhasebe kaydı doğurur mu?", alt: "Hayır — deftere yazılmaz" },
        { durum: "yok", baslik: "KDV doğurur mu?", alt: "Hayır — beyannameye girmez" },
        { durum: "var", baslik: "Sözleşme kurabilir mi?", alt: "Evet — kabul edilirse bağlar" }
      ]);
    }
  },
  "vergi-kamasi-ucretin-gercek-yuku": {
    kicker: "Kamu maliyesi",
    baslik: "Vergi kaması",
    alt: "Yük tavana kadar artıyor, sonra düşüyor",
    cizim: cizgiKama
  },
  "zam-net-maasa-ne-kadar-yansir": {
    kicker: "Maaş",
    baslik: "Zam nete ne kadar yansır?",
    alt: "Aynı zam, farklı maaşta farklı sonuç",
    cizim: cizgiZamFark
  },
  "uzun-vadeli-yatirim-nasil-yapilir": {
    kicker: "Yatırım",
    baslik: "Uzun vadeli yatırım nasıl yapılır?",
    alt: "Getiriyi doğru ölçmek, enstrüman seçmekten önemli",
    cizim: merdivenReel
  },
  "stopaj-nasil-hesaplanir": {
    kicker: "Vergi",
    baslik: "Stopaj nasıl hesaplanır?",
    alt: "Brütten kesilir, nete eklenmez",
    cizim: sutunBrutlestirme
  },
  "kdv-tevkifati-nedir": {
    kicker: "Vergi",
    baslik: "KDV tevkifatı nedir?",
    alt: "Fatura toplamı değişmez, tahsilat bölünür",
    cizim: sutunTevkifat
  },
  "emekli-maasi-nasil-hesaplanir": {
    kicker: "Emeklilik",
    baslik: "Emekliye yeni maaş sistemi mi geldi?",
    alt: "Önce haberi kontrol ettik",
    cizim: function () {
      return durumIsareti([
        { durum: "yok", baslik: "Yürürlüğe girmiş yeni sistem", alt: "Doğrulanamadı" },
        { durum: "yok", baslik: "Resmî Gazete tarihi", alt: "Haberde yok" },
        { durum: "var", baslik: "Dönem kırılmaları", alt: "Gerçek — ve yıllardır yürürlükte" }
      ]);
    }
  },
  "kademeli-emeklilik-son-durum": {
    kicker: "Mevzuat",
    baslik: "Kademeli emeklilik son durum",
    alt: "Yasalaştı mı, kimleri kapsıyor?",
    cizim: function () {
      return durumIsareti([
        { durum: "yok", baslik: "Yasalaştı mı?", alt: "Hayır — teklif komisyonda" },
        { durum: "bekliyor", baslik: "Esas no 2/2755", alt: "6 Aralık 2024'ten beri bekliyor" },
        { durum: "var", baslik: "Yürürlükteki şartlar", alt: "1999-2008 arası sigortalılar" }
      ]);
    }
  }
};

var KART_SABLON =
  '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>' +
  "*{margin:0;padding:0;box-sizing:border-box}" +
  "html,body{width:800px;height:500px;overflow:hidden}" +
  "body{background:" + R.zemin + ";color:" + R.murekkep + ";" +
  'font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;' +
  "display:flex;align-items:center;justify-content:center;padding:30px 34px;position:relative}" +
  ".serit{position:absolute;left:0;top:0;bottom:0;width:8px;background:" + R.marka + "}" +
  "svg{width:100%;height:auto}" +
  "</style></head><body><div class=\"serit\"></div>{svg}</body></html>";

var SABLON =
  '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>' +
  "*{margin:0;padding:0;box-sizing:border-box}" +
  "html,body{width:1200px;height:630px;overflow:hidden}" +
  "body{background:" + R.zemin + ";color:" + R.murekkep + ";" +
  'font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;' +
  "display:flex;align-items:center;gap:36px;padding:48px 56px;position:relative}" +
  ".sol{width:432px;flex:none}" +
  ".kicker{font-size:19px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:" + R.marka + ";margin-bottom:20px}" +
  ".baslik{font-family:Georgia,\"Times New Roman\",serif;font-size:{fs}px;line-height:1.1;letter-spacing:-.02em;font-weight:700}" +
  ".alt{margin-top:20px;font-size:21px;line-height:1.45;color:" + R.ikincil + "}" +
  ".sag{flex:1;display:flex;align-items:center;justify-content:center}" +
  ".sag svg{width:100%;height:auto}" +
  ".imza{position:absolute;left:60px;bottom:40px;font-size:17px;font-weight:600;color:" + R.ikincil + "}" +
  ".imza b{color:" + R.murekkep + "}" +
  ".serit{position:absolute;left:0;top:0;bottom:0;width:10px;background:" + R.marka + "}" +
  "</style></head><body>" +
  '<div class="serit"></div>' +
  '<div class="sol"><p class="kicker">{kicker}</p><h1 class="baslik">{baslik}</h1>' +
  '<p class="alt">{alt}</p></div>' +
  '<div class="sag">{svg}</div>' +
  '<p class="imza"><b>Koray Öner</b> · korayoner.dev</p>' +
  "</body></html>";

/* Tevkifat: genel toplam SABIT kalirken tahsilatin nasil bolundugu.
   Yazinin tek iddiasi bu, gorsel de onu gostermeli — her cubuk ayni boyda. */
function sutunTevkifat() {
  var W = 600, H = 360, P = 30;
  var oranlar = [
    { ad: "Yok", tevkif: 0 },
    { ad: "2/10", tevkif: 4000 },
    { ad: "5/10", tevkif: 10000 },
    { ad: "9/10", tevkif: 18000 }
  ];
  var matrah = 100000, kdv = 20000, toplam = matrah + kdv;
  var solX = P + 4, genislik = W - P * 2 - 8;
  var cubukY = 74, cubukH = 46, aralik = 22;

  var ic = oranlar.map(function (o, i) {
    var y = cubukY + i * (cubukH + aralik);
    var tahsil = toplam - o.tevkif;
    var wTahsil = Math.round(genislik * tahsil / toplam);
    var wTevkif = genislik - wTahsil;
    var parca =
      '<text x="' + solX + '" y="' + (y - 7) + '" font-size="17" font-weight="700" fill="' +
        R.murekkep + '">' + o.ad + "</text>" +
      '<rect x="' + solX + '" y="' + y + '" width="' + wTahsil + '" height="' + cubukH +
        '" rx="4" fill="' + R.marka + '"/>' +
      '<text x="' + (solX + 12) + '" y="' + (y + cubukH / 2 + 6) +
        '" font-size="17" font-weight="700" fill="#ffffff">' +
        nf0.format(tahsil) + " TL</text>";
    if (wTevkif > 0) {
      parca +=
        '<rect x="' + (solX + wTahsil + 2) + '" y="' + y + '" width="' + (wTevkif - 2) +
          '" height="' + cubukH + '" rx="4" fill="' + R.s2 + '" fill-opacity="0.85"/>';
      if (wTevkif > 96) {
        parca += '<text x="' + (solX + wTahsil + 12) + '" y="' + (y + cubukH / 2 + 6) +
          '" font-size="16" font-weight="700" fill="#ffffff">' + nf0.format(o.tevkif) + "</text>";
      }
    }
    return parca;
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Tevkifat oranı ' +
    'değişse de fatura toplamı 120.000 TL sabit kalıyor; değişen, satıcıya ödenen kısım">' +
    '<text x="' + solX + '" y="30" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">Fatura toplamı her satırda 120.000 TL</text>' +
    '<text x="' + solX + '" y="52" font-size="15" fill="' + R.ikincil +
      '">100.000 TL matrah + %20 KDV</text>' +
    ic +
    '<rect x="' + solX + '" y="' + (H - 34) + '" width="13" height="13" rx="3" fill="' +
      R.marka + '"/>' +
    '<text x="' + (solX + 20) + '" y="' + (H - 23) + '" font-size="15" fill="' + R.ikincil +
      '">Satıcıya ödenen</text>' +
    '<rect x="' + (solX + 168) + '" y="' + (H - 34) + '" width="13" height="13" rx="3" fill="' +
      R.s2 + '" fill-opacity="0.85"/>' +
    '<text x="' + (solX + 188) + '" y="' + (H - 23) + '" font-size="15" fill="' + R.ikincil +
      '">Alıcının vergi dairesine ödediği</text>' +
    "</svg>";
}

/* Ilan edilen orandan gercek maliyete: her adimda ne eklendigini gosteren
   merdiven. Yazinin tek iddiasi bu dort basamak. */
function merdivenYmo() {
  var W = 600, H = 360, P = 30;
  var adimlar = [
    { ad: "Aylık faiz", oran: 2.89, not: "vitrindeki rakam", renk: R.ikincil },
    { ad: "+ KKDF ve BSMV", oran: 3.757, not: "aylık maliyet oranı", renk: R.s1 },
    { ad: "× 12 (basit)", oran: 34.68, not: "yaygın ama eksik", renk: R.s2 },
    { ad: "Yıllık maliyet oranı", oran: 56.31, not: "gerçekte ödediğiniz", renk: R.marka }
  ];
  var enBuyuk = 56.31;
  var solX = P + 4, genislik = W - P * 2 - 130;
  var y0 = 78, yH = 44, ara = 24;

  var ic = adimlar.map(function (a, i) {
    var y = y0 + i * (yH + ara);
    var w = Math.max(6, Math.round(genislik * a.oran / enBuyuk));
    var son = i === adimlar.length - 1;
    return '<text x="' + solX + '" y="' + (y - 7) + '" font-size="16" font-weight="' +
        (son ? "800" : "700") + '" fill="' + R.murekkep + '">' + esc(a.ad) + "</text>" +
      '<rect x="' + solX + '" y="' + y + '" width="' + w + '" height="' + yH +
        '" rx="4" fill="' + a.renk + '"' + (son ? "" : ' fill-opacity="0.75"') + "/>" +
      '<text x="' + (solX + w + 12) + '" y="' + (y + yH / 2 - 2) +
        '" font-size="' + (son ? 21 : 18) + '" font-weight="800" fill="' +
        (son ? R.marka : R.murekkep) + '">%' +
        a.oran.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        "</text>" +
      '<text x="' + (solX + w + 12) + '" y="' + (y + yH / 2 + 15) +
        '" font-size="13" fill="' + R.ikincil + '">' + esc(a.not) + "</text>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Aylık %2,89 ' +
    'faizden gerçek yıllık maliyet %56,31 oranına dört adımda">' +
    '<text x="' + solX + '" y="34" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">250.000 TL · 36 ay · ihtiyaç kredisi</text>' +
    '<text x="' + solX + '" y="56" font-size="15" fill="' + R.ikincil +
      '">Vitrindeki orandan ödenen bedele</text>' + ic + "</svg>";
}

/* Reel getiri merdiveni — "uzun vadeli yatırım nasıl yapılır" kapağı.
   Sayılar BURADA HESAPLANIYOR, yazılmıyor: yazıdaki tabloyla ayrışması
   matematiksel olarak imkânsız. Üç basamak, yazının üç adımı:
   sanılan getiri -> reel getiri -> vergi sonrası reel getiri. */
function merdivenReel() {
  var W0 = 600, H0 = 360, P0 = 30;
  var nominal = 0.45, enflasyon = 0.40, stopaj = 0.15;
  function fisher(n, e) { return (1 + n) / (1 + e) - 1; }

  var adimlar = [
    { ad: "Çıkarma ile (yanlış)", oran: (nominal - enflasyon) * 100,
      not: "%45 − %40", renk: R.ikincil },
    { ad: "Reel getiri", oran: fisher(nominal, enflasyon) * 100,
      not: "1,45 ÷ 1,40 − 1", renk: R.marka },
    { ad: "Stopajdan sonra", oran: fisher(nominal * (1 - stopaj), enflasyon) * 100,
      not: "%15 stopaj · alım gücü kaybı", renk: R.s2 }
  ];
  var enBuyuk = 5;
  var solX = P0 + 4, genislik = W0 - P0 * 2 - 190;
  var y0 = 104, yH = 50, ara = 30;

  var ic = adimlar.map(function (a, i) {
    var y = y0 + i * (yH + ara);
    var son = i === adimlar.length - 1;
    var w = Math.max(8, Math.round(genislik * Math.abs(a.oran) / enBuyuk));
    return '<text x="' + solX + '" y="' + (y - 8) + '" font-size="16" font-weight="700" fill="' +
        R.murekkep + '">' + esc(a.ad) + "</text>" +
      '<rect x="' + solX + '" y="' + y + '" width="' + w + '" height="' + yH +
        '" rx="4" fill="' + a.renk + '"' + (son ? "" : ' fill-opacity="0.8"') + "/>" +
      '<text x="' + (solX + w + 12) + '" y="' + (y + yH / 2 - 2) +
        '" font-size="21" font-weight="800" fill="' + (son ? R.s2 : R.murekkep) + '">' +
        (a.oran < 0 ? "−" : "") + "%" +
        Math.abs(a.oran).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        "</text>" +
      '<text x="' + (solX + w + 12) + '" y="' + (y + yH / 2 + 17) +
        '" font-size="13" fill="' + R.ikincil + '">' + esc(a.not) + "</text>";
  }).join("");

  return '<svg viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-label="%45 nominal ' +
    'getiri %40 enflasyonda %3,57 reel, %15 stopajdan sonra eksi %1,25">' +
    '<text x="' + solX + '" y="40" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">%45 nominal getiri · %40 enflasyon</text>' +
    '<text x="' + solX + '" y="64" font-size="15" fill="' + R.ikincil +
      '">Aynı yatırım, üç farklı ölçüm</text>' + ic + "</svg>";
}

/* Brütleştirme karşılaştırması — "stopaj nasıl hesaplanır" kapağı.
   İki sütun, aynı hedef net: doğru yöntem hedefi tutturur, yaygın yanlış
   yöntem tutturamaz. Eksik kalan tutar da hesaplanıyor. */
function sutunBrutlestirme() {
  var W0 = 600, H0 = 360, P0 = 30;
  var hedefNet = 10000, oran = 0.20;
  var dogru = hedefNet / (1 - oran);          /* 12.500 */
  var yanlis = hedefNet * (1 + oran);         /* 12.000 */
  var yanlisNet = yanlis * (1 - oran);        /*  9.600 */
  var eksik = hedefNet - yanlisNet;           /*    400 */

  /* Çubuklar bilerek aşağıda: ilk denemede en uzun çubuğun "brüt" etiketi
     üstteki alt başlığa biniyordu (kapak render edilip görüldü). */
  var W = W0, taban = 300, enY = 170, enBuyuk = dogru;
  var sut = [
    { ad: "brüt = net ÷ 0,80", brut: dogru, net: hedefNet, x: 96, dogruMu: true },
    { ad: "brüt = net × 1,20", brut: yanlis, net: yanlisNet, x: 336, dogruMu: false }
  ];
  var gen = 168;

  function tl(v) { return v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL"; }

  var ic = sut.map(function (s) {
    var h = Math.round(enY * s.brut / enBuyuk);
    var hNet = Math.round(enY * s.net / enBuyuk);
    var y = taban - h, yNet = taban - hNet;
    var netRenk = s.dogruMu ? R.marka : R.s2;
    return '<rect x="' + s.x + '" y="' + y + '" width="' + gen + '" height="' + h +
        '" rx="4" fill="' + R.ikincil + '" fill-opacity="0.28"/>' +
      '<rect x="' + s.x + '" y="' + yNet + '" width="' + gen + '" height="' + hNet +
        '" rx="4" fill="' + netRenk + '"/>' +
      '<text x="' + (s.x + gen / 2) + '" y="' + (y - 26) + '" text-anchor="middle" ' +
        'font-size="21" font-weight="800" fill="' + R.murekkep + '">' + tl(s.brut) + "</text>" +
      '<text x="' + (s.x + gen / 2) + '" y="' + (y - 8) + '" text-anchor="middle" ' +
        'font-size="13" fill="' + R.ikincil + '">brüt</text>' +
      '<text x="' + (s.x + gen / 2) + '" y="' + (yNet + hNet / 2 + 6) + '" text-anchor="middle" ' +
        'font-size="17" font-weight="800" fill="#ffffff">' + tl(s.net) + "</text>" +
      '<text x="' + (s.x + gen / 2) + '" y="' + (taban + 24) + '" text-anchor="middle" ' +
        'font-size="15" font-weight="700" fill="' + (s.dogruMu ? R.marka : R.s2) + '">' +
        esc(s.ad) + "</text>";
  }).join("");

  return '<svg viewBox="0 0 ' + W + " " + H0 + '" role="img" aria-label="Net 10.000 TL ' +
    'icin dogru brut 12.500 TL, yaygin yanlis yontemle 12.000 TL ve 400 TL eksik">' +
    '<text x="' + P0 + '" y="40" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">Hedef: elimde net 10.000 TL kalsın · %20 stopaj</text>' +
    '<text x="' + P0 + '" y="64" font-size="15" fill="' + R.ikincil +
      '">Koyu alan elinize geçen tutar</text>' + ic +
    '<text x="' + (336 + 168 / 2) + '" y="' + (taban + 48) + '" text-anchor="middle" ' +
      'font-size="15" font-weight="700" fill="' + R.s2 + '">' + tl(eksik) + " eksik</text></svg>";
}

/* Zam farkı eğrisi — "zam nete ne kadar yansır" kapağı.
   Yazının tezi tek bir grafikte: %30 brüt zamın nete kaç puan eksik yansıdığı
   maaşa göre değişiyor ve SGK tavanı civarında SIFIRIN ALTINA iniyor.
   Değerler zam çekirdeğinden hesaplanıyor; tabloyla ayrışması imkânsız. */
function cizgiZamFark() {
  var Z = require(path.join(KOK, "zam-hesaplama", "hesap.js"));
  var brutler = [33030, 40000, 60000, 80000, 100000, 120000, 150000,
                 200000, 250000, 280000, 297270, 320000, 350000, 400000];
  var veri = brutler.map(function (b) {
    return { b: b, f: Z.zam({ eskiBrut: b, zamYuzde: 30, yil: 2026 }).farkPuan };
  });

  var W = 600, H = 360, P = 30;
  var altB = brutler[0], ustB = brutler[brutler.length - 1];
  var enAz = -3, enCok = 8.5;
  var x = function (b) { return P + (b - altB) / (ustB - altB) * (W - 2 * P - 8); };
  var y = function (f) { return 96 + (enCok - f) / (enCok - enAz) * (H - 96 - 46); };

  var d = veri.map(function (v, i) {
    return (i ? "L" : "M") + x(v.b).toFixed(1) + " " + y(v.f).toFixed(1);
  }).join(" ");

  /* Sıfır çizgisi: farkın işaret değiştirdiği yer. */
  var y0 = y(0);
  var tavanX = x(297270);

  /* En büyük kayıp ve işaretin döndüğü nokta işaretleniyor. */
  var enKotu = veri.reduce(function (a, b) { return b.f > a.f ? b : a; });
  var eksi = veri.filter(function (v) { return v.f < 0; })[0];

  function nokta(v, renk) {
    return '<circle cx="' + x(v.b).toFixed(1) + '" cy="' + y(v.f).toFixed(1) +
      '" r="6.5" fill="' + renk + '" stroke="' + R.zemin + '" stroke-width="2.5"/>';
  }

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="%30 brut zammin ' +
    'nete kac puan eksik yansidigi, maasa gore; SGK tavani civarinda sifirin altina iniyor">' +
    '<text x="' + P + '" y="34" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">%30 brüt zam nete kaç puan eksik yansıyor?</text>' +
    '<text x="' + P + '" y="56" font-size="15" fill="' + R.ikincil +
      '">Aynı zam, farklı maaşlar · 2026</text>' +
    /* sıfırın altı: net artış brütü geçiyor */
    '<rect x="' + P + '" y="' + y0 + '" width="' + (W - 2 * P - 8) + '" height="' +
      Math.max(0, H - 46 - y0) + '" fill="' + R.s3 + '" fill-opacity="0.10"/>' +
    '<line x1="' + P + '" y1="' + y0 + '" x2="' + (W - P - 8) + '" y2="' + y0 +
      '" stroke="' + R.murekkep + '" stroke-width="1.4"/>' +
    '<line x1="' + tavanX.toFixed(1) + '" y1="90" x2="' + tavanX.toFixed(1) + '" y2="' +
      (H - 46) + '" stroke="' + R.ikincil + '" stroke-width="1" stroke-dasharray="4 4"/>' +
    '<path d="' + d + '" fill="none" stroke="' + R.marka +
      '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    nokta(enKotu, R.s2) + (eksi ? nokta(eksi, R.s3) : "") +
    '<text x="' + (x(enKotu.b) + 10) + '" y="' + (y(enKotu.f) + 5) + '" font-size="14" ' +
      'font-weight="700" fill="' + R.s2 + '">' + enKotu.f.toFixed(2).replace(".", ",") +
      " puan kayıp</text>" +
    /* Etiket noktanın SOLUNA yaslı: ortalanınca SGK tavanı kesikli çizgisini
       kesiyordu (kapak render edilip görüldü). */
    (eksi ? '<text x="' + (x(eksi.b) - 12) + '" y="' + (y(eksi.f) + 24) + '" font-size="14" ' +
      'font-weight="700" text-anchor="end" fill="' + R.s3 +
      '">burada işaret dönüyor</text>' : "") +
    '<text x="' + (tavanX - 6).toFixed(1) + '" y="86" font-size="12" text-anchor="end" fill="' +
      R.ikincil + '">SGK tavanı</text>' +
    '<text x="' + P + '" y="' + (H - 12) + '" font-size="13" fill="' + R.ikincil +
      '">33 bin TL brüt</text>' +
    '<text x="' + (W - P - 8) + '" y="' + (H - 12) + '" font-size="13" text-anchor="end" fill="' +
      R.ikincil + '">400 bin TL</text>' +
    "</svg>";
}

/* Vergi kaması eğrisi — "ücretin gerçek yükü" kapağı.
   Yazının bulgusu tek grafikte: ortalama kama prim tavanına kadar yükselip
   ORADA ZİRVE YAPIYOR ve sonra düşüyor. Değerler bordro motorundan
   hesaplanıyor. Aralık 600 bin TL'de kesiliyor: tümsek bu aralıkta tamamen
   görünüyor ve doğrusal eksen bozulmadan okunabiliyor. */
function cizgiKama() {
  var noktalar = [33030, 50000, 75000, 100000, 150000, 200000, 250000,
                  297270, 350000, 420000, 500000, 600000];
  var veri = noktalar.map(function (b) {
    var r = B.hesaplaYil(b, 2026);
    return { b: b, k: (r.toplam.isverenMaliyeti - r.toplam.net) / r.toplam.isverenMaliyeti * 100 };
  });

  var W = 600, H = 360, P = 30;
  var altB = noktalar[0], ustB = noktalar[noktalar.length - 1];
  var enAz = 28, enCok = 54;
  var x = function (b) { return P + (b - altB) / (ustB - altB) * (W - 2 * P - 10); };
  var y = function (k) { return 104 + (enCok - k) / (enCok - enAz) * (H - 104 - 46); };

  var d = veri.map(function (v, i) {
    return (i ? "L" : "M") + x(v.b).toFixed(1) + " " + y(v.k).toFixed(1);
  }).join(" ");

  var zirve = veri.reduce(function (a, b) { return b.k > a.k ? b : a; });
  var bas = veri[0], son = veri[veri.length - 1];

  var izgara = [30, 40, 50].map(function (t) {
    return '<line x1="' + P + '" y1="' + y(t) + '" x2="' + (W - P - 10) + '" y2="' + y(t) +
      '" stroke="' + R.izgara + '" stroke-width="1"/>' +
      '<text x="' + (W - P - 6) + '" y="' + (y(t) + 4) + '" font-size="11" fill="' +
      R.ikincil + '">%' + t + "</text>";
  }).join("");

  function nokta(v, renk, r) {
    return '<circle cx="' + x(v.b).toFixed(1) + '" cy="' + y(v.k).toFixed(1) +
      '" r="' + r + '" fill="' + renk + '" stroke="' + R.zemin + '" stroke-width="2.5"/>';
  }

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Ortalama vergi ' +
    'kamasi prim tavanina kadar yukseliyor, tavanda yuzde 51 ile zirve yapip dusuyor">' +
    '<text x="' + P + '" y="36" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">İşveren maliyetinin yüzde kaçı vergi ve prim?</text>' +
    '<text x="' + P + '" y="58" font-size="15" fill="' + R.ikincil +
      '">Ortalama vergi kaması · 2026</text>' +
    izgara +
    '<line x1="' + x(zirve.b).toFixed(1) + '" y1="' + (y(zirve.k) - 6) + '" x2="' +
      x(zirve.b).toFixed(1) + '" y2="' + (H - 46) + '" stroke="' + R.ikincil +
      '" stroke-width="1" stroke-dasharray="4 4"/>' +
    '<path d="' + d + '" fill="none" stroke="' + R.marka +
      '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    nokta(zirve, R.s2, 7) + nokta(bas, R.marka, 5.5) + nokta(son, R.marka, 5.5) +
    '<text x="' + x(zirve.b).toFixed(1) + '" y="' + (y(zirve.k) - 16) +
      '" text-anchor="middle" font-size="17" font-weight="800" fill="' + R.s2 + '">%' +
      zirve.k.toFixed(1).replace(".", ",") + "</text>" +
    '<text x="' + x(zirve.b).toFixed(1) + '" y="' + (H - 28) +
      '" text-anchor="middle" font-size="12" fill="' + R.ikincil + '">prim tavanı</text>' +
    '<text x="' + (x(bas.b) - 2) + '" y="' + (y(bas.k) + 22) + '" font-size="13" fill="' +
      R.ikincil + '">asgari ücret · %' + bas.k.toFixed(1).replace(".", ",") + "</text>" +
    '<text x="' + (W - P - 10) + '" y="' + (y(son.k) + 24) + '" text-anchor="end" ' +
      'font-size="13" fill="' + R.ikincil + '">600 bin TL · %' +
      son.k.toFixed(1).replace(".", ",") + "</text>" +
    "</svg>";
}

/* OTV basamagi — "otv-basamak-etkisi" kapagi.
   Iki sutun: esikteki arac ve esigin bir lira ustundeki arac. Aralarindaki
   bosluk, hicbir aracin fiyatlanamayacagi olu aralik. Tutarlar tarife
   modulunden hesaplaniyor. */
function basamakOtv() {
  var W = 600, H = 360, P = 34;

  /* Tarifedeki her eşik bir ÖLÜ ARALIK doğurur: eşikteki aracın anahtar
     teslim fiyatı ile bir lira fazlasının fiyatı arasında kalan bant.
     O bandı hiçbir araç dolduramaz — satıcı oraya fiyat verse, alıcı
     aynı parayla eşikteki aracı alır. */
  function araliklar(s, ad) {
    return s.esik.map(function (e, i) {
      return {
        ad: ad,
        alt: e * (1 + s.oran[i] / 100) * (1 + OTV.KDV),
        ust: e * (1 + s.oran[i + 1] / 100) * (1 + OTV.KDV)
      };
    });
  }
  var seriler = [
    { ad: "Elektrikli, ≤160 kW", s: OTV.BEV_ALT, renk: R.marka },
    { ad: "Şarj edilebilir hibrit", s: OTV.PHEV_1600, renk: R.s3 },
    { ad: "Benzin/dizel 1401–1600 cm³", s: OTV.ICTEN_1600, renk: R.s1 },
    { ad: "Benzin/dizel ≤1400 cm³", s: OTV.ICTEN_1400, renk: R.s2 }
  ];

  var enBuyuk = 0;
  seriler.forEach(function (g) {
    araliklar(g.s, g.ad).forEach(function (a) { if (a.ust > enBuyuk) enBuyuk = a.ust; });
  });
  var ustSinir = Math.ceil(enBuyuk / 500000) * 500000;

  var solX = P + 158, sagX = W - P - 8;
  function xOf(v) { return solX + (v / ustSinir) * (sagX - solX); }
  function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }

  var y0 = 96, yH = 26, ara = 24;

  /* Eksen çizgileri: her 1 milyon bir işaret. */
  var izgara = "";
  for (var v = 0; v <= ustSinir; v += 1000000) {
    izgara += '<line x1="' + xOf(v) + '" y1="' + (y0 - 12) + '" x2="' + xOf(v) +
      '" y2="' + (y0 + seriler.length * (yH + ara) - ara + 6) +
      '" stroke="' + R.izgara + '" stroke-width="1"/>' +
      '<text x="' + xOf(v) + '" y="' + (y0 - 20) + '" text-anchor="middle" ' +
      'font-size="12" fill="' + R.ikincil + '">' + (v / 1000000) + (v ? " mn" : "") + "</text>";
  }

  var enGenis = null;
  var ic = seriler.map(function (g, i) {
    var yy = y0 + i * (yH + ara);
    var blok = araliklar(g.s, g.ad).map(function (a) {
      if (!enGenis || a.ust - a.alt > enGenis.ust - enGenis.alt) {
        enGenis = { alt: a.alt, ust: a.ust, y: yy, renk: g.renk };
      }
      return '<rect x="' + xOf(a.alt) + '" y="' + yy + '" width="' +
        Math.max(2, xOf(a.ust) - xOf(a.alt)) + '" height="' + yH +
        '" fill="' + g.renk + '"/>';
    }).join("");
    return '<line x1="' + solX + '" y1="' + (yy + yH / 2) + '" x2="' + sagX +
      '" y2="' + (yy + yH / 2) + '" stroke="' + R.murekkep +
      '" stroke-width="1.5" stroke-opacity="0.30"/>' + blok +
      '<text x="' + (solX - 12) + '" y="' + (yy + yH / 2 + 5) + '" text-anchor="end" ' +
      'font-size="13" font-weight="700" fill="' + R.murekkep + '">' + esc(g.ad) + "</text>";
  }).join("");

  /* En geniş aralık ayrıca yazılıyor: rakam olmadan blok soyut kalır. */
  var vurgu = "";
  if (enGenis) {
    var oy = enGenis.y + yH + 15;
    var metin = tl(enGenis.ust - enGenis.alt) + " TL genişliğinde";
    var tahminiEn = metin.length * 7.2;          // 13px yarı-kalın için kaba genişlik
    var ox = Math.min(xOf(enGenis.alt), sagX - tahminiEn);
    vurgu = '<text x="' + ox + '" y="' + oy + '" font-size="13" ' +
      'font-weight="800" fill="' + enGenis.renk + '">' + esc(metin) + "</text>";
  }

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Anahtar teslim ' +
    'fiyat ekseni üzerinde ÖTV eşiklerinin doğurduğu boş aralıklar; en genişi ' +
    (enGenis ? tl(enGenis.ust - enGenis.alt) : "") + ' lira">' +
    '<text x="' + P + '" y="38" font-size="18" font-weight="700" fill="' + R.murekkep +
      '">Anahtar teslim fiyatta boş kalan aralıklar</text>' +
    '<text x="' + P + '" y="60" font-size="14" fill="' + R.ikincil +
      '">ÖTV kademeli değil; eşik aşılınca üst oran matrahın tamamına uygulanır</text>' +
    izgara + ic + vurgu +
    '<text x="' + P + '" y="' + (H - 22) + '" font-size="13" fill="' + R.ikincil +
      '">Renkli bantlarda satılan sıfır otomobil yoktur: aynı parayla bir alttaki araç alınır.</text>' +
    "</svg>";
}

/* Iki katmanli hafta — "fazla-mesai-zammi-yuzde-kac" kapagi.
   40 saatlik sozlesmeyle 48 saat calisan birinin haftasi: 40'a kadar
   normal, 40-45 arasi %25, 45 ustu %50. Ortadaki bolge yazinin konusu. */
function katmanliHafta() {
  var W = 600, H = 360, P = 34;
  var P26 = (BORDRO.parametreler || BORDRO)["2026"];
  var F = P26.fazlaMesai;
  var brut = 60000, saatlik = brut / F.aylikSaat;

  var SOZ = 40, YASAL = 45, CALISILAN = 48;
  var bolge = [
    { ad: "Normal çalışma", bas: 0, bit: SOZ, renk: R.izgara, ink: R.ikincil, oran: null },
    { ad: "Fazla sürelerle", bas: SOZ, bit: YASAL, renk: R.s1, ink: R.s1,
      oran: F.fazlaSureliKat },
    { ad: "Fazla çalışma", bas: YASAL, bit: CALISILAN, renk: R.s2, ink: R.s2,
      oran: F.fazlaCalismaKat }
  ];

  function tl(n) {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  var solX = P, sagX = W - P, barY = 150, barH = 54;
  function xOf(saat) { return solX + (saat / CALISILAN) * (sagX - solX); }

  var cubuk = bolge.map(function (b) {
    return '<rect x="' + xOf(b.bas) + '" y="' + barY + '" width="' +
      (xOf(b.bit) - xOf(b.bas) - 2) + '" height="' + barH +
      '" fill="' + b.renk + '"/>';
  }).join("");

  /* Saat isaretleri: sozlesme suresi ve yasal sinir. */
  var isaret = [SOZ, YASAL, CALISILAN].map(function (saat) {
    return '<line x1="' + xOf(saat) + '" y1="' + (barY - 10) + '" x2="' + xOf(saat) +
      '" y2="' + (barY + barH + 10) + '" stroke="' + R.murekkep +
      '" stroke-width="1" stroke-opacity="0.35"/>' +
      '<text x="' + xOf(saat) + '" y="' + (barY - 16) + '" text-anchor="middle" ' +
      'font-size="13" font-weight="700" fill="' + R.murekkep + '">' + saat + ' sa</text>';
  }).join("");

  /* Tutarlar cubugun ALTINDA LISTE olarak. Once bolgelerin altina
     yazilmisti; zamli bolgeler haftanin 5/48 ve 3/48'i oldugu icin
     etiketler cakisiyordu. Cubuk dogrusal kalmali -- saat gosteriyor --
     o yuzden tasinan sey etiket. Lejant da kalkti: her satir kendi renk
     kutusunu tasiyor. */
  var satirY = barY + barH + 40;
  var zamli = bolge.filter(function (b) { return b.oran; });
  var etiket = zamli.map(function (b, i) {
    var saat = b.bit - b.bas;
    var tutar = saatlik * b.oran * saat;
    var yy = satirY + i * 30;
    return '<rect x="' + solX + '" y="' + (yy - 11) + '" width="12" height="12" fill="' +
      b.renk + '"/>' +
      '<text x="' + (solX + 20) + '" y="' + yy + '" font-size="14" fill="' + R.murekkep +
      '">' + b.bas + '–' + b.bit + ' sa · ' + esc(b.ad) + ' · ' +
      saat + ' saat</text>' +
      '<text x="' + (solX + 300) + '" y="' + yy + '" font-size="15" font-weight="800" fill="' +
      b.ink + '">%' + Math.round((b.oran - 1) * 100) + '</text>' +
      '<text x="' + sagX + '" y="' + yy + '" text-anchor="end" font-size="15" ' +
      'font-weight="700" fill="' + R.murekkep + '">' + tl(tutar) + ' TL</text>';
  }).join("");

  var toplam = zamli.reduce(function (a, b) {
    return a + saatlik * b.oran * (b.bit - b.bas);
  }, 0);
  var toplamY = satirY + zamli.length * 30 + 10;
  etiket += '<line x1="' + solX + '" y1="' + (toplamY - 21) + '" x2="' + sagX +
    '" y2="' + (toplamY - 21) + '" stroke="' + R.izgara + '" stroke-width="1"/>' +
    '<text x="' + (solX + 20) + '" y="' + toplamY + '" font-size="14" fill="' +
    R.ikincil + '">8 saatin brüt karşılığı</text>' +
    '<text x="' + sagX + '" y="' + toplamY + '" text-anchor="end" font-size="16" ' +
    'font-weight="800" fill="' + R.marka + '">' + tl(toplam) + ' TL</text>';

  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="40 saatlik ' +
    'sözleşmeyle 48 saat çalışılan hafta üç bölgeye ayrılır: 40 saate kadar normal, ' +
    '40-45 arası yüzde 25 zamlı, 45 saat üstü yüzde 50 zamlı">' +
    '<text x="' + P + '" y="40" font-size="19" font-weight="700" fill="' + R.murekkep +
      '">40 saatlik sözleşme, 48 saat çalışılan hafta</text>' +
    '<text x="' + P + '" y="64" font-size="15" fill="' + R.ikincil +
      '">Zam oranını ne kadar çalıştığınız değil, sözleşmedeki süre belirler</text>' +
    '<text x="' + P + '" y="' + (barY - 44) + '" font-size="14" fill="' + R.ikincil +
      '">60.000 TL brüt · saat ücreti ' + tl(saatlik) + ' TL</text>' +
    cubuk + isaret + etiket + "</svg>";
}

function chromeBul() {
  for (var i = 0; i < CHROME.length; i++) {
    if (fs.existsSync(CHROME[i])) return CHROME[i];
  }
  return null;
}

function uret(chrome, slug, kart) {
  var k = KAPAKLAR[slug];
  var fs_ = k.baslik.length <= 22 ? 52 : (k.baslik.length <= 30 ? 46 : 40);
  var doc = kart
    ? KART_SABLON.replace("{svg}", k.cizim())
    : SABLON
      .replace("{fs}", fs_)
      .replace("{kicker}", esc(k.kicker))
      .replace("{baslik}", esc(k.baslik))
      .replace("{alt}", esc(k.alt))
      .replace("{svg}", k.cizim());

  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "makale-"));
  var src = path.join(tmp, "k.html");
  var out = path.join(tmp, "shot.png");
  fs.writeFileSync(src, doc, "utf8");
  try {
    execFileSync(chrome, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars",
      "--force-device-scale-factor=1", "--window-size=" + (kart ? "800,500" : "1200,630"),
      "--screenshot=" + out, "--user-data-dir=" + path.join(tmp, "u"),
      "file:///" + src.replace(/\\/g, "/")
    ], { timeout: 90000, stdio: "ignore" });
  } catch (e) { /* chrome bazen sifir olmayan kod dondurur; ciktiya bakariz */ }

  if (!fs.existsSync(out)) { console.error("   HATA: " + slug + " uretilemedi"); return false; }
  if (!fs.existsSync(CIKTI)) fs.mkdirSync(CIKTI, { recursive: true });
  var hedef = path.join(CIKTI, slug + (kart ? "-kart" : "") + ".png");
  fs.copyFileSync(out, hedef);
  console.log("   " + path.basename(hedef).padEnd(42) + fs.statSync(hedef).size + " bayt");
  return true;
}

function main() {
  var arg = process.argv.slice(2).filter(function (a) { return a.charAt(0) !== "-"; });
  if (process.argv.indexOf("--list") !== -1) {
    Object.keys(KAPAKLAR).forEach(function (s) { console.log(s); });
    return 0;
  }
  var chrome = chromeBul();
  if (!chrome) { console.error("Chrome bulunamadi."); return 2; }
  var hedefler = arg.length ? arg : Object.keys(KAPAKLAR);
  var ok = 0;
  hedefler.forEach(function (s) {
    if (!KAPAKLAR[s]) { console.error("Bilinmeyen kapak: " + s); return; }
    if (uret(chrome, s, false) && uret(chrome, s, true)) ok++;
  });
  console.log("\nUretilen: " + ok + " / " + hedefler.length);
  return ok === hedefler.length ? 0 : 1;
}

process.exit(main());
