/* Final Notu Hesaplama — hesaplama ve sekme yönetimi (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(String(el.value).replace(",", ".")) : NaN;
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function weights() {
    var v = num("w-vize"), f = num("w-final");
    if (isNaN(v)) v = 40;
    if (isNaN(f)) f = 100 - v;
    return { v: v / 100, f: f / 100, vp: v, fp: f };
  }

  function recalc() {
    var w = weights();

    // Panel 1: gereken final
    var vize = num("p1-vize"), gecme = num("p1-gecme");
    if (isNaN(vize) || isNaN(gecme)) { set("p1-out", ""); }
    else if (w.f <= 0) { set("p1-out", "Final ağırlığı 0’dan büyük olmalı."); }
    else {
      var gereken = (gecme - vize * w.v) / w.f;
      var note = "";
      if (gereken <= 0) note = "Finalden düşük not alsan bile bu ağırlıklarla geçersin.";
      else if (gereken > 100) note = "Bu ağırlıklarla geçmek matematiksel olarak mümkün değil (bütünleme gerekebilir).";
      else note = "Ağırlıklar %" + fmt(w.vp) + " vize · %" + fmt(w.fp) + " final.";
      set("p1-out", "Gereken final notu: " + (gereken > 100 ? ">100" : fmt(Math.max(0, gereken))) +
        '<span class="muted-note">' + note + "</span>");
    }

    // Panel 2: ortalama
    var v2 = num("p2-vize"), f2 = num("p2-final");
    if (isNaN(v2) || isNaN(f2)) { set("p2-out", ""); }
    else {
      var ort = v2 * w.v + f2 * w.f;
      var durum = ort >= 50 ? "Geçer görünüyor" : "Kalma riski var";
      set("p2-out", "Dönem ortalaması: " + fmt(ort) +
        '<span class="muted-note">' + durum + " · Ağırlıklar %" + fmt(w.vp) + " vize · %" + fmt(w.fp) + " final.</span>");
    }
  }

  // Vize ağırlığı değişince finali otomatik tamamla (kullanıcı finali elle değiştirmediyse mantıklı)
  var wv = document.getElementById("w-vize");
  var wf = document.getElementById("w-final");
  if (wv) wv.addEventListener("input", function () {
    var v = num("w-vize");
    if (!isNaN(v) && wf) wf.value = String(Math.max(0, 100 - v));
    recalc();
  });

  ["w-final", "p1-vize", "p1-gecme", "p2-vize", "p2-final"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", recalc);
  });

  // Sekmeler
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var sel = t === tab;
      t.setAttribute("aria-selected", String(sel));
      t.tabIndex = sel ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sel;
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); tabs[idx].focus(); selectTab(tabs[idx]); }
    });
  });

  recalc();
})();
