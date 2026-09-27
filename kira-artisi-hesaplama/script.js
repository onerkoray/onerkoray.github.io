/* Kira Artışı Hesaplama — sayfa betiği.
   Oranlar finans/kira-tufe.js'ten, kurallar finans/kira-motoru.js'ten,
   görünüm gorunum.js'ten gelir; bu dosya yalnızca formları ve grafiğin
   imlecini bağlar. Hesap tamamen tarayıcıda yapılır. */
(function () {
  "use strict";

  var M = window.KiraMotoru, G = window.KiraGorunum, C = window.GrafikCizim;
  if (!M || !G || !C) return;

  function el(id) { return document.getElementById(id); }
  function tutar(id) { return Finans.sayi(el(id).value, false); }
  function oranAlani(id) {
    var ham = String(el(id).value).trim();
    if (ham === "") return null;
    var v = Finans.sayi(ham.replace(/^%/, ""), false);
    return isFinite(v) ? v : NaN;
  }
  function bugun() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate();
  }
  function mesaj(id, metin) { var m = el(id); m.textContent = metin || ""; m.hidden = !metin; }

  /* ---- 1. bu yılki zam ---------------------------------------------------- */
  function hesapla() {
    var sonuc = el("results"), tur = el("in-type").value;
    var kira = tutar("in-rent"), tarih = el("in-date").value, soz = oranAlani("in-agreed");
    if (!isFinite(kira) || kira <= 0) { sonuc.innerHTML = ""; mesaj("msg", "Mevcut aylık kirayı girin."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) { sonuc.innerHTML = ""; mesaj("msg", "Yenileme tarihini seçin."); return; }
    if (soz !== null && (isNaN(soz) || soz < 0)) { sonuc.innerHTML = ""; mesaj("msg", "Sözleşmedeki oranı sayı olarak girin (ör. 25) ya da boş bırakın."); return; }
    var r = M.yeniKira(kira, { tarih: tarih, tur: tur, sozlesme: soz });
    var g = G.yeniKiraHtml(r, tur);
    sonuc.innerHTML = g.html;
    mesaj("msg", g.mesaj);
  }

  /* ---- 2. kira geçmişi ------------------------------------------------------ */
  function gecmis() {
    var kap = el("gecmis-sonuc"), tur = el("g-type").value;
    var kira = tutar("g-rent"), bas = el("g-start").value, soz = oranAlani("g-agreed");
    if (!isFinite(kira) || kira <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(bas)) {
      kap.innerHTML = '<p class="kira-not">Başlangıç tarihini ve ilk kirayı girin.</p>'; return;
    }
    if (soz !== null && (isNaN(soz) || soz < 0)) {
      kap.innerHTML = '<p class="kira-not">Sözleşmedeki oranı sayı olarak girin ya da boş bırakın.</p>'; return;
    }
    if (bas > bugun()) { kap.innerHTML = '<p class="kira-not">Başlangıç tarihi bugünden sonra olamaz.</p>'; return; }
    kap.innerHTML = G.gecmisHtml(M.gecmis({ baslangic: bas, kira: kira, tur: tur, sozlesme: soz, bugun: bugun() }));
  }

  /* ---- adres çubuğu: hesabı paylaşılabilir kılar --------------------------- */
  var ALANLAR = { tur: "in-type", kira: "in-rent", tarih: "in-date", oran: "in-agreed",
    gtur: "g-type", baslangic: "g-start", ilk: "g-rent", goran: "g-agreed" };
  function adresOku() {
    var q = new URLSearchParams(location.search);
    Object.keys(ALANLAR).forEach(function (k) { if (q.has(k)) el(ALANLAR[k]).value = q.get(k); });
  }
  function adresYaz() {
    var q = new URLSearchParams();
    Object.keys(ALANLAR).forEach(function (k) {
      var e = el(ALANLAR[k]);
      if (e.value !== e.defaultValue && !(e.tagName === "SELECT" && e.selectedOptions[0] && e.selectedOptions[0].defaultSelected)) q.set(k, e.value);
    });
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }

  /* ---- grafik imleci ----------------------------------------------------------- */
  function imlecBagla(kap, W) {
    var svg = kap.querySelector("svg");
    if (!svg) return;
    var o = G.grafikSecenek(W), c = C.cizgi(o);
    var noktalar = o.seriler[0].noktalar;
    var xmin = c.xDeger(o.x.min), xmax = c.xDeger(o.x.max);
    var imlec = svg.querySelector(".gr-imlec"), konum = null;
    var kutu = document.createElement("div");
    kutu.className = "gr-ipucu"; kutu.hidden = true; kutu.setAttribute("role", "status");
    kap.appendChild(kutu);
    if (svg.getAttribute("role") === "img") svg.setAttribute("tabindex", "0");

    function goster(xv) {
      xv = Math.max(xmin, Math.min(xmax, xv));
      konum = xv;
      var n = noktalar.filter(function (p) { return c.xDeger(p.x) === xv; })[0];
      if (!n) return;
      var px = c.x(xv), py = c.y(n.y), H1 = +svg.getAttribute("height") - c.kenar.alt;
      imlec.innerHTML = '<line x1="' + px + '" x2="' + px + '" y1="' + c.kenar.ust + '" y2="' + H1 + '"/>' +
        '<circle class="gr-i-bir" cx="' + px + '" cy="' + py + '" r="4.5"/>';
      var sinirli = n.x >= "2022-06" && n.x < "2024-07" && n.y > M.SINIR25.oran;
      kutu.innerHTML = "<b>" + M.ayAdi(n.x) + " yenilemesi</b>" +
        '<span><i class="gr-i-bir">İş yeri</i>' + G.yuzde(n.y) + "</span>" +
        '<span><i class="gr-i-bir">Konut</i>' + (sinirli ? (n.x === "2022-06" ? "%25 (11 Haz.'dan)" : "%25") : G.yuzde(n.y)) + "</span>";
      kutu.hidden = false;
      var olcek = svg.clientWidth / W, kw = kutu.offsetWidth;
      var sol = Math.max(kw / 2 + 2, Math.min(svg.clientWidth - kw / 2 - 2, px * olcek));
      kutu.style.left = sol + "px";
      kutu.style.top = (c.kenar.ust + 8) * olcek + "px";
      kutu.style.transform = "translate(-50%, 0)";
    }
    function gizle() { imlec.innerHTML = ""; kutu.hidden = true; }
    function isaretciden(e) {
      var p = svg.createSVGPoint();
      p.x = e.clientX; p.y = e.clientY;
      goster(Math.round(c.x.ters(p.matrixTransform(svg.getScreenCTM().inverse()).x)));
    }
    svg.addEventListener("pointermove", isaretciden);
    svg.addEventListener("pointerdown", isaretciden);
    svg.addEventListener("pointerleave", gizle);
    svg.addEventListener("blur", gizle);
    svg.addEventListener("focus", function () { goster(xmax); });
    svg.addEventListener("keydown", function (e) {
      var adim = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[e.key];
      if (adim) { e.preventDefault(); goster((konum == null ? xmax : konum) + adim); }
      else if (e.key === "Home") { e.preventDefault(); goster(xmin); }
      else if (e.key === "End") { e.preventDefault(); goster(xmax); }
      else if (e.key === "Escape") gizle();
    });
  }

  adresOku();
  ["in-type", "in-rent", "in-date", "in-agreed"].forEach(function (id) {
    el(id).addEventListener("input", function () { hesapla(); adresYaz(); });
    el(id).addEventListener("change", function () { hesapla(); adresYaz(); });
  });
  ["g-type", "g-start", "g-rent", "g-agreed"].forEach(function (id) {
    el(id).addEventListener("input", function () { gecmis(); adresYaz(); });
    el(id).addEventListener("change", function () { gecmis(); adresYaz(); });
  });
  ["kira-form", "gecmis-form"].forEach(function (id) {
    el(id).addEventListener("submit", function (e) { e.preventDefault(); });
  });
  hesapla();
  gecmis();
  var genis = document.querySelector(".kira-grafik-genis"), dar = document.querySelector(".kira-grafik-dar");
  if (genis) imlecBagla(genis, 1000);
  if (dar) imlecBagla(dar, 380);
})();
