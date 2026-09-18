#!/usr/bin/env node
/*!
 * Mevzuat takvimine bağlı yazıların iddialarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Sitenin en çok okunan iki yazısı — torba yasa ve kademeli emeklilik —
 * hareketli bir yasama durumunu anlatıyor ve bugüne kadar HİÇ testi yoktu.
 * Tek korumaları <meta name="gecerlilik"> hatırlatmasıydı; o da "yazıyı
 * gözden geçir" diyor, neyin yanlış olduğunu söylemiyor.
 *
 * Bu yazılarda bayatlama sessizdir ve pahalıdır: sayfa açılır, tablolar
 * hizalı durur, yalnızca Meclis'in durumu hakkında yanlış konuşur. Üstelik
 * tam da arama hacminin zirve yaptığı günlerde.
 *
 * DÖRT KONTROL
 * ------------
 *   1. TARİHE BAĞLI İFADELER. "TBMM tatilde" cümlesi 1 Ekim'de yanlış olur.
 *      Bu test o günü beklemez; tarihi gelince ifadeyi ADIYLA söyleyerek
 *      düşer. Geçerlilik kapısı "bak" der, bu "şu cümle" der.
 *
 *   2. İKİ YAZI ÇELİŞMESİN. İkisi de kademeli emeklilik teklifinin esas
 *      numarasını anıyor. Biri yeni bir teklife güncellenip öteki eskide
 *      kalırsa site kendi kendisiyle çelişir — ve bunu kimse fark etmez.
 *
 *   3. YAZI KENDİ KURALINA UYSUN. Torba yasa yazısı şunu söylüyor: "Kanun
 *      numarası ve yayım tarihi yoksa, o düzenleme henüz yoktur." Yürürlüğe
 *      giren kanunlar tablosundaki her satırın kanun numarası ve Resmî
 *      Gazete tarihi taşıdığı burada denetleniyor.
 *
 *   4. TAKVİM YAŞLANMASI. Kesin tarihli takvim satırları data-tarih taşıyor;
 *      tarihi geçen satır "gerçekleşti" diye işaretli olmak zorunda. Takvim
 *      yazısının merkezî arıza biçimi budur: satır sessizce geçmişe düşer,
 *      yazı onu hâlâ beklenen olay gibi sunar.
 *
 * Kullanım: node tools/mevzuat-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var TORBA = path.join(KOK, "makaleler", "torba-yasa-ne-var-ne-yok", "index.html");
var KADEME = path.join(KOK, "makaleler", "kademeli-emeklilik-son-durum", "index.html");

/* Bugün: testin kendisi zamana bağlı olduğu için dışarıdan verilebiliyor.
   Böylece "1 Ekim'de ne olacak" sorusu o günü beklemeden sınanabiliyor:
   MEVZUAT_BUGUN=2026-10-01 node tools/mevzuat-testi.js */
var BUGUN = process.env.MEVZUAT_BUGUN || new Date().toISOString().slice(0, 10);

/* TARİHE BAĞLI İFADELER.
   Her biri, belirtilen tarihten İTİBAREN sayfada bulunmamalı. Tarih o
   ifadenin doğru kaldığı son günün ertesidir. */
var IFADELER = [
  { dosya: TORBA, ifade: "TBMM tatilde", bitis: "2026-10-01",
    neden: "Yasama yılı açıldıktan sonra Meclis tatilde değil." },
  { dosya: TORBA, ifade: "1 Ekim 2026'da açılıyor", bitis: "2026-10-01",
    neden: "Açılış geçmişte kaldı; geçmiş zamana çevrilmeli." },
  { dosya: TORBA, ifade: "Meclis 1 Ekim'de açıldığında", bitis: "2026-10-01",
    neden: "Gelecek zamanlı kurgu; açılış gerçekleşti." }
];

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "\n             " + detay : ""));
}

function oku(p) { return fs.readFileSync(p, "utf8"); }
function ad(p) { return path.basename(path.dirname(p)); }

console.log("Mevzuat takvimi yazıları — iddia doğrulaması");
console.log("Bugün: " + BUGUN + "\n");

/* ------------------------------------------------------------------ 1 */
IFADELER.forEach(function (x) {
  var s = oku(x.dosya);
  var var_mi = s.indexOf(x.ifade) !== -1;
  var gecti = BUGUN >= x.bitis;
  if (gecti) {
    gecer(ad(x.dosya) + " — \"" + x.ifade + "\" kaldırılmalı",
      !var_mi, x.neden + "  (geçerlilik bitişi: " + x.bitis + ")");
  } else {
    /* Tarih gelmeden ifade zaten kaldırılmışsa tabloyu güncellemek gerekir:
       aksi hâlde kontrol sessizce anlamsızlaşır. */
    gecer(ad(x.dosya) + " — \"" + x.ifade + "\" hâlâ yerinde",
      var_mi, "İfade sayfadan çıkmış; IFADELER listesinden de çıkarın.");
  }
});

