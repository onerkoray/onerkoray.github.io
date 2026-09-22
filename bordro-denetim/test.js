#!/usr/bin/env node
/*!
 * Bordro denetimi testleri.
 *
 * NE SINANIYOR
 * ------------
 *   1. Doğru bordro girildiğinde HİÇBİR satır farklı çıkmamalı.
 *      Bu, modülün motorla aynı sonucu ürettiğinin kanıtı; sapma
 *      olsaydı araç doğru bordroyu "hatalı" gösterirdi ki bu, hiç
 *      araç olmamasından kötüdür.
 *   2. Tersine çözüm gerçekten tersini buluyor mu (gidiş-dönüş).
 *   3. Çözülemeyecek hedeflerde null dönüyor mu -- yanlış bir sayı
 *      göstermektense hiç göstermemek doğru.
 *   4. Asgari birikim ÇARPMA ile değil ay ay hesaplanıyor mu (çok
 *      dönemli yılda çarpma sessizce yanlış olurdu).
 *   5. Yorumlar ölçüme dayanıyor mu: tavan üstü, eksik gün, damga
 *      istisnası, ikinci işveren.
 *
 * Kullanım: node bordro-denetim/test.js
 */
"use strict";

var path = require("path");
var D = require(path.join(__dirname, "denetim.js"));
var B = require(path.join(__dirname, "..", "bordro", "motor.js"));

var gecen = 0, hata = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { hata++; console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : "")); }
}
function esit(ad, a, b, tol) {
  var t = tol === undefined ? 0.005 : tol;
  dogru(ad, Math.abs(a - b) <= t, a + " != " + b);
}

var YIL = B.sonYil();
console.log("Bordro denetimi — " + YIL + "\n");

/* --- 1. Doğru bordro: hiçbir satır farklı olmamalı ----------------- */
[35000, 75000, 150000, 350000, 500000].forEach(function (brut) {
  [1, 6, 8, 12].forEach(function (ay) {
    var yil = B.hesaplaYil(brut, YIL);
    var a = yil.aylar[ay - 1];
    /* Motorun kendi kümülatifi: bu aydan ÖNCEKİ birikim. */
    var once = a.kumulatifMatrah - a.matrah;
    var r = D.denetle({
      yil: YIL, ay: ay, brut: brut, kumulatifMatrah: once,
      bordro: { sgk: a.sgk, issizlik: a.issizlik,
                gelirVergisi: a.gelirVergisi, damga: a.damga, net: a.net }
    });
    dogru("motorun kendi bordrosu temiz: " + brut + " TL, " + ay + ". ay",
      r.ozet.farkliSatir === 0,
      JSON.stringify(r.satirlar.filter(function (s) { return s.tamam === false; })
        .map(function (s) { return s.ad + " " + s.fark; })));
  });
});

/* --- 2. Tersine çözüm: gidiş-dönüş --------------------------------- */
[[75000, 8], [150000, 5], [350000, 11]].forEach(function (p) {
  var brut = p[0], ay = p[1];
  var K = 400000;
  var v = D.ayHesapla(YIL, ay, brut, K).gelirVergisi;
  var geri = D.kumulatifCoz(YIL, ay, brut, v);
  dogru("tersine çözüm bulundu: " + brut + " TL, " + ay + ". ay", geri !== null);
  if (geri !== null) {
    /* Aranan şey matrahın kendisi değil, AYNI VERGİYİ üretmesi. */
    esit("tersine çözüm aynı vergiyi üretiyor: " + brut,
      D.ayHesapla(YIL, ay, brut, geri).gelirVergisi, v, 0.5);
  }
});

/* --- 3. Çözülemeyen hedefte null ----------------------------------- */
dogru("negatif vergi çözülemez", D.kumulatifCoz(YIL, 6, 75000, -1) === null);
dogru("ulaşılamayacak kadar büyük vergi çözülemez",
  D.kumulatifCoz(YIL, 6, 75000, 9e9) === null);
dogru("sayı olmayan hedef çözülemez", D.kumulatifCoz(YIL, 6, 75000, null) === null);

