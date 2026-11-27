#!/usr/bin/env node
/*
 * Marka işareti: "Ö halkası" (27 Kasım 2026).
 *
 * HİKÂYE
 *   Ö, Öner'in harfi: üstte iki nokta, altta bir halka. Halka bir maaşın
 *   paylaşılmasıdır: işverenin asgari ücretli bir çalışan için ödediği
 *   toplamın ne kadarı çalışanın cebine girer (yeşil), ne kadarı çalışan
 *   primi (çivit), ne kadarı işveren primi (kiremit) olur. Sitenin bütün
 *   işi bu ayrımı göstermek; işaret de onu taşır.
 *
 * VERİ
 *   Yaylar elle çizilmez: bordro motorunun 2026 asgari ücret hesabından
 *   gelir (Ocak, teşviksiz). YIL sabit tutulur ki marka her Ocak değişmesin;
 *   2026 parametresi düzeltilirse işaret de düzelir ve --check bunu yakalar.
 *   2026'da asgari ücrette gelir ve damga vergisi istisna; vergi yayı yok.
 *
 * ÇIKTI
 *   logo.svg (64x64, renkli) ve kök favicon sembolü (tools/favikon.py içinde,
 *   sekme ailesinin mürekkep kabında tek renk; yaylar boşluklarla ayrılır).
 *
 * Kullanım: node tools/marka.js          # logo.svg'yi yazar
 *           node tools/marka.js --check  # logo.svg ve favikon.py motorla aynı mı
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var B = require(path.join(KOK, "bordro", "motor.js"));
var P = require(path.join(KOK, "bordro", "parametreler.js"));

var YIL = 2026;
var BOSLUK = 9;   // yaylar arası boşluk, derece

function paylar() {
  var asgari = P[YIL].donemler[0].asgariBrut;
  var r = B.hesaplaYil(asgari, YIL)[0] || B.hesaplaYil(asgari, YIL).aylar[0];
  var net = r.net, cp = r.sgk + r.issizlik, ip = r.isverenSgk + r.isverenIssizlik;
  var vergi = (r.gelirVergisi || 0) + (r.damga || 0), top = r.isverenMaliyeti;
  if (Math.abs(net + cp + ip + vergi - top) > 0.01) throw new Error("marka: maliyet parçaları toplamı tutmuyor");
  if (vergi !== 0) throw new Error("marka: " + YIL + " asgari ücrette vergi çıktı; vergi yayı tasarlanmadı");
  return { net: net / top, calisanPrimi: cp / top, isverenPrimi: ip / top, toplam: top, netTL: net };
}

function nokta(cx, cy, r, aci) {
  var a = (aci - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function f(x) { return (Math.round(x * 100) / 100).toString(); }
function yay(cx, cy, r, a0, a1) {
  var p0 = nokta(cx, cy, r, a0), p1 = nokta(cx, cy, r, a1);
  return "M" + f(p0[0]) + " " + f(p0[1]) + "A" + f(r) + " " + f(r) + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + f(p1[0]) + " " + f(p1[1]);
}
/* Üç yay: tepeden saat yönünde net, çalışan primi, işveren primi. */
function yaylar(cx, cy, r) {
  var p = paylar(), kalan = 360 - 3 * BOSLUK, a = BOSLUK / 2, out = [];
  [["net", p.net], ["calisanPrimi", p.calisanPrimi], ["isverenPrimi", p.isverenPrimi]].forEach(function (k) {
    var b = a + k[1] * kalan;
    out.push({ ad: k[0], d: yay(cx, cy, r, a, b) });
    a = b + BOSLUK;
  });
  return out;
}

var RENK = { net: "#0e7c66", calisanPrimi: "#4b64ae", isverenPrimi: "#ca653c", murekkep: "#20332d" };

function logo() {
  var p = paylar(), y = yaylar(32, 38, 15.5);
  var yuzde = function (o) { return (o * 100).toFixed(1).replace(".", ","); };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Koray Öner">\n' +
    "  <!-- Ö halkası: tools/marka.js üretir, elle düzenleme. Halka, " + YIL + " asgari ücretinde\n" +
    "       işverenin ödediği her 100 liranın paylaşımı: net %" + yuzde(p.net) + " (yeşil), çalışan primi\n" +
    "       %" + yuzde(p.calisanPrimi) + " (çivit), işveren primi %" + yuzde(p.isverenPrimi) + " (kiremit). Kaynak: bordro motoru. -->\n" +
    '  <rect x="1" y="1" width="62" height="62" rx="4" fill="#f7faf8" stroke="#d9e3de" stroke-width="1.5"/>\n' +
    /* Noktalar küçük ve yakın: büyük ve aralıklı çizilince işaret yüz gibi okunuyordu. */
    '  <circle cx="27" cy="12.5" r="3.2" fill="' + RENK.murekkep + '"/>\n' +
    '  <circle cx="37" cy="12.5" r="3.2" fill="' + RENK.murekkep + '"/>\n' +
    '  <g fill="none" stroke-width="8.5">\n' +
    y.map(function (k) { return '    <path d="' + k.d + '" stroke="' + RENK[k.ad] + '"/>\n'; }).join("") +
    "  </g>\n</svg>\n";
}

/* Favicon sembolü: favikon.py'nin 24x24 kutusunda (translate 4 3), kabın
   kâğıt rengiyle; noktalar sıfır uzunluklu yuvarlak uçlu çizgi. */
function faviconSembol() {
  var y = yaylar(12, 15.2, 7);
  return '<path d="M9.6 3h0" stroke-width="3"/>' +
    '<path d="M14.4 3h0" stroke-width="3"/>' +
    '<g stroke-width="3.6" stroke-linecap="butt">' + y.map(function (k) { return '<path d="' + k.d + '"/>'; }).join("") + "</g>";
}

function main() {
  var hedef = path.join(KOK, "logo.svg"), yeni = logo();
  /* favicon.svg favikon.py'den üretilir (favikon.py --check o bağı tutar); burada motora bağlanır. */
  var fav = fs.readFileSync(path.join(KOK, "favicon.svg"), "utf8");
  var sembol = faviconSembol();
  if (process.argv.indexOf("--sembol") !== -1) { console.log(sembol); return 0; }
  if (process.argv.indexOf("--check") !== -1) {
    var hata = [];
    if (!fs.existsSync(hedef) || fs.readFileSync(hedef, "utf8") !== yeni) hata.push("logo.svg motorla aynı değil");
    if (fav.indexOf(sembol) === -1) hata.push("favicon.svg kök sembolü motorla aynı değil (node tools/marka.js --sembol, tools/favikon.py'ye yapıştır)");
    hata.forEach(function (h) { console.error("  " + h); });
    if (hata.length) { console.log("Düzeltmek için: node tools/marka.js, sonra python tools/favikon.py ve python tools/ikon.py"); return 1; }
    var p = paylar();
    console.log("Marka işareti motorla aynı (" + YIL + " asgari ücret: net %" + (p.net * 100).toFixed(1) + ").");
    return 0;
  }
  fs.writeFileSync(hedef, yeni, "utf8");
  console.log("logo.svg yazıldı. Favicon sembolü için: node tools/marka.js --sembol");
  return 0;
}

process.exit(main());
