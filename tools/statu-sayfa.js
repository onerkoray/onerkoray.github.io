#!/usr/bin/env node
/*
 * Sigortalılık statüleri sayfasının üretilen blokları.
 *
 * Sayfadaki her şart, gün, yaş ve prim tutarı sigortalilik-statuleri/statu.js
 * motorundan okunur (4/a ve 4/b şartları da onun üzerinden "Ne zaman emekli
 * olurum?" motorundan gelir). Elle yazılmış rakam yok; motor ya da
 * parametre değişirse --check CI'da patlar.
 *
 * Bloklar: STATU-SERIT (dönem şeridi), STATU-TABLO (karşılaştırma),
 * STATU-DETAY (statü bölümleri), SSS (sorular ve FAQPage JSON-LD).
 *
 * Kullanım:
 *   node tools/statu-sayfa.js           # yaz
 *   node tools/statu-sayfa.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var T = require(path.join(KOK, "sigortalilik-statuleri", "statu.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));
var SAYFA = path.join(KOK, "sigortalilik-statuleri", "index.html");

var YIL = B.sonYil();
var nf = new Intl.NumberFormat("tr-TR");
var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function sayi(v) { return nf.format(v); }
function tl(v) { return nf2.format(v) + " TL"; }
function yuzde(x) { return "%" + String(Math.round(x * 10000) / 100).replace(".", ","); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

var AD = { "4a": "4/a", "4b": "4/b", "4c": "4/c" };
var CINS = ["kadin", "erkek"];

/* ------------------------------------------------ değer metinleri */

function deger(v) { return typeof v === "object" ? sayi(v.min) + "–" + sayi(v.max) : sayi(v); }
/* Kadın ve erkek aynıysa tek değer, değilse "kadın / erkek". */
function cift(k, e) { var a = deger(k), b = deger(e); return a === b ? a : a + " / " + b; }

function kosulMetni(kk, ke) {
  var v = cift(kk.gereken, ke.gereken);
  if (kk.tur === "yas") return "Yaş " + v;
  if (kk.tur === "sure") return (kk.ad === "Fiilî hizmet süresi" ? "Fiilî hizmet " : "Sigortalılık süresi ") + v + " yıl";
  if (kk.tamYil) return cift(kk.tamYil, ke.tamYil) + " tam yıl prim (" + v + " gün)";
  return v + " prim günü";
}

/* Bir statünün dönemlerini kadın/erkek birleşik yollarla verir. */
function birlesik(statu) {
  var k = T.sartlar(statu, "kadin"), e = T.sartlar(statu, "erkek");
  return k.map(function (dk, i) {
    var de = e[i];
    return {
      donem: dk.donem,
      yollar: dk.yollar.map(function (yk, j) {
        var ye = de.yollar[j];
        if (!ye || ye.kod !== yk.kod) throw new Error("Kadın ve erkek yolları ayrıştı: " + statu + " " + dk.donem.kod);
        return {
          kod: yk.kod, ad: yk.ad.replace(/\b(\d)(\d{3})\b/g, "$1.$2"), dayanak: yk.dayanak, kismi: yk.kismi,
          kosullar: yk.kosullar.map(function (kk, m) {
            var ke = ye.kosullar[m];
            return { metin: kosulMetni(kk, ke), not: kk.not || null, tur: kk.tur };
          })
        };
      })
    };
  });
}

function yolHtml(y, etiket) {
  return '<div class="st-yol' + (y.kismi ? " st-yol--kismi" : "") + '">' +
    (etiket ? '<p class="st-yol-ad">' + esc(y.ad) + "</p>" : "") +
    "<ul>" + y.kosullar.map(function (k) {
      return "<li>" + esc(k.metin) + (k.not ? ' <span class="st-not">' + esc(k.not) + "</span>" : "") + "</li>";
    }).join("") + "</ul>" +
    '<p class="st-dayanak">' + esc(y.dayanak) + "</p></div>";
}

/* ------------------------------------------------ dönem şeridi */

