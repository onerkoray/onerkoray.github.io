#!/usr/bin/env node
/*
 * "İstifa edince kıdem tazminatı alınır mı?" yazısının sayıları.
 *
 * Yazı iki şey söylüyor ve ikisi de işten ayrılma paketinin motorundan
 * (bordro/cikis.js) geliyor:
 *  1. Tutar tablosu: 10 yıllık çalışan, 67.000 TL giydirilmiş brüt,
 *     1 Eylül 2026 çıkış. Her gerekçe için net kıdem ve ihbar.
 *  2. Hak matrisi. Yazı bu tablonun "aracın hesaplarken kullandığı hak
 *     matrisinin tamamı" olduğunu söylüyor. Bu cümle ancak tablo motorun
 *     FESIH_TURLERI listesinden okunursa doğru kalır.
 *
 * Kullanım: node makaleler/istifa-edince-kidem-tazminati/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var CK = require(path.join(S.KOK, "bordro", "cikis.js"));
var t = S.yazi(__dirname);

var GIRDI = { iseGiris: "2016-09-01", cikis: "2026-09-01", ciplakBrut: 60000, giydirmeEkleri: 7000 };
function paket(kod) {
  var g = {}; for (var k in GIRDI) g[k] = GIRDI[k]; g.fesihTuru = kod;
  return CK.hesapla(g);
}

var isveren = paket("isveren");
t.dogru("kıdem tam 10 yıl", isveren.hizmet.yil === 10 && isveren.hizmet.ay === 0 && isveren.hizmet.gun === 0);
t.gecsin("giydirilmiş brüt", "giydirilmiş brüt " + S.tam(isveren.giydirilmisBrut) + " TL");
t.dogru("tavan uygulanmıyor", !isveren.kidem.tavanUygulandi);

/* 1. Tutar tablosu. */
t.gecsin("gerekçesiz istifa", "Gerekçesiz istifa — — " + S.tl(paket("istifa").kidem.net) + " TL");
[["evlilik", "Evlilik nedeniyle fesih"], ["askerlik", "Askerlik nedeniyle fesih"],
 ["yasHaric", "Yaş hariç emeklilik"], ["emeklilik", "Emeklilik (yaşlılık aylığı)"],
 ["isciHakli", "Haklı nedenle işçi feshi (m.24)"]].forEach(function (s) {
  var n = paket(s[0]).kidem.net;
  t.gecsin(s[1], s[1] + " " + S.tl(n) + " TL — " + S.tl(n) + " TL");
});
var toplam = isveren.kidem.net + isveren.ihbar.net;
t.gecsin("işveren feshi", "İşveren feshi (haklı neden dışında) " + S.tl(isveren.kidem.net) + " TL " +
  S.tl(isveren.ihbar.net) + " TL " + S.tl(toplam) + " TL");
t.gecsin("girişteki üst sınır", S.tam(isveren.kidem.net) + " lira arasında");
t.gecsin("ihbar farkı", S.tl(isveren.ihbar.net) + " TL’lik ihbar farkı");

/* 2. Hak matrisi motorun FESIH_TURLERI listesinden. */
var ETIKET = {
  isveren: "İşveren feshetti (haklı neden dışında)",
  isverenHakli: "İşveren haklı nedenle feshetti (m.25/II)",
  isverenSaglikZorlayici: "Sağlık veya zorlayıcı sebep (m.25/I, III)",
  istifa: "İstifa (gerekçesiz)",
  isciHakli: "İşçinin haklı feshi (m.24)",
  emeklilik: "Emeklilik (yaşlılık aylığı)",
  yasHaric: "Yaş hariç emeklilik",
  askerlik: "Askerlik",
  evlilik: "Evlilik (1 yıl içinde)",
  olum: "Ölüm",
  ikale: "İkale (anlaşarak sona erdirme)"
};
function hucre(v) { return v === true ? "Var" : v === false ? "Yok" : "Sözleşmeye bağlı"; }
CK.FESIH_TURLERI.forEach(function (f) {
  var etiket = ETIKET[f.kod];
  t.dogru("matriste etiketi var: " + f.kod, !!etiket, "yeni fesih türü yazıya eklenmemiş");
  if (etiket) t.gecsin("matris satırı " + f.kod, etiket + " " + hucre(f.kidem) + " " + hucre(f.ihbar) + " " + hucre(f.issizlik));
});
var sayi = { true: 0 }, ihbarli = 0;
CK.FESIH_TURLERI.forEach(function (f) { if (f.kidem === true) sayi.true++; if (f.ihbar === true) ihbarli++; });
var yazili = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on", "on bir", "on iki"];
t.gecsin("özet: kaç türde kıdem", yazili[CK.FESIH_TURLERI.length] + " türün " + yazili[sayi.true] + "inde kıdem");
t.dogru("ihbar yalnızca bir türde", ihbarli === 1, ihbarli + " türde");

t.bitir();
