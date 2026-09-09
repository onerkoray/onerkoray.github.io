/*!
 * Ücret–Kâr Payı Optimizasyon Çekirdeği — limited şirket ortağı
 *
 * SORU: Şirketinden gelir alan bir ortak, aynı toplam kaynağı ücret (huzur
 * hakkı) ve kâr payı arasında nasıl paylaştırırsa eline en çok net geçer?
 *
 * Cevap sezgisel değildir, çünkü dört mekanizma aynı anda çalışır:
 *
 *   1. ÜCRET ŞİRKET İÇİN GİDERDİR. Ödenen her lira kurum kazancını düşürür,
 *      yani %25 kurumlar vergisi + kalanın %15 kâr payı stopajı birlikte
 *      yaklaşık %36 yükten kaçınılır.
 *   2. AMA ÜCRET DE VERGİLENİR. Artan oranlı tarife ve kümülatif matrah
 *      yüzünden ücret büyüdükçe marjinal oran yükselir.
 *   3. ORTAĞIN ÜCRETİNDEN SGK KESİLMEZ. Limited ortağı 5510 m.4/1-b
 *      uyarınca 4/b sigortalısıdır; kendi şirketinden ücret alsa da 4/a'lı
 *      olmaz. Bu, ücreti normal bir çalışana göre avantajlı kılar.
 *   4. GVK m.22 EŞİĞİ. Kâr payının yarısı istisnadır; kalan yarı beyan
 *      haddini aşarsa beyanname verilir ve kesilen stopajın TAMAMI mahsup
 *      edilir — bu çoğu zaman İADE doğurur.
 *
 * DÖRDÜNCÜ MADDE BİR UÇURUM YARATIR ve aracın asıl bulgusu budur:
 * ücreti artırmak kâr payını küçültür; kâr payı beyan haddinin ALTINA
 * düşerse beyanname verilmez, stopaj mahsup edilemez ve iade kaybolur.
 * Yani ücreti artırmak net geliri ANİDEN DÜŞÜREBİLİR. Ölçülen bir örnekte
 * aylık ücreti 135.000'den 140.000'e çıkarmak yıllık neti 73.289 TL
 * azaltıyor. Bu, kaba bir taramanın atlayacağı bir kırılmadır; çekirdek
 * eşiği ikiye bölmeyle ayrıca bulur.
 *
 * FİZİBİLİTE KISITI ZORUNLUDUR. Ücret × 12, hasılat eksi giderden büyük
 * olamaz — şirket ödeyemeyeceği ücreti ödeyemez. Bu kısıt olmadan model
 * eksi kurum kazancı üretip anlamsız (hatta negatif) efektif yük veriyordu.
 *
 * Hesabın kendisi YENİDEN YAZILMADI: sitenin çalışma biçimi çekirdeği
 * (bordro/calisma-bicimi.js) çağrılıyor. Bu çekirdek yalnızca o motoru
 * ücret ekseninde tarar, optimumu ve eşikleri bulur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/ucret-kar-payi-optimizasyonu/
 */
