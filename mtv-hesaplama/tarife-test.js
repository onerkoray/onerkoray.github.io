#!/usr/bin/env node
/*!
 * MTV tarife ve hesap kuralları testleri.
 *
 * EN ÖNEMLİ KONTROL: ÇAPRAZ DOĞRULAMA
 * -----------------------------------
 * tarife.js'teki 2026 tutarları bir tebliğden aktarıldı. Aktarma hatası
 * sessizdir — yanlış sayı da hizalı görünür. Bu yüzden burada tutarlar
 * BAŞKA BİR KAYNAKLA, kanunun kendi ham tutarlarıyla karşılaştırılıyor.
 *
 * Kanunun (I) ve (I/A) tarifelerindeki ham tutarlar her yıl yeniden
 * değerleme oranıyla çarpılır ve "bir Türk lirasına kadar kesirler
 * dikkate alınmaz" (58 Seri No.lu Tebliğ, md. 3). Yani:
 *
 *   yayımlanan  =  ham × K  −  (yıllık yuvarlama birikimi)
 *
 * Birikim her zaman POZİTİFTİR (aşağı yuvarlanır) ve 2018'den 2026'ya
 * sekiz yılda ölçülen aralığı 5,67 – 21,04 TL'dir. Test bu iki ucu da
 * bağlıyor: tutar ham × K'yi AŞAMAZ ve ondan 30 TL'den fazla GERİ
 * KALAMAZ. Karşılaştırma için: en küçük tutarda tek bir rakam yer
 * değiştirmesi (17.705 → 17.075) 641 TL sapma verir; yakalanır.
 *
 * Ham tutar kaynağı : mevzuat.gov.tr, 197 sayılı Kanun md. 5 ve geç. md. 8
 * 2026 tutar kaynağı: 58 Seri No.lu MTV Genel Tebliği
 *
 *   node mtv-hesaplama/tarife-test.js
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

/* ---------------------------------------------------------------- *
 * Kanundaki HAM tutarlar (mevzuat.gov.tr)
 * ---------------------------------------------------------------- */
var HAM_I = [                                    // (I) — 20 satır
  [743, 518, 290, 220, 78], [817, 570, 319, 242, 86], [892, 622, 348, 264, 94],
  [1294, 970, 563, 398, 153], [1423, 1067, 619, 437, 168], [1553, 1164, 675, 477, 183],
  [2512, 1964, 1156, 705, 274], [2741, 2142, 1262, 770, 299],
  [3957, 3048, 1792, 1067, 421], [4317, 3326, 1955, 1164, 459],
  [5936, 4309, 2692, 1609, 637], [6476, 4701, 2937, 1755, 695],
  [8276, 7200, 4498, 2420, 888], [9029, 7854, 4907, 2640, 969],
  [12603, 11340, 6831, 3410, 1251], [13749, 12371, 7452, 3720, 1365],
  [19815, 17111, 10077, 4498, 1792], [21617, 18666, 10994, 4907, 1955],
  [32431, 24320, 14403, 6474, 2512], [35379, 26531, 15713, 7062, 2741]
];
var HAM_IA = [                                   // (I/A) — 9 satır
  [743, 518, 290, 220, 78], [1294, 970, 563, 398, 153], [2284, 1785, 1051, 641, 249],
  [3598, 2771, 1629, 970, 383], [5396, 3918, 2448, 1463, 579],
  [7524, 6545, 4089, 2200, 808], [11458, 10309, 6210, 3100, 1138],
  [18014, 15555, 9161, 4089, 1629], [29483, 22109, 13094, 5885, 2284]
];
var K = 7.7566;              // 2018→2026 birikimli yeniden değerleme
var TOLERANS = 30;           // ölçülen en büyük yuvarlama birikimi 21,04

console.log("2026 tutarları kanunun ham tutarlarıyla tutuyor");
function caprazla(ad, yayin, ham) {
  var kotu = [];
  yayin.forEach(function (satir, i) {
    satir.forEach(function (v, y) {
      var d = ham[i][y] * K - v;
      if (d < 0 || d > TOLERANS) {
        kotu.push(ad + " satır " + (i + 1) + " yaş " + y + ": " + v +
          " (ham " + ham[i][y] + " → beklenen ~" + (ham[i][y] * K).toFixed(0) + ")");
      }
    });
  });
  dogru(ad + " — " + (yayin.length * 5) + " hücrenin tamamı", kotu.length === 0,
    kotu.slice(0, 5).join("\n      "));
}
var duzI = [];
T.TARIFE_I.forEach(function (b) { b.satir.forEach(function (s) { duzI.push(s); }); });
esit("(I) tarifesinde 20 satır var", duzI.length, 20);
caprazla("(I)", duzI, HAM_I);
esit("(I/A) tarifesinde 9 satır var", T.TARIFE_IA.length, 9);
caprazla("(I/A)", T.TARIFE_IA, HAM_IA);

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN HATA: 2018 öncesi tescil
 *
 * Araç eskiden (I) tarifesinin ilk değer kademesini kullanıyordu. İlk
 * iki bantta bu tesadüfen doğru; üçüncüden itibaren değil. Test her iki
 * tarafı da bağlıyor ki "düzeltirken" ilk iki bant bozulmasın.
 * ---------------------------------------------------------------- */
