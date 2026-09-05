/* Kıdem ve İhbar Tazminatı — arayüz katmanı.
   Tazminat matematiği ve yasal parametreler ../bordro/cikis.js ve
   ../bordro/parametreler.js içindedir; bu dosya formu okur ve sonucu çizer.
   Kıdem tavanı, damga oranı ve ihbar kademeleri artık burada kopya durmuyor. */
(function () {
  "use strict";
  var C = window.BordroCikis;
  var B = window.Bordro;
  if (!C || !B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function num(id) {
    var e = el(id);
    if (!e) return 0;
    var v = parseFloat(String(e.value).replace(/\./g, "").replace(",", "."));
    return isNaN(v) ? 0 : v;
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label +
      '</span><strong class="sum-value">' + value +
      '</strong><span class="sum-note">' + note + "</span></div>";
  }

  /* Seçilen dilim "auto" ise motor çıkış ayının kümülatif matrahından türetir. */
  function seciliOran() {
    var e = el("in-bracket");
    if (!e || e.value === "auto") return null;
    var v = parseFloat(e.value);
    return isNaN(v) ? null : v;
  }

  function recalc() {
    var basla = el("in-start").value;
    var bitir = el("in-end").value;
    var results = el("results");
    var msg = el("msg");

    var gross = num("in-gross");
    var extras = num("in-extras");

    if (!basla || !bitir || gross + extras <= 0) {
      results.hidden = true; msg.hidden = true; return;
    }
    if (bitir <= basla) {
      results.hidden = true;
      msg.textContent = "İşten ayrılış tarihi, işe başlama tarihinden sonra olmalıdır.";
      msg.hidden = false;
      return;
    }

    var yil = Number(bitir.slice(0, 4));
    if (!B.parametreler[yil]) {
      results.hidden = true;
      msg.textContent = yil + " yılı için bordro parametreleri tanımlı değil. " +
        "Desteklenen yıllar: " + B.yillar().join(", ") + ".";
      msg.hidden = false;
      return;
    }
    msg.hidden = true;

    var istem = {
      iseGiris: basla,
      cikis: bitir,
      ciplakBrut: gross,
      giydirmeEkleri: extras,
      fesihTuru: "isveren",
      ihbarSuresiCalisildi: !el("in-ihbar").checked,
      kullanilmayanIzinGunu: 0,
      son3YilPrimGunu: 0            // bu araç işsizlik ödeneğini hesaplamaz
    };
    var manuel = seciliOran();
    if (manuel !== null) istem.marjinalOran = manuel;

    var r = C.hesapla(istem);
    var h = r.hizmet;
    var sureMetni = h.yil + " yıl " + h.ay + " ay " + h.gun + " gün";

    /* --- özet kartları --- */
    var cards =
      sumCard("Hizmet süresi", sureMetni, h.toplamGun + " gün") +
      (r.kidem.hak
        ? sumCard("Net kıdem tazminatı", fmt(r.kidem.net) + " TL", "Damga vergisi düşülmüş")
        : sumCard("Kıdem tazminatı", "Hesaplanamadı", r.kidem.gerekce)) +
      (r.ihbar.hak
        ? sumCard("Net ihbar tazminatı", fmt(r.ihbar.net) + " TL",
            r.ihbar.hafta + " haftalık ücret (" + (r.ihbar.hafta * 7) + " gün)")
        : "") +
      ((r.kidem.hak || r.ihbar.hak)
        ? sumCard("Toplam net ödeme", fmt(r.kidem.net + r.ihbar.net) + " TL", "Kıdem + ihbar")
        : "");
    el("summary").innerHTML = '<div class="sum-grid">' + cards + "</div>";

    /* --- detay tablosu --- */
    var rows = [];
    rows.push(["Giydirilmiş aylık brüt ücret", fmt(r.giydirilmisBrut) + " TL"]);
    if (r.kidem.hak) {
      rows.push(["Uygulanan kıdem tavanı", fmt(r.kidem.tavan) + " TL" +
        (r.kidem.tavanUygulandi ? " (tavan uygulandı)" : " (ücret tavanın altında)")]);
      rows.push(["Kıdeme esas yıllık tutar", fmt(r.kidem.esasUcret) + " TL"]);
      rows.push(["Brüt kıdem tazminatı", fmt(r.kidem.brut) + " TL"]);
      rows.push(["Kıdem damga vergisi (binde 7,59)", "− " + fmt(r.kidem.damga) + " TL"]);
      rows.push(["<strong>Net kıdem tazminatı</strong>", "<strong>" + fmt(r.kidem.net) + " TL</strong>"]);
    }
    if (r.ihbar.hak) {
      rows.push(["İhbar süresi", r.ihbar.hafta + " hafta (" + (r.ihbar.hafta * 7) + " gün)"]);
      rows.push(["Brüt ihbar tazminatı", fmt(r.ihbar.brut) + " TL"]);
      rows.push(["İhbar gelir vergisi (%" + Math.round(r.marjinalOran * 100) + ")" +
        (manuel === null ? " <span class=\"muted-note\">— çıkış ayına göre otomatik</span>" : ""),
        "− " + fmt(r.ihbar.gelirVergisi) + " TL"]);
      rows.push(["İhbar damga vergisi (binde 7,59)", "− " + fmt(r.ihbar.damga) + " TL"]);
      rows.push(["<strong>Net ihbar tazminatı</strong>", "<strong>" + fmt(r.ihbar.net) + " TL</strong>"]);
    }

    var html = '<div class="table-scroll"><table class="payroll detail">' +
      '<caption class="visually-hidden">Tazminat hesap dökümü</caption><tbody>';
    rows.forEach(function (x) { html += "<tr><th>" + x[0] + "</th><td>" + x[1] + "</td></tr>"; });
    html += "</tbody></table></div>" +
      '<p class="muted-note table-note">Kıdem tazminatı gelir vergisinden istisnadır; yalnızca damga vergisi kesilir. ' +
      "İhbar tazminatı ücret sayıldığı için ayrıca gelir vergisine tabidir.</p>" +
      (r.uyarilar.length ? '<p class="muted-note table-note"><strong>Dikkat:</strong> ' + r.uyarilar.join(" ") + "</p>" : "") +
      '<p class="muted-note table-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a>. ' +
      'Çıkışta doğan diğer alacakları da (yıllık izin, son ay ücreti, işsizlik maaşı) birlikte görmek için ' +
      '<a href="../isten-ayrilma-hesaplama/">İşten Ayrılma Paketi</a> aracını kullanın.</p>';
    el("detail").innerHTML = html;

    results.hidden = false;
  }

  /* ---------- Gün / ay / yıl seçicileri ---------- */
  var today = new Date();
  var MONTHS = B.AY_ADLARI;
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function fillSelect(e, items) {
    if (!e) return;
    e.innerHTML = items.map(function (it) {
      return '<option value="' + it[0] + '">' + it[1] + "</option>";
    }).join("");
  }

  function buildOptions(prefix) {
    var days = [], months = [], years = [];
    for (var d = 1; d <= 31; d++) days.push([d, d]);
    for (var m = 0; m < 12; m++) months.push([m + 1, MONTHS[m]]);
    for (var y = today.getFullYear(); y >= 1980; y--) years.push([y, y]);
    fillSelect(el(prefix + "-day"), days);
    fillSelect(el(prefix + "-month"), months);
    fillSelect(el(prefix + "-year"), years);
  }

  /* Seçili gün, o ay/yılda geçersizse (örn. 31 Şubat) en yakın geçerli güne çekilir */
  function clampDay(prefix) {
    var yEl = el(prefix + "-year"), mEl = el(prefix + "-month"), dEl = el(prefix + "-day");
    var maxDay = new Date(+yEl.value, +mEl.value, 0).getDate();
    if (+dEl.value > maxDay) dEl.value = maxDay;
  }

  function composeDate(prefix) {
    clampDay(prefix);
    el("in-" + (prefix === "start" ? "start" : "end")).value =
      el(prefix + "-year").value + "-" + pad(+el(prefix + "-month").value) + "-" + pad(+el(prefix + "-day").value);
  }

  function setTrio(prefix, dateObj) {
    el(prefix + "-day").value = dateObj.getDate();
    el(prefix + "-month").value = dateObj.getMonth() + 1;
    el(prefix + "-year").value = dateObj.getFullYear();
    composeDate(prefix);
  }

  buildOptions("start");
  buildOptions("end");

  /* Varsayılan tarihler: 3 yıl önce → bugün */
  var startDefault = new Date(today);
  startDefault.setFullYear(today.getFullYear() - 3);
  setTrio("start", startDefault);
  setTrio("end", today);

  ["start", "end"].forEach(function (prefix) {
    ["-day", "-month", "-year"].forEach(function (part) {
      var e = el(prefix + part);
      if (e) e.addEventListener("change", function () { composeDate(prefix); recalc(); });
    });
  });

  ["in-gross", "in-extras", "in-bracket", "in-ihbar"].forEach(function (id) {
    var e = el(id);
    if (e) { e.addEventListener("input", recalc); e.addEventListener("change", recalc); }
  });

  /* Rapor girdi özeti (yazdırma öncesi doldurulur) */
  window.buildReportInputs = function () {
    var e = el("report-inputs");
    if (!e) return;
    function tr(v) { return v ? new Date(v + "T00:00:00").toLocaleDateString("tr-TR") : "—"; }
    var tavan = C.kidemTavani(el("in-end").value);
    e.innerHTML = [
      "<strong>İşe başlama:</strong> " + tr(el("in-start").value),
      "<strong>İşten ayrılış:</strong> " + tr(el("in-end").value),
      "<strong>Son brüt maaş:</strong> " + fmt(num("in-gross")) + " TL",
      "<strong>Aylık ek ödemeler:</strong> " + fmt(num("in-extras")) + " TL",
      "<strong>Uygulanan tavan:</strong> " + (tavan === null ? "—" : fmt(tavan) + " TL")
    ].join(" &nbsp;·&nbsp; ");
  };

  recalc();
})();
