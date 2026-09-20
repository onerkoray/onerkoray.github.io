#!/usr/bin/env node
/*
 * "Tasarruf kimde, finansman kimde?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Ham gözlemler dışarıdan (OECD, TÜİK, TCMB) ve yayımlanmış bir
 * çalışmanın tablolarından geliyor. Test iki iş yapıyor: yazının
 * tabloları modülle aynı mı, VE modülün türettikleri çalışmanın
 * yayımladıklarıyla aynı mı. İkincisi olmasa modül çalışmanın
 * sonuçlarını kopyalamış olurdu.
 *
 * ÜÇ ÖNERME
 * ---------
 * Ö1. Tasarrufun en büyük payı HANELERDE DEĞİL şirketlerde.
 *     KONTROL: "en büyük" iddiası sıralama yapılmadan da geçebilirdi;
 *     sıralamanın gerçekten yapıldığı ölçülüyor.
 *
 * Ö2. Aynı fiyat artışı iki gelir grubunu aynı ölçüde etkilemiyor, ve
 *     etkinin ORANI paylara eşit.
 *     KONTROL: sepet artışı / fiyat artışı oranı, payın kendisine eşit
 *     olmalı — hesap gerçekten pay × fiyat mı?
 *
 * Ö3. KOBİ kredisi nominal büyürken reel küçülüyor; reel daralma
 *     toplam işletme kredilerinden DAHA DERİN.
 *     KONTROL: iki reel değerin işaretinin aynı ama büyüklüğünün farklı
 *     olduğu ayrıca ölçülüyor.
 *
 * İKİ FARKI KARIŞTIRMA
 * --------------------
 * PAY farkı 28,7 puan (bileşim), MALİYET farkı 2,87 puan (%10
 * senaryosunun sonucu). Test ikisini ayrı ayrı bağlıyor; yazıda da ayrı
 * cümlelerde geçiyorlar.
 *
 * Kullanım: node makaleler/tasarruf-kimde-finansman-kimde/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var H = require(path.join(__dirname, "harita.js"));
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
function y1(n) { return n.toFixed(1).replace(".", ","); }
function y2(n) { return n.toFixed(2).replace(".", ","); }
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

console.log("Tasarruf-finansman yazısı — sayı denetimi\n");

/* ---------------------------------------------------------------- 1
   ÇALIŞMANIN YAYIMLADIĞI DEĞERLER yeniden üretiliyor mu? */
gecer("KOBİ 2024 nominal %33,62",
  yakin(H.nominalBuyume(2024, "kobi") * 100, 33.62, 0.01),
  (H.nominalBuyume(2024, "kobi") * 100).toFixed(3));
gecer("KOBİ 2024 reel −%7,45",
  yakin(H.reelBuyume(2024, "kobi") * 100, -7.45, 0.01),
  (H.reelBuyume(2024, "kobi") * 100).toFixed(3));
gecer("toplam işletme 2024 reel −%6,03",
  yakin(H.reelBuyume(2024, "toplam") * 100, -6.03, 0.01),
  (H.reelBuyume(2024, "toplam") * 100).toFixed(3));

[[2022, 33.59], [2023, 35.71], [2024, 35.17]].forEach(function (x) {
  gecer(x[0] + ": KOBİ payı %" + x[1],
    yakin(H.kobiPayi(x[0]) * 100, x[1], 0.01),
    (H.kobiPayi(x[0]) * 100).toFixed(3));
});

[[5, 3.18, 1.75], [10, 6.36, 3.49], [20, 12.72, 6.98]].forEach(function (x) {
  gecer("%" + x[0] + " senaryosu — alt grup %" + x[1],
    yakin(H.sepetArtisi("alt", x[0]) * 100, x[1], 0.005));
  gecer("%" + x[0] + " senaryosu — üst grup %" + x[2],
    yakin(H.sepetArtisi("ust", x[0]) * 100, x[2], 0.005));
});
gecer("%10 senaryosunda fark 2,87 puan",
  yakin(H.sepetFarki(10) * 100, 2.87, 0.005),
  (H.sepetFarki(10) * 100).toFixed(3));
gecer("pay farkı 28,7 puan",
  yakin(H.payFarki() * 100, 28.7, 0.05), (H.payFarki() * 100).toFixed(2));

