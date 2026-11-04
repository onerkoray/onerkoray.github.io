/*!
 * "Emekliye ilave iyileştirme" yazısının hesabı.
 *
 * İki soru:
 *   1) 2027 Yıllık Programı'nın sigorta ödemesi (aylık ve gelir), yasal zam
 *      ve dosya artışıyla ne kadar açıklanıyor? Aynı ayrıştırma 2025 ve 2026
 *      için de yapılır; 2027'nin kalıntısı onlarla karşılaştırılır.
 *   2) Aynı para seyyanen tutar ya da ek oran olarak verilirse kime ne düşer?
 *
 * Veri: program.json (Yıllık Program), butce.json (Bakanlık sunumu ve dosya
 * sayıları). Zam oranları sitenin motorundan, en düşük aylık yazısının veri
 * ayına kesilmiş TÜFE serisiyle; gece değişmez, taban.js VERI_AYI ile ilerler.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var TB = require("../en-dusuk-emekli-ayligi-ocak-2027/taban.js");
var P = require("../yillik-program-2027/program.json");
var V = require("./butce.json");
var Z = TB.Z, SERI = TB.SERI;

var OVP_YIL_SONU = 0.284;         // Orta Vadeli Program ve Yıllık Program: 2026 yıl sonu TÜFE
var TEMMUZ_ARALIK = [0.08, 0.12]; // Temmuz 2027 zammı için duyarlılık uçları
var SEYYANEN = 1000;              // ölçek için örnek tutar, TL/ay

function zam(y, a) { return Z.donem(y, a, SERI).birikim; }

/* Ocak 2027 zammının üç senaryosu; ocak.js ile aynı tanım, kesilmiş seri. */
function ocakSenaryolari() {
  var d = Z.donem(2027, 1, SERI);
  var bilinen = d.aylar.filter(function (a) { return a.oran != null; }).map(function (a) { return a.oran; });
  var hiz = Math.pow(1 + Z.bilesik(bilinen), 1 / bilinen.length) - 1;
  return {
    kesin: d.birikim,
    ovp: (1 + OVP_YIL_SONU) / (1 + zam(2026, 7)) - 1,
    gecenYil: Z.senaryo(d, Z.gecenYilAyniAylar(d, SERI)),
    hiz: Z.senaryo(d, hiz)
  };
}

/* Programın 2027 hedefi yılın iki yarısına eşit dağılırsa Temmuz zammı. */
function temmuzMerkez() { return Math.sqrt(1 + P.hedefler.tufeYilSonu["2027"] / 100) - 1; }

/* Yarıyıl aylık seviyeleri, 2024 ilk yarısı = 1. */
function seviyeler(ocak27, temmuz27) {
  var L = { "2024-1": 1 };
  L["2024-2"] = L["2024-1"] * (1 + zam(2024, 7));
  L["2025-1"] = L["2024-2"] * (1 + zam(2025, 1));
  L["2025-2"] = L["2025-1"] * (1 + zam(2025, 7));
  L["2026-1"] = L["2025-2"] * (1 + zam(2026, 1));
  L["2026-2"] = L["2026-1"] * (1 + zam(2026, 7));
  L["2027-1"] = L["2026-2"] * (1 + ocak27);
  L["2027-2"] = L["2027-1"] * (1 + temmuz27);
  return L;
}
function yilOrtalamasi(L, y) { return (L[y + "-1"] + L[y + "-2"]) / 2; }

function dosya(y) {
  var d = V.aylikDosya[y];
  return d.toplam || d.kamu + d.hizmet + d.bagimsiz + d.sandik;
}
function dosyaArtisi(y) { return dosya(y) / dosya(y - 1) - 1; }

function odeme(y) { return P.sgk.sigortaOdemeleri[P.sgk.yillar.indexOf(String(y))]; }

