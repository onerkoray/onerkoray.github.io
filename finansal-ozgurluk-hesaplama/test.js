/*!
 * FIRE Simülasyon Çekirdeği — doğrulama testleri.
 *   node finansal-ozgurluk-hesaplama/test.js
 *
 * Monte Carlo'da hata sessizdir: sonuç her zaman makul bir yüzde olarak
 * çıkar. Testler bu yüzden çoğunlukla İSTATİSTİKSEL DEĞİŞMEZLERİ ve
 * TANIMLARI sınıyor:
 *
 *   1. Tohum aynıysa sonuç aynı (tekrar edilebilirlik).
 *   2. Üreteçlerin ortalaması ve VARYANSI doğru — Student-t birim
 *      varyansa ölçekleniyor, yoksa kullanıcının girdiği standart sapma
 *      sessizce büyürdü.
 *   3. Üretilen getiri/enflasyon korelasyonu istenen değere yakın.
 *   4. Belirsizlik sıfırken sonuç elle hesaplanabilir yola eşit.
 *   5. Güvenli çekim ve gereken birikim TANIMIYLA sınanır.
 */
"use strict";
var F = require("./hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= t; }
function baslik(s) { console.log("\n" + s); }

function G(ek) {
  var g = {
    baslangic: 5000000, aylikKatki: 0, aylikCekim: 40000,
    emeklilikYili: 0, emeklilikSuresi: 30,
    getiriOrtYuzde: 40, getiriSapmaYuzde: 20,
    enflasyonOrtYuzde: 30, enflasyonSapmaYuzde: 12,
    korelasyon: 0.5, yolSayisi: 600, tohum: 42
  };
  for (var k in (ek || {})) g[k] = ek[k];
  return g;
}

/* ------------------------------------------------------------------ 1 */
baslik("Tekrar edilebilirlik — tohumlu üreteç");
(function () {
  var a = F.calistir(G()), b = F.calistir(G());
  ok("aynı tohum → aynı başarı oranı", a.basariOrani === b.basariOrani);
  ok("aynı tohum → aynı medyan son bakiye",
     a.sonReelOrtanca === b.sonReelOrtanca);
  var c = F.calistir(G({ tohum: 43 }));
  ok("farklı tohum → farklı sonuç", c.basariOrani !== a.basariOrani ||
     c.sonReelOrtanca !== a.sonReelOrtanca);

  var r1 = F.uretec(7), r2 = F.uretec(7);
  var esit = true;
  for (var i = 0; i < 50; i++) if (r1() !== r2()) esit = false;
  ok("üreteç aynı tohumla aynı diziyi veriyor", esit);
})();

/* ------------------------------------------------------------------ 2 */
baslik("Dağılımlar — ortalama ve VARYANS");
(function () {
  var rnd = F.uretec(11), n = 40000, t = 0, k = 0;
  for (var i = 0; i < n; i++) { var z = F.normal(rnd); t += z; k += z * z; }
  ok("normal ortalama ≈ 0", yakin(t / n, 0, 0.03), (t / n).toFixed(4));
  ok("normal varyans ≈ 1", yakin(k / n, 1, 0.05), (k / n).toFixed(4));

  /* Student-t birim varyansa ÖLÇEKLENİYOR mu? Ölçeklenmezse df=5 için
     varyans 5/3 = 1,667 çıkar ve kullanıcının girdiği standart sapma
     sessizce %29 büyür. Bu testin varlık sebebi o. */
  var r2 = F.uretec(12), t2 = 0, k2 = 0;
  for (var j = 0; j < 40000; j++) { var y = F.birimT(r2, 5); t2 += y; k2 += y * y; }
  ok("Student-t ortalama ≈ 0", yakin(t2 / 40000, 0, 0.05), (t2 / 40000).toFixed(4));
  ok("Student-t varyans ≈ 1 (ölçeklenmiş)", yakin(k2 / 40000, 1, 0.12),
     (k2 / 40000).toFixed(4));

  /* Yağlı kuyruk gerçekten yağlı mı: 3 sigmayı aşan gözlem normalden çok. */
  var rn = F.uretec(13), rt = F.uretec(13), ucN = 0, ucT = 0;
  for (var m = 0; m < 40000; m++) {
    if (Math.abs(F.normal(rn)) > 3) ucN++;
    if (Math.abs(F.birimT(rt, 5)) > 3) ucT++;
  }
  ok("Student-t uç gözlemi normalden fazla", ucT > ucN * 1.5,
     "normal " + ucN + " / t " + ucT);
})();

/* ------------------------------------------------------------------ 3 */
baslik("Korelasyon — getiri ve enflasyon birlikte üretiliyor");
(function () {
  function olc(rho) {
    var rnd = F.uretec(21), n = 20000;
    var sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      var z1 = F.birimT(rnd, 5), z0 = F.birimT(rnd, 5);
      var z2 = rho * z1 + Math.sqrt(1 - rho * rho) * z0;
      sx += z1; sy += z2; sxy += z1 * z2; sxx += z1 * z1; syy += z2 * z2;
    }
    return (n * sxy - sx * sy) /
      Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  }
  ok("istenen 0,5 → ölçülen ≈ 0,5", yakin(olc(0.5), 0.5, 0.05), olc(0.5).toFixed(3));
  ok("istenen 0,0 → ölçülen ≈ 0", yakin(olc(0), 0, 0.05), olc(0).toFixed(3));
  ok("istenen 0,9 → ölçülen ≈ 0,9", yakin(olc(0.9), 0.9, 0.03), olc(0.9).toFixed(3));

  ok("korelasyon sınırlanıyor (+1 üstü)", F.normalize({ korelasyon: 5 }).korelasyon <= 0.99);
  ok("korelasyon sınırlanıyor (-1 altı)", F.normalize({ korelasyon: -5 }).korelasyon >= -0.99);
})();

