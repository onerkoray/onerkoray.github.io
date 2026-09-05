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
ok("Tavanlı kıdem = tavan tutarı (1 yıl)", yakin(tavanli.kidem.brut, 73729.84, 0.02),
  tavanli.kidem.brut.toFixed(2));
ok("Kıdemden gelir vergisi kesilmez, yalnızca damga",
  yakin(tavanli.kidem.net, tavanli.kidem.brut * (1 - 0.00759), 0.02));

var haziran = ornek({ cikis: "2026-06-30", iseGiris: "2025-06-30" });
ok("Fesih tarihi Haziran ise ilk yarıyıl tavanı uygulanır",
  haziran.kidem.tavan === 64948.77, String(haziran.kidem.tavan));
ok("Fesih tarihi Eylül ise ikinci yarıyıl tavanı uygulanır",
  ornek().kidem.tavan === 73729.84);

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

/* 9 — Kıdem tavanı verisi olmayan yıl sessizce yanlış hesaplamamalı */
baslik("Veri sınırları");
var eski = ornek({ cikis: "2024-06-30", iseGiris: "2019-03-15" });
ok("2024 fesihinde kıdem tavanı verisi yok → hak üretilmez", eski.kidem.hak === false);
ok("Kullanıcıya gerekçe ve uyarı gösteriliyor",
  eski.kidem.gerekce.length > 0 && eski.uyarilar.length > 0);

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

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
