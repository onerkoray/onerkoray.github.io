/*!
 * Dayanma Süresi Çekirdeği — işsiz kalırsam kaç ay dayanırım?
 *
 * SORU: İş bugün biterse, birikim + çıkış paketi + işsizlik ödeneği + hanedeki
 * diğer gelir, fiyatlar artarken giderleri kaç ay karşılar?
 *
 * Bir skor ÜRETMEZ. Önceki sürüm ağırlıkları "seçilmiş, kalibre edilmemiş"
 * bir 0-100 puan veriyordu; para konusunda savunulamaz. Burada her çıktı ya
 * bir ay sayısı ya bir tutar ve her biri ay ay kurulan bir nakit tablosundan
 * okunur.
 *
 * YASAL KALEMLER BURADA YAZILMAZ, ÇAĞRILIR:
 *   kıdem, ihbar, izin ücreti, son ay ücreti, işsizlik ödeneği  → bordro/cikis.js
 *   GSS primi oranı ve asgari ücret                              → bordro/parametreler.js
 *   kredi taksiti (KKDF ve BSMV dahil)                           → kredi-hesaplama/hesap.js
 * Aynı kuralın iki tanımı olamaz.
 *
 * ZAMAN ÇİZELGESİ
 *   Ay 0  : çıkış günü. Birikim ve çıkış paketi kasadadır (kıdem ve ihbar
 *           fesihle muaccel olur: 1475 s.K. m.14, 4857 s.K. m.17).
 *   Ay 1… : çıkıştan sonraki takvim ayları. Her ay: gelir girer, gider çıkar.
 *   İşsizlik ödeneği cikis.js'in verdiği ilk ödeme ayından başlar ve hak
 *   edilen gün/30 ay sürer (4447 s.K. m.50). Ödenek süresince GSS primi
 *   İşsizlik Sigortası Fonu'ndan ödenir; bitince seçilen GSS durumu işler.
 *
 * FİYAT ARTIŞI giderlere bileşik uygulanır; ödenek, borç taksiti ve diğer
 * hane geliri nominal sabit kalır (ödenek geçmiş kazançtan hesaplanır,
 * taksit sözleşmeyle sabittir). GSS primi bugünkü asgari ücretle sabittir:
 * gelecek yılın asgari ücreti belli değil.
 *
 * Motor TÜFE serisini okumaz; yıllık fiyat artışı girdidir. Sayfa onu
 * sitenin TÜFE serisinden önerir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-emniyet-testi/
 */
