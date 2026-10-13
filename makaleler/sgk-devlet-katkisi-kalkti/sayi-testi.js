#!/usr/bin/env node
/*
 * "SGK'ya devlet katkısı kalktı" yazısının sayıları.
 * Her değer yazının modülünden (katki.js) gelir; modül SGK Aylık Bülten
 * Mali İstatistikler Temmuz 2026 tablolarından betikle çıkarılmış veri
 * dosyasını (sgk-mali-2026-07.json) ve bordro motorunun 2026 prim oranlarını
 * okur. Test önce veriyi kendi toplamlarıyla ve bağımsız aritmetikle sınar,
 * sonra her rakamın sayfada göründüğünü doğrular.
 *
 * Kullanım: node makaleler/sgk-devlet-katkisi-kalkti/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var K = require("./katki.js");
var t = S.yazi(__dirname);

/* milyar TL, tek ondalık, Türkçe; eksi işareti sayfadaki gibi "−" */
function mly(binTL) { return S.eksi((binTL / 1e6).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })).replace("-", "−"); }
function mlyM(milyonTL) { return S.eksi((milyonTL / 1e3).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })).replace("-", "−"); }
function yz(o) { return "%" + S.yuzde(o, 1); }
function htmlde(ad, x) { t.dogru(ad, t.html.indexOf(x) !== -1, "HTML'de yok: " + x); }
function hucre(ad, s) { t.dogru(ad, t.html.indexOf("<td>" + s + "</td>") !== -1, "tabloda yok: " + s); }

/* 0 — Veri kendi içinde tutarlı: gelir = prim + katkı + diğer; denge = gelir − gider. */
K.VERI.yillikBinTL.forEach(function (r) {
  t.yakin(r.yil + " gelir toplamı", r.prim + r.devletKatkisi + r.diger, r.gelir, 2);
  t.yakin(r.yil + " denge", r.gelir - r.gider, r.denge, 2);
});
var ay = K.VERI.aylik2026MilyonTL, top = K.VERI.toplam2026OcakTemmuzMilyonTL;
["prim", "devletKatkisi", "gelir", "gider", "acik"].forEach(function (k) {
  t.yakin("2026 Ocak–Temmuz " + k + " = ayların toplamı", ay.reduce(function (s, a) { return s + a[k]; }, 0), top[k], 0.5);
});
/* Tablo 28'in 2026 satırı (bin TL) ile Tablo 30'un toplamı (milyon TL) aynı katkıyı söylüyor. */
t.yakin("Tablo 28 ve 30 katkı", 379741920.9 / 1e3, top.devletKatkisi, 1);
t.dogru("katkı 2008'de başladı", K.yil(2007).devletKatkisi === 0 && K.yil(2008).devletKatkisi > 0);

/* 1 — 2025: fazla, katkı, katkısız açık. */
var r25 = K.yil(2025);
t.yakin("2025 katkısız = denge − katkı", K.katkisizDenge(r25), r25.denge - r25.devletKatkisi, 0);
t.dogru("2025 katkısız açık", K.katkisizDenge(r25) < 0 && r25.denge > 0);
t.gecsin("2025 fazla", mly(r25.denge) + " milyar TL");
t.gecsin("2025 katkı", mly(r25.devletKatkisi) + " milyar TL");
t.gecsin("2025 katkısız açık", mly(-K.katkisizDenge(r25)) + " milyar TL");
t.gecsin("katkı ¼ ≈ prim payı", "dörtte biri");
t.dogru("katkı primin dörtte birinden az (kısa vadeli ve diğer primler dahil)", r25.devletKatkisi / r25.prim < 0.25 && r25.devletKatkisi / r25.prim > 0.2);
t.dogru("fazla veren tek yıl 2025", K.fazlaYillari().join() === "2025");
t.gecsin("tablo 2002'den", "başladığı 2002'den bu yana fazla veren tek yıl");

/* 2 — 2021–2025 tablosu: her hücre veriden. */
[2021, 2022, 2023, 2024, 2025].forEach(function (y) {
  var r = K.yil(y);
  [["prim", r.prim], ["katkı", r.devletKatkisi], ["diğer", r.diger], ["gider", r.gider], ["denge", r.denge], ["katkısız", K.katkisizDenge(r)]].forEach(function (k) {
    hucre(y + " " + k[0], mly(k[1]));
  });
});

/* 3 — Uzun dönem oranları (giderin yüzdesi). */
var s09 = K.seri(2009, 2009)[0], s25 = K.seri(2025, 2025)[0];
t.gecsin("2009 prim karşılama", yz(s09.primKarsilama));
t.gecsin("2025 prim karşılama", yz(s25.primKarsilama));
t.gecsin("2009 katkısız", yz(-s09.katkisiz));
t.gecsin("2025 katkısız", yz(-s25.katkisiz));
htmlde("2009 denge (alt metin)", "%-" + S.yuzde(-s09.denge, 1));
htmlde("2025 denge (alt metin)", "%+" + S.yuzde(s25.denge, 1));
var pay = K.seri(2011, 2025).map(function (r) { return r.katkiPayi; });
var enAz = Math.min.apply(null, pay), enCok = Math.max.apply(null, pay);
t.gecsin("2011'den beri katkı payı aralığı", yz(enAz) + " ile " + yz(enCok) + "'i arasında");

