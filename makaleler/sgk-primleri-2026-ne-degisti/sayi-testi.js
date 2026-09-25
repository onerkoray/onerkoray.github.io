#!/usr/bin/env node
/*
 * "2026'da SGK primlerinde ne değişti?" yazısının sayıları.
 * bordro/sgk-prim.js ve bordro/motor.js'ten, 2025 ve 2026 parametreleriyle.
 *
 * Kullanım: node makaleler/sgk-primleri-2026-ne-degisti/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var P = require(path.join(S.KOK, "bordro", "sgk-prim.js"));
var B = require(path.join(S.KOK, "bordro", "motor.js"));
var t = S.yazi(__dirname);

var s = { 2025: P.sinirlar(2025), 2026: P.sinirlar(2026) };
function artis(a, b) { return "%" + S.yuzde(b / a - 1); }
function satir(ad, o25, o26, a, b) {
  t.gecsin("satır " + ad, ad + " " + o25 + " " + o26 + " " + S.tl(a) + " TL " + S.tl(b) + " TL " + artis(a, b));
}
function oran(o) { return "%" + String(Math.round(o * 10000) / 100).replace(".", ","); }
var bk = [P.bagkur(s[2025].aylikAlt, 2025), P.bagkur(s[2026].aylikAlt, 2026)];
satir("Bağ-Kur (4/b)", oran(bk[0].oran), oran(bk[1].oran), bk[0].prim, bk[1].prim);
var ib = [P.istegeBagli(s[2025].aylikAlt, 2025), P.istegeBagli(s[2026].aylikAlt, 2026)];
satir("İsteğe bağlı sigorta", oran(ib[0].oran), oran(ib[1].oran), ib[0].prim, ib[1].prim);
var gs = [P.gss(1e9, 2025), P.gss(1e9, 2026)];
satir("Genel sağlık sigortası (60/g)", oran(gs[0].oran), oran(gs[1].oran), gs[0].prim, gs[1].prim);
var bo = [P.borclanma(1, s[2025].gunlukAlt, "genel", 2025), P.borclanma(1, s[2026].gunlukAlt, "genel", 2026)];
satir("Askerlik borçlanması, günlük", oran(bo[0].oran), oran(bo[1].oran), bo[0].gunluk, bo[1].gunluk);
var dg = [P.borclanma(1, s[2025].gunlukAlt, "dogum", 2025), P.borclanma(1, s[2026].gunlukAlt, "dogum", 2026)];
satir("Doğum borçlanması, günlük", oran(dg[0].oran), oran(dg[1].oran), dg[0].gunluk, dg[1].gunluk);
function maliyet(y) { return B.hesaplaYil(s[y].aylikAlt, y).aylar[11].isverenMaliyeti; }
function isv(y) { return oran(B.oranlarAy(B.parametre(y), 12).sgkIsveren); }
satir("Asgari ücretin işverene maliyeti (teşviksiz)", isv(2025), isv(2026), maliyet(2025), maliyet(2026));
function kat(y) { return String(B.parametre(y).tavanKatsayisi).replace(".", ",") + " kat"; }
satir("SGK tavanı", kat(2025), kat(2026), s[2025].aylikUst, s[2026].aylikUst);

var asg = s[2026].aylikAlt / s[2025].aylikAlt - 1;
t.gecsin("asgari artış", "Brüt asgari ücret %" + Math.round(asg * 100) + " arttı");
t.gecsin("giriş oranları", "genel sağlık sigortası primi %" + Math.round((gs[1].prim / gs[0].prim - 1) * 100) + ", askerlik borçlanması %" + Math.round((bo[1].gunluk / bo[0].gunluk - 1) * 100) +
  ", SGK tavanı %" + Math.round((s[2026].aylikUst / s[2025].aylikUst - 1) * 100));
t.gecsin("GSS katı", (gs[1].prim / gs[0].prim).toFixed(2).replace(".", ",") + " katına çıktı");
var o25 = B.oranlarAy(B.parametre(2025), 12), o26 = B.oranlarAy(B.parametre(2026), 1);
t.gecsin("indirim sonrası", "%" + S.yuzde(o25.sgkIsveren - B.tesvikOrani(o25, { tesvik: "genel" })) + "'ten %" + S.yuzde(o26.sgkIsveren - B.tesvikOrani(o26, { tesvik: "genel" })) + "'e");
t.gecsin("GSS eşiği", "(2026'da " + S.tam(gs[1].esik) + " TL)");
t.gecsin("GSS yıllık", "bir yılda " + S.tl(gs[1].yillik) + " TL");
t.bitir();
