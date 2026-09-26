/*!
 * Grafikler sayfası — tarayıcı katmanı.
 *
 * Sayfa JS'siz de tamdır: grafikler üreteçten statik SVG olarak gelir.
 * Bu dosya dört şey ekler:
 *   1. kutu genişliğinde yeniden çizim (telefonda yazı küçülmesin),
 *   2. imleç ve ipucu (fare, dokunma, klavye: ← → Home End),
 *   3. seçenekler (log/doğrusal, dolar/TL) ve zaman makinesi,
 *   4. hareket: grafik görünür alana girince çizilir; fiyat ve kur
 *      grafiğinde çizginin ucunu değeri sayan bir nokta izler.
 * Hareket azaltma tercihi olan okur hiçbir animasyon görmez. İlk açılışta
 * zaten görünen grafikler sabit kalır: dinlenme hali tam çizimdir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function () {
  "use strict";
  var H = window.GrafikHesap, Tn = window.GrafikTanim, C = window.GrafikCizim;
  if (!H || !Tn || !C || !window.TufeSerisi || !window.GrafikVerisi || !window.Bordro) return;

  var r = H.hesapla(window.TufeSerisi, window.GrafikVerisi, window.Bordro);
  var sayi = C.sayi, ayEtiket = C.ayEtiket;
  var azHareket = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var secenek = { fiyat: { olcek: "log" }, asgari: { birim: "usd" } };
  var cizimler = {};
  var seciliAy = null;
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---- ay anahtarları ----------------------------------------------------- */
  function aydan(indeks) {
    var y = Math.floor(indeks / 12), m = indeks - y * 12 + 1;
    return y + "-" + (m < 10 ? "0" : "") + m;
  }
  function harita(dizi, anahtar) {
    var h = {};
    dizi.forEach(function (n) { h[n[anahtar || "ay"]] = n; });
    return h;
  }
  var FIYAT = harita(r.fiyat), FAIZ = harita(r.faiz), KUR = harita(r.kur), ASGARI = harita(r.asgari);
  function yuzde(v, d) { return (v < 0 ? "−%" : "%") + sayi(Math.abs(v), d == null ? 2 : d); }

  /* ---- ipucu içerikleri: ay (ya da yıl) → satırlar ------------------------ */
  var IPUCU = {
    fiyat: function (ay) {
      var n = ay === "2004-12" ? { endeks: 100, yillik: null } : FIYAT[ay];
      if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-bir", "Endeks", sayi(n.endeks, 1)],
        n.yillik == null ? null : ["", "Yıllık TÜFE", yuzde(n.yillik)]] };
    },
    enflasyon: function (ay) {
      var n = FIYAT[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-bir", "Yıllık TÜFE", yuzde(n.yillik)]] };
    },
    faiz: function (ay) {
      var n = FAIZ[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-bir", "Politika faizi", yuzde(n.faiz)], ["gr-i-iki", "Yıllık TÜFE", yuzde(n.tufe)],
        [n.reel < 0 ? "gr-i-kayip" : "gr-i-kazanc", "Reel faiz", yuzde(n.reel, 1)]] };
    },
    reel: function (ay) { return IPUCU.faiz(ay); },
    kur: function (ay) {
      var n = KUR[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-iki", "Dolar", sayi(n.usd, 2) + " TL"], ["gr-i-iki", "Dolar endeksi", sayi(n.usdEndeks, 0)],
        ["gr-i-bir", "Fiyat endeksi", sayi(n.tufeEndeks, 0)]] };
    },
    reelKur: function (ay) {
      var n = KUR[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-iki", "Fiyatlara göre dolar", sayi(100 * n.usdEndeks / n.tufeEndeks, 1)],
        ["", "Dolar", sayi(n.usd, 2) + " TL"]] };
    },
    asgari: function (ay) {
      var n = ASGARI[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["", "Net", sayi(n.net, 2) + " TL"], ["gr-i-iki", "Dolar", "$" + sayi(n.usd)],
        ["gr-i-bir", ayEtiket(r.sonAy) + " TL'si", sayi(n.reel) + " TL"]] };
    },
    dunyaSeri: function (yil) {
      var satir = r.dunya.filter(function (s) { return s.kod !== "ARG"; }).map(function (s) {
        var n = s.nokta.filter(function (p) { return p.yil === yil; })[0];
        return n ? [s.kod === "TUR" ? "gr-i-iki" : "gr-i-soluk", s.ad, yuzde(n.deger, 1)] : null;
      }).filter(Boolean);
      return satir.length ? { baslik: String(yil), satir: satir } : null;
    }
  };

  /* ---- çiz ve bağla --------------------------------------------------------- */
  function kutuGenisligi(kap) { return Math.round(kap.querySelector(".gr-tuval").clientWidth); }

  function ciz(kap) {
    var ad = kap.getAttribute("data-kap");
    var W = kutuGenisligi(kap);
    if (W < 200) return null;
    var c = Tn.ciz(ad, r, W, secenek[ad]);
    var tuval = kap.querySelector(".gr-tuval");
    var eski = tuval.querySelector("svg");
    var gecici = document.createElement("div");
    gecici.innerHTML = c.svg;
    var yeni = gecici.firstChild;
    if (eski) tuval.replaceChild(yeni, eski); else tuval.insertBefore(yeni, tuval.firstChild);
    c.el = yeni;
    c.kap = kap;
    c.ad = ad;
    cizimler[ad] = c;
    if (IPUCU[ad]) baglaImlec(c);
    if (ad === "fiyat") secimCiz();
    if (!azHareket) kap.classList.add("gr-canli");
    return c;
  }

  function ipucuKutusu(kap) {
    var t = kap.querySelector(".gr-ipucu");
    if (!t) {
      t = document.createElement("div");
      t.className = "gr-ipucu";
      t.hidden = true;
      t.setAttribute("role", "status");
      kap.querySelector(".gr-tuval").appendChild(t);
    }
    return t;
  }

  function svgNokta(svg, e) {
    var p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  function baglaImlec(c) {
    var svg = c.el, t = c.tanim, ad = c.ad;
    var yil = t.x && t.x.tip === "yil";
    var xmin = c.xDeger(t.x.min), xmax = c.xDeger(t.x.max);
    var imlec = svg.querySelector(".gr-imlec");
    var kutu = ipucuKutusu(c.kap);
    var konum = null;
    svg.setAttribute("tabindex", "0");

    function goster(xv) {
      xv = Math.max(xmin, Math.min(xmax, xv));
      konum = xv;
      var anahtar = yil ? xv : aydan(xv);
      var icerik = IPUCU[ad](anahtar);
      if (!icerik) return;
      var px = t.tur === "cubukAyrisan" ? c.x(xv) + c.gen / 2 : c.x(xv);
      var H0 = c.kenar.ust, H1 = +svg.getAttribute("height") - c.kenar.alt;
      var parca = ['<line x1="' + px + '" x2="' + px + '" y1="' + H0 + '" y2="' + H1 + '"/>'];
      if (t.seriler) {
        t.seriler.forEach(function (s) {
          var n = s.noktalar.filter(function (p) { return c.xDeger(p.x) === xv; })[0];
          if (!n || n.y == null) return;
          var sinif = /gr-s-iki/.test(s.sinif) ? "gr-i-iki" : /gr-s-soluk/.test(s.sinif) ? "gr-i-soluk" : "gr-i-bir";
          parca.push('<circle class="' + sinif + '" cx="' + px + '" cy="' + c.y(n.y) + '" r="4.5"/>');
        });
      }
      imlec.innerHTML = parca.join("");
      if (ad === "fiyat") secimCiz();
      kutu.innerHTML = "<b>" + icerik.baslik + "</b>" + icerik.satir.filter(Boolean).map(function (s) {
        return '<span><i class="' + s[0] + '">' + s[1] + "</i>" + s[2] + "</span>";
      }).join("");
      kutu.hidden = false;
      var olcek = svg.clientWidth / +svg.getAttribute("width");
      var sol = px * olcek, kw = kutu.offsetWidth;
      sol = Math.max(kw / 2 + 2, Math.min(svg.clientWidth - kw / 2 - 2, sol));
      kutu.style.left = sol + "px";
      kutu.style.top = (H0 + 8) * olcek + "px";
      kutu.style.transform = "translate(-50%, 0)";
    }
    function gizle() {
      imlec.innerHTML = "";
      kutu.hidden = true;
      if (ad === "fiyat") secimCiz();
    }
    function isaretciden(e) {
      var p = svgNokta(svg, e);
      var xv = c.x.ters(p.x);
      goster(t.tur === "cubukAyrisan" ? Math.floor(xv) : Math.round(xv));
    }
    svg.addEventListener("pointermove", isaretciden);
    svg.addEventListener("pointerdown", isaretciden);
    svg.addEventListener("pointerleave", gizle);
    svg.addEventListener("blur", gizle);
    svg.addEventListener("focus", function () { goster(xmax); });
    svg.addEventListener("keydown", function (e) {
      var adim = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[e.key];
      if (adim) { e.preventDefault(); goster((konum == null ? xmax : konum) + adim * (yil ? 1 : 1)); }
      else if (e.key === "Home") { e.preventDefault(); goster(xmin); }
      else if (e.key === "End") { e.preventDefault(); goster(xmax); }
      else if (e.key === "Escape") { gizle(); }
    });
  }

  /* ---- zaman makinesi --------------------------------------------------------- */
  var zamanGirdi = document.getElementById("gr-zaman-secim");
  var zamanCikti = document.querySelector(".gr-zaman-cikti");
  function secimCiz() {
    var c = cizimler.fiyat;
    if (!c || !seciliAy) return;
    var g = c.el.querySelector(".gr-secim-katman");
    if (!g) {
      g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "gr-imlec gr-secim-katman");
      g.setAttribute("aria-hidden", "true");
      c.el.insertBefore(g, c.el.querySelector(".gr-imlec"));
    }
    var n = FIYAT[seciliAy]; if (!n) return;
    var px = c.x(c.xDeger(seciliAy));
    g.innerHTML = '<line class="gr-secili" x1="' + px + '" x2="' + px + '" y1="' + c.y(n.endeks) + '" y2="' +
      (+c.el.getAttribute("height") - c.kenar.alt) + '"/><circle class="gr-i-iki" cx="' + px + '" cy="' + c.y(n.endeks) + '" r="5"/>';
  }
  function zamanGuncelle() {
    var ay = r.fiyat[+zamanGirdi.value].ay;
    seciliAy = ay;
    zamanCikti.innerHTML = Tn.zamanMetni(H.zamanMakinesi(r, ay));
    zamanGirdi.setAttribute("aria-valuetext", Tn.ayUzun(ay));
    secimCiz();
  }
  if (zamanGirdi && zamanCikti) {
    zamanGirdi.max = String(r.fiyat.length - 1);
    zamanGirdi.addEventListener("input", zamanGuncelle);
    seciliAy = r.fiyat[+zamanGirdi.value].ay;
    zamanGirdi.setAttribute("aria-valuetext", Tn.ayUzun(seciliAy));
  }

  /* ---- hareket ---------------------------------------------------------------- */
  function yumusak(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* İzleyici: çizginin ucunda değeri sayan nokta. Değer geometriden,
     ölçeğin tersinden okunur; bitişte gerçek değere oturur. */
  var IZLEYICI = {
    fiyat: { seri: 0, bicim: function (v) { return sayi(v); }, son: function () { return sayi(r.fiyat[r.fiyat.length - 1].endeks); } },
    kur: { seri: 1, bicim: function (v) { return "×" + sayi(v / 100, 1); }, son: function () { return "×" + sayi(r.kur[r.kur.length - 1].usdEndeks / 100, 1); } }
  };

  function oynat(kap) {
    var c = cizimler[kap.getAttribute("data-kap")];
    if (!c) return;
    kap.classList.remove("gr-hazir");
    kap.classList.add("gr-oynat");
    var yollar = [].slice.call(c.el.querySelectorAll(".gr-cizgi"));
    if (!yollar.length) return;
    var boy = yollar.map(function (p) { return p.getTotalLength(); });
    var iz = IZLEYICI[c.ad], izYol = iz && yollar[iz.seri], izG = null, izMetin = null;
    if (izYol) {
      izG = document.createElementNS(SVGNS, "g");
      izG.setAttribute("class", "gr-izci");
      izG.innerHTML = '<circle class="gr-izci-hale" r="10"/><circle r="4.5"/><text dy="-14"></text>';
      c.el.appendChild(izG);
      izMetin = izG.querySelector("text");
    }
    var sure = 1500, bas = null;
    function kare(zaman) {
      if (bas === null) bas = zaman;
      var t = Math.min(1, (zaman - bas) / sure), e = yumusak(t);
      yollar.forEach(function (p, i) { p.style.strokeDashoffset = String(boy[i] * (1 - e)); });
      if (izYol) {
        var nk = izYol.getPointAtLength(boy[iz.seri] * e);
        izG.setAttribute("transform", "translate(" + nk.x + "," + nk.y + ")");
        izMetin.textContent = iz.bicim(c.y.ters(nk.y));
      }
      if (t < 1) { window.requestAnimationFrame(kare); return; }
      yollar.forEach(function (p) { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; });
      if (izG) {
        izMetin.textContent = iz.son();
        izG.style.transition = "opacity .5s ease .6s";
        izG.style.opacity = "0";
        setTimeout(function () { if (izG.parentNode) izG.parentNode.removeChild(izG); }, 1300);
      }
    }
    window.requestAnimationFrame(kare);
  }

  function hazirla(kap) {
    var c = cizimler[kap.getAttribute("data-kap")];
    if (!c) return;
    kap.classList.add("gr-hazir");
    [].forEach.call(c.el.querySelectorAll(".gr-cizgi"), function (p) {
      var L = p.getTotalLength();
      p.style.strokeDasharray = L + " " + L;
      p.style.strokeDashoffset = String(L);
    });
  }

  /* ---- sayaç (giriş başlığı) ----------------------------------------------------- */
  function sayac(el) {
    var metin = el.textContent, hedef = parseFloat(metin.replace(/\./g, "").replace(",", "."));
    var ondalik = (metin.split(",")[1] || "").length;
    if (!isFinite(hedef)) return;
    var bas = null, sure = 1800;
    function kare(z) {
      if (bas === null) bas = z;
      var t = Math.min(1, (z - bas) / sure), e = 1 - Math.pow(1 - t, 4);
      el.textContent = sayi(1 + (hedef - 1) * e, ondalik);
      if (t < 1) window.requestAnimationFrame(kare); else el.textContent = metin;
    }
    window.requestAnimationFrame(kare);
  }

  /* ---- kurulum ------------------------------------------------------------------ */
  var kaplar = [].slice.call(document.querySelectorAll(".gr-sekil[data-kap]"));
  kaplar.forEach(ciz);
  if (zamanGirdi) zamanGuncelle();

  if (!azHareket && "IntersectionObserver" in window) {
    var gorunen = kaplar.filter(function (k) {
      var b = k.getBoundingClientRect();
      return b.top < window.innerHeight && b.bottom > 0;
    });
    var gozcu = new IntersectionObserver(function (girdiler) {
      girdiler.forEach(function (g) {
        if (!g.isIntersecting) return;
        gozcu.unobserve(g.target);
        oynat(g.target);
      });
    }, { threshold: .3 });
    kaplar.forEach(function (k) {
      if (gorunen.indexOf(k) >= 0) return;
      hazirla(k);
      gozcu.observe(k);
    });
    var sayacEl = document.querySelector("[data-sayac]");
    if (sayacEl) sayac(sayacEl);
  }

  /* seçenek düğmeleri */
  [].forEach.call(document.querySelectorAll(".gr-secim button"), function (d) {
    d.addEventListener("click", function () {
      var kap = d.closest(".gr-sekil"), ad = kap.getAttribute("data-kap");
      secenek[ad][d.getAttribute("data-secenek")] = d.getAttribute("data-deger");
      [].forEach.call(d.parentNode.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b === d)); });
      ciz(kap);
      if (!azHareket) { hazirla(kap); window.requestAnimationFrame(function () { oynat(kap); }); }
    });
  });

  /* yeniden boyutlandırma: yalnız genişlik değişince, animasyonsuz */
  var sonGenislik = window.innerWidth, zamanlayici = null;
  window.addEventListener("resize", function () {
    if (window.innerWidth === sonGenislik) return;
    sonGenislik = window.innerWidth;
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(function () {
      kaplar.forEach(function (k) { k.classList.remove("gr-hazir"); k.classList.add("gr-oynat"); ciz(k); });
    }, 150);
  });

  /* ---- HUD: etkin bölüm ve ilerleme ------------------------------------------ */
  var hud = document.querySelector(".gr-hud");
  var giris = document.querySelector(".gr-giris");
  var bolumler = [].slice.call(document.querySelectorAll(".gr-bolum"));
  if (hud && giris && "IntersectionObserver" in window) {
    new IntersectionObserver(function (g) {
      hud.classList.toggle("gr-hud--acik", !g[0].isIntersecting);
    }, { threshold: 0 }).observe(giris);
    var baglantilar = {};
    [].forEach.call(hud.querySelectorAll("a[data-hud]"), function (a) { baglantilar[a.getAttribute("data-hud")] = a; });
    /* Etkin bölüm konumdan hesaplanır: gözlemci hızlı kaydırmada (çapaya
       atlama, yumuşak kaydırma) aradaki bölümleri kaçırabiliyordu ve şerit
       V. bölümdeyken III'ü gösteriyordu. */
    var etkinId = null;
    function etkinBul() {
      var cizgi = window.innerHeight * 0.45, bulunan = null;
      bolumler.forEach(function (b) { if (b.getBoundingClientRect().top <= cizgi) bulunan = b.id; });
      if (bulunan === etkinId) return;
      etkinId = bulunan;
      Object.keys(baglantilar).forEach(function (k) {
        baglantilar[k].classList.toggle("gr-etkin", k === bulunan);
        if (k === bulunan) baglantilar[k].setAttribute("aria-current", "true");
        else baglantilar[k].removeAttribute("aria-current");
      });
    }
    var cubuk = hud.querySelector(".gr-hud-cubuk i");
    var bekliyor = false;
    window.addEventListener("scroll", function () {
      if (bekliyor) return;
      bekliyor = true;
      window.requestAnimationFrame(function () {
        var ust = bolumler[0].offsetTop, alt = bolumler[bolumler.length - 1];
        var son = alt.offsetTop + alt.offsetHeight - window.innerHeight;
        var oran = Math.max(0, Math.min(1, (window.scrollY - ust + window.innerHeight * .3) / Math.max(1, son - ust)));
        cubuk.style.setProperty("--ilerleme", oran.toFixed(3));
        etkinBul();
        bekliyor = false;
      });
    }, { passive: true });
    etkinBul();
  }
})();