function yilKesri(iso) {
  var p = iso.split("-").map(Number);
  var bas = Date.UTC(p[0], 0, 1), son = Date.UTC(p[0] + 1, 0, 1);
  return p[0] + (Date.UTC(p[0], p[1] - 1, p[2]) - bas) / (son - bas);
}

/* Şeritteki iki satır: önce yaş, sonra gün ve süre; "kadın/erkek" sıkı. */
function sik(m) { return m.replace(/ \/ /g, "/"); }
function kisaOzet(y) {
  var yasK = y.kosullar.filter(function (k) { return k.tur === "yas"; })[0];
  var diger = y.kosullar.filter(function (k) { return k.tur !== "yas"; }).map(function (k) {
    return sik(k.metin.replace(/ prim günü$/, " gün").replace(/^Fiilî hizmet /, "").replace(/^Sigortalılık süresi /, "")
      .replace(/ tam yıl prim \(.*\)$/, " tam yıl"));
  });
  return { ust: yasK ? sik(yasK.metin.replace(/^Yaş /, "")) + " yaş" : "Yaş aranmaz", alt: diger.join(" · ") };
}

function serit() {
  var X0 = 1990, X1 = 2030, sol = 150, sag = 940, W = 960, H = 330;
  function x(v) { return sol + (v - X0) / (X1 - X0) * (sag - sol); }
  var seritler = ["4a", "4b", "4c"], eskiAd = { "4a": "SSK", "4b": "Bağ-Kur", "4c": "Emekli Sandığı" };
  var ust = 70, yuk = 54, ara = 22;
  var parca = [], etiket = [];
  seritler.forEach(function (s, i) {
    var y = ust + i * (yuk + ara);
    etiket.push('<text class="ss-ad" x="0" y="' + (y + 24) + '">' + AD[s] + '</text>' +
      '<text class="ss-eski" x="0" y="' + (y + 42) + '">' + eskiAd[s] + "</text>");
    birlesik(s).forEach(function (d) {
      var a = d.donem.bas ? yilKesri(d.donem.bas) : X0, b = d.donem.bit ? yilKesri(d.donem.bit) + 1 / 365 : X1;
      var xa = x(a), xb = x(b), tam = d.yollar[0];
      parca.push('<g class="ss-parca ss-' + d.donem.kod + '" style="--s:' + i + '">' +
        '<rect class="ss-zemin" x="' + xa.toFixed(1) + '" y="' + y + '" width="' + (xb - xa).toFixed(1) + '" height="' + yuk + '"/>' +
        '<rect class="ss-tarama" x="' + xa.toFixed(1) + '" y="' + y + '" width="' + (xb - xa).toFixed(1) + '" height="' + yuk + '" fill="url(#ss-tara)"/>' +
        '<text class="ss-yazi" x="' + (xa + 10).toFixed(1) + '" y="' + (y + 22) + '">' + esc(kisaOzet(tam).ust) + "</text>" +
        '<text class="ss-yazi ss-yazi--alt" x="' + (xa + 10).toFixed(1) + '" y="' + (y + 41) + '">' + esc(kisaOzet(tam).alt) + "</text></g>");
    });
  });
  // Sınır çizgileri: EYT tüm şeritlerde; 2008 sınırı 4/a-4/b ile 4/c'de ayrı.
  var alt = ust + 3 * yuk + 2 * ara;
  var eyt = x(yilKesri(T.sinirlar.eyt)), g4 = x(yilKesri(T.sinirlar.gecis4ab) + 1 / 365), g4c = x(yilKesri(T.sinirlar.gecis4c) + 1 / 365);
  var y4c = ust + 2 * (yuk + ara);
  var cizgi =
    '<path class="ss-sinir" d="M' + eyt.toFixed(1) + " " + (ust - 14) + " V" + (alt + 6) + '"/>' +
    '<text class="ss-tarih" x="' + eyt.toFixed(1) + '" y="' + (ust - 22) + '" text-anchor="middle">8 Eylül 1999</text>' +
    '<path class="ss-sinir" d="M' + g4.toFixed(1) + " " + (ust - 14) + " V" + (y4c - 4) + '"/>' +
    '<text class="ss-tarih" x="' + g4.toFixed(1) + '" y="' + (ust - 22) + '" text-anchor="end">30 Nisan 2008</text>' +
    '<path class="ss-sinir ss-sinir--4c" d="M' + g4c.toFixed(1) + " " + (y4c - 4) + " V" + (alt + 6) + '"/>' +
    '<text class="ss-tarih ss-tarih--4c" x="' + g4c.toFixed(1) + '" y="' + (alt + 22) + '" text-anchor="start">30 Eylül 2008 · 4/c beş ay sonra</text>';
  var eksen = [1990, 2000, 2010, 2020, 2030].map(function (v) {
    return '<text class="ss-yil" x="' + x(v).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + v + "</text>" +
      '<path class="ss-cetvel" d="M' + x(v).toFixed(1) + " " + (H - 26) + " v6\"/>";
  }).join("") + '<path class="ss-taban" d="M' + sol + " " + (H - 26) + " H" + sag + '"/>';
  return '<figure class="ss-figur">' +
    '<div class="ss-kaydir"><svg class="ss-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" ' +
    'aria-labelledby="ss-baslik"><title id="ss-baslik">Üç statünün emeklilik dönemleri: 8 Eylül 1999 sınırı hepsinde ortak; ' +
    "2008 sınırı 4/a ve 4/b için 30 Nisan, 4/c için 30 Eylül</title>" +
    '<defs><pattern id="ss-tara" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 0 V7"/></pattern></defs>' +
    etiket.join("") + parca.join("") + cizgi + eksen + "</svg></div>" +
    '<figcaption><span class="ss-lejant"><span class="ss-eyt">1999 öncesi giriş</span><span class="ss-gecis">1999–2008 geçiş</span>' +
    '<span class="ss-yeni">2008 sonrası (5510)</span></span> Her parçada o dönemde girenlerin tam emeklilik şartı, kadın / erkek. ' +
    "Şerit, ilk sigortalılık tarihine göre okunur.</figcaption></figure>";
}

