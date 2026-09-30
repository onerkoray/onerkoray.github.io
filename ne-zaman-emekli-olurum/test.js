#!/usr/bin/env node
/*!
 * Emeklilik tarihi çekirdeği — doğrulama. Çalıştırma: node ne-zaman-emekli-olurum/test.js
 *
 * Beklenenler çekirdeğin içinden değil, ikinci bir yoldan kurulur:
 *   - tablolar kanun metninin satırlarıyla tek tek (506 Geçici m.81/B-C,
 *     1479 Geçici m.10, 5510 m.28/2-b, Geçici m.6/7-b),
 *   - örnek kişilerin tarihleri elle türetildi; her birinin yanında türetme
 *     adımları yazılı (yaş günü + N yıl, eksik gün ÷ 30 → ay, ayın son günü),
 *   - borçlanma bedeli bordro parametrelerinden ayrıca kurulur
 *     (gün × asgari brüt ÷ 30 × oran), SgkPrim ile karşılaştırılır,
 *   - sayfa örneği üreteçle aynı.
 */
"use strict";
var path = require("path");
var fs = require("fs");
var cp = require("child_process");
var E = require("./hesap.js");
var B = require("../bordro/motor.js");
var EP = require("../bordro/emeklilik-parametreleri.js");
var KOK = path.join(__dirname, "..");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function baslik(s) { console.log("\n" + s); }
var BUGUN = "2026-09-30";
function h(g) { return E.hesapla(Object.assign({ bugun: BUGUN }, g)); }
function yolu(r, kod) { return r.yollar.filter(function (y) { return y.kod === kod; })[0]; }

baslik("Tablolar kanun metniyle aynı");
var b81 = E.tablolar.b81;
ok("81/B kadın 17 satır (a–r, 'ğ' ve 'ş' yok)", b81.kadin.satirlar.length === 17);
ok("81/B erkek 15 satır (a–o)", b81.erkek.satirlar.length === 15);
ok("81/B kadın 20, erkek 25 yıl sigortalılık", b81.kadin.sure === 20 && b81.erkek.sure === 25);
ok("81/B gün: 5000'den 75'er artıp 5975'te durur",
  [b81.kadin, b81.erkek].every(function (t) {
    return t.satirlar.every(function (s, i) {
      var bek = Math.min(5975, Math.max(5000, 5000 + (i - 1) * 75));
      return s[1] === bek;
    });
  }));
ok("81/B (c) erkek: 20 yıl → 5075 gün, EYT öncesi 46 yaş",
  JSON.stringify(b81.erkek.satirlar[2]) === JSON.stringify([[20, 0, 0], 5075, 46, "c"]));
ok("81/B (o) erkek alt sınır 2 yıl 8 ay 15 gün, 58 yaş",
  JSON.stringify(b81.erkek.satirlar[14].slice(0, 3)) === JSON.stringify([[2, 8, 15], 5975, 58]));
ok("81/B (r) kadın alt sınır 2 yıl 8 ay 15 gün, 56 yaş",
  JSON.stringify(b81.kadin.satirlar[16].slice(0, 3)) === JSON.stringify([[2, 8, 15], 5975, 56]));
ok("81/B yaşlar yıl yıl artar (kadın 40–56, erkek 44–58)",
  b81.kadin.satirlar.every(function (s, i) { return s[2] === 40 + i; }) &&
  b81.erkek.satirlar.every(function (s, i) { return s[2] === 44 + i; }));
ok("81/C kademeleri: 50/55, 52/56, 54/57, 56/58, 58/59, 58/60",
  JSON.stringify(E.tablolar.c81.map(function (x) { return [x[1], x[2]]; })) ===
  JSON.stringify([[50, 55], [52, 56], [54, 57], [56, 58], [58, 59], [58, 60]]));
