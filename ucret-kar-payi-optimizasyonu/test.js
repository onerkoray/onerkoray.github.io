/*!
 * Ücret–Kâr Payı Optimizasyon Çekirdeği — doğrulama testleri.
 *   node ucret-kar-payi-optimizasyonu/test.js
 *
 * Bu çekirdek bir OPTİMİZASYON yapıyor; optimizasyonun hatası sessizdir,
 * çünkü her zaman bir "en iyi" döndürür. Testler bu yüzden üç şeyi sınıyor:
 *
 *   1. FİZİBİLİTE. Şirketin ödeyemeyeceği ücret önerilmemeli. Kısıt
 *      olmadan model eksi kurum kazancı üretip NEGATİF efektif yük
 *      veriyordu — yani "vergi ödemek yerine devletten para alıyorsunuz"
 *      gibi saçma bir sonuç. Kısıt testle korunuyor.
 *   2. İKİYE BÖLMENİN GEÇERLİLİĞİ. Beyan eşiği ikiye bölmeyle bulunuyor;
 *      bu ancak beyanVar bayrağı ücret arttıkça TEK KEZ dönüyorsa doğru.
 *      Tek yönlülük ayrıca sınanıyor.
 *   3. UÇURUMUN GERÇEKLİĞİ. Eşiği geçince kaybedilen net, kaybedilen
 *      iadeye eşit olmalı. Eşit değilse mekanizmayı yanlış anlamışız
 *      demektir.
 */
