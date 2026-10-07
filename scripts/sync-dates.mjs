#!/usr/bin/env node
/*
 * Sayfalardaki tarihleri içerik manifestine (content.json) eşitler.
 *
 *   - JSON-LD'deki her "dateModified" = manifest updated (yayın tarihinden
 *     önce olamaz).
 *   - Yazılarda (.ed-meta): yayın tarihi görünür kalır; içerik yayından
 *     sonra değiştiyse yanına ayrı bir "Güncelleme: <time>" öğesi gelir
 *     (AGENTS.md: yayın tarihini güncelleme tarihiyle ezme).
 *   - Ana sayfa kartlarındaki "Güncellendi" tarihi tools/arac-guncelleme.py
 *     ile aynı fonksiyondan yazılır; makale listeleri tools/makale-listesi.py
 *     ile sayfanın dateModified'ından. İkisi de bu betikten sonra koşar.
 *
 * Tarih satırları değişiklik dedektöründe içerik sayılmaz, yani bu betiğin
 * yazdığı commit hiçbir sayfanın tarihini ilerletmez.
 *
 * Kullanım:
 *   node scripts/sync-dates.mjs           # yaz
 *   node scripts/sync-dates.mjs --check   # eşit mi (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const uzun = (iso) => { const [y, a, g] = iso.split("-"); return +g + " " + AYLAR[+a - 1] + " " + y; };

export function esitle(html, sayfa) {
  const yay = (html.match(/"datePublished":\s*"([\d-]+)/) || [])[1];
  if (!sayfa.updated) return html;
  const D = yay && yay.slice(0, 10) > sayfa.updated ? yay.slice(0, 10) : sayfa.updated;
  let s = html.replace(/("dateModified":\s*")[\d-]+(?:T[^"]*)?(")/g, "$1" + D + "$2");
  if (sayfa.type !== "makale") return s;
  if (!yay) return s;
  const m = s.match(/(<p class="ed-meta">)([\s\S]*?)(<\/p>)/);
  if (!m) return bylineEsitle(s, yay.slice(0, 10), D);
  const y = yay.slice(0, 10);
  let meta = m[2];
  const GUN = /(\s*<span class="ed-sep" aria-hidden="true">·<\/span>)?\s*<span>Güncelleme: <time datetime="[\d-]+">[^<]*<\/time><\/span>/;
  const girinti = (meta.match(/\n(\s*)<span/) || [, "          "])[1];
  meta = meta.replace(GUN, "");
  /* Yayın tarihi görünür değilse (eski biçim: yalnız "Güncelleme") geri gelir. */
  if (!new RegExp('<time datetime="' + y + '"').test(meta)) {
    meta = meta.replace(/\s*$/, "") + "\n" + girinti + '<span class="ed-sep" aria-hidden="true">·</span>\n' + girinti + '<time datetime="' + y + '">' + uzun(y) + "</time>";
  }
  if (D > y) {
    meta = meta.replace(/\s*$/, "") + "\n" + girinti + '<span class="ed-sep" aria-hidden="true">·</span>\n' + girinti + '<span>Güncelleme: <time datetime="' + D + '">' + uzun(D) + "</time></span>";
  }
  meta = meta.replace(/\s*$/, "\n" + girinti.slice(2));
  return s.replace(m[0], m[1] + meta + m[3]);
}

/* Eski biçim: <p class="byline muted">Hazırlayan … · <time>yayın</time></p>.
   Güncelleme aynı satırda " · " ile ayrılmış ayrı bir öğe olarak durur. */
function bylineEsitle(s, y, D) {
  const m = s.match(/(<p class="byline[^"]*">)([\s\S]*?)(<\/p>)/);
  if (!m) return s;
  let ic = m[2].replace(/\s*·\s*<span>Güncelleme: <time datetime="[\d-]+">[^<]*<\/time><\/span>/, "");
  if (D > y) ic = ic.replace(/\s*$/, "") + ' · <span>Güncelleme: <time datetime="' + D + '">' + uzun(D) + "</time></span>";
  return s.replace(m[0], m[1] + ic + m[3]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const kontrol = process.argv.includes("--check");
  const bayat = [];
  for (const p of M.sayfalar) {
    const yol = join(KOK, p.dosya), eski = readFileSync(yol, "utf8"), yeni = esitle(eski, p);
    if (yeni === eski) continue;
    bayat.push(p.dosya); if (!kontrol) writeFileSync(yol, yeni);
  }
  if (kontrol) {
    if (bayat.length) { console.error("Tarihleri manifestle eşit olmayan sayfa (" + bayat.length + "): " + bayat.slice(0, 8).join(", ") + " — 'node scripts/sync-dates.mjs' çalıştırın."); process.exit(1); }
    console.log("Sayfa tarihleri manifestle eşit.");
  } else console.log(bayat.length + " sayfa güncellendi.");
}
