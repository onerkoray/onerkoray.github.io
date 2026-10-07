/* Ana sayfa katmanı — başlık küçülmesi ve teknoloji paneli (bağımlılıksız). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- Yardımcılar ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  /* Saat, selamlama, sonraki tatil ve dünya saatleri şeridi 7 Ekim 2026'da
     kaldırıldı: finans bilgisi taşımıyordu, emojili selam sitenin diline
     uymuyordu ve elle yazılmış tatil listesi 2027'de bayatlayacaktı. */
  var heroActions = $(".hero-actions");
  if (!heroActions) return; // yalnızca ana sayfa

  /* ---------- Header: küçülme ---------- */
  var header = $(".site-header");
  if (header) {
    var lastShrunk = false;
    window.addEventListener("scroll", function () {
      var s = window.scrollY > 60;
      if (s !== lastShrunk) { header.classList.toggle("is-shrunk", s); lastShrunk = s; }
    }, { passive: true });
  }


  /* Ana sayfaya özgü komut paleti (yalnız araç adlarında arıyordu) 7 Ekim
     2026'da kalktı: Ctrl/Cmd+K ve "/" artık her sayfada site geneli aramayı
     açıyor (arama.js). Paletin "son kullanılanlar" kaydı da yalnız onu
     besliyordu; o da silindi. */
})();

/* ---- Hero teknoloji paneli: giriş animasyonu + tooltip ---- */
(function () {
  var panel = document.querySelector(".tech-panel");
  if (!panel) return;
  var slices = panel.querySelectorAll(".lang-bar span");
  var counts = panel.querySelectorAll(".lang-legend b[data-count]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fill() {
    slices.forEach(function (s) { s.style.flexGrow = s.getAttribute("data-pct"); });
  }
  function runCounts() {
    counts.forEach(function (b) {
      var target = parseInt(b.getAttribute("data-count"), 10) || 0;
      if (reduce) { b.textContent = target + "%"; return; }
      var t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 600, 1);
        p = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * p) + "%";
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    fill();
    runCounts();
  }
  if (reduce || !("IntersectionObserver" in window)) {
    start();
  } else {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { start(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(panel);
  }

  /* Tooltip */
  var wrap = panel.querySelector(".lang-wrap");
  var tip = document.createElement("div");
  tip.className = "lang-tip";
  tip.setAttribute("aria-hidden", "true");
  wrap.appendChild(tip);
  var active = null;

  function showTip(s) {
    if (active && active !== s) active.classList.remove("is-active");
    active = s;
    s.classList.add("is-active");
    tip.textContent = s.getAttribute("data-lang") + " · %" + s.getAttribute("data-pct");
    tip.style.left = (s.offsetLeft + s.offsetWidth / 2) + "px";
    tip.classList.add("show");
  }
  function hideTip() {
    if (active) active.classList.remove("is-active");
    active = null;
    tip.classList.remove("show");
  }
  slices.forEach(function (s) {
    s.setAttribute("tabindex", "0");
    s.setAttribute("aria-label", s.getAttribute("data-lang") + " yüzde " + s.getAttribute("data-pct"));
    s.addEventListener("mouseenter", function () { showTip(s); });
    s.addEventListener("mouseleave", hideTip);
    s.addEventListener("focus", function () { showTip(s); });
    s.addEventListener("blur", hideTip);
    s.addEventListener("click", function (e) {
      e.stopPropagation();
      if (active === s) hideTip(); else showTip(s);
    });
  });
  document.addEventListener("click", function (e) {
    if (active && !wrap.contains(e.target)) hideTip();
  });
})();
