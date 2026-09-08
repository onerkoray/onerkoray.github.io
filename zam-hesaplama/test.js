/*!
 * Zam ve Prim Çekirdeği — doğrulama testleri.
 *   node zam-hesaplama/test.js
 *
 * Bu araç bir İDDİA taşıyor: brüt zam oranı net zam oranı değildir, ve
 * primin hangi ay alındığı gelir vergisini değiştirmez. İkisi de sayfada
 * yazılı olduğu için testlerin işi bu iddiaları korumak:
 *
 *   1. Bordro hesabı motordan gelir — burada ikinci bir bordro yok.
 *   2. NORMAL BÖLGEDE (asgari ücret ile SGK tavanı arası) net zam oranı
 *      brüt zam oranından küçüktür. Bu kuralı önce "her zaman" diye
 *      yazmıştım; rastgele senaryo testi 150 denemenin 52'sinde
 *      yanlışladı. Tavan üstünde artışa SGK primi işlemediği için oran
 *      tersine dönüyor — o davranış da ayrıca korunuyor.
 *   3. Prim ayı yıllık neti değiştirmez (kümülatif sistem yıllık çalışır).
 *   4. Pazarlık çözümü TANIMIYLA sınanır: bulunan brüt geri beslendiğinde
 *      hedef net çıkmalı, %1 azı çıkmamalı.
 *   5. Zam ayı ilerledikçe yıllık net düşer (daha az ay yüksek maaş).
 */
