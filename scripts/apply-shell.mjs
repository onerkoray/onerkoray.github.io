#!/usr/bin/env node
/*
 * Sayfa kabuğuna manifestten türeyen ortak parçaları yazar.
 *
 *   - <head>'de Atom akışı bağlantıları (rel="alternate"): her sayfada genel
 *     akış; yazılarda ve Makaleler sayfasında yazı akışı; araçlarda ve ana
 *     sayfada araç akışı. Kök yollu yazılır: her sayfada aynı satır.
 *   - <head>'de site içi arama modülü (/arama.js): başlıktaki "Ara"
 *     bağlantısını, Ctrl/Cmd+K ve "/" kısayollarını arama paletine bağlar.
 *     Dizin sayfaların kendisinden değil, derlemede manifestten kurulan bir
 *     kopyadan üretilir (scripts/build-search.mjs); sayfalara Pagefind
 *     işareti yazılmaz.
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
const ABAS = "<!-- ARAMA:BASLANGIC -->", ABIT = "<!-- ARAMA:BITIS -->";

function akislar(p) {
  const l = [AKISLAR[0]];
  if (p.type === "makale" || p.url === M.site + "/makaleler/") l.push(AKISLAR[1]);
  if (p.type === "arac" || p.url === M.site + "/") l.push(AKISLAR[2]);
  return l;
}
function akisBlogu(p) {
  return "  " + BAS + "\n" + akislar(p).map((a) =>
    '  <link rel="alternate" type="application/atom+xml" title="' + a.baslik + '" href="/' + a.dosya + '">').join("\n") + "\n  " + BIT;
}
/* Önbellek damgası (?v=, tools/stil-damgasi.py) korunur: damgayı o araç yazar. */
const aramaBlogu = (damga) => "  " + ABAS + '\n  <script type="module" src="/arama.js' + damga + '"></script>\n  ' + ABIT;

/* Blok varsa yerinde yenilenir; yoksa `sonra`nın hemen ardına, o da yoksa
   </head>'den önce eklenir. */
function blokYaz(html, bas, bit, blok, sonra) {
  const i = html.indexOf(bas), j = html.indexOf(bit);
  if (i >= 0 && j > i) return html.slice(0, html.lastIndexOf("\n", i) + 1) + blok + html.slice(j + bit.length);
  let yer = -1;
  if (sonra instanceof RegExp) { const m = html.match(sonra); if (m) yer = m.index + m[0].length; }
  else if (sonra && html.indexOf(sonra) >= 0) yer = html.indexOf(sonra) + sonra.length;
  if (yer < 0) yer = html.indexOf("\n</head>");
  return html.slice(0, yer) + "\n" + blok + html.slice(yer);
}

export function kabuk(html, p) {
  html = blokYaz(html, BAS, BIT, akisBlogu(p), /\n[ \t]*<link rel="canonical"[^>]*>/);
  const damga = (html.match(/src="\/arama\.js(\?v=[0-9a-f]+)"/) || [, ""])[1];
  html = blokYaz(html, ABAS, ABIT, aramaBlogu(damga), BIT);
  /* Önceki sürümün sayfa içi Pagefind işaretleri kalmasın. */
  return html.replace(/<main id="main" data-pagefind-body>\n[ \t]*<span data-pagefind-index-attrs="data-ara"[^>]*><\/span>/, '<main id="main">');
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
