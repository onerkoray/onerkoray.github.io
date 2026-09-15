#!/usr/bin/env node
/*
 * "Vergi dilimleri asgari ücrete yetişemiyor" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının tamamı yedi yıllık parametrelerden türüyor: dilim sınırları, asgari
 * ücretler ve bunların oranları. bordro/parametreler.js'e 2027 eklendiğinde ya
 * da geçmiş bir değer düzeltildiğinde yazı sessizce eskir — tablolar hizalı
 * durur, oranlar makul okunur, yalnızca yanlıştır.
 *
 * BU TEST HİÇBİR SAYIYI KENDİ İÇİNDE TAŞIMAZ
 * ------------------------------------------
 * Beklenen değerlerin hepsi motordan yeniden hesaplanıyor. Tek istisna,
 * yazının KAPSADIĞI YIL ARALIĞI (2020–2026): bu bir veri değil, yazının
 * kendi sınırı. Motora yeni bir yıl eklenirse test bunu fark edip uyarır,
 * çünkü yeni yıl tabloya kendiliğinden girmez.
 *
 * TABLOLAR HTML'DEN AYRIŞTIRILIR
 * ------------------------------
 * "Sayfada geçiyor mu" kontrolü bozuk bir hücreyi kaçırıyor: aynı sayı SSS'te
 * de geçiyor. Tablolar satır satır sökülüp hücre hücre karşılaştırılıyor.
 *
 * Kullanım: node makaleler/vergi-dilimleri-asgari-ucrete-yetisemiyor/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

/* Yazının kapsadığı aralık. Veri değil, yazının sınırı. */
var YILLAR = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function gecsin(ad, metin) {
  gecer(ad, HTML.indexOf(metin) !== -1, "sayfada yok: " + metin);
}

function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }
function iki(n) { return n.toFixed(2).replace(".", ","); }

