#!/usr/bin/env node
/*!
 * "Ne zaman emekli olurum?" sayfasının statik rakamlarını üretir:
 *   - "Tek günün farkı" örneği (7 ve 8 Eylül 1999 girişli iki kişi, borçlanma),
 *   - 506 s.K. Geçici m.81/B tablosu (çekirdeğin tablosundan),
 *   - metindeki data-s alanları,
 *   - SSS yapısal verisi (GÖRÜNEN metinden; ikisi ayrışamaz).
 * Her rakam ne-zaman-emekli-olurum/hesap.js ve bordro parametrelerinden gelir.
 *
 * Örnekte hesap tarihi SABİTTİR (1 Ekim 2026): tarayıcıdaki canlı hesap
 * bugünü kullanır, sayfa metni ise her gün değişmemeli. Borçlanma bedeli ve
 * en düşük emekli aylığı yıla bağlı: bunlar değişince sayfa bayatlar ve
 * --check CI'da kırmızıya döner.
 *
 * Kullanım:
 *   node tools/emeklilik-ornek.js          # yaz
 *   node tools/emeklilik-ornek.js --check  # sayfa hesapla aynı mı (CI)
 */
"use strict";
var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "ne-zaman-emekli-olurum", "index.html");
var E = require(path.join(KOK, "ne-zaman-emekli-olurum", "hesap.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var ORNEK_BUGUN = "2026-10-01";
var KISI = { bugun: ORNEK_BUGUN, dogum: "1981-01-01", cinsiyet: "erkek", statu: "4a", primGun: 6500 };
var ASKERLIK = 540;

function sayi(v, d) {
  var s = Math.abs(v).toFixed(d || 0).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "−" : "") + s.join(",");
}
function tl(v) { return sayi(Math.round(v)) + " TL"; }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(s) { var p = s.split("-"); return +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0]; }
/* Yılın okunuşuna göre bulunma ve ayrılma eki: 2024'te, 1999'dan, 2020'de. */
function ek(s, ayrilma) {
  var y = +s.slice(0, 4), son = y % 10, onlar = y % 100, soz;
  if (son) soz = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"][son];
  else if (onlar) soz = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"][onlar / 10];
  else soz = y % 1000 ? "yüz" : "bin";
  var kalin = /[aıou][^aeıioöuü]*$/.test(soz), sert = /[çfhkpsştl]$/.test(soz) && !/l$/.test(soz);
  return tarih(s) + "'" + (sert ? "t" : "d") + (kalin ? "a" : "e") + (ayrilma ? "n" : "");
}
function sure(f) { return (f.yil ? f.yil + " yıl" : "") + (f.ay ? (f.yil ? " " : "") + f.ay + " ay" : ""); }
function kacis(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function yolu(r, kod) { return r.yollar.filter(function (y) { return y.kod === kod; })[0]; }

function veriler() {
  var a = E.hesapla(Object.assign({ ilkGiris: "1999-09-07" }, KISI));
  var b = E.hesapla(Object.assign({ ilkGiris: "1999-09-08" }, KISI));
  var yil = +ORNEK_BUGUN.slice(0, 4);
  var bb = E.borclanmaEtkisi(Object.assign({ ilkGiris: "1999-09-08", askerlikGun: ASKERLIK, askerlikOnce: true }, KISI), yil);
  if (a.grup !== "eyt" || b.grup !== "gecis" || !a.enErken.tamam) throw new Error("Örnek beklenen gruplara düşmedi.");
  var aTam = yolu(a, "tam");
  return { a: a, b: b, bb: bb, aTam: aTam, yil: yil, farkAB: E.yardimci.fark(ORNEK_BUGUN, b.tarih) };
}

function ornekBlok(v) {
  var aSure = v.aTam.kosullar[0], aGun = v.aTam.kosullar[1];
  var bb = v.bb, s = bb.sonra, bSure = yolu(s, "tam");
  return [
    '<div class="em-ornek">',
    "<p>İki erkek, ikisi de 1 Ocak 1981 doğumlu, ikisi de hizmet akdiyle (4/a) çalışıyor ve " + tarih(ORNEK_BUGUN) + " itibarıyla ikisinin de " +
      sayi(KISI.primGun) + " prim günü var. Tek fark ilk sigorta girişi: biri 7 Eylül 1999'da, öbürü bir gün sonra.</p>",
    "<dl>",
    "<dt>7 Eylül 1999 girişli</dt><dd>EYT kapsamında. " + aGun.gereken.toLocaleString("tr-TR") + " gün (Geçici m.81/B-(" + v.aTam.bent + ")) ve " +
      aSure.gereken + " yıl sigortalılık şartı " + ek(aSure.tarih) + " tamamlandı: şartlar dolu, yaş aranmıyor.</dd>",
    "<dt>8 Eylül 1999 girişli</dt><dd>EYT dışında (Geçici m.9). " + yolu(v.b, "tam").kosullar[0].gereken + " yaşını bekliyor: " + tarih(v.b.tarih) + ".</dd>",
    "<dt>Aradaki fark</dt><dd>" + sure(v.farkAB) + "</dd>",
    "<dt>İkincisi " + ASKERLIK + " gün askerliğini borçlanırsa</dt><dd>Askerlik ilk girişten önceyse başlangıç " + ASKERLIK + " gün geri gider: " +
      tarih(s.baslangic) + ". EYT kapsamına girer" +
      (s.onsekizKurali ? "; o tarihte 18 yaşından küçük olduğu için sigortalılık süresi " + ek(s.sureBaslangici, true) + " sayılır (m.38/2)" : "") +
      ". " + bSure.kosullar[1].gereken.toLocaleString("tr-TR") + " gün (Geçici m.81/B-(" + bSure.bent + ")) ve " +
      bSure.kosullar[0].gereken + " yıl şartı dolu: " + sayi(s.primToplam) + " günü var, " + bSure.kosullar[0].gereken + " yıl " + ek(bSure.kosullar[0].tarih) + " doldu.</dd>",
    "<dt>Borçlanma bedeli, en az</dt><dd>" + tl(bb.maliyetEnAz) + " (" + ASKERLIK + " gün × asgari günlük kazanç × %" + sayi(bb.kalemler[0].oran * 100) + ", " + v.yil + ")</dd>",
    "<dt>Bu bedel</dt><dd>" + bb.altSinir.not.replace(/ zammı.*$/, "") + " en düşük emekli aylığının (" + tl(bb.altSinir.tutar) + ") " + sayi(bb.geriDonusAy, 1) + " katı</dd>",
    "</dl>",
    "<p>Bir günlük giriş farkı emekliliği " + sure(v.farkAB) + " öteliyor; " + ASKERLIK + " günlük askerlik borçlanması bu farkı kapatıyor. " +
      "Borçlanma ancak borçlanılan süre ilk girişten <em>önce</em> geçmişse başlangıcı geri çeker (5510 m.41). Girişten sonraki askerlik yalnız prim gününe eklenir.</p>",
    "</div>"
  ].join("\n");
}

function tabloBlok() {
  var T = E.tablolar.b81;
  function esik(e) {
    return e[0] + " yıl" + (e[1] ? " " + e[1] + " ay" : "") + (e[2] ? " " + e[2] + " gün" : "");
  }
  function tablo(cins, ad) {
    var t = T[cins];
    return [
      '<div class="em-tablo-kap">',
      "<table>",
      "<caption>" + ad + ": " + t.sure + " yıl sigortalılık ve aşağıdaki gün. 23 Mayıs 2002'deki sigortalılık süresine göre.</caption>",
      '<thead><tr><th scope="col">Bent</th><th scope="col">23.5.2002\'deki süre, en az</th><th scope="col" class="sayi">Prim günü</th><th scope="col" class="sayi">EYT öncesi yaş</th></tr></thead>',
      "<tbody>",
      t.satirlar.map(function (s) {
        return "<tr><td>(" + s[3] + ")</td><td>" + esik(s[0]) + '</td><td class="sayi">' + s[1].toLocaleString("tr-TR") + '</td><td class="sayi">' + s[2] + "</td></tr>";
      }).join("\n"),
      "</tbody>",
      "</table>",
      "</div>"
    ].join("\n");
  }
  return tablo("kadin", "Kadın") + "\n" + tablo("erkek", "Erkek");
}

function alanlar(v) {
  var P = B.parametre(v.yil), S = P.sigortalilik;
  return {
    yil: String(v.yil),
    farkAB: sure(v.farkAB),
    borcBedel: tl(v.bb.maliyetEnAz),
    borcKat: sayi(v.bb.geriDonusAy, 1),
    oranGenel: "%" + sayi(S.borclanmaOrani * 100),
    oranDogum: "%" + sayi(S.dogumBorclanmaOrani * 100)
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
  html = blok(html, "EM-ORNEK", ornekBlok(v));
  html = blok(html, "EM-TABLO", tabloBlok());
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
    if (yeni !== eski) { console.error("Emeklilik sayfası bayat — 'node tools/emeklilik-ornek.js' çalıştırın."); process.exit(1); }
    console.log("Emeklilik sayfası hesapla aynı.");
  } else {
    if (yeni !== eski) fs.writeFileSync(SAYFA, yeni);
    console.log(yeni !== eski ? "Emeklilik sayfası yazıldı." : "Emeklilik sayfası zaten güncel.");
  }
}
module.exports = { uret: uret, ORNEK_BUGUN: ORNEK_BUGUN };
