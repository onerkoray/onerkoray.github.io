/*!
 * Kira getirisi — yatırımlık konutun getirisi ve mevduatla kıyası.
 *
 * Yasal hesap burada YAZILMIYOR:
 *   - kira geliri vergisi bordro/gmsi-motor.js'ten (GVK m.21 istisna,
 *     m.74 gider, m.103 tarife; götürü ve gerçek gider yöntemlerinden
 *     düşük olan alınır)
 *   - mevduat neti finans/kurallar.js → mevduat (365 gün, stopaj dahil)
 *
 * İLK YIL:
 *   brüt kira getirisi = 12 aylık kira ÷ konut fiyatı
 *   net kira getirisi  = (tahsil edilen kira − gider − vergi) ÷ toplam maliyet
 *   amortisman süresi  = toplam maliyet ÷ ilk yılın net kirası
 *   toplam maliyet     = fiyat × (1 + alım masrafı oranı)
 *
 * N YILLIK KIYAS (varsayımlar kullanıcıdan):
 *   Kira, gider ve vergi her yıl kira artışı oranında büyür (vergi için
 *   varsayım: istisna ve dilimler de aynı oranda artar). Her yılın net kirası
 *   yıl sonunda mevduata konur. Konut N yılın sonunda (1 + değer artışı)^N
 *   ile değerlenir. Alternatif: toplam maliyet N yıl mevduatta.
 *   Başabaş değer artışı: iki servetin eşitlendiği yıllık değer artışı.
 * Satış masrafı ve satış kazancı vergisi hesaba girmez; sayfa bunu söyler.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/kira-getirisi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../bordro/gmsi-motor.js"), require("./kurallar.js"));
  } else {
    kok.KiraGetirisi = fabrika(kok.GmsiMotor, kok.Finans);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (G, F) {
  "use strict";

  var YIL = 2026;

  function dogrula(g) {
    var o = {
      fiyat: Number(g.fiyat), alimMasraf: Number(g.alimMasraf || 0), aylikKira: Number(g.aylikKira),
      bosAy: Number(g.bosAy || 0), yillikGider: Number(g.yillikGider || 0), digerGelir: Number(g.digerGelir || 0),
      kiraArtis: Number(g.kiraArtis || 0), degerArtis: Number(g.degerArtis || 0),
      mevduatFaiz: Number(g.mevduatFaiz), sure: Math.round(Number(g.sure || 10))
    };
    if (!(o.fiyat > 0)) throw new Error("Konut fiyatı pozitif olmalı.");
    if (!(o.aylikKira > 0)) throw new Error("Aylık kira pozitif olmalı.");
    if (!(o.alimMasraf >= 0 && o.alimMasraf < 0.5)) throw new Error("Alım masrafı %0 ile %50 arasında olmalı.");
    if (!(o.bosAy >= 0 && o.bosAy < 12)) throw new Error("Boş kalan ay 0 ile 11 arasında olmalı.");
    if (!(o.yillikGider >= 0) || !(o.digerGelir >= 0)) throw new Error("Gider ve diğer gelir negatif olamaz.");
    if (!(o.kiraArtis > -0.5 && o.kiraArtis <= 3) || !(o.degerArtis > -0.5 && o.degerArtis <= 3)) throw new Error("Artış oranları −%50 ile %300 arasında olmalı.");
    if (!(o.mevduatFaiz >= 0 && o.mevduatFaiz <= 300)) throw new Error("Mevduat faizi %0 ile %300 arasında olmalı.");
    if (!(o.sure >= 1 && o.sure <= 40)) throw new Error("Süre 1 ile 40 yıl arasında olmalı.");
    return o;
  }

  /* İlk yılın kira vergisi: götürü ve gerçek giderden düşük olanı. */
  function vergi(yillikKira, gider, brutDiger) {
    var r = G.hesapla({ yil: YIL, konutKira: yillikKira, gercekGider: gider, brutGelirToplami: brutDiger });
    if (r.hata) throw new Error(r.hata);
    var gv = Math.min(r.goturu.kiraVergisi, r.gercek.kiraVergisi);
    return { tutar: gv, yontem: r.gercek.kiraVergisi < r.goturu.kiraVergisi ? "gerçek gider" : "götürü gider",
             istisna: r.istisna, istisnaHakki: r.istisnaHakki };
  }

  function mevduatNet(faizYuzde) {
    if (faizYuzde === 0) return 0;
    var m = F.mevduat(1e6, faizYuzde, 365, YIL + "-01-01", "tl");
    return m.net / 1e6;
  }

  /* N yıl sonunda iki servet. */
  function servet(g, ilk, mNet, degerArtis) {
    var biriken = 0;
    for (var y = 1; y <= g.sure; y++) {
      var buyume = Math.pow(1 + g.kiraArtis, y - 1);
      biriken = biriken * (1 + mNet) + ilk.netKira * buyume;
    }
    return { konut: g.fiyat * Math.pow(1 + degerArtis, g.sure), kiralar: biriken };
  }

  function hesapla(girdi) {
    var g = dogrula(girdi);
    var maliyet = g.fiyat * (1 + g.alimMasraf);
    var tahsil = g.aylikKira * (12 - g.bosAy);
    var v = vergi(tahsil, g.yillikGider, g.digerGelir);
    var netKira = tahsil - g.yillikGider - v.tutar;
    var ilk = { tahsil: tahsil, gider: g.yillikGider, vergi: v.tutar, netKira: netKira };
    var mNet = mevduatNet(g.mevduatFaiz);

    /* Dinamik amortisman: birikmiş net kira maliyeti ilk kez aştığı yıl. */
    var dinamik = null, top = 0;
    for (var y = 1; y <= 100 && netKira > 0; y++) {
      top += netKira * Math.pow(1 + g.kiraArtis, y - 1);
      if (top >= maliyet) { dinamik = y; break; }
    }

    var s = servet(g, ilk, mNet, g.degerArtis);
    var mevduatServet = maliyet * Math.pow(1 + mNet, g.sure);
    function fark(d) { var t = servet(g, ilk, mNet, d); return t.konut + t.kiralar - mevduatServet; }
    var alt = -0.49, ust = 3, basabas = null;
    if (fark(alt) < 0 && fark(ust) > 0) {
      for (var i = 0; i < 200; i++) { var orta = (alt + ust) / 2; if (fark(orta) < 0) alt = orta; else ust = orta; }
      basabas = (alt + ust) / 2;
    }
    return {
      girdi: g, maliyet: maliyet, ilkYil: ilk, vergiYontemi: v.yontem, istisna: v.istisna, istisnaHakki: v.istisnaHakki,
      brutGetiri: g.aylikKira * 12 / g.fiyat,
      netGetiri: netKira / maliyet,
      amortisman: netKira > 0 ? maliyet / netKira : null,
      dinamikAmortisman: dinamik,
      mevduatNet: mNet,
      konutServet: s.konut + s.kiralar, konutDeger: s.konut, birikenKira: s.kiralar,
      mevduatServet: mevduatServet,
      basabasDegerArtis: basabas
    };
  }

  return { surum: "1.0.0", YIL: YIL, vergi: vergi, mevduatNet: mevduatNet, hesapla: hesapla };
});
