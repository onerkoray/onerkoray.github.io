#!/usr/bin/env node
/*!
 * Memur zammı sayfasının statik bloklarını TÜFE serisi ve toplu sözleşme
 * oranlarından üretir. Ortak kısım (takvim, biçim, bayatlık, sitemap)
 * tools/zam-sayfa-ortak.js'te; emekli sayfasıyla aynı kalıp.
 *
 * "EN AZ" CÜMLESİ TEK FORMÜLDEN
 *   Hero'daki alt sınır, açıklanan birikimle hesaplanan memur zammıdır.
 *   Birikim önceki dönemin toplu sözleşme oranının altındayken bu, yeni
 *   dönemin oranına eşittir (Ocak 2027: %5). Birikim oranı aştığı anda
 *   kendiliğinden yükselir; metinde ayrı bir dal yok.
 *
 * Toplu sözleşme oranı olmayan bir döneme gelindiğinde (Ocak 2028; 9. dönem
 * 2027'de belirlenecek) motor açık bir hatayla durur ve --check kırmızıya
 * döner: finans/toplu-sozlesme.js güncellenmelidir.
 *
 *   node tools/memur-zammi-sayfa.js              # yaz
 *   node tools/memur-zammi-sayfa.js --sitemap    # yaz; değiştiyse lastmod'u bugüne çek (gece)
 *   node tools/memur-zammi-sayfa.js --check      # güncel ve taze mi (CI)
 */
"use strict";

var path = require("path");
var O = require("./zam-sayfa-ortak.js");
var Z = O.Z;
var yuzde = O.yuzde, yuzdeKisa = O.yuzdeKisa, tl = O.tl, kacis = O.kacis, KACI = O.KACI;
var uzunTarih = O.uzunTarih, aralik = O.aralik;

var SAYFA = path.join(O.KOK, "memur-zammi-hesaplama", "index.html");
var ADRES = "https://korayoner.dev/memur-zammi-hesaplama/";

var ORNEK_MAAS = 60000;           // formun açılış örneğiyle aynı
var SENARYO_ORANLARI = [0.01, 0.015, 0.02, 0.025, 0.03];
var GECMIS_ILK_YIL = 2025;        // toplu sözleşme oranı kayıtlı ilk hesaplanabilir dönem

function yariAdi(y) { return y.yil + (y.yari === 1 ? " ilk yarısı" : " ikinci yarısı"); }

function hesap(d) {
  var m = Z.memurZammi(d.birikim, d.zamYili, d.zamAyi);
  var y = Z.memurYarilari(d.zamYili, d.zamAyi);
  return { m: m, y: y, esik: d.kesin ? null : Z.farkEsigi(d) };
}

function basBlok(x) {
  var d = x.d, h = hesap(d);
  var baslik = d.ad + " Memur Zammı Hesaplama";
  var paylasim = baslik + " — Memur ve Memur Emeklisi";
  var aciklama, og;
  if (d.kesin) {
    aciklama = d.ad + " memur ve memur emeklisi zammı kesinleşti: " + yuzde(h.m.toplam) +
      " (enflasyon farkı " + yuzde(h.m.fark) + " + toplu sözleşme " + yuzde(h.m.tsYeni) + ").";
    og = d.ad + " memur zammı " + yuzde(h.m.toplam) + ". Toplu sözleşme ve enflasyon farkı, açıklanan veriden.";
  } else {
    aciklama = d.ad + " memur ve memur emeklisi zammı en az " + yuzde(h.m.toplam) + ". " +
      aralik(d, 0, d.aciklananSayisi - 1) + " enflasyonu " + yuzde(d.birikim) +
      "; senaryolar, enflasyon farkı eşiği ve maaşınızın yeni tutarı.";
    og = "Kesinleşen alt sınır " + yuzde(h.m.toplam) + ". Enflasyon farkı açıklanan TÜFE'ye bağlı; " +
      "tahmin değil, açıkça işaretli senaryolar.";
  }
  return [
    "<!-- MZ-BAS:BASLANGIC -->",
    "  <title>" + kacis(baslik) + O.BASLIK_EKI + "</title>",
    '  <meta name="description" content="' + kacis(aciklama) + '">',
    '  <meta property="og:title" content="' + kacis(paylasim) + '">',
    '  <meta property="og:description" content="' + kacis(og) + '">',
    '  <meta property="og:image:alt" content="' + kacis(paylasim) + '">',
    '  <meta name="twitter:title" content="' + kacis(paylasim) + '">',
    '  <meta name="twitter:description" content="' + kacis(og) + '">',
    "  <!-- MZ-BAS:BITIS -->"
  ].join("\n");
}

