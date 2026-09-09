/*!
 * Vergi Kaması Çekirdeği — doğrulama testleri.
 *   node vergi-kamasi-hesaplama/test.js
 *
 * Bu çekirdeğin çıktısı her girdi için "makul bir yüzde" olduğu için hata
 * SESSİZDİR. Testlerin ağırlık merkezi bu yüzden ölçümü BAĞIMSIZ BİR YOLDAN
 * doğrulamaktır:
 *
 *   1. Bileşenler toplamı kamayı kuruşu kuruşuna vermeli.
 *   2. Marjinal oranlar mevzuattan KAPALI FORMLA türetilebilir; ölçülen ile
 *      türetilen örtüşmezse ya motor ya çekirdek yanlıştır.
 *   3. Tavanın üstünde iki marjinal ölçü EŞİTLENMELİ (işveren de ilave prim
 *      ödemediği için). Bu, modelin kendi içinde tutarlılık kontrolü.
 *   4. Aracın ana iddiası — kamanın tavanda zirve yapıp düşmesi — iddia
 *      değil ölçüm olarak sınanır.
 */
"use strict";
var K = require("./hesap.js");
var B = require("../bordro/motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= t; }
function baslik(s) { console.log("\n" + s); }

var YIL = 2026;
var P = B.parametre(YIL);
var D = P.donemler[P.donemler.length - 1];

/* ------------------------------------------------------------------ 1 */
baslik("Tanım: kama = (maliyet − net) ÷ maliyet");
(function () {
  var n = K.nokta(100000, YIL);
  var r = B.hesaplaYil(100000, YIL).toplam;
  ok("kama doğrudan motordan yeniden hesaplanabiliyor",
     yakin(n.ortalamaKama, (r.isverenMaliyeti - r.net) / r.isverenMaliyeti, 1e-12));
  ok("çalışan bakışı brüt tabanlı",
     yakin(n.ortalamaCalisanOrani, (100000 * 12 - r.net) / (100000 * 12), 1e-12));
  ok("kama, çalışan oranından büyük (işveren primi paydada)",
     n.ortalamaKama > n.ortalamaCalisanOrani);
})();

/* ------------------------------------------------------------------ 2 */
baslik("Bileşenler toplamı kamayı vermeli — kuruşu kuruşuna");
(function () {
  [D.asgariBrut, 60000, 100000, 250000, D.sgkTavan, 500000].forEach(function (b) {
    var n = K.nokta(b, YIL);
    var t = n.bilesen.isverenPrim + n.bilesen.isciPrim +
            n.bilesen.gelirVergisi + n.bilesen.damga;
    ok(b + " TL: bileşenler = maliyet − net",
       yakin(t, n.yillikMaliyet - n.yillikNet, 0.01),
       t.toFixed(2) + " vs " + (n.yillikMaliyet - n.yillikNet).toFixed(2));
  });
})();

/* ------------------------------------------------------------------ 3 */
baslik("KAPALI FORM — ölçülen ile türetilen örtüşüyor mu");
(function () {
  /* Tavanın altında dilim oranı ay ay değişir; bandın ortasında sabit
     kaldığı bir ücret seçip oradaki marjinali türetmeyle kıyaslıyoruz.
     Ölçümde kullanılan dilim, adım sonrası ayın dilimidir. */
  [60000, 100000, 200000].forEach(function (b) {
    var n = K.nokta(b, YIL);
    var son = n.dilimler[n.dilimler.length - 1];
    var bekle = K.kapaliForm(son, YIL, false);
    ok(b + " TL: marjinal çalışan oranı kapalı formla uyuşuyor (dilim %" +
       (son * 100).toFixed(0) + ")",
       yakin(n.marjinalCalisan, bekle, 0.012),
       (n.marjinalCalisan * 100).toFixed(2) + " vs " + (bekle * 100).toFixed(2));
  });

  /* Tavanın üstünde prim yok: formül dilim + damgaya iner. */
  var u = K.nokta(D.sgkTavan * 1.4, YIL);
  var sonU = u.dilimler[u.dilimler.length - 1];
  ok("tavan üstü: marjinal = dilim + damga",
     yakin(u.marjinalCalisan, K.kapaliForm(sonU, YIL, true), 0.012),
     (u.marjinalCalisan * 100).toFixed(2) + " vs " +
     (K.kapaliForm(sonU, YIL, true) * 100).toFixed(2));

  ok("kapalı form damga oranını parametreden okuyor",
     yakin(K.kapaliForm(0, YIL, true), K.damgaOrani(YIL), 1e-12));
  ok("işçi prim oranı 2026'da %15", yakin(K.isciPrimOrani(YIL), 0.15, 1e-12));
})();

/* ------------------------------------------------------------------ 4 */
baslik("Tavanın üstünde iki marjinal ölçü eşitlenmeli");
(function () {
  var alt = K.nokta(100000, YIL);
  ok("tavan ALTINDA kama, çalışan marjinalinden büyük",
     alt.marjinalKama > alt.marjinalCalisan + 0.05,
     (alt.marjinalKama * 100).toFixed(2) + " vs " + (alt.marjinalCalisan * 100).toFixed(2));

  var ust = K.nokta(D.sgkTavan * 1.3, YIL);
  ok("tavan ÜSTÜNDE ikisi eşit (işveren de ilave prim ödemiyor)",
     yakin(ust.marjinalKama, ust.marjinalCalisan, 1e-9),
     (ust.marjinalKama * 100).toFixed(4) + " vs " + (ust.marjinalCalisan * 100).toFixed(4));
  ok("tavan üstü nokta tavanda işaretleniyor", ust.tavanda === true);
  ok("tavan altı nokta işaretlenmiyor", K.nokta(100000, YIL).tavanda === false);
})();

/* ------------------------------------------------------------------ 5 */
baslik("ANA İDDİA — zirve tavanda, sonrasında düşüş");
(function () {
  var e = K.egri({ yil: YIL, alt: D.asgariBrut, ust: D.sgkTavan * 2, adet: 40 });
  ok("zirve tam SGK tavanında",
     yakin(e.zirve.aylikBrut, D.sgkTavan, 1),
     e.zirve.aylikBrut.toFixed(0) + " vs " + D.sgkTavan);
  ok("zirveden sonra kama düşüyor", e.zirveSonrasiDusuyor === true);
  ok("tavana kadar kama artıyor (asgari < tavan)",
     e.noktalar[0].ortalamaKama < e.zirve.ortalamaKama - 0.05);

  /* Yeterince yüksek ücrette ortalama kama orta gelir düzeyine iniyor:
     yazının çarpıcı bulgusu. */
  var orta = K.nokta(100000, YIL).ortalamaKama;
  var cok = K.nokta(1000000, YIL).ortalamaKama;
  ok("1.000.000 TL'de kama, 100.000 TL'dekinin altına iniyor", cok < orta,
     (cok * 100).toFixed(2) + " vs " + (orta * 100).toFixed(2));
})();

/* ------------------------------------------------------------------ 6 */
baslik("Asgari ücret istisnasının oransal erimesi");
(function () {
  var oncekiOran = Infinity, monoton = true;
  [D.asgariBrut, 60000, 100000, 200000, 400000, 800000].forEach(function (b) {
    var o = K.nokta(b, YIL).istisnaOrani;
    if (o > oncekiOran + 1e-9) monoton = false;
    oncekiOran = o;
  });
  ok("istisna/gelir oranı gelir arttıkça hep azalıyor", monoton);
  ok("asgari ücrette istisna oranı en yüksek",
     K.nokta(D.asgariBrut, YIL).istisnaOrani > K.nokta(500000, YIL).istisnaOrani * 5);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Beş puanlık işveren indirimi (5510 m.81/ı)");
(function () {
  var a = K.nokta(100000, YIL);
  var t = K.nokta(100000, YIL, { tesvik5Puan: true });
  ok("teşvik kamayı düşürüyor", t.ortalamaKama < a.ortalamaKama,
     (t.ortalamaKama * 100).toFixed(2) + " < " + (a.ortalamaKama * 100).toFixed(2));
  ok("teşvik net ücreti DEĞİŞTİRMİYOR (işveren tarafı)",
     yakin(t.yillikNet, a.yillikNet, 0.01));

  /* İndirim sabit puanlı olduğu için düşük ücrette oransal etkisi büyük.
     Bu, indirimin kendisinin de düşük ücrete daha çok yaradığını gösterir. */
  var dAsgari = K.nokta(D.asgariBrut, YIL).ortalamaKama -
                K.nokta(D.asgariBrut, YIL, { tesvik5Puan: true }).ortalamaKama;
  var dYuksek = K.nokta(500000, YIL).ortalamaKama -
                K.nokta(500000, YIL, { tesvik5Puan: true }).ortalamaKama;
  ok("indirimin etkisi asgari ücrette daha büyük", dAsgari > dYuksek,
     (dAsgari * 100).toFixed(2) + " vs " + (dYuksek * 100).toFixed(2));
})();

/* ------------------------------------------------------------------ 8 */
baslik("Dilim geçişi ve kümülatif matrah");
(function () {
  var n = K.nokta(100000, YIL);
  ok("dilim geçiş ayları raporlanıyor", n.dilimGecisAylari.length > 0,
     n.dilimGecisAylari.join(","));
  ok("12 aylık dilim dizisi dönüyor", n.dilimler.length === 12);
  ok("dilim dizisi hiç azalmıyor (kümülatif matrah artar)",
     n.dilimler.every(function (d, i) { return i === 0 || d >= n.dilimler[i - 1]; }));

  /* Asgari ücretlide de dilim geçişi olur; olmadığını varsaymak yanlıştı. */
  ok("asgari ücrette de dilim geçişi görülüyor",
     K.nokta(D.asgariBrut, YIL).dilimGecisAylari.length > 0);
})();

/* ------------------------------------------------------------------ 9 */
baslik("Eğri kurulumu ve uç durumlar");
(function () {
  var e = K.egri({ yil: YIL, adet: 5 });
  ok("nokta sayısı en az istenen kadar (tavan ayrıca ekleniyor)",
     e.noktalar.length >= 5);
  ok("noktalar artan sırada",
     e.noktalar.every(function (n, i) {
       return i === 0 || n.aylikBrut >= e.noktalar[i - 1].aylikBrut;
     }));
  ok("adet alt sınırı uygulanıyor", K.egri({ yil: YIL, adet: 1 }).noktalar.length >= 4);
  ok("adet üst sınırı uygulanıyor", K.egri({ yil: YIL, adet: 9999 }).noktalar.length <= 121);
  ok("üst sınır alttan küçükse düzeltiliyor",
     K.egri({ yil: YIL, alt: 100000, ust: 1000, adet: 6 }).noktalar.length >= 4);

  var sifir = K.nokta(0, YIL);
  ok("sıfır ücrette NaN üretilmiyor",
     isFinite(sifir.ortalamaKama) && isFinite(sifir.marjinalKama));
  ok('"1.234,56" → 1234.56', K.sayi("1.234,56") === 1234.56);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
