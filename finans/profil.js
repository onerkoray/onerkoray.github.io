/*!
 * Finansal Profil — Finansal İkiz'in omurgası
 *
 * NEDEN VAR: sitedeki araçların hepsi kullanıcıyı SIFIRDAN başlatıyor.
 * Altı kutu doldur, bir cevap al, sekmeyi kapat. Dün girdiğin maaşı bugün
 * tekrar giriyorsun; kredi aracına girdiğin borç, borç planı aracında yok.
 * Bir hesap makinesini derin yapan şey formülü değil HAFIZASI ve BAĞLAMI.
 * Bu dosya o hafıza.
 *
 * BU DOSYA HESAP YAPMAZ. Şema, doğrulama, sürümleme ve taşıma. Finansal
 * matematik motorlarda; profil onlara GİRDİ üretir. Ayrım bilinçli:
 * veri katmanı bozulursa her motor birden yanlışa döner, o yüzden burada
 * tek iş var ve o iş testli.
 *
 * ÜÇ TASARIM KARARI
 *
 * 1. SAKLAMA VARSAYILAN OLARAK KAPALI.
 *    Bu nesne kullanıcının maaşını, borcunu ve varlığını tutuyor —
 *    sitedeki en hassas veri. localStorage cihazda kalır ama PAYLAŞILAN
 *    bir bilgisayarda kalıcıdır. Saklama açık onay ister; onaysız profil
 *    yalnızca sekme açıkken yaşar. "Verileriniz cihazınızdan çıkmaz"
 *    iddiası ancak bu titizlikle dürüst olur.
 *
 * 2. SÜRÜM NUMARASI VE TAŞIMA, İLK GÜNDEN.
 *    Şema değişecek. Sürümsüz bir kayıt, ilk şema değişikliğinde ya
 *    sessizce yanlış okunur ya da kullanıcının verisini çöpe atar.
 *    Bilinmeyen bir sürüm REDDEDİLİR — tahmin edilmez.
 *
 * 3. OKUMA HER ZAMAN NORMALİZE EDER.
 *    Dışarıdan gelen her şey (localStorage, içe aktarılan dosya, elle
 *    yazılmış nesne) aynı kapıdan geçer: bilinmeyen alanlar düşer, tipler
 *    zorlanır, eksikler varsayılana iner. Böylece bozuk bir kayıt aracı
 *    çökertmez, sadece eksik doldurulur.
 *
 * KİŞİSEL VERİ: ad, e-posta, TCKN, IBAN GİRMEZ ve SAKLAMAZ. Yalnızca
 * finansal modelin gerçekten ihtiyaç duyduğu alanlar var (doğum yılı —
 * tam tarih değil, hane büyüklüğü, emeklilik hedefi).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ikiz/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Profil = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SURUM = 1;
  var ANAHTAR = "korayoner.finansal-ikiz.profil";
  var ONAY_ANAHTARI = "korayoner.finansal-ikiz.saklama-onayi";

  /* Sayılabilir alanlar için tek kapı: NaN ve negatif sızmasın. */
  function sayi(v, varsayilan, negatifOlabilir) {
    var n = Number(v);
    if (!isFinite(n)) return varsayilan;
    if (!negatifOlabilir && n < 0) return varsayilan;
    return n;
  }
  function tamsayi(v, varsayilan) {
    var n = Math.round(Number(v));
    return isFinite(n) ? n : varsayilan;
  }
  function metin(v, varsayilan, enFazla) {
    if (v === null || v === undefined) return varsayilan;
    var s = String(v).trim();
    if (!s) return varsayilan;
    return s.slice(0, enFazla || 80);
  }
  function secim(v, gecerliler, varsayilan) {
    return gecerliler.indexOf(v) >= 0 ? v : varsayilan;
  }

  var GELIR_TURLERI = ["ucret", "kira", "serbest", "temettu", "emekli", "diger"];
  var VARLIK_TURLERI = ["nakit", "mevduat", "fon", "hisse", "tahvil", "doviz",
    "altin", "kripto", "bes", "konut", "arac", "diger"];
  var BORC_TURLERI = ["ihtiyac", "konut-sabit", "konut-degisken", "tasit",
    "kart", "kmh", "diger"];

  /* Likidite TÜRE BAĞLI, kullanıcı girdisine değil: "nakit ihtiyacımda
     evimi satarım" bir plan değil. Dayanma süresi hesabı buna bakıyor. */
  var LIKIT_TURLER = ["nakit", "mevduat", "fon", "doviz", "altin"];

  function bosProfil() {
    return {
      surum: SURUM,
      guncelleme: null,
      kisi: { dogumYili: null, emeklilikHedefYasi: 60, haneBuyuklugu: 1 },
      gelirler: [],
      giderler: [],
      varliklar: [],
      borclar: [],
      /* YAŞAM OLAYLARI — projeksiyonun düz bir ekstrapolasyon olmaktan
         çıktığı yer. Ev alma, çocuk, emeklilik gibi kırılmalar olmadan
         yirmi yıllık bir eğri, bugünün fotoğrafının uzatılmasından ibaret. */
      olaylar: [],
      varsayimlar: {
        enflasyon: 0.30,
        ucretArtisi: 0.30,
        yatirimGetirisi: 0.35,
        ufukYil: 20
      },
      /* ÜÇ SENARYO — belirsizlik burada, dağılım varsayarak değil.
         Sayılar taban varsayımlara göre KAYMA (puan) olarak tutuluyor;
         böylece kullanıcı taban varsayımını değiştirdiğinde üç senaryo
         birlikte kayıyor ve aralarındaki mesafe korunuyor.

         KALİBRASYON REEL GETİRİ ÜZERİNDEN YAPILDI, NOMİNAL ÜZERİNDEN DEĞİL.
         İlk sürümde kaymalar nominal olarak seçilmişti (enflasyon ±15,
         getiri ±12 puan) ve makul görünüyordu. 20 yıllık projeksiyonda
         ölçülünce savunulamaz çıktı: kötümser senaryonun REEL getirisi
         −%15,2, iyimserinki +%18,9 oluyordu. Yirmi yıl sürdürülen böyle
         oranlar birer senaryo değil, birer kuyruk olayıdır — ve band
         −3 milyon ile +157 milyon arasına açılıp hiçbir şey anlatmıyordu.

         Buradaki kaymalar reel getiriyi şuraya oturtuyor (taban %30
         enflasyon / %35 getiri varsayımıyla):
             kötümser  −%2,9   (varlıklar reel olarak yavaşça eriyor)
             baz       +%3,8
             iyimser   +%7,9
         Üçü de yirmi yıl boyunca sürdürülebilir büyüklükler.

         ÜCRET KAYMASI KÖTÜMSERDE SIFIR — ÇİFTE SAYIM OLMASIN DİYE.
         Reel ücret artışı (1+ücret)/(1+enflasyon)−1 olduğu için,
         enflasyon kayması TEK BAŞINA reel ücreti zaten eritiyor: %36
         enflasyon ve %30 nominal zam, yılda −%4,4 reel demek. Üstüne bir
         de nominal ücret kayması eklemek aynı şeyi iki kez saymaktı ve
         reel ücreti yılda −%7,4'e indiriyordu — yirmi yılda bugünkünün
         %22'sine. Bir kötümser senaryo değil, bir çöküş senaryosuydu.

         Bunlar BAŞLANGIÇ NOKTASI; kullanıcı hepsini değiştirebilir ve
         arayüz bunların kendi varsayımı olduğunu söylüyor. */
      senaryolar: {
        kotumser: { enflasyonKaymasi: 0.06, getiriKaymasi: -0.03, ucretKaymasi: 0 },
        baz: { enflasyonKaymasi: 0, getiriKaymasi: 0, ucretKaymasi: 0 },
        iyimser: { enflasyonKaymasi: -0.03, getiriKaymasi: 0.02, ucretKaymasi: 0.02 }
      }
    };
  }

  var sonrakiId = 1;
  function id(mevcut) {
    var m = metin(mevcut, null, 24);
    if (m) return m;
    return "k" + (sonrakiId++) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function gelirNormalize(g) {
    var tur = secim(g && g.tur, GELIR_TURLERI, "diger");
    return {
      id: id(g && g.id),
      ad: metin(g && g.ad, "Gelir"),
      tur: tur,
      /* Ücret geliri BRÜT tutulur: net, bordro motorundan hesaplanır.
         Net saklamak, yıl ve mevzuat değişince kaydı sessizce eskitirdi. */
      aylikBrut: tur === "ucret" ? sayi(g && g.aylikBrut, 0) : 0,
      aylikNet: tur === "ucret" ? 0 : sayi(g && g.aylikNet, 0),
      yillikArtis: sayi(g && g.yillikArtis, null, true),
      bitisYili: g && g.bitisYili ? tamsayi(g.bitisYili, null) : null
    };
  }

  function giderNormalize(k) {
    return {
      id: id(k && k.id),
      ad: metin(k && k.ad, "Gider"),
      aylik: sayi(k && k.aylik, 0),
      zorunlu: !!(k && k.zorunlu),
      /* Enflasyona endeksli olmayan gider (sabit taksitli bir ödeme gibi)
         reel olarak her yıl UCUZLAR; ikisini ayırmadan uzun vadeli
         projeksiyon sistematik olarak yanlış çıkar. */
      enflasyonaEndeksli: (k && k.enflasyonaEndeksli === false) ? false : true,
      bitisYili: k && k.bitisYili ? tamsayi(k.bitisYili, null) : null
    };
  }

  function varlikNormalize(v) {
    var tur = secim(v && v.tur, VARLIK_TURLERI, "diger");
    return {
      id: id(v && v.id),
      ad: metin(v && v.ad, "Varlık"),
      tur: tur,
      deger: sayi(v && v.deger, 0),
      likit: LIKIT_TURLER.indexOf(tur) >= 0,
      beklenenGetiri: sayi(v && v.beklenenGetiri, null, true)
    };
  }

  var OLAY_TURLERI = ["ev-alma", "cocuk", "emeklilik", "is-degisikligi",
    "buyuk-gelir", "buyuk-harcama", "ozel"];

  /* OLAY TUTARLARI BUGÜNÜN PARASIYLA GİRİLİR VE ENFLASYONLA TAŞINIR.
   *
   * Kullanıcı "2032'de ev peşinatı 2.000.000" dediğinde kastettiği şey
   * neredeyse her zaman BUGÜNÜN alım gücüdür; 2032'nin nominal lirası
   * değil. Motor tutarları o yılın parasına taşıyor ve arayüz bunu
   * söylüyor. Tersini yapmak — nominal kabul etmek — yüksek enflasyonda
   * olayı yıllar geçtikçe görünmez kılardı. */
  function olayNormalize(o) {
    var tur = secim(o && o.tur, OLAY_TURLERI, "ozel");
    var borc = (o && o.borc) || null;
    return {
      id: id(o && o.id),
      ad: metin(o && o.ad, "Olay"),
      tur: tur,
      yil: o && o.yil ? tamsayi(o.yil, null) : null,
      /* Tek seferlik nakit çıkışı (peşinat, büyük harcama). */
      pesinat: sayi(o && o.pesinat, 0),
      /* Tek seferlik nakit girişi (miras, prim, satış). */
      tekSeferlikGelir: sayi(o && o.tekSeferlikGelir, 0),
      /* Aylık gider/gelir deltası — süre boyunca. */
      aylikGiderEtkisi: sayi(o && o.aylikGiderEtkisi, 0, true),
      aylikGelirEtkisi: sayi(o && o.aylikGelirEtkisi, 0, true),
      /* null = süresiz. Çocuk için 22, eğitim için 4 gibi. */
      sureYil: (o && o.sureYil) ? Math.max(1, tamsayi(o.sureYil, 1)) : null,
      /* Ücret geliri çarpanı: emeklilikte 0, iş değişikliğinde 1,25 gibi. */
      ucretCarpani: (o && o.ucretCarpani !== undefined && o.ucretCarpani !== null &&
        isFinite(Number(o.ucretCarpani))) ? Math.max(0, Number(o.ucretCarpani)) : null,
      /* Likit OLMAYAN varlık eklemesi (satın alınan ev/araç). */
      varlikEklemesi: sayi(o && o.varlikEklemesi, 0),
      /* Yeni borç (mortgage, taşıt kredisi). */
      borc: borc ? {
        anapara: sayi(borc.anapara, 0),
        aylikFaiz: sayi(borc.aylikFaiz, 0),
        aylikOdeme: sayi(borc.aylikOdeme, 0)
      } : null,
      /* Duran gider: ev alınca kira biter. Kalemin id'si. */
      durdurulanGiderId: metin(o && o.durdurulanGiderId, null, 24)
    };
  }

  function borcNormalize(b) {
    return {
      id: id(b && b.id),
      ad: metin(b && b.ad, "Borç"),
      tur: secim(b && b.tur, BORC_TURLERI, "diger"),
      kalanAnapara: sayi(b && b.kalanAnapara, 0),
      aylikFaiz: sayi(b && b.aylikFaiz, 0),
      kalanVadeAy: Math.max(0, tamsayi(b && b.kalanVadeAy, 0)),
      aylikOdeme: sayi(b && b.aylikOdeme, 0)
    };
  }

  /**
   * Dışarıdan gelen her şey buradan geçer. Bozuk kayıt aracı çökertmez.
   */
  function normalize(ham) {
    var p = bosProfil();
    if (!ham || typeof ham !== "object") return p;

    var k = ham.kisi || {};
    p.kisi.dogumYili = k.dogumYili ? tamsayi(k.dogumYili, null) : null;
    p.kisi.emeklilikHedefYasi = Math.min(90, Math.max(40,
      tamsayi(k.emeklilikHedefYasi, 60)));
    p.kisi.haneBuyuklugu = Math.min(20, Math.max(1, tamsayi(k.haneBuyuklugu, 1)));

    if (Array.isArray(ham.gelirler)) p.gelirler = ham.gelirler.map(gelirNormalize);
    if (Array.isArray(ham.giderler)) p.giderler = ham.giderler.map(giderNormalize);
    if (Array.isArray(ham.varliklar)) p.varliklar = ham.varliklar.map(varlikNormalize);
    if (Array.isArray(ham.borclar)) p.borclar = ham.borclar.map(borcNormalize);
    if (Array.isArray(ham.olaylar)) {
      /* Yılı olmayan olay projeksiyona giremez; sessizce yok sayılır
         yerine AYIKLANIR ki arayüz eksik olanı gösterebilsin. */
      p.olaylar = ham.olaylar.map(olayNormalize)
        .filter(function (o) { return o.yil !== null; })
        .sort(function (a, b) { return a.yil - b.yil; });
    }

    var v = ham.varsayimlar || {};
    p.varsayimlar.enflasyon = sayi(v.enflasyon, p.varsayimlar.enflasyon, true);
    p.varsayimlar.ucretArtisi = sayi(v.ucretArtisi, p.varsayimlar.ucretArtisi, true);
    p.varsayimlar.yatirimGetirisi = sayi(v.yatirimGetirisi, p.varsayimlar.yatirimGetirisi, true);
    p.varsayimlar.ufukYil = Math.min(60, Math.max(1, tamsayi(v.ufukYil, 20)));

    var s = ham.senaryolar || {};
    ["kotumser", "baz", "iyimser"].forEach(function (ad) {
      var o = s[ad] || {};
      var t = p.senaryolar[ad];
      t.enflasyonKaymasi = sayi(o.enflasyonKaymasi, t.enflasyonKaymasi, true);
      t.getiriKaymasi = sayi(o.getiriKaymasi, t.getiriKaymasi, true);
      t.ucretKaymasi = sayi(o.ucretKaymasi, t.ucretKaymasi, true);
    });

    p.guncelleme = metin(ham.guncelleme, null, 24);
    return p;
  }

  /**
   * Bir senaryonun ETKİN varsayımları. Kaymalar taban üzerine biner ve
   * enflasyon negatife inemez (deflasyon varsayımı bu modelde yok).
   */
  function senaryoVarsayimlari(p, ad) {
    var s = p.senaryolar[ad] || p.senaryolar.baz;
    var v = p.varsayimlar;
    return {
      ad: ad,
      enflasyon: Math.max(0, v.enflasyon + s.enflasyonKaymasi),
      yatirimGetirisi: Math.max(-0.5, v.yatirimGetirisi + s.getiriKaymasi),
      ucretArtisi: Math.max(0, v.ucretArtisi + s.ucretKaymasi),
      ufukYil: v.ufukYil
    };
  }

  /* ------------------------------- özet --------------------------------- */
  /* Tek tek motorların hepsine gerek olmayan, profilin kendisinden okunan
     temel büyüklükler. Buradaki hiçbir sayı bir PROJEKSİYON değil —
     bugünün fotoğrafı. */
  function ozet(p) {
    var toplamVarlik = p.varliklar.reduce(function (a, v) { return a + v.deger; }, 0);
    var likitVarlik = p.varliklar.reduce(function (a, v) {
      return a + (v.likit ? v.deger : 0);
    }, 0);
    var toplamBorc = p.borclar.reduce(function (a, b) { return a + b.kalanAnapara; }, 0);
    var aylikBorcOdemesi = p.borclar.reduce(function (a, b) { return a + b.aylikOdeme; }, 0);
    var aylikGider = p.giderler.reduce(function (a, k) { return a + k.aylik; }, 0);
    var zorunluGider = p.giderler.reduce(function (a, k) {
      return a + (k.zorunlu ? k.aylik : 0);
    }, 0);
    var ucretBrut = p.gelirler.reduce(function (a, g) {
      return a + (g.tur === "ucret" ? g.aylikBrut : 0);
    }, 0);
    var digerNet = p.gelirler.reduce(function (a, g) {
      return a + (g.tur === "ucret" ? 0 : g.aylikNet);
    }, 0);

    /* DAYANMA SÜRESİ: geliriniz bugün kesilse likit varlıkla kaç ay?
       Paydada ZORUNLU gider + borç ödemesi var; isteğe bağlı harcamayı
       saymak süreyi olduğundan kısa gösterirdi, borç ödemesini saymamak
       ise tehlikeli biçimde uzun. */
    var aylikZorunluYuk = zorunluGider + aylikBorcOdemesi;
    var dayanmaAy = aylikZorunluYuk > 0 ? likitVarlik / aylikZorunluYuk : null;

    return {
      toplamVarlik: toplamVarlik,
      likitVarlik: likitVarlik,
      toplamBorc: toplamBorc,
      netDeger: toplamVarlik - toplamBorc,
      aylikBorcOdemesi: aylikBorcOdemesi,
      aylikGider: aylikGider,
      zorunluGider: zorunluGider,
      aylikZorunluYuk: aylikZorunluYuk,
      ucretBrut: ucretBrut,
      digerNet: digerNet,
      dayanmaAy: dayanmaAy,
      yas: p.kisi.dogumYili ? (new Date().getFullYear() - p.kisi.dogumYili) : null,
      /* Profil ne kadar dolu? Eksik veri, modelin güvenini düşürür ve
         bunun kullanıcıya söylenmesi gerekir. */
      eksikler: eksikler(p)
    };
  }

  function eksikler(p) {
    var e = [];
    if (!p.gelirler.length) e.push("gelir");
    if (!p.giderler.length) e.push("gider");
    if (!p.varliklar.length) e.push("varlık");
    if (!p.kisi.dogumYili) e.push("doğum yılı");
    return e;
  }

  /* ----------------------------- taşıma --------------------------------- */
  function disaAktar(p) {
    return JSON.stringify({
      surum: SURUM,
      guncelleme: new Date().toISOString().slice(0, 10),
      kisi: p.kisi,
      gelirler: p.gelirler,
      giderler: p.giderler,
      varliklar: p.varliklar,
      borclar: p.borclar,
      olaylar: p.olaylar,
      varsayimlar: p.varsayimlar,
      senaryolar: p.senaryolar
    }, null, 2);
  }

  /**
   * Bilinmeyen sürüm REDDEDİLİR — tahmin edilmez. Gelecekten gelen bir
   * dosyayı bugünün şemasıyla okumak, kullanıcının verisini sessizce
   * bozmak demek.
   */
  function iceAktar(metinVeri) {
    var ham;
    try { ham = JSON.parse(metinVeri); }
    catch (e) { return { hata: "Dosya okunamadı: geçerli bir JSON değil." }; }
    if (!ham || typeof ham !== "object") {
      return { hata: "Dosya bir profil içermiyor." };
    }
    var s = Number(ham.surum);
    if (!isFinite(s)) return { hata: "Dosyada sürüm bilgisi yok." };
    if (s > SURUM) {
      return { hata: "Bu dosya daha yeni bir sürümle (v" + s +
        ") oluşturulmuş. Aracı yenileyip tekrar deneyin." };
    }
    return { profil: normalize(tasi(ham, s)) };
  }

  /* Eski sürümleri bugüne taşır. Şu an tek sürüm var; zincir burada
     kuruldu ki ikinci sürüm geldiğinde yeri hazır olsun. */
  function tasi(ham, surum) {
    /* örnek: if (surum < 2) { ham = v1denV2ye(ham); surum = 2; } */
    return ham;
  }

  /* ---------------------------- saklama --------------------------------- */
  /* Depo enjekte edilebilir: testler Node'da localStorage olmadan koşuyor. */
  function depoBul(depo) {
    if (depo) return depo;
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (e) { /* gizli sekme / engelli site verisi */ }
    return null;
  }

  function onayVar(depo) {
    var d = depoBul(depo);
    if (!d) return false;
    try { return d.getItem(ONAY_ANAHTARI) === "evet"; }
    catch (e) { return false; }
  }

  function onayVer(deger, depo) {
    var d = depoBul(depo);
    if (!d) return false;
    try {
      if (deger) { d.setItem(ONAY_ANAHTARI, "evet"); }
      else { d.removeItem(ONAY_ANAHTARI); d.removeItem(ANAHTAR); }
      return true;
    } catch (e) { return false; }
  }

  /** Onay yoksa YAZMAZ ve bunu söyler. Sessizce saklamak kabul edilemez. */
  function sakla(p, depo) {
    var d = depoBul(depo);
    if (!d) return { yazildi: false, sebep: "depo-yok" };
    if (!onayVar(depo)) return { yazildi: false, sebep: "onay-yok" };
    try {
      d.setItem(ANAHTAR, disaAktar(p));
      return { yazildi: true };
    } catch (e) {
      return { yazildi: false, sebep: "kota" };
    }
  }

  function yukle(depo) {
    var d = depoBul(depo);
    if (!d || !onayVar(depo)) return null;
    var ham;
    try { ham = d.getItem(ANAHTAR); } catch (e) { return null; }
    if (!ham) return null;
    var s = iceAktar(ham);
    return s.hata ? null : s.profil;
  }

  function sil(depo) {
    var d = depoBul(depo);
    if (!d) return false;
    try { d.removeItem(ANAHTAR); return true; } catch (e) { return false; }
  }

  return {
    SURUM: SURUM,
    ANAHTAR: ANAHTAR,
    GELIR_TURLERI: GELIR_TURLERI,
    VARLIK_TURLERI: VARLIK_TURLERI,
    BORC_TURLERI: BORC_TURLERI,
    OLAY_TURLERI: OLAY_TURLERI,
    LIKIT_TURLER: LIKIT_TURLER,
    bos: bosProfil,
    normalize: normalize,
    ozet: ozet,
    eksikler: eksikler,
    senaryoVarsayimlari: senaryoVarsayimlari,
    disaAktar: disaAktar,
    iceAktar: iceAktar,
    sakla: sakla,
    yukle: yukle,
    sil: sil,
    onayVar: onayVar,
    onayVer: onayVer
  };
});
