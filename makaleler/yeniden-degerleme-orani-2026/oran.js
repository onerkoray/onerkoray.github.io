/*!
 * 2026 yılı yeniden değerleme oranı (2027 tutarlarına esas), Ekim verisi
 * gelmeden: on iki ayın on biri belli, kalan bir ay oranı ne kadar oynatır?
 *
 * KURAL (VUK mükerrer 298/B)
 * --------------------------
 * Oran, Yİ-ÜFE'de ekim ayı itibarıyla son bir yıllık dönemde meydana gelen
 * ORTALAMA fiyat artışıdır: Kasım–Ekim on iki ayının endeks ortalaması,
 * bir önceki Kasım–Ekim ortalamasına bölünür. Ortalama olduğu için Ekim ayı
 * paydaya hiç, paya on ikide bir ağırlıkla girer.
 *
 * Modül önce kuralın doğru kurulduğunu gösterir: aynı hesap 2021–2025 için
 * VUK tebliğleriyle ilan edilen oranı (finans/endeksleme-serileri.js) iki
 * ondalıkta birebir veriyor. Sonra 2026 için tek bilinmeyeni, Ekim'in aylık
 * değişimini, senaryo olarak alır. Bu bir tahmin değil: Ekim ne gelirse
 * gelsin oranın kalacağı aralığın hesabı.
 *
 * Veri: yi-ufe-2026-09.json (TCMB EVDS TP.TUFE1YI.T1, TÜİK Yİ-ÜFE 2003=100,
 * 22 Ekim 2026'da indirildi). Ekim 2026 endeksi TÜİK'in 3 Kasım 2026
 * bülteniyle gelir; o gün anlık görüntü yenilenir ve senaryo kesinleşir.
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) {
    module.exports = fabrika(require("./yi-ufe-2026-09.json"), require("../../bordro/motor.js"),
      require("../../finans/endeksleme-serileri.js"), require("../../mtv-hesaplama/tarife.js"));
  } else {
    kok.YDO2027 = fabrika(kok.YI_UFE, kok.Bordro, kok.EndekslemeSerileri, kok.MtvTarife);
  }
})(typeof self !== "undefined" ? self : this, function (V, B, S, M) {
  "use strict";

  var E = V.endeks;
  var KESIR_PAYI = 0.05;           // GVK mük.123: %5'i aşmayan kesir atılır

  function ay(y, m) { return y + "-" + (m < 10 ? "0" : "") + m; }
  /* Kasım (yil-1) – Ekim (yil) on iki ay. */
  function donem(yil) {
    var out = [];
    for (var i = 0; i < 12; i++) { var m = 11 + i, y = yil - 1; if (m > 12) { m -= 12; y = yil; } out.push(ay(y, m)); }
    return out;
  }
  function toplam(aylar, ek) {
    return aylar.reduce(function (s, a) {
      var v = ek && a in ek ? ek[a] : E[a];
      if (v === undefined) throw new Error("Yİ-ÜFE verisi yok: " + a);
      return s + v;
    }, 0);
  }

  /** Ekim'i belli bir yılın oranı (yüzde). ek: eksik aylar için değer. */
  function oran(yil, ek) { return (toplam(donem(yil), ek) / toplam(donem(yil - 1), ek) - 1) * 100; }

  /** VUK tebliğleriyle ilan edilen oran: sitenin endeksleme serisinden.
      Seride "ydo", o yılın TARİFESİNE esas oran, yani bir önceki yılınki. */
  function ilan(yil) { var s = S.SERI[yil + 1]; return s ? s.ydo : null; }

  /** 2026 oranı, Ekim'in aylık değişimi x (yüzde) olursa. */
  function senaryo(x) {
    var ekim = E["2026-09"] * (1 + x / 100);
    var ek = {}; ek["2026-10"] = ekim;
    return { aylik: x, oran: oran(2026, ek), ekimYillik: (ekim / E["2025-10"] - 1) * 100 };
  }

  /** Ekim'in aylık değişimindeki her 1 puanın orana etkisi (puan). */
  function duyarlilik() { return senaryo(1).oran - senaryo(0).oran; }

  /** Son 24 ayın (Ekim 2024 – Eylül 2026) en düşük ve en yüksek aylık değişimi. */
  function sonIkiYil() {
    var ks = Object.keys(E).sort(), out = [];
    for (var i = 1; i < ks.length; i++) if (ks[i] >= "2024-10") out.push({ ay: ks[i], degisim: (E[ks[i]] / E[ks[i - 1]] - 1) * 100 });
    var alt = out.reduce(function (a, b) { return b.degisim < a.degisim ? b : a; });
    var ust = out.reduce(function (a, b) { return b.degisim > a.degisim ? b : a; });
    return { aylar: out, alt: alt, ust: ust };
  }
  function aralik() {
    var s = sonIkiYil();
    return { alt: senaryo(s.alt.degisim), ust: senaryo(s.ust.degisim), altAy: s.alt.ay, ustAy: s.ust.ay };
  }

  /** Aynı yöntem geçmişte tutar mıydı? Yılın Eylül'üne kadarki veriyle,
      önceki 24 ayın en düşük ve en yüksek aylık değişimi Ekim'e konur;
      ilan edilen oran bu aralıkta mı? */
  function geriyeDonuk(yil) {
    var ks = Object.keys(E).sort(), ch = [];
    for (var i = 1; i < ks.length; i++) if (ks[i] >= ay(yil - 2, 10) && ks[i] <= ay(yil, 9)) ch.push((E[ks[i]] / E[ks[i - 1]] - 1) * 100);
    var mn = Math.min.apply(null, ch), mx = Math.max.apply(null, ch);
    function s(x) { var ek = {}; ek[ay(yil, 10)] = E[ay(yil, 9)] * (1 + x / 100); return oran(yil, ek); }
    var gercek = ilan(yil), alt = s(mn), ust = s(mx);
    return {
      yil: yil, ayAdedi: ch.length, minAylik: mn, maxAylik: mx, alt: alt, ust: ust, ilan: gercek,
      ekimAylik: (E[ay(yil, 10)] / E[ay(yil, 9)] - 1) * 100,
      icinde: gercek >= Math.round(alt * 100) / 100 && gercek <= Math.round(ust * 100) / 100,
      sapma: gercek > ust ? gercek - ust : (gercek < alt ? gercek - alt : 0)
    };
  }

  /** On bir ayın payı: Ekim hiç artmasa bile oran neden zaten yüksek? */
  function bilinenPay() {
    var d = donem(2026), bil = d.slice(0, 11);
    return { bilinenAy: bil.length, payda: toplam(donem(2025)), bilinen: toplam(bil) };
  }

  /** 2027 gelir vergisi dilimleri için pencere: ham tutar ve %5 aşağısı. */
  function dilimPenceresi(oranAlt, oranUst) {
    return B.parametre(2026).dilimler.filter(function (d) { return d[0] !== null; }).map(function (d, i) {
      var hamAlt = d[0] * (1 + oranAlt / 100), hamUst = d[0] * (1 + oranUst / 100);
      return { sira: i + 1, oran: d[1], tutar2026: d[0], hamAlt: hamAlt, hamUst: hamUst, enAz: hamAlt * (1 - KESIR_PAYI), enCok: hamUst };
    });
  }

  /** MTV örneği: 1301–1600 cm³, 1–3 yaş, (I) tarifesinin ilk kademesi. */
  function mtvOrnek(oranYuzde) {
    var t = M.TARIFE_I[1].satir[0][0];
    return { tutar2026: t, kanunOrani: t * (1 + oranYuzde / 100), uygulanan2026: M.YENIDEN_DEGERLEME };
  }

  return {
    VERI: V, KESIR_PAYI: KESIR_PAYI, donem: donem, oran: oran, ilan: ilan, senaryo: senaryo,
    duyarlilik: duyarlilik, sonIkiYil: sonIkiYil, aralik: aralik, bilinenPay: bilinenPay, geriyeDonuk: geriyeDonuk,
    dilimPenceresi: dilimPenceresi, mtvOrnek: mtvOrnek
  };
});
