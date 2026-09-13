#!/usr/bin/env node
/*
 * Hedef motoru regresyonlari.
 *
 * NEDEN: bu motor kullaniciya "hedefine ulasiyorsun" ya da "ulasmiyorsun"
 * diyor. Yanlis bir "ulasiyorsun", plan yapan birini yillar sonra
 * odeyemeyecegi bir yukumlulugun onunde birakir. Ve hata sessizdir:
 * cikti yine bir yesil tik, yalnizca yanlis.
 *
 * Ayrica bu dosya bir SUNUM kuralini da koruyor: "3 senaryodan 2'si" bir
 * OLASILIK DEGILDIR ve motor hicbir yerde yuzde uretmez.
 */
"use strict";
var P = require("./profil.js");
var I = require("./ikiz-motoru.js");
var H = require("./hedef-motoru.js");
var hata = 0;
var gecen = 0;

function esit(ad, b, bek, tol) {
  var t = tol === undefined ? 0.5 : tol;
  if (!(Math.abs(b - bek) <= t)) {
    hata++;
    console.error("  BASARISIZ  " + ad + "\n      beklenen " + bek + ", bulunan " + b);
  } else { gecen++; console.log("  tamam      " + ad); }
}
function dogru(ad, k) { esit(ad, k ? 1 : 0, 1, 0); }

var Y = new Date().getFullYear();
function profil(hedefler, ek) {
  var t = {
    kisi: { dogumYili: 1990 },
    gelirler: [{ ad: "Maas", tur: "ucret", aylikBrut: 100000 }],
    giderler: [{ ad: "Kira", aylik: 22000, zorunlu: true },
               { ad: "Diger", aylik: 34500, zorunlu: true }],
    varliklar: [{ ad: "Mevduat", tur: "mevduat", deger: 450000 }],
    borclar: [], olaylar: [], hedefler: hedefler || [],
    varsayimlar: { enflasyon: 0.30, ucretArtisi: 0.30,
      yatirimGetirisi: 0.35, ufukYil: 20 }
  };
  for (var k in (ek || {})) if (Object.prototype.hasOwnProperty.call(ek, k)) t[k] = ek[k];
  return P.normalize(t);
}

/* ------------------------------------------------------------------ */
console.log("Sema");
var bosH = P.normalize({ hedefler: [{ ad: "Yilsiz", tur: "servet", tutar: 1 }] });
esit("yili olmayan hedef ayiklanir", bosH.hedefler.length, 0, 0);
var siraliH = P.normalize({ hedefler: [
  { ad: "B", tur: "servet", yil: Y + 9, tutar: 1 },
  { ad: "A", tur: "servet", yil: Y + 2, tutar: 1 }
] });
esit("hedefler yila gore sirali", siraliH.hedefler[0].ad === "A" ? 1 : 0, 1, 0);
esit("bilinmeyen tur 'servet'e duser",
  P.normalize({ hedefler: [{ tur: "uydurma", yil: Y + 1, tutar: 1 }] })
    .hedefler[0].tur === "servet" ? 1 : 0, 1, 0);

/* ------------------------------------------------------------------ */
console.log("\nSAYIM, OLASILIK DEGIL");
/* Motorun ciktisinda hicbir yerde yuzde/olasilik alani OLMAMALI.
   Uc senaryo bir orneklem degil, kullanicinin sectigi uc varsayim. */
var k = H.kontrol(profil([{ ad: "H", tur: "servet", yil: Y + 10, tutar: 1500000 }]));
var h0 = k.hedefler[0];
esit("toplam senaryo 3", h0.toplamSenaryo, 3, 0);
dogru("tutan sayisi 0-3 arasinda tam sayi",
  h0.tutanSenaryoSayisi >= 0 && h0.tutanSenaryoSayisi <= 3 &&
  h0.tutanSenaryoSayisi === Math.round(h0.tutanSenaryoSayisi));
