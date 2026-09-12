/*!
 * Marjinal sermaye dağıtımı — "fazladan param nereye gitmeli?"
 *
 * NE YAPAR: aylık artan paranın borç kapatma, acil durum fonu ve mevduat
 * arasında nasıl bölüneceğini, her hedefin GERÇEK marjinal getirisini
 * hesaplayarak belirler. Çıktısı sıralama değil DAĞILIM, çünkü acil durum
 * fonu bir kısıt üretiyor.
 *
 * TEMEL FİKİR: borç kapatmak bir yatırımdır ve getirisi, borcun faiz
 * oranına eşittir — ama üç üstünlükle:
 *   risksiz    — getiri garantili, piyasa riski yok
 *   vergisiz   — mevduat faizinden stopaj kesilir, borçtan kurtulmaktan
 *                kesilmez
 *   anında     — vade beklemek gerekmez
 * Aylık %3,75 faizli bir kart borcu, yıllık bileşikte %55'in üzerine
 * karşılık gelir. Bu getiriyi veren risksiz bir yatırım yoktur; dolayısıyla
 * "borç mu kapatmalı, birikim mi yapmalı" sorusunun cevabı çoğu zaman
 * aritmetikle belirlenir, tercihle değil.
 *
 * ACİL DURUM FONU NEDEN YATIRIM DEĞİL, KISIT: fon yokken gelen bir şok
 * (iş kaybı, sağlık, araç) doğrudan kredi kartına biner. Yani fonun değeri
 * kendi getirisi değil, ENGELLEDİĞİ borçlanmanın maliyetidir. Bu yüzden
 * dağıtımda bir getiri kalemi gibi yarışmaz; asgari bir tampon mutlak
 * öncelikli, hedefe kalanı ise pahalı borçtan sonra gelir.
 *
 * Stopaj oranı finans/kurallar.js'ten gelir (GVK geçici 67 tablosu);
 * kart faizi tavanları bordro/borc-parametreleri.js'te. Kopyası yok.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/borc-mu-birikim-mi/
 */