/* --- 4. Asgari birikim ay ay toplanıyor mu ------------------------- */
var P = B.parametre(YIL);
var o = P.oranlar;
var elle = 0;
for (var i = 1; i < 7; i++) {
  elle += B.donem(P, i).asgariBrut * (1 - o.sgkIsci - o.issizlikIsci);
}
esit("asgari birikim ay ay toplanıyor (6. aya kadar)",
  D.asgariBirikim(P, 7), elle);
/* Çok dönemli bir yıl varsa çarpma ile ayrışmalı; yoksa bu kontrol
   sessizce anlamsızlaşır, o yüzden dönem sayısı da yazılıyor. */
var cokDonemli = Object.keys(B.parametreler).filter(function (y) {
  var p = B.parametreler[y];
  return p && p.donemler && p.donemler.length > 1;
});
dogru("KONTROL: çok dönemli yıl var (çarpma tuzağı gerçek)",
  cokDonemli.length > 0, "çok dönemli yıl: " + cokDonemli.join(", "));
if (cokDonemli.length) {
  var cy = parseInt(cokDonemli[0], 10);
  var cp = B.parametre(cy);
  var carpma = 11 * cp.donemler[0].asgariBrut *
    (1 - cp.oranlar.sgkIsci - cp.oranlar.issizlikIsci);
  dogru("çok dönemli yılda çarpma YANLIŞ sonuç verirdi (" + cy + ")",
    Math.abs(D.asgariBirikim(cp, 12) - carpma) > 1,
    "ay ay: " + D.asgariBirikim(cp, 12).toFixed(2) + "  çarpma: " + carpma.toFixed(2));
}

/* --- 5. Yorumlar ölçüme dayanıyor mu ------------------------------- */
var d = B.donem(P, 6);

/* Tavan üstü */
var tavanUstu = D.denetle({
  yil: YIL, ay: 6, brut: d.sgkTavan + 100000,
  bordro: { sgk: 1 }                       // kasıtlı yanlış: yorum tetiklensin
});
var sgkSatiri = tavanUstu.satirlar.filter(function (s) { return s.anahtar === "sgk"; })[0];
dogru("tavan üstü brütte SGK yorumu tavanı açıklıyor",
  sgkSatiri.sebepler.some(function (x) { return /tavan/i.test(x.metin); }),
  JSON.stringify(sgkSatiri.sebepler));

/* Damga istisnası uygulanmamış */
var damgasiz = d.sgkTavan / 3;
var beklenenHesap = D.ayHesapla(YIL, 6, damgasiz, 0);
var damgaSonuc = D.denetle({
  yil: YIL, ay: 6, brut: damgasiz, kumulatifMatrah: 0,
  bordro: { damga: damgasiz * P.oranlar.damga }
});
var damgaSatiri = damgaSonuc.satirlar.filter(function (s) { return s.anahtar === "damga"; })[0];
dogru("istisnasız damga yazıldığında yorum bunu söylüyor",
  damgaSatiri.tamam === false &&
  damgaSatiri.sebepler.some(function (x) { return /istisna/i.test(x.metin); }),
  JSON.stringify(damgaSatiri));

/* İkinci işveren: istisna tam tutarı kadar fark */
var ikinci = D.ayHesapla(YIL, 6, 75000, 0, { istisnasiz: true });
var ikinciSonuc = D.denetle({
  yil: YIL, ay: 6, brut: 75000, kumulatifMatrah: 0,
  bordro: { gelirVergisi: ikinci.gelirVergisi }
});
var gvSatiri = ikinciSonuc.satirlar.filter(function (s) { return s.anahtar === "gelirVergisi"; })[0];
dogru("istisna kadar fark, ikinci işveren olasılığını söylüyor",
  gvSatiri.sebepler.some(function (x) { return /ikinci işveren/i.test(x.metin); }),
  JSON.stringify(gvSatiri.sebepler));

/* --- 6. Varsayımlar ilan ediliyor mu ------------------------------- */
var varsayim = D.denetle({ yil: YIL, ay: 8, brut: 75000, bordro: {} });
dogru("kümülatif verilmediğinde varsayım ilan ediliyor",
  varsayim.varsayimlar.some(function (v) { return /aynı brütle/i.test(v); }),
  JSON.stringify(varsayim.varsayimlar));
