#!/usr/bin/env node
/*
 * "BES devlet katkısı ne kadar değerli?" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Bu yazının anlattığı oran, sitede DOKUZ AY boyunca yanlış kaldı:
 * motor %30 hesaplıyordu, oysa 1 Ocak 2026'dan beri %20. Hiçbir şey
 * bozulmadı, yalnızca sonuç fazla iyimserdi. Yazı aynı sayıyı yeniden
 * anlattığı için burada da aynı risk var.
 *
 * DÖRT ÖNERME
 * -----------
 * Ö1. Modülün türettikleri ÇALIŞMANIN YAYIMLADIĞI sayılarla aynı.
 *     Azami katkı 79.272 TL, tavanın iki katında efektif oran %10.
 *     KONTROL: bu iki değer birbirinden bağımsız yollardan geliyor;
 *     ikisinin birden tutması hesabın kopyalanmadığını gösterir.
 *
 * Ö2. Efektif oran kapalı formu HİPERBOL: tavanın k katında yasal
 *     oranın 1/k'si. Üç ayrı k için sınanıyor.
 *     KONTROL: tavanın ALTINDA oran erimemeli — fonksiyon her yerde
 *     bölme yapsaydı bu da bozulurdu.
 *
 * Ö3. Kesişim yılları ve indirimin öne çektiği süre tutarlı.
 *     KONTROL: ufukKaybi() farkı gerçekten hesaplıyor mu?
 *
 * Ö4. Yazı sınırlarını söylüyor: kesişim bir benzetim sonucudur ve
 *     burada yeniden üretilmiyor. Bunu saklamak, hesaplanmış gibi
 *     sunmak olurdu.
 *
 * Kullanım: node makaleler/bes-devlet-katkisi-ne-kadar-degerli/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var B = require(path.join(__dirname, "bes.js"));
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
  gecer(ad, n === adet, m + " " + n + " kez, beklenen " + adet);
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }

console.log("BES devlet katkısı — sayı denetimi\n");

/* ---------------------------------------------------------------- 1
   Ö1: çalışmanın yayımladığı sayılar yeniden üretiliyor mu? */
gecer("güncel oran %20", B.guncelOran() === 0.20, String(B.guncelOran()));
gecer("önceki oran %30", B.oncekiOran() === 0.30, String(B.oncekiOran()));
gecer("tavan 396.360 TL", yakin(B.tavan(), 396360, 0.5), String(B.tavan()));
gecer("azami yıllık katkı 79.272 TL (çalışmadaki değer)",
  yakin(B.azamiKatki(), 79272, 0.5), B.azamiKatki().toFixed(2));

/* Çalışmadaki örnek: aylık 66.060 TL katkı -> efektif %10. */
gecer("aylık 66.060 TL katkıda efektif oran %10 (çalışmadaki örnek)",
  yakin(B.efektifOran(66060 * 12), 0.10, 0.0005),
  (B.efektifOran(66060 * 12) * 100).toFixed(3));

/* Tavan, bordro parametreleriyle aynı asgari ücretten mi geliyor?
   İki yerde iki farklı asgari ücret olursa tablo sessizce kayar. */
(function () {
  var P = require(path.join(__dirname, "..", "..", "bordro", "parametreler.js"));
  var asgari = P[B.YIL].donemler[0].asgariBrut;
  /* Modul artik degeri KOPYALAMIYOR, motordan okuyor; bu iddia yine de
     duruyor cunku okumanin dogru yeri okudugunu bagliyor. */
  gecer("asgari ücret bordro parametreleriyle aynı",
    yakin(B.asgariBrutAy(), asgari, 0.005),
    B.asgariBrutAy() + " vs " + asgari);
})();

/* ---------------------------------------------------------------- 2
   Ö2: efektif oran hiperbolü */
[1, 2, 3, 4].forEach(function (k) {
  var C = B.oraninBolundugKatki(k);
  gecer("tavanın " + k + " katında oran yasal oranın 1/" + k + "'i",
    yakin(B.efektifOran(C), B.guncelOran() / k, 1e-9),
    (B.efektifOran(C) * 100).toFixed(4));
});

/* KONTROL: tavanın ALTINDA erime OLMAMALI. Fonksiyon her yerde bölme
   yapsaydı yukarıdaki dört iddia yine geçerdi. */
[0.25, 0.5, 0.99].forEach(function (k) {
  gecer("KONTROL: tavanın " + k + " katında oran erimiyor",
    yakin(B.efektifOran(B.tavan() * k), B.guncelOran(), 1e-9),
    (B.efektifOran(B.tavan() * k) * 100).toFixed(4));
});

/* Devlet katkısı tavandan sonra SABİT kalmalı: azami tutar. */
gecer("tavan üstünde devlet katkısı azami tutarda sabit",
  yakin(B.tavan() * 3 * B.efektifOran(B.tavan() * 3), B.azamiKatki(), 0.5));

/* ---------------------------------------------------------------- 3
   Ö3: kesişim ve ufuk kaybı */
gecer("kesişim %30'da 25. yıl", B.KESISIM.oran30 === 25);
gecer("kesişim %20'de 18. yıl", B.KESISIM.oran20 === 18);
gecer("indirim kesişimi 7 yıl öne çekti", B.ufukKaybi() === 7,
  String(B.ufukKaybi()));

