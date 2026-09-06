#!/usr/bin/env node
/*
 * bordro/index.html içindeki parametre tablolarını bordro/parametreler.js'ten üretir.
 *
 * Neden: parametre tablosunun SEO için statik HTML olması gerekiyor, ama elle
 * yazılırsa motorla sapar. Bu script tek doğruluk kaynağını okuyup işaretçiler
 * arasını yeniden yazar.
 *
 * İki ayrı tablo üretilir: uzun tarife metni tek bir hücreye sığmadığı ve tabloyu
 * yatay kaydırmaya zorladığı için asgari ücret/SGK sınırlarından ayrıldı.
 *
 * Kullanım:
 *   node tools/bordro-tablo.js          # tabloları güncelle
 *   node tools/bordro-tablo.js --check  # güncel mi diye bak, yazma (CI için)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var SAYFA = path.join(KOK, "bordro", "index.html");
var BAS = "<!-- PARAMETRE-TABLOSU:BASLANGIC -->";
var BIT = "<!-- PARAMETRE-TABLOSU:BITIS -->";

var MAKALE_SAYFA = path.join(KOK, "makaleler", "maasim-neden-dustu", "index.html");
var OBAS = "<!-- ORNEK-BORDRO:BASLANGIC -->";
var OBIT = "<!-- ORNEK-BORDRO:BITIS -->";
var GBAS = "<!-- DILIM-GECIS:BASLANGIC -->";
var GBIT = "<!-- DILIM-GECIS:BITIS -->";

/* Makaledeki örnek bordro bu brüt ücret üzerinden anlatılıyor.
   Değiştirilirse yazıdaki rakamlar da elden geçirilmeli. */
var ORNEK_BRUT = 80000;
var GECIS_BRUTLERI = [40000, 50000, 60000, 75000, 100000, 150000, 200000, 300000];

var SAHIS_SAYFA = path.join(KOK, "makaleler", "sahis-mi-limited-mi", "index.html");
var KBAS = "<!-- KARSILASTIRMA-TABLOSU:BASLANGIC -->";
var KBIT = "<!-- KARSILASTIRMA-TABLOSU:BITIS -->";
var RBAS = "<!-- KIRILIM-TABLOSU:BASLANGIC -->";
var RBIT = "<!-- KIRILIM-TABLOSU:BITIS -->";

var ASGARI_SAYFA = path.join(KOK, "makaleler", "asgari-ucret-nasil-belirlenir", "index.html");
var IBAS = "<!-- ISTISNA-TABLOSU:BASLANGIC -->";
var IBIT = "<!-- ISTISNA-TABLOSU:BITIS -->";
var YBAS = "<!-- ISTISNA-YILLAR:BASLANGIC -->";
var YBIT = "<!-- ISTISNA-YILLAR:BITIS -->";

/* Makale senaryolari: yillik gider sabit tutulup gelir taraniyor. */
var KARSILASTIRMA_GIDER = 200000;
var KARSILASTIRMA_GELIRLER = [600000, 1200000, 2000000, 3000000, 5000000, 8000000];
var ISTISNA_BRUTLERI = [35000, 50000, 80000, 120000, 200000, 400000];

var SAHIS_SAYFA = path.join(KOK, "makaleler", "sahis-mi-limited-mi", "index.html");
var KBAS = "<!-- KARSILASTIRMA-TABLOSU:BASLANGIC -->";
var KBIT = "<!-- KARSILASTIRMA-TABLOSU:BITIS -->";
var RBAS = "<!-- KIRILIM-TABLOSU:BASLANGIC -->";
var RBIT = "<!-- KIRILIM-TABLOSU:BITIS -->";

var ASGARI_SAYFA = path.join(KOK, "makaleler", "asgari-ucret-nasil-belirlenir", "index.html");
var IBAS = "<!-- ISTISNA-TABLOSU:BASLANGIC -->";
var IBIT = "<!-- ISTISNA-TABLOSU:BITIS -->";
var YBAS = "<!-- ISTISNA-YILLAR:BASLANGIC -->";
var YBIT = "<!-- ISTISNA-YILLAR:BITIS -->";