/* ------------------------------------------------ karşılaştırma tablosu */

function tablo() {
  var satirlar = ["4a", "4b", "4c"].map(function (s) {
    var b = birlesik(s);
    return '<tbody><tr><th scope="rowgroup" colspan="3" class="st-grup-bas"><a href="#s-' + s + '">' + AD[s] + "</a> " +
      esc(T.statuler[s].baslik) + "</th></tr>" +
      b.map(function (d) {
        return '<tr><th scope="row">' + esc(d.donem.ad) + "</th><td>" + yolHtml(d.yollar[0], true) + "</td><td>" +
          d.yollar.slice(1).map(function (y) { return yolHtml(y, true); }).join("") + "</td></tr>";
      }).join("") + "</tbody>";
  }).join("");
  return '<div class="table-scroll"><table class="data-table data-table--text st-tablo"><caption>Emeklilik şartları, ilk sigortalılık tarihine göre. ' +
    "Kadın ve erkekte farklı olan sayılar &ldquo;kadın / erkek&rdquo; biçiminde.</caption>" +
    '<thead><tr><th scope="col">İlk giriş</th><th scope="col">Tam emeklilik</th><th scope="col">Diğer yollar</th></tr></thead>' +
    satirlar + "</table></div>";
}

/* ------------------------------------------------ statü bölümleri */

var TALEP = {
  "4a": "Aylık için çalışılan işten ayrılıp yazılı istekte bulunmak gerekir.",
  "4b": "Aylık için faaliyete son verip vermeyeceğini beyan edip yazılı istekte bulunmak ve talep tarihinde GSS dahil prim borcu olmamak gerekir.",
  "4c": "Aylık için istek üzerine yetkili makamdan emekliye sevk onayı alınıp kurumla ilişiğin kesilmesi gerekir."
};

