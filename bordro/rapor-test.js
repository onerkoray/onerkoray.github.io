#!/usr/bin/env node
/*!
 * Rapor parası çekirdeği — doğrulama. Çalıştırma: node bordro/rapor-test.js
 *
 * Beklenenler çekirdeğin içinden değil, elle türetilir:
 *   - oranlar ve gün sayıları 5510 m.17-18 metninden (1/2, 2/3, 90, 180,
 *     üçüncü gün, 8+16 hafta),
 *   - sınırlar bordro parametrelerinden ayrıca okunur (asgari ÷ 30),
 *   - örnek kişilerin tutarları yanlarında yazılı aritmetikle,
 *   - bordro etkisi motorun tek ay hesabıyla ve kimliklerle.
 */
"use strict";
var R = require("./rapor.js");
var B = require("./motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (t == null ? 0.01 : t); }
function baslik(s) { console.log("\n" + s); }
function hata(f, desen) { try { f(); return false; } catch (e) { return desen.test(e.message); } }

var A26 = B.donem(B.parametre(2026), 10).asgariBrut, ALT26 = A26 / 30;
var A25 = B.donem(B.parametre(2025), 12).asgariBrut, ALT25 = A25 / 30;
var T26 = B.donem(B.parametre(2026), 10).sgkTavan;

baslik("Kanunun sabitleri");
ok("ayakta 2/3, yatarak 1/2 (m.18/3)", R.ORAN.ayakta === 2 / 3 && R.ORAN.yatarak === 1 / 2);
ok("hastalık prim şartı 90 gün (m.18/b)", R.HASTALIK_PRIM_SARTI === 90);
ok("düşük prim eşiği 180 gün (m.17, 7537 s.K.)", R.DUSUK_PRIM_ESIGI === 180);
ok("analık 8 + 16 hafta, çoğulda önce 10 (m.18/c, 7578 s.K.)", R.ANALIK.once === 8 && R.ANALIK.sonra === 16 && R.ANALIK.onceCogul === 10);
ok("2026 günlük alt sınır = asgari ÷ 30 = 1.101", yakin(R.sinirlar("2026-10-05").gunlukAlt, 1101, 1e-9));

baslik("Hastalık, ayakta, 10 gün");
// Günlük kazanç 1.750 → ödenek 1.750 × 2/3 = 1.166,67; ilk 2 gün ödenmez → 8 × 1.166,67 = 9.333,33.
var h = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", ayaktaGun: 10, kazanc: 630000, gun: 360 });
ok("günlük kazanç 630.000 ÷ 360 = 1.750", yakin(h.gunlukKazanc, 1750));
ok("günlük ödenek 1.166,67", yakin(h.gunlukOdenek.ayakta, 1166.6667, 0.001));
ok("10 günün 2'si ödenmez, 8'i ödenir", h.raporGunu === 10 && h.odenmeyenGun === 2 && h.odenenGun === 8);
ok("toplam 9.333,33", yakin(h.toplam, 9333.33));
ok("bitiş 14 Ekim", h.bitis === "2026-10-14");

baslik("Yatarak ve ayakta birlikte");
// 4 gün yatarak + 6 gün ayakta, yatarak başladı: ödenmeyen 2 gün yatarak segmentinden düşer.
// Yatarak 2 × 875 = 1.750; ayakta 6 × 1.166,67 = 7.000 → 8.750.
var hy = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", yatarakGun: 4, ayaktaGun: 6, ilkYatarak: true, kazanc: 630000, gun: 360 });
ok("yatarak segmenti 2 gün ödenir", hy.segmentler[0].yatarak && hy.segmentler[0].odenenGun === 2);
ok("toplam 8.750", yakin(hy.toplam, 8750));
var ha = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", yatarakGun: 4, ayaktaGun: 6, ilkYatarak: false, kazanc: 630000, gun: 360 });
// Ayakta başladı: ayakta 4 × 1.166,67 = 4.666,67; yatarak 4 × 875 = 3.500 → 8.166,67.
ok("ayakta başlayınca 8.166,67", yakin(ha.toplam, 8166.67));

baslik("İş kazası ve meslek hastalığı: ilk günden, prim şartı yok");
var ik = R.hesapla({ tur: "isKazasi", baslangic: "2026-10-05", ayaktaGun: 10, kazanc: 30 * 1750, gun: 30 });
ok("30 gün primle de uygun", ik.uygun);
ok("10 günün hepsi ödenir", ik.odenenGun === 10 && ik.odenmeyenGun === 0);
ok("180 gün altı: kazanç 1.750 < 2 × 1.101, sınır işlemez", yakin(ik.gunlukKazanc, 1750));
var mh = R.hesapla({ tur: "meslekHastaligi", baslangic: "2026-10-05", ayaktaGun: 3, kazanc: 630000, gun: 360 });
ok("meslek hastalığı 3 gün = 3.500", yakin(mh.toplam, 3500));

baslik("Hastalıkta 90 gün şartı");
var h89 = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", ayaktaGun: 5, kazanc: 89 * 1500, gun: 89 });
var h90 = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", ayaktaGun: 5, kazanc: 90 * 1500, gun: 90 });
ok("89 gün: ödenek yok", !h89.uygun && h89.toplam === 0 && /90 gün/.test(h89.neden));
ok("90 gün: uygun, 3 gün × 1.000 = 3.000", h90.uygun && yakin(h90.toplam, 3000));

baslik("180 günden az prim: günlük kazanç ≤ 2 × alt sınır (7537 s.K.)");
var d = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", ayaktaGun: 5, kazanc: 120 * 3000, gun: 120 });
ok("3.000 yerine 2.202", yakin(d.gunlukKazanc, 2 * ALT26) && d.dusukPrim);
var d180 = R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", ayaktaGun: 5, kazanc: 180 * 3000, gun: 180 });
ok("tam 180 gün: sınır yok, 3.000", yakin(d180.gunlukKazanc, 3000) && !d180.dusukPrim);

baslik("Alt sınır");
var a = R.hesapla({ tur: "isKazasi", baslangic: "2026-10-05", ayaktaGun: 2, kazanc: 360 * 900, gun: 360 });
ok("900 TL kazanç alt sınıra (1.101) çekilir", yakin(a.gunlukKazanc, ALT26));
// Aralık 2025'te başlayan rapor Ocak 2026'ya taşar: Ocak günleri yeni alt sınırdan (m.18/4).
var g = R.hesapla({ tur: "isKazasi", baslangic: "2025-12-27", ayaktaGun: 10, kazanc: 360 * ALT25, gun: 360 });
// 5 Aralık günü × 866,85 × 2/3 + 5 Ocak günü × 1.101 × 2/3
var bek = 5 * ALT25 * 2 / 3 + 5 * ALT26 * 2 / 3;
ok("yıl değişiminde alt sınır yükselir: " + bek.toFixed(2), yakin(g.toplam, bek));
ok("iki aya bölünür", g.aylar.length === 2 && g.aylar[0].raporGunu === 5 && g.aylar[1].raporGunu === 5);

baslik("İkramiye sınırı (m.17/2-a)");
// Ücret 540.000 / 360 = 1.500; ikramiye ile 900.000 / 360 = 2.500 > 1,5 × 1.500 = 2.250.
var ikr = R.hesapla({ tur: "isKazasi", baslangic: "2026-10-05", ayaktaGun: 1, kazanc: 900000, gun: 360, ucretToplami: 540000 });
ok("2.500 değil 2.250", yakin(ikr.gunlukKazanc, 2250));

baslik("Analık");
var an = R.hesapla({ tur: "analik", baslangic: "2026-11-20", kazanc: 630000, gun: 360 });
ok("8 + 16 hafta = 168 gün", an.raporGunu === 168 && an.odenmeyenGun === 0);
ok("doğumdan önce 56 gün, 25 Eylül'den", an.segmentler[0].gun === 56 && an.segmentler[0].bas === "2026-09-25");
ok("ayakta oranı: 168 × 1.166,67 = 196.000", yakin(an.toplam, 196000, 0.05));
var co = R.hesapla({ tur: "analik", baslangic: "2026-11-20", cogul: true, kazanc: 630000, gun: 360 });
ok("çoğul gebelik 10 + 16 hafta = 182 gün", co.raporGunu === 182 && co.segmentler[0].gun === 70);
ok("2027 günleri parametresiz işaretlenir", an.parametreYok);
var an89 = R.hesapla({ tur: "analik", baslangic: "2026-11-20", kazanc: 89 * 1500, gun: 89 });
ok("analıkta da 90 gün şartı", !an89.uygun);

baslik("Kazanç türetme (maaştan 12 ay)");
var k = R.kazancTuret({ baslangic: "2026-10-05", brutSimdi: 60000, brutOnce: 50000, zamAyi: "2026-07" });
ok("12 ay: Ekim 2025 – Eylül 2026", k.aylar[0].anahtar === "2025-10" && k.aylar[11].anahtar === "2026-09");
ok("9 ay 50.000 + 3 ay 60.000 = 630.000", yakin(k.kazanc, 630000) && k.gun === 360);
var kt = R.kazancTuret({ baslangic: "2026-10-05", brutSimdi: 400000 });
// Ekim–Aralık 2025 tavanı 195.041,25; 2026 tavanı 297.270.
ok("her ay kendi tavanına çekilir", yakin(kt.aylar[0].pek, B.donem(B.parametre(2025), 10).sgkTavan) && yakin(kt.aylar[11].pek, T26));
var kc = R.kazancTuret({ baslangic: "2026-10-05", brutSimdi: 60000, calisilanAy: 4 });
ok("4 ay çalışmış: 120 gün, 240.000", kc.gun === 120 && yakin(kc.kazanc, 240000));
var ka = R.kazancTuret({ baslangic: "2026-10-05", brutSimdi: 20000 });
ok("asgari altı brüt alt sınıra çekilir", yakin(ka.aylar[11].pek, A26));

baslik("Raporlu ayın bordrosu");
var e = R.bordroEtkisi(h, { aylikBrut: 60000 }).aylar[0];
var P = B.parametre(2026);
// Motoru bağımsız kur: Ocak–Eylül 60.000 tam, Ekim 40.000 ve 20 gün.
var bir = { matrah: 0, asgariMatrah: 0 }, ekim = null;
for (var ay = 1; ay <= 10; ay++) {
  var r = B.hesaplaAy(ay === 10 ? 40000 : 60000, ay, P, bir, { gun: ay === 10 ? 20 : 30 });
  if (ay === 10) ekim = r;
}
ok("rapor ayında ücret 20 gün", e.ucretliGun === 20);
ok("rapor ayı neti motorla aynı", yakin(e.netMaas, ekim.net));
ok("ele geçen = net + ödenek", yakin(e.eleGecen, e.netMaas + 9333.33));
ok("fark = ele geçen − normal net", yakin(e.fark, e.eleGecen - e.netNormal));
ok("fark negatif (ödenek ücretin altında)", e.fark < 0);
var t = R.bordroEtkisi(h, { aylikBrut: 60000, politika: "tamamlar" }).aylar[0];
ok("işveren tamamlarsa fark 0, ödenek işverene", yakin(t.fark, 0) && t.odenek === 0 && t.ucretliGun === 30);
var i2 = R.bordroEtkisi(h, { aylikBrut: 60000, politika: "ilkIkiGun" }).aylar[0];
ok("işveren ilk iki günü öderse 22 gün ücret", i2.ucretliGun === 22);
ok("ilk iki gün ödenince fark küçülür", i2.fark > e.fark);
var ey = R.bordroEtkisi(h, { aylikBrut: 60000 }).yillar[0];
ok("yıl özeti: fark = rapor ayları + sonraki aylar", yakin(ey.fark, ey.raporAylariFarki + ey.sonrakiAylarVergi));
ok("tek raporlu ayda rapor ayları farkı = ay farkı", yakin(ey.raporAylariFarki, e.fark));
ok("düşen matrah sonraki ayların netini düşürmez (≥ 0)", ey.sonrakiAylarVergi >= 0);

baslik("Tam raporlu ay");
// 28 günlük şubatın tamamı raporlu: ücret 0 gün (30 − 28 = 2 değil).
var sb = R.hesapla({ tur: "isKazasi", baslangic: "2026-02-01", ayaktaGun: 28, kazanc: 720000, gun: 360 });
var sbe = R.bordroEtkisi(sb, { aylikBrut: 60000 }).aylar[0];
ok("şubatın 28 günü raporlu: ücretli gün 0", sbe.ucretliGun === 0 && sbe.netMaas === 0);
var ek31 = R.hesapla({ tur: "isKazasi", baslangic: "2026-10-01", ayaktaGun: 31, kazanc: 720000, gun: 360 });
ok("ekimin 31 günü raporlu: ücretli gün 0", R.bordroEtkisi(ek31, { aylikBrut: 60000 }).aylar[0].ucretliGun === 0);
var ek20 = R.hesapla({ tur: "isKazasi", baslangic: "2026-10-01", ayaktaGun: 20, kazanc: 720000, gun: 360 });
ok("kısmi ayda 30 gün üzerinden: 20 rapor → 10 ücretli", R.bordroEtkisi(ek20, { aylikBrut: 60000 }).aylar[0].ucretliGun === 10);

baslik("Doğum izni: yıl tek hesapla");
// 15 Ağustos 2026 doğum: 56 gün önce 20 Haziran, 112 gün sonra 4 Aralık. Haziran–Aralık.
var dg = R.hesapla({ tur: "analik", baslangic: "2026-08-15", kazanc: 630000, gun: 360 });
var dge = R.bordroEtkisi(dg, { aylikBrut: 60000 });
ok("yedi ay etkileniyor, hepsi 2026", dge.aylar.length === 7 && dge.yillar.length === 1);
ok("Temmuz–Kasım ücret 0 gün", dge.aylar.slice(1, 6).every(function (a) { return a.ucretliGun === 0 && a.netMaas === 0; }));
// Bağımsız kurulum: aynı yılı motorla tek seferde.
var bru = [], gun = [];
for (var k = 1; k <= 12; k++) { bru.push(60000); gun.push(30); }
dg.aylar.forEach(function (a) {
  var m = +a.ay.slice(5, 7), tam = a.raporGunu >= new Date(Date.UTC(2026, m, 0)).getUTCDate();
  var u = tam ? 0 : 30 - a.raporGunu; bru[m - 1] = 60000 * u / 30; gun[m - 1] = u;
});
var yr = B.hesaplaYil(bru, 2026, { gun: gun }), yn = B.hesaplaYil(bru.map(function () { return 60000; }), 2026, {});
ok("yıl farkı = motorun iki yıllık hesabı + ödenek", yakin(dge.yillar[0].fark, yr.toplam.net + dg.toplam - yn.toplam.net, 0.02));
ok("aralık neti birleşik yıldan (kümülatif matrah taşınır)", yakin(dge.aylar[6].netMaas, yr.aylar[11].net));

baslik("Hatalar");
ok("tür yoksa hata", hata(function () { R.hesapla({ tur: "x", baslangic: "2026-10-05" }); }, /türünü/));
ok("geçersiz tarih", hata(function () { R.hesapla({ tur: "hastalik", baslangic: "2026-02-30", ayaktaGun: 3, kazanc: 1, gun: 1 }); }, /tarih/));
ok("gün yoksa hata", hata(function () { R.hesapla({ tur: "hastalik", baslangic: "2026-10-05", kazanc: 1, gun: 1 }); }, /gün/));
ok("prim günü 360'ı aşamaz", hata(function () { R.hesapla({ tur: "isKazasi", baslangic: "2026-10-05", ayaktaGun: 1, kazanc: 1, gun: 400 }); }, /360/));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
