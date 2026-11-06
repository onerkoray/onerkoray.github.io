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
  var KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var KIMLER = [{ kod: "calisan", ad: "Çalışan" }, { kod: "emekli", ad: "Emekli" }, { kod: "memur", ad: "Memur" },
    { kod: "kira", ad: "Kira" }, { kod: "arac", ad: "Araç" }, { kod: "emlak", ad: "Emlak" }, { kod: "beyan", ad: "Beyan" }];

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
      etki: "Kira artış oranı ve reel maaş hesapları bu veriyle yenilenir.", araclar: [ARAC.kira, ARAC.enflasyon], kim: ["kira"], veriAy: veriAy };
    if (ay === 12) { o.etki = "Ocak zammının oranı bu veriyle kesinleşir: SSK ve Bağ-Kur aylıkları ile memur enflasyon farkı."; o.araclar = [ARAC.emekli, ARAC.memur]; o.kim = ["emekli", "memur"]; }
    if (ay === 6) { o.etki = "Temmuz zammının oranı bu veriyle kesinleşir: SSK ve Bağ-Kur aylıkları ile memur enflasyon farkı."; o.araclar = [ARAC.emekli, ARAC.memur]; o.kim = ["emekli", "memur"]; }
    if (ay === 10) { o.etki = "Yeniden değerleme oranının hesabı bu ayın üretici fiyatlarıyla tamamlanır."; o.araclar = [ARAC.ydo, ARAC.kira]; o.kim = ["kira", "calisan"]; }
    return o;
  }

  function olaylar() {
    var l = [], a;
    for (a = 2026 * 12 + 9; ; a++) {
      var veriAy = Math.floor(a / 12) + "-" + iki(a % 12 + 1), o = tufeOlayi(veriAy);
      if (o.tarih.slice(0, 7) > SON) break;
      if (o.tarih.slice(0, 7) >= ILK) l.push(o);
    }
    l.push({ tarih: "2027-01-01", tur: "yururluk", ad: "2027 asgari ücreti, vergi dilimleri ve SGK tavanı", etki: "Yeni yıl parametreleri bordroya girer; net maaşlar bu tarihten itibaren değişir.", araclar: [ARAC.maas], kim: ["calisan"] });
    l.push({ tarih: "2027-01-01", tur: "yururluk", ad: "Kıdem tazminatı tavanı (Ocak)", etki: "Tavan yılda iki kez yenilenir; çıkış tarihi hesabı değiştirebilir.", araclar: [ARAC.kidem], kim: ["calisan"] });
    l.push({ tarih: "2027-07-01", tur: "yururluk", ad: "Kıdem tazminatı tavanı (Temmuz)", etki: "Tavan memur katsayısıyla yenilenir.", araclar: [ARAC.kidem], kim: ["calisan"] });
    l.push({ tarih: sonGun(2027, 1), tur: "vergi", ad: "MTV 1. taksit son günü", etki: "Motorlu taşıtlar vergisi Ocak ve Temmuz'da iki eşit taksitte ödenir (197 s.K. m.10).", araclar: [ARAC.mtv], kim: ["arac"] });
    l.push({ tarih: sonGun(2027, 7), tur: "vergi", ad: "MTV 2. taksit son günü", etki: "Yılın ikinci taksiti (197 s.K. m.10).", araclar: [ARAC.mtv], kim: ["arac"] });
    l.push({ tarih: sonGun(2026, 11), tur: "vergi", ad: "Emlak vergisi 2. taksit son günü", etki: "İkinci taksit Kasım içinde ödenir (1319 s.K. m.30).", araclar: [], kim: ["emlak"] });
    l.push({ tarih: sonGun(2027, 5), tur: "vergi", ad: "Emlak vergisi 1. taksit son günü", etki: "Birinci taksit Mart, Nisan ve Mayıs aylarında ödenir (1319 s.K. m.30).", araclar: [], kim: ["emlak"] });
    l.push({ tarih: sonGun(2027, 11), tur: "vergi", ad: "Emlak vergisi 2. taksit son günü", etki: "İkinci taksit Kasım içinde ödenir (1319 s.K. m.30).", araclar: [], kim: ["emlak"] });
    l.push({ tarih: "2027-03-25", tur: "vergi", ad: "Yıllık gelir vergisi beyannamesi", etki: "2026 gelirleri için kanundaki son gün Mart'ın 25'i (GVK m.92). İdare süreyi uzatabilir.", araclar: [ARAC.beyan], kim: ["beyan"] });
    l.push({ tarih: sonGun(2027, 3), tur: "vergi", ad: "Gelir vergisi 1. taksit son günü", etki: "Yıllık beyanla tahakkuk eden vergi Mart ve Temmuz'da iki eşit taksitte ödenir (GVK m.117).", araclar: [ARAC.beyan], kim: ["beyan"] });
    l.push({ tarih: sonGun(2027, 7), tur: "vergi", ad: "Gelir vergisi 2. taksit son günü", etki: "Yıllık beyanla tahakkuk eden verginin ikinci taksiti (GVK m.117).", araclar: [ARAC.beyan], kim: ["beyan"] });
    return l.sort(function (x, y) { return x.tarih < y.tarih ? -1 : x.tarih > y.tarih ? 1 : x.ad < y.ad ? -1 : 1; });
  }

  /* Tarihi resmen ilan edilmemiş olaylar. */
  var BEKLEYENLER = [
    { ad: "2026 yeniden değerleme oranı tebliği", not: "Geçen yılki tebliğ 27 Kasım'da yayımlandı. Sitenin hesabı %27,83.", arac: ARAC.ydo },
    { ad: "2027 asgari ücreti", not: "Bakanlığın 3 Kasım sunumuna göre Tespit Komisyonu Aralık'ta toplanıyor.", arac: ARAC.maas },
    { ad: "Emekliye ilave iyileştirme", not: "Bakanlık çalışmayı duyurdu; oran, tutar ve tarih yok.", arac: { ad: "Bilinenler", yol: "makaleler/emekliye-ilave-iyilestirme-ocak-2027/" } }
  ];

  function gunFarki(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
  function tarihAdi(iso) { var p = iso.split("-"); return (+p[2]) + " " + AYLAR[+p[1] - 1] + " " + p[0]; }
  function filtre(liste, kim) { return kim ? liste.filter(function (o) { return o.kim.indexOf(kim) >= 0; }) : liste; }
  function yaklasan(liste, bugun) { return liste.filter(function (o) { return o.tarih >= bugun; }); }
  function yuzde(v) { return "%" + v.toFixed(2).replace(".", ","); }

  /* Pencerenin her ayı: o ayın olayları ve bugüne göre yeri. */
  function serit(liste, bugun) {
    var h = [], a = +ILK.slice(0, 4) * 12 + (+ILK.slice(5) - 1), son = +SON.slice(0, 4) * 12 + (+SON.slice(5) - 1);
    for (; a <= son; a++) {
      var ay = Math.floor(a / 12) + "-" + iki(a % 12 + 1);
      h.push({ ay: ay, kisa: KISA[a % 12], simdi: ay === bugun.slice(0, 7), gecti: ay < bugun.slice(0, 7),
        olaylar: liste.filter(function (o) { return o.tarih.slice(0, 7) === ay; }) });
    }
    return h;
  }

  /* Olayın bugünkü durumu sitenin serilerinden: açıklandıysa sonuç, açıklanmadıysa birikim. */
  function canli(o, k) {
    if (!o.veriAy || !k.T) return null;
    var v = k.T.aylar[o.veriAy];
    if (v) return "Açıklandı: aylık " + yuzde(v.aylik) + ", yıllık " + yuzde(v.yillik) + ".";
    var ay = +o.veriAy.slice(5), yil = +o.veriAy.slice(0, 4);
    if ((ay === 12 || ay === 6) && k.Z) {
      var d = ay === 12 ? k.Z.donem(yil + 1, 1, k.T) : k.Z.donem(yil, 7, k.T);
      return d.aciklananSayisi ? "Bugüne kadar " + yuzde(d.birikim * 100) + " birikti, " + d.aciklananSayisi + " ay açıklandı." : null;
    }
    if (k.KT) { var son = Object.keys(k.KT.oranlar).sort().pop(); return "Güncel kira artış oranı " + yuzde(k.KT.oranlar[son]) + "."; }
    return null;
  }

  /* Üst kart: son açıklanan ay ve ondan türeyen iki rakam. */
  function sonVeri(k) {
    if (!k.T || !k.T.aylar[k.T.sonAy]) return null;
    var v = k.T.aylar[k.T.sonAy], parca = ["Aylık " + yuzde(v.aylik)];
    if (k.Z) { var y = +k.T.sonAy.slice(0, 4), m = +k.T.sonAy.slice(5), d = m >= 7 ? k.Z.donem(y + 1, 1, k.T) : k.Z.donem(y, 7, k.T);
      parca.push((m >= 7 ? "Ocak" : "Temmuz") + " zammı birikimi " + yuzde(d.birikim * 100)); }
    if (k.KT) parca.push("Kira oranı " + yuzde(k.KT.oranlar[Object.keys(k.KT.oranlar).sort().pop()]));
    return { ay: k.T.sonAy, ayAdi: ayAdi(k.T.sonAy), yillik: yuzde(v.yillik), alt: parca.join(" · ") };
  }

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

  return { ILK: ILK, SON: SON, KIMLER: KIMLER, BEKLEYENLER: BEKLEYENLER, sonGun: sonGun, olaylar: olaylar, ics: ics, ayAdi: ayAdi, tarihAdi: tarihAdi,
    gunFarki: gunFarki, filtre: filtre, yaklasan: yaklasan, serit: serit, canli: canli, sonVeri: sonVeri };
});
