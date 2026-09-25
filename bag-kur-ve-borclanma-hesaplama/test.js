#!/usr/bin/env node
/*
 * Bağ-Kur ve borçlanma — sayfadaki SSS ve metin rakamları, 2026'ya çivili.
 *
 * Kullanım: node bag-kur-ve-borclanma-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var P = require(path.join(S.KOK, "bordro", "sgk-prim.js"));
var t = S.yazi(__dirname);

var YIL = 2026, s = P.sinirlar(YIL);
var bAlt = P.bagkur(s.aylikAlt, YIL), bUst = P.bagkur(s.aylikUst, YIL);
t.gecsin("Bağ-Kur en düşük", "%35,75 ile " + S.tl(bAlt.prim) + " TL");
t.gecsin("Bağ-Kur indirimli", "5 puanlık indirimle " + S.tl(bAlt.indirimli) + " TL");
t.gecsin("Bağ-Kur en yüksek", "tavandan " + S.tl(bUst.prim) + " TL");
t.dogru("oran metinle aynı", bAlt.oran === 0.3575 && bAlt.indirimliOran === 0.3075);
t.gecsin("isteğe bağlı", "en düşük " + S.tl(P.istegeBagli(s.aylikAlt, YIL).prim) + " TL, en yüksek " + S.tl(P.istegeBagli(s.aylikUst, YIL).prim) + " TL");
var ask = P.borclanma(1, s.gunlukAlt, "genel", YIL), dog = P.borclanma(1, s.gunlukAlt, "dogum", YIL);
t.gecsin("askerlik günlük", "günü " + S.tl(ask.gunluk) + " TL");
t.gecsin("540 gün", "540 günlük askerlik için en az " + S.tl(P.borclanma(540, s.gunlukAlt, "genel", YIL).toplam) + " TL");
t.gecsin("doğum günlük", "günü en az " + S.tl(dog.gunluk) + " TL");
var g = P.gss(s.aylikAlt, YIL);
t.gecsin("GSS", "ayda " + S.tl(g.prim) + " TL (asgari ücretin %6'sı)");
t.gecsin("GSS metin", "prim her ay " + S.tl(g.prim) + " TL");
t.gecsin("GSS eşiği", "(2026'da " + S.tam(g.esik) + " TL)");
t.gecsin("alt sınır", "Kazanç " + S.tam(s.aylikAlt) + " TL ile " + S.tam(s.aylikUst) + " TL");
t.bitir();
