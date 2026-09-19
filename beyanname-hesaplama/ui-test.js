#!/usr/bin/env node
/*
 * Beyanname aracinin ARAYUZ BAGLANTILARI.
 *
 * NEDEN AYRI TEST
 * ---------------
 * bordro/beyanname-test.js motoru sinaiyor ve Node'da kosuyor. Ama arac
 * tarayicida baska bir yoldan yukleniyor: UMD'nin `module` olmayan dali
 * calisiyor ve modul kendini global'e asiyor. O dal Node testlerinde HIC
 * kosulmuyor -- sessizce kirilabilir ve sayfa bos acilir.
 *
 * Ikinci sessiz kirilma: script.js form alanlarini ID ile okuyor. HTML'de
 * bir ID degisirse arac hata vermez, sadece o geliri SIFIR sayar. Sonuc
 * makul gorunur, yalnizca yanlistir.
 *
 * Kullanim: node beyanname-hesaplama/ui-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var KOK = path.dirname(__dirname);
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var SCRIPT = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");

var gecen = 0, hata = 0;
function dogru(ad, k, detay) {
  if (k) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "  — " + detay : "")); }
}
function esit(ad, a, b) { dogru(ad, a === b, a + " != " + b); }

console.log("Beyanname araci — arayuz baglantilari\n");

/* --- 1) Tarayici yolu: UMD global dali -------------------------------- */
var sandbox = { console: { log: function () {}, error: function () {} } };
sandbox.self = sandbox; sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["bordro/parametreler.js", "bordro/motor.js", "bordro/gmsi-motor.js",
 "bordro/beyanname-motoru.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(KOK, f), "utf8"), sandbox,
    { filename: f });
});

dogru("Bordro global'e asildi", typeof sandbox.Bordro === "object");
dogru("GmsiMotor global'e asildi", typeof sandbox.GmsiMotor === "object");
dogru("BeyannameMotoru global'e asildi",
  typeof sandbox.BeyannameMotoru === "object");
/* script.js aktifYil() icin bunu okuyor. */
dogru("Bordro.parametreler erisilebilir",
  sandbox.Bordro && typeof sandbox.Bordro.parametreler === "object");

/* Tarayici yolundaki sonuc, Node yolundakiyle AYNI olmali. */
(function () {
  var girdi = { yil: 2026, isyeriKira: 350000, serbestMeslek: 2000000,
                serbestStopaj: 400000 };
  var tarayici = sandbox.BeyannameMotoru.hesapla(girdi);
  var nodeM = require(path.join(KOK, "bordro", "beyanname-motoru.js"));
  var dugum = nodeM.hesapla(girdi);
  esit("iki yolda odenecek ayni", tarayici.odenecek, dugum.odenecek);
  esit("iki yolda matrah ayni", tarayici.matrah, dugum.matrah);
  dogru("hesap gercekten bir sonuc uretti", tarayici.odenecek > 0,
    String(tarayici.odenecek));
})();

/* --- 2) script.js'in okudugu her ID sayfada var mi? ------------------- */
(function () {
  /* Ucret alanlari num("...") olarak degil bir DIZI icinde geciyor;
     yalnizca num() cagrilarini taramak onlari kacirirdi. Bu yuzden
     script.js'teki butun "in-*" dizgileri toplaniyor. */
  var idler = [];
  var re = /"(in-[a-z0-9-]+)"/g, m;
  while ((m = re.exec(SCRIPT))) { if (idler.indexOf(m[1]) < 0) idler.push(m[1]); }
  dogru("script.js form alani okuyor", idler.length > 0,
    "bulunan: " + idler.length);
  idler.forEach(function (id) {
    dogru(id + " sayfada tanimli", HTML.indexOf('id="' + id + '"') >= 0);
  });
  /* KONTROL: yukaridaki iddia, HIC id okunmasa da gecerdi (bos dongu).
     Beklenen alan sayisi ayrica cakiliyor. */
  esit("okunan alan sayisi", idler.length, 15);
  /* Ucret alanlarinin ucu de okunuyor olmali. */
  ["in-ucret1", "in-ucret2", "in-ucret3"].forEach(function (id) {
    dogru(id + " script.js tarafindan okunuyor", idler.indexOf(id) >= 0);
  });
})();

/* --- 3) script.js'in yazdigi kaplar sayfada var mi? ------------------- */
["results", "msg", "bey-form"].forEach(function (id) {
  dogru(id + " kabi sayfada", HTML.indexOf('id="' + id + '"') >= 0);
});

/* --- 4) Sayfa motorlari DOGRU SIRAYLA yukluyor mu? -------------------- */
(function () {
  var sira = ["bordro/parametreler.js", "bordro/motor.js",
              "bordro/gmsi-motor.js", "bordro/beyanname-motoru.js",
              "script.js"];
  /* stil-damgasi.py betiklere ?v=... onbellek damgasi ekliyor, bu yuzden
     kapanis tirnagini arayamayiz. */
  var yer = sira.map(function (f) { return HTML.indexOf('src="../' + f); });
  yer[yer.length - 1] = HTML.indexOf('src="script.js');
  sira.forEach(function (f, i) {
    dogru(f + " sayfaya baglanmis", yer[i] >= 0);
  });
  var artan = yer.every(function (v, i) { return i === 0 || v > yer[i - 1]; });
  dogru("betikler bagimlilik sirasinda", artan, yer.join(" "));
})();

/* --- 5) Parametre kopyasi sizmamis -------------------------------------- */
(function () {
  /* Esikler tarifeden turuyor; arayuze sayi olarak yazilmamali. */
  ["400000", "400.000", "5300000", "5.300.000"].forEach(function (n) {
    dogru("script.js'te " + n + " yok", SCRIPT.indexOf(n) < 0);
  });
})();

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (beyanname arayuzu)");
process.exit(hata ? 1 : 0);
