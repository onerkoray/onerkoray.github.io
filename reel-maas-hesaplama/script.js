/*!
 * Reel maaş hesaplama — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/reel-maas.js'ten; o da bordro
 * motorunu ve TÜFE endeksini okur.
 */
(function () {
  "use strict";

  var R = window.ReelMaas, E = window.TufeEndeksi;
  if (!R || !E) return;
  function $(id) { return document.getElementById(id); }
  var form = $("rm-form"), cikti = $("rm-sonuc"), mesaj = $("rm-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function yuzde(o) { return "%" + nf2.format(Math.abs(o) * 100); }
  function isaretli(o) { return (o >= 0 ? "+" : "−") + yuzde(o); }

  var ilkYil = +E.ilkAy.slice(0, 4), sonYil = +E.sonAy.slice(0, 4);
  function doldur(onek, varsayilan) {
    var ay = $(onek + "-ay"), yil = $(onek + "-yil");
    E.AY_ADLARI.forEach(function (ad, i) {
      var o = document.createElement("option");
      o.value = String(i + 1).padStart(2, "0"); o.textContent = ad; ay.appendChild(o);
    });
    for (var y = sonYil; y >= ilkYil; y--) {
      var o = document.createElement("option");
      o.value = String(y); o.textContent = String(y); yil.appendChild(o);
    }
    ay.value = varsayilan.slice(5); yil.value = varsayilan.slice(0, 4);
  }
  doldur("rm-eski", "2023-01");
  doldur("rm-yeni", E.sonAy);
  $("rm-kunye").insertAdjacentText("beforeend", " · Son fiyat verisi: " + E.ayAdi(E.sonAy));

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? v : null;
  }
  function uc(onek) {
    return { ay: $(onek + "-yil").value + "-" + $(onek + "-ay").value, tutar: sayi(onek + "-tutar"), tur: $(onek + "-tur").value };
  }

  function satir(dt, dd) { return "<div><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"; }

  function calistir() {
    var eski = uc("rm-eski"), yeni = uc("rm-yeni");
    cikti.innerHTML = "";
    if (eski.tutar === null || yeni.tutar === null) { mesaj.textContent = "İki maaşı ve tarihlerini girin; hesap otomatik çalışır."; return; }
    try {
      var r = R.karsilastir({ eski: eski, yeni: yeni });
      var h = [];
      var kazandi = r.reelDegisim >= 0;
      h.push('<div class="rm-manset"><p>' + (kazandi
        ? "Maaşınız enflasyonu <strong>yendi</strong>: alım gücünüz " + yuzde(r.reelDegisim) + " arttı."
        : "Maaşınız enflasyona <strong>yenildi</strong>: alım gücünüz " + yuzde(r.reelDegisim) + " azaldı.") + "</p>" +
        "<p>" + E.ayAdi(r.eski.ay) + " ile " + E.ayAdi(r.yeni.ay) + " arasında netiniz " + isaretli(r.nominalDegisim) +
        " değişti, fiyatlar " + nf2.format(r.fiyatCarpani) + " katına çıktı.</p></div>");
      h.push('<div class="rm-kartlar">' +
        '<div class="rm-kart"><span class="rm-kart-ad">Enflasyona göre olması gereken net</span><span class="rm-kart-deger">' + tl(r.gerekenNet) + "</span>" +
        '<span class="rm-kart-alt">' + (r.acik > 0 ? "Bugünkü netiniz bundan " + tl(r.acik) + " düşük." : "Bugünkü netiniz bunu " + tl(-r.acik) + " aşıyor.") + "</span></div>" +
        '<div class="rm-kart"><span class="rm-kart-ad">Alım gücü değişimi</span><span class="rm-kart-deger">' + isaretli(r.reelDegisim) + "</span>" +
        '<span class="rm-kart-alt">Yıllık ortalama ' + isaretli(r.yillikReel) + " · " + r.donem.ay + " ay</span></div>" +
        "</div>");
      var dl = ['<dl class="rm-olcu">'];
      dl.push(satir("Eski net (" + E.ayAdi(r.eski.ay) + ")", tl(r.eski.net) + (r.eski.brut ? " <small>brüt " + tl(r.eski.brut) + "</small>" : "")));
      dl.push(satir("Yeni net (" + E.ayAdi(r.yeni.ay) + ")", tl(r.yeni.net) + (r.yeni.brut ? " <small>brüt " + tl(r.yeni.brut) + "</small>" : "")));
      dl.push(satir("Dönemin enflasyonu", yuzde(r.donem.toplam)));
      if (r.eski.asgariKati && r.yeni.asgariKati) {
        dl.push(satir("Asgari ücretin katı", nf2.format(r.eski.asgariKati) + " → " + nf2.format(r.yeni.asgariKati)));
      }
      if (r.vergiEtkisi !== undefined) {
        dl.push(satir("Brütün reel değişimi", isaretli(r.brutReel)));
        dl.push(satir("Kesinti oranı", yuzde(r.eski.kesinti) + " → " + yuzde(r.yeni.kesinti)));
        dl.push(satir("Vergi ve primin payı", isaretli(r.vergiEtkisi)));
      }
      dl.push("</dl>");
      h.push(dl.join(""));
      var notlar = [];
      if (r.eski.asgariKati && r.yeni.asgariKati && r.yeni.asgariKati < r.eski.asgariKati) {
        notlar.push("Netiniz asgari ücrete yaklaştı: " + nf2.format(r.eski.asgariKati) + " kattan " +
          nf2.format(r.yeni.asgariKati) + " kata indi. Ücret dağılımındaki yeriniz aşağı kaydı.");
      }
      if (r.vergiEtkisi !== undefined && r.vergiEtkisi < -0.0005) {
        notlar.push("Kesinti oranınız yükseldi; netin reel değişimi brütünkünden " + yuzde(r.vergiEtkisi) + " daha kötü.");
      }
      if (!(r.eski.tur === "brut" && r.yeni.tur === "brut")) {
        notlar.push("İki tutarı da brüt girerseniz araç vergi ve primin payını ayrıca gösterir.");
      }
      h.push(notlar.map(function (n) { return '<p class="muted-note">' + n + "</p>"; }).join(""));
      cikti.innerHTML = h.join("");
      mesaj.textContent = "Hesap tarayıcınızda yapıldı; girdiğiniz tutarlar hiçbir yere gönderilmedi.";
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
