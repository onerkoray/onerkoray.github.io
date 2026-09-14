#!/usr/bin/env node
/*
 * Tarihi gelince eskiyecek iddiaları CI'da patlatır.
 *
 * Neden: bu sitenin en çok tıklanan sayfası (makaleler/torba-yasa-ne-var-ne-yok,
 * 8 günde 176 gösterim ve tıklamaların %55'i) bir TARİHE dayanıyor: "5 Eylül 2026
 * itibarıyla sunulmuş teklif yok; TBMM 1 Ekim'de açılıyor". 1 Ekim geldiğinde bu
 * cümle sessizce yanlış olacak — sayfa açılmaya devam eder, tablo hizalı durur,
 * hiçbir test patlamaz. Üstelik tam o gün sorgu hacmi zirveye çıkıyor, yani
 * yazının en yanlış olduğu an en çok okunduğu an.
 *
 * Yazı bunu zaten YAZILI OLARAK taahhüt ediyordu ("Meclis 1 Ekim'de açıldığında
 * yazı güncellenecek"). Taahhüdün arkasında mekanizma yoksa taahhüt değil,
 * niyettir; unutulur. Bu kontrol onu takvime bağlar.
 *
 * Bir sayfa şöyle bildirir:
 *   <meta name="gecerlilik" content="2026-10-01 | TBMM açıldı: teklif sunuldu mu,
 *                                     'henüz yok' cevabı hâlâ doğru mu?">
 *
 * Tarih geldiğinde CI kırmızıya döner ve notu yazar. Notun İŞE YARAMASI için
 * "güncelle" demesi yetmez; NEYİ kontrol edeceğini söylemeli — aylar sonra o
 * satırı okuyan kişi yazıyı yazan kişi olmayabilir.
 *
 * Kullanım:
 *   node tools/gecerlilik.js          # durumu listele
 *   node tools/gecerlilik.js --check  # süresi dolmuşsa hata ver (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

/* Kök normalde deponun kendisi. GECERLILIK_KOK yalnızca testin izole bir
   ağaçta koşabilmesi için var: testi gerçek depoda koşturmak, sonucunu
   deponun o anki içeriğine bağlardı — yarın başka bir yazıya bildirim
   eklenince test sebepsiz kırılırdı. */
var KOK = process.env.GECERLILIK_KOK || path.dirname(__dirname);
var ATLA = ["node_modules", ".git", "_cekirdek", "images"];

/* Süre dolmadan kaç gün önce uyarmaya başlasın. Uyarı CI'ı kırmızıya
   ÇEVİRMEZ; amacı hazırlık payı bırakmak. Sıfır gün kala patlayan bir
   kontrol haklıdır ama iş yükünü hiç haber vermeden kapıya bırakır. */
var UYARI_GUN = 14;

function htmlDosyalari(dizin, out) {
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (d) {
    if (ATLA.indexOf(d.name) !== -1) return;
    var p = path.join(dizin, d.name);
    if (d.isDirectory()) htmlDosyalari(p, out);
    else if (d.name === "index.html") out.push(p);
  });
  return out;
}

/* Bugünü UTC gün başına sabitliyoruz. Yerel saat kullanılsaydı kontrol,
   koşan makinenin saat dilimine göre bir gün önce ya da sonra patlardı;
   CI ile geliştiricinin makinesi farklı sonuç verirdi. */
function bugun() {
  var n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

function oku(dosya) {
  var s = fs.readFileSync(dosya, "utf8");
  var yol = path.relative(KOK, dosya).split(path.sep).join("/");
  var m = s.match(
    /<meta\s+name="gecerlilik"\s+content="(\d{4})-(\d{2})-(\d{2})\s*\|\s*([^"]*)"/
  );
  if (!m) {
    /* EN SESSİZ HATA BURADA. Bildirimin biçimi bozulursa (tarih "1 Ekim 2026"
       yazılırsa, ayraç unutulursa) desen tutmaz, sayfa listeye hiç girmez ve
       korumasız kalır — CI ise yemyeşil. Kurulduğu sanılan ama hiçbir şeyi
       tutmayan bir muhafız, hiç olmamasından kötüdür: yanlış güven verir.
       O yüzden "gecerlilik" geçen ama çözülemeyen her bildirim hatadır. */
    if (/<meta\s+name="gecerlilik"/.test(s)) {
      return { yol: yol, bozuk: true };
    }
    return null;
  }
  return {
    yol: yol,
    zaman: Date.UTC(+m[1], +m[2] - 1, +m[3]),
    tarih: m[1] + "-" + m[2] + "-" + m[3],
    not: m[4].replace(/\s+/g, " ").trim()
  };
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var b = bugun();
  var hepsi = htmlDosyalari(KOK, []).map(oku).filter(Boolean);
  var bozuklar = hepsi.filter(function (k) { return k.bozuk; });
  var kayitlar = hepsi.filter(function (k) { return !k.bozuk; });
  kayitlar.sort(function (a, c) { return a.zaman - c.zaman; });

  var dolmus = [];
  var yaklasan = [];
  kayitlar.forEach(function (k) {
    var gun = Math.round((k.zaman - b) / 86400000);
    if (gun <= 0) dolmus.push(k);
    else if (gun <= UYARI_GUN) { k.kalan = gun; yaklasan.push(k); }
  });

  if (!kontrol) {
    bozuklar.forEach(function (k) {
      console.log("  BİÇİMİ BOZUK  " + k.yol);
    });
    if (!kayitlar.length) {
      console.log("Tarihe bağlı iddia bildiren sayfa yok.");
      return 0;
    }
    kayitlar.forEach(function (k) {
      var gun = Math.round((k.zaman - b) / 86400000);
      var durum = gun <= 0 ? "SÜRESİ DOLDU" : gun + " gün kaldı";
      console.log("  " + k.tarih + "  " + durum);
      console.log("      " + k.yol);
      console.log("      " + k.not);
    });
    return 0;
  }

  yaklasan.forEach(function (k) {
    console.log("Yaklaşıyor (" + k.kalan + " gün): " + k.yol);
    console.log("  " + k.tarih + " — " + k.not);
  });

  if (bozuklar.length) {
    bozuklar.forEach(function (k) {
      console.error("Geçerlilik bildiriminin biçimi bozuk: " + k.yol);
    });
    console.error(
      "\nBeklenen biçim:\n" +
      "  <meta name=\"gecerlilik\" content=\"YYYY-AA-GG | neyin kontrol edileceği\">\n" +
      "Tarih ISO olmalı ve nottan dik çizgiyle ayrılmalı; aksi hâlde sayfa\n" +
      "korumasız kalır ve bu sessizce olur."
    );
    return 1;
  }

  if (dolmus.length) {
    dolmus.forEach(function (k) {
      console.error("Süresi dolmuş iddia: " + k.yol);
      console.error("  " + k.tarih + " — " + k.not);
    });
    console.error(
      "\nYazıyı gözden geçirip <meta name=\"gecerlilik\"> tarihini ileri alın.\n" +
      "Tarihi ilerletmek tek başına yetmez: iddia hâlâ doğru mu, önce ona bakın."
    );
    return 1;
  }

  console.log(
    "Tarihe bağlı " + kayitlar.length + " iddia geçerli" +
    (yaklasan.length ? " (" + yaklasan.length + " tanesi yaklaşıyor)." : ".")
  );
  return 0;
}

process.exit(main());
