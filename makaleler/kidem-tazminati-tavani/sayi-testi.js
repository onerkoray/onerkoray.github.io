#!/usr/bin/env node
/*
 * "Kıdem tazminatı tavanı" yazısının elle yazılmış tabloları.
 *
 * Tavan tablosunu tools/kidem-tavan-tablosu.js yazıyor. Yazıda üreteçten
 * geçmeyen iki tablo daha var: yol-yemek yardımının kıdeme katkısı ve
 * giydirilmiş brüte göre hesaba esas ücret. İkisi de bu test ile çıkış
 * paketinin motorundan (bordro/cikis.js) üretiliyor: istifa yazısıyla aynı
 * 10 yıllık çalışan, 1 Eylül 2026 çıkış, işveren feshi.
 *
 * Kullanım: node makaleler/kidem-tazminati-tavani/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var CK = require(path.join(S.KOK, "bordro", "cikis.js"));
var t = S.yazi(__dirname);

var GIRIS = "2016-09-01", CIKIS = "2026-09-01", YARDIM = 7000;
function kidem(ciplak, ek) {
  return CK.hesapla({ iseGiris: GIRIS, cikis: CIKIS, ciplakBrut: ciplak, giydirmeEkleri: ek, fesihTuru: "isveren" }).kidem;
}
var tavan = CK.kidemTavani(CIKIS);

/* Dönem tavanları ve artış oranları. */
var donemler = ["2025-01-01", "2025-07-01", "2026-01-01", "2026-07-01"].map(CK.kidemTavani);
for (var i = 1; i < donemler.length; i++) {
  t.gecsin("artış oranı " + i, S.tl(donemler[i]) + " TL %" + S.yuzde(donemler[i] / donemler[i - 1] - 1));
}
t.gecsin("çıkıştaki tavan", "tavan " + S.tl(tavan) + " TL");
t.gecsin("ilk yarı tavanı", "(Ocak–Haziran: " + S.tl(CK.kidemTavani("2026-01-01")) + " TL)");

/* Yardımın katkısı: tavanın altında büyük, üstünde sıfır. */
[66000, 90000].forEach(function (c) {
  var a = kidem(c, 0).net, b = kidem(c, YARDIM).net;
  t.gecsin(c + " TL satırı", S.tam(c) + " TL " + S.tl(a) + " TL " + S.tl(b) + " TL " +
    (b - a > 0.005 ? "+" : "") + S.tl(b - a) + " TL");
});
t.gecsin("yardım tutarı", "Aylık " + S.tam(YARDIM) + " TL’lik yol ve yemek");
t.gecsin("tavana kalan çıplak brüt", "çıplak brütte yaklaşık " + S.tam(tavan - YARDIM) + " TL");

/* Hesaba esas ücret tablosu. */
[67000, 73000, 73730, 90000, 160000].forEach(function (g) {
  var k = kidem(g, 0);
  var esas = S.tl(Math.min(g, tavan)) + " TL" + (k.tavanUygulandi ? " (tavan)" : "");
  t.gecsin(g + " TL giydirilmiş", S.tam(g) + " TL " + esas + " " + S.tl(k.net) + " TL");
});
t.yakin("90.000 ile 150.000 aynı kıdemi alıyor", kidem(90000, 0).net, kidem(150000, 0).net);

t.bitir();
