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
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const uzun = (iso) => { const [y, a, g] = iso.split("-"); return +g + " " + AYLAR[+a - 1] + " " + y; };

/* ---- JSON-LD'de manifestle tutarlı alanlar --------------------------------
 * Araç: WebApplication düğümünde dateModified yoksa eklenir. Yazı: DOI'si
 * yayinlar/yayin.js'te kayıtlı yazının ana düğümü ScholarlyArticle olur ve
 * sameAs'ında https://doi.org/<doi> bulunur. DOI'siz yazının türüne
 * dokunulmaz (Zenodo'ya hazırlanan akademik biçimli yazılar ScholarlyArticle
 * kalabilir). Bu alanlar dedektörde kabuktur (tools/arac-guncelleme.py
 * _izsiz_ld): tarih kaydırmaz.
 */
const DOI = Object.fromEntries(createRequire(import.meta.url)("../yayinlar/yayin.js").CALISMALAR
  .filter((c) => c.sayfa).map((c) => [c.sayfa.replace(/\/$/, ""), c.doi]));
const LD_RE = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
const dugumler = (d) => (Array.isArray(d) ? d : d["@graph"] || [d]);

function webAppTarih(html, D) {
  return html.replace(LD_RE, (t, a, ic, b) => {
    let d; try { d = JSON.parse(ic); } catch { return t; }
    const n = dugumler(d).find((x) => x && x["@type"] === "WebApplication");
    if (!n || n.dateModified) return t;
    return a + ic.replace(/("@type":\s*"WebApplication",)(\s*)/, (_, x, bos) => x + bos + '"dateModified": "' + D + '",' + bos) + b;
  });
}

function doiYaz(html, sayfa) {
  const doi = DOI[sayfa.dosya.replace(/\/index\.html$/, "")];
  if (!doi) return html;
  const adres = "https://doi.org/" + doi;
  return html.replace(LD_RE, (t, a, ic, b) => {
    let d; try { d = JSON.parse(ic); } catch { return t; }
    const n = dugumler(d).find((x) => x && /^(Scholarly)?Article$/.test(x["@type"]) && (x["@id"] || "").startsWith(sayfa.url));
    if (!n) return t;
    const same = [].concat(n.sameAs || []);
    if (n["@type"] === "ScholarlyArticle" && same.includes(adres)) return t;
    /* Metne küçük dokunuş: düğümün "@id" satırının çevresinde tür ve sameAs. */
    const idYeri = ic.indexOf('"' + n["@id"] + '"');
    const turYeri = ic.lastIndexOf('"@type"', idYeri);
    let yeni = ic.slice(0, turYeri) + ic.slice(turYeri, idYeri).replace(/"@type":\s*"Article"/, '"@type": "ScholarlyArticle"') + ic.slice(idYeri);
    if (!same.includes(adres)) {
      const i = yeni.indexOf('"' + n["@id"] + '"') + n["@id"].length + 2;
      if (n.sameAs) {
        /* Düğümün kendi sameAs'ı, değeriyle aranır (iç içe düğümlerin
           sameAs'ı karışmasın; ikinci bir anahtar eklemek JSON'da sonuncuyu
           kazandırır ve DOI sessizce düşer). */
        const re = new RegExp('"sameAs":\\s*' + JSON.stringify(n.sameAs).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/,/g, ",\\s*"), "g");
        re.lastIndex = i;
        const m = re.exec(yeni);
        if (!m) throw new Error("sameAs bulunamadı: " + sayfa.dosya);
        yeni = yeni.slice(0, m.index) + '"sameAs": ' + JSON.stringify([adres, ...same]).replace(/","/g, '", "') + yeni.slice(m.index + m[0].length);
      } else {
        const bos = (yeni.slice(i).match(/^,(\s*)/) || [, " "])[1];
        yeni = yeni.slice(0, i) + "," + bos + '"sameAs": "' + adres + '"' + yeni.slice(i);
      }
    }
    try { JSON.parse(yeni); } catch { throw new Error("sameAs yazılamadı: " + sayfa.dosya); }
    return a + yeni + b;
  });
}

export function esitle(html, sayfa) {
  const yay = (html.match(/"datePublished":\s*"([\d-]+)/) || [])[1];
  if (!sayfa.updated) return html;
  const D = yay && yay.slice(0, 10) > sayfa.updated ? yay.slice(0, 10) : sayfa.updated;
  let s = html.replace(/("dateModified":\s*")[\d-]+(?:T[^"]*)?(")/g, "$1" + D + "$2");
  if (sayfa.type === "arac") s = webAppTarih(s, D);
  if (sayfa.type !== "makale") return s;
  s = doiYaz(s, sayfa);
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
