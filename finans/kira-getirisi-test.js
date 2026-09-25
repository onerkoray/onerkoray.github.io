#!/usr/bin/env node
/*
 * Kira getirisi — regresyon testleri.
 *
 *   - vergi kira geliri motorundan; götürü ve gerçek giderden düşük olanı
 *   - brüt/net getiri ve amortisman tanımları
 *   - kira artışı sıfırken biriken kira kapalı formla aynı
 *   - başabaş değer artışında iki servet eşit
 *   - mevduat neti mevduat fonksiyonundan (365 gün, %15 stopaj)
 *   - GVK m.21: diğer brüt gelir sınırı aşınca istisna yok
 *
 * Kullanım: node finans/kira-getirisi-test.js
 */
"use strict";

var path = require("path");
var K = require(path.join(__dirname, "kira-getirisi.js"));
var G = require(path.join(__dirname, "..", "bordro", "gmsi-motor.js"));
var F = require(path.join(__dirname, "kurallar.js"));
var B = require(path.join(__dirname, "..", "bordro", "motor.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var T = { fiyat: 5e6, alimMasraf: 0.02, aylikKira: 20000, bosAy: 0, yillikGider: 15000, digerGelir: 0,
          kiraArtis: 0.25, degerArtis: 0.25, mevduatFaiz: 37, sure: 10 };
function h(o) { var g = {}; for (var k in T) g[k] = T[k]; for (var j in o) g[j] = o[j]; return K.hesapla(g); }
var r = h({});

/* Vergi: motorla aynı, iki yöntemden düşük olanı */
var m = G.hesapla({ yil: 2026, konutKira: 240000, gercekGider: 15000, brutGelirToplami: 0 });
gecer("vergi götürü/gerçekten düşük olan", yakin(r.ilkYil.vergi, Math.min(m.goturu.kiraVergisi, m.gercek.kiraVergisi)));
var P = B.parametre(2026);
var elle = (240000 - P.gmsi.meskenIstisnasi) * (1 - P.gmsi.goturuGiderOrani) * P.dilimlerUcretDisi[0][1];
gecer("elle: (240.000 − istisna) × 0,85 × %15", yakin(r.ilkYil.vergi, elle, 0.01), r.ilkYil.vergi + " / " + elle);
var gercekYuksek = h({ yillikGider: 60000 });
gecer("gider yüksekse gerçek gider seçilir", gercekYuksek.vergiYontemi === "gerçek gider");

/* Tanımlar */
gecer("toplam maliyet", yakin(r.maliyet, 5.1e6));
gecer("brüt getiri = 12 kira ÷ fiyat", yakin(r.brutGetiri, 240000 / 5e6));
gecer("net getiri tanımı", yakin(r.netGetiri, (240000 - 15000 - r.ilkYil.vergi) / 5.1e6));
gecer("amortisman = maliyet ÷ net kira", yakin(r.amortisman, 5.1e6 / r.ilkYil.netKira));
gecer("dinamik amortisman statikten kısa", r.dinamikAmortisman < r.amortisman);
var bos = h({ bosAy: 2 });
gecer("boş ay tahsilatı düşürür", yakin(bos.ilkYil.tahsil, 200000));

/* Mevduat neti */
gecer("mevduat neti 365 gün, %15 stopaj", yakin(r.mevduatNet, 0.37 * 0.85, 1e-12));
gecer("mevduat neti kurallar.js ile aynı", yakin(r.mevduatNet, F.mevduat(1e6, 37, 365, "2026-01-01", "tl").net / 1e6, 1e-12));
gecer("mevduat serveti", yakin(r.mevduatServet, 5.1e6 * Math.pow(1.3145, 10), 1e-3));

/* Kapalı form: kira artışı sıfırken biriken = net × ((1+m)^N − 1) ÷ m */
var s0 = h({ kiraArtis: 0 });
var mm = s0.mevduatNet;
gecer("biriken kira kapalı form", yakin(s0.birikenKira, s0.ilkYil.netKira * (Math.pow(1 + mm, 10) - 1) / mm, 1e-3));
gecer("konut değeri = fiyat × (1+d)^N", yakin(r.konutDeger, 5e6 * Math.pow(1.25, 10), 1e-3));

/* Başabaş: o değer artışıyla iki servet eşit */
var bb = h({ degerArtis: r.basabasDegerArtis });
gecer("başabaş değer artışında servetler eşit", yakin(bb.konutServet, bb.mevduatServet, 1));
gecer("başabaş, varsayılan artıştan yüksek (konut geride)", r.basabasDegerArtis > 0.25 && r.konutServet < r.mevduatServet);
var sifirFaiz = h({ mevduatFaiz: 0 });
gecer("mevduat sıfırken başabaş negatif ya da sıfıra yakın", sifirFaiz.basabasDegerArtis < 0.01);

/* GVK m.21: diğer brüt gelir 3. dilim ücret sınırını aşarsa istisna yok */
var buyuk = h({ digerGelir: P.dilimler[2][0] + 1 });
gecer("yüksek diğer gelirde istisna yok", buyuk.istisna === 0);
gecer("istisnasız vergi daha yüksek", buyuk.ilkYil.vergi > r.ilkYil.vergi);

/* Hatalı girdi */
gecer("fiyat 0", atar(function () { h({ fiyat: 0 }); }));
gecer("kira 0", atar(function () { h({ aylikKira: 0 }); }));
gecer("boş ay 12", atar(function () { h({ bosAy: 12 }); }));
gecer("süre 41", atar(function () { h({ sure: 41 }); }));

console.log(gecen + " geçti, " + kalan + " kaldı. (kira getirisi)");
process.exit(kalan ? 1 : 0);
