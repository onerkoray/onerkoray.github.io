/*!
 * Şifre motoru — üretim, entropi ve kırılma süresi.
 *
 * ENTROPİ PAROLANIN DEĞİL, ÜRETECİN ÖZELLİĞİDİR.
 * Bu dosyanın var olma sebebi tek bir hata: önceki güç testi, kullanıcının
 * YAZDIĞI parola için "uzunluk × log2(havuz)" hesaplıyordu. O formül
 * yalnızca parola o havuzdan RASTGELE seçildiyse geçerlidir. "Password123!"
 * için 78,8 bit veriyor ve "Çok güçlü" diyordu; oysa o parola saniyeler
 * içinde kırılır, çünkü bir insan seçti ve saldırgan insanların nasıl
 * seçtiğini biliyor.
 *
 * Bu yüzden motor iki ayrı soruyu ayrı ayrı cevaplıyor:
 *   uret()  — biz üretiyorsak entropi HESAPLANABİLİR ve kesindir.
 *   analiz() — kullanıcı yazdıysa entropi BİLİNEMEZ; yalnızca bir ÜST SINIR
 *              ve bulunan kalıplara göre çok daha düşük bir tahmin verilir.
 *
 * SINIF GARANTİSİ ENTROPİYİ DÜŞÜRÜR, YÜKSELTMEZ.
 * "Her seçili türden en az bir karakter" kuralı örnek uzayını daraltır.
 * Çoğu araç bu kuralı bir güvenlik artışı gibi sunar; aritmetik tersini
 * söylüyor ve burada açıkça yazılıyor.
 *
 * ÜRETİM REDDETME ÖRNEKLEMESİYLE.
 * Yaygın uygulama, rastgele bir parola üretip eksik sınıfları belirli
 * konumlara ZORLA yazmaktır; bu, kısıtlı uzay üzerinde DÜZGÜN dağılım
 * vermez ve o konumları öngörülebilir yapar. Burada parola yeniden
 * üretiliyor (reddetme); sonuç kısıtlı uzayda düzgün dağılımlı ve entropi
 * tam olarak log2(uygun dizi sayısı).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/keymint/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var v = factory();
  if (nodeMi) module.exports = v;
  else root.SifreMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SINIFLAR = {
    buyuk: { ad: "Büyük harf", karakter: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
    kucuk: { ad: "Küçük harf", karakter: "abcdefghijklmnopqrstuvwxyz" },
    rakam: { ad: "Rakam", karakter: "0123456789" },
    sembol: { ad: "Sembol", karakter: "!@#$%^&*()-_=+[]{};:,.?/" }
  };

  /* Birbirine karışan karakterler. Elle yazılan ya da okunan parolalarda
     hata kaynağı; çıkarıldığında havuz küçülür, yani entropi DÜŞER. */
  var KARISAN = "0O1lI|`";

  /* ---------------------------------------------------------- rastgelelik */

  /**
   * [0, n) aralığında kriptografik rastgele tam sayı.
   *
   * MODULO YANLILIĞI ELENIYOR: 2^32 çoğu n'e tam bölünmez, dolayısıyla
   * doğrudan "x % n" küçük değerleri bir fazla üretir. Kabul edilebilir
   * en büyük katın üstündeki değerler atılıyor.
   */
  function rastgele(n) {
    if (n <= 0) throw new Error("n pozitif olmalı");
    var dizi = new Uint32Array(1);
    var sinir = Math.floor(0xFFFFFFFF / n) * n;
    var x;
    do { kaynak(dizi); x = dizi[0]; } while (x >= sinir);
    return x % n;
  }

  function kaynak(dizi) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(dizi);
      return;
    }
    /* Node: test ortamı. Math.random ASLA kullanılmıyor — bir parola
       üretecinde zayıf rastgelelik sessiz ve tam bir başarısızlıktır. */
    var c = require("crypto");
    var b = c.randomBytes(4);
    dizi[0] = b.readUInt32BE(0);
  }

  /* ------------------------------------------------------------- entropi */

  function log2(x) { return Math.log(x) / Math.LN2; }

  /**
   * Seçili sınıfların karakter kümeleri (karışanlar çıkarılmış olabilir).
   * @returns [{anahtar, ad, karakter}]
   */
  function kumeler(secim) {
    var cikar = !!(secim && secim.karisanlariCikar);
    var out = [];
    Object.keys(SINIFLAR).forEach(function (k) {
      if (!secim || !secim[k]) return;
      var s = SINIFLAR[k].karakter;
      if (cikar) {
        s = s.split("").filter(function (ch) {
          return KARISAN.indexOf(ch) < 0;
        }).join("");
      }
      if (s.length) out.push({ anahtar: k, ad: SINIFLAR[k].ad, karakter: s });
    });
    return out;
  }

  /**
   * Rastgele bir dizinin HER sınıftan en az bir karakter içerme olasılığı.
   *
   * İçerme-dışlama ilkesi: p havuz boyutu, s_S dışlanan sınıfların toplam
   * boyutu olmak üzere
   *     Pr = Σ_{S ⊆ sınıflar} (−1)^|S| · ((p − s_S) / p)^L
   *
   * Her terim [0,1] aralığında olduğu için toplam kayan noktada kararlı.
   * Bu sayı iki işi birden görüyor: entropi düzeltmesi log2(Pr), ve
   * reddetme örneklemesinin kabul olasılığı (beklenen deneme = 1/Pr).
   */
  function uygunlukOlasiligi(kume, uzunluk) {
    var p = 0;
    kume.forEach(function (s) { p += s.karakter.length; });
    if (!p || uzunluk <= 0) return 0;
    var k = kume.length;
    var toplam = 0;
    for (var maske = 0; maske < (1 << k); maske++) {
      var disarida = 0, adet = 0;
      for (var i = 0; i < k; i++) {
        if (maske & (1 << i)) { disarida += kume[i].karakter.length; adet++; }
      }
      var kalan = p - disarida;
      if (kalan <= 0) continue;                       // 0^L = 0
      toplam += (adet % 2 ? -1 : 1) * Math.pow(kalan / p, uzunluk);
    }
    return Math.max(0, Math.min(1, toplam));
  }

  /**
   * Üretecin entropisi (bit).
   *
   * garanti=false : L · log2(p)          — düz havuz
   * garanti=true  : L · log2(p) + log2(Pr) — kısıtlı uzay, DAHA DÜŞÜK
   */
  function entropi(secim) {
    var kume = kumeler(secim);
    var L = secim.uzunluk;
    var p = 0;
    kume.forEach(function (s) { p += s.karakter.length; });
    if (!p || L <= 0) return { bit: 0, havuz: 0, duz: 0, duzeltme: 0, olasilik: 0 };
    var duz = L * log2(p);
    if (!secim.herSiniftanBir || kume.length < 2) {
      return { bit: duz, havuz: p, duz: duz, duzeltme: 0, olasilik: 1 };
    }
    var pr = uygunlukOlasiligi(kume, L);
    if (pr <= 0) return { bit: 0, havuz: p, duz: duz, duzeltme: -Infinity, olasilik: 0 };
    var duzeltme = log2(pr);
    return { bit: duz + duzeltme, havuz: p, duz: duz, duzeltme: duzeltme, olasilik: pr };
  }

  /* -------------------------------------------------------------- üretim */

  function sinifVar(parola, kume) {
    return kume.every(function (s) {
      for (var i = 0; i < parola.length; i++) {
        if (s.karakter.indexOf(parola[i]) >= 0) return true;
      }
      return false;
    });
  }

  /**
   * Parola üretir.
   * @param {Object} secim  {uzunluk, buyuk, kucuk, rakam, sembol,
   *                         karisanlariCikar, herSiniftanBir}
   */
  function uret(secim) {
    var kume = kumeler(secim);
    if (!kume.length) return { hata: "En az bir karakter türü seçin." };
    var L = secim.uzunluk;
    if (!(L > 0)) return { hata: "Uzunluk pozitif olmalı." };

    var garanti = !!secim.herSiniftanBir && kume.length > 1;
    if (garanti && L < kume.length) {
      return {
        hata: "Uzunluk (" + L + ") seçili tür sayısından (" + kume.length +
          ") küçükken her türden en az bir karakter bulunamaz."
      };
    }

    var havuz = kume.map(function (s) { return s.karakter; }).join("");
    var deneme = 0;
    var parola;
    /* Reddetme örneklemesi. Üst sınır, sonsuz döngüye karşı: kabul
       olasılığı hesaplanabildiği için beklenen deneme sayısı biliniyor;
       1000, makul her ayarda fazlasıyla yeterli. */
    do {
      parola = "";
      for (var i = 0; i < L; i++) parola += havuz[rastgele(havuz.length)];
      deneme++;
    } while (garanti && !sinifVar(parola, kume) && deneme < 1000);

    if (garanti && !sinifVar(parola, kume)) {
      return { hata: "Bu ayarlarla uygun parola üretilemedi." };
    }
    var e = entropi(secim);
    return { parola: parola, bit: e.bit, entropi: e, deneme: deneme };
  }

  /* ------------------------------------------------- kırılma süresi */

  /**
   * SALDIRGAN MODELLERİ BİR ÖLÇÜM DEĞİL, AÇIKÇA YAZILMIŞ VARSAYIMDIR.
   * Donanım ve hash algoritmasına göre değişir ve her yıl hızlanır. Tek
   * bir "kırılma süresi" vermek, olmayan bir kesinlik iddia etmek olurdu;
   * bu yüzden üç model yan yana duruyor ve hızları görünür.
   */
  /* SIRA ONEMLI: en HIZLI saldirgan basta. Ilk okunan sayi en kotu
     durum olmali; hizliyi ortaya koymak, en kisa sureyi gozden kaciriyor.
     Testler bu diziye sira ile degil ANAHTARLA bakiyor. */
  var SALDIRGANLAR = [
    {
      anahtar: "hizli",
      ad: "Çevrimdışı, hızlı hash",
      hiz: 1e11,
      aciklama: "Sızmış bir veritabanında SHA-256 gibi hızlı bir özet " +
        "fonksiyonu; çok GPU'lu bir düzenekte saniyede ~10¹¹ deneme " +
        "büyüklük sırası."
    },
    {
      anahtar: "yavas",
      ad: "Çevrimdışı, yavaş hash",
      hiz: 1e6,
      aciklama: "Aynı veritabanı bcrypt/scrypt/Argon2 gibi kasıtlı yavaş " +
        "bir fonksiyonla saklanmışsa; saniyede ~10⁶ deneme büyüklük sırası."
    },
    {
      anahtar: "cevrimici",
      ad: "Çevrimiçi, oran sınırlı",
      hiz: 10,
      aciklama: "Giriş formuna saniyede 10 deneme. Hesap kilitleme ve " +
        "oran sınırlama uygulayan bir servis."
    }
  ];


  /**
   * Ortalama kırılma süresi (saniye).
   * Arama uzayının YARISI deneniyor: ortalama 2^(bit−1) tahmin.
   */
  function kirilmaSuresi(bit, hiz) {
    if (!(bit > 0) || !(hiz > 0)) return 0;
    return Math.pow(2, bit - 1) / hiz;
  }

  function tumSureler(bit) {
    return SALDIRGANLAR.map(function (s) {
      return {
        anahtar: s.anahtar, ad: s.ad, hiz: s.hiz, aciklama: s.aciklama,
        saniye: kirilmaSuresi(bit, s.hiz)
      };
    });
  }

  var EVREN_SANIYE = 4.35e17;   // ~13,8 milyar yıl

  /** İnsan okunur süre. Evren yaşından uzun süreler sayı olarak anlamsız. */
  function sureMetni(saniye) {
    if (!(saniye > 0)) return "anında";
    if (saniye < 1) return "bir saniyeden kısa";
    if (saniye > EVREN_SANIYE * 1000) return "evrenin yaşından kat kat uzun";
    var birim = [
      ["yıl", 31557600], ["gün", 86400], ["saat", 3600],
      ["dakika", 60], ["saniye", 1]
    ];
    for (var i = 0; i < birim.length; i++) {
      if (saniye >= birim[i][1]) {
        var v = saniye / birim[i][1];
        return buyukSayi(v) + " " + birim[i][0];
      }
    }
    return "bir saniyeden kısa";
  }

  function buyukSayi(v) {
    var olcek = [[1e12, "trilyon"], [1e9, "milyar"], [1e6, "milyon"], [1e3, "bin"]];
    for (var i = 0; i < olcek.length; i++) {
      if (v >= olcek[i][0]) {
        return Math.round(v / olcek[i][0]).toLocaleString("tr-TR") + " " + olcek[i][1];
      }
    }
    return Math.round(v).toLocaleString("tr-TR");
  }

  /* ------------------------------------- kullanıcı parolasının analizi */

  /* Küçük bir liste; GERÇEK bir sözlük DEĞİL. Sayfada da böyle yazılıyor:
     burada bulunmamak "güvenli" anlamına gelmez. */
  var YAYGIN = ["123456", "password", "sifre", "parola", "123456789", "qwerty",
    "111111", "12345678", "abc123", "1234567890", "000000", "iloveyou",
    "admin", "welcome", "monkey", "dragon", "letmein", "football", "master",
    "qwerty123", "1q2w3e4r", "sifre123", "parola123", "galatasaray",
    "fenerbahce", "besiktas", "trabzonspor", "ankara", "istanbul", "türkiye"];

  var KLAVYE = ["qwerty", "qwertz", "asdf", "zxcv", "1234", "12345", "123456",
    "abcd", "qazwsx", "1qaz2wsx"];

  var LEET = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o",
    "$": "s", "5": "s", "7": "t", "+": "t" };

  function leetCoz(s) {
    return s.toLowerCase().split("").map(function (ch) {
      return Object.prototype.hasOwnProperty.call(LEET, ch) ? LEET[ch] : ch;
    }).join("");
  }

  function havuzTahmini(parola) {
    var p = 0;
    if (/[a-z]/.test(parola)) p += 26;
    if (/[A-Z]/.test(parola)) p += 26;
    if (/[0-9]/.test(parola)) p += 10;
    if (/[^a-zA-Z0-9]/.test(parola)) p += 33;
    return p;
  }

  /**
   * Kullanıcının yazdığı parolayı inceler.
   *
   * DÖNEN İKİ SAYI AYNI ŞEY DEĞİL:
   *   ustSinirBit  — "bu parola bu havuzdan RASTGELE seçilmiş olsaydı".
   *                  Bir insan seçtiyse bu varsayım YANLIŞ ve sayı bir
   *                  üst sınırdan ibaret.
   *   kalipBit     — bulunan kalıbı bilen bir saldırgan için kaba tahmin.
   *                  Kalıp bulunmadıysa null; "kalıp yok" da "güvenli"
   *                  demek değil, yalnızca "bu araç bulamadı".
   */
  function analiz(parola) {
    if (!parola) return { bos: true };
    var havuz = havuzTahmini(parola);
    var ustSinir = parola.length * log2(havuz || 1);
    var kaliplar = [];
    var duz = parola.toLowerCase();
    var coz = leetCoz(parola);

    if (YAYGIN.indexOf(duz) >= 0) {
      kaliplar.push({ tur: "yaygin", mesaj: "En sık kullanılan parolalardan biri.", bit: 12 });
    } else if (YAYGIN.indexOf(coz) >= 0) {
      kaliplar.push({
        tur: "leet",
        mesaj: "Yaygın bir parolanın rakam/sembol değiştirilmiş hâli (" +
          coz + "). Saldırganlar bu dönüşümleri dener.",
        bit: 16
      });
    }

    /* "Kelime + rakam + sembol" — en yaygın insan kalıbı. */
    var m = parola.match(/^([A-Za-zÇĞİÖŞÜçğıöşü]+?)(\d{1,4})([^A-Za-z0-9]{0,2})$/);
    if (m) {
      var kok = leetCoz(m[1]);
      var sozlukte = YAYGIN.indexOf(kok) >= 0;
      kaliplar.push({
        tur: "kelime-rakam",
        mesaj: "“Kelime + rakam" + (m[3] ? " + sembol" : "") + "” kalıbı" +
          (sozlukte ? " ve kelime yaygın listede" : "") +
          ". Saldırganlar önce bu kalıbı dener.",
        bit: (sozlukte ? 12 : 20) + log2(Math.pow(10, m[2].length)) + (m[3] ? 5 : 0)
      });
    }

    KLAVYE.forEach(function (k) {
      if (duz.indexOf(k) >= 0 && k.length >= 4) {
        kaliplar.push({
          tur: "klavye",
          mesaj: "Klavye ya da sayı sırası içeriyor (" + k + ").",
          bit: Math.max(10, ustSinir * 0.35)
        });
      }
    });

    if (/(.)\1{2,}/.test(parola)) {
      kaliplar.push({
        tur: "tekrar", mesaj: "Aynı karakter üç veya daha fazla kez tekrarlıyor.",
        bit: Math.max(10, ustSinir * 0.5)
      });
    }
    if (/^(19|20)\d\d$/.test(parola) || /(19|20)\d\d/.test(parola)) {
      kaliplar.push({
        tur: "yil", mesaj: "Yıl gibi görünen bir sayı içeriyor.",
        bit: Math.max(10, ustSinir * 0.6)
      });
    }
    if (/^\d+$/.test(parola)) {
      kaliplar.push({
        tur: "sadece-rakam", mesaj: "Yalnızca rakamlardan oluşuyor.",
        bit: parola.length * log2(10)
      });
    }

    var kalipBit = null;
    if (kaliplar.length) {
      kalipBit = Math.min.apply(null, kaliplar.map(function (k) { return k.bit; }));
      kalipBit = Math.min(kalipBit, ustSinir);
    }

    return {
      uzunluk: parola.length,
      havuz: havuz,
      ustSinirBit: ustSinir,
      kaliplar: kaliplar,
      kalipBit: kalipBit,
      /* Değerlendirmede HANGİ sayı kullanılıyorsa o söylenir. */
      degerlendirmeBit: kalipBit === null ? ustSinir : kalipBit
    };
  }

  /* Eşikler NIST SP 800-63B'nin uzunluk önerisiyle uyumlu tutuldu; bit
     karşılıkları yorumdur, standartta bit eşiği yoktur. */
  function seviye(bit) {
    if (bit < 28) return { ad: "Çok zayıf", sinif: "cok-zayif", yuzde: 12 };
    if (bit < 40) return { ad: "Zayıf", sinif: "zayif", yuzde: 30 };
    if (bit < 60) return { ad: "Orta", sinif: "orta", yuzde: 55 };
    if (bit < 80) return { ad: "Güçlü", sinif: "guclu", yuzde: 80 };
    return { ad: "Çok güçlü", sinif: "cok-guclu", yuzde: 100 };
  }

  return {
    SINIFLAR: SINIFLAR,
    KARISAN: KARISAN,
    SALDIRGANLAR: SALDIRGANLAR,
    YAYGIN: YAYGIN,
    rastgele: rastgele,
    kumeler: kumeler,
    uygunlukOlasiligi: uygunlukOlasiligi,
    entropi: entropi,
    uret: uret,
    kirilmaSuresi: kirilmaSuresi,
    tumSureler: tumSureler,
    sureMetni: sureMetni,
    analiz: analiz,
    seviye: seviye,
    log2: log2
  };
});