dogru("kümülatif verilmediği işaretleniyor",
  varsayim.kumulatifMatrahVerildi === false);
var verildi = D.denetle({ yil: YIL, ay: 8, brut: 75000, kumulatifMatrah: 123456, bordro: {} });
dogru("kümülatif verildiğinde işaretleniyor", verildi.kumulatifMatrahVerildi === true);
esit("verilen kümülatif aynen kullanılıyor", verildi.kumulatifMatrah, 123456);

/* --- 7. Girdi doğrulama -------------------------------------------- */
function patlar(f) { try { f(); return false; } catch (e) { return true; } }
dogru("brütsüz çağrı hata veriyor", patlar(function () { D.denetle({ yil: YIL, ay: 1 }); }));
dogru("geçersiz ay hata veriyor",
  patlar(function () { D.denetle({ yil: YIL, ay: 13, brut: 75000 }); }));
dogru("girilmeyen satır fark üretmiyor",
  D.denetle({ yil: YIL, ay: 3, brut: 75000, bordro: { sgk: null } })
    .ozet.girilenSatir === 0);

/* --- 8. Mutasyonun actigi dort acik --------------------------------
   Asagidaki dort iddia, mutasyon testi kactiktan SONRA eklendi.
   Hepsi gercek bir mutasyonu yakalamak icin var. */

/* (a) Kumulatif TURETME yolu: kullanici kumulatif vermediginde deger
       ay-1 aylik matrah olmali. Testlerin geri kalani kumulatifi hep
       ACIKCA veriyordu, o yuzden bu yol hic sinanmiyordu ve ay kaymasi
       kacmisti. */
var turetilen = D.denetle({ yil: YIL, ay: 8, brut: 75000, bordro: {} });
esit("turetilen kumulatif = (ay-1) x aylik matrah",
  turetilen.kumulatifMatrah, 7 * D.ayMatrahi(YIL, 8, 75000));
var ocakTuretilen = D.denetle({ yil: YIL, ay: 1, brut: 75000, bordro: {} });
esit("ocakta turetilen kumulatif sifir", ocakTuretilen.kumulatifMatrah, 0);

/* (b) Tersine cozumun DOGRULAMA satiri, vergi kumulatife gore monoton
       oldugu surece ateslenemez -- yani bugun KOR bir korumadir.
       Kaldirmak yerine dayandigi ozellik test ediliyor: monotonluk
       bozulursa bu iddia kirmizi doner ve koruma anlam kazanir. */
(function () {
  var once = null, monoton = true;
  for (var k = 0; k <= 3000000; k += 25000) {
    var v = D.ayHesapla(YIL, 6, 75000, k).gelirVergisi;
    if (once !== null && v < once - 0.005) monoton = false;
    once = v;
  }
  dogru("vergi kumulatif matraha gore monoton (tersine cozumun sarti)", monoton);
})();

/* (c) Karsilastirilan satirlarin TAM kumesi. "net" satirini baska bir
       alanla degistiren mutasyon, kume sabitlenmedigi icin kacmisti. */
dogru("karsilastirilan satirlar tam olarak bes kalem",
  D.SATIRLAR.map(function (x) { return x.anahtar; }).join(",") ===
    "sgk,issizlik,gelirVergisi,damga,net",
  D.SATIRLAR.map(function (x) { return x.anahtar; }).join(","));

/* (d) Damga yorumu KOSULA bagli mi? Once "her zaman tetikleniyor"
       mutasyonu kacmisti, cunku yalnizca tetiklendigi durum
       sinaniyordu. Simdi tetiklenmemesi gereken durum da sinaniyor:
       damga baska bir sebeple farkliysa istisna yorumu CIKMAMALI. */
var damgaAlakasiz = D.denetle({
  yil: YIL, ay: 6, brut: 75000, kumulatifMatrah: 0,
  bordro: { damga: 12345.67 }              // istisnasiz tutara da esit degil
});
var dSatir = damgaAlakasiz.satirlar.filter(function (x) { return x.anahtar === "damga"; })[0];
dogru("alakasiz damga farkinda istisna yorumu CIKMIYOR",
  dSatir.tamam === false &&
  !dSatir.sebepler.some(function (x) { return /istisna/i.test(x.metin); }),
  JSON.stringify(dSatir.sebepler));

