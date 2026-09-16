#!/usr/bin/env node
/*!
 * "İki işten maaş alan beyanname verir mi?" yazısının üç tablosunu üretir.
 *
 * NEDEN ÜRETİLİYOR
 * ----------------
 * Tabloların tamamı iki şeyden türüyor: bordro/parametreler.js ve kanunun
 * atıf yaptığı dilim SIRASI. Elle yazılsaydı her yeni tarifede sessizce
 * eskirdi — sayfa açılır, tablo hizalı görünür, yalnızca yanlıştır. Bu
 * yazıda risk daha da büyük, çünkü beyan sınırı doğrudan tarifenin ikinci
 * ve dördüncü diliminin tutarı; tarife değişince sınır da değişiyor.
 *
 * ÜÇ TABLO
 * --------
 *   PENCERE       İkinci işin beyanname doğurmadan kalabildiği aylık brüt
 *                 aralığı. Asıl bulgu burada: aralık dar.
 *   UCURUM        Sınırı bir kuruş aşmanın maliyeti. Gelir artışı kuruş,
 *                 vergi artışı beş haneli.
 *   KARSILASTIRMA Aynı toplam brüt, tek işverene karşı iki işveren.
 *
 *   node tools/beyan-tablosu.js           # tabloları yaz
 *   node tools/beyan-tablosu.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var KLASOR = path.join(KOK, "makaleler", "iki-isten-maas-beyanname-siniri");
var SAYFA = path.join(KLASOR, "index.html");
var B = require(path.join(KOK, "bordro", "motor.js"));
var Y = require(path.join(KLASOR, "beyan.js"));

var YIL = B.sonYil();

/* Uçurum tablosundaki örnek birinci işler. Tek amaçları BİRLEŞİK MARJİNAL
   ORANI değiştirmek; tutarların kendisi anlatının parçası değil, o yüzden
   yuvarlak seçildi. Hepsi asgari ücretin üstünde (modülün kapsamı) ve ilki
   asgari ücretin kendisi — tarifeden türüyor, elle yazılmıyor.

   ÜST SINIR VAR: birinci iş büyüdükçe toplam dördüncü dilimi aşıyor ve
   beyan ZATEN zorunlu hale geliyor; orada uçurum diye bir şey kalmıyor.
   Aşağıdaki koruma böyle bir satırı tabloya sokmuyor. */
function birinciIsler() {
  var P = B.parametre(YIL);
  var asgari = (P.donemler || []).reduce(function (e, d) {
    return Math.max(e, d.asgariBrut);
  }, 0);
  return [asgari, 60000, 150000, 250000];
}

/* Karşılaştırma tablosundaki çiftler: ikisi eşiğin altında, ikisi üstünde.
   Eşiğin iki yanı aynı tabloda görünmezse uçurum "anlatılan" bir şey olur,
   "gösterilen" değil. */
var CIFTLER = [[100000, 35000], [100000, 39000], [100000, 45000], [60000, 40000]];

function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function iki(n) { return n.toFixed(2).replace(".", ","); }
function yuzde(o) { return "%" + Math.round(o * 100); }

function blok(ad, satirlar) {
  return ["<!-- " + ad + ":BASLANGIC -->"]
    .concat(satirlar)
    .concat(["<!-- " + ad + ":BITIS -->"]).join("\n");
}

