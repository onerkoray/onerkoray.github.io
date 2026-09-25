/*!
 * Bağ-Kur, isteğe bağlı sigorta, GSS ve borçlanma — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar bordro/sgk-prim.js'ten; oranlar ve sınırlar
 * bordro/parametreler.js'ten gelir.
 */
(function () {
  "use strict";

  var S = window.SgkPrim;
  if (!S) return;
  function $(id) { return document.getElementById(id); }
  var form = $("sp-form"), cikti = $("sp-sonuc"), mesaj = $("sp-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function oran(o) { return "%" + String(Math.round(o * 10000) / 100).replace(".", ","); }

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.sp-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }
  function serit(ogeler) {
    return '<dl class="sp-olcu">' + ogeler.map(function (o) { return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function kip() { var s = form.querySelector('input[name="sp-kip"]:checked'); return s ? s.value : "bagkur"; }
  function gorunum() {
    var k = kip();
    $("sp-g-kazanc").hidden = !(k === "bagkur" || k === "istege");
    $("sp-g-gss").hidden = k !== "gss";
    $("sp-g-borc").hidden = k !== "borc";
  }
  var sn = S.sinirlar();

  function katTablosu() {
    var t = ['<div class="table-scroll"><table class="data-table sp-tablo"><caption>Kazanç seçimine göre aylık prim (' + sn.yil + ")</caption>",
      '<thead><tr><th scope="col">Kazanç</th><th scope="col">Bağ-Kur</th><th scope="col">Bağ-Kur, 5 puan indirimli</th><th scope="col">İsteğe bağlı</th></tr></thead><tbody>'];
    S.katTablosu([1, 1.5, 2, 3, 5, 9]).forEach(function (x) {
      t.push('<tr><th scope="row">' + tl(x.kazanc) + " (" + String(x.kat).replace(".", ",") + " kat)</th><td>" + tl(x.bagkur) + "</td><td>" + tl(x.bagkurIndirimli) + "</td><td>" + tl(x.istegeBagli) + "</td></tr>");
    });
    t.push("</tbody></table></div>");
    return t.join("");
  }

  function calistir() {
    gorunum();
    cikti.innerHTML = "";
    var k = kip(), h = [];
    try {
      if (k === "bagkur" || k === "istege") {
        var kz = sayi("sp-kazanc");
        if (kz === null) { mesaj.textContent = "Kazancı girin; hesap otomatik çalışır."; return; }
        if (k === "bagkur") {
          var b = S.bagkur(kz);
          h.push('<div class="sp-manset"><p>Aylık Bağ-Kur primi: <strong>' + tl(b.prim) + "</strong></p><p>Borcu olmayan ve düzenli ödeyene 5 puan indirimle " + tl(b.indirimli) + " (" + oran(b.indirimliOran) + ").</p></div>");
          h.push(serit([["Prime esas kazanç", tl(b.kazanc)], ["Oran", oran(b.oran)], ["Yıllık prim", tl(b.yillik)], ["Yıllık, indirimli", tl(b.yillikIndirimli)]]));
        } else {
          var i = S.istegeBagli(kz);
          h.push('<div class="sp-manset"><p>Aylık isteğe bağlı sigorta primi: <strong>' + tl(i.prim) + "</strong></p><p>Oran " + oran(i.oran) + ": malullük, yaşlılık ve ölüm %21 ile genel sağlık sigortası %12.</p></div>");
          h.push(serit([["Prime esas kazanç", tl(i.kazanc)], ["Oran", oran(i.oran)], ["Yıllık prim", tl(i.yillik)]]));
        }
        h.push(katTablosu());
      } else if (k === "gss") {
        var gl = sayi("sp-gelir");
        if (gl === null) { mesaj.textContent = "Kişi başı geliri girin; hesap otomatik çalışır."; return; }
        var gs = S.gss(gl);
        h.push('<div class="sp-manset"><p>' + (gs.devletOder ? "Prim <strong>devlet tarafından ödenir</strong>." : "Aylık GSS primi: <strong>" + tl(gs.prim) + "</strong>") + "</p>" +
          "<p>Kişi başı gelir " + tl(gl) + "; eşik brüt asgari ücretin üçte biri, " + tl(gs.esik) + ".</p></div>");
        h.push(serit([["Eşik (kişi başı)", tl(gs.esik)], ["Oran", oran(gs.oran) + " × asgari ücret"], ["Yıllık prim", tl(gs.yillik)]]));
      } else {
        var gun = sayi("sp-gun"), gk = sayi("sp-gunluk"), tur = $("sp-borc-tur").value;
        if (gun === null || gk === null) { mesaj.textContent = "Gün ve günlük kazancı girin; hesap otomatik çalışır."; return; }
        var bo = S.borclanma(gun, gk, tur);
        h.push('<div class="sp-manset"><p>' + bo.gun + " günlük " + (tur === "dogum" ? "doğum" : "hizmet") + " borçlanması: <strong>" + tl(bo.toplam) + "</strong></p>" +
          "<p>Günlük " + tl(bo.gunluk) + " (" + tl(bo.gunlukKazanc) + " × " + oran(bo.oran) + "). Aynı gün sayısında en az " + tl(bo.enAz) + ", en çok " + tl(bo.enCok) + ".</p></div>");
        var t = ['<div class="table-scroll"><table class="data-table sp-tablo"><caption>Gün sayısına göre borçlanma (en düşük ve en yüksek günlük kazançla)</caption>',
          '<thead><tr><th scope="col">Gün</th><th scope="col">En düşük</th><th scope="col">Seçtiğiniz kazançla</th><th scope="col">En yüksek</th></tr></thead><tbody>'];
        [180, 360, 540, 720].forEach(function (n) {
          var x = S.borclanma(n, gk, tur);
          t.push('<tr><th scope="row">' + n + " gün</th><td>" + tl(x.enAz) + "</td><td>" + tl(x.toplam) + "</td><td>" + tl(x.enCok) + "</td></tr>");
        });
        t.push("</tbody></table></div>");
        h.push(t.join(""));
      }
      cikti.innerHTML = h.join("");
      etiketle(cikti);
      mesaj.textContent = sn.yil + " oranları ve sınırlarıyla hesaplandı. Hesap tarayıcınızda yapıldı.";
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
