/*!
 * Otomobilde ÖTV — tarife ve satır çözümü. TEK DOĞRULUK KAYNAĞI.
 *
 * ÖTV'de zor olan şey oranı bilmek değil, ARACIN HANGİ SATIRA DÜŞTÜĞÜNÜ
 * bulmaktır. Kanuna ekli (II) sayılı listede 87.03 sırası bir tablo değil,
 * iç içe bir karar ağacıdır: motor hacmi, elektrik motorunun gücü, şarj
 * edilebilirlik, karbondioksit emisyonu, menzil ve matrah — hepsi sırayla
 * sorulur. Bu dosya o ağacı olduğu gibi kurar.
 *
 * ÖNCEKİ HALİN ÜÇ BOŞLUĞU (2026-09-13'te bulundu)
 * ----------------------------------------------
 *   1. HİBRİT, tek bir "hibrit" kutusuydu. Kanunda hibrit satırı KOŞULLU:
 *      elektrik motoru 50 kW'ı GEÇECEK ve hacim 1800 cm³'ü geçmeyecek.
 *      Elektrik motoru 50 kW'ı geçmeyen bir "mild hybrid" bu satıra
 *      girmez, düz içten yanmalı gibi vergilenir. Araç ayrım yapmadığı
 *      için mild hybrid sahibine %70 gösteriyordu; doğrusu %150.
 *
 *   2. BÜYÜK HİBRİT satırı hiç yoktu. Kanunda 2000 cm³ üstünde ikinci bir
 *      hibrit satırı var: elektrik motoru 100 kW'ı geçen ve hacmi 2500
 *      cm³'ü geçmeyenler %150/%170. Araç bunları %220'ye atıyordu.
 *
 *   3. ŞARJ EDİLEBİLİR HİBRİTTE yalnızca 1600 cm³ altı vardı. Kanunda
 *      1601–1800 cm³ için ayrı bir satır var (%85) ve bu satırın
 *      "diğerleri" karşılığı YOK: matrah 1.350.000 TL'yi aşarsa araç bu
 *      satırdan tamamen düşer, hacmine göre genel satıra döner. Aradaki
 *      fark %85 ile %170 arasında olabiliyor.
 *
 * Ayrıca şarj edilebilir hibrit satırının kendi koşulları var: ağırlıklı
 * birleşik kilometre başına CO2 emisyonu 25 gramın ALTINDA ve eşdeğer
 * elektrikle menzil 70 km ve ÜZERİNDE. Koşul sağlanmazsa satır uygulanmaz.
 *
 * KAYNAKLAR
 * ---------
 * 4760 sayılı ÖTV Kanunu, (II) sayılı liste, 87.03 G.T.İ.P. — mevzuat.gov.tr
 * Yürürlükteki oranlar: 24/7/2025 tarihli ve 10115 sayılı Cumhurbaşkanı
 *   Kararı (listede 52 numaralı dipnot).
 * Şarj edilebilir hibrit satırları: 18/7/2024 tarihli ve 7521 sayılı
 *   Kanunun 11 inci maddesi (54 numaralı dipnot).
 *
 * DİKKAT: ÖTV oranları ve matrah eşikleri Cumhurbaşkanı Kararı ile yıl
 * içinde değişebilir. Bu dosya değiştiğinde tarife-test.js'teki eşik ve
 * oranlar da güncellenmeli — test onları ayrıca sabitliyor ki sessiz bir
 * düzenleme fark edilmeden geçmesin.
 */
