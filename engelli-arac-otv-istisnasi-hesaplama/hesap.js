/*!
 * Engelli araç ÖTV istisnası — kural motoru. TEK DOĞRULUK KAYNAĞI.
 *
 * KURAL (4760 s.K. m.7/1-2 ve m.15/2-a, mevzuat.gov.tr güncel metni;
 * ÖTV (II) Sayılı Liste Uygulama Genel Tebliği II/C-1 ve IV/F-1.1,
 * 22/4/2026 değişikliğiyle; ikisi de 4 Ekim 2026'da okundu)
 *
 *   Ortak: kayıt ve tescile tabi, yerli katkı oranı en az %40 (kanunda
 *   %20; 26/12/2024 tarihli 9321 sayılı Cumhurbaşkanı Kararıyla %40) olan
 *   taşıtın, ON YILDA BİR defaya mahsus ilk iktisabı (7537 s.K. ile beşten
 *   ona, 27/12/2024'ten beri herkes için).
 *
 *   (a) Engellilik oranı %90 ve üzeri: 87.03 (vergiler dahil bedeli
 *       sınırı aşanlar hariç), 87.04 (2.800 cm³'ü aşanlar hariç), 87.11.
 *       Özel tertibat ve bizzat kullanma şartı yok.
 *   (b) %90 ve üzeri, araç kullanamayan, sürekli tekerlekli sandalye ya da
 *       sedye kullanan: 87.03'te yük-yolcu (istiap %50 altı) ve sürücü
 *       dahil 9 kişilik taşıtlar; 2.800 cm³'ü aşan, dört çeker ve 8 kişiye
 *       kadar binek hariç. FİYAT SINIRI YOK. Tekerlekli sandalye ya da
 *       sedye tertibatı ilk iktisaptan önce yaptırılır.
 *   (c) Bizzat kullanmak için hareket ettirici özel tertibat yaptıran ya
 *       da ortopedik engeli %40 ve üzeri olup bu yüzden sürücü belgesi
 *       alamayan: (a) ile aynı taşıtlar ve aynı fiyat sınırı. AYM'nin
 *       22/4/2025 tarihli iptal kararı 26/3/2026'da yürürlüğe girdi; bent
 *       7577 s.K. m.8 ile 17/4/2026'dan geçerli olarak yeniden düzenlendi.
 *
 *   Sınır: "hesaplanması gereken ÖTV ve diğer her türlü vergiler dahil
 *   bedeli" — yani istisna olmasaydı ödenecek anahtar teslim fiyat. Kanun
 *   "aşanlar hariç" der: sınıra eşit bedel kapsamdadır. Tutar her yıl
 *   yeniden değerleme oranıyla artar, 100 TL'yi aşmayan kesir atılır.
 *   2026: 2.873.900 TL (16 Seri No'lu Tebliğ, RG 31/12/2025, 33124 5. Mük.).
 *
 *   Devir (m.15/2-a): ilk iktisaptan itibaren BEŞ yıl geçmeden istisnadan
 *   yararlanamayan birine satışta, ilk iktisaptaki matrah üzerinden, tescil
 *   tarihindeki oranla ÖTV alıcıdan alınır. İstisnadan yararlanabilecek bir
 *   engelliye satışta ÖTV aranmaz. Beş yıldan sonra serbest; ama yeni bir
 *   istisnalı araç ancak on yıl dolunca.
 *
 *   MTV (197 s.K. m.4/1-c): %90 ve üzeri engellilerin adına kayıtlı
 *   taşıtlar ile diğer engellilerin durumlarına uygun özel tertibatlı
 *   taşıtları vergiden müstesna. Taşıt değeri KDV matrahıdır (m.2/20): ÖTV
 *   istisna edilmişse değer vergisiz fiyattır.
 *
 * Yasal oranlar ve tarifeler otv-hesaplama/tarife.js ve mtv-hesaplama/
 * tarife.js'ten okunur; burada yalnız istisnanın kendi kuralları durur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/engelli-arac-otv-istisnasi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../otv-hesaplama/tarife.js"), require("../mtv-hesaplama/tarife.js"));
  } else kok.EngelliArac = fabrika(kok.OtvTarife, kok.MtvTarife);
})(typeof globalThis !== "undefined" ? globalThis : this, function (OTV, MTV) {
  "use strict";

  var SURUM = "1.0.0";
  var KDV = OTV.KDV;

  /* Sınır, yıl yıl. 2026 tutarı tebliğden; zincir (200.000 TL, 2018 ×
     yıllık YDO, 100 TL altı atılarak) test.js'te bağımsız yeniden kurulur. */
  var SINIR = { 2026: 2873900 };
  var SINIR_KAYNAK = { 2026: "16 Seri No'lu ÖTV (II) Sayılı Liste Uygulama Genel Tebliği, RG 31/12/2025, sayı 33124 (5. Mükerrer)" };

  var YERLI_KATKI = 40;          // %; 9321 sayılı CB Kararı (kanunda 20)
  var YENILEME_YIL = 10;         // "on yılda bir defaya mahsus"
  var DEVIR_YIL = 5;             // m.15/2-a
  var B_HACIM_UST = 2800;        // (b): "motor silindir hacmi 2.800 cm³'ü aşanlar hariç"
  var KAMYONET_HACIM_UST = 2800; // 87.04: "2.800 cm³'ü aşanlar hariç"
  var ORTOPEDIK_ESIK = 40;       // (c): "ortopedik engelliliği yüzde 40 ve üzeri"
  var AGIR_ESIK = 90;            // (a), (b) ve MTV

  /* 87.03'ün otomobil dışı satırları ((II) sayılı liste): yük-yolcu (istiap
     %50 altı) ve 9 kişilik taşıtlar. Matrah grubu yok; oran tek. */
  var TICARI = {
    yukyolcu: { ad: "Yük taşımasında kullanılıp yolcu kapasitesi istiap haddinin %50'sinin altında olanlar", icten: 15, elektrik: 10 },
    dokuz: { ad: "Sürücü dahil 9 kişilik oturma yeri olanlar", icten: 15, elektrik: 10 }
  };

  function sayi(x) { return typeof x === "number" && isFinite(x); }
  function parca(iso) { return [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)]; }
  function tarihGecerli(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = parca(s), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  }
  /* Takvim yılı ekleme; 29 Şubat bir sonraki günün yerine 28 Şubat'a düşer. */
  function yilEkle(iso, n) {
    var p = parca(iso), y = p[0] + n, gun = Math.min(p[2], new Date(Date.UTC(y, p[1], 0)).getUTCDate());
    return y + "-" + (p[1] < 10 ? "0" : "") + p[1] + "-" + (gun < 10 ? "0" : "") + gun;
  }

  function sinir(yil) { return SINIR[yil] || null; }

  /* ---------------------------------------------------------------- *
   * Vergi hesabı: binek otomobilde ÖTV aracının ağacı, yük-yolcu ve
   * 9 kişilikte tek oran.
   * ---------------------------------------------------------------- */
  function vergi(arac, matrah) {
    if (arac.sinif === "binek") {
      var r = OTV.hesapla(Object.assign({}, arac.otv, { matrah: matrah }));
      if (r.hata) return { hata: r.hata };
      return { matrah: matrah, oran: r.oran, otv: r.otv, kdv: r.kdv, toplam: r.toplam, satir: r.satir, satirNesnesi: r.satirNesnesi, notlar: r.notlar };
    }
    var t = TICARI[arac.sinif];
    if (!t) return { hata: "sinif" };
    var oran = arac.otv && arac.otv.tur === "elektrik" ? t.elektrik : t.icten;
    var otv = matrah * oran / 100, kdv = (matrah + otv) * KDV;
    return { matrah: matrah, oran: oran, otv: otv, kdv: kdv, toplam: matrah + otv + kdv, satir: t.ad, notlar: [] };
  }

  /* Anahtar teslim fiyattan vergisiz fiyat. Toplam, matrahın artan ama
     sıçramalı bir fonksiyonu (ÖTV eşiği aşılınca oran bütün matraha
     uygulanır). Sıçramanın içine düşen bir fiyatın vergisiz karşılığı yok:
     o fiyatla satılan araç olamaz. Bu durum ayrıca bildirilir. */
  function matrahBul(arac, toplam) {
    if (!sayi(toplam) || toplam <= 0) return { hata: "fiyat" };
    var lo = 0, hi = toplam / (1 + KDV);
    var v = vergi(arac, hi);
    if (v.hata) return v;
    for (var i = 0; i < 80; i++) {
      var m = (lo + hi) / 2, r = vergi(arac, m);
      if (r.toplam <= toplam) lo = m; else hi = m;
    }
    var en = vergi(arac, lo);
    var bosluk = toplam - en.toplam > 1;
    if (bosluk) {
      var ust = vergi(arac, lo + 0.01);
      return { matrah: lo, bosluk: true, alt: en.toplam, ust: ust.toplam };
    }
    return { matrah: Math.floor(lo * 100) / 100 };
  }

  /* Sınırın altında kalan en yüksek matrah (aynı motor/yakıt sınıfında). */
  function sinirdakiMatrah(arac, sinirTutari) {
    var r = matrahBul(arac, sinirTutari);
    return r.hata ? null : r.matrah;
  }

  /* ---------------------------------------------------------------- *
   * Hangi yol açık? Kişinin durumundan, kanunun bent sırasıyla.
   *   kisi.oran           engellilik oranı (%)
   *   kisi.sandalye       sürekli tekerlekli sandalye/sedye, araç kullanamaz
   *   kisi.tertibat       raporda "sadece hareket ettirici aksamda özel
   *                       tertibatlı taşıt kullanması gerekir" değerlendirmesi
   *   kisi.ehliyetKodu    sürücü belgesinde uygun özel tertibat kodu
   *   kisi.ortopedik      ortopedik engel oranı (%)
   *   kisi.ehliyetAlamaz  ortopedik engeli yüzünden sürücü belgesi alamaz
   * ---------------------------------------------------------------- */
  function yollar(kisi) {
    var out = [];
    var oran = sayi(kisi.oran) ? kisi.oran : 0;
    if (oran >= AGIR_ESIK && kisi.sandalye) out.push("b");
    if (oran >= AGIR_ESIK) out.push("a");
    if (kisi.tertibat && kisi.ehliyetKodu) out.push("c1");
    if (sayi(kisi.ortopedik) && kisi.ortopedik >= ORTOPEDIK_ESIK && kisi.ehliyetAlamaz) out.push("c2");
    return out;
  }
  var YOL = {
    a: { ad: "Engellilik oranı %90 ve üzeri", bent: "m.7/1-2-a", sinirli: true, mtvMuaf: true },
    b: { ad: "%90 ve üzeri, tekerlekli sandalye ya da sedye ile seyahat", bent: "m.7/1-2-b", sinirli: false, mtvMuaf: true },
    c1: { ad: "Özel tertibatla bizzat kullanım", bent: "m.7/1-2-c", sinirli: true, mtvMuaf: true },
    c2: { ad: "Ortopedik engel %40 ve üzeri, sürücü belgesi alamıyor", bent: "m.7/1-2-c", sinirli: true, mtvMuaf: false }
  };

  /* Araç bu yolun kapsamında mı (sınıf, hacim, çekiş)? */
  function aracKapsami(yol, arac) {
    var hacim = arac.otv && sayi(arac.otv.hacim) ? arac.otv.hacim : 0;
    var elektrik = arac.otv && arac.otv.tur === "elektrik";
    if (yol === "b") {
      if (arac.sinif !== "yukyolcu" && arac.sinif !== "dokuz") return { tamam: false, neden: "Bu yol yalnız yük-yolcu (panelvan, kombi) ve sürücü dahil 9 kişilik taşıtlarda açık; 8 kişiye kadar binek otomobil kapsam dışı." };
      if (arac.dortCeker) return { tamam: false, neden: "Bütün tekerlekleri motordan güç alan taşıtlar (b) bendinin dışında." };
      if (!elektrik && hacim > B_HACIM_UST) return { tamam: false, neden: "Motor silindir hacmi 2.800 cm³'ü aşan taşıtlar (b) bendinin dışında." };
      return { tamam: true };
    }
    if (arac.sinif === "kamyonet") {
      if (!elektrik && hacim > KAMYONET_HACIM_UST) return { tamam: false, neden: "87.04'te (kamyonet, van) 2.800 cm³'ü aşanlar istisna dışı." };
      return { tamam: true, hesapsiz: true };
    }
    if (arac.sinif === "motosiklet") return { tamam: true, hesapsiz: true };
    return { tamam: true };
  }

  /* ---------------------------------------------------------------- *
   * hesapla(g)
   *   g.bugun        "YYYY-MM-DD" (alım tarihi)
   *   g.kisi         yukarıdaki alanlar
   *   g.sonIstisna   daha önce istisnayla alınan aracın ilk iktisap tarihi
   *   g.arac.sinif   "binek" | "yukyolcu" | "dokuz" | "kamyonet" | "motosiklet"
   *   g.arac.otv     ÖTV aracının girdileri (tur, hacim, elektrikKw, kw, co2, menzil)
   *   g.arac.dortCeker
   *   g.arac.yerliKatki "evet" | "hayir" | "bilinmiyor"
   *   g.fiyat        tutar; g.fiyatTip "anahtar" (vergiler dahil) | "matrah"
   * ---------------------------------------------------------------- */
  function hesapla(g) {
    if (!tarihGecerli(g.bugun)) throw new Error("Alım tarihini girin.");
    var yil = +g.bugun.slice(0, 4);
    var S = sinir(yil);
    var arac = g.arac || {};
    var kosullar = [];
    function kosul(ad, durum, aciklama, dayanak) { kosullar.push({ ad: ad, durum: durum, aciklama: aciklama, dayanak: dayanak }); }

    /* 1. Yol */
    var acik = yollar(g.kisi || {});
    var yol = null;
    if (acik.indexOf("b") >= 0 && aracKapsami("b", arac).tamam) yol = "b";
    else yol = acik.filter(function (y) { return y !== "b"; })[0] || null;
    if (!yol && acik.indexOf("b") >= 0) yol = "b";
    if (yol) kosul("Engel durumu", "tamam", YOL[yol].ad + ".", "4760 s.K. " + YOL[yol].bent);
    else kosul("Engel durumu", "eksik", "Girilen durum hiçbir bende girmiyor: oran %90'ın altında, raporda özel tertibat zorunluluğu ya da sürücü belgesi alamayan %40 ortopedik engel yok.", "4760 s.K. m.7/1-2");

    /* 2. Araç kapsamı */
    var kapsam = yol ? aracKapsami(yol, arac) : { tamam: true };
    kosul("Araç türü", kapsam.tamam ? "tamam" : "eksik", kapsam.tamam ? "Taşıt bu bendin kapsamında." : kapsam.neden, "4760 s.K. m.7/1-2");

    /* 3. Yerli katkı */
    var yk = arac.yerliKatki;
    kosul("Yerli katkı oranı %" + YERLI_KATKI, yk === "evet" ? "tamam" : yk === "hayir" ? "eksik" : "bilinmiyor",
      yk === "evet" ? "Model ve versiyonun yerli katkı oranı %40 veya üzeri." :
      yk === "hayir" ? "Yerli katkı oranı %40'ın altındaki araçta istisna uygulanmaz; ithal araçların çoğu bu yüzden kapsam dışı." :
      "Sanayi ve Teknoloji Bakanlığının yayımladığı güncel yerli katkı oranı beyanlarından ya da bayiden öğrenin.",
      "9321 sayılı CB Kararı; Tebliğ II/C-1.5");

    /* 4. On yıl */
    var yenileme = null;
    if (g.sonIstisna) {
      if (!tarihGecerli(g.sonIstisna)) throw new Error("Önceki istisnalı alım tarihini gün, ay, yıl olarak girin.");
      yenileme = yilEkle(g.sonIstisna, YENILEME_YIL);
      var dolu = yenileme <= g.bugun;
      kosul("On yılda bir", dolu ? "tamam" : "eksik",
        dolu ? "Önceki istisnalı alımdan bu yana on yıl doldu." : "Önceki istisnalı alımdan itibaren on yıl " + yenileme + " tarihinde doluyor. Önceki araç satılmış ya da ÖTV'si ödenmiş olsa da süre değişmez.",
        "4760 s.K. m.7/1-2 (7537 s.K.); Tebliğ II/C-1.5");
    } else kosul("On yılda bir", "tamam", "Daha önce istisnadan yararlanılmamış.", "4760 s.K. m.7/1-2");

    /* 5. Fiyat ve vergiler */
    var hesap = null, sonuc = { yol: yol, yolBilgi: yol ? YOL[yol] : null, acikYollar: acik, kosullar: kosullar, sinir: S, sinirKaynak: SINIR_KAYNAK[yil] || null, yil: yil };
    if (kapsam.hesapsiz) {
      sonuc.hesapsiz = true;
      sonuc.not = arac.sinif === "kamyonet"
        ? "87.04 kamyonet ve vanlarda fiyat sınırı yok; 2.800 cm³'ü aşmamak yeter. Bu sınıfın ÖTV oranları araçta hesaplanmıyor."
        : "Motosikletlerde (87.11) motor hacmi ve fiyat sınırı yok. Bu sınıfın ÖTV oranları araçta hesaplanmıyor.";
    } else if (sayi(g.fiyat) && g.fiyat > 0) {
      var matrah = g.fiyat, ters = null;
      if (g.fiyatTip === "anahtar") {
        ters = matrahBul(arac, g.fiyat);
        if (ters.hata) throw new Error("Araç bilgilerini tamamlayın.");
        if (ters.bosluk) {
          var e = new Error("Bu anahtar teslim fiyat ÖTV tarifesindeki bir boşluğa düşüyor: bu motor sınıfında " +
            Math.round(ters.alt).toLocaleString("tr-TR") + " TL ile " + Math.round(ters.ust).toLocaleString("tr-TR") +
            " TL arasında anahtar teslim fiyat olamaz, çünkü ÖTV eşiği aşılınca üst oran bütün matraha uygulanır. Fiyat listesindeki vergisiz fiyatı girin.");
          e.bosluk = { alt: ters.alt, ust: ters.ust };
          throw e;
        }
        matrah = ters.matrah;
      }
      var normal = vergi(arac, matrah);
      if (normal.hata) throw new Error(normal.hata === "kw" ? "Elektrikli aracın motor gücünü girin." : "Araç bilgilerini tamamlayın.");
      var istisnali = { matrah: matrah, otv: 0, kdv: matrah * KDV, toplam: matrah * (1 + KDV) };
      var sinirli = yol ? YOL[yol].sinirli : true;
      var sinirIcinde = !sinirli || (S !== null && normal.toplam <= S);
      kosul(sinirli ? "Vergiler dahil bedel ≤ " + (S ? S.toLocaleString("tr-TR") : "?") + " TL" : "Fiyat sınırı",
        !sinirli ? "tamam" : S === null ? "bilinmiyor" : sinirIcinde ? "tamam" : "eksik",
        !sinirli ? "(b) bendinde fiyat sınırı yok." :
        S === null ? yil + " yılının sınır tutarı henüz açıklanmadı." :
        sinirIcinde ? "İstisna olmasaydı ödenecek bedel sınırın altında kalıyor." :
        "İstisna olmasaydı ödenecek bedel sınırı " + Math.round(normal.toplam - S).toLocaleString("tr-TR") + " TL aşıyor; istisna hiç uygulanmaz (kısmi indirim yok).",
        "4760 s.K. m.7/1-2-a ve c; 16 Seri No'lu Tebliğ");
      hesap = {
        normal: normal, istisnali: istisnali,
        tasarruf: normal.toplam - istisnali.toplam,
        tasarrufOtv: normal.otv, tasarrufKdv: normal.kdv - istisnali.kdv,
        indirimOrani: (normal.toplam - istisnali.toplam) / normal.toplam,
        sinirKalan: sinirli && S !== null ? S - normal.toplam : null,
        sinirdakiMatrah: sinirli && S !== null ? sinirdakiMatrah(arac, S) : null
      };
      sonuc.hesap = hesap;
    }

    /* 6. Durum */
    var eksik = kosullar.some(function (k) { return k.durum === "eksik"; });
    var belirsiz = kosullar.some(function (k) { return k.durum === "bilinmiyor"; });
    sonuc.durum = eksik ? "uygun-degil" : belirsiz ? "belirsiz" : "uygun";
    if (hesap) sonuc.odenecek = sonuc.durum === "uygun-degil" ? hesap.normal.toplam : hesap.istisnali.toplam;

    /* 7. MTV (binek otomobil, yeni tescil). */
    if (hesap && arac.sinif === "binek") sonuc.mtv = mtvHesabi(arac, hesap, yol, yil, sonuc.durum !== "uygun-degil");

    /* 8. Takvim */
    sonuc.takvim = {
      alim: g.bugun,
      serbestSatis: yilEkle(g.bugun, DEVIR_YIL),
      yeniIstisna: yilEkle(g.bugun, YENILEME_YIL),
      erkenSatisOtv: hesap ? hesap.normal.otv : null
    };
    return sonuc;
  }

  /* MTV: (I) sayılı tarife, ilk beş yıl, bugünkü tutarlarla. */
  var HACIM_UST = [1300, 1600, 1800, 2000, 2500, 3000, 3500, 4000];
  function hacimBandi(hacim) {
    for (var i = 0; i < HACIM_UST.length; i++) if (hacim <= HACIM_UST[i]) return i;
    return HACIM_UST.length;
  }
  function mtvHesabi(arac, hesap, yol, yil, istisnaVar) {
    var elektrik = arac.otv.tur === "elektrik";
    function yillik(deger, yas) {
      var g = { tur: "otomobil", tescil: "yeni", yakit: elektrik ? "elektrik" : "icten", modelYili: yil - yas + 1, yil: yil, deger: deger };
      if (elektrik) g.kw = arac.otv.kw; else g.bant = hacimBandi(arac.otv.hacim);
      var r = MTV.hesapla(g);
      return r.hata ? null : r.vergi;
    }
    var muaf = istisnaVar && yol && YOL[yol].mtvMuaf;
    /* Taşıt değeri KDV matrahı: istisnada ÖTV matraha girmez. */
    var degerNormal = hesap.normal.matrah + hesap.normal.otv;
    var degerIstisnali = istisnaVar ? hesap.istisnali.matrah : degerNormal;
    var normal = [], sizin = [];
    for (var yas = 1; yas <= 5; yas++) {
      normal.push(yillik(degerNormal, yas));
      sizin.push(muaf ? 0 : yillik(degerIstisnali, yas));
    }
    if (normal.some(function (x) { return x === null; })) return null;
    function top(a) { return a.reduce(function (t, x) { return t + x; }, 0); }
    return { muaf: muaf, normalIlkYil: normal[0], sizinIlkYil: sizin[0], normalBesYil: top(normal), sizinBesYil: top(sizin), yil: yil };
  }

  return {
    surum: SURUM, KDV: KDV, SINIR: SINIR, SINIR_KAYNAK: SINIR_KAYNAK, YERLI_KATKI: YERLI_KATKI,
    YENILEME_YIL: YENILEME_YIL, DEVIR_YIL: DEVIR_YIL, ORTOPEDIK_ESIK: ORTOPEDIK_ESIK, AGIR_ESIK: AGIR_ESIK,
    B_HACIM_UST: B_HACIM_UST, TICARI: TICARI, YOL: YOL,
    sinir: sinir, vergi: vergi, matrahBul: matrahBul, sinirdakiMatrah: sinirdakiMatrah, yollar: yollar,
    aracKapsami: aracKapsami, hacimBandi: hacimBandi, yilEkle: yilEkle, hesapla: hesapla
  };
});
