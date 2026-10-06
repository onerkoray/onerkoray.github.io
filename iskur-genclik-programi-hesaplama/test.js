#!/usr/bin/env node
/*!
 * İŞKUR GÜÇ programları — doğrulama. Çalıştırma:
 *   node iskur-genclik-programi-hesaplama/test.js
 *
 * Beklenenler İŞKUR'un kendi metinlerinden ve elle sayılan takvimden:
 *   - 1.375 TL/gün, 140 fiili gün, 10 ay, haftada 3 gün (İUP'de ilk dört
 *     hafta 5 gün), hane geliri net asgari ücretin 3 (Gençlik) ve 2 (İUP) katı;
 *   - İŞKUR'un "aylık 6.875–19.250 TL" aralığı = 5 ve 14 katılım günü;
 *   - takvim, motorun dışında gün gün yeniden sayılır.
 */
"use strict";
var I = require("./hesap.js");
var B = require("../bordro/motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (t == null ? 0.01 : t); }
function baslik(s) { console.log("\n" + s); }
function hata(f, desen) { try { f(); return false; } catch (e) { return desen.test(e.message); } }

baslik("İŞKUR'un açıkladığı sabitler");
ok("günlük cep harçlığı 2026: 1.375 TL", I.gunluk(2026) === 1375);
ok("toplam en çok 140 fiili gün, program en çok 10 ay", I.AZAMI_FIILI_GUN === 140 && I.AZAMI_AY === 10);
ok("prim oranı %5,5 (5510 m.5/1-e)", I.PRIM_ORANI === 0.055);
ok("İŞKUR'un aylık 6.875 TL'si = 5 gün", 5 * I.gunluk(2026) === 6875);
ok("İŞKUR'un aylık 19.250 TL'si = 14 gün", 14 * I.gunluk(2026) === 19250);
ok("kişi başı tavan: 140 × 1.375 = 192.500 TL = 19.250 × 10", 140 * 1375 === 192500 && 19250 * 10 === 192500);
ok("açıklanmamış yılın tutarı yok", I.gunluk(2027) === null);

baslik("Hane geliri sınırı");
var net = B.donem(B.parametre(2026), 10).asgariNet;
/* Net asgari ücret bordro parametresinden; burada kopyası tutulmaz. */
ok("net asgari ücret motordan geliyor", net > 0 && I.netAsgari(2026, 10) === net);
ok("Gençlik: 3 × net", yakin(I.haneSiniri("genclik", 2026, 10), 3 * net));
ok("İUP: 2 × net", yakin(I.haneSiniri("iup", 2026, 10), 2 * net));
ok("İUP sınırında uygun, 1 TL üstünde değil", I.haneUygun("iup", 2 * net, 2026, 10).uygun === true && I.haneUygun("iup", 2 * net + 1, 2026, 10).uygun === false);
ok("yurtta kalan için sınır aranmaz", I.haneUygun("genclik", 999999, 2026, 10, true).uygun === true);

/* Bağımsız sayım: başlangıçtan 10 ay boyunca, haftanın ilk k iş günü. */
function elle(bas, haftaGunuSayisi, ilkHafta, ilkGun, hak) {
  var p = bas.split("-").map(Number), t0 = Date.UTC(p[0], p[1] - 1, p[2]);
  var son = new Date(Date.UTC(p[0], p[1] - 1 + 10, p[2] - 1)).getTime();
  var pzt = t0 - ((new Date(t0).getUTCDay() + 6) % 7) * 864e5;
  var sayac = 0, aylar = {};
  for (var h = 0; sayac < hak && pzt + h * 7 * 864e5 <= son; h++) {
    var k = h < ilkHafta ? ilkGun : haftaGunuSayisi, n = 0;
    for (var d = 0; d < 5 && n < k && sayac < hak; d++) {
      var t = pzt + (h * 7 + d) * 864e5;
      if (t < t0 || t > son) continue;
      n++; sayac++;
      var ay = new Date(t).toISOString().slice(0, 7);
      aylar[ay] = (aylar[ay] || 0) + 1;
    }
  }
  return { gun: sayac, aylar: aylar };
}

baslik("Takvim: Gençlik Programı, haftada 3 gün, 2 Kasım 2026");
var g = I.takvim({ program: "genclik", baslangic: "2026-11-02", haftalikGun: 3 });
var ge = elle("2026-11-02", 3, 0, 3, 140);
ok("gün sayısı elle sayımla aynı", g.toplamGun === ge.gun, g.toplamGun + " / " + ge.gun);
ok("on ayda 140 güne ulaşmıyor", g.toplamGun < 140 && g.sinirDoldu === null);
ok("ay ay gün dağılımı elle sayımla aynı", g.aylar.every(function (a) { return ge.aylar[a.ay] === a.gun; }));
ok("beş haftalı ayda 15 gün: 20.625 TL (19.250 aylık tavan değil)", g.aylar.some(function (a) { return a.gun === 15 && a.tutar === 20625; }));
ok("2027 günleri 2026 tutarıyla ve işaretli", g.tutarVarsayimi === true && g.aylar.filter(function (a) { return a.ay >= "2027"; }).every(function (a) { return a.varsayim; }));
ok("toplam = gün × 1.375", g.toplam === g.toplamGun * 1375);
ok("emeklilik prim gününe eklenen: 0", g.primGunEmeklilik === 0);

baslik("Takvim: İşgücü Uyum Programı (NEET), 2 Kasım 2026");
var u = I.takvim({ program: "iup", baslangic: "2026-11-02" });
var ue = elle("2026-11-02", 3, 4, 5, 140);
ok("ilk dört hafta 5 gün: kasımda 21 gün, 28.875 TL", u.aylar[0].ay === "2026-11" && u.aylar[0].gun === 21 && u.aylar[0].tutar === 28875);
ok("gün sayısı elle sayımla aynı", u.toplamGun === ue.gun);
ok("140 güne ulaşır: 192.500 TL", u.toplamGun === 140 && u.toplam === 192500 && u.sinirDoldu !== null);
var u2 = I.takvim({ program: "iup", baslangic: "2026-11-02", oncekiGun: 100 });
ok("daha önce 100 gün yararlanan için kalan 40 gün", u2.toplamGun === 40 && u2.toplam === 55000);

baslik("Hatalar");
ok("Gençlik'te haftada 4 gün olmaz", hata(function () { I.takvim({ program: "genclik", baslangic: "2026-11-02", haftalikGun: 4 }); }, /1 ile 3/));
ok("140 günü dolduran yeniden yararlanamaz", hata(function () { I.takvim({ program: "iup", baslangic: "2026-11-02", oncekiGun: 140 }); }, /140/));
ok("tarih yoksa hata", hata(function () { I.takvim({ program: "iup", baslangic: "" }); }, /tarih/));

baslik("Net asgari ücretle karşılaştırma");
var k = I.asgariKarsilastirma(2026, 10);
ok("aylık 19.250, net asgarinin %68,6'sı", yakin(k.oran, 19250 / net, 1e-9) && k.oran.toFixed(3) === "0.686");
ok("saat başına 183,33 TL; net asgari 124,78 TL", yakin(k.saatlik, 1375 / 7.5) && yakin(k.asgariSaatlik, net / 225));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
