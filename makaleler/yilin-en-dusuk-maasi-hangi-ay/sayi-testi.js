#!/usr/bin/env node
/*!
 * "Yılın en düşük maaşı hangi ay?" — sayfadaki her rakam motorla uyuşuyor mu?
 *
 * NEDEN VAR
 * ---------
 * Bu yazının bütün iddiaları bir taramadan geliyor ve tarama tarifeye
 * ve asgari ücrete bağlı. 2027 parametreleri girildiğinde yüzdeler de
 * eşikler de kayar. Tablolar üreteçten geldiği için kendiliğinden
 * güncelleniyor, ama NESİRDEKİ sayılar elle yazıldı; bu test onları
 * bağlar.
 *
 * Ayrıca yazının en kırılgan cümlesi bir olumsuzlama: "iki kapalı kural
 * denedim, ikisi de çürüdü (0/3 ve %57,9)". Bu iki oran burada YENİDEN
 * HESAPLANIYOR. Kurallardan biri bir gün doğru hâle gelirse test kırmızı
 * döner ve cümle düzeltilir.
 *
 * Kullanım: node makaleler/yilin-en-dusuk-maasi-hangi-ay/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KLASOR = __dirname;
var D = require(path.join(KLASOR, "dip-ay.js"));
var B = require(path.join(KLASOR, "..", "..", "bordro", "motor.js"));
var s = fs.readFileSync(path.join(KLASOR, "index.html"), "utf8");

var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
function tl0(n) { return nf0.format(Math.round(n)); }
function yuzde1(v) { return "%" + v.toFixed(1).replace(".", ","); }

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}
function icerir(ad, metin) {
  dogru(ad + ": \"" + metin + "\"", s.indexOf(metin) >= 0, "sayfada bulunamadı");
}

console.log("Yılın en düşük maaşı hangi ay — sayı denetimi\n");

/* --- taramanın kapsamı ------------------------------------------- */
icerir("taranan brüt sayısı", nf0.format(D.tarama().length));
icerir("taramanın başlangıcı", tl0(D.baslangic()));
icerir("taramanın sonu", tl0(D.ADIM_SON));
icerir("adım", nf0.format(D.ADIM) + " TL adımlarla");

/* --- taramadan çıkan oranlar -------------------------------------- */
icerir("dibi aralıktan önce olanların payı", yuzde1(D.dibiAralikOncesiYuzde()));
icerir("geri çıkanların payı", yuzde1(D.geriCikanYuzde()));
icerir("hiç yükselmeyenlerin payı", yuzde1(D.tekduzeYuzde()));

/* --- istisnanın büyüdüğü ay --------------------------------------- */
dogru("asgari ücretlinin dilim ayı yedi", D.asgariDilimAyi() === 7,
  String(D.asgariDilimAyi()));
icerir("metinde yedinci ay", "yedinci ayda");

var artislar = D.istisnaArtislari();
dogru("istisna iki ayda büyüyor", artislar.length === 2,
  JSON.stringify(artislar));
dogru("büyüme ayları temmuz ve ağustos",
  artislar.length === 2 && artislar[0].ay === 6 && artislar[1].ay === 7,
  artislar.map(function (a) { return AYLAR[a.ay]; }).join(", "));

