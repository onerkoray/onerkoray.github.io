// Araç sayfalarında sınıf gerçekliği: kullanılan her sınıfın, sayfanın
// yüklediği stil dosyalarında EKRAN kuralı olmalı.
//
// NEDEN
// -----
// Aynı hata üç kez yaşandı. Beyanname aracının işaretlemesi başka bir
// araçtan kopyalandı, stilleri kopyalanmadı: form stilsiz açıldı.
// Bordro denetimi ve teklif karşılaştırma aynı şeyi yaptı: .panel-q
// kullanıyorlar ama bu sınıfın genel style.css'teki TEK kuralı
// @media print içinde. Ekranda etiketler girdinin yanına düştü, girdiler
// tarayıcının inset kenarlığıyla açıldı. Yedi araç da .prose-section
// kullanıyordu; o sınıfın hiçbir dosyada kuralı yoktu, SSS'ler kart yerine
// çıplak liste olarak duruyordu. 124 kontrolün hiçbiri görmedi -- sayfa
// normal yükleniyor, yalnızca yanlış görünüyor.
//
// NE SAYILIR
// ----------
// <main> içindeki class="" değerleri ve sayfanın kendi (test olmayan) JS
// dosyalarındaki düz sınıf adları. Dinamik birleştirme ("' + sinif + '")
// sayılmaz: adı çalışma anında belli olur. Stil tarafında @media print
// blokları ÇIKARILIR -- baskı kuralı ekrandaki boşluğu örtmez; .panel-q
// tam olarak böyle gizlendi.
//
// SINIR
// -----
// Kapı "sınıf herhangi bir ekran seçicisinde geçiyor mu?" diye sorar,
// "kuralları eksiksiz mi?" diye değil. .panel-q'nun kendi kuralını silip
// ".panel-q label" kuralını bırakan mutant YEŞİL kalıyor (10 mutanttan
// kaçan tek bu). Daha sıkı biçim -- sınıfın kendi kuralı olmalı -- .rs-tool
// gibi yalnızca kapsam olarak kullanılan sınıflarda sahte alarm üretir.
// Bütün .panel-q kurallarını silen mutant yakalanıyor.
//
// KANCALAR
// --------
// Bazı sınıflar stil için değil, JS ya da anlam için var. Her biri
// gerekçesiyle aşağıda. Listeye eklemek bilinçli bir karar olmalı.

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");

var KANCA = {
  "byline": "her kullanımda 'muted' ile birlikte; görünümü o veriyor (54/54)",
  "is-acik": "sekme durumu için JS kancası; görünüm [aria-selected] ile",
  "d-day": "kıdem aracında tarih seçicilerini JS'e bağlayan kanca",
  "d-month": "kıdem aracında tarih seçicilerini JS'e bağlayan kanca",
  "d-year": "kıdem aracında tarih seçicilerini JS'e bağlayan kanca",
  "calc-out": "çıkış takviminde JS'in doldurduğu kapsayıcı; düzeni içeriği veriyor",
  "proj-title": "çıkış takviminde düz h3; sitenin h3 stili yeterli",
  "kopru-once": "finansal emniyet testinde durum kancası; görünüm kopru-yan ve seviye sınıflarından",
  "report-title": "baskı raporu başlığı; ekranda .report-head gizli",
  "report-meta": "baskı raporu başlığı; ekranda .report-head gizli",
  "report-actions": "yazdır düğmesi kapsayıcısı; düğmenin kendisi .btn ile stilli",
  "no-print": "yalnızca baskıda anlamlı; kuralı @media print içinde"
};

function oku(p) { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } }

// @media print { ... } bloklarını dengeli parantezle çıkar.
function baskiyiCikar(css) {
  var out = "", i = 0;
  for (;;) {
    var j = css.indexOf("@media print", i);
    if (j < 0) { out += css.slice(i); break; }
    out += css.slice(i, j);
    var k = css.indexOf("{", j);
    if (k < 0) break;
    var d = 1;
    k++;
    while (d > 0 && k < css.length) {
      if (css[k] === "{") d++;
      else if (css[k] === "}") d--;
      k++;
    }
    i = k;
  }
  return out;
}

function seciciler(css, ekran) {
  var set = {};
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (ekran) css = baskiyiCikar(css);
  var m, re = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;
  while ((m = re.exec(css))) set[m[1]] = 1;
  return set;
}

// Tireyle biten ad bir önektir ("s-" + seviye): tam adı çalışma anında belli olur.
var DUZ_AD = /^[a-zA-Z_](?:[\w-]*[\w])?$/;

