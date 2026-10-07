#!/usr/bin/env node
/*
 * Manifestten üretilen katalog sayfaları.
 *
 *   /araclar/   Bütün araçlar, kategori bölümleriyle (#maas-tazminat,
 *               #vergi-belge, #kredi-finans). Kartlar ana sayfadaki kartların
 *               aynısıdır (tasarım tek yerde); her kartta güncelleme tarihi ve
 *               metodoloji bağlantısı. Bölüm çipleri gerçek çapalardır: JS
 *               yoksa bölüme gider, varsa katalog.js süzer. Sayım manifestten.
 *
 * Kullanım:
 *   node scripts/build-pages.mjs           # yaz
 *   node scripts/build-pages.mjs --check   # güncel mi (CI)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(KOK, "content.json"), "utf8"));
const SITE = M.site;
const oku = (p) => readFileSync(join(KOK, p), "utf8");
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Araç kategorileri, ana sayfadaki çip sırasıyla. */
const ARAC_KATEGORI = ["maas-tazminat", "vergi-belge", "kredi-finans"];
const KAT_ACIKLAMA = {
  "maas-tazminat": "Brüt-net maaş, bordro, kıdem ve ihbar, işten ayrılma, emeklilik ve SGK hesapları.",
  "vergi-belge": "Gelir, kira, veraset, ÖTV, MTV ve gümrük vergileri; fatura ve makbuz belgeleri.",
  "kredi-finans": "Kredi, kart borcu, mevduat, enflasyon, birikim ve yatırım karşılaştırmaları."
};

/* Ana sayfadaki kart, kendi klasörüne göre. */
function kartlar() {
  const ana = oku("index.html"), harita = {};
  for (const m of ana.matchAll(/<li class="project-card[^"]*"[^>]*>[\s\S]*?<\/li>/g)) {
    const h = m[0].match(/<h3><a href="([^"]+)"/);
    if (h) harita[h[1].replace(/^\.?\//, "").replace(/\/$/, "")] = m[0];
  }
  return harita;
}

/* Metodoloji: ayrı sayfa varsa o; yoksa aracın "Bu sayfada" satırındaki
   yöntem bölümü; o da yoksa bağlantı verilmez. */
function metodoloji(arac) {
  const ayri = M.sayfalar.find((s) => s.type === "metodoloji" && s.parent === arac.url);
  if (ayri) return ayri.url.replace(SITE, "..");
  const s = oku(arac.dosya), yerel = (s.match(/<nav class="yerel-menu"[\s\S]*?<\/nav>/) || [""])[0];
  const YONTEM = /nasıl hesaplan|yöntem|metodoloji|formül|nasıl çalış/i;
  for (const m of yerel.matchAll(/<a href="(#[^"]+)">([^<]+)<\/a>/g)) {
    if (YONTEM.test(m[2])) return arac.url.replace(SITE, "..") + m[1];
  }
  /* Yöntemi anlatan bir ara başlık; yoksa her araçtaki künye ("Bu aracı kim
     yaptı, nasıl hesaplıyor?"), hesabın kaynağına ve koduna bağlanır. */
  for (const m of s.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([^<]+)</g)) {
    if (m[1] !== "metod-title" && YONTEM.test(m[2])) return arac.url.replace(SITE, "..") + "#" + m[1];
  }
  if (/id="metod-title"/.test(s)) return arac.url.replace(SITE, "..") + "#metod-title";
  return null;
}

function kartUyarla(html, arac) {
  let k = html.replace(/class="project-card reveal/, 'class="project-card')
    .replace(/(\s(?:href|src))="(?!https?:|#|\/|\.\.\/)([^"]*)"/g, '$1="../$2"');
  const met = metodoloji(arac);
  if (met && !/>Metodoloji<\/a>/.test(k)) k = k.replace(/(<p class="project-links">[\s\S]*?)(<\/p>)/, '$1 · <a href="' + met + '">Metodoloji</a>$2');
  return k;
}

