/* Mali takvim — geçmiş satırları gizler, sıradakini işaretler, takvim dosyasını kurar. */
(function () {
  "use strict";
  var M = window.MaliTakvim;
  if (!M) return;
  var bugun = new Date().toISOString().slice(0, 10), sirada = false;

  document.querySelectorAll(".mt-olay").forEach(function (li) {
    var t = li.getAttribute("data-tarih");
    if (t < bugun) { li.hidden = true; return; }
    if (!sirada) { li.classList.add("mt-sirada"); sirada = true; }
  });
  document.querySelectorAll(".mt-ay").forEach(function (a) {
    a.hidden = !a.querySelector(".mt-olay:not([hidden])");
  });

  /* Dosya tarayıcıda kurulur, hiçbir yere gönderilmez. */
  document.getElementById("mt-indir").addEventListener("click", function () {
    var gelecek = M.olaylar().filter(function (o) { return o.tarih >= bugun; });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([M.ics(gelecek)], { type: "text/calendar;charset=utf-8" }));
    a.download = "mali-takvim.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });
})();
