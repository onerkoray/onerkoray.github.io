#!/usr/bin/env node
/*!
 * Araç sayfalarında form ve tablo yazısı tek ölçekte mi? Tarayıcıda ölçer.
 *
 * NEDEN TARAYICIDA
 * ----------------
 * 2026-09-29'da 66 araç sayfası ölçüldü: etiket 7, giriş kutusu 5, tablo
 * hücresi 9 farklı boyuttaydı (12,5 ile 22,4 px arası). Sapmaların çoğu CSS
 * dosyasında YAZILI DEĞİLDİ: "#form input { font: inherit }" kutuyu
 * kaptan, kap boyutunu başka bir kuraldan alıyordu. Statik tarama bunu
 * göremez; burada her öğenin HESAPLANAN boyutu ölçülür.
 *
 * ÖLÇEK (style.css)
 * -----------------
 *   etiket, legend        --type-form-label   (satır içi cümle formunda
 *                         --type-form-control da kabul: "Bir sayının [250]
 *                         yüzde [20] kaçı?" — etiket cümlenin parçası)
 *   metin kutusu, select  --type-form-control (iOS 16 px altında büyütür)
 *   td, tbody th          --type-table
 *   thead th              --type-table-head (tbody'de büyük harfli grup
 *                         başlığı satırı da)
 * Beklenen pikseller sabit yazılmaz: her sayfada token bir sonda öğeyle
 * ölçülür, ölçek değişirse test kendiliğinden uyar.
 *
 * Kullanım: node tools/tipografi-test.js   (CHROME ortam değişkeni ya da
 * bilinen yollardan biri gerekir)
 */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var KOK = path.join(__dirname, "..");
var ADAY = [process.env.CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
var CHROME = ADAY.filter(function (p) { return p && fs.existsSync(p); })[0];

function sayfalar() {
  var liste = [];
  fs.readdirSync(KOK).forEach(function (ad) {
    if (/^[._]/.test(ad) || ad === "node_modules") return;
    var p = path.join(KOK, ad, "index.html");
    if (fs.existsSync(p) && /<body[^>]*class="[^"]*\bcalculator-page\b/.test(fs.readFileSync(p, "utf8"))) liste.push(ad);
  });
  return liste.sort();
}

var OLC = "(" + function () {
  var main = document.querySelector("main");
  function sonda(t) {
    var d = document.createElement("span");
    d.style.fontSize = "var(" + t + ")";
    main.appendChild(d);
    var v = parseFloat(getComputedStyle(d).fontSize);
    d.remove();
    return v;
  }
  var H = { etiket: sonda("--type-form-label"), kontrol: sonda("--type-form-control"),
    tablo: sonda("--type-table"), baslik: sonda("--type-table-head") };
  function gorunur(e) { return e.offsetParent !== null || getComputedStyle(e).position === "fixed"; }
  function ad(e) { return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).join(".") : ""); }
  var sapma = [], say = 0;
  function sina(e, izin, tur) {
    if (!gorunur(e) || e.closest("svg")) return;
    say++;
    var v = parseFloat(getComputedStyle(e).fontSize);
    if (!izin.some(function (h) { return Math.abs(v - h) < 0.05; })) sapma.push(tur + " " + ad(e) + " " + v + "px (beklenen " + izin.join(" ya da ") + ")");
  }
  main.querySelectorAll("label, legend").forEach(function (e) { sina(e, [H.etiket, H.kontrol], "etiket"); });
  main.querySelectorAll("input, select, textarea").forEach(function (e) {
    if (e.tagName === "INPUT" && /^(checkbox|radio|range|hidden|color|submit|button|reset|file|image)$/.test(e.type)) return;
    sina(e, [H.kontrol], "kutu");
  });
  /* Büyük harfli tbody başlık hücresi bir grup başlığıdır ("KIDEM TAZMİNATI"):
     rolü thead ile aynı, ölçeği de. */
  main.querySelectorAll("td, tbody th, tfoot th").forEach(function (e) {
    var grup = e.tagName === "TH" && getComputedStyle(e).textTransform === "uppercase";
    sina(e, grup ? [H.baslik] : [H.tablo], grup ? "grup başlığı" : "hücre");
  });
  main.querySelectorAll("thead th").forEach(function (e) { sina(e, [H.baslik], "başlık"); });
  return JSON.stringify({ say: say, sapma: sapma, H: H });
} + ")()";

function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  if (!CHROME) {
    console.error("Chrome bulunamadı. CHROME ortam değişkenine yolunu yazın.");
    return 1;
  }
  var port = 9400 + Math.floor(Math.random() * 400);
  var profil = fs.mkdtempSync(path.join(os.tmpdir(), "tipografi-"));
  var ch = cp.spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=" + port,
    "--user-data-dir=" + profil, "--window-size=1280,900", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  var hedef;
  for (var i = 0; i < 150 && !hedef; i++) {
    try { hedef = (await (await fetch("http://127.0.0.1:" + port + "/json")).json()).find(function (t) { return t.type === "page"; }); }
    catch (e) { await bekle(200); }
  }
  if (!hedef) { console.error("Chrome açılmadı."); ch.kill(); return 1; }
  var ws = new WebSocket(hedef.webSocketDebuggerUrl);
  await new Promise(function (r) { ws.addEventListener("open", r); });
  var id = 0, bekleyen = {}, yuklendi = null;
  ws.addEventListener("message", function (m) {
    var x = JSON.parse(m.data);
    if (x.id && bekleyen[x.id]) { bekleyen[x.id](x.result); delete bekleyen[x.id]; }
    if (x.method === "Page.loadEventFired" && yuklendi) { yuklendi(); yuklendi = null; }
  });
  function gonder(method, params) {
    return new Promise(function (r) { var k = ++id; bekleyen[k] = r; ws.send(JSON.stringify({ id: k, method: method, params: params || {} })); });
  }
  await gonder("Page.enable");
  await gonder("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  var hata = 0, olculen = 0, liste = sayfalar();
  for (var j = 0; j < liste.length; j++) {
    var s = liste[j];
    var yuk = new Promise(function (r) { yuklendi = r; });
    await gonder("Page.navigate", { url: "file://" + (process.platform === "win32" ? "/" : "") + path.join(KOK, s, "index.html").replace(/\\/g, "/") });
    await Promise.race([yuk, bekle(8000)]);
    await bekle(250);
    var r = await gonder("Runtime.evaluate", { expression: OLC, returnByValue: true });
    var o = JSON.parse(r.result.value);
    olculen += o.say;
    if (o.sapma.length) {
      hata++;
      console.error("  BASARISIZ  " + s + ": " + o.sapma.length + " öğe ölçek dışında");
      o.sapma.slice(0, 4).forEach(function (x) { console.error("              " + x); });
    }
  }
  ws.close(); ch.kill();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* Windows kilidi */ }
  if (hata) { console.error("\n" + hata + " araç sayfasında form ya da tablo yazısı ortak ölçeğin dışında."); return 1; }
  console.log("Tipografi: " + liste.length + " araç sayfasında " + olculen + " öğe ortak ölçekte.");
  return 0;
}

main().then(function (k) { process.exit(k); }, function (e) { console.error(e); process.exit(1); });
