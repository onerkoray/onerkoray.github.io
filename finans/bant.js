/*!
 * Bant — üç senaryolu yaşam boyu servet eğrisi
 *
 * Finansal İkiz'in imza görseli ve görselleştirme katmanının dördüncüsü.
 * İlk üçü tek bir soruyu cevaplıyordu (ısı haritası: karar nerede döner,
 * eğri: şekil nedir, Sankey: ne nereye gider). Bu, BELİRSİZLİĞİ
 * gösteriyor — ve bunu bir dağılımdan değil, kullanıcının kendi üç
 * varsayımından alıyor.
 *
 * NEYİ ANLATIR: "Kullanıcı bu görsele baktığında, sonucun TEK BİR SAYI
 * OLMADIĞINI ve bandın ne kadar geniş olduğunu anlamalı." Ortadaki çizgi
 * bir tahmin değil, üç senaryodan biri.
 *
 * BEŞ TASARIM KARARI
 *
 * 1. BAND ÖNCE, ÇİZGİ SONRA. Medyan çizgisi bandın üstüne çiziliyor ama
 *    bandla aynı ağırlıkta değil. Tek çizgi çizip bandı silik bırakmak,
 *    kesinlik iddiası taşımayan bir modeli kesin gösterirdi.
 *
 * 2. SIFIR ÇİZGİSİ HER ZAMAN GÖRÜNÜR. Servet grafiğinde sıfırın nerede
 *    olduğu bilginin kendisi: bandın alt ucu sıfırın altına iniyorsa o
 *    senaryoda plan tutmuyor demektir ve bu göz kaçırılamamalı.
 *
 * 3. TÜKENME SONRASI FARKLI ÇİZİLİR. Varlık bittikten sonraki değerler
 *    bir servet tahmini değil, kapatılması gereken açığın büyüklüğü.
 *    Aynı çizgiyle devam etmek okuyucuya yanlış şey söylerdi.
 *
 * 4. OLAYLAR GRAFİĞE YAZILIR, AYRI BİR LİSTEYE DEĞİL. Kredinin bittiği
 *    yıl, emeklilik hedefi ve tükenme yılı grafiğin üstünde işaretli;
 *    finansal hayatın kırılma noktaları eğriyle aynı yerde okunmalı.
 *
 * 5. RENK VAR(--BRAND) DEĞİL. Vurgu rengi kullanıcı tercihi (beş palet);
 *    verinin anlamı temayla değişemez.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ikiz/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Bant = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var G = { sol: 72, sag: 24, ust: 28, alt: 44, en: 880, boy: 380 };

  function olcek(min, max, a, b) {
    var d = (max - min) || 1;
    return function (v) { return a + (v - min) / d * (b - a); };
  }

  function adim(aralik, hedef) {
    var ham = aralik / Math.max(1, hedef);
    var us = Math.pow(10, Math.floor(Math.log(ham) / Math.LN10));
    var n = ham / us;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * us;
  }

  /**
   * @param {Object} o
   *   bant       [{yil, yas, alt, orta, ust}]
   *   tukenmeYili  sayı | null — bu yıldan sonrası "açık", servet değil
   *   olaylar    [{yil, ad}] — grafiğe yazılacak kırılma noktaları
   *   baslik     figcaption
   *   xEtiket / yEtiket
   *   bicim      (v) => string  (y ekseni ve tablo)
   *   not        altyazı
   */
  function ciz(o) {
    var n = (o.bant || []).filter(function (p) {
      return isFinite(p.alt) && isFinite(p.orta) && isFinite(p.ust);
    });
    if (n.length < 2) return "";
    var bicim = o.bicim || function (v) { return String(Math.round(v)); };

    var xMin = n[0].yil, xMax = n[n.length - 1].yil;
    var yMin = Infinity, yMax = -Infinity;
    n.forEach(function (p) {
      yMin = Math.min(yMin, p.alt, p.orta, p.ust);
      yMax = Math.max(yMax, p.alt, p.orta, p.ust);
    });
    /* SIFIR HER ZAMAN ÖLÇEĞE DAHİL: bandın alt ucu sıfırın altına
       iniyorsa bu görünmek zorunda, ekseni veriye daraltıp gizlenemez. */
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
    var pay = (yMax - yMin) * 0.08 || 1;
    yMin -= pay; yMax += pay;

    var X = olcek(xMin, xMax, G.sol, G.en - G.sag);
    var Y = olcek(yMin, yMax, G.boy - G.alt, G.ust);
    var r0 = function (v) { return Math.round(v * 100) / 100; };

    /* --- y ızgarası --- */
    var yAdim = adim(yMax - yMin, 4);
    var izgara = "", yEtiketleri = "";
    for (var v = Math.ceil(yMin / yAdim) * yAdim; v <= yMax; v += yAdim) {
      var yy = Math.round(Y(v)) + 0.5;
      var sifirMi = Math.abs(v) < yAdim * 1e-6;
      izgara += '<line x1="' + G.sol + '" y1="' + yy + '" x2="' + (G.en - G.sag) +
        '" y2="' + yy + '" stroke="' + (sifirMi ? "var(--dv-axis)" : "var(--dv-grid)") +
        '" stroke-width="1"' + (sifirMi ? '' : ' ') + '/>';
      yEtiketleri += '<text x="' + (G.sol - 10) + '" y="' + (yy + 4) +
        '" text-anchor="end" class="bt-tik">' + esc(bicim(v)) + "</text>";
    }

    /* --- x etiketleri: baştan sona 5 nokta --- */
    var xEtiketleri = "";
    var adet = Math.min(6, n.length);
    for (var i = 0; i < adet; i++) {
      var idx = Math.round(i * (n.length - 1) / (adet - 1));
      var p = n[idx];
      xEtiketleri += '<text x="' + r0(X(p.yil)) + '" y="' + (G.boy - G.alt + 20) +
        '" text-anchor="middle" class="bt-tik">' + esc(String(p.yil)) + "</text>" +
        (p.yas ? '<text x="' + r0(X(p.yil)) + '" y="' + (G.boy - G.alt + 34) +
          '" text-anchor="middle" class="bt-tik bt-solgun">' + p.yas + " yaş</text>" : "");
    }

    /* --- band alanı --- */
    var ustYol = n.map(function (p, i) {
      return (i ? "L" : "M") + r0(X(p.yil)) + " " + r0(Y(p.ust));
    }).join(" ");
    var altYolTers = n.slice().reverse().map(function (p) {
      return "L" + r0(X(p.yil)) + " " + r0(Y(p.alt));
    }).join(" ");
    var alan = '<path class="bt-alan" d="' + ustYol + " " + altYolTers + ' Z"/>';

    /* --- medyan: tükenme öncesi ve sonrası AYRI çizilir --- */
    var tuk = o.tukenmeYili;
    function cizgi(sec, sinif) {
      var d = "", basladi = false;
      n.forEach(function (p) {
        if (!sec(p)) { basladi = false; return; }
        d += (basladi ? "L" : "M") + r0(X(p.yil)) + " " + r0(Y(p.orta)) + " ";
        basladi = true;
      });
      return d ? '<path class="' + sinif + '" d="' + d.trim() + '"/>' : "";
    }
    var oncesi = cizgi(function (p) { return !tuk || p.yil <= tuk; }, "bt-orta");
    /* Tükenme yılını iki parçaya da dahil ediyoruz ki çizgi kopmasın. */
    var sonrasi = tuk ? cizgi(function (p) { return p.yil >= tuk; }, "bt-orta bt-acik") : "";

    /* --- olay işaretleri --- */
    var olaylar = (o.olaylar || []).filter(function (e) {
      return e && isFinite(e.yil) && e.yil >= xMin && e.yil <= xMax;
    });
    var olayCizim = olaylar.map(function (e, i) {
      var x = r0(X(e.yil));
      /* Etiketler dönüşümlü olarak iki yükseklikte: yan yana gelen iki
         olayın yazısı üst üste binmesin. */
      var ty = G.ust - 12 + (i % 2) * 13;
      var sag = x > (G.en - G.sag + G.sol) / 2;
      return '<line x1="' + x + '" y1="' + (G.ust - 4) + '" x2="' + x +
        '" y2="' + (G.boy - G.alt) + '" class="bt-olay-cizgi"/>' +
        '<text x="' + (sag ? x - 5 : x + 5) + '" y="' + ty +
        '" text-anchor="' + (sag ? "end" : "start") + '" class="bt-olay">' +
        esc(e.ad) + "</text>";
    }).join("");

    var son = n[n.length - 1];
    var altmetin = (o.baslik || "") + ". " + xMin + " ile " + xMax +
      " arasında; " + xMax + " yılında kötümser senaryoda " + bicim(son.alt) +
      ", baz senaryoda " + bicim(son.orta) + ", iyimser senaryoda " +
      bicim(son.ust) + "." +
      (tuk ? " Kötümser senaryoda varlıklar " + tuk + " yılında tükeniyor." : "");

    var svg =
      '<svg viewBox="0 0 ' + G.en + " " + G.boy + '" role="img" ' +
      'aria-labelledby="bt-b bt-d" preserveAspectRatio="xMidYMid meet">' +
      '<title id="bt-b">' + esc(o.baslik || "") + "</title>" +
      '<desc id="bt-d">' + esc(altmetin) + "</desc>" +
      izgara + yEtiketleri + xEtiketleri + alan + olayCizim + oncesi + sonrasi +
      "</svg>";

    var lejant =
      '<div class="bt-lejant">' +
      '<span class="bt-l"><span class="bt-ornek bt-o-alan" aria-hidden="true"></span>kötümser–iyimser aralığı</span>' +
      '<span class="bt-l"><span class="bt-ornek bt-o-orta" aria-hidden="true"></span>baz senaryo</span>' +
      (tuk ? '<span class="bt-l"><span class="bt-ornek bt-o-acik" aria-hidden="true"></span>tükendikten sonrası: açık</span>' : "") +
      "</div>";

    var satirlar = n.map(function (p) {
      return "<tr><td>" + p.yil + "</td><td>" + (p.yas || "—") + "</td><td>" +
        esc(bicim(p.alt)) + "</td><td>" + esc(bicim(p.orta)) + "</td><td>" +
        esc(bicim(p.ust)) + "</td></tr>";
    }).join("");

    return '<figure class="bt">' +
      "<figcaption>" + esc(o.baslik || "") + "</figcaption>" +
      '<div class="bt-sarmal">' + svg + "</div>" + lejant +
      (o.not ? '<p class="bt-not">' + esc(o.not) + "</p>" : "") +
      '<details class="bt-tablo"><summary>Sayıları tablo olarak gör</summary>' +
      '<table><thead><tr><th scope="col">Yıl</th><th scope="col">Yaş</th>' +
      '<th scope="col">Kötümser</th><th scope="col">Baz</th>' +
      '<th scope="col">İyimser</th></tr></thead><tbody>' + satirlar +
      "</tbody></table></details></figure>";
  }

  return { ciz: ciz, adim: adim };
});
