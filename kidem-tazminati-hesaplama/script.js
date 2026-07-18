/* Kıdem ve İhbar Tazminatı Hesaplama — 2026 (bağımlılıksız)
   Gün hassasiyetinde hizmet süresi, dönemsel tavan seçimi, damga vergisi,
   ihbar süresi kademeleri ve gelir vergisi kesintili ihbar tazminatı. */
(function () {
  "use strict";

  /* ---------- Yasal parametreler ---------- */
  var STAMP = 0.00759; // damga vergisi
  var CEILINGS = [     // [dönem başlangıcı (dahil), tavan] — yeni dönem üste eklenir
    ["2026-07-01", 73729.84],
    ["2026-01-01", 64948.77],
    ["2025-07-01", 53919.68],
    ["2025-01-01", 46655.43]
  ];

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    var v = parseFloat(String(el.value).replace(/\./g, "").replace(",", "."));
    return isNaN(v) ? 0 : v;
  }

  function ceilingFor(dateStr) {
    for (var i = 0; i < CEILINGS.length; i++) {
      if (dateStr >= CEILINGS[i][0]) return CEILINGS[i][1];
    }
    return CEILINGS[CEILINGS.length - 1][1];
  }

  /* İhbar süresi (hafta) — İş Kanunu m.17 */
  function noticeWeeks(days) {
    var months = days / 30.4375;
    if (months < 6) return 2;
    if (months < 18) return 4;
    if (months < 36) return 6;
    return 8;
  }

  /* Hizmet süresini yıl/ay/gün olarak ayrıştır (takvim bazlı) */
  function serviceBreakdown(start, end) {
    var y = end.getFullYear() - start.getFullYear();
    var m = end.getMonth() - start.getMonth();
    var d = end.getDate() - start.getDate();
    if (d < 0) { m--; d += new Date(end.getFullYear(), end.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { years: y, months: m, days: d };
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label + '</span><strong class="sum-value">' + value + '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function recalc() {
    var startEl = document.getElementById("in-start");
    var endEl = document.getElementById("in-end");
    var results = document.getElementById("results");
    var msg = document.getElementById("msg");

    var gross = num("in-gross");
    var extras = num("in-extras");
    var dressed = gross + extras;

    if (!startEl.value || !endEl.value || dressed <= 0) {
      results.hidden = true; msg.hidden = true; return;
    }
    var start = new Date(startEl.value + "T00:00:00");
    var end = new Date(endEl.value + "T00:00:00");
    var totalDays = Math.round((end - start) / 86400000);

    if (totalDays <= 0) {
      results.hidden = true;
      msg.textContent = "İşten ayrılış tarihi, işe başlama tarihinden sonra olmalıdır.";
      msg.hidden = false;
      return;
    }
    msg.hidden = true;

    var bd = serviceBreakdown(start, end);
    var serviceText = bd.years + " yıl " + bd.months + " ay " + bd.days + " gün";

    /* --- Kıdem tazminatı --- */
    var ceiling = ceilingFor(endEl.value);
    var yearlyBase = Math.min(dressed, ceiling);
    var capped = dressed > ceiling;
    var eligible = totalDays >= 365;

    var kidemGross = 0, kidemStamp = 0, kidemNet = 0;
    if (eligible) {
      kidemGross = yearlyBase * (totalDays / 365);
      kidemStamp = kidemGross * STAMP;
      kidemNet = kidemGross - kidemStamp;
    }

    /* --- İhbar tazminatı --- */
    var wantIhbar = document.getElementById("in-ihbar").checked;
    var weeks = noticeWeeks(totalDays);
    var rate = parseFloat(document.getElementById("in-bracket").value);
    var ihbarGross = 0, ihbarTax = 0, ihbarStamp = 0, ihbarNet = 0;
    if (wantIhbar) {
      ihbarGross = (dressed / 30) * 7 * weeks;
      ihbarTax = ihbarGross * rate;
      ihbarStamp = ihbarGross * STAMP;
      ihbarNet = ihbarGross - ihbarTax - ihbarStamp;
    }

    /* --- Özet kartları --- */
    var cards =
      sumCard("Hizmet süresi", serviceText, totalDays + " gün") +
      (eligible
        ? sumCard("Net kıdem tazminatı", fmt(kidemNet) + " TL", "Damga vergisi düşülmüş")
        : sumCard("Kıdem tazminatı", "Hak edilmedi", "En az 1 yıl çalışma gerekir")) +
      (wantIhbar
        ? sumCard("Net ihbar tazminatı", fmt(ihbarNet) + " TL", weeks + " haftalık ücret (" + (weeks * 7) + " gün)")
        : "") +
      ((eligible || wantIhbar)
        ? sumCard("Toplam net ödeme", fmt(kidemNet + ihbarNet) + " TL", "Kıdem + ihbar")
        : "");
    document.getElementById("summary").innerHTML = '<div class="sum-grid">' + cards + "</div>";

    /* --- Detay tablosu --- */
    var rows = [];
    rows.push(["Giydirilmiş aylık brüt ücret", fmt(dressed) + " TL"]);
    if (eligible) {
      rows.push(["Uygulanan kıdem tavanı", fmt(ceiling) + " TL" + (capped ? " (tavan uygulandı)" : " (ücret tavanın altında)")]);
      rows.push(["Kıdeme esas yıllık tutar", fmt(yearlyBase) + " TL"]);
      rows.push(["Brüt kıdem tazminatı", fmt(kidemGross) + " TL"]);
      rows.push(["Kıdem damga vergisi (binde 7,59)", "− " + fmt(kidemStamp) + " TL"]);
      rows.push(["<strong>Net kıdem tazminatı</strong>", "<strong>" + fmt(kidemNet) + " TL</strong>"]);
    }
    if (wantIhbar) {
      rows.push(["İhbar süresi", weeks + " hafta (" + (weeks * 7) + " gün)"]);
      rows.push(["Brüt ihbar tazminatı", fmt(ihbarGross) + " TL"]);
      rows.push(["İhbar gelir vergisi (%" + Math.round(rate * 100) + ")", "− " + fmt(ihbarTax) + " TL"]);
      rows.push(["İhbar damga vergisi (binde 7,59)", "− " + fmt(ihbarStamp) + " TL"]);
      rows.push(["<strong>Net ihbar tazminatı</strong>", "<strong>" + fmt(ihbarNet) + " TL</strong>"]);
    }
    var html = '<div class="table-scroll"><table class="payroll detail"><caption class="visually-hidden">Tazminat hesap dökümü</caption><tbody>';
    rows.forEach(function (r) { html += "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>"; });
    html += "</tbody></table></div>" +
      '<p class="muted-note table-note">Kıdem tazminatı gelir vergisinden istisnadır; yalnızca damga vergisi kesilir. İhbar tazminatının gelir vergisi, seçtiğiniz dilime göre yaklaşık hesaplanır.</p>';
    document.getElementById("detail").innerHTML = html;

    results.hidden = false;
  }

  /* ---------- Gün / ay / yıl seçicileri ---------- */
  var today = new Date();
  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  function fillSelect(el, items) {
    if (!el) return;
    var html = "";
    items.forEach(function (it) { html += '<option value="' + it[0] + '">' + it[1] + "</option>"; });
    el.innerHTML = html;
  }

  function buildOptions(prefix) {
    var days = [], months = [], years = [];
    for (var d = 1; d <= 31; d++) days.push([d, d]);
    for (var m = 0; m < 12; m++) months.push([m + 1, MONTHS[m]]);
    for (var y = today.getFullYear(); y >= 1980; y--) years.push([y, y]);
    fillSelect(document.getElementById(prefix + "-day"), days);
    fillSelect(document.getElementById(prefix + "-month"), months);
    fillSelect(document.getElementById(prefix + "-year"), years);
  }

  /* Seçili gün, o ay/yılda geçersizse (örn. 31 Şubat) en yakın geçerli güne çekilir */
  function clampDay(prefix) {
    var yEl = document.getElementById(prefix + "-year");
    var mEl = document.getElementById(prefix + "-month");
    var dEl = document.getElementById(prefix + "-day");
    var maxDay = new Date(+yEl.value, +mEl.value, 0).getDate();
    if (+dEl.value > maxDay) dEl.value = maxDay;
  }

  function composeDate(prefix) {
    clampDay(prefix);
    var y = document.getElementById(prefix + "-year").value;
    var m = document.getElementById(prefix + "-month").value;
    var d = document.getElementById(prefix + "-day").value;
    document.getElementById("in-" + (prefix === "start" ? "start" : "end")).value =
      y + "-" + pad(+m) + "-" + pad(+d);
  }

  function setTrio(prefix, dateObj) {
    document.getElementById(prefix + "-day").value = dateObj.getDate();
    document.getElementById(prefix + "-month").value = dateObj.getMonth() + 1;
    document.getElementById(prefix + "-year").value = dateObj.getFullYear();
    composeDate(prefix);
  }

  buildOptions("start");
  buildOptions("end");

  /* Varsayılan tarihler: 3 yıl önce → bugün */
  var startDefault = new Date(today); startDefault.setFullYear(today.getFullYear() - 3);
  setTrio("start", startDefault);
  setTrio("end", today);

  ["start", "end"].forEach(function (prefix) {
    ["-day", "-month", "-year"].forEach(function (part) {
      var el = document.getElementById(prefix + part);
      if (el) el.addEventListener("change", function () { composeDate(prefix); recalc(); });
    });
  });

  ["in-gross", "in-extras", "in-bracket", "in-ihbar"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  /* Rapor girdi özeti (yazdırma öncesi doldurulur) */
  window.buildReportInputs = function () {
    var el = document.getElementById("report-inputs");
    if (!el) return;
    function tr(v) { return v ? new Date(v + "T00:00:00").toLocaleDateString("tr-TR") : "—"; }
    el.innerHTML = [
      "<strong>İşe başlama:</strong> " + tr(document.getElementById("in-start").value),
      "<strong>İşten ayrılış:</strong> " + tr(document.getElementById("in-end").value),
      "<strong>Son brüt maaş:</strong> " + fmt(num("in-gross")) + " TL",
      "<strong>Aylık ek ödemeler:</strong> " + fmt(num("in-extras")) + " TL",
      "<strong>Uygulanan tavan:</strong> " + fmt(ceilingFor(document.getElementById("in-end").value)) + " TL"
    ].join(" &nbsp;·&nbsp; ");
  };

  recalc();
})();
