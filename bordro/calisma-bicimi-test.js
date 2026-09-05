/*!
 * Çalışma Biçimi Karşılaştırma Motoru — doğrulama testleri.
 * Çalıştırma:  node bordro/calisma-bicimi-test.js
 *
 * Bu motorda en tehlikeli hata, senaryolardan birini haksız yere iyi ya da kötü
 * göstermektir; çünkü çıktı doğrudan bir karara dönüşür. Bu yüzden testlerin
 * ağırlığı "ortak payda gerçekten ortak mı" ve "her senaryo aynı kuralla
 * ölçülüyor mu" sorularında.
 */
"use strict";
var B = require("./motor.js");
var K = require("./calisma-bicimi.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.02); }
function baslik(s) { console.log("\n" + s); }

function ornek(ek) {
  var g = { yillikMaliyet: 1200000, yillikGider: 100000, ihracatOrani: 0 };
  for (var k in (ek || {})) g[k] = ek[k];
  return K.karsilastir(g);
}
function bul(r, kod) {
  return r.senaryolar.filter(function (s) { return s.kod === kod; })[0];
}

var P = B.parametre(2026);
var S = P.sirket;
var d = P.donemler[0];

/* 1 — Ortak payda: çalışan senaryosunda işveren maliyeti tam olarak girilen tutar */
baslik("Ortak payda: işveren maliyeti");
[600000, 1200000, 3000000, 12000000].forEach(function (m) {
  var c = bul(ornek({ yillikMaliyet: m }), "calisan");
  var brut = c.aylikBrut;
  var pek = Math.min(Math.max(brut, d.asgariBrut), d.sgkTavan);
  var maliyet = (brut + pek * (P.oranlar.sgkIsveren + P.oranlar.issizlikIsveren)) * 12;
  ok(m + " TL maliyet → brütten geri hesaplanan maliyet aynı", yakin(maliyet, m, 1), maliyet.toFixed(2));
});
ok("SGK tavanı üstünde de maliyet tutuyor (prim tavanda durur)", (function () {
  var m = 60000000;
  var c = bul(ornek({ yillikMaliyet: m }), "calisan");
  var pek = Math.min(Math.max(c.aylikBrut, d.asgariBrut), d.sgkTavan);
  return yakin((c.aylikBrut + pek * (P.oranlar.sgkIsveren + P.oranlar.issizlikIsveren)) * 12, m, 1);
})());

/* 2 — Her senaryoda net, maliyeti aşamaz ve negatif olamaz */
baslik("Sınırlar");
[300000, 600000, 1200000, 5000000, 20000000].forEach(function (m) {
  var r = ornek({ yillikMaliyet: m, yillikGider: 0 });
  var hepsi = r.senaryolar.every(function (s) { return s.net >= 0 && s.net <= m; });
  ok(m + " TL'de tüm senaryolarda 0 ≤ net ≤ maliyet", hepsi,
    r.senaryolar.map(function (s) { return s.kisa + ":" + s.net.toFixed(0); }).join(" "));
  var yuk = r.senaryolar.every(function (s) { return s.efektifYuk >= 0 && s.efektifYuk <= 1; });
  ok(m + " TL'de efektif yük %0-100 aralığında", yuk);
  var toplam = r.senaryolar.every(function (s) { return yakin(s.net + s.gider + s.devleteGiden, m, 1); });
  ok(m + " TL'de net + gider + devlete giden = toplam maliyet", toplam);
});

/* 3 — Gider yalnızca işletme senaryolarını etkiler */
baslik("Giderin etkisi");
var giderYok = ornek({ yillikGider: 0 });
var giderVar = ornek({ yillikGider: 300000 });
ok("Çalışanın neti giderden etkilenmez",
  yakin(bul(giderYok, "calisan").net, bul(giderVar, "calisan").net));
/* Gider gerçekten harcanan paradır: neti düşürür. Doğru değişmez, giderin
   vergi kalkanı sayesinde netteki düşüşün gider tutarından KÜÇÜK olmasıdır. */
["sahis", "limited", "limitedUcret"].forEach(function (kod) {
  var dusus = bul(giderYok, kod).net - bul(giderVar, kod).net;
  ok(kod + ": 300.000 TL gider, neti 300.000'den az düşürür (vergi kalkanı)",
    dusus > 0 && dusus < 300000, "düşüş " + dusus.toFixed(0));
  ok(kod + ": gider devlete gideni azaltır",
    bul(giderVar, kod).devleteGiden < bul(giderYok, kod).devleteGiden);
});
ok("Çalışanda gider vergi kalkanı yaratmaz",
  yakin(bul(giderYok, "calisan").devleteGiden, bul(giderVar, "calisan").devleteGiden));
ok("Gider, maliyeti aşacak şekilde girilirse maliyete kırpılır",
  ornek({ yillikMaliyet: 500000, yillikGider: 900000 }).girdi.yillikGider === 500000);

/* 4 — Hizmet ihracatı indirimi */
baslik("Hizmet ihracatı indirimi (GVK m.89/13)");
var yurtici = ornek({ yillikMaliyet: 3000000, ihracatOrani: 0 });
var ihracat = ornek({ yillikMaliyet: 3000000, ihracatOrani: 1 });
ok("Çalışan ihracat indiriminden yararlanamaz",
  yakin(bul(yurtici, "calisan").net, bul(ihracat, "calisan").net));
["sahis", "limited", "limitedUcret"].forEach(function (kod) {
  ok(kod + ": ihracatta net artar", bul(ihracat, kod).net > bul(yurtici, kod).net);
});
ok("İndirim oranı kazancın %80'i üzerinden",
  yakin(bul(ihracat, "sahis").ihracatIndirimi,
    (3000000 - 100000) * S.hizmetIhracatiIndirimi, 0.05),
  bul(ihracat, "sahis").ihracatIndirimi.toFixed(2));

/* 5 — Bağ-Kur */
baslik("Bağ-Kur (4/b) primi");
var bkTaban = K.bagkurYillik(P, 0, false);
ok("Matrah girilmezse taban asgari ücrettir", bkTaban.aylikMatrah === d.asgariBrut);
ok("Standart oran %34,75", yakin(bkTaban.oran, S.bagkurOrani, 1e-9));
ok("Yıllık prim = aylık matrah × oran × 12",
  yakin(bkTaban.yillik, d.asgariBrut * S.bagkurOrani * 12));
ok("5 puanlık indirim primi düşürür",
  K.bagkurYillik(P, 0, true).yillik < bkTaban.yillik);
ok("Matrah SGK tavanının üstüne çıkamaz",
  K.bagkurYillik(P, d.sgkTavan * 5, false).aylikMatrah === d.sgkTavan);
ok("Matrah asgari ücretin altına inemez",
  K.bagkurYillik(P, 1000, false).aylikMatrah === d.asgariBrut);
ok("Bağ-Kur, şahıs işletmesinde matrahtan indiriliyor", (function () {
  var s = bul(ornek(), "sahis");
  return yakin(s.matrah, Math.max(0, s.kazanc - s.bagkur.yillik - s.ihracatIndirimi));
})());

/* 6 — Limited şirket zinciri */
baslik("Limited şirket");
var L = bul(ornek({ yillikMaliyet: 3000000 }), "limited");
ok("Kurumlar vergisi = matrah × %25", yakin(L.kurumlarVergisi, L.kvMatrah * S.kurumlarVergisi));
ok("Dağıtılabilir kâr = kurum kazancı − kurumlar vergisi",
  yakin(L.dagitilabilir, L.kurumKazanci - L.kurumlarVergisi));
ok("Kâr payı stopajı = dağıtılabilir × %15",
  yakin(L.karPayiStopaji, L.dagitilabilir * S.karPayiStopaji));
ok("Beyan haddi tarifenin ikinci dilimidir (400.000)",
  K.beyanHaddi(P) === 400000 && L.beyanHaddi === 400000);
ok("Beyana tabi tutar kâr payının yarısıdır",
  yakin(L.beyanaTabi, L.dagitilabilir * S.karPayiIstisnaOrani));

var kucuk = bul(ornek({ yillikMaliyet: 700000, yillikGider: 0 }), "limited");
ok("Küçük kârda beyan gerekmez, stopaj nihaidir", kucuk.beyanVar === false);
ok("Beyan yoksa ek gelir vergisi doğmaz", kucuk.odenecekGV === 0 && kucuk.iadeGV === 0);
ok("Büyük kârda beyan verilir", L.beyanVar === true);
ok("Beyanda kesilen stopajın tamamı mahsup edilir",
  yakin(L.odenecekGV - L.iadeGV, L.hesaplananGV - L.karPayiStopaji));

/* 7 — Ortağa ücret: limited ortağı 4/b'dir, ücretten SGK kesilmez */
baslik("Ortağa ücret (huzur hakkı)");
var LU = bul(ornek({ yillikMaliyet: 3000000 }), "limitedUcret");
ok("Ücretin şirkete maliyeti brütün kendisidir (işveren primi yok)",
  yakin(LU.ucretIsverenMaliyeti, LU.ucretBrut * 12));
ok("Primsiz ücrette SGK kesintisi sıfır",
  B.hesaplaYil(50000, 2026, { primsiz: true }).toplam.sgk === 0);
ok("Primsiz ücrette matrah brütün tamamıdır",
  yakin(B.hesaplaYil(50000, 2026, { primsiz: true }).aylar[0].matrah, 50000));
ok("Asgari ücret istisnası primsiz ücrette de uygulanır",
  B.hesaplaYil(d.asgariBrut, 2026, { primsiz: true }).toplam.istisna > 0);
ok("Ücret ödemesi kurum kazancını düşürür",
  LU.kurumKazanci < L.kurumKazanci);
ok("Varsayılan ortak ücreti brüt asgari ücrettir",
  ornek().ortakUcretBrut === d.asgariBrut);

/* 8 — Tekdüzelik: maliyet arttıkça her senaryoda net artar */
baslik("Tekdüzelik");
["calisan", "sahis", "limited", "limitedUcret"].forEach(function (kod) {
  var artan = true, onceki = -1;
  [400000, 800000, 1500000, 3000000, 6000000, 12000000].forEach(function (m) {
    var net = bul(ornek({ yillikMaliyet: m, yillikGider: 0 }), kod).net;
    if (net < onceki) artan = false;
    onceki = net;
  });
  ok(kod + ": maliyet arttıkça net azalmıyor", artan);
});

/* 9 — Karşılaştırmanın kendisi */
baslik("Karşılaştırma");
var r = ornek();
ok("Dört senaryo üretiliyor", r.senaryolar.length === 4);
ok("enIyi gerçekten en yüksek net",
  r.enIyi.net === Math.max.apply(null, r.senaryolar.map(function (s) { return s.net; })));
ok("En iyi senaryonun farkı sıfır", yakin(bul(r, r.enIyi.kod).fark, 0));
ok("Diğer senaryoların farkı negatif",
  r.senaryolar.every(function (s) { return s.enIyi ? true : s.fark < 0; }));
ok("Yalnızca bir senaryo en iyi işaretli",
  r.senaryolar.filter(function (s) { return s.enIyi; }).length === 1);
ok("Her senaryoda gerekçe notu var",
  r.senaryolar.every(function (s) { return s.notlar && s.notlar.length > 0; }));
ok("Çalışan senaryosu gider yazamaz olarak işaretli",
  bul(r, "calisan").giderYazabilir === false);

/* 10 — Kesişim: düşük gelirde çalışan, yüksek gelirde şirket avantajlı olmalı */
baslik("Kesişim noktaları");
ok("Düşük gelirde (600.000) çalışan öne geçiyor",
  ornek({ yillikMaliyet: 600000, yillikGider: 50000 }).enIyi.kod === "calisan");
ok("Yüksek gelirde (3.000.000) çalışan öne geçmiyor",
  ornek({ yillikMaliyet: 3000000, yillikGider: 300000 }).enIyi.kod !== "calisan");
ok("Tam ihracatta şahıs işletmesi en avantajlı",
  ornek({ yillikMaliyet: 3000000, yillikGider: 300000, ihracatOrani: 1 }).enIyi.kod === "sahis");

/* 11 — Uç değerler */
baslik("Uç değerler");
var sifir = K.karsilastir({ yillikMaliyet: 0, yillikGider: 0 });
ok("Sıfır maliyette NaN üretilmiyor",
  sifir.senaryolar.every(function (s) { return isFinite(s.net); }),
  sifir.senaryolar.map(function (s) { return s.net; }).join(" "));
ok("Negatif gider sıfıra çekilir", K.karsilastir({ yillikMaliyet: 100000, yillikGider: -5 }).girdi.yillikGider === 0);
ok("İhracat oranı 0-1 aralığına kırpılır",
  K.karsilastir({ yillikMaliyet: 100000, ihracatOrani: 5 }).girdi.ihracatOrani === 1 &&
  K.karsilastir({ yillikMaliyet: 100000, ihracatOrani: -2 }).girdi.ihracatOrani === 0);
ok("Parametresi olmayan yıl hata veriyor", (function () {
  try { K.karsilastir({ yillikMaliyet: 100000, yil: 2019 }); return false; }
  catch (e) { return true; }
})());
ok("Şirket parametresi olmayan yılda anlaşılır hata", (function () {
  try { K.karsilastir({ yillikMaliyet: 100000, yil: 2024 }); return false; }
  catch (e) { return /şirket parametreleri/i.test(e.message); }
})());

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
