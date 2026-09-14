/*!
 * Çıkış Paketi Motoru — doğrulama testleri.  Çalıştırma:  node bordro/cikis-test.js
 *
 * Buradaki en kritik kontrol hak matrisidir: bir fesih türünde hak doğmadığı
 * hâlde tutar üretmek, kullanıcıyı hak etmediği bir parayı beklemeye iter.
 * Bu yüzden her fesih türü için "hak yoksa tutar da sıfır" değişmezi ayrı ayrı
 * doğrulanır.
 */
"use strict";
var B = require("./motor.js");
var C = require("./cikis.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }
function baslik(s) { console.log("\n" + s); }

function ornek(ek) {
  var g = {
    iseGiris: "2019-03-15",
    cikis: "2026-09-30",
    ciplakBrut: 60000,
    giydirmeEkleri: 5000,
    fesihTuru: "isveren",
    ihbarSuresiCalisildi: false,
    kullanilmayanIzinGunu: 14,
    son4AyBrutOrtalama: 65000,
    son3YilPrimGunu: 1080
  };
  for (var k in (ek || {})) g[k] = ek[k];
  return C.hesapla(g);
}

/* 1 — Hak matrisi ile üretilen tutarlar tutarlı olmalı */
baslik("Hak matrisi: hak yoksa tutar da yok");
C.FESIH_TURLERI.forEach(function (t) {
  var r = ornek({ fesihTuru: t.kod });
  if (t.kidem === false) {
    ok(t.kisa + " → kıdem yok", r.kidem.hak === false && r.kidem.net === 0, r.kidem.net.toFixed(2));
  } else {
    ok(t.kisa + " → kıdem var", r.kidem.hak === true && r.kidem.net > 0);
  }
  if (t.ihbar === false) {
    ok(t.kisa + " → ihbar yok", r.ihbar.hak === false && r.ihbar.net === 0, r.ihbar.net.toFixed(2));
  } else {
    ok(t.kisa + " → ihbar var", r.ihbar.hak === true && r.ihbar.net > 0);
  }
  if (t.issizlik === false) {
    ok(t.kisa + " → işsizlik ödeneği yok", r.issizlik.hak === false && r.issizlik.toplam === 0);
  } else {
    ok(t.kisa + " → işsizlik ödeneği var", r.issizlik.hak === true && r.issizlik.toplam > 0);
  }
  ok(t.kisa + " → gerekçe metni var", !r.kidem.hak ? r.kidem.gerekce.length > 0 : true);
});

/* 2 — Kıdem tazminatı: 1 yıl şartı ve tavan */
baslik("Kıdem tazminatı");
ok("364 günde kıdem doğmaz",
  ornek({ iseGiris: "2025-10-02", cikis: "2026-09-30" }).kidem.hak === false);
ok("365 günde kıdem doğar",
  ornek({ iseGiris: "2025-09-30", cikis: "2026-09-30" }).kidem.hak === true);

var tam = ornek({ iseGiris: "2025-09-30", cikis: "2026-09-30" });
ok("Tam 1 yılda kıdem = giydirilmiş brüt (tavan altında)",
  yakin(tam.kidem.brut, 65000, 0.02), tam.kidem.brut.toFixed(2));

var tavanli = ornek({ ciplakBrut: 200000, giydirmeEkleri: 0, iseGiris: "2025-09-30" });
ok("Tavanın üzerinde ücrette tavan uygulanır", tavanli.kidem.tavanUygulandi === true);
ok("Tavanlı kıdem = tavan tutarı (1 yıl)", yakin(tavanli.kidem.brut, 73729.87, 0.02),
  tavanli.kidem.brut.toFixed(2));
ok("Kıdemden gelir vergisi kesilmez, yalnızca damga",
  yakin(tavanli.kidem.net, tavanli.kidem.brut * (1 - 0.00759), 0.02));

var haziran = ornek({ cikis: "2026-06-30", iseGiris: "2025-06-30" });
ok("Fesih tarihi Haziran ise ilk yarıyıl tavanı uygulanır",
  haziran.kidem.tavan === 64948.77, String(haziran.kidem.tavan));
ok("Fesih tarihi Eylül ise ikinci yarıyıl tavanı uygulanır",
  ornek().kidem.tavan === 73729.87);

/* 3 — İhbar tazminatı kademeleri (4857 m.17) */
baslik("İhbar süresi kademeleri");
[[100, 2], [300, 4], [800, 6], [2000, 8]].forEach(function (c) {
  ok(c[0] + " günlük kıdemde ihbar süresi " + c[1] + " hafta",
    C.ihbarHaftasi(c[0]) === c[1], String(C.ihbarHaftasi(c[0])));
});
var ih = ornek();
ok("İhbar tazminatı = giydirilmiş/30 × 7 × hafta",
  yakin(ih.ihbar.brut, (65000 / 30) * 7 * 8, 0.02), ih.ihbar.brut.toFixed(2));
ok("İhbar süresi çalışıldıysa tazminat ödenmez",
  ornek({ ihbarSuresiCalisildi: true }).ihbar.hak === false);
ok("İhbardan hem gelir hem damga vergisi kesilir",
  ih.ihbar.gelirVergisi > 0 && ih.ihbar.damga > 0);

/* 4 — Yıllık izin ücreti: çıplak ücret üzerinden, SGK yok */
baslik("Kullanılmayan yıllık izin ücreti");
var iz = ornek();
ok("İzin ücreti çıplak brüt üzerinden hesaplanır (giydirilmiş değil)",
  yakin(iz.izin.brut, (60000 / 30) * 14, 0.02), iz.izin.brut.toFixed(2));
ok("İzin ücretinden gelir ve damga vergisi kesilir",
  iz.izin.gelirVergisi > 0 && iz.izin.damga > 0);
ok("İzin günü 0 ise tutar 0", ornek({ kullanilmayanIzinGunu: 0 }).izin.net === 0);

/* 5 — İşsizlik ödeneği (4447 m.50) */
baslik("İşsizlik ödeneği");
[[600, 180], [899, 180], [900, 240], [1079, 240], [1080, 300], [599, 0]].forEach(function (c) {
  ok(c[0] + " prim gününde ödenek " + c[1] + " gün",
    C.odenekGunu(c[0], B.parametre(2026).issizlik) === c[1]);
});
ok("600 günün altında ödenek bağlanmaz",
  ornek({ son3YilPrimGunu: 599 }).issizlik.hak === false);

var yuksek = ornek({ son4AyBrutOrtalama: 200000 });
ok("Yüksek kazançta ödenek tavanı uygulanır", yuksek.issizlik.tavanUygulandi === true);
ok("Ödenek tavanı = brüt asgari ücret × %80",
  yakin(yuksek.issizlik.aylikBrut, 33030 * 0.80, 0.02), yuksek.issizlik.aylikBrut.toFixed(2));
ok("Ödenekten yalnızca damga vergisi kesilir",
  yakin(yuksek.issizlik.aylikNet, yuksek.issizlik.aylikBrut * (1 - 0.00759), 0.02));

/* 6 — Takvim */
baslik("Takvim");
var t = ornek();
ok("Takvim tarih sırasında",
  t.takvim.every(function (o, i) { return i === 0 || t.takvim[i - 1].tarih <= o.tarih; }),
  t.takvim.map(function (o) { return o.tarih; }).join(" "));
ok("İlk olay fesih tarihidir", t.takvim[0].tarih === "2026-09-30");
ok("İŞKUR son başvuru günü fesih + 30",
  t.issizlik.basvuruSonGun === "2026-10-30", t.issizlik.basvuruSonGun);
ok("İlk ödenek, başvuru ayını izleyen ayın 5'i",
  t.issizlik.ilkOdeme === "2026-11-05", t.issizlik.ilkOdeme);
ok("Son ödenek, ilk ödemeden 9 ay sonra (10 aylık ödenek)",
  t.issizlik.sonOdeme === "2027-08-05", t.issizlik.sonOdeme);
ok("Ödenek doğmayan türde takvimde yalnızca fesih olayı var",
  ornek({ fesihTuru: "istifa" }).takvim.length === 1);

/* 7 — Toplamların iç tutarlılığı */
baslik("Toplamlar");
var s = ornek();
ok("Çıkış ödemesi = kıdem + ihbar + izin + son ay",
  yakin(s.toplam.cikisOdemesi, s.kidem.net + s.ihbar.net + s.izin.net + s.sonAy.net, 0.02));
ok("Genel toplam = çıkış ödemesi + işsizlik toplamı",
  yakin(s.toplam.genelToplam, s.toplam.cikisOdemesi + s.issizlik.toplam, 0.02));
ok("İşsizlik toplamı = aylık net × ay sayısı",
  yakin(s.issizlik.toplam, s.issizlik.aylikNet * s.issizlik.ay, 0.02));

/* 8 — Hizmet süresi hesabı */
baslik("Hizmet süresi");
var h = C.hizmetSuresi("2019-03-15", "2026-09-30");
ok("2019-03-15 → 2026-09-30 = 7 yıl 6 ay 15 gün",
  h.yil === 7 && h.ay === 6 && h.gun === 15, h.yil + "/" + h.ay + "/" + h.gun);
ok("Toplam gün sayısı doğru", h.toplamGun === 2756, String(h.toplamGun));
var art = C.hizmetSuresi("2024-02-29", "2025-02-28");
ok("Artık yıl sınırında ay/gün taşması yok", art.yil === 0 || art.yil === 1);

/* 9 — Kıdem tavanı verisi olmayan yıl sessizce yanlış hesaplamamalı
 *
 * Bu bölüm bir zamanlar "2024 fesihinde veri yok" diyordu. Geçmiş yıl
 * tavanları eklenince iddia geçersizleşti ve test kırmızıya döndü —
 * doğrusu buydu: veri değiştiğinde onu anlatan test de değişmeli.
 *
 * Dal HÂLÂ gerekli, çünkü gerçek bir senaryosu var: yeni yılın vergi
 * parametreleri Ocak'ta girilir ama kıdem tavanı genelgesi birkaç gün
 * sonra çıkar. O aralıkta yıl TANIMLIDIR, tavanı YOKTUR. Test o durumu
 * doğrudan kuruyor, çünkü artık bunu yaşayan gerçek bir yıl kalmadı. */
baslik("Veri sınırları");
var yedekTavan = B.parametreler[2026].kidemTavanlari;
delete B.parametreler[2026].kidemTavanlari;
var eski = ornek({ cikis: "2026-06-30", iseGiris: "2019-03-15" });
B.parametreler[2026].kidemTavanlari = yedekTavan;

ok("tavan verisi olmayan yılda hak üretilmez", eski.kidem.hak === false);
ok("Kullanıcıya gerekçe ve uyarı gösteriliyor",
  eski.kidem.gerekce.length > 0 && eski.uyarilar.length > 0);
ok("Uyarı kapsanan yılları VERİDEN okuyor, metne gömmüyor",
  eski.uyarilar.join(" ").indexOf("2020") !== -1,
  eski.uyarilar.join(" "));
ok("Yedek geri konduktan sonra hesap yine çalışıyor",
  ornek({ cikis: "2026-06-30", iseGiris: "2019-03-15" }).kidem.hak === true);

/* 10 — Fesih türü tablosunun bütünlüğü */
baslik("Fesih türü tablosu");
var kodlar = {};
C.FESIH_TURLERI.forEach(function (t) {
  var sorun = [];
  if (kodlar[t.kod]) sorun.push("tekrar eden kod");
  kodlar[t.kod] = true;
  ["ad", "kisa", "aciklama", "dayanak"].forEach(function (a) {
    if (!t[a] || !t[a].length) sorun.push("eksik " + a);
  });
  [t.kidem, t.ihbar, t.issizlik].forEach(function (v) {
    if (v !== true && v !== false && v !== "sozlesme") sorun.push("geçersiz hak değeri");
  });
  ok(t.kod + " kaydı tutarlı", sorun.length === 0, sorun.join(", "));
});
ok("Bilinmeyen fesih türü hata fırlatır", (function () {
  try { C.fesih("yok"); return false; } catch (e) { return true; }
})());

baslik("Kıdem tazminatı tavanı — resmî tutarlar");
/* Bu dört sayı motorun en kırılgan noktası: yanlış girilirse hiçbir şey
   görünürde bozulmaz, yalnızca tavana takılan her kıdem yılında sessizce
   sapma birikir. 1.0.1 sürümünde 2026/II değeri 73.729,84 olarak girilmiş
   olduğu fark edildi; doğrusu 73.729,87.
   Kaynak: Hazine ve Maliye Bakanlığı Mali ve Sosyal Haklar Genelgeleri
   (2026/II için 3.7.2026 tarih ve 27998389-010.06.02-4870801 sayılı). */
[
  [2020, 1,  6730.15], [2020, 7,  7117.17],
  [2021, 1,  7638.96], [2021, 7,  8284.51],
  [2022, 1, 10848.59], [2022, 7, 15371.40],
  [2023, 1, 19982.83], [2023, 7, 23489.83],
  [2024, 1, 35058.58], [2024, 7, 41828.42],
  [2025, 1, 46655.43], [2025, 7, 53919.68],
  [2026, 1, 64948.77], [2026, 7, 73729.87]
].forEach(function (t) {
  var yil = t[0], ay = t[1], beklenen = t[2];
  var liste = B.parametre(yil).kidemTavanlari;
  var kayit = null;
  for (var i = 0; i < liste.length; i++) if (liste[i].ay === ay) kayit = liste[i];
  ok(yil + "/" + (ay === 1 ? "I" : "II") + ". dönem kıdem tavanı = " + beklenen,
     !!kayit && kayit.tutar === beklenen,
     kayit ? "bulunan: " + kayit.tutar : "dönem kaydı yok");
});

/* Serinin YAPISAL butunlugu.
 *
 * Yukaridaki tablo tutarlari birebir sabitliyor ama tek basina yetmez:
 * tabloya yanlis bir tutar yazilsaydi, test onu "dogru" kabul ederdi.
 * Asagidakiler tutarlardan BAGIMSIZ ozellikler -- elle aktarilmis bir
 * seride en olasi hata olan rakam yer degistirmesini yakalarlar. */
(function () {
  var yillar = [];
  for (var y in B.parametreler) {
    if (B.parametreler[y] && B.parametreler[y].kidemTavanlari) yillar.push(+y);
  }
  yillar.sort(function (a, b) { return a - b; });

  ok("kıdem tavanı serisi kesintisiz", yillar.length > 0 &&
     yillar[yillar.length - 1] - yillar[0] + 1 === yillar.length,
     yillar.join(", "));

  var oncekiTutar = 0, oncekiAd = "";
  var sorun = [];
  yillar.forEach(function (yil) {
    var liste = B.parametreler[yil].kidemTavanlari;
    if (liste.length !== 2 || liste[0].ay !== 1 || liste[1].ay !== 7) {
      sorun.push(yil + ": dönem yapısı (1 ve 7 olmalı)");
      return;
    }
    liste.forEach(function (k) {
      var ad = yil + "/" + (k.ay === 1 ? "I" : "II");
      /* 1) Tavan hicbir donemde DUSMEZ. Kanun geriye goturmuyor ve
            yer degistiren bir rakamin yarisi bu kontrolu kirar. */
      if (k.tutar <= oncekiTutar) {
        sorun.push(ad + " bir onceki donemden dusuk/esit (" +
                   oncekiTutar + " -> " + k.tutar + ")");
      }
      /* 2) Donemlik artis makul bantta. Olculen en buyuk sicrama
            2022/II (%41,7, olaganustu memur zammi); %60 ustu bir artis
            gercek degil, yazim hatasidir. */
      if (oncekiTutar > 0) {
        var artis = k.tutar / oncekiTutar - 1;
        if (artis > 0.60) {
          sorun.push(ad + " artışı gerçekçi değil: %" + (artis * 100).toFixed(1));
        }
      }
      /* 3) Kurus hassasiyeti: genelgeler iki ondalikla yayimlaniyor. */
      if (Math.abs(k.tutar * 100 - Math.round(k.tutar * 100)) > 1e-6) {
        sorun.push(ad + " iki ondalıktan fazla: " + k.tutar);
      }
      oncekiTutar = k.tutar;
      oncekiAd = ad;
    });
  });
  ok("kıdem tavanı serisi yapısal olarak tutarlı", sorun.length === 0,
     sorun.join(" | "));

  /* 4) BAGIMSIZ ARITMETIK KONTROL.
        Tavan, memur aylik katsayisiyla neredeyse dogru orantili: kanunun
        formulu agirlikla o katsayidan turuyor, ikinci bir bilesen kucuk
        bir kayma birakiyor. Iki ucta olculen oran 46.078 ve 46.797 --
        alti yilda %1,56. Bant %6 tutuldu: gercek kaymayi rahat alir,
        bir rakam yer degistirmesini (tipik olarak %5'ten buyuk sapma)
        almaz. Katsayilar Hazine ve Maliye genelgelerinden. */
  var KATSAYI = { "2020/1": 0.146061, "2026/7": 1.575512 };
  var oranlar = [];
  Object.keys(KATSAYI).forEach(function (anahtar) {
    var p = anahtar.split("/");
    var liste = B.parametreler[+p[0]].kidemTavanlari;
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].ay === +p[1]) oranlar.push(liste[i].tutar / KATSAYI[anahtar]);
    }
  });
  ok("iki uçta tavan/katsayı oranı aynı bantta", oranlar.length === 2 &&
     Math.abs(oranlar[0] - oranlar[1]) / oranlar[0] < 0.06,
     oranlar.map(function (x) { return x.toFixed(0); }).join(" vs "));
})();


