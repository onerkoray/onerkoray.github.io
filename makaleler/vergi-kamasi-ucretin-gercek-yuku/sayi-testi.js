#!/usr/bin/env node
/*
 * "Vergi kaması: ücretin gerçek yükü" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Bu yazının bir DOI'si var, yani sayıları ALINTILANABİLİR. Yazı da
 * "hiçbir sayı elle girilmedi" diyor. İddia 2026-09-19'da ölçüldü ve
 * doğru çıktı — yirmi dört tablo değerinin yirmi dördü de motordan
 * birebir üretiliyor. Ama iddiayı koruyan hiçbir şey yoktu; motorda bir
 * düzeltme tabloyu sessizce yanlışa çevirirdi.
 *
 * YILA ÇİVİLİ — VE BU BİLİNÇLİ
 * ----------------------------
 * Test B.sonYil() değil, sabit 2026 kullanıyor. Yazı 2026 analizidir ve
 * tabloları öyle etiketlenmiştir; DOI de o çalışmaya verilmiştir. 2027
 * parametreleri girildiğinde bu testin DEĞİŞMEMESİ gerekir. Değişseydi,
 * sayfa aynı DOI'yi taşıyarak başka bir çalışmaya dönüşürdü.
 *
 * Bunun sonucu: test 2026 parametrelerinin bir daha değişmemesini de
 * bekliyor. Değişirse (bir düzeltme, bir ek dönem) test kırmızıya döner
 * ve bu DOĞRU davranıştır — yayımlanmış bir çalışmanın altındaki zemin
 * kaymış demektir, sessizce geçmemeli.
 *
 * ÜÇ ÖNERME
 * ---------
 * Ö1. Ortalama kama tavana kadar YÜKSELİYOR, sonra DÜŞÜYOR.
 *     KONTROL: tepe noktası tavanı bilmeden taranıyor; iddia "tepe
 *     tavandadır" ise tarama onu bulmalı.
 *
 * Ö2. Tavanın üstünde toplam kama ile çalışan kaması ÇAKIŞIYOR.
 *     KONTROL: tavanın ALTINDA çakışmamalı — yoksa eşitlik, hesabın
 *     iki sütunu aynı şeyi ölçmesinden geliyor olurdu.
 *
 * Ö3. 1.000.000 TL'deki ortalama kama, 100.000 TL'dekinden DÜŞÜK.
 *     Yazının başlıktaki iddiası bu.
 *
 * Kullanım: node makaleler/vergi-kamasi-ucretin-gercek-yuku/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var K = require(path.join(__dirname, "kama.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

/* Yazının yılı. sonYil() DEĞİL — yukarıdaki gerekçeye bakınız. */
var YIL = 2026;

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(m) { return HTML.split(m).length - 1; }
function gecsin(ad, m) { gecer(ad, kacKez(m) >= 1, "sayfada yok: " + m); }
function y1(o) { return (o * 100).toFixed(1).replace(".", ","); }
function y2(o) { return (o * 100).toFixed(2).replace(".", ","); }

/* Bir tablonun veri satirlarini <caption> uzerinden ceker.
   VARLIK KONTROLU YETMIYOR: yazidaki yuzdelerin cogu hem nesirde hem
   tabloda geciyor, dolayisiyla "sayfada var mi" diye sormak tablo
   hucresi bozulsa da gecer. Hucreler tek tek karsilastiriliyor. */
function tabloSatirlari(capIcerik) {
  var i = HTML.indexOf(capIcerik);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  return HTML.slice(bas, son).split("<tr").slice(1).filter(function (r) {
    return r.indexOf('scope="col"') < 0;     /* baslik satiri elenir */
  }).map(function (r) {
    return (r.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/g) || []).map(function (h) {
      return h.replace(/<[^>]*>/g, "").trim();
    });
  }).filter(function (h) { return h.length > 1; });
}

console.log("Vergi kaması yazısı — sayı denetimi\n");

/* ---------------------------------------------------------------- 0
   Yazının dayandığı zemin: 2026 parametreleri yerinde mi? */
var P = B.parametre(YIL);
gecer("2026 parametreleri var", !!P);
/* Tavan ve asgari ücret BURAYA YAZILMIYOR. Yazılsaydı parametrelerin
   ikinci bir kopyası olurdu (tools/parametre-kopyasi.js bunu zaten
   yakalıyor) ve gereksizdi: aşağıdaki tablo iddiaları değerleri
   motordan hesaplıyor, dolayısıyla parametre değişirse onlar düşüyor.
   Mutasyon testi bunu doğruladı. */

