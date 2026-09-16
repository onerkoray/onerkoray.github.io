#!/usr/bin/env node
/*
 * "Asgari ödersem borcum ne zaman biter?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının bütün sayıları iki dış kaynaktan türüyor: TCMB'nin aylık azami
 * faiz oranları ve BDDK'nın asgari ödeme kuralı. İkisi de değişebilir —
 * TCMB oranları aylık. Değiştiğinde sayfa bozulmaz, hizalı durur ve
 * yalnızca yanlış olur.
 *
 * ÖNERMELER PROZADA DEĞİL, ÖLÇÜMDE
 * --------------------------------
 * Yazının iddiası "asgari ödeme borcu eritir". Bu bir görüş değil, bir
 * eşitsizlik: asgari oran > faiz/(1+faiz). Test bunu her bant için
 * ölçüyor ve yanına KONTROL koyuyor — yeterince yüksek bir faizde
 * eşitsizliğin BOZULDUĞU da doğrulanıyor. Kontrol olmasa, buyumeEsigi
 * hep sıfır dönse bile test geçerdi.
 *
 * DAYANIKLILIK DA ÖLÇÜLÜYOR
 * -------------------------
 * Yazı "faizler ikiye katlansa bile" diyor. Bu cümle bugünkü orana bağlı
 * olmadığı için ayrıca sınanıyor: iddia bir gün yanlışlanırsa yazı sessizce
 * yanlış kalmasın.
 *
 * Kullanım: node makaleler/kredi-karti-asgari-odeme/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var K = require(path.join(__dirname, "kart.js"));
var KREDI = require(path.join(KOK, "kredi-hesaplama", "hesap.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(metin) { return HTML.split(metin).length - 1; }
function gecsin(ad, metin) {
  gecer(ad, kacKez(metin) >= 1, "sayfada yok: " + metin);
}
function tamKez(ad, metin, adet) {
  var n = kacKez(metin);
  gecer(ad, n === adet, metin + " " + n + " kez geçiyor, beklenen " + adet);
}

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde2(o) { return "%" + y2(o * 100); }

function tabloSatirlari(captionParcasi) {
  var i = HTML.indexOf("<caption>" + captionParcasi);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
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

console.log("Kredi kartı asgari ödeme yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 0 */
/* Vergi oranları sitenin kredi hesaplayıcısıyla ayrışmamalı. İki ayrı
   yerde tutulan aynı oran, birinin güncellenip ötekinin unutulmasıdır. */
(function () {
  var ihtiyac = null;
  (KREDI.TURLER || []).forEach(function (t) {
    if (t.ad === "ihtiyac") ihtiyac = t;
  });
  gecer("kredi hesaplayıcısında ihtiyaç kredisi tanımlı", !!ihtiyac);
  if (ihtiyac) {
    gecer("KKDF oranı kredi hesaplayıcısıyla aynı",
      Math.abs(K.KKDF * 100 - ihtiyac.kkdf) < 1e-9,
      K.KKDF * 100 + " vs " + ihtiyac.kkdf);
    gecer("BSMV oranı kredi hesaplayıcısıyla aynı",
      Math.abs(K.BSMV * 100 - ihtiyac.bsmv) < 1e-9,
      K.BSMV * 100 + " vs " + ihtiyac.bsmv);
  }
  gecer("vergi çarpanı 1,30", Math.abs(K.vergiCarpani() - 1.30) < 1e-9,
    String(K.vergiCarpani()));
})();

/* ------------------------------------------------------------------ 1 */
/* Bant tablosu. */
var t1 = tabloSatirlari("Faiz bantları ve borcun büyümeye başlayacağı");
gecer("bant tablosu bulundu", !!t1);
if (t1) {
  var g1 = t1.slice(1);
  gecer("bant tablosunda " + K.BANTLAR.length + " satır var",
    g1.length === K.BANTLAR.length, g1.length + " satır");
  K.BANTLAR.forEach(function (b, i) {
    var s = g1[i];
    if (!s) { gecer("bant satır " + b.ad, false, "satır yok"); return; }
    var esik = K.buyumeEsigi(b.akdi);
    gecer(b.ad + " etiketi", s[0] === b.ad, s[0]);
    gecer(b.ad + " akdi faiz", s[1] === yuzde2(b.akdi), s[1] + " ≠ " + yuzde2(b.akdi));
    gecer(b.ad + " vergili oran", s[2] === yuzde2(K.vergiliOran(b.akdi)),
      s[2] + " ≠ " + yuzde2(K.vergiliOran(b.akdi)));
    gecer(b.ad + " büyüme eşiği", s[3] === yuzde2(esik), s[3] + " ≠ " + yuzde2(esik));
    gecer(b.ad + " asgarinin katı", s[4] === y1(K.ASGARI_DUSUK / esik) + " kat",
      s[4] + " ≠ " + y1(K.ASGARI_DUSUK / esik) + " kat");
  });
}

