#!/usr/bin/env node
/*
 * "2025 kesin hesabı" yazısının sayıları. Önce Sayıştay tablolarının kendi
 * toplamları denetlenir: elle girilen bir rakam yanlışsa kimlik tutmaz.
 * Bloğu tools/kesin-hesap-yazisi.js yazar.
 *
 * Kullanım: node makaleler/kesin-hesap-2025-sayistay/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./kesin.js");
var Bu = require("../../finans/butce.js");
var V = require("./kesin-hesap.json");
var t = S.yazi(__dirname);
function htmlde(ad, m) { t.dogru(ad, t.html.indexOf(m) >= 0, "HTML'de yok: " + m); }
function mly(x) { return (x < 0 ? "−" : "") + (Math.round(Math.abs(x) / 1e8) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function y1(o) { return (o < 0 ? "%−" : "%") + Math.abs(o * 100).toFixed(1).replace(".", ","); }

/* 1 — Tablo kimlikleri. */
var k = V.konsolide, g = V.genelButce;
t.yakin("brüt gider − net gider ile açık farkı", (k.netGelir - k.netGider), k.netAcik, 0.01);
t.yakin("kullanılmayan ödenek", k.yilSonu - k.brutGider - k.kullanilmayan, 0, 1e6 * 1e3);
["baslangic", "toplam", "gider", "kullanilmayan"].forEach(function (a) {
  var top = V.kurumlar.reduce(function (s, r) { return s + r[a]; }, 0);
  t.yakin("41 idare toplamı: " + a, top, V.genelToplam[a], 0.05);
});
t.yakin("genel bütçe ödeneği cetvelle aynı", V.genelToplam.baslangic, g.odenek, 0.01);
t.yakin("genel bütçe gideri cetvelle aynı", V.genelToplam.gider, g.gider, 0.01);
t.yakin("yedek ödenek kalan", V.yedek.toplam - V.yedek.dusulen, V.yedek.kalan, 0.01);
t.dogru("41 idare", V.kurumlar.length === 41);

/* 2 — Limitler: bildirimin aritmetiği. */
var L = M.limitler();
var l23 = V.limit["2023"], l24 = V.limit["2024"], l25 = V.limit["2025"];
t.yakin("2025 ilaveli tutar", (l25.odenek - l25.gelir) * 1.05 * 1.05, 2133745047945, 1);
t.yakin("2025 son limit = ilaveli + 595 milyar", L[2].yuzdeli + l25.ek, l25.son, 1);
t.yakin("2023 son limit ilavelinin üç katı", L[0].yuzdeli * 3, l23.son, 1);
t.yakin("2023 ek = son − ilaveli", L[0].yuzdeli + l23.ek, l23.son, 1);
t.yakin("2024 artırılmadı", l24.odenek - l24.gelir, l24.son, 0.01);
["2023", "2024", "2025"].forEach(function (y) {
  t.yakin(y + " iç + dış = net", V.limit[y].ic + V.limit[y].dis, V.limit[y].net, 0.01);
  t.dogru(y + " limit aşılmadı", V.limit[y].net <= V.limit[y].son);
});
t.dogru("2025 ek olmasa aşılırdı", L[2].ekOlmadanAsim > 0, L[2].ekOlmadanAsim);
t.dogru("2024'te kanundakinin altında", L[1].kullanim < 1);

/* 3 — Sayfadaki rakamlar. */
var o = M.ozet();
t.gecsin("harcama sapması", "fark " + y1(o.giderSapma));
t.gecsin("açık sapması", "tahminin " + y1(o.acikSapma) + " üstünde");
t.dogru("açık tahminin üstünde", o.acikSapma > 0, o.acikSapma);
t.gecsin("kanundaki limit", mly(L[2].ham) + " milyar TL'ydi");
t.gecsin("son limit", mly(l25.son) + " milyar TL oldu");
t.gecsin("gerçekleşen", "Gerçekleşen " + mly(l25.net) + " milyar TL");
t.gecsin("ek olmadan aşım", mly(L[2].ekOlmadanAsim) + " milyar TL aşılacaktı");
t.gecsin("kullanım", "kanundaki limitin " + y1(L[2].kullanim) + " kadarı");
t.gecsin("borç ve açık farkı", mly(o.borcAcikFarki) + " milyar TL büyük");
t.gecsin("stok artışı", y1(o.stokArtis) + " fazla");
L.forEach(function (r) { htmlde(r.yil + " satırı", '<th scope="row">' + r.yil + '</th><td class="num">' + mly(r.ham) + "</td>"); });
var kr = M.kurumlar();
t.dogru("altı idare seçildi", kr.secilen.length === 6);
kr.secilen.forEach(function (r) { htmlde(r.ad + " satırı", '<th scope="row">' + r.ad + '</th><td class="num">' + mly(r.baslangic) + '</td><td class="num">' + mly(r.gider) + "</td>"); });
t.gecsin("en çok kullanılmayan", mly(kr.enCokKullanilmayan.kullanilmayan) + " milyar TL ile " + kr.enCokKullanilmayan.ad);

/* 4 — Bulgular. */
var b = V.bulgu;
t.dogru("TBMM bulgu toplamı", b.tbmm.mali + b.tbmm.mevzuat + b.tbmm.icKontrol === b.tbmm.toplam);
t.dogru("mahallî bulgu toplamı", b.mahalli.mali + b.mahalli.mevzuat + b.mahalli.icKontrol === b.mahalli.toplam);
t.dogru("tüm bulgular", b.tbmm.toplam + b.mahalli.toplam === b.tum);
t.gecsin("bulgu sayısı", "1.102 bulgu");

/* 5 — 2027. */
var s = M.yirmiYedi();
t.yakin("teklif açığı", s.acik, -Bu.yil(2027).denge * 1e9, 1);
t.gecsin("2027 sınırı", "yaklaşık " + mly(s.yuzdeli) + " milyar TL");

/* 6 — Sitenin kuralı. */
t.dogru("kişi adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|\bAK Parti\b|\bMHP\b|\bCHP\b/.test(t.html));

t.bitir("Kaynak: Sayıştay 2023–2025 Genel Uygunluk Bildirimleri, 2025 Dış Denetim Genel Değerlendirme Raporu.");
