#!/usr/bin/env node
/*
 * "2026 yeniden değerleme oranı Ekim verisi gelmeden neredeyse belli"
 * yazısının sayıları. Önce kural sınanır: aynı hesap 2021–2025 için VUK
 * tebliğleriyle ilan edilen oranı iki ondalıkta vermeli. Sonra 2026 aralığı
 * modülden bağımsız, doğrudan endeks toplamlarıyla yeniden kurulur ve her
 * rakam sayfada aranır. Blokları tools/ydo-2026-yazisi.js yazar.
 *
 * Kullanım: node makaleler/yeniden-degerleme-orani-2026/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var O = require("./oran.js");
var Y = require("../../tools/ydo-2026-yazisi.js");
var t = S.yazi(__dirname);
var E = O.VERI.endeks;

function yz(v) { return "%" + v.toFixed(2).replace(".", ","); }
function topla(bas, son) {
  var s = 0, k = Object.keys(E).sort();
  k.forEach(function (a) { if (a >= bas && a <= son) s += E[a]; });
  return s;
}

/* 1 — Kural: 2021–2025 ilan edilen oranlar birebir. */
[[2021, 36.20], [2022, 122.93], [2023, 58.46], [2024, 43.93], [2025, 25.49]].forEach(function (r) {
  var y = r[0], bagimsiz = (topla((y - 1) + "-11", y + "-10") / topla((y - 2) + "-11", (y - 1) + "-10") - 1) * 100;
  t.yakin(y + " bağımsız hesap = ilan", Math.round(bagimsiz * 100) / 100, r[1], 0.001);
  t.yakin(y + " modül = ilan", Math.round(O.oran(y) * 100) / 100, O.ilan(y), 0.001);
  t.gecsin(y + " oranı sayfada", yz(r[1]));
});
t.dogru("veri Eylül 2026'da bitiyor", Object.keys(E).sort().pop() === "2026-09");
t.dogru("on iki ayın on biri belli", O.bilinenPay().bilinenAy === 11);

/* 2 — 2026 senaryosu, bağımsız: Ekim = Eylül × (1 + x). */
var payda = topla("2024-11", "2025-10"), bilinen = topla("2025-11", "2026-09");
function oran(x) { return ((bilinen + E["2026-09"] * (1 + x / 100)) / payda - 1) * 100; }
var a = O.aralik();
t.yakin("en yavaş ay Aralık 2024", a.altAy === "2024-12" ? 1 : 0, 1, 0);
t.yakin("en hızlı ay Nisan 2026", a.ustAy === "2026-04" ? 1 : 0, 1, 0);
t.yakin("alt uç", a.alt.oran, oran(a.alt.aylik), 1e-9);
t.yakin("üst uç", a.ust.oran, oran(a.ust.aylik), 1e-9);
t.gecsin("alt uç sayfada", yz(a.alt.oran));
t.gecsin("üst uç sayfada", yz(a.ust.oran));
t.gecsin("aralık cümlesi", yz(a.alt.oran) + " ile " + yz(a.ust.oran));
t.gecsin("en yavaş ay", yz(a.alt.aylik) + " , Aralık 2024");
t.gecsin("en hızlı ay", yz(a.ust.aylik) + " , Nisan 2026");
t.gecsin("Ekim sıfır", "hiç artmasa bile " + yz(oran(0)));
t.yakin("duyarlılık bağımsız", O.duyarlilik(), E["2026-09"] / payda, 1e-9);
t.gecsin("duyarlılık", "yalnız " + (E["2026-09"] / payda).toFixed(2).replace(".", ",") + " puan");
t.gecsin("stres alt", "%5 düşse oran " + yz(oran(-5)));
t.gecsin("stres üst", "%10 artsa " + yz(oran(10)));
t.dogru("stres aralığı iki puandan dar", oran(10) - oran(-5) < 2);
Y.senaryolar().forEach(function (s) {
  t.yakin(s.ad + " oran", s.oran, oran(s.aylik), 1e-9);
  t.gecsin(s.ad + " tabloda", yz(s.oran));
  t.gecsin(s.ad + " yıllık ÜFE", (s.ekimYillik < 0 ? "−" : "") + yz(Math.abs(s.ekimYillik)));
});

