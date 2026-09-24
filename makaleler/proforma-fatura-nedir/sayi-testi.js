#!/usr/bin/env node
/*
 * "Proforma fatura nedir?" yazısının sayıları.
 *
 * Yazının tek hesabı, karışık KDV oranlı bir belgede genel iskontonun
 * nasıl dağıtılacağı: 1.000'er TL'lik %20 ve %1 KDV'li iki kalem, %10
 * genel iskonto. Doğru sonuç fatura çekirdeğinden (fatura-olusturma/
 * fatura.js) geliyor; iki yanlış yöntem de yazıda tarif edildiği gibi
 * ayrı ayrı hesaplanıyor.
 *
 * 2026-09-24: yazı "iskontonun tamamını %20'lik kalemden düşen bir araç
 * 190 TL bulur" diyordu. Tamamı 200 TL'dir; düşülünce KDV 170 TL çıkar.
 * 190, yalnız o kalemin %10'unu (100 TL) düşmenin sonucu. Düzeltildi.
 *
 * Kullanım: node makaleler/proforma-fatura-nedir/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var F = require(path.join(S.KOK, "fatura-olusturma", "fatura.js"));
var t = S.yazi(__dirname);

var KALEM = 1000, ISKONTO = 10;
var b = F.hesapla({
  kalemler: [
    { miktar: 1, birimFiyat: KALEM, kdvOran: 20, iskonto: 0 },
    { miktar: 1, birimFiyat: KALEM, kdvOran: 1, iskonto: 0 }
  ],
  genelIskontoTur: "oran", genelIskonto: ISKONTO
});

var payli = KALEM * (1 - ISKONTO / 100);
t.gecsin("toplam tutar", S.tam(2 * KALEM) + " TL'lik");
t.gecsin("doğru dağıtım", "(" + S.tam(payli) + " × %20) + (" + S.tam(payli) + " × %1) = " +
  S.tam(payli * 0.20) + " + " + S.tam(payli * 0.01) + " = " + S.tam(b.kdv) + " TL KDV");
t.gecsin("genel toplam", "Genel toplam " + S.tam(b.genelToplam) + " TL");
t.yakin("çekirdek iskontoyu oranla dağıtıyor", b.kdv, payli * 0.20 + payli * 0.01);

var eskiMatrah = KALEM * 0.20 + KALEM * 0.01;
var tamami = 2 * KALEM * ISKONTO / 100;
var tekKalem = (KALEM - tamami) * 0.20 + KALEM * 0.01;
t.gecsin("yanlış yöntem 1: eski matrah", "eski matrahtan hesaplayan bir araç " + S.tam(eskiMatrah) + " TL bulur");
t.gecsin("yanlış yöntem 2: tamamı tek kalemden", "%20'lik kalemden düşen bir araç " + S.tam(tekKalem) + " TL bulur");
t.gecmesin("bayat yanlış yöntem değeri", "kalemden düşen bir araç 190 TL");

t.bitir();
