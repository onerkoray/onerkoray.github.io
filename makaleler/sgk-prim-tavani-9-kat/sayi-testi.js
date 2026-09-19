#!/usr/bin/env node
/*
 * "SGK prim tavanı 9 kata çıktı" yazısının sayılarını doğrular.
 *
 * NEDEN VAR
 * ---------
 * Yazının bütün sayıları iki motordan türüyor: bordro motoru ve emeklilik
 * motoru. 2027 parametreleri girildiğinde tavan da, kayıplar da değişir;
 * nesirdeki tutarlar sessizce eskir — sayfa açılır, hizalı durur, yalnızca
 * yanlıştır.
 *
 * ÜÇ ÖNERME, ÜÇÜ DE ÖLÇÜMDE
 * -------------------------
 * Ö1. ETKİ KESKİN BİR ARALIKTA. Eski tavanın altında tam olarak SIFIR,
 *     yeni tavanın üstünde sabit.
 *     KONTROL: "sıfır" iddiası, etki hiç hesaplanmasa da geçerdi. Bu
 *     yüzden bandın İÇİNDE etkinin sıfırdan farklı olduğu ayrıca
 *     ölçülüyor.
 *
 * Ö2. NET KAYIP = EK PRİM × (1 − MARJİNAL ORAN). Bunun sonucu, yazının
 *     asıl bulgusu: tavandaki kişi en yüksek ücretliden DAHA ÇOK
 *     kaybediyor.
 *     KONTROL: kalkan oranı tarifedeki gerçek dilim oranlarıyla
 *     eşleşmeli; "bir oran çıktı" yetmez.
 *
 * Ö3. FAZLA PRİM GERİ GELİYOR ve başabaş kariyer biçiminden neredeyse
 *     bağımsız.
 *     KONTROL: bağımsızlık iddiası, aylık artışı hiç değişmese de
 *     geçerdi. Artışın kariyerle GERÇEKTEN değiştiği ayrıca ölçülüyor.
 *
 * KARŞI OLGU ELLE YAZILMAMALI
 * ---------------------------
 * "Tavan 7,5 katta kalsaydı" senaryosu bir önceki yılın katsayısından
 * türüyor. Modül içine 7,5 yazılsaydı bütün testler yine geçerdi, çünkü
 * 2025'in katsayısı zaten 7,5. Test bunu önceki yılın katsayısını geçici
 * olarak oynatıp ölçüyor.
 *
 * MOTOR KİRLENMESİ
 * ----------------
 * tavanla() karşı olgu için motorun tavanını geçici olarak değiştiriyor.
 * Parametre nesnesi paylaşıldığı için geri konmazsa bütün site bozulur ve
 * bu SESSİZ bir hatadır. Test bunu ayrıca doğruluyor.
 *
 * Kullanım: node makaleler/sgk-prim-tavani-9-kat/sayi-testi.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(path.dirname(__dirname));
var B = require(path.join(KOK, "bordro", "motor.js"));
var T = require(path.join(__dirname, "tavan.js"));
var HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

var YIL = B.sonYil();

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
function tam(n) { return Math.round(n).toLocaleString("tr-TR"); }
function y1(n) { return n.toFixed(1).replace(".", ","); }
function yakin(a, b, tol) {
  if (!isFinite(a) || !isFinite(b)) return false;
  return Math.abs(a - b) <= (tol === undefined ? 0.5 : tol);
}

/* Bir tablonun satırlarını <caption> üzerinden çeker. */
function tabloSatirlari(capIcerik) {
  var i = HTML.indexOf(capIcerik);
  if (i < 0) return null;
  var bas = HTML.lastIndexOf("<table", i);
  var son = HTML.indexOf("</table>", i);
  if (bas < 0 || son < 0) return null;
  var govde = HTML.slice(bas, son);
  return govde.split("<tr").slice(1).filter(function (r) {
    /* Başlık satırı ELENİYOR: hücreleri scope="col" taşıyor. Elenmezse
       satır sayısı bir fazla çıkar ve "her satır modülle aynı" iddiası
       başlık metnini sayıyla karşılaştırmaya çalışır. */
    return r.indexOf('scope="col"') < 0;
  }).map(function (r) {
    return (r.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/g) || []).map(function (h) {
      return h.replace(/<[^>]*>/g, "").trim();
    });
  }).filter(function (h) { return h.length > 1; });
}

console.log("SGK prim tavanı yazısı — sayı denetimi\n");

/* ---------------------------------------------------------------- 0
   Modülün temel büyüklükleri. */
