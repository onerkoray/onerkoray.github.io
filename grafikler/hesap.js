/*!
 * Grafikler sayfasının hesabı — seriler ve sayfadaki her rakam buradan çıkar.
 *
 * Tarayıcıda grafikleri, node'da sayfa üretecini (tools/grafikler-sayfa.js)
 * ve testi (grafikler/test.js) aynı fonksiyon besler. Sayfadaki bir rakam
 * elle yazılmaz; seri güncellenince metin de onunla birlikte değişir.
 *
 * Girdi : TufeSerisi (finans/tufe-serisi.js), GrafikVerisi
 *         (finans/grafik-verisi.js), Bordro (bordro/motor.js).
 *
 * Tanımlar (sayfada da açıkça yazılı):
 *   fiyat endeksi   Aralık 2004 = 100; her ay TÜFE aylık değişimiyle zincirlenir.
 *   reel faiz       Fisher: (1 + politika faizi) / (1 + yıllık TÜFE) − 1,
 *                   ay sonunda yürürlükteki faiz ile o ayın yıllık TÜFE'si.
 *   kur             ayın son iş günü TCMB döviz satış kuru.
 *   asgari ücret    resmî net (bekâr, çocuksuz); dolar karşılığı o ayın
 *                   son iş günü kuruyla, reel karşılığı son ayın fiyatlarıyla.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GrafikHesap = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function ayAdi(ay) {
    var p = ay.split("-");
    return AYLAR[+p[1] - 1] + " " + p[0];
  }

  function aySayisi(a, b) {           // a'dan b'ye kaç ay
    var x = a.split("-"), y = b.split("-");
    return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]);
  }

  function sonrakiAy(ay) {
    var p = ay.split("-"), y = +p[0], m = +p[1] + 1;
    if (m === 13) { y++; m = 1; }
    return y + "-" + (m < 10 ? "0" : "") + m;
  }

  /* ---- I. Fiyat seviyesi ------------------------------------------------ */
  function fiyatEndeksi(T) {
    var v = 100, seri = [];
    Object.keys(T.aylar).sort().forEach(function (ay) {
      v *= 1 + T.aylar[ay].aylik / 100;
      seri.push({ ay: ay, endeks: v, yillik: T.aylar[ay].yillik });
    });
    return seri;
  }

  /* Fiyatlar 200'ü, 400'ü, 800'ü... ilk geçtiği ay. */
  function ikiyeKatlanmalar(fiyat) {
    var esik = 200, onceki = "2004-12", liste = [];
    fiyat.forEach(function (n) {
      while (n.endeks >= esik) {
        liste.push({ ay: n.ay, esik: esik, sure: aySayisi(onceki, n.ay) });
        onceki = n.ay;
        esik *= 2;
      }
    });
    return liste;
  }

  /* ---- III. Politika faizi ve reel faiz -------------------------------- */
  function faizAylik(fiyat, kararlar) {
    var seri = [];
    var ilk = kararlar[0][0].slice(0, 7);
    fiyat.forEach(function (n) {
      if (n.ay < ilk) return;
      var ayinSonu = n.ay + "-31", faiz = null;
      for (var i = 0; i < kararlar.length; i++) {
        if (kararlar[i][0] <= ayinSonu) faiz = kararlar[i][1];
      }
      var reel = 100 * ((1 + faiz / 100) / (1 + n.yillik / 100) - 1);
      seri.push({ ay: n.ay, faiz: faiz, tufe: n.yillik, reel: reel });
    });
    return seri;
  }

  function negatifDonemler(faiz) {
    var donem = [], acik = null;
    faiz.forEach(function (n) {
      if (n.reel < 0) {
        if (!acik) { acik = { bas: n.ay, son: n.ay, ay: 0, dip: n }; donem.push(acik); }
        acik.son = n.ay; acik.ay++;
        if (n.reel < acik.dip.reel) acik.dip = n;
      } else acik = null;
    });
    return donem;
  }

  /* ---- IV. Kur ve fiyatlar ---------------------------------------------- */
  function kurSerisi(fiyat, kur) {
    var tufeTaban = null, usdTaban = null, eurTaban = null, seri = [];
    fiyat.forEach(function (n) {
      var k = kur[n.ay];
      if (!k) return;
      if (tufeTaban === null) { tufeTaban = n.endeks; usdTaban = k.USD; eurTaban = k.EUR; }
      seri.push({
        ay: n.ay, usd: k.USD, eur: k.EUR,
        usdEndeks: 100 * k.USD / usdTaban,
        eurEndeks: 100 * k.EUR / eurTaban,
        tufeEndeks: 100 * n.endeks / tufeTaban
      });
    });
    return seri;
  }

  /* ---- V. Asgari ücret -------------------------------------------------- */
  function asgariSerisi(fiyat, kur, Bordro) {
    var endeks = {};
    fiyat.forEach(function (n) { endeks[n.ay] = n.endeks; });
    var sonAy = fiyat[fiyat.length - 1].ay;
    var seri = [];
    for (var ay = "2020-01"; ay <= sonAy; ay = sonrakiAy(ay)) {
      if (!kur[ay]) break;
      var yil = +ay.slice(0, 4), m = +ay.slice(5, 7);
      var donem = null;
      Bordro.parametre(yil).donemler.forEach(function (d) { if (d.ay <= m) donem = d; });
      var net = donem.asgariNet;
      seri.push({
        ay: ay, net: net, brut: donem.asgariBrut,
        reel: net * endeks[sonAy] / endeks[ay],
        usd: net / kur[ay].USD
      });
    }
    return seri;
  }

  /* ---- VI. Dünya -------------------------------------------------------- */
  function dunyaSiralama(G) {
    var ortak = null;
    G.ulkeler.forEach(function (u) {
      var yillar = Object.keys(G.dunya[u[0]]);
      ortak = ortak === null ? yillar : ortak.filter(function (y) { return yillar.indexOf(y) >= 0; });
    });
    var yil = ortak.sort()[ortak.length - 1];
    var liste = G.ulkeler.map(function (u) {
      return { kod: u[0], ad: u[1], deger: G.dunya[u[0]][yil] };
    }).sort(function (a, b) { return b.deger - a.deger; });
    liste.forEach(function (x, i) { x.sira = i + 1; });
    var degerler = liste.map(function (x) { return x.deger; }).sort(function (a, b) { return a - b; });
    var n = degerler.length;
    var ortanca = n % 2 ? degerler[(n - 1) / 2] : (degerler[n / 2 - 1] + degerler[n / 2]) / 2;
    return { yil: yil, liste: liste, ortanca: ortanca };
  }

  function dunyaSerileri(G, kodlar) {
    return kodlar.map(function (kod) {
      var ad = G.ulkeler.filter(function (u) { return u[0] === kod; })[0][1];
      var d = G.dunya[kod];
      return { kod: kod, ad: ad, nokta: Object.keys(d).sort().map(function (y) { return { yil: +y, deger: d[y] }; }) };
    });
  }

  /* ---- Zaman makinesi: seçilen ayın 100 TL'si ve doları bugün ------------ */
  function zamanMakinesi(r, ay) {
    var f = r.fiyat, son = f[f.length - 1], n = null, k = null, ks = r.kur[r.kur.length - 1];
    f.forEach(function (x) { if (x.ay === ay) n = x; });
    r.kur.forEach(function (x) { if (x.ay === ay) k = x; });
    if (!n) return null;
    return {
      ay: ay, sonAy: son.ay,
      sepet: 100 * son.endeks / n.endeks,
      kat: son.endeks / n.endeks,
      usdOnce: k ? k.usd : null, usdSon: ks.usd, kurAy: ks.ay,
      usdKat: k ? ks.usd / k.usd : null
    };
  }

  /* ---- Hepsi ------------------------------------------------------------ */
  function hesapla(T, G, Bordro) {
    var fiyat = fiyatEndeksi(T);
    var son = fiyat[fiyat.length - 1];
    var katlar = ikiyeKatlanmalar(fiyat);
    var tepe = fiyat.reduce(function (a, b) { return b.yillik > a.yillik ? b : a; });

    var faiz = faizAylik(fiyat, G.politikaFaizi);
    var faizSon = faiz[faiz.length - 1];
    var sonKarar = G.politikaFaizi[G.politikaFaizi.length - 1];
    var negatif = negatifDonemler(faiz);
    var enUzun = negatif.reduce(function (a, b) { return b.ay > a.ay ? b : a; });
    var dip = faiz.reduce(function (a, b) { return b.reel < a.reel ? b : a; });
    var negatifAy = faiz.filter(function (n) { return n.reel < 0; }).length;

    var kur = kurSerisi(fiyat, G.kur);
    var kurSon = kur[kur.length - 1], kurIlk = kur[0];

    var asgari = asgariSerisi(fiyat, G.kur, Bordro);
    var usdTepe = asgari.reduce(function (a, b) { return b.usd > a.usd ? b : a; });
    var usdDip = asgari.reduce(function (a, b) { return b.usd < a.usd ? b : a; });
    var reelTepe = asgari.reduce(function (a, b) { return b.reel > a.reel ? b : a; });
    var reelDip = asgari.reduce(function (a, b) { return b.reel < a.reel ? b : a; });
    var asgariSon = asgari[asgari.length - 1];

    var bant = fiyat.filter(function (n) { return n.ay < "2018-01"; });
    var bantIci = bant.filter(function (n) { return n.yillik >= 6 && n.yillik <= 12; }).length;
    var tepe2018 = fiyat.filter(function (n) { return n.ay.slice(0, 4) === "2018"; })
      .reduce(function (a, b) { return b.yillik > a.yillik ? b : a; });
    // Son zam dönemi: net tutarın son değiştiği ay; o aydan bu yana alım gücü
    var donemBas = asgari[0];
    asgari.forEach(function (n, i) { if (i && n.net !== asgari[i - 1].net) donemBas = n; });

    var siralama = dunyaSiralama(G);
    var tur = siralama.liste.filter(function (x) { return x.kod === "TUR"; })[0];

    return {
      sonAy: son.ay,
      fiyat: fiyat,
      katlar: katlar,
      faiz: faiz,
      kur: kur,
      asgari: asgari,
      siralama: siralama,
      dunya: dunyaSerileri(G, ["TUR", "ARG", "BRA", "RUS", "USA", "EMU"]),
      ozet: {
        fiyatKat: son.endeks / 100,
        sonTufe: son.yillik,
        tepeTufe: { ay: tepe.ay, deger: tepe.yillik },
        katSayisi: katlar.length,
        sonKatlanma: katlar[katlar.length - 1],
        ilkKatlanma: katlar[0],

        faiz: faizSon.faiz,
        faizTarih: sonKarar[0],
        reelSon: faizSon.reel,
        reelFaizDip: { ay: dip.ay, deger: dip.reel, faiz: dip.faiz, tufe: dip.tufe },
        negatifAy: negatifAy,
        faizAySayisi: faiz.length,
        enUzunNegatif: { bas: enUzun.bas, son: enUzun.son, ay: enUzun.ay },

        usdIlk: kurIlk.usd, usdSon: kurSon.usd, kurAy: kurSon.ay,
        usdKat: kurSon.usd / kurIlk.usd,
        tufeKatKur: kurSon.tufeEndeks / 100,

        asgariSon: { ay: asgariSon.ay, net: asgariSon.net, usd: asgariSon.usd, reel: asgariSon.reel },
        usdTepe: { ay: usdTepe.ay, usd: usdTepe.usd },
        usdDip: { ay: usdDip.ay, usd: usdDip.usd },
        reelTepe: { ay: reelTepe.ay, reel: reelTepe.reel },
        reelDip: { ay: reelDip.ay, reel: reelDip.reel },

        bantAy: bant.length, bantIci: bantIci,
        tepe2018: { ay: tepe2018.ay, deger: tepe2018.yillik },
        donemBas: { ay: donemBas.ay, reel: donemBas.reel, usd: donemBas.usd },
        donemErime: 1 - asgariSon.reel / donemBas.reel,

        dunyaYil: siralama.yil,
        turSira: tur.sira, turDeger: tur.deger,
        ulkeSayisi: siralama.liste.length,
        ortanca: siralama.ortanca,
        birinci: siralama.liste[0]
      }
    };
  }

  return {
    hesapla: hesapla,
    zamanMakinesi: zamanMakinesi,
    ayAdi: ayAdi,
    aySayisi: aySayisi,
    fiyatEndeksi: fiyatEndeksi,
    ikiyeKatlanmalar: ikiyeKatlanmalar,
    faizAylik: faizAylik,
    kurSerisi: kurSerisi,
    asgariSerisi: asgariSerisi,
    dunyaSiralama: dunyaSiralama
  };
});