/* Makale senaryolari: yillik gider sabit tutulup gelir taraniyor. */
var KARSILASTIRMA_GIDER = 200000;
var KARSILASTIRMA_GELIRLER = [600000, 1200000, 2000000, 3000000, 5000000, 8000000];
var ISTISNA_BRUTLERI = [35000, 50000, 80000, 120000, 200000, 400000];

var MATRIS_SAYFA = path.join(KOK, "isten-ayrilma-hesaplama", "index.html");
var MBAS = "<!-- HAK-MATRISI:BASLANGIC -->";
var MBIT = "<!-- HAK-MATRISI:BITIS -->";

var B = require(path.join(KOK, "bordro", "motor.js"));
var C = require(path.join(KOK, "bordro", "cikis.js"));
var CB = require(path.join(KOK, "bordro", "calisma-bicimi.js"));
var CB = require(path.join(KOK, "bordro", "calisma-bicimi.js"));

var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl(n) { return nf.format(n); }
function tam(n) { return nf0.format(n); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Ay adı + Türkçe ayrılma hâli eki (ünlü uyumu ve ünsüz benzeşmesiyle).
var AYLAR = ["Ocak'tan", "Şubat'tan", "Mart'tan", "Nisan'dan", "Mayıs'tan", "Haziran'dan",
  "Temmuz'dan", "Ağustos'tan", "Eylül'den", "Ekim'den", "Kasım'dan", "Aralık'tan"];

function sinirSatirlari() {
  return B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return P.donemler.map(function (d) {
      var donemAdi = P.donemler.length > 1
        ? yil + " · " + AYLAR[d.ay - 1] + " itibaren"
        : String(yil);
      return "            <tr>" +
        '<th scope="row">' + donemAdi + "</th>" +
        "<td>" + tl(d.asgariBrut) + "</td>" +
        "<td>" + tl(d.asgariNet) + "</td>" +
        "<td>" + tl(d.sgkTavan) + "</td>" +
        "<td>" + (P.istisnaRejimi === "agi" ? "AGİ" : "Asgari ücret istisnası") + "</td>" +
        "<td>" + (P.damgaIstisnasi ? "asgari ücreti aşan kısım" : "brütün tamamı") + "</td>" +
        "</tr>";
    }).join("\n");
  }).join("\n");
}

function tarifeSatirlari() {
  return B.yillar().map(function (yil) {
    var hucreler = B.parametre(yil).dilimler.map(function (d) {
      return "<td>" + (d[0] === null ? "üzeri" : tam(d[0])) + "</td>";
    }).join("");
    return '            <tr><th scope="row">' + yil + "</th>" + hucreler + "</tr>";
  }).join("\n");
}

function tarifeBasliklari() {
  return B.parametre(B.sonYil()).dilimler.map(function (d) {
    return '              <th scope="col">%' + Math.round(d[1] * 100) + "</th>";
  }).join("\n");
}

function dayanaklar() {
  return B.yillar().map(function (yil) {
    var P = B.parametre(yil);
    return "          <dt>" + yil + "</dt>\n          <dd>" + esc(P.dayanak) +
      (P.notlar ? " — " + esc(P.notlar) : "") + "</dd>";
  }).join("\n");
}