function araclar() {
  const K = kartlar();
  const liste = M.sayfalar.filter((s) => s.type === "arac" && !s.parent && !s.noindex);
  const eksik = liste.filter((a) => !K[a.dosya.split("/")[0]]);
  if (eksik.length) throw new Error("Ana sayfada kartı olmayan araç: " + eksik.map((a) => a.url).join(", "));
  /* Ana sayfadaki sıra korunur. */
  const sira = Object.keys(K);
  liste.sort((a, b) => sira.indexOf(a.dosya.split("/")[0]) - sira.indexOf(b.dosya.split("/")[0]));
  const bolum = ARAC_KATEGORI.map((k) => ({ k, ad: M.kategoriler[k], araclar: liste.filter((a) => a.category === k) }));
  const out = [];
  out.push('        <div class="section-head katalog-bas">',
    '          <h1 id="katalog-baslik">Hesaplama araçları</h1>',
    "          <p>" + liste.length + " araç: hepsi ücretsiz, reklamsız ve üyeliksiz; hesap tarayıcınızda yapılır. Her kartta son güncelleme tarihi ve hesabın nasıl yapıldığını anlatan metodoloji bağlantısı var.</p>",
    "        </div>",
    '        <nav class="chips katalog-cipler" aria-label="Kategoriler" data-katalog-cipler>',
    '          <a class="chip" href="#tum-araclar" data-bolum="" aria-current="true">Tümü <span class="chip-sayi">' + liste.length + "</span></a>");
  for (const b of bolum) out.push('          <a class="chip" href="#' + b.k + '" data-bolum="' + b.k + '">' + esc(b.ad) + ' <span class="chip-sayi">' + b.araclar.length + "</span></a>");
  out.push("        </nav>", '        <p class="katalog-durum" role="status" aria-live="polite"></p>', '        <div id="tum-araclar">');
  for (const b of bolum) {
    out.push('        <section class="katalog-bolum" id="' + b.k + '" data-bolum-id="' + b.k + '" aria-labelledby="' + b.k + '-baslik">',
      '          <h2 id="' + b.k + '-baslik">' + esc(b.ad) + ' <span class="katalog-sayi">' + b.araclar.length + " araç</span></h2>",
      "          <p>" + esc(KAT_ACIKLAMA[b.k]) + "</p>",
      '          <ul class="project-grid">');
    for (const a of b.araclar) out.push(kartUyarla(K[a.dosya.split("/")[0]], a));
    out.push("          </ul>", "        </section>");
  }
  out.push("        </div>");
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": SITE + "/araclar/#sayfa", url: SITE + "/araclar/", name: "Hesaplama araçları", inLanguage: "tr",
        isPartOf: { "@id": SITE + "/#website" }, primaryImageOfPage: SITE + "/images/araclar-koray-oner.png",
        mainEntity: { "@type": "ItemList", numberOfItems: liste.length,
          itemListElement: liste.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: a.url, name: a.title })) } },
      { "@type": "BreadcrumbList", "@id": SITE + "/araclar/#breadcrumb", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Araçlar", item: SITE + "/araclar/" }] }
    ]
  };
  return { govde: out.join("\n"), ld: '<script type="application/ld+json">' + JSON.stringify(ld) + "</script>" };
}

