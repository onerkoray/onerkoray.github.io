/*!
 * Ne kadar kredi çekebilirim — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/kredi-limiti.js'ten; taksit formülü,
 * vergiler ve ödeme planı kredi aracından (kredi-hesaplama/hesap.js) gelir.
 */
(function () {
  "use strict";

  var L = window.KrediLimiti;
  if (!L) return;
  function $(id) { return document.getElementById(id); }
  var form = $("kl-form"), cikti = $("kl-sonuc"), mesaj = $("kl-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
  function yz(o, b) { return "%" + (b === 3 ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : nf2).format(o * 100); }
  var TUR = { ihtiyac: "ihtiyaç", tasit: "taşıt", konut: "konut" };

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.kl-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }
  function serit(ogeler) {
    return '<dl class="kl-olcu">' + ogeler.map(function (o) { return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function kart(ad, deger, alt) {
    return '<div class="kl-kart"><span class="kl-kart-ad">' + ad + '</span><span class="kl-kart-deger">' + deger + '</span><span class="kl-kart-alt">' + alt + "</span></div>";
  }

  function calistir() {
    var tur = $("kl-tur").value;
    var g = { tur: tur, aylikFaiz: sayi("kl-faiz"), vade: sayi("kl-vade"), taksit: sayi("kl-taksit"),
              gelir: sayi("kl-gelir") || 0, pay: (sayi("kl-pay") === null ? 40 : sayi("kl-pay")) / 100, mevcut: sayi("kl-mevcut") || 0 };
    cikti.innerHTML = "";
    if (g.aylikFaiz === null || g.vade === null) { mesaj.textContent = "Faiz ve vadeyi girin; hesap otomatik çalışır."; return; }
    try {
      var r = L.hesapla(g), p = r.plan, h = [];
      h.push('<div class="kl-manset"><p>' + r.girdi.vade + " ayda en fazla <strong>" + tl0(r.anapara) + "</strong> " + TUR[tur] + " kredisi çekebilirsiniz.</p>" +
        "<p>Aylık taksit " + tl(p.taksit) + " (bütçeniz " + tl(r.girdi.taksit) + "); toplam geri ödeme " + tl(p.toplamGeriOdeme) + ".</p></div>");
      h.push('<div class="kl-kartlar">' +
        kart("Faiz ve vergilerin toplamı", tl(p.toplamFaiz + p.toplamVergi), "Faiz " + tl0(p.toplamFaiz) + (p.toplamVergi > 0 ? " · KKDF ve BSMV " + tl0(p.toplamVergi) : " · vergi yok")) +
        kart("Faiz bir puan farklı olsaydı", (r.faizBirPuanDusuk === null ? "—" : "+" + tl0(r.faizBirPuanDusuk)),
          "Aylık %" + nf2.format(Math.max(0, r.girdi.aylikFaiz - 1)) + " faizle daha fazla; %" + nf2.format(r.girdi.aylikFaiz + 1) + " ile " + tl0(-r.faizBirPuanYuksek) + " daha az") +
        "</div>");
      h.push(serit([["Taksit bütçesi", tl(r.girdi.taksit)], ["Aylık maliyet (vergili)", yz(r.aylikMaliyetOrani, 3)],
        ["Toplam geri ödeme", tl0(p.toplamGeriOdeme)], ["Geri ödeme ÷ kredi", nf2.format(p.toplamGeriOdeme / r.anapara) + " kat"]]));

      var vadeler = tur === "konut" ? [60, 120, 180, 240] : [12, 24, 36, 48, 60];
      var f0 = r.girdi.aylikFaiz, faizler = [f0 - 1, f0 - 0.5, f0, f0 + 0.5, f0 + 1].filter(function (f) { return f >= 0; });
      var tb = L.tablo(g, vadeler, faizler);
      var t = ['<div class="table-scroll"><table class="data-table kl-tablo"><caption>Aynı taksitle çekilebilecek tutar: faiz ve vade</caption>',
        '<thead><tr><th scope="col">Aylık faiz</th>' + vadeler.map(function (n) { return '<th scope="col">' + n + " ay</th>"; }).join("") + "</tr></thead><tbody>"];
      tb.forEach(function (s) {
        t.push("<tr" + (Math.abs(s.faiz - f0) < 1e-9 ? ' class="kl-vurgu"' : "") + '><th scope="row">%' + nf2.format(s.faiz) + "</th>" +
          s.tutarlar.map(function (x) { return "<td>" + tl0(x) + "</td>"; }).join("") + "</tr>");
      });
      t.push("</tbody></table></div>");
      h.push(t.join(""));
      cikti.innerHTML = h.join("");
      etiketle(cikti);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı. Bankanın onayı ve BDDK sınırları ayrıca uygulanır.";
    } catch (e) {
      mesaj.textContent = e.message;
    }
  }
  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
