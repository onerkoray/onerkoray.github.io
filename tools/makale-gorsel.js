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
  var SERI = require(path.join(KOK, "finans", "endeksleme-serileri.js"));
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

/* Dip ayinin brute gore yurumesi -- "yilin-en-dusuk-maasi-hangi-ay" kapagi.
   Bulgu bir BASAMAK: brut yukseldikce netin dibe vurdugu ay geriye
   yuruyor, uc yerde Aralik'a siciriyor. Cubuk da cizgi de bunu
   anlatamaz; basamak fonksiyonu bilginin kendi seklidir.

   Tek seri oldugu icin marka rengi kullanilabilir. Yatay eksen brut,
   dikey eksen ay: Aralik ustte, Mayis altta -- boylece "geriye yurume"
   asagi dogru inis olarak okunuyor. */
function dipAyBasamagi() {
  var W = 600, H = 360, SOL = 96, SAG = 572, UST = 118, ALT = 286;
  var D = require(path.join(KOK, "makaleler", "yilin-en-dusuk-maasi-hangi-ay", "dip-ay.js"));
  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  var bantlar = D.bantlar();
  var x0 = D.baslangic(), x1 = D.ADIM_SON;
  /* Dikey eksende yalnizca gorulen aylar var: Mayis(4) - Aralik(11). */
  var AY_UST = 11, AY_ALT = 4;

  function x(b) { return SOL + (SAG - SOL) * ((b - x0) / (x1 - x0)); }
  function y(ay) { return UST + (ALT - UST) * ((AY_UST - ay) / (AY_UST - AY_ALT)); }

  /* Basamak yolu: her bant icin yatay parca, aralarinda dikey sicrama. */
  var yol = [], onceki = null;
  bantlar.forEach(function (b) {
    var yy = y(b.dipAy).toFixed(1);
    if (onceki === null) yol.push("M" + x(b.bas).toFixed(1) + " " + yy);
    else yol.push("L" + x(b.bas).toFixed(1) + " " + yy);
    yol.push("L" + x(b.son).toFixed(1) + " " + yy);
    onceki = b;
  });

  /* Yatay izgara: her ay icin ince bir cizgi ve sol etiket. */
  var izgara = "";
  for (var a = AY_ALT; a <= AY_UST; a++) {
    izgara += '<path d="M' + SOL + " " + y(a).toFixed(1) + " H" + SAG +
      '" stroke="' + R.izgara + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 10) + '" y="' + (y(a) + 5).toFixed(1) +
      '" font-size="14" fill="' + R.ikincil + '" text-anchor="end">' +
      AY_KISA[a] + "</text>";
  }

  /* Sicrama noktalari: dip ayinin Aralik'a geri dondugu brutler. */
  var isaret = "";
  D.sifirlamalar().forEach(function (b) {
    isaret += '<circle cx="' + x(b).toFixed(1) + '" cy="' + y(11).toFixed(1) +
      '" r="5" fill="' + R.s2 + '"/>';
  });

  function eksenEtiketi(b) {
    return '<text x="' + x(b).toFixed(1) + '" y="' + (ALT + 24) +
      '" font-size="14" fill="' + R.ikincil + '" text-anchor="middle">' +
      Math.round(b / 1000) + "b</text>";
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="Brüt ücret yükseldikçe netin dibe ' +
    'vurduğu ayın geriye yürümesi ve üç noktada Aralık’a sıçraması">' +
    '<text x="24" y="34" font-size="16" fill="' + R.ikincil +
    '">' + D.YIL + " · " + new Intl.NumberFormat("tr-TR").format(D.tarama().length) +
    ' brüt ücret taranmıştır</text>' +
    '<text x="24" y="84" font-size="34" font-weight="800" fill="' + R.murekkep +
    '">Dip ayı geriye yürüyor</text>' +
    izgara +
    '<path d="' + yol.join(" ") + '" fill="none" stroke="' + R.marka +
    '" stroke-width="3" stroke-linejoin="round"/>' +
    isaret +
    eksenEtiketi(x0) + eksenEtiketi(150000) + eksenEtiketi(300000) +
    eksenEtiketi(450000) + eksenEtiketi(x1) +
    '<text x="24" y="' + (H - 18) + '" font-size="15" fill="' + R.ikincil +
    '">Yatay eksen: aylık brüt ücret (bin TL) · nokta: dibin Aralık’a döndüğü eşik</text>' +
    "</svg>";
}

/* Emekli promosyonu — kişisel net fayda. Yazının modeli: A 18.000 TL
   nakit; B 24.000 TL nakit + puan − 8.200 TL ek maliyet (7.000 ekonomik ek
   tüketim + 1.200 ürün/işlem gideri). Puanın kullanılabilir değeri 0 /
   3.000 / 6.000. Rakamlar yazının sayi-testi.js'iyle aynı modelden. */
function promosyonNetDeger() {
  var EK = 7000 + 1200, B_NAKIT = 24000;
  var veri = [
    { ad: "A · sade", alt: "18.000 nakit", v: 18000, renk: R.s1 },
    { ad: "B · puan yok", alt: "24.000 − 8.200", v: B_NAKIT - EK, renk: R.s2 },
    { ad: "B · yarısı", alt: "+ 3.000 puan", v: B_NAKIT + 3000 - EK, renk: R.s2 },
    { ad: "B · tamamı", alt: "+ 6.000 puan", v: B_NAKIT + 6000 - EK, renk: R.s2 }
  ];
  var W = 600, H = 360, P = 28, TY = 290, TAVAN = 24000, BOY = 190;
  var gen = (W - 2 * P) / veri.length;
  var cubuk = veri.map(function (d, i) {
    var h = d.v / TAVAN * BOY, x0 = P + i * gen + 22, w = gen - 44, cx = x0 + w / 2;
    return '<rect x="' + x0.toFixed(1) + '" y="' + (TY - h).toFixed(1) + '" width="' + w.toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="3" fill="' + d.renk + '"/>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (TY - h - 10).toFixed(1) +
      '" text-anchor="middle" font-size="16" font-weight="800" fill="' + R.murekkep + '">' +
      nf0.format(d.v) + '</text>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (TY + 22) + '" text-anchor="middle" font-size="14" ' +
      'font-weight="700" fill="' + R.murekkep + '">' + esc(d.ad) + '</text>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (TY + 40) + '" text-anchor="middle" font-size="12" fill="' +
      R.ikincil + '">' + esc(d.alt) + '</text>';
  }).join("");
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Sade teklif 18.000 TL net fayda verirken puanlı teklif puan kullanımına göre ' +
    '15.800, 18.800 veya 21.800 TL bırakıyor">' +
    '<text x="' + P + '" y="40" font-size="16" font-weight="700" fill="' + R.murekkep +
    '">Kişisel net fayda, bugünün TL’siyle</text>' +
    '<text x="' + P + '" y="62" font-size="13" fill="' + R.ikincil +
    '">Aynı 36 ay · varsayımsal teklifler · B’de 8.200 TL ek maliyet</text>' +
    '<line x1="' + P + '" y1="' + TY + '" x2="' + (W - P) + '" y2="' + TY +
    '" stroke="' + R.izgara + '" stroke-width="1.5"/>' + cubuk + '</svg>';
}

/* Ciro yazısı — kâr–nakit köprüsü. Varsayımlar yazının sayi-testi.js'iyle
   aynı: 1.000.000 TL satış, %70 SMM, 150.000 TL gider; alacak +400, stok
   +100, ticari borç +200 bin TL. Artı adım mavi, eksi adım turuncu; sonuç
   çubuğu mürekkep: akış değil, varılan yer. */
