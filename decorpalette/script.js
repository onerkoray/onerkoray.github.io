/* =========================================================================
   DecorPalette — script.js
   Vanilla JS · no dependencies · modular · accessible
   ========================================================================= */
(function () {
  "use strict";

  /* ------------------------------------------------------------ Utilities */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  /* ------------------------------------------------------ Color conversion */

  const Color = {
    normalizeHex(hex) {
      if (typeof hex !== "string") return null;
      let h = hex.trim().replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
      return /^[0-9a-f]{6}$/i.test(h) ? "#" + h.toUpperCase() : null;
    },

    hexToRgb(hex) {
      const h = Color.normalizeHex(hex);
      if (!h) return null;
      return {
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
      };
    },

    rgbToHex({ r, g, b }) {
      const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
      return ("#" + to(r) + to(g) + to(b)).toUpperCase();
    },

    rgbToHsl({ r, g, b }) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      const d = max - min;
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          default: h = (r - g) / d + 4;
        }
        h *= 60;
      }
      return { h, s: s * 100, l: l * 100 };
    },

    hslToRgb({ h, s, l }) {
      h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) [r, g, b] = [c, x, 0];
      else if (h < 120) [r, g, b] = [x, c, 0];
      else if (h < 180) [r, g, b] = [0, c, x];
      else if (h < 240) [r, g, b] = [0, x, c];
      else if (h < 300) [r, g, b] = [x, 0, c];
      else [r, g, b] = [c, 0, x];
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    },

    hexToHsl(hex) { return Color.rgbToHsl(Color.hexToRgb(hex)); },
    hslToHex(hsl) { return Color.rgbToHex(Color.hslToRgb(hsl)); },

    relativeLuminance({ r, g, b }) {
      const lin = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    },

    contrastRatio(hexA, hexB) {
      const a = Color.relativeLuminance(Color.hexToRgb(hexA));
      const b = Color.relativeLuminance(Color.hexToRgb(hexB));
      const light = Math.max(a, b), dark = Math.min(a, b);
      return (light + 0.05) / (dark + 0.05);
    },

    /** Pick black or white text for best contrast on a background. */
    readableText(hex) {
      return Color.contrastRatio(hex, "#000000") >= Color.contrastRatio(hex, "#FFFFFF")
        ? "#000000" : "#FFFFFF";
    },
  };

  /* ---------------------------------------------------- Harmony generation */

  const HUE_OFFSETS = {
    analogous: [-30, -15, 0, 15, 30, 45, 60, 75],
    complementary: [0, 180, 0, 180, 0, 180, 0, 180],
    split: [0, 150, 210, 30, 330, 180, 15, 195],
    triadic: [0, 120, 240, 60, 180, 300, 30, 210],
    tetradic: [0, 90, 180, 270, 45, 135, 225, 315],
    monochromatic: [0, 0, 0, 0, 0, 0, 0, 0],
  };

  function buildPalette(baseHex, harmony, count, jitter) {
    const base = Color.hexToHsl(baseHex);
    const offsets = HUE_OFFSETS[harmony] || HUE_OFFSETS.analogous;
    const out = [];
    for (let i = 0; i < count; i++) {
      const hueShift = offsets[i % offsets.length];
      let s = base.s;
      let l = base.l;

      if (harmony === "monochromatic") {
        // Spread lightness evenly across the range for tonal steps.
        l = clamp(18 + (i / Math.max(count - 1, 1)) * 64, 8, 92);
        s = clamp(base.s + (jitter ? rand(-8, 8) : 0), 10, 95);
      } else {
        if (jitter) { s = clamp(base.s + rand(-12, 12), 20, 95); l = clamp(base.l + rand(-14, 14), 20, 82); }
      }
      out.push(Color.hslToHex({ h: base.h + hueShift, s, l }));
    }
    return out;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  /* ----------------------------------------------------------- Clipboard */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through to legacy path */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  /* ----------------------------------------------------------- Storage */

  const Store = {
    KEY: "decorpalette.saved.v1",
    read() {
      try { return JSON.parse(localStorage.getItem(Store.KEY)) || []; }
      catch (_) { return []; }
    },
    write(list) {
      try { localStorage.setItem(Store.KEY, JSON.stringify(list)); return true; }
      catch (_) { return false; }
    },
  };

  /* =====================================================================
     Palette generator module
     ===================================================================== */

  const Generator = (() => {
    const els = {
      form: $("#controls"),
      base: $("#baseColor"),
      baseHex: $("#baseHex"),
      harmony: $("#harmony"),
      count: $("#count"),
      countOut: $("#countOut"),
      shuffle: $("#shuffleBtn"),
      swatches: $("#swatches"),
      status: $("#status"),
    };

    // state: array of { hex, locked }
    let palette = [];

    function announce(msg) { if (els.status) els.status.textContent = msg; }

    function currentBase() {
      return Color.normalizeHex(els.baseHex.value) || els.base.value.toUpperCase();
    }

    function generate({ preserveLocks = true } = {}) {
      const count = parseInt(els.count.value, 10);
      const fresh = buildPalette(currentBase(), els.harmony.value, count, true);

      const next = [];
      for (let i = 0; i < count; i++) {
        const prev = palette[i];
        if (preserveLocks && prev && prev.locked) next.push(prev);
        else next.push({ hex: fresh[i], locked: false });
      }
      palette = next;
      render();
      announce(`Generated ${count} colors using the ${els.harmony.value} harmony.`);
    }

    function render() {
      els.swatches.innerHTML = "";
      palette.forEach((sw, index) => {
        const text = Color.readableText(sw.hex);
        const li = document.createElement("li");
        li.className = "swatch";
        li.innerHTML = `
          <div class="swatch-color" style="background:${sw.hex}">
            <button class="swatch-lock" type="button" aria-pressed="${sw.locked}"
              aria-label="${sw.locked ? "Unlock" : "Lock"} color ${sw.hex}"
              style="color:${text};background:${sw.locked ? "" : "rgba(255,255,255,.85)"}">
              ${sw.locked ? "&#128274;" : "&#128275;"}
            </button>
          </div>
          <div class="swatch-meta">
            <span class="swatch-hex">${sw.hex}</span>
            <button class="swatch-copy" type="button" data-hex="${sw.hex}">Copy</button>
          </div>`;

        $(".swatch-lock", li).addEventListener("click", () => toggleLock(index));
        $(".swatch-copy", li).addEventListener("click", async (e) => {
          const ok = await copyText(sw.hex);
          e.currentTarget.textContent = ok ? "Copied!" : "Failed";
          announce(ok ? `Copied ${sw.hex} to clipboard.` : "Clipboard copy failed.");
          setTimeout(() => { e.currentTarget.textContent = "Copy"; }, 1400);
        });
        els.swatches.appendChild(li);
      });
    }

    function toggleLock(i) {
      if (palette[i]) { palette[i].locked = !palette[i].locked; render(); }
    }

    function syncBaseInputs(source) {
      if (source === "picker") {
        els.baseHex.value = els.base.value.toUpperCase();
      } else {
        const norm = Color.normalizeHex(els.baseHex.value);
        if (norm) { els.base.value = norm; els.baseHex.setCustomValidity(""); }
        else { els.baseHex.setCustomValidity("Enter a valid 6-digit hex color."); return; }
      }
      generate();
    }

    function asCss() {
      const lines = palette.map((s, i) => `  --color-${i + 1}: ${s.hex};`);
      return `:root {\n${lines.join("\n")}\n}`;
    }
    function asJson() {
      return JSON.stringify(palette.map((s) => s.hex), null, 2);
    }

    function bind() {
      els.base.addEventListener("input", () => syncBaseInputs("picker"));
      els.baseHex.addEventListener("change", () => syncBaseInputs("hex"));
      els.harmony.addEventListener("change", () => generate());
      els.count.addEventListener("input", () => {
        els.countOut.textContent = els.count.value;
        generate();
      });
      els.shuffle.addEventListener("click", () => generate());

      $("#copyCssBtn").addEventListener("click", async () => {
        const ok = await copyText(asCss());
        announce(ok ? "Copied palette as CSS custom properties." : "Clipboard copy failed.");
      });
      $("#copyJsonBtn").addEventListener("click", async () => {
        const ok = await copyText(asJson());
        announce(ok ? "Copied palette as JSON." : "Clipboard copy failed.");
      });
      $("#saveBtn").addEventListener("click", () => {
        Library.save(palette.map((s) => s.hex));
        announce("Palette saved to your library.");
      });

      // Space to shuffle (ignore when typing in a control).
      document.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        const typing = ["input", "select", "textarea", "summary"].includes(tag);
        if (e.code === "Space" && !typing && !e.target.isContentEditable) {
          e.preventDefault();
          generate();
        }
      });
    }

    function init() {
      if (!els.form) return;
      els.form.addEventListener("submit", (e) => e.preventDefault());
      bind();
      generate({ preserveLocks: false });
    }

    return { init, load(hexes) {
      palette = hexes.map((hex) => ({ hex, locked: false }));
      render();
    }};
  })();

  /* =====================================================================
     Contrast checker module
     ===================================================================== */

  const Contrast = (() => {
    const els = {
      fg: $("#fgColor"), fgHex: $("#fgHex"),
      bg: $("#bgColor"), bgHex: $("#bgHex"),
      ratio: $("#ratioValue"),
      preview: $("#contrastPreview"),
      grades: $("#contrastGrades"),
    };

    const THRESHOLDS = [
      { label: "AA · normal", min: 4.5 },
      { label: "AA · large", min: 3 },
      { label: "AAA · normal", min: 7 },
      { label: "AAA · large", min: 4.5 },
    ];

    function update() {
      const fg = Color.normalizeHex(els.fgHex.value) || els.fg.value;
      const bg = Color.normalizeHex(els.bgHex.value) || els.bg.value;
      const ratio = Color.contrastRatio(fg, bg);
      els.ratio.textContent = ratio.toFixed(2);
      els.preview.style.background = bg;
      els.preview.style.color = fg;
      els.grades.innerHTML = THRESHOLDS.map((t) => {
        const pass = ratio >= t.min;
        return `<li class="grade ${pass ? "pass" : "fail"}">
          <span aria-hidden="true">${pass ? "&#10003;" : "&#10007;"}</span>${t.label}
        </li>`;
      }).join("");
    }

    function bindPair(picker, hexInput) {
      picker.addEventListener("input", () => { hexInput.value = picker.value.toUpperCase(); update(); });
      hexInput.addEventListener("change", () => {
        const norm = Color.normalizeHex(hexInput.value);
        if (norm) { picker.value = norm; hexInput.setCustomValidity(""); update(); }
        else { hexInput.setCustomValidity("Enter a valid 6-digit hex color."); }
      });
    }

    function init() {
      if (!els.fg) return;
      bindPair(els.fg, els.fgHex);
      bindPair(els.bg, els.bgHex);
      update();
    }
    return { init };
  })();

  /* =====================================================================
     Saved palettes library module
     ===================================================================== */

  const Library = (() => {
    const list = $("#savedList");
    const empty = $("#savedEmpty");

    function render() {
      const saved = Store.read();
      if (empty) empty.hidden = saved.length > 0;
      if (!list) return;
      list.innerHTML = "";
      saved.forEach((entry) => {
        const li = document.createElement("li");
        li.className = "saved-card";
        const strip = entry.colors.map((c) => `<span style="background:${c}"></span>`).join("");
        li.innerHTML = `
          <div class="saved-strip" role="img" aria-label="Palette: ${entry.colors.join(", ")}">${strip}</div>
          <div class="saved-actions">
            <button type="button" data-action="load">Load</button>
            <button type="button" data-action="copy">Copy</button>
            <button type="button" data-action="remove">Remove</button>
          </div>`;
        $('[data-action="load"]', li).addEventListener("click", () => {
          Generator.load(entry.colors);
          document.getElementById("generator").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        $('[data-action="copy"]', li).addEventListener("click", () => copyText(JSON.stringify(entry.colors)));
        $('[data-action="remove"]', li).addEventListener("click", () => remove(entry.id));
        list.appendChild(li);
      });
    }

    function save(colors) {
      const saved = Store.read();
      saved.unshift({ id: Date.now().toString(36), colors, created: new Date().toISOString() });
      Store.write(saved.slice(0, 60));
      render();
    }

    function remove(id) {
      Store.write(Store.read().filter((e) => e.id !== id));
      render();
    }

    function init() { render(); }
    return { init, save };
  })();

  /* =====================================================================
     Theme module
     ===================================================================== */

  const Theme = (() => {
    const KEY = "decorpalette.theme";
    const btn = $("#themeToggle");
    const order = ["auto", "light", "dark"];

    function apply(mode) {
      document.documentElement.setAttribute("data-theme", mode);
      if (btn) {
        btn.setAttribute("aria-pressed", String(mode !== "auto"));
        const label = $(".theme-toggle-label", btn);
        if (label) label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      }
    }

    function init() {
      const saved = localStorage.getItem(KEY) || "auto";
      apply(saved);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const current = localStorage.getItem(KEY) || "auto";
        const next = order[(order.indexOf(current) + 1) % order.length];
        localStorage.setItem(KEY, next);
        apply(next);
      });
    }
    return { init };
  })();

  /* ----------------------------------------------------------- Boot */

  function boot() {
    const yr = $("#year");
    if (yr) yr.textContent = new Date().getFullYear();
    Theme.init();
    Generator.init();
    Contrast.init();
    Library.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
