/* MTV Hesaplama 2026 — I ve II sayılı tarife (bağımlılıksız) */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR");
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function num(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(String(el.value).replace(/\./g, "").replace(",", ".")) : NaN;
  }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  var YEAR = 2026;

  // 2026 I sayılı tarife — otomobil. rows: değer kademesi × [1-3, 4-6, 7-11, 12-15, 16+]
  var OTO = [
    { label: "1300 cm³ ve altı",  tiers: [309100, 541500],
      rows: [[5750,4010,2238,1689,593],[6319,4409,2459,1861,655],[6902,4807,2693,2032,706]] },
    { label: "1301 – 1600 cm³",   tiers: [309100, 541500],
      rows: [[10016,7510,4354,3077,1181],[11023,8264,4794,3375,1290],[12028,9012,5220,3685,1408]] },
    { label: "1601 – 1800 cm³",   tiers: [775100],
      rows: [[19472,15226,8948,5458,2113],[21251,16600,9775,5964,2307]] },
    { label: "1801 – 2000 cm³",   tiers: [775100],
      rows: [[30679,23625,13886,8264,3248],[33474,25784,15147,9012,3547]] },
    { label: "2001 – 2500 cm³",   tiers: [968100],
      rows: [[46027,33413,20874,12465,4930],[50217,36448,22768,13606,5378]] },
    { label: "2501 – 3000 cm³",   tiers: [1937500],
      rows: [[64175,55837,34878,18758,6875],[70018,60905,38053,20466,7503]] },
    { label: "3001 – 3500 cm³",   tiers: [1937500],
      rows: [[97744,87954,52976,26443,9684],[106641,95940,57791,28839,10578]] },
    { label: "3501 – 4000 cm³",   tiers: [3101800],
      rows: [[153684,132712,78152,34878,13886],[167671,144770,85271,38053,15147]] },
    { label: "4001 cm³ ve üzeri", tiers: [3683200],
      rows: [[251554,188627,111714,50206,19472],[274415,205781,121873,54769,21251]] }
  ];

  // II sayılı tarife — motosiklet
  var MOTO = [
    { label: "100 – 250 cm³",     row: [1069, 799, 589, 362, 136] },
    { label: "251 – 650 cm³",     row: [2214, 1676, 1069, 589, 362] },
    { label: "651 – 1200 cm³",    row: [5719, 3398, 1676, 1069, 589] },
    { label: "1201 cm³ ve üzeri", row: [13876, 9167, 5719, 4540, 2214] }
  ];

  var AGE_LABELS = ["1 – 3 yaş", "4 – 6 yaş", "7 – 11 yaş", "12 – 15 yaş", "16 yaş ve üzeri"];
  function ageIndex(age) {
    if (age <= 3) return 0;
    if (age <= 6) return 1;
    if (age <= 11) return 2;
    if (age <= 15) return 3;
    return 4;
  }
  function tierIndex(group, deger) {
    var i = 0;
    while (i < group.tiers.length && deger >= group.tiers[i]) i++;
    return i;
  }

  function fillSelect(id, arr) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = arr.map(function (g, i) { return '<option value="' + i + '">' + g.label + "</option>"; }).join("");
  }
  fillSelect("oto-hacim", OTO);
  fillSelect("moto-hacim", MOTO);
  var oh = document.getElementById("oto-hacim"); if (oh) oh.value = "1";

  function rows(pairs) {
    var html = '<table class="bd-table"><tbody>';
    for (var i = 0; i < pairs.length; i++) {
      var cls = pairs[i][2] ? ' class="' + pairs[i][2] + '"' : '';
      html += '<tr' + cls + '><th scope="row">' + pairs[i][0] + '</th><td>' + pairs[i][1] + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  // Yıllara göre projeksiyon çubuğu (2026 tarifesi sabit varsayımıyla)
  function projection(getTax, modelYear) {
    var out = '<h3 class="proj-title">Gelecek yıllar projeksiyonu <span class="muted-inline">(2026 tarifesi sabit varsayımıyla)</span></h3><div class="proj">';
    var maxV = 0, items = [];
    for (var y = YEAR; y < YEAR + 8; y++) {
      var age = y - modelYear + 1;
      if (age < 1) continue;
      var v = getTax(age);
      items.push([y, age, v]);
      if (v > maxV) maxV = v;
    }
    items.forEach(function (it) {
      var pct = maxV > 0 ? Math.max(4, (it[2] / maxV) * 100) : 0;
      out += '<div class="proj-row"><span class="proj-year">' + it[0] + '</span>' +
        '<span class="proj-bar-wrap"><span class="proj-bar" style="width:' + pct.toFixed(1) + '%"></span></span>' +
        '<span class="proj-val">' + nf0.format(Math.round(it[2])) + ' TL</span></div>';
    });
    return out + "</div>";
  }

  function recalcOto() {
    var gi = parseInt(document.getElementById("oto-hacim").value, 10) || 0;
    var model = num("oto-model");
    var tescil = document.getElementById("oto-tescil").value;
    var isEV = document.getElementById("oto-ev").value === "ev";
    var deger = num("oto-deger");
    var degerWrap = document.getElementById("deger-wrap");
    if (degerWrap) degerWrap.style.display = tescil === "eski" ? "none" : "";
    if (isNaN(model) || model < 1950 || model > YEAR) { set("oto-out", ""); return; }

    var group = OTO[gi];
    var age = YEAR - model + 1;
    var ti = tescil === "eski" ? 0 : (isNaN(deger) ? 0 : tierIndex(group, deger));
    function taxAt(a) {
      var base = group.rows[ti][ageIndex(a)];
      return isEV ? base * 0.25 : base;
    }
    var mtv = taxAt(age);

    var r = [
      ["Motor hacmi", group.label],
      ["Araç yaşı (" + YEAR + ")", age + " yaş — " + AGE_LABELS[ageIndex(age)]],
      ["Değer kademesi", tescil === "eski" ? "Uygulanmaz (2018 öncesi tescil)" : (ti + 1) + ". kademe"]
    ];
    if (isEV) r.push(["Elektrikli araç indirimi", "Tarifenin %25'i uygulanır"]);
    r.push(["Yıllık MTV (" + YEAR + ")", fmt(mtv) + " TL", "bd-total"]);
    r.push(["1. taksit (Ocak)", fmt(mtv / 2) + " TL"]);
    r.push(["2. taksit (Temmuz)", fmt(mtv / 2) + " TL"]);
    set("oto-out", rows(r) + projection(taxAt, model));
  }

  function recalcMoto() {
    var gi = parseInt(document.getElementById("moto-hacim").value, 10) || 0;
    var model = num("moto-model");
    if (isNaN(model) || model < 1950 || model > YEAR) { set("moto-out", ""); return; }
    var group = MOTO[gi];
    var age = YEAR - model + 1;
    function taxAt(a) { return group.row[ageIndex(a)]; }
    var mtv = taxAt(age);
    var r = [
      ["Motor hacmi", group.label],
      ["Araç yaşı (" + YEAR + ")", age + " yaş — " + AGE_LABELS[ageIndex(age)]],
      ["Yıllık MTV (" + YEAR + ")", fmt(mtv) + " TL", "bd-total"],
      ["1. taksit (Ocak)", fmt(mtv / 2) + " TL"],
      ["2. taksit (Temmuz)", fmt(mtv / 2) + " TL"]
    ];
    set("moto-out", rows(r) + projection(taxAt, model));
  }

  function recalc() { recalcOto(); recalcMoto(); }
  ["oto-hacim", "oto-model", "oto-tescil", "oto-deger", "oto-ev", "moto-hacim", "moto-model"].forEach(function (id) {
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
