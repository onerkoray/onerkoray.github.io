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
    "asgari-senaryo-test.js": ["Asgari ücret zammı senaryosu", "asgari-senaryo.js"]
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
    esc(B.surum) + ' · Belge güncellemesi: <time datetime="2026-09-22">22 Eylül 2026</time></p>';
}

var HEDEFLER = [
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
