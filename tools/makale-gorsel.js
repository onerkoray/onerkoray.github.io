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

var CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

/* --- renk rolleri --- */
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

/* ---------- kapaklar ---------- */

var KAPAKLAR = {
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
