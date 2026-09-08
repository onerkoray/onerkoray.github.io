/*!
 * Birikim ve Emeklilik Hesap Çekirdeği — Türkiye
 *
 * Bu dosya DOM bilmez: tarayıcıda da Node'da da aynı sonucu üretir ve
 * test.js tarafından doğrudan çağrılır.
 *
 * ÜÇ TASARIM KARARI — bunlar aracın var oluş sebebi:
 *
 * 1) REEL GETİRİ FISHER İLE HESAPLANIR, ÇIKARMAYLA DEĞİL.
 *    Yaygın hata: reel = nominal - enflasyon. Düşük enflasyonda hatası
 *    küçüktür, Türkiye'de değildir. %45 getiri / %40 enflasyonda çıkarma
 *    "%5 kazandın" der; doğrusu (1,45/1,40)-1 = %3,57'dir. 30 yıla
 *    yayıldığında bu fark birikimi ikiye katlar. Formül: (1+n)/(1+e)-1.
 *
 * 2) YILLIK ORAN AYA BÖLÜNMEZ, 12. KÖKÜ ALINIR.
 *    %30 yıllık getiri ayda %2,5 değildir; (1,30)^(1/12)-1 = %2,21'dir.
 *    Bölme, 30 yılda birikimi ~%15 şişirir.
 *
 * 3) ORANLAR SABİT DEĞİL GİRDİDİR.
 *    Devlet katkısı oranı, stopaj oranları, fon kesintisi — hepsi
 *    mevzuatla değişir. Varsayılanları VARSAYILAN'da, gerekçesiyle
 *    birlikte duruyor; arayüz bunları düzenlenebilir gösterir. Bir oran
 *    değiştiğinde araç yanlış cevap vermeye başlamaz.
 *
 * Para aritmetiği tamsayı kuruş üzerinden yürür (bkz. kurus/kurusaCevir):
 * ekranda gösterilen satırlar toplandığında toplamı tutar.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/birikim-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BIRIKIM = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Varsayılan mevzuat parametreleri
   *
   * Hepsi ARAYÜZDE DÜZENLENEBİLİR. Buradaki değerler yalnızca başlangıç
   * noktasıdır; metodoloji sayfası her birinin dayanağını yazar.
   * ------------------------------------------------------------------ */
  var VARSAYILAN = {
    /* BES devlet katkısı — 4632 sayılı Kanun ek m.1.
       Oran 1 Ocak 2025'ten itibaren %25'ten %30'a çıkarıldı. */
    devletKatkiYuzde: 30,

    /* Devlet katkısı tavanı: bir takvim yılında ödenen katkı paylarının
       BRÜT ASGARİ ÜCRETİN YILLIK TUTARINI aşan kısmına devlet katkısı
       verilmez. Katsayı 12 = on iki aylık brüt asgari ücret. */
    devletKatkiTavanAy: 12,

    /* Hak kazanma (vesting) — 4632 sayılı Kanun ek m.1.
       Sistemde kalınan süreye göre devlet katkısının ne kadarına hak
       kazanıldığını gösterir. Emeklilik hakkı kullanılırsa %100. */
    hakKazanma: [
      { yil: 3, oran: 0.15 },
      { yil: 6, oran: 0.35 },
      { yil: 10, oran: 0.60 }
    ],

    /* Emeklilik şartı: 56 yaşını doldurmak VE sistemde en az 10 yıl
       katkı payı ödemek. İkisi birlikte aranır. */
    emeklilikYas: 56,
    emeklilikYil: 10,

    /* Stopaj — GVK m.94. Yalnızca GETİRİ üzerinden alınır, anaparadan
       ve devlet katkısının kendisinden değil.
         emeklilik : 56 yaş + 10 yıl tamamlanmış     -> %5
         onYil     : 10 yıl dolmuş, emekli olmadan   -> %10
         erken     : 10 yıldan önce ayrılma          -> %15 */
    stopaj: { emeklilik: 5, onYil: 10, erken: 15 },

    /* Fon toplam gider kesintisi — yıllık, birikim üzerinden.
       Fondan fona değişir; 2026 için tipik aralık %1,1-%2,3. */
    fonKesintiYuzde: 1.9,

    /* Mevduat stopajı — vadeye göre değişir, bu yüzden tek sayı değil.
       Birikim aracında kullanıcı hangi enstrümanda olduğunu seçtiği için
       tek bir varsayılan veriliyor; arayüzde değiştirilebilir. */
    mevduatStopajYuzde: 15
  };

  /* ------------------------------------------------------------------ *
   * Sayı ve para yardımcıları
   * ------------------------------------------------------------------ */

  /* Türkçe biçimli metni sayıya çevirir: "1.234,56" -> 1234.56
     Ayraç sezgisi kredi ve fatura çekirdekleriyle AYNI tutuldu; üç araçta
     üç farklı davranış kullanıcı için tutarsızlık olurdu. */
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

  function kurusaCevir(tl) { return Math.round(sayi(tl) * 100); }
  function kurus(k) { return Math.round(k) / 100; }

  /* Tamsayı kuruş aritmetiğinin sınırı.

     İlk sürümde eşik Number.MAX_SAFE_INTEGER idi ve YANLIŞTI: rastgele
     senaryo testi dörtte bir oranında düşmeye devam etti. Sebep, kuruş
     tamsayısının hâlâ tam olması ama TL karşılığının olmamasıydı —
     kurus() değeri 100'e bölünce ondalık sayıya çeviriyor ve 7,6×10^13
     TL civarında iki komşu ondalık sayı arasındaki mesafe (bir "ulp")
     0,016 TL'ye çıkıyor. Yani kuruş çözünürlüğü, tamsayı sınırına
     varılmadan çok önce kayboluyor.

     Doğru ölçüt tamsayı sınırı değil, SONUCUN KENDİ ÇÖZÜNÜRLÜĞÜ: bir
     ulp yarım kuruşu geçtiği anda gösterilen tutarlar birbirini
     tutmayabilir. Number.EPSILON = 2^-52 olduğuna göre eşik
     0,005 / 2^-52 ≈ 22,5 trilyon TL'ye denk geliyor. Gerçekçi bir
     birikim planında ulaşılmaz; uç parametrelerde ulaşılır ve o zaman
     `hassasiyetAsildi` bayrağı arayüzde uyarıya dönüşür.

     Eşiği gevşetmek yerine bildirmeyi seçtik: sessizce yaklaşık sayı
     göstermek, yanlış sayıyı doğru göstermektir. */
  var YARIM_KURUS = 0.005;
  function kesinlikYetersiz(kurusTutari) {
    return Math.abs(kurusTutari / 100) * Number.EPSILON > YARIM_KURUS;
  }

  /* ------------------------------------------------------------------ *
   * Oran dönüşümleri — aracın kalbi
   * ------------------------------------------------------------------ */

  /* Fisher: reel getiri. Çıkarma DEĞİL bölme.
     Enflasyon getiriden büyükse sonuç negatiftir; bu bir hata değil,
     satın alma gücünün eridiği anlamına gelir ve öyle gösterilir. */
  function reelOran(nominalYuzde, enflasyonYuzde) {
    var n = sayi(nominalYuzde) / 100, e = sayi(enflasyonYuzde) / 100;
    if (e <= -1) return 0;
    return (1 + n) / (1 + e) - 1;
  }

  /* Yıllık orandan aylık bileşik oran. Bölme değil 12. kök. */
  function aylikOran(yillikYuzde) {
    var y = sayi(yillikYuzde) / 100;
    if (y <= -1) return -1;
    return Math.pow(1 + y, 1 / 12) - 1;
  }

  /* ------------------------------------------------------------------ *
   * 1) Birikim büyütme
   *
   * Aylık döngü, tamsayı kuruş. Katkı her yılın başında katkiArtisYuzde
   * kadar artar — Türkiye'de sabit katkı varsaymak gerçekçi değil, ücret
   * de enflasyonla birlikte artıyor.
   * ------------------------------------------------------------------ */
  function buyut(girdi) {
    girdi = girdi || {};
    var yilSayisi = Math.max(0, Math.floor(sayi(girdi.yilSayisi)));
    var aylikK = kurusaCevir(girdi.aylikKatki);
    var bakiyeK = kurusaCevir(girdi.baslangic);
    var oran = aylikOran(girdi.yillikGetiriYuzde);
    var artis = sayi(girdi.katkiArtisYuzde) / 100;
    var enflasyon = sayi(girdi.yillikEnflasyonYuzde);
    var stopajOran = sayi(girdi.stopajYuzde) / 100;

    var toplamKatkiK = bakiyeK;   // başlangıç da yatırılan paradır
    var toplamGetiriK = 0;
    var yillar = [];
    var hassasiyetAsildi = false;

    for (var y = 1; y <= yilSayisi; y++) {
      var yilKatkiK = 0, yilGetiriK = 0;
      for (var a = 0; a < 12; a++) {
        bakiyeK += aylikK;
        yilKatkiK += aylikK;
        var g = Math.round(bakiyeK * oran);
        bakiyeK += g;
        yilGetiriK += g;
        if (kesinlikYetersiz(bakiyeK)) hassasiyetAsildi = true;
      }
      toplamKatkiK += yilKatkiK;
      toplamGetiriK += yilGetiriK;
      yillar.push({
        yil: y,
        katki: kurus(yilKatkiK),
        getiri: kurus(yilGetiriK),
        bakiye: kurus(bakiyeK),
        /* Reel bakiye: bugünün parasıyla karşılığı. Asıl anlamlı sayı bu. */
        reelBakiye: kurus(Math.round(bakiyeK / Math.pow(1 + sayi(enflasyon) / 100, y)))
      });
      aylikK = Math.round(aylikK * (1 + artis));
    }

    var stopajK = Math.max(0, Math.round(toplamGetiriK * stopajOran));
    var netK = bakiyeK - stopajK;
    var reelBolen = Math.pow(1 + sayi(enflasyon) / 100, yilSayisi);

    return {
      yillar: yillar,
      toplamKatki: kurus(toplamKatkiK),
      toplamGetiri: kurus(toplamGetiriK),
      brutBakiye: kurus(bakiyeK),
      stopaj: kurus(stopajK),
      netBakiye: kurus(netK),
      reelNetBakiye: kurus(Math.round(netK / reelBolen)),
      /* Reel getiri oranı — kullanıcıya "kazandın mı gerçekten" cevabı */
      reelYillikOran: reelOran(girdi.yillikGetiriYuzde, enflasyon),
      /* true ise tutarlar tamsayı kuruş kesinliğinin dışına çıktı;
         satırlar birbirini kuruşu kuruşuna tutmayabilir (bkz. KURUS_SINIRI) */
      hassasiyetAsildi: hassasiyetAsildi
    };
  }

  /* ------------------------------------------------------------------ *
   * 2) BES
   *
   * Devlet katkısı AYRI bir hesapta büyür ve fon kesintisine tabidir,
   * ama hak kazanma oranı yalnızca ONA uygulanır — kendi katkı payınız
   * ve onun getirisi her koşulda sizindir.
   * ------------------------------------------------------------------ */
  function bes(girdi) {
    girdi = girdi || {};
    var yilSayisi = Math.max(0, Math.floor(sayi(girdi.yilSayisi)));
    var aylikK = kurusaCevir(girdi.aylikKatki);
    var artis = sayi(girdi.katkiArtisYuzde) / 100;
    var brutOran = aylikOran(girdi.yillikGetiriYuzde);
    var fonKesinti = sayi(
      girdi.fonKesintiYuzde === undefined ? VARSAYILAN.fonKesintiYuzde : girdi.fonKesintiYuzde) / 100;
    /* Fon kesintisi yıllık ilan edilir ama günlük işler; aylık karşılığı
       yine 12. kökle bulunur, bölmeyle değil. */
    var aylikNet = (1 + brutOran) * Math.pow(1 - fonKesinti, 1 / 12) - 1;

    var dkYuzde = sayi(
      girdi.devletKatkiYuzde === undefined ? VARSAYILAN.devletKatkiYuzde : girdi.devletKatkiYuzde) / 100;
    var tavanAy = sayi(
      girdi.devletKatkiTavanAy === undefined ? VARSAYILAN.devletKatkiTavanAy : girdi.devletKatkiTavanAy);
    var asgariBrutK = kurusaCevir(girdi.brutAsgariAylik);
    var enflasyon = sayi(girdi.yillikEnflasyonYuzde);
    /* Asgari ücret de her yıl artar; tavan sabit kalırsa devlet katkısı
       yıllar içinde yapay olarak sınırlanmış görünür. */
    var asgariArtis = sayi(
      girdi.asgariArtisYuzde === undefined ? girdi.yillikEnflasyonYuzde : girdi.asgariArtisYuzde) / 100;

    var kendiK = 0, devletK = 0;
    var toplamKendiKatkiK = 0, toplamDevletKatkiK = 0, tavanKesilenK = 0;
    var yillar = [];
    var hassasiyetAsildi = false;

    for (var y = 1; y <= yilSayisi; y++) {
      var yilKatkiK = aylikK * 12;
      var tavanK = Math.round(asgariBrutK * tavanAy);
      var katkiyaEsasK = Math.min(yilKatkiK, tavanK);
      tavanKesilenK += (yilKatkiK - katkiyaEsasK);
      var yilDevletK = Math.round(katkiyaEsasK * dkYuzde);

      /* Katkılar yıl içine yayılır; ay ay işlenir ki getiri gerçekçi olsun.
         Devlet katkısı da aylık ödenir (katkı payıyla birlikte aktarılır). */
      var aylikDevletK = Math.round(yilDevletK / 12);
      for (var a = 0; a < 12; a++) {
        kendiK = Math.round((kendiK + aylikK) * (1 + aylikNet));
        devletK = Math.round((devletK + aylikDevletK) * (1 + aylikNet));
        if (kesinlikYetersiz(kendiK + devletK)) hassasiyetAsildi = true;
      }

      toplamKendiKatkiK += yilKatkiK;
      toplamDevletKatkiK += yilDevletK;
      yillar.push({
        yil: y,
        kendiKatki: kurus(yilKatkiK),
        devletKatkisi: kurus(yilDevletK),
        kendiBakiye: kurus(kendiK),
        devletBakiye: kurus(devletK),
        toplam: kurus(kendiK + devletK),
        reelToplam: kurus(Math.round((kendiK + devletK) / Math.pow(1 + enflasyon / 100, y)))
      });

      aylikK = Math.round(aylikK * (1 + artis));
      asgariBrutK = Math.round(asgariBrutK * (1 + asgariArtis));
    }

    var yas = sayi(girdi.yas);
    var emekliOlabilir =
      (yas + yilSayisi) >= sayi(girdi.emeklilikYas === undefined ? VARSAYILAN.emeklilikYas : girdi.emeklilikYas) &&
      yilSayisi >= sayi(girdi.emeklilikYil === undefined ? VARSAYILAN.emeklilikYil : girdi.emeklilikYil);

    var senaryolar = {
      emeklilik: emekliOlabilir ? cikis(1, VARSAYILAN.stopaj.emeklilik) : null,
      onYil: yilSayisi >= 10 ? cikis(hakOran(10), VARSAYILAN.stopaj.onYil) : null,
      simdi: cikis(hakOran(yilSayisi), yilSayisi >= 10 ? VARSAYILAN.stopaj.onYil : VARSAYILAN.stopaj.erken)
    };

    function hakOran(yil) {
      var tablo = girdi.hakKazanma || VARSAYILAN.hakKazanma;
      var o = 0;
      for (var i = 0; i < tablo.length; i++) if (yil >= tablo[i].yil) o = tablo[i].oran;
      return o;
    }

    /* Bir çıkış senaryosunun net tutarı.
       Hak kazanılmayan devlet katkısı Hazine'ye döner: ne ödenir ne
       vergilenir. Stopaj yalnızca ELE GEÇEN getiriden alınır. */
    function cikis(hakOrani, stopajYuzde) {
      var devletEleGecenK = Math.round(devletK * hakOrani);
      var brutK = kendiK + devletEleGecenK;
      var kendiGetiriK = kendiK - toplamKendiKatkiK;
      var devletGetiriK = devletEleGecenK - Math.round(toplamDevletKatkiK * hakOrani);
      /* Devlet katkısının KENDİSİ de çıkışta getiri sayılır ve stopaja
         tabidir; anapara sayılan yalnızca kendi ödediğiniz katkı payıdır. */
      var vergiyeEsasK = Math.max(0, kendiGetiriK + devletGetiriK + Math.round(toplamDevletKatkiK * hakOrani));
      var stopajK = Math.round(vergiyeEsasK * (sayi(stopajYuzde) / 100));
      var netK = brutK - stopajK;
      return {
        hakKazanmaOrani: hakOrani,
        stopajYuzde: sayi(stopajYuzde),
        devletEleGecen: kurus(devletEleGecenK),
        devletKaybedilen: kurus(devletK - devletEleGecenK),
        brut: kurus(brutK),
        vergiyeEsas: kurus(vergiyeEsasK),
        stopaj: kurus(stopajK),
        net: kurus(netK),
        reelNet: kurus(Math.round(netK / Math.pow(1 + enflasyon / 100, yilSayisi)))
      };
    }

    return {
      yillar: yillar,
      toplamKendiKatki: kurus(toplamKendiKatkiK),
      toplamDevletKatkisi: kurus(toplamDevletKatkiK),
      tavanNedeniyleAlinamayan: kurus(tavanKesilenK),
      kendiBakiye: kurus(kendiK),
      devletBakiye: kurus(devletK),
      brutToplam: kurus(kendiK + devletK),
      emekliOlabilir: emekliOlabilir,
      senaryolar: senaryolar,
      hassasiyetAsildi: hassasiyetAsildi
    };
  }

  /* ------------------------------------------------------------------ *
   * 3) Hedef — "ayda ne kadar ayırmalıyım"
   *
   * Katkı artışı ve bileşik getiri birlikte olduğu için kapalı formül
   * yok; ikiye bölerek çözülüyor. Kredi aracındaki YMO ile aynı yöntem.
   * ------------------------------------------------------------------ */
  function hedef(girdi) {
    girdi = girdi || {};
    var hedefTutar = sayi(girdi.hedefTutar);
    var yilSayisi = Math.max(1, Math.floor(sayi(girdi.yilSayisi)));
    var enflasyon = sayi(girdi.yillikEnflasyonYuzde);

    /* Hedef bugünün parasıyla verildiyse, o güne taşınır. Kullanıcı
       "30 yıl sonra 5 milyon" derken genellikle bugünkü 5 milyonu
       kastediyor; bu ayrım aracın en çok işe yarayan yeri. */
    var hedefNominal = girdi.hedefBugunku
      ? hedefTutar * Math.pow(1 + enflasyon / 100, yilSayisi)
      : hedefTutar;

    function sonuc(aylik) {
      return buyut({
        baslangic: girdi.baslangic,
        aylikKatki: aylik,
        katkiArtisYuzde: girdi.katkiArtisYuzde,
        yillikGetiriYuzde: girdi.yillikGetiriYuzde,
        yillikEnflasyonYuzde: enflasyon,
        yilSayisi: yilSayisi,
        stopajYuzde: girdi.stopajYuzde
      }).netBakiye;
    }

    if (sonuc(0) >= hedefNominal) {
      return { gerekliAylik: 0, ulasilan: sonuc(0), hedefNominal: kurus(Math.round(hedefNominal * 100)),
               yeterli: true };
    }

    var alt = 0, ust = 1000, guvenlik = 0;
    while (sonuc(ust) < hedefNominal && guvenlik++ < 60) ust *= 2;
    if (sonuc(ust) < hedefNominal) {
      return { gerekliAylik: 0, ulasilan: 0, hedefNominal: kurus(Math.round(hedefNominal * 100)),
               yeterli: false, ulasilamaz: true };
    }
    for (var i = 0; i < 120; i++) {
      var orta = (alt + ust) / 2;
      if (sonuc(orta) < hedefNominal) alt = orta; else ust = orta;
    }
    var aylik = kurus(Math.round(ust * 100));
    return {
      gerekliAylik: aylik,
      ulasilan: sonuc(aylik),
      hedefNominal: kurus(Math.round(hedefNominal * 100)),
      hedefBugunku: girdi.hedefBugunku ? sayi(hedefTutar) : kurus(Math.round(
        (hedefTutar / Math.pow(1 + enflasyon / 100, yilSayisi)) * 100)),
      yeterli: true
    };
  }

  /* ------------------------------------------------------------------ *
   * 4) Tüketim — "birikimim kaç yıl yeter"
   *
   * FIRE hesaplayıcılarının %4 kuralı Türkiye'de çalışmaz: o kural düşük
   * ve istikrarlı enflasyon varsayar. Burada çekim tutarı her yıl
   * enflasyon kadar artırılır ve bakiye REEL getiriyle büyütülür.
   * ------------------------------------------------------------------ */
  function tuketim(girdi) {
    girdi = girdi || {};
    var bakiyeK = kurusaCevir(girdi.baslangic);
    var cekimK = kurusaCevir(girdi.aylikCekim);
    var oran = aylikOran(girdi.yillikGetiriYuzde);
    var enflasyon = sayi(girdi.yillikEnflasyonYuzde) / 100;
    var enAzYil = Math.max(1, Math.floor(sayi(girdi.enAzYil) || 30));

    var yillar = [];
    var ay = 0, sinir = enAzYil * 12 * 3;   // sonsuz döngü koruması
    var tukendi = false;

    while (ay < sinir) {
      if (bakiyeK <= 0) { tukendi = true; break; }
      bakiyeK -= cekimK;
      if (bakiyeK <= 0) { tukendi = true; ay++; break; }
      bakiyeK = Math.round(bakiyeK * (1 + oran));
      ay++;
      if (ay % 12 === 0) {
        cekimK = Math.round(cekimK * (1 + enflasyon));
        yillar.push({ yil: ay / 12, bakiye: kurus(bakiyeK), aylikCekim: kurus(cekimK) });
      }
    }

    /* Sürdürülebilir çekim: reel getirinin tamamını harcamak anaparayı
       korur. Reel getiri negatifse böyle bir tutar YOKTUR — o durumda
       0 döner ve arayüz bunu açıkça söyler. */
    var reel = reelOran(girdi.yillikGetiriYuzde, girdi.yillikEnflasyonYuzde);
    var surdurulebilirAylik = reel > 0
      ? kurus(Math.round(kurusaCevir(girdi.baslangic) * (Math.pow(1 + reel, 1 / 12) - 1)))
      : 0;

    return {
      yillar: yillar,
      tukendi: tukendi,
      dayandigiAy: ay,
      dayandigiYil: Math.floor(ay / 12),
      kalanBakiye: kurus(Math.max(0, bakiyeK)),
      surdurulebilirAylik: surdurulebilirAylik,
      reelYillikOran: reel
    };
  }

  return {
    VARSAYILAN: VARSAYILAN,
    sayi: sayi,
    kurus: kurus,
    reelOran: reelOran,
    aylikOran: aylikOran,
    buyut: buyut,
    bes: bes,
    hedef: hedef,
    tuketim: tuketim
  };
});