"use strict";
var Z = require("./hesap.js");
var Motor = require("../bordro/motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }
function baslik(s) { console.log("\n" + s); }

var YIL = Motor.sonYil();

/* ------------------------------------------------------------------ 1 */
baslik("Bordro motordan geliyor, burada tekrarlanmıyor");
(function () {
  var z = Z.zam({ eskiBrut: 100000, zamYuzde: 50, zamAyi: 1, yil: YIL });
  var m = Motor.hesaplaYil(150000, YIL);
  ok("yeni brüt yıllık neti motorunkiyle birebir aynı",
     yakin(z.tamYilNet, m.toplam.net, 0.01), z.tamYilNet + " vs " + m.toplam.net);
  var e = Motor.hesaplaYil(100000, YIL);
  ok("eski brüt yıllık neti motorunkiyle birebir aynı",
     yakin(z.eskiYillikNet, e.toplam.net, 0.01));
  ok("işveren maliyeti de motordan", yakin(z.isverenMaliyetiYeni, m.toplam.isverenMaliyeti, 0.01));
  ok("yeni brüt = eski × (1 + zam)", yakin(z.yeniBrut, 150000, 0.01));
  ok("yeniBrut doğrudan verilebiliyor",
     yakin(Z.zam({ eskiBrut: 100000, yeniBrut: 123456, yil: YIL }).yeniBrut, 123456, 0.01));
})();

/* ------------------------------------------------------------------ 2 */
baslik("Net zam oranı brüt zam oranından KÜÇÜK — aracın ana iddiası");
(function () {
  /* İlk yazdığım test "her senaryoda net oran brüt orandan küçüktür"
     diyordu ve YANLIŞTI: 30.000 brütte %10 zam nete %11,98 yansıyor.
     Ölçüm üç bölge olduğunu gösterdi. Kural NORMAL BÖLGEDE geçerli —
     asgari ücret ile SGK tavanı arası, yani çalışanların çoğu. */
  var bozuk = 0, ornek = "", normalSayisi = 0;
  [40000, 50000, 75000, 100000, 150000].forEach(function (b) {
    [10, 25, 50].forEach(function (y) {
      var z = Z.zam({ eskiBrut: b, zamYuzde: y, zamAyi: 1, yil: YIL });
      if (z.bolge !== "normal") return;
      normalSayisi++;
      if (!(z.netArtisYuzde < z.brutArtisYuzde)) {
        bozuk++;
        if (!ornek) ornek = b + " brüt, %" + y + " zam → net %" + z.netArtisYuzde.toFixed(2);
      }
    });
  });
  ok("normal bölgede net oran brüt orandan küçük (" + normalSayisi + " senaryo)",
     bozuk === 0 && normalSayisi >= 10, ornek || (normalSayisi + " senaryo"));

  /* Bölgeler doğru sınıflanıyor mu — aracın kullanıcıya söylediği şey bu. */
  var P = Motor.parametre(YIL), d = Motor.donem(P, 1);
  ok("asgari ücret altı bölgesi tanınıyor",
     Z.zam({ eskiBrut: d.asgariBrut - 5000, zamYuzde: 50, yil: YIL }).bolge === "asgari-alti");
  ok("normal bölge tanınıyor",
     Z.zam({ eskiBrut: 60000, zamYuzde: 20, yil: YIL }).bolge === "normal");
  ok("tavanı aşan zam tanınıyor",
     Z.zam({ eskiBrut: d.sgkTavan - 20000, zamYuzde: 50, yil: YIL }).bolge === "tavan-asiyor");
  ok("tavan üstü tanınıyor",
     Z.zam({ eskiBrut: d.sgkTavan + 50000, zamYuzde: 50, yil: YIL }).bolge === "tavan-ustu");

  /* SGK tavanı üstünde oranın TERSİNE dönmesi bir hata değil, gerçek:
     tavanı aşan kısma SGK primi işlemiyor. Bilinen davranış olarak
     korunuyor ki ileride "düzeltilmeye" çalışılmasın. */
  var ust = Z.zam({ eskiBrut: d.sgkTavan + 100000, zamYuzde: 50, yil: YIL });
  ok("tavan üstünde net oran brüt oranı geçebiliyor (SGK yok)",
     ust.netArtisYuzde > 45, "%" + ust.netArtisYuzde.toFixed(2));

  /* Ölçülmüş somut değer — sayfada bu örnek yazıyor. */
  var z = Z.zam({ eskiBrut: 100000, zamYuzde: 50, zamAyi: 1, yil: YIL });
  ok("100.000 brütte %50 zam → net artış %40-46 arasında",
     z.netArtisYuzde > 40 && z.netArtisYuzde < 46, "%" + z.netArtisYuzde.toFixed(1));
  ok("fark puanı pozitif ve anlamlı", z.farkPuan > 3, z.farkPuan.toFixed(2));

  /* Zam sıfırsa fark da sıfır olmalı. */
  var s = Z.zam({ eskiBrut: 100000, zamYuzde: 0, zamAyi: 1, yil: YIL });
  ok("zam %0 → net artış %0", yakin(s.netArtisYuzde, 0, 0.001));
  ok("zam %0 → yıllık net fark sıfır", yakin(s.yillikNetFark, 0, 0.01));
})();

/* ------------------------------------------------------------------ 3 */
baslik("Primin ayı gelir vergisini değiştirmiyor — mitin sınavı");
(function () {
  var p = Z.prim({ brut: 100000, primBrut: 100000, yil: YIL });
  ok("on iki ay da hesaplandı", p.aylar.length === 12);
  ok("en yüksek ile en düşük ay arasında fark yok",
     p.ayFarkEdiyorMu === false, "fark: " + p.ayFarki.toFixed(4));
  ok("ocak ile aralık katkısı eşit",
     yakin(p.aylar[0].netKatki, p.aylar[11].netKatki, 0.01),
     p.aylar[0].netKatki.toFixed(2) + " vs " + p.aylar[11].netKatki.toFixed(2));

  /* Farklı maaş ve prim seviyelerinde de aynı olmalı. */
  var bozuk = 0;
  [[50000, 50000], [150000, 300000], [40000, 20000]].forEach(function (c) {
    var q = Z.prim({ brut: c[0], primBrut: c[1], yil: YIL });
    if (q.ayFarkEdiyorMu) bozuk++;
  });
  ok("üç farklı seviyede de ay fark etmiyor", bozuk === 0);

  /* Prim gerçekten net bırakıyor mu ve oranı makul mü. */
  ok("net katkı pozitif", p.enAzNet > 0);
  ok("primin net oranı %40-75 arasında",
     p.netOran > 40 && p.netOran < 75, "%" + p.netOran.toFixed(1));
  ok("prim 0 → katkı 0",
     yakin(Z.prim({ brut: 100000, primBrut: 0, yil: YIL }).enAzNet, 0, 0.01));
})();

/* ------------------------------------------------------------------ 4 */
baslik("Pazarlık — tanımıyla sınanıyor");
(function () {
  var g = Z.gerekliBrut({ eskiBrut: 100000, hedefNetArtisYuzde: 30, yil: YIL });
  ok("bir çözüm bulundu", g.gecerli === true && g.brut > 0, JSON.stringify(g).slice(0, 120));

  /* TANIM: bulunan brüt geri beslendiğinde hedef yıllık net çıkmalı. */
  var n = Motor.hesaplaYil(g.brut, YIL).toplam.net;
  ok("bulunan brüt hedef nete ulaşıyor", n >= g.hedefYillikNet - 0.01,
     n.toFixed(2) + " / " + g.hedefYillikNet.toFixed(2));
  ok("çözüm sıkı — %1 azı yetmiyor",
     Motor.hesaplaYil(g.brut * 0.99, YIL).toplam.net < g.hedefYillikNet);

  /* Net %30 artış için gereken brüt zam %30'dan BÜYÜK olmalı — aracın
     ikinci iddiası bu ve pazarlıkta işe yarayan sayı da bu. */
  ok("net %30 için gereken brüt zam %30'dan büyük",
     g.gerekenZamYuzde > 30, "%" + g.gerekenZamYuzde.toFixed(1));

  /* Aylık net hedefi de çalışmalı. */
  var a = Z.gerekliBrut({ eskiBrut: 80000, hedefAylikNet: 70000, yil: YIL });
  ok("aylık net hedefi çözülüyor", a.gecerli === true && a.brut > 0);
  ok("aylık net hedefinde yıllık net 12 katına ulaşıyor",
     a.yillikNet >= 70000 * 12 - 0.02, a.yillikNet.toFixed(2));

  ok("hedef verilmezse geçersiz", Z.gerekliBrut({ eskiBrut: 100000 }).gecerli === false);
})();

/* ------------------------------------------------------------------ 5 */
baslik("Zam ayı — yıllık nete etkisi");
(function () {
  var oncekiNet = Infinity, monoton = true;
  for (var ay = 1; ay <= 12; ay++) {
    var z = Z.zam({ eskiBrut: 50000, zamYuzde: 50, zamAyi: ay, yil: YIL });
    if (z.yeniYillikNet > oncekiNet + 0.01) monoton = false;
    oncekiNet = z.yeniYillikNet;
  }
  ok("zam ayı ilerledikçe yıllık net düşüyor", monoton);

  var ocak = Z.zam({ eskiBrut: 50000, zamYuzde: 50, zamAyi: 1, yil: YIL });
  var aralik = Z.zam({ eskiBrut: 50000, zamYuzde: 50, zamAyi: 12, yil: YIL });
  ok("ocakta zam, aralıkta zamdan çok kazandırıyor",
     ocak.yillikNetFark > aralik.yillikNetFark * 5,
     ocak.yillikNetFark.toFixed(0) + " vs " + aralik.yillikNetFark.toFixed(0));

  /* Zam ayı ORANI kirletmemeli: net artış oranı tam yıl üzerinden ölçülür. */
  ok("net artış oranı zam ayından bağımsız",
     yakin(ocak.netArtisYuzde, aralik.netArtisYuzde, 0.001),
     ocak.netArtisYuzde.toFixed(4) + " vs " + aralik.netArtisYuzde.toFixed(4));

  ok("zam ayı 1'in altına inmiyor", Z.zam({ eskiBrut: 50000, zamAyi: 0, yil: YIL }).zamAyi === 1);
  ok("zam ayı 12'yi aşmıyor", Z.zam({ eskiBrut: 50000, zamAyi: 99, yil: YIL }).zamAyi === 12);
})();

/* ------------------------------------------------------------------ 6 */
baslik("Yıl seçimi ve sayı ayrıştırma");
(function () {
  ok("geçersiz yıl son yıla düşüyor", Z.zam({ eskiBrut: 50000, yil: 1999 }).yil === Motor.sonYil());
  ok("geçerli yıl korunuyor", Z.zam({ eskiBrut: 50000, yil: YIL }).yil === YIL);
  ok('"100.000" → 100000', Z.sayi("100.000") === 100000);
  ok('"1.234,56" → 1234.56', Z.sayi("1.234,56") === 1234.56);
  ok('boş → 0', Z.sayi("") === 0);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Rastgele 150 senaryoda değişmezler");
(function () {
  function r(a, b) { return a + Math.random() * (b - a); }
  var bozuk = 0, ornek = "";
  for (var i = 0; i < 150; i++) {
    var b = Math.round(r(30000, 400000));
    var y = r(1, 120);
    var ay = Math.floor(r(1, 13));
    var z = Z.zam({ eskiBrut: b, zamYuzde: y, zamAyi: ay, yil: YIL });
    /* Kural yalnızca normal bölgede aranır (bkz. yukarıdaki not). */
    var netKucuk = z.bolge !== "normal" || z.netArtisYuzde < z.brutArtisYuzde + 1e-9;
    var farkPozitif = z.yillikNetFark >= -0.01;
    var brutDogru = Math.abs(z.yeniBrut - b * (1 + y / 100)) <= 0.01;
    var aralik = z.zamAyi >= 1 && z.zamAyi <= 12;
    var bolgeGecerli = ["asgari-alti", "normal", "tavan-asiyor", "tavan-ustu"]
      .indexOf(z.bolge) > -1;
    if (!netKucuk || !farkPozitif || !brutDogru || !aralik || !bolgeGecerli) {
      bozuk++;
      if (!ornek) ornek = JSON.stringify({ b: b, y: y.toFixed(2), ay: ay });
    }
  }
  ok("150 senaryoda bölge geçerli, normal bölgede net oran < brüt oran", bozuk === 0,
     bozuk + " senaryo tutmadı " + ornek);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
