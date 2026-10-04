/* Akış grafiği: bir kaynaktan dört yola ayrılan para.
 *
 * Kaynak düğümünden çıkan eğriler sağdaki yollara bağlanır. Her yolun
 * yarı saydam bandı tutarla orantılı kalınlıkta; üstünde ince bir çizgi ve
 * yol boyunca akan noktalar var. Noktalar SÜS DEĞİL, veri işaretidir: bir
 * yoldaki nokta sayısı o yolun payıyla orantılı, hızları sabit. Tutar
 * değişince bantlar ve noktalar yumuşakça geçer (taşma yok: bir bant hiçbir
 * an değerinden kalın görünmez).
 *
 * AGENTS.md bölüm 5: deterministik (rastgelelik yok; her nokta sabit bir
 * fazdan başlar), "hareketi azalt" tercihinde döngü hiç başlamaz ve
 * noktalar sabit yerlerinde çizilir, sayfa görünmüyorken döngü durur.
 *
 * Kullanım:
 *   var a = Akis.kur(kap, { kaynak: "Liste fiyatı" });
 *   a.ciz([{ ad: "Araç bedeli", deger: 880952, sinif: "ak-1" }, ...], toplam);
 */
(function (kok) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var azalt = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NOKTA = 18;          // yol başına nokta yuvası
  var HIZ = 54;            // piksel / saniye
  var GECIS = 650;         // ms

  function el(ad, oz) {
    var e = document.createElementNS(NS, ad);
    for (var k in oz) e.setAttribute(k, oz[k]);
    return e;
  }
  function yumusak(x) { return 1 - Math.pow(1 - x, 3); }   // taşmasız
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

  function kur(kap, secenek) {
    secenek = secenek || {};
    var durum = { yollar: [], hedef: [], baslangic: [], an: 0, gecisBas: 0, toplam: 1, calisiyor: false, gorunur: true, t0: 0 };
    var svg = null, W = 0, H = 0, geo = null;

    function geometri(n) {
      W = Math.max(320, Math.min(640, Math.round(kap.clientWidth || 560)));
      var dar = W < 440;
      H = 34 + n * 46 + 6;
      var x0 = dar ? 78 : 104, xe = W - (dar ? 112 : 150), xj = x0 + (xe - x0) * 0.46;
      var yc = 34 + (n - 1) * 46 / 2 + 8;
      var ys = [];
      for (var i = 0; i < n; i++) ys.push(34 + i * 46 + 8);
      return { dar: dar, x0: x0, xe: xe, xj: xj, yc: yc, ys: ys };
    }

    function iskelet(yollar) {
      kap.innerHTML = "";
      geo = geometri(yollar.length);
      svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "ak-svg", role: "img" });
      var baslik = el("title", {}); svg.appendChild(baslik);
      /* Kaynak etiketi düğümün solunda: yollar sağa ayrıldığı için hiçbir banda binmez. */
      var kaynakYazi = el("text", { x: geo.x0 - 12, y: geo.yc - 3, class: "ak-kaynak", "text-anchor": "end" });
      kaynakYazi.textContent = (secenek.kaynak || "Kaynak").toLocaleUpperCase("tr-TR");
      svg.appendChild(kaynakYazi);
      durum.kaynakDeger = el("text", { x: geo.x0 - 12, y: geo.yc + 12, class: "ak-deger", "text-anchor": "end" });
      svg.appendChild(durum.kaynakDeger);
      durum.yollar = yollar.map(function (y, i) {
        var yi = geo.ys[i];
        var d = "M" + geo.x0 + " " + geo.yc + " C" + (geo.x0 + (geo.xj - geo.x0) * 0.55) + " " + geo.yc + " " +
          (geo.x0 + (geo.xj - geo.x0) * 0.45) + " " + yi + " " + geo.xj + " " + yi + " L" + geo.xe + " " + yi;
        var g = el("g", { class: "ak-yol " + y.sinif, tabindex: "0" });
        var bant = el("path", { d: d, class: "ak-bant" });
        var cizgi = el("path", { d: d, class: "ak-cizgi" });
        g.appendChild(bant); g.appendChild(cizgi);
        var noktalar = [];
        for (var k = 0; k < NOKTA; k++) { var c = el("circle", { r: 2.3, class: "ak-nokta" }); g.appendChild(c); noktalar.push(c); }
        var uc = el("circle", { cx: geo.xe, cy: yi, r: 4, class: "ak-uc" });
        g.appendChild(uc);
        var ad = el("text", { x: geo.xe + 12, y: yi + 1, class: "ak-ad" }); ad.textContent = y.ad;
        var deger = el("text", { x: geo.xe + 12, y: yi + 15, class: "ak-deger" });
        g.appendChild(ad); g.appendChild(deger);
        svg.appendChild(g);
        g.addEventListener("mouseenter", function () { odak(g); });
        g.addEventListener("focus", function () { odak(g); });
        g.addEventListener("mouseleave", function () { odak(null); });
        g.addEventListener("blur", function () { odak(null); });
        return { g: g, bant: bant, cizgi: cizgi, noktalar: noktalar, deger: deger, uc: uc, uzunluk: 0, ad: y.ad };
      });
      var dugum = el("circle", { cx: geo.x0, cy: geo.yc, r: 5, class: "ak-dugum" });
      svg.appendChild(dugum);
      kap.appendChild(svg);
      durum.yollar.forEach(function (y) { y.uzunluk = y.cizgi.getTotalLength(); });
      durum.baslik = baslik;
    }

    function odak(g) {
      svg.classList.toggle("ak-odakli", !!g);
      durum.yollar.forEach(function (y) { y.g.classList.toggle("ak-aktif", y.g === g); });
    }

    function kare(simdi) {
      var oran = durum.gecisBas ? Math.min(1, (simdi - durum.gecisBas) / GECIS) : 1;
      if (azalt) oran = 1;
      var e = yumusak(oran);
      var t = azalt ? 0 : (simdi - durum.t0) / 1000;
      durum.yollar.forEach(function (y, i) {
        var v = durum.baslangic[i] + (durum.hedef[i] - durum.baslangic[i]) * e;
        var pay = Math.max(0, v / durum.toplam);
        y.bant.setAttribute("stroke-width", (pay > 0.0005 ? 2 + pay * 26 : 0).toFixed(2));
        y.g.classList.toggle("ak-bos", pay <= 0.0005);
        y.deger.textContent = nf.format(Math.round(v)) + " TL";
        var gorunen = pay * NOKTA * 1.8;
        for (var k = 0; k < NOKTA; k++) {
          var faz = ((t * HIZ / y.uzunluk) + k / NOKTA) % 1;
          var p = y.cizgi.getPointAtLength(faz * y.uzunluk);
          var c = y.noktalar[k];
          c.setAttribute("cx", p.x.toFixed(1)); c.setAttribute("cy", p.y.toFixed(1));
          /* k'inci yuva, payın taşıdığı nokta sayısına kadar görünür; sınırdaki yuva kesirli. */
          var op = Math.max(0, Math.min(1, gorunen - k));
          /* Kaynağa ve uca yaklaşırken söner: noktalar düğümden doğar, uçta biter. */
          var kenar = Math.min(1, faz / 0.06, (1 - faz) / 0.06);
          c.setAttribute("opacity", (op * kenar).toFixed(2));
        }
      });
      if (oran >= 1) durum.gecisBas = 0;
      if (durum.calisiyor) requestAnimationFrame(kare);
    }

    function baslat() {
      if (azalt || durum.calisiyor || !durum.gorunur) return;
      durum.calisiyor = true;
      requestAnimationFrame(kare);
    }
    function durdur() { durum.calisiyor = false; }

    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function (g) {
        durum.gorunur = g[0].isIntersecting;
        if (durum.gorunur) baslat(); else durdur();
      }).observe(kap);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) durdur(); else baslat();
    });

    var son = null;
    function ciz(yollar, toplam, ozet) {
      var imza = yollar.map(function (y) { return y.ad + "|" + y.sinif; }).join();
      var genislik = Math.max(320, Math.min(640, Math.round(kap.clientWidth || 560)));
      var yeniden = !svg || imza !== durum.imza || genislik !== W;
      var simdi = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (yeniden) {
        iskelet(yollar);
        durum.imza = imza;
        durum.baslangic = son ? yollar.map(function (y, i) { return son[i] !== undefined ? son[i] : y.deger; }) : yollar.map(function (y) { return y.deger; });
        if (!durum.t0) durum.t0 = simdi;
      } else {
        /* O anki görünen değerden yeni hedefe. */
        var e = durum.gecisBas ? yumusak(Math.min(1, (simdi - durum.gecisBas) / GECIS)) : 1;
        durum.baslangic = durum.hedef.map(function (h, i) { return durum.baslangic[i] + (h - durum.baslangic[i]) * e; });
      }
      durum.hedef = yollar.map(function (y) { return y.deger; });
      son = durum.hedef.slice();
      durum.toplam = toplam > 0 ? toplam : 1;
      if (durum.kaynakDeger) durum.kaynakDeger.textContent = nf.format(Math.round(toplam)) + " TL";
      durum.gecisBas = simdi;
      if (durum.baslik) durum.baslik.textContent = ozet || yollar.map(function (y) { return y.ad + " " + nf.format(Math.round(y.deger)) + " TL"; }).join(", ");
      if (azalt || !durum.calisiyor) kare(simdi + GECIS);
      baslat();
    }

    return { ciz: ciz };
  }

  /* Büyük rakam için sayaç: aynı taşmasız eğri, aynı süre. */
  function sayac(elm, hedef, bicim) {
    /* Yeni hedef gelince önceki döngü biter; başlangıç, ekranda o an görünen değer. */
    var bas = elm._sayacGorunen != null ? elm._sayacGorunen : hedef;
    var kimlik = (elm._sayacKimlik || 0) + 1;
    elm._sayacKimlik = kimlik;
    elm.setAttribute("data-deger", hedef);
    if (azalt || bas === hedef) { elm._sayacGorunen = hedef; elm.textContent = bicim(hedef); return; }
    var t0 = null;
    function adim(t) {
      if (elm._sayacKimlik !== kimlik) return;
      if (t0 === null) t0 = t;
      var x = Math.min(1, (t - t0) / GECIS);
      elm._sayacGorunen = bas + (hedef - bas) * yumusak(x);
      elm.textContent = bicim(elm._sayacGorunen);
      if (x < 1) requestAnimationFrame(adim);
    }
    requestAnimationFrame(adim);
    /* Kareler yavaşlasa da (arka plan sekmesi) son değer mutlaka yazılır. */
    setTimeout(function () {
      if (elm._sayacKimlik !== kimlik) return;
      elm._sayacKimlik++;
      elm._sayacGorunen = hedef;
      elm.textContent = bicim(hedef);
    }, GECIS + 60);
  }

  kok.Akis = { kur: kur, sayac: sayac };
})(typeof window !== "undefined" ? window : this);
