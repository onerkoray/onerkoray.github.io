#!/usr/bin/env node
/*
 * "2026 MTV ne kadar?" yazısındaki her sayıyı tarife modülünden doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazı 150'den fazla tutar taşıyor ve hepsi MTV tarifesinden türüyor. Tarife
 * her Ocak, yeniden değerleme oranıyla değişiyor: araç güncellenir, yazı
 * sessizce eskir. Eskimiş bir yazı bozuk GÖRÜNMEZ — tablo hizalı durur,
 * sayılar makul okunur, yalnızca yanlıştır.
 *
 * BU TEST HİÇBİR SAYIYI KENDİ İÇİNDE TAŞIMAZ
 * ------------------------------------------
 * Beklenen değerlerin tamamı mtv-hesaplama/tarife.js'ten yeniden hesaplanır.
 * Buraya beklenen tutarları elle yazmak, yazıdaki hatayı teste kopyalamaktan
 * başka işe yaramazdı.
 *
 * TABLOLAR HTML'DEN AYRIŞTIRILIR
 * ------------------------------
 * "Sayfada geçiyor mu" kontrolü yetmiyor: aynı tutar SSS'te ya da başka bir
 * satırda da geçtiği için, bozuk bir hücre böyle bir kontrolden kaçıyor. Bu
 * daha önce iki kez yaşandı. Burada tablolar satır satır sökülüp hücre hücre
 * karşılaştırılıyor.
 *
 * Kullanım: node makaleler/mtv-2026-ne-kadar/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var T = require(path.join(KOK, "mtv-hesaplama", "tarife.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}

function tl(n) { return n.toLocaleString("tr-TR"); }

/* Sayfada geçiyor mu? Yalnızca VARLIK kontrolü; tablolar aşağıda ayrı
   ayrıştırılıyor çünkü varlık kontrolü bozuk hücreyi yakalamıyor. */
function gecsin(ad, metin) {
  gecer(ad, HTML.indexOf(metin) !== -1, "sayfada yok: " + metin);
}

/* ------------------------------------------------------------------ */
/* Tabloları HTML'den söker: caption'a göre bulur, satırları döndürür. */
function tabloSatirlari(captionParcasi) {
  var i = HTML.indexOf(captionParcasi);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  var blok = HTML.slice(bas, son);
  var satirlar = [];
  var re = /<tr>([\s\S]*?)<\/tr>/g, m;
  while ((m = re.exec(blok))) {
    var hucreler = [];
    var re2 = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, m2;
    while ((m2 = re2.exec(m[1]))) {
      hucreler.push(m2[1].replace(/<[^>]+>/g, "").trim());
    }
    if (hucreler.length) satirlar.push(hucreler);
  }
  return satirlar;
}

console.log("2026 MTV yazısı — sayı doğrulaması\n");

/* ------------------------------------------------------------------ 1 */
/* (I) sayılı tarife tablosu: en düşük değer kademesi, dokuz satır. */
var tI = tabloSatirlari("(I) sayılı tarife, 2018 ve sonrası tescil");
gecer("(I) tablosu bulundu", !!tI);
if (tI) {
  var govdeI = tI.slice(1);          // ilk satır başlık
  gecer("(I) tablosunda 9 satır var", govdeI.length === 9,
    govdeI.length + " satır bulundu");
  T.HACIM_ETIKET.forEach(function (etiket, i) {
    var s = govdeI[i];
    if (!s) { gecer("(I) satır " + i, false, "satır yok"); return; }
    gecer("(I) satır " + i + " etiketi", s[0] === etiket, s[0] + " ≠ " + etiket);
    T.YAS_ETIKET.forEach(function (_y, j) {
      var beklenen = tl(T.TARIFE_I[i].satir[0][j]);
      gecer("(I) " + etiket + " / " + T.YAS_ETIKET[j],
        s[j + 1] === beklenen, s[j + 1] + " ≠ " + beklenen);
    });
  });
}

