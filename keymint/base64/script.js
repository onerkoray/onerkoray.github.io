/* Base64 Kodlayıcı / Çözücü — UTF-8 uyumlu */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  function encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\s+/g, ""))));
  }
  function run() {
    var mode = el("mode").value, input = el("input").value;
    try {
      el("output").value = mode === "encode" ? encode(input) : decode(input);
      el("status").textContent = "";
    } catch (e) {
      el("output").value = "";
      el("status").textContent = mode === "decode" ? "Geçersiz Base64 verisi." : "Kodlama hatası.";
    }
  }
  el("mode").addEventListener("change", function () {
    var ph = el("mode").value === "encode" ? "Metni buraya yazın" : "Base64 verisini buraya yapıştırın";
    el("input").setAttribute("placeholder", ph);
    run();
  });
  el("input").addEventListener("input", run);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("output").value) return;
    try { await navigator.clipboard.writeText(el("output").value); el("status").textContent = "Sonuç kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  run();
})();
