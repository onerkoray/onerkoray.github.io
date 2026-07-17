/* Hesap Bölüşme (AA) — kişi başı tutar, bahşiş, kuruş farkı (bağımlılıksız).
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
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
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

    var total = num("in-total");
    var people = Math.round(num("in-people"));
    var tipPct = num("in-tip");
    if (isNaN(tipPct)) tipPct = 0;

    if (isNaN(total) || total <= 0 || isNaN(people)) {
      results.innerHTML = ""; msg.hidden = true; return;
    }
    if (people <= 0) {
      results.innerHTML = "";
      msg.textContent = "Kişi sayısı en az 1 olmalıdır.";
      msg.hidden = false; return;
    }
    msg.hidden = true;

    var tipAmount = total * (tipPct / 100);
    var grand = total + tipAmount;

    // Kuruş bazında adil dağıtım
    var totalCents = Math.round(grand * 100);
    var baseCents = Math.floor(totalCents / people);
    var extra = totalCents - baseCents * people; // kaç kişi 1 kuruş fazla öder
    var lowShare = baseCents / 100;
    var highShare = (baseCents + 1) / 100;

    var perNote = extra === 0
      ? "Herkes eşit öder"
      : extra + " kişi " + fmt(highShare) + " TL, " + (people - extra) + " kişi " + fmt(lowShare) + " TL";

    var cards =
      sumCard("Kişi başı", fmt(highShare === lowShare ? lowShare : highShare) + " TL", perNote) +
      sumCard("Bahşiş dahil toplam", fmt(grand) + " TL", people + " kişi") +
      (tipPct > 0
        ? sumCard("Bahşiş tutarı", fmt(tipAmount) + " TL", "%" + nf.format(tipPct) + " bahşiş")
        : sumCard("Hesap tutarı", fmt(total) + " TL", "Bahşiş yok"));

    var extraNote = extra === 0
      ? ""
      : '<p class="muted-note table-note">Tutar kişi sayısına tam bölünmediği için ' + extra +
        " kişinin 1 kuruş fazla ödemesiyle toplam korunur.</p>";

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" + extraNote;
  }

  ["in-total", "in-people", "in-tip"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  recalc();
})();
