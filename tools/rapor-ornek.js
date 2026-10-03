#!/usr/bin/env node
/*!
 * Rapor parası sayfasının statik rakamlarını üretir:
 *   - "Zam aldıktan sonra rapor" örneği (kazanç, ödenek, raporlu ayın bordrosu),
 *   - metindeki data-s alanları,
 *   - SSS yapısal verisi (GÖRÜNEN metinden; ikisi ayrışamaz).
 * Her rakam bordro/rapor.js ile bordro parametrelerinden gelir.
 *
 * Örnek kişi ve tarih SABİTTİR. Asgari ücret ya da vergi tarifesi değişirse
 * sayfa bayatlar ve --check CI'da kırmızıya döner.
 *
 * Kullanım:
 *   node tools/rapor-ornek.js          # yaz
 *   node tools/rapor-ornek.js --check  # sayfa hesapla aynı mı (CI)
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "rapor-parasi-hesaplama", "index.html");
var R = require(path.join(KOK, "bordro", "rapor.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var KISI = { baslangic: "2026-10-05", brutSimdi: 60000, brutOnce: 50000, zamAyi: "2026-07", ayaktaGun: 10 };
var DOGUM = "2026-08-15";   // analık süresinin tamamı 2026'da kalsın

function sayi(v, d) {
  var s = Math.abs(v).toFixed(d || 0).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "−" : "") + s.join(",");
}
function tl(v) { return sayi(Math.round(v)) + " TL"; }
function tl2(v) { return sayi(v, 2) + " TL"; }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(s) { var p = s.split("-"); return +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0]; }
function ayYil(a) { return AYLAR[a.ay - 1] + " " + a.yil; }
function kacis(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function veriler() {
  var k = R.kazancTuret(KISI);
  var g = Object.assign({ tur: "hastalik" }, KISI, { kazanc: k.kazanc, gun: k.gun, ucretToplami: k.ucretToplami });
  var r = R.hesapla(g);
  var e = R.bordroEtkisi(r, { aylikBrut: KISI.brutSimdi });
  var kz = R.kazancTuret(Object.assign({}, KISI, { brutOnce: KISI.brutSimdi }));
  var rz = R.hesapla(Object.assign({}, g, { kazanc: kz.kazanc, gun: kz.gun, ucretToplami: kz.ucretToplami }));
  var onceAy = k.aylar.filter(function (a) { return a.brut === KISI.brutOnce; });
  var sonraAy = k.aylar.filter(function (a) { return a.brut === KISI.brutSimdi; });
  if (onceAy.length + sonraAy.length !== 12) throw new Error("Örnek kazanç ayları beklenen gibi bölünmedi.");
  if (k.aylar.some(function (a) { return a.pek !== a.brut; })) throw new Error("Örnekte bir ay alt ya da üst sınıra takıldı; metin bunu söylemiyor.");
  if (!r.uygun || r.odenmeyenGun !== 2 || e.aylar.length !== 1) throw new Error("Örnek hastalık raporu beklenen biçimde değil.");
  var an = R.hesapla({ tur: "analik", baslangic: DOGUM, kazanc: k.kazanc, gun: k.gun });
  var anC = R.hesapla({ tur: "analik", baslangic: DOGUM, cogul: true, kazanc: k.kazanc, gun: k.gun });
  if (an.parametreYok || an.aylar[0].ay.slice(0, 4) !== DOGUM.slice(0, 4)) throw new Error("Analık örneği yıl dışına taştı.");
  return { k: k, r: r, a: e.aylar[0], y: e.yillar[0], rz: rz, onceAy: onceAy, sonraAy: sonraAy, an: an, anC: anC, sinir: R.sinirlar(KISI.baslangic) };
}

function ornekBlok(v) {
  var k = v.k, r = v.r, a = v.a, ilk = v.onceAy[0], sonO = v.onceAy[v.onceAy.length - 1], ilkS = v.sonraAy[0], sonS = v.sonraAy[v.sonraAy.length - 1];
  var ayAdi = AYLAR[+a.ay.slice(5, 7) - 1];
  var kayip = v.rz.toplam - r.toplam;
  return [
    '<div class="rp-ornek">',
    "<p>Rapordan önceki on iki ayın tamamında aynı işyerinde, aylık " + tl(KISI.brutOnce) + " brütle çalışan biri " + ayYil(ilkS) + " itibarıyla " +
      tl(KISI.brutSimdi) + " brüte zam alıyor. " + tarih(KISI.baslangic) + " tarihinde " + KISI.ayaktaGun + " günlük ayakta hastalık raporu alıyor; işvereni rapor günlerinin ücretini ödemiyor.</p>",
    "<dl>",
    "<dt>Son 12 ayın kazancı</dt><dd>" + v.onceAy.length + " ay × " + tl(KISI.brutOnce) + " (" + ayYil(ilk) + " – " + ayYil(sonO) + ") + " +
      v.sonraAy.length + " ay × " + tl(KISI.brutSimdi) + " (" + ayYil(ilkS) + " – " + ayYil(sonS) + ") = " + tl(k.kazanc) + ", " + k.gun + " gün</dd>",
    "<dt>Günlük kazanç</dt><dd>" + tl(k.kazanc) + " ÷ " + k.gun + " = " + tl2(r.gunlukKazanc) + " (güncel maaşla " + tl2(v.rz.gunlukKazanc) + " olurdu)</dd>",
    "<dt>Günlük ödenek, ayakta</dt><dd>" + tl2(r.gunlukKazanc) + " × 2/3 = " + tl2(r.gunlukOdenek.ayakta) + "</dd>",
    "<dt>Ödenen gün</dt><dd>" + r.raporGunu + " günün " + r.odenenGun + "'i (ilk " + r.odenmeyenGun + " gün ödenmez)</dd>",
    "<dt>Rapor parası</dt><dd>" + tl2(r.toplam) + ", vergisiz</dd>",
    "<dt>Normal bir " + ayAdi + " neti</dt><dd>" + tl2(a.netNormal) + "</dd>",
    "<dt>" + ayAdi + " maaşı, " + a.ucretliGun + " gün ücret</dt><dd>" + tl2(a.netMaas) + "</dd>",
    "<dt>Elinize geçen</dt><dd>" + tl2(a.eleGecen) + " (" + sayi(a.fark, 2) + " TL)</dd>",
    "</dl>",
    "<p>Rapor parası kesilen ücretin yerini tam tutmuyor: raporlu ayda elinize normal aydan " + tl2(-a.fark) + " az geçiyor. Bunun " +
      tl2(kayip) + "'si zamdan kaynaklanıyor: ödenek güncel maaştan hesaplansaydı " + tl2(v.rz.toplam) + " olurdu. On iki ayın ortalaması zamdan önceki " +
      v.onceAy.length + " ayı da içeriyor.</p>",
    "</div>"
  ].join("\n");
}

function alanlar(v) {
  return {
    yil: String(v.sinir.yil),
    altSinir: v.sinir.yil + "'da " + tl(v.sinir.gunlukAlt),
    dusukSinir: v.sinir.yil + "'da " + tl(v.sinir.gunlukAlt * 2),
    ornekKazanc: tl(v.k.kazanc),
    ornekGun: String(v.k.gun),
    ornekGk: tl2(v.r.gunlukKazanc),
    ornekGunluk: tl2(v.r.gunlukOdenek.ayakta),
    ornekKayip: tl2(v.rz.toplam - v.r.toplam),
    analikGun: String(v.an.raporGunu),
    analikCogulGun: String(v.anC.raporGunu),
    analikToplam: tl(v.an.toplam)
  };
}

function blok(html, ad, icerik) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("Blok bulunamadı: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}
function duz(x) {
  return x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function uret(html) {
  var v = veriler();
  html = blok(html, "RP-ORNEK", ornekBlok(v));
  var m = alanlar(v);
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (t, ac, et, k, ic, kapa) {
    if (!(k in m)) throw new Error("Bilinmeyen data-s: " + k);
    return ac + kacis(m[k]) + kapa;
  });
  var i = html.indexOf('<h2 id="sss">'), j = html.indexOf("<!-- SSS:BITIS -->", i);
  if (i < 0 || j < 0) throw new Error("SSS bölümü bulunamadı.");
  var parca = html.slice(i, j), faq = [], re = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, x;
  while ((x = re.exec(parca))) faq.push({ "@type": "Question", name: duz(x[1]), acceptedAnswer: { "@type": "Answer", text: duz(x[2]) } });
  var ac = '<script type="application/ld+json">';
  var ldBas = html.indexOf(ac), ldSon = html.indexOf("</script>", ldBas);
  var ld = JSON.parse(html.slice(ldBas + ac.length, ldSon));
  ld["@graph"].forEach(function (n) { if (n["@type"] === "FAQPage") n.mainEntity = faq; });
  var yeni = "\n" + JSON.stringify(ld, null, 2).split("\n").map(function (s) { return "  " + s; }).join("\n") + "\n  ";
  return html.slice(0, ldBas + ac.length) + yeni + html.slice(ldSon);
}

if (require.main === module) {
  var eski = fs.readFileSync(SAYFA, "utf8");
  var yeni = uret(eski);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== eski) { console.error("Rapor parası sayfası bayat — 'node tools/rapor-ornek.js' çalıştırın."); process.exit(1); }
    console.log("Rapor parası sayfası hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(SAYFA, yeni);
    console.log(yeni !== eski ? "Rapor parası sayfası yazıldı." : "Rapor parası sayfası zaten güncel.");
  }
}
module.exports = { uret: uret, veriler: veriler, KISI: KISI };
