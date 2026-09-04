/* Hash Üreteci — Web Crypto ile SHA-1/256/384/512 */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  function hex(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  async function compute() {
    var text = el("input").value, algo = el("algo").value;
    if (!crypto.subtle) { el("output").value = "Tarayıcınız Web Crypto API desteklemiyor."; return; }
    try {
      var data = new TextEncoder().encode(text);
      var digest = await crypto.subtle.digest(algo, data);
      el("output").value = hex(digest);
      el("status").textContent = algo + " · " + (hex(digest).length * 4) + " bit";
    } catch (e) { el("output").value = "Hesaplama hatası."; }
  }
  el("input").addEventListener("input", compute);
  el("algo").addEventListener("change", compute);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("output").value) return;
    try { await navigator.clipboard.writeText(el("output").value); el("status").textContent = "Özet kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  compute();
})();
