/* Sigortalılık statüleri — arayüz.
 * Statü bulucu: seçimler değiştikçe statu.js'in bul() kuralı çalışır; sonuç
 * kartı statüyü, gerekçeyi ve dayanağı gösterir. Girdi cihazdan çıkmaz.
 * Dönem şeridi: bölüm aşağıdan görününce bir kez kurulur; hareket
 * azaltılmışsa ya da betik yoksa çizim baştan tam durur.
 * Lisans: MIT — Koray Öner */
(function () {
  "use strict";
  var T = window.Statuler;
  var form = document.getElementById("sb-form");
  if (!T || !form) return;

  function $(id) { return document.getElementById(id); }
  function secili(ad) {
    return Array.prototype.map.call(form.querySelectorAll('input[name="' + ad + '"]:checked'), function (x) { return x.value; });
  }

  function guncelle() {
    var faaliyet = secili("faaliyet");
    var kamuVar = faaliyet.indexOf("kamu") >= 0;
    $("sb-kamu").hidden = !kamuVar;
    $("sb-istege").hidden = faaliyet.length > 0;
    var r = T.bul({
      faaliyet: faaliyet, kamu: secili("kamu")[0],
      yas18: $("sb-yas18").checked, ikamet: $("sb-ikamet").checked, aylikAliyor: $("sb-aylik").checked
    });
    var st = r.statu ? T.statuler[r.statu] : null;
    $("sb-sonuc").classList.toggle("sb-sonuc--yok", !st);
    $("sb-statu").textContent = st ? st.ad : "Yok";
    $("sb-ad").textContent = st ? st.baslik : "Bu şartlarla isteğe bağlı sigortalı olunamaz";
    $("sb-gerekce").innerHTML = "";
    r.gerekce.forEach(function (g) { var li = document.createElement("li"); li.textContent = g; $("sb-gerekce").appendChild(li); });
    $("sb-dayanak").textContent = r.dayanak.join("; ");
    var git = $("sb-git").querySelector("a");
    $("sb-git").hidden = !st;
    if (st) git.setAttribute("href", "#s-" + r.statu);
  }

  form.addEventListener("change", guncelle);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  guncelle();

  var figur = document.querySelector(".ss-figur");
  var azalt = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (figur && !azalt && "IntersectionObserver" in window && figur.getBoundingClientRect().top > window.innerHeight) {
    figur.classList.add("ss-hazir");
    var izle = new IntersectionObserver(function (g) {
      if (!g[0].isIntersecting) return;
      figur.classList.add("ss-oynat");
      izle.disconnect();
    }, { threshold: 0.4 });
    izle.observe(figur);
  }
})();