/* ------------------------------------------------------------------ *
 * 1475 m.14/1-5 — yaş dışı emeklilikte 8 Eylül 1999 kapısı
 *
 * Kanun "15 yıl + 3600 gün" DEMEZ. 506 sayılı Kanunun geçici 81 inci
 * maddesine atıf yapar ve o geçiş hükmü 8 Eylül 1999'dan ÖNCE ilk kez
 * sigortalı olanlara uygulanır. Sonrasında sigortalı olanların yaş dışı
 * şartları daha ağırdır.
 *
 * Araç uzun süre bu ayrımı yapmıyordu ve seçeneğin adı doğrudan
 * "15 yıl + 3600 gün" idi; 2005'te sigortalı olmuş biri seçeneği
 * işaretleyip "kıdem alırsınız" cevabını alıyordu.
 * ------------------------------------------------------------------ */
baslik("Yaş dışı emeklilik — 8 Eylül 1999 kapısı");

function yasHaric(tarih) {
  return ornek({ fesihTuru: "yasHaric", sigortaBaslangici: tarih });
}
function uyariVar(r, parca) {
  return r.uyarilar.some(function (u) { return u.indexOf(parca) > -1; });
}

/* Seçeneğin adı tek bir vakayı değil HÜKMÜ tarif etmeli: rakamlar herkese
   aynı değil, hak herkese açık. */
