/*!
 * SGK idari para cezaları (5510 s.K. m.102). TEK DOĞRULUK KAYNAĞI.
 *
 * KURAL (mevzuat.gov.tr güncel metni ve SGK 2020/8 sayılı İdari Para
 * Cezası Genelgesi; 22 Ekim 2026'da okundu)
 *
 *   Bütün tutarlar "aylık brüt asgari ücret"in katı ya da kesridir ve
 *   FİİLİN İŞLENDİĞİ TARİHTE geçerli asgari ücret esas alınır (Genelge
 *   2.x örnekleri). Asgari ücret bordro/parametreler.js'ten okunur; burada
 *   kopyası tutulmaz.
 *
 *   m.102/1-a  işe giriş bildirgesi: sigortalı başına 1 asgari ücret;
 *              Kurumca/denetimle tespit edilirse 2; tespitten sonraki bir
 *              yıl içinde yeniden tespit edilirse 5. Üst sınır yok.
 *   m.102/1-b  işyeri bildirgesi: bilanço esasında (ve kamu idaresinde) 3,
 *              diğer defterlerde 2, defter tutmayanda 1 asgari ücret.
 *   m.102/1-j  işten ayrılış bildirgesi: sigortalı başına 1/10; bir takvim
 *              ayındaki toplamı, defter ibraz etmeme cezasını (1-e: 12/6/3)
 *              aşamaz.
 *   m.102/1-m  muhtasar ve prim hizmet beyannamesi (işyeri ve dönem başına):
 *              asıl 1/5, ek 1/8, eksik gün belgesi verilmediği için Kurumca
 *              istenen ek 1/2 (sigortalı başına; üst sınır 2 asgari ücret).
 *              Denetimle tespit (1-m-4): bilanço sigortalı başına 1 (en çok
 *              3), diğer 1/2 (en çok 2), defter tutmayan 1/3 (en çok 1).
 *   m.102/1-e  defter ve belgeleri ibraz etmeme: 12 / 6 / 3.
 *   m.102/1-d  eksik işçilik: mal edildiği her ay için 2.
 *
 *   İKİ İNDİRİM, ikisi de ödemeye bağlı:
 *   (1) m.102/2 — bildirge süresi geçtikten sonra 30 gün içinde
 *       KENDİLİĞİNDEN verilirse ve ceza tebliğden sonraki 15 gün içinde
 *       ödenirse ceza dörtte bir tutar üzerinden uygulanır. Yalnız (a), (b),
 *       (g), (h), (j) bentleri; muhtasar ve prim hizmet beyannamesi (m)
 *       bu indirime girmez.
 *   (2) m.102/5 — tebliğden itibaren 15 gün içinde, itiraz ya da dava
 *       açmadan peşin ödenirse dörtte üçü tahsil edilir. Her bentte.
 *   İkisi birlikte gerçekleşirse tebliğ edilen tutarın 1/4'ünün 3/4'ü
 *   tahsil edilir (Genelge: 1.777 × 1/4 × 3/4 = 333,19 → 333 TL).
 *
 *   Kuruş atılır: tebliğ edilen ceza ve tahsil edilen tutar tam liraya
 *   aşağı yuvarlanır (Genelge örnekleri: 88,65 → 88; 1.058,06 → 1.058).
 *
 *   SGK 2026/9 sayılı Genelge (9 Nisan 2026): prim günü ve kazancı sıfır
 *   olan geç beyannamelere ceza uygulanmaması istisnası 2026/Nisan
 *   döneminden itibaren kaldırıldı.
 *
 * Kapsam dışı: (c) bendi (2019 öncesi aylık prim ve hizmet belgesi), (g),
 * (h), (i), (k), (l), (n) bentleri, aynı dönemde birden çok ek beyanname
 * verildiğinde üst sınırın paylaştırılması, gecikme cezası ve gecikme zammı.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/sgk-idari-para-cezasi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../bordro/motor.js"));
  else kok.SgkCeza = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  var SURUM = "1.0.0";
  var DEFTER = {
    bilanco: { ad: "Bilanço esası (ya da kamu idaresi)", isyeri: 3, ibraz: 12, tespitKat: 1, tespitTavan: 3 },
    diger: { ad: "İşletme hesabı / serbest meslek kazanç defteri", isyeri: 2, ibraz: 6, tespitKat: 1 / 2, tespitTavan: 2 },
    yok: { ad: "Defter tutmakla yükümlü değil", isyeri: 1, ibraz: 3, tespitKat: 1 / 3, tespitTavan: 1 }
  };

  /* Her fiil: hangi bent, hangi girdileri ister, kendiliğinden indirime
     girer mi. ceyrek: m.102/2'deki dörtte bir indirimine giren bent. */
  var FIILLER = {
    iseGiris: { ad: "İşe giriş bildirgesi geç verildi ya da verilmedi", bent: "m.102/1-a", sigortali: true, ceyrek: true, tespitli: true },
    istenCikis: { ad: "İşten ayrılış bildirgesi geç verildi", bent: "m.102/1-j", sigortali: true, defter: true, ceyrek: true },
    isyeri: { ad: "İşyeri bildirgesi geç verildi", bent: "m.102/1-b", defter: true, ceyrek: true },
    mphbAsil: { ad: "Muhtasar ve prim hizmet beyannamesi (asıl) geç verildi", bent: "m.102/1-m-1", sigortali: true },
    mphbEk: { ad: "Ek muhtasar ve prim hizmet beyannamesi verildi", bent: "m.102/1-m-2", sigortali: true },
    mphbResen: { ad: "Eksik gün belgesi için istenen ek beyanname bir ayda verilmedi", bent: "m.102/1-m-3", sigortali: true },
    mphbTespit: { ad: "Denetimde bildirilmemiş sigortalı tespit edildi", bent: "m.102/1-m-4", sigortali: true, defter: true },
    defterIbraz: { ad: "Defter ve belgeler istenen sürede ibraz edilmedi", bent: "m.102/1-e", defter: true },
    eksikIscilik: { ad: "Eksik işçilik tespit edildi", bent: "m.102/1-d", aySayisi: true }
  };
  /* İşe giriş bildirgesinde tespitin üç kademesi (m.102/1-a-1, 2, 3). */
  var ISE_GIRIS = {
    gec: { ad: "Geç verildi (kendiliğinden)", kat: 1, bent: "m.102/1-a-1" },
    tespit: { ad: "Denetimde ya da başka bir kurumun bilgisiyle tespit edildi", kat: 2, bent: "m.102/1-a-2" },
    tekrar: { ad: "Bir yıl içinde ikinci kez tespit edildi", kat: 5, bent: "m.102/1-a-3" }
  };

  function lira(n) { return Math.floor(n + 1e-6); }   // kuruş atılır

  /** Fiilin işlendiği ayda geçerli aylık brüt asgari ücret. */
  function asgari(yil, ay) {
    var P;
    try { P = B.parametre(yil); } catch (e) { return null; }
    return B.donem(P, ay).asgariBrut;
  }

  function tamSayi(v, ad, enAz) {
    var n = Number(v);
    if (!isFinite(n) || n !== Math.floor(n) || n < enAz) throw new Error(ad + " en az " + enAz + " olan bir tam sayı olmalı.");
    return n;
  }

  /* Tebliğ edilecek ceza ve dayanağı. Tavanı aşan durumda tavanUygulandi. */
  function teblig(g, au) {
    var f = FIILLER[g.fiil], d = DEFTER[g.defter], n = g.sigortali, ham, tavan = null, bent = f.bent, aciklama;
    switch (g.fiil) {
      case "iseGiris":
        var k = ISE_GIRIS[g.iseGiris || "gec"];
        if (!k) throw new Error("İşe giriş durumu tanınmadı.");
        bent = k.bent; ham = n * k.kat * au;
        aciklama = n + " sigortalı × " + (k.kat === 1 ? "" : k.kat + " × ") + "asgari ücret";
        break;
      case "istenCikis":
        ham = n * au / 10; tavan = d.ibraz * au;
        aciklama = n + " sigortalı × asgari ücretin 1/10'u; bir takvim ayındaki toplamı en çok " + d.ibraz + " asgari ücret";
        break;
      case "isyeri":
        ham = d.isyeri * au;
        aciklama = d.isyeri + " asgari ücret";
        break;
      case "mphbAsil": ham = n * au / 5; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin 1/5'i; en çok 2 asgari ücret"; break;
      case "mphbEk": ham = n * au / 8; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin 1/8'i; en çok 2 asgari ücret"; break;
      case "mphbResen": ham = n * au / 2; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin yarısı; en çok 2 asgari ücret"; break;
      case "mphbTespit":
        ham = n * d.tespitKat * au; tavan = d.tespitTavan * au;
        aciklama = n + " sigortalı × " + (d.tespitKat === 1 ? "asgari ücret" : "asgari ücretin " + (d.tespitKat === 0.5 ? "yarısı" : "üçte biri")) + "; en çok " + d.tespitTavan + " asgari ücret";
        break;
      case "defterIbraz": ham = d.ibraz * au; aciklama = d.ibraz + " asgari ücret"; break;
      case "eksikIscilik": ham = g.aySayisi * 2 * au; aciklama = g.aySayisi + " ay × 2 asgari ücret"; break;
    }
    var uygulanan = tavan !== null ? Math.min(ham, tavan) : ham;
    return { tutar: lira(uygulanan), ham: ham, tavan: tavan, tavanUygulandi: tavan !== null && ham > tavan, bent: bent, aciklama: aciklama };
  }

  /**
   * g: { fiil, yil, ay, sigortali?, defter?, aySayisi?, iseGiris?: "gec"|"tespit"|"tekrar",
   *      kendiliginden30?: bool  — süre bitiminden sonra 30 gün içinde, Kurum tespit etmeden verildi }
   */
  function hesapla(g) {
    var f = FIILLER[g && g.fiil];
    if (!f) throw new Error("Fiil tanınmadı.");
    var yil = tamSayi(g.yil, "Yıl", 2000), ay = tamSayi(g.ay, "Ay", 1);
    if (ay > 12) throw new Error("Ay 1 ile 12 arasında olmalı.");
    /* asgariUcret verilirse o kullanılır: parametrelerden önceki yıllar ve
       Genelge örneklerinin testi için. */
    var au = g.asgariUcret > 0 ? +g.asgariUcret : asgari(yil, ay);
    if (au === null) throw new Error(yil + " yılının asgari ücreti bordro parametrelerinde yok" + (yil > 2026 ? "; açıklandığında eklenecek." : "."));
    var girdi = { fiil: g.fiil, iseGiris: g.iseGiris || "gec", defter: g.defter || "bilanco" };
    if (f.defter && !DEFTER[girdi.defter]) throw new Error("Defter türü tanınmadı.");
    girdi.sigortali = f.sigortali ? tamSayi(g.sigortali, "Sigortalı sayısı", 1) : 0;
    girdi.aySayisi = f.aySayisi ? tamSayi(g.aySayisi, "Ay sayısı", 1) : 0;

    var t = teblig(girdi, au);
    var tespit = g.fiil === "iseGiris" && girdi.iseGiris !== "gec";
    var ceyrekUygun = !!f.ceyrek && !tespit;
    var ceyrek = ceyrekUygun && !!g.kendiliginden30;
    var carpan = ceyrek ? 3 / 16 : 3 / 4;
    var pesin = lira(t.tutar * carpan);
    return {
      surum: SURUM, fiil: g.fiil, ad: f.ad, bent: t.bent, yil: yil, ay: ay, asgari: au,
      aciklama: t.aciklama, tavan: t.tavan === null ? null : lira(t.tavan), tavanUygulandi: t.tavanUygulandi,
      teblig: t.tutar,
      ceyrekUygun: ceyrekUygun, ceyrek: ceyrek,
      pesin: pesin,                  // tebliğden sonraki 15 gün içinde ödenirse
      indirim: t.tutar - pesin,
      oran: t.tutar ? pesin / t.tutar : 0,
      sifirBildirge: yil > 2026 || (yil === 2026 && ay >= 4)   // 2026/9 Genelge
    };
  }

  /**
   * Aynı fiilin bütün yolları, en ucuzdan pahalıya: ne zaman fark edildi,
   * kim fark etti, ne zaman ödendi. Yazının ve aracın karşılaştırma tablosu.
   */
  function yollar(g) {
    var f = FIILLER[g.fiil], out = [];
    function ekle(ad, durum, h, odeme) { out.push({ ad: ad, durum: durum, tutar: odeme === "pesin" ? h.pesin : h.teblig, odeme: odeme, h: h }); }
    var temel = Object.assign({}, g);
    if (f.ceyrek) {
      var k30 = hesapla(Object.assign({}, temel, { iseGiris: "gec", kendiliginden30: true }));
      ekle("30 gün içinde kendiliğinden verildi, 15 günde ödendi", "k30", k30, "pesin");
      var k = hesapla(Object.assign({}, temel, { iseGiris: "gec", kendiliginden30: false }));
      ekle("30 günden sonra verildi, 15 günde ödendi", "k", k, "pesin");
      ekle("Geç verildi, ceza 15 günde ödenmedi", "kGec", k, "gec");
    } else {
      var h = hesapla(Object.assign({}, temel, { kendiliginden30: false }));
      ekle("15 gün içinde ödendi", "pesin", h, "pesin");
      ekle("15 günde ödenmedi", "gec", h, "gec");
    }
    if (f.tespitli) {
      var t2 = hesapla(Object.assign({}, temel, { iseGiris: "tespit" }));
      ekle("Denetimde tespit edildi, 15 günde ödendi", "tespit", t2, "pesin");
      var t5 = hesapla(Object.assign({}, temel, { iseGiris: "tekrar" }));
      ekle("Bir yıl içinde yeniden tespit edildi, 15 günde ödendi", "tekrar", t5, "pesin");
    }
    return out.sort(function (a, b) { return a.tutar - b.tutar; });
  }

  return {
    SURUM: SURUM, DEFTER: DEFTER, FIILLER: FIILLER, ISE_GIRIS: ISE_GIRIS,
    asgari: asgari, hesapla: hesapla, yollar: yollar
  };
});