function uret() {
  var o = B.parametre(B.sonYil()).oranlar;

  return [
    BAS,
    "        <h3>Asgari ücret, SGK sınırları ve istisna rejimi</h3>",
    '        <div class="table-scroll">',
    '          <table class="payroll param-table param-limits">',
    '            <caption class="visually-hidden">2020-2026 asgari ücret, SGK prim tavanı ve istisna rejimi</caption>',
    "            <thead><tr>",
    '              <th scope="col">Dönem</th>',
    '              <th scope="col">Asgari ücret (brüt)</th>',
    '              <th scope="col">Asgari ücret (net)</th>',
    '              <th scope="col">SGK prim tavanı</th>',
    '              <th scope="col">İstisna rejimi</th>',
    '              <th scope="col">Damga vergisi tabanı</th>',
    "            </tr></thead>",
    "            <tbody>",
    sinirSatirlari(),
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Tutarlar aylık ve TL cinsindendir. Tüm yıllarda kesinti oranları sabittir:",
    "          SGK işçi payı %" + Math.round(o.sgkIsci * 100) +
      ", işsizlik sigortası işçi payı %" + Math.round(o.issizlikIsci * 100) + ",",
    "          damga vergisi binde " + (o.damga * 1000).toFixed(2).replace(".", ",") + ",",
    "          işveren SGK payı %" + (o.sgkIsveren * 100).toFixed(2).replace(".", ",") +
      " ve işveren işsizlik payı %" + Math.round(o.issizlikIsveren * 100) + " (teşviksiz).",
    "        </p>",
    "",
    "        <h3>Gelir vergisi tarifesi (ücret gelirleri)</h3>",
    '        <div class="table-scroll">',
    '          <table class="payroll param-table param-rates">',
    '            <caption class="visually-hidden">2020-2026 ücret gelirleri gelir vergisi tarifesi</caption>',
    "            <thead><tr>",
    '              <th scope="col">Yıl</th>',
    tarifeBasliklari(),
    "            </tr></thead>",
    "            <tbody>",
    tarifeSatirlari(),
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Sütun başlıkları vergi oranını, hücrelerdeki tutarlar o dilimin",
    "          <strong>üst sınırını</strong> gösterir (TL). Son sütun, o sınırın üzerinde kalan",
    "          matraha uygulanan orandır. Tarife, yıl içinde biriken kümülatif matraha uygulanır.",
    "        </p>",
    "",
    "        <h3>Yıl bazında yasal dayanak</h3>",
    '        <dl class="changelog">',
    dayanaklar(),
    "        </dl>",
    "        " + BIT
  ].join("\n");
}

/* Fesih türü / hak matrisi — bordro/cikis.js içindeki FESIH_TURLERI tablosundan.
   Sayfadaki görünür matris ile hesabın kullandığı matris aynı kaynaktan gelir. */
function hakHucresi(v) {
  if (v === true) return '<td class="yes">Var</td>';
  if (v === false) return '<td class="no">Yok</td>';
  return '<td class="maybe">Sözleşmeye bağlı</td>';
}

function uretMatris() {
  var satirlar = C.FESIH_TURLERI.map(function (t) {
    return "            <tr>" +
      '<th scope="row">' + esc(t.kisa) + "</th>" +
      hakHucresi(t.kidem) +
      hakHucresi(t.ihbar) +
      hakHucresi(t.issizlik) +
      "<td>" + esc(t.dayanak) + "</td>" +
      "</tr>";
  }).join("\n");

  return [
    MBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll matris">',
    '            <caption class="visually-hidden">Fesih türüne göre kıdem, ihbar ve işsizlik ödeneği hakları</caption>',
    "            <thead><tr>",
    '              <th scope="col">Sözleşme nasıl sona erdi?</th>',
    '              <th scope="col">Kıdem tazminatı</th>',
    '              <th scope="col">İhbar tazminatı</th>',
    '              <th scope="col">İşsizlik ödeneği</th>',
    '              <th scope="col">Yasal dayanak</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          &ldquo;İhbar tazminatı&rdquo; sütunu <strong>işçiye ödenip ödenmediğini</strong> gösterir.",
    "          İstifada işçinin kendisi ihbar süresine uymazsa işverene ihbar tazminatı ödemek",
    "          durumunda kalabilir. Kıdem tazminatı için ayrıca en az bir yıl çalışmış olmak şarttır.",
    "        </p>",
    "        " + MBIT
  ].join("\n");
}

/* Makale: 80.000 TL brütte 12 aylık bordro. Yazının merkezindeki "Temmuz'da dip,
   Ağustos'ta yükseliş" anlatısı bu tablodan okunuyor; elle yazılırsa motorla sapar. */
