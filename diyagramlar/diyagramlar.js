/*!
 * Diyagramlar sayfası — tarayıcı katmanı. Sayfa bu betik olmadan da tamdır:
 * üreteç şekilleri, metinleri ve tabloları statik yazar. Burada üç şey olur:
 *   1. Şekiller kutu genişliğinde yeniden çizilir (yazı her ekranda aynı boyda).
 *   2. Maaş seçici üç maaş şeklini, metinleri ve tabloları yeniden kurar.
 *   3. İpucu: data-ipucu taşıyan işaretin üstünde değerleri gösterir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function () {
  "use strict";
  var H = window.DiyagramHesap, C = window.DiyagramCizim;
  if (!H || !C) return;

  var kat = H.VARSAYILAN_KAT;
  var kredi = H.kredi();
  var egri = H.egri();
  var ucret = H.ucret(kat);

  function kap(ad) { return document.querySelector('[data-kap="' + ad + '"] .dg-tuval'); }
  function genislik(el) {
    var st = getComputedStyle(el);
    return Math.max(300, Math.round(el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)));
  }
  function yerlestir(ad, fn) {
    var el = kap(ad);
    if (!el) return;
    var svg = el.querySelector("svg");
    var yeni = fn(genislik(el));
    var gecici = document.createElement("div");
    gecici.innerHTML = yeni.svg;
    if (svg) el.replaceChild(gecici.firstChild, svg); else el.insertBefore(gecici.firstChild, el.firstChild);
  }
  function etiket(ad) {
    var svg = document.querySelector('[data-diyagram="' + ad + '"]');
    return svg ? svg.getAttribute("aria-label") : "";
  }

  function cizUcret() {
    var secili = H.ucretNoktasi(kat);
    yerlestir("sankey", function (w) { return C.sankey({ genislik: w, veri: ucret, etiket: sankeyEtiket() }); });
    yerlestir("aylik", function (w) { return C.aylik({ genislik: w, veri: ucret, etiket: aylikEtiket() }); });
    yerlestir("egri", function (w) { return C.egri({ genislik: w, veri: egri, secili: secili, etiket: etiket("egri") }); });
  }
  function cizHepsi() {
    cizUcret();
    yerlestir("kredi", function (w) { return C.kredi({ genislik: w, veri: kredi, etiket: etiket("kredi") }); });
  }
  function sankeyEtiket() {
    return "Aylık brüt " + C.tl(ucret.brutAy) + ": işverenin 100 lirasından " + C.sayi(ucret.netPay * 100, 1) +
      " lira çalışana, " + C.sayi(ucret.vergiPay * 100, 1) + " lira vergiye, " + C.sayi(ucret.primPay * 100, 1) + " lira SGK primine.";
  }
  function aylikEtiket() {
    return "Aylık brüt " + C.tl(ucret.brutAy) + " ile " + ucret.yil + " yılında ay ay net ücret, vergi ve prim.";
  }

  function metinleriYaz() {
    var m = C.ucretMetin(ucret, H.ucretNoktasi(kat));
    Object.keys(m).forEach(function (k) {
      document.querySelectorAll('[data-s="' + k + '"]').forEach(function (el) { el.textContent = m[k]; });
    });
    document.querySelectorAll("[data-pay]").forEach(function (el) {
      var v = { net: ucret.netPay, vergi: ucret.vergiPay, prim: ucret.primPay }[el.getAttribute("data-pay")];
      el.style.width = (v * 100).toFixed(2) + "%";
    });
    var tS = document.querySelector('[data-tablo="sankey"]'), tA = document.querySelector('[data-tablo="aylik"]');
    if (tS) tS.innerHTML = C.tabloSankey(ucret);
    if (tA) tA.innerHTML = C.tabloAylik(ucret);
  }

  // ---- maaş seçici --------------------------------------------------------
  document.querySelectorAll("[data-kat]").forEach(function (b) {
    b.addEventListener("click", function () {
      kat = +b.getAttribute("data-kat");
      document.querySelectorAll("[data-kat]").forEach(function (x) {
        x.setAttribute("aria-pressed", String(+x.getAttribute("data-kat") === kat));
      });
      ucret = H.ucret(kat);
      metinleriYaz();
      cizUcret();
    });
  });

  // ---- ipucu --------------------------------------------------------------
  var ipucu = document.createElement("div");
  ipucu.className = "dg-ipucu";
  ipucu.hidden = true;
  ipucu.setAttribute("role", "status");
  var etkin = null;

  function goster(el, tuval, e) {
    var ham = el.getAttribute("data-ipucu").split("||");
    var html = "<b>" + C.kacis(ham[0]) + "</b>";
    ham.slice(1).forEach(function (s) {
      var p = s.split("::");
      html += '<span><i class="' + C.kacis(p[2] || "") + '">' + C.kacis(p[0]) + "</i>" + C.kacis(p[1]) + "</span>";
    });
    ipucu.innerHTML = html;
    if (ipucu.parentNode !== tuval) tuval.appendChild(ipucu);
    ipucu.hidden = false;
    var r = tuval.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    // kenara taşmasın
    var yarim = ipucu.offsetWidth / 2;
    x = Math.max(yarim + 4, Math.min(r.width - yarim - 4, x));
    ipucu.style.left = x + "px";
    ipucu.style.top = Math.max(ipucu.offsetHeight + 18, y) + "px";
    var hedef = el.closest(".dg-sutun-g") || el;
    if (etkin && etkin !== hedef) etkin.classList.remove("dg-etkin");
    hedef.classList.add("dg-etkin");
    etkin = hedef;
    imlec(el, tuval);
  }
  function gizle() {
    ipucu.hidden = true;
    if (etkin) etkin.classList.remove("dg-etkin");
    etkin = null;
    document.querySelectorAll(".dg-imlec").forEach(function (l) { l.remove(); });
  }
  // eğride dikey imleç
  function imlec(el, tuval) {
    var x = el.getAttribute("data-x");
    var svg = tuval.querySelector("svg");
    var eski = svg.querySelector(".dg-imlec");
    if (x == null) { if (eski) eski.remove(); return; }
    if (!eski) {
      eski = document.createElementNS("http://www.w3.org/2000/svg", "line");
      eski.setAttribute("class", "dg-imlec");
      svg.appendChild(eski);
    }
    eski.setAttribute("x1", x); eski.setAttribute("x2", x);
    eski.setAttribute("y1", el.getAttribute("y"));
    eski.setAttribute("y2", +el.getAttribute("y") + +el.getAttribute("height"));
  }

  document.querySelectorAll(".dg-tuval").forEach(function (tuval) {
    tuval.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest("[data-ipucu]");
      if (el && tuval.contains(el)) goster(el, tuval, e); else gizle();
    });
    tuval.addEventListener("pointerleave", gizle);
  });

  // ---- genişlik -----------------------------------------------------------
  var sonGen = 0, bekle = null;
  function yeniden() {
    var el = kap("sankey");
    if (!el) return;
    var g = genislik(el);
    if (g === sonGen) return;
    sonGen = g;
    gizle();
    cizHepsi();
  }
  window.addEventListener("resize", function () { clearTimeout(bekle); bekle = setTimeout(yeniden, 120); });
  yeniden();
})();
