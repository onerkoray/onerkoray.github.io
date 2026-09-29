/*!
 * Diyagramlar sayfasının hesabı — her rakam sitenin kendi motorundan.
 *
 * Bu modül hesap yapmaz, motorları çağırır ve diyagramın ihtiyaç duyduğu
 * biçime dizer: bordro için bordro/motor.js, kredi için
 * kredi-hesaplama/hesap.js. Sayfadaki bir rakam ile araçtaki rakam bu yüzden
 * ayrışamaz; motor değişirse diyagram da değişir ve üreteç --check kırmızı
 * yanar.
 *
 * YIL SABİT: diyagramlar yılın bordro parametreleriyle çizilir. Yeni yılın
 * parametreleri girildiğinde YIL elle ilerletilir; sayfadaki gecerlilik
 * bildirimi o tarihte CI'ı hatırlatır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../bordro/motor.js"), require("../kredi-hesaplama/hesap.js"));
  } else {
    root.DiyagramHesap = factory(root.Bordro, root.Kredi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, Kr) {
  "use strict";

  var YIL = 2026;

  /* Temsili maaşlar: asgari ücretin katı. Ülke ortalaması değil; kademeler
     tavan, dilim ve istisnanın nerede devreye girdiğini göstermek için. */
  var KATLAR = [1, 2, 3, 5];
  var VARSAYILAN_KAT = 2;

  /* Kredi örneği kredi hesaplama aracının açılış örneğiyle aynı: iki sayfa
     aynı krediyi anlatsın. */
  var KREDI = { anapara: 250000, vade: 36, aylikFaiz: 2.89, kkdf: 15, bsmv: 15 };

  function donem(yil) {
    var a = B.hesaplaYil(1, yil).aylar[0];
    return { asgariBrut: a.asgariBrut, sgkTavan: a.sgkTavan };
  }

  /* ---- 1 ve 2: bir maaşın yılı ----------------------------------------- */
  function ucret(kat, yil) {
    yil = yil || YIL;
    var d = donem(yil);
    var brutAy = d.asgariBrut * kat;
    var r = B.hesaplaYil(brutAy, yil);
    var t = { isverenPrim: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, damga: 0, net: 0, brut: 0, isverenMaliyeti: 0 };
    var aylar = r.aylar.map(function (a) {
      var isvPrim = a.isverenSgk + a.isverenIssizlik;
      t.isverenPrim += isvPrim; t.sgk += a.sgk; t.issizlik += a.issizlik;
      t.gelirVergisi += a.gelirVergisi; t.damga += a.damga; t.net += a.net;
      t.brut += a.brut; t.isverenMaliyeti += a.isverenMaliyeti;
      return {
        ay: a.ay, ayAdi: a.ayAdi, brut: a.brut, net: a.net,
        prim: a.sgk + a.issizlik, gelirVergisi: a.gelirVergisi, damga: a.damga,
        dilim: a.dilim, dilimGecisi: !!a.dilimGecisi, istisna: a.istisna
      };
    });
    /* En düşük nete İLK inilen ay: son aylar kuruş farkıyla eşit, "…'dan
       itibaren" dendiğinde başlangıç ayı doğru olmalı. */
    var dip = Math.min.apply(null, aylar.map(function (a) { return a.net; }));
    var enDusuk = aylar.filter(function (a) { return a.net - dip < 1; })[0];
    var enYuksek = aylar.reduce(function (m, a) { return a.net > m.net ? a : m; }, aylar[0]);
    return {
      yil: yil, kat: kat, brutAy: brutAy, asgariBrut: d.asgariBrut, sgkTavan: d.sgkTavan,
      yillik: t, aylar: aylar,
      netPay: t.net / t.isverenMaliyeti,               // işverenin 100 lirasından çalışana kalan
      vergiPay: (t.gelirVergisi + t.damga) / t.isverenMaliyeti,
      primPay: (t.isverenPrim + t.sgk + t.issizlik) / t.isverenMaliyeti,
      enDusuk: enDusuk, enYuksek: enYuksek,
      // Temmuzda net artıyor mu (asgari ücret istisnası büyüdüğü için)?
      temmuzArtisi: aylar[6].net - aylar[5].net
    };
  }

  /* ---- 3: kredi taksitinin içi ----------------------------------------- */
  function kredi(girdi) {
    var g = {};
    Object.keys(KREDI).forEach(function (k) { g[k] = (girdi && girdi[k] != null) ? girdi[k] : KREDI[k]; });
    var p = Kr.plan(g);
    var s = p.satirlar;
    var maliyet = function (r) { return r.faiz + r.kkdf + r.bsmv; };
    var kesisim = null;
    for (var i = 0; i < s.length; i++) if (s[i].anapara > maliyet(s[i])) { kesisim = s[i].ay; break; }
    var ilk = s[0];
    return {
      girdi: g, plan: p, satirlar: s,
      taksit: ilk.taksit,
      ilkMaliyetPay: maliyet(ilk) / ilk.taksit,        // ilk taksitin faiz + vergi payı
      sonAnaparaPay: s[s.length - 1].anapara / s[s.length - 1].taksit,
      kesisimAyi: kesisim,                               // anaparanın faiz + vergiyi ilk geçtiği ay
      toplamFaiz: p.toplamFaiz, toplamVergi: p.toplamKkdf + p.toplamBsmv,
      toplamMaliyet: p.toplamFaiz + p.toplamKkdf + p.toplamBsmv,
      toplamOdeme: p.taksitToplam
    };
  }

  /* ---- 4: kesinti oranı eğrisi ----------------------------------------- */
  /* Yıl boyu sabit brütle yıllık toplam kesinti ÷ yıllık brüt (ortalama) ve
     brüte eklenen son liradan kesilen pay (marjinal). Marjinal, aylık brüte
     1 TL eklenince yıllık kesintinin artışı ÷ 12. Işveren payı dahil değil:
     eğri çalışanın bordrosunu anlatır. */
  var EGRI = { minKat: 1, maxKat: 40, adim: 0.05 };

  function kesinti(brutAy, yil) {
    var t = B.hesaplaYil(brutAy, yil).toplam;
    return t.brut - t.net;
  }

  function egri(yil) {
    yil = yil || YIL;
    var d = donem(yil);
    var noktalar = [];
    // log ölçekte eşit adım: kat = e^(i·adim)
    var a0 = Math.log(EGRI.minKat), a1 = Math.log(EGRI.maxKat);
    var n = Math.round((a1 - a0) / EGRI.adim);
    var katlar = [];
    for (var i = 0; i <= n; i++) katlar.push(Math.exp(a0 + (a1 - a0) * i / n));
    // Tavan tam üstüne bir nokta: tepe örneklemin arasında kaybolmasın.
    var tavanKat = d.sgkTavan / d.asgariBrut;
    katlar.push(tavanKat);
    katlar.sort(function (x, y) { return x - y; });
    katlar.forEach(function (k) {
      var b = d.asgariBrut * k;
      var kes = kesinti(b, yil);
      var marj = (kesinti(b + 1, yil) - kes) / 12;
      noktalar.push({ kat: k, brutAy: b, ortalama: kes / (b * 12), marjinal: marj });
    });

    // Yerel tepe: SGK tavanı. Tavanın üstünde prim kesilmez, oran düşer.
    var tavanNokta = noktalar.filter(function (p) { return p.kat === tavanKat; })[0];
    var tepe = tavanNokta;
    // Oran tavandaki düzeye hangi brütte geri dönüyor? İkiye bölme.
    var geri = null;
    var ust = d.asgariBrut * EGRI.maxKat;
    if (kesinti(ust, yil) / (ust * 12) > tepe.ortalama) {
      var lo = d.sgkTavan * 1.001, hi = ust;
      // tavanın hemen üstünde oran tepe değerin altında
      for (var j = 0; j < 60; j++) {
        var m = (lo + hi) / 2;
        if (kesinti(m, yil) / (m * 12) >= tepe.ortalama) hi = m; else lo = m;
      }
      geri = { brutAy: hi, kat: hi / d.asgariBrut };
    }
    var dip = noktalar.filter(function (p) { return p.brutAy > d.sgkTavan && (!geri || p.brutAy < geri.brutAy); })
      .reduce(function (m, p) { return !m || p.ortalama < m.ortalama ? p : m; }, null);
    var ilk = noktalar[0];
    return {
      yil: yil, asgariBrut: d.asgariBrut, sgkTavan: d.sgkTavan, tavanKat: tavanKat,
      noktalar: noktalar, tepe: tepe, geriDonus: geri, dip: dip, ilk: ilk
    };
  }

  function ucretNoktasi(kat, yil) {
    yil = yil || YIL;
    var d = donem(yil), b = d.asgariBrut * kat;
    var kes = kesinti(b, yil);
    return { kat: kat, brutAy: b, ortalama: kes / (b * 12), marjinal: (kesinti(b + 1, yil) - kes) / 12 };
  }

  return {
    YIL: YIL, KATLAR: KATLAR, VARSAYILAN_KAT: VARSAYILAN_KAT, KREDI: KREDI,
    ucret: ucret, kredi: kredi, egri: egri, ucretNoktasi: ucretNoktasi, donem: donem
  };
});