/* ------------------------------------------------------------------ 4 */
baslik("Belirsizlik sıfırken sonuç elle doğrulanabilir");
(function () {
  /* Sapma 0 → tek bir belirlenimci yol. 1.000.000, %20 getiri, %0
     enflasyon, katkı/çekim yok, 3 yıl: 1.000.000 × 1,2³ = 1.728.000. */
  var s = F.calistir(G({
    baslangic: 1000000, aylikKatki: 0, aylikCekim: 0,
    emeklilikYili: 3, emeklilikSuresi: 1,
    getiriOrtYuzde: 20, getiriSapmaYuzde: 0,
    enflasyonOrtYuzde: 0, enflasyonSapmaYuzde: 0, yolSayisi: 100
  }));
  ok("sapma yokken bütün yollar aynı", s.sonReelP10 === s.sonReelP90);
  ok("3. yıl bakiyesi 1.728.000", yakin(s.bantlar[2].p50, 1728000, 1),
     s.bantlar[2].p50.toFixed(2));
  ok("sapma yokken başarı %100", s.basariOrani === 1);

  /* Enflasyon = getiri → reel bakiye sabit kalmalı. */
  var e = F.calistir(G({
    baslangic: 1000000, aylikKatki: 0, aylikCekim: 0,
    emeklilikYili: 10, emeklilikSuresi: 1,
    getiriOrtYuzde: 30, getiriSapmaYuzde: 0,
    enflasyonOrtYuzde: 30, enflasyonSapmaYuzde: 0, yolSayisi: 50
  }));
  ok("getiri = enflasyon → reel bakiye sabit",
     yakin(e.bantlar[9].p50, 1000000, 1), e.bantlar[9].p50.toFixed(2));
})();

