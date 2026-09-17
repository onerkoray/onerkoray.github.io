#!/usr/bin/env node
/*
 * "İkramiye hangi ay ödenmeli?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının bütün sayıları bordro/parametreler.js'ten türüyor: SGK tavanı,
 * asgari ücret dönemleri, gelir vergisi tarifesi. 2027 girildiğinde sayfa
 * bozulmaz, hizalı durur ve yalnızca yanlış olur.
 *
 * DÖRT ÖNERME, DÖRDÜ DE ÖLÇÜMDE
 * -----------------------------
 * Ö1 ay seçimi nötr      — KONTROL: iki dönemli yılda nötr DEĞİL
 * Ö2 tavan nötrlüğü kırar — KONTROL: tavan altında fark TAM sıfır
 * Ö3 prim ve vergi ters yönde hareket eder
 * Ö4 etki doyuma ulaşır  — KONTROL: doyumdan önce hâlâ değişiyor
 *
 * Her önermenin yanında kontrolü var. Kontrol olmadan, ölçüm hep aynı
 * sayıyı döndürse bile test geçerdi.
 *
 * Kullanım: node makaleler/ikramiye-hangi-ay-odenmeli/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var I = require(path.join(__dirname, "ikramiye.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var YIL = B.sonYil();
var ASGARI = B.donem(B.parametre(YIL), 1).asgariBrut;

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

console.log("İkramiye zamanlaması yazısı — sayı doğrulaması\n");

var YILLAR = I.kapsananYillar().slice().sort(function (a, b) { return a - b; });

/* ------------------------------------------------------------------ 1 */
/* Ay tablosu + ÖNERME 1. */
var t1 = tabloSatirlari("Ay seçimi yıllık neti değiştiriyor mu");
gecer("ay tablosu bulundu", !!t1);
if (t1) {
  var g1 = t1.slice(1);
  gecer("ay tablosunda " + YILLAR.length + " satır var",
    g1.length === YILLAR.length, g1.length + " satır");
  YILLAR.forEach(function (y, i) {
    var s = g1[i];
    if (!s) { gecer("ay satır " + y, false, "satır yok"); return; }
    var a = B.donem(B.parametre(y), 1).asgariBrut;
    var f = I.aySecimiFarki(a * 5, a * 20, y);
    var tavanMetni = I.tavanlar(y).map(function (x) { return tam(x.sgkTavan); }).join(" → ");
    gecer(y + " satır etiketi", s[0] === String(y), s[0]);
    gecer(y + " tavan metni", s[1] === tavanMetni, s[1] + " ≠ " + tavanMetni);
    gecer(y + " tavan sabit mi",
      s[2] === (I.tavanSabitMi(y) ? "Evet" : "Hayır, Temmuz'da değişiyor"), s[2]);
    gecer(y + " ay farkı",
      s[3] === (f.fark < 0.005 ? "Fark yok" : tam(f.fark) + " TL"), s[3]);
  });
}

/* ÖNERME 1: tavan sabitse ay seçimi TAM nötr. */
var sabitYil = 0, degisenYil = 0;
YILLAR.forEach(function (y) {
  var a = B.donem(B.parametre(y), 1).asgariBrut;
  var f = I.aySecimiFarki(a * 5, a * 20, y);
  if (I.tavanSabitMi(y)) {
    sabitYil++;
    gecer(y + " — tavan sabit, ay seçimi nötr", f.fark < 0.005, tam(f.fark) + " TL fark");
  } else {
    degisenYil++;
    /* KONTROL: tavan değişen yılda nötrlük BOZULMALI. */
    gecer(y + " — KONTROL: tavan değişiyor, ay seçimi nötr DEĞİL",
      f.fark > 1, tam(f.fark) + " TL fark");
  }
});
gecer("her iki yıl türü de örneklendi", sabitYil >= 1 && degisenYil >= 1,
  sabitYil + " sabit, " + degisenYil + " değişen");