function kariNakitKoprusu() {
  var SATIS = 1000000, SMM = 700000, GIDER = 150000;
  var kar = (SATIS - SMM - GIDER) / 1000;
  var adimlar = [
    { ad: "Faaliyet", ad2: "kârı", v: kar },
    { ad: "Alacak", ad2: "artışı", v: -400 },
    { ad: "Stok", ad2: "artışı", v: -100 },
    { ad: "Ticari borç", ad2: "artışı", v: 200 }
  ];
  var net = adimlar.reduce(function (t, a) { return t + a.v; }, 0);
  var W = 600, H = 360, SOL = 56, SAG = 580, UST = 104, ALT = 286, UST_V = 200, ALT_V = -400;
  function y(v) { return UST + (ALT - UST) * ((UST_V - v) / (UST_V - ALT_V)); }
  function isaretli(v) { return (v > 0 ? "+" : v < 0 ? "\u2212" : "") + nf0.format(Math.abs(v)); }
  var gen = (SAG - SOL) / 5, w = 54;

  var izgara = [200, 0, -200, -400].map(function (v) {
    return '<path d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '" stroke="' +
      (v === 0 ? R.ikincil : R.izgara) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" font-size="12" fill="' +
      R.ikincil + '" text-anchor="end">' + isaretli(v) + "</text>";
  }).join("");

  var duzey = 0, cubuk = "";
  adimlar.concat([{ ad: "Net nakit", ad2: "değişimi", v: net, toplam: true }]).forEach(function (a, i) {
    var bas = a.toplam ? 0 : duzey, son = a.toplam ? net : duzey + a.v;
    var cx = SOL + gen * (i + 0.5), ust = Math.min(y(bas), y(son)), boy = Math.abs(y(bas) - y(son));
    var renk = a.toplam ? R.murekkep : (a.v >= 0 ? R.s1 : R.s2);
    cubuk += '<rect x="' + (cx - w / 2).toFixed(1) + '" y="' + ust.toFixed(1) + '" width="' + w +
      '" height="' + boy.toFixed(1) + '" rx="3" fill="' + renk + '"/>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (ust - 8).toFixed(1) + '" text-anchor="middle" font-size="16" ' +
      'font-weight="800" fill="' + R.murekkep + '">' + isaretli(a.v) + "</text>" +
      '<text x="' + cx.toFixed(1) + '" y="' + (ALT + 26) + '" text-anchor="middle" font-size="13" ' +
      'font-weight="700" fill="' + R.murekkep + '">' + esc(a.ad) + "</text>" +
      '<text x="' + cx.toFixed(1) + '" y="' + (ALT + 42) + '" text-anchor="middle" font-size="12" fill="' +
      R.ikincil + '">' + esc(a.ad2) + "</text>";
    if (!a.toplam && i < 3) {
      cubuk += '<path d="M' + (cx + w / 2).toFixed(1) + " " + y(son).toFixed(1) + " H" +
        (cx + gen - w / 2).toFixed(1) + '" stroke="' + R.ikincil + '" stroke-width="1" stroke-dasharray="3 3"/>';
    }
    duzey = son;
  });
  if (net !== -150) throw new Error("kâr–nakit köprüsü yazıyla ayrıştı: " + net);

  function anahtar(x, renk, metin) {
    return '<rect x="' + x + '" y="72" width="11" height="11" rx="2" fill="' + renk + '"/>' +
      '<text x="' + (x + 17) + '" y="82" font-size="12" fill="' + R.ikincil + '">' + metin + "</text>";
  }
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Faaliyet kârı artı 150 bin TL; alacak, stok ve ticari borç ' +
    'değişimlerinden sonra net nakit değişimi eksi 150 bin TL">' +
    '<text x="24" y="34" font-size="16" font-weight="700" fill="' + R.murekkep +
    '">Kâr var, nakit azalıyor</text>' +
    '<text x="24" y="56" font-size="13" fill="' + R.ikincil +
    '">Temsili ay · bin TL · vergi, faiz ve yatırım yok</text>' +
    anahtar(24, R.s1, "nakdi artırır") + anahtar(128, R.s2, "nakdi azaltır") +
    anahtar(232, R.murekkep, "ay sonu sonucu") +
    izgara + cubuk + "</svg>";
}

/* Enflasyon yazısı — sabit sepet. Oran %40'tan %20'ye yarıya iniyor, ama
   ikinci artış yükselmiş düzeye uygulandığı için TL artışı yalnız 400'den
   280'e düşüyor. Çubuk iki parça: önceki fiyat (mavi) + yılın artışı
   (turuncu). Rakamlar yazının sayi-testi.js'iyle aynı. */
function sepetOranDuzey() {
  var BAS = 1000, ORAN = [0.40, 0.20];
  var d1 = BAS * (1 + ORAN[0]), d2 = d1 * (1 + ORAN[1]);
  var veri = [
    { ad: "Başlangıç", ad2: "", onceki: BAS, artis: 0 },
    { ad: "1. yıl sonu", ad2: "enflasyon %" + Math.round(ORAN[0] * 100), onceki: BAS, artis: d1 - BAS },
    { ad: "2. yıl sonu", ad2: "enflasyon %" + Math.round(ORAN[1] * 100), onceki: d1, artis: d2 - d1 }
  ];
  if (Math.round(d2) !== 1680 || Math.round((d2 / BAS - 1) * 100) !== 68) throw new Error("sepet yazıyla ayrıştı");
  var W = 600, H = 360, SOL = 40, SAG = 580, UST = 104, ALT = 286, TAVAN = 1800;
  function y(v) { return ALT - (ALT - UST) * (v / TAVAN); }
  var gen = (SAG - SOL) / 3, w = 72;
  var cubuk = "";
  veri.forEach(function (d, i) {
    var cx = SOL + gen * (i + 0.5), x0 = cx - w / 2, top = d.onceki + d.artis;
    cubuk += '<rect x="' + x0.toFixed(1) + '" y="' + y(d.onceki).toFixed(1) + '" width="' + w +
      '" height="' + (ALT - y(d.onceki)).toFixed(1) + '" rx="3" fill="' + R.s1 + '"/>';
    if (d.artis) {
      // 2px zemin boşluğu: iki parça tek blok gibi okunmasın.
      cubuk += '<rect x="' + x0.toFixed(1) + '" y="' + y(top).toFixed(1) + '" width="' + w +
        '" height="' + (y(d.onceki) - y(top) - 2).toFixed(1) + '" rx="3" fill="' + R.s2 + '"/>' +
        '<text x="' + (x0 + w + 10).toFixed(1) + '" y="' + ((y(top) + y(d.onceki)) / 2 + 5).toFixed(1) +
        '" font-size="14" font-weight="800" fill="' + R.murekkep + '">+' + nf0.format(d.artis) + " TL</text>";
    }
    cubuk += '<text x="' + cx.toFixed(1) + '" y="' + (y(top) - 10).toFixed(1) + '" text-anchor="middle" ' +
      'font-size="16" font-weight="800" fill="' + R.murekkep + '">' + nf0.format(top) + " TL</text>" +
      '<text x="' + cx.toFixed(1) + '" y="' + (ALT + 26) + '" text-anchor="middle" font-size="13" ' +
      'font-weight="700" fill="' + R.murekkep + '">' + esc(d.ad) + "</text>" +
      (d.ad2 ? '<text x="' + cx.toFixed(1) + '" y="' + (ALT + 42) + '" text-anchor="middle" font-size="12" fill="' +
        R.ikincil + '">' + esc(d.ad2) + "</text>" : "");
    if (i < 2) {
      // Bir sonraki yılın artışı bu düzeyin üstüne biniyor.
      cubuk += '<path d="M' + (x0 + w).toFixed(1) + " " + y(top).toFixed(1) + " H" +
        (cx + gen - w / 2).toFixed(1) + '" stroke="' + R.ikincil + '" stroke-width="1" stroke-dasharray="3 3"/>';
    }
  });
  function anahtar(x, renk, metin) {
    return '<rect x="' + x + '" y="72" width="11" height="11" rx="2" fill="' + renk + '"/>' +
      '<text x="' + (x + 17) + '" y="82" font-size="12" fill="' + R.ikincil + '">' + metin + "</text>";
  }
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="Varsayımsal sabit sepet 1.000 TL; yüzde 40 artışla 1.400 TL, ' +
    'sonraki yüzde 20 artışla 1.680 TL olur">' +
    '<text x="24" y="34" font-size="16" font-weight="700" fill="' + R.murekkep +
    '">Oran yarıya iniyor, sepet pahalanmaya devam ediyor</text>' +
    '<text x="24" y="56" font-size="13" fill="' + R.ikincil +
    '">Varsayımsal sabit sepet · iki yılda toplam artış %' + Math.round((d2 / BAS - 1) * 100) + "</text>" +
    anahtar(24, R.s1, "önceki fiyat") + anahtar(126, R.s2, "yılın artışı") +
    '<path d="M' + SOL + " " + ALT + " H" + SAG + '" stroke="' + R.ikincil + '" stroke-width="1"/>' +
    cubuk + "</svg>";
}

/* Beş yeni yazının kapakları. Hepsi yazının kendi modülünden okur ve
   sabit bir tarihe/yıla çivilidir: gece gelen veri kapağı değiştirmez,
   --svg-check kararlı kalır. Sayı yazıyla ayrışırsa çizim hata verir. */
var TE = require(path.join(KOK, "finans", "tufe-endeksi.js"));
var RM = require(path.join(KOK, "finans", "reel-maas.js"));
var VV = require(path.join(KOK, "finans", "veraset.js"));
var DB = require(path.join(KOK, "finans", "doviz-basabas.js"));
var CIVI = "2026-08";

function anahtarKutu(x, renk, metin, kesik) {
  return (kesik
    ? '<path d="M' + x + " 77.5 h12" + '" stroke="' + renk + '" stroke-width="2" stroke-dasharray="4 3"/>'
    : '<rect x="' + x + '" y="72" width="11" height="11" rx="2" fill="' + renk + '"/>') +
    '<text x="' + (x + 17) + '" y="82" font-size="12" fill="' + R.ikincil + '">' + metin + "</text>";
}
function baslikSatirlari(baslik, alt, etiket) {
  return '<svg viewBox="0 0 600 360" width="600" height="360" role="img" aria-label="' + etiket + '">' +
    '<text x="24" y="34" font-size="16" font-weight="700" fill="' + R.murekkep + '">' + esc(baslik) + "</text>" +
    '<text x="24" y="56" font-size="13" fill="' + R.ikincil + '">' + esc(alt) + "</text>";
}
function ayKisa(a) {
  return ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][+a.slice(5) - 1] + " " + a.slice(0, 4);
}

