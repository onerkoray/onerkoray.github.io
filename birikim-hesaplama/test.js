/*!
 * Birikim Çekirdeği — doğrulama testleri.  node birikim-hesaplama/test.js
 *
 * Bir birikim hesabında yanlış sayı sessizdir: grafik yükselir, tablo
 * dolar, hata ancak otuz yıl sonra anlaşılır. Testler beş değişmezi
 * koruyor:
 *   1. Reel getiri FISHER'dır — çıkarma değil. (Aracın var oluş sebebi.)
 *   2. Aylık oran yıllık oranın 12. KÖKÜdür — bölümü değil.
 *   3. Katkı + getiri = bakiye, kuruşu kuruşuna.
 *   4. Devlet katkısı tavanı ve hak kazanma oranları uygulanır.
 *   5. Hedef çözümü TANIMIYLA sınanır: bulunan katkı geri beslendiğinde
 *      hedefe ulaşmalı. (Kredi aracında YMO'nun yönü tam bu yüzden
 *      yanlış kalmıştı; orada da tanımı sınayan test yakalamıştı.)
 */
"use strict";
var B = require("./hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }
function baslik(s) { console.log("\n" + s); }

/* ------------------------------------------------------------------ 1 */
baslik("Reel getiri — Fisher, çıkarma değil");
(function () {
  /* %45 getiri, %40 enflasyon. Çıkarma "%5" der. Doğrusu 1,45/1,40−1. */
  var r = B.reelOran(45, 40);
  ok("%45 / %40 → %3,571 (çıkarmanın dediği %5 DEĞİL)", yakin(r, 0.0357142857, 1e-9),
     (r * 100).toFixed(4));
  ok("çıkarma sonucundan belirgin küçük", r < 0.05 - 0.01);

  /* Enflasyon getiriden büyükse reel getiri negatiftir. */
  ok("%20 getiri / %40 enflasyon → negatif", B.reelOran(20, 40) < 0);
  ok("enflasyon sıfırsa reel = nominal", yakin(B.reelOran(30, 0), 0.30, 1e-12));
  ok("getiri = enflasyon → reel sıfır", yakin(B.reelOran(40, 40), 0, 1e-12));

  /* Düşük enflasyonda çıkarma yaklaşık doğrudur; hatanın enflasyonla
     büyüdüğünü gösteriyoruz — aracın anlattığı şey bu. */
  var kucuk = Math.abs(B.reelOran(5, 2) - 0.03);
  var buyuk = Math.abs(B.reelOran(45, 40) - 0.05);
  ok("çıkarma hatası enflasyonla büyüyor", buyuk > kucuk * 5,
     kucuk.toFixed(5) + " → " + buyuk.toFixed(5));
})();

/* ------------------------------------------------------------------ 2 */
baslik("Aylık oran — 12. kök, bölme değil");
(function () {
  var a = B.aylikOran(30);
  ok("%30 yıllık → aylık %2,2104 (bölmenin dediği %2,5 DEĞİL)",
     yakin(a, 0.0221045, 1e-6), (a * 100).toFixed(4));
  ok("bölmeden küçük", a < 0.30 / 12);
  /* Tanım sınavı: aylık oran 12 kez bileşiklenince yıllığı vermeli. */
  ok("(1+aylık)^12 = 1+yıllık", yakin(Math.pow(1 + a, 12), 1.30, 1e-12));
  ok("%0 → 0", B.aylikOran(0) === 0);
})();

/* ------------------------------------------------------------------ 3 */
baslik("Birikim büyütme");
(function () {
  /* Getiri sıfırsa bakiye tam olarak yatırılan paradır. */
  var s = B.buyut({ baslangic: 10000, aylikKatki: 1000, yillikGetiriYuzde: 0,
                    yillikEnflasyonYuzde: 0, yilSayisi: 5, katkiArtisYuzde: 0 });
  ok("getiri %0 → bakiye = başlangıç + katkılar",
     yakin(s.brutBakiye, 10000 + 1000 * 60, 0.001), s.brutBakiye.toFixed(2));
  ok("getiri %0 → toplam getiri sıfır", s.toplamGetiri === 0);

  /* Kuruşu kuruşuna kapanma. */
  var t = B.buyut({ baslangic: 25000, aylikKatki: 2500, yillikGetiriYuzde: 32,
                    yillikEnflasyonYuzde: 28, yilSayisi: 12, katkiArtisYuzde: 25 });
  ok("katkı + getiri = brüt bakiye (kuruşu kuruşuna)",
     yakin(t.toplamKatki + t.toplamGetiri, t.brutBakiye, 0.001),
     (t.toplamKatki + t.toplamGetiri).toFixed(2) + " ≠ " + t.brutBakiye.toFixed(2));
  ok("yıl satırı sayısı = yıl sayısı", t.yillar.length === 12);
  ok("son yıl bakiyesi brüt bakiyeye eşit",
     yakin(t.yillar[11].bakiye, t.brutBakiye, 0.001));

  /* Stopaj yalnızca getiriden alınır, anaparadan değil. */
  var v = B.buyut({ baslangic: 100000, aylikKatki: 0, yillikGetiriYuzde: 20,
                    yillikEnflasyonYuzde: 0, yilSayisi: 1, stopajYuzde: 15 });
  ok("stopaj = getiri × oran", yakin(v.stopaj, v.toplamGetiri * 0.15, 0.02),
     v.stopaj.toFixed(2) + " vs " + (v.toplamGetiri * 0.15).toFixed(2));
  ok("net = brüt − stopaj", yakin(v.netBakiye, v.brutBakiye - v.stopaj, 0.001));
  ok("stopaj anaparaya dokunmuyor", v.netBakiye > 100000);

  /* Reel bakiye: enflasyon sıfırken nominalle aynı, pozitifken küçük. */
  var e0 = B.buyut({ baslangic: 50000, aylikKatki: 0, yillikGetiriYuzde: 10,
                     yillikEnflasyonYuzde: 0, yilSayisi: 10 });
  ok("enflasyon %0 → reel = nominal", yakin(e0.reelNetBakiye, e0.netBakiye, 0.01));
  var e1 = B.buyut({ baslangic: 50000, aylikKatki: 0, yillikGetiriYuzde: 10,
                     yillikEnflasyonYuzde: 40, yilSayisi: 10 });
  ok("enflasyon > getiri → reel bakiye başlangıçtan küçük",
     e1.reelNetBakiye < 50000, e1.reelNetBakiye.toFixed(2));

  /* Katkı artışı gerçekten uygulanıyor mu. */
  var a0 = B.buyut({ aylikKatki: 1000, yillikGetiriYuzde: 0, yilSayisi: 3, katkiArtisYuzde: 0 });
  var a1 = B.buyut({ aylikKatki: 1000, yillikGetiriYuzde: 0, yilSayisi: 3, katkiArtisYuzde: 20 });
  ok("katkı artışı toplamı büyütüyor", a1.toplamKatki > a0.toplamKatki);
  ok("2. yıl katkısı 1. yılın %20 fazlası",
     yakin(a1.yillar[1].katki, a1.yillar[0].katki * 1.2, 1), a1.yillar[1].katki.toFixed(2));

  ok("yıl 0 → boş sonuç", B.buyut({ yilSayisi: 0, baslangic: 5000 }).yillar.length === 0);
})();

/* ------------------------------------------------------------------ 4 */
baslik("BES — devlet katkısı, tavan, hak kazanma");
(function () {
  /* Asgari ücreti buraya yazmak bir kopya olurdu ve sessizce eskirdi;
     tek doğruluk kaynağı bordro/parametreler.js. */
  var P = require("../bordro/parametreler.js");
  var asgari = P[2026].donemler[0].asgariBrut;

  /* Tavanın altında: devlet katkısı katkının tam %30'u. */
  var a = B.bes({ aylikKatki: 1000, yilSayisi: 1, yillikGetiriYuzde: 0,
                  fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: 30,
                  katkiArtisYuzde: 0, asgariArtisYuzde: 0, yillikEnflasyonYuzde: 0 });
  ok("tavan altında → devlet katkısı = katkı × %30",
     yakin(a.toplamDevletKatkisi, 12000 * 0.30, 0.02), a.toplamDevletKatkisi.toFixed(2));
  ok("tavan kesintisi yok", a.tavanNedeniyleAlinamayan === 0);

  /* Tavanın üstünde: aşan kısma katkı verilmez. */
  var tavan = asgari * 12;                       // 396.360
  var b = B.bes({ aylikKatki: 50000, yilSayisi: 1, yillikGetiriYuzde: 0,
                  fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: 30,
                  katkiArtisYuzde: 0, asgariArtisYuzde: 0, yillikEnflasyonYuzde: 0 });
  ok("tavan üstünde → katkı tavana göre hesaplanıyor",
     yakin(b.toplamDevletKatkisi, tavan * 0.30, 0.02), b.toplamDevletKatkisi.toFixed(2));
  ok("tavan nedeniyle alınamayan doğru",
     yakin(b.tavanNedeniyleAlinamayan, 600000 - tavan, 0.02),
     b.tavanNedeniyleAlinamayan.toFixed(2));

  /* Hak kazanma kademeleri. */
  function hak(yil) {
    return B.bes({ aylikKatki: 1000, yilSayisi: yil, yillikGetiriYuzde: 0,
                   fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: 30,
                   katkiArtisYuzde: 0, asgariArtisYuzde: 0, yillikEnflasyonYuzde: 0 })
            .senaryolar.simdi.hakKazanmaOrani;
  }
  ok("2 yıl → %0", hak(2) === 0);
  ok("3 yıl → %15", hak(3) === 0.15);
  ok("5 yıl → %15", hak(5) === 0.15);
  ok("6 yıl → %35", hak(6) === 0.35);
  ok("10 yıl → %60", hak(10) === 0.60);
  ok("15 yıl → %60 (tablo tavanı)", hak(15) === 0.60);

  /* Emeklilik şartı: yaş VE süre birlikte. */
  function emekli(yas, yil) {
    return B.bes({ aylikKatki: 1000, yilSayisi: yil, yillikGetiriYuzde: 0,
                   fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: yas,
                   katkiArtisYuzde: 0, asgariArtisYuzde: 0 }).emekliOlabilir;
  }
  ok("50 yaş + 10 yıl → emekli olunur (60 yaşında)", emekli(50, 10) === true);
  ok("30 yaş + 10 yıl → yaş tutmuyor", emekli(30, 10) === false);
  ok("55 yaş + 5 yıl → süre tutmuyor", emekli(55, 5) === false);
  ok("46 yaş + 10 yıl → tam sınırda (56) tutuyor", emekli(46, 10) === true);

  /* Emeklilikte devlet katkısının tamamı alınır ve stopaj %5'e düşer. */
  var em = B.bes({ aylikKatki: 2000, yilSayisi: 12, yillikGetiriYuzde: 30,
                   fonKesintiYuzde: 1.9, brutAsgariAylik: asgari, yas: 48,
                   katkiArtisYuzde: 25, asgariArtisYuzde: 25, yillikEnflasyonYuzde: 25 });
  ok("emeklilikte hak kazanma %100", em.senaryolar.emeklilik.hakKazanmaOrani === 1);
  ok("emeklilikte stopaj %5", em.senaryolar.emeklilik.stopajYuzde === 5);
  ok("emeklilikte kaybedilen devlet katkısı yok",
     yakin(em.senaryolar.emeklilik.devletKaybedilen, 0, 0.01));
  ok("erken çıkışta net, emeklilikteki nettten küçük",
     em.senaryolar.simdi.net < em.senaryolar.emeklilik.net);

  /* Fon kesintisi bakiyeyi gerçekten düşürüyor. */
  var k0 = B.bes({ aylikKatki: 1000, yilSayisi: 10, yillikGetiriYuzde: 30,
                   fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: 30 });
  var k1 = B.bes({ aylikKatki: 1000, yilSayisi: 10, yillikGetiriYuzde: 30,
                   fonKesintiYuzde: 2, brutAsgariAylik: asgari, yas: 30 });
  ok("fon kesintisi bakiyeyi düşürüyor", k1.brutToplam < k0.brutToplam);

  /* Devlet katkısı gerçekten bir kazanç: aynı katkıyla BES'siz büyütmeden
     fazla olmalı (kesinti sıfırken). */
  var besBak = B.bes({ aylikKatki: 1000, yilSayisi: 10, yillikGetiriYuzde: 20,
                       fonKesintiYuzde: 0, brutAsgariAylik: asgari, yas: 46,
                       katkiArtisYuzde: 0, asgariArtisYuzde: 0 }).brutToplam;
  var duz = B.buyut({ aylikKatki: 1000, yillikGetiriYuzde: 20, yilSayisi: 10,
                      katkiArtisYuzde: 0 }).brutBakiye;
  ok("devlet katkısı toplamı büyütüyor", besBak > duz * 1.2,
     besBak.toFixed(0) + " vs " + duz.toFixed(0));
})();

/* ------------------------------------------------------------------ 5 */
baslik("Hedef — tanımıyla sınanıyor");
(function () {
  /* Hedef BUGUNKU parayla veriliyor: 20 yil sonra bugunun 5 milyonu.
     Baslangic bakiyesi tek basina buna yetmez, yani cozum gercekten
     aranir. (Ilk yazdigim senaryoda 50.000 TL %35 ile zaten hedefi
     asiyordu ve arac hakli olarak "katki gerekmiyor" diyordu -- cekirdek
     dogruydu, test yanlisti.) */
  var g = { hedefTutar: 5000000, hedefBugunku: true, yilSayisi: 20,
            yillikGetiriYuzde: 35, yillikEnflasyonYuzde: 30,
            katkiArtisYuzde: 25, baslangic: 50000, stopajYuzde: 0 };
  var h = B.hedef(g);
  ok("bir çözüm bulundu", h.yeterli === true && h.gerekliAylik > 0,
     JSON.stringify(h).slice(0, 120));

  /* TANIM: bulunan katkı geri beslendiğinde hedefe ulaşmalı. */
  var kontrol = B.buyut({ baslangic: g.baslangic, aylikKatki: h.gerekliAylik,
                          katkiArtisYuzde: g.katkiArtisYuzde,
                          yillikGetiriYuzde: g.yillikGetiriYuzde,
                          yillikEnflasyonYuzde: g.yillikEnflasyonYuzde,
                          yilSayisi: g.yilSayisi, stopajYuzde: g.stopajYuzde }).netBakiye;
  ok("bulunan katkı hedefe ulaştırıyor", kontrol >= h.hedefNominal * 0.9999,
     kontrol.toFixed(0) + " / " + h.hedefNominal.toFixed(0));
  ok("çözüm sıkı — %1 azı yetmiyor",
     B.buyut({ baslangic: g.baslangic, aylikKatki: h.gerekliAylik * 0.99,
               katkiArtisYuzde: g.katkiArtisYuzde,
               yillikGetiriYuzde: g.yillikGetiriYuzde,
               yillikEnflasyonYuzde: g.yillikEnflasyonYuzde,
               yilSayisi: g.yilSayisi, stopajYuzde: g.stopajYuzde }).netBakiye < h.hedefNominal);

  /* "Bugünkü parayla" hedef, geleceğe taşınmalı. */
  var bg = B.hedef({ hedefTutar: 1000000, hedefBugunku: true, yilSayisi: 10,
                     yillikGetiriYuzde: 30, yillikEnflasyonYuzde: 25,
                     katkiArtisYuzde: 0 });
  ok("bugünkü hedef nominale taşınıyor",
     yakin(bg.hedefNominal, 1000000 * Math.pow(1.25, 10), 1),
     bg.hedefNominal.toFixed(0));
  ok("bugünkü hedef nominalden küçük", bg.hedefNominal > 1000000);

  /* Başlangıç zaten yetiyorsa katkı sıfırdır. */
  var yeter = B.hedef({ hedefTutar: 1000, yilSayisi: 5, baslangic: 100000,
                        yillikGetiriYuzde: 0, yillikEnflasyonYuzde: 0 });
  ok("başlangıç yetiyorsa gerekli katkı sıfır", yeter.gerekliAylik === 0);
})();

/* ------------------------------------------------------------------ 6 */
baslik("Tüketim — birikim kaç yıl yeter");
(function () {
  /* Getiri ve enflasyon sıfırsa süre basit bölmedir. */
  var t = B.tuketim({ baslangic: 120000, aylikCekim: 1000, yillikGetiriYuzde: 0,
                      yillikEnflasyonYuzde: 0, enAzYil: 30 });
  ok("getiri/enflasyon %0 → 120 ay dayanır", t.dayandigiAy === 120, String(t.dayandigiAy));
  ok("tükendi olarak işaretlendi", t.tukendi === true);

  /* Sürdürülebilir çekim TANIMI: reel getiri kadar çekmek anaparayı korur.
     Bu tutarla otuz yıl sonunda bakiye başlangıcın altına düşmemeli. */
  var s = B.tuketim({ baslangic: 1000000, aylikCekim: 0, yillikGetiriYuzde: 40,
                      yillikEnflasyonYuzde: 30, enAzYil: 30 });
  ok("reel getiri pozitifken sürdürülebilir çekim var", s.surdurulebilirAylik > 0);
  var sz = B.tuketim({ baslangic: 1000000, aylikCekim: s.surdurulebilirAylik,
                       yillikGetiriYuzde: 40, yillikEnflasyonYuzde: 30, enAzYil: 30 });
  ok("sürdürülebilir çekimle 30 yıl tükenmiyor", sz.tukendi === false,
     "ay: " + sz.dayandigiAy);

  /* Reel getiri negatifse sürdürülebilir çekim YOKTUR. */
  var n = B.tuketim({ baslangic: 1000000, aylikCekim: 5000, yillikGetiriYuzde: 20,
                      yillikEnflasyonYuzde: 40, enAzYil: 30 });
  ok("reel getiri negatif → sürdürülebilir çekim 0", n.surdurulebilirAylik === 0);
  ok("reel oran negatif raporlanıyor", n.reelYillikOran < 0);

  /* Çekim enflasyonla artıyor mu. */
  var e = B.tuketim({ baslangic: 10000000, aylikCekim: 10000, yillikGetiriYuzde: 30,
                      yillikEnflasyonYuzde: 25, enAzYil: 5 });
  ok("çekim tutarı yıllar içinde artıyor",
     e.yillar.length > 1 && e.yillar[1].aylikCekim > e.yillar[0].aylikCekim);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Sayı ayrıştırma — diğer çekirdeklerle aynı davranış");
(function () {
  ok('"1.234,56" → 1234.56', B.sayi("1.234,56") === 1234.56);
  ok('"1.234" → 1234 (binlik)', B.sayi("1.234") === 1234);
  ok('"1234.56" → 1234.56 (ondalık nokta)', B.sayi("1234.56") === 1234.56);
  ok('"₺ 2.500" → 2500', B.sayi("₺ 2.500") === 2500);
  ok('boş → 0', B.sayi("") === 0);
  ok('saçma → 0', B.sayi("abc") === 0);
})();

/* ------------------------------------------------------------------ 8 */
baslik("Rastgele 300 senaryoda değişmezler");
(function () {
  function r(a, b) { return a + Math.random() * (b - a); }
  var bozuk = 0, asan = 0, ornek = "";
  for (var i = 0; i < 300; i++) {
    var g = {
      baslangic: Math.round(r(0, 500000)),
      aylikKatki: Math.round(r(100, 50000)),
      yillikGetiriYuzde: r(0, 60),
      yillikEnflasyonYuzde: r(0, 60),
      katkiArtisYuzde: r(0, 50),
      yilSayisi: Math.floor(r(1, 40)),
      stopajYuzde: r(0, 20)
    };
    var s = B.buyut(g);
    /* Tamsayı kuruş kesinliği aşıldığında eşitlik zaten korunamaz — o
       durumda beklentimiz eşitlik değil, BAYRAĞIN KALKMIŞ olması. */
    var kapaniyor = s.hassasiyetAsildi ||
                    Math.abs((s.toplamKatki + s.toplamGetiri) - s.brutBakiye) <= 0.01;
    var netTutar = s.hassasiyetAsildi ||
                   Math.abs((s.brutBakiye - s.stopaj) - s.netBakiye) <= 0.01;
    var getiriPozitif = s.toplamGetiri >= -0.01;
    if (s.hassasiyetAsildi) asan++;
    if (!kapaniyor || !netTutar || !getiriPozitif) {
      bozuk++;
      if (!ornek) ornek = JSON.stringify(g);
    }
  }
  ok("300 senaryoda katkı+getiri=bakiye ve net=brüt−stopaj", bozuk === 0,
     bozuk + " senaryo tutmadı " + ornek);
})();

/* ------------------------------------------------------------------ 9 */
baslik("Kuruş kesinliği sınırı bildiriliyor");
(function () {
  /* Gerçekçi bir planda bayrak kalkmamalı. */
  var normal = B.buyut({ baslangic: 100000, aylikKatki: 10000, yillikGetiriYuzde: 35,
                         yillikEnflasyonYuzde: 30, katkiArtisYuzde: 25, yilSayisi: 30 });
  ok("gerçekçi planda bayrak kalkmıyor", normal.hassasiyetAsildi === false);
  ok("gerçekçi planda kuruşu kuruşuna kapanıyor",
     yakin(normal.toplamKatki + normal.toplamGetiri, normal.brutBakiye, 0.001));

  /* Uç parametrelerde kalkmalı — sessizce yanlış sayı dönmemeli.
     Bu senaryoyu rastgele test yakalamıştı; artık sabit bir test. */
  var uc = B.buyut({ baslangic: 391808, aylikKatki: 16965, yillikGetiriYuzde: 57.1,
                     yillikEnflasyonYuzde: 55, katkiArtisYuzde: 49.7, yilSayisi: 38 });
  ok("uç parametrelerde bayrak kalkıyor", uc.hassasiyetAsildi === true,
     uc.brutBakiye.toExponential(2));
  ok("BES sonucunda da bayrak var", "hassasiyetAsildi" in
     B.bes({ aylikKatki: 1000, yilSayisi: 5, yillikGetiriYuzde: 20,
             brutAsgariAylik: require("../bordro/parametreler.js")[2026].donemler[0].asgariBrut,
             yas: 30 }));
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
