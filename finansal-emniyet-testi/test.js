#!/usr/bin/env node
/*!
 * Dayanma süresi çekirdeği — doğrulama. Çalıştırma: node finansal-emniyet-testi/test.js
 *
 * Beklenenler çekirdeğin içinden değil, ikinci bir yoldan kurulur:
 *   - yasal kalemler bordro/cikis.js'le birebir (aynı kural iki yerde yazılmaz),
 *   - dayanma süresi kapalı formülle (sabit gider, ödeneksiz: kasa ÷ aylık açık;
 *     enflasyonlu: geometrik seri), ödenek süresi 4447 m.50 tablosuyla,
 *   - GSS primi asgari ücret × oran, ödenek bitince başlar,
 *   - kredi taksiti kredi çekirdeğiyle, "en fazla peşin harcama" tanımıyla
 *     (o tutar harcanınca hedef ayda kasa tam sıfıra iner),
 *   - sayfa örneği ve SSS yapısal verisi üreteçle aynı.
 */
"use strict";
var path = require("path");
var cp = require("child_process");
var KOK = path.join(__dirname, "..");
var D = require("./hesap.js");
var C = require(path.join(KOK, "bordro", "cikis.js"));
var B = require(path.join(KOK, "bordro", "motor.js"));
var K = require(path.join(KOK, "kredi-hesaplama", "hesap.js"));

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek !== undefined ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (t == null ? 0.01 : t); }
function baslik(s) { console.log("\n" + s); }

var TEMEL = {
  cikis: "2026-10-01", iseGiris: "2021-10-01", fesihTuru: "isveren", ciplakBrut: 90000,
  son3YilPrimGunu: 1080, kullanilmayanIzinGunu: 5, nakit: 150000, yatirim: 100000,
  zorunluGider: 45000, istegeBagliGider: 15000, kisintiOrani: 50, borcTaksiti: 5000, digerGelir: 0,
  gss: "odeyecegim", enflasyonYillik: 30
};
function g(ek) { return Object.assign({}, TEMEL, ek || {}); }
var P = B.parametre(2026), don = P.donemler[P.donemler.length - 1];

baslik("Yasal kalemler bordro/cikis.js ile aynı");
var s = D.hesapla(TEMEL);
var c = C.hesapla({ iseGiris: TEMEL.iseGiris, cikis: TEMEL.cikis, fesihTuru: "isveren", ciplakBrut: 90000,
  son3YilPrimGunu: 1080, kullanilmayanIzinGunu: 5 });
ok("kıdem net", yakin(s.kalemler.kidem, c.kidem.net));
ok("ihbar net", yakin(s.kalemler.ihbar, c.ihbar.net));
ok("izin ve son ay", yakin(s.kalemler.izin + s.kalemler.sonAy, c.izin.net + c.sonAy.net));
ok("ödenek aylık net", yakin(s.odenek.aylik, c.issizlik.aylikNet));
ok("çıkış kasası = birikim + kalemler", yakin(s.baslangicNakit, 250000 + c.kidem.net + c.ihbar.net + c.izin.net + c.sonAy.net));

baslik("İşsizlik ödeneği (4447 s.K. m.50-51)");
[[600, 6], [899, 6], [900, 8], [1079, 8], [1080, 10]].forEach(function (x) {
  ok(x[0] + " prim günü → " + x[1] + " ay", D.hesapla(g({ son3YilPrimGunu: x[0] })).odenek.ay === x[1]);
});
ok("599 gün → ödenek yok", D.hesapla(g({ son3YilPrimGunu: 599 })).odenek.ay === 0);
ok("tavan: asgari brüt × %80, damga düşülmüş",
  yakin(s.odenek.aylik, don.asgariBrut * P.issizlik.tavanOrani * (1 - P.oranlar.damga)));
