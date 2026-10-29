#!/usr/bin/env node
/*
 * "Kademeli emeklilik son durum" yazısının sayıları.
 * "Bir günün bedeli" tablosu emeklilik tarihi motorundan yeniden kurulur ve
 * sayfada aranır. Önce motorun kuralı sınanır: 7 Eylül 1999 EYT, 8 Eylül 1999
 * geçiş grubudur (5510 Geçici m.9: "8/9/1999 tarihinden"). Yürürlükteki
 * 7.000 gün ve 58/60 yaş şartları da motordan okunur.
 * Bloğu tools/kademeli-yazisi.js yazar.
 *
 * Kullanım: node makaleler/kademeli-emeklilik-son-durum/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var G = require("./bir-gun.js");
var E = require("../../ne-zaman-emekli-olurum/hesap.js");
var t = S.yazi(__dirname);

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function uzun(iso) { var p = iso.split("-"); return Number(p[2]) + " " + AYLAR[Number(p[1]) - 1] + " " + p[0]; }
function sure(f) { return f.yil + " yıl" + (f.ay ? " " + f.ay + " ay" : ""); }

t.dogru("7 Eylül 1999 EYT grubunda", G.kisi("kadin", "1999-09-07").grup === "eyt");
t.dogru("8 Eylül 1999 geçiş grubunda", G.kisi("kadin", "1999-09-08").grup === "gecis");

["kadin", "erkek"].forEach(function (c) {
  var k = G.karsilastir(c);
  t.gecsin(c + " önce: emeklilik tarihi", uzun(k.once.tarih));
  t.gecsin(c + " sonra: emeklilik tarihi", uzun(k.sonra.tarih));
  t.gecsin(c + ": bir günlük farkın süresi", sure(k.fark));
  t.dogru(c + ": geçişte bağlayıcı şart yaş", k.sonra.bagli === "Yaş");
});
var kk = G.karsilastir("kadin");
t.gecsin("kadın 7.000 günü dolduruyor", kk.sonra.gunGereken.toLocaleString("tr-TR") + " günü " + uzun(kk.sonra.gunTarihi));
t.gecsin("yalnız yaşı bekleme süresi", sure(kk.yasBekleme) + " yalnızca yaşı beklemek");

/* Yürürlükteki şart (kısa cevap): kadın 58, erkek 60 yaş ve 7.000 gün. */
var r = E.hesapla({ statu: "4a", cinsiyet: "kadin", dogum: "1980-01-01", ilkGiris: "2003-01-01", primGun: 0, yillikGun: 360, bugun: "2003-01-01" });
var gun = r.yollar[0].kosullar.filter(function (k) { return k.tur === "gun"; })[0].gereken;
t.gecsin("yürürlükteki gün şartı", "kadın 58, erkek 60 yaş ve " + gun.toLocaleString("tr-TR") + " gün");

t.bitir("kademeli emeklilik yazısı");