/* Nötr yılda on iki ayın hepsi birebir aynı olmalı. */
(function () {
  var l = I.aylaraGore(ASGARI * 5, ASGARI * 20, YIL).map(function (x) { return x.net; });
  gecer(YIL + " — on iki ayın neti birebir aynı",
    Math.max.apply(null, l) - Math.min.apply(null, l) < 0.005);
  gecer(YIL + " — on iki ay ölçüldü", l.length === 12);
})();

/* ------------------------------------------------------------------ 2 */
/* Eşik tablosu + ÖNERME 2. */
var t2 = tabloSatirlari("Zamanlamanın fark etmeye başladığı ikramiye tutarı");
gecer("eşik tablosu bulundu", !!t2);
if (t2) {
  var g2 = t2.slice(1);
  gecer("eşik tablosunda satır var", g2.length >= 3, g2.length + " satır");
  g2.forEach(function (s) {
    var brut = Number(s[0].replace(/\./g, "").replace(" TL", ""));
    var esik = I.kirilmaEsigi(brut, YIL, 12);
    var tavan = I.ayinTavani(YIL, 12);
    gecer(s[0] + " eşik", s[2] === tam(esik) + " TL", s[2] + " ≠ " + tam(esik) + " TL");
    gecer(s[0] + " tavan", s[3] === tam(tavan) + " TL", s[3]);
    /* Eşik tanımı gereği: brüt + eşik = tavan. */
    gecer(s[0] + " brüt + eşik = tavan", Math.abs(brut + esik - tavan) < 0.005);

    /* ÖNERME 2: eşiğin ALTINDA fark tam sıfır, ÜSTÜNDE değil. */
    var alti = I.parcaKarsilastirmasi(brut, Math.max(0, esik - 1000), YIL, [1, 12]);
    gecer(s[0] + " eşiğin altında fark YOK",
      Math.abs(alti[1].netFark) < 0.005, tam(alti[1].netFark) + " TL");
    var ustu = I.parcaKarsilastirmasi(brut, esik + 100000, YIL, [1, 12]);
    gecer(s[0] + " KONTROL: eşiğin üstünde fark VAR",
      ustu[1].netFark < -1, tam(ustu[1].netFark) + " TL");
  });
}

