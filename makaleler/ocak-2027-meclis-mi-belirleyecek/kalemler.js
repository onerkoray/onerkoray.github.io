/*!
 * Ocak 2027'yi Meclis mi belirleyecek? Kalemler, karar mercileri ve
 * bugün kesinleşen kısım.
 *
 * SORU
 * ----
 * Yeni yasama yılı 1 Ekim 2026'da açıldı. Ocak 2027'de maaşa, aylığa ve
 * vergiye dokunan her kalem için: kararı kim veriyor (Meclis kanunu,
 * Cumhurbaşkanı kararı, komisyon, kanundaki formül, toplu sözleşme) ve
 * 1 Ekim itibarıyla ne kesinleşti?
 *
 * DAYANAKLAR mevzuat.gov.tr'deki güncel metinlerden, 3 Ekim 2026'da okundu:
 *   Anayasa m.161 (bütçe) · GVK mükerrer m.123/2-3 (dilimler) · 197 s.K. m.10
 *   (MTV) · 492 s.K. mükerrer m.138 (harçlar) · 488 s.K. m.14 (damga azami
 *   tutarı) · 4857 s.K. m.39 (asgari ücret) · 5510 s.K. m.55 (aylık artışı),
 *   m.82 (prime esas kazanç sınırları). Teklif durumu TBMM kanun teklifleri
 *   listesinden (1 Ekim 2026).
 *
 * HESAP BURADA DEĞİL. Emekli zammının kesinleşen kısmı finans/emekli-
 * zammi-motoru.js'ten, toplu sözleşme oranı finans/toplu-sozlesme.js'ten,
 * MTV oranı mtv-hesaplama/tarife.js'ten, yeniden değerleme oranı
 * finans/endeksleme-serileri.js'ten okunuyor. Kesinleşen kısım yalnız
 * TEMMUZ ve AĞUSTOS 2026'ya dayanır: seri her gece uzasa da bu iki ay
 * değişmez, yazıdaki sayı bayatlamaz.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/makaleler/ocak-2027-meclis-mi-belirleyecek/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../finans/tufe-serisi.js"), require("../../finans/toplu-sozlesme.js"),
      require("../../finans/endeksleme-serileri.js"), require("../../mtv-hesaplama/tarife.js"));
  } else {
    kok.OcakKalemleri = fabrika(kok.TufeSerisi, kok.TopluSozlesme, kok.EndekslemeSerileri, kok.MtvTarife);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Tufe, TS, Seri, MTV) {
  "use strict";

  /* Karar mercii türleri. "meclis" yalnız TBMM'de kanun ya da bütçe
     kanunuyla değişebilen kalemler. */
  var MERCI = {
    meclis:   "TBMM (kanun)",
    cb:       "Yeniden değerleme oranı, Cumhurbaşkanı değiştirebilir",
    komisyon: "Asgari Ücret Tespit Komisyonu",
    formul:   "Kanundaki formül",
    sozlesme: "Toplu sözleşme ve kanundaki formül",
    bagli:    "Asgari ücrete bağlı"
  };

  /* Ocak 2027'de hanenin gelirine ya da vergisine dokunan kalemler.
     Sıra yazıdaki tablonun sırası. */
  var KALEMLER = [
    { id: "dilim", kisa: "Gelir vergisi dilimleri", ad: "Gelir vergisi dilimleri", merci: "cb",
      dayanak: "GVK mükerrer m.123/2-3",
      ne: "2026 yeniden değerleme oranıyla kendiliğinden artar; Cumhurbaşkanı %50'ye kadar artırıp azaltabilir.",
      zaman: "Oran Kasım'da ilan edilir" },
    { id: "mtv", kisa: "Motorlu taşıtlar vergisi", ad: "Motorlu taşıtlar vergisi", merci: "cb",
      dayanak: "197 s.K. m.10",
      ne: "Yeniden değerleme oranıyla artar; Cumhurbaşkanı oranın %20'si ile %150'si arasında başka bir oran belirleyebilir.",
      zaman: "Karar Aralık sonunda" },
    { id: "harc", kisa: "Harç ve damga tutarları", ad: "Harçlar ve damga vergisi tutarları", merci: "cb",
      dayanak: "492 s.K. mük. m.138; 488 s.K. m.14",
      ne: "Maktu tutarlar yeniden değerleme oranıyla artar; Cumhurbaşkanının değiştirme yetkisi var.",
      zaman: "1 Ocak 2027" },
    { id: "asgari", kisa: "Asgari ücret", ad: "Asgari ücret", merci: "komisyon",
      dayanak: "4857 s.K. m.39",
      ne: "Komisyon kararı kesindir, Resmî Gazete'de yayımlanarak yürürlüğe girer.",
      zaman: "Aralık" },
    { id: "prim", kisa: "SGK prim tabanı ve tavanı", ad: "SGK prim tabanı ve tavanı", merci: "bagli",
      dayanak: "5510 s.K. m.82",
      ne: "Taban asgari ücret, tavan onun 9 katı; asgari ücretle birlikte belli olur.",
      zaman: "Aralık" },
    { id: "emekli", kisa: "SSK ve Bağ-Kur zammı", ad: "SSK ve Bağ-Kur aylık zammı", merci: "formul",
      dayanak: "5510 s.K. m.55",
      ne: "Temmuz–Aralık 2026 TÜFE değişimi kadar.",
      zaman: "Aralık enflasyonu Ocak başında" },
    { id: "memur", kisa: "Memur zammı", ad: "Memur maaşı ve memur emekli aylığı", merci: "sozlesme",
      dayanak: "Kamu Görevlileri Hakem Kurulu Kararı (RG 27.8.2025)",
      ne: "Ocak 2027 için %5 artış ve 2026'nın ikinci yarısının enflasyon farkı.",
      zaman: "Aralık enflasyonu Ocak başında" },
    { id: "butce", kisa: "2027 bütçesi", ad: "2027 merkezî yönetim bütçesi", merci: "meclis",
      dayanak: "Anayasa m.161",
      ne: "Teklif mali yılbaşından en az 75 gün önce sunulur; komisyon 55 gün içinde görüşür, Genel Kurul yılbaşına kadar karara bağlar.",
      zaman: "Teklif en geç 17 Ekim 2026" },
    { id: "taban", kisa: "En düşük emekli aylığı", ad: "En düşük emekli aylığı", merci: "meclis",
      dayanak: "Kanun",
      ne: "Formülden değil kanundan gelir; artış için yeni bir hüküm gerekir.",
      zaman: "Takvimi yok" },
    { id: "vergiPaketi", kisa: "İstisna düzenlemesi", ad: "İstisna ve muafiyet düzenlemesi", merci: "meclis",
      dayanak: "OVP 2027-2029",
      ne: "OVP \"etkin olmayan istisna, muafiyet ve indirimlere yönelik düzenlemeler yapılacaktır\" diyor; 1 Ekim'de sunulmuş bir teklif yok.",
      zaman: "Takvimi yok" },
    { id: "emeklilik", kisa: "Kademeli emeklilik", ad: "Emeklilik şartları (kademeli emeklilik)", merci: "meclis",
      dayanak: "Kanun",
      ne: "2/2755 esas numaralı teklif 6 Aralık 2024'ten beri komisyonda.",
      zaman: "Takvimi yok" }
  ];

  /* ------------------------------------------------------ türetmeler -- */
  function merciSay() {
    var s = {};
    KALEMLER.forEach(function (k) { s[k.merci] = (s[k.merci] || 0) + 1; });
    return s;
  }
  function meclisSayisi() { return KALEMLER.filter(function (k) { return k.merci === "meclis"; }).length; }
  function meclisDisi() { return KALEMLER.length - meclisSayisi(); }

  /* Bütçe teklifinin son günü (Anayasa m.161): teklif günü ile mali
     yılbaşı arasında en az 75 tam gün kalmalı. */
  function butceSonGun(maliYil, gun) {
    gun = gun || 75;
    var yb = Date.UTC(maliYil, 0, 1);
    /* teklif günü d için arada kalan tam gün: (yb − d)/gün − 1 */
    var d = new Date(yb - (gun + 1) * 864e5);
    return d.toISOString().slice(0, 10);
  }

  /* Ocak 2027 emekli zammının KESİNLEŞEN kısmı: açıklanmış Temmuz ve
     Ağustos 2026. Kalan dört ay ne olursa olsun zam bunun altına inmez
     (aylık TÜFE negatif olmadıkça). */
  var KESIN_AYLAR = ["2026-07", "2026-08"];
  function kesinAylar() {
    return KESIN_AYLAR.map(function (a) {
      var v = Tufe.aylar[a];
      if (!v) throw new Error("TÜFE serisinde " + a + " yok.");
      return { ay: a, oran: v.aylik / 100 };
    });
  }
  function emekliTaban() {
    return kesinAylar().reduce(function (b, a) { return b * (1 + a.oran); }, 1) - 1;
  }

  /* Memur: Ocak 2027 = (1 + fark) × (1 + 2027 ilk yarı oranı) − 1;
     fark = max(0, (1 + Tem–Ara TÜFE) / (1 + 2026 ikinci yarı oranı) − 1).
     Taban = sözleşme oranı. Farkın doğması için Eylül–Aralık'ta gereken
     birikim: (1 + ikinci yarı oranı) / (1 + Temmuz–Ağustos) − 1. */
  function memurTaban() { return TS.oranlar["2027-1"]; }
  function memurIkinciYari() { return TS.oranlar["2026-2"]; }
  function farkEsigi() { return (1 + memurIkinciYari()) / (1 + emekliTaban()) - 1; }

  /* 2026: MTV'ye uygulanan oran, tarifeye esas yeniden değerleme oranının
     yüzde kaçı? (Cumhurbaşkanı yetkisinin kullanıldığı somut örnek.) */
  function mtvOrani2026() { return MTV.YENIDEN_DEGERLEME; }
  function ydo2026() { return Seri.SERI[2026].ydo / 100; }
  function mtvYdoPayi() { return mtvOrani2026() / ydo2026(); }

  /* --------------------------------------------- Meclis'teki teklifler --
     TBMM kanun teklifleri listesi, 28. Dönem 5. Yasama Yılı, 3 Ekim 2026'da
     tarandı (teklifler-2026-10-03.json; satır metni TBMM'nin kendi özeti).
     Hepsi tatilde sunulup yeni yasama yılına kaydedilen teklifler. Node
     dışında (tarayıcıda) yüklenmez; yazı statik, sayılar testle doğrulanır. */
  var TEKLIFLER = (typeof module === "object" && module.exports)
    ? require("./teklifler-2026-10-03.json") : [];
  var TARAMA_TARIHI = "2026-10-03";

  /* Vergi, prim ya da emeklilik hükmü taşıyan kanunlar: adı satır
     metninde geçen teklif bu gruba girer. */
  var MALI_KANUN = /Gelir Vergisi|Vergi Usul|Katma Değer|Kurumlar Vergisi|Harçlar|Özel Tüketim|Emlak Vergisi|Damga Vergisi|Motorlu Taşıtlar|Belediye Gelirleri|Sosyal Sigortalar|Emekli Sandığı|İşsizlik Sigortası|İş Kanunu|Esnaf ve Sanatkârlar/i;

  /* Karşılaştırma için bilinen bir büyük torba teklif: 2/3560 (Bazı
     Kanunlarda Değişiklik Yapılmasına Dair Kanun Teklifi, 2 Mart 2026),
     "Hüseyin Altınsoy ve Ejder Açıkkapı ile 46 Milletvekili": 48 imza.
     Kaynak: TBMM Sıra Sayısı 259. */
  var ORNEK_TORBA = { esas: "2/3560", tarih: "2026-03-02", imza: 2 + 46 };

  /* Geçen yasama yılının (28. Dönem 4. Yasama Yılı, 1.10.2025–30.9.2026)
     bütün teklifleri ve son durumları, aynı listeden 3 Ekim 2026'da.
     "1/" ile başlayanlar bütçe ve kesin hesap teklifleri; milletvekili
     teklifi sayılmaz. Soru: imza sayısı kanunlaşmayı ne kadar öngörüyor? */
  var DORDUNCU = (typeof module === "object" && module.exports)
    ? require("./teklifler-4-yasama-yili.json") : [];
  var AZ_IMZA = 2, COK_IMZA = 20;
  function dorduncuYil() {
    var mv = DORDUNCU.filter(function (t) { return t.esas.indexOf("2/") === 0; });
    function grup(f) {
      var g = mv.filter(f);
      var k = g.filter(function (t) { return t.durum === "KANUNLAŞTI"; }).length;
      return { sayi: g.length, kanunlasti: k, oran: g.length ? k / g.length : 0 };
    }
    var butce = DORDUNCU.filter(function (t) { return /^1\//.test(t.esas); })
      .sort(function (a, b) { return a.gelis < b.gelis ? -1 : 1; })[0];
    return {
      toplam: mv.length,
      kanunlasti: mv.filter(function (t) { return t.durum === "KANUNLAŞTI"; }).length,
      az: grup(function (t) { return t.imza <= AZ_IMZA; }),
      cok: grup(function (t) { return t.imza >= COK_IMZA; }),
      butceTeklifi: butce ? { esas: butce.esas, gelis: butce.gelis } : null
    };
  }

  function teklifOzeti() {
    var mali = TEKLIFLER.filter(function (t) { return MALI_KANUN.test(t.metin); });
    var imzalar = TEKLIFLER.map(function (t) { return t.imza; });
    var gelis = TEKLIFLER.map(function (t) { return t.gelis; }).sort();
    return {
      sayi: TEKLIFLER.length,
      ilkGelis: gelis[0], sonGelis: gelis[gelis.length - 1],
      tekImzali: TEKLIFLER.filter(function (t) { return t.imza === 1; }).length,
      enCokImza: Math.max.apply(null, imzalar),
      komisyonda: TEKLIFLER.filter(function (t) { return t.durum === "KOMİSYONDA"; }).length,
      mali: mali.length,
      maliEnCokImza: mali.length ? Math.max.apply(null, mali.map(function (t) { return t.imza; })) : 0
    };
  }

  return {
    MERCI: MERCI, KALEMLER: KALEMLER, KESIN_AYLAR: KESIN_AYLAR.slice(),
    TEKLIFLER: TEKLIFLER, TARAMA_TARIHI: TARAMA_TARIHI, ORNEK_TORBA: ORNEK_TORBA, teklifOzeti: teklifOzeti,
    AZ_IMZA: AZ_IMZA, COK_IMZA: COK_IMZA, dorduncuYil: dorduncuYil,
    merciSay: merciSay, meclisSayisi: meclisSayisi, meclisDisi: meclisDisi,
    butceSonGun: butceSonGun, kesinAylar: kesinAylar, emekliTaban: emekliTaban,
    memurTaban: memurTaban, memurIkinciYari: memurIkinciYari, farkEsigi: farkEsigi,
    mtvOrani2026: mtvOrani2026, ydo2026: ydo2026, mtvYdoPayi: mtvYdoPayi
  };
});
