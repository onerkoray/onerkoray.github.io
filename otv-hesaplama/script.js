/* Araç ÖTV Hesaplama — ÖTV + KDV + anahtar teslim + vergi yükü analizi (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(String(el.value).replace(/\./g, "").replace(",", ".")) : NaN;
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  var KDV = 0.20;

  // Dilimler: [eşikler...], [oranlar...] — matrah eşiği aşınca TÜM matraha üst oran uygulanır
  var ICTEN = {
    1400: { t: [650000, 900000, 1100000], r: [70, 75, 80, 90] },
    1600: { t: [850000, 1100000, 1650000], r: [75, 80, 90, 100] },
    2000: { t: [1650000], r: [150, 170] },
    9999: { t: [], r: [220] }
  };
  var EV = {
    160: { t: [1650000], r: [25, 55] },
    999: { t: [1650000], r: [65, 75] }
  };
  var HEV  = { t: [1250000], r: [70, 80] };
  var PHEV = { t: [1350000], r: [45, 75] };

  function pickRate(bracket, matrah) {
    var i = 0;
    while (i < bracket.t.length && matrah > bracket.t[i]) i++;
    return bracket.r[i];
  }

  function bracketFor() {
    var tip = document.getElementById("otv-tip").value;
    if (tip === "ev") return EV[document.getElementById("otv-kw").value] || EV[160];
    if (tip === "hev") return HEV;
    if (tip === "phev") return PHEV;
    return ICTEN[document.getElementById("otv-hacim").value] || ICTEN[1400];
  }

  function rows(pairs) {
    var html = '<table class="bd-table"><tbody>';
    for (var i = 0; i < pairs.length; i++) {
      var cls = pairs[i][2] ? ' class="' + pairs[i][2] + '"' : '';
      html += '<tr' + cls + '><th scope="row">' + pairs[i][0] + '</th><td>' + pairs[i][1] + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  // Yığılmış çubuk: matrah / ÖTV / KDV payları
  function stackBar(matrah, otv, kdv) {
    var total = matrah + otv + kdv;
    if (!(total > 0)) return "";
    function seg(v, cls, label) {
      var p = (v / total) * 100;
      return '<span class="seg ' + cls + '" style="width:' + p.toFixed(2) + '%" title="' + label + ': ' + fmt(v) + ' TL (%' + p.toFixed(1) + ')"></span>';
    }
    var taxPct = ((otv + kdv) / total) * 100;
    return '<h3 class="proj-title">Fiyatın bileşimi <span class="muted-inline">— vergi yükü %' + taxPct.toFixed(1) + '</span></h3>' +
      '<div class="stack">' + seg(matrah, "seg-matrah", "Araç bedeli") + seg(otv, "seg-otv", "ÖTV") + seg(kdv, "seg-kdv", "KDV") + '</div>' +
      '<div class="stack-legend">' +
      '<span><i class="dot seg-matrah"></i>Araç bedeli %' + ((matrah / total) * 100).toFixed(1) + '</span>' +
      '<span><i class="dot seg-otv"></i>ÖTV %' + ((otv / total) * 100).toFixed(1) + '</span>' +
      '<span><i class="dot seg-kdv"></i>KDV %' + ((kdv / total) * 100).toFixed(1) + '</span>' +
      '</div>';
  }

  // Dilim sınırı uyarısı: matrah bir alt dilime çekilse ne kazanılır?
  function edgeHint(bracket, matrah) {
    var i = 0;
    while (i < bracket.t.length && matrah > bracket.t[i]) i++;
    if (i === 0) return "";
    var edge = bracket.t[i - 1];
    if (matrah > edge * 1.10) return ""; // sınıra %10'dan uzaksa gösterme
    var nowRate = bracket.r[i] / 100, edgeRate = bracket.r[i - 1] / 100;
    var nowTotal = matrah * (1 + nowRate) * (1 + KDV);
    var edgeTotal = edge * (1 + edgeRate) * (1 + KDV);
    if (edgeTotal >= nowTotal) return "";
    return '<p class="edge-hint">💡 Matrah ' + fmt(edge) + ' TL\'ye (bir alt dilime) inseydi anahtar teslim fiyat ' +
      fmt(edgeTotal) + ' TL olurdu — <strong>' + fmt(nowTotal - edgeTotal) + ' TL fark</strong>. Dilim sınırları kademeli değildir.</p>';
  }

  function recalc() {
    var tip = document.getElementById("otv-tip").value;
    var hacimWrap = document.getElementById("hacim-wrap");
    var kwWrap = document.getElementById("kw-wrap");
    if (hacimWrap) hacimWrap.hidden = (tip === "ev");
    if (kwWrap) kwWrap.hidden = (tip !== "ev");

    var matrah = num("otv-matrah");
    if (isNaN(matrah) || matrah <= 0) { set("otv-out", ""); return; }

    var bracket = bracketFor();
    var rate = pickRate(bracket, matrah);
    var otv = matrah * rate / 100;
    var araBedel = matrah + otv;
    var kdv = araBedel * KDV;
    var toplam = araBedel + kdv;

    var r = [
      ["ÖTV matrahı (vergisiz fiyat)", fmt(matrah) + " TL"],
      ["ÖTV dilimi", "%" + rate],
      ["ÖTV tutarı", fmt(otv) + " TL"],
      ["KDV (%20, ÖTV dahil tutar üzerinden)", fmt(kdv) + " TL"],
      ["Anahtar teslim fiyat", fmt(toplam) + " TL", "bd-total"],
      ["Toplam vergi (ÖTV + KDV)", fmt(otv + kdv) + " TL"]
    ];
    set("otv-out", rows(r) + stackBar(matrah, otv, kdv) + edgeHint(bracket, matrah));
  }

  ["otv-tip", "otv-hacim", "otv-kw", "otv-matrah"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
  });

  recalc();
})();
