/*!
 * Finansal Emniyet Çekirdeği — Türkiye
 *
 * BU ARAÇ NE HESAPLAR: "karşılayabilir miyim" değil, "karşıladıktan sonra
 * kötü bir senaryoda hâlâ ayakta mıyım".
 *
 *     Karşılanabilir  !=  Güvenli
 *
 * Aylık 100.000 kazanan, 500.000 birikimi olan biri 300.000'lik bir
 * harcamayı teknik olarak KARŞILAYABİLİR. Ama zorunlu gideri 60.000 ise
 * geriye 3,3 aylık dayanma süresi kalır. Birinci cümle doğru, ikinci cümle
 * kararı verir. Bu çekirdek ikinci cümleyi hesaplar.
 *
 * ÜÇ KAVRAM AYRI TUTULUYOR — kaynak spesifikasyonda birbirine karışıyorlar:
 *
 *  1) NAKİT TABANI, gönüllü kararlar için bir sınırdır. "Bu parayı isteyerek
 *     harcarsam altına inmemeliyim" çizgisi.
 *  2) ŞOK HAYATTA KALMA, tabanın altına inip inmemek DEĞİLDİR. Acil fon tam
 *     da acil durumda harcanmak içindir; şokta onu harcamayı başarısızlık
 *     saymak fonu iki kez saymak olur. Ölçüt: nakit sıfırın altına düşüyor mu.
 *  3) SERVET, sonuç değil girdidir. İki hane aynı net değere sahip olup
 *     bambaşka kırılganlıkta olabilir; bu yüzden net değer skorda yok.
 *
 * TÜRKİYE'YE ÖZGÜ İKİ AYAR:
 *
 *  - FAİZ ŞOKU MEVCUT BORCU ÇOĞUNLUKLA VURMAZ. Türkiye'de tüketici ve taşıt
 *    kredileri sabit faizlidir; imzalandıktan sonra taksit değişmez. Faiz
 *    şoku yalnızca DEĞİŞKEN faizli paya (kredi kartı, KMH, bazı ticari
 *    krediler) uygulanır ve varsayılan payı sıfırdır. Faiz artışının asıl
 *    zararı YENİ borçlanmadadır — o da karar tarafında zaten fiyatlanıyor.
 *  - KUR ŞOKU AYRI BİR SENARYODUR. Dövizli borcu olan bir hane için kur,
 *    gelir şokundan daha olası ve daha sert bir risktir; net döviz açığı
 *    ayrıca raporlanır.
 *
 * Kredi taksiti BURADA YENİDEN YAZILMIYOR: sitenin kredi çekirdeği
 * çağrılıyor (KKDF ve BSMV dahil). Aynı formülün iki tanımı olamaz.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-emniyet-testi/
 */
