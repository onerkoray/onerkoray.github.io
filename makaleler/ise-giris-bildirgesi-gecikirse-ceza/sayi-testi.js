#!/usr/bin/env node
/*
 * "İşe giriş bildirgesi gecikirse SGK cezası ne kadar?" yazısının sayıları.
 * Her değer aracın çekirdeğinden (sgk-idari-para-cezasi-hesaplama/hesap.js)
 * gelir. Test önce kanundaki katları ve iki indirimi çekirdekten bağımsız
 * aritmetikle sınar, sonra her rakamın sayfada göründüğünü doğrular.
 * Tablo ve grafik bloklarını tools/sgk-ceza-sayfa.js yazar; burada aynı
 * değerler bir kez daha, görünen metinde aranır.
 *
 * Kullanım: node makaleler/ise-giris-bildirgesi-gecikirse-ceza/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var C = require("../../sgk-idari-para-cezasi-hesaplama/hesap.js");
var B = require("../../bordro/motor.js");
var t = S.yazi(__dirname);

function tl(v) { return S.tam(v) + " TL"; }
var O = { yil: 2026, ay: 10 };
function h(g) { return C.hesapla(Object.assign({}, O, g)); }
var au = C.asgari(2026, 10);

/* 1 — Kanundaki tutar: bir brüt asgari ücret. */
t.yakin("asgari ücret bordro parametresinden", au, B.donem(B.parametre(2026), 10).asgariBrut, 0);
t.gecsin("33.030 TL", tl(au));
t.gecsin("m.102/1-a", "m.102/1-a");

/* 2 — Beş yol, bağımsız aritmetikle. */
var k30 = Math.floor(au / 4 * 3 / 4), k = Math.floor(au * 3 / 4);
var tespit = Math.floor(2 * au * 3 / 4), tekrar = Math.floor(5 * au * 3 / 4);
t.yakin("30 gün + 15 gün", h({ fiil: "iseGiris", sigortali: 1, kendiliginden30: true }).pesin, k30, 0);
t.yakin("30 gün geçti + 15 gün", h({ fiil: "iseGiris", sigortali: 1, kendiliginden30: false }).pesin, k, 0);
t.yakin("tespit + 15 gün", h({ fiil: "iseGiris", sigortali: 1, iseGiris: "tespit" }).pesin, tespit, 0);
t.yakin("tekrar + 15 gün", h({ fiil: "iseGiris", sigortali: 1, iseGiris: "tekrar" }).pesin, tekrar, 0);
t.dogru("tespit edilende kendiliğinden indirimi yok", h({ fiil: "iseGiris", sigortali: 1, iseGiris: "tespit", kendiliginden30: true }).pesin === tespit);
[k30, k, tespit, tekrar, au, 2 * au, 5 * au].forEach(function (v) { t.gecsin("yol tutarı " + v, tl(v)); });
var y = C.yollar(Object.assign({ fiil: "iseGiris", sigortali: 1 }, O));
t.yakin("beş yol", y.length, 5, 0);
t.yakin("en ucuz", y[0].tutar, k30, 0);
t.yakin("en pahalı", y[4].tutar, tekrar, 0);
t.yakin("kat (yuvarlak)", Math.round(tekrar / k30), 20, 0);
t.gecsin("20 kat", "Aradaki 20 katı");
t.gecsin("aralık", tl(k30) + " ile " + tl(tekrar));
t.gecsin("%18,75", "%18,75");
t.yakin("3/16 = %18,75", 3 / 16, 0.1875, 0);
t.gecsin("kuruşlu ara sonuç", "33.030 × 1/4 × 3/4 = 6.193,13");
t.yakin("6.193,13", Math.round(au * 3 / 16 * 100) / 100, 6193.13, 0.001);

/* 3 — Genelgenin 2017 örneği: 1.777 × 1/4 × 3/4 = 333. */
t.yakin("Genelge örneği", C.hesapla({ fiil: "iseGiris", yil: 2017, ay: 2, asgariUcret: 1777.50, sigortali: 1, kendiliginden30: true }).pesin, 333, 0);
t.gecsin("Genelge örneği sayfada", "1.777 × 1/4 × 3/4 = 333 TL");

/* 4 — Bir gün farkı ve tarih örneği (3 Kasım 2026 salı). */
t.yakin("bir gün", k - k30, 18579, 0);
t.gecsin("bir gün sayfada", "Bir gün, " + tl(k - k30));
t.yakin("3 Kasım 2026 salı", new Date(Date.UTC(2026, 10, 3)).getUTCDay(), 2, 0);
t.gecsin("salı", "3 Kasım 2026 salı");
/* 30 gün: son günü izleyen günden (3 Kasım) başlar, 30. gün 2 Aralık. */
t.dogru("30. gün 2 Aralık", new Date(Date.UTC(2026, 10, 3 + 29)).toISOString().slice(0, 10) === "2026-12-02");
t.gecsin("2 Aralık", "2 Aralık'ta biter");

/* 5 — Kişi sayısı: işe giriş tavansız, beyanname 10'da tavan. */
[1, 3, 10, 25].forEach(function (n) {
  var a = h({ fiil: "iseGiris", sigortali: n, kendiliginden30: true }).pesin;
  var b = h({ fiil: "iseGiris", sigortali: n, iseGiris: "tespit" }).pesin;
  var m = h({ fiil: "mphbAsil", sigortali: n }).pesin;
  t.yakin(n + " kişi işe giriş", a, Math.floor(n * au * 3 / 16), 0);
  t.yakin(n + " kişi tespit", b, Math.floor(n * 2 * au * 3 / 4), 0);
  t.yakin(n + " kişi beyanname", m, Math.floor(Math.floor(Math.min(n * au / 5, 2 * au)) * 3 / 4), 0);
  [a, b, m].forEach(function (v) { t.gecsin(n + " kişi tablosu " + v, tl(v)); });
});
t.dogru("beyanname 10 ve 25 kişide aynı", h({ fiil: "mphbAsil", sigortali: 10 }).teblig === h({ fiil: "mphbAsil", sigortali: 25 }).teblig);
t.gecsin("10 sigortalıda tavan", "10 sigortalıda tavana ulaşılır");
t.gecsin("10 kişi kendiliğinden", tl(h({ fiil: "iseGiris", sigortali: 10, kendiliginden30: true }).pesin));
t.gecsin("10 kişi tespit", tl(h({ fiil: "iseGiris", sigortali: 10, iseGiris: "tespit" }).pesin));

/* 6 — SSS ve kısa cevaptaki düz metin rakamlar. */
t.gecsin("SSS 66.060", "iki asgari ücret, 66.060 TL; 15 gün içinde ödenirse 49.545 TL");
t.gecsin("SSS 6.193", "15 gün içinde ödenirse 6.193 TL tahsil edilir");

t.bitir();
