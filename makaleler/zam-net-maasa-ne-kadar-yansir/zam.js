/*!
 * Zammın nete yansıması: yazının yöntemini çalıştırılabilir hâle getirir.
 *
 * NEDEN SONRADAN EKLENDİ
 * ----------------------
 * Yazının iki tablosundaki kırk değerin hepsi bordro motorundan
 * hesaplanmıştı ve 2026-09-19'da kırkı da birebir yeniden üretildi. Ama
 * sayılar bir kez hesaplanıp metne yazılmıştı: motorda bir düzeltme
 * tabloyu sessizce yanlışa çevirirdi.
 *
 * İKİ YÖN
 * -------
 * İleri yön: verilen brüt zam oranı nete ne kadar yansıyor?
 * Ters yön:  hedeflenen net artış için ne kadar brüt zam gerekir?
 *
 * Ters yön KAPALI FORMLA ÇÖZÜLMÜYOR. Tarife kümülatif, istisna ve prim
 * tavanı devreye girdiği için net, brütün parçalı bir fonksiyonu.
 * İkiye bölme kullanılıyor: net(brüt) azalmayan olduğu için yakınsıyor.
 *
 * İŞARETİN DÖNDÜĞÜ YER TAVAN DEĞİL
 * --------------------------------
 * Yazının asıl bulgusu, net artışın brüt zammı AŞABİLMESİ: tavanın
 * üstünde ilave brüte prim binmediği için. Ama dönüş noktası tavanın
 * KENDİSİ değil — zam tabanı tavanın üstüne taşıdığı anda etki başlıyor,
 * dolayısıyla dönüş noktası zam oranına bağlı ve tavanın altında.
 * %30 zam için 271.800 TL civarında; tavan 297.270 TL.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.Zam = fabrika(kok.BordroMotor);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  function net(aylikBrut, yil) {
    return B.hesaplaYil(aylikBrut, yil).toplam.net;
  }

  /* Brüt zam oranının nete yansıması (yıllık netler üzerinden). */
  function yansima(aylikBrut, yil, zamOrani) {
    var a = net(aylikBrut, yil);
    var b = net(aylikBrut * (1 + zamOrani), yil);
    if (!(a > 0)) throw new Error("Taban net sıfır.");
    return (b - a) / a;
  }

  /* Brüt zam ile net yansıma arasındaki fark (puan). Negatifse net
     artış brüt zammı AŞMIŞ demektir. */
  function fark(aylikBrut, yil, zamOrani) {
    return zamOrani - yansima(aylikBrut, yil, zamOrani);
  }

  /* Ters yön: hedeflenen net artış için gereken brüt.
     İkiye bölme — net(brüt) azalmayan. */
  function gerekenBrut(aylikBrut, yil, hedefNetOrani) {
    var hedef = net(aylikBrut, yil) * (1 + hedefNetOrani);
    var alt = aylikBrut, ust = aylikBrut * 4;
    if (net(ust, yil) < hedef) throw new Error("Hedef erişilebilir aralıkta değil.");
    for (var i = 0; i < 100; i++) {
      var orta = (alt + ust) / 2;
      if (net(orta, yil) < hedef) alt = orta; else ust = orta;
    }
    return (alt + ust) / 2;
  }

  /* Hedef net artış için gereken brüt zam oranı. */
  function gerekenZam(aylikBrut, yil, hedefNetOrani) {
    return gerekenBrut(aylikBrut, yil, hedefNetOrani) / aylikBrut - 1;
  }

  /* Net artışın brüt zammı ilk kez yakaladığı brüt.
     Tavanı BİLMEDEN taranıyor ki "dönüş tavanda mı" iddiası ölçülebilsin. */
  function donusNoktasi(yil, zamOrani, bas, son, adim) {
    var d = adim || 100;
    for (var x = bas; x <= son; x += d) {
      if (yansima(x, yil, zamOrani) >= zamOrani) return x;
    }
    return null;
  }

  return {
    net: net,
    yansima: yansima,
    fark: fark,
    gerekenBrut: gerekenBrut,
    gerekenZam: gerekenZam,
    donusNoktasi: donusNoktasi
  };
});
