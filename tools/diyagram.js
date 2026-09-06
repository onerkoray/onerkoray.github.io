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
 * NEDEN RADYAL DEĞİL
 * ------------------
 * Bu türün alışıldık hâli merkezden dışa açılan radyal şemadır; güzel durur
 * ama dar ekranda okunmaz — etiketler döner, çakışır, ölçek küçülünce yazı
 * 5 piksele iner. Burada aynı bilgi soldan sağa akan bir ağaçla veriliyor:
 * merkez, dallar, yapraklar ve eğri bağlantılar duruyor; okunabilirlik
 * duruyor. Dar ekranda sitenin tablolarıyla aynı kalıp uygulanıyor (kaydırma
 * kabı + min-width), böylece yazı hiçbir zaman küçülmüyor.
 *
 * Renk tek hue: diyagram veri serisi taşımıyor, kategorik palet gürültü olurdu.
 * Renkler CSS değişkenlerinden geldiği için açık/koyu temaya kendiliğinden uyar.
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

function oku(p) { return fs.readFileSync(path.join(KOK, p), "utf8"); }

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Test sayıları doğrudan test dosyalarındaki ok() çağrılarından değil,
   çalıştırılmadan sayılamaz; bu yüzden çıktıdaki toplam satırdan okunur. */
function testSayisi() {
  var cp = require("child_process");
  var toplam = 0;
  ["test.js", "cikis-test.js", "calisma-bicimi-test.js"].forEach(function (f) {
    var cikti = cp.execFileSync(process.execPath, [path.join(KOK, "bordro", f)],
      { encoding: "utf8" });
    var m = cikti.match(/(\d+)\s+geçti/);
    if (m) toplam += parseInt(m[1], 10);
  });
  return toplam;
}

