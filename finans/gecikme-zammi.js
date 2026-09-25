/*!
 * Gecikme zammı — vadesinde ödenmeyen vergi borcunun bugünkü tutarı.
 *
 * 6183 sayılı Kanun m.51: "Amme alacağının ödeme müddeti içinde ödenmeyen
 * kısmına vadenin bitim tarihinden itibaren her ay için ayrı ayrı ...
 * gecikme zammı tatbik olunur. Ay kesirlerine isabet eden zam günlük olarak
 * hesap edilir." Gecikme zammı 1 TL'den az olamaz (metinde eski parayla
 * "birmilyon lira").
 *
 * ORANLAR: GİB "Gecikme Zammı Oranları (6183 sayılı Kanunun 51. maddesi)"
 * tablosu, 2010'dan bu yana. Oran değişince her dönem kendi oranıyla ayrı
 * hesaplanır ve toplanır.
 *
 * YÖNTEM: zam vadeden sonraki günden ödeme gününe kadar işler. Her oran
 * dönemi için dönemin başından sonuna tam aylar (takvim günü adımıyla; ay
 * sonunda son güne sabitlenir) ve kalan günler bulunur:
 *   dönem zammı = anapara × aylık oran × (tam ay + kalan gün ÷ 30)
 * Oran değişikliği "o tarihten itibaren" uygulanır: değişiklik gününden
 * önceki son gün eski oranın son günüdür.
 *
 * Kapsam: vergi aslı ve 6183'e tabi diğer amme alacakları. SGK prim
 * borçlarında 5510 m.89 (gecikme cezası + zammı) ayrı bir kuraldır;
 * ceza alacaklarında zam uygulanmaz ya da farklı uygulanır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/gecikme-zammi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika();
  else kok.GecikmeZammi = fabrika();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ORANLAR = [
    { bas: "2010-10-19", oran: 0.014, dayanak: "2010/965 sayılı BKK" },
    { bas: "2018-09-05", oran: 0.020, dayanak: "62 sayılı CB Kararı" },
    { bas: "2019-07-01", oran: 0.025, dayanak: "1266 sayılı CB Kararı" },
    { bas: "2019-10-02", oran: 0.020, dayanak: "1592 sayılı CB Kararı" },
    { bas: "2019-12-30", oran: 0.016, dayanak: "1947 sayılı CB Kararı" },
    { bas: "2022-07-21", oran: 0.025, dayanak: "5801 sayılı CB Kararı" },
    { bas: "2023-11-14", oran: 0.035, dayanak: "7782 sayılı CB Kararı" },
    { bas: "2024-05-21", oran: 0.045, dayanak: "8484 sayılı CB Kararı" },
    { bas: "2025-11-13", oran: 0.037, dayanak: "10556 sayılı CB Kararı" }
  ];
  var ASGARI = 1;

  function tarih(s, ad) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) throw new Error(ad + " geçerli bir tarih olmalı.");
    var d = new Date(s + "T00:00:00Z");
    if (!isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(ad + " geçerli bir tarih olmalı.");
    return d;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function gunEkle(d, n) { return new Date(d.getTime() + n * 86400000); }
  function ayEkle(d, n) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + n, g = d.getUTCDate();
    var son = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(g, son)));
  }
  /* bas'tan son'a (son dahil) tam ay ve kalan gün. */
  function ayGun(bas, son) {
    var m = 0;
    while (ayEkle(bas, m + 1) <= son) m++;
    return { ay: m, gun: Math.round((son - ayEkle(bas, m)) / 86400000) };
  }
  function oranGunu(d) {
    var o = null;
    ORANLAR.forEach(function (x) { if (x.bas <= iso(d)) o = x; });
    return o;
  }

  function hesapla(girdi) {
    var tutar = Number(girdi.tutar);
    if (!(tutar > 0)) throw new Error("Borç tutarı pozitif olmalı.");
    var vade = tarih(girdi.vade, "Vade tarihi"), odeme = tarih(girdi.odeme, "Ödeme tarihi");
    if (iso(vade) < ORANLAR[0].bas) throw new Error("Vade " + ORANLAR[0].bas.split("-").reverse().join(".") + " ve sonrası olmalı.");
    if (odeme <= vade) return { tutar: tutar, donemler: [], zam: 0, toplam: tutar, gun: 0 };

    /* Dönem sınırları: değişiklik gününden önceki gün eski oranın son günü. */
    var sinirlar = [vade];
    ORANLAR.forEach(function (x) {
      var onceki = gunEkle(tarih(x.bas, "Oran"), -1);
      if (onceki > vade && onceki < odeme) sinirlar.push(onceki);
    });
    sinirlar.push(odeme);
    var donemler = [], zam = 0;
    for (var i = 0; i + 1 < sinirlar.length; i++) {
      var bas = sinirlar[i], son = sinirlar[i + 1];
      var o = oranGunu(gunEkle(bas, 1)), ag = ayGun(bas, son);
      var z = tutar * o.oran * (ag.ay + ag.gun / 30);
      zam += z;
      donemler.push({ bas: iso(gunEkle(bas, 1)), son: iso(son), oran: o.oran, dayanak: o.dayanak, ay: ag.ay, gun: ag.gun, zam: z });
    }
    zam = Math.round(zam * 100) / 100;
    if (zam > 0 && zam < ASGARI) zam = ASGARI;
    return { tutar: tutar, donemler: donemler, zam: zam, toplam: Math.round((tutar + zam) * 100) / 100,
             gun: Math.round((odeme - vade) / 86400000), guncelOran: ORANLAR[ORANLAR.length - 1].oran };
  }

  return { surum: "1.0.0", ORANLAR: ORANLAR, ASGARI: ASGARI, ayGun: function (a, b) { return ayGun(tarih(a, "Başlangıç"), tarih(b, "Bitiş")); }, hesapla: hesapla };
});
