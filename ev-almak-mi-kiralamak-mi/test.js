/*!
 * Ev Almak mı Kiralamak mı — doğrulama testleri.
 *   node ev-almak-mi-kiralamak-mi/test.js
 *
 * Bu hesapta yanlış cevap, yanlış bir hayat kararına dönüşür. Testler
 * beş değişmezi koruyor:
 *   1. FARK YATIRILIR. Kiracı, alıcının ilk gün ödediği parayı yatırır;
 *      her ay az ödeyen taraf aradaki farkı değerlendirir. Bu kural
 *      bozulursa hesap satın almayı haksız yere kazandırır.
 *   2. Kredi matematiği kredi çekirdeğinden gelir, burada tekrarlanmaz.
 *   3. Alım ve satım masrafları geri dönmez; süre kısaldıkça satın alma
 *      ağırlaşır (başabaş yılının olma sebebi).
 *   4. Kira artışı ile ev değer artışı AYRI parametrelerdir.
 *   5. Başabaş kira tanımıyla sınanır: bulunan kirada iki servet eşit.
 */
"use strict";
var E = require("./hesap.js");
var Kredi = require("../kredi-hesaplama/hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }
function baslik(s) { console.log("\n" + s); }

/* Ortak, gerçekçi bir senaryo. */
function G(ek) {
  var g = {
    evFiyati: 6000000, pesinatYuzde: 30, aylikFaizYuzde: 2.5, vadeAy: 120,
    aylikKira: 25000, kiraArtisYuzde: 25, evDegerArtisYuzde: 30,
    enflasyonYuzde: 30, yatirimGetiriYuzde: 35, yilSayisi: 10,
    tapuHarciYuzde: 2, komisyonYuzde: 2, satisKomisyonYuzde: 2,
    emlakVergisiBinde: 2, bakimYuzde: 0.5, sigortaYillik: 4000
  };
  for (var k in (ek || {})) g[k] = ek[k];
  return g;
}

/* ------------------------------------------------------------------ 1 */
baslik("Temel kurulum");
(function () {
  var s = E.karsilastir(G());
  ok("peşinat = fiyat × oran", yakin(s.pesinat, 6000000 * 0.30, 0.01), s.pesinat.toFixed(2));
  ok("kredi = fiyat − peşinat", yakin(s.krediTutari, 6000000 * 0.70, 0.01));
  ok("alım masrafı = fiyat × (harç + komisyon)",
     yakin(s.alimMasrafi, 6000000 * 0.04, 0.01), s.alimMasrafi.toFixed(2));
  ok("ilk gün nakit = peşinat + alım masrafı",
     yakin(s.ilkGunNakit, s.pesinat + s.alimMasrafi, 0.01));
  ok("yıl satırı sayısı = yıl sayısı", s.yillar.length === 10);

  /* Taksit kredi çekirdeğinden gelmeli — burada ayrı bir formül yok. */
  var p = Kredi.plan({ anapara: 4200000, vade: 120, aylikFaiz: 2.5, kkdf: 0, bsmv: 0 });
  ok("taksit kredi çekirdeğiyle birebir aynı",
     yakin(s.aylikTaksit, p.taksit, 0.01), s.aylikTaksit + " vs " + p.taksit);
})();

/* ------------------------------------------------------------------ 2 */
baslik("Fark yatırılıyor — hesabın dürüstlük şartı");
(function () {
  /* Getiri sıfırken kiracının portföyü, ilk gün nakdi + biriken aylık
     farklardan ibarettir. Yatırım getirisi yoksa bu tam olarak toplanabilir. */
  var g = G({ yatirimGetiriYuzde: 0, yilSayisi: 1, kiraArtisYuzde: 0,
              evDegerArtisYuzde: 0, enflasyonYuzde: 0 });
  var s = E.karsilastir(g);
  var y = s.yillar[0];
  var aylikFark = y.aylikAliciGider - y.aylikKira;
  var beklenen = s.ilkGunNakit + aylikFark * 12;
  ok("getiri %0 → kiracı portföyü = ilk gün nakdi + 12 aylık fark",
     yakin(y.kiraciPortfoy, beklenen, 1),
     y.kiraciPortfoy.toFixed(2) + " vs " + beklenen.toFixed(2));

  /* Kiracı alıcıdan az ödüyorsa alıcının portföyü sıfır kalmalı. */
  ok("alıcı daha çok ödüyorsa alıcı portföyü sıfır",
     aylikFark > 0 ? y.aliciPortfoy === 0 : true);

  /* Ters durum: kira çok yüksekse bu kez ALICI farkı yatırır. */
  var t = E.karsilastir(G({ aylikKira: 200000, yatirimGetiriYuzde: 0, yilSayisi: 1,
                            kiraArtisYuzde: 0, evDegerArtisYuzde: 0, enflasyonYuzde: 0 }));
  ok("kira çok yüksekse alıcı farkı yatırır", t.yillar[0].aliciPortfoy > 0,
     t.yillar[0].aliciPortfoy.toFixed(2));

  /* Peşinatın fırsat maliyeti gerçekten işliyor mu: yatırım getirisi
     arttıkça kiracının serveti artmalı. */
  var d0 = E.karsilastir(G({ yatirimGetiriYuzde: 0 }));
  var d1 = E.karsilastir(G({ yatirimGetiriYuzde: 45 }));
  ok("yatırım getirisi arttıkça kiracı serveti artıyor",
     d1.yillar[9].kiraciServet > d0.yillar[9].kiraciServet);
  ok("yatırım getirisi arttıkça satın almanın avantajı eriyor",
     d1.fark < d0.fark, d0.fark.toFixed(0) + " → " + d1.fark.toFixed(0));
})();

/* ------------------------------------------------------------------ 3 */
baslik("Masraflar geri dönmüyor");
(function () {
  var az = E.karsilastir(G({ tapuHarciYuzde: 0, komisyonYuzde: 0, satisKomisyonYuzde: 0 }));
  var cok = E.karsilastir(G({ tapuHarciYuzde: 4, komisyonYuzde: 4, satisKomisyonYuzde: 4 }));
  ok("alım/satım masrafı arttıkça satın alma kötüleşiyor", cok.fark < az.fark,
     az.fark.toFixed(0) + " → " + cok.fark.toFixed(0));

  /* İlk yazdığım test "uzun vade satın almayı iyileştirir" varsayıyordu
     ve YANLIŞTI: ortak senaryoda yatırım getirisi (%35) ev değer
     artışından (%30) yüksek, dolayısıyla süre uzadıkça kiralamak
     kazanıyor. Model doğruydu, varsayım yanlıştı.

     Masrafların geri dönmediğini doğru sınayan iddia şu: satın almanın
     eninde sonunda kazandığı bir senaryoda, masraf arttıkça BAŞABAŞ YILI
     GERİYE İTİLİR. */
  var kazanan = { evDegerArtisYuzde: 45, yatirimGetiriYuzde: 20, yilSayisi: 25, vadeAy: 240 };
  var ucuz = E.karsilastir(G(Object.assign({}, kazanan,
    { tapuHarciYuzde: 0, komisyonYuzde: 0, satisKomisyonYuzde: 0 })));
  var pahali = E.karsilastir(G(Object.assign({}, kazanan,
    { tapuHarciYuzde: 6, komisyonYuzde: 6, satisKomisyonYuzde: 6 })));
  ok("satın almanın kazandığı senaryoda başabaş yılı var", ucuz.basabasYil > 0,
     String(ucuz.basabasYil));
  ok("masraf arttıkça başabaş yılı geriye itiliyor",
     pahali.basabasYil > ucuz.basabasYil,
     ucuz.basabasYil + " → " + pahali.basabasYil);

  ok("geri dönmeyen para = faiz + alım masrafı + sahiplik gideri",
     yakin(az.geriDonmeyen, az.toplamFaiz + az.alimMasrafi + az.toplamSahiplikGideri, 1));
})();

/* ------------------------------------------------------------------ 4 */
baslik("Kira artışı ve ev değer artışı ayrı parametreler");
(function () {
  var k0 = E.karsilastir(G({ kiraArtisYuzde: 10 }));
  var k1 = E.karsilastir(G({ kiraArtisYuzde: 50 }));
  ok("kira daha hızlı artınca satın alma iyileşiyor", k1.fark > k0.fark,
     k0.fark.toFixed(0) + " → " + k1.fark.toFixed(0));

  var e0 = E.karsilastir(G({ evDegerArtisYuzde: 10 }));
  var e1 = E.karsilastir(G({ evDegerArtisYuzde: 50 }));
  ok("ev değeri daha hızlı artınca satın alma iyileşiyor", e1.fark > e0.fark);

  /* İkisi ayrı olmalı: birini değiştirmek diğerini etkilememeli. */
  ok("kira artışı ev değerini değiştirmiyor",
     yakin(k0.yillar[9].evDegeri, k1.yillar[9].evDegeri, 0.01));
})();

/* ------------------------------------------------------------------ 5 */
baslik("Servet tanımı ve reel karşılık");
(function () {
  var s = E.karsilastir(G());
  var y = s.yillar[9];
  /* Alıcının serveti = ev − kalan kredi + portföy − satış masrafı */
  var beklenen = y.evDegeri - y.kalanKredi + y.aliciPortfoy - y.evDegeri * 0.02;
  ok("alıcı serveti tanımı tutuyor", yakin(y.aliciServet, beklenen, 1),
     y.aliciServet.toFixed(0) + " vs " + beklenen.toFixed(0));
  ok("kiracı serveti = portföyü", yakin(y.kiraciServet, y.kiraciPortfoy, 0.01));
  ok("fark = alıcı − kiracı", yakin(y.fark, y.aliciServet - y.kiraciServet, 0.01));

  /* Reel servet enflasyonla küçülür. */
  ok("reel servet nominalden küçük (enflasyon > 0)", y.aliciServetReel < y.aliciServet);
  var sifir = E.karsilastir(G({ enflasyonYuzde: 0 }));
  ok("enflasyon %0 → reel = nominal",
     yakin(sifir.yillar[9].aliciServetReel, sifir.yillar[9].aliciServet, 0.02));

  /* 10 yıl vade sonunda kredi bitmiş olmalı. */
  ok("120 ay sonunda kalan kredi sıfır", yakin(y.kalanKredi, 0, 0.02),
     y.kalanKredi.toFixed(2));
})();

/* ------------------------------------------------------------------ 6 */
baslik("Başabaş kira — tanımıyla sınanıyor");
(function () {
  var g = G();
  var b = E.basabasKira(g);
  ok("bir başabaş kira bulundu", b.bulundu === true, JSON.stringify(b));

  if (b.bulundu) {
    /* TANIM: bu kirada iki servet eşitlenmeli. */
    var g2 = G({ aylikKira: b.kira });
    var s = E.karsilastir(g2);
    var f = s.yillar[s.yillar.length - 1].fark;
    var olcek = Math.abs(s.yillar[s.yillar.length - 1].aliciServet);
    ok("bulunan kirada iki servet eşit (binde 1 içinde)",
       Math.abs(f) <= olcek / 1000, f.toFixed(0) + " / " + olcek.toFixed(0));

    /* Çözüm sıkı olmalı: %10 düşük kirada kiracı öne geçmeli. */
    var dusuk = E.karsilastir(G({ aylikKira: b.kira * 0.9 }));
    ok("kira %10 düşükse kiralamak öne geçiyor",
       dusuk.yillar[dusuk.yillar.length - 1].fark < 0);
    var yuksek = E.karsilastir(G({ aylikKira: b.kira * 1.1 }));
    ok("kira %10 yüksekse satın almak öne geçiyor",
       yuksek.yillar[yuksek.yillar.length - 1].fark > 0);
  }
})();

/* ------------------------------------------------------------------ 7 */
baslik("Konut kredisinde KKDF/BSMV yok");
(function () {
  var s = E.karsilastir(G());
  var konut = Kredi.plan({ anapara: 4200000, vade: 120, aylikFaiz: 2.5, kkdf: 0, bsmv: 0 });
  var ihtiyac = Kredi.plan({ anapara: 4200000, vade: 120, aylikFaiz: 2.5, kkdf: 15, bsmv: 15 });
  ok("araç konut kredisi taksitini kullanıyor", yakin(s.aylikTaksit, konut.taksit, 0.01));
  ok("ihtiyaç kredisi taksiti belirgin daha yüksek", ihtiyac.taksit > konut.taksit * 1.1,
     konut.taksit.toFixed(2) + " vs " + ihtiyac.taksit.toFixed(2));
})();

/* ------------------------------------------------------------------ 8 */
baslik("Rastgele 200 senaryoda değişmezler");
(function () {
  function r(a, b) { return a + Math.random() * (b - a); }
  var bozuk = 0, ornek = "";
  for (var i = 0; i < 200; i++) {
    var yil = Math.floor(r(2, 25));
    var g = {
      evFiyati: Math.round(r(1000000, 20000000)),
      pesinatYuzde: r(10, 60),
      aylikFaizYuzde: r(1, 4),
      vadeAy: Math.max(12, yil * 12),
      aylikKira: Math.round(r(5000, 150000)),
      kiraArtisYuzde: r(0, 60),
      evDegerArtisYuzde: r(0, 60),
      enflasyonYuzde: r(0, 60),
      yatirimGetiriYuzde: r(0, 60),
      yilSayisi: yil
    };
    var s = E.karsilastir(g);
    var y = s.yillar[s.yillar.length - 1];
    var farkTutar = Math.abs(y.fark - (y.aliciServet - y.kiraciServet)) <= 0.02;
    var servetTanim = Math.abs(
      y.aliciServet - (y.evDegeri - y.kalanKredi + y.aliciPortfoy - y.evDegeri * 0.02)) <= 2;
    var satirSayisi = s.yillar.length === yil;
    /* Kiracı portföyü hiçbir zaman ilk gün nakdinin altına düşmemeli
       (getiri 0 olsa bile para orada durur). */
    var portfoyMakul = y.kiraciPortfoy >= s.ilkGunNakit - 0.02;
    if (!farkTutar || !servetTanim || !satirSayisi || !portfoyMakul) {
      bozuk++;
      if (!ornek) ornek = JSON.stringify(g);
    }
  }
  ok("200 senaryoda servet tanımı ve satır sayısı tutuyor", bozuk === 0,
     bozuk + " senaryo tutmadı " + ornek);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
