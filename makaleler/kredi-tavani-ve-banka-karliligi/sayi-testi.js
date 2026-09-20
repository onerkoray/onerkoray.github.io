#!/usr/bin/env node
/*
 * "Kredi tavanı tutuyor mu?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR — VE BU YAZIDA FARKLI
 * -------------------------------
 * Sitedeki diğer yazıların sayıları sitenin kendi motorlarından türüyor.
 * Buradaki ham gözlemler DIŞARIDAN geliyor (BDDK, TCMB, TÜİK) ve
 * yayımlanmış bir çalışmanın tablolarında duruyor. Dolayısıyla test iki
 * ayrı iş yapıyor:
 *
 *   1. Yazının tabloları modülle aynı mı? (her yazıda olduğu gibi)
 *   2. Modülün türettiği değerler, ÇALIŞMANIN yayımladığı değerlerle
 *      aynı mı? Yani çalışmanın aritmetiği bağımsız olarak yeniden
 *      üretiliyor mu?
 *
 * İkincisi olmasa modül, çalışmanın sonuçlarını kopyalamış olurdu.
 *
 * YUVARLAMA PAYI AÇIKÇA TANINIYOR
 * -------------------------------
 * Çalışmanın girdileri yuvarlanmış yayımlanıyor (ör. özkaynak kârlılığı
 * "23,2"). Yuvarlanmış girdiden türetilen sonuç, yayımlanan sonuçtan en
 * çok 0,02 puan ayrılabiliyor. Test bu payı bir SABİT olarak taşıyor;
 * payı büyütmek gerekirse bu bilinçli bir karar olur, sessiz bir gevşeme
 * değil.
 *
 * DÖRT ÖNERME
 * -----------
 * Ö1. Reel kârlılık, elimizdeki YEDİ yılın yedisinde de negatif.
 *     KONTROL: hesabın gerçekten değiştiği ölçülüyor — hep aynı sayıyı
 *     döndüren bir fonksiyon da "hepsi negatif" iddiasını geçirirdi.
 *
 * Ö2. Sekiz haftalık sınır, yıllığa (1+g)^(52/8) ile çevriliyor.
 *     KONTROL: yanlış üs kullanılırsa çalışmanın tavanları tutmamalı.
 *
 * Ö3. REGÜLASYON TAKOZU: gerçekleşen büyüme, tavanların EN YÜKSEĞİNİ de
 *     aşıyor. Yazının merkezî iddiası bu.
 *     KONTROL: "aşıyor" iddiası, tavanlar sıfır olsaydı da geçerdi;
 *     tavanların gerçekten hesaplandığı ayrıca ölçülüyor.
 *
 * Ö4. Marjı belirleyen seviye değil değişim: Nisan 2026'da faiz Eylül
 *     2025'ten düşükken marj daraldı.
 *
 * Kullanım: node makaleler/kredi-tavani-ve-banka-karliligi/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var B = require(path.join(__dirname, "banka.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

/* Yuvarlanmış girdiden türetmenin yayımlanan sonuçtan ayrılabileceği
   azami pay (puan). */
