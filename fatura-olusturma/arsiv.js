/*!
 * Fatura & Teklif Merkezi — çalışma alanı çekirdeği
 *
 * Bağımlılıksız (yalnızca fatura.js). Hem tarayıcıda (window.FaturaArsiv) hem
 * Node'da (require) çalışır.
 *
 * NEDEN AYRI BİR KATMAN:
 * Bu araç sunucusuz kalıyor. Sunucusuz olmak "durum yok" demek değil; durumun
 * tamamı kullanıcının cihazında demek. Belge arşivi, teklifin faturaya
 * dönüşmesi, tahsilat durumu ve özet sayılar — bunların hepsi saf veri
 * dönüşümü. DOM'dan ve localStorage'dan ayrı tutuluyorlar ki test
 * edilebilsinler: bir belge arşivinin sessizce bozulması, kullanıcının kendi
 * kayıtlarını kaybetmesi demektir ve bu geri alınamaz.
 *
 * TASARIM KARARI — belge kendi kopyasını taşır:
 * Bir belge kesildikten sonra firma bilgisi değişirse, ESKİ belge eski
 * bilgiyle kalmalıdır. Bu yüzden her belge firma ve müşteri bilgisinin o
 * andaki kopyasını içinde tutar; referans tutmaz. Muhasebede belge geriye
 * dönük değişmez.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/fatura-olusturma/
 */
