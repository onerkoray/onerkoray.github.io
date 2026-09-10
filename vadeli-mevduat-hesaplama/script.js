/* Vadeli Mevduat Faizi Hesaplama — gün esaslı brüt/net getiri (bağımlılıksız).
   Tüm hesaplama istemci tarafında yapılır. */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }

  function num(id) {
    var el = document.getElementById(id);
    if (!el) return NaN;
    var raw = String(el.value).trim().replace(/\s/g, "");
    if (raw === "") return NaN;
    if (raw.indexOf(",") >= 0) {
      raw = raw.replace(/\./g, "").replace(",", "."); // virgül ondalık, nokta binlik
    } else {
      // yalnızca nokta: tüm gruplar tam 3 basamaksa binlik (100.000), aksi ondalık (3.79)
      var parts = raw.split(".");
      if (parts.length > 1 && parts.slice(1).every(function (p) { return p.length === 3; })) {
        raw = parts.join("");
      }
    }
    return Finans.sayi(el.value, el.type === "number");
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label +
      '</span><strong class="sum-value">' + value +
      '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function recalc() {
    var results = document.getElementById("results");
    var msg = document.getElementById("msg");

    document.getElementById("principal-unit").textContent = document.getElementById("in-type").value === "tl" ? "TL" : "döviz birimi";
    var P = num("in-principal");
    var ratePct = num("in-rate");
    var days = num("in-days");
    var calculation;
    try {
      calculation = Finans.mevduat(P, ratePct, days, document.getElementById("in-date").value, document.getElementById("in-type").value);
    } catch (err) {
      results.innerHTML = ""; msg.textContent = err.message; msg.hidden = false; return;
    }
    msg.hidden = true;
    var taxPct = calculation.taxPct;
    var grossInterest = calculation.gross, tax = calculation.tax, netInterest = calculation.net, maturity = calculation.maturity;
    var unit = document.getElementById("in-type").value === "tl" ? " TL" : " döviz birimi";
    // net yıllıklaştırılmış getiri (bilgi amaçlı)
    var netAnnualPct = (netInterest / P) * (365 / days) * 100;

    var cards =
      sumCard("Net faiz getirisi", fmt(netInterest) + unit, "Stopaj düşülmüş") +
      sumCard("Vade sonu bakiye", fmt(maturity) + unit, "Anapara + net faiz") +
      sumCard("Brüt faiz", fmt(grossInterest) + unit, days + " gün · %" + nf.format(ratePct) + " yıllık") +
      sumCard("Kesilen stopaj", "− " + fmt(tax) + unit, "%" + nf.format(taxPct) + " oranında") +
      sumCard("Net yıllık getiri", "%" + nf.format(netAnnualPct), "Yıllıklaştırılmış (bilgi amaçlı)");

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<p class="muted-note table-note">Faiz gün esaslı ve basit yöntemle hesaplanır (365 gün). Stopaj hesap türü ve takvim vadesinden belirlenmiştir.</p>';
  }

  ["in-principal", "in-rate", "in-days", "in-date", "in-type"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  var today = new Date();
  document.getElementById("in-date").value = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  recalc();
})();
