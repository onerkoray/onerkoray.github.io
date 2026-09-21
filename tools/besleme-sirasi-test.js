#!/usr/bin/env node
/*!
 * Atom beslemesi doğru sırada ve damgaları gerçek mi?
 *
 * NEDEN VAR
 * ---------
 * Besleme her yeni girdiye `T00:00:00` basıyordu. Aynı gün yayımlanan
 * girdiler böylece eşitleniyor ve aralarındaki sıra keyfî kalıyordu:
 * 21 Eylül 2026'da dört girdi vardı ve besleme okuyucusu günün yeni
 * yazısını en üstte değil, üçüncü sırada gösteriyordu. Kimse hata
 * görmüyordu; besleme yalnızca yanlış sırada duruyordu.
 *
 * Damga artık saat taşıyor: yeni girdiler eklendikleri anın damgasını
 * alıyor, eski girdilerin saatleri bir kereye mahsus git geçmişinden
 * dolduruldu (sayfayı EKLEYEN commit'in yazar saati).
 *
 * NE YAKALIYOR
 * ------------
 *   1. Sıra bozulursa — okuyucunun gördüğü tek şey bu.
 *   2. Besleme başlığındaki damga en yeni girdiyle uyuşmazsa.
 *   3. Bir damga saat taşımazsa (gece yarısı damgası yeniden sızarsa).
 *   4. Damga biçimi bozulursa.
 *
 * Kullanım: node tools/besleme-sirasi-test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var s = fs.readFileSync(path.join(KOK, "atom.xml"), "utf8");

/* Damgası gece yarısı KALAN girdiler. Bunların beslemedeki tarihi ile
   sayfanın git'e eklendiği tarih tutmuyor; başka bir günün saatini o
   güne yazmak düzeltmek değil uydurmak olurdu. Gizlenmiyorlar,
   sayılıyorlar -- biri düzelirse aşağıdaki kontrol kırmızıya döner. */
var GECE_YARISI_MUAF = [
  "https://korayoner.dev/bordro/",
  "https://korayoner.dev/fazla-mesai-hesaplama/",
  "https://korayoner.dev/isveren-maliyeti-hesaplama/"
];

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}

console.log("Atom beslemesi sırası ve damgaları\n");

var girdiler = s.match(/<entry>[\s\S]*?<\/entry>/g) || [];
var kayit = girdiler.map(function (g) {
  return {
    id: (g.match(/<id>([^<]+)<\/id>/) || [, ""])[1],
    damga: (g.match(/<updated>([^<]+)<\/updated>/) || [, ""])[1]
  };
});

console.log("  girdi: " + kayit.length + "\n");

/* --- 1. sıra ------------------------------------------------------- */
var bozuk = [];
for (var i = 1; i < kayit.length; i++) {
  if (kayit[i].damga > kayit[i - 1].damga) {
    bozuk.push(kayit[i - 1].damga + " < " + kayit[i].damga + " (" + kayit[i].id + ")");
  }
}
dogru("girdiler en yeniden eskiye sıralı", bozuk.length === 0,
  bozuk.slice(0, 5).join("\n      "));

/* --- 2. besleme başlığı -------------------------------------------- */
var bas = s.match(/<\/subtitle>[\s\S]*?<updated>([^<]+)<\/updated>/);
dogru("besleme başlığındaki damga en yeni girdiyle aynı",
  !!bas && kayit.length > 0 && bas[1] === kayit[0].damga,
  (bas ? bas[1] : "başlık damgası yok") + " != " + (kayit[0] || {}).damga);

/* --- 3. biçim ------------------------------------------------------- */
var BICIM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/;
var bicimsiz = kayit.filter(function (k) { return !BICIM.test(k.damga); });
dogru("her damga tam ISO biçiminde ve +03:00", bicimsiz.length === 0,
  bicimsiz.slice(0, 5).map(function (k) { return k.id + " -> " + k.damga; }).join("\n      "));

/* --- 4. gece yarısı damgaları --------------------------------------- */
var geceYarisi = kayit.filter(function (k) {
  return /T00:00:00\+03:00$/.test(k.damga);
});
var beklenmeyen = geceYarisi.filter(function (k) {
  return GECE_YARISI_MUAF.indexOf(k.id) < 0;
});
dogru("muaf olmayan hiçbir girdi gece yarısı damgası taşımıyor",
  beklenmeyen.length === 0,
  beklenmeyen.slice(0, 5).map(function (k) { return k.id; }).join("\n      "));

/* --- 5. ureteç yeni girdiye saat basiyor mu? ---------------------- */
/* Yukaridaki iddialar atom.xml'e bakiyor ve ureteci geri almak onlari
   HEMEN kirmizi yapmiyor: gece yarisi damgasi yalnizca YENI girdiye
   uygulanir, mevcut girdilerin damgasi korunur. Yani hata bir sonraki
   sayfa eklenene kadar gorunmez kalirdi -- mutasyonda tam olarak bu
   oldu. Bu iddia karari dogrudan bagliyor.

   Kaynak metnine bakan bir kontrol; davranisi degil karari sabitliyor,
   ve boyle oldugu icin adi da bunu soyluyor. */
var uretec = fs.readFileSync(path.join(KOK, "tools", "besleme.py"), "utf8");
/* Yorumda T00:00:00 GECEBILIR -- bu duzeltmenin kendisi aciklanirken
   geciyor zaten. Iddia, geri alinacak ATAMAYI hedefliyor. */
dogru("üreteç yeni girdiye sabit gece yarısı damgası basmıyor",
  !/tarih\s*=\s*bugun\(\)\s*\+\s*"T00:00:00/.test(uretec),
  "besleme.py yeni girdiye yine sabit damga basıyor");
dogru("üreteç yeni girdi için simdi() çağırıyor",
  /tarih = simdi\(\)/.test(uretec));

/* --- KONTROLLER ----------------------------------------------------- */
dogru("KONTROL: seksenden fazla girdi okundu", kayit.length > 80,
  String(kayit.length));
dogru("KONTROL: girdilerin çoğu saat taşıyor",
  (kayit.length - geceYarisi.length) / kayit.length > 0.9,
  (kayit.length - geceYarisi.length) + "/" + kayit.length);
/* Muaf listesi bayatlamasın: bir girdi düzeldiyse listeden çıkarılmalı,
   yoksa liste gerçek bulguları da gizlemeye başlar. */
var gereksizMuaf = GECE_YARISI_MUAF.filter(function (u) {
  return !geceYarisi.some(function (k) { return k.id === u; });
});
dogru("KONTROL: muaf listesinde artık gece yarısı olmayan girdi yok",
  gereksizMuaf.length === 0, gereksizMuaf.join(", "));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (besleme sırası)");
process.exit(hata ? 1 : 0);
