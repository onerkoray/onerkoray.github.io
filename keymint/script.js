/* KeyMint — güvenli şifre üreteci (crypto.getRandomValues), güç ölçer, tema */
(function () {
  "use strict";

  var SETS = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?/"
  };
  var AMBIGUOUS = /[0O1lI|`]/g;

  var el = function (id) { return document.getElementById(id); };

  function randomInt(max) {
    // Modulo bias'sız kriptografik rastgele tam sayı [0, max)
    var arr = new Uint32Array(1);
    var limit = Math.floor(0xFFFFFFFF / max) * max;
    var x;
    do { crypto.getRandomValues(arr); x = arr[0]; } while (x >= limit);
    return x % max;
  }

  function buildPool() {
    var pool = "";
    if (el("uppercase").checked) pool += SETS.uppercase;
    if (el("lowercase").checked) pool += SETS.lowercase;
    if (el("numbers").checked) pool += SETS.numbers;
    if (el("symbols").checked) pool += SETS.symbols;
    if (el("noAmbiguous").checked) pool = pool.replace(AMBIGUOUS, "");
    return pool;
  }

  function generate() {
    var len = parseInt(el("length").value, 10);
    var pool = buildPool();
    if (!pool) {
      el("password").value = "";
      setStrength(0, "En az bir karakter türü seçin");
      status("Lütfen en az bir karakter türü seçin.");
      return;
    }
    var out = "";
    for (var i = 0; i < len; i++) out += pool[randomInt(pool.length)];
    el("password").value = out;
    evaluate(out, pool.length);
    status("");
  }

  // Entropi = uzunluk × log2(havuz boyutu)
  function evaluate(pw, poolSize) {
    var entropy = pw.length * (Math.log(poolSize) / Math.log(2));
    var pct, cls, label;
    if (entropy < 40) { pct = 25; cls = "bad"; label = "Zayıf"; }
    else if (entropy < 60) { pct = 55; cls = "warn"; label = "Orta"; }
    else if (entropy < 80) { pct = 80; cls = "ok"; label = "Güçlü"; }
    else { pct = 100; cls = "strong"; label = "Çok güçlü"; }
    setStrength(pct, label + " · ~" + Math.round(entropy) + " bit entropi", cls);
  }

  function setStrength(pct, text, cls) {
    var bar = el("meterBar"), s = el("strength");
    bar.style.width = pct + "%";
    bar.className = "meter-bar" + (cls ? " bar-" + cls : "");
    s.textContent = "Güç: " + text;
    s.className = "strength-label" + (cls ? " s-" + cls : "");
  }

  function status(msg) { var s = el("status"); if (s) s.textContent = msg; }

  async function copy() {
    var pw = el("password").value;
    if (!pw) { status("Önce bir şifre üretin."); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(pw);
      else { var t = el("password"); t.removeAttribute("readonly"); t.select(); document.execCommand("copy"); t.setAttribute("readonly", ""); }
      status("Şifre panoya kopyalandı.");
    } catch (e) { status("Kopyalama başarısız oldu."); }
  }

  el("length").addEventListener("input", function () {
    el("lengthValue").textContent = el("length").value;
    generate();
  });
  ["uppercase", "lowercase", "numbers", "symbols", "noAmbiguous"].forEach(function (id) {
    el(id).addEventListener("change", generate);
  });
  el("generateBtn").addEventListener("click", generate);
  el("copyBtn").addEventListener("click", copy);

  // Tema
  (function () {
    var KEY = "onerkoray.theme";
    var order = ["auto", "light", "dark"];
    var btn = el("themeToggle");
    function apply(m) {
      document.documentElement.setAttribute("data-theme", m);
      var l = btn && btn.querySelector(".theme-toggle-label");
      if (l) l.textContent = m.charAt(0).toUpperCase() + m.slice(1);
    }
    apply(localStorage.getItem(KEY) || "auto");
    if (btn) btn.addEventListener("click", function () {
      var cur = localStorage.getItem(KEY) || "auto";
      var next = order[(order.indexOf(cur) + 1) % order.length];
      localStorage.setItem(KEY, next); apply(next);
    });
  })();

  var yr = el("year"); if (yr) yr.textContent = new Date().getFullYear();

  generate();
})();
