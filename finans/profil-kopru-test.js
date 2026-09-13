#!/usr/bin/env node
/*
 * Profil koprusu regresyonlari.
 *
 * NEDEN: bu kopru kullanicinin EN HASSAS verisini (maas, borc, varlik)
 * bir araca tasiyor. Iki kural sessizce bozulabilir ve ikisi de agir:
 *   - onay yokken veri okunursa, "verileriniz cihazinizdan cikmaz"
 *     iddiasinin dayandigi titizlik cokmus olur;
 *   - araclara YAZAN bir kopru, "su hesabi bir deneyeyim" diyen birinin
 *     gercek profilini bozar.
 * Ikisi de burada sabitleniyor.
 *
 * DOM yok: minimal bir sahte element yeterli, cunku kopru yalnizca
 * innerHTML, querySelector ve addEventListener kullaniyor.
 */
"use strict";
var P = require("./profil.js");
var K = require("./profil-kopru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

/* Sahte element: innerHTML'i saklar, querySelector ile "dugme" ve
   "sonuc" dondurur. */
function sahteHedef() {
  var dinleyiciler = {};
  var kutu = {
    innerHTML: "",
    querySelector: function (sec) {
      if (kutu.innerHTML.indexOf(sec.replace("#", 'id="')) < 0) return null;
      var ad = sec.replace("#", "");
      return {
        set disabled(v) { kutu[ad + "Kilit"] = !!v; },
        get disabled() { return !!kutu[ad + "Kilit"]; },
        addEventListener: function (tip, f) { dinleyiciler[ad + ":" + tip] = f; },
        set textContent(v) { kutu[ad + "Metin"] = v; },
        get textContent() { return kutu[ad + "Metin"] || ""; }
      };
    },
    tikla: function () {
      var f = dinleyiciler["pk-doldur:click"];
      if (!f) throw new Error("dugme yok");
      f();
    }
  };
  return kutu;
}

function sahteDepo() {
  var k = {};
  return {
    getItem: function (a) { return Object.prototype.hasOwnProperty.call(k, a) ? k[a] : null; },
    setItem: function (a, v) { k[a] = String(v); },
    removeItem: function (a) { delete k[a]; }
  };
}

var DOLU = P.normalize({
  gelirler: [{ ad: "Maas", tur: "ucret", aylikBrut: 100000 }],
  giderler: [{ ad: "Kira", aylik: 22000, zorunlu: true }],
  varliklar: [{ ad: "Mevduat", tur: "mevduat", deger: 300000 }],
  borclar: [{ ad: "Kredi", tur: "ihtiyac", kalanAnapara: 120000,
    aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }]
});

/* ------------------------------------------------------------------ */
console.log("veriVar — araca gore");
dogru("gelir var", K.veriVar(DOLU, ["gelir"]));
dogru("borc var", K.veriVar(DOLU, ["borc"]));
dogru("profil null ise yok", K.veriVar(null, ["gelir"]) === false);
var borcsuz = P.normalize({ gelirler: [{ tur: "ucret", aylikBrut: 1 }] });
dogru("borcsuz profilde borc yok", K.veriVar(borcsuz, ["borc"]) === false);
dogru("bilinmeyen alan adi false", K.veriVar(DOLU, ["uydurma"]) === false);
dogru("alanlardan BIRI varsa yeterli", K.veriVar(borcsuz, ["borc", "gelir"]) === true);
dogru("bos alan listesi false", K.veriVar(DOLU, []) === false);

/* ------------------------------------------------------------------ */
console.log("\nONAY YOKKA BUTON YOK — ve veri OKUNMAZ");
/* Bu iki cumle ayni sey degil: buton gostermemek gorunum, veri
   okumamak guvenlik. Ikisi de test ediliyor. */
var depo = sahteDepo();
/* Onay verilmemis: sakla() zaten yazmaz, yukle() de null doner. */
P.sakla(DOLU, depo);
var h1 = sahteHedef();
/* Kopru varsayilan depoyu (localStorage) kullanir; Node'da yoktur,
   dolayisiyla profil bulunamaz -- "onay yok" durumunun ta kendisi. */
K.bagla({ hedef: h1, alanlar: ["gelir"], doldur: function () { return ["olmamali"]; } });
dogru("buton YOK", h1.innerHTML.indexOf("pk-doldur") < 0);
dogru("sessiz satir var", h1.innerHTML.indexOf("pk-sessiz") >= 0);
dogru("Ikiz'e baglanti var", h1.innerHTML.indexOf("finansal-ikiz") >= 0);
dogru("verinin cihazda kaldigi soyleniyor",
  /cihaz/i.test(h1.innerHTML));

console.log("\nOzel yol verilebiliyor");
var h2 = sahteHedef();
K.bagla({ hedef: h2, alanlar: ["gelir"], yol: "../finansal-ikiz/",
  doldur: function () { return []; } });
dogru("verilen yol kullaniliyor", h2.innerHTML.indexOf("../finansal-ikiz/") >= 0);

/* ------------------------------------------------------------------ */
console.log("\nPROFIL VARKEN — buton ve NE DOLDURULDUGU");
/* Koprunun global Profil'ini gecici olarak sahteliyoruz ki "profil var"
   yolu da test edilebilsin. */
var gercekYukle = P.yukle;
P.yukle = function () { return DOLU; };

var h3 = sahteHedef();
var cagrildi = 0;
var gelenProfil = null;
K.bagla({
  hedef: h3, alanlar: ["gelir", "gider"], yol: "../finansal-ikiz/",
  doldur: function (p) { cagrildi++; gelenProfil = p; return ["brüt maaş", "3 gider"]; }
});
dogru("buton VAR", h3.innerHTML.indexOf("pk-doldur") >= 0);
dogru("sessiz satir YOK", h3.innerHTML.indexOf("pk-sessiz") < 0);
esit("tiklamadan once doldur cagrilmadi", cagrildi, 0);

h3.tikla();
esit("tiklayinca doldur cagrildi", cagrildi, 1);
dogru("doldur'a profil geldi", gelenProfil === DOLU);
/* NE DOLDURULDUGU SOYLENIR. "Dolduruldu" deyip gecmek, kullanicinin
   formuna ne oldugunu gormeden devam etmesine yol acardi. */
dogru("doldurulan alanlar yaziliyor",
  /brüt maaş/.test(h3["pk-sonucMetin"]) && /3 gider/.test(h3["pk-sonucMetin"]));
dogru("uzerine yazilabilecegi soyleniyor",
  /üzerine yaz/i.test(h3["pk-sonucMetin"]));

console.log("\nDoldur bos donerse bu da soyleniyor");
console.log("\nuygunMu: ALAN VAR ama ICERIK UYMUYORSA buton yok");
/* Somut vaka: profilde borc var, ama hepsi kredi karti. Erken kapatma
   araci sabit vadeli krediyi modelliyor; karti "ihtiyac kredisi" diye
   aktarmak, tazminat hesabini olmayan bir borca uygulamak olurdu.
   Buton hic cikmamali -- tutamayacagi bir soz vermesin. */
var h7 = sahteHedef();
K.bagla({ hedef: h7, alanlar: ["borc"],
  uygunMu: function (p) { return false; },
  doldur: function () { return ["olmamali"]; } });
dogru("uygunMu false ise buton YOK", h7.innerHTML.indexOf("pk-doldur") < 0);
dogru("yerine sessiz satir var", h7.innerHTML.indexOf("pk-sessiz") >= 0);

var h8 = sahteHedef();
K.bagla({ hedef: h8, alanlar: ["borc"],
  uygunMu: function (p) { return p === DOLU; },
  doldur: function () { return ["tamam"]; } });
dogru("uygunMu true ise buton VAR", h8.innerHTML.indexOf("pk-doldur") >= 0);

/* uygunMu patlarsa GUVENLI TARAFA dusulur: buton gosterilmez. Aksi
   halde bozuk bir suzgec, aracin modelleyemedigi bir borcu yine
   aktarirdi. */
var h9 = sahteHedef();
K.bagla({ hedef: h9, alanlar: ["borc"],
  uygunMu: function () { throw new Error("bozuk"); },
  doldur: function () { return ["olmamali"]; } });
dogru("uygunMu patlarsa buton YOK", h9.innerHTML.indexOf("pk-doldur") < 0);

var h10 = sahteHedef();
K.bagla({ hedef: h10, alanlar: ["borc"], doldur: function () { return ["tamam"]; } });
dogru("uygunMu verilmezse eski davranis korunuyor",
  h10.innerHTML.indexOf("pk-doldur") >= 0);

var h4 = sahteHedef();
K.bagla({ hedef: h4, alanlar: ["gelir"], doldur: function () { return []; } });
h4.tikla();
dogru("kullanilabilir veri yok deniyor",
  /bulunamad/i.test(h4["pk-sonucMetin"]));

console.log("\nDoldur patlarsa arac cokmez");
var h5 = sahteHedef();
K.bagla({ hedef: h5, alanlar: ["gelir"],
  doldur: function () { throw new Error("bozuk esleme"); } });
h5.tikla();
dogru("hata yakalandi ve bildirildi", /okunamad/i.test(h5["pk-sonucMetin"]));
dogru("alanlarin degistirilmedigi soyleniyor",
  /degistirilmedi|değiştirilmedi/i.test(h5["pk-sonucMetin"]));

console.log("\nKOPRU PROFILI DEGISTIRMEZ — yalnizca okur");
/* Bir aracin kullanicinin profilini sessizce guncellemesi, "su hesabi
   bir deneyeyim" diyen birinin gercek verisini bozardi. */
var oncekiGelir = DOLU.gelirler.length;
var oncekiBorc = DOLU.borclar[0].kalanAnapara;
var h6 = sahteHedef();
K.bagla({ hedef: h6, alanlar: ["borc"], doldur: function (p) {
  /* Kotu niyetli bir esleme bile profili bozamamali: kopru yazma
     yolu SUNMUYOR. */
  return ["deneme"];
} });
h6.tikla();
esit("gelir sayisi degismedi", DOLU.gelirler.length, oncekiGelir);
esit("borc anaparasi degismedi", DOLU.borclar[0].kalanAnapara, oncekiBorc);
dogru("kopru disa aktarim/yazma islevi sunmuyor",
  typeof K.sakla === "undefined" && typeof K.yaz === "undefined");

P.yukle = gercekYukle;

/* ------------------------------------------------------------------ */
console.log("\nSinir durumlar");
K.bagla(null);
K.bagla({});
dogru("eksik girdide patlamiyor", true);

/* ------------------------------------------------------------------ */
console.log("\nucretNeti — brutten net, TEMBEL yuklenen bordro motoruyla");
/* Profil neti BILEREK saklamiyor: net yila ve mevzuata bagli, saklanan
   bir net bir sonraki bordro yilinda sessizce yanlisa doner. Bu yuzden
   net her seferinde motordan hesaplaniyor -- ve motor yalnizca butona
   basilinca iniyor. Asagidaki sahte DOM tam da o inisi olculuyor. */
var istenenBetikler = [];
global.document = {
  head: { appendChild: function (e) { istenenBetikler.push(e.src); e.onload(); } },
  createElement: function () { return {}; }
};
global.window = {};

console.log("  Ucret geliri yoksa motor HIC INDIRILMEZ");
/* Indirilmemesi bir ayrinti degil: ucret geliri olmayan birinin 20 KB
   bordro motorunu indirmesi icin hicbir sebep yok. */
var ucretsiz = P.normalize({ gelirler: [{ tur: "kira", aylikNet: 15000 }] });
var adim = [];
K.ucretNeti(ucretsiz).then(function (net) {
  esit("ucret yoksa net 0", net, 0);
  esit("hic betik indirilmedi", istenenBetikler.length, 0);
  adim.push("ucretsiz");

  /* Motor indirildiginde: dogru dosyalar, dogru sirada. */
  global.window.Bordro = {
    sonYil: function () { return 2026; },
    hesaplaYil: function (brut, yil) {
      /* Gercek motor degil; burada olculen sey KOPRUNUN davranisi:
         hangi tutari veriyor, sonucu nasil okuyor. */
      sonCagri = { brut: brut, yil: yil };
      return { toplam: { net: brut * 12 * 0.7 } };
    }
  };
  var sonCagriYerel = null;
  return K.ucretNeti(DOLU).then(function (net2) {
    dogru("parametreler.js indirildi",
      istenenBetikler.some(function (x) { return /bordro\/parametreler\.js$/.test(x); }));
    dogru("motor.js indirildi",
      istenenBetikler.some(function (x) { return /bordro\/motor\.js$/.test(x); }));
    esit("motora AYLIK BRUT verildi", sonCagri.brut, 100000);
    esit("yil motorun son yili", sonCagri.yil, 2026);
    /* ON IKI AYIN ORTALAMASI, OCAK DEGIL: kumulatif tarife yuzunden net
       yil icinde DUSUYOR; Ocak netini "aylik net" saymak yillik geliri
       sistematik olarak yukari okumak olurdu. */
    esit("yillik netin 12'ye bolumu", net2, 70000, 0.01);
    adim.push("net");

    var oncekiSayi = istenenBetikler.length;
    return K.ucretNeti(DOLU).then(function () {
      esit("ikinci cagri betikleri TEKRAR indirmiyor",
        istenenBetikler.length, oncekiSayi);
      adim.push("tekrar");

      /* En yuksek brutlu ucret secilir: iki isi olan birinin kucuk
         isini "maasi" saymak yanlis olurdu. */
      var ikiIs = P.normalize({ gelirler: [
        { ad: "Yan is", tur: "ucret", aylikBrut: 20000 },
        { ad: "Asil is", tur: "ucret", aylikBrut: 90000 }] });
      return K.ucretNeti(ikiIs).then(function () {
        esit("en yuksek brutlu ucret secildi", sonCagri.brut, 90000);
        adim.push("enYuksek");
        netBitti();
      });
    });
  });
}).catch(function (e) {
  hata++;
  console.error("  BASARISIZ  ucretNeti zinciri patladi: " + e.message);
  netBitti();
});

var sonCagri = null;
function netBitti() {
  netTamam = true;
  esit("zincirin dort adimi da calisti", adim.length, 4);
}
/* ------------------------------------------------------------------ */
console.log("\ndoldur() SOZ dondurebilir (arac kendi motorunu indirirken)");
/* Tiklayip hicbir sey olmadigini gormek en kotu geri bildirim: bekleme
   suresince buton KILITLI ve durum YAZILI olmali. */
/* Bu blok buton gerektiriyor: profili yeniden sahteliyoruz. */
P.yukle = function () { return DOLU; };
var cozucu = null;
var h11 = sahteHedef();
K.bagla({ hedef: h11, alanlar: ["gelir"], doldur: function () {
  return new Promise(function (c) { cozucu = c; });
} });
h11.tikla();
dogru("beklerken buton kilitli", h11["pk-doldurKilit"] === true);
dogru("beklerken durum yaziliyor", /okunuyor/.test(h11["pk-sonucMetin"]));

/* SESSIZ YESIL TUZAGI — iki kez isirdi, ikisi de burada kapali:

   1. Asenkron blok hic calismazsa Node cikis kodu 0 verir ve test
      "gecti" gorunur.
   2. Iki bagimsiz asenkron zincir varken, kisa olani biterken ozeti
      basip "gecti" derse, uzun zincirin SONRADAN bulacagi hata hicbir
      yere yansimaz.

   Bu yuzden GECTI/KALDI karari tek bir yerde, cikista veriliyor; hicbir
   zincir kendi basina "gecti" diyemiyor. */
var bitisGeldi = false;
var netTamam = false;
function bitir() { bitisGeldi = true; }

process.on("exit", function () {
  if (!bitisGeldi || !netTamam) {
    console.error("\nAsenkron kontroller HIC CALISMADI — bu bir gecis degil.");
    process.exitCode = 1;
    return;
  }
  if (hata) {
    console.error("\n" + hata + " kontrol basarisiz.");
    process.exitCode = 1;
    return;
  }
  console.log("\n" + gecen + " gecti, 0 kaldi. (profil koprusu kontrolleri)");
});

cozucu(["brüt maaş"]);
Promise.resolve().then(function () {}).then(function () {
  esit("soz cozulunce kilit kalkti", h11["pk-doldurKilit"] ? 1 : 0, 0);
  dogru("soz cozulunce alanlar bildirildi", /brüt maaş/.test(h11["pk-sonucMetin"]));

  /* Reddedilen soz: arac cokmemeli, kilit acilmali, alanlarin
     degistirilmedigi soylenmeli. */
  var red = null;
  var h12 = sahteHedef();
  K.bagla({ hedef: h12, alanlar: ["gelir"], doldur: function () {
    return new Promise(function (c, r) { red = r; });
  } });
  h12.tikla();
  red(new Error("motor inmedi"));
  Promise.resolve().then(function () {}).then(function () {
    esit("soz reddedilince kilit kalkti", h12["pk-doldurKilit"] ? 1 : 0, 0);
    dogru("soz reddedilince degistirilmedigi soyleniyor",
      /degistirilmedi|değiştirilmedi/i.test(h12["pk-sonucMetin"]));
    bitir();
  });
});