/* Yazının metodoloji bölümünde yazılı oranlar. */
var o = P.oranlar;
gecer("işveren efektif oranı %23,75",
  Math.abs((o.sgkIsveren + o.issizlikIsveren) - 0.2375) < 1e-9);
gecer("işçi kesintisi %15",
  Math.abs((o.sgkIsci + o.issizlikIsci) - 0.15) < 1e-9);
gecsin("işveren oranı metinde", "%23,75");
gecsin("işçi oranı metinde", "%15");

/* ---------------------------------------------------------------- 1
   Ortalama kama tablosu: yayımlanan her satır motordan çıkmalı. */
/* Iki ornekleme noktasi SAYI OLARAK yazilmiyor: yazinin tablosunda
   "33.030 TL (asgari)" ve "297.270 TL (prim tavani)" satirlari var, yani
   kastedilen sey tutar degil KAVRAM. Motordan okumak hem parametre
   kopyasi olusturmuyor hem de satirin ne oldugunu soyluyor. */
var D = B.parametre(YIL).donemler[0];
var ORTALAMA = [
  [D.asgariBrut, "31,3", "14,60"], [50000, "37,2", "9,65"], [75000, "41,6", "6,43"],
  [100000, "43,8", "4,82"], [150000, "46,2", "3,22"], [200000, "48,6", "2,41"],
  [260000, "50,3", "1,86"], [D.sgkTavan, "51,0", "1,62"], [350000, "49,1", "1,38"],
  [500000, "45,7", "0,96"], [1000000, "43,4", "0,48"], [2000000, "42,1", "0,24"]
];
ORTALAMA.forEach(function (s) {
  var olculen = y1(K.ortalama(s[0], YIL));
  gecer(s[0] + " TL: ortalama kama %" + s[1],
    olculen === s[1], "ölçülen %" + olculen);
  var istisna = y2(K.istisnaOrani(s[0], YIL));
  gecer(s[0] + " TL: istisna oranı %" + s[2],
    istisna === s[2], "ölçülen %" + istisna);
});

/* Tablonun HÜCRELERİ modülle aynı mı? */
(function () {
  var satir = tabloSatirlari("brüt ücret düzeyine göre ortalama vergi kaması");
  gecer("ortalama kama tablosu okunabildi",
    satir && satir.length === ORTALAMA.length,
    satir ? "satır: " + satir.length : "tablo yok");
  if (!satir) return;
  satir.forEach(function (r, i) {
    var brut = ORTALAMA[i][0];
    gecer(brut + " TL: tablo satırı doğru brütü gösteriyor",
      r[0].indexOf(brut.toLocaleString("tr-TR")) === 0, r[0]);
    gecer(brut + " TL: tablodaki kama hücresi modülle aynı",
      r[1] === "%" + y1(K.ortalama(brut, YIL)), r[1]);
    gecer(brut + " TL: tablodaki istisna hücresi modülle aynı",
      r[2] === "%" + y2(K.istisnaOrani(brut, YIL)), r[2]);
  });
})();

/* ---------------------------------------------------------------- 2
   Marjinal kama tablosu. */
var MARJINAL = [
  ["asgari ücret düzeyi", D.asgariBrut, "45,7", "32,8"],
  ["40.000–120.000 bandı", 80000, "50,5", "38,7"],
  ["150.000–290.000 bandı", 220000, "56,0", "45,5"],
  ["prim tavanının üstü", 350000, "35,8", "35,8"],
  ["üst dilim", 500000, "40,8", "40,8"]
];
MARJINAL.forEach(function (s) {
  var t = y1(K.marjinal(s[1], YIL));
  var c = y1(K.marjinalCalisan(s[1], YIL));
  gecer(s[0] + ": toplam marjinal %" + s[2], t === s[2], "ölçülen %" + t);
  gecer(s[0] + ": çalışan marjinali %" + s[3], c === s[3], "ölçülen %" + c);
});

(function () {
  var satir = tabloSatirlari("gelir bandına göre marjinal vergi kaması");
  gecer("marjinal kama tablosu okunabildi",
    satir && satir.length === MARJINAL.length,
    satir ? "satır: " + satir.length : "tablo yok");
  if (!satir) return;
  satir.forEach(function (r, i) {
    var s = MARJINAL[i];
    gecer(s[0] + ": tablodaki toplam marjinal modülle aynı",
      r[1] === "%" + y1(K.marjinal(s[1], YIL)), r[1]);
    gecer(s[0] + ": tablodaki çalışan marjinali modülle aynı",
      r[2] === "%" + y1(K.marjinalCalisan(s[1], YIL)), r[2]);
  });
})();

