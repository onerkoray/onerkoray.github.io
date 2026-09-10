/* Gümrük Vergisi Hesaplama — Şubat 2026 sonrası kurallar (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? Finans.sayi(el.value, el.type === "number") : NaN;
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  var IMEI_HARC = 54258; // 2026 kullanım izin harcı

  function rows(pairs) {
    var html = '<table class="bd-table"><tbody>';
    for (var i = 0; i < pairs.length; i++) {
      var cls = pairs[i][2] ? ' class="' + pairs[i][2] + '"' : '';
      html += '<tr' + cls + '><th scope="row">' + pairs[i][0] + '</th><td>' + pairs[i][1] + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  function stackBar(parts, totalLabel) {
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i][0];
    if (!(total > 0)) return "";
    var html = '<h3 class="proj-title">' + totalLabel + '</h3><div class="stack">';
    var legend = '<div class="stack-legend">';
    var classes = ["seg-matrah", "seg-otv", "seg-kdv"];
    for (i = 0; i < parts.length; i++) {
      var p = (parts[i][0] / total) * 100;
      html += '<span class="seg ' + classes[i % 3] + '" style="width:' + p.toFixed(2) + '%" title="' + parts[i][1] + '"></span>';
      legend += '<span><i class="dot ' + classes[i % 3] + '"></i>' + parts[i][1] + ' %' + p.toFixed(1) + '</span>';
    }
    return html + '</div>' + legend + '</div>';
  }

  function toTL(amountId, unitId, kurId, kurWrapId) {
    var bedel = num(amountId);
    var birim = document.getElementById(unitId).value;
    var kurWrap = document.getElementById(kurWrapId);
    if (kurWrap) kurWrap.style.display = birim === "try" ? "none" : "";
    if (isNaN(bedel) || bedel <= 0) return NaN;
    if (birim === "try") return bedel;
    var kur = num(kurId);
    if (isNaN(kur) || kur <= 0) return NaN;
    return bedel * kur;
  }

  function recalcSiparis() {
    var tl = toTL("g-bedel", "g-birim", "g-kur", "kur-wrap");
    var shipping = num("g-shipping"), taxes = num("g-taxes"), fees = num("g-fees");
    try {
      var total = Finans.ithalat(tl, 1, shipping, taxes, fees);
      set("g-out", rows([["Ürün bedeli (TL)", fmt(tl)], ["Kargo ve sigorta", fmt(shipping)], ["Bildirilen vergiler", fmt(taxes)], ["Diğer ücretler", fmt(fees)], ["Girilen tutarlara göre toplam (TL)", fmt(total), "bd-total"]]));
    } catch (err) {
      set("g-out", '<p class="muted-note">Toplam için ürün, kur ve tüm masraf alanlarını geçerli tutarlarla doldurun. Olmayan masraf için 0 girin; bilinmeyen vergiye 0 yazmayın.</p>');
    }
  }

  function recalcTelefon() {
    var tl = toTL("t-fiyat", "t-birim", "t-kur", "t-kur-wrap");
    if (isNaN(tl)) { set("t-out", ""); return; }
    var toplam = tl + IMEI_HARC;
    var trFiyat = num("t-tr");

    var r = [
      ["Telefonun yurt dışı fiyatı", fmt(tl) + " TL"],
      ["IMEI kayıt harcı (2026)", fmt(IMEI_HARC) + " TL"],
      ["Cihaz + IMEI harcı", fmt(toplam) + " TL", "bd-total"]
    ];
    if (!isNaN(trFiyat) && trFiyat > 0) {
      var fark = trFiyat - toplam;
      r.push(["Türkiye satış fiyatı", fmt(trFiyat) + " TL"]);
      r.push([fark >= 0 ? "Girilen Türkiye fiyatından düşük" : "Girilen Türkiye fiyatından yüksek", fmt(Math.abs(fark)) + " TL", "bd-total"]);
    }
    set("t-out", rows(r) + stackBar([[tl, "Telefon bedeli"], [IMEI_HARC, "IMEI harcı"]], "Maliyetin bileşimi"));
  }

  function recalc() { recalcSiparis(); recalcTelefon(); }
  ["g-bedel", "g-birim", "g-kur", "g-shipping", "g-taxes", "g-fees", "t-fiyat", "t-birim", "t-kur", "t-tr"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  // Sekmeler
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var sel = t === tab;
      t.setAttribute("aria-selected", String(sel));
      t.tabIndex = sel ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sel;
    });
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