(function (root, factory) {
  "use strict";
  var K = (typeof module === "object" && module.exports)
    ? require("../kredi-hesaplama/hesap.js")
    : root.Kredi;   /* kredi cekirdegi tarayicida root.Kredi olarak yayiliyor */
  var v = factory(K);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Emniyet = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Kredi) {
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

  function art(n) { return Math.max(0, sayi(n)); }
  function oran(n) { return Math.max(0, Math.min(1, sayi(n) / 100)); }

  /* ------------------------------------------------------------------ *
   * LİKİDİTE KATSAYILARI — SEÇİLMİŞ PARAMETRELER, EVRENSEL DOĞRU DEĞİL
   *
   * Bunlar zorla nakde çevirme sürtünmesidir: makas, zamanlama, komisyon.
   * Piyasa değer kaybı AYRI modellenir (senaryonun varlık şoku), yoksa aynı
   * risk iki kez sayılır. Bu yüzden katsayılar bilerek 1'e yakın.
   *
   * İLLİKİT VARLIK DAYANMA SÜRESİNE HİÇ GİRMEZ (katsayı 0). Gayrimenkul
   * altı ayda satılmaz; altı aylık bir krizi fonlayamaz. Kaynak spesifikasyon
   * konut sermayesine 0,40 veriyor — o katsayı "kaynak" hesabı içindir,
   * "dayanma süresi" hesabı için değil. İkisini karıştırmak, likit olmayan
   * bir haneye likit görüntüsü verir.
   * ------------------------------------------------------------------ */
  var LIKIDITE = { nakit: 1.00, altinDoviz: 0.97, yatirim: 0.93, illikit: 0.00 };

  /* Puan eğrileri. Kırılım noktaları SEÇİLMİŞTİR; bilimsel olarak kalibre
     edilmiş değildir ve öyle sunulmamalıdır. Veri biriktikçe kalibre
     edilmesi gereken yer tam olarak burasıdır. */
  var EGRI = {
    likidite:   [[0, 0], [1, 20], [3, 50], [6, 75], [9, 90], [12, 100]],
    nakitAkisi: [[-0.10, 0], [0, 10], [0.05, 30], [0.15, 60], [0.25, 80], [0.40, 100]],
    yuk:        [[0.40, 100], [0.55, 80], [0.70, 55], [0.85, 30], [1.00, 10], [1.20, 0]],
    dsr:        [[0.10, 100], [0.25, 80], [0.35, 60], [0.50, 35], [0.65, 15], [0.80, 0]]
  };

  /* Ağırlıklar. Toplamı 1 olmak zorunda; test bunu sınıyor. */
  var AGIRLIK = { likidite: 0.25, nakitAkisi: 0.20, borc: 0.20, sok: 0.25, koruma: 0.10 };

  var SEGMENT = [
    [0, 30, "Çok kırılgan"],
    [30, 50, "Kırılgan"],
    [50, 70, "Dayanıklılığa yakın"],
    [70, 101, "Dayanıklı"]
  ];

  function segment(p) {
    for (var i = 0; i < SEGMENT.length; i++) {
      if (p >= SEGMENT[i][0] && p < SEGMENT[i][1]) return SEGMENT[i][2];
    }
    return SEGMENT[SEGMENT.length - 1][2];
  }

  /* Parçalı doğrusal ara değer. Düğümler x'e göre artan sıralı; y azalabilir. */
  function egri(x, dugum) {
    if (!isFinite(x)) return x > 0 ? dugum[dugum.length - 1][1] : dugum[0][1];
    if (x <= dugum[0][0]) return dugum[0][1];
    var son = dugum.length - 1;
    if (x >= dugum[son][0]) return dugum[son][1];
    for (var i = 0; i < son; i++) {
      var a = dugum[i], b = dugum[i + 1];
      if (x >= a[0] && x <= b[0]) {
        return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0]));
      }
    }
    return dugum[son][1];
  }

  /* ------------------------------------------------------------------ *
   * SENARYOLAR
   *
   * Ağırlıklar OLABİLİRLİĞİ temsil eder, şiddeti değil: işini kaybetmek,
   * yatırımların %30 düşmesinden daha sık başa gelir. Baz senaryonun ağırlığı
   * SIFIR — şoksuz durumda ayakta kalmak bir başarı değildir; puana katılsaydı
   * herkesin skoru şişerdi.
   * ------------------------------------------------------------------ */
  var SENARYOLAR = [
    { ad: "taban", etiket: "Baz durum (şok yok)", agirlik: 0 },
    { ad: "gelir20", etiket: "Gelir %20 düşer", gelir: -0.20, agirlik: 3 },
    { ad: "gelir40", etiket: "Gelir %40 düşer", gelir: -0.40, agirlik: 2 },
    { ad: "issizlik", etiket: "6 ay işsizlik", issizlikAy: 6, agirlik: 3 },
    { ad: "gider20", etiket: "Zorunlu gider %20 artar", gider: 0.20, agirlik: 2 },
    { ad: "varlik30", etiket: "Yatırımlar %30 değer kaybeder", varlik: -0.30, agirlik: 1 },
    { ad: "kur30", etiket: "Kur %30 yükselir", kur: 0.30, agirlik: 2 },
    { ad: "birlesik", etiket: "Birleşik şok", gelir: -0.30, gider: 0.20,
      varlik: -0.25, kur: 0.20, faiz: 0.10, agirlik: 2 }
  ];

  var SURE = 12;   /* senaryo ufku: 12 ay */

  function senaryoDoldur(s) {
    return {
      ad: s.ad, etiket: s.etiket, agirlik: s.agirlik || 0,
      gelir: s.gelir || 0, gider: s.gider || 0, varlik: s.varlik || 0,
      kur: s.kur || 0, faiz: s.faiz || 0, issizlikAy: s.issizlikAy || 0,
      sure: s.sure || SURE
    };
  }

  /* ------------------------------------------------------------------ *
   * Girdi normalleştirme
   * ------------------------------------------------------------------ */
  var GELIR_TABANI = { guvenceli: 3, riskli: 4, degisken: 6 };

  function normalize(girdi) {
    var g = girdi || {};
    var d = {
      netGelir: art(g.netGelir),
      digerGelir: art(g.digerGelir),
      gelirTuru: GELIR_TABANI[g.gelirTuru] ? g.gelirTuru : "guvenceli",
      zorunluGider: art(g.zorunluGider),
      istegeBagliGider: art(g.istegeBagliGider),
      nakit: art(g.nakit),
      yatirim: art(g.yatirim),
      altinDoviz: art(g.altinDoviz),
      illikit: art(g.illikit),
      enBuyukVarlikYuzde: oran(g.enBuyukVarlikYuzde) * 100,
      borcBakiye: art(g.borcBakiye),
      borcServisi: art(g.borcServisi),
      mevcutAylikFaiz: art(g.mevcutAylikFaiz),
      dovizliBorcYuzde: oran(g.dovizliBorcYuzde) * 100,
      degiskenFaizliBorcYuzde: oran(g.degiskenFaizliBorcYuzde) * 100,
      yakinYukumluluk: art(g.yakinYukumluluk),
      kidemAy: Math.max(0, sayi(g.kidemAy)),
      issizlikOdenegi: art(g.issizlikOdenegi),
      issizlikOdenegiAy: Math.max(0, Math.round(
        g.issizlikOdenegiAy === undefined ? 6 : sayi(g.issizlikOdenegiAy))),
      saglikSigortasi: !!g.saglikSigortasi,
      borcSigortasi: !!g.borcSigortasi,
      harcamaKisintisi: g.harcamaKisintisi === undefined ? 0.70 : oran(g.harcamaKisintisi),
      dsrEsigi: g.dsrEsigi === undefined ? 0.35 : oran(g.dsrEsigi),
      sokHedefi: g.sokHedefi === undefined ? 0.80 : oran(g.sokHedefi)
    };
    /* hedefAy 0/boş ise TÜRETİLİR; kullanıcı yazdıysa yazdığı geçerlidir. */
    var yazilan = Math.round(sayi(g.hedefAy));
    d.hedefAyOtomatik = !(yazilan > 0);
    d.hedefAy = d.hedefAyOtomatik ? hedefAyOner(d) : Math.max(1, Math.min(24, yazilan));
    if (!d.hedefAyOtomatik) hedefAyOner(d);   /* gerekçe yine de üretilsin */
    return d;
  }

  /* ------------------------------------------------------------------ *
   * Hedef dayanma süresi — "3 ay mı 6 ay mı" diye SABİT verilmez
   *
   * Literatürde 3-6 ay tavsiyesi yaygın, ama tek bir sayıya indirgemek
   * yanlış: değişken gelirli, tek gelirli ve borçlu bir hane ile çift gelirli
   * kadrolu bir hane aynı tamponla aynı güvende değildir. Türetim GÖRÜNÜR ve
   * kullanıcı üzerine yazabilir.
   * ------------------------------------------------------------------ */
  function hedefAyOner(d) {
    var parcalar = [];
    var ay = GELIR_TABANI[d.gelirTuru] || 3;
    parcalar.push({ neden: "gelir türü", katki: ay });
    var toplamGelir = d.netGelir + d.digerGelir;
    if (toplamGelir > 0 && d.netGelir / toplamGelir > 0.85) {
      ay += 1; parcalar.push({ neden: "hanede tek gelir", katki: 1 });
    }
    if (toplamGelir > 0 && d.borcServisi / toplamGelir > 0.30) {
      ay += 1; parcalar.push({ neden: "borç servisi gelirin %30'unu aşıyor", katki: 1 });
    }
    ay = Math.max(2, Math.min(9, ay));
    d.hedefAyGerekce = parcalar;
    d.hedefAyOnerilen = ay;
    return ay;
  }

  /* ------------------------------------------------------------------ *
   * Temel ölçümler
   * ------------------------------------------------------------------ */
  function likit(d, varlikSok, kurSok) {
    return d.nakit * LIKIDITE.nakit
      + d.altinDoviz * LIKIDITE.altinDoviz * (1 + (kurSok || 0))
      + d.yatirim * LIKIDITE.yatirim * (1 + (varlikSok || 0))
      + d.illikit * LIKIDITE.illikit;
  }

  function olcumler(d) {
    var toplamGelir = d.netGelir + d.digerGelir;
    var yanma = d.zorunluGider + d.borcServisi;
    var L = likit(d, 0, 0);
    var yatirilabilir = d.yatirim + d.altinDoviz + d.illikit;
    var dovizBorc = d.borcBakiye * d.dovizliBorcYuzde / 100;
    var taban = yanma * d.hedefAy + d.yakinYukumluluk;

    return {
      toplamGelir: toplamGelir,
      likitVarlik: L,
      zorunluYanma: yanma,
      /* Finansal pay: normal koşullarda her ay üretilen güvenlik kapasitesi.
         İsteğe bağlı gider BİLEREK dışarıda — o, payın içinden harcanan
         kısımdır; payı yok eden bir zorunluluk değil. */
      finansalPay: toplamGelir - d.zorunluGider - d.borcServisi,
      tasarrufPayi: toplamGelir - d.zorunluGider - d.istegeBagliGider - d.borcServisi,
      menzil: yanma > 0 ? L / yanma : Infinity,
      nakitTabani: taban,
      fazlaLikidite: L - taban,
      dsr: toplamGelir > 0 ? d.borcServisi / toplamGelir : (d.borcServisi > 0 ? 1 : 0),
      yukOrani: toplamGelir > 0
        ? (d.zorunluGider + d.borcServisi) / toplamGelir
        : ((d.zorunluGider + d.borcServisi) > 0 ? 1.5 : 0),
      yogunlasma: yatirilabilir > 0 ? d.enBuyukVarlikYuzde / 100 : 0,
      /* Net döviz açığı: dövizli yükümlülük eksi dövize/altına bağlı varlık.
         Pozitifse kur yükselişi haneyi vurur. */
      kurAcikligi: dovizBorc - d.altinDoviz,
      dovizBorc: dovizBorc,
      netDeger: d.nakit + d.yatirim + d.altinDoviz + d.illikit - d.borcBakiye
    };
  }

  /* ------------------------------------------------------------------ *
   * Bir senaryonun ay ay yürütülmesi
   *
   * Başarısızlık ölçütü: NAKİT SIFIRIN ALTINA DÜŞÜYOR MU. Nakit tabanının
   * altına inmek başarısızlık değildir; acil fon zaten bunun için vardır.
   * (Kaynak spesifikasyon ikisini aynı çizgi sayıyor; o, fonu iki kez
   * saymak olur ve her haneyi olduğundan kırılgan gösterirdi.)
   * ------------------------------------------------------------------ */
  function yol(d, sen) {
    var s = senaryoDoldur(sen);
    var kasa = likit(d, s.varlik, s.kur);
    var baslangic = kasa;

    /* Faiz şoku yalnızca DEĞİŞKEN faizli paya iner ve orantısal uygulanır:
       yıllık faiz %42 iken +10 puanlık şok, o payın ödemesini ~%24 artırır.
       Sabit faizli kredilerde taksit hiç değişmez — Türkiye'de tüketici ve
       taşıt kredilerinin neredeyse tamamı böyledir. */
    var mevcutYillik = d.mevcutAylikFaiz * 12 / 100;
    var faizEtki = (s.faiz > 0 && mevcutYillik > 0.01)
      ? (d.degiskenFaizliBorcYuzde / 100) * (s.faiz / mevcutYillik)
      : 0;
    var kurEtki = (d.dovizliBorcYuzde / 100) * s.kur;
    var borcAy = d.borcServisi * (1 + kurEtki + faizEtki);

    var giderAy = d.zorunluGider * (1 + s.gider)
      + d.istegeBagliGider * (1 - d.harcamaKisintisi);

    var aylar = [], enDusuk = kasa, batisAyi = 0;

    for (var ay = 1; ay <= s.sure; ay++) {
      /* Kıdem tazminatı fesih anında toptan gelir. */
      if (ay === 1 && s.issizlikAy > 0) kasa += d.kidemAy * d.netGelir;

      var gelir;
      if (ay <= s.issizlikAy) {
        /* İşsizlikte YALNIZCA kendi geliriniz sıfırlanır; hanedeki ikinci
           gelir ayrı bir riske tabidir ve ayakta kalır. İkinci gelirin
           koruyucu sayılmasının sebebi tam olarak budur. */
        gelir = d.digerGelir + (ay <= d.issizlikOdenegiAy ? d.issizlikOdenegi : 0);
      } else {
        gelir = d.netGelir * (1 + s.gelir) + d.digerGelir;
      }

      kasa += gelir - giderAy - borcAy;
      aylar.push(kasa);
      if (kasa < enDusuk) enDusuk = kasa;
      if (kasa < 0 && !batisAyi) batisAyi = ay;
    }

    /* Kısmî kredi: 12 ayın 11'inde ayakta kalmak, 2. ayda batmakla aynı
       değildir. Puan bu yüzden ikili değil sürekli — eşiğin iki yanında
       skorun zıplamasını da önler (çözücü bu sürekliliğe dayanıyor). */
    var kalmaOrani = batisAyi ? (batisAyi - 1) / s.sure : 1;

    return {
      ad: s.ad, etiket: s.etiket, agirlik: s.agirlik, sure: s.sure,
      baslangicNakdi: baslangic, aylar: aylar,
      enDusukNakit: enDusuk, batisAyi: batisAyi,
      hayattaKaldi: !batisAyi, kalmaOrani: kalmaOrani,
      sonNakit: aylar.length ? aylar[aylar.length - 1] : baslangic,
      aylikBorcServisi: borcAy, aylikGider: giderAy
    };
  }

  function stresTesti(d) {
    var yollar = SENARYOLAR.map(function (s) { return yol(d, s); });
    var agirlikli = 0, agirlikToplam = 0, gecen = 0, sayilan = 0;
    yollar.forEach(function (y) {
      if (!y.agirlik) return;
      agirlikToplam += y.agirlik;
      agirlikli += y.agirlik * y.kalmaOrani;
      sayilan++;
      if (y.hayattaKaldi) gecen++;
    });
    return {
      yollar: yollar,
      /* Kullanıcıya gösterilen sayı İKİLİ (7/10 gibi) — anlaşılır olan bu.
         Skorda kullanılan sayı KISMÎ kredili. İkisi bilerek farklı. */
      gecenSenaryo: gecen,
      senaryoSayisi: sayilan,
      hayattaKalmaOrani: sayilan ? gecen / sayilan : 1,
      agirlikliDayanim: agirlikToplam ? agirlikli / agirlikToplam : 1
    };
  }

  /* ------------------------------------------------------------------ *
   * Koruma katmanı
   *
   * Geçersiz maddeler paydadan DÜŞER: borcu olmayan birine "kredi hayat
   * sigortan yok" diye puan kırmak yanlış olurdu.
   * ------------------------------------------------------------------ */
  function korumaPuani(d) {
    var toplamGelir = d.netGelir + d.digerGelir;
    var maddeler = [
      { ad: "Sağlık sigortası", gecerli: true, saglandi: d.saglikSigortasi,
        not: "Tek kalemde tamponu silen sağlık gideri, korunmamış hanelerin en sık kırılma noktası." },
      { ad: "Gelir çeşitliliği", gecerli: true,
        saglandi: toplamGelir > 0 && d.digerGelir / toplamGelir >= 0.20,
        not: "Hane gelirinin en az %20'si ikinci bir kaynaktan geliyor." },
      { ad: "İşsizlik güvencesi", gecerli: true,
        saglandi: d.kidemAy >= 3 || d.issizlikOdenegi > 0,
        not: "Kıdem tazminatı ya da işsizlik ödeneği, gelir kesildiğinde köprü kurar." },
      { ad: "Kredi hayat sigortası", gecerli: d.borcBakiye > 0, saglandi: d.borcSigortasi,
        not: "Borç varken, borçlunun başına gelenin borcu haneye yıkmaması için." }
    ];
    var gecerli = 0, saglanan = 0;
    maddeler.forEach(function (m) {
      if (!m.gecerli) return;
      gecerli++; if (m.saglandi) saglanan++;
    });
    return {
      maddeler: maddeler,
      puan: gecerli ? (saglanan / gecerli) * 100 : 100,
      saglanan: saglanan, gecerli: gecerli
    };
  }

  function bayrak(deger, orta, yuksek) {
    if (deger >= yuksek) return { seviye: "yuksek", etiket: "Yüksek", deger: deger };
    if (deger >= orta) return { seviye: "orta", etiket: "Orta", deger: deger };
    return { seviye: "dusuk", etiket: "Düşük", deger: deger };
  }

  /* ------------------------------------------------------------------ *
   * Emniyet skoru — TEK SAYI DEĞİL, BEŞ BİLEŞEN
   * ------------------------------------------------------------------ */
  function skor(d) {
    var o = olcumler(d);
    var st = stresTesti(d);
    var kor = korumaPuani(d);

    var likiditeP = egri(o.menzil, EGRI.likidite);
    var akisP = egri(o.toplamGelir > 0 ? o.finansalPay / o.toplamGelir : -1, EGRI.nakitAkisi);
    /* Borç puanı iki ölçütün KÖTÜ olanıdır. Aynı borç servisi oranına sahip
       iki hane, zorunlu giderleri farklıysa aynı riskte değildir; tersi de
       doğru. Ortalama almak ikisini de gizlerdi. */
    var borcP = Math.min(egri(o.yukOrani, EGRI.yuk), egri(o.dsr, EGRI.dsr));
    var sokP = st.agirlikliDayanim * 100;

    var toplam = likiditeP * AGIRLIK.likidite
      + akisP * AGIRLIK.nakitAkisi
      + borcP * AGIRLIK.borc
      + sokP * AGIRLIK.sok
      + kor.puan * AGIRLIK.koruma;
    toplam = Math.max(0, Math.min(100, toplam));

    return {
      olcum: o, stres: st, koruma: kor, hedefAy: d.hedefAy,
      bilesen: {
        likidite: likiditeP, nakitAkisi: akisP, borc: borcP,
        sok: sokP, koruma: kor.puan
      },
      puan: toplam,
      segment: segment(toplam),
      /* Skora GİRMEYEN ama gösterilen riskler. Puana katmadık çünkü
         ağırlıklarını savunacak verimiz yok; gizlemedik çünkü gerçekler. */
      bayrak: {
        yogunlasma: bayrak(o.yogunlasma, 0.30, 0.50),
        kur: bayrak(o.toplamGelir > 0 ? o.kurAcikligi / (o.toplamGelir * 12) : 0, 0.10, 0.35)
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * KARAR
   *
   * Taksit sitenin kredi çekirdeğinden gelir: KKDF ve BSMV dahil, aynı
   * annüite. Burada ikinci bir taksit formülü YOK.
   * ------------------------------------------------------------------ */
  function kredibilgi(karar) {
    var tutar = art(karar.tutar);
    var pesinat = Math.min(art(karar.pesinat), tutar);
    var anapara = Math.max(0, tutar - pesinat);
    var vade = Math.max(0, Math.round(sayi(karar.vade)));
    var tur = Kredi.turBilgi(karar.krediTuru || "ihtiyac");
    var kkdf = karar.kkdf === undefined ? tur.kkdf : sayi(karar.kkdf);
    var bsmv = karar.bsmv === undefined ? tur.bsmv : sayi(karar.bsmv);
    var aylikFaiz = sayi(karar.aylikFaiz);
    var taksit = 0, brut = 0;
    if (anapara > 0 && vade > 0) {
      brut = Kredi.brutOran(aylikFaiz, kkdf, bsmv);
      taksit = Kredi.taksit(anapara, brut, vade);
    }
    return {
      tutar: tutar, pesinat: pesinat, anapara: anapara, vade: vade,
      krediTuru: karar.krediTuru || "ihtiyac",
      aylikFaiz: aylikFaiz, kkdf: kkdf, bsmv: bsmv,
      aylikMaliyetOrani: brut, taksit: taksit,
      aylikEkGider: art(karar.aylikEkGider),
      tekSeferlikGider: art(karar.tekSeferlikGider),
      toplamGeriOdeme: taksit * vade,
      toplamFaizVeVergi: Math.max(0, taksit * vade - anapara)
    };
  }

  /* Peşinat likidite sırasına göre çekilir: önce nakit, sonra altın/döviz,
     en son yatırım. Sıralama önemli — yanlış sırada çekmek dayanma süresini
     olduğundan iyi gösterirdi. */
  function nakitCek(d, tutar) {
    var kalan = tutar;
    var sira = ["nakit", "altinDoviz", "yatirim"];
    for (var i = 0; i < sira.length && kalan > 0; i++) {
      var alinan = Math.min(d[sira[i]], kalan);
      d[sira[i]] -= alinan;
      kalan -= alinan;
    }
    return kalan;   /* karşılanamayan kısım */
  }

  function kopya(o) {
    var y = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) y[k] = o[k];
    return y;
  }

  function kararUygula(durum, karar) {
    var k = kredibilgi(karar);
    var d = kopya(durum);
    var acik = nakitCek(d, k.pesinat + k.tekSeferlikGider);

    var eskiBakiye = d.borcBakiye;
    d.borcBakiye = eskiBakiye + k.anapara;
    d.borcServisi = d.borcServisi + k.taksit;
    d.zorunluGider = d.zorunluGider + k.aylikEkGider;

    /* Yeni kredi TL ve sabit faizli: dövizli ve değişken faizli PAYLAR
       seyrelir. Payları sabit tutmak, yeni borcu da dövizli saymak olurdu. */
    if (d.borcBakiye > 0) {
      d.dovizliBorcYuzde = eskiBakiye * d.dovizliBorcYuzde / d.borcBakiye;
      d.degiskenFaizliBorcYuzde = eskiBakiye * d.degiskenFaizliBorcYuzde / d.borcBakiye;
      d.mevcutAylikFaiz = (eskiBakiye * d.mevcutAylikFaiz + k.anapara * k.aylikFaiz) / d.borcBakiye;
    }
    /* Hedef tampon otomatikse yeniden türetilir: borç servisi arttıysa
       gerekli tampon da artar. Sabit bırakmak kararı kolay gösterirdi. */
    if (d.hedefAyOtomatik) d.hedefAy = hedefAyOner(d);

    d.kararAcigi = acik;
    return { durum: d, kredi: k, acik: acik };
  }

  /* ------------------------------------------------------------------ *
   * GÜVENLİ KARAR TUTARI
   *
   * "Bunu karşılayabilir miyim" değil, "emniyet kısıtlarını bozmadan en çok
   * ne kadarlık bir karar verebilirim". Kısıtlar:
   *
   *   karar sonrası likit varlık  >=  nakit tabanı
   *   borç servisi oranı          <=  eşik (varsayılan 0,35)
   *   ağırlıklı şok dayanımı      >=  hedef (varsayılan 0,80)
   *
   * Üç kısıt da tutar büyüdükçe TEK YÖNLÜ kötüleşir; ikiye bölme bu yüzden
   * geçerli. Sıfırda bile sağlanmıyorsa aranacak bir tutar yoktur — ve bu dal
   * ULAŞILABİLİR: mevcut durumun kendisi zaten güvensiz olabilir.
   * ------------------------------------------------------------------ */
  function olcekliKarar(karar, tutar) {
    var temel = art(karar.tutar);
    var k = kopya(karar);
    var c = temel > 0 ? tutar / temel : 0;
    k.tutar = tutar;
    k.pesinat = art(karar.pesinat) * c;
    k.aylikEkGider = art(karar.aylikEkGider) * c;
    k.tekSeferlikGider = art(karar.tekSeferlikGider) * c;
    return k;
  }

  function uygunluk(durum, karar, tutar) {
    var k = olcekliKarar(karar, tutar);
    var s = kararUygula(durum, k);
    var o = olcumler(s.durum);
    var st = stresTesti(s.durum);
    var taban = o.likitVarlik >= o.nakitTabani;
    /* Esikler normalize edilmis durumdan gelir; cekirdek disaridan ham
       nesneyle cagrilirsa varsayilanlara duser (sessiz NaN yerine). */
    var esikDsr = durum.dsrEsigi === undefined ? 0.35 : durum.dsrEsigi;
    var esikSok = durum.sokHedefi === undefined ? 0.80 : durum.sokHedefi;
    var dsrTamam = o.dsr <= esikDsr;
    var sokTamam = st.agirlikliDayanim >= esikSok;
    var fonlanabilir = s.acik <= 0.5;
    return {
      karar: k, sonuc: s, olcum: o, stres: st,
      taban: taban, dsr: dsrTamam, sok: sokTamam, fonlanabilir: fonlanabilir,
      uygun: taban && dsrTamam && sokTamam && fonlanabilir
    };
  }

  function engelListesi(u) {
    var e = [];
    if (!u.fonlanabilir) e.push("pesinat-fonlanamiyor");
    if (!u.taban) e.push("nakit-tabani");
    if (!u.dsr) e.push("borc-servisi");
    if (!u.sok) e.push("sok-dayanimi");
    return e;
  }

  function guvenliKararTutari(durum, karar) {
    var sifir = uygunluk(durum, karar, 0);
    if (!sifir.uygun) {
      return { guvenli: false, tutar: 0, engel: engelListesi(sifir),
               sinirBulunamadi: false };
    }

    var ust = Math.max(art(karar.tutar), 1000) * 4;
    if (uygunluk(durum, karar, ust).uygun) {
      return { guvenli: true, tutar: ust, sinirBulunamadi: true, engel: [] };
    }
    var alt = 0;
    for (var i = 0; i < 60 && (ust - alt) > 100; i++) {
      var orta = (alt + ust) / 2;
      if (uygunluk(durum, karar, orta).uygun) alt = orta; else ust = orta;
    }
    /* Sınırın hemen üstünde HANGİ kısıt bozuluyor: kullanıcıya "neyi
       düzeltirsen daha fazlasını alabilirsin" demenin tek dürüst yolu. */
    var baglayici = engelListesi(uygunluk(durum, karar, ust));
    return {
      guvenli: true, tutar: Math.floor(alt / 100) * 100,
      sinirBulunamadi: false, engel: baglayici
    };
  }

  /* ------------------------------------------------------------------ *
   * Alternatifler — "bu kararı daha güvenli nasıl veririm"
   * ------------------------------------------------------------------ */
  function alternatifler(durum, karar) {
    var liste = [];

    function ekle(etiket, k, not, ekDurum) {
      var s = kararUygula(ekDurum || durum, k);
      var sk = skor(s.durum);
      liste.push({
        etiket: etiket, not: not, karar: k, kredi: s.kredi,
        puan: sk.puan, segment: sk.segment,
        menzil: sk.olcum.menzil, dsr: sk.olcum.dsr,
        fazlaLikidite: sk.olcum.fazlaLikidite,
        dayanim: sk.stres.agirlikliDayanim,
        gecen: sk.stres.gecenSenaryo, senaryo: sk.stres.senaryoSayisi,
        fonlanabilir: s.acik <= 0.5,
        taksit: s.kredi.taksit,
        toplamGeriOdeme: s.kredi.toplamGeriOdeme
      });
    }

    ekle("Girdiğiniz karar", olcekliKarar(karar, art(karar.tutar)), "");
    ekle("%20 daha küçük", olcekliKarar(karar, art(karar.tutar) * 0.8),
         "Aynı yapı, daha küçük tutar.");
    ekle("%40 daha küçük", olcekliKarar(karar, art(karar.tutar) * 0.6),
         "Aynı yapı, belirgin küçültme.");

    /* Vadeyi uzatmak taksiti düşürür AMA toplam maliyeti artırır. Bunu
       "daha güvenli" diye sunup pahalılaştığını söylememek yanıltıcı
       olurdu; iki sayı da dönüyor ve arayüz ikisini de gösteriyor. */
    var uzun = olcekliKarar(karar, art(karar.tutar));
    uzun.vade = Math.max(1, Math.round(sayi(karar.vade))) + 12;
    ekle("Vade 12 ay uzun", uzun, "Taksit düşer, toplam geri ödeme artar.");

    /* Ertelemek: altı ay boyunca finansal payın GERÇEKTEN biriktirildiği
       varsayılır. Pay sıfır ya da eksiyse erteleme bir şey kazandırmaz ve
       bunu söylemek gerekir — o yüzden alternatif hiç üretilmiyor. */
    var o = olcumler(durum);
    if (o.finansalPay > 0) {
      var d6 = kopya(durum);
      d6.nakit = d6.nakit + o.finansalPay * 6;
      ekle("6 ay ertele", olcekliKarar(karar, art(karar.tutar)),
           "Aylık " + Math.round(o.finansalPay) + " ₺'nin altı ay biriktirildiği varsayımıyla.",
           d6);
    }
    return liste;
  }

  /* ------------------------------------------------------------------ *
   * Gerekçe — skorun NEDEN düştüğü, LLM'siz
   *
   * Metin şablon, sayı hesap. Cümleler yalnızca hesaplanmış farklardan
   * kuruluyor; hiçbiri tahmin değil.
   * ------------------------------------------------------------------ */
  function bicimAy(m) {
    if (!isFinite(m)) return "sınırsız süre";
    return (Math.round(m * 10) / 10).toString().replace(".", ",") + " ay";
  }

  function tl(n) {
    return Math.round(n).toLocaleString("tr-TR") + " ₺";
  }

  /* Turkcede ondalik ayraci virguldur; toFixed nokta uretir. */
  function yuzde(x) {
    return (x * 100).toFixed(1).replace(".", ",");
  }

  /* ANLAMLILIK ESIKLERI.
     Ilk surumde esikler neredeyse sifirdi (yarim lira, 0.1 ay) ve sonuc suydu:
     5 milyon likiditesi olan bir hanede 1.000 TL'lik bir karar bile "tampon
     inceldi" uyarisi uretiyordu. Bu hem gurultu hem de daha kotusu, "hicbir
     gosterge bozulmuyor" dalini ULASILAMAZ hale getiriyordu — test onu
     yakaladi. Esikler artik HANEYE GORE olceklendi: tamponun bir aylik zorunlu
     yanmadan az degismesi, o hane icin haber degildir. */
  function gerekce(once, sonra) {
    var g = [];
    var esikTampon = Math.max(1, once.olcum.zorunluYanma);   /* bir aylik yanma */

    if (isFinite(once.olcum.menzil) && sonra.olcum.menzil < once.olcum.menzil - 0.25) {
      g.push({
        alan: "likidite",
        baslik: "Dayanma süresi kısaldı",
        metin: "Gelir tamamen kesilse likit varlığınız " + bicimAy(once.olcum.menzil) +
          " yerine " + bicimAy(sonra.olcum.menzil) + " yeter." +
          (sonra.olcum.menzil < sonra.hedefAy
            ? " Bu, sizin için hesaplanan " + sonra.hedefAy + " aylık tamponun altında."
            : "")
      });
    }
    if (sonra.olcum.dsr > once.olcum.dsr + 0.01) {
      g.push({
        alan: "borc",
        baslik: "Borç servisi yükseldi",
        metin: "Aylık borç ödemeniz hane gelirinin %" + yuzde(once.olcum.dsr) +
          "'inden %" + yuzde(sonra.olcum.dsr) + "'ine çıkıyor."
      });
    }
    if (sonra.stres.gecenSenaryo < once.stres.gecenSenaryo) {
      var dusenler = [];
      sonra.stres.yollar.forEach(function (y, i) {
        if (!y.agirlik) return;
        if (!y.hayattaKaldi && once.stres.yollar[i].hayattaKaldi) {
          dusenler.push(y.etiket.toLocaleLowerCase("tr") + " senaryosunda " +
            y.batisAyi + ". ayda");
        }
      });
      g.push({
        alan: "sok",
        baslik: "Şok dayanıklılığı düştü",
        metin: "Karardan önce " + once.stres.gecenSenaryo + "/" + once.stres.senaryoSayisi +
          " senaryoyu geçiyordunuz; sonrasında " + sonra.stres.gecenSenaryo + "/" +
          sonra.stres.senaryoSayisi + "." +
          (dusenler.length
            ? " Nakit " + dusenler.slice(0, 3).join(", ") +
              (dusenler.length > 3
                ? " ve " + (dusenler.length - 3) + " senaryoda daha tükeniyor."
                : " tükeniyor.")
            : "")
      });
    }
    if (sonra.olcum.fazlaLikidite < 0 && once.olcum.fazlaLikidite >= 0) {
      g.push({
        alan: "taban",
        baslik: "Nakit tabanının altına iniyorsunuz",
        metin: "Karar sonrası likit varlığınız, " + sonra.hedefAy +
          " aylık tampon ve yakın vadeli yükümlülüklerin " +
          tl(Math.abs(sonra.olcum.fazlaLikidite)) + " altında kalıyor."
      });
    } else if (sonra.olcum.fazlaLikidite < once.olcum.fazlaLikidite - esikTampon) {
      g.push({
        alan: "taban",
        baslik: "Tampon inceldi",
        metin: "Nakit tabanının üzerindeki serbest likidite " +
          tl(once.olcum.fazlaLikidite) + "'den " + tl(sonra.olcum.fazlaLikidite) + "'ye iniyor."
      });
    }
    if (!g.length) {
      g.push({
        alan: "yok",
        baslik: "Emniyet göstergeleri belirgin biçimde bozulmuyor",
        metin: "Bu karar, ölçülen kısıtların hiçbirinde anlamlı bir kötüleşme yaratmıyor."
      });
    }
    return g;
  }

  /* ------------------------------------------------------------------ *
   * Tek giriş noktası
   * ------------------------------------------------------------------ */
  function rapor(girdi, kararGirdi) {
    var d = normalize(girdi);
    var once = skor(d);

    var karar = kararGirdi || {};
    if (art(karar.tutar) <= 0) {
      return {
        durum: d, once: once, sonra: null, karar: null,
        gerekce: [], alternatif: [], guvenliTutar: null
      };
    }

    var u = kararUygula(d, karar);
    var sonra = skor(u.durum);

    return {
      durum: d,
      once: once,
      sonra: sonra,
      karar: u.kredi,
      kararAcigi: u.acik,
      sonrakiDurum: u.durum,
      gerekce: gerekce(once, sonra),
      alternatif: alternatifler(d, karar),
      guvenliTutar: guvenliKararTutari(d, karar)
    };
  }

  return {
    surum: "1.0.0",
    LIKIDITE: LIKIDITE,
    AGIRLIK: AGIRLIK,
    EGRI: EGRI,
    SENARYOLAR: SENARYOLAR,
    SURE: SURE,
    sayi: sayi,
    yuzde: yuzde,
    egri: egri,
    segment: segment,
    normalize: normalize,
    hedefAyOner: hedefAyOner,
    likit: likit,
    olcumler: olcumler,
    yol: yol,
    stresTesti: stresTesti,
    korumaPuani: korumaPuani,
    skor: skor,
    kredibilgi: kredibilgi,
    kararUygula: kararUygula,
    olcekliKarar: olcekliKarar,
    uygunluk: uygunluk,
    guvenliKararTutari: guvenliKararTutari,
    alternatifler: alternatifler,
    gerekce: gerekce,
    rapor: rapor
  };
});