function uretOrnekBordro() {
  var y = B.hesaplaYil(ORNEK_BRUT, B.sonYil());
  var enDusuk = y.aylar.reduce(function (a, b) { return b.net < a.net ? b : a; });

  var satirlar = y.aylar.map(function (a, i) {
    var yukseldi = i > 0 && a.net > y.aylar[i - 1].net + 0.01;
    var sinif = yukseldi ? " class=\"net-up\"" : (a.dilimGecisi ? " class=\"bracket-jump\"" : "");
    return "            <tr" + sinif + ">" +
      "<th scope=\"row\">" + a.ayAdi +
        (a.dilimGecisi ? " <span class=\"jump-flag\" title=\"Üst vergi dilimine geçildi\">▲</span>" : "") +
        (yukseldi ? " <span class=\"up-flag\" title=\"Net bu ay yükseldi\">▲</span>" : "") +
      "</th>" +
      "<td>" + tl(a.matrah) + "</td>" +
      "<td>" + tl(a.kumulatifMatrah) + "</td>" +
      "<td>%" + Math.round(a.dilim * 100) + "</td>" +
      "<td>" + tl(a.istisna) + "</td>" +
      "<td>" + tl(a.gelirVergisi) + "</td>" +
      "<td><strong>" + tl(a.net) + "</strong></td>" +
      "</tr>";
  }).join("\n");

  return [
    OBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-bordro">',
    '            <caption class="visually-hidden">' + ORNEK_BRUT.toLocaleString("tr-TR") +
      " TL brüt ücretin " + B.sonYil() + " yılı 12 aylık bordrosu</caption>",
    "            <thead><tr>",
    '              <th scope="col">Ay</th>',
    '              <th scope="col">Aylık matrah</th>',
    '              <th scope="col">Kümülatif matrah</th>',
    '              <th scope="col">Dilim</th>',
    '              <th scope="col">İstisna</th>',
    '              <th scope="col">Ödenen gelir vergisi</th>',
    '              <th scope="col">Net maaş</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Tutarlar TL. ▲ işaretli satırlar dilim geçişini ve netin yükseldiği ayı gösterir.",
    "          Ocak neti " + tl(y.aylar[0].net) + " TL, en düşük ay " + enDusuk.ayAdi + " (" +
      tl(enDusuk.net) + " TL), Aralık neti " + tl(y.aylar[11].net) + " TL.",
    "          Ocak ile Aralık arasındaki fark <strong>" + tl(y.aylar[0].net - y.aylar[11].net) +
      " TL</strong>; 12 aylık ortalama net " + tl(y.toplam.ortalamaNet) + " TL.",
    "        </p>",
    "        " + OBIT
  ].join("\n");
}

/* Makale: hangi brütte hangi ayda dilim atlanıyor. */
function uretDilimGecis() {
  var satirlar = GECIS_BRUTLERI.map(function (brut) {
    var aylar = B.hesaplaYil(brut, B.sonYil()).aylar;
    var gecisler = aylar.filter(function (a) { return a.dilimGecisi; });
    var hucre = gecisler.length
      ? gecisler.map(function (a) { return a.ayAdi + " → %" + Math.round(a.dilim * 100); }).join("<br>")
      : "Yıl boyunca aynı dilimde";
    return "            <tr><th scope=\"row\">" + tam(brut) + " TL</th>" +
      "<td>" + hucre + "</td>" +
      "<td>" + tl(aylar[0].net) + "</td>" +
      "<td>" + tl(aylar[11].net) + "</td>" +
      "<td>" + tl(aylar[0].net - aylar[11].net) + "</td></tr>";
  }).join("\n");

  return [
    GBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-gecis">',
    '            <caption class="visually-hidden">Brüt ücrete göre vergi dilimi geçiş ayları</caption>',
    "            <thead><tr>",
    '              <th scope="col">Aylık brüt ücret</th>',
    '              <th scope="col">Dilim geçişleri</th>',
    '              <th scope="col">Ocak neti</th>',
    '              <th scope="col">Aralık neti</th>',
    '              <th scope="col">Fark</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    "        " + GBIT
  ].join("\n");
}

/* İşler dosya bazında biriktirilir. Aynı dosyada birden fazla işaretçi bölgesi
   olabildiği için (makale sayfasında iki tablo var), her iş bir öncekinin
   sonucunu girdi alır; yoksa ikinci yazma birincisini eziyordu. */
