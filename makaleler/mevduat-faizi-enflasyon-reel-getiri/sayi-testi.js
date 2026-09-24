#!/usr/bin/env node
/*
 * "Mevduat faizi, enflasyon ve reel getiri" yazısının sayıları.
 *
 * Faiz, stopaj ve vade sonu, mevduat aracının kullandığı fonksiyondan
 * (finans/kurallar.js → mevduat) geliyor; stopaj oranı da oradaki GİB
 * tablosundan. Oran tablosu değişirse yazının %17,5'i kırmızıya döner.
 *
 * YUVARLAMA: reel değerler kuruşa yuvarlanmamış vade sonu bakiyesinden
 * hesaplanır. 103.254,79 ÷ 1,04 = 99.283,45; yuvarlanmamış bakiyeden
 * 99.283,46. Doğru olan ikincisi ve yazı onu kullanıyor.
 *
 * Kullanım: node makaleler/mevduat-faizi-enflasyon-reel-getiri/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var F = require(path.join(S.KOK, "finans", "kurallar.js"));
var t = S.yazi(__dirname);

var ANA = 100000, FAIZ = 45, GUN = 32, BASLANGIC = "2026-09-10";
var m = F.mevduat(ANA, FAIZ, GUN, BASLANGIC, "tl");
var r = m.net / ANA;
function y(o, b) { return (o * 100).toFixed(b).replace(".", ","); }

t.gecsin("stopaj oranı GİB tablosundan", "stopaj %" + String(m.taxPct).replace(".", ","));
t.gecsin("brüt faiz", "Brüt faiz " + ANA.toLocaleString("tr-TR") + " × 0,45 × " + GUN + " ÷ 365 " + S.tl(m.gross) + " TL");
t.gecsin("stopaj tutarı", S.tl(m.tax) + " TL");
t.gecsin("net faiz", S.tl(m.net) + " TL");
t.gecsin("vade sonu", S.tl(m.maturity) + " TL");
t.gecsin("net dönem getirisi", "%" + y(r, 4));
t.gecsin("vade bitişi", "12 Ekim'de biten");
t.dogru("örnek tarihleri aracın bitiş tarihiyle aynı", m.end === "2026-10-12", m.end);

/* Üç enflasyon senaryosu. */
[0.02, 0.03, 0.04].forEach(function (e) {
  var reel = (1 + r) / (1 + e) - 1;
  var bugun = m.maturity / (1 + e);
  var isaret = reel >= 0 ? "+" : "−";
  t.gecsin("%" + e * 100 + " senaryosu", "%" + e * 100 + " " + isaret + "%" + y(Math.abs(reel), 2) + " " +
    S.tl(bugun) + " TL " + isaret + S.tl(Math.abs(bugun - ANA)) + " TL");
});

/* Formül örnekleri. */
t.gecsin("kesin reel getiri örneği", "1,40 ÷ 1,30 − 1 ≈ %" + y(1.40 / 1.30 - 1, 2));
t.gecsin("zincirleme enflasyon", "1,02 × 1,03 − 1 = %" + y(1.02 * 1.03 - 1, 2));
var gerekli = 0.03 * 365 / GUN / (1 - m.taxPct / 100);
t.gecsin("başabaş brüt faiz", "0,03 × 365 ÷ " + GUN + " ÷ " + String(1 - m.taxPct / 100).replace(".", ",") +
  " = yaklaşık %" + y(gerekli, 2));
t.gecsin("iki vade", "(1 + " + r.toFixed(9).replace(".", ",") + ")² − 1 ≈ %" + y(Math.pow(1 + r, 2) - 1, 2));
t.gecsin("12 vade süresi", "12 adet " + GUN + " günlük vade " + 12 * GUN + " gündür");

t.bitir();
