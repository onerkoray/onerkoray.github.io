#!/usr/bin/env node
/*!
 * Kategori düzeni tutarlı mı?
 *
 * NEDEN VAR
 * ---------
 * Kategoriler ölçüldüğünde iki yönde birden bozuktu.
 *
 * ARAÇLARDA çöp kutusu vardı: 49 aracın 25'i "vergi" etiketi
 * taşıyordu ve içinde döviz kurları, kredi hesaplama, borç kapatma
 * planı, kişisel enflasyon ve "ev almak mı kiralamak mı" duruyordu.
 * Filtre düğmesinin kendi adı bunu itiraf ediyordu: "Vergi & Finans".
 *
 * MAKALELERDE dağılma vardı: 36 yazıya 16 etiket düşüyordu ve 10'u tek
 * üyeliydi. Tek üyeli etiket küme kurmaz, yalnızca listeyi böler.
 * Üstelik ikisi aynı şeydi ve sadece büyük harfle ayrılıyordu:
 * "Sosyal güvenlik" / "Sosyal Güvenlik".
 *
 * NE YAKALIYOR
 * ------------
 *   1. Bir aracın kategorisi ÜÇ yerde yazılı: karttaki data-cat, karo
 *      sınıfı ve card-icons.json. Üçü ayrışabilir ve ayrıştığında
 *      hiçbir şey bozulmaz -- yalnızca filtre ile karo birbirini
 *      tutmaz. Kapı üçünü bağlıyor.
 *   2. Kullanılan her kategorinin CSS'i ve filtre düğmesi olmalı.
 *      Tanımsız kategori sessizdir: kart görünür, karo renksiz kalır.
 *   3. Hiçbir makale kategorisi tek üyeli olmamalı.
 *   4. İki kategori yalnızca büyük/küçük harfle ayrılmamalı.
 *
 * Kullanım: node tools/taksonomi-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var ana = fs.readFileSync(path.join(KOK, "index.html"), "utf8");
var css = fs.readFileSync(path.join(KOK, "style.css"), "utf8");
var ikonlar = JSON.parse(fs.readFileSync(path.join(KOK, "tools", "card-icons.json"), "utf8"));
var makaleler = JSON.parse(fs.readFileSync(path.join(KOK, "tools", "makaleler.json"), "utf8"));

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

console.log("Kategori düzeni\n");

/* --- araç kartlarını çıkar ----------------------------------------- */
var kartlar = [];
(ana.match(/<li class="project-card[\s\S]*?<\/li>/g) || []).forEach(function (b) {
  var cat = /data-cat="([^"]+)"/.exec(b);
  var karo = /class="karo karo--([a-z]+)"/.exec(b);
  var slug = /data-karo="([^"]+)"/.exec(b);
  if (cat && karo && slug) {
    kartlar.push({ slug: slug[1], cat: cat[1], karo: karo[1] });
  }
});
console.log("  araç kartı: " + kartlar.length);
console.log("  makale: " + makaleler.length + "\n");

/* --- 1. üç yer birbirini tutuyor mu -------------------------------- */
var sapan = [];
kartlar.forEach(function (k) {
  if (k.cat !== k.karo) {
    sapan.push(k.slug + ": data-cat=" + k.cat + " ama karo--" + k.karo);
  }
  var ik = ikonlar[k.slug];
  if (!ik) { sapan.push(k.slug + ": ikon kaydı yok"); return; }
  if (ik.cat !== k.cat) {
    sapan.push(k.slug + ": data-cat=" + k.cat + " ama card-icons=" + ik.cat);
  }
});
dogru("kategori üç yerde de aynı (data-cat, karo, ikon kaydı)",
  sapan.length === 0, sapan.slice(0, 6).join("\n      "));

/* --- 2. her kategorinin CSS'i ve filtresi var mı -------------------- */
var katlar = {};
kartlar.forEach(function (k) { katlar[k.cat] = (katlar[k.cat] || 0) + 1; });
var adlar = Object.keys(katlar).sort();
console.log("  araç kategorileri: " +
  adlar.map(function (a) { return a + "=" + katlar[a]; }).join(", ") + "\n");

/* Gradyan ve iz AYRI AYRI aranıyor. İlk sürüm ikisini tek koşulda
   arıyordu ve gradyanı silen mutasyon kaçtı: ::before kuralı ayakta
   kaldığı için koşul yine sağlanıyordu. Kategori ikisine de muhtaç --
   gradyansız karo renksiz, izsiz karo diğerlerinden ayrışmaz. */
var gradyansiz = adlar.filter(function (a) {
  return !(new RegExp("\\.karo--" + a + "\\s*\\{").test(css));
});
dogru("her kategorinin karo gradyanı var", gradyansiz.length === 0,
  gradyansiz.join(", "));
/* İz: "maas" temel .karo::before kuralını kullanıyor, diğerleri onu
   eziyor. Yani her kategoriden kendi kuralını istemek yanlış olurdu --
   ilk sürüm tam bunu yapıp haksız kırmızı verdi. Gerçek değişmez: iki
   kategori aynı izi paylaşmamalı, yani kategoriye özel iz sayısı
   kategori sayısının bir eksiğinden az olamaz. */