/* ------------------------------------------------------------------ 2 */
/* (I/A) tablosu. */
var tIA = tabloSatirlari("(I/A) sayılı tarife, 2018 öncesi tescil");
gecer("(I/A) tablosu bulundu", !!tIA);
if (tIA) {
  var govdeIA = tIA.slice(1);
  gecer("(I/A) tablosunda 9 satır var", govdeIA.length === 9,
    govdeIA.length + " satır bulundu");
  T.HACIM_ETIKET.forEach(function (etiket, i) {
    var s = govdeIA[i];
    if (!s) { gecer("(I/A) satır " + i, false, "satır yok"); return; }
    gecer("(I/A) satır " + i + " etiketi", s[0] === etiket, s[0] + " ≠ " + etiket);
    T.YAS_ETIKET.forEach(function (_y, j) {
      var beklenen = tl(T.TARIFE_IA[i][j]);
      gecer("(I/A) " + etiket + " / " + T.YAS_ETIKET[j],
        s[j + 1] === beklenen, s[j + 1] + " ≠ " + beklenen);
    });
  });
}

/* ------------------------------------------------------------------ 3 */
/* Motosiklet tablosu. */
var tM = tabloSatirlari("motosikletler (TL/yıl)");
gecer("motosiklet tablosu bulundu", !!tM);
if (tM) {
  var govdeM = tM.slice(1);
  gecer("motosiklet tablosunda 4 satır var", govdeM.length === 4,
    govdeM.length + " satır bulundu");
  T.MOTO_KW_ETIKET.forEach(function (etiket, i) {
    var s = govdeM[i];
    if (!s) { gecer("moto satır " + i, false, "satır yok"); return; }
    gecer("moto satır " + i + " etiketi", s[0] === etiket, s[0] + " ≠ " + etiket);
    T.MOTO_ETIKET.forEach(function (_y, j) {
      var beklenen = tl(T.TARIFE_MOTO[i][j]);
      gecer("moto " + etiket + " / sütun " + j,
        s[j + 1] === beklenen, s[j + 1] + " ≠ " + beklenen);
    });
  });
}

/* ------------------------------------------------------------------ 4 */
/* Karşılaştırma tablosu: aynı araç, iki tescil tarihi.
   Yazının OMURGASI bu üç sayı; ayrı ayrıştırılıp motorla karşılaştırılıyor. */
var tK = tabloSatirlari("Aynı araç, iki farklı tescil tarihi");
gecer("karşılaştırma tablosu bulundu", !!tK);
if (tK) {
  var yeni = T.hesapla({ tur: "otomobil", modelYili: 2017, tescil: "yeni",
                         bant: 2, deger: 600000 });
  var eski = T.hesapla({ tur: "otomobil", modelYili: 2017, tescil: "eski",
                         bant: 2 });
  gecer("örnekte yaş grubu 7 – 11", yeni.yasEtiket === "7 – 11 yaş", yeni.yasEtiket);
  gecer("(I) örnek tutarı", tK[0] && tK[0][1] === tl(yeni.tarifeTutari) + " TL",
    (tK[0] || [])[1] + " ≠ " + tl(yeni.tarifeTutari) + " TL");
  gecer("(I/A) örnek tutarı", tK[1] && tK[1][1] === tl(eski.tarifeTutari) + " TL",
    (tK[1] || [])[1] + " ≠ " + tl(eski.tarifeTutari) + " TL");
  gecer("fark satırı", tK[2] &&
    tK[2][1] === tl(yeni.tarifeTutari - eski.tarifeTutari) + " TL",
    (tK[2] || [])[1]);
}

/* ------------------------------------------------------------------ 5 */
/* İki tarifenin ilişkisi: yazının ana iddiası.
   İddia "1600'e kadar aynı, sonra tam %10" — bunu yazıdan değil MODÜLDEN
   doğruluyoruz. Kanun değişip oran kayarsa test burada patlar ve yazıdaki
   cümle düzeltilmeden geçemez. */
