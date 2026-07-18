/* Canlılık katmanı — saat, hava, atmosfer, komut paleti (bağımlılıksız, yalnız ana sayfa) */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- Yardımcılar ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  var GUNLER = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- Güne göre ton + selamlama ---------- */
  function daypart(h) {
    if (h >= 6 && h < 12) return ["sabah", "🌅 Günaydın"];
    if (h >= 12 && h < 17) return ["oglen", "☀️ İyi öğleden sonralar"];
    if (h >= 17 && h < 21) return ["aksam", "🌇 İyi akşamlar"];
    return ["gece", "🌙 İyi geceler"];
  }

  /* ---------- Hero canlı bar ---------- */
  var heroActions = $(".hero-actions");
  if (!heroActions) return; // yalnızca ana sayfa
  var bar = el("div", "live-bar");
  bar.innerHTML =
    '<div class="live-card"><span class="lc-label" id="lv-greet">Merhaba</span>' +
    '<span class="lc-value" id="lv-clock">--:--:--</span><span class="lc-sub" id="lv-dpname"></span></div>' +
    '<div class="live-card"><span class="lc-label">Bugün</span>' +
    '<span class="lc-value" id="lv-date"></span><span class="lc-sub" id="lv-doy"></span></div>' +
    '<div class="live-card lc-skeleton" id="lv-wx-card"><span class="lc-label" id="lv-city">Hava</span>' +
    '<span class="lc-value" id="lv-wx">......</span><span class="lc-sub" id="lv-wx-sub"></span></div>' +
    '<div class="live-card lc-skeleton" id="lv-sun-card"><span class="lc-label" id="lv-sun-label">Gün batımı</span>' +
    '<span class="lc-value" id="lv-sun">......</span><span class="lc-sub" id="lv-sun-sub"></span></div>' +
    '<div class="live-card"><span class="lc-label">Sonraki tatil</span>' +
    '<span class="lc-value" id="lv-hol"></span><span class="lc-sub" id="lv-hol-sub"></span></div>' +
    '<div class="live-card"><span class="lc-label">Dünya saatleri</span>' +
    '<span class="lc-world" id="lv-world"></span></div>';
  heroActions.parentNode.insertBefore(bar, heroActions.nextSibling);

  var sunTimes = null; // { sunrise: Date, sunset: Date }

  // 2026-2027 resmi tatiller
  var TATIL = [
    ["2026-03-20", "Ramazan Bayramı"], ["2026-04-23", "Ulusal Egemenlik Bayramı"], ["2026-05-01", "Emek ve Dayanışma Günü"],
    ["2026-05-19", "Gençlik ve Spor Bayramı"], ["2026-05-27", "Kurban Bayramı"], ["2026-07-15", "Demokrasi ve Millî Birlik Günü"],
    ["2026-08-30", "Zafer Bayramı"], ["2026-10-29", "Cumhuriyet Bayramı"], ["2027-01-01", "Yılbaşı"]
  ];
  function nextHoliday(n) {
    for (var i = 0; i < TATIL.length; i++) {
      var d = new Date(TATIL[i][0] + "T00:00:00");
      if (d > n) return [d, TATIL[i][1]];
    }
    return null;
  }
  function worldTime(tz) {
    return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date());
  }
  function tick() {
    var n = new Date();
    var dp = daypart(n.getHours());
    document.documentElement.setAttribute("data-daypart", dp[0]);
    $("#lv-greet").textContent = dp[1];
    $("#lv-clock").textContent = pad(n.getHours()) + ":" + pad(n.getMinutes()) + ":" + pad(n.getSeconds());
    $("#lv-date").textContent = n.getDate() + " " + AYLAR[n.getMonth()] + " " + GUNLER[n.getDay()];
    var start = new Date(n.getFullYear(), 0, 0);
    var doy = Math.floor((n - start) / 864e5);
    var yearDays = (n.getFullYear() % 4 === 0 && (n.getFullYear() % 100 !== 0 || n.getFullYear() % 400 === 0)) ? 366 : 365;
    $("#lv-doy").textContent = "Yılın " + doy + ". günü · " + (yearDays - doy) + " gün kaldı";
    // gün batımı/doğumu geri sayımı
    if (sunTimes) {
      var target, label;
      if (n < sunTimes.sunrise) { target = sunTimes.sunrise; label = "Gün doğumuna"; }
      else if (n < sunTimes.sunset) { target = sunTimes.sunset; label = "Gün batımına"; }
      else { target = new Date(sunTimes.sunrise.getTime() + 864e5); label = "Gün doğumuna"; }
      var ms = target - n, hh = Math.floor(ms / 36e5), mm = Math.floor((ms % 36e5) / 6e4);
      $("#lv-sun-label").textContent = label;
      $("#lv-sun").textContent = hh + " sa " + pad(mm) + " dk";
      $("#lv-sun-sub").textContent = "Batış " + pad(sunTimes.sunset.getHours()) + ":" + pad(sunTimes.sunset.getMinutes()) +
        " · Doğuş " + pad(sunTimes.sunrise.getHours()) + ":" + pad(sunTimes.sunrise.getMinutes());
      $("#lv-sun-card").classList.remove("lc-skeleton");
    }
    // sonraki tatil
    var nh = nextHoliday(n);
    if (nh) {
      var kalan = Math.ceil((nh[0] - n) / 864e5);
      $("#lv-hol").textContent = kalan + " gün";
      $("#lv-hol-sub").textContent = nh[1] + " · " + nh[0].getDate() + " " + AYLAR[nh[0].getMonth()];
    }
    // dünya saatleri
    $("#lv-world").innerHTML =
      "<span>İstanbul<b>" + worldTime("Europe/Istanbul") + "</b></span>" +
      "<span>New York<b>" + worldTime("America/New_York") + "</b></span>" +
      "<span>Tokyo<b>" + worldTime("Asia/Tokyo") + "</b></span>";
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Atmosfer katmanları ---------- */
  ["atmo-rain", "atmo-snow", "atmo-stars"].forEach(function (c) {
    document.body.appendChild(el("div", "atmo " + c));
  });
  function isDarkNow() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function setAtmosphere(kind) {
    document.body.classList.remove("w-rain", "w-snow", "w-stars");
    var h = new Date().getHours();
    var night = h >= 21 || h < 6;
    if (kind === "rain") document.body.classList.add("w-rain");
    else if (kind === "snow") document.body.classList.add("w-snow");
    else if (night && isDarkNow()) document.body.classList.add("w-stars");
  }

  /* ---------- Hava durumu (Open-Meteo, anahtar gerektirmez) ---------- */
  function wxInfo(code) {
    if (code === 0) return ["Açık", "☀️", "clear"];
    if (code <= 2) return ["Az bulutlu", "🌤️", "clear"];
    if (code === 3) return ["Bulutlu", "☁️", "cloud"];
    if (code <= 48) return ["Sisli", "🌫️", "cloud"];
    if (code <= 67 || (code >= 80 && code <= 82)) return ["Yağmurlu", "🌧️", "rain"];
    if (code <= 77 || code === 85 || code === 86) return ["Kar yağışlı", "🌨️", "snow"];
    return ["Sağanak/Fırtına", "⛈️", "rain"];
  }
  function loadWeather(lat, lon, city) {
    var u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1";
    fetch(u).then(function (r) { return r.json(); }).then(function (d) {
      var t = Math.round(d.current.temperature_2m);
      var w = wxInfo(d.current.weather_code);
      $("#lv-city").textContent = city || "Hava";
      $("#lv-wx").textContent = w[1] + " " + t + "°C";
      $("#lv-wx-sub").textContent = w[0];
      $("#lv-wx-card").classList.remove("lc-skeleton");
      sunTimes = { sunrise: new Date(d.daily.sunrise[0]), sunset: new Date(d.daily.sunset[0]) };
      if (!reduced) setAtmosphere(w[2]);
      tick();
    }).catch(function () { fallbackWx(); });
  }
  function fallbackWx() {
    $("#lv-wx").textContent = "—";
    $("#lv-wx-sub").textContent = "Hava alınamadı";
    $("#lv-wx-card").classList.remove("lc-skeleton");
    $("#lv-sun-card").classList.remove("lc-skeleton");
    $("#lv-sun").textContent = "—";
    if (!reduced) setAtmosphere("clear");
  }
  // IP'den şehir (başarısızsa İstanbul)
  fetch("https://ipapi.co/json/").then(function (r) { return r.json(); }).then(function (g) {
    if (g && g.latitude) loadWeather(g.latitude, g.longitude, g.city);
    else loadWeather(41.01, 28.98, "İstanbul");
  }).catch(function () { loadWeather(41.01, 28.98, "İstanbul"); });

  /* ---------- Header: canlı nokta + küçülme ---------- */
  var nav = $(".site-nav");
  if (nav) {
    var dot = el("span", "live-dot", "Canlı");
    dot.title = "Bu sayfadaki saat, hava ve gün bilgileri canlıdır";
    nav.parentNode.insertBefore(dot, nav.nextSibling);
  }
  var header = $(".site-header");
  if (header) {
    var lastShrunk = false;
    window.addEventListener("scroll", function () {
      var s = window.scrollY > 60;
      if (s !== lastShrunk) { header.classList.toggle("is-shrunk", s); lastShrunk = s; }
    }, { passive: true });
  }

  /* ---------- Cursor glow + hero parallax ---------- */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    var glow = el("div", "cursor-glow");
    document.body.appendChild(glow);
    document.body.classList.add("has-pointer");
    var gx = 0, gy = 0, pending = false;
    window.addEventListener("pointermove", function (e) {
      gx = e.clientX; gy = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(function () {
          glow.style.transform = "translate(" + (gx - 170) + "px," + (gy - 170) + "px)";
          // hero parallax
          var spans = document.querySelectorAll(".hero-bg span");
          var dx = (gx / window.innerWidth - 0.5), dy = (gy / window.innerHeight - 0.5);
          for (var i = 0; i < spans.length; i++) {
            var f = (i + 1) * 6;
            spans[i].style.transform = "translate(" + (-dx * f) + "px," + (-dy * f) + "px)";
          }
          pending = false;
        });
      }
    }, { passive: true });
  }

  /* ---------- Kart rozetleri ---------- */
  var NEW_TOOLS = ["kidem-tazminati-hesaplama/", "gumruk-vergisi-hesaplama/", "otv-hesaplama/", "mtv-hesaplama/", "serbest-meslek-makbuzu-hesaplama/"];
  var HOT_TOOL = "maas-hesaplama/";
  document.querySelectorAll(".project-card h3 a").forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (href === HOT_TOOL) a.insertAdjacentHTML("afterend", '<span class="card-flag flag-hot">Popüler</span>');
    else if (NEW_TOOLS.indexOf(href) !== -1) a.insertAdjacentHTML("afterend", '<span class="card-flag flag-new">Yeni</span>');
  });

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
