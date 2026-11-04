#!/usr/bin/env node
/*
 * "Emekliye ilave iyileştirme" yazısının sayıları.
 * Ayrıştırma modülden bağımsız olarak, program.json, butce.json ve TÜFE
 * birikimlerinden yeniden kurulur. Bloğu tools/sgk-kasim-yazilari.js yazar.
 *
 * Kullanım: node makaleler/emekliye-ilave-iyilestirme-ocak-2027/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./iyilestirme.js");
var TB = require("../en-dusuk-emekli-ayligi-ocak-2027/taban.js");
var P = require("../yillik-program-2027/program.json");
var V = require("./butce.json");
var t = S.yazi(__dirname);
function htmlde(ad, m) { t.dogru(ad, t.html.indexOf(m) >= 0, "HTML'de yok: " + m); }

function y1(o) { return (o < 0 ? "%−" : "%") + Math.abs(o * 100).toFixed(1).replace(".", ","); }
function y2(o) { return "%" + (o * 100).toFixed(2).replace(".", ","); }
function tl(v) { return Math.round(v).toLocaleString("tr-TR"); }
function bir(v) { return (Math.round(v / 100) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

/* 1 — Bakanlık sunumu kendi içinde tutarlı. */
var b = V.bakanlik;
t.dogru("SGK + İŞKUR aktarımı", b.sgk + b.iskur === b.aktarim);
t.dogru("aktarım + merkez toplam", b.aktarim + b.merkez === b.toplam);
t.gecsin("SGK payı", y1(b.sgk / b.toplam));
t.gecsin("İŞKUR payı", y1(b.iskur / b.toplam));
t.gecsin("merkez payı", y1(b.merkez / b.toplam));

/* 2 — Dosya sayıları Program tablosuyla toplanıyor. */
var d25 = V.aylikDosya["2025"], d23 = V.aylikDosya["2023"];
t.dogru("2025 dosya toplamı", d25.kamu + d25.hizmet + d25.bagimsiz + d25.sandik === d25.toplam);
var artis25 = d25.toplam / V.aylikDosya["2024"].toplam - 1;
var artis24 = V.aylikDosya["2024"].toplam / (d23.kamu + d23.hizmet + d23.bagimsiz + d23.sandik) - 1;
t.yakin("2025 dosya artışı", M.dosyaArtisi(2025), artis25, 1e-12);
t.yakin("2024 dosya artışı", M.dosyaArtisi(2024), artis24, 1e-12);

/* 3 — Zam oranları motorun ilan edilmiş dönemleriyle tutarlı. */
var Z = TB.Z, ZS = TB.SERI;
function zm(y, a) { return Z.donem(y, a, ZS).birikim; }
t.dogru("Temmuz 2026 zammı %17,75 civarı", Math.abs(zm(2026, 7) - 0.1775) < 0.0005, zm(2026, 7));
t.dogru("Ocak 2026 zammı %12,20 civarı", Math.abs(zm(2026, 1) - 0.122) < 0.0005, zm(2026, 1));

/* 4 — Ayrıştırma bağımsız kurulur. */
var o = M.ocakSenaryolari();
t.yakin("Temmuz 2027 merkez", M.temmuzMerkez(), Math.sqrt(1.21) - 1, 1e-12);
var l24a = 1, l24b = 1 + zm(2024, 7), l25a = l24b * (1 + zm(2025, 1)), l25b = l25a * (1 + zm(2025, 7));
var l26a = l25b * (1 + zm(2026, 1)), l26b = l26a * (1 + zm(2026, 7));
var l27a = l26b * (1 + o.gecenYil), l27b = l27a * (1 + M.temmuzMerkez());
var ort = [(l24a + l24b) / 2, (l25a + l25b) / 2, (l26a + l26b) / 2, (l27a + l27b) / 2];
var od = P.sgk.sigortaOdemeleri, rows = M.ayristirma();
[0, 1, 2].forEach(function (i) {
  var oran = ort[i + 1] / ort[i] - 1, artis = od[i + 1] / od[i] - 1, beklenen = od[i] * (1 + oran) * (1 + artis25);
  var r = rows[i];
  t.yakin(r.yil + " yasal zam etkisi", r.oran, oran, 1e-12);
  t.yakin(r.yil + " kalıntı", r.kalinti, od[i + 1] / beklenen - 1, 1e-12);
  t.yakin(r.yil + " kalıntı TL", r.kalintiTl, od[i + 1] - beklenen, 1e-6);
  t.gecsin(r.yil + " tablo satırı", y1(artis));
  t.gecsin(r.yil + " kalıntı sayfada", y1(r.kalinti));
});
htmlde("merkez fark", "yaklaşık <strong>" + tl(rows[2].kalintiTl / 1000) + " milyar TL</strong>");

