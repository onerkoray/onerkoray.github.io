/*!
 * Finansal Emniyet Çekirdeği — doğrulama testleri.
 *   node finansal-emniyet-testi/test.js
 *
 * Bu çekirdeğin hatası SESSİZDİR: her girdi için makul görünen bir skor
 * üretir. "Sonuç mantıklı duruyor" bir doğrulama değildir. Testler bu yüzden
 * üç şeyi sınıyor:
 *
 *   1. TANIMLAR — dayanma süresi, nakit tabanı, borç oranları elle
 *      hesaplanabilir örneklerde birebir tutuyor mu.
 *   2. İDDİALAR — aracın kendi savları (karşılanabilir != güvenli, net değer
 *      emniyeti belirlemez, sabit faizli borç faiz şokundan etkilenmez)
 *      gerçekten kodda mı, yoksa sadece metinde mi.
 *   3. ÇÖZÜCÜNÜN GEÇERLİLİĞİ — güvenli karar tutarı ikiye bölmeyle
 *      bulunuyor; bu ancak kısıtlar tek yönlü kötüleşiyorsa doğrudur.
 *      Monotonluk rastgele senaryolarda ayrıca sınanıyor.
 */
"use strict";
var E = require("./hesap.js");
var Kredi = require("../kredi-hesaplama/hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= t; }
function baslik(s) { console.log("\n" + s); }

/* Elle hesaplanabilir taban hane. */
function H(ek) {
  var d = {
    netGelir: 100000, digerGelir: 0, gelirTuru: "guvenceli",
    zorunluGider: 40000, istegeBagliGider: 10000,
    nakit: 300000, yatirim: 0, altinDoviz: 0, illikit: 0,
    enBuyukVarlikYuzde: 0,
    borcBakiye: 0, borcServisi: 0, mevcutAylikFaiz: 0,
    dovizliBorcYuzde: 0, degiskenFaizliBorcYuzde: 0,
    yakinYukumluluk: 0, kidemAy: 0, issizlikOdenegi: 0,
    saglikSigortasi: false, borcSigortasi: false,
    hedefAy: 6
  };
  for (var k in (ek || {})) d[k] = ek[k];
  return E.normalize(d);
}

/* ------------------------------------------------------------------ 1 */
baslik("Ağırlıklar ve puan eğrileri");
(function () {
  var t = 0;
  for (var k in E.AGIRLIK) t += E.AGIRLIK[k];
  ok("bileşen ağırlıkları toplamı 1", yakin(t, 1, 1e-12), t.toString());

  ok("eğri düğüm noktasında birebir", E.egri(6, E.EGRI.likidite) === 75);
  ok("eğri düğümler arasında doğrusal",
     yakin(E.egri(4.5, E.EGRI.likidite), 62.5, 1e-9),
     String(E.egri(4.5, E.EGRI.likidite)));
  ok("eğri soldan kırpıyor", E.egri(-5, E.EGRI.likidite) === 0);
  ok("eğri sağdan kırpıyor", E.egri(500, E.EGRI.likidite) === 100);
  /* Menzil sonsuz olabilir (zorunlu gider yoksa); NaN dönerse skor sessizce
     bozulurdu. */
  ok("sonsuz menzil en yüksek puanı verir", E.egri(Infinity, E.EGRI.likidite) === 100);

  /* Yük ve DSR eğrilerinin y'si AZALAN; artan eğri için yazılmış bir
     interpolasyon burada sessizce ters çalışırdı. */
  ok("azalan eğri de doğru ara değer veriyor",
     yakin(E.egri(0.475, E.EGRI.yuk), 90, 1e-9), String(E.egri(0.475, E.EGRI.yuk)));
  var oncekiY = 101;
  for (var x = 0; x <= 1.3; x += 0.05) {
    var y = E.egri(x, E.EGRI.yuk);
    if (y > oncekiY + 1e-9) { oncekiY = -1; break; }
    oncekiY = y;
  }
  ok("yük eğrisi hiç yükselmiyor (monoton azalan)", oncekiY >= 0);

  ok("segment sınırları", E.segment(29.9) === "Çok kırılgan" &&
     E.segment(30) === "Kırılgan" && E.segment(70) === "Dayanıklı" &&
     E.segment(100) === "Dayanıklı");
})();

/* ------------------------------------------------------------------ 2 */
baslik("Tanımlar — elle hesaplanabilir");
(function () {
  var d = H({ borcServisi: 20000, borcBakiye: 400000, hedefAy: 6 });
  var o = E.olcumler(d);
  ok("finansal pay = gelir − zorunlu gider − borç servisi",
     o.finansalPay === 100000 - 40000 - 20000, String(o.finansalPay));
  ok("dayanma süresi = likit / (zorunlu gider + borç servisi)",
     yakin(o.menzil, 300000 / 60000, 1e-9), String(o.menzil));
  ok("nakit tabanı = yanma × hedef ay + yakın yükümlülük",
     o.nakitTabani === 60000 * 6, String(o.nakitTabani));
  ok("fazla likidite = likit − taban", o.fazlaLikidite === 300000 - 360000);
  ok("borç servisi oranı", yakin(o.dsr, 0.20, 1e-12));
  ok("finansal yük oranı", yakin(o.yukOrani, 0.60, 1e-12));

  var y = E.olcumler(H({ yakinYukumluluk: 50000, hedefAy: 6 }));
  ok("yakın vadeli yükümlülük tabanı yükseltiyor",
     y.nakitTabani === 40000 * 6 + 50000, String(y.nakitTabani));

  /* Likidite katsayıları: nakit 1, altın/döviz 0,97, yatırım 0,93. */
  var l = E.olcumler(H({ nakit: 100000, altinDoviz: 100000, yatirim: 100000 }));
  ok("likidite katsayıları uygulanıyor",
     yakin(l.likitVarlik, 100000 + 97000 + 93000, 1e-6), String(l.likitVarlik));

  /* Bu, aracın en sert tercihlerinden biri: gayrimenkul altı aylık krizi
     fonlamaz, o yüzden dayanma süresine HİÇ girmez. */
  var i = E.olcumler(H({ illikit: 5000000 }));
  var j = E.olcumler(H({ illikit: 0 }));
  ok("illikit varlık dayanma süresini değiştirmiyor", i.menzil === j.menzil);
  ok("illikit varlık net değere giriyor", i.netDeger > j.netDeger);
})();

/* ------------------------------------------------------------------ 3 */
baslik("Hedef tampon süresi — türetiliyor, sabit verilmiyor");
(function () {
  var a = E.normalize({ netGelir: 100000, zorunluGider: 40000, gelirTuru: "guvenceli" });
  ok("kadrolu + tek gelir → 3 + 1 = 4 ay", a.hedefAy === 4, String(a.hedefAy));

  var b = E.normalize({ netGelir: 100000, zorunluGider: 40000, gelirTuru: "degisken" });
  ok("değişken gelir tabanı daha yüksek", b.hedefAy > a.hedefAy,
     b.hedefAy + " vs " + a.hedefAy);

  var c = E.normalize({ netGelir: 60000, digerGelir: 40000, zorunluGider: 40000 });
  ok("hanede ikinci gelir varsa tek gelir cezası yok", c.hedefAy === 3,
     String(c.hedefAy));

  var e = E.normalize({ netGelir: 60000, digerGelir: 40000, zorunluGider: 40000,
                        borcServisi: 35000 });
  ok("borç servisi %30'u aşınca tampon bir ay artıyor", e.hedefAy === 4,
     String(e.hedefAy));

  var f = E.normalize({ netGelir: 100000, zorunluGider: 40000, hedefAy: 12 });
  ok("kullanıcının yazdığı hedef, türetilene üstün gelir", f.hedefAy === 12);
  ok("otomatik/elle ayrımı raporlanıyor",
     f.hedefAyOtomatik === false && a.hedefAyOtomatik === true);
  ok("elle girildiğinde de öneri hesaplanıyor (kullanıcı görebilsin)",
     f.hedefAyOnerilen === 4, String(f.hedefAyOnerilen));

  var g = E.normalize({ netGelir: 50000, zorunluGider: 40000, gelirTuru: "degisken",
                        borcServisi: 30000 });
  ok("tampon 9 ayla sınırlı", g.hedefAy <= 9, String(g.hedefAy));
})();

/* ------------------------------------------------------------------ 4 */
baslik("KAVRAM AYRIMI — tabanın altına inmek batmak değildir");
(function () {
  /* Bu testin sınadığı şey, kaynak spesifikasyondan BİLEREK ayrıldığımız
     noktadır. Orada "nakit, minimum tabanın altına inerse senaryo BAŞARISIZ"
     deniyor. O tanım acil fonu iki kez sayar: fon zaten tam bu durumda
     harcanmak için birikir. Burada ölçüt nakdin SIFIRIN altına inmesidir. */
  var d = H({ nakit: 300000, zorunluGider: 40000, hedefAy: 6, kidemAy: 0 });
  var o = E.olcumler(d);
  var y = E.yol(d, { ad: "issizlik", etiket: "6 ay işsizlik", issizlikAy: 6, agirlik: 3 });

  ok("örnek gerçekten tabanın altına iniyor",
     y.enDusukNakit < o.nakitTabani, y.enDusukNakit + " < " + o.nakitTabani);
  ok("ama sıfırın altına inmiyor", y.enDusukNakit >= 0, String(y.enDusukNakit));
  ok("bu senaryo HAYATTA KALDI sayılıyor", y.hayattaKaldi === true);

  /* Tersi de tutmalı: sıfırın altına inen senaryo batmış sayılır. */
  var z = E.yol(H({ nakit: 100000, zorunluGider: 40000 }),
                { ad: "issizlik", etiket: "6 ay işsizlik", issizlikAy: 6, agirlik: 3 });
  ok("nakit sıfırlanınca senaryo düşüyor", z.hayattaKaldi === false && z.batisAyi > 0,
     "batış ayı " + z.batisAyi);

  /* Kısmî kredi: erken batmakla geç batmak aynı puanı almamalı. */
  ok("geç batış daha yüksek kısmî puan alıyor",
     E.yol(H({ nakit: 200000 }), { ad: "x", etiket: "x", issizlikAy: 12, agirlik: 1 }).kalmaOrani >
     E.yol(H({ nakit: 50000 }), { ad: "x", etiket: "x", issizlikAy: 12, agirlik: 1 }).kalmaOrani);
  ok("hayatta kalan yolun kısmî puanı tam", y.kalmaOrani === 1);
  ok("baz senaryo puana katılmıyor (ağırlık 0)",
     E.SENARYOLAR[0].ad === "taban" && !E.SENARYOLAR[0].agirlik);
  ok("stres testi baz senaryoyu saymıyor",
     E.stresTesti(d).senaryoSayisi === E.SENARYOLAR.length - 1);
})();

/* ------------------------------------------------------------------ 5 */
baslik("İşsizlik senaryosu — kıdem, ödenek ve ikinci gelir");
(function () {
  var sen = { ad: "issizlik", etiket: "6 ay işsizlik", issizlikAy: 6, agirlik: 3 };

  var kidemsiz = E.yol(H({ nakit: 100000, kidemAy: 0 }), sen);
  var kidemli = E.yol(H({ nakit: 100000, kidemAy: 4 }), sen);
  ok("kıdem tazminatı ilk ay toptan geliyor",
     yakin(kidemli.aylar[0] - kidemsiz.aylar[0], 4 * 100000, 1e-6),
     String(kidemli.aylar[0] - kidemsiz.aylar[0]));

  var odenekli = E.yol(H({ nakit: 100000, issizlikOdenegi: 20000, issizlikOdenegiAy: 4 }), sen);
  var f3 = odenekli.aylar[2] - kidemsiz.aylar[2];
  var f5 = odenekli.aylar[4] - kidemsiz.aylar[4];
  ok("ödenek ilk aylarda birikiyor", yakin(f3, 3 * 20000, 1e-6), String(f3));
  ok("ödenek süresi dolunca kesiliyor", yakin(f5, 4 * 20000, 1e-6), String(f5));

  /* İkinci gelirin koruyucu olmasının sebebi: işsizlikte SİZİN geliriniz
     sıfırlanır, hanedeki diğer gelir ayakta kalır. */
  var tek = E.yol(H({ netGelir: 100000, digerGelir: 0, nakit: 150000 }), sen);
  var cift = E.yol(H({ netGelir: 60000, digerGelir: 40000, nakit: 150000 }), sen);
  ok("aynı hane geliriyle ikinci gelir işsizlikte koruyor",
     cift.enDusukNakit > tek.enDusukNakit,
     cift.enDusukNakit.toFixed(0) + " vs " + tek.enDusukNakit.toFixed(0));

  /* Gelir şoku senaryosunda ise ikinci gelir şoktan MUAF olmamalı mı?
     Model kararı: gelir şoku yalnızca birincil geliri vurur, çünkü şok
     "senin işin/işyerin" olayıdır. Bu bir varsayım; testle sabitleniyor ki
     sessizce değişmesin. */
  var gs = E.yol(H({ netGelir: 60000, digerGelir: 40000, nakit: 150000 }),
                 { ad: "g", etiket: "g", gelir: -0.5, agirlik: 1 });
  var beklenen = 150000 + (60000 * 0.5 + 40000 - 40000 - 10000 * 0.3);
  ok("gelir şoku yalnızca birincil gelire uygulanıyor",
     yakin(gs.aylar[0], beklenen, 1e-6), gs.aylar[0] + " vs " + beklenen);
})();

/* ------------------------------------------------------------------ 6 */
baslik("TÜRKİYE AYARI — faiz şoku sabit faizli borcu vurmaz");
(function () {
  var sabit = H({ borcBakiye: 500000, borcServisi: 25000, mevcutAylikFaiz: 3.5,
                  degiskenFaizliBorcYuzde: 0 });
  var degisken = H({ borcBakiye: 500000, borcServisi: 25000, mevcutAylikFaiz: 3.5,
                     degiskenFaizliBorcYuzde: 100 });
  var sen = { ad: "faiz", etiket: "faiz", faiz: 0.10, agirlik: 1 };

  var a = E.yol(sabit, sen), b = E.yol(degisken, sen);
  ok("sabit faizli borçta taksit hiç değişmiyor",
     yakin(a.aylikBorcServisi, 25000, 1e-9), String(a.aylikBorcServisi));
  /* Yıllık faiz %42 iken +10 puan → değişken payın ödemesi ~%23,8 artar. */
  var oran = 0.10 / (3.5 * 12 / 100);
  ok("değişken faizli payda ödeme orantısal artıyor",
     yakin(b.aylikBorcServisi, 25000 * (1 + oran), 1e-6),
     b.aylikBorcServisi.toFixed(2));
  ok("faiz şoku olmayan senaryoda ikisi de aynı",
     E.yol(sabit, { ad: "x", etiket: "x", agirlik: 1 }).aylikBorcServisi ===
     E.yol(degisken, { ad: "x", etiket: "x", agirlik: 1 }).aylikBorcServisi);

  /* Faiz oranı bilinmiyorsa (0), sıfıra bölme olmamalı. */
  var sifir = E.yol(H({ borcServisi: 25000, mevcutAylikFaiz: 0,
                        degiskenFaizliBorcYuzde: 100 }), sen);
  ok("faiz bilinmiyorsa şok uygulanmıyor, NaN üretilmiyor",
     isFinite(sifir.aylikBorcServisi) && sifir.aylikBorcServisi === 25000);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Kur şoku — iki yönlü");
(function () {
  var sen = { ad: "kur", etiket: "kur", kur: 0.30, agirlik: 2 };

  var borclu = H({ nakit: 200000, borcBakiye: 500000, borcServisi: 25000,
                   dovizliBorcYuzde: 100 });
  var y = E.yol(borclu, sen);
  ok("dövizli borçta ödeme kur kadar artıyor",
     yakin(y.aylikBorcServisi, 25000 * 1.30, 1e-6), y.aylikBorcServisi.toFixed(2));

  var altinli = H({ nakit: 0, altinDoviz: 200000 });
  var a = E.yol(altinli, sen), b = E.yol(altinli, { ad: "x", etiket: "x", agirlik: 1 });
  ok("altın/döviz varlığı kur şokunda büyüyor",
     a.baslangicNakdi > b.baslangicNakdi,
     a.baslangicNakdi.toFixed(0) + " vs " + b.baslangicNakdi.toFixed(0));

  var o = E.olcumler(borclu);
  ok("net döviz açığı = dövizli borç − dövizli varlık",
     o.kurAcikligi === 500000 - 0, String(o.kurAcikligi));
  var hedge = E.olcumler(H({ borcBakiye: 500000, dovizliBorcYuzde: 100,
                             altinDoviz: 500000 }));
  ok("dövizli varlık açığı kapatıyor", hedge.kurAcikligi === 0);
})();

/* ------------------------------------------------------------------ 8 */
baslik("Karar — taksit kredi çekirdeğinden geliyor, yeniden yazılmıyor");
(function () {
  var k = E.kredibilgi({ tutar: 1000000, pesinat: 200000, vade: 36,
                         aylikFaiz: 3.9, krediTuru: "tasit" });
  var p = Kredi.plan({ anapara: 800000, vade: 36, aylikFaiz: 3.9,
                       kkdf: 15, bsmv: 15 });
  ok("taksit, kredi aracının hesabıyla birebir",
     yakin(k.taksit, p.taksit, 0.02), k.taksit.toFixed(2) + " vs " + p.taksit.toFixed(2));
  ok("KKDF ve BSMV kredi türünden geliyor", k.kkdf === 15 && k.bsmv === 15);
  ok("konut kredisinde KKDF/BSMV yok",
     E.kredibilgi({ tutar: 100, pesinat: 0, vade: 12, aylikFaiz: 2,
                    krediTuru: "konut" }).kkdf === 0);
  ok("peşinat tutarı aşamaz",
     E.kredibilgi({ tutar: 500000, pesinat: 900000, vade: 12 }).anapara === 0);
  ok("kredi yoksa taksit sıfır",
     E.kredibilgi({ tutar: 500000, pesinat: 500000, vade: 36, aylikFaiz: 4 }).taksit === 0);
})();

/* ------------------------------------------------------------------ 9 */
baslik("Karar uygulama — peşinat çekme sırası ve borç seyrelmesi");
(function () {
  var d = H({ nakit: 100000, altinDoviz: 100000, yatirim: 100000 });
  var u = E.kararUygula(d, { tutar: 150000, pesinat: 150000, vade: 0 });
  ok("önce nakit tükeniyor", u.durum.nakit === 0);
  ok("sonra altın/döviz kullanılıyor", u.durum.altinDoviz === 50000);
  ok("yatırıma en son dokunuluyor", u.durum.yatirim === 100000);
  ok("karşılanan peşinatta açık yok", u.acik === 0);

  var eksik = E.kararUygula(d, { tutar: 500000, pesinat: 500000, vade: 0 });
  ok("peşinat yetmiyorsa açık raporlanıyor", eksik.acik === 200000,
     String(eksik.acik));

  /* Yeni kredi TL ve sabit faizli; eski payların seyrelmesi gerekir.
     Payı sabit tutmak yeni borcu da dövizli saymak olurdu. */
  var dv = H({ nakit: 500000, borcBakiye: 100000, borcServisi: 5000,
               dovizliBorcYuzde: 100, degiskenFaizliBorcYuzde: 100,
               mevcutAylikFaiz: 2 });
  var s = E.kararUygula(dv, { tutar: 300000, pesinat: 0, vade: 24, aylikFaiz: 4 });
  ok("dövizli borç payı seyreliyor",
     yakin(s.durum.dovizliBorcYuzde, 100 * 100000 / 400000, 1e-9),
     s.durum.dovizliBorcYuzde.toFixed(2));
  ok("değişken faizli pay seyreliyor",
     yakin(s.durum.degiskenFaizliBorcYuzde, 25, 1e-9));
  ok("ortalama faiz ağırlıklı güncelleniyor",
     yakin(s.durum.mevcutAylikFaiz, (100000 * 2 + 300000 * 4) / 400000, 1e-9),
     s.durum.mevcutAylikFaiz.toFixed(3));
  ok("aylık ek gider zorunlu gidere ekleniyor",
     E.kararUygula(d, { tutar: 1, pesinat: 1, vade: 0, aylikEkGider: 3000 })
       .durum.zorunluGider === 43000);

  /* Otomatik hedef tampon, borç arttığında YENİDEN türetilmeli; sabit
     kalsaydı karar olduğundan güvenli görünürdü. */
  var oto = E.normalize({ netGelir: 100000, zorunluGider: 40000, nakit: 900000 });
  var sonra = E.kararUygula(oto, { tutar: 600000, pesinat: 0, vade: 24, aylikFaiz: 4 });
  ok("otomatik tampon karardan sonra yeniden hesaplanıyor",
     sonra.durum.hedefAy > oto.hedefAy, oto.hedefAy + " → " + sonra.durum.hedefAy);
})();

/* ------------------------------------------------------------------ 10 */
baslik("ÇÖZÜCÜ — kısıtlar tek yönlü kötüleşiyor mu (ikiye bölme geçerli mi)");
(function () {
  /* Güvenli karar tutarı ikiye bölmeyle bulunuyor. Bu ancak "tutar
     büyüdükçe uygunluk bir kez bozulur ve bir daha düzelmez" ise doğrudur.
     Doğru değilse çözücü sessizce yanlış bir tavan döndürür — kullanıcıya
     "şu kadarı güvenli" diye fazla bir rakam söyleriz. */
  var bozan = 0, denenen = 0;
  var tohum = 12345;
  function rnd() {
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return tohum / 0x7fffffff;
  }
  for (var i = 0; i < 60; i++) {
    var d = E.normalize({
      netGelir: 30000 + rnd() * 200000,
      digerGelir: rnd() < 0.4 ? rnd() * 80000 : 0,
      gelirTuru: ["guvenceli", "riskli", "degisken"][Math.floor(rnd() * 3)],
      zorunluGider: 15000 + rnd() * 90000,
      istegeBagliGider: rnd() * 30000,
      nakit: rnd() * 900000, yatirim: rnd() * 600000, altinDoviz: rnd() * 300000,
      borcBakiye: rnd() * 800000, borcServisi: rnd() * 30000,
      mevcutAylikFaiz: 1 + rnd() * 4,
      dovizliBorcYuzde: rnd() < 0.3 ? rnd() * 100 : 0,
      degiskenFaizliBorcYuzde: rnd() < 0.3 ? rnd() * 100 : 0,
      kidemAy: Math.floor(rnd() * 6), issizlikOdenegi: rnd() < 0.5 ? 15000 : 0
    });
    var karar = {
      tutar: 100000 + rnd() * 1500000, pesinat: rnd() * 300000,
      vade: 12 + Math.floor(rnd() * 60), aylikFaiz: 2 + rnd() * 3,
      krediTuru: "ihtiyac", aylikEkGider: rnd() * 8000,
      tekSeferlikGider: rnd() * 50000
    };
    var bozuldu = false, ihlal = false;
    for (var adim = 0; adim <= 20; adim++) {
      var t = karar.tutar * 4 * adim / 20;
      var u = E.uygunluk(d, karar, t);
      if (!u.uygun) bozuldu = true;
      else if (bozuldu) { ihlal = true; break; }
    }
    denenen++;
    if (ihlal) bozan++;
  }
  ok("60 rastgele hanede uygunluk hiç geri dönmüyor (monoton)",
     bozan === 0, bozan + "/" + denenen + " hanede monotonluk bozuldu");
})();

/* ------------------------------------------------------------------ 11 */
baslik("Güvenli karar tutarı");
(function () {
  var d = H({ nakit: 800000, zorunluGider: 40000, hedefAy: 6, kidemAy: 3 });
  var karar = { tutar: 600000, pesinat: 200000, vade: 36, aylikFaiz: 3.9,
                krediTuru: "tasit", aylikEkGider: 5000 };
  var g = E.guvenliKararTutari(d, karar);
  ok("bir tavan bulundu", g.guvenli === true && g.tutar > 0, JSON.stringify(g));
  ok("bulunan tutar uygun", E.uygunluk(d, karar, g.tutar).uygun === true);
  ok("biraz fazlası uygun değil",
     g.sinirBulunamadi || E.uygunluk(d, karar, g.tutar + 5000).uygun === false);
  ok("bağlayıcı kısıt adlandırılıyor", g.sinirBulunamadi || g.engel.length > 0,
     JSON.stringify(g.engel));

  /* Bu dal ULAŞILABİLİR olmalı — FIRE çekirdeğinde benzer bir dal
     ulaşılamaz çıkmış ve silinmişti. Burada mevcut durumun kendisi
     güvensiz olabilir, dolayısıyla "sıfır bile güvenli değil" gerçek bir
     sonuçtur ve test onu üretiyor. */
  var kirilgan = H({ nakit: 20000, zorunluGider: 60000, borcServisi: 30000,
                     borcBakiye: 900000, mevcutAylikFaiz: 4, hedefAy: 6 });
  var k = E.guvenliKararTutari(kirilgan, karar);
  ok("zaten güvensiz hanede güvenli tutar sıfır", k.guvenli === false && k.tutar === 0);
  ok("engelin sebebi söyleniyor", k.engel.length > 0, JSON.stringify(k.engel));

  /* Çok varlıklı, borçsuz bir hanede sınır bulunamayabilir; bunu "0 TL
     güvenli" diye döndürmek felaket olurdu. */
  var zengin = H({ nakit: 50000000, zorunluGider: 30000, hedefAy: 6 });
  var z = E.guvenliKararTutari(zengin, { tutar: 100000, pesinat: 100000, vade: 0 });
  ok("sınır aralık dışındaysa açıkça bildiriliyor",
     z.guvenli === true && z.sinirBulunamadi === true, JSON.stringify(z));
})();

/* ------------------------------------------------------------------ 12 */
baslik("ÜRÜNÜN ANA İDDİASI — karşılanabilir, güvenli demek değil");
(function () {
  /* 600.000 nakit, 500.000'lik peşin alım. Kredi yok, borç yok: klasik bir
     "karşılayabilir misin" hesabı EVET der. */
  var d = E.normalize({
    netGelir: 80000, zorunluGider: 35000, istegeBagliGider: 10000,
    nakit: 600000, gelirTuru: "guvenceli"
  });
  var karar = { tutar: 500000, pesinat: 500000, vade: 0 };
  var u = E.kararUygula(d, karar);

  ok("karşılanabilir: peşinat likit varlıktan çıkıyor", u.acik === 0);
  ok("karşılanabilir: yeni borç servisi doğmuyor", u.durum.borcServisi === 0);

  var sonra = E.skor(u.durum);
  ok("ama nakit tabanının altına iniyor", sonra.olcum.fazlaLikidite < 0,
     sonra.olcum.fazlaLikidite.toFixed(0));
  ok("ve şok senaryolarının hepsi geçilmiyor",
     sonra.stres.gecenSenaryo < sonra.stres.senaryoSayisi,
     sonra.stres.gecenSenaryo + "/" + sonra.stres.senaryoSayisi);

  var g = E.guvenliKararTutari(d, karar);
  ok("güvenli tutar, karşılanabilir tutarın altında", g.tutar < 500000,
     g.tutar + " < 500000");
  ok("güvenli tutar yine de pozitif", g.tutar > 0, String(g.tutar));
})();

/* ------------------------------------------------------------------ 13 */
baslik("NET DEĞER EMNİYETİ BELİRLEMEZ");
(function () {
  /* İki hane, aynı net değer (2.000.000), bambaşka kırılganlık. Net değeri
     ana metrik yapan bir araç ikisini eşit gösterirdi. */
  var A = E.normalize({
    netGelir: 120000, digerGelir: 40000, gelirTuru: "guvenceli",
    zorunluGider: 45000, istegeBagliGider: 20000,
    nakit: 400000, yatirim: 1600000, enBuyukVarlikYuzde: 15,
    borcBakiye: 0, borcServisi: 0, kidemAy: 4, saglikSigortasi: true
  });
  var B = E.normalize({
    netGelir: 120000, digerGelir: 0, gelirTuru: "degisken",
    zorunluGider: 70000, istegeBagliGider: 25000,
    nakit: 0, yatirim: 600000, illikit: 3400000, enBuyukVarlikYuzde: 85,
    borcBakiye: 2000000, borcServisi: 42000, mevcutAylikFaiz: 2.5,
    kidemAy: 0, saglikSigortasi: false
  });
  var na = E.olcumler(A).netDeger, nb = E.olcumler(B).netDeger;
  ok("iki hanenin net değeri eşit", na === nb, na + " vs " + nb);

  var sa = E.skor(A), sb = E.skor(B);
  ok("emniyet skorları belirgin biçimde farklı", sa.puan - sb.puan > 25,
     sa.puan.toFixed(1) + " vs " + sb.puan.toFixed(1));
  ok("kırılgan hanenin yoğunlaşma riski yüksek işaretleniyor",
     sb.bayrak.yogunlasma.seviye === "yuksek", sb.bayrak.yogunlasma.seviye);
  ok("net değer skor bileşenlerinde yok",
     Object.keys(sa.bilesen).indexOf("netDeger") === -1);
})();

/* ------------------------------------------------------------------ 14 */
baslik("Koruma katmanı — geçersiz madde paydadan düşüyor");
(function () {
  var borcsuz = E.korumaPuani(H({ borcBakiye: 0, saglikSigortasi: true,
                                  kidemAy: 4, digerGelir: 0 }));
  ok("borçsuz hanede kredi hayat sigortası sayılmıyor", borcsuz.gecerli === 3,
     String(borcsuz.gecerli));
  ok("borçsuz hanede 2/3 sağlanıyor",
     borcsuz.saglanan === 2 && yakin(borcsuz.puan, 200 / 3, 1e-9),
     borcsuz.puan.toFixed(2));

  var borclu = E.korumaPuani(H({ borcBakiye: 100000, saglikSigortasi: true,
                                 kidemAy: 4, borcSigortasi: false }));
  ok("borçlu hanede dört madde de geçerli", borclu.gecerli === 4);
  ok("borçsuz hanenin puanı, aynı eksikle borçludan yüksek",
     borcsuz.puan > borclu.puan, borcsuz.puan.toFixed(1) + " vs " + borclu.puan.toFixed(1));

  var cesitli = E.korumaPuani(H({ netGelir: 70000, digerGelir: 30000 }));
  ok("gelirin %30'u ikinci kaynaktansa çeşitlilik sağlanıyor",
     cesitli.maddeler[1].saglandi === true);
  var az = E.korumaPuani(H({ netGelir: 95000, digerGelir: 5000 }));
  ok("%5 ikinci gelir çeşitlilik saymıyor", az.maddeler[1].saglandi === false);
})();

/* ------------------------------------------------------------------ 15 */
baslik("Alternatifler");
(function () {
  var d = H({ nakit: 700000, zorunluGider: 40000, hedefAy: 6, kidemAy: 3 });
  var karar = { tutar: 900000, pesinat: 250000, vade: 36, aylikFaiz: 3.9,
                krediTuru: "tasit", aylikEkGider: 6000 };
  var alt = E.alternatifler(d, karar);
  var ad = {};
  alt.forEach(function (a) { ad[a.etiket] = a; });

  ok("girilen karar ilk sırada", alt[0].etiket === "Girdiğiniz karar");
  ok("küçültmek puanı yükseltiyor",
     ad["%20 daha küçük"].puan >= ad["Girdiğiniz karar"].puan &&
     ad["%40 daha küçük"].puan >= ad["%20 daha küçük"].puan,
     ad["Girdiğiniz karar"].puan.toFixed(1) + " → " +
     ad["%20 daha küçük"].puan.toFixed(1) + " → " + ad["%40 daha küçük"].puan.toFixed(1));

  /* Vade uzatmayı "daha güvenli" diye sunup pahalılaştığını söylememek
     yanıltıcı olurdu; iki sayı da dönmeli. */
  var u = ad["Vade 12 ay uzun"];
  ok("vade uzayınca taksit düşüyor", u.taksit < ad["Girdiğiniz karar"].taksit,
     u.taksit.toFixed(0) + " < " + ad["Girdiğiniz karar"].taksit.toFixed(0));
  ok("ama toplam geri ödeme artıyor",
     u.toplamGeriOdeme > ad["Girdiğiniz karar"].toplamGeriOdeme,
     u.toplamGeriOdeme.toFixed(0) + " > " + ad["Girdiğiniz karar"].toplamGeriOdeme.toFixed(0));

  ok("erteleme alternatifi üretiliyor", !!ad["6 ay ertele"]);
  ok("erteleme puanı yükseltiyor",
     ad["6 ay ertele"].puan > ad["Girdiğiniz karar"].puan);

  /* Finansal pay yoksa erteleme bir şey kazandırmaz; sahte bir seçenek
     göstermek yerine hiç göstermiyoruz. */
  var dar = H({ netGelir: 50000, zorunluGider: 50000, nakit: 300000 });
  var altDar = E.alternatifler(dar, karar);
  var varMi = altDar.some(function (a) { return a.etiket === "6 ay ertele"; });
  ok("finansal pay yoksa erteleme seçeneği hiç üretilmiyor", varMi === false);
})();

/* ------------------------------------------------------------------ 16 */
baslik("Gerekçe — sayıdan üretiliyor, uydurulmuyor");
(function () {
  var d = H({ nakit: 700000, zorunluGider: 40000, hedefAy: 6 });
  var r = E.rapor(d, { tutar: 900000, pesinat: 300000, vade: 36,
                       aylikFaiz: 3.9, krediTuru: "tasit", aylikEkGider: 6000 });
  ok("gerekçe üretiliyor", r.gerekce.length > 0);
  var alanlar = r.gerekce.map(function (g) { return g.alan; });
  ok("dayanma süresi kısalması yakalanıyor", alanlar.indexOf("likidite") > -1,
     alanlar.join(","));
  ok("borç yükselmesi yakalanıyor", alanlar.indexOf("borc") > -1);
  ok("gerekçe metinlerinde ondalık ayracı virgül",
     r.gerekce.every(function (g) { return !/%\d+\.\d/.test(g.metin); }),
     r.gerekce.map(function (g) { return g.metin; }).join(" | "));

  /* Etkisiz bir karar için "hiçbir şey bozulmuyor" demek; boş liste
     döndürmek arayüzde sessiz boşluk bırakırdı. */
  var kucuk = E.rapor(H({ nakit: 5000000, zorunluGider: 30000, hedefAy: 6 }),
                      { tutar: 1000, pesinat: 1000, vade: 0 });
  ok("etkisiz kararda da bir cümle dönüyor", kucuk.gerekce.length === 1 &&
     kucuk.gerekce[0].alan === "yok");
})();

/* ------------------------------------------------------------------ 17 */
baslik("Rapor, normalleştirme ve uç durumlar");
(function () {
  var bos = E.rapor({}, {});
  ok("boş girdide çökmüyor", !!bos && !!bos.once);
  ok("boş girdide skor 0-100 arasında",
     bos.once.puan >= 0 && bos.once.puan <= 100, String(bos.once.puan));
  ok("karar yoksa sonrası da yok", bos.sonra === null && bos.guvenliTutar === null);

  var n = E.normalize({ netGelir: "1.234,56", enBuyukVarlikYuzde: 250,
                        dovizliBorcYuzde: -30, netGelirYok: 1 });
  ok('"1.234,56" → 1234.56', n.netGelir === 1234.56, String(n.netGelir));
  ok("yüzde alanları 0-100'e kırpılıyor",
     n.enBuyukVarlikYuzde === 100 && n.dovizliBorcYuzde === 0);
  ok("negatif tutarlar sıfıra çekiliyor",
     E.normalize({ nakit: -5000 }).nakit === 0);

  /* Zorunlu gider ve borç yoksa dayanma süresi sonsuzdur; bu sayının
     arayüze NaN olarak sızmaması gerekiyor. */
  var sonsuz = E.olcumler(E.normalize({ netGelir: 50000, nakit: 100000 }));
  ok("gider yoksa dayanma süresi sonsuz", sonsuz.menzil === Infinity);
  ok("sonsuz menzilde skor hâlâ sayı",
     isFinite(E.skor(E.normalize({ netGelir: 50000, nakit: 100000 })).puan));

  /* Her bileşen 0-100 aralığında kalmalı; biri taşarsa toplam skor sessizce
     bozulur. */
  var tasma = false;
  [H(), H({ nakit: 0 }), H({ netGelir: 0 }), H({ zorunluGider: 500000 }),
   H({ borcServisi: 200000, borcBakiye: 5000000 })].forEach(function (d) {
    var b = E.skor(d).bilesen;
    for (var k in b) if (!(b[k] >= 0 && b[k] <= 100)) tasma = true;
  });
  ok("bütün bileşenler 0-100 aralığında", tasma === false);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
