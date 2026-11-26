/*
 * "Sosyal güvenlik kapsamı 1,5 milyon azaldı mı?" yazısının hesabı.
 *
 * Tek kaynak: sgk-kapsam-2026-08.json. SGK Aylık İstatistik Bülteni
 * Sigortalı İstatistikleri Ağustos 2026 ve Ağustos 2025 (Tablo 2, 3) ile
 * Mali İstatistikler Ağustos 2026 (Tablo 30), 26 Kasım 2026'da indirilen
 * Excel'lerden elle değil betikle çıkarıldı.
 *
 * Tablo 3'te yıl sütunları yıl sonu (Aralık), "YYYY-08" anahtarları Ağustos.
 * Bu dosya fark ve oran kurar; SGK'nın yazmadığı bir sayı üretmez.
 */
"use strict";

var VERI = require("./sgk-kapsam-2026-08.json");
var K = VERI.kapsam;

var ONCE = "2025-08", SON = "2026-08";

/* Sosyal sigorta kapsamı = aktif + pasif (kişi) + bağımlı + özel sandıklar.
   SGK'nın toplamı pasifi DOSYA değil KİŞİ olarak sayar. */
var BILESENLER = ["aktif", "pasifKisi", "bagimli", "ozelSandik"];
function bilesenToplami(d) { return BILESENLER.reduce(function (s, k) { return s + d[k]; }, 0); }

/* Aktif sigortalının alt kalemleri (SGK Tablo 3, I. bölüm). */
var AKTIF_KALEMLER = ["zorunlu", "cirak", "yurtdisiTopluluk", "tarim4a", "istegeBagli", "stajyer"];
var ZORUNLU_KALEMLER = ["zorunluTarimHaric", "tarimZorunlu4b", "muhtar"];

/* İki dönem arasındaki değişim, her alan için. */
function fark(a, b) {
  var d = {};
  Object.keys(K[b]).forEach(function (k) { if (typeof K[b][k] === "number" && typeof K[a][k] === "number") d[k] = K[b][k] - K[a][k]; });
  return d;
}
function yillik() { return fark(ONCE, SON); }

/* Aktif/pasif oranı: SGK aktif sigortalıyı aylık DOSYASINA böler.
   Staj ve çıraklık hariç: yalnız iş kazası ve meslek hastalığına karşı
   sigortalı sayılan stajyer, kursiyer ve çıraklar paydan çıkarılır. */
function oran(d) { return d.aktif / d.pasifDosya; }
function stajsizAktif(d) { return d.aktif - d.stajyer - d.cirak; }
function stajsizOran(d) { return stajsizAktif(d) / d.pasifDosya; }

/* Yıl sonu serisi (Aralık) + Ağustos 2026. */
function oranSerisi() {
  var yillar = Object.keys(K).filter(function (k) { return /^\d{4}$/.test(k); }).sort();
  return yillar.concat([SON]).map(function (k) { return { donem: k, sgk: oran(K[k]), stajsiz: stajsizOran(K[k]) }; });
}

/* Tablo 2: statüye göre zorunlu sigortalı (stajyer, çırak vb. hariç), ay ay. */
var Z = VERI.zorunluAylik;
function zorunlu(statu, yil, ay) { return Z[statu][String(yil)][ay - 1]; }
function zorunluFark(statu) { return zorunlu(statu, 2026, 8) - zorunlu(statu, 2025, 8); }

/* Mali Tablo 30 (milyon TL): 2026 Ocak–Ağustos. */
var M = VERI.mali2026MilyonTL;
function mali() {
  var T = M.toplam;
  return {
    aylar: M.aylar, toplam: T, butce: M.butce,
    acik: -T.acik, katkisizAcik: -T.acik + T.devletKatkisi,
    primKarsilama: T.prim / T.gider,
    agustosKatki: M.aylar[7].devletKatkisi
  };
}

module.exports = {
  VERI: VERI, K: K, ONCE: ONCE, SON: SON, BILESENLER: BILESENLER, AKTIF_KALEMLER: AKTIF_KALEMLER, ZORUNLU_KALEMLER: ZORUNLU_KALEMLER,
  bilesenToplami: bilesenToplami, fark: fark, yillik: yillik,
  oran: oran, stajsizAktif: stajsizAktif, stajsizOran: stajsizOran, oranSerisi: oranSerisi,
  zorunlu: zorunlu, zorunluFark: zorunluFark, mali: mali
};