/* ------------------------------------------------------------------ 2 */
(function () {
  function esasNumaralari(s) {
    var m = s.match(/\b\d\/\d{3,5}\b/g) || [];
    var tek = [];
    m.forEach(function (x) { if (tek.indexOf(x) === -1) tek.push(x); });
    return tek;
  }
  var a = esasNumaralari(oku(TORBA));
  var b = esasNumaralari(oku(KADEME));
  gecer("torba yazısında esas numarası var", a.length >= 1, a.join(", ") || "(yok)");
  gecer("kademeli yazısında esas numarası var", b.length >= 1, b.join(", ") || "(yok)");
  gecer("iki yazı aynı esas numarasını söylüyor",
    a.length >= 1 && b.length >= 1 && a.join(",") === b.join(","),
    "torba: " + (a.join(", ") || "-") + "   kademeli: " + (b.join(", ") || "-") +
    "\n             Biri güncellenip öteki unutulmuş olabilir.");
})();

/* ------------------------------------------------------------------ 3 */
(function () {
  var s = oku(TORBA);
  var i = s.indexOf("<caption>2026 yılında yürürlüğe giren");
  gecer("yürürlüğe giren kanunlar tablosu bulundu", i > -1);
  if (i < 0) return;
  var bas = s.lastIndexOf("<table", i), son = s.indexOf("</table>", i);
  var blok = s.slice(bas, son);
  var satirlar = [];
  var re = /<tr>([\s\S]*?)<\/tr>/g, m;
  while ((m = re.exec(blok))) {
    var h = [], re2 = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, m2;
    while ((m2 = re2.exec(m[1]))) h.push(m2[1].replace(/<[^>]+>/g, "").trim());
    if (h.length) satirlar.push(h);
  }
  var govde = satirlar.slice(1);
  gecer("tabloda satır var", govde.length >= 1, govde.length + " satır");
  govde.forEach(function (r) {
    var kanun = r[0] || "", rg = r[1] || "";
    gecer("\"" + kanun.slice(0, 34) + "\" kanun numarası taşıyor",
      /\b7\d{3}\b/.test(kanun),
      "Yazının kendi kuralı: kanun numarası yoksa o düzenleme henüz yoktur.");
    gecer("\"" + kanun.slice(0, 34) + "\" Resmî Gazete tarihi taşıyor",
      /\d{1,2}\s+\S+\s+20\d\d/.test(rg), "Resmî Gazete sütunu: " + rg);
  });
})();

/* ------------------------------------------------------------------ 4 */
/* TAKVİM YAŞLANMASI.
   Takvim yazısının merkezî arıza biçimi: satırlar sessizce geçmişe düşüyor,
   yazı hâlâ onları beklenen olay gibi sunuyor. Kesin tarihli satırlar
   data-tarih taşıyor; tarihi geçen satır "gerçekleşti" diye işaretli olmak
   zorunda. Böylece takvim bir tahmin değil, İZLENEN takvim oluyor. */
(function () {
  var s = oku(TORBA);
  var i = s.indexOf("<caption>Eylül–Aralık 2026 takvimi");
  gecer("takvim tablosu bulundu", i > -1);
  if (i < 0) return;
  var bas = s.lastIndexOf("<table", i), son = s.indexOf("</table>", i);
  var blok = s.slice(bas, son);

  var re = /<tr>([\s\S]*?)<\/tr>/g, m, tarihli = 0;
  while ((m = re.exec(blok))) {
    var satir = m[1];
    var t = satir.match(/data-tarih="(\d{4}-\d{2}-\d{2})"/);
    if (!t) continue;
    tarihli++;
    var baslik = (satir.match(/<th[^>]*>([\s\S]*?)<\/th>/) || ["", "?"])[1]
      .replace(/<[^>]+>/g, "").trim();
    var hucre = (satir.match(/<td[^>]*data-tarih[^>]*>([\s\S]*?)<\/td>/) || ["", ""])[1];
    var isaretli = hucre.indexOf("gerçekleşti") !== -1;
    if (BUGUN >= t[1]) {
      gecer("\"" + baslik + "\" gerçekleşti olarak işaretlenmeli",
        isaretli, "Tarih " + t[1] + " geçti; satır hâlâ beklenen olay gibi duruyor.");
    } else {
      gecer("\"" + baslik + "\" henüz gelmedi, işaretsiz",
        !isaretli, "Tarih " + t[1] + " gelmeden gerçekleşti denmiş.");
    }
  }
  gecer("takvimde makine okunur tarihli satır var", tarihli >= 2, tarihli + " satır");
})();

/* ------------------------------------------------------------------ */
console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " +
  kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