var ar = M.aralik();
t.dogru("aralıkta 18 bileşim", ar.adet === 18, ar.adet);
t.gecsin("aralık metni", tl(ar.alt.kalintiTl / 1000) + " ile " + tl(ar.ust.kalintiTl / 1000) + " milyar TL");
t.dogru("en düşük uç geçmiş iki yılın üstünde", ar.alt.kalinti > Math.max(rows[0].kalinti, rows[1].kalinti), ar.alt.kalinti);
t.dogru("geçmişte fark bir buçuk puan içinde", Math.abs(rows[0].kalinti) < 0.015 && Math.abs(rows[1].kalinti) < 0.015);

/* 5 — Ölçek ve eşit maliyet. */
var sey = 1000 * 12 * d25.toplam / 1e6;
t.yakin("seyyanen maliyeti", M.seyyanenMaliyeti(), sey, 1e-6);
t.gecsin("seyyanen sayfada", bir(sey) + " milyar TL");
t.gecsin("dosya başına ölçek", "yaklaşık " + tl(1000 * rows[2].kalintiTl / sey) + " TL");
var ortOcak = od[2] * 1e6 / 12 / d25.toplam * l27a / ort[2];
t.yakin("Ocak ortalaması", M.ortalama().ocak, ortOcak, 1e-6);
t.gecsin("ortalama sayfada", "yaklaşık " + tl(ortOcak) + " TL");
var e = 1000 / ortOcak;
t.gecsin("eşdeğer oran", y2(e) + " ek oran");

/* 6 — Örnek satırlar; üç biçim bağımsız. */
var z = o.gecenYil, T0 = 23552;
function f(v) { return v < 0.5 ? "0" : "+" + tl(v); }
[15000, 21500, 23552, 30000, 40000, 60000].forEach(function (A) {
  var kendi = A * (1 + z), yasal = Math.max(kendi, T0);
  var oran = Math.max(kendi * (1 + e), T0) - yasal, taban = Math.max(kendi, T0 * (1 + z)) - yasal;
  htmlde(A + " satırı", '<th scope="row">' + tl(A) + '</th><td class="num">' + tl(yasal) + '</td><td class="num">+1.000</td><td class="num">' + f(oran) + '</td><td class="num">' + f(taban) + "</td>");
});
t.dogru("ek oran tabana ulaşmıyor", M.ekler(15000).oran === 0);
t.gecsin("kesişme", "yaklaşık " + tl(ortOcak / (1 + z)) + " TL'nin altındaki");
t.gecsin("taban eşiği", tl(T0 / (1 + z)) + " TL'nin altındakine");

/* 7 — Yasal zam cümleleri ve SSS. */
t.gecsin("birikim", y2(o.kesin) + " birikti");
t.gecsin("senaryo aralığı", y2(o.ovp) + " ile " + y2(o.hiz));
t.gecsin("SSS bin lira", bir(sey) + " milyar TL. Bu bir öneri değil");

/* 8 — Sitenin kuralı: sayfada kişi ya da siyasi kuruluş adı yok. */
t.dogru("kişi adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|\bAK Parti\b|\bMHP\b|\bCHP\b/.test(t.html));

t.bitir("Kaynak: Bakanlık sunumu 3 Kasım 2026, 2027 Yıllık Programı, TÜFE Ekim 2026'ya kadar.");