function blok(html, ad, icerik) {
  const bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  const i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("Blok yok: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}

/* ---- Konum izi ------------------------------------------------------------
 * Görünür iz ve BreadcrumbList manifestteki hiyerarşiden yazılır:
 *   araç        Ana Sayfa › Araçlar › Araç
 *   alt sayfa   Ana Sayfa › Araçlar › Araç › Alt sayfa (metodoloji, tablo, tutar)
 *   yazı        Ana Sayfa › Makaleler › Kategori (/makaleler/#anahtar) › Yazı
 *   Diyagramlar Ana Sayfa › Grafikler › Diyagramlar (menüde de Grafikler altında)
 *   diğerleri   Ana Sayfa › Sayfa
 * Her sayfanın kendi adı (izin son öğesi) sayfadaki mevcut izden okunur; ad
 * bir kez seçilir, üreteç onu korur. Ana sayfa izsizdir; hakkımda yalnız LD
 * taşır (tools/iz-test.js IZSIZ).
 */
const IZ_RE = /(<nav class="breadcrumb[^"]*"[^>]*>)([\s\S]*?)(<\/nav>)/;
const coz = (x) => x.replace(/&#8250;/g, "›").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

function izAdi(html) {
  const iz = html.match(IZ_RE);
  if (!iz) return null;
  let son = iz[2].slice(iz[2].lastIndexOf("</a>") + 4);
  if (iz[2].lastIndexOf("</a>") < 0) son = iz[2];
  son = coz(son.replace(/<span aria-hidden="true">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, ""));
  return son.replace(/^[\s›»/]+/, "").replace(/\s+/g, " ").trim();
}

function ldAdi(html) {
  for (const n of ldDugumleri(html)) if (n["@type"] === "BreadcrumbList") return n.itemListElement.at(-1).name;
  return null;
}

function ldDugumleri(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { continue; }
    out.push(...(Array.isArray(d) ? d : d["@graph"] || [d]));
  }
  return out;
}

function zincir(s, adlar, icerik) {
  const ana = { ad: "Ana Sayfa", url: SITE + "/" };
  const ust = (u) => M.sayfalar.find((x) => x.url === u);
  /* Üst sayfa: manifestteki parent, yoksa klasörce en yakın atası. */
  let ata = s.parent ? ust(s.parent) : null;
  if (!ata && s.dosya.split("/").length > 2) {
    const p = s.dosya.split("/").slice(0, -2);
    while (p.length && !ata) { ata = ust(SITE + "/" + p.join("/") + "/"); p.pop(); }
  }
  const ben = { ad: adlar[s.url], url: s.url };
  if (s.type === "makale") {
    return [ana, { ad: "Makaleler", url: SITE + "/makaleler/" },
      { ad: M.kategoriler[s.category], url: SITE + "/makaleler/#" + s.category }, ben];
  }
  if (s.type === "arac" || (s.type === "metodoloji" && ata)) {
    const z = [ana, { ad: "Araçlar", url: SITE + "/araclar/" }];
    if (ata) z.push({ ad: adlar[ata.url], url: ata.url });
    return [...z, ben];
  }
  if (s.url === SITE + "/diyagramlar/") return [ana, { ad: adlar[SITE + "/grafikler/"], url: SITE + "/grafikler/" }, ben];
  return [ana, ben];
}

function goreli(dosya, url) {
  const derinlik = dosya.split("/").length - 1;
  const yol = url.slice(SITE.length + 1);
  return "../".repeat(derinlik) + yol || "./";
}

/* BreadcrumbList'in itemListElement dizisini metinde bulup yerine yazar;
   JSON-LD'nin geri kalanına dokunulmaz. */
function ldYaz(html, yeni) {
  const eskiDugum = ldDugumleri(html).find((n) => n["@type"] === "BreadcrumbList");
  if (!eskiDugum) throw new Error("BreadcrumbList yok");
  const hedef = JSON.stringify(eskiDugum.itemListElement);
  /* Aynı yol başka bir üreteçte başka boşlukla yazılmış olabilir: içerik
     aynıysa metne dokunma (iki üreteç birbirini yeniden yazmasın). */
  const ayni = JSON.stringify(yeni.map((o, k) => ({ "@type": "ListItem", position: k + 1, name: o.ad, item: o.url })));
  if (hedef === ayni) return html;
  const anahtar = '"itemListElement"';
  for (let i = html.indexOf(anahtar); i >= 0; i = html.indexOf(anahtar, i + 1)) {
    const bas = html.indexOf("[", i);
    let d = 0, j = bas, str = false;
    for (; j < html.length; j++) {
      const c = html[j];
      if (str) { if (c === "\\") j++; else if (c === '"') str = false; continue; }
      if (c === '"') str = true; else if (c === "[") d++; else if (c === "]" && --d === 0) break;
    }
    const eski = html.slice(bas, j + 1);
    let deger; try { deger = JSON.parse(eski); } catch { continue; }
    if (JSON.stringify(deger) !== hedef) continue;
    const ogeler = yeni.map((o, k) => '{ "@type": "ListItem", "position": ' + (k + 1) + ', "name": ' + JSON.stringify(o.ad) + ', "item": ' + JSON.stringify(o.url) + " }");
    let metin;
    if (eski.includes("\n")) {
      const satirBas = html.lastIndexOf("\n", i) + 1;
      const girinti = html.slice(satirBas, i).match(/^\s*/)[0];
      metin = "[\n" + ogeler.map((o) => girinti + "  " + o).join(",\n") + "\n" + girinti + "]";
    } else metin = "[" + ogeler.join(", ") + "]";
    return html.slice(0, bas) + metin + html.slice(j + 1);
  }
  throw new Error("BreadcrumbList dizisi metinde bulunamadı");
}

function izYaz(html, s, z) {
  const ld = ldYaz(html, z);
  const iz = ld.match(IZ_RE);
  if (!iz) return ld;
  const satirBas = ld.lastIndexOf("\n", iz.index) + 1;
  const g = (ld.slice(satirBas, iz.index).match(/^[ 	]*$/) || [""])[0];
  const ara = z.slice(0, -1).map((o, k) => g + "  <a href=\"" + goreli(s.dosya, o.url) + "\">" + esc(o.ad) + '</a> <span aria-hidden="true">›</span>' + (k === z.length - 2 ? " " + esc(z.at(-1).ad) : ""));
  const yeni = iz[1] + "\n" + ara.join("\n") + "\n" + g + iz[3];
  return ld.replace(IZ_RE, () => yeni);
}

function izler(degisen) {
  const icerik = (d) => degisen[d] ?? oku(d);
  const adlar = {};
  /* Yazının adı başlığıdır (eski izlerin bazısı son öğede kategori taşıyordu). */
  const h1 = (h) => { const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/); return m && coz(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); };
  for (const s of M.sayfalar) {
    const h = icerik(s.dosya);
    adlar[s.url] = (s.type === "makale" && h1(h)) || izAdi(h) || ldAdi(h) || s.title;
  }
  const out = {};
  for (const s of M.sayfalar) {
    if (s.url === SITE + "/") continue;
    const h = icerik(s.dosya);
    if (!/"BreadcrumbList"/.test(h)) continue;
    out[s.dosya] = izYaz(h, s, zincir(s, adlar));
  }
  return { out, adlar };
}

/* ---- İlgili bağlantılar ---------------------------------------------------
 * Her araçta 3 yazı; her yazıda 3 araç ve 2 yazı. Sıra:
 *   1. elle verilmiş bağlantı (sayfanın "İlgili …" bölümü ve gövdedeki
 *      bağlantılar, geçtiği sırayla),
 *   2. aynı kategori,
 *   3. bağımlılıksız TF-IDF benzerliği (gövde metni, Türkçe kökün ilk 6 harfi).
 * 2 ve 3 tek puanda birleşir: aynı kategori +1. Kendine bağlantı yok; dizine
 * kapalı sayfalar ne aday ne hedef (tutar sayfalarına ortak metin eklenmez,
 * AGENTS.md bölüm 1). Blok kabuktur: tarih kaydırmaz (tools/arac-guncelleme.py).
 */
const DURAK = new Set("acaba ama ancak artık aslında az bana bazı belki ben beni benim beri bile bir biri birkaç birşey biz bize bizi bizim böyle bu buna bunda bundan bunu bunun burada çok çünkü da daha dahi de defa diye eğer en gibi göre hem hep hepsi her hiç için ile ise kadar ki kim mı mi mu mü nasıl ne neden nerde nerede nereye niye niçin olan olarak oldu olduğu olduğunu olmak olması olur on ona ondan onlar onları onu onun öyle pek sadece sanki şey siz şu şunu tüm ve veya ya yani yine yok zaten yıl tl ayı ay gün olan olur".split(" "));
const katla = (x) => x.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "");

