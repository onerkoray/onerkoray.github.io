/*!
 * Kira artışı sayfasının görünümü: sonuç kartları, kira geçmişi ve grafik
 * seçenekleri. Hem sayfa betiği (tarayıcı) hem tools/kira-sayfa.js (sunucu
 * tarafı ön çizim) bunu kullanır; JS'siz okurun gördüğü örnek ile hesap
 * makinesinin çıktısı aynı koddan çıkar.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var M = root.KiraMotoru, K = root.KiraTufe, C = root.GrafikCizim;
  if (!M && typeof require === "function") {
    M = require("../finans/kira-motoru.js");
    K = require("../finans/kira-tufe.js");
    C = require("../grafikler/cizim.js");
  }
  var v = factory(M, K, C);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.KiraGorunum = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (M, K, C) {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var sayi = C.sayi, kacis = C.kacis;

  function yuzde(v) { return "%" + sayi(v, 2); }
  function tl(v) { return sayi(v, 2) + " TL"; }
  function tarihUzun(iso) { var p = iso.split("-"); return +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0]; }

  /* Yıl rakamına gelen ek: 2026'da, 2023'te, 2022'den, 2020'den. Ünlü
     uyumu yılın okunuşundaki son kelimeden. */
  function sonKelime(n) {
    var BIR = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
    var ON = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
    if (n % 10) return BIR[n % 10];
    if (n % 100) return ON[(n % 100) / 10];
    return n % 1000 ? "yüz" : "bin";
  }
  function ek(n, son) {
    var k = sonKelime(n), u = (k.match(/[aıoueiöü]/g) || []).pop();
    return "'" + (/[çfhkpsşt]$/.test(k) ? "t" : "d") + ("aıou".indexOf(u) >= 0 ? "a" : "e") + son;
  }
  function ayDa(ay) { return M.ayAdi(ay) + ek(+ay.slice(0, 4), ""); }
  function ayDan(ay) { return M.ayAdi(ay) + ek(+ay.slice(0, 4), "n"); }

  function kart(etiket, deger, not, sinif) {
    return '<div class="sum-card' + (sinif ? " " + sinif : "") + '"><span class="sum-label">' + etiket +
      '</span><strong class="sum-value">' + deger + '</strong><span class="sum-note">' + not + "</span></div>";
  }

  /* Oran henüz yoksa (açıklanmadı ya da serinin öncesi) okura ne diyeceğiz. */
  function oranYok(r) {
    if (r.bekleniyor) {
      return M.ayAdi(M.yenilemeAyi(r.veriAyi)) + " yenilemelerine uygulanacak oran (" + M.ayAdi(r.veriAyi) +
        " verisi) " + tarihUzun(r.aciklama) + " tarihinde açıklanacak. Araç tahmin üretmez.";
    }
    return "Bu araç " + M.ayAdi(M.yenilemeAyi(K.ilkAy)) + " ve sonrasındaki yenilemeleri hesaplar.";
  }

  /* Tek yenileme: KiraMotoru.yeniKira sonucundan kartlar ve notlar. */
  function yeniKiraHtml(r, tur) {
    if (r.yeniKira === undefined) return { html: "", mesaj: oranYok(r) };
    var notlar = [];
    if (r.sinir25 && r.tufe > M.SINIR25.oran) {
      notlar.push("Bu tarihte konut kirasına %25 sınırı uygulanır (7409 ve 7456 sayılı Kanunlar); o ayın TÜFE oranı " +
        yuzde(r.tufe) + " idi.");
    }
    if (r.sozlesmeSinirlandi) notlar.push("Sözleşmedeki oran yasal tavanı aşıyor; artış " + yuzde(r.tavan) + " ile sınırlandı.");
    else if (r.uygulanan < r.tavan) notlar.push("Sözleşmedeki oran yasal tavanın (" + yuzde(r.tavan) + ") altında olduğu için o uygulandı.");
    var html = '<div class="sum-grid">' +
      kart("Yeni aylık kira", tl(r.yeniKira), yuzde(r.uygulanan) + " artışla", "kira-kart-ana") +
      kart("Aylık fark", "+ " + tl(r.fark), "önceki kira " + tl(r.oncekiKira)) +
      kart("Yıllık fark", "+ " + tl(r.yillikFark), "12 ay üzerinden") +
      kart("Uygulanan oran", yuzde(r.uygulanan), M.ayAdi(r.veriAyi) + " verisi, " + tarihUzun(r.aciklama) +
        " · " + (tur === "isyeri" ? "çatılı iş yeri" : "konut")) +
      "</div>" +
      notlar.map(function (n) { return '<p class="kira-not">' + n + "</p>"; }).join("");
    return { html: html, mesaj: "" };
  }

  /* Başlangıçtan bugüne zincir: KiraMotoru.gecmis sonucundan. */
  function gecmisHtml(g) {
    var tamam = g.yenilemeler.filter(function (r) { return r.yeniKira !== undefined; });
    var satir = g.yenilemeler.map(function (r) {
      if (r.yeniKira === undefined) {
        return "<tr><th scope=\"row\">" + tarihUzun(r.tarih) + "</th><td colspan=\"3\">" + oranYok(r) + "</td></tr>";
      }
      return "<tr><th scope=\"row\">" + tarihUzun(r.tarih) + "</th><td>" + M.ayAdi(r.veriAyi) + "</td><td class=\"sayi\">" +
        yuzde(r.uygulanan) + (r.sinir25 && r.tufe > M.SINIR25.oran ? " <small>(TÜFE " + yuzde(r.tufe) + ")</small>" : "") +
        "</td><td class=\"sayi\">" + tl(r.yeniKira) + "</td></tr>";
    }).join("");
    var sonraki = "";
    if (g.sonraki) {
      sonraki = '<p class="kira-not">Sıradaki yenileme ' + tarihUzun(g.sonraki.tarih) + ". " +
        (g.sonraki.tufe !== null ? "Uygulanacak oran açıklandı: " + yuzde(g.sonraki.uygulanan) + "." : oranYok(g.sonraki)) + "</p>";
    }
    var besYilGecti = g.yenilemeler.length && g.yenilemeler[g.yenilemeler.length - 1].tarih > g.besYil;
    return '<div class="sum-grid">' +
      kart("Bugünkü yasal azami kira", tl(g.guncelKira), tl(g.ilkKira) + " başlangıçtan, " + tamam.length + " yenilemede", "kira-kart-ana") +
      kart("Toplam artış", "×" + sayi(1 + g.toplamArtis, 2), "ilk kiranın katı") +
      kart("Beşinci yıl sonu", tarihUzun(g.besYil), besYilGecti ?
        "geçti: yeni dönem kirası hakimce belirlenebilir (TBK m.344/3)" : "sonrasında hakim tespiti mümkün (TBK m.344/3)") +
      kart("On yıllık uzama sonu", tarihUzun(g.onYil), "kiraya veren gerekçesiz fesih hakkı kazanır (TBK m.347)") +
      "</div>" +
      (satir ? '<div class="table-scroll"><table class="veri-tablo kira-tablo"><caption>Yenileme zinciri: her yıldönümünde yasal azami oran</caption>' +
        '<thead><tr><th scope="col">Yenileme</th><th scope="col">Veri ayı</th><th scope="col" class="sayi">Uygulanan oran</th><th scope="col" class="sayi">Yeni kira</th></tr></thead>' +
        "<tbody>" + satir + "</tbody></table></div>" : '<p class="kira-not">Henüz yenileme yok.</p>') +
      sonraki;
  }

  /* Grafik: yenileme ayına göre oran. Sunucu iki genişlikte çizer; tarayıcı
     aynı seçeneklerden ölçekleri alıp imleci bağlar. */
  var GRAFIK_ILK = "2018-12";
  function grafikNoktalari() {
    return Object.keys(K.oranlar).sort().filter(function (va) { return va >= GRAFIK_ILK; })
      .map(function (va) { return { x: M.yenilemeAyi(va), y: K.oranlar[va] }; });
  }
  function grafikSecenek(W) {
    var noktalar = grafikNoktalari();
    var tepe = noktalar.reduce(function (a, b) { return b.y > a.y ? b : a; });
    var son = noktalar[noktalar.length - 1];
    var dar = W < 560;
    return {
      id: dar ? "kira-dar" : "kira", genislik: W, yukseklik: dar ? 240 : 300,
      etiket: "Kira artış oranı, yenileme ayına göre, " + M.ayAdi(noktalar[0].x) + "–" + M.ayAdi(son.x) +
        ". En yüksek " + M.ayAdi(tepe.x) + " " + yuzde(tepe.y) + ", son " + M.ayAdi(son.x) + " " + yuzde(son.y) + ".",
      x: { tip: "ay", min: noktalar[0].x, max: son.x },
      y: { tip: "lin", min: 0, max: 80, izgara: [0, 20, 40, 60, 80], bicim: function (v) { return "%" + sayi(v); } },
      bantlar: [{ bas: "2022-06", son: "2024-07", sinif: "kira-bant" }],   // açıklaması figcaption'da; etiket tepe notuyla çakışıyordu
      referans: 25,
      seriler: [{ ad: "Kira artış oranı", sinif: "gr-s-ana", alan: true, noktalar: noktalar }],
      notlar: [
        { x: tepe.x, y: tepe.y, metin: yuzde(tepe.y), alt: C.ayEtiket(tepe.x), hiza: "sol" },
        { x: son.x, y: son.y, metin: yuzde(son.y), alt: C.ayEtiket(son.x), hiza: "sag", dy: -18, sinif: "gr-not--son" }
      ]
    };
  }
  function grafikHtml() {
    var genis = C.cizgi(grafikSecenek(1000)).svg;
    var dar = C.cizgi(grafikSecenek(380)).svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
    return '<div class="kira-grafik-genis gr-tuval">' + genis + '</div><div class="kira-grafik-dar gr-tuval">' + dar + "</div>";
  }

  return {
    sayi: sayi, yuzde: yuzde, tl: tl, tarihUzun: tarihUzun, ayDa: ayDa, ayDan: ayDan, kacis: kacis,
    yeniKiraHtml: yeniKiraHtml, gecmisHtml: gecmisHtml, oranYok: oranYok,
    grafikSecenek: grafikSecenek, grafikHtml: grafikHtml,
    ORNEK_GECMIS: { baslangic: "2021-09-01", kira: 4000, tur: "konut", sozlesme: null }
  };
});
