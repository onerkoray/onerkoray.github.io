#!/usr/bin/env node
/*!
 * Kira artışı sayfasını TÜFE serisinden üretir: başlık, açıklama, oranlar,
 * örnek hesap, aylık oran tablosu, grafik, örnek kira geçmişi ve S.S.S.
 *
 * NEDEN: oran her ay değişir. Elle yazılmış "Eylül 2026 oranı" ilk yeni
 * veride yanlış olurdu. Gece hattı (veri-guncelle.yml) --sitemap ile yazar,
 * CI --check ile sayfanın seriyle aynı olduğunu doğrular. Seri, beklenen
 * açıklamadan 10 gün sonra hâlâ eskiyse --check kırmızı.
 *
 *   node tools/kira-sayfa.js            # yaz
 *   node tools/kira-sayfa.js --check    # CI
 *   node tools/kira-sayfa.js --sitemap  # yaz, değiştiyse lastmod'u bugüne çek
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "kira-artisi-hesaplama", "index.html");
var M = require(path.join(KOK, "finans", "kira-motoru.js"));
var K = require(path.join(KOK, "finans", "kira-tufe.js"));
var Ortak = require(path.join(__dirname, "zam-sayfa-ortak.js"));

var G = require(path.join(KOK, "kira-artisi-hesaplama", "gorunum.js"));

var ADRES = "https://korayoner.dev/kira-artisi-hesaplama/";
var BAYATLIK_GUN = 10;
var TABLO_ILK = "2022-01";

var sayi = G.sayi, yuzde = G.yuzde, tarihUzun = G.tarihUzun, ayDa = G.ayDa, kacis = G.kacis;

function degerler() {
  var d = M.durum();
  var ornek = M.yeniKira(20000, { tarih: d.sonYenilemeAyi + "-01", tur: "konut", sozlesme: null });
  return {
    d: d,
    alan: {
      sonYenilemeAyi: M.ayAdi(d.sonYenilemeAyi),
      sonYenilemeAyiDa: ayDa(d.sonYenilemeAyi), sonYenilemeAyiDa2: ayDa(d.sonYenilemeAyi),
      sonOran: sayi(d.sonOran, 2), sonOran2: sayi(d.sonOran, 2), sonOran3: sayi(d.sonOran, 2),
      sonAciklama: tarihUzun(d.sonAciklama),
      sonVeriAyi: M.ayAdi(d.sonVeriAyi),
      sonrakiYenilemeAyi: M.ayAdi(d.sonrakiYenilemeAyi),
      sonrakiYenilemeAyiDa: ayDa(d.sonrakiYenilemeAyi),
      sonrakiVeriAyi: M.ayAdi(d.sonrakiVeriAyi),
      sonrakiAciklama: tarihUzun(d.sonrakiAciklama), sonrakiAciklama2: tarihUzun(d.sonrakiAciklama),
      ornekCarpan: sayi(1 + d.sonOran / 100, 4),
      ornekYeni: sayi(ornek.yeniKira), ornekFark: sayi(ornek.fark), ornekYillik: sayi(ornek.yillikFark)
    }
  };
}

/* ---- tablo -------------------------------------------------------------- */
function tablo(d) {
  var satir = [];
  satir.push('                <tr class="kira-bekleyen"><th scope="row">' + M.ayAdi(d.sonrakiYenilemeAyi) + "</th><td>" +
    M.ayAdi(d.sonrakiVeriAyi) + "</td><td>" + tarihUzun(d.sonrakiAciklama) + " (beklenen)</td><td class=\"sayi\">—</td><td class=\"sayi\">—</td></tr>");
  M.tablo(TABLO_ILK).forEach(function (r) {
    var konut = yuzde(r.tufe);
    if (r.yenilemeAyi === "2022-06") konut = "%25 <small>(11 Haziran'dan)</small><br><small>öncesi " + yuzde(r.tufe) + "</small>";
    else if (r.konutSinirli && r.tufe > M.SINIR25.oran) konut = "%25 <small>(sınır)</small>";
    satir.push("                <tr><th scope=\"row\">" + M.ayAdi(r.yenilemeAyi) + "</th><td>" + M.ayAdi(r.veriAyi) + "</td><td>" +
      tarihUzun(r.aciklama) + "</td><td class=\"sayi\">" + konut + "</td><td class=\"sayi\">" + yuzde(r.tufe) + "</td></tr>");
  });
  return [
    "",
    '        <div class="table-scroll kira-tablo-kap">',
    '          <table class="veri-tablo kira-tablo">',
    "            <caption>Yenileme ayına göre yasal azami kira artış oranı, " + G.ayDan(TABLO_ILK) + " bugüne</caption>",
    '            <thead><tr><th scope="col">Yenileme ayı</th><th scope="col">Veri ayı</th><th scope="col">Açıklama</th><th scope="col" class="sayi">Konut</th><th scope="col" class="sayi">Çatılı iş yeri</th></tr></thead>',
    "            <tbody>",
    satir.join("\n"),
    "            </tbody>",
    "          </table>",
    "        </div>",
    "        "
  ].join("\n");
}

