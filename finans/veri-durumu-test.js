#!/usr/bin/env node
/*!
 * Veri durumu — doğrulama. Çalıştırma: node finans/veri-durumu-test.js
 * Takvim kira motoruyla karşılaştırılır; aynı kural iki yerde yazılı olduğu
 * için ayrılırsa burası kırılır.
 */
"use strict";
var V = require("./veri-durumu.js");
var K = require("./kira-motoru.js");
var T = require("./tufe-serisi.js");
var KT = require("./kira-tufe.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}

console.log("Takvim");
var ayni = true;
for (var y = 2024; y <= 2030; y++) for (var a = 1; a <= 12; a++) {
  var ay = y + "-" + (a < 10 ? "0" : "") + a;
  if (V.aciklamaTarihi(ay) !== K.aciklamaTarihi(ay)) ayni = false;
}
ok("84 ayda kira motoruyla aynı", ayni);
ok("Aralık 2026 verisi 4 Ocak 2027", V.aciklamaTarihi("2026-12") === "2027-01-04");

console.log("Evreler");
ok("açıklamadan önce bekleniyor", V.durum("2026-10", "2026-12-02").evre === "bekleniyor");
ok("açıklama günü işleniyor", V.durum("2026-10", "2026-12-03").evre === "isleniyor");
ok("üç gün sonra hâlâ işleniyor", V.durum("2026-10", "2026-12-06").evre === "isleniyor");
ok("dördüncü gün gecikti", V.durum("2026-10", "2026-12-07").evre === "gecikti");
ok("yıl dönümünde sonraki ay", V.durum("2026-12", "2027-01-20").sonraki === "2027-01");

console.log("Metin");
var m = V.metin(V.durum("2026-10", "2026-11-06"));
ok("normal metin", m === "Veri: TÜİK TÜFE, son ay Ekim 2026. Kasım 2026 verisi 3 Aralık 2026 tarihinde açıklanacak.", m);
m = V.metin(V.durum("2026-10", "2026-12-04"));
ok("açıklandı ama işlenmedi", /açıklandı, sitede kısa süre/.test(m), m);
m = V.metin(V.durum("2026-10", "2026-12-20"));
ok("gecikme son doğrulanmış veriyi söylüyor", /son ay Ekim 2026/.test(m) && /açıklanmış olmalıydı/.test(m) && /son doğrulanmış/.test(m), m);

console.log("Seriler");
ok("TÜFE son ayı okunuyor", V.sonAyi(T) === T.sonAy);
ok("kira son ayı okunuyor", V.sonAyi(KT) === Object.keys(KT.oranlar).sort().pop(), V.sonAyi(KT));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