/* Fiyatların ikiye katlanma süresi, her ay geriye dönük ölçüm. */
function ikiyeKatlanmaCizgi() {
  var aylar = TE.aylar().filter(function (a) { return a >= "2013-12" && a <= CIVI; });
  var v = aylar.map(function (a) { return TE.ikiyeKatlanma(a); });
  var enUzun = 0, enKisa = 0;
  v.forEach(function (x, i) { if (x > v[enUzun]) enUzun = i; if (x < v[enKisa]) enKisa = i; });
  if (v[enUzun] !== 109 || v[enKisa] !== 15 || v[v.length - 1] !== 29) throw new Error("ikiye katlanma kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 96, ALT = 292, TAVAN = 120;
  function x(i) { return SOL + (SAG - SOL) * i / (aylar.length - 1); }
  function y(m) { return ALT - (ALT - UST) * m / TAVAN; }
  var s = baslikSatirlari("Fiyatlar kaç ayda ikiye katlandı?", "Her ay geriye dönük ölçüm · aylık TÜFE · Aralık 2013–Ağustos 2026",
    "Fiyatların ikiye katlanma süresi Mart 2016'da 109 ay, Ocak 2023'te 15 ay, Ağustos 2026'da 29 ay");
  [0, 24, 48, 72, 96, 120].forEach(function (m) {
    s += '<path d="M' + SOL + " " + y(m).toFixed(1) + " H" + SAG + '" stroke="' + (m ? R.izgara : R.ikincil) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(m) + 4).toFixed(1) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">' +
      (m ? (m / 12) + " yıl" : "0") + "</text>";
  });
  aylar.forEach(function (a, i) {
    if (a.slice(5) === "01" && (+a.slice(0, 4)) % 2 === 0) {
      s += '<text x="' + x(i).toFixed(1) + '" y="' + (ALT + 20) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' + a.slice(0, 4) + "</text>";
    }
  });
  s += '<polyline fill="none" stroke="' + R.marka + '" stroke-width="2" stroke-linejoin="round" points="' +
    v.map(function (m, i) { return x(i).toFixed(1) + "," + y(m).toFixed(1); }).join(" ") + '"/>';
  [[enUzun, "start", 10, -10], [enKisa, "middle", 0, 22], [v.length - 1, "end", -4, -14]].forEach(function (n) {
    var i = n[0];
    s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v[i]).toFixed(1) + '" r="4.5" fill="' + R.marka + '" stroke="' + R.zemin + '" stroke-width="2"/>' +
      '<text x="' + (x(i) + n[2]).toFixed(1) + '" y="' + (y(v[i]) + n[3]).toFixed(1) + '" font-size="14" font-weight="800" fill="' + R.murekkep +
      '" text-anchor="' + n[1] + '">' + v[i] + " ay · " + ayKisa(aylar[i]) + "</text>";
  });
  return s + "</svg>";
}

/* Net asgari ücretin alım gücü, Ağustos 2026 lirasıyla: her zam bir
   sıçrama, arası erime; kesikli çizgi yıllık ortalama. */
function asgariReelTestere() {
  var aylar = TE.aylar().filter(function (a) { return a >= "2020-01" && a <= CIVI; });
  var v = aylar.map(function (a) { return RM.asgariNet(a) * TE.carpan(a, CIVI) / 1000; });
  var ort = {};
  aylar.forEach(function (a, i) { var y0 = a.slice(0, 4); (ort[y0] = ort[y0] || []).push(v[i]); });
  Object.keys(ort).forEach(function (k) { ort[k] = ort[k].reduce(function (t, z) { return t + z; }, 0) / ort[k].length; });
  if (Math.round((ort[2024] / ort[2020] - 1) * 100) !== 47) throw new Error("asgari ücret kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 100, ALT = 292, ALTV = 15, USTV = 40;
  function x(i) { return SOL + (SAG - SOL) * i / (aylar.length - 1); }
  function y(z) { return ALT - (ALT - UST) * (z - ALTV) / (USTV - ALTV); }
  var s = baslikSatirlari("Her zam bir sıçrama, arası erime", "Net asgari ücret, Ağustos 2026 fiyatlarıyla · bin TL",
    "Net asgari ücretin alım gücü 2020 ortalamasında 21 bin, 2024 ortalamasında 31 bin TL; her zamdan sonra yüzde 11 ile 26 arasında eriyor");
  s += anahtarKutu(24, R.marka, "aylık") + anahtarKutu(96, R.s2, "yıllık ortalama", true);
  [15, 20, 25, 30, 35, 40].forEach(function (z) {
    s += '<path d="M' + SOL + " " + y(z).toFixed(1) + " H" + SAG + '" stroke="' + (z === 15 ? R.ikincil : R.izgara) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(z) + 4).toFixed(1) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">' + z + "</text>";
  });
  aylar.forEach(function (a, i) {
    if (a.slice(5) === "01") s += '<text x="' + x(i + 5.5).toFixed(1) + '" y="' + (ALT + 20) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' + a.slice(0, 4) + "</text>";
  });
  Object.keys(ort).forEach(function (k) {
    var i0 = aylar.indexOf(k + "-01"), i1 = aylar.lastIndexOf(aylar.filter(function (a) { return a.slice(0, 4) === k; }).pop());
    s += '<path d="M' + x(i0).toFixed(1) + " " + y(ort[k]).toFixed(1) + " H" + x(i1).toFixed(1) + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="4 3"/>';
    if (k === "2020" || k === "2024") {
      // Etiket çizginin üstüne binmesin: boş alana, yılın hizasına.
      var ilk = k === "2020";
      s += '<text x="' + (ilk ? x(i0) + 4 : (x(i0) + x(i1)) / 2).toFixed(1) + '" y="' + y(ilk ? 26.5 : 38.4).toFixed(1) + '" font-size="13" font-weight="800" fill="' +
        R.murekkep + '" text-anchor="' + (ilk ? "start" : "middle") + '">' + k + " ort. " + nf0.format(Math.round(ort[k] * 1000)) + " TL</text>";
    }
  });
  s += '<polyline fill="none" stroke="' + R.marka + '" stroke-width="2" stroke-linejoin="round" points="' +
    v.map(function (z, i) { return x(i).toFixed(1) + "," + y(z).toFixed(1); }).join(" ") + '"/>';
  return s + "</svg>";
}

/* Aynı 8 milyonluk mirasın vergisi, sekiz aile yapısında. */
function mirasAileCubuk() {
  var AILE = [
    ["Eş + 3 çocuk", { es: true, cocuk: 3 }], ["Eş + 2 çocuk", { es: true, cocuk: 2 }],
    ["Eş + 1 çocuk", { es: true, cocuk: 1 }], ["İki çocuk", { es: false, cocuk: 2 }],
    ["Tek çocuk", { es: false, cocuk: 1 }], ["Yalnız eş", { es: true }],
    ["Eş + anne ve baba", { es: true, cocuk: 0, ebeveyn: 2 }], ["Anne ve baba", { es: false, cocuk: 0, ebeveyn: 2 }]
  ];
  var v = AILE.map(function (a) { return VV.miras({ yil: 2026, tereke: 8e6, aile: a[1] }).toplamVergi; });
  if (Math.round(v[7]) !== 120000 || v[0] !== 0) throw new Error("miras kapağı yazıyla ayrıştı");
  var SOL = 170, SAG = 520, UST = 96, SATIR = 25, TAVAN = 130000;
  function x(z) { return SOL + (SAG - SOL) * z / TAVAN; }
  var s = baslikSatirlari("Aynı 8 milyon TL, sekiz aile", "2026 veraset ve intikal vergisi, toplam · net tereke 8.000.000 TL",
    "8 milyon TL mirasta vergi eş ve üç çocukta sıfır, yalnız anne ve baba mirasçıyken 120 bin TL");
  s += '<path d="M' + SOL + " " + (UST - 6) + " V" + (UST + SATIR * AILE.length - 2) + '" stroke="' + R.ikincil + '" stroke-width="1"/>';
  AILE.forEach(function (a, i) {
    var yy = UST + i * SATIR, gen = Math.max(0, x(v[i]) - SOL);
    s += '<text x="' + (SOL - 10) + '" y="' + (yy + 13) + '" font-size="13" fill="' + R.murekkep + '" text-anchor="end">' + esc(a[0]) + "</text>";
    if (gen > 0) s += '<rect x="' + SOL + '" y="' + yy + '" width="' + gen.toFixed(1) + '" height="17" rx="3" fill="' + (i === 7 ? R.s2 : R.s1) + '"/>';
    s += '<text x="' + (SOL + gen + 8).toFixed(1) + '" y="' + (yy + 13) + '" font-size="13" font-weight="800" fill="' + R.murekkep + '">' +
      nf0.format(Math.round(v[i])) + " TL</text>";
  });
  return s + "</svg>";
}

