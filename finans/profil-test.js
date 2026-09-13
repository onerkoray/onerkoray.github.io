#!/usr/bin/env node
/*
 * Finansal Profil regresyonlari.
 *
 * NEDEN: profil VERI KATMANI. Bozulursa tek bir sayfa degil, uzerine
 * binen her motor birden yanlisa doner -- ve bozulma sessizdir: nesne
 * yine bir nesnedir, alanlar yine vardir, yalnizca degerler yanlistir.
 * Ayrica burada kullanicinin en hassas verisi duruyor; saklama kurallari
 * "herhalde dogrudur" diye birakilamaz.
 */
"use strict";
var P = require("./profil.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 1e-9 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

/* Node'da localStorage yok; depo enjekte ediliyor. */
function sahteDepo(patlasin) {
  var kutu = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(kutu, k) ? kutu[k] : null; },
    setItem: function (k, v) {
      if (patlasin) throw new Error("QuotaExceeded");
      kutu[k] = String(v);
    },
    removeItem: function (k) { delete kutu[k]; },
    _kutu: kutu
  };
}

var ORNEK = {
  kisi: { dogumYili: 1990, emeklilikHedefYasi: 55, haneBuyuklugu: 3 },
  gelirler: [
    { ad: "Maaş", tur: "ucret", aylikBrut: 100000 },
    { ad: "Kira geliri", tur: "kira", aylikNet: 15000 }
  ],
  giderler: [
    { ad: "Kira", aylik: 22000, zorunlu: true },
    { ad: "Market", aylik: 14000, zorunlu: true },
    { ad: "Abonelik", aylik: 2500, zorunlu: false }
  ],
  varliklar: [
    { ad: "Mevduat", tur: "mevduat", deger: 300000 },
    { ad: "Ev", tur: "konut", deger: 4000000 },
    { ad: "Altın", tur: "altin", deger: 200000 }
  ],
  borclar: [
    { ad: "Konut kredisi", tur: "konut-sabit", kalanAnapara: 1500000,
      aylikFaiz: 0.021, kalanVadeAy: 96, aylikOdeme: 35000 },
    { ad: "İhtiyaç", tur: "ihtiyac", kalanAnapara: 120000,
      aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }
  ],
  varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30, yatirimGetirisi: 0.35, ufukYil: 20 }
};

/* ------------------------------------------------------------------ */
console.log("Bos profil tutarli");
var b = P.bos();
esit("surum yazili", b.surum, P.SURUM, 0);
dogru("diziler bos", !b.gelirler.length && !b.giderler.length &&
  !b.varliklar.length && !b.borclar.length);
dogru("uc senaryo var", !!(b.senaryolar.kotumser && b.senaryolar.baz && b.senaryolar.iyimser));
esit("baz senaryoda kayma yok", b.senaryolar.baz.enflasyonKaymasi, 0);
/* Iki cagri birbirinin referansini paylasmamali; yoksa bir profildeki
   degisiklik digerine sizar. */
var b2 = P.bos();
b2.gelirler.push({ ad: "X" });
esit("bos() her cagride YENI nesne", P.bos().gelirler.length, 0, 0);
esit("onceki nesne etkilenmedi", b.gelirler.length, 0, 0);

/* ------------------------------------------------------------------ */
console.log("\nNORMALIZE — bozuk girdi araci cokertmez");
dogru("null normalize edilebiliyor", P.normalize(null).surum === P.SURUM);
dogru("dizi normalize edilebiliyor", P.normalize([1, 2, 3]).gelirler.length === 0);
dogru("metin normalize edilebiliyor", P.normalize("bozuk").giderler.length === 0);

