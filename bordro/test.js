/*!
 * Bordro Motoru — doğrulama testleri.  Çalıştırma:  node bordro/test.js
 *
 * En güçlü referans: brüt asgari ücret girildiğinde motorun ürettiği net,
 * Asgari Ücret Tespit Komisyonu'nun ilan ettiği resmî net asgari ücrete
 * eşit olmalıdır. Bu, tarife + SGK + istisna + damga zincirinin tamamını
 * tek seferde doğrular ve her yıl için bağımsız bir kontrol noktasıdır.
 */
"use strict";
var B = require("./motor.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, tolerans) { return Math.abs(a - b) <= (tolerans || 0.01); }
function baslik(s) { console.log("\n" + s); }

/* 1 — Resmî net asgari ücret referansı (her yıl, her dönem) */
baslik("Resmî net asgari ücret ile karşılaştırma");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil);
  var brutler = [];
  for (var m = 1; m <= 12; m++) brutler.push(B.donem(P, m).asgariBrut);
  var sonuc = B.hesaplaYil(brutler, yil);
  P.donemler.forEach(function (d) {
    var satir = sonuc.aylar[d.ay - 1];
    ok(yil + " / " + satir.ayAdi + " net asgari ücret = " + d.asgariNet,
      yakin(satir.net, d.asgariNet), satir.net.toFixed(2));
  });
});

/* 2 — Asgari ücret istisnası rejiminde asgari ücretli gelir vergisi ödemez */
baslik("Asgari ücretlinin yıl boyunca gelir vergisi yükü");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil);
  if (P.istisnaRejimi !== "asgari-ucret") return;
  var brutler = [];
  for (var m = 1; m <= 12; m++) brutler.push(B.donem(P, m).asgariBrut);
  var toplam = B.hesaplaYil(brutler, yil).toplam;
  ok(yil + " asgari ücretli yıllık gelir vergisi = 0", yakin(toplam.gelirVergisi, 0), toplam.gelirVergisi.toFixed(2));
  ok(yil + " asgari ücretli yıllık damga vergisi = 0", yakin(toplam.damga, 0), toplam.damga.toFixed(2));
});

/* 3 — AGİ rejiminde damga vergisi brütün tamamı üzerinden alınır */
baslik("AGİ rejimi (2020-2021) damga vergisi tabanı");
[2020, 2021].forEach(function (yil) {
  var P = B.parametre(yil), brut = P.donemler[0].asgariBrut;
  var satir = B.hesaplaYil(brut, yil).aylar[0];
  ok(yil + " damga = brüt × ‰7,59", yakin(satir.damga, brut * 0.00759), satir.damga.toFixed(2));
});

/* 4 — Kümülatif tarife tutarlılığı: aylık vergilerin toplamı yıllık matrahın vergisine eşit */
baslik("Kümülatif tarife tutarlılığı");
B.yillar().forEach(function (yil) {
  var sonuc = B.hesaplaYil(120000, yil);
  var aylikToplam = sonuc.aylar.reduce(function (t, a) { return t + a.vergiTarife; }, 0);
  var yillik = B.tarifeVergisi(sonuc.aylar[11].kumulatifMatrah, sonuc.parametre.dilimler);
  ok(yil + " Σ aylık tarife vergisi = yıllık matrahın vergisi", yakin(aylikToplam, yillik, 0.02));
});

/* 5 — SGK tavanı: tavanın üzerinde prim sabitlenir */
baslik("SGK tavanı");
B.yillar().forEach(function (yil) {
  var d = B.parametre(yil).donemler[0];
  var a = B.hesaplaYil(d.sgkTavan, yil).aylar[0];
  var b = B.hesaplaYil(d.sgkTavan * 3, yil).aylar[0];
  ok(yil + " tavan üstü SGK primi sabit", yakin(a.sgk, b.sgk), a.sgk.toFixed(2) + " ≠ " + b.sgk.toFixed(2));
});

/* 6 — Netten brüte çözücü, brütten nete ile tutarlı olmalı (gidiş-dönüş) */
baslik("Netten brüte gidiş-dönüş");
[[2026, 60000], [2026, 250000], [2025, 45000], [2023, 20000], [2021, 5000], [2020, 4000]].forEach(function (c) {
  var yil = c[0], hedef = c[1];
  var brut = B.nettenBrute(hedef, yil, 0);
  var net = B.hesaplaYil(brut, yil).aylar[0].net;
  ok(yil + " net " + hedef + " → brüt " + brut.toFixed(2) + " → net", yakin(net, hedef, 0.02), net.toFixed(2));
});

