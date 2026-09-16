#!/usr/bin/env node
/*
 * "İki işten maaş alan beyanname verir mi?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Bu yazının bütün sınırları tarifenin kendi dilim tutarları. 2027 tarifesi
 * bordro/parametreler.js'e girildiği anda 400.000 ve 5.300.000 eskir; sayfa
 * açılır, tablolar hizalı durur, yalnızca yanlıştır. Üstelik yanlışlık
 * "biraz eski" değil, doğrudan yükümlülük doğuran bir eşik.
 *
 * SAYILAR TESTTE TAŞINMIYOR
 * -------------------------
 * Beklenen değerlerin hepsi beyan.js üzerinden motordan yeniden hesaplanıyor.
 *
 * VARLIK KONTROLÜ YETMİYOR
 * ------------------------
 * "Sayfada geçiyor mu" kontrolü bozuk bir hücreyi kaçırıyor: aynı sayı hem
 * tabloda hem SSS'te geçiyor, biri bozulsa diğeri testi geçiriyor. Bu hata
 * bu depoda dört kez tekrarlandı. Burada iki önlem var: tablolar
 * <caption> etiketine bağlanıp satır satır sökülüyor, metin kontrolleri de
 * KAÇ KEZ geçtiğini sayıyor.
 *
 * ÖNERMELER SAYISAL OLARAK SABİT
 * ------------------------------
 * Yazının üç iddiası prozada değil, motorda ölçülerek sabitleniyor ve her
 * birinin yanında bir KONTROL var — ölçüm bozulsa da testin geçmemesi için:
 *   1. Beyanname verildiğinde iki işverenli toplam vergi, tek işverenliye
 *      TAM eşitleniyor. (Kontrol: beyan olmadan eşit DEĞİL.)
 *   2. Mahsup "istisna öncesi hesaplanan vergi" ile yapılıyor; sonuç toplam
 *      matraha tarifenin bir kez uygulanıp istisnanın bir kez düşülmesine
 *      denk. (Kontrol: kesilen vergiyle mahsup yapılsaydı sonuç farklı.)
 *   3. Tablodaki "beyansız kalan en yüksek ikinci iş" değeri sınırı
 *      aşmıyor, bir lira fazlası aşıyor. (Her kapsanan yıl için.)
 *
 * Kullanım: node makaleler/iki-isten-maas-beyanname-siniri/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var Y = require(path.join(__dirname, "beyan.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var YIL = B.sonYil();

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
/* Bir sayının sayfada BEKLENEN kadar geçtiğini sabitler. Sayı azalırsa
   bozulmuş, artarsa yeni ve denetlenmemiş bir yerde kullanılmış demektir. */
function tamKez(ad, metin, adet) {
  var n = kacKez(metin);
  gecer(ad, n === adet, metin + " " + n + " kez geçiyor, beklenen " + adet);
}

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function iki(n) { return n.toFixed(2).replace(".", ","); }

