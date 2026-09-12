/* Emekli Aylığı — arayüz katmanı.
   Aylık bağlama oranları, alt sınır aylık ve dönem sınırları
   ../bordro/emeklilik-parametreleri.js içindedir; hesap
   ../bordro/emeklilik-motor.js'de. Bu dosya formu okur ve sonucu çizer.
   Parametrelerin kopyası burada tutulmaz. */
(function () {
  "use strict";
  var M = window.EmeklilikMotor;
  if (!M) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function yuzde(n) { return isFinite(n) ? nf.format(Math.round(n * 10000) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Türkçe sayı girişi: "7.200" binlik, "60000,50" ondalık. */
  function num(id) {
    var e = el(id);
    if (!e) return NaN;
    var ham = String(e.value).trim().replace(/\s/g, "");
    if (ham === "") return NaN;
    if (ham.indexOf(",") >= 0) {
      ham = ham.replace(/\./g, "").replace(",", ".");
    } else {
      var p = ham.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) ham = p.join("");
    }
    return parseFloat(ham);
  }

  function sumCard(label, value, note, vurgu) {
    return '<div class="sum-card' + (vurgu ? " sum-card--lead" : "") + '">' +
      '<span class="sum-label">' + label + '</span>' +
      '<strong class="sum-value">' + value + '</strong>' +
      '<span class="sum-note">' + note + "</span></div>";
  }

  /* Dönem katkısı: yığılmış tek çubuk.
     Parça-bütün ilişkisi olduğu için pasta değil yığılmış çubuk; iki-üç
     parçada pasta karşılaştırmayı zorlaştırır. Parçalar arasında 2px zemin
     boşluğu var ki bitişik dilimler birbirine akmasın. */
  function serit(satirlar, toplam) {
    if (!(toplam > 0)) return "";
    var parca = satirlar.map(function (s, i) {
      var p = (s.kismiAylik / toplam) * 100;
      return '<span class="ea-dilim ea-dilim-' + (i + 1) + '" style="--pay:' + p.toFixed(4) + '%" ' +
        'title="' + esc(s.ad) + ": " + fmt(s.kismiAylik) + ' TL"></span>';
    }).join("");
    var lejant = satirlar.map(function (s, i) {
      return '<span class="ea-lejant-oge"><span class="ea-nokta ea-dilim-' + (i + 1) +
        '" aria-hidden="true"></span>' + esc(s.ad) + "</span>";
    }).join("");
    return '<figure class="ea-serit-kutu">' +
      '<figcaption>Aylığın dönemlere göre bileşimi</figcaption>' +
      '<div class="ea-serit" role="img" aria-label="Kök aylığın dönemlere dağılımı">' + parca + "</div>" +
      '<div class="ea-lejant">' + lejant + "</div></figure>";
  }

  function recalc() {
    var results = el("results");
    var msg = el("msg");
    if (!results) return;

    var g = {
      baslangic: el("in-baslangic").value,
      bitis: el("in-bitis").value,
      primGun: num("in-gun"),
      ortalamaKazanc: num("in-kazanc")
    };

    if (!g.baslangic || !g.bitis) {
      results.innerHTML = "";
      msg.hidden = false;
      msg.textContent = "Her iki tarihi de girin.";
      return;
    }

    var r = M.hesapla(g);

    if (r.hata) {
      results.innerHTML = "";
      msg.hidden = false;
      msg.textContent = r.mesaj || (
        r.hata === "gosterge" ? "2000 öncesi hizmet bu araçta hesaplanmıyor." : r.hata
      );
      return;
    }
    msg.hidden = true;

    var kartlar = sumCard(
      "Ödenecek aylık",
      fmt(r.odenenAylik) + " TL",
      r.altUygulandi
        ? "Alt sınır aylık uygulandı (" + fmt(r.altSinir.tutar) + " TL)"
        : "Kök aylık, alt sınırın üzerinde",
      true
    ) + sumCard(
      "Kök aylık",
      fmt(r.kokAylik) + " TL",
      "Formülden çıkan tutar"
    ) + sumCard(
      "Karma aylık bağlama oranı",
      "%" + yuzde(r.karmaAbo),
      "Dönemlerin gün payına göre ağırlıklı ortalaması"
    ) + sumCard(
      "Toplam prim günü",
      nf0.format(r.primGun),
      "≈ " + nf.format(Math.round((r.primGun / 360) * 10) / 10) + " yıl"
    );

    var satirlarHtml = r.satirlar.map(function (s) {
      return "<tr><th scope=\"row\">" + esc(s.ad) +
        '<small>' + esc(s.dayanak) + "</small></th>" +
        "<td>" + nf0.format(Math.round(s.gun)) + "</td>" +
        "<td>%" + yuzde(s.payOrani) + "</td>" +
        "<td>%" + yuzde(s.abo) + "</td>" +
        "<td>" + fmt(s.kismiAylik) + " TL</td></tr>";
    }).join("");

    var tablo = '<div class="table-wrap"><table class="data-table ea-tablo">' +
      "<caption>Dönemlerin aylığa katkısı</caption>" +
      "<thead><tr><th scope=\"col\">Dönem</th><th scope=\"col\">Prim günü</th>" +
      "<th scope=\"col\">Gün payı</th><th scope=\"col\">ABO</th>" +
      "<th scope=\"col\">Kısmi aylık</th></tr></thead>" +
      "<tbody>" + satirlarHtml + "</tbody>" +
      '<tfoot><tr><th scope="row">Toplam</th><td>' + nf0.format(r.primGun) +
      "</td><td>%100,00</td><td>%" + yuzde(r.karmaAbo) + "</td><td>" +
      fmt(r.kokAylik) + " TL</td></tr></tfoot></table></div>";

    var uyari = "";
    if (r.altUygulandi) {
      uyari = '<p class="ea-uyari">Kök aylığınız (' + fmt(r.kokAylik) +
        " TL) yürürlükteki alt sınır aylığın (" + fmt(r.altSinir.tutar) +
        " TL) altında kaldı; ödenen tutar tabana yükseltildi. " +
        "Bu durumda fazladan prim ödemek, kök aylık tabanı geçene kadar " +
        "ödenen aylığı artırmaz.</p>";
    }

    var not = '<p class="ea-not">Bu sonuç, girdiğiniz <strong>ortalama güncellenmiş kazanca</strong> ' +
      "dayanan bir projeksiyondur. Gerçek ortalama, bütün çalışma hayatınızın kazançlarının " +
      "yıllık güncelleme katsayılarıyla taşınmasıyla bulunur ve yalnızca SGK kayıtlarında tamdır. " +
      "Emekliliğe hak kazanma koşulları (yaş, sigortalılık süresi) bu hesabın konusu değildir.</p>";

    results.innerHTML = '<div class="sum-grid">' + kartlar + "</div>" +
      serit(r.satirlar, r.kokAylik) + tablo + uyari + not;
  }

  var form = el("emeklilik-form");
  if (form) {
    form.addEventListener("input", recalc);
    form.addEventListener("change", recalc);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  recalc();
})();
