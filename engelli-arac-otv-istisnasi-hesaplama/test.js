#!/usr/bin/env node
/*!
 * Engelli araç ÖTV istisnası — doğrulama. Çalıştırma:
 *   node engelli-arac-otv-istisnasi-hesaplama/test.js
 *
 * Beklenenler motorun içinden değil, elle türetilir:
 *   - sınır tutarı, 7061 s.K.'nun 200.000 TL'sinden yıllık yeniden değerleme
 *     oranlarıyla (VUK genel tebliğleri) ayrıca kurulur ve tebliğdeki
 *     2.873.900 TL ile karşılaştırılır;
 *   - ÖTV ve KDV, yanlarında yazılı aritmetikle;
 *   - MTV, MTV tarife modülüne taşıt değeri elle verilerek.
 */
"use strict";
var E = require("./hesap.js");
var OTV = require("../otv-hesaplama/tarife.js");
var MTV = require("../mtv-hesaplama/tarife.js");
var SER = require("../finans/endeksleme-serileri.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (t == null ? 0.01 : t); }
function baslik(s) { console.log("\n" + s); }
function hata(f, desen) { try { f(); return false; } catch (e) { return desen.test(e.message); } }
var BUGUN = "2026-10-04";
function kisiA() { return { oran: 90 }; }
function binek(otv, yk) { return { sinif: "binek", otv: otv, yerliKatki: yk || "evet" }; }

baslik("Sınır tutarı: 200.000 TL (2018) × yeniden değerleme, 100 TL altı atılır");
/* Her yılın tutarına uygulanan oran: bir önceki yılın YDO'su
   (VUK GT 501, 512, 522, 535, 547, 555, 574 ve 2025 için %25,49). */
var YDO = { 2019: 23.73, 2020: 22.58, 2021: 9.11, 2022: 36.20, 2023: 122.93, 2024: 58.46, 2025: 43.93, 2026: 25.49 };
var t = 200000;
for (var y = 2019; y <= 2026; y++) t = Math.floor(t * (1 + YDO[y] / 100) / 100) * 100;
ok("zincir 2026'da 2.873.900 TL", t === 2873900, t);
ok("motorun 2026 sınırı tebliğle aynı", E.sinir(2026) === 2873900);
ok("YDO 2022–2026 sitenin endeksleme serisiyle aynı",
  [2022, 2023, 2024, 2025, 2026].every(function (y) { return SER.SERI[y] && SER.SERI[y].ydo === YDO[y]; }));
ok("açıklanmamış yılın sınırı yok", E.sinir(2027) === null);

baslik("Kanunun sabitleri");
ok("yerli katkı %40 (9321 sayılı CB Kararı)", E.YERLI_KATKI === 40);
ok("on yılda bir (7537 s.K.)", E.YENILEME_YIL === 10);
ok("devirde beş yıl (m.15/2-a)", E.DEVIR_YIL === 5);
ok("ortopedik eşik %40, ağır engel %90", E.ORTOPEDIK_ESIK === 40 && E.AGIR_ESIK === 90);
ok("yük-yolcu ve 9 kişilik: içten yanmalı %15, elektrikli %10", E.TICARI.yukyolcu.icten === 15 && E.TICARI.dokuz.elektrik === 10);

baslik("Yollar");
ok("%90 → (a)", E.yollar({ oran: 90 }).join() === "a");
ok("%89 ve başka şart yok → hiçbiri", E.yollar({ oran: 89 }).length === 0);
ok("%95 + tekerlekli sandalye → (b) ve (a)", E.yollar({ oran: 95, sandalye: true }).join() === "b,a");
ok("özel tertibat raporu tek başına yetmez (sürücü belgesi kodu da gerekir)", E.yollar({ oran: 40, tertibat: true }).length === 0);
ok("rapor + sürücü belgesi kodu → (c) bizzat kullanım", E.yollar({ oran: 40, tertibat: true, ehliyetKodu: true }).join() === "c1");
ok("ortopedik %40 + sürücü belgesi alamaz → (c) ortopedik", E.yollar({ ortopedik: 40, ehliyetAlamaz: true }).join() === "c2");
ok("ortopedik %39 → hiçbiri", E.yollar({ ortopedik: 39, ehliyetAlamaz: true }).length === 0);

baslik("Örnek: %90, 1400 cm³, vergisiz 600.000 TL");
// 600.000 ≤ 650.000 → %70. ÖTV 420.000; KDV (600.000 + 420.000) × 0,20 = 204.000; toplam 1.224.000.
// İstisnayla: 600.000 × 1,20 = 720.000. Fark 504.000 = ÖTV × 1,20.
var r = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 600000, fiyatTip: "matrah" });
ok("uygun, (a) bendi", r.durum === "uygun" && r.yol === "a");
ok("ÖTV %70 = 420.000", r.hesap.normal.oran === 70 && yakin(r.hesap.normal.otv, 420000));
ok("normal anahtar teslim 1.224.000", yakin(r.hesap.normal.toplam, 1224000));
ok("istisnalı 720.000", yakin(r.hesap.istisnali.toplam, 720000));
ok("tasarruf 504.000 = ÖTV + ÖTV'nin KDV'si", yakin(r.hesap.tasarruf, 504000) && yakin(r.hesap.tasarrufKdv, 84000));
ok("ödenecek 720.000", yakin(r.odenecek, 720000));
ok("sınıra kalan 1.649.900", yakin(r.hesap.sinirKalan, 2873900 - 1224000));
ok("takvim: serbest satış 2031, yeni istisna 2036", r.takvim.serbestSatis === "2031-10-04" && r.takvim.yeniIstisna === "2036-10-04");
ok("beş yıldan önce satışta alıcının ödeyeceği ÖTV = ilk matrahın ÖTV'si", yakin(r.takvim.erkenSatisOtv, 420000));

