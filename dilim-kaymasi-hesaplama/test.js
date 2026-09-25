#!/usr/bin/env node
/*
 * Dilim kayması hesaplama — sayfadaki sabit sayılar.
 *
 * Motorun kendisini bordro/dilim-kaymasi-test.js sınıyor. Bu test sayfanın
 * DÜZYAZISINI koruyor: SSS ve yöntem bölümündeki oranlar ve örnek tutar
 * motordan, parametrelerden ve yeniden değerleme yazısının denetiminden
 * yeniden üretiliyor. 2027 tarifesi girildiğinde bu cümleler 2026'ya
 * çivili kalır ve doğru kalır; yeni yıl için güncellenmeleri bilinçli bir
 * iş olmalı (sayfadaki gecerlilik bildirimi bunu hatırlatıyor).
 *
 * Kullanım: node dilim-kaymasi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var B = S.bordro();
var D = require(path.join(S.KOK, "bordro", "dilim-kaymasi.js"));
var SERI = require(path.join(S.KOK, "finans", "endeksleme-serileri.js"));
var YDO = require(path.join(S.KOK, "makaleler", "yeniden-degerleme-orani-nedir", "ydo.js"));
var t = S.yazi(__dirname);

var YIL = 2026, P = B.parametre(YIL), P0 = B.parametre(YIL - 1);

/* Tarife oranları yöntem bölümünde. */
t.gecsin("tarife oranları", "(" + P.dilimler.map(function (d) { return "%" + Math.round(d[1] * 100); }).join(", ") + ")");

/* SSS: ikinci eşiğin artışı, YDO ve TÜFE. */
t.gecsin("ikinci eşik artışı", "%" + S.yuzde(P.dilimler[1][0] / P0.dilimler[1][0] - 1) + " arttı");
t.gecsin("yeniden değerleme oranı", "yeniden değerleme oranı %" + String(SERI.SERI[YIL].ydo).replace(".", ","));
t.gecsin("tüketici enflasyonu", "tüketici enflasyonu %" + String(SERI.SERI[YIL].tufe).replace(".", ","));

/* SSS: kesir payı ve "dört eşiğin dördü". */
var den = YDO.tarifeDenetimi(YIL).dilimler;
var uygun = den.filter(function (d) { return d.uygun; }).length;
var yazili = ["sıfırı", "biri", "ikisi", "üçü", "dördü", "beşi"];
var sayi = ["", "bir", "iki", "üç", "dört", "beş"];
t.gecsin("kesir payı", "%" + Math.round(YDO.KESIR_PAYI * 100) + "'e kadar kesrini");
t.gecsin("kurala uygun eşik sayısı", sayi[den.length] + " eşiğin " + yazili[uygun] + " de bu payın içindedir");
t.dogru("bütün eşikler kurala uygun", uygun === den.length);

/* SSS: 100.000 TL örneği, yasal ölçüt, bir önceki yıldan. */
var r = D.hesapla({ brut: 100000, yil: YIL, baz: YIL - 1, olcut: "ydo" });
t.gecsin("örnek tutar", "yılda " + S.tl(r.fark) + " TL daha az gelir vergisi");
var tek = r.esikler.filter(function (e) { return Math.abs(e.katki) > 0.005; });
t.dogru("örnekte farkın tamamı ikinci eşikten", tek.length === 1 && tek[0].sira === 2);

t.bitir();