/* ------------------------------------------------------------------ 2 */
/* ÖNERME 1: her bantta yasal asgari, borcu eritmeye yeter.
   Yanında KONTROL: yeterince yüksek faizde yetmez. */
K.BANTLAR.forEach(function (b) {
  var esik = K.buyumeEsigi(b.akdi);
  gecer(b.ad + " — %20 asgari borcu eritiyor", K.ASGARI_DUSUK > esik,
    yuzde2(K.ASGARI_DUSUK) + " vs eşik " + yuzde2(esik));
  gecer(b.ad + " — eşik faizin altında", esik < K.vergiliOran(b.akdi));
});

(function () {
  /* KONTROL: eşitsizlik her zaman doğru olsaydı ölçüm bozuk demekti.
     Kritik faizin hemen üstünde %20 asgari YETMEMELİ. */
  var kritik = K.kritikAkdiFaiz(K.ASGARI_DUSUK);
  gecer("kritik faizin hemen altında asgari yetiyor",
    K.ASGARI_DUSUK > K.buyumeEsigi(kritik * 0.99));
  gecer("kontrol: kritik faizin üstünde asgari YETMİYOR",
    K.ASGARI_DUSUK < K.buyumeEsigi(kritik * 1.01),
    "eşik " + yuzde2(K.buyumeEsigi(kritik * 1.01)));

  /* Kritik faiz, tam olarak eşiği yakalamalı. */
  gecer("kritik faiz eşiği tam yakalıyor",
    Math.abs(K.buyumeEsigi(kritik) - K.ASGARI_DUSUK) < 1e-9,
    yuzde2(K.buyumeEsigi(kritik)));

  /* DAYANIKLILIK: faizler ikiye katlansa da yeter — yazının iddiası. */
  var enYuksek = K.enYuksekAzamiAkdi();
  gecer("faizler ikiye katlansa bile %20 asgari yeterli",
    K.ASGARI_DUSUK > K.buyumeEsigi(enYuksek * 2),
    "eşik " + yuzde2(K.buyumeEsigi(enYuksek * 2)));

  /* Yazıdaki kat farkı. */
  var kat = kritik / enYuksek;
  gecer("kritik faiz azaminin 4,5 katı", kat > 4.4 && kat < 4.6, y2(kat) + " kat");
})();

/* ------------------------------------------------------------------ 3 */
/* Seyir tablosu. */
var t2 = tabloSatirlari("Yalnızca asgari ödenirse borcun seyri");
gecer("seyir tablosu bulundu", !!t2);
var ORNEKLER = [];
if (t2) {
  var g2 = t2.slice(1);
  gecer("seyir tablosunda satır var", g2.length >= 4, g2.length + " satır");
  var dusukVar = 0, yuksekVar = 0;
  g2.forEach(function (s) {
    var borc = Number(s[0].replace(/\./g, "").replace(" TL", ""));
    var limit = Number(s[1].replace(/\./g, "").replace(" TL", ""));
    ORNEKLER.push({ borc: borc, limit: limit });
    var r = K.simule(borc, limit);
    var kalan12 = K.yilSonuKalan(borc, limit);

    gecer(s[0] + " asgari oranı", s[2] === yuzde2(r.asgariOran), s[2]);
    gecer(s[0] + " 12 ay sonra kalan", s[3] === tam(kalan12) + " TL",
      s[3] + " ≠ " + tam(kalan12) + " TL");
    gecer(s[0] + " eriyen kısım", s[4] === yuzde2(1 - kalan12 / borc), s[4]);
    gecer(s[0] + " toplam faiz", s[5] === tam(r.faizToplam) + " TL",
      s[5] + " ≠ " + tam(r.faizToplam) + " TL");
    gecer(s[0] + " anaparaya oranı", s[6] === yuzde2(r.faizOrani), s[6]);

    /* Borç gerçekten bitmeli — yazının başlığı bu. */
    gecer(s[0] + " borç bitiyor", r.bitti, r.ay + " ay sonunda kalan " + tam(r.kalan));
    /* Ve her ay küçülmeli: seyirde artan bir ay olmamalı. */
    var artan = 0, onceki = borc;
    r.seyir.forEach(function (a) {
      if (a.kalan > onceki + 0.005) artan++;
      onceki = a.kalan;
    });
    gecer(s[0] + " hiçbir ay borç artmıyor", artan === 0, artan + " ayda arttı");

    /* Limit kuralı: asgari oran limite bağlı. */
    gecer(s[0] + " asgari oran limitle tutarlı",
      r.asgariOran === (limit > K.ASGARI_SINIR ? K.ASGARI_YUKSEK : K.ASGARI_DUSUK));
    if (r.asgariOran === K.ASGARI_DUSUK) dusukVar++; else yuksekVar++;
  });
  gecer("tabloda her iki asgari grubu da var", dusukVar >= 1 && yuksekVar >= 1,
    dusukVar + " düşük, " + yuksekVar + " yüksek");
}