baslik("Anahtar teslim fiyattan vergisiz fiyat");
var a1 = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 1224000, fiyatTip: "anahtar" });
ok("1.224.000 anahtar teslim → 600.000 vergisiz", yakin(a1.hesap.normal.matrah, 600000, 0.02));
// 160 kW altı elektrikli: matrah ≤ 1.650.000 → %25, en çok 1.650.000 × 1,25 × 1,2 = 2.475.000;
// üstü %55, en az 1.650.000 × 1,55 × 1,2 = 3.069.000. Arada fiyat olamaz.
ok("tarife boşluğundaki fiyat açıkça reddedilir", hata(function () {
  E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "elektrik", kw: 150 }), fiyat: 3000000, fiyatTip: "anahtar" });
}, /2\.475\.000 TL ile 3\.069\.000 TL/));

baslik("Fiyat sınırı: uçurum");
// 1400 cm³, %90 satırı: sınırdaki matrah 2.873.900 ÷ (1,90 × 1,20) = 1.260.482,456…
var ar = binek({ tur: "icten", hacim: 1400 });
var mS = E.sinirdakiMatrah(ar, 2873900);
ok("sınırdaki vergisiz fiyat 1.260.482,45", yakin(mS, 1260482.45, 0.005), mS);
var ic = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: ar, fiyat: 1260482, fiyatTip: "matrah" });
var dis = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: ar, fiyat: 1260483, fiyatTip: "matrah" });
ok("sınırın 1 TL altı: uygun", ic.durum === "uygun");
ok("sınırın 1 TL üstü: uygun değil", dis.durum === "uygun-degil");
ok("sınırı aşınca kısmi indirim yok: tam fiyat ödenir", yakin(dis.odenecek, dis.hesap.normal.toplam));
// Uçurumun boyu: içerideki aracın tasarrufu 1.260.482 × 0,90 × 1,20.
ok("uçurum: 1 TL farkla 1,36 milyon TL", yakin(ic.hesap.tasarruf, 1260482 * 0.9 * 1.2, 0.02) && ic.hesap.tasarruf > 1360000);

baslik("(b) bendi: fiyat sınırı yok");
// 9 kişilik, 2.000 cm³, vergisiz 3.000.000: ÖTV %15 = 450.000; KDV 690.000; toplam 4.140.000.
var b = E.hesapla({ bugun: BUGUN, kisi: { oran: 95, sandalye: true }, arac: { sinif: "dokuz", otv: { tur: "icten", hacim: 2000 }, yerliKatki: "evet" }, fiyat: 3000000, fiyatTip: "matrah" });
ok("yol (b), sınırın üstünde olsa da uygun", b.yol === "b" && b.durum === "uygun" && b.hesap.normal.toplam > 2873900);
ok("toplam 4.140.000, tasarruf 540.000", yakin(b.hesap.normal.toplam, 4140000) && yakin(b.hesap.tasarruf, 540000));
var b4 = E.hesapla({ bugun: BUGUN, kisi: { oran: 95, sandalye: true }, arac: { sinif: "dokuz", dortCeker: true, otv: { tur: "icten", hacim: 2000 }, yerliKatki: "evet" }, fiyat: 3000000, fiyatTip: "matrah" });
ok("dört çeker (b) dışında; (a)'ya düşer ve sınıra takılır", b4.yol === "a" && b4.durum === "uygun-degil");
var bb = E.hesapla({ bugun: BUGUN, kisi: { oran: 95, sandalye: true }, arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 600000, fiyatTip: "matrah" });
ok("binek otomobilde (b) değil (a) uygulanır", bb.yol === "a");
var b28 = E.aracKapsami("b", { sinif: "yukyolcu", otv: { tur: "icten", hacim: 2900 } });
ok("(b): 2.800 cm³'ü aşan kapsam dışı", b28.tamam === false);

