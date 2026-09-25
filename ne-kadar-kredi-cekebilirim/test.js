#!/usr/bin/env node
/*
 * Ne kadar kredi çekebilirim — sayfadaki SSS rakamları.
 *
 * Kullanım: node ne-kadar-kredi-cekebilirim/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var L = require(path.join(S.KOK, "finans", "kredi-limiti.js"));
var t = S.yazi(__dirname);

var r = L.hesapla({ gelir: 60000, pay: 0.4, mevcut: 4000, aylikFaiz: 3.99, vade: 36, tur: "ihtiyac" });
t.gecsin("bütçe", "bütçe " + S.tl(r.girdi.taksit) + " TL olur");
t.gecsin("tutar", "çekilebilecek tutar " + S.tam(r.anapara) + " TL");
t.gecsin("taksit", "taksit " + S.tl(r.plan.taksit) + " TL");
t.gecsin("toplam", "toplam geri ödeme " + S.tl(r.plan.toplamGeriOdeme) + " TL");
t.gecsin("bir puan", "aynı taksitle " + S.tam(r.faizBirPuanDusuk) + " TL daha fazla");
t.dogru("taksit bütçeyi aşmaz", r.plan.taksit <= r.girdi.taksit);
t.bitir();
