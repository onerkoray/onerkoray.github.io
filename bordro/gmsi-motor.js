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
   *   brutGelirToplami GVK m.21 üst sınır testine giren, BU KİRA DIŞINDAKİ
   *                    ücret + MSİ + GMSİ + diğer kazançların GAYRİ SAFİ
   *                    toplamı. Kanun "beyanı gerekip gerekmediğine
   *                    bakılmaksızın" dediği için stopajla vergilenip beyan
   *                    edilmeyen ücret de buraya girer — digerGelir'den farkı
   *                    budur. Hesaplanan konut+işyeri kirası motor tarafından
   *                    AYRICA eklenir; buraya yazılmaz. Verilmezse digerGelir
   *                    kullanılır (eski davranış)
   *   ticariBeyan      ticari/zirai/mesleki kazanç nedeniyle yıllık beyanname
   *                    verme mecburiyeti var mı (true ise istisna uygulanmaz)
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
       GVK m.21 istisnayı İKİ AYRI GRUBA kapatır ve ikisi bağımsızdır:

         (a) "Ticari, zirai veya mesleki kazancını yıllık beyanname ile
             bildirmek mecburiyetinde olanlar" — tutara bakılmaz, beyan
             MECBURİYETİ yeter.
         (b) Hasılatı istisna haddini aşanlardan, ücret + MSİ + GMSİ +
             diğer kazanç ve iratların GAYRİ SAFİ toplamı üst sınırı
             aşanlar.

       (a) uzun süre hiç uygulanmıyordu: sayfada yazıyordu ama form
       sormuyordu, dolayısıyla serbest meslek erbabı da istisnayı alıyordu.

       ÜST SINIR PARAMETRE DEĞİL, TARİFEDEN TÜRETİLİR: kanun onu
       "tarifenin üçüncü diliminde ücret gelirleri için yer alan tutar"
       diye tanımlıyor. Elle yazılan kopya 2023'ten kalmıştı. */
    var istisnaUstSinir = P.dilimler[2][0];

    /* (b)'nin tabanı BEYAN EDİLEN gelir değil: kanun "beyanı gerekip
       gerekmediğine bakılmaksızın" der. Stopajla vergilenip beyan
       edilmeyen ücret de bu toplama girer; bu yüzden ayrı sorulur ve
       verilmediğinde beyana giren gelire düşülür.

       Kira gelirinin kendisi de GMSİ olarak bu toplama dahildir; o
       yüzden konut+işyeri BURADA ekleniyor, girdide değil. */
    var brutToplam = (g.brutGelirToplami === undefined || g.brutGelirToplami === null)
      ? diger
      : Math.max(0, Number(g.brutGelirToplami) || 0);
    var istisnaTabani = konut + isyeri + brutToplam;

    var ticariBeyan = g.ticariBeyan === true;
    var sinirAsildi = konut > K.meskenIstisnasi && istisnaTabani > istisnaUstSinir;
    var istisnaHakki = konut > 0 && !ticariBeyan && !sinirAsildi;
    var istisna = istisnaHakki ? Math.min(konut, K.meskenIstisnasi) : 0;

    if (konut > 0 && ticariBeyan) {
      notlar.push("Ticari, zirai veya mesleki kazancınız nedeniyle yıllık " +
        "beyanname verdiğiniz için mesken istisnasından yararlanamazsınız " +
        "(GVK m.21). Bu hâlde gelir tutarınızın bir önemi yoktur.");
    } else if (konut > 0 && sinirAsildi) {
      notlar.push("Gelir toplamınız " + istisnaUstSinir.toLocaleString("tr-TR") +
        " TL sınırını aştığı için mesken istisnasından yararlanamıyorsunuz " +
        "(GVK m.21). Bu sınır, gelir vergisi tarifesinin üçüncü diliminde " +
        "ücret gelirleri için yer alan tutardır.");
    }

    var konutKalan = Math.max(0, konut - istisna);

    /* --- işyeri kirası beyan sınırı -------------------------------------
       Tevkifata tabi işyeri kirası, beyan sınırının altındaysa beyan
       edilmez ve kesilen stopaj nihai vergi olur. Sınır aşılırsa TAMAMI
       beyana girer; sınır bir muafiyet değil, eşiktir.

       SINIR DA PARAMETRE DEĞİL. GVK m.86/1-c onu "103 üncü maddede yazılı
       tarifenin ikinci gelir diliminde yer alan tutar" diye tanımlıyor,
       yani dilimler[1][0]. Bir süre 400.000 olarak elle yazılıydı: 2026
       için doğru, ama tarife her yıl yeniden değerlemeyle kaydığı için
       2027'de yerinde donacaktı — üst sınırın 2023'te yaşadığı bayatlamanın
       aynısı, üstelik onu anlatan yorumun on satır altında. */
    var isyeriBeyanSiniri = P.dilimler[1][0];

    /* ÖLÇÜT KİRANIN KENDİSİ DEĞİL, VERGİYE TÂBİ GELİR TOPLAMI.
       Madde "vergiye tâbi gelir toplamının ... aşmaması koşuluyla" diyor.
       Motor bir süre kirayı TEK BAŞINA ölçtü ve diğer geliri tamamen yok
       saydı: 350.000 TL işyeri kirası + 5.000.000 TL diğer gelirde "beyan
       edilmez" diyordu. Hata güvensiz yöndeydi -- beyan etmesi gerekene
       etme demek.

       KİRA BU TOPLAMA BRÜT TUTARIYLA GİRİYOR. Bir ara "gelir" GVK m.1'de
       safi tanımlandığı için giderler düşülmüş tutarın ölçülmesi gerektiği
       düşünüldü ve motor iki okumanın birleşimini alıyordu. GİB rehberi ve
       yerleşik uygulama bunu çözdü: tevkifata tabi işyeri kirasında beyan
       sınırı kiranın BRÜT tutarıyla karşılaştırılıyor. Birleşim kalktı;
       kural tek ve kaynaklı.

       Yeni kural eskisinden DAHA SIKI: birleşimde 350.000 TL kira +
       60.000 TL diğer gelir hala "beyan etme" tarafinda kaliyordu
       (brüt 350.000 haddin altında, götürü sonrası safi toplam 357.500
       de öyle), oysa toplam 410.000 TL ile haddin üstünde.

       m.21'in üst sınır testi bambaşka: o kanunun kendi sözüyle GAYRİ
       SAFİ'dir ve yukarıda öyle uygulanıyor. İki test aynı değildir.

       Ücret tarafı da başka çalışır: maddenin parantezi çok işverenli ücret
       için ayrı bir ölçüt koyuyor (birinciden sonrakilerin toplamı), o da
       makaleler/iki-isten-maas-beyanname-siniri/beyan.js içinde. */
    var vergiyeTabiToplam = isyeri + diger;
    var isyeriBeyanaGirer = isyeri > 0 && vergiyeTabiToplam > isyeriBeyanSiniri;
    var isyeriMatrah = isyeriBeyanaGirer ? isyeri : 0;
    var isyeriStopaj = isyeriBeyanaGirer ? isyeri * K.isyeriStopaji : 0;

    if (isyeri > 0 && !isyeriBeyanaGirer) {
      notlar.push("İşyeri kiranız ve diğer vergiye tâbi gelirlerinizin toplamı (" +
        Math.round(vergiyeTabiToplam).toLocaleString("tr-TR") + " TL) " +
        isyeriBeyanSiniri.toLocaleString("tr-TR") + " TL beyan sınırının altında; " +
        "işyeri kirası beyan edilmez, kesilen stopaj nihai vergidir " +
        "(GVK m.86/1-c).");
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
      /* Ölçüte giren toplam dışa açılıyor: kararın hangi sayıdan
         çıktığı görülebilsin, iddia denetlenebilir kalsın. */
      vergiyeTabiToplam: yuvarla(vergiyeTabiToplam),
      digerStopaj: yuvarla(digerStopaj),
      goturu: goturu, gercek: gercekY,
      avantajli: avantajli, fark: yuvarla(fark),
      notlar: notlar,
      parametre: K
    };
  }

  return { hesapla: hesapla };
});
