/* Yüzde Hesaplama — hesaplama mantığı ve sekme yönetimi (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
  function fmt(n) {
    if (!isFinite(n)) return "—";
    return nf.format(Math.round(n * 100) / 100);
  }
  function val(id) {
    var el = document.getElementById(id);
    if (!el) return NaN;
    return parseFloat(String(el.value).replace(",", "."));
  }
  function set(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  var calc = {
    p1: function () {
      var s = val("p1-num"), p = val("p1-pct");
      if (isNaN(s) || isNaN(p)) return set("p1-out", "");
      set("p1-out", fmt(s * p / 100) +
        '<span class="muted-note">' + fmt(s) + " sayısının %" + fmt(p) + "’i.</span>");
    },
    p2: function () {
      var a = val("p2-part"), b = val("p2-whole");
      if (isNaN(a) || isNaN(b)) return set("p2-out", "");
      if (b === 0) return set("p2-out", "Bütün 0 olamaz.");
      set("p2-out", "%" + fmt(a / b * 100) +
        '<span class="muted-note">' + fmt(a) + ", " + fmt(b) + " sayısının yüzde kaçıdır.</span>");
    },
    p3: function () {
      var o = val("p3-old"), n = val("p3-new");
      if (isNaN(o) || isNaN(n)) return set("p3-out", "");
      if (o === 0) return set("p3-out", "Eski değer 0 olamaz.");
      var d = (n - o) / o * 100;
      var yon = d > 0 ? "artış" : d < 0 ? "azalış" : "değişim yok";
      set("p3-out", "%" + fmt(Math.abs(d)) + " " + yon +
        '<span class="muted-note">' + fmt(o) + " → " + fmt(n) + " (fark " + fmt(n - o) + ").</span>");
    },
    p4: function () {
      var s = val("p4-num"), p = val("p4-pct");
      if (isNaN(s) || isNaN(p)) return set("p4-out", "");
      set("p4-out", "Ekle: " + fmt(s * (1 + p / 100)) + "  ·  Çıkar: " + fmt(s * (1 - p / 100)) +
        '<span class="muted-note">' + fmt(s) + " değerine %" + fmt(p) + " eklendi / çıkarıldı.</span>");
    }
  };

  function recalcAll() { calc.p1(); calc.p2(); calc.p3(); calc.p4(); }

  // Girişleri dinle
  ["p1-num","p1-pct","p2-part","p2-whole","p3-old","p3-new","p4-num","p4-pct"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", recalcAll);
  });

  // Sekmeler (ARIA tablist)
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
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

  recalcAll();
})();
