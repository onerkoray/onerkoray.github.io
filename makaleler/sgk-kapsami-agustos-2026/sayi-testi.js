#!/usr/bin/env node
/*
 * "Sosyal güvenlik kapsamı 1,5 milyon azaldı mı?" yazısının sayıları.
 * Her değer yazının modülünden (kapsam.js) gelir; modül SGK Aylık Bülten
 * Sigortalı İstatistikleri (Ağustos 2025, Ağustos 2026) ve Mali İstatistikler
 * (Ağustos 2026) tablolarından betikle çıkarılmış veri dosyasını okur. Test
 * önce veriyi kendi toplamlarıyla sınar, sonra her rakamın sayfada
 * göründüğünü doğrular.
 *
 * Kullanım: node makaleler/sgk-kapsami-agustos-2026/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var K = require("./kapsam.js");
var t = S.yazi(__dirname);

function isaretli(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + S.tam(Math.abs(n)); }
function ond(x, b) { return x.toFixed(b).replace(".", ","); }
function mlyM(milyonTL) { return S.eksi(ond(milyonTL / 1e3, 1)).replace("-", "−"); }
function satir(ad, hucreler) {
  var s = "<th scope=\"row\">" + ad + "</th>" + hucreler.map(function (h) { return "<td>" + h + "</td>"; }).join("");
  t.dogru(ad + " satırı", t.html.indexOf(s) !== -1, "tabloda yok: " + s);
}

var a = K.K[K.ONCE], b = K.K[K.SON], d = K.yillik();

/* 0 — Veri kendi içinde tutarlı. */
[K.ONCE, K.SON, "2022", "2025"].forEach(function (k) {
  var r = K.K[k];
  t.yakin(k + " kapsam = bileşenler", K.bilesenToplami(r), r.kapsam, 0);
  t.yakin(k + " aktif = alt kalemler", K.AKTIF_KALEMLER.reduce(function (s, x) { return s + r[x]; }, 0), r.aktif, 0);
  t.yakin(k + " zorunlu = alt kalemler", K.ZORUNLU_KALEMLER.reduce(function (s, x) { return s + r[x]; }, 0), r.zorunlu, 0);
  t.yakin(k + " SGK oranı = aktif / pasif dosya", K.oran(r), r.aktifPasifOrani, 0.0006);
});
/* Tablo 3'ün zorunlu satırı ile Tablo 2'nin toplamı aynı ayı söylüyor. */
t.yakin("Tablo 2 = Tablo 3, Ağustos 2025", K.zorunlu("toplam", 2025, 8), a.zorunlu, 0);
t.yakin("Tablo 2 = Tablo 3, Ağustos 2026", K.zorunlu("toplam", 2026, 8), b.zorunlu, 0);
["toplam"].forEach(function () {
  t.yakin("Tablo 2 toplam = 4/a + 4/b + 4/c (Ağustos 2026)", K.zorunlu("4a", 2026, 8) + K.zorunlu("4b", 2026, 8) + K.zorunlu("4c", 2026, 8), K.zorunlu("toplam", 2026, 8), 0);
});
var M = K.mali();
["prim", "devletKatkisi", "gelir", "gider", "acik"].forEach(function (k) {
  t.yakin("Ocak–Ağustos " + k + " = ayların toplamı", M.aylar.reduce(function (s, x) { return s + x[k]; }, 0), M.toplam[k], 0.5);
});
t.dogru("Ağustos dahil 8 ay", M.aylar.length === 8);

/* 1 — Kapsam ve bileşenleri. */
t.gecsin("kapsam farkı", S.tam(-d.kapsam));
t.gecsin("bağımlı farkı", S.tam(-d.bagimli));
t.dogru("bağımlı düşüşü toplam düşüşten büyük", -d.bagimli > -d.kapsam);
var bagimlisiz = d.kapsam - d.bagimli;
t.yakin("bağımlısız fark = aktif + pasif + özel sandık", bagimlisiz, d.aktif + d.pasifKisi + d.ozelSandik, 0);
t.gecsin("bağımlısız kapsam artışı", S.tam(bagimlisiz) + " kişi arttı");
t.dogru("bağımlısız fark pozitif", bagimlisiz > 0);
[["Aktif sigortalı", "aktif"], ["Aylık ya da gelir alan (kişi)", "pasifKisi"], ["Bağımlı", "bagimli"], ["Özel sandıklar", "ozelSandik"], ["Toplam", "kapsam"]].forEach(function (r) {
  satir(r[0], [S.tam(a[r[1]]), S.tam(b[r[1]]), isaretli(d[r[1]])]);
});
t.gecsin("sigortalı nüfus oranı", "%" + S.yuzde(a.sigortaliNufusOrani, 2) + "'ten %" + S.yuzde(b.sigortaliNufusOrani, 2));
t.gecsin("SSS kapsam Ağustos 2025", S.tam(a.kapsam));
t.gecsin("SSS kapsam Ağustos 2026", S.tam(b.kapsam));

