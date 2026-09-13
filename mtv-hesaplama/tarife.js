/*!
 * MTV 2026 tarifeleri ve hesap kuralları — TEK DOĞRULUK KAYNAĞI
 * ============================================================
 *
 * Bu dosya 197 sayılı Motorlu Taşıtlar Vergisi Kanunu'nun yapısını taklit
 * eder, özetlemez. Kanunda ÜÇ AYRI tarife var ve üçü de farklı davranıyor:
 *
 *   (I)   md. 5      — 1/1/2018 ve sonrası tescilli otomobil.
 *                      Motor hacmi × TAŞIT DEĞERİ KADEMESİ × yaş.
 *   (I/A) geç. md. 8 — 31/12/2017 ve öncesi tescilli otomobil.
 *                      Motor hacmi × yaş. Değer kademesi YOK ve tutarlar
 *                      (I)'in ilk kademesiyle AYNI DEĞİL.
 *   (I)/2 md. 5      — Motosikletler. Motor hacmi × yaş.
 *
 * NEDEN AYRI DOSYA
 * ----------------
 * Bu sayı kümesi daha önce script.js içinde gömülüydü ve orada üç hata
 * birden barındırıyordu (2026-09-13'te bulundu):
 *
 *   1. 2018 ÖNCESİ TESCİL, (I) tarifesinin ilk değer kademesiyle
 *      hesaplanıyordu. Bu yalnızca ilk iki hacim bandında doğru; 1601 cm³
 *      ve üzerinde (I/A) daha düşük. Örnek: 2015 model 1.8 otomobil için
 *      19.472 TL yerine 17.705 TL — %10 fazla vergi gösteriliyordu.
 *      Türkiye'deki otomobillerin büyük çoğunluğu 2018 öncesi tescilli.
 *
 *   2. ELEKTRİKLİ OTOMOBİLDE kullanıcıdan motor SİLİNDİR HACMİ seçmesi
 *      isteniyordu. Elektrikli aracın silindir hacmi yoktur. Kanun bu
 *      araçları MOTOR GÜCÜNE (kW) göre satıra yerleştirir; %25 oranı
 *      doğruydu ama uygulandığı satır kullanıcının tahminine kalmıştı.
 *
 *   3. ELEKTRİKLİ MOTOSİKLET hiç yoktu; kanunda kendi kW bantları var.
 *
 * Üç hatanın ortak özelliği sessiz olmaları: sayfa açılıyor, tablo hizalı
 * görünüyor, yalnızca sonuç yanlış. Tarife ayrı bir modüle çıkarıldı ve
 * tarife-test.js her tutarı kanundaki ham tutarla çapraz doğruluyor.
 *
 * KAYNAKLAR
 * ---------
 * Kanun metni : mevzuat.gov.tr — 197 sayılı Kanun (md. 5, geç. md. 8)
 * 2026 tutarı : 58 Seri No.lu MTV Genel Tebliği,
 *               31/12/2025 tarihli 33124 (5. Mükerrer) sayılı Resmî Gazete
 * Oran        : 2025 yeniden değerleme oranı %25,49 iken, 30/12/2025
 *               tarihli 10783 sayılı Cumhurbaşkanı Kararı ile MTV için
 *               %18,95 olarak belirlendi. (I), (II), (IV) ve (I/A)
 *               tarifelerinin hepsi bu oranla güncellendi.
 */