ok("1479 Geçici 10/3: 51/56, 52/56, 53/57, 54/57, 56/58",
  JSON.stringify(E.tablolar.kismi1479.slice(1).map(function (x) { return [x[1], x[2]]; })) ===
  JSON.stringify([[51, 56], [52, 56], [53, 57], [54, 57], [56, 58]]));

baslik("5510 m.28/2-b: yaş, gün şartının dolduğu tarihe göre");
var y28 = E.yardimci.yas28;
[["2035-12-31", 58, 60], ["2036-01-01", 59, 61], ["2037-12-31", 59, 61], ["2038-01-01", 60, 62],
 ["2040-06-01", 61, 63], ["2042-01-01", 62, 64], ["2044-01-01", 63, 65], ["2046-01-01", 64, 65],
 ["2047-12-31", 64, 65], ["2048-01-01", 65, 65], ["2060-01-01", 65, 65]].forEach(function (x) {
  ok(x[0] + " → kadın " + x[1] + ", erkek " + x[2], y28("kadin", x[0]) === x[1] && y28("erkek", x[0]) === x[2]);
});

baslik("Geçici m.6/7-b: 4/a kısmi gün, başlangıç yılına göre");
var kg = E.yardimci.kismiGun4a;
[["2008-05-01", 4600], ["2008-12-31", 4600], ["2009-01-01", 4700], ["2012-07-01", 5000],
 ["2015-12-31", 5300], ["2016-01-01", 5400], ["2024-03-01", 5400]].forEach(function (x) {
  ok(x[0] + " → " + x[1], kg(x[0]) === x[1], kg(x[0]));
});

baslik("Prim günü ilerlemesi (ay sonu)");
var gt = E.yardimci.gunTarihi;
// 7000 → 7200: 200 gün ÷ 30 = 6,67 → 7 ay; Eylül + 7 = Nisan 2027, ayın son günü.
ok("200 eksik gün, tam çalışma → 30 Nisan 2027", gt(7000, 7200, 360, BUGUN).tarih === "2027-04-30");
// yılda 180 gün → ayda 15: 200 ÷ 15 = 13,3 → 14 ay; Eylül + 14 = Kasım 2027.
ok("yılda 180 gün → 30 Kasım 2027", gt(7000, 7200, 180, BUGUN).tarih === "2027-11-30");
ok("tam 30'un katı: 60 eksik → 2 ay → 30 Kasım 2026", gt(7140, 7200, 360, BUGUN).tarih === "2026-11-30");
ok("şubat sonu: 150 eksik → 5 ay → 28 Şubat 2027", gt(7050, 7200, 360, BUGUN).tarih === "2027-02-28");
ok("şart zaten dolmuş → bugün", gt(7300, 7200, 360, BUGUN).tarih === BUGUN);
ok("prim ödenmiyorsa hiç dolmaz", gt(7000, 7200, 0, BUGUN).tarih === null);

baslik("EYT, 4/a: 1975 doğumlu erkek, 1 Haziran 1995 girişli, 5000 gün");
// 23.5.2002'de sigortalılık 6 yıl 11 ay 22 gün → erkek (l) satırı: 6 yıl 6 ay ve üstü → 5750 gün.
// 25 yıl: 1.6.1995 + 25 = 1.6.2020 (geçmiş). 750 eksik gün ÷ 30 = 25 ay → Eylül 2026 + 25 = Ekim 2028.
var r1 = h({ dogum: "1975-03-10", cinsiyet: "erkek", statu: "4a", ilkGiris: "1995-06-01", primGun: 5000 });
ok("grup EYT", r1.grup === "eyt");
ok("23.5.2002'de süre 6 yıl 11 ay 22 gün", JSON.stringify(yolu(r1, "tam").sure2002) === JSON.stringify({ yil: 6, ay: 11, gun: 22 }));
ok("(l) bendi, 5750 gün", yolu(r1, "tam").bent === "l" && yolu(r1, "tam").kosullar[1].gereken === 5750);
ok("EYT olmasaydı 55 yaş", yolu(r1, "tam").eytOncesiYas === 55);
ok("en erken 31 Ekim 2028, bağlayıcı prim günü", r1.tarih === "2028-10-31" && r1.enErken.bagli === "Prim günü");
ok("aylık 1 Kasım 2028'de başlar", r1.aylikBaslangici === "2028-11-01");
// 81/C: 15 yıl (2010), 3600 gün (geçmiş), 55 yaş (10.3.2030) → tamamlanma 2030 → 24.5.2014 sonrası: 60 yaş → 10.3.2035.
ok("yaştan yol: 60 yaş, 10 Mart 2035", yolu(r1, "kismi").tarih === "2035-03-10");

