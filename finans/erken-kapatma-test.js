#!/usr/bin/env node
/*
 * Erken Kapatma vs Yatirim motoru regresyonlari.
 *
 * EN GUCLU KONTROL — FINANSAL OZDESLIK:
 * Tazminat yokken, erken kapatmanin basabas getirisi kredinin EFEKTIF
 * YILLIK ORANINA esit olmalidir. Bu bir tanim: krediyi kapatmak, o kredinin
 * faiz oranini risksiz ve vergisiz kazanmak demektir. Motor bu sayiyi
 * bagimsiz bir yoldan (ay ay nakit akisi + kok bulma) uretiyor; esitlik
 * tutuyorsa modelleme dogru demektir.
 *
 * Ilk surumde bu esitlik 1,3 puan sapiyordu: kredinin kapandigi aydaki
 * KISMI taksidin serbest kalan kismi sayilmiyordu. Test o hatayi yakalar.
 */
"use strict";
var M = require("./erken-kapatma-motoru.js");
var Z = require("./zaman-motoru.js");
var hata = 0;
function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 1e-6 : tol;
  if (!isFinite(b) || Math.abs(b - bek) > t) {
    hata++; console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else console.log("  tamam      " + ad);
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

var TABAN = {
  kalanAnapara: 500000, aylikFaiz: 0.025, kalanVadeAy: 60,
  tutar: 200000, yatirimNetYillik: 0.35, enflasyon: 0.30, krediTuru: "ihtiyac"
};
function ile(ek) {
  var o = {}; Object.keys(TABAN).forEach(function (k) { o[k] = TABAN[k]; });
  Object.keys(ek).forEach(function (k) { o[k] = ek[k]; });
  return M.analiz(o);
}

console.log("FINANSAL OZDESLIK — basabas = kredinin efektif yillik orani");
[[0.025, 60], [0.018, 120], [0.035, 36], [0.012, 240]].forEach(function (t) {
  var r = ile({ aylikFaiz: t[0], kalanVadeAy: t[1] });
  esit("aylik %" + (t[0] * 100) + ", " + t[1] + " ay",
    r.basabasGetiri, Z.efektifYillik(t[0]), 1e-5);
});

console.log("\nTKHK tazminat kurallari");
esit("ihtiyac kredisinde tazminat YOK", ile({ krediTuru: "ihtiyac" }).tazminat, 0);
dogru("ihtiyac tazminatYok bayragi", ile({ krediTuru: "ihtiyac" }).tazminatYok === true);
esit("konut degisken faizde tazminat YOK", ile({ krediTuru: "konut-degisken" }).tazminat, 0);
/* 200.000 erken odeme, kalan vade 60 ay (>36) -> %2 = 4.000 */
esit("konut sabit, >36 ay -> %2", ile({ krediTuru: "konut-sabit" }).tazminat, 4000, 0.02);
esit("konut sabit, >36 ay orani", ile({ krediTuru: "konut-sabit" }).tazminatOrani, 0.02, 1e-12);
/* kalan vade 36 -> %1 (36 "fazla" degil) */
esit("konut sabit, tam 36 ay -> %1",
  ile({ krediTuru: "konut-sabit", kalanVadeAy: 36 }).tazminatOrani, 0.01, 1e-12);
esit("konut sabit, 37 ay -> %2",
  ile({ krediTuru: "konut-sabit", kalanVadeAy: 37 }).tazminatOrani, 0.02, 1e-12);
dogru("bilinmeyen tur ihtiyac sayiliyor", ile({ krediTuru: "yok-boyle" }).tazminat === 0);

console.log("\nTazminat faiz indirimini ASAMAZ (TKHK ust siniri)");
/* Cok kisa kalan vade + cok dusuk faiz: faiz indirimi kucuk kalir,
   ham tazminat onu asar ve tavan devreye girmeli. */
var tavan = ile({ krediTuru: "konut-sabit", aylikFaiz: 0.0005, kalanVadeAy: 6, tutar: 400000 });
dogru("tavan uygulandi bayragi", tavan.tazminatTavaniUygulandi === true);
dogru("tazminat faiz indirimine esitlendi",
  Math.abs(tavan.tazminat - tavan.faizIndirimi) < 0.02);
dogru("net kazanc sifirin altina dusmuyor", tavan.netKazanc >= -0.02);

console.log("\nTazminat karari YATIRIM lehine kaydirir");
var ih = ile({ krediTuru: "ihtiyac" });
var ko = ile({ krediTuru: "konut-sabit" });
dogru("konut-sabit basabasi daha dusuk", ko.basabasGetiri < ih.basabasGetiri);
dogru("konut-sabit serveti daha dusuk", ko.kapatmaServeti < ih.kapatmaServeti);

console.log("\nKarar yonu");
var dusuk = ile({ yatirimNetYillik: 0.10 });
var yuksek = ile({ yatirimNetYillik: 0.90 });
dogru("dusuk getiride kapatma kazanir", dusuk.kazanan === "kapatma");
dogru("yuksek getiride yatirim kazanir", yuksek.kazanan === "yatirim");
dogru("basabasin tam ustunde yatirim kazanir",
  ile({ yatirimNetYillik: ih.basabasGetiri + 0.02 }).kazanan === "yatirim");
dogru("basabasin tam altinda kapatma kazanir",
  ile({ yatirimNetYillik: ih.basabasGetiri - 0.02 }).kazanan === "kapatma");

console.log("\nVade kisalmasi ve faiz indirimi");
dogru("vade kisaliyor", ih.kisalanAy > 0);
dogru("faiz indirimi pozitif", ih.faizIndirimi > 0);
dogru("kalan faiz tabandan az", ih.kalanFaiz < ih.tabanFaiz);
esit("faiz indirimi = taban - kalan", ih.faizIndirimi, ih.tabanFaiz - ih.kalanFaiz, 0.02);

console.log("\nAnaparadan fazlasi odenemez");
var fazla = ile({ tutar: 900000 });
esit("odenen anaparada durur", fazla.odenen, 500000, 0.02);
esit("artan para yatirima gider", fazla.artan, 400000, 0.02);
esit("vade tamamen kapanir", fazla.yeniBitisAy, 0, 0);

console.log("\nMonotonluk");
/* Azalan dizi bekleniyor: baslangic +Infinity olmali. -Infinity ile
   ilk karsilastirma her zaman dogru cikiyor ve dongu hemen kiriliyordu. */
var onceki = Infinity, bozuk = false;
for (var r = 0.05; r <= 1.5; r += 0.05) {
  var f = ile({ yatirimNetYillik: r }).fark;
  if (f > onceki + 1e-6) { bozuk = true; break; }
  onceki = f;
}
dogru("getiri arttikca kapatma avantaji azaliyor", !bozuk);

console.log("\nReel cerceve");
dogru("kapatma reel getirisi hesaplaniyor", isFinite(ih.kapatmaReel));
dogru("reel, nominalden kucuk (enflasyon pozitif)", ih.kapatmaReel < ih.kapatmaGetirisi);

console.log("\nDuyarlilik izgarasi");
var iz = M.duyarlilik(TABAN, { x: [0.10, 0.30, 0.50, 0.70], y: [100000, 300000, 500000] });
esit("3 satir", iz.hucreler.length, 3, 0);
esit("4 sutun", iz.hucreler[0].length, 4, 0);
dogru("sinir var", iz.sinirVar === true);
dogru("en buyuk mutlak pozitif", iz.enBuyukMutlak > 0);

console.log("\nGecersiz girdi");
dogru("anapara sifirsa hata", !!M.analiz({ kalanAnapara: 0, tutar: 100 }).hata);
dogru("tutar sifirsa hata", !!M.analiz({ kalanAnapara: 100000, tutar: 0 }).hata);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\nButun erken kapatma kontrolleri gecti.");
