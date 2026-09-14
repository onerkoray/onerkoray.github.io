/* Çıkış takvimi — form ile tarama motoru arasındaki köprü.
   Hesabın kendisi tarama.js'te; burada yalnızca girdi okunur ve sonuç
   yazılır. Bu ayrım bilinçli: motor Node'da test edilebiliyor, bu dosya
   DOM'a bağlı olduğu için edilemiyordu. */
(function () {
  "use strict";
  var T = window.CikisTakvimi;
  if (!T) return;

  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return isFinite(n) ? nf.format(Math.round(n)) : "—"; }
  function el(id) { return document.getElementById(id); }
  function deger(id) {
    var e = el(id);
    if (!e) return NaN;
    return parseFloat(String(e.value).replace(/\./g, "").replace(",", ".")
      .replace(/[^0-9.\-]/g, ""));
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function uzunTarih(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + AYLAR[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  /* Eşik kartı. Rozet rengi KODA göre değil TÜRE göre: hepsi aynı yönde
     (kazanç) olduğu için renkle ayırmak bilgi taşımaz, yalnızca gürültü
     üretirdi. Ayırt edici bilgi kuralın adı. */
  function esikKarti(e) {
    return '<li class="ct-esik">' +
      '<p class="ct-tarih"><time datetime="' + e.tarih + '">' +
      esc(uzunTarih(e.tarih)) + "</time>" +
      '<span class="ct-kalan">' + e.kalanGun + " gün sonra</span></p>" +
      '<p class="ct-kazanc">+' + tl(e.kazanc) + " TL</p>" +
      "<p class=\"ct-ad\">" + esc(e.ad) + "</p>" +
      '<p class="ct-aciklama">' + esc(e.aciklama) + "</p>" +
      "</li>";
  }

  function hesapla() {
    var g = {
      iseGiris: el("in-giris") ? el("in-giris").value : "",
      ciplakBrut: deger("in-brut"),
      giydirmeEkleri: deger("in-ekler") || 0,
      son3YilPrimGunu: deger("in-prim") || 0,
      bas: el("in-bas") ? el("in-bas").value : "",
      gun: deger("in-gun") || 365
    };
    var cikti = el("ct-out");
    if (!cikti) return;

    if (!g.iseGiris || !g.bas || !isFinite(g.ciplakBrut) || g.ciplakBrut <= 0) {
      cikti.innerHTML = '<p class="muted-note">İşe giriş tarihinizi, aylık ' +
        "çıplak brüt ücretinizi ve taramanın başlayacağı tarihi girin.</p>";
      return;
    }
    if (g.bas <= g.iseGiris) {
      cikti.innerHTML = '<p class="muted-note">Tarama başlangıcı işe giriş ' +
        "tarihinden sonra olmalı.</p>";
      return;
    }

    var r;
    try { r = T.tara(g); }
    catch (err) {
      cikti.innerHTML = '<p class="muted-note">Bu tarihler için doğrulanmış ' +
        "parametre yok. Tarama başlangıcını daha yakın bir tarihe alın.</p>";
      return;
    }

    var h = [];
    h.push('<p class="ct-ozet">Tarama <strong>' + esc(uzunTarih(g.bas)) +
      "</strong> ile <strong>" + esc(uzunTarih(r.ufuk)) +
      "</strong> arasını kapsıyor. Bu aralıkta bir gün daha çalışmak " +
      "toplamınıza ortalama <strong>" + tl(r.gunlukArtis) +
      " TL</strong> ekliyor.</p>");

    if (r.esikler.length) {
      h.push("<h3 class=\"proj-title\">Eşik günler</h3>");
      h.push('<ul class="ct-liste">' +
        r.esikler.map(esikKarti).join("") + "</ul>");
      var toplam = r.esikler.reduce(function (t, e) { return t + e.kazanc; }, 0);
      h.push('<p class="ct-toplam">Bu eşiklerin tamamının ötesine geçmek, ' +
        "günlük birikimin üstüne <strong>" + tl(toplam) +
        " TL</strong> daha ekliyor.</p>");
    } else {
      h.push('<p class="ct-yok">Bu aralıkta eşik yok. Ayrılma tarihiniz ' +
        "toplamınızı yalnızca çalıştığınız gün kadar değiştiriyor — " +
        "bir gün erken ya da geç ayrılmanın kademeli bir bedeli " +
        "bulunmuyor.</p>");
    }

    if (r.uyarilar.length) {
      h.push('<ul class="ct-uyari">' + r.uyarilar.map(function (u) {
        return "<li>" + esc(u.metin) + "</li>";
      }).join("") + "</ul>");
    }
    cikti.innerHTML = h.join("");
  }

  ["in-giris", "in-brut", "in-ekler", "in-prim", "in-bas", "in-gun"]
    .forEach(function (id) {
      var e = el(id);
      if (!e) return;
      e.addEventListener("input", hesapla);
      e.addEventListener("change", hesapla);
    });

  /* Tarama başlangıcı varsayılan olarak bugün. Boş bırakılırsa kullanıcı
     ne yazacağını düşünmek zorunda kalıyor; en olası cevap zaten bugün. */
  var bas = el("in-bas");
  if (bas && !bas.value) bas.value = new Date().toISOString().slice(0, 10);

  hesapla();
})();