(function (root, factory) {
  "use strict";
  var ortak = typeof module === "object" && module.exports;
  var v = factory(
    ortak ? require("../bordro/motor.js") : root.Bordro,
    ortak ? require("../bordro/cikis.js") : root.BordroCikis,
    ortak ? require("../kredi-hesaplama/hesap.js") : root.Kredi
  );
  if (ortak) module.exports = v;
  else root.Dayanma = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, C, K) {
  "use strict";

  var UFUK = 60;                 // en fazla kaç ay yürütülür
  var HEDEFLER = [3, 6, 9, 12];  // iş arama süresi seçenekleri (ay)
  var GSS = ["odeyecegim", "kapsamda", "gelirTesti"];

  function sayi(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function art(x) { return Math.max(0, sayi(x)); }

  function ayFarki(a, b) {   // "YYYY-AA-GG" → takvim ayı farkı
    var x = String(a).split("-"), y = String(b).split("-");
    return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]);
  }
  function ayEkle(iso, n) {  // "YYYY-AA" döner
    var p = String(iso).split("-"), t = +p[0] * 12 + (+p[1] - 1) + n;
    var yy = Math.floor(t / 12), aa = t % 12 + 1;
    return yy + "-" + (aa < 10 ? "0" : "") + aa;
  }
  function aylikOran(yillikYuzde) { return Math.pow(1 + sayi(yillikYuzde) / 100, 1 / 12) - 1; }

  function dogrula(g) {
    var h = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.cikis || ""))) h.push("Çıkış tarihi YYYY-AA-GG olmalı.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.iseGiris || ""))) h.push("İşe giriş tarihi YYYY-AA-GG olmalı.");
    if (!h.length && g.iseGiris > g.cikis) h.push("İşe giriş, çıkıştan sonra olamaz.");
    if (!(sayi(g.ciplakBrut) > 0)) h.push("Brüt ücret sıfırdan büyük olmalı.");
    if (sayi(g.kisintiOrani) < 0 || sayi(g.kisintiOrani) > 100) h.push("Kısıntı oranı 0 ile 100 arasında olmalı.");
    if (sayi(g.enflasyonYillik) < 0 || sayi(g.enflasyonYillik) > 500) h.push("Yıllık fiyat artışı 0 ile 500 arasında olmalı.");
    if (g.gss && GSS.indexOf(g.gss) < 0) h.push("GSS durumu tanınmıyor.");
    return h;
  }

  /* ---- çıkış paketi: bordro/cikis.js ------------------------------------ */
  function cikisPaketi(g) {
    return C.hesapla({
      iseGiris: g.iseGiris, cikis: g.cikis, fesihTuru: g.fesihTuru || "isveren",
      ciplakBrut: sayi(g.ciplakBrut), giydirmeEkleri: sayi(g.giydirmeEkleri),
      son3YilPrimGunu: sayi(g.son3YilPrimGunu), kullanilmayanIzinGunu: sayi(g.kullanilmayanIzinGunu),
      ihbarSuresiCalisildi: !!g.ihbarSuresiCalisildi
    });
  }

  function gssAylik(g, P) {
    if ((g.gss || "odeyecegim") !== "odeyecegim") return 0;
    var d = P.donemler[P.donemler.length - 1];
    var oran = P.sigortalilik && P.sigortalilik.gssOrani;
    if (!oran) throw new Error("Dayanma: " + P.yil + " için GSS oranı tanımlı değil.");
    return d.asgariBrut * oran;
  }

  /* ---- karar: büyük harcama ya da kredi ------------------------------- */
  function kararAkisi(k) {
    if (!k || !(art(k.tutar) > 0)) return null;
    var tutar = art(k.tutar), pesinat = Math.min(art(k.pesinat), tutar);
    var kredi = tutar - pesinat, taksit = 0, vade = 0, plan = null;
    if (kredi > 0) {
      var tur = K.turBilgi(k.krediTuru || "ihtiyac");
      plan = K.plan({ anapara: kredi, vade: Math.round(sayi(k.vade)), aylikFaiz: sayi(k.aylikFaiz), kkdf: tur.kkdf, bsmv: tur.bsmv });
      if (!plan.gecerli) throw new Error("Dayanma: kredi planı kurulamadı (vade ve faizi kontrol edin).");
      taksit = plan.satirlar[0].taksit; vade = plan.vade;
    }
    return { tutar: tutar, pesinat: pesinat, kredi: kredi, taksit: taksit, vade: vade, plan: plan,
      ekGider: art(k.ekGider), tekSeferlik: art(k.tekSeferlik) };
  }

  /* ---- ana yürütme ------------------------------------------------------- */
  function yurut(g, ek) {
    ek = ek || {};
    var hata = dogrula(g);
    if (hata.length) throw new Error("Dayanma: " + hata.join(" "));
    var P = B.parametre(+String(g.cikis).slice(0, 4));
    var paket = ek.paket || cikisPaketi(g);
    var tazminatYok = !!ek.tazminatYok;

    var kidem = tazminatYok ? 0 : paket.kidem.net;
    var ihbar = tazminatYok ? 0 : paket.ihbar.net;
    var izin = paket.izin.net, sonAy = paket.sonAy.net;
    var yatirimKaybi = Math.min(100, art(ek.yatirimKaybi != null ? ek.yatirimKaybi : g.yatirimKaybi)) / 100;
    var birikim = art(g.nakit) + art(g.yatirim) * (1 - yatirimKaybi);
    var karar = ek.kararYok ? null : kararAkisi(g.karar);

    var odenek = paket.issizlik.hak && !ek.odenekYok
      ? { aylik: paket.issizlik.aylikNet, ay: Math.round(paket.issizlik.ay), bas: Math.max(1, ayFarki(g.cikis, paket.issizlik.ilkOdeme)) }
      : { aylik: 0, ay: 0, bas: 0 };
    var gss = gssAylik(g, P);
    var i = aylikOran(ek.enflasyonYillik != null ? ek.enflasyonYillik : g.enflasyonYillik);
    var kisinti = sayi(ek.kisintiOrani != null ? ek.kisintiOrani : g.kisintiOrani) / 100;
    var zorunlu = art(g.zorunluGider), istege = art(g.istegeBagliGider) * (1 - kisinti);
    var borc = art(g.borcTaksiti), diger = art(g.digerGelir);

    var nakit0 = birikim + kidem + ihbar + izin + sonAy - (karar ? karar.pesinat + karar.tekSeferlik : 0);
    var nakit = nakit0, aylar = [], dayanma = null;
    var odenekSonAy = odenek.ay ? odenek.bas + odenek.ay - 1 : 0;
    for (var m = 1; m <= UFUK; m++) {
      var buyume = Math.pow(1 + i, m);
      var odenekBuAy = (odenek.ay && m >= odenek.bas && m <= odenekSonAy) ? odenek.aylik : 0;
      // GSS: ödenek süresince fondan; ödenek yoksa ya da bittiyse kişiden.
      var gssBuAy = (odenekBuAy > 0) ? 0 : gss;
      var taksitBuAy = (karar && m <= karar.vade) ? karar.taksit : 0;
      var gider = {
        zorunlu: zorunlu * buyume, istege: istege * buyume,
        karar: karar ? karar.ekGider * buyume : 0,
        borc: borc, taksit: taksitBuAy, gss: gssBuAy
      };
      var giderToplam = gider.zorunlu + gider.istege + gider.karar + gider.borc + gider.taksit + gider.gss;
      var gelir = odenekBuAy + diger;
      var bas = nakit;
      nakit = bas + gelir - giderToplam;
      aylar.push({ ay: m, tarih: ayEkle(g.cikis, m), nakitBas: bas, odenek: odenekBuAy, digerGelir: diger,
        gider: gider, giderToplam: giderToplam, gelir: gelir, nakitSon: nakit });
      if (dayanma === null && nakit < 0) {
        var acik = giderToplam - gelir;              // bu ayın net çıkışı (> 0)
        dayanma = (m - 1) + (bas > 0 ? bas / acik : 0);
      }
    }
    var son = aylar[aylar.length - 1];
    // Ufukta tükenmediyse: son ayda gelir gideri karşılıyor mu?
    var kalici = dayanma === null && son.gelir >= son.giderToplam;
    return {
      yil: P.yil, paket: paket, karar: karar,
      kalemler: { birikim: birikim, kidem: kidem, ihbar: ihbar, izin: izin, sonAy: sonAy,
        kararCikisi: karar ? karar.pesinat + karar.tekSeferlik : 0 },
      baslangicNakit: nakit0,
      odenek: odenek, gssAylik: gss, aylikEnflasyon: i,
      aylar: aylar,
      dayanmaAy: dayanma === null ? Infinity : dayanma,
      tukenmez: kalici,
      bitis: dayanma === null ? null : ayEkle(g.cikis, Math.ceil(dayanma) || 1)
    };
  }

  /* Hedef T ay için ek fon: ilk T ayda kasanın gördüğü en düşük değerin açığı. */
  function hedefler(s) {
    return HEDEFLER.map(function (T) {
      var enDusuk = Math.min.apply(null, s.aylar.slice(0, T).map(function (a) { return a.nakitSon; }));
      return { ay: T, yeterli: enDusuk >= 0, eksik: Math.max(0, -enDusuk), pay: Math.max(0, enDusuk) };
    });
  }

  function hesapla(g) {
    var s = yurut(g);
    s.hedefler = hedefler(s);
    return s;
  }

  /* Ne olursa ne değişir: her satır tek bir varsayımı değiştirir. */
  function duyarlilik(g) {
    var paket = cikisPaketi(g);
    var temel = yurut(g, { paket: paket }).dayanmaAy;
    var satirlar = [];
    function ekle(kod, ad, ek) {
      var d = yurut(g, Object.assign({ paket: paket }, ek)).dayanmaAy;
      satirlar.push({ kod: kod, ad: ad, dayanmaAy: d, fark: (isFinite(d) && isFinite(temel)) ? d - temel : null });
    }
    if (art(g.istegeBagliGider) > 0 && sayi(g.kisintiOrani) < 100) ekle("tamKisinti", "İsteğe bağlı giderin tamamını keserseniz", { kisintiOrani: 100 });
    if (sayi(g.enflasyonYillik) > 0) ekle("enflasyonsuz", "Fiyatlar hiç artmasaydı", { enflasyonYillik: 0 });
    ekle("enflasyon10", "Fiyat artışı yıllık 10 puan daha yüksek olursa", { enflasyonYillik: sayi(g.enflasyonYillik) + 10 });
    if (art(g.yatirim) > 0) ekle("yatirim30", "Altın, döviz ve yatırımlar %30 değer kaybederse", { yatirimKaybi: 30 });
    if (paket.kidem.net + paket.ihbar.net > 0) ekle("tazminatsiz", "Kıdem ve ihbar ödenmez ya da gecikirse", { tazminatYok: true });
    if (paket.issizlik.hak) ekle("odeneksiz", "İşsizlik ödeneği bağlanmazsa", { odenekYok: true });
    if (g.karar && art(g.karar.tutar) > 0) ekle("kararsiz", "Planlanan harcama yapılmazsa", { kararYok: true });
    return { temel: temel, satirlar: satirlar };
  }

  /* Karar öncesi ve sonrası; T ay hedefini bozmayan en büyük peşin harcama. */
  function kararEtkisi(g, hedefAy) {
    var paket = cikisPaketi(g);
    var once = yurut(g, { paket: paket, kararYok: true });
    var sonra = yurut(g, { paket: paket });
    var T = Math.round(sayi(hedefAy)) || 6;
    var enDusuk = Math.min.apply(null, once.aylar.slice(0, T).map(function (a) { return a.nakitSon; }));
    return { once: once.dayanmaAy, sonra: sonra.dayanmaAy, karar: sonra.karar, hedefAy: T,
      enFazlaPesin: Math.max(0, enDusuk) };
  }

  return {
    surum: "2.0.0", UFUK: UFUK, HEDEFLER: HEDEFLER, GSS: GSS,
    dogrula: dogrula, cikisPaketi: cikisPaketi, aylikOran: aylikOran, ayEkle: ayEkle, ayFarki: ayFarki,
    hesapla: hesapla, duyarlilik: duyarlilik, kararEtkisi: kararEtkisi
  };
});