function primHtml(s) {
  var p = T.prim(s, YIL);
  if (s === "4a") {
    return '<p class="sd-prim"><strong>Prim (' + YIL + "):</strong> çalışan payı " + yuzde(p.isci) + ", işveren payı " + yuzde(p.isveren) +
      "; işveren SGK payından " + yuzde(p.isverenIndirim).replace("%", "") + " puan (imalatta " + yuzde(p.isverenIndirimImalat).replace("%", "") +
      " puan) indirim uygulanabilir. Kazanç " + tl(p.kazancAlt) + " ile " + tl(p.kazancUst) + " arasında. <span class=\"st-dayanak\">" + esc(p.dayanak) + "</span></p>";
  }
  if (s === "4b") {
    return '<p class="sd-prim"><strong>Prim (' + YIL + "):</strong> beyan edilen kazancın " + yuzde(p.oran) + "'i; düzenli ödeyenlere " +
      yuzde(p.indirimliOran) + ". En az " + tl(p.enAz) + " (indirimli " + tl(p.enAzIndirimli) + "), en çok " + tl(p.enCok) +
      ' aylık. <span class="st-dayanak">' + esc(p.dayanak) + "</span></p>";
  }
  if (s === "istege") {
    return '<p class="sd-prim"><strong>Prim (' + YIL + "):</strong> seçilen kazancın " + yuzde(p.oran) + "'ü (" +
      "malullük, yaşlılık ve ölüm %21, genel sağlık sigortası %12). En az " + tl(p.enAz) + ", en çok " + tl(p.enCok) +
      ' aylık. <span class="st-dayanak">' + esc(p.dayanak) + "</span></p>";
  }
  return '<p class="sd-prim"><strong>Prim:</strong> emekli keseneği ve kurum karşılığı maaştan kurumca kesilip ödenir; bu sayfa o tutarı hesaplamıyor.</p>';
}

function detay() {
  return ["4a", "4b", "4c", "istege"].map(function (s) {
    var st = T.statuler[s];
    var bas = '<section class="sd-statu" id="s-' + s + '" aria-labelledby="s-' + s + '-bas">' +
      '<p class="sd-ust">' + esc(st.dayanak) + (st.eskiAd ? " · eski adıyla " + esc(st.eskiAd) : "") + "</p>" +
      '<h3 id="s-' + s + '-bas">' + esc(st.ad) + ": " + esc(st.baslik) + "</h3>" +
      "<p>" + esc(st.ozet) + "</p>" +
      '<h4>' + (s === "istege" ? "Kimler isteğe bağlı sigortalı olabilir?" : "Kimler bu statüdedir?") + "</h4>" +
      "<ul>" + st.kapsam.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul>" +
      '<p class="st-dayanak">' + esc(st.kapsamDayanak) + "</p>";
    if (s === "istege") {
      return bas + "<h4>Emeklilikte nasıl sayılır?</h4>" +
        "<p>İsteğe bağlı prim ödenen süreler 4/b sigortalılık süresi sayılır. Tek istisna: ay içinde 30 günden az çalışan bir sigortalı " +
        "eksik günleri isteğe bağlı primle tamamlarsa, o günler 4/a sayılır. Primi ait olduğu aydan sonraki 12 ay içinde " +
        "ödenmeyen süre sigortalılıktan sayılmaz.</p>" +
        '<p class="st-dayanak">5510 s.K. m.51/3 ve son fıkra, m.52/3</p>' + primHtml(s) + "</section>";
    }
    return bas + "<h4>Emeklilik şartları</h4>" +
      '<div class="sd-donemler">' + birlesik(s).map(function (d) {
        return '<div class="sd-donem sd-' + d.donem.kod + '"><p class="sd-donem-ad">' + esc(d.donem.ad) + "</p>" +
          d.yollar.map(function (y) { return yolHtml(y, true); }).join("") + "</div>";
      }).join("") + "</div>" +
      "<p>" + esc(TALEP[s]) + ' <span class="st-dayanak">5510 s.K. m.28</span></p>' + primHtml(s) +
      (s !== "4c" ? '<p class="sd-git"><a href="../ne-zaman-emekli-olurum/">Kendi emeklilik tarihinizi hesaplayın <span aria-hidden="true">→</span></a></p>' : "") +
      "</section>";
  }).join("");
}

