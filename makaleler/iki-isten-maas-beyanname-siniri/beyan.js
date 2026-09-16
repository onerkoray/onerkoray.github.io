/*!
 * Birden fazla işverenden ücret: yıllık beyan yükümlülüğü ve tutarları.
 *
 * NEDEN AYRI MODÜL
 * ----------------
 * Kural üç ayrı yerde lazım: yazının tabloları, testi ve ileride bir araç.
 * Üç yere ayrı ayrı yazılsaydı biri güncellenip diğerleri sessizce eskirdi.
 * Buradaki hiçbir sayı elle yazılmıyor; hepsi bordro/parametreler.js'ten
 * türüyor. Tek istisna kanunun kendi atıfları — onlar da tarifedeki dilim
 * SIRASI olarak duruyor (dilimler[1], dilimler[3]), tutar olarak değil.
 *
 * KURAL (GVK m.86/1-b; 7194 sayılı Kanunla eklenen dördüncü dilim ölçütü)
 * ----------------------------------------------------------------------
 * Tevkif yoluyla vergilendirilmiş ücretler kural olarak beyan edilmez.
 * İki durumda beyan zorunlu hale gelir:
 *
 *   1. Birinciden SONRAKİ işverenlerden alınan ücretlerin toplamı,
 *      tarifenin İKİNCİ gelir diliminde yer alan tutarı aşarsa;
 *   2. Ya da birinci işveren dahil ücretlerin TOPLAMI, tarifenin
 *      DÖRDÜNCÜ gelir diliminde yer alan tutarı aşarsa.
 *
 * Aşılırsa ücretlerin TAMAMI (birinci işverenden alınan dahil) beyan edilir.
 *
 * "BİRİNCİ İŞVEREN" SEÇİLİR, EN BÜYÜK OLMAK ZORUNDA DEĞİL
 * -------------------------------------------------------
 * Hangi işverenin birinci sayılacağını ücretli serbestçe belirler (GİB,
 * Ücret Geliri Elde Edenler İçin Vergi Rehberi). Toplamı küçültmek için
 * hariç tutulması gereken, EN BÜYÜK ücrettir. Burada varsayılan davranış
 * budur; yanlış seçimin sonucu da ayrıca hesaplanabiliyor (bkz. secim()).
 *
 * SINIR SAFİ TUTARLA KARŞILAŞTIRILIR
 * ----------------------------------
 * Gayrisafi ücretten GVK m.63'teki indirimler (SGK + işsizlik primi)
 * düşüldükten sonra kalan tutar karşılaştırılır. Rehberin kendi örneği
 * 480.000 TL brüt ücretten %15 düşüp 408.000 TL ile kıyaslıyor. Oran
 * buraya yazılmıyor, parametrelerden geliyor.
 *
 * İSTİSNA BİR KEZ, BEYANNAMEDE MAHSUP İSTİSNA ÖNCESİ TUTARLA
 * ----------------------------------------------------------
 * Asgari ücret istisnasını yalnızca en yüksek ücretin ödendiği işveren
 * uygular (GVK m.23/1-18; 319 seri no.lu GVK Genel Tebliği m.7). Beyanname
 * verilirse istisnaya beyannamede yer verilmez; hesaplanan vergiden "yıl
 * içinde istisna öncesi hesaplanan vergiler" mahsup edilir (aynı Tebliğ,
 * m.9). Sonuç, toplam matraha tarifenin bir kez uygulanıp istisnanın bir
 * kez düşülmesine denk gelir — modül bunu ayrıca doğruluyor.
 *
 * KAPSAM
 * ------
 * Her iş, ayın tamamında ve asgari ücretin altına düşmeyen bir brütle
 * çalışılıyor varsayılıyor. Asgari ücretin altındaki brütlerde prime esas
 * kazanç tabana çekildiği için motor eksik günlü/kısmi süreli çalışmayı
 * temsil etmez; o yüzden böyle bir girdi kabul edilmiyor, sessizce yanlış
 * sayı üretmek yerine hata veriyor.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.Beyan = fabrika(kok.BordroMotor);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  /* Ücretin safi tutarına giden kesinti oranı: SGK + işsizlik işçi payı. */
  function kesintiOrani(P) {
    return P.oranlar.sgkIsci + P.oranlar.issizlikIsci;
  }

  /* Yılın herhangi bir döneminde geçerli olan EN YÜKSEK asgari brüt.
     Kapsam kontrolü buna göre yapılıyor: yıl ortasında zam varsa, yılın
     tamamında asgari ücretin üstünde kalmak için yüksek olanı aşmak
     gerekir. */
  function asgariTavani(P) {
    return (P.donemler || []).reduce(function (e, d) {
      return Math.max(e, d.asgariBrut);
    }, 0);
  }

  /* Yılın ağırlıklı ortalama aylık asgari brütü (dönem uzunluklarıyla). */
  function asgariAylik(P) {
    var d = P.donemler || [], t = 0;
    d.forEach(function (dn, i) {
      t += dn.asgariBrut * ((i + 1 < d.length ? d[i + 1].ay : 13) - dn.ay);
    });
    return t / 12;
  }

  /* Kanunun atıf yaptığı iki sınır. Tutar değil, dilim SIRASI sabit. */
  function sinirlar(yil) {
    var P = B.parametre(yil);
    return {
      sonrakiIsverenler: P.dilimler[1][0],   // ikinci gelir dilimi
      ucretToplami: P.dilimler[3][0]         // dördüncü gelir dilimi
    };
  }

  /* Tek bir işverenin yıllık bordrosu.
     istisnali=false ise ikinci ve sonraki işveren: ne gelir vergisi
     istisnası ne damga istisnası uygular, ama tarife yine sıfırdan başlar. */
  function isveren(aylikBrut, yil, istisnali) {
    var P = B.parametre(yil);
    var taban = asgariTavani(P);
    if (!(aylikBrut >= taban)) {
      throw new Error("Kapsam dışı: aylık brüt " + aylikBrut +
        " TL, " + yil + " asgari brütünün (" + taban + " TL) altında. " +
        "Kısmi süreli çalışma bu modülle hesaplanmaz.");
    }
    var r = B.hesaplaYil(aylikBrut, yil, { istisnasiz: !istisnali });
    var matrah = 0, tarife = 0;
    r.aylar.forEach(function (a) { matrah += a.matrah; tarife += a.vergiTarife; });
    return {
      aylikBrut: aylikBrut,
      brut: r.toplam.brut,
      safi: matrah,                    // beyan sınırıyla karşılaştırılan tutar
      tarifeVergisi: tarife,           // istisna ÖNCESİ hesaplanan vergi
      kesilen: r.toplam.gelirVergisi,  // fiilen tevkif edilen
      istisna: r.toplam.istisna,
      /* Damga vergisi de istisnaya tabi ve o istisna da yalnizca en yuksek
         ucrete uygulaniyor (488 sayili Kanuna ekli (2) sayili tablo). Yazi
         bunu iddia ettigi icin disa aciliyor ve test sabitliyor. */
      damga: r.toplam.damga
    };
  }

  /* Bir ücretlinin bütün işverenleri. aylikBrutlar: aylık brüt dizisi.
     En yüksek ücret hem istisnayı alır hem "birinci işveren" sayılır. */
  function degerlendir(aylikBrutlar, yil) {
    if (!aylikBrutlar || aylikBrutlar.length < 1) {
      throw new Error("En az bir işveren gerekir.");
    }
    var P = B.parametre(yil);
    var S = sinirlar(yil);

    var sirali = aylikBrutlar.slice().sort(function (a, b) { return b - a; });
    var isverenler = sirali.map(function (a, i) {
      return isveren(a, yil, i === 0);
    });

    var toplamSafi = 0, kesilen = 0, mahsup = 0, istisna = 0;
    isverenler.forEach(function (o) {
      toplamSafi += o.safi;
      kesilen += o.kesilen;
      mahsup += o.tarifeVergisi;
      istisna += o.istisna;
    });
    var sonrakiler = toplamSafi - isverenler[0].safi;

    var sonrakiAsti = sonrakiler > S.sonrakiIsverenler;
    var toplamAsti = toplamSafi > S.ucretToplami;
    var beyanVar = sonrakiAsti || toplamAsti;

    var hesaplanan = B.tarifeVergisi(toplamSafi, P.dilimler);
    var odenecek = beyanVar ? hesaplanan - mahsup : 0;

    return {
      yil: yil,
      isverenler: isverenler,
      toplamSafi: toplamSafi,
      sonrakilerToplami: sonrakiler,
      sinirlar: S,
      sonrakiAsti: sonrakiAsti,
      toplamAsti: toplamAsti,
      beyanVar: beyanVar,
      kesilen: kesilen,
      istisna: istisna,
      hesaplanan: hesaplanan,
      mahsup: mahsup,
      odenecek: odenecek,
      toplamVergi: kesilen + odenecek
    };
  }

  /* Aynı toplam brütü TEK işverenden alan çalışanın yıllık gelir vergisi.
     Karşılaştırmanın anlamlı olması için toplamın SGK tavanını aşmaması
     gerekir; aşarsa tek işveren tavandan keser, iki işveren kesmez ve fark
     artık tarifeden değil primden gelir. Bu durum ayrıca işaretleniyor. */
  function tekIsveren(aylikBrutToplami, yil) {
    var P = B.parametre(yil);
    var tavanAsimi = (P.donemler || []).some(function (d) {
      return aylikBrutToplami > d.sgkTavan;
    });
    var o = isveren(aylikBrutToplami, yil, true);
    o.sgkTavaniAsiliyor = tavanAsimi;
    return o;
  }

  /* Eşik uçurumu: sonraki işverenler toplamı sınırı tam olarak yakalarken
     bir kuruş aşmanın maliyeti. Beyan doğduğu anda ödenecek vergi sıfırdan
     bu tutara sıçrar; gelirdeki artış ise bir kuruştur.

     Kapalı biçimi de veriliyor:  sınır × birleşik marjinal oran − tarife(sınır)
     Sınır dilimi tek başına bir banda düşüyorsa ikisi birebir eşittir;
     banda yayılıyorsa motorun değeri esastır ve fark raporlanır. */
  function ucurum(birinciAylikBrut, yil) {
    var P = B.parametre(yil);
    var S = sinirlar(yil);
    var k = kesintiOrani(P);
    var ikinciAylik = S.sonrakiIsverenler / (1 - k) / 12;

    var d = degerlendir([birinciAylikBrut, ikinciAylik], yil);
    /* Sınır tam yakalandığında beyan yok; bir kuruş aşınca doğacak borç
       hesaplanan − mahsup kadardır. */
    var borc = d.hesaplanan - d.mahsup;
    var marj = B.dilimOrani(d.toplamSafi, P.dilimler);
    var kapali = S.sonrakiIsverenler * marj -
      B.tarifeVergisi(S.sonrakiIsverenler, P.dilimler);

    /* Kapalı biçim yalnızca sınır kadarlık dilim TEK bir banda düştüğünde
       geçerli. İki banda yayılıyorsa (tipik olarak birinci iş küçükken)
       motorun değeri esastır ve fark gerçektir, hata değildir. */
    var tekBanda = B.dilimOrani(d.toplamSafi - S.sonrakiIsverenler, P.dilimler) === marj;

    return {
      birinciAylikBrut: birinciAylikBrut,
      ikinciAylikBrut: ikinciAylik,
      toplamSafi: d.toplamSafi,
      marjinalOran: marj,
      borc: borc,
      kapaliBicim: kapali,
      tekBanda: tekBanda,
      sapma: borc - kapali,
      /* Sınır tam yakalandı: ikinci işverenler ölçütü tetiklenmemeli.
         toplamAsti ise beyan ZATEN zorunludur ve uçurum diye bir şey yoktur:
         o ücretli her hâlükârda beyanname veriyor. */
      beyanVar: d.beyanVar,
      toplamAsti: d.toplamAsti
    };
  }

  /* İkinci işin beyanname doğurmadan kalabildiği aylık brüt aralığı.
     Alt sınır asgari ücret (altı kapsam dışı), üst sınır beyan sınırının
     brüt karşılığı. Oran, aralığın ne kadar daraldığını gösteriyor. */
  function pencere(yil) {
    var P = B.parametre(yil);
    var k = kesintiOrani(P);
    var alt = asgariAylik(P);
    var ust = sinirlar(yil).sonrakiIsverenler / (1 - k) / 12;
    /* Tabloya ve yaziya giden deger AŞAĞI yuvarlanmali: yukari yuvarlamak
       sinirin OTESINE gecirir. 2026'da ust = 39.215,69; 39.216 TL/ay zaten
       beyan dogurur, 39.215 TL/ay dogurmaz. Bir liralik fark bu yuzden
       yaziya konu olabiliyor. */
    var guvenli = Math.floor(ust);
    return {
      yil: yil, alt: alt, ust: ust, guvenli: guvenli,
      oran: guvenli / alt, kesintiOrani: k
    };
  }

  /* "Birinci işveren"i yanlış seçmenin sonucu: en büyük yerine en küçük
     ücret hariç tutulursa sonrakiler toplamı büyür ve gereksiz beyan doğar. */
  function secim(aylikBrutlar, yil) {
    var S = sinirlar(yil);
    var sirali = aylikBrutlar.slice().sort(function (a, b) { return b - a; });
    var safiler = sirali.map(function (a, i) { return isveren(a, yil, i === 0).safi; });
    var toplam = safiler.reduce(function (t, v) { return t + v; }, 0);
    var enBuyukHaric = toplam - safiler[0];
    var enKucukHaric = toplam - safiler[safiler.length - 1];
    return {
      safiler: safiler,
      enBuyukHaric: enBuyukHaric,
      enKucukHaric: enKucukHaric,
      dogruSecimBeyan: enBuyukHaric > S.sonrakiIsverenler,
      yanlisSecimBeyan: enKucukHaric > S.sonrakiIsverenler,
      secimOnemli: (enKucukHaric > S.sonrakiIsverenler) &&
                   !(enBuyukHaric > S.sonrakiIsverenler)
    };
  }

  /* Yazının kapsadığı yıllar: motorun asgari ücret istisnası rejimini
     uyguladığı yıllar. Öncesinde AGİ rejimi vardı ve "istisna en yüksek
     ücrete" kuralı yoktu; aynı tabloya konulamaz. */
  function kapsananYillar() {
    return B.yillar().filter(function (y) {
      return B.parametre(y).istisnaRejimi === "asgari-ucret";
    });
  }

  return {
    sinirlar: sinirlar,
    isveren: isveren,
    degerlendir: degerlendir,
    tekIsveren: tekIsveren,
    ucurum: ucurum,
    pencere: pencere,
    secim: secim,
    kapsananYillar: kapsananYillar,
    kesintiOrani: kesintiOrani,
    asgariAylik: asgariAylik
  };
});
