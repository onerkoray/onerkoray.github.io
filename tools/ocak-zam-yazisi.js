#!/usr/bin/env node
/*
 * Ocak 2027 emekli ve memur zammı yazılarının gövdesi.
 * Her oran makaleler/ocak-2027-emekli-zammi/ocak.js üzerinden sitenin zam
 * motorundan ve gece güncellenen TÜFE serisinden gelir. Yeni TÜFE açıklanınca
 * gövde değişir; --check CI'da bunu yakalar.
 *
 * Kullanım:
 *   node tools/ocak-zam-yazisi.js           # yaz
 *   node tools/ocak-zam-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var O = require(path.join(KOK, "makaleler", "ocak-2027-emekli-zammi", "ocak.js"));
var ORTAK = require(path.join(KOK, "tools", "zam-sayfa-ortak.js"));
var S = require(path.join(KOK, "finans", "toplu-sozlesme.js"));
var Z = O.Z;

function y2(v) { return "%" + (Math.round(v * 10000) / 100).toFixed(2).replace(".", ","); }
function puan(v) { return (Math.round(v * 10000) / 100).toFixed(2).replace(".", ",") + " puan"; }
function tl(v) { return Math.round(v).toLocaleString("tr-TR") + " TL"; }
function tarih(d) { return ORTAK.uzunTarih(d); }
/* Bulunma eki yılın okunuşuna göre: 2026'da, 2027'de, 2023'te. */
function tarihte(d) {
  var y = d.getUTCFullYear() % 10;
  return tarih(d) + ({ 0: "'da", 1: "'de", 2: "'de", 3: "'te", 4: "'te", 5: "'te", 6: "'da", 7: "'de", 8: "'de", 9: "'da" })[y];
}

var d = O.donem();
var bilinen = d.aylar.filter(function (a) { return a.oran != null; });
var eksik = d.aylar.filter(function (a) { return a.oran == null; });
var sen = O.senaryolar(), duy = O.duyarlilik();
var aralikEmekli = [Math.min.apply(null, sen.map(function (s) { return s.emekli; })), Math.max.apply(null, sen.map(function (s) { return s.emekli; }))];
var aralikMemur = [Math.min.apply(null, sen.map(function (s) { return s.memur; })), Math.max.apply(null, sen.map(function (s) { return s.memur; }))];
var sonAciklama = ORTAK.aciklamaTarihi(2026, 12);
var takvim = eksik.map(function (a) { return { ad: a.ad, tarih: ORTAK.aciklamaTarihi(a.yil, a.ay) }; });
var TS_ONCEKI = S.oranlar["2026-2"], TS_YENI = S.oranlar["2027-1"];
var CARPAN = (1 + TS_YENI) / (1 + TS_ONCEKI);

function tablo(baslik, basliklar, satirlar) {
  return '<div class="table-scroll"><table class="data-table">\n<caption>' + baslik + "</caption>\n<thead><tr>" +
    basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + b + "</th>"; }).join("") + "</tr></thead>\n<tbody>\n" +
    satirlar.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return i ? '<td class="num">' + c + "</td>" : '<th scope="row">' + c + "</th>"; }).join("") + "</tr>";
    }).join("\n") + "\n</tbody></table></div>";
}

function bilinenTablo() {
  var b = 0;
  return tablo("Açıklanan aylar: Temmuz–Eylül 2026 TÜFE", ["Ay", "Aylık", "Birikim"],
    bilinen.map(function (a) { b = (1 + b) * (1 + a.oran) - 1; return [a.ad, y2(a.oran), y2(b)]; }));
}

function takvimMetni() {
  return takvim.map(function (t) { return t.ad + " verisi " + tarih(t.tarih); }).join(", ");
}

/* ------------------------------------------------ emekli */

