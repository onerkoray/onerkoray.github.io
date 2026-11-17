/*!
 * Ocak 2027 panosu — her kalemin bugünkü durumu.
 *
 * Her satır sitenin tek kaynaklarından okunur; hiçbir rakam burada yazılmaz:
 *   TÜFE serisi           finans/tufe-serisi.js (gece ve veri günü yoklaması)
 *   emekli zammı kuralı   5510 m.55: Temmuz–Aralık TÜFE birikimi
 *   memur zammı           finans/toplu-sozlesme.js + enflasyon farkı
 *   yeniden değerleme     makaleler/yeniden-degerleme-orani-2026/oran.js (Yİ-ÜFE)
 *                         ve finans/endeksleme-serileri.js (GİB tebliği girilince)
 *   asgari ücret, dilim   bordro/parametreler.js (2027 girilince)
 *   en düşük aylık        finans/emekli-taban.js (kanun girilince)
 *
 * DURUM ŞEMASI — veriden türer, elle yazılmaz:
 *   kesin       resmî rakam açıklandı ya da kanundaki formülün bütün girdileri
 *               açıklandı (ör. altı ay TÜFE'nin altısı da açıklandı)
 *   hesaplandi  girdiler kesin, rakam hesaplanabiliyor; resmî metin bekleniyor
 *   senaryo     girdilerin bir kısmı açıklandı; kalan aylar varsayımla
 *   bekleniyor  rakamı belirleyen karar verilmedi; bugünkü değer gösterilir
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/ocak-2027/
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..");
var T = require(path.join(KOK, "finans", "tufe-serisi.js"));
var TS = require(path.join(KOK, "finans", "toplu-sozlesme.js"));
var S = require(path.join(KOK, "finans", "endeksleme-serileri.js"));
var E = require(path.join(KOK, "finans", "emekli-taban.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));
var Y = require(path.join(KOK, "makaleler", "yeniden-degerleme-orani-2026", "oran.js"));
var M = require(path.join(KOK, "finans", "mali-takvim.js"));

var YIL = 2027;
var AYLAR = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
var SGK_TAVAN_KATSAYISI = 9;          // 5510 m.82: üst sınır alt sınırın 9 katı (7566 s.K.)

function ayAdi(a) { return M.ayAdi(a); }

/* Temmuz–Aralık 2026: açıklanan aylar ve birikim. */
function tufeAltiAy() {
  var aciklanan = AYLAR.filter(function (a) { return T.aylar[a]; });
  var birikim = aciklanan.reduce(function (c, a) { return c * (1 + T.aylar[a].aylik / 100); }, 1) - 1;
  return { aylar: aciklanan, kalan: AYLAR.length - aciklanan.length, birikim: birikim, sonAy: aciklanan[aciklanan.length - 1] };
}

/* Kalan aylar için tek bir varsayım: geçen yılın aynı ayları (2025).
   Diğer senaryolar Ocak zammı yazısında; pano yalnız bir orta yol gösterir. */
function gecenYilVarsayimi(t) {
  var kalan = AYLAR.slice(t.aylar.length);
  var ek = kalan.reduce(function (c, a) { return c * (1 + T.aylar["2025" + a.slice(4)].aylik / 100); }, 1);
  return (1 + t.birikim) * ek - 1;
}

function memurZammi(emekli) {
  var ikinci = TS.oranlar["2026-2"], ocak = TS.oranlar["2027-1"];
  var fark = Math.max(0, (1 + emekli) / (1 + ikinci) - 1);
  return { toplam: (1 + ocak) * (1 + fark) - 1, toplu: ocak, fark: fark, ikinci: ikinci };
}

function asgari(yil) {
  var p = B.parametre(yil);
  if (!p) return null;
  var d = p.donemler[0];
  return { brut: d.asgariBrut, net: d.asgariNet, dilimler: p.dilimler };
}
function parametreVar(yil) { try { return !!B.parametre(yil); } catch (e) { return false; } }

function tarih(adParcasi) {
  var o = M.olaylar().filter(function (x) { return x.ad.indexOf(adParcasi) >= 0; })[0];
  return o ? o.tarih : null;
}

