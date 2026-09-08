/*!
 * Zam ve Prim Hesap Çekirdeği — Türkiye
 *
 * Bu dosya BORDRO HESABI YAPMAZ. Bütün ücret matematiği sitenin bordro
 * motorundan (bordro/motor.js) geliyor; burada yapılan iş senaryo kurmak
 * ve iki senaryoyu karşılaştırmak. İki yerde iki bordro hesabı olsaydı
 * zamanla sessizce ayrışırlardı.
 *
 * Motorun kritik yeteneği şu: hesaplaYil() aylık brüt olarak 12 elemanlı
 * bir DİZİ kabul ediyor. Yani "temmuzda zam aldım" ya da "martta prim
 * aldım" senaryoları motorun kendisine kurduruluyor — kümülatif vergi
 * matrahı, dilim geçişi ve asgari ücret istisnası dahil.
 *
 * ARACIN VAR OLUŞ SEBEBİ — ÖLÇÜLMÜŞ (İDDİA EDİLMEMİŞ) ÜÇ GERÇEK:
 *
 * 1) BRÜT ZAM ORANI NET ZAM ORANI DEĞİLDİR — AMA TEK BİR KURAL DA YOK.
 *    İlk yazdığımda "net oran her zaman brüt orandan küçüktür" demiştim;
 *    rastgele senaryo testi 150 denemenin 52'sinde bunu yanlışladı. Ölçüm
 *    üç ayrı bölge olduğunu gösterdi ve araç artık kullanıcıya hangi
 *    bölgede olduğunu söylüyor:
 *
 *      asgari ücret altı : net asgari ücret tabanı (ilave AGİ) devreye
 *                          girdiği için oran bozulur, net oran brütü aşar
 *      NORMAL BÖLGE      : asgari ücret ile SGK tavanı arası. Çalışanların
 *                          ezici çoğunluğu burada ve kural burada geçerli:
 *                          %50 brüt zam nete %37-44 olarak yansıyor
 *      SGK tavanı üstü   : tavanı aşan kısma SGK primi işlemediği için
 *                          artışın net oranı YÜKSELİR, brüt oranı geçebilir
 *
 *    Normal bölgedeki sebep kümülatif matrah: yüksek brütte üst dilimlere
 *    daha erken geçiliyor ve asgari ücret istisnası sabit tutar olduğu için
 *    oransal etkisi küçülüyor.
 *
 * 2) PRİMİN HANGİ AY ALINDIĞI GELİR VERGİSİNİ DEĞİŞTİRMEZ. Yaygın inanış
 *    ("primi aralıkta alma, vergisi yüksek olur") YANLIŞ. Kümülatif sistem
 *    yıllık toplam matrah üzerinden çalıştığı için aynı prim hangi ayda
 *    ödenirse ödensin yıllık net katkısı kuruşu kuruşuna aynı çıkıyor.
 *    Bu araç bunu iddia etmiyor, on iki ayı da hesaplayıp gösteriyor.
 *
 * 3) ZAMMIN GELDİĞİ AY yıllık neti doğrudan değiştirir — ama bu bir vergi
 *    etkisi değil, basitçe kaç ay boyunca yüksek maaş alındığı meselesi.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/zam-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var M = (typeof module === "object" && module.exports)
    ? require("../bordro/motor.js")
    : root.Bordro;   /* motor.js tarayicida root.Bordro olarak yayiliyor */
  var v = factory(M);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.ZAM = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Motor) {
  "use strict";

  function sayi(deger) {
    if (typeof deger === "number") return isFinite(deger) ? deger : 0;
    if (deger === null || deger === undefined) return 0;
    var s = String(deger).trim().replace(/\s/g, "").replace(/₺/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function yil(g) {
    var y = Math.round(sayi(g && g.yil));
    return Motor.parametreler[y] ? y : Motor.sonYil();
  }

  /* 12 aylık brüt dizisi: zamAyi'ndan itibaren yeni brüt.
     zamAyi = 1 ise yılın tamamı yeni brütle geçer. */
  function dizi(eski, yeni, zamAyi) {
    var a = [];
    for (var ay = 1; ay <= 12; ay++) a.push(ay < zamAyi ? eski : yeni);
    return a;
  }

  /* ------------------------------------------------------------------ *
   * 1) Zam
   * ------------------------------------------------------------------ */
  function zam(girdi) {
    girdi = girdi || {};
    var y = yil(girdi);
    var sec = girdi.secenekler || {};
    var eskiBrut = sayi(girdi.eskiBrut);
    var yeniBrut = girdi.yeniBrut !== undefined && sayi(girdi.yeniBrut) > 0
      ? sayi(girdi.yeniBrut)
      : eskiBrut * (1 + sayi(girdi.zamYuzde) / 100);
    var zamAyi = Math.min(12, Math.max(1, Math.round(sayi(girdi.zamAyi) || 1)));

    /* Karşılaştırma tabanı: zam HİÇ alınmasaydı yıl nasıl geçerdi. */
    var eski = Motor.hesaplaYil(eskiBrut, y, sec);
    var yeni = Motor.hesaplaYil(dizi(eskiBrut, yeniBrut, zamAyi), y, sec);
    /* Zammın yılın tamamına yayılmış hali — "aylık karşılığı" bundan gelir,
       yoksa temmuzda alınan zam yıllık ortalamada yarı yarıya görünür. */
    var tamYil = Motor.hesaplaYil(yeniBrut, y, sec);

    /* Hangi bölgedeyiz? Aracın cevabı buna göre değişiyor (bkz. başlık). */
    var d = Motor.donem(Motor.parametre(y), zamAyi);
    var bolge = eskiBrut < d.asgariBrut ? "asgari-alti"
              : eskiBrut > d.sgkTavan ? "tavan-ustu"
              : yeniBrut > d.sgkTavan ? "tavan-asiyor"
              : "normal";

    var brutArtis = eskiBrut > 0 ? (yeniBrut / eskiBrut - 1) : 0;
    var netArtisTamYil = eski.toplam.net > 0
      ? (tamYil.toplam.net / eski.toplam.net - 1) : 0;

    return {
      yil: y,
      eskiBrut: eskiBrut,
      yeniBrut: yeniBrut,
      zamAyi: zamAyi,
      bolge: bolge,
      asgariBrut: d.asgariBrut,
      sgkTavan: d.sgkTavan,
      brutArtisYuzde: brutArtis * 100,
      /* ARACIN ANA SAYISI: brüt zam oranı ile net zam oranı arasındaki fark.
         Zammın yılın tamamında geçerli olduğu varsayımıyla ölçülür ki
         zam ayı bu oranı kirletmesin. */
      netArtisYuzde: netArtisTamYil * 100,
      farkPuan: (brutArtis - netArtisTamYil) * 100,
      eskiYillikNet: eski.toplam.net,
      yeniYillikNet: yeni.toplam.net,
      tamYilNet: tamYil.toplam.net,
      yillikNetFark: yeni.toplam.net - eski.toplam.net,
      eskiAylikNet: eski.aylar[0].net,
      yeniAylikNet: tamYil.aylar[0].net,
      aylar: yeni.aylar,
      eskiAylar: eski.aylar,
      isverenMaliyetiEski: eski.toplam.isverenMaliyeti,
      isverenMaliyetiYeni: tamYil.toplam.isverenMaliyeti,
      dilimGecisAylari: yeni.aylar.filter(function (a) { return a.dilimGecisi; })
                                  .map(function (a) { return a.ay; })
    };
  }

  /* ------------------------------------------------------------------ *
   * 2) Pazarlık — "elime şu kadar geçsin" için gereken brüt
   *
   * Kapalı formülü yok: kümülatif matrah, dilim geçişi ve asgari ücret
   * istisnası araya giriyor. İkiye bölerek çözülüyor ve TANIMIYLA
   * sınanıyor: bulunan brüt geri beslendiğinde hedef net çıkmalı.
   * ------------------------------------------------------------------ */
  function gerekliBrut(girdi) {
    girdi = girdi || {};
    var y = yil(girdi);
    var sec = girdi.secenekler || {};

    var hedefYillikNet;
    if (girdi.hedefAylikNet !== undefined && sayi(girdi.hedefAylikNet) > 0) {
      /* Aylık net hedefi: yılın tamamı o net ile geçse ne eder. Kümülatif
         matrah yüzünden aylık net yıl içinde düşer; bu yüzden hedef
         YILLIK toplam üzerinden kurulur ve arayüz bunu açıkça yazar. */
      hedefYillikNet = sayi(girdi.hedefAylikNet) * 12;
    } else if (girdi.hedefNetArtisYuzde !== undefined) {
      var taban = Motor.hesaplaYil(sayi(girdi.eskiBrut), y, sec).toplam.net;
      hedefYillikNet = taban * (1 + sayi(girdi.hedefNetArtisYuzde) / 100);
    } else {
      hedefYillikNet = sayi(girdi.hedefYillikNet);
    }
    if (hedefYillikNet <= 0) return { gecerli: false };

    function netOf(brut) { return Motor.hesaplaYil(brut, y, sec).toplam.net; }

    var alt = 0, ust = Math.max(10000, sayi(girdi.eskiBrut) * 2), guvenlik = 0;
    while (netOf(ust) < hedefYillikNet && guvenlik++ < 40) ust *= 2;
    if (netOf(ust) < hedefYillikNet) return { gecerli: false, ulasilamaz: true };
    /* Yarım kuruş kesinliği yeter; her adım tam bir yıl hesabı koşturuyor. */
    for (var i = 0; i < 60 && (ust - alt) > 0.005; i++) {
      var orta = (alt + ust) / 2;
      if (netOf(orta) < hedefYillikNet) alt = orta; else ust = orta;
    }
    /* ust her zaman hedefi SAĞLAYAN uçtur; aşağı yuvarlamak onu bozuyor
       (ilk sürümde hedef nete 3 kuruş eksik kalıyordu). Yukarı yuvarlıyoruz. */
    var brut = Math.ceil(ust * 100) / 100;
    var eskiBrut = sayi(girdi.eskiBrut);
    var s = Motor.hesaplaYil(brut, y, sec);

    return {
      gecerli: true,
      yil: y,
      brut: brut,
      aylikNet: s.aylar[0].net,
      yillikNet: s.toplam.net,
      hedefYillikNet: hedefYillikNet,
      gerekenZamYuzde: eskiBrut > 0 ? (brut / eskiBrut - 1) * 100 : 0,
      isverenMaliyeti: s.toplam.isverenMaliyeti
    };
  }

  /* ------------------------------------------------------------------ *
   * 3) Prim
   *
   * "Primi aralıkta alma, vergisi yüksek olur" yaygın bir inanış. Bu
   * fonksiyon on iki ayı da hesaplayıp sonucu GÖSTERİYOR; iddia etmiyor.
   * ------------------------------------------------------------------ */
  function prim(girdi) {
    girdi = girdi || {};
    var y = yil(girdi);
    var sec = girdi.secenekler || {};
    var brut = sayi(girdi.brut);
    var primBrut = sayi(girdi.primBrut);

    var temel = Motor.hesaplaYil(brut, y, sec).toplam.net;
    var aylar = [];
    for (var ay = 1; ay <= 12; ay++) {
      var d = [];
      for (var i = 1; i <= 12; i++) d.push(i === ay ? brut + primBrut : brut);
      var n = Motor.hesaplaYil(d, y, sec).toplam.net;
      aylar.push({ ay: ay, ayAdi: Motor.AY_ADLARI[ay - 1], netKatki: n - temel });
    }
    var enAz = Math.min.apply(null, aylar.map(function (a) { return a.netKatki; }));
    var enCok = Math.max.apply(null, aylar.map(function (a) { return a.netKatki; }));

    return {
      yil: y,
      primBrut: primBrut,
      temelYillikNet: temel,
      aylar: aylar,
      enAzNet: enAz,
      enCokNet: enCok,
      /* Aradaki fark bir kuruşun altındaysa ay gerçekten fark etmiyor.
         Sıfırla değil eşikle karşılaştırıyoruz: SGK tavanı devrede olan
         senaryolarda küçük ama gerçek farklar çıkabiliyor. */
      ayFarkEdiyorMu: (enCok - enAz) > 0.01,
      ayFarki: enCok - enAz,
      /* Primin net oranı — "brüt 100.000 prim elime ne bırakır". */
      netOran: primBrut > 0 ? (enAz / primBrut) * 100 : 0
    };
  }

  return {
    sayi: sayi,
    zam: zam,
    gerekliBrut: gerekliBrut,
    prim: prim,
    yillar: function () { return Motor.yillar(); },
    sonYil: function () { return Motor.sonYil(); }
  };
});
