/*
 * TBMM 28/5 teklif sorgusunun 15 Ekim 2026 tarihli kesiti.
 * Kaynak: https://www.tbmm.gov.tr/Yasama/Kanun-Teklifleri
 * 3 Ekim'de saklanan önceki 102 kayıt 2/3804–2/3905 aralığındaydı.
 * 15 Ekim sorgusunda bunlara aralıksız 2/3906–2/3949 eklendi.
 * Bu sayım tarihsel bir kesittir; güncel yasama verisi yerine geçmez.
 */
"use strict";

const once = require("../ocak-2027-meclis-mi-belirleyecek/teklifler-2026-10-03.json");
const yeniIlk = 3906;
const yeniSon = 3949;
const yeni = Array.from({ length: yeniSon - yeniIlk + 1 }, (_, i) => `2/${yeniIlk + i}`);
module.exports = { once, yeni, toplam: once.length + yeni.length };