/* Nesirdeki iddialar da çivili.
   TABLOYU ÇİVİLEMEK YETMİYOR: bu yüzdeler özet bölümünde, gövde
   metninde ve SSS'te de geçiyor. Yalnızca hücreler denetlenseydi,
   özetteki bir rakamı bozmak testi düşürmezdi — mutasyon testi tam
   olarak bunu gösterdi. Bu yüzden TAM TEKRAR SAYISI çakılıyor:
   sayılardan biri değişirse toplam da değişir. */
[["%31,3", 4], ["%43,8", 6], ["%43,4", 6], ["%51,0", 7],
 ["%56,0", 4], ["%35,8", 6]].forEach(function (s) {
  var n = kacKez(s[0]);
  gecer(s[0] + " sayfada tam " + s[1] + " kez", n === s[1],
    n + " kez geçiyor");
});

/* ---------------------------------------------------------------- 3
   Ö1 — tepe prim tavanında.
   KONTROL: tarama tavanı BİLMİYOR; 30.000'den 600.000'e kadar bakıyor. */
(function () {
  var tepe = K.tepeNoktasi(YIL, 30000, 600000, 1000);
  var tavan = D.sgkTavan;
  gecer("ortalama kamanın tepesi prim tavanı civarında",
    Math.abs(tepe.brut - tavan) <= 1000,
    "tepe " + tepe.brut + ", tavan " + tavan);
  gecer("tepedeki kama %51,0", y1(tepe.kama) === "51,0", "%" + y1(tepe.kama));
  /* Tepe gerçekten bir TEPE mi: iki yanı da daha düşük olmalı. */
  gecer("tepenin solunda kama daha düşük",
    K.ortalama(tavan - 50000, YIL) < tepe.kama);
  gecer("tepenin sağında kama daha düşük",
    K.ortalama(tavan + 50000, YIL) < tepe.kama);
})();

/* ---------------------------------------------------------------- 4
   Ö2 — tavanın üstünde iki sütun çakışıyor.
   KONTROL: tavanın ALTINDA çakışmamalı. */
(function () {
  var ust = 350000, alt = 200000;
  gecer("tavanın üstünde toplam ve çalışan marjinali aynı",
    y1(K.marjinal(ust, YIL)) === y1(K.marjinalCalisan(ust, YIL)));
  gecer("tavanın altında AYNI DEĞİL",
    y1(K.marjinal(alt, YIL)) !== y1(K.marjinalCalisan(alt, YIL)),
    y1(K.marjinal(alt, YIL)) + " vs " + y1(K.marjinalCalisan(alt, YIL)));
  /* Mekanizma: tavanın üstünde ilave brüt, işverene tam olarak kendisi
     kadara mal oluyor. */
  var a = K.yillik(ust, YIL), b = K.yillik(ust + K.ADIM, YIL);
  gecer("tavanın üstünde maliyet artışı = brüt artışı",
    Math.abs((b.maliyet - a.maliyet) - (b.brut - a.brut)) < 1);
  var c = K.yillik(alt, YIL), d = K.yillik(alt + K.ADIM, YIL);
  gecer("tavanın altında maliyet artışı brütten BÜYÜK",
    (d.maliyet - c.maliyet) > (d.brut - c.brut) + 1);
})();

/* ---------------------------------------------------------------- 5
   Ö3 — yazının başlıktaki iddiası. */
(function () {
  var yuz = K.ortalama(100000, YIL), milyon = K.ortalama(1000000, YIL);
  gecer("1.000.000 TL'deki kama 100.000 TL'dekinden düşük",
    milyon < yuz, y1(milyon) + " < " + y1(yuz));
  gecsin("iddia metinde", "daha düşüktür");
  /* KONTROL: fark ölçülebilir olmalı, yuvarlama gürültüsü değil. */
  gecer("aradaki fark yuvarlama gürültüsü değil",
    (yuz - milyon) > 0.002, String(yuz - milyon));
})();

/* ---------------------------------------------------------------- 6
   Yazının kendi yeniden üretim örneği çalışıyor mu?
   Metinde "0.438..." yazıyor; motor gerçekten onu vermeli. */
(function () {
  var r = B.hesaplaYil(100000, YIL);
  var kama = (r.toplam.isverenMaliyeti - r.toplam.net) / r.toplam.isverenMaliyeti;
  gecer("metindeki örnek kod 0,438... veriyor",
    kama.toFixed(3) === "0.438", kama.toFixed(4));
  gecsin("örnek çıktı metinde", "0.438");
  gecer("modül aynı sonucu veriyor",
    Math.abs(K.ortalama(100000, YIL) - kama) < 1e-12);
})();

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
