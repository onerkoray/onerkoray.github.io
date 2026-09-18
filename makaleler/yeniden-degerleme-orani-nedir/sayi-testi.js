#!/usr/bin/env node
/*
 * "Yeniden değerleme oranı nedir?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının bütün sayıları iki kaynaktan türüyor: bordro/parametreler.js'teki
 * tarifeler ve seriler.js'teki oranlar. 2027 girildiğinde tablolar sessizce
 * eskir — sayfa açılır, hizalı durur, yalnızca yanlıştır.
 *
 * İKİ ÖNERME, İKİSİ DE ÖLÇÜMDE
 * ----------------------------
 * Ö1. GVK mükerrer 123'teki kural tarifeyi BİREBİR üretiyor: önceki dilim ×
 *     (1 + oran), sonra %5'i aşmayan kesir atılıyor. Yirmi dilimin yirmisi
 *     de bu aritmetiğin çıktısı.
 *     KONTROL: yanlış bir oranla aynı denetim BOZULMALI. Aksi hâlde
 *     "uygun" bayrağı hep true dönse de test geçerdi.
 *
 * Ö2. Yuvarlama TEK YÖNLÜ. Atılan kesir hiçbir dilimde negatif değil; yani
 *     tutar hiç yukarı tamamlanmamış. Yazının bütün sonucu buna dayanıyor.
 *     KONTROL: yukarı yuvarlanmış bir tutar kurala uygun SAYILMAMALI.
 *
 * MOTOR KİRLENMESİ
 * ----------------
 * fazlaVergi() karşı-olgu ölçmek için motorun tarifesini geçici olarak
 * değiştiriyor. Parametre nesnesi paylaşıldığı için geri konmazsa bütün
 * site bozulur ve bu SESSİZ bir hata olur. Test bunu ayrıca doğruluyor.
 *
 * Kullanım: node makaleler/yeniden-degerleme-orani-nedir/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var Y = require(path.join(__dirname, "ydo.js"));
var MTV = require(path.join(KOK, "mtv-hesaplama", "tarife.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var SON = B.sonYil();
var BAS = 2021;

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(m) { return HTML.split(m).length - 1; }
function gecsin(ad, m) { gecer(ad, kacKez(m) >= 1, "sayfada yok: " + m); }
function tamKez(ad, m, adet) {
  var n = kacKez(m);
  gecer(ad, n === adet, m + " " + n + " kez geçiyor, beklenen " + adet);
}
function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
function yuzde(o) { return "%" + y2(o * 100); }

function tabloSatirlari(cap) {
  var i = HTML.indexOf("<caption>" + cap);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i), son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  var blok = HTML.slice(bas, son), out = [];
  var re = /<tr>([\s\S]*?)<\/tr>/g, m;
  while ((m = re.exec(blok))) {
    var h = [], re2 = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, m2;
    while ((m2 = re2.exec(m[1]))) h.push(m2[1].replace(/<[^>]+>/g, "").trim());
    if (h.length) out.push(h);
  }
  return out;
}

console.log("Yeniden değerleme oranı yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 1 */
/* Oran tablosu. */
var t1 = tabloSatirlari("Yeniden değerleme oranı ile tüketici enflasyonu");
gecer("oran tablosu bulundu", !!t1);
if (t1) {
  var yillar = Y.oranliYillar();
  var g1 = t1.slice(1);
  gecer("oran tablosunda " + yillar.length + " satır var",
    g1.length === yillar.length, g1.length + " satır");
  yillar.forEach(function (yil, i) {
    var s = g1[i], d = Y.seri(yil);
    if (!s) { gecer("oran satır " + yil, false, "satır yok"); return; }
    gecer(yil + " satır etiketi", s[0] === String(yil), s[0]);
    gecer(yil + " YDO", s[1] === yuzde(d.ydo / 100), s[1] + " ≠ " + yuzde(d.ydo / 100));
    gecer(yil + " TÜFE", s[2] === yuzde(d.tufe / 100), s[2] + " ≠ " + yuzde(d.tufe / 100));
    var f = d.ydo - d.tufe;
    gecer(yil + " fark", s[3] === (f >= 0 ? "+" : "−") + y2(Math.abs(f)) + " puan", s[3]);
  });
}

