#!/usr/bin/env node
/*
 * "Faiz %36, 2027 tahmini %21" yazısının sayıları.
 * Rapor ve PPK rakamları elle, reel faiz ve başabaş faiz bağımsız formülle
 * yeniden hesaplanır; oran.js ve sayfadaki metinle karşılaştırılır.
 * Bloğu tools/kasim-2026-gundem-yazilari.js yazar.
 *
 * Kullanım: node makaleler/enflasyon-raporu-2026-iv-reel-faiz/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./oran.js");
var t = S.yazi(__dirname);

function v1(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function v2(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function yakin(a, b) { return Math.abs(a - b) < 1e-9; }

/* 1 — Birincil rakamlar (ER 2026-IV s.59–61; PPK 2026-45). */
t.dogru("politika faizi 36, önce 37", M.PPK.faiz === 36 && M.PPK.onceki === 37);
t.dogru("sonraki PPK 10 Aralık", M.PPK.sonraki === "2026-12-10");
t.dogru("ekim TÜFE 29,8", M.EKIM_TUFE === 29.8);
t.dogru("tahminler", M.TAHMIN[2026] === 29.5 && M.TAHMIN[2027] === 21 && M.TAHMIN[2028] === 13.5 && M.TAHMIN[2029] === 9 && M.TAHMIN.ortaVade === 5);
t.dogru("ara hedefler", M.ARA_HEDEF.yeni[2026] === 24 && M.ARA_HEDEF.yeni[2027] === 21 && M.ARA_HEDEF.yeni[2028] === 13.5 &&
  M.ARA_HEDEF.eski[2027] === 15 && M.ARA_HEDEF.eski[2028] === 9);
t.dogru("stopaj %17,5", M.stopaj() === 17.5);

/* 2 — Fisher, elle. */
var ex = (1.36 / 1.21 - 1) * 100, ep = (1.36 / 1.298 - 1) * 100, e26 = (1.36 / 1.295 - 1) * 100;
t.dogru("ileriye dönük", yakin(M.ileriye(), ex), M.ileriye());
t.dogru("gerçekleşen", yakin(M.gerceklesen(), ep));
t.dogru("2026 sonu", yakin(M.reel(36, 29.5), e26));
t.dogru("ileriye dönük daha yüksek", ex > ep);

/* 3 — Fiyat düzeyi: 100 × (1 + π27)(1 + π28). */
var fe = 100 * 1.15 * 1.09, fy = 100 * 1.21 * 1.135;
t.dogru("eski yol", yakin(M.fiyatDuzeyi(M.ARA_HEDEF.eski), fe));
t.dogru("yeni yol", yakin(M.fiyatDuzeyi(M.ARA_HEDEF.yeni), fy));
t.dogru("düzey farkı", yakin(M.duzeyFarki(), (fy / fe - 1) * 100));

/* 4 — Başabaş: (1 + r/2 × 0,825)² = 1 + π. √1,21 = 1,1 olduğu için r = 0,2/0,825. */
var bb = 0.2 / 0.825 * 100, bb26 = (Math.sqrt(1.295) - 1) * 2 / 0.825 * 100;
t.dogru("başabaş 2027", Math.abs(M.basabasBrut(21) - bb) < 1e-9, M.basabasBrut(21));
t.dogru("başabaş 2026", Math.abs(M.basabasBrut(29.5) - bb26) < 1e-9);
t.dogru("başabaş tutarlı", Math.abs(M.netYillik(bb) - 21) < 1e-9);

/* 5 — Sayfa. */
t.dogru("kısa cevap ileri", t.html.indexOf("reel faiz %" + v1(ex) + ".</strong>") >= 0);
t.gecsin("kısa cevap geçmiş", "ekim %29,8) göre ise yalnız %" + v1(ep));
t.gecsin("fiyat düzeyi", v2(fe) + " TL olacaktı, yeni yola göre " + v2(fy) + " TL: fiyat düzeyi %" + v1((fy / fe - 1) * 100) + " daha yüksek");
t.gecsin("mevduat eşiği", "brüt yıllık faiz en az %" + v1(bb));
t.dogru("tahmin tablosu 2027", t.html.indexOf('<th scope="row">2027</th><td class="num">%21,0</td><td class="num">%21,0</td><td class="num">%15,0</td>') >= 0);
t.dogru("reel tablo", t.html.indexOf('<td class="num">%' + v1(ep) + "</td>") >= 0 && t.html.indexOf('<td class="num">%' + v1(e26) + "</td>") >= 0);
t.dogru("başabaş tablosu", t.html.indexOf('<td class="num">%' + v2(bb) + "</td>") >= 0 && t.html.indexOf('<td class="num">%' + v2(bb26) + "</td>") >= 0);
t.gecsin("hedef farkı", "hedefin (%24,0) 5,5 puan üstünde");
t.gecsin("aralık yok", "tahmin aralığı paylaşmıyor");
t.dogru("veri sitesi", t.html.indexOf("https://veri.korayoner.dev/hesap/reel-politika-faizi") >= 0);

/* 6 — Meta ve görsel metni. */
var meta = /<meta name="description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("meta", meta.indexOf("%" + v1(ex)) >= 0 && meta.indexOf("%" + v1(ep)) >= 0 && meta.indexOf("%" + v1((fy / fe - 1) * 100)) >= 0, meta);
var og = /<meta property="og:description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("og", og.indexOf("%" + v1(bb)) >= 0, og);
t.dogru("lead alt", t.html.indexOf("ekim TÜFE'sine göre %" + v1(ep) + ", 2026 sonu tahminine göre %" + v1(e26) + ", 2027 sonu tahminine göre %" + v1(ex)) >= 0);

/* 7 — Sitenin kuralı. */
t.dogru("kişi/parti adı yok", !/AK Parti|\bMHP\b|\bCHP\b|\bDEM\b|İYİ Parti|Karahan|Şimşek|Erdoğan/.test(t.html));
t.dogru("birincil kaynak", t.html.indexOf("https://www.tcmb.gov.tr/") >= 0);

t.bitir("Kaynak: TCMB Enflasyon Raporu 2026-IV Bölüm 3, PPK basın duyurusu 2026-45, GİB stopaj rehberi.");
