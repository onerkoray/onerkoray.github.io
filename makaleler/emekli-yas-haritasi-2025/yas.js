/*
 * "Yaşa göre emekli artışı" yazısının hesabı.
 *
 * Veri: SGK İstatistik Yıllığı 2025, yaşlılık aylığı alanların tek yaşa göre
 * sayısı (yas-2025.json; 4/a, 4/b, 4/c). Malullük ve ölüm aylığı alanlar
 * (hak sahipleri) yaş tasarımlarına girmez; yazı bunu ayrıca söyler.
 *
 * Tasarımlar VARSAYIMSALDIR: düzenlemenin metni yok. Hepsi aynı bütçeyi
 * dağıtır: her yaşlılık aylığı alana ayda TUTAR TL eşit artışın maliyeti.
 */
"use strict";

var V = require("./yas-2025.json");
var KAPSAMLAR = ["4a", "4b", "4c"];
var TUTAR = 1000;               // eşit artışın aylık tutarı, TL (karşılaştırma birimi)
var YAS_ESIK = 65;              // "65 ve üzeri" tasarımının sınırı

/* Bantlar: [alt, üst] dahil. */
var BANTLAR = [[0, 49], [50, 54], [55, 59], [60, 64], [65, 69], [70, 74], [75, 100]];
/* Üç kademeli tasarım: 55 altı 1, 55–64 2, 65 ve üzeri 3 pay. */
var KADEMELER = [{ alt: 0, ust: 54, pay: 1 }, { alt: 55, ust: 64, pay: 2 }, { alt: 65, ust: 100, pay: 3 }];

function kisi(f, kapsamlar) {
  var s = 0;
  (kapsamlar || KAPSAMLAR).forEach(function (k) {
    for (var y = 0; y <= 100; y++) if (f(y)) s += V[k].erkek[y] + V[k].kadin[y];
  });
  return s;
}
function aralik(a, b, kapsamlar) { return kisi(function (y) { return y >= a && y <= b; }, kapsamlar); }
function toplam(kapsamlar) { return aralik(0, 100, kapsamlar); }

function bantlar() {
  var N = toplam();
  return BANTLAR.map(function (b) { var n = aralik(b[0], b[1]); return { alt: b[0], ust: b[1], kisi: n, pay: n / N }; });
}

/* Tek yaş dizisi (bütün kapsamlar toplamı). */
function yasDizisi() {
  var d = [];
  for (var y = 0; y <= 100; y++) d.push(aralik(y, y));
  return d;
}

/* Ortanca yaş: kişilerin yarısının bu yaş ya da altında olduğu ilk yaş. */
function ortanca() {
  var N = toplam(), c = 0, d = yasDizisi();
  for (var y = 0; y <= 100; y++) { c += d[y]; if (c >= N / 2) return y; }
}

/* Bütçe: eşit artışın yıllık maliyeti, TL. */
function yillikMaliyet() { return TUTAR * 12 * toplam(); }

/* Aynı bütçeyle üç dağıtım. Her biri kişi başı aylık tutarları verir. */
function tasarimlar() {
  var N = toplam(), n65 = aralik(YAS_ESIK, 100);
  var paySayisi = KADEMELER.reduce(function (s, k) { return s + k.pay * aralik(k.alt, k.ust); }, 0);
  var birim = TUTAR * N / paySayisi;
  return {
    esit: { tutar: TUTAR },
    yalniz65: { tutar: TUTAR * N / n65, kisi: n65, pay: n65 / N, disarida: N - n65 },
    kademeli: {
      birim: birim,
      kademeler: KADEMELER.map(function (k) {
        var n = aralik(k.alt, k.ust);
        return { alt: k.alt, ust: k.ust, pay: k.pay, tutar: birim * k.pay, kisi: n, oran: n / N };
      })
    }
  };
}

/* Kapsama göre ortanca ve 65 yaş üstü payı: 4/c'nin yaş yapısı ayrı. */
function kapsamOzeti() {
  return KAPSAMLAR.map(function (k) {
    var N = toplam([k]), c = 0, med = null;
    for (var y = 0; y <= 100 && med === null; y++) { c += V[k].erkek[y] + V[k].kadin[y]; if (c >= N / 2) med = y; }
    return { kapsam: k, kisi: N, ortanca: med, pay65: aralik(YAS_ESIK, 100, [k]) / N, alti55: aralik(0, 54, [k]) / N };
  });
}

/* Bir tasarımda kapsamın kişi başı ortalama aylık artışı, TL.
   tutarFn(yas) → o yaştaki kişinin aylık artışı. */
function kapsamOrtalamasi(kapsam, tutarFn) {
  var s = 0, n = 0;
  for (var y = 0; y <= 100; y++) { var k = V[kapsam].erkek[y] + V[kapsam].kadin[y]; s += k * tutarFn(y); n += k; }
  return s / n;
}
function tutarFonksiyonlari() {
  var T = tasarimlar();
  return {
    esit: function () { return T.esit.tutar; },
    yalniz65: function (y) { return y >= YAS_ESIK ? T.yalniz65.tutar : 0; },
    kademeli: function (y) { for (var i = 0; i < KADEMELER.length; i++) if (y >= KADEMELER[i].alt && y <= KADEMELER[i].ust) return T.kademeli.birim * KADEMELER[i].pay; }
  };
}

/* 60 yaş altı payı. */
function altmisAlti() { return aralik(0, 59) / toplam(); }

/* Tüm aylık alanlar (malullük, yaşlılık, ölüm): tablonun "kişi" sütunu. */
function aylikAlanlar() {
  return KAPSAMLAR.reduce(function (s, k) { return s + V[k].aylikAlanKisi.reduce(function (a, b) { return a + b; }, 0); }, 0);
}

module.exports = {
  V: V, KAPSAMLAR: KAPSAMLAR, TUTAR: TUTAR, YAS_ESIK: YAS_ESIK, BANTLAR: BANTLAR, KADEMELER: KADEMELER,
  kisi: kisi, aralik: aralik, toplam: toplam, bantlar: bantlar, yasDizisi: yasDizisi, ortanca: ortanca,
  yillikMaliyet: yillikMaliyet, tasarimlar: tasarimlar, kapsamOzeti: kapsamOzeti, aylikAlanlar: aylikAlanlar,
  kapsamOrtalamasi: kapsamOrtalamasi, tutarFonksiyonlari: tutarFonksiyonlari, altmisAlti: altmisAlti
};
