#!/usr/bin/env node
/*!
 * ÖTV satır çözümü testleri.
 *
 * ÖTV'de hata oranı yanlış yazmakla değil, ARACIN YANLIŞ SATIRA
 * düşmesiyle olur; ve sonuç yine makul bir sayı gibi görünür. Bu yüzden
 * testlerin çoğu tutar değil, SATIR seçimi üzerine.
 *
 * Kanunun koşullarını sınırlarında zorlar: "50 kW'ı geçen" ifadesi tam
 * 50 kW'ı dışarıda bırakır, "25 gramın altında" tam 25'i dışarıda
 * bırakır, "70 km ve üzerinde" tam 70'i içeri alır. Bu üç ifade
 * kanunda farklı yazılmış ve kodda da farklı olmak zorunda.
 *
 * Kaynak: 4760 sayılı ÖTV Kanunu (II) sayılı liste 87.03 (mevzuat.gov.tr)
 *         oranlar 10115 sayılı Cumhurbaşkanı Kararı ile.
 *
 *   node otv-hesaplama/tarife-test.js
 */
"use strict";
var path = require("path");
var T = require(path.join(__dirname, "tarife.js"));

var hata = 0, gecen = 0;
function esit(ad, b, bek) {
  if (b !== bek) { hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b); }
  else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (!k) { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
  else { gecen++; console.log("  tamam      " + ad); }
}
function oran(g) { var r = T.hesapla(g); return r.hata ? ("hata:" + r.hata) : r.oran; }

/* ---------------------------------------------------------------- *
 * Yürürlükteki oranlar — sessiz bir düzenleme fark edilmeden geçmesin
 * ---------------------------------------------------------------- */
console.log("Kanundaki oranlar ve eşikler");
esit("1400 cm³ altı oranları", T.ICTEN_1400.oran.join(","), "70,75,80,90");
esit("1400 cm³ altı eşikleri", T.ICTEN_1400.esik.join(","), "650000,900000,1100000");
esit("1400–1600 oranları", T.ICTEN_1600.oran.join(","), "75,80,90,100");
esit("1400–1600 eşikleri", T.ICTEN_1600.esik.join(","), "850000,1100000,1650000");
esit("1600–2000 oranları", T.ICTEN_2000.oran.join(","), "150,170");
esit("2000 üstü oranı", T.ICTEN_UST.oran.join(","), "220");
esit("orta hibrit oranları", T.HIBRIT_ORTA.oran.join(","), "70,80");
esit("orta hibrit eşiği", T.HIBRIT_ORTA.esik.join(","), "1250000");
esit("büyük hibrit oranları", T.HIBRIT_BUYUK.oran.join(","), "150,170");
esit("şarjlı hibrit (≤1600) oranları", T.PHEV_1600.oran.join(","), "45,75");
esit("şarjlı hibrit (1600–1800) oranı", T.PHEV_1800_ORAN, 85);
esit("elektrikli ≤160 kW oranları", T.BEV_ALT.oran.join(","), "25,55");
esit("elektrikli >160 kW oranları", T.BEV_UST.oran.join(","), "65,75");
esit("KDV %20", T.KDV, 0.20);

/* ---------------------------------------------------------------- *
 * Eşik AŞILDIĞINDA tüm matraha üst oran — kademeli değil
 * ---------------------------------------------------------------- */
console.log("\nÖTV kademeli değil: eşik aşılınca tüm matraha üst oran");
esit("650.000 TL → %70 (eşiğin kendisi alt oranda)",
  oran({ tur: "icten", hacim: 1300, matrah: 650000 }), 70);
esit("650.001 TL → %75", oran({ tur: "icten", hacim: 1300, matrah: 650001 }), 75);
var altta = T.hesapla({ tur: "icten", hacim: 1300, matrah: 650000 });
var ustte = T.hesapla({ tur: "icten", hacim: 1300, matrah: 650001 });
dogru("1 TL fazla matrah, anahtar teslimde büyük sıçrama",
  ustte.toplam - altta.toplam > 30000,
  "sıçrama " + Math.round(ustte.toplam - altta.toplam) + " TL");
/* Üst oran TÜM matraha uygulanıyor mu — sadece aşan kısma değil. */
esit("üst oran tüm matraha uygulanır", ustte.otv, 650001 * 0.75);

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN BOŞLUK 1: hibrit satırı koşullu
 * ---------------------------------------------------------------- */
console.log("\nHibrit satırı koşullu: elektrik motoru 50 kW'ı GEÇECEK");
esit("1800 cm³, elektrik 60 kW → hibrit satırı (%70)",
  oran({ tur: "hibrit", hacim: 1800, elektrikKw: 60, matrah: 1000000 }), 70);
