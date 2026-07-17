/* Koray Öner — kişisel sayfa · tema geçişi ve yıl */
(function () {
  "use strict";
  var KEY = "onerkoray.theme";
  var order = ["auto", "light", "dark"];
  var btn = document.getElementById("themeToggle");

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    if (btn) {
      var label = btn.querySelector(".theme-toggle-label");
      if (label) label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  }

  apply(localStorage.getItem(KEY) || "auto");

  if (btn) {
    btn.addEventListener("click", function () {
      var current = localStorage.getItem(KEY) || "auto";
      var next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(KEY, next);
      apply(next);
    });
  }

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Renk paleti seçici (header'a otomatik eklenir) ---- */
  var ACCENT_KEY = "onerkoray.accent";
  var ACCENTS = [
    ["mavi", "#2160b4", "Mavi"],
    ["yesil", "#0e7c66", "Yeşil"],
    ["camgobegi", "#0c7f93", "Camgöbeği"],
    ["turuncu", "#bb5714", "Turuncu"],
    ["gul", "#b0345c", "Gül"]
  ];
  function applyAccent(name) {
    if (name && name !== "mavi") document.documentElement.setAttribute("data-accent", name);
    else document.documentElement.removeAttribute("data-accent");
    document.querySelectorAll(".palette-pop button").forEach(function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-accent") || "mavi") === (name || "mavi")));
    });
  }
  applyAccent(localStorage.getItem(ACCENT_KEY) || "mavi");

  /* Widget yoksa header'a enjekte et (tüm alt sayfalarda markup gerektirmez) */
  var headerInner = document.querySelector(".site-header .header-inner");
  if (headerInner && !headerInner.querySelector(".palette")) {
    var pal = document.createElement("div");
    pal.className = "palette";
    pal.innerHTML =
      '<button class="theme-toggle palette-toggle" type="button" aria-expanded="false" aria-label="Renk paleti seç">' +
      '<span class="palette-dot" aria-hidden="true"></span><span class="theme-toggle-label">Renk</span></button>' +
      '<div class="palette-pop" hidden>' +
      ACCENTS.map(function (a) {
        return '<button type="button" data-accent="' + a[0] + '" style="--sw:' + a[1] + '" aria-label="' + a[2] + ' tema"></button>';
      }).join("") +
      "</div>";
    var themeBtn = headerInner.querySelector("#themeToggle");
    headerInner.insertBefore(pal, themeBtn);
    applyAccent(localStorage.getItem(ACCENT_KEY) || "mavi");
  }

  var palToggle = document.querySelector(".palette-toggle");
  var palPop = document.querySelector(".palette-pop");
  if (palToggle && palPop) {
    palToggle.addEventListener("click", function () {
      var open = palPop.hidden;
      palPop.hidden = !open;
      palToggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!palPop.hidden && !e.target.closest(".palette")) {
        palPop.hidden = true;
        palToggle.setAttribute("aria-expanded", "false");
      }
    });
    palPop.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-accent") || "yesil";
        localStorage.setItem(ACCENT_KEY, name);
        applyAccent(name);
      });
    });
  }

  /* ---- Araç dizini: arama + kategori filtresi (ana sayfa) ---- */
  var search = document.getElementById("tool-search-input");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-filter]"));
  var cards = Array.prototype.slice.call(document.querySelectorAll(".project-card[data-tags]"));
  if (cards.length && (search || chips.length)) {
    var activeCat = "hepsi";
    function applyFilter() {
      var q = search ? search.value.trim().toLocaleLowerCase("tr") : "";
      var visible = 0;
      cards.forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").toLocaleLowerCase("tr");
        var cat = card.getAttribute("data-cat") || "";
        var okCat = activeCat === "hepsi" || cat === activeCat;
        var okText = !q || tags.indexOf(q) !== -1 || card.textContent.toLocaleLowerCase("tr").indexOf(q) !== -1;
        var show = okCat && okText;
        card.classList.toggle("is-hidden", !show);
        if (show) visible++;
      });
      var empty = document.getElementById("no-results");
      if (empty) empty.hidden = visible > 0;
    }
    if (search) search.addEventListener("input", applyFilter);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeCat = chip.getAttribute("data-filter");
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        applyFilter();
      });
    });
  }

  /* ---- Jenerik rapor: hesap araçlarına otomatik rapor başlığı + yazdır düğmesi ---- */
  var calcWrap = document.querySelector(".calc .wrap");
  if (calcWrap && !document.getElementById("printBtn")) {
    var h1 = document.querySelector("h1");
    var icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    var head = document.createElement("div");
    head.className = "report-head";
    head.setAttribute("aria-hidden", "true");
    head.innerHTML = (icon ? '<img src="' + icon.getAttribute("href") + '" alt="">' : "") +
      '<div><div class="report-title">' + (h1 ? h1.textContent : document.title) + " — Rapor</div>" +
      '<div class="report-meta">' + location.host + location.pathname + ' · Rapor tarihi: <span id="report-date"></span></div></div>';
    calcWrap.insertBefore(head, calcWrap.firstChild);
    var inputsDiv = document.createElement("div");
    inputsDiv.className = "report-inputs";
    inputsDiv.id = "report-inputs";
    inputsDiv.setAttribute("aria-hidden", "true");
    calcWrap.insertBefore(inputsDiv, head.nextSibling);
    var bar = document.createElement("p");
    bar.className = "report-actions no-print";
    bar.innerHTML = '<button type="button" id="printBtn" class="btn btn-primary">🖨 Raporu yazdır / PDF kaydet</button>';
    calcWrap.appendChild(bar);
    var foot = document.createElement("div");
    foot.className = "report-foot";
    foot.setAttribute("aria-hidden", "true");
    foot.textContent = "Bu rapor " + location.host + location.pathname +
      " adresindeki ücretsiz araçla bilgilendirme amaçlı oluşturulmuştur. · © Koray Öner";
    calcWrap.appendChild(foot);
    if (typeof window.buildReportInputs !== "function") {
      window.buildReportInputs = function () {
        var esc = function (s) {
          return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
          });
        };
        var parts = [];
        document.querySelectorAll(".calc input, .calc select").forEach(function (el) {
          if (el.type === "hidden" || el.closest("[hidden]") || !el.value) return;
          var lab = "";
          if (el.id) {
            var l = document.querySelector('label[for="' + el.id + '"]');
            if (l) lab = l.textContent.trim();
          }
          if (!lab && el.closest("label")) lab = el.closest("label").textContent.trim();
          if (el.type === "radio" || el.type === "checkbox") {
            if (!el.checked) return;
            parts.push("<strong>" + esc(lab || el.name || "Seçim") + "</strong>");
          } else {
            parts.push((lab ? "<strong>" + esc(lab) + ":</strong> " : "") + esc(el.value));
          }
        });
        inputsDiv.innerHTML = parts.join(" &nbsp;·&nbsp; ");
      };
    }
  }

  /* ---- Rapor yazdırma (araç sayfaları) ---- */
  var printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      var dateEl = document.getElementById("report-date");
      if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString("tr-TR", {
          day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
      }
      if (typeof window.buildReportInputs === "function") window.buildReportInputs();
      window.print();
    });
  }

  /* Header'a kaydırma durumunda gölge ekle */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll ile ortaya çıkma (reveal) animasyonu */
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reveals.length) return;
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  reveals.forEach(function (el) { io.observe(el); });
})();