baslik("Şartlar");
var yk = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "icten", hacim: 1400 }, "hayir"), fiyat: 600000, fiyatTip: "matrah" });
ok("yerli katkı %40 altı → uygun değil", yk.durum === "uygun-degil");
var yb = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "icten", hacim: 1400 }, "bilinmiyor"), fiyat: 600000, fiyatTip: "matrah" });
ok("yerli katkı bilinmiyor → belirsiz", yb.durum === "belirsiz");
var on = E.hesapla({ bugun: BUGUN, kisi: kisiA(), sonIstisna: "2018-05-10", arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 600000, fiyatTip: "matrah" });
ok("2018'de yararlanan 2028-05-10'a kadar yararlanamaz (beş değil on yıl)", on.durum === "uygun-degil" &&
  on.kosullar.some(function (k) { return /2028-05-10/.test(k.aciklama); }));
var on2 = E.hesapla({ bugun: BUGUN, kisi: kisiA(), sonIstisna: "2016-10-04", arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 600000, fiyatTip: "matrah" });
ok("on yılın dolduğu gün yararlanılabilir", on2.durum === "uygun");
var hic = E.hesapla({ bugun: BUGUN, kisi: { oran: 60 }, arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 600000, fiyatTip: "matrah" });
ok("%60, özel tertibat zorunluluğu yok → uygun değil", hic.durum === "uygun-degil" && hic.yol === null);
ok("29 Şubat + 5 yıl → 28 Şubat", E.yilEkle("2024-02-29", 5) === "2029-02-28");

baslik("Kamyonet ve motosiklet");
var k1 = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: { sinif: "kamyonet", otv: { tur: "icten", hacim: 2500 }, yerliKatki: "evet" } });
ok("kamyonet 2.500 cm³ kapsamda, tutar hesaplanmaz", k1.durum === "uygun" && k1.hesapsiz);
var k2 = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: { sinif: "kamyonet", otv: { tur: "icten", hacim: 3000 }, yerliKatki: "evet" } });
ok("kamyonet 3.000 cm³ kapsam dışı", k2.durum === "uygun-degil");

baslik("MTV");
var mtv = r.mtv;
// Değer = KDV matrahı = 600.000 + 420.000 = 1.020.000; 1301–1600 bandı (1400 cm³), yeni tescil, 1–3 yaş.
var elle = MTV.hesapla({ tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 1, modelYili: 2026, yil: 2026, deger: 1020000 }).vergi;
ok("(a): normal alıcının ilk yıl MTV'si tarifeden", mtv.normalIlkYil === elle, mtv.normalIlkYil + " ≠ " + elle);
ok("(a): %90 ve üzeri MTV'den muaf", mtv.muaf === true && mtv.sizinBesYil === 0);
// (c) ortopedik, sürücü belgesi yok: taşıt özel tertibatlı değil → MTV ödenir. Değer ÖTV'siz matrah.
var c2 = E.hesapla({ bugun: BUGUN, kisi: { ortopedik: 45, ehliyetAlamaz: true }, arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 300000, fiyatTip: "matrah" });
var degerNormal = 300000 * 1.70, degerSizin = 300000;
var mN = MTV.hesapla({ tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 1, modelYili: 2026, yil: 2026, deger: degerNormal }).vergi;
var mS2 = MTV.hesapla({ tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 1, modelYili: 2026, yil: 2026, deger: degerSizin }).vergi;
ok("(c) ortopedik: yol c2, MTV muafiyeti yok", c2.yol === "c2" && c2.mtv.muaf === false);
ok("(c) ortopedik: taşıt değeri ÖTV'siz → daha düşük kademe", c2.mtv.sizinIlkYil === mS2 && c2.mtv.normalIlkYil === mN && mS2 < mN, mS2 + " / " + mN);
var c1 = E.hesapla({ bugun: BUGUN, kisi: { oran: 50, tertibat: true, ehliyetKodu: true }, arac: binek({ tur: "icten", hacim: 1400 }), fiyat: 300000, fiyatTip: "matrah" });
ok("(c) özel tertibatlı: MTV'den muaf", c1.mtv.muaf === true);
var mtvR = E.hesapla({ bugun: BUGUN, kisi: kisiA(), arac: binek({ tur: "icten", hacim: 1400 }, "hayir"), fiyat: 600000, fiyatTip: "matrah" });
ok("istisna yoksa MTV muafiyeti de hesaba girmez", mtvR.mtv.muaf === false && mtvR.mtv.sizinIlkYil === mtvR.mtv.normalIlkYil);
ok("hacim bantları MTV'yle aynı sırada", E.hacimBandi(1300) === 0 && E.hacimBandi(1301) === 1 && E.hacimBandi(1600) === 1 && E.hacimBandi(4001) === 8);

baslik("ÖTV tarifesiyle tutarlılık");
var o = OTV.hesapla({ tur: "icten", hacim: 1400, matrah: 600000 });
ok("motorun vergisi ÖTV aracınınkiyle aynı", yakin(E.vergi(ar, 600000).toplam, o.toplam));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
