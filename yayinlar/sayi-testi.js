#!/usr/bin/env node
/*
 * /yayinlar/ sayfasının künyelerini doğrular.
 *
 * NEDEN VAR
 * ---------
 * Bir künye yanlışsa hiçbir şey bozulmaz: sayfa açılır, bağlantı çalışır,
 * yalnızca atıf yanlış olur. Ve bu sayfanın tek işi doğru atıf vermek.
 *
 * DÖRT ÖNERME
 * -----------
 * Ö1. Sayfadaki her DOI modülde var, modüldeki her DOI sayfada var.
 *     KONTROL: tek yönlü kapsama yetmez — iki yön ayrı ayrı ölçülüyor.
 *
 * Ö2. JSON-LD GEÇERLİ ve ItemList modülle aynı sayıda eser taşıyor.
 *     İlk sürümde işaret yorumları JSON'un içinde kalmış ve belge
 *     geçersiz JSON olmuştu. Tarayıcıda hiçbir şey bozulmuyor; arama
 *     motoru sayfanın BÜTÜN işaretlemesini sessizce atıyor. Bu yüzden
 *     ayrıştırma testi burada zorunlu.
 *
 * Ö3. Kayıt tarafındaki bilinen sorunlar sayfada YAZILI.
 *     Zenodo'daki iki başlık ayraçsız, bir özet başka çalışmayı
 *     anlatıyor. Site düzeltilmiş biçimi gösteriyor; farkı saklamak,
 *     Zenodo'da olmayan bir şeyi varmış gibi sunmak olurdu.
 *
 * Ö4. Site başlığı ile Zenodo başlığı YALNIZCA ayraçla ayrılıyor.
 *     KONTROL: harfleri ve boşlukları atınca iki dizge aynı olmalı —
 *     yoksa "düzeltme" adı altında başlık değiştirilmiş olur.
 *
 * Kullanım: node yayinlar/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var Y = require(path.join(__dirname, "yayin.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(m) { return HTML.split(m).length - 1; }
function gecsin(ad, m) { gecer(ad, kacKez(m) >= 1, "sayfada yok: " + m); }

console.log("Yayın listesi — künye denetimi\n");

/* ---------------------------------------------------------------- 1
   Ö1: iki yönlü kapsama */
gecer("modülde 5 çalışma", Y.CALISMALAR.length === 5,
  String(Y.CALISMALAR.length));

Y.CALISMALAR.forEach(function (c) {
  gecer("DOI sayfada: " + c.doi, kacKez(c.doi) >= 1);
});

var sayfaDoi = (HTML.match(/10\.5281\/zenodo\.\d+/g) || []);
var benzersiz = sayfaDoi.filter(function (d, i) {
  return sayfaDoi.indexOf(d) === i;
});
gecer("sayfadaki her DOI modülde var",
  benzersiz.every(function (d) { return Y.calisma(d) !== null; }),
  benzersiz.filter(function (d) { return !Y.calisma(d); }).join(", "));
gecer("sayfada tam 5 farklı DOI", benzersiz.length === 5,
  String(benzersiz.length));

/* KONTROL: arama gerçekten yapılıyor mu? Olmayan bir DOI bulunmamalı. */
gecer("KONTROL: olmayan DOI sayfada yok",
  kacKez("10.5281/zenodo.99999999") === 0);

/* ---------------------------------------------------------------- 2
   Ö2: JSON-LD ayrıştırılabiliyor mu? */
var bloklar = HTML.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
gecer("iki ld+json bloğu var", bloklar.length === 2, String(bloklar.length));

var itemList = null, cozulen = 0;
bloklar.forEach(function (b) {
  var govde = b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  var d;
  try { d = JSON.parse(govde); } catch (e) {
    gecer("ld+json ayrıştırılabiliyor", false, e.message);
    return;
  }
  cozulen++;
  (d["@graph"] || [d]).forEach(function (n) {
    if (n["@type"] === "ItemList") itemList = n;
  });
});
gecer("her blok geçerli JSON", cozulen === bloklar.length,
  cozulen + "/" + bloklar.length);
