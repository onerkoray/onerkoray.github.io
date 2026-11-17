/*!
 * Grafikler sayfası — tarayıcı katmanı.
 *
 * Sayfa JS'siz de tamdır: grafikler üreteçten statik SVG olarak gelir.
 * Bu dosya altı şey ekler:
 *   1. kutu genişliğinde yeniden çizim (telefonda yazı küçülmesin),
 *   2. imleç ve ipucu (fare, dokunma, klavye: ← → Home End),
 *   3. seçenekler (log/doğrusal, dolar/TL) ve zaman makinesi,
 *   4. hareket: grafik görünür alana girince çizilir; fiyat ve kur
 *      grafiğinde çizginin ucunu değeri sayan bir nokta izler,
 *   5. dönem seçici: aylık grafikler son 10, 5 ya da 2 yılı gösterir; endeks
 *      grafikleri dönem başında 100'e çekilir. Başlıklar tüm dönemi anlatmayı
 *      sürdürür; her grafik gösterdiği dönemi kendi üstünde yazar,
 *   6. bağlı okuma ve ülke seçici: bir aylık grafikte gezilen ay, ekrandaki
 *      öteki aylık grafiklerde de işaretlenir; dünya grafiğinde karşılaştırılan
 *      ekonomileri okur seçer.
 * Seçimler adreste yalnız # sonrasında durur (durum.js): #donem=5&ulke=BR,US.
 * Hareket azaltma tercihi olan okur hiçbir animasyon görmez. İlk açılışta
 * zaten görünen grafikler sabit kalır: dinlenme hali tam çizimdir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function () {
  "use strict";
  var H = window.GrafikHesap, Tn = window.GrafikTanim, C = window.GrafikCizim;
  if (!H || !Tn || !C || !window.TufeSerisi || !window.GrafikVerisi || !window.Bordro) return;

  var r = H.hesapla(window.TufeSerisi, window.GrafikVerisi, window.Bordro, window.EmekliTaban);
  var sayi = C.sayi, ayEtiket = C.ayEtiket;
  var azHareket = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var secenek = { fiyat: { olcek: "log" }, asgari: { birim: "usd" }, dunyaSeri: {} };
  var donemYil = null;                 // null: tüm dönem; 10 | 5 | 2
  var DONEMLER = [null, 10, 5, 2];
  function donemBas() {
    if (!donemYil) return null;
    return aydan(C.ayIndeksi(r.sonAy) - donemYil * 12 + 1);
  }
  function donemAdi(y) { return y ? "Son " + y + " yıl" : "Tüm dönem"; }
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
  var BIRIKIM = harita(r.birikim), VERGI = harita(r.vergi, "yil");
  var EMEKLI = r.emekli ? harita(r.emekli) : {};
  var MAKRO = {};
  ["kisiBasi", "buyume", "issizlik", "cari"].forEach(function (k) { MAKRO[k] = harita(r.makro[k], "yil"); });
  function yuzdeYil(k, yil, etiket, ondalik) {
    var n = MAKRO[k][yil]; if (!n) return null;
    var satir = [["gr-i-iki", "Türkiye", k === "kisiBasi" ? "$" + sayi(n.tur) : yuzde(n.tur, ondalik)]];
    if (n.ortanca != null) satir.push(["gr-i-soluk", "G20 ortancası", k === "kisiBasi" ? "$" + sayi(n.ortanca) : yuzde(n.ortanca, ondalik)]);
    return { baslik: yil + " · " + etiket, satir: satir };
  }
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
    dunyaSeri: function (ay) {
      var c = cizimler.dunyaSeri; if (!c) return null;
      var satir = c.tanim.seriler.slice().reverse().map(function (s) {
        var n = s.noktalar.filter(function (p) { return p.x === ay; })[0];
        return n ? [seriRengi(s.sinif), s.ad, n.y == null ? "yayımlanmadı" : yuzde(n.y, 1)] : null;
      }).filter(Boolean);
      return satir.length ? { baslik: ayEtiket(ay), satir: satir } : null;
    },
    taban: function (ay) {
      var n = EMEKLI[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["", "En düşük aylık", sayi(n.taban) + " TL"],
        ["gr-i-bir", ayEtiket(r.sonAy) + " TL'si", sayi(n.reel) + " TL"], ["gr-i-iki", "Net asgari ücrete oranı", yuzde(n.oran, 1)]] };
    },
    tabanOran: function (ay) {
      var n = EMEKLI[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay), satir: [["gr-i-iki", "Oran", yuzde(n.oran, 1)], ["", "En düşük aylık", sayi(n.taban) + " TL"],
        ["", "Net asgari ücret", sayi(n.net, 2) + " TL"]] };
    },
    birikim: function (ay) {
      var n = BIRIKIM[ay]; if (!n) return null;
      return { baslik: ayEtiket(ay) + " · 100 TL'nin karşılığı", satir: [
        ["gr-i-uc", "Altın", sayi(n.altin) + " TL"], ["gr-i-iki", "Dolar", sayi(n.dolar) + " TL"],
        ["gr-i-soluk", "Euro", sayi(n.euro) + " TL"], ["gr-i-bir", "Fiyatlar", sayi(n.fiyat) + " TL"],
        ["", "Gram altın", sayi(n.gram, 2) + " TL"]] };
    },
    vergi: function (yil) {
      var n = VERGI[yil]; if (!n) return null;
      return { baslik: String(yil), satir: [["gr-i-iki", "İkinci eşik", sayi(n.ikinci) + " TL · " + sayi(n.ikinciKat, 2) + "×"],
        ["gr-i-bir", "Üçüncü eşik", sayi(n.ucuncu) + " TL · " + sayi(n.ucuncuKat, 2) + "×"],
        ["", "Yıllık asgari brüt", sayi(n.yillikAsgari) + " TL"]] };
    },
    kisiBasi: function (yil) { return yuzdeYil("kisiBasi", yil, "kişi başı GSYH"); },
    buyume: function (yil) {
      var n = MAKRO.buyume[yil]; if (!n) return null;
      return { baslik: yil + " · reel büyüme", satir: [[n.tur < 0 ? "gr-i-kayip" : "gr-i-kazanc", "Türkiye", yuzde(n.tur, 1)],
        ["gr-i-soluk", "G20 ortancası", yuzde(n.ortanca, 1)]] };
    },
    issizlik: function (yil) { return yuzdeYil("issizlik", yil, "işsizlik", 1); },
    cari: function (yil) {
      var n = MAKRO.cari[yil]; if (!n) return null;
      return { baslik: yil + " · cari denge", satir: [[n.tur < 0 ? "gr-i-kayip" : "gr-i-kazanc", "Türkiye", yuzde(n.tur, 1) + " GSYH"]] };
    }
  };

  function seriRengi(sinif) {
    return /gr-s-iki/.test(sinif) ? "gr-i-iki" : /gr-s-soluk/.test(sinif) ? "gr-i-soluk" :
      /gr-s-uc/.test(sinif) ? "gr-i-uc" : "gr-i-bir";
  }

  /* ---- çiz ve bağla --------------------------------------------------------- */
  function kutuGenisligi(kap) { return Math.round(kap.querySelector(".gr-tuval").clientWidth); }

  function ciz(kap) {
    var ad = kap.getAttribute("data-kap");
    var W = kutuGenisligi(kap);
    if (W < 200) return null;
    var sec = {}, kaynak = secenek[ad] || {}, bas = donemBas();
    Object.keys(kaynak).forEach(function (k) { sec[k] = kaynak[k]; });
    if (bas) sec.bas = bas;
    var c = Tn.ciz(ad, r, W, sec);
    var rozet = kap.querySelector(".gr-donem-rozet");
    if (c.tanim.donem) {
      if (!rozet) {
        rozet = document.createElement("p");
        rozet.className = "gr-donem-rozet";
        kap.querySelector(".gr-sekil-ust").appendChild(rozet);
      }
      rozet.textContent = donemAdi(donemYil) + " · " + ayEtiket(c.tanim.donem) + "–" + ayEtiket(r.sonAy) +
        (c.tanim.baz ? " · dönem başı = 100" : "");
      kap.classList.add("gr-sekil--donem");
    } else { if (rozet) rozet.parentNode.removeChild(rozet); kap.classList.remove("gr-sekil--donem"); }
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
    if (ad === "isi") baglaIsi(c);
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

  /* Bağlı okuma: bir grafikte gezilen ay (ya da yıl), ekranda görünen ve aynı
     zaman birimini kullanan öteki grafiklerde de gösterilir. */
  var imlecler = {};
  function ekranda(kap) {
    var b = kap.getBoundingClientRect();
    return b.bottom > 0 && b.top < window.innerHeight;
  }
  function yayinla(kimden, yil, xv) {
    Object.keys(imlecler).forEach(function (ad) {
      var m = imlecler[ad];
      if (ad === kimden || m.yil !== yil) return;
      if (xv == null) m.gizle();
      else if (ekranda(m.kap)) m.goster(xv);
    });
  }

  function baglaImlec(c) {
    var svg = c.el, t = c.tanim, ad = c.ad;
    var yil = t.x && t.x.tip === "yil";
    var xmin = c.xDeger(t.x.min), xmax = c.xDeger(t.x.max);
    var imlec = svg.querySelector(".gr-imlec");
    var kutu = ipucuKutusu(c.kap);
    var konum = null;
    svg.setAttribute("tabindex", "0");
    imlecler[ad] = { yil: yil, kap: c.kap, goster: function (xv) { goster(xv, true); }, gizle: function () { gizle(true); } };

    function goster(xv, distan) {
      if (distan && (xv < xmin || xv > xmax)) { gizle(true); return; }
      xv = Math.max(xmin, Math.min(xmax, xv));
      konum = xv;
      if (!distan) yayinla(ad, yil, xv);
      var anahtar = yil ? xv : aydan(xv);
      var icerik = IPUCU[ad](anahtar);
      if (!icerik) return;
      var px = t.tur === "cubukAyrisan" ? c.x(xv) + (c.bosluk || 0) / 2 + c.gen / 2 : c.x(xv);
      var H0 = c.kenar.ust, H1 = +svg.getAttribute("height") - c.kenar.alt;
      var parca = ['<line x1="' + px + '" x2="' + px + '" y1="' + H0 + '" y2="' + H1 + '"/>'];
      if (t.seriler) {
        t.seriler.forEach(function (s) {
          var n = s.noktalar.filter(function (p) { return c.xDeger(p.x) === xv; })[0];
          if (!n || n.y == null) return;
          var sinif = seriRengi(s.sinif);
          parca.push('<circle class="' + sinif + '" cx="' + px + '" cy="' + c.y(n.y) + '" r="4.5"/>');
        });
      }
      imlec.innerHTML = parca.join("");
      if (ad === "fiyat") secimCiz();
      var satirlar = icerik.satir.filter(Boolean);
      if (t.donem && t.baz) {
        /* Dönem görünümü: eksen dönem başı = 100; ipucu asıl değerin yanında bunu da söyler. */
        t.seriler.forEach(function (s) {
          if (/gr-s-soluk/.test(s.sinif)) return;
          var n = s.noktalar.filter(function (p) { return c.xDeger(p.x) === xv; })[0];
          if (n && n.y != null) satirlar.push([seriRengi(s.sinif), s.ad + ", dönem başından", "×" + sayi(n.y / 100, 2)]);
        });
      }
      kutu.innerHTML = "<b>" + icerik.baslik + "</b>" + satirlar.map(function (s) {
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
    function gizle(distan) {
      imlec.innerHTML = "";
      kutu.hidden = true;
      if (ad === "fiyat") secimCiz();
      if (distan !== true) yayinla(ad, yil, null);
    }
    function isaretciden(e) {
      var p = svgNokta(svg, e);
      var xv = c.x.ters(p.x);
      goster(t.tur === "cubukAyrisan" ? Math.floor(xv) : Math.round(xv));
    }
    svg.addEventListener("pointermove", isaretciden);
    svg.addEventListener("pointerdown", isaretciden);
    svg.addEventListener("pointerleave", function () { gizle(); });
    svg.addEventListener("blur", function () { gizle(); });
    svg.addEventListener("focus", function () { goster(xmax); });
    svg.addEventListener("keydown", function (e) {
      var adim = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[e.key];
      if (adim) { e.preventDefault(); goster((konum == null ? xmax : konum) + adim * (yil ? 1 : 1)); }
      else if (e.key === "Home") { e.preventDefault(); goster(xmin); }
      else if (e.key === "End") { e.preventDefault(); goster(xmax); }
      else if (e.key === "Escape") { gizle(); }
    });
  }

  /* ---- ısı haritası: hücre üzerine gelince ------------------------------------ */
  function baglaIsi(c) {
    var svg = c.el, kutu = ipucuKutusu(c.kap);
    function goster(h) {
      var ay = h.getAttribute("data-ay"), n = FIYAT[ay];
      kutu.innerHTML = "<b>" + ayEtiket(ay) + "</b><span><i>Aylık</i>" + yuzde(+h.getAttribute("data-v")) + "</span>" +
        (n ? "<span><i>Yıllık</i>" + yuzde(n.yillik) + "</span>" : "");
      kutu.hidden = false;
      var b = h.getBoundingClientRect(), t = c.kap.querySelector(".gr-tuval").getBoundingClientRect();
      var kw = kutu.offsetWidth, sol = b.left - t.left + b.width / 2;
      kutu.style.left = Math.max(kw / 2 + 2, Math.min(t.width - kw / 2 - 2, sol)) + "px";
      kutu.style.top = (b.top - t.top - kutu.offsetHeight - 8) + "px";
      kutu.style.transform = "translate(-50%, 0)";
    }
    svg.addEventListener("pointermove", function (e) {
      var h = e.target.closest && e.target.closest(".gr-isi-hucre");
      if (h) goster(h); else kutu.hidden = true;
    });
    svg.addEventListener("pointerleave", function () { kutu.hidden = true; });
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
    /* Dönem görünümünde seçilen ay aralığın dışındaysa işaret çizilmez;
       içindeyse değer dönem başı = 100 ölçeğine çevrilir. */
    if (c.tanim.donem && seciliAy < c.tanim.donem) { g.innerHTML = ""; return; }
    var deger = n.endeks * (c.tanim.carpan ? c.tanim.carpan[0] : 1);
    var px = c.x(c.xDeger(seciliAy));
    g.innerHTML = '<line class="gr-secili" x1="' + px + '" x2="' + px + '" y1="' + c.y(deger) + '" y2="' +
      (+c.el.getAttribute("height") - c.kenar.alt) + '"/><circle class="gr-i-iki" cx="' + px + '" cy="' + c.y(deger) + '" r="5"/>';
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
    kur: { seri: 1, bicim: function (v) { return "×" + sayi(v / 100, 1); }, son: function () { return "×" + sayi(r.kur[r.kur.length - 1].usdEndeks / 100, 1); } },
    birikim: { seri: 3, bicim: function (v) { return sayi(v) + " TL"; }, son: function () { return sayi(r.birikim[r.birikim.length - 1].altin) + " TL"; } }
  };

  function oynat(kap) {
    var c = cizimler[kap.getAttribute("data-kap")];
    if (!c) return;
    kap.classList.remove("gr-hazir");
    kap.classList.add("gr-oynat");
    var yollar = [].slice.call(c.el.querySelectorAll(".gr-cizgi"));
    if (!yollar.length) return;
    var boy = yollar.map(function (p) { return p.getTotalLength(); });
    var iz = c.tanim.donem ? null : IZLEYICI[c.ad], izYol = iz && yollar[iz.seri], izG = null, izMetin = null;
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

  /* ---- adres durumu: #donem=5&ulke=BR,US ---------------------------------------- */
  var ULKE_SINIR = Tn.YUVA.length;
  var ULKE_VARSAYILAN = r.dunyaAy ? r.dunyaAy.seriler.slice(1).map(function (s) { return s.kod; }) : [];
  var ulkeler = ULKE_VARSAYILAN.map(function (k, i) { return { kod: k, yuva: i }; });
  var ulkeDokunuldu = false;
  function durumOku() {
    if (!window.Durum) return;
    var d = window.Durum.oku();
    var y = +d.get("donem");
    if (DONEMLER.indexOf(y) > 0) donemYil = y;
    if (d.has("ulke") && r.dunyaAy) {
      var gecerli = r.dunyaAy.alanlar.map(function (a) { return a.kod; });
      var secilen = d.get("ulke").split(",").filter(function (k, i, dizi) {
        return k !== "TR" && gecerli.indexOf(k) >= 0 && dizi.indexOf(k) === i;
      }).slice(0, ULKE_SINIR);
      ulkeler = secilen.map(function (k, i) { return { kod: k, yuva: i }; });
      ulkeDokunuldu = true;
    }
  }
  function durumYaz() {
    if (!window.Durum) return;
    var d = new URLSearchParams();
    if (donemYil) d.set("donem", String(donemYil));
    if (ulkeDokunuldu) d.set("ulke", ulkeler.map(function (u) { return u.kod; }).join(","));
    window.Durum.yaz(d);
  }
  durumOku();
  /* Statik sayfa dört ülkeyi gri çizer; okur seçince (ya da adres bir seçim
     taşıyorsa) her ülke kendi çizgisini alır. */
  function ulkeUygula() { secenek.dunyaSeri = ulkeDokunuldu ? { ulkeler: ulkeler } : {}; }
  ulkeUygula();

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
  [].forEach.call(document.querySelectorAll(".gr-secim button[data-secenek]"), function (d) {
    d.addEventListener("click", function () {
      var kap = d.closest(".gr-sekil"), ad = kap.getAttribute("data-kap");
      secenek[ad][d.getAttribute("data-secenek")] = d.getAttribute("data-deger");
      [].forEach.call(d.parentNode.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b === d)); });
      ciz(kap);
      if (!azHareket) { hazirla(kap); window.requestAnimationFrame(function () { oynat(kap); }); }
    });
  });

  /* ---- dönem seçici ---------------------------------------------------------------
     Bütün [data-donem] düğmeleri aynı durumu gösterir (giriş ve alt şerit). */
  var donemDugmeleri = [].slice.call(document.querySelectorAll("button[data-donem]"));
  var donemDongu = document.querySelector("button[data-donem-dongu]");
  var donemDurum = document.getElementById("gr-donem-durum");
  function donemGoster() {
    donemDugmeleri.forEach(function (b) {
      b.setAttribute("aria-pressed", String((+b.getAttribute("data-donem") || null) === donemYil));
    });
    if (donemDongu) donemDongu.querySelector("span").textContent = donemYil ? donemYil + " yıl" : "Tümü";
    document.documentElement.classList.toggle("gr-donemli", !!donemYil);
    if (donemDurum) {
      donemDurum.textContent = donemYil
        ? "Aylık grafikler " + ayEtiket(donemBas()) + "–" + ayEtiket(r.sonAy) + " dönemini gösteriyor. Yıllık grafikler ve başlıklardaki rakamlar tüm dönemi anlatır."
        : "Bütün grafikler tüm dönemi gösteriyor.";
    }
  }
  function donemSec(y) {
    if (y === donemYil) return;
    donemYil = y;
    donemGoster();
    durumYaz();
    kaplar.forEach(function (k) {
      k.classList.remove("gr-hazir"); k.classList.add("gr-oynat");
      ciz(k);
      if (!azHareket && cizimler[k.getAttribute("data-kap")] && k.querySelector(".gr-cizgi") && ekranda(k)) {
        hazirla(k); window.requestAnimationFrame(function () { oynat(k); });
      }
    });
  }
  donemDugmeleri.forEach(function (b) {
    b.addEventListener("click", function () { donemSec(+b.getAttribute("data-donem") || null); });
  });
  if (donemDongu) {
    donemDongu.addEventListener("click", function () {
      donemSec(DONEMLER[(DONEMLER.indexOf(donemYil) + 1) % DONEMLER.length]);
    });
  }
  donemGoster();

  /* ---- ülke seçici (dünya enflasyon serisi) ---------------------------------------- */
  var ulkeKutu = document.querySelector(".gr-ulkeler");
  if (ulkeKutu && r.dunyaAy) {
    var ulkeDurum = ulkeKutu.querySelector(".gr-ulke-durum");
    var liste = ulkeKutu.querySelector(".gr-ulke-liste");
    r.dunyaAy.alanlar.filter(function (a) { return a.kod !== "TR"; })
      .sort(function (a, b) { return a.ad.localeCompare(b.ad, "tr"); })
      .forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-ulke", a.kod);
        b.textContent = a.ad;
        liste.appendChild(b);
      });
    var ulkeDugmeleri = [].slice.call(liste.querySelectorAll("button"));
    var ulkeGoster = function () {
      ulkeDugmeleri.forEach(function (b) {
        var u = ulkeler.filter(function (x) { return x.kod === b.getAttribute("data-ulke"); })[0];
        b.setAttribute("aria-pressed", String(!!u));
        if (u && ulkeDokunuldu) b.setAttribute("data-yuva", String(u.yuva)); else b.removeAttribute("data-yuva");
      });
      var soluk = document.querySelector('[data-kap="dunyaSeri"] .gr-lejant .gr-l-soluk');
      if (soluk) soluk.hidden = ulkeDokunuldu;
    };
    liste.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-ulke]");
      if (!b) return;
      var kod = b.getAttribute("data-ulke");
      var var_ = ulkeler.filter(function (x) { return x.kod === kod; })[0];
      if (var_) {
        ulkeler = ulkeler.filter(function (x) { return x.kod !== kod; });   // kalanların yuvası (rengi) değişmez
        ulkeDurum.textContent = b.textContent + " çıkarıldı.";
      } else if (ulkeler.length >= ULKE_SINIR) {
        ulkeDurum.textContent = "En çok " + ULKE_SINIR + " ekonomi karşılaştırılır; önce birini çıkarın.";
        return;
      } else {
        var bos = 0;
        while (ulkeler.some(function (x) { return x.yuva === bos; })) bos++;
        ulkeler.push({ kod: kod, yuva: bos });
        ulkeDurum.textContent = b.textContent + " eklendi.";
      }
      ulkeDokunuldu = true;
      ulkeUygula(); ulkeGoster(); durumYaz();
      var kap = document.querySelector('.gr-sekil[data-kap="dunyaSeri"]');
      kap.classList.remove("gr-hazir"); kap.classList.add("gr-oynat");
      ciz(kap);
    });
    ulkeKutu.hidden = false;
    ulkeGoster();
  }

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