console.log("\n(I/A), (I)'in ilk kademesinden farklı bir tarife");
esit("1300 cm³ — iki tarife çakışıyor",
  T.TARIFE_IA[0].join(","), T.TARIFE_I[0].satir[0].join(","));
esit("1301–1600 — iki tarife çakışıyor",
  T.TARIFE_IA[1].join(","), T.TARIFE_I[1].satir[0].join(","));
var ayrisan = 0;
for (var b = 2; b < 9; b++) {
  if (T.TARIFE_IA[b].join(",") !== T.TARIFE_I[b].satir[0].join(",")) ayrisan++;
  dogru(T.HACIM_ETIKET[b] + " — (I/A) daha düşük",
    T.TARIFE_IA[b][0] < T.TARIFE_I[b].satir[0][0],
    T.TARIFE_IA[b][0] + " < " + T.TARIFE_I[b].satir[0][0] + " değil");
}
esit("1601 cm³'ten itibaren yedi bandın hepsi ayrışıyor", ayrisan, 7);

/* Hatanın kendisi: 2017 model 1.8 otomobil, 2018 öncesi tescil (10 yaş). */
var eskiAraba = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "icten", bant: 2, modelYili: 2017
});
esit("2017 model 1.8 (eski tescil) → (I/A) tutarı", eskiAraba.vergi, 8145);
dogru("eski tescilde (I) tutarı KULLANILMIYOR", eskiAraba.vergi !== 8948,
  "8.948 TL (I) tarifesinin tutarı — gerileme");
esit("eski tescilde değer kademesi yok", eskiAraba.kademe, null);
dogru("çıktı hangi tarife olduğunu söylüyor",
  eskiAraba.tarife.indexOf("(I/A)") === 0, eskiAraba.tarife);

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN HATA: elektrikli araçta kW
 * ---------------------------------------------------------------- */
console.log("\nElektrikli otomobil motor GÜCÜNE göre satıra yerleşiyor");
/* Kanun "geçmeyenler" der: sınır değerin KENDİSİ alt banttadır. */
esit("70 kW → 1. bant", T.kwBandi(70), 0);
esit("70,5 kW → 2. bant", T.kwBandi(70.5), 1);
esit("85 kW → 2. bant", T.kwBandi(85), 1);
esit("86 kW → 3. bant", T.kwBandi(86), 2);
esit("105 kW → 3. bant", T.kwBandi(105), 2);
esit("120 kW → 4. bant", T.kwBandi(120), 3);
esit("150 kW → 5. bant", T.kwBandi(150), 4);
esit("180 kW → 6. bant", T.kwBandi(180), 5);
esit("210 kW → 7. bant", T.kwBandi(210), 6);
esit("240 kW → 8. bant", T.kwBandi(240), 7);
esit("240,1 kW → 9. bant", T.kwBandi(240.1), 8);
esit("1000 kW → 9. bant (üst uç açık)", T.kwBandi(1000), 8);
esit("güç verilmemişse bant yok", T.kwBandi(NaN), null);
esit("dokuz kW etiketi var", T.KW_ETIKET.length, 9);
esit("dokuz hacim etiketi var", T.HACIM_ETIKET.length, 9);

/* %25: tarifedeki tutarın dörtte biri, ne eksik ne fazla. */
var ev = T.hesapla({
  tur: "otomobil", tescil: "yeni", yakit: "elektrik",
  kw: 150, modelYili: 2025, deger: 2000000
});
esit("150 kW EV → 2501–3000 satırı", ev.bant, 4);
esit("150 kW EV kademe (2.000.000 > 968.100)", ev.kademe, 1);
esit("150 kW EV vergisi = satırın %25'i", ev.vergi, 50217 * 0.25);
dogru("etiket hem kW hem satırı söylüyor",
  ev.bantEtiket.indexOf("kW") >= 0 && ev.bantEtiket.indexOf("cm³") >= 0,
  ev.bantEtiket);

