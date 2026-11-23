#!/usr/bin/env node
/*
 * "Torba teklifte SGK" yazısının sayıları.
 * Teşvik ve maliyet, kanun metnindeki kuraldan ve 2026 parametrelerinin
 * ham değerlerinden elle yeniden kurulur; teklif.js ve sayfadaki metinle
 * karşılaştırılır. Bloğu tools/kasim-2026-gundem-yazilari.js yazar.
 *
 * Kullanım: node makaleler/torba-teklif-gss-borcu-istihdam-tesviki/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./teklif.js");
var P = require("../../bordro/parametreler.js")[2026];
var t = S.yazi(__dirname);

function v1(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function v2(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function tl(x) { return Math.round(x).toLocaleString("tr-TR"); }
function yakin(a, b) { return Math.abs(a - b) < 1e-6; }

/* 1 — 2026 ham değerleri (bordro parametreleri; 7566 s.K.). */
var BRUT = 33030, ISV = 0.2175, IND = 0.02, IND_IM = 0.05, ISZ = 0.02, GSS = 0.06;
t.dogru("asgari brüt 33.030", M.ASGARI_BRUT === BRUT && P.donemler[0].asgariBrut === BRUT, M.ASGARI_BRUT);
t.dogru("işveren payı %21,75", P.oranlar.sgkIsveren === ISV);
t.dogru("m.81/ı imalat dışı 2, imalat 5", P.oranlar.sgkIsverenIndirim === IND && P.oranlar.sgkIsverenIndirimImalat === IND_IM);
t.dogru("işsizlik işveren %2", P.oranlar.issizlikIsveren === ISZ);
t.dogru("60/g GSS %6", M.GSS_60G_ORANI === GSS);

/* 2 — Teşvik: m.81/ı sonrası kalan işveren hissesi × kazanç; işsizlik payı dışarıda. */
var tes = BRUT * (ISV - IND), tesIm = BRUT * (ISV - IND_IM);
var m0 = BRUT * (1 + ISV - IND + ISZ), m1 = m0 - tes, dus = 1 - m1 / m0, dusIm = 1 - (BRUT * (1 + ISV - IND_IM + ISZ) - tesIm) / (BRUT * (1 + ISV - IND_IM + ISZ));
t.dogru("teşvik aylık", yakin(M.tesvikAylik(BRUT, false), tes), M.tesvikAylik(BRUT, false));
t.dogru("teşvik imalat", yakin(M.tesvikAylik(BRUT, true), tesIm));
t.dogru("maliyet teşviksiz", yakin(M.isverenMaliyeti(BRUT, false, false), m0));
t.dogru("maliyet teşvikli", yakin(M.isverenMaliyeti(BRUT, false, true), m1));
t.dogru("düşüş", yakin(M.maliyetDususu(BRUT, false), dus) && yakin(M.maliyetDususu(BRUT, true), dusIm));
t.dogru("teşvikli maliyet = brüt + işsizlik payı", yakin(m1, BRUT * (1 + ISZ)));

/* 3 — Süreler (4447 geçici 10, ikinci fıkra). */
var ay = M.SURELER.map(function (s) { return s.ay; });
t.dogru("süreler 48/36/24/24/12/6", ay.join("/") === "48/36/24/24/12/6", ay.join("/"));
t.dogru("İŞKUR ek 6 ay", M.ISKUR_EK_AY === 6);
t.dogru("en uzun 54 ay", ay[0] + M.ISKUR_EK_AY === 54);

/* 4 — Teklif künyesi. */
var K = M.TEKLIF;
t.dogru("teklif tarihleri", K.tesvikBitisEski === "2025-12-31" && K.tesvikBitisYeni === "2028-12-31" && K.tesvikYetkiYeni === "2029-12-31" && K.gssKesim === "2017-01-01");
t.dogru("CB kararı 10769", K.cbKarari.no === 10769 && K.cbKarari.bitis === "2026-12-31");

/* 5 — GSS: açıklanan rakamlardan ortalama. */
var kb = 5627666000 / 2199869, g60 = BRUT * GSS;
t.dogru("kişi başı", yakin(M.gssKisiBasi(), kb), M.gssKisiBasi());
t.dogru("60/g aylık", yakin(M.gss60gAylik(), g60));

/* 6 — Sayfa. */
t.dogru("kısa cevap teşvik", t.html.indexOf("<strong>" + v2(tes) + " TL</strong>") >= 0);
t.gecsin("kısa cevap düşüş", "maliyetini %" + v1(dus * 100) + " düşürüyor");
t.gecsin("kısa cevap 54 ay", "destek 54 ay sürüyor");
t.gecsin("kısa cevap GSS", "kişi başı ortalama " + v2(kb) + " TL; bu bugünkü GSS priminin " + v1(kb / g60) + " ayı");
t.dogru("tablo teşvik satırı", t.html.indexOf('<th scope="row">Fonun ödediği teşvik</th><td class="num">' + v2(tes) + ' TL</td><td class="num">' + v2(tesIm) + " TL</td>") >= 0);
t.dogru("tablo maliyet", t.html.indexOf(v2(m0) + " TL") >= 0 && t.html.indexOf(v2(m1) + " TL") >= 0);
t.dogru("süre tablosu 48 ay", t.html.indexOf('<td class="num">48 ay</td><td class="num">' + tl(48 * tes) + ' TL</td><td class="num">54 ay, ' + tl(54 * tes) + " TL</td>") >= 0);
t.gecsin("GSS kişi", "2.199.869");
t.gecsin("GSS toplam", tl(5627666000) + " TL");
t.gecsin("teklif hâli", "Henüz kanun değil.");
t.gecsin("iade yok", "ödenmiş olan geri verilmiyor");
t.gecsin("6824", "6824 sayılı Kanun");

/* 7 — Meta ve görsel metni. */
var meta = /<meta name="description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("meta teşvik", meta.indexOf(v2(tes) + " TL") >= 0, meta);
var og = /<meta property="og:description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("og düşüş ve ortalama", og.indexOf("%" + v1(dus * 100)) >= 0 && og.indexOf(v2(kb) + " TL") >= 0, og);
t.dogru("lead alt maliyet", t.html.indexOf("teşviksiz " + v2(m0) + " TL") >= 0 && t.html.indexOf(v2(m1) + " TL.") >= 0);
t.dogru("standfirst", t.html.indexOf("%" + v1(dus * 100) + " düşürüyor; GSS'de açıklanan kişi başı ortalama borç bugünkü primin " + v1(kb / g60) + " ayı") >= 0);

/* 8 — Sitenin kuralı: kişi ve parti adı yok; teklif sahibi yazılmaz. */
t.dogru("kişi/parti adı yok", !/AK Parti|\bMHP\b|\bCHP\b|\bDEM\b|İYİ Parti|Milletvekili [A-ZÇĞİÖŞÜ]|Işıkhan|Şimşek|Erdoğan/.test(t.html));
t.dogru("birincil kaynak", t.html.indexOf("https://cdn.tbmm.gov.tr/") >= 0);

t.bitir("Kaynak: TBMM 2/4042 teklif metni, 4447 s.K. geçici m.10, 5510 s.K. m.60/1-g, 2026 bordro parametreleri.");