/* ------------------------------------------------------------------ 5 */
baslik("Başarı ölçütü ve bantlar");
(function () {
  var az = F.calistir(G({ aylikCekim: 20000 }));
  var cok = F.calistir(G({ aylikCekim: 120000 }));
  ok("çekim arttıkça başarı düşüyor", cok.basariOrani < az.basariOrani,
     az.basariOrani.toFixed(3) + " → " + cok.basariOrani.toFixed(3));
  ok("başarı oranı 0–1 aralığında",
     az.basariOrani >= 0 && az.basariOrani <= 1 && cok.basariOrani >= 0);

  var s = F.calistir(G());
  var siraliMi = true;
  s.bantlar.forEach(function (b) {
    if (!(b.p5 <= b.p10 && b.p10 <= b.p25 && b.p25 <= b.p50 &&
          b.p50 <= b.p75 && b.p75 <= b.p90 && b.p90 <= b.p95)) siraliMi = false;
  });
  ok("yüzdelik bantlar sıralı (p5 ≤ … ≤ p95)", siraliMi);
  ok("bant sayısı = toplam yıl", s.bantlar.length === 30);
  ok("başarısız yol varsa medyan tükenme yılı raporlanıyor",
     cok.basarisiz === 0 || cok.medyanTukenmeYili > 0);

  /* Reel ölçüt: enflasyon yüksekken nominal hayatta kalmak yetmez. */
  var yuksekEnf = F.calistir(G({ enflasyonOrtYuzde: 60, enflasyonSapmaYuzde: 5 }));
  var dusukEnf = F.calistir(G({ enflasyonOrtYuzde: 10, enflasyonSapmaYuzde: 5 }));
  ok("enflasyon yükselince reel son bakiye düşüyor",
     yuksekEnf.sonReelOrtanca < dusukEnf.sonReelOrtanca,
     yuksekEnf.sonReelOrtanca.toFixed(0) + " vs " + dusukEnf.sonReelOrtanca.toFixed(0));
})();

/* ------------------------------------------------------------------ 6 */
baslik("Sequence-of-returns riski modelleniyor");
(function () {
  /* Çekim yıl BAŞINDA yapılıyor: kötü bir ilk yıl doğrudan bakiyeyi
     vuruyor. Aynı ortalama getiriyle sapma arttıkça başarı düşmeli —
     bu, sıra riskinin gözlemlenebilir izi. */
  var duz = F.calistir(G({ getiriSapmaYuzde: 2 }));
  var oynak = F.calistir(G({ getiriSapmaYuzde: 45 }));
  ok("aynı ortalama, yüksek oynaklık → başarı düşüyor",
     oynak.basariOrani < duz.basariOrani,
     duz.basariOrani.toFixed(3) + " → " + oynak.basariOrani.toFixed(3));

  /* Emeklilikte çekim getiriden ÖNCE uygulanıyor mu: sapma sıfır,
     bakiye tam olarak (bakiye - çekim) x (1+getiri) olmalı. */
  var s = F.calistir(G({
    baslangic: 1000000, aylikCekim: 100000 / 12, aylikKatki: 0,
    emeklilikYili: 0, emeklilikSuresi: 1,
    getiriOrtYuzde: 10, getiriSapmaYuzde: 0,
    enflasyonOrtYuzde: 0, enflasyonSapmaYuzde: 0, yolSayisi: 20
  }));
  ok("çekim getiriden önce: (1.000.000−100.000)×1,10 = 990.000",
     yakin(s.bantlar[0].p50, 990000, 1), s.bantlar[0].p50.toFixed(2));
})();

