#!/usr/bin/env node
/*
 * "Yaşa göre emekli artışı kime gider?" yazısının sayıları.
 * Veri SGK tablosunun kendi toplamlarıyla, bantlar ve tasarımlar ham diziden
 * elle yeniden kurulup yas.js ile ve sayfadaki metinle karşılaştırılır.
 * Bloğu tools/emekli-farklilastirma-yazilari.js yazar.
 *
 * Kullanım: node makaleler/emekli-yas-haritasi-2025/sayi-testi.js
 */
"use strict";

var S = require("../../tools/makale-sayi.js");
var M = require("./yas.js");
var V = require("./yas-2025.json");
var t = S.yazi(__dirname);

function y1(o) { return "%" + (o * 100).toFixed(1).replace(".", ","); }
function tl(v) { return Math.round(v).toLocaleString("tr-TR"); }
function mln(x) { return (Math.round(x / 1e4) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function topla(d) { return d.reduce(function (a, b) { return a + b; }, 0); }

/* 1 — Veri, SGK tablolarının "Toplam" satırıyla aynı (yaşlılık; kişi). */
var KAYNAK = { "4a": [6884069, 1900080, 11345995], "4b": [1022252 + 440693, 257072 + 71187, 2917656], "4c": [1158118, 521248, 2556291] };
Object.keys(KAYNAK).forEach(function (k) {
  t.dogru(k + " erkek toplamı", topla(V[k].erkek) === KAYNAK[k][0], topla(V[k].erkek));
  t.dogru(k + " kadın toplamı", topla(V[k].kadin) === KAYNAK[k][1], topla(V[k].kadin));
  t.dogru(k + " aylık alan kişi", topla(V[k].aylikAlanKisi) === KAYNAK[k][2], topla(V[k].aylikAlanKisi));
  t.dogru(k + " 101 yaş satırı", V[k].erkek.length === 101 && V[k].kadin.length === 101);
});

/* 2 — Ham diziden elle: tek yaş toplamı, bantlar, ortanca. */
var d = [];
for (var a = 0; a <= 100; a++) d.push(["4a", "4b", "4c"].reduce(function (s, k) { return s + V[k].erkek[a] + V[k].kadin[a]; }, 0));
var N = topla(d);
t.dogru("toplam", N === M.toplam(), N);
function aralik(x, y) { var s = 0; for (var i = x; i <= y; i++) s += d[i]; return s; }
M.bantlar().forEach(function (b) {
  t.dogru("bant " + b.alt + "-" + b.ust, b.kisi === aralik(b.alt, b.ust));
  var ad = b.alt === 0 ? "50 altı" : b.ust === 100 ? b.alt + " ve üzeri" : b.alt + "–" + b.ust;
  t.dogru("bant satırı " + ad, t.html.indexOf('<th scope="row">' + ad + '</th><td class="num">' + tl(b.kisi) + '</td><td class="num">' + y1(b.kisi / N) + "</td>") >= 0, ad);
});
var c = 0, med;
for (a = 0; a <= 100; a++) { c += d[a]; if (c >= N / 2) { med = a; break; } }
t.dogru("ortanca", med === M.ortanca(), med);
t.dogru("30 yaş altında yaşlılık aylığı yok", aralik(0, 29) === 0, aralik(0, 29));
t.gecsin("30 altı sayfada", "30 yaş altında yaşlılık aylığı alan yok");
/* "Sol omuz 43'te başlıyor": 4/a'da 43 yaşındaki yaşlılık aylığı alan 42'dekinin üç katından fazla. */
var a4 = function (i) { return V["4a"].erkek[i] + V["4a"].kadin[i]; };
t.dogru("sol omuz 43", a4(43) > 3 * a4(42) && a4(42) < 2 * a4(41), a4(41) + " " + a4(42) + " " + a4(43));
t.gecsin("sol omuz sayfada", "43 ile 60 yaş arası");
t.gecsin("kısa cevap kişi", mln(N) + " milyon kişi yaşlılık aylığı alıyordu");
t.gecsin("kısa cevap ortanca", "Ortanca yaş " + med + ".");
t.gecsin("60 altı", y1(aralik(0, 59) / N) + "'i 60 yaşın altında");
t.gecsin("65 ve üzeri", y1(aralik(65, 100) / N) + "'i 65 ve üzerinde");

/* 3 — Kapsam özeti elle. */
function kapsam(k) {
  var n = topla(V[k].erkek) + topla(V[k].kadin), s65 = 0, s55 = 0, cc = 0, m = null;
  for (var i = 0; i <= 100; i++) {
    var x = V[k].erkek[i] + V[k].kadin[i];
    if (i >= 65) s65 += x; if (i <= 54) s55 += x;
    cc += x; if (m === null && cc >= n / 2) m = i;
  }
  return { n: n, p65: s65 / n, p55: s55 / n, med: m };
}
var AD = { "4a": "4/a (SSK)", "4b": "4/b (Bağ-Kur)", "4c": "4/c (memur)" };
M.kapsamOzeti().forEach(function (r) {
  var e = kapsam(r.kapsam);
  t.dogru(r.kapsam + " özet", r.kisi === e.n && r.ortanca === e.med && Math.abs(r.pay65 - e.p65) < 1e-12 && Math.abs(r.alti55 - e.p55) < 1e-12);
  t.dogru(r.kapsam + " satırı", t.html.indexOf('<th scope="row">' + AD[r.kapsam] + '</th><td class="num">' + tl(e.n) + '</td><td class="num">' + e.med + '</td><td class="num">' + y1(e.p55) + '</td><td class="num">' + y1(e.p65) + "</td>") >= 0, r.kapsam);
});
var K4 = { "4a": kapsam("4a"), "4b": kapsam("4b"), "4c": kapsam("4c") };
t.gecsin("kapsam 65 payları", "65 ve üzerinin payı 4/a'da " + y1(K4["4a"].p65) + ", 4/b'de " + y1(K4["4b"].p65) + ", 4/c'de " + y1(K4["4c"].p65));

/* 4 — Tasarımlar: aynı bütçe. Elle kur, eşit maliyeti doğrula. */
var T = M.tasarimlar(), n65 = aralik(65, 100);
t.yakin("yalnız 65 tutarı", T.yalniz65.tutar, 1000 * N / n65, 1e-9);
t.yakin("yalnız 65 maliyeti eşit", T.yalniz65.tutar * n65, 1000 * N, 1e-3);
t.dogru("dışarıda kalan", T.yalniz65.disarida === N - n65);
var birim = 1000 * N / (aralik(0, 54) + 2 * aralik(55, 64) + 3 * n65);
t.yakin("kademeli birim", T.kademeli.birim, birim, 1e-9);
t.yakin("kademeli maliyeti eşit", T.kademeli.kademeler.reduce(function (s, k) { return s + k.tutar * k.kisi; }, 0), 1000 * N, 1e-3);
t.yakin("yıllık maliyet", M.yillikMaliyet(), 1000 * 12 * N, 1e-6);
t.gecsin("maliyet sayfada", (Math.round(12000 * N / 1e8) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1 }) + " milyar TL");
t.gecsin("yalnız 65 kişi başı", "kişi başı " + tl(1000 * N / n65) + " TL");
t.gecsin("dışarıda", tl(N - n65) + " kişi hiç almaz");
t.gecsin("bir pay", "Bir pay " + tl(birim) + " TL");
var IY = require("../emekliye-ilave-iyilestirme-ocak-2027/iyilestirme.js");
t.yakin("dosya maliyeti", IY.seyyanenMaliyeti() * 1e6, 1000 * 12 * IY.dosya(2025), 1e-3);
t.gecsin("iki maliyet", "aynı 1.000 TL'yi yılda " + (Math.round(12000 * IY.dosya(2025) / 1e8) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1 }) + " milyar TL bulmuştuk");

