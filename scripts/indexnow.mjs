#!/usr/bin/env node
/*
 * IndexNow: güncellenen sayfaları Bing/Yandex'e (api.indexnow.org) bildirir.
 *
 * Hangi adresler: dizine açık olup "updated" tarihi önceki manifestten farklı
 * olanlar ve yeni eklenenler. Önceki manifest, son başarılı yayının
 * commit'indeki content.json'dır (--onceki <sha>); verilmezse HEAD~1.
 *
 * Bildirim, canlı sitenin yeni sürümü sunduğu görülünce gönderilir: canlı
 * content.json'da değişen adreslerin tarihi yerel manifestle aynı olana kadar
 * (en çok --bekle saniye) beklenir. Aksi halde tarayıcı eski sayfayı alır.
 *
 * Anahtar kök dizindeki <32 hex>.txt dosyasıdır (içeriği dosya adıyla aynı).
 * Hata yayını durdurmaz: sonuç yazılır, çıkış kodu 0'dır (--kati hariç).
 *
 * Kullanım:
 *   node scripts/indexnow.mjs --onceki <sha> [--bekle 600] [--dry]
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const arg = (ad, varsayilan) => { const i = process.argv.indexOf(ad); return i > 0 ? process.argv[i + 1] : varsayilan; };
const DRY = process.argv.includes("--dry");
const KATI = process.argv.includes("--kati");

const yeni = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const SITE = yeni.site;
const host = new URL(SITE).host;

function oncekiManifest(ref) {
  try {
    return JSON.parse(execFileSync("git", ["show", ref + ":content.json"], { cwd: KOK, encoding: "utf8", maxBuffer: 1e8 }));
  } catch {
    return null;
  }
}

export function degisenler(eski, yeni) {
  const once = new Map((eski?.sayfalar || []).map((s) => [s.url, s]));
  return yeni.sayfalar
    .filter((s) => !s.noindex)
    .filter((s) => { const o = once.get(s.url); return !o || o.noindex || o.updated !== s.updated; })
    .map((s) => s.url);
}

const anahtar = readdirSync(KOK).map((f) => f.match(/^([0-9a-f]{32})\.txt$/)).find(Boolean)?.[1];

async function canliHazir(adresler, sure) {
  const bitis = Date.now() + sure * 1000;
  const beklenen = new Map(yeni.sayfalar.map((s) => [s.url, s.updated]));
  for (;;) {
    try {
      const r = await fetch(SITE + "/content.json?t=" + Date.now(), { headers: { "cache-control": "no-cache" } });
      if (r.ok) {
        const canli = new Map((await r.json()).sayfalar.map((s) => [s.url, s.updated]));
        if (adresler.every((u) => canli.get(u) === beklenen.get(u))) return true;
      }
    } catch { /* yeniden dene */ }
    if (Date.now() > bitis) return false;
    await new Promise((ok) => setTimeout(ok, 20000));
  }
}

async function main() {
  const ref = arg("--onceki", "HEAD~1");
  const eski = oncekiManifest(ref);
  if (!eski) { console.log("Önceki manifest okunamadı (" + ref + "); bildirim yok."); return 0; }
  const adresler = degisenler(eski, yeni);
  console.log("Önceki: " + ref + " · değişen ya da yeni adres: " + adresler.length);
  adresler.slice(0, 20).forEach((u) => console.log("  " + u));
  if (!adresler.length) return 0;
  if (!anahtar) { console.log("IndexNow anahtar dosyası yok; bildirim yok."); return KATI ? 1 : 0; }
  if (DRY) { console.log("--dry: gönderilmedi."); return 0; }
  if (!(await canliHazir(adresler, +arg("--bekle", "600")))) {
    console.log("Canlı site yeni tarihleri göstermedi; bildirim yok.");
    return KATI ? 1 : 0;
  }
  const govde = { host, key: anahtar, keyLocation: SITE + "/" + anahtar + ".txt", urlList: adresler.slice(0, 10000) };
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(govde)
  });
  console.log("IndexNow yanıtı: HTTP " + r.status + " (" + adresler.length + " adres)");
  return r.status === 200 || r.status === 202 ? 0 : KATI ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((k) => process.exit(k));
}
