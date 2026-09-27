#!/usr/bin/env node
/*!
 * Kira artışı aracının testi — oran, hukuk sınırları, zincir ve sayfa.
 *
 * Oran serisi (finans/kira-tufe.js) BIS'in tam hassasiyetli TÜFE
 * endeksinden türüyor. Burada ikinci bir yoldan, sitenin kendi TÜFE
 * serisinin (finans/tufe-serisi.js, TÜİK'in yuvarlanmış aylık değişimleri)
 * zincirlenmesiyle yeniden hesaplanır. Aylık değişimler iki basamağa
 * yuvarlı; 24 halkalık zincirde bu sapma 2026-09-27'de en çok 0,028 puan
 * ölçüldü (Kasım 2020). Tolerans 0,04: bunun üstü seride hata demektir. Resmî açıklanmış
 * oranlar ayrıca çapadır.
 *
 * Kullanım: node kira-artisi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var fs = require("fs");
var KOK = path.join(__dirname, "..");
var M = require(path.join(KOK, "finans", "kira-motoru.js"));
var K = require(path.join(KOK, "finans", "kira-tufe.js"));
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var G = require("./gorunum.js");
var Uretec = require(path.join(KOK, "tools", "kira-sayfa.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function esit(ad, a, b) { dogru(ad, a === b, JSON.stringify(a) + " ≠ " + JSON.stringify(b)); }

/* ---- 1. resmî çapalar (TÜİK bültenleri; anahtar yenileme günü) ------------- */
console.log("Resmî oranlar");
[
  ["2023-01-15", 72.31, "Aralık 2022 verisi"],
  ["2024-07-15", 65.07, "Haziran 2024 verisi"],
  ["2024-08-15", 65.93, "Temmuz 2024 verisi (zincirleme 65,92 veriyordu)"],
  ["2026-01-15", 34.88, "Aralık 2025 verisi"],
  ["2026-09-15", 31.79, "Ağustos 2026 verisi"]
].forEach(function (c) {
  esit(c[0] + " yenilemesi %" + c[1] + " (" + c[2] + ")", M.oran({ tarih: c[0], tur: "isyeri", sozlesme: null }).uygulanan, c[1]);
});

/* ---- 2. ikinci yol: yuvarlanmış aylık değişimleri zincirle ---------------- */
console.log("İkinci yol: TÜFE serisinden zincirleme");
(function () {
  var aylar = Object.keys(T.aylar).sort(), endeks = {}, e = 100, enBuyuk = 0, sayac = 0, kotu = [];
  aylar.forEach(function (a) { e *= 1 + T.aylar[a].aylik / 100; endeks[a] = e; });
  Object.keys(K.oranlar).forEach(function (va) {
    var i = aylar.indexOf(va);
    if (i < 23) return;
    var son = 0, onceki = 0;
    for (var j = 0; j < 12; j++) { son += endeks[aylar[i - j]]; onceki += endeks[aylar[i - 12 - j]]; }
    var z = 100 * (son / onceki - 1), fark = Math.abs(z - K.oranlar[va]);
    sayac++;
    if (fark > enBuyuk) enBuyuk = fark;
    if (fark > 0.04) kotu.push(va + ": seri " + K.oranlar[va] + ", zincir " + z.toFixed(3));
  });
  dogru("zincirle en az 200 ay karşılaştırıldı", sayac >= 200, String(sayac));
  dogru("her ay 0,04 puan içinde (en büyük fark " + enBuyuk.toFixed(4) + ")", kotu.length === 0, kotu.slice(0, 3).join("; "));
  esit("seri tufe-serisi.js'in son ayına kadar geliyor", K.sonAy, aylar[aylar.length - 1]);
  dogru("geçici (TCMB ile uzatılmış) ay en çok 2", Array.isArray(K.gecici) && K.gecici.length <= 2, String(K.gecici));
})();

/* ---- 3. %25 sınırı: günü gününe ------------------------------------------- */
console.log("Konutta %25 sınırı");
function uyg(tarih, tur, soz) { return M.oran({ tarih: tarih, tur: tur, sozlesme: soz === undefined ? null : soz }); }
var mayis22 = K.oranlar["2022-05"];
esit("10 Haziran 2022 konut: sınır yok, Mayıs 2022 oranı", uyg("2022-06-10", "konut").uygulanan, mayis22);
dogru("Mayıs 2022 oranı %25'ten büyük (sınır sınaması boş geçmiyor)", mayis22 > 25, String(mayis22));
esit("11 Haziran 2022 konut: %25", uyg("2022-06-11", "konut").uygulanan, 25);
esit("11 Haziran 2022 iş yeri: sınır yok", uyg("2022-06-11", "isyeri").uygulanan, mayis22);
esit("30 Haziran 2024 konut: %25", uyg("2024-06-30", "konut").uygulanan, 25);
esit("1 Temmuz 2024 konut: %65,07", uyg("2024-07-01", "konut").uygulanan, 65.07);
esit("Ocak 2023 iş yeri: %72,31", uyg("2023-01-02", "isyeri").uygulanan, 72.31);
dogru("sınırlı dönemde dayanak 7409/7456", /7409/.test(uyg("2023-03-01", "konut").dayanak));
dogru("sınır dışında dayanak TBK m.344/1", /344/.test(uyg("2025-03-01", "konut").dayanak));

