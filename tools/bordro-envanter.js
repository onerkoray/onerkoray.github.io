/* Bordro sayfasının envanteri: araçları HTML bağımlılıklarından, testleri çalıştırarak okur. */
"use strict";
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var KOK = path.dirname(__dirname);

function araclar(kok) {
  kok = kok || KOK;
  return fs.readdirSync(kok, { withFileTypes: true }).filter(function (d) {
    return d.isDirectory() && d.name[0] !== "." && d.name !== "bordro" && d.name !== "_cekirdek";
  }).map(function (d) {
    var dosya = path.join(kok, d.name, "index.html");
    if (!fs.existsSync(dosya)) return null;
    var html = fs.readFileSync(dosya, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    var kaynaklar = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)).map(function (m) {
      return path.resolve(path.dirname(dosya), m[1].split(/[?#]/)[0]);
    });
    var baglar = kaynaklar.filter(function (p) { return path.dirname(p) === path.join(kok, "bordro"); });
    if (!baglar.length) return null;
    var baslik = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    return {
      slug: d.name,
      ad: baslik ? baslik[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : d.name,
      cekirdek: baglar.indexOf(path.join(kok, "bordro", "motor.js")) !== -1,
      dosyalar: baglar.map(function (p) { return path.basename(p); })
    };
  }).filter(Boolean).sort(function (a, b) { return a.slug.localeCompare(b.slug, "tr"); });
}

function testOzeti(cikti) {
  var m = cikti.match(/(?:^|\n)(\d+)\s+(?:geçti|gecti),\s*(\d+)\s+(?:kaldı|kaldi)\./);
  if (!m || Number(m[2]) !== 0) throw new Error("Test özeti okunamadı veya başarısız doğrulama var.");
  return Number(m[1]);
}

function testler() {
  return fs.readdirSync(path.join(KOK, "bordro")).filter(function (f) {
    return f === "test.js" || /-test\.js$/.test(f);
  }).sort().map(function (f) {
    var cikti = cp.execFileSync(process.execPath, [path.join(KOK, "bordro", f)], { encoding: "utf8" });
    return { dosya: f, sayi: testOzeti(cikti) };
  });
}

module.exports = { araclar: araclar, testler: testler, testOzeti: testOzeti };
