/*
 * "Doğum parası ne kadar?" yazısının hesabı.
 *
 * Her rakam sitenin rapor parası çekirdeğinden (bordro/rapor.js) ve bordro
 * motorundan gelir; bu dosya yalnız senaryoyu kurar:
 *   - doğum 15 Haziran 2026: izin 20 Nisan – 4 Ekim 2026, tamamı 2026'da,
 *     yani yıl tek bordro hesabıyla kurulabiliyor;
 *   - rapordan önceki on iki ayda aynı brüt (zam etkisi ayrıca hesaplanır);
 *   - işveren izin günlerinin ücretini ödemiyor (yaygın uygulama).
 *
 * "İzin yılının net farkı" = (izinli yılın neti + SGK ödeneği) − (izinsiz
 * yılın neti). İzin aylarında düşen matrah, yılın kalan aylarının vergisini
 * de düşürür; bu etki farka dahildir (rapor.js bordroEtkisi, yıl tek hesap).
 *
 * Kanunun kesirleri ve süreleri rapor.js'tedir. Burada yazılı olan tek yasal
 * sayı babalık izninin on günüdür (4857 s.K. Ek m.2, 7578 s.K. ile beşten
 * ona) ve doğuma iki hafta kalıncaya kadar çalışma hakkıdır (4857 m.74,
 * 5510 m.18/1-d; 7578 s.K. ile üçten ikiye).
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..", "..");
var R = require(path.join(KOK, "bordro", "rapor.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));

var DOGUM = "2026-06-15";
var YIL = 2026;
var BABALIK_GUN = 10;
var CALISMA_SON_HAFTA = 2;

function donem(ay) { return B.donem(B.parametre(YIL), ay); }
var ASGARI = donem(6).asgariBrut;
var TAVAN = donem(6).sgkTavan;
/* 2025 tavanı: geriye dönük on iki ayın yedisi 2025'te. */
var TAVAN_ONCEKI = B.donem(B.parametre(YIL - 1), 12).sgkTavan;

var ORNEK_BRUT = 60000;
var SEVIYELER = [ASGARI, 45000, 60000, 80000, 100000, 150000, 200000, 250000, TAVAN, 400000];

/* Tek kişi: kazanç, ödenek ve izin yılının bordrosu. */
function kisi(brut, secenek) {
  secenek = secenek || {};
  var dogum = secenek.dogum || DOGUM;
  var k = R.kazancTuret({ baslangic: dogum, brutSimdi: brut, brutOnce: secenek.brutOnce, zamAyi: secenek.zamAyi });
  var s = R.hesapla({ tur: "analik", baslangic: dogum, cogul: !!secenek.cogul, kazanc: k.kazanc, gun: k.gun, ucretToplami: k.ucretToplami });
  var e = R.bordroEtkisi(s, { aylikBrut: brut });
  if (s.parametreYok || e.yillar.length !== 1) throw new Error("Senaryo tek yılın içinde kalmalı: " + dogum);
  var y = e.yillar[0];
  return {
    brut: brut, kazanc: k, sonuc: s, aylar: e.aylar, yil: y,
    gunlukKazanc: s.gunlukKazanc, gunluk: s.gunlukOdenek.ayakta, toplam: s.toplam,
    kayipNet: y.netNormal - y.netRapor, yilFarki: y.fark, sonrakiVergi: y.sonrakiAylarVergi
  };
}

function farkFn(b) { return kisi(b).yilFarki; }

