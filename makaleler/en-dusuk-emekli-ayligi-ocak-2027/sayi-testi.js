#!/usr/bin/env node
/*
 * "Ocak 2027 zammı en düşük emekli aylığına yansır mı?" yazısının sayıları.
 * Her değer yazının modülünden (taban.js) gelir: zam oranları sitenin emekli
 * zammı motorundan (5510 m.55), Eylül 2026'ya kesilmiş TÜFE serisiyle; taban
 * tutarları 5510 ek m.19'un kanun dipnotlarından. Test önce modülü bağımsız
 * aritmetikle ve motorun doğrulanmış resmî oranlarıyla sınar, sonra her
 * rakamın sayfada göründüğünü doğrular.
 *
 * Kullanım: node makaleler/en-dusuk-emekli-ayligi-ocak-2027/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var K = require("./taban.js");
var t = S.yazi(__dirname);

function yz(o, b) { return "%" + S.yuzde(o, b == null ? 2 : b); }
function tl(v) { return S.tam(v); }
function htmlde(ad, x) { t.dogru(ad, t.html.indexOf(x) !== -1, "HTML'de yok: " + x); }

/* 0 — Motor ve kesilmiş seri: açıklanmış resmî oranları veriyor, Eylül'de bitiyor. */
var D = K.donemler();
function oran(ad) { return D.filter(function (d) { return d.ad === ad; })[0].zam; }
t.yakin("Ocak 2024 %37,57", oran("Ocak 2024"), 0.3757, 0.00005);
t.yakin("Temmuz 2024 %24,73", oran("Temmuz 2024"), 0.2473, 0.00005);
t.yakin("Ocak 2025 %15,75", oran("Ocak 2025"), 0.1575, 0.00005);
t.yakin("Temmuz 2025 %16,67", oran("Temmuz 2025"), 0.1667, 0.00005);
t.dogru("seri Eylül 2026'da kesik", K.SERI.sonAy === "2026-09" && !K.SERI.aylar["2026-10"]);
t.dogru("15 zam dönemi, Temmuz 2019 → Temmuz 2026", D.length === 15 && D[0].ad === "Temmuz 2019" && D[14].ad === "Temmuz 2026");

/* 1 — Taban geçmişi: tutarlar artan, bugünkü 23.552, 11 değişiklik. */
t.dogru("taban artan", K.TABAN.every(function (x, i) { return !i || x.tutar > K.TABAN[i - 1].tutar; }));
t.yakin("bugünkü taban", K.BUGUNKU_TABAN, 23552, 0);
t.gecsin("11 kez değişti", (K.TABAN.length - 1) + " kez değişti");
t.yakin("Temmuz 2026 artışı %17,76", 23552 / 20000 - 1, 0.1776, 1e-12);
t.yakin("Temmuz 2025 = zam oranı", 16881 / 14469 - 1, oran("Temmuz 2025"), 0.0001);
t.yakin("Ocak 2025 = zam oranı", 14469 / 12500 - 1, oran("Ocak 2025"), 0.0001);
var artmadi = D.filter(function (d) { return d.tabanArtisi === 0; });
t.dogru("6 dönem artmadı", artmadi.length === 6);
t.gecsin("15 dönemin 9'u / 6'sı", "15 dönemin 9'unda kanunla yükseltildi, 6'sında yükseltilmedi");
t.gecsin("9 kez yükseldi, 6 kez kaldı", "taban 9 kez yükseldi, 6 kez yerinde kaldı");
t.gecsin("artmayan dönemler", artmadi.map(function (d) { return d.ad; }).slice(0, 5).join(", ") + " ve " + artmadi[5].ad);
var son6 = D.slice(-6).every(function (d) { return d.tabanArtisi > 0; });
t.dogru("son altı dönem yükseldi", son6 && D[D.length - 7].tabanArtisi === 0);
t.gecsin("son altı dönem", "son altı dönemdir yükseltildiğini");
D.forEach(function (d) {
  var hucre = "<tr><th scope=\"row\">" + d.ad + "</th><td>" + yz(d.zam) + "</td><td>" + tl(d.tabanOnce) +
    (d.tabanSonra !== d.tabanOnce ? " → " + tl(d.tabanSonra) : "") + "</td><td>" + (d.tabanArtisi ? yz(d.tabanArtisi) : "artmadı") +
    "</td><td>" + (d.kanun || "—") + "</td></tr>";
  htmlde(d.ad + " satırı", hucre);
});
var ara = K.araDonemKararlari();
t.dogru("iki Nisan kararı", ara.length === 2 && ara[0].kanun === 7226 && ara[1].kanun === 7447);
t.gecsin("Nisan 2023 artışı", "üç ay önce " + yz(ara[1].tutar / 5500 - 1, 1) + " artmıştı");
var ocakKanunlari = K.TABAN.filter(function (x) { return /-01$/.test(x.donem) && x.kanun !== 7161; });
t.dogru("Ocak kanunları Ocak'ta kabul", ocakKanunlari.every(function (x) { return x.kabul.slice(5, 7) === "01"; }));
t.gecsin("Ocak kanunları listesi", ocakKanunlari.map(function (x) { return x.kanun; }).slice(0, 4).join(", ") + " ve " + ocakKanunlari[4].kanun);
var gunler = ocakKanunlari.map(function (x) { return +x.kabul.slice(8); });
t.gecsin("kabul günleri aralığı", "Ocak'ın " + Math.min.apply(null, gunler) + "'si ile " + Math.max.apply(null, gunler) + "'i arasında");