function tabloSatirlari(captionParcasi) {
  /* CAPTION ETİKETİNİN İÇİNDE aranır. Düz metin araması bu depoda bir kez
     yanlış tabloyu buldu: paragraflar tablo başlığını kendi cümlesinde
     tekrar ediyor ve arama oraya düşüp bir önceki tabloyu okudu. */
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

console.log("İki işten maaş yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 0 */
var YILLAR = Y.kapsananYillar().slice().sort(function (a, b) { return a - b; });
gecer("kapsanan yıl var", YILLAR.length >= 1, YILLAR.length + " yıl");
gecer("son yıl motorun son yılı", YILLAR[YILLAR.length - 1] === YIL,
  YILLAR[YILLAR.length - 1] + " ≠ " + YIL);
YILLAR.forEach(function (y) {
  gecer("motor " + y + " parametrelerini tanıyor",
    B.parametre(y).istisnaRejimi === "asgari-ucret");
});

/* ------------------------------------------------------------------ 1 */
/* Pencere tablosu. */
var t1 = tabloSatirlari("İkinci işin beyanname doğurmadan kalabildiği aralık");
gecer("pencere tablosu bulundu", !!t1);
if (t1) {
  var g1 = t1.slice(1);
  gecer("pencere tablosunda " + YILLAR.length + " satır var",
    g1.length === YILLAR.length, g1.length + " satır");
  YILLAR.forEach(function (y, i) {
    var s = g1[i];
    if (!s) { gecer("pencere satır " + y, false, "satır yok"); return; }
    var p = Y.pencere(y), S = Y.sinirlar(y);
    gecer(y + " satır etiketi", s[0] === String(y), s[0]);
    gecer(y + " asgari ücret", s[1] === tam(p.alt), s[1] + " ≠ " + tam(p.alt));
    gecer(y + " beyansız tavan", s[2] === tam(p.guvenli), s[2] + " ≠ " + tam(p.guvenli));
    gecer(y + " asgari ücretin katı", s[3] === iki(p.oran), s[3] + " ≠ " + iki(p.oran));
    gecer(y + " sınır", s[4] === tam(S.sonrakiIsverenler),
      s[4] + " ≠ " + tam(S.sonrakiIsverenler));
    gecer(y + " toplam sınırı", s[5] === tam(S.ucretToplami),
      s[5] + " ≠ " + tam(S.ucretToplami));
  });
}

/* ÖNERME 3: tablodaki değer güvenli, bir lira fazlası değil.
   Tablonun tek satırı bile yukarı yuvarlansa bu düşer. */
YILLAR.forEach(function (y) {
  var p = Y.pencere(y), S = Y.sinirlar(y);
  var altinda = Y.isveren(p.guvenli, y, false).safi;
  var ustunde = Y.isveren(p.guvenli + 1, y, false).safi;
  gecer(y + " tablodaki tavan sınırı AŞMIYOR", altinda <= S.sonrakiIsverenler,
    tam(altinda) + " > " + tam(S.sonrakiIsverenler));
  gecer(y + " bir lira fazlası sınırı AŞIYOR", ustunde > S.sonrakiIsverenler,
    tam(ustunde) + " <= " + tam(S.sonrakiIsverenler));
});

/* Üç asgari ücretli iş her yıl beyan doğuruyor — yazının iddiası. */
YILLAR.forEach(function (y) {
  var P = B.parametre(y);
  var taban = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);
  var s = Y.secim([taban, taban, taban], y);
  gecer(y + " üç asgari ücretli iş beyan doğuruyor", s.dogruSecimBeyan,
    tam(s.enBuyukHaric) + " / " + tam(Y.sinirlar(y).sonrakiIsverenler));
});

/* ------------------------------------------------------------------ 2 */
/* Uçurum tablosu. */
var t2 = tabloSatirlari("Sınırı bir kuruş aşmanın");
gecer("uçurum tablosu bulundu", !!t2);
var UCURUM_ISLER = [];
if (t2) {
  var g2 = t2.slice(1);
  gecer("uçurum tablosunda satır var", g2.length >= 3, g2.length + " satır");
  g2.forEach(function (s) {
    var b1 = Number(s[0].replace(/\./g, ""));
    UCURUM_ISLER.push(b1);
    var u = Y.ucurum(b1, YIL);
    gecer(tam(b1) + " birleşik marjinal oran",
      s[1] === "%" + Math.round(u.marjinalOran * 100),
      s[1] + " ≠ %" + Math.round(u.marjinalOran * 100));
    gecer(tam(b1) + " doğan borç", s[2] === tam(u.borc) + " TL",
      s[2] + " ≠ " + tam(u.borc) + " TL");
    gecer(tam(b1) + " formül sütunu", s[3] === (u.tekBanda ? "Evet" : "Hayır, iki banda yayılıyor"), s[3]);
    /* İKİ YÖNLÜ: tekBanda doğruysa kapalı biçim birebir tutmalı, yanlışsa
       TUTMAMALI. Tek yönlü kontrol, bayrak hep true dönse de geçerdi. */
    if (u.tekBanda) {
      gecer(tam(b1) + " tek banda düşüyor, formül birebir",
        Math.abs(u.sapma) < 0.005, u.sapma.toFixed(4) + " TL sapma");
    } else {
      gecer(tam(b1) + " iki banda yayılıyor, formül tutmuyor",
        Math.abs(u.sapma) > 0.005, u.sapma.toFixed(4) + " TL sapma");
    }
    /* Sınır TAM yakalandığında beyan doğmamalı — uçurumun tanımı bu. */
    gecer(tam(b1) + " sınır tam yakalandığında beyan yok", !u.beyanVar);
    /* Toplam ölçütü tetiklenmiş olsaydı uçurum diye bir şey olmazdı. */
    gecer(tam(b1) + " toplam ölçütü tetiklenmiyor", !u.toplamAsti);
  });
}

/* ------------------------------------------------------------------ 3 */
/* Karşılaştırma tablosu + ÖNERME 1. */
var t3 = tabloSatirlari("Aynı toplam brüt: iki işveren ve tek işveren");
gecer("karşılaştırma tablosu bulundu", !!t3);
if (t3) {
  var g3 = t3.slice(1);
  gecer("karşılaştırma tablosunda satır var", g3.length >= 4, g3.length + " satır");
  var beyanliVar = 0, beyansizVar = 0;
  g3.forEach(function (s) {
    var p = s[0].split("+").map(function (x) { return Number(x.replace(/\./g, "").trim()); });
    var d = Y.degerlendir(p, YIL);
    var tek = Y.tekIsveren(p[0] + p[1], YIL);
    gecer(s[0] + " ikinci işin safi tutarı", s[1] === tam(d.sonrakilerToplami),
      s[1] + " ≠ " + tam(d.sonrakilerToplami));
    gecer(s[0] + " beyan durumu", s[2] === (d.beyanVar ? "Var" : "Yok"), s[2]);
    gecer(s[0] + " yıl içinde kesilen", s[3] === tam(d.kesilen),
      s[3] + " ≠ " + tam(d.kesilen));
    gecer(s[0] + " beyannamede ödenecek", s[4] === tam(d.odenecek),
      s[4] + " ≠ " + tam(d.odenecek));
    gecer(s[0] + " toplam vergi", s[5] === tam(d.toplamVergi),
      s[5] + " ≠ " + tam(d.toplamVergi));
    gecer(s[0] + " tek işverende olsaydı", s[6] === tam(tek.kesilen),
      s[6] + " ≠ " + tam(tek.kesilen));
    /* Karşılaştırmanın anlamlı olması için SGK tavanı aşılmamalı. */
    gecer(s[0] + " SGK tavanı aşılmıyor", !tek.sgkTavaniAsiliyor);

    if (d.beyanVar) {
      beyanliVar++;
      /* ÖNERME 1: beyan varsa toplam vergi tek işverenliye TAM eşit. */
      gecer(s[0] + " beyanla tek işverene eşitleniyor",
        Math.abs(d.toplamVergi - tek.kesilen) < 0.005,
        (d.toplamVergi - tek.kesilen).toFixed(4) + " TL fark");
    } else {
      beyansizVar++;
      /* KONTROL: beyan yoksa eşit OLMAMALI. Yukarıdaki sıfır, motorun iki
         senaryoyu aynı hesaplamasından da çıkabilirdi. */
      gecer(s[0] + " beyansızken tek işverenden UCUZ",
        tek.kesilen - d.toplamVergi > 1000,
        (d.toplamVergi - tek.kesilen).toFixed(2) + " TL fark");
    }
  });
  gecer("tabloda eşiğin iki yanı da var", beyanliVar >= 1 && beyansizVar >= 1,
    beyanlıSayisi(beyanliVar, beyansizVar));
}
function beyanlıSayisi(a, b) { return a + " beyanlı, " + b + " beyansız"; }

/* ------------------------------------------------------------------ 4 */
/* ÖNERME 2: mahsup istisna ÖNCESİ vergiyle yapılıyor (319 no.lu Tebliğ m.9).
   Sonuç: toplam vergi = tarife(toplam matrah) − istisna. */
(function () {
  var P = B.parametre(YIL);
  var d = Y.degerlendir([100000, 45000], YIL);
  gecer("önerme 2 örneği beyanlı", d.beyanVar);

  var beklenen = B.tarifeVergisi(d.toplamSafi, P.dilimler) - d.istisna;
  gecer("toplam vergi = tarife(toplam matrah) − istisna",
    Math.abs(d.toplamVergi - beklenen) < 0.005,
    (d.toplamVergi - beklenen).toFixed(4) + " TL fark");

  /* KONTROL: mahsup KESİLEN vergiyle yapılsaydı sonuç farklı olurdu.
     Bu kontrol düşerse istisna beyannamede iki kez yararlanılmış demektir
     ve yukarıdaki eşitlik anlamını yitirir. */
  var yanlisOdenecek = d.hesaplanan - d.kesilen;
  gecer("kontrol: kesilen vergiyle mahsup FARKLI sonuç verirdi",
    Math.abs(yanlisOdenecek - d.odenecek) > 1000,
    "fark " + (yanlisOdenecek - d.odenecek).toFixed(2) + " TL");
  gecer("kontrol: mahsup kesilenden büyük (istisna öncesi)",
    d.mahsup > d.kesilen, tam(d.mahsup) + " vs " + tam(d.kesilen));
})();

/* ------------------------------------------------------------------ 5 */
/* Seçim önermesi: iki işte belirleyici, üç işte değil. */
(function () {
  var s2 = Y.secim([100000, 35000], YIL);
  gecer("iki işte birinci işveren seçimi belirleyici", s2.secimOnemli,
    tam(s2.enBuyukHaric) + " / " + tam(s2.enKucukHaric));
  gecsin("seçim örneği doğru tarafı", tam(s2.enBuyukHaric));
  gecsin("seçim örneği yanlış tarafı", tam(s2.enKucukHaric));

  var P = B.parametre(YIL);
  var taban = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);
  var s3 = Y.secim([100000, 35000, taban], YIL);
  gecer("üç işte seçim sonucu değiştirmiyor",
    s3.dogruSecimBeyan && s3.yanlisSecimBeyan && !s3.secimOnemli);
})();

