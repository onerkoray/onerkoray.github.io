/* Mali takvim — kişiye süzer, sıradakini sayar, satırları sitenin canlı verisiyle tamamlar.
   Liste statik HTML'dir; bu betik yoksa sayfa yine okunur. Süzgeç adreste yalnız # ile durur. */
(function () {
  "use strict";
  var M = window.MaliTakvim;
  if (!M) return;
  function $(id) { return document.getElementById(id); }
  function iki(n) { return (n < 10 ? "0" : "") + n; }

  var simdi = new Date();
  var bugun = simdi.getFullYear() + "-" + iki(simdi.getMonth() + 1) + "-" + iki(simdi.getDate());
  var tum = M.olaylar(), kaynak = { T: window.TufeSerisi, Z: window.EmekliZammiMotoru, KT: window.KiraTufe };
  var satirlar = Array.prototype.slice.call(document.querySelectorAll(".mt-olay"));
  var aylar = Array.prototype.slice.call(document.querySelectorAll(".mt-ay"));
  if (satirlar.length !== tum.length) return;

  var kodlar = M.KIMLER.map(function (k) { return k.kod; });
  var kim = kodlar.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : "";

  /* Satırların canlı satırı bir kez eklenir; veri açıklandıkça kendiliğinden değişir. */
  satirlar.forEach(function (li, i) {
    var c = M.canli(tum[i], kaynak);
    if (!c) return;
    var p = document.createElement("p");
    p.className = "mt-canli";
    p.textContent = c;
    li.querySelector(".mt-ad").insertAdjacentElement("afterend", p);
  });

  /* Süzgeç düğmeleri. */
  var kutu = $("mt-suzgec");
  [{ kod: "", ad: "Hepsi" }].concat(M.KIMLER).forEach(function (k) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "secim";
    b.textContent = k.ad;
    b.setAttribute("data-kim", k.kod);
    b.addEventListener("click", function () { kim = k.kod; uygula(); });
    kutu.appendChild(b);
  });

  /* Yıl şeridi: her ay bir sütun, her tarih türünün renginde bir çizgi. */
  var serit = $("mt-serit");
  M.serit(tum, bugun).forEach(function (a) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mt-serit-ay" + (a.simdi ? " mt-serit-simdi" : "") + (a.gecti ? " mt-serit-gecti" : "");
    b.setAttribute("data-ay", a.ay);
    var yigin = document.createElement("span");
    yigin.className = "mt-yigin";
    a.olaylar.forEach(function (o) {
      var c = document.createElement("i");
      c.className = "mt-cizgi mt-tur-" + o.tur;
      c.setAttribute("data-kim", o.kim.join(" "));
      c.setAttribute("data-tarih", o.tarih);
      yigin.appendChild(c);
    });
    var ad = document.createElement("span");
    ad.className = "mt-serit-ad";
    ad.textContent = a.kisa;
    b.appendChild(yigin);
    b.appendChild(ad);
    b.addEventListener("click", function () {
      var hedef = document.querySelector('.mt-ay[data-ay="' + a.ay + '"]');
      if (!hedef || hedef.hidden) return;
      var hizli = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      hedef.scrollIntoView({ behavior: hizli ? "auto" : "smooth", block: "start" });
    });
    serit.appendChild(b);
  });

  /* Son veri kartı süzgeçten bağımsızdır. */
  var son = M.sonVeri(kaynak);
  if (son) {
    $("mt-son-ay").textContent = son.ayAdi;
    $("mt-son-deger").textContent = son.yillik;
    $("mt-son-alt").textContent = son.alt;
  }

  function uygula() {
    var liste = M.filtre(tum, kim), gelecek = M.yaklasan(liste, bugun), ilk = gelecek[0] || null;

    satirlar.forEach(function (li, i) {
      var o = tum[i];
      li.hidden = o.tarih < bugun || (kim && o.kim.indexOf(kim) < 0);
      li.classList.toggle("mt-sirada", !!ilk && o === ilk);
    });
    aylar.forEach(function (a) { a.hidden = !a.querySelector(".mt-olay:not([hidden])"); });

    kutu.querySelectorAll(".secim").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-kim") === kim)); });

    serit.querySelectorAll(".mt-serit-ay").forEach(function (b) {
      var c = b.querySelectorAll(".mt-cizgi"), n = 0;
      c.forEach(function (x) {
        var uyar = x.getAttribute("data-tarih") >= bugun && (!kim || x.getAttribute("data-kim").split(" ").indexOf(kim) >= 0);
        x.classList.toggle("mt-sonuk", !uyar);
        if (uyar) n++;
      });
      var ay = M.ayAdi(b.getAttribute("data-ay"));
      b.disabled = n === 0 || b.classList.contains("mt-serit-gecti");
      b.setAttribute("aria-label", ay + ": " + n + " tarih");
    });

    if (ilk) {
      var g = M.gunFarki(bugun, ilk.tarih);
      $("mt-sayac").textContent = g === 0 ? "Bugün" : g === 1 ? "Yarın" : String(g);
      $("mt-sayac-birim").textContent = g > 1 ? "gün sonra" : "";
      $("mt-ilk-ad").textContent = ilk.ad;
      $("mt-ilk-tarih").textContent = M.tarihAdi(ilk.tarih);
      $("mt-ilk-etki").textContent = M.canli(ilk, kaynak) || ilk.etki;
      var bag = $("mt-ilk-bag");
      bag.textContent = "";
      ilk.araclar.slice(0, 1).forEach(function (a) {
        var l = document.createElement("a");
        l.href = "../" + a.yol;
        l.textContent = a.ad;
        bag.appendChild(l);
      });
    }

    $("mt-indir").textContent = "Takvime ekle (" + gelecek.length + " tarih)";
    $("mt-indir").disabled = !gelecek.length;
    var adres = location.pathname + (kim ? "#" + kim : "");
    try { history.replaceState(null, "", adres); } catch (e) { /* yoksay */ }
  }

  /* Dosya tarayıcıda kurulur, hiçbir yere gönderilmez. */
  $("mt-indir").addEventListener("click", function () {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([M.ics(M.yaklasan(M.filtre(tum, kim), bugun))], { type: "text/calendar;charset=utf-8" }));
    a.download = "mali-takvim.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  $("mt-panel").hidden = false;
  uygula();
})();
