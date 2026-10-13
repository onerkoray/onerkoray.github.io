/*
 * "SGK'ya devlet katkısı kalktı" yazısının hesabı.
 *
 * İki kaynak:
 *   - sgk-mali-2026-07.json: SGK Aylık İstatistik Bülteni, Mali İstatistikler,
 *     Temmuz 2026 (Tablo 28, 30, 31), 13 Ekim 2026'da indirilen Excel'den
 *     elle değil betikle çıkarıldı;
 *   - bordro/parametreler.js: 2026 prim oranları ve asgari ücret.
 * Kaldırılan hüküm (5510 m.81, üçüncü fıkra): Devlet, Kurumun ay itibarıyla
 * tahsil ettiği malullük, yaşlılık ve ölüm sigortaları ile genel sağlık
 * sigortası priminin dörtte biri oranında katkı yapar. 7590 sayılı Kanun
 * m.15 ile 1/8/2026'dan itibaren yürürlükten kalktı.
 * Bu dosya oran ve farkları kurar; yasal sayı yazmaz.
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..", "..");
var P = require(path.join(KOK, "bordro", "parametreler.js"));
var VERI = require("./sgk-mali-2026-07.json");

var KATKI_PAYI = 1 / 4;          // kaldırılan fıkranın "dörtte biri"
var MILYAR = 1e6;                // bin TL → milyar TL bölen (Tablo 28 ve 31)

function yil(y) { return VERI.yillikBinTL.filter(function (r) { return r.yil === y; })[0]; }
function transfer(y) { return VERI.transferBinTL.filter(function (r) { return r.yil === y; })[0]; }

/* Katkı gelir sayılmasaydı yılın dengesi (bin TL). */
function katkisizDenge(r) { return r.denge - r.devletKatkisi; }

/* Denge ve katkısız denge, giderin oranı olarak (enflasyondan bağımsız ölçek). */
function seri(bas, son) {
  return VERI.yillikBinTL.filter(function (r) { return r.yil >= bas && r.yil <= son; }).map(function (r) {
    return { yil: r.yil, denge: r.denge / r.gider, katkisiz: katkisizDenge(r) / r.gider,
      primKarsilama: r.prim / r.gider, katkiPayi: r.devletKatkisi / r.gider };
  });
}

/* Tablodaki fazla veren yıllar. */
function fazlaYillari() { return VERI.yillikBinTL.filter(function (r) { return r.denge > 0; }).map(function (r) { return r.yil; }); }

/* Katkının bütçeden SGK'ya giden toplam transfer içindeki payı. */
function katkiTransferPayi(y) { return yil(y).devletKatkisi / transfer(y).transfer; }

/* 2026: bütçede öngörülen katkı, Ocak–Temmuz gerçekleşen ve kalan (milyon TL). */
function y2026() {
  var B = VERI.butce2026MilyonTL, T = VERI.toplam2026OcakTemmuzMilyonTL;
  return {
    butceKatki: B.devletKatkisi, butceAcikFinansmani: B.acikFinansmani, butceAcik: -B.acik,
    gerceklesenKatki: T.devletKatkisi, kalanKatki: B.devletKatkisi - T.devletKatkisi,
    katkisizButceAcigi: -B.acik + B.devletKatkisi,
    ocakTemmuzAcik: -T.acik, aylar: VERI.aylik2026MilyonTL
  };
}

/* Bir 4/a sigortalı için katkının karşılığı: MYÖ + GSS primi × 1/4.
   MYÖ + GSS = işçi payı + işveren payı − kısa vadeli sigorta kolları primi. */
function isciBasina(brut, yilAd) {
  var o = P[yilAd || 2026].oranlar;
  var oran = o.sgkIsci + o.sgkIsveren - o.kisaVadeli;
  return { myoGssOrani: oran, prim: brut * oran, katki: brut * oran * KATKI_PAYI };
}
function asgariBrut(yilAd) { return P[yilAd || 2026].donemler[0].asgariBrut; }
function sgkTavan(yilAd) { return P[yilAd || 2026].donemler[0].sgkTavan; }

module.exports = {
  VERI: VERI, P: P, KATKI_PAYI: KATKI_PAYI, MILYAR: MILYAR,
  yil: yil, transfer: transfer, katkisizDenge: katkisizDenge, seri: seri, fazlaYillari: fazlaYillari,
  katkiTransferPayi: katkiTransferPayi, y2026: y2026, isciBasina: isciBasina, asgariBrut: asgariBrut, sgkTavan: sgkTavan
};
