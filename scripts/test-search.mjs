#!/usr/bin/env node
/*
 * Arama kabul testi — Pagefind dizini gerçek bir tarayıcıda sorgulanır.
 *
 * Sitenin kökü (ve içindeki pagefind/ dizini) yerel bir HTTP sunucusundan
 * verilir; başsız Chrome'da pagefind.js yüklenip sorgular koşulur.
 *   1. Her kabul sorgusu ilk 5 sonuçta ilgili aracı VE en az bir yazıyı
 *      döndürür.
 *   2. Diakritiksiz yazım aynı sonuçları verir ("kidem" = "kıdem").
 *   3. Aktarım (gzip) ölçülür. Paletin açılışı (arama.js + öne çıkanlar;
 *      Pagefind henüz yüklenmez) 60 KB bütçesine tabidir. İlk sorgu Pagefind'ı
 *      yükler; Türkçe WASM tek başına ~70 KB olduğu için 60 KB'a sığmaz,
 *      ölçülüp raporlanır.
 *
 * Kullanım: node scripts/test-search.mjs [--chrome <yol>]
 * Dizini kendisi kurar (scripts/build-search.mjs) ve geçici bir klasöre
 * yazar; çalışma ağacına pagefind/ bırakmaz (başka testler ağacı tarıyor).
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const arg = (ad, v) => { const i = process.argv.indexOf(ad); return i > 0 ? process.argv[i + 1] : v; };
const SITE = arg("--site", KOK);
const PF = join(tmpdir(), "korayoner-pf-" + process.pid);
execFileSync(process.execPath, [join(KOK, "scripts", "build-search.mjs"), "--output", PF], { stdio: ["ignore", "ignore", "inherit"] });
const CHROME = arg("--chrome", process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"
].find((p) => existsSync(p)));
const BUTCE_KB = 60;
/* Sıralama parametresi denemesi: --ranking '{"termSaturation":0.6}'. Yoksa arama.js'teki RANKING. */
const RANKING = arg("--ranking") ? JSON.parse(arg("--ranking")) : null;

/* Kabul sorguları: [sorgu, ilgili araç(lar), diakritiksiz eşi]. SGK tavanı
   tek bir aracın konusu değil: maaş, işveren maliyeti ve prim-ikramiye
   araçlarının üçü de tavanı hesaplıyor. */
const SORGULAR = [
  ["kıdem", "/kidem-tazminati-hesaplama/", "kidem"],
  ["SGK tavanı", ["/maas-hesaplama/", "/isveren-maliyeti-hesaplama/", "/prim-ikramiye-vergisi/"], "sgk tavani"],
  ["ikramiye", "/prim-ikramiye-vergisi/", "ikramiye"],
  ["MTV 2026", "/mtv-hesaplama/", "mtv 2026"],
  ["emekli zammı", "/emekli-zammi-hesaplama/", "emekli zammi"],
  ["işsizlik", "/issizlik-maasi-hesaplama/", "issizlik"],
  ["ötv", "/otv-hesaplama/", "otv"]
];

const TUR = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const aktarilan = [];
const sunucu = createServer((req, res) => {
  let yol = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (yol === "/__test__") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end("<!doctype html><html lang=tr><body></body></html>"); }
  let dosya = yol.startsWith("/pagefind/") ? join(PF, yol.slice(10)) : join(SITE, yol);
  if (existsSync(dosya) && statSync(dosya).isDirectory()) dosya = join(dosya, "index.html");
  if (!existsSync(dosya)) { res.writeHead(404); return res.end(); }
  const veri = readFileSync(dosya);
  if (yol.startsWith("/pagefind/") || yol === "/arama.js" || yol === "/arama-oneriler.json") aktarilan.push({ yol, gz: /\.(pf_|wasm)/.test(yol) || /\.pf_/.test(yol) ? veri.length : gzipSync(veri).length });
  res.writeHead(200, { "content-type": TUR[extname(dosya)] || "application/octet-stream" });
  res.end(veri);
});
await new Promise((r) => sunucu.listen(0, "127.0.0.1", r));
const PORT = sunucu.address().port, ADRES = "http://127.0.0.1:" + PORT;

