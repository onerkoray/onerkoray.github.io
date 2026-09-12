/*!
 * Kira geliri (GMSİ) beyan motoru
 *
 * NE YAPAR: konut ve işyeri kira gelirinden yıllık beyanname üzerinden
 * doğacak gelir vergisini hesaplar; götürü ve gerçek gider yöntemlerini
 * AYNI ANDA çalıştırıp hangisinin avantajlı olduğunu söyler.
 *
 * NEDEN İKİ YÖNTEM BİRDEN: mükellef yılda bir kez seçim yapıyor ve seçim
 * iki yıl bağlıyor (götürüden gerçeğe dönmek serbest, tersi değil). Tek
 * yöntemi hesaplayıp "işte vergin" demek, asıl kararı kullanıcıya
 * gösterilmeden aldırmak olurdu.
 *
 * DAYANAK (GVK):
 *   m.21  mesken istisnası ve istisnadan yararlanamama hâlleri
 *   m.74  indirilecek giderler / götürü gider
 *   m.86  beyan sınırları
 *   m.94  işyeri kira ödemelerinde tevkifat
 *   m.103 tarife (ücret dışı) — bordro/parametreler.js
 *
 * Parametreler bordro/parametreler.js içindedir; burada kopyası yoktur.
 * Vergi tarifesi bordro/motor.js'in test edilmiş tarifeVergisi()
 * fonksiyonundan gelir — ikinci bir tarife uygulaması yazılmadı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/kira-geliri-vergisi-hesaplama/
 */
