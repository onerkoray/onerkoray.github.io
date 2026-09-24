#!/usr/bin/env node
/*
 * "Maaşım neden düştü?" yazısının düzyazıdaki sayıları.
 *
 * İki tabloyu tools/bordro-tablo.js yazıyor. Bu test üreteçten geçmeyen
 * cümleleri bağlıyor:
 *  - 2026 ücret tarifesinin dilim sınırları ve oranları (parametreler)
 *  - asgari ücretlinin aylık matrahı ve ilk dilimi hangi ayda aştığı
 *  - 80.000 TL brütte Temmuz→Ağustos net artışı ve istisnanın büyümesi
 *  - "taranan 5.670 brüt ücretin %8,1'i": bu sonuç kardeş yazının
 *    taramasından (yilin-en-dusuk-maasi-hangi-ay/dip-ay.js) geliyor.
 *    Burada elle kopyalanmıştı; tarama değişirse iki yazı çelişirdi.
 *
 * Kullanım: node makaleler/maasim-neden-dustu/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var D = require(path.join(S.KOK, "makaleler", "yilin-en-dusuk-maasi-hangi-ay", "dip-ay.js"));
var t = S.yazi(__dirname);

var YIL = 2026, P = B.parametre(YIL);

/* Tarife cümlesi, parametrelerin dilimlerinden kuruluyor. */
var parca = P.dilimler.map(function (d) {
  return d[0] === null ? "üzeri %" + Math.round(d[1] * 100)
    : S.tam(d[0]) + " TL'ye kadar %" + Math.round(d[1] * 100);
});
t.gecsin("2026 ücret tarifesi", "2026 ücret tarifesi: " + parca.join("; "));
t.gecsin("SGK işçi payı", "SGK işçi payı (%" + Math.round(P.oranlar.sgkIsci * 100) + ")");
t.gecsin("işsizlik işçi payı", "işsizlik sigortası işçi payı (%" + Math.round(P.oranlar.issizlikIsci * 100) + ")");

/* Asgari ücretlinin matrahı ve ilk dilimi aştığı ay. */
var asgari = B.donem(P, 1).asgariBrut;
var matrah = asgari * (1 - P.oranlar.sgkIsci - P.oranlar.issizlikIsci);
var ilkSinir = P.dilimler[0][0], ay = Math.ceil(ilkSinir / matrah);
var yazili = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on", "on bir", "on iki"];
t.gecsin("asgari ücretlinin matrahı", "aylık matrahı " + S.tl(matrah));
t.gecsin("ilk dilimi aştığı ay", yazili[ay] + " ayda birikimi " + S.tam(ilkSinir) + " TL'lik ilk dilim");
t.gecsin("istisnanın geçtiği oran", "istisnanın kendisi %" + Math.round(P.dilimler[1][1] * 100) + " oranından");
t.gecsin("asgari brüt", "brüt " + S.tl(asgari) + " TL alan bir asgari ücretlinin");

/* 80.000 TL brütte Ağustos artışı. */
var y = B.hesaplaYil(80000, YIL), tem = y.aylar[6], agu = y.aylar[7];
t.dogru("artış Ağustos'ta", agu.net > tem.net);
t.gecsin("girişteki yuvarlanmış artış", "Ağustos ayında yaklaşık " + S.tam(agu.net - tem.net) + " TL");
t.gecsin("artışın tamı", "Aradaki " + S.tl(agu.net - tem.net) + " TL");
t.yakin("artışın tamamı istisnadan", agu.net - tem.net, agu.istisna - tem.istisna, 0.01);

/* Kardeş yazının taraması. */
t.gecsin("tarama genişliği", "Taranan " + D.tarama().length.toLocaleString("tr-TR") + " brüt ücretin");
t.gecsin("hiç yükselmeyenlerin payı", "%" + D.tekduzeYuzde().toFixed(1).replace(".", ",") + "’inde net yıl boyunca");

t.bitir();
