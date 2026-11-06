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

console.log("Takvim dosyası");
var s = M.ics(L);
ok("satır sonu CRLF", s.indexOf("\r\n") > 0 && !/[^\r]\n/.test(s));
ok("olay sayısı", (s.match(/BEGIN:VEVENT/g) || []).length === L.length);
ok("tüm gün olayı", /DTSTART;VALUE=DATE:20270104\r\nDTEND;VALUE=DATE:20270105/.test(s));
ok("aynı liste aynı dosya", M.ics(L) === s);
ok("virgül kaçırılır", /\\,/.test(s));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
