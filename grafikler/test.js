#!/usr/bin/env node
/*!
 * Grafikler sayfasının hesabı — her iddia ikinci bir yoldan.
 *
 * hesap.js'in verdiği her özet, burada aynı ham seriden ayrı ve kaba bir
 * yöntemle yeniden hesaplanır (döngüyle, arama tablosuyla, ters formülle).
 * İki yol ayrışırsa sayfadaki cümle yanlıştır. Ayrıca:
 *   - resmî net asgari ücret, bordro motorunun hesabıyla tutmalı,
 *   - Türkçe ek üreteci ("2024'te", "2026'da") bilinen yıllarda doğru olmalı,
 *   - sayfa seriden üretilmiş halinde olmalı (tools/grafikler-sayfa.js).
 *
 * Kullanım: node grafikler/test.js
 */
"use strict";

var path = require("path");
var fs = require("fs");
var KOK = path.join(__dirname, "..");
var H = require("./hesap.js");
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var G = require(path.join(KOK, "finans", "grafik-verisi.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));
var Uretec = require(path.join(KOK, "tools", "grafikler-sayfa.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }

var r = H.hesapla(T, G, B);
var o = r.ozet;
var aylar = Object.keys(T.aylar).sort();
var son = aylar[aylar.length - 1];

console.log("Grafikler sayfasının hesabı\n");

/* ---- I. fiyat endeksi ---------------------------------------------------- */
var carpim = 1, endeks = { "2004-12": 100 };
aylar.forEach(function (a) { carpim *= 1 + T.aylar[a].aylik / 100; endeks[a] = 100 * carpim; });
dogru("fiyat katı aylık değişimlerin çarpımı", yakin(o.fiyatKat, carpim, 1e-9), o.fiyatKat + " / " + carpim);
dogru("seri son ayı TÜFE'nin son ayı", r.sonAy === son);

var onceki = "2004-12", esik = 200, katlar = [];
aylar.forEach(function (a) {
  while (endeks[a] >= esik) {
    katlar.push({ ay: a, esik: esik });
    esik *= 2;
  }
  onceki = a;
});
dogru("ikiye katlanma sayısı aynı", katlar.length === r.katlar.length, katlar.length + " / " + r.katlar.length);
r.katlar.forEach(function (k, i) {
  var idx = aylar.indexOf(k.ay);
  var oncekiEndeks = idx ? endeks[aylar[idx - 1]] : 100;
  dogru("katlanma " + k.esik + ": " + k.ay + " eşiği ilk geçen ay",
    endeks[k.ay] >= k.esik && oncekiEndeks < k.esik && katlar[i].ay === k.ay);
});
var sureToplam = r.katlar.reduce(function (t, k) { return t + k.sure; }, 0);
dogru("katlanma süreleri Aralık 2004'ten son katlanmaya kadar olan aylar",
  sureToplam === H.aySayisi("2004-12", r.katlar[r.katlar.length - 1].ay));

/* ---- II. enflasyon -------------------------------------------------------- */
var tepe = aylar.reduce(function (a, b) { return T.aylar[b].yillik > T.aylar[a].yillik ? b : a; });
dogru("tepe yıllık TÜFE ayı ve değeri", o.tepeTufe.ay === tepe && o.tepeTufe.deger === T.aylar[tepe].yillik,
  o.tepeTufe.ay + " " + o.tepeTufe.deger);
var bantAy = 0, bantIci = 0;
aylar.forEach(function (a) { if (a < "2018-01") { bantAy++; if (T.aylar[a].yillik >= 6 && T.aylar[a].yillik <= 12) bantIci++; } });
dogru("2005–2017 bandı: " + bantIci + " / " + bantAy, o.bantAy === bantAy && o.bantIci === bantIci);
dogru("2018 tepesi Ekim 2018, %25,24 (TÜİK geçmişi değişmez)", o.tepe2018.ay === "2018-10" && o.tepe2018.deger === 25.24);

/* ---- III. faiz ------------------------------------------------------------- */
function faizAyinSonu(ay) {                 // kararları doğrudan tara
  var sonKarar = null;
  G.politikaFaizi.forEach(function (k) { if (k[0] <= ay + "-31") sonKarar = k[1]; });
  return sonKarar;
}
[["2010-05", 7], ["2023-07", 17.5], ["2023-08", 25], ["2024-02", 45], ["2024-03", 50], ["2024-12", 47.5], ["2026-01", 37]]
  .forEach(function (k) {
    var n = r.faiz.filter(function (x) { return x.ay === k[0]; })[0];
    dogru("politika faizi " + k[0] + " = %" + k[1], n && n.faiz === k[1] && faizAyinSonu(k[0]) === k[1], n && n.faiz);
  });
var kasim = r.faiz.filter(function (x) { return x.ay === "2022-11"; })[0];
dogru("Fisher reel faiz Kasım 2022: (1,09 / 1,8439) − 1",
  yakin(kasim.reel, 100 * (1.09 / (1 + T.aylar["2022-11"].yillik / 100) - 1), 1e-9) && o.reelFaizDip.ay === "2022-11");
var negatif = 0, uzun = 0, simdiki = 0, faizAy = 0;
aylar.forEach(function (a) {
  if (a < "2010-05") return;
  faizAy++;
  var reel = (1 + faizAyinSonu(a) / 100) / (1 + T.aylar[a].yillik / 100) - 1;
  if (reel < 0) { negatif++; simdiki++; uzun = Math.max(uzun, simdiki); } else simdiki = 0;
});
dogru("negatif reel faizli ay sayısı " + negatif + " / " + faizAy, o.negatifAy === negatif && o.faizAySayisi === faizAy);
dogru("en uzun negatif dönem " + uzun + " ay", o.enUzunNegatif.ay === uzun &&
  H.aySayisi(o.enUzunNegatif.bas, o.enUzunNegatif.son) + 1 === uzun);
dogru("güncel faiz son kararın oranı", o.faiz === G.politikaFaizi[G.politikaFaizi.length - 1][1]);

/* ---- IV. kur --------------------------------------------------------------- */
var kurAylar = Object.keys(G.kur).sort(), kurSon = kurAylar[kurAylar.length - 1];
dogru("dolar katı = son ay / Ocak 2005", yakin(o.usdKat, G.kur[kurSon].USD / G.kur["2005-01"].USD, 1e-12));
var tufeKat = 1;
kurAylar.slice(1).forEach(function (a) { tufeKat *= 1 + T.aylar[a].aylik / 100; });
dogru("aynı dönemde fiyat katı (Şubat 2005'ten zincir)", yakin(o.tufeKatKur, tufeKat, 1e-9), o.tufeKatKur + " / " + tufeKat);
dogru("kur serisi TÜFE'nin son ayına kadar", kurSon === son || kurSon === aylar[aylar.length - 2]);

/* ---- V. asgari ücret -------------------------------------------------------- */
var donemler = [];
for (var y = 2020; y <= +son.slice(0, 4); y++) {
  B.parametre(y).donemler.forEach(function (d) { donemler.push({ yil: y, ay: d.ay, brut: d.asgariBrut, net: d.asgariNet }); });
}
donemler.forEach(function (d) {
  var brutlar = [];
  for (var m = 1; m <= 12; m++) {
    var gecerli = null;
    B.parametre(d.yil).donemler.forEach(function (x) { if (x.ay <= m) gecerli = x; });
    brutlar.push(gecerli.asgariBrut);
  }
  var motor = B.hesaplaYil(brutlar, d.yil).aylar[d.ay - 1].net;
  dogru("motor neti resmî net " + d.yil + "/" + d.ay + " (" + d.net + ")", yakin(motor, d.net, 0.02), String(motor));
});
var oca26 = r.asgari.filter(function (n) { return n.ay === "2026-01"; })[0];
dogru("Ocak 2026 dolar karşılığı = net / ay sonu kuru",
  yakin(oca26.usd, B.parametre(2026).donemler[0].asgariNet / G.kur["2026-01"].USD, 1e-9));
dogru("dönem erimesi = 1 − endeks(zam ayı) / endeks(son ay)",
  yakin(o.donemErime, 1 - endeks[o.donemBas.ay] / endeks[son], 1e-12), String(o.donemErime));
// Sayfa "zam ayı tepedir" diyor: her dönemde bugünün TL'siyle en yüksek ay dönemin ilk ayı.
var donemIlk = {};
r.asgari.forEach(function (n, i, a) { if (!i || n.net !== a[i - 1].net) donemIlk[n.net] = n; });
var tepeIhlal = r.asgari.filter(function (n) { return n.reel > donemIlk[n.net].reel + 1e-9; });
dogru("her dönemde alım gücünün tepesi zam ayı", tepeIhlal.length === 0, tepeIhlal.map(function (n) { return n.ay; }).join(", "));
var usdEnYuksek = r.asgari.reduce(function (a, b) { return b.usd > a.usd ? b : a; });
dogru("dolar tepesi ayı ve tutarı", usdEnYuksek.ay === o.usdTepe.ay && yakin(usdEnYuksek.usd, o.usdTepe.usd, 1e-12));

/* ---- VI. dünya --------------------------------------------------------------- */
var yil = null;
Object.keys(G.dunya.TUR).sort().forEach(function (y2) {
  if (G.ulkeler.every(function (u) { return G.dunya[u[0]][y2] != null; })) yil = y2;
});
dogru("sıralama yılı bütün ülkelerde verisi olan son yıl: " + yil, o.dunyaYil === yil);
var turSira = 1 + G.ulkeler.filter(function (u) { return G.dunya[u[0]][yil] > G.dunya.TUR[yil]; }).length;
dogru("Türkiye'nin sırası " + turSira, o.turSira === turSira);
var degerler = G.ulkeler.map(function (u) { return G.dunya[u[0]][yil]; }).sort(function (a, b) { return a - b; });
dogru("ortanca (20 ülke: iki ortanın ortalaması)", yakin(o.ortanca, (degerler[9] + degerler[10]) / 2, 1e-12));

/* ---- zaman makinesi ---------------------------------------------------------- */
var z = H.zamanMakinesi(r, "2015-01");
dogru("zaman makinesi: 100 TL × endeks oranı", yakin(z.sepet, 100 * endeks[son] / endeks["2015-01"], 1e-9));
dogru("zaman makinesi: dolar Ocak 2015 ay sonu", z.usdOnce === G.kur["2015-01"].USD);

/* ---- Türkçe ekler ------------------------------------------------------------ */
var EK = { 2020: "'de", 2021: "'de", 2022: "'de", 2023: "'te", 2024: "'te", 2025: "'te", 2026: "'da",
  2027: "'de", 2028: "'de", 2029: "'da", 2030: "'da", 2040: "'ta", 2008: "'de", 2010: "'da", 2000: "'de" };
Object.keys(EK).forEach(function (y2) {
  dogru("ek " + y2 + EK[y2], Uretec.bulunma(+y2) === EK[y2], Uretec.bulunma(+y2));
});

/* ---- sayfa ------------------------------------------------------------------- */
var sayfa = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
dogru("sayfa seriden üretilmiş halinde", Uretec.uret(sayfa).s === sayfa);
var bos = (sayfa.match(/<!-- GR[A-Z-]*(:[a-zA-Z]+)?:BASLANGIC --><!-- GR/g) || []).length;
dogru("üretilen blokların hiçbiri boş değil", bos === 0, bos + " boş blok");

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (grafikler)");
process.exit(kalan ? 1 : 0);