var bozuk = P.normalize({
  kisi: { dogumYili: "bin dokuz yuz", emeklilikHedefYasi: 500, haneBuyuklugu: -3 },
  gelirler: [{ ad: "", tur: "uydurma-tur", aylikBrut: "cok" }],
  giderler: [{ ad: 12345, aylik: -900 }],
  varliklar: [{ tur: "elmas", deger: NaN }],
  borclar: [{ kalanVadeAy: 3.7, aylikFaiz: "yuksek" }],
  varsayimlar: { enflasyon: "bilinmiyor", ufukYil: 999 },
  bilinmeyenAlan: { tehlikeli: true }
});
esit("gecersiz dogum yili null", bozuk.kisi.dogumYili === null ? 1 : 0, 1, 0);
esit("emeklilik yasi tavana cekildi", bozuk.kisi.emeklilikHedefYasi, 90, 0);
esit("hane buyuklugu tabana cekildi", bozuk.kisi.haneBuyuklugu, 1, 0);
esit("bilinmeyen gelir turu 'diger'", bozuk.gelirler[0].tur === "diger" ? 1 : 0, 1, 0);
esit("sayi olmayan tutar sifir", bozuk.gelirler[0].aylikNet, 0);
esit("bos ad varsayilana indi", bozuk.gelirler[0].ad === "Gelir" ? 1 : 0, 1, 0);
esit("sayi olan ad metne cevrildi", bozuk.giderler[0].ad === "12345" ? 1 : 0, 1, 0);
esit("negatif tutar reddedildi", bozuk.giderler[0].aylik, 0);
esit("bilinmeyen varlik turu 'diger'", bozuk.varliklar[0].tur === "diger" ? 1 : 0, 1, 0);
esit("NaN deger sifir", bozuk.varliklar[0].deger, 0);
esit("ondalik vade tamsayiya", bozuk.borclar[0].kalanVadeAy, 4, 0);
esit("gecersiz enflasyon varsayilana", bozuk.varsayimlar.enflasyon, 0.30);
esit("ufuk tavana cekildi", bozuk.varsayimlar.ufukYil, 60, 0);
dogru("bilinmeyen alan DUSTU", bozuk.bilinmeyenAlan === undefined);

console.log("\nHer kaleme kimlik veriliyor");
var kimlikli = P.normalize(ORNEK);
dogru("butun kalemlerin id'si var", []
  .concat(kimlikli.gelirler, kimlikli.giderler, kimlikli.varliklar, kimlikli.borclar)
  .every(function (k) { return typeof k.id === "string" && k.id.length > 0; }));
var idler = [].concat(kimlikli.gelirler, kimlikli.giderler,
  kimlikli.varliklar, kimlikli.borclar).map(function (k) { return k.id; });
esit("id'ler benzersiz", new Set(idler).size, idler.length, 0);
/* Verilmis id KORUNUR: yoksa her normalize'da kimlikler degisir ve
   arayuzdeki secim/odak kaybolur. */
esit("verilen id korunuyor",
  P.normalize({ giderler: [{ id: "sabit-1", ad: "A", aylik: 1 }] }).giderler[0].id === "sabit-1" ? 1 : 0, 1, 0);

/* ------------------------------------------------------------------ */
console.log("\nUcret geliri BRUT tutuluyor");
/* Net saklamak, yil ve mevzuat degisince kaydi sessizce eskitirdi. */
var u = kimlikli.gelirler.filter(function (g) { return g.tur === "ucret"; })[0];
esit("brut alani dolu", u.aylikBrut, 100000);
esit("net alani sifir", u.aylikNet, 0);
var kira = kimlikli.gelirler.filter(function (g) { return g.tur === "kira"; })[0];
esit("ucret disi gelirde net dolu", kira.aylikNet, 15000);
esit("ucret disi gelirde brut sifir", kira.aylikBrut, 0);

console.log("\nLikidite TURE bagli, girdiye degil");
/* "Nakit ihtiyacimda evimi satarim" bir plan degil. */
var evi = kimlikli.varliklar.filter(function (v) { return v.tur === "konut"; })[0];
dogru("konut likit DEGIL", evi.likit === false);
dogru("mevduat likit", kimlikli.varliklar.filter(function (v) {
  return v.tur === "mevduat"; })[0].likit === true);
