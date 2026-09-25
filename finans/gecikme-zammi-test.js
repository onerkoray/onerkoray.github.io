#!/usr/bin/env node
/*
 * Gecikme zammı — regresyon testleri.
 *
 *   - oran tablosu GİB tablosuyla aynı (tarih ve oran)
 *   - tek dönemde: anapara × oran × (ay + gün/30)
 *   - oran değişikliği o günden itibaren; önceki gün eski oranla
 *   - dönemlerin gün toplamı vadeden ödemeye geçen gün
 *   - 1 TL alt sınırı; vadesinde ödemede zam yok
 *
 * Kullanım: node finans/gecikme-zammi-test.js
 */
"use strict";

var path = require("path");
var G = require(path.join(__dirname, "gecikme-zammi.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.005 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

/* GİB tablosu */
var GIB = [["2010-10-19", 0.014], ["2018-09-05", 0.02], ["2019-07-01", 0.025], ["2019-10-02", 0.02], ["2019-12-30", 0.016],
           ["2022-07-21", 0.025], ["2023-11-14", 0.035], ["2024-05-21", 0.045], ["2025-11-13", 0.037]];
gecer("oran tablosu GİB ile aynı", JSON.stringify(G.ORANLAR.map(function (x) { return [x.bas, x.oran]; })) === JSON.stringify(GIB));

/* Ay-gün sayımı */
[["2026-01-10", "2026-03-25", 2, 15], ["2026-01-31", "2026-02-28", 1, 0], ["2026-01-31", "2026-03-01", 1, 1],
 ["2026-03-15", "2026-03-20", 0, 5], ["2025-02-28", "2026-02-28", 12, 0]].forEach(function (k) {
  var a = G.ayGun(k[0], k[1]);
  gecer("ay-gün " + k[0] + "→" + k[1], a.ay === k[2] && a.gun === k[3], a.ay + " ay " + a.gun + " gün");
});

/* Tek dönem */
var t = G.hesapla({ tutar: 100000, vade: "2026-01-10", odeme: "2026-03-25" });
gecer("tek dönem: 100.000 × %3,7 × 2,5 ay = 9.250", yakin(t.zam, 9250), String(t.zam));
gecer("tek dönemde bir satır", t.donemler.length === 1 && t.donemler[0].oran === 0.037);
gecer("toplam borç", yakin(t.toplam, 109250));

/* Değişiklik günü: 13.11.2025'ten itibaren %3,7 */
var d = G.hesapla({ tutar: 100000, vade: "2025-10-01", odeme: "2025-12-01" });
var bek = 100000 * (0.045 * (1 + 11 / 30) + 0.037 * (19 / 30));
gecer("iki dönem: 1 ay 11 gün %4,5 + 19 gün %3,7", yakin(d.zam, Math.round(bek * 100) / 100), d.zam + " / " + bek);
gecer("ilk dönem 12.11.2025'te biter", d.donemler[0].son === "2025-11-12" && d.donemler[1].bas === "2025-11-13");
var bir = G.hesapla({ tutar: 100000, vade: "2025-11-12", odeme: "2025-11-13" });
gecer("değişiklik günü yeni oranla işler", bir.donemler.length === 1 && bir.donemler[0].oran === 0.037 && yakin(bir.zam, 100000 * 0.037 / 30));
var once = G.hesapla({ tutar: 100000, vade: "2025-11-11", odeme: "2025-11-12" });
gecer("değişiklikten önceki gün eski oranla", once.donemler[0].oran === 0.045);

/* Uzun dönem: bütün sınırlar; gün toplamı tutarlı */
var u = G.hesapla({ tutar: 50000, vade: "2019-01-15", odeme: "2026-09-25" });
gecer("uzun dönemde sekiz oran dönemi (2,0 → 2,5 → 2,0 → 1,6 → 2,5 → 3,5 → 4,5 → 3,7)", u.donemler.length === 8, String(u.donemler.length));
gecer("dönemler kesintisiz", u.donemler.every(function (x, i) {
  if (i === 0) return true;
  var onceki = new Date(u.donemler[i - 1].son + "T00:00:00Z");
  return new Date(x.bas + "T00:00:00Z") - onceki === 86400000;
}));
gecer("zam dönem zamlarının toplamı", yakin(u.zam, Math.round(u.donemler.reduce(function (s, x) { return s + x.zam; }, 0) * 100) / 100));
gecer("her dönem kendi oranıyla", u.donemler.every(function (x) {
  var o = null; G.ORANLAR.forEach(function (r) { if (r.bas <= x.bas) o = r.oran; }); return o === x.oran;
}));
gecer("zam anaparayla orantılı", yakin(G.hesapla({ tutar: 100000, vade: "2019-01-15", odeme: "2026-09-25" }).zam, 2 * u.zam, 0.02));

/* Alt sınır ve sınır durumları */
gecer("1 TL alt sınırı", G.hesapla({ tutar: 10, vade: "2026-01-10", odeme: "2026-01-11" }).zam === 1);
gecer("vadesinde ödemede zam yok", G.hesapla({ tutar: 1000, vade: "2026-01-10", odeme: "2026-01-10" }).zam === 0);
gecer("vadeden önce ödemede zam yok", G.hesapla({ tutar: 1000, vade: "2026-01-10", odeme: "2026-01-01" }).zam === 0);

/* Hatalı girdi */
gecer("tutar 0", atar(function () { G.hesapla({ tutar: 0, vade: "2026-01-01", odeme: "2026-02-01" }); }));
gecer("geçersiz tarih", atar(function () { G.hesapla({ tutar: 1, vade: "2026-02-30", odeme: "2026-03-01" }); }));
gecer("tablo öncesi vade", atar(function () { G.hesapla({ tutar: 1, vade: "2010-01-01", odeme: "2011-01-01" }); }));

console.log(gecen + " geçti, " + kalan + " kaldı. (gecikme zammı)");
process.exit(kalan ? 1 : 0);
