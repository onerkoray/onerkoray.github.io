#!/usr/bin/env node
/*!
 * Sitedeki BES devlet katkısı oranı motorla aynı mı?
 *
 * NEDEN VAR
 * ---------
 * Oran 1 Ocak 2026'da %30'tan %20'ye indi (10811 sayılı Cumhurbaşkanı
 * Kararı, Resmî Gazete 7 Ocak 2026, sayı 33130). Site bunu dokuz ay
 * boyunca fark etmedi: motor %30 hesaplıyordu ve aynı sayı yedi ayrı
 * yerde daha yazılıydı — görünen nesirde, sık sorulan sorularda,
 * JSON-LD cevabında, metodoloji sayfasında, bir makalede ve giriş
 * alanının varsayılan değerinde.
 *
 * Hiçbiri bozulmadı. Grafik yükseliyor, tablo doluyor, araç çalışıyordu;
 * yalnızca sonuç fazla iyimserdi. Bu sitede en pahalı hata türü budur ve
 * ikinci kez yaşandı — birincisi mülga GVK m.32 atfıydı.
 *
 * NE YAKALIYOR
 * ------------
 * Motor bir oran söylüyor, sayfalar başka bir oran yazıyorsa kırılır.
 * Kara liste değil KARŞILAŞTIRMA: doğru sayı `hesap.js` içindeki tek
 * kaynaktan okunuyor, sayfalarda o sayının yazılı olduğu doğrulanıyor.
 * Oran yarın değişirse tek bir yeri düzeltmek yetmeyecek; bu test kalan
 * yerleri gösterecek.
 *
 * Kullanım: node tools/bes-orani-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var B = require(path.join(KOK, "birikim-hesaplama", "hesap.js"));

var ORAN = B.VARSAYILAN.devletKatkiYuzde;

/* BES devlet katkısı oranını yazan sayfalar. Yeni bir sayfa oranı
   yazarsa buraya eklenmeli; liste kısa tutuluyor ki bakımı mümkün olsun. */
var SAYFALAR = [
  "birikim-hesaplama/index.html",
  "birikim-hesaplama/metodoloji/index.html",
  "makaleler/uzun-vadeli-yatirim-nasil-yapilir/index.html"
];

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "  — " + detay : "")); }
}

console.log("BES devlet katkısı oranı — motor ve sayfalar aynı mı?\n");
console.log("  motordaki oran: %" + ORAN + "\n");

/* Oranın kendisi: mevzuat değişirse burası kırılır ve değiştiren kişi
   dayanağı yazmak zorunda kalır. */
dogru("motor oranı %20 (10811 s.K., RG 7.1.2026, s.33130)", ORAN === 20,
  "%" + ORAN);

/* "devlet katkısı ... %NN" kalıbındaki her oran motorunkiyle aynı mı? */
/* Aradaki satir ici etiketler ATLANIYOR. Ilk surum "<" karakterini
   disliyordu ve makaledeki en vurgulu ifadeyi -- "katki payinin
   <strong>%20'si</strong>" -- goremiyordu: yani sayfanin en gorunur
   oranini denetleyemiyordu. Mutasyon bunu yakaladi. */
var ARA = "(?:<[^>]*>|[^.<])";
var KALIP = new RegExp(
  "devlet katk[\u0131i]s[\u0131i]" + ARA + "{0,60}?%\\s*(\\d{1,2})" + "|" +
  "katk[\u0131i] pay[\u0131i]n[\u0131i]n" + ARA + "{0,40}?%\\s*(\\d{1,2})",
  "gi");

SAYFALAR.forEach(function (p) {
  var yol = path.join(KOK, p);
  if (!fs.existsSync(yol)) { dogru("sayfa var: " + p, false); return; }
  var s = fs.readFileSync(yol, "utf8");

  var yanlis = [], bulunan = 0, m;
  KALIP.lastIndex = 0;
  while ((m = KALIP.exec(s)) !== null) {
    var n = parseInt(m[1] || m[2], 10);
    var cevre = s.slice(Math.max(0, m.index - 90), m.index + m[0].length + 60);

    /* HAK EDIS KADEMELERI ORAN DEGILDIR. "devlet katkısının ne kadarını
       alırım? 3 yılda %15, 6 yılda %35" cümlesi kalıba düşüyor ama o
       yüzdeler eşleşme oranı değil, hak ediş oranı.

       ÖLÇÜT EŞLEŞMENİN KENDİSİ, çevresi değil. İlk deneme ±90 karakterlik
       çevreye bakıyordu ve meşru oran cümlelerini de eliyordu: "...%20'sidir.
       Ancak bir takvim YILINDA..." — sonraki cümle filtreyi tetikliyordu.
       Hak ediş ifadesi "3 yılda %15" biçiminde eşleşmenin İÇİNDE geçer. */
    if (/\d\s*y[ıi]l|hak ed|hak kazan|kademe/i.test(m[0])) continue;

    bulunan++;
    if (n !== ORAN) {
      /* Geçmiş oranı ANLATAN cümle serbest: "öncesinde %30" gibi. */
      if (/öncesinde|önce|eskiden|2013|2022|2025'e kadar|indi|düşür/i.test(cevre)) continue;
      yanlis.push("%" + n + " → ..." + cevre.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 90));
    }
  }
  dogru(p + " (" + bulunan + " oran atfı)", yanlis.length === 0,
    yanlis.join(" | "));
});

/* KONTROL: kalıp gerçekten eşleşiyor mu? Hiç atıf bulunmazsa test
   boşuna yeşil olurdu. */
var toplam = 0;
SAYFALAR.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  KALIP.lastIndex = 0;
  while (KALIP.exec(s) !== null) toplam++;
});
dogru("KONTROL: kalıp en az üç yerde eşleşti", toplam >= 3, String(toplam));

/* KONTROL: yanlış bir oran gerçekten yakalanır mı? */
(function () {
  var sahte = "Devlet katkısı ödenen katkı payının %99'udur.";
  KALIP.lastIndex = 0;
  var m = KALIP.exec(sahte);
  dogru("KONTROL: sahte oran kalıba takılıyor",
    m !== null && parseInt(m[1] || m[2], 10) === 99);
})();

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (BES oranı)");
process.exit(hata ? 1 : 0);
