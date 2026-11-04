#!/usr/bin/env node
/*
 * "Bir yıl daha çalışmak emekli aylığını ne kadar artırır?" yazısının sayıları.
 * Kural 5510 m.29'dan elle yeniden kurulur (her 360 gün için %2), sonuç
 * sitenin emeklilik motoruyla karşılaştırılır. Bloğu tools/sgk-kasim-yazilari.js yazar.
 *
 * Kullanım: node makaleler/bir-yil-daha-calismak-aylik/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./bir-yil.js");
var EP = require("../../bordro/emeklilik-parametreleri.js");
var B = require("../../bordro/motor.js");
var t = S.yazi(__dirname);
function htmlde(ad, m) { t.dogru(ad, t.html.indexOf(m) >= 0, "HTML'de yok: " + m); }

function y1(o) { return "%" + (o * 100).toFixed(1).replace(".", ","); }
function tl(v) { return Math.round(v).toLocaleString("tr-TR"); }

/* 1 — Kural: oran gün / 360 × %2, en çok %90. */
function oran(g) { return Math.min(0.9, g / 360 * 0.02); }
t.dogru("m.29 birimi %2", EP.abo.m29.kademeler[0][1] === 0.02);
t.dogru("m.29 tavanı %90", EP.abo.m29.tavan === 0.9);
var taban = EP.altSinirAylik("2026-11-01").tutar;
t.dogru("taban 23.552", taban === M.taban() && taban === 23552, taban);

/* 2 — Tablo: motor ve elle kural aynı; satırlar sayfada. */
M.tablo().forEach(function (r) {
  t.yakin(r.gun + " gün oranı", r.abo, oran(r.gun), 1e-12);
  var el = M.KAZANCLAR.map(function (k) { return Math.max(taban, k * oran(r.gun)); });
  el.forEach(function (v, i) { t.yakin(r.gun + " gün aylık " + i, r.aylar[i], v, 1e-6); });
  htmlde(r.gun + " satırı", '<th scope="row">' + tl(r.gun) + '</th><td class="num">' + y1(oran(r.gun)) + '</td><td class="num">' + el.map(tl).join('</td><td class="num">') + "</td>");
});
t.dogru("asgari brüt 10.800 günde de tabanda", M.aylik(10800, M.ASGARI_BRUT).odenenAylik === taban);

/* 3 — Kısa cevap. */
var e = M.yilEtkisi();
t.yakin("7.200 → 7.560 artışı", e[0].artis, oran(7560) / oran(7200) - 1, 1e-12);
t.yakin("geri dönüş 20 yıl", e[0].donus, 20, 1e-6);
t.yakin("9.000 gün geri dönüş 25 yıl", e[1].donus, 25, 1e-6);
t.gecsin("kısa cevap oranlar", "%40'tan %42'ye çıkan oran aylığı %5 büyütür");
htmlde("kısa cevap dönüş", "<strong>20 yılda</strong>");

/* 4 — Taban eşikleri. */
var esik = taban / oran(7200);
t.yakin("eşik kazanç", M.tabanEsigi(7200), esik, 1e-6);
t.gecsin("eşik sayfada", tl(esik) + " TL'nin altında");
var ag = taban / M.ASGARI_BRUT, gun = ag / 0.02 * 360;
t.dogru("asgari brüt 2026", M.ASGARI_BRUT === B.parametre(2026).donemler[0].asgariBrut);
t.gecsin("gereken oran", "oranının " + y1(ag) + " olması");
t.gecsin("gereken gün", tl(gun) + " gün demek");
t.gecsin("gereken yıl", "yaklaşık " + Math.round(gun / 360) + " yıl prim");
t.gecsin("fazla yıl", "7.200 günün " + Math.round((gun - 7200) / 360) + " yıl üstü");

/* 5 — 2005 girişli örnek motordan. */
var s = M.eskiGiris();
t.dogru("eski girişte oran daha yüksek", s.abo0 > oran(7200));
t.gecsin("eski giriş satırı", y1(s.abo0) + " → " + y1(s.abo1));
t.gecsin("eski giriş dönüş", Math.round(s.donus) + " yıl");

/* 6 — İki yol: bordro motoru. */
var iy = M.ikiYol(), n0 = B.hesaplaYil(60000, 2026).toplam.net, n1 = B.hesaplaYil(60000, 2026, { sgdp: true }).toplam.net;
t.yakin("net normal", iy.netNormal, n0, 1e-6);
t.yakin("net SGDP", iy.netSgdp, n1, 1e-6);
t.dogru("SGDP'li net daha yüksek", n1 > n0);
var fark = n1 + 12 * 24000 - n0;
t.yakin("yıl sonu farkı", iy.fark, fark, 1e-6);
t.gecsin("fark sayfada", tl(fark) + " TL önde");
t.gecsin("dönüş sayfada", "yaklaşık " + Math.round(fark / (1200 * 12)) + " yılda kapatıyor");
t.gecsin("SGDP işçi payı", "İşçi payı " + y1(M.SGDP_ISCI));
t.gecsin("SSS farkı", "yaklaşık " + Math.round(fark / 1000) + " bin TL önde");
t.gecsin("SSS kapanış", "yaklaşık " + Math.round(fark / (1200 * 12)) + " yılda kapanıyor");

/* 7 — Sitenin kuralı: sayfada kişi ya da siyasi kuruluş adı yok. */
t.dogru("kişi adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|\bAK Parti\b|\bMHP\b|\bCHP\b/.test(t.html));

t.bitir("Kaynak: 5510 m.29, emeklilik ve bordro motorları.");
