/* Ana sayfa katmanı — başlık küçülmesi, son kullanılanlar, komut paleti (bağımlılıksız). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- Yardımcılar ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  /* Saat, selamlama, sonraki tatil ve dünya saatleri şeridi 7 Ekim 2026'da
     kaldırıldı: finans bilgisi taşımıyordu, emojili selam sitenin diline
     uymuyordu ve elle yazılmış tatil listesi 2027'de bayatlayacaktı. */
  var heroActions = $(".hero-actions");
  if (!heroActions) return; // yalnızca ana sayfa

  /* ---------- Header: küçülme ---------- */
  var header = $(".site-header");
  if (header) {
    var lastShrunk = false;
    window.addEventListener("scroll", function () {
      var s = window.scrollY > 60;
      if (s !== lastShrunk) { header.classList.toggle("is-shrunk", s); lastShrunk = s; }
    }, { passive: true });
  }


  /* ---------- Son kullanılan araçlar (localStorage) ---------- */
  var RECENT_KEY = "onerkoray.recent";
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".project-card a");
    if (!a) return;
    var card = a.closest(".project-card");
    var link = card && card.querySelector("h3 a");
    if (!link) return;
    var item = { href: link.getAttribute("href"), name: link.textContent.trim() };
    var rec = getRecent().filter(function (r) { return r.href !== item.href; });
    rec.unshift(item);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(rec.slice(0, 5))); } catch (err) {}
  });

  /* ---------- Komut paleti (Ctrl+K veya /) ---------- */
  var tools = [];
  document.querySelectorAll(".project-card h3 a").forEach(function (a) {
    tools.push({ name: a.textContent.trim(), href: a.getAttribute("href") });
  });
  var pb = el("div", "cmdk-backdrop");
  pb.innerHTML = '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Araç ara">' +
    '<input type="text" id="pal-q" placeholder="Araç ara: maaş, kıdem, KDV, gümrük…" autocomplete="off">' +
    '<ul id="pal-list"></ul>' +
    '<div class="cmdk-foot"><span><kbd>↑↓</kbd> gezin</span><span><kbd>Enter</kbd> aç</span><span><kbd>Esc</kbd> kapat</span></div></div>';
  document.body.appendChild(pb);
  var palQ = $("#pal-q"), palList = $("#pal-list"), palIdx = 0, palItems = [];

  function trFold(s) {
    return s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
  }
  function renderPal(q) {
    var list;
    if (!q) {
      var rec = getRecent();
      list = rec.length ? rec.map(function (r) { return { name: r.name, href: r.href, hint: "Son kullanılan" }; }) : tools.slice(0, 8);
    } else {
      var f = trFold(q);
      list = tools.filter(function (t) { return trFold(t.name).indexOf(f) !== -1; });
    }
    palItems = list;
    palIdx = 0;
    palList.innerHTML = list.length
      ? list.map(function (t, i) {
          return '<li' + (i === 0 ? ' class="active"' : '') + '><a href="' + t.href + '">' + t.name +
            (t.hint ? '<span class="p-hint">' + t.hint + "</span>" : "") + "</a></li>";
        }).join("")
      : '<li><a href="#projects">Sonuç yok — tüm araçları gör</a></li>';
  }
  function openPal() { pb.classList.add("open"); palQ.value = ""; renderPal(""); setTimeout(function () { palQ.focus(); }, 30); }
  function closePal() { pb.classList.remove("open"); }
  function movePal(d) {
    var lis = palList.children;
    if (!lis.length) return;
    lis[palIdx] && lis[palIdx].classList.remove("active");
    palIdx = (palIdx + d + lis.length) % lis.length;
    lis[palIdx].classList.add("active");
    lis[palIdx].scrollIntoView({ block: "nearest" });
  }
  palQ.addEventListener("input", function () { renderPal(palQ.value.trim()); });
  pb.addEventListener("click", function (e) { if (e.target === pb) closePal(); });
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && e.target !== palQ;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPal(); return; }
    if (e.key === "/" && !typing && !pb.classList.contains("open")) { e.preventDefault(); openPal(); return; }
    if (!pb.classList.contains("open")) return;
    if (e.key === "Escape") closePal();
    else if (e.key === "ArrowDown") { e.preventDefault(); movePal(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePal(-1); }
    else if (e.key === "Enter") {
      var act = palList.children[palIdx] && palList.children[palIdx].querySelector("a");
      if (act) { window.location.href = act.getAttribute("href"); }
    }
  });
})();

/* ---- Hero teknoloji paneli: giriş animasyonu + tooltip ---- */
(function () {
  var panel = document.querySelector(".tech-panel");
  if (!panel) return;
  var slices = panel.querySelectorAll(".lang-bar span");
  var counts = panel.querySelectorAll(".lang-legend b[data-count]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fill() {
    slices.forEach(function (s) { s.style.flexGrow = s.getAttribute("data-pct"); });
  }
  function runCounts() {
    counts.forEach(function (b) {
      var target = parseInt(b.getAttribute("data-count"), 10) || 0;
      if (reduce) { b.textContent = target + "%"; return; }
      var t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 600, 1);
        p = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * p) + "%";
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    fill();
    runCounts();
  }
  if (reduce || !("IntersectionObserver" in window)) {
    start();
  } else {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { start(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(panel);
  }

  /* Tooltip */
  var wrap = panel.querySelector(".lang-wrap");
  var tip = document.createElement("div");
  tip.className = "lang-tip";
  tip.setAttribute("aria-hidden", "true");
  wrap.appendChild(tip);
  var active = null;

  function showTip(s) {
    if (active && active !== s) active.classList.remove("is-active");
    active = s;
    s.classList.add("is-active");
    tip.textContent = s.getAttribute("data-lang") + " · %" + s.getAttribute("data-pct");
    tip.style.left = (s.offsetLeft + s.offsetWidth / 2) + "px";
    tip.classList.add("show");
  }
  function hideTip() {
    if (active) active.classList.remove("is-active");
    active = null;
    tip.classList.remove("show");
  }
  slices.forEach(function (s) {
    s.setAttribute("tabindex", "0");
    s.setAttribute("aria-label", s.getAttribute("data-lang") + " yüzde " + s.getAttribute("data-pct"));
    s.addEventListener("mouseenter", function () { showTip(s); });
    s.addEventListener("mouseleave", hideTip);
    s.addEventListener("focus", function () { showTip(s); });
    s.addEventListener("blur", hideTip);
    s.addEventListener("click", function (e) {
      e.stopPropagation();
      if (active === s) hideTip(); else showTip(s);
    });
  });
  document.addEventListener("click", function (e) {
    if (active && !wrap.contains(e.target)) hideTip();
  });
})();
