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

/* ---------------- düzen ---------------- */

var SATIR = 34;        // yaprak satır yüksekliği (başlık + alt satır)
var UST = 26;
var ALT = 22;
var HUB_G = 210;       // merkez kutu genişliği
var DAL_G = 150;
var BOSLUK = 62;       // sütunlar arası

/* Metin genişliği ölçümü. SVG'de metin taşarsa viewBox onu kırpar; sabit bir
   sütun genişliği varsaymak etiketleri sağdan kesiyordu. Sistem yazı tipi için
   karakter başına ortalama genişlik yeterince iyi bir yaklaşım. */
function metinG(metin, punto, kalin) {
  return String(metin).length * punto * (kalin ? 0.56 : 0.52);
}

function kutu(x, y, g, h, r) {
  return '<rect x="' + x + '" y="' + y + '" width="' + g + '" height="' + h +
    '" rx="' + (r || 9) + '"/>';
}

/* Sağdan sola akan yumuşak bağlantı: dikeyde ortadan çıkıp ortaya girer. */
function bag(x1, y1, x2, y2) {
  var dx = (x2 - x1) * 0.55;
  return '<path class="dg-bag" d="M' + x1 + " " + y1 +
    " C" + (x1 + dx) + " " + y1 + "," + (x2 - dx) + " " + y2 + "," + x2 + " " + y2 + '"/>';
}

function nokta(x, y) { return '<circle class="dg-nokta" cx="' + x + '" cy="' + y + '" r="3.2"/>'; }

/* dallar: [{ ad, alt, yapraklar: [{ad, alt}] }] */
function agac(baslik, aciklama, merkez, merkezAlt, dallar) {
  var toplamYaprak = dallar.reduce(function (t, d) { return t + d.yapraklar.length; }, 0);
  var araBosluk = 18;
  var H = UST + ALT + toplamYaprak * SATIR + (dallar.length - 1) * araBosluk;

  /* En uzun yaprak etiketine göre genişlik — kırpılma olmasın. */
  var enUzun = 0;
  dallar.forEach(function (d) {
    d.yapraklar.forEach(function (yp) {
      enUzun = Math.max(enUzun, metinG(yp.ad, 13, true));
      if (yp.alt) enUzun = Math.max(enUzun, metinG(yp.alt, 11.5, false));
    });
  });
  var YAP_G = Math.ceil(enUzun) + 24;
  var W = HUB_G + BOSLUK + DAL_G + BOSLUK + YAP_G + 24;

  var x0 = 12;
  var x1 = x0 + HUB_G + BOSLUK;
  var x2 = x1 + DAL_G + BOSLUK;

  var parcalar = [];
  var y = UST;
  var dalMerkezleri = [];

  dallar.forEach(function (d) {
    var basY = y;
    var yapraklar = [];
    d.yapraklar.forEach(function (yp) {
      var yy = y + SATIR / 2;
      yapraklar.push({ y: yy, veri: yp });
      y += SATIR;
    });
    var dalY = (basY + y) / 2;
    dalMerkezleri.push(dalY);

    // dal kutusu
    parcalar.push('<g class="dg-dal">' +
      kutu(x1, dalY - 17, DAL_G, 34, 10) +
      '<text class="dg-dal-yazi" x="' + (x1 + DAL_G / 2) + '" y="' + (dalY + 5) +
      '" text-anchor="middle">' + esc(d.ad) + "</text></g>");

    // dal -> yapraklar
    yapraklar.forEach(function (yp) {
      parcalar.push(bag(x1 + DAL_G, dalY, x2, yp.y));
      parcalar.push(nokta(x2, yp.y));
      /* Başlık ve alt satır: 13 px punto için 13 px aralık çakışıyordu. */
      var altVar = !!yp.veri.alt;
      parcalar.push('<text class="dg-yaprak" x="' + (x2 + 12) + '" y="' +
        (altVar ? yp.y - 4 : yp.y + 4) + '">' + esc(yp.veri.ad) + "</text>");
      if (altVar) {
        parcalar.push('<text class="dg-yaprak-alt" x="' + (x2 + 12) + '" y="' + (yp.y + 12) + '">' +
          esc(yp.veri.alt) + "</text>");
      }
    });

    y += araBosluk;
  });

  var hubY = H / 2;
  dalMerkezleri.forEach(function (dy) {
    parcalar.unshift(bag(x0 + HUB_G, hubY, x1, dy));
    parcalar.push(nokta(x1, dy));
  });

  var hub = '<g class="dg-hub">' + kutu(x0, hubY - 31, HUB_G, 62, 14) +
    '<text class="dg-hub-yazi" x="' + (x0 + HUB_G / 2) + '" y="' + (hubY - 4) +
    '" text-anchor="middle">' + esc(merkez) + "</text>" +
    '<text class="dg-hub-alt" x="' + (x0 + HUB_G / 2) + '" y="' + (hubY + 15) +
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
  var P = B.parametre(B.sonYil());

  var dallar = [
    {
      ad: "Parametreler",
      yapraklar: [
        { ad: "Gelir vergisi tarifesi", alt: "m.103 · ücret ve ücret dışı" },
        { ad: "Asgari ücret ve istisna", alt: "m.32 · yıl içi dönemler dahil" },
        { ad: "SGK prime esas kazanç", alt: "5510 m.82 · alt ve üst sınır" },
        { ad: "Kıdem tazminatı tavanı", alt: "1475 m.14 · altı aylık dönem" },
        { ad: "İşsizlik ve fazla mesai", alt: "4447 m.50 · 4857 m.41" }
      ]
    },
    {
      ad: "Hesaplar",
      yapraklar: [
        { ad: "Aylık ve 12 aylık bordro", alt: "kümülatif matrah takibi" },
        { ad: "Netten brüte", alt: "tek ay ve net sözleşme için 12 ay" },
        { ad: "Çıkış paketi", alt: C.FESIH_TURLERI.length + " fesih türü · hak matrisi" },
        { ad: "Çalışma biçimi", alt: "aynı maliyette dört senaryo" }
      ]
    },
    {
      ad: "Araçlar",
      yapraklar: araclar.map(function (a) {
        return { ad: ARAC_ADI[a] || a, alt: "/" + a + "/" };
      })
    },
    {
      ad: "Denetim",
      yapraklar: [
        { ad: testler + " doğrulama testi", alt: "resmî tutarlara sabitlenmiş" },
        { ad: "Parametre kopyası kontrolü", alt: "motor dışında yasal sayı yok" },
        { ad: "Üretilen tablo kontrolü", alt: "sayfa ile motor ayrışamaz" },
        { ad: "Sayfa ve CSS denetimi", alt: "her push'ta çalışır" }
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
    "sürüm " + B.surum + " · " + yillar.length + " yıl · MIT",
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
