#!/usr/bin/env node
/*!
 * Altbilgi bağlantıları her sayfada var mı ve çalışıyor mu?
 *
 * NEDEN VAR
 * ---------
 * Bu sitede ortak bir üst menü YOK: 140 sayfada 63 farklı menü var ve
 * çoğu site menüsü değil, sayfa içi bölüm atlama menüsü ("Hesapla" →
 * #hesapla). Dolayısıyla "her sayfadan erişilebilir olsun" isteğinin
 * tek gerçek adresi ALTBİLGİDİR — orada 140 sayfada yalnızca birkaç
 * varyant var.
 *
 * Altbilgi elle yazılıyor ve üreteci yok. Bir bölüm eklendiğinde 140
 * dosyaya elle girmek gerekiyor; biri atlanırsa hiçbir şey bozulmaz,
 * yalnızca o sayfadan o bölüme gidilemez. Bu kapı onu söylüyor.
 *
 * NE YAKALIYOR
 * ------------
 *   1. Altbilgisi olmayan sayfa (doğrulama dosyası hariç).
 *   2. Zorunlu bağlantılardan birini taşımayan sayfa.
 *   3. Göreli yolu KIRIK olan altbilgi bağlantısı — derinlik sayfadan
 *      sayfaya değiştiği için en kolay yapılan hata bu.
 *
 * Kullanım: node tools/altbilgi-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");

/* Her sayfanın altbilgisinde bulunması gereken hedefler. Anahtar, yolun
   sonundaki bölüm; değer, insan tarafından okunan ad. */
var ZORUNLU = {
  "hakkimda/": "Hakkımda",
  "makaleler/": "Makaleler",
  "yayinlar/": "Yayımlanmış çalışmalar",
  "iletisim/": "İletişim",
  "gizlilik/": "Gizlilik"
};

/* Altbilgisi olmaması BEKLENEN dosyalar. */
var MUAF = ["google96cf4fdc28fcda5f.html"];

var ATLA = { ".git": 1, "node_modules": 1, "_cekirdek": 1, ".github": 1,
             images: 1, docs: 1 };

function sayfalar(dizin, out) {
  out = out || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (d) {
    var p = path.join(dizin, d.name);
    if (d.isDirectory()) {
      if (!ATLA[d.name] && d.name.charAt(0) !== ".") sayfalar(p, out);
    } else if (d.name.endsWith(".html")) {
      out.push(path.relative(KOK, p).replace(/\\/g, "/"));
    }
  });
  return out;
}

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

console.log("Altbilgi bağlantıları\n");

var hepsi = sayfalar(KOK).filter(function (p) {
  return MUAF.indexOf(p) < 0;
});

var altbilgisiz = [], eksik = [], kirik = [];

hepsi.forEach(function (p) {
  var s = fs.readFileSync(path.join(KOK, p), "utf8");
  var m = s.match(/<ul class="footer-links"[^>]*>([\s\S]*?)<\/ul>/);
  if (!m) { altbilgisiz.push(p); return; }
  var govde = m[1];

  /* Baglantinin YAZILISINA degil VARDIGI YERE bakiliyor.
     Ilk surum href icinde "makaleler/" dizgisini ariyordu; makale
     sayfalari zaten o klasorun icinde oldugu icin baglantilari "../"
     ve kapi 35 sayfayi haksiz isaretledi. Artik her baglanti cozulup
     hangi klasore ciktigi olculuyor. */
  var varilan = {};
  var kirikVar = false;
  (govde.match(/href="([^"]+)"/g) || []).forEach(function (h) {
    var u = h.slice(6, -1);
    if (/^https?:|^\/\/|^mailto:|^#/.test(u)) return;

    var mutlak = u.charAt(0) === "/"
      ? path.join(KOK, u)
      : path.resolve(path.dirname(path.join(KOK, p)), u);

    /* Var mi? */
    var dosya = fs.existsSync(path.join(mutlak, "index.html"))
      ? path.join(mutlak, "index.html")
      : (fs.existsSync(mutlak) && fs.statSync(mutlak).isFile() ? mutlak : null);
    if (!dosya) { kirik.push(p + " -> " + u); kirikVar = true; return; }

    /* Hangi bolume ciktigini KOKE GORE goreli yoldan buluyoruz. */
    var goreli = path.relative(KOK, mutlak).replace(/\\/g, "/");
    varilan[goreli === "" ? "/" : goreli + "/"] = true;
  });

  Object.keys(ZORUNLU).forEach(function (hedef) {
    if (!varilan[hedef]) eksik.push(p + " -> " + hedef);
  });
});

console.log("  taranan sayfa: " + hepsi.length + "\n");

dogru("her sayfanın altbilgisi var", altbilgisiz.length === 0,
  altbilgisiz.slice(0, 6).join("\n      "));
dogru("zorunlu bağlantıların hepsi her sayfada", eksik.length === 0,
  eksik.slice(0, 8).join("\n      ") +
  (eksik.length > 8 ? "\n      ... +" + (eksik.length - 8) : ""));
dogru("altbilgi bağlantılarının göreli yolu doğru", kirik.length === 0,
  kirik.slice(0, 8).join("\n      "));

/* KONTROL: tarama gerçekten çalışıyor mu? Hiç sayfa bulunmazsa
   yukarıdaki üç iddia da boşuna geçerdi. */
dogru("KONTROL: yüzden fazla sayfa tarandı", hepsi.length > 100,
  String(hepsi.length));
dogru("KONTROL: zorunlu liste boş değil",
  Object.keys(ZORUNLU).length >= 5);

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (altbilgi)");
process.exit(hata ? 1 : 0);
