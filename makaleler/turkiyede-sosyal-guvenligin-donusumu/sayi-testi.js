#!/usr/bin/env node
/*
 * "Türkiye'de sosyal güvenliğin dönüşümü" yazısının sayıları.
 * Model ve sayılar yazının modülünden (donusum.js) gelir; modül sitenin
 * emeklilik çekirdeklerini kullanır. Test, çekirdeğe güvenmeden kanun
 * metninden bağımsız aritmetik kurar ve modülü onunla sınar:
 *   - 506 Geçici m.81/B (4759 ile): 23.5.2002'de süresi 18 yıl ve üstü kadın
 *     40 yaş; altında her eksik yıl bir yaş ekler (17 yıl 41 … 3 yıl 55);
 *     kadın 20, erkek 25 yıl sigortalılık; en az 5000 gün.
 *   - 5510 Geçici m.9: 1999–2008 girişlisi kadın 58, erkek 60 yaş ve 7000 gün.
 *   - 5510 m.28/2: 7200 gün; yaş, günün dolduğu tarihe göre 2036–37 59/61,
 *     2038–39 60/62, 2040–41 61/63, 2042–43 62/64, 2044–45 63/65,
 *     2046–47 64/65, 2048 ve sonrası 65/65.
 *   - 506 Geçici m.82 ve 5510 m.29 aylık bağlama oranları.
 * Sonra her rakamın sayfada göründüğünü doğrular.
 *
 * Kullanım: node makaleler/turkiyede-sosyal-guvenligin-donusumu/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var D = require("./donusum.js");
var G = require("../../tools/sosyal-guvenlik-yazisi.js");
var t = S.yazi(__dirname);
function htmlde(ad, x) { t.dogru(ad, t.html.indexOf(x) !== -1, "HTML'de yok: " + x); }

var K = D.seri("kadin"), E = D.seri("erkek");
function bul(Sr, y) { return Sr.filter(function (k) { return k.giris === y + "-01-01"; })[0]; }

/* 1 — Kanun metninden bağımsız beklenen tam emeklilik yaşı. */
function m28Yasi(yil, kadin) {
  var T = [[2036, 59, 61], [2038, 60, 62], [2040, 61, 63], [2042, 62, 64], [2044, 63, 65], [2046, 64, 65], [2048, 65, 65]];
  var y = kadin ? 58 : 60;
  T.forEach(function (r) { if (yil >= r[0]) y = kadin ? r[1] : r[2]; });
  return y;
}
function beklenen(giris, kadin) {
  var Y = +giris.slice(0, 4);
  if (giris < "1999-09-08") return kadin ? 20 + 20 : 20 + 25;       // süre şartı bağlayıcı; 5000–5975 gün 14–17 yılda dolar
  if (giris <= "2008-04-30") return kadin ? 58 : 60;                 // 7000 gün 19,4 yılda dolar, yaş bağlayıcı
  return Math.max(kadin ? 58 : 60, m28Yasi(Y + 20, kadin));          // 7200 gün 20 yılda dolar
}
D.YILLAR.forEach(function (y) {
  var g = y + "-01-01";
  t.yakin("kadın " + y, bul(K, y).yas, beklenen(g, true), 0);
  t.yakin("erkek " + y, bul(E, y).yas, beklenen(g, false), 0);
});
var ek = D.esikler("kadin"), ee = D.esikler("erkek");
t.yakin("7 Eylül 1999 kadın 40", ek.eyt[0].yas, 40, 0);
t.yakin("8 Eylül 1999 kadın 58", ek.eyt[1].yas, 58, 0);
t.yakin("8 Eylül 1999 erkek 60", ee.eyt[1].yas, 60, 0);
t.yakin("2008 eşiği kesintisiz çalışanda görünmez", ek.yeni[1].yas - ek.yeni[0].yas, 0, 0);

/* Prim yılı = emeklilik yaşı − 20; prim günü = yıl × 360. */
K.concat(E).forEach(function (k) {
  t.yakin("prim yılı " + k.giris + " " + k.cinsiyet, k.calisma, k.yas - 20, 0.01);
  t.yakin("prim günü " + k.giris + " " + k.cinsiyet, k.primGun, Math.round(k.calisma * 360), 0);
});