(function (root) {
  "use strict";

  var KDV = 0.20;
  var KARAR = "24/7/2025 tarihli 10115 sayılı Cumhurbaşkanı Kararı";

  /* Bir satır: eşikler ve eşik sayısından bir fazla oran.
     Eşik AŞILDIĞINDA üst oran TÜM matraha uygulanır — kademeli değil.
     Bu, gelir vergisindeki dilim mantığının tersidir ve ÖTV'yi bir
     "uçurum" vergisi yapar; sayfa bunu ayrıca anlatıyor. */
  function satir(ad, esikler, oranlar) {
    return { ad: ad, esik: esikler, oran: oranlar };
  }

  /* İçten yanmalı — hacim bantları */
  var ICTEN_1400 = satir("1400 cm³'ü geçmeyenler",
    [650000, 900000, 1100000], [70, 75, 80, 90]);
  var ICTEN_1600 = satir("1400–1600 cm³",
    [850000, 1100000, 1650000], [75, 80, 90, 100]);
  var ICTEN_2000 = satir("1600–2000 cm³ (hibrit satırına girmeyenler)",
    [1650000], [150, 170]);
  var ICTEN_UST = satir("2000 cm³'ü geçenler", [], [220]);

  /* Hibrit — KOŞULLU satırlar */
  var HIBRIT_ORTA = satir("Hibrit: elektrik motoru 50 kW üstü, hacim 1800 cm³'ü geçmeyen",
    [1250000], [70, 80]);
  var HIBRIT_BUYUK = satir("Hibrit: elektrik motoru 100 kW üstü, hacim 2500 cm³'ü geçmeyen",
    [1650000], [150, 170]);

  /* Şarj edilebilir hibrit (CO2 < 25 g/km ve menzil >= 70 km) */
  var PHEV_1600 = satir("Şarj edilebilir hibrit, 1600 cm³'ü geçmeyen",
    [1350000], [45, 75]);
  var PHEV_1800_ORAN = 85;
  var PHEV_1800_ESIK = 1350000;

  /* Yalnızca elektrik motorlu */
  var BEV_ALT = satir("Elektrikli: motor gücü 160 kW'ı geçmeyen", [1650000], [25, 55]);
  var BEV_UST = satir("Elektrikli: motor gücü 160 kW'ı geçen", [1650000], [65, 75]);

  /* PHEV koşulları — kanunun kendi ifadesiyle */
  var PHEV_CO2 = 25;          // g/km, ALTINDA olacak
  var PHEV_MENZIL = 70;       // km, VE ÜZERİNDE olacak
  var HIBRIT_KW = 50;         // kW, GEÇECEK
  var HIBRIT_BUYUK_KW = 100;  // kW, GEÇECEK

  function sayi(x) { return typeof x === "number" && isFinite(x); }

  /** Satır içinde matraha isabet eden oran. Eşiği "aşan" üst orandadır. */
  function oranBul(s, matrah) {
    var i = 0;
    while (i < s.esik.length && matrah > s.esik[i]) i++;
    return s.oran[i];
  }

  /* ---------------------------------------------------------------- *
   * İçten yanmalı / hibrit ağacı.
   *
   * Kanunun sırasını izler: önce hacim bandı, sonra o bandın altında
   * hibrit alt satırı olup olmadığı. 1600 cm³'e kadar hibrit için AYRI
   * SATIR YOKTUR — küçük hibritler düz içten yanmalı gibi vergilenir.
   * ---------------------------------------------------------------- */
  function hacimSatiri(hacim, elektrikKw) {
    if (!sayi(hacim) || hacim <= 0) return null;
    if (hacim <= 1400) return ICTEN_1400;
    if (hacim <= 1600) return ICTEN_1600;
    if (hacim <= 2000) {
      if (sayi(elektrikKw) && elektrikKw > HIBRIT_KW && hacim <= 1800) return HIBRIT_ORTA;
      return ICTEN_2000;
    }
    if (sayi(elektrikKw) && elektrikKw > HIBRIT_BUYUK_KW && hacim <= 2500) return HIBRIT_BUYUK;
    return ICTEN_UST;
  }

  /* ---------------------------------------------------------------- *
   * hesapla(g)
   *
   *   g.tur        "icten" | "hibrit" | "phev" | "elektrik"
   *   g.hacim      motor silindir hacmi (cm³) — elektrik dışında
   *   g.elektrikKw hibritin elektrik motor gücü (kW)
   *   g.kw         elektrikli aracın motor gücü (kW)
   *   g.co2        g/km — şarj edilebilir hibritte
   *   g.menzil     km  — şarj edilebilir hibritte
   *   g.matrah     ÖTV matrahı (vergisiz fiyat)
   * ---------------------------------------------------------------- */
  function hesapla(g) {
    var matrah = g.matrah;
    if (!sayi(matrah) || matrah <= 0) return { hata: "matrah" };

    var s = null, notlar = [];

    if (g.tur === "elektrik") {
      if (!sayi(g.kw) || g.kw <= 0) return { hata: "kw" };
      s = g.kw <= 160 ? BEV_ALT : BEV_UST;

    } else if (g.tur === "phev") {
      /* Satırın koşulları sağlanmazsa satır UYGULANMAZ. Kanun bunu bir
         indirim olarak değil, satırın tanımı olarak yazmış. */
      var kosul = sayi(g.co2) && g.co2 < PHEV_CO2 &&
                  sayi(g.menzil) && g.menzil >= PHEV_MENZIL;
      if (!kosul) {
        notlar.push("Şarj edilebilir hibrit satırının koşulları sağlanmıyor " +
          "(CO₂ emisyonu 25 g/km'nin altında ve menzil 70 km ve üzeri olmalı); " +
          "araç hacmine göre genel satırdan vergilendirildi.");
        s = hacimSatiri(g.hacim, g.elektrikKw);
      } else if (sayi(g.hacim) && g.hacim <= 1600) {
        s = PHEV_1600;
      } else if (sayi(g.hacim) && g.hacim <= 1800 && matrah <= PHEV_1800_ESIK) {
        s = satir("Şarj edilebilir hibrit, 1600–1800 cm³, matrah 1.350.000 TL'yi aşmayan",
          [], [PHEV_1800_ORAN]);
      } else {
        /* 1600–1800 cm³ satırının "diğerleri" karşılığı yok: matrah
           eşiği aşınca araç bu satırdan düşer ve hacmine göre genel
           satıra döner. Fark büyüktür, bu yüzden ayrıca söyleniyor. */
        notlar.push("Bu satır yalnızca matrah 1.350.000 TL'yi aşmadığında uygulanır; " +
          "eşik aşıldığı için araç hacmine göre genel satıra döndü.");
        s = hacimSatiri(g.hacim, g.elektrikKw);
      }

    } else {
      /* icten ve hibrit aynı ağaçta: farkı elektrik motor gücü yaratır. */
      s = hacimSatiri(g.hacim, sayi(g.elektrikKw) ? g.elektrikKw : 0);
      if (g.tur === "hibrit" && s !== HIBRIT_ORTA && s !== HIBRIT_BUYUK) {
        if (sayi(g.hacim) && g.hacim > 1600) {
          notlar.push("Hibrit satırı için elektrik motor gücünün 50 kW'ı (2000 cm³ " +
            "üstünde 100 kW'ı) geçmesi gerekir; koşul sağlanmadığı için araç düz " +
            "içten yanmalı satırından vergilendirildi.");
        } else {
          notlar.push("1600 cm³'e kadar hibritler için ayrı satır yoktur; " +
            "bu araçlar içten yanmalı tarifesiyle vergilendirilir.");
        }
      }
    }

    if (!s) return { hata: "hacim" };

    var oran = oranBul(s, matrah);
    var otv = matrah * oran / 100;
    var kdvMatrah = matrah + otv;
    var kdv = kdvMatrah * KDV;
    var toplam = kdvMatrah + kdv;

    return {
      satir: s.ad, satirNesnesi: s, oran: oran,
      matrah: matrah, otv: otv, kdv: kdv, toplam: toplam,
      vergi: otv + kdv, vergiPayi: (otv + kdv) / toplam,
      notlar: notlar, karar: KARAR
    };
  }

  /* Bir alt eşiğe inmenin anahtar teslim fiyata etkisi. ÖTV kademeli
     olmadığı için eşiğin hemen üstündeki araç, eşikteki araçtan DAHA UCUZA
     satılamaz; aradaki boşluk gerçek ve sayfada gösteriliyor. */
  function esikFarki(s, matrah) {
    if (!s || !s.esik.length) return null;
    var i = 0;
    while (i < s.esik.length && matrah > s.esik[i]) i++;
    if (i === 0) return null;
    var esik = s.esik[i - 1];
    var simdi = matrah * (1 + s.oran[i] / 100) * (1 + KDV);
    var esikte = esik * (1 + s.oran[i - 1] / 100) * (1 + KDV);
    if (esikte >= simdi) return null;
    return { esik: esik, esikteToplam: esikte, simdikiToplam: simdi, fark: simdi - esikte };
  }

  var api = {
    KDV: KDV, KARAR: KARAR,
    PHEV_CO2: PHEV_CO2, PHEV_MENZIL: PHEV_MENZIL,
    HIBRIT_KW: HIBRIT_KW, HIBRIT_BUYUK_KW: HIBRIT_BUYUK_KW,
    ICTEN_1400: ICTEN_1400, ICTEN_1600: ICTEN_1600,
    ICTEN_2000: ICTEN_2000, ICTEN_UST: ICTEN_UST,
    HIBRIT_ORTA: HIBRIT_ORTA, HIBRIT_BUYUK: HIBRIT_BUYUK,
    PHEV_1600: PHEV_1600, PHEV_1800_ORAN: PHEV_1800_ORAN,
    PHEV_1800_ESIK: PHEV_1800_ESIK,
    BEV_ALT: BEV_ALT, BEV_UST: BEV_UST,
    oranBul: oranBul, hacimSatiri: hacimSatiri,
    hesapla: hesapla, esikFarki: esikFarki
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OtvTarife = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