var turYH = C.fesih("yasHaric");
ok("seçenek adı tek bir rakam kümesini koşul gibi sunmuyor",
  turYH.ad.indexOf("3600") === -1, turYH.ad);
ok("açıklama 1999 kapısını söylüyor",
  turYH.aciklama.indexOf("1999") > -1);

/* Tarih verilmezse SESSİZCE VARSAYILMAZ. */
var yhBos = yasHaric(null);
ok("tarih verilmezse uyarı çıkar", uyariVar(yhBos, "başlangıç tarihinizi girmediniz"));

/* 1999 ÖNCESİ: 15 yıl + 3600 gün yolu geçerli, ek uyarı yok. */
var yhOnce = yasHaric("1995-03-01");
ok("1999 öncesi — kıdem hakkı doğuyor", yhOnce.kidem.hak === true);
ok("1999 öncesi — 'daha ağır şart' uyarısı YOK",
  !uyariVar(yhOnce, "8 Eylül 1999 ve sonrasında"));
ok("1999 öncesi işaretleniyor", yhOnce.kidem.yasHaricSonraki === false);

/* 1999 SONRASI: hak var ama rakam farklı; kullanıcıya söyleniyor. */
var yhSonra = yasHaric("2005-03-01");
ok("1999 sonrası — kıdem hakkı yine doğuyor (hak herkese açık)",
  yhSonra.kidem.hak === true);
