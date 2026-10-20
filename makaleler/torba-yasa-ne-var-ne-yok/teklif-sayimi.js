/*
 * TBMM 28/5 teklif sorgusunun 20 Ekim 2026 tarihli kesiti.
 * Kaynak: https://www.tbmm.gov.tr/Yasama/Kanun-Teklifleri
 * 3 Ekim'de saklanan önceki 102 kayıt 2/3804–2/3905 aralığındaydı.
 * 15 Ekim sorgusunda bunlara aralıksız 2/3906–2/3949 eklendi (146 kayıt).
 * 20 Ekim sorgusunda 2/3950–2/3960 ve 16 Ekim'de gelen 2027 Merkezi
 * Yönetim Bütçe Kanunu Teklifi (1/282) eklendi; ikisi bir kanunlaşmış
 * ya da torba kanun teklifi değil.
 * Bu sayım tarihsel bir kesittir; güncel yasama verisi yerine geçmez.
 */
"use strict";

const once = require("../ocak-2027-meclis-mi-belirleyecek/teklifler-2026-10-03.json");
const yeniIlk = 3906;
const yeniSon = 3960;
const onceki = 3949;           // 15 Ekim kesitinin son kaydı
const butce = ["1/282"];
const yeni = Array.from({ length: yeniSon - yeniIlk + 1 }, (_, i) => `2/${yeniIlk + i}`);
const sonGelen = yeni.filter((e) => +e.split("/")[1] > onceki);
module.exports = { once, yeni, butce, sonGelen, toplam: once.length + yeni.length + butce.length };