/* ------------------------------------------------------------------ 4 */
/* Başabaş tablosu. */
var t3 = tabloSatirlari("Borcu olduğu yerde tutan aylık harcama");
gecer("başabaş tablosu bulundu", !!t3);
if (t3) {
  var g3 = t3.slice(1);
  g3.forEach(function (s, i) {
    var o = ORNEKLER[i];
    if (!o) { gecer("başabaş satır " + i, false, "örnek yok"); return; }
    var b = K.basabasHarcama(o.borc, o.limit);
    gecer(s[0] + " başabaş asgari oranı", s[1] === yuzde2(K.asgariOrani(o.limit)), s[1]);
    gecer(s[0] + " aylık asgari", s[2] === tam(b.odeme) + " TL",
      s[2] + " ≠ " + tam(b.odeme) + " TL");
    gecer(s[0] + " o ayın faizi", s[3] === tam(b.faiz) + " TL",
      s[3] + " ≠ " + tam(b.faiz) + " TL");
    gecer(s[0] + " başabaş harcama", s[4] === tam(b.basabas) + " TL",
      s[4] + " ≠ " + tam(b.basabas) + " TL");
    /* Tanım gereği: başabaş kadar harcarsan borç aynı kalmalı. Ölçülüyor. */
    var r = K.simule(o.borc, o.limit, { enCokAy: 6, aylikHarcama: b.basabas });
    var sapma = Math.abs(r.seyir[r.seyir.length - 1].kalan - o.borc);
    gecer(s[0] + " başabaş harcamada borç sabit kalıyor", sapma < 1,
      sapma.toFixed(2) + " TL sapma");
    /* KONTROL: bir tık fazlası borcu BÜYÜTMELİ. */
    var r2 = K.simule(o.borc, o.limit,
      { enCokAy: 6, aylikHarcama: b.basabas * 1.10 });
    gecer(s[0] + " kontrol: fazlası borcu büyütüyor",
      r2.seyir[r2.seyir.length - 1].kalan > o.borc + 1);
  });
}

/* ------------------------------------------------------------------ 5 */
/* Kapsam koruması: borç limiti aşamaz. */
(function () {
  var patladi = false;
  try { K.simule(150000, 50000); } catch (e) { patladi = true; }
  gecer("limitten büyük borç reddediliyor", patladi);
  var gecti = true;
  try { K.simule(50000, 50000); } catch (e) { gecti = false; }
  gecer("limite eşit borç kabul ediliyor", gecti);
})();

/* ------------------------------------------------------------------ 6 */
/* Metindeki sayılar — adediyle sabit. */
(function () {
  var kritik = K.kritikAkdiFaiz(K.ASGARI_DUSUK);
  var enYuksek = K.enYuksekAzamiAkdi();
  tamKez("kritik faiz metinde", y2(kritik * 100), 3);
  /* 5 kez: twitter aciklamasi, JSON-LD SSS, proza, bant tablosu, SSS. */
  tamKez("en yüksek azami oran metinde", y2(enYuksek * 100), 5);
  gecsin("asgari sınırı metinde", tam(K.ASGARI_SINIR) + " TL");
  gecsin("düşük asgari oranı", "%" + Math.round(K.ASGARI_DUSUK * 100));
  gecsin("yüksek asgari oranı", "%" + Math.round(K.ASGARI_YUKSEK * 100));
  gecsin("KKDF oranı", "%" + Math.round(K.KKDF * 100) + " KKDF");
  gecsin("vergi çarpanı anlatımı", "100 TL faiz, 130 TL");
  gecsin("kat farkı metinde", y1(kritik / enYuksek) + " katına");
})();

/* ------------------------------------------------------------------ 7 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecsin("ORCID bağlantısı", "https://orcid.org/0009-0005-8730-3577");
gecsin("TCMB kaynağı", "tcmb.gov.tr");
gecsin("yönetmelik kaynağı", "MevzuatNo=11180");
tamKez("bant tablosu işareti kapalı", "<!-- KART-BANTLAR:BITIS -->", 1);
tamKez("seyir tablosu işareti kapalı", "<!-- KART-SEYIR:BITIS -->", 1);
tamKez("başabaş tablosu işareti kapalı", "<!-- KART-BASABAS:BITIS -->", 1);

/* ------------------------------------------------------------------ */
console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " +
  kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