function tabloSatirlari(captionParcasi) {
  /* CAPTION ETIKETININ ICINDE aranir, sayfanin herhangi bir yerinde degil.
     Duz metin aramasi bir kez yanlis tabloyu buldu: yazinin paragraflari
     tablo basligini kendi cumlesinde tekrar ediyor ("Asagidaki tablo,
     Aralik netinin Ocak netine gore kaybini gosteriyor") ve arama oraya
     dusup bir onceki tabloyu okudu. Sessiz bir hataydi -- test calisti,
     satirlari buldu, yalnizca yanlis tablonun satirlariydi. */
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

console.log("Vergi dilimleri yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 0 */
/* Motor yazının kapsadığı bütün yılları tanıyor mu? Bir yıl düşerse
   tablolar sessizce eksilir. */
YILLAR.forEach(function (y) {
  var ok = true;
  try { B.parametre(y); } catch (e) { ok = false; }
  gecer("motor " + y + " parametrelerini tanıyor", ok);
});

/* ------------------------------------------------------------------ 1 */
/* Dilim/asgari oranları tablosu. */
var t1 = tabloSatirlari("Vergi dilimlerinin bittiği nokta");
gecer("dilim tablosu bulundu", !!t1);
if (t1) {
  var g1 = t1.slice(1);
  gecer("dilim tablosunda " + YILLAR.length + " satır var", g1.length === YILLAR.length,
    g1.length + " satır");
  YILLAR.forEach(function (y, i) {
    var s = g1[i];
    if (!s) { gecer("dilim satır " + y, false, "satır yok"); return; }
    var P = B.parametre(y), d = B.donem(P, 1), ya = d.asgariBrut * 12;
    gecer(y + " satır etiketi", s[0] === String(y), s[0]);
    gecer(y + " yıllık asgari ücret", s[1] === tl(ya), s[1] + " ≠ " + tl(ya));
    gecer(y + " 1. dilimin sonu", s[2] === tl(P.dilimler[0][0]),
      s[2] + " ≠ " + tl(P.dilimler[0][0]));
    gecer(y + " 1. dilim katı", s[3] === iki(P.dilimler[0][0] / ya),
      s[3] + " ≠ " + iki(P.dilimler[0][0] / ya));
    gecer(y + " 2. dilimin sonu", s[4] === tl(P.dilimler[1][0]),
      s[4] + " ≠ " + tl(P.dilimler[1][0]));
    gecer(y + " 2. dilim katı", s[5] === iki(P.dilimler[1][0] / ya),
      s[5] + " ≠ " + iki(P.dilimler[1][0] / ya));
  });
}

/* ------------------------------------------------------------------ 2 */
/* Aralık kaybı tablosu. */
var t3 = tabloSatirlari("Aralık netinin Ocak netine göre kaybı");
gecer("kayıp tablosu bulundu", !!t3);
if (t3) {
  var g3 = t3.slice(1);
  YILLAR.forEach(function (y, i) {
    var s = g3[i];
    if (!s) { gecer("kayıp satır " + y, false, "satır yok"); return; }
    var P = B.parametre(y), d = B.donem(P, 1);
    function oran(kat) {
      var r = B.hesaplaYil(d.asgariBrut * kat, y);
      return 100 * (r.aylar[0].net - r.aylar[11].net) / r.aylar[0].net;
    }
    gecer(y + " 3 kat kaybı", s[1] === "%" + iki(oran(3)), s[1] + " ≠ %" + iki(oran(3)));
    gecer(y + " 5 kat kaybı", s[2] === "%" + iki(oran(5)), s[2] + " ≠ %" + iki(oran(5)));
  });
}

/* ------------------------------------------------------------------ 3 */
/* Asgari ücret tablosu — DÖNEM DÖNEM.
   Bu ayrım önemliydi: 2022 ve 2023'te asgari ücret yıl ortasında da zamlandı.
   Yılı tek satırda göstermek, Temmuz zammını yok saymak olurdu. */
var t2 = tabloSatirlari("Asgari ücret ve net karşılığı");
gecer("asgari ücret tablosu bulundu", !!t2);
if (t2) {
  var g2 = t2.slice(1);
  var beklenenSatir = 0;
  YILLAR.forEach(function (y) {
    beklenenSatir += (B.parametre(y).donemler || []).length;
  });
  gecer("asgari tablosunda " + beklenenSatir + " dönem satırı var",
    g2.length === beklenenSatir, g2.length + " satır");

  var k = 0;
  YILLAR.forEach(function (y) {
    var P = B.parametre(y);
    (P.donemler || []).forEach(function (dn) {
      var s = g2[k++];
      if (!s) return;
      var d = B.donem(P, dn.ay);
      gecer(y + "/" + dn.ay + " brüt", s[1] === tl(d.asgariBrut),
        s[1] + " ≠ " + tl(d.asgariBrut));
      gecer(y + "/" + dn.ay + " net", s[2] === tl(d.asgariNet),
        s[2] + " ≠ " + tl(d.asgariNet));
    });
  });

  /* Yıl içi zammın gerçekten iki satırla gösterildiği yıllar. */
  [2022, 2023].forEach(function (y) {
    gecer(y + " iki dönem olarak veriliyor",
      (B.parametre(y).donemler || []).length === 2);
  });
}

/* ------------------------------------------------------------------ 4 */
/* Yazının BAŞLIK İDDİASI: asgari ücret dilimlerden hızlı büyüdü. */
var ilk = B.parametre(YILLAR[0]), son = B.parametre(YILLAR[YILLAR.length - 1]);
var aIlk = B.donem(ilk, 1).asgariBrut, aSon = B.donem(son, 1).asgariBrut;
var katAsgari = aSon / aIlk;
var katDilim1 = son.dilimler[0][0] / ilk.dilimler[0][0];
var katDilim2 = son.dilimler[1][0] / ilk.dilimler[1][0];

gecer("asgari ücret dilimlerden hızlı büyüdü",
  katAsgari > katDilim1 && katAsgari > katDilim2,
  "asgari " + iki(katAsgari) + " / dilim1 " + iki(katDilim1) + " / dilim2 " + iki(katDilim2));
gecsin("asgari ücret katı", iki(katAsgari) + " katına");
/* Standfirst artik IKINCI dilimi one cikariyor: ilk esik notr. */
gecsin("2. dilim katı", iki(katDilim2) + " katına");
gecsin("SSS'te üç kat birlikte", "asgari ücret " + iki(katAsgari) +
  " katına çıkarken ilk dilim " + iki(katDilim1) + ", ikinci dilim " + iki(katDilim2));

/* Oranlar da yazıda geçiyor. */
gecsin("2020 1. dilim oranı", iki(ilk.dilimler[0][0] / (aIlk * 12)) + " katında");
gecsin("2026 1. dilim oranı", iki(son.dilimler[0][0] / (aSon * 12)) + " katında");

/* ------------------------------------------------------------------ 5 */
/* Asgari ücretlinin gelir vergisi: 2022'den itibaren sıfır, ÖNCESİNDE DEĞİL.
   İlk yazımda "yıl boyunca sıfır" diye koşulsuz yazmıştım ve bu test yanlışladı:
   2020-2021'de asgari geçim indirimi rejimi vardı, vergiyi azaltıyordu ama
   silmiyordu. Rejim değişimi burada İKİ YÖNLÜ sabitleniyor — yalnızca "sonrası
   sıfır" demek, öncesinin de sıfıra dönmesini fark etmezdi. */
var ISTISNA_BASLANGICI = 2022;
YILLAR.forEach(function (y) {
  var d = B.donem(B.parametre(y), 1);
  var r = B.hesaplaYil(d.asgariBrut, y);
  var toplam = r.aylar.reduce(function (t, a) {
    return t + (a.gelirVergisi || a.vergi || 0);
  }, 0);
  if (y >= ISTISNA_BASLANGICI) {
    gecer(y + " asgari ücretlinin gelir vergisi sıfır", Math.round(toplam) === 0,
      tl(toplam) + " TL");
  } else {
    gecer(y + " asgari ücretli hâlâ gelir vergisi ödüyordu (AGİ rejimi)",
      Math.round(toplam) > 0, tl(toplam) + " TL");
    gecsin(y + " tutarı yazıda geçiyor", tl(toplam) + " TL");
  }
  gecer(y + " istisna rejimi etiketi", B.parametre(y).istisnaRejimi ===
    (y >= ISTISNA_BASLANGICI ? "asgari-ucret" : "agi"),
    B.parametre(y).istisnaRejimi);
});

/* ------------------------------------------------------------------ 6 */
/* Yapısal. */
/* ------------------------------------------------------------------ */
/* NOTRLESTIRME — yazinin duzeltilen cercevesi burada SABITLENIYOR.
 *
 * Yazinin ilk hali ilk dilim esigiyle aciliyordu; say ilar dogruydu ama
 * anlam yanlisti. Asgari ucret istisnasi ayni tarifeyle hesaplanip
 * hesaplanan vergiden dusuldugu icin, asgari ucret matrahinin ALTINDAKI
 * bir esikteki degisiklik asgari ucret ustu hicbir calisanin vergisini
 * degistirmiyor. Burada motorda fiilen olculuyor; cerceve geri kayarsa
 * bu kontrol duser. */
(function () {
  var P = B.parametre(2026);
  var Ma = 0, d = P.donemler || [];
  d.forEach(function (dn, i) {
    var ay = (i + 1 < d.length ? d[i + 1].ay : 13) - dn.ay;
    Ma += dn.asgariBrut * ay;
  });
  Ma *= 0.85;
  gecer("ilk eşik asgari ücret matrahının altında (nötr bölge)",
    P.dilimler[0][0] < Ma, P.dilimler[0][0] + " vs " + Math.round(Ma));
  gecer("ikinci eşik asgari ücret matrahının üstünde (bağlayıcı)",
    P.dilimler[1][0] > Ma, P.dilimler[1][0] + " vs " + Math.round(Ma));

  function yillikGV(brut) {
    return B.hesaplaYil(brut, 2026).aylar
      .reduce(function (t, a) { return t + (a.gelirVergisi || a.vergi || 0); }, 0);
  }
  var brut = B.donem(P, 1).asgariBrut * 3;
  var once = yillikGV(brut);
  var eski = P.dilimler[0][0];
  P.dilimler[0][0] = Math.round(eski * 1.3089);
  var sonra = yillikGV(brut);
  P.dilimler[0][0] = eski;
  gecer("ilk eşiği değiştirmek vergiyi DEĞİŞTİRMİYOR",
    Math.abs(sonra - once) < 0.005, (sonra - once).toFixed(4) + " TL");

  /* KONTROL: yukaridaki sifir, olcum bozuk oldugu icin de cikabilirdi.
     Ayni islem IKINCI esikte yapilinca fark buyuk olmali. */
  var eski2 = P.dilimler[1][0];
  P.dilimler[1][0] = Math.round(eski2 * 1.3089);
  var sonra2 = yillikGV(brut);
  P.dilimler[1][0] = eski2;
  gecer("kontrol: ikinci eşik DEĞİŞTİRİYOR",
    once - sonra2 > 1000, (sonra2 - once).toFixed(2) + " TL");

  gecsin("düzeltme notu yerinde", "Düzeltme (15 Eylül 2026)");
  gecsin("kanıta bağlantı var", "../dilim-kaymasi-2022-2026/#notrlestirme");
})();

gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));
gecsin("kapsanan aralık yazıda geçiyor", YILLAR[0] + "–" + YILLAR[YILLAR.length - 1]);

console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
