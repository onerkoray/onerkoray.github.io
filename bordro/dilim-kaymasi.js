/*!
 * Dilim kayması hesabı — tarife bir ölçütle endekslenseydi ne olurdu?
 *
 * "Endekslemenin Aritmetiği" çalışmasının (Öner 2026, Zenodo,
 * doi:10.5281/zenodo.22818390) yöntemini tek bir ücrete uygular. Çalışma
 * soruyu tarife düzeyinde soruyor: eşikler enflasyonla büyüdü mü? Bu modül
 * aynı soruyu bir kişinin bordrosunda soruyor: büyüseydi bu ücretten yılda
 * kaç lira daha az ya da fazla gelir vergisi kesilirdi?
 *
 * YÖNTEM
 * ------
 * Karşı-olgusal tarife: başlangıç yılının eşikleri, seçilen ölçütün o yıldan
 * bu yıla birikmiş artışıyla büyütülür. Yuvarlanmaz: yasal ölçütte bu,
 * yeniden değerleme yazısının "kesir atılmasaydı" hesabıyla (ydo.js,
 * fazlaVergi) kuruşu kuruşuna aynı sonucu verir ve test bunu sınar.
 * Oranlar değişmez. Sonra yılın 12 aylık bordrosu İKİ KEZ, aynı motorla hesaplanır:
 * gerçek tarifeyle ve karşı-olgusal tarifeyle. Fark yalnızca eşiklerden
 * gelir; asgari ücret, prim, damga ve istisna tekniği aynı kalır.
 *
 * Asgari ücret istisnası da karşı-olgusal tarifeyle hesaplanır, çünkü
 * kanunda istisna aynı tarifenin asgari ücret matrahına uygulanmasıyla
 * bulunuyor. Çalışmanın nötrleştirme önermesi buradan doğuyor: asgari
 * ücretin yıllık matrahının altındaki bir eşiği kaydırmak, asgari ücret
 * üstü bir ücretlinin vergisini TAM OLARAK değiştirmez. Modül bunu varsaymaz;
 * eşik eşik ayrıştırmada ölçer.
 *
 * ÜÇ ÖLÇÜT
 * --------
 *   ydo    — yeniden değerleme oranı, kesirsiz. Tarife kanunen bu orana
 *            bağlı; ama GVK mükerrer 123 oranla bulunan tutarın %5'e kadar
 *            kesrini atmaya izin veriyor ve 2022–2026'da her eşik biraz
 *            aşağı yuvarlandı. Bu ölçütteki fark, o yuvarlamanın bedelidir;
 *            bir kanun ihlali değil.
 *   tufe   — tüketici enflasyonu, önceki yılın Aralık–Aralık değişimi
 *   asgari — asgari ücretin ocaktan ocağa artışı
 * Hangisinin "doğru" olduğu bir tercih; modül üçünü de hesaplar ve hiçbirini
 * gizlemez. Seriler finans/endeksleme-serileri.js'ten, tarife ve asgari
 * ücret bordro/parametreler.js'ten gelir. Bu dosyada yasal sayı yoktur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/dilim-kaymasi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("./motor.js"),
      require("../finans/endeksleme-serileri.js"));
  } else {
    kok.DilimKaymasi = fabrika(kok.Bordro, kok.EndekslemeSerileri);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, S) {
  "use strict";

  var OLCUTLER = [
    { kod: "ydo", ad: "Yeniden değerleme oranı", kisa: "Yasal ölçüt, kesirsiz",
      aciklama: "Tarifenin kanunen bağlı olduğu oran, kanunun izin verdiği aşağı yuvarlama yapılmadan uygulanmış hâli." },
    { kod: "tufe", ad: "Tüketici enflasyonu", kisa: "TÜFE",
      aciklama: "Önceki yılın Aralık–Aralık tüketici fiyatları artışı. Klasik dilim kayması tanımı." },
    { kod: "asgari", ad: "Asgari ücret artışı", kisa: "Asgari ücret",
      aciklama: "Brüt asgari ücretin ocaktan ocağa artışı. Tarifenin ücretler karşısındaki konumu." }
  ];
  function olcut(kod) {
    for (var i = 0; i < OLCUTLER.length; i++) if (OLCUTLER[i].kod === kod) return OLCUTLER[i];
    throw new Error("Bilinmeyen ölçüt: " + kod);
  }

  function ocakAsgari(yil) { return B.donem(B.parametre(yil), 1).asgariBrut; }

  /* Yılın tarifesine uygulanan tek yıllık artış (kesir). Seri o yıl için
     tanımlı değilse null: tahmin edilmez. */
  function artis(kod, yil) {
    if (kod === "asgari") {
      try { return ocakAsgari(yil) / ocakAsgari(yil - 1) - 1; } catch (e) { return null; }
    }
    var s = S.SERI[yil];
    if (!s) return null;
    return (kod === "tufe" ? s.tufe : s.ydo) / 100;
  }

  /* Başlangıç yılından (hariç) hedef yıla (dahil) birikmiş çarpan. */
  function katsayi(kod, baz, yil) {
    var k = 1;
    for (var y = baz + 1; y <= yil; y++) {
      var a = artis(kod, y);
      if (a === null) return null;
      k *= 1 + a;
    }
    return k;
  }

  /* Hesaplanabilen yıllar: serinin kapsadığı ve en az bir başlangıç yılı
     olan yıllar. Başlangıç yılları 2022'den (asgari ücret istisnası
     rejiminin ilk yılı) başlar; çalışmanın dönemi de bu. */
  var ILK_BAZ = 2022;
  function yillar() {
    return S.YILLAR.filter(function (y) {
      if (y <= ILK_BAZ) return false;
      try { B.parametre(y); return true; } catch (e) { return false; }
    });
  }
  function bazYillari(yil) {
    var out = [];
    for (var b = ILK_BAZ; b < yil; b++) out.push(b);
    return out;
  }

  function dilimler(kod, baz, yil) {
    var k = katsayi(kod, baz, yil);
    if (k === null) throw new Error(yil + " için " + olcut(kod).ad + " serisi tanımlı değil.");
    return B.parametre(baz).dilimler.map(function (d) {
      return [d[0] === null ? null : d[0] * k, d[1]];
    });
  }

  /* Parametre kopyası: yalnız tarife değişir. Sığ kopya yeter, çünkü motor
     parametreleri değiştirmez, yalnızca okur. */
  function tarifeli(P, dil) {
    var Q = {};
    for (var k in P) if (Object.prototype.hasOwnProperty.call(P, k)) Q[k] = P[k];
    Q.dilimler = dil;
    return Q;
  }

  /* 12 aylık bordro, verilen parametreyle. Motorun hesaplaYil'iyle aynı
     döngü; tek farkı parametrenin dışarıdan gelmesi. */
  function yil12(brut, P) {
    var birikim = { matrah: 0, asgariMatrah: 0 }, aylar = [];
    var t = { gelirVergisi: 0, net: 0, istisna: 0, vergiTarife: 0 };
    for (var ay = 1; ay <= 12; ay++) {
      var a = B.hesaplaAy(brut, ay, P, birikim);
      aylar.push(a);
      t.gelirVergisi += a.gelirVergisi; t.net += a.net;
      t.istisna += a.istisna; t.vergiTarife += a.vergiTarife;
    }
    return { aylar: aylar, toplam: t };
  }

  /* Her dilime ilk girilen ay (1–12) ya da null. */
  function dilimAylari(aylar, dil) {
    return dil.map(function (d) {
      for (var i = 0; i < aylar.length; i++) if (aylar[i].dilim >= d[1] - 1e-12) return i + 1;
      return null;
    });
  }

  function dogrula(g) {
    var brut = Number(g.brut);
    if (!isFinite(brut) || brut <= 0) throw new Error("Aylık brüt ücret pozitif bir sayı olmalı.");
    var yil = Number(g.yil), baz = Number(g.baz);
    if (yillar().indexOf(yil) === -1) throw new Error(yil + " yılı hesaplanamıyor; seriler " + yillar().join(", ") + " için tanımlı.");
    if (bazYillari(yil).indexOf(baz) === -1) throw new Error("Başlangıç yılı " + ILK_BAZ + " ile " + (yil - 1) + " arasında olmalı.");
    olcut(g.olcut);
    return { brut: brut, yil: yil, baz: baz, olcut: g.olcut };
  }

  /* Ana hesap. fark > 0: tarife ölçütün gerisinde kaldı, fazla vergi.
     fark < 0: tarife ölçütten hızlı büyüdü, daha az vergi. */
  function hesapla(girdi) {
    var g = dogrula(girdi);
    var P = B.parametre(g.yil);
    var karsiDil = dilimler(g.olcut, g.baz, g.yil);
    var gercek = yil12(g.brut, P);
    var karsi = yil12(g.brut, tarifeli(P, karsiDil));
    var fark = gercek.toplam.gelirVergisi - karsi.toplam.gelirVergisi;

    /* Eşik eşik ayrıştırma: her seferinde YALNIZ bir eşik karşı-olgusal
       değerine taşınır. Tarife parçalı doğrusal olduğu için katkılar
       toplanabilir; toplamın farka eşitliği testte ölçülüyor. */
    var esikler = [];
    for (var j = 0; j < P.dilimler.length; j++) {
      if (P.dilimler[j][0] === null) continue;
      var tek = P.dilimler.map(function (d, i) { return i === j ? [karsiDil[j][0], d[1]] : d; });
      var r = yil12(g.brut, tarifeli(P, tek));
      esikler.push({
        sira: j + 1,
        gercek: P.dilimler[j][0],
        karsi: karsiDil[j][0],
        ustOran: P.dilimler[j + 1][1],
        katki: gercek.toplam.gelirVergisi - r.toplam.gelirVergisi
      });
    }

    return {
      girdi: g,
      olcut: olcut(g.olcut),
      katsayi: katsayi(g.olcut, g.baz, g.yil),
      tarifeArtisi: P.dilimler[1][0] / B.parametre(g.baz).dilimler[1][0],
      gercek: gercek, karsi: karsi,
      gercekDilimler: P.dilimler, karsiDilimler: karsiDil,
      gercekAylar: dilimAylari(gercek.aylar, P.dilimler),
      karsiAylar: dilimAylari(karsi.aylar, karsiDil),
      fark: fark,
      aylikFark: fark / 12,
      esikler: esikler
    };
  }

  /* Bütün başlangıç yılları × bütün ölçütler. Sonucun seçime ne kadar
     bağlı olduğunu tek bakışta gösterir. */
  function matris(brut, yil) {
    return bazYillari(yil).map(function (baz) {
      return {
        baz: baz,
        olcutler: OLCUTLER.map(function (o) {
          return { kod: o.kod, fark: hesapla({ brut: brut, yil: yil, baz: baz, olcut: o.kod }).fark };
        })
      };
    });
  }

  /* Ücret ekseninde fark. Grafik için; yalnız toplamı hesaplar. */
  function tarama(yil, baz, kod, brutler) {
    var P = B.parametre(yil), Q = tarifeli(P, dilimler(kod, baz, yil));
    return brutler.map(function (b) {
      return { brut: b, fark: yil12(b, P).toplam.gelirVergisi - yil12(b, Q).toplam.gelirVergisi };
    });
  }

  return {
    surum: "1.0.0",
    OLCUTLER: OLCUTLER,
    ILK_BAZ: ILK_BAZ,
    olcut: olcut,
    artis: artis,
    katsayi: katsayi,
    yillar: yillar,
    bazYillari: bazYillari,
    dilimler: dilimler,
    hesapla: hesapla,
    matris: matris,
    tarama: tarama,
    asgariBrut: function (yil) { return ocakAsgari(yil); }
  };
});