(function (root, factory) {
  "use strict";
  var C = (typeof module === "object" && module.exports)
    ? require("../bordro/calisma-bicimi.js")
    : root.BordroCalismaBicimi;   /* calisma-bicimi.js tarayicida bu adla yayiliyor */
  var v = factory(C);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.UcretKarPayi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (CB) {
  "use strict";

  function sayi(deger) {
    if (typeof deger === "number") return isFinite(deger) ? deger : 0;
    if (deger === null || deger === undefined) return 0;
    var s = String(deger).trim().replace(/\s/g, "").replace(/₺/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function normalize(girdi) {
    var g = girdi || {};
    var hasilat = Math.max(0, sayi(g.hasilat !== undefined ? g.hasilat : g.yillikMaliyet));
    var gider = Math.max(0, sayi(g.gider !== undefined ? g.gider : g.yillikGider));
    return {
      hasilat: hasilat,
      gider: Math.min(gider, hasilat),
      ihracatOrani: Math.max(0, Math.min(1, sayi(g.ihracatOrani))),
      bagkurMatrahi: sayi(g.bagkurMatrahi),
      /* Motorun sözleşmesi: bagkurIndirimi VARSAYILAN OLARAK AÇIK
         (girdi.bagkurIndirimi !== false). Burada "!!" kullanmak tanımsızı
         false'a çevirip varsayılanı sessizce ters çeviriyordu ve net 14.467 TL
         düşük çıkıyordu. Motorla tutarlılık testi bunu yakaladı. */
      bagkurIndirimi: g.bagkurIndirimi !== false,
      yil: g.yil
    };
  }

  /* Şirketin ödeyebileceği en yüksek aylık ücret. Ücret şirket gideri
     olduğu için hasılat eksi gideri aşamaz; aşarsa kurum kazancı eksiye
     düşer ve senaryo gerçek dışı olur. */
  function fizibilUst(d) {
    return Math.max(0, (d.hasilat - d.gider) / 12);
  }

  /* Tek bir ücret düzeyinde limited (ücret + kâr payı) senaryosu. */
  function deger(d, aylikUcret) {
    var girdi = {
      yillikMaliyet: d.hasilat,
      yillikGider: d.gider,
      ihracatOrani: d.ihracatOrani,
      bagkurMatrahi: d.bagkurMatrahi,
      bagkurIndirimi: d.bagkurIndirimi,
      ortakUcretBrut: Math.max(0, aylikUcret)
    };
    if (d.yil) girdi.yil = d.yil;
    var r = CB.karsilastir(girdi);
    var s = null;
    r.senaryolar.forEach(function (x) { if (x.kod === "limitedUcret") s = x; });
    if (!s) return null;
    return {
      aylikUcret: Math.max(0, aylikUcret),
      yillikUcret: Math.max(0, aylikUcret) * 12,
      net: s.net,
      efektifYuk: s.efektifYuk,
      devleteGiden: s.devleteGiden,
      ucretNet: s.ucretNet,
      karPayiEline: s.karPayiEline,
      dagitilabilir: s.dagitilabilir,
      kurumlarVergisi: s.kurumlarVergisi,
      karPayiStopaji: s.karPayiStopaji,
      beyanVar: s.beyanVar,
      beyanaTabi: s.beyanaTabi,
      odenecekGV: s.odenecekGV,
      iadeGV: s.iadeGV,
      beyanMatrahi: s.beyanMatrahi
    };
  }

  /* ------------------------------------------------------------------ *
   * Beyan eşiğinin YERİ — ikiye bölmeyle
   *
   * Kaba tarama eşiği atlar; atlanınca hem uçurum görünmez hem de optimum
   * yanlış yerde bulunur. beyanVar bayrağı ücret arttıkça bir kez true'dan
   * false'a döner (kâr payı küçüldüğü için); bu tek yönlülük ikiye bölmeyi
   * geçerli kılar ve test onu ayrıca sınıyor.
   * ------------------------------------------------------------------ */
  function beyanEsigi(d) {
    var ust = fizibilUst(d);
    if (ust <= 0) return null;
    var bas = deger(d, 0), son = deger(d, ust);
    if (!bas || !son || bas.beyanVar === son.beyanVar) return null;

    var alt = 0, yuk = ust;
    for (var i = 0; i < 60 && (yuk - alt) > 1; i++) {
      var orta = (alt + yuk) / 2;
      if (deger(d, orta).beyanVar === bas.beyanVar) alt = orta; else yuk = orta;
    }
    var once = deger(d, alt), sonra = deger(d, yuk);
    return {
      aylikUcret: alt,
      oncekiNet: once.net,
      sonrakiNet: sonra.net,
      /* Eşiği geçmenin bedeli. Pozitifse ücreti artırmak neti DÜŞÜRÜYOR. */
      netKaybi: once.net - sonra.net,
      kaybedilenIade: once.iadeGV - sonra.iadeGV
    };
  }

  /* ------------------------------------------------------------------ *
   * Tarama ve optimum
   * ------------------------------------------------------------------ */
  function tara(girdi) {
    var d = normalize(girdi);
    var ust = fizibilUst(d);
    var adet = Math.max(10, Math.min(200, Math.round(sayi((girdi || {}).adet) || 60)));

    var noktalar = [];
    if (ust <= 0) {
      return { girdi: d, fizibilUst: 0, noktalar: [], optimum: null,
               esik: null, kiyas: null };
    }

    for (var i = 0; i < adet; i++) {
      var u = ust * i / (adet - 1);
      var v = deger(d, u);
      if (v) noktalar.push(v);
    }

    /* Eşiğin iki yanı taramaya ayrıca ekleniyor: optimum çoğu zaman eşiğin
       hemen ALTINDA olur ve kaba ızgara o noktayı ıskalar. */
    var esik = beyanEsigi(d);
    if (esik) {
      [esik.aylikUcret - 1, esik.aylikUcret, esik.aylikUcret + 1].forEach(function (u) {
        if (u >= 0 && u <= ust) {
          var v2 = deger(d, u);
          if (v2) noktalar.push(v2);
        }
      });
      noktalar.sort(function (a, b) { return a.aylikUcret - b.aylikUcret; });
    }

    var optimum = noktalar.reduce(function (a, b) { return b.net > a.net ? b : a; });

    /* Karşılaştırma tabanları: hiç ücret ödememek ve tavana kadar ücret. */
    var sifir = noktalar[0];
    var tamUcret = noktalar[noktalar.length - 1];

    return {
      girdi: d,
      fizibilUst: ust,
      noktalar: noktalar,
      optimum: optimum,
      esik: esik,
      kiyas: {
        ucretsiz: sifir,
        azamiUcret: tamUcret,
        kazancUcretsizeGore: optimum.net - sifir.net,
        kazancAzamiyeGore: optimum.net - tamUcret.net
      }
    };
  }

  /* Yalnızca optimumu isteyenler için kısa yol. */
  function optimum(girdi) {
    var t = tara(girdi);
    return t.optimum ? {
      aylikUcret: t.optimum.aylikUcret,
      yillikNet: t.optimum.net,
      efektifYuk: t.optimum.efektifYuk,
      beyanVar: t.optimum.beyanVar,
      kazanc: t.kiyas ? t.kiyas.kazancUcretsizeGore : 0,
      fizibilUst: t.fizibilUst
    } : null;
  }

  return {
    surum: "1.0.0",
    sayi: sayi,
    normalize: normalize,
    fizibilUst: fizibilUst,
    deger: deger,
    beyanEsigi: beyanEsigi,
    tara: tara,
    optimum: optimum
  };
});