/* ---- 4. sözleşme oranı ------------------------------------------------------- */
console.log("Sözleşmedeki oran");
var s1 = uyg("2026-09-15", "konut", 10);
esit("tavanın altındaki %10 uygulanır", s1.uygulanan, 10);
dogru("  ve sınırlandı denmez", s1.sozlesmeSinirlandi === false);
var s2 = uyg("2026-09-15", "konut", 50);
esit("tavanın üstündeki %50, %31,79'a iner", s2.uygulanan, 31.79);
dogru("  ve sınırlandı denir", s2.sozlesmeSinirlandi === true);
esit("%0 sözleşme: artış yok", uyg("2026-09-15", "konut", 0).uygulanan, 0);
esit("sınırlı dönemde %30 sözleşme konutta %25'e iner", uyg("2023-09-15", "konut", 30).uygulanan, 25);

/* ---- 5. tutarlar ---------------------------------------------------------------- */
console.log("Tutarlar");
var y = M.yeniKira(20000, { tarih: "2026-09-15", tur: "konut", sozlesme: null });
esit("20.000 TL, Eylül 2026 → 26.358 TL", y.yeniKira, 26358);
esit("  aylık fark 6.358 TL", y.fark, 6358);
esit("  yıllık fark 76.296 TL", y.yillikFark, 76296);

/* ---- 6. zincir: ayrı döngüyle ------------------------------------------------ */
console.log("Kira geçmişi zinciri");
(function () {
  var g = M.gecmis({ baslangic: "2021-09-01", kira: 4000, tur: "konut", sozlesme: null, bugun: "2026-09-27" });
  var kira = 4000, oranlar = [];
  for (var yil = 2022; yil <= 2026; yil++) {
    var o = K.oranlar[yil + "-08"];
    if (yil === 2022 || yil === 2023) o = Math.min(o, 25);   // Eylül 2022 ve 2023: konutta sınır
    oranlar.push(o);
    kira = Math.round(kira * (1 + o / 100) * 100) / 100;
  }
  esit("beş yenileme", g.yenilemeler.length, 5);
  esit("uygulanan oranlar", g.yenilemeler.map(function (r) { return r.uygulanan; }).join(","), oranlar.join(","));
  esit("bugünkü yasal azami kira ayrı döngüyle aynı", g.guncelKira, kira);
  esit("beşinci yıl sonu", g.besYil, "2026-09-01");
  esit("on yıl sonu", g.onYil, "2031-09-01");
  esit("sıradaki yenileme 2027-09-01", g.sonraki && g.sonraki.tarih, "2027-09-01");
  if (K.sonAy < "2027-08") dogru("  oranı bekleniyor, tahmin yok", g.sonraki.bekleniyor === true && g.sonraki.uygulanan === undefined);
  var g2 = M.gecmis({ baslangic: "2026-03-10", kira: 30000, tur: "konut", sozlesme: null, bugun: "2026-09-27" });
  esit("henüz yenilemesi olmayan sözleşme: kira aynı", g2.guncelKira, 30000);
  esit("  yenileme yok", g2.yenilemeler.length, 0);
  var g3 = M.gecmis({ baslangic: "2021-09-01", kira: 4000, tur: "konut", sozlesme: null, bugun: "2026-08-31" });
  esit("yıldönümünden bir gün önce dört yenileme", g3.yenilemeler.length, 4);
})();

/* ---- 7. takvim --------------------------------------------------------------------- */
console.log("Takvim");
esit("29 Şubat başlangıç, artık olmayan yıl → 28 Şubat", M.yildonumu("2024-02-29", 1), "2025-02-28");
esit("29 Şubat başlangıç, artık yıl → 29 Şubat", M.yildonumu("2024-02-29", 4), "2028-02-29");
esit("Ağustos 2026 verisi 3 Eylül 2026 (perşembe)", M.aciklamaTarihi("2026-08"), "2026-09-03");
esit("Eylül 2026 verisi 5 Ekim 2026 (3'ü cumartesi)", M.aciklamaTarihi("2026-09"), "2026-10-05");
esit("Mayıs 2023 verisi 5 Haziran 2023 (3'ü cumartesi; TÜİK o gün açıkladı)", M.aciklamaTarihi("2023-05"), "2023-06-05");
esit("Eylül'de yenilenen kiraya Ağustos verisi", M.veriAyi("2026-09-30"), "2026-08");
esit("Ocak'ta yenilenen kiraya önceki yılın Aralık verisi", M.veriAyi("2026-01-01"), "2025-12");
var DURUM = M.durum();
var bek = uyg(DURUM.sonrakiYenilemeAyi + "-15", "konut");
dogru("açıklanmamış ay: bekleniyor, oran yok", bek.bekleniyor === true && bek.uygulanan === undefined);
var eski = uyg("2005-03-01", "konut");
dogru("serinin öncesi: kapsam dışı, oran yok", eski.kapsamDisi === true && eski.uygulanan === undefined);