/* Yuvarlama notu: bileşenler 30,0, yayımlanan toplam 30,1. */
gecer("bileşenlerin toplamı 30,0",
  yakin(H.tasarrufBilesenToplami(), 30.0, 0.01),
  H.tasarrufBilesenToplami().toFixed(2));
gecer("yayımlanan toplam 30,1", H.TASARRUF_YAYIN_TOPLAM === 30.1);
gecer("ikisi birbirinden farklı",
  H.tasarrufBilesenToplami() !== H.TASARRUF_YAYIN_TOPLAM);

/* ---------------------------------------------------------------- 2
   Ö1 — tasarrufun ağırlığı şirketlerde. */
(function () {
  var e = H.enBuyukTasarrufcu();
  gecer("en büyük tasarrufçu mali olmayan şirketler",
    e.sektor === "Mali olmayan şirketler", e.sektor);
  var hane = H.TASARRUF.filter(function (t) {
    return t.sektor === "Hanehalkı";
  })[0];
  gecer("şirket payı hanehalkının iki katından fazla",
    e.oran > hane.oran * 2, e.oran + " vs " + hane.oran);
  /* KONTROL: "en büyük" iddiası sıralama yapılmadan da geçebilirdi —
     dizinin ilk elemanı zaten şirketler. Sıralamanın gerçekten
     çalıştığı, diziyi ters çevirerek ölçülüyor. */
  var yedek = H.TASARRUF.slice();
  var tersi;
  try {
    H.TASARRUF.reverse();
    tersi = H.enBuyukTasarrufcu();
  } finally {
    H.TASARRUF.length = 0;
    yedek.forEach(function (x) { H.TASARRUF.push(x); });
  }
  gecer("sıra değişse de en büyük aynı kalıyor",
    tersi.sektor === "Mali olmayan şirketler", tersi.sektor);
  gecer("dizi geri konuldu", H.TASARRUF[0].sektor === "Mali olmayan şirketler");

  /* GSYH'ye oran ile hanenin KENDİ tasarruf oranı ayrı büyüklükler. */
  gecer("hane GSYH payı ile kendi oranı farklı",
    hane.oran !== H.HANE_TASARRUF_ORANI[2024]);
  gecer("hanenin kendi oranı 2024'te 11,3",
    H.HANE_TASARRUF_ORANI[2024] === 11.3);
})();

/* ---------------------------------------------------------------- 3
   Ö2 — sepet hesabı gerçekten pay × fiyat mı? */
(function () {
  H.SENARYOLAR.forEach(function (p) {
    gecer("%" + p + ": alt grup etkisi / fiyat artışı = pay",
      yakin(H.sepetArtisi("alt", p) / (p / 100), H.PAYLAR.alt, 1e-12));
    gecer("%" + p + ": üst grup etkisi / fiyat artışı = pay",
      yakin(H.sepetArtisi("ust", p) / (p / 100), H.PAYLAR.ust, 1e-12));
  });
  /* Etki, fiyat artışıyla DOĞRU ORANTILI olmalı. */
  gecer("iki kat fiyat artışı iki kat etki",
    yakin(H.sepetArtisi("alt", 20), H.sepetArtisi("alt", 10) * 2, 1e-12));
  /* Ve fark hep aynı yönde: alt grup daha çok etkileniyor. */
  gecer("her senaryoda alt grup daha çok etkileniyor",
    H.SENARYOLAR.every(function (p) { return H.sepetFarki(p) > 0; }));
})();

/* ---------------------------------------------------------------- 4
   Ö3 — nominal büyüyor, reel küçülüyor. */
(function () {
  var kn = H.nominalBuyume(2024, "kobi"), kr = H.reelBuyume(2024, "kobi");
  var tr = H.reelBuyume(2024, "toplam");
  gecer("KOBİ nominal pozitif", kn > 0);
  gecer("KOBİ reel negatif", kr < 0);
  gecer("işaretler gerçekten zıt", (kn > 0) !== (kr > 0));
  /* KOBİ'deki reel daralma toplamdakinden DAHA DERİN. */
  gecer("KOBİ reel daralması toplamdan derin", kr < tr,
    y2(kr * 100) + " < " + y2(tr * 100));
  /* KONTROL: ikisi de negatif ama BÜYÜKLÜKLERİ farklı olmalı; aynı
     olsaydı "daha derin" iddiası boş kalırdı. */
  gecer("iki reel değer birbirinden farklı", Math.abs(kr - tr) > 0.005);
  gecer("ikisi de negatif", kr < 0 && tr < 0);
  /* Reel dönüşüm gerçekten TÜFE kullanıyor mu? */
  gecer("TÜFE 44,38", H.TUFE_2024 === 44.38);
  gecer("farklı TÜFE farklı reel değer verir",
    !yakin(H.reelBuyume(2024, "kobi", 10) * 100, kr * 100, 1));
})();