/* 2 — 2023 öncesi kural (81/B yaş sütunu): kadın 58 − süre (süre < 18), 18+ ise 40. */
function eytOncesiKadin(giris) {
  var b = Date.parse("2002-05-23"), s = Date.parse(giris);
  var sure = Math.floor((b - s) / (365.2425 * 864e5));
  return Math.max(40, sure >= 18 ? 40 : 58 - sure);
}
K.filter(function (k) { return k.eytOncesi; }).forEach(function (k) {
  t.yakin("2023 öncesi kadın " + k.giris, k.eytOncesi.yas, eytOncesiKadin(k.giris), 0);
});

/* 3 — ABO, kural metninden. */
function g82(g) { var a = Math.min(g, 3600) / 360 * 0.035; if (g > 3600) a += Math.min(g - 3600, 5400) / 360 * 0.02; if (g > 9000) a += (g - 9000) / 360 * 0.015; return a; }
function m29(g) { return Math.min(0.9, g / 360 * 0.02); }
D.ABO_GUNLERI.forEach(function (g) {
  var a = D.abo(g);
  t.yakin("ABO eski " + g, a.gecici82, g82(g), 1e-12);
  t.yakin("ABO bugünkü " + g, a.m29, m29(g), 1e-12);
});
t.yakin("3.600 günden sonra fark 15 puan", D.abo(9000).gecici82 - D.abo(9000).m29, 0.15, 1e-12);
/* Fiili ABO, kısmî aylık: Σ ABO_kural(toplam gün) × dönem payı. */
var k25 = bul(K, 2025), e25 = bul(E, 2025), k00 = bul(K, 2000);
t.yakin("2025 kadın fiili ABO (yalnız m.29)", D.fiiliAbo(k25), m29(k25.primGun), 1e-9);
t.yakin("2025 erkek tavanda", D.fiiliAbo(e25), 0.9, 1e-9);
t.dogru("2000 kadın fiili ABO iki kuralın arasında", D.fiiliAbo(k00) > m29(k00.primGun) && D.fiiliAbo(k00) < g82(k00.primGun));
t.dogru("1999 öncesi girişte oran hesaplanmaz (gösterge)", D.fiiliAbo(bul(K, 1995)) === null);

/* 4 — Nüfus anlık görüntüsü. */
var dep = D.DB.bagimlilik.seri;
t.dogru("bağımlılık serisi 1960–2025", dep[0][0] === 1960 && dep[dep.length - 1][0] === 2025);
t.dogru("1965–1999 yatay bant (< 1 puan)", Math.abs(D.nufus("bagimlilik", 1999) - D.nufus("bagimlilik", 1965)) < 1);
t.dogru("2025 değeri 1999'un 1,5 katından fazla", D.nufus("bagimlilik", 2025) > 1.5 * D.nufus("bagimlilik", 1999));

/* 5 — Sayfadaki her alan modülün değeri. */
var A = G.alanlar();
Object.keys(A).forEach(function (k) {
  t.dogru("alan " + k, new RegExp('data-s="' + k + '">' + A[k].replace(/[.*+?^${}()|[\]\\%]/g, "\\$&") + "<").test(t.html), "sayfada farklı: " + k + " = " + A[k]);
});
t.gecsin("18 yıllık fark", "18 yıllık emeklilik farkı");
t.gecsin("kademe 2016", "2016 ve sonrasında başlayan");
t.gecsin("9.000 gün", "9.000 gün, 2000–2008 kuralıyla kazancın %65");

/* 6 — Kapak alt metni. */
htmlde("kapak", "8 Eylül 1999 öncesi kadın 40, erkek 45; 8 Eylül 1999'dan itibaren 58 ve 60; 2025 girişi 63 ve 65");

t.bitir("Kadın " + ek.eyt[0].yas + "→" + ek.eyt[1].yas + "→" + k25.yas + ", erkek " + ee.eyt[0].yas + "→" + ee.eyt[1].yas + "→" + e25.yas + "; 9.000 günde %65 → %50.");
