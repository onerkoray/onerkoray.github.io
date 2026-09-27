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
var ANA = path.join(KOK, "index.html");
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
var GENISLIK = { fiyat: 1000, enflasyon: 1000, isi: 1000, faiz: 540, reel: 540, kur: 540, reelKur: 540,
  birikim: 1000, asgari: 1000, vergi: 1000, dunyaEnf: 540, dunyaReel: 540, dunyaSeri: 1000,
  kisiBasi: 540, buyume: 540, issizlik: 540, cari: 540 };
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

/* İyelik (3. tekil) eki: "10 ayın 9'u", "20 yılın 19'u". Ünlüyle biten
   kelimede kaynaştırma s'si: "2'si", "6'sı". */
function unluSinif(k) {
  var u = (k.match(/[aıoueiöü]/g) || []).pop();
  return { a: "ı", "ı": "ı", e: "i", i: "i", o: "u", u: "u", "ö": "ü", "ü": "ü" }[u];
}
function iyelik(n) {
  var k = sonKelime(n), u = unluSinif(k);
  return (/[aıoueiöü]$/.test(k) ? "s" : "") + u;
}
/* İyelik + bulunma: "19'unda", "2'sinde". */
function iyelikBulunma(n) {
  var u = unluSinif(sonKelime(n));
  return iyelik(n) + "n" + ({ "ı": "da", u: "da", i: "de", "ü": "de" }[u]);
}
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

    ocakOrt: sayi(o.ocakOrt, 2),
    digerOrt: sayi(o.digerOrt, 2),
    aylikUstu5: String(o.aylikUstu5),
    aylikUstu5Esik: "Aralık 2021",
    aylikUstu5Sonra: String(o.aylikUstu5Liste.filter(function (a) { return a >= "2021-12"; }).length),
    aylikUstu5Ek: iyelik(o.aylikUstu5Liste.filter(function (a) { return a >= "2021-12"; }).length),
    aylikTepeAy: ayUzun(o.aylikTepe.ay),
    aylikTepe: sayi(o.aylikTepe.deger, 2),

    birikimAltin: sayi(100 * o.altinKat),
    birikimDolar: sayi(100 * o.dolarKatB),
    birikimEuro: sayi(100 * o.euroKat),
    birikimFiyat: sayi(100 * o.fiyatKatB),
    gramIlk: sayi(o.gramIlk, 2),
    gramSon: sayi(o.gramSon),
    onsSon: sayi(o.onsSon),

    vergiIlkYil: String(o.vergiIlk.yil),
    vergiIlkEk: bulunma(o.vergiIlk.yil).slice(1),
    vergiIlkKat: sayi(o.vergiIlk.ikinciKat, 2),
    vergiSonYil: String(o.vergiSon.yil),
    vergiSonEk: bulunma(o.vergiSon.yil).slice(1),
    vergiSonKat: sayi(o.vergiSon.ikinciKat, 2),

    bisEnfAy: ayUzun(o.bisEnfAy),
    bisReelAy: ayUzun(o.bisReelAy),
    bisAlanSayisi: String(o.bisAlanSayisi),
    bisTurSira: String(o.bisTurEnf.sira),
    bisTurSiraYazi: SIRA_YAZI[o.bisTurEnf.sira],
    bisTurEnf: sayi(o.bisTurEnf.deger, 1),
    bisEnfBirinciAd: o.bisEnfBirinci.ad,
    bisEnfBirinci: sayi(o.bisEnfBirinci.deger, 1),
    bisEnfOrtanca: sayi(o.bisEnfOrtanca, 1),
    bisTurReel: sayi(o.bisTurReel.deger, 1),
    bisTurReelSiraYazi: SIRA_YAZI[o.bisTurReel.sira],
    bisReelBirinciAd: o.bisReelBirinci.ad,
    bisReelBirinci: sayi(o.bisReelBirinci.deger, 1),
    bisEskiyenNot: o.bisEskiyen.length
      ? o.bisEskiyen.map(function (e) {
          return e.ad + " reel faiz sıralamasında yok: BIS'teki politika faizi serisi " + ayDa(e.sonAy) + " bitiyor.";
        }).join(" ")
      : "Sıralamada bütün ekonomiler var.",

    kisiBasiSon: sayi(o.kisiBasiSon.tur),
    kisiBasiYil: String(o.kisiBasiSon.yil),
    kisiBasiEk: bulunma(o.kisiBasiSon.yil).slice(1),
    kisiBasiTepeYazi: o.kisiBasiTepe.yil === o.kisiBasiSon.yil ? "en yüksek düzeyi"
      : "zirvesinin altında (" + o.kisiBasiTepe.yil + ": $" + sayi(o.kisiBasiTepe.tur) + ")",
    kisiBasiSira: String(o.kisiBasiSira.sira),
    buyumeAralik: o.buyumeIlkYil + "–" + o.buyumeSonYil,
    buyumeOrt: sayi(o.buyumeOrt, 1),
    daralmaYillari: o.daralmaYillari.length ? o.daralmaYillari.join(", ") : "yok",
    issizlikSon: sayi(o.issizlikSon.tur, 1),
    issizlikOrtanca: sayi(o.issizlikSon.ortanca, 1),
    cariYil: String(o.cariYil),
    cariAcikYil: String(o.cariAcikYil),
    cariAcikEk: iyelikBulunma(o.cariAcikYil),

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
    kur: tablo("Ay sonu kurlar ve gram altın, yıl sonları", ["Yıl", "Dolar (TL)", "Euro (TL)", "Gram altın (TL)", "Fiyatlara göre dolar"],
      yilSonlari(r.kur, r.kur[r.kur.length - 1].ay).map(function (n) {
        var b = r.birikim.filter(function (x) { return x.ay === n.ay; })[0];
        return [yilEtiket(n.ay), sayi(n.usd, 4), sayi(n.eur, 4), b ? sayi(b.gram, 2) : "—", sayi(100 * n.usdEndeks / n.tufeEndeks, 1)];
      })),
    asgari: tablo("Net asgari ücret, dönem başları", ["Dönem", "Brüt (TL)", "Net (TL)", "Dolar karşılığı", ayUzun(son) + " fiyatlarıyla"],
      r.asgari.filter(function (n, i, a) { return !i || n.net !== a[i - 1].net; }).map(function (n) {
        return [ayUzun(n.ay), sayi(n.brut, 2), sayi(n.net, 2), "$" + sayi(n.usd), sayi(n.reel) + " TL"];
      })),
    dunya: tablo("Enflasyon ve reel politika faizi, " + ayUzun(r.dunyaAy.enfAy) + " (BIS)",
      ["Ekonomi", "Yıllık enflasyon", "Politika faizi", "Reel faiz"],
      r.dunyaAy.enf.map(function (u) {
        var re = r.dunyaAy.reel.filter(function (x) { return x.kod === u.kod; })[0];
        return [u.ad, "%" + sayi(u.deger, 1), re ? "%" + sayi(re.faiz, 2) : "—",
          re ? (re.deger < 0 ? "−%" : "%") + sayi(Math.abs(re.deger), 1) : "—"];
      })),
    buyume: tablo("Türkiye: gelir, büyüme, işsizlik ve cari denge (Dünya Bankası)",
      ["Yıl", "Kişi başı GSYH ($)", "Reel büyüme", "İşsizlik", "Cari denge (% GSYH)"],
      r.makro.kisiBasi.map(function (n, i) {
        function bul(ad) { var x = r.makro[ad].filter(function (m) { return m.yil === n.yil; })[0]; return x ? x.tur : null; }
        function y(v) { return v == null ? "—" : (v < 0 ? "−%" : "%") + sayi(Math.abs(v), 1); }
        return [String(n.yil), sayi(n.tur), y(bul("buyume")), y(bul("issizlik")), y(bul("cari"))];
      }))
  };
}

