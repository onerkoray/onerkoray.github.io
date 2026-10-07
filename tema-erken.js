/* Seçilen tema ve renk, sayfa ilk kez boyanmadan uygulanır.
 *
 * script.js ertelenmiş (defer) yükleniyor; tercihi ancak sayfa çizildikten
 * sonra okuyabiliyordu. Koyu temayı seçen okur her sayfa geçişinde önce açık
 * temayı, sonra koyuyu görüyordu. CSP satır içi betiğe izin vermediği için
 * bu iş ayrı ve bilerek ertelenmeyen küçük bir dosyada, <head> içinde.
 * Düğme ve palet mantığı script.js'te kalıyor; burası yalnızca okur. */
(function () {
  try {
    var kok = document.documentElement;
    var tema = localStorage.getItem("onerkoray.theme");
    if (tema === "light" || tema === "dark" || tema === "auto") kok.setAttribute("data-theme", tema);
    var renk = localStorage.getItem("onerkoray.accent");
    /* Eski paletten kalan seçim ilk boyamada da en yakın tona gider. */
    renk = { mavi: "lacivert", gul: "bordo" }[renk] || renk;
    if (renk === "lacivert" || renk === "bordo" || renk === "grafit") kok.setAttribute("data-accent", renk);
  } catch (e) { /* depolama kapalıysa varsayılan tema kalır */ }
})();
