/*!
 * Site içi arama — komut paleti (her sayfa) ve /ara/ sayfası.
 *
 * Dizin Pagefind'ın; derleme sırasında üretilir (pagefind.yml). Bu modül:
 *   - başlıktaki "Ara" bağlantısını, Ctrl/Cmd+K ve "/" kısayollarını bir
 *     komut paletine bağlar (JS yoksa bağlantı /ara/'ya gider);
 *   - boş sorguda öne çıkanları (/arama-oneriler.json, ana sayfadaki
 *     "Hızlı erişim"in manifest karşılığı) gösterir; Pagefind'ı ancak ilk
 *     harf yazılınca yükler (tembel yükleme);
 *   - sorguyu Türkçe katlar: "kıdem" ve "kidem" aynı sorgudur;
 *   - /ara/ sayfasında tür ve kategori filtresi, sıralama sunar.
 *
 * Erişilebilirlik: palet bir dialog; odak içinde tutulur, Esc kapatır ve
 * odağı açan öğeye geri verir, sonuç sayısı canlı bölgede duyurulur, ok
 * tuşları sonuçlar arasında gezer.
 *
 * Lisans: MIT — Koray Öner
 */

/* Sorgu katlama: dizindeki katlanmış kelimelerle (scripts/apply-shell.mjs) aynı. */
export function normalize(q) {
  return String(q || "").toLocaleLowerCase("tr").replace(/i̇/g, "i").replace(/ı/g, "i").replace(/ç/g, "c")
    .replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/\s+/g, " ").trim();
}

const TUR_ROZET = { "Araç": "arac", "Makale": "makale", "Metodoloji": "metodoloji", "Grafik": "grafik", "Sayfa": "sayfa" };
let pfSoz = null;
function pagefind() {
  if (!pfSoz) {
    pfSoz = import("/pagefind/pagefind.js").then(async (pf) => {
      await pf.options({ excerptLength: 22 });
      pf.init();
      return pf;
    });
  }
  return pfSoz;
}
let oneriSoz = null;
function oneriler() {
  if (!oneriSoz) oneriSoz = fetch("/arama-oneriler.json").then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return oneriSoz;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Sonuçta Pagefind alıntısı değil manifestteki özgün açıklama durur: dizin
   "ı"sı katlanmış bir kopyadan kurulduğu için alıntı "kidem tazminati" gibi
   okunurdu. Başlık ve açıklama sayfanın kendi metnidir. */
function sonucHtml(r, i, palet = true) {
  const tur = r.tur || "Sayfa";
  const rol = palet ? ' role="option" id="ara-s-' + i + '" aria-selected="' + (i === 0) + '"' : "";
  return "<li" + (palet ? ' role="none"' : "") + '><a href="' + esc(r.url) + '" class="ara-sonuc"' + rol + ">" +
    '<span class="ara-rozet ara-rozet--' + (TUR_ROZET[tur] || "sayfa") + '">' + esc(tur) + "</span>" +
    '<span class="ara-sonuc-govde"><span class="ara-sonuc-baslik">' + esc(r.baslik) + "</span>" +
    (r.aciklama ? '<span class="ara-sonuc-aciklama">' + esc(r.aciklama) + "</span>" : "") +
    (!palet && r.guncelleme ? '<span class="ara-sonuc-tarih">Güncelleme: <time datetime="' + esc(r.guncelleme) + '">' + uzunTarih(r.guncelleme) + "</time></span>" : "") +
    "</span></a></li>";
}
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function uzunTarih(iso) { const p = String(iso).split("-"); return p.length === 3 ? +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0] : iso; }

/* Başlık eşleşmesi önce: sorgunun bütün kelimeleri başlıkta geçen sayfa,
   ilk sonuçlar içinde öne alınır; geri kalan sıra Pagefind'ındır. Pagefind
   uzun sayfalarda çok geçen kelimeyi öne koyuyordu ("emekli zammı"
   sorgusunda Emekli Zammı Hesaplama altıncıydı). Kelime sonu ekleri için
   karşılaştırma kökün en az dört harfiyle yapılır (zammı ~ zamm; "zaman" eşleşmez). */
function baslikEsler(baslik, kelimeler) {
  const b = normalize(baslik).split(/[^a-z0-9]+/).filter(Boolean);
  return kelimeler.every((w) => b.some((t) => t.startsWith(w.slice(0, Math.max(4, w.length - 2))) || (w.startsWith(t) && t.length >= 4)));
}