/* ------------------------------------------------------------------ 7 */
baslik("Güvenli çekim — tanımıyla sınanıyor");
(function () {
  var g = G({ aylikCekim: 0, yolSayisi: 400 });
  var c = F.guvenliCekim(g, 0.90);
  ok("bir çözüm bulundu", c.bulundu === true && c.aylik > 0, JSON.stringify(c));

  if (c.bulundu) {
    /* TANIM: bulunan çekimde başarı hedefi sağlanmalı. */
    var s1 = F.calistir(G({ aylikCekim: c.aylik, yolSayisi: 400 }));
    ok("bulunan çekimde başarı ≥ %90", s1.basariOrani >= 0.90,
       s1.basariOrani.toFixed(3));
    /* Çözüm sıkı: belirgin daha fazlası hedefi tutturmamalı. */
    var s2 = F.calistir(G({ aylikCekim: c.aylik * 1.25, yolSayisi: 400 }));
    ok("%25 fazlası hedefi tutturmuyor", s2.basariOrani < 0.90,
       s2.basariOrani.toFixed(3));
  }

  /* %4 kuralı KULLANILMIYOR: bulunan oran, %4'ün öngördüğünden farklı
     olmalı (Türkiye parametreleriyle genelde daha düşük reel oran). */
  var dortYuzde = 5000000 * 0.04 / 12;
  ok("sonuç %4 kuralının verdiği sayı değil",
     Math.abs(c.aylik - dortYuzde) > dortYuzde * 0.05,
     "bulunan " + c.aylik.toFixed(0) + " / %4 kuralı " + dortYuzde.toFixed(0));

  /* Bu testi ilk yazdigimda "cekimsiz bile yetmiyor" diye bir durum
     bekliyordum. Yanlisti ve motorda ULASILAMAZ bir dal oldugunu ortaya
     cikardi: cekim sifirsa karsilanacak yukumluluk yoktur, dolayisiyla
     hicbir yol basarisiz olamaz. Anlamli uc durum su: getiri felaketse
     surdurulebilir cekim pratikte sifira duser. */
  var yok = F.guvenliCekim(G({ baslangic: 1000, aylikCekim: 0, getiriOrtYuzde: -50,
                               getiriSapmaYuzde: 1, yolSayisi: 200 }), 0.99);
  ok("getiri felaketse sürdürülebilir çekim yok",
     yok.bulundu === false && yok.sebep === "surdurulebilir-cekim-yok",
     JSON.stringify(yok));
  ok("çekim sıfırken hiçbir yol başarısız olamaz",
     F.calistir(G({ aylikCekim: 0, getiriOrtYuzde: -50, yolSayisi: 200 })).basariOrani === 1);
})();

/* ------------------------------------------------------------------ 8 */
baslik("Gereken birikim — tanımıyla sınanıyor");
(function () {
  var g = G({ baslangic: 0, aylikCekim: 50000, yolSayisi: 300 });
  var b = F.gerekenBirikim(g, 0.85);
  ok("bir tutar bulundu", b.bulundu === true && b.tutar > 0, JSON.stringify(b));
  if (b.bulundu) {
    var s = F.calistir(G({ baslangic: b.tutar, aylikCekim: 50000, yolSayisi: 300 }));
    ok("bulunan tutarda başarı ≥ %85", s.basariOrani >= 0.85, s.basariOrani.toFixed(3));
    var az = F.calistir(G({ baslangic: b.tutar * 0.7, aylikCekim: 50000, yolSayisi: 300 }));
    ok("%30 azı yetmiyor", az.basariOrani < 0.85, az.basariOrani.toFixed(3));
  }
})();

/* ------------------------------------------------------------------ 9 */
baslik("Girdi normalleştirme ve yakınsama");
(function () {
  var n = F.normalize({ emeklilikSuresi: 0, yolSayisi: 5, serbestlik: 1 });
  ok("emeklilik süresi en az 1", n.emeklilikSuresi >= 1);
  ok("yol sayısı en az 100", n.yolSayisi >= 100);
  ok("serbestlik derecesi en az 3 (varyans tanımlı olsun)", n.serbestlik >= 3);
  ok('"1.234,56" → 1234.56', F.sayi("1.234,56") === 1234.56);

  /* Yakınsama: yol sayısı artınca başarı oranı oturmalı. */
  var a = F.calistir(G({ yolSayisi: 2000, tohum: 5 })).basariOrani;
  var b = F.calistir(G({ yolSayisi: 4000, tohum: 6 })).basariOrani;
  ok("2000 ve 4000 yolda başarı oranı yakın", yakin(a, b, 0.05),
     a.toFixed(3) + " vs " + b.toFixed(3));
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
