/*!
 * Enflasyon hesaplama — arayüz.
 *
 * Hesap YAPMAZ: çarpan, dönem özeti ve yıllık oranlar finans/tufe-endeksi.js'ten
 * gelir; o da finans/tufe-serisi.js'i (TCMB, her iş günü) okur.
 */
(function () {
  "use strict";

  var E = window.TufeEndeksi;
  if (!E) return;
  function $(id) { return document.getElementById(id); }
  var form = $("en-form"), cikti = $("en-sonuc"), mesaj = $("en-mesaj"), grafikBlok = $("en-grafik-blok");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function yuzde(o) { return "%" + nf2.format(o * 100); }

  var ilkYil = +E.ilkAy.slice(0, 4), sonYil = +E.sonAy.slice(0, 4);
  function doldur(aySec, yilSec, varsayilan) {
    E.AY_ADLARI.forEach(function (ad, i) {
      var o = document.createElement("option");
      o.value = String(i + 1).padStart(2, "0"); o.textContent = ad;
      aySec.appendChild(o);
    });
    for (var y = sonYil; y >= ilkYil; y--) {
      var o = document.createElement("option");
      o.value = String(y); o.textContent = String(y);
      yilSec.appendChild(o);
    }
    aySec.value = varsayilan.slice(5); yilSec.value = varsayilan.slice(0, 4);
  }
  doldur($("en-bas-ay"), $("en-bas-yil"), "2020-01");
  doldur($("en-son-ay"), $("en-son-yil"), E.sonAy);
  $("en-kunye").insertAdjacentText("beforeend", " · Son veri: " + E.ayAdi(E.sonAy));

  function tarih(onek) { return $(onek + "-yil").value + "-" + $(onek + "-ay").value; }
  function oku() {
    var t = String($("en-tutar").value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? v : null;
  }

  var sonCizim = null;
  function grafik(bas, son) {
    var svg = $("en-grafik");
    var aylar = E.aylar().filter(function (a) { return a >= bas && a <= son; });
    /* Kabın gerçek genişliği: telefonda küçültülmüş 760'lık çizim yazıları okunmaz yapıyordu. */
    var W = Math.max(300, Math.min(900, Math.round(svg.parentNode.clientWidth || 760))), dar = W < 520;
    var H = dar ? 220 : 250, sol = dar ? 36 : 52, sag = dar ? 54 : 64, ust = 18, alt = 30, gw = W - sol - sag, gh = H - ust - alt;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    sonCizim = [bas, son];
    var ymax = E.carpan(bas, son), y0 = 1, y1 = Math.max(ymax * 1.05, 1.1);
    function X(i) { return sol + i / Math.max(1, aylar.length - 1) * gw; }
    function Y(v) { return ust + gh - (v - y0) / (y1 - y0) * gh; }
    var p = [];
    [1, 2, 4, 8, 16, 32].forEach(function (k) {
      if (k > y1) return;
      p.push('<line class="' + (k === 1 ? "eksen-cizgi" : "en-kat") + '" x1="' + sol + '" y1="' + Y(k).toFixed(1) +
        '" x2="' + (W - sag) + '" y2="' + Y(k).toFixed(1) + '"/><text class="eksen" x="' + (sol - 8) +
        '" y="' + (Y(k) + 4).toFixed(1) + '" text-anchor="end">' + k + "×</text>");
    });
    var d = "M" + aylar.map(function (a, i) { return X(i).toFixed(1) + "," + Y(E.carpan(bas, a)).toFixed(1); }).join(" L");
    p.push('<path class="en-seri" d="' + d + '"/>');
    /* Uç noktası: dönemin katı, çizginin sonunda yazılı. */
    var sx = X(aylar.length - 1), sy = Y(ymax);
    p.push('<circle class="en-uc" cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="4.5"/>' +
      '<text class="en-uc-yazi" x="' + (sx + 8).toFixed(1) + '" y="' + (sy + 4).toFixed(1) + '">' + nf2.format(ymax) + "×</text>");
    var adim = Math.max(1, Math.round(aylar.length / (dar ? 4 : 6)));
    aylar.forEach(function (a, i) {
      if (i % adim !== 0 && i !== aylar.length - 1) return;
      if (i !== aylar.length - 1 && aylar.length - 1 - i < adim / 2) return;
      p.push('<text class="eksen" x="' + X(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="' +
        (i === 0 ? "start" : i === aylar.length - 1 ? "end" : "middle") + '">' + a.slice(0, 4) + "</text>");
    });
    svg.innerHTML = p.join("");
  }

  function calistir() {
    var tutar = oku(), bas = tarih("en-bas"), son = tarih("en-son");
    cikti.innerHTML = ""; grafikBlok.hidden = true;
    if (tutar === null) { mesaj.textContent = "Tutarı ve iki tarihi seçin; hesap otomatik çalışır."; return; }
    try {
      if (!E.gecerli(bas) || !E.gecerli(son)) {
        throw new Error("Seçilen ay için henüz veri yok. Seri " + E.ayAdi(E.ilkAy) + " ile " + E.ayAdi(E.sonAy) + " arası.");
      }
      if (bas === son) throw new Error("İki farklı ay seçin.");
      var ileri = bas < son, a = ileri ? bas : son, b = ileri ? son : bas;
      var d = E.donem(a, b), karsilik = E.deger(tutar, bas, son);
      var h = [];
      h.push('<div class="en-manset"><p>' + E.ayAdi(bas) + " tarihindeki <strong>" + tl(tutar) +
        "</strong>, " + E.ayAdi(son) + " fiyatlarıyla <strong>" + tl(karsilik) + "</strong> eder.</p>" +
        "<p>" + (ileri
          ? "Aynı sepeti almak için " + nf2.format(d.carpan) + " kat para gerekiyor."
          : "Bugünkü tutar o tarihte " + nf2.format(1 / d.carpan) + " katı kadar mal alırdı.") + "</p></div>");
      h.push('<dl class="en-olcu">' +
        "<div><dt>Dönemin toplam enflasyonu</dt><dd>" + yuzde(d.toplam) + "</dd></div>" +
        "<div><dt>Yıllık ortalama (bileşik)</dt><dd>" + yuzde(d.yillik) + "</dd></div>" +
        "<div><dt>Alım gücü kaybı</dt><dd>" + yuzde(d.alimGucuKaybi) + "</dd></div>" +
        "<div><dt>Fiyatlar kaç kez ikiye katlandı</dt><dd>" + nf2.format(Math.log(d.carpan) / Math.LN2) + "</dd></div>" +
        "<div><dt>Dönem uzunluğu</dt><dd>" + d.ay + " ay</dd></div>" +
        "</dl>");
      h.push('<p class="muted-note">Paranızın alım gücünü bu dönemde koruyabilmesi için vergiler ' +
        "sonrası yılda ortalama <strong>" + yuzde(d.yillik) + "</strong> getiri gerekirdi.</p>");
      var ys = E.yillar(a, b);
      if (ys.length) {
        /* Çubuk yalnız göz için: değer yanında yazılı, ekran okuyucu çubuğu atlar. */
        var enBuyuk = Math.max.apply(null, ys.map(function (y) { return y.oran; }));
        h.push('<div class="table-wrap"><table class="data-table en-tablo"><caption>Dönemdeki yıllar, Aralık–Aralık TÜFE</caption>' +
          '<thead><tr><th scope="col">Yıl</th><th scope="col">Yıllık enflasyon</th><th scope="col" class="en-cubuk-bas"><span class="visually-hidden">Görsel</span></th></tr></thead><tbody>' +
          ys.map(function (y) {
            var w = enBuyuk > 0 ? Math.max(0, y.oran) / enBuyuk * 100 : 0;
            return '<tr><th scope="row">' + y.yil + "</th><td>" + yuzde(y.oran) + '</td><td class="en-cubuk" aria-hidden="true"><span style="inline-size:' + w.toFixed(1) + '%"></span></td></tr>';
          }).join("") +
          "</tbody></table></div>");
      }
      cikti.innerHTML = h.join("");
      grafikBlok.hidden = false;
      grafik(a, b);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı. Son veri: " + E.ayAdi(E.sonAy) + ".";
    } catch (e) {
      mesaj.textContent = e.message;
    }
  }

  $("en-cevir").addEventListener("click", function () {
    var ba = $("en-bas-ay").value, by = $("en-bas-yil").value;
    $("en-bas-ay").value = $("en-son-ay").value; $("en-bas-yil").value = $("en-son-yil").value;
    $("en-son-ay").value = ba; $("en-son-yil").value = by;
    calistir();
  });
  var bekle, boyut;
  window.addEventListener("resize", function () {
    clearTimeout(boyut);
    boyut = setTimeout(function () { if (sonCizim && !grafikBlok.hidden) grafik(sonCizim[0], sonCizim[1]); }, 120);
  });
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
