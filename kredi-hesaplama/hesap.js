/*!
 * Kredi Çekirdeği — Türkiye tüketici ve konut kredisi maliyet hesabı
 *
 * Bağımlılıksız. Hem tarayıcıda (window.Kredi) hem Node'da (require) çalışır.
 *
 * NEDEN AYRI BİR ÇEKİRDEK:
 * Bu aracın tek iddiası şu: bankanın ilan ettiği aylık faiz, ödeyeceğiniz
 * maliyet değildir. Aradaki farkı üreten üç şey var — faize eklenen KKDF ve
 * BSMV, aylık faizin yıllık BİLEŞİK karşılığı, ve masrafların krediyi
 * küçültmesi. Bu üçü de aritmetiktir; aritmetik sessizce yanlış olabildiği
 * için DOM'dan ayrı tutuluyor ve test ediliyor.
 *
 * VARSAYILAN ORANLAR HAKKINDA:
 * KKDF ve BSMV oranları Cumhurbaşkanı kararıyla değişebilir ve kredi türüne
 * göre farklıdır. Bu yüzden kodda sabit DEĞİL, girdi olarak alınıyorlar;
 * arayüz varsayılan gösterir ama kullanıcı kendi sözleşmesindeki oranı girer.
 * Çekirdek hangi oranı verirseniz onunla doğru hesaplar.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/kredi-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Kredi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Kredi türleri ve tipik vergi durumu.
     Konut kredisi KKDF ve BSMV'den istisnadır; tüketici (ihtiyaç) ve taşıt
     kredilerinde ikisi de uygulanır. Oranlar arayüzde düzenlenebilir. */
  var TURLER = [
    { ad: "ihtiyac", etiket: "İhtiyaç kredisi", kkdf: 15, bsmv: 15 },
    { ad: "tasit", etiket: "Taşıt kredisi", kkdf: 15, bsmv: 15 },
    { ad: "konut", etiket: "Konut kredisi", kkdf: 0, bsmv: 0 },
    { ad: "ticari", etiket: "Ticari kredi", kkdf: 0, bsmv: 5 }
  ];

  function turBilgi(ad) {
    for (var i = 0; i < TURLER.length; i++) if (TURLER[i].ad === ad) return TURLER[i];
    return TURLER[0];
  }

  /* ------------------------------------------------------------ sayı ---- */

  function sayi(deger) {
    if (typeof deger === "number") return isFinite(deger) ? deger : 0;
    var s = String(deger == null ? "" : deger).trim();
    if (!s) return 0;
    /* "1.234,56" ve "1234.56" biçimlerinin ikisi de kabul edilir; virgül
       yoksa ve noktalar üçlü grup ayırıyorsa nokta binlik ayracıdır. */
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function kurus(n) { return Math.round(n * 100) / 100; }

  /* -------------------------------------------------------- annüite ---- */

  /**
   * Eşit taksitli (annüite) kredide aylık taksit.
   *   T = A · r / (1 − (1+r)^−n)
   * r burada SAF faiz değil, vergilerle brütleşmiş aylık maliyet oranıdır.
   * Faiz sıfırsa formül tanımsız olur; taksit anaparanın vadeye bölümüdür.
   */
  function taksit(anapara, aylikOran, vade) {
    if (vade <= 0) return 0;
    if (aylikOran === 0) return anapara / vade;
    return anapara * aylikOran / (1 - Math.pow(1 + aylikOran, -vade));
  }

  /**
   * Vergiyle brütleşmiş aylık maliyet oranı.
   *
   * Aylık faiz kalan anaparaya işler; o faizin üzerinden KKDF ve BSMV alınır.
   * Dolayısıyla o ay paranın gerçek bedeli faiz × (1 + kkdf + bsmv) olur ve
   * amortisman bu oranla kurulur. Türkiye'de bankaların taksiti böyle
   * hesaplamasının sebebi budur.
   */
  function brutOran(aylikFaizYuzde, kkdfYuzde, bsmvYuzde) {
    var i = sayi(aylikFaizYuzde) / 100;
    var k = sayi(kkdfYuzde) / 100;
    var b = sayi(bsmvYuzde) / 100;
    return i * (1 + k + b);
  }

  /* ------------------------------------------------- ödeme planı ------- */

  /**
   * girdi: {
   *   anapara, aylikFaiz (%), vade (ay), kkdf (%), bsmv (%),
   *   tahsisOran (%), tahsisTutar (TL), sigortaPesin (TL),
   *   sigortaAylik (TL), digerMasraf (TL)
   * }
   */
  function plan(girdi) {
    girdi = girdi || {};
    var A = sayi(girdi.anapara);
    var n = Math.round(sayi(girdi.vade));
    var faizY = sayi(girdi.aylikFaiz);
    var kkdfY = sayi(girdi.kkdf);
    var bsmvY = sayi(girdi.bsmv);

    if (A <= 0 || n <= 0) {
      return bosPlan(A, n);
    }

    var i = faizY / 100;
    var k = kkdfY / 100;
    var b = bsmvY / 100;
    var r = brutOran(faizY, kkdfY, bsmvY);

    var sigortaAylik = sayi(girdi.sigortaAylik);
    var satirlar = [];
    var toplamFaiz = 0, toplamKkdf = 0, toplamBsmv = 0;

    /* AMORTİSMAN KURUŞ TAMSAYISI ÜZERİNDE YÜRÜR.
       Ondalıkla çalışıp her hücreyi ayrı yuvarlayınca satır kendi içinde
       tutmuyordu: faiz + KKDF + BSMV + anapara, taksitten 1-2 kuruş
       sapıyordu. Kullanıcıya gösterilen bir ödeme planında bu görünür bir
       tutarsızlıktır. Tamsayı kuruşta her satır tam kapanıyor ve anapara
       payları toplamı anaparaya kuruşu kuruşuna eşit oluyor. */
    var kalanK = Math.round(A * 100);
    var taksitK = Math.round(taksit(A, r, n) * 100);
    var sigortaK = Math.round(sigortaAylik * 100);

    for (var ay = 1; ay <= n; ay++) {
      var maliyetK = Math.round(kalanK * r);
      var faizK = Math.round(maliyetK / (1 + k + b));
      var kkdfK = Math.round(faizK * k);
      var bsmvK = Math.round(faizK * b);
      /* Artık kuruş faize yazılıyor: en büyük kalem olduğu için oransal
         sapması en küçük olan odur ve satır böylece tam kapanır. */
      faizK = maliyetK - kkdfK - bsmvK;

      var buTaksitK = taksitK;
      var anaparaK = buTaksitK - maliyetK;

      /* Son taksit kalanı sıfırlar; aksi halde plan birkaç kuruş borçla
         biterdi. */
      if (ay === n) {
        anaparaK = kalanK;
        buTaksitK = anaparaK + maliyetK;
      }

      kalanK -= anaparaK;

      toplamFaiz += faizK;
      toplamKkdf += kkdfK;
      toplamBsmv += bsmvK;

      satirlar.push({
        ay: ay,
        taksit: buTaksitK / 100,
        faiz: faizK / 100,
        kkdf: kkdfK / 100,
        bsmv: bsmvK / 100,
        anapara: anaparaK / 100,
        sigorta: sigortaK / 100,
        aylikOdeme: (buTaksitK + sigortaK) / 100,
        kalan: kalanK / 100
      });
    }
    toplamFaiz /= 100; toplamKkdf /= 100; toplamBsmv /= 100;

    /* Peşin masraflar: krediden düşülür ya da ayrıca ödenir; her iki halde
       de maliyettir ve YMO hesabına girer. */
    var tahsis = sayi(girdi.tahsisTutar) + A * sayi(girdi.tahsisOran) / 100;
    var pesinMasraf = tahsis + sayi(girdi.sigortaPesin) + sayi(girdi.digerMasraf);
    var aylikMasrafToplam = sigortaAylik * n;

    var taksitToplam = satirlar.reduce(function (t, s) { return t + s.taksit; }, 0);
    var toplamGeriOdeme = taksitToplam + pesinMasraf + aylikMasrafToplam;

    var oranlar = ymo(A, satirlar, pesinMasraf, sigortaAylik);

    return {
      gecerli: true,
      anapara: kurus(A),
      vade: n,
      aylikFaiz: faizY,
      aylikMaliyetOrani: r * 100,
      taksit: kurus(satirlar[0].taksit),
      aylikOdeme: kurus(satirlar[0].taksit + sigortaAylik),
      sonTaksit: kurus(satirlar[n - 1].taksit),
      satirlar: satirlar,
      toplamFaiz: kurus(toplamFaiz),
      toplamKkdf: kurus(toplamKkdf),
      toplamBsmv: kurus(toplamBsmv),
      toplamVergi: kurus(toplamKkdf + toplamBsmv),
      pesinMasraf: kurus(pesinMasraf),
      aylikMasrafToplam: kurus(aylikMasrafToplam),
      toplamMasraf: kurus(pesinMasraf + aylikMasrafToplam),
      taksitToplam: kurus(taksitToplam),
      toplamGeriOdeme: kurus(toplamGeriOdeme),
      toplamMaliyet: kurus(toplamGeriOdeme - A),
      eleGecen: kurus(A - pesinMasraf),
      ymoAylik: oranlar.aylik * 100,
      ymoYillik: oranlar.yillik * 100,
      basitYillik: faizY * 12,
      /* Bankanın ilan ettiği "yıllık" ile gerçek maliyet arasındaki fark. */
      fark: oranlar.yillik * 100 - faizY * 12
    };
  }

  function bosPlan(A, n) {
    return {
      gecerli: false, anapara: A || 0, vade: n || 0, aylikFaiz: 0,
      aylikMaliyetOrani: 0, taksit: 0, aylikOdeme: 0, sonTaksit: 0, satirlar: [],
      toplamFaiz: 0, toplamKkdf: 0, toplamBsmv: 0, toplamVergi: 0,
      pesinMasraf: 0, aylikMasrafToplam: 0, toplamMasraf: 0, taksitToplam: 0,
      toplamGeriOdeme: 0, toplamMaliyet: 0, eleGecen: 0,
      ymoAylik: 0, ymoYillik: 0, basitYillik: 0, fark: 0
    };
  }

  /* ------------------------------------------------------------ YMO ---- */

  /**
   * Yıllık maliyet oranı: bütün nakit akışlarını bugüne eşitleyen orandır.
   *
   * Aylık faizi 12 ile çarpmak YANLIŞTIR ve bankaların ilan ettiği rakamla
   * ödediğiniz tutar arasındaki farkın büyük bölümü buradan gelir: faiz
   * bileşikleşir. Ayrıca peşin masraf krediyi küçülttüğü için aynı taksiti
   * daha az paraya ödersiniz — bu da oranı yükseltir.
   *
   * Çözüm ikiye bölme ile bulunuyor: Newton yöntemi kötü başlangıçta
   * ıraksayabiliyor, ikiye bölme her zaman yakınsıyor ve hız burada sorun değil.
   */
  function ymo(anapara, satirlar, pesinMasraf, sigortaAylik) {
    var net = anapara - pesinMasraf;
    if (net <= 0 || !satirlar.length) return { aylik: 0, yillik: 0 };

    function bugunkuDeger(r) {
      var t = -net;
      for (var i = 0; i < satirlar.length; i++) {
        var odeme = satirlar[i].taksit + sigortaAylik;
        t += odeme / Math.pow(1 + r, i + 1);
      }
      return t;
    }

    /* Fonksiyon oranla birlikte AZALIR: oran yükseldikçe indirgenmiş
       ödemelerin toplamı küçülür. r = 0'da değer pozitiftir (toplam ödeme,
       ele geçenden fazladır); yeterince büyük r'de negatife döner. Kök bu
       ikisinin arasındadır. Aramayı ters yönde kurmak YMO'yu sıfır
       döndürüyordu ve hata sessizdi: sayfa açılıyor, oran 0 görünüyordu. */
    var alt = 0, ust = 1;
    var guvenlik = 0;
    while (bugunkuDeger(ust) > 0 && guvenlik++ < 60) ust *= 2;
    if (bugunkuDeger(ust) > 0) return { aylik: 0, yillik: 0 };

    for (var k = 0; k < 200; k++) {
      var orta = (alt + ust) / 2;
      if (bugunkuDeger(orta) > 0) alt = orta; else ust = orta;
    }
    var aylik = (alt + ust) / 2;
    return { aylik: aylik, yillik: Math.pow(1 + aylik, 12) - 1 };
  }

  /* ------------------------------------------------- erken kapama ------ */

  /**
   * Belirli bir taksit ödendikten sonra krediyi kapatmanın bedeli.
   *
   * Kalan anapara ödenir; kalan taksitlerin İÇİNDEKİ faiz ve vergiden
   * kurtulursunuz. Konut kredilerinde erken ödeme tazminatı uygulanabilir;
   * oranı girdi olarak alınıyor çünkü kalan vadeye göre değişir.
   */
  function erkenKapama(p, ay, tazminatOran) {
    if (!p.gecerli || ay < 1 || ay > p.satirlar.length) return null;
    var satir = p.satirlar[ay - 1];
    var kalanAnapara = satir.kalan;
    var tazminat = kalanAnapara * sayi(tazminatOran) / 100;

    var odenmis = 0, kalanTaksit = 0;
    for (var i = 0; i < p.satirlar.length; i++) {
      if (i < ay) odenmis += p.satirlar[i].taksit;
      else kalanTaksit += p.satirlar[i].taksit;
    }
    /* Kaçınılan yük: ödenmeyecek taksitlerin toplamı eksi kapatılan anapara. */
    var kacinilan = kalanTaksit - kalanAnapara - tazminat;

    return {
      ay: ay,
      kalanAnapara: kurus(kalanAnapara),
      tazminat: kurus(tazminat),
      kapamaTutari: kurus(kalanAnapara + tazminat),
      odenmisTaksit: kurus(odenmis),
      kalanTaksitToplami: kurus(kalanTaksit),
      kacinilanMaliyet: kurus(kacinilan),
      toplamOdenen: kurus(odenmis + kalanAnapara + tazminat + p.pesinMasraf)
    };
  }

  /* --------------------------------------------------- ek ödeme -------- */

  /**
   * Her ay taksitin üstüne sabit bir tutar ödemenin etkisi.
   *
   * Ek ödeme doğrudan anaparadan düşer; kalan azaldıkça faiz de azalır ve
   * kredi erken biter. Kaç ay erken bittiğini ve ne kadar tasarruf edildiğini
   * hesaplar. Bankalar bunu genellikle "ara ödeme" olarak işler.
   */
  function ekOdeme(girdi, aylikEk) {
    var temel = plan(girdi);
    if (!temel.gecerli) return null;
    var ek = sayi(aylikEk);
    if (ek <= 0) {
      return { gecerli: false, kisalanAy: 0, tasarruf: 0, yeniVade: temel.vade,
               temel: temel };
    }

    var r = brutOran(girdi.aylikFaiz, girdi.kkdf, girdi.bsmv);
    var T = temel.satirlar[0].taksit;
    var kalan = temel.anapara;
    var odenen = 0, ay = 0;
    var sinir = temel.vade * 2 + 12;

    while (kalan > 0.005 && ay < sinir) {
      ay += 1;
      var maliyet = kalan * r;
      var odeme = T + ek;
      var anaparaPayi = odeme - maliyet;
      if (anaparaPayi >= kalan) {
        odeme = kalan + maliyet;
        anaparaPayi = kalan;
      }
      kalan -= anaparaPayi;
      odenen += odeme;
    }

    var temelOdenen = temel.taksitToplam;
    return {
      gecerli: true,
      yeniVade: ay,
      kisalanAy: temel.vade - ay,
      yeniToplam: kurus(odenen),
      eskiToplam: kurus(temelOdenen),
      tasarruf: kurus(temelOdenen - odenen),
      aylikEk: kurus(ek),
      temel: temel
    };
  }

  /* ------------------------------------------------ karşılaştırma ------ */

  /**
   * İki teklifi karşılaştırır. Kıyasın doğru ölçütü taksit değil YMO'dur:
   * daha düşük faizli ama masraflı bir kredi, daha pahalı olabilir.
   */
  function karsilastir(a, b) {
    var pa = plan(a), pb = plan(b);
    if (!pa.gecerli || !pb.gecerli) return null;
    var kazanan = pa.ymoYillik === pb.ymoYillik ? null
      : (pa.ymoYillik < pb.ymoYillik ? "a" : "b");
    return {
      a: pa, b: pb, kazanan: kazanan,
      ymoFarki: kurus(Math.abs(pa.ymoYillik - pb.ymoYillik)),
      maliyetFarki: kurus(Math.abs(pa.toplamGeriOdeme - pb.toplamGeriOdeme)),
      /* Taksiti ucuz olan her zaman toplamda ucuz değildir; bu iki ölçüt
         ayrıştığında kullanıcıya söylemek gerekiyor. */
      taksitYaniltiyor: (pa.taksit < pb.taksit) !== (pa.toplamGeriOdeme < pb.toplamGeriOdeme)
    };
  }

  return {
    surum: "1.0.0",
    TURLER: TURLER,
    turBilgi: turBilgi,
    sayi: sayi,
    taksit: taksit,
    brutOran: brutOran,
    plan: plan,
    erkenKapama: erkenKapama,
    ekOdeme: ekOdeme,
    karsilastir: karsilastir
  };
});
