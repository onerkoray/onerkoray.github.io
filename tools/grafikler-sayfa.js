#!/usr/bin/env node
/*!
 * Grafikler sayfasını seriden üretir: metindeki her rakam, statik SVG'ler ve
 * veri tabloları grafikler/hesap.js'ten gelir.
 *
 * NEDEN STATİK SVG
 * ----------------
 * Grafik tarayıcıda da çizilebilirdi; ama o zaman JS'siz okur, arama motoru
 * ve ilk boyama boş bir kutu görürdü. Üreteç aynı çizim modülüyle
 * (grafikler/cizim.js) grafiği sayfaya yazar; tarayıcı yalnızca ekran
 * genişliğinde yeniden çizer ve etkileşim ekler.
 *
 * NEDEN ÜRETEÇ
 * ------------
 * TÜFE ve kur serisi her iş günü uzar (veri-guncelle.yml). Rakamları elle
 * yazılmış bir sayfa ilk yeni veride yanlış olurdu. --check CI'da sayfanın
 * seriyle aynı olduğunu doğrular; gece hattı --sitemap ile yazar.
 *
 * Kullanım:
 *   node tools/grafikler-sayfa.js            # yaz
 *   node tools/grafikler-sayfa.js --check    # sayfa seriden üretilmiş mi (CI)
 *   node tools/grafikler-sayfa.js --sitemap  # yaz, değiştiyse lastmod'u bugüne çek
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "grafikler", "index.html");
var H = require(path.join(KOK, "grafikler", "hesap.js"));
var Cizim = require(path.join(KOK, "grafikler", "cizim.js"));
var Tanim = require(path.join(KOK, "grafikler", "tanimlar.js"));
var Ortak = require(path.join(__dirname, "zam-sayfa-ortak.js"));

var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var G = require(path.join(KOK, "finans", "grafik-verisi.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
var SAYI_YAZI = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on",
  "on bir", "on iki"];
var SIRA_YAZI = ["", "birinci", "ikinci", "üçüncü", "dördüncü", "beşinci", "altıncı", "yedinci",
  "sekizinci", "dokuzuncu", "onuncu"];

/* Genişlikler: tek sütun grafik 1000 px, yan yana ikili 540 px. Tarayıcı
   zaten kutu genişliğinde yeniden çizer; bu, ilk boyamanın ölçeği. */
var GENISLIK = { fiyat: 1000, enflasyon: 1000, faiz: 540, reel: 540, kur: 540, reelKur: 540,
  asgari: 1000, dunya: 540, dunyaSeri: 540 };
var ZAMAN_VARSAYILAN = "2015-01";

var sayi = Cizim.sayi;
function ayUzun(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }

/* Sayının okunuşundaki son kelime, ekin ünlüsünü ve sertliğini belirler:
   2022 → "iki" → 'de, 2024 → "dört" → 'te, 2026 → "altı" → 'da. */
function sonKelime(n) {
  var BIR = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
  var ON = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
  if (n % 10) return BIR[n % 10];
  if (n % 100) return ON[(n % 100) / 10];
  if (n % 1000) return "yüz";
  return "bin";
}
function bulunma(n) {
  var k = sonKelime(n);
  var unlu = (k.match(/[aıoueiöü]/g) || []).pop();
  var kalin = "aıou".indexOf(unlu) >= 0;
  var sert = /[çfhkpsşt]$/.test(k);
  return "'" + (sert ? "t" : "d") + (kalin ? "a" : "e");
}
function ayDa(ay) { return ayUzun(ay) + bulunma(+ay.slice(0, 4)); }
function uzunTarih(iso) {
  var p = iso.split("-");
  return +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0];
}

