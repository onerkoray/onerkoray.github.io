#!/usr/bin/env node
/*
 * Site içi arama dizini — content.json'dan kurulan bir kopya üzerinde Pagefind.
 *
 * Neden kopya: sayfalara arama işareti yazmak yerine dizin, derleme anında
 * geçici bir klasörde hazırlanan kopyadan üretilir. Kopyada:
 *   - <main> içerik gövdesi olarak işaretlenir (data-pagefind-body);
 *     menü, form, canlı sonuç, künye, ilgili listeleri pagefind.yml dışlar;
 *   - tür ve kategori filtresi, başlık, açıklama ve güncelleme tarihi
 *     manifestten bir öğenin özniteliklerine yazılır (virgüllü metin
 *     bölünmesin diye öznitelik sözdizimi);
 *   - metindeki "ı" → "i", "İ" → "I" katlanır. Pagefind ş, ö, ü, ç, ğ'yi
 *     kendisi katlıyor ama ı ayrı bir harf: "kidem" sorgusu "kıdem"i
 *     bulmuyordu. Sorgu da arama.js'te aynı biçimde katlanır; iki yazım aynı
 *     sonucu verir. Sonuç kartında katlanmış alıntı değil, manifestteki özgün
 *     başlık ve açıklama gösterilir.
 * Dizine girmeyenler: noindex sayfalar ve liste sayfaları (ana sayfa,
 * Makaleler, Araçlar, çalışma dizini, Ara) — her şeyi listeledikleri için
 * asıl içeriği sonuçlarda aşağı itiyorlardı.
 *
 * Kullanım:
 *   node scripts/build-search.mjs [--output <klasör>]   # varsayılan ./pagefind
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const PAGEFIND = "pagefind@1.5.2";
const arg = (ad, v) => { const i = process.argv.indexOf(ad); return i > 0 ? process.argv[i + 1] : v; };
const CIKTI = arg("--output", join(KOK, "pagefind"));

export const TUR_ADI = { arac: "Araç", makale: "Makale", metodoloji: "Metodoloji", grafik: "Grafik", sayfa: "Sayfa" };
const LISTE = new Set(["/", "/makaleler/", "/araclar/", "/koray-oner/", "/ara/"].map((u) => M.site + u));
export const arananir = (p) => !p.noindex && !LISTE.has(p.url);
const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* Yalnız etiket dışı metin katlanır; öznitelikler (bağlantılar, meta) dokunulmaz. */
const katlaMetin = (html) => html.split(/(<[^>]+>)/).map((p, i) => (i % 2 ? p : p.replace(/ı/g, "i").replace(/İ/g, "I"))).join("");

export function kopyala(html, p) {
  const nit = ['data-pagefind-meta="title[data-t], description[data-d], güncelleme[data-g]"',
    'data-pagefind-sort="güncelleme[data-g]"',
    'data-t="' + esc(p.title) + '"', 'data-d="' + esc(p.description) + '"', 'data-g="' + esc(p.updated) + '"',
    'data-pagefind-filter="tür[data-tur]' + (p.category ? ", kategori[data-kat]" : "") + '"', 'data-tur="' + TUR_ADI[p.type] + '"'];
  if (p.category) nit.push('data-kat="' + esc(M.kategoriler[p.category]) + '"');
  const govde = katlaMetin(html);
  /* Başlık en yüksek ağırlıkla bir kez daha dizine girer: Pagefind'ın
     varsayılan sıralaması uzun sayfalarda geçen kelimeyi, başlığında taşıyan
     sayfanın önüne koyuyordu ("emekli zammı" sorgusunda araç altıncıydı). */
  const baslik = '<p data-pagefind-weight="10">' + katlaMetin(esc(p.title)) + "</p>";
  return govde.replace(/<main id="main"[^>]*>/, '<main id="main" data-pagefind-body><span ' + nit.join(" ") + "></span>" + baslik);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const gecici = join(tmpdir(), "korayoner-arama-" + process.pid);
  rmSync(gecici, { recursive: true, force: true });
  let n = 0;
  for (const p of M.sayfalar.filter(arananir)) {
    const hedef = join(gecici, p.dosya);
    mkdirSync(dirname(hedef), { recursive: true });
    writeFileSync(hedef, kopyala(readFileSync(join(KOK, p.dosya), "utf8"), p));
    n++;
  }
  rmSync(CIKTI, { recursive: true, force: true });
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["-y", PAGEFIND, "--site", gecici, "--output-path", CIKTI], { cwd: KOK, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
  rmSync(gecici, { recursive: true, force: true });
  console.log("Arama dizini: " + n + " sayfa → " + CIKTI);
}
