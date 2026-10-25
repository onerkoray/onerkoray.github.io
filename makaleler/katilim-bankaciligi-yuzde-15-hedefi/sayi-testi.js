#!/usr/bin/env node
/*
 * "Katılım bankacılığı 2025'te %15 olacaktı: ne oldu?" yazısının sayıları.
 * Önce veri sınanır: Aralık 2025 katılım aktifi ve payı TKBB'nin kendi
 * raporundakiyle (4 trilyon 327 milyar TL, %9,2), 2012 ve 2019 payları
 * güncelleme raporundakiyle (%5,1, %6,3) aynı mı. Sonra her oran BDDK ham
 * verisinden modülden bağımsız yeniden kurulur ve sayfada aranır.
 * Blokları tools/katilim-yazisi.js yazar.
 *
 * Kullanım: node makaleler/katilim-bankaciligi-yuzde-15-hedefi/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var K = require("./katilim.js");
var V = require("./bddk-2026-08.json");
var T = require("../../finans/endeksleme-serileri.js");
var t = S.yazi(__dirname);

function r(y, p) { return V[p || "TL"][typeof y === "number" ? y + "-12" : y]; }
function top(x) { return x.mevduat + x.katilim + x.kalkinma; }
function pay(y) { var x = r(y); return x.katilim / top(x) * 100; }
function yz(v, b) { return "%" + v.toFixed(b == null ? 2 : b).replace(".", ","); }
function od(v, b) { return v.toFixed(b).replace(".", ","); }

/* 1 — Veri iki dış kaynakla örtüşüyor. */
t.yakin("Aralık 2025 katılım aktifi = TKBB 4 trilyon 327 milyar TL", Math.round(r(2025).katilim / 1000), 4327, 0);
t.yakin("Aralık 2025 payı = TKBB %9,2", Math.round(pay(2025) * 10) / 10, 9.2, 1e-9);
t.yakin("2012 payı = güncelleme raporu %5,1", Math.round(pay(2012) * 10) / 10, 5.1, 1e-9);
t.yakin("2019 payı = güncelleme raporu %6,3", Math.round(pay(2019) * 10) / 10, 6.3, 1e-9);
t.yakin("Aralık 2024 dolar aktifi ≈ ICD–LSEG 75 milyar $", Math.round(r(2024, "USD").katilim / 1000), 76, 0);
t.dogru("son ay Ağustos 2026", K.SON === "2026-08");

/* 2 — Pay ve hedef. */
var p25 = pay(2025), p15 = pay(2015), pS = pay("2026-08");
t.yakin("modül payı = bağımsız", K.pay(2025), p25, 1e-12);
t.gecsin("2025 payı", yz(p25));
t.gecsin("2015 payı", yz(p15));
t.gecsin("son ay payı", yz(pS));
t.gecsin("hedefin %61'i", "%" + Math.round(p25 / 15 * 100) + "'i");
t.gecsin("on yılda artış", od(p25 - p15, 2) + " puan");
t.yakin("TL aktif 4,33 trilyon", Math.round(r(2025).katilim / 1e4) / 100, 4.33, 1e-9);
t.gecsin("TL aktif sayfada", "4,33 trilyon TL");
t.gecsin("TL hedefi", "1,77 trilyon TL");
t.gecsin("hedef tablosu oranı", "%" + Math.round(r(2025).katilim / 1e6 / 1.77 * 100));

/* 3 — Enflasyon: Ara 2020 → Ara 2025 TÜFE çarpanı, bağımsız çarpım. */
var tufe = [2022, 2023, 2024, 2025, 2026].reduce(function (k, y) { return k * (1 + T.SERI[y].tufe / 100); }, 1);
t.yakin("TÜFE çarpanı modülle aynı", K.enflasyon().tufe, tufe, 1e-12);
t.gecsin("TÜFE 6,96 kat", od(tufe, 2) + " katına");
var sadece = r(2020).katilim * tufe;
t.gecsin("2020 aktifi 437 milyar", Math.round(r(2020).katilim / 1000) + " milyar TL");
t.gecsin("yalnız enflasyonla", od(sadece / 1e6, 2) + " trilyon TL");
t.dogru("enflasyon tek başına TL hedefini aşıyor", sadece / 1e6 > 1.77);
t.gecsin("hedefin 1,7 katı", od(sadece / 1e6 / 1.77, 1) + " katı");
t.gecsin("örtük sektör 11,8", od(1.77 / 0.15, 1) + " trilyon TL");
t.gecsin("gerçek sektör 46,9", od(top(r(2025)) / 1e6, 1) + " trilyon TL");
t.gecsin("yaklaşık 4,0 katı", od(top(r(2025)) / 1e6 / (1.77 / 0.15), 1) + " katı");
var kReel = r(2025).katilim / r(2020).katilim / tufe, sReel = top(r(2025)) / top(r(2020)) / tufe;
t.gecsin("katılım reel %42", "reel olarak %" + Math.round((kReel - 1) * 100));
t.gecsin("sektör reel %10", "sektör %" + Math.round((sReel - 1) * 100));

/* 4 — Dolar ve gereken. */
var u15 = r(2015, "USD"), u25 = r(2025, "USD");
t.gecsin("2015 dolar", od(u15.katilim / 1000, 1) + " milyar dolar");
t.gecsin("2025 dolar", od(u25.katilim / 1000, 1) + " milyar dolar");
t.gecsin("dolar katı", od(u25.katilim / u15.katilim, 1) + " kat");
t.gecsin("sektör dolar katı", od(top(u25) / top(u15), 2) + " katına");
var diger = r(2025).mevduat + r(2025).kalkinma, gerek = 15 / 85 * diger;
t.dogru("gereken aktifle pay tam %15", Math.abs(gerek / (gerek + diger) - 0.15) < 1e-12);
t.gecsin("gereken 7,52", od(gerek / 1e6, 2) + " trilyon TL");
t.gecsin("gereken katı", od(gerek / r(2025).katilim, 2) + " katı");

/* 5 — Bu hızla: aritmetik. */
var h10 = (p25 - p15) / 10, y10 = 2025 + (15 - p25) / h10;
var hS = (pS - p25) / (8 / 12), yS = 2026 + 8 / 12 + (15 - pS) / hS;
t.gecsin("yıllık 0,41", od(h10, 2) + " puan");
t.gecsin("2039", "%15'e " + Math.floor(y10) + " 'da");
t.gecsin("son hız 0,56", od(hS, 2) + " puan");
t.gecsin("2036", "bu hızla " + Math.floor(yS));
t.dogru("2025 en büyük yıllık artış", [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
  .every(function (y) { return pay(y) - pay(y - 1) < p25 - pay(2024); }));
t.dogru("2014–2016 geriledi, 2024 düştü", pay(2014) < pay(2013) && pay(2015) < pay(2014) && pay(2016) < pay(2015) && pay(2024) < pay(2023));

/* 6 — Dünya: ICD–LSEG ilk on. */
var w = K.dunya();
t.yakin("ilk on ülke", w.ulkeler.length, 10, 0);
t.yakin("Türkiye sekizinci", w.sira, 8, 0);
t.gecsin("Türkiye payı", yz(75 / 4318 * 100, 1));
t.gecsin("İran payı", yz(2012 / 4318 * 100, 1));
t.gecsin("toplam 4,3 trilyon", "4,3 trilyon dolar");
t.gecsin("BDDK 2024 dolar", od(r(2024, "USD").katilim / 1000, 1) + " milyar dolar");

t.bitir();
