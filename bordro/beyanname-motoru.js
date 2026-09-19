/*!
 * Yıllık gelir vergisi beyannamesi motoru (GVK m.85–m.92)
 *
 * NE YAPAR: bir kişinin yıl içinde elde ettiği gelirleri alır ve iki
 * soruya cevap verir — beyanname vermek zorunda mı, veriyorsa ne
 * ödeyecek?
 *
 * ASIL ZORLUK BEYAN KARARINDA, VERGİ HESABINDA DEĞİL
 * ---------------------------------------------------
 * Tarifeyi uygulamak kolay. Zor olan, hangi gelirin beyannameye GİRDİĞİ:
 * GVK m.86 gelir türüne göre ayrı ölçütler koyuyor ve bunlar birbirine
 * giriyor. En sık yapılan hata, tevkifatlı gelirin haddini o gelirin
 * KENDİSİYLE karşılaştırmak. Kanun haddi "vergiye tâbi gelir toplamı"
 * için koyuyor — yani yanında başka geliri olan, kirası haddin altında
 * olsa bile beyanname verebilir.
 *
 * Bu sitenin kira motoru da uzun süre aynı hatayı yapıyordu
 * (2026-09-19'da düzeltildi): 350.000 TL işyeri kirası + 5.000.000 TL
 * başka gelirde "beyan edilmez" diyordu.
 *
 * KURALLAR (GVK m.86/1)
 * ---------------------
 *  (b) Tek işverenden alınan ve tamamı tevkif suretiyle vergilendirilmiş
 *      ücret beyan edilmez. Birden fazla işveren varsa, birinciden
 *      SONRAKİLERİN TOPLAMI ikinci gelir dilimini aşmıyorsa yine beyan
 *      edilmez. Ayrıca 7194 sayılı Kanunla: ücret toplamı dördüncü gelir
 *      dilimini aşarsa her hâlde beyan edilir.
 *  (c) Tevkifata tâbi menkul ve gayrimenkul sermaye iratları, VERGİYE
 *      TÂBİ GELİR TOPLAMI ikinci gelir dilimini aşmıyorsa beyan edilmez.
 *  (d) Tevkifata ve istisnaya konu OLMAYAN menkul ve gayrimenkul sermaye
 *      iratları, toplamı tevkifatsız haddi aşmıyorsa beyan edilmez. Bu,
 *      (c)'den AYRI bir testtir; iki bendin toplamları birleştirilmez.
 *
 * Ticari kazanç ve serbest meslek kazancı m.85 uyarınca her hâlde beyan
 * edilir; tutarın bir önemi yoktur.
 *
 * SIRA ÖNEMLİ VE DÖNGÜSEL DEĞİL
 * -----------------------------
 * (b) önce çözülür, çünkü (c)'nin toplamına ücretin ancak BEYANA GİREN
 * kısmı dahil olur. Sonra (c) ve (d) çözülür. (c)'nin toplamı, test
 * edilen tevkifatlı gelirleri de İÇERİR — "beyanı gerekip gerekmediğine
 * bakılmaksızın" ölçülür, yoksa kendi kendine gönderme olurdu.
 *
 * KAPSAM DIŞI — bilinçli
 * ----------------------
 * Değer artışı ve arızi kazançlar, yurt dışı gelirler, zirai kazanç,
 * basit usul, geçmiş yıl zararları, engellilik indirimi, yabancı ülkede
 * ödenen vergilerin mahsubu. Bunlar yok sayıldıkları için değil, doğru
 * modellenmeleri ayrı birer araç gerektirdiği için dışarıda; sonuçta
 * `kapsamDisi` alanı bunu söylüyor.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/beyanname-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var B = (typeof module === "object" && module.exports)
    ? require("./motor.js")
    : root.Bordro;
  var G = (typeof module === "object" && module.exports)
    ? require("./gmsi-motor.js")
    : root.GmsiMotor;
  var v = factory(B, G);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BeyannameMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, G) {
  "use strict";

  function yuvarla(n) { return Math.round(n * 100) / 100; }
  function sayi(v) { return Math.max(0, Number(v) || 0); }

  /* Kanunun atıf yaptığı eşikler. Tutar değil, DİLİM SIRASI sabit. */
  function esikler(yil) {
    var P = B.parametre(yil), b = P.beyan;
    return {
      sonrakiIsverenler: P.dilimler[b.sonrakiIsverenDilimi][0],
      ucretToplami: P.dilimler[b.ucretToplamiDilimi][0],
      tevkifatli: P.dilimler[b.tevkifatliDilimi][0],
      tevkifatsiz: P.gmsi ? P.gmsi.tevkifatsizHad : null
    };
  }

  /* --- ücret tarafı (m.86/1-b) ---------------------------------------
     Girdi iki biçimden biri olabilir:
       { aylikBrut: 60000 }            -> bordro motoruyla benzetilir
       { safi: 700000, kesilen: 90000 } -> bordronuzdan okunan tutarlar
     İlk işveren istisnayı alır; sonrakiler almaz (GVK m.23/18 tek
     işverende uygulanır). */
  function ucretDegerlendir(ucretler, yil) {
    var liste = (ucretler || []).map(function (u) { return u; })
      .filter(function (u) { return u && (sayi(u.aylikBrut) > 0 || sayi(u.safi) > 0); });
    if (!liste.length) {
      return { var: false, safiToplam: 0, kesilen: 0, beyanaGirer: false,
               sonrakilerToplami: 0, isverenSayisi: 0 };
    }

    /* Büyükten küçüğe: en yüksek ücret "birinci işveren" sayılır. */
    var cozulmus = liste.map(function (u, i) {
      if (sayi(u.safi) > 0) {
        return { safi: sayi(u.safi), kesilen: sayi(u.kesilen), benzetim: false };
      }
      return { aylikBrut: sayi(u.aylikBrut), benzetim: true };
    });

    /* Benzetilenler için önce kabaca büyüklük sırası gerekiyor. */
    cozulmus.sort(function (a, b2) {
      var x = a.benzetim ? a.aylikBrut * 12 : a.safi;
      var y = b2.benzetim ? b2.aylikBrut * 12 : b2.safi;
      return y - x;
    });

    cozulmus.forEach(function (u, i) {
      if (!u.benzetim) return;
      var r = B.hesaplaYil(u.aylikBrut, yil, { istisnasiz: i > 0 });
      var safi = 0, kesilen = 0;
      r.aylar.forEach(function (a) { safi += a.matrah; kesilen += a.gelirVergisi; });
      u.safi = safi;
      u.kesilen = kesilen;
    });

    var safiToplam = 0, kesilen = 0;
    cozulmus.forEach(function (u) { safiToplam += u.safi; kesilen += u.kesilen; });
    var sonrakiler = safiToplam - cozulmus[0].safi;

    var E = esikler(yil);
    var sonrakiAsti = sonrakiler > E.sonrakiIsverenler;
    var toplamAsti = safiToplam > E.ucretToplami;

    return {
      var: true,
      isverenSayisi: cozulmus.length,
      safiToplam: safiToplam,
      kesilen: kesilen,
      sonrakilerToplami: sonrakiler,
      sonrakiAsti: sonrakiAsti,
      toplamAsti: toplamAsti,
      beyanaGirer: sonrakiAsti || toplamAsti,
      isverenler: cozulmus
    };
  }

  /* --- ana hesap ------------------------------------------------------ */
  function hesapla(g) {
    g = g || {};
    var yil = g.yil || B.sonYil();
    /* motor.parametre() tanimsiz yilda HATA FIRLATIYOR, null dondurmuyor.
       Bu arac bir sayfadan cagriliyor; cagri cokerse kullanici bos ekran
       gorur. Hata burada temiz bir sonuca cevriliyor. */
    var P;
    try { P = B.parametre(yil); } catch (e) { P = null; }
    if (!P) {
      return { hata: yil + " yılı için parametreler tanımlı değil.",
               tanimliYillar: B.yillar().slice().sort(function (a, b) { return a - b; }) };
    }
    var E = esikler(yil);
    var notlar = [];

    /* 1) Her hâlde beyana giren kazançlar (m.85). */
    var serbest = sayi(g.serbestMeslek);
    var ticari = sayi(g.ticariKazanc);
    var herHalde = serbest + ticari;

    /* 2) Ücret (m.86/1-b). */
    var ucret = ucretDegerlendir(g.ucretler, yil);
    var ucretMatrah = ucret.beyanaGirer ? ucret.safiToplam : 0;

    if (ucret.var && ucret.beyanaGirer) {
      notlar.push(ucret.toplamAsti
        ? "Ücret toplamınız " + E.ucretToplami.toLocaleString("tr-TR") +
          " TL'yi aştığı için ücret gelirleriniz beyana giriyor (GVK m.86/1-b)."
        : "Birinci işveren dışındaki ücretlerinizin toplamı " +
          E.sonrakiIsverenler.toLocaleString("tr-TR") +
          " TL'yi aştığı için ücretlerinizin TAMAMI beyana giriyor (GVK m.86/1-b).");
    } else if (ucret.var) {
      notlar.push("Ücret geliriniz beyana girmiyor; kesilen gelir vergisi nihai " +
        "vergidir (GVK m.86/1-b). Bu ücret, diğer gelirlerin beyan sınırı " +
        "testine de dahil edilmez.");
    }

    /* 3) Kira gelirleri — mevcut GMSİ motoru kullanılıyor.
          İkinci bir kira uygulaması YAZILMADI: istisna, iki gider yöntemi
          ve m.86/1-c ölçütü orada test edilmiş durumda. */
    var kira = null, kiraSafi = 0, kiraStopaj = 0;
    var konut = sayi(g.konutKira), isyeri = sayi(g.isyeriKira);
    if (konut + isyeri > 0) {
      kira = G.hesapla({
        yil: yil,
        konutKira: konut,
        isyeriKira: isyeri,
        gercekGider: sayi(g.gercekGider),
        ticariBeyan: herHalde > 0,
        /* m.21 üst sınır testi GAYRİ SAFİ toplam ister; ücretin beyana
           girip girmediğine bakılmaz. */
        brutGelirToplami: ucret.safiToplam + herHalde + sayi(g.msiTevkifatli),
        /* m.86/1-c ölçütüne giren "diğer vergiye tâbi gelir". */
        digerGelir: ucretMatrah + herHalde + sayi(g.msiTevkifatli)
      });
      if (!kira.hata) {
        var secilen = kira.avantajli === "gercek" ? kira.gercek : kira.goturu;
        kiraSafi = secilen.safiIrat;
        kiraStopaj = kira.isyeriStopaj;
        (kira.notlar || []).forEach(function (n) { notlar.push(n); });
      }
    }

    /* 4) Tevkifatlı MSİ (m.86/1-c). Ölçüt kiradakiyle aynı toplam. */
    var msi = sayi(g.msiTevkifatli);
    var msiStopaj = sayi(g.msiStopaj);
    var tabiToplam = ucretMatrah + herHalde + kiraSafi + msi;
    var msiBeyanaGirer = msi > 0 && tabiToplam > E.tevkifatli;
    if (msi > 0 && !msiBeyanaGirer) {
      notlar.push("Menkul sermaye iradınız ve diğer vergiye tâbi gelirlerinizin " +
        "toplamı " + E.tevkifatli.toLocaleString("tr-TR") + " TL beyan sınırının " +
        "altında; menkul sermaye iradı beyan edilmez (GVK m.86/1-c).");
    }
    var msiMatrah = msiBeyanaGirer ? msi : 0;

    /* 4b) Tevkifatsiz MSI/GMSI (m.86/1-d).
          BU AYRI BIR TESTTIR. (c) ile ortak toplam kullanilmaz: tevkifatli
          ve tevkifatsiz iratlar iki ayri bent uyarinca AYRI AYRI
          degerlendirilir. Haddi asarsa TAMAMI beyana girer; had bir
          muafiyet degil esiktir.

          Bu alan olmadan, yalnizca tevkifatsiz iradi olan birine arac
          "beyanname gerekmiyor" diyordu -- 22.000 TL'lik had hic
          uygulanmiyordu. Hata guvensiz yondeydi. */
    var tevkifatsiz = sayi(g.tevkifatsizIrat);
    var tevkifatsizBeyanaGirer = tevkifatsiz > E.tevkifatsiz;
    var tevkifatsizMatrah = tevkifatsizBeyanaGirer ? tevkifatsiz : 0;
    if (tevkifatsiz > 0 && !tevkifatsizBeyanaGirer) {
      notlar.push("Tevkifata ve istisnaya konu olmayan irat toplamınız " +
        E.tevkifatsiz.toLocaleString("tr-TR") + " TL haddini aşmadığı için " +
        "beyan edilmez (GVK m.86/1-d). Bu had, tevkifatlı gelirlerin " +
        "sınırından AYRI değerlendirilir.");
    } else if (tevkifatsizBeyanaGirer) {
      notlar.push("Tevkifatsız iradınız " + E.tevkifatsiz.toLocaleString("tr-TR") +
        " TL haddini aştığı için TAMAMI beyana giriyor (GVK m.86/1-d).");
    }

    /* 5) Matrah ve m.89 indirimleri.
          İndirimler "beyan edilen gelirin" yüzdesi olarak sınırlı,
          dolayısıyla önce beyana giren gelir toplanır. */
    var beyanGeliri = ucretMatrah + herHalde + kiraSafi + msiMatrah +
                      tevkifatsizMatrah;
    var ind = indirimler(beyanGeliri, g, yil);
    var matrah = Math.max(0, beyanGeliri - ind.toplam);

    /* 6) Hangi tarife?
          GVK m.103 ücret gelirleri için üçüncü dilimi daha geniş tutuyor
          (2026: 1.500.000 / 1.000.000). Matrah TEK TÜRDEN ibaretse cevap
          açık. Karma beyannamede hangi tarifenin uygulanacağını kaynakla
          doğrulayamadık.

          Bu yüzden karma durumda İHTİYATLI taraf seçiliyor: ücret dışı
          tarife. Ölçüldü — iki tarife arasındaki fark en çok 40.000 TL ve
          yalnızca matrah 1.000.000'in üstündeyken doğuyor. Ters seçim
          vergiyi EKSİK gösterirdi, yani mükellefi az ödemeye iterdi;
          hatanın güvenli yönü fazla göstermektir.

          Kaynak bulunduğunda burası tek okumaya indirilecek. */
    var ucretDisiVar = (beyanGeliri - ucretMatrah) > 0;
    var tarife = (ucretMatrah > 0 && !ucretDisiVar)
      ? P.dilimler : P.dilimlerUcretDisi;
    var hesaplanan = B.tarifeVergisi(matrah, tarife);

    /* 7) Mahsup. Beyana GİRMEYEN gelirin stopajı mahsup EDİLMEZ. */
    var mahsup = (ucret.beyanaGirer ? ucret.kesilen : 0) +
                 kiraStopaj +
                 (msiBeyanaGirer ? msiStopaj : 0) +
                 sayi(g.serbestStopaj) + sayi(g.gecicVergi);

    var fark = hesaplanan - mahsup;
    var beyannameVar = beyanGeliri > 0;

    return {
      yil: yil,
      beyannameVar: beyannameVar,
      esikler: E,
      ucret: ucret,
      kira: kira,
      msi: { tutar: msi, beyanaGirer: msiBeyanaGirer, stopaj: msiStopaj },
      tevkifatsizIrat: { tutar: tevkifatsiz, beyanaGirer: tevkifatsizBeyanaGirer,
                         had: E.tevkifatsiz },
      serbestMeslek: serbest,
      ticariKazanc: ticari,
      vergiyeTabiToplam: yuvarla(tabiToplam),
      beyanGeliri: yuvarla(beyanGeliri),
      indirimler: ind,
      matrah: yuvarla(matrah),
      tarifeTuru: tarife === P.dilimler ? "ucret" : "ucret-disi",
      hesaplananVergi: yuvarla(hesaplanan),
      mahsup: yuvarla(mahsup),
      odenecek: yuvarla(Math.max(0, fark)),
      iade: yuvarla(Math.max(0, -fark)),
      taksitler: taksitle(Math.max(0, fark), yil),
      notlar: notlar,
      kapsamDisi: ["değer artışı ve arızi kazançlar", "yurt dışı gelirler",
                   "zirai kazanç", "basit usul", "geçmiş yıl zararları",
                   "engellilik indirimi"]
    };
  }

  /* GVK m.89 indirimleri. Her biri BEYAN EDİLEN GELİRİN yüzdesiyle
     sınırlı; şahıs sigortasında ayrıca yıllık asgari ücret tavanı var ve
     o tavan parametreden değil asgari ücretten TÜRETİLİYOR. */
  function indirimler(beyanGeliri, g, yil) {
    var P = B.parametre(yil), b = P.beyan;
    var yillikAsgari = P.donemler[0].asgariBrut * 12;

    function sinirli(talep, oran, ekTavan) {
      var t = sayi(talep);
      var sinir = beyanGeliri * oran;
      if (ekTavan !== undefined && ekTavan !== null) sinir = Math.min(sinir, ekTavan);
      return { talep: t, sinir: yuvarla(sinir), indirilen: yuvarla(Math.min(t, sinir)) };
    }

    var egitim = sinirli(g.egitimSaglik, b.egitimSaglikOrani);
    var bagis = sinirli(g.bagis, b.bagisOrani);
    var sigorta = sinirli(g.sahisSigorta, b.sahisSigortaOrani, yillikAsgari);

    return {
      egitimSaglik: egitim,
      bagis: bagis,
      sahisSigorta: sigorta,
      sahisSigortaTavani: yuvarla(yillikAsgari),
      toplam: yuvarla(egitim.indirilen + bagis.indirilen + sigorta.indirilen)
    };
  }

  /* GVK m.117: iki eşit taksit, mart ve temmuz. */
  function taksitle(tutar, yil) {
    var aylar = B.parametre(yil).beyan.taksitAylari;
    if (!(tutar > 0)) return [];
    var ilk = Math.round(tutar / 2 * 100) / 100;
    return [
      { ay: aylar[0], tutar: ilk },
      { ay: aylar[1], tutar: yuvarla(tutar - ilk) }
    ];
  }

  return {
    hesapla: hesapla,
    esikler: esikler,
    ucretDegerlendir: ucretDegerlendir,
    indirimler: indirimler
  };
});
