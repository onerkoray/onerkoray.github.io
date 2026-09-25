#!/usr/bin/env node
/*
 * "Dolar mı TL mevduat mı?" yazısının sayıları.
 * Hepsi finans/doviz-basabas.js'ten; girdiler sabit örnek oranlar
 * (TL %37, döviz %1, 48,85 TL). Enflasyon karşılaştırması Ağustos 2026'ya çivili.
 *
 * Kullanım: node makaleler/dolar-mi-tl-mevduat-mi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var D = require(path.join(S.KOK, "finans", "doviz-basabas.js"));
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var t = S.yazi(__dirname);

var G = { anapara: 100000, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85 };
function h(o) { var g = {}; for (var k in G) g[k] = G[k]; for (var k2 in o) g[k2] = o[k2]; return D.hesapla(g); }
function y2(o) { return S.yuzde(o); }
function y3(o) { return (o * 100).toFixed(3).replace(".", ","); }
function k4(n) { return n.toFixed(4).replace(".", ","); }
var r = h({});

/* Giriş ve kısa cevap */
t.gecsin("giriş artış", "doların vade boyunca %" + y2(r.gerekenArtis) + "'den fazla artması gerekir");
t.gecsin("giriş yıllık", "bir yıla yayıldığında %" + y2(r.yillikArtis) + " eder");
var tufe = E.donem("2025-08", "2026-08").toplam;
t.gecsin("enflasyon", "yıllık enflasyon %" + (Math.round(tufe * 1000) / 10).toFixed(1).replace(".", ",") + "'ti");
t.dogru("kısa vadede eşik enflasyonun üstünde", r.yillikArtis > tufe);

/* Örnek hesap */
t.gecsin("TL brüt faiz", S.tl(r.tl.brut) + " TL brüt faiz");
t.gecsin("TL net faiz", "Net faiz " + S.tl(r.tl.net) + " TL");
t.gecsin("TL stopaj", "stopaj " + S.tl(r.tl.stopaj) + " TL");
t.gecsin("TL vade sonu", "vade sonunda " + S.tl(r.tl.vadeSonu) + " TL");
t.gecsin("döviz anapara", S.tl(r.doviz.anapara) + " dolar");
t.gecsin("döviz vade sonu", "vade sonunda " + S.tl(r.doviz.vadeSonu) + " dolar");
t.gecsin("başabaş", "başabaş kur " + k4(r.basabasKur) + " TL");

/* TL faizi × vade tablosu (yıllık karşılık) */
[25, 30, 37, 45].forEach(function (f) {
  var hucre = [32, 92, 182, 366].map(function (gun) { return "%" + y2(h({ tlFaiz: f, gun: gun }).yillikArtis); });
  t.gecsin("faiz satırı " + f, "%" + f + " " + hucre.join(" "));
});

/* Vade tablosu */
[32, 92, 181, 182, 365, 366, 730].forEach(function (gun) {
  var x = h({ gun: gun });
  t.gecsin("vade " + gun, gun + " gün %" + String(Math.round(x.tl.stopajOrani * 1000) / 10).replace(".", ",") + " %" + y2(x.gerekenArtis) + " %" + y2(x.yillikArtis));
});
var a365 = h({ gun: 365 }), a366 = h({ gun: 366 });
t.gecsin("bir gün farkı", "%" + y2(a365.gerekenArtis) + "'den %" + y2(a366.gerekenArtis) + "'a çıkıyor");
t.gecsin("bir gün farkı puan", (Math.round((a366.gerekenArtis - a365.gerekenArtis) * 1000) / 10).toFixed(1).replace(".", ",") + " puan");
t.dogru("uzun vadede yıllık eşik düşüyor", h({ gun: 730 }).yillikArtis < h({ gun: 366 }).yillikArtis);

/* Stopaj karşı-olgusu ve makas */
var gy = G.gun / 365, ts = r.tl.stopajOrani;
var esit = (1 + 0.37 * gy * (1 - ts)) / (1 + 0.01 * gy * (1 - ts)) - 1;
t.gecsin("eşit stopaj", "%" + y3(r.gerekenArtis) + "'dan %" + y3(esit) + "'ye");
var m = h({ makas: 0.01 });
t.gecsin("makas", "%1 makas eşiği %" + y2(m.gerekenArtis) + "'e");
var kat = (m.gerekenArtis - r.gerekenArtis) / (r.gerekenArtis - esit);
t.gecsin("eşit stopaj farkı", "yalnızca " + ((r.gerekenArtis - esit) * 100).toFixed(3).replace(".", ",") + " puan");
t.dogru("makas stopaj farkının 100 katından ağır", kat > 100, kat.toFixed(1));

/* Döviz faizi duyarlılığı */
[2, 3].forEach(function (d) {
  t.gecsin("döviz faizi " + d, "%" + d + " döviz faizinde %" + y2(h({ dovizFaiz: d }).yillikArtis));
});
t.bitir();
