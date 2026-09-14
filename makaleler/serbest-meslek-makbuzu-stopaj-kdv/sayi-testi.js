#!/usr/bin/env node
/*
 * Serbest meslek makbuzu yazısındaki sayıları doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının vergi tablosu, ÜCRET DIŞI gelir vergisi tarifesinden türüyor. O
 * tarife her Ocak değişiyor ve ücret tarifesinden de farklı (üçüncü dilimin
 * üst sınırı 1.000.000, ücrette 1.500.000). Tarife değiştiğinde araç
 * güncellenir, yazı sessizce eskir: tablo hizalı durur, sayılar makul
 * okunur, yalnızca yanlıştır.
 *
 * SAYILAR BURADA TUTULMAZ
 * -----------------------
 * Tablolar motordan yeniden hesaplanıyor. Stopaj (%20) ve KDV (%20) oranları
 * ise kanuni sabitler; bunlar teste YAZILIYOR çünkü parametre dosyasında
 * yoklar — ama yazıda da geçtikleri için ikisi birlikte doğrulanıyor. Oran
 * bir Cumhurbaşkanı Kararıyla değişirse test kırılır ve yazı düzeltilmeden
 * geçemez.
 *
 * TABLOLAR HTML'DEN AYRIŞTIRILIR
 * ------------------------------
 * "Sayfada geçiyor mu" kontrolü, aynı tutar SSS'te de geçtiği için bozuk
 * hücreyi kaçırıyor. Bu kod tabanında üç kez yaşandı.
 *
 * Kullanım: node makaleler/serbest-meslek-makbuzu-stopaj-kdv/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var YIL = 2026;
var P = B.parametre(YIL);
var D = P.dilimlerUcretDisi;

/* Kanuni sabitler — parametre dosyasında yok, yazıda var. */
var STOPAJ = 0.20;
var KDV = 0.20;
var BRUT = 100000;          // yazının örneği
var TEVKIFAT = [0, 0.5, 0.7, 0.9];

/* Tablonun kazanç basamakları. İkisi TÜRETİLİYOR, yazılmıyor: 190.000 ve
   400.000 tarifenin ilk iki dilim sınırıdır ve tablo tam olarak o yüzden
   onları gösteriyor — "iade donuyor" iddiası bu iki uç arasında geçerli.
   Elle yazıldıklarında tools/parametre-kopyasi.js onları yasal parametre
   kopyası olarak yakaladı; haklıydı, çünkü tarife değişse liste sessizce
   yanlış yeri işaret ederdi. */
var KAZANCLAR = [100000, D[0][0], 300000, D[1][0], 500000, 600000, 1000000, 2000000];

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
/* SAYARAK doğrular, varlık kontrolü yapmaz.
 *
 * "Sayfada geçiyor mu" kontrolü iki farklı hatayı ayırt edemiyor. Tarife
 * değişip sayı tamamen eskirse indexOf zaten patlar — orada sorun yok.
 * Ama bu yazıda "9.500 TL" altı, "535.714 TL" beş kez geçiyor ve birinin
 * elle bozulması diğerlerinin arkasına saklanıyordu: ölçüldü, test geçti.
 *
 * Beklenen adet BİLEREK sabitleniyor. Yazı yeniden ifade edilip sayı
 * adedi değişirse test kırılır; bu bir maliyet değil, kastedilen davranış:
 * o satırı düzelten kişi sayıyı da bir kez daha doğrulamış olur. */
function gecsin(ad, metin, adet) {
  var n = HTML.split(metin).length - 1;
  gecer(ad, n === adet,
    metin + " sayfada " + n + " kez geçiyor, beklenen " + adet);
}
function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }

/* Tabloyu CAPTION ETİKETİNDEN bulur. Düz metin araması bir kez yanlış
   tabloyu okumuştu: yazının paragrafı tablo başlığını kendi cümlesinde
   tekrar edebiliyor. */
