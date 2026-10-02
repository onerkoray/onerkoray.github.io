/*!
 * Emekli çalışan (SGDP) karşılaştırma motoru — testler.
 * Çalıştırma: node bordro/sgdp-test.js
 *
 * Beklenenler motorun kendisinden değil: brüt anlaşmadaki maliyet farkı
 * oranların kapalı formülünden, net anlaşmadaki net hedeften, asgari ücret
 * kırpması dönem tablosundan, eşik ise iki yanındaki işaretten sınanır.
 */
"use strict";
var B = require("./motor.js");
var S = require("./sgdp.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t == null ? 0.01 : t); }
function baslik(s) { console.log("\n" + s); }
function reddet(g) { try { S.karsilastir(g); return false; } catch (e) { return true; } }

baslik("Brüt anlaşma: maliyet farkı = Σ PEK × oran farkı");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil);
  ["", "genel", "imalat"].forEach(function (te) {
    var tutar = P.donemler[P.donemler.length - 1].asgariBrut * 2.5;
    var r = S.karsilastir({ tutar: tutar, mod: "brut", yil: yil, tesvik: te });
    var bek = 0;
    for (var ay = 1; ay <= 12; ay++) {
      var o = B.oranlarAy(P, ay), d = B.donem(P, ay);
      var pek = Math.min(Math.max(tutar, d.asgariBrut), d.sgkTavan);
      var ind = te === "imalat" ? o.sgkIsverenIndirimImalat : te === "genel" ? o.sgkIsverenIndirim : 0;
      bek += pek * ((o.sgdpIsveren + o.kisaVadeli) - (o.sgkIsveren - ind + o.issizlikIsveren));
    }
    ok(yil + " " + (te || "indirimsiz") + ": yıllık fark " + Math.round(bek),
       yakin(r.fark.maliyetYil, bek, 0.05), r.fark.maliyetYil.toFixed(2));
  });
});

baslik("Net anlaşma: emekli ve emekli olmayan aynı neti alır");
B.yillar().forEach(function (yil) {
  var P = B.parametre(yil), t = P.donemler[0].asgariNet * 2;
  var r = S.karsilastir({ tutar: t, mod: "net", yil: yil, tesvik: "genel" });
  ok(yil + " net " + Math.round(t) + " her ay iki tarafta da hedefte",
     r.aylar.every(function (a) { return yakin(a.emekli.net, t, 0.02) && yakin(a.normal.net, t, 0.02); }));
  ok(yil + " aynı net için emeklinin brütü düşük", r.aylar.every(function (a) { return a.emekli.brut < a.normal.brut; }));
});

baslik("Asgari ücret sınırı (sözleşme kuralı)");
(function () {
  var P = B.parametre(2026), d = B.donem(P, 1);
  var r = S.karsilastir({ tutar: d.asgariNet, mod: "net", yil: 2026 });
  ok("2026 net 28.075,50: emeklinin 12 ayı asgari ücrete kırpıldı", r.kirpilan.emekli.length === 12, r.kirpilan.emekli.join(","));
  ok("emekli olmayan kırpılmadı", r.kirpilan.normal.length === 0);
  ok("kırpılan emekli asgari ücretlinin netini alır (30.181,16)", yakin(r.aylar[0].emekli.net, 30181.16, 0.01), r.aylar[0].emekli.net.toFixed(2));
  ok("bu bölgede net anlaşmada da emekli pahalı", r.hukum.yon === "pahali" && r.fark.maliyetYil > 0);
  ok("brüt asgari ücretten az reddedilir", reddet({ tutar: d.asgariBrut - 1, mod: "brut", yil: 2026 }));
  ok("brüt tam asgari ücret kabul edilir", !reddet({ tutar: d.asgariBrut, mod: "brut", yil: 2026 }));
})();

baslik("Eşik net: altında pahalı, üstünde ucuz");
B.yillar().forEach(function (yil) {
  ["", "genel", "imalat"].forEach(function (te) {
    var e = S.esikNet({ yil: yil, tesvik: te });
    function f(t) { return S.karsilastir({ tutar: t, mod: "net", yil: yil, tesvik: te }).fark.maliyetYil; }
    ok(yil + " " + (te || "indirimsiz") + " eşik " + (e && e.toFixed(2)), e > 0 && f(e - 1) > 0 && f(e + 1) <= 0.01,
       f(e - 1).toFixed(2) + " / " + f(e + 1).toFixed(2));
  });
});
(function () {
  /* 2022+: eşik, Ocak'taki emekli olmayan asgari net ile son dönemin
     emekli asgari neti arasında olmalı. Altında iki taraf da kırpılır
     (emekli pahalı); üst sınırın üstünde hiçbir ay kırpılmaz (emekli ucuz).
     Temmuz zammı olan yıllarda (2022, 2023) sabit net ikinci yarıda yeni
     asgari ücrete kırpıldığı için üst sınır son dönemden alınır. */
  B.yillar().filter(function (y) { return B.parametre(y).istisnaRejimi === "asgari-ucret"; }).forEach(function (yil) {
    var P = B.parametre(yil), son = P.donemler[P.donemler.length - 1];
    var brut = []; for (var ay = 1; ay <= 12; ay++) brut.push(B.donem(P, ay).asgariBrut);
    var nN = B.hesaplaYil(brut, yil).aylar[0].net, nE = B.hesaplaYil(brut, yil, { sgdp: true }).aylar[son.ay - 1].net;
    var e = S.esikNet({ yil: yil, tesvik: "genel" });
    ok(yil + " eşik iki asgari netin arasında", e > nN && e < nE, nN.toFixed(2) + " < " + e + " < " + nE.toFixed(2));
  });
})();

