/* UUID Üreteci — kriptografik UUID v4 (toplu) */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = []; for (var i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, "0"));
    return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15];
  }
  function gen() {
    var n = parseInt(el("count").value, 10), up = el("upper").checked, list = [];
    for (var i = 0; i < n; i++) { var u = uuid(); list.push(up ? u.toUpperCase() : u); }
    el("output").value = list.join("\n");
    el("status").textContent = n + " UUID üretildi.";
  }
  el("count").addEventListener("input", function () { el("countVal").textContent = el("count").value; gen(); });
  el("upper").addEventListener("change", gen);
  el("genBtn").addEventListener("click", gen);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("output").value) return;
    try { await navigator.clipboard.writeText(el("output").value); el("status").textContent = "Tüm UUID'ler kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  gen();
})();