/* 7 — Kümülatif tarifenin tek yönlülüğü ve istisna muhasebesi.
       Not: NET maaş her zaman azalmaz. Asgari ücretlinin kümülatif matrahı
       üst dilime geçtiğinde istisna tutarı büyür ve yüksek ücretlinin neti
       yıl ortasında yükselebilir. Azalmayan büyüklük, tarife vergisidir. */
baslik("Kümülatif tarifenin tek yönlülüğü");
B.yillar().forEach(function (yil) {
  // Yıl içinde SGK tavanı değişen yıllarda matrah düşebileceği için bu değişmez geçerli değil.
  if (B.parametre(yil).donemler.length > 1) return;
  var aylar = B.hesaplaYil(150000, yil).aylar, azalan = false;
  for (var i = 1; i < 12; i++) if (aylar[i].vergiTarife < aylar[i - 1].vergiTarife - 0.01) azalan = true;
  ok(yil + " sabit brütte aylık tarife vergisi azalmıyor", !azalan);
});

baslik("Yıl içi SGK tavanı değişiminin matraha etkisi");
[2022, 2023].forEach(function (yil) {
  var P = B.parametre(yil), aylar = B.hesaplaYil(P.donemler[1].sgkTavan * 2, yil).aylar;
  ok(yil + " Temmuz'da tavan yükselince SGK primi artar", aylar[6].sgk > aylar[5].sgk);
  ok(yil + " Temmuz'da prim arttığı için matrah düşer", aylar[6].matrah < aylar[5].matrah);
});

baslik("İstisna muhasebesi: ödenen vergi = tarife − istisna");
B.yillar().forEach(function (yil) {
  var s = B.hesaplaYil(150000, yil);
  var tarife = 0, istisna = 0;
  s.aylar.forEach(function (a) { tarife += a.vergiTarife; istisna += a.istisna; });
  ok(yil + " Σ gelir vergisi = Σ tarife − Σ istisna",
    yakin(s.toplam.gelirVergisi, tarife - istisna, 0.02),
    s.toplam.gelirVergisi.toFixed(2) + " ≠ " + (tarife - istisna).toFixed(2));
});

baslik("İstisnanın dilim geçişi (2026, 150.000 TL brüt)");
var y26 = B.hesaplaYil(150000, 2026).aylar;
var artan = y26.some(function (a, i) { return i > 0 && a.net > y26[i - 1].net + 0.01; });
ok("Asgari ücret istisnası büyüdüğü için net yıl ortasında yükseliyor", artan);

/* 8 — Dilim geçişi işaretleniyor */
baslik("Vergi dilimi geçişi tespiti");
var g = B.hesaplaYil(150000, 2026).aylar.filter(function (a) { return a.dilimGecisi; });
ok("2026 / 150.000 TL brütte en az bir dilim geçişi işaretlendi", g.length > 0, g.length + " geçiş");
ok("İlk ay dilim geçişi olarak işaretlenmiyor", B.hesaplaYil(150000, 2026).aylar[0].dilimGecisi === false);

/* 9 — Bilinen tarife noktaları */
baslik("Tarife köşe noktaları");
ok("2026 / 190.000 matrahın vergisi = 28.500", yakin(B.tarifeVergisi(190000, B.parametre(2026).dilimler), 28500));
ok("2026 / 400.000 matrahın vergisi = 70.500", yakin(B.tarifeVergisi(400000, B.parametre(2026).dilimler), 28500 + 210000 * 0.20));
ok("2020 / 22.000 matrahın vergisi = 3.300", yakin(B.tarifeVergisi(22000, B.parametre(2020).dilimler), 3300));

/* 9b — Ücret dışı (serbest meslek / ticari) tarifesi.
       Ücret tarifesinden ayrıdır; üçüncü dilimin üst sınırı farklıdır. */
baslik("Ücret dışı gelir vergisi tarifesi");
var ud = B.parametre(2026).dilimlerUcretDisi;
ok("2026 ücret dışı tarife tanımlı", Array.isArray(ud) && ud.length === 5);
ok("Ücret tarifesinden farklı (3. dilim 1.000.000 / 1.500.000)",
  ud[2][0] === 1000000 && B.parametre(2026).dilimler[2][0] === 1500000);
