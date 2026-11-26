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
 * Ö3. Kayıt tarafındaki bilinen sorunlar sayfada YAZILI. Üç tür var:
 *     iki başlıkta ayraç eksik, bir özet başka çalışmayı anlatıyor, iki
 *     kayıtta dil türçe beyan edilmiş ama özet İngilizce. Ayrıca bir
 *     çalışmanın sitede sunan yazısı yok. Site düzeltilmiş biçimi
 *     gösteriyor ama farkı saklamıyor — saklamak, Zenodo'da olmayan bir
 *     şeyi varmış gibi sunmak olurdu.
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
/* ORCID 0009-0005-8730-3577 ile 2026-11-23'te karşılaştırıldı: ORCID'deki
   her Zenodo DOI'si (12) modülde var. ORCID'de ayrıca figshare ve SSRN
   kayıtları var; bunlar listedeki çalışmaların başka depolardaki kopyaları. */
gecer("modülde 12 çalışma", Y.CALISMALAR.length === 12,
  String(Y.CALISMALAR.length));
var SAYI_YAZI = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on",
  "on bir", "on iki", "on üç", "on dört", "on beş"];
gecer("paylaşım açıklamaları çalışma sayısını doğru söylüyor",
  kacKez("DOI ile kalıcı kaydı bulunan " + SAYI_YAZI[Y.CALISMALAR.length] + " çalışma") === 2,
  "sayfada '" + SAYI_YAZI[Y.CALISMALAR.length] + " çalışma' iki kez geçmeli");

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
gecer("sayfada modüldeki kadar farklı DOI", benzersiz.length === Y.CALISMALAR.length,
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

  /* Tür modülden: çalışma metni ScholarlyArticle, yazılım
     SoftwareSourceCode. Lisans da eser başına. */
  var tipsiz = itemList.itemListElement.filter(function (o) {
    var c = o.item && Y.calisma(o.item.identifier.value);
    return !c || o.item["@type"] !== Y.schemaTur(c) ||
      o.item.license !== Y.lisans(c).url || o.item.inLanguage !== Y.dil(c);
  });
  gecer("her eserin türü, lisansı ve dili modülle aynı", tipsiz.length === 0,
    String(tipsiz.length));
  var yazilimlar = itemList.itemListElement.filter(function (o) {
    return o.item["@type"] === "SoftwareSourceCode";
  });
  gecer("KONTROL: tek yazılım kaydı, MIT ve kod deposuyla",
    yazilimlar.length === 1 &&
    yazilimlar[0].item.license === "https://opensource.org/licenses/MIT" &&
    yazilimlar[0].item.codeRepository === "https://github.com/onerkoray/hesap-cekirdegi",
    String(yazilimlar.length));
  gecer("KONTROL: makaleler hâlâ ScholarlyArticle",
    itemList.itemListElement.filter(function (o) {
      return o.item["@type"] === "ScholarlyArticle";
    }).length === Y.CALISMALAR.length - 1);

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
gecer("19 Ekim kontrolü: başlık farkları giderilmiş", Y.baslikFarki().length === 0,
  String(Y.baslikFarki().length));
Y.baslikFarki().forEach(function (c) {
  gecer("Zenodo başlığı sayfada yazılı: " + c.doi,
    kacKez(c.zenodoBaslik) >= 1);
});
gecer("eski başlık düzeltme vaadi kaldırılmış", kacKez("alt başlık ayraçsız görünüyor") === 0);

gecer("19 Ekim kontrolü: yanlış kayıt özeti giderilmiş", Y.ozetiSorunlu().length === 0,
  String(Y.ozetiSorunlu().length));
gecer("eski özet düzeltme vaadi kaldırılmış", kacKez("başka bir çalışmayı") === 0);

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

/* Ozet dili uyusmazligi: iki kayitta beyan turkce, ozet ingilizce.
   Dil ALANI altisinda da dolu -- eksik olan alan degil, ozetin dili. */
gecer("özet dili uyuşmayan 2 kayıt", Y.ozetDiliFarkli().length === 2,
  String(Y.ozetDiliFarkli().length));
gecsin("İngilizce özet bilgisi açıklanmış", "Zenodo kaydında İngilizce özet bulunur");

/* Tam metin bağlantısı sessizce 404'e ya da başka dosya türüne dönüşmemeli. */
Y.CALISMALAR.forEach(function (c) {
  /* PDF'siz kayıt yalnız gerekçesi açıkça yazılmışsa (pdfYok) kabul edilir. */
  if (!c.pdf) {
    gecer("PDF yok ama gerekçesi yazılı: " + c.doi, typeof c.pdfYok === "string" && c.pdfYok.length > 10);
    return;
  }
  gecer("PDF adresi yerel yayın klasöründe: " + c.doi,
    /^yayinlar\/dosyalar\/\d+\.pdf$/.test(c.pdf));
  var dosya = path.join(__dirname, "..", c.pdf);
  gecer("PDF dosyası var: " + c.doi, fs.existsSync(dosya));
  if (!fs.existsSync(dosya)) return;
  var veri = fs.readFileSync(dosya);
  gecer("PDF başlığı ve Scholar boyut sınırı: " + c.doi,
    veri.subarray(0, 5).toString() === "%PDF-" && veri.length < 5000000);
  gecsin("doğrudan PDF bağlantısı: " + c.doi, 'href="../' + c.pdf + '"');
  if (itemList) {
    var eser = itemList.itemListElement.find(function (o) { return o.item.identifier.value === c.doi; });
    gecer("JSON-LD aynı PDF'ye bağlı: " + c.doi, !!eser && !!eser.item.encoding &&
      eser.item.encoding.contentUrl === "https://korayoner.dev/" + c.pdf);
  }
});
gecsin("atıf dışa aktarımı erişilebilir", 'href="koray-oner.bib"');

/* SAYFASIZLIK: sabit sayı değil ilişki.
   Önce "sayfası olmayan 1 çalışma" yazıyordu; BES yazısı çıkınca
   geçersizleşti. Sabit sayıyı 0 yapmak aynı tuzağı tekrarlardı. İddia
   artık şu: modülde sayfası olmayan kaç çalışma varsa, sayfada o kadar
   "henüz yok" notu olmalı. Bugün ikisi de sıfır. */
(function () {
  /* Yazılım kaydının anlatan yazısı değil kaynak kodu bağlantısı var. */
  var yayinSayfalari = Y.CALISMALAR.filter(function (c) { return c.yayinSayfasi; });
  var sayfasiz = Y.CALISMALAR.filter(function (c) { return !c.sayfa && !c.kod && !c.yayinSayfasi; }).length;
  var not = kacKez("site yazısı henüz yok");
  gecer("sayfasız çalışma sayısı ile not sayısı aynı",
    sayfasiz === not, sayfasiz + " çalışma vs " + not + " not");

  gecer("KONTROL: üç çalışma henüz ayrı bir sayfaya bağlı değil", sayfasiz === 3 && not === 3,
    sayfasiz + " / " + not);
  gecer("KONTROL: ayrı yayın sayfası dışındaki bağlantı satırları görünüyor",
    kacKez("ed-yayin-baglanti") === Y.CALISMALAR.length - yayinSayfalari.length,
    String(kacKez("ed-yayin-baglanti")));
  yayinSayfalari.forEach(function (c) {
    gecsin("yayın sayfası listeden erişilebilir: " + c.doi, 'href="../' + c.yayinSayfasi + '"');
    var sayfa = fs.readFileSync(path.join(__dirname, "..", c.yayinSayfasi, "index.html"), "utf8");
    gecer("Scholar PDF adresi kayıtla aynı: " + c.doi,
      sayfa.includes('name="citation_pdf_url" content="https://korayoner.dev/' + c.pdf + '"') &&
      sayfa.includes('name="citation_doi" content="' + c.doi + '"') &&
      !/<meta[^>]*content="[^"]*\bnoindex\b/i.test(sayfa));
  });

  /* Yöntemi araç olan çalışmalar: modülde "arac" alanı kaçsa sayfada o
     kadar araç bağlantısı, her biri doğru adrese. */
  var aracli = Y.CALISMALAR.filter(function (c) { return c.arac; });
  gecer("araç bağlantısı sayısı modülle aynı",
    kacKez("ed-yayin-arac") === aracli.length,
    kacKez("ed-yayin-arac") + " vs " + aracli.length);
  aracli.forEach(function (c) {
    gecer("araç bağlantısı yerinde: " + c.arac.yol,
      kacKez('href="../' + c.arac.yol + '/"') >= 1);
  });
})();

/* ---------------------------------------------------------------- 5
   Sayfa iddiaları */
gecsin("working paper olduğu söylenmiş", "hakemli dergi yayını değildir");
gecsin("lisans yazılı", "CC BY 4.0");
gecsin("yazılım lisansı yazılı", 'href="https://opensource.org/licenses/MIT" rel="noopener license">MIT</a>');
gecsin("yazılımın kaynak kodu bağlantısı", 'Kaynak kodu: <a href="https://github.com/onerkoray/hesap-cekirdegi"');
gecsin("İngilizce başlık işaretli", 'class="ed-yayin-baslik" lang="en"');
gecsin("ORCID sayfada", "0009-0005-8730-3577");
gecsin("iki ilişki türü anlatılmış", "bağımsız olarak yeniden üreten");

var kendi = Y.kendiDoiTasiyan().length;
gecer("kendi DOI'sini taşıyan 2 site yazısı", kendi === 2, String(kendi));
gecsin("site sürümü ifadesi kullanılmış", "Bu çalışmanın site sürümü");
gecsin("anlatan yazı ifadesi kullanılmış", "Bulgularını anlatan yazı");

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
