/*!
 * Isı Haritası — iki parametreli karar yüzeyi
 *
 * Görselleştirme katmanının ilk bileşeni. Soyut bir "grafik kütüphanesi"
 * olarak değil, gerçek bir tüketiciden (ev al/kirala duyarlılık ızgarası)
 * çıkarılarak yazıldı; şekli o ihtiyacın şekli.
 *
 * NEYİ ANLATIR: "Kullanıcı bu görsele baktığında KARARIN HANGİ NOKTADA
 * TERSİNE DÖNDÜĞÜNÜ anlamalı." Hücre değerleri ikincil; asıl bilgi sınır.
 *
 * ÜÇ TASARIM KARARI
 *
 * 1. GRAFİK BİR TABLO. Isı haritası semantik olarak zaten iki eksenli bir
 *    tablodur. <table> + <th> kullanmak ekran okuyucuya yapıyı bedavaya
 *    veriyor; ayrı bir "tablo görünümü" yedeği yazmaya gerek kalmıyor.
 *    Renk yalnızca ikinci kanal.
 *
 * 2. DIVERGING ÖLÇEK, SIFIRDA NÖTR. Değer iki tarafa ayrışan bir FARK.
 *    Tek hue'lu sequential ramp burada yanlış olurdu: sıfırın hangi tarafta
 *    kaldığı görünmez. Renkler --dv-1 (mavi) ve --dv-2 (turuncu); yeşil/
 *    kırmızı BİLİNÇLİ olarak kullanılmadı — "satın almak iyi, kiralamak
 *    kötü" gibi bir yargı taşımamalı.
 *
 * 3. SINIR AYRICA ÇİZİLİR. Komşusu ters işaretli olan hücreler işaretleniyor.
 *    Rengin tonundan sınırı okumak zor; kararın döndüğü şerit görünür
 *    olmalı çünkü grafiğin tek mesajı o.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.IsiHaritasi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Değeri 3 basamaklı diverging ölçeğe oturtur. Mutlak en büyük değere
     göre normalize ediliyor; sabit eşik kullanmak farklı senaryolarda
     ızgarayı tek renge boyardı. */
  function basamak(deger, enBuyuk) {
    if (deger === null || !isFinite(deger)) return "bos";
    if (enBuyuk <= 0) return "n0";
    var o = Math.abs(deger) / enBuyuk;
    var k = o > 0.55 ? 3 : (o > 0.22 ? 2 : 1);
    if (o < 0.02) return "n0";
    return (deger >= 0 ? "p" : "e") + k;
  }

  /** Komşusu ters işaretliyse hücre sınırdadır. */
  function sinirda(hucreler, j, i) {
    var c = hucreler[j][i];
    if (c.deger === null) return false;
    var im = c.deger >= 0;
    var komsu = [[j - 1, i], [j + 1, i], [j, i - 1], [j, i + 1]];
    for (var k = 0; k < komsu.length; k++) {
      var s = hucreler[komsu[k][0]];
      if (!s) continue;
      var d = s[komsu[k][1]];
      if (!d || d.deger === null) continue;
      if ((d.deger >= 0) !== im) return true;
    }
    return false;
  }

  /**
   * @param {Object} o
   *   izgara      duyarlilik() çıktısı: {x, y, hucreler, enBuyukMutlak, sinirVar}
   *   baslik      figcaption metni — grafiğin tek mesajı
   *   xEtiket     x ekseni adı
   *   yEtiket     y ekseni adı
   *   bicim       (deger) => string — hücre değeri biçimlendirici
   *   eksenBicim  (v) => string — her iki eksen için ortak biçimlendirici
   *   xBicim      (v) => string — yalnızca x ekseni (verilirse eksenBicim'i ezer)
   *   yBicim      (v) => string — yalnızca y ekseni
   *
   * İki eksen AYNI birimde olmak zorunda değil: ilk tüketicide ikisi de
   * yüzdeydi, ikincide (erken kapatma) x yüzde, y tutar. Tek biçimlendirici
   * varsayımı orada kırıldığı için ayrıştırıldı.
   *   artiAd      pozitif tarafın adı (lejant)
   *   eksiAd      negatif tarafın adı
   *   not         altyazı
   */
  function ciz(o) {
    var g = o.izgara;
    if (!g || !g.hucreler || !g.hucreler.length) return "";
    var bicim = o.bicim || function (v) { return String(Math.round(v)); };
    var eb = o.eksenBicim || function (v) { return "%" + v; };
    var xb = o.xBicim || eb;
    var yb = o.yBicim || eb;

    var basliklar = g.x.map(function (v) {
      return '<th scope="col">' + esc(xb(v)) + "</th>";
    }).join("");

    var satirlar = g.hucreler.map(function (satir, j) {
      var hucreler = satir.map(function (c, i) {
        var b = basamak(c.deger, g.enBuyukMutlak);
        var sinir = sinirda(g.hucreler, j, i) ? " ih-sinir" : "";
        if (c.deger === null) {
          return '<td class="ih-h ih-bos" aria-label="hesaplanamadı">—</td>';
        }
        var ad = (c.deger >= 0 ? o.artiAd : o.eksiAd) + " " + bicim(Math.abs(c.deger));
        return '<td class="ih-h ih-' + b + sinir + '" title="' + esc(ad) + '">' +
          '<span class="ih-deger">' + esc(bicim(c.deger)) + "</span></td>";
      }).join("");
      return '<tr><th scope="row">' + esc(yb(g.y[j])) + "</th>" + hucreler + "</tr>";
    }).join("");

    var lejant =
      '<div class="ih-lejant">' +
      '<span class="ih-l"><span class="ih-ornek ih-e3" aria-hidden="true"></span>' + esc(o.eksiAd) + "</span>" +
      '<span class="ih-l"><span class="ih-ornek ih-sinir-ornek" aria-hidden="true"></span>kararın döndüğü şerit</span>' +
      '<span class="ih-l"><span class="ih-ornek ih-p3" aria-hidden="true"></span>' + esc(o.artiAd) + "</span>" +
      "</div>";

    var uyari = g.sinirVar ? "" :
      '<p class="ih-uyari">Bu aralıkta karar hiç değişmiyor: her senaryoda ' +
      esc(g.hucreler[0][0].deger >= 0 ? o.artiAd : o.eksiAd) +
      " kazanıyor. Sınırı görmek için aralığı genişletin.</p>";

    return '<figure class="ih">' +
      "<figcaption>" + esc(o.baslik || "") + "</figcaption>" +
      '<div class="ih-sarmal"><table class="ih-tablo">' +
      "<caption>" + esc(o.yEtiket) + " (satır) × " + esc(o.xEtiket) + " (sütun)</caption>" +
      '<thead><tr><th scope="col"><span class="visually-hidden">' + esc(o.yEtiket) +
      "</span></th>" + basliklar + "</tr></thead>" +
      "<tbody>" + satirlar + "</tbody></table></div>" +
      lejant + uyari +
      (o.not ? '<p class="ih-not">' + esc(o.not) + "</p>" : "") +
      "</figure>";
  }

  return { ciz: ciz, basamak: basamak, sinirda: sinirda };
});