/* KONTROL: fark gerçekten hesaplanıyor mu, sabit mi? */
(function () {
  var yedek = B.KESISIM.oran20;
  B.KESISIM.oran20 = 20;
  var y = B.ufukKaybi();
  B.KESISIM.oran20 = yedek;
  gecer("KONTROL: ufuk kaybı sabit değil, fark hesaplanıyor", y === 5,
    String(y));
})();
gecer("KONTROL: yedek geri yüklendi", B.KESISIM.oran20 === 18);

/* Hak ediş kademeleri */
gecer("3 yıldan önce hak ediş yok", B.hakEdis(2) === 0);
gecer("3 yılda %15", yakin(B.hakEdis(3), 0.15, 1e-9));
gecer("6 yılda %35", yakin(B.hakEdis(6), 0.35, 1e-9));
gecer("10 yılda %60", yakin(B.hakEdis(10), 0.60, 1e-9));

/* Kayıp ufuktan bağımsız: iki ölçüm arasındaki fark 0,05 puandan küçük. */
gecer("indirim kaybı ufuktan bağımsız (fark < 0,05 puan)",
  B.kayipFarkiPuan() < 0.05, B.kayipFarkiPuan().toFixed(3));
gecer("indirim oranın üçte biri", yakin(B.indirimOrani(), 1 / 3, 0.001),
  B.indirimOrani().toFixed(4));

/* ---------------------------------------------------------------- 4
   Tablolar modülle aynı mı? */
gecsin("azami katkı tabloda", "79.272 TL");
gecsin("tavan tabloda", "396.360 TL");
gecsin("%30 dönemi azami katkısı tabloda", "118.908 TL");
gecsin("aylık 66.060 satırı tabloda", "66.060 TL");
/* EFEKTIF ORAN SUTUNU AYRISTIRILIYOR.
   Once "%10 sayfada var mi" diye bakiliyordu ve bu "%108" icinde de
   esleisiyordu; uretec butun satirlara yasal orani yazsa bile test
   geciyordu. Artik tablo okunup sutunun gercekten ERIDIGI olculuyor. */
(function () {
  var i = HTML.indexOf("efektif e\u015fle\u015fme oran\u0131 nas\u0131l eriyor");
  gecer("efektif tablo bulundu", i >= 0);
  if (i < 0) return;
  var bas = HTML.lastIndexOf("<tbody>", HTML.indexOf("</table>", i));
  var son = HTML.indexOf("</tbody>", bas);
  var govde = HTML.slice(bas, son);

  var oranlar = [];
  govde.split("<tr").slice(1).forEach(function (r) {
    var h = r.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/g) || [];
    if (h.length < 4) return;
    var son2 = h[h.length - 1].replace(/<[^>]*>/g, "").trim();
    var m = son2.match(/^%([0-9,]+)$/);
    if (m) oranlar.push(parseFloat(m[1].replace(",", ".")));
  });

  gecer("efektif tabloda alt\u0131 sat\u0131r okundu", oranlar.length === 6,
    JSON.stringify(oranlar));
  gecer("oran sabit de\u011fil — ger\u00e7ekten eriyor",
    oranlar.length > 1 && oranlar[oranlar.length - 1] < oranlar[0],
    JSON.stringify(oranlar));
  gecer("tavan\u0131n 2 kat\u0131 sat\u0131r\u0131nda oran %10",
    oranlar.indexOf(10) >= 0, JSON.stringify(oranlar));
  gecer("tavana kadar oran yasal oranda kal\u0131yor",
    oranlar[0] === B.guncelOran() * 100 && oranlar[1] === B.guncelOran() * 100,
    JSON.stringify(oranlar));
})();
gecsin("kesişim yılı tabloda", "18. yıl");

/* Oran sayfada BAŞKA bir değerle geçmemeli. Yazının anlattığı hatanın
   aynısı burada tekrarlanmasın. */
gecer("sayfada '%30'udur' gibi güncel iddia yok",
  kacKez("katkı payının %30") === 0);

/* ---------------------------------------------------------------- 5
   Ö4: sınırlar ve dayanaklar yazılı */
gecsin("kesişimin benzetim olduğu söylenmiş",
  "<strong>Kesişim yılı bir benzetim sonucudur.</strong>");
/* Bu iddia once satir sonu iceren bir dizgiye baglanmisti; HTML
   sarmalanmasi degisince kirilirdi. Tek satirlik ve bicimden
   bagimsiz bir parcaya baglandi. */
gecsin("yeniden üretilmediği söylenmiş", "kesişim yılını <em>hesaplamıyor</em>");
gecsin("davranış modellenmediği söylenmiş", "Davranış modellenmedi");
gecsin("karar künyesi yazılı", "10811 sayılı Cumhurbaşkanı Kararı");
gecsin("RG künyesi yazılı", "7 Ocak 2026");
gecsin("kanun dayanağı yazılı", "4632 sayılı Kanun");
gecsin("akış-stok tezi yazılı", "<strong>Devlet katkısı akışla orantılıdır.</strong>");
gecsin("geçerlilik bildirimi var", "name=\"gecerlilik\"");

/* Uc yer: JSON-LD atfi, kaynakcadaki baglanti adresi ve baglanti
   metni. Ucu de mesru; sayi civilenince biri sessizce dusemez. */
tamKez("DOI sayfada tam uc kez", "10.5281/zenodo.22852165", 3);
tamKez("KONTROL: olmayan DOI sıfır kez", "10.5281/zenodo.11111111", 0);

console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
