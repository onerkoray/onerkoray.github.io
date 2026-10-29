/*!
 * Ocak 2027 zammı — emekli ve memur yazılarının ortak hesabı.
 *
 * Kural ve veri sitenin zam motorundan (finans/emekli-zammi-motoru.js):
 *   SSK ve Bağ-Kur   Ocak zammı = Temmuz–Aralık 2026 TÜFE birikimi (5510 m.55)
 *   Memur ve 4/c     fark = max(0, (1 + birikim) / (1 + %7) − 1), zam = (1 + fark) × (1 + %5) − 1
 *                    (%7: 2026 ikinci yarı, %5: 2027 ilk yarı toplu sözleşme oranı)
 * Aylık TÜFE serisi TÜİK'in, TCMB'nin tablosundan gece güncellenir.
 *
 * Tahmin yapılmaz. Açıklanmamış aylar için dört işaretli senaryo:
 *   son üç ayın hızı sürerse · geçen yılın aynı ayları tekrarlanırsa ·
 *   OVP'nin 2026 yıl sonu tahmini tutarsa · sabit aylık oranlar (duyarlılık)
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var Z = require("../../finans/emekli-zammi-motoru.js");
var T = require("../../finans/tufe-serisi.js");

var ZAM_YILI = 2027, ZAM_AYI = 1;
var OVP_YIL_SONU = 0.284;  // Orta Vadeli Program (2027–2029), RG 6 Eylül 2026: 2026 yıl sonu TÜFE
var DUYARLILIK = [0.01, 0.015, 0.02, 0.025];

function donem() { return Z.donem(ZAM_YILI, ZAM_AYI, T); }
function ilkYari() { return Z.donem(2026, 7, T).birikim; }

/* Yıl sonu yıllık enflasyon X ise ikinci yarı: (1 + X) / (1 + ilk yarı) − 1. */
function yilSonundan(x) { return (1 + x) / (1 + ilkYari()) - 1; }

/* İkinci yarı birikimi verildiğinde kalan ayların aylık ortalaması. */
function kalanAylik(d, birikim) { return Math.pow((1 + birikim) / (1 + d.birikim), 1 / d.eksikSayisi) - 1; }

function sonUcAyHizi(d) {
  var bilinen = d.aylar.filter(function (a) { return a.oran != null; }).map(function (a) { return a.oran; });
  return Math.pow(1 + Z.bilesik(bilinen), 1 / bilinen.length) - 1;
}

function sonuc(ad, aciklama, birikim, d) {
  var m = Z.memurZammi(birikim, ZAM_YILI, ZAM_AYI);
  return { ad: ad, aciklama: aciklama, emekli: birikim, memur: m.toplam, fark: m.fark, kalanAylik: kalanAylik(d, birikim) };
}

function senaryolar() {
  var d = donem();
  var hiz = sonUcAyHizi(d), gecen = Z.gecenYilAyniAylar(d, T);
  return [
    sonuc("Son üç ayın hızı sürerse", "Ekim–Aralık her ay, Temmuz–Eylül ortalaması kadar", Z.senaryo(d, hiz), d),
    sonuc("Geçen yılın aynı ayları", "Ekim–Aralık 2025'in aylık oranları tekrarlanırsa", Z.senaryo(d, gecen), d),
    sonuc("OVP tahmini tutarsa", "2026 yıl sonu enflasyon %28,4 olursa", yilSonundan(OVP_YIL_SONU), d)
  ];
}

function duyarlilik() {
  var d = donem();
  return DUYARLILIK.map(function (m) { return sonuc("Ayda " + m, "", Z.senaryo(d, m), d); });
}

/* Memura enflasyon farkı çıkması için kalan üç ayda gereken toplam artış. */
function farkEsigi() { return Z.farkEsigi(donem()); }

module.exports = {
  Z: Z, T: T, ZAM_YILI: ZAM_YILI, ZAM_AYI: ZAM_AYI, OVP_YIL_SONU: OVP_YIL_SONU, DUYARLILIK: DUYARLILIK,
  donem: donem, ilkYari: ilkYari, yilSonundan: yilSonundan, kalanAylik: kalanAylik, sonUcAyHizi: sonUcAyHizi,
  senaryolar: senaryolar, duyarlilik: duyarlilik, farkEsigi: farkEsigi
};
