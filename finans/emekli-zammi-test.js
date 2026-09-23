/* Emekli zammı motoru testleri.  node finans/emekli-zammi-test.js */
"use strict";

var path = require("path");
var Z = require(path.join(__dirname, "emekli-zammi-motoru.js"));
var T = require(path.join(__dirname, "tufe-serisi.js"));

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.log("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}
function yuzde(o) { return (o * 100).toFixed(4); }

/* Test serisi: gerçek serinin kopyası, son ayı istenen yere kesilmiş. */
function kesik(sonAy) {
  var aylar = {};
  Object.keys(T.aylar).forEach(function (k) { if (k <= sonAy) aylar[k] = T.aylar[k]; });
  var a = Object.keys(aylar).sort();
  return { aylar: aylar, ilkAy: a[0], sonAy: a[a.length - 1] };
}

console.log("Emekli zammı motoru\n");

/* --- 1. Açıklanmış resmî artışlar ----------------------------------- */
[[2024, 1, 37.57], [2024, 7, 24.73], [2025, 1, 15.75], [2025, 7, 16.67]].forEach(function (r) {
  var d = Z.donem(r[0], r[1]);
  dogru("resmî artış " + d.ad + " = %" + r[2],
    d.kesin && Math.round(d.birikim * 10000) === Math.round(r[2] * 100),
    "seriden %" + yuzde(d.birikim));
});

/* --- 2. Dönem eşlemesi ---------------------------------------------- */
var oc = Z.donemAylari(2027, 1), tm = Z.donemAylari(2026, 7);
dogru("Ocak 2027 zammı Temmuz–Aralık 2026'ya dayanır",
  oc[0].yil === 2026 && oc[0].ay === 7 && oc[5].yil === 2026 && oc[5].ay === 12);
dogru("Temmuz 2026 zammı Ocak–Haziran 2026'ya dayanır",
  tm[0].yil === 2026 && tm[0].ay === 1 && tm[5].ay === 6);
var hataVerdi = false;
try { Z.donemAylari(2026, 3); } catch (e) { hataVerdi = true; }
dogru("Ocak ve Temmuz dışındaki ay reddediliyor", hataVerdi);

/* --- 3. Bileşik, toplam değil --------------------------------------- */
var alti = [0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
dogru("altı ay %2: bileşik %12,62, toplam %12 değil",
  Math.abs(Z.bilesik(alti) - 0.126162419264) < 1e-12, yuzde(Z.bilesik(alti)));

/* --- 4. Kısmi dönem ------------------------------------------------- */
var s08 = kesik("2026-08");
var k = Z.donem(2027, 1, s08);
dogru("Ağustos 2026 verisiyle Ocak 2027: 2 ay açıklandı, 4 eksik",
  k.aciklananSayisi === 2 && k.eksikSayisi === 4 && !k.kesin);
dogru("Temmuz–Ağustos 2026 birikimi %1,78 ve %1,84'ün bileşiği",
  Math.abs(k.birikim - ((1.0178 * 1.0184) - 1)) < 1e-12, yuzde(k.birikim));
dogru("açıklanmamış ayın oranı null", k.aylar[2].oran === null && k.aylar[5].oran === null);

/* --- 5. Senaryo ----------------------------------------------------- */
dogru("sıfır varsayımlı senaryo birikime eşit",
  Math.abs(Z.senaryo(k, 0) - k.birikim) < 1e-12);
var s1 = Z.senaryo(k, 0.01), s2 = Z.senaryo(k, 0.02), s3 = Z.senaryo(k, 0.03);
dogru("senaryo varsayımla artıyor", s1 < s2 && s2 < s3);
dogru("senaryo: dört ay %1,5 elle hesapla aynı",
  Math.abs(Z.senaryo(k, 0.015) - ((1 + k.birikim) * Math.pow(1.015, 4) - 1)) < 1e-12);
var gy = Z.gecenYilAyniAylar(k, s08);
dogru("geçen yılın aynı ayları: Eylül–Aralık 2025, dört oran",
  gy.length === 4 && Math.abs(gy[0] - T.aylar["2025-09"].aylik / 100) < 1e-12 &&
  Math.abs(gy[3] - T.aylar["2025-12"].aylik / 100) < 1e-12);
var tam = Z.donem(2025, 7);
dogru("kesin dönemde senaryonun etkisi yok",
  tam.eksikSayisi === 0 && Math.abs(Z.senaryo(tam, 0.05) - tam.birikim) < 1e-12);

/* --- 6. Sıradaki zam: sınır ayları ---------------------------------- */
function sira(son) { var s = Z.siradaki(kesik(son)); return s.zamAyi + "/" + s.zamYili; }
dogru("son ay Haziran 2026 → Temmuz 2026 (kesinleşti)",
  sira("2026-06") === "7/2026" && Z.donem(2026, 7, kesik("2026-06")).kesin);
dogru("son ay Temmuz 2026 → Ocak 2027 (1 ay)",
  sira("2026-07") === "1/2027" && Z.donem(2027, 1, kesik("2026-07")).aciklananSayisi === 1);
dogru("son ay Aralık 2025 → Ocak 2026 (kesinleşti)",
  sira("2025-12") === "1/2026" && Z.donem(2026, 1, kesik("2025-12")).kesin);
dogru("son ay Ocak 2026 → Temmuz 2026 (1 ay)", sira("2026-01") === "7/2026");

/* --- 7. Yuvarlama: ilan edilen iki ondalık uygulanır ---------------- */
dogru("20.000 TL, %15,75 → 23.150 TL", Z.yeniAylik(20000, 0.1574849) === 23150);
dogru("ilan oranı iki ondalık: %16,6694 → %16,67", Z.ilanOrani(0.166694) === 0.1667);
hataVerdi = false;
try { Z.yeniAylik(0, 0.1); } catch (e) { hataVerdi = true; }
dogru("sıfır aylık reddediliyor", hataVerdi);

/* --- 8. Seride boşluk ---------------------------------------------- */
var bosluklu = kesik("2026-08");
delete bosluklu.aylar["2026-07"];
hataVerdi = false;
try { Z.donem(2027, 1, bosluklu); } catch (e) { hataVerdi = /boşluk/.test(e.message); }
dogru("dönem içindeki boşluk sessizce atlanmıyor", hataVerdi);

/* --- 9. Geçmiş ----------------------------------------------------- */
var g = Z.gecmis(2016, s08);
dogru("geçmiş yeniden eskiye, ilki Temmuz 2026",
  g[0].zamYili === 2026 && g[0].zamAyi === 7 && g[g.length - 1].ad === "Ocak 2016",
  g.length + " dönem, ilk " + (g[0] && g[0].ad));
dogru("geçmişte yalnızca kesin dönemler", g.every(function (x) { return Z.donem(x.zamYili, x.zamAyi, s08).kesin; }));
dogru("Ocak 2016 → Temmuz 2026: 22 dönem", g.length === 22, g.length);

/* --- 10. Memur zammı ---------------------------------------------- */
[[2025, 1, 11.54, 5.23], [2025, 7, 15.57, 10.07]].forEach(function (r) {
  var m = Z.memurZammi(Z.donem(r[0], r[1]).birikim, r[0], r[1]);
  dogru("resmî memur zammı " + Z.AY_ADLARI[r[1] - 1] + " " + r[0] + " = %" + r[2] + " (fark %" + r[3] + ")",
    Math.round(m.toplam * 10000) === Math.round(r[2] * 100) && Math.round(m.fark * 10000) === Math.round(r[3] * 100),
    JSON.stringify(m));
});
var mY = Z.memurYarilari(2027, 1);
dogru("Ocak 2027 memur zammı: enflasyon 2026 2. yarı, sözleşme 2027 1. yarı",
  mY.onceki.yil === 2026 && mY.onceki.yari === 2 && mY.yeni.yil === 2027 && mY.yeni.yari === 1);
var dusuk = Z.memurZammi(0.03, 2027, 1);
dogru("TÜFE sözleşmenin altındaysa fark sıfır, zam = yeni yarının oranı (%5)",
  dusuk.fark === 0 && dusuk.toplam === 0.05);
dogru("fark negatif olmuyor (deflasyon)", Z.memurZammi(-0.02, 2027, 1).fark === 0);
dogru("TÜFE sözleşmeye tam eşitse fark sıfır", Z.memurZammi(0.07, 2027, 1).fark === 0);
var yuksek = Z.memurZammi(0.12, 2027, 1);
dogru("TÜFE %12, sözleşme %7: fark (1,12/1,07−1) iki ondalık",
  yuksek.fark === Math.round((1.12 / 1.07 - 1) * 10000) / 10000, String(yuksek.fark));
var dk = Z.donem(2027, 1, s08);
dogru("fark eşiği: kalan aylar (1+%7)/(1+birikim)−1 kadar artarsa fark doğar",
  Math.abs(Z.farkEsigi(dk) - (1.07 / (1 + dk.birikim) - 1)) < 1e-12);
dogru("eşiğin hemen üstünde fark > 0, altında 0",
  Z.memurZammi(Z.senaryo(dk, [Z.farkEsigi(dk) + 0.001, 0, 0, 0]), 2027, 1).fark > 0 &&
  Z.memurZammi(Z.senaryo(dk, [Z.farkEsigi(dk) - 0.001, 0, 0, 0]), 2027, 1).fark === 0);
hataVerdi = false;
try { Z.memurZammi(0.1, 2028, 1); } catch (e) { hataVerdi = /belirlenmemiş/.test(e.message); }
dogru("belirlenmemiş toplu sözleşme dönemi sessizce sıfır sayılmıyor (Ocak 2028)", hataVerdi);

/* --- KONTROL ------------------------------------------------------- */
dogru("KONTROL: seri en az 240 ay", Object.keys(T.aylar).length >= 240);
dogru("KONTROL: bileşik ile toplam gerçekten ayrışıyor (resmî dönemde)",
  Math.abs(Z.donem(2024, 1).birikim - Z.donem(2024, 1).aylar.reduce(function (t, a) { return t + a.oran; }, 0)) > 0.02);

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (emekli zammı)");
process.exit(hata ? 1 : 0);
