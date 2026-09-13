/*!
 * Eğri — tek serili, tek mesajlı çizgi grafiği
 *
 * Görselleştirme katmanının ikinci bileşeni. İlki (isi-haritasi.js) iki
 * parametreli karar yüzeyi içindi; bu, tek bir değişkene göre bir oranın
 * NASIL BİR ŞEKİL ÇİZDİĞİNİ göstermek için. Yine soyut bir kütüphane değil:
 * gerçek bir tüketiciden (ek ödeme büyüdükçe elde kalan oranın tek yönlü
 * OLMAMASI) çıkarıldı.
 *
 * KAPSAMI BİLEREK DAR: TEK SERİ. Çok serili karşılaştırma başka bir
 * bileşendir — lejant, renk ayrımı ve erişilebilirlik kuralları farklıdır.
 * Bunu "genel amaçlı grafik kütüphanesi"ne çevirmek, hiçbir işi iyi
 * yapmayan bir şey üretirdi.
 *
 * DÖRT TASARIM KARARI
 *
 * 1. SIFIR TABANI YOK, VE BU SÖYLENİYOR. Çubuk sıfırdan başlamak zorundadır;
 *    çizgi değildir. Burada anlatılan şey seviyeler değil ŞEKİL, o yüzden
 *    eksen veriye göre daraltılıyor — ama y ekseni gerçek değerleri
 *    etiketliyor ve altyazı aralığı yazıyor, okuyucu aldatılmıyor.
 *
 * 2. İKİ NOKTA İŞARETLENİR, HEPSİ DEĞİL. Her noktaya sayı yazmak grafiği
 *    tabloya çevirir. Yalnızca TEPE (mesajın kendisi) ve KULLANICININ
 *    NOKTASI (kendini eğride bulsun diye) etiketleniyor.
 *
 * 3. RENK VAR(--BRAND) DEĞİL. Vurgu rengi kullanıcı tercihi (beş palet);
 *    veri markı temayla anlam değiştiremez. Çizgi --dv-1, kullanıcının
 *    noktası --dv-2.
 *
 * 4. TABLO YEDEĞİ ZORUNLU. Isı haritasında grafik zaten bir tabloydu;
 *    burada SVG olduğu için sayılar ayrıca <details> içinde veriliyor.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Egri = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Koordinatlar 4'e bölünebilir tam sayılara oturuyor; yarım piksel
     hizasız kenar üretiyor ve 1px saç çizgileri bulaniklasiyor. */
  var G = { sol: 56, sag: 16, ust: 16, alt: 32, en: 640, boy: 240 };

  function olcek(min, max, a, b) {
    var d = (max - min) || 1;
    return function (v) { return a + (v - min) / d * (b - a); };
  }

  /* Eksen için okunabilir adım.
     Saf 1-2-5 serisi bu grafikte fazla kabaydı: %61-%68 aralığında adım
     0,05'e yuvarlanıyor ve eksende TEK etiket kalıyordu. 2,5 basamağı
     eklendi; hâlâ okunabilir sayılar üretiyor ama aralığı boş bırakmıyor. */
  function adim(aralik, hedefAdet) {
    var ham = aralik / Math.max(1, hedefAdet);
    var us = Math.pow(10, Math.floor(Math.log(ham) / Math.LN10));
    var n = ham / us;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * us;
  }

  /**
   * @param {Object} o
   *   noktalar   [{x, y}] — x ve y sayı
   *   baslik     figcaption; grafiğin tek mesajı
   *   xEtiket / yEtiket
   *   xBicim / yBicim   (v) => string
   *   tepe       {x, y} — işaretlenecek tepe (isteğe bağlı)
   *   tepeAd     tepe etiketi
   *   secilen    {x, y} — kullanıcının kendi noktası (isteğe bağlı)
   *   secilenAd  etiketi
   *   not        altyazı
   */
  function ciz(o) {
    var n = (o.noktalar || []).filter(function (p) {
      return isFinite(p.x) && isFinite(p.y);
    });
    if (n.length < 2) return "";

    var xs = n.map(function (p) { return p.x; });
    var ys = n.map(function (p) { return p.y; });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    /* Şekil görünsün diye y ekseni veriye daraltılıyor; pay bırakılıyor ki
       tepe üst kenara yapışmasın. Bu daraltma altyazıda yazılı. */
    var pay = (yMax - yMin) * 0.18 || Math.abs(yMax) * 0.02 || 1;
    yMin -= pay; yMax += pay;

    var xb = o.xBicim || function (v) { return String(v); };
    var yb = o.yBicim || function (v) { return String(v); };

    var X = olcek(xMin, xMax, G.sol, G.en - G.sag);
    var Y = olcek(yMin, yMax, G.boy - G.alt, G.ust);
    var r0 = function (v) { return Math.round(v * 100) / 100; };

    /* --- ızgara ve eksen --- */
    var yAdim = adim(yMax - yMin, 4);
    var izgara = "", yEtiketleri = "";
    for (var v = Math.ceil(yMin / yAdim) * yAdim; v <= yMax; v += yAdim) {
      var yy = Math.round(Y(v)) + 0.5;      // 1px saç çizgisi net dursun
      izgara += '<line x1="' + G.sol + '" y1="' + yy + '" x2="' + (G.en - G.sag) +
        '" y2="' + yy + '" stroke="var(--dv-grid)" stroke-width="1"/>';
      yEtiketleri += '<text x="' + (G.sol - 8) + '" y="' + (yy + 4) +
        '" text-anchor="end" class="eg-tik">' + esc(yb(v)) + "</text>";
    }

    var xAdim = adim(xMax - xMin, 4);
    var xEtiketleri = "";
    for (var u = Math.ceil(xMin / xAdim) * xAdim; u <= xMax; u += xAdim) {
      xEtiketleri += '<text x="' + r0(X(u)) + '" y="' + (G.boy - G.alt + 18) +
        '" text-anchor="middle" class="eg-tik">' + esc(xb(u)) + "</text>";
    }

    /* --- çizgi --- */
    var d = n.map(function (p, i) {
      return (i ? "L" : "M") + r0(X(p.x)) + " " + r0(Y(p.y));
    }).join(" ");

    /* --- işaretli noktalar --- */
    function isaret(p, ad, renk, ustte) {
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return "";
      var cx = r0(X(p.x)), cy = r0(Y(p.y));
      var ty = ustte ? cy - 12 : cy + 20;
      /* Etiket sağ kenara taşmasın diye hizalama konuma göre seçiliyor. */
      var sag = cx > (G.en - G.sag + G.sol) / 2;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="' + renk +
        '" stroke="var(--surface)" stroke-width="2"/>' +
        '<text x="' + (sag ? cx - 8 : cx + 8) + '" y="' + ty +
        '" text-anchor="' + (sag ? "end" : "start") + '" class="eg-not">' +
        esc(ad) + "</text>";
    }

    var altmetin = (o.baslik || "") + ". " + (o.xEtiket || "x") + " " +
      xb(xMin) + " ile " + xb(xMax) + " arasında, " + (o.yEtiket || "y") + " " +
      yb(Math.min.apply(null, ys)) + " ile " + yb(Math.max.apply(null, ys)) + " arasında.";

    var svg =
      '<svg viewBox="0 0 ' + G.en + " " + G.boy + '" role="img" ' +
      'aria-labelledby="eg-b eg-d" preserveAspectRatio="xMidYMid meet">' +
      '<title id="eg-b">' + esc(o.baslik || "") + "</title>" +
      '<desc id="eg-d">' + esc(altmetin) + "</desc>" +
      izgara + yEtiketleri + xEtiketleri +
      '<line x1="' + G.sol + '" y1="' + (G.boy - G.alt) + '" x2="' + (G.en - G.sag) +
      '" y2="' + (G.boy - G.alt) + '" stroke="var(--dv-axis)" stroke-width="1"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--dv-1)" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      isaret(o.tepe, o.tepeAd || "", "var(--dv-1)", true) +
      isaret(o.secilen, o.secilenAd || "", "var(--dv-2)", false) +
      "</svg>";

    var satirlar = n.map(function (p) {
      return "<tr><td>" + esc(xb(p.x)) + "</td><td>" + esc(yb(p.y)) + "</td></tr>";
    }).join("");

    return '<figure class="eg">' +
      "<figcaption>" + esc(o.baslik || "") + "</figcaption>" +
      '<div class="eg-sarmal">' + svg + "</div>" +
      '<p class="eg-eksen"><span>' + esc(o.xEtiket || "") + " →</span>" +
      "<span>↑ " + esc(o.yEtiket || "") + "</span></p>" +
      (o.not ? '<p class="eg-alt">' + esc(o.not) + "</p>" : "") +
      "<details class=\"eg-tablo\"><summary>Sayıları tablo olarak gör</summary>" +
      '<table><thead><tr><th scope="col">' + esc(o.xEtiket || "x") +
      '</th><th scope="col">' + esc(o.yEtiket || "y") + "</th></tr></thead>" +
      "<tbody>" + satirlar + "</tbody></table></details>" +
      "</figure>";
  }

  return { ciz: ciz, adim: adim };
});
