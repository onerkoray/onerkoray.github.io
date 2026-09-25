#!/usr/bin/env node
/*
 * TL mi döviz mi — başabaş kur regresyon testleri.
 *
 * Özdeşlikler sınanır:
 *   - başabaş kurda iki yol vade sonunda aynı TL'yi verir
 *   - gereken artış anaparadan ve bugünkü kurdan bağımsızdır
 *   - iki faiz sıfırsa başabaş kur bugünkü kurdur
 *   - stopaj eşikleri mevduat aracıyla aynı (kurallar.js)
 *   - aynı brüt faizde döviz yolu yine de kur artışı ister (stopaj asimetrisi)
 *
 * Kullanım: node finans/doviz-basabas-test.js
 */
"use strict";

var path = require("path");
var D = require(path.join(__dirname, "doviz-basabas.js"));
var F = require(path.join(__dirname, "kurallar.js"));

var gecen = 0, kalan = 0;
function gecer(ad, kosul, detay) {
  if (kosul) { gecen++; return; }
  kalan++;
  console.log("  BAŞARISIZ: " + ad + (detay ? "  — " + detay : ""));
}
function yakin(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function atar(fn) { try { fn(); return false; } catch (e) { return true; } }

var G = { anapara: 1000000, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85 };
var r = D.hesapla(G);

/* Tanımlar */
gecer("başabaşta iki yol eşit", yakin(r.doviz.vadeSonu * r.basabasKur, r.tl.vadeSonu, 1e-6));
gecer("gereken artış tanımı", yakin(r.basabasKur, G.kur * (1 + r.gerekenArtis), 1e-9));
gecer("yıllık bileşik", yakin(Math.pow(1 + r.yillikArtis, G.gun / 365), 1 + r.gerekenArtis, 1e-12));
gecer("döviz anaparası = TL ÷ kur", yakin(r.doviz.anapara, G.anapara / G.kur));

/* Mevduat aracıyla aynı hesap */
var m = F.mevduat(G.anapara, G.tlFaiz, G.gun, "2026-01-01", "tl");
gecer("TL vade sonu mevduat aracından", yakin(r.tl.vadeSonu, m.maturity));
gecer("TL brüt faiz basit faiz", yakin(r.tl.brut, G.anapara * 0.37 * 32 / 365, 1e-6));
gecer("32 gün TL stopajı %17,5", r.tl.stopajOrani === 0.175);
gecer("döviz stopajı %25", r.doviz.stopajOrani === 0.25);
gecer("TL net = brüt × 0,825", yakin(r.tl.net, r.tl.brut * 0.825, 1e-6));
gecer("döviz net = brüt × 0,75", yakin(r.doviz.net, r.doviz.brut * 0.75, 1e-9));

/* Ölçekten bağımsızlık */
[[1e4, 30], [5e6, 12.3], [123456, 100]].forEach(function (k) {
  var x = D.hesapla({ anapara: k[0], tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: k[1] });
  gecer("artış anaparadan/kurdan bağımsız " + k.join("/"), yakin(x.gerekenArtis, r.gerekenArtis, 1e-12));
  gecer("başabaş kurla orantılı " + k.join("/"), yakin(x.basabasKur / k[1], r.basabasKur / G.kur, 1e-12));
});

/* Sıfır faiz */
var s = D.hesapla({ anapara: 1000, tlFaiz: 0, dovizFaiz: 0, gun: 90, kur: 40 });
gecer("sıfır faizde başabaş = bugünkü kur", yakin(s.basabasKur, 40, 1e-12) && yakin(s.gerekenArtis, 0, 1e-15));

/* Stopaj asimetrisi: aynı brüt oran, döviz yolu yine de artış ister */
[32, 92, 181, 365, 730].forEach(function (gun) {
  var e = D.hesapla({ anapara: 1e6, tlFaiz: 10, dovizFaiz: 10, gun: gun, kur: 1 });
  gecer("eşit brütte döviz artış ister " + gun, e.gerekenArtis > 0);
  gecer("eşit brütte TL neti yüksek " + gun, e.tl.netGetiri > e.doviz.netGetiri);
});

/* Stopaj eşikleri (başlangıç 2026-01-01: 6 ay = 181 gün, 12 ay = 365 gün) */
var v = D.vadeler(G, [181, 182, 365, 366]);
gecer("181 gün %17,5", v[0].stopajTl === 0.175);
gecer("182 gün %15", v[1].stopajTl === 0.15);
gecer("365 gün %15", v[2].stopajTl === 0.15);
gecer("366 gün %10", v[3].stopajTl === 0.10);
gecer("vadeler hesapla ile aynı", yakin(D.vadeler(G, [32])[0].gerekenArtis, r.gerekenArtis));
gecer("stopajOraniGun ile aynı", [32, 181, 182, 365, 366, 730].every(function (g) {
  return D.vadeler(G, [g])[0].stopajTl * 100 === F.stopajOraniGun(g, "tl");
}));

/* Yön: TL faizi artınca gereken artış büyür, döviz faizi artınca küçülür */
var a = D.hesapla({ anapara: 1e6, tlFaiz: 45, dovizFaiz: 1, gun: 32, kur: 48.85 });
var b = D.hesapla({ anapara: 1e6, tlFaiz: 37, dovizFaiz: 3, gun: 32, kur: 48.85 });
gecer("TL faizi yükselince artış büyür", a.gerekenArtis > r.gerekenArtis);
gecer("döviz faizi yükselince artış küçülür", b.gerekenArtis < r.gerekenArtis);

/* Senaryo */
var sc = D.senaryo(G, [0, r.gerekenArtis, 0.05, -0.02]);
gecer("kur sabitse TL kazanır", sc[0].kazanan === "tl" && sc[0].fark < 0);
gecer("başabaş artışta fark sıfır", yakin(sc[1].fark, 0, 1e-6));
gecer("%5 artışta döviz kazanır (32 gün)", sc[2].kazanan === "doviz");
gecer("kur düşerse TL kazanır", sc[3].kazanan === "tl");
gecer("senaryo TL karşılığı", yakin(sc[2].dovizTl, r.doviz.vadeSonu * G.kur * 1.05, 1e-6));

/* Kur makası: başabaş kur 1 / (1 − makas) katına çıkar */
var mk = D.hesapla({ anapara: 1e6, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85, makas: 0.01 });
gecer("makas başabaşı 1/(1−m) katına çıkarır", yakin(mk.basabasKur, r.basabasKur / 0.99, 1e-9));
gecer("makas TL yolunu değiştirmez", yakin(mk.tl.vadeSonu, r.tl.vadeSonu));
var mks = D.senaryo({ anapara: 1e6, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48.85, makas: 0.01 }, [mk.gerekenArtis]);
gecer("makaslı başabaşta fark sıfır", yakin(mks[0].fark, 0, 1e-6));
gecer("makas %20 reddedilir", atar(function () { D.hesapla({ anapara: 1, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48, makas: 0.2 }); }));

/* Hatalı girdi */
gecer("anapara 0 reddedilir", atar(function () { D.hesapla({ anapara: 0, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 48 }); }));
gecer("kur 0 reddedilir", atar(function () { D.hesapla({ anapara: 1, tlFaiz: 37, dovizFaiz: 1, gun: 32, kur: 0 }); }));
gecer("negatif faiz reddedilir", atar(function () { D.hesapla({ anapara: 1, tlFaiz: -1, dovizFaiz: 1, gun: 32, kur: 48 }); }));
gecer("vade 0 reddedilir", atar(function () { D.hesapla({ anapara: 1, tlFaiz: 37, dovizFaiz: 1, gun: 0, kur: 48 }); }));
gecer("vade 3651 reddedilir", atar(function () { D.hesapla({ anapara: 1, tlFaiz: 37, dovizFaiz: 1, gun: 3651, kur: 48 }); }));

console.log("doviz-basabas: " + gecen + " geçti, " + kalan + " kaldı");
process.exit(kalan ? 1 : 0);