var t = T.tavanlar(YIL);
gecer("katsayı 9", t.katsayi === 9, String(t.katsayi));
gecer("önceki katsayı 7,5", t.oncekiKatsayi === 7.5, String(t.oncekiKatsayi));
gecer("katsayı değişmiş sayılıyor", t.degisti === true);
gecer("tavan = asgari brüt × katsayı",
  yakin(t.tavan, t.asgariBrut * t.katsayi, 0.005));
gecer("karşı olgu tavanı = asgari brüt × önceki katsayı",
  yakin(t.karsiOlguTavan, t.asgariBrut * t.oncekiKatsayi, 0.005));
gecer("genişleyen taban = tavan farkı",
  yakin(T.genisleyenTaban(YIL), t.tavan - t.karsiOlguTavan, 0.005));

/* KONTROL: karşı olgu GERÇEKTEN önceki yılın katsayısından mı türüyor?
   Modüle 7,5 elle yazılsaydı buraya kadarki her iddia yine geçerdi. */
(function () {
  var onceki = B.parametre(YIL - 1);
  var eski = onceki.tavanKatsayisi;
  var tasinan;
  try {
    onceki.tavanKatsayisi = 6;
    tasinan = T.tavanlar(YIL).karsiOlguTavan;
  } finally {
    onceki.tavanKatsayisi = eski;
  }
  gecer("karşı olgu önceki yılın katsayısını okuyor",
    yakin(tasinan, t.asgariBrut * 6, 0.005), String(tasinan));
  gecer("katsayı geri konuldu", B.parametre(YIL - 1).tavanKatsayisi === eski);
})();

/* ---------------------------------------------------------------- 1
   Ö1 — etki keskin bir aralıkta. */
var e = T.esikler(YIL);
gecer("etki eski tavanda başlıyor", yakin(e.baslar, t.karsiOlguTavan, 0.005));
gecer("etki yeni tavanda doyuyor", yakin(e.doyar, t.tavan, 0.005));

var altinda = T.etki(Math.round(e.baslar * 0.9), YIL);
gecer("eski tavanın altında ek prim sıfır", yakin(altinda.ekPrim, 0, 0.005));
gecer("eski tavanın altında net kayıp sıfır", yakin(altinda.netKayip, 0, 0.005));
gecer("eski tavanın altında işveren artışı sıfır",
  yakin(altinda.isverenKayip, 0, 0.005));

/* KONTROL: yukarıdaki üç "sıfır" iddiası, etki hiç hesaplanmasa da
   geçerdi. Bandın içinde etkinin GERÇEKTEN doğduğu ölçülüyor. */
var ortada = T.etki(Math.round((e.baslar + e.doyar) / 2), YIL);
gecer("bandın içinde ek prim sıfırdan büyük", ortada.ekPrim > 0,
  String(ortada.ekPrim));
gecer("bandın içinde etki doyumdan küçük",
  ortada.ekPrim < T.etki(Math.round(e.doyar), YIL).ekPrim);

var doyum = T.etki(Math.round(e.doyar), YIL);
var ustu = T.etki(Math.round(e.doyar * 2), YIL);
gecer("doyumdan sonra ek prim artmıyor",
  yakin(doyum.ekPrim, ustu.ekPrim, 0.005));

/* ---------------------------------------------------------------- 2
   Ö2 — vergi kalkanı ve tersine dönen dağılım. */
gecer("net kayıp = ek prim × (1 − kalkan)",
  yakin(doyum.netKayip, doyum.ekPrim * (1 - doyum.vergiKalkani), 0.01));

/* KONTROL: kalkan "bir oran" değil, tarifenin GERÇEK dilim oranı olmalı. */
var oranlar = B.parametre(YIL).dilimler.map(function (d) { return d[1]; });
gecer("doyumdaki kalkan tarifedeki bir dilim oranı",
  oranlar.some(function (o) { return yakin(o, doyum.vergiKalkani, 0.001); }),
  String(doyum.vergiKalkani));

var tepe = T.etki(900000, YIL);
gecer("en üst gelirde kalkan daha yüksek",
  tepe.vergiKalkani > doyum.vergiKalkani,
  doyum.vergiKalkani + " -> " + tepe.vergiKalkani);
gecer("en üst gelirde kalkan da tarifedeki bir dilim oranı",
  oranlar.some(function (o) { return yakin(o, tepe.vergiKalkani, 0.001); }),
  String(tepe.vergiKalkani));
/* ASIL BULGU. */
gecer("tavandaki kişi en üst gelirden DAHA ÇOK kaybediyor",
  doyum.netKayip > tepe.netKayip,
  tam(doyum.netKayip) + " vs " + tam(tepe.netKayip));
gecer("ek prim ikisinde de aynı",
  yakin(doyum.ekPrim, tepe.ekPrim, 0.005));