/* ---- ana sayfa: araç dizinindeki iki grafik kartı -------------------------
   Kart anatomisi araç kartlarıyla AYNI (bant, ikon kutusu, başlık, rozet,
   açıklama, bağlantı, alt satır); tek fark bandın dekoratif izi yerine
   gerçek veri çizgisi. Araç sayımına ve filtreye girmezler (--grafik). */
/* Bant 4,2:1 (style.css :root .karo); viewBox aynı oranda, yani çizim
   ölçek bozulmadan oturur ve noktalar daire kalır. Sol %27 ikon kutusuna,
   üst şerit değer etiketine ayrılır. */
var KART = { W: 420, H: 100, X0: 118, X1: 404, Y0: 34, Y1: 86 };
function olcekLog(degerler) {
  var lo = Math.log(Math.min.apply(null, degerler)), hi = Math.log(Math.max.apply(null, degerler));
  return function (v) { return KART.Y1 - (KART.Y1 - KART.Y0) * (Math.log(v) - lo) / (hi - lo); };
}
function kartX(i, n) { return KART.X0 + (KART.X1 - KART.X0) * i / (n - 1); }
function kartYol(noktalar, y) {
  return noktalar.map(function (v, i) {
    return (i ? "L" : "M") + kartX(i, noktalar.length).toFixed(1) + " " + y(v).toFixed(1);
  }).join("");
}
/* Çizgi CSS'te cubic-bezier(.65,0,.35,1) ile 1,9 sn'de çiziliyor (home.css).
   Bir işaretin, çizginin ucu ona VARDIĞINDA belirmesi için: işaretin yol
   üzerindeki payı p ise, eğrinin p'ye ulaştığı zaman t aranır. */
