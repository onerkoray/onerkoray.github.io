/* İnternet Hız Testi — indirme hızı + ping ölçümü (aynı origin, bağımlılıksız) */
(function () {
  "use strict";

  var PAYLOAD = "payload.bin";
  var PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
  var DL_DURATION = 8000;              // ~8 sn indirme ölçümü
  var PING_COUNT = 6;

  var els = {
    start: document.getElementById("startBtn"),
    dl: document.getElementById("dl-value"),
    ping: document.getElementById("ping-value"),
    bar: document.getElementById("progressBar"),
    status: document.getElementById("status")
  };

  var nf1 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

  function bust(url) { return url + "?t=" + Date.now() + "-" + Math.random().toString(36).slice(2); }
  function setProgress(p) { if (els.bar) els.bar.style.width = Math.max(0, Math.min(100, p)) + "%"; }
  function status(msg) { if (els.status) els.status.textContent = msg; }

  // Ping: küçük Range isteğiyle gidiş-dönüş süresi; en düşük değeri al.
  async function measurePing() {
    var times = [];
    for (var i = 0; i < PING_COUNT; i++) {
      var t0 = performance.now();
      try {
        await fetch(bust(PAYLOAD), { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-store" });
        times.push(performance.now() - t0);
      } catch (e) { /* yoksay */ }
      setProgress((i + 1) / PING_COUNT * 20);
    }
    if (!times.length) return null;
    times.sort(function (a, b) { return a - b; });
    return times[0];
  }

  // İndirme: süre dolana kadar dosyayı tekrar tekrar indir, inen baytı say.
  async function measureDownload() {
    var totalBytes = 0;
    var start = performance.now();
    var elapsed = 0;
    while (elapsed < DL_DURATION) {
      var res = await fetch(bust(PAYLOAD), { cache: "no-store" });
      if (!res.ok || !res.body) {
        // Akış yoksa tek seferde oku
        var buf = await res.arrayBuffer();
        totalBytes += buf.byteLength;
      } else {
        var reader = res.body.getReader();
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          totalBytes += chunk.value.length;
          elapsed = performance.now() - start;
          setProgress(20 + (elapsed / DL_DURATION) * 80);
          if (elapsed >= DL_DURATION) { try { reader.cancel(); } catch (e) {} break; }
        }
      }
      elapsed = performance.now() - start;
      setProgress(20 + (elapsed / DL_DURATION) * 80);
      if (totalBytes === 0 && elapsed > 3000) break; // güvenlik
    }
    var seconds = (performance.now() - start) / 1000;
    if (seconds <= 0 || totalBytes === 0) return null;
    return (totalBytes * 8) / seconds / 1e6; // Mbps
  }

  async function runTest() {
    els.start.disabled = true;
    els.dl.textContent = "—";
    els.ping.textContent = "—";
    setProgress(0);

    try {
      status("Ping ölçülüyor…");
      var ping = await measurePing();
      els.ping.textContent = ping == null ? "—" : nf0.format(Math.round(ping));

      status("İndirme hızı ölçülüyor…");
      var mbps = await measureDownload();
      els.dl.textContent = mbps == null ? "—" : nf1.format(mbps);

      setProgress(100);
      status(mbps == null ? "Ölçüm yapılamadı, tekrar deneyin." : "Test tamamlandı. Tekrar ölçmek için başlatın.");
    } catch (e) {
      status("Bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      els.start.disabled = false;
    }
  }

  if (els.start) els.start.addEventListener("click", runTest);
})();