dogru("altin likit", kimlikli.varliklar.filter(function (v) {
  return v.tur === "altin"; })[0].likit === true);
/* Kullanici likit:true derse bile ture bakilir. */
dogru("kullanici likit demesi TURU EZMEZ",
  P.normalize({ varliklar: [{ tur: "konut", deger: 1, likit: true }] })
    .varliklar[0].likit === false);

/* ------------------------------------------------------------------ */
console.log("\nOZET — bugunun fotografi");
var o = P.ozet(kimlikli);
esit("toplam varlik 4.500.000", o.toplamVarlik, 4500000);
esit("likit varlik 500.000 (ev haric)", o.likitVarlik, 500000);
esit("toplam borc 1.620.000", o.toplamBorc, 1620000);
esit("net deger 2.880.000", o.netDeger, 2880000);
esit("aylik borc odemesi 42.000", o.aylikBorcOdemesi, 42000);
esit("aylik gider 38.500", o.aylikGider, 38500);
esit("zorunlu gider 36.000", o.zorunluGider, 36000);
esit("aylik zorunlu yuk 78.000", o.aylikZorunluYuk, 78000);
/* DAYANMA SURESI: likit / (zorunlu gider + borc odemesi) */
esit("dayanma suresi 500.000 / 78.000", o.dayanmaAy, 500000 / 78000, 1e-9);
dogru("dayanma suresi 6-7 ay arasinda", o.dayanmaAy > 6 && o.dayanmaAy < 7);
/* Istege bagli harcamayi paydaya koymak sureyi KISA gosterirdi. */
dogru("istege bagli gider paydada YOK",
  Math.abs(o.dayanmaAy - 500000 / (38500 + 42000)) > 0.1);
esit("yas hesaplaniyor", o.yas, new Date().getFullYear() - 1990, 0);
esit("eksik yok", o.eksikler.length, 0, 0);

console.log("\nOzet, bos profilde patlamaz");
var bo = P.ozet(P.bos());
esit("net deger sifir", bo.netDeger, 0);
dogru("dayanma suresi null (bolme yok)", bo.dayanmaAy === null);
dogru("eksikler raporlaniyor", bo.eksikler.length === 4);
dogru("yas null", bo.yas === null);

/* ------------------------------------------------------------------ */
console.log("\nSENARYOLAR — kaymalar tabanin uzerine biniyor");
var kot = P.senaryoVarsayimlari(kimlikli, "kotumser");
var baz = P.senaryoVarsayimlari(kimlikli, "baz");
var iyi = P.senaryoVarsayimlari(kimlikli, "iyimser");
esit("baz = taban varsayim", baz.enflasyon, 0.30);
esit("kotumserde enflasyon yuksek", kot.enflasyon, 0.36, 1e-9);
esit("kotumserde getiri dusuk", kot.yatirimGetirisi, 0.32, 1e-9);
esit("iyimserde enflasyon dusuk", iyi.enflasyon, 0.27, 1e-9);

/* KALIBRASYON REEL GETIRI UZERINDEN. Ilk surumde kaymalar nominal
   secilmisti ve makul gorunuyordu; 20 yillik projeksiyonda olculunce
   kotumserin REEL getirisi -%15,2, iyimserinki +%18,9 cikti. Yirmi yil
   surdurulen boyle oranlar senaryo degil kuyruk olayidir. Bu testler
   kalibrasyonu REEL tarafta sabitliyor ki bir daha nominal tarafta
   "makul gorunen" bir kayma sessizce geri gelmesin. */
function reelGetiri(v) { return (1 + v.yatirimGetirisi) / (1 + v.enflasyon) - 1; }
esit("kotumser reel getiri ~-%2,9", reelGetiri(kot), -0.0294, 0.002);
esit("baz reel getiri ~+%3,8", reelGetiri(baz), 0.0385, 0.002);
esit("iyimser reel getiri ~+%7,9", reelGetiri(iyi), 0.0787, 0.002);
dogru("uc senaryonun reel getirisi de surdurulebilir araliklarda",
  reelGetiri(kot) > -0.08 && reelGetiri(iyi) < 0.12);
