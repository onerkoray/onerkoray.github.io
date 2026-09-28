#!/usr/bin/env node
/*!
 * "Altın mı, dolar mı, mevduat mı?" sayfasının testi. Motorun kendisi
 * finans/varlik-test.js'te; burada sayfadaki her rakamın motordan geldiği,
 * ön çizimlerin seriyle aynı olduğu ve Türkçe eklerin doğru kurulduğu
 * sınanır.
 *
 * Kullanım: node altin-mi-dolar-mi-mevduat-mi/test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var V = require(path.join(KOK, "finans", "varlik-motoru.js"));
var G = require("./gorunum.js");
var U = require(path.join(KOK, "tools", "varlik-sayfa.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function esit(ad, a, b) { dogru(ad, a === b, JSON.stringify(a) + " ≠ " + JSON.stringify(b)); }
function blokIci(s, ad) {
  var m = s.match(new RegExp("<!-- " + ad + ":BASLANGIC -->([\\s\\S]*?)<!-- " + ad + ":BITIS -->"));
  return m ? m[1] : "";
}

var sayfa = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var o = V.ozet(G.VARSAYILAN);

console.log("Sayfa seriden üretilmiş");
esit("üreteç çıktısıyla aynı", U.uret(sayfa).s === sayfa, true);

console.log("Manşet ve açıklama");
function milyon(v) { return G.sayi(v / 1e6, 2) + " milyon TL"; }
["altin", "dolar", "mevduat"].forEach(function (k) {
  dogru("manşette " + k + " = " + milyon(o.sonuclar[k].deger),
    sayfa.indexOf('<strong data-v="' + k + '">' + milyon(o.sonuclar[k].deger) + "</strong>") >= 0);
});
dogru("manşette TÜFE çarpanı", sayfa.indexOf('<span data-v="tufeKat">' + G.kat(o.tufe.carpan) + "</span>") >= 0);
dogru("manşette son veri ayı", sayfa.indexOf('<span data-v="sonAy">' + G.ayAdi(V.SON) + "</span>") >= 0);
var ac = /<meta name="description" content="([^"]*)"/.exec(sayfa)[1];
dogru("açıklama altını söylüyor", ac.indexOf(milyon(o.sonuclar.altin.deger)) >= 0, ac);
dogru("açıklama 165 karakteri aşmıyor", ac.length <= 165, String(ac.length));
var baslik = /<title>([^<]*)<\/title>/.exec(sayfa)[1];
dogru("başlık 60 karakteri aşmıyor", baslik.length <= 60, baslik.length + ": " + baslik);
dogru("og ve twitter açıklaması aynı", sayfa.indexOf('property="og:description" content="' + ac + '"') >= 0 &&
  sayfa.indexOf('name="twitter:description" content="' + ac + '"') >= 0);

console.log("Ön çizimler");
var harita = blokIci(sayfa, "VARLIK-HARITA");
esit("haritada her başlangıç için bir kare (5 yıl)", (harita.match(/<rect class="vk-h /g) || []).length, V.harita(60).length);
var sonuc = blokIci(sayfa, "VARLIK-SONUC");
esit("beş sonuç kartı", (sonuc.match(/class="vk-kart /g) || []).length, 5);
dogru("ilk kart kazanan", sonuc.indexOf('vk-kart vk-' + G.SINIF[o.kazanan] + ' vk-ilk') >= 0);
var stop = blokIci(sayfa, "VARLIK-STOPAJ");
esit("stopaj tablosunda her dönem", (stop.match(/<tr><td>/g) || []).length, V.STOPAJ.length);
dogru("stopaj tablosu 'bugün' ile bitiyor", /– bugün<\/td><td class="sayi">%17,5<\/td>/.test(stop));
var grafik = blokIci(sayfa, "VARLIK-GRAFIK");
dogru("grafik etiketi altının son değerini söylüyor", grafik.indexOf("gram altın " + G.tl(o.sonuclar.altin.deger)) >= 0);
dogru("dar grafik ekran okuyucudan gizli", /data-grafik="varlik-dar"/.test(grafik) && /aria-hidden="true" data-grafik="varlik-dar"/.test(grafik));

console.log("S.S.S. ve JSON-LD");
var ldler = sayfa.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
var gecerli = ldler.every(function (b) {
  try { JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")); return true; } catch (e) { return false; }
});
dogru("JSON-LD blokları geçerli (" + ldler.length + ")", ldler.length >= 2 && gecerli);
esit("S.S.S. işaretlemesi ile görünen S.S.S. aynı sayıda", (sayfa.match(/"@type":"Question"/g) || []).length,
  (blokIci(sayfa, "VARLIK-SSS").match(/<details>/g) || []).length);

console.log("Türkçe ekler");
[[143, "'ünde"], [46, "'sında"], [45, "'inde"], [129, "'unda"], [127, "'sinde"], [2, "'sinde"], [30, "'unda"], [97, "'sinde"]]
  .forEach(function (c) {
    var ek = "'" + require(path.join(KOK, "tools", "grafikler-sayfa.js")).iyelikBulunma(c[0]);
    esit(c[0] + ek, ek, c[1]);
  });
dogru("sıfır kazanım 'hiçbirinde' diye yazılıyor, sayıyla değil", !/ 0'/.test(U.kazananCumlesi(60)) && !/ 0'/.test(U.kazananCumlesi(120)));
esit("Aralık 2005'te", G.ayDa("2005-12"), "Aralık 2005'te");

console.log("Sayfa betiğinin beklediği öğeler");
["in-tutar", "in-bas-ay", "in-bas-yil", "in-son-ay", "in-son-yil", "vk-sonuc", "vk-grafik", "vk-harita", "vk-mesaj", "varlik-form"]
  .forEach(function (id) { dogru("#" + id + " var", sayfa.indexOf('id="' + id + '"') >= 0); });
esit("dört süre düğmesi", (sayfa.match(/data-sure="/g) || []).length, 4);

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kontrol kaldı.");
process.exit(kalan ? 1 : 0);