/* ---- S.S.S. -------------------------------------------------------------- */
function sss(d) {
  return [
    [M.ayAdi(d.sonYenilemeAyi) + " kira artış oranı ne kadar?",
      ayDa(d.sonYenilemeAyi) + " yenilenen konut ve çatılı iş yeri kiralarında yasal azami artış %" + sayi(d.sonOran, 2) +
      ". Oran, TÜİK'in " + tarihUzun(d.sonAciklama) + " tarihinde açıkladığı " + M.ayAdi(d.sonVeriAyi) +
      " TÜFE'sinin 12 aylık ortalamalara göre değişimidir (TBK m.344)."],
    [M.ayAdi(d.sonrakiYenilemeAyi) + " kira artış oranı ne zaman açıklanacak?",
      ayDa(d.sonrakiYenilemeAyi) + " yenilenen kiralara uygulanacak oran, " + M.ayAdi(d.sonrakiVeriAyi) +
      " enflasyon verisiyle birlikte " + tarihUzun(d.sonrakiAciklama) + " tarihinde TÜİK tarafından açıklanacak. Bu sayfa aynı gün güncellenir."],
    ["Kira artışında %25 sınırı hâlâ geçerli mi?",
      "Hayır. Konut kiralarındaki %25 sınırı 11 Haziran 2022 – 30 Haziran 2024 arasında yenilenen sözleşmelerde uygulandı (7409 ve 7456 sayılı Kanunlar). 1 Temmuz 2024'ten bu yana tek sınır 12 aylık TÜFE ortalamasıdır."],
    ["İş yeri kirasında artış sınırı var mı?",
      "Evet. Çatılı iş yeri kiralarında da artış 12 aylık TÜFE ortalamasını aşamaz (TBK m.344). %25 sınırı iş yerlerinde hiç uygulanmadı."],
    ["Ev sahibi TÜFE'nin üzerinde zam isteyebilir mi?",
      "Hayır. Sözleşmede daha yüksek bir oran yazsa bile artış yasal tavana iner; fazla ödenen kira geri istenebilir. Sözleşmedeki oran daha düşükse düşük oran uygulanır."],
    ["Beş yıl dolunca ne değişir?",
      "Beş yıldan uzun süren kira ilişkisinde, beşinci yılın sonundan itibaren yeni dönemin kirası hakim tarafından emsal kiralara ve hakkaniyete göre, TÜFE ile sınırlı kalmadan belirlenebilir (TBK m.344/3). Bu hesap mahkemeye kalır; araç yalnızca tarihi gösterir."],
    ["Depozito da kira artışıyla artar mı?",
      "Hayır. Güvence bedeli sözleşme başında belirlenir ve yıllık kira artışıyla kendiliğinden yükselmez."]
  ];
}
function sssHtml(liste) {
  return "\n" + liste.map(function (q) {
    return "          <details><summary>" + kacis(q[0]) + "</summary><p>" + kacis(q[1]) + "</p></details>";
  }).join("\n") + "\n";
}
function sssLd(liste) {
  var veri = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: liste.map(function (q) {
    return { "@type": "Question", name: q[0], acceptedAnswer: { "@type": "Answer", text: q[1] } };
  }) };
  return '<script type="application/ld+json">' + JSON.stringify(veri) + "</script>";
}

/* ---- sayfa ---------------------------------------------------------------- */
function blok(s, ad, icerik, degisen) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0 || s.indexOf(bas, i + 1) >= 0) throw new Error("Blok işareti eksik ya da yinelenmiş: " + ad);
  var yeni = bas + icerik + bit;
  if (s.slice(i, j + bit.length) !== yeni) degisen.push(ad);
  return s.slice(0, i) + yeni + s.slice(j + bit.length);
}
function yerDegistir(s, kalip, yeni, ad, degisen) {
  if (!kalip.test(s)) throw new Error("Sayfada bulunamadı: " + ad);
  var t = s.replace(kalip, yeni);
  if (t !== s) degisen.push(ad);
  return t;
}