var ozelIz = adlar.filter(function (a) {
  return css.indexOf(".karo--" + a + "::before") >= 0;
});
dogru("temel iz kuralı duruyor", /\.karo::before\s*\{/.test(css));
dogru("iki kategori aynı izi paylaşmıyor",
  ozelIz.length >= adlar.length - 1,
  "kategori " + adlar.length + ", özel iz " + ozelIz.length +
  " (" + ozelIz.join(", ") + ")");

var filtreSiz = adlar.filter(function (a) {
  return ana.indexOf('data-filter="' + a + '"') < 0;
});
dogru("her kategorinin filtre düğmesi var", filtreSiz.length === 0, filtreSiz.join(", "));

/* Ters yön: filtre düğmesi olup hiç aracı olmayan kategori. */
var bosFiltre = (ana.match(/data-filter="([a-z]+)"/g) || [])
  .map(function (m) { return m.slice(13, -1); })
  .filter(function (a) { return a !== "hepsi" && !katlar[a]; });
dogru("boş filtre düğmesi yok", bosFiltre.length === 0, bosFiltre.join(", "));

/* --- 3. çöp kutusu oluşmasın --------------------------------------- */
/* Bir kategori araçların yarısından fazlasını tutuyorsa kategori
   değil, kutudur. "vergi" bölünmeden önce 49'un 25'ini tutuyordu. */
var enBuyuk = adlar.reduce(function (a, b) {
  return katlar[a] >= katlar[b] ? a : b;
});
dogru("hiçbir kategori araçların yarısından fazlasını tutmuyor",
  katlar[enBuyuk] <= kartlar.length / 2,
  enBuyuk + " = " + katlar[enBuyuk] + "/" + kartlar.length);

/* --- 4. makale kategorileri ---------------------------------------- */
var mk = {};
makaleler.forEach(function (x) {
  var k = x.kicker || "(yok)";
  mk[k] = (mk[k] || 0) + 1;
});
var mkAdlar = Object.keys(mk);
console.log("  makale kategorileri: " +
  mkAdlar.map(function (a) { return a + "=" + mk[a]; }).join(", ") + "\n");

var tekUyeli = mkAdlar.filter(function (a) { return mk[a] === 1; });
dogru("hiçbir makale kategorisi tek üyeli değil",
  tekUyeli.length === 0, tekUyeli.join(", "));

/* Yalnızca büyük/küçük harfle ayrılan kategori: "Sosyal güvenlik" ile
   "Sosyal Güvenlik" tam olarak böyle ikiye bölünmüştü. */
var kucuk = {};
var ciftler = [];
mkAdlar.forEach(function (a) {
  var k = a.toLocaleLowerCase("tr");
  if (kucuk[k]) ciftler.push(kucuk[k] + " / " + a);
  kucuk[k] = a;
});
dogru("iki kategori yalnızca büyük harfle ayrılmıyor",
  ciftler.length === 0, ciftler.join(", "));

/* --- 5. ana sayfa ItemList'i kartlarla aynı kümeyi söylüyor ----------- */
/* 51 kartın 3'ü (başabaş, yatırım fizibilitesi, beyanname) ana sayfanın
   araç ItemList'inde yoktu: kart eklenmiş, yapılandırılmış veri
   unutulmuştu. Küme eşitliği iki yönde de denetleniyor. */
var ldUrl = [];
(ana.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).forEach(function (b) {
  var d;
  try { d = JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")); } catch (e) { return; }
  (Array.isArray(d) ? d : (d["@graph"] || [d])).forEach(function (x) {
    if (x && x["@type"] === "ItemList" && x["@id"] === "https://korayoner.dev/#projects") {
      x.itemListElement.forEach(function (e) { ldUrl.push(e.item.url); });
    }
  });
});
var kartUrl = kartlar.map(function (k) { return "https://korayoner.dev/" + k.slug + "/"; });
var ldEksik = kartUrl.filter(function (u) { return ldUrl.indexOf(u) < 0; });
var kartsiz = ldUrl.filter(function (u) { return kartUrl.indexOf(u) < 0; });
dogru("her araç kartı ana sayfa ItemList'inde", ldEksik.length === 0, ldEksik.join(", "));
dogru("ItemList'te kartı olmayan araç yok", kartsiz.length === 0, kartsiz.join(", "));
dogru("ItemList sıra numaraları ardışık", ldUrl.length > 0 && (function () {
  var m = ana.slice(ana.indexOf('"@id": "https://korayoner.dev/#projects"'));
  var p = (m.match(/"position": (\d+),/g) || []).slice(0, ldUrl.length)
    .map(function (x) { return +x.replace(/\D/g, ""); });
  return p.every(function (v, i) { return v === i + 1; });
})());

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: kırktan fazla araç kartı okundu", kartlar.length > 40,
  String(kartlar.length));
dogru("KONTROL: otuzdan fazla makale okundu", makaleler.length > 30,
  String(makaleler.length));
dogru("KONTROL: ItemList okundu (kırktan fazla öğe)", ldUrl.length > 40, String(ldUrl.length));
dogru("KONTROL: en az üç araç kategorisi var", adlar.length >= 3,
  String(adlar.length));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (kategori düzeni)");
process.exit(hata ? 1 : 0);
