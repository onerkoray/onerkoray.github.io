#!/usr/bin/env node
/*
 * "Torba yasa beklentileri tuttu mu?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Bu yazının tek iddiası bir SAYIM: beklenti listesinden kaç madde
 * yasalaştı. Sayım yanlışsa yazının tamamı yanlış olur, ama ekranda
 * hiçbir şey bozulmaz — yalnızca bir rakam başka yazar. Test hem modülün
 * türetmelerini hem tabloların modülle uyumunu hem de nesirdeki
 * rakamların tabloyla aynı olduğunu bağlıyor.
 *
 * DÖRT ÖNERME
 * -----------
 * Ö1. Beklenti listesinden gelen maddelerin TAMAMI tek bir yıla düşüyor.
 *     KONTROL: "tamamı" iddiası, yoğun yılın payı ölçülmeden de geçerdi;
 *     pay ayrıca hesaplanıp 1'e eşit olduğu doğrulanıyor. Ayrıca diğer
 *     yılların TEK TEK sıfır olduğu da sınanıyor — tek bir yılın dolu
 *     olması, kalanların boş olduğunu kendiliğinden söylemez.
 *
 * Ö2. Son gelişten bu yana geçen yıl sayısı, pencerenin sonu ile son
 *     karşılanma yılı arasındaki fark.
 *     KONTROL: sayaç, hiç karşılanma olmadığında pencere uzunluğuna
 *     düşmeli; bu dal ayrıca sınanıyor.
 *
 * Ö3. Tablodaki HER kanunun Resmî Gazete künyesi var.
 *     KONTROL: künye alanının boş bırakılmadığı değil, TARİH İÇERDİĞİ
 *     ölçülüyor — boş bir hücre de "var" sayılabilirdi.
 *
 * Ö4. Kapsam sınırı ve dışarıda bırakılan kanun okuyucuya söyleniyor.
 *     Bu bir sayı değil, bir dürüstlük koşulu; yazının iddiası ancak bu
 *     sınırla birlikte doğru.
 *
 * Kullanım: node makaleler/torba-yasa-beklenti-tutuyor-mu/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var B = require(path.join(__dirname, "beklenti.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function kacKez(m) { return HTML.split(m).length - 1; }
function gecsin(ad, m) { gecer(ad, kacKez(m) >= 1, "sayfada yok: " + m); }
function tamKez(ad, m, adet) {
  var n = kacKez(m);
  gecer(ad, n === adet, m + " " + n + " kez geçiyor, beklenen " + adet);
}
function tabloSatirlari(capIcerik) {
  var i = HTML.indexOf(capIcerik);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  return HTML.slice(bas, son).split("<tr").slice(1).filter(function (r) {
    return r.indexOf('scope="col"') < 0;
  }).map(function (r) {
    return (r.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/g) || []).map(function (h) {
      return h.replace(/<[^>]*>/g, "").trim();
    });
  }).filter(function (h) { return h.length > 1; });
}

console.log("Torba yasa beklentileri — sayı denetimi\n");

/* ---------------------------------------------------------------- 1
   Ö1: getiri tek bir yılda mı yoğunlaşıyor? */
var yogun = B.yogunYil();
gecer("yoğun yıl 2023", yogun === 2023, String(yogun));
gecer("yoğun yılın payı tam 1", B.yilPayi(yogun) === 1,
  String(B.yilPayi(yogun)));

/* KONTROL: payın 1 olması, diğer yılların tek tek sıfır olduğunu
   söylemez -- toplam sıfırken de oran 1 çıkabilirdi. Ayrı ayrı bakılıyor. */
B.yillar().forEach(function (y) {
  if (y === yogun) return;
  gecer("beklentiden gelen " + y + " yılında sıfır", B.getiriYil(y) === 0,
    y + ": " + B.getiriYil(y));
});
gecer("KONTROL: yoğun yıl gerçekten dolu", B.getiriYil(yogun) === 3,
  String(B.getiriYil(yogun)));

/* ---------------------------------------------------------------- 2
   Ö2: sıfır yıl sayacı */
gecer("son gelişten beri 3 yıl", B.sifirYilSayisi() === 3,
  String(B.sifirYilSayisi()));

/* KONTROL: hiç karşılanma yoksa sayaç pencere uzunluğuna düşmeli.
   Bu dal gerçek veriyle hiç çalışmıyor; sahte veriyle sınanıyor. */
(function () {
  var yedek = B.BEKLENTILER.slice();
  B.BEKLENTILER.length = 0;
  B.BEKLENTILER.push({ id: "x", ad: "x", karsilandi: null, not: "" });
  var s = B.sifirYilSayisi();
  B.BEKLENTILER.length = 0;
  yedek.forEach(function (b) { B.BEKLENTILER.push(b); });
  gecer("KONTROL: hiç karşılanma yoksa sayaç pencere uzunluğu",
    s === B.yillar().length, String(s));
})();
gecer("KONTROL: yedek geri yüklendi", B.BEKLENTILER.length === 7,
  String(B.BEKLENTILER.length));

/* ---------------------------------------------------------------- 3
   İsabet oranı ve boş kanun payı */
