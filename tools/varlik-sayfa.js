#!/usr/bin/env node
/*!
 * "Altın mı, dolar mı, mevduat mı?" sayfasını seriden üretir: manşet
 * rakamları, açıklama, sonuç kartları, grafik, kazanan haritası, sayı
 * tablosu, stopaj tablosu ve S.S.S.
 *
 * NEDEN: sonuç her ay değişir (kur, altın, mevduat faizi ve TÜFE gece
 * güncelleniyor). Elle yazılmış bir rakam ilk yeni veride yanlış olurdu.
 * Gece hattı (veri-guncelle.yml) --sitemap ile yazar, CI --check ile
 * sayfanın seriyle aynı olduğunu doğrular. Ortak son veri ayı iki aydan
 * fazla geride kalırsa --check kırmızı.
 *
 *   node tools/varlik-sayfa.js            # yaz
 *   node tools/varlik-sayfa.js --check    # CI
 *   node tools/varlik-sayfa.js --sitemap  # yaz, değiştiyse lastmod'u bugüne çek
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.join(__dirname, "..");
var SAYFA = path.join(KOK, "altin-mi-dolar-mi-mevduat-mi", "index.html");
var V = require(path.join(KOK, "finans", "varlik-motoru.js"));
var G = require(path.join(KOK, "altin-mi-dolar-mi-mevduat-mi", "gorunum.js"));
var Ek = require(path.join(__dirname, "grafikler-sayfa.js"));
var Ortak = require(path.join(__dirname, "zam-sayfa-ortak.js"));

var ADRES = "https://korayoner.dev/altin-mi-dolar-mi-mevduat-mi/";
var EN_COK_GECIKME = 2;       // ay: ortak son veri ayı bundan eskiyse bayat
var KISA = { altin: "altın", dolar: "dolar", euro: "euro", mevduat: "TL mevduat" };

var sayi = G.sayi, tl = G.tl, yuzde = G.yuzde, kat = G.kat, ayAdi = G.ayAdi, kacis = G.kacis;
function milyon(v) { return v >= 1e6 ? sayi(v / 1e6, 2) + " milyon TL" : tl(v); }
function ayDa(ay) { return G.ayDa(ay); }

/* "189 başlangıç ayının 143'ünde altın, 46'sında dolar birinci geldi; euro
   ve TL mevduat hiçbirinde birinci olmadı." */
function kazananCumlesi(sure) {
  var k = V.kazanmaSayilari(sure);
  var sirali = ["altin", "dolar", "euro", "mevduat"].sort(function (a, b) { return k.say[b] - k.say[a]; });
  var var_ = sirali.filter(function (a) { return k.say[a] > 0; });
  var yok = sirali.filter(function (a) { return k.say[a] === 0; });
  var c = sure / 12 + " yıl tutulduğunda " + k.toplam + " başlangıç ayının " +
    var_.map(function (a) { return k.say[a] + "'" + Ek.iyelikBulunma(k.say[a]) + " " + KISA[a]; }).join(", ") +
    " birinci geldi";
  if (yok.length) c += "; " + yok.map(function (a) { return KISA[a]; }).join(" ve ") + " hiçbirinde birinci olmadı";
  return c + ".";
}

/* Mevduatın kaç yıllık pencerede enflasyonu geçtiği. */
function mevduatYendi(sure) {
  var h = V.harita(sure), n = 0;
  h.forEach(function (x) { if (x.carpanlar.mevduat > x.tufe) n++; });
  return { yendi: n, toplam: h.length };
}

function degerler() {
  var o = V.ozet(G.VARSAYILAN), s = o.sonuclar;
  return {
    o: o,
    alan: {
      basAy: ayAdi(o.bas), sonAy: ayAdi(o.son), sonAy2: ayAdi(o.son),
      altin: milyon(s.altin.deger), dolar: milyon(s.dolar.deger), mevduat: milyon(s.mevduat.deger),
      tufeKat: kat(o.tufe.carpan),
      besYilOzet: kazananCumlesi(60)
    }
  };
}

