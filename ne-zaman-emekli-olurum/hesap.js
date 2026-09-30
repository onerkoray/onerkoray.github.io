/*!
 * Ne zaman emekli olurum? — emeklilik tarihi çekirdeği (4/a ve 4/b)
 *
 * Soru: yaşlılık aylığına hangi gün hak kazanılır, hangi şart bağlayıcıdır,
 * borçlanma o günü ne kadar öne çeker ve bu kaça mal olur?
 *
 * KURALLAR ilk sigortalılık tarihine göre üç gruba ayrılır. Metinler
 * mevzuat.gov.tr'deki güncel (konsolide) hâlinden okundu:
 *
 *   8 Eylül 1999 öncesi (EYT)
 *     4/a  506 s.K. Geçici m.81/B — 23.5.2002'deki sigortalılık süresine göre
 *          5000–5975 gün; kadın 20, erkek 25 yıl sigortalılık. Yaş şartı
 *          5510 s.K. Geçici m.95 (7438 s.K.) ile kalktı.
 *          Geçici m.81/C — 15 yıl + 3600 gün + şartların tamamlandığı
 *          tarihe göre yaş (kadın 50–58, erkek 55–60). EYT bu bendi kapsamaz.
 *     4/b  1479 s.K. Geçici m.10 — kadın 20, erkek 25 tam yıl prim; yaş
 *          şartı Geçici m.95 ile kalktı. Üçüncü fıkra: 15 tam yıl + yaş
 *          (kadın 51–56, erkek 56–58).
 *   8 Eylül 1999 – 30 Nisan 2008
 *     4/a  5510 Geçici m.9/1 — kadın 58, erkek 60 yaş ve 7000 gün; ya da
 *          aynı yaş, 25 yıl sigortalılık ve 4500 gün.
 *     4/b  Geçici m.9/2 — 58/60 yaş ve 25 tam yıl; ya da 60/62 yaş ve 15 tam yıl.
 *   1 Mayıs 2008 ve sonrası
 *     5510 m.28/2 — 4/a 7200, 4/b 9000 gün; yaş 58/60, gün şartının
 *     dolduğu tarihe göre 2036'dan itibaren kademeli 65'e çıkar.
 *     m.28/3 — yaşa üç yıl eklenir (en çok 65), 5400 gün; 4/a için bu gün
 *     sayısı Geçici m.6/7-b ile başlangıç yılına göre 4600'den 5400'e iner.
 *
 *   Sigortalılık süresinin başlangıcı (m.38/2, Geçici m.6/1): 18 yaşından
 *   önce başlayanlarda 18. yaş günü; 1 Nisan 1981'den önce tescil edilenlere
 *   uygulanmaz. Başlangıçtan önceki süreler borçlanılırsa başlangıç,
 *   borçlanılan gün sayısı kadar geri gider (m.41). Grup, geri gitmiş
 *   başlangıca göre belirlenir: askerlik borçlanmasıyla EYT'ye girmenin yolu budur.
 *
 * PRİM GÜNÜ İLERLEMESİ: bugünkü toplam gün, önümüzdeki her ay "yılda N gün"
 * hızının on ikide biri kadar artar. Eşiğin aşıldığı ayın son günü, gün
 * şartının dolduğu tarih sayılır. Bu bir projeksiyondur; SGK hizmet dökümü
 * esas alınır.
 *
 * KAPSAM DIŞI: 4/c (memur), fiili hizmet zammı (yıpranma), malulen ve
 * engelli emekliliği, maden ve erken yaşlanma hükümleri, ağır engelli
 * çocuğu olan annelerin gün ve yaş indirimi, yurt dışı borçlanması,
 * farklı statülerde geçen hizmetlerin birleştirilmesi. Bunlardan birine
 * girenlere araç bunu söyler; tarih uydurmaz.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/ne-zaman-emekli-olurum/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../bordro/sgk-prim.js"), require("../bordro/emeklilik-parametreleri.js"));
  } else {
    kok.EmeklilikTarihi = fabrika(kok.SgkPrim, kok.EMEKLILIK_PARAMETRELERI);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (SgkPrim, EP) {
  "use strict";

  var SURUM = "1.0.0";
  var EYT_SINIRI = "1999-09-08";      // bu tarih ve sonrası EYT dışı (Geçici m.9: "8/9/1999 tarihinden")
  var GECIS_SONU = "2008-04-30";      // Geçici m.9: "30/4/2008 tarihine kadar"; sonrası m.28
  var TESCIL_1981 = "1981-04-01";     // Geçici m.6/1: öncesinde 18 yaş kuralı yok
  var B_TARIHI = "2002-05-23";        // 506 Geçici m.81/B ve C: 4759 s.K. tarihi
  var BAGKUR_KISMI_BAZ = "1999-10-01"; // 1479 Geçici m.10/3: 4447'nin yürürlüğünü izleyen ay başı

  /* 506 s.K. Geçici m.81/B — 23.5.2002'deki sigortalılık süresi → gün.
     Alt sınırlar dahil, [yıl, ay, gün]. Yaş, bilgi için tutulur: 7438 s.K.
     ile uygulanmıyor ("EYT olmasaydı" satırı). */
  var TABLO_81B = {
    kadin: { sure: 20, satirlar: [
      [[18, 0, 0], 5000, 40, "a"], [[17, 0, 0], 5000, 41, "b"], [[16, 0, 0], 5075, 42, "c"],
      [[15, 0, 0], 5150, 43, "d"], [[14, 0, 0], 5225, 44, "e"], [[13, 0, 0], 5300, 45, "f"],
      [[12, 0, 0], 5375, 46, "g"], [[11, 0, 0], 5450, 47, "h"], [[10, 0, 0], 5525, 48, "ı"],
      [[9, 0, 0], 5600, 49, "j"], [[8, 0, 0], 5675, 50, "k"], [[7, 0, 0], 5750, 51, "l"],
      [[6, 0, 0], 5825, 52, "m"], [[5, 0, 0], 5900, 53, "n"], [[4, 0, 0], 5975, 54, "o"],
      [[3, 0, 0], 5975, 55, "p"], [[2, 8, 15], 5975, 56, "r"]
    ] },
    erkek: { sure: 25, satirlar: [
      [[23, 0, 0], 5000, 44, "a"], [[21, 6, 0], 5000, 45, "b"], [[20, 0, 0], 5075, 46, "c"],
      [[18, 6, 0], 5150, 47, "d"], [[17, 0, 0], 5225, 48, "e"], [[15, 6, 0], 5300, 49, "f"],
      [[14, 0, 0], 5375, 50, "g"], [[12, 6, 0], 5450, 51, "h"], [[11, 0, 0], 5525, 52, "ı"],
      [[9, 6, 0], 5600, 53, "j"], [[8, 0, 0], 5675, 54, "k"], [[6, 6, 0], 5750, 55, "l"],
      [[5, 0, 0], 5825, 56, "m"], [[3, 6, 0], 5900, 57, "n"], [[2, 8, 15], 5975, 58, "o"]
    ] }
  };

  /* 506 Geçici m.81/C — 15 yıl + 3600 gün + (kadın 50, erkek 55) şartlarının
     tamamlandığı tarihe göre yaş. [son gün (dahil), kadın, erkek]. */
  var TABLO_81C = [
    ["2002-05-23", 50, 55], ["2005-05-23", 52, 56], ["2008-05-23", 54, 57],
    ["2011-05-23", 56, 58], ["2014-05-23", 58, 59], [null, 58, 60]
  ];

  /* 1479 Geçici m.10/3 — 15 tam yıl prim + (50/55 yaş) şartlarının
     1.10.1999'dan kaç tam yıl sonra tamamlandığına göre yaş.
     [en çok yıl (dahil), kadın, erkek]; ilk satır birinci fıkradaki
     "iki tam yıl veya daha az kalan" saklı hak. */
  var TABLO_1479_KISMI = [[2, 50, 55], [4, 51, 56], [6, 52, 56], [8, 53, 57], [10, 54, 57], [null, 56, 58]];

  /* 5510 m.28/2-b — gün şartının dolduğu tarihe göre yaş. [başlangıç, kadın, erkek] */
  var TABLO_28 = [
    ["2048-01-01", 65, 65], ["2046-01-01", 64, 65], ["2044-01-01", 63, 65],
    ["2042-01-01", 62, 64], ["2040-01-01", 61, 63], ["2038-01-01", 60, 62],
    ["2036-01-01", 59, 61], [null, 58, 60]
  ];

  /* ---------------------------- tarih yardımcıları ---------------------------- */
  function parca(iso) { return [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)]; }
  function iso(y, a, g) { return y + "-" + (a < 10 ? "0" : "") + a + "-" + (g < 10 ? "0" : "") + g; }
  function ayinGunu(y, a) { return new Date(Date.UTC(y, a, 0)).getUTCDate(); }
  function gecerliTarih(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = parca(s);
    return p[1] >= 1 && p[1] <= 12 && p[2] >= 1 && p[2] <= ayinGunu(p[0], p[1]);
  }
  /* Yıl, ay, gün ekler. Ay sonunu aşan gün ayın son gününe iner
     (31 Ocak + 1 ay = 28/29 Şubat); 29 Şubat doğumlu, artık olmayan yılda
     28 Şubat'ta yaş doldurur. */
  function ekle(s, yil, ay, gun) {
    var p = parca(s), y = p[0] + (yil || 0), a = p[1] + (ay || 0);
    y += Math.floor((a - 1) / 12); a = ((a - 1) % 12 + 12) % 12 + 1;
    var g = Math.min(p[2], ayinGunu(y, a));
    var t = new Date(Date.UTC(y, a - 1, g) + (gun || 0) * 864e5);
    return t.toISOString().slice(0, 10);
  }
  function enGec(a, b) { return a > b ? a : b; }
  function ayBasiSonra(s) { var p = parca(s); return p[1] === 12 ? iso(p[0] + 1, 1, 1) : iso(p[0], p[1] + 1, 1); }
  /* İki tarih arası tam yıl, ay, gün. */
  function fark(bas, son) {
    var a = parca(bas), b = parca(son);
    var y = b[0] - a[0], m = b[1] - a[1], d = b[2] - a[2];
    if (d < 0) { m -= 1; d += b[1] === 1 ? 31 : ayinGunu(b[0], b[1] - 1); }
    if (m < 0) { y -= 1; m += 12; }
    return { yil: y, ay: m, gun: d };
  }
  function sureDoldu(bas, esik, tarih) { return ekle(bas, esik[0], esik[1], esik[2]) <= tarih; }

  /* ------------------------------ prim ilerlemesi ------------------------------ */
  /* Bugün P gün var; her ay yillik/12 gün eklenir. T'ye ulaşılan ayın son günü. */
  function gunTarihi(P, T, yillik, bugun) {
    if (P >= T) return { tarih: bugun, gecmis: true };
    if (!(yillik > 0)) return { tarih: null };
    var ay = Math.ceil((T - P) / (yillik / 12) - 1e-9);
    var p = parca(bugun), y = p[0], a = p[1] + ay;
    y += Math.floor((a - 1) / 12); a = ((a - 1) % 12 + 12) % 12 + 1;
    return { tarih: iso(y, a, ayinGunu(y, a)), ay: ay };
  }

  function yas28(cins, tarih) {
    for (var i = 0; i < TABLO_28.length; i++) {
      if (TABLO_28[i][0] === null || tarih >= TABLO_28[i][0]) return TABLO_28[i][cins === "kadin" ? 1 : 2];
    }
  }
  function kismiGun4a(baslangic) {
    /* Geçici m.6/7-b: 30.4.2008–31.12.2008 → 4600; 2009'dan her yıl +100, en çok 5400. */
    var y = +baslangic.slice(0, 4);
    return Math.min(5400, 4600 + Math.max(0, y - 2008) * 100);
  }

  /* --------------------------------- doğrulama --------------------------------- */
  function dogrula(g) {
    if (!gecerliTarih(g.dogum)) throw new Error("Doğum tarihini gün, ay, yıl olarak girin.");
    if (!gecerliTarih(g.ilkGiris)) throw new Error("İlk sigorta giriş tarihini gün, ay, yıl olarak girin.");
    if (!gecerliTarih(g.bugun)) throw new Error("Hesap tarihi geçersiz.");
    if (g.cinsiyet !== "kadin" && g.cinsiyet !== "erkek") throw new Error("Cinsiyet seçin.");
    if (g.statu !== "4a" && g.statu !== "4b") throw new Error("Sigortalılık türünü seçin.");
    if (g.ilkGiris <= g.dogum) throw new Error("İlk giriş tarihi doğum tarihinden sonra olmalı.");
    if (g.ilkGiris < ekle(g.dogum, 12, 0, 0)) throw new Error("İlk giriş 12 yaşından önce görünüyor; tarihleri kontrol edin.");
    if (g.ilkGiris > g.bugun) throw new Error("İlk giriş tarihi bugünden sonra olamaz.");
    if (!(g.primGun >= 0 && g.primGun <= 20000)) throw new Error("Prim günü 0 ile 20.000 arasında olmalı.");
    if (!(g.yillikGun >= 0 && g.yillikGun <= 360)) throw new Error("Yılda en çok 360 gün prim ödenebilir.");
    var ab = g.askerlikGun || 0, db = g.dogumGun || 0;
    if (!(ab >= 0 && ab <= 1100)) throw new Error("Askerlik borçlanması 0 ile 1100 gün arasında olmalı.");
    if (!(db >= 0 && db <= 2160)) throw new Error("Doğum borçlanması en çok 2160 gün: üç doğum için ikişer yıl (m.41/1-a).");
    if (db > 0 && g.cinsiyet !== "kadin") throw new Error("Doğum borçlanması yalnız kadın sigortalılar içindir.");
  }

  /* --------------------------------- ana hesap --------------------------------- */
  function kosul(ad, gereken, tarih, ek) {
    var k = { ad: ad, gereken: gereken, tarih: tarih };
    for (var x in ek || {}) k[x] = ek[x];
    return k;
  }
  /* Bir yolun tarihi = şartlarının en geç dolanı. Biri hiç dolmuyorsa null. */
  function yol(kod, ad, dayanak, kosullar, ek) {
    var tarih = null, bag = null, ulasilmaz = false;
    kosullar.forEach(function (k) {
      if (k.tarih === null) { ulasilmaz = true; bag = k; return; }
      if (!ulasilmaz && (tarih === null || k.tarih > tarih)) { tarih = k.tarih; bag = k; }
    });
    var y = { kod: kod, ad: ad, dayanak: dayanak, kosullar: kosullar, tarih: ulasilmaz ? null : tarih, bagli: bag ? bag.ad : null };
    for (var x in ek || {}) y[x] = ek[x];
    return y;
  }

  function hesapla(girdi) {
    var g = Object.assign({ yillikGun: 360, askerlikGun: 0, askerlikOnce: false, dogumGun: 0, dogumOnce: false }, girdi);
    g.primGun = Number(g.primGun); g.yillikGun = Number(g.yillikGun);
    g.askerlikGun = Math.round(Number(g.askerlikGun) || 0); g.dogumGun = Math.round(Number(g.dogumGun) || 0);
    dogrula(g);

    var kadin = g.cinsiyet === "kadin", bugun = g.bugun;
    var geriGun = (g.askerlikOnce ? g.askerlikGun : 0) + (g.dogumOnce ? g.dogumGun : 0);
    var baslangic = ekle(g.ilkGiris, 0, 0, -geriGun);
    var yas18 = ekle(g.dogum, 18, 0, 0);
    var onsekizKurali = g.ilkGiris >= TESCIL_1981 && baslangic < yas18;
    var sureBas = onsekizKurali ? yas18 : baslangic;
    var P = g.primGun + g.askerlikGun + g.dogumGun;
    var grup = baslangic < EYT_SINIRI ? "eyt" : (baslangic <= GECIS_SONU ? "gecis" : "yeni");

    function gun(T) { return gunTarihi(P, T, g.yillikGun, bugun).tarih; }
    function yasTarihi(n) { return ekle(g.dogum, n, 0, 0); }
    function sureTarihi(n) { return ekle(sureBas, n, 0, 0); }
    function kYas(n, ek) { return kosul("Yaş", n, yasTarihi(n), Object.assign({ tur: "yas" }, ek)); }
    function kGun(T, ek) { return kosul("Prim günü", T, gun(T), Object.assign({ tur: "gun" }, ek)); }
    function kSure(n) { return kosul("Sigortalılık süresi", n, sureTarihi(n), { tur: "sure" }); }

    var yollar = [], notlar = [];
    if (onsekizKurali) notlar.push("18 yaşından önce başladığınız için sigortalılık süresi 18. yaş gününüzden (" + yas18 + ") sayılır (5510 m.38/2). Prim günleriniz ise sayılır.");

    if (grup === "eyt" && g.statu === "4a") {
      var T = TABLO_81B[g.cinsiyet], sure2002 = fark(sureBas, B_TARIHI), satir = null;
      for (var i = 0; i < T.satirlar.length; i++) {
        if (sureBas <= B_TARIHI && sureDoldu(sureBas, T.satirlar[i][0], B_TARIHI)) { satir = T.satirlar[i]; break; }
      }
      if (!satir) {
        satir = T.satirlar[T.satirlar.length - 1];
        notlar.push("18 yaş kuralı nedeniyle 23 Mayıs 2002'deki sigortalılık süreniz tablonun en alt satırının da altında kalıyor. Araç en alt satırı (" + satir[1] + " gün) uyguladı; bu durumu SGK'ya teyit ettirin.");
      }
      yollar.push(yol("tam", "Yaşa bakılmaksızın (EYT)", "506 s.K. Geçici m.81/B-(" + satir[3] + "), 5510 s.K. Geçici m.95",
        [kSure(T.sure), kGun(satir[1])], { eytOncesiYas: satir[2], sure2002: sure2002, bent: satir[3] }));
      /* C bendi: 15 yıl + 3600 gün + 50/55 yaşın birlikte tamamlandığı gün, yaşı belirler. */
      var bazYas = kadin ? 50 : 55, gun3600 = gun(3600);
      var dC = gun3600 === null ? null : enGec(enGec(sureTarihi(15), gun3600), yasTarihi(bazYas));
      var yasC = null;
      if (dC) for (var j = 0; j < TABLO_81C.length; j++) {
        if (TABLO_81C[j][0] === null || dC <= TABLO_81C[j][0]) { yasC = TABLO_81C[j][kadin ? 1 : 2]; break; }
      }
      yollar.push(yol("kismi", "Yaştan (15 yıl, 3600 gün)", "506 s.K. Geçici m.81/C",
        [kSure(15), kGun(3600), yasC === null ? kosul("Yaş", null, null, { tur: "yas" }) : kYas(yasC)], { kismi: true }));
    } else if (grup === "eyt" && g.statu === "4b") {
      var tamGun = kadin ? 7200 : 9000;
      yollar.push(yol("tam", "Yaşa bakılmaksızın (EYT)", "1479 s.K. Geçici m.10/2, 5510 s.K. Geçici m.95",
        [kGun(tamGun, { tamYil: kadin ? 20 : 25 })]));
      var gun5400 = gun(5400), baz = kadin ? 50 : 55;
      var dB = gun5400 === null ? null : enGec(gun5400, yasTarihi(baz)), yasB = null;
      if (dB) {
        var gecen = dB <= BAGKUR_KISMI_BAZ ? 0 : fark(BAGKUR_KISMI_BAZ, dB);
        for (var k = 0; k < TABLO_1479_KISMI.length; k++) {
          var ust = TABLO_1479_KISMI[k][0];
          var icinde = ust === null || gecen === 0 || gecen.yil < ust || (gecen.yil === ust && gecen.ay === 0 && gecen.gun === 0);
          if (icinde) { yasB = TABLO_1479_KISMI[k][kadin ? 1 : 2]; break; }
        }
      }
      yollar.push(yol("kismi", "Yaştan (15 tam yıl)", "1479 s.K. Geçici m.10/3",
        [kGun(5400, { tamYil: 15 }), yasB === null ? kosul("Yaş", null, null, { tur: "yas" }) : kYas(yasB)], { kismi: true }));
    } else if (grup === "gecis" && g.statu === "4a") {
      yollar.push(yol("tam", "Yaş ve 7000 gün", "5510 s.K. Geçici m.9/1", [kYas(kadin ? 58 : 60), kGun(7000)]));
      yollar.push(yol("sure25", "Yaş, 25 yıl ve 4500 gün", "5510 s.K. Geçici m.9/1",
        [kYas(kadin ? 58 : 60), kSure(25), kGun(4500)]));
    } else if (grup === "gecis" && g.statu === "4b") {
      yollar.push(yol("tam", "Yaş ve 25 tam yıl", "5510 s.K. Geçici m.9/2", [kYas(kadin ? 58 : 60), kGun(9000, { tamYil: 25 })]));
      yollar.push(yol("kismi", "Yaş ve 15 tam yıl", "5510 s.K. Geçici m.9/2", [kYas(kadin ? 60 : 62), kGun(5400, { tamYil: 15 })], { kismi: true }));
    } else {
      var tam = g.statu === "4a" ? 7200 : 9000, tTam = gun(tam);
      var yTam = tTam === null ? null : yas28(g.cinsiyet, tTam);
      yollar.push(yol("tam", "Yaş ve " + tam.toLocaleString("tr-TR") + " gün", "5510 s.K. m.28/2",
        [kGun(tam), yTam === null ? kosul("Yaş", null, null, { tur: "yas" }) : kYas(yTam, { kademe: yTam !== (kadin ? 58 : 60) })]));
      var kg = g.statu === "4a" ? kismiGun4a(baslangic) : 5400, tK = gun(kg);
      var yK = tK === null ? null : Math.min(65, yas28(g.cinsiyet, tK) + 3);
      yollar.push(yol("kismi", "Yaşa 3 yıl eklenerek, " + kg.toLocaleString("tr-TR") + " gün", "5510 s.K. m.28/3" + (g.statu === "4a" ? ", Geçici m.6/7-b" : ""),
        [kGun(kg), yK === null ? kosul("Yaş", null, null, { tur: "yas" }) : kYas(yK)], { kismi: true }));
    }

    /* Geçmişte dolmuş şartlar bugün sayılır: şartlar tamamsa "bugün" döner. */
    yollar.forEach(function (y) {
      y.kosullar.forEach(function (k) { k.tamam = k.tarih !== null && k.tarih <= bugun; });
      if (y.tarih !== null && y.tarih < bugun) y.tarih = bugun;
      y.tamam = y.tarih !== null && y.tarih <= bugun;
    });
    var ulasilir = yollar.filter(function (y) { return y.tarih !== null; });
    var enErken = ulasilir.length ? ulasilir.reduce(function (a, b) { return b.tarih < a.tarih ? b : a; }) : null;

    if (g.statu === "4b") notlar.push("Bağ-Kur'da aylık bağlanması için talep tarihinde GSS dahil prim borcu bulunmamalı (5510 m.28).");
    if (grup === "gecis") notlar.push("Meclise gelen \"kademeli emeklilik\" teklifleri bu grubu hedefliyor; yasalaşmadıkça hesap bugünkü kanuna göre yapılır.");

    return {
      surum: SURUM, girdi: g, grup: grup, baslangic: baslangic, geriGun: geriGun, sureBaslangici: sureBas,
      onsekizKurali: onsekizKurali, primToplam: P, yollar: yollar, enErken: enErken,
      tarih: enErken ? enErken.tarih : null,
      aylikBaslangici: enErken ? ayBasiSonra(enErken.tarih) : null,
      kalan: enErken ? fark(bugun, enErken.tarih) : null,
      yasi: enErken ? fark(g.dogum, enErken.tarih) : null,
      eytSinirinaGun: grup === "eyt" ? 0 : Math.round((Date.parse(baslangic) - Date.parse("1999-09-07")) / 864e5),
      gecisSinirinaGun: grup === "yeni" ? Math.round((Date.parse(baslangic) - Date.parse(GECIS_SONU)) / 864e5) : 0,
      notlar: notlar
    };
  }

  /* ----------------------------- karar: borçlanma ----------------------------- */
  /* Borçlanmasız ve borçlanmalı hesabı karşılaştırır. Maliyet 5510 m.41:
     günlük kazanç × gün × (askerlik %45, doğum %32); en az tutar asgari
     kazançtan. Kazanç: öne çekilen ay × en düşük emekli aylığı (alt sınır;
     gerçek aylık bundan yüksek olabilir, düşük olamaz). */
  function borclanmaEtkisi(girdi, yil) {
    var sonra = hesapla(girdi);
    var once = hesapla(Object.assign({}, girdi, { askerlikGun: 0, dogumGun: 0 }));
    var maliyet = 0, kalemler = [];
    [["askerlik", "genel", girdi.askerlikGun], ["dogum", "dogum", girdi.dogumGun]].forEach(function (x) {
      var n = Math.round(Number(x[2]) || 0);
      if (n > 0) {
        var b = SgkPrim.borclanma(n, SgkPrim.sinirlar(yil).gunlukAlt, x[1], yil);
        kalemler.push({ tur: x[0], gun: n, oran: b.oran, enAz: b.enAz, enCok: b.enCok });
        maliyet += b.enAz;
      }
    });
    var ay = null;
    if (once.tarih && sonra.tarih) {
      var f = fark(sonra.tarih, once.tarih);
      ay = f.yil * 12 + f.ay + f.gun / 30;
    }
    var alt = EP.altSinirAylik(girdi.bugun);
    return {
      once: once, sonra: sonra, kalemler: kalemler, maliyetEnAz: Math.round(maliyet * 100) / 100,
      oneCekilenAy: ay, grupDegisti: once.grup !== sonra.grup,
      altSinir: alt, geriDonusAy: alt ? maliyet / alt.tutar : null,
      /* ulaşılamayan hedefe borçlanmayla ulaşılıyorsa */
      ulasilirOldu: once.tarih === null && sonra.tarih !== null
    };
  }

  /* Tek varsayım değişince tarih: çalışma yoğunluğu. */
  function duyarlilik(girdi) {
    return [360, 270, 180, 90, 0].map(function (n) {
      var r = hesapla(Object.assign({}, girdi, { yillikGun: n }));
      return { yillikGun: n, tarih: r.tarih, yol: r.enErken ? r.enErken.kod : null };
    });
  }

  return {
    surum: SURUM, hesapla: hesapla, borclanmaEtkisi: borclanmaEtkisi, duyarlilik: duyarlilik,
    yardimci: { ekle: ekle, fark: fark, gunTarihi: gunTarihi, yas28: yas28, kismiGun4a: kismiGun4a, ayBasiSonra: ayBasiSonra },
    tablolar: { b81: TABLO_81B, c81: TABLO_81C, kismi1479: TABLO_1479_KISMI, m28: TABLO_28 },
    sinirlar: { eyt: EYT_SINIRI, gecisSonu: GECIS_SONU, tescil1981: TESCIL_1981 }
  };
});
