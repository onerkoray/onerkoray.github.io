/* Parola Cümlesi Üreteci — rastgele Türkçe kelimelerden passphrase */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var WORDS = ("kartal deniz ruzgar orman yildiz kedi nehir dag bulut yaprak gunes ay kar yagmur cicek ari bal kus kaya kum toprak gol ates demir gumus altin bakir mavi yesil kirmizi sari mor turuncu pembe siyah beyaz gri kaplan aslan ceylan tilki kurt ayi baykus sahin marti balina yunus fok midye inci elmas yakut zumrut safir kristal mercan lale gul papatya menekse zambak nane kekik defne feslegen tarcin karanfil kahve cay limon portakal elma armut kiraz uzum incir kayisi seftali muz erik nar ceviz findik badem antep sakiz cinar mese kavak sogut selvi kestane meltem firtina simsek dalga gelgit ufuk safak alacakaranlik gece sabah aksam ogle bahar yaz sonbahar kis").split(" ");
  function pick() { var a = new Uint32Array(1); var n = WORDS.length; var lim = Math.floor(0xFFFFFFFF / n) * n, x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return WORDS[x % n]; }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
  function randDigit() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % 10; }
  function setStrength(bits) {
    var pct, cls, label;
    if (bits < 45) { pct = 40; cls = "warn"; label = "Orta"; }
    else if (bits < 70) { pct = 75; cls = "ok"; label = "Güçlü"; }
    else { pct = 100; cls = "strong"; label = "Çok güçlü"; }
    el("meterBar").style.width = pct + "%"; el("meterBar").className = "meter-bar bar-" + cls;
    el("strength").textContent = "Güç: " + label + " · ~" + Math.round(bits) + " bit"; el("strength").className = "strength-label s-" + cls;
  }
  function gen() {
    var n = parseInt(el("count").value, 10), sep = el("sep").value, words = [];
    for (var i = 0; i < n; i++) { var w = pick(); words.push(el("cap").checked ? cap(w) : w); }
    var phrase = words.join(sep);
    if (el("num").checked) phrase += sep + (randDigit() + "" + randDigit());
    el("phrase").value = phrase;
    // entropi ~ kelime sayısı * log2(havuz) + rakam
    var bits = n * (Math.log(WORDS.length) / Math.log(2)) + (el("num").checked ? 6.6 : 0);
    setStrength(bits);
    el("status").textContent = "";
  }
  el("count").addEventListener("input", function () { el("countVal").textContent = el("count").value; gen(); });
  ["sep","cap","num"].forEach(function (id) { el(id).addEventListener("change", gen); });
  el("genBtn").addEventListener("click", gen);
  el("copyBtn").addEventListener("click", async function () {
    if (!el("phrase").value) return;
    try { await navigator.clipboard.writeText(el("phrase").value); el("status").textContent = "Parola cümlesi kopyalandı."; }
    catch (e) { el("status").textContent = "Kopyalama başarısız."; }
  });
  gen();
})();
