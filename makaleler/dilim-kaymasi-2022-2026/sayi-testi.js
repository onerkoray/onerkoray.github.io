#!/usr/bin/env node
/*
 * "Dilim kayması gerçekten oluyor mu?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazı beş tablo ve iki biçimsel önerme taşıyor; hepsi 2022–2026 tarife ve
 * asgari ücret parametrelerinden türüyor. 2027 girildiğinde ya da geçmiş bir
 * değer düzeltildiğinde yazı sessizce eskir — tablolar hizalı durur,
 * yüzdeler makul okunur, yalnızca yanlıştır.
 *
 * EN KRİTİK KONTROL ÖNERME 1.
 * Yazının en çarpıcı iddiası "ilk dilim eşiğini değiştirmek asgari ücret
 * üstü hiçbir ücretlinin vergisini değiştirmez; etki tam olarak sıfırdır".
 * Bu iddia yazıdan okunmuyor: motorda eşik fiilen değiştirilip vergi
 * yeniden hesaplanıyor ve farkın SIFIR olduğu ölçülüyor. Kanun ya da
 * istisna tekniği değişirse bu test, cümle düzeltilmeden geçmeyi engeller.
 *
 * Kullanım: node makaleler/dilim-kaymasi-2022-2026/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var S = require(path.join(KOK, "finans", "endeksleme-serileri.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
/* SAYARAK doğrular. Düz "içeriyor mu" kontrolü, aynı sayı sayfada birden
   çok geçtiğinde bozulan tekini kaçırıyor; bu kod tabanında dört kez oldu. */
function gecsin(ad, metin, adet) {
  var n = HTML.split(metin).length - 1;
  gecer(ad, n === adet, metin + " sayfada " + n + " kez, beklenen " + adet);
}
function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }
function pc(n) { return "%" + n.toFixed(2).replace(".", ","); }
function o3(n) { return n.toFixed(3).replace(".", ","); }

function tabloSatirlari(caption) {
  var i = HTML.indexOf("<caption>" + caption);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i), son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  var blok = HTML.slice(bas, son), satirlar = [];
  var re = /<tr>([\s\S]*?)<\/tr>/g, m;
  while ((m = re.exec(blok))) {
    var h = [], re2 = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, m2;
    while ((m2 = re2.exec(m[1]))) h.push(m2[1].replace(/<[^>]+>/g, "").trim());
    if (h.length) satirlar.push(h);
  }
  return satirlar;
}

/* Yıllık gelir vergisi — tam bordro benzetiminden. */
function yillikGV(brut, yil) {
  return B.hesaplaYil(brut, yil).aylar
    .reduce(function (t, a) { return t + (a.gelirVergisi || a.vergi || 0); }, 0);
}
/* Asgari ücretin yıllık matrahı: brüt toplamdan %15 işçi primi düşülmüş. */
function asgariMatrah(yil) {
  var P = B.parametre(yil), yillik = 0, d = P.donemler || [];
  d.forEach(function (dn, i) {
    var ay = (i + 1 < d.length ? d[i + 1].ay : 13) - dn.ay;
    yillik += dn.asgariBrut * ay;
  });
  return yillik * 0.85;
}

