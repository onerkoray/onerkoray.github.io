#!/usr/bin/env node
/*
 * sitemap.xml, Atom akışları ve robots.txt — content.json'dan üretilir.
 *
 * sitemap.xml   Dizine açık her sayfa; lastmod = manifest updated.
 *               changefreq ve priority yok (Google ikisini de yok sayıyor,
 *               elle tutulan değerler zamanla yalana dönüyordu). Görsel
 *               başlığı sayfa başlığından türer: elle yazılan başlıklar
 *               kopyalanıp kalmıştı (dört yazıda "KDV tevkifatı nedir…").
 * atom.xml      Araçlar, yazılar, metodolojiler ve grafikler.
 * makaleler/atom.xml, araclar/atom.xml   Tür bazında akışlar.
 *               Her girdide published, updated ve <category>. Sıra:
 *               yayın damgasına göre en yeniden eskiye (akış "yeni ne var"
 *               sorusuna cevap verir; günlük yenilenen bir sayfa her gün
 *               en üste çıkmasın). Akışın <updated>'ı en yeni değişiklik.
 * robots.txt    Sitemap ve üç akış.
 *
 * Kullanım:
 *   node scripts/build-feeds.mjs           # yaz
 *   node scripts/build-feeds.mjs --check   # güncel mi (CI)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const SITE = M.site;

/* Kişi sayfalarında portre de dizine bildirilir (ad sorgusu için görsel). */
const PORTRE = { loc: SITE + "/images/koray-oner-portre.jpg", title: "Koray Öner" };
const EK_GORSEL = { [SITE + "/"]: [PORTRE], [SITE + "/hakkimda/"]: [PORTRE], [SITE + "/koray-oner/"]: [PORTRE] };

/* Sayılar manifestten (sayaclar): akış alt başlığı elle yazılmış sayı taşımaz. */
const N = M.sayaclar;
const AKISLAR = [
  { dosya: "atom.xml", baslik: "Koray Öner — Araçlar ve Yazılar",
    alt: "Türkiye'de maaş, vergi, SGK, emeklilik ve kredi için " + N.arac + " hesaplama aracı ve arkalarındaki mevzuatı anlatan " + N.makale + " yazı.",
    alternate: SITE + "/", turler: ["arac", "makale", "metodoloji", "grafik"] },
  { dosya: "makaleler/atom.xml", baslik: "Koray Öner — Yazılar",
    alt: "Bordro, vergi, sosyal güvenlik ve kişisel finans üzerine, hesabı ve kaynağı verilen " + N.makale + " yazı.",
    alternate: SITE + "/makaleler/", turler: ["makale"] },
  { dosya: "araclar/atom.xml", baslik: "Koray Öner — Hesaplama Araçları",
    alt: "Tarayıcıda çalışan, reklamsız ve üyeliksiz " + N.arac + " maaş, vergi, SGK ve kredi hesaplama aracı.",
    alternate: SITE + "/araclar/", turler: ["arac"] }
];

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const indeks = M.sayfalar.filter((s) => !s.noindex);

function sitemap() {
  const sira = { sayfa: 1, arac: 2, metodoloji: 3, grafik: 4, makale: 5 };
  const liste = indeks.slice().sort((a, b) =>
    (a.url === SITE + "/" ? -1 : b.url === SITE + "/" ? 1 : 0) || (sira[a.type] - sira[b.type]) || a.url.localeCompare(b.url));
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'];
  for (const s of liste) {
    out.push("  <url>", "    <loc>" + xml(s.url) + "</loc>", "    <lastmod>" + s.updated + "</lastmod>");
    const gorseller = [];
    if (s.image) gorseller.push({ loc: s.image, title: s.imageTitle });
    for (const e of EK_GORSEL[s.url] || []) if (!gorseller.some((g) => g.loc === e.loc)) gorseller.push(e);
    for (const g of gorseller) {
      out.push("    <image:image>", "      <image:loc>" + xml(g.loc) + "</image:loc>");
      if (g.title) out.push("      <image:title>" + xml(g.title) + "</image:title>");
      out.push("    </image:image>");
    }
    out.push("  </url>");
  }
  out.push("</urlset>");
  return out.join("\n") + "\n";
}

/* Atom updated: özlü commit'in yazar zamanı, KENDİ saat diliminde (günü
   manifestteki updated ile aynı kalsın; +03:00'e çevirmek gece yarısına
   yakın commit'lerin gününü kaydırıyordu). Yayından önce olamaz. */