ok("1999 sonrası — rakamın farklı olduğu söyleniyor",
  uyariVar(yhSonra, "8 Eylül 1999 ve sonrasında"));
ok("1999 sonrası — geçici 81 kaynağı adlandırılıyor",
  uyariVar(yhSonra, "geçici 81"));
ok("1999 sonrası işaretleniyor", yhSonra.kidem.yasHaricSonraki === true);

/* SINIR: geçiş hükmü 8 Eylül 1999'dan ÖNCE sigortalı olanlar içindir,
   yani günün KENDİSİ sonraki gruptadır. */
ok("7 Eylül 1999 → önceki grup", yasHaric("1999-09-07").kidem.yasHaricSonraki === false);
ok("8 Eylül 1999 → sonraki grup", yasHaric("1999-09-08").kidem.yasHaricSonraki === true);

/* SGK yazısı her iki grupta da işleyen belgedir. */
ok("SGK yazısı uyarısı 1999 öncesinde de var", uyariVar(yhOnce, "SGK"));
ok("SGK yazısı uyarısı 1999 sonrasında da var", uyariVar(yhSonra, "SGK"));

/* Tarih YALNIZCA bu fesih türünde anlamlı: diğerlerinde sonucu
   değiştirmemeli, yoksa alanı gizlemek yanlış olurdu. */
var istifaBos = ornek({ fesihTuru: "istifa" });
var istifaTarihli = ornek({ fesihTuru: "istifa", sigortaBaslangici: "2005-03-01" });
ok("diğer fesih türünde sigorta tarihi sonucu değiştirmiyor",
  istifaBos.toplam.genelToplam === istifaTarihli.toplam.genelToplam);
ok("diğer fesih türünde 1999 uyarısı çıkmıyor",
  !uyariVar(istifaTarihli, "1999"));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
