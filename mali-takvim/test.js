#!/usr/bin/env node
/*!
 * Mali takvim — doğrulama. Çalıştırma: node mali-takvim/test.js
 * Son gün kuralı elle seçilmiş hafta sonu örnekleriyle, TÜFE tarihleri
 * kira motorunun takvimiyle sınanır.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var M = require("../finans/mali-takvim.js");
var K = require("../finans/kira-motoru.js");
var T = require("../finans/tufe-serisi.js");
var KT = require("../finans/kira-tufe.js");
var Z = require("../finans/emekli-zammi-motoru.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}

console.log("Son gün");
ok("31 Ocak 2027 Pazar → 1 Şubat", M.sonGun(2027, 1) === "2027-02-01", M.sonGun(2027, 1));
ok("31 Temmuz 2027 Cumartesi → 2 Ağustos", M.sonGun(2027, 7) === "2027-08-02", M.sonGun(2027, 7));
ok("30 Kasım 2026 Pazartesi kalır", M.sonGun(2026, 11) === "2026-11-30");
ok("31 Mart 2027 Çarşamba kalır", M.sonGun(2027, 3) === "2027-03-31");
ok("beyan son günü kanundaki 25 Mart", M.olaylar().some(function (o) { return o.tarih === "2027-03-25" && /m\.92/.test(o.etki); }));

console.log("Liste");
var L = M.olaylar();
ok("sıralı", L.every(function (o, i) { return !i || L[i - 1].tarih <= o.tarih; }));
ok("hepsi pencerede", L.every(function (o) { return o.tarih.slice(0, 7) >= M.ILK && o.tarih.slice(0, 7) <= "2028-01"; }));
ok("hafta sonuna son gün düşmüyor", L.filter(function (o) { return o.tur === "vergi"; }).every(function (o) {
  var g = new Date(o.tarih + "T00:00:00Z").getUTCDay(); return g !== 0 && g !== 6; }));
var tufe = L.filter(function (o) { return o.tur === "veri"; });
ok("14 TÜFE açıklaması", tufe.length === 14, tufe.length);
ok("Aralık 2026 verisi 4 Ocak 2027", tufe.some(function (o) { return o.tarih === "2027-01-04" && /Aralık 2026/.test(o.ad) && /Ocak zammı/.test(o.etki); }));
ok("kira takvimiyle aynı", tufe.every(function (o) {
  var ay = /^(\S+) (\d{4})/.exec(o.ad), a = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].indexOf(ay[1]) + 1;
  return K.aciklamaTarihi(ay[2] + "-" + (a < 10 ? "0" : "") + a) === o.tarih; }));
ok("bağlantıların hedefi var", L.every(function (o) { return o.araclar.every(function (a) { return fs.existsSync(path.join(__dirname, "..", a.yol, "index.html")); }); }) &&
  M.BEKLEYENLER.every(function (b) { return fs.existsSync(path.join(__dirname, "..", b.arac.yol, "index.html")); }));

console.log("Süzgeç ve şerit");
ok("her olayın kimi var", L.every(function (o) { return o.kim && o.kim.length && o.kim.every(function (k) { return M.KIMLER.some(function (x) { return x.kod === k; }); }); }));
ok("her süzgeçte en az bir tarih", M.KIMLER.every(function (k) { return M.filtre(L, k.kod).length > 0; }));
ok("süzgeçsiz hepsi", M.filtre(L, "").length === L.length);
ok("emekliye yalnız zam günleri", M.filtre(L, "emekli").every(function (o) { return /Ocak zammı|Temmuz zammı/.test(o.etki); }));
ok("yaklaşanlar bugünü içerir", M.yaklasan(L, "2027-01-04")[0].tarih === "2027-01-04");
ok("gün farkı", M.gunFarki("2026-11-06", "2026-11-30") === 24 && M.gunFarki("2026-12-31", "2027-01-01") === 1);
var Sr = M.serit(L, "2026-12-10");
ok("şerit 14 ay", Sr.length === 14 && Sr[0].ay === "2026-11" && Sr[13].ay === "2027-12");
ok("şeritte şimdi ve geçmiş", Sr[1].simdi && Sr[0].gecti && !Sr[2].gecti);
ok("şerit bütün pencere olaylarını taşır", Sr.reduce(function (t, a) { return t + a.olaylar.length; }, 0) === L.filter(function (o) { return o.tarih.slice(0, 7) <= "2027-12"; }).length);

console.log("Canlı veri");
var kaynak = { T: T, Z: Z, KT: KT }, tufeO = L.filter(function (o) { return o.veriAy; });
var acik = tufeO.filter(function (o) { return T.aylar[o.veriAy]; })[0], ocak = tufeO.filter(function (o) { return o.veriAy === "2026-12"; })[0];
ok("açıklanan ay sonucu yazar", /Açıklandı: aylık %/.test(M.canli(acik, kaynak)), M.canli(acik, kaynak));
ok("Aralık satırı birikimi yazar", T.aylar["2026-12"] ? true : /birikti/.test(M.canli(ocak, kaynak)), M.canli(ocak, kaynak));
ok("vergi satırında canlı yok", M.canli(L.filter(function (o) { return o.tur === "vergi"; })[0], kaynak) === null);
ok("seri yoksa boş", M.canli(ocak, {}) === null && M.sonVeri({}) === null);
ok("son veri kartı", M.sonVeri(kaynak).ay === T.sonAy && /zammı birikimi/.test(M.sonVeri(kaynak).alt), JSON.stringify(M.sonVeri(kaynak)));

console.log("Takvim dosyası");
var s = M.ics(L);
ok("satır sonu CRLF", s.indexOf("\r\n") > 0 && !/[^\r]\n/.test(s));
ok("olay sayısı", (s.match(/BEGIN:VEVENT/g) || []).length === L.length);
ok("tüm gün olayı", /DTSTART;VALUE=DATE:20270104\r\nDTEND;VALUE=DATE:20270105/.test(s));
ok("aynı liste aynı dosya", M.ics(L) === s);
ok("virgül kaçırılır", /\\,/.test(s));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
