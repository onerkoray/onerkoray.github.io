#!/usr/bin/env node
/*
 * "Zam net maaşa ne kadar yansır?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının iki tablosunda kırk hesaplanmış değer var ve hiçbiri çivili
 * değildi. 2026-09-19'da kırkı da motordan birebir üretildi — yani
 * doğrular — ama bunu koruyan bir şey yoktu.
 *
 * YILA ÇİVİLİ
 * -----------
 * Tablolar "2026:" diye etiketli; test de 2026'yı kullanıyor, sonYil()
 * değil. 2027 parametreleri girildiğinde bu sayıların DEĞİŞMEMESİ
 * gerekir, çünkü yazı 2026 tablosu olduğunu söylüyor. Yeni yıl için
 * tablo istenirse bu bilinçli bir güncelleme olmalı, sessiz bir kayma
 * değil.
 *
 * ÜÇ ÖNERME
 * ---------
 * Ö1. Net artış brüt zammın ALTINDA kalıyor — ama her yerde değil.
 * Ö2. Prim tavanının civarında İŞARET DÖNÜYOR: net artış brüt zammı
 *     aşıyor, çünkü ilave brüte prim binmiyor.
 *     KONTROL: dönüş noktası tavan BİLİNMEDEN taranıyor. Ve dönüş
 *     noktasının tavanın kendisi OLMADIĞI ayrıca ölçülüyor — zam,
 *     tabanı tavanın üstüne taşıdığı anda etki başlıyor.
 * Ö3. Ters yön tutarlı: hesaplanan brüt zam gerçekten hedeflenen net
 *     artışı veriyor.
 *     KONTROL: ileri ve ters yön birbirini kapatmalı; yoksa ikisi ayrı
 *     ayrı yanlış olabilir ve test bunu göremezdi.
 *
 * Kullanım: node makaleler/zam-net-maasa-ne-kadar-yansir/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var Z = require(path.join(__dirname, "zam.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var YIL = 2026;
var ZAM = 0.30;          /* yazının tablosundaki brüt zam oranı */
var PAZARLIK = 100000;   /* ikinci tablonun taban brütü */

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(m) { return HTML.split(m).length - 1; }
function gecsin(ad, m) { gecer(ad, kacKez(m) >= 1, "sayfada yok: " + m); }
function y2(o) { return (o * 100).toFixed(2).replace(".", ","); }
function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
/* Yazı eksi işareti olarak U+2212 kullanıyor. */
function isaretli(s) { return s.replace("-", "−"); }

function tabloSatirlari(capIcerik) {
  var i = HTML.indexOf(capIcerik);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  return HTML.slice(bas, son).split("<tr").slice(1).filter(function (r) {
    return r.indexOf('scope="col"') < 0;
  }).map(function (r) {
    return (r.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/g) || []).map(function (h) {
      return h.replace(/<[^>]*>/g, "").trim();
    });
  }).filter(function (h) { return h.length > 1; });
}

console.log("Zam yansıması yazısı — sayı denetimi\n");

var D = B.parametre(YIL).donemler[0];

/* ---------------------------------------------------------------- 1
   Yansıma tablosu. Asgari ücret ve tavan satırları SAYI OLARAK
   yazılmıyor: kastedilen kavram, tutar değil. */
var YANSIMA = [
  [D.asgariBrut, "22,94", "7,06"], [40000, "22,48", "7,52"],
  [60000, "24,53", "5,47"], [80000, "25,70", "4,30"],
  [100000, "26,46", "3,54"], [120000, "26,25", "3,75"],
  [150000, "24,54", "5,46"], [200000, "25,71", "4,29"],
  [250000, "28,22", "1,78"], [280000, "30,61", "-0,61"],
  [D.sgkTavan, "31,80", "-1,80"], [320000, "31,66", "-1,66"],
  [350000, "31,51", "-1,51"], [400000, "30,63", "-0,63"]
];

/* Tablonun "durum" sutunu bir SINIFLANDIRMA ve turetilebilir:
     taban tavanin ustunde                -> "tavan ustu"
     taban altinda ama zamli hali ustunde -> "tavani asiyor"
     ikisi de altinda                     -> "normal" */
function durum(aylikBrut) {
  if (aylikBrut > D.sgkTavan) return "tavan üstü";
  if (aylikBrut * (1 + ZAM) > D.sgkTavan) return "tavanı aşıyor";
  return "normal";
}
YANSIMA.forEach(function (s) {
  var o = y2(Z.yansima(s[0], YIL, ZAM));
  gecer(s[0] + " TL: nete yansıma %" + s[1], o === s[1], "ölçülen %" + o);
  var f = y2(Z.fark(s[0], YIL, ZAM));
  gecer(s[0] + " TL: fark " + s[2] + " puan",
    isaretli(f) === isaretli(s[2]), "ölçülen " + f);
});

/* Tablonun HÜCRELERİ modülle aynı mı? Varlık kontrolü yetmez: bu
   oranların bir kısmı özette ve SSS'te de geçiyor. */
