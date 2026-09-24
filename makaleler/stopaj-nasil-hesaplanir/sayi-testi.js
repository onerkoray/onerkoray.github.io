#!/usr/bin/env node
/*
 * "Stopaj nasıl hesaplanır?" yazısının sayıları.
 *
 * İki şey denetleniyor:
 *  1. Brütleştirme tablosu: net ÷ (1 − oran) ile yanlış yöntem
 *     net × (1 + oran) arasındaki fark, dört oranda.
 *  2. Yazının kendi iddiası: "Aşağıdaki oranlar bu sitenin kendi hesap
 *     çekirdeklerinde kullanılan ve test edilen değerlerdir." Bu cümle
 *     ancak oranlar gerçekten o çekirdeklerden okunursa doğru kalır.
 *     Çekirdekte oran değişir de yazı değişmezse test kırmızıya döner.
 *
 * Kullanım: node makaleler/stopaj-nasil-hesaplanir/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var P = S.parametreler();
var BES = require(path.join(S.KOK, "birikim-hesaplama", "hesap.js"));
var t = S.yazi(__dirname);

var NET = 10000;

/* 1. Brütleştirme tablosu. */
[0.10, 0.15, 0.20, 0.25].forEach(function (o) {
  var brut = S.kurus(NET / (1 - o));
  var yanlis = NET * (1 + o);
  var eksik = NET - yanlis * (1 - o);
  var satir = "%" + Math.round(o * 100) + " " + S.tl(brut) + " TL " + S.tl(brut - NET) + " TL " +
    S.tl(yanlis) + " TL " + S.tl(eksik) + " TL";
  t.gecsin("tablo satırı %" + Math.round(o * 100), satir);
});

/* Metindeki %20 örneği ve girişteki özet. */
var o20 = 0.20, brut20 = NET / (1 - o20), yanlis20 = NET * (1 + o20);
t.gecsin("doğru brüt", "doğrusu " + S.tam(brut20) + " TL");
t.gecsin("yanlış brüt", S.tam(yanlis20) + " TL brüt yazar");
t.gecsin("eksik kalan", "Aradaki " + S.tam(NET - yanlis20 * (1 - o20)) + " TL");
t.gecsin("yanlış yöntemin stopajı", "stopajı " + S.tam(yanlis20 * o20) + " TL");
t.gecsin("yanlış yöntemde ele geçen", "eliniz " + S.tam(yanlis20 * (1 - o20)) + " TL");
t.gecsin("bölme", S.tam(NET) + " ÷ 0,80 = " + S.tam(brut20) + " TL");

/* Yıl sonu mahsup örneği: 12 × 12.500 TL makbuz. */
var yillik = 12 * brut20, kesilen = yillik * o20;
t.gecsin("yıllık hasılat", S.tl(yillik) + " TL");
t.gecsin("yıllık stopaj", S.tl(kesilen) + " TL");
t.gecsin("yıllık ele geçen", S.tl(yillik - kesilen) + " TL");
t.gecsin("mahsup satırı", "hesaplanan vergi − " + S.tam(kesilen) + " TL");

/* 2. Oranlar çekirdeklerden. */
var sirket = P[2026].sirket;
function oranVar(ad, oran, dayanak) {
  t.gecsin(ad, "%" + Math.round(oran * 100) + " " + dayanak);
}
oranVar("serbest meslek stopajı (bordro/parametreler)", sirket.serbestMeslekStopaji, "GVK m.94");
oranVar("kâr payı stopajı (bordro/parametreler)", sirket.karPayiStopaji, "GVK m.94/6-b");
oranVar("BES erken çıkış (birikim çekirdeği)", BES.VARSAYILAN.stopaj.erken / 100, "GVK m.94 Nihai");
oranVar("BES 10 yıl (birikim çekirdeği)", BES.VARSAYILAN.stopaj.onYil / 100, "GVK m.94 Nihai");
oranVar("BES emeklilik (birikim çekirdeği)", BES.VARSAYILAN.stopaj.emeklilik / 100, "GVK m.94 Nihai");
t.gecsin("BES emeklilik koşulu", "(" + BES.VARSAYILAN.emeklilikYas + " yaş + " + BES.VARSAYILAN.emeklilikYil + " yıl)");

t.bitir();