/* Kanun "50 kW'ı geçip" der: tam 50 kW satıra GİRMEZ. */
esit("1800 cm³, elektrik tam 50 kW → hibrit DEĞİL (%150)",
  oran({ tur: "hibrit", hacim: 1800, elektrikKw: 50, matrah: 1000000 }), 150);
esit("1800 cm³, elektrik 50,1 kW → hibrit (%70)",
  oran({ tur: "hibrit", hacim: 1800, elektrikKw: 50.1, matrah: 1000000 }), 70);
/* Hacim koşulu: 1800 cm³'ü geçmeyecek. */
esit("1900 cm³, elektrik 60 kW → hibrit satırı yok (%150)",
  oran({ tur: "hibrit", hacim: 1900, elektrikKw: 60, matrah: 1000000 }), 150);
/* Hatanın kendisi: mild hybrid'e %70 gösteriliyordu. */
var mild = T.hesapla({ tur: "hibrit", hacim: 1800, elektrikKw: 20, matrah: 1000000 });
esit("mild hybrid (20 kW) → %150", mild.oran, 150);
dogru("mild hybrid'e neden olduğu söyleniyor",
  mild.notlar.length > 0 && mild.notlar[0].indexOf("50 kW") >= 0,
  JSON.stringify(mild.notlar));
/* 1600 cm³'e kadar hibrit icin AYRI SATIR YOK. */
esit("1500 cm³ hibrit → içten yanmalı tarifesi (%75)",
  oran({ tur: "hibrit", hacim: 1500, elektrikKw: 60, matrah: 800000 }), 75);
var kucukHibrit = T.hesapla({ tur: "hibrit", hacim: 1500, elektrikKw: 60, matrah: 800000 });
dogru("küçük hibritte ayrı satır olmadığı söyleniyor",
  kucukHibrit.notlar.length > 0, JSON.stringify(kucukHibrit.notlar));

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN BOŞLUK 2: büyük hibrit satırı (2000 cm³ üstü)
 * ---------------------------------------------------------------- */
console.log("\n2000 cm³ üstünde ikinci bir hibrit satırı var");
esit("2400 cm³, elektrik 120 kW → %150",
  oran({ tur: "hibrit", hacim: 2400, elektrikKw: 120, matrah: 1000000 }), 150);
esit("2400 cm³, elektrik 120 kW, pahalı → %170",
  oran({ tur: "hibrit", hacim: 2400, elektrikKw: 120, matrah: 2000000 }), 170);
esit("2400 cm³, elektrik tam 100 kW → satır dışı (%220)",
  oran({ tur: "hibrit", hacim: 2400, elektrikKw: 100, matrah: 1000000 }), 220);
esit("2600 cm³, elektrik 120 kW → hacim aşıldı (%220)",
  oran({ tur: "hibrit", hacim: 2600, elektrikKw: 120, matrah: 1000000 }), 220);
esit("2400 cm³ düz içten yanmalı → %220",
  oran({ tur: "icten", hacim: 2400, matrah: 1000000 }), 220);

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN BOŞLUK 3: şarj edilebilir hibrit
 * ---------------------------------------------------------------- */
console.log("\nŞarj edilebilir hibritin kendi koşulları var");
var phevOk = { tur: "phev", hacim: 1500, elektrikKw: 80, co2: 20, menzil: 80 };
function ph(ek) {
  var g = {}; for (var k in phevOk) g[k] = phevOk[k];
  for (var j in ek) g[j] = ek[j];
  return g;
}
esit("1500 cm³, matrah 1.000.000 → %45", oran(ph({ matrah: 1000000 })), 45);
esit("1500 cm³, matrah 1.350.000 → %45 (eşik dahil)", oran(ph({ matrah: 1350000 })), 45);
esit("1500 cm³, matrah 1.350.001 → %75", oran(ph({ matrah: 1350001 })), 75);
/* 1600–1800 satiri: eskiden hic yoktu. */
esit("1700 cm³, matrah 1.000.000 → %85",
  oran(ph({ hacim: 1700, matrah: 1000000 })), 85);
/* Bu satirin "digerleri" karsiligi YOK: esik asilinca satirdan DUSER. */
var dusen = T.hesapla(ph({ hacim: 1700, matrah: 2000000 }));
esit("1700 cm³, matrah 2.000.000 → satırdan düşer, hibrit satırına döner (%80)",
  dusen.oran, 80);
dogru("düşme sebebi söyleniyor",
  dusen.notlar.length > 0 && dusen.notlar[0].indexOf("1.350.000") >= 0,
  JSON.stringify(dusen.notlar));
/* Elektrik motoru zayifsa dusus daha da sert. */
esit("1700 cm³, 2.000.000 TL, elektrik 30 kW → %170",
  oran(ph({ hacim: 1700, matrah: 2000000, elektrikKw: 30 })), 170);

