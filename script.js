/* Koray Öner — kişisel sayfa · tema geçişi ve yıl */
(function () {
  "use strict";
  var KEY = "onerkoray.theme";
  var order = ["auto", "light", "dark"];
  var btn = document.getElementById("themeToggle");

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    if (btn) {
      var label = btn.querySelector(".theme-toggle-label");
      if (label) label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  }

  apply(localStorage.getItem(KEY) || "auto");

  if (btn) {
    btn.addEventListener("click", function () {
      var current = localStorage.getItem(KEY) || "auto";
      var next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(KEY, next);
      apply(next);
    });
  }

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Header'a kaydırma durumunda gölge ekle */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll ile ortaya çıkma (reveal) animasyonu */
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reveals.length) return;
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  reveals.forEach(function (el) { io.observe(el); });
})();