(function (root, factory) {
  "use strict";
  var B = (typeof module === "object" && module.exports)
    ? require("./motor.js")
    : root.Bordro;
  var v = factory(B);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GmsiMotor = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  function yuvarla(n) { return Math.round(n * 100) / 100; }

  /**
   * @param {Object} g
   *   yil              beyan yılı (parametre yılı)
   *   konutKira        yıllık konut kira geliri (TL)
   *   isyeriKira       yıllık işyeri kira geliri, BRÜT (TL)
   *   gercekGider      belgelenebilir gerçek gider toplamı (TL)
   *   digerGelir       aynı yıl beyan edilen/edilecek diğer gelirler (TL)
   *                    — tarife kümülatif olduğu için kira bunun ÜZERİNE biner
   *   digerStopaj      diğer gelirlerden kesilmiş, mahsup edilebilir stopaj
   */
  function hesapla(g) {
    var P = B.parametre(g.yil);
    var K = P.gmsi;
    if (!K) return { hata: "Bu yıl için kira geliri parametreleri tanımlı değil." };

    var konut = Math.max(0, Number(g.konutKira) || 0);
    var isyeri = Math.max(0, Number(g.isyeriKira) || 0);
    var gercek = Math.max(0, Number(g.gercekGider) || 0);
    var diger = Math.max(0, Number(g.digerGelir) || 0);
    var digerStopaj = Math.max(0, Number(g.digerStopaj) || 0);

    if (konut + isyeri <= 0) return { hata: "En az bir kira geliri girin." };

    var notlar = [];

    /* --- mesken istisnası ------------------------------------------------
       İstisna, yalnızca konut kirasına uygulanır ve iki hâlde düşer:
       (a) toplam gelir üst sınırı aşıyorsa,
       (b) konut kirası zaten istisna tutarının altındaysa beyan gerekmez. */
    var istisnaTabani = konut + isyeri + diger;
    var istisnaHakki = konut > 0 && istisnaTabani <= K.istisnaUstSinir;
    var istisna = istisnaHakki ? Math.min(konut, K.meskenIstisnasi) : 0;

    if (konut > 0 && !istisnaHakki) {
      notlar.push("Toplam geliriniz " + K.istisnaUstSinir.toLocaleString("tr-TR") +
        " TL sınırını aştığı için mesken istisnasından yararlanamıyorsunuz (GVK m.21).");
    }

    var konutKalan = Math.max(0, konut - istisna);

    /* --- işyeri kirası beyan sınırı -------------------------------------
       Tevkifata tabi işyeri kirası, beyan sınırının altındaysa beyan
       edilmez ve kesilen stopaj nihai vergi olur. Sınır aşılırsa TAMAMI
       beyana girer; sınır bir muafiyet değil, eşiktir. */
    var isyeriBeyanaGirer = isyeri > K.isyeriBeyanSiniri;
    var isyeriMatrah = isyeriBeyanaGirer ? isyeri : 0;
    var isyeriStopaj = isyeriBeyanaGirer ? isyeri * K.isyeriStopaji : 0;

    if (isyeri > 0 && !isyeriBeyanaGirer) {
      notlar.push("İşyeri kiranız " + K.isyeriBeyanSiniri.toLocaleString("tr-TR") +
        " TL beyan sınırının altında; beyan edilmez, kesilen stopaj nihai vergidir.");
    }

    /* --- iki gider yöntemi ---------------------------------------------- */
    function yontem(ad, gider, uygulanabilir, aciklama) {
      var safi = Math.max(0, (konutKalan + isyeriMatrah) - gider);
      var matrah = safi + diger;
      var vergiToplam = B.tarifeVergisi(matrah, P.dilimlerUcretDisi);
      var vergiDiger = B.tarifeVergisi(diger, P.dilimlerUcretDisi);
      /* Kiranın PAYINA düşen vergi: kümülatif tarifede kira, diğer gelirin
         üstüne bindiği için marjinal fark alınıyor. Kirayı tek başına
         hesaplamak, üst dilime çıkışı görünmez kılardı. */
      var kiraVergisi = vergiToplam - vergiDiger;
      var mahsup = isyeriStopaj + digerStopaj;
      var odenecek = Math.max(0, vergiToplam - mahsup);
      return {
        ad: ad, aciklama: aciklama, uygulanabilir: uygulanabilir !== false,
        gider: yuvarla(gider), safiIrat: yuvarla(safi), matrah: yuvarla(matrah),
        vergiToplam: yuvarla(vergiToplam), kiraVergisi: yuvarla(kiraVergisi),
        mahsup: yuvarla(mahsup), odenecek: yuvarla(odenecek),
        efektifOran: (konut + isyeri) > 0 ? kiraVergisi / (konut + isyeri) : 0
      };
    }

    var goturuGider = (konutKalan + isyeriMatrah) * K.goturuGiderOrani;
    var goturu = yontem("Götürü gider", goturuGider, true,
      "İstisna sonrası kalan tutarın %" +
      String(K.goturuGiderOrani * 100).replace(".", ",") + "'i belgesiz indirilir.");
    var gercekY = yontem("Gerçek gider", Math.min(gercek, konutKalan + isyeriMatrah), true,
      "Belgelendirilen giderler indirilir (GVK m.74).");

    var avantajli = gercekY.odenecek < goturu.odenecek ? "gercek"
      : (goturu.odenecek < gercekY.odenecek ? "goturu" : "esit");
    var fark = Math.abs(goturu.odenecek - gercekY.odenecek);

    if (!K.kredFaiziIndirimi) {
      notlar.push("Banka kredisiyle alınan konutun kira gelirinden kredi faizi " +
        "indirimi 7566 sayılı Kanun ile kaldırılmıştır; gerçek gider tutarına " +
        "faiz eklemeyin.");
    }

    return {
      yil: P.yil,
      konut: konut, isyeri: isyeri, diger: diger,
      istisnaHakki: istisnaHakki, istisna: yuvarla(istisna),
      konutKalan: yuvarla(konutKalan),
      isyeriBeyanaGirer: isyeriBeyanaGirer,
      isyeriStopaj: yuvarla(isyeriStopaj),
      digerStopaj: yuvarla(digerStopaj),
      goturu: goturu, gercek: gercekY,
      avantajli: avantajli, fark: yuvarla(fark),
      notlar: notlar,
      parametre: K
    };
  }

  return { hesapla: hesapla };
});
