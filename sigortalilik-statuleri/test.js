#!/usr/bin/env node
/*!
 * Sigortalılık statüleri — doğrulama. Çalıştırma:
 *   node sigortalilik-statuleri/test.js
 *
 * Beklenenler kanun metninden (27 Ekim 2026'da mevzuat.gov.tr ve Resmî
 * Gazete'den okundu), motordan değil:
 *   - 5510 m.28/2: "en az 9000 gün ... (a) bendi ... 7200 gün"; yaş 58/60.
 *     m.28/3: yaşa üç yıl, 5400 gün.
 *   - 5510 m.108: 4/a ve 4/b Geçici m.9 sınırı 30/4/2008; diğer hükümler
 *     2008 Ekim ayı başında (4/c'nin sınırı).
 *   - 5434 Geçici m.205: kadın 20, erkek 25 fiilî hizmet yılı; Geçici m.95
 *     yaşı kaldırır.
 *   - 4447 m.23 (RG 8/9/1999, 23810): 25 fiilî hizmet yılı ve kadın 58,
 *     erkek 60 yaş; (c) ve (d) hallerinde 61 yaş ve 15 yıl.
 *   - 5510 m.52: isteğe bağlı prim %33 (%21 + %12).
 *   - 5510 m.53/1: 4/c önce; 4/a ile 4/b çakışırsa 4/a. Son fıkra: en çok
 *     sigortalılık, eşitse son statü.
 *   - 5510 m.4/2-f: 657 s.K. 4/C geçici personel 4/a hükümlerine tabi.
 */
"use strict";
var T = require("./statu.js");
var E = require("../ne-zaman-emekli-olurum/hesap.js");
var B = require("../bordro/motor.js");
var S = require("../bordro/sgk-prim.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + JSON.stringify(ek) : "")); }
}
function baslik(s) { console.log("\n" + s); }
function hata(f, desen) { try { f(); return false; } catch (e) { return desen.test(e.message); } }

/* Bir dönemin yolunu kodla bulur, koşulunu türle okur. */
function yol(statu, cinsiyet, donem, kod) {
  var d = T.sartlar(statu, cinsiyet).filter(function (x) { return x.donem.kod === donem; })[0];
  return d && d.yollar.filter(function (y) { return y.kod === kod; })[0];
}
function kosul(y, tur) { return y && y.kosullar.filter(function (k) { return k.tur === tur; })[0]; }
function gerek(statu, cinsiyet, donem, kod, tur) { var k = kosul(yol(statu, cinsiyet, donem, kod), tur); return k && k.gereken; }

baslik("Dönem sınırları (5510 m.108)");
var d4a = T.donemler("4a"), d4c = T.donemler("4c");
ok("4/a geçiş dönemi 30 Nisan 2008'de biter", d4a[1].bit === "2008-04-30", d4a[1]);
ok("4/a yeni dönem 1 Mayıs 2008'de başlar", d4a[2].bas === "2008-05-01", d4a[2]);
ok("4/c geçiş dönemi 30 Eylül 2008'de biter", d4c[1].bit === "2008-09-30", d4c[1]);
ok("4/c yeni dönem 1 Ekim 2008'de başlar", d4c[2].bas === "2008-10-01", d4c[2]);
ok("EYT sınırı her statüde 8 Eylül 1999", d4a[1].bas === "1999-09-08" && d4c[1].bas === "1999-09-08" && d4a[0].bit === "1999-09-07");

baslik("2008 sonrası (5510 m.28/2 ve m.28/3)");
ok("4/a: 7200 gün", gerek("4a", "kadin", "yeni", "tam", "gun") === 7200);
ok("4/b: 9000 gün", gerek("4b", "erkek", "yeni", "tam", "gun") === 9000);
ok("4/c: 9000 gün (m.28/2'de 4/b ile aynı)", gerek("4c", "erkek", "yeni", "tam", "gun") === 9000);
ok("yaş tabanı kadın 58, erkek 60", gerek("4b", "kadin", "yeni", "tam", "yas") === 58 && gerek("4c", "erkek", "yeni", "tam", "yas") === 60);
ok("yaşa üç yıl: kadın 61, erkek 63", gerek("4c", "kadin", "yeni", "kismi", "yas") === 61 && gerek("4a", "erkek", "yeni", "kismi", "yas") === 63);
ok("4/b ve 4/c kısmi: 5400 gün", gerek("4b", "kadin", "yeni", "kismi", "gun") === 5400 && gerek("4c", "kadin", "yeni", "kismi", "gun") === 5400);
var g4a = gerek("4a", "kadin", "yeni", "kismi", "gun");
ok("4/a kısmi: giriş yılına göre 4600–5400 gün (Geçici m.6/7-b)", g4a && g4a.min === 4600 && g4a.max === 5400, g4a);
ok("4/a kısmi yol adı aralığı yazar", /4\.600–5\.400 gün/.test(yol("4a", "kadin", "yeni", "kismi").ad));
ok("kademeli yaş notu: 1 Ocak 2036", /1 Ocak 2036/.test(kosul(yol("4a", "kadin", "yeni", "tam"), "yas").not));

