#!/usr/bin/env node
/*!
 * Emekli zammı sayfasının statik bloklarını TÜFE serisinden üretir.
 *
 * NEDEN STATİK
 * ------------
 * Sayfanın cevabı bir sayı ("Ocak 2027 zammı için birikim şu an %3,65").
 * O sayı yalnızca JS ile çizilseydi arama motoru ve paylaşım kartı onu
 * göremezdi. Başlık, açıklama, hero ve üç tablo HTML'e yazılıyor; araç
 * kısmı aynı motoru tarayıcıda çalıştırıyor. İkisi aynı seriden türüyor.
 *
 * DÖNEM KENDİLİĞİNDEN İLERLER
 * ---------------------------
 * Aralık verisi gelince Ocak zammı "kesinleşti" olur; Ocak verisi gelince
 * sayfa Temmuz zammına geçer. Başlık dahil hiçbir yer elle değişmez.
 *
 * BAYATLIK
 * --------
 * TÜİK TÜFE'yi her ayın 3'ünde açıklar. Seri, beklenen açıklamadan 10 gün
 * sonra hâlâ eski ayda duruyorsa --check KIRMIZI döner: gece hattı
 * (tools/tufe-guncelle.py) sessizce kırılmış demektir ve sayfa yanlış
 * bir "şu an" söylüyordur.
 *
 *   node tools/emekli-zammi-sayfa.js              # yaz
 *   node tools/emekli-zammi-sayfa.js --sitemap    # yaz; değiştiyse lastmod'u bugüne çek (gece)
 *   node tools/emekli-zammi-sayfa.js --check      # güncel ve taze mi (CI)
 */
"use strict";

var path = require("path");
var O = require("./zam-sayfa-ortak.js");
var Z = O.Z;
var yuzde = O.yuzde, yuzdeKisa = O.yuzdeKisa, tl = O.tl, kacis = O.kacis, KACI = O.KACI;
var uzunTarih = O.uzunTarih, aralik = O.aralik;

var SAYFA = path.join(O.KOK, "emekli-zammi-hesaplama", "index.html");
var ADRES = "https://korayoner.dev/emekli-zammi-hesaplama/";

var ORNEK_AYLIK = 25000;          // formun açılış örneğiyle aynı
var SENARYO_ORANLARI = [0.01, 0.015, 0.02, 0.025, 0.03];
var GECMIS_ILK_YIL = 2016;

/* ------------------------------------------------------------ bloklar -- */
function basBlok(x) {
  var d = x.d;
  var baslik = d.ad + " Emekli Zammı Hesaplama";
  var paylasimBasligi = baslik + " — SSK ve Bağ-Kur";
  var aciklama, ogAciklama;
  if (d.kesin) {
    aciklama = d.ad + " SSK ve Bağ-Kur zammı kesinleşti: " + yuzde(d.birikim) +
      ". " + aralik(d, 0, 5) + " TÜFE değişimi; aylığınızın yeni tutarını hesaplayın.";
    ogAciklama = d.ad + " emekli zammı " + yuzde(d.birikim) + ". Hesap, açıklanmış TÜFE verisinden.";
  } else {
    aciklama = d.ad + " SSK ve Bağ-Kur zammı için " + aralik(d, 0, d.aciklananSayisi - 1) +
      " enflasyonu açıklandı: birikim " + yuzde(d.birikim) + ". Kalan " + d.eksikSayisi +
      " ay için senaryolar ve aylığınızın yeni tutarı.";
    ogAciklama = "Şu ana kadar kesinleşen: " + yuzde(d.birikim) + " (" + d.aciklananSayisi +
      "/6 ay). Tahmin değil; açıklanan TÜFE ve açıkça işaretli senaryolar.";
  }
  return [
    "<!-- EZ-BAS:BASLANGIC -->",
    "  <title>" + kacis(baslik) + O.BASLIK_EKI + "</title>",
    '  <meta name="description" content="' + kacis(aciklama) + '">',
    '  <meta property="og:title" content="' + kacis(paylasimBasligi) + '">',
    '  <meta property="og:description" content="' + kacis(ogAciklama) + '">',
    '  <meta property="og:image:alt" content="' + kacis(paylasimBasligi) + '">',
    '  <meta name="twitter:title" content="' + kacis(paylasimBasligi) + '">',
    '  <meta name="twitter:description" content="' + kacis(ogAciklama) + '">',
    "  <!-- EZ-BAS:BITIS -->"
  ].join("\n");
}

