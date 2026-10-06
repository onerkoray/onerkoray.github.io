/*!
 * İŞKUR GÜÇ programları — cep harçlığı ve takvim. TEK DOĞRULUK KAYNAĞI.
 *
 * KURAL (İŞKUR'un kendi program sayfaları, 6 Ekim 2026'da okundu;
 * 5510 s.K. m.5/1-e mevzuat.gov.tr güncel metni)
 *
 *   Cep harçlığı: katılım sağlanan her gün için 1.375 TL (İŞKUR Yönetim
 *     Kurulu, 1 Ocak 2026'dan). Ücret değildir: izin ve devamsızlık
 *     günlerinde ödenmez.
 *   İŞKUR Gençlik Programı: devlet üniversitelerinin örgün öğrencileri;
 *     haftada en çok 3 gün ve 22,5 saat; program en çok 10 ay; hane geliri
 *     net asgari ücretin 3 katını aşmamalı (yurtta kalanlar muaf).
 *   İşgücü Uyum Programı (NEET gençler için NİUP dahil): ilk dört hafta
 *     haftada 5 gün (37,5 saat), sonra 3 gün (22,5 saat); en çok 10 ay;
 *     hane geliri net asgari ücretin 2 katını aşmamalı.
 *   İkisinde de bir kişi İşgücü Uyum Programı Yönetmeliği kapsamındaki
 *     programlardan TOPLAMDA en çok 140 fiili gün yararlanır.
 *   Sigorta: 5510 m.5/1-e — iş kazası ve meslek hastalığı ile genel sağlık
 *     sigortası; prim oranı %5,5 ve İŞKUR öder. Uzun vadeli sigorta
 *     (malullük, yaşlılık, ölüm) UYGULANMAZ: programda geçen günler
 *     emeklilik prim gününe sayılmaz.
 *
 * Takvim varsayımı: katılım günleri haftanın ilk iş günlerinden seçilir
 * (pazartesi, salı, çarşamba...), resmî tatiller ayrıca düşülmez. Gerçek
 * günleri yüklenici kurum belirler; aylık tutar ±1 gün oynayabilir.
 *
 * Net asgari ücret bordro/parametreler.js'ten (motor.donem) okunur.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/iskur-genclik-programi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../bordro/motor.js"));
  else kok.IskurGuc = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  var SURUM = "1.0.0";
  var GUNLUK = { 2026: 1375 };          // TL, İŞKUR Yönetim Kurulu
  var AZAMI_FIILI_GUN = 140;            // İUP Yönetmeliği kapsamındaki programlar toplamı
  var AZAMI_AY = 10;
  var GUNLUK_SAAT = 7.5;
  var PRIM_ORANI = 0.055;               // 5510 m.5/1-e, İŞKUR öder
  var PROGRAMLAR = {
    genclik: { ad: "İŞKUR Gençlik Programı", kimler: "Devlet üniversitelerinin örgün öğrencileri", haneKat: 3, ilkHafta: 0, ilkGun: 3, sonraGun: 3 },
    iup: { ad: "İşgücü Uyum Programı (NEET gençler dahil)", kimler: "İşsizler; NEET programında eğitimde ve istihdamda olmayan gençler", haneKat: 2, ilkHafta: 4, ilkGun: 5, sonraGun: 3 }
  };

  function parca(iso) { return [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)]; }
  function tarihGecerli(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = parca(s), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  }
  function gun(iso, n) { var p = parca(iso); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
  function haftaGunu(iso) { var p = parca(iso); return (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7; } // 0 = pazartesi
  function ayEkle(iso, n) {
    var p = parca(iso), y = p[0], m = p[1] - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var son = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + "-" + (m < 9 ? "0" : "") + (m + 1) + "-" + (Math.min(p[2], son) < 10 ? "0" : "") + Math.min(p[2], son);
  }

  function gunluk(yil) { return GUNLUK[yil] || null; }
  function netAsgari(yil, ay) {
    try { return B.donem(B.parametre(yil), ay || 1).asgariNet; } catch (e) { return null; }
  }
  function haneSiniri(program, yil, ay) {
    var n = netAsgari(yil, ay);
    return n === null ? null : n * PROGRAMLAR[program].haneKat;
  }

  /* ---------------------------------------------------------------- *
   * takvim(g)
   *   g.program     "genclik" | "iup"
   *   g.baslangic   programın başladığı gün
   *   g.haftalikGun Gençlik'te 1–3; İUP'de ilk dört hafta 5, sonra 3
   *                 (İUP'de verilmezse kurala uyulur)
   *   g.oncekiGun   daha önce İUP programlarında geçen fiili gün (140'tan düşülür)
   * Dönüş: ay ay gün ve tutar, toplam, sınırın dolduğu gün.
   * ---------------------------------------------------------------- */
  function takvim(g) {
    var P = PROGRAMLAR[g.program];
    if (!P) throw new Error("Programı seçin.");
    if (!tarihGecerli(g.baslangic)) throw new Error("Başlangıç tarihini girin.");
    var yil = +g.baslangic.slice(0, 4);
    var tutar = gunluk(yil);
    if (tutar === null) throw new Error(yil + " yılının günlük tutarı açıklanmadı.");
    var hafta = g.program === "genclik" ? Math.round(+g.haftalikGun || 3) : null;
    if (hafta !== null && (hafta < 1 || hafta > 3)) throw new Error("Gençlik Programı'nda haftada 1 ile 3 gün katılınabilir.");
    var once = Math.max(0, Math.round(+g.oncekiGun || 0));
    if (once >= AZAMI_FIILI_GUN) throw new Error("Daha önce 140 fiili günü doldurmuş biri yeni bir İşgücü Uyum Programı'ndan yararlanamaz.");
    var hak = AZAMI_FIILI_GUN - once;
    var bitis = gun(ayEkle(g.baslangic, AZAMI_AY), -1);   // 10 ay
    var aylar = {}, sira = [], toplamGun = 0, toplamTutar = 0, sonGun = null, sinir = null, varsayim = false;
    /* Haftalar başlangıç gününden sayılır; o haftanın katılım günleri
       haftanın ilk iş günlerinden seçilir. */
    var haftaBas = gun(g.baslangic, -haftaGunu(g.baslangic));
    for (var h = 0; toplamGun < hak; h++) {
      var kac = hafta !== null ? hafta : (h < P.ilkHafta ? P.ilkGun : P.sonraGun);
      var sayilan = 0;
      for (var d = 0; d < 5 && sayilan < kac; d++) {
        var t = gun(haftaBas, h * 7 + d);
        if (t < g.baslangic) continue;
        if (t > bitis) break;
        sayilan++;
        toplamGun++;
        var k = t.slice(0, 7);
        /* O yılın tutarı açıklanmadıysa başlangıç yılınınki kullanılır ve işaretlenir. */
        var gt = gunluk(+t.slice(0, 4));
        if (gt === null) { gt = tutar; varsayim = true; }
        if (!aylar[k]) { aylar[k] = { ay: k, gun: 0, tutar: 0, varsayim: false }; sira.push(k); }
        aylar[k].gun++; aylar[k].tutar += gt; toplamTutar += gt;
        if (gunluk(+t.slice(0, 4)) === null) aylar[k].varsayim = true;
        sonGun = t;
        if (toplamGun >= hak) { sinir = t; break; }
      }
      if (gun(haftaBas, h * 7) > bitis) break;
    }
    var liste = sira.map(function (k) { return aylar[k]; });
    var enCok = liste.reduce(function (m, a) { return Math.max(m, a.tutar); }, 0);
    return {
      program: g.program, programAd: P.ad, gunluk: tutar, aylar: liste,
      toplamGun: toplamGun, toplam: toplamTutar, sonGun: sonGun, tutarVarsayimi: varsayim,
      sinirDoldu: sinir, kalanHak: hak - toplamGun, bitis: bitis, enYuksekAy: enCok,
      saatlik: tutar / GUNLUK_SAAT, primGunEmeklilik: 0
    };
  }

  /* Hane geliri: aynı adresteki herkesin aylık toplam kazancı. */
  function haneUygun(program, haneGeliri, yil, ay, toplu) {
    if (toplu) return { uygun: true, toplu: true, sinir: haneSiniri(program, yil, ay) };
    var s = haneSiniri(program, yil, ay);
    if (s === null) return { uygun: null, sinir: null };
    return { uygun: +haneGeliri <= s, sinir: s, fark: s - (+haneGeliri) };
  }

  /* Karşılaştırma: aylık en çok tutar ve saatlik, net asgari ücretle. */
  function asgariKarsilastirma(yil, ay) {
    var n = netAsgari(yil, ay), t = gunluk(yil);
    var aylikUst = t * 14;   // haftada 3 gün, ayda en çok 14 katılım günü (İŞKUR'un 19.250 TL'si)
    return {
      netAsgari: n, aylikUst: aylikUst, oran: aylikUst / n,
      saatlik: t / GUNLUK_SAAT, asgariSaatlik: n / (30 * GUNLUK_SAAT)
    };
  }

  return {
    surum: SURUM, GUNLUK: GUNLUK, AZAMI_FIILI_GUN: AZAMI_FIILI_GUN, AZAMI_AY: AZAMI_AY,
    GUNLUK_SAAT: GUNLUK_SAAT, PRIM_ORANI: PRIM_ORANI, PROGRAMLAR: PROGRAMLAR,
    gunluk: gunluk, netAsgari: netAsgari, haneSiniri: haneSiniri, takvim: takvim,
    haneUygun: haneUygun, asgariKarsilastirma: asgariKarsilastirma, ayEkle: ayEkle
  };
});