var CIZIM = { bas: 0.2, sure: 1.9, x1: .65, y1: 0, x2: .35, y2: 1 };
function bezier(u, a, b) { return 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u; }
function zamanBul(pay) {
  var lo = 0, hi = 1;
  for (var k = 0; k < 40; k++) {                // ilerleme(t): önce u'yu x'ten bul, sonra y
    var t = (lo + hi) / 2, ulo = 0, uhi = 1;
    for (var j = 0; j < 40; j++) { var u = (ulo + uhi) / 2; if (bezier(u, CIZIM.x1, CIZIM.x2) < t) ulo = u; else uhi = u; }
    if (bezier((ulo + uhi) / 2, CIZIM.y1, CIZIM.y2) < pay) lo = t; else hi = t;
  }
  return CIZIM.bas + CIZIM.sure * (lo + hi) / 2;
}
function yolPayi(noktalar, y, i) {
  var n = noktalar.length, top = 0, kadar = 0;
  for (var k = 1; k < n; k++) {
    var dx = kartX(k, n) - kartX(k - 1, n), dy = y(noktalar[k]) - y(noktalar[k - 1]);
    var l = Math.sqrt(dx * dx + dy * dy);
    top += l; if (k <= i) kadar += l;
  }
  return kadar / top;
}
function kartSvg(o) {
  var n = o.ana.length, y = o.y;
  var yol = kartYol(o.ana, y);
  var sonX = kartX(n - 1, n).toFixed(1), sonY = y(o.ana[n - 1]).toFixed(1);
  var p = ['<svg class="kart-iz" viewBox="0 0 ' + KART.W + " " + KART.H + '" aria-hidden="true">',
    '<defs><linearGradient id="' + o.id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" class="' + o.renkG + ' kart-g-ust"/><stop offset="1" class="' + o.renkG + ' kart-g-alt"/></linearGradient></defs>',
    '<path class="kart-taban" d="M' + KART.X0 + " " + KART.Y1 + "H" + KART.X1 + '"/>',
    '<path class="kart-alan" fill="url(#' + o.id + ')" d="' + yol + "V" + KART.Y1 + "H" + KART.X0 + 'Z"/>'];
  (o.ikinci || []).forEach(function (s2) {
    p.push('<path pathLength="1" class="kart-cizgi kart-ince ' + s2.renk + '" d="' + kartYol(s2.noktalar, y) + '"/>');
  });
  p.push('<path pathLength="1" class="kart-cizgi ' + o.renk + '" d="' + yol + '"/>');
  p.push('<path pathLength="1" class="kart-parilti ' + o.renk + '" d="' + yol + '"/>');
  (o.isaretler || []).forEach(function (k) {
    var gecikme = zamanBul(yolPayi(o.ana, y, k.i));
    p.push('<circle class="kart-kat" style="--gecikme:' + gecikme.toFixed(2) + 's" cx="' + kartX(k.i, n).toFixed(1) +
      '" cy="' + y(k.v).toFixed(1) + '" r="2.6"/>');
  });
  p.push('<circle class="kart-hale" cx="' + sonX + '" cy="' + sonY + '" r="3.4"/>');
  p.push('<circle class="kart-son" cx="' + sonX + '" cy="' + sonY + '" r="3.4"/>');
  p.push('<circle class="kart-kosucu ' + o.kosucu + '" r="4" style="offset-path: path(\'' + yol + '\')"/>');
  p.push("</svg>");
  return p.join("");
}
function anaKartlar(r) {
  var d = sayilar(r);
  var fiyat = [100].concat(r.fiyat.map(function (n) { return n.endeks; }));
  var b = r.birikim;
  var altin = b.map(function (n) { return n.altin; }), dolar = b.map(function (n) { return n.dolar; });
  function kart(o) {
    return [
      '<li class="project-card project-card--grafik reveal">',
      '            <div class="karo karo--grafik" aria-hidden="true"><span class="karo-ikon">' + o.ikon + "</span>",
      "              " + o.svg,
      '              <span class="kart-iz-deger" data-deger="' + o.deger + '">' + o.deger + "</span></div>",
      '            <div class="project-body">',
      '              <h3><a href="' + o.href + '">' + o.baslik + "</a></h3>",
      '              <p class="card-badges" aria-hidden="true"><span>Grafik</span><span>Resmî veri</span></p>',
      "              <p>" + o.metin + "</p>",
      '              <p class="project-links"><a href="' + o.href + '">Grafiği aç</a> · <a href="grafikler/">' + Tanim.adlar.length + " grafik</a></p>",
      '              <p class="card-updated">Veri: ' + o.veri + "</p>",
      "            </div>",
      "          </li>"
    ].join("\n");
  }
  var ikonCizgi = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/><circle cx="19" cy="6" r="1.2"/></svg>';
  var ikonAltin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>';
  var aylarF = ["2004-12"].concat(r.fiyat.map(function (n) { return n.ay; }));
  var katlar = r.katlar.map(function (k) { return { i: aylarF.indexOf(k.ay), v: k.esik }; });
  var yAB = olcekLog(altin.concat(dolar));
  return "\n" + kart({
    href: "grafikler/#fiyatlar", ikon: ikonCizgi,
    svg: kartSvg({ id: "kart-g-fiyat", ana: fiyat, y: olcekLog(fiyat), renk: "kart-bir", renkG: "kart-g-bir",
      kosucu: "kart-kosucu--bir", isaretler: katlar }),
    deger: "×" + d.fiyatKat,
    baslik: "Fiyatlar 2005'ten bu yana ×" + d.fiyatKat,
    metin: "Aralık 2004'te 100 TL olan sepet " + d.sonAyDa + " " + d.sepet + " TL. Fiyatlar " + d.katSayisiYazi +
      " kez ikiye katlandı; ilki " + d.ilkKatSure + " ay, sonuncusu " + d.sonKatSure + " ay sürdü.",
    veri: d.sonAyUzun + " TÜFE"
  }) + "\n" + kart({
    href: "grafikler/#kur", ikon: ikonAltin,
    svg: kartSvg({ id: "kart-g-altin", ana: altin, y: yAB, renk: "kart-uc", renkG: "kart-g-uc", kosucu: "kart-kosucu--uc",
      ikinci: [{ noktalar: dolar, renk: "kart-iki" }] }),
    deger: "×" + sayi(r.ozet.altinKat, 1),
    baslik: "Gram altın 2005'ten bu yana ×" + sayi(r.ozet.altinKat, 1),
    metin: "Ocak 2005'in 100 TL'si altına konsa bugün " + d.birikimAltin + " TL, dolara " + d.birikimDolar +
      " TL; aynı sepetin fiyatı " + d.birikimFiyat + " TL.",
    veri: Tanim.ayUzun(r.ozet.birikimAy) + ", ay sonu kur"
  }) + "\n";
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
  var anaEski = fs.readFileSync(ANA, "utf8"), anaDegisen = [];
  var anaYeni = blokDegistir(anaEski, "ANA-KART-GRAFIK", anaKartlar(sonuc.r), anaDegisen);
  if (kontrol && anaYeni !== anaEski) {
    console.error("Ana sayfadaki grafik kartları seriden farklı — 'node tools/grafikler-sayfa.js' çalıştırın.");
    return 1;
  }
  if (!kontrol && anaYeni !== anaEski) {
    fs.writeFileSync(ANA, anaYeni, "utf8");
    console.log("Ana sayfa grafik kartları yazıldı.");
    if (harita && !Ortak.sitemapTazele("https://korayoner.dev/")) return 1;
  }
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
module.exports = { anaKartlar: anaKartlar, sayilar: sayilar, bulunma: bulunma, iyelik: iyelik, iyelikBulunma: iyelikBulunma,
  zamanMetni: zamanMetni, uret: uret };
