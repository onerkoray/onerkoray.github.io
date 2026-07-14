/* Son Depremler — Kandilli verisini çeker ve listeler (bağımlılıksız) */
(function () {
  "use strict";

  var API = "https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=100";

  var els = {
    list: document.getElementById("list"),
    status: document.getElementById("status"),
    refresh: document.getElementById("refreshBtn"),
    chips: Array.prototype.slice.call(document.querySelectorAll(".chip"))
  };

  var state = { quakes: [], minMag: 0 };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function magClass(m) {
    if (m >= 5) return "mag-x";
    if (m >= 4) return "mag-l";
    if (m >= 3) return "mag-m";
    return "mag-s";
  }

  function relTime(date) {
    if (!(date instanceof Date) || isNaN(date)) return "";
    var diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 0) diff = 0;
    if (diff < 60) return "az önce";
    if (diff < 3600) return Math.floor(diff / 60) + " dk önce";
    if (diff < 86400) return Math.floor(diff / 3600) + " sa önce";
    return Math.floor(diff / 86400) + " gün önce";
  }

  function fmtDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return "";
    try {
      return new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit"
      }).format(date);
    } catch (e) { return date.toLocaleString("tr-TR"); }
  }

  function parseQuake(item) {
    var coords = (item.geojson && item.geojson.coordinates) || [];
    var lng = coords[0], lat = coords[1];
    var dateStr = item.date_time || item.date || "";
    // "2024-05-01 10:20:30" veya "2024.05.01 10:20:30"
    var iso = String(dateStr).replace(/\./g, "-").replace(" ", "T");
    var date = new Date(iso);
    return {
      mag: parseFloat(item.mag),
      depth: parseFloat(item.depth),
      title: item.title || (item.location_properties && item.location_properties.epiCenter && item.location_properties.epiCenter.name) || "Bilinmiyor",
      lat: lat, lng: lng, date: date
    };
  }

  function render() {
    var items = state.quakes.filter(function (q) { return isFinite(q.mag) && q.mag >= state.minMag; });
    if (!items.length) {
      els.list.innerHTML = "";
      els.status.textContent = "Seçilen büyüklükte kayıt bulunamadı.";
      return;
    }
    els.status.textContent = items.length + " deprem listeleniyor · Son güncelleme: " + fmtDate(new Date());
    els.list.innerHTML = items.map(function (q) {
      var map = (isFinite(q.lat) && isFinite(q.lng))
        ? '<a class="quake-map" href="https://www.google.com/maps?q=' + q.lat + ',' + q.lng + '" rel="noopener" target="_blank">Haritada gör</a>'
        : "";
      var depth = isFinite(q.depth) ? esc(q.depth) + " km derinlik" : "";
      var meta = [fmtDate(q.date), relTime(q.date), depth].filter(Boolean).join(" · ");
      return '<li class="quake-item">' +
        '<span class="mag ' + magClass(q.mag) + '" aria-label="Büyüklük ' + esc(q.mag.toFixed(1)) + '">' + esc(q.mag.toFixed(1)) + '</span>' +
        '<div class="quake-info"><p class="quake-place">' + esc(q.title) + '</p><p class="quake-meta">' + esc(meta) + '</p></div>' +
        map + '</li>';
    }).join("");
  }

  function showError() {
    els.list.innerHTML = "";
    els.status.innerHTML = '<span class="quake-error">Deprem verisi şu anda alınamadı. Lütfen birazdan “Yenile”yi deneyin ya da ' +
      '<a href="https://deprem.afad.gov.tr/last-earthquakes.html" rel="noopener">AFAD</a> / ' +
      '<a href="http://www.koeri.boun.edu.tr/scripts/lst0.asp" rel="noopener">Kandilli</a> sayfalarını ziyaret edin.</span>';
  }

  function load() {
    els.status.textContent = "Depremler yükleniyor…";
    els.refresh.disabled = true;
    fetch(API, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) {
        var arr = (data && data.result) || [];
        state.quakes = arr.map(parseQuake).filter(function (q) { return isFinite(q.mag); });
        if (!state.quakes.length) throw new Error("empty");
        render();
      })
      .catch(function () { showError(); })
      .then(function () { els.refresh.disabled = false; });
  }

  els.refresh.addEventListener("click", load);
  els.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      els.chips.forEach(function (c) { c.classList.remove("is-active"); });
      chip.classList.add("is-active");
      state.minMag = parseFloat(chip.getAttribute("data-min")) || 0;
      render();
    });
  });

  load();
})();