function heroBlok(x) {
  var d = x.d, sa = x.sonraki, h = hesap(d);
  var govde;
  if (d.kesin) {
    govde = "<strong>" + d.ad + " memur zammı kesinleşti: " + yuzde(h.m.toplam) + ".</strong> " +
      aralik(d, 0, 5) + " enflasyonu " + yuzde(d.birikim) + "; " + yariAdi(h.y.onceki) +
      " toplu sözleşme oranı " + yuzde(h.m.tsOnceki) + ". Enflasyon farkı " + yuzde(h.m.fark) +
      ", " + yariAdi(h.y.yeni) + " toplu sözleşme oranı " + yuzde(h.m.tsYeni) + ".";
  } else {
    // Sayıdan sonra ek gelmeyen kalıplar: "%3,23 üzerinde", "%7,00 oranını aşarsa".
    var farkCumlesi = h.esik > 0
      ? "Farkın doğması için kalan " + d.eksikSayisi + " ayda birikimli " + yuzde(h.esik) +
        " üzerinde enflasyon gerekiyor."
      : "Açıklanan aylar toplu sözleşme oranını zaten aştı; enflasyon farkı doğdu ve kalan aylarla büyüyecek.";
    govde = "<strong>" + d.ad + " memur zammı en az " + yuzde(h.m.toplam) + ".</strong> " +
      yariAdi(h.y.yeni) + " için toplu sözleşme oranı " + yuzde(h.m.tsYeni) +
      " ve zam bundan düşük olamaz. Üstüne enflasyon farkı gelip gelmeyeceği " + aralik(d, 0, 5) +
      " enflasyonuna bağlı: altı aylık TÜFE " + yuzde(h.m.tsOnceki) + " oranını aşarsa fark eklenir. " +
      "Şu ana kadar altı aydan " + KACI[d.aciklananSayisi] + " açıklandı, birikim " + yuzde(d.birikim) +
      ". " + farkCumlesi + " " + Z.AY_ADLARI[sa.ay - 1] + " verisinin " + uzunTarih(sa.tarih) +
      " tarihinde açıklanması bekleniyor.";
  }
  return [
    "<!-- MZ-HERO:BASLANGIC -->",
    "        <h1>" + d.ad + " memur zammı hesaplama</h1>",
    '        <p class="lede">' + govde + "</p>",
    "        <!-- MZ-HERO:BITIS -->"
  ].join("\n");
}

function aylarBlok(x) { return O.aylarTablosu("MZ-AYLAR", x.d); }

