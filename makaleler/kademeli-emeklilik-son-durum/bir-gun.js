/*!
 * "Bir günün bedeli" — 7 Eylül ve 8 Eylül 1999'da sigortalı olan iki kişinin
 * emeklilik tarihi, emeklilik tarihi motorundan (ne-zaman-emekli-olurum).
 *
 * Varsayım: 1 Eylül 1979 doğum, 20 yaşında giriş, kesintisiz yılda 360 gün,
 * borçlanma yok, 4/a. Motor "bugün" olarak giriş gününü alır; böylece geçmişte
 * kalan tarihler "bugün"e yuvarlanmaz, gerçek gün okunur.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var E = require("../../ne-zaman-emekli-olurum/hesap.js");

var DOGUM = "1979-09-01";
var GIRISLER = [E.yardimci.ekle(E.sinirlar.eyt, 0, 0, -1), E.sinirlar.eyt]; // 1999-09-07, 1999-09-08
var YILLIK_GUN = 360;

function kisi(cinsiyet, giris) {
  var r = E.hesapla({ statu: "4a", cinsiyet: cinsiyet, dogum: DOGUM, ilkGiris: giris, primGun: 0, yillikGun: YILLIK_GUN, bugun: giris });
  var yol = r.enErken;
  var gun = yol.kosullar.filter(function (k) { return k.tur === "gun"; })[0];
  return { cinsiyet: cinsiyet, giris: giris, grup: r.grup, tarih: r.tarih, yol: yol.ad, bagli: yol.bagli,
    gunGereken: gun.gereken, gunTarihi: gun.tarih };
}

function karsilastir(cinsiyet) {
  var once = kisi(cinsiyet, GIRISLER[0]), sonra = kisi(cinsiyet, GIRISLER[1]);
  return { once: once, sonra: sonra, fark: E.yardimci.fark(once.tarih, sonra.tarih),
    yasBekleme: E.yardimci.fark(sonra.gunTarihi, sonra.tarih) };
}

module.exports = { DOGUM: DOGUM, GIRISLER: GIRISLER, YILLIK_GUN: YILLIK_GUN, kisi: kisi, karsilastir: karsilastir };
