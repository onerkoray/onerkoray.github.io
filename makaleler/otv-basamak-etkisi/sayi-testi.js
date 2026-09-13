#!/usr/bin/env node
/*!
 * ÖTV basamak yazısındaki sayıların doğrulaması.
 *
 * NEDEN VAR
 * ---------
 * Yazı elle yazılmış on'larca tutar içeriyor ve hepsi ÖTV tarifesinden
 * türüyor. Tarife bir Cumhurbaşkanı Kararıyla değiştiğinde araç
 * güncellenir; yazı ise sessizce eskir. Eskimiş bir yazı bozuk
 * görünmez — tablo yine hizalı durur, yalnızca yanlıştır.
 *
 * Bu test yazıdaki HİÇBİR SAYIYI KENDİ İÇİNDE TAŞIMAZ. Hepsini
 * otv-hesaplama/tarife.js'ten yeniden hesaplar ve sonucu HTML metninde
 * ARAR. Tarife değişirse test kırılır ve yazının güncellenmesi gerektiğini
 * söyler; yazı yanlış düzeltilirse yine kırılır.
 *
 *   node makaleler/otv-basamak-etkisi/sayi-testi.js
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..", "..");
var T = require(path.join(KOK, "otv-hesaplama", "tarife.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var hata = 0, gecen = 0;

function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }

/** Sayı yazıda geçiyor mu? */
function gecer(ad, deger) {
  var s = typeof deger === "number" ? tl(deger) : String(deger);
  if (HTML.indexOf(s) < 0) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      yazida bulunamadi: " + s);
  } else { gecen++; console.log("  tamam      " + ad + " = " + s); }
}
/** İki metin birebir eşit mi — tablodaki hücre karşılaştırmaları için. */
function esitMetin(ad, bulunan, beklenen) {
  if (String(bulunan) !== String(beklenen)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen \"" + beklenen +
      "\", bulunan \"" + bulunan + "\"");
  } else { gecen++; console.log("  tamam      " + ad); }
}
function esitSayi(ad, bulunan, beklenen) {
  if (Number(bulunan) !== Number(beklenen)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen +
      ", bulunan " + bulunan);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (!k) { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
  else { gecen++; console.log("  tamam      " + ad); }
}

/** Bir eşiğin doğurduğu boş aralık. */
function bosluk(s, i) {
  var e = s.esik[i];
  return {
    esik: e,
    alt: e * (1 + s.oran[i] / 100) * (1 + T.KDV),
    ust: e * (1 + s.oran[i + 1] / 100) * (1 + T.KDV)
  };
}

/* ---------------------------------------------------------------- *
 * Açılıştaki üç sayı — yazının tezi bunlara dayanıyor
 * ---------------------------------------------------------------- */
console.log("Giriş: 1401–1600 cm³ bandının 1.650.000 TL eşiği");
var b = bosluk(T.ICTEN_1600, 2);
gecer("eşikteki anahtar teslim fiyat", b.alt);
gecer("bir lira üstündeki fiyat", b.ust);
gecer("aradaki boşluk", b.ust - b.alt);
gecer("eşiğin kendisi", b.esik);
/* Yazi "OTV artisi 165.000, kalan 33.000 KDV" diyor. */
var otvFarki = b.esik * (T.ICTEN_1600.oran[3] - T.ICTEN_1600.oran[2]) / 100;
gecer("ÖTV artışının kendisi", otvFarki);
gecer("o artışın üzerinden alınan KDV", otvFarki * T.KDV);
dogru("ikisi toplamı boşluğa eşit",
  Math.abs(otvFarki * (1 + T.KDV) - (b.ust - b.alt)) < 1);

/* ---------------------------------------------------------------- *
 * Boş aralıklar tablosu — HTML'DEN AYRIŞTIRILARAK
 *
 * Sayının yazıda bir yerde geçmesi yetmez: aynı tutar kısa cevapta ve
 * SSS'te de duruyor, o yüzden tablodaki hücre bozulsa bile "geçiyor mu"
 * kontrolü geçerdi. Tablo bu yüzden AYRIŞTIRILIYOR ve her hücre kendi
 * sırasındaki tarife satırından hesaplanan değerle karşılaştırılıyor.
 * Böylece sıralama da belgeden doğrulanmış oluyor, testin kendi
 * dizisinden değil.
 * ---------------------------------------------------------------- */
console.log("\nBoş aralıklar tablosu (HTML'den ayrıştırılıyor)");

/* Tabloyu başlığından bul; sayfada birden fazla tablo var. */
var tabloBas = HTML.indexOf("2026 ÖTV eşiklerinin doğurduğu boş fiyat aralıkları");
dogru("boş aralıklar tablosu sayfada var", tabloBas > 0);
var govde = HTML.slice(HTML.indexOf("<tbody>", tabloBas),
                       HTML.indexOf("</tbody>", tabloBas));
/* HTML varliklari cozuluyor: yazida ">" isareti &gt; olarak yazilmak
   ZORUNDA, ama karsilastirilan tarife etiketi duz metin. */
function duz(x) {
  return x.replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
var satirlar = (govde.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(function (tr) {
  var h = (tr.match(/<th[^>]*>([\s\S]*?)<\/th>/) || [])[1] || "";
  var td = (tr.match(/<td>([\s\S]*?)<\/td>/g) || []).map(duz);
  return { ad: duz(h), hucre: td };
});

var TABLO = [
  ["Elektrikli, ≤160 kW", T.BEV_ALT, 0],
  ["Şarj edilebilir hibrit, ≤1600 cm³", T.PHEV_1600, 0],
  ["Benzin/dizel, 1601–2000 cm³", T.ICTEN_2000, 0],
  ["Elektrikli, >160 kW", T.BEV_UST, 0],
  ["Benzin/dizel, 1401–1600 cm³", T.ICTEN_1600, 2],
  ["Hibrit, 1601–2000 cm³", T.HIBRIT_ORTA, 0],
  ["Benzin/dizel, ≤1400 cm³", T.ICTEN_1400, 2],
  ["Benzin/dizel, ≤1400 cm³", T.ICTEN_1400, 1],
  ["Benzin/dizel, 1401–1600 cm³", T.ICTEN_1600, 0],
  ["Benzin/dizel, ≤1400 cm³", T.ICTEN_1400, 0]
];

esitSayi("tabloda beklenen satır sayısı", satirlar.length, TABLO.length);

var genislikler = [];
TABLO.forEach(function (r, i) {
  var g = bosluk(r[1], r[2]);
  genislikler.push({ ad: r[0], w: g.ust - g.alt });
  var sat = satirlar[i];
  if (!sat) { hata++; console.error("  BASARISIZ  " + (i + 1) + ". satır yok"); return; }
  var no = (i + 1) + ". satır";
  esitMetin(no + " — araç", sat.ad, r[0]);
  esitMetin(no + " — matrah eşiği", sat.hucre[0], tl(g.esik));
  esitMetin(no + " — oran", sat.hucre[1],
    "%" + r[1].oran[r[2]] + " → %" + r[1].oran[r[2] + 1]);
  esitMetin(no + " — boş aralık", sat.hucre[2], tl(g.alt) + " – " + tl(g.ust));
  esitMetin(no + " — genişlik", sat.hucre[3], tl(g.ust - g.alt));
});

/* Sıralama artık BELGEDEN okunuyor: tablodaki genişlik sütunu azalan mı? */
console.log("\nTablo sıralaması ve uç değerler");
var belgeGenislik = satirlar.map(function (s) {
  return parseFloat(s.hucre[3].replace(/\./g, ""));
});
var sirali = true;
for (var i = 1; i < belgeGenislik.length; i++) {
  if (belgeGenislik[i] > belgeGenislik[i - 1]) sirali = false;
}
dogru("tablo genişliğe göre azalan (belgeden)", sirali, belgeGenislik.join(" > "));

var enGenis = genislikler.reduce(function (a, x) { return x.w > a.w ? x : a; });
var enDar = genislikler.reduce(function (a, x) { return x.w < a.w ? x : a; });
dogru("en geniş boşluk elektrikli araçta", enGenis.ad.indexOf("Elektrikli, ≤160") === 0, enGenis.ad);
esitSayi("belgedeki ilk satır en geniş olan", belgeGenislik[0], Math.round(enGenis.w));
esitSayi("belgedeki son satır en dar olan",
  belgeGenislik[belgeGenislik.length - 1], Math.round(enDar.w));
/* Kısa cevapta ve SSS'te de aynı iki sayı geçiyor. */
gecer("en geniş boşluk", enGenis.w);
gecer("en dar boşluk", enDar.w);
dogru("en geniş boşluk yazıda üç kez geçiyor (tablo, kısa cevap, SSS)",
  HTML.split(tl(enGenis.w)).length - 1 >= 3,
  "yalnizca " + (HTML.split(tl(enGenis.w)).length - 1) + " kez");

/* İki bandın aynı eşikte aynı aralığı üretmesi yazıda iddia ediliyor. */
var a1 = bosluk(T.ICTEN_1400, 2), a2 = bosluk(T.ICTEN_1600, 1);
dogru("≤1400 ve 1401–1600 bantları 1.100.000'de aynı aralığı üretiyor",
  Math.round(a1.alt) === Math.round(a2.alt) && Math.round(a1.ust) === Math.round(a2.ust),
  tl(a1.alt) + "–" + tl(a1.ust) + " vs " + tl(a2.alt) + "–" + tl(a2.ust));

/* Yazı "en geniş boşluklar DÜŞÜK oranlı araçlarda" diyor; bu bir iddia,
   doğrulanmalı. Ölçüt: eşikteki oran FARKI. */
var evFark = T.BEV_ALT.oran[1] - T.BEV_ALT.oran[0];
var benzinFark = T.ICTEN_1600.oran[3] - T.ICTEN_1600.oran[2];
dogru("elektriklide oran farkı benzinliden büyük", evFark > benzinFark,
  evFark + " > " + benzinFark + " degil");
gecer("elektrikli oran farkı (puan)", String(evFark));
gecer("benzinli oran farkı (puan)", String(benzinFark));

/* ---------------------------------------------------------------- *
 * Verginin vergisi tablosu
 * ---------------------------------------------------------------- */
console.log("\nVerginin vergisi (2500 cm³, matrah 2.000.000)");
var buyuk = T.hesapla({ tur: "icten", hacim: 2500, matrah: 2000000 });
gecer("ÖTV tutarı", buyuk.otv);
gecer("KDV tutarı", buyuk.kdv);
gecer("KDV'nin matraha isabet eden kısmı", 2000000 * T.KDV);
gecer("KDV'nin ÖTV'ye isabet eden kısmı", buyuk.otv * T.KDV);
gecer("anahtar teslim fiyat", buyuk.toplam);
gecer("toplam vergi", buyuk.vergi);
var payKdv = (buyuk.otv * T.KDV) / buyuk.kdv * 100;
gecer("KDV'nin yüzde kaçı ÖTV üzerinden", "%" + payKdv.toFixed(2).replace(".", ","));
gecer("vergi payı", "%" + Math.round(buyuk.vergiPayi * 100));

/* ---------------------------------------------------------------- *
 * Etkin vergi yükü tablosu
 * ---------------------------------------------------------------- */
console.log("\nEtkin vergi yükü tablosu");
[
  ["Elektrikli 150 kW", { tur: "elektrik", kw: 150, matrah: 1500000 }],
  ["Şarjlı hibrit 1500 cm³", { tur: "phev", hacim: 1500, elektrikKw: 80, co2: 20, menzil: 80, matrah: 1200000 }],
  ["Benzinli 1400 cm³", { tur: "icten", hacim: 1400, matrah: 900000 }],
  ["Benzinli 1600 cm³", { tur: "icten", hacim: 1600, matrah: 1600000 }],
  ["Benzinli 1800 cm³", { tur: "icten", hacim: 1800, matrah: 1600000 }],
  ["Benzinli 2500 cm³", { tur: "icten", hacim: 2500, matrah: 2000000 }]
].forEach(function (x) {
  var r = T.hesapla(x[1]);
  gecer(x[0] + " — oran", "%" + r.oran);
  gecer(x[0] + " — anahtar teslim", r.toplam);
  gecer(x[0] + " — vergi payı",
    "%" + (r.vergiPayi * 100).toFixed(1).replace(".", ","));
});

/* Yazi "1600'den 1800'e gecmek fiyati 3.648.000'den 4.800.000'e cikarir"
   diyor; ayni matrahta olduklari da iddianin parcasi. */
var kck = T.hesapla({ tur: "icten", hacim: 1600, matrah: 1600000 });
var byk = T.hesapla({ tur: "icten", hacim: 1800, matrah: 1600000 });
dogru("1600→1800 aynı matrahta fiyatı yükseltiyor", byk.toplam > kck.toplam,
  tl(byk.toplam) + " > " + tl(kck.toplam) + " degil");

/* ---------------------------------------------------------------- *
 * Ters basamak — yazının en çarpıcı iddiası
 * ---------------------------------------------------------------- */
console.log("\nTers basamak (1700 cm³ şarjlı hibrit, e-motor 80 kW)");
var temel = { tur: "phev", hacim: 1700, elektrikKw: 80, co2: 20, menzil: 80 };
function ile(m) {
  var g = {}; for (var k in temel) g[k] = temel[k];
  g.matrah = m; return T.hesapla(g);
}
var esikte = ile(T.PHEV_1800_ESIK);
var ustte = ile(T.PHEV_1800_ESIK + 1);
gecer("eşikteki matrah", T.PHEV_1800_ESIK);
gecer("bir lira fazlası", T.PHEV_1800_ESIK + 1);
gecer("eşikteki oran", "%" + esikte.oran);
gecer("düştüğü satırın oranı", "%" + ustte.oran);
gecer("eşikteki anahtar teslim", esikte.toplam);
gecer("bir lira fazlasının anahtar teslimi", ustte.toplam);
gecer("aradaki fark", esikte.toplam - ustte.toplam);
/* Iddianin ta kendisi: bir lira FAZLA matrah, DAHA UCUZ arac. */
dogru("bir lira fazla matrah gerçekten daha ucuz", ustte.toplam < esikte.toplam,
  tl(ustte.toplam) + " < " + tl(esikte.toplam) + " degil");
dogru("üst satırın oranı daha düşük", ustte.oran < esikte.oran,
  ustte.oran + " < " + esikte.oran + " degil");

console.log("\nŞarj edilebilen, edilemeyenden fazla ödüyor");
var sarjli = T.hesapla({ tur: "phev", hacim: 1700, elektrikKw: 80, co2: 20, menzil: 80, matrah: 1200000 });
var sarjsiz = T.hesapla({ tur: "hibrit", hacim: 1700, elektrikKw: 80, matrah: 1200000 });
gecer("şarj edilebilenin oranı", "%" + sarjli.oran);
gecer("şarj edilemeyenin oranı", "%" + sarjsiz.oran);
gecer("şarj edilebilenin anahtar teslimi", sarjli.toplam);
gecer("şarj edilemeyenin anahtar teslimi", sarjsiz.toplam);
gecer("aradaki fark", sarjli.toplam - sarjsiz.toplam);
dogru("şarj edilebilen gerçekten daha pahalı", sarjli.toplam > sarjsiz.toplam,
  "iddia yanlis");
gecer("karşılaştırmanın matrahı", 1200000);

/* ---------------------------------------------------------------- *
 * Kanundaki koşullar yazıda doğru aktarılmış mı
 * ---------------------------------------------------------------- */
console.log("\nKoşullar ve dayanaklar");
gecer("hibrit kW eşiği", String(T.HIBRIT_KW));
gecer("PHEV emisyon sınırı", String(T.PHEV_CO2));
gecer("PHEV menzil sınırı", String(T.PHEV_MENZIL));
gecer("KDV oranı", "%" + Math.round(T.KDV * 100));
dogru("Cumhurbaşkanı Kararı numarası yazıda", HTML.indexOf("10115") >= 0);
dogru("şarjlı hibrit satırlarının dayanağı yazıda", HTML.indexOf("7521") >= 0);
dogru("ÖTV Kanunu numarası yazıda", HTML.indexOf("4760") >= 0);
dogru("MTV Kanunu numarası yazıda", HTML.indexOf("197 sayılı") >= 0);

/* Ic baglantilar: yazi iki araca ve iki yaziya baglanmali. */
console.log("\nİç bağlantılar");
[["ÖTV aracı", "../../otv-hesaplama/"],
 ["MTV aracı", "../../mtv-hesaplama/"],
 ["vergi kaması yazısı", "../vergi-kamasi-ucretin-gercek-yuku/"],
 ["makale listesi", "../"]].forEach(function (x) {
  dogru(x[0] + " bağlantısı var", HTML.indexOf('href="' + x[1] + '"') >= 0, x[1]);
});

if (hata) {
  console.error("\n" + hata + " kontrol basarisiz.");
  console.error("Tarife degistiyse yazidaki tutarlar da guncellenmeli.");
  process.exit(1);
}
console.log("\n" + gecen + " gecti, 0 kaldi. (ÖTV basamak yazısı sayıları)");
