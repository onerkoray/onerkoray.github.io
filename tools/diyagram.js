#!/usr/bin/env node
/*
 * Açıklayıcı diyagramları üretir ve sayfalara yerleştirir.
 *
 * NEDEN ÜRETİLİYOR, ÇİZİLMİYOR
 * ----------------------------
 * Elle çizilmiş bir mimari şeması ilk gün doğrudur, altıncı ay yanlıştır:
 * motora yeni bir parametre girer, yeni bir araç eklenir, test sayısı değişir
 * ve şema sessizce yalan söylemeye başlar. Buradaki diyagramların içeriği
 * motorun ve deponun KENDİSİNDEN okunur — sürüm, parametre grupları, motoru
 * kullanan araçlar, test sayıları. Bir şey değişirse `--check` CI'da patlar.
 *
 * Bordro ekosistemi erişilebilir HTML kartlarıyla üretilir. SVG yalnızca
 * dekoratif bağlantıları ve mevcut ikonları çizer; metin mobilde yeniden akar.
 * Hareket ve etkileşim bordro/diyagram.css ile bordro/diyagram.js içindedir.
 * JavaScript olmadan da bütün içerik ve araç bağlantıları kullanılabilir.
 *
 * Kullanım:
 *   node tools/diyagram.js           # diyagramları üret ve yerleştir
 *   node tools/diyagram.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var B = require(path.join(KOK, "bordro", "motor.js"));
var C = require(path.join(KOK, "bordro", "cikis.js"));
var E = require("./bordro-envanter.js");
var ARACLAR = E.araclar();
var TESTLER = E.testler();

function oku(p) { return fs.readFileSync(path.join(KOK, p), "utf8"); }

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Test sayıları doğrudan test dosyalarındaki ok() çağrılarından değil,
   çalıştırılmadan sayılamaz; bu yüzden çıktıdaki toplam satırdan okunur. */
function testSayisi() {
  return TESTLER.reduce(function (n, t) { return n + t.sayi; }, 0);
}

/* Motoru fiilen kullanan araçlar — metodoloji künyesiyle aynı kaynak. */
function motorluAraclar() {
  return ARACLAR.filter(function (a) { return a.cekirdek; }).map(function (a) { return a.slug; });
}

var ARAC_ADI = {
  "maas-hesaplama": "Brüt–net maaş",
  "isten-ayrilma-hesaplama": "İşten ayrılma paketi",
  "kidem-tazminati-hesaplama": "Kıdem ve ihbar",
  "issizlik-maasi-hesaplama": "İşsizlik maaşı",
  "serbest-meslek-makbuzu-hesaplama": "Serbest meslek makbuzu",
  "calisma-bicimi-karsilastirma": "Çalışma biçimi",
  "isveren-maliyeti-hesaplama": "İşveren maliyeti",
  "fazla-mesai-hesaplama": "Fazla mesai",
  "beyanname-hesaplama": "Yıllık beyanname",
  "cikis-takvimi": "Çıkış takvimi",
  "finansal-ikiz": "Finansal ikiz",
  "kira-geliri-vergisi-hesaplama": "Kira geliri vergisi",
  "nakit-akisi-analizi": "Nakit akışı",
  "prim-ikramiye-vergisi": "Prim ve ikramiye",
  "ucret-kar-payi-optimizasyonu": "Ücret / kâr payı",
  "vergi-kamasi-hesaplama": "Vergi kaması",
  "zam-hesaplama": "Zam hesabı"
};