baslik("Tek günün farkı: 7 ve 8 Eylül 1999");
// Aynı kişi (1.1.1981 doğumlu erkek, 6500 gün). 7 Eylül: EYT, 23.5.2002'de 2 yıl 8 ay 16 gün → (o) 5975 gün;
// 25 yıl 7.9.2024'te doldu → bugün hak sahibi. 8 Eylül: Geçici m.9 → 60 yaş, 1.1.2041.
var a7 = h({ dogum: "1981-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "1999-09-07", primGun: 6500 });
var a8 = h({ dogum: "1981-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "1999-09-08", primGun: 6500 });
ok("7 Eylül: EYT, bugün hak sahibi", a7.grup === "eyt" && a7.tarih === BUGUN && a7.enErken.tamam);
ok("8 Eylül: Geçici m.9, 1 Ocak 2041", a8.grup === "gecis" && a8.tarih === "2041-01-01");
ok("8 Eylül: EYT sınırına 1 gün", a8.eytSinirinaGun === 1);

baslik("18 yaş kuralı (m.38/2, Geçici m.6/1)");
// 15.1.1982 doğumlu, 1.7.1998'de 16 yaşında giriş → süre 15.1.2000'den; 23.5.2002'de 2 yıl 4 ay 8 gün:
// tablonun altı → en alt satır ve uyarı. 20 yıl: 15.1.2020.
var r2 = h({ dogum: "1982-01-15", cinsiyet: "kadin", statu: "4a", ilkGiris: "1998-07-01", primGun: 6000 });
ok("süre 18. yaş gününden", r2.onsekizKurali && r2.sureBaslangici === "2000-01-15");
ok("grup yine EYT (tescil tarihine göre)", r2.grup === "eyt");
ok("tablo altı → 5975 gün ve uyarı notu", yolu(r2, "tam").kosullar[1].gereken === 5975 &&
  r2.notlar.some(function (n) { return /tablonun en alt/.test(n); }));
ok("20 yıl 15 Ocak 2020'de doldu", yolu(r2, "tam").kosullar[0].tarih === "2020-01-15");
var r2b = h({ dogum: "1964-01-15", cinsiyet: "kadin", statu: "4a", ilkGiris: "1980-07-01", primGun: 6000 });
ok("1 Nisan 1981 öncesi tescilde kural yok", !r2b.onsekizKurali && r2b.sureBaslangici === "1980-07-01");

baslik("8 Eylül 1999 – 30 Nisan 2008, 4/a (Geçici m.9/1)");
// 20.5.1980 kadın, 1.2.2003, 5000 gün: 58 yaş → 20.5.2038. 7000 gün: 2000 ÷ 30 = 67 ay → Nisan 2032.
// 25 yıl: 1.2.2028; 4500 gün dolu. İki yol da yaşta birleşir.
var r3 = h({ dogum: "1980-05-20", cinsiyet: "kadin", statu: "4a", ilkGiris: "2003-02-01", primGun: 5000 });
ok("7000 gün 30 Nisan 2032", yolu(r3, "tam").kosullar[1].tarih === "2032-04-30");
ok("25 yıl 1 Şubat 2028", yolu(r3, "sure25").kosullar[1].tarih === "2028-02-01");
ok("en erken 20 Mayıs 2038, yaş bağlayıcı", r3.tarih === "2038-05-20" && r3.enErken.bagli === "Yaş");
ok("kademeli emeklilik notu", r3.notlar.some(function (n) { return /kademeli/.test(n); }));

baslik("30 Nisan / 1 Mayıs 2008 sınırı");
var s30 = h({ dogum: "1985-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "2008-04-30", primGun: 3000 });
var s01 = h({ dogum: "1985-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "2008-05-01", primGun: 3000 });
ok("30 Nisan: Geçici m.9 (7000 gün)", s30.grup === "gecis" && yolu(s30, "tam").kosullar[1].gereken === 7000);
ok("1 Mayıs: m.28 (7200 gün, kısmi 4600)", s01.grup === "yeni" && yolu(s01, "tam").kosullar[0].gereken === 7200 &&
  yolu(s01, "kismi").kosullar[0].gereken === 4600);
ok("1 Mayıs: geçiş sınırına 1 gün", s01.gecisSinirinaGun === 1);

baslik("1 Mayıs 2008 sonrası (m.28)");
// 1.1.1990 erkek, 1.9.2012, 4000 gün. 7200: 3200 ÷ 30 = 106,7 → 107 ay → Ağustos 2035 (2036 öncesi) → 60 yaş → 1.1.2050.
// Kısmi: 2012 başlangıç → 5000 gün; 1000 ÷ 30 = 33,3 → 34 ay → Temmuz 2029 → 60 + 3 = 63 → 1.1.2053.
var r4 = h({ dogum: "1990-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "2012-09-01", primGun: 4000 });
ok("7200 gün 31 Ağustos 2035", yolu(r4, "tam").kosullar[0].tarih === "2035-08-31");
ok("tam: 60 yaş, 1 Ocak 2050", yolu(r4, "tam").tarih === "2050-01-01");
ok("kısmi: 5000 gün, 63 yaş, 1 Ocak 2053", yolu(r4, "kismi").kosullar[0].gereken === 5000 && yolu(r4, "kismi").tarih === "2053-01-01");
// 15.6.2000 kadın, 1.3.2020, 1500 gün. 7200: 5700 ÷ 30 = 190 ay → Temmuz 2042 → 62 yaş → 15.6.2062.
// Kısmi 5400: 3900 ÷ 30 = 130 ay → Temmuz 2037 → 59 + 3 = 62 → aynı gün.
var r5 = h({ dogum: "2000-06-15", cinsiyet: "kadin", statu: "4a", ilkGiris: "2020-03-01", primGun: 1500 });
ok("kademe: 7200 gün 2042'de → 62 yaş", yolu(r5, "tam").kosullar[1].gereken === 62 && yolu(r5, "tam").kosullar[1].kademe);
ok("iki yol 15 Haziran 2062'de", yolu(r5, "tam").tarih === "2062-06-15" && yolu(r5, "kismi").tarih === "2062-06-15");
// Kısmi yaş 65'i geçmez: 2046'da gün dolduran erkek 65 + 3 değil 65.
var r6 = h({ dogum: "2004-01-01", cinsiyet: "erkek", statu: "4b", ilkGiris: "2024-01-01", primGun: 0 });
// 4/b kısmi 5400: 5400 ÷ 30 = 180 ay → Eylül 2041 → 63 + 3 = 66 → 65'le sınırlanır.
ok("kısmi yaş 65 ile sınırlı", yolu(r6, "kismi").kosullar[1].gereken === 65);
ok("4/b tam: 9000 gün", yolu(r6, "tam").kosullar[0].gereken === 9000);

baslik("Bağ-Kur (4/b)");
// EYT: 2.2.1972 erkek, 1.2.1996, 7000 gün. Tam: 9000 gün (25 tam yıl): 2000 ÷ 30 = 67 ay → Nisan 2032.
// Kısmi: 5400 dolu, 55 yaş 2.2.2027 → 1.10.1999'dan 10 yıldan fazla sonra → 58 yaş → 2.2.2030.
var r7 = h({ dogum: "1972-02-02", cinsiyet: "erkek", statu: "4b", ilkGiris: "1996-02-01", primGun: 7000 });
ok("EYT 4/b tam: 30 Nisan 2032", yolu(r7, "tam").tarih === "2032-04-30");
ok("EYT 4/b yaştan: 58 yaş, 2 Şubat 2030 (daha erken)", yolu(r7, "kismi").tarih === "2030-02-02" && r7.enErken.kod === "kismi");
ok("prim borcu notu", r7.notlar.some(function (n) { return /prim borcu/.test(n); }));
var r7k = h({ dogum: "1970-02-02", cinsiyet: "kadin", statu: "4b", ilkGiris: "1996-02-01", primGun: 7200 });
ok("EYT 4/b kadın: 7200 gün (20 tam yıl) dolu → bugün", r7k.tarih === BUGUN);
// Geçici m.9/2: 1.1.1983 kadın, 1.3.2005, 4000 gün. Kısmi: 60 yaş (2043) + 5400 (1400 ÷ 30 = 47 ay → Ağustos 2030).
// Tam: 58 yaş (1.1.2041) + 9000 (5000 ÷ 30 = 167 ay → Ağustos 2040) → 1.1.2041.
var r8 = h({ dogum: "1983-01-01", cinsiyet: "kadin", statu: "4b", ilkGiris: "2005-03-01", primGun: 4000 });
ok("Geçici m.9/2 tam: 1 Ocak 2041", yolu(r8, "tam").tarih === "2041-01-01");
ok("Geçici m.9/2 kısmi: 60 yaş, 1 Ocak 2043", yolu(r8, "kismi").tarih === "2043-01-01");

baslik("Borçlanma (m.41)");
// 4.4.1978 erkek, 1.3.2000 giriş, 6000 gün; girişten önce 540 gün askerlik.
// Başlangıç 1.3.2000 − 540 gün = 8.9.1998 → EYT. 23.5.2002'de 3 yıl 8 ay 15 gün → (n) 5900 gün;
// 6000 + 540 = 6540 ≥ 5900, 25 yıl 8.9.2023'te doldu → bugün. Borçlanmasız: 60 yaş → 4.4.2038.
var bg = { bugun: BUGUN, dogum: "1978-04-04", cinsiyet: "erkek", statu: "4a", ilkGiris: "2000-03-01", primGun: 6000, askerlikGun: 540, askerlikOnce: true };
var be = E.borclanmaEtkisi(bg, 2026);
ok("başlangıç 8 Eylül 1998'e gider", be.sonra.baslangic === "1998-09-08");
ok("grup değişir: EYT", be.grupDegisti && be.sonra.grup === "eyt" && be.once.grup === "gecis");
ok("(n) bendi, 5900 gün", yolu(be.sonra, "tam").bent === "n" && yolu(be.sonra, "tam").kosullar[1].gereken === 5900);
ok("borçlanmasız 4 Nisan 2038, borçlanmalı bugün", be.once.tarih === "2038-04-04" && be.sonra.tarih === BUGUN);
ok("öne çekilen süre 11 yıl 6 ay 5 gün", Math.abs(be.oneCekilenAy - (11 * 12 + 6 + 5 / 30)) < 1e-9, be.oneCekilenAy);
var P26 = B.parametre(2026), asg = P26.donemler[P26.donemler.length - 1].asgariBrut;
var bek = Math.round(Math.round(asg / 30 * P26.sigortalilik.borclanmaOrani * 100) / 100 * 540 * 100) / 100;
ok("bedel = 540 × (asgari ÷ 30 × %45), en az", Math.abs(be.maliyetEnAz - bek) < 0.01, be.maliyetEnAz + " / " + bek);
ok("geri dönüş = bedel ÷ en düşük emekli aylığı", Math.abs(be.geriDonusAy - bek / EP.altSinirAylik(BUGUN).tutar) < 1e-9);
var sonraGiris = h(Object.assign({}, bg, { askerlikOnce: false }));
ok("girişten sonraki askerlik başlangıcı oynatmaz, günü ekler", sonraGiris.baslangic === "2000-03-01" && sonraGiris.primToplam === 6540);
var dg = E.borclanmaEtkisi({ bugun: BUGUN, dogum: "1980-05-20", cinsiyet: "kadin", statu: "4a", ilkGiris: "2003-02-01", primGun: 5000, dogumGun: 720, dogumOnce: false }, 2026);
var bekD = Math.round(Math.round(asg / 30 * P26.sigortalilik.dogumBorclanmaOrani * 100) / 100 * 720 * 100) / 100;
ok("doğum borçlanması %32", dg.kalemler[0].oran === P26.sigortalilik.dogumBorclanmaOrani && Math.abs(dg.maliyetEnAz - bekD) < 0.01);
ok("yaşın bağladığı yerde borçlanma tarihi değiştirmez", dg.once.tarih === dg.sonra.tarih && dg.oneCekilenAy === 0);

baslik("Sınırlar ve hatalar");
function hata(g, desen) { try { h(g); return false; } catch (e) { return desen.test(e.message); } }
var T0 = { dogum: "1985-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "2005-01-01", primGun: 3000 };
ok("erkeğe doğum borçlanması yok", hata(Object.assign({}, T0, { dogumGun: 100 }), /kadın/));
ok("doğum borçlanması en çok 2160", hata(Object.assign({}, T0, { cinsiyet: "kadin", dogumGun: 2161 }), /2160/));
ok("yılda 360 günden fazla olmaz", hata(Object.assign({}, T0, { yillikGun: 365 }), /360/));
ok("giriş bugünden sonra olamaz", hata(Object.assign({}, T0, { ilkGiris: "2027-01-01" }), /bugünden sonra/));
ok("geçersiz tarih", hata(Object.assign({}, T0, { dogum: "1985-02-30" }), /Doğum/));
ok("4/c yok", hata(Object.assign({}, T0, { statu: "4c" }), /türünü/));
var hic = h(Object.assign({}, T0, { yillikGun: 0 }));
ok("prim ödenmezse ve gün eksikse tarih yok", hic.tarih === null && hic.yollar.every(function (y) { return y.tarih === null; }));
var d29 = h({ dogum: "1984-02-29", cinsiyet: "kadin", statu: "4a", ilkGiris: "2004-01-01", primGun: 7000 });
ok("29 Şubat doğumlu: 58 yaş 28 Şubat 2042", d29.tarih === "2042-02-28");

baslik("Duyarlılık: daha az çalışmak tarihi öne almaz");
var du = E.duyarlilik({ bugun: BUGUN, dogum: "1990-01-01", cinsiyet: "erkek", statu: "4a", ilkGiris: "2012-09-01", primGun: 4000 });
ok("beş satır", du.length === 5);
ok("tarih monoton (ya da hiç dolmuyor)", du.every(function (x, i) {
  return i === 0 || x.tarih === null || (du[i - 1].tarih !== null && x.tarih >= du[i - 1].tarih);
}));
ok("yılda 0 gün: dolmaz", du[4].tarih === null);

baslik("Sayfa örneği üreteçle aynı");
var uretec = path.join(KOK, "tools", "emeklilik-ornek.js");
if (fs.existsSync(uretec)) {
  var cik = cp.spawnSync(process.execPath, [uretec, "--check"], { encoding: "utf8" });
  ok("tools/emeklilik-ornek.js --check", cik.status === 0, (cik.stdout + cik.stderr).trim());
} else {
  console.log("  – üreteç bu pakette yok, atlandı");
}

console.log("\n" + gecen + " geçti, " + kalan + " kaldı");
process.exit(kalan ? 1 : 0);