/* ---- metindeki rakamlar ------------------------------------------------- */
function sayilar(r) {
  var o = r.ozet;
  var katlar = r.katlar;
  var enUzun = o.enUzunNegatif;
  return {
    sonYil: r.sonAy.slice(0, 4),
    sonAyUzun: ayUzun(r.sonAy),
    sonAyDa: ayDa(r.sonAy),
    fiyatKat: sayi(o.fiyatKat, 1),
    sepet: sayi(o.fiyatKat * 100),
    katSayisiYazi: SAYI_YAZI[o.katSayisi],
    ilkKatSure: String(o.ilkKatlanma.sure),
    sonKatSure: String(o.sonKatlanma.sure),

    sonTufe: sayi(o.sonTufe, 2),
    tepeTufe: sayi(o.tepeTufe.deger, 2),
    tepeAy: ayUzun(o.tepeTufe.ay),
    bantAy: String(o.bantAy),
    bantIci: String(o.bantIci),
    tepe2018: sayi(o.tepe2018.deger, 2),

    faiz: sayi(o.faiz, o.faiz % 1 ? 2 : 0),
    faizTarih: uzunTarih(o.faizTarih),
    faizIlkAyDa: ayDa(r.faiz[0].ay),
    faizAySayisi: String(o.faizAySayisi),
    negatifAy: String(o.negatifAy),
    dipAy: ayUzun(o.reelFaizDip.ay),
    dipFaiz: sayi(o.reelFaizDip.faiz, o.reelFaizDip.faiz % 1 ? 2 : 0),
    dipTufe: sayi(o.reelFaizDip.tufe, 2),
    dipReel: sayi(-o.reelFaizDip.deger, 1),
    enUzunAy: String(enUzun.ay),
    enUzunAralik: ayUzun(enUzun.bas) + " – " + ayUzun(enUzun.son),
    reelSonYazi: (o.reelSon < 0 ? "−%" : "%") + sayi(Math.abs(o.reelSon), 1),

    usdSon: sayi(o.usdSon, 2),
    usdKat: sayi(o.usdKat, 1),
    tufeKatKur: sayi(o.tufeKatKur, 1),
    reelKurMinAyDa: ayDa(reelKurUc(r, -1).ay),
    reelKurMaxAyDa: ayDa(reelKurUc(r, 1).ay),
    reelKurSon: sayi(reelKurSon(r), 1),

    usdDipAyDa: ayDa(o.usdDip.ay),
    usdDip: sayi(o.usdDip.usd),
    usdTepeAyDa: ayDa(o.usdTepe.ay),
    usdTepe: sayi(o.usdTepe.usd),
    asgariSonUsd: sayi(o.asgariSon.usd),
    asgariSonNet: sayi(o.asgariSon.net, 2),
    donemBasAy: ayUzun(o.donemBas.ay),
    donemErime: sayi(100 * o.donemErime, 1),
    reelTepeAy: ayUzun(o.reelTepe.ay),
    reelTepe: sayi(o.reelTepe.reel),

    dunyaYil: o.dunyaYil,
    turSiraYazi: SIRA_YAZI[o.turSira],
    turSiraRakam: String(o.turSira),
    turDeger: sayi(o.turDeger, 1),
    birinciAd: o.birinci.ad,
    birinciDeger: sayi(o.birinci.deger, 1),
    ulkeSayisi: String(o.ulkeSayisi),
    ortanca: sayi(o.ortanca, 1)
  };
}

function reelKurDizi(r) {
  return r.kur.map(function (k) { return { ay: k.ay, v: 100 * k.usdEndeks / k.tufeEndeks }; });
}
function reelKurUc(r, yon) {
  return reelKurDizi(r).reduce(function (a, b) { return (b.v - a.v) * yon > 0 ? b : a; });
}
function reelKurSon(r) { var d = reelKurDizi(r); return d[d.length - 1].v; }

var zamanMetni = Tanim.zamanMetni;

/* ---- tablolar ------------------------------------------------------------ */
function tablo(baslik, basliklar, satirlar) {
  return [
    '          <div class="table-scroll">',
    '            <table class="veri-tablo gr-veri-tablo">',
    "              <caption>" + baslik + "</caption>",
    "              <thead><tr>" + basliklar.map(function (b, i) {
      return '<th scope="col"' + (i ? ' class="sayi"' : "") + ">" + b + "</th>";
    }).join("") + "</tr></thead>",
    "              <tbody>",
    satirlar.map(function (s) {
      return "                <tr>" + s.map(function (h, i) {
        return i ? '<td class="sayi">' + h + "</td>" : '<th scope="row">' + h + "</th>";
      }).join("") + "</tr>";
    }).join("\n"),
    "              </tbody>",
    "            </table>",
    "          </div>"
  ].join("\n");
}

function yilSonlari(dizi, sonAy) {
  return dizi.filter(function (n) { return n.ay.slice(5) === "12" || n.ay === sonAy; });
}

