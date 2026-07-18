/* Serbest Meslek Makbuzu Hesaplama — makbuz (brüt/net) + yıllık gelir vergisi (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    if (!el) return NaN;
    return parseFloat(String(el.value).replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function radioVal(name, dflt) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? parseFloat(el.value) : dflt;
  }

  // 2026 ücret dışı gelir vergisi tarifesi
  var LOWER = [0, 190000, 400000, 1000000, 5300000];
  var BASE  = [0, 28500, 70500, 232500, 1737500];
  var RATE  = [0.15, 0.20, 0.27, 0.35, 0.40];
  function incomeTax(k) {
    if (!(k > 0)) return 0;
    var i = LOWER.length - 1;
    while (i > 0 && k <= LOWER[i]) i--;
    return BASE[i] + (k - LOWER[i]) * RATE[i];
  }
  function marginalRate(k) {
    var i = LOWER.length - 1;
    while (i > 0 && k <= LOWER[i]) i--;
    return RATE[i];
  }

  function rows(pairs) {
    var html = '<table class="bd-table"><tbody>';
    for (var i = 0; i < pairs.length; i++) {
      var cls = pairs[i][2] ? ' class="' + pairs[i][2] + '"' : '';
      html += '<tr' + cls + '><th scope="row">' + pairs[i][0] + '</th><td>' + pairs[i][1] + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  function recalc() {
    var s = radioVal("stopaj", 20) / 100;
    var k = radioVal("kdv", 20) / 100;
    var t = radioVal("tevkifat", 0);

    // Tab 1: brütten
    var brut = num("p1-brut");
    if (isNaN(brut)) { set("p1-out", ""); }
    else {
      var stopaj = brut * s;
      var kdv = brut * k;
      var kdvTevkif = kdv * t;
      var kdvTahsil = kdv - kdvTevkif;
      var net = brut - stopaj + kdvTahsil;
      var faturaToplam = brut + kdv;
      var r1 = [
        ["Brüt ücret", fmt(brut) + " TL"],
        ["Gelir vergisi stopajı (%" + fmt(s * 100) + ")", "− " + fmt(stopaj) + " TL"],
        ["KDV (%" + fmt(k * 100) + ")", "+ " + fmt(kdv) + " TL"]
      ];
      if (t > 0) r1.push(["Tevkif edilen KDV (alıcı öder)", "− " + fmt(kdvTevkif) + " TL"]);
      r1.push(["Elinize geçen net", fmt(net) + " TL", "bd-total"]);
      r1.push(["Makbuz toplamı (fatura)", fmt(faturaToplam) + " TL"]);
      r1.push(["Devlete giden (stopaj + tevkifat)", fmt(stopaj + kdvTevkif) + " TL"]);
      set("p1-out", rows(r1));
    }

    // Tab 2: netten brüte
    var net2 = num("p2-net");
    var denom = 1 - s + k * (1 - t);
    if (isNaN(net2) || !(denom > 0)) { set("p2-out", ""); }
    else {
      var brut2 = net2 / denom;
      var stopaj2 = brut2 * s;
      var kdv2 = brut2 * k;
      var kdvTevkif2 = kdv2 * t;
      var r2 = [
        ["İstenen net", fmt(net2) + " TL"],
        ["Gereken brüt ücret", fmt(brut2) + " TL", "bd-total"],
        ["Gelir vergisi stopajı (%" + fmt(s * 100) + ")", fmt(stopaj2) + " TL"],
        ["KDV (%" + fmt(k * 100) + ")", fmt(kdv2) + " TL"]
      ];
      if (t > 0) r2.push(["Tevkif edilen KDV", fmt(kdvTevkif2) + " TL"]);
      r2.push(["Makbuz toplamı (fatura)", fmt(brut2 + kdv2) + " TL"]);
      set("p2-out", rows(r2));
    }

    // Tab 3: yıllık gelir vergisi
    var kazanc = num("p3-kazanc");
    var kesilen = num("p3-stopaj");
    if (isNaN(kesilen)) kesilen = 0;
    if (isNaN(kazanc)) { set("p3-out", ""); }
    else {
      var vergi = incomeTax(kazanc);
      var odenecek = vergi - kesilen;
      var efektif = kazanc > 0 ? (vergi / kazanc) * 100 : 0;
      var r3 = [
        ["Yıllık kazanç (matrah)", fmt(kazanc) + " TL"],
        ["Hesaplanan gelir vergisi", fmt(vergi) + " TL", "bd-total"],
        ["Efektif vergi oranı", fmt(efektif) + " %"],
        ["Marjinal dilim", "%" + fmt(marginalRate(kazanc) * 100)]
      ];
      if (kesilen > 0) {
        r3.push(["Yıl içinde kesilen stopaj", "− " + fmt(kesilen) + " TL"]);
        r3.push([(odenecek >= 0 ? "Ödenecek gelir vergisi" : "İade alınacak"), fmt(Math.abs(odenecek)) + " TL", "bd-total"]);
      }
      set("p3-out", rows(r3));
    }
  }

  ["p1-brut", "p2-net", "p3-kazanc", "p3-stopaj"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", recalc);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#smm-opts input[type="radio"]'), function (el) {
    el.addEventListener("change", recalc);
  });

  // Sekmeler
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var opts = document.getElementById("smm-opts");
  var optsNote = document.getElementById("opts-note");
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var sel = t === tab;
      t.setAttribute("aria-selected", String(sel));
      t.tabIndex = sel ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sel;
    });
    // Makbuz oranları yıllık sekmesinde gizlenir
    var isYearly = tab.id === "tab-3";
    if (opts) opts.hidden = isYearly;
    if (optsNote) optsNote.hidden = isYearly;
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
