/* Envanter ayrımı ve bordro incelemesinin gerçek UMD motoruna bağlantısı.
   Sayfa betiği (bordro/ornek.js) sahte bir DOM'da çalıştırılır; ekrana
   yazdığı her tutar motorun doğrudan hesabıyla karşılaştırılır. */
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

// ---- sahte DOM ---------------------------------------------------------------
function eleman(value) {
  return {
    value: value || "", textContent: "", hidden: true, disabled: false, checked: false,
    children: [], events: {}, attributes: {}, style: {}, className: "",
    appendChild: function (c) { this.children.push(c); if (!this.value && c.value !== undefined && c.value !== "") this.value = String(c.value); },
    replaceChildren: function () { this.children = []; },
    addEventListener: function (n, f) { this.events[n] = f; },
    setAttribute: function (n, v) { this.attributes[n] = String(v); },
    getAttribute: function (n) { return this.attributes[n]; },
    querySelector: function (sec) {
      var m = sec.match(/option\[value="([^"]+)"\]/);
      return m ? this.children.filter(function (c) { return String(c.value) === m[1]; })[0] : null;
    },
    querySelectorAll: function () { return []; }
  };
}
var els = {};
Array.from(html.matchAll(/<(\w+)[^>]*\bid="(ornek-[^"]+|bordro-ornek)"[^>]*>/g)).forEach(function (m) {
  var v = m[0].match(/\bvalue="([^"]+)"/);
  els[m[2]] = eleman(v ? v[1] : "");
  var max = m[0].match(/\bmax="([^"]+)"/);
  if (max) els[m[2]].max = max[1];
  // statik seçenekler (engellilik, teşvik)
  if (m[1] === "select") {
    var bitis = html.indexOf("</select>", m.index);
    Array.from(html.slice(m.index, bitis).matchAll(/<option value="([^"]*)">([^<]*)</g)).forEach(function (o) {
      var op = eleman(o[1]); op.textContent = o[2]; els[m[2]].appendChild(op);
    });
  }
});
els["ornek-ozel"] = els["ornek-ozel"] || eleman();
var turlar = Array.from(html.matchAll(/data-tur="(\w+)"/g)).map(function (m) {
  var b = eleman(); b.attributes["data-tur"] = m[1]; return b;
});
assert.strictEqual(turlar.length, 2, "iki ücret türü düğmesi");
els["bordro-ornek"].querySelectorAll = function (sec) { assert.strictEqual(sec, "[data-tur]"); return turlar; };
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
var B = ctx.Bordro;
var nf = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
function hesapla() { els["bordro-ornek"].events.submit({ preventDefault: function () {} }); }
function tur(ad) { turlar.filter(function (b) { return b.attributes["data-tur"] === ad; })[0].events.click(); }
function satirlar() { return els["ornek-kalemler"].children.length; }

// ---- varsayılan ------------------------------------------------------------
assert.strictEqual(els["bordro-ornek"].hidden, false);
assert.strictEqual(els["ornek-net"].textContent, nf.format(58080.27));
assert.strictEqual(satirlar(), 17, "3 grup başlığı + 14 kalem");
assert.strictEqual(els["ornek-aylar"].children.length, 12, "on iki ay");

// Tüm yıllarda ve aylarda net sözleşme hedefi korunmalı; tek ay ters çözümü bu testi geçemez.
tur("net");
els["ornek-tutar"].value = "60000";
B.yillar().forEach(function (y) {
  els["ornek-yil"].value = String(y);
  for (var i = 0; i < 12; i++) {
    els["ornek-ay"].value = String(i); hesapla();
    assert.strictEqual(els["ornek-net"].textContent, nf.format(60000), y + "/" + i);
  }
});
tur("brut");
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

// ---- özel durumlar: sayfadaki tutar = motorun doğrudan hesabı ----------------
els["ornek-yil"].value = "2026";
els["ornek-giris"].value = "9"; els["ornek-giris-gun"].value = "15";
els["ornek-engelli"].value = "2"; els["ornek-bes"].checked = true; els["ornek-tesvik"].value = "genel";
els["ornek-ay"].value = "8"; hesapla();
var gun = [0, 0, 0, 0, 0, 0, 0, 0, 15, 30, 30, 30];
var r = B.hesaplaYil(gun.map(function (g) { return 75000 * g / 30; }), 2026, { gun: gun, engellilik: 2, bes: 0.03, tesvik: "genel" });
assert.strictEqual(els["ornek-net"].textContent, nf.format(r.aylar[8].net), "kıst Eylül neti");
assert.strictEqual(els["ornek-yillik"].textContent, nf.format(r.toplam.net), "yıllık net");
assert.strictEqual(els["ornek-maliyet"].textContent, nf.format(r.aylar[8].isverenMaliyeti), "teşvikli maliyet");
assert.strictEqual(satirlar(), 20, "engellilik + BES + ele geçen satırları");
assert.strictEqual(els["ornek-aylar"].children.filter(function (b) { return b.disabled; }).length, 8, "girişten önceki 8 ay boş");
// çalışılmayan ay seçilirse en yakın çalışılan aya geçer
els["ornek-ay"].value = "2"; hesapla();
assert.strictEqual(els["ornek-ay"].value, "8");
// net sözleşmede kıst ayın hedefi gün oranıyla
tur("net"); els["ornek-tutar"].value = "60000"; hesapla();
assert.strictEqual(els["ornek-net"].textContent, nf.format(30000), "kıst ay net hedefi");
tur("brut"); els["ornek-tutar"].value = "75000";
// hatalı girdiler
els["ornek-giris-gun"].value = "31"; hesapla();
assert.strictEqual(els["ornek-sonuc"].hidden, true, "31 gün");
els["ornek-giris-gun"].value = "15"; els["ornek-cikis"].value = "5"; hesapla();
assert.strictEqual(els["ornek-sonuc"].hidden, true, "çıkış girişten önce");
els["ornek-cikis"].value = "13"; hesapla();
assert.strictEqual(els["ornek-sonuc"].hidden, false);
// yıl kısıtları: 2021 AGİ yılında kıst ay kapalı, 2020'de engellilik yok
els["ornek-yil"].value = "2021"; hesapla();
assert.strictEqual(els["ornek-giris"].disabled, true);
assert.strictEqual(els["ornek-giris"].value, "0", "AGİ yılında giriş sıfırlanır");
assert.strictEqual(els["ornek-sonuc"].hidden, false);
els["ornek-yil"].value = "2020"; hesapla();
assert.strictEqual(els["ornek-engelli"].disabled, true);
assert.strictEqual(els["ornek-engelli"].value, "0");
assert.strictEqual(els["ornek-sonuc"].hidden, false);
console.log("Bordro sayfası: envanter, 84 net sözleşme senaryosu, kıst ay, engellilik, BES ve geçersiz girdi kontrolleri geçti.");