dogru("ciktida 'olasilik' alani yok",
  Object.keys(h0).every(function (a) { return !/olasilik|ihtimal|yuzde/i.test(a); }));
dogru("ciktinin tamaminda yuzde alani yok",
  JSON.stringify(k).indexOf("olasilik") < 0);

console.log("\nUc senaryonun hepsi sinaniyor");
dogru("uc senaryo da raporlandi",
  !!(h0.senaryolar.kotumser && h0.senaryolar.baz && h0.senaryolar.iyimser));
/* Iyimser tutuyorsa ve kotumser tutmuyorsa, tutan sayisi tutarli olmali. */
var sayim = ["kotumser", "baz", "iyimser"].filter(function (s) {
  return h0.senaryolar[s].tuttu;
}).length;
esit("tutan sayisi senaryolarla tutarli", h0.tutanSenaryoSayisi, sayim, 0);

console.log("\nSIRALAMA — iyimser tutuyorsa baz da tutmali (ayni hedefte)");
/* Servet hedefinde iyimser >= baz >= kotumser oldugu icin, tutma da
   bu sirayi izlemeli. Aksi, senaryo kalibrasyonunun bozuldugu anlamina
   gelir ve bu testin yakalamasi gerekir. */
[500000, 1500000, 3000000, 8000000].forEach(function (t) {
  var kk = H.kontrol(profil([{ ad: "T", tur: "servet", yil: Y + 15, tutar: t }]));
  var hh = kk.hedefler[0];
  dogru("hedef " + t + ": tutma sirasi kotumser<=baz<=iyimser",
    (hh.senaryolar.kotumser.tuttu ? 1 : 0) <= (hh.senaryolar.baz.tuttu ? 1 : 0) &&
    (hh.senaryolar.baz.tuttu ? 1 : 0) <= (hh.senaryolar.iyimser.tuttu ? 1 : 0));
});

/* ------------------------------------------------------------------ */
console.log("\nUC HEDEF TURU, UC FARKLI OLCU");
/* Servet hedefi NET DEGERE, harcama hedefi YATIRIM VARLIGINA bakar.
   Ikisini karistirmak "hedefe ulastiniz" deyip odeyememeye yol acardi:
   oturdugunuz evin degeri pesinat odemez. */
var evli = profil([
  { ad: "Servet", tur: "servet", yil: Y + 5, tutar: 4000000 },
  { ad: "Pesinat", tur: "harcama", yil: Y + 5, tutar: 4000000 }
], { varliklar: [
  { ad: "Ev", tur: "konut", deger: 5000000 },
  { ad: "Mevduat", tur: "mevduat", deger: 200000 }
] });
var ek = H.kontrol(evli);
var servetH = ek.hedefler.filter(function (x) { return x.ad === "Servet"; })[0];
var pesinatH = ek.hedefler.filter(function (x) { return x.ad === "Pesinat"; })[0];
dogru("servet hedefi tutuyor (ev net degere giriyor)", servetH.bazTuttu === true);
dogru("harcama hedefi TUTMUYOR (ev pesinat odemez)", pesinatH.bazTuttu === false);
dogru("ayni tutar, farkli sonuc", servetH.tutar === pesinatH.tutar);

console.log("\nBorcsuzluk hedefi");
/* Kredi 24 ayda kapaniyor: Y+0 ilk yil, Y+1 ikinci yil (borc 8.445),
   Y+2 ucuncu yil (borc 0). Ilk yazimda Y+2'de "henuz borc var" bekliyordum
   ve dustu -- yil indeksini bir kaydirmisim; kod dogruydu. */
var borclu = profil([{ ad: "Borcsuz", tur: "borcsuzluk", yil: Y + 1, tutar: 0 }],
  { borclar: [{ ad: "Kredi", tur: "ihtiyac", kalanAnapara: 120000,
    aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }] });