/* --- 9. Net farkı kesintilerin aynası mı ----------------------------
   Net, diğer dört satırın türevi. Fark onların aynasıysa söylenmeli;
   değilse SÖYLENMEMELİ -- ilişki ölçülüyor, varsayılmıyor. */
(function () {
  var h = D.ayHesapla(YIL, 8, 75000, 7 * D.ayMatrahi(YIL, 8, 75000));
  /* Yalnızca gelir vergisi saptırılıyor; net de tam o kadar sapar. */
  var sapma = 500;
  var r = D.denetle({
    yil: YIL, ay: 8, brut: 75000,
    bordro: { sgk: h.sgk, issizlik: h.issizlik,
              gelirVergisi: h.gelirVergisi - sapma, damga: h.damga,
              net: h.net + sapma }
  });
  var n = r.satirlar.filter(function (s) { return s.anahtar === "net"; })[0];
  dogru("net farkı kesintilerin aynasıysa söyleniyor",
    n.tamam === false &&
    n.sebepler.some(function (x) { return /aynas\u0131/.test(x.metin) || /aynası/.test(x.metin); }),
    JSON.stringify(n.sebepler));

  /* Kesinti satırı hiç girilmediyse ilişki ÖLÇÜLEMEZ: yorum çıkmamalı. */
  var r2 = D.denetle({ yil: YIL, ay: 8, brut: 75000, bordro: { net: 1 } });
  var n2 = r2.satirlar.filter(function (s) { return s.anahtar === "net"; })[0];
  dogru("kesinti girilmediyse ayna yorumu ÇIKMIYOR",
    n2.sebepler.length === 0, JSON.stringify(n2.sebepler));

  /* DAR BANT: kesinti hiç girilmemişken net farkı tolerans ile 0,02
     arasındaysa "kesintilerin aynası" demek saçma olurdu — karşılaştırılan
     kesinti yok. girilen > 0 şartı bu bandı koruyor; şartı kaldıran
     mutasyon başta buradan kaçmıştı. */
  var dar = D.denetle({ yil: YIL, ay: 8, brut: 75000,
    bordro: { net: h.net + 0.015 } });
  var nd = dar.satirlar.filter(function (s) { return s.anahtar === "net"; })[0];
  dogru("dar bantta kesinti girilmemişse ayna yorumu ÇIKMIYOR",
    nd.tamam === false && nd.sebepler.length === 0,
    "fark=" + nd.fark + " sebep=" + JSON.stringify(nd.sebepler));

  /* Kesintiler doğru ama net yanlışsa ayna ilişkisi YOK: çıkmamalı. */
  var r3 = D.denetle({
    yil: YIL, ay: 8, brut: 75000,
    bordro: { sgk: h.sgk, issizlik: h.issizlik, gelirVergisi: h.gelirVergisi,
              damga: h.damga, net: h.net + 1234 }
  });
  var n3 = r3.satirlar.filter(function (s) { return s.anahtar === "net"; })[0];
  dogru("kesintiler doğruyken ayna yorumu ÇIKMIYOR",
    n3.tamam === false && n3.sebepler.length === 0,
    JSON.stringify(n3.sebepler));
})();

/* --- KONTROLLER ---------------------------------------------------- */
dogru("KONTROL: satır listesi beş kalem", D.SATIRLAR.length === 5);
dogru("KONTROL: tolerans bir kuruş", D.TOLERANS === 0.01);
dogru("KONTROL: modül yasal sabit tanımlamıyor", (function () {
  var kaynak = require("fs").readFileSync(path.join(__dirname, "denetim.js"), "utf8");
  /* Yorumlardaki yıl/madde numaraları hariç, koda gömülü büyük sayı olmamalı. */
  var kod = kaynak.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  var buyuk = (kod.match(/\b\d{4,}\b/g) || []);
  return buyuk.length === 0;
})(), "koda gömülü dört haneli sayı var");

console.log("\n" + gecen + " gecti, " + hata + " kaldi. (bordro denetimi)");
process.exit(hata ? 1 : 0);