/* 2 — 2019'daki tabanlı. */
var m = K.modelEmekli();
var carpan = D.reduce(function (c, d) { return c * (1 + d.zam); }, 1);
t.yakin("çarpan bağımsız", m.carpan, carpan, 1e-12);
t.gecsin("kendi aylığı", tl(m.kendiAyligi) + " TL");
t.gecsin("10,50 kat", m.carpan.toFixed(2).replace(".", ",") + " kat");
t.gecsin("taban 23,55 katı", m.tabanCarpani.toFixed(2).replace(".", ",") + " katına");
t.gecsin("tabanın %44,6'sı", yz(m.tabanOrani, 1));

/* 3 — Ocak 2027. */
var o = K.ocak2027();
t.dogru("üç ay açıklandı", o.donem.aciklananSayisi === 3 && o.eksik === 3);
t.gecsin("kesin birikim", yz(o.kesinBirikim) + "'da kesinleşti");
var gy = o.senaryolar[1];
t.gecsin("geçen yılın ayları", gy.aylar.map(function (x) { return yz(x); }).join(", ").replace(/, (%[^,]+)$/, ", $1"));
o.senaryolar.forEach(function (s) {
  var es = K.esik(s.oran);
  t.yakin(s.ad + " eşik bağımsız", es * (1 + s.oran), 23552, 1e-6);
  htmlde(s.ad + " tablo satırı", "<td>" + yz(s.oran) + "</td><td>" + tl(es) + " TL</td>");
});
var z = gy.oran;
t.gecsin("standfirst eşiği", tl(K.esik(z)) + " TL'nin altında");
[15000, 20000, 21500, 23552, 25000, 30000].forEach(function (A) {
  var a = K.ocakOdemesi(A, z, 0), b = K.ocakOdemesi(A, z, z);
  t.dogru(A + " taban sabitken artış ≥ 0", a.artis >= 0);
  htmlde(A + " örnek satırı", "<tr><th scope=\"row\">" + tl(A) + "</th><td>" + tl(a.once) + "</td><td>" + tl(a.sonra) + "</td><td>" +
    (a.artis < 0.5 ? "0" : "+" + tl(a.artis)) + "</td><td>" + tl(b.sonra) + "</td><td>+" + tl(b.artis) + "</td></tr>");
});
t.gecsin("geçme dönemi", K.gecmeDonemi(m.kendiAyligi, z) + " dönem sonra");
t.yakin("taban zamlı artış = taban × zam", K.ocakOdemesi(15000, z, z).artis, 23552 * z, 1e-6);
htmlde("kart alt metni", "tabandakiler de " + tl(23552 * z) + " TL artış alır");

t.bitir("Kaynak: 5510 m.55 ve ek m.19, TÜFE Eylül 2026'ya kadar.");