baslik("1999–2008 (5510 Geçici m.9; 4447 m.23)");
ok("4/a: yaş ve 7000 gün", gerek("4a", "kadin", "gecis", "tam", "gun") === 7000 && gerek("4a", "kadin", "gecis", "tam", "yas") === 58);
ok("4/a: yaş, 25 yıl ve 4500 gün", gerek("4a", "erkek", "gecis", "sure25", "gun") === 4500 && gerek("4a", "erkek", "gecis", "sure25", "sure") === 25);
ok("4/b: 25 tam yıl, erkek 60", gerek("4b", "erkek", "gecis", "tam", "gun") === 9000 && kosul(yol("4b", "erkek", "gecis", "tam"), "gun").tamYil === 25 && gerek("4b", "erkek", "gecis", "tam", "yas") === 60);
ok("4/b: 15 tam yıl, kadın 60 erkek 62", gerek("4b", "kadin", "gecis", "kismi", "yas") === 60 && gerek("4b", "erkek", "gecis", "kismi", "yas") === 62);
ok("4/c: 25 hizmet yılı, kadın 58 erkek 60 (her iki cinsiyette 25 yıl)",
  gerek("4c", "kadin", "gecis", "tam", "sure") === 25 && gerek("4c", "kadin", "gecis", "tam", "yas") === 58 && gerek("4c", "erkek", "gecis", "tam", "yas") === 60);
ok("4/c: 61 yaş ve 15 yıl", gerek("4c", "kadin", "gecis", "kismi", "yas") === 61 && gerek("4c", "erkek", "gecis", "kismi", "sure") === 15);
ok("4/c geçiş dayanağı 4447 m.23", /4447 s\.K\. m\.23/.test(yol("4c", "kadin", "gecis", "tam").dayanak));

baslik("1999 öncesi (EYT: 5510 Geçici m.95)");
ok("4/c: kadın 20, erkek 25 hizmet yılı, yaş yok",
  gerek("4c", "kadin", "eyt", "tam", "sure") === 20 && gerek("4c", "erkek", "eyt", "tam", "sure") === 25 && !kosul(yol("4c", "kadin", "eyt", "tam"), "yas"));