(function (root, factory) {
  "use strict";
  var F = (typeof module === "object" && module.exports)
    ? require("./kurallar.js")
    : root.Finans;
  var v = factory(F);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.DagitimMotor = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (F) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  /* Aylık nominal oranı yıllık bileşiğe çevirir. Kart borcunda doğru
     karşılaştırma budur: her ay faiz bakiyeye ekleniyor. */
  function yillikBilesik(aylik) { return Math.pow(1 + aylik, 12) - 1; }

  /* Reel getiri: nominal getirinin enflasyondan arındırılmış hâli.
     Toplama/çıkarma değil bölme — yüksek enflasyonda fark büyük. */
  function reel(nominal, enflasyon) { return (1 + nominal) / (1 + enflasyon) - 1; }

  /**
   * @param {Object} g
   *   aylikFazla         aylık artan para (TL)
   *   acilFonMevcut      mevcut acil durum fonu (TL)
   *   aylikZorunluGider  aylık zorunlu gider (TL) — fon hedefinin ölçüsü
   *   acilFonAy          hedef kaç aylık gider (varsayılan 3)
   *   borclar            [{ad, bakiye, aylikFaiz}] aylikFaiz ondalık
   *   mevduatYillikBrut  yıllık brüt mevduat faizi (ondalık)
   *   vadeGun            mevduat vadesi (gün) — stopaj kademesini belirler
   *   enflasyon          beklenen yıllık enflasyon (ondalık)
   */
  function dagit(g) {
    var fazla = Number(g.aylikFazla) || 0;
    var fon = Math.max(0, Number(g.acilFonMevcut) || 0);
    var gider = Math.max(0, Number(g.aylikZorunluGider) || 0);
    var hedefAy = Number(g.acilFonAy) > 0 ? Number(g.acilFonAy) : 3;
    var enf = Number(g.enflasyon) || 0;
    var vade = Number(g.vadeGun) > 0 ? Number(g.vadeGun) : 92;

    if (!(fazla > 0)) return { hata: "Aylık artan para sıfırdan büyük olmalı." };

    /* --- mevduatın net ve reel getirisi ------------------------------- */
    var brut = Number(g.mevduatYillikBrut) || 0;
    var stopaj = F.stopajOraniGun(vade, "tl") / 100;
    var mevduatNet = brut * (1 - stopaj);
    var mevduatReel = reel(mevduatNet, enf);

    /* --- borçların yıllık eşdeğer getirisi ---------------------------- */
    var borclar = (g.borclar || []).map(function (b) {
      var aylik = Number(b.aylikFaiz) || 0;
      var yillik = yillikBilesik(aylik);
      return {
        ad: b.ad || "Borç",
        bakiye: Math.max(0, Number(b.bakiye) || 0),
        aylikFaiz: aylik,
        yillikGetiri: yillik,
        reelGetiri: reel(yillik, enf),
        tur: "borc"
      };
    }).filter(function (b) { return b.bakiye > 0; });

    borclar.sort(function (a, b) { return b.yillikGetiri - a.yillikGetiri; });

    /* --- acil fon hedefleri ------------------------------------------- */
    var tamponHedef = gider;                 // mutlak asgari: 1 aylık gider
    var fonHedef = gider * hedefAy;
    var tamponAcik = Math.max(0, tamponHedef - fon);
    var fonAcik = Math.max(0, fonHedef - fon);

    /* --- dağıtım ------------------------------------------------------ */
    var kalan = fazla;
    var dagitim = [];
    function ayir(ad, tutar, gerekce, tur, getiri) {
      if (tutar <= 0.005 || kalan <= 0.005) return;
      var t = Math.min(tutar, kalan);
      kalan -= t;
      dagitim.push({ hedef: ad, tutar: r2(t), gerekce: gerekce, tur: tur, getiri: getiri });
    }

    /* 1) Mutlak tampon. Fon sıfırken gelen şok doğrudan karta biner;
          bu yüzden en pahalı borcun bile önünde. */
    if (tamponAcik > 0) {
      ayir("Acil durum fonu (asgari tampon)", tamponAcik,
        "Tampon yokken herhangi bir aksilik doğrudan kredi kartına biner. " +
        "Bir aylık gider kadar tampon, en pahalı borcun bile önündedir.",
        "fon", null);
    }

    /* 2) Mevduat net getirisini AŞAN borçlar. Bunları kapatmak, aynı
          parayı mevduata koymaktan kesin olarak daha iyi — karşılaştırma
          risksiz ve vergisiz tarafta. */
    borclar.forEach(function (b) {
      if (b.yillikGetiri <= mevduatNet) return;
      ayir(b.ad, b.bakiye,
        "Yıllık eşdeğer getiri %" + (b.yillikGetiri * 100).toFixed(1) +
        " — mevduatın net getirisinin (%" + (mevduatNet * 100).toFixed(1) +
        ") üzerinde, üstelik risksiz ve vergisiz.",
        "borc", b.yillikGetiri);
    });

    /* 3) Acil fonu hedefe tamamla. */
    var kalanFonAcik = Math.max(0, fonAcik - tamponAcik);
    if (kalanFonAcik > 0) {
      ayir("Acil durum fonu (hedefe tamamlama)", kalanFonAcik,
        hedefAy + " aylık gider hedefine ulaşmak için. Pahalı borçtan sonra, " +
        "ucuz borçtan önce gelir.",
        "fon", mevduatNet);
    }

    /* 4) Kalan: mevduat netinin ALTINDA kalan borçlar burada.
          Bunları erken kapatmak matematiksel olarak mevduattan KÖTÜDÜR;
          ilk sürümde para yine borca gidiyordu ve gerekçe "borçsuz kalmanın
          kendi değeri var" diye elle yazılmıştı — bu, hesabın veremediği
          cevabı hesap yapıyormuş gibi sunmaktı. Artık para mevduata
          gidiyor, ucuz borç ise AÇIKÇA bir tercih olarak raporlanıyor. */
    var ucuzBorclar = borclar.filter(function (b) { return b.yillikGetiri <= mevduatNet; });

    if (kalan > 0.005) {
      ayir("Mevduat / birikim", kalan,
        "Kalan borçların getirisi mevduat netinin altında kaldığı için para " +
        "burada daha çok kazandırıyor. Net %" + (mevduatNet * 100).toFixed(1) +
        ", enflasyon sonrası reel %" + (mevduatReel * 100).toFixed(1) + ".",
        "mevduat", mevduatNet);
    }

    /* --- karşılaştırma: bu dağıtım vs hepsini mevduata koymak ---------
       12 aylık basit bir marjinal kazanç farkı. Borç kapatmada kazanç,
       ödenmeyen faizdir; mevduatta net faiz getirisidir. */
    var buPlan = dagitim.reduce(function (t, d) {
      var o = d.getiri === null ? mevduatNet : d.getiri;
      return t + d.tutar * 12 * o / 2;   // yıl boyunca eşit taksitle birikir → ortalama yarım yıl
    }, 0);
    var hepsiMevduat = fazla * 12 * mevduatNet / 2;
    var fark = buPlan - hepsiMevduat;

    return {
      mevduat: {
        brut: brut, stopaj: stopaj, net: mevduatNet, reel: mevduatReel, vadeGun: vade
      },
      borclar: borclar,
      acilFon: {
        mevcut: r2(fon), tamponHedef: r2(tamponHedef), hedef: r2(fonHedef),
        acik: r2(fonAcik), hedefAy: hedefAy,
        tamamMi: fonAcik <= 0.005,
        kacAyda: fonAcik > 0 && fazla > 0 ? Math.ceil(fonAcik / fazla) : 0
      },
      dagitim: dagitim,
      /* Bu ay sıra gelmeyen ama kuyrukta bekleyen hedefler — kullanıcı
         "kartım ne olacak?" diye sormasın diye. */
      kuyruk: borclar.filter(function (b) {
        return !dagitim.some(function (d) { return d.hedef === b.ad; });
      }).map(function (b) {
        return { ad: b.ad, yillikGetiri: b.yillikGetiri, ucuz: b.yillikGetiri <= mevduatNet };
      }),
      ucuzBorclar: ucuzBorclar.map(function (b) {
        return { ad: b.ad, yillikGetiri: b.yillikGetiri, fark: r2((mevduatNet - b.yillikGetiri) * 100) };
      }),
      aylikFazla: r2(fazla),
      kiyas: { buPlan: r2(buPlan), hepsiMevduat: r2(hepsiMevduat), fark: r2(fark) },
      enflasyon: enf
    };
  }

  return { dagit: dagit, yillikBilesik: yillikBilesik, reel: reel };
});