/* İzin yılı farkının işaret değiştirdiği brüt (1 TL hassasiyet). */
function kok(lo, hi) {
  var flo = farkFn(lo);
  if ((flo < 0) === (farkFn(hi) < 0)) throw new Error("Aralıkta işaret değişmiyor: " + lo + "–" + hi);
  while (hi - lo > 0.5) {
    var m = (lo + hi) / 2;
    if ((farkFn(m) < 0) === (flo < 0)) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
var _basabas = null;
function basabas() {
  if (!_basabas) _basabas = { alt: kok(ASGARI, 150000), ust: kok(TAVAN_ONCEKI, TAVAN) };
  return _basabas;
}

function tablo() { return SEVIYELER.map(kisi); }

/* Çizgi grafik: asgari ücretten 300.000 TL'ye 5.000 TL adımla, kırılma
   noktaları (asgari, 2025 ve 2026 tavanı) ayrıca. Tavanın üstünde fark
   hızla büyür (400.000 TL'de tabloda); ölçeği ezmesin diye çizgi burada biter. */
var EGRI_SON = 300000;
function egri() {
  var b = [ASGARI];
  for (var x = 35000; x <= EGRI_SON; x += 5000) b.push(x);
  b.push(TAVAN_ONCEKI, TAVAN);
  b.sort(function (p, q) { return p - q; });
  return b.filter(function (x, i) { return i === 0 || x !== b[i - 1]; }).map(function (x) { return { brut: x, fark: farkFn(x) }; });
}
function zirve() {
  return egri().reduce(function (m, p) { return p.fark > m.fark ? p : m; });
}

/* Yılın on iki ayı: izinsiz net, izinli yılın maaş neti ve ödeneği.
   Ücretli günler çekirdeğin bordroEtkisi'nden; yıl motorla tek hesapta. */
function yilAylari(brut) {
  var k = kisi(brut), gunler = [], brutlar = [], odenek = [];
  for (var i = 0; i < 12; i++) { gunler.push(30); brutlar.push(brut); odenek.push(0); }
  k.aylar.forEach(function (a) {
    var m = +a.ay.slice(5, 7) - 1;
    gunler[m] = a.ucretliGun; brutlar[m] = brut * a.ucretliGun / 30; odenek[m] = a.odenek;
  });
  var normal = B.hesaplaYil(brutlar.map(function () { return brut; }), YIL, {});
  var izinli = B.hesaplaYil(brutlar, YIL, { gun: gunler });
  return normal.aylar.map(function (n, i) {
    return { ay: i + 1, normal: n.net, maas: izinli.aylar[i].net, odenek: odenek[i], ucretliGun: gunler[i] };
  });
}

/* 30 günlük ödeneğin, izinsiz bir yılın ortalama aylık netine oranı.
   Kazanç 2026'nın kendi sınırlarıyla (geriye dönük yıl kayması yok). */
function oran(brut) {
  var pek = Math.min(Math.max(brut, ASGARI), TAVAN);
  var odenek30 = pek / 30 * R.ORAN.ayakta * 30;
  var y = B.hesaplaYil([brut, brut, brut, brut, brut, brut, brut, brut, brut, brut, brut, brut], YIL, {});
  return { odenek30: odenek30, ortNet: y.toplam.net / 12, oran: odenek30 / (y.toplam.net / 12) };
}

/* Zam etkisi: Ocak'ta 48.000'den 60.000'e zam, doğum 15 Mart 2026. */
var ZAM = { dogum: "2026-03-15", once: 48000, simdi: 60000, zamAyi: "2026-01" };
function zamEtkisi() {
  var z = kisi(ZAM.simdi, { dogum: ZAM.dogum, brutOnce: ZAM.once, zamAyi: ZAM.zamAyi });
  var d = kisi(ZAM.simdi, { dogum: ZAM.dogum });
  return { zamli: z, zamsiz: d, kayip: d.toplam - z.toplam, oran: 1 - z.gunlukKazanc / d.gunlukKazanc };
}

/* Zaman çizelgesi: hafta cinsinden, doğum = 0. */
function zaman() {
  var A = R.ANALIK, babalikHafta = BABALIK_GUN / 7;
  return [
    { ad: "Tek bebek", once: A.once, sonra: A.sonra, gun: (A.once + A.sonra) * 7 },
    { ad: "İkiz ya da daha fazla", once: A.onceCogul, sonra: A.sonra, gun: (A.onceCogul + A.sonra) * 7 },
    { ad: "Doğuma 2 hafta kalana kadar çalışırsa", once: CALISMA_SON_HAFTA, sonra: A.sonra + (A.once - CALISMA_SON_HAFTA), gun: (A.once + A.sonra) * 7 },
    { ad: "Baba", once: 0, sonra: babalikHafta, gun: BABALIK_GUN, baba: true }
  ];
}

module.exports = {
  DOGUM: DOGUM, YIL: YIL, ASGARI: ASGARI, TAVAN: TAVAN, TAVAN_ONCEKI: TAVAN_ONCEKI,
  ORNEK_BRUT: ORNEK_BRUT, SEVIYELER: SEVIYELER, BABALIK_GUN: BABALIK_GUN, CALISMA_SON_HAFTA: CALISMA_SON_HAFTA, ZAM: ZAM,
  EGRI_SON: EGRI_SON, yilAylari: yilAylari,
  kisi: kisi, tablo: tablo, egri: egri, zirve: zirve, basabas: basabas, oran: oran, zamEtkisi: zamEtkisi, zaman: zaman,
  ANALIK: R.ANALIK, ORAN: R.ORAN
};
