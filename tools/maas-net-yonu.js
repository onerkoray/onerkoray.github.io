#!/usr/bin/env node
/*!
 * Maaş sayfalarındaki "yıl ilerledikçe kesinti artar" cümlesini düzeltir.
 *
 * NEDEN VAR
 * ---------
 * 28 maaş sayfası üç ayrı yerde (giriş paragrafı, görünür SSS ve FAQ
 * JSON-LD'si) net maaşın yıl boyunca TEKDÜZE düştüğünü söylüyordu.
 * Sayfaların kendi tablosu bunu yalanlıyor: net temmuz ve ağustosta
 * YÜKSELİYOR.
 *
 * Sebebi motordan doğrulandı. Asgari ücret istisnası, asgari ücretlinin
 * o ay ödeyeceği vergi kadardır (GVK m.23/1-18). Asgari ücretlinin
 * kümülatif matrahı 2026'da yedinci ayda tarifenin ilk dilimini aşıyor;
 * o aydan itibaren istisnanın kendisi üst dilimden hesaplanıyor ve
 * büyüyor. Çalışanın kendi tarife vergisi aynı kalırken istisna
 * büyürse net yükselir. Ölçüm: netteki artış ile istisnadaki artış
 * aynı ayda ve kuruşu kuruşuna aynı tutarda (+326,42 temmuz,
 * +1.077,35 ağustos).
 *
 * 28 sayfanın 14'ünde Aralık yılın en düşük ayı bile değil; eski metin
 * hem yönü hem de dibi yanlış gösteriyordu.
 *
 * BU METİN ÜRETEÇTE DEĞİLDİ
 * -------------------------
 * d25a05f ile bir kez yazılmış statik metindi; maas-sayfalari.js yalnızca
 * MAAS-DETAY bloğunu yönetiyor. Bu betik metni motordan türetip yerine
 * yazar, böylece tarife ya da asgari ücret değiştiğinde yeniden
 * koşularak güncellenebilir.
 *
 * Kullanım:
 *   node tools/maas-net-yonu.js           yazar
 *   node tools/maas-net-yonu.js --kontrol yazmaz, fark varsa 1 döner
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.join(__dirname, "..");
var B = require(path.join(KOK, "bordro", "motor.js"));

var YIL = 2026;
/* "…nisanda", "…aralıkta" — bulunma hâli, metinde küçük harfle geçiyor. */
var AY_DE = ["ocakta", "şubatta", "martta", "nisanda", "mayısta", "haziranda",
  "temmuzda", "ağustosta", "eylülde", "ekimde", "kasımda", "aralıkta"];

