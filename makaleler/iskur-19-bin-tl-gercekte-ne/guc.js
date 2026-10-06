/*
 * "İŞKUR'dan 19 bin TL: gerçekte ne ödeniyor?" yazısının hesabı.
 *
 * İki kaynak:
 *   - guc-2026-08.json: GÜÇ portalının (guc.iskur.gov.tr) Ağustos 2026
 *     göstergeleri, 6 Ekim 2026'da okunan anlık görüntü;
 *   - iskur-genclik-programi-hesaplama/hesap.js: günlük tutar, 140 gün,
 *     haftalık düzen ve hane geliri kuralları (İŞKUR program sayfaları).
 * Bu dosya yalnız senaryoyu ve oranları kurar; yasal sayı yazmaz.
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..", "..");
var I = require(path.join(KOK, "iskur-genclik-programi-hesaplama", "hesap.js"));
var VERI = require("./guc-2026-08.json");

var BASLANGIC = "2026-11-02";   // örnek: kasım başında başlayan iki genç

function program(kod) { return VERI.programlar.filter(function (p) { return p.kod === kod; })[0]; }
function oran(p) { return p.gerceklesen / p.hedef; }
function kaynakToplami() {
  return VERI.programlar.reduce(function (t, p) { return t + (p.kaynakMilyar || 0); }, 0);
}
function ornekler() {
  return {
    genclik: I.takvim({ program: "genclik", baslangic: BASLANGIC, haftalikGun: 3 }),
    iup: I.takvim({ program: "iup", baslangic: BASLANGIC })
  };
}
/* Kişi başına ayrılan kaynak: program kaynağı ÷ üç yıllık hedef. */
function kisiBasi(kod) {
  var p = program(kod);
  return p.kaynakMilyar ? p.kaynakMilyar * 1e9 / p.ucYil : null;
}

module.exports = {
  VERI: VERI, I: I, BASLANGIC: BASLANGIC,
  program: program, oran: oran, kaynakToplami: kaynakToplami, ornekler: ornekler, kisiBasi: kisiBasi
};
