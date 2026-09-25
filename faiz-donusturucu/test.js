#!/usr/bin/env node
/*
 * Faiz dönüştürücü — sayfadaki SSS rakamları.
 *
 * Kullanım: node faiz-donusturucu/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var Z = require(path.join(S.KOK, "finans", "faiz-donustur.js"));
var t = S.yazi(__dirname);

var d = Z.donustur(0.03, "aylik");
t.gecsin("yıllık basit", "yıllık %" + S.yuzde(d.yillikBasit) + ", bileşik hesapla %" + S.yuzde(d.yillikBilesik));
t.gecsin("ikiye katlanma", "para " + d.ikiyeKatlanmaYil.toFixed(2).replace(".", ",") + " yılda ikiye katlanır");
var k = Z.kredi(0.0399, "ihtiyac");
t.gecsin("kredi aylık maliyet", "aylık maliyet %" + S.yuzde(k.aylikMaliyet, 3) + " olur");
t.gecsin("kredi yıllık bileşik", "yıllık bileşik karşılığı %" + S.yuzde(k.yillikBilesik));
t.gecsin("vergi payı", "Maliyetin %" + S.yuzde(k.vergiPayi) + "'i vergidir");
var m32 = Z.mevduat(0.37, 32), m365 = Z.mevduat(0.37, 365);
t.gecsin("32 gün", "yıllık bileşik net getiri %" + S.yuzde(m32.yillikNetBilesik));
t.gecsin("365 gün", "net getiri %" + S.yuzde(m365.yillikNetBilesik));
t.dogru("32 gün stopajı %17,5", m32.stopajOrani === 0.175);
t.dogru("365 gün stopajı %15", m365.stopajOrani === 0.15);
t.bitir();
