/*!
 * Fatura Çekirdeği — Türkiye fatura/proforma tutar hesabı
 *
 * Bağımlılıksız. Hem tarayıcıda (window.Fatura) hem Node'da (require) çalışır.
 * KDV (satır bazlı), satır ve genel iskonto, KDV tevkifatı, çok para birimi,
 * TCMB kuruyla TL karşılığı ve tutarın yazıyla karşılığı.
 *
 * Neden ayrı bir modül: fatura tutarı sessizce yanlış olabilen bir sayıdır.
 * Genel iskonto satırlara dağıtılırken kuruş kaybı olursa toplam ile KDV
 * matrahı birbirini tutmaz ve bu hata ekranda hata vermez; yalnızca fatura
 * yanlış olur. Bu yüzden hesap DOM'dan ayrı tutuluyor ve test.js ile
 * doğrulanıyor.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/fatura-olusturma/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Fatura = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- para birimleri ----------------
     kurusAd: yazıyla karşılıkta kullanılan küsurat adı. */
  var PARALAR = {
    TRY: { kod: "TRY", simge: "₺", ad: "Türk Lirası", kisa: "TL", kurusAd: "Kuruş" },
    USD: { kod: "USD", simge: "$", ad: "ABD Doları", kisa: "USD", kurusAd: "Sent" },
    EUR: { kod: "EUR", simge: "€", ad: "Euro", kisa: "EUR", kurusAd: "Sent" },
    GBP: { kod: "GBP", simge: "£", ad: "İngiliz Sterlini", kisa: "GBP", kurusAd: "Peni" }
  };

  /* KDV oranları — 2026 itibarıyla yürürlükteki genel ve indirimli oranlar.
     "Özel" oran girilebilsin diye liste kapalı değil; bunlar yalnızca hızlı
     seçim düğmeleridir. */
  var KDV_ORANLARI = [0, 1, 10, 20];

  /* KDV tevkifat oranları — 117 seri no.lu KDV Genel Tebliği'ndeki yaygın
     kısmi tevkifat oranları. Oran, hesaplanan KDV'ye uygulanır. */
  var TEVKIFAT_ORANLARI = [
    { ad: "Yok", pay: 0, payda: 10 },
    { ad: "2/10", pay: 2, payda: 10 },
    { ad: "3/10", pay: 3, payda: 10 },
    { ad: "4/10", pay: 4, payda: 10 },
    { ad: "5/10", pay: 5, payda: 10 },
    { ad: "7/10", pay: 7, payda: 10 },
    { ad: "9/10", pay: 9, payda: 10 }
  ];

  var BIRIMLER = ["Adet", "Saat", "Gün", "Ay", "Kg", "Litre", "Metre", "m²", "m³",
    "Paket", "Kutu", "Takım", "Hizmet"];

  /* ---------------- kuruş aritmetiği ----------------
     Tüm hesap tam sayı kuruş üzerinden yürür. 0.1 + 0.2 kayması bir bordroda
     görmezden gelinebilir, faturada gelinemez: toplam ile kalem toplamı
     birbirini tutmak zorunda. */

  function kurus(n) {
    var s = Number(n);
    if (!isFinite(s)) return 0;
    return Math.round(s * 100);
  }

  function lira(k) { return k / 100; }

  function sayi(deger) {
    if (typeof deger === "number") return isFinite(deger) ? deger : 0;
    var s = String(deger == null ? "" : deger).trim();
    if (!s) return 0;
    /* Nokta hem binlik ayracı hem ondalık ayracı olarak yazılıyor; hangisi
       olduğunu bağlamdan çıkarmak gerekiyor:
         - virgül varsa nokta kesinlikle binlik ayracıdır → "1.234,56"
         - virgül yoksa ve noktalar 3'erli grupları ayırıyorsa yine binliktir
           → "12.000" yazan kişi on iki bin demek istiyor, on iki değil
         - geri kalan her durumda nokta ondalık ayracıdır → "12.5", "1234.56" */
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /* En büyük artık yöntemiyle dağıtım: bir tutarı ağırlıklara göre bölerken
     kuruş kaybı olmaz, artan kuruşlar en büyük ondalık artığa sahip
     satırlara birer birer eklenir. */
  function dagit(toplamKurus, agirliklar) {
    var n = agirliklar.length;
    var pay = new Array(n);
    var i;
    var agirlikToplam = 0;
    for (i = 0; i < n; i++) agirlikToplam += agirliklar[i];
    if (agirlikToplam <= 0 || toplamKurus === 0) {
      for (i = 0; i < n; i++) pay[i] = 0;
      return pay;
    }
    var kalan = toplamKurus;
    var artiklar = [];
    for (i = 0; i < n; i++) {
      var tam = Math.floor(toplamKurus * agirliklar[i] / agirlikToplam);
      pay[i] = tam;
      kalan -= tam;
      artiklar.push({ i: i, artik: (toplamKurus * agirliklar[i] / agirlikToplam) - tam });
    }
    artiklar.sort(function (a, b) { return b.artik - a.artik; });
    for (i = 0; i < kalan; i++) pay[artiklar[i % n].i] += 1;
    return pay;
  }

  /* ---------------- hesap ----------------

     kalem: { aciklama, miktar, birim, birimFiyat, iskontoTur:"oran"|"tutar",
              iskonto, kdvOran }
     belge: { kalemler, genelIskontoTur, genelIskonto, tevkifat:{pay,payda},
              paraBirimi, kur }
  */
  function hesapla(belge) {
    belge = belge || {};
    var kalemler = belge.kalemler || [];
    var satirlar = [];
    var i;

    for (i = 0; i < kalemler.length; i++) {
      var k = kalemler[i];
      var miktar = sayi(k.miktar);
      var fiyat = sayi(k.birimFiyat);
      var brut = Math.round(miktar * kurus(fiyat));
      var iskOran = 0, isk = 0;

      if (k.iskontoTur === "tutar") {
        isk = kurus(k.iskonto);
      } else {
        iskOran = sayi(k.iskonto);
        isk = Math.round(brut * iskOran / 100);
      }
      if (isk < 0) isk = 0;
      if (isk > brut) isk = brut;

      satirlar.push({
        aciklama: k.aciklama || "",
        birim: k.birim || "Adet",
        miktar: miktar,
        birimFiyat: fiyat,
        kdvOran: sayi(k.kdvOran),
        brut: brut,
        iskonto: isk,
        araToplam: brut - isk
      });
    }

    /* Genel iskonto satırlara ara toplam ağırlığıyla dağıtılır. Dağıtmadan
       toplamdan düşmek, KDV oranı karışık faturalarda matrahı yanlış yapar:
       %20'lik ve %1'lik kalemi olan bir faturada indirimin hangi orandan
       düşüldüğü KDV tutarını değiştirir. */
    var araToplam = 0;
    for (i = 0; i < satirlar.length; i++) araToplam += satirlar[i].araToplam;

    var genelIsk = 0;
    if (belge.genelIskontoTur === "tutar") genelIsk = kurus(belge.genelIskonto);
    else genelIsk = Math.round(araToplam * sayi(belge.genelIskonto) / 100);
    if (genelIsk < 0) genelIsk = 0;
    if (genelIsk > araToplam) genelIsk = araToplam;

    var agirlik = satirlar.map(function (s) { return s.araToplam; });
    var paylar = dagit(genelIsk, agirlik);

    var matrahToplam = 0, kdvToplam = 0;
    var oranlar = {};

    for (i = 0; i < satirlar.length; i++) {
      var s = satirlar[i];
      s.genelIskontoPayi = paylar[i];
      s.matrah = s.araToplam - paylar[i];
      s.kdv = Math.round(s.matrah * s.kdvOran / 100);
      s.toplam = s.matrah + s.kdv;
      matrahToplam += s.matrah;
      kdvToplam += s.kdv;

      var anahtar = String(s.kdvOran);
      if (!oranlar[anahtar]) oranlar[anahtar] = { oran: s.kdvOran, matrah: 0, kdv: 0 };
      oranlar[anahtar].matrah += s.matrah;
      oranlar[anahtar].kdv += s.kdv;
    }

    var kdvDokumu = Object.keys(oranlar)
      .map(function (a) { return oranlar[a]; })
      .sort(function (a, b) { return a.oran - b.oran; });

    /* Tevkifat hesaplanan KDV'ye uygulanır; tevkif edilen kısmı alıcı
       doğrudan vergi dairesine öder, satıcı tahsil etmez. */
    var tv = belge.tevkifat || { pay: 0, payda: 10 };
    var tevkifatPay = sayi(tv.pay), tevkifatPayda = sayi(tv.payda) || 10;
    var tevkifatKdv = tevkifatPay > 0
      ? Math.round(kdvToplam * tevkifatPay / tevkifatPayda) : 0;
    var tahsilKdv = kdvToplam - tevkifatKdv;

    var genelToplam = matrahToplam + kdvToplam;
    var odenecek = matrahToplam + tahsilKdv;

    var para = PARALAR[belge.paraBirimi] || PARALAR.TRY;
    var kur = sayi(belge.kur) || 1;

    return {
      paraBirimi: para,
      kur: kur,
      satirlar: satirlar.map(function (s) {
        return {
          aciklama: s.aciklama, birim: s.birim, miktar: s.miktar,
          birimFiyat: s.birimFiyat, kdvOran: s.kdvOran,
          brut: lira(s.brut), iskonto: lira(s.iskonto),
          genelIskontoPayi: lira(s.genelIskontoPayi),
          matrah: lira(s.matrah), kdv: lira(s.kdv), toplam: lira(s.toplam)
        };
      }),
      kdvDokumu: kdvDokumu.map(function (d) {
        return { oran: d.oran, matrah: lira(d.matrah), kdv: lira(d.kdv) };
      }),
      araToplam: lira(araToplam),
      satirIskontosu: lira(satirlar.reduce(function (t, s) { return t + s.iskonto; }, 0)),
      genelIskonto: lira(genelIsk),
      matrah: lira(matrahToplam),
      kdv: lira(kdvToplam),
      tevkifat: lira(tevkifatKdv),
      tevkifatOrani: tevkifatPay > 0 ? tevkifatPay + "/" + tevkifatPayda : "",
      tahsilEdilecekKdv: lira(tahsilKdv),
      genelToplam: lira(genelToplam),
      odenecek: lira(odenecek),
      /* Dövizli faturada VUK gereği TL karşılığının da gösterilmesi gerekir. */
      odenecekTl: para.kod === "TRY" ? lira(odenecek) : lira(Math.round(odenecek * kur))
    };
  }

  /* ---------------- yazıyla ----------------
     Faturada tutarın yazıyla yazılması Türkiye'de yerleşik bir zorunluluktur
     ve rakamla oynanmasına karşı bir denetim satırıdır. */

  var BIRLER = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
  var ONLAR = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
  var BASAMAKLAR = ["", "bin", "milyon", "milyar", "trilyon", "katrilyon"];

  function ucBasamak(n) {
    var p = [];
    var yuz = Math.floor(n / 100);
    var on = Math.floor((n % 100) / 10);
    var bir = n % 10;
    /* "bir yüz" denmez, "yüz" denir. */
    if (yuz === 1) p.push("yüz");
    else if (yuz > 1) p.push(BIRLER[yuz], "yüz");
    if (on) p.push(ONLAR[on]);
    if (bir) p.push(BIRLER[bir]);
    return p.join(" ");
  }

  function tamsayiYazi(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return "sıfır";
    var gruplar = [];
    while (n > 0) { gruplar.push(n % 1000); n = Math.floor(n / 1000); }

    var parcalar = [];
    for (var i = gruplar.length - 1; i >= 0; i--) {
      var g = gruplar[i];
      if (g === 0) continue;
      /* "bir bin" denmez, "bin" denir; ama "bir milyon" denir. */
      if (i === 1 && g === 1) parcalar.push("bin");
      else parcalar.push(ucBasamak(g) + (BASAMAKLAR[i] ? " " + BASAMAKLAR[i] : ""));
    }
    return parcalar.join(" ").replace(/\s+/g, " ").trim();
  }

  function basHarfBuyut(s) {
    return s.replace(/(^|\s)(\S)/g, function (t, bosluk, harf) {
      return bosluk + harf.toLocaleUpperCase("tr-TR");
    });
  }

  /**
   * 30500.25, "TRY" -> "Otuz Bin Beş Yüz Türk Lirası Yirmi Beş Kuruş"
   */
  function yaziyla(tutar, paraKodu) {
    var para = PARALAR[paraKodu] || PARALAR.TRY;
    var toplamKurus = kurus(tutar);
    var negatif = toplamKurus < 0;
    toplamKurus = Math.abs(toplamKurus);

    var tam = Math.floor(toplamKurus / 100);
    var kus = toplamKurus % 100;

    var metin = basHarfBuyut(tamsayiYazi(tam)) + " " + para.ad;
    if (kus > 0) metin += " " + basHarfBuyut(tamsayiYazi(kus)) + " " + para.kurusAd;
    return (negatif ? "Eksi " : "") + metin;
  }

  /* ---------------- biçimlendirme ---------------- */

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf4 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

  function para(n, paraKodu) {
    var p = PARALAR[paraKodu] || PARALAR.TRY;
    return nf2.format(isFinite(n) ? n : 0) + " " + p.simge;
  }
  function miktarBicim(n) { return nf4.format(isFinite(n) ? n : 0); }

  /* ---------------- kimlik doğrulama ----------------
     VKN ve TCKN'nin kendi içinde tutarlı olup olmadığı algoritmayla
     doğrulanabiliyor. Yanlış yazılmış bir vergi numarası faturanın en sık
     ve en sessiz hatasıdır: fatura basılır, gider yazılamaz. */

  function tcknGecerli(s) {
    s = String(s || "").replace(/\D/g, "");
    if (s.length !== 11 || s[0] === "0") return false;
    var d = s.split("").map(Number);
    var tek = d[0] + d[2] + d[4] + d[6] + d[8];
    var cift = d[1] + d[3] + d[5] + d[7];
    /* JS'te % negatif sonuç verebilir; tek*7 < cift olan numaralarda
       doğrudan karşılaştırma yanlış eleme yapardı. */
    if (((((tek * 7 - cift) % 10) + 10) % 10) !== d[9]) return false;
    var ilkOn = 0;
    for (var i = 0; i < 10; i++) ilkOn += d[i];
    return ilkOn % 10 === d[10];
  }

  function vknGecerli(s) {
    s = String(s || "").replace(/\D/g, "");
    if (s.length !== 10) return false;
    var toplam = 0;
    for (var i = 0; i < 9; i++) {
      var rakam = Number(s[i]);
      var gecici = (rakam + (9 - i)) % 10;
      if (gecici === 0) { toplam += 0; continue; }
      var carpim = (gecici * Math.pow(2, 9 - i)) % 9;
      toplam += (carpim === 0 && gecici !== 0) ? 9 : carpim;
    }
    return (10 - (toplam % 10)) % 10 === Number(s[9]);
  }

  /** Uzunluğuna göre TCKN mi VKN mi olduğunu anlar; boşsa "yok" der. */
  function vergiNoDurumu(s) {
    var t = String(s || "").replace(/\D/g, "");
    if (!t) return { durum: "yok", mesaj: "" };
    if (t.length === 11) {
      return tcknGecerli(t)
        ? { durum: "gecerli", mesaj: "T.C. kimlik numarası doğrulandı." }
        : { durum: "hatali", mesaj: "11 haneli ama T.C. kimlik numarası algoritmasını geçmiyor." };
    }
    if (t.length === 10) {
      return vknGecerli(t)
        ? { durum: "gecerli", mesaj: "Vergi kimlik numarası doğrulandı." }
        : { durum: "hatali", mesaj: "10 haneli ama vergi numarası algoritmasını geçmiyor." };
    }
    return { durum: "hatali", mesaj: "VKN 10, TCKN 11 haneli olmalı (girilen: " + t.length + ")." };
  }

  return {
    surum: "1.0.0",
    PARALAR: PARALAR,
    KDV_ORANLARI: KDV_ORANLARI,
    TEVKIFAT_ORANLARI: TEVKIFAT_ORANLARI,
    BIRIMLER: BIRIMLER,
    sayi: sayi,
    dagit: dagit,
    hesapla: hesapla,
    yaziyla: yaziyla,
    para: para,
    miktarBicim: miktarBicim,
    tcknGecerli: tcknGecerli,
    vknGecerli: vknGecerli,
    vergiNoDurumu: vergiNoDurumu
  };
});
