/*!
 * SGK prim tavanının 7,5 kattan 9 kata çıkmasının ölçülmesi.
 *
 * NEDEN AYRI MODÜL
 * ----------------
 * Aynı hesap üç yerde lazım: yazının tabloları, testi ve ileride akademik
 * çalışmanın yeniden üretimi.
 *
 * KARŞI OLGU ELLE YAZILMIYOR
 * --------------------------
 * "Tavan değişmeseydi ne olurdu?" sorusunun cevabı 7,5 sayısını buraya
 * yazmakla değil, BİR ÖNCEKİ YILIN katsayısını okumakla kuruluyor
 * (parametre(yil-1).tavanKatsayisi). Elle yazılan 7,5 bir sonraki katsayı
 * değişiminde sessizce yanlışa dönerdi.
 *
 * Bu güvenli, çünkü bordro/test.js her yıl için
 * sgkTavan = asgariBrut x tavanKatsayisi eşitliğini kuruşuna kadar
 * bağlıyor. Katsayı ile tavan ayrışamaz.
 *
 * ÜÇ BULGU
 * --------
 * B1. Etki KESKİN BİR ARALIKTA. Eski tavanın altında kalan hiç
 *     etkilenmiyor; yeni tavanın üstünde kalan için etki sabitleniyor.
 *     Aradaki bant, ek primin kademeli olarak devreye girdiği yer.
 *
 * B2. EN ÇOK KAYBEDEN, EN ÇOK KAZANAN DEĞİL. Ek prim gelir vergisi
 *     matrahını düşürdüğü için net kayıp = ek prim x (1 - marjinal oran).
 *     Prim tabanı tavanla sınırlı ama vergi kalkanı değil; üst dilimdeki
 *     kişi aynı primi daha ucuza ödüyor.
 *
 * B3. BU BİR VERGİ DEĞİL, ZORUNLU EMEKLİLİK ALIMI. Yüksek prime esas
 *     kazanç, emekli aylığını doğru orantılı büyütüyor. Ödenen fazla
 *     primin geri dönüş süresi, kariyer biçiminden neredeyse bağımsız.
 *
 * KAPSAM
 * ------
 * Emeklilik tarafı BUGÜNÜN kurallarıyla ve BUGÜNÜN parasıyla ölçülür:
 * iskonto, ölüm riski ve ABO rejiminin değişme ihtimali modellenmez.
 * Bunlar yok sayıldığı için değil, tahmin edilmesi bu yazının
 * ilkelerine aykırı olduğu için dışarıda.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../../bordro/motor.js"),
      require("../../bordro/emeklilik-motor.js"));
  } else {
    kok.Tavan = fabrika(kok.BordroMotor, kok.EmeklilikMotor);
  }
})(typeof self !== "undefined" ? self : this, function (B, E) {
  "use strict";

  /* Bir yılın tavanı ve o yıl geçerli olsaydı önceki katsayının vereceği
     karşı olgu tavanı. */
  function tavanlar(yil) {
    var P = B.parametre(yil);
    var d = P.donemler[0];
    var onceki = B.parametre(yil - 1);
    return {
      yil: yil,
      asgariBrut: d.asgariBrut,
      katsayi: P.tavanKatsayisi,
      oncekiKatsayi: onceki.tavanKatsayisi,
      tavan: d.sgkTavan,
      karsiOlguTavan: d.asgariBrut * onceki.tavanKatsayisi,
      degisti: P.tavanKatsayisi !== onceki.tavanKatsayisi
    };
  }

  /* Prime esas kazancın genişleyen kısmı (aylık TL). */
  function genisleyenTaban(yil) {
    var t = tavanlar(yil);
    return t.tavan - t.karsiOlguTavan;
  }

  /* Bir yılı verilen tavanla hesaplar. Parametre nesnesi paylaşıldığı
     için tavan geçici olarak değiştirilip GERİ KONUYOR; sıra önemli. */
  function tavanla(aylikBrut, yil, tavan) {
    var d = B.parametre(yil).donemler[0];
    var eski = d.sgkTavan;
    d.sgkTavan = tavan;
    try { return B.hesaplaYil(aylikBrut, yil); } finally { d.sgkTavan = eski; }
  }

  /* Vergi kalkani: ek primin vergiden geri gelen payi.
     NaN KORUMASI: alan adi degisirse fark NaN olur ve "primFark > 0"
     sessizce false donerek kalkani 0 gosterirdi -- yani yanlis bir sayi,
     hata vermeden. Sonlu degilse burada duruyoruz. */
  function vergiKalkani(primFark, netKayip) {
    if (!isFinite(primFark) || !isFinite(netKayip)) {
      throw new Error("Prim farki hesaplanamadi: motorun alan adlari degismis olabilir.");
    }
    if (primFark <= 0) return 0;
    return (primFark - netKayip) / primFark;
  }

  /* NEGATIF SIFIR: fark tam olarak sifir oldugunda -netFark ifadesi -0
     uretir ve toLocaleString bunu "-0" diye yazar. Esik altindaki her
     satirda tabloya "-0 TL" basiliyordu. */
  function sifirla(n) { return n === 0 ? 0 : n; }

  /* Bir brüt için değişimin yıllık etkisi. */
  function etki(aylikBrut, yil) {
    var t = tavanlar(yil);
    var a = tavanla(aylikBrut, yil, t.karsiOlguTavan);
    var b = tavanla(aylikBrut, yil, t.tavan);
    var netFark = b.toplam.net - a.toplam.net;          /* negatif: kayıp */
    /* Isci payi: SGK + issizlik. Motorun toplam nesnesinde bu iki alan
       "sgk" ve "issizlik" adiyla duruyor -- isveren paylari ayri. */
    var primFark = (b.toplam.sgk + b.toplam.issizlik) -
                   (a.toplam.sgk + a.toplam.issizlik);
    return {
      aylikBrut: aylikBrut,
      netEski: a.toplam.net,
      netYeni: b.toplam.net,
      netKayip: sifirla(-netFark),
      ekPrim: primFark,
      /* Vergi kalkanı: ek primin ne kadarı vergiden geri geliyor.
         primFark 0 ise oran tanımsız; 0 döndürülüyor. */
      vergiKalkani: vergiKalkani(primFark, -netFark),
      isverenKayip: sifirla(b.toplam.isverenMaliyeti - a.toplam.isverenMaliyeti)
    };
  }

  /* Etkinin başladığı ve doyduğu brütler (aylık). */
  function esikler(yil) {
    var t = tavanlar(yil);
    return { baslar: t.karsiOlguTavan, doyar: t.tavan };
  }

  /* Emeklilik tarafı: kalan çalışma süresi boyunca yüksek tavandan prim
     ödemenin aylığa etkisi ve fazla primin kaç yılda geri döndüğü.

     MODEL: kişi hem eski hem yeni tavanın ÜSTÜNDE kazanıyor (etkilenen
     kitle bu). Geçmiş günler eski tavandan, kalan günler yeni tavandan
     sayılıyor; ortalama prime esas kazanç ikisinin gün ağırlıklı
     ortalaması. Güncelleme katsayısı iki tarafa da aynı uygulandığı için
     bugünün parasıyla çalışmak oranı bozmuyor. */
  function emeklilikGeriDonusu(gecmisGun, kalanGun, yil, secenek) {
    var o = secenek || {};
    var t = tavanlar(yil);
    var toplamGun = gecmisGun + kalanGun;
    if (!(toplamGun > 0)) throw new Error("Prim günü sıfır olamaz.");

    var g = {
      baslangic: o.baslangic || "2005-01-01",
      bitis: o.bitis || "2040-01-01",
      primGun: toplamGun
    };
    function aylik(ortalama) {
      var r = E.hesapla({
        baslangic: g.baslangic, bitis: g.bitis,
        primGun: g.primGun, ortalamaKazanc: ortalama
      });
      return r.odenenAylik;
    }

    var ortEski = t.karsiOlguTavan;
    var ortYeni = (gecmisGun * t.karsiOlguTavan + kalanGun * t.tavan) / toplamGun;
    var aylikArtis = aylik(ortYeni) - aylik(ortEski);

    /* Maliyet: tavanda çalışan birinin yıllık net kaybı x kalan yıl.
       Kayıp modülün kendi ölçümünden geliyor, elle yazılmıyor. */
    var yillikKayip = etki(t.tavan, yil).netKayip;
    var kalanYil = kalanGun / 360;
    var toplamMaliyet = yillikKayip * kalanYil;

    return {
      gecmisGun: gecmisGun, kalanGun: kalanGun,
      ortalamaPekEski: ortEski, ortalamaPekYeni: ortYeni,
      aylikArtis: aylikArtis,
      yillikArtis: aylikArtis * 12,
      yillikKayip: yillikKayip,
      toplamMaliyet: toplamMaliyet,
      /* Kaç yıl emekli aylığı aldıktan sonra fazla prim geri gelir. */
      basabasYil: aylikArtis > 0 ? toplamMaliyet / (aylikArtis * 12) : Infinity
    };
  }

  return {
    tavanlar: tavanlar,
    genisleyenTaban: genisleyenTaban,
    tavanla: tavanla,
    etki: etki,
    esikler: esikler,
    emeklilikGeriDonusu: emeklilikGeriDonusu
  };
});
