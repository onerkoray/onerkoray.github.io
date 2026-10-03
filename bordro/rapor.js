/*!
 * Rapor parası — SGK geçici iş göremezlik ödeneği (4/a)
 *
 * KURAL (5510 s.K., mevzuat.gov.tr güncel metni, 3 Ekim 2026'da okundu)
 *   m.18/b  Hastalık: iş göremezlikten önceki bir yılda en az 90 gün kısa
 *           vadeli prim; ödenek iş göremezliğin ÜÇÜNCÜ gününden başlar.
 *   m.18/a  İş kazası, meslek hastalığı: prim şartı yok, her gün için.
 *   m.18/c  Analık: doğumdan önceki bir yılda en az 90 gün prim; doğumdan
 *           önceki 8 ve sonraki 16 hafta (çoğul gebelikte önce 10 hafta).
 *           7578 s.K. (RG 1.5.2026) doğum sonrasını 8'den 16 haftaya çıkardı.
 *   m.18/3  Ödenek, günlük kazancın yatarak tedavide yarısı, ayakta
 *           tedavide üçte ikisi. Analık ödeneği ayakta oranıyla ödenir.
 *   m.17/1  (7537 s.K., 21.12.2024'ten) Günlük kazanç: iş göremezlikten
 *           (analıkta doğumdan) önceki ON İKİ aydaki prime esas kazançlar
 *           toplamı ÷ bu kazançlara esas prim günü. Önceki 12 ayda 180 günden
 *           az prim varsa günlük kazanç, başlangıç tarihindeki günlük alt
 *           sınırın iki katını geçemez.
 *   m.17/2-a Prim, ikramiye gibi arızi ödemeler varsa günlük kazanç,
 *           ücret toplamı ÷ ücret günü ile bulunan tutarın %50 fazlasını
 *           geçemez.
 *   m.18/4  Alt sınır yükselirse, yeni alt sınırın altındaki günlük kazançla
 *           ödenek alanlar o tarihten itibaren yeni alt sınırdan alır.
 *   GVK m.25/6: sosyal sigorta kurumlarının sigortalılara yaptığı
 *           ödemeler (hastalıkta ayrıca m.25/1) gelir vergisinden istisna;
 *           ödenekten kesinti yapılmaz.
 *
 * YASAL SAYI BU DOSYADA YOK. Asgari ücret ve SGK tavanı bordro/parametreler.js
 * dönemlerinden okunur (motor.parametre). Kesirler (1/2, 2/3, 90, 180, hafta
 * sayıları) kanunun kendisidir ve aşağıda adlı sabitlerde durur.
 *
 * KAPSAM DIŞI: 4/b ve 4/c, sürekli iş göremezlik geliri, emzirme ödeneği,
 * birden çok işverende çalışma.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/rapor-parasi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("./motor.js"));
  else kok.RaporParasi = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  var SURUM = "1.0.0";
  var ORAN = { ayakta: 2 / 3, yatarak: 1 / 2 };
  var HASTALIK_PRIM_SARTI = 90, ANALIK_PRIM_SARTI = 90;
  var DUSUK_PRIM_ESIGI = 180, DUSUK_PRIM_KAT = 2;
  var HASTALIK_ODENMEYEN = 2;               // "üçüncü gününden başlamak üzere"
  var IKRAMIYE_KAT = 1.5;                   // "%50 oranında bir ekleme"
  var ANALIK = { once: 8, onceCogul: 10, sonra: 16 };   // hafta (7578 s.K.)
  var TURLER = {
    hastalik: "Hastalık",
    isKazasi: "İş kazası",
    meslekHastaligi: "Meslek hastalığı",
    analik: "Analık (doğum)"
  };

  function kurus(n) { return Math.round(n * 100 + 1e-9) / 100; }
  function parca(iso) { return [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)]; }
  function isoTarih(t) { return t.toISOString().slice(0, 10); }
  function gunEkle(iso, n) { var p = parca(iso); return isoTarih(new Date(Date.UTC(p[0], p[1] - 1, p[2] + n))); }
  function tarihGecerli(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = parca(s), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  }

  /* Bir tarihin dönem sınırları; parametresi olmayan yılda null. */
  function sinirlar(iso) {
    var p = parca(iso), P;
    try { P = B.parametre(p[0]); } catch (e) { return null; }
    var d = B.donem(P, p[1]);
    return { yil: p[0], gunlukAlt: d.asgariBrut / 30, gunlukUst: d.sgkTavan / 30, asgariBrut: d.asgariBrut, sgkTavan: d.sgkTavan };
  }

  /* ---------------------------------------------- kazanç türetme ----
     e-Devlet hizmet dökümünü bilmeyen kullanıcı için: rapordan önceki
     12 takvim ayının prime esas kazancını, güncel brüt ile son zamdan
     önceki brütten kurar. Her ay o ayın alt ve üst sınırına çekilir
     (5510 m.82). Ödemesi olan ay 30 prim günü sayılır. */
  function oncekiAylar(baslangic) {
    var p = parca(baslangic), out = [];
    for (var i = 12; i >= 1; i--) {
      var t = new Date(Date.UTC(p[0], p[1] - 1 - i, 1));
      out.push({ yil: t.getUTCFullYear(), ay: t.getUTCMonth() + 1 });
    }
    return out;
  }
  function kazancTuret(g) {
    if (!tarihGecerli(g.baslangic)) throw new Error("Başlangıç tarihini gün, ay, yıl olarak girin.");
    var simdi = Number(g.brutSimdi), once = g.brutOnce == null ? simdi : Number(g.brutOnce);
    if (!(simdi > 0) || !(once > 0)) throw new Error("Brüt maaş sıfırdan büyük olmalı.");
    var zam = g.zamAyi || null;            // "2026-07": güncel brüt bu aydan beri
    var calisilanAy = g.calisilanAy == null ? 12 : Math.round(Number(g.calisilanAy));
    if (!(calisilanAy >= 0 && calisilanAy <= 12)) throw new Error("Çalışılan ay 0 ile 12 arasında olmalı.");
    var ikramiye = Number(g.ikramiye) || 0;
    var aylar = oncekiAylar(g.baslangic).map(function (a, i) {
      var anahtar = a.yil + "-" + (a.ay < 10 ? "0" : "") + a.ay;
      var calisti = i >= 12 - calisilanAy;
      var brut = !calisti ? 0 : (zam && anahtar < zam ? once : simdi);
      var P = null, d = null;
      try { P = B.parametre(a.yil); d = B.donem(P, a.ay); } catch (e) { /* parametre yok */ }
      if (calisti && !d) throw new Error(a.yil + " yılının bordro parametreleri yok; rapor başlangıcını ileri bir tarihe alın.");
      var pek = !calisti ? 0 : Math.min(Math.max(brut, d.asgariBrut), d.sgkTavan);
      return { yil: a.yil, ay: a.ay, anahtar: anahtar, brut: brut, pek: pek, gun: calisti ? 30 : 0 };
    });
    var toplam = aylar.reduce(function (t, a) { return t + a.pek; }, 0);
    var gun = aylar.reduce(function (t, a) { return t + a.gun; }, 0);
    /* İkramiye son ayın kazancına eklenir, o ayın tavanıyla sınırlı. */
    if (ikramiye > 0 && gun > 0) {
      var son = aylar[aylar.length - 1], d2 = B.donem(B.parametre(son.yil), son.ay);
      var eklenen = Math.max(0, Math.min(son.pek + ikramiye, d2.sgkTavan) - son.pek);
      son.ikramiye = eklenen; toplam += eklenen;
    }
    return { aylar: aylar, kazanc: kurus(toplam), gun: gun, ikramiye: ikramiye > 0 ? ikramiye : 0,
             ucretToplami: kurus(toplam - (ikramiye > 0 && gun > 0 ? aylar[aylar.length - 1].ikramiye : 0)) };
  }

  /* --------------------------------------------- günlük kazanç ----
     g.kazanc: önceki 12 ayın PEK toplamı; g.gun: bunlara esas prim günü;
     g.ucretToplami (isteğe bağlı): ikramiye hariç ücret — varsa %50 sınırı. */
  function gunlukKazanc(g, sinir) {
    var k = Number(g.kazanc), n = Number(g.gun);
    if (!(k >= 0) || !(n >= 0) || n > 360) throw new Error("Son 12 ayın kazancı ve prim günü (en çok 360) girilmeli.");
    var adim = [];
    var gk = n > 0 ? k / n : 0;
    adim.push({ ad: "12 ay kazanç ÷ prim günü", deger: gk });
    if (g.ucretToplami != null && g.ucretToplami < k && n > 0) {
      var tavan = g.ucretToplami / n * IKRAMIYE_KAT;
      if (gk > tavan) { gk = tavan; adim.push({ ad: "İkramiye sınırı (ücretin %50 fazlası)", deger: gk }); }
    }
    if (n < DUSUK_PRIM_ESIGI) {
      var ust = sinir.gunlukAlt * DUSUK_PRIM_KAT;
      if (gk > ust) { gk = ust; adim.push({ ad: "180 günden az prim: alt sınırın 2 katı", deger: gk }); }
    }
    if (gk < sinir.gunlukAlt) { gk = sinir.gunlukAlt; adim.push({ ad: "Günlük alt sınır", deger: gk }); }
    return { deger: gk, adim: adim };
  }

  /* --------------------------------------------- ana hesap ---------- */
  function hesapla(g) {
    if (!TURLER[g.tur]) throw new Error("Rapor türünü seçin.");
    if (!tarihGecerli(g.baslangic)) throw new Error(g.tur === "analik" ? "Doğum tarihini girin." : "Rapor başlangıç tarihini girin.");
    var sinir = sinirlar(g.baslangic);
    if (!sinir) throw new Error(g.baslangic.slice(0, 4) + " yılının bordro parametreleri yok.");
    var n = Number(g.gun);
    var gk = gunlukKazanc(g, sinir);

    /* Hak şartı. */
    var sart = null, uygun = true, neden = "";
    if (g.tur === "hastalik" || g.tur === "analik") {
      sart = g.tur === "hastalik" ? HASTALIK_PRIM_SARTI : ANALIK_PRIM_SARTI;
      if (n < sart) { uygun = false; neden = "Önceki bir yılda " + sart + " gün kısa vadeli prim şartı dolmuyor (" + n + " gün)."; }
    }

    /* Ödenecek günler: segmentler sırasıyla. */
    var segmentler;
    if (g.tur === "analik") {
      var once = (g.cogul ? ANALIK.onceCogul : ANALIK.once) * 7, sonra = ANALIK.sonra * 7;
      segmentler = [{ ad: "Doğumdan önce", gun: once, yatarak: false, bas: gunEkle(g.baslangic, -once) },
                    { ad: "Doğumdan sonra", gun: sonra, yatarak: false, bas: g.baslangic }];
    } else {
      var ayakta = Math.round(Number(g.ayaktaGun) || 0), yatarak = Math.round(Number(g.yatarakGun) || 0);
      if (ayakta < 0 || yatarak < 0 || ayakta + yatarak < 1) throw new Error("Rapor gün sayısı girin.");
      if (ayakta + yatarak > 730) throw new Error("Rapor süresi en çok 730 gün girilebilir.");
      var y = { ad: "Yatarak", gun: yatarak, yatarak: true }, a = { ad: "Ayakta", gun: ayakta, yatarak: false };
      segmentler = (g.ilkYatarak ? [y, a] : [a, y]).filter(function (s) { return s.gun > 0; });
      var t = g.baslangic;
      segmentler.forEach(function (s) { s.bas = t; t = gunEkle(t, s.gun); });
    }

    /* Hastalıkta ilk iki gün ödenmez: baştan düşülür. */
    var dus = g.tur === "hastalik" ? HASTALIK_ODENMEYEN : 0, odenmeyen = 0;
    var gunluk = [];
    segmentler.forEach(function (s) {
      for (var i = 0; i < s.gun; i++) {
        var tarih = gunEkle(s.bas, i);
        var odenir = uygun && !(dus > 0 && odenmeyen < dus);
        if (!odenir && uygun) odenmeyen++;
        /* Alt sınır yükseldiyse o günden itibaren yeni alt sınır (m.18/4). */
        var sg = sinirlar(tarih), taban = gk.deger, bilinmiyor = !sg;
        if (sg && taban < sg.gunlukAlt) taban = sg.gunlukAlt;
        var oran = s.yatarak ? ORAN.yatarak : ORAN.ayakta;
        gunluk.push({ tarih: tarih, segment: s.ad, yatarak: s.yatarak, odenir: odenir, gunlukKazanc: taban,
                      odenek: odenir ? taban * oran : 0, parametreYok: bilinmiyor });
      }
    });
    var toplam = gunluk.reduce(function (t, x) { return t + x.odenek; }, 0);
    var odenen = gunluk.filter(function (x) { return x.odenir; }).length;

    /* Takvim ayına göre dağılım (bordro etkisi için). */
    var aylar = {};
    gunluk.forEach(function (x) {
      var k = x.tarih.slice(0, 7);
      if (!aylar[k]) aylar[k] = { ay: k, raporGunu: 0, odenenGun: 0, odenek: 0 };
      aylar[k].raporGunu++; aylar[k].odenek += x.odenek; if (x.odenir) aylar[k].odenenGun++;
    });

    return {
      surum: SURUM, tur: g.tur, turAd: TURLER[g.tur], uygun: uygun, neden: neden, primSarti: sart,
      sinir: sinir, gunlukKazanc: gk.deger, kazancAdimlari: gk.adim,
      dusukPrim: n < DUSUK_PRIM_ESIGI,
      gunlukOdenek: { ayakta: gk.deger * ORAN.ayakta, yatarak: gk.deger * ORAN.yatarak },
      segmentler: segmentler.map(function (s) {
        var gs = gunluk.filter(function (x) { return x.segment === s.ad; });
        return { ad: s.ad, bas: s.bas, gun: s.gun, yatarak: s.yatarak, odenenGun: gs.filter(function (x) { return x.odenir; }).length,
                 odenek: kurus(gs.reduce(function (t, x) { return t + x.odenek; }, 0)) };
      }),
      raporGunu: gunluk.length, odenenGun: odenen, odenmeyenGun: g.tur === "hastalik" && uygun ? Math.min(dus, gunluk.length) : 0,
      bitis: gunluk.length ? gunluk[gunluk.length - 1].tarih : g.baslangic,
      toplam: kurus(toplam),
      parametreYok: gunluk.some(function (x) { return x.parametreYok; }),
      aylar: Object.keys(aylar).sort().map(function (k) { var a = aylar[k]; a.odenek = kurus(a.odenek); return a; })
    };
  }

  /* ---------------------------------------- raporlu ayın bordrosu ----
     İşveren rapor günlerinin ücretini öder mi?
       "kesilir"   ödemez: brüt = maaş × ücretli gün ÷ 30
       "ilkIkiGun" hastalıkta ödeneksiz ilk iki günü öder
       "tamamlar"  tam maaş öder, ödeneği SGK'dan kendisi alır (mahsup)
     Ayın tamamı raporluysa (28 günlük şubat dahil) ücretli gün sıfırdır;
     kısmi ayda bordro geleneği 30 gün üzerinden düşer.
     Her takvim yılı TEK hesapla kurulur: o yılın bütün raporlu ayları
     birlikte değişir, kümülatif vergi matrahı aylar boyunca taşınır. */
  function ayinGunu(yil, ay) { return new Date(Date.UTC(yil, ay, 0)).getUTCDate(); }
  function ucretliGunu(a, politika) {
    var yil = +a.ay.slice(0, 4), ay = +a.ay.slice(5, 7);
    if (politika === "tamamlar") return 30;
    var odenmeyen = a.raporGunu - a.odenenGun;
    var kesilen = politika === "ilkIkiGun" ? a.raporGunu - odenmeyen : a.raporGunu;
    if (kesilen >= ayinGunu(yil, ay)) return 0;
    return Math.max(0, 30 - Math.min(30, kesilen));
  }
  function bordroEtkisi(sonuc, g) {
    var brut = Number(g.aylikBrut);
    if (!(brut > 0)) throw new Error("Aylık brüt maaşı girin.");
    var politika = g.politika || "kesilir";
    var sec = g.secenekler || {};
    var yillar = {}, sira = [];
    sonuc.aylar.forEach(function (a) {
      var yil = +a.ay.slice(0, 4);
      if (!yillar[yil]) { yillar[yil] = []; sira.push(yil); }
      yillar[yil].push(a);
    });
    var aylar = [], ozet = [];
    sira.forEach(function (yil) {
      var P;
      try { P = B.parametre(yil); } catch (e) { P = null; }
      if (!P) {
        yillar[yil].forEach(function (a) { aylar.push({ ay: a.ay, hesaplanamadi: true, raporGunu: a.raporGunu, odenek: politika === "tamamlar" ? 0 : a.odenek }); });
        ozet.push({ yil: yil, hesaplanamadi: true });
        return;
      }
      var brutlar = [], gunler = [];
      for (var i = 1; i <= 12; i++) { brutlar.push(brut); gunler.push(30); }
      var normal = B.hesaplaYil(brutlar.slice(), yil, sec);
      var raporlu = {};
      yillar[yil].forEach(function (a) {
        var ay = +a.ay.slice(5, 7), u = ucretliGunu(a, politika);
        brutlar[ay - 1] = brut * u / 30; gunler[ay - 1] = u; raporlu[ay] = { a: a, u: u };
      });
      var rapor = B.hesaplaYil(brutlar, yil, Object.assign({}, sec, { gun: gunler }));
      var odenekYil = 0, raporAyNormal = 0, raporAyNet = 0;
      Object.keys(raporlu).map(Number).sort(function (x, y) { return x - y; }).forEach(function (ay) {
        var a = raporlu[ay].a, odenek = politika === "tamamlar" ? 0 : a.odenek;
        var nN = normal.aylar[ay - 1].net, nR = rapor.aylar[ay - 1].net;
        odenekYil += odenek; raporAyNormal += nN; raporAyNet += nR;
        aylar.push({
          ay: a.ay, raporGunu: a.raporGunu, ucretliGun: raporlu[ay].u,
          netNormal: kurus(nN), netMaas: kurus(nR), odenek: odenek,
          eleGecen: kurus(nR + odenek), fark: kurus(nR + odenek - nN)
        });
      });
      ozet.push({
        yil: yil, netNormal: kurus(normal.toplam.net), netRapor: kurus(rapor.toplam.net), odenek: kurus(odenekYil),
        fark: kurus(rapor.toplam.net + odenekYil - normal.toplam.net),
        raporAylariFarki: kurus(raporAyNet + odenekYil - raporAyNormal),
        sonrakiAylarVergi: kurus((rapor.toplam.net - raporAyNet) - (normal.toplam.net - raporAyNormal))
      });
    });
    return { politika: politika, aylar: aylar, yillar: ozet };
  }

  return {
    surum: SURUM, TURLER: TURLER, ORAN: ORAN, ANALIK: ANALIK,
    HASTALIK_PRIM_SARTI: HASTALIK_PRIM_SARTI, DUSUK_PRIM_ESIGI: DUSUK_PRIM_ESIGI,
    sinirlar: sinirlar, oncekiAylar: oncekiAylar, kazancTuret: kazancTuret, gunlukKazanc: gunlukKazanc,
    hesapla: hesapla, bordroEtkisi: bordroEtkisi
  };
});
