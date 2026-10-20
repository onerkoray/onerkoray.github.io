#!/usr/bin/env node
/*
 * İz kapısı: site ziyaretçide ve içerikte iz bırakmıyor mu?
 *
 * Site sahibinin kuralı (20 Ekim 2026): "ayak izlerimiz neredeyse hiç
 * olmayacak." Üç katmandan ikisi kodla denetlenebiliyor:
 *
 *   1. DURUM: araç girdisi adreste yalnız # sonrasında durur (durum.js).
 *      Sorgu dizesi sayfa isteğiyle sunucuya ve analitiğe gider; # gitmez.
 *      Kural: location.search'ü durum.js dışında hiçbir site betiği okumaz,
 *      adres yazan hiçbir çağrı "?" kurmaz.
 *   2. ÜÇÜNCÜ TARAF: sayfalar ve betikler yalnız izin listesindeki dış
 *      adreslerden kaynak yükler. Bugün liste tek kalem: ölçüm (onay.js).
 *      Yeni bir dış betik, gömme, yazı tipi ya da görsel bu kapıdan geçmez;
 *      eklemek site sahibinin kararıdır, listeye bilinçli yazılır.
 *   3. ŞABLON İZİ: yazılar birbirinin cümlelerini taşımaz. Sekiz kelimelik
 *      dizilerin her yazıda başka yazılarla paylaşılan payı ölçülür; eşik
 *      bugünkü ölçümün biraz üstünde. Kabuk blokları (ilgili yazılar,
 *      akış, arama) tasarım gereği ortaktır ve ölçüme girmez.
 *
 * Kimlik katmanı (kişisel e-posta, konum) gizlilik taramasında.
 *
 * Kullanım: node tools/ayak-izi-test.js [--olc]   (--olc: benzerlik dökümünü yazar)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var OLC = process.argv.indexOf("--olc") > -1;

var gecen = 0, hata = 0;
function dogru(ad, kosul, ayrinti) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.log("  BASARISIZ  " + ad + (ayrinti ? "\n      " + ayrinti : "")); }
}

/* Sitede yayımlanan dosyalar. Araç dizinleri, üreteçler ve paket aynası
   yayımlanmıyor ya da site betiği değil. */
var ATLA = { ".git": 1, node_modules: 1, _cekirdek: 1, tools: 1, scripts: 1, pagefind: 1, ".github": 1 };
function dosyalar(uzanti) {
  var sonuc = [];
  (function gez(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      if (e.isDirectory()) { if (!ATLA[e.name] && e.name[0] !== ".") gez(path.join(d, e.name)); }
      else if (uzanti.some(function (u) { return e.name.endsWith(u); })) sonuc.push(path.join(d, e.name));
    });
  })(KOK);
  return sonuc;
}
function goreli(p) { return path.relative(KOK, p).split(path.sep).join("/"); }
function oku(p) { return fs.readFileSync(p, "utf8"); }

/* ---------------------------------------------------------------- *
 * 1. Durum modülü ve sorgu dizesi
 * ---------------------------------------------------------------- */
console.log("Durum yalnız # sonrasında");
var Durum = require(path.join(KOK, "durum.js"));
var r = Durum.ayristir("", "#kira=15000&tarih=2026-10");
dogru("# durumu okunuyor", !r.eski && r.durum.get("kira") === "15000" && r.durum.get("tarih") === "2026-10");
r = Durum.ayristir("?kira=15000", "");
dogru("eski ?... bağlantısı okunuyor ve taşınacak diye işaretleniyor", r.eski && r.durum.get("kira") === "15000");
r = Durum.ayristir("?kira=1", "#kira=2");
dogru("ikisi birden varsa # kazanıyor", !r.eski && r.durum.get("kira") === "2");
r = Durum.ayristir("", "#hesapla");
dogru("sayfa içi çapa durum sayılmıyor", !r.eski && r.durum.toString() === "");
var bos = new URLSearchParams(), dolu = new URLSearchParams("kira=15000");
dogru("durum yazılınca adres # ile", Durum.adres("/kira/", dolu, "") === "/kira/#kira=15000");
dogru("durum boşken çapa korunuyor", Durum.adres("/kira/", bos, "#hesapla") === "/kira/#hesapla");
dogru("durum boşken eski durum siliniyor", Durum.adres("/kira/", bos, "#kira=1") === "/kira/");
dogru("yazılan adreste ? yok", Durum.adres("/kira/", dolu, "#x").indexOf("?") < 0);

