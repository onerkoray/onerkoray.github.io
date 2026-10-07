#!/usr/bin/env node
/*
 * Geçmişten türeyen bütün üreteçler, sabit noktaya kadar.
 *
 * Yeni ya da değişen bir sayfadan sonra elle hiçbir yer düzenlenmez: içerik
 * commit'inden sonra bu komut koşar ve manifest, sayfa tarihleri, sitemap,
 * akışlar, kabuk blokları, /araclar/, konum izleri, ilgili bağlantılar,
 * llms.txt, ana sayfa kartları, makale listeleri, sayaçlar, /koray-oner/,
 * menü ve stil damgası tazelenir. Bazı çıktılar birbirini okur (manifest
 * /koray-oner/ açıklamasını okur, o da manifestin sayaçlarını), bu yüzden
 * zincir hiçbir dosya değişmeyene kadar (en çok 4 tur) tekrarlanır.
 *
 * Kullanım: node scripts/build-all.mjs
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const ZINCIR = [
  ["node", "scripts/build-manifest.mjs"],
  ["node", "scripts/sync-dates.mjs"],
  ["node", "scripts/build-feeds.mjs"],
  ["node", "scripts/apply-shell.mjs"],
  ["node", "scripts/build-pages.mjs"],
  ["node", "scripts/build-llms.mjs"],
  ["python", "tools/arac-guncelleme.py"],
  ["python", "tools/makale-listesi.py"],
  ["python", "tools/hakkimda-rakamlar.py"],
  ["python", "tools/calisma-dizini.py"],
  ["python", "tools/menu.py"],
  ["python", "tools/stil-damgasi.py"]
];
const env = { ...process.env, PYTHONIOENCODING: "utf-8" };
const git = (...a) => execFileSync("git", a, { cwd: KOK, encoding: "utf8", maxBuffer: 1e9 });
/* Çalışma ağacının durumu: değişen dosyalar ve içerikleri. */
const durum = () => createHash("sha1").update(git("status", "--porcelain", "-uall") + git("diff")).digest("hex");

let once = durum();
for (let tur = 1; tur <= 4; tur++) {
  for (const [p, b] of ZINCIR) execFileSync(p, [b], { cwd: KOK, env, stdio: ["ignore", "ignore", "inherit"] });
  const simdi = durum();
  console.log("Tur " + tur + ": " + (simdi === once ? "değişiklik yok, sabit." : "dosyalar değişti."));
  if (simdi === once) process.exit(0);
  once = simdi;
}
console.error("Üreteçler 4 turda sabitlenmedi: iki çıktı birbirini yeniden yazıyor.");
process.exit(1);
