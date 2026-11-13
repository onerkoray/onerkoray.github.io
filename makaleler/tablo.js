/* Makale tabloları: rakam sütunları ve geniş tablolar.
   editoryal.css makale tablolarını tek dile bağlıyor. İki şey işaretlemede
   yazmıyor ve buradan okunuyor (109 tablonun çoğunu üreteçler yazıyor, 15
   ayrı sınıfla; HTML'e dokunmak bir sonraki üretimde geri alınırdı):

   1. RAKAM SÜTUNU. Bir sütunun dolu hücrelerinin en az %60'ı sayıysa
      (68.000,00 · %15 · −6.935,73 TL · 3 ay) başlığı ve hücreleri .sayi
      alır: sağa yaslı, tablo rakamlı. İstisnalar: yalnızca yıl içeren
      sütun (2020, 2021…) ve satır başlığı (th) sütunu — ikisi de etikettir.
      Birleştirilmiş hücre içeren satırlar sütun eşlemesini bozacağı için
      sayılmaz ve işaretlenmez.
   2. GENİŞ TABLO. Tablo metin sütununda kalır; sığmıyorsa kapsayıcısı
      .tablo-genis alır ve sayfa genişliğine açılır. Hepsini genişletmek
      dar tabloları sütundan koparıyordu, hiçbirini genişletmemek 6 sütunlu
      bordro tablosunun son sütununu kaydırmanın arkasına saklıyordu.

   Betik çalışmazsa tablo sola yaslı ve kaydırılabilir, ama eksiksizdir. */
(function () {
  "use strict";
  var main = document.querySelector("main");
  if (!main || !main.querySelector(".ed-article-hero")) return;

  var SAYI = /^[+−\-±≈~]?\s*[%₺$€]?\s*[+−\-]?\d[\d.,\s]*\s*(TL|%|puan|pp|ay|gün|yıl|kat|x|×)?\s*[▲▼↑↓●•]?$/i;
  var BOS = /^[—–\-·]?$/;
  var YIL = /^(19|20)\d\d$/;

  function duz(satir) {
    for (var i = 0; i < satir.cells.length; i++) if (satir.cells[i].colSpan > 1) return false;
    return true;
  }
  function satirlar(bolumler) {
    var out = [];
    for (var b = 0; b < bolumler.length; b++) {
      for (var r = 0; r < bolumler[b].rows.length; r++) {
        if (duz(bolumler[b].rows[r])) out.push(bolumler[b].rows[r]);
      }
    }
    return out;
  }

  var tablolar = Array.prototype.slice.call(main.querySelectorAll("table"));

  tablolar.forEach(function (t) {
    var govde = satirlar(t.tBodies);
    if (!govde.length) return;
    var sutun = 0;
    govde.forEach(function (s) { sutun = Math.max(sutun, s.cells.length); });
    var ek = satirlar(t.tHead ? [t.tHead] : []).concat(satirlar(t.tFoot ? [t.tFoot] : []));
    for (var c = 0; c < sutun; c++) {
      var etiket = govde.every(function (s) { return !s.cells[c] || s.cells[c].tagName === "TH"; });
      if (etiket) continue;
      var dolu = 0, sayi = 0, yil = 0;
      govde.forEach(function (s) {
        var h = s.cells[c];
        if (!h) return;
        var m = h.textContent.replace(/\s+/g, " ").trim();
        if (BOS.test(m)) return;
        dolu++;
        if (SAYI.test(m)) sayi++;
        if (YIL.test(m)) yil++;
      });
      if (!dolu || sayi / dolu < 0.6 || yil === sayi) continue;
      govde.concat(ek).forEach(function (s) { if (s.cells[c]) s.cells[c].classList.add("sayi"); });
    }
  });

  /* Kapsayıcısız tablo kaydırılamaz: bir kaydırma kabına alınır. */
  var kaplar = tablolar.map(function (t) {
    var k = t.parentElement;
    if (k && /(^|\s)(table-scroll|table-wrap)(\s|$)/.test(k.className)) return k;
    var yeni = document.createElement("div");
    yeni.className = "table-scroll";
    t.parentNode.insertBefore(yeni, t);
    yeni.appendChild(t);
    return yeni;
  });

  function olc() {
    kaplar.forEach(function (k) {
      k.classList.remove("tablo-genis");
      var t = k.querySelector("table");
      if (t && t.scrollWidth > k.clientWidth + 1) k.classList.add("tablo-genis");
    });
  }
  olc();
  var bekle;
  window.addEventListener("resize", function () {
    clearTimeout(bekle);
    bekle = setTimeout(olc, 150);
  });
})();

/* Okuma katmanı: üstte ilerleme çizgisi, geniş ekranda kenarda "Bu yazıda"
   dizini. Dizin sayfadaki h2[id] başlıklarından kurulur; okunan bölüm
   işaretlenir. Geniş tablo ya da grafik dizinin hizasına gelince dizin
   kenara çekilir, içeriğin üstüne binmez. */
(function () {
  "use strict";
  var govde = document.querySelector(".ed-body");
  if (!govde) return;
  var basliklar = Array.prototype.filter.call(govde.querySelectorAll("h2[id]"), function (h) { return h.textContent.trim(); });

  var cizgi = document.createElement("div");
  cizgi.className = "ed-ilerleme";
  cizgi.setAttribute("aria-hidden", "true");
  document.body.appendChild(cizgi);

  var dizin = null, baglar = [];
  if (basliklar.length >= 4) {
    dizin = document.createElement("nav");
    dizin.className = "ed-dizin";
    dizin.setAttribute("aria-label", "Bu yazıda");
    var ad = document.createElement("p");
    ad.textContent = "Bu yazıda";
    var ol = document.createElement("ol");
    basliklar.forEach(function (h) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.trim();
      li.appendChild(a); ol.appendChild(li); baglar.push(a);
    });
    dizin.appendChild(ad); dizin.appendChild(ol);
    document.body.appendChild(dizin);
  }

  var genisler = govde.querySelectorAll(".tablo-genis, .table-scroll, .ed-grafik, figure"), bekliyor = false;
  function olc() {
    bekliyor = false;
    var r = govde.getBoundingClientRect(), boy = r.height - window.innerHeight;
    var oran = boy > 0 ? Math.min(1, Math.max(0, -r.top / boy)) : 0;
    cizgi.style.transform = "scaleX(" + oran.toFixed(4) + ")";
    if (!dizin) return;
    var etkin = -1;
    basliklar.forEach(function (h, i) { if (h.getBoundingClientRect().top < window.innerHeight * 0.3) etkin = i; });
    baglar.forEach(function (a, i) { if (i === etkin) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    var d = dizin.getBoundingClientRect(), cakisiyor = r.top > window.innerHeight * 0.6 || r.bottom < d.bottom;
    for (var i = 0; i < genisler.length && !cakisiyor; i++) {
      var g = genisler[i].getBoundingClientRect();
      if (g.right > d.left - 8 && g.bottom > d.top && g.top < d.bottom) cakisiyor = true;
    }
    dizin.classList.toggle("ed-dizin-gizli", cakisiyor);
  }
  function iste() { if (!bekliyor) { bekliyor = true; window.requestAnimationFrame(olc); } }
  window.addEventListener("scroll", iste, { passive: true });
  window.addEventListener("resize", iste);
  olc();
})();
