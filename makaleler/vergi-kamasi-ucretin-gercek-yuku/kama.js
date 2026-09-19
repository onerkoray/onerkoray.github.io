/*!
 * Vergi kaması: yazının yöntemini çalıştırılabilir hâle getirir.
 *
 * NEDEN SONRADAN EKLENDİ
 * ----------------------
 * Yazı "buradaki hiçbir sayı elle girilmedi, hepsi bordro motorundan
 * hesaplandı" diyor ve doğru söylüyor — 2026-09-19'da yirmi dört tablo
 * değerinin yirmi dördü de birebir yeniden üretildi. Ama bu iddiayı
 * KORUYAN bir şey yoktu: sayılar bir kez hesaplanıp metne yazılmıştı.
 * Motorda bir düzeltme yapılsa tablo sessizce yanlışa dönerdi.
 *
 * TABLOLAR ÜRETİLMİYOR, ÇİVİLENİYOR
 * ---------------------------------
 * Bu yazının bir DOI'si var; sayfası, atıf verilen sürümden ayrışmamalı.
 * Tablolar üreteçle bağlansaydı 2027 parametreleri girildiğinde sayfa
 * kendiliğinden başka bir çalışmaya dönüşür, ama aynı DOI'yi taşımaya
 * devam ederdi. Bu yüzden tablolar oldukları gibi duruyor ve testi
 * YILA ÇİVİLİ: "bu sayılar 2026 parametrelerinin çıktısıdır" iddiası
 * ölçülüyor, "bu sayılar bugünün çıktısıdır" değil.
 *
 * YÖNTEM (yazının 1. bölümü)
 * --------------------------
 *   kama = (işveren maliyeti − net) ÷ işveren maliyeti
 * Yıllık toplamlarla. Gelir vergisi kümülatif matrah üzerinden alındığı
 * için tek aylık hesap yanıltır.
 *
 * Marjinal kama: aylık brüt 1.000 TL artırılıp yıllık maliyet ve net
 * farklarından sayısal türev.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.Kama = fabrika(kok.BordroMotor);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  /* Yazının marjinal ölçümde kullandığı adım (aylık brüt, TL). */
  var ADIM = 1000;

  function yillik(aylikBrut, yil) {
    var t = B.hesaplaYil(aylikBrut, yil).toplam;
    return {
      brut: t.brut, net: t.net, maliyet: t.isverenMaliyeti,
      istisna: t.istisna
    };
  }

  /* Ortalama kama: mevcut yük. */
  function ortalama(aylikBrut, yil) {
    var y = yillik(aylikBrut, yil);
    return (y.maliyet - y.net) / y.maliyet;
  }

  /* Marjinal kama: ilave bir liralık İŞVEREN maliyetinin ne kadarı
     vergi ve prim olarak alınıyor. */
  function marjinal(aylikBrut, yil, adim) {
    var d = adim || ADIM;
    var a = yillik(aylikBrut, yil), b = yillik(aylikBrut + d, yil);
    var dMaliyet = b.maliyet - a.maliyet;
    if (!(dMaliyet > 0)) throw new Error("Maliyet artmadı: adım çok küçük olabilir.");
    return (dMaliyet - (b.net - a.net)) / dMaliyet;
  }

  /* Çalışan bakışıyla marjinal oran: ilave BRÜT liranın ne kadarı
     çalışandan alınıyor. Tavanın üstünde ikisi çakışır, çünkü orada
     ilave brüt işverene tam olarak kendisi kadara mal olur. */
  function marjinalCalisan(aylikBrut, yil, adim) {
    var d = adim || ADIM;
    var a = yillik(aylikBrut, yil), b = yillik(aylikBrut + d, yil);
    var dBrut = b.brut - a.brut;
    if (!(dBrut > 0)) throw new Error("Brüt artmadı.");
    return (dBrut - (b.net - a.net)) / dBrut;
  }

  /* Asgari ücret istisnasının brüt gelire oranı: yazının 5. bölümündeki
     mekanizma, kamanın tavana kadar neden yükseldiğini bu açıklıyor. */
  function istisnaOrani(aylikBrut, yil) {
    var y = yillik(aylikBrut, yil);
    return y.istisna / y.brut;
  }

  /* Ortalama kamanın tepe yaptığı brüt. Yazının iddiası: tepe prim
     tavanında. Tarama tavanı bilmeden yapılıyor ki iddia ölçülebilsin. */
  function tepeNoktasi(yil, bas, son, adim) {
    var d = adim || 1000, enIyi = { kama: -1 };
    for (var x = bas; x <= son; x += d) {
      var k = ortalama(x, yil);
      if (k > enIyi.kama) enIyi = { brut: x, kama: k };
    }
    return enIyi;
  }

  return {
    ADIM: ADIM,
    yillik: yillik,
    ortalama: ortalama,
    marjinal: marjinal,
    marjinalCalisan: marjinalCalisan,
    istisnaOrani: istisnaOrani,
    tepeNoktasi: tepeNoktasi
  };
});