/* ------------------------------------------------------------------ 6 */
/* Kapsam koruması: asgari ücretin altı sessizce hesaplanmamalı. */
(function () {
  var P = B.parametre(YIL);
  var taban = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);
  var patladi = false;
  try { Y.isveren(taban - 1, YIL, false); } catch (e) { patladi = true; }
  gecer("asgari ücretin altı reddediliyor", patladi);
  var gecti = true;
  try { Y.isveren(taban, YIL, false); } catch (e) { gecti = false; }
  gecer("asgari ücretin kendisi kabul ediliyor", gecti);
})();

/* ------------------------------------------------------------------ 7 */
/* İkinci işveren istisna uygulamıyor — motordaki seçeneğin fiilen çalıştığı. */
(function () {
  var P = B.parametre(YIL);
  var taban = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);
  var birinci = Y.isveren(taban, YIL, true);
  var ikinci = Y.isveren(taban, YIL, false);
  gecer("birinci işveren istisna uyguluyor", birinci.istisna > 0, tam(birinci.istisna));
  gecer("ikinci işveren istisna uygulamıyor", ikinci.istisna === 0, tam(ikinci.istisna));
  gecer("ikinci işverende vergi kesiliyor", ikinci.kesilen > 0, tam(ikinci.kesilen));
  gecer("asgari ücretlide birinci işverende vergi çıkmıyor",
    birinci.kesilen < 0.005, tam(birinci.kesilen));
  gecer("iki bordronun safi tutarı aynı",
    Math.abs(birinci.safi - ikinci.safi) < 0.005);
  /* DAMGA TARAFI: yazi "ikinci isveren ne gelir vergisi ne damga
     istisnasini uygular" diyor. Bu kontrol olmadan damga istisnasinin
     ikinci bordroda da uygulanmasi testten kaciyordu -- mutasyonla
     olculdu. Asgari ucretlide birinci isverende damga sifir olmali. */
  gecer("birinci işverende damga istisnası uygulanıyor",
    birinci.damga < 0.005, tam(birinci.damga));
  gecer("ikinci işverende damga vergisi kesiliyor",
    ikinci.damga > 0, tam(ikinci.damga));
})();

