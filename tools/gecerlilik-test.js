#!/usr/bin/env node
/*
 * tools/gecerlilik.js gerçekten patlıyor mu?
 *
 * Bir muhafızın en tehlikeli hâli, kurulmuş görünüp hiçbir şeyi tutmamasıdır:
 * CI yeşil kalır, herkes korunduğunu sanır. Bu yüzden kapı burada BİLEREK
 * bozuluyor ve her bozmada kırmızıya döndüğü ölçülüyor.
 *
 * Kullanım: node tools/gecerlilik-test.js
 */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var KOK = path.dirname(__dirname);
var ARAC = path.join(KOK, "tools", "gecerlilik.js");
var gecen = 0, kalan = 0;

function gecer(ad, kosul) {
  if (kosul) { gecen++; }
  else { kalan++; console.log("  BAŞARISIZ: " + ad); }
}

/* Kontrolü İZOLE bir ağaçta koşuyoruz. Gerçek depoda tarih oynatmak,
   testin sonucunu deponun o anki içeriğine bağlardı — yarın başka bir
   yazıya gecerlilik eklenince test sebepsiz kırılırdı. */
function kos(icerik) {
  var d = fs.mkdtempSync(path.join(os.tmpdir(), "gecerlilik-"));
  var alt = path.join(d, "yazi");
  fs.mkdirSync(alt);
  fs.writeFileSync(path.join(alt, "index.html"), icerik, "utf8");
  var r = cp.spawnSync(process.execPath, [ARAC, "--check"], {
    cwd: d, encoding: "utf8", env: Object.assign({}, process.env, { GECERLILIK_KOK: d })
  });
  fs.rmSync(d, { recursive: true, force: true });
  return { kod: r.status, cikti: (r.stdout || "") + (r.stderr || "") };
}

function gunSonra(n) {
  var t = new Date(Date.now() + n * 86400000);
  return t.toISOString().slice(0, 10);
}

function sayfa(tarih, not) {
  return '<!doctype html>\n<html lang="tr">\n<head>\n' +
    '  <meta name="gecerlilik" content="' + tarih + ' | ' + (not || "kontrol et") + '">\n' +
    '  <title>Deneme</title>\n</head>\n<body></body>\n</html>\n';
}

console.log("tools/gecerlilik.js — mutasyon testleri\n");

/* 1. Süresi dolmuş iddia CI'ı kırmızıya çevirmeli. */
var r = kos(sayfa(gunSonra(-1)));
gecer("dün dolan iddia hata veriyor", r.kod === 1);
gecer("hata mesajı dosyayı gösteriyor", /yazi\/index\.html/.test(r.cikti));

/* 2. BUGÜN dolan iddia da kırmızı olmalı. Sınır günü "daha var" saymak,
      yazının en yanlış olduğu günü tam olarak ıskalamak demekti. */
r = kos(sayfa(gunSonra(0)));
gecer("bugün dolan iddia hata veriyor", r.kod === 1);

/* 3. Çok gerilerde kalmış bir tarih de tutulmalı (tek gün değil, her geçmiş). */
r = kos(sayfa(gunSonra(-400)));
gecer("400 gün önce dolan iddia hata veriyor", r.kod === 1);

/* 4. Uyarı penceresi: kırmızıya ÇEVİRMEDEN haber vermeli. */
r = kos(sayfa(gunSonra(5)));
gecer("5 gün kalan iddia CI'ı kırmadı", r.kod === 0);
gecer("5 gün kalan iddia uyarı yazdı", /Yakla[sş][iı]yor/.test(r.cikti));

/* 5. Pencere dışında gürültü yapmamalı — her koşuda uyarı veren bir
      kontrol kısa sürede okunmaz hâle gelir. */
r = kos(sayfa(gunSonra(60)));
gecer("60 gün kalan iddia sessiz", r.kod === 0 && !/Yakla[sş][iı]yor/.test(r.cikti));

/* 6. Notu taşımalı: "bir şey eskidi" demek elle bakmaktan kurtarmıyor. */
r = kos(sayfa(gunSonra(-1), "esas numarasi yaziya girsin"));
gecer("hata mesajı notu taşıyor", /esas numarasi yaziya girsin/.test(r.cikti));

/* 7. EN SESSİZ HATA: meta'nın biçimi bozulursa kontrol onu hiç görmez ve
      sayfa korumasız kalır — CI yine yeşil. Bozuk bildirim hata olmalı. */
var bozuk = '<!doctype html>\n<html><head>\n' +
  '  <meta name="gecerlilik" content="1 Ekim 2026 | kontrol et">\n' +
  '</head><body></body></html>\n';
r = kos(bozuk);
gecer("biçimi bozuk bildirim hata veriyor", r.kod === 1);
gecer("bozuk bildirim mesajı açıklayıcı", /bi[cç]im/i.test(r.cikti));

/* 8. Hiç bildirim yoksa temiz geçmeli. */
r = kos('<!doctype html>\n<html><head><title>x</title></head><body></body></html>\n');
gecer("bildirimsiz sayfa sorun çıkarmıyor", r.kod === 0);

console.log("\n" + (gecen + kalan) + " kontrol, " + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
