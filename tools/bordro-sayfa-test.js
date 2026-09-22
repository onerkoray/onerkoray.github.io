/* Envanter ayrımı ve canlı örneğin gerçek UMD motoruna bağlantısı. */
"use strict";
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var E = require("./bordro-envanter.js");
var kok = path.dirname(__dirname);
var html = fs.readFileSync(path.join(kok, "bordro/index.html"), "utf8");
var araclar = E.araclar();
["beyanname-hesaplama", "prim-ikramiye-vergisi", "zam-hesaplama", "finansal-ikiz"].forEach(function (slug) {
  assert(araclar.some(function (a) { return a.slug === slug && a.cekirdek; }), slug);
});
["borc-kapatma-plani", "emekli-ayligi-hesaplama"].forEach(function (slug) {
  assert(araclar.some(function (a) { return a.slug === slug && !a.cekirdek; }), slug);
});
assert(!araclar.some(function (a) { return a.slug === "bordro"; }));
assert.strictEqual(E.testOzeti("\n132 geçti, 0 kaldı.\n"), 132);
assert.strictEqual(E.testOzeti("\n96 gecti, 0 kaldi. (test)"), 96);
assert.throws(function () { E.testOzeti("\n3 geçti, 1 kaldı."); });
assert.throws(function () { E.testOzeti("tamam"); });

function eleman(value) {
  return {
    value: value || "", textContent: "", hidden: true, children: [], events: {}, attributes: {},
    appendChild: function (c) { this.children.push(c); if (!this.value && c.value !== undefined) this.value = String(c.value); },
    replaceChildren: function () { this.children = []; },
    addEventListener: function (n, f) { this.events[n] = f; },
    setAttribute: function (n, v) { this.attributes[n] = v; }
  };
}
var els = {};
Array.from(html.matchAll(/<[^>]+\bid="(ornek-[^"]+|bordro-ornek)"[^>]*>/g)).forEach(function (m) {
  var v = m[0].match(/\bvalue="([^"]+)"/);
  els[m[1]] = eleman(v ? v[1] : "");
  var max = m[0].match(/\bmax="([^"]+)"/);
  if (max) els[m[1]].max = max[1];
});
els["ornek-tur"].value = "brut";
var ctx = { document: {
  getElementById: function (id) { assert(els[id], "Eksik HTML alanı: " + id); return els[id]; },
  createElement: function () { return eleman(); }
} };
ctx.window = ctx;
vm.createContext(ctx);
["parametreler.js", "motor.js", "ornek.js"].forEach(function (f) {
  assert(html.indexOf('src="' + f) !== -1, "Script bağlantısı: " + f);
  vm.runInContext(fs.readFileSync(path.join(kok, "bordro", f), "utf8"), ctx);
});
var nf = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
function hesapla() { els["bordro-ornek"].events.submit({ preventDefault: function () {} }); }
assert.strictEqual(els["bordro-ornek"].hidden, false);
assert.strictEqual(els["ornek-net"].textContent, nf.format(58080.27));
// Tüm yıllarda ve aylarda net sözleşme hedefi korunmalı; tek ay ters çözümü bu testi geçemez.
els["ornek-tur"].value = "net";
els["ornek-tutar"].value = "60000";
ctx.Bordro.yillar().forEach(function (y) {
  els["ornek-yil"].value = String(y);
  for (var i = 0; i < 12; i++) {
    els["ornek-ay"].value = String(i); hesapla();
    assert.strictEqual(els["ornek-net"].textContent, nf.format(60000), y + "/" + i);
    assert.strictEqual(els["ornek-kalemler"].children.length, 9);
  }
});
els["ornek-tur"].value = "brut";
els["ornek-yil"].value = "2023";
els["ornek-ay"].value = "0";
els["ornek-tutar"].value = "11000"; hesapla();
assert.strictEqual(els["ornek-sonuc"].hidden, true, "Temmuz asgari ücreti de dikkate alınmalı");
["", "0", "-1", "NaN", "Infinity", "100000001"].forEach(function (v) {
  els["ornek-tutar"].value = v; hesapla();
  assert.strictEqual(els["ornek-sonuc"].hidden, true, v);
  assert(els["ornek-hata"].textContent.length > 0);
});
els["ornek-tutar"].value = "75000";
els["ornek-tutar"].events.input();
assert.strictEqual(els["ornek-sonuc"].hidden, false);
assert.strictEqual(els["ornek-hata"].textContent, "");
assert.strictEqual(els["ornek-tutar"].attributes["aria-invalid"], "false");
console.log("Bordro sayfası: envanter, 84 net sözleşme senaryosu ve geçersiz girdi kontrolleri geçti.");
