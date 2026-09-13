/*!
 * Erken Kapatma vs Yatırım — karar motoru
 *
 * SORU: elinizde toplu para var. Krediyi (kısmen veya tamamen) kapatmak mı,
 * aynı parayı yatırıma koymak mı? Cevap piyasanın ne getireceğine bağlı —
 * bu motor o eşiği hesaplıyor.
 *
 * KARŞILAŞTIRMANIN KURALI: HER İKİ YOLDA AYNI PARA HARCANIR.
 *   Erken kapatma: t=0'da X + tazminat ödenir, kredi kısalır; kredi bittikten
 *     sonra SERBEST KALAN TAKSİT yatırıma gider.
 *   Yatırım: t=0'da X yatırıma konur, kredi olduğu gibi devam eder.
 *   Karşılaştırma, orijinal kalan vadenin sonundaki servet üzerinden yapılır.
 * Serbest kalan taksidi yatırmayan bir hesap, erken kapatmayı haksız yere
 * kaybettirir — ev al/kirala aracındaki "fark yatırılır" kuralının aynısı.
 *
 * TÜRKİYE'YE ÖZGÜ ÜÇ KURAL (TKHK)
 *   1. TÜKETİCİ (İHTİYAÇ) KREDİSİNDE ERKEN ÖDEME TAZMİNATI YOKTUR (m.27).
 *      Banka gerekli faiz indirimini yapmak zorundadır. Piyasadaki pek çok
 *      hesaplayıcı buraya da %2 uyguluyor; yanlış.
 *   2. KONUT KREDİSİNDE tazminat YALNIZCA SABİT FAİZLİ sözleşmede istenebilir
 *      (m.37). Kalan vade 36 aydan FAZLA ise erken ödenen anaparanın en çok
 *      %2'si, 36 ay ve altındaysa en çok %1'i. Değişken faizde tazminat yok.
 *   3. TAZMİNAT, SAĞLANAN FAİZ İNDİRİMİNİ AŞAMAZ. Bu bir üst sınırdır ve
 *      motor bunu ayrıca uyguluyor.
 *
 * Kredi matematiği finans/zaman-motoru.js'ten gelir; burada ikinci bir
 * amortisman uygulaması yazılmadı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/erken-kapatma-analizi/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var Z = nodeMi ? require("./zaman-motoru.js") : root.ZamanMotoru;
  var E = nodeMi ? require("./enflasyon-motoru.js") : root.EnflasyonMotoru;
  var v = factory(Z, E);
  if (nodeMi) module.exports = v;
  else root.ErkenKapatmaMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Z, E) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  /* TKHK tazminat tavanları. Oran, KALAN VADEYE göre değişiyor. */
  var TAZMINAT = {
    ihtiyac: function () { return 0; },
    "konut-degisken": function () { return 0; },
    "konut-sabit": function (kalanVadeAy) { return kalanVadeAy > 36 ? 0.02 : 0.01; }
  };

  /** Kalan borcun, verilen taksitle kaç ayda biteceği. */
  function kalanAy(bakiye, aylikFaiz, taksit) {
    if (bakiye <= 0) return 0;
    if (taksit <= bakiye * aylikFaiz) return Infinity;   // taksit faizi karşılamıyor
    if (aylikFaiz <= 1e-12) return Math.ceil(bakiye / taksit);
    return Math.log(taksit / (taksit - bakiye * aylikFaiz)) / Math.log(1 + aylikFaiz);
  }

  /**
   * Bir krediyi ay ay yürütür, isteğe bağlı t=0 ön ödemesiyle.
   * Doner: {bitisAy, faizToplam, odemeToplam}
   */
  function yurut(bakiye, aylikFaiz, taksit, vadeAy) {
    var kalan = bakiye, faiz = 0, odeme = 0, ay = 0;
    /* Aylik odeme dizisi de doner: son ay KISMI odeniyor ve o aydaki
       serbest nakit, karsilastirmanin dogru kurulmasi icin sayilmali. */
    var odemeler = [];
    while (ay < vadeAy) {
      ay++;
      if (kalan <= 0.005) { odemeler.push(0); continue; }
      var f = kalan * aylikFaiz;
      var od = Math.min(taksit, kalan + f);
      kalan = kalan + f - od;
      faiz += f; odeme += od;
      odemeler.push(od);
    }
    var bitis = 0;
    for (var k = 0; k < odemeler.length; k++) if (odemeler[k] > 0.005) bitis = k + 1;
    return {
      bitisAy: bitis, faizToplam: faiz, odemeToplam: odeme,
      kalan: Math.max(0, kalan), odemeler: odemeler
    };
  }

  /**
   * @param {Object} g
   *   kalanAnapara   TL
   *   aylikFaiz      ondalık (örn 0.025)
   *   kalanVadeAy    ay
   *   krediTuru      "ihtiyac" | "konut-sabit" | "konut-degisken"
   *   tutar          elde olan toplu para (TL)
   *   yatirimNetYillik  yatırımın VERGİ SONRASI yıllık getirisi (ondalık)
   *   enflasyon      yıllık (ondalık) — reel çerçeve için
   */
  function analiz(g) {
    var B = Number(g.kalanAnapara) || 0;
    var i = Number(g.aylikFaiz) || 0;
    var T = Math.max(1, Math.round(Number(g.kalanVadeAy) || 0));
    var X = Math.max(0, Number(g.tutar) || 0);
    var rNet = Number(g.yatirimNetYillik) || 0;
    var enf = Number(g.enflasyon) || 0;
    var tur = TAZMINAT[g.krediTuru] ? g.krediTuru : "ihtiyac";

    if (!(B > 0)) return { hata: "Kalan anapara sıfırdan büyük olmalı." };
    if (!(X > 0)) return { hata: "Elinizdeki tutar sıfırdan büyük olmalı." };

    var taksit = Z.anuite(B, i, T);
    if (!isFinite(taksit)) return { hata: "Kredi parametreleri geçersiz." };

    var rAy = Math.pow(1 + rNet, 1 / 12) - 1;
    var odenen = Math.min(X, B);               // anaparadan fazlası ödenemez
    var artan = X - odenen;                    // kredi kapandıysa kalan para

    /* --- taban: hiç ön ödeme yok --- */
    var taban = yurut(B, i, taksit, T);

    /* --- erken kapatma --- */
    var yeniBakiye = B - odenen;
    var sonra = yurut(yeniBakiye, i, taksit, T);
    var faizIndirimi = taban.faizToplam - sonra.faizToplam;

    /* Tazminat: oran x erken ödenen anapara, ama faiz indirimini AŞAMAZ. */
    var oran = TAZMINAT[tur](T);
    var tazminatHam = odenen * oran;
    var tazminat = Math.min(tazminatHam, faizIndirimi);
    var tavanUygulandi = tazminatHam > faizIndirimi + 0.005;

    /* Serbest nakit AY AY hesaplanıyor: her ayda taban senaryoda ödenecek
       tutar ile erken kapatma sonrası ödenen tutarın farkı yatırıma gider.
       İlk sürümde yalnızca "kredi bittikten sonraki tam aylar" sayılıyordu
       ve kredinin kapandığı aydaki KISMİ taksidin serbest kalan kısmı
       atlanıyordu. Bu, tazminatsız durumda başabaşı kredinin efektif
       oranının 1,3 puan altına kaydırıyordu — küçük ama sistematik hata. */
    var serbestBirikim = 0;
    for (var a = 0; a < T; a++) {
      var serbest = (taban.odemeler[a] || 0) - (sonra.odemeler[a] || 0);
      serbestBirikim = serbestBirikim * (1 + rAy) + serbest;
    }
    var bosAy = Math.max(0, T - sonra.bitisAy);
    /* Kredi zaten kapandıysa artan para da t=0'dan itibaren yatırımda. */
    var artanBuyume = artan * Math.pow(1 + rAy, T);
    var kapatmaServeti = serbestBirikim + artanBuyume - tazminat * Math.pow(1 + rAy, T);

    /* --- yatırım --- */
    var yatirimServeti = X * Math.pow(1 + rAy, T);

    var fark = kapatmaServeti - yatirimServeti;

    /* --- başabaş: hangi net yıllık getiride karar döner? --- */
    function farkIcin(r) {
      var ra = Math.pow(1 + r, 1 / 12) - 1;
      var s = 0;
      for (var k = 0; k < T; k++) {
        s = s * (1 + ra) + ((taban.odemeler[k] || 0) - (sonra.odemeler[k] || 0));
      }
      var kap = s + artan * Math.pow(1 + ra, T) - tazminat * Math.pow(1 + ra, T);
      return kap - X * Math.pow(1 + ra, T);
    }
    var basabas = null;
    var alt = 0, ust = 3;
    if (farkIcin(alt) * farkIcin(ust) < 0) {
      for (var it = 0; it < 120; it++) {
        var orta = (alt + ust) / 2;
        if (farkIcin(alt) * farkIcin(orta) <= 0) ust = orta; else alt = orta;
      }
      basabas = (alt + ust) / 2;
    }

    /* Erken kapatmanın "getirisi": kurtarılan faiz, ödenen paraya oranla,
       yıllık bileşiğe çevrilmiş. Risksiz ve vergisiz olduğu için yatırımın
       NET getirisiyle karşılaştırılmalı. */
    var kapatmaGetirisi = Z.efektifYillik(i);

    return {
      taksit: r2(taksit),
      odenen: r2(odenen),
      artan: r2(artan),
      tazminat: r2(tazminat),
      tazminatOrani: oran,
      tazminatTavaniUygulandi: tavanUygulandi,
      tazminatYok: oran === 0,
      krediTuru: tur,
      faizIndirimi: r2(faizIndirimi),
      netKazanc: r2(faizIndirimi - tazminat),
      tabanFaiz: r2(taban.faizToplam),
      kalanFaiz: r2(sonra.faizToplam),
      yeniBitisAy: sonra.bitisAy,
      kisalanAy: Math.max(0, taban.bitisAy - sonra.bitisAy),
      kapatmaServeti: r2(kapatmaServeti),
      yatirimServeti: r2(yatirimServeti),
      fark: r2(fark),
      kazanan: fark >= 0 ? "kapatma" : "yatirim",
      basabasGetiri: basabas,
      kapatmaGetirisi: kapatmaGetirisi,
      yatirimNetYillik: rNet,
      yatirimReel: E.reel(rNet, enf),
      kapatmaReel: E.reel(kapatmaGetirisi, enf)
    };
  }

  /** Isı haritası için: x = yatırım getirisi, y = erken ödenen tutar. */
  function duyarlilik(g, secenek) {
    secenek = secenek || {};
    var xler = secenek.x || [0.20, 0.30, 0.40, 0.50, 0.60, 0.70];
    var yler = secenek.y || [];
    if (!yler.length) {
      var B = Number(g.kalanAnapara) || 0;
      for (var p = 1; p <= 6; p++) yler.push(Math.round(B * p / 6));
    }
    var hucreler = [], enBuyuk = 0, arti = false, eksi = false;
    for (var j = 0; j < yler.length; j++) {
      var satir = [];
      for (var k = 0; k < xler.length; k++) {
        var o = {};
        for (var n in g) if (Object.prototype.hasOwnProperty.call(g, n)) o[n] = g[n];
        o.tutar = yler[j];
        o.yatirimNetYillik = xler[k];
        var r = analiz(o);
        var d = r.hata ? null : r.fark;
        if (d !== null) {
          if (d > 0) arti = true; else if (d < 0) eksi = true;
          if (Math.abs(d) > enBuyuk) enBuyuk = Math.abs(d);
        }
        satir.push({ x: xler[k], y: yler[j], deger: d, kazanan: d === null ? null : (d >= 0 ? "kapatma" : "yatirim") });
      }
      hucreler.push(satir);
    }
    return { x: xler, y: yler, hucreler: hucreler, enBuyukMutlak: enBuyuk, sinirVar: arti && eksi };
  }

  return { analiz: analiz, duyarlilik: duyarlilik, kalanAy: kalanAy, TAZMINAT: TAZMINAT };
});