/* 5 — Kapsam ortalamaları elle. */
function ort(k, f) { var s = 0, n = 0; for (var i = 0; i <= 100; i++) { var x = V[k].erkek[i] + V[k].kadin[i]; s += x * f(i); n += x; } return s / n; }
var f65 = function (i) { return i >= 65 ? 1000 * N / n65 : 0; };
var fk = function (i) { return birim * (i <= 54 ? 1 : i <= 64 ? 2 : 3); };
["4a", "4b", "4c"].forEach(function (k) {
  var F = M.tutarFonksiyonlari();
  t.yakin(k + " yalnız 65 ortalaması", M.kapsamOrtalamasi(k, F.yalniz65), ort(k, f65), 1e-6);
  t.yakin(k + " kademeli ortalaması", M.kapsamOrtalamasi(k, F.kademeli), ort(k, fk), 1e-6);
  t.dogru(k + " ortalama satırı", t.html.indexOf('<th scope="row">' + AD[k] + '</th><td class="num">1.000</td><td class="num">' + tl(ort(k, f65)) + '</td><td class="num">' + tl(ort(k, fk)) + "</td>") >= 0, k);
});
var o65 = ["4a", "4b", "4c"].map(function (k) { return tl(ort(k, f65)); });
t.gecsin("kısa cevap kayma", "SSK emeklisinin ortalaması " + o65[0] + " TL'ye iner; Bağ-Kur'da " + o65[1] + ", memurda " + o65[2] + " TL'ye çıkar");

/* 6 — Meta ve görsel metni (elle yazılmış alanlar) hesapla aynı. */
var meta = /<meta name="description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("meta: kişi", meta.indexOf(mln(N) + " milyon") >= 0, meta);
t.dogru("meta: ortanca", meta.indexOf("ortanca " + med) >= 0, meta);
t.dogru("meta: SSK 65 üstü", meta.indexOf("SSK'da " + y1(K4["4a"].p65)) >= 0, meta);
t.dogru("meta: Bağ-Kur ve memur", meta.indexOf("Bağ-Kur'da " + y1(K4["4b"].p65) + ", memurda " + y1(K4["4c"].p65)) >= 0, meta);
var og = /<meta property="og:description" content="([^"]*)"/.exec(t.html)[1];
t.dogru("og: üç ortalama", og.indexOf("SSK ortalaması " + o65[0] + ", Bağ-Kur " + o65[1] + ", memur " + o65[2]) >= 0, og);
t.dogru("lead alt", t.html.indexOf("SSK emeklisinde " + o65[0] + ", Bağ-Kur'da " + o65[1] + ", memurda " + o65[2] + " TL") >= 0);

/* 7 — Sitenin kuralı: kişi ya da siyasi kuruluş adı yok; tasarım varsayımsal deniyor. */
t.dogru("kişi adı yok", !/Işıkhan|Şimşek|Yılmaz|Erdoğan|Muş\b|\bAK Parti\b|\bMHP\b|\bCHP\b|\bDEM\b|İYİ Parti/.test(t.html));
t.gecsin("varsayımsal", "varsayımsal");
t.gecsin("birincil kaynak: tutanak", "TBMM Plan ve Bütçe Komisyonu tutanağı");

t.bitir("Kaynak: SGK İstatistik Yıllığı 2025 Tablo 2.7, 2.21, 2.33; TBMM PBK tutanağı 5 Kasım 2026.");
