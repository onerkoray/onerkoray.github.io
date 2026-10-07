#!/usr/bin/env node
/*
 * İçerik manifesti — sitenin her sayfası için tek veri kaynağı.
 *
 * content.json'u üretir: url, tür, başlık, açıklama, kategori, yayın ve
 * güncelleme tarihi, görsel, elle verilmiş ilgili bağlantılar, noindex.
 * Sitemap, Atom akışları, llms.txt, katalog sayfaları, sayaçlar ve ilgili
 * içerik blokları bu dosyadan üretilir; hiçbiri sayfaları ayrıca taramaz.
 *
 * TARİH OTORİTESİ (Faz 0 kararı)
 *   updated   tools/arac-guncelleme.py'deki anlamli_tarih(): dosyaya
 *             dokunan, ÖZLÜ en son commit'in tarihi. Stil damgası, site
 *             kabuğu (başlık, menü, "Bu sayfada", alt bilgi), yalnız iç
 *             bağlantı ekleyen ve on ya da daha fazla dosyaya aynı satırı
 *             basan toplu commit'ler sayılmaz. Araçlarda klasör (hesap
 *             kodu dahil), diğer sayfalarda dosyanın kendisi. Kural Python
 *             modülünde tek yerde durur; burada yeniden yazılmaz.
 *   published Bir kez yazılır ve korunur: önceki content.json → atom.xml'deki
 *             ilk ekleniş damgası → dosyanın ilk commit'i → şimdi (henüz
 *             commit'lenmemiş sayfa).
 *
 * Bağımlılıksız Node (ESM). Kullanım:
 *   node scripts/build-manifest.mjs           # content.json yaz
 *   node scripts/build-manifest.mjs --check   # güncel mi (CI)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SITE = "https://korayoner.dev";
const CIKTI = join(KOK, "content.json");
const ATLA = new Set([".git", "node_modules", "_cekirdek", "_karsilastirma", "docs", "decorpalette",
  "dither-studio", "tools", "scripts", "_kontak", ".github", "pagefind"]);

/* Tek kategori sözlüğü. Araç kartlarının data-cat'i ve makale kicker'ları
   buraya iner; katalog, filtre, akış <category> ve llms.txt bunu kullanır. */
export const KATEGORILER = {
  "maas-tazminat": "Maaş & Tazminat",
  "vergi-belge": "Vergi & Belge",
  "kredi-finans": "Kredi & Finans",
  "emeklilik-sosyal-guvenlik": "Emeklilik & Sosyal Güvenlik",
  "mevzuat": "Mevzuat"
};
const ARAC_KAT = { maas: "maas-tazminat", vergi: "vergi-belge", finans: "kredi-finans" };
const MAKALE_KAT = {
  "Bordro": "maas-tazminat", "Tazminat": "maas-tazminat", "Vergi": "vergi-belge",
  "Finans": "kredi-finans", "Mevzuat": "mevzuat", "Emeklilik ve sosyal güvenlik": "emeklilik-sosyal-guvenlik"
};
/* Grafik ve diyagramlar veri sayfası: makro finans göstergeleri.
   Bordro Motoru (/bordro/) motorun yöntem ve parametre sayfası: metodoloji. */
const GRAFIK = new Set(["grafikler", "diyagramlar"]);

const oku = (p) => readFileSync(p, "utf8");
const json = (p) => JSON.parse(oku(p));

function sayfalar(dizin = KOK, liste = []) {
  for (const ad of readdirSync(dizin).sort()) {
    if (ATLA.has(ad) || ad.startsWith(".")) continue;
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) sayfalar(tam, liste);
    else if (ad.endsWith(".html")) liste.push(relative(KOK, tam).split(sep).join("/"));
  }
  return liste;
}

