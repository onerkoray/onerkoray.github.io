/*!
 * Bordro Motoru — doğrulama testleri.  Çalıştırma:  node bordro/test.js
 *
 * En güçlü referans: brüt asgari ücret girildiğinde motorun ürettiği net,
 * Asgari Ücret Tespit Komisyonu'nun ilan ettiği resmî net asgari ücrete
 * eşit olmalıdır. Bu, tarife + SGK + istisna + damga zincirinin tamamını
 * tek seferde doğrular ve her yıl için bağımsız bir kontrol noktasıdır.
 */
"use strict";
var B = require("./motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, tolerans) { return Math.abs(a - b) <= (tolerans || 0.01); }
function baslik(s) { console.log("\n" + s); }

/* 1 — Resmî net asgari ücret referansı (her yıl, her dönem) */
baslik("Resmî net asgari ücret ile karşılaştırma");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil);
  var brutler = [];
  for (var m = 1; m <= 12; m++) brutler.push(B.donem(P, m).asgariBrut);
  var sonuc = B.hesaplaYil(brutler, yil);
  P.donemler.forEach(function (d) {
    var satir = sonuc.aylar[d.ay - 1];
    ok(yil + " / " + satir.ayAdi + " net asgari ücret = " + d.asgariNet,
      yakin(satir.net, d.asgariNet), satir.net.toFixed(2));
  });
});

/* 2 — Asgari ücret istisnası rejiminde asgari ücretli gelir vergisi ödemez */
baslik("Asgari ücretlinin yıl boyunca gelir vergisi yükü");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil);
  if (P.istisnaRejimi !== "asgari-ucret") return;
  var brutler = [];
  for (var m = 1; m <= 12; m++) brutler.push(B.donem(P, m).asgariBrut);
  var toplam = B.hesaplaYil(brutler, yil).toplam;
  ok(yil + " asgari ücretli yıllık gelir vergisi = 0", yakin(toplam.gelirVergisi, 0), toplam.gelirVergisi.toFixed(2));
  ok(yil + " asgari ücretli yıllık damga vergisi = 0", yakin(toplam.damga, 0), toplam.damga.toFixed(2));
});

/* 3 — AGİ rejiminde damga vergisi brütün tamamı üzerinden alınır */
baslik("AGİ rejimi (2020-2021) damga vergisi tabanı");
[2020, 2021].forEach(function (yil) {
  var P = B.parametre(yil), brut = P.donemler[0].asgariBrut;
  var satir = B.hesaplaYil(brut, yil).aylar[0];
  ok(yil + " damga = brüt × ‰7,59", yakin(satir.damga, brut * 0.00759), satir.damga.toFixed(2));
});

/* 4 — Kümülatif tarife tutarlılığı: aylık vergilerin toplamı yıllık matrahın vergisine eşit */
baslik("Kümülatif tarife tutarlılığı");
B.yillar().forEach(function (yil) {
  var sonuc = B.hesaplaYil(120000, yil);
  var aylikToplam = sonuc.aylar.reduce(function (t, a) { return t + a.vergiTarife; }, 0);
  var yillik = B.tarifeVergisi(sonuc.aylar[11].kumulatifMatrah, sonuc.parametre.dilimler);
  ok(yil + " Σ aylık tarife vergisi = yıllık matrahın vergisi", yakin(aylikToplam, yillik, 0.02));
});

/* 5 — SGK tavanı: tavanın üzerinde prim sabitlenir */
baslik("SGK tavanı");
B.yillar().forEach(function (yil) {
  var d = B.parametre(yil).donemler[0];
  var a = B.hesaplaYil(d.sgkTavan, yil).aylar[0];
  var b = B.hesaplaYil(d.sgkTavan * 3, yil).aylar[0];
  ok(yil + " tavan üstü SGK primi sabit", yakin(a.sgk, b.sgk), a.sgk.toFixed(2) + " ≠ " + b.sgk.toFixed(2));
});

/* 6 — Netten brüte çözücü, brütten nete ile tutarlı olmalı (gidiş-dönüş) */
baslik("Netten brüte gidiş-dönüş");
[[2026, 60000], [2026, 250000], [2025, 45000], [2023, 20000], [2021, 5000], [2020, 4000]].forEach(function (c) {
  var yil = c[0], hedef = c[1];
  var brut = B.nettenBrute(hedef, yil, 0);
  var net = B.hesaplaYil(brut, yil).aylar[0].net;
  ok(yil + " net " + hedef + " → brüt " + brut.toFixed(2) + " → net", yakin(net, hedef, 0.02), net.toFixed(2));
});