[[190000, 28500], [400000, 70500], [1000000, 232500], [5300000, 1737500]].forEach(function (c) {
  ok("Ücret dışı: " + c[0] + " matrahın vergisi = " + c[1],
    yakin(B.tarifeVergisi(c[0], ud), c[1]), B.tarifeVergisi(c[0], ud).toFixed(2));
});
ok("Ücret dışı marjinal oran 500.000'de %27", B.dilimOrani(500000, ud) === 0.27);
ok("Ücret tarifesinde 500.000'de de %27", B.dilimOrani(500000, B.parametre(2026).dilimler) === 0.27);
ok("1.200.000'de tarifeler ayrışır: ücret dışı %35, ücret %27",
  B.dilimOrani(1200000, ud) === 0.35 && B.dilimOrani(1200000, B.parametre(2026).dilimler) === 0.27);

/* 10 — Her yıl için parametre bütünlüğü

   NEDEN BU KADAR AYRINTILI
   ------------------------
   Bu blok bir yıl eklenirken açılan kapıdır. Yeni yılın rakamları elle
   giriliyor ve yanlış girilen bir parametre SESSİZ: site hesaplamaya devam
   eder, yalnızca yanlış hesaplar. Buradaki denetimler "şu sayı şudur"
   demiyor — sayıları bilmiyoruz. Yapının kanunla tutarlı olduğunu söylüyor.

   Somut olay: 2026'da SGK tavanı asgari ücretin 9 katına çıktı (önceki
   bütün yıllarda 7,5). Doğru girilmişti, ama bunu anlamak parametre
   dosyasını okumayı gerektirdi; hiçbir test ilişkiyi bağlamıyordu. Aynı
   alan bir sonraki yıl eski katsayıyla yazılsaydı test yeşil kalırdı. */
baslik("Parametre bütünlüğü");

/* Sayısal alanların hepsi sonlu olmalı: undefined/NaN karşılaştırmaları
   sessizce false döner ve denetimi kandırır. */
function sayi(v) { return typeof v === "number" && isFinite(v); }

B.yillar().forEach(function (yil) {
  var P = B.parametre(yil), sorun = [];

  /* --- tarife ---------------------------------------------------------- */
  if (!P.dilimler || P.dilimler.length < 2) sorun.push("dilimler");
  else {
    if (P.dilimler[P.dilimler.length - 1][0] !== null) sorun.push("son dilim açık uçlu değil");
    P.dilimler.forEach(function (d, i) {
      var son = i === P.dilimler.length - 1;
      if (!son && !(sayi(d[0]) && d[0] > 0)) sorun.push((i + 1) + ". dilim eşiği sayı değil");
      if (!(sayi(d[1]) && d[1] > 0 && d[1] < 1)) sorun.push((i + 1) + ". dilim oranı geçersiz");
      if (i > 0) {
        var onc = P.dilimler[i - 1];
        /* Eşikler ve oranlar artan olmalı: tarife kümülatif okunuyor,
           sırası bozuk bir tarife yanlış dilim seçtirir. */
        if (!son && !(d[0] > onc[0])) sorun.push((i + 1) + ". eşik artmıyor");
        if (!(d[1] > onc[1])) sorun.push((i + 1) + ". oran artmıyor");
      }
    });
  }

  /* Ücret dışı tarife: aynı uzunluk, aynı oranlar, eşikleri ücret
     tarifesini AŞAMAZ (2026'da üçüncü dilim 1.000.000 / 1.500.000). */
  if (P.dilimlerUcretDisi) {
    var ud = P.dilimlerUcretDisi;
    if (ud.length !== P.dilimler.length) sorun.push("ücret dışı tarife uzunluğu");
    else ud.forEach(function (d, i) {
      var u = P.dilimler[i];
      if (d[1] !== u[1]) sorun.push((i + 1) + ". ücret dışı oran farklı");
      if ((d[0] === null) !== (u[0] === null)) sorun.push((i + 1) + ". ücret dışı açık uç");
      else if (d[0] !== null && d[0] > u[0]) sorun.push((i + 1) + ". ücret dışı eşik ücreti aşıyor");
    });
  }

  /* --- asgari ücret ve prim sınırları ----------------------------------- */
  if (!P.donemler || !P.donemler.length || P.donemler[0].ay !== 1) sorun.push("donemler");
  else {
    P.donemler.forEach(function (d, i) {
      if (!(d.ay >= 1 && d.ay <= 12)) sorun.push("dönem ayı " + d.ay);
      if (i > 0 && !(d.ay > P.donemler[i - 1].ay)) sorun.push("dönemler ay sırasında değil");
      if (!(sayi(d.asgariBrut) && d.asgariBrut > 0)) sorun.push("asgariBrut");
      if (!(sayi(d.asgariNet) && d.asgariNet > 0 && d.asgariNet < d.asgariBrut)) sorun.push("asgariNet");

      /* İŞTE ASIL KAPI. 5510 m.82 üst sınırı alt sınırın KATI olarak
         tanımlıyor; katsayı kanunla değişir, ilişki değişmez. Tavanı
         katsayıdan bağımsız yazmak, ikisinin sessizce ayrışmasına izin
         verirdi — tek doğruluk kaynağı kuralının prim tarafındaki hâli. */
      if (!sayi(P.tavanKatsayisi) || P.tavanKatsayisi <= 0) sorun.push("tavanKatsayisi");
      else if (!(sayi(d.sgkTavan) &&
                 Math.abs(d.sgkTavan - d.asgariBrut * P.tavanKatsayisi) < 0.005)) {
        sorun.push(d.ay + ". ay tavanı katsayıyla uyuşmuyor (" + d.sgkTavan +
          " ≠ " + d.asgariBrut + " × " + P.tavanKatsayisi + ")");
      }
    });
  }

  /* --- kıdem tavanı ----------------------------------------------------- */
  if (P.kidemTavanlari) {
    P.kidemTavanlari.forEach(function (k, i) {
      if (!(sayi(k.tutar) && k.tutar > 0)) sorun.push("kıdem tavanı tutarı");
      if (i > 0 && !(k.ay > P.kidemTavanlari[i - 1].ay)) sorun.push("kıdem tavanları ay sırasında değil");
    });
  }

  if (P.istisnaRejimi === "agi" && !P.agiOranlari) sorun.push("agiOranlari");
  if (!P.dayanak) sorun.push("dayanak");
  ok(yil + " parametre bloğu tutarlı", sorun.length === 0, sorun.join(", "));
});

