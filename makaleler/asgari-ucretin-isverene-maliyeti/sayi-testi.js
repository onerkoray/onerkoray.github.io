#!/usr/bin/env node
/*
 * "Asgari ücretin işverene maliyeti" yazısının sayıları.
 * bordro/motor.js'ten: asgari ücret ay ay kendi dönemiyle; işveren payı ve
 * indirim yıla ve aya göre. Reel değerler Ağustos 2026 fiyatlarıyla (çivili).
 *
 * Kullanım: node makaleler/asgari-ucretin-isverene-maliyeti/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var B = S.bordro();
var E = require(path.join(S.KOK, "finans", "tufe-endeksi.js"));
var t = S.yazi(__dirname);

var AY = ["", "Ocak", "", "", "", "", "", "Temmuz"];
var paylar = {}, reel = {};
[2020, 2021, 2022, 2023, 2024, 2025, 2026].forEach(function (y) {
  var P = B.parametre(y), br = [];
  for (var m = 1; m <= 12; m++) br.push(B.donem(P, m).asgariBrut);
  var Y = B.hesaplaYil(br, y), I = B.hesaplaYil(br, y, { tesvik: "genel" });
  P.donemler.forEach(function (d) {
    var a = Y.aylar[d.ay - 1], i = I.aylar[d.ay - 1], ay = y + "-" + String(d.ay).padStart(2, "0");
    t.dogru("motor neti resmî net " + ay, Math.abs(a.net - d.asgariNet) < 0.015, a.net + " / " + d.asgariNet);
    var pay = d.asgariNet / a.isverenMaliyeti, r = a.isverenMaliyeti * E.carpan(ay, "2026-08");
    paylar[ay] = pay; reel[ay] = r;
    t.gecsin("satır " + ay, AY[d.ay] + " " + y + " " + S.tl(d.asgariBrut) + " TL " + S.tl(d.asgariNet) + " TL " + S.tl(a.isverenMaliyeti) + " TL " +
      S.tl(i.isverenMaliyeti) + " TL %" + S.yuzde(pay) + " " + S.tam(r) + " TL");
  });
});
t.gecsin("giriş 2026", "teşviksiz 40.874,63 TL öder, çalışanın eline 28.075,50 TL geçer: her 100 TL'nin " + S.yuzde(paylar["2026-01"]) + " TL'si");
t.gecsin("giriş 2021", "2021'de bu pay " + S.yuzde(paylar["2021-01"]) + " TL'ydi");
t.gecsin("giriş 2022", "istisna olunca " + S.yuzde(paylar["2022-01"]) + "'a çıktı");
var zirve = Object.keys(reel).reduce(function (a, b) { return reel[a] > reel[b] ? a : b; });
var dip = Object.keys(reel).reduce(function (a, b) { return reel[a] < reel[b] ? a : b; });
t.dogru("reel zirve Ocak 2024", zirve === "2024-01", zirve);
t.dogru("reel dip Temmuz 2022", dip === "2022-07", dip);
t.gecsin("reel zirve", "Ocak 2024'te " + S.tam(reel["2024-01"]) + " TL ile zirve");
t.gecsin("reel 2026", "Ocak 2026'da " + S.tam(reel["2026-01"]) + " TL; zirvenin %" + Math.round((1 - reel["2026-01"] / reel["2024-01"]) * 100) + " altında");
t.gecsin("reel dip", "Temmuz 2022'deki " + S.tam(reel["2022-07"]) + " TL");
t.bitir();