/* 7 — Kümülatif tarifenin tek yönlülüğü ve istisna muhasebesi.
       Not: NET maaş her zaman azalmaz. Asgari ücretlinin kümülatif matrahı
       üst dilime geçtiğinde istisna tutarı büyür ve yüksek ücretlinin neti
       yıl ortasında yükselebilir. Azalmayan büyüklük, tarife vergisidir. */
baslik("Kümülatif tarifenin tek yönlülüğü");
B.yillar().forEach(function (yil) {
  // Yıl içinde SGK tavanı değişen yıllarda matrah düşebileceği için bu değişmez geçerli değil.
  if (B.parametre(yil).donemler.length > 1) return;
  var aylar = B.hesaplaYil(150000, yil).aylar, azalan = false;
  for (var i = 1; i < 12; i++) if (aylar[i].vergiTarife < aylar[i - 1].vergiTarife - 0.01) azalan = true;
  ok(yil + " sabit brütte aylık tarife vergisi azalmıyor", !azalan);
});

baslik("Yıl içi SGK tavanı değişiminin matraha etkisi");
[2022, 2023].forEach(function (yil) {
  var P = B.parametre(yil), aylar = B.hesaplaYil(P.donemler[1].sgkTavan * 2, yil).aylar;
  ok(yil + " Temmuz'da tavan yükselince SGK primi artar", aylar[6].sgk > aylar[5].sgk);
  ok(yil + " Temmuz'da prim arttığı için matrah düşer", aylar[6].matrah < aylar[5].matrah);
});

baslik("İstisna muhasebesi: ödenen vergi = tarife − istisna");
B.yillar().forEach(function (yil) {
  var s = B.hesaplaYil(150000, yil);
  var tarife = 0, istisna = 0;
  s.aylar.forEach(function (a) { tarife += a.vergiTarife; istisna += a.istisna; });
  ok(yil + " Σ gelir vergisi = Σ tarife − Σ istisna",
    yakin(s.toplam.gelirVergisi, tarife - istisna, 0.02),
    s.toplam.gelirVergisi.toFixed(2) + " ≠ " + (tarife - istisna).toFixed(2));
});

baslik("İstisnanın dilim geçişi (2026, 150.000 TL brüt)");
var y26 = B.hesaplaYil(150000, 2026).aylar;
var artan = y26.some(function (a, i) { return i > 0 && a.net > y26[i - 1].net + 0.01; });
ok("Asgari ücret istisnası büyüdüğü için net yıl ortasında yükseliyor", artan);

/* 8 — Dilim geçişi işaretleniyor */
baslik("Vergi dilimi geçişi tespiti");
var g = B.hesaplaYil(150000, 2026).aylar.filter(function (a) { return a.dilimGecisi; });
ok("2026 / 150.000 TL brütte en az bir dilim geçişi işaretlendi", g.length > 0, g.length + " geçiş");
ok("İlk ay dilim geçişi olarak işaretlenmiyor", B.hesaplaYil(150000, 2026).aylar[0].dilimGecisi === false);

/* 9 — Bilinen tarife noktaları */
baslik("Tarife köşe noktaları");
ok("2026 / 190.000 matrahın vergisi = 28.500", yakin(B.tarifeVergisi(190000, B.parametre(2026).dilimler), 28500));
ok("2026 / 400.000 matrahın vergisi = 70.500", yakin(B.tarifeVergisi(400000, B.parametre(2026).dilimler), 28500 + 210000 * 0.20));
ok("2020 / 22.000 matrahın vergisi = 3.300", yakin(B.tarifeVergisi(22000, B.parametre(2020).dilimler), 3300));

/* 10 — Her yıl için parametre bütünlüğü */
baslik("Parametre bütünlüğü");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil), sorun = [];
  if (!P.dilimler || P.dilimler.length < 2) sorun.push("dilimler");
  if (P.dilimler[P.dilimler.length - 1][0] !== null) sorun.push("son dilim açık uçlu değil");
  if (!P.donemler || !P.donemler.length || P.donemler[0].ay !== 1) sorun.push("donemler");
  P.donemler.forEach(function (d) {
    if (!(d.sgkTavan > d.asgariBrut)) sorun.push("tavan ≤ taban");
    if (!(d.asgariNet > 0 && d.asgariNet < d.asgariBrut)) sorun.push("asgariNet");
  });
  if (P.istisnaRejimi === "agi" && !P.agiOranlari) sorun.push("agiOranlari");
  if (!P.dayanak) sorun.push("dayanak");
  ok(yil + " parametre bloğu tutarlı", sorun.length === 0, sorun.join(", "));
});

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