/* ------------------------------------------------------------------ 2 */
/* Kural tablosu (son yıl) + ÖNERME 1. */
var t2 = tabloSatirlari(SON + " tarifesi adım adım");
gecer("kural tablosu bulundu", !!t2);
if (t2) {
  var d = Y.tarifeDenetimi(SON);
  var g2 = t2.slice(1);
  gecer("kural tablosunda " + d.dilimler.length + " satır var",
    g2.length === d.dilimler.length, g2.length + " satır");
  d.dilimler.forEach(function (x, i) {
    var s = g2[i];
    if (!s) return;
    gecer(x.sira + ". dilim etiketi", s[0] === x.sira + ". dilim", s[0]);
    gecer(x.sira + ". önceki tutar", s[1] === tam(x.onceki), s[1] + " ≠ " + tam(x.onceki));
    gecer(x.sira + ". oran uygulanınca", s[2] === tam(x.ham), s[2] + " ≠ " + tam(x.ham));
    gecer(x.sira + ". ilan edilen", s[3] === tam(x.ilan), s[3] + " ≠ " + tam(x.ilan));
    gecer(x.sira + ". atılan kesir", s[4] === tam(x.atilan), s[4] + " ≠ " + tam(x.atilan));
    gecer(x.sira + ". atılan oranı", s[5] === yuzde(x.atilanOran), s[5]);
  });
}

/* ÖNERME 1: kural bütün yıllarda tarifeyi üretiyor. */
(function () {
  var toplam = 0, uyan = 0;
  Y.tumDenetim().forEach(function (d) {
    d.dilimler.forEach(function (x) {
      toplam++;
      if (x.uygun) uyan++;
      gecer(d.yil + "/" + x.sira + ". dilim kurala uyuyor", x.uygun,
        "atılan " + yuzde(x.atilanOran));
    });
  });
  gecer("bütün dilimler kurala uyuyor", uyan === toplam, uyan + "/" + toplam);
  gecer("denetlenen dilim sayısı en az 20", toplam >= 20, String(toplam));

  /* KONTROL: yanlış oranla denetim BOZULMALI. Oran %30 fazla verilirse
     hesaplanan tutar büyür, atılan kesir %5'i aşar. */
  var bozuk = 0, deneme = 0;
  Y.denetlenebilirYillar().forEach(function (yil) {
    var s = Y.seri(yil);
    var eski = s.ydo;
    s.ydo = eski * 1.30 + 10;
    var d2;
    try { d2 = Y.tarifeDenetimi(yil); } finally { s.ydo = eski; }
    d2.dilimler.forEach(function (x) { deneme++; if (!x.uygun) bozuk++; });
  });
  gecer("KONTROL: yanlış oranda denetim bozuluyor", bozuk > deneme * 0.5,
    bozuk + "/" + deneme + " dilim kuralı ihlal etti");
})();

/* ÖNERME 2: yuvarlama tek yönlü — atılan kesir hiç negatif değil. */
(function () {
  var negatif = 0, toplam = 0;
  Y.tumDenetim().forEach(function (d) {
    d.dilimler.forEach(function (x) {
      toplam++;
      if (x.atilan < -0.005) negatif++;
    });
  });
  gecer("yuvarlama hiçbir dilimde yukarı değil", negatif === 0,
    negatif + "/" + toplam + " dilimde yukarı tamamlanmış");

  /* KONTROL: yukarı tamamlanmış bir tutar kurala uygun SAYILMAMALI.
     Son yılın ilk dilimi elle yukarı çekilip denetim yeniden koşuluyor. */
  var P = B.parametre(SON);
  var eski = P.dilimler;
  P.dilimler = eski.map(function (x, i) {
    return i === 0 && x[0] !== null ? [x[0] * 1.5, x[1]] : x;
  });
  var d3;
  try { d3 = Y.tarifeDenetimi(SON); } finally { P.dilimler = eski; }
  gecer("KONTROL: yukarı yuvarlanmış tutar kurala uymuyor",
    d3.dilimler[0] && !d3.dilimler[0].uygun, "ilk dilim hâlâ uygun sayıldı");
})();

/* ------------------------------------------------------------------ 3 */
/* Özet tablosu. */
var t3 = tabloSatirlari("Kural her yıl tarifeyi birebir üretiyor mu");
gecer("özet tablosu bulundu", !!t3);
if (t3) {
  var liste = Y.tumDenetim();
  var g3 = t3.slice(1);
  gecer("özet tablosunda " + liste.length + " satır var",
    g3.length === liste.length, g3.length + " satır");
  liste.forEach(function (d, i) {
    var s = g3[i];
    if (!s) return;
    var n = d.dilimler.length;
    var uyan = d.dilimler.filter(function (x) { return x.uygun; }).length;
    var enCok = d.dilimler.reduce(function (e, x) { return Math.max(e, x.atilanOran); }, 0);
    var top = d.dilimler.reduce(function (t, x) { return t + x.atilan; }, 0);
    gecer(d.yil + " özet oranı", s[1] === yuzde(d.ydo / 100), s[1]);
    gecer(d.yil + " uyan dilim", s[2] === uyan + " / " + n, s[2]);
    gecer(d.yil + " en büyük kesir", s[3] === yuzde(enCok), s[3]);
    gecer(d.yil + " toplam atılan", s[4] === tam(top) + " TL", s[4]);
  });
}