/* ------------------------------------------------ sorular */

function sssBlok() {
  var y4a = birlesik("4a"), y4b = birlesik("4b"), y4c = birlesik("4c");
  var pi = T.prim("istege", YIL);
  function yolu(b, donem, kod) { return b.filter(function (d) { return d.donem.kod === donem; })[0].yollar.filter(function (y) { return y.kod === kod; })[0]; }
  var g4a = yolu(y4a, "yeni", "tam").kosullar, g4b = yolu(y4b, "yeni", "tam").kosullar, k4a = yolu(y4a, "yeni", "kismi").kosullar;
  var c4c = yolu(y4c, "gecis", "tam").kosullar;
  function m(k, tur) { return k.filter(function (x) { return x.tur === tur; })[0].metin; }
  var s = [
    ["4/a, 4/b ve 4/c arasındaki fark nedir?",
      "Çalışma biçimidir. 4/a bir işverene hizmet akdiyle bağlı çalışanlardır (eski SSK). 4/b kendi adına ve hesabına bağımsız çalışanlardır: esnaf, " +
      "serbest meslek, şirket ortağı, çiftçi, muhtar (eski Bağ-Kur). 4/c kamu idarelerinde kadrolu ya da sözleşmeli çalışanlardır: memurlar (eski Emekli Sandığı). " +
      "Dayanak 5510 sayılı Kanun'un 4. maddesidir."],
    ["2008'den sonra sigortalı olan kaç günle emekli olur?",
      "4/a'da " + m(g4a, "gun") + ", 4/b ve 4/c'de " + m(g4b, "gun") + "; " + m(g4a, "yas").toLowerCase() + " (kadın / erkek). Gün şartı 1 Ocak 2036 ve " +
      "sonrasında dolarsa yaş kademeli olarak 65'e çıkar. İkinci yol yaşa üç yıl ekleyip 5.400 günle emekliliktir; 4/a'da bu gün sayısı ilk giriş " +
      "yılına göre " + m(k4a, "gun").replace(" prim günü", "") + " arasındadır (5510 m.28)."],
    ["Memurlar için 2008 sınırı neden Ekim?",
      "4/a ve 4/b için geçiş hükmü 30 Nisan 2008'de bitti (5510 m.108/b). 4/c'de ise 5510 sayılı Kanun 1 Ekim 2008'de yürürlüğe girdi (m.108/d); " +
      "o tarihe kadar memur olanlara 5434 sayılı Kanun uygulanır. 8 Eylül 1999 ile 30 Eylül 2008 arasında memur olanlarda şart " +
      m(c4c, "yas").toLowerCase() + " (kadın / erkek) ve " + m(c4c, "sure").toLowerCase() + "dır (4447 s.K. m.23)."],
    ["Hem işçi hem esnafsam hangi statüdeyim?",
      "4/a. Hizmet akdiyle çalışma ile bağımsız çalışma aynı anda olursa 4/a esas alınır; yazılı taleple 4/b kapsamında da prim ödenebilir. " +
      "Memurluk varsa her durumda önce 4/c esas alınır (5510 m.53/1)."],
    ["İsteğe bağlı sigorta hangi statü sayılır, primi ne kadar?",
      "Ödenen süreler 4/b sayılır (5510 m.51). Prim seçilen kazancın " + yuzde(pi.oran) + "'üdür; " + YIL + "'da en az " + tl(pi.enAz) +
      ", en çok " + tl(pi.enCok) + " aylık. 18 yaşını doldurmak, zorunlu sigortalı olmamak ve kendi sigortalılığından aylık almıyor olmak gerekir."],
    ["Birden fazla statüde çalıştım; hangisinden emekli olurum?",
      "2008 sonrası ilk kez sigortalı olanlarda en çok sigortalılığın geçtiği statüden; süreler eşitse son statüden (5510 m.53). " +
      "2008 öncesi girişlerde mülga 2829 sayılı Kanun hükümleri uygulanır; bu sayfa o birleştirme hesabını yapmıyor."],
    ["Kamuda işçiyim; memur mu sayılırım?",
      "Hayır. Kamuda hizmet akdiyle çalışan işçiler 4/a'dır. 657 sayılı Kanun'un 4/C maddesine göre çalışan geçici personel de 4/a hükümlerine " +
      "tabidir (5510 m.4/2-f). 4/c, kadrolu memurlar ile 4/B sözleşmeli personeli kapsar."]
  ];
  return s.map(function (q) { return "<h3>" + esc(q[0]) + "</h3>\n<p>" + esc(q[1]) + "</p>"; }).join("\n");
}