/* Elektrikli araç 2018 öncesi tescilliyse (I/A) + kW. */
var evEski = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "elektrik", kw: 60, modelYili: 2016
});
esit("60 kW, 2016 model EV → (I/A) 1. satırın %25'i", evEski.vergi, 2238 * 0.25);

/* İçten yanmalıda kW SORULMAZ; bant kullanıcının seçtiği hacimdir. */
var benzin = T.hesapla({
  tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 1,
  modelYili: 2024, deger: 900000
});
esit("1.6 benzinli, 900.000 TL → 3. kademe", benzin.kademe, 2);
esit("1.6 benzinli vergisi", benzin.vergi, 12028);
esit("içten yanmalıda indirim yok", benzin.evOrani, 1);

/* ---------------------------------------------------------------- *
 * DÜZELTİLEN EKSİK: elektrikli motosiklet
 * ---------------------------------------------------------------- */
console.log("\nElektrikli motosikletin kendi kW bantları var");
esit("6 kW → tarife dışı", T.motoKwBandi(6), -1);
esit("6,5 kW → 1. satır", T.motoKwBandi(6.5), 0);
esit("15 kW → 1. satır", T.motoKwBandi(15), 0);
esit("40 kW → 2. satır", T.motoKwBandi(40), 1);
esit("60 kW → 3. satır", T.motoKwBandi(60), 2);
esit("61 kW → 4. satır", T.motoKwBandi(61), 3);
var evMoto = T.hesapla({ tur: "motosiklet", yakit: "elektrik", kw: 11, modelYili: 2024 });
esit("11 kW elektrikli motosiklet = 1. satırın %25'i", evMoto.vergi, 1069 * 0.25);
var kucukMoto = T.hesapla({ tur: "motosiklet", yakit: "elektrik", kw: 4, modelYili: 2024 });
esit("4 kW → hesap yok, hata bildiriliyor", kucukMoto.hata, "moto-kw-disi");
dogru("hata alt sınırı da söylüyor", kucukMoto.altSinir === 6, String(kucukMoto.altSinir));

/* ---------------------------------------------------------------- *
 * (I/A) kasko istisnası — kanunda kendiliğinden işleyen hüküm
 * ---------------------------------------------------------------- */
console.log("\n(I/A) kasko istisnası: vergi kaskonun %5'ini aşarsa bir alt satır");
esit("istisna oranı %5", T.IA_KASKO_ORANI, 0.05);
/* 2017 model 2.0, (I/A) 7-11 yaş = 12.624 TL. Kasko 200.000 → sınır
   10.000 TL. Vergi sınırı aşıyor; bir önceki satır (1601–1800) 8.145. */
var kasko = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "icten", bant: 3,
  modelYili: 2017, kasko: 200000
});
esit("12.624 > 10.000 → bir alt satır uygulandı", kasko.vergi, 8145);
dogru("indirim işaretlendi", kasko.kaskoIndirimi === true);
esit("indirimden önceki tutar korunuyor", kasko.kaskoOncesi, 12624);
esit("hangi satıra düşüldüğü yazıyor", kasko.kaskoBanti, "1601 – 1800 cm³");
/* Kanun "bir önceki satır" der — zincirleme değil. 8.145 hâlâ 10.000'in
   altında olmasaydı bile ikinci kez düşülmezdi. */
var kasko2 = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "icten", bant: 8,
  modelYili: 2017, kasko: 200000
});
esit("4001+ için tek adım: 101.555 → 71.048", kasko2.vergi, 71048);
dogru("iki adım atılmadı", kasko2.vergi !== 48158, "zincirleme uygulanmış");
/* Sınırın altındaysa dokunulmuyor. */
var kaskoYok = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "icten", bant: 3,
  modelYili: 2017, kasko: 900000
});
esit("kasko yüksekse istisna yok", kaskoYok.vergi, 12624);
dogru("indirim işareti yok", !kaskoYok.kaskoIndirimi);
/* İlk satırda "bir önceki satır" yok. */
var ilkSatir = T.hesapla({
  tur: "otomobil", tescil: "eski", yakit: "icten", bant: 0,
  modelYili: 2017, kasko: 20000
});
esit("1. satırda tutar değişmiyor", ilkSatir.vergi, 2238);
dogru("durum bildiriliyor", ilkSatir.kaskoIlkSatir === true);
/* Yeni tescilde bu hüküm YOK — oradaki %10 Cumhurbaşkanı yetkisidir. */
var yeniKasko = T.hesapla({
  tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 3,
  modelYili: 2024, deger: 500000, kasko: 100000
});
esit("(I) tarifesinde otomatik kasko indirimi uygulanmıyor", yeniKasko.vergi, 30679);
dogru("(I) için indirim işareti yok", !yeniKasko.kaskoIndirimi);

