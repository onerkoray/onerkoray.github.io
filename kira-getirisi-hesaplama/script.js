/*!
 * Kira getirisi — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/kira-getirisi.js'ten; vergi kira
 * geliri motorundan, mevduat neti mevduat fonksiyonundan gelir.
 */
(function () {
  "use strict";

  var K = window.KiraGetirisi;
  if (!K) return;
  function $(id) { return document.getElementById(id); }
  var form = $("kg-form"), cikti = $("kg-sonuc"), mesaj = $("kg-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
  function yz(o) { return "%" + nf2.format(o * 100); }
  /* Kullanıcının girdiği oran: gereksiz sıfırsız (%25, %27,5). */
  function girdi(o) { return "%" + String(Math.round(o * 10000) / 100).replace(".", ","); }

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.kg-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }
  function serit(ogeler) {
    return '<dl class="kg-olcu">' + ogeler.map(function (o) { return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function kart(ad, deger, alt) {
    return '<div class="kg-kart"><span class="kg-kart-ad">' + ad + '</span><span class="kg-kart-deger">' + deger + '</span><span class="kg-kart-alt">' + alt + "</span></div>";
  }

  function calistir() {
    var g = {
      fiyat: sayi("kg-fiyat"), alimMasraf: (sayi("kg-masraf") || 0) / 100, aylikKira: sayi("kg-kira"), bosAy: sayi("kg-bos") || 0,
      yillikGider: sayi("kg-gider") || 0, digerGelir: sayi("kg-diger") || 0, kiraArtis: (sayi("kg-artis") || 0) / 100,
      degerArtis: (sayi("kg-deger") || 0) / 100, mevduatFaiz: sayi("kg-faiz"), sure: sayi("kg-sure")
    };
    cikti.innerHTML = "";
    if (g.fiyat === null || g.aylikKira === null || g.mevduatFaiz === null || g.sure === null) { mesaj.textContent = "Değerleri girin; hesap otomatik çalışır."; return; }
    try {
      var r = K.hesapla(g), i = r.ilkYil, h = [];
      h.push('<div class="kg-manset"><p>Brüt kira getirisi <strong>' + yz(r.brutGetiri) + "</strong>; vergi ve gider sonrası net <strong>" + yz(r.netGetiri) + "</strong>.</p>" +
        "<p>Aynı para bir yıllık mevduatta stopaj sonrası " + yz(r.mevduatNet) + " getirir.</p></div>");
      var bb = r.basabasDegerArtis;
      h.push('<div class="kg-kartlar">' +
        kart("Mevduatı yakalamak için gereken yıllık değer artışı", bb === null ? "—" : yz(bb),
          r.girdi.sure + " yılda; varsaydığınız değer artışı " + girdi(r.girdi.degerArtis) + (bb === null ? "" : (r.girdi.degerArtis >= bb ? " bunu aşıyor, konut önde" : " bunun altında, mevduat önde"))) +
        kart("Amortisman süresi", r.amortisman === null ? "—" : nf1.format(r.amortisman) + " yıl",
          r.dinamikAmortisman === null ? "Net kira pozitif değil" : "Kira her yıl " + girdi(r.girdi.kiraArtis) + " artarsa " + r.dinamikAmortisman + " yıl") +
        "</div>");
      h.push(serit([["Yıllık tahsil edilen kira", tl0(i.tahsil)], ["Gider", tl0(i.gider)],
        ["Kira vergisi (" + r.vergiYontemi + ")", tl(i.vergi)], ["Net kira", tl0(i.netKira)]]));
      var t = ['<div class="table-scroll"><table class="data-table kg-tablo"><caption>' + r.girdi.sure + " yıl sonra iki servet</caption>",
        '<thead><tr><th scope="col"></th><th scope="col">Konut</th><th scope="col">Mevduat</th></tr></thead><tbody>',
        '<tr><th scope="row">Başlangıçtaki para</th><td>' + tl0(r.maliyet) + "</td><td>" + tl0(r.maliyet) + "</td></tr>",
        '<tr><th scope="row">Konutun değeri</th><td>' + tl0(r.konutDeger) + "</td><td></td></tr>",
        '<tr><th scope="row">Net kiralar (mevduatta biriktirilmiş)</th><td>' + tl0(r.birikenKira) + "</td><td></td></tr>",
        '<tr class="kg-vurgu"><th scope="row">Toplam servet</th><td>' + tl0(r.konutServet) + "</td><td>" + tl0(r.mevduatServet) + "</td></tr>",
        "</tbody></table></div>"];
      h.push(t.join(""));
      h.push('<p class="muted-note">' + (r.istisna > 0 ? "Kira gelirine " + tl0(r.istisna) + " istisna uygulandı." : "Diğer gelirleriniz sınırı aştığı için istisna uygulanmadı.") +
        " Satış masrafı ve satış kazancı vergisi dahil değildir.</p>");
      cikti.innerHTML = h.join("");
      etiketle(cikti);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı; artış oranları ve faiz varsayımdır.";
    } catch (e) {
      mesaj.textContent = e.message;
    }
  }
  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
