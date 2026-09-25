/*!
 * Veraset ve intikal vergisi hesaplama — arayüz.
 * Hesap YAPMAZ: bütün sayılar finans/veraset.js'ten gelir.
 */
(function () {
  "use strict";

  var V = window.Veraset;
  if (!V) return;
  function $(id) { return document.getElementById(id); }
  var form = $("vi-form"), cikti = $("vi-sonuc"), mesaj = $("vi-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function yuzde(o) { return "%" + nf2.format(o * 100); }
  function kesir(p) {
    var t = [[1, "tamamı"], [0.5, "1/2"], [0.25, "1/4"], [0.75, "3/4"], [0.375, "3/8"]];
    for (var i = 0; i < t.length; i++) if (Math.abs(p - t[i][0]) < 1e-9) return t[i][1];
    return yuzde(p);
  }
  function sayi(id) {
    var s = String($(id).value || "").trim();
    if (!s) return 0;
    var v = parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? v : 0;
  }

  for (var i = 0; i <= 8; i++) {
    var o = document.createElement("option");
    o.value = String(i); o.textContent = i === 0 ? "Yok" : String(i);
    if (i === 2) o.selected = true;
    $("vi-cocuk").appendChild(o);
  }

  function kip() { var r = form.querySelector('input[name="vi-kip"]:checked'); return r ? r.value : "miras"; }

  function mirasCiz() {
    var aile = { es: $("vi-es").checked, cocuk: +$("vi-cocuk").value, ebeveyn: +$("vi-ebeveyn").value };
    $("vi-ebeveyn-alan").hidden = aile.cocuk > 0;
    var r = V.miras({ tereke: { tasinmaz: sayi("vi-tasinmaz"), mevduat: sayi("vi-mevduat"), arac: sayi("vi-arac"), borc: sayi("vi-borc") }, aile: aile });
    var sinir = V.vergisizSinir(aile);
    var h = [];
    h.push('<div class="vi-manset"><p>' + (r.toplamVergi > 0
      ? "Toplam veraset ve intikal vergisi <strong>" + tl(r.toplamVergi) + "</strong>; terekenin " + yuzde(r.efektif) + "'i."
      : "<strong>Vergi çıkmıyor.</strong> Bütün mirasçıların payı istisna tutarının altında.") + "</p>" +
      "<p>Net tereke " + tl(r.tereke.net) + ". " + (sinir > 0
        ? "Bu aile yapısında vergi, net tereke " + tl(sinir) + " tutarını aşınca başlar."
        : "Ana-babaya istisna tanınmadığı için bu aile yapısında vergi ilk liradan başlar.") + "</p></div>");
    h.push('<div class="table-wrap"><table class="data-table vi-tablo"><caption>Mirasçı başına hesap</caption><thead><tr>' +
      '<th scope="col">Mirasçı</th><th scope="col">Pay</th><th scope="col">Hisse</th><th scope="col">İstisna</th>' +
      '<th scope="col">Matrah</th><th scope="col">Vergi</th><th scope="col">Taksit (6)</th></tr></thead><tbody>');
    r.mirascilar.forEach(function (m) {
      h.push('<tr><th scope="row">' + m.ad + "</th><td>" + kesir(m.pay) + "</td><td>" + tl(m.hisse) + "</td><td>" +
        (m.istisna ? tl(m.kullanilanIstisna) : "yok") + "</td><td>" + tl(m.matrah) + "</td><td>" + tl(m.vergi) + "</td><td>" + tl(m.taksit) + "</td></tr>");
    });
    h.push('<tr class="vi-toplam"><th scope="row">Toplam</th><td></td><td>' + tl(r.tereke.net) + "</td><td></td><td></td><td>" +
      tl(r.toplamVergi) + "</td><td>" + tl(r.toplamVergi / r.taksitSayisi) + "</td></tr></tbody></table></div>");
    if (r.mirascilar.some(function (m) { return m.kim === "ebeveyn"; })) {
      h.push('<p class="muted-note">Ana-babaya istisna tanınmaz (Kanun m.4/1-b); payları ilk liradan vergilenir.</p>');
    }
    h.push('<p class="muted-note">Taşınmazı emlak vergisi değeriyle girdiğinizden emin olun; belediyeden ya da emlak vergisi tahakkuk fişinden öğrenilir. Piyasa değeri girilirse vergi olduğundan yüksek görünür.</p>');
    return h.join("");
  }

  function bagisCiz() {
    var deger = sayi("vi-deger"), yakin = $("vi-yakin").value === "1";
    var b = V.bagis({ deger: deger, yakin: yakin });
    var m = V.miras({ tereke: deger, aile: { es: false, cocuk: 1 } });
    var h = [];
    h.push('<div class="vi-manset"><p>' + (b.vergi > 0
      ? "Bağışta veraset ve intikal vergisi <strong>" + tl(b.vergi) + "</strong>; değerin " + yuzde(b.efektif) + "'i."
      : "<strong>Vergi çıkmıyor.</strong> Değer 66.935 TL istisnanın altında.") + "</p>" +
      "<p>" + (yakin ? "Bağışlayan yakın akraba olduğu için ivazsız oranların yarısı uygulandı." : "Bağışlayan yakın akraba değil; ivazsız oranlar tam uygulandı.") + "</p></div>");
    h.push('<dl class="vi-olcu"><div><dt>İstisna</dt><dd>' + tl(b.istisna) + "</dd></div>" +
      "<div><dt>Matrah</dt><dd>" + tl(b.matrah) + "</dd></div>" +
      "<div><dt>Taksit (6)</dt><dd>" + tl(b.taksit) + "</dd></div>" +
      "<div><dt>Aynı değer tek çocuğa miras kalsaydı</dt><dd>" + tl(m.toplamVergi) + "</dd></div></dl>");
    if (yakin && b.vergi > m.toplamVergi) {
      h.push('<p class="muted-note">Aynı mal ölümle geçseydi vergi ' + tl(b.vergi - m.toplamVergi) +
        " daha az olurdu: mirasta istisna 2.907.136 TL, oranlar %1'den başlıyor. Karar vermeden önce tapu masrafları ve saklı pay gibi vergi dışı sonuçlara da bakın.</p>");
    }
    return h.join("");
  }

  function calistir() {
    var m = kip();
    $("vi-miras-alan").hidden = m !== "miras";
    $("vi-bagis-alan").hidden = m !== "bagis";
    try {
      cikti.innerHTML = m === "miras" ? mirasCiz() : bagisCiz();
      mesaj.textContent = "2026 tutarlarıyla hesaplandı. Hesap tarayıcınızda yapıldı.";
    } catch (e) {
      cikti.innerHTML = "";
      mesaj.textContent = e.message;
    }
  }
  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
