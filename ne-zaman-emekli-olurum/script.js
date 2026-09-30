/* Ne zaman emekli olurum? — sayfa katmanı.
   Hesap yapmaz: formu okur, EmeklilikTarihi çekirdeğine (hesap.js) verir,
   sonucu çizer. Renkler --dv-* veri tokenlarından (style.css). */
(function () {
  "use strict";
  var E = window.EmeklilikTarihi, B = window.Bordro;
  var form = document.getElementById("em-form");
  if (!E || !B || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function tl(v) { return nf.format(Math.round(v)) + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function tarih(s) { var p = s.split("-"); return +p[2] + " " + AY[+p[1] - 1] + " " + p[0]; }
  function kisa(s) { var p = s.split("-"); return AY_KISA[+p[1] - 1] + " " + p[0]; }
  function sure(f) {
    var p = [];
    if (f.yil) p.push(f.yil + " yıl");
    if (f.ay) p.push(f.ay + " ay");
    if (!f.yil && f.gun) p.push(f.gun + " gün");
    return p.length ? p.join(" ") : "bugün";
  }
  function bugunISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  var BUGUN = bugunISO();
  var GRUP = {
    eyt: ["EYT kapsamı", "İlk girişiniz 8 Eylül 1999'dan önce: yaş şartı yok (7438 s.K.)."],
    gecis: ["1999–2008 grubu", "İlk girişiniz 8 Eylül 1999 ile 30 Nisan 2008 arasında: Geçici m.9."],
    yeni: ["2008 sonrası", "İlk girişiniz 30 Nisan 2008'den sonra: 5510 s.K. m.28."]
  };

  /* ---- seçim düğmeleri ---------------------------------------------------- */
  var secim = { cinsiyet: "erkek", statu: "4a" };
  document.querySelectorAll("[data-secim]").forEach(function (b) {
    b.addEventListener("click", function () {
      var ad = b.getAttribute("data-secim");
      secim[ad] = b.getAttribute("data-deger");
      document.querySelectorAll('[data-secim="' + ad + '"]').forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      if (ad === "cinsiyet") dogumAlani();
      hesapla();
    });
  });
  function dogumAlani() {
    var kadin = secim.cinsiyet === "kadin";
    document.querySelectorAll("[data-kadin]").forEach(function (x) { x.hidden = !kadin; });
  }
  $("e-ilk").max = BUGUN; $("e-dogum").max = BUGUN;

  function girdi() {
    var kadin = secim.cinsiyet === "kadin";
    return {
      bugun: BUGUN, dogum: $("e-dogum").value, cinsiyet: secim.cinsiyet, statu: secim.statu,
      ilkGiris: $("e-ilk").value, primGun: sayi($("e-gun")), yillikGun: sayi($("e-yillik")),
      askerlikGun: sayi($("e-asker")), askerlikOnce: $("e-asker-once").value === "evet",
      dogumGun: kadin ? sayi($("e-dogumgun")) : 0, dogumOnce: kadin && $("e-dogum-once").value === "evet"
    };
  }

  /* ---- şart çizelgesi ------------------------------------------------------ */
  var gorunenYol = null;
  function gun(s) { return Date.parse(s) / 864e5; }
  function cizelge(r, y) {
    var kutu = $("r-cizelge");
    if (!y || y.tarih === null) {
      kutu.innerHTML = '<p class="em-bos">Bu varsayımla şartlardan biri hiç dolmuyor: prim günü artmıyor. Yılda kaç gün prim ödeyeceğinizi değiştirin.</p>';
      return;
    }
    var satirlar = y.kosullar;
    var son = satirlar.reduce(function (m, k) { return k.tarih > m ? k.tarih : m; }, y.tarih);
    if (y.tamam) {
      kutu.innerHTML = '<p class="em-bos"><span class="em-rozet em-iyi">Şartlar dolu</span> Bugün başvurabilirsiniz. Aylık, yazılı talebi izleyen ay başından bağlanır.</p>';
      return;
    }
    /* Kutunun gerçek genişliğinde çizilir: yazı her ekranda kendi boyunda kalır. */
    var W = Math.max(300, Math.min(600, Math.round(kutu.clientWidth || 520)));
    var SOL = W < 420 ? 92 : 128, SAG = 58, UST = 26, SATIR = 38, ALT = 26;
    var H = UST + satirlar.length * SATIR + ALT;
    var t0 = gun(BUGUN), t1 = gun(son);
    var aralik = Math.max(t1 - t0, 180);
    function x(s) { return SOL + (gun(s) - t0) / aralik * (W - SOL - SAG); }
    var yilBas = +BUGUN.slice(0, 4), yilSon = +son.slice(0, 4) + 1;
    var adim = (yilSon - yilBas) > 24 ? 10 : (yilSon - yilBas) > 12 ? 5 : (yilSon - yilBas) > 5 ? 2 : 1;
    var parca = [];
    parca.push('<svg class="em-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="em-cz-bas em-cz-acik">');
    parca.push('<title id="em-cz-bas">Emeklilik şartlarının dolma tarihleri</title>');
    var acik = satirlar.map(function (k) { return k.ad + " " + (k.tamam ? "doldu" : tarih(k.tarih)); }).join("; ");
    parca.push('<desc id="em-cz-acik">' + esc(acik + ". Emeklilik " + tarih(y.tarih) + ".") + "</desc>");
    for (var yl = Math.ceil(yilBas / adim) * adim; yl <= yilSon; yl += adim) {
      var s = yl + "-01-01";
      if (gun(s) < t0 || gun(s) > t0 + aralik) continue;
      var gx = x(s).toFixed(1);
      parca.push('<line class="em-izgara" x1="' + gx + '" x2="' + gx + '" y1="' + (UST - 6) + '" y2="' + (H - ALT + 4) + '"/>');
      parca.push('<text class="em-eksen" x="' + gx + '" y="' + (H - 8) + '" text-anchor="middle">' + yl + "</text>");
    }
    parca.push('<line class="em-bugun" x1="' + SOL + '" x2="' + SOL + '" y1="' + (UST - 10) + '" y2="' + (H - ALT + 4) + '"/>');
    parca.push('<text class="em-eksen" x="' + SOL + '" y="' + (UST - 14) + '" text-anchor="middle">bugün</text>');
    satirlar.forEach(function (k, i) {
      var cy = UST + i * SATIR + SATIR / 2;
      var bag = k.ad === y.bagli;
      var etiket = k.ad === "Yaş" ? k.gereken + " yaş" : k.ad === "Prim günü" ? nf.format(k.gereken) + " gün" : k.gereken + (W < 420 ? " yıl süre" : " yıl sigortalılık");
      parca.push('<text class="em-etiket' + (bag ? " em-bag" : "") + '" x="0" y="' + (cy + 4) + '">' + esc(etiket) + "</text>");
      if (k.tamam) {
        parca.push('<circle class="em-tamam" cx="' + (SOL + 7) + '" cy="' + cy + '" r="6"/>');
        parca.push('<path class="em-tik" d="M' + (SOL + 4) + " " + cy + " l2.2 2.2 l4 -4.4\"/>");
        parca.push('<text class="em-deger" x="' + (SOL + 18) + '" y="' + (cy + 4) + '">doldu</text>');
        return;
      }
      var x1 = x(k.tarih);
      parca.push('<rect class="' + (bag ? "em-cubuk em-cubuk-bag" : "em-cubuk") + '" x="' + SOL + '" y="' + (cy - 5) + '" width="' + Math.max(4, x1 - SOL).toFixed(1) + '" height="10" rx="4"/>');
      parca.push('<text class="em-deger' + (bag ? " em-bag" : "") + '" x="' + (x1 + 6).toFixed(1) + '" y="' + (cy + 4) + '">' + esc(kisa(k.tarih)) + "</text>");
    });
    var ex = x(y.tarih).toFixed(1);
    parca.push('<line class="em-hedef" x1="' + ex + '" x2="' + ex + '" y1="' + (UST - 10) + '" y2="' + (H - ALT + 4) + '"/>');
    parca.push("</svg>");
    kutu.innerHTML = parca.join("");
  }

  /* ---- sonuç ---------------------------------------------------------------- */
  var son = null;
  function hesapla() {
    var g = girdi(), hata = $("e-hata");
    var sonuc = $("em-sonuc");
    try {
      var r = E.hesapla(g);
    } catch (e) {
      hata.textContent = e.message;
      sonuc.classList.add("em-bayat");
      return;
    }
    hata.textContent = "";
    sonuc.classList.remove("em-bayat");
    son = { g: g, r: r };
    if (gorunenYol && !r.yollar.some(function (y) { return y.kod === gorunenYol; })) gorunenYol = null;

    var bas = $("r-tarih"), alt = $("r-alt");
    if (r.tarih === null) {
      bas.textContent = "Dolmuyor";
      alt.textContent = "Bugünkü prim gününüzle ve prim ödemeden şartlar tamamlanmıyor.";
    } else if (r.enErken.tamam) {
      bas.textContent = "Bugün";
      alt.textContent = "Bütün şartlar dolu · " + r.yasi.yil + " yaşındasınız";
    } else {
      bas.textContent = tarih(r.tarih);
      alt.textContent = sure(r.kalan) + " sonra · " + r.yasi.yil + " yaşında";
    }
    var gr = GRUP[r.grup];
    $("r-grup").innerHTML = '<span class="em-rozet em-grup-' + r.grup + '">' + esc(gr[0]) + "</span> " + esc(gr[1]) +
      (r.geriGun ? " Borçlanmayla başlangıç " + esc(tarih(r.baslangic)) + " sayılıyor." : "");

    // yol seçici
    var sec = $("r-yol-sec");
    if (r.yollar.length > 1) {
      var goster = gorunenYol || (r.enErken ? r.enErken.kod : r.yollar[0].kod);
      sec.innerHTML = r.yollar.map(function (y) {
        return '<button type="button" class="secim" data-yol="' + y.kod + '" aria-pressed="' + (y.kod === goster) + '">' + esc(y.ad) + "</button>";
      }).join("");
      sec.hidden = false;
      sec.querySelectorAll("[data-yol]").forEach(function (b) {
        b.addEventListener("click", function () { gorunenYol = b.getAttribute("data-yol"); hesapla(); });
      });
    } else sec.hidden = true;
    var yol = r.yollar.filter(function (y) { return y.kod === (gorunenYol || (r.enErken ? r.enErken.kod : r.yollar[0].kod)); })[0];
    cizelge(r, yol);

    // şartlar
    $("r-kosullar").innerHTML = yol.kosullar.map(function (k) {
      var ad = k.ad === "Yaş" ? "Yaş" : k.ad === "Prim günü" ? "Prim günü" : "Sigortalılık süresi";
      var ger = k.gereken === null ? "—" : k.ad === "Yaş" ? k.gereken + " yaş" + (k.kademe ? " (kademe)" : "") :
        k.ad === "Prim günü" ? nf.format(k.gereken) + " gün" + (k.tamYil ? " (" + k.tamYil + " tam yıl)" : "") : k.gereken + " yıl";
      var ne = k.tarih === null ? "dolmuyor" : k.tamam ? "doldu" : tarih(k.tarih);
      var ek = "";
      if (k.ad === "Prim günü" && !k.tamam && k.gereken) ek = '<span class="em-kucuk">şu an ' + nf.format(r.primToplam) + ", " + nf.format(k.gereken - r.primToplam) + " eksik</span>";
      return '<div class="' + (k.ad === yol.bagli && !yol.tamam ? "em-bag-satir" : "") + '"><dt>' + ad + " · " + esc(ger) + ek + "</dt><dd>" +
        (k.tamam ? '<span class="em-rozet em-iyi">doldu</span>' : esc(ne)) + "</dd></div>";
    }).join("");
    $("r-dayanak").textContent = yol.dayanak + (yol.eytOncesiYas ? " · EYT olmasaydı " + yol.eytOncesiYas + " yaş şartı olacaktı." : "") +
      (yol.kismi ? " · Gün sayısı az olduğu için aylık bağlama oranı da düşük olur." : "");

    var aylik = $("r-aylik");
    if (r.tarih !== null && !r.enErken.tamam) aylik.innerHTML = "Aylık en erken <strong>" + esc(tarih(r.aylikBaslangici)) + "</strong>: şartların dolduğu gün işten ayrılıp yazılı talepte bulunursanız, talebi izleyen ay başından (5510 m.30).";
    else aylik.textContent = "";
    $("r-notlar").innerHTML = r.notlar.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("");

    yollarTablosu(r);
    borclanma(g, r);
    duyarlilik(g);
  }

  function yollarTablosu(r) {
    $("r-yollar").innerHTML = r.yollar.map(function (y) {
      var t = y.tarih === null ? "dolmuyor" : y.tamam ? "şartlar dolu" : tarih(y.tarih);
      var en = r.enErken && y.kod === r.enErken.kod;
      return "<tr" + (en ? ' class="em-en"' : "") + '><th scope="row">' + esc(y.ad) + (en ? ' <span class="em-rozet em-iyi">en erken</span>' : "") +
        '</th><td>' + esc(y.dayanak) + '</td><td class="sayi">' + esc(t) + "</td><td>" + esc(y.tarih === null ? "Prim günü" : y.tamam ? "—" : y.bagli) + "</td></tr>";
    }).join("");
  }

  function borclanma(g, r) {
    var kutu = $("r-borc");
    var var_ = (g.askerlikGun > 0) || (g.dogumGun > 0);
    var ipucu = "";
    if (r.grup !== "eyt" && r.eytSinirinaGun > 0 && r.eytSinirinaGun <= 1100) {
      ipucu = "<p>Başlangıcınızı EYT sınırının önüne çekmek için ilk girişinizden <strong>önce</strong> geçmiş en az <strong>" +
        nf.format(r.eytSinirinaGun) + " gün</strong> borçlanmanız gerekir (başlangıç şu an " + esc(tarih(r.baslangic)) + ").</p>";
    } else if (r.grup === "yeni" && r.gecisSinirinaGun > 0 && r.gecisSinirinaGun <= 1100) {
      ipucu = "<p>İlk girişinizden önce geçmiş <strong>" + nf.format(r.gecisSinirinaGun) + " gün</strong> borçlanma, başlangıcınızı 30 Nisan 2008'e çeker: 1999–2008 grubuna geçersiniz (7000 gün, yaş kademesi yok).</p>";
    }
    if (!var_) {
      kutu.innerHTML = '<p class="em-panel-not">Formun üçüncü adımına askerlik ya da doğum borçlanması girerseniz, emekliliğin kaç ay öne geldiğini ve bunun en az kaça mal olduğunu burada görürsünüz.</p>' + ipucu;
      return;
    }
    try {
      var b = E.borclanmaEtkisi(g, B.sonYil());
    } catch (e) { kutu.innerHTML = "<p>" + esc(e.message) + "</p>"; return; }
    var once = b.once, sonra = b.sonra, satir = [];
    satir.push("<p>Borçlanmasız: <strong>" + esc(once.tarih === null ? "dolmuyor" : once.enErken.tamam ? "şartlar dolu" : tarih(once.tarih)) +
      "</strong> · borçlanmalı: <strong>" + esc(sonra.tarih === null ? "dolmuyor" : sonra.enErken.tamam ? "şartlar dolu" : tarih(sonra.tarih)) + "</strong></p>");
    if (b.grupDegisti) satir.push('<p><span class="em-rozet em-iyi">Grup değişiyor</span> Başlangıç ' + esc(tarih(sonra.baslangic)) + "'e gidiyor: " + esc(GRUP[once.grup][0]) + " → " + esc(GRUP[sonra.grup][0]) + ".</p>");
    var bedel = b.kalemler.map(function (k) {
      return (k.tur === "askerlik" ? "askerlik" : "doğum") + " " + nf.format(k.gun) + " gün × %" + nf.format(k.oran * 100) + ": " + tl(k.enAz) + " – " + tl(k.enCok);
    }).join("; ");
    satir.push("<p>Bedel (5510 m.41, " + B.sonYil() + " sınırlarıyla): " + esc(bedel) + ". En az toplam <strong>" + tl(b.maliyetEnAz) + "</strong>.</p>");
    if (b.oneCekilenAy !== null && b.oneCekilenAy > 0) {
      var kazanc = b.oneCekilenAy >= b.geriDonusAy;
      satir.push('<p><span class="em-rozet ' + (kazanc ? "em-iyi" : "em-uyar") + '">' + (kazanc ? "Kendini ödüyor" : "Dikkatle tartın") + "</span> Emeklilik <strong>" +
        nf1.format(b.oneCekilenAy) + " ay</strong> öne geliyor. En az bedel, " + esc(b.altSinir.not) + " en düşük emekli aylığının (" + tl(b.altSinir.tutar) + ") <strong>" +
        nf1.format(b.geriDonusAy) + " katı</strong>. Gerçek aylık bundan yüksekse geri dönüş daha kısa.</p>");
    } else if (b.ulasilirOldu) {
      satir.push('<p><span class="em-rozet em-iyi">Şartlar doluyor</span> Borçlanmasız dolmayan şart borçlanmayla doluyor.</p>');
    } else {
      satir.push('<p><span class="em-rozet em-uyar">Tarih değişmiyor</span> Bağlayıcı şart ' + esc((sonra.enErken && sonra.enErken.bagli || "").toLowerCase()) +
        ": borçlanma prim gününü artırır ama bu tarihi öne çekmez. Aylık tutarı artırabilir; bunun için <a href=\"../emekli-ayligi-hesaplama/\">emekli aylığı hesaplayıcısı</a>.</p>");
    }
    kutu.innerHTML = satir.join("") + ipucu;
  }

  function duyarlilik(g) {
    var d = E.duyarlilik(g);
    var ilk = d[0].tarih, son = d[d.length - 1];
    var not = $("r-duyar-not");
    if (ilk !== null && son.tarih === ilk && ilk > BUGUN) {
      var r0 = E.hesapla(Object.assign({}, g, { yillikGun: 0 }));
      not.innerHTML = '<span class="em-rozet em-iyi">Tarih çalışmaya bağlı değil</span> Bundan sonra hiç prim ödemeseniz de en erken tarih aynı kalıyor (' +
        esc(r0.enErken.ad.toLowerCase()) + "). Bağlayıcı olan yaş; çalışmaya devam etmek tarihi değil, aylığı artırır.";
    } else not.textContent = "";
    $("r-duyar").innerHTML = d.map(function (x) {
      var ad = x.yillikGun === 360 ? "Kesintisiz (yılda 360 gün)" : x.yillikGun === 0 ? "Bundan sonra prim yok" : "Yılda " + x.yillikGun + " gün";
      var t = x.tarih === null ? "dolmuyor" : x.tarih <= BUGUN ? "şartlar dolu" : tarih(x.tarih);
      var f = "—";
      if (x.tarih !== null && ilk !== null && x.tarih > ilk) {
        var ff = E.yardimci.fark(ilk, x.tarih); f = "+" + sure(ff);
      }
      return "<tr" + (x.yillikGun === g.yillikGun ? ' class="em-en"' : "") + '><th scope="row">' + ad + '</th><td class="sayi">' + esc(t) + '</td><td class="sayi">' + esc(f) + "</td></tr>";
    }).join("");
  }

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  var genislik = 0;
  window.addEventListener("resize", function () {
    var w = $("r-cizelge").clientWidth;
    if (Math.abs(w - genislik) > 24) { genislik = w; clearTimeout(zaman); zaman = setTimeout(hesapla, 150); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  dogumAlani();
  hesapla();
})();
