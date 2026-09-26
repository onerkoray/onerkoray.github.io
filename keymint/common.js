/* KeyMint — paylaşılan: yıl.
   Tema düğmesi burada da dinleniyordu; alt sayfalar sitenin script.js'ini de
   yüklediği için tek tıklama temayı iki adım ilerletiyordu. Tema artık
   yalnızca script.js'te. */
(function () {
  "use strict";
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
