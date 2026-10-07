/*
 * "Türkiye'de sosyal güvenliğin dönüşümü" yazısının hesabı.
 *
 * Model sigortalı: 20. yaş gününde 4/a (hizmet akdiyle) ilk kez sigortalı
 * olur ve hiç ara vermeden yılda 360 gün prim öder. Yazı, bu kişinin
 * BUGÜNKÜ kanunla ne zaman tam yaşlılık aylığına hak kazandığını ve
 * aylığının kazancına hangi oranda bağlandığını, ilk giriş yılına göre ölçer.
 *
 * Kurallar sitenin test edilmiş iki çekirdeğinden okunur, burada yasal sayı
 * yazılmaz:
 *   - ne-zaman-emekli-olurum/hesap.js: 506 Geçici m.81/B (ve EYT öncesi yaş
 *     sütunu), 5510 Geçici m.95, Geçici m.9, m.28/2 kademeleri;
 *   - bordro/emeklilik-parametreleri.js ve emeklilik-motor.js: 506 Geçici
 *     m.82 ve 5510 m.29 aylık bağlama oranları, Geçici m.2 kısmî aylık.
 * Nüfus göstergeleri dunya-bankasi-2026-10.json anlık görüntüsünden.
 */
"use strict";

var path = require("path");
var KOK = path.join(__dirname, "..", "..");
var N = require(path.join(KOK, "ne-zaman-emekli-olurum", "hesap.js"));
var P = require(path.join(KOK, "bordro", "emeklilik-parametreleri.js"));
var M = require(path.join(KOK, "bordro", "emeklilik-motor.js"));
var DB = require("./dunya-bankasi-2026-10.json");

var BASLAMA_YASI = 20;
var YILLIK_GUN = 360;
var YILLAR = [];
for (var y = 1985; y <= 2025; y++) YILLAR.push(y);

function yasFarki(a, b) {             // tam yıl + kesir (gün/365,2425)
  return (Date.parse(b) - Date.parse(a)) / (365.2425 * 864e5);
}

/* Model sigortalı: giriş tarihi verilir, doğum = 20 yıl önce. */
function kisi(giris, cinsiyet) {
  var dogum = (+giris.slice(0, 4) - BASLAMA_YASI) + giris.slice(4);
  var r = N.hesapla({ cinsiyet: cinsiyet, statu: "4a", dogum: dogum, ilkGiris: giris,
    primGun: 0, yillikGun: YILLIK_GUN, bugun: giris });
  var tam = r.yollar.filter(function (x) { return x.kod === "tam"; })[0];
  var sonuc = { giris: giris, cinsiyet: cinsiyet, grup: r.grup, tarih: tam.tarih,
    yas: Math.round(yasFarki(dogum, tam.tarih) * 100) / 100,
    calisma: Math.round(yasFarki(giris, tam.tarih) * 100) / 100, dayanak: tam.dayanak };
  sonuc.primGun = Math.round(sonuc.calisma * YILLIK_GUN);
  /* EYT öncesi (2 Mart 2023'e kadar) aynı kişi: 81/B satırının yaş sütunu da
     şarttı. Hak tarihi = bugünkü şartların ve o yaşın en geç dolanı. */
  if (r.grup === "eyt" && tam.eytOncesiYas) {
    var yasTarihi = (+dogum.slice(0, 4) + tam.eytOncesiYas) + dogum.slice(4);
    var once = yasTarihi > tam.tarih ? yasTarihi : tam.tarih;
    sonuc.eytOncesi = { yas: Math.round(yasFarki(dogum, once) * 100) / 100, tarih: once, satirYasi: tam.eytOncesiYas };
  }
  return sonuc;
}

function seri(cinsiyet) {
  return YILLAR.map(function (y) { return kisi(y + "-01-01", cinsiyet); });
}

/* Eşiklerin iki yanı: bir gün fark, bütün kural farkı. */
function esikler(cinsiyet) {
  return {
    eyt: [kisi("1999-09-07", cinsiyet), kisi("1999-09-08", cinsiyet)],
    yeni: [kisi("2008-04-30", cinsiyet), kisi("2008-05-01", cinsiyet)]
  };
}

/* Aynı prim günü, iki kural: aylık bağlama oranı. */
function abo(gun) {
  return { gun: gun, gecici82: P.aboHesapla(P.abo.gecici82, gun), m29: P.aboHesapla(P.abo.m29, gun) };
}
var ABO_GUNLERI = [3600, 5400, 7200, 9000, 10800];

/* Model sigortalının hak tarihindeki fiili ABO'su (2000 ve sonrası
   girişler): emeklilik motorunun kısmî aylık yöntemiyle, kazanç = 1.
   2000 öncesi hizmet gösterge sistemine düştüğü için hesaplanmaz. */
function fiiliAbo(k) {
  if (k.giris < "2000-01-01") return null;
  var r = M.hesapla({ primGun: k.primGun, ortalamaKazanc: 1, baslangic: k.giris, bitis: k.tarih });
  if (r.hata) return null;
  return r.satirlar.reduce(function (t, s) { return t + s.kismiAylik; }, 0);
}

function nufus(kod, yil) {
  var s = DB[kod].seri.filter(function (x) { return x[0] === yil; })[0];
  return s ? s[1] : null;
}

module.exports = {
  N: N, P: P, M: M, DB: DB, BASLAMA_YASI: BASLAMA_YASI, YILLIK_GUN: YILLIK_GUN, YILLAR: YILLAR,
  kisi: kisi, seri: seri, esikler: esikler, abo: abo, ABO_GUNLERI: ABO_GUNLERI, fiiliAbo: fiiliAbo, nufus: nufus
};
