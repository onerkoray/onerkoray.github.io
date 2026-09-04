/*!
 * Dither Studio — 1-bit / 8-bit / 16-bit / 32-bit dithering aracı
 * © Koray Öner — MIT Lisansı
 * Tüm işleme istemci tarafında yapılır.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const state = {
    img: null,
    depth: 1,
    method: "floyd",
    scale: 1,
    contrast: 0,
    brightness: 0,
    serpentine: true,
    fg: [232, 228, 216],
    bg: [10, 10, 10],
  };

  const DEPTH_NOTES = {
    1: "İki renk · seçili palet · en belirgin desen",
    8: "256 renk · 3-3-2 RGB kuantalama",
    16: "65.536 renk · 5-6-5 RGB kuantalama",
    32: "Tam renk + alfa · bantlaşma giderici hafif dithering",
  };

  const METHOD_NOTES = {
    floyd: "Hata yayılımı: her pikselin kuantalama hatasını komşularına dağıtır. En pürüzsüz, fotoğrafımsı sonuç.",
    atkinson: "Hatanın yalnızca bir kısmını yayar; daha yüksek kontrast, temiz ve “Macintosh” dokusu.",
    bayer4: "Sıralı (ordered) dithering: 4×4 eşik matrisiyle düzenli, tekrar eden çapraz desen. Retro/baskı hissi.",
    bayer8: "Sıralı dithering: 8×8 matris — daha ince, daha yumuşak geçişli düzenli desen.",
    none: "Dithering yok; renkler doğrudan en yakın palete yuvarlanır. Bantlaşma görünür, en sert sonuç.",
  };

  // 8×8 ve 4×4 Bayer eşik matrisleri (0..1 normalize)
  const BAYER4 = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ];
  const BAYER8 = (function () {
    const m = [
      [0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],
      [12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
      [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],
      [15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21],
    ];
    return m;
  })();

  /* ---------- yardımcılar ---------- */
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // her kanalı verilen seviye sayısına kuantalar
  function quantChannel(v, levels) {
    const step = 255 / (levels - 1);
    return clamp(Math.round(Math.round(v / step) * step));
  }

  // bit derinliğine göre bir pikseli en yakın renge kuantalar
  function quantize(r, g, b) {
    switch (state.depth) {
      case 1: {
        // parlaklık eşiği → fg/bg
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum >= 128 ? state.fg : state.bg;
      }
      case 8: // 3-3-2
        return [quantChannel(r, 8), quantChannel(g, 8), quantChannel(b, 4)];
      case 16: // 5-6-5
        return [quantChannel(r, 32), quantChannel(g, 64), quantChannel(b, 32)];
      case 32: // tam renk, hafif seviye azaltma yalnızca dither için
      default:
        return [clamp(Math.round(r)), clamp(Math.round(g)), clamp(Math.round(b))];
    }
  }

  /* ---------- ana işleyici ---------- */
  function render() {
    if (!state.img) return;

    const scale = state.scale;
    const w = Math.max(1, Math.floor(state.img.width / scale));
    const h = Math.max(1, Math.floor(state.img.height / scale));

    // küçültülmüş ara canvas
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(state.img, 0, 0, w, h);

    const image = tctx.getImageData(0, 0, w, h);
    const d = image.data;

    // parlaklık / kontrast ön işleme
    const c = state.contrast / 100;
    const cf = (1 + c) / (1 - c === 0 ? 1e-6 : 1 - c);
    const br = state.brightness * 1.5;
    for (let i = 0; i < d.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        let v = d[i + k] + br;
        v = cf * (v - 128) + 128;
        d[i + k] = clamp(v);
      }
    }

    if (state.method === "floyd" || state.method === "atkinson") {
      errorDiffuse(d, w, h, state.method);
    } else if (state.method === "bayer4" || state.method === "bayer8") {
      ordered(d, w, h, state.method === "bayer4" ? BAYER4 : BAYER8);
    } else {
      for (let i = 0; i < d.length; i += 4) {
        const q = quantize(d[i], d[i + 1], d[i + 2]);
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
      }
    }

    // çıktı canvas'a nearest-neighbour ile geri büyüt
    tctx.putImageData(image, 0, 0);
    canvas.width = w * scale;
    canvas.height = h * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

    canvas.style.display = "block";
    $("empty").style.display = "none";
    $("download").disabled = false;
  }

  function errorDiffuse(d, w, h, kind) {
    const idx = (x, y) => (y * w + x) * 4;
    for (let y = 0; y < h; y++) {
      const ltr = !state.serpentine || y % 2 === 0;
      const xs = ltr ? 0 : w - 1;
      const xe = ltr ? w : -1;
      const step = ltr ? 1 : -1;
      for (let x = xs; x !== xe; x += step) {
        const i = idx(x, y);
        const oldR = d[i], oldG = d[i + 1], oldB = d[i + 2];
        const q = quantize(oldR, oldG, oldB);
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
        const er = oldR - q[0], eg = oldG - q[1], eb = oldB - q[2];

        const spread = (dx, dy, f) => {
          const nx = x + dx * step, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
          const j = idx(nx, ny);
          d[j] = clamp(d[j] + er * f);
          d[j + 1] = clamp(d[j + 1] + eg * f);
          d[j + 2] = clamp(d[j + 2] + eb * f);
        };

        if (kind === "floyd") {
          spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
        } else { // atkinson: 1/8 ile 6 komşu
          const f = 1 / 8;
          spread(1, 0, f); spread(2, 0, f);
          spread(-1, 1, f); spread(0, 1, f); spread(1, 1, f);
          spread(0, 2, f);
        }
      }
    }
  }

  function ordered(d, w, h, mat) {
    const n = mat.length;
    const max = n * n;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const t = (mat[y % n][x % n] + 0.5) / max - 0.5; // -0.5..0.5
        const amt = state.depth === 1 ? 255 : 255 / levelCount();
        const r = clamp(d[i] + t * amt);
        const g = clamp(d[i + 1] + t * amt);
        const b = clamp(d[i + 2] + t * amt);
        const q = quantize(r, g, b);
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
      }
    }
  }

  function levelCount() {
    switch (state.depth) { case 8: return 8; case 16: return 32; case 32: return 64; default: return 2; }
  }

  /* ---------- görsel yükleme ---------- */
  function loadFromSrc(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // aşırı büyük görselleri sınırla
      const MAX = 1400;
      let { width, height } = img;
      if (Math.max(width, height) > MAX) {
        const s = MAX / Math.max(width, height);
        const c2 = document.createElement("canvas");
        c2.width = Math.round(width * s); c2.height = Math.round(height * s);
        c2.getContext("2d").drawImage(img, 0, 0, c2.width, c2.height);
        const scaled = new Image();
        scaled.onload = () => { state.img = scaled; render(); };
        scaled.src = c2.toDataURL();
      } else {
        state.img = img; render();
      }
    };
    img.src = src;
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => loadFromSrc(e.target.result);
    reader.readAsDataURL(file);
  }

  // gömülü örnek (prosedürel degrade + daireler) — dış istek yok
  function sampleImage() {
    const s = document.createElement("canvas");
    s.width = 640; s.height = 400;
    const g = s.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, "#f5d9a8"); grad.addColorStop(0.5, "#c96f6f"); grad.addColorStop(1, "#2b2140");
    g.fillStyle = grad; g.fillRect(0, 0, 640, 400);
    g.fillStyle = "#ffe9c2"; g.beginPath(); g.arc(470, 120, 70, 0, 7); g.fill();
    g.globalAlpha = 0.25; g.fillStyle = "#000";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(180, 320, 30 + i * 26, 0, 7); g.stroke(); }
    loadFromSrc(s.toDataURL());
  }

  /* ---------- UI bağlama ---------- */
  function rgbToHex(rgb) {
    return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function applyPalette(fgHex, bgHex) {
    state.fg = hexToRgb(fgHex);
    state.bg = hexToRgb(bgHex);
    $("fgColor").value = fgHex;
    $("bgColor").value = bgHex;
    render();
  }

  function bind() {
    $("year").textContent = new Date().getFullYear();
    $("depthNote").textContent = DEPTH_NOTES[1];
    $("methodNote").textContent = METHOD_NOTES.floyd;

    $("pick").addEventListener("click", () => $("file").click());
    $("file").addEventListener("change", (e) => handleFile(e.target.files[0]));
    $("sample").addEventListener("click", sampleImage);

    const drop = $("drop");
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

    // bit derinliği
    $("depth").querySelectorAll(".seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("depth").querySelectorAll(".seg").forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); });
        btn.classList.add("on"); btn.setAttribute("aria-checked", "true");
        state.depth = parseInt(btn.dataset.depth, 10);
        $("depthNote").textContent = DEPTH_NOTES[state.depth];
        // palet yalnızca 1-bit için anlamlı
        const one = state.depth === 1;
        $("paletteGroup").classList.toggle("disabled", !one);
        $("paletteNote").textContent = one
          ? ""
          : "Palet yalnızca 1-bit derinlikte kullanılır. 8/16/32-bit modları görüntünün kendi renklerini kuantalar.";
        render();
      });
    });

    $("method").addEventListener("change", (e) => {
      state.method = e.target.value;
      $("methodNote").textContent = METHOD_NOTES[state.method] || "";
      render();
    });

    $("palette").querySelectorAll(".sw").forEach((sw) => {
      sw.addEventListener("click", () => {
        $("palette").querySelectorAll(".sw").forEach((s) => s.classList.remove("on"));
        sw.classList.add("on");
        applyPalette(sw.dataset.fg, sw.dataset.bg);
      });
    });

    // özel renk seçiciler — 5 preset sınırını kaldırır
    const onCustom = () => {
      $("palette").querySelectorAll(".sw").forEach((s) => s.classList.remove("on"));
      state.fg = hexToRgb($("fgColor").value);
      state.bg = hexToRgb($("bgColor").value);
      render();
    };
    $("fgColor").addEventListener("input", onCustom);
    $("bgColor").addEventListener("input", onCustom);

    const slider = (id, key, fmt) => {
      $(id).addEventListener("input", (e) => {
        state[key] = parseInt(e.target.value, 10);
        $(id + "Val") && ($(id + "Val").textContent = fmt(state[key]));
        render();
      });
    };
    slider("scale", "scale", (v) => v + "×");
    slider("contrast", "contrast", (v) => (v > 0 ? "+" + v : "" + v));
    slider("brightness", "brightness", (v) => (v > 0 ? "+" + v : "" + v));
    $("serpentine").addEventListener("change", (e) => { state.serpentine = e.target.checked; render(); });

    $("download").addEventListener("click", () => {
      const a = document.createElement("a");
      a.download = `dither-${state.depth}bit.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    });

    $("reset").addEventListener("click", () => {
      state.img = null;
      canvas.style.display = "none";
      $("empty").style.display = "block";
      $("download").disabled = true;
    });
  }

  bind();
})();