(function (root) {
  "use strict";

  var YIL = 2026;

  /* 2026 tutarları bu oranla belirlendi; sayfada oranı yazan cümle bu
     sabitten beslenir ki VUK'un %25,49'u ile karıştırılmasın. */
  var YENIDEN_DEGERLEME = 0.1895;

  var YAS_ETIKET = ["1 – 3 yaş", "4 – 6 yaş", "7 – 11 yaş",
    "12 – 15 yaş", "16 yaş ve üzeri"];

  /* Dokuz hacim bandı; (I) ve (I/A) tarifelerinde aynı sırada. */
  var HACIM_ETIKET = [
    "1300 cm³ ve altı", "1301 – 1600 cm³", "1601 – 1800 cm³",
    "1801 – 2000 cm³", "2001 – 2500 cm³", "2501 – 3000 cm³",
    "3001 – 3500 cm³", "3501 – 4000 cm³", "4001 cm³ ve üzeri"
  ];

  /* ---------------------------------------------------------------- *
   * (I) SAYILI TARİFE — 1/1/2018 ve sonrası tescil
   *
   * esik   : taşıt değeri kademesi sınırları (TL, 2026). Kanunda ham
   *          tutar olarak 40.000 / 70.000 gibi yazar; tebliğ bunları da
   *          yeniden değerlemeyle günceller.
   * satir  : [değer kademesi][yaş grubu]
   * ---------------------------------------------------------------- */
  var TARIFE_I = [
    { esik: [309100, 541500],
      satir: [[5750, 4010, 2238, 1689, 593],
              [6319, 4409, 2459, 1861, 655],
              [6902, 4807, 2693, 2032, 706]] },
    { esik: [309100, 541500],
      satir: [[10016, 7510, 4354, 3077, 1181],
              [11023, 8264, 4794, 3375, 1290],
              [12028, 9012, 5220, 3685, 1408]] },
    { esik: [775100],
      satir: [[19472, 15226, 8948, 5458, 2113],
              [21251, 16600, 9775, 5964, 2307]] },
    { esik: [775100],
      satir: [[30679, 23625, 13886, 8264, 3248],
              [33474, 25784, 15147, 9012, 3547]] },
    { esik: [968100],
      satir: [[46027, 33413, 20874, 12465, 4930],
              [50217, 36448, 22768, 13606, 5378]] },
    { esik: [1937500],
      satir: [[64175, 55837, 34878, 18758, 6875],
              [70018, 60905, 38053, 20466, 7503]] },
    { esik: [1937500],
      satir: [[97744, 87954, 52976, 26443, 9684],
              [106641, 95940, 57791, 28839, 10578]] },
    { esik: [3101800],
      satir: [[153684, 132712, 78152, 34878, 13886],
              [167671, 144770, 85271, 38053, 15147]] },
    { esik: [3683200],
      satir: [[251554, 188627, 111714, 50206, 19472],
              [274415, 205781, 121873, 54769, 21251]] }
  ];

  /* ---------------------------------------------------------------- *
   * (I/A) SAYILI TARİFE — 31/12/2017 ve öncesi tescil
   *
   * Değer kademesi yok. İlk iki bant (I)'in ilk kademesiyle çakışır,
   * sonrakiler çakışmaz — aracın eski hatası tam olarak buradaydı.
   * ---------------------------------------------------------------- */
  var TARIFE_IA = [
    [5750, 4010, 2238, 1689, 593],
    [10016, 7510, 4354, 3077, 1181],
    [17705, 13829, 8145, 4957, 1917],
    [27898, 21478, 12624, 7510, 2958],
    [41840, 30372, 18977, 11333, 4479],
    [58347, 50754, 31704, 17044, 6255],
    [88859, 79955, 48158, 24031, 8813],
    [139721, 120647, 71048, 31704, 12624],
    [228681, 171485, 101555, 45632, 17705]
  ];

  /* (I) sayılı tarife, "2- Motosikletler" bölümü. */
  var MOTO_ETIKET = ["100 – 250 cm³", "251 – 650 cm³",
    "651 – 1200 cm³", "1201 cm³ ve üzeri"];
  var TARIFE_MOTO = [
    [1069, 799, 589, 362, 136],
    [2214, 1676, 1069, 589, 362],
    [5719, 3398, 1676, 1069, 589],
    [13876, 9167, 5719, 4540, 2214]
  ];

  /* ---------------------------------------------------------------- *
   * ELEKTRİKLİ TAŞITLAR
   *
   * MTVK md. 5 ek fıkra (7103/18) ve geç. md. 8 ek fıkra (7103/21):
   * yalnızca elektrik motoru olan taşıtlar motor gücüne göre tarifenin
   * satırına yerleştirilir, sonra o satırın %25'i alınır.
   *
   * Eşikler ÜST SINIRDIR ve "geçmeyenler" diye yazar: 70 kW'lık araç
   * birinci banttadır, 70,5 kW'lık araç ikinci bantta. Bu yüzden
   * karşılaştırma "<=" ile yapılıyor, "<" ile değil.
   *
   * Dokuz kW bandı dokuz hacim bandına birebir denk gelir; bu sayede
   * aynı eşleme hem (I) hem (I/A) için çalışır.
   * ---------------------------------------------------------------- */
  var EV_ORANI = 0.25;
  var KW_UST = [70, 85, 105, 120, 150, 180, 210, 240];
  var KW_ETIKET = ["70 kW ve altı", "70 kW üstü – 85 kW",
    "85 kW üstü – 105 kW", "105 kW üstü – 120 kW", "120 kW üstü – 150 kW",
    "150 kW üstü – 180 kW", "180 kW üstü – 210 kW", "210 kW üstü – 240 kW",
    "240 kW üstü"];

  /* Elektrikli motosiklette tarife 6 kW'ın ÜSTÜNDE başlar; 6 kW ve altı
     taşıt bu bölümde hiç yer almaz. Uydurma satır yazmak yerine bunu
     açıkça bildiriyoruz. */
  var MOTO_KW_ALT = 6;
  var MOTO_KW_UST = [15, 40, 60];
  var MOTO_KW_ETIKET = ["6 kW üstü – 15 kW", "15 kW üstü – 40 kW",
    "40 kW üstü – 60 kW", "60 kW üstü"];

  /* (I/A) — kasko istisnası. Kanun bunu Cumhurbaşkanı yetkisine değil,
     doğrudan hükme bağlamış: vergi, kasko değerinin %5'ini aşarsa bir
     önceki satırın aynı yaş grubundaki tutarı esas alınır. */
  var IA_KASKO_ORANI = 0.05;

  /* (I) — burada durum FARKLI: %10'luk sınır bir Cumhurbaşkanı YETKİSİDİR
     ("...belirlemeye, bu oranı %4'e kadar indirmeye ... yetkilidir"),
     kendiliğinden işleyen bir hüküm değil. Yürürlükte bir Karar olup
     olmadığını bilmeden uygulamak, hesabı sessizce yanlışlar. Bu yüzden
     hesaplanmıyor; sayfada bilgi notu olarak veriliyor. */
  var I_KASKO_ORANI = 0.10;

  function tamsayi(x) { return typeof x === "number" && isFinite(x); }

  /** Araç yaşı: içinde bulunulan yıl − model yılı + 1. */
  function aracYasi(modelYili, yil) {
    return (yil || YIL) - modelYili + 1;
  }

  function yasGrubu(yas) {
    if (yas <= 3) return 0;
    if (yas <= 6) return 1;
    if (yas <= 11) return 2;
    if (yas <= 15) return 3;
    return 4;
  }

  /** kW → dokuz hacim bandından biri. Güç verilmemişse null. */
  function kwBandi(kw) {
    if (!tamsayi(kw) || kw <= 0) return null;
    for (var i = 0; i < KW_UST.length; i++) if (kw <= KW_UST[i]) return i;
    return KW_UST.length;                       // 240 kW üstü → 9. bant
  }

  /** Elektrikli motosiklet: tarife dışıysa −1. */
  function motoKwBandi(kw) {
    if (!tamsayi(kw) || kw <= MOTO_KW_ALT) return -1;
    for (var i = 0; i < MOTO_KW_UST.length; i++) if (kw <= MOTO_KW_UST[i]) return i;
    return MOTO_KW_UST.length;
  }

  /** (I) değer kademesi. Kanun: eşiği "aşan" bir üst kademededir. */
  function degerKademesi(bant, deger) {
    var e = TARIFE_I[bant].esik;
    var i = 0;
    while (i < e.length && deger > e[i]) i++;
    return i;
  }

  /* ---------------------------------------------------------------- *
   * hesapla(g)
   *
   *   g.tur      "otomobil" | "motosiklet"
   *   g.tescil   "yeni" (1/1/2018+) | "eski"      — yalnızca otomobilde
   *   g.yakit    "icten" | "elektrik"
   *   g.bant     içten yanmalıda hacim bandı indeksi
   *   g.kw       elektrikte motor gücü
   *   g.modelYili
   *   g.deger    taşıt değeri (yalnızca (I) tarifesinde)
   *   g.kasko    kasko değeri (yalnızca (I/A) istisnası için, isteğe bağlı)
   *
   * Dönüş, tek bir sayı değil, hesabın HER ADIMIDIR: sayfa adımları
   * olduğu gibi gösterebilsin, test her adımı ayrı doğrulayabilsin.
   * ---------------------------------------------------------------- */
  function hesapla(g) {
    var yil = g.yil || YIL;
    var yas = aracYasi(g.modelYili, yil);
    if (!tamsayi(yas) || yas < 1) return { hata: "model-yili" };
    var yg = yasGrubu(yas);
    var elektrik = g.yakit === "elektrik";

    var out = {
      yil: yil, yas: yas, yasGrubu: yg, yasEtiket: YAS_ETIKET[yg],
      elektrik: elektrik, evOrani: elektrik ? EV_ORANI : 1
    };

    if (g.tur === "motosiklet") {
      var mb;
      if (elektrik) {
        mb = motoKwBandi(g.kw);
        if (mb < 0) return { hata: "moto-kw-disi", altSinir: MOTO_KW_ALT };
        out.bantEtiket = MOTO_KW_ETIKET[mb] + " (" + MOTO_ETIKET[mb] + " satırı)";
      } else {
        mb = g.bant;
        if (!TARIFE_MOTO[mb]) return { hata: "bant" };
        out.bantEtiket = MOTO_ETIKET[mb];
      }
      out.tarife = "(I) — 2. bölüm, motosikletler";
      out.bant = mb;
      out.tarifeTutari = TARIFE_MOTO[mb][yg];
      out.vergi = out.tarifeTutari * out.evOrani;
      out.taksit = out.vergi / 2;
      return out;
    }

    /* --- Otomobil ------------------------------------------------- */
    var eski = g.tescil === "eski";
    var bant;
    if (elektrik) {
      bant = kwBandi(g.kw);
      if (bant === null) return { hata: "kw" };
      out.bantEtiket = KW_ETIKET[bant] + " (" + HACIM_ETIKET[bant] + " satırı)";
    } else {
      bant = g.bant;
      if (!TARIFE_I[bant]) return { hata: "bant" };
      out.bantEtiket = HACIM_ETIKET[bant];
    }
    out.bant = bant;

    if (eski) {
      out.tarife = "(I/A) — 31/12/2017 ve öncesi tescil";
      out.tarifeTutari = TARIFE_IA[bant][yg];
      out.kademe = null;
    } else {
      out.tarife = "(I) — 1/1/2018 ve sonrası tescil";
      var k = degerKademesi(bant, tamsayi(g.deger) ? g.deger : 0);
      out.kademe = k;
      out.kademeSayisi = TARIFE_I[bant].satir.length;
      out.kademeEsik = TARIFE_I[bant].esik;
      out.tarifeTutari = TARIFE_I[bant].satir[k][yg];
    }

    var vergi = out.tarifeTutari * out.evOrani;

    /* (I/A) kasko istisnası. Ölçüt ÖDENECEK vergi ile kasko değerinin
       %5'i; elektrikli araçta karşılaştırma indirimli tutar üzerinden
       yapılır, çünkü kanunun dediği "taşıta ait vergi tutarı" odur.
       Kanun bir ÖNCEKİ satırı der — tek adım, zincirleme değil. */
    if (eski && tamsayi(g.kasko) && g.kasko > 0) {
      var sinir = g.kasko * IA_KASKO_ORANI;
      out.kaskoSiniri = sinir;
      if (vergi > sinir && bant > 0) {
        out.kaskoOncesi = vergi;
        out.kaskoBanti = HACIM_ETIKET[bant - 1];
        vergi = TARIFE_IA[bant - 1][yg] * out.evOrani;
        out.kaskoIndirimi = true;
      } else if (vergi > sinir && bant === 0) {
        /* İlk satırda "bir önceki satır" yok; hüküm işletilemez. */
        out.kaskoIlkSatir = true;
      }
    }

    out.vergi = vergi;
    out.taksit = vergi / 2;
    return out;
  }

  var api = {
    YIL: YIL,
    YENIDEN_DEGERLEME: YENIDEN_DEGERLEME,
    EV_ORANI: EV_ORANI,
    IA_KASKO_ORANI: IA_KASKO_ORANI,
    I_KASKO_ORANI: I_KASKO_ORANI,
    MOTO_KW_ALT: MOTO_KW_ALT,
    YAS_ETIKET: YAS_ETIKET,
    HACIM_ETIKET: HACIM_ETIKET,
    KW_ETIKET: KW_ETIKET,
    KW_UST: KW_UST,
    MOTO_ETIKET: MOTO_ETIKET,
    MOTO_KW_ETIKET: MOTO_KW_ETIKET,
    MOTO_KW_UST: MOTO_KW_UST,
    TARIFE_I: TARIFE_I,
    TARIFE_IA: TARIFE_IA,
    TARIFE_MOTO: TARIFE_MOTO,
    aracYasi: aracYasi,
    yasGrubu: yasGrubu,
    kwBandi: kwBandi,
    motoKwBandi: motoKwBandi,
    degerKademesi: degerKademesi,
    hesapla: hesapla
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MtvTarife = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
