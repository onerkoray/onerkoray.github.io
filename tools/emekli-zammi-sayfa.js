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

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "emekli-zammi-hesaplama", "index.html");
var HARITA = path.join(KOK, "sitemap.xml");
var ADRES = "https://korayoner.dev/emekli-zammi-hesaplama/";
var Z = require(path.join(KOK, "finans", "emekli-zammi-motoru.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));

var ORNEK_AYLIK = 25000;          // formun açılış örneğiyle aynı
var SENARYO_ORANLARI = [0.01, 0.015, 0.02, 0.025, 0.03];
var GECMIS_ILK_YIL = 2016;
var BAYATLIK_GUN = 10;
var BASLIK_EKI = " | Koray Öner";
/* Sitenin başlık sınırı 60 karakter (tools/sayfa-denetimi.py). Dönem adı
   "Ocak"tan "Temmuz"a geçince başlık iki karakter uzuyor; sınır EN UZUN
   dönem adıyla denetleniyor ki Temmuz'da sessizce aşılmasın. */
var BASLIK_SINIRI = 60;

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function yuzde(o) { return "%" + nf2.format(Math.round(o * 10000) / 100); }
function yuzdeKisa(o) {
  var v = Math.round(o * 1000) / 10;
  return "%" + (v === Math.round(v) ? String(v) : String(v).replace(".", ","));
}
/* Sayıdan sonra gelen ek sayıya göre değişir ("2'si", "3'ü"); eki sabit
   yazmak sayı değişince yanlış Türkçe üretir. Kelimeyle yazılıyor. */
var KACI = { 1: "biri", 2: "ikisi", 3: "üçü", 4: "dördü", 5: "beşi" };

function tl(n) { return nf0.format(Math.round(n)) + " TL"; }
function kacis(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* TÜİK bir ayın TÜFE'sini izleyen ayın 3'ünde açıklar; 3'ü hafta sonuna
   denk gelirse ilk iş gününe kayar (3 Ekim 2026 cumartesi → 5 Ekim).
   Resmî tatiller hesaba katılmıyor; metin bu yüzden "bekleniyor" diyor. */
function aciklamaTarihi(yil, ay) {
  var ay2 = ay === 12 ? 1 : ay + 1, yil2 = ay === 12 ? yil + 1 : yil;
  var d = new Date(Date.UTC(yil2, ay2 - 1, 3));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 86400000);
  return d;
}

/* Seride olmayan ilk ay ve açıklanması beklenen tarih. */
function sonrakiAciklama(sonAy) {
  var p = sonAy.split("-"), y = +p[0], a = +p[1];
  var ay = a === 12 ? 1 : a + 1, yil = a === 12 ? y + 1 : y;
  return { ay: ay, yil: yil, tarih: aciklamaTarihi(yil, ay) };
}
function uzunTarih(d) {
  return d.getUTCDate() + " " + Z.AY_ADLARI[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

function aralik(d, bas, bit) {
  var a = d.aylar[bas], b = d.aylar[bit];
  var adA = Z.AY_ADLARI[a.ay - 1], adB = Z.AY_ADLARI[b.ay - 1];
  if (bas === bit) return adA + " " + a.yil;
  return adA + "–" + adB + " " + b.yil;
}

function durum() {
  var s = Z.siradaki();
  var d = Z.donem(s.zamYili, s.zamAyi);
  var sa = sonrakiAciklama(T.sonAy);
  return { d: d, sonraki: sa };
}

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
    "  <title>" + kacis(baslik) + BASLIK_EKI + "</title>",
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

function aylarBlok(x) {
  var d = x.d;
  var satir = [], k = 1;
  d.aylar.forEach(function (a, i) {
    var ay = a.ad;
    if (a.oran === null) {
      satir.push('              <tr class="bekliyor"><th scope="row">' + ay + "</th><td>—</td><td>—</td><td>" +
        uzunTarih(aciklamaTarihi(a.yil, a.ay)) + " (beklenen)</td></tr>");
    } else {
      k *= 1 + a.oran;
      satir.push('              <tr><th scope="row">' + ay + "</th><td>" + yuzde(a.oran) +
        "</td><td>" + yuzde(k - 1) + "</td><td>Açıklandı</td></tr>");
    }
  });
  return [
    "<!-- EZ-AYLAR:BASLANGIC -->",
    '          <div class="table-scroll">',
    '            <table class="veri-tablo">',
    "              <caption>" + d.ad + " zammının dayandığı altı ay</caption>",
    "              <thead>",
    '                <tr><th scope="col">Ay</th><th scope="col">Aylık TÜFE</th><th scope="col">Birikim</th><th scope="col">Durum</th></tr>',
    "              </thead>",
    "              <tbody>",
    satir.join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>",
    "          <!-- EZ-AYLAR:BITIS -->"
  ].join("\n");
}

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

function sitemapTazele() {
  var s = fs.readFileSync(HARITA, "utf8");
  var bugun = new Date().toISOString().slice(0, 10);
  var desen = new RegExp("(<loc>" + ADRES.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") +
    "</loc>\\s*<lastmod>)[^<]+(</lastmod>)");
  if (!desen.test(s)) { console.error("sitemap.xml'de " + ADRES + " yok."); return false; }
  var yeni = s.replace(desen, "$1" + bugun + "$2");
  if (yeni !== s) { fs.writeFileSync(HARITA, yeni, "utf8"); console.log("sitemap lastmod → " + bugun); }
  return true;
}

function main() {
  var enUzun = "Temmuz 2099 Emekli Zammı Hesaplama" + BASLIK_EKI;
  if (enUzun.length > BASLIK_SINIRI) {
    console.error("Başlık en uzun dönemde " + enUzun.length + " karakter (sınır " + BASLIK_SINIRI + ").");
    return 1;
  }
  var kontrol = process.argv.indexOf("--check") !== -1;
  var harita = process.argv.indexOf("--sitemap") !== -1;
  var x = durum();
  var s = fs.readFileSync(SAYFA, "utf8");
  var degisen = [];

  BLOKLAR.forEach(function (b) {
    var bas = "<!-- " + b.ad + ":BASLANGIC -->", bit = "<!-- " + b.ad + ":BITIS -->";
    var i = s.indexOf(bas), j = s.indexOf(bit);
    if (i < 0 || j < 0 || s.indexOf(bas, i + 1) >= 0) {
      throw new Error("Sayfada blok işareti eksik ya da yinelenmiş: " + b.ad);
    }
    var mevcut = s.slice(i, j + bit.length), yeni = b.uret(x);
    if (mevcut !== yeni) { degisen.push(b.ad); s = s.slice(0, i) + yeni + s.slice(j + bit.length); }
  });

  if (kontrol) {
    var hata = 0;
    if (degisen.length) {
      console.error("Emekli zammı sayfası güncel değil (" + degisen.join(", ") +
        ") — 'node tools/emekli-zammi-sayfa.js' çalıştırın.");
      hata = 1;
    }
    var sinir = new Date(x.sonraki.tarih.getTime() + BAYATLIK_GUN * 86400000);
    if (new Date() > sinir) {
      console.error("TÜFE serisi BAYAT: " + Z.AY_ADLARI[x.sonraki.ay - 1] + " " + x.sonraki.yil +
        " verisi " + uzunTarih(x.sonraki.tarih) + " tarihinde açıklanmalıydı, seri hâlâ " + T.sonAy +
        ". Gece hattını (tools/tufe-guncelle.py) kontrol edin.");
      hata = 1;
    }
    if (!hata) {
      console.log("Emekli zammı sayfası güncel: " + x.d.ad + ", " + x.d.aciklananSayisi +
        "/6 ay, birikim " + yuzde(x.d.birikim) + "; seri " + T.sonAy + ".");
    }
    return hata;
  }
  if (!degisen.length) { console.log("Emekli zammı sayfası zaten güncel."); return 0; }
  fs.writeFileSync(SAYFA, s, "utf8");
  console.log("Emekli zammı sayfası yazıldı: " + degisen.join(", "));
  if (harita && !sitemapTazele()) return 1;
  return 0;
}

process.exit(main());
