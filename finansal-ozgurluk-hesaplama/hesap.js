/*!
 * Finansal Özgürlük (FIRE) Simülasyon Çekirdeği — Türkiye
 *
 * Mimari kaynağı: RemarkRemedy/fireplanner (MIT) — Singapur için yazılmış,
 * %100 istemci tarafı FIRE planlayıcısı. Ondan alınan şey KURALLAR DEĞİL,
 * YÖNTEM: Monte Carlo ile belirsizlik ölçmek, yüzdelik bantlar, başarı
 * oranı, sequence-of-returns riski, ağır işi Web Worker'a vermek.
 *
 * Singapur kuralları (CPF, SRS, BSD/ABSD, Bala's Table, HDB) buraya
 * TAŞINMADI; hiçbirinin Türkiye'de karşılığı yok. Türkiye tarafındaki
 * karşılıklar sitenin kendi çekirdeklerinde zaten var: bordro motoru
 * (kümülatif matrah), BES (devlet katkısı), kredi, ev/kira.
 *
 * TÜRKİYE İÇİN ÜÇ ZORUNLU FARK — bunlar çeviri değil, yeniden türetme:
 *
 * 1) ENFLASYON DA RASTGELEDİR VE GETİRİYLE KORELASYONLUDUR.
 *    Kaynak araç getiriyi rastgeleleştirip enflasyonu büyük ölçüde sabit
 *    tutuyor; düşük ve istikrarlı enflasyonda bu savunulabilir. Türkiye'de
 *    baskın belirsizlik enflasyonun KENDİSİ. Enflasyonu 30'da sabitleyip
 *    yalnızca getiriyi oynatan bir plan tehlikeli biçimde iyimser çıkar.
 *    Burada ikisi birlikte üretiliyor; aralarındaki korelasyon girdi.
 *
 * 2) BAŞARISIZLIK, ALIM GÜCÜNÜ KORUYAN ÇEKİMİ KARŞILAYAMAMAKTIR.
 *    Kaynakta başarı "bakiye sıfırın altına düşmesin". Yüksek enflasyonda
 *    bu ölçüt aldatıcı olur: para nominal olarak durur, alım gücü biter.
 *    Burada çekim her yıl enflasyon kadar artırılır, yani alım gücü sabit
 *    tutulur; bir yol, o çekimi karşılayamadığı anda başarısız sayılır.
 *    Raporlanan bütün bakiyeler ayrıca bugünün parasına indirgenir.
 *
 *    Bunun bir sonucu var ve açıkça yazılmalı: ÇEKİM SIFIRSA HİÇBİR YOL
 *    BAŞARISIZ OLAMAZ. Karşılanacak bir yükümlülük yoktur. İlk sürümde
 *    "çekimsiz bile yetmiyor" diye ulaşılamaz bir dal yazmıştım; test
 *    onu yakaladı ve kaldırıldı.
 *
 * 3) %4 KURALI YOK.
 *    Kaynakta varsayılan çekim oranı %4. O kural düşük ve istikrarlı
 *    enflasyon varsayar. Burada güvenli çekim oranı VARSAYILMIYOR,
 *    simülasyonun kendisinden çözülüyor (guvenliCekim).
 *
 * Yağlı kuyruk (Student-t) kaynaktan aynen alındı ve varsayılan yapıldı:
 * Türkiye getiri serilerinde uç yıllar normal dağılımın öngördüğünden
 * sık görülüyor.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ozgurluk-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.FIRE = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Rastgelelik — TOHUMLU
   *
   * Monte Carlo sonucu tekrar edilebilir olmalı: aynı girdi aynı sayıyı
   * vermezse ne test yazılabilir ne de kullanıcı "az önce %87 diyordu"
   * dediğinde cevap verilebilir. mulberry32, 32 bitlik durumu olan küçük
   * ve iyi dağılan bir üreteç.
   * ------------------------------------------------------------------ */
  function uretec(tohum) {
    var a = tohum >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Box-Muller: düzgün dağılımdan standart normal. */
  function normal(rnd) {
    var u = 1 - rnd(), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Student-t: normal / sqrt(chi2/df). Kuyrukları normalden kalın.
     Chi-kare, df adet standart normalin karelerinin toplamı. */
  function studentT(rnd, df) {
    var z = normal(rnd), c = 0;
    for (var i = 0; i < df; i++) { var n = normal(rnd); c += n * n; }
    return z / Math.sqrt(c / df);
  }

  /* Birim varyansa ölçekle: Student-t'nin varyansı df/(df-2)'dir.
     Ölçeklemezsek kullanıcının girdiği standart sapma sessizce büyür. */
  function birimT(rnd, df) {
    return studentT(rnd, df) / Math.sqrt(df / (df - 2));
  }

  function sayi(d) {
    if (typeof d === "number") return isFinite(d) ? d : 0;
    if (d === null || d === undefined) return 0;
    var s = String(d).trim().replace(/\s/g, "").replace(/₺/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /* Fisher: reel getiri. Çıkarma değil bölme. Birikim çekirdeğiyle aynı
     kural — iki araçta iki tanım olamaz. */
  function reelOran(nominal, enflasyon) {
    if (enflasyon <= -1) return 0;
    return (1 + nominal) / (1 + enflasyon) - 1;
  }

  var VARSAYILAN = {
    yolSayisi: 2000,
    dagilim: "t",        // "t" (yağlı kuyruk) veya "normal"
    serbestlik: 5,       // Student-t df — kaynaktaki değerle aynı
    tohum: 20260908,
    /* Getiri ile enflasyon arasındaki korelasyon. Türkiye'de mevduat ve
       borçlanma araçları enflasyonu takip ettiği için pozitif; hisse ve
       altın için ilişki daha zayıf. Girdi olarak bırakıldı. */
    korelasyon: 0.5,
    basariHedefi: 0.90   // güvenli çekim çözümünde aranan başarı oranı
  };

  /* ------------------------------------------------------------------ *
   * Bir yaşam yolu: birikim → emeklilik → tüketim
   *
   * Nominal olarak yürütülür (katkı ve çekim nominal artar), sonuç reele
   * indirgenir. Ters sıra — reelde yürütmek — enflasyon rastgele olduğu
   * için yanlış olurdu.
   * ------------------------------------------------------------------ */
  function birYol(g, rnd) {
    var yil = 0, bakiye = g.baslangic;
    var katki = g.aylikKatki * 12;
    var cekim = g.aylikCekim * 12;
    var kumulEnf = 1;               // bugüne indirgemek için biriken enflasyon
    var toplamYil = g.emeklilikYili + g.emeklilikSuresi;
    var reelBakiyeler = [];
    var tukendi = false, tukenmeYili = 0;

    for (yil = 1; yil <= toplamYil; yil++) {
      /* Korelasyonlu iki şok: getiri ve enflasyon.
         2x2 Cholesky elle: e2 = rho*e1 + sqrt(1-rho^2)*bagimsiz. */
      var z1 = g.dagilim === "normal" ? normal(rnd) : birimT(rnd, g.serbestlik);
      var z0 = g.dagilim === "normal" ? normal(rnd) : birimT(rnd, g.serbestlik);
      var z2 = g.korelasyon * z1 + Math.sqrt(Math.max(0, 1 - g.korelasyon * g.korelasyon)) * z0;

      var getiri = g.getiriOrt + g.getiriSapma * z1;
      var enflasyon = g.enflasyonOrt + g.enflasyonSapma * z2;

      /* İKİ FİZİKSEL TABAN.
         Yağlı kuyruk dağılımı %-100'den kötü getiri üretebiliyor; bu
         kaldıraçsız bir portföyde imkânsızdır (her şeyinizi kaybetmekten
         fazlasını kaybedemezsiniz) ve bakiyeyi NEGATİFE çeviriyordu.
         Testte "çekim sıfırken hiçbir yol başarısız olamaz" iddiası tam
         bu yüzden düşmüştü. Taban -%95: toplam kayba çok yakın ama
         bakiyeyi işaret değiştirmekten koruyor. */
      if (getiri < -0.95) getiri = -0.95;
      if (enflasyon < -0.9) enflasyon = -0.9;      // deflasyon tabanı

      var emeklilikte = yil > g.emeklilikYili;

      /* Nakit akışı yıl BAŞINDA, getiri yıl içinde: emeklilikte çekim
         önce yapılır, yani kötü bir yıl doğrudan bakiyeyi vurur.
         Sequence-of-returns riskinin ortaya çıktığı yer burası. */
      if (emeklilikte) bakiye -= cekim;
      else bakiye += katki;

      if (bakiye <= 0) {
        tukendi = true;
        tukenmeYili = yil;
        bakiye = 0;
        kumulEnf *= (1 + enflasyon);
        reelBakiyeler.push(0);
        /* Kalan yıllar sıfır: plan bu noktada zaten başarısız. */
        for (var k = yil + 1; k <= toplamYil; k++) reelBakiyeler.push(0);
        break;
      }

      bakiye *= (1 + getiri);
      kumulEnf *= (1 + enflasyon);

      /* Katkı ve çekim enflasyonla endekslenir — alım gücü sabit kalsın. */
      katki *= (1 + enflasyon);
      cekim *= (1 + enflasyon);

      reelBakiyeler.push(bakiye / kumulEnf);
    }

    return {
      reelBakiyeler: reelBakiyeler,
      tukendi: tukendi,
      tukenmeYili: tukenmeYili,
      sonReelBakiye: reelBakiyeler.length ? reelBakiyeler[reelBakiyeler.length - 1] : 0
    };
  }

  function normalize(girdi) {
    var g = girdi || {};
    return {
      baslangic: sayi(g.baslangic),
      aylikKatki: sayi(g.aylikKatki),
      aylikCekim: sayi(g.aylikCekim),
      emeklilikYili: Math.max(0, Math.round(sayi(g.emeklilikYili))),
      emeklilikSuresi: Math.max(1, Math.round(sayi(g.emeklilikSuresi))),
      getiriOrt: sayi(g.getiriOrtYuzde) / 100,
      getiriSapma: Math.max(0, sayi(g.getiriSapmaYuzde) / 100),
      enflasyonOrt: sayi(g.enflasyonOrtYuzde) / 100,
      enflasyonSapma: Math.max(0, sayi(g.enflasyonSapmaYuzde) / 100),
      korelasyon: Math.max(-0.99, Math.min(0.99,
        g.korelasyon === undefined ? VARSAYILAN.korelasyon : sayi(g.korelasyon))),
      dagilim: g.dagilim === "normal" ? "normal" : "t",
      serbestlik: Math.max(3, Math.round(
        g.serbestlik === undefined ? VARSAYILAN.serbestlik : sayi(g.serbestlik))),
      yolSayisi: Math.max(100, Math.round(
        g.yolSayisi === undefined ? VARSAYILAN.yolSayisi : sayi(g.yolSayisi))),
      tohum: Math.round(g.tohum === undefined ? VARSAYILAN.tohum : sayi(g.tohum))
    };
  }

  function yuzdelik(sirali, p) {
    if (!sirali.length) return 0;
    var i = (sirali.length - 1) * (p / 100);
    var alt = Math.floor(i), ust = Math.ceil(i);
    if (alt === ust) return sirali[alt];
    return sirali[alt] + (sirali[ust] - sirali[alt]) * (i - alt);
  }

  var BANTLAR = [5, 10, 25, 50, 75, 90, 95];   // kaynaktaki bantlarla aynı

  /* ------------------------------------------------------------------ *
   * Simülasyon
   * ------------------------------------------------------------------ */
  function calistir(girdi) {
    var g = normalize(girdi);
    var rnd = uretec(g.tohum);
    var toplamYil = g.emeklilikYili + g.emeklilikSuresi;

    var basarisiz = 0;
    var sonlar = [];
    var tukenmeYillari = [];
    /* Her yıl için bütün yolların reel bakiyesi — bantlar buradan çıkar. */
    var yilBazli = [];
    for (var t = 0; t < toplamYil; t++) yilBazli.push([]);

    for (var s = 0; s < g.yolSayisi; s++) {
      var yol = birYol(g, rnd);
      if (yol.tukendi) { basarisiz++; tukenmeYillari.push(yol.tukenmeYili); }
      sonlar.push(yol.sonReelBakiye);
      for (var y = 0; y < toplamYil; y++) {
        yilBazli[y].push(yol.reelBakiyeler[y] === undefined ? 0 : yol.reelBakiyeler[y]);
      }
    }

    var bantlar = yilBazli.map(function (dizi, i) {
      var sirali = dizi.slice().sort(function (a, b) { return a - b; });
      var o = { yil: i + 1 };
      BANTLAR.forEach(function (p) { o["p" + p] = yuzdelik(sirali, p); });
      return o;
    });

    sonlar.sort(function (a, b) { return a - b; });
    tukenmeYillari.sort(function (a, b) { return a - b; });

    return {
      girdi: g,
      yolSayisi: g.yolSayisi,
      basarisiz: basarisiz,
      /* Kaynaktaki tanımın aynısı: 1 - basarisiz/toplam. Fark, "başarı"nın
         REEL bakiye üzerinden ölçülmesi. */
      basariOrani: 1 - basarisiz / g.yolSayisi,
      bantlar: bantlar,
      sonReelOrtanca: yuzdelik(sonlar, 50),
      sonReelP10: yuzdelik(sonlar, 10),
      sonReelP90: yuzdelik(sonlar, 90),
      /* Başarısız yolların medyan tükenme yılı — "kötü giderse ne zaman"
         sorusunun cevabı. Ortalama başarı oranı bunu göstermez. */
      medyanTukenmeYili: tukenmeYillari.length ? yuzdelik(tukenmeYillari, 50) : 0
    };
  }

  /* ------------------------------------------------------------------ *
   * Güvenli çekim — VARSAYILMIYOR, ÇÖZÜLÜYOR
   *
   * Kaynakta varsayılan %4. Burada: hedef başarı oranını (varsayılan %90)
   * sağlayan en yüksek aylık çekim ikiye bölmeyle bulunuyor. Çekim arttıkça
   * başarı düşer; ilişki tek yönlü olduğu için ikiye bölme geçerli.
   * ------------------------------------------------------------------ */
  function guvenliCekim(girdi, hedefBasari) {
    var hedef = hedefBasari === undefined ? VARSAYILAN.basariHedefi : sayi(hedefBasari);
    var temel = normalize(girdi);

    function basari(cekim) {
      var g = {};
      for (var k in girdi) if (Object.prototype.hasOwnProperty.call(girdi, k)) g[k] = girdi[k];
      g.aylikCekim = cekim;
      return calistir(g).basariOrani;
    }

    /* Çekim sıfırken karşılanacak yükümlülük olmadığı için başarı her
       zaman %100'dür; bu yüzden "çekimsiz bile yetmiyor" diye bir durum
       YOKTUR. Anlamlı olan uç şu: bulunan tutar ihmal edilebilecek kadar
       küçükse, bu varsayımlarla sürdürülebilir bir çekim yok demektir. */
    var alt = 0, ust = Math.max(1000, temel.baslangic / 12), guvenlik = 0;
    while (basari(ust) >= hedef && guvenlik++ < 40) ust *= 2;
    if (basari(ust) >= hedef) return { bulundu: false, sebep: "sinirsiz", aylik: ust };

    /* Yarım lira kesinliği yeter; her adım tam bir simülasyon koşturuyor. */
    for (var i = 0; i < 40 && (ust - alt) > 0.5; i++) {
      var orta = (alt + ust) / 2;
      if (basari(orta) >= hedef) alt = orta; else ust = orta;
    }
    var aylik = Math.floor(alt * 100) / 100;
    /* Aylık bir liranın altı pratikte sıfırdır. */
    if (aylik < 1) {
      return { bulundu: false, sebep: "surdurulebilir-cekim-yok", aylik: 0,
               hedefBasari: hedef };
    }
    return {
      bulundu: true,
      aylik: aylik,
      hedefBasari: hedef,
      ulasilanBasari: basari(alt)
    };
  }

  /* ------------------------------------------------------------------ *
   * Gereken birikim: "şu kadar reel çekim için ne kadar birikmeli"
   * ------------------------------------------------------------------ */
  function gerekenBirikim(girdi, hedefBasari) {
    var hedef = hedefBasari === undefined ? VARSAYILAN.basariHedefi : sayi(hedefBasari);
    function basari(bas) {
      var g = {};
      for (var k in girdi) if (Object.prototype.hasOwnProperty.call(girdi, k)) g[k] = girdi[k];
      g.baslangic = bas;
      return calistir(g).basariOrani;
    }
    var alt = 0, ust = Math.max(100000, sayi(girdi.aylikCekim) * 12 * 40), guvenlik = 0;
    while (basari(ust) < hedef && guvenlik++ < 40) ust *= 2;
    if (basari(ust) < hedef) return { bulundu: false, tutar: 0 };
    for (var i = 0; i < 40 && (ust - alt) > 1; i++) {
      var orta = (alt + ust) / 2;
      if (basari(orta) < hedef) alt = orta; else ust = orta;
    }
    return { bulundu: true, tutar: Math.ceil(ust), hedefBasari: hedef };
  }

  return {
    VARSAYILAN: VARSAYILAN,
    BANTLAR: BANTLAR,
    sayi: sayi,
    reelOran: reelOran,
    uretec: uretec,
    normal: normal,
    birimT: birimT,
    normalize: normalize,
    yuzdelik: yuzdelik,
    birYol: birYol,
    calistir: calistir,
    guvenliCekim: guvenliCekim,
    gerekenBirikim: gerekenBirikim
  };
});
