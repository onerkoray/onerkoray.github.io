/*!
 * Mali Takvim — okurun karar vereceği tarihler, kuraldan türetilir
 *
 * Tarih elle yazılmaz: TÜFE açıklaması TÜİK takviminden (finans/veri-durumu.js),
 * vergi son günleri kanundaki aydan çıkar. Son gün hafta sonuna denk gelirse
 * izleyen iş gününe kayar (VUK m.18). Resmî tatil ve idarenin süre uzatması
 * burada hesaba katılmaz; sayfa bunu söyler.
 *
 * Tarihi resmen belli olmayan olaylar tarih uydurulmadan "bekleyenler"de durur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/mali-takvim/
 */
(function (root, factory) {
  "use strict";
  var ortak = typeof module === "object" && module.exports;
  var V = ortak ? require("./veri-durumu.js") : root.VeriDurumu;
  var v = factory(V);
  if (ortak) module.exports = v;
  else root.MaliTakvim = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (V) {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var ILK = "2026-11", SON = "2027-12";   // takvim penceresi; gecerlilik bildirimi yenilemeyi hatırlatır

  function iki(n) { return (n < 10 ? "0" : "") + n; }
  function ayAdi(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }

  /* Ayın son günü; hafta sonuysa izleyen Pazartesi. */
  function sonGun(yil, ay) {
    var d = new Date(Date.UTC(yil, ay, 0));
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 864e5);
    return d.toISOString().slice(0, 10);
  }

  var ARAC = {
    enflasyon: { ad: "Enflasyon hesaplama", yol: "enflasyon-hesaplama/" },
    kira: { ad: "Kira artışı", yol: "kira-artisi-hesaplama/" },
    emekli: { ad: "Emekli zammı", yol: "emekli-zammi-hesaplama/" },
    memur: { ad: "Memur zammı", yol: "memur-zammi-hesaplama/" },
    ydo: { ad: "Yeniden değerleme oranı", yol: "makaleler/yeniden-degerleme-orani-2026/" },
    maas: { ad: "2027'de maaşım", yol: "asgari-ucret-zam-senaryosu/" },
    mtv: { ad: "MTV hesaplama", yol: "mtv-hesaplama/" },
    beyan: { ad: "Beyanname hesaplama", yol: "beyanname-hesaplama/" },
    kidem: { ad: "Kıdem ve ihbar", yol: "kidem-tazminati-hesaplama/" }
  };

  function tufeOlayi(veriAy) {
    var ay = +veriAy.slice(5), o = { tarih: V.aciklamaTarihi(veriAy), tur: "veri", ad: ayAdi(veriAy) + " enflasyonu (TÜİK)",
      etki: "Kira artış oranı ve reel maaş hesapları bu veriyle yenilenir.", araclar: [ARAC.kira, ARAC.enflasyon] };
    if (ay === 12) { o.etki = "Ocak zammının oranı bu veriyle kesinleşir: SSK ve Bağ-Kur aylıkları ile memur enflasyon farkı."; o.araclar = [ARAC.emekli, ARAC.memur]; }
    if (ay === 6) { o.etki = "Temmuz zammının oranı bu veriyle kesinleşir: SSK ve Bağ-Kur aylıkları ile memur enflasyon farkı."; o.araclar = [ARAC.emekli, ARAC.memur]; }
    if (ay === 10) { o.etki = "Yeniden değerleme oranının hesabı bu ayın üretici fiyatlarıyla tamamlanır."; o.araclar = [ARAC.ydo, ARAC.kira]; }
    return o;
  }

  function olaylar() {
    var l = [], a;
    for (a = 2026 * 12 + 9; ; a++) {
      var veriAy = Math.floor(a / 12) + "-" + iki(a % 12 + 1), o = tufeOlayi(veriAy);
      if (o.tarih.slice(0, 7) > SON) break;
      if (o.tarih.slice(0, 7) >= ILK) l.push(o);
    }
    l.push({ tarih: "2027-01-01", tur: "yururluk", ad: "2027 asgari ücreti, vergi dilimleri ve SGK tavanı", etki: "Yeni yıl parametreleri bordroya girer; net maaşlar bu tarihten itibaren değişir.", araclar: [ARAC.maas] });
    l.push({ tarih: "2027-01-01", tur: "yururluk", ad: "Kıdem tazminatı tavanı (Ocak)", etki: "Tavan yılda iki kez yenilenir; çıkış tarihi hesabı değiştirebilir.", araclar: [ARAC.kidem] });
    l.push({ tarih: "2027-07-01", tur: "yururluk", ad: "Kıdem tazminatı tavanı (Temmuz)", etki: "Tavan memur katsayısıyla yenilenir.", araclar: [ARAC.kidem] });
    l.push({ tarih: sonGun(2027, 1), tur: "vergi", ad: "MTV 1. taksit son günü", etki: "Motorlu taşıtlar vergisi Ocak ve Temmuz'da iki eşit taksitte ödenir (197 s.K. m.10).", araclar: [ARAC.mtv] });
    l.push({ tarih: sonGun(2027, 7), tur: "vergi", ad: "MTV 2. taksit son günü", etki: "Yılın ikinci taksiti (197 s.K. m.10).", araclar: [ARAC.mtv] });
    l.push({ tarih: sonGun(2026, 11), tur: "vergi", ad: "Emlak vergisi 2. taksit son günü", etki: "İkinci taksit Kasım içinde ödenir (1319 s.K. m.30).", araclar: [] });
    l.push({ tarih: sonGun(2027, 5), tur: "vergi", ad: "Emlak vergisi 1. taksit son günü", etki: "Birinci taksit Mart, Nisan ve Mayıs aylarında ödenir (1319 s.K. m.30).", araclar: [] });
    l.push({ tarih: sonGun(2027, 11), tur: "vergi", ad: "Emlak vergisi 2. taksit son günü", etki: "İkinci taksit Kasım içinde ödenir (1319 s.K. m.30).", araclar: [] });
    l.push({ tarih: "2027-03-25", tur: "vergi", ad: "Yıllık gelir vergisi beyannamesi", etki: "2026 gelirleri için kanundaki son gün Mart'ın 25'i (GVK m.92). İdare süreyi uzatabilir.", araclar: [ARAC.beyan] });
    l.push({ tarih: sonGun(2027, 3), tur: "vergi", ad: "Gelir vergisi 1. taksit son günü", etki: "Yıllık beyanla tahakkuk eden vergi Mart ve Temmuz'da iki eşit taksitte ödenir (GVK m.117).", araclar: [ARAC.beyan] });
    l.push({ tarih: sonGun(2027, 7), tur: "vergi", ad: "Gelir vergisi 2. taksit son günü", etki: "Yıllık beyanla tahakkuk eden verginin ikinci taksiti (GVK m.117).", araclar: [ARAC.beyan] });
    return l.sort(function (x, y) { return x.tarih < y.tarih ? -1 : x.tarih > y.tarih ? 1 : x.ad < y.ad ? -1 : 1; });
  }

  /* Tarihi resmen ilan edilmemiş olaylar. */
  var BEKLEYENLER = [
    { ad: "2026 yeniden değerleme oranı tebliği", not: "Geçen yılki tebliğ 27 Kasım'da yayımlandı. Sitenin hesabı %27,83.", arac: ARAC.ydo },
    { ad: "2027 asgari ücreti", not: "Bakanlığın 3 Kasım sunumuna göre Tespit Komisyonu Aralık'ta toplanıyor.", arac: ARAC.maas },
    { ad: "Emekliye ilave iyileştirme", not: "Bakanlık çalışmayı duyurdu; oran, tutar ve tarih yok.", arac: { ad: "Bilinenler", yol: "makaleler/emekliye-ilave-iyilestirme-ocak-2027/" } }
  ];

  function kacis(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,"); }

  /* Tüm gün etkinlikleri. UID ve damga olaydan türer; aynı liste aynı dosyayı verir. */
  function ics(liste) {
    var s = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//korayoner.dev//Mali Takvim//TR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Mali Takvim"];
    liste.forEach(function (o, i) {
      var t = o.tarih.replace(/-/g, ""), son = new Date(Date.parse(o.tarih) + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      s.push("BEGIN:VEVENT", "UID:" + t + "-" + i + "@korayoner.dev", "DTSTAMP:" + t + "T000000Z", "DTSTART;VALUE=DATE:" + t,
        "DTEND;VALUE=DATE:" + son, "SUMMARY:" + kacis(o.ad), "DESCRIPTION:" + kacis(o.etki), "END:VEVENT");
    });
    s.push("END:VCALENDAR");
    return s.join("\r\n") + "\r\n";
  }

  return { ILK: ILK, SON: SON, BEKLEYENLER: BEKLEYENLER, sonGun: sonGun, olaylar: olaylar, ics: ics, ayAdi: ayAdi };
});
