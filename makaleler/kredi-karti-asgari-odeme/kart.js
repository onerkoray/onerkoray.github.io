/*!
 * Kredi kartı asgari ödemesi: borç nasıl seyreder, neye mal olur.
 *
 * NEDEN AYRI MODÜL
 * ----------------
 * Kural üç yerde lazım: yazının tabloları, testi ve ileride bir araç. Üçüne
 * ayrı ayrı yazılsaydı biri güncellenip ötekiler sessizce eskirdi.
 *
 * ORANLAR NEREDEN
 * ---------------
 * Aylık azami akdi ve gecikme faizi oranlarını TCMB belirliyor ve bunlar
 * dönem borcunun büyüklüğüne göre üç banda ayrılıyor. Buradaki değerler
 * 1 Eylül 2026'dan geçerli olan tablodan alındı. Bankalar bu oranları
 * AŞAMAZ ama altında kalabilir; dolayısıyla buradaki hesap "en kötü hâl".
 *
 * Asgari ödeme oranını BDDK belirliyor. Yönetmelik (Banka Kartları ve Kredi
 * Kartları Hakkında Yönetmelik m.22/7) Kurul'a oranı "dönem borcunun yüzde
 * yirmisi ile yüzde kırkı arasında" belirleme yetkisi veriyor; Kurul da
 * kartın LİMİTİNE göre ikiye ayırmış durumda.
 *
 * ORAN KARTIN LİMİTİNE BAĞLI, BORCUNA DEĞİL
 * -----------------------------------------
 * Bunun doğrudan bir sonucu var ve gözden kaçıyor: borç kart limitini
 * aşamayacağı için, 50.000 TL'den büyük bir borç zaten yüksek limitli bir
 * kartta demektir ve o kartın asgarisi %40'tır. "150.000 TL borç, %20
 * asgari" diye bir durum yok. Modül böyle bir girdiyi reddediyor.
 *
 * VERGİ
 * -----
 * Faizin üzerine KKDF ve BSMV biniyor; ikisi de %15. Aynı oranlar sitedeki
 * kredi hesaplayıcısında ihtiyaç kredisi için de kullanılıyor ve test iki
 * kaynağın ayrışmadığını ayrıca doğruluyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika();
  } else {
    kok.KartBorcu = fabrika();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* TCMB — 1 Eylül 2026'dan geçerli aylık azami oranlar. */
  var ORAN_TARIHI = "2026-09-01";
  var BANTLAR = [
    { ad: "30.000 TL'ye kadar", ust: 30000, akdi: 0.0325, gecikme: 0.0355 },
    { ad: "30.000 – 180.000 TL", ust: 180000, akdi: 0.0375, gecikme: 0.0405 },
    { ad: "180.000 TL üzeri", ust: Infinity, akdi: 0.0425, gecikme: 0.0455 }
  ];
  /* Nakit çekim, dönem borcu ne olursa olsun en üst banttan işler. */
  var NAKIT_CEKIM = { akdi: 0.0425, gecikme: 0.0455 };

  var KKDF = 0.15;
  var BSMV = 0.15;

  /* BDDK: asgari ödeme oranı kartın limitine göre. */
  var ASGARI_SINIR = 50000;
  var ASGARI_DUSUK = 0.20;   // limiti sınıra kadar olan kartlar
  var ASGARI_YUKSEK = 0.40;  // limiti sınırın üzerindeki kartlar

  function vergiCarpani() { return 1 + KKDF + BSMV; }

  /* Faizin vergiyle birlikte aylık gerçek oranı. */
  function vergiliOran(akdi) { return akdi * vergiCarpani(); }

  function bant(donemBorcu) {
    for (var i = 0; i < BANTLAR.length; i++) {
      if (donemBorcu <= BANTLAR[i].ust) return BANTLAR[i];
    }
    return BANTLAR[BANTLAR.length - 1];
  }

  function asgariOrani(limit) {
    return limit > ASGARI_SINIR ? ASGARI_YUKSEK : ASGARI_DUSUK;
  }

  /* Borcun BÜYÜMEMESİ için asgari oranın aşması gereken eşik.
     Ay sonunda kalan (1-m)·D, üzerine vergili faiz biniyor:
        D' = (1-m)·D·(1+ie)
     D' < D  <=>  m > ie / (1+ie)
     Yani eşik faizin kendisi değil, faizin bir gömlek altı. */
  function buyumeEsigi(akdi) {
    var ie = vergiliOran(akdi);
    return ie / (1 + ie);
  }

  /* Verilen asgari oranın işlemez hale geleceği akdi faiz.
     m = ie/(1+ie) çözülürse ie = m/(1-m), akdi = ie / vergiCarpani.
     Yazının dayanıklılık iddiası bu sayıya bağlı: bugünkü azami oranın
     kaç katı gerekiyor? */
  function kritikAkdiFaiz(asgariOran) {
    return (asgariOran / (1 - asgariOran)) / vergiCarpani();
  }

  function enYuksekAzamiAkdi() {
    return BANTLAR.reduce(function (e, b) { return Math.max(e, b.akdi); }, 0);
  }

  /* Ay ay seyir.
     Ödeme sırası: ekstre dönem borcunu gösterir, müşteri asgariyi öder,
     KALAN tutara vergili faiz işler, varsa yeni harcama eklenir ve ertesi
     ayın dönem borcu bulunur. */
  function simule(borc, limit, secenekler) {
    secenekler = secenekler || {};
    var aylikHarcama = secenekler.aylikHarcama || 0;
    var enCokAy = secenekler.enCokAy || 600;
    var bitisEsigi = secenekler.bitisEsigi || 1;   // TL

    if (!(borc > 0)) throw new Error("Borç pozitif olmalı.");
    if (!(limit > 0)) throw new Error("Limit pozitif olmalı.");
    if (borc > limit) {
      throw new Error("Borç (" + borc + " TL) kart limitini (" + limit +
        " TL) aşamaz; asgari oran limite bağlı olduğu için bu girdi " +
        "gerçekte karşılığı olmayan bir senaryo üretirdi.");
    }

    var m = asgariOrani(limit);
    var kalan = borc, ay = 0, faizToplam = 0, odenenToplam = 0;
    var seyir = [];

    while (kalan > bitisEsigi && ay < enCokAy) {
      ay++;
      var b = bant(kalan);
      var odeme = kalan * m;
      /* Son ayda asgari yerine kalanın tamamı ödenir; aksi hâlde borç
         sonsuza kadar küçülür ve "kaç ayda biter" sorusu cevapsız kalır. */
      if (kalan - odeme <= bitisEsigi) odeme = kalan;
      odenenToplam += odeme;
      kalan -= odeme;

      var faiz = kalan * vergiliOran(b.akdi);
      faizToplam += faiz;
      kalan += faiz + aylikHarcama;

      seyir.push({ ay: ay, odeme: odeme, faiz: faiz, kalan: kalan });
    }

    return {
      borc: borc, limit: limit, asgariOran: m,
      ay: ay, bitti: kalan <= bitisEsigi,
      faizToplam: faizToplam, odenenToplam: odenenToplam,
      kalan: kalan, seyir: seyir,
      faizOrani: faizToplam / borc       // anaparaya oran
    };
  }

  /* Bir yıl sonra borcun ne kadarı kalır (yeni harcama yoksa)? */
  function yilSonuKalan(borc, limit) {
    var r = simule(borc, limit, { enCokAy: 12, bitisEsigi: 0.005 });
    return r.kalan;
  }

  /* Borcu SABİT tutan aylık yeni harcama: ödeme eksi faiz.
     Asıl tuzak burada — asgari ödemede değil, ertesi ay yapılan harcamada. */
  function basabasHarcama(borc, limit) {
    if (borc > limit) {
      throw new Error("Borç kart limitini aşamaz.");
    }
    var m = asgariOrani(limit);
    var b = bant(borc);
    var odeme = borc * m;
    var faiz = (borc - odeme) * vergiliOran(b.akdi);
    return { odeme: odeme, faiz: faiz, basabas: odeme - faiz };
  }

  return {
    ORAN_TARIHI: ORAN_TARIHI,
    BANTLAR: BANTLAR,
    NAKIT_CEKIM: NAKIT_CEKIM,
    KKDF: KKDF,
    BSMV: BSMV,
    ASGARI_SINIR: ASGARI_SINIR,
    ASGARI_DUSUK: ASGARI_DUSUK,
    ASGARI_YUKSEK: ASGARI_YUKSEK,
    vergiCarpani: vergiCarpani,
    vergiliOran: vergiliOran,
    bant: bant,
    asgariOrani: asgariOrani,
    buyumeEsigi: buyumeEsigi,
    kritikAkdiFaiz: kritikAkdiFaiz,
    enYuksekAzamiAkdi: enYuksekAzamiAkdi,
    simule: simule,
    yilSonuKalan: yilSonuKalan,
    basabasHarcama: basabasHarcama
  };
});
