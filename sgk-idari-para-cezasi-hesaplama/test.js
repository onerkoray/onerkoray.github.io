#!/usr/bin/env node
/*!
 * SGK idari para cezaları — doğrulama. Çalıştırma:
 *   node sgk-idari-para-cezasi-hesaplama/test.js
 *
 * Beklenenler motordan değil, iki dış kaynaktan:
 *   - SGK 2020/8 sayılı Genelge'nin kendi sayısal örnekleri (o yılın asgari
 *     ücretiyle, kuruş atılarak): 88,65 → 88; 150 × 88,65 tavana iner;
 *     1.777 × 1/4 × 3/4 = 333; 5.643 × 1/4 × 3/4 = 1.058; 5.332 × 3/4 = 3.999;
 *     ek beyannamede 1.777,50 / 8 × 9 = 1.999.
 *   - 5510 m.102 metni: katlar, kesirler, üst sınırlar, hangi bentlerin
 *     dörtte bir indirimine girdiği.
 */
"use strict";
var C = require("./hesap.js");
var B = require("../bordro/motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function baslik(s) { console.log("\n" + s); }
function hata(f, desen) { try { f(); return false; } catch (e) { return desen.test(e.message); } }
function h(g) { return C.hesapla(g); }

baslik("Genelge 2020/8 örnekleri (o yılların asgari ücretiyle)");
var e1 = h({ fiil: "istenCikis", yil: 2012, ay: 3, asgariUcret: 886.50, sigortali: 1, defter: "bilanco" });
ok("işten ayrılış, 1 sigortalı: 886,50 / 10 = 88,65 → 88 TL", e1.teblig === 88, e1.teblig);
var e2 = h({ fiil: "istenCikis", yil: 2012, ay: 3, asgariUcret: 886.50, sigortali: 150, defter: "bilanco" });
ok("150 sigortalı 13.297,50 TL bilançoda 12 asgari ücrete iner: 10.638 TL", e2.teblig === 10638 && e2.tavanUygulandi, e2.teblig);
var e3 = h({ fiil: "istenCikis", yil: 2012, ay: 5, asgariUcret: 886.50, sigortali: 25, defter: "diger" });
ok("diğer defter, 25 sigortalı: 2.216,25 → 2.216 TL, tavan (5.319) altında", e3.teblig === 2216 && !e3.tavanUygulandi, e3.teblig);
var e4 = h({ fiil: "istenCikis", yil: 2012, ay: 7, asgariUcret: 940.50, sigortali: 65, defter: "diger", kendiliginden30: true });
ok("65 sigortalı, diğer defter tavanı 5.643; 30 gün + 15 gün: 1.058 TL", e4.teblig === 5643 && e4.pesin === 1058, e4.teblig + " / " + e4.pesin);
var e5 = h({ fiil: "istenCikis", yil: 2011, ay: 11, asgariUcret: 837.00, sigortali: 180, defter: "diger" });
ok("180 sigortalı 15.066 TL, diğer defter tavanı 5.022 TL", e5.teblig === 5022, e5.teblig);
var e6 = h({ fiil: "istenCikis", yil: 2009, ay: 9, asgariUcret: 693.00, sigortali: 1, defter: "bilanco" });
ok("re'sen düzenlenen ayrılış bildirgesi: 69,30 × 3/4 = 51,98 → 51 TL", e6.pesin === 51, e6.pesin);
var e7 = h({ fiil: "iseGiris", yil: 2017, ay: 2, asgariUcret: 1777.50, sigortali: 1, kendiliginden30: true });
ok("işe giriş, 30 gün içinde kendiliğinden: tebliğ 1.777, tahsil 333 TL", e7.teblig === 1777 && e7.pesin === 333, e7.teblig + " / " + e7.pesin);
var e8 = h({ fiil: "isyeri", yil: 2017, ay: 3, asgariUcret: 1777.50, defter: "bilanco", kendiliginden30: false });
ok("işyeri bildirgesi, bilanço, 30 gün geçti: 5.332 tebliğ, 3.999 TL tahsil", e8.teblig === 5332 && e8.pesin === 3999, e8.teblig + " / " + e8.pesin);
var e9 = h({ fiil: "mphbEk", yil: 2017, ay: 10, asgariUcret: 1777.50, sigortali: 9 });
ok("ek beyanname, 9 sigortalı: 1.777,50 / 8 × 9 = 1.999 TL", e9.teblig === 1999, e9.teblig);
var e10 = h({ fiil: "mphbEk", yil: 2017, ay: 10, asgariUcret: 1777.50, sigortali: 8 });
ok("ek beyanname, 8 sigortalı: 1.777 TL", e10.teblig === 1777, e10.teblig);
var e11 = h({ fiil: "mphbResen", yil: 2019, ay: 9, asgariUcret: 2558.40, sigortali: 3 });
ok("eksik gün, bir ay geçti, 3 sigortalı: 2.558,40 / 2 × 3 = 3.837 TL", e11.teblig === 3837, e11.teblig);

baslik("Asgari ücret parametrelerden, fiilin işlendiği aya göre");
ok("2026: 33.030 TL", C.asgari(2026, 10) === 33030 && C.asgari(2026, 10) === B.donem(B.parametre(2026), 10).asgariBrut);
ok("2023 Haziran ile Temmuz farklı (yıl içi artış)", C.asgari(2023, 6) === B.donem(B.parametre(2023), 6).asgariBrut && C.asgari(2023, 7) === B.donem(B.parametre(2023), 7).asgariBrut && C.asgari(2023, 6) < C.asgari(2023, 7), C.asgari(2023, 6) + " / " + C.asgari(2023, 7));
ok("parametresi olmayan yıl açık hata verir", hata(function () { h({ fiil: "isyeri", yil: 2027, ay: 1 }); }, /açıklandığında/));

baslik("5510 m.102 katları (2026, asgari ücret 33.030 TL)");
var AU = 33030;
function t(g) { return h(Object.assign({ yil: 2026, ay: 10 }, g)); }
ok("işe giriş, 1 kişi: 1 asgari ücret", t({ fiil: "iseGiris", sigortali: 1 }).teblig === AU);
ok("işe giriş tespit: 2 kat; tekrar: 5 kat", t({ fiil: "iseGiris", sigortali: 1, iseGiris: "tespit" }).teblig === 2 * AU && t({ fiil: "iseGiris", sigortali: 1, iseGiris: "tekrar" }).teblig === 5 * AU);
ok("işe giriş üst sınırsız: 12 kişi = 12 asgari ücret", t({ fiil: "iseGiris", sigortali: 12 }).teblig === 12 * AU);
ok("işyeri bildirgesi 3 / 2 / 1", t({ fiil: "isyeri", defter: "bilanco" }).teblig === 3 * AU && t({ fiil: "isyeri", defter: "diger" }).teblig === 2 * AU && t({ fiil: "isyeri", defter: "yok" }).teblig === AU);
ok("defter ibrazı 12 / 6 / 3", t({ fiil: "defterIbraz", defter: "bilanco" }).teblig === 12 * AU && t({ fiil: "defterIbraz", defter: "diger" }).teblig === 6 * AU && t({ fiil: "defterIbraz", defter: "yok" }).teblig === 3 * AU);
ok("eksik işçilik: ay başına 2", t({ fiil: "eksikIscilik", aySayisi: 3 }).teblig === 6 * AU);
ok("asıl beyanname: 3 kişi = 3/5 asgari ücret", t({ fiil: "mphbAsil", sigortali: 3 }).teblig === Math.floor(3 * AU / 5));
ok("asıl beyanname: 10 kişide 2 asgari ücrete ulaşır, 11'de de 2", t({ fiil: "mphbAsil", sigortali: 10 }).teblig === 2 * AU && t({ fiil: "mphbAsil", sigortali: 11 }).teblig === 2 * AU && t({ fiil: "mphbAsil", sigortali: 11 }).tavanUygulandi);
ok("ek beyanname: 16 kişide tavan, 17'de tavan uygulanır", t({ fiil: "mphbEk", sigortali: 16 }).teblig === 2 * AU && t({ fiil: "mphbEk", sigortali: 17 }).tavanUygulandi);
ok("eksik gün ek beyannamesi: 4 kişide tavan", t({ fiil: "mphbResen", sigortali: 4 }).teblig === 2 * AU && !t({ fiil: "mphbResen", sigortali: 4 }).tavanUygulandi);
ok("tespit, bilanço: kişi başı 1, en çok 3", t({ fiil: "mphbTespit", sigortali: 2, defter: "bilanco" }).teblig === 2 * AU && t({ fiil: "mphbTespit", sigortali: 5, defter: "bilanco" }).teblig === 3 * AU);
ok("tespit, diğer: kişi başı 1/2, en çok 2", t({ fiil: "mphbTespit", sigortali: 3, defter: "diger" }).teblig === Math.floor(1.5 * AU) && t({ fiil: "mphbTespit", sigortali: 9, defter: "diger" }).teblig === 2 * AU);
ok("tespit, defter yok: kişi başı 1/3, en çok 1", t({ fiil: "mphbTespit", sigortali: 2, defter: "yok" }).teblig === Math.floor(2 * AU / 3) && t({ fiil: "mphbTespit", sigortali: 7, defter: "yok" }).teblig === AU);
ok("işten ayrılış, bilanço: 121 kişide 12 asgari ücrete takılır", t({ fiil: "istenCikis", sigortali: 120, defter: "bilanco" }).teblig === 12 * AU && t({ fiil: "istenCikis", sigortali: 121, defter: "bilanco" }).tavanUygulandi);

baslik("İndirimler (m.102/2 ve m.102/5)");
var k30 = t({ fiil: "iseGiris", sigortali: 1, kendiliginden30: true });
ok("işe giriş, 30 gün + 15 gün: 33.030 × 3/16 = 6.193,13 → 6.193 TL", k30.pesin === 6193 && k30.ceyrek, k30.pesin);
ok("işe giriş, 30 gün geçti: yalnız peşin, 24.772 TL", t({ fiil: "iseGiris", sigortali: 1, kendiliginden30: false }).pesin === 24772);
ok("tespit edilende dörtte bir yok, kendiliğinden işaretlense bile", t({ fiil: "iseGiris", sigortali: 1, iseGiris: "tespit", kendiliginden30: true }).pesin === Math.floor(2 * AU * 0.75));
ok("beyanname (m bendi) dörtte bir indirimine girmez", t({ fiil: "mphbAsil", sigortali: 3, kendiliginden30: true }).ceyrekUygun === false && t({ fiil: "mphbAsil", sigortali: 3, kendiliginden30: true }).pesin === Math.floor(Math.floor(3 * AU / 5) * 0.75));
ok("işyeri ve işten ayrılış dörtte bire girer", t({ fiil: "isyeri", defter: "diger", kendiliginden30: true }).ceyrek && t({ fiil: "istenCikis", sigortali: 1, defter: "diger", kendiliginden30: true }).ceyrek);
ok("defter ibrazı ve eksik işçilik dörtte bire girmez", !t({ fiil: "defterIbraz", defter: "diger", kendiliginden30: true }).ceyrek && !t({ fiil: "eksikIscilik", aySayisi: 1, kendiliginden30: true }).ceyrek);

baslik("Aynı fiilin yolları");
var y = C.yollar({ fiil: "iseGiris", yil: 2026, ay: 10, sigortali: 1 });
ok("işe giriş: beş yol, ucuzdan pahalıya", y.length === 5 && y.every(function (r, i) { return i === 0 || y[i - 1].tutar <= r.tutar; }));
ok("en ucuz 6.193, en pahalı 123.862 TL (165.150 × 3/4)", y[0].tutar === 6193 && y[4].tutar === 123862, y[0].tutar + " / " + y[4].tutar);
ok("en pahalı en ucuzun 20 katı", Math.round(y[4].tutar / y[0].tutar) === 20);
var yb = C.yollar({ fiil: "mphbAsil", yil: 2026, ay: 10, sigortali: 3 });
ok("beyanname: iki yol (peşin / geç)", yb.length === 2 && yb[0].tutar === Math.floor(yb[1].tutar * 0.75));

baslik("Girdi denetimi");
ok("sigortalı 0 reddedilir", hata(function () { t({ fiil: "iseGiris", sigortali: 0 }); }, /en az 1/));
ok("kesirli sigortalı reddedilir", hata(function () { t({ fiil: "iseGiris", sigortali: 1.5 }); }, /tam sayı/));
ok("tanınmayan fiil reddedilir", hata(function () { t({ fiil: "yok" }); }, /tanınmadı/));
ok("2026/9: Nisan 2026'dan sıfır bildirge de cezalı", t({ fiil: "mphbAsil", sigortali: 1 }).sifirBildirge && !h({ fiil: "mphbAsil", yil: 2026, ay: 3, sigortali: 1 }).sifirBildirge);

console.log("\n" + gecen + " geçti, " + kalan + " kaldı");
process.exit(kalan ? 1 : 0);