var dusuk = D.hesapla(g({ ciplakBrut: 40000 }));
ok("tavan altı: brüt × %40, damga düşülmüş", yakin(dusuk.odenek.aylik, 40000 * P.issizlik.oran * (1 - P.oranlar.damga)));
ok("ödenek çıkışı izleyen aydan başlar", s.odenek.bas === 1 && s.aylar[0].odenek > 0 && s.aylar[9].odenek > 0 && s.aylar[10].odenek === 0);
var ist = D.hesapla(g({ fesihTuru: "istifa" }));
ok("istifada kıdem, ihbar ve ödenek yok", ist.kalemler.kidem === 0 && ist.kalemler.ihbar === 0 && ist.odenek.ay === 0);

baslik("GSS primi");
ok("ödenek süresince GSS yok, sonra asgari × oran", s.aylar.slice(0, 10).every(function (a) { return a.gider.gss === 0; }) &&
  yakin(s.aylar[10].gider.gss, don.asgariBrut * P.sigortalilik.gssOrani));
ok("ödenek yoksa GSS ilk aydan", yakin(ist.aylar[0].gider.gss, don.asgariBrut * P.sigortalilik.gssOrani));
ok("kapsamdaysa GSS sıfır", D.hesapla(g({ gss: "kapsamda" })).aylar.every(function (a) { return a.gider.gss === 0; }));

baslik("Dayanma süresi, kapalı formül");
// Sabit gider, ödeneksiz, gelirsiz: dayanma = kasa ÷ aylık gider
var sade = g({ fesihTuru: "istifa", enflasyonYillik: 0, gss: "kapsamda", kullanilmayanIzinGunu: 0 });
var ss = D.hesapla(sade);
var aylikGider = 45000 + 15000 * 0.5 + 5000;
ok("sabit giderde dayanma = kasa ÷ aylık gider", yakin(ss.dayanmaAy, ss.baslangicNakit / aylikGider, 1e-9),
  ss.dayanmaAy + " ≠ " + ss.baslangicNakit / aylikGider);
// Enflasyonlu: n ay sonra harcanan = G·Σ(1+i)^k; kasa bitene kadar
var i = D.aylikOran(30), G = 45000 + 7500, kasa = ss.baslangicNakit, n = 0, top = 0;
while (true) { var gm = G * Math.pow(1 + i, n + 1) + 5000; if (top + gm > kasa) break; top += gm; n++; }
var bekEnf = n + (kasa - top) / (G * Math.pow(1 + i, n + 1) + 5000);
ok("fiyat artışında dayanma = geometrik seri", yakin(D.hesapla(g({ fesihTuru: "istifa", gss: "kapsamda", kullanilmayanIzinGunu: 0 })).dayanmaAy, bekEnf, 1e-9));
ok("aylık oran = (1 + yıllık)^(1/12) − 1", yakin(Math.pow(1 + D.aylikOran(30), 12), 1.30, 1e-12));
ok("kasa ay ay korunur", s.aylar.every(function (a) { return yakin(a.nakitSon, a.nakitBas + a.gelir - a.giderToplam, 1e-6); }));
ok("tükenme ayı dayanmadan türer", s.bitis === D.ayEkle(TEMEL.cikis, Math.ceil(s.dayanmaAy)));
var bol = D.hesapla(g({ digerGelir: 100000, enflasyonYillik: 0 }));
ok("gelir gideri aşarsa tükenmez", !isFinite(bol.dayanmaAy) && bol.tukenmez);

baslik("İş arama hedefi");
s.hedefler.forEach(function (h) {
  var enDusuk = Math.min.apply(null, s.aylar.slice(0, h.ay).map(function (a) { return a.nakitSon; }));
  ok(h.ay + " ay: eksik = max(0, −en düşük kasa)", yakin(h.eksik, Math.max(0, -enDusuk)) && h.yeterli === (enDusuk >= 0));
});
var az = D.hesapla(g({ nakit: 0, yatirim: 0, fesihTuru: "istifa" }));
var h12 = az.hedefler.filter(function (h) { return h.ay === 12; })[0];
var dolu = D.hesapla(g({ nakit: h12.eksik, yatirim: 0, fesihTuru: "istifa" }));
ok("eksik tutar eklenince 12. ay kasası tam sıfır", yakin(Math.min.apply(null, dolu.aylar.slice(0, 12).map(function (a) { return a.nakitSon; })), 0, 0.01));

