/*!
 * Bordro denetimi — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar bordro-denetim/denetim.js'ten, o da
 * bordro/motor.js'ten gelir. Buradaki iş yalnızca girdi okumak ve
 * sonucu yazmak.
 */
(function () {
  "use strict";

  var D = window.BordroDenetim, B = window.Bordro;
  if (!D || !B) return;

  var form = document.getElementById("bd-form");
  var cikti = document.getElementById("results");
  var mesaj = document.getElementById("msg");
  if (!form || !cikti) return;

  var nf = new Intl.NumberFormat("tr-TR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf.format(n) + " TL"; }

  /* "75.000,50" ve "75000.50" biçimlerinin ikisini de kabul et.
     Boş alan null döner: girilmeyen satır karşılaştırılmaz. */
  function oku(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var t = String(el.value || "").trim();
    if (!t) return null;
    t = t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    var v = parseFloat(t);
    return isFinite(v) ? v : null;
  }

  /* --- seçenek listelerini motordan doldur ------------------------- */
  (function doldur() {
    var yilSec = document.getElementById("bd-yil");
    var aySec = document.getElementById("bd-ay");
    B.yillar().slice().sort(function (a, b) { return b - a; })
      .forEach(function (y) {
        var o = document.createElement("option");
        o.value = String(y); o.textContent = String(y);
        if (y === B.sonYil()) o.selected = true;
        yilSec.appendChild(o);
      });
    B.AY_ADLARI.forEach(function (ad, i) {
      var o = document.createElement("option");
      o.value = String(i + 1); o.textContent = ad;
      aySec.appendChild(o);
    });
    aySec.value = String(Math.min(new Date().getMonth() + 1, 12));
  })();

  function satirSinifi(s) {
    if (s.sizin === null) return "bd-bos";
    return s.tamam ? "bd-tamam" : "bd-fark";
  }

  function veriListesi(v) {
    var out = [];
    Object.keys(v).forEach(function (k) {
      if (!isFinite(v[k])) return;
      out.push('<div class="bd-veri"><dt>' + k + "</dt><dd>" + tl(v[k]) + "</dd></div>");
    });
    return out.length ? '<dl class="bd-veri-blok">' + out.join("") + "</dl>" : "";
  }

  function ciz(r) {
    var h = [];

    h.push('<div class="bd-ozet"><p><strong>' + r.ayAdi + " " + r.yil +
      "</strong> · brüt " + tl(r.brut) + "</p>");
    if (r.ozet.girilenSatir === 0) {
      h.push("<p>Bordronuzdan hiç satır girmediniz; aşağıda yalnızca " +
        "beklenen tutarlar var.</p>");
    } else if (r.ozet.farkliSatir === 0) {
      h.push('<p class="bd-tamam-metin">Girdiğiniz ' + r.ozet.girilenSatir +
        " satırın tamamı beklenen tutarla aynı.</p>");
    } else {
      h.push('<p class="bd-fark-metin">' + r.ozet.farkliSatir + " satır " +
        "beklenenden farklı. Aşağıda her farkın ölçülebilir sebepleri var.</p>");
    }
    h.push("</div>");

    h.push('<div class="table-wrap"><table class="data-table">');
    h.push("<caption>Bordronuzdaki tutarlar ile beklenen tutarların " +
      "karşılaştırması</caption>");
    h.push('<thead><tr><th scope="col">Satır</th><th scope="col">Bordronuz</th>' +
      '<th scope="col">Beklenen</th><th scope="col">Fark</th></tr></thead><tbody>');
    r.satirlar.forEach(function (s) {
      h.push('<tr class="' + satirSinifi(s) + '"><th scope="row">' + s.ad + "</th>" +
        "<td>" + (s.sizin === null ? "—" : tl(s.sizin)) + "</td>" +
        "<td>" + tl(s.beklenen) + "</td>" +
        "<td>" + (s.fark === null ? "—" :
          (s.tamam ? "aynı" : (s.fark > 0 ? "+" : "") + tl(s.fark))) + "</td></tr>");
    });
    h.push("</tbody></table></div>");

    var farkli = r.satirlar.filter(function (s) { return s.tamam === false; });
    if (farkli.length) {
      h.push('<div class="bd-sebepler"><h3>Farkların ölçülebilir sebepleri</h3>');
      farkli.forEach(function (s) {
        h.push("<h4>" + s.ad + "</h4>");
        if (!s.sebepler.length) {
          h.push("<p>Bu satır için ölçülebilir bir sebep bulunamadı. " +
            "Aşağıdaki varsayımlardan biri sizin bordronuzda geçerli olmayabilir.</p>");
        }
        s.sebepler.forEach(function (x) {
          h.push("<p>" + x.metin + "</p>" + veriListesi(x.veri || {}));
        });
      });
      h.push("</div>");
    }

    h.push('<div class="bd-varsayim"><h3>Bu sonuç hangi varsayımlarla üretildi</h3><ul>');
    r.varsayimlar.forEach(function (v) { h.push("<li>" + v + "</li>"); });
    h.push("</ul>");
    h.push("<p>Kullanılan önceki kümülatif matrah: <strong>" +
      tl(r.kumulatifMatrah) + "</strong>" +
      (r.kumulatifMatrahVerildi ? " (sizin girdiğiniz)" : " (varsayımdan türetildi)") +
      "</p></div>");

    cikti.innerHTML = h.join("");
  }

  function calistir() {
    var brut = oku("bd-brut");
    if (brut === null || brut <= 0) {
      cikti.innerHTML = "";
      mesaj.textContent = "Brüt ücretinizi girin; denetim otomatik çalışır.";
      return;
    }
    try {
      var r = D.denetle({
        yil: parseInt(document.getElementById("bd-yil").value, 10),
        ay: parseInt(document.getElementById("bd-ay").value, 10),
        brut: brut,
        kumulatifMatrah: oku("bd-kumulatif"),
        bordro: {
          sgk: oku("bd-sgk"),
          issizlik: oku("bd-issizlik"),
          gelirVergisi: oku("bd-gv"),
          damga: oku("bd-damga"),
          net: oku("bd-net")
        },
        secenekler: {
          istisnasiz: !!document.getElementById("bd-istisnasiz").checked
        }
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