baslik("İddia: brütte pahalı, eşiğin üstünde netle ucuz — her yıl, her indirim");
B.yillar().forEach(function (yil) {
  ["", "genel", "imalat"].forEach(function (te) {
    var g = S.egri({ yil: yil, tesvik: te, nokta: 24 });
    var brutPahali = g.brut.every(function (p) { return p.maliyetFarki > 0; });
    var netUcuz = g.net.filter(function (p) { return p.tutar >= g.esikNet; }).every(function (p) { return p.maliyetFarki <= 0.01; });
    var netFazla = g.brut.every(function (p) { return p.netFarki > 0; });
    ok(yil + " " + (te || "indirimsiz") + ": brüt hep pahalı, eşik üstü net hep ucuz, brütte emeklinin neti hep yüksek",
       brutPahali && netUcuz && netFazla);
  });
});

baslik("Yıl içinde işe giriş");
(function () {
  var r = S.karsilastir({ tutar: 80000, mod: "brut", yil: 2026, girisAyi: 4 });
  ok("Nisan girişi: 9 ay çalışıldı", r.calisilanAy === 9);
  ok("girişten önceki aylarda bordro yok", r.aylar.slice(0, 3).every(function (a) { return !a.calisti && a.emekli.net === 0 && a.emekli.isverenMaliyeti === 0; }));
  var tam = S.karsilastir({ tutar: 80000, mod: "brut", yil: 2026 });
  ok("dokuz ayın maliyet farkı = tam yılın 9/12'si (sabit PEK)", yakin(r.fark.maliyetYil, tam.fark.maliyetYil * 9 / 12, 0.05));
  var n = S.karsilastir({ tutar: 50000, mod: "net", yil: 2026, girisAyi: 7 });
  ok("net anlaşmada giriş sonrası her ay hedefte", n.aylar.slice(6).every(function (a) { return yakin(a.emekli.net, 50000, 0.02); }));
  ok("AGİ yılında yıl içi giriş reddedilir", reddet({ tutar: 5000, mod: "brut", yil: 2021, girisAyi: 3 }));
  ok("giriş ayı 13 reddedilir", reddet({ tutar: 80000, girisAyi: 13 }));
})();

baslik("Emekli aylığıyla ele geçen");
(function () {
  var r = S.karsilastir({ tutar: 80000, mod: "brut", yil: 2026, aylik: 18000 });
  ok("yıllık = 12 × aylık + yıllık net", yakin(r.toplamGelir.yillik, 12 * 18000 + r.emekli.toplam.net));
  ok("aylık ortalama = aylık + net ortalaması", yakin(r.toplamGelir.aylikOrtalama, 18000 + r.emekli.toplam.net / 12));
  ok("her ay ele geçen = aylık + o ayın neti", r.aylar.every(function (a) { return yakin(a.eleGecen, 18000 + a.emekli.net); }));
  var g = S.karsilastir({ tutar: 80000, mod: "brut", yil: 2026, aylik: 18000, girisAyi: 10 });
  ok("geç girişte aylık 12 ay, maaş 3 ay", yakin(g.toplamGelir.yillik, 12 * 18000 + g.emekli.toplam.net) && g.calisilanAy === 3);
  ok("aylık maaşı ve vergiyi değiştirmez", yakin(r.emekli.toplam.gelirVergisi, S.karsilastir({ tutar: 80000, yil: 2026 }).emekli.toplam.gelirVergisi));
})();

baslik("Girdi denetimi");
ok("sıfır tutar", reddet({ tutar: 0 }));
ok("bilinmeyen mod", reddet({ tutar: 50000, mod: "aylik" }));
ok("bilinmeyen indirim", reddet({ tutar: 50000, tesvik: "ihracat" }));
ok("parametresi olmayan yıl", reddet({ tutar: 50000, yil: 2019 }));
ok("negatif aylık", reddet({ tutar: 50000, aylik: -1 }));

baslik("Hüküm ve 1 TL net maliyeti");
(function () {
  var r = S.karsilastir({ tutar: 120000, mod: "brut", yil: 2026, tesvik: "imalat" });
  ok("brütte hüküm pahalı, tutar = fark", r.hukum.yon === "pahali" && yakin(r.hukum.tutar, r.fark.maliyetYil));
  ok("brütte emeklinin 1 TL neti daha ucuz (maliyet artışı netteki artıştan küçük)", r.birNet.emekli < r.birNet.normal);
  var n = S.karsilastir({ tutar: 120000, mod: "net", yil: 2026, tesvik: "imalat" });
  ok("netle hüküm ucuz", n.hukum.yon === "ucuz" && yakin(n.hukum.tutar, -n.fark.maliyetYil));
  ok("oranlar: emekli %7,5 / %24,75, imalat indirimi 5 puan", n.oranlar.emekliIsci === 0.075 &&
     yakin(n.oranlar.emekliIsveren, 0.2475, 1e-12) && n.oranlar.tesvikPuan === 0.05);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
