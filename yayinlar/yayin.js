/*!
 * Yayımlanmış çalışmalar: künyeler ve türetmeleri.
 *
 * KAYNAK
 * ------
 * Her künye Zenodo'nun kendi kaydından alındı (zenodo.org/api/records/<id>),
 * sitedeki yazılardan değil. Sebep: site yazıları çalışmayı ANLATIYOR;
 * çalışmanın kendisi Zenodo'da duruyor ve kanonik künye oradadır.
 *
 * 19 Ekim 2026'da Zenodo kayıtlarıyla yeniden karşılaştırıldı:
 * 22819842 ve 22819909 başlık ayraçları, 22818390 özeti artık doğru.
 * Önceki düzeltme uyarıları bu nedenle kaldırıldı. İki Türkçe çalışmanın
 * İngilizce kayıt özeti bulunması bir hata olarak sunulmuyor.
 * pdf alanları, Zenodo dosyalarıyla MD5 eşleşen değişmemiş tam metinlerdir.
 *
 * 23 Kasım 2026: 24446986 ve 24446973 eklendi (Zenodo kaydından; tür
 * "Preprint", öncekiler "Working paper"; tür artık çalışma başına `tur`).
 * Bu ikisinin yerel PDF kopyası yok (pdf: null): künye DOI ile Zenodo'ya
 * bağlanır. Site sahibinin kararı: yeni kayıtlarda yerel kopya tutulmaz.
 *
 * 23 Kasım 2026: ORCID'de olup listede olmayan iki kayıt eklendi:
 * 23771234 (Working paper, hanehalkı bütçesi) ve 23718278 (Hesap
 * Çekirdeği yazılımı: tür Software, lisans MIT, dil İngilizce, şema
 * SoftwareSourceCode). Figshare ve SSRN kayıtları listedeki çalışmaların
 * başka depolardaki kopyaları; ayrıca listelenmiyor.
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
      pdf: "yayinlar/dosyalar/22819021.pdf",
      tarih: "2026-09-09",
      baslik: "Ücret Üzerindeki Zorunlu Yükün Biçimi: Türkiye'de Vergi " +
        "Kamasının Prim Tavanında Kırılması (2026 Parametreleriyle Bir " +
        "Ölçüm ve Kapalı Form Türetme)",
      zenodoBaslik: null,
      sayfa: "makaleler/vergi-kamasi-ucretin-gercek-yuku",
      arac: { yol: "vergi-kamasi-hesaplama", ad: "Vergi Kaması Hesaplama" },
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22819842",
      pdf: "yayinlar/dosyalar/22819842.pdf",
      tarih: "2026-09-10",
      baslik: "OECD Verileriyle Türkiye Ekonomisinin Finansal Haritası: " +
        "Tasarruf, Yatırım, Borçluluk ve Sermaye Akımları",
      zenodoBaslik: null,
      sayfa: "makaleler/tasarruf-kimde-finansman-kimde",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22819909",
      pdf: "yayinlar/dosyalar/22819909.pdf",
      tarih: "2026-09-13",
      baslik: "Türkiye'de Emekliliğin Finansal Matematiği: Nüfus " +
        "yaşlanması, çalışma hayatı, gelir ve tasarruf ilişkileri",
      zenodoBaslik: null,
      sayfa: "makaleler/emekliligin-finansal-matematigi",
      kendiDoi: true,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22818390",
      pdf: "yayinlar/dosyalar/22818390.pdf",
      tarih: "2026-09-15",
      baslik: "Endekslemenin Aritmetiği: Türkiye'de Ücret Vergisi " +
        "Tarifesinde Dilim Kayması (2022–2026 Dönemi İçin Bir Ölçüm ve " +
        "Bir Nötrleştirme Önermesi)",
      zenodoBaslik: null,
      sayfa: "makaleler/dilim-kaymasi-2022-2026",
      /* 2026-09-25: yöntem kişiye uygulanabilir bir araç oldu. */
      arac: { yol: "dilim-kaymasi-hesaplama", ad: "Dilim Kayması Hesaplama" },
      kendiDoi: true,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22852165",
      pdf: "yayinlar/dosyalar/22852165.pdf",
      tarih: "2026-09-20",
      baslik: "Akış ve Stok: BES Devlet Katkısının Efektif Getirisi ve " +
        "2026 İndiriminin Ufuk Etkisi (Eşleşme, Hak Ediş ve Fon " +
        "Giderlerinin Birleşik Bir Ölçümü)",
      zenodoBaslik: null,
      /* 21 Eylül 2026'da yazısı yayımlandı. */
      sayfa: "makaleler/bes-devlet-katkisi-ne-kadar-degerli",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: true
    },
    {
      doi: "10.5281/zenodo.22852342",
      pdf: "yayinlar/dosyalar/22852342.pdf",
      tarih: "2026-09-20",
      baslik: "Faiz Oranı Değişimlerinin Banka Kârlılığı ve Kredi " +
        "Büyümesine Etkisi: Türkiye'de Fiyat ve Miktar Araçlarının " +
        "Ayrışması (2021–2026)",
      zenodoBaslik: null,
      sayfa: "makaleler/kredi-tavani-ve-banka-karliligi",
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: true
    },
    /* 2026-09-27: ORCID'e düşen iki yeni kayıt. Künye, dil (tur), lisans
       ve özet Zenodo API'sinden okundu; iki özet de başlıktaki çalışmayı
       anlatıyor. Henüz sitede anlatan yazıları yok: sayfa bunu açıkça
       söylüyor. */
    {
      doi: "10.5281/zenodo.22972368",
      pdf: "yayinlar/dosyalar/22972368.pdf",
      tarih: "2026-09-26",
      baslik: "Yüksek Enflasyon Ortamında Sermaye Yapısı Kararları ve " +
        "Finansal Kaldıracın Ölçümü: TMS 29 Uygulamasının Kuramsal ve " +
        "Yöntemsel Sonuçları",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.22972569",
      pdf: "yayinlar/dosyalar/22972569.pdf",
      tarih: "2026-09-26",
      baslik: "Gelişmekte Olan Hisse Senedi Piyasalarında Yatırımcı " +
        "Duyarlılığı ve Arbitraj Sınırları: Borsa İstanbul İçin Kuramsal " +
        "Bir Çerçeve ve Sınanabilir Önermeler",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    /* 20 Ekim 2026, Zenodo türü Software: npm paketinin (1.3.0) değişmemiş
       arşivi. Lisansı, dili ve şema türü çalışma metinlerinden farklı. */
    {
      doi: "10.5281/zenodo.23718278",
      pdf: null,
      pdfYok: "yazılım kaydı; Zenodo'daki dosya npm paketinin değişmemiş arşivi",
      tarih: "2026-10-20",
      tur: "Software",
      schemaTur: "SoftwareSourceCode",
      lisans: { ad: "MIT", url: "https://opensource.org/licenses/MIT" },
      dil: "en",
      surum: "1.3.0",
      kod: {
        github: "https://github.com/onerkoray/hesap-cekirdegi",
        npm: "https://www.npmjs.com/package/hesap-cekirdegi"
      },
      baslik: "Hesap Çekirdeği: Payroll, Tax and Financial Calculation " +
        "Software for Türkiye (v1.3.0)",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    /* 29 Ekim 2026, Zenodo türü Working paper (sürüm 1.1). */
    {
      doi: "10.5281/zenodo.23771234",
      pdf: null,
      pdfYok: "tam metin Zenodo kaydında; yerel kopya tutulmuyor, DOI bağlantısı yeterli",
      tarih: "2026-10-29",
      baslik: "Türkiye'de Hanehalkı Bütçesinin Konuta Kayışı ve Fiyat " +
        "Şoklarına Duyarlılık",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    /* 22 Kasım 2026, Zenodo türü Preprint. */
    {
      doi: "10.5281/zenodo.24446973",
      pdf: null,
      pdfYok: "tam metin Zenodo kaydında; yerel kopya tutulmuyor, DOI bağlantısı yeterli",
      tarih: "2026-11-22",
      tur: "Preprint",
      baslik: "Faktör Hayvanat Bahçesi ve Tekrarlanabilirlik Tartışması: " +
        "Hisse Senedi Getiri Anomalilerinin Güvenilirliği ve Küçük " +
        "Piyasalar İçin Çıkarımlar",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    },
    {
      doi: "10.5281/zenodo.24446986",
      pdf: null,
      pdfYok: "tam metin Zenodo kaydında; yerel kopya tutulmuyor, DOI bağlantısı yeterli",
      tarih: "2026-11-22",
      tur: "Preprint",
      baslik: "Faiz Oranı Riski, Mevduat İmtiyazı ve Banka Kırılganlığı: " +
        "Vade Dönüşümünün Ekonomisi Üzerine Analitik Bir İnceleme",
      zenodoBaslik: null,
      sayfa: null,
      kendiDoi: false,
      ozetSorunlu: false,
      ozetDiliFarkli: false
    }
  ];

  /* Varsayılanlar; farklı olan çalışma kendi `tur`, `lisans`, `dil` ve
     `schemaTur` alanını taşır (bugün yalnız yazılım kaydı). */
  var TUR = "Working paper";
  var LISANS = { ad: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };

  /* ---------------------- türetmeler ------------------------------- */

  function yil(c) { return parseInt(c.tarih.slice(0, 4), 10); }

  function adres(c) { return DOI_KOK + c.doi; }
  function tur(c) { return c.tur || TUR; }
  function lisans(c) { return c.lisans || LISANS; }
  function dil(c) { return c.dil || "tr"; }
  function schemaTur(c) { return c.schemaTur || "ScholarlyArticle"; }

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
    tur: tur,
    lisans: lisans,
    dil: dil,
    schemaTur: schemaTur,
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