/* İşveren tarafında kalkan yok: artış ek primin tamamı. */
var o = B.parametre(YIL).oranlar;
gecer("işveren artışı = genişleyen taban × işveren oranı × 12",
  yakin(doyum.isverenKayip,
    T.genisleyenTaban(YIL) * (o.sgkIsveren + o.issizlikIsveren) * 12, 1));
gecer("ek işçi primi = genişleyen taban × işçi oranı × 12",
  yakin(doyum.ekPrim,
    T.genisleyenTaban(YIL) * (o.sgkIsci + o.issizlikIsci) * 12, 1));

/* ---------------------------------------------------------------- 3
   Ö3 — emeklilik geri dönüşü. */
var senaryolar = [[5, 5], [10, 5], [20, 5], [30, 5], [5, 15], [20, 15],
                  [35, 15], [10, 30], [25, 30]];
var enAz = Infinity, enCok = 0, artislar = [];
senaryolar.forEach(function (s) {
  var r = T.emeklilikGeriDonusu(s[0] * 360, s[1] * 360, YIL);
  enAz = Math.min(enAz, r.basabasYil);
  enCok = Math.max(enCok, r.basabasYil);
  artislar.push(r.aylikArtis);
  gecer(s[0] + "+" + s[1] + " yıl: aylık artış pozitif", r.aylikArtis > 0);
  gecer(s[0] + "+" + s[1] + " yıl: başabaş sonlu", isFinite(r.basabasYil));
});
gecer("başabaş 4,5–5,8 yıl aralığında",
  enAz >= 4.4 && enCok <= 5.9, y1(enAz) + " – " + y1(enCok));

/* KONTROL: "başabaş kariyerden bağımsız" iddiası, aylık artış hiç
   değişmese de geçerdi. Artışın gerçekten değiştiği ölçülüyor. */
gecer("aylık artış kariyerle gerçekten değişiyor",
  Math.max.apply(null, artislar) > Math.min.apply(null, artislar) * 2,
  artislar.map(function (a) { return tam(a); }).join(" / "));

/* ---------------------------------------------------------------- 4
   Motor kirlenmemeli. */
(function () {
  var d = B.parametre(YIL).donemler[0];
  var once = d.sgkTavan;

  /* etki() ile olcmek YETMEZ: o iki cagri yapiyor ve IKINCISI tavani
     zaten gercek degere set ediyor, dolayisiyla finally kaldirilsa bile
     motor dogru gorunurdu. Bu yuzden tavanla() DOGRUDAN, gercek olmayan
     bir tavanla cagriliyor. */
  T.tavanla(400000, YIL, 123456);
  gecer("tavanla() sonrasi tavan geri konuldu", d.sgkTavan === once,
    once + " -> " + d.sgkTavan);

  /* Cagri hata atsa bile geri konmali. */
  try { T.tavanla(-1, YIL, 123456); } catch (hata) { /* onemli degil */ }
  gecer("hata halinde de tavan geri konuldu", d.sgkTavan === once,
    once + " -> " + d.sgkTavan);

  T.etki(400000, YIL);
  T.emeklilikGeriDonusu(7200, 3600, YIL);
  gecer("etki ve geri donus sonrasi tavan yerinde", d.sgkTavan === once);

  var kontrol = B.hesaplaYil(400000, YIL).toplam.net;
  gecer("motor hâlâ gerçek tavanla hesaplıyor",
    yakin(kontrol, T.tavanla(400000, YIL, once).toplam.net, 0.01));
})();

/* ---------------------------------------------------------------- 5
   Nesirdeki sayılar. */
/* VARLIK KONTROLU YETMEZ. Bu sayilarin cogu tablolarda da geciyor;
   yalnizca "sayfada var mi" diye sorulsaydi, nesirdeki rakami bozmak
   testi DUSURMEZDI -- ayni dizgi tabloda duruyor diye gecerdi. Bu yuzden
   nesir iddialari, nesre ozgu <strong> bicimiyle araniyor.
   Ustelik VARLIK da yetmiyor: ayni rakam nesirde birden fazla kez
   vurgulanmis olabiliyor (isveren artisi uc yerde geciyor). Tek bir
   tanesini bozmak varlik kontrolunu dusurmezdi. Bu yuzden TAM TEKRAR
   SAYISI cakiliyor. */
