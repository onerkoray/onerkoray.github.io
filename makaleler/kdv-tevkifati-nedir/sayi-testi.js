#!/usr/bin/env node
/*
 * "KDV tevkifatı nedir, faturaya nasıl yazılır?" yazısının sayıları.
 *
 * Tablolar, yazının "hesabı görmek isterseniz" diye yönlendirdiği fatura
 * çekirdeğinden (fatura-olusturma/fatura.js) üretiliyor. Yazı ile araç
 * farklı bir tevkifat tutarı söyleyemez.
 *
 * Yazının tek iddiası da sınanıyor: tevkifat oranı ne olursa olsun
 * alıcının toplam yükü (satıcıya ödenen + vergi dairesine yatırılan)
 * genel toplama eşit kalır.
 *
 * Kullanım: node makaleler/kdv-tevkifati-nedir/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var F = require(path.join(S.KOK, "fatura-olusturma", "fatura.js"));
var t = S.yazi(__dirname);

var MATRAH = 100000, KDV = 20;

function belge(pay) {
  return F.hesapla({
    kalemler: [{ aciklama: "Hizmet", miktar: 1, birimFiyat: MATRAH, kdvOran: KDV, iskonto: 0 }],
    tevkifat: { pay: pay, payda: 10 }
  });
}

var yok = belge(0);
t.gecsin("matrah", S.tl(yok.matrah) + " TL");
t.gecsin("hesaplanan KDV", "Hesaplanan KDV (%" + KDV + ") " + S.tl(yok.kdv) + " TL");
t.gecsin("genel toplam", "Genel toplam " + S.tl(yok.genelToplam) + " TL");
t.gecsin("tevkifatsız satır", "Yok — " + S.tl(yok.tahsilEdilecekKdv) + " TL " + S.tl(yok.odenecek) + " TL");

var bes = belge(5);
t.gecsin("5/10 tevkif edilen", "Tevkif edilen KDV (5/10) " + S.eksi("-" + S.tl(bes.tevkifat)) + " TL");
t.gecsin("5/10 tahsil edilecek", "Tahsil edilecek KDV " + S.tl(bes.tahsilEdilecekKdv) + " TL");
t.gecsin("5/10 ödenecek", "Ödenecek tutar " + S.tl(bes.odenecek) + " TL");
t.gecsin("kısa cevap", "satıcı " + S.tam(bes.odenecek) + " TL tahsil eder, " + S.tam(bes.tevkifat) + " TL'yi alıcı beyan eder");

[2, 4, 5, 7, 9].forEach(function (pay) {
  var b = belge(pay);
  t.gecsin(pay + "/10 satırı", pay + "/10 " + S.tl(b.tevkifat) + " TL " + S.tl(b.tahsilEdilecekKdv) + " TL " +
    S.tl(b.odenecek) + " TL");
  t.yakin(pay + "/10: alıcının toplam yükü değişmiyor", b.odenecek + b.tevkifat, yok.genelToplam);
  t.yakin(pay + "/10: genel toplam değişmiyor", b.genelToplam, yok.genelToplam);
});

/* Yazının saydığı oranlar çekirdeğin bildiği oranlarla aynı. */
var oranlar = F.TEVKIFAT_ORANLARI.filter(function (o) { return o.pay > 0; }).map(function (o) { return o.ad; });
t.gecsin("oran listesi çekirdekle aynı",
  oranlar.slice(0, -1).join(", ") + " ve " + oranlar[oranlar.length - 1]);

t.bitir();