function heroBlok(x) {
  var d = x.d, sa = x.sonraki;
  var govde;
  if (d.kesin) {
    govde = "<strong>" + d.ad + " zammı kesinleşti: " + yuzde(d.birikim) + ".</strong> " +
      aralik(d, 0, 5) + " TÜFE değişimi. 5510 sayılı Kanun'un 55. maddesine göre SSK ve " +
      "Bağ-Kur aylıkları bu oranda artar; " + tl(ORNEK_AYLIK) + " aylık " +
      tl(Z.yeniAylik(ORNEK_AYLIK, d.birikim)) + " olur.";
  } else {
    govde = "<strong>" + d.ad + " zammı için altı aydan " + KACI[d.aciklananSayisi] +
      " açıklandı: " + aralik(d, 0, d.aciklananSayisi - 1) + " birikimi " +
      yuzde(d.birikim) + ".</strong> Bu kısım kesinleşti; kalan aylarda aylık enflasyon " +
      "eksiye dönmedikçe zam bundan düşük olmaz. " +
      Z.AY_ADLARI[sa.ay - 1] + " verisinin " + uzunTarih(sa.tarih) + " tarihinde açıklanması bekleniyor. " +
      "Kalan " + d.eksikSayisi + " ay için tahmin değil, varsayımı açıkça yazılmış senaryolar var.";
  }
  return [
    "<!-- EZ-HERO:BASLANGIC -->",
    "        <h1>" + d.ad + " emekli zammı hesaplama</h1>",
    '        <p class="lede">' + govde + "</p>",
    "        <!-- EZ-HERO:BITIS -->"
  ].join("\n");
}

function aylarBlok(x) { return O.aylarTablosu("EZ-AYLAR", x.d); }

function senaryoBlok(x) {
  var d = x.d;
  if (d.kesin) {
    return [
      "<!-- EZ-SENARYO:BASLANGIC -->",
      '          <p class="muted-note">' + d.ad + " zammı kesinleşti; altı ayın hepsi açıklandı, " +
        "senaryoya gerek yok.</p>",
      "          <!-- EZ-SENARYO:BITIS -->"
    ].join("\n");
  }
  var eksikAdi = aralik(d, d.aciklananSayisi, 5);
  var gy = Z.gecenYilAyniAylar(d);
  var gyAdi = Z.AY_ADLARI[d.aylar[d.aciklananSayisi].ay - 1] + "–" + Z.AY_ADLARI[d.aylar[5].ay - 1] + " " +
    (d.aylar[5].yil - 1);
  var satirlar = [];
  function ekle(ad, oran, sinif) {
    satirlar.push("              <tr" + (sinif ? ' class="' + sinif + '"' : "") + '><th scope="row">' + ad +
      "</th><td>" + yuzde(oran) + "</td><td>" + tl(Z.yeniAylik(ORNEK_AYLIK, oran)) + "</td></tr>");
  }
  ekle("Kalan aylarda aylık enflasyon sıfır olsa", Z.senaryo(d, 0), "alt-sinir");
  ekle("Geçen yılın aynı ayları tekrarlansa (" + gyAdi + ")", Z.senaryo(d, gy), "gecen-yil");
  SENARYO_ORANLARI.forEach(function (o) {
    ekle("Kalan her ay " + yuzdeKisa(o), Z.senaryo(d, o));
  });
  return [
    "<!-- EZ-SENARYO:BASLANGIC -->",
    '          <div class="table-scroll">',
    '            <table class="veri-tablo">',
    "              <caption>" + eksikAdi + " için senaryolar — " + tl(ORNEK_AYLIK) + " aylığa etkisi</caption>",
    "              <thead>",
    '                <tr><th scope="col">Kalan ' + d.eksikSayisi + ' ay için varsayım</th><th scope="col">' +
      d.ad + ' zammı</th><th scope="col">' + tl(ORNEK_AYLIK) + " aylık olur</th></tr>",
    "              </thead>",
    "              <tbody>",
    satirlar.join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>",
    "          <!-- EZ-SENARYO:BITIS -->"
  ].join("\n");
}

function gecmisBlok() {
  var g = Z.gecmis(GECMIS_ILK_YIL);
  var satir = g.map(function (x) {
    return '              <tr><th scope="row">' + x.ad + "</th><td>" + yuzde(x.oran) + "</td></tr>";
  });
  return [
    "<!-- EZ-GECMIS:BASLANGIC -->",
    '          <div class="table-scroll">',
    '            <table class="veri-tablo">',
    "              <caption>Ocak " + GECMIS_ILK_YIL + "’dan bu yana altı aylık TÜFE farkı (5510 m.55)</caption>",
    "              <thead>",
    '                <tr><th scope="col">Zam dönemi</th><th scope="col">TÜFE farkı</th></tr>',
    "              </thead>",
    "              <tbody>",
    satir.join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>",
    "          <!-- EZ-GECMIS:BITIS -->"
  ].join("\n");
}

var BLOKLAR = [
  { ad: "EZ-BAS", uret: basBlok },
  { ad: "EZ-HERO", uret: heroBlok },
  { ad: "EZ-AYLAR", uret: aylarBlok },
  { ad: "EZ-SENARYO", uret: senaryoBlok },
  { ad: "EZ-GECMIS", uret: gecmisBlok }
];

process.exit(O.calistir({
  ad: "Emekli zammı sayfası",
  sayfa: SAYFA,
  adres: ADRES,
  komut: "node tools/emekli-zammi-sayfa.js",
  enUzunBaslik: "Temmuz 2099 Emekli Zammı Hesaplama",
  bloklar: BLOKLAR,
  ozet: function (x) {
    return x.d.ad + ", " + x.d.aciklananSayisi + "/6 ay, birikim " + yuzde(x.d.birikim);
  }
}));
