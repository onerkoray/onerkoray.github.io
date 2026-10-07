#!/usr/bin/env node
/*
 * Sayfa kabuğuna manifestten türeyen ortak parçaları yazar.
 *
 *   - <head>'de Atom akışı bağlantıları (rel="alternate"): her sayfada genel
 *     akış; yazılarda ve Makaleler sayfasında yazı akışı; araçlarda ve ana
 *     sayfada araç akışı. Kök yollu yazılır: her sayfada aynı satır.
 *
 * Kabuk içerik değildir: tools/arac-guncelleme.py bu satırları özlü
 * değişiklik saymaz, yani bu betiğin yazdığı commit hiçbir tarihi ilerletmez.
 *
 * Kullanım:
 *   node scripts/apply-shell.mjs           # yaz
 *   node scripts/apply-shell.mjs --check   # güncel mi (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AKISLAR } from "./build-feeds.mjs";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const BAS = "<!-- AKIS:BASLANGIC -->", BIT = "<!-- AKIS:BITIS -->";

function akislar(p) {
  const l = [AKISLAR[0]];
  if (p.type === "makale" || p.url === M.site + "/makaleler/") l.push(AKISLAR[1]);
  if (p.type === "arac" || p.url === M.site + "/") l.push(AKISLAR[2]);
  return l;
}

export function kabuk(html, p) {
  const blok = "  " + BAS + "\n" + akislar(p).map((a) =>
    '  <link rel="alternate" type="application/atom+xml" title="' + a.baslik + '" href="/' + a.dosya + '">').join("\n") + "\n  " + BIT;
  const i = html.indexOf(BAS), j = html.indexOf(BIT);
  if (i >= 0 && j > i) {
    const satirBasi = html.lastIndexOf("\n", i) + 1;
    return html.slice(0, satirBasi) + blok + html.slice(j + BIT.length);
  }
  const can = html.match(/\n[ \t]*<link rel="canonical"[^>]*>/);
  const yer = can ? can.index + can[0].length : html.indexOf("\n</head>");
  return html.slice(0, yer) + "\n" + blok + html.slice(yer);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const kontrol = process.argv.includes("--check");
  const bayat = [];
  for (const p of M.sayfalar) {
    const yol = join(KOK, p.dosya), eski = readFileSync(yol, "utf8"), yeni = kabuk(eski, p);
    if (yeni === eski) continue;
    bayat.push(p.dosya);
    if (!kontrol) writeFileSync(yol, yeni);
  }
  if (kontrol) {
    if (bayat.length) { console.error("Kabuğu bayat sayfa (" + bayat.length + "): " + bayat.slice(0, 8).join(", ") + " — 'node scripts/apply-shell.mjs' çalıştırın."); process.exit(1); }
    console.log("Sayfa kabukları güncel.");
  } else console.log(bayat.length + " sayfanın kabuğu yazıldı.");
}
