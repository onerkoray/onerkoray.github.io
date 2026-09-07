/*!
 * Kredi Çekirdeği — doğrulama testleri.  node kredi-hesaplama/test.js
 *
 * Bir kredi hesabında yanlış sayı, ekranda hata vermeyen türden bir hatadır:
 * taksit makul görünür, plan basılır, yanlışlık ancak bankanın planıyla
 * karşılaştırılınca anlaşılır. Buradaki testler dört değişmezi koruyor:
 *   1. Anapara payları toplamı anaparaya EŞİTTİR (kuruşu kuruşuna).
 *   2. Son taksitten sonra kalan borç SIFIRDIR.
 *   3. YMO, bütün nakit akışlarını bugüne eşitleyen orandır (bağımsız kontrol).
 *   4. Vergiler faizin üzerinden alınır, anaparadan değil.
 */
"use strict";
var K = require("./hesap.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.01); }
function baslik(s) { console.log("\n" + s); }

/* ------------------------------------------------------------------ 1 */
baslik("Annüite formülü");
(function () {
  /* Elde doğrulanabilir durum: 100.000 TL, aylık %1, 12 ay, vergisiz.
     T = 100000 × 0,01 / (1 − 1,01^−12) = 8.884,88 TL */
  var T = K.taksit(100000, 0.01, 12);
  ok("100.000 TL, %1, 12 ay → 8.884,88", yakin(T, 8884.88, 0.01), T.toFixed(2));

  /* Faiz sıfırsa taksit anaparanın vadeye bölümüdür. */
  ok("faiz %0 → anapara / vade", K.taksit(12000, 0, 12) === 1000);
  ok("vade 0 → 0", K.taksit(1000, 0.01, 0) === 0);

  /* Vade uzadıkça taksit düşer ama sonsuza gitmez: faiz kadarına yaklaşır. */
  var uzun = K.taksit(100000, 0.03, 600);
  ok("çok uzun vadede taksit aylık faize yaklaşır",
     uzun > 3000 && uzun < 3010, uzun.toFixed(2));
})();

/* ------------------------------------------------------------------ 2 */
baslik("Brütleşmiş maliyet oranı");
(function () {
  /* %2,89 faiz + %15 KKDF + %15 BSMV → 2,89 × 1,30 = %3,757 */
  var r = K.brutOran(2.89, 15, 15);
  ok("%2,89 + iki vergi → aylık %3,757", yakin(r * 100, 3.757, 0.0005), (r * 100).toFixed(4));
  ok("vergisiz oran faize eşit", K.brutOran(2.5, 0, 0) === 0.025);
  ok("yalnız BSMV %5 → %2,625", yakin(K.brutOran(2.5, 0, 5) * 100, 2.625, 0.0005));
})();

/* ------------------------------------------------------------------ 3 */
baslik("Ödeme planının kapanması");
(function () {
  var p = K.plan({ anapara: 250000, aylikFaiz: 2.89, vade: 36, kkdf: 15, bsmv: 15 });
  ok("plan geçerli", p.gecerli);
  ok("36 satır var", p.satirlar.length === 36, String(p.satirlar.length));

  /* Kuruş tamsayısı sayesinde bu TAM eşitliktir, yaklaşık değil. */
  var anaparaToplam = Math.round(
    p.satirlar.reduce(function (t, s) { return t + s.anapara * 100; }, 0));
  ok("anapara payları toplamı = anapara (kuruşu kuruşuna)",
     anaparaToplam === 25000000, anaparaToplam + " kuruş"); 

  ok("son satırda kalan borç sıfır", p.satirlar[35].kalan === 0,
     String(p.satirlar[35].kalan));

  /* Her satırda: taksit = faiz + kkdf + bsmv + anapara */
  var bozuk = 0, ornekSatir = "";
  p.satirlar.forEach(function (s) {
    var top = Math.round((s.faiz + s.kkdf + s.bsmv + s.anapara) * 100);
    if (top !== Math.round(s.taksit * 100)) {
      bozuk++;
      if (!ornekSatir) ornekSatir = "ay " + s.ay + ": " + (top / 100) + " ≠ " + s.taksit;
    }
  });
  ok("her satır kendi içinde TAM kapanıyor", bozuk === 0,
     bozuk + " satır tutmadı — " + ornekSatir);

  /* Kalan borç her ay azalmalı, hiç artmamalı. */
  var artan = 0;
  for (var i = 1; i < p.satirlar.length; i++) {
    if (p.satirlar[i].kalan > p.satirlar[i - 1].kalan) artan++;
  }
  ok("kalan borç hiç artmıyor", artan === 0, artan + " ayda arttı");

  /* Anapara payı zamanla artar (annüitenin tanımı). */
  ok("anapara payı ilk aydan son aya artar",
     p.satirlar[35].anapara > p.satirlar[0].anapara,
     p.satirlar[0].anapara + " → " + p.satirlar[35].anapara);
})();

/* ------------------------------------------------------------------ 4 */
baslik("Vergiler faizin üzerinden alınıyor");
(function () {
  var p = K.plan({ anapara: 100000, aylikFaiz: 3, vade: 24, kkdf: 15, bsmv: 15 });
  var s = p.satirlar[0];
  ok("KKDF = faiz × %15", yakin(s.kkdf, s.faiz * 0.15, 0.01),
     s.kkdf + " ≠ " + (s.faiz * 0.15).toFixed(2));
  ok("BSMV = faiz × %15", yakin(s.bsmv, s.faiz * 0.15, 0.01));
  ok("toplam vergi = toplam faiz × %30",
     yakin(p.toplamVergi, p.toplamFaiz * 0.30, 0.5),
     p.toplamVergi + " ≠ " + (p.toplamFaiz * 0.30).toFixed(2));

  /* Vergisiz kredi: KKDF ve BSMV sıfır olmalı, faiz aynı formülle. */
  var k = K.plan({ anapara: 100000, aylikFaiz: 3, vade: 24, kkdf: 0, bsmv: 0 });
  ok("konut (vergisiz) planında vergi yok", k.toplamVergi === 0);
  ok("vergisiz taksit daha düşük", k.taksit < p.taksit,
     k.taksit + " < " + p.taksit);
})();

/* ------------------------------------------------------------------ 5 */
baslik("Yıllık maliyet oranı (YMO)");
(function () {
  /* Bağımsız kontrol: YMO doğruysa, taksitlerin o oranla bugüne indirgenmiş
     toplamı ele geçen tutara eşit olmalı. Bu, hesabın kendisini değil
     TANIMINI sınıyor. */
  var girdi = { anapara: 250000, aylikFaiz: 2.89, vade: 36, kkdf: 15, bsmv: 15,
                tahsisOran: 0.5, sigortaPesin: 1200 };
  var p = K.plan(girdi);
  var r = p.ymoAylik / 100;
  var bd = 0;
  p.satirlar.forEach(function (s, i) { bd += s.taksit / Math.pow(1 + r, i + 1); });
  ok("indirgenmiş taksitler = ele geçen tutar",
     yakin(bd, p.eleGecen, 1), bd.toFixed(2) + " ≠ " + p.eleGecen);

  /* Masrafsız ve vergisiz bir kredide YMO, faizin bileşik yıllık karşılığıdır. */
  var saf = K.plan({ anapara: 100000, aylikFaiz: 2, vade: 24, kkdf: 0, bsmv: 0 });
  var beklenen = (Math.pow(1.02, 12) - 1) * 100;
  ok("masrafsız kredide YMO = (1+i)^12 − 1",
     yakin(saf.ymoYillik, beklenen, 0.01),
     saf.ymoYillik.toFixed(4) + " ≠ " + beklenen.toFixed(4));

  /* Bu aracın iddiası: ilan edilen "yıllık" ile gerçek maliyet ayrışır. */
  ok("basit yıllık, YMO'dan küçük", saf.basitYillik < saf.ymoYillik,
     saf.basitYillik + " vs " + saf.ymoYillik.toFixed(2));
  ok("%2 aylık faizin basit yıllığı %24", saf.basitYillik === 24);
  ok("%2 aylık faizin bileşik yıllığı ~%26,8",
     yakin(saf.ymoYillik, 26.824, 0.01), saf.ymoYillik.toFixed(3));

  /* Masraf YMO'yu yükseltmeli: aynı taksiti daha az paraya ödüyorsunuz. */
  var masrafsiz = K.plan({ anapara: 250000, aylikFaiz: 2.89, vade: 36, kkdf: 15, bsmv: 15 });
  ok("peşin masraf YMO'yu yükseltir", p.ymoYillik > masrafsiz.ymoYillik,
     masrafsiz.ymoYillik.toFixed(2) + " → " + p.ymoYillik.toFixed(2));
  ok("masrafsızda ele geçen = anapara", masrafsiz.eleGecen === masrafsiz.anapara);
})();

/* ------------------------------------------------------------------ 6 */
baslik("Erken kapama");
(function () {
  var g = { anapara: 200000, aylikFaiz: 2.5, vade: 48, kkdf: 15, bsmv: 15 };
  var p = K.plan(g);
  var e = K.erkenKapama(p, 24, 0);

  ok("24. ayda kalan anapara plandaki kalanla aynı",
     e.kalanAnapara === p.satirlar[23].kalan, e.kalanAnapara);
  ok("tazminatsızda kapama = kalan anapara",
     e.kapamaTutari === e.kalanAnapara);
  ok("kaçınılan maliyet pozitif", e.kacinilanMaliyet > 0, String(e.kacinilanMaliyet));

  /* Erken kapayınca toplam ödenen, vadeye kadar ödenenden az olmalı. */
  ok("erken kapama toplamı vadesindekinden az",
     e.toplamOdenen < p.toplamGeriOdeme,
     e.toplamOdenen + " < " + p.toplamGeriOdeme);

  /* Tazminat kapama tutarını yükseltir. */
  var t = K.erkenKapama(p, 24, 2);
  ok("%2 tazminat kapama tutarını artırır", t.kapamaTutari > e.kapamaTutari);
  ok("tazminat = kalan anapara × %2",
     yakin(t.tazminat, e.kalanAnapara * 0.02, 0.02), String(t.tazminat));

  /* Son ayda kapamak: kalan sıfır olduğu için kapama bedeli de sıfır. */
  var son = K.erkenKapama(p, 48, 0);
  ok("son ayda kapama bedeli sıfır", son.kalanAnapara === 0);
  ok("geçersiz ay için null", K.erkenKapama(p, 0, 0) === null &&
     K.erkenKapama(p, 99, 0) === null);
})();

/* ------------------------------------------------------------------ 7 */
baslik("Ek ödeme");
(function () {
  var g = { anapara: 300000, aylikFaiz: 2.79, vade: 60, kkdf: 15, bsmv: 15 };
  var e = K.ekOdeme(g, 1000);

  ok("ek ödemeyle vade kısalır", e.kisalanAy > 0, String(e.kisalanAy));
  ok("yeni vade eskisinden küçük", e.yeniVade < 60, String(e.yeniVade));
  ok("tasarruf pozitif", e.tasarruf > 0, String(e.tasarruf));

  /* Daha çok ek ödeme, daha çok tasarruf ve daha kısa vade. */
  var cok = K.ekOdeme(g, 3000);
  ok("ek ödeme arttıkça vade daha çok kısalır", cok.yeniVade < e.yeniVade,
     cok.yeniVade + " < " + e.yeniVade);
  ok("ek ödeme arttıkça tasarruf artar", cok.tasarruf > e.tasarruf);

  ok("ek ödeme sıfırsa etki yok", K.ekOdeme(g, 0).kisalanAy === 0);

  /* Taksitin tamamını ikiye katlarsak kredi yarıdan çok kısalmalı. */
  var p = K.plan(g);
  var iki = K.ekOdeme(g, p.taksit);
  ok("taksiti ikiye katlayınca vade yarıdan aza iner",
     iki.yeniVade < 30, String(iki.yeniVade));
})();

/* ------------------------------------------------------------------ 8 */
baslik("İki teklifin karşılaştırılması");
(function () {
  /* Klasik tuzak: A'nın faizi düşük ama masrafı yüksek. */
  var A = { anapara: 200000, aylikFaiz: 2.60, vade: 36, kkdf: 15, bsmv: 15,
            tahsisOran: 0.5, sigortaPesin: 8000 };
  var B = { anapara: 200000, aylikFaiz: 2.85, vade: 36, kkdf: 15, bsmv: 15 };
  var k = K.karsilastir(A, B);

  ok("karşılaştırma sonucu döndü", !!k);
  ok("A'nın taksiti daha düşük", k.a.taksit < k.b.taksit,
     k.a.taksit + " < " + k.b.taksit);
  ok("bir kazanan belirlendi", k.kazanan === "a" || k.kazanan === "b", k.kazanan);
  ok("YMO farkı hesaplandı", k.ymoFarki >= 0, String(k.ymoFarki));

  /* Aynı iki teklif: fark sıfır olmalı. */
  var ayni = K.karsilastir(B, B);
  ok("özdeş tekliflerde YMO farkı sıfır", yakin(ayni.ymoFarki, 0, 0.0001));
  ok("özdeş tekliflerde kazanan yok", ayni.kazanan === null);

  /* Masrafsız ve daha düşük faizli teklif her ölçütte kazanmalı. */
  var ucuz = { anapara: 200000, aylikFaiz: 2.00, vade: 36, kkdf: 15, bsmv: 15 };
  var k2 = K.karsilastir(ucuz, B);
  ok("her yönden ucuz teklif kazanır", k2.kazanan === "a");
  ok("bu durumda taksit yanıltmıyor", k2.taksitYaniltiyor === false);
})();

/* ------------------------------------------------------------------ 9 */
baslik("Sayı okuma ve sınır durumları");
(function () {
  ok('"250.000" → 250000', K.sayi("250.000") === 250000);
  ok('"2,89" → 2.89', K.sayi("2,89") === 2.89);
  ok('"1.234,56" → 1234.56', K.sayi("1.234,56") === 1234.56);
  ok('"" → 0', K.sayi("") === 0);
  ok('"abc" → 0', K.sayi("abc") === 0);

  var bos = K.plan({});
  ok("boş girdi geçersiz plan döner", bos.gecerli === false);
  ok("boş planda satır yok", bos.satirlar.length === 0);
  ok("anapara 0 ise geçersiz", K.plan({ anapara: 0, vade: 12, aylikFaiz: 2 }).gecerli === false);
  ok("vade 0 ise geçersiz", K.plan({ anapara: 1000, vade: 0, aylikFaiz: 2 }).gecerli === false);

  /* Faiz sıfır: taksit anapara/vade, toplam maliyet yalnızca masraf. */
  var sifir = K.plan({ anapara: 12000, aylikFaiz: 0, vade: 12, kkdf: 15, bsmv: 15 });
  ok("faizsiz kredide taksit 1.000", yakin(sifir.taksit, 1000, 0.01), String(sifir.taksit));
  ok("faizsiz kredide vergi yok", sifir.toplamVergi === 0);
  ok("faizsiz kredide toplam = anapara", yakin(sifir.toplamGeriOdeme, 12000, 0.02));

  /* Masraf anaparayı aşarsa YMO hesaplanamaz; çökmemeli. */
  var absurt = K.plan({ anapara: 1000, aylikFaiz: 2, vade: 12, kkdf: 0, bsmv: 0,
                        sigortaPesin: 5000 });
  ok("masraf anaparayı aşınca çökmüyor", absurt.gecerli === true);
  ok("bu durumda YMO sıfırlanıyor", absurt.ymoYillik === 0, String(absurt.ymoYillik));
})();

/* ----------------------------------------------------------------- 10 */
baslik("Rastgele 200 kredide değişmezler");
(function () {
  var tohum = 987654321;
  function rnd() { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum / 2147483648; }

  var bozuk = 0, ornek = "";
  for (var d = 0; d < 200; d++) {
    var g = {
      anapara: Math.round(10000 + rnd() * 2000000),
      aylikFaiz: Math.round(rnd() * 500) / 100,
      vade: 3 + Math.floor(rnd() * 117),
      kkdf: [0, 15][Math.floor(rnd() * 2)],
      bsmv: [0, 5, 15][Math.floor(rnd() * 3)],
      tahsisOran: Math.round(rnd() * 50) / 100,
      sigortaAylik: Math.round(rnd() * 200)
    };
    var p = K.plan(g);
    if (!p.gecerli) { bozuk++; continue; }
    var anaparaToplam = p.satirlar.reduce(function (t, s) { return t + s.anapara; }, 0);
    var sonKalan = p.satirlar[p.satirlar.length - 1].kalan;
    var negatif = p.satirlar.some(function (s) { return s.kalan < -0.01 || s.taksit < 0; });

    if (Math.round(anaparaToplam * 100) !== Math.round(p.anapara * 100) ||
        sonKalan !== 0 || negatif) {
      bozuk++;
      if (!ornek) ornek = JSON.stringify({ g: g, anaparaToplam: anaparaToplam.toFixed(2),
                                           sonKalan: sonKalan });
    }
  }
  ok("200 kredide anapara kuruşu kuruşuna kapanıyor ve borç sıfırlanıyor",
     bozuk === 0, bozuk + " kredi tutmadı " + ornek);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
