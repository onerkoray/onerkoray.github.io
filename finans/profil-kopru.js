/*!
 * Profil Köprüsü — araçların Finansal İkiz profilinden okuması
 *
 * NEDEN VAR: sitedeki araçların hepsi kullanıcıyı SIFIRDAN başlatıyor.
 * Dün girdiğin maaşı bugün tekrar giriyorsun; kredi aracına girdiğin
 * borç, borç planı aracında yok. Bir hesap makinesini derin yapan şey
 * formülü değil HAFIZASI ve BAĞLAMI — ve o hafıza zaten yazıldı
 * (finans/profil.js), yalnızca İkiz'in içinde kalmıştı.
 *
 * ÜÇ KURAL
 *
 * 1. YALNIZCA OKUR, YAZMAZ. Bir aracın kullanıcının profilini sessizce
 *    güncellemesi, "şu hesabı bir deneyeyim" diyen birinin gerçek
 *    verisini bozardı. Aktarım tek yönlü ve her zaman kullanıcının
 *    tıklamasıyla.
 *
 * 2. ONAY YOKSA PROFİL YOKTUR. Profil ancak kullanıcı İkiz sayfasında
 *    açıkça onayladıysa cihazda duruyor. Köprü de aynı kapıdan geçiyor:
 *    onay yoksa hiçbir şey okunmaz ve buton GÖSTERİLMEZ — olmayan bir
 *    veriyi ima etmek yanlış olurdu.
 *
 * 3. NE DOLDURULDUĞU SÖYLENİR. Buton "dolduruldu" deyip geçmiyor; hangi
 *    alanların değiştiğini yazıyor. Kullanıcı formuna ne olduğunu
 *    görmeden devam etmemeli.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ikiz/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var P = nodeMi ? require("./profil.js") : root.Profil;
  var v = factory(P);
  if (nodeMi) module.exports = v;
  else root.ProfilKopru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (P) {
  "use strict";

  var IKIZ_YOLU = "/finansal-ikiz/";

  /** Profilde bu araç için kullanılabilir veri var mı? */
  function veriVar(p, alanlar) {
    if (!p) return false;
    var kontrol = {
      gelir: function () { return p.gelirler.length > 0; },
      gider: function () { return p.giderler.length > 0; },
      varlik: function () { return p.varliklar.length > 0; },
      borc: function () { return p.borclar.length > 0; },
      varsayim: function () { return true; }
    };
    return (alanlar || []).some(function (a) {
      return kontrol[a] ? kontrol[a]() : false;
    });
  }

  /* TEMBEL YÜKLEME. Bazı araçlar profildeki BRÜT ücretten NET'i
     hesaplamak zorunda — profil neti bilerek saklamıyor, çünkü net
     yıla ve mevzuata bağlı ve saklanan bir net sessizce eskir. Neti
     hesaplamak da bordro motorunu gerektiriyor (~20 KB).

     O motoru sayfa açılışında yüklemek, butona hiç basmayacak
     ziyaretçilerin de faturayı ödemesi demekti. Bunun yerine betikler
     ilk tıklamada geliyor; sayfa açılışı hiç değişmiyor. */
  var yuklenen = {};
  function betikYukle(yollar) {
    return Promise.all((yollar || []).map(function (yol) {
      if (yuklenen[yol]) return yuklenen[yol];
      yuklenen[yol] = new Promise(function (coz, at) {
        var e = document.createElement("script");
        e.src = yol;
        e.onload = function () { coz(); };
        e.onerror = function () {
          /* Başarısız yükleme HATIRLANMAZ: ağ bir kez tökezlediyse
             ikinci tıklama yeniden denemeli. */
          delete yuklenen[yol];
          at(new Error("yüklenemedi: " + yol));
        };
        document.head.appendChild(e);
      });
      return yuklenen[yol];
    }));
  }

  /**
   * Profildeki ÜCRET gelirinin aylık NETİ.
   *
   * Profil neti bilerek saklamıyor: net yıla ve mevzuata bağlı, saklanan
   * bir net bir sonraki bordro yılında sessizce yanlışa döner. O yüzden
   * net her seferinde bordro motorundan hesaplanıyor — ve motor burada
   * TEMBEL yükleniyor, çünkü butona basmayan ziyaretçinin onu indirmesi
   * için bir sebep yok.
   *
   * ON İKİ AYIN ORTALAMASI ALINIYOR, OCAK AYI DEĞİL. Kümülatif gelir
   * vergisi tarifesi yüzünden net maaş yıl içinde DÜŞÜYOR; Ocak netini
   * "aylık net" saymak, yıllık geliri sistematik olarak yukarı okumak
   * olurdu. Aynı kural finans/nakit-akisi-motoru.js'te de geçerli.
   *
   * @returns {Promise<number>} aylık net (ücret geliri yoksa 0)
   */
  function ucretNeti(p, secenek) {
    var o = secenek || {};
    var kok = o.kok || "../";
    var ucret = null;
    (p && p.gelirler ? p.gelirler : []).forEach(function (g) {
      if (g.tur === "ucret" && g.aylikBrut > 0 &&
          (!ucret || g.aylikBrut > ucret.aylikBrut)) ucret = g;
    });
    if (!ucret) return Promise.resolve(0);

    return betikYukle([kok + "bordro/parametreler.js",
      kok + "bordro/motor.js"]).then(function () {
      var B = (typeof window !== "undefined") ? window.Bordro : null;
      if (!B || !B.hesaplaYil) throw new Error("bordro motoru yok");
      var yil = o.yil || B.sonYil();
      var r = B.hesaplaYil(ucret.aylikBrut, yil);
      return r.toplam.net / 12;
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * @param {Object} o
   *   hedef     HTMLElement — şeridin yerleştirileceği yer
   *   alanlar   ["gelir","gider","borc","varlik","varsayim"]
   *   doldur    function(profil) -> [string] doldurulan alanların adları
   *   yol       İkiz sayfasına göreli yol (örn "../finansal-ikiz/")
   *   uygunMu   function(profil) -> boolean (isteğe bağlı) — alan TÜRÜ
   *             doğru ama içerik bu araca uymuyorsa burada elenir.
   *             Gereken yer somut: erken kapatma aracı yalnızca sabit
   *             vadeli kredileri modelleyebiliyor; yalnızca kredi kartı
   *             borcu olan birine "profilinizden doldurun" demek, sonra
   *             "kullanılabilir veri yok" demek olurdu. Söz verilmiyor.
   */
  function bagla(o) {
    if (!P || !o || !o.hedef) return;
    var yol = o.yol || IKIZ_YOLU;
    var p = null;
    try { p = P.yukle(); } catch (e) { p = null; }

    var uygun = veriVar(p, o.alanlar);
    if (uygun && typeof o.uygunMu === "function") {
      try { uygun = !!o.uygunMu(p); } catch (e) { uygun = false; }
    }

    /* ONAY YOKSA ya da bu araç için veri yoksa: buton YOK.
       Yerine sessiz bir satır — nagging değil, keşfedilebilirlik. */
    if (!uygun) {
      o.hedef.innerHTML =
        '<p class="pk-sessiz">Bu alanları her seferinde doldurmak yerine ' +
        '<a href="' + esc(yol) + '">Finansal İkiz</a> profilinizden ' +
        "çekebilirsiniz. Profil yalnızca sizin cihazınızda durur.</p>";
      return;
    }

    o.hedef.innerHTML =
      '<div class="pk-serit">' +
      '<p class="pk-metin"><strong>Finansal İkiz profiliniz var.</strong> ' +
      "Bu aracın alanlarını oradan doldurabilirsiniz.</p>" +
      '<button type="button" class="pk-dugme" id="pk-doldur">Profilimden doldur</button>' +
      '<p class="pk-sonuc" id="pk-sonuc" role="status"></p></div>';

    var dugme = o.hedef.querySelector("#pk-doldur");
    var sonuc = o.hedef.querySelector("#pk-sonuc");
    /* NE DOLDURULDUGU SOYLENIR. "Dolduruldu" deyip gecmek, kullanicinin
       formuna ne oldugunu gormeden devam etmesine yol acardi. */
    function bildir(doldurulan) {
      sonuc.textContent = doldurulan && doldurulan.length
        ? "Dolduruldu: " + doldurulan.join(", ") + ". Değerleri üzerine yazabilirsiniz."
        : "Bu araç için profilde kullanılabilir veri bulunamadı.";
    }
    function basarisiz() {
      sonuc.textContent = "Profil okunamadı; alanlar değiştirilmedi.";
    }

    dugme.addEventListener("click", function () {
      var sonucDeger;
      try {
        sonucDeger = o.doldur(p);
      } catch (e) { basarisiz(); return; }

      /* doldur() bir SÖZ döndürebilir: bazı araçlar önce kendi motorunu
         indirmek zorunda. Bu sürede buton kilitli ve durum yazılı --
         tıklayıp hiçbir şey olmadığını görmek, en kötü geri bildirim. */
      if (sonucDeger && typeof sonucDeger.then === "function") {
        dugme.disabled = true;
        sonuc.textContent = "Profiliniz okunuyor…";
        sonucDeger.then(function (d) {
          dugme.disabled = false; bildir(d || []);
        }, function () {
          dugme.disabled = false; basarisiz();
        });
        return;
      }
      bildir(sonucDeger || []);
    });
  }

  return { bagla: bagla, veriVar: veriVar, betikYukle: betikYukle,
    ucretNeti: ucretNeti };
});
