/*!
 * "Bir yıl daha çalışmak aylığı ne kadar artırır?" yazısının hesabı.
 *
 * Bugünkü kural sitenin emeklilik motorundan (5510 m.29, 506 Geçici m.82).
 * Kazanç güncellenmiş ortalama kazançtır ve örneklerde sabit tutulur: soru
 * yalnız prim gününün etkisini ölçer. Bordro karşılaştırması bordro motorundan.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";

var EM = require("../../bordro/emeklilik-motor.js");
var B = require("../../bordro/motor.js");

var YIL = 2026;
var GIRIS = "2009-01-01", BITIS = "2045-01-01";   // yalnız 5510 m.29 dönemi
var ASGARI_BRUT = B.parametre(YIL).donemler[0].asgariBrut;
var SGDP_ISCI = B.parametre(YIL).oranlar.sgdpIsci;
var KAZANCLAR = [ASGARI_BRUT, 60000, 100000];
var GUNLER = [7200, 7560, 7920, 9000, 10800];

function aylik(gun, kazanc, giris, bitis) {
  return EM.hesapla({ primGun: gun, ortalamaKazanc: kazanc, baslangic: giris || GIRIS, bitis: bitis || BITIS });
}
function abo(gun) { return aylik(gun, 60000).karmaAbo; }
function taban() { return aylik(7200, 60000).altSinir.tutar; }

/* Aylığın geciken 12 ödemesi, artan aylıkla kaç yılda geri gelir: 1 / artış oranı. */
function geriDonus(g0, g1) { return 1 / (abo(g1) / abo(g0) - 1); }

function tablo() {
  return GUNLER.map(function (g) {
    return { gun: g, abo: abo(g), aylar: KAZANCLAR.map(function (k) { return aylik(g, k).odenenAylik; }) };
  });
}

function yilEtkisi() {
  return [7200, 9000].map(function (g) {
    return { gun: g, abo0: abo(g), abo1: abo(g + 360), artis: abo(g + 360) / abo(g) - 1, donus: geriDonus(g, g + 360) };
  });
}

/* 2000–2008 girişli örnek: kademeli ABO'lu dönem karışınca etki. */
function eskiGiris() {
  var a = aylik(7200, 60000, "2005-01-01", "2025-01-01"), b = aylik(7560, 60000, "2005-01-01", "2026-01-01");
  return { abo0: a.karmaAbo, abo1: b.karmaAbo, artis: b.kokAylik / a.kokAylik - 1, donus: 1 / (b.kokAylik / a.kokAylik - 1) };
}

/* Hesaplanan aylığın tabanı geçtiği ortalama kazanç. */
function tabanEsigi(gun) { return taban() / abo(gun); }

/* Asgari ücretten prim ödeyenin tabanı geçmesi için gereken gün. */
function asgariGereken() {
  var hedefAbo = taban() / ASGARI_BRUT, gun = hedefAbo / 0.02 * 360;
  return { abo: hedefAbo, gun: gun, yil: gun / 360, fazlaYil: (gun - 7200) / 360 };
}

/* 60.000 TL brütle çalışan, 7.200 günü dolunca: aylığı ertelemek ya da bağlatıp çalışmak. */
function ikiYol() {
  var brut = 60000, a0 = aylik(7200, brut).odenenAylik, a1 = aylik(7560, brut).odenenAylik;
  var netNormal = B.hesaplaYil(brut, YIL).toplam.net;
  var netSgdp = B.hesaplaYil(brut, YIL, { sgdp: true }).toplam.net;
  var erteleme = netNormal, baglatma = netSgdp + 12 * a0;
  return { brut: brut, a0: a0, a1: a1, artisAy: a1 - a0, netNormal: netNormal, netSgdp: netSgdp,
    erteleme: erteleme, baglatma: baglatma, fark: baglatma - erteleme,
    donus: (baglatma - erteleme) / ((a1 - a0) * 12) };
}

module.exports = {
  YIL: YIL, ASGARI_BRUT: ASGARI_BRUT, SGDP_ISCI: SGDP_ISCI, KAZANCLAR: KAZANCLAR, GUNLER: GUNLER,
  aylik: aylik, abo: abo, taban: taban, geriDonus: geriDonus, tablo: tablo, yilEtkisi: yilEtkisi,
  eskiGiris: eskiGiris, tabanEsigi: tabanEsigi, asgariGereken: asgariGereken, ikiYol: ikiYol
};
