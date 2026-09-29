#!/usr/bin/env node
/*!
 * "İşsiz kalırsam kaç ay dayanırım?" sayfasının statik rakamlarını üretir:
 * örnek hane bloğu, metindeki data-s alanları (GSS primi, ödenek tavanı…)
 * ve SSS yapısal verisi. Her rakam finansal-emniyet-testi/hesap.js ve bordro
 * parametrelerinden gelir; elle yazılmaz.
 *
 * SSS yapısal verisi GÖRÜNEN metinden kurulur: data-s alanı dolduktan sonra
 * soru ve cevaplar sayfadan okunup JSON-LD'ye yazılır. İkisi ayrışamaz.
 *
 * Örnekte yıllık fiyat artışı SABİT bir varsayımdır (%30), TÜFE serisine
 * bağlı değil: seri her gece uzuyor ve örnek her gece değişmemeli.
 * Canlı hesap ise tarayıcıda seriden önerilir.
 *
 * Kullanım:
 *   node tools/dayanma-ornek.js          # yaz
 *   node tools/dayanma-ornek.js --check  # sayfa hesapla aynı mı (CI)
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "finansal-emniyet-testi", "index.html");
var D = require(path.join(KOK, "finansal-emniyet-testi", "hesap.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var ORNEK = {
  cikis: "2026-10-01", iseGiris: "2021-10-01", fesihTuru: "isveren", ciplakBrut: 90000,
  son3YilPrimGunu: 1080, kullanilmayanIzinGunu: 5, nakit: 150000, yatirim: 100000,
  zorunluGider: 45000, istegeBagliGider: 15000, kisintiOrani: 50, borcTaksiti: 5000, digerGelir: 0,
  gss: "odeyecegim", enflasyonYillik: 30
};

function sayi(v, d) {
  var s = Math.abs(v).toFixed(d || 0).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "−" : "") + s.join(",");
}
function tl(v) { return sayi(Math.round(v)) + " TL"; }
function ay(v) { return sayi(v, 1) + " ay"; }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function ayAdi(ym) { var p = ym.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }
function kacis(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function veriler() {
  var s = D.hesapla(ORNEK);
  var d = D.duyarlilik(ORNEK);
  var istifa = D.hesapla(Object.assign({}, ORNEK, { fesihTuru: "istifa" }));
  var satir = function (kod) { return d.satirlar.filter(function (x) { return x.kod === kod; })[0]; };
  var yil = +ORNEK.cikis.slice(0, 4);
  var P = B.parametre(yil), don = P.donemler[P.donemler.length - 1];
  return { s: s, d: d, istifa: istifa, satir: satir, P: P, don: don, yil: yil };
}

function ornekBlok(v) {
  var s = v.s, k = s.kalemler, h6 = s.hedefler.filter(function (x) { return x.ay === 6; })[0];
  var h12 = s.hedefler.filter(function (x) { return x.ay === 12; })[0];
  var hedefMetin = function (h) { return h.yeterli ? "yeterli, kasada en az " + tl(h.pay) + " kalır" : tl(h.eksik) + " eksik"; };
  return [
    '<div class="dy-ornek">',
    "<p>1 Ekim 2026'da işveren feshiyle işten çıkan, 1 Ekim 2021'den beri aylık " + tl(ORNEK.ciplakBrut) + " brüt çalışan, son üç yılda 1080 gün primi olan biri. " +
      "Birikimi " + tl(ORNEK.nakit + ORNEK.yatirim) + " (" + tl(ORNEK.nakit) + " nakit, " + tl(ORNEK.yatirim) + " altın ve fon); " +
      "aylık zorunlu gideri " + tl(ORNEK.zorunluGider) + ", isteğe bağlı gideri " + tl(ORNEK.istegeBagliGider) + " ve bunun yarısını kesiyor; " +
      "kredi taksiti " + tl(ORNEK.borcTaksiti) + ". Ödenek bitince GSS primini kendisi ödüyor. Yıllık fiyat artışı varsayımı %" + ORNEK.enflasyonYillik + ".</p>",
    "<dl>",
    "<dt>Kıdem tazminatı, net</dt><dd>" + tl(k.kidem) + "</dd>",
    "<dt>İhbar tazminatı, net</dt><dd>" + tl(k.ihbar) + "</dd>",
    "<dt>İzin ücreti ve son ay ücreti</dt><dd>" + tl(k.izin + k.sonAy) + "</dd>",
    "<dt>Çıkış günü kasası</dt><dd>" + tl(s.baslangicNakit) + "</dd>",
    "<dt>İşsizlik ödeneği</dt><dd>" + tl(s.odenek.aylik) + " × " + s.odenek.ay + " ay</dd>",
    "<dt>Ödenekten sonra GSS primi</dt><dd>" + tl(s.gssAylik) + " / ay</dd>",
    "<dt>Dayanma süresi</dt><dd>" + ay(s.dayanmaAy) + " (" + ayAdi(s.bitis) + ")</dd>",
    "<dt>6 ay iş arama</dt><dd>" + hedefMetin(h6) + "</dd>",
    "<dt>12 ay iş arama</dt><dd>" + hedefMetin(h12) + "</dd>",
    "</dl>",
    "<p>Aynı kişi istifa etseydi kıdem, ihbar ve ödenek doğmayacak, dayanma " + ay(v.istifa.dayanmaAy) + " olacaktı. " +
      "Kıdem ve ihbar ödenmezse " + ay(v.satir("tazminatsiz").dayanmaAy) + ", fiyatlar hiç artmasaydı " + ay(v.satir("enflasyonsuz").dayanmaAy) + ".</p>",
    "</div>"
  ].join("\n");
}

function alanlar(v) {
  var oran = v.P.sigortalilik.gssOrani, gss = v.don.asgariBrut * oran;
  var tavan = v.don.asgariBrut * v.P.issizlik.tavanOrani;
  return {
    yil: String(v.yil),
    // Ek, orana göre değişmesin: "…'sı / 'si" yerine eksiz kalıp.
    gssMetin: v.yil + "'da aylık " + sayi(gss, 2) + " TL (asgari ücret × %" + sayi(oran * 100) + ")",
    odenekTavan: v.yil + "'da " + sayi(tavan, 2) + " TL brüt",
    ornekTazminatsiz: sayi(v.s.dayanmaAy, 1) + " aydan " + sayi(v.satir("tazminatsiz").dayanmaAy, 1) + " aya"
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
  html = blok(html, "DY-ORNEK", ornekBlok(v));
  var m = alanlar(v);
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-s="([A-Za-z]+)"[^>]*>)([^<]*)(<\/\2>)/g, function (t, ac, et, k, ic, kapa) {
    if (!(k in m)) throw new Error("Bilinmeyen data-s: " + k);
    return ac + kacis(m[k]) + kapa;
  });
  // SSS yapısal verisi görünen metinden
  var i = html.indexOf('<h2 id="sss">'), j = html.indexOf('<p class="muted"><a href="metodoloji/">', i);
  var parca = html.slice(i, j), faq = [], re = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, x;
  while ((x = re.exec(parca))) faq.push({ "@type": "Question", name: duz(x[1]), acceptedAnswer: { "@type": "Answer", text: duz(x[2]) } });
  var ldBas = html.indexOf('<script type="application/ld+json">'), ldSon = html.indexOf("</script>", ldBas);
  var jsonMetin = html.slice(ldBas + '<script type="application/ld+json">'.length, ldSon);
  var ld = JSON.parse(jsonMetin);
  ld["@graph"].forEach(function (n) { if (n["@type"] === "FAQPage") n.mainEntity = faq; });
  var yeni = "\n" + JSON.stringify(ld, null, 2).split("\n").map(function (s) { return "  " + s; }).join("\n") + "\n  ";
  return html.slice(0, ldBas + '<script type="application/ld+json">'.length) + yeni + html.slice(ldSon);
}

if (require.main === module) {
  var eski = fs.readFileSync(SAYFA, "utf8");
  var yeni = uret(eski);
  if (process.argv.indexOf("--check") >= 0) {
    if (yeni !== eski) { console.error("Dayanma sayfası bayat — 'node tools/dayanma-ornek.js' çalıştırın."); process.exit(1); }
    console.log("Dayanma sayfası hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(SAYFA, yeni);
    console.log(yeni !== eski ? "Dayanma sayfası yazıldı." : "Dayanma sayfası zaten güncel.");
  }
}
module.exports = { ORNEK: ORNEK, uret: uret };
