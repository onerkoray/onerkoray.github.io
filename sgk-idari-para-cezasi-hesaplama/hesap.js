/*!
 * SGK idari para cezaları (5510 s.K. m.102). TEK DOĞRULUK KAYNAĞI.
 *
 * KURAL (mevzuat.gov.tr güncel metni ve SGK 2020/8 sayılı İdari Para
 * Cezası Genelgesi; 22 Ekim 2026'da okundu)
 *
 *   Bütün tutarlar "aylık brüt asgari ücret"in katı ya da kesridir ve
 *   FİİLİN İŞLENDİĞİ TARİHTE geçerli asgari ücret esas alınır. Fiil,
 *   yükümlülüğün yasal süresinin son günü işlenmiş sayılır (Genelge 5.1).
 *   2020 ve sonrası asgari ücret bordro/parametreler.js'ten okunur; 2016–
 *   2019, on yıllık zamanaşımı içinde kaldığı için aşağıda ayrıca tutulur
 *   (ESKI_ASGARI; dördü de Genelge örneklerinde geçen tutarlar).
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
 *              3), diğer 1/2 (en çok 2), defter tutmayan 1/3 (en çok 1);
 *              yalnız kazanç eksikse (1-m-4-ç) eksik kazanç tutarı kadar,
 *              en az 1/10, en çok 2 asgari ücret.
 *   m.102/1-n  meslek adı ve kodu gerçeğe aykırı: sigortalı başına 1/10,
 *              işyeri ve dönem başına en çok 1 asgari ücret.
 *   m.102/1-i  Kurumca istenen bilgi ve belge: hiç verilmezse 5, geç
 *              verilirse 2 asgari ücret. İş göremezlik ödemesinde
 *              çalışılmadığına dair bildirim: geç 1/10, hiç 1/2 (sigortalı
 *              başına).
 *   m.102/1-e  defter ve belgeleri ibraz etmeme: 12 / 6 / 3. Defter kaydı
 *              geçersiz ay başına 1/2 (e-4), geçersiz ücret tediye
 *              bordrosu başına 1/2 (e-5); ikisi de ibraz cezasını aşamaz.
 *   m.102/1-d  eksik işçilik: mal edildiği her ay için 2.
 *
 *   AYNI DÖNEMİN ÖNCEKİ CEZASI (Genelge 2.6.2.2, 2.20): üst sınırlı bir
 *   cezada aynı işyerine aynı dönem için daha önce ceza kesildiyse yeni
 *   ceza, üst sınırın kalanı kadardır: 3.555 − 1.777 = 1.778 TL.
 *
 *   İKİ İNDİRİM, ikisi de ödemeye bağlı:
 *   (1) m.102/2 — bildirge süresi geçtikten sonra 30 gün içinde
 *       KENDİLİĞİNDEN verilirse ve ceza tebliğden sonraki 15 gün içinde
 *       ödenirse ceza dörtte bir tutar üzerinden uygulanır. Yalnız (a), (b),
 *       (g), (h), (j) bentleri.
 *   (2) m.102/5 — tebliğden itibaren 15 gün içinde, itiraz ya da dava
 *       açmadan peşin ödenirse dörtte üçü tahsil edilir. Her bentte.
 *   İkisi birlikte: tebliğin 1/4'ünün 3/4'ü (1.777 × 1/4 × 3/4 = 333).
 *
 *   MUAFİYET (m.102/2, 7144 s.K. ile; Genelge 3.3): sigortalılar ve günler
 *   eksiksiz bildirilmiş, eksiklik yalnız kazançta, eksik tutar fiil
 *   tarihindeki asgari ücretin üçte birini ve o ay bildirilen toplam
 *   kazancın %1'ini aşmıyorsa ve 15 gün içinde düzeltilirse ceza yok.
 *
 *   Kuruş atılır: tebliğ edilen ceza ve tahsil edilen tutar tam liraya
 *   aşağı yuvarlanır (Genelge örnekleri: 88,65 → 88; 1.058,06 → 1.058).
 *
 *   SÜRELER (Genelge 5.1, 6, 10): son gün hafta sonu ya da resmî tatilse
 *   ilk iş günü; 1–20 Temmuz mali tatile düşen son gün 27 Temmuz'a, 21–25
 *   Temmuz'a düşen 25 Temmuz'a uzar (5604 s.K.). 15 gün tebliği izleyen
 *   günden sayılır. Ceza, fiilden itibaren 10 yıl içinde tebliğ edilmezse
 *   zamanaşımına uğrar (23/11/2017 → 22/11/2027).
 *   Dinî bayramlar Diyanet'in dinî günler takviminden (2024–2026); 2027
 *   takvimi yayımlanmadığı için yok, araç bunu söyler.
 *
 *   SGK 2026/9 sayılı Genelge (9 Nisan 2026): prim günü ve kazancı sıfır
 *   olan geç beyannamelere ceza uygulanmaması istisnası 2026/Nisan
 *   döneminden itibaren kaldırıldı.
 *
 * Kapsam dışı: (c) bendi (2019 öncesi aylık prim ve hizmet belgesi), (f),
 * (g), (h), (k), (l) bentleri, 6331 s.K. iş kazası bildirimi, gecikme
 * cezası ve gecikme zammı (m.89: aylık iç borçlanma faizine bağlı).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/sgk-idari-para-cezasi-hesaplama/
 */
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(require("../bordro/motor.js"));
  else kok.SgkCeza = fabrika(kok.Bordro);
})(typeof globalThis !== "undefined" ? globalThis : this, function (B) {
  "use strict";

  var SURUM = "2.0.0";
  /* 2016–2019 aylık brüt asgari ücret (yıl içinde değişmedi). Genelge
     örnekleri: 1.647,00 (2016/Aralık), 1.777,50, 2.029,50, 2.558,40. */
  var ESKI_ASGARI = { 2016: 1647.00, 2017: 1777.50, 2018: 2029.50, 2019: 2558.40 };
  var ZAMANASIMI_YIL = 10;

  var DEFTER = {
    bilanco: { ad: "Bilanço esası (ya da kamu idaresi)", isyeri: 3, ibraz: 12, tespitKat: 1, tespitTavan: 3 },
    diger: { ad: "İşletme hesabı / serbest meslek kazanç defteri", isyeri: 2, ibraz: 6, tespitKat: 1 / 2, tespitTavan: 2 },
    yok: { ad: "Defter tutmakla yükümlü değil", isyeri: 1, ibraz: 3, tespitKat: 1 / 3, tespitTavan: 1 }
  };

  /* Her fiil: hangi bent, hangi girdileri ister, hangi indirime girer.
     ceyrek: m.102/2 dörtte bir; onceki: aynı dönemin önceki cezası düşülür;
     muafiyet: 7144 kazanç eksikliği muafiyeti sorulabilir. */
  var FIILLER = {
    iseGiris: { ad: "İşe giriş bildirgesi geç verildi ya da verilmedi", bent: "m.102/1-a", grup: "Bildirgeler", sigortali: true, ceyrek: true, tespitli: true },
    istenCikis: { ad: "İşten ayrılış bildirgesi geç verildi", bent: "m.102/1-j", grup: "Bildirgeler", sigortali: true, defter: true, ceyrek: true, onceki: true },
    isyeri: { ad: "İşyeri bildirgesi geç verildi", bent: "m.102/1-b", grup: "Bildirgeler", defter: true, ceyrek: true },
    gio: { ad: "Rapor döneminde çalışılmadığına dair bildirim yapılmadı", bent: "m.102/1-i", grup: "Bildirgeler", sigortali: true, verilme: true },
    mphbAsil: { ad: "Muhtasar ve prim hizmet beyannamesi (asıl) geç verildi", bent: "m.102/1-m-1", grup: "Beyanname", sigortali: true },
    mphbEk: { ad: "Ek muhtasar ve prim hizmet beyannamesi verildi", bent: "m.102/1-m-2", grup: "Beyanname", sigortali: true, onceki: true, muafiyet: true },
    mphbResen: { ad: "Eksik gün belgesi için istenen ek beyanname bir ayda verilmedi", bent: "m.102/1-m-3", grup: "Beyanname", sigortali: true, onceki: true },
    meslekKodu: { ad: "Meslek adı ve kodu gerçeğe aykırı bildirildi", bent: "m.102/1-n", grup: "Beyanname", sigortali: true, onceki: true },
    mphbTespit: { ad: "Denetimde bildirilmemiş sigortalı tespit edildi", bent: "m.102/1-m-4", grup: "Denetim", sigortali: true, defter: true, onceki: true },
    pekTespit: { ad: "Denetimde yalnız kazancın eksik bildirildiği tespit edildi", bent: "m.102/1-m-4-ç", grup: "Denetim", pek: true },
    kayitDisi: { ad: "Kayıt dışı işçi tespit edildi (işe giriş + ay ay beyanname)", bent: "m.102/1-a-2 ve 1-m-4", grup: "Denetim", sigortali: true, defter: true, aySayisi: true, birlesik: true },
    defterIbraz: { ad: "Defter ve belgeler istenen sürede ibraz edilmedi", bent: "m.102/1-e", grup: "Denetim", defter: true },
    kayitGecersiz: { ad: "Defter kaydı ya da ücret bordrosu geçersiz sayıldı", bent: "m.102/1-e-4 ve 1-e-5", grup: "Denetim", defter: true, gecersiz: true },
    bilgiBelge: { ad: "Kurumun istediği bilgi ve belge verilmedi", bent: "m.102/1-i", grup: "Denetim", verilme: true },
    eksikIscilik: { ad: "Eksik işçilik tespit edildi", bent: "m.102/1-d", grup: "Denetim", aySayisi: true }
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
    if (ESKI_ASGARI[yil]) return ESKI_ASGARI[yil];
    var P;
    try { P = B.parametre(yil); } catch (e) { return null; }
    return B.donem(P, ay).asgariBrut;
  }

  function tamSayi(v, ad, enAz) {
    var n = Number(v);
    if (!isFinite(n) || n !== Math.floor(n) || n < enAz) throw new Error(ad + " en az " + enAz + " olan bir tam sayı olmalı.");
    return n;
  }
  function tutar(v, ad) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) throw new Error(ad + " sıfır ya da pozitif bir tutar olmalı.");
    return n;
  }

  /* Tebliğ edilecek ceza ve dayanağı. */
  function teblig(g, au) {
    var f = FIILLER[g.fiil], d = DEFTER[g.defter], n = g.sigortali, ham, tavan = null, bent = f.bent, aciklama, alt = null;
    switch (g.fiil) {
      case "iseGiris":
        var k = ISE_GIRIS[g.iseGiris];
        if (!k) throw new Error("İşe giriş durumu tanınmadı.");
        bent = k.bent; ham = n * k.kat * au;
        aciklama = n + " sigortalı × " + (k.kat === 1 ? "" : k.kat + " × ") + "asgari ücret";
        break;
      case "istenCikis":
        ham = n * au / 10; tavan = d.ibraz * au;
        aciklama = n + " sigortalı × asgari ücretin 1/10'u; bir takvim ayında en çok " + d.ibraz + " asgari ücret";
        break;
      case "isyeri": ham = d.isyeri * au; aciklama = d.isyeri + " asgari ücret"; break;
      case "gio":
        ham = n * au / (g.verilme === "hic" ? 2 : 10);
        aciklama = n + " sigortalı × asgari ücretin " + (g.verilme === "hic" ? "yarısı (hiç yapılmadı)" : "1/10'u (geç yapıldı)");
        break;
      case "mphbAsil": ham = n * au / 5; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin 1/5'i; en çok 2 asgari ücret"; break;
      case "mphbEk": ham = n * au / 8; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin 1/8'i; en çok 2 asgari ücret"; break;
      case "mphbResen": ham = n * au / 2; tavan = 2 * au; aciklama = n + " sigortalı × asgari ücretin yarısı; en çok 2 asgari ücret"; break;
      case "meslekKodu": ham = n * au / 10; tavan = au; aciklama = n + " sigortalı × asgari ücretin 1/10'u; en çok 1 asgari ücret"; break;
      case "mphbTespit":
        ham = n * d.tespitKat * au; tavan = d.tespitTavan * au;
        aciklama = n + " sigortalı × " + (d.tespitKat === 1 ? "asgari ücret" : "asgari ücretin " + (d.tespitKat === 0.5 ? "yarısı" : "üçte biri")) + "; en çok " + d.tespitTavan + " asgari ücret";
        break;
      case "pekTespit":
        ham = Math.min(Math.max(g.eksikPek, au / 10), 2 * au);
        aciklama = "eksik kazanç tutarı; en az asgari ücretin 1/10'u, en çok 2 asgari ücret";
        break;
      case "defterIbraz": ham = d.ibraz * au; aciklama = d.ibraz + " asgari ücret"; break;
      case "kayitGecersiz":
        ham = (g.gecersizAy + g.gecersizBordro) * au / 2; tavan = d.ibraz * au;
        aciklama = (g.gecersizAy ? g.gecersizAy + " geçersiz ay" : "") + (g.gecersizAy && g.gecersizBordro ? " + " : "") +
          (g.gecersizBordro ? g.gecersizBordro + " geçersiz bordro" : "") + " × asgari ücretin yarısı; en çok " + d.ibraz + " asgari ücret";
        break;
      case "bilgiBelge":
        ham = (g.verilme === "hic" ? 5 : 2) * au;
        aciklama = (g.verilme === "hic" ? "hiç verilmedi: 5" : "geç verildi: 2") + " asgari ücret";
        break;
      case "eksikIscilik": ham = g.aySayisi * 2 * au; aciklama = g.aySayisi + " ay × 2 asgari ücret"; break;
    }
    var kalan = null, tutarT;
    if (tavan !== null) {
      kalan = Math.max(0, lira(tavan - (g.onceki || 0)));
      tutarT = Math.min(lira(ham), kalan);
    } else tutarT = lira(ham);
    return { tutar: tutarT, ham: ham, tavan: tavan, kalan: kalan, tavanUygulandi: tavan !== null && lira(ham) > kalan, bent: bent, aciklama: aciklama };
  }

  /* 7144 muafiyeti: yalnız kazanç eksik, eksik ≤ AÜ/3 ve ≤ bildirilen toplamın %1'i. */
  function muafiyet(eksikPek, toplamPek, au) {
    if (!(eksikPek > 0) || !(toplamPek > 0)) return null;
    var ucteBir = au / 3, yuzdeBir = toplamPek / 100;
    return { uygun: eksikPek <= ucteBir + 1e-9 && eksikPek <= yuzdeBir + 1e-9, ucteBir: ucteBir, yuzdeBir: yuzdeBir };
  }

  function girdiOku(g) {
    var f = FIILLER[g && g.fiil];
    if (!f) throw new Error("Fiil tanınmadı.");
    var yil = tamSayi(g.yil, "Yıl", 2000), ay = tamSayi(g.ay, "Ay", 1);
    if (ay > 12) throw new Error("Ay 1 ile 12 arasında olmalı.");
    var o = { fiil: g.fiil, yil: yil, ay: ay, iseGiris: g.iseGiris || "gec", defter: g.defter || "bilanco", verilme: g.verilme === "hic" ? "hic" : "gec" };
    if (f.defter && !DEFTER[o.defter]) throw new Error("Defter türü tanınmadı.");
    o.sigortali = f.sigortali ? tamSayi(g.sigortali, "Sigortalı sayısı", 1) : 0;
    o.aySayisi = f.aySayisi ? tamSayi(g.aySayisi, "Ay sayısı", 1) : 0;
    o.onceki = f.onceki && g.onceki ? tutar(g.onceki, "Önceki ceza") : 0;
    if (f.gecersiz) {
      o.gecersizAy = g.gecersizAy ? tamSayi(g.gecersizAy, "Geçersiz ay", 0) : 0;
      o.gecersizBordro = g.gecersizBordro ? tamSayi(g.gecersizBordro, "Geçersiz bordro", 0) : 0;
      if (!o.gecersizAy && !o.gecersizBordro) throw new Error("Geçersiz ay ya da bordro sayısından en az biri girilmeli.");
    }
    if (f.pek || (f.muafiyet && g.yalnizKazanc)) {
      o.eksikPek = tutar(g.eksikPek, "Eksik kazanç");
      o.toplamPek = g.toplamPek ? tutar(g.toplamPek, "Bildirilen toplam kazanç") : 0;
      if (f.pek && !(o.eksikPek > 0)) throw new Error("Eksik bildirilen kazanç tutarı girilmeli.");
      o.yalnizKazanc = true;
    }
    return o;
  }

  function sonuc(o, au, t) {
    var f = FIILLER[o.fiil];
    var tespit = o.fiil === "iseGiris" && o.iseGiris !== "gec";
    var ceyrekUygun = !!f.ceyrek && !tespit;
    var ceyrek = ceyrekUygun && !!o.kendiliginden30;
    var pesin = lira(t.tutar * (ceyrek ? 3 / 16 : 3 / 4));
    var m = o.yalnizKazanc ? muafiyet(o.eksikPek, o.toplamPek, au) : null;
    return {
      surum: SURUM, fiil: o.fiil, ad: f.ad, bent: t.bent, yil: o.yil, ay: o.ay, asgari: au,
      aciklama: t.aciklama, tavan: t.tavan === null ? null : lira(t.tavan), kalan: t.kalan, onceki: o.onceki || 0,
      tavanUygulandi: t.tavanUygulandi,
      teblig: t.tutar,
      ceyrekUygun: ceyrekUygun, ceyrek: ceyrek,
      pesin: pesin,                  // tebliğden sonraki 15 gün içinde ödenirse
      indirim: t.tutar - pesin,
      oran: t.tutar ? pesin / t.tutar : 0,
      muafiyet: m,                   // null: sorulmadı; uygun: 15 günde düzeltilirse ceza yok
      kalemler: [{ ad: f.ad, bent: t.bent, yil: o.yil, ay: o.ay, asgari: au, aciklama: t.aciklama, teblig: t.tutar, pesin: pesin }],
      sifirBildirge: o.yil > 2026 || (o.yil === 2026 && o.ay >= 4)   // 2026/9 Genelge
    };
  }

  function asgariVar(yil, ay, verilen) {
    var au = verilen > 0 ? +verilen : asgari(yil, ay);
    if (au === null) throw new Error(yil + " yılının asgari ücreti tabloda yok" + (yil > 2026 ? "; açıklandığında eklenecek." : "; 2016 öncesi fiiller on yıllık zamanaşımı dışında."));
    return au;
  }

  /* Kayıt dışı işçi: işe giriş (tespit, 2 kat) + her ay için denetim
     beyannamesi cezası (m-4). Beyanname ayın son günü değil, izleyen ayın
     26'sında verilir; fiil o gün işlenir ve o ayın asgari ücreti esas alınır. */
  function kayitDisi(o) {
    var d = DEFTER[o.defter], au0 = asgariVar(o.yil, o.ay);
    var giris = lira(o.sigortali * 2 * au0), kalem = [{
      ad: "İşe giriş bildirgesi, tespit (" + o.sigortali + " sigortalı × 2 asgari ücret)", bent: "m.102/1-a-2",
      yil: o.yil, ay: o.ay, asgari: au0, aciklama: o.sigortali + " sigortalı × 2 × asgari ücret", teblig: giris, pesin: lira(giris * 3 / 4) }];
    for (var i = 0; i < o.aySayisi; i++) {
      var y = o.yil + Math.floor((o.ay - 1 + i) / 12), m = (o.ay - 1 + i) % 12 + 1;
      var fy = m === 12 ? y + 1 : y, fm = m === 12 ? 1 : m + 1;
      if (asgari(fy, fm) === null && !ESKI_ASGARI[fy]) throw new Error(AY[m - 1] + " " + y + " döneminin beyannamesi " + AY[fm - 1] + " " + fy + "'de verilir; o ayın asgari ücreti henüz yok.");
      var au = asgariVar(fy, fm), t = lira(Math.min(o.sigortali * d.tespitKat * au, d.tespitTavan * au));
      kalem.push({ ad: "Beyanname, " + m + "/" + y + " dönemi", bent: "m.102/1-m-4", yil: fy, ay: fm, asgari: au,
        aciklama: o.sigortali + " sigortalı; en çok " + d.tespitTavan + " asgari ücret", teblig: t, pesin: lira(t * 3 / 4) });
    }
    var tb = 0, ps = 0;
    kalem.forEach(function (k) { tb += k.teblig; ps += k.pesin; });
    var f = FIILLER.kayitDisi;
    return {
      surum: SURUM, fiil: "kayitDisi", ad: f.ad, bent: f.bent, yil: o.yil, ay: o.ay, asgari: au0,
      aciklama: "işe giriş cezası + " + o.aySayisi + " aylık beyanname cezası", tavan: null, kalan: null, onceki: 0, tavanUygulandi: false,
      teblig: tb, ceyrekUygun: false, ceyrek: false, pesin: ps, indirim: tb - ps, oran: tb ? ps / tb : 0, muafiyet: null,
      kalemler: kalem, sifirBildirge: false
    };
  }

  /**
   * g: { fiil, yil, ay, sigortali?, defter?, aySayisi?, iseGiris?: "gec"|"tespit"|"tekrar",
   *      verilme?: "gec"|"hic", onceki?, gecersizAy?, gecersizBordro?, eksikPek?, toplamPek?,
   *      yalnizKazanc?, kendiliginden30?: bool, asgariUcret? (test ve eski yıllar için) }
   */
  function hesapla(g) {
    var o = girdiOku(g);
    o.kendiliginden30 = !!g.kendiliginden30;
    if (FIILLER[o.fiil].birlesik) return kayitDisi(o);
    var au = asgariVar(o.yil, o.ay, g.asgariUcret);
    return sonuc(o, au, teblig(o, au));
  }

  /**
   * Aynı fiilin bütün yolları, en ucuzdan pahalıya: ne zaman fark edildi,
   * kim fark etti, ne zaman ödendi. Yazının ve aracın karşılaştırma tablosu.
   */
  function yollar(g) {
    var f = FIILLER[g.fiil], out = [];
    function ekle(ad, durum, h, odeme) { out.push({ ad: ad, durum: durum, tutar: odeme === "pesin" ? h.pesin : (odeme === "muaf" ? 0 : h.teblig), odeme: odeme, h: h }); }
    var temel = Object.assign({}, g);
    if (f.ceyrek) {
      var k30 = hesapla(Object.assign({}, temel, { iseGiris: "gec", kendiliginden30: true }));
      ekle("30 gün içinde kendiliğinden verildi, 15 günde ödendi", "k30", k30, "pesin");
      var k = hesapla(Object.assign({}, temel, { iseGiris: "gec", kendiliginden30: false }));
      ekle("30 günden sonra verildi, 15 günde ödendi", "k", k, "pesin");
      ekle("Geç verildi, ceza 15 günde ödenmedi", "kGec", k, "gec");
    } else {
      var h = hesapla(Object.assign({}, temel, { kendiliginden30: false }));
      if (h.muafiyet && h.muafiyet.uygun) ekle("15 gün içinde düzeltildi (7144 muafiyeti)", "muaf", h, "muaf");
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

  /* ------------------------------------------------ süreler ve takvim */

  /* Diyanet dinî günler takvimi (vakithesaplama.diyanet.gov.tr, 22 Ekim
     2026'da okundu). Arife yarım gün olduğu için iş günü sayılır. */
  var BAYRAM = {
    2024: ["2024-04-10", "2024-04-11", "2024-04-12", "2024-06-16", "2024-06-17", "2024-06-18", "2024-06-19"],
    2025: ["2025-03-30", "2025-03-31", "2025-04-01", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09"],
    2026: ["2026-03-20", "2026-03-21", "2026-03-22", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"]
  };
  /* 2429 s.K.: sabit tarihli resmî tatiller (15 Temmuz 2017'den). 28 Ekim
     öğleden sonra yarım gün; iş günü sayılır. */
  var SABIT = ["01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29"];

  function tarihGecerli(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split("-").map(Number), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  }
  function d2s(t) { return t.toISOString().slice(0, 10); }
  function s2d(s) { var p = s.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function gunEkle(s, n) { var t = s2d(s); t.setUTCDate(t.getUTCDate() + n); return d2s(t); }
  function tatilMi(s) {
    var gun = s2d(s).getUTCDay(), y = +s.slice(0, 4);
    if (gun === 0 || gun === 6) return "hafta sonu";
    if (SABIT.indexOf(s.slice(5)) >= 0 && !(s.slice(5) === "07-15" && y < 2017)) return "resmî tatil";
    if ((BAYRAM[y] || []).indexOf(s) >= 0) return "dinî bayram";
    return null;
  }
  function isGunu(s) { var n = 0; while (tatilMi(s) && n++ < 15) s = gunEkle(s, 1); return s; }
  /* 5604 s.K. mali tatil: 1–20 Temmuz (30 Haziran tatilse Temmuz'un ilk iş
     gününü izleyen günden). Son günü tatile düşen süre 27 Temmuz'a; tatili
     izleyen beş güne (21–25) düşen 25 Temmuz'a uzar. */
  function maliTatil(s) {
    var y = s.slice(0, 4), bas = y + "-07-01";
    if (tatilMi(y + "-06-30")) bas = gunEkle(isGunu(y + "-07-01"), 1);
    if (s >= bas && s <= y + "-07-20") return y + "-07-27";
    if (s >= y + "-07-21" && s <= y + "-07-25") return y + "-07-25";
    return s;
  }
  /* Son gün: önce mali tatil, sonra hafta sonu ve resmî tatil. */
  function etkinSonGun(s) {
    var m = maliTatil(s), neden = [];
    if (m !== s) neden.push("mali tatil");
    var t = isGunu(m);
    if (t !== m) neden.push(tatilMi(m));
    return { tarih: t, neden: neden };
  }
  function bayramTablosu(s) { return !!BAYRAM[+s.slice(0, 4)]; }

  /**
   * t: { sonGun (yasal son gün), verilis?, teblig? } — ISO tarihler.
   * Fiil, yasal son günde işlenir: asgari ücret o günün, zamanaşımı o
   * günden. Hafta sonu, resmî tatil ve mali tatil yalnız VERME süresini
   * uzatır, fiil tarihini değiştirmez (Genelge 10).
   */
  function sureler(t) {
    if (!tarihGecerli(t.sonGun)) throw new Error("Yasal son günü seçin.");
    var e = etkinSonGun(t.sonGun);
    var r = {
      sonGun: t.sonGun, etkin: e.tarih, kaydirma: e.neden,
      fiilYil: +t.sonGun.slice(0, 4), fiilAy: +t.sonGun.slice(5, 7),
      otuzSon: gunEkle(e.tarih, 30),
      zamanasimi: gunEkle(String(+t.sonGun.slice(0, 4) + ZAMANASIMI_YIL) + t.sonGun.slice(4), -1),
      eksikTablo: []
    };
    if (!bayramTablosu(e.tarih)) r.eksikTablo.push(+e.tarih.slice(0, 4));
    if (t.verilis) {
      if (!tarihGecerli(t.verilis)) throw new Error("Veriliş tarihi geçersiz.");
      r.verilis = t.verilis;
      r.zamaninda = t.verilis <= e.tarih;
      r.gecGun = r.zamaninda ? 0 : Math.round((s2d(t.verilis) - s2d(e.tarih)) / 864e5);
      r.kendiliginden30 = !r.zamaninda && t.verilis <= r.otuzSon;
    }
    if (t.teblig) {
      if (!tarihGecerli(t.teblig)) throw new Error("Tebliğ tarihi geçersiz.");
      var p = etkinSonGun(gunEkle(t.teblig, 15));
      r.teblig = t.teblig; r.pesinSon = p.tarih; r.pesinKaydirma = p.neden;
      if (!bayramTablosu(p.tarih) && r.eksikTablo.indexOf(+p.tarih.slice(0, 4)) < 0) r.eksikTablo.push(+p.tarih.slice(0, 4));
      r.zamanasimiDoldu = t.teblig > r.zamanasimi;
    }
    return r;
  }

  /* ------------------------------------------------ döküm */
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tl(v) {
    var s = Math.round(v * 100) / 100, tam = Math.floor(s), k = Math.round((s - tam) * 100);
    return String(tam).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (k ? "," + (k < 10 ? "0" : "") + k : "") + " TL";
  }
  function trTarih(s) { return +s.slice(8) + " " + AY[+s.slice(5, 7) - 1] + " " + s.slice(0, 4); }

  /** Mali müşavirin dosyasına konacak düz metin döküm. */
  function dokum(h, s) {
    var L = ["SGK idari para cezası — " + h.ad, "Dayanak: 5510 s.K. " + h.bent];
    h.kalemler.forEach(function (k) {
      L.push("- " + k.ad + ": " + k.aciklama + " (asgari ücret " + tl(k.asgari) + ", " + AY[k.ay - 1] + " " + k.yil + ")");
      L.push("  Tebliğ " + tl(k.teblig) + " · 15 günde ödenirse " + tl(k.pesin));
    });
    if (h.kalemler.length > 1) L.push("Toplam tebliğ " + tl(h.teblig) + " · 15 günde ödenirse " + tl(h.pesin));
    if (h.onceki) L.push("Aynı dönem için önceki ceza " + tl(h.onceki) + " düşüldü; üst sınırın kalanı " + tl(h.kalan));
    if (h.tavanUygulandi) L.push("Üst sınır uygulandı: " + tl(h.tavan));
    if (h.ceyrek) L.push("30 gün içinde kendiliğinden verildi: dörtte bir indirimi (m.102/2) + peşin ödeme (m.102/5) = tebliğin %18,75'i");
    else if (h.ceyrekUygun) L.push("30 gün geçtiği için yalnız peşin ödeme indirimi (m.102/5)");
    if (h.muafiyet) L.push(h.muafiyet.uygun ? "7144 muafiyeti: eksiklik 15 gün içinde giderilirse ceza uygulanmaz" : "7144 muafiyeti uygulanmaz (eksik tutar asgari ücretin 1/3'ünü ya da bildirilen kazancın %1'ini aşıyor)");
    if (s) {
      L.push("Yasal son gün " + trTarih(s.sonGun) + (s.etkin !== s.sonGun ? " (" + s.kaydirma.join(", ") + " nedeniyle " + trTarih(s.etkin) + ")" : ""));
      if (s.verilis) L.push("Veriliş " + trTarih(s.verilis) + (s.zamaninda ? ": süresinde" : ": " + s.gecGun + " gün geç; 30 günlük süre " + trTarih(s.otuzSon) + " sonunda doluyor"));
      if (s.teblig) L.push("Tebliğ " + trTarih(s.teblig) + "; peşin ödeme ve itiraz için son gün " + trTarih(s.pesinSon));
      L.push("Zamanaşımı: ceza en geç " + trTarih(s.zamanasimi) + " tarihine kadar tebliğ edilmeli");
    }
    L.push("15 gün geçerse indirimler kaybolur; 5510 m.89'a göre gecikme cezası ve gecikme zammı eklenir.");
    L.push("Hesap: korayoner.dev/sgk-idari-para-cezasi-hesaplama/ (SGK 2020/8 Genelgesi örnekleriyle testli)");
    return L.join("\n");
  }

  return {
    SURUM: SURUM, DEFTER: DEFTER, FIILLER: FIILLER, ISE_GIRIS: ISE_GIRIS, ESKI_ASGARI: ESKI_ASGARI, BAYRAM: BAYRAM,
    asgari: asgari, hesapla: hesapla, yollar: yollar, muafiyet: muafiyet,
    sureler: sureler, etkinSonGun: etkinSonGun, tatilMi: tatilMi, dokum: dokum
  };
});