/* Yıllar arası tek yönlülük. Yeniden değerleme oranı negatif olmadığı
   sürece ne asgari ücret ne de dilim eşikleri nominal olarak geriler;
   gerilemişse yanlış yıla yazılmış bir rakam vardır. */
(function () {
  var sirali = B.yillar().slice().sort(function (a, b) { return a - b; });
  for (var i = 1; i < sirali.length; i++) {
    var onc = B.parametre(sirali[i - 1]), sim = B.parametre(sirali[i]), sorun = [];
    if (!(sim.donemler[0].asgariBrut > onc.donemler[0].asgariBrut)) sorun.push("asgari ücret gerilemiş");
    for (var j = 0; j < Math.min(onc.dilimler.length, sim.dilimler.length); j++) {
      if (onc.dilimler[j][0] === null || sim.dilimler[j][0] === null) continue;
      if (sim.dilimler[j][0] < onc.dilimler[j][0]) sorun.push((j + 1) + ". eşik gerilemiş");
    }
    ok(sirali[i] + " bir önceki yıla göre tutarlı", sorun.length === 0, sorun.join(", "));
  }
})();

baslik("İşveren maliyeti ve 5 puanlık indirim");
(function () {
  var a = B.hesaplaYil(60000, 2026).aylar[0];
  var t = B.hesaplaYil(60000, 2026, { tesvik5Puan: true }).aylar[0];
  var o = B.parametre(2026).oranlar;
  ok("Maliyet = brüt + işveren primleri",
     yakin(a.isverenMaliyeti, a.brut + a.isverenSgk + a.isverenIssizlik, 0.01));
  ok("İşveren SGK payı prime esas kazanç üzerinden",
     yakin(a.isverenSgk, a.primEsas * o.sgkIsveren, 0.01));
  ok("5 puanlık indirim tam 5 puan düşürür",
     yakin(a.isverenSgk - t.isverenSgk, a.primEsas * o.sgkIsverenIndirim, 0.01),
     "fark: " + (a.isverenSgk - t.isverenSgk));
  ok("İndirim işsizlik işveren payına uygulanmaz",
     yakin(a.isverenIssizlik, t.isverenIssizlik, 0.001));
  /* SGK tavanı: tavanın üstünde prim büyümüyor, ücret büyüyor. */
  var y = B.hesaplaYil(400000, 2026).aylar[0];
  ok("Tavanın üstünde prime esas kazanç tavanla sınırlı",
     yakin(y.primEsas, y.sgkTavan, 0.01), "primEsas: " + y.primEsas);
})();

