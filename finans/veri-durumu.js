/*!
 * Veri Durumu — sonucun yanında hangi aya kadar veri kullanıldığını söyler
 *
 * NEDEN VAR: 28 Ekim–4 Kasım 2026 arasında gece veri işi düştü ve araçlar
 * eski seriyle hesap yapmayı sürdürdü; okur bunu göremezdi. Durum, sayfanın
 * elindeki seri ve TÜİK takviminden tarayıcıda çıkarılır. Her gece değişen
 * bir zaman damgası yok, çünkü o damga her gün bütün sayfaları kirletirdi.
 *
 * Kullanım: <p class="muted" data-veri-durumu="TufeSerisi" hidden></p>
 * Seri betiğinden sonra yüklenir; öznitelik serinin tarayıcı globalidir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else { root.VeriDurumu = v; v.yerlestir(root); }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var TOLERANS_GUN = 3;   // Cuma açıklaması Pazartesi akşamı işlenmiş olur

  function iki(n) { return (n < 10 ? "0" : "") + n; }
  function ayEkle(ay, k) {
    var p = ay.split("-"), t = (+p[0]) * 12 + (+p[1] - 1) + k;
    return Math.floor(t / 12) + "-" + iki(t % 12 + 1);
  }
  function ayAdi(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }
  function tarihAdi(iso) { var p = iso.split("-"); return (+p[2]) + " " + AYLAR[+p[1] - 1] + " " + p[0]; }

  /* TÜİK ayın 3'ünde, hafta sonuysa ilk iş gününde açıklar (finans/kira-motoru.js ile aynı; test sabitliyor). */
  function aciklamaTarihi(veriAy) {
    var a = ayEkle(veriAy, 1).split("-");
    var d = new Date(Date.UTC(+a[0], +a[1] - 1, 3));
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 864e5);
    return d.toISOString().slice(0, 10);
  }

  function gunEkle(iso, k) { return new Date(Date.parse(iso) + k * 864e5).toISOString().slice(0, 10); }

  function durum(sonAy, bugun) {
    var sonraki = ayEkle(sonAy, 1), tarih = aciklamaTarihi(sonraki);
    return { sonAy: sonAy, sonraki: sonraki, tarih: tarih,
      evre: bugun > gunEkle(tarih, TOLERANS_GUN) ? "gecikti" : bugun >= tarih ? "isleniyor" : "bekleniyor" };
  }

  function metin(d) {
    var bas = "Veri: TÜİK TÜFE, son ay " + ayAdi(d.sonAy) + ". ", s = ayAdi(d.sonraki) + " verisi " + tarihAdi(d.tarih) + " tarihinde ";
    if (d.evre === "gecikti") return bas + s + "açıklanmış olmalıydı, sitede henüz yok. Hesap son doğrulanmış veriyle yapıldı.";
    if (d.evre === "isleniyor") return bas + s + "açıklandı, sitede kısa süre içinde işlenir.";
    return bas + s + "açıklanacak.";
  }

  function sonAyi(seri) { return seri.sonAy || Object.keys(seri.oranlar || {}).sort().pop(); }

  function yerlestir(kok) {
    var belge = kok.document;
    if (!belge) return;
    var bugun = new Date().toISOString().slice(0, 10);
    belge.querySelectorAll("[data-veri-durumu]").forEach(function (p) {
      var seri = kok[p.getAttribute("data-veri-durumu")], ay = seri && sonAyi(seri);
      if (!ay) return;
      p.textContent = metin(durum(ay, bugun));
      p.hidden = false;
    });
  }

  return { aciklamaTarihi: aciklamaTarihi, durum: durum, metin: metin, sonAyi: sonAyi, yerlestir: yerlestir };
});
