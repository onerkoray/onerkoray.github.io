/*!
 * Çalışma Biçimi Karşılaştırma Motoru
 *
 * Aynı parayı kazanmanın dört farklı yolunu, karşı tarafın katlandığı TOPLAM
 * MALİYET sabit tutularak karşılaştırır:
 *   1) SGK'lı çalışan (4/a)
 *   2) Şahıs işletmesi — serbest meslek veya ticari kazanç (4/b)
 *   3) Limited şirket — ortağa ücret yok, yalnızca kâr payı
 *   4) Limited şirket — ortağa ücret + kâr payı
 *
 * Neden "toplam maliyet" ortak payda: aynı brüt rakam bu dört durumda aynı şeyi
 * ifade etmez. Çalışanda işveren ayrıca %23,75 prim öder; faturada böyle bir
 * ek yoktur. Karşılaştırmayı brüt üzerinden yapmak çalışanı haksız yere iyi
 * gösterir. Doğru soru şudur: karşı taraf yılda X lira ayırıyorsa, hangi
 * biçimde ne kadarı sende kalır?
 *
 * bordro/motor.js üzerine kurulur. Lisans: MIT — Koray Öner
 * https://korayoner.dev/bordro/
 */
(function (root, factory) {
  "use strict";
  var Bordro = (typeof module === "object" && module.exports)
    ? require("./motor.js")
    : root.Bordro;
  var v = factory(Bordro);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BordroCalismaBicimi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  /* ---------- yardımcılar ---------- */

  function sirketP(P) {
    if (!P.sirket) {
      throw new Error("Çalışma biçimi: " + P.yil + " yılı için şirket parametreleri tanımlı değil.");
    }
    return P.sirket;
  }

  /* GVK m.86: menkul sermaye iradı beyan haddi, tarifenin ikinci diliminin üst sınırıdır. */
  function beyanHaddi(P) { return P.dilimler[1][0]; }

  function ucretDisiDilimler(P) {
    if (!P.dilimlerUcretDisi) {
      throw new Error("Çalışma biçimi: " + P.yil + " için ücret dışı tarife tanımlı değil.");
    }
    return P.dilimlerUcretDisi;
  }

  /* 4/b (Bağ-Kur) yıllık primi. Matrah asgari ücret ile SGK tavanı arasındadır. */
  function bagkurYillik(P, aylikMatrah, indirimli) {
    var s = sirketP(P);
    var d = P.donemler[0];
    var taban = d.asgariBrut, tavan = d.sgkTavan;
    var m = (typeof aylikMatrah === "number" && aylikMatrah > 0) ? aylikMatrah : taban;
    m = Math.min(Math.max(m, taban), tavan);
    var oran = indirimli ? s.bagkurIndirimliOran : s.bagkurOrani;
    return { aylikMatrah: m, oran: oran, aylik: m * oran, yillik: m * oran * 12 };
  }

  /* Verilen yıllık işveren maliyetini doğuran aylık brüt ücreti çözer.
     Maliyet brütte doğrusal değildir: işveren primi SGK tavanında durur. */
  function maliyettenBrut(P, yillikMaliyet) {
    var o = P.oranlar, d = P.donemler[0];
    function maliyet(brut) {
      var pek = Math.min(Math.max(brut, d.asgariBrut), d.sgkTavan);
      return (brut + pek * (o.sgkIsveren + o.issizlikIsveren)) * 12;
    }
    var alt = 0, ust = yillikMaliyet / 12, guvenlik = 0;
    while (maliyet(ust) < yillikMaliyet && guvenlik++ < 60) ust *= 1.5;
    for (var i = 0; i < 60; i++) {
      var orta = (alt + ust) / 2;
      if (maliyet(orta) < yillikMaliyet) alt = orta; else ust = orta;
    }
    return Math.round(ust * 100) / 100;
  }

  /* ---------- senaryolar ---------- */

  function calisan(P, g) {
    var brut = maliyettenBrut(P, g.yillikMaliyet);
    var y = B.hesaplaYil(brut, P.yil);
    var t = y.toplam;

    return {
      kod: "calisan",
      ad: "SGK'lı çalışan",
      kisa: "Çalışan",
      aylikBrut: brut,
      hasilat: t.brut,
      gider: 0,
      prim: t.sgk + t.issizlik,
      primAdi: "SGK + işsizlik işçi payı",
      matrah: null,
      istisna: t.istisna,
      vergi: t.gelirVergisi + t.damga,
      /* Vergi kırılımı: her senaryoda aynı adlarla verilir, olmayan kalem 0'dır.
         Arayüz bu alanları doğrudan basar; tutarları geri hesaplamaz. */
      vGelir: t.gelirVergisi,
      vDamga: t.damga,
      vKurumlar: 0,
      vStopaj: 0,
      vBeyanFarki: 0,
      net: t.net,
      /* Çalışanın gider yazma imkânı yoktur; bu, karşılaştırmanın en belirleyici
         farkıdır ve girilen gider tutarı bu senaryoda bilinçli olarak yok sayılır. */
      giderYazabilir: false,
      notlar: [
        "İşveren maliyeti sabit tutularak aylık brüt ücret " + brut.toFixed(2) + " TL olarak çözüldü.",
        "Çalışan gider yazamaz; girdiğiniz gider bu senaryoda dikkate alınmaz.",
        "Kıdem ve ihbar tazminatı, yıllık izin ve işsizlik ödeneği hakları yalnızca bu senaryoda doğar."
      ]
    };
  }

  function sahis(P, g) {
    var s = sirketP(P);
    var bk = bagkurYillik(P, g.bagkurMatrahi, g.bagkurIndirimi);
    var hasilat = g.yillikMaliyet;
    var kazanc = hasilat - g.yillikGider;

    var ihracat = Math.max(0, kazanc) * g.ihracatOrani * s.hizmetIhracatiIndirimi;
    var matrah = Math.max(0, kazanc - bk.yillik - ihracat);
    var vergi = B.tarifeVergisi(matrah, ucretDisiDilimler(P));
    var net = kazanc - bk.yillik - vergi;

    return {
      kod: "sahis",
      ad: "Şahıs işletmesi (serbest meslek / ticari kazanç)",
      kisa: "Şahıs işletmesi",
      hasilat: hasilat,
      gider: g.yillikGider,
      kazanc: kazanc,
      prim: bk.yillik,
      primAdi: "Bağ-Kur (4/b) primi",
      bagkur: bk,
      ihracatIndirimi: ihracat,
      matrah: matrah,
      vergi: vergi,
      vGelir: vergi,
      vDamga: 0,
      vKurumlar: 0,
      vStopaj: 0,
      vBeyanFarki: 0,
      net: net,
      giderYazabilir: true,
      notlar: [
        "Ödenen Bağ-Kur primi gelir vergisi matrahından indirilir.",
        "Serbest meslek makbuzunda kurumlara kesilen %" + Math.round(s.serbestMeslekStopaji * 100) +
          " stopaj yıllık beyanda mahsup edilir; yıllık nete etkisi yoktur, yalnızca nakit akışını öne çeker.",
        "Ticari kazançta stopaj yoktur; yıllık vergi yükü serbest meslekle aynıdır. Fark defter düzeni, gider kapsamı ve KDV uygulamasındadır."
      ]
    };
  }

  /* ucretBrut: ortağa ödenen aylık brüt ücret (0 ise ücret ödenmiyor demektir). */
  function limited(P, g, ucretBrut, kod, ad, kisa) {
    var s = sirketP(P);
    var bk = bagkurYillik(P, g.bagkurMatrahi, g.bagkurIndirimi);

    /* Ortağa ücret (huzur hakkı): şirket için gider, ortak için ücret geliri.
       Limited şirket ortağı 5510 m.4/1-b uyarınca 4/b sigortalısıdır; kendi
       şirketinden ücret alsa da 4/a'lı olmaz. Bu nedenle bu ödemeden SGK ve
       işsizlik primi KESİLMEZ — yalnızca gelir ve damga vergisi doğar ve
       asgari ücret istisnası uygulanır. Şirkete maliyeti brüt tutarın kendisidir. */
    var ucretNet = 0, ucretIsverenMaliyeti = 0, ucretVergi = 0, ucretPrim = 0;
    var ucretGelirVergisi = 0, ucretDamga = 0;
    if (ucretBrut > 0) {
      var uy = B.hesaplaYil(ucretBrut, P.yil, { primsiz: true }).toplam;
      ucretNet = uy.net;
      ucretGelirVergisi = uy.gelirVergisi;
      ucretDamga = uy.damga;
      ucretVergi = ucretGelirVergisi + ucretDamga;
      ucretPrim = 0;
      ucretIsverenMaliyeti = ucretBrut * 12;
    }

    var hasilat = g.yillikMaliyet;
    var kurumKazanci = hasilat - g.yillikGider - ucretIsverenMaliyeti;
    var ihracat = Math.max(0, kurumKazanci) * g.ihracatOrani * s.hizmetIhracatiIndirimi;
    var kvMatrah = Math.max(0, kurumKazanci - ihracat);
    var kv = kvMatrah * s.kurumlarVergisi;

    var dagitilabilir = Math.max(0, kurumKazanci - kv);
    var stopaj = dagitilabilir * s.karPayiStopaji;
    var karPayiEline = dagitilabilir - stopaj;

    /* GVK m.22: kâr payının yarısı istisna. Kalan yarı beyan haddini aşarsa
       beyan edilir ve kesilen stopajın TAMAMI mahsup edilir. */
    var beyanaTabi = dagitilabilir * s.karPayiIstisnaOrani;
    var hadd = beyanHaddi(P);
    var beyanVar = beyanaTabi > hadd;
    var beyanMatrahi = 0, hesaplananGV = 0, odenecekGV = 0, iadeGV = 0;

    if (beyanVar) {
      // Beyan verildiğinde ödenen Bağ-Kur primi matrahtan indirilebilir.
      beyanMatrahi = Math.max(0, beyanaTabi - bk.yillik);
      hesaplananGV = B.tarifeVergisi(beyanMatrahi, ucretDisiDilimler(P));
      odenecekGV = Math.max(0, hesaplananGV - stopaj);
      iadeGV = Math.max(0, stopaj - hesaplananGV);
    }

    var net = ucretNet + karPayiEline - bk.yillik - odenecekGV + iadeGV;

    return {
      kod: kod,
      ad: ad,
      kisa: kisa,
      hasilat: hasilat,
      gider: g.yillikGider,
      ucretBrut: ucretBrut,
      ucretNet: ucretNet,
      ucretIsverenMaliyeti: ucretIsverenMaliyeti,
      kurumKazanci: kurumKazanci,
      ihracatIndirimi: ihracat,
      kvMatrah: kvMatrah,
      kurumlarVergisi: kv,
      dagitilabilir: dagitilabilir,
      karPayiStopaji: stopaj,
      karPayiEline: karPayiEline,
      beyanVar: beyanVar,
      beyanHaddi: hadd,
      beyanaTabi: beyanaTabi,
      beyanMatrahi: beyanMatrahi,
      hesaplananGV: hesaplananGV,
      odenecekGV: odenecekGV,
      iadeGV: iadeGV,
      prim: bk.yillik + ucretPrim,
      primAdi: "Bağ-Kur (4/b) primi",
      bagkur: bk,
      vergi: kv + stopaj + odenecekGV - iadeGV + ucretVergi,
      vGelir: ucretGelirVergisi,
      vDamga: ucretDamga,
      vKurumlar: kv,
      vStopaj: stopaj,
      vBeyanFarki: odenecekGV - iadeGV,
      matrah: kvMatrah,
      net: net,
      giderYazabilir: true,
      notlar: (function () {
        var n = ["Kurumlar vergisi %" + Math.round(s.kurumlarVergisi * 100) +
          ", dağıtılan kâr payında %" + Math.round(s.karPayiStopaji * 100) + " stopaj."];
        if (ucretBrut > 0) {
          n.push("Ortağa ödenen ücret şirket gideridir ve ücretin asgari ücrete isabet eden kısmı gelir ile damga vergisinden istisnadır.");
          n.push("Limited ortağı kendi şirketinden ücret alsa da 4/b sigortalısı olmaya devam eder; bu ödemeden SGK primi kesilmez, Bağ-Kur ayrıca ödenir.");
        }
        n.push(beyanVar
          ? "Kâr payının yarısı (" + beyanaTabi.toFixed(2) + " TL) beyan haddini (" + hadd.toFixed(2) +
            " TL) aştığı için beyan edilir; kesilen stopajın tamamı mahsup edilir."
          : "Kâr payının beyana tabi yarısı beyan haddinin (" + hadd.toFixed(2) +
            " TL) altında kaldığı için beyan gerekmez; stopaj nihai vergidir.");
        n.push("Kârın dağıtılmayıp şirkette bırakılması hâlinde kâr payı stopajı ve beyan doğmaz; bu hesap kârın tamamının dağıtıldığını varsayar.");
        return n;
      })()
    };
  }

  /* ---------- karşılaştırma ---------- */

  function karsilastir(girdi) {
    var yil = girdi.yil || B.sonYil();
    var P = B.parametre(yil);

    var g = {
      yillikMaliyet: Number(girdi.yillikMaliyet) || 0,
      yillikGider: Math.max(0, Number(girdi.yillikGider) || 0),
      ihracatOrani: Math.min(1, Math.max(0, Number(girdi.ihracatOrani) || 0)),
      bagkurMatrahi: girdi.bagkurMatrahi,
      bagkurIndirimi: girdi.bagkurIndirimi !== false
    };
    if (g.yillikGider > g.yillikMaliyet) g.yillikGider = g.yillikMaliyet;

    var ucret = (typeof girdi.ortakUcretBrut === "number" && girdi.ortakUcretBrut > 0)
      ? girdi.ortakUcretBrut
      : P.donemler[0].asgariBrut;

    var senaryolar = [
      calisan(P, g),
      sahis(P, g),
      limited(P, g, 0, "limited", "Limited şirket — yalnızca kâr payı", "Limited (kâr payı)"),
      limited(P, g, ucret, "limitedUcret", "Limited şirket — ortağa ücret + kâr payı", "Limited (ücret + kâr payı)")
    ];

    /* Devlete giden pay: toplam maliyetten, işletme gideri ve elde kalan net
       düşüldükten sonra kalan tutar. Çalışanda işveren primini de kapsar —
       o da toplam maliyetin içindedir. Gider "harcanan para" olduğu için
       netten düşer; yükü ölçerken ayrı tutulur, aksi hâlde gider yazmak
       vergi yükü gibi görünürdü. */
    senaryolar.forEach(function (x) {
      x.devleteGiden = g.yillikMaliyet - x.gider - x.net;
      x.efektifYuk = g.yillikMaliyet > 0 ? x.devleteGiden / g.yillikMaliyet : 0;
      x.aylikNet = x.net / 12;
    });

    var enIyi = senaryolar.reduce(function (a, b) { return b.net > a.net ? b : a; });
    senaryolar.forEach(function (x) {
      x.enIyi = (x.kod === enIyi.kod);
      x.fark = x.net - enIyi.net;   // en iyiye göre fark (<= 0)
    });

    return {
      yil: yil,
      parametre: P,
      girdi: g,
      ortakUcretBrut: ucret,
      senaryolar: senaryolar,
      enIyi: enIyi
    };
  }

  return {
    surum: "1.0.0",
    beyanHaddi: beyanHaddi,
    bagkurYillik: bagkurYillik,
    maliyettenBrut: maliyettenBrut,
    karsilastir: karsilastir
  };
});
