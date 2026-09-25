#!/usr/bin/env node
/*
 * Kira getirisi — sayfadaki SSS ve metin rakamları.
 * Girdiler sabit; vergi 2026 kira geliri parametreleriyle.
 *
 * Kullanım: node kira-getirisi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var K = require(path.join(S.KOK, "finans", "kira-getirisi.js"));
var B = require(path.join(S.KOK, "bordro", "motor.js"));
var t = S.yazi(__dirname);

var r = K.hesapla({ fiyat: 5e6, alimMasraf: 0.02, aylikKira: 20000, bosAy: 0, yillikGider: 15000, digerGelir: 0,
                    kiraArtis: 0.25, degerArtis: 0.25, mevduatFaiz: 37, sure: 10 });
function bir(n) { return n.toFixed(1).replace(".", ","); }
t.gecsin("brüt getiri", "Brüt kira getirisi %" + S.yuzde(r.brutGetiri));
t.gecsin("vergi", S.tl(r.ilkYil.vergi) + " TL kira vergisinden");
t.gecsin("net getiri", "net getiri %" + S.yuzde(r.netGetiri));
t.gecsin("amortisman", "Amortisman süresi " + bir(r.amortisman) + " yıl");
t.gecsin("dinamik amortisman", "%25 artarsa " + r.dinamikAmortisman + " yıl");
t.gecsin("mevduat neti", "stopaj sonrası %" + S.yuzde(r.mevduatNet) + " getirir");
t.gecsin("başabaş", "yılda en az %" + S.yuzde(r.basabasDegerArtis) + " değer kazanması");
var P = B.parametre(2026);
t.gecsin("istisna", "konut kira gelirinde " + S.tam(P.gmsi.meskenIstisnasi) + " TL");
t.gecsin("götürü gider oranı", "götürü giderle (%" + Math.round(P.gmsi.goturuGiderOrani * 100) + ")");
t.bitir();