dogru("siralama korunuyor: kotumser < baz < iyimser (getiri)",
  kot.yatirimGetirisi < baz.yatirimGetirisi && baz.yatirimGetirisi < iyi.yatirimGetirisi);
dogru("siralama korunuyor: kotumser > baz > iyimser (enflasyon)",
  kot.enflasyon > baz.enflasyon && baz.enflasyon > iyi.enflasyon);

/* CIFTE SAYIM YOK: reel ucret = (1+ucret)/(1+enflasyon)-1 oldugu icin
   enflasyon kaymasi TEK BASINA reel ucreti eritiyor. Kotumserde ustune
   bir de nominal ucret kaymasi eklemek ayni seyi iki kez saymakti ve
   reel ucreti yilda -%7,4'e indiriyordu (20 yilda bugunkunun %22'si).
   Test reel ucret artisini makul bir bantta sabitliyor. */
function reelUcret(v) { return (1 + v.ucretArtisi) / (1 + v.enflasyon) - 1; }
esit("kotumser reel ucret ~-%4,4", reelUcret(kot), -0.0441, 0.003);
esit("baz reel ucret sifir", reelUcret(baz), 0, 1e-9);
esit("iyimser reel ucret ~+%3,9", reelUcret(iyi), 0.0394, 0.003);
dogru("kotumserde reel ucret bir cokus degil (>-%6)", reelUcret(kot) > -0.06);

/* Taban degisince UC SENARYO BIRLIKTE kayiyor; aralarindaki mesafe
   korunuyor. Mutlak sayi saklasaydik taban degisince kopariklardi. */
var yuksek = P.normalize(ORNEK);
yuksek.varsayimlar.enflasyon = 0.50;
esit("taban artinca kotumser de artti",
  P.senaryoVarsayimlari(yuksek, "kotumser").enflasyon, 0.56, 1e-9);
esit("mesafe korundu",
  P.senaryoVarsayimlari(yuksek, "kotumser").enflasyon -
  P.senaryoVarsayimlari(yuksek, "baz").enflasyon,
  kimlikli.senaryolar.kotumser.enflasyonKaymasi, 1e-9);

/* Enflasyon negatife inemez: bu modelde deflasyon varsayimi yok. */
var dusuk = P.normalize(ORNEK);
dusuk.varsayimlar.enflasyon = 0.02;
esit("enflasyon sifirin altina inmiyor",
  P.senaryoVarsayimlari(dusuk, "iyimser").enflasyon, 0, 1e-9);

dogru("bilinmeyen senaryo adi baza duser",
  P.senaryoVarsayimlari(kimlikli, "uydurma").enflasyon === baz.enflasyon);

/* ------------------------------------------------------------------ */
console.log("\nDISA/ICE AKTARMA — gidip gelen profil ayni kalmali");
var metinVeri = P.disaAktar(kimlikli);
var geri = P.iceAktar(metinVeri);
dogru("hata yok", !geri.hata);
esit("gelir sayisi ayni", geri.profil.gelirler.length, kimlikli.gelirler.length, 0);
esit("net deger ayni", P.ozet(geri.profil).netDeger, o.netDeger, 0.01);
esit("id'ler korundu", geri.profil.giderler[0].id === kimlikli.giderler[0].id ? 1 : 0, 1, 0);
esit("senaryo kaymalari korundu",
  geri.profil.senaryolar.kotumser.enflasyonKaymasi,
  kimlikli.senaryolar.kotumser.enflasyonKaymasi);
dogru("disa aktarim tarih damgasi tasiyor", !!JSON.parse(metinVeri).guncelleme);

