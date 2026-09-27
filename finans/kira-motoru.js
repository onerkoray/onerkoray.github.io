/*!
 * Kira artışı motoru — yasal azami oran, yenileme zinciri, açıklama takvimi.
 *
 * HUKUK
 * -----
 * TBK m.344/1: yenilenen kira döneminde artış, bir önceki kira yılında
 * TÜFE'nin 12 aylık ortalamalara göre değişimini aşamaz. Uygulanan oran,
 * yenileme ayından BİR ÖNCEKİ ayın verisidir (Eylül'de yenilenen kiraya
 * Ağustos verisi); TÜİK onu yenileme ayının 3'ünde açıklar.
 *
 * Konut kiralarında geçici %25 sınırı: 7409 sayılı Kanun (RG 11.06.2022)
 * 11 Haziran 2022'den, 7456 sayılı Kanun ile uzatılarak 1 Temmuz 2024'e
 * kadar yenilenen konut kiralarında. 1 Temmuz 2024 ve sonrası yalnız TÜFE.
 * Çatılı iş yerlerinde %25 sınırı hiç uygulanmadı.
 *
 * Sözleşmede daha düşük bir oran yazıyorsa o uygulanır; daha yüksekse
 * yasal tavana indirilir.
 *
 * TBK m.344/3: beş yılı aşan kira ilişkisinde, beşinci yılın sonundan
 * sonra bedel hakimce hakkaniyete göre belirlenebilir. TBK m.347: on yıllık
 * uzama süresi dolunca kiraya veren gerekçesiz fesih hakkı kazanır. Motor
 * bu iki tarihi hesaplar; hakim tespitinin tutarını HESAPLAMAZ.
 *
 * VERİ
 * ----
 * KiraTufe (finans/kira-tufe.js): TÜİK TÜFE endeksinden, resmî açıklanan
 * oranlarla birebir. Anahtar veri ayıdır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var K = root.KiraTufe;
  if (!K && typeof require === "function") K = require("./kira-tufe.js");
  var v = factory(K);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.KiraMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (K) {
  "use strict";

  var SINIR25 = { bas: "2022-06-11", bit: "2024-07-01", oran: 25 };
  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function iki(n) { return (n < 10 ? "0" : "") + n; }
  function ayEkle(ay, k) {                           // "YYYY-MM" + k ay
    var p = ay.split("-"), t = +p[0] * 12 + (+p[1] - 1) + k;
    return Math.floor(t / 12) + "-" + iki(t % 12 + 1);
  }
  function veriAyi(tarih) { return ayEkle(tarih.slice(0, 7), -1); }
  function yenilemeAyi(veriAy) { return ayEkle(veriAy, 1); }
  function ayAdi(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }

  /* TÜİK bir ayın verisini izleyen ayın 3'ünde açıklar; hafta sonuna denk
     gelirse ilk iş gününe kayar. Resmî tatiller hesaba katılmaz (metin
     "beklenen" der). Dönüş: "YYYY-MM-DD". */
  function aciklamaTarihi(veriAy) {
    var a = ayEkle(veriAy, 1).split("-");
    var d = new Date(Date.UTC(+a[0], +a[1] - 1, 3));
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 86400000);
    return d.toISOString().slice(0, 10);
  }

  /* Yıldönümü: 29 Şubat başlangıçlı sözleşmede artık olmayan yıllarda 28 Şubat. */
  function yildonumu(baslangic, k) {
    var p = baslangic.split("-"), y = +p[0] + k, m = +p[1], g = +p[2];
    var sonGun = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + "-" + iki(m) + "-" + iki(Math.min(g, sonGun));
  }

  function sinirUygulanir(tarih, tur) {
    return tur === "konut" && tarih >= SINIR25.bas && tarih < SINIR25.bit;
  }

  /* Tek yenileme: o tarihte yenilenen kiraya uygulanacak azami oran.
     o = { tarih: "YYYY-MM-DD", tur: "konut"|"isyeri", sozlesme: sayı|null } */
  function oran(o) {
    var va = veriAyi(o.tarih);
    var tufe = K.oranlar.hasOwnProperty(va) ? K.oranlar[va] : null;
    var sinir = sinirUygulanir(o.tarih, o.tur);
    var sonuc = { tarih: o.tarih, veriAyi: va, aciklama: aciklamaTarihi(va), tufe: tufe, sinir25: sinir };
    if (tufe === null) {
      sonuc.bekleniyor = va > K.sonAy;           // henüz açıklanmadı
      sonuc.kapsamDisi = va < K.ilkAy;           // serinin başından önce
      return sonuc;
    }
    var tavan = sinir ? Math.min(SINIR25.oran, tufe) : tufe;
    var s = o.sozlesme;
    var uygulanan = (s === null || s === undefined || s === "" || isNaN(s)) ? tavan : Math.min(Math.max(+s, 0), tavan);
    sonuc.tavan = tavan;
    sonuc.uygulanan = uygulanan;
    sonuc.sozlesmeSinirlandi = s !== null && s !== undefined && s !== "" && !isNaN(s) && +s > tavan;
    sonuc.dayanak = sinir && tufe > SINIR25.oran ? "7409 ve 7456 sayılı Kanunlar: konutta %25 sınırı" : "TBK m.344/1: 12 aylık TÜFE ortalaması";
    return sonuc;
  }

  function kurus(x) { return Math.round(x * 100) / 100; }

  function yeniKira(kira, o) {
    var r = oran(o);
    if (r.uygulanan === undefined) return r;
    r.oncekiKira = kira;
    r.yeniKira = kurus(kira * (1 + r.uygulanan / 100));
    r.fark = kurus(r.yeniKira - kira);
    r.yillikFark = kurus(r.fark * 12);
    return r;
  }

  /* Başlangıçtan bugüne yenileme zinciri. Varsayım: her yenilemede yasal
     azami (ya da daha düşük sözleşme oranı) uygulandı; kira kuruşa yuvarlanır.
     o = { baslangic, kira, tur, sozlesme, bugun } */
  function gecmis(o) {
    var kira = kurus(+o.kira), satirlar = [], k = 1, sonraki = null;
    while (k < 60) {
      var t = yildonumu(o.baslangic, k);
      if (t > o.bugun) { sonraki = oran({ tarih: t, tur: o.tur, sozlesme: o.sozlesme }); break; }
      var r = yeniKira(kira, { tarih: t, tur: o.tur, sozlesme: o.sozlesme });
      r.yil = k;
      satirlar.push(r);
      if (r.yeniKira === undefined) break;       // oran bekleniyor ya da kapsam dışı
      kira = r.yeniKira;
      k++;
    }
    return {
      yenilemeler: satirlar,
      guncelKira: kira,
      ilkKira: kurus(+o.kira),
      toplamArtis: kira / (+o.kira) - 1,
      besYil: yildonumu(o.baslangic, 5),
      onYil: yildonumu(o.baslangic, 10),
      sonraki: sonraki
    };
  }

  /* Tablolar için: veri ayından yenileme ayına bütün oranlar, yeniden eskiye. */
  function tablo(ilkYenileme) {
    return Object.keys(K.oranlar).sort().reverse().map(function (va) {
      var ya = yenilemeAyi(va);
      return { yenilemeAyi: ya, veriAyi: va, tufe: K.oranlar[va], aciklama: aciklamaTarihi(va),
        konutSinirli: ya >= "2022-06" && ya < "2024-07" };
    }).filter(function (r) { return !ilkYenileme || r.yenilemeAyi >= ilkYenileme; });
  }

  function durum() {
    var sonVeri = K.sonAy;
    return {
      sonVeriAyi: sonVeri, sonYenilemeAyi: yenilemeAyi(sonVeri), sonOran: K.oranlar[sonVeri],
      sonAciklama: aciklamaTarihi(sonVeri),
      sonrakiVeriAyi: ayEkle(sonVeri, 1), sonrakiYenilemeAyi: ayEkle(sonVeri, 2),
      sonrakiAciklama: aciklamaTarihi(ayEkle(sonVeri, 1))
    };
  }

  return {
    SINIR25: SINIR25, oran: oran, yeniKira: yeniKira, gecmis: gecmis, tablo: tablo, durum: durum,
    veriAyi: veriAyi, yenilemeAyi: yenilemeAyi, aciklamaTarihi: aciklamaTarihi, yildonumu: yildonumu,
    sinirUygulanir: sinirUygulanir, ayAdi: ayAdi, ayEkle: ayEkle, kurus: kurus
  };
});
