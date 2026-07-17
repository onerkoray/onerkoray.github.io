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
    return parseFloat(raw);
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label +
      '</span><strong class="sum-value">' + value +
      '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function recalc() {
    var results = document.getElementById("results");
    var msg = document.getElementById("msg");

    var P = num("in-principal");
    var ratePct = num("in-rate");
    var days = Math.round(num("in-days"));
    var taxPct = parseFloat(document.getElementById("in-tax").value);

    if (isNaN(P) || P <= 0 || isNaN(ratePct) || isNaN(days) || days <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }
    if (days > 3650) {
      results.innerHTML = "";
      msg.textContent = "Vade en fazla 3650 gün (10 yıl) olabilir.";
      msg.hidden = false; return;
    }
    msg.hidden = true;

    var grossInterest = P * (ratePct / 100) * (days / 365);
    var tax = grossInterest * (taxPct / 100);
    var netInterest = grossInterest - tax;
    var maturity = P + netInterest;
    // net yıllıklaştırılmış getiri (bilgi amaçlı)
    var netAnnualPct = (netInterest / P) * (365 / days) * 100;

    var cards =
      sumCard("Net faiz getirisi", fmt(netInterest) + " TL", "Stopaj düşülmüş") +
      sumCard("Vade sonu bakiye", fmt(maturity) + " TL", "Anapara + net faiz") +
      sumCard("Brüt faiz", fmt(grossInterest) + " TL", days + " gün · %" + nf.format(ratePct) + " yıllık") +
      sumCard("Kesilen stopaj", "− " + fmt(tax) + " TL", "%" + nf.format(taxPct) + " oranında") +
      sumCard("Net yıllık getiri", "%" + nf.format(netAnnualPct), "Yıllıklaştırılmış (bilgi amaçlı)");

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<p class="muted-note table-note">Faiz gün esaslı ve basit yöntemle hesaplanır (365 gün). Stopaj oranını vadenize göre seçtiğinizden emin olun.</p>';
  }

  ["in-principal", "in-rate", "in-days", "in-tax"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  recalc();
})();