/* ---------------------------------------------------------------- 1 */
function pencereTablosu() {
  var yillar = Y.kapsananYillar().slice().sort(function (a, b) { return a - b; });
  var s = yillar.map(function (y) {
    var p = Y.pencere(y), S = Y.sinirlar(y);
    return "            <tr><th scope=\"row\">" + y + "</th>" +
      "<td>" + tam(p.alt) + "</td>" +
      "<td>" + tam(p.guvenli) + "</td>" +
      "<td>" + iki(p.oran) + "</td>" +
      "<td>" + tam(S.sonrakiIsverenler) + "</td>" +
      "<td>" + tam(S.ucretToplami) + "</td></tr>";
  });
  return blok("BEYAN-PENCERE", [
    "          <table class=\"payroll\">",
    "            <caption>İkinci işin beyanname doğurmadan kalabildiği aralık (aylık brüt, TL)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Yıl</th>",
    "                <th scope=\"col\">Asgari ücret</th>",
    "                <th scope=\"col\">Beyansız kalan en yüksek ikinci iş</th>",
    "                <th scope=\"col\">Asgari ücretin katı</th>",
    "                <th scope=\"col\">Sınır (safi, yıllık)</th>",
    "                <th scope=\"col\">Toplam sınırı (safi, yıllık)</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 2 */
function ucurumTablosu() {
  var s = birinciIsler().map(function (b1) {
    var u = Y.ucurum(b1, YIL);
    if (u.toplamAsti) {
      throw new Error("Uçurum örneği geçersiz: birinci iş " + b1 +
        " TL/ay olunca toplam dördüncü dilimi aşıyor, beyan zaten zorunlu.");
    }
    return "            <tr><th scope=\"row\">" + tam(b1) + "</th>" +
      "<td>" + yuzde(u.marjinalOran) + "</td>" +
      "<td>" + tam(u.borc) + " TL</td>" +
      "<td>" + (u.tekBanda ? "Evet" : "Hayır, iki banda yayılıyor") + "</td></tr>";
  });
  return blok("BEYAN-UCURUM", [
    "          <table class=\"payroll\">",
    "            <caption>Sınırı bir kuruş aşmanın " + YIL + " yılındaki maliyeti</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Birinci işin aylık brütü</th>",
    "                <th scope=\"col\">Birleşik marjinal oran</th>",
    "                <th scope=\"col\">Doğan vergi borcu</th>",
    "                <th scope=\"col\">Formül birebir tutuyor mu?</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ---------------------------------------------------------------- 3 */
function karsilastirmaTablosu() {
  var s = CIFTLER.map(function (c) {
    var d = Y.degerlendir(c, YIL);
    var t = Y.tekIsveren(c[0] + c[1], YIL);
    if (t.sgkTavaniAsiliyor) {
      throw new Error("Karşılaştırma örneği SGK tavanını aşıyor: " + c.join("+") +
        " — fark artık tarifeden değil primden gelir, tablo yanıltır.");
    }
    return "            <tr><th scope=\"row\">" + tam(c[0]) + " + " + tam(c[1]) + "</th>" +
      "<td>" + tam(d.sonrakilerToplami) + "</td>" +
      "<td>" + (d.beyanVar ? "Var" : "Yok") + "</td>" +
      "<td>" + tam(d.kesilen) + "</td>" +
      "<td>" + tam(d.odenecek) + "</td>" +
      "<td>" + tam(d.toplamVergi) + "</td>" +
      "<td>" + tam(t.kesilen) + "</td></tr>";
  });
  return blok("BEYAN-KARSILASTIRMA", [
    "          <table class=\"payroll\">",
    "            <caption>Aynı toplam brüt: iki işveren ve tek işveren (" + YIL + ", TL)</caption>",
    "            <thead>",
    "              <tr>",
    "                <th scope=\"col\">Aylık brütler</th>",
    "                <th scope=\"col\">İkinci işin safi tutarı</th>",
    "                <th scope=\"col\">Beyan</th>",
    "                <th scope=\"col\">Yıl içinde kesilen</th>",
    "                <th scope=\"col\">Beyannamede ödenecek</th>",
    "                <th scope=\"col\">Toplam vergi</th>",
    "                <th scope=\"col\">Tek işverende olsaydı</th>",
    "              </tr>",
    "            </thead>",
    "            <tbody>"
  ].concat(s).concat([
    "            </tbody>",
    "          </table>"
  ]));
}

/* ------------------------------------------------------------------ */
var TABLOLAR = [
  { ad: "BEYAN-PENCERE", uret: pencereTablosu },
  { ad: "BEYAN-UCURUM", uret: ucurumTablosu },
  { ad: "BEYAN-KARSILASTIRMA", uret: karsilastirmaTablosu }
];

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var s = fs.readFileSync(SAYFA, "utf8");
  var degisen = 0;

  for (var k = 0; k < TABLOLAR.length; k++) {
    var t = TABLOLAR[k];
    var bas = "<!-- " + t.ad + ":BASLANGIC -->";
    var bit = "<!-- " + t.ad + ":BITIS -->";
    var i = s.indexOf(bas), j = s.indexOf(bit);
    if (i < 0 || j < 0) {
      console.error("Sayfada tablo işareti yok: " + bas + " / " + bit);
      return 1;
    }
    var mevcut = s.slice(i, j + bit.length);
    var yeni = t.uret();
    if (mevcut !== yeni) {
      degisen++;
      if (!kontrol) s = s.slice(0, i) + yeni + s.slice(j + bit.length);
    }
  }

  if (!degisen) {
    console.log("Beyan tabloları güncel.");
    return 0;
  }
  if (kontrol) {
    console.error(degisen + " beyan tablosu güncel değil — " +
      "'node tools/beyan-tablosu.js' çalıştırın.");
    return 1;
  }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log(degisen + " beyan tablosu yazıldı.");
  return 0;
}

process.exit(main());
