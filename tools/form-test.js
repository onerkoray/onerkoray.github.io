#!/usr/bin/env node
/*!
 * Yayınlanan formlar gerçek tarayıcıda doğru sonuca varıyor mu?
 *
 * Motor testleri hesabı sınar, formu sınamaz. Bir alan ID'si değişirse ya da
 * "1.234,56" yanlış okunursa araç hata vermez, makul görünen yanlış bir rakam
 * gösterir. Burada değer kutuya yazılır, ekrandaki sonuç okunur ve Node'daki
 * motorun ikinci yoldan verdiği rakamla karşılaştırılır.
 *
 * Kullanım: node tools/form-test.js   (CHROME ortam değişkeni yolu değiştirir)
 */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var http = require("http");
var cp = require("child_process");
var KOK = path.dirname(__dirname);

var B = require("../bordro/motor.js");
var KR = require("../kredi-hesaplama/hesap.js");
var EM = require("../ne-zaman-emekli-olurum/hesap.js");
var F = require("../fatura-olusturma/fatura.js");
var BY = require("../bordro/beyanname-motoru.js");
var C = require("../bordro/cikis.js");
var T = require("../finans/tufe-serisi.js");
var V = require("../finans/veri-durumu.js");

var CHROME = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"
].filter(function (p) { return fs.existsSync(p); })[0];

var TUR = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };
var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmt(n) { return nf.format(Math.round(n * 100) / 100); }
function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + String(ek).slice(0, 220) : "")); }
}

/* Sayfaya verilen yardımcılar: alanı yaz ve olayları tetikle, metin oku. */
var YARDIM = "window.__y=function(id,v){var e=document.getElementById(id);e.value=v;" +
  "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};" +
  "window.__m=function(id){var e=document.getElementById(id);return e?e.textContent.replace(/\\s+/g,' ').trim():null;};";

