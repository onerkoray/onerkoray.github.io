/*!
 * Fatura Çekirdeği — doğrulama testleri.  Çalıştırma:  node fatura-olusturma/test.js
 *
 * Bir faturada yanlış tutar, ekranda hata vermeyen tek hata türüdür: belge
 * basılır, imzalanır, gönderilir ve yanlışlığı ancak muhasebede fark edilir.
 * Buradaki testlerin çoğu tek bir değişmezi korur: KALEMLERİN TOPLAMI FATURA
 * TOPLAMINA EŞİT OLMALIDIR. Kuruş dağıtımında bir hata olduğunda önce bu
 * eşitlik bozulur.
 */
"use strict";
var F = require("./fatura.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, tolerans) { return Math.abs(a - b) <= (tolerans || 0.005); }
function baslik(s) { console.log("\n" + s); }

/* ------------------------------------------------------------------ 1 */
baslik("Temel KDV hesabı");
(function () {
  var s = F.hesapla({
    kalemler: [{ aciklama: "Danışmanlık", miktar: 1, birimFiyat: 10000, kdvOran: 20 }]
  });
  ok("10.000 TL matrah", yakin(s.matrah, 10000), s.matrah);
  ok("%20 KDV = 2.000 TL", yakin(s.kdv, 2000), s.kdv);
  ok("genel toplam 12.000 TL", yakin(s.genelToplam, 12000), s.genelToplam);
  ok("ödenecek = genel toplam (tevkifatsız)", yakin(s.odenecek, 12000), s.odenecek);
})();

/* ------------------------------------------------------------------ 2 */
baslik("Kuruşlu miktar ve birim fiyat");
(function () {
  /* 3,5 saat × 1.250,50 TL = 4.376,75 TL. Kayan noktalı çarpımda
     4376.749999... çıkabilen bir hesap; kuruş tamsayısıyla çalışmanın sebebi. */
  var s = F.hesapla({
    kalemler: [{ miktar: "3,5", birimFiyat: "1.250,50", kdvOran: 20 }]
  });
  ok("3,5 × 1.250,50 = 4.376,75", yakin(s.matrah, 4376.75), s.matrah);
  ok("KDV 875,35", yakin(s.kdv, 875.35), s.kdv);
  ok("toplam 5.252,10", yakin(s.genelToplam, 5252.10), s.genelToplam);
})();

/* ------------------------------------------------------------------ 3 */
baslik("Türkçe sayı biçimleri okunuyor mu");
(function () {
  ok('"1.234,56" → 1234.56', F.sayi("1.234,56") === 1234.56);
  ok('"1234.56" → 1234.56', F.sayi("1234.56") === 1234.56);
  ok('"1234,56" → 1234.56', F.sayi("1234,56") === 1234.56);
  ok('"12.000" → 12000 (üçlü grup = binlik ayracı)', F.sayi("12.000") === 12000);
  ok('"1.234.567" → 1234567', F.sayi("1.234.567") === 1234567);
  ok('"12.5" → 12.5 (üçlü grup değil = ondalık)', F.sayi("12.5") === 12.5);
  ok('"12.00" → 12 (üçlü grup değil)', F.sayi("12.00") === 12);
  ok('"" → 0', F.sayi("") === 0);
  ok('"abc" → 0', F.sayi("abc") === 0);
})();

/* ------------------------------------------------------------------ 4 */
baslik("Satır iskontosu");
(function () {
  var s = F.hesapla({
    kalemler: [
      { miktar: 10, birimFiyat: 1000, iskontoTur: "oran", iskonto: 10, kdvOran: 20 }
    ]
  });
  ok("10.000 brütten %10 iskonto = 1.000", yakin(s.satirIskontosu, 1000), s.satirIskontosu);
  ok("matrah 9.000", yakin(s.matrah, 9000), s.matrah);
  ok("KDV iskonto sonrası matrahtan (1.800)", yakin(s.kdv, 1800), s.kdv);

  var t = F.hesapla({
    kalemler: [
      { miktar: 1, birimFiyat: 5000, iskontoTur: "tutar", iskonto: 750, kdvOran: 10 }
    ]
  });
  ok("tutar iskontosu matrahı 4.250 yapar", yakin(t.matrah, 4250), t.matrah);
  ok("%10 KDV = 425", yakin(t.kdv, 425), t.kdv);

  /* İskonto brütü aşamaz: negatif matrahlı fatura olmaz. */
  var u = F.hesapla({
    kalemler: [{ miktar: 1, birimFiyat: 100, iskontoTur: "tutar", iskonto: 500, kdvOran: 20 }]
  });
  ok("iskonto brütü aşarsa matrah 0'da durur", u.matrah === 0, u.matrah);
})();

/* ------------------------------------------------------------------ 5 */
baslik("Genel iskonto satırlara dağıtılıyor mu");
(function () {
  /* Asıl sınav: KDV oranları farklı. Genel iskonto toplamdan düşülürse
     KDV yanlış olur; satırlara dağıtılırsa doğru olur. */
  var s = F.hesapla({
    kalemler: [
      { miktar: 1, birimFiyat: 1000, kdvOran: 20 },
      { miktar: 1, birimFiyat: 1000, kdvOran: 1 }
    ],
    genelIskontoTur: "oran",
    genelIskonto: 10
  });
  ok("ara toplam 2.000", yakin(s.araToplam, 2000), s.araToplam);
  ok("genel iskonto 200", yakin(s.genelIskonto, 200), s.genelIskonto);
  ok("matrah 1.800", yakin(s.matrah, 1800), s.matrah);
  ok("iskonto iki satıra eşit dağıldı (100 + 100)",
     yakin(s.satirlar[0].matrah, 900) && yakin(s.satirlar[1].matrah, 900),
     s.satirlar[0].matrah + " / " + s.satirlar[1].matrah);
  ok("KDV = 900×%20 + 900×%1 = 189", yakin(s.kdv, 189), s.kdv);

  var toplamSatir = s.satirlar.reduce(function (t, x) { return t + x.matrah; }, 0);
  ok("satır matrahları toplamı = fatura matrahı", yakin(toplamSatir, s.matrah));
})();

/* ------------------------------------------------------------------ 6 */
baslik("Kuruş kaybı olmuyor mu (en zor dağıtım durumları)");
(function () {
  /* 3 eşit satıra 0,01 TL iskonto: 1 kuruş üçe bölünemez. Toplam yine de
     tam tutmalı — artık kuruş bir satıra gitmeli, buharlaşmamalı. */
  var s = F.hesapla({
    kalemler: [
      { miktar: 1, birimFiyat: 100, kdvOran: 20 },
      { miktar: 1, birimFiyat: 100, kdvOran: 20 },
      { miktar: 1, birimFiyat: 100, kdvOran: 20 }
    ],
    genelIskontoTur: "tutar",
    genelIskonto: 0.01
  });
  var toplam = s.satirlar.reduce(function (t, x) { return t + x.matrah; }, 0);
  ok("1 kuruşluk iskonto üç satıra bölününce toplam korunuyor",
     yakin(toplam, 299.99) && yakin(s.matrah, 299.99), toplam);

  /* Rastgele 200 fatura: her birinde satır toplamı = fatura toplamı.
     Bu, dağıtımın tek tek örneklerde değil genelinde doğru olduğunu gösterir. */
  var bozuk = 0, ornek = "";
  var tohum = 12345;
  function rnd() { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum / 2147483648; }
  for (var d = 0; d < 200; d++) {
    var kalemler = [];
    var n = 1 + Math.floor(rnd() * 6);
    for (var i = 0; i < n; i++) {
      kalemler.push({
        miktar: Math.round(rnd() * 1000) / 100 + 0.01,
        birimFiyat: Math.round(rnd() * 500000) / 100,
        iskontoTur: rnd() < 0.5 ? "oran" : "tutar",
        iskonto: rnd() < 0.5 ? Math.round(rnd() * 3000) / 100 : 0,
        kdvOran: [0, 1, 10, 20][Math.floor(rnd() * 4)]
      });
    }
    var f = F.hesapla({
      kalemler: kalemler,
      genelIskontoTur: rnd() < 0.5 ? "oran" : "tutar",
      genelIskonto: Math.round(rnd() * 2000) / 100
    });
    var mt = f.satirlar.reduce(function (t, x) { return t + x.matrah; }, 0);
    var kt = f.satirlar.reduce(function (t, x) { return t + x.kdv; }, 0);
    var dt = f.kdvDokumu.reduce(function (t, x) { return t + x.kdv; }, 0);
    if (!yakin(mt, f.matrah) || !yakin(kt, f.kdv) || !yakin(dt, f.kdv) ||
        !yakin(f.matrah + f.kdv, f.genelToplam)) {
      bozuk++;
      if (!ornek) ornek = JSON.stringify({ mt: mt, matrah: f.matrah, kt: kt, kdv: f.kdv });
    }
  }
  ok("200 rastgele faturada satır toplamı = fatura toplamı", bozuk === 0,
     bozuk + " fatura tutmadı " + ornek);
})();

/* ------------------------------------------------------------------ 7 */
baslik("KDV tevkifatı");
(function () {
  var s = F.hesapla({
    kalemler: [{ miktar: 1, birimFiyat: 100000, kdvOran: 20 }],
    tevkifat: { pay: 5, payda: 10 }
  });
  ok("hesaplanan KDV 20.000", yakin(s.kdv, 20000), s.kdv);
  ok("5/10 tevkifat = 10.000", yakin(s.tevkifat, 10000), s.tevkifat);
  ok("tahsil edilecek KDV 10.000", yakin(s.tahsilEdilecekKdv, 10000), s.tahsilEdilecekKdv);
  ok("genel toplam değişmez (120.000)", yakin(s.genelToplam, 120000), s.genelToplam);
  ok("ödenecek tutar 110.000", yakin(s.odenecek, 110000), s.odenecek);
  ok("tevkifat oranı metni 5/10", s.tevkifatOrani === "5/10", s.tevkifatOrani);

  var y = F.hesapla({
    kalemler: [{ miktar: 1, birimFiyat: 100000, kdvOran: 20 }],
    tevkifat: { pay: 9, payda: 10 }
  });
  ok("9/10 tevkifatta ödenecek 102.000", yakin(y.odenecek, 102000), y.odenecek);

  /* Tevkifat + tahsil edilecek, hesaplanan KDV'yi tam vermeli. */
  var z = F.hesapla({
    kalemler: [{ miktar: 3, birimFiyat: 1111.11, kdvOran: 20 }],
    tevkifat: { pay: 7, payda: 10 }
  });
  ok("tevkifat + tahsil = hesaplanan KDV",
     yakin(z.tevkifat + z.tahsilEdilecekKdv, z.kdv),
     z.tevkifat + " + " + z.tahsilEdilecekKdv + " ≠ " + z.kdv);
})();

/* ------------------------------------------------------------------ 8 */
baslik("Dövizli fatura ve TL karşılığı");
(function () {
  var s = F.hesapla({
    kalemler: [{ miktar: 1, birimFiyat: 1000, kdvOran: 20 }],
    paraBirimi: "USD",
    kur: 42.1234
  });
  ok("para birimi USD", s.paraBirimi.kod === "USD", s.paraBirimi.kod);
  ok("ödenecek 1.200 USD", yakin(s.odenecek, 1200), s.odenecek);
  ok("TL karşılığı 50.548,08", yakin(s.odenecekTl, 50548.08), s.odenecekTl);

  var t = F.hesapla({ kalemler: [{ miktar: 1, birimFiyat: 1000, kdvOran: 20 }] });
  ok("TL faturada TL karşılığı = ödenecek", yakin(t.odenecekTl, t.odenecek));
})();

/* ------------------------------------------------------------------ 9 */
baslik("Tutar yazıyla");
(function () {
  function e(tutar, beklenen, para) {
    var c = F.yaziyla(tutar, para || "TRY");
    ok(tutar + " → " + beklenen, c === beklenen, c);
  }
  e(0, "Sıfır Türk Lirası");
  e(1, "Bir Türk Lirası");
  e(11, "On Bir Türk Lirası");
  e(100, "Yüz Türk Lirası");                 /* "bir yüz" değil */
  e(101, "Yüz Bir Türk Lirası");
  e(200, "İki Yüz Türk Lirası");
  e(1000, "Bin Türk Lirası");                /* "bir bin" değil */
  e(1001, "Bin Bir Türk Lirası");
  e(2000, "İki Bin Türk Lirası");
  e(21000, "Yirmi Bir Bin Türk Lirası");
  e(1000000, "Bir Milyon Türk Lirası");      /* ama "bir milyon" denir */
  e(1000001, "Bir Milyon Bir Türk Lirası");
  e(30500.25, "Otuz Bin Beş Yüz Türk Lirası Yirmi Beş Kuruş");
  e(1234567.89, "Bir Milyon İki Yüz Otuz Dört Bin Beş Yüz Altmış Yedi Türk Lirası Seksen Dokuz Kuruş");
  e(0.05, "Sıfır Türk Lirası Beş Kuruş");
  e(1500, "Bin Beş Yüz Türk Lirası");
  e(1000, "Bin ABD Doları", "USD");
  e(12.34, "On İki Euro Otuz Dört Sent", "EUR");

  /* Küsurat yuvarlaması: 0,005 aşağı/yukarı kayarsa yazıyla tutar rakamla
     tutmaz — faturadaki en görünür çelişki bu olurdu. */
  ok("99,999 → yüz lira (kuruşa yuvarlanır)",
     F.yaziyla(99.999, "TRY") === "Yüz Türk Lirası", F.yaziyla(99.999, "TRY"));
})();

/* ----------------------------------------------------------------- 10 */
baslik("VKN / TCKN doğrulaması");
(function () {
  /* Elle üretilmiş geçerli TCKN: 10. hane (1×7−0)%10=7, 11. hane (1+7)%10=8 */
  ok("10000000078 geçerli TCKN", F.tcknGecerli("10000000078"));
  ok("10000000079 geçersiz (son hane bozuk)", !F.tcknGecerli("10000000079"));
  ok("0 ile başlayan TCKN geçersiz", !F.tcknGecerli("01234567890"));
  ok("10 haneli TCKN geçersiz", !F.tcknGecerli("1000000007"));

  /* VKN algoritmasının bir sağlama olarak çalıştığının kanıtı: bir kök için
     0-9 arasında TAM BİR tane geçerli kontrol hanesi vardır. Bu, tek haneli
     yazım hatalarının yakalandığı anlamına gelir. */
  var kokler = ["123456789", "987654321", "111111111", "460000000", "800000000"];
  var hepsiTek = true, gecerliBulunan = [];
  kokler.forEach(function (kok) {
    var say = 0, no = "";
    for (var d = 0; d <= 9; d++) {
      if (F.vknGecerli(kok + d)) { say++; no = kok + d; }
    }
    if (say !== 1) hepsiTek = false;
    gecerliBulunan.push(no);
  });
  ok("her VKN kökü için tam bir geçerli kontrol hanesi var", hepsiTek,
     gecerliBulunan.join(", "));

  /* Ve tek haneli her değişiklik numarayı bozmalı. */
  var no = gecerliBulunan[0];
  var yakalanan = 0, deneme = 0;
  for (var i = 0; i < 10; i++) {
    for (var d2 = 0; d2 <= 9; d2++) {
      if (String(d2) === no[i]) continue;
      deneme++;
      var bozuk = no.substring(0, i) + d2 + no.substring(i + 1);
      if (!F.vknGecerli(bozuk)) yakalanan++;
    }
  }
  ok("tek haneli yazım hatalarının tamamı yakalanıyor (" + yakalanan + "/" + deneme + ")",
     yakalanan === deneme);

  ok("11 hanede TCKN olarak yorumlanıyor",
     F.vergiNoDurumu("10000000078").durum === "gecerli");
  ok("10 hanede VKN olarak yorumlanıyor",
     F.vergiNoDurumu(gecerliBulunan[0]).durum === "gecerli");
  ok("boş numara uyarı üretmez", F.vergiNoDurumu("").durum === "yok");
  ok("9 hane hatalı", F.vergiNoDurumu("123456789").durum === "hatali");
})();

/* ----------------------------------------------------------------- 11 */
baslik("Sınır durumları");
(function () {
  var bos = F.hesapla({ kalemler: [] });
  ok("kalemsiz fatura sıfırlanır", bos.genelToplam === 0 && bos.kdv === 0);
  ok("kalemsiz faturada yazıyla 'Sıfır Türk Lirası'",
     F.yaziyla(bos.odenecek, "TRY") === "Sıfır Türk Lirası");

  var bosBelge = F.hesapla();
  ok("belge hiç verilmezse çökmüyor", bosBelge.genelToplam === 0);

  var kotu = F.hesapla({
    kalemler: [{ miktar: "iki", birimFiyat: "abc", kdvOran: "yirmi" }]
  });
  ok("sayı olmayan girdi 0 sayılır, çökmez", kotu.genelToplam === 0);

  /* Dağıtım fonksiyonu tek başına: verilen tutarın tamamı dağıtılmalı. */
  var p = F.dagit(100, [1, 1, 1]);
  ok("100 kuruş üçe bölününce toplam 100",
     p[0] + p[1] + p[2] === 100, p.join("+"));
  var p2 = F.dagit(7, [3, 0, 4]);
  ok("sıfır ağırlıklı satıra pay düşmez", p2[1] === 0 && p2[0] + p2[2] === 7, p2.join("+"));
  var p3 = F.dagit(50, [0, 0, 0]);
  ok("tüm ağırlıklar sıfırsa dağıtım yapılmaz", p3.join(",") === "0,0,0");
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
