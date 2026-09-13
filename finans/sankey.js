/*!
 * Sankey — akış diyagramı
 *
 * Görselleştirme katmanının üçüncü bileşeni. İlki (isi-haritasi.js) iki
 * parametreli karar yüzeyi, ikincisi (egri.js) tek değişkenli şekil içindi.
 * Bu, bir SİSTEMİN tamamını tek resimde göstermek için: neyin nereye
 * gittiği ve hangi kolun ne kadar kalın olduğu.
 *
 * NEYİ ANLATIR: "Kullanıcı bu görsele baktığında PARASININ NEREYE GİTTİĞİNİ
 * ve hangi kolun beklediğinden kalın olduğunu anlamalı." Tek tek tutarlar
 * ikincil; asıl bilgi oranlar.
 *
 * DÖRT TASARIM KARARI
 *
 * 1. KATMANLAR VERİDEN TÜRETİLİR, ELLE VERİLMEZ. Bir düğümün sütunu,
 *    kaynaklardan ona giden EN UZUN yol. Elle katman vermek, akış
 *    değiştiğinde sessizce yanlış bir resim üretirdi.
 *
 * 2. KALINLIK TEK KODLAMA DEĞİL. Her bağlantı ayrıca <title> ile tutarını
 *    söylüyor ve tablo yedeği zorunlu. Sankey'in en bilinen kusuru ince
 *    kolların okunamamasıdır; sayı her zaman erişilebilir olmalı.
 *
 * 3. RENK ANLAM TAŞIR, SÜSLEMEZ. Kesinti, gider, tasarruf ve açık ayrı
 *    anlam sınıfları. Vurgu rengi (--brand) KULLANILMAZ: o kullanıcı
 *    tercihi (beş palet) ve verinin anlamı temayla değişemez.
 *
 * 4. DAR EKRANDA KÜÇÜLTÜLMEZ. Sankey belirli bir genişliğin altında
 *    okunamaz hale gelir; sarmal yatay kaydırıyor ve tablo yedeği
 *    her zaman açık. Okunamayan bir grafiği "responsive" saymak,
 *    sorunu gizlemek olurdu.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.Sankey = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Koordinatlar 4'e bölünebilir sayılara oturuyor; yarım piksel hizasız
     kenar ve bulanık saç çizgisi üretiyor. */
  var G = { sol: 8, sag: 210, ust: 18, alt: 18, en: 960, dugumEn: 12, bosluk: 20 };

  /** Düğümün sütunu: kaynaklardan ona giden en uzun yol. */
  function katmanlar(dugumler, baglantilar) {
    var gelen = {}, giden = {};
    dugumler.forEach(function (d) { gelen[d.id] = []; giden[d.id] = []; });
    baglantilar.forEach(function (b) {
      if (giden[b.kaynak]) giden[b.kaynak].push(b);
      if (gelen[b.hedef]) gelen[b.hedef].push(b);
    });

    var kat = {};
    dugumler.forEach(function (d) { kat[d.id] = 0; });
    /* Döngüsüz akış varsayılıyor; yine de tur sayısı sınırlı ki bozuk
       bir girdi sonsuz döngüye çevirmesin. */
    for (var tur = 0; tur < dugumler.length + 1; tur++) {
      var degisti = false;
      baglantilar.forEach(function (b) {
        if (kat[b.hedef] < kat[b.kaynak] + 1) {
          kat[b.hedef] = kat[b.kaynak] + 1;
          degisti = true;
        }
      });
      if (!degisti) break;
    }
    return { kat: kat, gelen: gelen, giden: giden };
  }

  /**
   * @param {Object} o
   *   dugumler   [{id, ad, tur}]
   *   baglantilar[{kaynak, hedef, deger, tur}]
   *   baslik     figcaption — diyagramın tek mesajı
   *   bicim      (v) => string
   *   not        altyazı
   *   yukseklik  px (varsayılan 420)
   */
  function ciz(o) {
    var dugumler = (o.dugumler || []).slice();
    var baglantilar = (o.baglantilar || []).filter(function (b) {
      return isFinite(b.deger) && b.deger > 0;
    });
    if (!dugumler.length || !baglantilar.length) return "";
    var bicim = o.bicim || function (v) { return String(Math.round(v)); };
    var boy = Number(o.yukseklik) || 420;

    var k = katmanlar(dugumler, baglantilar);
    var enBuyukKat = 0;
    dugumler.forEach(function (d) { enBuyukKat = Math.max(enBuyukKat, k.kat[d.id]); });

    /* Düğüm büyüklüğü: giren ve çıkanın büyüğü. Bir düğüm hem kaynak hem
       hedefse ikisi eşit olmalı; değilse büyüğü çizilir ki akış kaybolmasın. */
    var buyukluk = {};
    dugumler.forEach(function (d) {
      var gir = k.gelen[d.id].reduce(function (a, b) { return a + b.deger; }, 0);
      var cik = k.giden[d.id].reduce(function (a, b) { return a + b.deger; }, 0);
      buyukluk[d.id] = Math.max(gir, cik);
    });

    /* Ölçek: en kalabalık sütunun toplamı çizim yüksekliğine sığmalı. */
    var sutunlar = [];
    for (var i = 0; i <= enBuyukKat; i++) sutunlar.push([]);
    dugumler.forEach(function (d) { sutunlar[k.kat[d.id]].push(d); });

    var cizimBoy = boy - G.ust - G.alt;
    var olcek = Infinity;
    sutunlar.forEach(function (s) {
      if (!s.length) return;
      var toplam = s.reduce(function (a, d) { return a + buyukluk[d.id]; }, 0);
      if (toplam <= 0) return;
      var bosluklar = (s.length - 1) * G.bosluk;
      olcek = Math.min(olcek, (cizimBoy - bosluklar) / toplam);
    });
    if (!isFinite(olcek) || olcek <= 0) olcek = 1;

    /* Konumlar */
    var yer = {};
    var sutunEn = enBuyukKat > 0
      ? (G.en - G.sol - G.sag - G.dugumEn) / enBuyukKat : 0;
    sutunlar.forEach(function (s, si) {
      var toplam = s.reduce(function (a, d) { return a + buyukluk[d.id]; }, 0);
      var yukseklik = toplam * olcek + (s.length - 1) * G.bosluk;
      var y = G.ust + (cizimBoy - yukseklik) / 2;
      var x = Math.round(G.sol + si * sutunEn);
      s.forEach(function (d) {
        var h = Math.max(2, buyukluk[d.id] * olcek);
        yer[d.id] = { x: x, y: Math.round(y), h: h, sutun: si };
        y += h + G.bosluk;
      });
    });

    /* Bağlantı uçları: her düğümde sırayla yığılıyor. */
    var cikOfs = {}, girOfs = {};
    dugumler.forEach(function (d) { cikOfs[d.id] = 0; girOfs[d.id] = 0; });

    var seritler = baglantilar.map(function (b) {
      var a = yer[b.kaynak], c = yer[b.hedef];
      if (!a || !c) return "";
      var kalin = Math.max(1, b.deger * olcek);
      var y0 = a.y + cikOfs[b.kaynak]; cikOfs[b.kaynak] += kalin;
      var y1 = c.y + girOfs[b.hedef]; girOfs[b.hedef] += kalin;
      var x0 = a.x + G.dugumEn, x1 = c.x;
      var om = (x0 + x1) / 2;
      var d =
        "M" + x0 + " " + y0 +
        "C" + om + " " + y0 + " " + om + " " + y1 + " " + x1 + " " + y1 +
        "L" + x1 + " " + (y1 + kalin) +
        "C" + om + " " + (y1 + kalin) + " " + om + " " + (y0 + kalin) +
        " " + x0 + " " + (y0 + kalin) + "Z";
      var ad = (adiniBul(b.kaynak) + " → " + adiniBul(b.hedef) + ": " + bicim(b.deger));
      return '<path class="sk-serit sk-' + esc(b.tur || "akis") + '" d="' + d +
        '"><title>' + esc(ad) + "</title></path>";
    }).join("");

    function adiniBul(id) {
      for (var i = 0; i < dugumler.length; i++) {
        if (dugumler[i].id === id) return dugumler[i].ad;
      }
      return id;
    }

    /* Düğümler ve etiketleri.
     *
     * HER ETİKET KENDİ DÜĞÜMÜNÜN DİKEY ORTASINA, SAĞINA yazılır.
     *
     * İlk sürümde çıkışı olan düğümlerin etiketi düğümün ÜSTÜNE konuyordu
     * (çıkan şeritlerin üstüne düşmesin diye). Sonuç, aynı sütundaki iki
     * etiketin çakışmasıydı: "Harcanabilir gelir" kendi düğümünün üstünde
     * duruyor, aynı sütundaki kısa "Damga vergisi" düğümünün etiketiyle
     * üst üste biniyordu.
     *
     * Etiket kendi düğümünün dikey bandında durursa bu çakışma sınıfı
     * TANIM GEREĞİ ortadan kalkar: bir sütundaki düğümler dikeyde
     * çakışmaz. Şeritlerin üstüne düşme sorunu ise yazıya hale vererek
     * (paint-order: stroke) çözülüyor — SVG'nin bu iş için standart yolu. */
    var kutular = dugumler.map(function (d) {
      var p = yer[d.id];
      if (!p) return "";
      var deger = bicim(buyukluk[d.id]);
      var kutu = '<rect class="sk-dugum sk-d-' + esc(d.tur || "ara") + '" x="' + p.x +
        '" y="' + p.y + '" width="' + G.dugumEn + '" height="' + p.h +
        '" rx="2"><title>' + esc(d.ad + ": " + deger) + "</title></rect>";
      var my = Math.round(p.y + p.h / 2);
      var etiket = '<text class="sk-ad" x="' + (p.x + G.dugumEn + 8) + '" y="' + my +
        '" dominant-baseline="middle">' + esc(d.ad) +
        '<tspan class="sk-deger" dx="6">' + esc(deger) + "</tspan></text>";
      return kutu + etiket;
    }).join("");

    /* Ekran okuyucu için akışın özeti. */
    var ozet = (o.baslik || "Akış diyagramı") + ". " +
      baglantilar.map(function (b) {
        return adiniBul(b.kaynak) + " " + adiniBul(b.hedef) + " " + bicim(b.deger);
      }).join("; ") + ".";

    var svg =
      '<svg viewBox="0 0 ' + G.en + " " + boy + '" role="img" ' +
      'aria-labelledby="sk-b sk-d" preserveAspectRatio="xMidYMid meet">' +
      '<title id="sk-b">' + esc(o.baslik || "") + "</title>" +
      '<desc id="sk-d">' + esc(ozet) + "</desc>" +
      seritler + kutular + "</svg>";

    var satirlar = baglantilar.map(function (b) {
      return "<tr><td>" + esc(adiniBul(b.kaynak)) + "</td><td>" +
        esc(adiniBul(b.hedef)) + "</td><td>" + esc(bicim(b.deger)) + "</td></tr>";
    }).join("");

    return '<figure class="sk">' +
      "<figcaption>" + esc(o.baslik || "") + "</figcaption>" +
      '<div class="sk-sarmal">' + svg + "</div>" +
      (o.not ? '<p class="sk-not">' + esc(o.not) + "</p>" : "") +
      '<details class="sk-tablo"><summary>Akışı tablo olarak gör</summary>' +
      '<table><thead><tr><th scope="col">Nereden</th><th scope="col">Nereye</th>' +
      '<th scope="col">Tutar</th></tr></thead><tbody>' + satirlar +
      "</tbody></table></details></figure>";
  }

  return { ciz: ciz, katmanlar: katmanlar };
});
