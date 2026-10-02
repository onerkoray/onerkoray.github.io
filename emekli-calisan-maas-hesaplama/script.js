/* Emekli Çalışan Maaş Hesaplama — arayüz katmanı.
   Hesap YAPMAZ: karşılaştırma, eğri ve eşik ../bordro/sgdp.js'ten; oranlar
   ../bordro/parametreler.js'ten gelir. Bu dosya formu okur ve çizer. */
(function () {
  "use strict";
  var S = window.Sgdp, B = window.Bordro;
  if (!S || !B) return;

  function $(id) { return document.getElementById(id); }
  var form = $("ec-form"), cikti = $("ec-sonuc"), detay = $("ec-detay"), mesaj = $("ec-mesaj"), grafik = $("ec-grafik");
  if (!form || !cikti) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return nf.format(Math.round(n * 100) / 100) + " TL"; }
  function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
  function oran(o) { return "%" + String(Math.round(o * 10000) / 100).replace(".", ","); }
  function isaretli(n) { return (n >= 0 ? "+" : "−") + tl(Math.abs(n)); }

  /* Türkçe sayı girişi: "45.000" binlik, "45000,50" ondalık. */
  function sayi(id) {
    var ham = String($(id).value || "").trim().replace(/\s/g, "");
    if (ham === "") return null;
    if (ham.indexOf(",") >= 0) ham = ham.replace(/\./g, "").replace(",", ".");
    else {
      var p = ham.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) ham = p.join("");
    }
    var v = parseFloat(ham);
    return isFinite(v) ? v : NaN;
  }

  /* ---- form durumu ---- */
  var mod = "brut";
  Array.prototype.forEach.call(form.querySelectorAll('[data-secim="mod"]'), function (b) {
    b.addEventListener("click", function () {
      mod = b.getAttribute("data-deger");
      Array.prototype.forEach.call(form.querySelectorAll('[data-secim="mod"]'), function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
      $("ec-tutar-etiket").textContent = mod === "net" ? "Aylık net ücret (TL)" : "Aylık brüt ücret (TL)";
      calistir();
    });
  });

  var yilSec = $("ec-yil");
  B.yillar().forEach(function (y) {
    var o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === B.sonYil()) o.selected = true;
    yilSec.appendChild(o);
  });

  /* ---- grafik ---- */
  var egriOnbellek = {};
  function egri(yil, tesvik) {
    var k = yil + "|" + tesvik;
    if (!egriOnbellek[k]) egriOnbellek[k] = S.egri({ yil: yil, tesvik: tesvik });
    return egriOnbellek[k];
  }

  function adimBul(aralik, hedef) {
    var ham = aralik / hedef, us = Math.pow(10, Math.floor(Math.log10(ham)));
    var k = [1, 2, 2.5, 5, 10].filter(function (x) { return x * us >= ham; })[0];
    return k * us;
  }
  function kisa(n) {
    var m = Math.abs(n);
    var s = m >= 1e6 ? String(Math.round(m / 1e5) / 10).replace(".", ",") + " mn" : m >= 1000 ? nf0.format(Math.round(m / 1000)) + " bin" : nf0.format(m);
    return (n < 0 ? "−" : n > 0 ? "+" : "") + s;
  }

  var son = null;
  function ciz(g, r) {
    if (!grafik) return;
    son = { g: g, r: r };
    /* Kabın gerçek genişliğinde 1:1 çizilir: yazı her ekranda aynı punto.
       Dar ekranda seri etiketleri sağ boşluk yerine çizginin üstüne iner. */
    var W = Math.max(320, Math.round(grafik.clientWidth || 720)), dar = W < 560;
    var H = dar ? 300 : 340, sol = 66, sag = dar ? 10 : 118, ust = 18, alt = 44;
    var xMin = Math.min(g.asgariNet, g.asgariBrut), xMax = g.brut[g.brut.length - 1].tutar;
    var ys = g.brut.concat(g.net).map(function (p) { return p.maliyetFarki; }).concat([0]);
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var yAdim = adimBul(yMax - yMin, 5);
    yMin = Math.floor(yMin / yAdim) * yAdim; yMax = Math.ceil(yMax / yAdim) * yAdim;
    function X(v) { return sol + (v - xMin) / (xMax - xMin) * (W - sol - sag); }
    function Y(v) { return ust + (yMax - v) / (yMax - yMin) * (H - ust - alt); }
    function yol(seri) {
      return seri.map(function (p, i) { return (i ? "L" : "M") + X(p.tutar).toFixed(1) + " " + Y(p.maliyetFarki).toFixed(1); }).join(" ");
    }
    var p = [];
    p.push('<svg class="ec-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ec-g-bas ec-g-acik">');
    p.push('<title id="ec-g-bas">Emekli çalıştırmanın işverene yıllık maliyet farkı, ' + g.yil + "</title>");
    p.push('<desc id="ec-g-acik">Brüt anlaşmada fark her ücrette artı: emekli pahalı. Net anlaşmada ' +
      tl(g.esikNet) + " netin üstünde eksi: emekli ucuz. Fark, prime esas kazanç tavanında düzleşir.</desc>");
    for (var v = yMin; v <= yMax + 1e-6; v += yAdim) {
      p.push('<line class="ec-izgara" x1="' + sol + '" x2="' + (W - sag) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>');
      p.push('<text class="ec-eksen" x="' + (sol - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + kisa(v) + "</text>");
    }
    var xAdim = adimBul(xMax - xMin, 6);
    for (var t = Math.ceil(xMin / xAdim) * xAdim; t <= xMax; t += xAdim) {
      p.push('<text class="ec-eksen" x="' + X(t).toFixed(1) + '" y="' + (H - alt + 18) + '" text-anchor="middle">' + kisa(t).replace("+", "") + "</text>");
    }
    p.push('<text class="ec-eksen" x="' + ((sol + W - sag) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">anlaşılan aylık ücret, TL</text>');
    p.push('<line class="ec-sifir" x1="' + sol + '" x2="' + (W - sag) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/>');
    if (g.tavan < xMax) {
      p.push('<line class="ec-tavan" x1="' + X(g.tavan).toFixed(1) + '" x2="' + X(g.tavan).toFixed(1) + '" y1="' + ust + '" y2="' + (H - alt) + '"/>');
      p.push('<text class="ec-eksen" x="' + (X(g.tavan) - 6).toFixed(1) + '" y="' + (ust + 12) + '" text-anchor="end">SGK tavanı</text>');
    }
    var etkin = r && r.yil === g.yil && r.tesvik === g.tesvik;
    p.push('<path class="ec-seri ec-seri-brut' + (etkin && r.mod !== "brut" ? " ec-soluk" : "") + '" d="' + yol(g.brut) + '"/>');
    p.push('<path class="ec-seri ec-seri-net' + (etkin && r.mod !== "net" ? " ec-soluk" : "") + '" d="' + yol(g.net) + '"/>');
    var sb = g.brut[g.brut.length - 1], sn = g.net[g.net.length - 1];
    if (dar) {
      p.push('<text class="ec-etiket ec-etiket-brut" x="' + (W - sag) + '" y="' + (Y(sb.maliyetFarki) - 8).toFixed(1) + '" text-anchor="end">brütte anlaşma</text>');
      p.push('<text class="ec-etiket ec-etiket-net" x="' + (W - sag) + '" y="' + (Y(sn.maliyetFarki) - 8).toFixed(1) + '" text-anchor="end">netle anlaşma</text>');
    } else {
      p.push('<text class="ec-etiket ec-etiket-brut" x="' + (W - sag + 8) + '" y="' + (Y(sb.maliyetFarki) + 4).toFixed(1) + '">brütte anlaşma</text>');
      p.push('<text class="ec-etiket ec-etiket-net" x="' + (W - sag + 8) + '" y="' + (Y(sn.maliyetFarki) + 4).toFixed(1) + '">netle anlaşma</text>');
    }
    if (g.esikNet) {
      p.push('<circle class="ec-esik" cx="' + X(g.esikNet).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="4"/>');
    }
    if (etkin && r.calisilanAy === 12 && r.tutar >= xMin && r.tutar <= xMax) {
      var cx = X(r.tutar), cy = Y(r.fark.maliyetYil);
      p.push('<line class="ec-imlec" x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + Y(0).toFixed(1) + '" y2="' + cy.toFixed(1) + '"/>');
      p.push('<circle class="ec-nokta ec-nokta-' + r.mod + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5.5"/>');
      var sagda = cx < (W - sag) - 170;
      p.push('<text class="ec-deger" x="' + (cx + (sagda ? 10 : -10)).toFixed(1) + '" y="' + (cy + (r.fark.maliyetYil >= 0 ? -10 : 18)).toFixed(1) +
        '" text-anchor="' + (sagda ? "start" : "end") + '">sizin hesabınız: ' + kisa(r.fark.maliyetYil) + "</text>");
    }
    p.push("</svg>");
    grafik.innerHTML = p.join("");
    var esikYazi = $("ec-esik-yazi");
    if (esikYazi) esikYazi.textContent = g.esikNet ? "Halka eşiktir: " + g.yil + "'da " + tl(g.esikNet) + " net." : "";
  }

  /* ---- sonuç ---- */
  function kart(ad, deger, alt, sinif) {
    return '<div class="ec-kart' + (sinif ? " " + sinif : "") + '"><span class="ec-kart-ad">' + ad +
      '</span><strong class="ec-kart-deger">' + deger + '</strong><span class="ec-kart-alt">' + alt + "</span></div>";
  }

  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.ec-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }

  function calistir() {
    cikti.innerHTML = ""; detay.innerHTML = "";
    var tutar = sayi("ec-tutar"), aylik = sayi("ec-aylik");
    var yil = Number(yilSec.value), tesvik = $("ec-tesvik").value, giris = Number($("ec-giris").value);
    var g;
    try { g = egri(yil, tesvik); } catch (e) { mesaj.textContent = e.message; return; }
    if (tutar === null) { ciz(g, null); mesaj.textContent = "Tutarı girin; hesap otomatik çalışır."; return; }
    var r;
    try {
      r = S.karsilastir({ tutar: tutar, mod: mod, yil: yil, tesvik: tesvik, aylik: aylik || 0, girisAyi: giris });
    } catch (e) { ciz(g, null); mesaj.textContent = e.message; return; }

    var e1 = r.aylar.filter(function (a) { return a.calisti; })[0];
    var ilkAy = e1.ayAdi.toLowerCase();
    var h = [];
    var yonMetni = r.hukum.yon === "pahali" ? "daha pahalı" : r.hukum.yon === "ucuz" ? "daha ucuz" : "aynı";
    h.push('<p class="ec-hukum">Bu anlaşmada emekli çalıştırmak işverene yılda <strong>' + tl(r.hukum.tutar) + " " + yonMetni + "</strong>" +
      (r.calisilanAy < 12 ? " (" + r.calisilanAy + " ay)" : "") + ".</p>");
    var neden = mod === "brut"
      ? "Brüt aynı; işveren emekli için " + oran(r.oranlar.emekliIsveren) + ", emekli olmayan için " + oran(r.oranlar.normalIsveren) + " öder."
      : (r.kirpilan.emekli.length
        ? "Emeklinin brütü asgari ücretin altına inemediği için ona hedeften fazla net ödenir (" + r.kirpilan.emekli.length + " ay). Eşik " + tl(g.esikNet) + " net."
        : "Net aynı; emeklinin kesintisi az olduğundan aynı net daha düşük brütle verilir (" + ilkAy + ": " + tl(e1.emekli.brut) + " yerine " + tl(e1.normal.brut) + ").");
    h.push('<p class="ec-neden">' + neden + "</p>");

    var kartlar = kart("İşverene yıllık maliyet, emekli", tl(r.emekli.toplam.isverenMaliyeti), "emekli olmayan: " + tl(r.normal.toplam.isverenMaliyeti), mod === "brut" ? "ec-kart-brut" : "ec-kart-net");
    if (mod === "brut") {
      kartlar += kart("Emeklinin " + ilkAy + " neti", tl(e1.emekli.net), "emekli olmayan: " + tl(e1.normal.net)) +
        kart("Yıllık net farkı", isaretli(r.fark.netYil), "aynı brütte emeklinin fazlası");
    } else {
      kartlar += kart("Emeklinin " + ilkAy + " brütü", tl(e1.emekli.brut), "emekli olmayan: " + tl(e1.normal.brut));
      if (r.kirpilan.emekli.length) kartlar += kart("Emekliye fazladan net", isaretli(r.fark.netYil), r.kirpilan.emekli.length + " ay asgari ücrete takıldı");
    }
    if (r.aylik > 0) kartlar += kart("Aylık + maaş, ayda ortalama", tl0(r.toplamGelir.aylikOrtalama), "yılda " + tl0(r.toplamGelir.yillik) + "; SGDP aylığı ne artırır ne keser");
    else kartlar += kart("1 TL net için maliyet", tl(r.birNet.emekli), "emekli olmayan: " + tl(r.birNet.normal));
    h.push('<div class="ec-kartlar">' + kartlar + "</div>");
    cikti.innerHTML = h.join("");
    h = [];

    function satir(ad, a, b, on) {
      return '<tr><th scope="row">' + ad + '</th><td class="sayi">' + (on || "") + tl(a) + '</td><td class="sayi">' + (on || "") + tl(b) + "</td></tr>";
    }
    var a = e1.emekli, b = e1.normal;
    h.push('<div class="table-scroll"><table class="data-table ec-tablo"><caption>' + e1.ayAdi + " " + r.yil + " bordrosu</caption>" +
      '<thead><tr><th scope="col">Kalem</th><th scope="col" class="sayi">Emekli (SGDP)</th><th scope="col" class="sayi">Emekli olmayan</th></tr></thead><tbody>' +
      satir("Brüt ücret", a.brut, b.brut) +
      '<tr><th scope="row">Prim kesintisi</th><td class="sayi">− ' + tl(a.sgk) + " (" + oran(r.oranlar.emekliIsci) + ')</td><td class="sayi">− ' +
        tl(b.sgk + b.issizlik) + " (" + oran(r.oranlar.normalIsci) + ")</td></tr>" +
      satir("Gelir vergisi", a.gelirVergisi, b.gelirVergisi, "− ") +
      satir("Damga vergisi", a.damga, b.damga, "− ") +
      '<tr class="ec-vurgu"><th scope="row">Net ücret</th><td class="sayi">' + tl(a.net) + '</td><td class="sayi">' + tl(b.net) + "</td></tr>" +
      '<tr><th scope="row">İşveren primi</th><td class="sayi">+ ' + tl(a.isverenSgk + a.isverenIssizlik) + " (" + oran(r.oranlar.emekliIsveren) + ')</td><td class="sayi">+ ' +
        tl(b.isverenSgk + b.isverenIssizlik) + " (" + oran(r.oranlar.normalIsveren) + ")</td></tr>" +
      '<tr class="ec-vurgu"><th scope="row">İşverene maliyet</th><td class="sayi">' + tl(a.isverenMaliyeti) + '</td><td class="sayi">' + tl(b.isverenMaliyeti) + "</td></tr>" +
      "</tbody></table></div>");

    var aylikSutun = r.aylik > 0;
    var satirlar = r.aylar.map(function (x) {
      if (!x.calisti) return '<tr class="ec-bos"><th scope="row">' + x.ayAdi + '</th><td colspan="' + (aylikSutun ? 6 : 5) + '">işe girişten önce</td></tr>';
      return '<tr><th scope="row">' + x.ayAdi + (x.dilimGecisi ? ' <span class="ec-dilim">dilim ' + oran(x.emekli.dilim) + "</span>" : "") + "</th>" +
        '<td class="sayi">' + tl(x.emekli.brut) + '</td><td class="sayi">' + tl(x.emekli.net) + '</td><td class="sayi">' + tl(x.normal.net) +
        '</td><td class="sayi">' + isaretli(x.maliyetFarki) + "</td>" +
        (aylikSutun ? '<td class="sayi">' + tl(x.eleGecen) + "</td>" : "") + "</tr>";
    }).join("");
    h.push('<details class="ec-aylar"><summary>Ay ay döküm: vergi dilimi ilerledikçe net değişir</summary>' +
      '<div class="table-scroll"><table class="data-table ec-tablo"><caption class="visually-hidden">Ay ay döküm</caption>' +
      '<thead><tr><th scope="col">Ay</th><th scope="col" class="sayi">Brüt, emekli</th><th scope="col" class="sayi">Net, emekli</th>' +
      '<th scope="col" class="sayi">Net, emekli olmayan</th><th scope="col" class="sayi">Maliyet farkı</th>' +
      (aylikSutun ? '<th scope="col" class="sayi">Aylık + net</th>' : "") + "</tr></thead><tbody>" + satirlar + "</tbody></table></div></details>");

    detay.innerHTML = h.join("");
    etiketle(detay);
    ciz(g, r);

    var not = [r.yil + " parametreleriyle hesaplandı."];
    if (r.kirpilan.normal.length) not.push("Emekli olmayan çalışanın brütü de " + r.kirpilan.normal.length + " ay asgari ücrete çekildi.");
    if (r.tavanda) not.push("Brüt prime esas kazanç tavanını aşıyor; primler tavandan hesaplandı.");
    if (r.calisilanAy < 12) not.push("Grafik tam yıl içindir; işaret yalnız tam yılda konur.");
    mesaj.textContent = not.join(" ");
  }

  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 120); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (ev) { ev.preventDefault(); calistir(); });

  /* Genişlik değişince yalnız grafik yeniden çizilir. */
  var boyut;
  window.addEventListener("resize", function () {
    clearTimeout(boyut);
    boyut = setTimeout(function () { if (son) ciz(son.g, son.r); }, 150);
  });

  var yr = $("year");
  if (yr) yr.textContent = new Date().getFullYear();
  calistir();
})();