/* ---------------------------------------------------------------- 5
   Tablolar modülle aynı mı? */
(function () {
  var s = tabloSatirlari("Gayrisafi tasarrufun kurumsal dağılımı");
  gecer("tasarruf tablosu okunabildi", s && s.length === H.TASARRUF.length + 2,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== H.TASARRUF.length + 2) return;
  H.TASARRUF.forEach(function (t, i) {
    gecer(t.sektor + ": tablo hücresi modülle aynı",
      s[i][1] === "%" + y1(t.oran), s[i][1]);
  });
  gecer("bileşen toplamı satırı doğru",
    s[H.TASARRUF.length][1] === "%" + y1(H.tasarrufBilesenToplami()),
    s[H.TASARRUF.length][1]);
  gecer("yayımlanan toplam satırı doğru",
    s[H.TASARRUF.length + 1][1] === "%" + y1(H.TASARRUF_YAYIN_TOPLAM),
    s[H.TASARRUF.length + 1][1]);
})();

(function () {
  var s = tabloSatirlari("Gıda ve konut-kira fiyatlarındaki ortak artışın");
  gecer("sepet tablosu okunabildi", s && s.length === H.SENARYOLAR.length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== H.SENARYOLAR.length) return;
  H.SENARYOLAR.forEach(function (p, i) {
    gecer("%" + p + ": alt grup hücresi modülle aynı",
      s[i][1] === "%" + y2(H.sepetArtisi("alt", p) * 100), s[i][1]);
    gecer("%" + p + ": fark hücresi modülle aynı",
      s[i][3] === y2(H.sepetFarki(p) * 100) + " puan", s[i][3]);
  });
})();

(function () {
  var s = tabloSatirlari("KOBİ ve toplam işletme kredi stoku");
  gecer("kredi tablosu okunabildi", s && s.length === H.KREDI.length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s || s.length !== H.KREDI.length) return;
  H.KREDI.forEach(function (k, i) {
    gecer(k.yil + ": KOBİ payı hücresi modülle aynı",
      s[i][3] === "%" + y2(H.kobiPayi(k.yil) * 100), s[i][3]);
  });
  /* İlk yılın değişim sütunları boş olmalı: öncesi yok. */
  gecer("ilk yılda değişim yok", s[0][4] === "—" && s[0][5] === "—",
    s[0][4] + " / " + s[0][5]);
  /* Son yılda nominal artı, reel eksi. */
  var son = s[s.length - 1];
  gecer("son yıl nominal artı işaretli", son[4].indexOf("+") === 0, son[4]);
  gecer("son yıl reel eksi işaretli", son[5].indexOf("−") === 0, son[5]);
})();

/* ---------------------------------------------------------------- 6
   Nesirdeki sayılar. */
gecsin("şirket payı nesirde", "<strong>%18,9</strong>");
gecsin("pay farkı nesirde", "<strong>28,7 puan</strong>");
gecsin("alt grup sepet etkisi nesirde", "<strong>%6,36</strong>");
gecsin("üst grup sepet etkisi nesirde", "<strong>%3,49</strong>");
gecsin("KOBİ nominal nesirde", "<strong>%33,62</strong>");
gecsin("KOBİ reel nesirde", "<strong>%7,45 küçüldü</strong>");
gecsin("yuvarlama notu var", "yuvarlanmış bileşenlerin");
gecsin("iki paydanın farkı anlatılmış", "farklı paydalara");

/* DOI sayfada birden çok yerde geçiyor; tam sayı çivileniyor. */
tamKez("DOI sayfada tam beş kez", "10.5281/zenodo.22819842", 5);

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
