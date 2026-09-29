/* İşsiz kalırsam kaç ay dayanırım? — sayfa katmanı.
   Hesap yapmaz: formu okur, Dayanma çekirdeğine (hesap.js) verir, sonucu
   çizer. Yıllık fiyat artışının önerisi sitenin TÜFE serisinden gelir;
   çekirdek seriyi bilmez. Renkler --dv-* veri tokenlarından (style.css). */
(function () {
  "use strict";
  var D = window.Dayanma, B = window.Bordro, C = window.BordroCikis, T = window.TufeSerisi;
  var form = document.getElementById("dy-form");
  if (!D || !B || !C || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function tl(v) { return nf.format(Math.round(v)) + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/\s/g, "").replace(/TL|₺/gi, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function ayAdi(ym) { var p = ym.split("-"); return AY[+p[1] - 1] + " " + p[0]; }
  function sure(ay) {
    if (!isFinite(ay)) return "süresiz";
    return nf1.format(ay) + " ay";
  }

  /* ---- form hazırlığı --------------------------------------------------- */
  var fesih = $("d-fesih");
  C.FESIH_TURLERI.forEach(function (t) {
    var o = document.createElement("option");
    o.value = t.kod; o.textContent = t.kisa;
    if (t.kod === "isveren") o.selected = true;
    fesih.appendChild(o);
  });
  // Tarih sınırı: parametresi olan son yılın sonu.
  var sonYil = B.sonYil();
  $("d-cikis").max = sonYil + "-12-31";
  $("d-giris").max = sonYil + "-12-31";

  /* Yıllık fiyat artışı önerisi: TÜFE serisinin son 12 aylık değişimi. */
  var tufeNot = "";
  if (T && T.aylar && T.sonAy && T.aylar[T.sonAy]) {
    var y = T.aylar[T.sonAy].yillik;
    $("d-enf").value = String(y).replace(".", ",");
    tufeNot = "Öneri: son 12 ay TÜFE, " + ayAdi(T.sonAy) + " itibarıyla %" + String(y).replace(".", ",") + ". Giderler her ay bu hızla büyür; ödenek ve taksit sabit kalır.";
    $("d-enf-not").textContent = tufeNot;
  }

  var hedef = 6;
  document.querySelectorAll("[data-hedef]").forEach(function (b) {
    b.addEventListener("click", function () {
      hedef = +b.getAttribute("data-hedef");
      document.querySelectorAll("[data-hedef]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      hesapla();
    });
  });

  function girdi() {
    var g = {
      cikis: $("d-cikis").value, iseGiris: $("d-giris").value, fesihTuru: fesih.value,
      ciplakBrut: sayi($("d-brut")), son3YilPrimGunu: sayi($("d-prim")), kullanilmayanIzinGunu: sayi($("d-izin")),
      nakit: sayi($("d-nakit")), yatirim: sayi($("d-yatirim")),
      zorunluGider: sayi($("d-zorunlu")), istegeBagliGider: sayi($("d-istege")), kisintiOrani: sayi($("d-kisinti")),
      borcTaksiti: sayi($("d-borc")), digerGelir: sayi($("d-diger")), gss: $("d-gss").value,
      enflasyonYillik: sayi($("d-enf"))
    };
    var tutar = sayi($("k-tutar"));
    if (tutar > 0) {
      g.karar = { tutar: tutar, pesinat: sayi($("k-pesinat")), krediTuru: $("k-tur").value, vade: sayi($("k-vade")),
        aylikFaiz: sayi($("k-faiz")), ekGider: sayi($("k-ekgider")), tekSeferlik: sayi($("k-tek")) };
    }
    return g;
  }
  function gecersiz(g) {
    var alanlar = [["ciplakBrut", "brüt maaş"], ["son3YilPrimGunu", "prim günü"], ["kullanilmayanIzinGunu", "izin günü"],
      ["nakit", "nakit"], ["yatirim", "yatırım"], ["zorunluGider", "zorunlu gider"], ["istegeBagliGider", "isteğe bağlı gider"],
      ["kisintiOrani", "kısıntı oranı"], ["borcTaksiti", "taksit"], ["digerGelir", "diğer gelir"], ["enflasyonYillik", "fiyat artışı"]];
    for (var i = 0; i < alanlar.length; i++) {
      var v = g[alanlar[i][0]];
      if (!isFinite(v) || v < 0) return "Lütfen " + alanlar[i][1] + " için sıfır ya da pozitif bir sayı girin.";
    }
    if (g.son3YilPrimGunu > 1080) return "Son 3 yıldaki prim günü en fazla 1080 olabilir.";
    return null;
  }

  /* ---- çizim ------------------------------------------------------------ */
  function grafik(s) {
    var n = Math.min(D.UFUK, Math.max(12, isFinite(s.dayanmaAy) ? Math.ceil(s.dayanmaAy) + 3 : 24, hedef + 2));
    var A = s.aylar.slice(0, n);
    var W = Math.max(300, $("r-grafik").clientWidth || 420), H = 190;
    var k = { sol: 46, sag: 8, ust: 12, alt: 26 };
    var degerler = [s.baslangicNakit].concat(A.map(function (a) { return a.nakitSon; }));
    var ymax = Math.max.apply(null, degerler.concat([1])), ymin = Math.min(0, Math.min.apply(null, degerler));
    var adim = Math.pow(10, Math.floor(Math.log(Math.max(ymax - ymin, 1)) / Math.LN10));
    if ((ymax - ymin) / adim < 3) adim /= 2;
    ymax = Math.ceil(ymax / adim) * adim; ymin = Math.floor(ymin / adim) * adim;
    function x(m) { return k.sol + m / n * (W - k.sol - k.sag); }
    function y(v) { return H - k.alt - (v - ymin) / (ymax - ymin) * (H - k.ust - k.alt); }
    function r(v) { return Math.round(v * 10) / 10; }
    var p = ['<svg class="dy-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' +
      esc("Ay sonu kasa, " + n + " ay: " + (isFinite(s.dayanmaAy) ? sure(s.dayanmaAy) + " sonra sıfırın altına iner." : "sıfırın altına inmiyor.")) + '">'];
    if (s.odenek.ay) {
      var ob = s.odenek.bas, os = Math.min(n, s.odenek.bas + s.odenek.ay - 1);
      p.push('<rect class="dy-odenek" x="' + r(x(ob - 1)) + '" y="' + k.ust + '" width="' + r(x(os) - x(ob - 1)) + '" height="' + (H - k.ust - k.alt) + '"/>');
    }
    for (var v = ymin; v <= ymax + 1e-6; v += adim) {
      p.push('<line class="dy-izgara" x1="' + k.sol + '" x2="' + (W - k.sag) + '" y1="' + r(y(v)) + '" y2="' + r(y(v)) + '"/>');
      p.push('<text class="dy-eksen" x="' + (k.sol - 6) + '" y="' + r(y(v) + 4) + '" text-anchor="end">' +
        (Math.abs(v) >= 1e6 ? nf1.format(v / 1e6) + " mn" : nf.format(v / 1000) + " b") + "</text>");
    }
    p.push('<line class="dy-sifir" x1="' + k.sol + '" x2="' + (W - k.sag) + '" y1="' + r(y(0)) + '" y2="' + r(y(0)) + '"/>');
    // Etiket aralığı genişliğe göre: bir etikete en az ~58 px düşsün.
    var etiketAdim = [1, 2, 3, 6, 12].filter(function (a) { return (W - k.sol - k.sag) / n * a >= 58; })[0] || 12;
    for (var m = 0; m <= n; m += etiketAdim) {
      var ym = m === 0 ? s.aylar[0].tarih : s.aylar[m - 1].tarih;
      var etiket = m === 0 ? "Çıkış" : AY_KISA[+ym.split("-")[1] - 1] + " '" + ym.slice(2, 4);
      p.push('<text class="dy-eksen" x="' + r(x(m)) + '" y="' + (H - 8) + '" text-anchor="middle">' + etiket + "</text>");
    }
    // hedef çizgisi
    if (hedef <= n) {
      p.push('<line class="dy-hedef-cizgi" x1="' + r(x(hedef)) + '" x2="' + r(x(hedef)) + '" y1="' + k.ust + '" y2="' + (H - k.alt) + '"/>');
      p.push('<text class="dy-hedef-yazi" x="' + r(x(hedef) + 4) + '" y="' + (k.ust + 10) + '">' + hedef + ". ay</text>");
    }
    var yol = "M" + r(x(0)) + " " + r(y(s.baslangicNakit));
    A.forEach(function (a) { yol += "L" + r(x(a.ay)) + " " + r(y(a.nakitSon)); });
    p.push('<path class="dy-dolgu" d="' + yol + "L" + r(x(n)) + " " + r(y(0)) + "L" + r(x(0)) + " " + r(y(0)) + 'Z"/>');
    p.push('<path class="dy-cizgi" d="' + yol + '"/>');
    if (isFinite(s.dayanmaAy) && s.dayanmaAy <= n) {
      p.push('<circle class="dy-bitis-nokta" cx="' + r(x(s.dayanmaAy)) + '" cy="' + r(y(0)) + '" r="5"/>');
    }
    p.push("</svg>");
    $("r-grafik").innerHTML = p.join("");
  }

  function kalemler(s) {
    var c = s.kalemler, o = s.odenek;
    var satir = [
      ["Birikim (nakit + yatırım)", tl(c.birikim)],
      ["Kıdem tazminatı, net", c.kidem ? tl(c.kidem) : "doğmuyor"],
      ["İhbar tazminatı, net", c.ihbar ? tl(c.ihbar) : "doğmuyor"],
      ["İzin ücreti ve son ay ücreti", tl(c.izin + c.sonAy)],
      ["İşsizlik ödeneği", o.ay ? tl(o.aylik) + " × " + o.ay + " ay" : "bağlanmıyor"]
    ];
    if (c.kararCikisi) satir.push(["Karar: peşinat ve masraf", "−" + tl(c.kararCikisi)]);
    satir.push(["Çıkış günü kasası", tl(s.baslangicNakit)]);
    satir.push(["GSS primi, ödenekten sonra", s.gssAylik ? tl(s.gssAylik) + "/ay" : "ödenmiyor"]);
    $("r-kalemler").innerHTML = satir.map(function (x, i) {
      return '<div' + (i === satir.length - 2 ? ' class="dy-kasa"' : "") + "><dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd></div>";
    }).join("");
    var gerekce = [];
    if (!c.kidem && s.paket.kidem.gerekce) gerekce.push("Kıdem: " + s.paket.kidem.gerekce);
    if (!o.ay && s.paket.issizlik.gerekce) gerekce.push("Ödenek: " + s.paket.issizlik.gerekce);
    $("r-grafik-not").textContent = "Ay sonunda kasadaki para." + (o.ay ? " Mavi bant işsizlik ödeneği ayları." : "") +
      (gerekce.length ? " " + gerekce.join(" ") : "");
  }

  function cevap(s) {
    $("r-ay").textContent = isFinite(s.dayanmaAy) ? sure(s.dayanmaAy) : (s.tukenmez ? "tükenmiyor" : D.UFUK + " aydan uzun");
    $("r-bitis").textContent = isFinite(s.dayanmaAy)
      ? "Kasa " + ayAdi(s.bitis) + " içinde sıfırın altına iner."
      : (s.tukenmez ? "Ödenek bittikten sonra da hanedeki gelir giderleri karşılıyor." : D.UFUK + " ay boyunca kasa sıfırın altına inmiyor.");
    var h = s.hedefler.filter(function (x) { return x.ay === hedef; })[0];
    if (!h) {
      // hesap motoru 3/6/9/12 dışını hesaplamaz; seçici de yalnız bunları sunar
      $("r-hedef").textContent = "";
      return;
    }
    $("r-hedef").innerHTML = h.yeterli
      ? '<span class="dy-rozet dy-iyi">Yeterli</span> ' + hedef + " ay iş ararsanız kasada en az " + esc(tl(h.pay)) + " kalır."
      : '<span class="dy-rozet dy-kotu">Eksik</span> ' + hedef + " ay dayanmak için bugün " + esc(tl(h.eksik)) + " daha birikim gerekir.";
  }

  function duyarlilik(g) {
    var d = D.duyarlilik(g);
    $("r-duyar").innerHTML = d.satirlar.map(function (x) {
      var f = x.fark === null ? "—" : (x.fark >= 0 ? "+" : "−") + nf1.format(Math.abs(x.fark)) + " ay";
      var sinif = x.fark === null ? "" : x.fark < -0.05 ? "dy-eksi" : x.fark > 0.05 ? "dy-arti" : "";
      return '<tr><th scope="row">' + esc(x.ad) + '</th><td class="sayi">' + esc(isFinite(x.dayanmaAy) ? sure(x.dayanmaAy) : "süresiz") +
        '</td><td class="sayi ' + sinif + '">' + esc(f) + "</td></tr>";
    }).join("");
  }

  function karar(g) {
    var hedefYazi = hedef + " ay";
    if (!g.karar) {
      var ke = D.kararEtkisi(Object.assign({}, g, { karar: null }), hedef);
      $("r-karar").innerHTML = "<p>Tutarı girin. Şimdiki hâlinizle " + esc(hedefYazi) + " iş arama süresini bozmadan en fazla <strong>" +
        esc(tl(ke.enFazlaPesin)) + "</strong> peşin harcayabilirsiniz.</p>";
      return;
    }
    var k = D.kararEtkisi(g, hedef);
    var satir = "<p>Dayanma süresi <strong>" + esc(sure(k.once)) + "</strong> iken karardan sonra <strong>" + esc(sure(k.sonra)) + "</strong>.";
    if (k.karar.kredi > 0) satir += " Kredi taksiti " + esc(tl(k.karar.taksit)) + ", " + k.karar.vade + " ay (KKDF ve BSMV dahil).";
    satir += "</p><p>" + esc(hedefYazi) + " iş arama süresini bozmayan en büyük peşin harcama: <strong>" + esc(tl(k.enFazlaPesin)) + "</strong>.</p>";
    $("r-karar").innerHTML = satir;
  }

  function aylar(s) {
    var n = Math.min(D.UFUK, Math.max(12, isFinite(s.dayanmaAy) ? Math.ceil(s.dayanmaAy) + 1 : 24));
    $("r-aylar").innerHTML = s.aylar.slice(0, n).map(function (a) {
      var gider = a.giderToplam - a.gider.gss;
      return '<tr' + (a.nakitSon < 0 ? ' class="dy-negatif"' : "") + '><th scope="row">' + esc(ayAdi(a.tarih)) + '</th><td class="sayi">' +
        esc(a.odenek ? tl(a.odenek) : "—") + '</td><td class="sayi">' + esc(a.digerGelir ? tl(a.digerGelir) : "—") + '</td><td class="sayi">' +
        esc(tl(gider)) + '</td><td class="sayi">' + esc(a.gider.gss ? tl(a.gider.gss) : "—") + '</td><td class="sayi">' + esc(tl(a.nakitSon)) + "</td></tr>";
    }).join("");
  }

  var sonGirdi = null;
  function hesapla() {
    var g = girdi(), hata = gecersiz(g);
    if (!hata) { var h = D.dogrula(g); if (h.length) hata = h.join(" "); }
    if (hata) { $("d-hata").textContent = hata; $("dy-sonuc").classList.add("dy-bayat"); return; }
    try {
      var s = D.hesapla(g);
      $("d-hata").textContent = "";
      $("dy-sonuc").classList.remove("dy-bayat");
      cevap(s); kalemler(s); grafik(s); duyarlilik(g); karar(g); aylar(s);
      sonGirdi = g;
    } catch (e) {
      $("d-hata").textContent = e.message.replace(/^Dayanma: /, "");
      $("dy-sonuc").classList.add("dy-bayat");
    }
  }

  var bekle = null;
  function planla() { clearTimeout(bekle); bekle = setTimeout(hesapla, 120); }
  document.querySelectorAll("#hesapla input, #hesapla select").forEach(function (el) {
    el.addEventListener("input", planla);
    el.addEventListener("change", planla);
  });
  window.addEventListener("resize", function () { clearTimeout(bekle); bekle = setTimeout(hesapla, 200); });

  /* ---- profil köprüsü: Finansal İkiz profilinden okur, yazmaz ---------- */
  if (window.ProfilKopru) {
    var NAKIT = { nakit: true, mevduat: true };
    var LIKIT = { altin: true, doviz: true, fon: true, hisse: true, tahvil: true, yatirim: true };
    window.ProfilKopru.bagla({
      hedef: $("pk-alan"), alanlar: ["gelir", "gider", "varlik", "borc"], yol: "../finansal-ikiz/",
      doldur: function (p) {
        var yapilan = [];
        var ucret = null;
        p.gelirler.forEach(function (x) { if (x.tur === "ucret" && x.aylikBrut > 0 && (!ucret || x.aylikBrut > ucret.aylikBrut)) ucret = x; });
        if (ucret) { $("d-brut").value = nf.format(Math.round(ucret.aylikBrut)); yapilan.push("brüt maaş"); }
        var digerNet = p.gelirler.reduce(function (t, x) { return t + (x.tur === "ucret" ? 0 : (x.aylikNet || 0)); }, 0);
        if (digerNet > 0) { $("d-diger").value = nf.format(Math.round(digerNet)); yapilan.push("ücret dışı gelirler (kira, temettü…) diğer gelire"); }
        var z = 0, i = 0;
        p.giderler.forEach(function (x) { if (x.zorunlu) z += x.aylik; else i += x.aylik; });
        if (z || i) { $("d-zorunlu").value = nf.format(Math.round(z)); $("d-istege").value = nf.format(Math.round(i)); yapilan.push("zorunlu ve isteğe bağlı gider"); }
        var n = 0, y = 0;
        p.varliklar.forEach(function (v) { if (NAKIT[v.tur]) n += v.deger; else if (LIKIT[v.tur]) y += v.deger; });
        if (n || y) { $("d-nakit").value = nf.format(Math.round(n)); $("d-yatirim").value = nf.format(Math.round(y)); yapilan.push("nakit ve likit yatırımlar (ev, araba ve BES hariç)"); }
        if (p.borclar.length) {
          var t = 0; p.borclar.forEach(function (b) { t += b.aylikOdeme; });
          $("d-borc").value = nf.format(Math.round(t)); yapilan.push("aylık borç ödemeleri");
        }
        hesapla();
        return yapilan;
      }
    });
  }

  hesapla();
})();
