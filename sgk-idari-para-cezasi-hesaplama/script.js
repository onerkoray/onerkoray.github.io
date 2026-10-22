/* SGK idari para cezası — sayfa katmanı.
   Hesap yapmaz: formu okur, SgkCeza çekirdeğine (hesap.js) verir, sonucu
   yazar. Girdiler paylaşılabilsin diye adreste yalnız # ile durur (durum.js). */
(function () {
  "use strict";
  var C = window.SgkCeza, D = window.Durum;
  var form = document.getElementById("pc-form");
  if (!C || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(v) { return nf.format(v) + " TL"; }
  function tl2(v) { return nf2.format(v).replace(/,00$/, "") + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/[\s.]/g, "");
    return /^\d+$/.test(s) ? +s : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  /* Adresteki durum: f fiil, g kim fark etti, n sigortalı, d defter, a ay sayısı, t ay, k 30 gün. */
  var ALAN = { f: "c-fiil", g: "c-giris", n: "c-sig", d: "c-defter", a: "c-aysay", t: "c-tarih", k: "c-kend" };
  function yukle() {
    if (!D) return;
    var q = D.oku();
    Object.keys(ALAN).forEach(function (k) {
      var v = q.get(k), el = $(ALAN[k]);
      if (v === null || !el) return;
      if (el.tagName === "SELECT" && !el.querySelector('option[value="' + v.replace(/"/g, "") + '"]')) return;
      el.value = v;
    });
  }
  function kaydet() {
    if (!D) return;
    var q = new URLSearchParams(), f = C.FIILLER[$("c-fiil").value];
    q.set("f", $("c-fiil").value);
    if (f.tespitli) q.set("g", $("c-giris").value);
    if (f.sigortali) q.set("n", $("c-sig").value);
    if (f.defter) q.set("d", $("c-defter").value);
    if (f.aySayisi) q.set("a", $("c-aysay").value);
    q.set("t", $("c-tarih").value);
    if (f.ceyrek) q.set("k", $("c-kend").value);
    D.yaz(q);
  }

  function alanlar() {
    var f = C.FIILLER[$("c-fiil").value];
    var tespit = f.tespitli && $("c-giris").value !== "gec";
    var goster = { giris: !!f.tespitli, sigortali: !!f.sigortali, defter: !!f.defter, aySayisi: !!f.aySayisi, kendiliginden: !!f.ceyrek && !tespit };
    document.querySelectorAll("[data-alan]").forEach(function (x) { x.hidden = !goster[x.getAttribute("data-alan")]; });
  }

  function girdi() {
    var f = C.FIILLER[$("c-fiil").value], t = $("c-tarih").value;
    if (!/^\d{4}-\d{2}$/.test(t)) throw new Error("Fiilin işlendiği ayı seçin.");
    return {
      fiil: $("c-fiil").value, iseGiris: $("c-giris").value, defter: $("c-defter").value,
      sigortali: f.sigortali ? sayi($("c-sig")) : 0, aySayisi: f.aySayisi ? sayi($("c-aysay")) : 0,
      yil: +t.slice(0, 4), ay: +t.slice(5, 7), kendiliginden30: $("c-kend").value === "evet"
    };
  }

  function hesapla() {
    alanlar();
    var hata = $("c-hata"), kutu = $("pc-sonuc"), g, h, yollar;
    try { g = girdi(); h = C.hesapla(g); yollar = C.yollar(g); }
    catch (e) { hata.textContent = e.message; kutu.classList.add("pc-bayat"); return; }
    hata.textContent = ""; kutu.classList.remove("pc-bayat");
    kaydet();

    var rozet = $("o-rozet");
    if (h.ceyrek) { rozet.textContent = "İki indirim birlikte"; rozet.className = "pc-rozet pc-iyi"; }
    else if (h.ceyrekUygun) { rozet.textContent = "30 gün geçti"; rozet.className = "pc-rozet pc-kotu"; }
    else { rozet.textContent = ""; rozet.className = "pc-rozet"; }

    $("o-pesin").textContent = tl(h.pesin);
    $("o-alt").textContent = "Tebliğ edilecek ceza " + tl(h.teblig) + " · indirim " + tl(h.indirim) + " (%" + nf2.format((1 - h.oran) * 100).replace(/,00$/, "") + ")";

    var k = [];
    function satir(dt, dd, s) { k.push("<div" + (s ? ' class="' + s + '"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"); }
    satir("Dayanak", esc(h.bent) + " (5510 s.K.)");
    satir("Brüt asgari ücret", tl2(h.asgari) + ' <span class="pc-kucuk">' + AY[h.ay - 1] + " " + h.yil + "</span>");
    satir("Hesap", '<span class="pc-kucuk">' + esc(h.aciklama) + "</span>");
    if (h.tavan !== null) satir("Üst sınır", tl(h.tavan) + (h.tavanUygulandi ? ' <span class="pc-kucuk">uygulandı</span>' : ""));
    satir("Tebliğ edilecek ceza", tl(h.teblig));
    satir("Kendiliğinden verme indirimi", h.ceyrek ? "dörtte bire iner" : (h.ceyrekUygun ? "yok: 30 gün geçti" : "bu cezada yok"));
    satir("15 gün içinde ödenirse", tl(h.pesin), "pc-ana");
    satir("15 gün geçerse", tl(h.teblig) + ' <span class="pc-kucuk">+ gecikme cezası ve zammı</span>');
    $("o-kalemler").innerHTML = k.join("");

    var enCok = yollar[yollar.length - 1].tutar || 1;
    var secili = h.ceyrek ? "k30" : (g.fiil === "iseGiris" && g.iseGiris !== "gec" ? g.iseGiris : (h.ceyrekUygun ? "k" : "pesin"));
    $("o-yollar").innerHTML = yollar.map(function (y) {
      var w = Math.max(1.5, y.tutar / enCok * 100);
      return '<li class="pc-yol' + (y.durum === secili ? " pc-secili" : "") + '"><span class="pc-yol-ad">' + esc(y.ad) + (y.odeme === "gec" ? " (+ gecikme)" : "") +
        '</span><span class="pc-yol-tutar">' + tl(y.tutar) + '</span><span class="pc-yol-cubuk" aria-hidden="true"><span style="width:' + w.toFixed(1) + '%"></span></span></li>';
    }).join("");

    var not = [];
    if (h.tavanUygulandi) not.push("Sigortalı sayısıyla büyüyen ceza üst sınıra takıldı; bundan sonra eklenen her sigortalı tutarı değiştirmez.");
    if (/^mphb/.test(g.fiil) && g.fiil !== "mphbTespit" && h.sifirBildirge) not.push("Nisan 2026 döneminden itibaren prim günü ve kazancı sıfır olan geç beyannameler de cezalı (SGK 2026/9 sayılı Genelge).");
    not.push("İtiraz ederseniz peşin ödeme indirimi gider; ödeyip dava açma hakkı korunur.");
    $("o-not").textContent = not.join(" ");
  }

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  yukle();
  hesapla();
})();