function tablolar(r) {
  var son = r.sonAy;
  function yilEtiket(ay) { return ay.slice(5) === "12" ? ay.slice(0, 4) : ayUzun(ay); }
  return {
    fiyat: tablo("Fiyat endeksi ve yıllık TÜFE, yıl sonları", ["Yıl", "Endeks (Aralık 2004 = 100)", "Yıllık TÜFE"],
      yilSonlari(r.fiyat, son).map(function (n) { return [yilEtiket(n.ay), sayi(n.endeks, 1), "%" + sayi(n.yillik, 2)]; })),
    faiz: tablo("Politika faizi, yıllık TÜFE ve reel faiz, yıl sonları", ["Yıl", "Politika faizi", "Yıllık TÜFE", "Reel faiz"],
      yilSonlari(r.faiz, son).map(function (n) {
        return [yilEtiket(n.ay), "%" + sayi(n.faiz, 2), "%" + sayi(n.tufe, 2), (n.reel < 0 ? "−%" : "%") + sayi(Math.abs(n.reel), 1)];
      })),
    kur: tablo("Ay sonu kurlar, yıl sonları", ["Yıl", "Dolar (TL)", "Euro (TL)", "Fiyatlara göre dolar"],
      yilSonlari(r.kur, r.kur[r.kur.length - 1].ay).map(function (n) {
        return [yilEtiket(n.ay), sayi(n.usd, 4), sayi(n.eur, 4), sayi(100 * n.usdEndeks / n.tufeEndeks, 1)];
      })),
    asgari: tablo("Net asgari ücret, dönem başları", ["Dönem", "Brüt (TL)", "Net (TL)", "Dolar karşılığı", ayUzun(son) + " fiyatlarıyla"],
      r.asgari.filter(function (n, i, a) { return !i || n.net !== a[i - 1].net; }).map(function (n) {
        return [ayUzun(n.ay), sayi(n.brut, 2), sayi(n.net, 2), "$" + sayi(n.usd), sayi(n.reel) + " TL"];
      })),
    dunya: tablo("G20'de yıllık ortalama enflasyon, " + r.siralama.yil, ["Ekonomi", "Sıra", "Enflasyon"],
      r.siralama.liste.map(function (u) { return [u.ad, String(u.sira), "%" + sayi(u.deger, 1)]; }))
  };
}

/* ---- sayfayı kur ---------------------------------------------------------- */
function blokDegistir(s, ad, icerik, degisen) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0 || s.indexOf(bas, i + 1) >= 0) throw new Error("Blok işareti eksik ya da yinelenmiş: " + ad);
  var yeni = bas + icerik + bit;
  if (s.slice(i, j + bit.length) !== yeni) degisen.push(ad);
  return s.slice(0, i) + yeni + s.slice(j + bit.length);
}

function uret(s) {
  var r = H.hesapla(T, G, B);
  var degisen = [];
  var deger = sayilar(r);
  var eksik = [];
  s = s.replace(/<span data-s="([A-Za-z0-9]+)"( data-sayac)?>([^<]*)<\/span>/g, function (tum, k, sayac, eski) {
    if (!(k in deger)) { eksik.push(k); return tum; }
    var yeni = '<span data-s="' + k + '"' + (sayac || "") + ">" + deger[k] + "</span>";
    if (yeni !== tum && degisen.indexOf("rakam:" + k) < 0) degisen.push("rakam:" + k);
    return yeni;
  });
  if (eksik.length) throw new Error("Sayfada üretecin bilmediği rakam alanı: " + eksik.join(", "));

  Tanim.adlar.forEach(function (ad) {
    var c = Tanim.ciz(ad, r, GENISLIK[ad]);
    s = blokDegistir(s, "GR:" + ad, c.svg, degisen);
  });
  var t = tablolar(r);
  Object.keys(t).forEach(function (ad) { s = blokDegistir(s, "GRT:" + ad, "\n" + t[ad] + "\n", degisen); });

  var z = H.zamanMakinesi(r, ZAMAN_VARSAYILAN);
  s = blokDegistir(s, "GR-ZAMAN", zamanMetni(z), degisen);
  var sira = r.fiyat.map(function (n) { return n.ay; }).indexOf(ZAMAN_VARSAYILAN);
  s = s.replace(/(<input type="range" id="gr-zaman-secim" min="0" max=")\d+(" value=")\d+(")/,
    "$1" + (r.fiyat.length - 1) + "$2" + sira + "$3");
  return { s: s, degisen: degisen, r: r };
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var harita = process.argv.indexOf("--sitemap") !== -1;
  var eski = fs.readFileSync(SAYFA, "utf8");
  var sonuc = uret(eski);
  var degisti = sonuc.s !== eski;
  if (kontrol) {
    if (degisti) {
      console.error("Grafikler sayfası seriden üretilmiş halinden farklı (" +
        (sonuc.degisen.slice(0, 8).join(", ") || "giriş alanları") + ") — 'node tools/grafikler-sayfa.js' çalıştırın.");
      return 1;
    }
    console.log("Grafikler sayfası güncel: seri " + sonuc.r.sonAy + ", " + Tanim.adlar.length + " grafik.");
    return 0;
  }
  if (!degisti) { console.log("Grafikler sayfası zaten güncel."); return 0; }
  fs.writeFileSync(SAYFA, sonuc.s, "utf8");
  console.log("Grafikler sayfası yazıldı: " + sonuc.degisen.length + " alan.");
  if (harita && !Ortak.sitemapTazele("https://korayoner.dev/grafikler/")) return 1;
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { sayilar: sayilar, bulunma: bulunma, zamanMetni: zamanMetni, uret: uret };