function sss(o) {
  var s = o.sonuclar, bir = V.kazanmaSayilari(12), my = mevduatYendi(12), my5 = mevduatYendi(60);
  var guncel = V.stopaj(new Date().toISOString().slice(0, 10));
  return [
    [ayAdi(o.bas).split(" ")[1] + "'ten bu yana altın mı, dolar mı, mevduat mı daha çok kazandırdı?",
      ayAdi(o.bas) + " sonunda yatırılan 100.000 TL, " + ayAdi(o.son) + " sonunda gram altında " + tl(s.altin.deger) +
      ", dolarda " + tl(s.dolar.deger) + ", euroda " + tl(s.euro.deger) + ", stopaj sonrası TL mevduatta " + tl(s.mevduat.deger) +
      " oldu. Aynı sürede fiyatlar " + kat(o.tufe.carpan) + " arttı; enflasyondan sonra altın " + yuzde(s.altin.reel) +
      ", dolar " + yuzde(s.dolar.reel) + ", euro " + yuzde(s.euro.reel) + ", TL mevduat " + yuzde(s.mevduat.reel) + "."],
    ["Kısa vadede sonuç değişiyor mu?",
      "Evet. " + kazananCumlesi(12) + " Süre uzadıkça kazanan belirginleşiyor: " + kazananCumlesi(120)],
    ["TL mevduat enflasyonu yendi mi?",
      "Döneme göre değişiyor. 1 yıl tutulan mevduat, " + my.toplam + " başlangıç ayının " + my.yendi + "'" + Ek.iyelikBulunma(my.yendi) +
      " stopaj sonrası enflasyonu geçti; 5 yıl tutulduğunda " + my5.toplam + " başlangıcın " +
      (my5.yendi ? my5.yendi + "'" + Ek.iyelikBulunma(my5.yendi) : "hiçbirinde") + " geçti. " + ayAdi(o.bas) + "–" + ayAdi(o.son) +
      " arasının tamamında reel sonuç " + yuzde(s.mevduat.reel) + "."],
    ["Hesaba stopaj dahil mi?",
      "Evet. Mevduat faizinden, hesabın her ay yenilendiği gün geçerli olan stopaj düşülüyor. 2006'dan bu yana 6 aya kadar vadede oran %5 ile %17,5 arasında değişti; bugün %" +
      sayi(guncel.oran, guncel.oran % 1 ? 1 : 0) + " (" + guncel.dayanak + "). Döviz ve altında alış-satış makası hesaba katılmadı."],
    ["Kuyumcudaki gram altın fiyatıyla neden farklı?",
      "Araç, Dünya Bankası'nın aylık ortalama ons fiyatını TCMB ay sonu kuruyla grama çeviriyor. Kuyumcu ve banka fiyatlarında alış-satış makası ve işçilik var; kısa sürelerde fark birkaç yüzdeyi bulabilir, uzun sürelerde sıralamayı genellikle değiştirmez."],
    ["Veriler ne zaman güncelleniyor?",
      "Kur, altın, mevduat faizi ve TÜFE serileri her gece kontrol ediliyor. Hesap, dördünün de yayımlandığı son aya kadar yapılıyor; şu an " + ayAdi(o.son) + "."]
  ];
}
function sssHtml(liste) {
  return "\n" + liste.map(function (q) {
    return "          <details><summary>" + kacis(q[0]) + "</summary><p>" + kacis(q[1]) + "</p></details>";
  }).join("\n") + "\n";
}
function sssLd(liste) {
  return '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: liste.map(function (q) { return { "@type": "Question", name: q[0], acceptedAnswer: { "@type": "Answer", text: q[1] } }; })
  }) + "</script>";
}

function blok(s, ad, icerik, degisen) {
  var bas = "<!-- " + ad + ":BASLANGIC -->", bit = "<!-- " + ad + ":BITIS -->";
  var i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < 0 || s.indexOf(bas, i + 1) >= 0) throw new Error("Blok işareti eksik ya da yinelenmiş: " + ad);
  var yeni = bas + icerik + bit;
  if (s.slice(i, j + bit.length) !== yeni) degisen.push(ad);
  return s.slice(0, i) + yeni + s.slice(j + bit.length);
}
function yerDegistir(s, kalip, yeni, ad, degisen) {
  if (!kalip.test(s)) throw new Error("Sayfada bulunamadı: " + ad);
  var t = s.replace(kalip, yeni);
  if (t !== s) degisen.push(ad);
  return t;
}