/* ------------------------------------------------------------------ 4 */
/* Bedel tablosu + motor kirlenmesi. */
var t4 = tabloSatirlari("Yuvarlama olmasaydı");
gecer("bedel tablosu bulundu", !!t4);
if (t4) {
  var oncekiTarife = JSON.stringify(B.parametre(SON).dilimler);
  var asgari = B.donem(B.parametre(SON), 1).asgariBrut;
  var g4 = t4.slice(1);
  gecer("bedel tablosunda satır var", g4.length >= 4, g4.length + " satır");
  g4.forEach(function (s) {
    var kat = Number((s[0].match(/^(\d+)/) || [0, 0])[1]);
    if (!kat) return;
    var brut = asgari * kat;
    var r = Y.fazlaVergi(brut, BAS, SON);
    gecer(s[0] + " aylık brüt", s[1] === tam(brut), s[1] + " ≠ " + tam(brut));
    gecer(s[0] + " ödenen vergi", s[2] === tam(r.gercek), s[2] + " ≠ " + tam(r.gercek));
    gecer(s[0] + " yuvarlamasız", s[3] === tam(r.yuvarlamasiz), s[3]);
    gecer(s[0] + " fazla ödenen",
      s[4] === (r.fazla < 0.5 ? "—" : tam(r.fazla) + " TL"), s[4]);
    /* Fazla ödenen negatif olamaz: yuvarlama aşağı olduğu için gerçek
       tarife her zaman daha çok vergi üretir. */
    gecer(s[0] + " fazla ödenen negatif değil", r.fazla >= -0.005, y2(r.fazla));
  });
  /* MOTOR KİRLENMESİ: tarife geri konmuş olmalı. */
  gecer("motorun tarifesi bozulmadı",
    JSON.stringify(B.parametre(SON).dilimler) === oncekiTarife,
    "fazlaVergi() tarifeyi geri koymamış");
}

/* Birikmiş fark: asgari ücretlide sıfır olmalı. */
(function () {
  var asgari = B.donem(B.parametre(SON), 1).asgariBrut;
  var r = Y.fazlaVergi(asgari, BAS, SON);
  gecer("asgari ücretlide fazla ödeme yok", Math.abs(r.fazla) < 0.005, y2(r.fazla));
  /* KONTROL: üst gelirde fazla ödeme VAR — sıfır her yerde olsaydı ölçüm
     bozuk demekti. */
  var u = Y.fazlaVergi(asgari * 5, BAS, SON);
  gecer("KONTROL: 5× asgaride fazla ödeme var", u.fazla > 1000, tam(u.fazla));
})();

/* ------------------------------------------------------------------ 5 */
/* MTV: ilan edilen oranla uygulanan oran ayrışıyor. */
(function () {
  var ydo = Y.seri(SON).ydo;
  var mtv = MTV.YENIDEN_DEGERLEME * 100;
  gecer("MTV modülü " + SON + " yılına ait", MTV.YIL === SON, String(MTV.YIL));
  gecer("MTV oranı YDO'dan farklı", Math.abs(ydo - mtv) > 0.005,
    "YDO " + y2(ydo) + " / MTV " + y2(mtv));
  gecer("MTV oranı YDO'nun altında", mtv < ydo, y2(mtv) + " vs " + y2(ydo));
  gecsin("MTV oranı metinde", "%" + y2(mtv));
  gecsin("aradaki puan farkı metinde", y2(ydo - mtv) + " puan");
})();

/* ------------------------------------------------------------------ 6 */
/* Metindeki sayılar. */
(function () {
  var ydo = Y.seri(SON).ydo;
  var tufe = Y.seri(SON).tufe;
  tamKez("son yıl oranı metinde", "%" + y2(ydo), 6);
  /* 2 kez: JSON-LD SSS ve sayfadaki SSS. Tabloda "%30,89" degil,
     uretecin bicimledigi hali geciyor. */
  tamKez("son yıl TÜFE'si metinde", "%" + y2(tufe), 2);
  var f = Y.birikmisFark(BAS, SON);
  gecsin("1. dilim eksiği", "%" + y2(f[0].eksikOran * 100));
  gecsin("2. dilim eksiği", "%" + y2(f[1].eksikOran * 100));
  gecsin("kesir kuralı metinde", "yüzde 5'ini aşmayan kesir");
  gecsin("yirmi dilim iddiası", "yirmi");
})();

/* ------------------------------------------------------------------ 7 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecsin("ORCID bağlantısı", "https://orcid.org/0009-0005-8730-3577");
gecsin("ScholarlyArticle şeması", '"@type": "ScholarlyArticle"');
gecsin("kardeş yazıya bağlantı", "../dilim-kaymasi-2022-2026/");
["YDO-ORAN", "YDO-KURAL", "YDO-OZET", "YDO-BEDEL"].forEach(function (a) {
  tamKez(a + " işareti kapalı", "<!-- " + a + ":BITIS -->", 1);
});

/* ------------------------------------------------------------------ */
console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " +
  kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