function nesirde(ad, deger, adet) {
  tamKez(ad, "<strong>" + tam(deger) + " TL</strong>", adet);
}
nesirde("tavan tutarı nesirde", t.tavan, 1);
nesirde("karşı olgu tavanı nesirde", t.karsiOlguTavan, 1);
nesirde("genişleyen taban nesirde", T.genisleyenTaban(YIL), 1);
nesirde("ek işçi primi nesirde", doyum.ekPrim, 2);
nesirde("tavandaki net kayıp nesirde", doyum.netKayip, 1);
nesirde("en üst gelirdeki net kayıp nesirde", tepe.netKayip, 1);
nesirde("işveren artışı nesirde", doyum.isverenKayip, 3);
gecsin("asgari ücret nesirde", tam(t.asgariBrut) + " × 9");
gecsin("iki kayıp arasındaki fark nesirde",
  "yılda " + tam(doyum.netKayip - tepe.netKayip) + " TL daha fazla");

/* KONTROL: yukaridaki yardimci gercekten <strong> ariyor mu? Sayfada
   bulunmamasi gereken bir bicim, bulunmamali. */
gecer("nesir kontrolu gercekten bicime bakiyor",
  kacKez("<strong>" + tam(doyum.netKayip + 1) + " TL</strong>") === 0);

/* Kalkanın döndüğü brüt: nesirde tam bu sayı yazıyor. */
(function () {
  var donus = null, onceki = doyum.vergiKalkani;
  for (var x = Math.round(e.doyar); x <= 900000; x += 500) {
    var k = T.etki(x, YIL).vergiKalkani;
    if (Math.abs(k - onceki) > 0.001) { donus = x; break; }
    onceki = k;
  }
  gecer("kalkanın değiştiği brüt bulundu", donus !== null);
  if (donus) gecsin("o brüt nesirde", "<strong>" + tam(donus) + " TL</strong>");
})();

/* Yazının çerçevesi: "vergi değil" iddiası metinde olmalı. */
gecsin("emeklilik karşılığı anlatılıyor", "zorunlu emeklilik alımı");
gecsin("7566 sayılı Kanun anılıyor", "7566 sayılı Kanun");
gecsin("dayanak maddesi anılıyor", "m.82");
gecsin("vergi kalkanının dayanağı anılıyor", "m.63");

/* Tek yerde geçmesi gereken formül: iki kez yazılırsa biri bayatlar. */
tamKez("kalkan formülü bir kez", "net kayıp = ek prim × (1 − marjinal vergi oranı)", 1);

/* ---------------------------------------------------------------- 6
   Tablolar modüle bağlı mı? */
(function () {
  var s = tabloSatirlari("Asgari ücret, tavan katsayısı ve aylık prim tavanı");
  gecer("değişim tablosu okunabildi", s && s.length === B.yillar().length,
    s ? "satır: " + s.length : "tablo yok");
  if (!s) return;
  var sonSatir = s[s.length - 1];
  gecer("son satır son yıl", sonSatir[0] === String(YIL), sonSatir[0]);
  gecer("son satırda tavan doğru", sonSatir[3] === tam(t.tavan) + " TL", sonSatir[3]);
  gecer("son satır katsayı değişimini işaretliyor",
    sonSatir[4].indexOf("katsayı değişti") >= 0, sonSatir[4]);
  /* KONTROL: yalnızca son satır işaretli olmalı — hepsi işaretliyse
     "değişti" bilgisi hiçbir şey söylemiyor demektir. */
  var isaretli = s.filter(function (r) {
    return r[4] && r[4].indexOf("katsayı değişti") >= 0;
  });
  gecer("yalnızca bir yılda katsayı değişmiş", isaretli.length === 1,
    "işaretli satır: " + isaretli.length);
})();

(function () {
  var s = tabloSatirlari(YIL + " — aylık brüte göre yıllık etki");
  gecer("etki tablosu okunabildi", s && s.length === 6,
    s ? "satır: " + s.length : "tablo yok");
  if (!s) return;
  /* Her satırın net kaybı modülle aynı olmalı. */
  var hepsi = s.every(function (r) {
    var brut = Number(r[0].replace(/[^\d]/g, ""));
    return r[3] === tam(T.etki(brut, YIL).netKayip) + " TL";
  });
  gecer("etki tablosunun her satırı modülle aynı", hepsi);
  /* İlk satır eşiğin altı: sıfır olmalı. */
  gecer("ilk satırda kayıp yok", s[0][3] === "0 TL", s[0][3]);
})();

(function () {
  var s = tabloSatirlari("Fazla primin emekli aylığı üzerinden geri dönüşü");
  gecer("geri dönüş tablosu okunabildi", s && s.length === 5,
    s ? "satır: " + s.length : "tablo yok");
  if (!s) return;
  var hepsi = s.every(function (r) {
    return /^\d+,\d yıl$/.test(r[4]);
  });
  gecer("başabaş sütunu yıl biçiminde", hepsi, s.map(function (r) { return r[4]; }).join(" "));
})();

/* ---------------------------------------------------------------- */
console.log("\n" + gecen + " kontrol geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