var erken = H.kontrol(borclu).hedefler[0];
var gec = H.kontrol(profil([{ ad: "Borcsuz", tur: "borcsuzluk", yil: Y + 5, tutar: 0 }],
  { borclar: [{ ad: "Kredi", tur: "ihtiyac", kalanAnapara: 120000,
    aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }] })).hedefler[0];
dogru("ikinci yilda henuz borc var", erken.bazTuttu === false);
dogru("5. yilda borc bitmis", gec.bazTuttu === true);
dogru("borcsuzluk uc senaryoda da ayni (borc odemesi senaryodan bagimsiz)",
  gec.tutanSenaryoSayisi === 3);
/* Borcsuz bir profilde hedef ilk yildan tutmali. */
dogru("borcu olmayanda ilk yildan tutuyor",
  H.kontrol(profil([{ ad: "B", tur: "borcsuzluk", yil: Y + 1, tutar: 0 }]))
    .hedefler[0].bazTuttu === true);

/* ------------------------------------------------------------------ */
console.log("\nACIK ve ILK TUTAN YIL");
/* 1.500.000 hedefi bu profilde 2036'da asiliyor (olculdu). Y+3'te
   konulunca tutmuyor ama ILERIDE tutuyor -- "ne zaman ulasirim"
   sorusunun cevabi test edilebilir hale geliyor. */
var uzak = H.kontrol(profil([{ ad: "Uzak", tur: "servet",
  yil: Y + 3, tutar: 1500000 }])).hedefler[0];
dogru("tutmayan hedefte acik pozitif", uzak.bazAcik > 0);
dogru("ilk tutan yil hedef yilindan SONRA", uzak.bazIlkTutanYil > Y + 3);

/* Ufukta HIC ulasilamayan hedefte ilk tutan yil NULL olmali -- uydurma
   bir yil dondurulmemeli. */
var hicbirZaman = H.kontrol(profil([{ ad: "Cok", tur: "servet",
  yil: Y + 3, tutar: 500000000 }])).hedefler[0];
dogru("ulasilamayan hedefte ilk tutan yil null",
  hicbirZaman.bazIlkTutanYil === null);
var yakin = H.kontrol(profil([{ ad: "Yakin", tur: "servet",
  yil: Y + 15, tutar: 500000 }])).hedefler[0];
esit("tutan hedefte acik sifir", yakin.bazAcik, 0, 0.01);
dogru("ilk tutan yil hedeften ONCE olabilir", yakin.bazIlkTutanYil <= Y + 15);

console.log("\nUfuk disi hedef");
var disi = H.kontrol(profil([{ ad: "Cok uzak", tur: "servet",
  yil: Y + 40, tutar: 1000 }])).hedefler[0];
dogru("ufuk disi isaretlendi", disi.ufukDisi === true);
dogru("ufuk disi hedef sayimda yok",
  H.kontrol(profil([{ ad: "Cok uzak", tur: "servet", yil: Y + 40, tutar: 1000 }]))
    .tumSenaryolardaTutan === 0);

/* ------------------------------------------------------------------ */
console.log("\nGEREKEN EK TASARRUF — ikiye bolme, yaklasik formul degil");
var pr = profil([{ ad: "Pesinat", tur: "harcama", yil: Y + 5, tutar: 2000000 }]);
var hedef = pr.hedefler[0];
var g = H.gerekenEkTasarruf(pr, hedef);
dogru("cozum bulundu", g.bulundu === true && g.aylik > 0);

/* KESKINLIK: bulunan tutarla TUTMALI, biraz azinda TUTMAMALI.
   Ilk yazimda ek tasarruf NEGATIF GIDER olarak ekleniyordu ve profil
   semasi negatifi reddedip sifira cekiyordu -- yani her deneme ayniydi
   ve ikiye bolme hep "ulasilamaz" diyordu. Sema dogru davraniyordu;
   hata veri katmaninin kuralini dolanmaya calismakti. */
