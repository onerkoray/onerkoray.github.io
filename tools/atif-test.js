#!/usr/bin/env node
/*
 * Atif etiketlerinin (citation_*) bicim denetimi.
 *
 * NEDEN AYRI TEST:
 * tools/atif-etiketleri.py --check yalnizca "etiketler semayla ayni mi"
 * diye soruyor. Sema yanlis olsaydi etiketler de yanlis olur ve --check
 * yine yesil kalirdi. Burada etiketin KENDI kurallari denetleniyor:
 * Highwire Press bicimi, zorunlu alanlarin varligi ve -- en onemlisi --
 * DOI'siz sayfada etiket BULUNMAMASI.
 *
 * Son madde bir iddia meselesi: citation_* etiketi tasiyan sayfa,
 * kaynakcilara "ben alintilanabilir bir calismayim" diyor. DOI'si
 * olmayan bir yaziya bunu yazdirmak yanlis beyan olurdu.
 *
 * Kullanim: node tools/atif-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var hata = 0, gecen = 0;

function ok(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

function makaleler() {
  var d = path.join(KOK, "makaleler");
  return fs.readdirSync(d).filter(function (x) {
    return fs.existsSync(path.join(d, x, "index.html"));
  }).sort();
}

/* Sayfadaki citation_* etiketlerini ad -> [deger] olarak toplar. */
function etiketler(html) {
  var out = {}, re = /<meta name="(citation_[a-z_]+)" content="([^"]*)">/g, m;
  while ((m = re.exec(html))) {
    (out[m[1]] = out[m[1]] || []).push(m[2]);
  }
  return out;
}

/* Sayfanin kendini DOI'li bir eser ilan edip etmedigi: JSON-LD
   grafinda identifier.propertyID === "DOI" olan makale dugumu. */
function bildirilenDoi(html) {
  var re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, m;
  var TUR = ["ScholarlyArticle", "Article", "TechArticle", "BlogPosting"];
  while ((m = re.exec(html))) {
    var d;
    try { d = JSON.parse(m[1]); } catch (e) { continue; }
    var dugumler = d["@graph"] || [d];
    for (var i = 0; i < dugumler.length; i++) {
      var n = dugumler[i];
      if (!n || TUR.indexOf(n["@type"]) < 0) continue;
      var id = n.identifier;
      if (id && !Array.isArray(id) && id.propertyID === "DOI") return id.value;
      if (Array.isArray(id)) {
        for (var j = 0; j < id.length; j++) {
          if (id[j] && id[j].propertyID === "DOI") return id[j].value;
        }
      }
    }
  }
  return null;
}

console.log("Atif etiketleri — bicim denetimi");

var ZORUNLU = ["citation_title", "citation_author", "citation_doi",
               "citation_publication_date", "citation_abstract_html_url"];
var etiketli = 0, doiliSayfa = 0;

makaleler().forEach(function (slug) {
  var yol = path.join(KOK, "makaleler", slug, "index.html");
  var html = fs.readFileSync(yol, "utf8");
  var e = etiketler(html);
  var doi = bildirilenDoi(html);
  var varMi = Object.keys(e).length > 0;

  if (doi) doiliSayfa++;

  /* DOI yoksa etiket de olmamali. */
  if (!doi) {
    ok(slug + ": DOI yok, atif etiketi de yok", !varMi,
       varMi ? "etiketler: " + Object.keys(e).join(", ") : "");
    return;
  }

  /* DOI varsa etiketler olmali ve eksiksiz olmali. */
  ok(slug + ": DOI var, atif etiketleri de var", varMi);
  if (!varMi) return;
  etiketli++;

  var eksik = ZORUNLU.filter(function (a) { return !e[a]; });
  ok(slug + ": zorunlu etiketlerin hepsi var", eksik.length === 0,
     eksik.join(", "));

  ok(slug + ": citation_doi semadaki DOI ile ayni",
     e.citation_doi && e.citation_doi[0] === doi,
     "etiket " + (e.citation_doi || [])[0] + " vs sema " + doi);

  /* Highwire tarih bicimi: YYYY/MM/DD. ISO yazilirsa Scholar okumaz. */
  ok(slug + ": yayin tarihi YYYY/MM/DD",
     /^\d{4}\/\d{2}\/\d{2}$/.test((e.citation_publication_date || [])[0] || ""),
     (e.citation_publication_date || [])[0]);

  /* Yazar "Soyad, Ad" bicimi. */
  ok(slug + ": yazar Soyad, Ad bicimi",
     (e.citation_author || []).every(function (a) { return a.indexOf(",") > 0; }),
     (e.citation_author || []).join(" | "));

  /* Ozet adresi sayfanin kendisi olmali; baska yere isaret ederse
     Scholar tam metni baska yerde arar. */
  var url = (e.citation_abstract_html_url || [])[0] || "";
  ok(slug + ": ozet adresi bu sayfa",
     url === "https://korayoner.dev/makaleler/" + slug + "/", url);

  /* PDF etiketi YAZILMAMALI: sitede PDF yok, baska alan adina isaret
     etmek Scholar acisindan kirik tam metin demek. */
  ok(slug + ": citation_pdf_url yazilmamis", !e.citation_pdf_url,
     (e.citation_pdf_url || [])[0]);
});

/* KONTROL: yukaridaki iddialarin hicbiri, HIC etiket olmadiginda
   dusmezdi -- "DOI yok, etiket yok" satirlari bos sitede de gecerdi.
   Bu yuzden en az bir sayfanin gercekten etiketlendigi ayrica
   olculuyor. */
console.log("");
ok("en az bir sayfa atif etiketi tasiyor", etiketli > 0,
   "etiketli sayfa: " + etiketli);
ok("DOI bildiren her sayfa etiketlenmis", etiketli === doiliSayfa,
   etiketli + " etiketli / " + doiliSayfa + " DOI'li");

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (atif etiketleri)");
process.exit(hata ? 1 : 0);
