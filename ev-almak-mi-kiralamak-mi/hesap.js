/*!
 * Ev Almak mı Kiralamak mı — hesap çekirdeği (Türkiye)
 *
 * Bu dosya DOM bilmez ve kendi kredi matematiğini yazmaz: taksit ve
 * amortisman kredi çekirdeğinden (kredi-hesaplama/hesap.js) gelir. İki
 * araçta iki farklı taksit hesabı olsaydı sessizce ayrışırlardı.
 *
 * KARŞILAŞTIRMANIN TEK DOĞRU KURALI: FARK YATIRILIR.
 *
 * "Kira ödemek boşa para, taksit ödemek birikim" cümlesi bu hesabın en
 * yaygın hatasıdır. İki yol ancak AYNI PARAYI harcadıklarında
 * karşılaştırılabilir:
 *
 *   - Kiracı, alıcının peşinat + alım masrafı olarak ödediği parayı
 *     ilk gün yatırıma koyar. (Peşinatın fırsat maliyeti.)
 *   - Her ay iki yolun gideri farklıdır; AZ ödeyen taraf aradaki farkı
 *     yatırır. Bunu yapmayan bir hesap, kiracıyı parayı harcamış gibi
 *     gösterip satın almayı haksız yere kazandırır.
 *
 * Türkiye'ye özgü üç asimetri modelleniyor:
 *
 *   1. KİRA ARTIŞI YASAL OLARAK SINIRLI (TBK m.344: konut kirasında artış,
 *      bir önceki kira yılının TÜFE on iki aylık ortalamasını geçemez),
 *      ev değer artışı ise sınırsız. İkisi ayrı girdidir; birbirine eşit
 *      varsaymak Türkiye'de yanlış cevap üretir.
 *   2. KONUT KREDİSİ KKDF VE BSMV'DEN İSTİSNADIR. Kredi çekirdeğine bu
 *      yüzden sıfır veriliyor — ihtiyaç kredisiyle karıştırılmamalı.
 *   3. ALIM VE SATIM MASRAFLARI GERİ DÖNMEZ. Tapu harcı ve komisyon,
 *      evi elde tuttuğunuz süre kısaldıkça satın almayı ağırlaştırır;
 *      başabaş yılının varlık sebebi budur.
 *
 * Para aritmetiği tamsayı kuruş üzerinden yürür.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/ev-almak-mi-kiralamak-mi/
 */
