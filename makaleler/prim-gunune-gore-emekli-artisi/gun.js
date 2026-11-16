/*
 * "Prim gününe göre emekli artışı" yazısının hesabı.
 *
 * İki kaynak:
 *   1. Kanunun aradığı en az prim günü, ilk sigorta girişine göre: sitenin
 *      emeklilik tarihi çekirdeği (ne-zaman-emekli-olurum/hesap.js; 506
 *      Geçici m.81/B ve C, 5510 Geçici m.9, m.28).
 *   2. SGK İstatistik Yıllığı 2025 yaş tablosu (yaş yazısıyla aynı dosya).
 *      1999 sonrası girişlinin yaşlılık aylığı için en az yaş 58 (kadın) /
 *      60 (erkek); 2025 sonunda bu yaşın altında aylık alan 4/a emeklisi bu
 *      kurallarla bağlanmış olamaz; istisna özel hükümlerdir (engelli
 *      sigortalı, yeraltı maden, erken yaşlanma, fiili hizmet zammı). Onlar
 *      sayıya karışır, ayrıştırılamaz: sayı bir tahmindir, alt sınır değil.
 *
 * Tasarımlar VARSAYIMSALDIR: düzenlemenin metni yok.
 */
"use strict";

var H = require("../../ne-zaman-emekli-olurum/hesap.js");
var V = require("../emekli-yas-haritasi-2025/yas-2025.json");

var BUGUN = "2026-11-16";
var YAS_SINIRI = { kadin: 58, erkek: 60 };   // 5510 Geçici m.9/1 ve m.28/2: en erken yaş
var ESIK = 7200;                            // varsayımsal tasarımın gün eşiği: bugünkü 4/a tam aylık şartı

/* Bir giriş tarihi için 4/a tam aylığın aradığı en az prim günü ve dayanağı.
   Kişi girişte 20 yaşında varsayılır (18 yaş kuralı devreye girmesin). */
function gerekenGun(giris, cinsiyet) {
  var dogum = (+giris.slice(0, 4) - 20) + giris.slice(4);
  var r = H.hesapla({ dogum: dogum, ilkGiris: giris, cinsiyet: cinsiyet, statu: "4a", primGun: 0, yillikGun: 360, bugun: BUGUN });
  var tam = r.yollar.filter(function (y) { return y.kod === "tam"; })[0];
  var g = tam.kosullar.filter(function (k) { return k.tur === "gun"; })[0].gereken;
  var kismi = r.yollar.filter(function (y) { return y.kod === "kismi"; })[0];
  var kg = kismi ? kismi.kosullar.filter(function (k) { return k.tur === "gun"; })[0].gereken : null;
  return { giris: giris, cinsiyet: cinsiyet, grup: r.grup, tam: g, dayanak: tam.dayanak, kismi: kg };
}

/* Yıl yıl seri: her yılın 1 Haziran girişi; sınırların iki yanı ayrıca. */
function seri(cinsiyet, y0, y1) {
  var d = [];
  for (var y = y0; y <= y1; y++) d.push(gerekenGun(y + "-06-01", cinsiyet));
  return d;
}
function sinirlar() {
  return ["1999-09-07", "1999-09-08", "2008-04-30", "2008-05-01"].map(function (t) {
    return { kadin: gerekenGun(t, "kadin"), erkek: gerekenGun(t, "erkek") };
  });
}

/* 2025 sonunda yaş sınırının altında yaşlılık aylığı alanlar. */
function yasAlti(kapsam) {
  var e = 0, k = 0, n = 0;
  for (var y = 0; y <= 100; y++) {
    n += V[kapsam].erkek[y] + V[kapsam].kadin[y];
    if (y < YAS_SINIRI.erkek) e += V[kapsam].erkek[y];
    if (y < YAS_SINIRI.kadin) k += V[kapsam].kadin[y];
  }
  return { erkek: e, kadin: k, toplam: e + k, kapsamToplam: n, pay: (e + k) / n };
}

/* 1 Mayıs 2008 girişli, yılda 360 gün ödese 7.200 güne hangi gün ulaşır? */
function ilk7200() { return H.yardimci.gunTarihi(0, 7200, 360, "2008-05-01").tarih; }

/* Varsayımsal eşik: kanunun en azını ödeyip emekli olan biri eşiğin
   neresinde kalır? (gereken − eşik; eksi = eşiğin altında) */
function esikFarki(giris, cinsiyet) { return gerekenGun(giris, cinsiyet).tam - ESIK; }

module.exports = {
  BUGUN: BUGUN, YAS_SINIRI: YAS_SINIRI, ESIK: ESIK, tablolar: H.tablolar,
  gerekenGun: gerekenGun, ilk7200: ilk7200, seri: seri, sinirlar: sinirlar, yasAlti: yasAlti, esikFarki: esikFarki
};
