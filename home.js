/* Grafik kartları: çizgi CSS ile çizilirken banttaki kat ×1'den sayar.
   Hareket azaltma tercihinde ya da JS yoksa sayı olduğu gibi durur. */
(function () {
  'use strict';
  var kartlar = document.querySelectorAll('.project-card--grafik');
  if (!kartlar.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function say(el) {
    var metin = el.getAttribute('data-deger') || el.textContent;
    var on = metin.charAt(0) === '×' ? '×' : '';
    var sayi = metin.slice(on.length), hedef = parseFloat(sayi.replace(/\./g, '').replace(',', '.'));
    var ondalik = (sayi.split(',')[1] || '').length;
    if (!isFinite(hedef)) return;
    function yaz(v) {
      var p = v.toFixed(ondalik).split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      el.textContent = on + p.join(',');
    }
    var bas = null;
    function kare(z) {
      if (bas === null) bas = z;
      var t = Math.min(1, (z - bas - 200) / 1900);
      if (t < 0) { window.requestAnimationFrame(kare); return; }
      var e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Çizgi logaritmik: sayaç da üstel ilerler, nokta ile aynı hızda büyür.
      yaz(Math.exp(Math.log(hedef) * e));
      if (t < 1) window.requestAnimationFrame(kare); else el.textContent = metin;
    }
    yaz(1);
    window.requestAnimationFrame(kare);
  }
  var gozcu = new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      if (!g.isIntersecting) return;
      gozcu.unobserve(g.target);
      var el = g.target.querySelector('.kart-iz-deger');
      if (el) say(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  Array.prototype.forEach.call(kartlar, function (k) { gozcu.observe(k); });
})();

/* Sayımlar sabit yazılmaz; ana sayfanın mevcut araç kartlarından türetilir. */
(function () {
  'use strict';
  var cards = Array.from(document.querySelectorAll('.project-card[data-tags]'));
  document.querySelectorAll('.directory-panel .chip[data-filter]').forEach(function (chip) {
    var category = chip.getAttribute('data-filter');
    var count = cards.filter(function (card) { return category === 'hepsi' || card.getAttribute('data-cat') === category; }).length;
    var badge = document.createElement('span');
    badge.className = 'chip-count';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = count;
    chip.appendChild(badge);
  });
})();

/* Gündem şeridi: geçen tarihleri gizler, sıradaki üç tarihe kalan günü yazar (tools/gundem.js). */
(function () {
  "use strict";
  var kap = document.getElementById("gn-tarih");
  if (!kap) return;
  function iki(n) { return (n < 10 ? "0" : "") + n; }
  var d = new Date(), bugun = d.getFullYear() + "-" + iki(d.getMonth() + 1) + "-" + iki(d.getDate());
  var gelen = Array.prototype.filter.call(kap.querySelectorAll("li[data-tarih]"), function (l) {
    return l.getAttribute("data-tarih") >= bugun;
  }).slice(0, 4);
  gelen.forEach(function (l) {
    var g = Math.round((Date.parse(l.getAttribute("data-tarih")) - Date.parse(bugun)) / 864e5);
    l.querySelector(".gn-gun").textContent = g === 0 ? "Bugün" : g === 1 ? "Yarın" : g + " gün";
    l.hidden = false;
  });
  if (gelen.length) kap.classList.add("gn-hazir");
})();

/* Net maaş aleti: brüt değiştikçe bordro motoru yılı yeniden hesaplar; çizgi
   netin 12 aydaki seyrini, şerit brütün nereye gittiğini gösterir. Hesap
   tarayıcıda yapılır, hiçbir yere gönderilmez. */
(function () {
  "use strict";
  var B = window.Bordro, kok = document.getElementById("net-alet");
  if (!B || !kok) return;
  function $(id) { return document.getElementById(id); }
  var yil = B.sonYil(), asgari = B.parametre(yil).donemler[0].asgariBrut;
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(v) { return nf.format(Math.round(v)); }
  var NS = "http://www.w3.org/2000/svg", cizim = $("na-cizim"), girdi = $("na-brut"), kay = $("na-kaydirac");
  var W = 360, H = 132, SOL = 8, SAG = 352, UST = 22, ALT = 104, sonuc = null, etkin = -1;
  kay.min = String(Math.ceil(asgari / 500) * 500);
  $("na-yil").textContent = "· " + yil;

  function el(ad, oz) {
    var e = document.createElementNS(NS, ad);
    Object.keys(oz || {}).forEach(function (k) { e.setAttribute(k, oz[k]); });
    cizim.appendChild(e);
    return e;
  }
  function x(i) { return SOL + (SAG - SOL) * (i + 0.5) / 12; }

  /* İskelet bir kez kurulur; sonraki hesaplarda yalnız konumlar değişir. */
  el("path", { "class": "na-taban", d: "M" + SOL + " " + (ALT + 8) + " H" + SAG });
  var cizgi = el("path", { "class": "na-cizgi" }), imlec = el("path", { "class": "na-imlec" });
  var noktalar = [], adlar = [];
  for (var i = 0; i < 12; i++) {
    noktalar.push(el("circle", { "class": "na-nokta-ay", r: 3.2, cx: x(i) }));
    var t = el("text", { x: x(i), y: H - 4, "text-anchor": "middle" });
    t.textContent = B.AY_ADLARI[i].charAt(0);
    adlar.push(t);
  }
  var vurgu = el("circle", { "class": "na-vurgu", r: 5 });
  var ilkYazi = el("text", { "class": "na-deger", x: SOL, y: 12 }), sonYazi = el("text", { "class": "na-deger", x: SAG, y: 12, "text-anchor": "end" });
  for (var j = 0; j < 12; j++) (function (ay) {
    var b = el("rect", { "class": "na-bolge", x: SOL + (SAG - SOL) * ay / 12, y: 0, width: (SAG - SOL) / 12, height: H, tabindex: "0", role: "img" });
    function ac() { etkin = ay; oku(); }
    function kapat() { etkin = -1; oku(); }
    b.addEventListener("pointerenter", ac); b.addEventListener("focus", ac);
    b.addEventListener("pointerleave", kapat); b.addEventListener("blur", kapat);
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var h = cizim.querySelectorAll(".na-bolge")[Math.max(0, Math.min(11, ay + d))];
      if (h) h.focus();
    });
  })(j);

  function oku() {
    var A = sonuc.aylar, okuma = $("na-okuma");
    cizim.classList.toggle("na-etkin", etkin >= 0);
    if (etkin >= 0) {
      var a = A[etkin];
      imlec.setAttribute("d", "M" + x(etkin) + " " + UST + " V" + (ALT + 8));
      vurgu.setAttribute("cx", x(etkin)); vurgu.setAttribute("cy", noktalar[etkin].getAttribute("cy"));
      okuma.innerHTML = "<strong>" + a.ayAdi + ": " + tl(a.net) + " TL net.</strong> Gelir vergisi " + tl(a.gelirVergisi) + " TL, dilim %" + Math.round(a.dilim * 100) +
        (a.dilimGecisi ? ". Bu ay üst dilime geçiliyor." : ".");
      return;
    }
    var fark = A[0].net - A[11].net, gecis = A.filter(function (m) { return m.dilimGecisi; });
    okuma.innerHTML = fark > 1
      ? "Aralık'ta <strong>" + tl(A[11].net) + " TL</strong>: Ocak'tan " + tl(fark) + " TL az. Brüt aynı kalsa da vergi dilimi yıl içinde yükselir" +
        (gecis.length ? "; ilk geçiş " + gecis[0].ayAdi + "." : ".")
      : "Bu ücrette net maaş yıl boyunca aynı kalıyor: asgari ücrete isabet eden kısım vergiden istisna.";
  }

  function hesapla(brut) {
    var b = Math.max(asgari, Math.min(2000000, brut));
    sonuc = B.hesaplaYil(b, yil);
    var A = sonuc.aylar, T = sonuc.toplam, net = A.map(function (a) { return a.net; });
    var enAz = Math.min.apply(null, net), enCok = Math.max.apply(null, net), aralik = Math.max(enCok - enAz, enCok * 0.02);
    function y(v) { return ALT - (v - enAz) / aralik * (ALT - UST); }
    var d = "";
    A.forEach(function (a, i) {
      var yy = y(a.net).toFixed(1), x0 = (SOL + (SAG - SOL) * i / 12).toFixed(1), x1 = (SOL + (SAG - SOL) * (i + 1) / 12).toFixed(1);
      d += (i ? " L" : "M") + x0 + " " + yy + " L" + x1 + " " + yy;
      noktalar[i].setAttribute("cy", yy);
      noktalar[i].setAttribute("class", "na-nokta-ay" + (a.dilimGecisi ? " na-gecis" : ""));
    });
    cizgi.setAttribute("d", d);
    ilkYazi.textContent = "Ocak " + tl(A[0].net);
    sonYazi.textContent = "Aralık " + tl(A[11].net);
    $("na-net").textContent = tl(A[0].net);
    $("na-yillik").textContent = tl(T.net) + " TL";
    $("na-sgk").textContent = tl(T.sgk + T.issizlik) + " TL";
    $("na-vergi").textContent = tl(T.gelirVergisi + T.damga) + " TL";
    var p = $("na-serit").children;
    p[0].style.flexGrow = String(T.net); p[1].style.flexGrow = String(T.sgk + T.issizlik); p[2].style.flexGrow = String(T.gelirVergisi + T.damga);
    cizim.setAttribute("aria-label", "Net maaş Ocak'ta " + tl(A[0].net) + " TL, Aralık'ta " + tl(A[11].net) + " TL.");
    oku();
  }

  function sayi(s) { var n = Number(String(s).replace(/\./g, "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; }
  girdi.addEventListener("input", function () {
    var v = sayi(girdi.value);
    if (!(v > 0)) return;
    kay.value = String(Math.min(+kay.max, Math.max(+kay.min, v)));
    hesapla(v);
  });
  girdi.addEventListener("blur", function () { var v = sayi(girdi.value); girdi.value = tl(v > 0 ? Math.max(asgari, v) : 60000); if (!(v > 0)) hesapla(60000); });
  kay.addEventListener("input", function () { girdi.value = tl(+kay.value); hesapla(+kay.value); });
  hesapla(sayi(girdi.value) || 60000);
})();

/* Gündem grafiği: aya gelince o ayın yıllık enflasyonu okunur (tools/gundem.js çizer). */
(function () {
  "use strict";
  var svg = document.getElementById("gn-cizim"), okuma = document.getElementById("gn-okuma");
  if (!svg || !okuma) return;
  var ilk = okuma.innerHTML, imlec = svg.querySelector(".gn-imlec"), vurgu = svg.querySelector(".gn-vurgu");
  svg.querySelectorAll(".gn-bolge").forEach(function (b) {
    function ac() {
      svg.classList.add("gn-etkin");
      imlec.setAttribute("d", "M" + b.getAttribute("data-x") + " 8 V" + svg.getAttribute("data-alt"));
      vurgu.setAttribute("cx", b.getAttribute("data-x")); vurgu.setAttribute("cy", b.getAttribute("data-y"));
      okuma.innerHTML = "<strong>" + b.getAttribute("data-ad") + ": " + b.getAttribute("data-deger") + "</strong> yıllık, aylık " + b.getAttribute("data-aylik");
    }
    function kapat() { svg.classList.remove("gn-etkin"); okuma.innerHTML = ilk; }
    b.addEventListener("pointerenter", ac); b.addEventListener("pointerleave", kapat);
  });
})();
