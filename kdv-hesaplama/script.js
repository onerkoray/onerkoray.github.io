/* KDV Hesaplama — hesaplama ve sekme yönetimi (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(String(el.value).replace(",", ".")) : NaN;
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function currentRate() {
    var custom = document.getElementById("rate-custom");
    if (custom && custom.value !== "") {
      var c = parseFloat(String(custom.value).replace(",", "."));
      if (!isNaN(c) && c >= 0) return c;
    }
    var checked = document.querySelector('input[name="rate"]:checked');
    return checked ? parseFloat(checked.value) : 20;
  }

  function recalc() {
    var r = currentRate();

    var matrah = num("p1-matrah");
    if (isNaN(matrah)) { set("p1-out", ""); }
    else {
      var kdv = matrah * r / 100;
      set("p1-out", "KDV dahil: " + fmt(matrah + kdv) + " TL" +
        '<span class="muted-note">%' + fmt(r) + " KDV: " + fmt(kdv) + " TL · Matrah: " + fmt(matrah) + " TL</span>");
    }

    var dahil = num("p2-dahil");
    if (isNaN(dahil)) { set("p2-out", ""); }
    else {
      var base = dahil / (1 + r / 100);
      var kdv2 = dahil - base;
      set("p2-out", "Matrah (hariç): " + fmt(base) + " TL" +
        '<span class="muted-note">%' + fmt(r) + " KDV: " + fmt(kdv2) + " TL · KDV dahil: " + fmt(dahil) + " TL</span>");
    }
  }

  ["p1-matrah", "p2-dahil", "rate-custom"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", recalc);
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="rate"]'), function (el) {
    el.addEventListener("change", function () {
      var custom = document.getElementById("rate-custom");
      if (custom) custom.value = "";
      recalc();
    });
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
