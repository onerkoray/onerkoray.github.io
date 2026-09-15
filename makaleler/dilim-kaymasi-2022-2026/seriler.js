/*!
 * Endeksleme serileri: TÜFE ve yeniden değerleme oranı, 2022–2026.
 *
 * NEDEN AYRI DOSYA
 * ----------------
 * Bu iki seri bir HESAP PARAMETRESİ değil, dış istatistik. Sitedeki hiçbir
 * araç onları kullanmıyor; yalnızca bu yazının ölçümü onlara dayanıyor. Bu
 * yüzden bordro/parametreler.js'e konmadılar: orası araçların okuduğu tek
 * doğruluk kaynağı ve hiçbir aracın okumadığı veriyle şişirilmesi, o
 * dosyanın ne olduğunu bulanıklaştırır.
 *
 * Ama yazının içine de gömülmediler. Gömülselerdi tablo ile metin ayrı ayrı
 * eskir ve fark edilmezdi; burada tek yerde durup testle sabitleniyorlar.
 *
 * İKİ ÖLÇÜT NEDEN FARKLI
 * ----------------------
 * TÜFE tüketici fiyatlarının Aralık–Aralık değişimi. Yeniden değerleme oranı
 * ise VUK mükerrer 298/B uyarınca ÜRETİCİ fiyatlarının (Yİ-ÜFE) ekim ayı
 * itibarıyla ortalama artışı. Tarife, kanunen ikincisine bağlı. İkisinin
 * ayrışması bu yazının bulgusunun kendisi, o yüzden ikisi de tutuluyor.
 *
 * "ydo" alanı, o yılın TARİFESİNE esas alınan orandır; yani bir önceki yılın
 * yeniden değerleme oranı. 2026 satırındaki %25,49, 2025 yılı için tespit
 * edilen orandır.
 *
 * Kaynaklar:
 *   TÜFE   — TÜİK Tüketici Fiyat Endeksi haber bültenleri, Aralık 2021–2025
 *   YDO    — VUK Genel Tebliğleri (2024 için sıra no. 574: %43,93;
 *            2025 için sıra no. 585: %25,49)
 */
(function (kok) {
  "use strict";

  /* tufe: yılın tarifesinin karşılaştırıldığı ÖNCEKİ yıl enflasyonu.
     ydo:  yılın tarifesine esas alınan yeniden değerleme oranı. */
  var SERI = {
    2022: { tufe: 36.08, ydo: 36.20 },
    2023: { tufe: 64.27, ydo: 122.93 },
    2024: { tufe: 64.77, ydo: 58.46 },
    2025: { tufe: 44.38, ydo: 43.93 },
    2026: { tufe: 30.89, ydo: 25.49 }
  };

  var YILLAR = Object.keys(SERI).map(Number).sort(function (a, b) { return a - b; });

  /** Bir yıldan diğerine birikmiş TÜFE çarpanı (bas yılı hariç, son dahil). */
  function birikmisTufe(bas, son) {
    var k = 1;
    for (var y = bas + 1; y <= son; y++) {
      if (!SERI[y]) return null;
      k *= 1 + SERI[y].tufe / 100;
    }
    return k;
  }

  /** Nominal tutarı bas yılı fiyatlarına indirger. */
  function reellestir(tutar, yil, bas) {
    var k = birikmisTufe(bas, yil);
    return k === null ? null : tutar / k;
  }

  var api = { SERI: SERI, YILLAR: YILLAR,
              birikmisTufe: birikmisTufe, reellestir: reellestir };
  if (typeof module === "object" && module.exports) module.exports = api;
  else kok.EndekslemeSerileri = api;
})(typeof window !== "undefined" ? window : this);