var Y = S.YILLAR;
console.log("Dilim kayması yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 0 */
/* Seriler ve parametreler yerinde mi. */
Y.forEach(function (y) {
  var ok = true;
  try { B.parametre(y); } catch (e) { ok = false; }
  gecer("motor " + y + " parametrelerini tanıyor", ok);
  gecer(y + " serisi tanımlı", !!S.SERI[y] &&
    isFinite(S.SERI[y].tufe) && isFinite(S.SERI[y].ydo));
});
gecer("seri kesintisiz", Y[Y.length - 1] - Y[0] + 1 === Y.length, Y.join(", "));

/* ------------------------------------------------------------------ 1 */
/* ÖNERME 1 — NÖTRLEŞTİRME. Yazının biçimsel çekirdeği.
   Eşik motorda fiilen değiştiriliyor ve etkinin SIFIR olduğu ölçülüyor. */
(function () {
  var P = B.parametre(2026);
  var au2022 = B.donem(B.parametre(2022), 1).asgariBrut;
  var katsayi = S.birikmisTufe(2022, 2026);
  var karsiOlgusalT1 = Math.round(B.parametre(2025).dilimler[0][0] *
    (1 + S.SERI[2026].tufe / 100));

  var Ma = asgariMatrah(2026);
  gecer("2026'da ilk eşik asgari ücret matrahının ALTINDA",
    P.dilimler[0][0] < Ma, P.dilimler[0][0] + " vs " + Math.round(Ma));

  [2, 3, 5, 8].forEach(function (k) {
    var brut = au2022 * k * katsayi;
    var once = yillikGV(brut, 2026);
    var eski = P.dilimler[0][0];
    P.dilimler[0][0] = karsiOlgusalT1;
    var sonra = yillikGV(brut, 2026);
    P.dilimler[0][0] = eski;
    gecer("ilk eşik değişimi " + k + "× düzeyinde SIFIR etki",
      Math.abs(sonra - once) < 0.005, (sonra - once).toFixed(4) + " TL");
  });

  /* Karşılaştırma: aynı işlem İKİNCİ eşikte yapılınca etki SIFIR OLMAMALI.
     Yoksa test, motorun eşikleri hiç okumadığı bir durumda da geçerdi. */
  var brut3 = au2022 * 3 * katsayi;
  var o = yillikGV(brut3, 2026);
  var eski2 = P.dilimler[1][0];
  var yeni2 = Math.round(B.parametre(2025).dilimler[1][0] * (1 + S.SERI[2026].tufe / 100));
  P.dilimler[1][0] = yeni2;
  var s2 = yillikGV(brut3, 2026);
  P.dilimler[1][0] = eski2;
  gecer("ikinci eşik değişimi SIFIR DEĞİL (kontrol)", Math.abs(s2 - o) > 1,
    (s2 - o).toFixed(2));

  /* ÖNERME 2 — kapalı form: Δ × (τ_{j+1} − τ_j). */
  var delta = yeni2 - eski2;
  var beklenen = delta * (P.dilimler[2][1] - P.dilimler[1][1]);
  gecer("kapalı form ölçümle birebir", Math.abs(Math.abs(s2 - o) - beklenen) < 0.01,
    beklenen.toFixed(2) + " vs " + Math.abs(s2 - o).toFixed(2));
  /* Yazıda binlik ayraçlı yazılıyor; test de öyle aramalı. */
  gecsin("kapalı form tutarı yazıda",
    beklenen.toLocaleString("tr-TR",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL", 1);
  gecsin("karşı-olgusal ilk eşik", tl(karsiOlgusalT1) + " TL", 1);
  gecsin("karşı-olgusal ikinci eşik", tl(yeni2) + " TL", 1);
})();

/* ------------------------------------------------------------------ 2 */
/* Tablo 1: endeksleme performansı. */
(function () {
  var t = tabloSatirlari("Tarife eşiklerinin yıllık artışı");
  gecer("endeksleme tablosu bulundu", !!t);
  if (!t) return;
  var g = t.slice(1);
  gecer("endeksleme tablosunda " + (Y.length - 1) + " satır", g.length === Y.length - 1,
    g.length + " satır");
  Y.slice(1).forEach(function (y, i) {
    var s = g[i];
    if (!s) { gecer("endeksleme satır " + y, false, "satır yok"); return; }
    var a = B.parametre(y - 1), b = B.parametre(y);
    var au1 = B.donem(a, 1).asgariBrut, au2 = B.donem(b, 1).asgariBrut;
    gecer(y + " satır etiketi", s[0] === String(y), s[0]);
    gecer(y + " 1. eşik artışı", s[1] === pc(100 * (b.dilimler[0][0] / a.dilimler[0][0] - 1)), s[1]);
    gecer(y + " 2. eşik artışı", s[2] === pc(100 * (b.dilimler[1][0] / a.dilimler[1][0] - 1)), s[2]);
    gecer(y + " yeniden değerleme", s[3] === pc(S.SERI[y].ydo), s[3]);
    gecer(y + " TÜFE", s[4] === pc(S.SERI[y].tufe), s[4]);
    gecer(y + " asgari ücret artışı", s[5] === pc(100 * (au2 / au1 - 1)), s[5]);
  });
  /* Yazının iddiası: 2026'da tarife HER İKİ ölçütün de altında. */
  var b26 = B.parametre(2026).dilimler[1][0], b25 = B.parametre(2025).dilimler[1][0];
  var artis = 100 * (b26 / b25 - 1);
  gecer("2026'da tarife artışı YDO'nun altında", artis < S.SERI[2026].ydo,
    artis.toFixed(2) + " vs " + S.SERI[2026].ydo);
  gecer("2026'da tarife artışı TÜFE'nin altında", artis < S.SERI[2026].tufe,
    artis.toFixed(2) + " vs " + S.SERI[2026].tufe);
})();

/* ------------------------------------------------------------------ 3 */
/* Tablo 3: eşikler asgari ücret matrahı cinsinden + yapısal iddia. */
(function () {
  var t = tabloSatirlari("Tarife eşikleri, asgari ücretin yıllık matrahı");
  gecer("konum tablosu bulundu", !!t);
  if (!t) return;
  var g = t.slice(1);
  Y.forEach(function (y, i) {
    var s = g[i];
    if (!s) { gecer("konum satır " + y, false, "satır yok"); return; }
    var d = B.parametre(y).dilimler, Ma = asgariMatrah(y);
    gecer(y + " asgari ücret matrahı", s[1] === tl(Ma), s[1] + " ≠ " + tl(Ma));
    gecer(y + " 1. eşik oranı", s[2] === o3(d[0][0] / Ma), s[2]);
    gecer(y + " 2. eşik oranı", s[3] === o3(d[1][0] / Ma), s[3]);
  });
  /* ÖNERME 1'in geçerlilik koşulu: t1 < Ma < t2, HER YIL. */
  var hepsi = Y.every(function (y) {
    var d = B.parametre(y).dilimler, Ma = asgariMatrah(y);
    return d[0][0] < Ma && Ma < d[1][0];
  });
  gecer("t1 < asgari matrah < t2 — beş yılın hepsinde", hepsi);
})();

/* ------------------------------------------------------------------ 4 */
/* Tablo 4: Senaryo A efektif oranları. */
(function () {
  var t = tabloSatirlari("Reel brüt ücreti sabit tutulan");
  gecer("senaryo tablosu bulundu", !!t);
  if (!t) return;
  var g = t.slice(1);
  var au2022 = B.donem(B.parametre(2022), 1).asgariBrut;
  [2, 3, 5, 8].forEach(function (k, i) {
    var s = g[i];
    if (!s) { gecer("senaryo satır " + k, false, "satır yok"); return; }
    Y.forEach(function (y, j) {
      var brut = au2022 * k * (S.birikmisTufe(2022, y) || 1);
      var beklenen = pc(100 * yillikGV(brut, y) / (brut * 12));
      gecer(k + "× " + y + " efektif oran", s[j + 1] === beklenen,
        s[j + 1] + " ≠ " + beklenen);
    });
  });
  /* Yazının iddiası: dört düzeyin dördünde de DİP 2024'te. */
  function dipYili(k) {
    var enAz = Infinity, yil = null;
    Y.forEach(function (y) {
      var brut = au2022 * k * (S.birikmisTufe(2022, y) || 1);
      var r = yillikGV(brut, y) / (brut * 12);
      if (r < enAz) { enAz = r; yil = y; }
    });
    return yil;
  }
  var dip = [2, 3, 5].filter(function (k) { return dipYili(k) === 2024; }).length;
  var sekizDip = dipYili(8);
  gecer("efektif oran üç düzeyde 2024'te dip yapıyor", dip === 3, dip + " düzeyde");
  /* Sekiz katta dip 2023'te: o matrah üçüncü eşiği de aşıyor. Yazının ilk
     hâli makalenin şekil açıklamasını devralıp "dördünde de 2024" demişti;
     bu test onu yanlışladı. Ayrım burada SABİTLENİYOR ki geri gelmesin. */
  gecer("sekiz katta dip 2024'te DEĞİL", sekizDip !== 2024, String(sekizDip));
})();

/* ------------------------------------------------------------------ 5 */
/* Tablo 5: karşı-olgusal + kaybın GÖTÜRÜ olduğu iddiası. */
(function () {
  var t = tabloSatirlari("2026 tarifesi TÜFE oranında artırılsaydı");
  gecer("karşı-olgusal tablosu bulundu", !!t);
  if (!t) return;
  var g = t.slice(1);
  var P26 = B.parametre(2026), gercek = P26.dilimler.map(function (d) { return d[0]; });
  var d25 = B.parametre(2025).dilimler, tufe = 1 + S.SERI[2026].tufe / 100;
  var au2022 = B.donem(B.parametre(2022), 1).asgariBrut;
  var katsayi = S.birikmisTufe(2022, 2026);
  var farklar = [];
  [2, 3, 5, 8].forEach(function (k, i) {
    var brut = au2022 * k * katsayi;
    var once = yillikGV(brut, 2026);
    P26.dilimler.forEach(function (d, j) {
      if (d25[j] && d25[j][0] !== null) d[0] = Math.round(d25[j][0] * tufe);
    });
    var sonra = yillikGV(brut, 2026);
    P26.dilimler.forEach(function (d, j) { d[0] = gercek[j]; });
    var fark = once - sonra;
    farklar.push(fark);
    var s = g[i];
    if (!s) { gecer("karşı-olgusal satır " + k, false, "satır yok"); return; }
    gecer(k + "× yıllık fark", s[3] === tl(fark) + " TL", s[3] + " ≠ " + tl(fark) + " TL");
    gecer(k + "× brüte oranı", s[4] === pc(100 * fark / (brut * 12)), s[4]);
  });
  /* GÖTÜRÜ İDDİASI: ilk üç düzey aynı eşik kümesini aştığı için kayıp
     mutlak olarak AYNI olmalı. Yazının dağılımsal sonucu buna dayanıyor. */
  gecer("kayıp ilk üç düzeyde birebir aynı (götürü)",
    Math.abs(farklar[0] - farklar[1]) < 0.01 &&
    Math.abs(farklar[1] - farklar[2]) < 0.01,
    farklar.slice(0, 3).map(tl).join(" / "));
  gecer("sekiz katta kayıp daha büyük (ikinci terim giriyor)",
    farklar[3] > farklar[2] + 1, tl(farklar[3]) + " vs " + tl(farklar[2]));
  gecsin("götürü tutar yazıda", tl(farklar[0]) + " TL", 5);
})();

/* ------------------------------------------------------------------ 6 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecer("ScholarlyArticle olarak işaretlenmiş",
  HTML.indexOf('"@type": "ScholarlyArticle"') !== -1);
gecer("yazar ORCID ile bağlanmış",
  HTML.indexOf('"propertyID": "ORCID"') !== -1 &&
  HTML.indexOf('rel="author"') === -1 || HTML.indexOf("orcid.org/0009-0005-8730-3577") !== -1);

console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
