/* Interaktif arka plan: particle network (bağımlılıksız)
   - İçeriğin arkasında (z-index:-1), düşük opaklık, pointer-events yok
   - Site accent rengine ve açık/koyu temaya otomatik uyar
   - Fare: yakın parçacıkları hafifçe iter; basılı tutup sürükleyince yakalar
   - Sabit tohumlu RNG: her sayfada aynı "takımyıldız"
   - prefers-reduced-motion: animasyonsuz tek kare; sekme gizliyken durur */
(function () {
  "use strict";

  var canvas = document.createElement("canvas");
  canvas.id = "bg-net";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sabit tohumlu RNG — her sayfada aynı yerleşim
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var W = 0, H = 0, DPR = 1, pts = [], LINK = 130;
  var mouse = { x: -9999, y: -9999, down: false, grab: -1 };
  var colors = { dot: "14,124,102", line: "14,124,102", dotA: 0.35, lineA: 0.13 };

  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function hexToRgb(hex) {
    hex = hex.trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  function refreshColors() {
    var cs = getComputedStyle(document.documentElement);
    var accent = hexToRgb(cs.getPropertyValue("--accent-bright") || "") ||
                 hexToRgb(cs.getPropertyValue("--brand") || "") || "14,124,102";
    var dark = isDark();
    colors.dot = colors.line = accent;
    colors.dotA = dark ? 0.45 : 0.35;
    colors.lineA = dark ? 0.16 : 0.12;
  }

  function build() {
    var rnd = mulberry32(20260718);
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var count = Math.max(28, Math.min(85, Math.round((W * H) / 22000)));
    pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        x: rnd() * W, y: rnd() * H,
        vx: (rnd() - 0.5) * 0.35, vy: (rnd() - 0.5) * 0.35,
        r: 1.4 + rnd() * 1.8
      });
    }
  }

  function step() {
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (mouse.grab === i) { // sürüklenen parçacık fareyi izler
        p.x += (mouse.x - p.x) * 0.35;
        p.y += (mouse.y - p.y) * 0.35;
        p.vx = 0; p.vy = 0;
        continue;
      }
      // fare itmesi
      var dx = p.x - mouse.x, dy = p.y - mouse.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 14400 && d2 > 0.01) { // 120px
        var d = Math.sqrt(d2), f = (120 - d) / 120 * 0.6;
        p.vx += (dx / d) * f * 0.35;
        p.vy += (dy / d) * f * 0.35;
      }
      p.vx *= 0.985; p.vy *= 0.985;
      // minimum süzülme hızı
      var sp = Math.abs(p.vx) + Math.abs(p.vy);
      if (sp < 0.12) { p.vx += (Math.random() - 0.5) * 0.04; p.vy += (Math.random() - 0.5) * 0.04; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, j, p, q;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      for (j = i + 1; j < pts.length; j++) {
        q = pts[j];
        var dx = p.x - q.x, dy = p.y - q.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          var a = (1 - Math.sqrt(d2) / LINK) * colors.lineA;
          ctx.strokeStyle = "rgba(" + colors.line + "," + a.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      var da = (mouse.grab === i) ? Math.min(1, colors.dotA + 0.35) : colors.dotA;
      ctx.fillStyle = "rgba(" + colors.dot + "," + da + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }
  }

  var running = false, rafId = 0;
  function loop() { step(); draw(); rafId = requestAnimationFrame(loop); }
  function start() { if (!running && !reduced) { running = true; rafId = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  // Etkileşim — canvas pointer-events:none olduğundan pencereden dinlenir
  window.addEventListener("pointermove", function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY;
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) {
    // form alanları/butonlar üzerinde yakalama yapma
    var t = e.target;
    if (t && (t.closest && t.closest("input, select, textarea, button, a, summary, [role=tab]"))) return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true;
    var best = -1, bestD = 3600; // 60px
    for (var i = 0; i < pts.length; i++) {
      var dx = pts[i].x - mouse.x, dy = pts[i].y - mouse.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    mouse.grab = best;
  }, { passive: true });
  window.addEventListener("pointerup", function () {
    if (mouse.grab >= 0) { // bırakınca hafif savrulma
      var p = pts[mouse.grab];
      if (p) { p.vx = (Math.random() - 0.5) * 1.2; p.vy = (Math.random() - 0.5) * 1.2; }
    }
    mouse.down = false; mouse.grab = -1;
  }, { passive: true });
  window.addEventListener("pointerleave", function () { mouse.x = -9999; mouse.y = -9999; }, { passive: true });

  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { build(); if (reduced) { refreshColors(); draw(); } }, 150);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // Tema/accent değişimini izle
  new MutationObserver(function () { refreshColors(); if (reduced) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    refreshColors(); if (reduced) draw();
  });

  refreshColors();
  build();
  draw(); // ilk kare hemen çizilsin
  if (!reduced) start();
})();