function emekliGovde() {
  var gecen = Z.gecenYilAyniAylar(d, O.T);
  var adim = duy[2].emekli - duy[1].emekli;
  var ornekler = [20000, 30000, 40000];
  var h = [];
  h.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Ocak 2027'de SSK ve Bağ-Kur aylıklarına yapılacak zam, Temmuz–Aralık 2026 enflasyonuna eşit</strong> (5510 sayılı Kanun m.55). " +
    "Altı ayın üçü açıklandı: " + bilinen.map(function (a) { return a.ad.split(" ")[0] + " " + y2(a.oran); }).join(", ") +
    "; birikim <strong>" + y2(d.birikim) + "</strong>. Bu kısım kesin; kalan üç ayda fiyatlar düşmedikçe zam bunun altına inmez.</p>\n" +
    "<p>Kalan üç ay için TÜİK serisinden ve resmî tahminden kurulan üç senaryo zammı <strong>" + y2(aralikEmekli[0]) + " ile " + y2(aralikEmekli[1]) +
    "</strong> arasına koyuyor. Kesin oran " + tarihte(sonAciklama) + ", Aralık TÜFE'siyle belli olacak.</p>\n</div>");
  h.push('<h2 id="kesin">Kesin olan: üç ay</h2>\n<p>Zam, aylık oranların toplamı değil bileşiği: her ay bir öncekinin üstüne eklenir. ' +
    "Temmuz–Eylül'ün bileşiği " + y2(d.birikim) + ".</p>\n" + bilinenTablo());
  h.push('<h2 id="senaryolar">Kalan üç ay için üç senaryo</h2>\n<p>Bunlar tahmin değil, varsayımı açık hesaplar. İkisi doğrudan TÜİK serisinden: ' +
    "son üç ayın hızının sürmesi ve geçen yılın aynı aylarının (" + gecen.map(y2).join(", ") + ") tekrarlanması. Üçüncüsü hükümetin Orta Vadeli " +
    "Program'daki 2026 yıl sonu tahmini (" + y2(O.OVP_YIL_SONU) + "): ilk yarının " + y2(O.ilkYari()) + "'lik birikimi düşülünce ikinci yarıya ne kaldığını gösterir.</p>\n" +
    tablo("Ocak 2027 SSK ve Bağ-Kur zammı, üç senaryo", ["Senaryo", "Ekim–Aralık aylık ortalama", "Ocak zammı"],
      sen.map(function (s) { return [s.ad, y2(s.kalanAylik), "<strong>" + y2(s.emekli) + "</strong>"]; })) +
    "\n<p>OVP senaryosunun Ekim–Aralık için ima ettiği aylık hız (" + y2(sen[2].kalanAylik) + "), son üç ayın hızının (" + y2(sen[0].kalanAylik) + ") epey altında. " +
    "Yıl sonu tahmini tutacaksa son çeyrekte fiyat artışının belirgin biçimde yavaşlaması gerekiyor.</p>");
  h.push('<h2 id="duyarlilik">Her yarım puan ne değiştirir?</h2>\n<p>Kalan üç ayın aylık ortalaması yarım puan değişince zam yaklaşık <strong>' + puan(adim) + "</strong> değişiyor.</p>\n" +
    tablo("Kalan üç ay her ay aynı oranda artarsa", ["Ekim–Aralık her ay", "Ocak zammı"],
      duy.map(function (s, i) { return [y2(O.DUYARLILIK[i]), y2(s.emekli)]; })));
  h.push('<h2 id="aylik">Aylığınıza etkisi</h2>\n<p>Zam bugünkü aylığın üstüne ilan edilen oranla eklenir. Örnek aylıklarla:</p>\n' +
    tablo("Ocak 2027'de yeni aylık", ["Bugünkü aylık"].concat(sen.map(function (s) { return s.ad; })),
      ornekler.map(function (a) { return [tl(a)].concat(sen.map(function (s) { return tl(Z.yeniAylik(a, s.emekli)); })); })) +
    '\n<p>En düşük aylığı alanlar için tablo farklı: taban tutar kanunla belirlenir ve Ocak zammı tabandakine kendiliğinden yansımaz. Ayrıntısı ' +
    '<a href="../en-dusuk-emekli-ayligi-ocak-2027/">Ocak 2027 zammı en düşük emekli aylığına yansır mı?</a> yazısında.</p>');
  h.push('<h2 id="takvim">Ne zaman belli olacak?</h2>\n<p>TÜİK kalan ayları şu günlerde açıklayacak: ' + takvimMetni() +
    ". Son açıklamayla zam kesinleşir; sitedeki <a href=\"../../emekli-zammi-hesaplama/\">emekli zammı aracı</a> her açıklamanın ertesi günü kendiliğinden güncellenir.</p>");
  return h.join("\n\n");
}

/* ------------------------------------------------ memur */

