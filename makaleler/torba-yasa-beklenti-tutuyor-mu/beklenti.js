/*!
 * Torba yasa beklentileri tuttu mu? Gözlem verisi ve türetmeleri.
 *
 * SORU
 * ----
 * "Torba yasada ne var" diye aranan başlıkların çoğu her yıl tekrarlıyor:
 * kademeli emeklilik, yapılandırma, seyyanen zam, Bağ-Kur prim gün
 * indirimi. Bu modül tek bir soruyu ölçüyor: bu beklentilerin kaçı
 * gerçekten yasalaştı?
 *
 * GÖZLEM PENCERESİ: 2023 – 2026 (dört yasama yılı).
 *
 * KAYNAK: her satır Resmî Gazete künyesiyle duruyor. Kanun numarası,
 * yayım tarihi ve mümkün olan her yerde sayı numarası kayıtlı. Künyesi
 * doğrulanamayan hiçbir kanun tabloya girmedi.
 *
 * DIŞARIDA BIRAKILAN BİR KANUN -- VE NEDENİ
 * ------------------------------------------
 * Temmuz 2025'te çıktığı söylenen "7556 sayılı torba kanun" tabloya
 * ALINMADI. Sebep, içeriğinin ilgisiz olması değil; KİMLİĞİNİN
 * SABİTLENEMEMESİ. Kaynaklar çelişiyor: bir kaynak 7556'yı Pan-Avrupa
 * Akdeniz menşe sözleşmesinin onayı olarak gösteriyor, iki meslek yayını
 * ise aynı numarayı vergi torbası diye anlatıyor; bunlardan biri aynı
 * sayfada 7556 ile 7566'yı birbirinin yerine kullanıyor. Üstelik aynı
 * emlak vergisi hükmü iki ayrı kanuna atfediliyor.
 *
 * Künyesi çözülmemiş bir kanunu tabloya koymak, bu yazının tezini
 * doğruladığı hâlde yanlış olurdu. Tez onsuz da ayakta: dışarıda kalan
 * satır "beklenti getirmedi" sütununa yazılacaktı, yani çıkarılması
 * sonucu ZAYIFLATIYOR, güçlendirmiyor.
 *
 * KAPSAM SINIRI -- OKUYUCUYA DA SÖYLENİYOR
 * -----------------------------------------
 * Taranan şey her yılın BÜYÜK TORBA KANUNLARIDIR; o yıl çıkan bütün
 * kanunlar tek tek değil. "Hiçbir kanunda yoktu" denemez; denebilecek
 * olan "yılın büyük torba kanunlarında yoktu"dur. Yazı bu sınırı
 * saklamıyor.
 *
 * TÜRETİLEBİLİR HİÇBİR ŞEY SAKLANMIYOR
 * ------------------------------------
 * Modülde yalnızca ham gözlem var: kanunlar ve beklentiler. İsabet
 * oranı, yıl kırılımı, "kaç yıldır sıfır" ve pencere içi/dışı ayrımı
 * BURADA HESAPLANIYOR.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Beklenti = fabrika();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Gözlem penceresi. Yazıdaki her oran bu aralığa göre hesaplanıyor. */
  var ILK_YIL = 2023;
  var SON_YIL = 2026;

  /* --- Tablo 1: pencere içindeki büyük torba kanunlar ---------------
     getirdi[] = aşağıdaki BEKLENTILER listesinden karşıladığı maddeler.
     Boş dizi, o kanunun beklenti listesinden hiçbir şey getirmediğini
     söyler -- bu yazının asıl ölçtüğü şey o boşluk. */
  var KANUNLAR = [
    { no: 7438, rg: "2023-03-03", sayi: null,
      ad: "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu ile 375 sayılı KHK'da Değişiklik",
      ozet: "Emeklilikte yaşa takılanlar",
      getirdi: ["eyt"] },

    { no: 7440, rg: "2023-03-12", sayi: 32130,
      ad: "Bazı Alacakların Yeniden Yapılandırılması ile Bazı Kanunlarda Değişiklik",
      ozet: "Vergi ve prim borcu yapılandırması",
      getirdi: ["yapilandirma"] },

    { no: 7456, rg: "2023-07-15", sayi: 32249,
      ad: "6/2/2023 Tarihinde Meydana Gelen Depremlerin Yol Açtığı Ekonomik Kayıpların Telafisi için Ek Motorlu Taşıtlar Vergisi İhdası ile Bazı Kanunlarda Değişiklik",
      ozet: "375 sayılı KHK'ya Ek Madde 40: seyyanen ödeme (gösterge 15.965)",
      getirdi: ["seyyanen"] },

    { no: 7524, rg: "2024-08-02", sayi: 32620,
      ad: "Vergi Kanunları ile Bazı Kanunlarda ve 375 sayılı KHK'da Değişiklik",
      ozet: "Yurt içi asgari kurumlar vergisi, devreden KDV sınırı, uzlaşma kapsamı",
      getirdi: [] },

    { no: 7538, rg: "2025-01-15", sayi: 32783,
      ad: "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu ile Bazı Kanunlarda Değişiklik",
      ozet: "Sağlık verisi, aile hekimliği, öğrenci sigortası, katılım payı, İSG",
      getirdi: [] },

    { no: 7566, rg: "2025-12-19", sayi: 33112,
      ad: "Vergi Kanunları ile Bazı Kanun ve Kanun Hükmünde Kararnamelerde Değişiklik",
      ozet: "Prime esas kazanç tavanı 7,5 → 9 kat; MYÖ prim oranı +1 puan; işveren teşviki 4 → 2 puan",
      getirdi: [] },

    { no: 7587, rg: "2026-07-01", sayi: 33297,
      ad: "Bazı Kanunlarda Değişiklik Yapılmasına Dair Kanun",
      ozet: "Harçlar, e-tebligat, eğlence vergisi, emlak vergi değeri sınırı",
      getirdi: [] },

    { no: 7589, rg: "2026-07-31", sayi: null,
      ad: "Yargının Etkin ve Verimli İşlemesine Yönelik Bazı Kanunlarda Değişiklik",
      ozet: "İcra, muhakeme usulü ve ceza hukuku değişiklikleri",
      getirdi: [] }
  ];

  /* --- Tablo 2: tekrarlayan beklentiler -----------------------------
     karsilandi: yasalaştıysa { yil, kanun }, yasalaşmadıysa null.
     Pencere ÖNCESİNDE karşılananlar da null değil -- yıl bilgisi
     duruyor, pencere içinde olup olmadığını modül hesaplıyor. */
  var BEKLENTILER = [
    { id: "eyt", ad: "Emeklilikte yaşa takılanlar (EYT)",
      karsilandi: { yil: 2023, kanun: 7438 },
      not: "" },

    { id: "yapilandirma", ad: "Vergi ve prim borcu yapılandırması",
      karsilandi: { yil: 2023, kanun: 7440 },
      not: "2023'ten sonra yeni bir kapsamlı yapılandırma çıkmadı." },

    { id: "seyyanen", ad: "Seyyanen zam / refah payı",
      karsilandi: { yil: 2023, kanun: 7456 },
      not: "Bir kez uygulandı; sonraki yıllarda tekrarlanmadı." },

    { id: "ekGosterge", ad: "3600 ek gösterge",
      karsilandi: { yil: 2022, kanun: 7417 },
      not: "Gözlem penceresinden önce yasalaştı." },

    { id: "taseron", ad: "Taşeron işçiye kadro",
      karsilandi: { yil: 2017, kanun: 696 },
      not: "696 sayılı KHK ile; gözlem penceresinden önce." },

    { id: "kademeli", ad: "Kademeli emeklilik",
      karsilandi: null,
      not: "2/2755 esas numaralı teklif 6 Aralık 2024'ten beri Plan ve Bütçe Komisyonu'nda." },

    { id: "bagkur7200", ad: "Bağ-Kur'da 9.000 günün 7.200'e inmesi",
      karsilandi: null,
      not: "Bakan düzeyinde takvim açıklandı, yürürlükte hüküm yok." }
  ];

  /* --- Tablo 3: beklenti hangi ARAÇLA gelir? ------------------------
     Yazının ikinci bulgusu: bazı beklentiler torba yasadan gelmiyor,
     gelemez. Aranan yer ile karar verilen yer başka. */
  var ARACLAR = [
    { konu: "Asgari ücret", arac: "Asgari Ücret Tespit Komisyonu kararı",
      torbaMi: false },
    { konu: "Emekli aylık zammı", arac: "Kanundaki TÜFE formülü",
      torbaMi: false },
    { konu: "Memur maaş artışı", arac: "Toplu sözleşme + enflasyon farkı",
      torbaMi: false },
    { konu: "Emeklilik şartları", arac: "Kanun (torba kanun olabilir)",
      torbaMi: true },
    { konu: "Borç yapılandırması", arac: "Kanun (torba kanun olabilir)",
      torbaMi: true },
    { konu: "Prim oranları ve tavan", arac: "Kanun (torba kanun olabilir)",
      torbaMi: true }
  ];

  /* ---------------------- türetmeler ------------------------------- */

  function yil(k) { return parseInt(k.rg.slice(0, 4), 10); }

  /* Pencere içindeki yıllar. */
  function yillar() {
    var d = [];
    for (var y = ILK_YIL; y <= SON_YIL; y++) d.push(y);
    return d;
  }

  function kanunlarYil(y) {
    return KANUNLAR.filter(function (k) { return yil(k) === y; });
  }

  /* O yıl beklenti listesinden kaç madde geldi? */
  function getiriYil(y) {
    var n = 0;
    kanunlarYil(y).forEach(function (k) { n += k.getirdi.length; });
    return n;
  }

  /* Pencere İÇİNDE karşılanan beklentiler. Pencere öncesi karşılananlar
     (ek gösterge 2022, taşeron 2017) buraya girmiyor -- ölçtüğümüz şey
     bu dört yılda ne olduğu. */
  function pencereIciKarsilanan() {
    return BEKLENTILER.filter(function (b) {
      return b.karsilandi && b.karsilandi.yil >= ILK_YIL &&
             b.karsilandi.yil <= SON_YIL;
    });
  }

  function hicKarsilanmayan() {
    return BEKLENTILER.filter(function (b) { return !b.karsilandi; });
  }

  /* Pencere öncesinde karşılanmış olanlar: "bir zamanlar çıktı, o yüzden
     her yıl yeniden bekleniyor" grubu. */
  function pencereOncesi() {
    return BEKLENTILER.filter(function (b) {
      return b.karsilandi && b.karsilandi.yil < ILK_YIL;
    });
  }

  /* Beklentilerin kaçta kaçı pencere içinde yasalaştı? */
  function isabetOrani() {
    return pencereIciKarsilanan().length / BEKLENTILER.length;
  }

  /* Son karşılanmanın üzerinden kaç yasama yılı geçti? */
  function sifirYilSayisi() {
    var sonYil = null;
    pencereIciKarsilanan().forEach(function (b) {
      if (sonYil === null || b.karsilandi.yil > sonYil) sonYil = b.karsilandi.yil;
    });
    return sonYil === null ? yillar().length : SON_YIL - sonYil;
  }

  /* Beklenti getirmeyen kanunların sayısı ve payı. */
  function bosKanunlar() {
    return KANUNLAR.filter(function (k) { return k.getirdi.length === 0; });
  }

  function bosKanunPayi() {
    return bosKanunlar().length / KANUNLAR.length;
  }

  /* Getirinin yığıldığı yıl: en çok madde hangi yılda geldi? */
  function yogunYil() {
    var enIyi = null;
    yillar().forEach(function (y) {
      if (enIyi === null || getiriYil(y) > getiriYil(enIyi)) enIyi = y;
    });
    return enIyi;
  }

  /* O yıl gelen madde sayısının TOPLAM içindeki payı. */
  function yilPayi(y) {
    var toplam = 0;
    yillar().forEach(function (x) { toplam += getiriYil(x); });
    return toplam ? getiriYil(y) / toplam : 0;
  }

  /* Torba yasadan GELMEYEN konular: yanlış kapı çalınan başlıklar. */
  function torbaDisi() {
    return ARACLAR.filter(function (a) { return !a.torbaMi; });
  }

  function beklenti(id) {
    var b = null;
    BEKLENTILER.forEach(function (x) { if (x.id === id) b = x; });
    return b;
  }

  function kanun(no) {
    var k = null;
    KANUNLAR.forEach(function (x) { if (x.no === no) k = x; });
    return k;
  }

  return {
    ILK_YIL: ILK_YIL, SON_YIL: SON_YIL,
    KANUNLAR: KANUNLAR, BEKLENTILER: BEKLENTILER, ARACLAR: ARACLAR,
    yil: yil,
    yillar: yillar,
    kanunlarYil: kanunlarYil,
    getiriYil: getiriYil,
    pencereIciKarsilanan: pencereIciKarsilanan,
    hicKarsilanmayan: hicKarsilanmayan,
    pencereOncesi: pencereOncesi,
    isabetOrani: isabetOrani,
    sifirYilSayisi: sifirYilSayisi,
    bosKanunlar: bosKanunlar,
    bosKanunPayi: bosKanunPayi,
    yogunYil: yogunYil,
    yilPayi: yilPayi,
    torbaDisi: torbaDisi,
    beklenti: beklenti,
    kanun: kanun
  };
});
