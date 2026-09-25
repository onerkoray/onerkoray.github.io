#!/usr/bin/env node
/*
 * Reel maaş hesaplama — sayfadaki SSS örneği.
 * Ocak 2023 → Ağustos 2026 geçmiş iki aydır; sayılar yeni veriyle değişmez.
 *
 * Kullanım: node reel-maas-hesaplama/test.js
 */
"use strict";

var path = require("path");
var S = require("../tools/makale-sayi.js");
var R = require(path.join(S.KOK, "finans", "reel-maas.js"));
var t = S.yazi(__dirname);

var r = R.karsilastir({ eski: { ay: "2023-01", tutar: 30000, tur: "net" }, yeni: { ay: "2026-08", tutar: 60000, tur: "net" } });
t.gecsin("fiyat katı", "fiyatlar " + r.fiyatCarpani.toFixed(2).replace(".", ",") + " katına");
t.gecsin("alım gücü kaybı", "alım gücü %" + S.yuzde(-r.reelDegisim) + " azalmıştır");
t.gecsin("olması gereken", S.tl(r.gerekenNet) + " TL gerekirdi");
t.bitir();