/* Toplamın kişi ve özel sandık ayrıntısı. */
var dosyaToplami = b.aktif + b.pasifDosya + b.bagimli;
t.gecsin("pasif kişi", S.tam(b.pasifKisi) + ")");
t.gecsin("pasif dosya", S.tam(b.pasifDosya) + ")");
t.gecsin("dosya ile toplanınca eksik", S.tam(b.kapsam - dosyaToplami) + " kişi eksik");
t.gecsin("dosya–kişi farkı", S.tam(b.pasifKisi - b.pasifDosya) + "'i dosya ile kişi");
t.gecsin("özel sandık payı", S.tam(b.ozelSandik) + "'i özel sandıklar");
t.yakin("eksik = dosya–kişi + özel sandık", b.kapsam - dosyaToplami, (b.pasifKisi - b.pasifDosya) + b.ozelSandik, 0);

/* 2 — Statüye göre zorunlu sigortalılar (Tablo 2). */
[["4/a (ücretli)", "4a"], ["4/b (esnaf, çiftçi)", "4b"], ["4/c (memur)", "4c"], ["Toplam", "toplam"]].forEach(function (r) {
  var o = K.zorunlu(r[1], 2025, 8), n = K.zorunlu(r[1], 2026, 8), f = n - o;
  satir(r[0], [S.tam(o), S.tam(n), isaretli(f), (f > 0 ? "+" : "−") + ond(Math.abs(f / o * 100), 1)]);
});
t.gecsin("ücretli artışı (giriş)", "ücretli sigortalı bir yılda " + S.tam(K.zorunluFark("4a")) + " arttı");
t.gecsin("4/b azalışı (giriş)", "esnaf ve çiftçi " + S.tam(-K.zorunluFark("4b")) + " azaldı");
t.gecsin("4/c artışı (SSS)", "memur (4/c) " + S.tam(K.zorunluFark("4c")) + " arttı");
var b4 = function (y, ay) { return K.zorunlu("4b", y, ay); };
t.gecsin("4/b Haziran 2025", "Haziran 2025'te " + S.tam(b4(2025, 6)));
t.gecsin("4/b Temmuz 2025", "Temmuz'da " + S.tam(b4(2025, 7)));
t.gecsin("4/b Eylül 2025", "Eylül'de " + S.tam(b4(2025, 9)));
t.dogru("Temmuz 2025 sıçraması", b4(2025, 7) - b4(2025, 6) > 700000 && b4(2025, 9) < b4(2025, 8));
t.gecsin("4/b Haziran'a göre", "Haziran 2025'e göre 4/b'deki azalış " + S.tam(b4(2025, 6) - b4(2026, 8)));
t.gecsin("4/b Aralık'a göre", "Aralık 2025'e göre " + S.tam(b4(2025, 12) - b4(2026, 8)));
t.gecsin("tarım 4/b", S.tam(a.tarimZorunlu4b) + "'ten " + S.tam(b.tarimZorunlu4b));
var agustoslar = Object.keys(K.VERI.zorunluAylik["4a"]).map(function (y) { return K.zorunlu("4a", y, 8); }).filter(function (v) { return v != null; });
t.dogru("4/a Ağustos 2026 Ağustos ayları içinde en yüksek", Math.max.apply(null, agustoslar) === K.zorunlu("4a", 2026, 8));
t.gecsin("4/a en yüksek", S.tam(K.zorunlu("4a", 2026, 8)) + " ile Tablo 2'nin Ağustos aylarındaki en yüksek");
t.gecsin("aktif azalışı", "yalnızca " + S.tam(-d.aktif) + " azaldı");
t.gecsin("aktif yüzde", "%" + ond(-d.aktif / a.aktif * 100, 1) + " azaldı");

