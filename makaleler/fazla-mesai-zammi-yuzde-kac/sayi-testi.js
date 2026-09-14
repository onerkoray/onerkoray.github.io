#!/usr/bin/env node
/*!
 * Fazla mesai yazısındaki sayıların doğrulaması.
 *
 * NEDEN VAR
 * ---------
 * Yazıdaki her tutar bordro/parametreler.js'teki fazla mesai
 * katsayılarından türüyor. Katsayılar değişirse araç güncellenir, yazı
 * sessizce eskir — ve eskimiş bir yazı bozuk görünmez: tablo yine hizalı
 * durur, yalnızca yanlıştır.
 *
 * Bu test yazıdaki HİÇBİR SAYIYI KENDİ İÇİNDE TAŞIMAZ. Hepsini
 * parametrelerden yeniden hesaplar. Katmanlar tablosu ayrıca HTML'DEN
 * AYRIŞTIRILIR: aynı tutar gövde metninde de geçtiği için "sayfada geçiyor
 * mu" kontrolü tablodaki bozuk hücreyi kaçırırdı — ÖTV yazısında tam
 * bunu yaşadık.
 *
 *   node makaleler/fazla-mesai-zammi-yuzde-kac/sayi-testi.js
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..", "..");
var B = require(path.join(KOK, "bordro", "parametreler.js"));
var P = (B.parametreler || B)["2026"];
var F = P.fazlaMesai;
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var hata = 0, gecen = 0;

function tl(n) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function gecer(ad, deger) {
  var s = typeof deger === "number" ? tl(deger) : String(deger);
  if (HTML.indexOf(s) < 0) {
    hata++; console.error("  BASARISIZ  " + ad + "\n      yazida bulunamadi: " + s);
  } else { gecen++; console.log("  tamam      " + ad + " = " + s); }
}
function esitMetin(ad, bulunan, beklenen) {
  if (String(bulunan) !== String(beklenen)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen \"" + beklenen +
      "\", bulunan \"" + bulunan + "\"");
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (!k) { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
  else { gecen++; console.log("  tamam      " + ad); }
}
function duz(x) {
  return x.replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------- *
 * Örneğin girdileri — yazıdaki senaryo
 * ---------------------------------------------------------------- */
var BRUT = 60000, SOZ = 40, YASAL = 45, CALISILAN = 48;
var saatlik = BRUT / F.aylikSaat;
var s25 = YASAL - SOZ, s50 = CALISILAN - YASAL;
var t25 = saatlik * F.fazlaSureliKat * s25;
var t50 = saatlik * F.fazlaCalismaKat * s50;

console.log("Saat ücreti ve bölen");
esitMetin("bölen 225 (30 gün × 7,5 saat)", F.aylikSaat, 30 * 7.5);
gecer("bölen", String(F.aylikSaat));
gecer("saat ücreti", saatlik);
/* Yazi brut ucreti ondaliksiz yaziyor ("60.000 TL brut"); tutar degil
   girdi oldugu icin dogrusu bu. */
gecer("örnek brüt ücret", BRUT.toLocaleString("tr-TR"));
/* Yazi "240'a bolen bir hesap ~%6,7 eksik oder" diyor. */
var sapma = (1 - (BRUT / 240) / saatlik) * 100;
/* Yuzde TABANI: 240 ile hesaplayanin ne kadar EKSIK odedigi. Ters
   yonu (225'in 240'tan ne kadar yuksek oldugu) baska bir sayidir
   ve yazi once onu yaziyordu. */
gecer("240 ile bölmenin sapması", "%" + sapma.toFixed(2).replace(".", ","));
gecer("240 ile bulunan saat ücreti", BRUT / 240);
dogru("sapma gerçekten eksik yönde", sapma > 0, sapma.toFixed(2));

/* ---------------------------------------------------------------- *
 * İki katmanlı tablo — HTML'DEN AYRIŞTIRILARAK
 * ---------------------------------------------------------------- */
