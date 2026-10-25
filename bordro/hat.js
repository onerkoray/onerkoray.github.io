/* Bordro Motoru: prizma ve hat etkileşimi.
 * Prizma: bir araca gelince (fare ya da klavye) o aracın ışını vurgulanır.
 * Hat: okunan adım şeritte etkin olur; öncekiler tamamlandı işaretini alır.
 * Betik yoksa içerik eksiksiz okunur; burada yalnız durum sınıfları var.
 * Lisans: MIT — Koray Öner */
(function () {
  "use strict";

  var cikis = document.querySelector(".tk-cikis");
  if (cikis) {
    var vurgula = function (i, acik) {
      document.querySelectorAll('.tk-svg [data-i="' + i + '"]').forEach(function (el) {
        el.classList.toggle("on", acik);
      });
    };
    cikis.querySelectorAll("a[data-i]").forEach(function (a) {
      var i = a.getAttribute("data-i");
      a.addEventListener("mouseenter", function () { vurgula(i, true); });
      a.addEventListener("mouseleave", function () { vurgula(i, false); });
      a.addEventListener("focus", function () { vurgula(i, true); });
      a.addEventListener("blur", function () { vurgula(i, false); });
    });
  }

  /* Tarife bölümü aşağıdan görüş alanına girerse çizim bir kez kurulur.
     İlk ekranda duruyorsa ya da hareket azaltılmışsa hiç gizlenmez. */
  var sahne = document.querySelector(".tk-sahne");
  var azalt = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (sahne && !azalt && "IntersectionObserver" in window &&
      sahne.getBoundingClientRect().top > window.innerHeight) {
    sahne.classList.add("tk-hazir");
    var izle = new IntersectionObserver(function (g) {
      if (!g[0].isIntersecting) return;
      sahne.classList.add("tk-oynat");
      izle.disconnect();
    }, { threshold: 0.35 });
    izle.observe(sahne);
  }

  var bolum = document.querySelector(".bh-bolum");
  if (!bolum || !("IntersectionObserver" in window)) return;
  var dugumler = bolum.querySelectorAll(".bh-dugum");
  var adimlar = bolum.querySelectorAll(".bh-adim");
  var cubuk = bolum.querySelector(".bh-ilerleme span");
  var n = dugumler.length;

  function etkin(k) {
    dugumler.forEach(function (d, i) {
      d.classList.toggle("bitti", i < k);
      d.classList.toggle("aktif", i === k);
      d.classList.toggle("bekliyor", i > k);
    });
    adimlar.forEach(function (a, i) { a.classList.toggle("aktif", i === k); });
    if (cubuk) cubuk.style.transform = "scaleX(" + (k + 1) / n + ")";
  }

  bolum.classList.add("bh-js");
  etkin(0);
  var gozcu = new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      if (g.isIntersecting) etkin(Number(g.target.getAttribute("data-adim")));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  adimlar.forEach(function (a) { gozcu.observe(a); });
})();
