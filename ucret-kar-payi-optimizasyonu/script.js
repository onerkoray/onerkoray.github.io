/*!
 * Ücret–Kâr Payı Optimizasyonu — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir vergi formülü içermez. Optimizasyon
 * hesap.js'te, vergi hesabı ise sitenin çalışma biçimi çekirdeğinde.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var O = window.UcretKarPayi;
  if (!O) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return isFinite(n) ? para0.format(Math.round(n)) : "—"; }
  function yuzde(x) {
    if (!isFinite(x)) return "—";
    return "%" + (x * 100).toFixed(2).replace(".", ",");
  }
  function deger(id) { return O.sayi($(id).value); }

  function girdiTopla() {
    return {
      hasilat: deger("o-hasilat"),
      gider: deger("o-gider"),
      ihracatOrani: deger("o-ihracat") / 100,
      bagkurMatrahi: deger("o-bagkur"),
      bagkurIndirimi: $("o-bagkur-indirim").checked,
      adet: deger("o-adet")
    };
  }

  /* ------------------------------------------------------------------ *
   * Net–ücret eğrisi. Tek seri olduğu için lejant gerekmiyor; başlık
   * seriyi adlandırıyor. Optimum ve eşik doğrudan etiketli.
   * ------------------------------------------------------------------ */
  function grafikCiz(t) {
    var svg = $("o-grafik");
    if (!svg) return;
    if (!t.noktalar.length) { svg.innerHTML = ""; return; }

    var W = 760, H = 320, sol = 8, sag = 64, ust = 16, alt = 30;
    var gw = W - sol - sag, gh = H - ust - alt;

    var xs = t.noktalar.map(function (n) { return n.aylikUcret; });
    var ys = t.noktalar.map(function (n) { return n.net; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pay = (y1 - y0) * 0.12 || 1;
    y0 -= pay; y1 += pay;

    function X(v) { return sol + (v - x0) / Math.max(1e-9, x1 - x0) * gw; }
    function Y(v) { return ust + gh - (v - y0) / Math.max(1e-9, y1 - y0) * gh; }

    var p = [];
    [0.25, 0.5, 0.75].forEach(function (f) {
      var v = y0 + (y1 - y0) * f;
      p.push('<line class="eksen-cizgi" x1="' + sol + '" y1="' + Y(v) + '" x2="' +
        (W - sag) + '" y2="' + Y(v) + '"/>' +
        '<text class="eksen" x="' + (W - sag + 5) + '" y="' + (Y(v) + 4) + '">' +
        para(v) + "</text>");
    });

    if (t.esik && t.esik.aylikUcret > x0 && t.esik.aylikUcret < x1) {
      p.push('<line class="cizgi-esik" x1="' + X(t.esik.aylikUcret).toFixed(1) +
        '" y1="' + ust + '" x2="' + X(t.esik.aylikUcret).toFixed(1) + '" y2="' +
        (ust + gh) + '"/>' +
        '<text class="eksen" x="' + (X(t.esik.aylikUcret) + 5).toFixed(1) + '" y="' +
        (ust + 12) + '">beyan eşiği</text>');
    }

    p.push('<path class="seri-net" d="M' + t.noktalar.map(function (n) {
      return X(n.aylikUcret).toFixed(1) + "," + Y(n.net).toFixed(1);
    }).join(" L") + '"/>');

    var o = t.optimum;
    p.push('<circle class="opt-nokta" cx="' + X(o.aylikUcret).toFixed(1) + '" cy="' +
      Y(o.net).toFixed(1) + '" r="6"/>');
    p.push('<text class="eksen" x="' + X(o.aylikUcret).toFixed(1) + '" y="' +
      (Y(o.net) - 12).toFixed(1) + '" text-anchor="middle">optimum</text>');

    p.push('<text class="eksen" x="' + sol + '" y="' + (H - 8) + '">ücret yok</text>');
    p.push('<text class="eksen" x="' + (W - sag) + '" y="' + (H - 8) +
      '" text-anchor="end">' + para(x1) + " / ay</text>");

    svg.innerHTML = p.join("");
  }

  /* ------------------------------------------------------------------ *
   * Ana akış
   * ------------------------------------------------------------------ */
  function hesapla() {
    var g = girdiTopla();
    var t = O.tara(g);

    if (!t.optimum) {
      $("o-optimum").textContent = "—";
      $("o-optimum-alt").textContent =
        "Hasılat giderden büyük olmalı; şirketin dağıtacak kaynağı yok.";
      $("o-esik").hidden = true;
      $("o-tablo").innerHTML = "";
      $("o-grafik").innerHTML = "";
      return;
    }

    var o = t.optimum;
    $("o-optimum").textContent = para(o.aylikUcret) + " / ay";
    $("o-optimum-alt").textContent =
      "Yıllık net " + para(o.net) + " · efektif yük " + yuzde(o.efektifYuk) +
      ". Hiç ücret ödemeseydiniz " + para(t.kiyas.kazancUcretsizeGore) +
      " daha az kalırdı. Şirketin ödeyebileceği azami ücret " +
      para(t.fizibilUst) + "/ay.";

    /* Eşik uyarısı — aracın asıl bulgusu. */
    var e = t.esik;
    var uyari = $("o-esik");
    if (e && e.netKaybi > 1) {
      uyari.hidden = false;
      uyari.innerHTML = "<b>Beyan eşiği uçurumu</b>" +
        "Aylık ücreti <strong>" + para(e.aylikUcret) + "</strong>'nin üstüne " +
        "çıkarırsanız kâr payı beyan haddinin altına düşer, beyanname verilmez ve " +
        "kesilen stopaj mahsup edilemez. Yıllık netiniz <strong>" +
        para(e.netKaybi) + " azalır</strong> — ücreti artırdığınız hâlde. " +
        "Kaybedilen iade: " + para(e.kaybedilenIade) + ".";
    } else {
      uyari.hidden = true;
    }

    $("o-net").textContent = para(o.net);
    $("o-yuk").textContent = yuzde(o.efektifYuk);
    $("o-ucret-net").textContent = para(o.ucretNet);
    $("o-karpayi").textContent = para(o.karPayiEline);
    $("o-kv").textContent = para(o.kurumlarVergisi);
    $("o-stopaj").textContent = para(o.karPayiStopaji);
    $("o-iade").textContent = o.iadeGV > 0 ? para(o.iadeGV) : "—";
    $("o-beyan").textContent = o.beyanVar ? "veriliyor" : "verilmiyor";

    $("o-k-ucretsiz").textContent = para(t.kiyas.ucretsiz.net);
    $("o-k-optimum").textContent = para(o.net);
    $("o-k-azami").textContent = para(t.kiyas.azamiUcret.net);

    grafikCiz(t);

    var adim = Math.max(1, Math.round(t.noktalar.length / 16));
    var secili = t.noktalar.filter(function (n, i) {
      return i % adim === 0 ||
             Math.abs(n.aylikUcret - o.aylikUcret) < 1 ||
             (e && Math.abs(n.aylikUcret - e.aylikUcret) < 1.5);
    });
    $("o-tablo").innerHTML = secili.map(function (n) {
      var opt = Math.abs(n.aylikUcret - o.aylikUcret) < 1;
      var esik = e && Math.abs(n.aylikUcret - e.aylikUcret) < 1.5;
      return "<tr" + (opt ? ' class="opt-satir"' : (esik ? ' class="esik-satir"' : "")) +
        '><th scope="row">' + para(n.aylikUcret) + (opt ? " (optimum)" : "") + "</th><td>" +
        para(n.ucretNet) + "</td><td>" + para(n.karPayiEline) + "</td><td>" +
        (n.iadeGV > 0 ? para(n.iadeGV) : "—") + "</td><td>" +
        (n.beyanVar ? "var" : "yok") + "</td><td><strong>" + para(n.net) +
        "</strong></td><td>" + yuzde(n.efektifYuk) + "</td></tr>";
    }).join("");
  }

  var bekle = 0;
  function tetikle() { clearTimeout(bekle); bekle = setTimeout(hesapla, 120); }

  document.querySelectorAll("#hesapla input, #hesapla select").forEach(function (el) {
    el.addEventListener("input", tetikle);
    el.addEventListener("change", tetikle);
  });

  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
