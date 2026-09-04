/* Şifre Güç Testi — entropi tabanlı analiz, tahmini kırılma süresi (offline) */
(function () {
  "use strict";

  var el = function (id) { return document.getElementById(id); };
  var GUESSES_PER_SEC = 1e10; // Saldırgan varsayımı: 10 milyar deneme/sn (modern GPU)

  var COMMON = ["123456", "password", "sifre", "123456789", "qwerty", "111111",
    "12345678", "abc123", "1234567890", "000000", "iloveyou", "admin", "welcome"];

  function poolSize(pw) {
    var size = 0;
    if (/[a-z]/.test(pw)) size += 26;
    if (/[A-Z]/.test(pw)) size += 26;
    if (/[0-9]/.test(pw)) size += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) size += 33;
    return size;
  }

  function entropyBits(pw) {
    var size = poolSize(pw);
    return size ? pw.length * (Math.log(size) / Math.log(2)) : 0;
  }

  function humanTime(seconds) {
    if (seconds < 1) return "anında";
    var units = [
      ["yıl", 31557600], ["gün", 86400], ["saat", 3600], ["dakika", 60], ["saniye", 1]
    ];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][1]) {
        var v = seconds / units[i][1];
        if (v >= 1e9) return Math.round(v / 1e9).toLocaleString("tr-TR") + " milyar " + units[i][0];
        if (v >= 1e6) return Math.round(v / 1e6).toLocaleString("tr-TR") + " milyon " + units[i][0];
        return Math.round(v).toLocaleString("tr-TR") + " " + units[i][0];
      }
    }
    return "anında";
  }

  function feedbackFor(pw) {
    var tips = [];
    if (pw.length < 12) tips.push("Uzunluğu en az 12, tercihen 16 karaktere çıkarın.");
    if (!/[A-Z]/.test(pw)) tips.push("Büyük harf ekleyin.");
    if (!/[a-z]/.test(pw)) tips.push("Küçük harf ekleyin.");
    if (!/[0-9]/.test(pw)) tips.push("Rakam ekleyin.");
    if (!/[^a-zA-Z0-9]/.test(pw)) tips.push("En az bir sembol ekleyin (!@#$).");
    if (/(.)\1\1/.test(pw)) tips.push("Aynı karakteri üç kez tekrarlamaktan kaçının.");
    if (/^[0-9]+$/.test(pw)) tips.push("Yalnızca rakamdan oluşan şifreler zayıftır.");
    if (COMMON.indexOf(pw.toLowerCase()) !== -1) tips.push("Bu, en sık kullanılan şifrelerden biri — kesinlikle değiştirin.");
    if (/^(19|20)\d\d$/.test(pw)) tips.push("Yıl gibi tahmin edilebilir kalıplardan kaçının.");
    return tips;
  }

  function label(bits) {
    if (bits < 40) return { pct: 25, cls: "bad", text: "Zayıf" };
    if (bits < 60) return { pct: 55, cls: "warn", text: "Orta" };
    if (bits < 80) return { pct: 80, cls: "ok", text: "Güçlü" };
    return { pct: 100, cls: "strong", text: "Çok güçlü" };
  }

  function analyze() {
    var pw = el("pw").value;
    var strengthEl = el("strength"), bar = el("meterBar"), out = el("out"), fb = el("feedback");

    if (!pw) {
      bar.style.width = "0"; bar.className = "meter-bar";
      strengthEl.textContent = "Bir şifre yazın"; strengthEl.className = "strength-label";
      out.textContent = ""; fb.innerHTML = "";
      return;
    }

    var bits = entropyBits(pw);
    var isCommon = COMMON.indexOf(pw.toLowerCase()) !== -1;
    var effBits = isCommon ? Math.min(bits, 10) : bits;
    var lab = label(effBits);

    bar.style.width = lab.pct + "%";
    bar.className = "meter-bar bar-" + lab.cls;
    strengthEl.textContent = "Güç: " + lab.text + " · ~" + Math.round(bits) + " bit";
    strengthEl.className = "strength-label s-" + lab.cls;

    var combos = Math.pow(2, effBits);
    var seconds = combos / 2 / GUESSES_PER_SEC;
    out.innerHTML = "Tahmini kırılma süresi: " + humanTime(seconds) +
      '<span class="muted-note">' + pw.length + " karakter · " + poolSize(pw) +
      " karakterlik havuz · saniyede 10 milyar deneme varsayımıyla</span>";

    var tips = feedbackFor(pw);
    fb.innerHTML = tips.length
      ? tips.map(function (t) { return "<li>" + t.replace(/</g, "&lt;") + "</li>"; }).join("")
      : "<li>Harika! Bu şifre güçlü görünüyor. Yine de her hesapta farklı şifre kullanın.</li>";
  }

  el("pw").addEventListener("input", analyze);
  el("reveal").addEventListener("change", function () {
    el("pw").type = this.checked ? "text" : "password";
  });

  // Tema + yıl
  (function () {
    var KEY = "onerkoray.theme", order = ["auto", "light", "dark"], btn = el("themeToggle");
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

  analyze();
})();