var ayniOlanlar = 0, ondaBirOlanlar = 0;
T.HACIM_ETIKET.forEach(function (_e, i) {
  T.YAS_ETIKET.forEach(function (_y, j) {
    var a = T.TARIFE_I[i].satir[0][j], b = T.TARIFE_IA[i][j];
    if (a === b) { ayniOlanlar++; return; }
    /* ORANSAL tolerans. Yayımlanan tutarlar, kanundaki ham tutarların
       birikmiş yeniden değerleme katsayısıyla çarpılıp yuvarlanmasıyla
       çıkıyor; iki yuvarlama üst üste binince oran birebir 1,10 olmuyor.
       Ölçülen aralık 1,0980 – 1,1022. Mutlak bir lira tolerans küçük
       tutarlarda yanlış alarm veriyordu. Aralık, gerçek bir oran
       değişikliğini (ör. %10 → %15) yakalayacak kadar dar. */
    var oran = a / b;
    if (oran >= 1.095 && oran <= 1.105) ondaBirOlanlar++;
  });
});
gecer("ilk iki satır iki tarifede aynı", ayniOlanlar === 2 * T.YAS_ETIKET.length,
  ayniOlanlar + " hücre aynı, beklenen " + (2 * T.YAS_ETIKET.length));
gecer("kalan satırlarda fark tam %10",
  ondaBirOlanlar === 7 * T.YAS_ETIKET.length,
  ondaBirOlanlar + " hücre %10, beklenen " + (7 * T.YAS_ETIKET.length));

/* ------------------------------------------------------------------ 6 */
/* Elektrikli araç örneği. */
var ev = T.hesapla({ tur: "otomobil", modelYili: 2024, tescil: "yeni",
                     yakit: "elektrik", kw: 150, deger: 1500000 });
gecer("150 kW, 2001–2500 cm³ satırına düşüyor",
  ev.bantEtiket.indexOf("2001 – 2500 cm³") !== -1, ev.bantEtiket);
gecsin("elektrikli örnek: tarife tutarı", tl(ev.tarifeTutari) + " TL");
gecsin("elektrikli örnek: ödenecek vergi", tl(ev.vergi) + " TL");
gecer("elektrikli oranı dörtte bir", T.EV_ORANI === 0.25, String(T.EV_ORANI));

/* ------------------------------------------------------------------ 7 */
/* Yazıda geçen diğer türetilmiş sayılar. */
gecsin("yeniden değerleme oranı", "%" + String(T.YENIDEN_DEGERLEME * 100).replace(".", ","));
/* Taksit kuruşlu: yazıda da kuruşlu yazılmalı. toLocaleString
   varsayılanı "4.072,5" üretiyor, sayfada ise "4.072,50" duruyor —
   biçim farkı bir hata değil ama testin gördüğü şey metindir. */
var taksit = T.hesapla({ tur: "otomobil", modelYili: 2017,
  tescil: "eski", bant: 2 }).taksit;
gecsin("taksit tutarı", taksit.toLocaleString("tr-TR",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL");

var enBuyukFark = T.TARIFE_I[8].satir[0][0] - T.TARIFE_IA[8][0];
gecsin("en büyük fark (4001 cm³, 1–3 yaş)", tl(enBuyukFark) + " TL");

/* kW bant sınırları yazıda sayı sayı veriliyor. */
gecsin("kW bant sınırları", T.KW_UST.join(", ").replace(/, ([^,]*)$/, " ve $1"));

/* Değer eşikleri. */
gecsin("1300/1600 birinci eşik", tl(T.TARIFE_I[0].esik[0]) + " TL");
gecsin("1300/1600 ikinci eşik", tl(T.TARIFE_I[0].esik[1]) + " TL");
gecsin("1601–2000 eşiği", tl(T.TARIFE_I[2].esik[0]) + " TL");
gecsin("2001–2500 eşiği", tl(T.TARIFE_I[4].esik[0]) + " TL");

/* Kasko oranları: yazı ikisini AYRI anlatıyor ve ayrımı korumak şart. */
gecer("(I/A) kasko oranı %5", T.IA_KASKO_ORANI === 0.05, String(T.IA_KASKO_ORANI));
gecer("(I) kasko oranı %10", T.I_KASKO_ORANI === 0.10, String(T.I_KASKO_ORANI));
gecsin("motosiklet alt sınırı", T.MOTO_KW_ALT + " kW");

/* ------------------------------------------------------------------ 8 */
/* Yapısal: geçerlilik bildirimi ve tarife yılı. */
gecer("yazı 2026 tarifesini anlatıyor", T.YIL === 2026, String(T.YIL));
gecer("geçerlilik bildirimi var",
  /<meta\s+name="gecerlilik"\s+content="\d{4}-\d{2}-\d{2}\s*\|/.test(HTML));

console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