const port = 9400 + Math.floor((Date.now() / 1000) % 500);
const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + port, "--user-data-dir=" + join(tmpdir(), "ara-test-" + port), "about:blank"]);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let hedef;
for (let i = 0; i < 60 && !hedef; i++) { try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} if (!hedef) await bekle(250); }
const ws = new WebSocket(hedef.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const b = {};
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && b[m.id]) { b[m.id](m.result || m); delete b[m.id]; } });
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; b[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
await cdp("Page.navigate", { url: ADRES + "/__test__" }); await bekle(800);
/* Arama, sitenin kendi modülünden (arama.js sorgula) yapılır: katlama ve
   başlık önceliği dahil, okurun gördüğü sıra sınanır. */
const ara = async (q) => (await cdp("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
  window.A = window.A || await import("/arama.js");
  const r = await window.A.sorgula(${JSON.stringify(q)}, { sinir: 5 });
  return { toplam: r.toplam, ilk: r.sonuclar.map((d) => ({ url: d.url, tur: d.tur, baslik: d.baslik })) };
})()` })).result.value;

/* Hata ayıklama: bir sayfanın dizindeki içeriği. */
if (arg("--icerik")) {
  const r = (await cdp("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    window.pf = window.pf || await import("/pagefind/pagefind.js");
    const r = await window.pf.search("emekli");
    for (const x of r.results) { const d = await x.data(); if (d.url.endsWith(${JSON.stringify(arg("--icerik"))})) return d.content.slice(0, 1500); }
    return "yok: " + (await Promise.all(r.results.map(async (x) => (await x.data()).url))).join(" ");
  })()` })).result.value;
  console.log(r); ws.close(); ch.kill(); sunucu.close(); process.exit(0);
}
/* Hata ayıklama: tek sorgunun ilk 15 sonucu ve puanları. */
if (arg("--sorgu")) {
  const r = (await cdp("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    window.pf = window.pf || await import("/pagefind/pagefind.js");
    const n = (await import("/arama.js")).normalize;
    const r = await window.pf.search(n(${JSON.stringify(arg("--sorgu"))}));
    return Promise.all(r.results.slice(0, 15).map(async (x) => { const d = await x.data(); return [x.score.toFixed(3), d.url, d.word_count]; }));
  })()` })).result.value;
  r.forEach((x) => console.log("  " + x.join("  ")));
  ws.close(); ch.kill(); sunucu.close(); process.exit(0);
}

let hata = 0;
/* Paletin açılışı: modül ve öne çıkanlar (ac() boş sorguyla bunları çeker). */
await cdp("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
  window.A = await import("/arama.js"); await (await fetch("/arama-oneriler.json")).json(); return 1; })()` });