function tabloSatirlari(caption) {
  var i = HTML.indexOf("<caption>" + caption);
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

console.log("Serbest meslek makbuzu yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 1 */
/* Makbuz aritmetiği tablosu — yazının OMURGASI.
   Buradaki iddia bir ÖZDEŞLİK: iki oran eşitken hesaba geçen tutar brüt
   ücrete eşit çıkar. Oranlardan biri değişirse özdeşlik bozulur ve test
   bunu yazıdan önce yakalar. */
var kdv = BRUT * KDV, stopaj = BRUT * STOPAJ;
var hesabaGecen = BRUT + kdv - stopaj;
var sizeKalan = BRUT - stopaj;

gecer("özdeşlik: iki oran eşitken hesaba geçen = brüt",
  Math.abs(hesabaGecen - BRUT) < 1e-9,
  tl(hesabaGecen) + " ≠ " + tl(BRUT));

var tA = tabloSatirlari("100.000 TL brüt ücretli bir makbuzda para nereye gidiyor");
gecer("aritmetik tablosu bulundu", !!tA);
if (tA) {
  var beklenen = [
    ["Brüt ücret (hizmet bedeli)", tl(BRUT)],
    ["+ KDV (%20)", tl(kdv)],
    ["= Fatura toplamı", tl(BRUT + kdv)],
    ["− Gelir vergisi stopajı (%20)", tl(stopaj)],
    ["= Hesabınıza geçen", tl(hesabaGecen)],
    ["— bunun devlete ait olan KDV kısmı", tl(kdv)],
    ["Size kalan", tl(sizeKalan)]
  ];
  gecer("aritmetik tablosunda 7 satır var", tA.length === 7, tA.length + " satır");
  beklenen.forEach(function (b, i) {
    var s = tA[i];
    if (!s) { gecer("aritmetik satır " + i, false, "satır yok"); return; }
    gecer("aritmetik satır " + i + " etiketi", s[0] === b[0], s[0] + " ≠ " + b[0]);
    gecer("aritmetik satır " + i + " tutarı", s[1] === b[1] + " TL",
      s[1] + " ≠ " + b[1] + " TL");
  });
}

/* ------------------------------------------------------------------ 2 */
/* Tevkifat tablosu. */
var tT = tabloSatirlari("100.000 TL brüt makbuz — KDV tevkifat oranına göre");
gecer("tevkifat tablosu bulundu", !!tT);
if (tT) {
  var g = tT.slice(1);
  gecer("tevkifat tablosunda " + TEVKIFAT.length + " satır var",
    g.length === TEVKIFAT.length, g.length + " satır");
  TEVKIFAT.forEach(function (t, i) {
    var s = g[i];
    if (!s) { gecer("tevkifat satır " + i, false, "satır yok"); return; }
    var tevkif = kdv * t, tahsil = kdv - tevkif;
    gecer(i + ". satır etiketi", s[0] === (t ? "%" + t * 100 : "yok"), s[0]);
    gecer(i + ". fatura toplamı", s[1] === tl(BRUT + kdv), s[1]);
    gecer(i + ". kesilen stopaj", s[2] === tl(stopaj), s[2]);
    gecer(i + ". doğrudan yatan KDV", s[3] === tl(tevkif), s[3]);
    gecer(i + ". hesaba geçen", s[4] === tl(BRUT - stopaj + tahsil), s[4]);
  });

  /* Yazının iddiası: tevkifat SIZE KALANI degistirmez. */
  var kalanlar = TEVKIFAT.map(function (t) {
    var tahsil = kdv - kdv * t;
    return (BRUT - stopaj + tahsil) - tahsil;      // hesaba gecen − devletin KDV'si
  });
  gecer("tevkifat size kalanı değiştirmiyor",
    kalanlar.every(function (x) { return Math.abs(x - sizeKalan) < 1e-9; }),
    kalanlar.map(tl).join(", "));
}

/* ------------------------------------------------------------------ 3 */
/* Stopaj–vergi tablosu, motordan. */
var tV = tabloSatirlari("Yıl boyunca kesilen stopaj ile yıllık gelir vergisi");
gecer("vergi tablosu bulundu", !!tV);
if (tV) {
  var gv = tV.slice(1);
  gecer("vergi tablosunda " + KAZANCLAR.length + " satır var",
    gv.length === KAZANCLAR.length, gv.length + " satır");
  KAZANCLAR.forEach(function (k, i) {
    var s = gv[i];
    if (!s) { gecer("vergi satır " + k, false, "satır yok"); return; }
    var v = B.tarifeVergisi(k, D), st = k * STOPAJ, f = v - st;
    gecer(k + " satır etiketi", s[0] === tl(k), s[0]);
    gecer(k + " yıllık vergi", s[1] === tl(v), s[1] + " ≠ " + tl(v));
    gecer(k + " kesilen stopaj", s[2] === tl(st), s[2] + " ≠ " + tl(st));
    gecer(k + " fark etiketi",
      s[3] === (f < 0 ? tl(-f) + " TL iade" : tl(f) + " TL ek ödeme"), s[3]);
  });
}

/* ------------------------------------------------------------------ 4 */
/* İADE/EK ÖDEME EŞİĞİ — yazının ikinci ana iddiası.
   Eşik yazıdan okunmuyor, motordan ikili aramayla bulunuyor. */
function fark(k) { return B.tarifeVergisi(k, D) - k * STOPAJ; }
var lo = 1, hi = 5000000;
for (var n = 0; n < 90; n++) { var m = (lo + hi) / 2; if (fark(m) < 0) lo = m; else hi = m; }
gecsin("iade/ek ödeme eşiği", tl(lo) + " TL", 5);
gecer("eşiğin altında iade var", fark(lo * 0.99) < 0, String(fark(lo * 0.99)));
gecer("eşiğin üstünde ek ödeme var", fark(lo * 1.01) > 0, String(fark(lo * 1.01)));

/* ------------------------------------------------------------------ 5 */
/* DONMA İDDİASI: ikinci dilimde marjinal oran stopajla eşit olduğu için
   iade sabit kalır. Yazı "190.000 ile 400.000 arasında hep 9.500 TL"
   diyor; ikisini de motordan doğruluyoruz. */
var d2Alt = D[0][0], d2Ust = D[1][0];
gecer("ikinci dilimin marjinal oranı stopaja eşit",
  Math.abs(D[1][1] - STOPAJ) < 1e-9, String(D[1][1]));
var iadeAlt = -fark(d2Alt), iadeUst = -fark(d2Ust);
gecer("iade bu aralıkta sabit", Math.abs(iadeAlt - iadeUst) < 0.01,
  tl(iadeAlt) + " vs " + tl(iadeUst));
gecsin("donan iade tutarı", tl(iadeAlt) + " TL", 6);
gecsin("aralığın alt ucu", tl(d2Alt), 3);
gecsin("aralığın üst ucu", tl(d2Ust), 4);

/* ------------------------------------------------------------------ 6 */
/* Ücret dışı tarife GERÇEKTEN farklı mı? Yazı bunu iddia ediyor. */
gecer("ücret dışı tarife ücret tarifesinden farklı",
  D[2][0] !== P.dilimler[2][0],
  D[2][0] + " vs " + P.dilimler[2][0]);
gecsin("ücret dışı üçüncü dilim sınırı", tl(D[2][0]), 3);
gecsin("ücret tarifesinin üçüncü dilim sınırı", tl(P.dilimler[2][0]), 1);

/* ------------------------------------------------------------------ 7 */
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));

console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