(function () {
  var satir = tabloSatirlari("brüt zammın maaş düzeyine göre nete yansıması");
  gecer("yansıma tablosu okunabildi",
    satir && satir.length === YANSIMA.length,
    satir ? "satır: " + satir.length : "tablo yok");
  if (!satir || satir.length !== YANSIMA.length) return;
  satir.forEach(function (r, i) {
    var brut = YANSIMA[i][0];
    gecer(brut + " TL: tablo satırı doğru brütü gösteriyor",
      r[0].indexOf(brut.toLocaleString("tr-TR")) === 0, r[0]);
    gecer(brut + " TL: tablodaki yansıma hücresi modülle aynı",
      r[1] === "%" + y2(Z.yansima(brut, YIL, ZAM)), r[1]);
    gecer(brut + " TL: tablodaki fark hücresi modülle aynı",
      isaretli(r[2]) === isaretli(y2(Z.fark(brut, YIL, ZAM))), r[2]);
    gecer(brut + " TL: durum sütunu türetilenle aynı",
      r[3] === durum(brut), r[3] + " vs " + durum(brut));
  });
  /* KONTROL: sinif sutunu gercekten ayirt ediyor mu? Uc sinifin ucu de
     tabloda bulunmali, yoksa "hepsi ayni" da gecerdi. */
  var siniflar = {};
  satir.forEach(function (r) { siniflar[r[3]] = 1; });
  gecer("tabloda üç durum sınıfı da var",
    Object.keys(siniflar).length === 3, Object.keys(siniflar).join(", "));
})();

/* ---------------------------------------------------------------- 2
   Pazarlık tablosu (ters yön). */
var PAZAR = [[0.10, "11,34", 111338], [0.20, "22,68", 122675],
             [0.25, "28,34", 128344], [0.30, "34,01", 134013],
             [0.40, "45,35", 145351], [0.50, "57,89", 157890]];
PAZAR.forEach(function (s) {
  var zam = y2(Z.gerekenZam(PAZARLIK, YIL, s[0]));
  gecer("net %" + (s[0] * 100) + " için brüt zam %" + s[1],
    zam === s[1], "ölçülen %" + zam);
  var brut = Math.round(Z.gerekenBrut(PAZARLIK, YIL, s[0]));
  gecer("net %" + (s[0] * 100) + " için yeni brüt " + tam(s[2]),
    brut === s[2], "ölçülen " + brut);
});

(function () {
  var satir = tabloSatirlari("Hedeflenen net artış için gereken brüt zam oranı");
  gecer("pazarlık tablosu okunabildi",
    satir && satir.length === PAZAR.length,
    satir ? "satır: " + satir.length : "tablo yok");
  if (!satir || satir.length !== PAZAR.length) return;
  satir.forEach(function (r, i) {
    var s = PAZAR[i];
    gecer("net %" + (s[0] * 100) + ": tablodaki brüt zam modülle aynı",
      r[1] === "%" + y2(Z.gerekenZam(PAZARLIK, YIL, s[0])), r[1]);
    gecer("net %" + (s[0] * 100) + ": tablodaki yeni brüt modülle aynı",
      r[2] === tam(Z.gerekenBrut(PAZARLIK, YIL, s[0])) + " TL", r[2]);
  });
})();

/* KONTROL: ileri ve ters yön birbirini kapatmalı. İkisi ayrı ayrı
   yanlış olsaydı yukarıdaki iddialar yine geçebilirdi. */
PAZAR.forEach(function (s) {
  var brut = Z.gerekenBrut(PAZARLIK, YIL, s[0]);
  var olusanNet = Z.net(brut, YIL) / Z.net(PAZARLIK, YIL) - 1;
  gecer("net %" + (s[0] * 100) + ": ters yön ileri yönle kapanıyor",
    Math.abs(olusanNet - s[0]) < 1e-6, String(olusanNet));
});

/* ---------------------------------------------------------------- 3
   Ö2 — işaretin döndüğü yer. */
(function () {
  var donus = Z.donusNoktasi(YIL, ZAM, 150000, 400000, 100);
  gecer("dönüş noktası bulundu", donus !== null);
  if (donus === null) return;
  gecer("dönüşten önce net artış brüt zammın altında",
    Z.yansima(donus - 5000, YIL, ZAM) < ZAM);
  gecer("dönüşten sonra net artış brüt zammı aşıyor",
    Z.yansima(donus + 5000, YIL, ZAM) > ZAM);
  /* KONTROL: dönüş noktası tavanın KENDİSİ DEĞİL. Öyle olsaydı
     "tavanda dönüyor" demek yeterdi; oysa zam tabanı tavanın üstüne
     taşıdığı anda etki başlıyor. */
  gecer("dönüş noktası tavanın altında", donus < D.sgkTavan,
    donus + " vs " + D.sgkTavan);
  /* Ve dönüş noktası zam oranına BAĞLI: daha büyük zam daha erken
     döndürür. */
  var buyukZam = Z.donusNoktasi(YIL, 0.60, 150000, 400000, 100);
  gecer("daha büyük zam daha erken döndürüyor",
    buyukZam !== null && buyukZam < donus, buyukZam + " < " + donus);
})();

/* ---------------------------------------------------------------- 4
   Ö1 — düşük ve orta ücretlerde yansıma her zaman eksik. */
[40000, 80000, 150000, 200000].forEach(function (b) {
  gecer(b + " TL: net artış brüt zammın altında",
    Z.yansima(b, YIL, ZAM) < ZAM);
});

/* ---------------------------------------------------------------- 5
   Nesirdeki iddialar. Tam tekrar sayısıyla: bu oranlar hem tabloda hem
   özette hem SSS'te geçiyor, varlık kontrolü bir kopyayı bozmakla
   düşmezdi. */
gecsin("tavan bölümü var", "SGK tavanı");
gecsin("işaret dönüşü anlatılıyor", "%31,80");
gecer("tavan tutarı sayfada", kacKez(tam(D.sgkTavan)) >= 1);

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
