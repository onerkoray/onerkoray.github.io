/* Araç ÖTV — arayüz katmanı.
 *
 * Oranlar, eşikler ve satır çözümü burada DEĞİL: tarife.js'te. Bu dosya
 * formu kanunun karar ağacına bağlar ve sonucu çizer.
 *
 * Formun işi: aracın hangi satıra düştüğünü KULLANICIYA SORDURTMAMAK.
 * Eskiden "Hibrit — HEV (>50 kW e-motor, ≤1800 cm³)" diye bir seçenek
 * vardı; koşul etikette yazıyordu ama hiç sorulmuyordu. Elektrik motoru
 * 20 kW olan bir mild hybrid sahibi de onu seçiyor ve %70 görüyordu.
 * Şimdi koşullar veri olarak soruluyor, satırı tarife.js belirliyor.
 */
(function () {
  "use strict";

  var T = window.OtvTarife;
  if (!T) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function num(id) {
    var e = el(id);
    if (!e) return NaN;
    return parseFloat(String(e.value).replace(/\./g, "").replace(",", "."));
  }
  function set(id, html) { var e = el(id); if (e) e.innerHTML = html; }
  function goster(id, acik) { var e = el(id); if (e) e.hidden = !acik; }

  function tablo(satirlar) {
    var html = '<table class="bd-table"><tbody>';
    satirlar.forEach(function (p) {
      var cls = p[2] ? ' class="' + p[2] + '"' : "";
      html += "<tr" + cls + '><th scope="row">' + p[0] + "</th><td>" + p[1] + "</td></tr>";
    });
    return html + "</tbody></table>";
  }

  /* Yığılmış çubuk: matrah / ÖTV / KDV. Parça-bütün ilişkisi olduğu için
     pasta değil yığılmış tek çubuk. */
  function serit(matrah, otv, kdv) {
    var toplam = matrah + otv + kdv;
    if (!(toplam > 0)) return "";
    function parca(v, cls, ad) {
      return '<span class="seg ' + cls + '" style="width:' + ((v / toplam) * 100).toFixed(2) +
        '%" title="' + ad + ": " + fmt(v) + " TL"+'"></span>';
    }
    function pay(v) { return ((v / toplam) * 100).toFixed(1); }
    return '<h3 class="proj-title">Fiyatın bileşimi <span class="muted-inline">— vergi yükü %' +
      pay(otv + kdv) + "</span></h3>" +
      '<div class="stack">' + parca(matrah, "seg-matrah", "Araç bedeli") +
      parca(otv, "seg-otv", "ÖTV") + parca(kdv, "seg-kdv", "KDV") + "</div>" +
      '<div class="stack-legend">' +
      '<span><i class="dot seg-matrah"></i>Araç bedeli %' + pay(matrah) + "</span>" +
      '<span><i class="dot seg-otv"></i>ÖTV %' + pay(otv) + "</span>" +
      '<span><i class="dot seg-kdv"></i>KDV %' + pay(kdv) + "</span></div>";
  }

  /* ÖTV kademeli olmadığı için eşiğin hemen üstü bir "uçurum"dur:
     1 TL fazla matrah, anahtar teslim fiyatı on binlerce lira artırır. */
  function esikNotu(r) {
    if (!r.satirNesnesi) return "";
    var f = T.esikFarki(r.satirNesnesi, r.matrah);
    if (!f) return "";
    if (r.matrah > f.esik * 1.10) return "";   // sınıra uzaksa gösterme
    return '<p class="edge-hint">Matrah ' + fmt(f.esik) +
      " TL'ye (bir alt dilime) inseydi anahtar teslim fiyat " + fmt(f.esikteToplam) +
      " TL olurdu — <strong>" + fmt(f.fark) +
      " TL fark</strong>. ÖTV kademeli değildir: eşik aşılınca üst oran " +
      "matrahın tamamına uygulanır.</p>";
  }

  function notlar(liste) {
    return liste.map(function (n) {
      return '<p class="bd-uyari" role="status">' + n + "</p>";
    }).join("");
  }

  function hesapla() {
    var tip = el("otv-tip").value;
    var hibrit = tip === "hibrit" || tip === "phev";

    /* Form kanunun o satır için sorduğu şeyleri gösteriyor. */
    goster("hacim-wrap", tip !== "elektrik");
    goster("ekw-wrap", hibrit);
    goster("co2-wrap", tip === "phev");
    goster("menzil-wrap", tip === "phev");
    goster("kw-wrap", tip === "elektrik");

    var r = T.hesapla({
      tur: tip,
      hacim: num("otv-hacim"),
      elektrikKw: hibrit ? num("otv-ekw") : NaN,
      co2: num("otv-co2"),
      menzil: num("otv-menzil"),
      kw: num("otv-kw"),
      matrah: num("otv-matrah")
    });

    if (r.hata) { set("otv-out", ""); return; }

    var satirlar = [
      ["ÖTV matrahı (vergisiz fiyat)", fmt(r.matrah) + " TL"],
      ["Uygulanan satır", r.satir],
      ["ÖTV oranı", "%" + r.oran],
      ["ÖTV tutarı", fmt(r.otv) + " TL"],
      ["KDV (%20, ÖTV dahil tutar üzerinden)", fmt(r.kdv) + " TL"],
      ["Anahtar teslim fiyat", fmt(r.toplam) + " TL", "bd-total"],
      ["Toplam vergi (ÖTV + KDV)", fmt(r.vergi) + " TL"]
    ];

    set("otv-out", tablo(satirlar) + notlar(r.notlar) +
      serit(r.matrah, r.otv, r.kdv) + esikNotu(r));
  }

  ["otv-tip", "otv-hacim", "otv-ekw", "otv-co2", "otv-menzil", "otv-kw", "otv-matrah"]
    .forEach(function (id) {
      var e = el(id);
      if (e) { e.addEventListener("input", hesapla); e.addEventListener("change", hesapla); }
    });

  hesapla();
})();