const acilisKb = aktarilan.reduce((t, a) => t + a.gz, 0) / 1024;
const acilisSayisi = aktarilan.length;
const ilkAcilis = await ara(SORGULAR[0][0]);
const ilkKb = aktarilan.slice(acilisSayisi).reduce((t, a) => t + a.gz, 0) / 1024;
for (const [q, arac, duz] of SORGULAR) {
  const r1 = await ara(q), r2 = await ara(duz);
  const yollar = (r) => r.ilk.map((x) => x.url.replace(/^https?:\/\/[^/]+/, ""));
  const aracVar = [].concat(arac).some((a) => yollar(r1).includes(a)), yaziVar = yollar(r1).some((u) => u.startsWith("/makaleler/") && u !== "/makaleler/");
  const ayni = JSON.stringify(yollar(r1)) === JSON.stringify(yollar(r2));
  const tamam = aracVar && yaziVar && ayni;
  if (!tamam) hata++;
  console.log((tamam ? "  tamam     " : "  KIRMIZI   ") + JSON.stringify(q) + " / " + JSON.stringify(duz) + " — " + r1.toplam + " sonuç; araç " + (aracVar ? "var" : "YOK") + ", yazı " + (yaziVar ? "var" : "YOK") + ", diakritiksiz " + (ayni ? "aynı" : "FARKLI"));
  if (!tamam) console.log("      " + yollar(r1).join("  ") + "\n      " + yollar(r2).join("  "));
}
console.log("\nPaletin açılışı: " + acilisKb.toFixed(1) + " KB (gzip, bütçe " + BUTCE_KB + " KB)");
if (acilisKb > BUTCE_KB) { hata++; console.log("  KIRMIZI   açılış bütçesi aşıldı"); }
console.log("İlk sorgu (Pagefind yüklenir): " + ilkKb.toFixed(1) + " KB (gzip; raporlanır)");
for (const a of aktarilan.slice(acilisSayisi, acilisSayisi + 14)) console.log("      " + a.yol + "  " + (a.gz / 1024).toFixed(1) + " KB");
void ilkAcilis;

/* Klavye ve ekran okuyucu: gerçek bir sayfada palet. */
console.log("\nArama paleti klavyeyle");
await cdp("Page.navigate", { url: ADRES + "/kidem-tazminati-hesaplama/" }); await bekle(1500);
const tus = async (key, mod = 0, code = key, vk = 0) => {
  for (const type of ["keyDown", "keyUp"]) await cdp("Input.dispatchKeyEvent", { type, key, code, modifiers: mod, windowsVirtualKeyCode: vk });
  await bekle(150);
};
const durum = async () => (await cdp("Runtime.evaluate", { returnByValue: true, expression: `(() => {
  const o = document.querySelector(".ara-ortu"), d = o && o.querySelector('[role="dialog"]');
  return { acik: !!o && !o.hidden, modal: d && d.getAttribute("aria-modal"), etiket: d && !!document.getElementById(d.getAttribute("aria-labelledby")),
    odakIcinde: !!o && o.contains(document.activeElement), odak: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
    canli: !!(o && o.querySelector('[role="status"][aria-live="polite"]')), durum: o && o.querySelector(".ara-durum").textContent };
})()` })).result.value;
const kontrol = (ad, k) => { if (!k) hata++; console.log((k ? "  tamam     " : "  KIRMIZI   ") + ad); };
await tus("k", 2, "KeyK", 75);                       // Ctrl+K
let d = await durum();
kontrol("Ctrl+K paleti açar, odak arama kutusunda", d.acik && d.odak === "ara-q");
kontrol("dialog aria-modal ve başlığıyla etiketli (aria-labelledby)", d.modal === "true" && d.etiket);
for (let i = 0; i < 12; i++) await tus("Tab", 0, "Tab", 9);
d = await durum();
kontrol("Tab odağı paletin dışına çıkarmıyor (odak hapsi)", d.acik && d.odakIcinde);
await cdp("Runtime.evaluate", { expression: `document.getElementById("ara-q").focus()` });
await cdp("Input.insertText", { text: "kidem" }); await bekle(1800);
d = await durum();
kontrol("sonuç sayısı canlı bölgede duyuruluyor (" + d.durum + ")", d.canli && /\d+ sonuç/.test(d.durum));
await tus("Escape", 0, "Escape", 27);
d = await durum();
kontrol("Esc kapatır, odak açılmadan önceki yere döner", !d.acik && d.odak !== "ara-q");
await tus("/", 0, "Slash", 191);
d = await durum();
kontrol("\"/\" kısayolu paleti açar", d.acik && d.odak === "ara-q");

ws.close(); ch.kill(); sunucu.close(); rmSync(PF, { recursive: true, force: true });
console.log(hata ? "\n" + hata + " kırmızı. (arama testi)" : "\nHepsi yeşil. (arama testi)");
process.exit(hata ? 1 : 0);