function govdeMetni(h) {
  const m = h.match(/<main[\s\S]*?<\/main>/);
  return (m ? m[0] : h)
    .replace(/<!-- ILGILI:BASLANGIC -->[\s\S]*?<!-- ILGILI:BITIS -->/g, " ")
    .replace(/<(script|style|svg|nav|form|output|figure)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<section class="(related|method)[\s\S]*?<\/section>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
}

function kokler(metin) {
  return katla(metin).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !DURAK.has(w)).map((w) => w.slice(0, 6));
}

function vektorler(sayfalar, icerik) {
  const tf = new Map(), df = new Map();
  for (const s of sayfalar) {
    const say = new Map();
    for (const k of kokler(s.title + " " + s.title + " " + (s.description || "") + " " + govdeMetni(icerik(s.dosya)))) say.set(k, (say.get(k) || 0) + 1);
    tf.set(s.url, say);
    for (const k of say.keys()) df.set(k, (df.get(k) || 0) + 1);
  }
  const N = sayfalar.length, v = new Map();
  for (const [u, say] of tf) {
    const w = new Map(); let n = 0;
    for (const [k, c] of say) { const x = (1 + Math.log(c)) * Math.log(N / df.get(k)); w.set(k, x); n += x * x; }
    n = Math.sqrt(n) || 1;
    for (const [k, x] of w) w.set(k, x / n);
    v.set(u, w);
  }
  return v;
}

function benzerlik(a, b) {
  let t = 0;
  const [k, b2] = a.size < b.size ? [a, b] : [b, a];
  for (const [w, x] of k) { const y = b2.get(w); if (y) t += x * y; }
  return t;
}