function ekle(liste, deger) {
  // Değerde birleştirme ya da tırnak varsa ad çalışma anında belli olur.
  if (/['"+?(){}$]/.test(deger)) return;
  deger.split(/\s+/).forEach(function (c) { if (c && DUZ_AD.test(c)) liste.push(c); });
}

function htmlSiniflari(h) {
  var out = [], m, re = /class="([^"]*)"/g;
  while ((m = re.exec(h))) ekle(out, m[1]);
  return out;
}

function jsSiniflari(js) {
  var out = [], m;
  var re1 = /class=\\?"([^"\\]*)\\?"/g;
  while ((m = re1.exec(js))) ekle(out, m[1]);
  var re2 = /className\s*=\s*"([^"]*)"/g;
  while ((m = re2.exec(js))) ekle(out, m[1]);
  var re3 = /classList\.(?:add|toggle)\(\s*["']([\w-]+)["']/g;
  while ((m = re3.exec(js))) out.push(m[1]);
  return out;
}

var hata = [];
var sayfa = 0;
var denetlenen = 0;
var kancaKullanildi = {};

fs.readdirSync(KOK, { withFileTypes: true }).forEach(function (g) {
  if (!g.isDirectory() || /^(\.|node_modules|_cekirdek|dist)/.test(g.name)) return;
  var dizin = path.join(KOK, g.name);
  var h = oku(path.join(dizin, "index.html"));
  if (!h || !/<body[^>]*class="[^"]*\bcalculator-page\b/.test(h)) return;
  var ana = h.match(/<main\b[\s\S]*?<\/main>/);
  if (!ana) { hata.push(g.name + ": <main> yok"); return; }
  sayfa++;

  var ekran = {};
  var m, re = /<link rel="stylesheet" href="([^"?]+)/g;
  while ((m = re.exec(h))) {
    if (/^https?:/.test(m[1])) continue;
    var css = oku(path.join(dizin, m[1]));
    if (css === null) { hata.push(g.name + ": stil dosyası okunamadı " + m[1]); continue; }
    Object.assign(ekran, seciciler(css, true));
  }
  (h.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).forEach(function (s) {
    Object.assign(ekran, seciciler(s, true));
  });

  var kullanilan = htmlSiniflari(ana[0]);
  fs.readdirSync(dizin).forEach(function (f) {
    if (/\.js$/.test(f) && !/test\.js$/.test(f) && h.indexOf(f) >= 0) {
      kullanilan = kullanilan.concat(jsSiniflari(oku(path.join(dizin, f))));
    }
  });

  var gorulen = {};
  kullanilan.forEach(function (c) {
    if (gorulen[c]) return;
    gorulen[c] = 1;
    denetlenen++;
    if (ekran[c]) return;
    if (KANCA[c]) { kancaKullanildi[c] = 1; return; }
    hata.push(g.name + ": ." + c + " kullanılıyor ama ekran kuralı yok");
  });
});

function dogru(iddia, kosul, aciklama) {
  if (!kosul) {
    console.error("BASARISIZ: " + iddia + (aciklama ? "\n  " + aciklama : ""));
    process.exitCode = 1;
  }
}

// --- KONTROL ---------------------------------------------------------
// Ölçüm körleşirse yeşil vermesin.
dogru("araç sayfaları tarandı", sayfa >= 30, "taranan: " + sayfa);
dogru("sınıflar denetlendi", denetlenen >= 1000, "denetlenen: " + denetlenen);

// Kör nokta kontrolü: .panel-q genel style.css'te VAR ama yalnızca baskıda.
// Baskı çıkarma çalışmıyorsa bu iki iddiadan biri düşer.
var genel = oku(path.join(KOK, "style.css"));
dogru("KONTROL: .panel-q genel CSS'te geçiyor (baskı kuralı)",
  !!seciciler(genel, false)["panel-q"]);
dogru("KONTROL: .panel-q'nun genel CSS'te EKRAN kuralı yok",
  !seciciler(genel, true)["panel-q"],
  "baskı blokları çıkarılmıyor olabilir -- kapı kör");

// Ölü kanca: listede duran ama artık hiçbir yerde kullanılmayan sınıf,
// listenin gerekçesini boşa düşürür.
Object.keys(KANCA).forEach(function (c) {
  dogru("kanca hâlâ kullanılıyor: ." + c, !!kancaKullanildi[c],
    "listeden çıkarın: '" + c + "' artık kuralsız kullanılmıyor");
});

dogru("araç sayfalarında kuralsız sınıf yok", hata.length === 0,
  hata.join("\n  "));

if (!process.exitCode) {
  console.log("Sınıf gerçekliği: " + sayfa + " araç sayfası, " + denetlenen +
    " sınıf; " + Object.keys(KANCA).length + " gerekçeli kanca, kuralsız sınıf yok.");
}