console.log("\nŞarj edilebilir hibrit koşulları sınırında");
/* Kanun: CO2 "25 gramin ALTINDA" — tam 25 disarida. */
esit("CO₂ 24 g/km → satır uygulanır (%45)", oran(ph({ co2: 24, matrah: 800000 })), 45);
esit("CO₂ tam 25 g/km → satır uygulanmaz (%75)", oran(ph({ co2: 25, matrah: 800000 })), 75);
/* Kanun: menzil "70 kilometre VE UZERINDE" — tam 70 iceride. */
esit("menzil tam 70 km → satır uygulanır (%45)", oran(ph({ menzil: 70, matrah: 800000 })), 45);
esit("menzil 69 km → satır uygulanmaz (%75)", oran(ph({ menzil: 69, matrah: 800000 })), 75);
var kosulsuz = T.hesapla(ph({ co2: 40, matrah: 800000 }));
dogru("koşul sağlanmayınca sebebi söyleniyor",
  kosulsuz.notlar.length > 0 && kosulsuz.notlar[0].indexOf("25 g/km") >= 0,
  JSON.stringify(kosulsuz.notlar));
/* Kosul saglanmayinca DUZ ICTEN YANMALI degil, hacim agacina doner:
   1500 cm3 -> 1400-1600 satiri; 800.000 TL ilk dilimde, %75. */
esit("koşulsuz PHEV, 1500 cm³, 800.000 TL → %75",
  oran(ph({ co2: 40, matrah: 800000 })), 75);

/* ---------------------------------------------------------------- *
 * Elektrikli
 * ---------------------------------------------------------------- */
console.log("\nYalnızca elektrik motorlu");
esit("160 kW, 1.000.000 TL → %25", oran({ tur: "elektrik", kw: 160, matrah: 1000000 }), 25);
esit("160,1 kW → %65", oran({ tur: "elektrik", kw: 160.1, matrah: 1000000 }), 65);
esit("160 kW, 1.650.000 TL → %25 (eşik dahil)",
  oran({ tur: "elektrik", kw: 160, matrah: 1650000 }), 25);
esit("160 kW, 1.650.001 TL → %55", oran({ tur: "elektrik", kw: 160, matrah: 1650001 }), 55);
esit("200 kW, 2.000.000 TL → %75", oran({ tur: "elektrik", kw: 200, matrah: 2000000 }), 75);
esit("güç verilmezse hata", T.hesapla({ tur: "elektrik", matrah: 1000000 }).hata, "kw");
/* Elektriklide hacim SORULMAZ; verilse de sonucu degistirmemeli. */
esit("elektriklide hacim sonucu değiştirmez",
  oran({ tur: "elektrik", kw: 100, hacim: 3000, matrah: 1000000 }), 25);

/* ---------------------------------------------------------------- *
 * KDV ve toplam
 * ---------------------------------------------------------------- */
console.log("\nKDV, ÖTV dahil tutar üzerinden");
var h = T.hesapla({ tur: "icten", hacim: 1500, matrah: 1000000 });
esit("ÖTV", h.otv, 1000000 * 0.80);
esit("KDV matrahı ÖTV dahil", h.kdv, (1000000 + 800000) * 0.20);
esit("anahtar teslim", h.toplam, 1000000 + 800000 + 360000);
esit("toplam vergi", h.vergi, 800000 + 360000);
dogru("vergi payı yarıdan fazla", h.vergiPayi > 0.5, String(h.vergiPayi));
esit("matrahsız hesap hata verir", T.hesapla({ tur: "icten", hacim: 1500 }).hata, "matrah");
esit("hacimsiz içten yanmalı hata verir",
  T.hesapla({ tur: "icten", matrah: 1000000 }).hata, "hacim");

console.log("\nEşik farkı");
var ef = T.esikFarki(T.ICTEN_1400, 660000);
dogru("eşiğin hemen üstünde fark hesaplanıyor", !!ef);
if (ef) {
  esit("alt eşik", ef.esik, 650000);
  dogru("eşikteki araç daha ucuz", ef.esikteToplam < ef.simdikiToplam);
  esit("fark tutarlı", Math.round(ef.fark),
    Math.round(660000 * 1.75 * 1.2 - 650000 * 1.70 * 1.2));
}
esit("ilk dilimde eşik farkı yok", T.esikFarki(T.ICTEN_1400, 100000), null);
esit("eşiksiz satırda fark yok", T.esikFarki(T.ICTEN_UST, 5000000), null);

console.log("\nDayanak");
dogru("karar numarası taşınıyor", T.KARAR.indexOf("10115") >= 0, T.KARAR);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (ÖTV tarife kontrolleri)");
