/* Birim Çevirici — uzunluk, ağırlık, sıcaklık, alan, hacim, hız, veri, zaman (bağımlılıksız).
   Tüm hesaplama istemci tarafında yapılır. */
(function () {
  "use strict";

  // Her kategori: base birime çarpan (sıcaklık özel — fonksiyonlarla).
  var DATA = {
    uzunluk: {
      label: "Uzunluk",
      units: [
        ["mm", "Milimetre (mm)", 0.001], ["cm", "Santimetre (cm)", 0.01],
        ["m", "Metre (m)", 1], ["km", "Kilometre (km)", 1000],
        ["inch", "İnç (in)", 0.0254], ["ft", "Ayak (ft)", 0.3048],
        ["yd", "Yarda (yd)", 0.9144], ["mil", "Mil (mi)", 1609.344],
        ["nmi", "Deniz mili", 1852]
      ]
    },
    agirlik: {
      label: "Ağırlık / Kütle",
      units: [
        ["mg", "Miligram (mg)", 0.001], ["g", "Gram (g)", 1],
        ["kg", "Kilogram (kg)", 1000], ["ton", "Ton (t)", 1e6],
        ["oz", "Ons (oz)", 28.349523125], ["lb", "Libre (lb)", 453.59237]
      ]
    },
    sicaklik: {
      label: "Sıcaklık",
      temp: true,
      units: [["C", "Celsius (°C)"], ["F", "Fahrenheit (°F)"], ["K", "Kelvin (K)"]]
    },
    alan: {
      label: "Alan",
      units: [
        ["mm2", "Milimetrekare (mm²)", 1e-6], ["cm2", "Santimetrekare (cm²)", 1e-4],
        ["m2", "Metrekare (m²)", 1], ["dekar", "Dekar / dönüm", 1000],
        ["hektar", "Hektar (ha)", 10000], ["km2", "Kilometrekare (km²)", 1e6],
        ["ft2", "Ayakkare (ft²)", 0.09290304], ["acre", "Akre", 4046.8564224]
      ]
    },
    hacim: {
      label: "Hacim",
      units: [
        ["ml", "Mililitre (ml)", 0.001], ["cl", "Santilitre (cl)", 0.01],
        ["l", "Litre (l)", 1], ["m3", "Metreküp (m³)", 1000],
        ["galon", "Galon (ABD)", 3.785411784], ["galonuk", "Galon (İng)", 4.54609]
      ]
    },
    hiz: {
      label: "Hız",
      units: [
        ["ms", "Metre/saniye (m/s)", 1], ["kmh", "Kilometre/saat (km/s)", 0.2777777778],
        ["mph", "Mil/saat (mph)", 0.44704], ["knot", "Knot (deniz mili/s)", 0.5144444444],
        ["fts", "Ayak/saniye (ft/s)", 0.3048]
      ]
    },
    veri: {
      label: "Veri (ikili)",
      units: [
        ["bit", "Bit", 0.125], ["byte", "Bayt", 1],
        ["kb", "Kilobayt (KB)", 1024], ["mb", "Megabayt (MB)", 1048576],
        ["gb", "Gigabayt (GB)", 1073741824], ["tb", "Terabayt (TB)", 1099511627776]
      ]
    },
    zaman: {
      label: "Zaman",
      units: [
        ["s", "Saniye", 1], ["dk", "Dakika", 60], ["saat", "Saat", 3600],
        ["gun", "Gün", 86400], ["hafta", "Hafta", 604800],
        ["ay", "Ay (30 gün)", 2592000], ["yil", "Yıl (365 gün)", 31536000]
      ]
    }
  };

  var CAT_ORDER = ["uzunluk", "agirlik", "sicaklik", "alan", "hacim", "hiz", "veri", "zaman"];

  var out = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 });
  function fmt(n) {
    if (!isFinite(n)) return "—";
    return out.format(Math.abs(n) < 1e-9 ? 0 : n);
  }

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

  function tempConvert(v, from, to) {
    var c; // önce Celsius'a
    if (from === "C") c = v;
    else if (from === "F") c = (v - 32) * 5 / 9;
    else c = v - 273.15; // K
    if (to === "C") return c;
    if (to === "F") return c * 9 / 5 + 32;
    return c + 273.15; // K
  }

  function unitLabel(cat, code) {
    var u = DATA[cat].units;
    for (var i = 0; i < u.length; i++) if (u[i][0] === code) return u[i][1];
    return code;
  }
  function unitFactor(cat, code) {
    var u = DATA[cat].units;
    for (var i = 0; i < u.length; i++) if (u[i][0] === code) return u[i][2];
    return 1;
  }

  function fillUnits() {
    var cat = document.getElementById("in-category").value;
    var units = DATA[cat].units;
    var opts = units.map(function (u) { return '<option value="' + u[0] + '">' + u[1] + "</option>"; }).join("");
    var fromEl = document.getElementById("in-from");
    var toEl = document.getElementById("in-to");
    fromEl.innerHTML = opts;
    toEl.innerHTML = opts;
    fromEl.selectedIndex = 0;
    toEl.selectedIndex = Math.min(1, units.length - 1);
  }

  function recalc() {
    var results = document.getElementById("results");
    var cat = document.getElementById("in-category").value;
    var from = document.getElementById("in-from").value;
    var to = document.getElementById("in-to").value;
    var v = num("in-value");

    if (isNaN(v)) { results.innerHTML = ""; return; }

    var result;
    if (DATA[cat].temp) result = tempConvert(v, from, to);
    else result = v * unitFactor(cat, from) / unitFactor(cat, to);

    // 1 birimlik oran (bilgi)
    var one;
    if (DATA[cat].temp) one = null;
    else one = unitFactor(cat, from) / unitFactor(cat, to);

    var big =
      '<div class="convert-result">' +
      '<div class="cr-in">' + fmt(v) + ' <span>' + unitLabel(cat, from) + "</span></div>" +
      '<div class="cr-eq" aria-hidden="true">=</div>' +
      '<div class="cr-out">' + fmt(result) + ' <span>' + unitLabel(cat, to) + "</span></div>" +
      "</div>";

    var note = one !== null
      ? '<p class="muted-note table-note">1 ' + shortName(cat, from) + " = " + fmt(one) + " " + shortName(cat, to) + "</p>"
      : "";

    results.innerHTML = big + note;
  }

  function shortName(cat, code) {
    var full = unitLabel(cat, code);
    var m = full.match(/\(([^)]+)\)/);
    return m ? m[1] : full;
  }

  function bind() {
    var catEl = document.getElementById("in-category");
    catEl.innerHTML = CAT_ORDER.map(function (c) {
      return '<option value="' + c + '">' + DATA[c].label + "</option>";
    }).join("");

    catEl.addEventListener("change", function () { fillUnits(); recalc(); });
    ["in-value", "in-from", "in-to"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", recalc); el.addEventListener("change", recalc); }
    });

    document.getElementById("swap").addEventListener("click", function () {
      var f = document.getElementById("in-from");
      var t = document.getElementById("in-to");
      var tmp = f.value; f.value = t.value; t.value = tmp;
      recalc();
    });

    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();

    fillUnits();
    recalc();
  }

  bind();
})();