function guncelZaman(s) {
  if (s.updatedAt && new Date(s.updatedAt) >= new Date(s.published) && s.updatedAt.slice(0, 10) === s.updated) return s.updatedAt;
  if (s.updated === yayinZaman(s).slice(0, 10)) return yayinZaman(s);
  return s.updatedAt && s.updatedAt.slice(0, 10) === s.updated ? s.updatedAt : s.updated + "T00:00:00+03:00";
}
function yayinZaman(s) { return new Date(new Date(s.published).getTime() + 3 * 3600e3).toISOString().slice(0, 19) + "+03:00"; }
const zamanSirasi = (a, b) => new Date(a) - new Date(b);

function atom(a) {
  const girdi = indeks.filter((s) => a.turler.includes(s.type))
    .sort((x, y) => zamanSirasi(yayinZaman(y), yayinZaman(x)) || x.url.localeCompare(y.url));
  const enYeni = girdi.map(guncelZaman).sort(zamanSirasi).pop();
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="tr">',
    "  <title>" + xml(a.baslik) + "</title>", "  <subtitle>" + xml(a.alt) + "</subtitle>",
    '  <link href="' + SITE + "/" + a.dosya + '" rel="self" type="application/atom+xml"/>',
    '  <link href="' + a.alternate + '" rel="alternate" type="text/html"/>',
    "  <id>" + SITE + "/" + a.dosya + "</id>", "  <updated>" + enYeni + "</updated>",
    "  <author><name>Koray Öner</name><uri>" + SITE + "/hakkimda/</uri></author>",
    "  <icon>" + SITE + "/favicon.svg</icon>"];
  for (const s of girdi) {
    out.push("", "  <entry>", "    <title>" + xml(s.title) + "</title>", '    <link href="' + xml(s.url) + '"/>',
      "    <id>" + xml(s.url) + "</id>", "    <published>" + yayinZaman(s) + "</published>", "    <updated>" + guncelZaman(s) + "</updated>");
    if (s.category) out.push('    <category term="' + s.category + '" label="' + xml(M.kategoriler[s.category]) + '"/>');
    if (s.description) out.push("    <summary>" + xml(s.description) + "</summary>");
    out.push("  </entry>");
  }
  out.push("</feed>");
  return out.join("\n") + "\n";
}

/* Arama paletinin boş sorgu listesi: manifestteki öne çıkanlar. */
const TUR_ADI = { arac: "Araç", makale: "Makale", metodoloji: "Metodoloji", grafik: "Grafik", sayfa: "Sayfa" };
function oneriler() {
  const byUrl = Object.fromEntries(M.sayfalar.map((s) => [s.url, s]));
  return JSON.stringify((M.oneCikanlar || []).filter((u) => byUrl[u]).map((u) => ({ url: u.replace(SITE, ""), title: byUrl[u].title, tur: TUR_ADI[byUrl[u].type] })), null, 1) + "\n";
}

function robots() {
  return ["User-agent: *", "Allow: /", "Disallow: /pagefind/", "",
    "Sitemap: " + SITE + "/sitemap.xml",
    ...AKISLAR.map((a) => "Sitemap: " + SITE + "/" + a.dosya), ""].join("\n");
}

export function dosyalar() {
  const d = { "sitemap.xml": sitemap(), "robots.txt": robots(), "arama-oneriler.json": oneriler() };
  for (const a of AKISLAR) d[a.dosya] = atom(a);
  return d;
}
export { AKISLAR };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const kontrol = process.argv.includes("--check");
  const bayat = [];
  for (const [ad, icerik] of Object.entries(dosyalar())) {
    const yol = join(KOK, ad), eski = existsSync(yol) ? readFileSync(yol, "utf8") : "";
    if (icerik === eski) continue;
    if (kontrol) bayat.push(ad);
    else { mkdirSync(dirname(yol), { recursive: true }); writeFileSync(yol, icerik); }
  }
  if (kontrol) {
    if (bayat.length) { console.error("Bayat: " + bayat.join(", ") + " — 'node scripts/build-feeds.mjs' çalıştırın."); process.exit(1); }
    console.log("Sitemap, akışlar ve robots.txt manifestle aynı.");
  } else console.log("Sitemap (" + indeks.length + " adres), " + AKISLAR.length + " akış ve robots.txt yazıldı.");
}
