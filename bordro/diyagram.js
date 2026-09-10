/* Animation is decorative; the generated map works without this script. */
(function () {
  "use strict";
  var map = document.querySelector(".bm-map");
  if (!map) return;
  var button = map.querySelector(".bm-motion");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var paused = false;
  var inView = false;

  function update() {
    map.dataset.motion = !paused && !reduced.matches && inView && !document.hidden ? "on" : "off";
    button.hidden = reduced.matches;
    button.textContent = paused ? "Animasyonu başlat" : "Animasyonu durdur";
  }
  button.addEventListener("click", function () { paused = !paused; update(); });
  document.addEventListener("visibilitychange", update);
  reduced.addEventListener("change", update);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      update();
    }).observe(map);
  } else {
    inView = true;
  }
  update();
})();
