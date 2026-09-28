/* Altın mı, dolar mı, mevduat mı? — sayfa betiği.
   Seriler finans/*.js'ten, hesap finans/varlik-motoru.js'ten, görünüm
   gorunum.js'ten gelir; bu dosya yalnızca formu, süre düğmelerini ve
   grafiğin imlecini bağlar. Hesap tamamen tarayıcıda yapılır. */
(function () {
  "use strict";

  var V = window.VarlikMotoru, G = window.VarlikGorunum, C = window.GrafikCizim;
  if (!V || !G || !C || !window.Finans) return;

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function el(id) { return document.getElementById(id); }

  /* ---- tarih seçicileri --------------------------------------------------- */
  function doldur() {
    var y0 = +V.ILK.slice(0, 4), y1 = +V.SON.slice(0, 4);
    ["bas", "son"].forEach(function (k) {
      var ay = el("in-" + k + "-ay"), yil = el("in-" + k + "-yil");
      ay.innerHTML = AYLAR.map(function (a, i) { return '<option value="' + (i < 9 ? "0" : "") + (i + 1) + '">' + a + "</option>"; }).join("");
      var y = [];
      for (var i = y0; i <= y1; i++) y.push('<option value="' + i + '">' + i + "</option>");
      yil.innerHTML = y.join("");
    });
  }
  function ayYaz(k, deger) { el("in-" + k + "-yil").value = deger.slice(0, 4); el("in-" + k + "-ay").value = deger.slice(5, 7); }
  function ayOku(k) { return el("in-" + k + "-yil").value + "-" + el("in-" + k + "-ay").value; }

  /* ---- hesap ------------------------------------------------------------------- */
  var sonOzet = null;
  function mesaj(m) { var e = el("vk-mesaj"); e.textContent = m || ""; e.hidden = !m; }
  function hesapla() {
    var tutar = Finans.sayi(el("in-tutar").value, false), bas = ayOku("bas"), son = ayOku("son");
    if (!(tutar > 0)) { mesaj("Geçerli bir tutar girin."); return; }
    if (bas < V.ILK || son > V.SON) { mesaj("Veri " + G.ayAdi(V.ILK) + " ile " + G.ayAdi(V.SON) + " arasında."); return; }
    if (son <= bas) { mesaj("Değerleme ayı, yatırım ayından sonra olmalı."); return; }
    mesaj("");
    sonOzet = V.ozet({ tutar: tutar, bas: bas, son: son });
    el("vk-sonuc").innerHTML = G.sonucHtml(sonOzet);
    el("vk-grafik").innerHTML = G.grafikHtml(sonOzet);
    imlecler();
  }

  /* ---- adres çubuğu: hesabı paylaşılabilir kılar ----------------------------- */
  function adresOku() {
    var q = new URLSearchParams(location.search), v = G.VARSAYILAN;
    el("in-tutar").value = q.get("tutar") || String(v.tutar);
    var bas = q.get("bas"), son = q.get("son");
    ayYaz("bas", /^\d{4}-\d{2}$/.test(bas || "") && bas >= V.ILK && bas <= V.SON ? bas : v.bas);
    ayYaz("son", /^\d{4}-\d{2}$/.test(son || "") && son >= V.ILK && son <= V.SON ? son : v.son);
    var s = +q.get("sure");
    return [12, 36, 60, 120].indexOf(s) >= 0 ? s : v.sure;
  }
  function adresYaz() {
    var q = new URLSearchParams(), v = G.VARSAYILAN;
    var t = el("in-tutar").value.trim(), bas = ayOku("bas"), son = ayOku("son");
    if (t && Finans.sayi(t, false) !== v.tutar) q.set("tutar", t);
    if (bas !== v.bas) q.set("bas", bas);
    if (son !== v.son) q.set("son", son);
    if (sure !== v.sure) q.set("sure", sure);
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }

  /* ---- süre düğmeleri ---------------------------------------------------------- */
  var sure = G.VARSAYILAN.sure, onbellek = {};
  function haritaCiz() {
    if (!onbellek[sure]) onbellek[sure] = G.haritaHtml(sure);
    el("vk-harita").innerHTML = onbellek[sure];
    Array.prototype.forEach.call(document.querySelectorAll(".vk-sureler button"), function (b) {
      b.setAttribute("aria-pressed", String(+b.getAttribute("data-sure") === sure));
    });
  }

  /* ---- grafik imleci ------------------------------------------------------------ */
  function imlecBagla(kap, W) {
    var svg = kap.querySelector("svg");
    if (!svg || !sonOzet) return;
    var o = G.grafikSecenek(sonOzet, W), c = C.cizgi(o);
    var yol = sonOzet.yol, xmin = c.xDeger(o.x.min), xmax = c.xDeger(o.x.max);
    var imlec = svg.querySelector(".gr-imlec"), konum = null;
    var kutu = document.createElement("div");
    kutu.className = "gr-ipucu"; kutu.hidden = true; kutu.setAttribute("role", "status");
    kap.appendChild(kutu);
    if (svg.getAttribute("role") === "img") svg.setAttribute("tabindex", "0");

    function goster(xv) {
      xv = Math.max(xmin, Math.min(xmax, xv));
      konum = xv;
      var n = yol[xv - xmin];
      if (!n) return;
      var px = c.x(xv), H1 = +svg.getAttribute("height") - c.kenar.alt;
      var parca = ['<line x1="' + px + '" x2="' + px + '" y1="' + c.kenar.ust + '" y2="' + H1 + '"/>'];
      ["altin", "dolar", "mevduat"].forEach(function (k) {
        parca.push('<circle class="gr-i-' + G.SINIF[k] + '" cx="' + px + '" cy="' + c.y(n[k]) + '" r="4.5"/>');
      });
      imlec.innerHTML = parca.join("");
      kutu.innerHTML = "<b>" + G.ayAdi(n.ay) + " sonu</b>" +
        ["altin", "dolar", "mevduat"].map(function (k) {
          return '<span><i class="gr-i-' + G.SINIF[k] + '">' + V.ADLAR[k] + "</i>" + G.tl(n[k]) + "</span>";
        }).join("") +
        '<span><i class="gr-i-soluk">TÜFE (gereken)</i>' + G.tl(n.tufe) + "</span>";
      kutu.hidden = false;
      var olcek = svg.clientWidth / W, kw = kutu.offsetWidth;
      kutu.style.left = Math.max(kw / 2 + 2, Math.min(svg.clientWidth - kw / 2 - 2, px * olcek)) + "px";
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
  function imlecler() {
    var genis = document.querySelector(".vk-grafik-genis"), dar = document.querySelector(".vk-grafik-dar");
    if (genis) imlecBagla(genis, 1000);
    if (dar) imlecBagla(dar, 380);
  }

  doldur();
  sure = adresOku();
  ["in-tutar", "in-bas-ay", "in-bas-yil", "in-son-ay", "in-son-yil"].forEach(function (id) {
    el(id).addEventListener("input", function () { hesapla(); adresYaz(); });
    el(id).addEventListener("change", function () { hesapla(); adresYaz(); });
  });
  el("varlik-form").addEventListener("submit", function (e) { e.preventDefault(); });
  Array.prototype.forEach.call(document.querySelectorAll(".vk-sureler button"), function (b) {
    b.addEventListener("click", function () { sure = +b.getAttribute("data-sure"); haritaCiz(); adresYaz(); });
  });
  hesapla();
  if (sure !== G.VARSAYILAN.sure) haritaCiz();
})();