function memurGovde() {
  var esik = O.farkEsigi();
  var ornekler = [60000, 80000, 100000];
  var ovp = sen[2];
  var h = [];
  h.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Memur ve memur emeklilerinin Ocak 2027 zammı iki parçalı:</strong> toplu sözleşmedeki " + y2(TS_YENI) + " ile 2026'nın ikinci yarısına ait " +
    "enflasyon farkı. Fark, Temmuz–Aralık enflasyonunun toplu sözleşmedeki " + y2(TS_ONCEKI) + "'yi aşan kısmı.</p>\n" +
    "<p>Temmuz–Eylül'de " + y2(d.birikim) + " birikti. Farkın doğması için kalan üç ayda toplam <strong>" + y2(esik) + "</strong> artış yetiyor; fark neredeyse kesin. " +
    "Üç senaryoda memur zammı <strong>" + y2(aralikMemur[0]) + " ile " + y2(aralikMemur[1]) + "</strong> arasında; her senaryoda SSK ve Bağ-Kur zammının yaklaşık iki puan altında.</p>\n</div>");
  h.push("<h2 id=\"formul\">Zam nasıl hesaplanıyor?</h2>\n<p>Toplu sözleşme 2026'nın ikinci yarısı için " + y2(TS_ONCEKI) + ", 2027'nin ilk yarısı için " + y2(TS_YENI) +
    " artış öngörüyor. Altı aylık enflasyon " + y2(TS_ONCEKI) + "'yi aşarsa aşan kısım Ocak'ta fark olarak eklenir:</p>\n" +
    "<ul><li>fark = (1 + Temmuz–Aralık enflasyonu) ÷ (1 + " + y2(TS_ONCEKI) + ") − 1</li><li>zam = (1 + fark) × (1 + " + y2(TS_YENI) + ") − 1</li></ul>\n" +
    "<p>Örnek: Orta Vadeli Program'ın yıl sonu tahmini tutarsa altı aylık enflasyon " + y2(ovp.emekli) + " olur; fark " + y2(ovp.fark) +
    ", zam " + y2(ovp.memur) + ". Fark iki ondalıkla ilan edilir ve öyle uygulanır.</p>");
  h.push('<h2 id="fark">Fark neredeyse kesin</h2>\n<p>Temmuz–Eylül birikimi (' + y2(d.birikim) + ") henüz " + y2(TS_ONCEKI) + "'nin altında. Aradaki boşluk, kalan üç ayda toplam " +
    y2(esik) + "; ayda ortalama " + y2(Math.pow(1 + esik, 1 / 3) - 1) + ". Son üç ayın aylık ortalaması " + y2(O.sonUcAyHizi(d)) + "; bu hız sürerse eşik daha Ekim'de aşılır.</p>");
  h.push('<h2 id="senaryolar">Üç senaryo: memur ve emekli yan yana</h2>\n' +
    tablo("Ocak 2027 zammı, üç senaryo", ["Senaryo", "Temmuz–Aralık enflasyonu", "Enflasyon farkı", "Memur zammı", "SSK ve Bağ-Kur zammı", "Aradaki fark"],
      sen.map(function (s) { return [s.ad, y2(s.emekli), y2(s.fark), "<strong>" + y2(s.memur) + "</strong>", y2(s.emekli), puan(s.emekli - s.memur)]; })) +
    "\n<p>Neden hep geride? Memur zammı, aynı altı aylık enflasyonun (1 + " + y2(TS_YENI) + ") ÷ (1 + " + y2(TS_ONCEKI) + ") = " +
    CARPAN.toFixed(4).replace(".", ",") + " katı: toplu sözleşmenin Ocak oranı bir önceki yarının oranından iki puan düşük. " +
    "Emekli zammında böyle bir indirim yok; o doğrudan altı aylık enflasyona eşit.</p>");
  h.push('<h2 id="duyarlilik">Ekim–Aralık sabit hızla giderse</h2>\n' +
    tablo("Ekim–Aralık aylık oranına göre memur zammı", ["Ekim–Aralık her ay", "Memur zammı", "SSK ve Bağ-Kur zammı"],
      duy.map(function (s, i) { return [y2(O.DUYARLILIK[i]), y2(s.memur), y2(s.emekli)]; })));
  h.push('<h2 id="maas">Maaşınıza etkisi</h2>\n<p>Memur maaşı kadroya, dereceye ve ek göstergeye göre değişir; oran ise herkes için aynı. Örnek maaşlarla:</p>\n' +
    tablo("Ocak 2027'de yeni maaş", ["Bugünkü maaş"].concat(sen.map(function (s) { return s.ad; })),
      ornekler.map(function (a) { return [tl(a)].concat(sen.map(function (s) { return tl(Z.yeniAylik(a, s.memur)); })); })) +
    "\n<p>Aynı oran 4/c kapsamındaki memur emeklilerinin aylığına da uygulanır.</p>");
  h.push('<h2 id="takvim">Fark hangi gün kesinleşir?</h2>\n<p>Farkı belirleyecek üç rakam kaldı. ' +
    takvim.map(function (t) { return tarihte(t.tarih) + " " + t.ad.split(" ")[0] + " oranı"; }).join(", ") +
    " yayımlanacak. Son rakamla fark ve zam kesinleşir; sitedeki <a href=\"../../memur-zammi-hesaplama/\">memur zammı aracı</a> her açıklamanın ertesi günü kendiliğinden güncellenir.</p>");
  return h.join("\n\n");
}

var HEDEFLER = [
  ["ocak-2027-emekli-zammi", emekliGovde],
  ["ocak-2027-memur-zammi", memurGovde]
];

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0, bayat = [];
  var bas = "<!-- OCAK-GOVDE:BASLANGIC -->", bit = "<!-- OCAK-GOVDE:BITIS -->";
  HEDEFLER.forEach(function (h) {
    var p = path.join(KOK, "makaleler", h[0], "index.html");
    var s = fs.readFileSync(p, "utf8"), i = s.indexOf(bas), j = s.indexOf(bit);
    if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + h[0]);
    var yeni = s.slice(0, i + bas.length) + "\n" + h[1]() + "\n" + s.slice(j);
    if (yeni !== s) { bayat.push(h[0]); if (!kontrol) fs.writeFileSync(p, yeni, "utf8"); }
  });
  if (kontrol) {
    if (bayat.length) { console.log("Ocak zammı yazıları güncel değil: " + bayat.join(", ") + " — node tools/ocak-zam-yazisi.js"); return 1; }
    console.log("Ocak zammı yazıları güncel.");
    return 0;
  }
  console.log(bayat.length ? bayat.join(", ") + " güncellendi." : "Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { emekliGovde: emekliGovde, memurGovde: memurGovde };