var betikler = dosyalar([".js", ".mjs"]).filter(function (p) { return goreli(p) !== "durum.js"; });
var okuyan = [], soruKuran = [];
betikler.forEach(function (p) {
  var s = oku(p);
  if (/location\.search/.test(s)) okuyan.push(goreli(p));
  /* history.replaceState / pushState çağrısının bulunduğu satırda "?" kuran bir dizgi. */
  s.split("\n").forEach(function (satir, i) {
    if (/(replaceState|pushState)\s*\(/.test(satir) && /["']\?/.test(satir)) soruKuran.push(goreli(p) + ":" + (i + 1));
    if (/location\.search\s*=[^=]/.test(satir)) soruKuran.push(goreli(p) + ":" + (i + 1));
  });
});
dogru("location.search'ü yalnız durum.js okuyor", okuyan.length === 0, okuyan.join(", "));
dogru("adres yazan hiçbir çağrı ? kurmuyor", soruKuran.length === 0, soruKuran.join(", "));

/* Sitenin kendi sayfalarına ?anahtar=değer taşıyan bağlantı: araç girdisi
   gibi görünen her şey # ile verilmeli. */
var soruluBag = [];
dosyalar([".html", ".js"]).forEach(function (p) {
  var s = oku(p);
  var re = /(?:href="|["'])(?:https:\/\/korayoner\.dev)?(?:\.\.\/|\/)?[a-z0-9-]+\/\?[a-z]+=[^"'\s]*/g, m;
  while ((m = re.exec(s))) soruluBag.push(goreli(p) + ": " + m[0].slice(0, 70));
});
dogru("site içi bağlantılar araç girdisini ? ile taşımıyor", soruluBag.length === 0, soruluBag.slice(0, 5).join("\n      "));

var onay = oku(path.join(KOK, "onay.js"));
dogru("ölçüm yalnız sayfa yolunu görüyor (onay.js page_location)",
  /gtag\("set",\s*temiz\)/.test(onay) && /origin\s*\+\s*root\.location\.pathname/.test(onay));

/* ---------------------------------------------------------------- *
 * 2. Üçüncü taraf izin listesi
 * ---------------------------------------------------------------- */
console.log("\nDış kaynak yalnız izin listesinden");
/* Her kalem neden izinli olduğunu söyler. Eklemek site sahibinin kararı. */
var IZINLI = {
  "www.googletagmanager.com": "ölçüm betiği; onay.js yükler, ölçüm tercihi kapalıysa yüklenmez"
};
var disKaynak = [];
function disEkle(p, ne, url) {
  var host = url.replace(/^https?:\/\//, "").split(/[\/?#]/)[0];
  if (host !== "korayoner.dev" && !IZINLI[host]) disKaynak.push(goreli(p) + " → " + ne + " " + host);
}
dosyalar([".html"]).forEach(function (p) {
  var s = oku(p), m;
  var re = /<(script|iframe|img|source|video|audio|embed|object|track)\b[^>]*?\s(?:src|data)="(https?:\/\/[^"]+)"/g;
  while ((m = re.exec(s))) disEkle(p, m[1], m[2]);
  var rl = /<link\b([^>]*)>/g;
  while ((m = rl.exec(s))) {
    var rel = (m[1].match(/rel="([^"]*)"/) || [])[1] || "";
    var href = (m[1].match(/href="(https?:\/\/[^"]+)"/) || [])[1];
    if (href && /stylesheet|preload|modulepreload|preconnect|dns-prefetch|prefetch|icon/.test(rel)) disEkle(p, "link " + rel, href);
  }
  var rc = /url\(\s*["']?(https?:\/\/[^"')]+)/g;
  while ((m = rc.exec(s))) disEkle(p, "css url", m[1]);
});
dosyalar([".js", ".mjs"]).forEach(function (p) {
  var s = oku(p), m;
  var re = /(?:fetch\(|\.src\s*=|importScripts\(|import\(|new\s+(?:WebSocket|EventSource|Worker)\(|\.open\(\s*["'][A-Z]+["']\s*,)\s*["'`](https?:\/\/[^"'`\s]+)/g;
  while ((m = re.exec(s))) disEkle(p, "betik", m[1]);
  /* Betiğin src'yi bir sabitten birleştirdiği hâl (onay.js gibi). */
  var rs = /\.src\s*=\s*["'`](https?:\/\/[^"'`]+)["'`]\s*\+/g;
  while ((m = rs.exec(s))) disEkle(p, "betik", m[1]);
});
dosyalar([".css"]).forEach(function (p) {
  var s = oku(p), m, re = /(?:url\(\s*["']?|@import\s+["'])(https?:\/\/[^"')]+)/g;
  while ((m = re.exec(s))) disEkle(p, "css", m[1]);
});
dogru("izin listesi dışında dış kaynak yok", disKaynak.length === 0, disKaynak.slice(0, 8).join("\n      "));
dogru("izin listesindeki ölçüm betiği gerçekten onay.js'ten yükleniyor (liste bayatlamadı)",
  /googletagmanager\.com\/gtag\/js/.test(onay));

/* ---------------------------------------------------------------- *
 * 3. Yazılar arası şablon izi
 * ---------------------------------------------------------------- */
console.log("\nYazılar birbirinin cümlesini taşımıyor");
var N = 8;
/* Yazı kabuğunun yapısal parçaları: tarih ve yazar satırı, kaynaklar ve
   "gözden geçirildi" kapanışı, ilgili bağlantılar, konum izi. Bunlar her
   yazıda bilerek aynı; ölçülen şey yazının kendi cümleleri. */
var YAPISAL = ["ed-meta", "ed-kicker", "ed-author", "sources", "related", "breadcrumb", "yerel-menu"];
function elemanSil(html, sinif) {
  var re = new RegExp("<([a-z0-9]+)\\b[^>]*\\bclass=\"(?:[^\"]*\\s)?" + sinif + "(?:\\s[^\"]*)?\"[^>]*>", "i"), m;
  while ((m = re.exec(html))) {
    var ad = m[1].toLowerCase(), i = m.index + m[0].length, derinlik = 1;
    var acik = new RegExp("<" + ad + "\\b|</" + ad + "\\s*>", "gi");
    acik.lastIndex = i;
    var t;
    while (derinlik && (t = acik.exec(html))) derinlik += t[0][1] === "/" ? -1 : 1;
    var son = t ? acik.lastIndex : html.length;
    html = html.slice(0, m.index) + " " + html.slice(son);
  }
  return html;
}
function govde(p) {
  var s = oku(p);
  var m = s.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  var h = m ? m[1] : s;
  YAPISAL.forEach(function (c) { h = elemanSil(h, c); });
  return h
    .replace(/<!-- ([A-Z0-9-]+):BASLANGIC -->[\s\S]*?<!-- \1:BITIS -->/g, " ")
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .toLocaleLowerCase("tr").replace(/[^0-9a-zçğıöşüâîû%]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
function diziler(metin) {
  var k = metin.split(" "), s = new Set(), sira = [];
  for (var i = 0; i + N <= k.length; i++) { var g = k.slice(i, i + N).join(" "); s.add(g); sira.push(g); }
  return { kume: s, sira: sira, kelime: k };
}
var yazilar = fs.readdirSync(path.join(KOK, "makaleler"), { withFileTypes: true })
  .filter(function (e) { return e.isDirectory() && fs.existsSync(path.join(KOK, "makaleler", e.name, "index.html")); })
  .map(function (e) {
    var r = diziler(govde(path.join(KOK, "makaleler", e.name, "index.html")));
    return { ad: e.name, d: r.kume, sira: r.sira, kelime: r.kelime };
  });
var sayac = new Map();
yazilar.forEach(function (y) { y.d.forEach(function (g) { sayac.set(g, (sayac.get(g) || 0) + 1); }); });
var paylar = yazilar.map(function (y) {
  var ortak = 0; y.d.forEach(function (g) { if (sayac.get(g) > 1) ortak++; });
  return { ad: y.ad, pay: y.d.size ? ortak / y.d.size : 0, adet: y.d.size };
}).sort(function (a, b) { return b.pay - a.pay; });
var toplamOrtak = 0, toplam = 0;
paylar.forEach(function (p) { toplamOrtak += p.pay * p.adet; toplam += p.adet; });
var genel = toplamOrtak / toplam;
if (OLC) paylar.slice(0, 12).forEach(function (p) { console.log("      %" + (p.pay * 100).toFixed(2) + "  " + p.ad); });
console.log("      " + yazilar.length + " yazı; en yüksek pay %" + (paylar[0].pay * 100).toFixed(2) +
  " (" + paylar[0].ad + "), site geneli %" + (genel * 100).toFixed(2));
/* Eşikler 20 Ekim 2026 ölçümünün biraz üstünde: en yüksek %5,4 (aynı stopaj
   oranları ve kanun maddeleri iki yazıda), site geneli %0,68. (AGENTS.md bölüm 1:
   maaş sayfalarında aynı ölçü %23-25 idi, makalelerde binde birler). */
var ESIK_YAZI = 0.08, ESIK_GENEL = 0.01;
dogru("hiçbir yazıda başka yazılarla ortak cümle payı eşiği (%" + ESIK_YAZI * 100 + ") aşmıyor",
  paylar[0].pay <= ESIK_YAZI, paylar.filter(function (p) { return p.pay > ESIK_YAZI; }).map(function (p) { return p.ad + " %" + (p.pay * 100).toFixed(1); }).join(", "));
dogru("site genelinde ortak pay %" + (ESIK_GENEL * 100).toFixed(1) + " altında", genel <= ESIK_GENEL, "%" + (genel * 100).toFixed(2));

/* Oran, bir yazıya kopyalanmış TEK paragrafı yakalamaz (uzun yazıda pay
   küçük kalır). Bu yüzden ikinci ölçü: başka bir yazıyla art arda paylaşılan
   en uzun kelime dizisi. Paylaşılan 8'lilerin kesintisiz zinciri r uzunsa
   ortak metin r + N - 1 kelimedir. */
var enUzun = { kelime: 0, ad: "", metin: "" };
yazilar.forEach(function (y) {
  var r = 0;
  for (var i = 0; i <= y.sira.length; i++) {
    if (i < y.sira.length && sayac.get(y.sira[i]) > 1) { r++; continue; }
    if (r && r + N - 1 > enUzun.kelime) {
      enUzun = { kelime: r + N - 1, ad: y.ad, metin: y.kelime.slice(i - r, i - r + Math.min(r + N - 1, 18)).join(" ") };
    }
    r = 0;
  }
});
console.log("      en uzun ortak dizi " + enUzun.kelime + " kelime (" + enUzun.ad + "): \"" + enUzun.metin + "…\"");
var ESIK_DIZI = 40;
dogru("hiçbir yazı başka bir yazıyla " + ESIK_DIZI + " kelimeden uzun aynı metni paylaşmıyor", enUzun.kelime <= ESIK_DIZI,
  enUzun.kelime + " kelime: " + enUzun.ad);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (ayak izi kapısı)");
