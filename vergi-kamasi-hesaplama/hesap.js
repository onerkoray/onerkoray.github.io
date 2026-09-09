/*!
 * Vergi Kaması Çekirdeği — Türkiye
 *
 * NE ÖLÇER: bir çalışanın işverene toplam maliyeti ile eline geçen net ücret
 * arasındaki farkı. Uluslararası karşılaştırmalarda (OECD, Taxing Wages)
 * kullanılan tanım budur:
 *
 *     kama = (işveren maliyeti − net) ÷ işveren maliyeti
 *
 * NEDEN AYRI BİR ÇEKİRDEK: bordro motoru tek bir ücreti hesaplar. Buradaki
 * soru tek bir ücret değil, ücret EKSENİ boyunca yükün nasıl değiştiği.
 * Ortalama yük ile marjinal yük farklı sorulardır ve Türkiye'de ikisi de
 * tek yönlü davranmaz:
 *
 *   - ORTALAMA kama prime esas kazanç tavanına kadar artar, tavanda zirve
 *     yapar ve SONRA DÜŞER. Sebep 5510 m.82: tavanın üstündeki kazançtan
 *     prim alınmaz, dolayısıyla ortalama yük aşağı çekilir.
 *   - MARJİNAL kama tavanda yaklaşık 20 puan kırılır.
 *
 * BU ÇEKİRDEK VERİ YAYIMLAMAZ, HESAPLAR. Türkiye için OECD ya da başka bir
 * kurumun yayımladığı kama değerleri buraya KOPYALANMADI; yalnızca tanım
 * alındı. Bütün sayılar sitenin kendi bordro motorundan, kullanıcının
 * seçtiği yıl parametreleriyle üretilir.
 *
 * DOĞRULAMA: marjinal oranlar mevzuattan kapalı formla da türetilebilir.
 *     tavan altı : 15 + 0,85 × dilim + damga
 *     tavan üstü : dilim + damga            (prim yok)
 * kapaliForm() bu türetmeyi verir; testler ölçülen ile türetilenin
 * örtüştüğünü sınar. Örtüşmüyorsa ya motor ya da bu çekirdek yanlıştır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/vergi-kamasi-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var M = (typeof module === "object" && module.exports)
    ? require("../bordro/motor.js")
    : root.Bordro;   /* motor.js tarayicida root.Bordro olarak yayiliyor */
  var v = factory(M);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Kama = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Motor) {
  "use strict";

  function sayi(deger) {
    if (typeof deger === "number") return isFinite(deger) ? deger : 0;
    if (deger === null || deger === undefined) return 0;
    var s = String(deger).trim().replace(/\s/g, "").replace(/₺/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /* Marjinal ölçümde kullanılan sonlu fark adımı (aylık brüt, TL).
     Küçültmek daha "doğru" değil: kümülatif matrah yüzünden fonksiyon
     parçalı doğrusaldır, çok küçük adım dilim geçişinin tam üstünde
     gürültü üretir. 1.000 TL, bandın içini ölçecek kadar küçük, gürültüden
     kaçacak kadar büyük. */
  var ADIM = 1000;

  /* Damga vergisi oranı bordro parametrelerinden okunur; kapalı form
     türetmesinde de aynı değer kullanılır ki iki yol bağımsız kalsın. */
  function damgaOrani(yil) {
    var P = Motor.parametre(yil);
    return P && P.oranlar && typeof P.oranlar.damga === "number" ? P.oranlar.damga : 0;
  }

  function isciPrimOrani(yil) {
    var P = Motor.parametre(yil);
    if (!P || !P.oranlar) return 0;
    return (P.oranlar.sgkIsci || 0) + (P.oranlar.issizlikIsci || 0);
  }

  /* ------------------------------------------------------------------ *
   * Tek bir ücret düzeyinin tam analizi
   * ------------------------------------------------------------------ */
  function nokta(aylikBrut, yil, secenekler) {
    var b = Math.max(0, sayi(aylikBrut));
    var y = yil || Motor.sonYil();
    var sec = secenekler || {};

    var r = Motor.hesaplaYil(b, y, sec);
    var t = r.toplam;
    var maliyet = t.isverenMaliyeti;
    var net = t.net;
    var brutYillik = b * 12;

    /* Sonlu fark: bir adım büyük ücretin net ve maliyet farkı. */
    var r2 = Motor.hesaplaYil(b + ADIM, y, sec);
    var dNet = r2.toplam.net - net;
    var dMaliyet = r2.toplam.isverenMaliyeti - maliyet;
    var dBrut = ADIM * 12;

    /* Dilim geçişinin hangi aylarda olduğu — kümülatif sistemin görünür
       çıktısı. Ortalama ile marjinal arasındaki farkın kaynağı burada. */
    var gecisAylari = [];
    r.aylar.forEach(function (a) { if (a.dilimGecisi) gecisAylari.push(a.ay); });

    /* Ücretin tavanı aşıp aşmadığı: prime esas kazanç brütten küçükse
       tavan devrededir. */
    var ilk = r.aylar[0];
    var tavanda = !!(ilk && ilk.primEsas < ilk.brut - 0.005);

    return {
      yil: y,
      aylikBrut: b,
      yillikBrut: brutYillik,
      yillikNet: net,
      yillikMaliyet: maliyet,
      sgkTavan: ilk ? ilk.sgkTavan : 0,
      asgariBrut: ilk ? ilk.asgariBrut : 0,
      tavanda: tavanda,

      /* Ortalama ölçüler */
      ortalamaKama: maliyet > 0 ? (maliyet - net) / maliyet : 0,
      ortalamaCalisanOrani: brutYillik > 0 ? (brutYillik - net) / brutYillik : 0,

      /* Marjinal ölçüler */
      marjinalKama: dMaliyet > 0 ? 1 - dNet / dMaliyet : 0,
      marjinalCalisan: dBrut > 0 ? 1 - dNet / dBrut : 0,

      /* Yükün bileşenleri — toplamları kamayı vermeli (test bunu sınıyor) */
      bilesen: {
        isverenPrim: maliyet - brutYillik,
        isciPrim: t.sgk + t.issizlik,
        gelirVergisi: t.gelirVergisi,
        damga: t.damga
      },
      istisna: t.istisna,
      istisnaOrani: brutYillik > 0 ? t.istisna / brutYillik : 0,
      dilimGecisAylari: gecisAylari,
      dilimler: r.aylar.map(function (a) { return a.dilim; })
    };
  }

  /* ------------------------------------------------------------------ *
   * Ücret ekseni boyunca eğri
   * ------------------------------------------------------------------ */
  function egri(girdi) {
    var g = girdi || {};
    var y = g.yil || Motor.sonYil();
    var P = Motor.parametre(y);
    var d = P.donemler[P.donemler.length - 1];

    var alt = Math.max(1, sayi(g.alt) || d.asgariBrut);
    var ust = Math.max(alt + 1, sayi(g.ust) || d.sgkTavan * 2);
    var adet = Math.max(4, Math.min(120, Math.round(sayi(g.adet) || 40)));

    var noktalar = [];
    for (var i = 0; i < adet; i++) {
      var b = alt + (ust - alt) * i / (adet - 1);
      noktalar.push(nokta(b, y, g.secenekler));
    }

    /* Tavan tam olarak örneklenmeyebilir; zirve orada olduğu için ayrıca
       ekleniyor ve sıraya sokuluyor. Aksi hâlde eğrinin tepesi kaçardı. */
    if (d.sgkTavan > alt && d.sgkTavan < ust) {
      noktalar.push(nokta(d.sgkTavan, y, g.secenekler));
      noktalar.sort(function (a, b2) { return a.aylikBrut - b2.aylikBrut; });
    }

    var zirve = noktalar.reduce(function (a, b2) {
      return b2.ortalamaKama > a.ortalamaKama ? b2 : a;
    });

    return {
      yil: y,
      alt: alt, ust: ust,
      sgkTavan: d.sgkTavan,
      asgariBrut: d.asgariBrut,
      noktalar: noktalar,
      zirve: zirve,
      /* Zirveden sonra kama düşüyor mu — yazının ve aracın ana iddiası.
         İddia edilmiyor, ÖLÇÜLÜYOR. */
      zirveSonrasiDusuyor: noktalar.length > 1 &&
        noktalar[noktalar.length - 1].ortalamaKama < zirve.ortalamaKama - 1e-9
    };
  }

  /* ------------------------------------------------------------------ *
   * Kapalı form türetme — bağımsız doğrulama yolu
   *
   * Tavanın ALTINDA ilave bir liralık brütten önce işçi primi kesilir;
   * kalan kısım gelir vergisi matrahına girer; damga brütün tamamından
   * alınır:
   *     oran = prim + (1 − prim) × dilim + damga
   * Tavanın ÜSTÜNDE prim kesilmediği için sadeleşir:
   *     oran = dilim + damga
   * ------------------------------------------------------------------ */
  function kapaliForm(dilimOrani, yil, tavanUstu) {
    var d = sayi(dilimOrani);
    var prim = tavanUstu ? 0 : isciPrimOrani(yil);
    return prim + (1 - prim) * d + damgaOrani(yil);
  }

  /* Marjinal kamanın kapalı formu: işverenin ilave bir brüt lira için
     ödediği tutar (1 + işveren yükü) paydadır. Tavan üstünde işveren de
     prim ödemediği için payda 1'e iner ve iki ölçü eşitlenir. */
  function kapaliFormKama(dilimOrani, yil, tavanUstu) {
    var P = Motor.parametre(yil);
    var o = P.oranlar || {};
    var isveren = tavanUstu ? 0 : ((o.sgkIsveren || 0) + (o.issizlikIsveren || 0));
    var calisan = kapaliForm(dilimOrani, yil, tavanUstu);
    return 1 - (1 - calisan) / (1 + isveren);
  }

  return {
    surum: "1.0.0",
    ADIM: ADIM,
    sayi: sayi,
    damgaOrani: damgaOrani,
    isciPrimOrani: isciPrimOrani,
    nokta: nokta,
    egri: egri,
    kapaliForm: kapaliForm,
    kapaliFormKama: kapaliFormKama
  };
});
