#!/usr/bin/env node
/*
 * "Prim gününe göre emekli artışı" yazısının sayıları.
 * Gün şartları kanun tablosundan elle, yaş sınırı altındakiler SGK ham
 * dizisinden elle yeniden kurulur; gun.js ve sayfadaki metinle karşılaştırılır.
 * Bloğu tools/emekli-farklilastirma-yazilari.js yazar.
 *
 * Kullanım: node makaleler/prim-gunune-gore-emekli-artisi/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./gun.js");
var V = require("../emekli-yas-haritasi-2025/yas-2025.json");
var t = S.yazi(__dirname);

function y1(o) { return "%" + (o * 100).toFixed(1).replace(".", ","); }
function tl(v) { return Math.round(v).toLocaleString("tr-TR"); }
function mln(x) { return (Math.round(x / 1e4) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* 1 — Kanun tablosu (506 Geçici m.81/B): en az ve en çok gün; iki cinsiyette aynı uçlar. */
var B = M.tablolar.b81, gunler = [];
["kadin", "erkek"].forEach(function (c) { B[c].satirlar.forEach(function (r) { gunler.push(r[1]); }); });
var enAz = Math.min.apply(null, gunler), enCok = Math.max.apply(null, gunler);
t.dogru("81/B en az 5000", enAz === 5000, enAz);
t.dogru("81/B en çok 5975", enCok === 5975, enCok);
t.dogru("81/B 75 günlük adımlar", gunler.every(function (g) { return (g - 5000) % 75 === 0 || g === 5975; }));

/* 2 — Sınırlarda motorun okuduğu şart: 8 Eylül 1999 ve 1 Mayıs 2008. */
var s = M.sinirlar();
t.dogru("7 Eylül 1999 tam", s[0].erkek.tam === 5975 && s[0].kadin.tam === 5975);
t.dogru("7 Eylül 1999 yaştan", s[0].erkek.kismi === 3600 && s[0].kadin.kismi === 3600);
t.dogru("8 Eylül 1999", s[1].erkek.tam === 7000 && s[1].kadin.tam === 7000 && s[1].erkek.grup === "gecis");
t.dogru("30 Nisan 2008", s[2].erkek.tam === 7000);
t.dogru("1 Mayıs 2008", s[3].erkek.tam === 7200 && s[3].kadin.tam === 7200 && s[3].erkek.grup === "yeni");
t.dogru("eşik bugünkü 4/a şartı", M.ESIK === s[3].erkek.tam);
var sr = M.seri("erkek", 1975, 2012);
t.dogru("seri artmayan değil", sr.every(function (r, i) { return i === 0 || r.tam >= sr[i - 1].tam; }));
t.dogru("erkek 1980 girişi 5.000", M.gerekenGun("1980-06-01", "erkek").tam === 5000);
t.dogru("erkek 1981 girişi 5.000'in üstünde", M.gerekenGun("1981-06-01", "erkek").tam > 5000);

/* 3 — Sayfa: tablo ve kısa cevap. */
t.gecsin("kısa cevap aralık", "1999 öncesinde " + tl(enAz) + " ile " + tl(enCok) + ", 1999–2008 arasında 7.000, 2008 sonrasında 7.200");
t.gecsin("yaştan aylık", "yaş şartıyla 3.600 günle de bağlanabiliyordu");
t.dogru("tablo EYT satırı", t.html.indexOf('<th scope="row">1999 öncesi, tam aylık (EYT)</th><td class="num">5.000–5.975</td>') >= 0);
t.dogru("tablo 2008 satırı", t.html.indexOf('<th scope="row">1 Mayıs 2008 ve sonrası</th><td class="num">7.200</td>') >= 0);
t.gecsin("sıçrama", "şart bir günde " + tl(7000 - 5975) + " gün arttı");
t.gecsin("eşik uzaklığı", tl(7200 - enCok) + " ile " + tl(7200 - enAz) + " gün geride bırakır");
t.dogru("eşik tablosu yaştan", t.html.indexOf('<th scope="row">1999 öncesi, yaştan aylık</th><td class="num">3.600</td><td class="num">−3.600</td>') >= 0);

/* 4 — Yaş sınırı altındakiler: ham diziden elle. */
function alti(k) {
  var e = 0, kk = 0, n = 0;
  for (var a = 0; a <= 100; a++) { n += V[k].erkek[a] + V[k].kadin[a]; if (a < 60) e += V[k].erkek[a]; if (a < 58) kk += V[k].kadin[a]; }
  return { e: e, k: kk, top: e + kk, pay: (e + kk) / n };
}
var A = alti("4a"), Bb = alti("4b");
t.dogru("yaş sınırları", M.YAS_SINIRI.kadin === 58 && M.YAS_SINIRI.erkek === 60);
t.dogru("4/a altında", M.yasAlti("4a").toplam === A.top && M.yasAlti("4a").erkek === A.e, A.top);
t.dogru("4/b altında", M.yasAlti("4b").toplam === Bb.top, Bb.top);
t.dogru("4/a satırı", t.html.indexOf('<th scope="row">4/a (SSK)</th><td class="num">' + tl(A.e) + '</td><td class="num">' + tl(A.k) + '</td><td class="num">' + tl(A.top) + '</td><td class="num">' + y1(A.pay) + "</td>") >= 0);
t.dogru("4/b satırı", t.html.indexOf('<th scope="row">4/b (Bağ-Kur)</th><td class="num">' + tl(Bb.e) + '</td><td class="num">' + tl(Bb.k) + '</td><td class="num">' + tl(Bb.top) + '</td><td class="num">' + y1(Bb.pay) + "</td>") >= 0);
t.gecsin("kısa cevap kişi", mln(A.top) + " milyonu (" + y1(A.pay) + ")");
t.gecsin("SSS kişi", "4/a'da " + tl(A.top) + " kişi 1999 öncesi kurallarla bağlanmış");

/* 5 — Meta ve görsel metni (elle yazılmış alanlar) hesapla aynı. */
var meta = /<meta name="description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("meta: aralık", meta.indexOf("3.600 ile 7.200") >= 0 && s[0].erkek.kismi === 3600 && s[3].erkek.tam === 7200, meta);
t.dogru("meta: pay", meta.indexOf(y1(A.pay)) >= 0, meta);
var og = /<meta property="og:description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("og: uzaklık", og.indexOf(tl(7200 - enCok) + " ile " + tl(7200 - enAz) + " gün") >= 0, og);
t.dogru("lead alt", t.html.indexOf("1999 öncesinde " + tl(enAz) + " ile " + tl(enCok) + ", 1999–2008 arasında 7.000, 2008 sonrasında 7.200 gün") >= 0);

/* 6 — Sitenin kuralı. */
t.dogru("kişi adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|Muş\b|\bAK Parti\b|\bMHP\b|\bCHP\b|\bDEM\b|İYİ Parti/.test(t.html));
t.gecsin("varsayımsal", "varsayımsal");
t.gecsin("birincil kaynak: tutanak", "TBMM Plan ve Bütçe Komisyonu tutanağı");

t.bitir("Kaynak: 506 Geçici m.81, 5510 Geçici m.9 ve m.28, SGK İstatistik Yıllığı 2025, TBMM PBK tutanağı 5 Kasım 2026.");
