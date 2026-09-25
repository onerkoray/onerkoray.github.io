/*!
 * Faiz dönüştürücü — aylık, yıllık basit, yıllık bileşik, günlük; kredi,
 * mevduat ve reel faiz.
 *
 * Türkiye'de aynı kelime üç ayrı oran için kullanılıyor: kredi "aylık"
 * faizle, mevduat "yıllık brüt" (vadeye göre basit) faizle, enflasyon ise
 * yıllık bileşik değişimle ilan ediliyor. Karşılaştırma ancak ortak bir
 * ölçüye çevrilince anlamlı olur; ortak ölçü burada yıllık bileşik orandır.
 *
 *   yıllık basit (nominal)  = aylık × 12
 *   yıllık bileşik (efektif) = (1 + aylık)^12 − 1
 *   günlük basit            = yıllık basit ÷ 365
 *   kredi maliyeti (aylık)  = akdi faiz × (1 + KKDF + BSMV)  → kredi aracının brutOran'ı
 *   mevduat neti            = kurallar.js mevduat() (vadeye göre stopaj)
 *   mevduat yıllık bileşik  = (1 + vade neti)^(365 ÷ gün) − 1   (aynı faizle yenilenirse)
 *   reel                    = (1 + nominal) ÷ (1 + enflasyon) − 1
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/faiz-donusturucu/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../kredi-hesaplama/hesap.js"), require("./kurallar.js"));
  } else {
    kok.FaizDonustur = fabrika(kok.Kredi, kok.Finans);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (KH, F) {
  "use strict";

  var TURLER = ["aylik", "yillikBasit", "yillikBilesik", "gunluk"];

  function sonlu(x, ad) { if (!isFinite(x)) throw new Error(ad + " sayı olmalı."); return x; }

  /* Her şey önce aylık orana çevrilir, sonra dört biçime açılır. Oranlar kesir (0,05 = %5). */
  function donustur(deger, tur) {
    sonlu(deger, "Oran");
    var a;
    if (tur === "aylik") a = deger;
    else if (tur === "yillikBasit") a = deger / 12;
    else if (tur === "yillikBilesik") { if (deger <= -1) throw new Error("Yıllık bileşik oran −%100'den büyük olmalı."); a = Math.pow(1 + deger, 1 / 12) - 1; }
    else if (tur === "gunluk") a = deger * 365 / 12;
    else throw new Error("Bilinmeyen oran türü: " + tur);
    if (a <= -1) throw new Error("Aylık oran −%100'den büyük olmalı.");
    var bilesik = Math.pow(1 + a, 12) - 1;
    return {
      aylik: a, yillikBasit: a * 12, yillikBilesik: bilesik, gunluk: a * 12 / 365,
      ikiyeKatlanmaYil: bilesik > 0 ? Math.log(2) / Math.log(1 + bilesik) : null
    };
  }

  /* Kredi: akdi aylık faiz (kesir) + tür → vergili aylık maliyet ve yıllık bileşik. */
  function kredi(aylikFaiz, turAd, kkdf, bsmv) {
    sonlu(aylikFaiz, "Faiz");
    if (aylikFaiz < 0) throw new Error("Faiz negatif olamaz.");
    var t = KH.turBilgi(turAd);
    var k = kkdf == null ? t.kkdf : kkdf, b = bsmv == null ? t.bsmv : bsmv;
    var brut = KH.brutOran(aylikFaiz * 100, k, b);
    return { tur: t, kkdf: k, bsmv: b, aylikAkdi: aylikFaiz, aylikMaliyet: brut,
             yillikBasit: brut * 12, yillikBilesik: Math.pow(1 + brut, 12) - 1,
             /* Maliyetin vergiye giden payı faiz düzeyinden bağımsız. */
             vergiPayi: (k + b) / 100 / (1 + (k + b) / 100) };
  }

  /* Mevduat: yıllık brüt faiz (kesir) ve vade (gün) → net. */
  function mevduat(yillikBrut, gun) {
    sonlu(yillikBrut, "Faiz");
    if (yillikBrut < 0) throw new Error("Faiz negatif olamaz.");
    gun = Math.round(gun);
    if (!(gun >= 1 && gun <= 3650)) throw new Error("Vade 1 ile 3650 gün arasında olmalı.");
    if (yillikBrut === 0) return { gun: gun, stopajOrani: F.stopajOraniGun(gun, "tl") / 100, vadeNet: 0, yillikNetBasit: 0, yillikNetBilesik: 0 };
    var m = F.mevduat(1e6, yillikBrut * 100, gun, "2026-01-01", "tl");
    var vadeNet = m.net / 1e6;
    return { gun: gun, stopajOrani: m.taxPct / 100, vadeBrut: m.gross / 1e6, vadeNet: vadeNet,
             yillikNetBasit: vadeNet * 365 / gun, yillikNetBilesik: Math.pow(1 + vadeNet, 365 / gun) - 1 };
  }

  function reel(nominalYillik, enflasyon) {
    sonlu(nominalYillik, "Nominal oran"); sonlu(enflasyon, "Enflasyon");
    if (enflasyon <= -1) throw new Error("Enflasyon −%100'den büyük olmalı.");
    return (1 + nominalYillik) / (1 + enflasyon) - 1;
  }

  return { surum: "1.0.0", TURLER: TURLER, donustur: donustur, kredi: kredi, mevduat: mevduat, reel: reel };
});
