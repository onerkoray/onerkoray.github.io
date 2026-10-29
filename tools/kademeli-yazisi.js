#!/usr/bin/env node
/*
 * Kademeli emeklilik yazısının "Bir günün bedeli" tablosu.
 * Tarihler makaleler/kademeli-emeklilik-son-durum/bir-gun.js üzerinden
 * emeklilik tarihi motorundan gelir; elle yazılmaz.
 *
 * Kullanım:
 *   node tools/kademeli-yazisi.js           # yaz
 *   node tools/kademeli-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var G = require(path.join(KOK, "makaleler", "kademeli-emeklilik-son-durum", "bir-gun.js"));
var YAZI = path.join(KOK, "makaleler", "kademeli-emeklilik-son-durum", "index.html");

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function uzun(iso) { var p = iso.split("-"); return Number(p[2]) + " " + AYLAR[Number(p[1]) - 1] + " " + p[0]; }
function sure(f) { return f.yil + " yıl" + (f.ay ? " " + f.ay + " ay" : ""); }
function sayi(n) { return n.toLocaleString("tr-TR"); }
var ADI = { kadin: "Kadın", erkek: "Erkek" };

function blok() {
  var satir = [], ozet = [];
  ["kadin", "erkek"].forEach(function (c) {
    var k = G.karsilastir(c);
    [k.once, k.sonra].forEach(function (x, i) {
      satir.push("<tr><th scope=\"row\">" + ADI[c] + ", " + uzun(x.giris) + "</th><td>" + (i === 0 ? "EYT" : "1999–2008 geçiş") +
        "</td><td>" + x.bagli + "</td><td><strong>" + uzun(x.tarih) + "</strong></td></tr>");
    });
    ozet.push(c === "kadin"
      ? "Kadında bir günlük fark emeklilik tarihini <strong>" + sure(k.fark) + "</strong> öteliyor. 8 Eylül'de başlayan kadın " +
        sayi(k.sonra.gunGereken) + " günü " + uzun(k.sonra.gunTarihi) + "'da dolduruyor; ondan sonraki " + sure(k.yasBekleme) +
        " yalnızca yaşı beklemek."
      : "Erkekte fark <strong>" + sure(k.fark) + "</strong>: " + uzun(k.once.tarih) + " yerine " + uzun(k.sonra.tarih) + ".");
  });
  return '        <div class="table-wrap">\n          <table class="data-table data-table--text">\n' +
    "            <caption>Aynı kariyer, bir gün arayla: emeklilik tarihi</caption>\n" +
    '            <thead><tr><th scope="col">Kişi ve ilk giriş</th><th scope="col">Grup</th><th scope="col">Bağlayıcı şart</th><th scope="col">Emeklilik</th></tr></thead>\n' +
    "            <tbody>\n              " + satir.join("\n              ") + "\n            </tbody>\n          </table>\n        </div>\n" +
    "        <p>" + ozet.join(" ") + " Teklifin hedeflediği \"şartları dolmuş, yalnız yaşı bekleyen\" grup tam olarak bu.</p>";
}

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var bas = "<!-- BIR-GUN:BASLANGIC -->", bit = "<!-- BIR-GUN:BITIS -->";
  var s = fs.readFileSync(YAZI, "utf8"), i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0) { console.error("İşaretçi yok: BIR-GUN"); return 2; }
  var yeni = s.slice(0, i + bas.length) + "\n" + blok() + "\n        " + s.slice(j);
  if (kontrol) {
    if (yeni !== s) { console.log("Kademeli emeklilik yazısı güncel değil: node tools/kademeli-yazisi.js"); return 1; }
    console.log("Kademeli emeklilik yazısı güncel.");
    return 0;
  }
  if (yeni !== s) { fs.writeFileSync(YAZI, yeni, "utf8"); console.log("Yazı güncellendi."); } else console.log("Değişiklik yok.");
  return 0;
}

process.exit(main());
