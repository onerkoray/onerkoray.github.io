/* İşsizlik Maaşı Hesaplama — 2026 parametreleri (bağımlılıksız).
   Aylık ödenek = son 4 ay brüt ortalaması × %40, tavan: brüt asgari ücret × %80.
   Yalnızca damga vergisi (binde 7,59) kesilir. Tüm hesaplama istemci tarafında. */
(function () {
  "use strict";

  /* ---------- 2026 yasal parametreleri ---------- */
  var MIN_GROSS = 33030.00;      // aylık brüt asgari ücret 2026
  var SGK_CEILING = 297270.00;   // aylık SGK prim (PEK) tavanı
  var RATE = 0.40;               // ödenek oranı
  var CAP_RATE = 0.80;           // tavan: asgari ücretin %80'i
  var STAMP = 0.00759;           // damga vergisi

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

  function monthsForDays(days) {
    if (days >= 1080) return 10;
    if (days >= 900) return 8;
    if (days >= 600) return 6;
    return 0;
  }

  function recalc() {
    var results = document.getElementById("results");
    var msg = document.getElementById("msg");

    var avg = num("in-avg");
    var days = parseInt(document.getElementById("in-days").value, 10);

    if (isNaN(avg) || avg <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }
    msg.hidden = true;

    var months = monthsForDays(days);
    if (months === 0) {
      results.innerHTML = "";
      msg.textContent = "Son 3 yılda en az 600 gün prim ödenmemişse işsizlik ödeneğine hak kazanılmaz.";
      msg.hidden = false; return;
    }

    // Prime esas kazanç tavanla sınırlıdır
    var pek = Math.min(avg, SGK_CEILING);
    var raw = pek * RATE;                       // %40
    var cap = MIN_GROSS * CAP_RATE;             // tavan
    var gross = Math.min(raw, cap);
    var capped = raw > cap;
    var stamp = gross * STAMP;
    var net = gross - stamp;
    var total = net * months;

    var cards =
      sumCard("Net aylık ödenek", fmt(net) + " TL", "Damga vergisi düşülmüş") +
      sumCard("Ödeme süresi", months + " ay", days + " gün prim") +
      sumCard("Toplam net ödeme", fmt(total) + " TL", months + " ay boyunca") +
      sumCard("Brüt aylık ödenek", fmt(gross) + " TL", capped ? "Tavan uygulandı (asgari × %80)" : "Kazancın %40'ı");

    var rows =
      "<tr><th>Hesaba esas kazanç (%40 öncesi)</th><td>" + fmt(pek) + " TL" +
        (avg > SGK_CEILING ? " (SGK tavanı uygulandı)" : "") + "</td></tr>" +
      "<tr><th>Kazancın %40'ı</th><td>" + fmt(raw) + " TL</td></tr>" +
      "<tr><th>Ödenek tavanı (asgari × %80)</th><td>" + fmt(cap) + " TL</td></tr>" +
      "<tr><th>Brüt aylık ödenek</th><td>" + fmt(gross) + " TL</td></tr>" +
      "<tr><th>Damga vergisi (binde 7,59)</th><td>− " + fmt(stamp) + " TL</td></tr>" +
      "<tr><th><strong>Net aylık ödenek</strong></th><td><strong>" + fmt(net) + " TL</strong></td></tr>";

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<div class="table-scroll"><table class="payroll detail"><caption class="visually-hidden">İşsizlik ödeneği dökümü</caption><tbody>' +
      rows + "</tbody></table></div>" +
      '<p class="muted-note table-note">Ödenekten gelir vergisi ve SGK primi kesilmez. Tutar bilgilendirme amaçlıdır; kesin hesap İŞKUR tarafından yapılır.</p>';
  }

  ["in-avg", "in-days"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  recalc();
})();
