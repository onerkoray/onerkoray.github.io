#!/usr/bin/env node
/*!
 * /yayinlar/ sayfasının çalışma listesini ve JSON-LD eser dizisini üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Aynı künye sayfada iki yerde geçiyor: okunan liste ve makinenin okuduğu
 * JSON-LD. Elle yazılsalardı biri güncellenip diğeri unutulurdu ve bu
 * SESSİZ bir hata olurdu — sayfa açılır, insan doğru künyeyi görür, arama
 * motoru eskisini alır. İkisi de tek modülden türüyor.
 *
 * İKİ İŞARET
 *   YAYIN-LISTE   Okunan liste: başlık, DOI, tarih, sunan yazı.
 *   YAYIN-LDJSON  ItemList + ScholarlyArticle düğümleri, author → Person.
 *
 *   node tools/yayin-listesi.js           # yaz
 *   node tools/yayin-listesi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "yayinlar", "index.html");
var Y = require(path.join(KOK, "yayinlar", "yayin.js"));

var KOKADRES = "https://korayoner.dev/";
var KISI = "https://korayoner.dev/#oner-koray";

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function tarih(iso) {
  var p = iso.split("-");
  return parseInt(p[2], 10) + " " + AYLAR[parseInt(p[1], 10) - 1] + " " + p[0];
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Bagli yazinin gorunen basligi. Slug yazmak ("kredi-tavani-ve-banka-
   karliligi") okuyucuya hicbir sey soylemiyor; baslik soyluyor. Modulde
   ikinci kez SAKLANMIYOR, yazinin kendi <h1>'inden okunuyor: baslik
   degisirse burasi da degisir ve --check farki yakalar. */
function yaziBasligi(sayfa) {
  var yol = path.join(KOK, sayfa, "index.html");
  var s = fs.readFileSync(yol, "utf8");
  var m = s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) throw new Error("h1 bulunamadi: " + sayfa);
  return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
function liste() {
  var s = ["<!-- YAYIN-LISTE:BASLANGIC -->"];

  Y.yillar().forEach(function (yil) {
    s.push("        <h3 id=\"y" + yil + "\">" + yil + "</h3>");
    s.push("        <ol class=\"ed-yayin-listesi\">");

    Y.yilinCalismalari(yil).forEach(function (c) {
      var satir = [];
      satir.push("          <li>");
      satir.push("            <p class=\"ed-yayin-baslik\"><a href=\"" +
        Y.adres(c) + "\" rel=\"noopener\">" + esc(c.baslik) + "</a></p>");

      var kunye = "Öner, K. (" + Y.yil(c) + "). " + Y.TUR + ". Zenodo. " +
        c.doi;
      satir.push("            <p class=\"ed-yayin-kunye\">" + esc(kunye) +
        " &middot; " + tarih(c.tarih) + " &middot; <a href=\"" +
        Y.LISANS.url + "\" rel=\"noopener license\">" + Y.LISANS.ad +
        "</a></p>");

      if (c.sayfa) {
        var yol = "../" + c.sayfa + "/";
        satir.push("            <p class=\"ed-yayin-baglanti\">" +
          (c.kendiDoi
            ? "Bu çalışmanın site sürümü: "
            : "Bulgularını anlatan yazı: ") +
          "<a href=\"" + yol + "\">" + esc(yaziBasligi(c.sayfa)) +
          "</a></p>");
      }

      /* Zenodo kaydındaki başlık farklıysa saklanmıyor, yazılıyor. */
      if (c.zenodoBaslik) {
        satir.push("            <p class=\"ed-yayin-not\">" +
          "Zenodo kaydında alt başlık ayraçsız görünüyor " +
          "(&#8220;" + esc(c.zenodoBaslik) + "&#8221;); " +
          "düzeltilecek.</p>");
      }
      if (c.ozetSorunlu) {
        satir.push("            <p class=\"ed-yayin-not\">" +
          "Zenodo kaydındaki özet bu çalışmayı değil başka bir çalışmayı " +
          "anlatıyor; düzeltilecek.</p>");
      }

      satir.push("          </li>");
      s.push(satir.join("\n"));
    });

    s.push("        </ol>");
  });

  s.push("<!-- YAYIN-LISTE:BITIS -->");
  return s.join("\n");
}

/* ------------------------------------------------------------------ */
function ldjson() {
  var ogeler = Y.yeniden().map(function (c, i) {
    var eser = {
      "@type": "ScholarlyArticle",
      "@id": Y.adres(c),
      "name": c.baslik,
      "headline": c.baslik,
      "datePublished": c.tarih,
      "inLanguage": "tr",
      "author": { "@id": KISI },
      "publisher": { "@type": "Organization", "name": "Zenodo" },
      "license": Y.LISANS.url,
      "identifier": {
        "@type": "PropertyValue", "propertyID": "DOI", "value": c.doi
      },
      "sameAs": Y.adres(c)
    };
    if (c.sayfa) eser.subjectOf = KOKADRES + c.sayfa + "/";
    return { "@type": "ListItem", "position": i + 1, "item": eser };
  });

  var dugum = {
    "@type": "ItemList",
    "@id": KOKADRES + "yayinlar/#liste",
    "name": "Koray Öner — yayımlanmış çalışmalar",
    "numberOfItems": Y.CALISMALAR.length,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": ogeler
  };

  /* AYRI bir ld+json blogu olarak yaziliyor. Ilk surumde bu dugum ana
     @graph dizisinin ICINE konmustu; isaret yorumlari JSON'un icinde
     kaldigi icin belge GECERSIZ JSON oluyordu. Tarayicida hicbir sey
     bozulmuyordu -- yalnizca arama motoru sayfanin BUTUN isaretlemesini
     sessizce atardi. Birden fazla ld+json blogu gecerlidir ve @id ayni
     grafa baglar. */
  var govde = JSON.stringify(
    { "@context": "https://schema.org", "@graph": [dugum] }, null, 2);
  return "<!-- YAYIN-LDJSON:BASLANGIC -->\n" +
    "  <script type=\"application/ld+json\">\n" +
    govde + "\n" +
    "  </" + "script>\n" +
    "<!-- YAYIN-LDJSON:BITIS -->";
}

/* ------------------------------------------------------------------ */
var ISARETLER = [
  { ad: "YAYIN-LISTE", uret: liste },
  { ad: "YAYIN-LDJSON", uret: ldjson }
];

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var s = fs.readFileSync(SAYFA, "utf8");
  var degisen = 0;
  for (var k = 0; k < ISARETLER.length; k++) {
    var t = ISARETLER[k];
    var bas = "<!-- " + t.ad + ":BASLANGIC -->";
    var bit = "<!-- " + t.ad + ":BITIS -->";
    var i = s.indexOf(bas), j = s.indexOf(bit);
    if (i < 0 || j < 0) {
      console.error("Sayfada işaret yok: " + bas + " / " + bit);
      return 1;
    }
    var mevcut = s.slice(i, j + bit.length);
    var yeni = t.uret();
    if (mevcut !== yeni) {
      degisen++;
      if (!kontrol) s = s.slice(0, i) + yeni + s.slice(j + bit.length);
    }
  }
  if (!degisen) { console.log("Yayın listesi güncel."); return 0; }
  if (kontrol) {
    console.error(degisen + " yayın bölümü güncel değil — " +
      "'node tools/yayin-listesi.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " yayın bölümü yazıldı.");
  return 0;
}

process.exit(main());