/* --- dip ayının yürüyüşü ------------------------------------------ */
var bantlar = D.bantlar();
var gorulenAylar = {};
bantlar.forEach(function (b) { gorulenAylar[AYLAR[b.dipAy]] = true; });
["Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
  .forEach(function (a) {
    dogru("dip ayı olarak görülen ay: " + a, gorulenAylar[a] === true);
  });
dogru("ocak-nisan hiç dip olmuyor",
  !gorulenAylar["Ocak"] && !gorulenAylar["Şubat"] &&
  !gorulenAylar["Mart"] && !gorulenAylar["Nisan"],
  Object.keys(gorulenAylar).join(", "));

/* Ocak her zaman yılın EN YÜKSEK neti mi? Yazı bunu iddia ediyor. */
var ocakEnYuksek = D.tarama().every(function (x) {
  return x.net.every(function (n) { return n <= x.ocak + 0.005; });
});
dogru("ocak her brütte yılın en yüksek neti", ocakEnYuksek);
icerir("metinde ocak iddiası", "Ocak, yılın en\n          yüksek netidir");

/* --- sıçramalar ---------------------------------------------------- */
dogru("üç sıçrama var", D.sifirlamalar().length === 3,
  D.sifirlamalar().join(", "));
icerir("metinde üç sıçrama", "üç sıçrama");

/* --- çürütülen iki kural ------------------------------------------ */
/* Kural 1: "sıçrama, yıllık matrahın bir dilim sınırını ilk aştığı brüt."
   Yazı bunun 3 eşiğin hiçbirini tutturmadığını söylüyor. */
function yillikMatrah(brut) {
  var t = 0;
  B.hesaplaYil(brut, D.YIL).aylar.forEach(function (a) {
    t += a.brut - a.sgk - a.issizlik;
  });
  return t;
}
var SINIR = D.parametre().dilimler
  .map(function (d) { return d[0]; }).filter(function (x) { return x; });
var kural1 = D.sifirlamalar().filter(function (b) {
  var ust = yillikMatrah(b), alt = yillikMatrah(b - D.ADIM);
  return SINIR.filter(function (x) { return alt < x && ust >= x; }).length === 1;
}).length;
dogru("kural 1 hâlâ çürük (0/3)", kural1 === 0, kural1 + "/3 tuttu");

/* Kural 2: "temmuz sonrası kazanç ile kaybın yarışı dip ayını belirler." */
var uyan = 0, hepsi = 0;
D.tarama().forEach(function (x) {
  var kazanc = 0, kayip = 0;
  for (var i = 6; i < 12; i++) {
    var d = x.net[i] - x.net[i - 1];
    if (d > 0.005) kazanc += d; else if (d < -0.005) kayip += -d;
  }
  hepsi++;
  if ((kayip > kazanc + 0.005) === (x.dipAy === 11)) uyan++;
});
var kural2 = uyan / hepsi * 100;
dogru("kural 2 hâlâ çürük (yarıdan biraz fazla)", kural2 < 60,
  kural2.toFixed(1));
icerir("kural 2 oranı metinde", yuzde1(kural2));

/* --- sayfadaki HER yüzde taramadan mı geliyor? -------------------- */
/* İlk sürüm yalnızca "bu değer sayfada geçiyor mu" diye soruyordu ve
   zayıftı: aynı oran hem nesirde hem SSS'te geçtiği için birini bozmak
   testi yeşil bırakıyordu -- mutasyonla yakalandı. Şimdi tersten
   soruluyor: sayfada geçen her yüzde, taramanın ürettiği bir değer
   olmak zorunda. Yeni bir oran yazılırsa da buraya eklenmesi gerekir. */
var IZINLI_YUZDE = {};
[D.dibiAralikOncesiYuzde(), D.geriCikanYuzde(), D.tekduzeYuzde(), kural2]
  .forEach(function (v) { IZINLI_YUZDE[yuzde1(v)] = true; });
/* Tarifedeki oranlar da metinde geçebilir. */
D.parametre().dilimler.forEach(function (d) {
  IZINLI_YUZDE["%" + (d[1] * 100).toFixed(1).replace(".", ",")] = true;
  IZINLI_YUZDE["%" + (d[1] * 100)] = true;
});

var yuzdeler = s.match(/%\d{1,3},\d/g) || [];
var kotuYuzde = yuzdeler.filter(function (y) { return !IZINLI_YUZDE[y]; });
dogru("sayfadaki her yüzde taramadan geliyor", kotuYuzde.length === 0,
  "tanınmayan: " + kotuYuzde.join(", "));
dogru("KONTROL: sayfada en az dört yüzde var", yuzdeler.length >= 4,
  String(yuzdeler.length));

/* --- sayfadaki HER tarama sayisi dogru mu? ------------------------- */
/* "5.670" gibi bir sayi birden cok yerde geciyor; hepsi ayni olmali. */
var taramaSayisi = nf0.format(D.tarama().length);
var yanlisTarama = (s.match(/\b5\.\d{3}\b/g) || [])
  .filter(function (x) { return x !== taramaSayisi; });
dogru("beş binli her sayı taranan brüt sayısıyla aynı",
  yanlisTarama.length === 0, "sapan: " + yanlisTarama.join(", "));
dogru("KONTROL: taranan brüt sayısı sayfada en az iki kez geçiyor",
  (s.split(taramaSayisi).length - 1) >= 2,
  String(s.split(taramaSayisi).length - 1));

/* --- tablolar sayfada mı ------------------------------------------ */
dogru("bant tablosu satır sayısı sayfada",
  (s.match(/<tr><th scope="row">/g) || []).length ===
    bantlar.length + artislar.length,
  "beklenen " + (bantlar.length + artislar.length));

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: sayfa boş değil", s.length > 8000, String(s.length));
dogru("KONTROL: tarama beş binden fazla brüt içeriyor",
  D.tarama().length > 5000, String(D.tarama().length));
dogru("KONTROL: bantlar tüm aralığı kaplıyor",
  bantlar[0].bas === D.baslangic() &&
  bantlar[bantlar.length - 1].son === D.ADIM_SON);
dogru("KONTROL: oranlar 0 ile 100 arasında",
  [D.dibiAralikOncesiYuzde(), D.geriCikanYuzde(), D.tekduzeYuzde()]
    .every(function (v) { return isFinite(v) && v > 0 && v < 100; }));

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (dip ayı sayıları)");
process.exit(hata ? 1 : 0);