/* Bağış ile miras: aynı değer, ebeveynden tek çocuğa. */
function bagisMirasCubuk() {
  var DEG = [3e6, 5e6, 10e6, 20e6];
  var bag = DEG.map(function (d) { return VV.bagis({ yil: 2026, deger: d, yakin: true }).vergi; });
  var mir = DEG.map(function (d) { return VV.miras({ yil: 2026, tereke: d, aile: { es: false, cocuk: 1 } }).toplamVergi; });
  if (Math.round(bag[0]) !== 146653 || Math.round(mir[0]) !== 929) throw new Error("bağış kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 104, ALT = 286, TAVAN = 1800;
  function y(z) { return ALT - (ALT - UST) * z / TAVAN; }
  var s = baslikSatirlari("Bağışla geçen ev, mirasla geçenin katları vergi", "2026 veraset ve intikal vergisi · ebeveynden tek çocuğa · bin TL",
    "3 milyon TL'de bağış vergisi 147 bin, miras vergisi 1 bin TL; 20 milyonda 1.668 bine karşı 595 bin TL");
  s += anahtarKutu(24, R.s2, "bağış") + anahtarKutu(90, R.s1, "miras");
  [0, 600, 1200, 1800].forEach(function (z) {
    s += '<path d="M' + SOL + " " + y(z).toFixed(1) + " H" + SAG + '" stroke="' + (z ? R.izgara : R.ikincil) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(z) + 4).toFixed(1) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">' + nf0.format(z) + "</text>";
  });
  var gen = (SAG - SOL) / DEG.length, w = 40;
  DEG.forEach(function (d, i) {
    var cx = SOL + gen * (i + 0.5);
    [[bag[i], R.s2, cx - w - 1], [mir[i], R.s1, cx + 1]].forEach(function (c) {
      var z = c[0] / 1000, top = y(z);
      s += '<rect x="' + c[2].toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + w + '" height="' + Math.max(0.5, ALT - top).toFixed(1) + '" rx="3" fill="' + c[1] + '"/>' +
        '<text x="' + (c[2] + w / 2).toFixed(1) + '" y="' + (top - 7).toFixed(1) + '" font-size="13" font-weight="800" fill="' + R.murekkep +
        '" text-anchor="middle">' + nf0.format(Math.round(z)) + "</text>";
    });
    s += '<text x="' + cx.toFixed(1) + '" y="' + (ALT + 22) + '" font-size="13" font-weight="700" fill="' + R.murekkep + '" text-anchor="middle">' +
      nf0.format(d / 1e6) + " milyon TL</text>";
  });
  return s + "</svg>";
}

/* Başabaş: kurun yıllık ne kadar artması gerekir, vadeye göre.
   Stopaj kademesinde testere dişi sıçrama. */
function basabasTestere() {
  var G = { anapara: 100000, tlFaiz: 37, dovizFaiz: 1, kur: 48.85 };
  function yil(gun) { var g = {}; for (var k in G) g[k] = G[k]; g.gun = gun; return DB.hesapla(g); }
  var tufe = TE.donem("2025-08", CIVI).toplam * 100;
  if (Math.abs(yil(32).yillikArtis * 100 - 34.14) > 0.005 || Math.abs(tufe - 31.5) > 0.05) throw new Error("başabaş kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 100, ALT = 280, ALTV = 26, USTV = 36, G0 = 30, G1 = 730;
  function x(g) { return SOL + (SAG - SOL) * (g - G0) / (G1 - G0); }
  function y(z) { return ALT - (ALT - UST) * (z - ALTV) / (USTV - ALTV); }
  var s = baslikSatirlari("Kur yılda ne kadar artarsa döviz kazanır?", "Örnek: TL %37, döviz %1 brüt faiz · stopaj düşülmüş · yıllık karşılık",
    "Gereken yıllık kur artışı 32 günde yüzde 34,1; vade 1 yılı aşınca TL stopajı yüzde 10'a indiği için eşik sıçrıyor");
  s += anahtarKutu(24, R.marka, "gereken kur artışı") + anahtarKutu(156, R.s2, "yıllık enflasyon, Ağu 2026", true);
  [26, 28, 30, 32, 34, 36].forEach(function (z) {
    s += '<path d="M' + SOL + " " + y(z).toFixed(1) + " H" + SAG + '" stroke="' + (z === 26 ? R.ikincil : R.izgara) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(z) + 4).toFixed(1) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">%' + z + "</text>";
  });
  var parca = [], simdiki = [], onceki = null;
  for (var g = G0; g <= G1; g++) {
    var r = yil(g);
    if (onceki !== null && r.tl.stopajOrani !== onceki) { parca.push(simdiki); simdiki = []; }
    simdiki.push([g, r.yillikArtis * 100]); onceki = r.tl.stopajOrani;
  }
  parca.push(simdiki);
  var bantlar = ["stopaj %17,5", "%15", "%10"];
  parca.forEach(function (p, i) {
    s += '<polyline fill="none" stroke="' + R.marka + '" stroke-width="2" stroke-linejoin="round" points="' +
      p.map(function (q) { return x(q[0]).toFixed(1) + "," + y(q[1]).toFixed(1); }).join(" ") + '"/>';
    if (i > 0) {
      var a = parca[i - 1][parca[i - 1].length - 1], b = p[0];
      s += '<path d="M' + x(a[0]).toFixed(1) + " " + y(a[1]).toFixed(1) + " L" + x(b[0]).toFixed(1) + " " + y(b[1]).toFixed(1) +
        '" stroke="' + R.marka + '" stroke-width="1" stroke-dasharray="2 2"/>';
    }
    var orta = (p[0][0] + p[p.length - 1][0]) / 2;
    s += '<text x="' + x(orta).toFixed(1) + '" y="' + (ALT + 38) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' + bantlar[i] + "</text>";
  });
  s += '<path d="M' + SOL + " " + y(tufe).toFixed(1) + " H" + SAG + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="4 3"/>';
  [32, 182, 366, 730].forEach(function (g2) {
    s += '<text x="' + x(g2).toFixed(1) + '" y="' + (ALT + 20) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' + g2 + " gün</text>";
  });
  var s366 = yil(366).yillikArtis * 100;
  s += '<circle cx="' + x(366).toFixed(1) + '" cy="' + y(s366).toFixed(1) + '" r="4.5" fill="' + R.marka + '" stroke="' + R.zemin + '" stroke-width="2"/>' +
    '<text x="' + (x(366) + 10).toFixed(1) + '" y="' + (y(s366) - 10).toFixed(1) + '" font-size="13" font-weight="800" fill="' + R.murekkep + '">366. gün: stopaj %15 → %10</text>';
  return s + "</svg>";
}

/* Eylül 2026 ikinci yazı paketi: on kapak. Her biri yazının kendi
   modülünden okur, sabit tarih/yıla çivilidir ve yazıyla ayrışırsa hata verir. */
var GZ = require(path.join(KOK, "finans", "gecikme-zammi.js"));
var KL = require(path.join(KOK, "finans", "kredi-limiti.js"));
var KHS = require(path.join(KOK, "kredi-hesaplama", "hesap.js"));
var KGT = require(path.join(KOK, "finans", "kira-getirisi.js"));
var SGP = require(path.join(KOK, "bordro", "sgk-prim.js"));
var ASN = require(path.join(KOK, "bordro", "asgari-senaryo.js"));
var FZD = require(path.join(KOK, "finans", "faiz-donustur.js"));
var GMS = require(path.join(KOK, "bordro", "gmsi-motor.js"));

