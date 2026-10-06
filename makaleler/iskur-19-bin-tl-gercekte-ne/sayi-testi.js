#!/usr/bin/env node
/*
 * "İŞKUR'dan 19 bin TL: gerçekte ne ödeniyor?" yazısının sayıları.
 * Her değer yazının modülünden (guc.js) gelir; modül tutar ve takvimi
 * aracın çekirdeğinden (iskur-genclik-programi-hesaplama/hesap.js),
 * program göstergelerini GÜÇ anlık görüntüsünden okur. Test önce modülü
 * bağımsız aritmetikle sınar, sonra her rakamın sayfada göründüğünü doğrular.
 *
 * Kullanım: node makaleler/iskur-19-bin-tl-gercekte-ne/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var G = require("./guc.js");
var I = G.I;
var t = S.yazi(__dirname);

function tl(v) { return S.tam(v) + " TL"; }
function yz(o) { return "%" + S.yuzde(o, 1); }
function htmlde(ad, x) { t.dogru(ad, t.html.indexOf(x) !== -1, "HTML'de yok: " + x); }

/* 1 — Günlük tutar ve ondan türeyen aylıklar. */
var gun = I.gunluk(2026);
t.yakin("günlük 1.375", gun, 1375, 0);
t.gecsin("günlük", "1.375 TL");
t.yakin("19.250 = 14 gün", 14 * gun, 19250, 0);
t.gecsin("19.250 TL", tl(14 * gun));
t.gecsin("14 günün karşılığı", "19.250 TL ayda 14 günün karşılığı");
t.gecsin("15 gün", "15 gün katılıp " + tl(15 * gun));
t.gecsin("12 gün", "12 gün katılıp " + tl(12 * gun));
t.gecsin("12–15 gün", "ayda 12–15 gün");

/* 2 — Kişi başı tavan: 140 fiili gün. */
t.yakin("140 gün", I.AZAMI_FIILI_GUN, 140, 0);
t.gecsin("192.500 TL", tl(I.AZAMI_FIILI_GUN * gun));
t.gecsin("140 fiili gün", "140 fiili gün");
t.gecsin("en çok 10 ay", "en çok 10 ay");

/* 3 — Örnek iki genç (2 Kasım 2026). */
var o = G.ornekler();
var gt = o.genclik.aylar.reduce(function (s, a) { return s + a.gun; }, 0);
t.yakin("Gençlik ay toplamı = toplam gün", gt, o.genclik.toplamGun, 0);
t.yakin("Gençlik tutarı = gün × 1.375", o.genclik.toplam, o.genclik.toplamGun * gun, 0);
t.dogru("Gençlik tavana ulaşmıyor", o.genclik.toplamGun < 140);
t.dogru("Gençlik aylık en çok 15 gün", o.genclik.aylar.every(function (a) { return a.gun <= 15; }));
t.gecsin("Gençlik 132 gün", "on ayda " + o.genclik.toplamGun + " güne ulaşıp " + tl(o.genclik.toplam));
t.yakin("İUP 140 gün", o.iup.toplamGun, 140, 0);
t.yakin("İUP tutarı", o.iup.toplam, 140 * gun, 0);
t.dogru("İUP ilk ay en yüksek", o.iup.aylar[0].tutar === Math.max.apply(null, o.iup.aylar.map(function (a) { return a.tutar; })));
t.gecsin("İUP toplam", "toplam " + o.iup.toplamGun + " güne ulaşıp " + tl(o.iup.toplam));
t.gecsin("2 Kasım", "2 Kasım 2026");

/* 4 — Saatlik karşılaştırma: günde 7,5 saat, net asgari 30 gün × 7,5 saat. */
var k = I.asgariKarsilastirma(2026, 10);
t.yakin("saatlik = 1.375 / 7,5", k.saatlik, gun / 7.5, 1e-9);
t.yakin("asgari saatlik", k.asgariSaatlik, I.netAsgari(2026, 10) / 225, 1e-9);
t.yakin("oran = 19.250 / net asgari", k.oran, 14 * gun / I.netAsgari(2026, 10), 1e-9);
t.gecsin("saatlik", "saati " + S.tl(k.saatlik) + " TL");
t.gecsin("asgari saatlik", S.tl(k.asgariSaatlik) + " TL");
t.gecsin("oran", yz(k.oran));
t.dogru("saatlik asgariden yüksek", k.saatlik > k.asgariSaatlik);

/* 5 — Hane geliri sınırları: net asgari × 3 ve × 2. */
t.yakin("hane 3 kat", I.haneSiniri("genclik", 2026, 10), 3 * I.netAsgari(2026, 10), 0.005);
t.yakin("hane 2 kat", I.haneSiniri("iup", 2026, 10), 2 * I.netAsgari(2026, 10), 0.005);
t.gecsin("hane kat", "net asgari ücretin 3 ve 2 katı");

/* 6 — Sigorta: emeklilik prim günü sıfır. */
t.yakin("emeklilik günü 0", o.genclik.primGunEmeklilik, 0, 0);
t.yakin("prim %5,5", I.PRIM_ORANI, 0.055, 1e-12);
t.gecsin("prim %5,5", "%5,5");
t.gecsin("5510 m.5/1-e", "5510 s.K. m.5/1-e");

/* 7 — GÜÇ göstergeleri. */
var V = G.VERI;
var toplamG = V.programlar.reduce(function (s, p) { return s + p.gerceklesen; }, 0);
t.yakin("programların toplamı = portal toplamı", toplamG, V.toplam.hizmetSunulan, 0);
/* Program hedefleri portalın genel hedefine toplanmıyor (genel hedef ayrı konmuş); toplanan yalnız kaynak. */
t.yakin("kaynakların toplamı = 472,3 mlr", G.kaynakToplami(), V.toplam.ucYilKaynakMilyar, 1e-9);
t.gecsin("toplam genç", S.tam(V.toplam.hizmetSunulan) + " genç");
t.gecsin("hedef 1 milyon", "hedefi 1 milyon");
var niup = G.program("niup");
t.gecsin("NEET oranı", yz(G.oran(niup)));
t.gecsin("NEET kadın", yz(niup.kadin / niup.gerceklesen));
t.dogru("İlk Adım en büyük kaynak", V.programlar.every(function (p) { return (p.kaynakMilyar || 0) <= G.program("ilkadim").kaynakMilyar; }));
t.gecsin("İlk Adım 243 milyar", S.tam(G.program("ilkadim").kaynakMilyar) + " milyar TL");
t.yakin("İlk Adım başlamadı", G.program("ilkadim").gerceklesen, 0, 0);
t.dogru("staj hedefi aşıldı", G.oran(G.program("staj")) > 1);

/* 8 — Kapak alt metni: beş oran. */
["staj", "meslek", "genclik", "niup", "ilkadim"].forEach(function (kd) {
  htmlde("kapak " + kd, yz(G.oran(G.program(kd))));
});

t.bitir("Gençlik " + o.genclik.toplamGun + " gün " + tl(o.genclik.toplam) + "; İUP " + tl(o.iup.toplam) + "; GÜÇ " + S.tam(toplamG) + " genç.");
