/*!
 * Zam sayfası üreteçlerinin ortak parçası (emekli ve memur).
 *
 * İki sayfa aynı TÜFE serisinden, aynı takvimle, aynı blok kalıbıyla
 * üretiliyor. Tarih, biçim, blok yazımı, bayatlık denetimi ve sitemap
 * tazelemesi burada tek kopya: iki üreteçte duran iki kopya zamanla
 * birbirinden ayrışır (site-haritasi.py'nin ilkesi).
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var HARITA = path.join(KOK, "sitemap.xml");
var Z = require(path.join(KOK, "finans", "emekli-zammi-motoru.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));

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

/* Altı ayın tablosu — iki sayfada da aynı; yalnız blok adı değişiyor. */
function aylarTablosu(blokAdi, d) {
  var satir = [], k = 1;
  d.aylar.forEach(function (a) {
    if (a.oran === null) {
      satir.push('              <tr class="bekliyor"><th scope="row">' + a.ad + "</th><td>—</td><td>—</td><td>" +
        uzunTarih(aciklamaTarihi(a.yil, a.ay)) + " (beklenen)</td></tr>");
    } else {
      k *= 1 + a.oran;
      satir.push('              <tr><th scope="row">' + a.ad + "</th><td>" + yuzde(a.oran) +
        "</td><td>" + yuzde(k - 1) + "</td><td>Açıklandı</td></tr>");
    }
  });
  return [
    "<!-- " + blokAdi + ":BASLANGIC -->",
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
    "          <!-- " + blokAdi + ":BITIS -->"
  ].join("\n");
}

function sitemapTazele(adres) {
  var s = fs.readFileSync(HARITA, "utf8");
  var bugun = new Date().toISOString().slice(0, 10);
  var desen = new RegExp("(<loc>" + adres.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") +
    "</loc>\\s*<lastmod>)[^<]+(</lastmod>)");
  if (!desen.test(s)) { console.error("sitemap.xml'de " + adres + " yok."); return false; }
  var yeni = s.replace(desen, "$1" + bugun + "$2");
  if (yeni !== s) { fs.writeFileSync(HARITA, yeni, "utf8"); console.log("sitemap lastmod → " + bugun); }
  return true;
}

/**
 * cfg: { ad, sayfa, adres, komut, enUzunBaslik, bloklar: [{ad, uret(x)}], ozet(x) }
 * Bayraklar: --check (CI), --sitemap (gece).
 */
function calistir(cfg) {
  if ((cfg.enUzunBaslik + BASLIK_EKI).length > BASLIK_SINIRI) {
    console.error(cfg.ad + ": başlık en uzun dönemde " + (cfg.enUzunBaslik + BASLIK_EKI).length +
      " karakter (sınır " + BASLIK_SINIRI + ").");
    return 1;
  }
  var kontrol = process.argv.indexOf("--check") !== -1;
  var harita = process.argv.indexOf("--sitemap") !== -1;
  var x = durum();
  var s = fs.readFileSync(cfg.sayfa, "utf8");
  var degisen = [];

  cfg.bloklar.forEach(function (b) {
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
      console.error(cfg.ad + " güncel değil (" + degisen.join(", ") + ") — '" + cfg.komut + "' çalıştırın.");
      hata = 1;
    }
    var sinir = new Date(x.sonraki.tarih.getTime() + BAYATLIK_GUN * 86400000);
    if (new Date() > sinir) {
      console.error("TÜFE serisi BAYAT: " + Z.AY_ADLARI[x.sonraki.ay - 1] + " " + x.sonraki.yil +
        " verisi " + uzunTarih(x.sonraki.tarih) + " tarihinde açıklanmalıydı, seri hâlâ " + T.sonAy +
        ". Gece hattını (tools/tufe-guncelle.py) kontrol edin.");
      hata = 1;
    }
    if (!hata) console.log(cfg.ad + " güncel: " + cfg.ozet(x) + "; seri " + T.sonAy + ".");
    return hata;
  }
  if (!degisen.length) { console.log(cfg.ad + " zaten güncel."); return 0; }
  fs.writeFileSync(cfg.sayfa, s, "utf8");
  console.log(cfg.ad + " yazıldı: " + degisen.join(", "));
  if (harita && !sitemapTazele(cfg.adres)) return 1;
  return 0;
}

module.exports = {
  KOK: KOK, Z: Z, T: T, BASLIK_EKI: BASLIK_EKI,
  yuzde: yuzde, yuzdeKisa: yuzdeKisa, tl: tl, kacis: kacis, KACI: KACI,
  aciklamaTarihi: aciklamaTarihi, sonrakiAciklama: sonrakiAciklama,
  uzunTarih: uzunTarih, aralik: aralik, durum: durum,
  aylarTablosu: aylarTablosu, calistir: calistir
};
