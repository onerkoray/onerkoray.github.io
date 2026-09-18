/*!
 * Yeniden değerleme oranı: tanım, tarifeye uygulanışı ve yuvarlamanın bedeli.
 *
 * NEDEN AYRI MODÜL
 * ----------------
 * Kural üç yerde lazım: yazının tabloları, testi ve ileride akademik
 * çalışmanın yeniden üretimi.
 *
 * ORAN SERİSİ BURADA TUTULMUYOR
 * -----------------------------
 * Yeniden değerleme oranları zaten dilim kayması yazısının seriler.js
 * dosyasında duruyor ve testle sabitlenmiş durumda. Buraya kopyalanması,
 * birinin güncellenip ötekinin unutulmasıyla biterdi. Modül o dosyadan
 * okuyor.
 *
 * KURAL (GVK mükerrer 123)
 * ------------------------
 * Kanunun 103. maddesindeki tarifenin gelir dilimi tutarları, her yıl bir
 * önceki yıla ilişkin olarak VUK hükümlerine göre belirlenen yeniden
 * değerleme oranında artırılır. Bu şekilde hesaplanan tutarların
 * "yüzde 5'ini aşmayan kesirleri dikkate alınmaz."
 *
 * İKİ SONUÇ
 * ---------
 * Ö1. Kural tarifeyi TAM OLARAK üretiyor. 2022–2026 arasındaki yirmi
 *     dilimin yirmisi de önceki dilim × (1 + oran) hesabının %5'lik
 *     pencere içinde aşağı yuvarlanmış hâli. Test bunu tek tek ölçüyor.
 *
 * Ö2. Yuvarlama TEK YÖNLÜ. "Kesirler dikkate alınmaz" demek, artığın
 *     atılması demek; tutar hiçbir zaman yukarı tamamlanmıyor. Dolayısıyla
 *     ilan edilen tarife her yıl yeniden değerleme oranının altında kalıyor
 *     ve fark yıldan yıla birikiyor.
 *
 * KAPSAM
 * ------
 * Modül tarifenin nasıl belirlendiğini yeniden üretir; oranın kendisinin
 * nasıl hesaplandığını (Yİ-ÜFE ortalamaları) üretmez — o veri sitede yok
 * ve tahmin edilmesi yazının ilkelerine aykırı olurdu.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"),
      require("../dilim-kaymasi-2022-2026/seriler.js"));
  } else {
    kok.YDO = fabrika(kok.BordroMotor, kok.Seriler);
  }
})(typeof self !== "undefined" ? self : this, function (B, S) {
  "use strict";

  /* Kanunun izin verdiği azami aşağı yuvarlama payı. */
  var KESIR_PAYI = 0.05;

  function seri(yil) {
    var d = (S.SERI || {})[yil];
    return d || null;
  }

  /* Oranın tanımlı olduğu yıllar — seriler.js ne diyorsa o. */
  function oranliYillar() {
    return (S.YILLAR || []).slice().sort(function (a, b) { return a - b; });
  }

  /* Tarifesi bu kuralla denetlenebilecek yıllar: hem oranı hem de bir
     önceki yılın tarifesi elde olmalı. */
  function denetlenebilirYillar() {
    return oranliYillar().filter(function (y) {
      if (!seri(y)) return false;
      try { B.parametre(y); B.parametre(y - 1); } catch (e) { return false; }
      return true;
    });
  }

  /* Bir yılın tarifesini kuraldan yeniden üretme denetimi.
     Her dilim için: önceki × (1 + oran) = ham; ilan edilen tutar hamdan
     küçük olmalı ve aradaki fark hamın %5'ini aşmamalı. */
  function tarifeDenetimi(yil) {
    var d = seri(yil);
    if (!d) throw new Error(yil + " için yeniden değerleme oranı yok.");
    var onceki = B.parametre(yil - 1).dilimler;
    var simdi = B.parametre(yil).dilimler;
    var k = 1 + d.ydo / 100;
    var satir = [];
    for (var i = 0; i < Math.min(onceki.length, simdi.length); i++) {
      if (onceki[i][0] === null || simdi[i][0] === null) continue;
      var ham = onceki[i][0] * k;
      var ilan = simdi[i][0];
      var atilan = ham - ilan;
      satir.push({
        sira: i + 1,
        onceki: onceki[i][0],
        ham: ham,
        ilan: ilan,
        atilan: atilan,
        atilanOran: atilan / ham,
        /* Kurala uygunluk: aşağı yuvarlanmış ve pay %5'i aşmıyor.
           Kuruş düzeyinde tolerans, kayan nokta için. */
        uygun: atilan >= -0.005 && atilan / ham <= KESIR_PAYI + 1e-9
      });
    }
    return { yil: yil, ydo: d.ydo, dilimler: satir };
  }

  /* Bütün denetlenebilir yıllar. */
  function tumDenetim() {
    return denetlenebilirYillar().map(tarifeDenetimi);
  }

  /* Hiç yuvarlanmasaydı: bas yılının tarifesine her yıl tam oran uygulanınca
     son yılda dilimler nerede olurdu? */
  function yuvarlamasizTarife(bas, son) {
    var d = B.parametre(bas).dilimler.map(function (x) { return x[0]; });
    for (var y = bas + 1; y <= son; y++) {
      var s = seri(y);
      if (!s) throw new Error(y + " için oran yok.");
      var k = 1 + s.ydo / 100;
      d = d.map(function (v) { return v === null ? null : v * k; });
    }
    return d;
  }

  /* Gerçek tarife ile yuvarlanmamış tarife arasındaki fark. */
  function birikmisFark(bas, son) {
    var t = yuvarlamasizTarife(bas, son);
    var g = B.parametre(son).dilimler;
    var out = [];
    for (var i = 0; i < g.length; i++) {
      if (g[i][0] === null || t[i] === null) continue;
      out.push({
        sira: i + 1, gercek: g[i][0], yuvarlamasiz: t[i],
        fark: t[i] - g[i][0], eksikOran: 1 - g[i][0] / t[i]
      });
    }
    return out;
  }

  /* Yuvarlanmamış tarifeyle aynı brütün yıllık gelir vergisi ne olurdu?
     Motorun tarifesi geçici olarak değiştirilip geri konuyor; parametre
     nesnesi paylaşıldığı için sıra önemli. */
  function fazlaVergi(aylikBrut, bas, son) {
    var P = B.parametre(son);
    var t = yuvarlamasizTarife(bas, son);
    var alt = P.dilimler.map(function (x, i) {
      return [x[0] === null ? null : t[i], x[1]];
    });

    function topla() {
      return B.hesaplaYil(aylikBrut, son).aylar.reduce(function (a, ay) {
        return a + ay.gelirVergisi;
      }, 0);
    }
    var gercek = topla();
    var eski = P.dilimler;
    P.dilimler = alt;
    var olurdu;
    try { olurdu = topla(); } finally { P.dilimler = eski; }
    return { gercek: gercek, yuvarlamasiz: olurdu, fazla: gercek - olurdu };
  }

  return {
    KESIR_PAYI: KESIR_PAYI,
    seri: seri,
    oranliYillar: oranliYillar,
    denetlenebilirYillar: denetlenebilirYillar,
    tarifeDenetimi: tarifeDenetimi,
    tumDenetim: tumDenetim,
    yuvarlamasizTarife: yuvarlamasizTarife,
    birikmisFark: birikmisFark,
    fazlaVergi: fazlaVergi
  };
});