function ekIle(tutar) {
  var kopya = JSON.parse(JSON.stringify(pr));
  kopya.gelirler.push({ ad: "Ek", tur: "diger", aylikNet: tutar });
  return H.sina(I.projeksiyon(P.normalize(kopya), "baz"), hedef).tuttu;
}
dogru("bulunan tutarla TUTUYOR", ekIle(g.aylik) === true);
dogru("2.000 azinda TUTMUYOR", ekIle(g.aylik - 2000) === false);

var zaten = H.gerekenEkTasarruf(profil([{ ad: "Kolay", tur: "servet",
  yil: Y + 15, tutar: 100000 }]), { ad: "Kolay", tur: "servet",
  yil: Y + 15, tutar: 100000 });
esit("zaten tutan hedefte ek tasarruf sifir", zaten.aylik, 0, 0);
dogru("sebebi yaziyor", zaten.sebep === "zaten-tutuyor");

var imkansiz = H.gerekenEkTasarruf(profil(), { ad: "Imkansiz", tur: "servet",
  yil: Y + 3, tutar: 500000000 });
dogru("ulasilamaz hedef bildiriliyor",
  imkansiz.bulundu === false && imkansiz.sebep === "ulasilamaz");
dogru("ulasilamazda tutar UYDURULMUYOR", imkansiz.aylik === null);

console.log("\nGEREKEN ERTELEME — bazen cevap daha cok biriktirmek degil");
var ert = H.gerekenErteleme(pr, hedef);
dogru("erteleme gerekli", ert.gerekli === true);
dogru("erteleme yili pozitif", ert.yil > 0);
esit("hedef yili + erteleme = ilk tutan yil",
  hedef.yil + ert.yil, ert.hedefYili, 0);
var ertYok = H.gerekenErteleme(profil([{ ad: "K", tur: "servet",
  yil: Y + 15, tutar: 100000 }]), { ad: "K", tur: "servet",
  yil: Y + 15, tutar: 100000 });
dogru("tutan hedefte erteleme gerekmiyor", ertYok.gerekli === false);

/* ------------------------------------------------------------------ */
console.log("\nOnbellek kullanimi");
/* Ayni projeksiyonlar tekrar kosulmamali: sayfa her tus vurusunda
   hesapliyor ve uc senaryo x 240 ay zaten pahali. */
var onbellek = {
  kotumser: I.projeksiyon(pr, "kotumser"),
  baz: I.projeksiyon(pr, "baz"),
  iyimser: I.projeksiyon(pr, "iyimser")
};
var onbellekli = H.kontrol(pr, onbellek);
var onbelleksiz = H.kontrol(pr);
esit("onbellekli ve onbelleksiz ayni sonuc",
  onbellekli.hedefler[0].tutanSenaryoSayisi,
  onbelleksiz.hedefler[0].tutanSenaryoSayisi, 0);

console.log("\nSinir durumlar");
esit("hedefsiz profilde bos liste", H.kontrol(profil()).hedefler.length, 0, 0);
var sifir = H.kontrol(profil([{ ad: "Sifir", tur: "servet", yil: Y + 1, tutar: 0 }]));
dogru("sifir tutarli hedef tutuyor", sifir.hedefler[0].bazTuttu === true);

console.log("\nTekrarlanabilirlik");
esit("ayni girdi ayni sonuc",
  H.kontrol(pr).hedefler[0].tutanSenaryoSayisi,
  H.kontrol(pr).hedefler[0].tutanSenaryoSayisi, 0);

console.log("\nProfil KOPYALANIYOR, degistirilmiyor");
var oncekiGelir = pr.gelirler.length;
H.gerekenEkTasarruf(pr, hedef);
esit("ek tasarruf arama profili bozmadi", pr.gelirler.length, oncekiGelir, 0);

if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
console.log("\n" + gecen + " gecti, 0 kaldi. (hedef kontrolleri)");