/* 3 — Aktif/pasif oranı. */
t.gecsin("stajyer Aralık 2025", S.tam(K.K["2025"].stajyer) + " olan stajyer");
t.gecsin("stajyer Ağustos 2026", "Ağustos 2026'da " + S.tam(b.stajyer));
[["Aralık 2015", "2015"], ["Aralık 2022", "2022"], ["Aralık 2023", "2023"], ["Aralık 2025", "2025"], ["Ağustos 2025", K.ONCE], ["Ağustos 2026", K.SON]].forEach(function (r) {
  var x = K.K[r[1]];
  satir(r[0], [ond(K.oran(x), 3), ond(K.stajsizOran(x), 3)]);
});
t.gecsin("SGK oranı Ağustos 2026", "oran 1,572");
t.yakin("SGK'nın yazdığı oran", b.aktifPasifOrani, 1.572, 0.0005);
t.gecsin("staj hariç oran", "oran " + ond(K.stajsizOran(b), 3));
var e = K.K, eyt = e["2023"].pasifDosya - e["2022"].pasifDosya, onceki = e["2022"].pasifDosya - e["2021"].pasifDosya;
t.gecsin("EYT dosya artışı", S.tam(eyt));
t.gecsin("bir önceki yıl dosya artışı", "artış " + S.tam(onceki));
t.dogru("2023 artışı olağan yılın 5 katından fazla", eyt > 5 * onceki);
t.gecsin("oran 2022→2023", ond(K.oran(e["2022"]), 3) + "'den " + ond(K.oran(e["2023"]), 3) + "'e");
t.gecsin("staj hariç Ağustos→Ağustos", ond(K.stajsizOran(a), 3) + "'dan " + ond(K.stajsizOran(b), 3) + "'a");
var y24 = K.stajsizOran(e["2024"]), y25 = K.stajsizOran(e["2025"]), y26 = K.stajsizOran(b);
t.dogru("2024'ten beri yatay (±0,01)", Math.max(y24, y25, y26) - Math.min(y24, y25, y26) < 0.01);
t.dogru("2022 staj hariç 2015'ten farksız (±0,02)", Math.abs(K.stajsizOran(e["2022"]) - K.stajsizOran(e["2015"])) < 0.02);

/* 4 — Mali. */
t.gecsin("8 ay açık", mlyM(M.acik) + " milyar TL");
t.gecsin("8 ay katkı", mlyM(M.toplam.devletKatkisi) + " milyar TL");
t.gecsin("katkısız açık", mlyM(M.katkisizAcik) + " milyar TL");
t.gecsin("prim karşılama", "%" + ond(M.primKarsilama * 100, 1) + "'ını");
t.gecsin("bütçe açığı", mlyM(-M.butce.acik) + " milyar TL açık öngörüyordu");
t.gecsin("Ağustos katkısı", mlyM(M.agustosKatki) + " milyar TL");
t.dogru("açık finansmanı satırı sıfır", M.aylar.every(function (x) { return x.acikFinansmani === 0; }));
["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos"].forEach(function (ad, i) {
  var x = M.aylar[i];
  satir(ad, [mlyM(x.prim), mlyM(x.devletKatkisi), mlyM(x.acik)]);
});

/* 5 — Kaynak ve yöntem notu. */
t.gecsin("yöntem değişikliği", "Ocak 2026'dan beri yeni");
t.dogru("dipnot veride", /hesaplama metodunda değişiklik/.test(K.VERI.kaynak.bagimliDipnotu));
t.gecsin("revizyon notu", "%" + S.yuzde(K.VERI.kaynak.revizyon2024.sigortaliNufusOrani[0], 2) + " ve %" + S.yuzde(K.VERI.kaynak.revizyon2024.sigortaliNufusOrani[1], 2));
t.dogru("2024'te başka revizyon yok", Object.keys(K.VERI.kaynak.revizyon2024).join() === "sigortaliNufusOrani");

t.bitir("Kaynak: SGK Aylık Bülten, Ağustos 2025 ve 2026");
