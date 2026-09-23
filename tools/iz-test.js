// Görünür iz ile BreadcrumbList aynı yolu söylesin.
//
// NEDEN
// -----
// 22 sayfada görünür iz vardı, BreadcrumbList yoktu: arama sonucunda yol
// yerine çıplak URL görünüyordu. Veri elle yazılmadı -- ölçüm, iz taşıyan
// 117 sayfanın hepsinde görünür bağlantıların LD ara öğeleriyle birebir
// aynı olduğunu gösterdi; eksikler bu kuralla görünür izden türetildi.
// Bu kapı kuralın bozulmasını engelliyor.
//
// Ayrıca decorpalette'in son öğesi sayfa içi #generator çapasına
// gidiyordu. Çapa kaldırılınca 2. ve 3. öğe AYNI URL'yi gösterdi: "Palet
// üreteci" bir sayfa değil, sayfanın bir bölümüydü. İz iki seviyeye indi;
// yinelenen URL kontrolü bu yüzden var.
//
// İz etiketi: 108 sayfada aria-label="Site haritası" yazıyordu. Ekran
// okuyucu izi site haritası diye duyuruyordu; hepsi "Konum" oldu.
// doviz-kurlari her gece tools/update_data.py şablonundan yazılır --
// etiket orada da değişti.

// MUTASYON
// --------
// 8/8 yakalandı: eklenen LD'yi silmek, izdeki adı değiştirmek, son öğeye
// çapa koymak, yinelenen URL, eski etiket, iki kalıbın bozulması, izsiz
// listesinden sayfa çıkarmak. (İzdeki ad mutantı ilk kurulumda üst
// menüdeki "Ana Sayfa"ya düşmüştü; ize çapalanınca yakalandı.)

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var ATLA = ["node_modules", ".git", "_cekirdek", "dist"];

// Görünür izi olmayan ama BreadcrumbList taşıyan sayfalar. Kendi
// tasarımları olan alt projeler ve profil sayfası; yol yine de doğru
// olmalı (son öğe canonical, yineleme yok).
var IZSIZ = {
  "decorpalette/index.html": "alt proje, kendi başlığı ve gezintisi var",
  "dither-studio/index.html": "alt proje, kendi başlığı ve gezintisi var",
  "hakkimda/index.html": "profil sayfası; tek seviyeli yol, görünür iz gürültü olurdu"
};

function dosyalar(dizin, toplam) {
  toplam = toplam || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (g) {
    if (ATLA.indexOf(g.name) >= 0) return;
    var tam = path.join(dizin, g.name);
    if (g.isDirectory()) dosyalar(tam, toplam);
    else if (g.name === "index.html") toplam.push(tam);
  });
  return toplam;
}

function coz(s) {
  return s.replace(/&#8250;/g, "›").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function metin(h) { return coz(h.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); }

function izListeleri(s) {
  var out = [];
  var re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(s))) {
    var d;
    try { d = JSON.parse(m[1]); } catch (e) { continue; } // geçersiz JSON başka kapının işi
    var dugumler = Array.isArray(d) ? d : (d["@graph"] || [d]);
    dugumler.forEach(function (x) {
      if (x && x["@type"] === "BreadcrumbList") out.push(x);
    });
  }
  return out;
}

var hata = [];
var gorunurSayisi = 0, ldSayisi = 0, ucSeviye = 0, izsizGoruldu = {};

dosyalar(KOK).forEach(function (p) {
  var goreli = path.relative(KOK, p).replace(/\\/g, "/");
  var s = fs.readFileSync(p, "utf8");
  if (/http-equiv="refresh"/i.test(s)) return;
  var can = (s.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  var listeler = izListeleri(s);
  var gorunur = s.match(/<nav class="breadcrumb[^"]*"([^>]*)>([\s\S]*?)<\/nav>/);

  function hataEkle(m) { hata.push(goreli + ": " + m); }

  if (listeler.length > 1) hataEkle(listeler.length + " BreadcrumbList var (1 olmalı)");
  var liste = listeler[0];

  if (liste) {
    ldSayisi++;
    var o = liste.itemListElement || [];
    if (o.length === 3) ucSeviye++;
    o.forEach(function (x, i) {
      if (x.position !== i + 1) hataEkle("sıra numarası " + x.position + " (beklenen " + (i + 1) + ")");
    });
    var urller = o.map(function (x) { return x.item; });
    urller.forEach(function (u, i) {
      if (urller.indexOf(u) !== i) hataEkle("aynı URL iki kez: " + u);
    });
    var son = o[o.length - 1];
    if (!son) hataEkle("boş BreadcrumbList");
    else {
      if (String(son.item).indexOf("#") >= 0) hataEkle("son öğe sayfa içi çapa: " + son.item);
      if (can && son.item !== can) hataEkle("son öğe canonical değil: " + son.item + " ≠ " + can);
    }
  }

  if (gorunur) {
    gorunurSayisi++;
    if (!/aria-label="Konum"/.test(gorunur[1])) hataEkle("iz etiketi 'Konum' değil: " + gorunur[1].trim());
    if (!liste) { hataEkle("görünür iz var, BreadcrumbList yok"); return; }
    var bag = [], m, re = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = re.exec(gorunur[2]))) bag.push({ ad: metin(m[2]), url: new URL(m[1], can).href });
    var ara = liste.itemListElement.slice(0, -1);
    if (ara.length !== bag.length) {
      hataEkle("görünür izde " + bag.length + " bağlantı, LD'de " + ara.length + " ara öğe");
    } else {
      bag.forEach(function (b, i) {
        if (b.ad !== ara[i].name) hataEkle("ad farklı: görünür '" + b.ad + "' / LD '" + ara[i].name + "'");
        if (b.url !== ara[i].item) hataEkle("URL farklı: görünür " + b.url + " / LD " + ara[i].item);
      });
    }
  } else if (liste) {
    if (!IZSIZ[goreli]) hataEkle("BreadcrumbList var, görünür iz yok (IZSIZ listesinde değil)");
    else izsizGoruldu[goreli] = 1;
  }
});

function dogru(iddia, kosul, aciklama) {
  if (!kosul) {
    console.error("BASARISIZ: " + iddia + (aciklama ? "\n  " + aciklama : ""));
    process.exitCode = 1;
  }
}

// --- KONTROL ---------------------------------------------------------
dogru("görünür izler bulundu", gorunurSayisi >= 100, "bulunan: " + gorunurSayisi);
dogru("BreadcrumbList'ler okundu", ldSayisi >= 100, "okunan: " + ldSayisi);
dogru("üç seviyeli yollar var (makaleler)", ucSeviye >= 20, "üç seviyeli: " + ucSeviye);
Object.keys(IZSIZ).forEach(function (k) {
  dogru("IZSIZ listesindeki sayfa hâlâ izsiz LD taşıyor: " + k, !!izsizGoruldu[k],
    "listeden çıkarın");
});

dogru("iz ile BreadcrumbList tutarlı", hata.length === 0, hata.join("\n  "));

if (!process.exitCode) {
  console.log("İz: " + gorunurSayisi + " görünür iz, " + ldSayisi +
    " BreadcrumbList (" + ucSeviye + " üç seviyeli); hepsi tutarlı.");
}
