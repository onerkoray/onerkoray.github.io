/*!
 * Faiz dönüştürücü — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/faiz-donustur.js'ten; kredi vergileri
 * kredi aracından, mevduat stopajı mevduat fonksiyonundan gelir. Enflasyon
 * alanı, kullanıcı değiştirmediyse, son on iki aylık TÜFE ile doldurulur.
 */
(function () {
  "use strict";

  var Z = window.FaizDonustur, E = window.TufeEndeksi;
  if (!Z) return;
  function $(id) { return document.getElementById(id); }
  var form = $("fd-form"), cikti = $("fd-sonuc"), mesaj = $("fd-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf3 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  var nf4 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  function yz(o) { return "%" + nf2.format(o * 100); }
  function yz3(o) { return "%" + nf3.format(o * 100); }
  function isaretli(o) { return (o >= 0 ? "+" : "−") + "%" + nf2.format(Math.abs(o) * 100); }

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.fd-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }
  function serit(ogeler) {
    return '<dl class="fd-olcu">' + ogeler.map(function (o) { return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>"; }).join("") + "</dl>";
  }

  /* Enflasyon: son on iki ayın TÜFE değişimi, kullanıcı dokunmadıysa. */
  var enfElle = false;
  $("fd-enf").addEventListener("input", function () { enfElle = true; });
  if (E && E.sonAy) {
    var y = +E.sonAy.slice(0, 4), m = E.sonAy.slice(5), bas = (y - 1) + "-" + m;
    if (E.gecerli(bas)) {
      $("fd-enf").value = nf2.format(E.donem(bas, E.sonAy).toplam * 100);
      $("fd-ornek").textContent = "Kredi ve mevduat oranları örnektir. Enflasyon: TÜİK TÜFE, " + E.ayAdi(bas) + "–" + E.ayAdi(E.sonAy) + " (değiştirebilirsiniz).";
    }
  }
  var TUR_AD = { aylik: "Aylık", yillikBasit: "Yıllık basit", yillikBilesik: "Yıllık bileşik", gunluk: "Günlük" };

  function calistir() {
    var o = sayi("fd-oran"), kr = sayi("fd-kredi"), mv = sayi("fd-mevduat"), vd = sayi("fd-vade"), en = sayi("fd-enf");
    cikti.innerHTML = "";
    if (o === null || isNaN(o)) { mesaj.textContent = "Bir oran girin; hesap otomatik çalışır."; return; }
    try {
      var tur = $("fd-tur").value, d = Z.donustur(o / 100, tur), h = [];
      h.push('<div class="fd-manset"><p>' + TUR_AD[tur] + " %" + nf2.format(o) + " = yıllık bileşik <strong>" + yz(d.yillikBilesik) + "</strong></p>" +
        "<p>Aylık " + yz3(d.aylik) + " · yıllık basit " + yz(d.yillikBasit) + (d.ikiyeKatlanmaYil ? " · para " + nf2.format(d.ikiyeKatlanmaYil) + " yılda ikiye katlanır" : "") + "</p></div>");
      h.push(serit([["Aylık", yz3(d.aylik)], ["Yıllık basit (nominal)", yz(d.yillikBasit)], ["Yıllık bileşik (efektif)", yz(d.yillikBilesik)], ["Günlük", "%" + nf4.format(d.gunluk * 100)]]));

      var satirlar = [["Dönüştürdüğünüz oran", d.yillikBilesik, null]];
      if (kr !== null && !isNaN(kr)) {
        var k = Z.kredi(kr / 100, $("fd-kredi-tur").value);
        satirlar.push([k.tur.etiket + " maliyeti (aylık " + yz3(k.aylikMaliyet) + ", vergi payı " + yz(k.vergiPayi) + ")", k.yillikBilesik, "borc"]);
      }
      if (mv !== null && !isNaN(mv) && vd !== null && !isNaN(vd)) {
        var mm = Z.mevduat(mv / 100, vd);
        satirlar.push(["Mevduat neti (" + mm.gun + " gün, stopaj %" + String(mm.stopajOrani * 100).replace(".", ",") + ", yenilenerek)", mm.yillikNetBilesik, "alacak"]);
      }
      var enf = (en === null || isNaN(en)) ? null : en / 100;
      if (enf !== null) satirlar.push(["Enflasyon", enf, "enf"]);
      var t = ['<div class="table-scroll"><table class="data-table fd-tablo"><caption>Ortak ölçü: yıllık bileşik oran</caption>',
        '<thead><tr><th scope="col">Oran</th><th scope="col">Yıllık bileşik</th><th scope="col">Enflasyona göre reel</th></tr></thead><tbody>'];
      satirlar.forEach(function (s) {
        t.push('<tr><th scope="row">' + s[0] + "</th><td>" + yz(s[1]) + "</td><td>" + (enf === null || s[2] === "enf" ? "—" : isaretli(Z.reel(s[1], enf))) + "</td></tr>");
      });
      t.push("</tbody></table></div>");
      h.push(t.join(""));
      if (enf !== null && mv !== null && !isNaN(mv)) {
        var rm = Z.reel(Z.mevduat(mv / 100, vd).yillikNetBilesik, enf);
        h.push('<p class="muted-note">' + (rm >= 0 ? "Mevduatın net getirisi enflasyonu yıllık " + yz(rm) + " aşıyor." : "Mevduatın net getirisi enflasyonun yıllık " + yz(-rm) + " gerisinde; paranın alım gücü eriyor.") + "</p>");
      }
      cikti.innerHTML = h.join("");
      etiketle(cikti);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı. Kredi maliyetine dosya masrafı ve sigorta dahil değildir.";
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