/* ---------------------------------------------------------------- *
 * Değer kademesi ve yaş
 * ---------------------------------------------------------------- */
console.log("\nDeğer kademesi ve yaş grupları");
/* Kanun eşiği "aşmayanlar" / "aşanlar" der: eşiğin KENDİSİ alt kademede. */
esit("309.100 TL → 1. kademe", T.degerKademesi(0, 309100), 0);
esit("309.101 TL → 2. kademe", T.degerKademesi(0, 309101), 1);
esit("541.500 TL → 2. kademe", T.degerKademesi(0, 541500), 1);
esit("541.501 TL → 3. kademe", T.degerKademesi(0, 541501), 2);
esit("775.100 TL → 1. kademe (1.8)", T.degerKademesi(2, 775100), 0);
esit("775.101 TL → 2. kademe (1.8)", T.degerKademesi(2, 775101), 1);
esit("2026 modelin yaşı 1", T.aracYasi(2026, 2026), 1);
esit("2024 modelin yaşı 3", T.aracYasi(2024, 2026), 3);
esit("3 yaş → 1. grup", T.yasGrubu(3), 0);
esit("4 yaş → 2. grup", T.yasGrubu(4), 1);
esit("11 yaş → 3. grup", T.yasGrubu(11), 2);
esit("12 yaş → 4. grup", T.yasGrubu(12), 3);
esit("16 yaş → 5. grup", T.yasGrubu(16), 4);
esit("40 yaş → 5. grup", T.yasGrubu(40), 4);

/* ---------------------------------------------------------------- *
 * Yapısal tutarlılık — tabloların kendi içinde
 * ---------------------------------------------------------------- */
console.log("\nTarifeler kendi içinde tutarlı");
var yasDusmuyor = [], bantArtmiyor = [];
function yasKontrol(ad, s) {
  for (var i = 1; i < 5; i++) if (s[i] >= s[i - 1]) yasDusmuyor.push(ad + " yaş " + i);
}
T.TARIFE_IA.forEach(function (s, i) { yasKontrol("(I/A) " + T.HACIM_ETIKET[i], s); });
duzI.forEach(function (s, i) { yasKontrol("(I) satır " + (i + 1), s); });
T.TARIFE_MOTO.forEach(function (s, i) { yasKontrol("moto " + T.MOTO_ETIKET[i], s); });
dogru("her tarifede vergi yaşla düşüyor", yasDusmuyor.length === 0, yasDusmuyor.join(", "));
for (var i = 1; i < 9; i++) {
  if (T.TARIFE_IA[i][0] <= T.TARIFE_IA[i - 1][0]) bantArtmiyor.push("(I/A) " + i);
  if (T.TARIFE_I[i].satir[0][0] <= T.TARIFE_I[i - 1].satir[0][0]) bantArtmiyor.push("(I) " + i);
}
dogru("vergi motor büyüdükçe artıyor", bantArtmiyor.length === 0, bantArtmiyor.join(", "));
var kademeArtmiyor = [];
T.TARIFE_I.forEach(function (b, bi) {
  esit("(I) " + T.HACIM_ETIKET[bi] + ": kademe sayısı = eşik + 1",
    b.satir.length, b.esik.length + 1);
  for (var k = 1; k < b.satir.length; k++) {
    for (var y = 0; y < 5; y++) {
      if (b.satir[k][y] <= b.satir[k - 1][y]) kademeArtmiyor.push(T.HACIM_ETIKET[bi] + " k" + k);
    }
  }
});
dogru("değer kademesi yükseldikçe vergi artıyor", kademeArtmiyor.length === 0,
  kademeArtmiyor.join(", "));

console.log("\nSabitler");
esit("yıl", T.YIL, 2026);
esit("elektrik oranı %25", T.EV_ORANI, 0.25);
/* Sayfada uzun süre %25,49 yazıyordu; o VUK'un oranı. MTV için
   Cumhurbaşkanı Kararı %18,95 belirledi. */
esit("yeniden değerleme oranı %18,95", T.YENIDEN_DEGERLEME, 0.1895);
esit("(I) kasko oranı %10 (yetki)", T.I_KASKO_ORANI, 0.10);

console.log("\nTaksitler");
var t = T.hesapla({ tur: "otomobil", tescil: "yeni", yakit: "icten", bant: 1,
  modelYili: 2024, deger: 100000 });
esit("iki eşit taksit", t.taksit * 2, t.vergi);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (MTV tarife kontrolleri)");
