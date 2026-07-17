/* Kira Artışı Hesaplama — TÜFE yasal zam oranı (bağımlılıksız).
   Tüm hesaplama istemci tarafında yapılır. */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var pf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
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
    var type = document.getElementById("in-type").value;

    var rent = num("in-rent");
    var tufe = num("in-tufe");
    var agreed = num("in-agreed");

    if (isNaN(rent) || rent <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }

    // Uygulanacak oran: iş yerinde sözleşme oranı öncelikli; konutta TÜFE tavanı.
    var rate, rateNote;
    if (type === "isyeri" && !isNaN(agreed)) {
      rate = agreed;
      rateNote = "Sözleşmedeki artış oranı uygulandı";
    } else if (type === "konut" && !isNaN(agreed) && agreed < tufe) {
      rate = agreed;
      rateNote = "Sözleşme oranı TÜFE'nin altında olduğu için uygulandı";
    } else {
      rate = tufe;
      rateNote = type === "konut"
        ? "12 aylık TÜFE ortalaması — yasal azami"
        : "Sözleşme oranı girilmediği için TÜFE uygulandı";
    }

    if (isNaN(rate)) {
      results.innerHTML = "";
      msg.textContent = "Lütfen geçerli bir TÜFE/artış oranı girin.";
      msg.hidden = false;
      return;
    }
    msg.hidden = true;

    var newRent = rent * (1 + rate / 100);
    var monthlyDiff = newRent - rent;
    var yearlyDiff = monthlyDiff * 12;

    var cards =
      sumCard("Yeni aylık kira", fmt(newRent) + " TL", "%" + pf.format(rate) + " artışla") +
      sumCard("Aylık artış farkı", "+ " + fmt(monthlyDiff) + " TL", rateNote) +
      sumCard("Yıllık toplam fark", "+ " + fmt(yearlyDiff) + " TL", "12 ay üzerinden") +
      sumCard("Uygulanan oran", "%" + pf.format(rate), type === "konut" ? "Konut kirası" : "İş yeri kirası");

    var warn = "";
    if (type === "konut" && !isNaN(tufe) && rate > tufe) {
      warn = '<p class="muted-note table-note">⚠ Girilen oran 12 aylık TÜFE ortalamasını aşıyor; konut kirasında yasal olarak TÜFE üstü artış yapılamaz.</p>';
    }

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" + warn;
  }

  // İş yeri seçilince sözleşme oranı alanını göster
  var typeEl = document.getElementById("in-type");
  var agreedWrap = document.getElementById("agreed-wrap");
  function syncType() {
    if (agreedWrap) agreedWrap.hidden = false; // her iki türde de kullanılabilir
    recalc();
  }
  if (typeEl) typeEl.addEventListener("change", syncType);

  ["in-rent", "in-tufe", "in-agreed", "in-type"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  agreedWrap.hidden = false;
  recalc();
})();