baslik("Net ücret sözleşmesi — 12 aylık brüt");
(function () {
  var HEDEF = 60000;
  var brutler = B.nettenBruteYil(HEDEF, 2026);
  var y = B.hesaplaYil(brutler, 2026);
  var enBuyukSapma = 0;
  y.aylar.forEach(function (a) {
    enBuyukSapma = Math.max(enBuyukSapma, Math.abs(a.net - HEDEF));
  });
  ok("Net her ay hedefte kalır", enBuyukSapma < 0.05,
     "en büyük sapma: " + enBuyukSapma.toFixed(2));
  ok("Brüt yıl içinde yükselir", brutler[6] > brutler[0]);
  /* Ay ay çözümleri tek tek alıp yan yana koymak neti tutturmuyor;
     regresyonu yakalamak için o yanlış yöntemin sapması da ölçülüyor. */
  var tekTek = [];
  for (var i = 0; i < 12; i++) tekTek.push(B.nettenBrute(HEDEF, 2026, i));
  var yanlis = B.hesaplaYil(tekTek, 2026);
  var sapma = 0;
  yanlis.aylar.forEach(function (a) { sapma = Math.max(sapma, Math.abs(a.net - HEDEF)); });
  ok("Tek tek çözüm neti tutturmaz (nettenBruteYil bu yüzden var)", sapma > 1,
     "sapma: " + sapma.toFixed(2));
})();

baslik("Fazla mesai parametreleri");
(function () {
  B.yillar().forEach(function (yil) {
    var f = B.parametre(yil).fazlaMesai;
    ok(yil + " fazla mesai parametreleri tanımlı",
       !!f && f.aylikSaat === 225 && f.fazlaCalismaKat === 1.5 &&
       f.fazlaSureliKat === 1.25 && f.yillikUstSinirSaat === 270,
       f ? JSON.stringify(f) : "yok");
  });
  /* Saat ücreti ve zamlı tutar: 60.000 TL brütte 10 saat %50 zamlı
     fazla çalışma tam 4.000 TL brüt eder. */
  var f = B.parametre(2026).fazlaMesai;
  var saatlik = 60000 / f.aylikSaat;
  ok("60.000 TL brütte saat ücreti 266,67", yakin(saatlik, 266.6667, 0.001));
  ok("10 saat %50 zamlı mesai 4.000 TL brüt",
     yakin(saatlik * f.fazlaCalismaKat * 10, 4000, 0.01));

  /* SERBEST ZAMAN KANUNDA IKI KATSAYILIDIR. 4857 m.41/4: fazla calismada
     "bir saat otuz dakika", fazla surelerle calismada "bir saat onbes
     dakika". Parametrede tek katsayi (1,5) tutuluyordu ve arac ikisine de
     onu uyguluyordu; %25'lik calismada izni beste bir fazla gosteriyordu.
     Serbest zaman, ucret zamminin ZAMAN cinsinden aynasidir: katsayilar
     ucret katsayilariyla ayni olmali. */
  B.yillar().forEach(function (yil) {
    var g = B.parametre(yil).fazlaMesai;
    ok(yil + " serbest zaman iki katsayili",
       g.serbestZamanFazlaCalismaKat === 1.5 &&
       g.serbestZamanFazlaSureliKat === 1.25,
       JSON.stringify(g));
    ok(yil + " serbest zaman katsayilari ucret katsayilarinin aynasi",
       g.serbestZamanFazlaCalismaKat === g.fazlaCalismaKat &&
       g.serbestZamanFazlaSureliKat === g.fazlaSureliKat);
    ok(yil + " serbest zaman penceresi 6 ay", g.serbestZamanAyPenceresi === 6);
    ok(yil + " tek katsayili eski alan kaldirildi",
       g.serbestZamanKat === undefined, String(g.serbestZamanKat));
  });
  /* Somut karsilik: 8 saat fazla calisma 12 saat izin, 8 saat fazla
     surelerle calisma 10 saat izin. */
  ok("8 saat fazla calisma -> 12 saat izin",
     8 * f.serbestZamanFazlaCalismaKat === 12);
  ok("8 saat fazla surelerle calisma -> 10 saat izin",
     8 * f.serbestZamanFazlaSureliKat === 10);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
