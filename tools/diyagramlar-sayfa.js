#!/usr/bin/env node
/*!
 * Diyagramlar sayfasını hesaptan üretir: statik SVG'ler, 100 liralık şerit,
 * tablolar ve metindeki her data-s alanı diyagramlar/hesap.js'ten gelir.
 *
 * NEDEN STATİK SVG: JS'siz okur, arama motoru ve ilk boyama tam şekli
 * görsün. Tarayıcı aynı çizim modülüyle (diyagramlar/cizim.js) kutu
 * genişliğinde yeniden çizer.
 *
 * NEDEN ÜRETEÇ: bordro ya da kredi motoru değişirse (yeni yıl, oran
 * değişikliği, düzeltme) sayfadaki rakam da değişmeli. --check CI'da
 * sayfanın motorla aynı olduğunu doğrular; ayrışırsa kırmızı.
 *
 * Kullanım:
 *   node tools/diyagramlar-sayfa.js           # yaz
 *   node tools/diyagramlar-sayfa.js --check   # sayfa hesaptan üretilmiş mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "diyagramlar", "index.html");
var H = require(path.join(KOK, "diyagramlar", "hesap.js"));
var C = require(path.join(KOK, "diyagramlar", "cizim.js"));

/* Statik genişlik: .wrap içindeki şekil tuvalinin masaüstü genişliğine yakın.
   Tarayıcı zaten kutu genişliğinde yeniden çizer; bu ilk boyamanın ölçeği. */
var GENISLIK = 1040;

function blok(html, ad, icerik) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("Blok bulunamadı: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}

function uret(html) {
  var u = H.ucret(H.VARSAYILAN_KAT);
  var k = H.kredi();
  var e = H.egri();
  var secili = H.ucretNoktasi(H.VARSAYILAN_KAT);

  var sankey = C.sankey({ genislik: GENISLIK, veri: u, etiket:
    "Aylık brüt " + C.tl(u.brutAy) + ": işverenin 100 lirasından " + C.sayi(u.netPay * 100, 1) + " lira çalışana, " +
    C.sayi(u.vergiPay * 100, 1) + " lira vergiye, " + C.sayi(u.primPay * 100, 1) + " lira SGK primine." });
  var aylik = C.aylik({ genislik: GENISLIK, veri: u, etiket:
    "Aylık brüt " + C.tl(u.brutAy) + " ile " + u.yil + " yılında ay ay net ücret, vergi ve prim." });
  var kredi = C.kredi({ genislik: GENISLIK, veri: k, etiket:
    C.tl(k.girdi.anapara) + ", " + k.girdi.vade + " ay: ilk taksitte her 100 liranın " + C.sayi(k.ilkMaliyetPay * 100, 1) +
    " lirası faiz ve vergi; anapara " + k.kesisimAyi + ". ayda öne geçiyor." });
  var egri = C.egri({ genislik: GENISLIK, veri: e, secili: secili, etiket:
    "Aylık brüte göre kesinti oranı, " + e.yil + ": SGK tavanında " + C.yuzde(e.tepe.ortalama) + " ile zirve, tavanın üstünde düşüş." });

  html = blok(html, "DG:sankey", sankey.svg);
  html = blok(html, "DG:aylik", aylik.svg);
  html = blok(html, "DG:kredi", kredi.svg);
  html = blok(html, "DG:egri", egri.svg);
  html = blok(html, "DGT:sankey", C.tabloSankey(u));
  html = blok(html, "DGT:aylik", C.tabloAylik(u));
  html = blok(html, "DGT:kredi", C.tabloKredi(k));
  html = blok(html, "DGT:egri", C.tabloEgri(e, function (kat) { return H.ucretNoktasi(kat); }));

  var pay = function (v) { return (v * 100).toFixed(2) + "%"; };
  html = blok(html, "DG:serit",
    '          <div class="dg-serit-bar" aria-hidden="true">' +
    '<span class="dg-net" data-pay="net" style="width:' + pay(u.netPay) + '"></span>' +
    '<span class="dg-vergi" data-pay="vergi" style="width:' + pay(u.vergiPay) + '"></span>' +
    '<span class="dg-prim" data-pay="prim" style="width:' + pay(u.primPay) + '"></span></div>');

  // data-s alanları: öğenin içi düz metin; etiket korunur, içerik değişir.
  var m = Object.assign({}, C.ucretMetin(u, secili), C.sabitMetin(k, e));
  var bulunan = {};
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (tam, ac, et, anahtar, ic, kapa) {
    if (!(anahtar in m)) throw new Error("Bilinmeyen data-s alanı: " + anahtar);
    bulunan[anahtar] = true;
    return ac + C.kacis(m[anahtar]).replace(/&quot;/g, '"') + kapa;
  });
  // Metin alanı olarak yazılan her anahtar sayfada gerçekten dolduruldu mu?
  ["netPay", "vergiPay", "primPay", "brutAy", "aylikBaslik", "aylikOz", "ilkMal", "kesisim", "tepe", "geri"].forEach(function (a) {
    if (!bulunan[a]) throw new Error("Sayfada data-s alanı yok: " + a);
  });
  return html;
}

var eski = fs.readFileSync(SAYFA, "utf8");
var yeni = uret(eski);
if (process.argv.indexOf("--check") >= 0) {
  if (yeni !== eski) {
    console.error("Diyagramlar sayfası bayat — 'node tools/diyagramlar-sayfa.js' çalıştırın.");
    process.exit(1);
  }
  console.log("Diyagramlar sayfası hesapla aynı.");
} else {
  if (yeni !== eski) fs.writeFileSync(SAYFA, yeni);
  console.log(yeni !== eski ? "Diyagramlar sayfası yazıldı." : "Diyagramlar sayfası zaten güncel.");
}