ok("4/c EYT dayanağı 5434 Geçici m.205 ve 5510 Geçici m.95", /Geçici m\.205.*Geçici m\.95/.test(yol("4c", "erkek", "eyt", "tam").dayanak));
var gEyt = gerek("4a", "kadin", "eyt", "tam", "gun");
ok("4/a: 5000–5975 gün, 81/B tablosundan", gEyt && gEyt.min === 5000 && gEyt.max === 5975, gEyt);
ok("4/a EYT dayanağında temsilî bent yok", !/81\/B-\(/.test(yol("4a", "kadin", "eyt", "tam").dayanak));
ok("4/a EYT: yaş yok, kadın 20 yıl", !kosul(yol("4a", "kadin", "eyt", "tam"), "yas") && gerek("4a", "kadin", "eyt", "tam", "sure") === 20);
ok("4/b EYT: kadın 20 tam yıl (7200), erkek 25 tam yıl (9000)",
  gerek("4b", "kadin", "eyt", "tam", "gun") === 7200 && gerek("4b", "erkek", "eyt", "tam", "gun") === 9000);
var yC = gerek("4a", "erkek", "eyt", "kismi", "yas");
ok("4/a kısmi (81/C) yaş aralığı erkek 55–60", yC && yC.min === 55 && yC.max === 60, yC);

baslik("Motorla tutarlılık: 4/a ve 4/b şartları kopya değil");
var gercek = E.hesapla({ statu: "4a", cinsiyet: "kadin", dogum: "1980-03-01", ilkGiris: "2003-02-01", primGun: 100, yillikGun: 360, bugun: "2026-10-27" });
ok("geçiş 4/a: bir kişinin hesabıyla aynı gün", gercek.yollar[0].kosullar.some(function (k) { return k.tur === "gun" && k.gereken === gerek("4a", "kadin", "gecis", "tam", "gun"); }));

baslik("Prim (5510 m.52, m.81, m.82)");
var yil = B.parametre(2026).yil, sin = S.sinirlar(yil);
var pi = T.prim("istege", yil), pb = T.prim("4b", yil), pa = T.prim("4a", yil);
ok("isteğe bağlı oran %33", pi.oran === 0.33, pi.oran);
ok("isteğe bağlı en az = alt sınır × %33", Math.abs(pi.enAz - Math.round(sin.aylikAlt * 0.33 * 100) / 100) < 0.01, pi);
ok("isteğe bağlı en çok = üst sınır × %33", Math.abs(pi.enCok - Math.round(sin.aylikUst * 0.33 * 100) / 100) < 0.01, pi);
ok("4/b oranı Bağ-Kur hesabıyla aynı", pb.oran === S.bagkur(sin.aylikAlt, yil).oran && pb.enAz === S.bagkur(sin.aylikAlt, yil).prim);
ok("4/a işçi payı = SGK + işsizlik", pa.isci === Math.round((B.parametre(yil).oranlar.sgkIsci + B.parametre(yil).oranlar.issizlikIsci) * 1e6) / 1e6, pa);
ok("4/c prim bu sürümde yok", T.prim("4c", yil) === null);

baslik("Statü bulucu (5510 m.4, m.50, m.53)");
function b(g) { return T.bul(g).statu; }
ok("ücretli → 4/a", b({ faaliyet: ["ucretli"] }) === "4a");
ok("bağımsız → 4/b", b({ faaliyet: ["bagimsiz"] }) === "4b");
ok("ücretli + bağımsız → 4/a (m.53/1)", b({ faaliyet: ["ucretli", "bagimsiz"] }) === "4a" && /m\.53/.test(T.bul({ faaliyet: ["ucretli", "bagimsiz"] }).dayanak.join()));
ok("kadrolu memur → 4/c", b({ faaliyet: ["kamu"], kamu: "kadro" }) === "4c");
ok("4/B sözleşmeli → 4/c", b({ faaliyet: ["kamu"], kamu: "sozlesmeli" }) === "4c");
ok("memur + bağımsız iş → 4/c önce", b({ faaliyet: ["kamu", "bagimsiz"], kamu: "kadro" }) === "4c");
ok("kamu işçisi → 4/a", b({ faaliyet: ["kamu"], kamu: "isci" }) === "4a");
ok("657 4/C geçici personel → 4/a (m.4/2-f)", b({ faaliyet: ["kamu"], kamu: "gecici" }) === "4a" && /m\.4\/2-f/.test(T.bul({ faaliyet: ["kamu"], kamu: "gecici" }).dayanak.join()));
ok("çalışmıyor, şartlar tamam → isteğe bağlı", b({ faaliyet: [], yas18: true, aylikAliyor: false, ikamet: true }) === "istege");
ok("aylık alıyorsa isteğe bağlı olamaz", b({ faaliyet: [], aylikAliyor: true }) === null);
ok("18 yaş altı isteğe bağlı olamaz", b({ faaliyet: [], yas18: false }) === null);

baslik("Emekli olunacak statü (5510 m.53 son fıkra)");
ok("en çok süre: 4/a", T.emekliStatusu({ "4a": 5000, "4b": 3000 }, "4b") === "4a");
ok("eşitse son statü", T.emekliStatusu({ "4a": 3000, "4b": 3000 }, "4b") === "4b");
ok("hiç süre yoksa sonuç yok", T.emekliStatusu({}, "4a") === null);

baslik("Hatalı girdi");
ok("isteğe bağlı için şart sorulmaz", hata(function () { T.sartlar("istege", "kadin"); }, /4\/a, 4\/b ya da 4\/c/));
ok("bilinmeyen cinsiyet reddedilir", hata(function () { T.sartlar("4a", "x"); }, /Cinsiyet/));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı");
process.exit(kalan ? 1 : 0);