/* ---- 8. Türkçe ekler ------------------------------------------------------------------- */
console.log("Türkçe ekler");
[["2026-09", "Eylül 2026'da"], ["2023-05", "Mayıs 2023'te"], ["2020-01", "Ocak 2020'de"],
 ["2030-01", "Ocak 2030'da"], ["2040-01", "Ocak 2040'ta"], ["2025-01", "Ocak 2025'te"], ["2029-01", "Ocak 2029'da"]]
  .forEach(function (c) { esit(c[1], G.ayDa(c[0]), c[1]); });
[["2022-01", "Ocak 2022'den"], ["2010-01", "Ocak 2010'dan"], ["2000-01", "Ocak 2000'den"]]
  .forEach(function (c) { esit(c[1], G.ayDan(c[0]), c[1]); });

/* ---- 9. görünüm ------------------------------------------------------------------------ */
console.log("Görünüm");
var h = G.yeniKiraHtml(y, "konut");
dogru("sonuç kartı 26.358,00 TL diyor", h.html.indexOf("26.358,00 TL") >= 0);
var hb = G.yeniKiraHtml(M.yeniKira(20000, { tarih: DURUM.sonrakiYenilemeAyi + "-15", tur: "konut", sozlesme: null }), "konut");
dogru("açıklanmamış ayda rakam yok, açıklama tarihi var", hb.html === "" && hb.mesaj.indexOf(G.tarihUzun(DURUM.sonrakiAciklama)) >= 0, hb.mesaj);
var h25 = G.yeniKiraHtml(M.yeniKira(10000, { tarih: "2023-03-01", tur: "konut", sozlesme: null }), "konut");
dogru("sınırlı dönemde not %25 sınırını söylüyor", /%25 sınırı/.test(h25.html));
var hs = G.yeniKiraHtml(M.yeniKira(10000, { tarih: "2026-09-15", tur: "konut", sozlesme: 50 }), "konut");
dogru("yüksek sözleşme oranında not var", /yasal tavanı aşıyor/.test(hs.html));

/* ---- 10. sayfa ------------------------------------------------------------------------- */
console.log("Sayfa");
var sayfa = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var d = M.durum();
esit("sayfa seriden üretilmiş halinde", Uretec.uret(sayfa).s === sayfa, true);
dogru("manşet son oranı söylüyor", sayfa.indexOf('<span data-k="sonOran">' + G.sayi(d.sonOran, 2) + "</span>") >= 0);
dogru("başlıkta son oran", new RegExp("<title>[^<]*%" + G.sayi(d.sonOran, 2).replace(",", ",") + "[^<]*</title>").test(sayfa));
var baslik = /<title>([^<]*)<\/title>/.exec(sayfa)[1];
dogru("başlık 60 karakteri aşmıyor", baslik.length <= 60, baslik.length + ": " + baslik);
var ac = /<meta name="description" content="([^"]*)"/.exec(sayfa)[1];
dogru("açıklama 165 karakteri aşmıyor", ac.length <= 165, String(ac.length));
var ldler = sayfa.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
var ldTamam = ldler.every(function (b) {
  try { JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")); return true; } catch (e) { return false; }
});
dogru("JSON-LD blokları geçerli (" + ldler.length + ")", ldler.length >= 2 && ldTamam);
dogru("S.S.S. işaretlemesi ile görünen S.S.S. aynı sayıda", (sayfa.match(/"@type":"Question"/g) || []).length ===
  (sayfa.match(/<!-- KIRA-SSS:BASLANGIC -->[\s\S]*<!-- KIRA-SSS:BITIS -->/)[0].match(/<details>/g) || []).length);
var tabloSatir = (sayfa.match(/<!-- KIRA-TABLO:BASLANGIC -->[\s\S]*<!-- KIRA-TABLO:BITIS -->/)[0].match(/<tr><th scope="row">/g) || []).length;
esit("tablo Ocak 2022'den son aya her ayı taşıyor", tabloSatir, M.tablo("2022-01").length);
dogru("grafik etiketi son oranı söylüyor", sayfa.indexOf("son " + M.ayAdi(d.sonYenilemeAyi) + " %" + G.sayi(d.sonOran, 2)) >= 0);
dogru("örnek geçmiş sayfada ön çizili", /KIRA-GECMIS-ORNEK:BASLANGIC --><div class="sum-grid">/.test(sayfa));
dogru("eski elle TÜFE alanı kalmadı", sayfa.indexOf('id="in-tufe"') < 0);

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kontrol kaldı.");
process.exit(kalan ? 1 : 0);