function izgaraY(SOL, SAG, y, degerler, yazi) {
  return degerler.map(function (v, i) {
    return '<path d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '" stroke="' + (i === 0 ? R.ikincil : R.izgara) + '" stroke-width="1"/>' +
      '<text x="' + (SOL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">' + yazi(v) + "</text>";
  }).join("");
}
function cubukEtiket(x, y, metin, boy) {
  return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (boy || 13) + '" font-weight="800" fill="' + R.murekkep + '" text-anchor="middle">' + metin + "</text>";
}
function altYazi(x, y, metin) {
  return '<text x="' + x.toFixed(1) + '" y="' + y + '" font-size="12" fill="' + R.ikincil + '" text-anchor="middle">' + esc(metin) + "</text>";
}
function isaretliBin(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + nf0.format(Math.abs(v)); }

/* 1 — Vergiyi bir yıl geciktirmenin reel bedeli, 2019–2025 vadeleri. */
function vergiGecikmeReel() {
  var yillar = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  var v = yillar.map(function (y) {
    var r = GZ.hesapla({ tutar: 100000, vade: y + "-03-31", odeme: (y + 1) + "-03-31" });
    return ((100000 + r.zam) / TE.carpan(y + "-03", (y + 1) + "-03") - 100000) / 1000;
  });
  if (Math.round(v[2] * 1000) !== -26019 || Math.round(v[6] * 1000) !== 14951) throw new Error("vergi gecikme kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 104, ALT = 280, UV = 20, AV = -30;
  function y(z) { return UST + (ALT - UST) * (UV - z) / (UV - AV); }
  var s = baslikSatirlari("Vergiyi bir yıl geciktirmenin reel bedeli", "31 Mart vadeli 100.000 TL · bin TL, vade fiyatlarıyla · artı: pahalı, eksi: borç eridi",
    "Vergiyi bir yıl geciktirmenin reel bedeli 2021 vadesinde eksi 26 bin, 2025 vadesinde artı 15 bin TL");
  s += anahtarKutu(24, R.s2, "zam enflasyonu geçti") + anahtarKutu(176, R.s1, "enflasyon zammı geçti");
  s += izgaraY(SOL, SAG, y, [0, 20, 10, -10, -20, -30], isaretliBin);
  var gen = (SAG - SOL) / yillar.length, w = 40;
  yillar.forEach(function (yil, i) {
    var cx = SOL + gen * (i + 0.5), a = y(Math.max(0, v[i])), b = y(Math.min(0, v[i]));
    s += '<rect x="' + (cx - w / 2).toFixed(1) + '" y="' + a.toFixed(1) + '" width="' + w + '" height="' + (b - a).toFixed(1) + '" rx="3" fill="' + (v[i] > 0 ? R.s2 : R.s1) + '"/>';
    s += cubukEtiket(cx, v[i] > 0 ? a - 7 : b + 16, isaretliBin(Math.round(v[i])));
    s += altYazi(cx, ALT + 22, String(yil));
  });
  return s + "</svg>";
}

/* 2 — Aynı taksitle çekilebilecek kredi, vadeye göre; tavan kesikli. */
function krediVadeTavan() {
  var t = KHS.turBilgi("ihtiyac"), r = KHS.brutOran(3.99, t.kkdf, t.bsmv), tavan = 20000 / r / 1000;
  var vadeler = []; for (var n = 6; n <= 120; n += 6) vadeler.push(n);
  var v = vadeler.map(function (n) { return KL.hesapla({ taksit: 20000, aylikFaiz: 3.99, vade: n, tur: "ihtiyac" }).anapara / 1000; });
  if (Math.round(tavan * 1000) !== 385579 || v[5] * 1000 !== 323100) throw new Error("kredi vade kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 100, ALT = 280, UV = 400;
  function x(n) { return SOL + (SAG - SOL) * (n - 0) / 120; }
  function y(z) { return ALT - (ALT - UST) * z / UV; }
  var s = baslikSatirlari("Vade uzar, kredi tavana dayanır", "Aylık 20.000 TL taksit · %3,99 ihtiyaç kredisi (KKDF, BSMV dahil) · bin TL",
    "Aynı taksitle çekilebilecek kredi 36 ayda 323 bin, 60 ayda 367 bin TL; vade ne olursa olsun 386 bin TL tavanını geçemez");
  s += anahtarKutu(24, R.marka, "çekilebilecek kredi") + anahtarKutu(172, R.s2, "tavan: taksit ÷ aylık maliyet", true);
  s += izgaraY(SOL, SAG, y, [0, 100, 200, 300, 400], function (z) { return nf0.format(z); });
  s += '<path d="M' + SOL + " " + y(tavan).toFixed(1) + " H" + SAG + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="4 3"/>';
  s += '<polyline fill="none" stroke="' + R.marka + '" stroke-width="2.4" stroke-linejoin="round" points="' +
    [[0, 0]].concat(vadeler.map(function (n, i) { return [n, v[i]]; })).map(function (p) { return x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); }).join(" ") + '"/>';
  [[36, v[5]], [60, v[9]]].forEach(function (p) {
    s += '<circle cx="' + x(p[0]).toFixed(1) + '" cy="' + y(p[1]).toFixed(1) + '" r="4.5" fill="' + R.marka + '" stroke="' + R.zemin + '" stroke-width="2"/>' +
      /* Eğri sağa ve yukarı gider; etiket noktanın sağ altında boş alanda. */
      '<text x="' + (x(p[0]) + 10).toFixed(1) + '" y="' + (y(p[1]) + 20).toFixed(1) + '" font-size="13" font-weight="800" fill="' + R.murekkep + '">' + p[0] + " ay: " + nf0.format(p[1]) + " bin</text>";
  });
  [12, 36, 60, 120].forEach(function (n) { s += altYazi(x(n), ALT + 20, n + " ay"); });
  return s + "</svg>";
}

/* 3 — Mevduatı yakalamak için gereken değer artışı, kira getirisine göre. */
function kiraBasabas() {
  var BG = [0.03, 0.04, 0.048, 0.06], FAIZ = [[30, R.s1], [37, R.s2], [45, R.s3]];
  function b(bg, m) { return KGT.hesapla({ fiyat: 5e6, alimMasraf: 0.02, aylikKira: 5e6 * bg / 12, yillikGider: 15000, kiraArtis: 0.25, degerArtis: 0.25, mevduatFaiz: m, sure: 10 }).basabasDegerArtis * 100; }
  if (Math.round(b(0.048, 37) * 10) !== 281) throw new Error("kira kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 540, UST = 100, ALT = 280, AV = 15, UV = 40;
  function x(bg) { return SOL + (SAG - SOL) * (bg - 0.03) / 0.03; }
  function y(z) { return ALT - (ALT - UST) * (z - AV) / (UV - AV); }
  var s = baslikSatirlari("Belirleyen kira değil, faiz", "10 yılda mevduatı yakalamak için gereken yıllık konut değer artışı (%)",
    "Brüt kira getirisi yüzde 3'ten 6'ya çıkınca eşik 2,6 puan düşüyor; mevduat faizi 8 puan değişince 7 puandan fazla");
  s += anahtarKutu(24, R.s1, "mevduat %30") + anahtarKutu(124, R.s2, "mevduat %37") + anahtarKutu(224, R.s3, "mevduat %45");
  s += izgaraY(SOL, SAG, y, [15, 20, 25, 30, 35, 40], function (z) { return "%" + z; });
  FAIZ.forEach(function (f) {
    var pts = BG.map(function (bg) { return [x(bg), y(b(bg, f[0]))]; });
    s += '<polyline fill="none" stroke="' + f[1] + '" stroke-width="2.4" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>';
    pts.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="' + f[1] + '" stroke="' + R.zemin + '" stroke-width="2"/>'; });
    s += '<text x="' + (x(0.06) + 10).toFixed(1) + '" y="' + (y(b(0.06, f[0])) + 4).toFixed(1) + '" font-size="13" font-weight="800" fill="' + R.murekkep + '">%' + b(0.06, f[0]).toFixed(1).replace(".", ",") + "</text>";
  });
  [[0.03, "%3"], [0.04, "%4"], [0.048, "%4,8"], [0.06, "%6"]].forEach(function (k) { s += altYazi(x(k[0]), ALT + 20, k[1]); });
  s += altYazi((SOL + SAG) / 2, ALT + 38, "brüt kira getirisi");
  return s + "</svg>";
}

/* 4 — Askerlik ve doğum borçlanması, günlük en düşük tutar. */
function borclanmaGunluk() {
  var s25 = SGP.sinirlar(2025), s26 = SGP.sinirlar(2026);
  var d = [["Askerlik", SGP.borclanma(1, s25.gunlukAlt, "genel", 2025).gunluk, SGP.borclanma(1, s26.gunlukAlt, "genel", 2026).gunluk],
           ["Doğum", SGP.borclanma(1, s25.gunlukAlt, "dogum", 2025).gunluk, SGP.borclanma(1, s26.gunlukAlt, "dogum", 2026).gunluk]];
  if (d[0][2] !== 495.45 || d[1][2] !== 352.32 || d[0][1] !== 277.39) throw new Error("borçlanma kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 104, ALT = 280, UV = 600;
  function y(z) { return ALT - (ALT - UST) * z / UV; }
  var s = baslikSatirlari("Askerliğin bir günü bir yılda %78,6 pahalandı", "Borçlanmanın günlük en düşük tutarı · TL",
    "Askerlik borçlanmasının günü 2025'te 277,39, 2026'da 495,45 TL; doğum borçlanmasında 352,32 TL");
  s += anahtarKutu(24, R.s1, "2025") + anahtarKutu(84, R.s2, "2026");
  s += izgaraY(SOL, SAG, y, [0, 200, 400, 600], function (z) { return nf0.format(z); });
  var gen = (SAG - SOL) / 2, w = 70;
  d.forEach(function (g, i) {
    var cx = SOL + gen * (i + 0.5);
    [[g[1], R.s1, cx - w - 4], [g[2], R.s2, cx + 4]].forEach(function (c) {
      s += '<rect x="' + c[2].toFixed(1) + '" y="' + y(c[0]).toFixed(1) + '" width="' + w + '" height="' + (ALT - y(c[0])).toFixed(1) + '" rx="3" fill="' + c[1] + '"/>' +
        cubukEtiket(c[2] + w / 2, y(c[0]) - 7, c[0].toFixed(2).replace(".", ","));
    });
    s += altYazi(cx, ALT + 22, g[0] + " (oran " + (i === 0 ? "%32 → %45" : "%32 → %32") + ")");
  });
  return s + "</svg>";
}

/* 5 — 2026'da SGK kalemlerinin artışı, asgari ücret çizgisiyle. */
function sgkArtis() {
  var s25 = SGP.sinirlar(2025), s26 = SGP.sinirlar(2026);
  function mal(y, s) { return B.hesaplaYil(s.aylikAlt, y).aylar[11].isverenMaliyeti; }
  var d = [
    ["GSS primi", SGP.gss(1e9, 2026).prim / SGP.gss(1e9, 2025).prim],
    ["Askerlik borçlanması", SGP.borclanma(1, s26.gunlukAlt, "genel", 2026).gunluk / SGP.borclanma(1, s25.gunlukAlt, "genel", 2025).gunluk],
    ["SGK tavanı", s26.aylikUst / s25.aylikUst],
    ["İsteğe bağlı sigorta", SGP.istegeBagli(s26.aylikAlt, 2026).prim / SGP.istegeBagli(s25.aylikAlt, 2025).prim],
    ["Bağ-Kur", SGP.bagkur(s26.aylikAlt, 2026).prim / SGP.bagkur(s25.aylikAlt, 2025).prim],
    ["İşverene maliyet", mal(2026, s26) / mal(2025, s25)],
    ["Doğum borçlanması", SGP.borclanma(1, s26.gunlukAlt, "dogum", 2026).gunluk / SGP.borclanma(1, s25.gunlukAlt, "dogum", 2025).gunluk]
  ].map(function (k) { return [k[0], (k[1] - 1) * 100]; });
  var asg = (s26.aylikAlt / s25.aylikAlt - 1) * 100;
  if (Math.round(d[0][1]) !== 154 || Math.round(asg) !== 27) throw new Error("SGK artış kapağı yazıyla ayrıştı");
  var SOL = 170, SAG = 540, UST = 92, SATIR = 26, UV = 160;
  function x(z) { return SOL + (SAG - SOL) * z / UV; }
  var s = baslikSatirlari("Asgari ücret %27, GSS primi %154 arttı", "2025'ten 2026'ya en düşük tutardaki artış (%)",
    "2026'da GSS primi yüzde 154, askerlik borçlanması 79, SGK tavanı 52 arttı; asgari ücret yüzde 27");
  s += '<path d="M' + x(asg).toFixed(1) + " " + (UST - 6) + " V" + (UST + SATIR * d.length) + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<text x="' + (x(asg) + 6).toFixed(1) + '" y="' + (UST + SATIR * d.length + 14) + '" font-size="12" fill="' + R.ikincil + '">asgari ücret %' + Math.round(asg) + "</text>";
  d.forEach(function (k, i) {
    var yy = UST + i * SATIR;
    s += '<text x="' + (SOL - 10) + '" y="' + (yy + 13) + '" font-size="13" fill="' + R.murekkep + '" text-anchor="end">' + esc(k[0]) + "</text>" +
      '<rect x="' + SOL + '" y="' + yy + '" width="' + (x(k[1]) - SOL).toFixed(1) + '" height="17" rx="3" fill="' + R.s1 + '"/>' +
      '<text x="' + (x(k[1]) + 8).toFixed(1) + '" y="' + (yy + 13) + '" font-size="13" font-weight="800" fill="' + R.murekkep + '">%' + Math.round(k[1]) + "</text>";
  });
  return s + "</svg>";
}

/* 6 — İndirim sonrası işveren SGK payı, üç dönem. */
function primIndirimi() {
  function o(y, ay, t) { var x = B.oranlarAy(B.parametre(y), ay); return (x.sgkIsveren - B.tesvikOrani(x, { tesvik: t })) * 100; }
  var d = [["Ocak 2025", o(2025, 1, "genel"), o(2025, 1, "imalat")], ["Şub–Ara 2025", o(2025, 2, "genel"), o(2025, 2, "imalat")], ["2026", o(2026, 1, "genel"), o(2026, 1, "imalat")]];
  if (Math.abs(d[2][1] - 19.75) > 1e-9 || Math.abs(d[1][1] - 16.75) > 1e-9) throw new Error("prim indirimi kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 104, ALT = 280, UV = 24;
  function y(z) { return ALT - (ALT - UST) * z / UV; }
  var s = baslikSatirlari("İmalat dışında indirim sonrası oran 3 puan arttı", "İndirim sonrası SGK işveren payı (%) · işsizlik payı hariç",
    "İmalat dışı işverenin indirim sonrası SGK payı 2025 Şubat'ta yüzde 16,75, 2026'da 19,75; imalatta 15,75'ten 16,75'e");
  s += anahtarKutu(24, R.s2, "imalat dışı") + anahtarKutu(116, R.s1, "imalat");
  s += izgaraY(SOL, SAG, y, [0, 8, 16, 24], function (z) { return "%" + z; });
  var gen = (SAG - SOL) / 3, w = 56;
  d.forEach(function (g, i) {
    var cx = SOL + gen * (i + 0.5);
    [[g[1], R.s2, cx - w - 3], [g[2], R.s1, cx + 3]].forEach(function (c) {
      s += '<rect x="' + c[2].toFixed(1) + '" y="' + y(c[0]).toFixed(1) + '" width="' + w + '" height="' + (ALT - y(c[0])).toFixed(1) + '" rx="3" fill="' + c[1] + '"/>' +
        cubukEtiket(c[2] + w / 2, y(c[0]) - 7, c[0].toFixed(2).replace(".", ","));
    });
    s += altYazi(cx, ALT + 22, g[0]);
  });
  return s + "</svg>";
}

/* 7 — Dilimler geride kaldıkça kayıp, iki maaş. */
function dilimGeriKalma() {
  function k(b, fark) { return ASN.hesapla({ asgariArtis: 0.25, tarifeArtis: 0.25 - fark, brut: b }).ucret.endeksFarki / 1000; }
  if (Math.round(k(60000, 0.10) * 1000) !== 2800 || Math.round(k(200000, 0.10) * 1000) !== 14800) throw new Error("dilim kapağı yazıyla ayrıştı");
  var FARK = [0, 0.05, 0.10, 0.15], SOL = 58, SAG = 540, UST = 100, ALT = 280, UV = 24;
  function x(f) { return SOL + (SAG - SOL) * f / 0.15; }
  function y(z) { return ALT - (ALT - UST) * z / UV; }
  var s = baslikSatirlari("Her 10 puanlık fark: 2.800 ya da 14.800 TL", "Asgari ücrete %25 zam senaryosu · yıllık fazla vergi, bin TL",
    "Dilimler asgari ücretten 10 puan geride kalırsa 60 bin TL brüt maaş yılda 2.800, 200 bin TL maaş 14.800 TL fazla vergi öder");
  s += anahtarKutu(24, R.s1, "60.000 TL brüt") + anahtarKutu(144, R.s2, "200.000 TL brüt") + anahtarKutu(274, R.s3, "asgari ücret");
  s += izgaraY(SOL, SAG, y, [0, 6, 12, 18, 24], function (z) { return nf0.format(z); });
  [[33030, R.s3], [60000, R.s1], [200000, R.s2]].forEach(function (m) {
    s += '<polyline fill="none" stroke="' + m[1] + '" stroke-width="2.4" points="' + FARK.map(function (f) { return x(f).toFixed(1) + "," + y(k(m[0], f)).toFixed(1); }).join(" ") + '"/>';
    FARK.forEach(function (f) { s += '<circle cx="' + x(f).toFixed(1) + '" cy="' + y(k(m[0], f)).toFixed(1) + '" r="4" fill="' + m[1] + '" stroke="' + R.zemin + '" stroke-width="2"/>'; });
  });
  s += cubukEtiket(x(0.15) - 6, y(k(200000, 0.15)) - 10, nf0.format(k(200000, 0.15) * 1000) + " TL") +
    cubukEtiket(x(0.15) - 6, y(k(60000, 0.15)) - 10, nf0.format(k(60000, 0.15) * 1000) + " TL");
  FARK.forEach(function (f) { s += altYazi(x(f), ALT + 20, Math.round(f * 100) + " puan"); });
  s += altYazi((SOL + SAG) / 2, ALT + 38, "dilim artışının asgari ücretin gerisinde kaldığı fark");
  return s + "</svg>";
}

/* 8 — Aynı faizle vadeye göre yıllık net getiri (yenilenerek). */
function mevduatVade() {
  var V = [32, 92, 181, 182, 365, 366, 730], d = V.map(function (g) { var m = FZD.mevduat(0.37, g); return [g, m.yillikNetBilesik * 100, m.stopajOrani * 100]; });
  if (Math.abs(d[0][1] - 35.15) > 0.005 || Math.abs(d[4][1] - 31.45) > 0.005) throw new Error("mevduat vade kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UST = 104, ALT = 270, AV = 26, UV = 36;
  function y(z) { return ALT - (ALT - UST) * (z - AV) / (UV - AV); }
  var s = baslikSatirlari("Kısa vadeyi yenilemek bir yıllık vadeyi geçiyor", "Yıllık %37 brüt faiz · stopaj sonrası yıllık getiri, yenilenerek (%)",
    "Aynı brüt faizde 32 günlük vadeyi yenilemek yüzde 35,15, bir yıllık vade 31,45 getirir");
  s += izgaraY(SOL, SAG, y, [26, 28, 30, 32, 34, 36], function (z) { return "%" + z; });
  var gen = (SAG - SOL) / V.length, w = 44;
  d.forEach(function (g, i) {
    var cx = SOL + gen * (i + 0.5);
    s += '<rect x="' + (cx - w / 2).toFixed(1) + '" y="' + y(g[1]).toFixed(1) + '" width="' + w + '" height="' + (ALT - y(g[1])).toFixed(1) + '" rx="3" fill="' + (i === 0 ? R.s2 : R.s1) + '"/>' +
      cubukEtiket(cx, y(g[1]) - 7, g[1].toFixed(2).replace(".", ","), 11) + altYazi(cx, ALT + 20, g[0] + " gün") +
      altYazi(cx, ALT + 36, "%" + String(g[2]).replace(".", ","));
  });
  s += '<text x="' + SOL + '" y="' + (ALT + 36) + '" font-size="12" fill="' + R.ikincil + '" text-anchor="end">stopaj</text>';
  return s + "</svg>";
}

/* 9 — İşverenin ödediğinden asgari ücretliye geçen pay. */
function asgariNetPayi() {
  var d = [];
  [2020, 2021, 2022, 2023, 2024, 2025, 2026].forEach(function (yil) {
    var P = B.parametre(yil), br = []; for (var m = 1; m <= 12; m++) br.push(B.donem(P, m).asgariBrut);
    var Y = B.hesaplaYil(br, yil), I = B.hesaplaYil(br, yil, { tesvik: "genel" });
    P.donemler.forEach(function (dd) { d.push([ayKisa(yil + "-" + String(dd.ay).padStart(2, "0")), dd.asgariNet / Y.aylar[dd.ay - 1].isverenMaliyeti * 100, dd.asgariNet / I.aylar[dd.ay - 1].isverenMaliyeti * 100]); });
  });
  if (Math.abs(d[d.length - 1][1] - 68.69) > 0.005 || Math.abs(d[1][1] - 64.48) > 0.005) throw new Error("asgari maliyet kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 560, UST = 100, ALT = 270, AV = 60, UV = 75;
  function x(i) { return SOL + (SAG - SOL) * i / (d.length - 1); }
  function y(z) { return ALT - (ALT - UST) * (z - AV) / (UV - AV); }
  var s = baslikSatirlari("Her 100 TL'nin ne kadarı çalışana geçiyor?", "Net asgari ücretin işverene maliyete oranı (%)",
    "İşverenin asgari ücret için ödediğinin yüzde 64,48'i 2021'de, 69,39'u 2022'de, 68,69'u 2026'da çalışana geçiyor");
  s += anahtarKutu(24, R.s1, "teşviksiz") + anahtarKutu(112, R.s2, "genel prim indirimiyle");
  s += izgaraY(SOL, SAG, y, [60, 65, 70, 75], function (z) { return "%" + z; });
  [[1, R.s1], [2, R.s2]].forEach(function (seri) {
    s += '<polyline fill="none" stroke="' + seri[1] + '" stroke-width="2.4" points="' + d.map(function (p, i) { return x(i).toFixed(1) + "," + y(p[seri[0]]).toFixed(1); }).join(" ") + '"/>';
    d.forEach(function (p, i) { s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p[seri[0]]).toFixed(1) + '" r="3.5" fill="' + seri[1] + '" stroke="' + R.zemin + '" stroke-width="1.5"/>'; });
  });
  s += cubukEtiket(x(1), y(d[1][1]) + 22, "%64,5") + cubukEtiket(x(d.length - 1) - 10, y(d[d.length - 1][1]) + 24, "%68,7");
  d.forEach(function (p, i) { if (i % 2 === 0 || i === d.length - 1) s += altYazi(x(i), ALT + 20, p[0]); });
  return s + "</svg>";
}

/* 10 — Kira istisnası sınırında vergi sıçraması. */
function kiraIstisnaSicrama() {
  var UST = B.parametre(2026).dilimler[2][0], KIRA = 240000, esik = UST - KIRA;
  function v(d) { var r = GMS.hesapla({ yil: 2026, konutKira: KIRA, brutGelirToplami: d }); return Math.min(r.goturu.kiraVergisi, r.gercek.kiraVergisi) / 1000; }
  var alt = v(esik), ust = v(esik + 1);
  if (Math.round(alt * 1000) !== 23205 || Math.round(ust * 1000) !== 31300) throw new Error("kira istisnası kapağı yazıyla ayrıştı");
  var SOL = 58, SAG = 578, UTOP = 104, ALT = 270, X0 = 1.0, X1 = 1.5, UV = 40;
  function x(m) { return SOL + (SAG - SOL) * (m - X0) / (X1 - X0); }
  function y(z) { return ALT - (ALT - UTOP) * z / UV; }
  var s = baslikSatirlari("1 lira fazla gelir, 8.095 TL fazla vergi", "240.000 TL konut kirası · kira vergisi, bin TL · 2026",
    "Kira dışı brüt gelir 1.260.000 TL'yi 1 lira aşınca istisna düşer, kira vergisi 23.205 TL'den 31.300 TL'ye çıkar");
  s += izgaraY(SOL, SAG, y, [0, 10, 20, 30, 40], function (z) { return nf0.format(z); });
  var xe = x(esik / 1e6);
  s += '<path d="M' + SOL + " " + y(alt).toFixed(1) + " H" + xe.toFixed(1) + '" stroke="' + R.marka + '" stroke-width="3"/>' +
    '<path d="M' + xe.toFixed(1) + " " + y(alt).toFixed(1) + " V" + y(ust).toFixed(1) + '" stroke="' + R.s2 + '" stroke-width="2" stroke-dasharray="3 3"/>' +
    '<path d="M' + xe.toFixed(1) + " " + y(ust).toFixed(1) + " H" + SAG + '" stroke="' + R.marka + '" stroke-width="3"/>';
  s += cubukEtiket((SOL + xe) / 2, y(alt) - 10, "23.205 TL") + cubukEtiket((xe + SAG) / 2, y(ust) - 10, "31.300 TL") +
    '<text x="' + (xe - 8).toFixed(1) + '" y="' + ((y(alt) + y(ust)) / 2 + 4).toFixed(1) + '" font-size="13" font-weight="800" fill="' + R.s2 + '" text-anchor="end">+8.095 TL</text>';
  [1.0, 1.1, 1.2, 1.26, 1.4, 1.5].forEach(function (m) { s += altYazi(x(m), ALT + 20, (m === 1.26 ? "1,26 mn" : String(m).replace(".", ",") + " mn")); });
  s += altYazi((SOL + SAG) / 2, ALT + 38, "kira dışındaki yıllık brüt gelir (maaş dahil), milyon TL");
  return s + "</svg>";
}

var KAPAKLAR = {
  "vergi-borcunu-geciktirmek-karli-mi": {
    kicker: "Vergi · Borç",
    baslik: "Vergi borcunu geciktirmek kârlı mı?",
    alt: "2021–2023'te geç ödeyen kazandı; 2024'ten beri kaybediyor",
    cizim: vergiGecikmeReel
  },
  "kredi-vadesini-uzatmanin-bedeli": {
    kicker: "Kredi & Finans",
    baslik: "Kredi vadesini uzatmanın bedeli",
    alt: "Vade uzar, kredi 385.579 TL'lik tavana dayanır",
    cizim: krediVadeTavan
  },
  "kiraya-vermek-icin-ev-almak-mantikli-mi": {
    kicker: "Birikim · Gayrimenkul",
    baslik: "Kiraya vermek için ev almak mantıklı mı?",
    alt: "Mevduatı yakalamak için yılda %28,1 değer artışı",
    cizim: kiraBasabas
  },
  "askerlik-borclanmasi-2026": {
    kicker: "Bordro · SGK",
    baslik: "Askerlik borçlanması 2026",
    alt: "Günü 495,45 TL: bir yılda %78,6 pahalandı",
    cizim: borclanmaGunluk
  },
  "sgk-primleri-2026-ne-degisti": {
    kicker: "Bordro · SGK",
    baslik: "2026'da SGK primlerinde ne değişti?",
    alt: "Asgari ücret %27, GSS primi %154 arttı",
    cizim: sgkArtis
  },
  "sgk-prim-indirimi-2-puan": {
    kicker: "Bordro · İşveren",
    baslik: "SGK prim indirimi 2 puana indi",
    alt: "İmalat dışında indirim sonrası oran %16,75'ten %19,75'e",
    cizim: primIndirimi
  },
  "vergi-dilimleri-2027-asgari-ucret": {
    kicker: "Vergi · Senaryo",
    baslik: "2027 vergi dilimleri ve asgari ücret",
    alt: "Her 10 puanlık fark: yılda 2.800 ya da 14.800 TL",
    cizim: dilimGeriKalma
  },
  "mevduat-vade-secimi-32-gun-mu-1-yil-mi": {
    kicker: "Birikim · Mevduat",
    baslik: "Mevduatta 32 gün mü, 1 yıl mı?",
    alt: "Aynı faizle 32 günü yenilemek %35,15, bir yıl %31,45",
    cizim: mevduatVade
  },
  "asgari-ucretin-isverene-maliyeti": {
    kicker: "Bordro · İşveren",
    baslik: "Asgari ücretin işverene maliyeti",
    alt: "Her 100 TL'nin 68,69'u çalışana geçiyor",
    cizim: asgariNetPayi
  },
  "kira-geliri-istisnasi-siniri": {
    kicker: "Vergi · Kira",
    baslik: "Kira geliri istisnası sınırı",
    alt: "1 lira fazla gelir, 8.095 TL fazla vergi",
    cizim: kiraIstisnaSicrama
  },
  "dolar-mi-tl-mevduat-mi": {
    kicker: "Birikim · Mevduat",
    baslik: "Dolar mı TL mevduat mı?",
    alt: "Kurun ne kadar artması gerekir: vade, stopaj ve makas",
    cizim: basabasTestere
  },
  "bagis-mi-miras-mi-vergi": {
    kicker: "Vergi · Miras",
    baslik: "Evi çocuğa bağışlamak mı, miras mı?",
    alt: "3 milyon TL'lik ev: bağışla 146.653, mirasla 929 TL vergi",
    cizim: bagisMirasCubuk
  },
  "miras-kalan-ev-icin-vergi": {
    kicker: "Vergi · Miras",
    baslik: "Miras kalan ev için vergi ödenir mi?",
    alt: "Aynı 8 milyon TL: sıfırdan 120.000 TL'ye, mirasçıya göre",
    cizim: mirasAileCubuk
  },
  "asgari-ucret-enflasyona-yenildi-mi": {
    kicker: "Bordro · Enflasyon",
    baslik: "Asgari ücret enflasyona yenildi mi?",
    alt: "Ortalamada %47 arttı, her zamdan sonra %11–26 eridi",
    cizim: asgariReelTestere
  },
  "fiyatlar-kac-ayda-ikiye-katlaniyor": {
    kicker: "Finans · Enflasyon",
    baslik: "Fiyatlar kaç ayda ikiye katlanıyor?",
    alt: "Dokuz yıldan 15 aya, sonra 29 aya",
    cizim: ikiyeKatlanmaCizgi
  },
  "ciro-artarken-nakit-neden-azalir": {
    kicker: "Finans · İşletme sermayesi",
    baslik: "Ciro artarken nakit neden azalır?",
    alt: "150 bin TL kârdan eksi 150 bin TL nakde",
    cizim: kariNakitKoprusu
  },
  "enflasyon-duserken-fiyatlar-neden-dusmuyor": {
    kicker: "Finans · Hane bütçesi",
    baslik: "Enflasyon düşerken fiyatlar neden düşmüyor?",
    alt: "Artış hızı yarıya iniyor, sepet yine 280 TL pahalanıyor",
    cizim: sepetOranDuzey
  },
  "emekli-promosyonunun-ekonomisi": {
    kicker: "Finans",
    baslik: "Emekli promosyonunun ekonomisi",
    alt: "Reklamdaki toplam değil, kişiye kalan net değer",
    cizim: promosyonNetDeger
  },
  "yilin-en-dusuk-maasi-hangi-ay": {
    kicker: "Bordro · Ölçüm",
    baslik: "Yılın en düşük maaşı hangi ay?",
    alt: "Aralık değil — dip ayı brüt yükseldikçe geriye yürüyor",
    cizim: dipAyBasamagi
  },
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

/* SVG KART
   Gövde figürü ve makale listesi PNG yerine bunu gösteriyor: her
   yakınlaştırmada keskin ve PNG'nin onda biri boyutunda. Kompozisyon
   KART_SABLON ile aynı (zemin, 8px şerit, 34/30 kenar boşluğu); çizim
   aynı fonksiyondan geldiği için ikisi ayrışamaz. <img> olarak
   veriliyor: gövdede gerçek bir görsel olması Google Görseller için
   ölçülmüş bir kural (tools/gorsel-seo-test.js). Paylaşım görseli PNG
   kalıyor — sosyal ağlar SVG önizleme göstermiyor. */
function kartSvg(slug) {
  var ic = KAPAKLAR[slug].cizim().trim();
  if (ic.indexOf("<svg") !== 0 || ic.slice(-6) !== "</svg>") {
    throw new Error(slug + ": çizim saf SVG döndürmüyor");
  }
  var vb = /^<svg[^>]*viewBox="([^"]+)"/.exec(ic);
  if (!vb) throw new Error(slug + ": çizimde viewBox yok");
  var etiket = /^<svg[^>]*aria-label="([^"]*)"/.exec(ic);
  var govde = ic.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500" role="img"' +
    (etiket ? ' aria-label="' + etiket[1] + '"' : "") + ">" +
    "<style>text{font-family:\"Segoe UI\",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif}</style>" +
    '<rect width="800" height="500" fill="' + R.zemin + '"/>' +
    '<rect width="8" height="500" fill="' + R.marka + '"/>' +
    '<svg x="34" y="30" width="732" height="440" viewBox="' + vb[1] + '">' + govde + "</svg></svg>\n";
}

/* SVG AFİŞ
   Bazı yazılar gövdede afişi gösteriyor: kalın serif başlık, üst etiket
   ve imza okura yazının kimliğini veriyor (Koray, 2026-09-23: afişte
   kalın yazımlar daha iyi). PNG afiş 632px sütunda yumuşuyordu. Bu dosya
   aynı afiş belgesini (afisHtml) foreignObject içinde taşıyor: yerleşim
   PNG'yle birebir, çizim her ölçekte keskin. Yalnız gövdesi -afis.svg'yi
   isteyen yazı için yazılır; paylaşım görseli PNG kalır. */
function afisSvg(slug) {
  var h = afisHtml(slug);
  var css = /<style>([\s\S]*)<\/style>/.exec(h)[1]
    .replace("html,body{width:1200px;height:630px;overflow:hidden}", ".kok{width:1200px;height:630px;overflow:hidden}")
    .replace("body{background:", ".kok{background:");
  if (css.indexOf("body") !== -1) throw new Error(slug + ": afiş CSS'inde body kaldı");
  var govde = /<body>([\s\S]*)<\/body>/.exec(h)[1]
    // XHTML içinde satır içi SVG kendi ad alanını ister.
    .replace(/<svg(?![^>]*xmlns=)/g, '<svg xmlns="http://www.w3.org/2000/svg"')
    // Büyük harfe çevirme dil kuralı XML'de güvenilmez: İ'yi burada koy.
    .replace(/(<p class="kicker">)([^<]*)/, function (m, a, t) { return a + t.toLocaleUpperCase("tr-TR"); });
  var etiket = esc(KAPAKLAR[slug].baslik).replace(/"/g, "&quot;");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="' + etiket + '">' +
    '<foreignObject width="1200" height="630">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" lang="tr" xml:lang="tr" class="kok"><style>' + css + "</style>" + govde + "</div>" +
    "</foreignObject></svg>\n";
}

function afisGovdede(slug) {
  var p = path.join(__dirname, "..", "makaleler", slug, "index.html");
  return fs.existsSync(p) && fs.readFileSync(p, "utf8").indexOf("images/makale/" + slug + "-afis.svg") !== -1;
}

function kartSvgYaz(slug) {
  var hedef = path.join(CIKTI, slug + "-kart.svg");
  fs.writeFileSync(hedef, kartSvg(slug), "utf8");
  console.log("   " + path.basename(hedef).padEnd(42) + fs.statSync(hedef).size + " bayt");
  if (afisGovdede(slug)) {
    hedef = path.join(CIKTI, slug + "-afis.svg");
    fs.writeFileSync(hedef, afisSvg(slug), "utf8");
    console.log("   " + path.basename(hedef).padEnd(42) + fs.statSync(hedef).size + " bayt");
  }
  return true;
}

function chromeBul() {
  for (var i = 0; i < CHROME.length; i++) {
    if (fs.existsSync(CHROME[i])) return CHROME[i];
  }
  return null;
}

function afisHtml(slug) {
  var k = KAPAKLAR[slug];
  var fs_ = k.baslik.length <= 22 ? 52 : (k.baslik.length <= 30 ? 46 : 40);
  return SABLON
    .replace("{fs}", fs_)
    .replace("{kicker}", esc(k.kicker))
    .replace("{baslik}", esc(k.baslik))
    .replace("{alt}", esc(k.alt))
    .replace("{svg}", k.cizim());
}

function uret(chrome, slug, kart) {
  var k = KAPAKLAR[slug];
  var doc = kart ? KART_SABLON.replace("{svg}", k.cizim()) : afisHtml(slug);

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
  if (process.argv.indexOf("--svg-check") !== -1) {
    // SVG kart Chrome'suz ve belirlenimci: CI her kapagi bellekte yeniden
    // cizer, diskteki dosyayla bayt bayt karsilastirir. Cizim degisip SVG
    // yeniden uretilmezse govdedeki gorsel eski veriyi gosterirdi.
    var ayni = function (p, icerik) { return fs.existsSync(p) && fs.readFileSync(p, "utf8") === icerik; };
    var bozuk = [];
    Object.keys(KAPAKLAR).forEach(function (s) {
      if (!ayni(path.join(CIKTI, s + "-kart.svg"), kartSvg(s))) bozuk.push(s + "-kart.svg");
      if (afisGovdede(s) && !ayni(path.join(CIKTI, s + "-afis.svg"), afisSvg(s))) bozuk.push(s + "-afis.svg");
    });
    fs.readdirSync(CIKTI).forEach(function (f) {
      var m = /^(.+)-afis\.svg$/.exec(f);
      if (m && !(KAPAKLAR[m[1]] && afisGovdede(m[1]))) bozuk.push(f + " (hiçbir gövde istemiyor)");
    });
    bozuk.forEach(function (f) { console.error("  eski ya da eksik: images/makale/" + f); });
    console.log(bozuk.length ? "\n" + bozuk.length + " SVG kart guncel degil: node tools/makale-gorsel.js <slug>"
                             : Object.keys(KAPAKLAR).length + " SVG kart ve gövdedeki afişler cizimle ayni.");
    return bozuk.length ? 1 : 0;
  }
  if (process.argv.indexOf("--svg") !== -1) {
    // Yalniz SVG'ler: Chrome gerekmez, PNG'lere dokunulmaz.
    (arg.length ? arg : Object.keys(KAPAKLAR)).forEach(kartSvgYaz);
    return 0;
  }
  var chrome = chromeBul();
  if (!chrome) { console.error("Chrome bulunamadi."); return 2; }
  var hedefler = arg.length ? arg : Object.keys(KAPAKLAR);
  var ok = 0;
  hedefler.forEach(function (s) {
    if (!KAPAKLAR[s]) { console.error("Bilinmeyen kapak: " + s); return; }
    if (uret(chrome, s, false) && uret(chrome, s, true) && kartSvgYaz(s)) ok++;
  });
  console.log("\nUretilen: " + ok + " / " + hedefler.length);
  return ok === hedefler.length ? 0 : 1;
}

process.exit(main());