function uret(s) {
  var v = degerler(), d = v.d, degisen = [];
  var eksik = [];
  s = s.replace(/<span data-k="([A-Za-z0-9]+)">([^<]*)<\/span>/g, function (tum, k) {
    if (!(k in v.alan)) { eksik.push(k); return tum; }
    var yeni = '<span data-k="' + k + '">' + v.alan[k] + "</span>";
    if (yeni !== tum) degisen.push("rakam:" + k);
    return yeni;
  });
  if (eksik.length) throw new Error("Üretecin bilmediği alan: " + eksik.join(", "));

  var baslik = "Kira Artışı Hesaplama — " + M.ayAdi(d.sonYenilemeAyi) + ": %" + sayi(d.sonOran, 2);
  var aciklama = ayDa(d.sonYenilemeAyi) + " yenilenen kiralarda yasal azami artış %" + sayi(d.sonOran, 2) +
    ". Yeni kiranızı, sözleşmeden bugüne yasal kiranızı ve 2022'den beri her ayın oranını görün.";
  s = yerDegistir(s, /<title>[^<]*<\/title>/, "<title>" + baslik + " | Koray Öner</title>", "title", degisen);
  s = yerDegistir(s, /(<meta name="description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "description", degisen);
  s = yerDegistir(s, /(<meta property="og:title" content=")[^"]*(")/, "$1" + kacis(baslik) + "$2", "og:title", degisen);
  s = yerDegistir(s, /(<meta property="og:description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "og:description", degisen);
  s = yerDegistir(s, /(<meta name="twitter:title" content=")[^"]*(")/, "$1" + kacis(baslik) + "$2", "twitter:title", degisen);
  s = yerDegistir(s, /(<meta name="twitter:description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "twitter:description", degisen);
  s = yerDegistir(s, /("dateModified": ")[^"]*(")/, "$1" + d.sonAciklama + "$2", "dateModified", degisen);
  s = yerDegistir(s, /(<input type="date" id="in-date" value=")[^"]*(")/, "$1" + d.sonYenilemeAyi + "-01$2", "in-date", degisen);

  var liste = sss(d);
  s = blok(s, "KIRA-TABLO", tablo(d), degisen);
  s = blok(s, "KIRA-GRAFIK", G.grafikHtml(), degisen);
  s = blok(s, "KIRA-SSS", sssHtml(liste), degisen);
  s = blok(s, "KIRA-SSS-LD", sssLd(liste), degisen);
  var o = G.ORNEK_GECMIS;
  var g = M.gecmis({ baslangic: o.baslangic, kira: o.kira, tur: o.tur, sozlesme: o.sozlesme, bugun: d.sonAciklama });
  s = blok(s, "KIRA-GECMIS-ORNEK", G.gecmisHtml(g), degisen);
  return { s: s, degisen: degisen, d: d, baslik: baslik, aciklama: aciklama };
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var harita = process.argv.indexOf("--sitemap") !== -1;
  var eski = fs.readFileSync(SAYFA, "utf8");
  var r = uret(eski);
  if ((r.baslik + " | Koray Öner").length > 60) { console.error("Başlık 60 karakteri aşıyor: " + r.baslik); return 1; }
  if (r.aciklama.length > 165) { console.error("Açıklama 165 karakteri aşıyor (" + r.aciklama.length + ")."); return 1; }
  if (kontrol) {
    var hata = 0;
    if (r.s !== eski) {
      console.error("Kira sayfası seriden farklı (" + r.degisen.slice(0, 6).join(", ") + ") — 'node tools/kira-sayfa.js' çalıştırın.");
      hata = 1;
    }
    var sinir = new Date(Date.parse(r.d.sonrakiAciklama + "T00:00:00Z") + BAYATLIK_GUN * 86400000);
    if (new Date() > sinir) {
      console.error("Kira oranları BAYAT: " + M.ayAdi(r.d.sonrakiVeriAyi) + " verisi " + tarihUzun(r.d.sonrakiAciklama) +
        " tarihinde açıklanmalıydı; seri hâlâ " + K.sonAy + ". Gece hattını (tools/grafik-verisi.py) kontrol edin.");
      hata = 1;
    }
    if (!hata) console.log("Kira sayfası güncel: " + M.ayAdi(r.d.sonYenilemeAyi) + " %" + sayi(r.d.sonOran, 2) + ".");
    return hata;
  }
  if (r.s === eski) { console.log("Kira sayfası zaten güncel."); return 0; }
  fs.writeFileSync(SAYFA, r.s, "utf8");
  console.log("Kira sayfası yazıldı: " + r.degisen.length + " alan.");
  if (harita && !Ortak.sitemapTazele(ADRES)) return 1;
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { uret: uret };
