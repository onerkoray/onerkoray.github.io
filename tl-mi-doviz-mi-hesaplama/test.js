#!/usr/bin/env node
/*
 * TL mi döviz mi — sayfadaki SSS örnekleri.
 * Girdiler sabit (100.000 TL, %37, %1, 32 gün, 48,85); serilere bağlı değil.
 *
 * Kullanım: node tl-mi-doviz-mi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var D = require(path.join(S.KOK, "finans", "doviz-basabas.js"));
var t = S.yazi(__dirname);

var G = { anapara: 100000, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85 };
var r = D.hesapla(G);
function k4(n) { return n.toFixed(4).replace(".", ","); }
function yz3(o) { return (o * 100).toFixed(3).replace(".", ","); }

t.gecsin("TL yolu", "TL yolu vade sonunda " + S.tl(r.tl.vadeSonu) + " TL bırakır");
t.gecsin("başabaş kur", "kurun " + k4(r.basabasKur) + " TL'yi, yani %" + S.yuzde(r.gerekenArtis) + " artışı");
t.gecsin("yıllık", "yıllık %" + S.yuzde(r.yillikArtis) + "'lük kur artışına");

/* Eşit stopaj karşı-olgusu: döviz stopajı TL'ninkine eşit olsaydı. */
var ts = r.tl.stopajOrani, gy = G.gun / 365;
var esit = (1 + 0.37 * gy * (1 - ts)) / (1 + 0.01 * gy * (1 - ts)) - 1;
t.gecsin("stopaj karşı-olgusu", "yüzde " + yz3(r.gerekenArtis) + "'dan " + yz3(esit) + "'ye inerdi");

var m = D.hesapla({ anapara: 100000, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85, makas: 0.01 });
t.gecsin("makaslı başabaş", "başabaş kur " + S.tl(m.basabasKur) + " TL'ye, gereken artış %" + S.yuzde(m.gerekenArtis) + "'e");
t.bitir();
