/*!
 * Asgari ücret zammı senaryosu — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar bordro/asgari-senaryo.js'ten; o da bordro
 * motorunu varsayımsal bir yıl parametresiyle çalıştırır.
 */
(function () {
  "use strict";

  var A = window.AsgariSenaryo;
  if (!A) return;
  function $(id) { return document.getElementById(id); }
  var form = $("as-form"), cikti = $("as-sonuc"), mesaj = $("as-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function yuzde(o) { return "%" + nf2.format(Math.abs(o) * 100); }
  function isaretli(o) { return (o >= 0 ? "+" : "−") + yuzde(o); }
  function isaretliTl(n) { return (n >= 0 ? "+" : "−") + tl(Math.abs(n)); }
  function oran(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }
  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function satir(dt, dd) { return "<div><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"; }
  function gecisler(g) {
    return g.length ? g.map(function (x) { return AYLAR[x.ay - 1] + " (" + oran(x.oran) + ")"; }).join(", ") : "yok";
  }

  function calistir() {
    var asg = sayi("as-asgari"), tar = sayi("as-tarife"), brut = sayi("as-brut"), ucr = sayi("as-ucret");
    cikti.innerHTML = "";
    if (asg === null || tar === null || isNaN(asg) || isNaN(tar)) { mesaj.textContent = "Oranları girin; hesap otomatik çalışır."; return; }
    try {
      var g = { asgariArtis: asg / 100, tarifeArtis: tar / 100 };
      if (brut !== null) { g.brut = brut; if (ucr !== null) g.ucretArtis = ucr / 100; }
      var r = A.hesapla(g), h = [], E = r.asgari.eski, Y = r.asgari.yeni;

      h.push('<div class="as-manset"><p>' + r.hedef + " net asgari ücreti: <strong>" + tl(Y.net) + "</strong></p>" +
        "<p>Brüt " + tl(Y.brut) + " · " + r.baz + "'da net " + tl(E.net) + " · senaryo: zam " + oran(r.girdi.asgariArtis) +
        ", dilimler " + oran(r.girdi.tarifeArtis) + "</p></div>");

      var t = ['<div class="table-scroll"><table class="data-table as-tablo"><caption>Asgari ücret ve SGK tavanı</caption>',
        '<thead><tr><th scope="col"></th><th scope="col">' + r.baz + '</th><th scope="col">' + r.hedef + ' (senaryo)</th></tr></thead><tbody>',
        '<tr><th scope="row">Brüt asgari ücret</th><td>' + tl(E.brut) + "</td><td>" + tl(Y.brut) + "</td></tr>",
        '<tr><th scope="row">Net asgari ücret</th><td>' + tl(E.net) + "</td><td>" + tl(Y.net) + "</td></tr>",
        '<tr><th scope="row">İşverene maliyet</th><td>' + tl(E.maliyet) + "</td><td>" + tl(Y.maliyet) + "</td></tr>",
        '<tr><th scope="row">SGK tavanı</th><td>' + tl(E.tavan) + "</td><td>" + tl(Y.tavan) + "</td></tr>",
        "</tbody></table></div>"];
      h.push(t.join(""));

      var d = ['<div class="table-scroll"><table class="data-table as-tablo"><caption>Gelir vergisi dilimleri (ücret, yıllık matrah)</caption>',
        '<thead><tr><th scope="col">Oran</th><th scope="col">' + r.baz + ' üst sınırı</th><th scope="col">' + r.hedef + ' üst sınırı</th></tr></thead><tbody>'];
      r.dilimler.eski.forEach(function (x, i) {
        var y = r.dilimler.yeni[i];
        d.push("<tr><th scope=\"row\">" + oran(x[1]) + "</th><td>" + (x[0] === null ? "—" : nf0.format(x[0]) + " TL") + "</td><td>" + (y[0] === null ? "—" : nf0.format(y[0]) + " TL") + "</td></tr>");
      });
      d.push("</tbody></table></div>");
      h.push(d.join(""));

      if (r.ucret) {
        var u = r.ucret;
        h.push('<div class="as-kartlar">' +
          '<div class="as-kart"><span class="as-kart-ad">' + r.hedef + " yıllık net (" + tl(u.yeniBrut) + ' brüt)</span><span class="as-kart-deger">' + tl(u.yeni.toplam.net) + "</span>" +
          '<span class="as-kart-alt">' + r.baz + ": " + tl(u.eski.toplam.net) + " · net " + isaretli(u.netArtis) + ", brüt " + isaretli(u.brutArtis) + "</span></div>" +
          '<div class="as-kart"><span class="as-kart-ad">Dilimler asgari ücret kadar artsaydı</span><span class="as-kart-deger">' + (Math.abs(u.endeksFarki) < 0.005 ? "fark yok" : isaretliTl(u.endeksFarki)) + "</span>" +
          '<span class="as-kart-alt">' + (Math.abs(u.endeksFarki) < 0.005 ? "Dilimler asgari ücretle aynı oranda artıyor." : "Yıllık netinizdeki fark.") + "</span></div>" +
          "</div>");
        var e = ['<div class="table-scroll"><table class="data-table as-tablo"><caption>Yıllık netinizdeki değişimin kaynakları (sıralı ayrıştırma)</caption>',
          '<thead><tr><th scope="col">Adım</th><th scope="col">Yıllık nete etkisi</th></tr></thead><tbody>'];
        u.etkiler.forEach(function (x) { e.push("<tr><th scope=\"row\">" + x.ad + "</th><td>" + isaretliTl(x.net) + "</td></tr>"); });
        e.push('<tr class="as-toplam"><th scope="row">Toplam</th><td>' + isaretliTl(u.netDegisim) + "</td></tr></tbody></table></div>");
        h.push(e.join(""));

        /* Duyarlılık: dilimler asgari ücretten 5/10/15 puan az artarsa. */
        var s = ['<div class="table-scroll"><table class="data-table as-tablo"><caption>Dilimler asgari ücretten az artarsa bu maaşla yıllık kayıp</caption>',
          '<thead><tr><th scope="col">Dilim artışı</th><th scope="col">Yıllık net</th><th scope="col">Eşit artışa göre</th></tr></thead><tbody>'];
        [0, 0.05, 0.10, 0.15].forEach(function (fark) {
          var ta = r.girdi.asgariArtis - fark;
          if (ta < -0.5) return;
          var gg = { asgariArtis: r.girdi.asgariArtis, tarifeArtis: ta, brut: r.girdi.brut, ucretArtis: r.girdi.ucretArtis };
          var x = A.hesapla(gg).ucret;
          s.push("<tr><th scope=\"row\">" + oran(ta) + (fark ? " (" + Math.round(fark * 100) + " puan az)" : " (eşit)") + "</th><td>" + tl(x.yeni.toplam.net) +
            "</td><td>" + (fark ? "−" + tl(x.endeksFarki) : "—") + "</td></tr>");
        });
        s.push("</tbody></table></div>");
        h.push(s.join(""));

        var dl = ['<dl class="as-olcu">'];
        dl.push(satir("Ocak neti", tl(u.eski.ocakNet) + " → " + tl(u.yeni.ocakNet)));
        dl.push(satir("Aralık neti", tl(u.eski.aralikNet) + " → " + tl(u.yeni.aralikNet)));
        dl.push(satir("Dilim geçişleri " + r.baz, gecisler(u.eski.dilimGecisleri)));
        dl.push(satir("Dilim geçişleri " + r.hedef, gecisler(u.yeni.dilimGecisleri)));
        dl.push(satir("Asgari ücretin katı", nf2.format(u.asgariKati.eski) + " → " + nf2.format(u.asgariKati.yeni)));
        dl.push("</dl>");
        h.push(dl.join(""));
      }
      cikti.innerHTML = h.join("");
      mesaj.textContent = "Senaryo hesabıdır; resmî 2027 parametreleri açıklandığında sonuç değişir.";
    } catch (err) {
      mesaj.textContent = err.message;
    }
  }
  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
