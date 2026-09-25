#!/usr/bin/env node
/*
 * Dilim kayması hesabı — regresyon testleri.
 *
 * Araç bir araştırmanın yöntemini kişiye uyguluyor; test de o yöntemin
 * iki önermesini ve yazıyla tutarlılığı sabitliyor:
 *
 *   Ö1 NÖTRLEŞTİRME. Asgari ücret matrahının altındaki bir eşiğin
 *      kaydırılması, asgari ücret üstü ücretlinin vergisini TAM OLARAK
 *      değiştirmez. Ayrıştırmada ilk eşiğin katkısı sıfır olmalı.
 *   Ö2 KAPALI FORM. Tek bir eşik Δ kadar kayınca, iki tarafını da geçen
 *      bir ücrette etki Δ × (üst oran − alt oran).
 *   TOPLANABİLİRLİK. Tarife parçalı doğrusal olduğu için eşik katkıları
 *      toplanır ve toplam farka eşittir. Bu, ayrıştırma tablosunun
 *      "farkın nereden geldiği" iddiasının dayanağı.
 *
 * Yazıyla tutarlılık: TÜFE çarpanı, yazının kullandığı birikmisTufe ile
 * aynı olmalı; yazının sayısal sınamasındaki karşı-olgusal eşik (431.937)
 * ve kapalı form tutarı (2.235,59) motordan aynen çıkmalı.
 *
 * Kullanım: node bordro/dilim-kaymasi-test.js
 */
"use strict";

