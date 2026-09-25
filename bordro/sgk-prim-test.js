#!/usr/bin/env node
/*
 * SGK primleri — regresyon testleri.
 *
 * Referans: SGK 2026/2 Genelgesi'nin tutarları (EY Sosyal Güvenlik
 * Sirküleri 2026/7): Bağ-Kur en düşük 11.808,23 / en yüksek 106.274,03 TL,
 * GSS 1.981,80 TL, borçlanma günlük en düşük 352,32–495,45 TL, en yüksek
 * 3.170,88–4.459,05 TL; isteğe bağlı en düşük 10.899,90 TL.
 *
 * Kullanım: node bordro/sgk-prim-test.js
 */
"use strict";

var path = require("path");
var S = require(path.join(__dirname, "sgk-prim.js"));
var B = require(path.join(__dirname, "motor.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }
var YIL = 2026, s = S.sinirlar(YIL);

gecer("aylık alt sınır brüt asgari ücret", s.aylikAlt === 33030);
gecer("aylık üst sınır tavan (9 kat)", s.aylikUst === 297270 && s.aylikUst === s.aylikAlt * B.parametre(YIL).tavanKatsayisi);
gecer("günlük alt 1.101", s.gunlukAlt === 1101);
gecer("günlük üst 9.909", s.gunlukUst === 9909);

/* Genelge tutarları */
gecer("Bağ-Kur en düşük 11.808,23", S.bagkur(s.aylikAlt, YIL).prim === 11808.23);
gecer("Bağ-Kur indirimli en düşük 10.156,73", S.bagkur(s.aylikAlt, YIL).indirimli === 10156.73);
gecer("Bağ-Kur en yüksek 106.274,03", S.bagkur(s.aylikUst, YIL).prim === 106274.03);
gecer("Bağ-Kur indirimli en yüksek 91.410,53", S.bagkur(s.aylikUst, YIL).indirimli === 91410.53);
gecer("isteğe bağlı en düşük 10.899,90", S.istegeBagli(s.aylikAlt, YIL).prim === 10899.9);
gecer("isteğe bağlı en yüksek 98.099,10", S.istegeBagli(s.aylikUst, YIL).prim === 98099.1);
gecer("GSS 1.981,80", S.gss(20000, YIL).prim === 1981.8 && !S.gss(20000, YIL).devletOder);
gecer("borçlanma günlük en düşük 495,45", S.borclanma(1, s.gunlukAlt, "genel", YIL).gunluk === 495.45);
gecer("doğum borçlanması günlük 352,32", S.borclanma(1, s.gunlukAlt, "dogum", YIL).gunluk === 352.32);
gecer("borçlanma günlük en yüksek 4.459,05", S.borclanma(1, s.gunlukUst, "genel", YIL).gunluk === 4459.05);
gecer("doğum borçlanması günlük en yüksek 3.170,88", S.borclanma(1, s.gunlukUst, "dogum", YIL).gunluk === 3170.88);

/* GSS gelir testi: kişi başı gelir asgari ücretin 1/3'ünden azsa devlet öder */
var esik = 33030 / 3;
gecer("GSS eşiğin hemen altında devlet öder", S.gss(esik - 0.01, YIL).devletOder && S.gss(esik - 0.01, YIL).prim === 0);
gecer("GSS eşikte prim ödenir", !S.gss(esik, YIL).devletOder && S.gss(esik, YIL).prim === 1981.8);
gecer("GSS yıllık = 12 × aylık", S.gss(50000, YIL).yillik === 1981.8 * 12);

/* Borçlanma toplamı ve sınırlar */
var b = S.borclanma(540, 1500, "genel", YIL);
gecer("540 gün × 1.500 × %45", b.toplam === Math.round(1500 * 0.45 * 540 * 100) / 100);
gecer("en az / en çok aralığı", b.enAz === 495.45 * 540 && b.enCok === Math.round(4459.05 * 540 * 100) / 100);
gecer("720 gün doğum en düşük 253.670,40", S.borclanma(720, 1101, "dogum", YIL).toplam === 253670.4);

/* Kat tablosu: tavanı aşan kat tavanda kalır */
var t = S.katTablosu([1, 2, 5, 9, 10], YIL);
gecer("1 kat asgari", t[0].kazanc === 33030 && t[0].bagkur === 11808.23);
gecer("9 kat tavan", t[3].kazanc === 297270);
gecer("10 kat tavanda kalır", t[4].kazanc === 297270 && t[4].bagkur === t[3].bagkur);
gecer("oranlar parametreden", S.bagkur(50000, YIL).oran === B.parametre(YIL).sirket.bagkurOrani);

/* Hatalı girdi */
gecer("asgari altı kazanç", atar(function () { S.bagkur(30000, YIL); }));
gecer("tavan üstü kazanç", atar(function () { S.istegeBagli(300000, YIL); }));
gecer("günlük kazanç alt sınır altı", atar(function () { S.borclanma(10, 1000, "genel", YIL); }));
gecer("gün 0", atar(function () { S.borclanma(0, 1500, "genel", YIL); }));
gecer("negatif gelir", atar(function () { S.gss(-1, YIL); }));
gecer("parametresi olmayan yıl", atar(function () { S.bagkur(20000, 2024); }));

/* 2025 (7566 s.K. öncesi): askerlik borçlanması günlük en az 277,39 TL, Bağ-Kur %34,75 */
var s25 = S.sinirlar(2025);
gecer("2025 günlük alt 866,85", Math.abs(s25.gunlukAlt - 866.85) < 1e-9);
gecer("2025 borçlanma günlük 277,39", S.borclanma(1, s25.gunlukAlt, "genel", 2025).gunluk === 277.39);
gecer("2025 doğum borçlanması da %32", S.borclanma(1, s25.gunlukAlt, "dogum", 2025).gunluk === 277.39);
gecer("2025 Bağ-Kur en düşük 9.036,91", S.bagkur(s25.aylikAlt, 2025).prim === 9036.91);
gecer("2025 isteğe bağlı en düşük 8.321,76", S.istegeBagli(s25.aylikAlt, 2025).prim === 8321.76);
gecer("2025 GSS %3", Math.round(S.gss(20000, 2025).prim) === 780);

console.log(gecen + " geçti, " + kalan + " kaldı. (SGK primleri)");
process.exit(kalan ? 1 : 0);
