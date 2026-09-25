#!/usr/bin/env node
/*
 * Ne kadar kredi çekebilirim — regresyon testleri.
 *
 *   - bulunan tutarın kredi aracındaki taksiti bütçeyi aşmaz
 *   - 100 TL fazlasının taksiti bütçeyi aşar (tutar en büyüğü)
 *   - kapalı form: A = T (1 − (1+r)^−n) / r, r kredi aracının brutOran'ı
 *   - gelirden bütçe = gelir × pay − mevcut taksit
 *   - faiz ve vade yönleri
 *
 * Kullanım: node finans/kredi-limiti-test.js
 */
"use strict";

var path = require("path");
var L = require(path.join(__dirname, "kredi-limiti.js"));
var KH = require(path.join(__dirname, "..", "kredi-hesaplama", "hesap.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var DURUMLAR = [
  { taksit: 20000, aylikFaiz: 3.99, vade: 36, tur: "ihtiyac" },
  { taksit: 15000, aylikFaiz: 3.49, vade: 48, tur: "tasit" },
  { taksit: 40000, aylikFaiz: 2.99, vade: 120, tur: "konut" },
  { taksit: 7500, aylikFaiz: 4.25, vade: 12, tur: "ihtiyac" },
  { taksit: 90000, aylikFaiz: 3.1, vade: 24, tur: "ticari" },
  { taksit: 5000, aylikFaiz: 0, vade: 10, tur: "ihtiyac" }
];
DURUMLAR.forEach(function (d) {
  var ad = d.tur + " " + d.aylikFaiz + "/" + d.vade;
  var r = L.hesapla(d), t = KH.turBilgi(d.tur);
  var oran = KH.brutOran(d.aylikFaiz, t.kkdf, t.bsmv);
  gecer("aylık maliyet oranı kredi aracından " + ad, yakin(r.aylikMaliyetOrani, oran, 1e-15));
  var kf = oran === 0 ? d.taksit * d.vade : d.taksit * (1 - Math.pow(1 + oran, -d.vade)) / oran;
  gecer("kapalı form " + ad, yakin(r.tamTutar, kf, 1e-6));
  gecer("100 TL'ye aşağı yuvarlı " + ad, r.anapara % 100 === 0 && r.anapara <= r.tamTutar && r.tamTutar - r.anapara < 100);
  gecer("plan taksiti bütçeyi aşmaz " + ad, r.plan.taksit <= d.taksit + 0.005, r.plan.taksit + " / " + d.taksit);
  var fazla = KH.plan({ anapara: r.anapara + 100, aylikFaiz: d.aylikFaiz, vade: d.vade, kkdf: t.kkdf, bsmv: t.bsmv });
  gecer("100 TL fazlası bütçeyi aşar " + ad, fazla.taksit > d.taksit - 0.005, fazla.taksit + " / " + d.taksit);
  gecer("plan anaparası aynı " + ad, yakin(r.plan.anapara, r.anapara, 0.001));
});
var sifir = L.hesapla({ taksit: 5000, aylikFaiz: 0, vade: 10 });
gecer("faizsizde tutar = taksit × vade", sifir.anapara === 50000);

/* Gelirden bütçe */
var g = L.hesapla({ gelir: 60000, pay: 0.4, mevcut: 4000, aylikFaiz: 3.99, vade: 36 });
gecer("bütçe = 60.000 × 0,4 − 4.000", yakin(g.girdi.taksit, 20000, 1e-9) && g.girdi.butceKaynagi === "gelir");
gecer("varsayılan pay %40", yakin(L.hesapla({ gelir: 50000, aylikFaiz: 3, vade: 12 }).girdi.taksit, 20000, 1e-9));
gecer("doğrudan bütçe gelire öncelikli", L.hesapla({ taksit: 1000, gelir: 99999, aylikFaiz: 3, vade: 12 }).girdi.taksit === 1000);

/* Yönler */
gecer("faiz 1 puan düşükse daha çok", g.faizBirPuanDusuk > 0);
gecer("faiz 1 puan yüksekse daha az", g.faizBirPuanYuksek < 0);
var tb = L.tablo({ taksit: 20000, aylikFaiz: 3.99, vade: 36 }, [12, 24, 36, 48], [2.99, 3.49, 3.99]);
gecer("tablo: vade uzadıkça artar", tb.every(function (s) { return s.tutarlar.every(function (x, i) { return i === 0 || x > s.tutarlar[i - 1]; }); }));
gecer("tablo: faiz arttıkça azalır", tb[0].tutarlar[2] > tb[1].tutarlar[2] && tb[1].tutarlar[2] > tb[2].tutarlar[2]);
gecer("tablo hücresi hesapla ile aynı", tb[2].tutarlar[2] === L.hesapla({ taksit: 20000, aylikFaiz: 3.99, vade: 36 }).anapara);
var kon = L.hesapla({ taksit: 20000, aylikFaiz: 3.99, vade: 36, tur: "konut" });
gecer("vergisiz konut kredisinde daha çok", kon.anapara > L.hesapla({ taksit: 20000, aylikFaiz: 3.99, vade: 36 }).anapara);

/* Hatalı girdi */
gecer("bütçe yok", atar(function () { L.hesapla({ aylikFaiz: 3, vade: 12 }); }));
gecer("mevcut taksit payı aşıyor", atar(function () { L.hesapla({ gelir: 10000, pay: 0.4, mevcut: 5000, aylikFaiz: 3, vade: 12 }); }));
gecer("vade 0", atar(function () { L.hesapla({ taksit: 1000, aylikFaiz: 3, vade: 0 }); }));
gecer("faiz %25", atar(function () { L.hesapla({ taksit: 1000, aylikFaiz: 25, vade: 12 }); }));

console.log(gecen + " geçti, " + kalan + " kaldı. (kredi limiti)");
process.exit(kalan ? 1 : 0);