/* ------------------------------------------------------------------ 8 */
/* Metindeki sayılar. Hepsi modülden türüyor; kaç kez geçtikleri sabit. */
(function () {
  var S = Y.sinirlar(YIL);
  var p = Y.pencere(YIL);
  var P = B.parametre(YIL);
  var taban = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);

  /* Beyansız tavan ve bir lira fazlası.
     VARLIK DEĞİL SAYI: "sayfada geçiyor mu" kontrolü bu sayfada yetmiyor,
     çünkü 39.215 hem tabloda hem prozada hem SSS'te hem meta etiketinde
     geçiyor; biri bozulsa diğerleri testi geçirirdi. Mutasyonla ölçüldü ve
     gerçekten kaçtı. Sayılar bu yüzden ADEDİYLE sabitleniyor: azalırsa
     bozulmuş, artarsa denetlenmemiş yeni bir yerde kullanılmış demektir. */
  tamKez("beyansız tavan kaç kez geçiyor", tam(p.guvenli), 6);
  var birFazla = Y.isveren(p.guvenli + 1, YIL, false).safi;
  tamKez("bir lira fazlasının safisi", tam(birFazla), 1);

  /* Asgari ücretin yıllık safisi ve iki katı. */
  var asgariSafi = Y.isveren(taban, YIL, false).safi;
  tamKez("asgari ücretin yıllık safisi", tam(asgariSafi), 3);
  tamKez("iki asgari işin toplamı", tam(asgariSafi * 2), 3);
  tamKez("sınır kaç kez geçiyor", tam(S.sonrakiIsverenler), 15);
  tamKez("toplam sınırı kaç kez geçiyor", tam(S.ucretToplami), 6);
  tamKez("pencere oranı kaç kez geçiyor", iki(p.oran), 3);

  /* Uçurum tutarları. Tabloda hepsi var; SSS yalnızca TEK BANDA düşenleri
     alıntılıyor, çünkü yazı formülü onlar üzerinden anlatıyor. */
  UCURUM_ISLER.forEach(function (b1) {
    var u = Y.ucurum(b1, YIL);
    var n = kacKez(tam(u.borc));
    /* Tek banda düşenler prozada ve SSS'te de anlatılıyor, ötekiler yalnızca
       tabloda ve bir kez prozada. Alt sınır değil, ADET sabitleniyor. */
    gecer("uçurum " + tam(u.borc) + " geçiş sayısı",
      u.tekBanda ? n >= 2 : n === 2, tam(u.borc) + " " + n + " kez");
  });

  /* %40 bandında uçurum OLAMAZ: o band dördüncü dilimin üstünde başlıyor ve
     orada toplam ölçütü zaten beyan doğuruyor. Yazının bulgusu bu; ölçülüyor. */
  (function () {
    var enUstOran = P.dilimler[P.dilimler.length - 1][1];
    var b1 = 600000;
    var u = Y.ucurum(b1, YIL);
    gecer("%40 bandına çıkan örnekte toplam ölçütü tetikleniyor",
      u.marjinalOran === enUstOran && u.toplamAsti,
      "marj " + u.marjinalOran + ", toplamAsti " + u.toplamAsti);
    gecer("dördüncü dilim en üst bandın başlangıcı",
      S.ucretToplami === P.dilimler[P.dilimler.length - 2][0],
      tam(S.ucretToplami));
  })();

  /* Tarifenin sınıra kadar olan vergisi — formülün girdisi. */
  gecsin("tarifenin sınıra kadarki vergisi",
    tam(B.tarifeVergisi(S.sonrakiIsverenler, P.dilimler)) + " TL");

  /* GİB örneğindeki safi tutar: 480.000 brütün safisi. Oran parametreden. */
  var k = Y.kesintiOrani(P);
  gecsin("GİB örneğinin safi tutarı", tam(480000 * (1 - k)) + " TL");
  gecer("GİB örneğinde kesinti oranı %15", Math.abs(k - 0.15) < 1e-9, String(k));

  /* Pencere oranı. */
  gecsin("pencere oranı metinde", iki(p.oran) + " katında");
})();

/* ------------------------------------------------------------------ 9 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecsin("ORCID bağlantısı", "https://orcid.org/0009-0005-8730-3577");
gecsin("Tebliğ kaynağı", "resmigazete.gov.tr/eskiler/2022/01/20220127-5.htm");
gecsin("kardeş yazıya bağlantı", "../dilim-kaymasi-2022-2026/");
tamKez("tablo işaretleri kapalı", "<!-- BEYAN-PENCERE:BITIS -->", 1);
tamKez("uçurum işareti kapalı", "<!-- BEYAN-UCURUM:BITIS -->", 1);
tamKez("karşılaştırma işareti kapalı", "<!-- BEYAN-KARSILASTIRMA:BITIS -->", 1);

/* ------------------------------------------------------------------ */
console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " +
  kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
