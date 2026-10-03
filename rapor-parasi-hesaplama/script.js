/* Rapor parası hesaplama — sayfa katmanı.
   Hesap yapmaz: formu okur, RaporParasi çekirdeğine (bordro/rapor.js) verir,
   sonucu çizer. Renkler --dv-* veri tokenlarından (style.css). */
(function () {
  "use strict";
  var R = window.RaporParasi, B = window.Bordro;
  var form = document.getElementById("rp-form");
  if (!R || !B || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(v) { return nf.format(Math.round(v)) + " TL"; }
  function tl2(v) { return nf2.format(v) + " TL"; }
  function isaretli(v, k) { var r = k ? Math.round(v * 100) / 100 : Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + (k ? nf2 : nf).format(Math.abs(r)) + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/\s/g, "");
    if (!s) return null;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tarih(s) { var p = s.split("-"); return +p[2] + " " + AY[+p[1] - 1] + " " + p[0]; }
  function ayAdi(s) { var p = s.split("-"); return AY[+p[1] - 1] + " " + p[0]; }

  /* ---- tür seçimi --------------------------------------------------------- */
  var tur = "hastalik";
  document.querySelectorAll("[data-tur]").forEach(function (b) {
    b.addEventListener("click", function () {
      tur = b.getAttribute("data-tur");
      document.querySelectorAll("[data-tur]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      alanlar();
      hesapla();
    });
  });
  function alanlar() {
    var analik = tur === "analik";
    document.querySelectorAll("[data-rapor]").forEach(function (x) { x.hidden = analik; });
    document.querySelectorAll("[data-analik]").forEach(function (x) { x.hidden = !analik; });
    $("r-bas-etiket").textContent = analik ? "Doğum tarihi (beklenen)" : "Rapor başlangıcı";
    var ilk = $("r-pol").querySelector('option[value="ilkIkiGun"]');
    ilk.disabled = tur !== "hastalik";
    if (ilk.disabled && $("r-pol").value === "ilkIkiGun") $("r-pol").value = "kesilir";
  }

  /* ---- girdi --------------------------------------------------------------- */
  function kazancBul(bas) {
    var dk = sayi($("r-dk")), dg = sayi($("r-dg")), ikr = sayi($("r-ikr")) || 0;
    if (dk !== null || dg !== null) {
      if (!(dk >= 0) || !(dg >= 0)) throw new Error("Hizmet dökümü alanlarının ikisini de doldurun ya da ikisini de boşaltın.");
      return { kaynak: "dokum", kazanc: dk, gun: dg, ucretToplami: ikr > 0 && ikr < dk ? dk - ikr : undefined };
    }
    var simdi = sayi($("r-brut")), once = sayi($("r-once"));
    var k = R.kazancTuret({
      baslangic: bas, brutSimdi: simdi, brutOnce: once === null ? simdi : once,
      zamAyi: $("r-zam").value || null, calisilanAy: sayi($("r-ay")), ikramiye: ikr
    });
    k.kaynak = "tahmin";
    return k;
  }
  function girdi() {
    var bas = $("r-bas").value;
    var k = kazancBul(bas);
    return {
      tur: tur, baslangic: bas,
      ayaktaGun: sayi($("r-ayakta")) || 0, yatarakGun: sayi($("r-yatarak")) || 0,
      ilkYatarak: $("r-ilk").value === "yatarak", cogul: $("r-cogul").value === "cogul",
      kazanc: k.kazanc, gun: k.gun, ucretToplami: k.ucretToplami, _k: k
    };
  }

  /* ---- grafik: raporlu ayda ele geçen -------------------------------------- */
  function grafik(etki) {
    var kutu = $("o-grafik");
    var aylar = etki.aylar.filter(function (a) { return !a.hesaplanamadi; });
    if (!aylar.length || etki.politika === "tamamlar") {
      kutu.innerHTML = etki.politika === "tamamlar"
        ? '<p class="rp-bos">İşveren tam maaş ödüyor: elinize geçen değişmez, ödeneği SGK işverene öder.</p>' : "";
      $("o-grafik-not").hidden = true;
      return;
    }
    $("o-grafik-not").hidden = false;
    var W = Math.max(300, Math.min(600, Math.round(kutu.clientWidth || 520)));
    var dar = W < 420;
    var SOL = dar ? 64 : 84, SAG = 10, UST = 34, SATIR = 40, ALT = 22;
    var H = UST + aylar.length * SATIR + ALT;
    var enCok = aylar.reduce(function (m, a) { return Math.max(m, a.netNormal, a.eleGecen); }, 0);
    var adim = enCok > 80000 ? 20000 : enCok > 40000 ? 10000 : 5000;
    var tavan = Math.ceil(enCok / adim) * adim;
    function x(v) { return SOL + v / tavan * (W - SOL - SAG); }
    var p = [];
    p.push('<svg class="rp-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="rp-g-bas rp-g-acik">');
    p.push('<title id="rp-g-bas">Raporlu ayda elinize geçen</title>');
    p.push('<desc id="rp-g-acik">' + esc(aylar.map(function (a) {
      return ayAdi(a.ay) + ": maaş " + tl(a.netMaas) + ", ödenek " + tl(a.odenek) + ", normal ay " + tl(a.netNormal);
    }).join("; ")) + "</desc>");
    // lejant
    var lx = 0;
    [["rp-m-maas", "Maaşın kalanı"], ["rp-m-odenek", "SGK ödeneği"]].forEach(function (l) {
      p.push('<rect class="' + l[0] + '" x="' + lx + '" y="4" width="10" height="10" rx="2"/>');
      p.push('<text class="rp-lejant" x="' + (lx + 15) + '" y="13">' + l[1] + "</text>");
      lx += 15 + l[1].length * 6.6 + 14;
    });
    p.push('<line class="rp-normal" x1="' + lx + '" x2="' + (lx + 12) + '" y1="9" y2="9"/>');
    p.push('<text class="rp-lejant" x="' + (lx + 17) + '" y="13">Normal ay</text>');
    for (var v = 0; v <= tavan; v += adim) {
      var gx = x(v).toFixed(1);
      p.push('<line class="rp-izgara" x1="' + gx + '" x2="' + gx + '" y1="' + (UST - 4) + '" y2="' + (H - ALT + 2) + '"/>');
      p.push('<text class="rp-eksen" x="' + gx + '" y="' + (H - 6) + '" text-anchor="' + (v === 0 ? "start" : "middle") + '">' + nf.format(v / 1000) + "</text>");
    }
    p.push('<text class="rp-eksen" x="0" y="' + (H - 6) + '">bin TL</text>');
    aylar.forEach(function (a, i) {
      var cy = UST + i * SATIR + SATIR / 2 - 4, h = 14;
      p.push('<text class="rp-etiket" x="0" y="' + (cy + 4) + '">' + esc(dar ? ayAdi(a.ay).slice(0, 3) + " " + a.ay.slice(2, 4) : ayAdi(a.ay)) + "</text>");
      var x0 = SOL, x1 = x(a.netMaas), x2 = x(a.eleGecen);
      if (a.netMaas > 0) p.push('<rect class="rp-m-maas" x="' + x0 + '" y="' + (cy - h / 2) + '" width="' + Math.max(1, x1 - x0).toFixed(1) + '" height="' + h + '" rx="3"/>');
      if (a.odenek > 0) {
        var bas = a.netMaas > 0 ? x1 + 2 : x0;
        p.push('<rect class="rp-m-odenek" x="' + bas.toFixed(1) + '" y="' + (cy - h / 2) + '" width="' + Math.max(1, x2 - bas).toFixed(1) + '" height="' + h + '" rx="3"/>');
      }
      var nx = x(a.netNormal).toFixed(1);
      p.push('<line class="rp-normal" x1="' + nx + '" x2="' + nx + '" y1="' + (cy - h / 2 - 4) + '" y2="' + (cy + h / 2 + 4) + '"/>');
      var yazi = isaretli(a.fark);
      p.push('<text class="rp-fark" x="' + SOL + '" y="' + (cy + h / 2 + 13) + '">' + esc(tl(a.eleGecen) + " · " + yazi) + "</text>");
    });
    p.push("</svg>");
    kutu.innerHTML = p.join("");
  }

  /* ---- sonuç ---------------------------------------------------------------- */
  function satir(dt, dd, sinif) {
    return "<div" + (sinif ? ' class="' + sinif + '"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>";
  }
  function hesapla() {
    var hata = $("r-hata"), kutu = $("rp-sonuc"), g, r, etki;
    try {
      g = girdi();
      r = R.hesapla(g);
      etki = R.bordroEtkisi(r, { aylikBrut: g._k.kaynak === "tahmin" ? sayi($("r-brut")) : (sayi($("r-brut")) || g.kazanc / 12), politika: $("r-pol").value });
    } catch (e) {
      hata.textContent = e.message;
      kutu.classList.add("rp-bayat");
      return;
    }
    hata.textContent = "";
    kutu.classList.remove("rp-bayat");

    var analik = r.tur === "analik";
    $("o-toplam").textContent = r.uygun ? tl(r.toplam) : "Ödenek yok";
    $("o-alt").textContent = r.uygun
      ? nf.format(r.odenenGun) + " gün ödenir · günde " + tl2(r.gunlukOdenek.ayakta) + (r.segmentler.some(function (s) { return s.yatarak; }) ? " ayakta, " + tl2(r.gunlukOdenek.yatarak) + " yatarak" : "")
      : r.neden;

    var uyari = [];
    if (r.odenmeyenGun) uyari.push("İlk " + r.odenmeyenGun + " gün ödenmez (hastalıkta ödenek üçüncü günden başlar).");
    if (r.dusukPrim && r.uygun) uyari.push("Son 12 ayda 180 günden az prim var: günlük kazanç alt sınırın iki katıyla (" + tl2(r.sinir.gunlukAlt * 2) + ") sınırlı.");
    if (r.parametreYok) uyari.push("Raporun bir kısmı asgari ücreti henüz açıklanmamış yıla düşüyor. Yeni yılın günlük alt sınırı günlük kazancınızın üstüne çıkarsa o günler yeni alt sınırdan ödenir (5510 m.18); araç bunu açıklanınca hesaplar.");
    $("o-uyari").innerHTML = uyari.map(esc).join(" ");

    // kalemler
    var k = [];
    var adimlar = r.kazancAdimlari.length < 2 ? "" : r.kazancAdimlari.map(function (a) { return '<span class="rp-kucuk">' + esc(a.ad) + ": " + tl2(a.deger) + "</span>"; }).join("");
    k.push(satir("Günlük kazanç" + adimlar, tl2(r.gunlukKazanc), "rp-ana"));
    if (g._k.kaynak === "tahmin") {
      k.push(satir("12 ayın kazancı · prim günü", tl(g.kazanc) + " · " + nf.format(g.gun)));
    } else k.push(satir("Hizmet dökümünden", tl(g.kazanc) + " · " + nf.format(g.gun) + " gün"));
    r.segmentler.forEach(function (s) {
      var aciklama = (analik ? s.ad : s.yatarak ? "Yatarak" : "Ayakta") + " · ";
      k.push(satir(esc(aciklama + nf.format(s.gun) + " gün" + (s.odenenGun !== s.gun ? ", " + s.odenenGun + " ödenir" : "")), tl(s.odenek)));
    });
    if (analik) k.push(satir("İzin", esc(tarih(r.segmentler[0].bas) + " – " + tarih(r.bitis))));
    else k.push(satir("Raporun son günü", esc(tarih(r.bitis))));
    $("o-kalemler").innerHTML = k.join("");

    // güncel maaşla fark
    var icgoru = "";
    if (r.uygun && g._k.kaynak === "tahmin") {
      var simdi = sayi($("r-brut")), once = sayi($("r-once"));
      if (once !== null && once < simdi && $("r-zam").value) {
        try {
          var kz = R.kazancTuret({ baslangic: g.baslangic, brutSimdi: simdi, brutOnce: simdi, calisilanAy: sayi($("r-ay")), ikramiye: sayi($("r-ikr")) || 0 });
          var rz = R.hesapla(Object.assign({}, g, { kazanc: kz.kazanc, gun: kz.gun, ucretToplami: kz.ucretToplami }));
          var fark = rz.toplam - r.toplam;
          if (fark >= 1) icgoru = "Ödenek güncel maaşınızdan hesaplansaydı günlük kazanç " + tl2(rz.gunlukKazanc) + " olurdu: " +
            "on iki ayın ortalaması zamdan önceki ayları da içerdiği için bu raporda <strong>" + tl(fark) + "</strong> daha az alıyorsunuz.";
        } catch (e) { /* karşılaştırma yapılamadı */ }
      }
    }
    $("o-icgoru").innerHTML = icgoru;

    // bordro
    grafik(etki);
    var b = [];
    var hesapli = etki.aylar.filter(function (a) { return !a.hesaplanamadi; });
    if (etki.politika !== "tamamlar" && hesapli.length === 1) {
      var a = hesapli[0];
      b.push(satir("Normal bir " + esc(AY[+a.ay.slice(5, 7) - 1]) + " neti", tl2(a.netNormal)));
      b.push(satir("Rapor ayında maaş (" + a.ucretliGun + " gün ücret)", tl2(a.netMaas)));
      b.push(satir("SGK ödeneği (vergisiz)", tl2(a.odenek)));
      b.push(satir("Elinize geçen", tl2(a.eleGecen) + ' <span class="rp-fark-rozet' + (a.fark < 0 ? " rp-eksi" : "") + '">' + isaretli(a.fark, true) + "</span>", "rp-ana"));
    } else if (etki.politika !== "tamamlar") {
      etki.yillar.forEach(function (y) {
        if (y.hesaplanamadi) { b.push(satir(y.yil + " yılı", "parametre yok")); return; }
        b.push(satir(y.yil + " raporlu aylar: maaş + ödenek, normale göre", '<span class="rp-fark-rozet' + (y.raporAylariFarki < 0 ? " rp-eksi" : "") + '">' + isaretli(y.raporAylariFarki) + "</span>"));
      });
    }
    etki.yillar.forEach(function (y) {
      if (!y.hesaplanamadi && etki.politika !== "tamamlar" && y.sonrakiAylarVergi >= 1)
        b.push(satir(y.yil + " sonraki aylarda daha az gelir vergisi", "+" + tl(y.sonrakiAylarVergi)));
    });
    $("o-bordro").innerHTML = b.join("");
  }

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  var genislik = 0;
  window.addEventListener("resize", function () {
    var w = $("o-grafik").clientWidth;
    if (Math.abs(w - genislik) > 24) { genislik = w; clearTimeout(zaman); zaman = setTimeout(hesapla, 150); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  alanlar();
  hesapla();
})();
