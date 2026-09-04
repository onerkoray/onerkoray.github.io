/* PIN Kodu Üreteci — kriptografik rastgele PIN */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  function randDigit() { var a = new Uint32Array(1); var lim = Math.floor(0xFFFFFFFF / 10) * 10, x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % 10; }
  var WEAK = /^(\d)\1+$/;
  function isSequential(s) {
    var up = true, down = true;
    for (var i = 1; i < s.length; i++) { if (+s[i] !== +s[i-1] + 1) up = false; if (+s[i] !== +s[i-1] - 1) down = false; }
    return up || down;
  }
  function gen() {
    var n = parseInt(el("len").value, 10), avoid = el("avoidWeak").checked, pin;
    var guard = 0;
    do { pin = ""; for (var i = 0; i < n; i++) pin += randDigit(); guard++; }
    while (avoid && guard < 50 && (WEAK.test(pin) || isSequential(pin)));
    el("pin").value = pin;
    el("status").textContent = "";
  }
  el("len").addEventListener("input", function () { el("lenVal").textContent = el("len").value; gen(); });
  el("avoidWeak").addEventListener("change", gen);
  el("genBtn").addEventListener("click", gen);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("pin").value) return;
    try { await navigator.clipboard.writeText(el("pin").value); el("status").textContent = "PIN kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  gen();
})();
