/*!
 * BES devlet katkısının efektif değeri: gözlemler ve türetmeleri.
 *
 * KAYNAK
 * ------
 * Bu modül aşağıdaki çalışmanın ölçümlerini taşır:
 *   Öner, K. (2026). Akış ve Stok: BES Devlet Katkısının Efektif Getirisi
 *   ve 2026 İndiriminin Ufuk Etkisi. Zenodo.
 *   https://doi.org/10.5281/zenodo.22852165
 *
 * Mevzuat dayanakları: 4632 sayılı Kanun ek m.1; oran değişikliği için
 * 10811 sayılı Cumhurbaşkanı Kararı (Resmî Gazete, 7 Ocak 2026, s.33130).
 *
 * MERKEZÎ FİKİR: AKIŞ İLE STOK
 * ----------------------------
 * Devlet katkısı katkı payı AKIŞIYLA orantılı: her yıl yatırdığının
 * belli bir yüzdesi. Fon gider kesintisi ise birikim STOKUYLA orantılı:
 * o güne kadar birikmiş paranın belli bir yüzdesi.
 *
 * Stok zamanla akıştan hızlı büyür. Dolayısıyla yeterince uzun bir ufukta
 * gider kesintisi katkıyı kaçınılmaz olarak aşar. Bu, tartışma konusu
 * değil aritmetik bir zorunluluktur; tartışılabilir olan yalnızca KAÇINCI
 * YILDA olduğudur. Çalışma o yılı ölçüyor.
 *
 * NE SAKLANIYOR, NE HESAPLANIYOR
 * ------------------------------
 * Saklanan: mevzuat parametreleri ve çalışmanın benzetimle ölçtüğü
 * kesişim yılları. Kesişim yılı bir benzetim sonucudur; burada yeniden
 * üretilemez ve üretiliyormuş gibi yapılmıyor.
 *
 * Hesaplanan: efektif eşleşme oranı, azami yıllık katkı, indirimin
 * kesişimi kaç yıl öne çektiği, tavanın kaç katında oranın yarıya
 * düştüğü. Bunlar kapalı formdan gelir ve BURADA türetilir.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"));
  } else {
    kok.Bes = fabrika(kok.Bordro);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  /* --- Oranın seyri (4632 ek m.1) ---------------------------------- */
  var ORANLAR = [
    { baslangic: "2013-01-01", bitis: "2022-01-21", oran: 0.25 },
    { baslangic: "2022-01-22", bitis: "2025-12-31", oran: 0.30 },
    { baslangic: "2026-01-01", bitis: null, oran: 0.20 }
  ];

  /* ASGARİ ÜCRET BURAYA YAZILMIYOR, MOTORDAN OKUNUYOR.
     İlk sürümde tutar doğrudan yazılmıştı ve parametre-kopyasi.js
     bunu haklı olarak yakaladı: kopyalanan bir yasal parametre, tek
     doğruluk kaynağıyla sessizce ayrışabilecek ikinci bir kaynak
     yaratır. 2027 asgari ücreti açıklandığında burada değişecek hiçbir
     şey yok — tavan kendiliğinden güncellenir. */
  var YIL = 2026;

  function asgariBrutAy() {
    return B.parametre(YIL).donemler[0].asgariBrut;
  }

  /* --- Hak ediş kademeleri (4632 ek m.1) --------------------------- */
  var HAK_EDIS = [
    { yil: 0, oran: 0.00 },
    { yil: 3, oran: 0.15 },
    { yil: 6, oran: 0.35 },
    { yil: 10, oran: 0.60 }
  ];
  /* Emeklilik hakkı kullanılırsa (56 yaş + 10 yıl) oran %100. */
  var EMEKLILIKTE = 1.00;

  /* --- Çalışmanın benzetimle ölçtüğü kesişim yılları ---------------
     Kesişim: katılımcının iç verim oranının brüt fon getirisinin ALTINA
     düştüğü yıl. Tam hak ediş ve %5 stopaj altında. */
  var KESISIM = {
    /* Borçlanma/endeks fon grubu, yıllık fon gider kesintisi %1,91 */
    fonKesinti: 0.0191,
    oran30: 25,
    oran20: 18,
    /* Fon grubuna göre %20 eşleşmede gözlenen aralık */
    aralikEnAz: 15,
    aralikEnCok: 28
  };

  /* --- Kısa ufuk: kesintilerin hak edilen katkıya oranı -------------
     %100'ün ÜSTÜ, kesintilerin katkıdan büyük olduğu anlamına gelir. */
  var KISA_UFUK = [
    { yil: 3, kesintiPayi: 1.08 },
    { yil: 5, kesintiPayi: 1.42 }
  ];
  /* Teşvikin net pozitife döndüğü yıl: hak ediş %35'e çıkıyor ve gider
     iadesi başlıyor. */
  var POZITIFE_DONUS_YILI = 6;

  /* --- İndirimin nihai birikimdeki oransal kaybı --------------------
     Tam hak edişte bütün bileşenler oranla doğrusal ölçeklendiği için
     kayıp ufuktan neredeyse bağımsız. */
  var KAYIP = [
    { ufukYil: 10, oran: 0.0771 },
    { ufukYil: 30, oran: 0.0770 }
  ];

  /* ---------------------- türetmeler ------------------------------- */

  function guncelOran() {
    return ORANLAR[ORANLAR.length - 1].oran;
  }

  function oncekiOran() {
    return ORANLAR[ORANLAR.length - 2].oran;
  }

  /* Eşleşme tabanı tavanı: bir takvim yılının brüt asgari ücreti. */
  function tavan() {
    return asgariBrutAy() * 12;
  }

  /* Azami yıllık devlet katkısı. */
  function azamiKatki(oran) {
    return tavan() * (oran === undefined ? guncelOran() : oran);
  }

  /* EFEKTİF EŞLEŞME ORANI — kapalı form.
     m_ef(C) = m · min(C, A) / C
     C ≤ A bölgesinde yasal oranın kendisi; C > A bölgesinde m·A/C
     hiperbolü. Yani tavanı aşan katılımcı için oran ERİR. */
  function efektifOran(yillikKatki, oran) {
    var m = (oran === undefined ? guncelOran() : oran);
    var A = tavan();
    if (yillikKatki <= 0) return m;
    return m * Math.min(yillikKatki, A) / yillikKatki;
  }

  /* Tavanın kaç katı katkıda efektif oran yasal oranın 1/k'sine düşer?
     m·A/C = m/k  ⇒  C = k·A. Yani cevap doğrudan k'dir; fonksiyon bunu
     KATKI TUTARI olarak veriyor. */
  function oraninBolundugKatki(kat) {
    return tavan() * kat;
  }

  /* İndirim kesişimi kaç yıl öne çekti? */
  function ufukKaybi() {
    return KESISIM.oran30 - KESISIM.oran20;
  }

  /* Hak ediş oranı: sistemde geçirilen yıla göre. */
  function hakEdis(yil) {
    var o = 0;
    HAK_EDIS.forEach(function (k) { if (yil >= k.yil) o = k.oran; });
    return o;
  }

  /* Kayıp oranı ufuktan bağımsız mı? İki ölçümün farkı puan olarak. */
  function kayipFarkiPuan() {
    return Math.abs(KAYIP[0].oran - KAYIP[1].oran) * 100;
  }

  /* Oranın yüzde kaç düştüğü (30 -> 20 = üçte bir). */
  function indirimOrani() {
    return (oncekiOran() - guncelOran()) / oncekiOran();
  }

  return {
    ORANLAR: ORANLAR, YIL: YIL,
    asgariBrutAy: asgariBrutAy,
    HAK_EDIS: HAK_EDIS, EMEKLILIKTE: EMEKLILIKTE,
    KESISIM: KESISIM, KISA_UFUK: KISA_UFUK, KAYIP: KAYIP,
    POZITIFE_DONUS_YILI: POZITIFE_DONUS_YILI,
    guncelOran: guncelOran,
    oncekiOran: oncekiOran,
    tavan: tavan,
    azamiKatki: azamiKatki,
    efektifOran: efektifOran,
    oraninBolundugKatki: oraninBolundugKatki,
    ufukKaybi: ufukKaybi,
    hakEdis: hakEdis,
    kayipFarkiPuan: kayipFarkiPuan,
    indirimOrani: indirimOrani
  };
});
