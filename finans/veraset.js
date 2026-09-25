/*!
 * Veraset ve intikal vergisi — miras ve bağış.
 *
 * DAYANAK (tek kaynak bu dosya):
 *   7338 sayılı Veraset ve İntikal Vergisi Kanunu
 *     m.4/1-b  füruğ (evlatlık dahil) ve eşten her birinin miras hissesinde
 *              istisna; füruğ yoksa eşin hissesinde iki katı
 *     m.4/1-d  ivazsız intikallerde istisna
 *     m.10/b   gayrimenkuller EMLAK VERGİSİNE ESAS DEĞERLE değerlenir
 *     m.12     murisin belgeli borçları ve cenaze masrafı düşülür
 *     m.16     tarife; ana, baba, eş ve çocuktan ivazsız intikalde
 *              ivazsız oranların YARISI uygulanır
 *     m.19     vergi 3 yılda, mayıs ve kasımda 6 eşit taksitte ödenir
 *   VİVK Genel Tebliği Seri No: 57 (RG 31.12.2025, 33124 5. Mük.) —
 *     2026 istisna tutarları ve dilimler (yeniden değerleme %25,49).
 *   Kanun metni mevzuat.gov.tr konsolide sürümünden okundu (2026-09-25).
 *
 * MİRAS PAYLARI (4721 sayılı Türk Medeni Kanunu m.495–499, yasal mirasçılık):
 *   çocuk varsa          eş 1/4, çocuklar kalan 3/4 eşit
 *   çocuk yok, ana-baba  eş 1/2, ana-baba kalan 1/2 eşit
 *   ikisi de yok         eş tamamı (büyükanne-büyükbaba zümresi yok sayılır)
 *   eş yoksa             çocuklar ya da ana-baba tamamı
 * Tek ebeveyn sağsa ölmüş ebeveynin payı kanunen onun altsoyuna (murisin
 * kardeşlerine) geçer; araç kardeş olmadığını varsayar ve payı sağ
 * ebeveyne verir. Vasiyetname, saklı pay ve mal rejimi tasfiyesi kapsam
 * dışıdır: eşin mal rejiminden aldığı pay miras değildir ve bu vergiye
 * girmez; araç terekeyi mal rejimi tasfiyesinden SONRAKİ tutar sayar.
 *
 * KAPSAM DIŞI: 7582 s.K. ile m.16'ya eklenen, GVK mükerrer 20/D istisnasından
 * yararlananlara özgü %1 oranı; yarışma ve şans oyunu ikramiyeleri.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/veraset-ve-intikal-vergisi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Veraset = fabrika();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PARAMETRELER = {
    2026: {
      yil: 2026,
      istisna: {
        furugVeEs: 2907136,       // m.4/1-b, her bir çocuk ve eş için
        esFurugYoksa: 5817845,    // m.4/1-b parantez içi
        ivazsiz: 66935            // m.4/1-d
      },
      /* Dilim GENİŞLİKLERİ ve oranlar: [genişlik, veraset, ivazsız].
         Birikimli sınırlar 3M, 10M, 25M, 55M. */
      dilimler: [
        [3000000, 0.01, 0.10],
        [7000000, 0.03, 0.15],
        [15000000, 0.05, 0.20],
        [30000000, 0.07, 0.25],
        [null, 0.10, 0.30]
      ],
      yakinIndirimi: 0.5,         // m.16/2: ana, baba, eş, çocuk — ivazsız
      taksit: 6,                  // m.19: 3 yıl, mayıs ve kasım
      dayanak: "7338 s. VİVK m.4, m.10, m.12, m.16, m.19; VİVK GT Seri No: 57 (RG 31.12.2025/33124-5. Mük.)"
    }
  };
  function sonYil() { return Math.max.apply(null, Object.keys(PARAMETRELER).map(Number)); }
  function parametre(yil) {
    var P = PARAMETRELER[yil || sonYil()];
    if (!P) throw new Error((yil) + " için veraset parametresi yok.");
    return P;
  }

  /** Artan oranlı vergi. tur: "veraset" | "ivazsiz". yakin: ivazsızda yarı oran. */
  function vergi(matrah, tur, yakin, yil) {
    var P = parametre(yil), m = Math.max(0, Number(matrah) || 0), kalan = m, toplam = 0, dilimler = [];
    var k = tur === "ivazsiz" ? 2 : 1;
    var carpan = tur === "ivazsiz" && yakin ? P.yakinIndirimi : 1;
    for (var i = 0; i < P.dilimler.length && kalan > 0; i++) {
      var d = P.dilimler[i], pay = d[0] === null ? kalan : Math.min(kalan, d[0]);
      var oran = d[k] * carpan, v = pay * oran;
      dilimler.push({ tutar: pay, oran: oran, vergi: v });
      toplam += v; kalan -= pay;
    }
    return { matrah: m, vergi: toplam, dilimler: dilimler, ortalama: m > 0 ? toplam / m : 0 };
  }

  /** Yasal miras payları. */
  function paylar(aile) {
    var es = !!aile.es, cocuk = Math.max(0, Math.floor(Number(aile.cocuk) || 0));
    var ebeveyn = Math.max(0, Math.min(2, Math.floor(Number(aile.ebeveyn) || 0)));
    var out = [];
    if (cocuk > 0) {
      var cocukToplam = es ? 3 / 4 : 1;
      if (es) out.push({ kim: "es", ad: "Eş", pay: 1 / 4 });
      for (var i = 1; i <= cocuk; i++) out.push({ kim: "cocuk", ad: cocuk > 1 ? i + ". çocuk" : "Çocuk", pay: cocukToplam / cocuk });
    } else if (ebeveyn > 0) {
      var ebToplam = es ? 1 / 2 : 1;
      if (es) out.push({ kim: "es", ad: "Eş", pay: 1 / 2 });
      for (var j = 1; j <= ebeveyn; j++) out.push({ kim: "ebeveyn", ad: ebeveyn > 1 ? (j === 1 ? "Anne" : "Baba") : "Sağ ebeveyn", pay: ebToplam / ebeveyn });
    } else if (es) {
      out.push({ kim: "es", ad: "Eş", pay: 1 });
    } else {
      throw new Error("En az bir mirasçı seçin: eş, çocuk ya da ana-baba.");
    }
    return out;
  }

  /** Tereke: varlıklar − borçlar − cenaze masrafı (m.12), en az 0. */
  function tereke(v) {
    function n(x) { var y = Number(x); return isFinite(y) && y > 0 ? y : 0; }
    var varlik = n(v.tasinmaz) + n(v.mevduat) + n(v.arac) + n(v.diger);
    var dusulen = n(v.borc) + n(v.cenaze);
    return { varlik: varlik, dusulen: dusulen, net: Math.max(0, varlik - dusulen) };
  }

  function miras(girdi) {
    var P = parametre(girdi.yil);
    var t = typeof girdi.tereke === "number" ? { varlik: girdi.tereke, dusulen: 0, net: Math.max(0, girdi.tereke) } : tereke(girdi.tereke || {});
    var p = paylar(girdi.aile || {});
    var cocukVar = p.some(function (x) { return x.kim === "cocuk"; });
    var mirascilar = p.map(function (x) {
      var hisse = t.net * x.pay;
      var istisna = x.kim === "cocuk" ? P.istisna.furugVeEs
        : x.kim === "es" ? (cocukVar ? P.istisna.furugVeEs : P.istisna.esFurugYoksa)
        : 0;
      var matrah = Math.max(0, hisse - istisna);
      var v = vergi(matrah, "veraset", false, P.yil);
      return {
        kim: x.kim, ad: x.ad, pay: x.pay, hisse: hisse,
        istisna: istisna, kullanilanIstisna: Math.min(istisna, hisse),
        matrah: matrah, vergi: v.vergi, taksit: v.vergi / P.taksit,
        efektif: hisse > 0 ? v.vergi / hisse : 0
      };
    });
    var toplam = mirascilar.reduce(function (s, m) { return s + m.vergi; }, 0);
    return { yil: P.yil, tereke: t, mirascilar: mirascilar, toplamVergi: toplam,
      efektif: t.net > 0 ? toplam / t.net : 0, taksitSayisi: P.taksit };
  }

  /** Aile yapısında verginin çıkmaya başladığı en küçük net tereke. */
  function vergisizSinir(aile, yil) {
    var P = parametre(yil), p = paylar(aile);
    var cocukVar = p.some(function (x) { return x.kim === "cocuk"; });
    return Math.min.apply(null, p.map(function (x) {
      var ist = x.kim === "cocuk" ? P.istisna.furugVeEs
        : x.kim === "es" ? (cocukVar ? P.istisna.furugVeEs : P.istisna.esFurugYoksa) : 0;
      return ist / x.pay;
    }));
  }

  /** Bağış (ivazsız intikal). yakin: bağışlayan ana, baba, eş ya da çocuk. */
  function bagis(girdi) {
    var P = parametre(girdi.yil), deger = Math.max(0, Number(girdi.deger) || 0);
    var matrah = Math.max(0, deger - P.istisna.ivazsiz);
    var v = vergi(matrah, "ivazsiz", !!girdi.yakin, P.yil);
    return { yil: P.yil, deger: deger, istisna: P.istisna.ivazsiz, matrah: matrah,
      vergi: v.vergi, dilimler: v.dilimler, efektif: deger > 0 ? v.vergi / deger : 0,
      taksit: v.vergi / P.taksit, taksitSayisi: P.taksit };
  }

  return {
    surum: "1.0.0",
    PARAMETRELER: PARAMETRELER,
    parametre: parametre,
    sonYil: sonYil,
    vergi: vergi,
    paylar: paylar,
    tereke: tereke,
    miras: miras,
    vergisizSinir: vergisizSinir,
    bagis: bagis
  };
});
