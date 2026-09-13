#!/usr/bin/env node
/*!
 * "Emekliliğin finansal matematiği" yazısındaki sayıların doğrulaması.
 *
 * NEDEN: bu yazı akademik bir iddia yayımlıyor ve sayıların çoğu ELLE
 * yazılmış HTML tablolarında duruyor. Bir rakam yanlış girilirse sayfa
 * açılmaya devam eder, tablo hizalı görünür, kimse uyarı almaz — yalnızca
 * yanlıştır. Üstelik yazının kendi tezine ("hangi sayı neyi ölçüyor")
 * gölge düşürür.
 *
 * Bu yüzden anüite hesapları BURADA YENİDEN YAPILIYOR ve sonuçların
 * sayfada geçtiği doğrulanıyor. Test, yazının kaynak verilerini (OECD,
 * TÜİK, SGK rakamları) doğrulamaz — onlar dış kaynaktır ve yazıda
 * atıflarıyla duruyor. Doğrulanan şey, yazının KENDİ hesapladığı
 * türetilmiş sayılar ve aritmetik özdeşlikler.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var YOL = path.join(__dirname, "..", "makaleler",
  "emekliligin-finansal-matematigi", "index.html");
var s = fs.readFileSync(YOL, "utf8");
var hata = 0;
var gecen = 0;

function esit(ad, bulunan, beklenen, tol) {
  var t = tol === undefined ? 0 : tol;
  if (!(Math.abs(bulunan - beklenen) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + beklenen +
      ", bulunan " + bulunan);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function icerir(ad, metin) {
  if (s.indexOf(metin) < 0) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      sayfada yok: " + metin);
  } else { gecen++; console.log("  tamam      " + ad); }
}

/* Yil sonu odemeli anuite: gelecek deger ve bugunku deger. */
function birikim(C, r, n) {
  if (r === 0) return C * n;
  return C * (Math.pow(1 + r, n) - 1) / r;
}
function gerekli(G, r, m) {
  if (r === 0) return G * m;
  return G * (1 - Math.pow(1 + r, -m)) / r;
}
/* Bin reel TL'ye yuvarlanmis gosterim. */
function bin(x) { return Math.round(x / 1000); }
function tr(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

/* ------------------------------------------------------------------ */
console.log("Şekil 3 — birikim (60.000 TL/yıl reel katkı)");
var C = 60000;
[[20, 0, 1200], [20, 0.02, 1458], [20, 0.04, 1787],
 [30, 0, 1800], [30, 0.02, 2434], [30, 0.04, 3365],
 [40, 0, 2400], [40, 0.02, 3624], [40, 0.04, 5702]].forEach(function (x) {
  var n = x[0], r = x[1], bek = x[2];
  esit(n + " yıl, %" + (r * 100) + " reel", bin(birikim(C, r, n)), bek);
  icerir(n + "/" + (r * 100) + " sayfada", ">" + tr(bek) + "<");
});

/* Cubuk genislikleri ORTAK olcekte mi?
   Genislikler SAYFADAN OKUNUYOR, beklenen dizi elle yazilmiyor: elle yazilan
   bir liste, korudugu isaretlemeyle birlikte eskir. Yanlis olcek, dogru
   sayilarla yanlis bir goruntu uretir -- tam da bu yazinin elestirdigi sey. */
function hucreGenislikleri() {
  var out = [];
  var d = /<b>([\d.]+)<\/b><i style="--w:([\d.]+)%">/g, m;
  while ((m = d.exec(s))) {
    out.push({ deger: Number(m[1].replace(/\./g, "")), w: Number(m[2]) });
  }
  return out;
}
var hucreler = hucreGenislikleri();
console.log("\nÇubuk genişlikleri ortak ölçekte (sayfadan okunuyor)");
esit("matris hücresi sayısı", hucreler.length, 18);
[hucreler.slice(0, 9), hucreler.slice(9)].forEach(function (grup, gi) {
  var enCok = Math.max.apply(null, grup.map(function (h) { return h.deger; }));
  esit((gi ? "Şekil 4" : "Şekil 3") + ": en büyük %100",
    Math.max.apply(null, grup.map(function (h) { return h.w; })), 100);
  grup.forEach(function (h) {
    esit((gi ? "Ş4 " : "Ş3 ") + h.deger + " çubuğu",
      h.w, Math.round(h.deger / enCok * 1000) / 10, 0.06);
  });
});

/* ------------------------------------------------------------------ */
console.log("\nŞekil 4 — gereken başlangıç varlığı (120.000 TL/yıl reel çekiş)");
var G = 120000;
[[20, 0, 2400], [20, 0.02, 1962], [20, 0.04, 1631],
 [25, 0, 3000], [25, 0.02, 2343], [25, 0.04, 1875],
 [30, 0, 3600], [30, 0.02, 2688], [30, 0.04, 2075]].forEach(function (x) {
  var m = x[0], r = x[1], bek = x[2];
  esit(m + " yıl, %" + (r * 100) + " reel", bin(gerekli(G, r, m)), bek);
  icerir(m + "/" + (r * 100) + " sayfada", ">" + tr(bek) + "<");
});

console.log("\nŞekil 4 — başlıktaki fark gerçekten o fark mı?");
/* Baslik "beş yıl daha ödemek 345 bin TL daha fazla varlık ister" diyor.
   Bir baslik iddiasi, tablodan TURETILEBILIR olmali. */
var fark = bin(gerekli(G, 0.02, 30)) - bin(gerekli(G, 0.02, 25));
esit("30 yıl − 25 yıl (%2)", fark, 345);
icerir("fark başlıkta", "345 bin TL daha fazla varlık ister");

/* ------------------------------------------------------------------ */
console.log("\nBirikim ve ödeme aşamasını birleştirmek");
/* 25 yil %2 icin gereken varligi biriktirmek: yillik katki. */
var hedef = gerekli(G, 0.02, 25);
[[20, 96400], [30, 57800], [40, 38800]].forEach(function (x) {
  var n = x[0], bek = x[1];
  var katki = hedef / ((Math.pow(1.02, n) - 1) / 0.02);
  esit(n + " yılda yıllık katkı", Math.round(katki / 100) * 100, bek);
  icerir(n + " yıl katkısı sayfada", tr(bek) + " TL");
});

/* ------------------------------------------------------------------ */
console.log("\nKesinti ve maliyet duyarlılığı");
/* Ilk bes yil katki yok, sonraki 25 yil var. */
var kesintili = birikim(C, 0.02, 25);
esit("baştaki 5 yıl eksik (milyon)", Math.round(kesintili / 10000) / 100, 1.92, 0.005);
esit("tam senaryoyla fark (bin)", bin(birikim(C, 0.02, 30) - kesintili), 512);
icerir("512 bin sayfada", "512 bin reel TL");

var uc = birikim(C, 0.03, 30), iki = birikim(C, 0.02, 30);
esit("%3 getiri (milyon)", Math.round(uc / 10000) / 100, 2.85, 0.005);
esit("%3 → %2 kaybı (%)", Math.round((uc - iki) / uc * 1000) / 10, 14.7, 0.05);
icerir("%14,7 sayfada", "%14,7 fark");

/* ------------------------------------------------------------------ */
console.log("\nŞekil 5 — getirilerin sırası");
function yol(getiriler, baslangic, cekis) {
  return getiriler.reduce(function (v, g) { return v * (1 + g) - cekis; }, baslangic);
}
esit("önce −%20, sonra +%25", yol([-0.20, 0.25], 100, 10), 77.5, 1e-9);
esit("önce +%25, sonra −%20", yol([0.25, -0.20], 100, 10), 82.0, 1e-9);
/* Cekis yoksa iki yol AYNI yere gelir: fark getirilerden degil,
   nakit cikisinin varlik tabaniyla etkilesiminden geliyor. */
esit("çekiş yoksa fark yok", yol([-0.20, 0.25], 100, 0) - yol([0.25, -0.20], 100, 0), 0, 1e-9);
icerir("77,5 sayfada", ">77,5<");
icerir("82,0 sayfada", ">82,0<");

/* ------------------------------------------------------------------ */
console.log("\nDiğer türetilmiş sayılar");
esit("reel değişim (1,40/1,3089)", Math.round((1.40 / 1.3089 - 1) * 10000) / 100, 6.96, 0.005);
icerir("%6,96 sayfada", "%6,96");

esit("aylık payı 0,182 × 0,893", Math.round(0.182 * 0.893 * 10000) / 100, 16.25, 0.005);
icerir("%16,3 sayfada", "%16,3");

esit("aktif / pasif dosya", Math.round(26328559 / 16204425 * 100) / 100, 1.62);
esit("aktif / pasif kişi", Math.round(26328559 / 17015688 * 100) / 100, 1.55);
icerir("1,55 sayfada", ">1,55<");

esit("prim yoğunluğu farkı (ay)", 360 - Math.round(360 * 0.80), 72);
icerir("72 ay sayfada", "fark 72 aydır");

/* Sekil 1: cubuk 0-80 olceginde mi? Deger ve genislik YAN YANA okunuyor;
   biri degisip digeri kalirsa grafik sessizce yalan soylerdi. */
console.log("\nŞekil 1 — bağımlılık oranı çubukları (0-80 ölçeği)");
var s1 = [], d1 = /--w:([\d.]+)%"><\/span><\/span><span class="em-cubuk-deger">([\d,]+)</g, m1;
while ((m1 = d1.exec(s))) {
  s1.push({ w: Number(m1[1]), deger: Number(m1[2].replace(",", ".")) });
}
esit("Şekil 1 çubuk sayısı", s1.length, 6);
s1.forEach(function (c) {
  esit(c.deger + " çubuğu (0-80)", c.w, Math.round(c.deger / 80 * 1000) / 10, 0.06);
});

/* ------------------------------------------------------------------ */
console.log("\nSunum kuralları");
/* Yazi bir PROJEKSIYONU gozlem gibi sunmamali. */
icerir("2054 projeksiyon diye işaretli", "2054 <small>— projeksiyon</small>");
icerir("2084 projeksiyon diye işaretli", "2084 <small>— projeksiyon</small>");
icerir("2024 gözlem diye işaretli", "2024 <small>— gözlem</small>");
/* Academia baglantisi: akademik kunyenin dayanagi. */
icerir("Academia bağlantısı", "academia.edu/175459708");
/* Yazinin tezi: iki oran ayni olcu degil. */
icerir("ikame oranı uyarısı", "aynı ölçü değildir");

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (emeklilik makalesi kontrolleri)");
