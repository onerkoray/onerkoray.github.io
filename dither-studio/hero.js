/*!
 * Dither Studio — hero arka planı
 * Dithered bağlantı ağı: hareketli düğümler yakın komşularıyla
 * çizgilerle bağlanır; oluşan gri yoğunluk alanı Bayer 8×8 ile
 * 1-bit duotone'a indirilir. Nous portalı "connect" estetiğinde.
 * © Koray Öner — MIT
 */
(function () {
  "use strict";
  const canvas = document.getElementById("heroDither");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const FG = [232, 228, 216]; // bone
  const BG = [10, 10, 10];    // near-black

  const BAYER = [
    [0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],
    [12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
    [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],
    [15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21],
  ];

  const SCALE = 3;          // düşük çözünürlük → pikselleştirilmiş
  const NODE_COUNT = 46;
  const LINK_DIST = 0.26;   // ekran genişliğine oranla bağlantı mesafesi
  let W = 0, H = 0, buf = null, nodes = [], raf = 0, reduced = false;

  function seedNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0009,
        vy: (Math.random() - 0.5) * 0.0009,
      });
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.ceil(r.width / SCALE));
    H = Math.max(1, Math.ceil(r.height / SCALE));
    canvas.width = W; canvas.height = H;
    buf = new Float32Array(W * H);
  }

  // gri yoğunluk tamponuna çizgi ekle (toplayarak)
  function addLine(x0, y0, x1, y1, a) {
    const steps = Math.max(1, Math.hypot(x1 - x0, y1 - y0) | 0);
    for (let s = 0; s <= steps; s++) {
      const x = (x0 + (x1 - x0) * (s / steps)) | 0;
      const y = (y0 + (y1 - y0) * (s / steps)) | 0;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const k = y * W + x;
      buf[k] += a;
      // ince yumuşatma (dikeyde 1px yay)
      if (y + 1 < H) buf[k + W] += a * 0.4;
    }
  }

  // düğüm parıltısı (küçük radyal)
  function addGlow(cx, cy, rad, a) {
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(W - 1, (cx + rad) | 0);
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(H - 1, (cy + rad) | 0);
    const r2 = rad * rad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, dd = dx * dx + dy * dy;
        if (dd > r2) continue;
        buf[y * W + x] += a * (1 - dd / r2);
      }
    }
  }

  function frame() {
    buf.fill(0);
    const link = LINK_DIST;
    const link2 = link * link;

    // düğümleri güncelle
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > 1) { n.vx *= -1; n.x = Math.max(0, Math.min(1, n.x)); }
      if (n.y < 0 || n.y > 1) { n.vy *= -1; n.y = Math.max(0, Math.min(1, n.y)); }
    }

    // bağlantılar
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const ax = a.x * W, ay = a.y * H;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > link2) continue;
        const strength = 1 - Math.sqrt(d2) / link; // yakınlaştıkça parlak
        addLine(ax, ay, b.x * W, b.y * H, 0.16 + 0.5 * strength);
      }
    }
    // düğüm noktaları (çizgilerden sonra, daha parlak)
    for (const n of nodes) addGlow(n.x * W, n.y * H, 3.2, 1.1);

    // radyal düşüş → merkez daha yoğun
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const cx = W * 0.5, cy = H * 0.44, maxD = Math.hypot(W, H) * 0.6;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const vign = 1 - (Math.hypot(x - cx, y - cy) / maxD) * 0.55;
        let v = buf[k] * vign;
        v = v > 1 ? 1 : v < 0 ? 0 : v;
        const th = (BAYER[y & 7][x & 7] + 0.5) / 64;
        const c = v > th ? FG : BG;
        const i = k * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop() { frame(); raf = requestAnimationFrame(loop); }

  function start() {
    resize();
    if (!nodes.length) seedNodes();
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(raf);
    if (reduced) frame(); else loop();
  }

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(start, 150); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduced) loop();
  });

  start();
})();
