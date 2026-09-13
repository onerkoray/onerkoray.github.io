/*!
 * Enflasyon Motoru — nominal ↔ reel dönüşümleri
 *
 * NEDEN VAR: reel getiri hesabı sitede iki ayrı yerde birbirinden bağımsız
 * yazılmıştı (mevduat makalesi ve dağıtım motoru). Aynı matematiğin iki
 * kopyası sessizce ayrışır. Daha önemlisi: uzun ufuklu hiçbir araç çıktısını
 * reel olarak sunamıyordu, çünkü ortak bir dönüşüm katmanı yoktu.
 *
 * TEK KURAL, SIK YAPILAN HATA
 *   Reel getiri ÇIKARMA değil BÖLME ile bulunur:
 *       reel = (1 + nominal) / (1 + enflasyon) − 1
 *   Çıkarma (nominal − enflasyon) düşük enflasyonda kabul edilebilir bir
 *   yaklaşımdır; Türkiye'de değildir. %34,7 net getiri ve %30 enflasyonda
 *   doğru cevap %3,60, çıkarma ise %4,70 verir — 1,1 puanlık sistematik
 *   sapma, hep kullanıcı lehine yanılan yönde.
 *
 * BAZ YIL HER ZAMAN BELİRTİLİR: "reel" demek tek başına eksiktir; hangi
 * yılın fiyatlarıyla ifade edildiği söylenmelidir. Bu motorun deflate eden
 * fonksiyonları sonucu `baz` alanıyla birlikte döndürür ki arayüz bunu
 * yazmayı unutamasın.
 *
 * TÜFE SERİSİ BURADA YOK: endeks serisi harici veri ister ve güvenilir,
 * anahtarsız bir kaynak henüz doğrulanmadı. Motor oran tabanlı çalışıyor;
 * seri geldiğinde `donemEnflasyonu` ona bağlanacak.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.EnflasyonMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** Nominal getiriyi reel getiriye çevirir. Bölme ile. */
  function reel(nominal, enflasyon) {
    return (1 + nominal) / (1 + enflasyon) - 1;
  }

  /** Reel getiriden nominal getiriye. reel()'in tam tersi. */
  function nominal(reelOran, enflasyon) {
    return (1 + reelOran) * (1 + enflasyon) - 1;
  }

  /** Çıkarma yaklaşımının ne kadar saptığı — arayüzde göstermek için. */
  function cikarmaSapmasi(nominalOran, enflasyon) {
    return (nominalOran - enflasyon) - reel(nominalOran, enflasyon);
  }

  /**
   * Art arda dönemlerin bileşik enflasyonu.
   * Oranları toplamak yanlıştır: %2 ve %3 art arda %5 değil %5,06 eder.
   */
  function bilesik(oranlar) {
    var k = 1;
    for (var i = 0; i < oranlar.length; i++) k *= (1 + oranlar[i]);
    return k - 1;
  }

  /** Yıllık oranın n yıllık bileşik karşılığı. */
  function yillikBilesik(yillikOran, yil) {
    return Math.pow(1 + yillikOran, yil) - 1;
  }

  /** İki TÜFE endeksi arasındaki dönem enflasyonu. */
  function donemEnflasyonu(endeksBaslangic, endeksBitis) {
    if (!(endeksBaslangic > 0)) return NaN;
    return endeksBitis / endeksBaslangic - 1;
  }

  /**
   * Bir tutarı baz yıl fiyatlarına indirger (deflate).
   * Doner: { tutar, baz, faktor } — baz alanı arayüzün "hangi yılın
   * fiyatlarıyla" sorusunu yanıtlamasını zorunlu kılıyor.
   */
  function bugunkuDeger(tutar, yillikEnflasyon, yil, bazEtiketi) {
    var faktor = Math.pow(1 + yillikEnflasyon, yil);
    return {
      tutar: tutar / faktor,
      faktor: faktor,
      baz: bazEtiketi || "bugün"
    };
  }

  /** Bugünkü bir tutarın n yıl sonraki nominal karşılığı (inflate). */
  function gelecekDeger(tutar, yillikEnflasyon, yil) {
    return tutar * Math.pow(1 + yillikEnflasyon, yil);
  }

  /**
   * Alım gücünün kaybı: bugünkü 1 lira, n yıl sonra bugünün parasıyla ne eder?
   * %30 enflasyonda 5 yıl sonra 1 TL, bugünün 0,269 TL'si kadar alır.
   */
  function alimGucu(yillikEnflasyon, yil) {
    return 1 / Math.pow(1 + yillikEnflasyon, yil);
  }

  /**
   * Alım gücünün yarıya inmesi için kaç yıl geçmesi gerekir?
   * Kullanıcıya enflasyonun büyüklüğünü anlatan en sezgisel tek sayı.
   */
  function yarilanmaSuresi(yillikEnflasyon) {
    if (!(yillikEnflasyon > 0)) return Infinity;
    return Math.log(2) / Math.log(1 + yillikEnflasyon);
  }

  /** Bir seriyi baz yıla taşır. seri: [{donem, tutar}] */
  function seriyiReellestir(seri, yillikEnflasyon, bazEtiketi) {
    return seri.map(function (n, i) {
      var d = bugunkuDeger(n.tutar, yillikEnflasyon, i, bazEtiketi);
      return { donem: n.donem, nominal: n.tutar, reel: d.tutar, baz: d.baz };
    });
  }

  return {
    reel: reel,
    nominal: nominal,
    cikarmaSapmasi: cikarmaSapmasi,
    bilesik: bilesik,
    yillikBilesik: yillikBilesik,
    donemEnflasyonu: donemEnflasyonu,
    bugunkuDeger: bugunkuDeger,
    gelecekDeger: gelecekDeger,
    alimGucu: alimGucu,
    yarilanmaSuresi: yarilanmaSuresi,
    seriyiReellestir: seriyiReellestir
  };
});