var YUVARLAMA_PAYI = 0.02;

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
function y1(o) { return (o * 100).toFixed(1).replace(".", ","); }
function y2(o) { return (o * 100).toFixed(2).replace(".", ","); }
function yakin(a, b, tol) {
  if (!isFinite(a) || !isFinite(b)) return false;
  return Math.abs(a - b) <= tol;
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

console.log("Kredi tavanı yazısı — sayı denetimi\n");

/* ---------------------------------------------------------------- 1
   ÇALIŞMANIN YAYIMLADIĞI DEĞERLER yeniden üretiliyor mu? */
var YAYIN_REEL_FAIZ = [-16.23, -33.65, -13.52, 2.16, 5.43, 4.17];
B.POLITIKA.forEach(function (p, i) {
  var o = B.reelPolitikaFaizi(i) * 100;
  gecer(p.donem + ": reel faiz " + YAYIN_REEL_FAIZ[i],
    yakin(o, YAYIN_REEL_FAIZ[i], YUVARLAMA_PAYI), "ölçülen " + o.toFixed(2));
});

var YAYIN_REEL_KAR = [-3.58, -16.23, -14.59, -18.37, -12.38, -2.82, -6.30];
B.KARLILIK.forEach(function (k, i) {
  var o = B.reelKarlilik(i) * 100;
  gecer(k.yil + ": reel kârlılık " + YAYIN_REEL_KAR[i],
    yakin(o, YAYIN_REEL_KAR[i], YUVARLAMA_PAYI), "ölçülen " + o.toFixed(2));
});

/* Ö2 — tavan çevrimi. */
var YAYIN_TAVAN = { 4.0: 29.0, 3.0: 21.2, 2.0: 13.7, 1.0: 6.7, 5.0: 37.3, 4.5: 33.1 };
Object.keys(YAYIN_TAVAN).forEach(function (g) {
  var o = B.yillikTavan(Number(g)) * 100;
  gecer("sekiz haftalık %" + g + " -> yıllık %" + YAYIN_TAVAN[g],
    yakin(o, YAYIN_TAVAN[g], 0.05), "ölçülen " + o.toFixed(2));
});
gecer("dönem katı 52/8", yakin(B.DONEM_KATI, 6.5, 1e-12));

/* KONTROL: yanlış üs kullanılsaydı çalışmanın tavanları TUTMAMALI. */
(function () {
  var yanlis = Math.pow(1 + 0.03, 12) - 1;   /* aylıkmış gibi */
  gecer("yanlış üs çalışmanın tavanını vermiyor",
    !yakin(yanlis * 100, 21.2, 0.05), (yanlis * 100).toFixed(2));
})();

/* Yıllandırma. */
gecer("kredi yıllandırılmış %34,2",
  yakin(B.krediBuyumesi().nominal * 100, 34.2, 0.05),
  (B.krediBuyumesi().nominal * 100).toFixed(2));
gecer("reel kredi büyümesi ~%2,0",
  yakin(B.krediBuyumesi().reel * 100, 2.0, 0.1),
  (B.krediBuyumesi().reel * 100).toFixed(2));
gecer("takibe dönüşüm 1,53 katı",
  yakin(B.takipKati(), 1.53, 0.005), B.takipKati().toFixed(3));

/* ---------------------------------------------------------------- 2
   Ö1 — reel kârlılık her yıl negatif. */
(function () {
  var hepsi = B.KARLILIK.every(function (k, i) { return B.reelKarlilik(i) < 0; });
  gecer("reel kârlılık yedi yılın yedisinde de negatif", hepsi);
  gecer("yedi yıl var", B.KARLILIK.length === 7, String(B.KARLILIK.length));
  /* KONTROL: hep aynı sayıyı döndüren bir hesap da bu iddiayı geçirirdi.
     Değerlerin gerçekten değiştiği ölçülüyor. */
  var d = B.KARLILIK.map(function (k, i) { return B.reelKarlilik(i); });
  gecer("reel kârlılık yıldan yıla gerçekten değişiyor",
    Math.max.apply(null, d) - Math.min.apply(null, d) > 0.10,
    d.map(function (x) { return y2(x); }).join(" / "));
  /* 2026'da açık ENFLASYONDAN değil kârlılıktan genişliyor. */
  var i25 = 5, i26 = 6;
  gecer("2026'da enflasyon sınırlı yükseldi",
    B.KARLILIK[i26].tufe - B.KARLILIK[i25].tufe < 1,
    String(B.KARLILIK[i26].tufe - B.KARLILIK[i25].tufe));
  gecer("2026'da kârlılık belirgin geriledi",
    B.KARLILIK[i25].ok - B.KARLILIK[i26].ok > 3);
  gecer("2026'da reel açık genişledi",
    B.reelKarlilik(i26) < B.reelKarlilik(i25));
})();

/* ---------------------------------------------------------------- 3
   Ö3 — REGÜLASYON TAKOZU. */
(function () {
  var t = B.takoz();
  gecer("gerçekleşme en yüksek tavanı aşıyor", t.ustSiniriAsiyor === true,
    y1(t.gerceklesen) + " vs " + y1(t.enYuksek));
  gecer("tavan aralığı %6,7 – %33,1",
    yakin(t.enDusuk * 100, 6.7, 0.05) && yakin(t.enYuksek * 100, 33.1, 0.05),
    y1(t.enDusuk) + " – " + y1(t.enYuksek));
  gecer("aşım yaklaşık bir puan", yakin(t.fark * 100, 1.0, 0.15), y1(t.fark));
  /* KONTROL: "aşıyor" iddiası tavanlar sıfır olsaydı da geçerdi.
     Tavanların gerçekten hesaplandığı ve sıralandığı ölçülüyor. */
  gecer("en düşük tavan sıfırdan büyük", t.enDusuk > 0);
  gecer("tavanlar birbirinden farklı", t.enYuksek > t.enDusuk * 2);
  /* Ve gerçekleşme, her bir tavanın ayrı ayrı üstünde olmalı. */
  var hepsininUstunde = B.SINIRLAR.every(function (s) {
    return t.gerceklesen > B.yillikTavan(s.sonra);
  });
  gecer("gerçekleşme her tavanın ayrı ayrı üstünde", hepsininUstunde);

  /* KONTROL: bayrak EN YÜKSEK tavanla mı karşılaştırılıyor?
     "gerçekleşen > en düşük tavan" da bugün true döner, dolayısıyla
     yukarıdaki iddia yanlış karşılaştırmayı AYIRT ETMEZ. Gerçekleşmeyi
     iki tavanın ARASINA düşürüp bayrağın söndüğü ölçülüyor. */
  var kredi = B.kalem("Krediler");
  var gercekBuyume = kredi.buyume;
  var arada;
  try {
    /* Yıllandırılmış büyümeyi ~%20'ye indiren yedi aylık büyüme:
       en düşük (%6,7) ile en yüksek (%33,1) tavanın arasında. */
    kredi.buyume = 11.3;
    arada = B.takoz();
  } finally {
    kredi.buyume = gercekBuyume;
  }
  gecer("ara değer iki tavanın arasında",
    arada.gerceklesen > arada.enDusuk && arada.gerceklesen < arada.enYuksek,
    y1(arada.gerceklesen));
  gecer("ara değerde bayrak sönüyor", arada.ustSiniriAsiyor === false);
  gecer("kredi verisi geri konuldu", B.kalem("Krediler").buyume === gercekBuyume);
})();

/* ---------------------------------------------------------------- 4
   Ö4 — seviye değil değişim. */
(function () {
  var m = B.MARJ;
  gecer("Eylül 2025'te marj genişledi", m.eylul2025.degisimBp > 0);
  gecer("Nisan 2026'da marj daraldı", m.nisan2026.degisimBp < 0);
  gecer("Nisan 2026 makası 230 baz puan geriledi",
    yakin((m.nisan2026.makasOnce - m.nisan2026.makasSonra) * 100, 230, 1),
    String((m.nisan2026.makasOnce - m.nisan2026.makasSonra) * 100));
  /* Faiz Nisan 2026'da Eylül 2025'ten DÜŞÜK: seviye hipotezi marjın
     genişlemesini beklerdi. */
  var ara2025 = B.POLITIKA[4].faiz, agu2026 = B.POLITIKA[5].faiz;
  gecer("2026 faizi 2025 sonundan düşük", agu2026 < ara2025,
    agu2026 + " < " + ara2025);
})();

/* ---------------------------------------------------------------- 5
   Tablolar modülle aynı mı? */
(function () {
  var s = tabloSatirlari("Politika faizi, enflasyon ve ex-post reel politika faizi");
  gecer("rejim tablosu okunabildi", s && s.length === B.POLITIKA.length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== B.POLITIKA.length) return;
  s.forEach(function (r, i) {
    gecer(B.POLITIKA[i].donem + ": tablo dönemi doğru",
      r[0] === B.POLITIKA[i].donem, r[0]);
    var beklenen = (B.reelPolitikaFaizi(i) < 0 ? "−" : "+") + "%" +
      y2(Math.abs(B.reelPolitikaFaizi(i)));
    gecer(B.POLITIKA[i].donem + ": tablodaki reel faiz modülle aynı",
      r[3] === beklenen, r[3] + " vs " + beklenen);
  });
})();

(function () {
  var s = tabloSatirlari("Özkaynak kârlılığı, enflasyon ve reel özkaynak kârlılığı");
  gecer("kârlılık tablosu okunabildi", s && s.length === B.KARLILIK.length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== B.KARLILIK.length) return;
  s.forEach(function (r, i) {
    var beklenen = (B.reelKarlilik(i) < 0 ? "−" : "+") + "%" +
      y2(Math.abs(B.reelKarlilik(i)));
    gecer(B.KARLILIK[i].yil + ": tablodaki reel kârlılık modülle aynı",
      r[3] === beklenen, r[3] + " vs " + beklenen);
  });
  /* Bütün satırlar eksi işaretli olmalı — Ö1'in tablodaki karşılığı. */
  gecer("tablodaki her reel kârlılık negatif",
    s.every(function (r) { return r[3].indexOf("−") === 0; }));
})();

(function () {
  var s = tabloSatirlari("Sekiz haftalık kredi büyüme sınırları");
  gecer("tavan tablosu okunabildi", s && s.length === B.SINIRLAR.length + 1,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== B.SINIRLAR.length + 1) return;
  B.SINIRLAR.forEach(function (x, i) {
    gecer(x.tur + ": tablodaki yıllık tavan modülle aynı",
      s[i][4] === "%" + y1(B.yillikTavan(x.sonra)), s[i][4]);
  });
  var son = s[s.length - 1];
  gecer("son satır gerçekleşmeyi gösteriyor",
    son[0].indexOf("Gerçekleşen") === 0, son[0]);
  gecer("gerçekleşme hücresi modülle aynı",
    son[son.length - 1] === "%" + y1(B.takoz().gerceklesen),
    son[son.length - 1]);
})();

(function () {
  var s = tabloSatirlari("Kredilerin takibe dönüşüm oranı");
  gecer("takip tablosu okunabildi", s && s.length === B.TAKIP.length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== B.TAKIP.length) return;
  var ilk = B.TAKIP[0].oran;
  s.forEach(function (r, i) {
    gecer(B.TAKIP[i].donem + ": kat hücresi modülle aynı",
      r[2] === (B.TAKIP[i].oran / ilk).toFixed(2).replace(".", ",") + "×", r[2]);
  });
})();

/* ---------------------------------------------------------------- 6
   Nesirdeki sayılar. Varlık kontrolü yetmiyor: bu oranlar tablolarda da
   geçiyor, dolayısıyla nesre özgü <strong> biçimiyle aranıyor. */
gecsin("takoz aralığı nesirde", "<strong>%6,7 – %33,1</strong>");
gecsin("gerçekleşme nesirde", "<strong>%34,2</strong>");
gecsin("2026 reel kârlılığı nesirde", "<strong>−%6,32</strong>");
gecsin("makas gerilemesi nesirde", "<strong>230 baz puan</strong>");
gecsin("takip katı nesirde", "<strong>1,53 katına</strong>");
gecsin("regülasyon takozu adı geçiyor", "regülasyon takozu");
/* VARLIK YETMIYOR: DOI sayfada birden fazla yerde geciyor (semada,
   karar kutusunda, kaynaklarda). Birini bozmak varlik kontrolunu
   dusurmezdi -- mutasyon testi bunu gosterdi. */
tamKez("DOI sayfada tam beş kez", "10.5281/zenodo.22852342", 5);
gecsin("çalışma CC BY 4.0 olarak anılıyor", "CC BY 4.0");
gecsin("yuvarlama payı açıkça yazılmış", "0,02 puan");

/* Yayımlanan ve türetilen değer arasındaki farkı yazı ITIRAF EDIYOR mu? */
gecsin("2026 farkı nesirde açıklanmış", "çalışmada −%6,30");

/* Formül bir kez yazılmalı: iki kez yazılırsa biri bayatlar. */
tamKez("tavan formülü bir kez", "(1 + g)<sup>6,5</sup> − 1", 1);

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