export async function sorgula(q, secenek = {}) {
  const pf = await pagefind();
  const nq = q == null ? null : normalize(q);
  const r = await pf.search(nq, { filters: secenek.filters, sort: secenek.sort });
  const sinir = secenek.sinir || 8;
  const veri = await Promise.all(r.results.slice(0, sinir + (nq && !secenek.sort ? 4 : 0)).map((x) => x.data()));
  let sonuclar = veri.map((d, i) => ({
    url: d.url, baslik: (d.meta && d.meta.title) || d.url, aciklama: d.meta && d.meta.description, alinti: d.excerpt,
    tur: d.filters && d.filters["tür"] && d.filters["tür"][0], guncelleme: d.meta && d.meta["güncelleme"], sira: i
  }));
  if (nq && !secenek.sort) {
    const k = nq.split(" ").filter((w) => w.length >= 2);
    sonuclar.sort((a, b) => (baslikEsler(b.baslik, k) - baslikEsler(a.baslik, k)) || a.sira - b.sira);
  }
  return { toplam: r.results.length, sonuclar: sonuclar.slice(0, sinir) };
}

/* ------------------------------------------------------------ palet */
let ortu, kutu, girdi, liste, durum, acan, sayac = 0;

function paletKur() {
  ortu = document.createElement("div");
  ortu.className = "ara-ortu";
  ortu.hidden = true;
  ortu.innerHTML =
    '<div class="ara-kutu" role="dialog" aria-modal="true" aria-labelledby="ara-baslik">' +
    '<h2 id="ara-baslik" class="visually-hidden">Sitede ara</h2>' +
    '<form class="ara-form" role="search" action="/ara/" method="get">' +
    '<label for="ara-q" class="visually-hidden">Araç ya da yazı ara</label>' +
    '<input id="ara-q" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Araç ya da yazı ara: kıdem, SGK tavanı, MTV…"' +
    ' role="combobox" aria-expanded="true" aria-controls="ara-liste" aria-autocomplete="list">' +
    '<button type="button" class="ara-kapat" aria-label="Aramayı kapat">Esc</button></form>' +
    '<p class="ara-durum" role="status" aria-live="polite"></p>' +
    '<ul id="ara-liste" class="ara-liste" role="listbox" aria-label="Sonuçlar"></ul>' +
    '<p class="ara-alt"><a href="/ara/">Filtreli arama</a><span aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> gezin · <kbd>Enter</kbd> aç · <kbd>Esc</kbd> kapat</span></p>' +
    "</div>";
  document.body.appendChild(ortu);
  kutu = ortu.querySelector(".ara-kutu");
  girdi = ortu.querySelector("#ara-q");
  liste = ortu.querySelector("#ara-liste");
  durum = ortu.querySelector(".ara-durum");
  ortu.querySelector(".ara-kapat").addEventListener("click", kapat);
  ortu.addEventListener("mousedown", (e) => { if (e.target === ortu) kapat(); });
  let zaman;
  girdi.addEventListener("input", () => { clearTimeout(zaman); zaman = setTimeout(guncelle, 110); });
  ortu.querySelector(".ara-form").addEventListener("submit", (e) => {
    const sec = liste.querySelector('[aria-selected="true"]');
    if (sec) { e.preventDefault(); location.href = sec.getAttribute("href"); }
  });
  kutu.addEventListener("keydown", tusPaleti);
}

async function guncelle() {
  const q = girdi.value.trim(), no = ++sayac;
  if (!q) {
    const o = await oneriler();
    if (no !== sayac) return;
    liste.innerHTML = '<li role="none" class="ara-grup">Öne çıkanlar</li>' + o.map((r, i) => sonucHtml({ url: r.url, baslik: r.title, tur: r.tur }, i)).join("");
    durum.textContent = "";
    secimiBagla();
    return;
  }
  durum.textContent = "Aranıyor…";
  try {
    const r = await sorgula(q);
    if (no !== sayac) return;
    liste.innerHTML = r.sonuclar.map((x, i) => sonucHtml(x, i)).join("") ||
      '<li role="none" class="ara-bos">Sonuç yok. <a href="/koray-oner/">Bütün sayfaların dizini</a></li>';
    durum.textContent = r.toplam ? r.toplam + " sonuç" + (r.toplam > 8 ? ", ilk 8'i gösteriliyor" : "") : "Sonuç yok";
  } catch (err) {
    if (no !== sayac) return;
    liste.innerHTML = '<li role="none" class="ara-bos">Arama dizini yüklenemedi. <a href="/ara/?q=' + encodeURIComponent(q) + '">Arama sayfasını açın</a> ya da <a href="/koray-oner/">dizine</a> bakın.</li>';
    durum.textContent = "Arama yüklenemedi";
  }
  secimiBagla();
}