/* Motoru fiilen kullanan araçlar — metodoloji künyesiyle aynı kaynak. */
function motorluAraclar() {
  var s = oku("tools/metodoloji-blogu.py");
  var blok = s.slice(s.indexOf("MOTORLU = {"), s.indexOf("}", s.indexOf("MOTORLU = {")));
  var m = blok.match(/"([a-z0-9-]+)"/g) || [];
  return m.map(function (x) { return x.replace(/"/g, ""); });
}

var ARAC_ADI = {
  "maas-hesaplama": "Brüt–net maaş",
  "isten-ayrilma-hesaplama": "İşten ayrılma paketi",
  "kidem-tazminati-hesaplama": "Kıdem ve ihbar",
  "issizlik-maasi-hesaplama": "İşsizlik maaşı",
  "serbest-meslek-makbuzu-hesaplama": "Serbest meslek makbuzu",
  "calisma-bicimi-karsilastirma": "Çalışma biçimi",
  "isveren-maliyeti-hesaplama": "İşveren maliyeti",
  "fazla-mesai-hesaplama": "Fazla mesai"
};

/* ---------------- düzen ----------------

   İlk sürüm çıplak kutulardan oluşuyordu ve organizasyon şeması gibi
   okunuyordu. Referans türünde olan şey şu: merkez bir madalyon, dallarda
   sayaç rozeti, yapraklarda İKONLU kart. İkonlar zaten depoda vardı
   (tools/card-icons.json), kullanılmıyordu.
   ------------------------------------------------------------------- */

var HUB_R = 62;              // merkez madalyon yarıçapı
var HUB_SUT = 200;           // merkez sütun genişliği
var DAL_G = 208, DAL_Y = 42; // dal pili (sayaç rozetiyle çakışmasın)
var KART_G = 322;            // yaprak kartı
var KART_Y_TAM = 58;         // alt satırı olan kart
var KART_Y_SADE = 38;        // yalnız başlık
var ARA = 8;                 // kartlar arası
var DAL_ARA = 26;            // dallar arası
var SUT_ARA = 66;            // sütunlar arası
var UST = 30, ALT = 30;

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

function ikonG(ic, x, y, boy) {
  var o = (boy || 22) / 24;
  return '<g class="dg-ikon" transform="translate(' + x + ',' + y + ') scale(' + o.toFixed(4) + ')">' +
    ic + "</g>";
}

function bag(x1, y1, x2, y2, kalinlik) {
  var dx = (x2 - x1) * 0.5;
  return '<path class="dg-bag" stroke-width="' + kalinlik + '" d="M' + x1 + " " + y1 +
    " C" + (x1 + dx) + " " + y1 + "," + (x2 - dx) + " " + y2 + "," + x2 + " " + y2 + '"/>';
}

function nokta(x, y, r) {
  return '<circle class="dg-nokta" cx="' + x + '" cy="' + y + '" r="' + (r || 3.4) + '"/>';
}

/* dallar: [{ ad, glif, yapraklar: [{ ad, alt, ikon }] }] */
function agac(baslik, aciklama, merkez, merkezAlt, dallar) {
  var x0 = 10;
  var xHub = x0 + HUB_SUT / 2;
  var xDal = x0 + HUB_SUT + SUT_ARA;
  var xKart = xDal + DAL_G + SUT_ARA;
  var W = xKart + KART_G + 18;

  var parcalar = [];
  var y = UST;
  var dalBilgi = [];

  dallar.forEach(function (d) {
    var basY = y;
    var kartlar = [];
    d.yapraklar.forEach(function (yp) {
      var h = yp.alt ? KART_Y_TAM : KART_Y_SADE;
      kartlar.push({ y: y, h: h, veri: yp });
      y += h + ARA;
    });
    var sonY = y - ARA;
    dalBilgi.push({ merkez: (basY + sonY) / 2, dal: d, kartlar: kartlar });
    y += DAL_ARA;
  });

  var H = y - DAL_ARA + ALT;
  var hubY = H / 2;

  dalBilgi.forEach(function (b) {
    // hub -> dal
    parcalar.push(bag(xHub + HUB_R, hubY, xDal, b.merkez, 2.4));

    // dal pili
    parcalar.push('<g class="dg-dal">' +
      '<rect x="' + xDal + '" y="' + (b.merkez - DAL_Y / 2) + '" width="' + DAL_G +
      '" height="' + DAL_Y + '" rx="' + (DAL_Y / 2) + '"/>' +
      ikonG(GLIF[b.dal.glif] || "", xDal + 15, b.merkez - 10, 20) +
      '<text class="dg-dal-yazi" x="' + (xDal + 45) + '" y="' + (b.merkez + 5) + '">' +
      esc(b.dal.ad) + "</text>" +
      '<circle class="dg-sayac" cx="' + (xDal + DAL_G - 24) + '" cy="' + b.merkez + '" r="13"/>' +
      '<text class="dg-sayac-yazi" x="' + (xDal + DAL_G - 24) + '" y="' + (b.merkez + 4) +
      '" text-anchor="middle">' + b.kartlar.length + "</text>" +
      "</g>");
    parcalar.push(nokta(xDal, b.merkez, 4));

    // dal -> kartlar
    b.kartlar.forEach(function (k) {
      var ky = k.y + k.h / 2;
      parcalar.push(bag(xDal + DAL_G, b.merkez, xKart, ky, 1.4));
      parcalar.push(nokta(xKart, ky, 3));
      parcalar.push('<g class="dg-kart">' +
        '<rect x="' + xKart + '" y="' + k.y + '" width="' + KART_G + '" height="' + k.h + '" rx="11"/>' +
        ikonG(k.veri.ikon || "", xKart + 14, ky - 11, 22) +
        '<text class="dg-kart-yazi" x="' + (xKart + 48) + '" y="' +
        (k.veri.alt ? ky - 6 : ky + 4) + '">' + esc(k.veri.ad) + "</text>" +
        (k.veri.alt
          ? '<text class="dg-kart-alt" x="' + (xKart + 48) + '" y="' + (ky + 14) + '">' +
            esc(k.veri.alt) + "</text>"
          : "") +
        "</g>");
    });
  });

  /* Merkez madalyon. Ad ve sürüm daire İÇİNE sığmıyordu (124 piksellik
     dairede iki satır metin dışarı taşıyordu); dairenin altına alındı. */
  var hub = '<g class="dg-hub">' +
    '<circle class="dg-halka" cx="' + xHub + '" cy="' + hubY + '" r="' + (HUB_R + 10) + '"/>' +
    '<circle class="dg-cekirdek" cx="' + xHub + '" cy="' + hubY + '" r="' + HUB_R + '"/>' +
    '<g class="dg-marka" transform="translate(' + (xHub - 27) + ',' + (hubY - 27) + ') scale(2.25)">' +
    '<path d="M9 4 4 12l5 8"/><path d="M15 4l5 8-5 8"/>' + "</g>" +
    '<text class="dg-hub-yazi" x="' + xHub + '" y="' + (hubY + HUB_R + 34) +
    '" text-anchor="middle">' + esc(merkez) + "</text>" +
    '<text class="dg-hub-alt" x="' + xHub + '" y="' + (hubY + HUB_R + 53) +
    '" text-anchor="middle">' + esc(merkezAlt) + "</text></g>";

  return '<svg class="diyagram" viewBox="0 0 ' + W + " " + H + '" width="' + W +
    '" height="' + H + '" role="img" aria-labelledby="dg-b dg-a">' +
    "<title id=\"dg-b\">" + esc(baslik) + "</title>" +
    "<desc id=\"dg-a\">" + esc(aciklama) + "</desc>" +
    parcalar.join("") + hub + "</svg>";
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
        { ad: "Asgari ücret ve istisna", alt: "GVK m.32 · yıl içi dönemler dahil", ikon: GLIF.asgari },
        { ad: "Prime esas kazanç", alt: "5510 m.82 · alt ve üst sınır", ikon: GLIF.sgk },
        { ad: "Kıdem tazminatı tavanı", alt: "1475 m.14 · altı aylık dönem", ikon: GLIF.kidem },
        { ad: "İşsizlik ve fazla mesai", alt: "4447 m.50 · 4857 m.41", ikon: GLIF.issizlik }
      ]
    },
    {
      ad: "Hesaplar",
      glif: "nettenBrute",
      yapraklar: [
        { ad: "Aylık ve 12 aylık bordro", alt: "kümülatif matrah takibi", ikon: GLIF.bordro },
        { ad: "Netten brüte", alt: "tek ay ve net sözleşme için 12 ay", ikon: GLIF.nettenBrute },
        { ad: "Çıkış paketi", alt: C.FESIH_TURLERI.length + " fesih türü · hak matrisi", ikon: GLIF.cikis },
        { ad: "Çalışma biçimi", alt: "aynı maliyette dört senaryo", ikon: GLIF.senaryo }
      ]
    },
    {
      ad: "Araçlar",
      glif: "tablo",
      yapraklar: araclar.map(function (a) {
        return { ad: ARAC_ADI[a] || a, ikon: aracIkon(a) };
      })
    },
    {
      ad: "Denetim",
      glif: "denetim",
      yapraklar: [
        { ad: testler + " doğrulama testi", alt: "resmî tutarlara sabitlenmiş", ikon: GLIF.test },
        { ad: "Parametre kopyası kontrolü", alt: "motor dışında yasal sayı yok", ikon: GLIF.kopya },
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

var HEDEFLER = [
  { dosya: "bordro/index.html", ad: "motor-ekosistem", uret: motorEkosistemi }
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
    var yeni = s.slice(0, i) + bas + "\n" + h.uret() + "\n        " + s.slice(j);
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