var path = require("path");
var D = require(path.join(__dirname, "dilim-kaymasi.js"));
var B = require(path.join(__dirname, "motor.js"));
var S = require(path.join(__dirname, "..", "finans", "endeksleme-serileri.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.005 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var OLCUT = D.OLCUTLER.map(function (o) { return o.kod; });
var YILLAR = D.yillar();

/* ------------------------------------------------ kapsam */
gecer("yıllar 2023'ten başlıyor", YILLAR[0] === 2023, YILLAR.join(","));
gecer("yıllar serinin son yılına kadar", YILLAR[YILLAR.length - 1] === S.YILLAR[S.YILLAR.length - 1]);
gecer("2026 başlangıç yılları 2022–2025", D.bazYillari(2026).join(",") === "2022,2023,2024,2025");
gecer("üç ölçüt", OLCUT.join(",") === "ydo,tufe,asgari");

/* ------------------------------------------------ çarpanlar */
YILLAR.forEach(function (y) {
  D.bazYillari(y).forEach(function (b) {
    gecer("TÜFE çarpanı yazınınkiyle aynı " + b + "→" + y,
      yakin(D.katsayi("tufe", b, y), S.birikmisTufe(b, y), 1e-12));
  });
});
gecer("tek yıllık YDO çarpanı", yakin(D.katsayi("ydo", 2025, 2026), 1 + S.SERI[2026].ydo / 100, 1e-12));
gecer("asgari ücret artışı ocaktan ocağa",
  yakin(D.artis("asgari", 2026), D.asgariBrut(2026) / D.asgariBrut(2025) - 1, 1e-12));
gecer("seri dışı yıl null döner (tahmin yok)", D.katsayi("tufe", 2026, 2027) === null);

/* ------------------------------------------------ karşı-olgusal tarife */
var d25 = B.parametre(2025).dilimler;
var kd = D.dilimler("ydo", 2025, 2026);
gecer("eşikler yuvarlanmıyor (kesirsiz)", yakin(kd[1][0], d25[1][0] * (1 + S.SERI[2026].ydo / 100), 1e-9));
gecer("oranlar değişmiyor", kd.every(function (d, i) { return d[1] === d25[i][1]; }));
gecer("son dilim açık kalıyor", kd[kd.length - 1][0] === null);
gecer("ikinci eşik YDO ile", yakin(kd[1][0], 414116.9, 0.5), kd[1][0]);

/* Yazının sayısal sınaması: ikinci eşik TÜFE ile 431.937, etki 2.235,59. */
var kt = D.dilimler("tufe", 2025, 2026);
gecer("yazıdaki karşı-olgusal ikinci eşik", Math.round(kt[1][0]) === 431937, kt[1][0]);
var P26 = B.parametre(2026);

/* ------------------------------------------------ Ö2 kapalı form */
var asgari26 = D.asgariBrut(2026);
[3, 5].forEach(function (k) {
  var r = D.hesapla({ brut: asgari26 * k, yil: 2026, baz: 2025, olcut: "tufe" });
  var e2 = r.esikler[1];
  var beklenen = (e2.karsi - e2.gercek) * (P26.dilimler[2][1] - P26.dilimler[1][1]);
  gecer("kapalı form " + k + "× asgari", yakin(e2.katki, beklenen, 0.01),
    e2.katki.toFixed(2) + " vs " + beklenen.toFixed(2));
});
var r100 = D.hesapla({ brut: 100000, yil: 2026, baz: 2025, olcut: "tufe" });
gecer("yazıdaki kapalı form tutarı 2.235,59", yakin(r100.esikler[1].katki, 2235.59, 0.005), r100.esikler[1].katki.toFixed(2));

/* ------------------------------------------------ Ö1 nötrleştirme + toplanabilirlik */
var enAz = Infinity;
var BRUTLER = [1.05, 1.5, 2, 3, 5, 8, 15, 40].map(function (k) { return asgari26 * k; });
/* Izgara yılın EN YÜKSEK asgari ücretinden kurulur: 2022 ve 2023'te asgari
   ücret temmuzda arttı ve ocak asgarisinin 1,05 katı temmuzdan sonra yasal
   asgari ücretin altına düşüyordu. Önermeler asgari ücret üstü içindir. */
function enYuksekAsgari(y) {
  return Math.max.apply(null, B.parametre(y).donemler.map(function (d) { return d.asgariBrut; }));
}
YILLAR.forEach(function (y) {
  var asg = enYuksekAsgari(y);
  D.bazYillari(y).forEach(function (b) {
    OLCUT.forEach(function (o) {
      [1.05, 2, 5, 15].forEach(function (k) {
        var r = D.hesapla({ brut: asg * k, yil: y, baz: b, olcut: o });
        var top = r.esikler.reduce(function (t, e) { return t + e.katki; }, 0);
        gecer("toplanabilirlik " + [y, b, o, k].join("/"), yakin(top, r.fark, 0.01),
          top.toFixed(2) + " vs " + r.fark.toFixed(2));
        /* İlk eşik hem gerçekte hem karşı-olgusalda asgari matrahın
           altındaysa katkısı tam sıfır olmalı. */
        var Py = B.parametre(y), yillikAsgariMatrah = 0;
        for (var ay = 1; ay <= 12; ay++) yillikAsgariMatrah += B.donem(Py, ay).asgariBrut * (1 - Py.oranlar.sgkIsci - Py.oranlar.issizlikIsci);
        var e1 = r.esikler[0];
        if (Math.max(e1.gercek, e1.karsi) < yillikAsgariMatrah) {
          gecer("ilk eşik nötr " + [y, b, o, k].join("/"), Math.abs(e1.katki) < 0.005, e1.katki.toFixed(4));
          enAz = Math.min(enAz, 1);
        }
      });
    });
  });
});
gecer("nötrleştirme en az bir kez sınandı", enAz === 1);
/* Kontrol: ikinci eşik nötr değil, yoksa test eşikleri okumayan bir motorda da geçerdi. */
gecer("ikinci eşik nötr değil (kontrol)", Math.abs(r100.esikler[1].katki) > 1);

/* ------------------------------------------------ asgari ücrette vergi yok, fark yok */
YILLAR.forEach(function (y) {
  OLCUT.forEach(function (o) {
    var r = D.hesapla({ brut: D.asgariBrut(y), yil: y, baz: y - 1, olcut: o });
    gecer("asgari ücrette fark sıfır " + y + "/" + o, yakin(r.fark, 0), r.fark.toFixed(2));
  });
});

/* ------------------------------------------------ yazının iki olgusu, işaretle */
/* 2022'den başlayınca TÜFE'ye göre tarife ÖNDE: fark hiçbir ücrette pozitif değil. */
BRUTLER.forEach(function (b) {
  var r = D.hesapla({ brut: b, yil: 2026, baz: 2022, olcut: "tufe" });
  gecer("2022→2026 TÜFE: tarife önde (" + Math.round(b) + ")", r.fark <= 0.005, r.fark.toFixed(2));
});
/* 2026 tarifesi yasal ölçütün altında: 2025'ten YDO'ya göre fark hiçbir ücrette negatif değil. */
BRUTLER.forEach(function (b) {
  var r = D.hesapla({ brut: b, yil: 2026, baz: 2025, olcut: "ydo" });
  gecer("2025→2026 YDO: kural dışı yıl (" + Math.round(b) + ")", r.fark >= -0.005, r.fark.toFixed(2));
});
/* 2023'ten başlayınca TÜFE'ye göre erime: ikinci eşiği geçen ücrette fark pozitif. */
gecer("2023→2026 TÜFE: erime", D.hesapla({ brut: 100000, yil: 2026, baz: 2023, olcut: "tufe" }).fark > 0);

/* ------------------------------------------------ yeniden değerleme yazısıyla aynı */
/* Yasal ölçütün farkı, yeniden değerleme yazısının "kesir atılmasaydı"
   fazla vergisiyle kuruşu kuruşuna aynı olmalı: iki sayfa aynı soruyu
   soruyor, ayrı cevap veremezler. */
var YDO = require(path.join(__dirname, "..", "makaleler", "yeniden-degerleme-orani-nedir", "ydo.js"));
[2023, 2024, 2025].forEach(function (baz) {
  BRUTLER.forEach(function (b) {
    var a = D.hesapla({ brut: b, yil: 2026, baz: baz, olcut: "ydo" }).fark;
    var y = YDO.fazlaVergi(b, baz, 2026).fazla;
    gecer("yasal ölçüt = kesir atılmasaydı " + baz + "/" + Math.round(b), yakin(a, y, 0.005), a.toFixed(2) + " vs " + y.toFixed(2));
  });
});
/* 2026'nın bütün eşikleri kanunun izin verdiği kesir payı içinde; araç
   bunu "ihlal" diye sunmuyor, "izin verilen yuvarlamanın bedeli" diyor. */
gecer("2026 tarifesi kesir kuralına uygun", YDO.tarifeDenetimi(2026).dilimler.every(function (d) { return d.uygun; }));

/* ------------------------------------------------ dilim ayları */
var r = D.hesapla({ brut: 100000, yil: 2026, baz: 2025, olcut: "ydo" });
gecer("dilim ayları gerçek bordroyla aynı",
  r.gercekAylar.every(function (ay, i) {
    if (ay === null) return r.gercek.aylar.every(function (a) { return a.dilim < r.gercekDilimler[i][1] - 1e-12; });
    return r.gercek.aylar[ay - 1].dilim >= r.gercekDilimler[i][1] - 1e-12 &&
      (ay === 1 || r.gercek.aylar[ay - 2].dilim < r.gercekDilimler[i][1] - 1e-12);
  }));
gecer("gerçek taraf motorun hesaplaYil'iyle aynı",
  yakin(r.gercek.toplam.gelirVergisi, B.hesaplaYil(100000, 2026).toplam.gelirVergisi));
gecer("aylık fark = yıllık / 12", yakin(r.aylikFark * 12, r.fark));

/* ------------------------------------------------ tarama ve matris hesapla ile aynı */
var t = D.tarama(2026, 2023, "asgari", [60000, 150000]);
gecer("tarama hesapla ile aynı", yakin(t[1].fark, D.hesapla({ brut: 150000, yil: 2026, baz: 2023, olcut: "asgari" }).fark));
var m = D.matris(150000, 2026);
gecer("matris 4 başlangıç × 3 ölçüt", m.length === 4 && m.every(function (x) { return x.olcutler.length === 3; }));
gecer("matris hesapla ile aynı", yakin(m[1].olcutler[1].fark, D.hesapla({ brut: 150000, yil: 2026, baz: 2023, olcut: "tufe" }).fark));

/* ------------------------------------------------ geçersiz girdi */
gecer("sıfır brüt reddedilir", atar(function () { D.hesapla({ brut: 0, yil: 2026, baz: 2025, olcut: "ydo" }); }));
gecer("sayı olmayan brüt reddedilir", atar(function () { D.hesapla({ brut: "abc", yil: 2026, baz: 2025, olcut: "ydo" }); }));
gecer("seri dışı yıl reddedilir", atar(function () { D.hesapla({ brut: 1e5, yil: 2027, baz: 2025, olcut: "ydo" }); }));
gecer("başlangıç = yıl reddedilir", atar(function () { D.hesapla({ brut: 1e5, yil: 2026, baz: 2026, olcut: "ydo" }); }));
gecer("2022 öncesi başlangıç reddedilir", atar(function () { D.hesapla({ brut: 1e5, yil: 2026, baz: 2021, olcut: "ydo" }); }));
gecer("bilinmeyen ölçüt reddedilir", atar(function () { D.hesapla({ brut: 1e5, yil: 2026, baz: 2025, olcut: "x" }); }));

console.log("\n" + gecen + " geçti, " + kalan + " kaldı. (dilim kayması)");
process.exit(kalan ? 1 : 0);
