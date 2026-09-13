/*!
 * Zaman ve Nakit Akışı Motoru — paranın zaman değeri
 *
 * NEDEN VAR: sitede çok dönemli bir nakit akışını değerlendirebilen ortak bir
 * katman yoktu. Her araç kendi iskonto mantığını yazıyordu ve hiçbiri NPV,
 * IRR veya XIRR hesaplayamıyordu. "Ev almak mı kiralamak mı", "krediyi erken
 * kapatmak mı yatırım yapmak mı" gibi kararların tamamı bu matematiğe dayanır:
 * farklı zamanlarda gerçekleşen para akışları ancak tek bir ana taşınarak
 * karşılaştırılabilir.
 *
 * İKİ AKIŞ BİÇİMİ
 *   Dönemsel : [-1000, 500, 500]  — eşit aralıklı, ilk eleman t=0
 *   Tarihli  : [{tarih:"2026-01-01", tutar:-1000}, ...] — gerçek takvim
 * Tarihli sürüm actual/365 gün sayımı kullanır: gerçek gün farkı 365'e
 * bölünür. Bu, mevduat ve kredi hesaplarında Türkiye'de yerleşik olan
 * konvansiyondur; 30/360 kullanılmıyor.
 *
 * IRR NEDEN İKİ YÖNTEMLİ: Newton-Raphson hızlıdır ama türev sıfıra yaklaşınca
 * veya kötü bir başlangıç tahmininde ıraksar. Finansal akışlarda bu nadir
 * değil. Bu yüzden Newton başarısız olursa işaret değişimi olan bir aralıkta
 * ikiye bölme (bisection) devreye giriyor: yavaş ama ıraksamaz.
 *
 * IRR HER ZAMAN VAR OLMAZ: akışta işaret değişimi yoksa kök yoktur ve motor
 * null döner — uydurma bir sayı üretmez. Birden fazla işaret değişimi varsa
 * birden fazla IRR olabilir; motor bulduğunu döner ve `tekMi` alanıyla bunu
 * bildirir. Çağıran araç bu durumda IRR yerine NPV göstermelidir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.ZamanMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var GUN_MS = 86400000;
  var YIL_GUN = 365;
  var EPS = 1e-9;

  /* ---------------------------------------------------------------- yardım */

  function tarihe(d) {
    if (d instanceof Date) return d;
    var t = Date.parse(d);
    if (isNaN(t)) throw new Error("Geçersiz tarih: " + d);
    return new Date(t);
  }

  /** Gerçek gün farkı (actual). Artık yıl otomatik, takvim hesaplıyor. */
  function gunFarki(a, b) {
    return Math.round((tarihe(b).getTime() - tarihe(a).getTime()) / GUN_MS);
  }

  /* ------------------------------------------------------- oran dönüşümleri */

  /** Aylık nominal oranı yıllık BİLEŞİK karşılığına çevirir. */
  function efektifYillik(aylik) { return Math.pow(1 + aylik, 12) - 1; }

  /** Yıllık bileşik oranın aylık karşılığı. efektifYillik'in tersi. */
  function aylikEsdeger(yillik) { return Math.pow(1 + yillik, 1 / 12) - 1; }

  /** Bileşik yıllık büyüme oranı. */
  function cagr(baslangic, bitis, yil) {
    if (!(baslangic > 0) || !(yil > 0)) return NaN;
    return Math.pow(bitis / baslangic, 1 / yil) - 1;
  }

  /* --------------------------------------------------------- dönemsel NPV/IRR */

  /** Dönemsel net bugünkü değer. akislar[0] t=0'da, iskonto edilmez. */
  function npv(akislar, oran) {
    var t = 0;
    for (var i = 0; i < akislar.length; i++) {
      t += akislar[i] / Math.pow(1 + oran, i);
    }
    return t;
  }

  function npvTurev(akislar, oran) {
    var t = 0;
    for (var i = 1; i < akislar.length; i++) {
      t -= i * akislar[i] / Math.pow(1 + oran, i + 1);
    }
    return t;
  }

  /* --------------------------------------------------------- tarihli NPV/IRR */

  function sirala(akislar) {
    return akislar.slice().sort(function (a, b) {
      return tarihe(a.tarih) - tarihe(b.tarih);
    });
  }

  /** Tarihli net bugünkü değer (actual/365). Referans: ilk akışın tarihi. */
  function xnpv(akislar, oran, referans) {
    var s = sirala(akislar);
    if (!s.length) return 0;
    var ref = referans ? tarihe(referans) : tarihe(s[0].tarih);
    var t = 0;
    for (var i = 0; i < s.length; i++) {
      var yil = gunFarki(ref, s[i].tarih) / YIL_GUN;
      t += s[i].tutar / Math.pow(1 + oran, yil);
    }
    return t;
  }

  function xnpvTurev(akislar, oran, referans) {
    var s = sirala(akislar);
    var ref = referans ? tarihe(referans) : tarihe(s[0].tarih);
    var t = 0;
    for (var i = 0; i < s.length; i++) {
      var yil = gunFarki(ref, s[i].tarih) / YIL_GUN;
      if (yil === 0) continue;
      t -= yil * s[i].tutar / Math.pow(1 + oran, yil + 1);
    }
    return t;
  }

  /* ----------------------------------------------------------- kök bulucu */

  /* Akışta işaret değişimi yoksa NPV monotondur ve hiçbir orana karşı
     sıfırlanmaz — IRR tanımsızdır. Bunu baştan tespit etmek, çözücünün
     anlamsız yere koşup uydurma bir sayı döndürmesini engelliyor. */
  function isaretDegisimi(tutarlar) {
    var n = 0, onceki = 0;
    for (var i = 0; i < tutarlar.length; i++) {
      var v = tutarlar[i];
      if (Math.abs(v) < EPS) continue;
      var im = v > 0 ? 1 : -1;
      if (onceki !== 0 && im !== onceki) n++;
      onceki = im;
    }
    return n;
  }

  /**
   * Ortak kök bulucu. f(oran) = 0 çözer.
   * Önce Newton (hızlı), ıraksarsa bisection (yavaş ama güvenli).
   */
  function kokBul(f, fTurev, tahmin) {
    var r = (typeof tahmin === "number" && isFinite(tahmin)) ? tahmin : 0.1;

    /* --- Newton-Raphson --- */
    for (var i = 0; i < 60; i++) {
      var deger = f(r);
      if (!isFinite(deger)) break;
      if (Math.abs(deger) < 1e-7) return r;
      var t = fTurev(r);
      if (!isFinite(t) || Math.abs(t) < 1e-12) break;
      var yeni = r - deger / t;
      /* -1'in altına düşmek (1+r ≤ 0) matematiksel olarak anlamsız:
         kuvvet alma tanımsızlaşır. Newton bu bölgeye kaçarsa bırak. */
      if (!isFinite(yeni) || yeni <= -0.9999) break;
      if (Math.abs(yeni - r) < 1e-10) return yeni;
      r = yeni;
    }

    /* --- Bisection: işaret değiştiren bir aralık ara --- */
    var alt = -0.9999, ust = 10;
    var fAlt = f(alt), fUst = f(ust);
    if (!isFinite(fAlt) || !isFinite(fUst)) return null;
    if (fAlt * fUst > 0) {
      /* Varsayılan aralıkta kök yok; daha geniş bir üst sınır dene.
         %1000'in üstündeki IRR gerçek hayatta anlamlı değil ama
         test ve uç senaryolar için kapıyı açık tutuyoruz. */
      ust = 100;
      fUst = f(ust);
      if (!isFinite(fUst) || fAlt * fUst > 0) return null;
    }
    for (var j = 0; j < 200; j++) {
      var orta = (alt + ust) / 2;
      var fOrta = f(orta);
      if (!isFinite(fOrta)) return null;
      if (Math.abs(fOrta) < 1e-9 || (ust - alt) < 1e-12) return orta;
      if (fAlt * fOrta < 0) { ust = orta; } else { alt = orta; fAlt = fOrta; }
    }
    return (alt + ust) / 2;
  }

  /** Dönemsel iç verim oranı. Doner: {oran, tekMi} veya null. */
  function irr(akislar, tahmin) {
    if (!akislar || akislar.length < 2) return null;
    var degisim = isaretDegisimi(akislar);
    if (degisim === 0) return null;
    var oran = kokBul(
      function (r) { return npv(akislar, r); },
      function (r) { return npvTurev(akislar, r); },
      tahmin
    );
    if (oran === null) return null;
    return { oran: oran, tekMi: degisim === 1 };
  }

  /** Tarihli iç verim oranı (XIRR). Doner: {oran, tekMi} veya null. */
  function xirr(akislar, tahmin) {
    if (!akislar || akislar.length < 2) return null;
    var s = sirala(akislar);
    var degisim = isaretDegisimi(s.map(function (a) { return a.tutar; }));
    if (degisim === 0) return null;
    var ref = tarihe(s[0].tarih);
    var oran = kokBul(
      function (r) { return xnpv(s, r, ref); },
      function (r) { return xnpvTurev(s, r, ref); },
      tahmin
    );
    if (oran === null) return null;
    return { oran: oran, tekMi: degisim === 1 };
  }

  /* --------------------------------------------------------- ödeme planı */

  /** Eşit taksitli (anüite) kredi taksiti. */
  function anuite(anapara, aylikFaiz, vadeAy) {
    if (!(anapara > 0) || !(vadeAy > 0)) return NaN;
    if (Math.abs(aylikFaiz) < EPS) return anapara / vadeAy;
    var k = Math.pow(1 + aylikFaiz, vadeAy);
    return anapara * aylikFaiz * k / (k - 1);
  }

  /**
   * Amortisman tablosu. Her satır: ay, taksit, faiz, anapara, kalan.
   * Son taksitte yuvarlama artığı kapatılır — aksi hâlde bakiye birkaç
   * kuruş açık kalıyor ve "kredi bitmedi" gibi görünüyor.
   */
  function odemePlani(anapara, aylikFaiz, vadeAy) {
    var taksit = anuite(anapara, aylikFaiz, vadeAy);
    if (!isFinite(taksit)) return { hata: "Geçersiz kredi parametreleri." };
    var kalan = anapara, satirlar = [], faizToplam = 0;
    for (var ay = 1; ay <= vadeAy; ay++) {
      var faiz = kalan * aylikFaiz;
      var ana = taksit - faiz;
      if (ay === vadeAy) { ana = kalan; taksit = ana + faiz; }
      kalan = Math.max(0, kalan - ana);
      faizToplam += faiz;
      satirlar.push({
        ay: ay,
        taksit: Math.round(taksit * 100) / 100,
        faiz: Math.round(faiz * 100) / 100,
        anapara: Math.round(ana * 100) / 100,
        kalan: Math.round(kalan * 100) / 100
      });
    }
    return {
      taksit: Math.round(anuite(anapara, aylikFaiz, vadeAy) * 100) / 100,
      satirlar: satirlar,
      faizToplam: Math.round(faizToplam * 100) / 100,
      odemeToplam: Math.round((anapara + faizToplam) * 100) / 100
    };
  }

  /** Tarihli akış serisini ödeme planından üretir — XIRR'e beslemek için. */
  function planiAkisaCevir(plan, baslangic, anapara) {
    var akis = [{ tarih: tarihe(baslangic).toISOString().slice(0, 10), tutar: anapara }];
    var d = tarihe(baslangic);
    plan.satirlar.forEach(function (s) {
      var t = new Date(d.getTime());
      t.setMonth(t.getMonth() + s.ay);
      akis.push({ tarih: t.toISOString().slice(0, 10), tutar: -s.taksit });
    });
    return akis;
  }

  return {
    gunFarki: gunFarki,
    efektifYillik: efektifYillik,
    aylikEsdeger: aylikEsdeger,
    cagr: cagr,
    npv: npv,
    irr: irr,
    xnpv: xnpv,
    xirr: xirr,
    anuite: anuite,
    odemePlani: odemePlani,
    planiAkisaCevir: planiAkisaCevir,
    isaretDegisimi: isaretDegisimi
  };
});