/* 3 — Geriye dönük sınama: dört yıl içinde, 2021 dışında. */
var icinde = [2021, 2022, 2023, 2024, 2025].filter(function (y) { return O.geriyeDonuk(y).icinde; });
t.dogru("beş yılın dördü içinde", icinde.length === 4 && icinde.indexOf(2021) < 0, icinde.join());
var g = O.geriyeDonuk(2021);
t.yakin("2021 Ekim aylık %5,24", Math.round(g.ekimAylik * 100) / 100, 5.24, 0.001);
t.yakin("2021 önceki en yüksek %4,34", Math.round(g.maxAylik * 100) / 100, 4.34, 0.001);
t.yakin("2021 sapma 0,12", Math.round(g.sapma * 100) / 100, 0.12, 0.001);
t.gecsin("2021 sayfada", "ayda %5,24 arttı");
t.gecsin("2021 sapma sayfada", "0,12 puan üstünde");
t.gecsin("dördü", "Beş yılın dördünde");

/* 4 — Dilim penceresi: 2026 tarifesi × (1 + oran), %5 aşağısı. */
var d = O.dilimPenceresi(a.alt.oran, a.ust.oran);
[190000, 400000, 1500000, 5300000].forEach(function (v, i) {
  t.yakin((i + 1) + ". eşik 2026", d[i].tutar2026, v, 0);
  t.yakin((i + 1) + ". eşik üst", d[i].hamUst, v * (1 + a.ust.oran / 100), 1e-6);
  t.yakin((i + 1) + ". eşik en az", d[i].enAz, v * (1 + a.alt.oran / 100) * 0.95, 1e-6);
  t.gecsin((i + 1) + ". eşik üst sayfada", S.tam(Math.floor(d[i].hamUst)));
  t.gecsin((i + 1) + ". eşik en az sayfada", S.tam(Math.ceil(d[i].enAz)));
});
t.gecsin("birinci dilim farkı", S.tam(Math.round(d[0].hamUst - d[0].hamAlt)) + " TL fark");
t.gecsin("SSS 243 bin", "en çok 243 bin TL");
t.dogru("243 bin doğru", Math.floor(d[0].hamUst / 1000) === 243);

/* 5 — MTV: tarife modülünden. */
var m1 = O.mtvOrnek(a.alt.oran), m2 = O.mtvOrnek(a.ust.oran);
t.yakin("MTV 2026 tutarı", m1.tutar2026, 10016, 0);
t.yakin("MTV 2026 oranı", m1.uygulanan2026, 0.1895, 0);
t.gecsin("MTV %18,95", "%18,95");
t.gecsin("MTV %25,49", "%25,49 iken");
t.gecsin("MTV alt", S.tam(Math.floor(m1.kanunOrani)) + " TL ile " + S.tam(Math.floor(m2.kanunOrani)) + " TL");

/* 6 — TÜFE ve yıllık ÜFE karşılaştırması. */
t.yakin("Eylül yıllık Yİ-ÜFE", Y.ufeYillik("2026-09"), (E["2026-09"] / E["2025-09"] - 1) * 100, 1e-9);
t.gecsin("Eylül yıllık ÜFE sayfada", yz(Y.ufeYillik("2026-09")));
t.gecsin("Eylül TÜFE sayfada", yz(Y.tufeEylul()));
var b = Y.ufeBandi();
t.yakin("ÜFE bandı 11 ay", b.ay, 11, 0);
t.dogru("aralık bandın içinde", a.alt.oran > b.min && a.ust.oran < b.max);
t.gecsin("ÜFE bandı sayfada", yz(b.min) + " ile " + yz(b.max));

/* 7 — Takvim: TÜİK Ekim bülteni 3 Kasım 2026. */
t.gecsin("3 Kasım", "3 Kasım 2026");

t.bitir();