const coz = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&rarr;/g, "→").replace(/&middot;/g, "·")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&([a-z]+);/gi, (t, a) => ({ ccedil: "ç", Ccedil: "Ç", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü" }[a] || t));
const meta = (s, ad) => { const m = s.match(new RegExp(`<meta (?:name|property)="${ad}" content="([^"]*)"`)); return m ? coz(m[1]) : null; };

function tur(dosya) {
  const p = dosya.split("/");
  if (dosya === "index.html") return "sayfa";
  if (p[0] === "makaleler") return p.length === 3 ? "makale" : "sayfa";
  if (p[1] === "metodoloji" || p[0] === "bordro") return "metodoloji";
  if (GRAFIK.has(p[0])) return "grafik";
  return ARAC_IKON[p[0]] ? "arac" : "sayfa";
}
const ARAC_IKON = json(join(KOK, "tools", "card-icons.json"));
const MAKALE_JSON = Object.fromEntries(json(join(KOK, "tools", "makaleler.json")).map((m) => [m.slug, m]));

function kategori(dosya, t) {
  const p = dosya.split("/");
  if (p[0] === "bordro") return "maas-tazminat";
  if (t === "arac" || t === "metodoloji") return ARAC_KAT[ARAC_IKON[p[0]]?.cat] || null;
  if (t === "makale") {
    const k = MAKALE_JSON[p[1]]?.kicker;
    if (k && !MAKALE_KAT[k]) throw new Error("Eşlenmemiş makale kicker'ı: " + k + " (" + dosya + ")");
    return k ? MAKALE_KAT[k] : null;
  }
  if (t === "grafik") return "kredi-finans";
  return null;
}

/* Elle verilmiş ilgili bağlantılar: "İlgili …" başlıklı bölümdeki listeler. */
function ilgili(s, url) {
  const out = [];
  /* Üretilen blok (scripts/build-pages.mjs) elle verilmiş bağlantı değildir. */
  s = s.replace(/<!-- ILGILI:BASLANGIC -->[\s\S]*?<!-- ILGILI:BITIS -->/g, "");
  const re = /<h2[^>]*>\s*İlgili[^<]*<\/h2>([\s\S]*?)(?=<h2\b|<\/section>|<!-- METODOLOJI)/g;
  let m;
  while ((m = re.exec(s))) {
    for (const a of m[1].matchAll(/<a\b[^>]*href="([^"#?]+)/g)) {
      const u = new URL(a[1], url);
      if (u.origin !== SITE) continue;
      const yol = u.pathname.replace(/index\.html$/, "");
      const tamUrl = SITE + yol;
      if (tamUrl !== url && tamUrl !== SITE + "/" && !out.includes(tamUrl)) out.push(tamUrl);
    }
  }
  return out;
}

function eskiAtom() {
  const p = join(KOK, "atom.xml"), m = {};
  if (!existsSync(p)) return m;
  for (const e of oku(p).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const l = e[1].match(/<link[^>]*href="([^"]+)"/), y = e[1].match(/<published>([^<]+)<\/published>/) || e[1].match(/<updated>([^<]+)<\/updated>/);
    if (l && y) m[l[1]] = y[1];
  }
  return m;
}
/* Bir sayfa yayımlanmadan güncellenmiş olamaz: updated, özlü commit tarihi,
   ilk yayın damgası ve (yazılarda) datePublished'ın en geç olanı. */
function guncel(g, yayin, dp) {
  const aday = [];
  if (g?.tarih) aday.push([g.tarih, g.zaman]);
  if (yayin) aday.push([istanbulGunu(yayin), yayin]);
  if (dp) aday.push([dp, dp + "T00:00:00+03:00"]);
  aday.sort((a, b) => a[0].localeCompare(b[0]) || String(a[1]).localeCompare(String(b[1])));
  const son = aday[aday.length - 1] || [null, null];
  return { updated: son[0], updatedAt: son[1] };
}
function istanbulGunu(iso) { return new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 10); }
function simdi() {
  const d = new Date(Date.now() + 3 * 3600e3);
  return d.toISOString().slice(0, 19) + "+03:00";
}
function ilkCommit(yol) {
  const s = execFileSync("git", ["log", "--diff-filter=A", "--follow", "--format=%cI", "--", yol], { cwd: KOK, encoding: "utf8" }).trim().split("\n");
  const z = s[s.length - 1];
  return z ? z.replace(/Z$/, "+00:00") : null;
}

function guncellemeler(yollar) {
  const r = execFileSync("python", [join(KOK, "tools", "arac-guncelleme.py"), "--tarih-json"],
    { cwd: KOK, input: yollar.join("\n"), encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, maxBuffer: 1 << 24 });
  return JSON.parse(r);
}

export function uret() {
  const onceki = existsSync(CIKTI) ? Object.fromEntries(json(CIKTI).sayfalar.map((s) => [s.url, s])) : {};
  const atom = eskiAtom();
  const dosyalar = sayfalar().filter((d) => d !== "404.html" && !/^google[0-9a-f]+\.html$/.test(d));
  const kayit = dosyalar.map((dosya) => {
    const s = oku(join(KOK, dosya));
    const url = SITE + "/" + dosya.replace(/index\.html$/, "");
    const t = tur(dosya);
    const baslik = coz((s.match(/<title>([\s\S]*?)<\/title>/) || ["", ""])[1].trim()).replace(/\s*\|\s*Koray Öner$/, "");
    const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/.test(s);
    const dp = (s.match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    return { dosya, url, t, s, baslik, noindex, dp, tarihYolu: t === "arac" && dosya.split("/").length === 2 ? dosya.split("/")[0] : dosya };
  });
  const g = guncellemeler(kayit.map((k) => k.tarihYolu));
  const sayfa = kayit.map((k) => {
    const image = meta(k.s, "og:image");
    /* Yayın damgası bir kez yazılır: önceki manifest → eski atom.xml'deki
       ilk ekleniş → dosyanın ilk commit'i → şimdi (henüz commit'lenmemiş
       yeni sayfa). Gece yarısı damgası uydurulmaz. */
    let yayin = onceki[k.url]?.published || atom[k.url] || ilkCommit(k.dosya) || simdi();
    /* Eski beslemeden gelen gece yarısı damgası, ilk commit aynı (İstanbul)
       günündeyse gerçek saatiyle düzeltilir; gün tutmuyorsa olduğu gibi
       kalır (başka günün saatini yazmak uydurmak olurdu). */
    if (/T00:00:00\+03:00$/.test(yayin)) {
      const ilk = ilkCommit(k.dosya);
      if (ilk && istanbulGunu(ilk) === yayin.slice(0, 10)) yayin = ilk;
    }
    const imageTitle = image ? (/Koray Öner/.test(k.baslik) ? k.baslik : k.baslik + " — Koray Öner") : null;
    return {
      url: k.url, dosya: k.dosya, type: k.t,
      /* Araç klasörünün içindeki alt sayfa (ör. Brüt–Net Tablosu, tutar
         sayfaları, metodoloji): üst aracın adresi. Sayaç yalnız üst araçları sayar. */
      parent: k.dosya.split("/").length > 2 && k.t !== "makale" ? SITE + "/" + k.dosya.split("/")[0] + "/" : null,
      title: k.baslik, description: meta(k.s, "description"),
      category: kategori(k.dosya, k.t), published: yayin,
      ...guncel(g[k.tarihYolu], yayin, k.dp),
      image, imageTitle, related: ilgili(k.s, k.url), noindex: k.noindex
    };
  });
  const indeks = sayfa.filter((s) => !s.noindex);
  const sayac = (t) => indeks.filter((s) => s.type === t && !(t === "arac" && s.parent)).length;
  /* Öne çıkanlar: ana sayfadaki "Hızlı erişim" listesi. Arama paletinin
     boş sorgu görünümü bunu kullanır. */
  const ana = oku(join(KOK, "index.html"));
  const hizli = (ana.match(/<aside class="hero-quick[\s\S]*?<\/aside>/) || [""])[0];
  const oneCikanlar = [...hizli.matchAll(/<li><a href="([^"#]+)"/g)].map((m) => SITE + "/" + m[1].replace(/^\.?\//, ""));
  return {
    site: SITE,
    kategoriler: KATEGORILER,
    oneCikanlar,
    sayaclar: { arac: sayac("arac"), makale: sayac("makale"), metodoloji: sayac("metodoloji"), grafik: sayac("grafik"), sayfa: sayac("sayfa"), indekslenebilir: indeks.length },
    sayfalar: sayfa.sort((a, b) => a.url.localeCompare(b.url))
  };
}

export function oku_manifest() { return json(CIKTI); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const yeni = JSON.stringify(uret(), null, 1) + "\n";
  const eski = existsSync(CIKTI) ? oku(CIKTI) : "";
  if (process.argv.includes("--check")) {
    if (yeni !== eski) { console.error("content.json bayat — 'node scripts/build-manifest.mjs' çalıştırın."); process.exit(1); }
    console.log("content.json güncel.");
  } else {
    if (yeni !== eski) writeFileSync(CIKTI, yeni);
    const m = JSON.parse(yeni);
    console.log("content.json: " + m.sayfalar.length + " sayfa · " + JSON.stringify(m.sayaclar));
  }
}
