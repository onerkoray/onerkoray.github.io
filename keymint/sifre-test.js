#!/usr/bin/env node
/*!
 * Şifre motoru regresyonları.
 *
 * NEDEN: bir parola üretecinde hatalar SESSİZDİR. Zayıf rastgelelik,
 * yanlı modulo, eksik sınıf ya da şişirilmiş entropi — hiçbiri ekranda
 * görünmez; çıktı yine rastgele bir dizi gibi durur. Kullanıcı o parolayı
 * kullanmaya başlar ve yanlış bir güvenlik duygusu taşır.
 *
 * Bu yüzden burada üç şey sabitleniyor:
 *   1. ÖZDEŞLİKLER — entropi düzeltmesi ile reddetme kabul olasılığı AYNI
 *      sayıdır; iki bağımsız yoldan hesaplanıp karşılaştırılıyor.
 *   2. DAĞILIM — üretilen karakterler havuzda düzgün dağılıyor mu.
 *   3. DÜRÜSTLÜK — kullanıcı parolası için "üst sınır" ile "kalıp bulundu"
 *      sayıları ayrı duruyor ve Password123! artık güçlü sayılmıyor.
 */
"use strict";
var M = require("./sifre-motoru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
/* Metin karsilastirmasi: esit() sayisal, metinde NaN uretiyordu. */
function metin(ad, b, bek) {
  if (b !== bek) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
/* Dev sayilarda mutlak tolerans anlamsiz: 2^59 olceginde 1e-3 farki
   kayan noktanin cozunurlugunun altinda. Bagil tolerans kullaniliyor. */
function yakin(ad, b, bek, bagil) {
  var t = (bagil === undefined ? 1e-12 : bagil) * Math.abs(bek);
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k, detay) {
  if (!k) {
    hata++;
    console.error("  BASARISIZ  " + ad + (detay ? "\n      " + detay : ""));
  } else { gecen++; console.log("  tamam      " + ad); }
}

function secim(o) {
  return Object.assign({
    uzunluk: 16, buyuk: true, kucuk: true, rakam: true, sembol: true,
    karisanlariCikar: false, herSiniftanBir: false
  }, o || {});
}

/* ------------------------------------------------------------------ */
console.log("Havuz ve düz entropi");
var e = M.entropi(secim());
esit("havuz 26+26+10+24", e.havuz, 86);
esit("16 × log2(86)", Math.round(e.bit * 100) / 100,
  Math.round(16 * Math.log2(86) * 100) / 100, 0.01);
esit("düzeltme yok", e.duzeltme, 0);

var tek = M.entropi(secim({ buyuk: false, rakam: false, sembol: false }));
esit("yalnız küçük harf havuzu", tek.havuz, 26);
esit("16 × log2(26)", Math.round(tek.bit), Math.round(16 * Math.log2(26)));

console.log("\nKarışan karakterler havuzu KÜÇÜLTÜR");
var k1 = M.entropi(secim());
var k2 = M.entropi(secim({ karisanlariCikar: true }));
dogru("havuz küçüldü", k2.havuz < k1.havuz, k1.havuz + " -> " + k2.havuz);
dogru("entropi düştü", k2.bit < k1.bit);
/* 0 O 1 l I | ` — yedi karakterin altısı bu dört sınıfta (| ve ` sembol
   kümesinde yok, yani 0,O,1,l,I ve hiçbiri: 5 karakter düşer). */
esit("tam olarak 5 karakter düştü", k1.havuz - k2.havuz, 5);

/* ------------------------------------------------------------------ */
console.log("\nSINIF GARANTİSİ ENTROPİYİ DÜŞÜRÜR");
/* Cogu arac bunu bir guvenlik ARTISI gibi sunar; aritmetik tersini
   soyluyor: kisit ornek uzayini daraltir. */
var g0 = M.entropi(secim({ uzunluk: 8 }));
var g1 = M.entropi(secim({ uzunluk: 8, herSiniftanBir: true }));
dogru("garanti entropiyi düşürdü", g1.bit < g0.bit,
  g0.bit.toFixed(3) + " -> " + g1.bit.toFixed(3));
dogru("düzeltme negatif", g1.duzeltme < 0);
esit("düz kısım değişmedi", g1.duz, g0.duz, 1e-9);
esit("bit = düz + düzeltme", g1.bit, g1.duz + g1.duzeltme, 1e-9);

console.log("\nÖZDEŞLİK: düzeltme = log2(kabul olasılığı)");
/* Ayni sayi iki isi birden goruyor. Ikisi ayrisirsa ya entropi ya da
   uretim yanlistir; hangisi oldugunu bu test soyler. */
[[8, 4], [12, 4], [16, 4], [6, 3], [20, 2]].forEach(function (x) {
  var s = secim({
    uzunluk: x[0], herSiniftanBir: true,
    sembol: x[1] >= 4, rakam: x[1] >= 3, buyuk: x[1] >= 2
  });
  var ent = M.entropi(s);
  var pr = M.uygunlukOlasiligi(M.kumeler(s), x[0]);
  esit(x[0] + " uzunluk / " + M.kumeler(s).length + " sınıf",
    ent.duzeltme, M.log2(pr), 1e-9);
});

console.log("\nKabul olasılığı elle sayılabilen bir durumda doğru mu?");
/* Iki sinif: kucuk (26) ve rakam (10), havuz 36, uzunluk 2.
   Uygun diziler: bir kucuk bir rakam, iki sirada = 2*26*10 = 520.
   Toplam 36^2 = 1296. Pr = 520/1296. */
var iki = { uzunluk: 2, kucuk: true, rakam: true, buyuk: false, sembol: false };
esit("Pr = 520/1296", M.uygunlukOlasiligi(M.kumeler(iki), 2), 520 / 1296, 1e-12);
var entIki = M.entropi(Object.assign({ herSiniftanBir: true }, iki));
esit("entropi = log2(520)", entIki.bit, M.log2(520), 1e-9);

/* ------------------------------------------------------------------ */
console.log("\nÜretim");
var u = M.uret(secim());
esit("uzunluk", u.parola.length, 16);
dogru("hata yok", !u.hata);
dogru("bit entropi ile aynı", Math.abs(u.bit - M.entropi(secim()).bit) < 1e-9);

console.log("\nGarantiyle üretilen HER parolada her sınıf var");
var s4 = secim({ uzunluk: 6, herSiniftanBir: true });
var eksikVar = false;
for (var i = 0; i < 300; i++) {
  var p = M.uret(s4).parola;
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p) ||
      !/[!@#$%^&*()\-_=+\[\]{};:,.?/]/.test(p)) { eksikVar = true; break; }
}
dogru("300 üretimde eksik sınıf yok", !eksikVar);

console.log("\nGaranti YOKKEN eksik sınıf ÇIKABİLİR (eski davranışın hatası)");
/* Bu, garantinin neden gerektigini gosteren kontrol: kisa parolada
   secili bir turun hic gecmemesi sik. */
var sg = secim({ uzunluk: 4, herSiniftanBir: false });
var eksikGoruldu = false;
for (var j = 0; j < 400; j++) {
  var q = M.uret(sg).parola;
  if (!/[0-9]/.test(q)) { eksikGoruldu = true; break; }
}
dogru("garanti olmadan rakamsız parola görüldü", eksikGoruldu);

console.log("\nUzunluk sınıf sayısından küçükse REDDEDİLİR");
var az = M.uret(secim({ uzunluk: 3, herSiniftanBir: true }));
dogru("hata döndü", !!az.hata, JSON.stringify(az).slice(0, 80));
dogru("parola üretilmedi", !az.parola);

console.log("\nHiç tür seçilmezse üretmez");
dogru("hata döndü", !!M.uret(secim({
  buyuk: false, kucuk: false, rakam: false, sembol: false
})).hata);

/* ------------------------------------------------------------------ */
console.log("\nDağılım: karakterler havuzda düzgün mü?");
/* Modulo yanliligi burada gorunur: yanli bir uretecte havuzun ILK
   karakterleri sistematik olarak fazla cikar. */
var sd = { uzunluk: 1, kucuk: true, buyuk: false, rakam: false, sembol: false,
  karisanlariCikar: false, herSiniftanBir: false };
var sayim = {};
var N = 26000;
for (var t = 0; t < N; t++) {
  var c = M.uret(sd).parola;
  sayim[c] = (sayim[c] || 0) + 1;
}
var farkli = Object.keys(sayim).length;
esit("26 harfin hepsi çıktı", farkli, 26);
var bekl = N / 26;
var enSapan = 0;
Object.keys(sayim).forEach(function (c) {
  enSapan = Math.max(enSapan, Math.abs(sayim[c] - bekl) / bekl);
});
/* 1000 beklenen sayimda %20 sapma ~6 standart sapma; duzgun bir
   uretecte pratikte imkansiz, yanli bir uretecte kolay. */
dogru("hiçbir harf %20'den fazla sapmadı", enSapan < 0.20,
  "en büyük sapma: %" + (enSapan * 100).toFixed(1));

/* ------------------------------------------------------------------ */
console.log("\nModulo yanlılığı: GÖZLENEBİLİR olduğu yerde");
/* ONEMLI BIR OLCUM NOTU.
   Yukaridaki dagilim testi modulo yanliligini YAKALAYAMAZ ve yakalamasi
   da beklenmemeli: havuz 26-95 arasindayken 2^32'nin kalanindan dogan
   sapma ~1e-8 mertebesinde, yani hicbir makul orneklem boyutunda
   gorunmez. Mutasyon testi bunu gosterdi -- reddetme kodu silindiginde
   dagilim testi yesil kaldi.

   Reddetme yine de dogru olan; yanlisligi n BUYUDUKCE gorunur hale
   geliyor. Bu yuzden burada dogrudan rastgele() cagriliyor ve n,
   yanliligin olculebilir oldugu bir degere cekiliyor.

   n = 3 * 2^29 icin: reddetmesiz surumde [0, 2n/3) araligi 3 sansa,
   geri kalani 2 sansa sahip olur; beklenen pay 2/3 iken 0,75'e cikar.
   Reddetmeli surumde tam olarak 2/3 kalir. */
var nBuyuk = 3 * Math.pow(2, 29);        // 1.610.612.736
var esikBuyuk = Math.floor(nBuyuk * 2 / 3);
var altta = 0, ornek = 40000;
for (var mi = 0; mi < ornek; mi++) {
  if (M.rastgele(nBuyuk) < esikBuyuk) altta++;
}
var pay = altta / ornek;
/* Duzgun: 0,6667. Yanli: 0,75. Esik ikisinin ortasinda; 40 bin
   ornekte standart hata ~0,0024, yani arada 14+ standart sapma var. */
dogru("pay 2/3'e yakın, 0,75'e değil", Math.abs(pay - 2 / 3) < 0.02,
  "bulunan pay: " + pay.toFixed(4) + " (düzgün 0,6667 / yanlı 0,7500)");

/* Sinir kontrolu: hicbir donus n'e esit ya da buyuk olamaz. */
var asan = false;
for (var ri = 0; ri < 5000; ri++) {
  var v = M.rastgele(7);
  if (!(v >= 0 && v < 7)) { asan = true; break; }
}
dogru("dönüş her zaman [0, n) aralığında", !asan);

var gecersiz = false;
try { M.rastgele(0); } catch (err) { gecersiz = true; }
dogru("n = 0 reddediliyor", gecersiz);
/* ------------------------------------------------------------------ */
console.log("\nKırılma süresi");
esit("ortalama 2^(bit-1) tahmin", M.kirilmaSuresi(41, 1e6), Math.pow(2, 40) / 1e6, 1e-6);
var sureler = M.tumSureler(60);
esit("üç saldırgan modeli", sureler.length, 3);
function model(a) {
  return sureler.filter(function (s) { return s.anahtar === a; })[0];
}
/* Siraya degil ANAHTARA bakiliyor: dizinin sirasi bir SUNUM karari
   (en kotu durum once) ve degisebilir; iliskiler degismemeli. */
dogru("hızlı hash, yavaş hash'ten hızlı", model("hizli").hiz > model("yavas").hiz);
dogru("çevrimiçi en yavaş saldırgan", model("cevrimici").hiz < model("yavas").hiz);
dogru("en kötü durum ilk sırada", sureler[0].anahtar === "hizli");
dogru("ilk satır en kısa süre", sureler[0].saniye < sureler[1].saniye &&
  sureler[1].saniye < sureler[2].saniye);
/* Ayni bit, farkli model: sure hizla TERS orantili olmali. */
yakin("süre ∝ 1/hız", model("hizli").saniye * model("hizli").hiz,
  model("yavas").saniye * model("yavas").hiz);

console.log("\nSüre metni");
metin("sıfır", M.sureMetni(0), "anında");
dogru("çok büyük süre sayı vermiyor",
  /evrenin yaşından/.test(M.sureMetni(1e30)));
dogru("yıl ölçeği", /yıl/.test(M.sureMetni(1e9)));

/* ------------------------------------------------------------------ */
console.log("\nKULLANICI PAROLASI: üst sınır ile kalıp AYRI");
/* ESKI ARACIN HATASI: "Password123!" icin 78,8 bit hesaplayip
   "Cok guclu" diyordu. Entropi URETECIN ozelligidir; bir insan sectiyse
   o formul gecersizdir. */
var a = M.analiz("Password123!");
dogru("üst sınır hâlâ yüksek", a.ustSinirBit > 70,
  "ust sinir: " + a.ustSinirBit.toFixed(1));
dogru("kalıp bulundu", a.kaliplar.length > 0,
  JSON.stringify(a.kaliplar.map(function (k) { return k.tur; })));
dogru("kalıp biti çok daha düşük", a.kalipBit < 40,
  "kalip bit: " + String(a.kalipBit));
dogru("değerlendirme kalıp bitini kullanıyor", a.degerlendirmeBit === a.kalipBit);
dogru("artık 'çok güçlü' değil",
  M.seviye(a.degerlendirmeBit).sinif !== "cok-guclu",
  M.seviye(a.degerlendirmeBit).ad);

console.log("\nYaygın parolalar ve leet dönüşümleri");
dogru("password yakalandı", M.analiz("password").kaliplar.some(function (k) {
  return k.tur === "yaygin";
}));
dogru("P@ssw0rd leet olarak yakalandı", M.analiz("P@ssw0rd").kaliplar.some(function (k) {
  return k.tur === "leet";
}));
dogru("qwerty1234 klavye sırası yakalandı",
  M.analiz("qwerty1234").kaliplar.some(function (k) { return k.tur === "klavye"; }));
dogru("aaa tekrarı yakalandı",
  M.analiz("Kaaa!12xy").kaliplar.some(function (k) { return k.tur === "tekrar"; }));
dogru("yalnız rakam yakalandı",
  M.analiz("83927461").kaliplar.some(function (k) { return k.tur === "sadece-rakam"; }));

console.log("\nGerçekten rastgele bir parolada kalıp UYDURULMUYOR");
/* Yanlis pozitif de bir hata: her paroladaki bir seyi "kalip" ilan eden
   bir arac, guclu parolalari da zayif gosterir ve guvenilmez olur. */
var temiz = M.uret(secim({ uzunluk: 20, herSiniftanBir: true })).parola;
var at = M.analiz(temiz);
dogru("kalıp bulunmadı", at.kaliplar.length === 0, temiz + " -> " +
  JSON.stringify(at.kaliplar));
dogru("değerlendirme üst sınırı kullanıyor", at.degerlendirmeBit === at.ustSinirBit);
dogru("çok güçlü sayıldı", M.seviye(at.degerlendirmeBit).sinif === "cok-guclu");

console.log("\nBoş girdi");
dogru("boş işaretlendi", M.analiz("").bos === true);

/* ------------------------------------------------------------------ */
console.log("\nSeviye eşikleri artan");
var oncekiYuzde = -1;
[10, 30, 50, 70, 100].forEach(function (b) {
  var s = M.seviye(b);
  dogru(b + " bit -> " + s.ad, s.yuzde > oncekiYuzde);
  oncekiYuzde = s.yuzde;
});

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (sifre motoru kontrolleri)");
