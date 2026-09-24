#!/usr/bin/env node
/*
 * "Kredi yıllık maliyet oranı" yazısının sayıları.
 *
 * Bütün örnekler, yazının yönlendirdiği kredi çekirdeğinden
 * (kredi-hesaplama/hesap.js) üretiliyor: ana örnek, konut karşılaştırması,
 * vade tablosu, A/B teklifleri, ilk taksitin dağılımı, erken kapama ve
 * ek ödeme. Yazı ile araç farklı sonuç söyleyemez.
 *
 * 2026-09-24: konut karşılaştırmasında ihtiyaç sütunu %0,5 tahsis ücretini
 * içeriyor, konut sütunu içermiyordu. "Aynı koşullar" ve "farkın tamamı
 * KKDF ve BSMV'den" cümleleri bu yüzden 1.250 TL yanlıştı. İki sütun da
 * artık aynı ücretle; bayat değerler ayrıca denetleniyor.
 *
 * Kullanım: node makaleler/kredi-yillik-maliyet-orani/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var K = require(path.join(S.KOK, "kredi-hesaplama", "hesap.js"));
var t = S.yazi(__dirname);

function y2(n) { return n.toFixed(2).replace(".", ","); }

var IHTIYAC = K.turBilgi("ihtiyac"), KONUT = K.turBilgi("konut");
var ana = { anapara: 250000, aylikFaiz: 2.89, vade: 36, kkdf: IHTIYAC.kkdf, bsmv: IHTIYAC.bsmv, tahsisOran: 0.5 };
var p = K.plan(ana);

/* Ana örnek ve özet tablo. */
t.gecsin("basit yıllık", "%" + y2(p.basitYillik));
t.gecsin("yıllık maliyet oranı", "%" + y2(p.ymoYillik));
t.gecsin("mesafe", y2(p.ymoYillik - p.basitYillik) + " puanlık");
t.gecsin("aylık maliyet oranı", "%" + p.aylikMaliyetOrani.toFixed(3).replace(".", ","));
t.gecsin("toplam geri ödeme", S.tl(p.toplamGeriOdeme) + " TL");
t.gecsin("kaç katı", (p.toplamGeriOdeme / p.anapara).toFixed(2).replace(".", ",") + " katı");
t.gecsin("KKDF + BSMV toplamı", "toplamı " + S.tam(p.toplamVergi) + " TL");
t.gecsin("ele geçen", S.tam(p.eleGecen) + " TL");
t.gecsin("bileşik %2", "%" + y2((Math.pow(1.02, 12) - 1) * 100));
t.gecsin("bileşik aylık maliyet", "yıllık %" + ((Math.pow(1 + p.aylikMaliyetOrani / 100, 12) - 1) * 100).toFixed(1).replace(".", ","));

/* Konut: aynı tutar, faiz, vade VE aynı tahsis ücreti. */
var konut = K.plan({ anapara: 250000, aylikFaiz: 2.89, vade: 36, kkdf: KONUT.kkdf, bsmv: KONUT.bsmv, tahsisOran: 0.5 });
t.gecsin("taksitler", "Aylık taksit " + S.tl(p.taksit) + " TL " + S.tl(konut.taksit) + " TL");
t.gecsin("toplamlar", "Toplam geri ödeme " + S.tl(p.toplamGeriOdeme) + " TL " + S.tl(konut.toplamGeriOdeme) + " TL");
t.gecsin("oranlar", "%" + y2(p.ymoYillik) + " %" + y2(konut.ymoYillik));
var fark = p.toplamGeriOdeme - konut.toplamGeriOdeme;
t.gecsin("konut farkı", S.tl(fark) + " TL");
t.gecsin("farkın vergi kısmı", S.tam(p.toplamVergi) + " TL'si vergilerin kendisi");
t.gecsin("farkın ek faiz kısmı", "kalan " + S.tam(fark - p.toplamVergi) + " TL");
t.gecmesin("bayat konut toplamı", "405.496,09");
t.gecmesin("bayat konut farkı", "55.843,60");

/* Vade tablosu (tahsis ücretsiz: satırlar taksit toplamını gösteriyor). */
var v12, v60;
[12, 24, 36, 48, 60].forEach(function (n) {
  var q = K.plan({ anapara: 250000, aylikFaiz: 2.89, vade: n, kkdf: IHTIYAC.kkdf, bsmv: IHTIYAC.bsmv });
  if (n === 12) v12 = q; if (n === 60) v60 = q;
  t.gecsin(n + " ay satırı", n + " ay " + S.tl(q.taksit) + " TL " + S.tl(q.taksitToplam) + " TL " + S.tl(q.toplamMaliyet) + " TL");
});
t.gecsin("taksit azalışı", "taksit %" + Math.round((1 - v60.taksit / v12.taksit) * 100) + " azalıyor");

/* A/B: düşük faiz + peşin masraf ile yüksek faiz masrafsız. */
var A = K.plan({ anapara: 200000, aylikFaiz: 2.60, vade: 36, kkdf: 15, bsmv: 15, tahsisOran: 0.5, sigortaPesin: 9000 });
var Bp = K.plan({ anapara: 200000, aylikFaiz: 2.85, vade: 36, kkdf: 15, bsmv: 15 });
t.gecsin("A/B taksit", "Aylık taksit " + S.tl(A.taksit) + " TL " + S.tl(Bp.taksit) + " TL");
t.gecsin("A peşin masraf", "Peşin masraf " + S.tl(A.pesinMasraf) + " TL");
t.gecsin("A/B toplam", S.tl(A.toplamGeriOdeme) + " TL " + S.tl(Bp.toplamGeriOdeme) + " TL");
t.gecsin("A/B oran", "%" + y2(A.ymoYillik) + " %" + y2(Bp.ymoYillik));
t.gecsin("A/B toplam farkı", "(" + S.tam(Bp.toplamGeriOdeme - A.toplamGeriOdeme) + " TL fark)");
t.gecsin("A'da ele geçen", "A'da elinize " + S.tam(A.eleGecen) + " TL");
t.dogru("A toplamda ucuz, B oranda ucuz", A.toplamGeriOdeme < Bp.toplamGeriOdeme && Bp.ymoYillik < A.ymoYillik);

/* İlk taksitin dağılımı. */
var ilk = p.satirlar[0];
/* Faiz + vergi payı tam 9.392,50 TL. Yazı iki parçanın yuvarlanmış
   toplamını taksite eşit tutuyor: 12.780 = 9.392 + 3.388. */
var faizPayi = Math.round(ilk.taksit) - Math.round(ilk.anapara);
t.yakin("faiz payı yuvarlamanın yarım lirası içinde", faizPayi, ilk.faiz + ilk.kkdf + ilk.bsmv, 0.5);
t.gecsin("ilk taksit dağılımı", S.tam(ilk.taksit) + " TL'nin " + S.tam(faizPayi) + " TL'si faiz");
t.gecsin("ilk taksitte anapara", "yalnızca " + S.tam(ilk.anapara) + " TL'si anapara");

/* Erken kapama ve ek ödeme. */
t.gecsin("18. ayda kapatma", "yaklaşık " + S.tam(K.erkenKapama(p, 18, 0).kacinilanMaliyet) + " TL");
var ek = K.ekOdeme(ana, 2000);
t.gecsin("ek ödeme kısalma", ek.kisalanAy + " ay erken");
t.gecsin("ek ödeme tasarruf", "yaklaşık " + S.tam(ek.tasarruf) + " TL");

t.bitir();