gecer("pencere içi karşılanan 3", B.pencereIciKarsilanan().length === 3,
  String(B.pencereIciKarsilanan().length));
gecer("izlenen beklenti 7", B.BEKLENTILER.length === 7,
  String(B.BEKLENTILER.length));
gecer("hiç karşılanmayan 2", B.hicKarsilanmayan().length === 2,
  String(B.hicKarsilanmayan().length));
gecer("pencere öncesi karşılanan 2", B.pencereOncesi().length === 2,
  String(B.pencereOncesi().length));

/* Üç grup toplamı, izlenen beklenti sayısını vermeli: hiçbir beklenti
   iki gruba birden düşmemeli, hiçbiri de dışarıda kalmamalı. */
gecer("gruplar örtüşmüyor ve eksiksiz",
  B.pencereIciKarsilanan().length + B.hicKarsilanmayan().length +
  B.pencereOncesi().length === B.BEKLENTILER.length);

gecer("boş kanun 5", B.bosKanunlar().length === 5,
  String(B.bosKanunlar().length));
gecer("tablodaki kanun 8", B.KANUNLAR.length === 8,
  String(B.KANUNLAR.length));

/* MUTASYONLA BULUNAN BOŞLUK 4: bir kanunun getirdi[] dizisindeki kimlik
   hiçbir beklentiye çözülmezse üreteç ham kimliği basıyor ve tablo
   sessizce bozuluyor. Referans bütünlüğü ayrıca bağlanıyor. */
(function () {
  var cozulmeyen = [];
  B.KANUNLAR.forEach(function (k) {
    k.getirdi.forEach(function (id) {
      if (!B.beklenti(id)) cozulmeyen.push(k.no + ":" + id);
    });
  });
  gecer("her getirdi kimliği bir beklentiye çözülüyor",
    cozulmeyen.length === 0, cozulmeyen.join(", "));
})();

/* KONTROL: çözücü gerçekten arıyor mu? Olmayan kimlik null dönmeli. */
gecer("KONTROL: olmayan kimlik çözülmüyor", B.beklenti("yokboyle") === null);

/* ---------------------------------------------------------------- 4
   Ö3: HER kanunun künyesi var mı? */
var kanunSatir = tabloSatirlari("Gözlem penceresindeki büyük torba kanunlar");
gecer("kanun tablosu bulundu", kanunSatir !== null);
if (kanunSatir) {
  /* Son satır tfoot toplamı; kanun satırları onun dışındakiler. */
  var satirlar = kanunSatir.filter(function (r) {
    return r[0] !== "Beklenti listesinden gelen toplam madde";
  });
  gecer("tabloda 8 kanun satırı", satirlar.length === 8,
    String(satirlar.length));

  var yil = /\b(19|20)\d{2}\b/;
  var kunyesiz = satirlar.filter(function (r) { return !yil.test(r[2]); });
  gecer("her satırın künyesinde yıl var", kunyesiz.length === 0,
    kunyesiz.map(function (r) { return r[1]; }).join(", "));

  /* KONTROL: künye sütunu gerçekten okunuyor mu? Var olmayan bir yıl
     aranırsa hiçbir satır eşleşmemeli. */
  var sahte = satirlar.filter(function (r) { return /\b1899\b/.test(r[2]); });
  gecer("KONTROL: sahte yıl hiçbir künyede yok", sahte.length === 0);

  /* Tablodaki kanun numaraları modüldekilerle birebir aynı mı? */
  var tabloNo = satirlar.map(function (r) { return parseInt(r[1], 10); })
    .sort(function (a, b) { return a - b; });
  var modulNo = B.KANUNLAR.map(function (k) { return k.no; })
    .sort(function (a, b) { return a - b; });
  gecer("tablo ve modül kanun numaraları aynı",
    tabloNo.join(",") === modulNo.join(","),
    tabloNo.join(",") + " vs " + modulNo.join(","));

  /* "Beklentiden" sütunu boş olan satır sayısı, modülün boş kanun
     sayısıyla aynı olmalı. */
  var bosSatir = satirlar.filter(function (r) {
    return r[r.length - 1] === "—";
  });
  gecer("tabloda boş satır sayısı modülle aynı",
    bosSatir.length === B.bosKanunlar().length,
    bosSatir.length + " vs " + B.bosKanunlar().length);
}

/* MUTASYONLA BULUNAN BOŞLUK 1: yukarıdaki karşılaştırma tablo ile
   modülün TUTARLI olduğunu söylüyor, DOĞRU olduğunu değil. Bir kanun
   numarası ikisinde birden değişirse sessizce geçerdi. Beklenen numaralar
   burada ayrıca çiviliyor. */
gecer("kanun numaraları beklenen küme",
  B.KANUNLAR.map(function (k) { return k.no; }).join(",") ===
  "7438,7440,7456,7524,7538,7566,7587,7589",
  B.KANUNLAR.map(function (k) { return k.no; }).join(","));

/* MUTASYONLA BULUNAN BOŞLUK 2: "yoğun yılın payı 1" iddiası, yilPayi()
   her zaman 1 dönse de geçiyordu. Sıfır bir yılın payı ayrıca ölçülüyor. */
