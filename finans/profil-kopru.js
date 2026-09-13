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
    dugme.addEventListener("click", function () {
      var doldurulan;
      try {
        doldurulan = o.doldur(p) || [];
      } catch (e) {
        sonuc.textContent = "Profil okunamadı; alanlar değiştirilmedi.";
        return;
      }
      /* NE DOLDURULDUGU SOYLENIR. "Dolduruldu" deyip gecmek, kullanicinin
         formuna ne oldugunu gormeden devam etmesine yol acardi. */
      sonuc.textContent = doldurulan.length
        ? "Dolduruldu: " + doldurulan.join(", ") + ". Değerleri üzerine yazabilirsiniz."
        : "Bu araç için profilde kullanılabilir veri bulunamadı.";
    });
  }

  return { bagla: bagla, veriVar: veriVar };
});