function uret(s) {
  var v = degerler(), o = v.o, degisen = [], eksik = [];
  s = s.replace(/<(span|strong) data-v="([A-Za-z0-9]+)">([^<]*)<\/\1>/g, function (tum, et, k) {
    if (!(k in v.alan)) { eksik.push(k); return tum; }
    var yeni = "<" + et + ' data-v="' + k + '">' + v.alan[k] + "</" + et + ">";
    if (yeni !== tum) degisen.push("rakam:" + k);
    return yeni;
  });
  if (eksik.length) throw new Error("Üretecin bilmediği alan: " + eksik.join(", "));

  var s1 = o.sonuclar;
  var aciklama = ayAdi(o.bas) + "'te 100.000 TL: altında " + milyon(s1.altin.deger) + ", dolarda " + milyon(s1.dolar.deger) +
    ", mevduatta " + milyon(s1.mevduat.deger) + ". Kendi tarihlerinizle, enflasyondan sonra hesaplayın.";
  aciklama = aciklama.replace(ayAdi(o.bas) + "'te", ayDa(o.bas));
  s = yerDegistir(s, /(<meta name="description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "description", degisen);
  s = yerDegistir(s, /(<meta property="og:description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "og:description", degisen);
  s = yerDegistir(s, /(<meta name="twitter:description" content=")[^"]*(")/, "$1" + kacis(aciklama) + "$2", "twitter:description", degisen);

  var liste = sss(o);
  s = blok(s, "VARLIK-SONUC", G.sonucHtml(o), degisen);
  s = blok(s, "VARLIK-GRAFIK", G.grafikHtml(o), degisen);
  s = blok(s, "VARLIK-HARITA", G.haritaHtml(G.VARSAYILAN.sure), degisen);
  s = blok(s, "VARLIK-SAYILAR", G.sayilarTablosu(), degisen);
  s = blok(s, "VARLIK-STOPAJ", G.stopajTablosu(), degisen);
  s = blok(s, "VARLIK-SSS", sssHtml(liste), degisen);
  s = blok(s, "VARLIK-SSS-LD", sssLd(liste), degisen);
  return { s: s, degisen: degisen, o: o, aciklama: aciklama };
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var harita = process.argv.indexOf("--sitemap") !== -1;
  var eski = fs.readFileSync(SAYFA, "utf8");
  var r = uret(eski);
  if (r.aciklama.length > 165) { console.error("Açıklama 165 karakteri aşıyor (" + r.aciklama.length + "): " + r.aciklama); return 1; }
  if (kontrol) {
    var hata = 0;
    if (r.s !== eski) {
      console.error("Varlık sayfası seriden farklı (" + r.degisen.slice(0, 6).join(", ") + ") — 'node tools/varlik-sayfa.js' çalıştırın.");
      hata = 1;
    }
    var buAy = new Date().toISOString().slice(0, 7);
    if (V.ayFarki(V.SON, buAy) > EN_COK_GECIKME) {
      console.error("Varlık serisi BAYAT: ortak son ay " + ayAdi(V.SON) + ", bugün " + ayAdi(buAy) +
        ". Kur, altın, TÜFE ve mevduat serilerinden hangisinin geride kaldığına bakın (tools/grafik-verisi.py).");
      hata = 1;
    }
    if (!hata) console.log("Varlık sayfası güncel: " + ayAdi(V.ILK) + "–" + ayAdi(V.SON) + ".");
    return hata;
  }
  if (r.s === eski) { console.log("Varlık sayfası zaten güncel."); return 0; }
  fs.writeFileSync(SAYFA, r.s, "utf8");
  console.log("Varlık sayfası yazıldı: " + r.degisen.length + " alan.");
  if (harita && !Ortak.sitemapTazele(ADRES)) return 1;
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { uret: uret, kazananCumlesi: kazananCumlesi, mevduatYendi: mevduatYendi };