baslik("Ne olursa ne değişir");
var d = D.duyarlilik(TEMEL);
function satir(k) { return d.satirlar.filter(function (x) { return x.kod === k; })[0]; }
ok("isteğe bağlı giderin tamamını kesmek süreyi uzatır", satir("tamKisinti").fark > 0);
ok("enflasyonsuzluk süreyi uzatır", satir("enflasyonsuz").fark > 0);
ok("daha yüksek enflasyon kısaltır", satir("enflasyon10").fark < 0);
ok("yatırım kaybı kısaltır ve kayıp kadar", satir("yatirim30").fark < 0);
// Kıdem ve ihbar kadar nakit eklenmiş hanede "ödenmezse" satırı temel sonucu vermeli.
var ekli = D.duyarlilik(g({ nakit: TEMEL.nakit + s.kalemler.kidem + s.kalemler.ihbar })).satirlar
  .filter(function (x) { return x.kod === "tazminatsiz"; })[0];
ok("tazminatsız senaryo = kıdem ve ihbar kasadan çıkarılmış hâl", yakin(ekli.dayanmaAy, s.dayanmaAy, 1e-9) && satir("tazminatsiz").fark < 0,
  ekli.dayanmaAy + " ≠ " + s.dayanmaAy);
ok("ödeneksiz senaryo kısaltır", satir("odeneksiz").fark < 0);

baslik("Büyük harcama ve kredi");
var kg = g({ karar: { tutar: 1200000, pesinat: 300000, krediTuru: "tasit", vade: 36, aylikFaiz: 2.5, ekGider: 6000, tekSeferlik: 25000 } });
var ke = D.kararEtkisi(kg, 6);
var tur = K.turBilgi("tasit");
var plan = K.plan({ anapara: 900000, vade: 36, aylikFaiz: 2.5, kkdf: tur.kkdf, bsmv: tur.bsmv });
ok("taksit kredi çekirdeğiyle aynı (KKDF ve BSMV dahil)", yakin(ke.karar.taksit, plan.satirlar[0].taksit));
ok("karar dayanmayı kısaltır", ke.sonra < ke.once);
ok("karar olmadan 'önce' temel hesapla aynı", yakin(ke.once, D.hesapla(TEMEL).dayanmaAy, 1e-9));
var pes = D.kararEtkisi(TEMEL, 6).enFazlaPesin;
var harca = D.hesapla(g({ karar: { tutar: pes, pesinat: pes } }));
ok("en fazla peşin harcama yapılınca 6. ay kasası tam sıfır",
  yakin(Math.min.apply(null, harca.aylar.slice(0, 6).map(function (a) { return a.nakitSon; })), 0, 0.01));

baslik("Girdi denetimi");
[["cikis", "2026/10/01"], ["ciplakBrut", 0], ["kisintiOrani", 120], ["gss", "bilinmeyen"], ["enflasyonYillik", -1]].forEach(function (x) {
  var o = {}; o[x[0]] = x[1];
  var at = false; try { D.hesapla(g(o)); } catch (e) { at = true; }
  ok(x[0] + " = " + x[1] + " reddedilir", at);
});
var ters = false; try { D.hesapla(g({ iseGiris: "2027-01-01" })); } catch (e) { ters = true; }
ok("işe giriş çıkıştan sonra olamaz", ters);

baslik("Sayfa");
var r = cp.spawnSync(process.execPath, [path.join(KOK, "tools", "dayanma-ornek.js"), "--check"], { encoding: "utf8" });
ok("örnek hane ve SSS yapısal verisi üreteçle aynı", r.status === 0, (r.stderr || "").trim());
var O = require(path.join(KOK, "tools", "dayanma-ornek.js")).ORNEK;
ok("sayfa örneği test temeliyle aynı girdi", JSON.stringify(O) === JSON.stringify(TEMEL));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