/* Ödeme artışını yasal zam ve dosyaya ayır; kalan kalıntıdır. */
function satir(yil, ocak27, temmuz27, dosyaOrani) {
  var L = seviyeler(ocak27, temmuz27);
  var oran = yilOrtalamasi(L, yil) / yilOrtalamasi(L, yil - 1) - 1;
  var artis = odeme(yil) / odeme(yil - 1) - 1;
  var beklenen = odeme(yil - 1) * (1 + oran) * (1 + dosyaOrani);
  return { yil: yil, artis: artis, oran: oran, dosya: dosyaOrani, beklenen: beklenen,
    kalinti: odeme(yil) / beklenen - 1, kalintiTl: odeme(yil) - beklenen };
}

function ayristirma() {
  var o = ocakSenaryolari(), t = temmuzMerkez(), d25 = dosyaArtisi(2025);
  return [satir(2025, o.gecenYil, t, d25), satir(2026, o.gecenYil, t, d25), satir(2027, o.gecenYil, t, d25)];
}

/* 2027 kalıntısının aralığı: üç Ocak senaryosu, Temmuz uçları, 2024 ve 2025 dosya artışı. */
function aralik() {
  var o = ocakSenaryolari(), hepsi = [];
  [o.ovp, o.gecenYil, o.hiz].forEach(function (z) {
    TEMMUZ_ARALIK.concat(temmuzMerkez()).forEach(function (t) {
      [dosyaArtisi(2025), dosyaArtisi(2024)].forEach(function (d) { hepsi.push(satir(2027, z, t, d)); });
    });
  });
  hepsi.sort(function (a, b) { return a.kalintiTl - b.kalintiTl; });
  return { alt: hepsi[0], ust: hepsi[hepsi.length - 1], adet: hepsi.length };
}

/* Ayda 1.000 TL'nin bir yıllık maliyeti, milyon TL (2025 sonu dosya sayısıyla). */
function seyyanenMaliyeti() { return SEYYANEN * 12 * dosya(2025) / 1e6; }

/* Dosya başına ortalama: 2026 ödemesi ve Ocak 2027 seviyesine taşınmışı. */
function ortalama() {
  var o = ocakSenaryolari(), L = seviyeler(o.gecenYil, temmuzMerkez());
  var y2026 = odeme(2026) * 1e6 / 12 / dosya(2025);
  var ocak = y2026 * L["2027-1"] / yilOrtalamasi(L, 2026);
  return { y2026: y2026, ocak: ocak, esdegerOran: SEYYANEN / ocak };
}

/* Aralık'ta toplam aylığı A olan dosyanın Ocak'ta yasal zamın üstüne alacağı ek tutar. */
function ekler(A) {
  var z = ocakSenaryolari().gecenYil, e = ortalama().esdegerOran, T0 = TB.BUGUNKU_TABAN;
  var kendi = A * (1 + z), yasal = Math.max(kendi, T0);
  return {
    aralik: Math.max(A, T0), yasal: yasal,
    seyyanen: SEYYANEN,
    oran: Math.max(kendi * (1 + e), T0) - yasal,
    taban: Math.max(kendi, T0 * (1 + z)) - yasal
  };
}

function butce() {
  var b = V.bakanlik;
  return { toplam: b.toplam, sgk: b.sgk, iskur: b.iskur, merkez: b.merkez,
    sgkPay: b.sgk / b.toplam, iskurPay: b.iskur / b.toplam, merkezPay: b.merkez / b.toplam,
    programTransfer: P.sgk.butceTransferi[3], sgkTransferPay: b.sgk / 1000 / P.sgk.butceTransferi[3] };
}

module.exports = {
  P: P, V: V, TB: TB, SEYYANEN: SEYYANEN, TEMMUZ_ARALIK: TEMMUZ_ARALIK,
  ocakSenaryolari: ocakSenaryolari, temmuzMerkez: temmuzMerkez, dosya: dosya, dosyaArtisi: dosyaArtisi,
  ayristirma: ayristirma, aralik: aralik, seyyanenMaliyeti: seyyanenMaliyeti, ortalama: ortalama,
  ekler: ekler, butce: butce
};