console.log("\nİki katmanlı hafta tablosu (HTML'den ayrıştırılıyor)");
var figBas = HTML.indexOf('class="fm-katman"');
dogru("katmanlar şekli sayfada var", figBas > 0);
var satirlar = (HTML.slice(figBas).match(/<div class="fm-satir[^"]*">[\s\S]*?<\/div>/g) || [])
  .slice(0, 3).map(function (d) {
    return {
      aralik: duz((d.match(/class="fm-aralik">([\s\S]*?)</) || [])[1] || ""),
      oran: duz((d.match(/class="fm-oran[^"]*">([\s\S]*?)</) || [])[1] || ""),
      saat: duz((d.match(/class="fm-saat">([\s\S]*?)</) || [])[1] || ""),
      tutar: duz((d.match(/class="fm-tutar">([\s\S]*?)</) || [])[1] || "")
    };
  });
esitMetin("üç satır (iki katman + toplam)", satirlar.length, 3);

var BEKLENEN = [
  { aralik: SOZ + " – " + YASAL + " saat", oran: "%" + Math.round((F.fazlaSureliKat - 1) * 100),
    saat: s25 + " saat", tutar: tl(t25) + " TL" },
  { aralik: YASAL + " – " + CALISILAN + " saat", oran: "%" + Math.round((F.fazlaCalismaKat - 1) * 100),
    saat: s50 + " saat", tutar: tl(t50) + " TL" },
  { aralik: "Toplam", oran: "",
    saat: (s25 + s50) + " saat", tutar: tl(t25 + t50) + " TL" }
];
BEKLENEN.forEach(function (b, i) {
  var s = satirlar[i];
  if (!s) { hata++; console.error("  BASARISIZ  " + (i + 1) + ". satır yok"); return; }
  var no = (i + 1) + ". satır";
  esitMetin(no + " — aralık", s.aralik, b.aralik);
  esitMetin(no + " — oran", s.oran, b.oran);
  esitMetin(no + " — saat", s.saat, b.saat);
  esitMetin(no + " — tutar", s.tutar, b.tutar);
});
/* Toplam gercekten iki katmanin toplami mi — belgeden okunarak. */
function sayi(x) { return parseFloat(x.replace(/\./g, "").replace(",", ".").replace(" TL", "")); }
if (satirlar.length === 3) {
  dogru("belgedeki toplam, iki katmanın toplamına eşit",
    Math.abs(sayi(satirlar[0].tutar) + sayi(satirlar[1].tutar) - sayi(satirlar[2].tutar)) < 0.01,
    satirlar.map(function (s) { return s.tutar; }).join(" + "));
}

/* ---------------------------------------------------------------- *
 * Yanlış hesapların karşılığı — yazının iddiası
 * ---------------------------------------------------------------- */
console.log("\nYanlış hesaplar ve farkları");
var toplamSaat = s25 + s50;
var hepsi50 = saatlik * F.fazlaCalismaKat * toplamSaat;
var hepsi25 = saatlik * F.fazlaSureliKat * toplamSaat;
var zamsiz = saatlik * toplamSaat;
gecer("hepsi %50 sayılsaydı", hepsi50);
gecer("hepsi %50 farkı", hepsi50 - (t25 + t50));
gecer("hepsi %25 sayılsaydı", hepsi25);
gecer("hepsi %25 farkı", (t25 + t50) - hepsi25);
gecer("zamsız ödenseydi", zamsiz);
gecer("zamsız farkı", (t25 + t50) - zamsiz);
dogru("tek oranlı hesaplar doğru hesabın iki yanında",
  hepsi25 < t25 + t50 && t25 + t50 < hepsi50,
  tl(hepsi25) + " < " + tl(t25 + t50) + " < " + tl(hepsi50));

/* ---------------------------------------------------------------- *
 * Serbest zaman tablosu — iki katsayı
 * ---------------------------------------------------------------- */
console.log("\nSerbest zaman iki katsayılı");
esitMetin("fazla çalışma izni 1,5", F.serbestZamanFazlaCalismaKat, 1.5);
esitMetin("fazla sürelerle izni 1,25", F.serbestZamanFazlaSureliKat, 1.25);
dogru("izin katsayıları ücret katsayılarının aynası",
  F.serbestZamanFazlaCalismaKat === F.fazlaCalismaKat &&
  F.serbestZamanFazlaSureliKat === F.fazlaSureliKat);
gecer("8 saat fazla çalışma karşılığı", String(8 * F.serbestZamanFazlaCalismaKat) + " saat");
gecer("8 saat fazla sürelerle karşılığı", String(8 * F.serbestZamanFazlaSureliKat) + " saat");
gecer("altı aylık pencere", String(F.serbestZamanAyPenceresi));

/* TABLO AYRISTIRILIYOR, varlik kontrolu yetmez: "1 saat 15 dakika"
   ifadesi SSS'te ve dipnotta da geciyor, o yuzden tablodaki hucre
   bozulsa bile "sayfada geciyor mu" kontrolu gecerdi. Mutasyon testi
   bunu yakaladi. */
function saatDakika(kat) {
  var sa = Math.floor(kat), dk = Math.round((kat - sa) * 60);
  return sa + " saat " + dk + " dakika";
}
var szBas = HTML.indexOf("Serbest zaman karşılıkları");
dogru("serbest zaman tablosu sayfada var", szBas > 0);
var szSatir = (HTML.slice(szBas).match(/<tr><th scope="row">[\s\S]*?<\/tr>/g) || [])
  .slice(0, 2).map(function (tr) {
    return {
      ad: duz((tr.match(/<th[^>]*>([\s\S]*?)<\/th>/) || [])[1] || ""),
      hucre: (tr.match(/<td>([\s\S]*?)<\/td>/g) || []).map(duz)
    };
  });
esitMetin("serbest zaman tablosunda iki satır", szSatir.length, 2);
[["Fazla çalışma", F.fazlaCalismaKat, F.serbestZamanFazlaCalismaKat],
 ["Fazla sürelerle çalışma", F.fazlaSureliKat, F.serbestZamanFazlaSureliKat]
].forEach(function (b, i) {
  var sat = szSatir[i];
  if (!sat) { hata++; console.error("  BASARISIZ  serbest zaman " + (i + 1) + ". satır yok"); return; }
  var no = "serbest zaman " + (i + 1) + ". satır";
  esitMetin(no + " — tür", sat.ad, b[0]);
  esitMetin(no + " — ücret zammı", sat.hucre[0], "%" + Math.round((b[1] - 1) * 100));
  esitMetin(no + " — izin", sat.hucre[1], saatDakika(b[2]));
  esitMetin(no + " — 8 saatin karşılığı", sat.hucre[2], (8 * b[2]) + " saat");
});
/* Iki satirin izni AYNI olamaz: kanun ikiye ayirmis. */
if (szSatir.length === 2) {
  dogru("tablodaki iki izin birbirinden farklı",
    szSatir[0].hucre[1] !== szSatir[1].hucre[1],
    szSatir[0].hucre[1] + " vs " + szSatir[1].hucre[1]);
}

/* ---------------------------------------------------------------- *
 * Sınırlar ve kanun kavramları
 * ---------------------------------------------------------------- */
console.log("\nSınırlar ve kanunun kavramları");
gecer("yıllık üst sınır", String(F.yillikUstSinirSaat));
gecer("zam oranı %50", "%" + Math.round((F.fazlaCalismaKat - 1) * 100));
gecer("zam oranı %25", "%" + Math.round((F.fazlaSureliKat - 1) * 100));
[["denkleştirme", "denkleştirme"], ["telafi çalışması", "telafi çalışması"],
 ["gece çalışması", "gece çalışması"], ["m.41", "m.41"], ["m.63", "m.63"],
 ["m.64", "m.64"], ["günde 11 saat", "11 saat"], ["yer altı maden", "37,5"],
 ["yüzde yüz alt sınırı", "yüzde yüzden az olmamak"],
 ["işçinin onayı", "onayının alınması"]].forEach(function (x) {
  dogru(x[0] + " yazıda geçiyor", HTML.indexOf(x[1]) >= 0, x[1]);
});
/* Uc "sayilmayan" durumun ucu de bolum basligi olarak duruyor mu. */
["denklestirme", "telafi", "gece"].forEach(function (id) {
  dogru('"' + id + '" bölümü var', HTML.indexOf('id="' + id + '"') >= 0);
});

console.log("\nİç bağlantılar");
[["fazla mesai aracı", "../../fazla-mesai-hesaplama/"],
 ["kümülatif matrah yazısı", "../maasim-neden-dustu/"],
 ["bordro motoru", "../../bordro/"],
 ["makale listesi", "../"]].forEach(function (x) {
  dogru(x[0] + " bağlantısı var", HTML.indexOf('href="' + x[1] + '"') >= 0, x[1]);
});

if (hata) {
  console.error("\n" + hata + " kontrol basarisiz.");
  console.error("Fazla mesai parametreleri degistiyse yazi da guncellenmeli.");
  process.exit(1);
}
console.log("\n" + gecen + " gecti, 0 kaldi. (fazla mesai yazısı sayıları)");
