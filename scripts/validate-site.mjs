#!/usr/bin/env node
/*
 * Site doğrulaması — üretilen dosyalar ve sayfalar birbiriyle tutarlı mı?
 *
 * Kırmızı (build kırılır):
 *   1. sitemap.xml ve üç Atom akışı iyi biçimli XML.
 *   2. Sitemap URL kümesi = diskte bağımsız taramayla bulunan, dizine açık
 *      sayfa kümesi (manifestten değil: manifest yanlışsa da yakalansın).
 *   3. Kırık iç bağlantı yok (href ve src; sorgu ve çapa atılır).
 *   4. Her URL'de tarihler birebir aynı: manifest updated = JSON-LD
 *      dateModified (hepsi) = görünen tarih (ana sayfa kartı, yazının
 *      ed-meta'sı, makale listesi) = sitemap lastmod = Atom updated (gün).
 *   5. JSON-LD türleri: araç WebApplication (kategori, ücretsiz, dateModified),
 *      yazı Article/ScholarlyArticle (yazar, iki tarih), DOI'li yazı sameAs DOI.
 * Uyarı:
 *   6. Yetim sayfa (hiçbir iç bağlantının göstermediği dizine açık sayfa).
 *
 * Kullanım: node scripts/validate-site.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SITE = "https://korayoner.dev";
const ATLA = new Set([".git", "node_modules", "_cekirdek", "_karsilastirma", "docs", "decorpalette",
  "dither-studio", "tools", "scripts", "_kontak", ".github", "pagefind"]);
const oku = (p) => readFileSync(join(KOK, p), "utf8");
let hata = 0, uyari = 0;
const kirmizi = (ad, liste) => { if (liste.length) { hata++; console.error("  KIRMIZI  " + ad + " (" + liste.length + ")\n      " + liste.slice(0, 12).join("\n      ")); } else console.log("  tamam    " + ad); };
const sari = (ad, liste) => { if (liste.length) { uyari++; console.log("  UYARI    " + ad + " (" + liste.length + ")\n      " + liste.slice(0, 12).join("\n      ")); } else console.log("  tamam    " + ad); };

function html(dizin = KOK, l = []) {
  for (const ad of readdirSync(dizin)) {
    if (ATLA.has(ad) || ad.startsWith(".")) continue;
    const t = join(dizin, ad);
    if (statSync(t).isDirectory()) html(t, l); else if (ad.endsWith(".html")) l.push(relative(KOK, t).split(sep).join("/"));
  }
  return l;
}
const sayfalar = html().filter((d) => !/^google[0-9a-f]+\.html$/.test(d));
const urlOf = (d) => SITE + "/" + d.replace(/index\.html$/, "");

/* 1. XML iyi biçim: etiket yığını, öznitelik tırnakları, varlıklar. */
function xmlHatalari(ad) {
  const s = oku(ad), yigin = [], out = [];
  const govde = s.replace(/<\?xml[^>]*\?>/, "");
  for (const m of govde.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g)) {
    const [, kapa, et, oz, kendi] = m;
    if ((oz.match(/"/g) || []).length % 2) out.push(ad + ": tırnak dengesiz <" + et + ">");
    if (kapa) { const ust = yigin.pop(); if (ust !== et) out.push(ad + ": </" + et + "> beklenen </" + ust + ">"); }
    else if (!kendi) yigin.push(et);
  }
  if (yigin.length) out.push(ad + ": kapanmamış " + yigin.join(","));
  for (const m of govde.matchAll(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/gi)) out.push(ad + ": çıplak & @" + m.index);
  return out;
}
const AKISLAR = ["atom.xml", "makaleler/atom.xml", "araclar/atom.xml"];
console.log("Site doğrulaması\n");
kirmizi("XML iyi biçimli (sitemap + 3 akış)", ["sitemap.xml", ...AKISLAR].flatMap((a) => existsSync(join(KOK, a)) ? xmlHatalari(a) : [a + ": yok"]));

/* 2. Sitemap = bağımsız tarama. */
const indeks = new Set(sayfalar.filter((d) => d !== "404.html" && !/<meta\s+name="robots"\s+content="[^"]*noindex/.test(oku(d))).map(urlOf));
const sm = oku("sitemap.xml");
const smUrl = new Map([...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
kirmizi("sitemap = dizine açık sayfalar", [
  ...[...indeks].filter((u) => !smUrl.has(u)).map((u) => "sitemap'te yok: " + u),
  ...[...smUrl.keys()].filter((u) => !indeks.has(u)).map((u) => "sitemap'te fazla: " + u)]);

/* 3. Kırık iç bağlantılar ve 5. yetimler. */
const gelen = new Map(), kirik = [];
for (const d of sayfalar) {
  const s = oku(d), taban = d === "404.html" ? SITE + "/" : urlOf(d);
  for (const m of s.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const h = m[1];
    if (/^(?:mailto:|tel:|javascript:|data:|#)/.test(h)) continue;
    let u; try { u = new URL(h, taban); } catch { continue; }
    if (u.origin !== SITE) continue;
    let yol = decodeURIComponent(u.pathname).replace(/^\//, "");
    const hedef = yol === "" || yol.endsWith("/") ? yol + "index.html" : yol;
    if (!existsSync(join(KOK, hedef)) && !/^pagefind\//.test(yol)) kirik.push(d + " → " + h);
    const tu = SITE + "/" + yol.replace(/index\.html$/, "");
    if (tu !== taban) { if (!gelen.has(tu)) gelen.set(tu, new Set()); gelen.get(tu).add(d); }
  }
}
kirmizi("kırık iç bağlantı yok", [...new Set(kirik)]);

/* 4. Tarih eşitliği. */
const M = JSON.parse(oku("content.json"));
const ana = oku("index.html"), kart = {};
for (const m of ana.matchAll(/<li class="project-card[^"]*"[^>]*>[\s\S]*?<h3><a href="([^"]+)"[\s\S]*?card-updated">[^<]*<time datetime="([\d-]+)"/g)) kart[SITE + "/" + m[1].replace(/^\.?\//, "")] = m[2];
const liste = {};
for (const m of oku("makaleler/index.html").matchAll(/href="([a-z0-9-]+\/)"[\s\S]{0,1500}?(?:Güncelleme|Yayın)[^<]*<time datetime="([\d-]+)"/g)) if (!liste[SITE + "/makaleler/" + m[1]]) liste[SITE + "/makaleler/" + m[1]] = m[2];
const atomGun = {};
for (const a of AKISLAR) for (const e of oku(a).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const l = e[1].match(/<link href="([^"]+)"/)[1], u = e[1].match(/<updated>([^<]+)<\/updated>/)[1];
  (atomGun[l] = atomGun[l] || new Set()).add(u.slice(0, 10));
}
const tarih = [];
for (const p of M.sayfalar) {
  if (p.noindex) continue;
  const s = oku(p.dosya), U = p.updated, f = [];
  for (const m of s.matchAll(/"dateModified":\s*"([\d-]+)/g)) if (m[1] !== U) f.push("dateModified " + m[1]);
  if (kart[p.url] && kart[p.url] !== U) f.push("kart " + kart[p.url]);
  if (liste[p.url] && liste[p.url] !== U) f.push("makale listesi " + liste[p.url]);
  if (p.type === "makale") {
    const meta = (s.match(/<p class="(?:ed-meta|byline[^"]*)">([\s\S]*?)<\/p>/) || [, ""])[1];
    const gun = meta.match(/Güncelleme:\s*<time datetime="([\d-]+)"/), zaman = [...meta.matchAll(/<time datetime="([\d-]+)"/g)].map((m) => m[1]);
    const gorunen = gun ? gun[1] : zaman[zaman.length - 1];
    if (gorunen !== U) f.push("görünen " + gorunen);
  }
  if (smUrl.get(p.url) !== U) f.push("lastmod " + smUrl.get(p.url));
  for (const g of atomGun[p.url] || []) if (g !== U) f.push("atom " + g);
  if (f.length) tarih.push(p.url.replace(SITE, "") + " updated " + U + " ≠ " + f.join(", "));
}
kirmizi("her URL'de tarihler birebir aynı", tarih);

/* JSON-LD türleri manifestle tutarlı. Araç: WebApplication, uygulama
   kategorisi, ücretsiz teklif ve dateModified. Yazı: Article ya da
   ScholarlyArticle, yazar ve iki tarih. DOI'si yayinlar/yayin.js'te kayıtlı
   yazı: ScholarlyArticle + sameAs DOI. Bilinçli istisnalar aşağıda. */
const LD_ISTISNA = {
  "https://korayoner.dev/doviz-kurlari/": "veri sayfası: Dataset (her gece şablondan yazılır)",
  "https://korayoner.dev/maas-hesaplama/brut-net-tablosu/": "maaş aracının tablo alt sayfası; uygulama ana araçta"
};
const KATEGORI_ISTISNA = { "https://korayoner.dev/fatura-olusturma/": "BusinessApplication" };
const DOI = Object.fromEntries((await import("node:module")).createRequire(import.meta.url)("../yayinlar/yayin.js").CALISMALAR
  .filter((c) => c.sayfa).map((c) => [SITE + "/" + c.sayfa.replace(/\/$/, "") + "/", c.doi]));
const ldHata = [];
for (const p of M.sayfalar) {
  if (p.noindex || LD_ISTISNA[p.url] || (p.type !== "arac" && p.type !== "makale")) continue;
  const d = [];
  for (const m of oku(p.dosya).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); d.push(...(Array.isArray(j) ? j : j["@graph"] || [j])); } catch { ldHata.push(p.url + " geçersiz JSON-LD"); }
  }
  const yol = p.url.replace(SITE, "");
  if (p.type === "arac") {
    const n = d.find((x) => x && x["@type"] === "WebApplication");
    if (!n) { ldHata.push(yol + " WebApplication yok"); continue; }
    if (n.applicationCategory !== (KATEGORI_ISTISNA[p.url] || "FinanceApplication")) ldHata.push(yol + " applicationCategory " + n.applicationCategory);
    if (!n.offers || String([].concat(n.offers)[0].price) !== "0") ldHata.push(yol + " offers.price 0 değil");
    if (n.dateModified !== p.updated) ldHata.push(yol + " dateModified " + n.dateModified);
  } else {
    const n = d.find((x) => x && /^(Scholarly)?Article$/.test(x["@type"]) && String(x["@id"] || x.url || "").startsWith(p.url));
    if (!n) { ldHata.push(yol + " Article yok"); continue; }
    if (!n.author) ldHata.push(yol + " author yok");
    if (String(n.datePublished || "").slice(0, 10) !== p.published.slice(0, 10)) ldHata.push(yol + " datePublished " + n.datePublished);
    if (n.dateModified !== p.updated) ldHata.push(yol + " dateModified " + n.dateModified);
    if (DOI[p.url]) {
      if (n["@type"] !== "ScholarlyArticle") ldHata.push(yol + " DOI'li ama " + n["@type"]);
      if (![].concat(n.sameAs || []).includes("https://doi.org/" + DOI[p.url])) ldHata.push(yol + " sameAs DOI yok");
    }
  }
}
kirmizi("JSON-LD türleri ve tarihleri manifestle tutarlı", ldHata);

sari("yetim sayfa yok", [...indeks].filter((u) => u !== SITE + "/" && !gelen.has(u)));

console.log("\n" + (hata ? hata + " kırmızı" : "Hepsi yeşil") + (uyari ? ", " + uyari + " uyarı" : "") + ". (site doğrulaması)");
process.exit(hata ? 1 : 0);