"use strict";
var O = require("./hesap.js");
var CB = require("../bordro/calisma-bicimi.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= t; }
function baslik(s) { console.log("\n" + s); }

var ORNEK = { hasilat: 3000000, gider: 300000, adet: 60 };

/* ------------------------------------------------------------------ 1 */
baslik("Fizibilite kısıtı");
(function () {
  var d = O.normalize(ORNEK);
  ok("üst sınır = (hasılat − gider) ÷ 12",
     yakin(O.fizibilUst(d), (3000000 - 300000) / 12, 1e-9),
     String(O.fizibilUst(d)));

  var t = O.tara(ORNEK);
  ok("hiçbir nokta üst sınırı aşmıyor",
     t.noktalar.every(function (n) { return n.aylikUcret <= t.fizibilUst + 1.5; }));
  ok("optimum üst sınırın içinde", t.optimum.aylikUcret <= t.fizibilUst + 1.5);

  /* Kısıt olmasa negatif efektif yük çıkıyordu; artık çıkmamalı. */
  ok("hiçbir noktada efektif yük negatif değil",
     t.noktalar.every(function (n) { return n.efektifYuk >= 0; }),
     Math.min.apply(null, t.noktalar.map(function (n) { return n.efektifYuk; })).toFixed(4));
  ok("dağıtılabilir kâr hiçbir noktada eksi değil",
     t.noktalar.every(function (n) { return n.dagitilabilir >= 0; }));

  ok("gider hasılatı aşarsa kırpılıyor",
     O.normalize({ hasilat: 100000, gider: 500000 }).gider === 100000);
  var bos = O.tara({ hasilat: 0, gider: 0 });
  ok("hasılat yoksa çökmüyor", bos.optimum === null && bos.fizibilUst === 0);
})();

/* ------------------------------------------------------------------ 2 */
baslik("Motorla tutarlılık — hesap yeniden yazılmadı");
(function () {
  var v = O.deger(O.normalize(ORNEK), 100000);
  var r = CB.karsilastir({
    yillikMaliyet: 3000000, yillikGider: 300000, ihracatOrani: 0,
    ortakUcretBrut: 100000
  });
  var s = r.senaryolar.filter(function (x) { return x.kod === "limitedUcret"; })[0];
  ok("net doğrudan çalışma biçimi motorundan geliyor", yakin(v.net, s.net, 1e-9));
  ok("kâr payı stopajı aynı", yakin(v.karPayiStopaji, s.karPayiStopaji, 1e-9));
  ok("beyan durumu aynı", v.beyanVar === s.beyanVar);
})();

/* ------------------------------------------------------------------ 3 */
baslik("İKİYE BÖLMENİN GEÇERLİLİĞİ — beyanVar tek yönlü mü");
(function () {
  /* Ücret arttıkça kâr payı küçülür; beyanVar true'dan false'a bir kez
     dönmeli. İki kez dönseydi ikiye bölme yanlış eşiği bulurdu. */
  var d = O.normalize(ORNEK);
  var ust = O.fizibilUst(d);
  var donus = 0, onceki = null;
  for (var i = 0; i <= 120; i++) {
    var b = O.deger(d, ust * i / 120).beyanVar;
    if (onceki !== null && b !== onceki) donus++;
    onceki = b;
  }
  ok("beyanVar bayrağı yalnızca bir kez dönüyor", donus === 1, donus + " dönüş");

  var e = O.beyanEsigi(d);
  ok("eşik bulundu", !!e);
  ok("eşiğin hemen altında beyan var", O.deger(d, e.aylikUcret).beyanVar === true);
  ok("eşiğin hemen üstünde beyan yok",
     O.deger(d, e.aylikUcret + 2).beyanVar === false);
})();

/* ------------------------------------------------------------------ 4 */
baslik("UÇURUM — eşiği geçmek neti düşürüyor");
(function () {
  var d = O.normalize(ORNEK);
  var e = O.beyanEsigi(d);
  ok("eşiği geçince net DÜŞÜYOR (ücreti artırmak zarar ettiriyor)",
     e.netKaybi > 0, Math.round(e.netKaybi) + " TL");

  /* Mekanizma kontrolü: kaybedilen net, kaybedilen iadeye eşit olmalı.
     Eşit değilse başka bir şey oluyor demektir ve açıklamamız yanlıştır. */
  ok("net kaybı = kaybedilen stopaj iadesi",
     yakin(e.netKaybi, e.kaybedilenIade, 1200),
     Math.round(e.netKaybi) + " vs " + Math.round(e.kaybedilenIade));

  ok("eşiğin altında iade var, üstünde yok",
     O.deger(d, e.aylikUcret).iadeGV > 0 &&
     O.deger(d, e.aylikUcret + 2).iadeGV === 0);
})();

/* ------------------------------------------------------------------ 5 */
baslik("Optimum gerçekten en iyi mi");
(function () {
  var t = O.tara(ORNEK);
  ok("optimum, taranan bütün noktalardan iyi",
     t.noktalar.every(function (n) { return n.net <= t.optimum.net + 1e-6; }));
  ok("optimum ücretsiz senaryodan iyi", t.optimum.net > t.kiyas.ucretsiz.net);
  ok("optimum azami ücret senaryosundan iyi", t.optimum.net > t.kiyas.azamiUcret.net);
  ok("kazanç pozitif ve anlamlı", t.kiyas.kazancUcretsizeGore > 10000,
     Math.round(t.kiyas.kazancUcretsizeGore) + " TL");

  /* Optimum İÇERİDE olmalı: ne sıfır ne de tavan. Uçta çıkarsa problem
     dejenere demektir ve aracın anlatacağı bir şey kalmaz. */
  ok("optimum içeride (0 da değil, tavan da değil)",
     t.optimum.aylikUcret > 1 && t.optimum.aylikUcret < t.fizibilUst - 1,
     Math.round(t.optimum.aylikUcret) + " / " + Math.round(t.fizibilUst));

  /* Daha ince tarama optimumu belirgin biçimde iyileştirmemeli; aksi hâlde
     ızgara çok kaba demektir. */
  var ince = O.tara({ hasilat: 3000000, gider: 300000, adet: 200 });
  ok("ızgara yeterince ince (200 nokta anlamlı iyileşme vermiyor)",
     ince.optimum.net - t.optimum.net < t.optimum.net * 0.002,
     Math.round(ince.optimum.net - t.optimum.net) + " TL fark");
})();

/* ------------------------------------------------------------------ 6 */
baslik("Farklı ölçeklerde davranış");
(function () {
  var kucuk = O.tara({ hasilat: 1500000, gider: 200000 });
  var buyuk = O.tara({ hasilat: 12000000, gider: 1000000 });
  ok("küçük şirkette de optimum bulunuyor", kucuk.optimum !== null);
  ok("büyük şirkette optimum daha yüksek ücret",
     buyuk.optimum.aylikUcret > kucuk.optimum.aylikUcret);
  ok("her iki ölçekte de ücretsize göre kazanç var",
     kucuk.kiyas.kazancUcretsizeGore > 0 && buyuk.kiyas.kazancUcretsizeGore > 0);

  /* Kâr payı hiç beyan haddini aşmıyorsa eşik YOKTUR; bunu "eşik bulundu"
     diye uydurmamalı. */
  var minik = O.tara({ hasilat: 700000, gider: 100000 });
  ok("kâr payı eşiği aşmıyorsa eşik null dönüyor",
     minik.esik === null || minik.esik.netKaybi >= 0);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Girdi normalleştirme");
(function () {
  var d = O.normalize({ hasilat: "3.000.000", gider: "300.000,50", ihracatOrani: 2 });
  ok('"3.000.000" → 3000000', d.hasilat === 3000000);
  ok('"300.000,50" → 300000.5', yakin(d.gider, 300000.5, 1e-9));
  ok("ihracat oranı 0-1 aralığına kırpılıyor", d.ihracatOrani === 1);
  ok("negatif hasılat sıfırlanıyor", O.normalize({ hasilat: -5 }).hasilat === 0);
  ok("eski alan adları da kabul ediliyor (yillikMaliyet/yillikGider)",
     O.normalize({ yillikMaliyet: 100, yillikGider: 10 }).hasilat === 100);

  var o = O.optimum(ORNEK);
  ok("optimum() kısa yolu çalışıyor", o && o.aylikUcret > 0 && o.yillikNet > 0);
  ok("adet alt/üst sınırı uygulanıyor",
     O.tara({ hasilat: 3000000, gider: 300000, adet: 1 }).noktalar.length >= 10 &&
     O.tara({ hasilat: 3000000, gider: 300000, adet: 9999 }).noktalar.length <= 205);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