(function (root, factory) {
  "use strict";
  var F = (typeof module === "object" && module.exports)
    ? require("./fatura.js")
    : root.Fatura;
  var v = factory(F);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.FaturaArsiv = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (F) {
  "use strict";

  var SURUM = 1;

  /* Belge türleri ve numara önekleri. Önek belgenin türünü numaradan
     okunabilir kılıyor; muhasebeci "TKF" görünce bunun bir fatura olmadığını
     anlıyor. */
  var TURLER = [
    { tur: "TEKLİF", onek: "TKF", fatura: false },
    { tur: "PROFORMA FATURA", onek: "PRF", fatura: false },
    { tur: "FATURA", onek: "FTR", fatura: true },
    { tur: "MAKBUZ", onek: "MKB", fatura: true },
    { tur: "ÖN BİLGİLENDİRME", onek: "OBF", fatura: false }
  ];

  /* Durum akışı. "iptal" her yerden erişilebilir; gerisi ileri doğru akar
     ama geri alma da serbest, çünkü insan yanlış işaretler. */
  var DURUMLAR = [
    { ad: "taslak", etiket: "Taslak" },
    { ad: "gonderildi", etiket: "Gönderildi" },
    { ad: "odendi", etiket: "Ödendi" },
    { ad: "iptal", etiket: "İptal" }
  ];

  function turBilgi(tur) {
    for (var i = 0; i < TURLER.length; i++) if (TURLER[i].tur === tur) return TURLER[i];
    return TURLER[1];
  }

  function bugun() {
    var d = new Date();
    return iso(d);
  }
  function iso(d) {
    var ay = String(d.getMonth() + 1), gun = String(d.getDate());
    return d.getFullYear() + "-" + (ay.length < 2 ? "0" + ay : ay) +
      "-" + (gun.length < 2 ? "0" + gun : gun);
  }
  function gunFarki(a, b) {
    var x = new Date(a + "T00:00:00Z"), y = new Date(b + "T00:00:00Z");
    if (isNaN(x) || isNaN(y)) return null;
    return Math.round((y - x) / 86400000);
  }

  /* Kimlik: zaman + sayaç + rastgelelik. crypto her ortamda yok (Node'un eski
     sürümleri, bazı tarayıcı bağlamları); yoksa Math.random'a düşülüyor.
     Çakışma riski tek kullanıcılık bir arşivde ihmal edilebilir. */
  var sayacKimlik = 0;
  function kimlik() {
    sayacKimlik += 1;
    var r;
    try {
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        var a = new Uint32Array(1);
        crypto.getRandomValues(a);
        r = a[0].toString(36);
      }
    } catch (e) { /* yoksay */ }
    if (!r) r = Math.floor(Math.random() * 4294967296).toString(36);
    return "b" + Date.now().toString(36) + sayacKimlik.toString(36) + r;
  }

  /* ---------------------------------------------------- çalışma alanı ---- */

  function bosCalismaAlani() {
    return {
      surum: SURUM,
      firma: {},
      belgeler: [],
      musteriler: [],
      katalog: [],
      ayar: { sablon: "klasik", renk: "yesil" },
      sayac: {}
    };
  }

  /* Dışarıdan gelen her şey (yüklenen dosya, eski sürüm depo) buradan geçer.
     Eksik alanları tamamlar, tipi yanlış olanları düzeltir. Bozuk bir dosya
     yüzünden aracın açılmaması, kullanıcının bütün arşivini kaybetmesinden
     daha iyi değil; kurtarılabilen kurtarılıyor. */
  function normalize(ham) {
    var a = bosCalismaAlani();
    if (!ham || typeof ham !== "object") return a;

    a.firma = (ham.firma && typeof ham.firma === "object") ? ham.firma : {};
    a.musteriler = Array.isArray(ham.musteriler) ? ham.musteriler.filter(function (m) {
      return m && typeof m === "object";
    }) : [];
    a.katalog = Array.isArray(ham.katalog) ? ham.katalog.filter(function (k) {
      return k && typeof k === "object";
    }) : [];
    if (ham.ayar && typeof ham.ayar === "object") {
      a.ayar.sablon = ham.ayar.sablon || a.ayar.sablon;
      a.ayar.renk = ham.ayar.renk || a.ayar.renk;
    }
    if (ham.sayac && typeof ham.sayac === "object") a.sayac = ham.sayac;

    var gorulen = {};
    a.belgeler = (Array.isArray(ham.belgeler) ? ham.belgeler : [])
      .filter(function (b) { return b && typeof b === "object"; })
      .map(function (b) {
        var id = b.id;
        /* Aynı kimlikten iki belge, silme ve güncellemeyi belirsiz yapar. */
        if (!id || gorulen[id]) id = kimlik();
        gorulen[id] = true;
        return {
          id: id,
          no: b.no || "",
          tur: turBilgi(b.tur).tur,
          durum: gecerliDurum(b.durum) ? b.durum : "taslak",
          tarih: b.tarih || bugun(),
          vade: b.vade || "",
          odemeTarihi: b.odemeTarihi || "",
          kaynakId: b.kaynakId || "",
          kaynakNo: b.kaynakNo || "",
          referans: b.referans || "",
          odemeKosulu: b.odemeKosulu || "",
          firma: (b.firma && typeof b.firma === "object") ? b.firma : {},
          musteri: (b.musteri && typeof b.musteri === "object") ? b.musteri : {},
          kalemler: Array.isArray(b.kalemler) ? b.kalemler : [],
          genelIskonto: b.genelIskonto != null ? b.genelIskonto : 0,
          genelIskontoTur: b.genelIskontoTur === "tutar" ? "tutar" : "oran",
          tevkifat: (b.tevkifat && typeof b.tevkifat === "object") ? b.tevkifat : { pay: 0, payda: 10 },
          para: b.para || "TRY",
          kur: b.kur != null ? b.kur : 1,
          notlar: b.notlar || "",
          kosullar: b.kosullar || "",
          sablon: b.sablon || a.ayar.sablon,
          renk: b.renk || a.ayar.renk,
          logo: b.logo || "",
          olusturma: b.olusturma || new Date().toISOString(),
          guncelleme: b.guncelleme || b.olusturma || new Date().toISOString()
        };
      });
    return a;
  }

  function gecerliDurum(d) {
    for (var i = 0; i < DURUMLAR.length; i++) if (DURUMLAR[i].ad === d) return true;
    return false;
  }

  function belgeBul(alan, id) {
    for (var i = 0; i < alan.belgeler.length; i++) {
      if (alan.belgeler[i].id === id) return alan.belgeler[i];
    }
    return null;
  }

  /* ---------------------------------------------------------- numara ---- */

  /**
   * Bir sonraki belge numarası. Sayaç türe ve yıla göre ayrı tutulur:
   * teklifler ve faturalar aynı diziyi paylaşmaz.
   * Sayaç bozulsa bile arşivdeki en büyük numara esas alınır; iki belgenin
   * aynı numarayı almasi muhasebede kabul edilemez.
   */
  function sonrakiNo(alan, tur, yil) {
    var onek = turBilgi(tur).onek;
    yil = yil || new Date().getFullYear();
    var anahtar = onek + yil;
    var enBuyuk = Number(alan.sayac[anahtar] || 0);
    var desen = new RegExp("^" + anahtar + "(\\d+)$");
    for (var i = 0; i < alan.belgeler.length; i++) {
      var m = desen.exec(alan.belgeler[i].no || "");
      if (m && Number(m[1]) > enBuyuk) enBuyuk = Number(m[1]);
    }
    var deger = enBuyuk + 1;
    /* Altı hane sabit: sıralama metin olarak da doğru çalışsın diye. */
    return anahtar + ("000000" + deger).slice(-6);
  }

  function sayacIsle(alan, no) {
    var m = /^([A-ZÇĞİÖŞÜ]+\d{4})(\d+)$/.exec(no || "");
    if (!m) return;
    alan.sayac[m[1]] = Math.max(Number(alan.sayac[m[1]] || 0), Number(m[2]));
  }

  /* ------------------------------------------------------ belge işlem ---- */

  function belgeEkle(alan, veri) {
    var b = normalize({ belgeler: [veri || {}] }).belgeler[0];
    if (!b.no) b.no = sonrakiNo(alan, b.tur, Number((b.tarih || bugun()).slice(0, 4)));
    alan.belgeler.unshift(b);
    sayacIsle(alan, b.no);
    return b;
  }

  function belgeGuncelle(alan, id, yama) {
    var b = belgeBul(alan, id);
    if (!b) return null;
    for (var k in yama) {
      if (Object.prototype.hasOwnProperty.call(yama, k) && k !== "id" && k !== "olusturma") {
        b[k] = yama[k];
      }
    }
    if (yama.no) sayacIsle(alan, yama.no);
    b.guncelleme = new Date().toISOString();
    return b;
  }

  function belgeSil(alan, id) {
    var once = alan.belgeler.length;
    alan.belgeler = alan.belgeler.filter(function (b) { return b.id !== id; });
    return alan.belgeler.length < once;
  }

  function belgeKopyala(alan, id) {
    var b = belgeBul(alan, id);
    if (!b) return null;
    var kopya = JSON.parse(JSON.stringify(b));
    kopya.id = kimlik();
    kopya.no = sonrakiNo(alan, kopya.tur);
    kopya.durum = "taslak";
    kopya.odemeTarihi = "";
    kopya.tarih = bugun();
    kopya.olusturma = kopya.guncelleme = new Date().toISOString();
    alan.belgeler.unshift(kopya);
    sayacIsle(alan, kopya.no);
    return kopya;
  }

  /**
   * Teklifi faturaya çevirir.
   *
   * Teklif SİLİNMEZ ve değişmez. Yeni belge kaynağına bağlanır (kaynakId),
   * teklif de "dönüştürüldü" bilgisini taşır. Bunun sebebi kayıt bütünlüğü:
   * müşteriye gönderilmiş bir teklifi sonradan faturaya çevirip yok etmek,
   * neyin teklif edilip neyin faturalandığını karşılaştırılamaz hale getirir.
   */
  function tekliftenFatura(alan, id, hedefTur) {
    var t = belgeBul(alan, id);
    if (!t) return null;
    if (turBilgi(t.tur).fatura) return null;   /* zaten fatura */

    var yeniTur = hedefTur || "FATURA";
    var f = JSON.parse(JSON.stringify(t));
    f.id = kimlik();
    f.tur = turBilgi(yeniTur).tur;
    f.no = sonrakiNo(alan, f.tur);
    f.durum = "taslak";
    f.odemeTarihi = "";
    f.tarih = bugun();
    f.kaynakId = t.id;
    f.kaynakNo = t.no;
    f.olusturma = f.guncelleme = new Date().toISOString();
    alan.belgeler.unshift(f);
    sayacIsle(alan, f.no);
    return f;
  }

  function durumDegistir(alan, id, durum) {
    var b = belgeBul(alan, id);
    if (!b || !gecerliDurum(durum)) return null;
    b.durum = durum;
    /* Ödeme tarihi durumla birlikte yönetiliyor; elle tutulsa unutulur ve
       tahsilat süresi ortalaması sessizce yanlış çıkar. */
    if (durum === "odendi") { if (!b.odemeTarihi) b.odemeTarihi = bugun(); }
    else b.odemeTarihi = "";
    b.guncelleme = new Date().toISOString();
    return b;
  }

  /* ----------------------------------------------------------- katalog -- */

  function katalogEkle(alan, kalem) {
    if (!kalem || !String(kalem.aciklama || "").trim()) return null;
    var ad = String(kalem.aciklama).trim().toLocaleLowerCase("tr-TR");
    for (var i = 0; i < alan.katalog.length; i++) {
      if (String(alan.katalog[i].aciklama || "").trim().toLocaleLowerCase("tr-TR") === ad) {
        alan.katalog[i] = { aciklama: kalem.aciklama, birim: kalem.birim || "Adet",
          birimFiyat: kalem.birimFiyat, kdvOran: kalem.kdvOran };
        return alan.katalog[i];
      }
    }
    var y = { aciklama: kalem.aciklama, birim: kalem.birim || "Adet",
      birimFiyat: kalem.birimFiyat, kdvOran: kalem.kdvOran };
    alan.katalog.push(y);
    return y;
  }

  function katalogSil(alan, ix) {
    if (ix < 0 || ix >= alan.katalog.length) return false;
    alan.katalog.splice(ix, 1);
    return true;
  }

  /* ------------------------------------------------------------- özet --- */

  function belgeToplami(b) {
    var s = F.hesapla({
      kalemler: b.kalemler,
      genelIskontoTur: b.genelIskontoTur,
      genelIskonto: b.genelIskonto,
      tevkifat: b.tevkifat,
      paraBirimi: b.para,
      kur: b.kur
    });
    return { odenecek: s.odenecek, tl: s.odenecekTl, para: b.para };
  }

  /**
   * Yıllık özet. Tutarlar TL karşılığı üzerinden toplanır; farklı para
   * biriminde belgeleri toplamak aksi halde anlamsız bir sayı verirdi.
   */
  function ozet(alan, yil, bugunTarih) {
    yil = String(yil || new Date().getFullYear());
    bugunTarih = bugunTarih || bugun();

    var belgeler = alan.belgeler.filter(function (b) {
      return String(b.tarih || "").slice(0, 4) === yil;
    });

    var o = {
      yil: Number(yil),
      belgeSayisi: belgeler.length,
      turlere: {}, durumlara: {},
      teklifSayisi: 0, teklifTutari: 0,
      faturaSayisi: 0, faturaTutari: 0,
      tahsilEdilen: 0, bekleyen: 0,
      vadesiGecen: 0, vadesiGecenTutar: 0,
      donusenTeklif: 0, donusumOrani: null,
      ortalamaTahsilatGunu: null,
      musteriler: [], aylik: []
    };
    for (var i = 0; i < 12; i++) o.aylik.push({ ay: i + 1, sayi: 0, tutar: 0 });

    var tahsilatGunleri = [];
    var musteriToplam = {};
    var donusmusKaynaklar = {};

    belgeler.forEach(function (b) {
      o.turlere[b.tur] = (o.turlere[b.tur] || 0) + 1;
      o.durumlara[b.durum] = (o.durumlara[b.durum] || 0) + 1;

      var t = belgeToplami(b);
      var tl = t.tl;
      var ay = Number(String(b.tarih).slice(5, 7)) - 1;
      if (ay >= 0 && ay < 12 && b.durum !== "iptal") {
        o.aylik[ay].sayi += 1;
        o.aylik[ay].tutar += tl;
      }
      if (b.durum === "iptal") return;

      if (turBilgi(b.tur).fatura) {
        o.faturaSayisi += 1;
        o.faturaTutari += tl;
        if (b.durum === "odendi") {
          o.tahsilEdilen += tl;
          var g = gunFarki(b.tarih, b.odemeTarihi || b.tarih);
          if (g != null && g >= 0) tahsilatGunleri.push(g);
        } else if (b.durum === "gonderildi") {
          o.bekleyen += tl;
          if (b.vade && b.vade < bugunTarih) {
            o.vadesiGecen += 1;
            o.vadesiGecenTutar += tl;
          }
        }
        var ad = (b.musteri && b.musteri.unvan) ? String(b.musteri.unvan).trim() : "";
        if (ad) musteriToplam[ad] = (musteriToplam[ad] || 0) + tl;
      } else {
        o.teklifSayisi += 1;
        o.teklifTutari += tl;
      }
      if (b.kaynakId) donusmusKaynaklar[b.kaynakId] = true;
    });

    o.donusenTeklif = Object.keys(donusmusKaynaklar).length;
    /* Dönüşüm oranı serbest çalışan için en anlamlı tek sayı: kaç teklif işe
       dönüştü. Teklif yoksa oran tanımsızdır; sıfır demek yanıltıcı olurdu. */
    o.donusumOrani = o.teklifSayisi > 0
      ? Math.round(1000 * o.donusenTeklif / o.teklifSayisi) / 10 : null;

    if (tahsilatGunleri.length) {
      var toplam = tahsilatGunleri.reduce(function (x, y) { return x + y; }, 0);
      o.ortalamaTahsilatGunu = Math.round(10 * toplam / tahsilatGunleri.length) / 10;
    }

    o.musteriler = Object.keys(musteriToplam)
      .map(function (ad) { return { unvan: ad, tutar: musteriToplam[ad] }; })
      .sort(function (a, b) { return b.tutar - a.tutar; })
      .slice(0, 5);

    ["faturaTutari", "teklifTutari", "tahsilEdilen", "bekleyen", "vadesiGecenTutar"]
      .forEach(function (k) { o[k] = Math.round(o[k] * 100) / 100; });
    o.aylik.forEach(function (a) { a.tutar = Math.round(a.tutar * 100) / 100; });

    return o;
  }

  /* --------------------------------------------------- dışa/içe aktar --- */

  function disaAktar(alan) {
    return {
      tur: "korayoner.dev/fatura-olusturma",
      surum: SURUM,
      tarih: new Date().toISOString(),
      calismaAlani: alan
    };
  }

  /**
   * Yedek dosyasını okur. Hem yeni biçimi (sarmalanmış) hem doğrudan çalışma
   * alanını hem de eski tek-belge dosyalarını kabul eder: kullanıcı elindeki
   * dosyanın hangi sürümde üretildiğini bilmek zorunda kalmamalı.
   */
  function iceAktar(ham) {
    if (!ham || typeof ham !== "object") return null;
    if (ham.calismaAlani) return normalize(ham.calismaAlani);
    if (Array.isArray(ham.belgeler)) return normalize(ham);
    if (Array.isArray(ham.kalemler)) {
      /* eski sürümün tek belgelik dosyası */
      var alan = bosCalismaAlani();
      if (ham.firma) alan.firma = ham.firma;
      belgeEkle(alan, {
        tur: ham["belge-turu"] || ham.tur, no: ham["belge-no"] || ham.no,
        tarih: ham.tarih, vade: ham.vade, referans: ham.referans,
        odemeKosulu: ham["odeme-kosulu"], firma: ham.firma, musteri: ham.musteri,
        kalemler: ham.kalemler, genelIskonto: ham["genel-iskonto"],
        genelIskontoTur: ham.genelIskontoTur, para: ham.para, kur: ham.kur,
        notlar: ham.notlar, kosullar: ham.kosullar, sablon: ham.sablon,
        renk: ham.renk, logo: ham.logo
      });
      return alan;
    }
    return null;
  }

  return {
    surum: "1.0.0",
    TURLER: TURLER,
    DURUMLAR: DURUMLAR,
    turBilgi: turBilgi,
    kimlik: kimlik,
    bugun: bugun,
    gunFarki: gunFarki,
    bosCalismaAlani: bosCalismaAlani,
    normalize: normalize,
    belgeBul: belgeBul,
    sonrakiNo: sonrakiNo,
    belgeEkle: belgeEkle,
    belgeGuncelle: belgeGuncelle,
    belgeSil: belgeSil,
    belgeKopyala: belgeKopyala,
    tekliftenFatura: tekliftenFatura,
    durumDegistir: durumDegistir,
    katalogEkle: katalogEkle,
    katalogSil: katalogSil,
    belgeToplami: belgeToplami,
    ozet: ozet,
    disaAktar: disaAktar,
    iceAktar: iceAktar
  };
});
