/*!
 * Çıkış Aktarımı — İşten Ayrılma Paketi'nin girdilerini dayanma süresi aracına taşır
 *
 * NEDEN VAR: iki araç aynı bordro/cikis.js motorunu kullanıyor. Paketi gören
 * kullanıcı "bu parayla kaç ay dayanırım" sorusunu sorunca aynı formu yeniden
 * doldurmak zorunda kalıyordu.
 *
 * ÜÇ KURAL
 *
 * 1. TUTAR DEĞİL GİRDİ TAŞINIR. Hedef araç paketi aynı motorla yeniden
 *    hesaplar; iki sayfanın farklı rakam göstermesi mümkün olmaz. Formunda
 *    alanı olmayan girdiler de (ek ödemeler, ihbar, son 4 ay ortalaması)
 *    bu yüzden pakete dahildir.
 *
 * 2. TEK SEFERLİK VE SEKME İÇİNDE. Yalnız kullanıcının tıklamasıyla
 *    sessionStorage'a yazılır, ilk okumada silinir. Adrese ve ölçüme yazılmaz.
 *
 * 3. BOZUK ya da ESKİ ŞEMALI KAYIT YOK SAYILIR. Şüpheli veriyle form
 *    doldurmaktansa kullanıcı formu örnek değerlerle görür.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/isten-ayrilma-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.CikisAktarim = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ANAHTAR = "cikis-aktarim", SURUM = 1;
  var TARIH = ["iseGiris", "cikis"];
  var SAYI = ["ciplakBrut", "giydirmeEkleri", "kullanilmayanIzinGunu", "son4AyBrutOrtalama", "son3YilPrimGunu"];

  function tarihMi(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function sayiMi(x) { return typeof x === "number" && isFinite(x) && x >= 0; }

  function gecerli(g) {
    return !!g && typeof g.fesihTuru === "string" && typeof g.ihbarSuresiCalisildi === "boolean" &&
      TARIH.every(function (k) { return tarihMi(g[k]); }) &&
      SAYI.every(function (k) { return sayiMi(g[k]); }) &&
      (g.sigortaBaslangici === null || tarihMi(g.sigortaBaslangici));
  }

  /** Girdiyi tek seferlik yazar. Depo kapalıysa ya da girdi bozuksa false döner. */
  function yaz(depo, girdi) {
    if (!gecerli(girdi)) return false;
    try { depo.setItem(ANAHTAR, JSON.stringify({ surum: SURUM, girdi: girdi })); return true; }
    catch (e) { return false; }
  }

  /** Girdiyi okur ve siler; yoksa ya da geçersizse null döner. */
  function al(depo) {
    try {
      var ham = depo.getItem(ANAHTAR);
      depo.removeItem(ANAHTAR);
      var k = ham ? JSON.parse(ham) : null;
      return k && k.surum === SURUM && gecerli(k.girdi) ? k.girdi : null;
    } catch (e) { return null; }
  }

  return { ANAHTAR: ANAHTAR, SURUM: SURUM, yaz: yaz, al: al };
});