console.log("\nIce aktarma bozuk dosyayi REDDEDER");
dogru("gecersiz JSON", !!P.iceAktar("{bozuk").hata);
dogru("JSON ama nesne degil", !!P.iceAktar("42").hata);
dogru("surumsuz dosya", !!P.iceAktar('{"gelirler":[]}').hata);
/* GELECEKTEN gelen dosya tahmin EDILMEZ: bugunun semasiyla okumak
   kullanicinin verisini sessizce bozmak olurdu. */
var gelecek = P.iceAktar('{"surum":99,"gelirler":[]}');
dogru("gelecek surum reddedildi", !!gelecek.hata);
dogru("red sebebi acik", /v99/.test(gelecek.hata));
dogru("ayni surum kabul", !P.iceAktar('{"surum":1,"gelirler":[]}').hata);

/* ------------------------------------------------------------------ */
console.log("\nSAKLAMA — ONAY OLMADAN YAZMAZ");
var d = sahteDepo();
dogru("bastan onay yok", P.onayVar(d) === false);
var s1 = P.sakla(kimlikli, d);
dogru("onaysiz yazilmadi", s1.yazildi === false && s1.sebep === "onay-yok");
dogru("depoda profil YOK", d.getItem(P.ANAHTAR) === null);
dogru("onaysiz yukleme null", P.yukle(d) === null);

console.log("\nOnay verilince yaziyor");
P.onayVer(true, d);
dogru("onay okunuyor", P.onayVar(d) === true);
var s2 = P.sakla(kimlikli, d);
dogru("yazildi", s2.yazildi === true);
var okunan = P.yukle(d);
dogru("geri okundu", !!okunan);
esit("net deger korundu", P.ozet(okunan).netDeger, o.netDeger, 0.01);

console.log("\nOnay geri alinca VERI DE SILINIYOR");
/* Onayi geri almak "bundan sonra yazma" degil, "sakladigini da sil"
   anlamina gelmeli; aksi halde kullanici sildigini sanirken veri kalir. */
P.onayVer(false, d);
dogru("onay kalkti", P.onayVar(d) === false);
dogru("depodaki profil silindi", d.getItem(P.ANAHTAR) === null);
dogru("yukleme null", P.yukle(d) === null);

console.log("\nDepo yoksa ya da patlarsa sessizce patlamaz");
var yok = P.sakla(kimlikli, null);
dogru("depo yoksa sebep bildiriliyor", yok.yazildi === false);
var patlak = sahteDepo(true);
/* Onay yazmaya calisirken de patlar; onayVer false donmeli. */
dogru("patlayan depoda onay verilemiyor", P.onayVer(true, patlak) === false);
dogru("patlayan depoda yazilmiyor", P.sakla(kimlikli, patlak).yazildi === false);
dogru("patlayan depoda yukleme null", P.yukle(patlak) === null);

console.log("\nSil");
var d2 = sahteDepo();
P.onayVer(true, d2);
P.sakla(kimlikli, d2);
dogru("once var", d2.getItem(P.ANAHTAR) !== null);
P.sil(d2);
dogru("sonra yok", d2.getItem(P.ANAHTAR) === null);

/* ------------------------------------------------------------------ */
console.log("\nKISISEL VERI ALANI YOK");
/* Ad, e-posta, TCKN, IBAN girilse bile semaya girmemeli. */
var sizinti = P.normalize({
  kisi: { dogumYili: 1990, ad: "Ali Veli", eposta: "a@b.c", tckn: "11111111111" },
  iban: "TR00 0000",
  gelirler: [{ ad: "Maaş", tur: "ucret", aylikBrut: 1, isveren: "X A.Ş." }]
});
dogru("ad alani yok", sizinti.kisi.ad === undefined);
dogru("eposta alani yok", sizinti.kisi.eposta === undefined);
dogru("tckn alani yok", sizinti.kisi.tckn === undefined);
dogru("iban alani yok", sizinti.iban === undefined);
dogru("isveren alani yok", sizinti.gelirler[0].isveren === undefined);
dogru("disa aktarimda da yok", P.disaAktar(sizinti).indexOf("Ali Veli") < 0);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (profil kontrolleri)");
