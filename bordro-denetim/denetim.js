/*!
 * Bordro denetimi: bordrodaki satırlarla motorun beklediği değerleri karşılaştırır.
 *
 * NEDEN VAR
 * ---------
 * Sitede elliden fazla HESAPLAYAN araç var, DENETLEYEN yok. Oysa
 * kullanıcının gerçek sorusu çoğu zaman "ne kadar olmalı" değil,
 * "elimdeki bordro doğru mu".
 *
 * BU MODÜL YENİ YASAL PARAMETRE TANIMLAMAZ
 * ----------------------------------------
 * Tek bir oran, tavan ya da sınır burada yazılı değildir. Beklenen
 * değerlerin tamamı bordro/motor.js'in hesaplaAy() fonksiyonundan
 * gelir; bu modül yalnızca karşılaştırır ve farkı yorumlar.
 *
 * KÜMÜLATİF MATRAH MESELESİ
 * -------------------------
 * Bir bordronun "yanlış" görünmesinin en yaygın sebebi hata değil,
 * kümülatif matrahtır: gelir vergisi aylık kazanca değil yıl başından
 * beri biriken matraha göre hesaplanır. Kullanıcı bunu bilmiyorsa
 * ağustostaki kesintiyi ocaktakiyle kıyaslar ve bordroyu hatalı sanır.
 *
 * Bu yüzden modül fark bulduğunda "yanlış" demez. Bunun yerine TERSİNE
 * ÇÖZER: kullanıcının yazdığı gelir vergisini hangi kümülatif matrah
 * üretirdi? Sonuç, kullanıcının bordrosundaki kümülatif matrah satırıyla
 * karşılaştırabileceği somut bir sayıdır. "Bordron yanlış" bir iddiadır;
 * "bordron şu matrahı ima ediyor" bir ölçümdür.
 *
 * NE YAPMAZ
 * ---------
 * Eksik gün, ek ödeme, yan hak, icra kesintisi, özel sigorta, avans ve
 * asgari geçim indirimi geçmişi gibi bordroyu değiştiren kalemleri
 * bilmez. Bunlar fark üretir ve modül bunu "hata" diye sunmaz;
 * varsayımları açıkça listeler.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../bordro/motor.js"));
  } else {
    kok.BordroDenetim = fabrika(kok.Bordro);
  }
})(typeof self !== "undefined" ? self : this, function (B) {
  "use strict";

  /* Kuruş toleransı. Bordro programları satır bazında yuvarlar; bir
     kuruşluk sapma hata değildir. */
  var TOLERANS = 0.01;

  /* Karşılaştırılan satırlar. Sıra, bordroda göründükleri sıradır. */
  var SATIRLAR = [
    { anahtar: "sgk", ad: "SGK işçi payı" },
    { anahtar: "issizlik", ad: "İşsizlik sigortası işçi payı" },
    { anahtar: "gelirVergisi", ad: "Gelir vergisi" },
    { anahtar: "damga", ad: "Damga vergisi" },
    { anahtar: "net", ad: "Net ödenen" }
  ];

  function say(v) {
    return typeof v === "number" && isFinite(v);
  }

  /* Bir aya kadar biriken asgari ücret matrahı.
     ÇARPMA İLE YAPILMIYOR: bir yılda birden çok asgari ücret dönemi
     olabilir (2022'de iki dönem vardı) ve çarpmak o yılları sessizce
     yanlış hesaplardı. Ay ay toplanıyor. */
  function asgariBirikim(P, ayaKadar) {
    var o = P.oranlar, t = 0;
    for (var i = 1; i < ayaKadar; i++) {
      var d = B.donem(P, i);
      t += d.asgariBrut * (1 - o.sgkIsci - o.issizlikIsci);
    }
    return t;
  }

  /* Verilen kümülatif matrahla o ayın bordrosunu hesaplar.
     birikim nesnesi hesaplaAy tarafından DEĞİŞTİRİLİR, o yüzden her
     çağrıda yenisi kuruluyor. */
  function ayHesapla(yil, ay, brut, kumulOnce, secenekler) {
    var P = B.parametre(yil);
    return B.hesaplaAy(brut, ay, P, {
      matrah: kumulOnce,
      asgariMatrah: asgariBirikim(P, ay)
    }, secenekler || {});
  }

  /* Bir ayın tek başına ürettiği matrah (kümülatiften bağımsız). */
  function ayMatrahi(yil, ay, brut, secenekler) {
    return ayHesapla(yil, ay, brut, 0, secenekler).matrah;
  }

  /* --- TERSİNE ÇÖZÜM ------------------------------------------------
     Kullanıcının yazdığı gelir vergisini hangi kümülatif matrah üretir?

     Vergi, kümülatif matraha göre ARTAN bir fonksiyondur (tarife
     artan oranlı), dolayısıyla ikili arama uygulanabilir. Artan
     olmadığı bir yerde arama yanlış cevap verirdi; bu yüzden aşağıda
     sonuç DOĞRULANIYOR ve doğrulanamazsa null dönülüyor -- yanlış bir
     sayı göstermektense hiç göstermemek doğru.

     Üst sınır: tarifenin son dilim sınırının iki katı. Ötesinde oran
     sabitlenir ve çözüm tek olmaktan çıkar. */
  function kumulatifCoz(yil, ay, brut, hedefVergi, secenekler) {
    if (!say(hedefVergi) || hedefVergi < 0) return null;
    var P = B.parametre(yil);
    var dilimler = P.dilimler;
    var ust = dilimler[dilimler.length - 2][0] * 2;

    function vergi(k) {
      return ayHesapla(yil, ay, brut, k, secenekler).gelirVergisi;
    }

    if (vergi(0) > hedefVergi + TOLERANS) return null;   // en küçük değer bile fazla
    if (vergi(ust) < hedefVergi - TOLERANS) return null; // en büyük değer bile az

    var alt = 0;
    for (var i = 0; i < 80; i++) {
      var orta = (alt + ust) / 2;
      if (vergi(orta) < hedefVergi) alt = orta; else ust = orta;
    }
    var k = (alt + ust) / 2;
    /* DOĞRULAMA: bulunan matrah gerçekten hedefi üretiyor mu? */
    return Math.abs(vergi(k) - hedefVergi) <= 0.5 ? k : null;
  }

  /* --- FARK YORUMLARI -----------------------------------------------
     Her yorum bir ÖLÇÜME dayanır, genel tavsiye değildir. Ölçülemeyen
     bir sebep listelenmez. */
  function sebepler(anahtar, beklenen, sizin, girdi, hesap) {
    var out = [];
    var P = B.parametre(girdi.yil);
    var d = B.donem(P, girdi.ay);
    var fark = sizin - beklenen;

    if (anahtar === "sgk" || anahtar === "issizlik") {
      if (girdi.brut > d.sgkTavan + TOLERANS) {
        out.push({
          tur: "aciklama",
          metin: "Brütünüz SGK prim tavanının üstünde. Prim brütten değil " +
            "tavandan kesilir, bu yüzden bu satır brütünüzle orantılı değildir.",
          veri: { "SGK tavanı": d.sgkTavan, "prime esas kazanç": hesap.primEsas }
        });
      }
      if (girdi.brut < d.asgariBrut - TOLERANS) {
        out.push({
          tur: "aciklama",
          metin: "Brütünüz asgari ücretin altında. Prim yine de asgari ücret " +
            "üzerinden hesaplanır; taban budur.",
          veri: { "prime esas kazanç": hesap.primEsas }
        });
      }
      if (fark < -TOLERANS && hesap.primEsas > 0) {
        var gun = fark / (hesap.primEsas / 30) * -1;
        if (gun > 0.5 && gun < 30) {
          out.push({
            tur: "olcum",
            metin: "Eksiklik, yaklaşık " + gun.toFixed(1) + " günlük prime " +
              "karşılık geliyor. Bordroda eksik gün (rapor, ücretsiz izin, " +
              "işe giriş/çıkış) varsa beklenen davranış budur.",
            veri: { "günlük prime esas kazanç": hesap.primEsas / 30 }
          });
        }
      }
    }

    if (anahtar === "gelirVergisi") {
      var k = kumulatifCoz(girdi.yil, girdi.ay, girdi.brut, sizin, girdi.secenekler);
      if (k !== null) {
        out.push({
          tur: "olcum",
          metin: "Bordronuzdaki gelir vergisi, bu aydan ÖNCE biriken " +
            "matrahın yaklaşık şu tutar olmasını gerektirir. Bordronuzda " +
            "kümülatif matrah satırı varsa onunla karşılaştırın.",
          veri: { "ima edilen önceki kümülatif matrah": k,
                  "varsaydığımız": girdi.kumulOnce }
        });
      }
      if (hesap.istisna > 0 && Math.abs(fark - hesap.istisna) <= 0.5) {
        out.push({
          tur: "olcum",
          metin: "Fark, asgari ücret istisnasının tam tutarı kadar. " +
            "İkinci işverenden alınan ücrette istisna uygulanmaz; " +
            "bordronuz ikinci işverene aitse hesabı o seçenekle tekrarlayın.",
          veri: { "asgari ücret istisnası": hesap.istisna }
        });
      }
    }

    if (anahtar === "damga") {
      var istisnasiz = girdi.brut * P.oranlar.damga;
      if (Math.abs(sizin - istisnasiz) <= 0.5 && Math.abs(beklenen - istisnasiz) > 0.5) {
        out.push({
          tur: "olcum",
          metin: "Yazdığınız tutar, damga vergisinin asgari ücret istisnası " +
            "UYGULANMADAN hesaplanmış hâline eşit.",
          veri: { "istisnasız damga": istisnasiz, "istisnalı damga": beklenen }
        });
      }
    }

    return out;
  }

  /* --- ANA İŞLEV ---------------------------------------------------- */
  function denetle(girdi) {
    if (!girdi || !say(girdi.brut) || girdi.brut <= 0) {
      throw new Error("Brüt ücret girilmeli.");
    }
    var yil = girdi.yil || B.sonYil();
    var ay = girdi.ay || 1;
    if (ay < 1 || ay > 12) throw new Error("Ay 1 ile 12 arasında olmalı.");

    var secenekler = girdi.secenekler || {};
    var varsayimlar = [];

    /* Kümülatif matrah: kullanıcı verdiyse onu kullan, vermediyse
       "yıl boyunca aynı brüt" varsayımından türet ve bunu SÖYLE. */
    var kumulOnce;
    if (say(girdi.kumulatifMatrah) && girdi.kumulatifMatrah >= 0) {
      kumulOnce = girdi.kumulatifMatrah;
    } else {
      kumulOnce = (ay - 1) * ayMatrahi(yil, ay, girdi.brut, secenekler);
      if (ay > 1) {
        varsayimlar.push("Kümülatif matrah girilmedi; yıl boyunca aynı brütle " +
          "çalıştığınız varsayıldı. Zam, prim ya da ek ödeme aldıysanız bu " +
          "varsayım gerçeği yansıtmaz ve gelir vergisi satırında fark çıkar.");
      }
    }
    varsayimlar.push("Eksik gün yok, ek ödeme ve yan hak yok, tek işveren " +
      "kabul edildi.");
    if (secenekler.istisnasiz) {
      varsayimlar.push("İkinci işveren bordrosu seçildi: asgari ücret " +
        "istisnası ve damga istisnası uygulanmadı.");
    }

    var hesap = ayHesapla(yil, ay, girdi.brut, kumulOnce, secenekler);
    var bordro = girdi.bordro || {};

    var satirlar = SATIRLAR.map(function (s) {
      var beklenen = hesap[s.anahtar];
      var sizin = say(bordro[s.anahtar]) ? bordro[s.anahtar] : null;
      var fark = sizin === null ? null : sizin - beklenen;
      var tamam = fark === null ? null : Math.abs(fark) <= TOLERANS;
      return {
        anahtar: s.anahtar,
        ad: s.ad,
        beklenen: beklenen,
        sizin: sizin,
        fark: fark,
        tamam: tamam,
        sebepler: (tamam === false)
          ? sebepler(s.anahtar, beklenen, sizin,
              { yil: yil, ay: ay, brut: girdi.brut,
                kumulOnce: kumulOnce, secenekler: secenekler }, hesap)
          : []
      };
    });

    var girilen = satirlar.filter(function (s) { return s.sizin !== null; });
    var farkli = girilen.filter(function (s) { return s.tamam === false; });

    return {
      yil: yil,
      ay: ay,
      ayAdi: hesap.ayAdi,
      brut: girdi.brut,
      kumulatifMatrah: kumulOnce,
      kumulatifMatrahVerildi: say(girdi.kumulatifMatrah),
      hesap: hesap,
      satirlar: satirlar,
      varsayimlar: varsayimlar,
      ozet: {
        girilenSatir: girilen.length,
        farkliSatir: farkli.length,
        netFark: (function () {
          var n = satirlar.filter(function (s) { return s.anahtar === "net"; })[0];
          return n && n.fark !== null ? n.fark : null;
        })()
      }
    };
  }

  return {
    TOLERANS: TOLERANS,
    SATIRLAR: SATIRLAR,
    denetle: denetle,
    kumulatifCoz: kumulatifCoz,
    asgariBirikim: asgariBirikim,
    ayHesapla: ayHesapla,
    ayMatrahi: ayMatrahi
  };
});
