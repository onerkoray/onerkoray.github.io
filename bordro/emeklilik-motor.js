/*!
 * Yaşlılık aylığı (emekli aylığı) motoru — kısmî aylık birleştirme
 *
 * YÖNTEM (5510 s.K. Geçici m.2): hizmet üç rejime bölünür, her rejim için
 * AYRI bir kısmî aylık hesaplanır ve bunlar gün payına göre toplanır.
 *
 *   Her dönem i için:
 *     ABO_i        = o dönemin kuralıyla, TOPLAM prim günü üzerinden
 *     kısmî aylık_i = ortalama kazanç × ABO_i × (dönem_i günü / toplam gün)
 *   Aylık = Σ kısmî aylık_i         → sonra alt sınır aylık uygulanır
 *
 * ABO'nun toplam gün üzerinden hesaplanıp sonra gün payıyla çarpılması
 * kanunun kendi kurgusu; dönemin kendi günüyle hesaplamak farklı (ve yanlış)
 * sonuç verir çünkü kademeler toplam hizmete göre iniyor.
 *
 * KAPSAM SINIRI: 2000 öncesi hizmet GÖSTERGE sistemiyle hesaplanır. Gösterge
 * ve üst gösterge tabloları, katsayılar ve taban aylık geçmişi SGK'nın kendi
 * tablolarında; burada tahmin edilmeye çalışılmıyor. O dönemde hizmeti olan
 * kullanıcıya hesap yapılmıyor, neden yapılmadığı söyleniyor. Uydurma bir
 * sayı vermektense hesap yapmamak doğrusu.
 *
 * Bağımsızdır: hem tarayıcıda (window.EmeklilikMotor) hem Node'da çalışır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/emekli-ayligi-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var P = (typeof module === "object" && module.exports)
    ? require("./emeklilik-parametreleri.js")
    : root.EMEKLILIK_PARAMETRELERI;
  var v = factory(P);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.EmeklilikMotor = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (P) {
  "use strict";

  var GUN_MS = 86400000;

  function gunFarki(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / GUN_MS);
  }

  /* Hizmet günlerini dönemlere dağıtır.
     Kullanıcı yalnızca toplam prim gününü biliyor; günlerin hangi yıllara
     düştüğünü bilmiyor. Bu yüzden TAKVİM aralığına göre orantılı dağıtım
     yapılıyor: sigortalılık başlangıcı ile emeklilik tarihi arasındaki
     takvim süresinin dönemlere düşen payı kadar prim günü o döneme yazılır.
     Bu bir VARSAYIM ve arayüzde açıkça söyleniyor; kesin dağılım yalnızca
     SGK hizmet dökümünde var. */
  function donemlereDagit(baslangic, bitis, toplamGun) {
    var sinir1 = "2000-01-01";
    var sinir2 = "2008-10-01";
    var toplamTakvim = gunFarki(baslangic, bitis);
    if (!(toplamTakvim > 0)) return null;

    function kesisim(a1, a2, b1, b2) {
      var s = (a1 > b1) ? a1 : b1;
      var e = (a2 < b2) ? a2 : b2;
      var d = gunFarki(s, e);
      return d > 0 ? d : 0;
    }

    var takvim = {
      gosterge: kesisim(baslangic, bitis, "1900-01-01", sinir1),
      gecici82: kesisim(baslangic, bitis, sinir1, sinir2),
      m29: kesisim(baslangic, bitis, sinir2, "2200-01-01")
    };

    var pay = {};
    ["gosterge", "gecici82", "m29"].forEach(function (k) {
      pay[k] = toplamGun * (takvim[k] / toplamTakvim);
    });
    return { takvim: takvim, gun: pay, toplamTakvim: toplamTakvim };
  }

  /**
   * @param {Object} g
   *   baslangic     ISO tarih — sigortalılık başlangıcı
   *   bitis         ISO tarih — aylık bağlanma (talep) tarihi
   *   primGun       toplam prim ödeme gün sayısı
   *   ortalamaKazanc  güncellenmiş ortalama aylık prime esas kazanç (TL)
   */
  function hesapla(g) {
    var uyarilar = [];
    var primGun = Number(g.primGun);
    var kazanc = Number(g.ortalamaKazanc);

    if (!(primGun > 0)) return { hata: "Prim gün sayısı sıfırdan büyük olmalı." };
    if (!(kazanc > 0)) return { hata: "Ortalama kazanç sıfırdan büyük olmalı." };

    var dagitim = donemlereDagit(g.baslangic, g.bitis, primGun);
    if (!dagitim) return { hata: "Emeklilik tarihi, sigortalılık başlangıcından sonra olmalı." };

    var gun = dagitim.gun;
    var gostergeVar = gun.gosterge > 0.5;

    /* Gösterge dönemi hesaplanamıyor. O döneme düşen gün payı varsa
       sonucun TAMAMI eksik kalır; yarım bir rakam vermek yanıltıcı olur. */
    if (gostergeVar) {
      return {
        hata: "gosterge",
        gostergeGun: Math.round(gun.gosterge),
        mesaj: "Sigortalılığınız 2000'den önce başlıyor. O döneme düşen hizmet, " +
          "gösterge sistemiyle hesaplanır; gösterge ve üst gösterge tabloları " +
          "SGK'nın kendi kayıtlarındadır ve burada tahmin edilmez."
      };
    }

    var satirlar = [];
    var toplamAylik = 0;
    var kurallar = { gecici82: P.abo.gecici82, m29: P.abo.m29 };

    ["gecici82", "m29"].forEach(function (kod) {
      var d = gun[kod];
      if (!(d > 0.5)) return;
      var abo = P.aboHesapla(kurallar[kod], primGun);
      var payOrani = d / primGun;
      var kismi = kazanc * abo * payOrani;
      toplamAylik += kismi;
      satirlar.push({
        kod: kod,
        ad: P.donemler.filter(function (x) { return x.kod === kod; })[0].ad,
        dayanak: P.donemler.filter(function (x) { return x.kod === kod; })[0].dayanak,
        gun: d,
        payOrani: payOrani,
        abo: abo,
        kismiAylik: kismi
      });
    });

    if (!satirlar.length) return { hata: "Hesaplanabilir hizmet dönemi bulunamadı." };

    var alt = P.altSinirAylik(g.bitis);
    var altUygulandi = toplamAylik < alt.tutar;
    var odenen = altUygulandi ? alt.tutar : toplamAylik;

    if (altUygulandi) {
      uyarilar.push("Hesaplanan kök aylık, yürürlükteki alt sınır aylığın altında kaldı; " +
        "ödenen tutar alt sınıra yükseltildi.");
    }

    /* Karma ABO: iki dönemin gün payına göre ağırlıklı ortalaması.
       Tek bir "ABO" rakamı istendiğinde gösterilecek dürüst değer budur. */
    var karmaAbo = satirlar.reduce(function (t, s) { return t + s.abo * s.payOrani; }, 0);

    return {
      primGun: primGun,
      ortalamaKazanc: kazanc,
      satirlar: satirlar,
      karmaAbo: karmaAbo,
      kokAylik: toplamAylik,
      altSinir: alt,
      altUygulandi: altUygulandi,
      odenenAylik: odenen,
      uyarilar: uyarilar,
      takvim: dagitim.takvim
    };
  }

  return { hesapla: hesapla, parametreler: P, donemlereDagit: donemlereDagit };
});
