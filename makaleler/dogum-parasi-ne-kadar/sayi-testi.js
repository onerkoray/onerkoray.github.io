#!/usr/bin/env node
/*
 * "Doğum parası ne kadar?" yazısının sayıları.
 * Her değer yazının modülünden (dogum.js) gelir; modül ödeneği rapor parası
 * çekirdeğiyle, izin yılını bordro motoruyla hesaplar. Bu test önce modülü
 * bağımsız aritmetikle sınar, sonra her rakamın sayfada göründüğünü doğrular.
 *
 * Kullanım: node makaleler/dogum-parasi-ne-kadar/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var D = require("./dogum.js");
var B = S.bordro();
var t = S.yazi(__dirname);

function tl(v) { return S.tam(v) + " TL"; }
function isaretli(v) { var r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + S.tam(Math.abs(r)); }
function virgul(v) { return S.tl(v); }
/* Meta etiketi ve alt metin: görünen metinde değil, HTML'de. */
function htmlde(ad, x) { t.dogru(ad, t.html.indexOf(x) !== -1, "HTML'de yok: " + x); }

/* 1 — Kanunun süreleri: 8 + 16 hafta, çoğulda 10 + 16; baba 10 gün. */
t.yakin("tek bebek 168 gün", D.zaman()[0].gun, 168, 0);
t.yakin("çoğul 182 gün", D.zaman()[1].gun, 182, 0);
t.yakin("iki hafta kala çalışan da 168 gün alır", D.zaman()[2].gun, 168, 0);
t.dogru("çalışılan altı hafta doğum sonrasına eklenir", D.zaman()[2].sonra === 22);
t.gecsin("24 hafta", "toplam 24 hafta çalıştırılmaz");
t.gecsin("baba 10 gün", "on gün ücretli izin verilir");
t.gecsin("SSS 26 hafta", "toplam 26 hafta");

/* 2 — Örnek: 60.000 TL. Bağımsız aritmetik: 60.000 ÷ 30 × 2/3 × 168. */
var k = D.kisi(D.ORNEK_BRUT);
t.yakin("günlük kazanç 2.000", k.gunlukKazanc, D.ORNEK_BRUT / 30, 1e-9);
t.yakin("168 günlük ödenek", k.toplam, D.ORNEK_BRUT / 30 * 2 / 3 * 168, 0.01);
t.yakin("izin yılı farkı = ödenek − kaybolan net", k.yilFarki, k.toplam - k.kayipNet, 0.02);
t.gecsin("kısa cevap ödenek", "günlük ödenek 1.333,33 TL, toplam " + tl(k.toplam));
t.gecsin("örnek 12 ay kazanç", "On iki ayın kazancı " + tl(D.ORNEK_BRUT * 12));
t.gecsin("örnek 168 gün", "168 günde " + tl(k.toplam));
var cg = D.kisi(D.ORNEK_BRUT, { cogul: true });
t.yakin("ikizde 182 gün", cg.sonuc.raporGunu, 182, 0);
t.gecsin("ikiz tutarı", "182 gün, " + tl(cg.toplam));
t.gecsin("SSS 60k", "60.000 TL brütle çalışmış biri " + tl(k.toplam));
t.gecsin("kaybolan net", "kaybolan net " + tl(k.kayipNet));
t.gecsin("yıl farkı", "Fark yılın sonunda " + isaretli(k.yilFarki) + " TL");
t.gecsin("vergi kazancı", "içindeki " + tl(k.sonrakiVergi) + "'lik vergi kazancı");
var ay = D.yilAylari(D.ORNEK_BRUT);
t.yakin("Kasım ve Aralık farkı eşit", ay[10].maas - ay[10].normal, ay[11].maas - ay[11].normal, 0.01);
t.yakin("iki ayın farkı = sonraki ayların vergisi", 2 * (ay[10].maas - ay[10].normal), k.sonrakiVergi, 0.02);
t.gecsin("ayda 3.570", "netin ayda " + tl(ay[10].maas - ay[10].normal) + " yüksek");
t.dogru("izin ayları: Mayıs–Eylül ücret yok", ay.slice(4, 9).every(function (a) { return a.ucretliGun === 0 && a.maas === 0; }));
t.gecsin("izin tarihleri", "izin 20 Nisan – 4 Ekim 2026");