gecer("ItemList bulundu", itemList !== null);

if (itemList) {
  gecer("ItemList sayısı modülle aynı",
    itemList.numberOfItems === Y.CALISMALAR.length,
    itemList.numberOfItems + " vs " + Y.CALISMALAR.length);
  gecer("ItemList öge sayısı beyanla aynı",
    itemList.itemListElement.length === itemList.numberOfItems);

  var yazarsiz = itemList.itemListElement.filter(function (o) {
    return !o.item || !o.item.author ||
      o.item.author["@id"] !== "https://korayoner.dev/#oner-koray";
  });
  gecer("her eser Person'a bağlı", yazarsiz.length === 0,
    String(yazarsiz.length) + " eserde bağ yok");

  var tipsiz = itemList.itemListElement.filter(function (o) {
    return !o.item || o.item["@type"] !== "ScholarlyArticle";
  });
  gecer("her eser ScholarlyArticle", tipsiz.length === 0);

  /* Sıralama iddiası: yeniden eskiye. */
  var tarihler = itemList.itemListElement.map(function (o) {
    return o.item.datePublished;
  });
  var sirali = tarihler.slice().sort().reverse();
  gecer("ItemList yeniden eskiye sıralı",
    tarihler.join(",") === sirali.join(","), tarihler.join(","));
}

/* ---------------------------------------------------------------- 3
   Ö3: bilinen sorunlar yazılı mı? */
gecer("başlık farkı olan 2 kayıt", Y.baslikFarki().length === 2,
  String(Y.baslikFarki().length));
Y.baslikFarki().forEach(function (c) {
  gecer("Zenodo başlığı sayfada yazılı: " + c.doi,
    kacKez(c.zenodoBaslik) >= 1);
});
gecsin("başlık notu açıklanmış", "alt başlık ayraçsız görünüyor");

gecer("özeti sorunlu 1 kayıt", Y.ozetiSorunlu().length === 1,
  String(Y.ozetiSorunlu().length));
gecsin("özet notu açıklanmış", "başka bir çalışmayı");

/* ---------------------------------------------------------------- 4
   Ö4: site başlığı Zenodo'dakinden yalnızca ayraçla ayrılıyor mu? */
function harfler(s) {
  return s.replace(/[^0-9A-Za-zÇĞİÖŞÜçğıöşü]/g, "").toLocaleLowerCase("tr");
}
Y.baslikFarki().forEach(function (c) {
  gecer("başlık yalnızca ayraçla farklı: " + c.doi,
    harfler(c.baslik) === harfler(c.zenodoBaslik),
    harfler(c.baslik).slice(0, 40) + " vs " + harfler(c.zenodoBaslik).slice(0, 40));
});

/* KONTROL: karşılaştırıcı gerçekten ayırt ediyor mu? */
gecer("KONTROL: farklı metinler eşit sayılmıyor",
  harfler("Abc def") !== harfler("Abc xyz"));

/* ---------------------------------------------------------------- 5
   Sayfa iddiaları */
gecsin("working paper olduğu söylenmiş", "hakemli dergi yayını değildir");
gecsin("lisans yazılı", "CC BY 4.0");
gecsin("ORCID sayfada", "0009-0005-8730-3577");
gecsin("iki ilişki türü anlatılmış", "bağımsız olarak yeniden üreten");

var kendi = Y.kendiDoiTasiyan().length;
gecer("kendi DOI'sini taşıyan 2 site yazısı", kendi === 2, String(kendi));
gecsin("site sürümü ifadesi kullanılmış", "Bu çalışmanın site sürümü");
gecsin("anlatan yazı ifadesi kullanılmış", "Bulgularını anlatan yazı");

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