function fm(n) {
  return n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* Bir tutar için yılın şeklini motordan çıkarır. */
function sekil(brut) {
  var aylar = B.hesaplaYil(brut, YIL).aylar;
  var net = aylar.map(function (a) { return a.net; });

  var dipAy = 0;
  for (var i = 1; i < 12; i++) if (net[i] < net[dipAy] - 0.005) dipAy = i;

  /* Netin YÜKSELDİĞİ aylar. Yükselişi istisnaya bağlayabilmek için o
     ayda istisnanın da büyümüş olmasını şart koşuyoruz; aksi hâlde
     sebebi bilmediğimiz bir yükselişi istisnaya yazmış oluruz.

     İstisna 2026'da her tutarda temmuz ve ağustosta aynı miktarda
     büyüyor (+326,42 ve +1.077,35) -- yalnızca asgari ücrete bağlı
     olduğu için. Ama bu her sayfada neti yükseltmiyor: 70.000 ve
     75.000 TL'de çalışanın kendi dilim geçişi aynı ayda daha ağır
     bastığı için net düşmeye devam ediyor. O sayfalarda eski tekdüze
     anlatım zaten doğru. */
  var yukselen = [];
  for (var j = 1; j < 12; j++) {
    var dn = net[j] - net[j - 1];
    var di = aylar[j].istisna - aylar[j - 1].istisna;
    if (dn > 0.005 && di > 0.005) yukselen.push(j);
  }

  return {
    ocak: net[0],
    aralik: net[11],
    dipAy: dipAy,
    dip: net[dipAy],
    yukselen: yukselen,
    /* Aralık dipten yukarıdaysa yıl sonunda gerçek bir geri çıkış var. */
    geriCikis: net[11] > net[dipAy] + 0.005
  };
}

/* Giriş paragrafının son cümlesi. Eskisi "yıl ilerledikçe kesinti artar
   ve net maaş Aralık'ta N TL'ye iner." idi. */
function govdeCumlesi(s) {
  /* Bu cümle "…ele geçen net tutar N TL olur." cümlesinin hemen
     arkasından geliyor; Ocak netini tekrar yazmak gereksiz. */
  if (s.geriCikis) {
    return "hesaplandığından net maaş yıl içinde düşer ve " +
      AY_DE[s.dipAy] + " " + fm(s.dip) + " TL ile yılın en düşük seviyesine " +
      "iner. Asgari ücret istisnası " + AY_DE[s.yukselen[0]] +
      " büyüdüğü için net bir miktar geri yükselir; Aralık neti " +
      fm(s.aralik) + " TL'dir.";
  }
  var bas = "hesaplandığından net maaş yıl içinde düşer ve Aralık'ta " +
    fm(s.aralik) + " TL'ye iner.";
  /* Netin hiç yükselmediği tutarlarda düşüş gerçekten tekdüzedir;
     fazladan bir cümle kurmak yanlış olur. */
  if (!s.yukselen.length) return bas;
  return bas + " Düşüş düz bir çizgi değildir; asgari ücret istisnası " +
    AY_DE[s.yukselen[0]] + " büyüdüğü için net geçici olarak yükselir.";
}

/* SSS cevabı — hem görünür <details> hem FAQ JSON-LD aynı metni taşır. */
function sssCevabi(s) {
  if (s.geriCikis) {
    return "Gelir vergisi kümülatif matraha göre hesaplanır; biriken matrah " +
      "üst dilimlere girdikçe kesinti artar. Yılın en düşük neti " +
      AY_DE[s.dipAy] + " " + fm(s.dip) + " TL'dir. Asgari ücret istisnası " +
      AY_DE[s.yukselen[0]] + " büyüdüğü için Aralık neti " + fm(s.aralik) +
      " TL'ye çıkar.";
  }
  var bas = "Gelir vergisi kümülatif matraha göre hesaplanır; biriken matrah " +
    "üst dilimlere girdikçe kesinti artar. Aralık neti " + fm(s.aralik) + " TL'ye iner.";
  if (!s.yukselen.length) return bas;
  return bas + " Düşüş düz bir çizgi değildir; asgari ücret istisnası " +
    AY_DE[s.yukselen[0]] + " büyüdüğü için net geçici olarak yükselir.";
}

/* JSON-LD içinde metin kaçışlı duruyor; tırnak ve ters bölü kaçmalı. */
function jsonKacis(t) {
  return t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/* ---------- uygulama ---------- */

var kontrol = process.argv.indexOf("--kontrol") > 0;

/* Aynı cümle sayfada ÜÇ yerde geçiyor ve ikisi aynı sözlerle başlıyor.
   İlk sürümde SSS kalıbı çapasızdı: belgenin başındaki JSON-LD geçişinden
   başlayıp gövdedeki </p></details>'e kadar uzandı ve aradaki 87 satırı
   sildi. Bu yüzden her kalıp artık KENDİ bağlamına çapalı ve değişmeyen
   kısım yakalama grubunda korunuyor. */
var GOVDE = /hesaplandığından[\s\S]*?(?=<\/p>)/;
var SSS_LD = /("text":\s*")Gelir vergisi kümülatif matraha göre hesaplanır;[^"]*/;
var SSS = /(<details><summary>[^<]*neden düşer\?<\/summary><p>)Gelir vergisi kümülatif matraha göre hesaplanır;[\s\S]*?(?=<\/p><\/details>)/;

/* YAPISAL EMNİYET: bir metin değişikliği sayfanın iskeletini
   değiştiremez. Etiket sayıları sabit kalmazsa yazılmıyor. */
function iskelet(h) {
  return ["</p>", "</details>", "</script>", "</table>", "</section>"]
    .map(function (e) { return h.split(e).length - 1; }).join("/");
}

var dizinler = fs.readdirSync(path.join(KOK, "maas-hesaplama"))
  .filter(function (d) { return /^\d+-tl-brut-ne-kadar-net$/.test(d); })
  .sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

var degisen = 0, ayni = 0, atlanan = [];

dizinler.forEach(function (d) {
  var brut = parseInt(d, 10);
  var p = path.join(KOK, "maas-hesaplama", d, "index.html");
  var eski = fs.readFileSync(p, "utf8");
  var s = sekil(brut);

  var yeni = eski;
  var sayac = 0;

  if (GOVDE.test(yeni)) { yeni = yeni.replace(GOVDE, govdeCumlesi(s)); sayac++; }
  if (SSS.test(yeni)) { yeni = yeni.replace(SSS, "$1" + sssCevabi(s)); sayac++; }
  if (SSS_LD.test(yeni)) { yeni = yeni.replace(SSS_LD, "$1" + jsonKacis(sssCevabi(s))); sayac++; }

  if (sayac !== 3) { atlanan.push(d + " (" + sayac + "/3 yer bulundu)"); return; }

  if (iskelet(yeni) !== iskelet(eski)) {
    atlanan.push(d + " (iskelet bozuldu: " + iskelet(eski) + " -> " + iskelet(yeni) + ")");
    return;
  }
  if (Math.abs(yeni.length - eski.length) > 900) {
    atlanan.push(d + " (uzunluk " + (yeni.length - eski.length) + " bayt değişti)");
    return;
  }

  if (yeni === eski) { ayni++; return; }
  if (!kontrol) fs.writeFileSync(p, yeni, "utf8");
  degisen++;
});

console.log("Maaş sayfası net yönü metni");
console.log("  sayfa: " + dizinler.length +
  ",  güncel: " + ayni + ",  " + (kontrol ? "fark: " : "yazılan: ") + degisen);
atlanan.forEach(function (a) { console.log("  ATLANDI  " + a); });

if (atlanan.length) { console.error("\nEksik yer var, düzeltilmeli."); process.exit(1); }
if (kontrol && degisen) {
  console.error("\nMetin motorla uyuşmuyor: node tools/maas-net-yonu.js");
  process.exit(1);
}
process.exit(0);