function secimiBagla() {
  const ilk = liste.querySelector('[role="option"]');
  girdi.setAttribute("aria-activedescendant", ilk ? ilk.id : "");
}
function sec(yon) {
  const op = [...liste.querySelectorAll('[role="option"]')];
  if (!op.length) return;
  let i = op.findIndex((a) => a.getAttribute("aria-selected") === "true");
  op.forEach((a) => a.setAttribute("aria-selected", "false"));
  i = (i + yon + op.length) % op.length;
  op[i].setAttribute("aria-selected", "true");
  op[i].scrollIntoView({ block: "nearest" });
  girdi.setAttribute("aria-activedescendant", op[i].id);
}

function tusPaleti(e) {
  if (e.key === "Escape") { e.preventDefault(); kapat(); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); sec(1); return; }
  if (e.key === "ArrowUp") { e.preventDefault(); sec(-1); return; }
  if (e.key === "Tab") {
    /* Odak hapsi: dialog dışına Tab ile çıkılmaz. */
    const odak = [...kutu.querySelectorAll('input, button, a[href]')].filter((x) => x.offsetParent !== null);
    if (!odak.length) return;
    const ilk = odak[0], son = odak[odak.length - 1];
    if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  }
}

export function ac(tetik) {
  if (!ortu) paletKur();
  if (!ortu.hidden) return;
  acan = tetik || document.activeElement;
  ortu.hidden = false;
  document.documentElement.classList.add("ara-acik");
  girdi.value = "";
  guncelle();
  girdi.focus();
}
function kapat() {
  if (!ortu || ortu.hidden) return;
  ortu.hidden = true;
  document.documentElement.classList.remove("ara-acik");
  if (acan && typeof acan.focus === "function") acan.focus();
}

/* ------------------------------------------------------------ /ara/ sayfası */
async function aramaSayfasi(kok) {
  const form = kok.querySelector("form"), q = kok.querySelector("#ara-sayfa-q");
  const turSec = kok.querySelector("#ara-tur"), katSec = kok.querySelector("#ara-kategori"), siraSec = kok.querySelector("#ara-sira");
  const sonuc = kok.querySelector("#ara-sonuclar"), say = kok.querySelector("#ara-sayac");
  const p = new URLSearchParams(location.search);
  q.value = p.get("q") || "";
  if (p.get("tur")) turSec.value = p.get("tur");
  if (p.get("kategori")) katSec.value = p.get("kategori");
  if (p.get("sira")) siraSec.value = p.get("sira");
  kok.classList.add("ara-js");
  async function calistir() {
    const u = new URLSearchParams();
    if (q.value.trim()) u.set("q", q.value.trim());
    if (turSec.value) u.set("tur", turSec.value);
    if (katSec.value) u.set("kategori", katSec.value);
    if (siraSec.value) u.set("sira", siraSec.value);
    history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
    const filters = {};
    if (turSec.value) filters["tür"] = turSec.value;
    if (katSec.value) filters.kategori = katSec.value;
    const secenek = { filters, sinir: 40 };
    if (siraSec.value === "yeni") secenek.sort = { "güncelleme": "desc" };
    if (!q.value.trim() && !turSec.value && !katSec.value) { sonuc.innerHTML = ""; say.textContent = "Bir sorgu yazın ya da bir tür seçin."; return; }
    say.textContent = "Aranıyor…";
    try {
      const r = await sorgula(q.value.trim() || null, secenek);
      sonuc.innerHTML = r.sonuclar.map((x, i) => sonucHtml(x, i, false)).join("");
      say.textContent = r.toplam ? r.toplam + " sonuç" + (r.toplam > 40 ? ", ilk 40'ı gösteriliyor" : "") : "Sonuç yok";
    } catch (err) {
      say.textContent = "Arama dizini yüklenemedi; bütün sayfalar için çalışma dizinine bakın.";
    }
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); calistir(); });
  [turSec, katSec, siraSec].forEach((s) => s.addEventListener("change", calistir));
  let zaman;
  q.addEventListener("input", () => { clearTimeout(zaman); zaman = setTimeout(calistir, 160); });
  calistir();
}

/* ------------------------------------------------------------ başlangıç */
function baslat() {
  document.querySelectorAll('.site-nav a[href$="ara/"]').forEach((a) => {
    a.setAttribute("aria-haspopup", "dialog");
    a.setAttribute("aria-keyshortcuts", "Control+K");
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (location.pathname === "/ara/") return;
      e.preventDefault();
      ac(a);
    });
  });
  document.addEventListener("keydown", (e) => {
    const yaziyor = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "") || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); ac(); return; }
    if (e.key === "/" && !yaziyor && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ac(); }
  });
  const sayfa = document.querySelector("[data-ara-sayfasi]");
  if (sayfa) aramaSayfasi(sayfa);
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat); else baslat();
}