async function main() {
  if (!CHROME) { console.error("Chrome bulunamadı. CHROME ortam değişkenine yolunu yazın."); return 1; }
  var sunucu = http.createServer(function (q, s) {
    var yol = decodeURIComponent(q.url.split(/[?#]/)[0]);
    var p = path.join(KOK, yol);
    if (!p.startsWith(KOK)) { s.writeHead(403); return s.end(); }
    if (yol.endsWith("/")) p = path.join(p, "index.html");
    fs.readFile(p, function (h, d) {
      if (h) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "Content-Type": TUR[path.extname(p)] || "application/octet-stream" });
      s.end(d);
    });
  });
  await new Promise(function (r) { sunucu.listen(0, "127.0.0.1", r); });
  var kok = "http://127.0.0.1:" + sunucu.address().port;

  var port = 9800 + Math.floor(Math.random() * 150);
  var profil = fs.mkdtempSync(path.join(os.tmpdir(), "form-"));
  var ch = cp.spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=" + port,
    "--user-data-dir=" + profil, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  var hedef;
  for (var i = 0; i < 150 && !hedef; i++) {
    try { hedef = (await (await fetch("http://127.0.0.1:" + port + "/json")).json()).find(function (t) { return t.type === "page"; }); }
    catch (e) { await bekle(200); }
  }
  if (!hedef) { console.error("Chrome açılmadı."); ch.kill(); sunucu.close(); return 1; }
  var ws = new WebSocket(hedef.webSocketDebuggerUrl);
  await new Promise(function (r) { ws.addEventListener("open", r); });
  var no = 0, bekleyen = {}, yuklendi = null, hatalar = [];
  ws.addEventListener("message", function (m) {
    var x = JSON.parse(m.data);
    if (x.id && bekleyen[x.id]) { bekleyen[x.id](x.result); delete bekleyen[x.id]; }
    if (x.method === "Page.loadEventFired" && yuklendi) { yuklendi(); yuklendi = null; }
    if (x.method === "Runtime.exceptionThrown") hatalar.push(x.params.exceptionDetails.text + " " + ((x.params.exceptionDetails.exception || {}).description || ""));
  });
  function gonder(yontem, p) {
    return new Promise(function (r) { var k = ++no; bekleyen[k] = r; ws.send(JSON.stringify({ id: k, method: yontem, params: p || {} })); });
  }
  await gonder("Page.enable");
  await gonder("Runtime.enable");

  async function ac(yol) {
    var y = new Promise(function (r) { yuklendi = r; });
    await gonder("Page.navigate", { url: kok + "/" + yol });
    await Promise.race([y, bekle(20000).then(function () { throw new Error("Sayfa yüklenmedi: " + yol); })]);
    await bekle(250);
    await gonder("Runtime.evaluate", { expression: YARDIM });
  }
  async function js(ifade) {
    var r = await gonder("Runtime.evaluate", { expression: ifade, returnByValue: true });
    if (r.exceptionDetails) throw new Error(ifade.slice(0, 80) + " :: " + r.exceptionDetails.text);
    return r.result.value;
  }

  try {
    console.log("Brüt–Net Maaş");
    await ac("maas-hesaplama/");
    var yil = await js("+document.getElementById('in-year').value");
    var beklenen = B.hesaplaYil(100000, yil);
    var ozet = {};
    for (var yazim of ["100.000", "100000", "100.000,00", "100000,00"]) {
      await js("__y('in-gross'," + JSON.stringify(yazim) + ")");
      ozet[yazim] = await js("__m('summary')");
      ok(yazim + " yıllık neti verir", ozet[yazim].indexOf(fmt(beklenen.toplam.net)) >= 0, ozet[yazim]);
    }
    await js("__y('in-gross','')");
    ok("boş alanda sonuç gizlenir", await js("document.getElementById('results').hidden") === true);
    await js("__y('in-gross','0')");
    ok("sıfırda sonuç gizlenir", await js("document.getElementById('results').hidden") === true);
    await js("__y('in-gross','20.000')");
    ok("asgarinin altı bildirilir", /asgari/i.test(await js("__m('rs-status')")));
    await js("document.getElementById('tab-2').click();__y('in-net','50.000')");
    var brutMetin = await js("__m('net-out')");
    var brut = Number((/Gereken brüt maaş: ([\d.,]+)/.exec(brutMetin) || [])[1].replace(/\./g, "").replace(",", "."));
    ok("netten brüt ileri hesapla Ocak netini verir", Math.abs(B.hesaplaYil(brut, yil).aylar[0].net - 50000) < 0.02, brutMetin);

    console.log("Ne Zaman Emekli Olurum?");
    await ac("ne-zaman-emekli-olurum/");
    var bugun = new Date().toISOString().slice(0, 10);
    var eg = { bugun: bugun, dogum: "1985-03-10", cinsiyet: "erkek", statu: "4a", ilkGiris: "2005-06-01", primGun: 5000, yillikGun: 360,
      askerlikGun: 0, askerlikOnce: false, dogumGun: 0, dogumOnce: false };
    await js("__y('e-dogum','1985-03-10');__y('e-ilk','2005-06-01');__y('e-gun','5.000');__y('e-yillik','360');__y('e-asker','0');" +
      "document.getElementById('em-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))");
    var er = EM.hesapla(eg), p = er.tarih.split("-");
    var ekran = await js("__m('r-tarih')");
    ok("tarih motorla aynı", ekran.indexOf(p[0]) >= 0 && ekran.indexOf(String(+p[2])) >= 0, ekran + " / " + er.tarih);
    ok("grup 1999–2008", /1999–2008/.test(await js("__m('r-grup')")));
    await js("__y('e-dogum','2040-01-01');document.getElementById('em-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))");
    ok("gelecekteki doğum tarihi sessiz geçmez", (await js("__m('e-hata')")).length > 0 || await js("document.getElementById('em-sonuc').classList.contains('em-bayat')") === true);

    console.log("Beyanname");
    await ac("beyanname-hesaplama/");
    var by = await js("document.getElementById('results').textContent.length");
    await js("__y('in-konut','500.000,00');__y('in-ucret1','100.000')");
    var yilB = BY.hesapla({ ucretler: [{ aylikBrut: 100000 }], konutKira: 500000 });
    var ekranB = await js("__m('results')");
    ok("sonuç üretildi", ekranB.length > by, ekranB);
    ok("motor hata vermiyor", !yilB.hata, yilB.hata);
    ok("kira 500.000 olarak okundu", ekranB.indexOf("500.000") >= 0, ekranB);

    console.log("Kredi ve Gerçek Maliyet");
    await ac("kredi-hesaplama/");
    await js("__y('in-anapara','1.000.000');__y('in-faiz','3,5');__y('in-vade','24')");
    var g = await js("({k:document.getElementById('in-kkdf').value,b:document.getElementById('in-bsmv').value,t:document.getElementById('in-tahsis').value,sp:document.getElementById('in-sigorta-pesin').value,sa:document.getElementById('in-sigorta-aylik').value,d:document.getElementById('in-diger').value})");
    function n(s) { return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0; }
    var kp = KR.plan({ anapara: 1000000, aylikFaiz: 3.5, vade: 24, kkdf: n(g.k), bsmv: n(g.b), tahsisOran: n(g.t), sigortaPesin: n(g.sp), sigortaAylik: n(g.sa), digerMasraf: n(g.d) });
    var ekranK = await js("__m('sonuc')");
    ok("aylık taksit motorla aynı", ekranK.indexOf(fmt(kp.aylikOdeme)) >= 0, ekranK + " / " + fmt(kp.aylikOdeme));
    ok("toplam geri ödeme motorla aynı", ekranK.indexOf(fmt(kp.toplamGeriOdeme)) >= 0, ekranK);
    var plan = await js("document.querySelectorAll('#plan-tablo tbody tr').length");
    ok("plan 24 satırı içeriyor", plan >= 24, plan);
    await js("__y('in-anapara','')");
    ok("boş tutarda uyarı", /Kredi tutarı/.test(await js("__m('sonuc')")));

    console.log("Fatura");
    await ac("fatura-olusturma/");
    await js("(function(){var s=document.querySelector('#kalem-listesi .kalem-satir');" +
      "function y(c,v){var e=s.querySelector(c);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}" +
      "y('.k-aciklama','Danışmanlık');y('.k-miktar','3');y('.k-fiyat','1.234,56');y('.k-kdv','20');})()");
    var fh = F.hesapla({ kalemler: [{ aciklama: "Danışmanlık", miktar: "3", birimFiyat: "1234,56", iskonto: "", iskontoTur: "yuzde", kdvOran: "20" }] });
    var ekranF = await js("__m('bl-toplam')");
    ok("ödenecek tutar motorla aynı", ekranF.indexOf(F.para(fh.odenecek, "TRY")) >= 0, ekranF + " / " + F.para(fh.odenecek, "TRY"));
    ok("kuruş hatası yok: 3 × 1.234,56 + %20", Math.abs(fh.odenecek - 4444.42) < 0.005, fh.odenecek);

    console.log("Çıkış aktarımı");
    await ac("isten-ayrilma-hesaplama/");
    await js("__y('in-brut','70.000');__y('in-ekler','8.000');__y('in-izin','9');__y('in-prim','900')");
    var y = new Promise(function (r) { yuklendi = r; });
    await js("document.getElementById('btn-dayanma').click()");
    await y;
    await bekle(300);
    await gonder("Runtime.evaluate", { expression: YARDIM });
    ok("adrese veri yazılmıyor", (await js("location.pathname+location.search+location.hash")) === "/finansal-emniyet-testi/");
    ok("kayıt okununca silindi", await js("sessionStorage.getItem('cikis-aktarim')") === null);
    ok("şerit görünüyor", /aktarıldı/.test(await js("__m('ay-alan')")));
    ok("form doldu", (await js("document.getElementById('d-brut').value")) === "70.000,00" || (await js("document.getElementById('d-brut').value")) === "70.000");
    var cp2 = C.hesapla({ iseGiris: "2019-03-15", cikis: "2026-09-30", ciplakBrut: 70000, giydirmeEkleri: 8000, fesihTuru: "isveren", ihbarSuresiCalisildi: false,
      kullanilmayanIzinGunu: 9, son4AyBrutOrtalama: 65000, son3YilPrimGunu: 900, sigortaBaslangici: null });
    var kalemMetin = await js("__m('r-kalemler')");
    ok("kıdem aynı", kalemMetin.indexOf(new Intl.NumberFormat("tr-TR").format(Math.round(cp2.kidem.net))) >= 0, kalemMetin);

    console.log("Veri durumu");
    var dm = V.metin(V.durum(T.sonAy, bugun));
    for (var s of ["enflasyon-hesaplama/", "reel-maas-hesaplama/", "emekli-zammi-hesaplama/", "memur-zammi-hesaplama/"]) {
      await ac(s);
      ok(s + " son ayı gösteriyor", (await js("(document.querySelector('[data-veri-durumu]')||{}).textContent")) === dm, await js("(document.querySelector('[data-veri-durumu]')||{}).textContent"));
    }
    await ac("kira-artisi-hesaplama/");
    ok("kira sayfası son ayı gösteriyor", /Veri: TÜİK TÜFE/.test(await js("(document.querySelector('[data-veri-durumu]')||{}).textContent")));

    console.log("Senaryo ve takvim");
    await ac("asgari-ucret-zam-senaryosu/");
    ok("koruyan zam kartı görünüyor", /Alım gücünü koruyan/.test(await js("__m('as-sonuc')")));
    ok("enflasyon alanı TÜFE ile açılıyor", (await js("document.getElementById('as-enf').value")) === String(T.aylar[T.sonAy].yillik).replace(".", ","));
    await ac("mali-takvim/");
    ok("tam bir sıradaki satır var", await js("document.querySelectorAll('.mt-sirada').length") === 1);
    ok("geçmiş satır ekranda yok", await js("Array.prototype.filter.call(document.querySelectorAll('.mt-olay'),function(l){return l.offsetParent!==null&&l.getAttribute('data-tarih')<new Date().toISOString().slice(0,10)}).length") === 0);
    ok("sayaç doldu", /^(\d+|Bugün|Yarın)$/.test(await js("__m('mt-sayac')")), await js("__m('mt-sayac')"));
    ok("son veri kartı TÜFE'yle aynı", (await js("__m('mt-son-deger')")) === "%" + T.aylar[T.sonAy].yillik.toFixed(2).replace(".", ","));
    ok("14 aylık şerit", await js("document.querySelectorAll('.mt-serit-ay').length") === 14);
    var hepsi = await js("document.querySelectorAll('.mt-olay:not([hidden])').length");
    await js("document.querySelector('#mt-suzgec [data-kim=emekli]').click()");
    var emekli = await js("document.querySelectorAll('.mt-olay:not([hidden])').length");
    ok("süzgeç satırları azaltır", emekli > 0 && emekli < hepsi, emekli + " / " + hepsi);
    ok("süzgeç adreste yalnız #", (await js("location.search + location.hash")) === "#emekli");
    ok("sıradaki süzgece uyar", /zam/i.test(await js("document.querySelector('.mt-sirada').textContent")));
    ok("dosya düğmesi sayıyı söyler", (await js("__m('mt-indir')")) === "Takvime ekle (" + emekli + " tarih)", await js("__m('mt-indir')"));
    ok("Aralık satırı canlı birikim taşıyor", /birikti|Açıklandı/.test(await js("(document.querySelector('.mt-sirada .mt-canli')||{}).textContent||''")));
    /* Yalnız # değişirse yükleme olayı gelmez; önce başka sayfaya gidilir. */
    await ac("enflasyon-hesaplama/");
    await ac("mali-takvim/#arac");
    ok("adresteki süzgeç açılışta uygulanır", await js("document.querySelector('#mt-suzgec [data-kim=arac]').getAttribute('aria-pressed')") === "true");

    console.log("Koyu tema");
    await gonder("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
    await ac("mali-takvim/");
    var renk = await js("(function(){var c=getComputedStyle(document.getElementById('mt-indir'));return [c.color,c.backgroundColor]})()");
    function lum(r) {
      var c = r.match(/[\d.]+/g).slice(0, 3).map(function (x) { x = x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    var la = lum(renk[0]), lb = lum(renk[1]), kr = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    ok("birincil düğme kontrastı ≥ 4,5", kr >= 4.5, kr.toFixed(2) + " " + renk.join(" / "));
    await gonder("Emulation.setEmulatedMedia", { features: [] });

    ok("sayfalarda yakalanmamış hata yok", hatalar.length === 0, hatalar.join(" | "));
  } catch (e) {
    kalan++;
    console.log("  ✗ test yarıda kaldı → " + e.message);
  }
  ws.close();
  ch.kill();
  sunucu.close();
  console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (formlar)");
  return kalan ? 1 : 0;
}

main().then(function (k) { process.exit(k); });