/* 3 — Asgari ücret: alt sınır. */
var a = D.kisi(D.ASGARI);
t.yakin("asgari günlük kazanç = alt sınır", a.gunlukKazanc, B.donem(B.parametre(2026), 6).asgariBrut / 30, 1e-9);
t.gecsin("asgari toplam", "Asgari ücrette toplam " + tl(a.toplam));
t.gecsin("SSS asgari", "asgari ücretli " + tl(a.toplam));
t.gecsin("asgari fark", "asgari ücrette izin yılı " + S.tam(-a.yilFarki) + " TL eksiyle");
t.gecsin("alt sınır", "2026'da 1.101 TL");
t.gecsin("alt sınır günde", "2026'da günde 1.101 TL");

/* 4 — Eşikler ve zirve. */
var b = D.basabas(), z = D.zirve();
t.dogru("alt eşikte fark ~0", Math.abs(D.kisi(b.alt).yilFarki) < 5, D.kisi(b.alt).yilFarki);
t.dogru("üst eşikte fark ~0", Math.abs(D.kisi(b.ust).yilFarki) < 5, D.kisi(b.ust).yilFarki);
t.dogru("eşiğin altı eksi, üstü artı", D.kisi(b.alt - 1000).yilFarki < 0 && D.kisi(b.alt + 1000).yilFarki > 0);
t.gecsin("alt eşik", "brüt " + tl(b.alt) + "'nin altında");
t.gecsin("standfirst aralık", S.tam(b.alt) + " ile " + tl(b.ust) + " arasında");
t.gecsin("üst eşik", tl(b.ust) + "'den sonra");
t.yakin("zirve 2025 tavanında", z.brut, D.TAVAN_ONCEKI, 0);
t.gecsin("2025 tavanı", virgul(D.TAVAN_ONCEKI) + " TL");
t.gecsin("zirve tutarı", isaretli(z.fark) + " TL'ye");
var c = D.kisi(400000);
t.gecsin("400 bin", "400.000 TL brütte izin yılı " + S.tam(-c.yilFarki) + " TL eksiyle");
var iki = D.kisi(200000);
htmlde("twitter 200k", S.tam(iki.yilFarki) + " TL kazançla");
htmlde("twitter asgari", S.tam(-a.yilFarki) + " TL kayıpla");

/* 5 — Vergisizlik oranları. */
[[D.ASGARI, 1], [60000, 1], [150000, 1], [D.TAVAN, 1]].forEach(function (x) {
  var o = D.oran(x[0]);
  t.gecsin("oran " + x[0], "%" + S.yuzde(o.oran, 1));
});
var oA = D.oran(D.ASGARI), o60 = D.oran(60000), o150 = D.oran(150000), oT = D.oran(D.TAVAN);
t.gecsin("asgari ödenek 30", "30 günlük ödenek " + tl(oA.odenek30) + ", net asgari ücret " + virgul(oA.ortNet) + " TL");
t.gecsin("60k oran", "30 günlük ödenek " + tl(o60.odenek30) + ", yılın ortalama aylık neti " + tl(o60.ortNet));
t.gecsin("150k eşit", "ödenek " + tl(o150.odenek30) + ", ortalama net " + tl(o150.ortNet));
t.gecsin("tavan oranı", "ödenek " + tl(oT.odenek30) + ", ortalama net " + tl(oT.ortNet));
t.gecsin("tavan tutarı", "(" + S.tam(D.TAVAN) + " TL)");

/* 6 — Zam etkisi. */
var zz = D.zamEtkisi();
t.yakin("zamlı günlük kazanç: (10 × 48.000 + 2 × 60.000) ÷ 360", zz.zamli.gunlukKazanc, (10 * 48000 + 2 * 60000) / 360, 1e-9);
t.gecsin("zam günlük", "2.000 TL yerine " + virgul(zz.zamli.gunlukKazanc) + " TL");
t.gecsin("zam oranı", "%" + S.yuzde(zz.oran, 1) + " düşük");
t.gecsin("zam toplam", tl(zz.zamsiz.toplam) + " yerine " + tl(zz.zamli.toplam));
t.gecsin("zam kaybı", "zamanlama yüzünden " + tl(zz.kayip) + " eksik");

/* 7 — Kapak alt metni ve tablo. */
htmlde("kapak 100k", "100.000 TL'de " + isaretli(D.kisi(100000).yilFarki) + " TL");
htmlde("kapak tavan", "SGK tavanında " + isaretli(D.kisi(D.TAVAN).yilFarki) + " TL");
htmlde("kapak 60k", "60.000 TL brütte " + isaretli(k.yilFarki) + " TL");
D.tablo().forEach(function (x) { t.gecsin("tablo " + x.brut, isaretli(x.yilFarki) + " TL"); });

t.bitir("60.000 TL: " + tl(k.toplam) + " ödenek, yıl " + isaretli(k.yilFarki) + " TL; eşik " + tl(b.alt) + ".");
