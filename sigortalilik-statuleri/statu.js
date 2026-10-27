/*!
 * Sigortalılık statüleri — 4/a, 4/b, 4/c ve isteğe bağlı sigorta çekirdeği
 *
 * Soru: kim hangi statüde sigortalıdır, hangi statüden hangi şartlarla
 * emekli olunur, prim nedir?
 *
 * KAYNAKLAR (mevzuat.gov.tr güncel metni ve Resmî Gazete'den okundu,
 * 27 Ekim 2026):
 *   5510 s.K. m.4   — statülerin kapsamı
 *   5510 s.K. m.28  — 2008 sonrası yaşlılık aylığı: 4/a 7200, 4/b ve 4/c
 *                     9000 gün; yaşa 3 yıl ekleyerek 5400 gün
 *   5510 s.K. m.50–52 — isteğe bağlı sigorta: şartlar, başlangıç, %33 prim
 *   5510 s.K. m.53  — statü çakışması: 4/c önce, 4/a ile 4/b'de 4/a;
 *                     2008 sonrası girişte en çok sigortalılığın geçtiği
 *                     statüden emekli olunur, eşitse sondan
 *   5510 s.K. m.108 — 4/a ve 4/b'de Geçici m.9 sınırı 30/4/2008; diğer
 *                     hükümler (4/c dahil) 2008 Ekim ayı başında
 *   5510 s.K. Geçici m.4 — 2008 öncesi memura 5434 hükümleri uygulanır
 *   5434 s.K. Geçici m.205 + 5510 Geçici m.95 — 8/9/1999 öncesi memur:
 *                     kadın 20, erkek 25 fiilî hizmet yılı, yaş aranmaz
 *   4447 s.K. m.23 (RG 8/9/1999, 23810) — mülga 5434 m.39'un yeni hâli:
 *                     25 fiilî hizmet yılı ve kadın 58, erkek 60 yaş; ya da
 *                     61 yaş ve 15 yıl
 *
 * 4/a ve 4/b şartları burada YENİDEN YAZILMAZ: "Ne zaman emekli olurum?"
 * motoru (ne-zaman-emekli-olurum/hesap.js) temsilî girdilerle çalıştırılır
 * ve yollar onun çıktısından okunur. 2008 sonrası 4/c, m.28'de 4/b ile aynı
 * gün sayılarına tabi olduğu için o da aynı motordan gelir.
 *
 * KAPSAM DIŞI (bu sürüm): 5. madde (çırak, stajyer, kursiyer), tarımda
 * 4/b, ev hizmetleri (Ek m.9), yurt dışı borçlanma, 2008 öncesi farklı
 * statülerin birleştirilmesi (mülga 2829), 4/c prim (kesenek) hesabı,
 * fiilî hizmet zammı, malullük.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/sigortalilik-statuleri/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("../ne-zaman-emekli-olurum/hesap.js"), require("../bordro/motor.js"),
      require("../bordro/sgk-prim.js"));
  } else {
    kok.Statuler = fabrika(kok.EmeklilikTarihi, kok.Bordro, kok.SgkPrim);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (E, B, S) {
  "use strict";

  var SURUM = "1.0.0";
  var EYT_SINIRI = E.sinirlar.eyt;          // 1999-09-08: bu tarih ve sonrası EYT dışı
  var GECIS_SONU_4AB = E.sinirlar.gecisSonu; // 2008-04-30: 5510 m.108/b
  var GECIS_SONU_4C = "2008-09-30";          // 5510 m.108/d: "Diğer hükümleri 2008 yılı Ekim ayı başında"

  /* ------------------------------------------------------- statüler */

  var STATULER = {
    "4a": {
      kod: "4a", ad: "4/a", eskiAd: "SSK", baslik: "Hizmet akdiyle çalışanlar",
      dayanak: "5510 s.K. m.4/1-a",
      ozet: "Bir ya da birden fazla işverene bağlı, ücret karşılığı çalışanlar.",
      kapsam: [
        "Özel sektörde ve kamuda hizmet akdiyle (iş sözleşmesiyle) çalışanlar",
        "İşçi sendikalarının yönetimine seçilenler",
        "Bir işverene bağlı çalışan sanatçılar, düşünürler ve yazarlar",
        "Hizmet akdiyle çalışan yabancılar (sözleşmeli ülke vatandaşları hariç)",
        "Kamu idarelerinde ders ücretiyle görev alanlar, usta öğreticiler ve 657 s.K. 4/C geçici personel",
        "İŞKUR toplum yararına program katılımcıları"
      ],
      kapsamDayanak: "5510 s.K. m.4/1-a ve m.4/2"
    },
    "4b": {
      kod: "4b", ad: "4/b", eskiAd: "Bağ-Kur", baslik: "Kendi adına bağımsız çalışanlar",
      dayanak: "5510 s.K. m.4/1-b",
      ozet: "Hizmet akdi olmadan, kendi adına ve hesabına çalışanlar.",
      kapsam: [
        "Ticari kazanç ya da serbest meslek kazancı nedeniyle gerçek veya basit usulde gelir vergisi mükellefi olanlar",
        "Gelir vergisinden muaf olup esnaf ve sanatkâr siciline kayıtlı olanlar",
        "Anonim şirketlerin yönetim kurulu üyesi ortakları, diğer şirketlerin tüm ortakları",
        "Tarımsal faaliyette bulunanlar",
        "Köy ve mahalle muhtarları",
        "6132 s.K.'ya tabi jokey ve antrenörler"
      ],
      kapsamDayanak: "5510 s.K. m.4/1-b ve m.4/3"
    },
    "4c": {
      kod: "4c", ad: "4/c", eskiAd: "Emekli Sandığı", baslik: "Kamu idarelerinde kadrolu ve sözleşmeli çalışanlar",
      dayanak: "5510 s.K. m.4/1-c",
      ozet: "Kamu idarelerinde kadroda ya da sözleşmeli çalışıp 4/a'ya tabi olmayanlar: memurlar.",
      kapsam: [
        "Kamu idarelerinde kadro ve pozisyonlarda sürekli çalışan memurlar",
        "657 s.K. 4/B sözleşmeli personel ve açıktan vekil atananlar",
        "Seçim ya da atamayla göreve gelip memur gibi emeklilik hakkı tanınanlar",
        "Cumhurbaşkanı yardımcıları, bakanlar, milletvekilleri ve belediye başkanları",
        "Harp okulu, polis ve jandarma okulu öğrencileri ile subay ve astsubay adayları"
      ],
      kapsamDayanak: "5510 s.K. m.4/1-c ve m.4/4"
    },
    "istege": {
      kod: "istege", ad: "İsteğe bağlı", eskiAd: null, baslik: "Kendi isteğiyle prim ödeyenler",
      dayanak: "5510 s.K. m.50",
      ozet: "Zorunlu sigortalı olmadan, uzun vadeli sigorta kollarına ve GSS'ye kendi isteğiyle prim ödeyenler.",
      kapsam: [
        "Türkiye'de ikamet etmek (ya da sözleşmesiz bir ülkede yaşayan Türk vatandaşı olmak)",
        "Zorunlu sigortalı olacak şekilde çalışmamak; ya da ay içinde 30 günden az veya tam gün çalışmamak",
        "Kendi sigortalılığından aylık almıyor olmak",
        "18 yaşını doldurmuş olmak",
        "SGK'ya isteğe bağlı sigorta dilekçesiyle başvurmak"
      ],
      kapsamDayanak: "5510 s.K. m.50/2"
    }
  };

  /* ------------------------------------------------------- dönemler */

  /* Statüye göre giriş dönemleri. 4/c'nin ikinci sınırı 4/a ve 4/b'den
     beş ay sonra: Geçici m.9 sınırı yalnız onlar için 30/4/2008. */
  function donemler(statu) {
    var son = statu === "4c" ? GECIS_SONU_4C : GECIS_SONU_4AB;
    return [
      { kod: "eyt", ad: "8 Eylül 1999'dan önce", bas: null, bit: gunOnce(EYT_SINIRI) },
      { kod: "gecis", ad: "8 Eylül 1999 – " + uzun(son), bas: EYT_SINIRI, bit: son },
      { kod: "yeni", ad: uzun(gunSonra(son)) + " ve sonrası", bas: gunSonra(son), bit: null }
    ];
  }

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function uzun(iso) { var p = iso.split("-"); return Number(p[2]) + " " + AYLAR[Number(p[1]) - 1] + " " + p[0]; }
  function gunOnce(iso) { return E.yardimci.ekle(iso, 0, 0, -1); }
  function gunSonra(iso) { return E.yardimci.ekle(iso, 0, 0, 1); }

  /* ------------------------------------------------------- şartlar */

  /* Temsilî girdi: dönemin içinde bir giriş, 18 yaş kuralına takılmayan
     doğum. Prim günü sıfır: yalnız şartların kendisi okunur, tarih değil. */
  var TEMSIL = { eyt: "1995-06-01", gecis: "2004-06-01", yeni: "2015-06-01" };
  var TEMSIL_BUGUN = "2026-01-01";

  function motordan(statu, cinsiyet, donem) {
    return E.hesapla({
      statu: statu, cinsiyet: cinsiyet, dogum: "1970-06-01", ilkGiris: TEMSIL[donem],
      primGun: 0, yillikGun: 360, bugun: TEMSIL_BUGUN
    }).yollar;
  }

  function kosulDuz(k) {
    var o = { ad: k.ad, tur: k.tur, gereken: k.gereken };
    if (k.tamYil) o.tamYil = k.tamYil;
    return o;
  }

  /* Dönem içinde değişen sayılar tek değer değil, aralık olarak verilir;
     aralığın uçları motorun kendi tablolarından okunur. */
  function aralik(dizi) {
    var min = Math.min.apply(null, dizi), max = Math.max.apply(null, dizi);
    return min === max ? min : { min: min, max: max };
  }

  function yollar4ab(statu, cinsiyet, donem) {
    var kadin = cinsiyet === "kadin";
    return motordan(statu, cinsiyet, donem).map(function (y) {
      var yol = { kod: y.kod, ad: y.ad, dayanak: y.dayanak, kismi: !!y.kismi, kosullar: y.kosullar.map(kosulDuz) };
      yol.kosullar.forEach(function (k) {
        if (donem === "eyt" && statu === "4a" && y.kod === "tam" && k.tur === "gun") {
          k.gereken = aralik(E.tablolar.b81[cinsiyet].satirlar.map(function (s) { return s[1]; }));
          k.not = "23 Mayıs 2002'deki sigortalılık süresine göre (506 s.K. Geçici m.81/B tablosu)";
        }
        if (donem === "eyt" && y.kod === "kismi" && k.tur === "yas") {
          k.gereken = statu === "4a"
            ? aralik(E.tablolar.c81.map(function (s) { return s[kadin ? 1 : 2]; }))
            : aralik(E.tablolar.kismi1479.map(function (s) { return s[kadin ? 1 : 2]; }));
          k.not = "Şartların tamamlandığı tarihe göre kademeli";
        }
        if (donem === "yeni" && k.tur === "yas") {
          var taban = E.yardimci.yas28(cinsiyet, TEMSIL_BUGUN);
          k.gereken = y.kod === "kismi" ? Math.min(65, taban + 3) : taban;
          k.not = "Gün şartı 1 Ocak 2036 ve sonrasında dolarsa yaş kademeli olarak 65'e çıkar (m.28/2-b)";
        }
        if (donem === "yeni" && statu === "4a" && y.kod === "kismi" && k.tur === "gun") {
          k.gereken = aralik([E.yardimci.kismiGun4a("2008-05-01"), E.yardimci.kismiGun4a("2030-01-01")]);
          k.not = "İlk giriş yılına göre (Geçici m.6/7-b)";
          yol.ad = "Yaşa 3 yıl eklenerek, " + sayi(k.gereken.min) + "–" + sayi(k.gereken.max) + " gün";
        }
      });
      /* Temsilî girdinin bendi (ör. "81/B-(m)") genel şarta yazılmaz. */
      if (donem === "eyt" && statu === "4a" && y.kod === "tam") yol.dayanak = y.dayanak.replace(/-\([^)]*\)/, "");
      return yol;
    });
  }

  function sayi(n) { return n.toLocaleString("tr-TR"); }
  function hizmet(n) { return { ad: "Fiilî hizmet süresi", tur: "sure", gereken: n }; }
  function yas(n, not) { var k = { ad: "Yaş", tur: "yas", gereken: n }; if (not) k.not = not; return k; }

  function yollar4c(cinsiyet, donem) {
    var kadin = cinsiyet === "kadin";
    if (donem === "eyt") {
      return [{ kod: "tam", ad: "Yaşa bakılmaksızın (EYT)", dayanak: "5434 s.K. Geçici m.205, 5510 s.K. Geçici m.95",
        kismi: false, kosullar: [hizmet(kadin ? 20 : 25)] }];
    }
    if (donem === "gecis") {
      return [
        { kod: "tam", ad: "Yaş ve 25 hizmet yılı", dayanak: "mülga 5434 s.K. m.39/b (4447 s.K. m.23 ile)",
          kismi: false, kosullar: [yas(kadin ? 58 : 60), hizmet(25)] },
        { kod: "kismi", ad: "61 yaş ve 15 hizmet yılı", dayanak: "mülga 5434 s.K. m.39/c-d (4447 s.K. m.23 ile)",
          kismi: true, kosullar: [yas(61), hizmet(15)] }
      ];
    }
    /* m.28/2: "en az 9000 gün ... Ancak (a) bendi için 7200" — 4/c, 4/b ile aynı. */
    return yollar4ab("4b", cinsiyet, "yeni");
  }

  function sartlar(statu, cinsiyet) {
    if (!STATULER[statu] || statu === "istege") throw new Error("Emeklilik şartı 4/a, 4/b ya da 4/c için verilir.");
    if (cinsiyet !== "kadin" && cinsiyet !== "erkek") throw new Error("Cinsiyet kadin ya da erkek olmalı.");
    return donemler(statu).map(function (d) {
      return { donem: d, yollar: statu === "4c" ? yollar4c(cinsiyet, d.kod) : yollar4ab(statu, cinsiyet, d.kod) };
    });
  }

  /* ------------------------------------------------------- prim */

  function yuvarla(x) { return Math.round(x * 1e6) / 1e6; }

  function prim(statu, yil) {
    var p = B.parametre(yil), s = S.sinirlar(yil), o = p.oranlar;
    if (statu === "4a") {
      return {
        yil: yil, kazancAlt: s.aylikAlt, kazancUst: s.aylikUst,
        isci: yuvarla(o.sgkIsci + o.issizlikIsci), isveren: yuvarla(o.sgkIsveren + o.issizlikIsveren),
        isverenIndirim: o.sgkIsverenIndirim, isverenIndirimImalat: o.sgkIsverenIndirimImalat,
        dayanak: "5510 s.K. m.81; 4447 s.K. m.49"
      };
    }
    if (statu === "4b") {
      var bk = S.bagkur(s.aylikAlt, yil);
      return { yil: yil, kazancAlt: s.aylikAlt, kazancUst: s.aylikUst, oran: bk.oran, indirimliOran: bk.indirimliOran,
        enAz: bk.prim, enAzIndirimli: bk.indirimli, enCok: S.bagkur(s.aylikUst, yil).prim, dayanak: "5510 s.K. m.81, m.82" };
    }
    if (statu === "istege") {
      var ib = S.istegeBagli(s.aylikAlt, yil);
      return { yil: yil, kazancAlt: s.aylikAlt, kazancUst: s.aylikUst, oran: ib.oran,
        enAz: ib.prim, enCok: S.istegeBagli(s.aylikUst, yil).prim, dayanak: "5510 s.K. m.52" };
    }
    return null; // 4/c kesenek ve kurum karşılığı bu sürümde hesaplanmıyor
  }

  /* ------------------------------------------------------- statü bulucu */

  /* Girdi: { faaliyet: ["ucretli", "bagimsiz", "kamu"], kamu: "kadro"|"sozlesmeli"|"isci"|"gecici",
     yas18: bool, aylikAliyor: bool, ikamet: bool }. Çakışmada m.53/1. */
  function bul(g) {
    var f = (g && g.faaliyet) || [];
    var kamu4c = f.indexOf("kamu") >= 0 && (g.kamu === "kadro" || g.kamu === "sozlesmeli");
    var kamu4a = f.indexOf("kamu") >= 0 && (g.kamu === "isci" || g.kamu === "gecici");
    var ucretli = f.indexOf("ucretli") >= 0 || kamu4a;
    var bagimsiz = f.indexOf("bagimsiz") >= 0;
    var gerekce = [], dayanak = [];
    if (kamu4a) {
      gerekce.push(g.kamu === "isci" ? "Kamuda iş sözleşmesiyle çalışan işçiler 4/a'dır." : "657 s.K. 4/C geçici personel 4/a hükümlerine tabidir.");
      dayanak.push(g.kamu === "isci" ? "5510 s.K. m.4/1-a" : "5510 s.K. m.4/2-f");
    }
    var adaylar = (kamu4c ? 1 : 0) + (ucretli ? 1 : 0) + (bagimsiz ? 1 : 0);
    var statu;
    if (kamu4c) {
      statu = "4c";
      gerekce.push(g.kamu === "kadro" ? "Kamu idaresinde kadrolu çalışma 4/c'dir." : "657 s.K. 4/B sözleşmeli personel 4/c'dir.");
      dayanak.push("5510 s.K. m.4/1-c");
      if (adaylar > 1) { gerekce.push("4/c başka bir statüyle çakışırsa önce 4/c esas alınır."); dayanak.push("5510 s.K. m.53/1"); }
    } else if (ucretli && bagimsiz) {
      statu = "4a";
      gerekce.push("Hem ücretli hem bağımsız çalışırken 4/a esas alınır. Yazılı taleple 4/b kapsamında da prim ödenebilir.");
      dayanak.push("5510 s.K. m.53/1");
    } else if (ucretli) {
      statu = "4a";
      if (!kamu4a) { gerekce.push("Bir işverene bağlı, ücret karşılığı çalışma 4/a'dır."); dayanak.push("5510 s.K. m.4/1-a"); }
    } else if (bagimsiz) {
      statu = "4b";
      gerekce.push("Kendi adına ve hesabına bağımsız çalışma 4/b'dir.");
      dayanak.push("5510 s.K. m.4/1-b");
    } else {
      var engel = [];
      if (g && g.yas18 === false) engel.push("18 yaşını doldurmuş olmak gerekir");
      if (g && g.aylikAliyor === true) engel.push("kendi sigortalılığından aylık alanlar isteğe bağlı sigortalı olamaz");
      if (g && g.ikamet === false) engel.push("Türkiye'de ikamet şartı aranır (sözleşmesiz ülkedeki Türk vatandaşları hariç)");
      dayanak.push("5510 s.K. m.50/2");
      if (engel.length) {
        return { statu: null, gerekce: ["Zorunlu sigortalılık yok; isteğe bağlı sigorta için şart eksik: " + engel.join("; ") + "."], dayanak: dayanak };
      }
      statu = "istege";
      gerekce.push("Zorunlu sigortalı olacak bir çalışma yok; isteğe bağlı sigortaya başvurulabilir. Ödenen süreler 4/b sayılır.");
      dayanak.push("5510 s.K. m.51");
    }
    return { statu: statu, gerekce: gerekce, dayanak: dayanak };
  }

  /* 2008 sonrası girişte birden fazla statüde çalışanın emekli olacağı
     statü: en çok sigortalılığın geçtiği; eşitse son statü (m.53). */
  function emekliStatusu(sureler, son) {
    var en = null, enSure = -1, esit = false;
    ["4a", "4b", "4c"].forEach(function (k) {
      var v = Number((sureler || {})[k]) || 0;
      if (v > enSure) { en = k; enSure = v; esit = false; } else if (v === enSure && v > 0) esit = true;
    });
    if (enSure <= 0) return null;
    return esit ? son : en;
  }

  return {
    surum: SURUM, statuler: STATULER, donemler: donemler, sartlar: sartlar, prim: prim, bul: bul,
    emekliStatusu: emekliStatusu,
    sinirlar: { eyt: EYT_SINIRI, gecis4ab: GECIS_SONU_4AB, gecis4c: GECIS_SONU_4C }
  };
});
