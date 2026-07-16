/* Maaş Hesaplama — 2026 bordro motoru (bağımlılıksız)
   Kümülatif gelir vergisi, SGK tavanı, asgari ücret istisnası, damga vergisi,
   12 aylık döküm ve netten brüte ikili arama çözücüsü. */
(function () {
  "use strict";

  /* ---------- 2026 yasal parametreleri ---------- */
  var P = {
    year: 2026,
    minGross: 33030.00,          // aylık brüt asgari ücret
    sgkCeiling: 297270.00,       // SGK prim tavanı (asgari × 9)
    sgkEmployee: 0.14,           // SGK işçi payı
    unempEmployee: 0.01,         // işsizlik sigortası işçi payı
    sgkEmployer: 0.2175,         // SGK işveren payı (teşviksiz)
    unempEmployer: 0.02,         // işsizlik işveren payı
    stampRate: 0.00759,          // damga vergisi
    brackets: [                  // [üst sınır, oran] — ücret gelirleri tarifesi
      [190000, 0.15],
      [400000, 0.20],
      [1500000, 0.27],
      [5300000, 0.35],
      [Infinity, 0.40]
    ]
  };

  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(String(el.value).replace(/\./g, "").replace(",", ".")) : NaN;
  }

  /* Kümülatif matrah üzerinden tarifeye göre toplam vergi */
  function taxOn(base) {
    if (base <= 0) return 0;
    var tax = 0, prev = 0;
    for (var i = 0; i < P.brackets.length; i++) {
      var top = P.brackets[i][0], rate = P.brackets[i][1];
      if (base > top) { tax += (top - prev) * rate; prev = top; }
      else { tax += (base - prev) * rate; break; }
    }
    return tax;
  }

  /* Bir ayın vergisi = kümülatif fark */
  function monthlyTax(cumBefore, monthBase) {
    return taxOn(cumBefore + monthBase) - taxOn(cumBefore);
  }

  var minBase = P.minGross * (1 - P.sgkEmployee - P.unempEmployee); // asgari ücretlinin aylık matrahı

  /* Tek ayın bordrosu. cum: {base, minBase} kümülatif durum (değiştirilir) */
  function calcMonth(gross, cum) {
    var sgkBase = Math.min(gross, P.sgkCeiling);
    var sgk = sgkBase * P.sgkEmployee;
    var unemp = sgkBase * P.unempEmployee;
    var base = gross - sgk - unemp;

    var grossTax = monthlyTax(cum.base, base);
    var exemption = monthlyTax(cum.minBase, minBase);      // asgari ücret gelir vergisi istisnası
    var incomeTax = Math.max(0, grossTax - exemption);

    var stamp = Math.max(0, gross - P.minGross) * P.stampRate; // damga vergisi (asgari ücret kısmı istisna)

    cum.base += base;
    cum.minBase += minBase;

    var net = gross - sgk - unemp - incomeTax - stamp;
    var employer = gross + sgkBase * P.sgkEmployer + sgkBase * P.unempEmployer;

    return { gross: gross, sgk: sgk, unemp: unemp, base: base, cumBase: cum.base,
      incomeTax: incomeTax, exemption: Math.min(exemption, grossTax), stamp: stamp,
      net: net, employer: employer };
  }

  function calcYear(gross) {
    var cum = { base: 0, minBase: 0 }, rows = [];
    for (var m = 0; m < 12; m++) rows.push(calcMonth(gross, cum));
    return rows;
  }

  /* Netten brüte: hedef net'i veren brütü ikili arama ile çöz (ay bazlı) */
  function grossFromNet(targetNet, monthIndex) {
    function netAt(gross) {
      var cum = { base: 0, minBase: 0 }, r;
      for (var m = 0; m <= monthIndex; m++) r = calcMonth(gross, cum);
      return r.net;
    }
    var lo = targetNet, hi = targetNet * 2.2 + 1000;
    while (netAt(hi) < targetNet) hi *= 1.5;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (netAt(mid) < targetNet) lo = mid; else hi = mid;
    }
    return Math.round(hi * 100) / 100;
  }

  /* ---------- Görselleştirme ---------- */
  function renderSummary(el, rows) {
    var yearNet = 0, yearTax = 0, yearEmployer = 0;
    rows.forEach(function (r) { yearNet += r.net; yearTax += r.incomeTax + r.stamp; yearEmployer += r.employer; });
    el.innerHTML =
      '<div class="sum-grid">' +
      sumCard("Ocak net maaş", fmt(rows[0].net) + " TL", "Yılın ilk ayı, en yüksek net") +
      sumCard("Aralık net maaş", fmt(rows[11].net) + " TL", "Vergi dilimi ilerledikten sonra") +
      sumCard("Aylık ortalama net", fmt(yearNet / 12) + " TL", "12 aylık ortalama") +
      sumCard("Yıllık toplam net", fmt(yearNet) + " TL", "12 ay toplamı") +
      sumCard("Yıllık vergi + damga", fmt(yearTax) + " TL", "İstisna sonrası ödenen") +
      sumCard("İşverene aylık maliyet", fmt(rows[0].employer) + " TL", "Teşviksiz toplam maliyet") +
      "</div>";
  }
  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label + '</span><strong class="sum-value">' + value + '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function renderTable(el, rows) {
    var html = '<div class="table-scroll"><table class="payroll"><caption class="visually-hidden">12 aylık bordro dökümü</caption>' +
      "<thead><tr><th>Ay</th><th>Brüt</th><th>SGK %14</th><th>İşsizlik %1</th><th>Gelir vergisi</th><th>Damga</th><th>Net maaş</th></tr></thead><tbody>";
    rows.forEach(function (r, i) {
      html += "<tr><th>" + MONTHS[i] + "</th><td>" + fmt(r.gross) + "</td><td>" + fmt(r.sgk) + "</td><td>" + fmt(r.unemp) +
        "</td><td>" + fmt(r.incomeTax) + "</td><td>" + fmt(r.stamp) + "</td><td><strong>" + fmt(r.net) + "</strong></td></tr>";
    });
    html += "</tbody></table></div>" +
      '<p class="muted-note table-note">Gelir vergisi sütunu, asgari ücret istisnası düşüldükten sonra ödenen tutardır. Tutarlar TL cinsindendir.</p>';
    el.innerHTML = html;
  }

  function showResults(rows) {
    renderSummary(document.getElementById("summary"), rows);
    renderTable(document.getElementById("table"), rows);
    document.getElementById("results").hidden = false;
  }

  function recalcGross() {
    var g = num("in-gross");
    if (isNaN(g) || g <= 0) return;
    if (g < P.minGross) g = P.minGross;
    showResults(calcYear(g));
  }

  function recalcNet() {
    var n = num("in-net");
    var out = document.getElementById("net-out");
    if (isNaN(n) || n <= 0) { out.innerHTML = ""; return; }
    var minNet = calcYear(P.minGross)[0].net;
    if (n < minNet) n = minNet;
    var gross = grossFromNet(n, 0); // Ocak ayı netine göre
    out.innerHTML = "Gereken brüt maaş: " + fmt(gross) + " TL" +
      '<span class="muted-note">Ocak ayı neti ' + fmt(n) + " TL olacak şekilde çözüldü. Aşağıda 12 aylık döküm.</span>";
    showResults(calcYear(gross));
  }

  var elGross = document.getElementById("in-gross");
  var elNet = document.getElementById("in-net");
  if (elGross) elGross.addEventListener("input", recalcGross);
  if (elNet) elNet.addEventListener("input", recalcNet);

  /* Sekmeler */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var sel = t === tab;
      t.setAttribute("aria-selected", String(sel));
      t.tabIndex = sel ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sel;
    });
    if (tab.id === "tab-1") recalcGross(); else recalcNet();
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

  recalcGross();
})();