function elle(s, h) {
  /* Manifestin "related"i + gövdedeki iç bağlantılar, geçtiği sırayla. */
  const out = [...(s.related || [])];
  for (const m of (h.match(/<main[\s\S]*?<\/main>/) || [""])[0]
    .replace(/<!-- ILGILI:BASLANGIC -->[\s\S]*?<!-- ILGILI:BITIS -->/g, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/g, "")
    .matchAll(/<a\b[^>]*href="([^"#?]+)/g)) {
    let u; try { u = new URL(m[1], s.url); } catch { continue; }
    if (u.origin !== SITE) continue;
    const tam = SITE + u.pathname.replace(/index\.html$/, "");
    if (!out.includes(tam)) out.push(tam);
  }
  return out;
}

function ilgiliBlok(s, gruplar, adlar) {
  const satir = (x) => '          <li><a href="' + goreli(s.dosya, x.url) + '">' + esc(adlar[x.url]) + "</a></li>";
  const p = ['    <section class="related ilgili-uretilen" aria-labelledby="ilgili-baslik">', '      <div class="wrap prose">'];
  gruplar.forEach(([baslik, liste], i) => {
    if (!liste.length) return;
    p.push("        <h2" + (i === 0 ? ' id="ilgili-baslik"' : "") + ">" + baslik + "</h2>", "        <ul>", ...liste.map(satir), "        </ul>");
  });
  p.push("      </div>", "    </section>");
  return p.join("\n");
}

function ilgililer(degisen, adlar) {
  const icerik = (d) => degisen[d] ?? oku(d);
  const acik = M.sayfalar.filter((s) => !s.noindex);
  const araclar = acik.filter((s) => s.type === "arac" && !s.parent);
  const yazilar = acik.filter((s) => s.type === "makale");
  const V = vektorler([...araclar, ...yazilar], icerik);
  function sec(s, adaylar, n) {
    const el = elle(s, icerik(s.dosya));
    const puan = (x) => {
      const i = el.indexOf(x.url);
      if (i >= 0) return 100 - i / 100;
      return (x.category === s.category ? 1 : 0) + benzerlik(V.get(s.url), V.get(x.url));
    };
    return adaylar.filter((x) => x.url !== s.url).map((x) => [puan(x), x]).sort((a, b) => b[0] - a[0] || (a[1].url < b[1].url ? -1 : 1)).slice(0, n).map((x) => x[1]);
  }
  const out = {};
  for (const s of [...araclar, ...yazilar]) {
    const gruplar = s.type === "arac"
      ? [["Bu konudaki yazılar", sec(s, yazilar, 3)]]
      : [["Bu yazıyla ilgili araçlar", sec(s, araclar, 3)], ["Okumaya devam", sec(s, yazilar, 2)]];
    let h = icerik(s.dosya);
    const yeni = "    <!-- ILGILI:BASLANGIC -->\n" + ilgiliBlok(s, gruplar, adlar) + "\n    <!-- ILGILI:BITIS -->";
    if (h.includes("<!-- ILGILI:BASLANGIC -->")) h = h.replace(/[ 	]*<!-- ILGILI:BASLANGIC -->[\s\S]*?<!-- ILGILI:BITIS -->/, () => yeni);
    else {
      const yer = h.includes("<!-- METODOLOJI-BLOGU:BASLANGIC -->") ? h.indexOf("<!-- METODOLOJI-BLOGU:BASLANGIC -->") : h.lastIndexOf("</main>");
      if (yer < 0) throw new Error("İlgili blok için yer yok: " + s.dosya);
      h = h.slice(0, yer).replace(/[ \t]*$/, "") + yeni + "\n\n  " + h.slice(yer);
    }
    out[s.dosya] = h;
  }
  return out;
}

export function sayfalar() {
  const a = araclar();
  let h = oku("araclar/index.html");
  h = blok(h, "KATALOG", a.govde);
  h = blok(h, "KATALOG-LD", a.ld);
  const out = { "araclar/index.html": h };
  const iz = izler(out);
  Object.assign(out, iz.out);
  Object.assign(out, ilgililer(out, iz.adlar));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const kontrol = process.argv.includes("--check"), bayat = [];
  for (const [yol, icerik] of Object.entries(sayfalar())) {
    const eski = existsSync(join(KOK, yol)) ? oku(yol) : "";
    if (icerik === eski) continue;
    bayat.push(yol);
    if (!kontrol) writeFileSync(join(KOK, yol), icerik);
  }
  if (kontrol) {
    if (bayat.length) { console.error("Bayat katalog: " + bayat.join(", ") + " — 'node scripts/build-pages.mjs' çalıştırın."); process.exit(1); }
    console.log("Katalog sayfaları manifestle aynı.");
  } else console.log("Katalog sayfaları yazıldı" + (bayat.length ? ": " + bayat.join(", ") : " (değişiklik yok)") + ".");
}
