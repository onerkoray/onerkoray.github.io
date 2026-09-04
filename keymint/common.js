/* KeyMint — paylaşılan: tema geçişi ve yıl */
(function () {
  "use strict";
  var KEY = "onerkoray.theme", order = ["auto", "light", "dark"];
  var btn = document.getElementById("themeToggle");
  function apply(m) {
    document.documentElement.setAttribute("data-theme", m);
    var l = btn && btn.querySelector(".theme-toggle-label");
    if (l) l.textContent = m.charAt(0).toUpperCase() + m.slice(1);
  }
  apply(localStorage.getItem(KEY) || "auto");
  if (btn) btn.addEventListener("click", function () {
    var cur = localStorage.getItem(KEY) || "auto";
    var next = order[(order.indexOf(cur) + 1) % order.length];
    localStorage.setItem(KEY, next); apply(next);
  });
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
