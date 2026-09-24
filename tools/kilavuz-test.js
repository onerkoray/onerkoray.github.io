#!/usr/bin/env node
/*
 * AGENTS.md (içerik kılavuzu) canlı mı?
 *
 * NEDEN VAR: Kılavuz, ajanların yazmadan önce okuduğu kural seti. İki yoldan
 * sessizce çürür:
 *   1. Google'ın belgeleri değişir, kılavuz eski hâlini anlatmaya devam eder.
 *      Spam politikaları 2026-08-28'de güncellenmişti; kimse bakmasa kılavuz
 *      bunu hiç öğrenmezdi.
 *   2. Kontrol listesi "[CI: …]" ile bir CI adımına güvenir. Adım yeniden
 *      adlandırılır ya da silinirse madde hiçbir şeyi denetlemeyen bir
 *      söze dönüşür (kör kapı).
 * Üçüncü kontrol kılavuzun bir vaadini sınıyor: makaleler/ altındaki her
 * sayı testi workflow'da koşmalı. Yazılıp çağrılmayan test, hiç olmayan
 * testten tehlikelidir, çünkü "testli" görünür.
 *
 * Kullanım: node tools/kilavuz-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var KILAVUZ = path.join(KOK, "AGENTS.md");
var AKIS = path.join(KOK, ".github", "workflows", "bordro-test.yml");
var GUN_SINIRI = 183;   // yaklaşık altı ay
var UYARI_GUN = 14;

function gunFarki(a, b) { return Math.round((b - a) / 86400000); }

function denetle(metin, akis, bugun, testler) {
  var hatalar = [], uyarilar = [];

  var m = /^Son okuma: (\d{4})-(\d{2})-(\d{2})$/m.exec(metin);
  if (!m) {
    hatalar.push('"Son okuma: YYYY-AA-GG" satırı yok ya da biçimi bozuk.');
  } else {
    var okuma = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var yas = gunFarki(okuma, bugun);
    if (isNaN(okuma) || yas < 0) hatalar.push("Son okuma tarihi geçersiz ya da gelecekte: " + m[0]);
    else if (yas > GUN_SINIRI) hatalar.push("Kaynaklar " + yas + " gündür okunmadı (sınır " + GUN_SINIRI +
      "). Google belgelerini yeniden oku, değişeni işle, tarihi güncelle.");
    else if (yas > GUN_SINIRI - UYARI_GUN) uyarilar.push("Kaynakların yeniden okunmasına " + (GUN_SINIRI - yas) + " gün kaldı.");
  }

  var adimlar = {};
  akis.replace(/^\s*- name: (.+?)\s*$/gm, function (_, ad) { adimlar[ad] = true; return _; });
  var anilan = [];
  metin.replace(/\[CI: ([^\]]+)\]/g, function (_, ad) { anilan.push(ad.trim()); return _; });
  if (!anilan.length) hatalar.push("Kontrol listesi hiçbir CI adımı anmıyor; ayrıştırma bozulmuş olabilir.");
  anilan.forEach(function (ad) {
    if (!adimlar[ad]) hatalar.push('Kılavuz "' + ad + '" adımına güveniyor ama workflow\'da böyle bir adım yok.');
  });

  testler.forEach(function (t) {
    if (akis.indexOf(t) === -1) hatalar.push(t + " yazılmış ama workflow'da çağrılmıyor.");
  });

  return { hatalar: hatalar, uyarilar: uyarilar, anilan: anilan.length };
}

function makaleTestleri() {
  var kok = path.join(KOK, "makaleler");
  var sonuc = [];
  fs.readdirSync(kok).forEach(function (d) {
    var klasor = path.join(kok, d);
    if (!fs.statSync(klasor).isDirectory()) return;
    fs.readdirSync(klasor).forEach(function (f) {
      if (/test.*\.js$/.test(f)) sonuc.push("makaleler/" + d + "/" + f);
    });
  });
  return sonuc;
}

/* Kapının kendisi: kapanması gereken durumlarda gerçekten kapanıyor mu. */
function oztest() {
  var akis = "      - name: Var olan adım\n        run: node makaleler/a/sayi-testi.js\n";
  var gun = Date.UTC(2026, 8, 24);
  var iyi = "Son okuma: 2026-09-24\n[CI: Var olan adım]\n";
  var durumlar = [
    [iyi, [], 0, "sağlam kılavuz"],
    ["Son okuma: 2026-01-01\n[CI: Var olan adım]\n", [], 1, "bayat tarih"],
    ["[CI: Var olan adım]\n", [], 1, "tarih satırı yok"],
    ["Son okuma: 2026-09-24\n[CI: Silinmiş adım]\n", [], 1, "olmayan adım"],
    ["Son okuma: 2026-09-24\n", [], 1, "hiç adım anılmıyor"],
    [iyi, ["makaleler/b/sayi-testi.js"], 1, "koşmayan test"],
    [iyi, ["makaleler/a/sayi-testi.js"], 0, "koşan test"]
  ];
  durumlar.forEach(function (d) {
    var n = denetle(d[0], akis, gun, d[1]).hatalar.length;
    if ((n > 0) !== (d[2] > 0)) throw new Error("öz test: " + d[3] + " beklenen " + d[2] + ", bulunan " + n);
  });
  var u = denetle("Son okuma: 2026-03-30\n[CI: Var olan adım]\n", akis, gun, []);
  if (u.hatalar.length || u.uyarilar.length !== 1) throw new Error("öz test: uyarı penceresi çalışmıyor");
}

oztest();
var s = denetle(fs.readFileSync(KILAVUZ, "utf8"), fs.readFileSync(AKIS, "utf8"),
  Date.now(), makaleTestleri());
s.uyarilar.forEach(function (u) { console.log("UYARI: " + u); });
s.hatalar.forEach(function (h) { console.error("HATA: " + h); });
if (s.hatalar.length) process.exit(1);
console.log("İçerik kılavuzu canlı: " + s.anilan + " CI adımı yerinde, " +
  makaleTestleri().length + " makale testi workflow'da.");
