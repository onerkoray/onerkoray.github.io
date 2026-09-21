/*!
 * Yayımlanmış çalışmalar: künyeler ve türetmeleri.
 *
 * KAYNAK
 * ------
 * Her künye Zenodo'nun kendi kaydından alındı (zenodo.org/api/records/<id>),
 * sitedeki yazılardan değil. Sebep: site yazıları çalışmayı ANLATIYOR;
 * çalışmanın kendisi Zenodo'da duruyor ve kanonik künye oradadır.
 *
 * İKİ BAŞLIK NEDEN FARKLI YAZILIYOR
 * ---------------------------------
 * İki kayıtta alt başlık, ana başlığa ayraçsız yapışmış:
 *   22819842  "...Finansal Haritası Tasarruf, Yatırım..."
 *   22819909  "...Finansal Matematiği Nüfus yaşlanması..."
 * Bu bir Zenodo tarafı hatasıdır ve düzeltilecektir. Sitede okunabilir
 * biçim gösteriliyor; `zenodoBaslik` alanı kaydın BUGÜNKÜ hâlini olduğu
 * gibi saklıyor. Test ikisinin yalnızca ayraçla ayrıldığını doğruluyor —
 * yani site, Zenodo'da olmayan bir şey uydurmuyor. Zenodo düzeltilince
 * iki alan eşitlenecek ve test bunu söyleyecek.
 *
 * BİR KAYITTA ÖZET YANLIŞ
 * -----------------------
 * 22818390 "Endekslemenin Aritmetiği" başlığını taşıyor ama Zenodo'daki
 * özeti vergi kaması / prim tavanı çalışmasını anlatıyor: "dilim kayması",
 * "endeksleme" ve "tarife" kelimeleri özette HİÇ geçmiyor. Bu kayıt
 * işaretlendi; özet düzeltilene kadar sitede Zenodo özeti gösterilmiyor.
 *
 * TÜRETİLEBİLİR HİÇBİR ŞEY SAKLANMIYOR
 * ------------------------------------
 * Modülde ham künye var. Yıla göre gruplama, sıralama, DOI adresi ve
 * "kaç çalışma" sayıları BURADA hesaplanıyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.Yayin = fabrika();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DOI_KOK = "https://doi.org/";

  /* --- Çalışmalar (Zenodo kaydından; tarih sırasına göre) -----------
     baslik      : sitede gösterilen okunabilir biçim
     zenodoBaslik: kaydın bugünkü hâli (farklıysa yazılır, aynıysa null)
     sayfa       : çalışmayı sunan site yazısı (yoksa null)
     kendiDoi    : site yazısı çalışmanın KENDİSİ mi (kendi DOI'sini
                   taşıyor mu), yoksa onu anlatan ayrı bir yazı mı
     ozetSorunlu : Zenodo özeti bu çalışmayı anlatmıyor
     ozetDiliFarkli : kayıt dili türçe diyor ama özet İngilizce */
  var CALISMALAR = [
    {
      doi: "10.5281/zenodo.22819021",
      tarih: "2026-09-09",
      baslik: "Ücret Üzerindeki Zorunlu Yükün Biçimi: Türkiye'de Vergi " +
        "Kamasının Prim Tavanında Kırılması (2026 Parametreleriyle Bir " +
        "Ölçüm ve Kapalı Form Türetme)",
      zenodoBaslik: null,
      sayfa: "makaleler/vergi-kamasi-ucretin-gercek-yuku",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22819842",
      tarih: "2026-09-10",
      baslik: "OECD Verileriyle Türkiye Ekonomisinin Finansal Haritası: " +
        "Tasarruf, Yatırım, Borçluluk ve Sermaye Akımları",
      zenodoBaslik: "OECD Verileriyle Türkiye Ekonomisinin Finansal " +
        "Haritası Tasarruf, Yatırım, Borçluluk ve Sermaye Akımları",
      sayfa: "makaleler/tasarruf-kimde-finansman-kimde",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22819909",
      tarih: "2026-09-13",
      baslik: "Türkiye'de Emekliliğin Finansal Matematiği: Nüfus " +
        "yaşlanması, çalışma hayatı, gelir ve tasarruf ilişkileri",
      zenodoBaslik: "Türkiye'de Emekliliğin Finansal Matematiği Nüfus " +
        "yaşlanması, çalışma hayatı, gelir ve tasarruf ilişkileri",
      sayfa: "makaleler/emekliligin-finansal-matematigi",
      kendiDoi: true,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22818390",
      tarih: "2026-09-15",
      baslik: "Endekslemenin Aritmetiği: Türkiye'de Ücret Vergisi " +
        "Tarifesinde Dilim Kayması (2022–2026 Dönemi İçin Bir Ölçüm ve " +
        "Bir Nötrleştirme Önermesi)",
      zenodoBaslik: null,
      sayfa: "makaleler/dilim-kaymasi-2022-2026",
      kendiDoi: true,
      ozetSorunlu: true,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22852165",
      tarih: "2026-09-20",
      baslik: "Akış ve Stok: BES Devlet Katkısının Efektif Getirisi ve " +
        "2026 İndiriminin Ufuk Etkisi (Eşleşme, Hak Ediş ve Fon " +
        "Giderlerinin Birleşik Bir Ölçümü)",
      zenodoBaslik: null,
      /* Bu çalışmanın sitede sunan bir yazısı YOK. Altı çalışma
         içinde tek boşluk bu; site taramasıyla DOI arayan bir yöntemin
         onu bulamamasının sebebi de buydu. */
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: true
    },
    {
      doi: "10.5281/zenodo.22852342",
      tarih: "2026-09-20",
      baslik: "Faiz Oranı Değişimlerinin Banka Kârlılığı ve Kredi " +
        "Büyümesine Etkisi: Türkiye'de Fiyat ve Miktar Araçlarının " +
        "Ayrışması (2021–2026)",
      zenodoBaslik: null,
      sayfa: "makaleler/kredi-tavani-ve-banka-karliligi",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: true
    }
  ];

  /* Hepsi aynı türde ve lisansta; tekrar etmemek için burada duruyor. */
  var TUR = "Working paper";
  var LISANS = { ad: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };

  /* ---------------------- türetmeler ------------------------------- */

  function yil(c) { return parseInt(c.tarih.slice(0, 4), 10); }

  function adres(c) { return DOI_KOK + c.doi; }

  /* Yeniden eskiye. Kaynak dizi tarih sırasında; kopyalanıp ters
     çevriliyor ki çağıran diziyi bozmasın. */
  function yeniden() {
    return CALISMALAR.slice().sort(function (a, b) {
      if (a.tarih !== b.tarih) return a.tarih < b.tarih ? 1 : -1;
      /* Aynı gün yüklenen iki kayıtta sıra tesadüfe bırakılmaz:
         DOI numarası büyük olan (sonra oluşturulan) önce gelir. */
      return a.doi < b.doi ? 1 : (a.doi > b.doi ? -1 : 0);
    });
  }

  function yillar() {
    var g = [];
    CALISMALAR.forEach(function (c) {
      if (g.indexOf(yil(c)) < 0) g.push(yil(c));
    });
    return g.sort(function (a, b) { return b - a; });
  }

  function yilinCalismalari(y) {
    return yeniden().filter(function (c) { return yil(c) === y; });
  }

  /* Site yazısı çalışmanın kendisi olanlar: Highwire citation_* etiketi
     taşıyan ve Google Scholar'ın eşleyebileceği olanlar. */
  function kendiDoiTasiyan() {
    return CALISMALAR.filter(function (c) { return c.kendiDoi; });
  }

  /* Künyesi Zenodo'dakinden farklı yazılanlar. */
  function baslikFarki() {
    return CALISMALAR.filter(function (c) { return c.zenodoBaslik !== null; });
  }

  /* Kayıt dili türçe diyor ama özet İngilizce. Dil alanı altısında da
     dolu; eksik olan alan değil, özetin beyan edilen dilde olması. */
  function ozetDiliFarkli() {
    return CALISMALAR.filter(function (c) { return c.ozetDiliFarkli; });
  }

  function ozetiSorunlu() {
    return CALISMALAR.filter(function (c) { return c.ozetSorunlu; });
  }

  /* Bir çalışmayı DOI'siyle bul. */
  function calisma(doi) {
    var b = null;
    CALISMALAR.forEach(function (c) { if (c.doi === doi) b = c; });
    return b;
  }

  return {
    DOI_KOK: DOI_KOK, TUR: TUR, LISANS: LISANS,
    CALISMALAR: CALISMALAR,
    yil: yil,
    adres: adres,
    yeniden: yeniden,
    yillar: yillar,
    yilinCalismalari: yilinCalismalari,
    kendiDoiTasiyan: kendiDoiTasiyan,
    baslikFarki: baslikFarki,
    ozetiSorunlu: ozetiSorunlu,
    ozetDiliFarkli: ozetDiliFarkli,
    calisma: calisma
  };
});