/* ------------------------------------------------ yerleştirme */

function blok(html, ad, icerik) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = html.indexOf(bas), j = html.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + ad);
  return html.slice(0, i + bas.length) + "\n" + icerik + "\n" + html.slice(j);
}
function duz(x) { return x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim(); }
function sssLd(html) {
  var i = html.indexOf("<!-- SSS:BASLANGIC -->"), j = html.indexOf("<!-- SSS:BITIS -->", i);
  var parca = html.slice(i, j), faq = [], re = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, x;
  while ((x = re.exec(parca))) faq.push({ "@type": "Question", name: duz(x[1]), acceptedAnswer: { "@type": "Answer", text: duz(x[2]) } });
  var ac = '<script type="application/ld+json">';
  var a = html.indexOf(ac), b = html.indexOf("</script>", a);
  var ld = JSON.parse(html.slice(a + ac.length, b));
  ld["@graph"].forEach(function (n) { if (n["@type"] === "FAQPage") n.mainEntity = faq; });
  return html.slice(0, a + ac.length) + "\n" + JSON.stringify(ld, null, 2).split("\n").map(function (s) { return "  " + s; }).join("\n") + "\n  " + html.slice(b);
}

/* Açılış paragrafı: soruyu ilk cümlede cevaplar, sayılar motordan. */
function ozet() {
  var a = birlesik("4a").filter(function (d) { return d.donem.kod === "yeni"; })[0].yollar[0].kosullar;
  var b = birlesik("4b").filter(function (d) { return d.donem.kod === "yeni"; })[0].yollar[0].kosullar;
  function gun(k) { return k.filter(function (x) { return x.tur === "gun"; })[0].metin; }
  return '<p class="lede">Hangi statüde olduğunuzu unvanınız değil <strong>çalışma biçiminiz</strong> belirler: bir işverene bağlı ücretli ' +
    "çalışan 4/a, kendi adına çalışan 4/b, kamuda kadrolu ya da sözleşmeli çalışan 4/c'dir. Emeklilik şartı statüye ve ilk sigortalılık " +
    "tarihine göre değişir: 2008 sonrası girenlerde 4/a " + esc(gun(a)) + ", 4/b ve 4/c " + esc(gun(b)) + " ister.</p>";
}

function uret(html) {
  html = blok(html, "STATU-OZET", ozet());
  html = blok(html, "STATU-SERIT", serit());
  html = blok(html, "STATU-TABLO", tablo());
  html = blok(html, "STATU-DETAY", detay());
  html = blok(html, "SSS", sssBlok());
  return sssLd(html);
}

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var eski = fs.readFileSync(SAYFA, "utf8"), yeni = uret(eski);
  if (kontrol) {
    if (yeni !== eski) { console.log("Statü sayfası güncel değil: node tools/statu-sayfa.js"); return 1; }
    console.log("Statü sayfası güncel.");
    return 0;
  }
  if (yeni !== eski) { fs.writeFileSync(SAYFA, yeni, "utf8"); console.log("sigortalilik-statuleri/index.html güncellendi."); }
  else console.log("Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { birlesik: birlesik, kisaOzet: kisaOzet };
