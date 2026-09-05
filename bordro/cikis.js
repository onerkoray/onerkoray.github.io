/*!
 * Çıkış Paketi Motoru — iş sözleşmesi sona erdiğinde doğan hakların tamamı
 * ve bunların takvimi. bordro/motor.js üzerine kurulur.
 *
 * Kapsam: kıdem tazminatı, ihbar tazminatı, kullanılmayan yıllık izin ücreti,
 * son ay ücreti ve işsizlik ödeneği — fesih türüne göre hak matrisiyle birlikte.
 *
 * Tasarım notu: hangi fesih türünde hangi hakkın doğduğu bir "if" zinciri değil,
 * FESIH_TURLERI tablosudur. Böylece aynı tablo hem hesapta hem sayfada
 * (görünür hak matrisi olarak) kullanılır ve ikisi asla ayrışmaz.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/bordro/
 */
(function (root, factory) {
  "use strict";
  var Bordro = (typeof module === "object" && module.exports)
    ? require("./motor.js")
    : root.Bordro;
  var v = factory(Bordro);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.BordroCikis = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  /* ---------- fesih türleri ve hak matrisi ----------
     kidem/ihbar/issizlik: true | false | "sozlesme" (tarafların anlaşmasına bağlı)
     ihbar sütunu "işçiye ihbar tazminatı ödenir mi" sorusunun cevabıdır. */
  var FESIH_TURLERI = [
    {
      kod: "isveren",
      ad: "İşveren feshetti (haklı neden dışında)",
      kisa: "İşveren feshi",
      kidem: true, ihbar: true, issizlik: true,
      aciklama: "Performans, ekonomik gerekçe, yeniden yapılanma gibi geçerli nedenlerle ya da hiçbir gerekçe gösterilmeden yapılan fesih. En geniş hak doğuran türdür.",
      dayanak: "4857 sayılı İş Kanunu m.17-18"
    },
    {
      kod: "isverenHakli",
      ad: "İşveren haklı nedenle feshetti (ahlak ve iyi niyete aykırılık)",
      kisa: "İşverenin haklı feshi",
      kidem: false, ihbar: false, issizlik: false,
      aciklama: "Devamsızlık, güveni kötüye kullanma, işverene hakaret gibi hâllerde yapılan derhal fesih. Kıdem ve ihbar doğmaz; işsizlik ödeneği de bağlanmaz.",
      dayanak: "4857 m.25/II"
    },
    {
      kod: "isverenSaglikZorlayici",
      ad: "İşveren sağlık veya zorlayıcı sebeple feshetti",
      kisa: "Sağlık / zorlayıcı sebep",
      kidem: true, ihbar: false, issizlik: true,
      aciklama: "İşçinin hastalığı veya işyerinde bir haftadan uzun süren zorlayıcı sebep nedeniyle yapılan derhal fesih. Kıdem ödenir, ihbar ödenmez.",
      dayanak: "4857 m.25/I ve m.25/III"
    },
    {
      kod: "istifa",
      ad: "İstifa ettim (haklı bir nedene dayanmadan)",
      kisa: "İstifa",
      kidem: false, ihbar: false, issizlik: false,
      aciklama: "Kendi isteğiyle ayrılma. Kıdem ve ihbar doğmaz; üstelik ihbar süresine uyulmazsa işçi işverene ihbar tazminatı ödemek zorunda kalabilir.",
      dayanak: "4857 m.17"
    },
    {
      kod: "isciHakli",
      ad: "Haklı nedenle ben feshettim (ödenmeyen ücret, mobbing, ağır kusur)",
      kisa: "İşçinin haklı feshi",
      kidem: true, ihbar: false, issizlik: true,
      aciklama: "Ücretin ödenmemesi, sigortasız çalıştırma, mobbing, iş şartlarının esaslı değişmesi gibi hâllerde işçinin derhal feshi. Kıdem doğar, ihbar doğmaz.",
      dayanak: "4857 m.24"
    },
    {
      kod: "emeklilik",
      ad: "Emekli oldum (yaşlılık aylığı bağlandı)",
      kisa: "Emeklilik",
      kidem: true, ihbar: false, issizlik: false,
      aciklama: "Yaşlılık aylığı bağlanması amacıyla ayrılma. Kıdem doğar; işsizlik ödeneği bağlanmaz.",
      dayanak: "1475 sayılı Kanun m.14"
    },
    {
      kod: "yasHaric",
      ad: "15 yıl + 3600 gün şartını doldurdum (yaş hariç)",
      kisa: "15 yıl + 3600 gün",
      kidem: true, ihbar: false, issizlik: false,
      aciklama: "Yaş dışındaki emeklilik şartlarını tamamlayanlar SGK yazısıyla ayrılıp kıdem tazminatı alabilir. İşsizlik ödeneği doğmaz.",
      dayanak: "1475 m.14/1-5"
    },
    {
      kod: "askerlik",
      ad: "Muvazzaf askerlik nedeniyle ayrıldım",
      kisa: "Askerlik",
      kidem: true, ihbar: false, issizlik: false,
      aciklama: "Muvazzaf askerlik hizmeti nedeniyle ayrılma kıdem tazminatı doğurur.",
      dayanak: "1475 m.14"
    },
    {
      kod: "evlilik",
      ad: "Evlilik nedeniyle ayrıldım (kadın işçi, evlilikten sonraki 1 yıl içinde)",
      kisa: "Evlilik",
      kidem: true, ihbar: false, issizlik: false,
      aciklama: "Kadın işçi, evlendiği tarihten itibaren bir yıl içinde ayrılırsa kıdem tazminatına hak kazanır. İşsizlik ödeneği doğmaz.",
      dayanak: "1475 m.14"
    },
    {
      kod: "olum",
      ad: "İşçinin ölümü",
      kisa: "Ölüm",
      kidem: true, ihbar: false, issizlik: false,
      aciklama: "Kıdem tazminatı yasal mirasçılara ödenir.",
      dayanak: "1475 m.14"
    },
    {
      kod: "ikale",
      ad: "İkale (karşılıklı anlaşmayla sona erdirme)",
      kisa: "İkale",
      kidem: "sozlesme", ihbar: "sozlesme", issizlik: false,
      aciklama: "Taraflar anlaşarak sözleşmeyi sona erdirir. Ödenecek tutarlar ikale sözleşmesinde ne kararlaştırıldığına bağlıdır; kural olarak işsizlik ödeneği bağlanmaz.",
      dayanak: "TBK m.26 sözleşme serbestisi"
    }
  ];

  function fesih(kod) {
    for (var i = 0; i < FESIH_TURLERI.length; i++) {
      if (FESIH_TURLERI[i].kod === kod) return FESIH_TURLERI[i];
    }
    throw new Error("Çıkış: bilinmeyen fesih türü — " + kod);
  }

  /* ---------- tarih yardımcıları ---------- */

  function tarih(s) {
    if (s instanceof Date) return s;
    var p = String(s).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function isoTarih(d) {
    function iki(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + iki(d.getMonth() + 1) + "-" + iki(d.getDate());
  }
  function gunEkle(d, n) {
    var y = new Date(d.getTime());
    y.setDate(y.getDate() + n);
    return y;
  }
  function ayEkle(d, n) {
    var y = new Date(d.getTime());
    y.setMonth(y.getMonth() + n);
    return y;
  }
  function gunFarki(a, b) {
    return Math.round((tarih(b) - tarih(a)) / 86400000);
  }

  /* Takvim bazlı hizmet süresi: yıl / ay / gün */
  function hizmetSuresi(giris, cikis) {
    var a = tarih(giris), b = tarih(cikis);
    var y = b.getFullYear() - a.getFullYear();
    var m = b.getMonth() - a.getMonth();
    var g = b.getDate() - a.getDate();
    if (g < 0) { m--; g += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { yil: y, ay: m, gun: g, toplamGun: gunFarki(a, b) };
  }

  /* ---------- yasal büyüklükler ---------- */

  /* Kıdem tavanı fesih tarihindeki altı aylık döneme göre belirlenir. */
  function kidemTavani(cikisTarihi) {
    var d = tarih(cikisTarihi);
    var P = B.parametreler[d.getFullYear()];
    if (!P || !P.kidemTavanlari) return null;   // o yıl için doğrulanmış veri yok
    var secili = P.kidemTavanlari[0];
    for (var i = 1; i < P.kidemTavanlari.length; i++) {
      if (P.kidemTavanlari[i].ay <= d.getMonth() + 1) secili = P.kidemTavanlari[i];
    }
    return secili.tutar;
  }

  /* İhbar süresi (hafta) — 4857 m.17 */
  function ihbarHaftasi(toplamGun) {
    var ay = toplamGun / 30.4375;
    if (ay < 6) return 2;
    if (ay < 18) return 4;
    if (ay < 36) return 6;
    return 8;
  }

  /* İşsizlik ödeneği gün sayısı — 4447 m.50 */
  function odenekGunu(primGunu, issizlik) {
    for (var i = 0; i < issizlik.sureler.length; i++) {
      if (primGunu >= issizlik.sureler[i][0]) return issizlik.sureler[i][1];
    }
    return 0;
  }

  /* Çıkış ayındaki kümülatif matraha karşılık gelen marjinal gelir vergisi oranı.
     İhbar tazminatı ve izin ücreti ücret sayıldığı için bu oranla vergilenir. */
  function marjinalOran(ciplakBrut, cikisTarihi) {
    var d = tarih(cikisTarihi);
    var sonuc = B.hesaplaYil(ciplakBrut, d.getFullYear());
    return sonuc.aylar[d.getMonth()].dilim;
  }

  /* ---------- ana hesap ---------- */

  function hesapla(g) {
    var cikisD = tarih(g.cikis);
    var yil = cikisD.getFullYear();
    var P = B.parametre(yil);
    var oranlar = P.oranlar;
    var tur = fesih(g.fesihTuru);

    var ciplak = Number(g.ciplakBrut) || 0;
    var ekler = Number(g.giydirmeEkleri) || 0;
    var giydirilmis = ciplak + ekler;

    var hizmet = hizmetSuresi(g.iseGiris, g.cikis);
    /* Marjinal oran normalde çıkış ayındaki kümülatif matrahtan türetilir. Bu,
       yıl başından beri aynı ücretle çalışıldığını varsayar; yıl içinde işe
       girmiş biri için sapabilir. g.marjinalOran verilirse o kullanılır. */
    var oran = (typeof g.marjinalOran === "number" && g.marjinalOran > 0)
      ? g.marjinalOran
      : marjinalOran(ciplak, g.cikis);
    var uyarilar = [];

    /* --- kıdem tazminatı --- */
    var kidem = { hak: false, gerekce: "", brut: 0, damga: 0, net: 0 };
    var birYilTamam = hizmet.toplamGun >= 365;
    var tavan = kidemTavani(g.cikis);

    if (tur.kidem === false) {
      kidem.gerekce = "Bu fesih türünde kıdem tazminatı doğmaz.";
    } else if (!birYilTamam) {
      kidem.gerekce = "En az 1 yıl çalışma şartı sağlanmıyor (" + hizmet.toplamGun + " gün).";
    } else if (tavan === null) {
      kidem.gerekce = yil + " yılı için doğrulanmış kıdem tavanı verisi yok.";
      uyarilar.push("Kıdem tavanı yalnızca 2025 ve 2026 fesihleri için tanımlı.");
    } else {
      kidem.hak = true;
      kidem.tavan = tavan;
      kidem.tavanUygulandi = giydirilmis > tavan;
      kidem.esasUcret = Math.min(giydirilmis, tavan);
      kidem.brut = kidem.esasUcret * (hizmet.toplamGun / 365);
      kidem.damga = kidem.brut * oranlar.damga;
      kidem.net = kidem.brut - kidem.damga;
      if (tur.kidem === "sozlesme") {
        kidem.gerekce = "İkalede tutar sözleşmeye bağlıdır; aşağıdaki rakam yasal karşılıktır.";
        uyarilar.push("İkale sözleşmesinde kararlaştırılan tutar bu hesaptan farklı olabilir.");
      }
    }

    /* --- ihbar tazminatı --- */
    var ihbar = { hak: false, gerekce: "", hafta: ihbarHaftasi(hizmet.toplamGun), brut: 0, gelirVergisi: 0, damga: 0, net: 0 };
    if (tur.ihbar === false) {
      ihbar.gerekce = tur.kod === "istifa"
        ? "İstifada işçiye ihbar tazminatı ödenmez; ihbar süresine uyulmazsa işçi işverene ödemek durumunda kalabilir."
        : "Bu fesih türünde işçiye ihbar tazminatı ödenmez.";
    } else if (g.ihbarSuresiCalisildi) {
      ihbar.gerekce = "İhbar süresi çalışılarak kullanıldığı için ayrıca tazminat ödenmez.";
    } else {
      ihbar.hak = true;
      ihbar.brut = (giydirilmis / 30) * 7 * ihbar.hafta;
      ihbar.gelirVergisi = ihbar.brut * oran;
      ihbar.damga = ihbar.brut * oranlar.damga;
      ihbar.net = ihbar.brut - ihbar.gelirVergisi - ihbar.damga;
      if (tur.ihbar === "sozlesme") {
        ihbar.gerekce = "İkalede ihbar tazminatı ödenip ödenmeyeceği sözleşmeye bağlıdır.";
      }
    }

    /* --- kullanılmayan yıllık izin ücreti ---
       Ücret sayılır: gelir ve damga vergisine tabidir, SGK primi kesilmez. */
    var izinGun = Number(g.kullanilmayanIzinGunu) || 0;
    var izin = { gun: izinGun, brut: 0, gelirVergisi: 0, damga: 0, net: 0 };
    if (izinGun > 0) {
      izin.brut = (ciplak / 30) * izinGun;
      izin.gelirVergisi = izin.brut * oran;
      izin.damga = izin.brut * oranlar.damga;
      izin.net = izin.brut - izin.gelirVergisi - izin.damga;
    }

    /* --- son ay ücreti (çalışılan gün kadar) --- */
    var sonAyGun = g.sonAyCalisilanGun === undefined ? cikisD.getDate() : Number(g.sonAyCalisilanGun);
    sonAyGun = Math.max(0, Math.min(30, sonAyGun));
    var tamAy = B.hesaplaYil(ciplak, yil).aylar[cikisD.getMonth()];
    var sonAy = {
      gun: sonAyGun,
      brut: ciplak * (sonAyGun / 30),
      net: tamAy.net * (sonAyGun / 30)
    };

    /* --- işsizlik ödeneği --- */
    var issizlikP = P.issizlik;
    var issizlik = { hak: false, gerekce: "", gun: 0, ay: 0, aylikBrut: 0, damga: 0, aylikNet: 0, toplam: 0 };
    var primGunu = Number(g.son3YilPrimGunu) || 0;
    var gun = odenekGunu(primGunu, issizlikP);

    if (tur.issizlik === false) {
      issizlik.gerekce = "İşsizlik ödeneği yalnızca kendi istek ve kusuru dışında işsiz kalanlara bağlanır.";
    } else if (gun === 0) {
      issizlik.gerekce = "Son 3 yılda en az 600 gün prim şartı sağlanmıyor (" + primGunu + " gün).";
    } else if (hizmet.toplamGun < 120) {
      issizlik.gerekce = "Fesihten önceki son 120 günde kesintisiz hizmet akdi şartı sağlanmıyor.";
    } else {
      var donem = B.donem(P, cikisD.getMonth() + 1);
      var esas = Math.min(Number(g.son4AyBrutOrtalama) || ciplak, donem.sgkTavan);
      var hamOdenek = esas * issizlikP.oran;
      var odenekTavani = donem.asgariBrut * issizlikP.tavanOrani;

      issizlik.hak = true;
      issizlik.gun = gun;
      issizlik.ay = gun / 30;
      issizlik.esasKazanc = esas;
      issizlik.hamOdenek = hamOdenek;
      issizlik.tavan = odenekTavani;
      issizlik.tavanUygulandi = hamOdenek > odenekTavani;
      issizlik.aylikBrut = Math.min(hamOdenek, odenekTavani);
      issizlik.damga = issizlik.aylikBrut * oranlar.damga;
      issizlik.aylikNet = issizlik.aylikBrut - issizlik.damga;
      issizlik.toplam = issizlik.aylikNet * issizlik.ay;
    }

    /* --- takvim --- */
    var cikisOdemesi = kidem.net + ihbar.net + izin.net + sonAy.net;
    var takvim = [{
      tarih: isoTarih(cikisD),
      olay: "İş sözleşmesi sona erer",
      detay: "Kıdem, ihbar, izin ücreti ve son ay ücreti bu tarihte muaccel olur.",
      tutar: cikisOdemesi
    }];

    if (issizlik.hak) {
      var basvuru = gunEkle(cikisD, 1);
      var sonBasvuru = gunEkle(cikisD, issizlikP.basvuruGunu);
      var ayAdedi = Math.round(issizlik.ay);

      takvim.push({
        tarih: isoTarih(sonBasvuru),
        olay: "İŞKUR başvurusu için son gün",
        detay: "Fesihten itibaren " + issizlikP.basvuruGunu +
          " gün içinde başvurulmazsa, gecikilen süre toplam ödenek süresinden düşülür.",
        tutar: 0
      });

      /* İŞKUR başvuruyu izleyen ayın sonuna kadar sonuçlandırır ve ödemeler
         her ayın 5'inde yapılır. Fesihten hemen sonra başvurulduğu varsayımıyla
         ilk ödeme, başvuru ayını izleyen ayın 5'idir. */
      var ilk = new Date(basvuru.getFullYear(), basvuru.getMonth() + 1, 5);
      issizlik.basvuruSonGun = isoTarih(sonBasvuru);
      issizlik.ilkOdeme = isoTarih(ilk);
      issizlik.sonOdeme = isoTarih(ayEkle(ilk, ayAdedi - 1));

      takvim.push({
        tarih: issizlik.ilkOdeme,
        olay: "İlk işsizlik ödeneği",
        detay: "Aylık net ödenek " + ayAdedi + " ay boyunca ayın 5'inde yatar (yaklaşık tarih).",
        tutar: issizlik.aylikNet
      });
      takvim.push({
        tarih: issizlik.sonOdeme,
        olay: "Son işsizlik ödeneği",
        detay: ayAdedi + " aylık ödenek süresi burada dolar.",
        tutar: issizlik.aylikNet
      });
    }

    takvim.sort(function (a, b) { return a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0; });

    return {
      girdi: g,
      yil: yil,
      parametre: P,
      fesih: tur,
      hizmet: hizmet,
      giydirilmisBrut: giydirilmis,
      marjinalOran: oran,
      kidem: kidem,
      ihbar: ihbar,
      izin: izin,
      sonAy: sonAy,
      issizlik: issizlik,
      takvim: takvim,
      uyarilar: uyarilar,
      toplam: {
        cikisOdemesi: cikisOdemesi,
        issizlikToplam: issizlik.toplam,
        genelToplam: cikisOdemesi + issizlik.toplam
      }
    };
  }

  return {
    surum: "1.0.0",
    FESIH_TURLERI: FESIH_TURLERI,
    fesih: fesih,
    hizmetSuresi: hizmetSuresi,
    kidemTavani: kidemTavani,
    ihbarHaftasi: ihbarHaftasi,
    odenekGunu: odenekGunu,
    marjinalOran: marjinalOran,
    hesapla: hesapla
  };
});