(function (root, factory) {
  "use strict";
  var K = (typeof module === "object" && module.exports)
    ? require("../kredi-hesaplama/hesap.js")
    : root.Kredi;
  var v = factory(K);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.EVKIRA = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Kredi) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Varsayılanlar — hepsi arayüzde düzenlenebilir.
   * ------------------------------------------------------------------ */
  var VARSAYILAN = {
    /* Tapu harcı: satış bedeli üzerinden binde 20 (%2) alıcı payı.
       Uygulamada satıcı payı da alıcıya yüklenebiliyor; oran girdidir. */
    tapuHarciYuzde: 2,
    /* Emlakçı komisyonu — genellikle %2 + KDV, taraf başına. */
    komisyonYuzde: 2,
    /* Satarken ödenen komisyon; elde tutup satmayacaksanız 0 yapın. */
    satisKomisyonYuzde: 2,
    /* Emlak vergisi: meskende binde 1, büyükşehirde binde 2. */
    emlakVergisiBinde: 2,
    /* Yıllık bakım-onarım karşılığı — ev değerinin yüzdesi. */
    bakimYuzde: 0.5,
    /* DASK + konut sigortası, yıllık TL. */
    sigortaYillik: 4000,
    /* Konut kredisi KKDF ve BSMV'den istisnadır. */
    kkdf: 0,
    bsmv: 0
  };

  function sayi(d) { return Kredi.sayi(d); }
  function kurusaCevir(tl) { return Math.round(sayi(tl) * 100); }
  function kurus(k) { return Math.round(k) / 100; }

  /* Yıllık orandan aylık bileşik oran — bölme değil 12. kök.
     Birikim çekirdeğiyle aynı kural; iki araçta iki davranış olmamalı. */
  function aylikOran(yillikYuzde) {
    var y = sayi(yillikYuzde) / 100;
    if (y <= -1) return -1;
    return Math.pow(1 + y, 1 / 12) - 1;
  }

  /* ------------------------------------------------------------------ *
   * Ana hesap
   * ------------------------------------------------------------------ */
  function karsilastir(girdi) {
    girdi = girdi || {};

    var evFiyati = sayi(girdi.evFiyati);
    var pesinatYuzde = sayi(girdi.pesinatYuzde);
    var yilSayisi = Math.max(1, Math.floor(sayi(girdi.yilSayisi)));
    var vadeAy = Math.max(1, Math.round(sayi(girdi.vadeAy)));

    var enflasyon = sayi(girdi.enflasyonYuzde);
    var evArtis = sayi(girdi.evDegerArtisYuzde);
    var kiraArtis = sayi(girdi.kiraArtisYuzde);
    var yatirimGetiri = sayi(girdi.yatirimGetiriYuzde);

    var oran = function (y) { return aylikOran(y); };
    var yatirimAylik = oran(yatirimGetiri);

    var pesinatK = Math.round(kurusaCevir(evFiyati) * pesinatYuzde / 100);
    var krediTL = kurus(kurusaCevir(evFiyati) - pesinatK);

    /* Alım masrafları: tapu harcı + komisyon (+KDV komisyona dahil kabul
       edilir; oranı girdiden gelir). Bu para geri dönmez. */
    var alimMasrafK = Math.round(kurusaCevir(evFiyati) *
      (sayi(girdi.tapuHarciYuzde === undefined ? VARSAYILAN.tapuHarciYuzde : girdi.tapuHarciYuzde) +
       sayi(girdi.komisyonYuzde === undefined ? VARSAYILAN.komisyonYuzde : girdi.komisyonYuzde)) / 100);

    var plan = Kredi.plan({
      anapara: krediTL,
      vade: vadeAy,
      aylikFaiz: sayi(girdi.aylikFaizYuzde),
      kkdf: sayi(girdi.kkdf === undefined ? VARSAYILAN.kkdf : girdi.kkdf),
      bsmv: sayi(girdi.bsmv === undefined ? VARSAYILAN.bsmv : girdi.bsmv),
      tahsisYuzde: sayi(girdi.tahsisYuzde)
    });

    /* Kiracı, alıcının ilk gün cebinden çıkardığı parayı yatırır.
       Bu tek satır, hesabın dürüst olup olmadığını belirler. */
    var kiraciPortfoyK = pesinatK + alimMasrafK;
    var aliciPortfoyK = 0;

    var evDegeriK = kurusaCevir(evFiyati);
    var kiraK = kurusaCevir(girdi.aylikKira);
    var emlakVergisiYillikK = Math.round(evDegeriK *
      sayi(girdi.emlakVergisiBinde === undefined ? VARSAYILAN.emlakVergisiBinde : girdi.emlakVergisiBinde) / 1000);
    var bakimYillikK = Math.round(evDegeriK *
      sayi(girdi.bakimYuzde === undefined ? VARSAYILAN.bakimYuzde : girdi.bakimYuzde) / 100);
    var sigortaYillikK = kurusaCevir(
      girdi.sigortaYillik === undefined ? VARSAYILAN.sigortaYillik : girdi.sigortaYillik);

    var satisKomisyonOran =
      sayi(girdi.satisKomisyonYuzde === undefined ? VARSAYILAN.satisKomisyonYuzde : girdi.satisKomisyonYuzde) / 100;

    var yillar = [];
    var toplamKiraK = 0, toplamTaksitK = 0, toplamFaizK = 0, toplamSahiplikGiderK = 0;
    var basabasYil = 0;

    for (var y = 1; y <= yilSayisi; y++) {
      var yilKiraK = 0, yilAliciGiderK = 0;

      for (var m = 0; m < 12; m++) {
        var ay = (y - 1) * 12 + m;                 // 0 tabanlı
        var satir = ay < plan.satirlar.length ? plan.satirlar[ay] : null;
        var taksitK = satir ? kurusaCevir(satir.aylikOdeme) : 0;
        if (satir) toplamFaizK += kurusaCevir(satir.faiz);

        var sahiplikK = Math.round(emlakVergisiYillikK / 12) +
                        Math.round(bakimYillikK / 12) +
                        Math.round(sigortaYillikK / 12);
        var aliciGiderK = taksitK + sahiplikK;
        var kiraciGiderK = kiraK;

        yilKiraK += kiraciGiderK;
        yilAliciGiderK += aliciGiderK;
        toplamTaksitK += taksitK;
        toplamSahiplikGiderK += sahiplikK;

        /* FARK YATIRILIR — az ödeyen taraf aradaki parayı değerlendirir. */
        var fark = aliciGiderK - kiraciGiderK;
        if (fark > 0) kiraciPortfoyK += fark;
        else aliciPortfoyK += -fark;

        kiraciPortfoyK = Math.round(kiraciPortfoyK * (1 + yatirimAylik));
        aliciPortfoyK = Math.round(aliciPortfoyK * (1 + yatirimAylik));
      }

      toplamKiraK += yilKiraK;

      /* Yıl dönümünde: kira yasal tavana göre, ev değeri kendi hızıyla,
         sahiplik giderleri enflasyonla artar. */
      kiraK = Math.round(kiraK * (1 + kiraArtis / 100));
      evDegeriK = Math.round(evDegeriK * (1 + evArtis / 100));
      emlakVergisiYillikK = Math.round(emlakVergisiYillikK * (1 + enflasyon / 100));
      bakimYillikK = Math.round(bakimYillikK * (1 + enflasyon / 100));
      sigortaYillikK = Math.round(sigortaYillikK * (1 + enflasyon / 100));

      var gecenAy = y * 12;
      var kalanKrediK = gecenAy - 1 < plan.satirlar.length
        ? kurusaCevir(plan.satirlar[gecenAy - 1].kalan) : 0;
      var satisMasrafK = Math.round(evDegeriK * satisKomisyonOran);

      var aliciServetK = evDegeriK - kalanKrediK + aliciPortfoyK - satisMasrafK;
      var kiraciServetK = kiraciPortfoyK;
      var bolen = Math.pow(1 + enflasyon / 100, y);

      if (!basabasYil && aliciServetK >= kiraciServetK) basabasYil = y;

      yillar.push({
        yil: y,
        evDegeri: kurus(evDegeriK),
        kalanKredi: kurus(kalanKrediK),
        aliciPortfoy: kurus(aliciPortfoyK),
        kiraciPortfoy: kurus(kiraciPortfoyK),
        aliciServet: kurus(aliciServetK),
        kiraciServet: kurus(kiraciServetK),
        aliciServetReel: kurus(Math.round(aliciServetK / bolen)),
        kiraciServetReel: kurus(Math.round(kiraciServetK / bolen)),
        fark: kurus(aliciServetK - kiraciServetK),
        aylikKira: kurus(Math.round(yilKiraK / 12)),
        aylikAliciGider: kurus(Math.round(yilAliciGiderK / 12))
      });
    }

    var son = yillar[yillar.length - 1];
    var kazanan = son.aliciServet > son.kiraciServet ? "satinal"
                : son.aliciServet < son.kiraciServet ? "kira" : "esit";

    return {
      gecerli: plan.gecerli !== false,
      pesinat: kurus(pesinatK),
      krediTutari: kurus(kurusaCevir(evFiyati) - pesinatK),
      alimMasrafi: kurus(alimMasrafK),
      /* İlk gün cebinizden çıkan toplam — kiracının yatırdığı tutar da bu. */
      ilkGunNakit: kurus(pesinatK + alimMasrafK),
      aylikTaksit: plan.taksit,
      yillar: yillar,
      basabasYil: basabasYil,
      kazanan: kazanan,
      fark: son.fark,
      farkReel: kurus(son.aliciServetReel - son.kiraciServetReel),
      toplamKira: kurus(toplamKiraK),
      toplamTaksit: kurus(toplamTaksitK),
      toplamFaiz: kurus(toplamFaizK),
      toplamSahiplikGideri: kurus(toplamSahiplikGiderK),
      /* Geri dönmeyen para: faiz + alım/satım masrafı + sahiplik gideri.
         Kiracının "boşa giden" parası ise ödediği kiradır. Karşılaştırma
         asıl burada anlam kazanıyor. */
      geriDonmeyen: kurus(toplamFaizK + alimMasrafK + toplamSahiplikGiderK)
    };
  }

  /* ------------------------------------------------------------------ *
   * Başabaş kira: hangi kirada iki yol eşitlenir?
   *
   * Kira arttıkça kiralamak pahalılaşır, yani alıcının serveti göreli
   * olarak iyileşir. Aradığımız, N. yılda iki servetin eşitlendiği kira.
   * Tek yönlü bir ilişki olduğu için ikiye bölerek çözülüyor.
   * ------------------------------------------------------------------ */
  function basabasKira(girdi) {
    function fark(kira) {
      var g = {};
      for (var k in girdi) if (Object.prototype.hasOwnProperty.call(girdi, k)) g[k] = girdi[k];
      g.aylikKira = kira;
      var s = karsilastir(g);
      return s.yillar[s.yillar.length - 1].fark;   // alıcı − kiracı
    }
    /* Kira 0 iken kiralamak en ucuz: fark negatif olmalı. Kira büyüdükçe
       fark artar. Kök arıyoruz. */
    var alt = 0, ust = Math.max(1000, sayi(girdi.aylikKira) * 4), guvenlik = 0;
    if (fark(alt) > 0) return { kira: 0, bulundu: false, sebep: "kirasiz-bile-alici-onde" };
    while (fark(ust) < 0 && guvenlik++ < 40) ust *= 2;
    if (fark(ust) < 0) return { kira: 0, bulundu: false, sebep: "ulasilamaz" };
    /* 80 sabit adım gereksizdi: her adım tam bir karşılaştırma koşturuyor
       ve arayüzde her tuş vuruşunda çalışıyor (ölçüm: 243 ms — gözle
       görülür takılma). Aradığımız kesinlik yarım kuruş; aralık o kadar
       daralınca durmak yeterli. Tipik aralıkta ~25 adımda bitiyor,
       üst sınır güvenlik için duruyor. */
    for (var i = 0; i < 60 && (ust - alt) > 0.005; i++) {
      var orta = (alt + ust) / 2;
      if (fark(orta) < 0) alt = orta; else ust = orta;
    }
    return { kira: kurus(Math.round(ust * 100)), bulundu: true };
  }

  /* ------------------------------------------------------ duyarlılık ızgarası
   *
   * NEDEN: başabaş YILI ve başabaş KİRASI tek boyutlu cevaplar. Gerçek soru
   * iki boyutlu: "ev şu kadar değerlenir VE yatırım bu kadar getirirse hangi
   * taraf kazanır?" Bu iki parametre birbirini götürebiliyor — yüksek değer
   * artışı, yüksek yatırım getirisiyle nötrleşiyor. Tek bir senaryo bunu
   * gösteremez; karar YÜZEYİ gerekiyor.
   *
   * Izgara, her hücrede TAM hesabı yeniden koşuyor. Yaklaşık bir formül
   * kullanmıyoruz: masraflar, kira tavanı ve amortisman doğrusal değil,
   * enterpolasyon yanlış sınır çizdirirdi.
   *
   * Doner: { x, y, hucreler, sinirVar } — hücre değeri REEL fark (alıcı −
   * kiracı, bugünün parasıyla). Pozitif: satın alma önde.
   */
  function duyarlilik(girdi, secenek) {
    secenek = secenek || {};
    var xAlan = secenek.xAlan || "evDegerArtisYuzde";
    var yAlan = secenek.yAlan || "yatirimGetiriYuzde";
    var xler = secenek.x || [0, 10, 20, 30, 40, 50, 60];
    var yler = secenek.y || [0, 10, 20, 30, 40, 50, 60];

    var hucreler = [], enBuyuk = 0, artiVar = false, eksiVar = false;

    for (var j = 0; j < yler.length; j++) {
      var satir = [];
      for (var i = 0; i < xler.length; i++) {
        var g = {};
        for (var k in girdi) if (Object.prototype.hasOwnProperty.call(girdi, k)) g[k] = girdi[k];
        g[xAlan] = xler[i];
        g[yAlan] = yler[j];
        var r = karsilastir(g);
        var d = (r && r.gecerli) ? r.farkReel : null;
        if (d !== null) {
          if (d > 0) artiVar = true; else if (d < 0) eksiVar = true;
          if (Math.abs(d) > enBuyuk) enBuyuk = Math.abs(d);
        }
        satir.push({ x: xler[i], y: yler[j], deger: d, kazanan: d === null ? null : (d >= 0 ? "alici" : "kiraci") });
      }
      hucreler.push(satir);
    }

    return {
      xAlan: xAlan, yAlan: yAlan, x: xler, y: yler,
      hucreler: hucreler,
      enBuyukMutlak: enBuyuk,
      /* Sınır YOKSA karar bu aralıkta hiç dönmüyor demektir; arayüz bunu
         söylemeli, yoksa kullanıcı "sınır nerede" diye boşuna arar. */
      sinirVar: artiVar && eksiVar
    };
  }

  return {
    VARSAYILAN: VARSAYILAN,
    sayi: sayi,
    aylikOran: aylikOran,
    karsilastir: karsilastir,
    basabasKira: basabasKira,
    duyarlilik: duyarlilik
  };
});
