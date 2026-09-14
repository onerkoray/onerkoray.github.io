#!/usr/bin/env node
/*!
 * Çıkış takvimi taraması — doğrulama testleri.
 *   node cikis-takvimi/test.js
 *
 * BURADAKİ EN KRİTİK KONTROL ÖLÇÜTÜN KENDİSİ.
 * Bu araç bir KARAR aracı: kullanıcıya "şu tarihte ayrılmak şu kadar fark
 * ettirir" diyor. Ölçüt yanlış kurulursa çıktı yine makul görünür, tablo
 * yine hizalı durur — yalnızca yanlış tarihi işaret eder. O yüzden ilk
 * bölüm, naif ölçütün ürettiği sahte eşiklerin düzeltilmiş ölçütte
 * ÇIKMADIĞINI doğruluyor.
 */
"use strict";

var B = require("../bordro/motor.js");
var C = require("../bordro/cikis.js");
var T = require("./tarama.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function baslik(s) { console.log("\n" + s); }
function tl(n) { return Math.round(n).toLocaleString("tr-TR"); }

function girdi(ek) {
  var g = {
    iseGiris: "2019-03-15", ciplakBrut: 120000, son3YilPrimGunu: 1080,
    bas: "2026-01-15", gun: 330
  };
  for (var k in (ek || {})) g[k] = ek[k];
  return g;
}
function gunEkle(d, n) {
  var t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ 1 */
baslik("Ölçüt: ay başındaki sahte eşik");
/* Naif ölçüt (yalnızca çıkış paketi) her ay başında ~bir aylık maaş kadar
   DÜŞER, çünkü son ay ücretinin yalnızca bir günü pakete girer. Bunu önce
   gerçekten yaşandığını göstererek sabitliyoruz; sonra düzeltilmiş ölçütte
   olmadığını. İkinci iddia tek başına anlamsız olurdu — neyin düzeltildiği
   ölçülmeden "düzeltildi" denemez. */
(function () {
  var g = girdi();
  function paketSadece(d) {
    return C.hesapla({
      iseGiris: g.iseGiris, cikis: d, ciplakBrut: g.ciplakBrut,
      giydirmeEkleri: 0, fesihTuru: "isveren", ihbarSuresiCalisildi: false,
      kullanilmayanIzinGunu: 0, son4AyBrutOrtalama: g.ciplakBrut,
      son3YilPrimGunu: g.son3YilPrimGunu
    }).toplam.genelToplam;
  }
  var son = paketSadece("2026-10-31"), ilk = paketSadece("2026-11-01");
  ok("naif ölçüt ay başında düşüyor (sorun gerçek)", ilk < son - 50000,
     tl(son) + " → " + tl(ilk));

  var a = T.nokta(g, "2026-10-31"), b = T.nokta(g, "2026-11-01");
  ok("düzeltilmiş ölçüt ay başında düşmüyor", b.deger > a.deger,
     tl(a.deger) + " → " + tl(b.deger));
  /* Düzeltilmiş ölçütte artış BİR GÜNLÜK olmalı, bir aylık değil. */
  var gunluk = T.nokta(g, "2026-10-02").deger - T.nokta(g, "2026-10-01").deger;
  ok("ay başı artışı günlük artış mertebesinde",
     (b.deger - a.deger) < gunluk * 5,
     tl(b.deger - a.deger) + " vs günlük " + tl(gunluk));
})();

/* ------------------------------------------------------------------ 2 */
baslik("Çift sayma yok");
/* araMaaslar çıkış AYINI dışarıda bırakmalı: o ayın ücreti pakette "son ay"
   olarak zaten var. Dışarıda bırakılmazsa geç tarihler haksız yere öne
   çıkar ve araç yanlış tarihi önerir. */
(function () {
  var g = girdi();
  var y = B.hesaplaYil(g.ciplakBrut, 2026);
  var beklenen = 0;
  for (var m = 1; m <= 9; m++) beklenen += y.aylar[m - 1].net;   // Ocak–Eylül
  var olculen = T.araMaaslar("2026-01-01", "2026-10-15", g.ciplakBrut);
  ok("çıkış ayı ara maaşlara katılmıyor", Math.abs(olculen - beklenen) < 0.01,
     tl(olculen) + " ≠ " + tl(beklenen));
  ok("aynı ay içinde ara maaş sıfır",
     T.araMaaslar("2026-05-02", "2026-05-28", g.ciplakBrut) === 0);
})();

/* ------------------------------------------------------------------ 3 */
baslik("Eşikler: bilinen üç profil");
/* Tutarlar SABİTLENMİYOR — parametre değişince değişmeleri doğru. Sabitlenen
   şey hangi KURALIN hangi tarihte devreye girdiği; o kural tarihleri kişinin
   kendi tarihlerinden ve kanundan çıkıyor. */
(function () {
  var kisa = T.tara(girdi({ iseGiris: "2025-02-10", son3YilPrimGunu: 560,
                            ciplakBrut: 80000 }));
  var kodlar = kisa.esikler.map(function (e) { return e.kod; });
  ok("bir yılda kıdem hakkı eşiği bulunuyor",
     kodlar.indexOf("kidem-hakki") !== -1, kodlar.join(", "));
  var hak = kisa.esikler.filter(function (e) { return e.kod === "kidem-hakki"; })[0];
  ok("kıdem hakkı işe giriş yıldönümünde", hak && hak.tarih === "2026-02-10",
     hak && hak.tarih);
  ok("ihbar kademesi de yakalanıyor", kodlar.indexOf("ihbar") !== -1,
     kodlar.join(", "));
  ok("tavan dönemi de yakalanıyor", kodlar.indexOf("tavan") !== -1,
     kodlar.join(", "));

  var uzun = T.tara(girdi());
  var ukod = uzun.esikler.map(function (e) { return e.kod; });
  ok("uzun kıdemlide ihbar kademesi YOK (zaten aşılmış)",
     ukod.indexOf("ihbar") === -1, ukod.join(", "));
  ok("uzun kıdemlide kıdem hakkı eşiği YOK", ukod.indexOf("kidem-hakki") === -1);
  ok("tavan eşiği 1 Temmuz'da",
     uzun.esikler.some(function (e) {
       return e.kod === "tavan" && e.tarih === "2026-07-01";
     }), uzun.esikler.map(function (e) { return e.tarih; }).join(", "));
})();

/* ------------------------------------------------------------------ 4 */
baslik("Eşiklerin iç tutarlılığı");
(function () {
  var r = T.tara(girdi());
  var sorun = [];
  r.esikler.forEach(function (e) {
    if (!(e.kazanc > 0)) sorun.push(e.tarih + ": kazanç pozitif değil");
    if (Math.abs((e.yeniDeger - e.oncekiDeger) - e.kazanc) > 0.01)
      sorun.push(e.tarih + ": kazanç iki değerin farkına eşit değil");
    if (e.kalanGun < 0) sorun.push(e.tarih + ": kalan gün negatif");
    if (!e.aciklama || !e.ad) sorun.push(e.tarih + ": açıklama eksik");
  });
  ok("her eşik iç tutarlı", sorun.length === 0, sorun.join(" | "));
  ok("eşikler tarih sırasında", r.esikler.every(function (e, i) {
    return i === 0 || r.esikler[i - 1].tarih < e.tarih;
  }));
})();

/* ------------------------------------------------------------------ 5 */
baslik("Kapsam sınırı");
(function () {
  var sonYil = T.sonYil();
  ok("son doğrulanmış yıl parametrelerden okunuyor",
     !!B.parametreler[sonYil] && !B.parametreler[sonYil + 1], String(sonYil));

  var uzak = T.tara(girdi({ bas: "2026-06-01", gun: 900 }));
  ok("ufuk doğrulanmış yılın sonunu aşmıyor",
     uzak.ufuk === sonYil + "-12-31", uzak.ufuk);
  var uk = uzak.uyarilar.map(function (u) { return u.kod; });
  ok("kapsam uyarısı veriliyor", uk.indexOf("kapsam") !== -1, uk.join(", "));
  ok("yılbaşı tavan değişimi uyarı olarak bildiriliyor",
     uk.indexOf("yilbasi") !== -1, uk.join(", "));
  ok("ufuk dışında eşik üretilmiyor",
     uzak.esikler.every(function (e) { return e.tarih <= uzak.ufuk; }));

  var kisaPencere = T.tara(girdi({ bas: "2026-03-01", gun: 30 }));
  ok("sığan pencerede kapsam uyarısı yok",
     kisaPencere.uyarilar.length === 0, String(kisaPencere.uyarilar.length));
  ok("kısa pencerede ufuk istenen gün", kisaPencere.ufuk === "2026-03-30",
     kisaPencere.ufuk);
})();

/* ------------------------------------------------------------------ 6 */
baslik("Gürültü üretmiyor");
/* Eşik olmayan bir pencerede araç SUSMALI. Her güne bir satır yazan bir
   araç, gerçek eşiği de gürültünün içinde kaybeder. */
(function () {
  var sessiz = T.tara(girdi({ bas: "2026-09-05", gun: 20 }));
  ok("eşiksiz pencerede eşik listesi boş", sessiz.esikler.length === 0,
     sessiz.esikler.map(function (e) { return e.tarih; }).join(", "));
  ok("yine de günlük artış raporlanıyor", sessiz.gunlukArtis > 0,
     tl(sessiz.gunlukArtis));
})();

/* ------------------------------------------------------------------ 7 */
baslik("Girdi dayanıklılığı");
(function () {
  var bir = T.tara(girdi({ gun: 1 }));
  ok("tek günlük tarama patlamıyor", Array.isArray(bir.esikler));
  var sifirPrim = T.tara(girdi({ son3YilPrimGunu: 0 }));
  ok("prim günü sıfırken tarama çalışıyor", Array.isArray(sifirPrim.esikler));
  ok("prim günü sıfırken ödenek eşiği yok",
     sifirPrim.esikler.every(function (e) { return e.kod !== "odenek"; }));
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
