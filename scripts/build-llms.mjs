#!/usr/bin/env node
/*
 * /llms.txt — sitenin dil modelleri için özeti (llmstxt.org biçimi),
 * content.json'dan. Dizine açık her araç, yazı ve yöntem sayfası adı, adresi
 * ve tek cümlelik açıklamasıyla; kategori sırası manifestteki gibi.
 *
 * Kullanım:
 *   node scripts/build-llms.mjs           # yaz
 *   node scripts/build-llms.mjs --check   # güncel mi (CI)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));

/* Sayfa adı: izdeki ad (BreadcrumbList'in son öğesi), yoksa başlık. */
function ad(s) {
  const h = readFileSync(join(KOK, s.dosya), "utf8");
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { continue; }
    for (const n of Array.isArray(d) ? d : d["@graph"] || [d]) {
      if (n && n["@type"] === "BreadcrumbList") return n.itemListElement.at(-1).name;
    }
  }
  return s.title;
}
const tek = (x) => String(x || "").replace(/\s+/g, " ").trim();
const satir = (s) => "- [" + ad(s) + "](" + s.url + ")" + (s.description ? ": " + tek(s.description) : "");

export function llms() {
  const acik = M.sayfalar.filter((s) => !s.noindex);
  const n = M.sayaclar;
  const out = [
    "# Koray Öner — korayoner.dev",
    "",
    "> Türkiye'de maaş, vergi, SGK, emeklilik ve hane finansı için ücretsiz hesaplama araçları ve bu hesapların kuralını anlatan yazılar. " +
      n.arac + " araç, " + n.makale + " yazı. Hesaplar tarayıcıda yapılır; hesap içeren her yazının rakamları sitenin hesap motorlarından testle yeniden üretilir.",
    "",
    "Kaynaklar birincildir (Resmî Gazete, GİB, SGK, TÜİK, TCMB). Mevzuat değiştikçe sayfalar güncellenir; her sayfanın güncelleme tarihi site haritasında (" + M.site + "/sitemap.xml) ve akışlarda aynıdır. Yazar ve sorumlu: Koray Öner.",
    ""
  ];
  for (const [k, adi] of Object.entries(M.kategoriler)) {
    const ar = acik.filter((s) => s.type === "arac" && !s.parent && s.category === k);
    if (ar.length) out.push("## Araçlar: " + adi, "", ...ar.map(satir), "");
  }
  for (const [k, adi] of Object.entries(M.kategoriler)) {
    const yz = acik.filter((s) => s.type === "makale" && s.category === k).sort((a, b) => (a.published < b.published ? 1 : -1));
    if (yz.length) out.push("## Yazılar: " + adi, "", ...yz.map(satir), "");
  }
  const yontem = acik.filter((s) => s.type === "metodoloji" || s.type === "grafik");
  out.push("## Yöntem, veri ve grafikler", "", ...yontem.map(satir), "");
  const ops = acik.filter((s) => s.type === "sayfa" || (s.type === "arac" && s.parent));
  out.push("## Optional", "", ...ops.map(satir), "");
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const yol = join(KOK, "llms.txt"), yeni = llms(), eski = existsSync(yol) ? readFileSync(yol, "utf8") : "";
  if (process.argv.includes("--check")) {
    if (yeni !== eski) { console.error("llms.txt bayat — 'node scripts/build-llms.mjs' çalıştırın."); process.exit(1); }
    console.log("llms.txt manifestle aynı.");
  } else {
    if (yeni !== eski) writeFileSync(yol, yeni);
    console.log("llms.txt " + (yeni !== eski ? "yazıldı" : "güncel") + " (" + yeni.split("\n").filter((l) => l.startsWith("- ")).length + " bağlantı).");
  }
}
