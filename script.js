/* Öner Koray — kişisel sayfa · tema geçişi ve yıl */
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
})();
