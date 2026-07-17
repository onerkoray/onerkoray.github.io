/* Son Depremler — Kandilli verisini çeker ve listeler (bağımlılıksız) */
(function () {
  "use strict";

  var API = "https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=100";
  /* USGS FDSN arşivi — Türkiye ve çevresi (bbox), tarihe göre geçmiş sorgu */
  var USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time" +
    "&minlatitude=35&maxlatitude=43&minlongitude=25&maxlongitude=45&minmagnitude=1.5";

  var els = {
    list: document.getElementById("list"),
    status: document.getElementById("status"),
    refresh: document.getElementById("refreshBtn"),
    chart: document.getElementById("chart"),
    dateForm: document.getElementById("dateForm"),
    qdate: document.getElementById("qdate"),
    liveBtn: document.getElementById("liveBtn"),
    chips: Array.prototype.slice.call(document.querySelectorAll(".chip"))
  };

  var state = { quakes: [], minMag: 0, mode: "live" };

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

  /* Son 5 deprem — her biri farklı renkte SVG çubuk diyagramı */
  var CHART_COLORS = ["#2563b8", "#0e9f6e", "#e8a020", "#d95d39", "#8a5cd6"];
  function renderChart() {
    if (!els.chart) return;
    var last5 = state.quakes.slice(0, 5);
    if (last5.length < 2) { els.chart.innerHTML = ""; return; }
    var W = 560, H = 230, base = 168, bw = 72, gap = (W - last5.length * bw) / (last5.length + 1);
    var maxMag = Math.max.apply(null, last5.map(function (q) { return q.mag; }));
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Son 5 depremin büyüklük diyagramı">';
    last5.forEach(function (q, i) {
      var h = Math.max(14, (q.mag / Math.max(maxMag, 5)) * 130);
      var x = gap + i * (bw + gap), y = base - h;
      var place = q.title.length > 14 ? q.title.slice(0, 13) + "…" : q.title;
      svg += '<g><title>' + esc(q.title) + " — " + esc(q.mag.toFixed(1)) + " · " + esc(fmtDate(q.date)) + "</title>" +
        '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="7" fill="' + CHART_COLORS[i] + '" opacity=".92"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (y - 8) + '" text-anchor="middle" class="c-val">' + esc(q.mag.toFixed(1)) + "</text>" +
        '<text x="' + (x + bw / 2) + '" y="' + (base + 18) + '" text-anchor="middle" class="c-lbl">' + esc(place) + "</text>" +
        '<text x="' + (x + bw / 2) + '" y="' + (base + 34) + '" text-anchor="middle" class="c-sub">' + esc(relTime(q.date) || fmtDate(q.date)) + "</text></g>";
    });
    svg += '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" class="c-axis"/></svg>';
    els.chart.innerHTML = "<h3>Son 5 deprem</h3>" + svg;
  }

  function render() {
    renderChart();
    var items = state.quakes.filter(function (q) { return isFinite(q.mag) && q.mag >= state.minMag; });
    if (!items.length) {
      els.list.innerHTML = "";
      els.status.textContent = "Seçilen büyüklükte kayıt bulunamadı.";
      return;
    }
    var src = state.mode === "archive"
      ? " · Kaynak: USGS arşivi (" + new Date(els.qdate.value + "T00:00:00").toLocaleDateString("tr-TR") + ")"
      : " · Son güncelleme: " + fmtDate(new Date());
    els.status.textContent = items.length + " deprem listeleniyor" + src;
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

  /* Tarihe göre arşiv sorgusu (USGS) */
  function loadArchive(dateStr) {
    var d0 = dateStr, d1 = new Date(new Date(dateStr + "T00:00:00").getTime() + 86400000);
    var end = d1.toISOString().slice(0, 10);
    els.status.textContent = "Arşiv sorgulanıyor…";
    fetch(USGS + "&starttime=" + d0 + "&endtime=" + end)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) {
        state.quakes = ((data && data.features) || []).map(function (f) {
          var c = (f.geometry && f.geometry.coordinates) || [];
          return {
            mag: parseFloat(f.properties.mag),
            depth: parseFloat(c[2]),
            title: f.properties.place || "Bilinmiyor",
            lat: c[1], lng: c[0],
            date: new Date(f.properties.time)
          };
        }).filter(function (q) { return isFinite(q.mag); });
        state.mode = "archive";
        if (els.liveBtn) els.liveBtn.hidden = false;
        if (!state.quakes.length) {
          els.list.innerHTML = ""; renderChart();
          els.status.textContent = "Bu tarihte bölgede kayıtlı deprem bulunamadı (USGS, min. 1.5).";
          return;
        }
        render();
      })
      .catch(function () { showError(); });
  }

  function load() {
    state.mode = "live";
    if (els.liveBtn) els.liveBtn.hidden = true;
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
  if (els.dateForm) {
    if (els.qdate) els.qdate.max = new Date().toISOString().slice(0, 10);
    els.dateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (els.qdate && els.qdate.value) loadArchive(els.qdate.value);
    });
  }
  if (els.liveBtn) els.liveBtn.addEventListener("click", load);
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