function kalemler() {
  var t = tufeAltiAy(), tamam = t.kalan === 0;
  var emekliOrta = tamam ? t.birikim : gecenYilVarsayimi(t);
  var mOrta = memurZammi(emekliOrta);
  var aralikTufe = tarih("Aralık 2026 enflasyonu");
  var var2027 = parametreVar(YIL);
  var a26 = asgari(2026), a27 = var2027 ? asgari(YIL) : null;
  var ydoResmi = S.SERI[YIL] ? S.SERI[YIL].ydo : null;
  var ydoHesap = Y.kesin().oran;
  var ydo = ydoResmi != null ? ydoResmi : ydoHesap;
  var ilkDilim26 = B.parametre(2026).dilimler[0][0];
  var ilkDilim27 = a27 ? a27.dilimler[0][0] : Math.floor(ilkDilim26 * (1 + ydo / 100));
  var taban = E.TABAN[E.TABAN.length - 1], taban27 = E.donem(YIL + "-01");
  var tabanYeni = taban27 && taban27.donem === YIL + "-01";

  return [
    {
      id: "emekli", ad: "SSK ve Bağ-Kur emekli zammı", birim: "oran",
      durum: tamam ? "kesin" : "senaryo",
      deger: emekliOrta,
      kesinKisim: t.birikim, kalanAy: t.kalan, sonAy: t.sonAy,
      aciklama: tamam
        ? "Temmuz–Aralık 2026 TÜFE birikimi; 5510 m.55."
        : ayAdi(AYLAR[0]) + "–" + ayAdi(t.sonAy) + " açıklandı: %" + yuzde(t.birikim) + ". Kalan " + t.kalan + " ay geçen yılın aynı aylarıyla.",
      ne: aralikTufe, merci: "Kanundaki formül (5510 m.55)", baglanti: "emekli-zammi-hesaplama/"
    },
    {
      id: "memur", ad: "Memur ve memur emeklisi zammı", birim: "oran",
      durum: tamam ? "kesin" : "senaryo",
      deger: mOrta.toplam, toplu: mOrta.toplu, fark: mOrta.fark,
      aciklama: "Toplu sözleşme %" + yuzde(mOrta.toplu, 0) + " + enflasyon farkı (ikinci yarı TÜFE'si %" + yuzde(mOrta.ikinci, 0) + "'yi aşan kısım).",
      ne: aralikTufe, merci: "Toplu sözleşme ve formül", baglanti: "memur-zammi-hesaplama/"
    },
    {
      id: "ydo", ad: "Yeniden değerleme oranı", birim: "oran",
      durum: ydoResmi != null ? "kesin" : "hesaplandi",
      deger: ydo / 100,
      aciklama: ydoResmi != null
        ? "VUK Genel Tebliği ile ilan edildi. Harç, ceza ve vergi tutarları buna bağlı."
        : "Ekim 2026 Yİ-ÜFE'siyle kesinleşti (VUK mükerrer m.298); GİB tebliği bekleniyor.",
      ne: "2026-11-30", merci: "Kanundaki formül; GİB ilan eder", baglanti: "makaleler/yeniden-degerleme-orani-2026/"
    },
    {
      id: "dilim", ad: "Gelir vergisi ilk dilim sınırı", birim: "tl",
      durum: var2027 ? "kesin" : "hesaplandi",
      deger: ilkDilim27, onceki: ilkDilim26,
      aciklama: var2027
        ? "2027 tarifesi; GVK m.103."
        : "2026 tutarı (" + tl(ilkDilim26) + " TL) yeniden değerleme oranıyla. Kesirler atılır; tebliğ yuvarlayabilir.",
      ne: "2026-12-31", merci: "Kanundaki formül (GVK mük. m.123)", baglanti: "makaleler/vergi-dilimleri-2027-asgari-ucret/"
    },
    {
      id: "asgari", ad: "Asgari ücret (brüt)", birim: "tl",
      durum: var2027 ? "kesin" : "bekleniyor",
      deger: var2027 ? a27.brut : a26.brut, net: var2027 ? a27.net : a26.net,
      aciklama: var2027 ? "2027 tutarı; net " + tl(a27.net, 2) + " TL." : "Bugün 2026 tutarı. Asgari Ücret Tespit Komisyonu Aralık'ta karar verir.",
      ne: "2027-01-01", merci: "Asgari Ücret Tespit Komisyonu", baglanti: "asgari-ucret-zam-senaryosu/"
    },
    {
      id: "sgk", ad: "SGK prime esas kazanç tavanı", birim: "tl",
      durum: var2027 ? "kesin" : "bekleniyor",
      deger: (var2027 ? a27.brut : a26.brut) * SGK_TAVAN_KATSAYISI,
      aciklama: "Asgari ücretin " + SGK_TAVAN_KATSAYISI + " katı (5510 m.82). " + (var2027 ? "" : "Asgari ücretle birlikte belli olur."),
      ne: "2027-01-01", merci: "Asgari ücrete bağlı formül", baglanti: "makaleler/sgk-prim-tavani-9-kat/"
    },
    {
      id: "taban", ad: "En düşük emekli aylığı", birim: "tl",
      durum: tabanYeni ? "kesin" : "bekleniyor",
      deger: tabanYeni ? taban27.tutar : taban.tutar,
      aciklama: tabanYeni
        ? taban27.kanun + " sayılı Kanunla."
        : "Bugün " + tl(taban.tutar) + " TL (" + taban.kanun + " sayılı Kanun). Ocak zammı tabana yansımaz; değişmesi için kanun gerekir.",
      ne: null, merci: "TBMM (kanun)", baglanti: "makaleler/en-dusuk-emekli-ayligi-ocak-2027/"
    },
    {
      id: "iyilestirme", ad: "Emekliye ilave iyileştirme", birim: "yok",
      durum: "bekleniyor", deger: null,
      aciklama: "Yaşa ve prim gününe göre farklılaşabileceği söylendi; metin, oran ve tutar yok.",
      ne: null, merci: "TBMM (kanun)", baglanti: "makaleler/emekliye-ilave-iyilestirme-ocak-2027/"
    }
  ];
}

function sayi(v, d) {
  var s = Math.abs(v).toFixed(d == null ? 0 : d).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "−" : "") + s.join(",");
}
function tl(v, d) { return sayi(v, d); }
function yuzde(o, d) { return sayi(o * 100, d == null ? 2 : d); }

function ozet() {
  var k = kalemler(), say = {};
  k.forEach(function (x) { say[x.durum] = (say[x.durum] || 0) + 1; });
  return { toplam: k.length, say: say, tufe: tufeAltiAy() };
}

module.exports = {
  YIL: YIL, AYLAR: AYLAR, SGK_TAVAN_KATSAYISI: SGK_TAVAN_KATSAYISI,
  tufeAltiAy: tufeAltiAy, gecenYilVarsayimi: gecenYilVarsayimi, memurZammi: memurZammi,
  kalemler: kalemler, ozet: ozet, sayi: sayi, yuzde: yuzde, tl: tl, ayAdi: ayAdi
};