function senaryoBlok(x) {
  var d = x.d;
  if (d.kesin) {
    return [
      "<!-- MZ-SENARYO:BASLANGIC -->",
      '          <p class="muted-note">' + d.ad + " zammı kesinleşti; altı ayın hepsi açıklandı, " +
        "senaryoya gerek yok.</p>",
      "          <!-- MZ-SENARYO:BITIS -->"
    ].join("\n");
  }
  var gy = Z.gecenYilAyniAylar(d);
  var gyAdi = Z.AY_ADLARI[d.aylar[d.aciklananSayisi].ay - 1] + "–" + Z.AY_ADLARI[d.aylar[5].ay - 1] + " " +
    (d.aylar[5].yil - 1);
  var satirlar = [];
  function ekle(ad, tufe, sinif) {
    var m = Z.memurZammi(tufe, d.zamYili, d.zamAyi);
    satirlar.push("              <tr" + (sinif ? ' class="' + sinif + '"' : "") + '><th scope="row">' + ad +
      "</th><td>" + yuzde(tufe) + "</td><td>" + yuzde(m.fark) + "</td><td>" + yuzde(m.toplam) +
      "</td><td>" + tl(ORNEK_MAAS * (1 + m.toplam)) + "</td></tr>");
  }
  ekle("Kalan aylarda aylık enflasyon sıfır olsa", Z.senaryo(d, 0), "alt-sinir");
  ekle("Geçen yılın aynı ayları tekrarlansa (" + gyAdi + ")", Z.senaryo(d, gy), "gecen-yil");
  SENARYO_ORANLARI.forEach(function (o) { ekle("Kalan her ay " + yuzdeKisa(o), Z.senaryo(d, o)); });
  return [
    "<!-- MZ-SENARYO:BASLANGIC -->",
    '          <div class="table-scroll">',
    '            <table class="veri-tablo">',
    "              <caption>" + aralik(d, d.aciklananSayisi, 5) + " için senaryolar — " + tl(ORNEK_MAAS) +
      " maaşa etkisi</caption>",
    "              <thead>",
    '                <tr><th scope="col">Kalan ' + d.eksikSayisi + ' ay için varsayım</th><th scope="col">Altı aylık TÜFE</th>' +
      '<th scope="col">Enflasyon farkı</th><th scope="col">' + d.ad + ' zammı</th><th scope="col">' +
      tl(ORNEK_MAAS) + " olur</th></tr>",
    "              </thead>",
    "              <tbody>",
    satirlar.join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>",
    "          <!-- MZ-SENARYO:BITIS -->"
  ].join("\n");
}

function gecmisBlok() {
  var satir = [];
  Z.gecmis(GECMIS_ILK_YIL).forEach(function (g) {
    var m;
    try { m = Z.memurZammi(g.oran, g.zamYili, g.zamAyi); } catch (e) { return; }
    satir.push('              <tr><th scope="row">' + g.ad + "</th><td>" + yuzde(g.oran) + "</td><td>" +
      yuzde(m.tsOnceki) + "</td><td>" + yuzde(m.fark) + "</td><td>" + yuzde(m.tsYeni) + "</td><td>" +
      yuzde(m.toplam) + "</td></tr>");
  });
  return [
    "<!-- MZ-GECMIS:BASLANGIC -->",
    '          <div class="table-scroll">',
    '            <table class="veri-tablo">',
    "              <caption>Memur ve memur emeklisi zammı, dönem dönem</caption>",
    "              <thead>",
    '                <tr><th scope="col">Zam dönemi</th><th scope="col">Altı aylık TÜFE</th>' +
      '<th scope="col">Önceki toplu sözleşme</th><th scope="col">Enflasyon farkı</th>' +
      '<th scope="col">Yeni toplu sözleşme</th><th scope="col">Zam</th></tr>',
    "              </thead>",
    "              <tbody>",
    satir.join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>",
    "          <!-- MZ-GECMIS:BITIS -->"
  ].join("\n");
}

process.exit(O.calistir({
  ad: "Memur zammı sayfası",
  sayfa: SAYFA,
  adres: ADRES,
  komut: "node tools/memur-zammi-sayfa.js",
  enUzunBaslik: "Temmuz 2099 Memur Zammı Hesaplama",
  bloklar: [
    { ad: "MZ-BAS", uret: basBlok },
    { ad: "MZ-HERO", uret: heroBlok },
    { ad: "MZ-AYLAR", uret: aylarBlok },
    { ad: "MZ-SENARYO", uret: senaryoBlok },
    { ad: "MZ-GECMIS", uret: gecmisBlok }
  ],
  ozet: function (x) {
    var h = hesap(x.d);
    return x.d.ad + ", " + x.d.aciklananSayisi + "/6 ay, alt sınır " + yuzde(h.m.toplam);
  }
}));