(function () {
  var bosYil = null;
  B.yillar().forEach(function (y) {
    if (bosYil === null && B.getiriYil(y) === 0) bosYil = y;
  });
  gecer("KONTROL: boş bir yılın payı sıfır",
    bosYil !== null && B.yilPayi(bosYil) === 0,
    bosYil + ": " + B.yilPayi(bosYil));
})();

/* Yoğun yıl gerçekten en yüksek mi? Bugünkü veride 2023 hem pencerenin
   ilk yılı hem yoğun yıl olduğu için "hep ilk yılı dön" mutasyonu EŞDEĞER
   kalıyor -- bu özellik denetimi onu bugün yakalayamaz ama veri
   değiştiğinde yakalar. Eşdeğerlik bilinçli kabul ediliyor. */
B.yillar().forEach(function (y) {
  gecer("yoğun yıl " + y + " yılından az değil",
    B.getiriYil(B.yogunYil()) >= B.getiriYil(y));
});

/* ---------------------------------------------------------------- 5
   Durum ve araç tabloları */
var durumSatir = tabloSatirlari("Tekrarlayan beklentilerin");
gecer("durum tablosu bulundu", durumSatir !== null);
if (durumSatir) {
  gecer("durum tablosunda 7 beklenti", durumSatir.length === 7,
    String(durumSatir.length));
  var yasalasmadi = durumSatir.filter(function (r) {
    return r[1] === "Yasalaşmadı";
  });
  gecer("durum tablosunda 2 'Yasalaşmadı'",
    yasalasmadi.length === B.hicKarsilanmayan().length,
    String(yasalasmadi.length));
}

var aracSatir = tabloSatirlari("Hangi başlık hangi araçla");
gecer("araç tablosu bulundu", aracSatir !== null);
if (aracSatir) {
  var hayir = aracSatir.filter(function (r) { return r[2] === "Hayır"; });
  gecer("torba dışı başlık sayısı modülle aynı",
    hayir.length === B.torbaDisi().length,
    hayir.length + " vs " + B.torbaDisi().length);

  /* MUTASYONLA BULUNAN BOŞLUK 3: filtre ters çevrilince de sayı 3
     kalıyordu. İçerik ayrıca bağlanıyor -- asgari ücret torba kanunun
     konusu DEĞİL. */
  var disiAd = B.torbaDisi().map(function (a) { return a.konu; });
  gecer("asgari ücret torba dışı sayılıyor",
    disiAd.indexOf("Asgari ücret") >= 0, disiAd.join(", "));
  gecer("KONTROL: emeklilik şartları torba dışı SAYILMIYOR",
    disiAd.indexOf("Emeklilik şartları") < 0, disiAd.join(", "));
  gecer("KONTROL: araç tablosunda 'Evet' satırı da var",
    aracSatir.some(function (r) { return r[2] === "Evet"; }));
}

/* ---------------------------------------------------------------- 6
   Nesirdeki rakamlar tabloyla aynı mı? */
gecsin("kısa cevapta tek yıl vurgusu",
  "<strong>Beklenti listesinden gelen her madde tek bir yıla düşüyor: 2023.</strong>");
gecsin("sonraki üç yıl sıfır nesirde", "<strong>Sonraki üç yılda sıfır.</strong>");
gecsin("yedi başlık nesirde", "yedi tekrarlayan başlıktan üçü");
gecsin("beş kanun nesirde", "beş büyük");
gecsin("ters yön nesirde", "<strong>Çıkanlar çoğu zaman ters yöne gitti.</strong>");
gecsin("tavan 9 kat nesirde", "<strong>9 katına</strong>");

/* ---------------------------------------------------------------- 7
   Ö4: dürüstlük koşulları */
gecsin("kapsam sınırı yazıda", "<strong>Kapsam sınırı açıkça söylenmeli:</strong>");
gecsin("kapsam sınırı formülü", "\"yılın büyük torba kanunlarında yoktu\"");
gecsin("dışarıda bırakılan kanun anlatılmış", "7556");
gecsin("dışlamanın yönü söylenmiş", "zayıflatıyor");
gecsin("nedensellik iddiası reddedilmiş",
  "<strong>Bu bir gözlemdir, nedensellik iddiası değil.</strong>");
gecsin("puanlama sözü var", "Bu yazı puanlanacak");
gecsin("geçerlilik bildirimi var", "name=\"gecerlilik\"");

/* Künyeler nesirde ve kaynakçada; tam sayı çivileniyor ki bir kanun
   sessizce düşerse fark edilsin. */
tamKez("7566 künyesi sayfada tam dokuz kez", "7566", 9);
tamKez("OVP karar sayısı tam iki kez", "11752", 2);
tamKez("2/2755 esas numarası tam altı kez", "2/2755", 6);

/* KONTROL: tamKez gerçekten sayıyor mu? Olmayan bir dizgi sıfır dönmeli. */
tamKez("KONTROL: olmayan dizgi sıfır kez", "7777 sayılı Kanun", 0);

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