/* 4 — Bütçe transferleri. */
var tr25 = K.transfer(2025);
t.gecsin("2025 bütçe transferi", mly(tr25.transfer) + " milyar TL");
t.gecsin("GSYH oranı", "GSYH'nin %" + String(tr25.gsyhOrani).replace(".", ",") + "'i");
t.gecsin("katkının transfer payı", yz(K.katkiTransferPayi(2025)));
t.dogru("katkı transferin yarısından az", K.katkiTransferPayi(2025) < 0.5);

/* 5 — 2026 bütçesi ve gerçekleşme. */
var z = K.y2026();
t.yakin("açık finansmanı = öngörülen açık", z.butceAcikFinansmani, z.butceAcik, 0.01);
t.yakin("kalan = bütçe − gerçekleşen", z.kalanKatki, z.butceKatki - z.gerceklesenKatki, 0);
t.yakin("katkısız bütçe açığı = açık + katkı", z.katkisizButceAcigi, z.butceAcik + z.butceKatki, 0);
t.gecsin("2026 bütçe katkı", mlyM(z.butceKatki) + " milyar TL");
t.gecsin("2026 açık finansmanı", mlyM(z.butceAcikFinansmani) + " milyar TL açık finansmanı");
t.gecsin("Ocak–Temmuz katkı", mlyM(z.gerceklesenKatki) + " milyar TL");
t.gecsin("gerçekleşme oranı", yz(z.gerceklesenKatki / z.butceKatki));
t.gecsin("kalan katkı", mlyM(z.kalanKatki) + " milyar TL");
t.gecsin("katkısız bütçe açığı", mlyM(z.katkisizButceAcigi) + " milyar TL");
t.gecsin("Ocak–Temmuz açık", mlyM(z.ocakTemmuzAcik) + " milyar TL");
t.dogru("Mart ve Nisan katkı sıfır", z.aylar[2].devletKatkisi === 0 && z.aylar[3].devletKatkisi === 0);
t.dogru("açık finansmanı satırı sıfır", z.aylar.every(function (a) { return a.acikFinansmani === 0; }));
t.gecsin("Temmuz katkı", "Temmuz'da " + mlyM(z.aylar[6].devletKatkisi) + " milyar TL");
z.aylar.forEach(function (a) {
  hucre(a.ad + " prim", mlyM(a.prim));
  hucre(a.ad + " katkı", mlyM(a.devletKatkisi));
  hucre(a.ad + " denge", mlyM(a.acik));
});

/* 6 — Sigortalı başına: MYÖ + GSS = işçi + işveren − kısa vadeli; katkı = ¼. */
var o = K.P[2026].oranlar;
var asg = K.isciBasina(K.asgariBrut());
t.yakin("MYÖ+GSS oranı", asg.myoGssOrani, 0.09 + 0.12 + 0.05 + 0.075, 1e-9);
t.gecsin("işçi payı", "%" + S.yuzde(o.sgkIsci, 0) + " sigortalı");
t.gecsin("işveren payı", "%" + S.yuzde(o.sgkIsveren, 2) + " işveren");
t.gecsin("kısa vadeli", "%" + S.yuzde(o.kisaVadeli, 2) + "'i işverenin");
t.gecsin("MYÖ+GSS", "%" + S.yuzde(asg.myoGssOrani, 1));
t.gecsin("brütün payı", "%" + S.yuzde(asg.myoGssOrani * K.KATKI_PAYI, 3));
[[K.asgariBrut(), "33.030 (asgari ücret)"], [60000, "60.000"], [100000, "100.000"], [K.sgkTavan(), "297.270 (SGK tavanı)"]].forEach(function (b) {
  var i = K.isciBasina(b[0]);
  t.dogru(b[1] + " satırı", t.html.indexOf("<th scope=\"row\">" + b[1] + "</th><td>" + S.tam(i.prim) + "</td><td>" + S.tam(i.katki) + "</td>") !== -1,
    S.tam(i.prim) + " / " + S.tam(i.katki));
});
t.gecsin("asgari ücretli katkı", "ayda yaklaşık " + S.tam(asg.katki) + " TL");

/* 7 — Kanun ve aynı kanunun öteki maddesi. */
t.gecsin("yürürlük", "1 Ağustos 2026");
t.gecsin("7590 m.15", "7590 sayılı Kanun m.15");
t.gecsin("en düşük aylık", "23.552 TL");
var EP = require("../../bordro/emeklilik-parametreleri.js");
t.dogru("site en düşük aylığı 23.552 kullanıyor", JSON.stringify(EP).indexOf("23552") !== -1);

t.bitir("Kaynak: SGK Mali İstatistikler Temmuz 2026, 7590 s.K.");
