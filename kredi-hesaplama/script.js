/* Kredi Hesaplama — eşit taksitli (annüite) kredi, ödeme planı (bağımlılıksız).
   Tüm hesaplama istemci tarafında yapılır. */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }

  function num(id) {
    var el = document.getElementById(id);
    if (!el) return NaN;
    var raw = String(el.value).trim();
    if (raw === "") return NaN;
    return parseFloat(raw.replace(/\./g, "").replace(",", "."));
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label +
      '</span><strong class="sum-value">' + value +
      '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function recalc() {
    var results = document.getElementById("results");
    var msg = document.getElementById("msg");

    var A = num("in-amount");
    var ratePct = num("in-rate");
    var n = Math.round(num("in-term"));

    if (isNaN(A) || A <= 0 || isNaN(ratePct) || isNaN(n) || n <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }
    if (n > 600) {
      results.innerHTML = "";
      msg.textContent = "Vade en fazla 600 ay olabilir.";
      msg.hidden = false; return;
    }
    msg.hidden = true;

    var r = ratePct / 100;
    var payment = r === 0 ? A / n : (A * r) / (1 - Math.pow(1 + r, -n));
    var total = payment * n;
    var totalInterest = total - A;

    var cards =
      sumCard("Aylık taksit", fmt(payment) + " TL", n + " ay boyunca eşit") +
      sumCard("Toplam geri ödeme", fmt(total) + " TL", "Anapara + faiz") +
      sumCard("Toplam faiz", fmt(totalInterest) + " TL", "Vade boyunca ödenen") +
      sumCard("Anapara", fmt(A) + " TL", "%" + nf.format(ratePct) + " aylık faiz");

    // Ödeme planı (amortisman) tablosu
    var rows = "";
    var balance = A;
    for (var m = 1; m <= n; m++) {
      var interest = balance * r;
      var principal = payment - interest;
      balance = Math.max(0, balance - principal);
      rows += "<tr><td>" + m + "</td><td>" + fmt(payment) + "</td><td>" + fmt(principal) +
        "</td><td>" + fmt(interest) + "</td><td>" + fmt(balance) + "</td></tr>";
    }

    var table =
      '<details class="plan"><summary>Ödeme planını göster (' + n + ' taksit)</summary>' +
      '<div class="table-scroll"><table class="payroll detail"><thead><tr>' +
      '<th>Ay</th><th>Taksit</th><th>Anapara</th><th>Faiz</th><th>Kalan</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></details>';

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" + table;
  }

  ["in-amount", "in-rate", "in-term"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  recalc();
})();