/* ------------------------------------------------------------------ 3 */
/* Parça tablosu + ÖNERME 3 ve 4. */
var t3 = tabloSatirlari("Aynı ikramiye kaç ödemeye bölünürse");
gecer("parça tablosu bulundu", !!t3);
if (t3) {
  var g3 = t3.slice(1);
  var brut = ASGARI * 5, ik = ASGARI * 20;
  var liste = I.parcaKarsilastirmasi(brut, ik, YIL, [1, 2, 3, 4, 6, 12]);
  gecer("parça tablosunda " + liste.length + " satır var", g3.length === liste.length,
    g3.length + " satır");
  g3.forEach(function (s, i) {
    var o = liste[i];
    if (!o) return;
    gecer(o.parca + " ödeme etiketi", s[0] === o.parca + " ödemede", s[0]);
    gecer(o.parca + " SGK", s[1] === tam(o.sgk) + " TL", s[1] + " ≠ " + tam(o.sgk) + " TL");
    gecer(o.parca + " gelir vergisi", s[2] === tam(o.gelirVergisi) + " TL",
      s[2] + " ≠ " + tam(o.gelirVergisi) + " TL");
    gecer(o.parca + " net", s[3] === tam(o.net) + " TL", s[3] + " ≠ " + tam(o.net) + " TL");
    gecer(o.parca + " net fark",
      s[4] === (Math.abs(o.netFark) < 0.5 ? "—" : tam(o.netFark) + " TL"), s[4]);
    gecer(o.parca + " işveren farkı",
      s[5] === (Math.abs(o.isverenFark) < 0.5 ? "—" : tam(o.isverenFark) + " TL"), s[5]);
  });

  /* ÖNERME 3: parça arttıkça SGK ARTAR, gelir vergisi AZALIR. */
  for (var i = 1; i < liste.length; i++) {
    var o = liste[i], onc = liste[i - 1];
    if (Math.abs(o.net - onc.net) < 0.005) continue;   /* doyum sonrası */
    gecer(onc.parca + "→" + o.parca + " SGK artıyor", o.sgk > onc.sgk + 0.005);
    gecer(onc.parca + "→" + o.parca + " gelir vergisi AZALIYOR",
      o.gelirVergisi < onc.gelirVergisi - 0.005,
      tam(o.gelirVergisi) + " vs " + tam(onc.gelirVergisi));
    gecer(onc.parca + "→" + o.parca + " net düşüyor", o.net < onc.net - 0.005);
  }

  /* ÖNERME 4: doyum. Her taksit tavanın altına inince etki duruyor. */
  var son = liste[liste.length - 1], onceki = liste[liste.length - 2];
  gecer("doyum: son iki bölme aynı sonucu veriyor",
    Math.abs(son.net - onceki.net) < 0.005, tam(son.net - onceki.net) + " TL");
  /* KONTROL: doyumdan ÖNCE hâlâ değişiyor olmalı. */
  gecer("KONTROL: doyumdan önce net hâlâ değişiyor",
    Math.abs(liste[1].net - liste[0].net) > 1);
  /* Doyum noktasında taksit gerçekten tavanın altında mı? */
  gecer("doyumda taksit tavanın altında",
    brut + ik / son.parca <= I.ayinTavani(YIL, 12) + 0.005);

  /* İşveren kazancı çalışanınkinden büyük. */
  var enSon = liste[liste.length - 1];
  gecer("işveren kazancı çalışanınkinden büyük",
    Math.abs(enSon.isverenFark) > Math.abs(enSon.netFark),
    tam(enSon.isverenFark) + " vs " + tam(enSon.netFark));
  /* Yönler zıt: çalışanın neti düşerken işveren maliyeti artıyor. */
  gecer("bölmek iki tarafın da aleyhine",
    enSon.netFark < 0 && enSon.isverenFark > 0);
}

/* ------------------------------------------------------------------ 4 */
/* Kapsam koruması. */
(function () {
  var patladi = false;
  try { I.dagit(ASGARI - 1, 100000, YIL, 1); } catch (e) { patladi = true; }
  gecer("asgari ücretin altı reddediliyor", patladi);
  var gecti = true;
  try { I.dagit(ASGARI, 100000, YIL, 1); } catch (e) { gecti = false; }
  gecer("asgari ücretin kendisi kabul ediliyor", gecti);
  var parcaHata = false;
  try { I.dagit(ASGARI * 5, 100000, YIL, 13); } catch (e) { parcaHata = true; }
  gecer("13 parça reddediliyor", parcaHata);
})();

/* ------------------------------------------------------------------ 5 */
/* Metindeki sayılar. */
(function () {
  var tavan = I.ayinTavani(YIL, 12);
  tamKez("SGK tavanı metinde", tam(tavan), 5);
  gecsin("yıl metinde", String(YIL));
  gecsin("iki dönemli yıllar anılıyor", "2022 ve 2023");
  gecsin("kümülatif formül", "tarife(birikim + matrah) − tarife(birikim)");
})();

/* ------------------------------------------------------------------ 6 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecsin("ORCID bağlantısı", "https://orcid.org/0009-0005-8730-3577");
gecsin("ScholarlyArticle şeması", '"@type": "ScholarlyArticle"');
gecsin("kardeş yazıya bağlantı", "../iki-isten-maas-beyanname-siniri/");
tamKez("ay tablosu işareti kapalı", "<!-- IKRAMIYE-AY:BITIS -->", 1);
tamKez("eşik tablosu işareti kapalı", "<!-- IKRAMIYE-ESIK:BITIS -->", 1);
tamKez("parça tablosu işareti kapalı", "<!-- IKRAMIYE-PARCA:BITIS -->", 1);

/* ------------------------------------------------------------------ */
console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " +
  kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
