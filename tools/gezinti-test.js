// Gezinti tutarliligi: ayni ad iki farkli yere goturmesin.
//
// NEDEN
// -----
// KeyMint alt sayfalarinda birincil gezinti iki kez "Tum araclar" diyordu:
// biri https://korayoner.dev/#projects (site geneli), digeri ../#araclar
// (KeyMint'in kendi listesi). Ekran okuyucunun baglanti listesi iki ayni
// girdi okuyor, gorenler icinse hangisinin nereye gittigi belirsiz.
// erisilebilirlik-test.js bos baglantiyi ve erisilebilir adi denetliyor
// ama ayni adin farkli hedefe gitmesini gormuyor.
//
// MUTASYON
// --------
// 5 mutant kuruldu, 4'u yakalandi: ihlal ekme, nav kalibini bozma,
// baglanti kalibini bozma, dosya taramasini bozma. Kacan tek mutant
// "hata.length === 0" iddiasini "true" yapmak -- temiz agacta ihlal
// yokken bu iddia zaten kirmizi veremez, yani DENK mutant. Iddianin
// calistigini birinci mutant kanitliyor.
//
// KAPSAM
// ------
// Sadece <nav> icindeki baglantilar. Govde metninde ayni sozcugun iki
// farkli yere baglanmasi normaldir ("burada", "detaylar"); gezintide degil.

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var ATLA = ["node_modules", ".git", "_cekirdek", "dist"];

function dosyalar(dizin, toplam) {
  toplam = toplam || [];
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (g) {
    if (ATLA.indexOf(g.name) >= 0) return;
    var tam = path.join(dizin, g.name);
    if (g.isDirectory()) dosyalar(tam, toplam);
    else if (/\.html$/.test(g.name)) toplam.push(tam);
  });
  return toplam;
}

function metin(h) {
  return h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Bir sayfanin her <nav>'i icin: ad -> hedef kumesi
function gezintiler(govde) {
  var sonuc = [];
  var kalip = /<nav\b[^>]*>([\s\S]*?)<\/nav>/gi;
  var m;
  while ((m = kalip.exec(govde))) {
    var harita = {};
    var bag = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    var b;
    while ((b = bag.exec(m[1]))) {
      var ad = metin(b[2]);
      if (!ad) continue;
      if (!harita[ad]) harita[ad] = [];
      if (harita[ad].indexOf(b[1]) < 0) harita[ad].push(b[1]);
    }
    sonuc.push(harita);
  }
  return sonuc;
}

var hata = [];
var sayfa = 0;
var navSayisi = 0;
var baglantiSayisi = 0;

dosyalar(KOK).forEach(function (p) {
  sayfa++;
  var s = fs.readFileSync(p, "utf8");
  var goreli = path.relative(KOK, p).replace(/\\/g, "/");
  gezintiler(s).forEach(function (harita) {
    navSayisi++;
    Object.keys(harita).forEach(function (ad) {
      baglantiSayisi++;
      if (harita[ad].length > 1) {
        hata.push(goreli + ": '" + ad + "' -> " + harita[ad].join(" , "));
      }
    });
  });
});

function dogru(iddia, kosul, aciklama) {
  if (!kosul) {
    console.error("BASARISIZ: " + iddia + (aciklama ? "\n  " + aciklama : ""));
    process.exitCode = 1;
  }
}

// --- KONTROL ---------------------------------------------------------
// Olcum bozulursa (nav bulunamaz, baglanti cikarilamaz) test sessizce
// yesil vermesin. Site su an 148 sayfa, ~299 nav tasiyor.
dogru("gezinti taramasi calisti", sayfa >= 100,
  "taranan sayfa: " + sayfa + " (>=100 beklenir)");
dogru("nav bloklari bulundu", navSayisi >= 200,
  "bulunan nav: " + navSayisi + " (>=200 beklenir)");
dogru("nav baglantilari cikarildi", baglantiSayisi >= 800,
  "cikarilan ad: " + baglantiSayisi + " (>=800 beklenir)");

dogru("hicbir gezintide ayni ad iki farkli hedefe gitmiyor",
  hata.length === 0, hata.join("\n  "));

if (!process.exitCode) {
  console.log("Gezinti: " + sayfa + " sayfa, " + navSayisi + " nav, " +
    baglantiSayisi + " ad -- cift hedefli ad yok.");
}