/* card-icons.json'daki 24x24 ikonun iç içeriği. */
function ikonIc(svg) {
  if (!svg) return "";
  return String(svg).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

/* Dal ve parametre yaprakları için küçük çizimler (24x24, stroke tabanlı). */
var GLIF = {
  tarife: '<path d="M4 19h16"/><path d="M7 19V9"/><path d="M12 19V5"/><path d="M17 19v-7"/>',
  asgari: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9h5"/><path d="M12 9v7"/><path d="M9.5 12.5h5"/>',
  sgk: '<path d="M12 3 5 6v5.5c0 4.3 3 8.2 7 9.5 4-1.3 7-5.2 7-9.5V6z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
  kidem: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3 12h18"/>',
  issizlik: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bordro: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  nettenBrute: '<path d="M4 8h12l-3-3"/><path d="M20 16H8l3 3"/>',
  cikis: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  senaryo: '<path d="M12 3v18"/><path d="M5 8h14"/><path d="m5 8-2 6h4z"/><path d="m19 8-2 6h4z"/>',
  test: '<path d="m9 3 .5 7.5L4.5 19a1.6 1.6 0 0 0 1.4 2.4h12.2A1.6 1.6 0 0 0 19.5 19l-5-8.5L15 3"/><path d="M8.5 3h7"/>',
  kopya: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
  tablo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  denetim: '<path d="M12 3 5 6v5.5c0 4.3 3 8.2 7 9.5 4-1.3 7-5.2 7-9.5V6z"/><path d="M9 12.5l2 2 4-4"/>'
};

function ikonHTML(ic) {
  return '<svg class="bm-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' + ic + '</svg>';
}

function agac(baslik, aciklama, merkez, merkezAlt, dallar) {
  var kimlik = ["parametreler", "hesaplar", "araclar", "denetim"];
  var aciklamalar = ["Hesabın yasal girdileri", "Kuralları sonuca dönüştürür", "Aynı çekirdeği kullanır", "Tutarlılığı doğrular"];
  var links = ["#parametreler", "#metodoloji", null, "#dogrulama"];
  // İlk sıradaki üç kartın merkezleri; araçlar aşağıdaki ortak çıkışta yer alır.
  var yollar = [166.667, 500, 833.333].map(function (x, i) {
    var d = x === 500 ? 'M500 0 V64' :
      'M500 0 V16 Q500 30 ' + (x < 500 ? 480 : 520) + ' 30 H' + (x < 500 ? x + 16 : x - 16) + ' Q' + x + ' 30 ' + x + ' 46 V64';
    return '<g data-wire="' + kimlik[[0, 1, 3][i]] + '"><path class="bm-wire" d="' + d + '"/>' +
      '<path class="bm-signal" pathLength="100" d="' + d + '"/></g>';
  }).join('');
  var kartlar = [0, 1, 3, 2].map(function (i) {
    var dal = dallar[i];
    var items = dal.yapraklar.map(function (yp) {
      var content = ikonHTML(yp.ikon || '') + '<span><strong>' + esc(yp.ad) + '</strong>' +
        (yp.alt ? '<small>' + esc(yp.alt) + '</small>' : '') + '</span>';
      return '<li>' + (yp.href ? '<a href="' + yp.href + '">' + content + '<span class="bm-arrow" aria-hidden="true">↗</span></a>' : '<div class="bm-leaf">' + content + '</div>') + '</li>';
    }).join('');
    return '<section class="bm-group" data-group="' + kimlik[i] + '" aria-labelledby="bm-' + kimlik[i] + '">' +
      '<div class="bm-group-head"><span class="bm-group-icon">' + ikonHTML(GLIF[dal.glif]) + '</span>' +
      '<div><h3 id="bm-' + kimlik[i] + '">' + esc(dal.ad) + '</h3><p>' + aciklamalar[i] + '</p></div>' +
      '<span class="bm-count" aria-label="' + dal.yapraklar.length + ' bileşen">' + dal.yapraklar.length + '</span></div>' +
      '<ul class="bm-items">' + items + '</ul>' +
      (links[i] ? '<a class="bm-more" href="' + links[i] + '">' + ["Parametreleri incele", "Hesap yöntemini oku", "", "Denetimleri gör"][i] + ' <span aria-hidden="true">→</span></a>' : '<p class="bm-note">Bir aracı seçerek hesabı açın.</p>') + '</section>';
  }).join('\n');
  return '<div class="bm-map" data-motion="off" aria-label="' + esc(baslik) + '">\n' +
    '<div class="bm-toolbar"><span class="bm-caption">AÇIK KAYNAK · BİLEŞEN HARİTASI</span>' +
    '<button class="bm-motion" type="button" hidden>Animasyonu durdur</button></div>\n' +
    '<p class="visually-hidden">' + esc(aciklama) + '</p>' +
    '<div class="bm-core"><div class="bm-core-emblem" aria-hidden="true">' +
      ikonHTML('<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>') + '</div>' +
      '<div><p class="bm-core-label">ORTAK HESAP ÇEKİRDEĞİ</p><h3>' + esc(merkez) + '</h3><p class="bm-core-meta">' + esc(merkezAlt) + '</p></div>' +
      '<span class="bm-core-tag">Bağımlılıksız JavaScript</span></div>\n' +
    '<svg class="bm-wires" viewBox="0 0 1000 64" width="1000" height="64" preserveAspectRatio="none" aria-hidden="true">' + yollar + '</svg>\n' +
    '<div class="bm-groups">' + kartlar + '</div>\n</div>';
}

/* ---------------- diyagramlar ---------------- */

function motorEkosistemi() {
  var yillar = B.yillar().slice().sort();
  var araclar = motorluAraclar();
  var testler = testSayisi();
  var ikonlar = JSON.parse(oku("tools/card-icons.json"));

  function aracIkon(slug) {
    return ikonlar[slug] ? ikonIc(ikonlar[slug].svg) : "";
  }

  var dallar = [
    {
      ad: "Parametreler",
      glif: "bordro",
      yapraklar: [
        { ad: "Gelir vergisi tarifesi", alt: "GVK m.103 · ücret ve ücret dışı", ikon: GLIF.tarife },
        { ad: "Asgari ücret ve istisna", alt: "GVK m.23/1-(18) · yıl içi dönemler dahil", ikon: GLIF.asgari },
        { ad: "Prime esas kazanç", alt: "5510 m.82 · alt ve üst sınır", ikon: GLIF.sgk },
        { ad: "Kıdem tazminatı tavanı", alt: "1475 m.14 · altı aylık dönem", ikon: GLIF.kidem },
        { ad: "İşsizlik ve fazla mesai", alt: "4447 m.50 · 4857 m.41", ikon: GLIF.issizlik },
        { ad: "Kira ve beyanname", alt: "istisnalar, beyan hadleri ve indirimler", ikon: GLIF.tarife },
        { ad: "Şirket ve serbest meslek", alt: "kurumlar vergisi, stopaj ve Bağ-Kur", ikon: GLIF.senaryo }
      ]
    },
    {
      ad: "Hesaplar",
      glif: "nettenBrute",
      yapraklar: [
        { ad: "Aylık ve 12 aylık bordro", alt: "kümülatif matrah takibi", ikon: GLIF.bordro },
        { ad: "Netten brüte", alt: "tek ay ve net sözleşme için 12 ay", ikon: GLIF.nettenBrute },
        { ad: "Çıkış paketi", alt: C.FESIH_TURLERI.length + " fesih türü · hak matrisi", ikon: GLIF.cikis },
        { ad: "Çalışma biçimi", alt: "aynı maliyette dört senaryo", ikon: GLIF.senaryo },
        { ad: "Prim ve ikramiye", alt: "ek ödemenin yıllık nete etkisi", ikon: GLIF.asgari },
        { ad: "Kira geliri vergisi", alt: "götürü ve gerçek gider karşılaştırması", ikon: GLIF.tarife },
        { ad: "Yıllık beyanname", alt: "çoklu gelir, beyan kararı ve mahsup", ikon: GLIF.bordro }
      ]
    },
    {
      ad: "Araçlar",
      glif: "tablo",
      yapraklar: araclar.map(function (a) {
        return { ad: ARAC_ADI[a] || ARACLAR.find(function (x) { return x.slug === a; }).ad, ikon: aracIkon(a), href: "../" + a + "/" };
      })
    },
    {
      ad: "Denetim",
      glif: "denetim",
      yapraklar: [
        { ad: testler + " doğrulama", alt: TESTLER.length + " test dosyası · bağımsız modüller dahil", ikon: GLIF.test },
        { ad: "Parametre kopyası kontrolü", alt: "yasal sayıların çoğaltılmasını denetler", ikon: GLIF.kopya },
        { ad: "Üretilen tablo ve şema", alt: "sayfa ile motor ayrışamaz", ikon: GLIF.tablo },
        { ad: "Sayfa, CSS ve kontrast", alt: "her push'ta çalışır", ikon: GLIF.denetim }
      ]
    }
  ];

  return agac(
    "Bordro Motoru ekosistemi",
    "Merkezde açık kaynak bordro çekirdeği; ondan çıkan dört dal: yasal " +
      "parametreler, hesap katmanı, motoru kullanan " + araclar.length +
      " araç ve her push'ta çalışan denetimler. " + yillar[0] + "-" +
      yillar[yillar.length - 1] + " arası " + yillar.length + " bordro yılı kapsanıyor.",
    "Bordro Motoru",
    "v" + B.surum + " · " + yillar.length + " yıl · MIT",
    dallar
  );
}

/* ---------------- tek kaynak: tarife ve hatlar ----------------
   Bir giriş (yasal kaynak), bir gövde (motorun tarifesi), çok çıkış (araçlar).
   Işınlar süs değil: her biri motoru fiilen yükleyen bir araca gider ve
   bağlantıdır. Seçilen araçlardan biri motoru bırakırsa üretim durur. */

var PRIZMA_ARACLARI = [
  ["maas-hesaplama", "12 aylık bordro dökümü", null, "ucret"],
  ["isveren-maliyeti-hesaplama", "SGK ve işsizlik işveren payı", null, "ucret"],
  ["fazla-mesai-hesaplama", "4857 m.41 · zamlı saat", null, "ucret"],
  ["bordro-denetim", "bordronuzla farkı ölçer", "Bordro denetimi", "ucret"],
  ["kidem-tazminati-hesaplama", "kıdem tavanı ve damga vergisi", null, "ayrilik"],
  ["issizlik-maasi-hesaplama", "4447 m.50 · prim gün şartı", null, "ayrilik"],
  ["cikis-takvimi", function () { return C.FESIH_TURLERI.length + " fesih türü · çıkış tarihi"; }, null, "ayrilik"],
  ["beyanname-hesaplama", "çoklu gelir ve mahsup", null, "beyan"]
];
// Renk araç ailesini söyler (--dv-1..3, sırası sabit); ad her zaman yazılı.
var AILELER = [["ucret", "Ücret"], ["ayrilik", "Ayrılık"], ["beyan", "Beyan"]];

function tutarKisa(v) {
  if (v >= 1e6) return (v / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " mn";
  return Math.round(v / 1e3) + " bin";
}

function tekKaynak() {
  var yillar = B.yillar().slice().sort();
  var sonYil = yillar[yillar.length - 1];
  var dilimler = B.parametre(Number(sonYil)).dilimler;
  var araclar = motorluAraclar();
  var n = PRIZMA_ARACLARI.length;
  PRIZMA_ARACLARI.forEach(function (p) {
    if (araclar.indexOf(p[0]) === -1) throw new Error("Prizma aracı motoru kullanmıyor: " + p[0]);
  });
  // 640 × 480. Gövde, son yılın gelir vergisi tarifesidir: basamak yüksekliği
  // oran, sıra dilim sırası (eşikler ölçekli değil, altta yazılı).
  var W = 640, H = 480, taban = 400, x0 = 112, bw = 58, olcek = 7.5;
  var basamak = dilimler.map(function (d, i) {
    var h = d[1] * 100 * olcek, x = x0 + i * bw, y = taban - h;
    var oran = "%" + Math.round(d[1] * 100);
    return '<g class="tk-sutun" style="--s:' + i + '">' +
      '<rect class="tk-basamak" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '"/>' +
      '<rect class="tk-gravur" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" fill="url(#tk-tarama-' + i + ')"/>' +
      '<text class="tk-oran" x="' + (x + bw / 2) + '" y="' + (y + 22) + '" text-anchor="middle">' + oran + '</text>' +
      (d[0] ? '<text class="tk-esik" x="' + (x + bw) + '" y="' + (taban + 20) + '" text-anchor="middle">' + tutarKisa(d[0]) + '</text>' +
        '<path class="tk-cetvel" d="M' + (x + bw) + ' ' + taban + ' v6"/>' : '') + '</g>';
  }).join("");
  // Tarama aralığı vergi oranıyla ters orantılı: yük arttıkça gravür koyulaşır.
  var taramalar = dilimler.map(function (d, i) {
    var a = (60 / (d[1] * 100)).toFixed(2);
    return '<pattern id="tk-tarama-' + i + '" width="' + a + '" height="' + a + '" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 0 V' + a + '"/></pattern>';
  }).join("");
  var sag = x0 + dilimler.length * bw;          // tarifenin sağ kenarı
  var cikY = 250, bus = sag + 40, ux = 622;
  var uc = PRIZMA_ARACLARI.map(function (_, i) { return (i + 0.5) * H / n; });
  var hatlar = uc.map(function (y, i) {
    var aile = PRIZMA_ARACLARI[i][3];
    return '<g class="tk-hat tk-' + aile + '" style="--s:' + i + '">' +
      '<path class="tk-isin" data-i="' + i + '" pathLength="100" d="M' + bus + ' ' + y + ' H' + ux + '"/>' +
      '<circle class="tk-dugum" cx="' + bus + '" cy="' + y + '" r="3.5"/>' +
      '<rect class="tk-uc" data-i="' + i + '" x="' + (ux - 6) + '" y="' + (y - 6) + '" width="12" height="12" rx="2"/></g>';
  }).join("");
  var svg =
    '<svg class="tk-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">' +
    '<defs>' + taramalar + '</defs>' +
    // Kaynak: tek sayfalık resmî metin.
    '<path class="tk-belge" d="M24 330 h34 l12 12 v48 h-46 Z"/><path class="tk-belge-kat" d="M58 330 v12 h12"/>' +
    '<path class="tk-belge-satir" d="M32 356 h28 M32 366 h28 M32 376 h18"/>' +
    '<path class="tk-giris" pathLength="100" d="M70 360 H' + x0 + '"/><path class="tk-ok" d="M' + (x0 - 9) + ' 354 l8 6 -8 6"/>' +
    basamak +
    '<path class="tk-taban" d="M' + (x0 - 12) + ' ' + taban + ' H' + (sag + 12) + '"/>' +
    '<path class="tk-cikis" pathLength="100" d="M' + sag + ' ' + cikY + ' H' + bus + '"/>' +
    '<path class="tk-bus" pathLength="100" d="M' + bus + ' ' + uc[0] + ' V' + uc[n - 1] + '"/>' +
    hatlar +
    '</svg>';
  var liste = PRIZMA_ARACLARI.map(function (p, i) {
    var ad = p[2] || ARAC_ADI[p[0]] || ARACLAR.find(function (x) { return x.slug === p[0]; }).ad;
    var alt = typeof p[1] === "function" ? p[1]() : p[1];
    return '<li class="tk-' + p[3] + '"><a href="../' + p[0] + '/" data-i="' + i + '"><strong>' + esc(ad) + '</strong><small>' + esc(alt) + '</small></a></li>';
  }).join("");
  return '<div class="tk-sahne">' +
    '<div class="tk-sol"><p class="tk-etiket tk-etiket-kaynak">Resmî Gazete <br>GİB · SGK</p>' + svg +
    '<p class="tk-etiket tk-etiket-govde"><b>Bordro Motoru</b><span>' + sonYil + ' gelir vergisi tarifesi · v' + esc(B.surum) + '</span></p></div>' +
    '<ol class="tk-cikis" aria-label="Motoru kullanan araçlardan sekizi">' + liste + '</ol>' +
    '</div>' +
    '<p class="tk-alt"><span class="tk-not">Kuralı bir kez değiştir; her araç aynı sayıyı görür.</span>' +
    '<span class="tk-lejant">' + AILELER.map(function (a) { return '<span class="tk-' + a[0] + '">' + a[1] + '</span>'; }).join("") + '</span>' +
    '<a href="#ekosistem">Motoru kullanan ' + araclar.length + ' aracın tamamı <span aria-hidden="true">↓</span></a></p>';
}

/* ---------------- boru hattı: kaynaktan araca ----------------
   Sıra gerçek bir sıradır (bir oran ancak bu yolla sayfaya ulaşır); bu
   yüzden numaralı. Sayılar motordan ve envanterden okunur. */

var HAT_IKON = {
  kaynak: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>',
  parametre: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  motor: '<path d="M3 20h5v-4h5v-4h5V8h3"/><path d="M3 20h18"/>',
  test: '<path d="m9 3 .5 7.5L4.5 19a1.6 1.6 0 0 0 1.4 2.4h12.2A1.6 1.6 0 0 0 19.5 19l-5-8.5L15 3"/><path d="M8.5 3h7M7 15h10"/>',
  uretim: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  arac: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><path d="M6 14h3l1.5-3 2 6 1.5-3H18"/>'
};

function karo(ikon) {
  return '<svg class="bh-karo" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">' +
    '<rect class="bh-cerceve" x="2" y="2" width="60" height="60" rx="2"/>' +
    '<g class="bh-ikon" transform="translate(14 14) scale(1.5)">' + ikon + '</g></svg>';
}

function boruHatti() {
  var yillar = B.yillar().slice().sort();
  var araclar = motorluAraclar();
  var adimlar = [
    { k: "kaynak", ad: "Kaynak", alt: "Resmî Gazete · GİB · SGK",
      baslik: "Oran ezberden değil, kaynaktan okunur.",
      metin: "Gelir vergisi tarifesi, asgari ücret, SGK tavanı ve kıdem tavanı yayımlandığı belgeden alınır. Kaynağın bağlantısı ve kontrol tarihi parametrenin yanında durur.",
      cip: ["Resmî Gazete", "GİB", "SGK", "TÜİK"] },
    { k: "parametre", ad: "Parametre", alt: yillar.length + " yıl · " + yillar[0] + "–" + yillar[yillar.length - 1],
      baslik: "Her yıl tek bir kayıt.",
      metin: "Bir yılın bütün yasal sayıları parametreler.js içinde tek yerde durur; Temmuz asgari ücreti gibi yıl içi dönemler ayrı satırdır. Aynı sayının ikinci bir kopyası CI'da yakalanır.",
      cip: ["parametreler.js", yillar.length + " bordro yılı", "kopya denetimi"], href: "#parametreler", link: "Parametre tablosu" },
    { k: "motor", ad: "Motor", alt: "v" + B.surum + " · bağımlılıksız",
      baslik: "Hesap tek çekirdekte yapılır.",
      metin: "motor.js aylık bordroyu kümülatif matrahla yürütür, netten brüte döner. Bağımlılığı yok; aynı dosya tarayıcıda ve testte çalışır.",
      cip: ["motor.js", "kümülatif matrah", "MIT"], href: "#metodoloji", link: "Hesap adımları" },
    { k: "test", ad: "Test", alt: testSayisi() + " doğrulama",
      baslik: "Her değişiklik testten geçer.",
      metin: TESTLER.length + " test dosyasındaki " + testSayisi() + " doğrulama her push'ta koşar. Tek biri kırmızıysa hiçbir sayfa yayına çıkmaz.",
      cip: [TESTLER.length + " test dosyası", testSayisi() + " doğrulama", "her push"], href: "#dogrulama", link: "Doğrulama listesi" },
    { k: "uretim", ad: "Üretim", alt: "tablo · şema · sayfa",
      baslik: "Sayfadaki sayı motordan üretilir.",
      metin: "Tablolar, yapısal veri ve bu sayfadaki şemalar elle yazılmaz; üreteç motoru çalıştırıp yazar. Sayfa ile motor ayrışırsa denetim kırmızıya döner.",
      cip: ["tablolar", "JSON-LD", "--check"] },
    { k: "arac", ad: "Araç", alt: araclar.length + " araç",
      baslik: "Siz aynı çekirdeği kullanırsınız.",
      metin: araclar.length + " araç aynı motoru yükler. Hesap tarayıcınızda çalışır; girdiğiniz tutar cihazınızdan çıkmaz.",
      cip: ["tarayıcıda hesap", "sunucuya veri yok"], href: "#ekosistem", link: "Araç listesi" }
  ];
  function iki(i) { return (i < 9 ? "0" : "") + (i + 1); }
  var serit =
    '<div class="bh-serit" aria-hidden="true">' +
    adimlar.map(function (a, i) {
      return '<span class="bh-dugum" data-adim="' + i + '">' + karo(HAT_IKON[a.k]) +
        '<span class="bh-no">' + iki(i) + ' / ' + iki(adimlar.length - 1) + '</span><span class="bh-ad">' + esc(a.ad) + '</span>' +
        '<span class="bh-alt">' + esc(a.alt) + '</span></span>';
    }).join("") +
    '<span class="bh-ilerleme"><span></span></span></div>';
  var liste = '<ol class="bh-adimlar">' + adimlar.map(function (a, i) {
    return '<li class="bh-adim" data-adim="' + i + '">' +
      '<p class="bh-adim-no"><span>' + iki(i) + '</span>' + esc(a.ad) + '</p>' +
      '<div><h3>' + esc(a.baslik) + '</h3><p>' + esc(a.metin) + '</p>' +
      '<p class="bh-cipler">' + a.cip.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join("") + '</p>' +
      (a.href ? '<p class="bh-git"><a href="' + a.href + '">' + esc(a.link) + ' <span aria-hidden="true">↓</span></a></p>' : '') +
      '</div></li>';
  }).join("") + '</ol>';
  return '<div class="bh-gorsel">' + serit + '</div>' + liste;
}

/* ---------------- yerleştirme ---------------- */

function dogrulamaOzeti() {
  var adlar = {
    "test.js": ["Ücret bordrosu", "motor.js"],
    "cikis-test.js": ["İşten ayrılma", "cikis.js"],
    "calisma-bicimi-test.js": ["Çalışma biçimi", "calisma-bicimi.js"],
    "ek-odeme-test.js": ["Prim ve ikramiye", "ek-odeme-motoru.js"],
    "gmsi-test.js": ["Kira geliri", "gmsi-motor.js"],
    "beyanname-test.js": ["Yıllık beyanname", "beyanname-motoru.js"],
    "emeklilik-test.js": ["Emeklilik · bağımsız modül", "emeklilik-motor.js"],
    "borc-test.js": ["Borç planı · bağımsız modül", "borc-motor.js"],
    "dilim-kaymasi-test.js": ["Dilim kayması", "dilim-kaymasi.js"],
    "asgari-senaryo-test.js": ["Asgari ücret zammı senaryosu", "asgari-senaryo.js"],
    "sgk-prim-test.js": ["Bağ-Kur, isteğe bağlı sigorta ve borçlanma", "sgk-prim.js"],
    "sgdp-test.js": ["Emekli çalışan (SGDP)", "sgdp.js"],
    "rapor-test.js": ["Rapor parası (geçici iş göremezlik)", "rapor.js"]
  };
  return '<p><strong>' + testSayisi() + ' doğrulama, ' + TESTLER.length + ' test dosyası.</strong> Sayılar, aşağıdaki testler başarıyla çalıştırılarak üretilir; canlı bir CI durum göstergesi değildir.</p>\n' +
    '<div class="table-scroll"><table class="payroll"><caption>Hesap modülleri ve doğrulamalar</caption>' +
    '<thead><tr><th scope="col">Modül / kaynak</th><th scope="col">Doğrulama</th><th scope="col">Test dosyası</th></tr></thead><tbody>' +
    TESTLER.map(function (t) {
      var ad = adlar[t.dosya];
      if (!ad) throw new Error("Yeni test modülünün açıklamasını ekleyin: " + t.dosya);
      return '<tr><th scope="row"><a href="' + ad[1] + '">' + ad[0] + '</a></th><td>' + t.sayi +
        '</td><td><a href="' + t.dosya + '">' + t.dosya + '</a></td></tr>';
    }).join('\n') + '</tbody></table></div>\n' +
    '<p>Çekirdeğin gelir vergisi tarifesini ve bordro hesabını kullanan <strong>' + motorluAraclar().length +
    ' ana araç</strong> yukarıda listelenir. Maaş tutarı alt sayfaları ayrıca sayılmaz. Aynı klasördeki bağımsız motorlar: ' +
    ARACLAR.filter(function (a) { return !a.cekirdek; }).map(function (a) {
      return '<a href="../' + a.slug + '/">' + esc(a.ad) + '</a>';
    }).join(' ve ') + '. Bağımsız motorlar kendi parametreleriyle çalışır.</p>';
}

function surumOzeti() {
  return '<p class="muted">Hazırlayan <a href="../hakkimda/" rel="author">Koray Öner</a> · Çekirdek sürümü ' +
    esc(B.surum) + ' · Belge güncellemesi: <time datetime="2026-09-29">29 Eylül 2026</time></p>';
}

var HEDEFLER = [
  { dosya: "bordro/index.html", ad: "tek-kaynak", uret: tekKaynak },
  { dosya: "bordro/index.html", ad: "boru-hatti", uret: boruHatti },
  { dosya: "bordro/index.html", ad: "motor-ekosistem", uret: motorEkosistemi },
  { dosya: "bordro/index.html", ad: "dogrulama-ozeti", uret: dogrulamaOzeti },
  { dosya: "bordro/index.html", ad: "surum-ozeti", uret: surumOzeti }
];

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var degisen = [];

  HEDEFLER.forEach(function (h) {
    var bas = "<!-- DIYAGRAM:" + h.ad + ":BASLANGIC -->";
    var bit = "<!-- DIYAGRAM:" + h.ad + ":BITIS -->";
    var yol = path.join(KOK, h.dosya);
    var s = fs.readFileSync(yol, "utf8");
    var i = s.indexOf(bas), j = s.indexOf(bit);
    if (i === -1 || j === -1) {
      console.error("İşaretçi yok: " + h.dosya + " → " + h.ad);
      process.exit(2);
    }
    // İçerik damgalarını stil-damgasi.py yönetir; --check içerik karşılaştırır.
    var uretilen = h.uret().replace(/(href|src)="([^"?]+\.js)"/g, function (_, attr, url) {
      var kaynak = fs.readFileSync(path.resolve(path.dirname(yol), url), "utf8").replace(/\r\n/g, "\n");
      var damga = require("crypto").createHash("sha256").update(kaynak).digest("hex").slice(0, 8);
      return attr + '="' + url + '?v=' + damga + '"';
    });
    var yeni = s.slice(0, i) + bas + "\n" + uretilen + "\n        " + s.slice(j);
    yeni = yeni.replace(/"softwareVersion": "[^"]+"/, '"softwareVersion": "' + B.surum + '"');
    if (yeni !== s) {
      degisen.push(h.dosya + " (" + h.ad + ")");
      if (!kontrol) fs.writeFileSync(yol, yeni, "utf8");
    }
  });

  if (kontrol) {
    if (degisen.length) {
      console.log("Diyagramlar güncel değil: " + degisen.join(", "));
      return 1;
    }
    console.log("Diyagramlar güncel.");
    return 0;
  }
  if (!degisen.length) { console.log("Değişiklik yok."); return 0; }
  degisen.forEach(function (d) { console.log(d + " güncellendi."); });
  return 0;
}

process.exit(main());
