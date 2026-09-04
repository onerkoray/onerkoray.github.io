/* WiFi Şifresi Üreteci — kolay yazılan güçlü şifre */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz"; // O,I,l çıkarıldı
  var LETTERS_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var DIGITS = "23456789", DIGITS_ALL = "0123456789";
  var SYMS = "!@#$%*-_+=";
  function idx(n) { var a = new Uint32Array(1); var lim = Math.floor(0xFFFFFFFF / n) * n, x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
  function setStrength(bits) {
    var pct, cls, label;
    if (bits < 50) { pct = 40; cls = "warn"; label = "Orta"; }
    else if (bits < 80) { pct = 75; cls = "ok"; label = "Güçlü"; }
    else { pct = 100; cls = "strong"; label = "Çok güçlü"; }
    el("meterBar").style.width = pct + "%"; el("meterBar").className = "meter-bar bar-" + cls;
    el("strength").textContent = "Güç: " + label + " · ~" + Math.round(bits) + " bit"; el("strength").className = "strength-label s-" + cls;
  }
  function gen() {
    var len = parseInt(el("len").value, 10), noAmb = el("noAmb").checked;
    var pool = (noAmb ? LETTERS : LETTERS_ALL) + (noAmb ? DIGITS : DIGITS_ALL) + (el("sym").checked ? SYMS : "");
    var out = ""; for (var i = 0; i < len; i++) out += pool[idx(pool.length)];
    el("pw").value = out;
    setStrength(len * (Math.log(pool.length) / Math.log(2)));
    el("status").textContent = "";
  }
  el("len").addEventListener("input", function () { el("lenVal").textContent = el("len").value; gen(); });
  ["noAmb","sym"].forEach(function (id) { el(id).addEventListener("change", gen); });
  el("genBtn").addEventListener("click", gen);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("pw").value) return;
    try { await navigator.clipboard.writeText(el("pw").value); el("status").textContent = "WiFi şifresi kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  gen();
})();