/* Makale: calisma bicimi karsilastirmasi. */
function uretKarsilastirma() {
  var satirlar = KARSILASTIRMA_GELIRLER.map(function (m) {
    var r = CB.karsilastir({ yillikMaliyet: m, yillikGider: KARSILASTIRMA_GIDER, ihracatOrani: 0 });
    var h = {};
    r.senaryolar.forEach(function (x) { h[x.kod] = x; });
    function hucre(kod) {
      var x = h[kod];
      return "<td" + (x.enIyi ? ' class=\"net-up\"' : "") + ">" + tam(x.net) +
        (x.enIyi ? ' <span class=\"up-flag\" title=\"Bu gelirde en yuksek net\">\u25B2</span>' : "") + "</td>";
    }
    return "            <tr><th scope=\"row\">" + tam(m) + "</th>" +
      hucre("calisan") + hucre("sahis") + hucre("limited") + hucre("limitedUcret") + "</tr>";
  }).join("\n");

  return [
    KBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-karsilastirma">',
    '            <caption class="visually-hidden">Yillik toplam maliyete gore dort calisma biciminde elde kalan net</caption>',
    "            <thead><tr>",
    '              <th scope="col">Yıllık toplam maliyet</th>',
    '              <th scope="col">Maaşlı çalışan</th>',
    '              <th scope="col">Şahıs işletmesi</th>',
    '              <th scope="col">Limited (kâr payı)</th>',
    '              <th scope="col">Limited (ücret + kâr payı)</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Tutarlar yıllık ve TL. Karşı tarafın katlandığı toplam maliyet sabit tutulmuştur;",
    "          yıllık gider " + tam(KARSILASTIRMA_GIDER) + " TL, hizmet ihracatı yok.",
    "          \u25B2 o gelir düzeyinde elde en çok parayı bırakan seçenektir.",
    "        </p>",
    "        " + KBIT
  ].join("\n");
}

/* Makale: kazananin el degistirdigi noktalar — 100.000 TL adimlarla taranir. */
function uretKirilim() {
  var satirlar = [], onceki = null;
  for (var m = 400000; m <= 12000000; m += 100000) {
    var r = CB.karsilastir({ yillikMaliyet: m, yillikGider: KARSILASTIRMA_GIDER, ihracatOrani: 0 });
    if (r.enIyi.kisa === onceki) continue;
    var ikinci = r.senaryolar.slice().sort(function (a, b) { return b.net - a.net; })[1];
    var fark = (r.enIyi.net - ikinci.net) / r.enIyi.net * 100;
    satirlar.push("            <tr><th scope=\"row\">" + tam(m) + " TL</th>" +
      "<td>" + esc(r.enIyi.kisa) + "</td>" +
      "<td>" + esc(ikinci.kisa) + "</td>" +
      "<td>%" + fark.toFixed(2) + "</td></tr>");
    onceki = r.enIyi.kisa;
  }
  return [
    RBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-kirilim">',
    '            <caption class="visually-hidden">Kazanan calisma biciminin degistigi gelir duzeyleri</caption>',
    "            <thead><tr>",
    '              <th scope="col">Bu gelirden itibaren</th>',
    '              <th scope="col">Kazanan</th>',
    '              <th scope="col">İkinci sıradaki</th>',
    '              <th scope="col">Aradaki fark</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar.join("\n"),
    "            </tbody>",
    "          </table>",
    "        </div>",
    '        <p class="muted-note">',
    "          Yıllık gider " + tam(KARSILASTIRMA_GIDER) + " TL, hizmet ihracatı yok, 100.000 TL",
    "          adımlarla tarandı. Fark küçüldükçe seçim vergiyle açıklanamaz hâle gelir.",
    "        </p>",
    "        " + RBIT
  ].join("\n");
}

/* Makale: ayni yilda farkli brutlerde yillik istisna kazanci (hepsi ayni cikar). */
function uretIstisna() {
  var yil = B.sonYil();
  var satirlar = ISTISNA_BRUTLERI.map(function (b) {
    var t = B.hesaplaYil(b, yil).toplam;
    return "            <tr><th scope=\"row\">" + tl(b) + "</th><td>" + tl(t.istisna) + "</td></tr>";
  }).join("\n");
  return [
    IBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-istisna">',
    '            <caption class="visually-hidden">' + yil + ' yilinda brut ucrete gore yillik asgari ucret istisnasi</caption>',
    "            <thead><tr>",
    '              <th scope="col">Aylık brüt ücret</th>',
    '              <th scope="col">Yıllık istisna kazancı</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    "        " + IBIT
  ].join("\n");
}

