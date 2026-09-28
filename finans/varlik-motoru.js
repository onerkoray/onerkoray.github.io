/*!
 * Varlık karşılaştırma motoru — "altın mı, dolar mı, mevduat mı?"
 *
 * Aynı TL tutar, aynı ayın sonunda beş yere konur ve seçilen ayın sonunda
 * değerlenir: gram altın, dolar, euro, 1 ay vadeli TL mevduat ve (karşılaştırma
 * için) hiçbir yere konmayan nakit TL. TÜFE, alım gücünü korumak için gereken
 * tutarı verir; reel sonuç = nominal ÷ TÜFE çarpanı.
 *
 * VERİ (hepsi sitenin gece güncellenen serileri)
 * ----
 * - Kur: TCMB döviz satış kuru, ayın son iş günü (finans/grafik-verisi.js).
 * - Altın: Dünya Bankası Pink Sheet aylık ORTALAMA ons fiyatı ($) × ay sonu
 *   dolar kuru ÷ 31,1034768. Grafikler sayfasıyla aynı tanım. Kuyumcu
 *   makası, işçilik ve banka alış-satış farkı YOK: bunlar hesaplanan gram
 *   fiyatını bir yönde kaydırır, sıralamayı genellikle değiştirmez.
 * - Mevduat: TCMB 1 aya kadar vadeli TL mevduat akım faizi, aylık ortalama
 *   (finans/mevduat-faizi.js). Para her ayın başında yenilenir, o ayın
 *   faizini gün/365 oranında alır, faizden o gün geçerli stopaj düşülür,
 *   kalan anaparaya eklenir.
 * - TÜFE: finans/tufe-endeksi.js.
 *
 * STOPAJ (TL mevduat, 6 aya kadar vade; hesabın açıldığı ya da vadesinin
 * yenilendiği tarihe göre). Kaynak: GİB, "GVK Geçici 67. Madde Uygulaması
 * ile İlgili Gerçek Kişilere Yönelik Rehber" 2006, 2020 ve 2026 sürümleri.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var G = root.GrafikVerisi, T = root.TufeEndeksi, M = root.MevduatFaizi;
  if (!G && typeof require === "function") {
    G = require("./grafik-verisi.js");
    T = require("./tufe-endeksi.js");
    M = require("./mevduat-faizi.js");
  }
  var v = factory(G, T, M);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.VarlikMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (G, T, M) {
  "use strict";

  var GRAM_ONS = 31.1034768;

  /* Bir tarihten itibaren açılan ya da yenilenen hesaplara uygulanan oran.
     Sıralı; bir satır, bir sonrakinin başına kadar geçerli. */
  var STOPAJ = [
    { bas: "2006-01-01", oran: 15, dayanak: "GVK geçici 67/4" },
    { bas: "2018-08-31", oran: 5, dayanak: "53 sayılı Cumhurbaşkanı Kararı (3 ay)" },
    { bas: "2018-12-01", oran: 15, dayanak: "2012/4116 sayılı BKK" },
    { bas: "2020-09-30", oran: 5, dayanak: "3032 ve 8002 sayılı Cumhurbaşkanı Kararları" },
    { bas: "2024-05-01", oran: 7.5, dayanak: "8434 sayılı Cumhurbaşkanı Kararı" },
    { bas: "2024-11-01", oran: 10, dayanak: "9075 sayılı Cumhurbaşkanı Kararı" },
    { bas: "2025-02-01", oran: 15, dayanak: "9487 sayılı Cumhurbaşkanı Kararı (genel orana dönüş)" },
    { bas: "2025-07-09", oran: 17.5, dayanak: "10041 sayılı Cumhurbaşkanı Kararı" }
  ];

  function stopaj(tarih) {
    if (tarih < STOPAJ[0].bas) throw new Error("Stopaj tablosu " + STOPAJ[0].bas + " öncesini kapsamıyor.");
    var s = STOPAJ[0];
    for (var i = 1; i < STOPAJ.length; i++) if (STOPAJ[i].bas <= tarih) s = STOPAJ[i];
    return s;
  }

  function iki(n) { return (n < 10 ? "0" : "") + n; }
  function ayEkle(ay, k) {
    var p = ay.split("-"), t = +p[0] * 12 + (+p[1] - 1) + k;
    return Math.floor(t / 12) + "-" + iki(t % 12 + 1);
  }
  function ayFarki(a, b) {
    var p = a.split("-"), q = b.split("-");
    return (+q[0] - +p[0]) * 12 + (+q[1] - +p[1]);
  }
  function gunSayisi(ay) { var p = ay.split("-"); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }

  /* Ortak ay aralığı. İlk başlangıç ayı 2005-12: parası Aralık 2005 sonunda
     yatırılan ilk mevduat 1 Ocak 2006'da açılır, stopaj tablosunun başı. */
  var ILK = "2005-12";
  var altinIlk = G.altin.ilk;
  var kurAylar = Object.keys(G.kur).sort();
  var SON = [kurAylar[kurAylar.length - 1], G.altin.sonAy, T.sonAy, M.sonAy].sort()[0];

  var AYLAR = [];
  for (var a = ILK; a <= SON; a = ayEkle(a, 1)) AYLAR.push(a);

  function fiyat(ay) {
    var k = G.kur[ay], i = ayFarki(altinIlk, ay), ons = G.altin.usdOns[i];
    if (!k || ons == null) throw new Error("Veri yok: " + ay);
    return { usd: k.USD, eur: k.EUR, gram: ons * k.USD / GRAM_ONS, ons: ons };
  }

  /* Bir aylık mevduat çarpanı: o ayın başında yenilenen hesap. */
  function mevduatAyi(ay, brut) {
    var r = M.oranlar[ay];
    if (r == null) throw new Error("Mevduat faizi yok: " + ay);
    var faiz = r / 100 * gunSayisi(ay) / 365;
    var s = brut ? 0 : stopaj(ay + "-01").oran;
    return 1 + faiz * (1 - s / 100);
  }

  function denetle(bas, son) {
    if (AYLAR.indexOf(bas) < 0 || AYLAR.indexOf(son) < 0) {
      throw new Error("Tarihler " + ILK + " ile " + SON + " arasında olmalı.");
    }
    if (son <= bas) throw new Error("Bitiş ayı başlangıçtan sonra olmalı.");
  }

  var VARLIKLAR = ["altin", "dolar", "euro", "mevduat"];
  var ADLAR = { altin: "Gram altın", dolar: "Dolar", euro: "Euro", mevduat: "TL mevduat", nakit: "Nakit TL", tufe: "TÜFE" };

  /* Ay ay değer yolu. Dönen dizinin ilk elemanı başlangıç ayı (hepsi tutar). */
  function yol(o) {
    denetle(o.bas, o.son);
    var t = +o.tutar;
    if (!(t > 0) || !isFinite(t)) throw new Error("Geçerli bir tutar girin.");
    var f0 = fiyat(o.bas), mev = t, brut = t, satir = [];
    for (var ay = o.bas; ay <= o.son; ay = ayEkle(ay, 1)) {
      if (ay > o.bas) { mev *= mevduatAyi(ay, false); brut *= mevduatAyi(ay, true); }
      var f = fiyat(ay), c = T.carpan(o.bas, ay);
      satir.push({
        ay: ay,
        altin: t * f.gram / f0.gram,
        dolar: t * f.usd / f0.usd,
        euro: t * f.eur / f0.eur,
        mevduat: mev,
        mevduatBrut: brut,
        nakit: t,
        tufe: t * c,
        carpan: c
      });
    }
    return satir;
  }

  function yillik(carpan, ay) { return ay > 0 ? Math.pow(carpan, 12 / ay) - 1 : 0; }

  function ozet(o) {
    var y = yol(o), s = y[y.length - 1], n = ayFarki(o.bas, o.son), t = +o.tutar;
    var sonuc = {};
    VARLIKLAR.concat(["nakit"]).forEach(function (k) {
      var nom = s[k] / t;
      sonuc[k] = {
        deger: s[k], nominal: nom - 1, reel: nom / s.carpan - 1,
        yillikNominal: yillik(nom, n), yillikReel: yillik(nom / s.carpan, n),
        reelDeger: s[k] / s.carpan
      };
    });
    var sira = VARLIKLAR.slice().sort(function (a, b) { return s[b] - s[a]; });
    return {
      bas: o.bas, son: o.son, ay: n, tutar: t, sonuclar: sonuc, sira: sira, kazanan: sira[0],
      tufe: { carpan: s.carpan, gereken: s.tufe, yillik: yillik(s.carpan, n) },
      stopajMaliyeti: s.mevduatBrut - s.mevduat,
      yol: y
    };
  }

  /* Tutma süresi sabitken her başlangıç ayı için kazanan. Tutar sonucu
     değiştirmez (her şey orantılı), bu yüzden 1 TL ile hesaplanır. */
  function harita(sure) {
    var liste = [];
    for (var i = 0; i + sure < AYLAR.length; i++) {
      var bas = AYLAR[i], son = AYLAR[i + sure], f0 = fiyat(bas), f1 = fiyat(son), mev = 1;
      for (var ay = ayEkle(bas, 1); ay <= son; ay = ayEkle(ay, 1)) mev *= mevduatAyi(ay, false);
      var d = { altin: f1.gram / f0.gram, dolar: f1.usd / f0.usd, euro: f1.eur / f0.eur, mevduat: mev };
      var k = VARLIKLAR.slice().sort(function (a, b) { return d[b] - d[a]; })[0];
      var c = T.carpan(bas, son);
      liste.push({ bas: bas, son: son, kazanan: k, carpanlar: d, tufe: c, enflasyonuYendi: d[k] > c });
    }
    return liste;
  }

  /* Haritadaki kazanma sayıları: "N yıl tutulduğunda kaç başlangıçta kim". */
  function kazanmaSayilari(sure) {
    var h = harita(sure), say = { altin: 0, dolar: 0, euro: 0, mevduat: 0 }, yenen = 0;
    h.forEach(function (x) { say[x.kazanan]++; if (x.enflasyonuYendi) yenen++; });
    return { toplam: h.length, say: say, enflasyonuYenen: yenen };
  }

  return {
    ILK: ILK, SON: SON, AYLAR: AYLAR, STOPAJ: STOPAJ, GRAM_ONS: GRAM_ONS,
    VARLIKLAR: VARLIKLAR, ADLAR: ADLAR,
    stopaj: stopaj, fiyat: fiyat, mevduatAyi: mevduatAyi, yol: yol, ozet: ozet,
    harita: harita, kazanmaSayilari: kazanmaSayilari,
    ayEkle: ayEkle, ayFarki: ayFarki, gunSayisi: gunSayisi
  };
});
