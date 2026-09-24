#!/usr/bin/env node
/*
 * "Torba yasada ne var, ne yok?" yazısının sayıları.
 *
 * Yazının yasama durumu iddialarını tools/mevzuat-testi.js denetliyor.
 * Bu test, yazının sitedeki başka veri kaynaklarıyla paylaştığı rakamları
 * bağlıyor. Aynı rakamı iki yerde elle tutmak sessiz ayrışma üretir:
 *  - en düşük emekli aylığı: bordro/emeklilik-parametreleri.js
 *    (emekli aylığı aracı ve zam araçları buradan okuyor)
 *  - memur toplu sözleşme oranları: finans/toplu-sozlesme.js
 *    (memur zammı aracı buradan okuyor)
 *
 * Kullanım: node makaleler/torba-yasa-ne-var-ne-yok/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var EP = require(path.join(S.KOK, "bordro", "emeklilik-parametreleri.js"));
var TS = require(path.join(S.KOK, "finans", "toplu-sozlesme.js"));
var t = S.yazi(__dirname);

var yeni = EP.altSinirAylik("2026-07-01"), eski = EP.altSinirAylik("2026-06-30");
t.dogru("alt sınır Temmuz 2026'da değişti", yeni.gecerli === "2026-07-01" && eski.tutar !== yeni.tutar);
t.gecsin("yeni en düşük aylık", "En düşük emekli aylığının " + S.tam(yeni.tutar) + " TL'ye yükselmesi");
t.gecsin("eskiden yeniye", "En düşük aylık " + S.tam(eski.tutar) + " TL'den " + S.tam(yeni.tutar) + " TL'ye çıktı");

function oran(anahtar) { return "%" + Math.round(TS.oranlar[anahtar] * 100); }
t.gecsin("2027 ilk yarı toplu sözleşme", "2027'nin ilk yarısı için oran " + oran("2027-1"));
t.gecsin("dönemin toplu sözleşme oranı", "toplu sözleşme oranı olan " + oran("2026-2"));
t.gecsin("özetteki oranlar", "2027'nin ilk yarısı için " + oran("2027-1") + " kesin, altı aylık TÜFE " + oran("2026-2"));

t.bitir();