/* Makale: istisnanin yillar icindeki buyumesi. */
function uretIstisnaYillar() {
  var satirlar = B.yillar().filter(function (y) {
    return B.parametre(y).istisnaRejimi === "asgari-ucret";
  }).sort().map(function (y) {
    var P = B.parametre(y);
    var d = P.donemler[P.donemler.length - 1];
    var t = B.hesaplaYil(d.asgariBrut * 6, y).toplam;
    return "            <tr><th scope=\"row\">" + y + "</th>" +
      "<td>" + tl(d.asgariBrut) + "</td>" +
      "<td>" + tl(t.istisna) + "</td></tr>";
  }).join("\n");
  return [
    YBAS,
    '        <div class="table-scroll">',
    '          <table class="payroll makale-istisna-yillar">',
    '            <caption class="visually-hidden">Yillara gore brut asgari ucret ve yillik istisna kazanci</caption>',
    "            <thead><tr>",
    '              <th scope="col">Yıl</th>',
    '              <th scope="col">Brüt asgari ücret</th>',
    '              <th scope="col">Yıllık istisna kazancı</th>',
    "            </tr></thead>",
    "            <tbody>",
    satirlar,
    "            </tbody>",
    "          </table>",
    "        </div>",
    "        " + YBIT
  ].join("\n");
}

function uygula(icerik, bas, bit, uretici, ad) {
  var i = icerik.indexOf(bas), j = icerik.indexOf(bit);
  if (i === -1 || j === -1) {
    console.error("İşaretçiler bulunamadı (" + ad + "): " + bas + " / " + bit);
    process.exit(2);
  }
  return icerik.slice(0, i) + uretici() + icerik.slice(j + bit.length);
}

function main() {
  var isler = [
    { dosya: SAYFA, bas: BAS, bit: BIT, uretici: uret, ad: "parametre tabloları" },
    { dosya: MATRIS_SAYFA, bas: MBAS, bit: MBIT, uretici: uretMatris, ad: "hak matrisi" },
    { dosya: MAKALE_SAYFA, bas: OBAS, bit: OBIT, uretici: uretOrnekBordro, ad: "makale örnek bordrosu" },
    { dosya: MAKALE_SAYFA, bas: GBAS, bit: GBIT, uretici: uretDilimGecis, ad: "makale dilim geçiş tablosu" },
    { dosya: SAHIS_SAYFA, bas: KBAS, bit: KBIT, uretici: uretKarsilastirma, ad: "çalışma biçimi karşılaştırması" },
    { dosya: SAHIS_SAYFA, bas: RBAS, bit: RBIT, uretici: uretKirilim, ad: "kırılım tablosu" },
    { dosya: ASGARI_SAYFA, bas: IBAS, bit: IBIT, uretici: uretIstisna, ad: "istisna tablosu" },
    { dosya: ASGARI_SAYFA, bas: YBAS, bit: YBIT, uretici: uretIstisnaYillar, ad: "istisna yıllar tablosu" }
  ];

  var asil = {}, guncel = {}, degisenAdlar = [];
  isler.forEach(function (x) {
    if (!(x.dosya in asil)) {
      asil[x.dosya] = fs.readFileSync(x.dosya, "utf8");
      guncel[x.dosya] = asil[x.dosya];
    }
    var once = guncel[x.dosya];
    guncel[x.dosya] = uygula(once, x.bas, x.bit, x.uretici, x.ad);
    if (guncel[x.dosya] !== once) degisenAdlar.push(x.ad);
  });

  var degisenDosyalar = Object.keys(asil).filter(function (d) { return guncel[d] !== asil[d]; });

  if (process.argv.indexOf("--check") !== -1) {
    if (!degisenAdlar.length) { console.log("Üretilen tablolar güncel."); process.exit(0); }
    console.error("Güncel değil (" + degisenAdlar.join(", ") +
      ") — 'node tools/bordro-tablo.js' çalıştırın.");
    process.exit(1);
  }

  if (!degisenDosyalar.length) { console.log("Değişiklik yok."); return; }
  degisenDosyalar.forEach(function (d) {
    fs.writeFileSync(d, guncel[d], "utf8");
    console.log(path.relative(KOK, d) + " güncellendi.");
  });
}

main();
