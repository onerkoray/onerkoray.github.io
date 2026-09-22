/*!
 * İki teklif karşılaştırma — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar teklif.js'ten, o da bordro/motor.js'ten
 * gelir. Buradaki iş girdi okumak ve sonucu yazmak.
 */
(function () {
  "use strict";

  var T = window.TeklifKarsilastirma, B = window.Bordro;
  if (!T || !B) return;

  var form = document.getElementById("tk-form");
  var cikti = document.getElementById("results");
  var mesaj = document.getElementById("msg");
  if (!form || !cikti) return;

  var nf = new Intl.NumberFormat("tr-TR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return nf.format(n) + " TL"; }
  function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
  function yuzde(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }

  function oku(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var t = String(el.value || "").trim();
    if (!t) return null;
    t = t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    var v = parseFloat(t);
    return isFinite(v) ? v : null;
  }

  (function yilDoldur() {
    var sec = document.getElementById("tk-yil");
    B.yillar().slice().sort(function (a, b) { return b - a; })
      .forEach(function (y) {
        var o = document.createElement("option");
        o.value = String(y); o.textContent = String(y);
        if (y === B.sonYil()) o.selected = true;
        sec.appendChild(o);
      });
  })();

  function turAdi(t) { return t === "net" ? "net üzerinden" : "brüt üzerinden"; }

  function kartla(o, kazandiMi) {
    return '<div class="tk-kart' + (kazandiMi ? " tk-kazanan" : "") + '">' +
      "<h3>" + o.ad + "</h3>" +
      '<p class="tk-kart-alt">' + tl0(o.tutar) + " " + turAdi(o.tur) + "</p>" +
      '<dl class="tk-olcu">' +
      '<div><dt>Yıllık toplam net</dt><dd class="tk-buyuk">' + tl(o.yilNet) + "</dd></div>" +
      "<div><dt>Aylık ortalama net</dt><dd>" + tl(o.ortalamaNet) + "</dd></div>" +
      "<div><dt>Ocak neti</dt><dd>" + tl(o.ocakNet) + "</dd></div>" +
      "<div><dt>Aralık neti</dt><dd>" + tl(o.aralikNet) + "</dd></div>" +
      "<div><dt>En düşük ay</dt><dd>" + o.dipAdi + " · " + tl(o.dipNet) + "</dd></div>" +
      "<div><dt>İşverene yıllık maliyet</dt><dd>" + tl(o.isverenMaliyeti) + "</dd></div>" +
      "<div><dt>Dilim yolculuğu</dt><dd>" +
        o.dilimYolu.map(yuzde).join(" → ") + "</dd></div>" +
      "</dl></div>";
  }

  function ciz(r) {
    var h = [];
    var f = r.fark;

    /* Manşet: yıl toplamı kimde. */
    h.push('<div class="tk-manset">');
    if (f.kazanan === null) {
      h.push("<p><strong>İki teklifin yıllık toplam neti aynı.</strong></p>");
    } else {
      var kazanan = f.kazanan === "a" ? r.a : r.b;
      h.push("<p><strong>" + kazanan.ad + "</strong> yıllık toplam nette " +
        "<strong>" + tl(Math.abs(f.yilNet)) + "</strong> önde.</p>");
      h.push("<p>Aylığa vurulduğunda " + tl(Math.abs(f.ortalamaNet)) + ".</p>");
    }
    h.push("</div>");

    /* Tersinme: varsa söylenir, yoksa söylenmez. */
    if (f.tersinme) {
      var ocakOnde = f.ocakNet > 0 ? r.a : r.b;
      var yilOnde = f.yilNet > 0 ? r.a : r.b;
      h.push('<div class="tk-tersinme"><h3>Ocakta önde olan, yılda geride</h3>' +
        "<p><strong>" + ocakOnde.ad + "</strong> ocakta " +
        tl(Math.abs(f.ocakNet)) + " önde görünüyor, ama yıl toplamında " +
        "<strong>" + yilOnde.ad + "</strong> " + tl(Math.abs(f.yilNet)) +
        " önde bitiriyor.</p>" +
        "<p>Sebebi: brüt üzerinden anlaşılan tarafta biriken matrah üst " +
        "dilimlere girdikçe net düşer; net üzerinden anlaşılan tarafta net " +
        "sabit kalır ve artan yükü işveren üstlenir.</p></div>");
    }

    h.push('<div class="tk-kartlar">');
    h.push(kartla(r.a, f.kazanan === "a"));
    h.push(kartla(r.b, f.kazanan === "b"));
    h.push("</div>");

    /* Ay ay tablo. */
    h.push('<div class="table-wrap"><table class="data-table">');
    h.push("<caption>İki teklifin ay ay net karşılaştırması</caption>");
    h.push('<thead><tr><th scope="col">Ay</th><th scope="col">' + r.a.ad +
      '</th><th scope="col">' + r.b.ad + '</th><th scope="col">Fark</th></tr></thead><tbody>');
    for (var i = 0; i < 12; i++) {
      var na = r.a.aylar[i].net, nb = r.b.aylar[i].net;
      h.push('<tr><th scope="row">' + r.a.aylar[i].ayAdi + "</th>" +
        "<td>" + tl(na) + "</td><td>" + tl(nb) + "</td>" +
        "<td>" + (na - nb > 0 ? "+" : "") + tl(na - nb) + "</td></tr>");
    }
    h.push('<tr class="tk-toplam"><th scope="row">Yıl toplamı</th>' +
      "<td>" + tl(r.a.yilNet) + "</td><td>" + tl(r.b.yilNet) + "</td>" +
      "<td>" + (f.yilNet > 0 ? "+" : "") + tl(f.yilNet) + "</td></tr>");
    h.push("</tbody></table></div>");

    h.push('<p class="muted-note tk-kapsam">Karşılaştırma yalnızca aylık ' +
      "ücretin bordro sonucunu ölçer. İkramiye, yan hak, izin ve iş " +
      "güvencesi hesaba girmez.</p>");

    cikti.innerHTML = h.join("");
  }

  function calistir() {
    var at = oku("tk-a-tutar"), bt = oku("tk-b-tutar");
    if (at === null || bt === null || at <= 0 || bt <= 0) {
      cikti.innerHTML = "";
      mesaj.textContent = "İki teklifin tutarını girin; karşılaştırma otomatik çalışır.";
      return;
    }
    try {
      var r = T.karsilastir({
        yil: parseInt(document.getElementById("tk-yil").value, 10),
        a: { ad: "Birinci teklif",
             tur: document.getElementById("tk-a-tur").value, tutar: at },
        b: { ad: "İkinci teklif",
             tur: document.getElementById("tk-b-tur").value, tutar: bt }
      });
      ciz(r);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı; girdiğiniz tutarlar " +
        "hiçbir yere gönderilmedi.";
    } catch (e) {
      cikti.innerHTML = "";
      mesaj.textContent = e.message;
    }
  }

  form.addEventListener("input", calistir);
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
