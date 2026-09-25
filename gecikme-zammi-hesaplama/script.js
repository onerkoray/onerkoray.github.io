/*!
 * Gecikme zammı — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/gecikme-zammi.js'ten; oranlar GİB
 * tablosundan. Ödeme tarihi alanı ilk açılışta bugüne ayarlanır.
 */
(function () {
  "use strict";

  var G = window.GecikmeZammi;
  if (!G) return;
  function $(id) { return document.getElementById(id); }
  var form = $("gz-form"), cikti = $("gz-sonuc"), mesaj = $("gz-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function oran(o) { return "%" + String(Math.round(o * 1000) / 10).replace(".", ","); }
  function tr(s) { return s.split("-").reverse().join("."); }

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.gz-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }
  function serit(ogeler) {
    return '<dl class="gz-olcu">' + ogeler.map(function (o) { return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function kart(ad, deger, alt) {
    return '<div class="gz-kart"><span class="gz-kart-ad">' + ad + '</span><span class="gz-kart-deger">' + deger + '</span><span class="gz-kart-alt">' + alt + "</span></div>";
  }

  /* Ödeme tarihi: bugün (yerel gün). */
  var bugun = new Date();
  $("gz-odeme").value = bugun.getFullYear() + "-" + String(bugun.getMonth() + 1).padStart(2, "0") + "-" + String(bugun.getDate()).padStart(2, "0");
  etiketle(document);

  function calistir() {
    var tutar = sayi("gz-tutar"), vade = $("gz-vade").value, odeme = $("gz-odeme").value;
    cikti.innerHTML = "";
    if (tutar === null || !vade || !odeme) { mesaj.textContent = "Tutarı ve iki tarihi girin; hesap otomatik çalışır."; return; }
    try {
      var r = G.hesapla({ tutar: tutar, vade: vade, odeme: odeme }), h = [];
      if (!r.donemler.length) {
        h.push('<div class="gz-manset"><p>Vadesinde ya da önce ödenen borca <strong>gecikme zammı işlemez</strong>.</p></div>');
      } else {
        h.push('<div class="gz-manset"><p>Gecikme zammı: <strong>' + tl(r.zam) + "</strong></p><p>" + tr(odeme) + " tarihinde ödenecek toplam " + tl(r.toplam) +
          "; vadeden bu yana " + r.gun + " gün.</p></div>");
        var ilk = r.donemler[0], son = r.donemler[r.donemler.length - 1];
        h.push('<div class="gz-kartlar">' +
          kart("Toplam borç", tl(r.toplam), "Asıl " + tl(r.tutar) + " + zam " + tl(r.zam)) +
          kart("Borcun yüzde kaçı zam", "%" + nf2.format(r.zam / r.tutar * 100), r.donemler.length > 1 ? r.donemler.length + " oran dönemi" : "Tek oran: aylık " + oran(ilk.oran)) +
          "</div>");
        h.push(serit([["Gecikme", r.gun + " gün"], ["Şu anki oran", "aylık " + oran(r.guncelOran)], ["Yıllık basit karşılığı", oran(r.guncelOran * 12)],
          ["Son dönemde günlük zam", tl(r.tutar * son.oran / 30)]]));
        var t = ['<div class="table-scroll"><table class="data-table gz-tablo"><caption>Dönem dönem gecikme zammı</caption>',
          '<thead><tr><th scope="col">Dönem</th><th scope="col">Aylık oran</th><th scope="col">Süre</th><th scope="col">Zam</th></tr></thead><tbody>'];
        r.donemler.forEach(function (d) {
          t.push('<tr><th scope="row">' + tr(d.bas) + " – " + tr(d.son) + "</th><td>" + oran(d.oran) + "</td><td>" + (d.ay ? d.ay + " ay " : "") + d.gun + " gün</td><td>" + tl(d.zam) + "</td></tr>");
        });
        t.push('<tr class="gz-vurgu"><th scope="row">Toplam</th><td></td><td>' + r.gun + " gün</td><td>" + tl(r.zam) + "</td></tr></tbody></table></div>");
        h.push(t.join(""));
      }
      cikti.innerHTML = h.join("");
      etiketle(cikti);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı. Kesin tutarı vergi dairesi hesaplar; kuruş farkı olabilir.";
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
