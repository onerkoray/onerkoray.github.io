/*!
 * TL mi döviz mi — başabaş kur.
 *
 * Aynı parayı aynı vadede TL mevduata ya da döviz mevduatına koymanın
 * vade sonunda eşitlendiği kur. Stopaj ve faiz hesabı mevduat aracıyla
 * aynı fonksiyondan (finans/kurallar.js → mevduat): TL'de stopaj vadeye göre
 * kademeli, dövizde sabit %25. Döviz faizi düşük olduğu sürece bu fark
 * başabaşı çok az değiştirir; asıl belirleyici TL faizi, vade ve kur makası.
 *
 *   başabaş kur = TL vade sonu (net) ÷ döviz vade sonu (net, döviz)
 *   gereken kur artışı = başabaş kur ÷ bugünkü kur − 1
 *
 * Kur makası (isteğe bağlı): döviz bugünkü kurdan alınır, vade sonunda
 * kur × (1 − makas) ile bozdurulur. Makas başabaş kuru aynı oranda yükseltir.
 *
 * Kur tahmini yapmaz: sonucu "kur bu vadede şu kadardan fazla artarsa döviz
 * kazanır" diye verir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/tl-mi-doviz-mi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("./kurallar.js"));
  else kok.DovizBasabas = fabrika(kok.Finans);
})(typeof globalThis !== "undefined" ? globalThis : this, function (F) {
  "use strict";

  /* Stopaj oranları hesabın açıldığı tarihe değil vadeye bağlı (9 Temmuz
     2025 sonrası rejim); mevduat fonksiyonu bir başlangıç tarihi istediği
     için rejim içindeki sabit bir tarih verilir. */
  var BASLANGIC = "2026-01-01";

  function dogrula(g) {
    var o = {
      anapara: Number(g.anapara), tlFaiz: Number(g.tlFaiz), dovizFaiz: Number(g.dovizFaiz),
      gun: Math.round(Number(g.gun)), kur: Number(g.kur), makas: Number(g.makas || 0)
    };
    if (!(o.anapara > 0)) throw new Error("Anapara pozitif olmalı.");
    if (!(o.kur > 0)) throw new Error("Bugünkü kur pozitif olmalı.");
    if (!(o.tlFaiz >= 0) || !(o.dovizFaiz >= 0)) throw new Error("Faiz oranları sıfır ya da pozitif olmalı.");
    if (!(o.makas >= 0 && o.makas < 0.2)) throw new Error("Kur makası %0 ile %20 arasında olmalı.");
    if (!(o.gun >= 1 && o.gun <= 3650)) throw new Error("Vade 1 ile 3650 gün arasında olmalı.");
    return o;
  }

  function hesapla(girdi) {
    var g = dogrula(girdi);
    var tl = F.mevduat(g.anapara, g.tlFaiz, g.gun, BASLANGIC, "tl");
    var dovizAnapara = g.anapara / g.kur;
    var dv = F.mevduat(dovizAnapara, g.dovizFaiz, g.gun, BASLANGIC, "doviz");
    var basabas = tl.maturity / (dv.maturity * (1 - g.makas));
    var artis = basabas / g.kur - 1;
    return {
      girdi: g,
      tl: { brut: tl.gross, stopaj: tl.tax, net: tl.net, vadeSonu: tl.maturity, stopajOrani: tl.taxPct / 100,
            netGetiri: tl.net / g.anapara },
      doviz: { anapara: dovizAnapara, brut: dv.gross, stopaj: dv.tax, net: dv.net, vadeSonu: dv.maturity,
               stopajOrani: dv.taxPct / 100, netGetiri: dv.net / dovizAnapara },
      basabasKur: basabas,
      gerekenArtis: artis,
      yillikArtis: Math.pow(1 + artis, 365 / g.gun) - 1
    };
  }

  /** Kur değişim senaryoları: döviz yolunun TL karşılığı ve TL yoluna farkı. */
  function senaryo(girdi, degisimler) {
    var r = hesapla(girdi);
    return degisimler.map(function (d) {
      var kur = r.girdi.kur * (1 + d), tlKarsilik = r.doviz.vadeSonu * kur * (1 - r.girdi.makas);
      return { degisim: d, kur: kur, dovizTl: tlKarsilik, fark: tlKarsilik - r.tl.vadeSonu, kazanan: tlKarsilik > r.tl.vadeSonu ? "doviz" : "tl" };
    });
  }

  /** Aynı brüt oranlarla farklı vadelerde gereken yıllık kur artışı. */
  function vadeler(girdi, gunler) {
    return gunler.map(function (gun) {
      var g = {}; for (var k in girdi) g[k] = girdi[k]; g.gun = gun;
      var r = hesapla(g);
      return { gun: gun, stopajTl: r.tl.stopajOrani, stopajDoviz: r.doviz.stopajOrani,
               gerekenArtis: r.gerekenArtis, yillikArtis: r.yillikArtis };
    });
  }

  return { surum: "1.0.0", hesapla: hesapla, senaryo: senaryo, vadeler: vadeler };
});
