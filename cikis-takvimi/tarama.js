/*!
 * Çıkış takvimi — ayrılma tarihindeki EŞİKLERİ bulur.
 *
 * NE SORUYOR
 * ----------
 * Sitedeki diğer araçlar "şu tarihte ayrılırsam ne alırım" diyor. Bu araç
 * farklı bir soruyu yanıtlıyor: "zaten ayrılacağım, tarih fark eder mi?"
 *
 * Cevap çoğu gün "hayır" — bir gün daha çalışmak kıdemi bir günlük artırır,
 * o kadar. Ama yılda birkaç gün vardır ki tek bir gün on binlerce lira
 * değiştirir: kıdem tavanının değiştiği 1 Ocak ve 1 Temmuz, ihbar süresinin
 * kademe atladığı 6/18/36 ay, kıdem hakkının doğduğu 1 yıl, işsizlik
 * ödeneğinin süresinin arttığı 600/900/1080 prim günü. Hangilerinin size
 * denk geldiği tamamen kendi tarihlerinize bağlı ve elle çıkarılamaz.
 *
 * ÖLÇÜT NEDEN "PAKET" DEĞİL
 * -------------------------
 * Naif bir karşılaştırma her çıkış tarihi için çıkış paketini hesaplar ve
 * en büyüğünü seçer. Bu YANLIŞ sonuç verir: ayın 1'inde ayrılan kişi son ay
 * maaşının yalnızca bir gününü alır, ayın 30'unda ayrılan otuz gününü. Paket
 * bu yüzden her ay başında ~60.000 TL "düşer" ve araç "ayın sonunda ayrıl"
 * der — oysa ayın 1'inde ayrılan kişi o ayın maaşını zaten almıştır.
 *
 * Bu ölçülüp görüldü. Doğrusu ORTAK BİR BAŞLANGIÇTAN İTİBAREN TOPLAM NAKİT:
 * çıkışa kadar çalışılarak kazanılan net maaşlar + çıkış paketi. Bu ölçütte
 * gün geçtikçe değer düzgün artar ve gerçek eşikler sivri sıçramalar olarak
 * ayrışır.
 *
 * KAPSAM SINIRI
 * -------------
 * Tarama yalnızca bordro parametrelerinin DOĞRULANMIŞ olduğu yıllar içinde
 * yapılır. Sonraki yılın tarifesi ve kıdem tavanı açıklanmadan o günlere
 * dair bir sayı üretmek, uydurmak olur. Sınırın ötesinde bilinen bir
 * değişiklik varsa (ör. 1 Ocak'ta kıdem tavanı mutlaka değişir) tutar
 * verilmeden UYARI olarak bildirilir.
 *
 * Kullanım (tarayıcı):  window.CikisTakvimi.tara(girdi)
 * Kullanım (Node):      require("./tarama.js").tara(girdi)
 */
(function (kok) {
  "use strict";

  var B = (typeof require === "function")
    ? require("../bordro/motor.js") : kok.Bordro;
  var C = (typeof require === "function")
    ? require("../bordro/cikis.js") : kok.BordroCikis;

  var GUN = 86400000;

  function gun(iso) { return new Date(iso + "T00:00:00Z"); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function ekle(isoStr, n) {
    var t = gun(isoStr); t.setUTCDate(t.getUTCDate() + n); return iso(t);
  }
  function yilOf(isoStr) { return parseInt(isoStr.slice(0, 4), 10); }
  function ayOf(isoStr) { return parseInt(isoStr.slice(5, 7), 10); }

  /** Parametresi doğrulanmış en son yıl. */
  function sonYil() {
    var y = Object.keys(B.parametreler)
      .filter(function (k) { return /^\d{4}$/.test(k); })
      .map(Number);
    return Math.max.apply(null, y);
  }

  /* Ortak başlangıçtan çıkışa kadar çalışılarak kazanılan net maaşlar.
     Çıkış AYI dahil edilmez: o ayın ücreti çıkış paketinin içinde
     ("son ay") zaten sayılıyor. Aynı parayı iki kez saymak, geç
     tarihleri haksız yere öne çıkarırdı. */
  function araMaaslar(bas, cikis, brut) {
    var toplam = 0;
    var y = yilOf(bas), ySon = yilOf(cikis);
    for (var yil = y; yil <= ySon; yil++) {
      var r;
      try { r = B.hesaplaYil(brut, yil); } catch (e) { continue; }
      var ilk = (yil === y) ? ayOf(bas) : 1;
      var son = (yil === ySon) ? ayOf(cikis) - 1 : 12;
      for (var m = ilk; m <= son; m++) toplam += r.aylar[m - 1].net;
    }
    return toplam;
  }

  /** Bir çıkış tarihinin ortak ölçütteki değeri ve ayırt edici durumu. */
  function nokta(g, cikis) {
    var r = C.hesapla({
      iseGiris: g.iseGiris, cikis: cikis,
      ciplakBrut: g.ciplakBrut, giydirmeEkleri: g.giydirmeEkleri || 0,
      fesihTuru: g.fesihTuru || "isveren",
      ihbarSuresiCalisildi: !!g.ihbarSuresiCalisildi,
      kullanilmayanIzinGunu: g.kullanilmayanIzinGunu || 0,
      son4AyBrutOrtalama: g.son4AyBrutOrtalama || g.ciplakBrut,
      son3YilPrimGunu: g.son3YilPrimGunu || 0
    });
    return {
      tarih: cikis,
      deger: araMaaslar(g.bas, cikis, g.ciplakBrut) + r.toplam.genelToplam,
      paket: r.toplam.genelToplam,
      kidemHak: r.kidem.hak,
      kidemTavan: r.kidem.tavan || null,
      ihbarHafta: r.ihbar.hafta || 0,
      odenekAy: r.issizlik.ay || 0
    };
  }

  /* Bir eşiğin SEBEBİNİ adlandırır. Yalnızca "burada sıçrama var" demek
     kullanıcıyı bir adım ileri götürmüyor; hangi kuralın devreye girdiğini
     bilmek, tarihin gerçekten elinde olup olmadığına karar vermesini
     sağlıyor. */
  function sebep(onceki, simdi) {
    if (!onceki.kidemHak && simdi.kidemHak) {
      return { kod: "kidem-hakki", ad: "Kıdem tazminatı hakkı doğuyor",
        aciklama: "En az bir yıl çalışma şartı bu gün tamamlanıyor." };
    }
    if (simdi.ihbarHafta > onceki.ihbarHafta) {
      return { kod: "ihbar", ad: "İhbar süresi kademe atlıyor",
        aciklama: "İhbar süresi " + onceki.ihbarHafta + " haftadan " +
          simdi.ihbarHafta + " haftaya çıkıyor (4857 m.17)." };
    }
    if (simdi.odenekAy > onceki.odenekAy) {
      return { kod: "odenek", ad: "İşsizlik ödeneği süresi uzuyor",
        aciklama: "Ödenek " + onceki.odenekAy + " aydan " + simdi.odenekAy +
          " aya çıkıyor (4447 m.50)." };
    }
    if (simdi.kidemTavan !== onceki.kidemTavan) {
      return { kod: "tavan", ad: "Kıdem tavanı dönemi değişiyor",
        aciklama: "Uygulanan tavan " +
          (onceki.kidemTavan || 0).toLocaleString("tr-TR") + " TL'den " +
          (simdi.kidemTavan || 0).toLocaleString("tr-TR") + " TL'ye çıkıyor." };
    }
    return { kod: "diger", ad: "Tutarlarda sıçrama",
      aciklama: "Bu günde hesabın bir bileşeni kademe atlıyor." };
  }

  /**
   * @param {object} g  iseGiris, ciplakBrut, son3YilPrimGunu, bas (tarama
   *                    başlangıcı), gun (kaç gün taranacak)
   * @returns {{esikler:Array, ufuk:string, uyarilar:Array, taban:object}}
   */
  function tara(g) {
    var bas = g.bas || iso(new Date());
    var kapsamSonu = sonYil() + "-12-31";
    var istenen = ekle(bas, (g.gun || 365) - 1);
    var ufuk = istenen > kapsamSonu ? kapsamSonu : istenen;

    var uyarilar = [];
    if (istenen > kapsamSonu) {
      uyarilar.push({
        kod: "kapsam",
        metin: "Tarama " + ufuk + " tarihinde bitiyor: sonraki yılın vergi " +
          "tarifesi ve kıdem tavanı henüz açıklanmadı. Bu tarihten sonrası " +
          "için tutar üretmek uydurmak olurdu."
      });
      uyarilar.push({
        kod: "yilbasi",
        metin: "1 Ocak'ta kıdem tavanı mutlaka değişir ve bugüne kadar hep " +
          "yukarı gitti. Ücretiniz tavanın üzerindeyse yıl başını beklemek " +
          "kıdem tazminatınızı artırabilir; tutarı, tavan açıklanınca " +
          "hesaplanabilir."
      });
    }

    var taban = nokta(g, bas);
    var gunlukArtis = taban.deger > 0
      ? (nokta(g, ekle(bas, 1)).deger - taban.deger) : 0;
    /* Eşik ölçütü: günlük doğal artışın belirgin katı. Kat sayısı üç
       seçildi — iki, yuvarlama ve ay uzunluğu farklarıyla yanlış alarm
       veriyordu; beş, ihbar kademesi gibi gerçek ama küçük sıçramaları
       kaçırıyordu. */
    var esikSiniri = Math.max(Math.abs(gunlukArtis) * 3, 1000);

    var esikler = [], onceki = taban, sayac = 0;
    for (var d = ekle(bas, 1); d <= ufuk; d = ekle(d, 1)) {
      if (++sayac > 800) break;               // güvenlik: sonsuz döngü olmasın
      var p;
      try { p = nokta(g, d); } catch (e) { continue; }
      var fark = p.deger - onceki.deger;
      var yapisal = p.kidemHak !== onceki.kidemHak ||
        p.ihbarHafta !== onceki.ihbarHafta ||
        p.odenekAy !== onceki.odenekAy ||
        p.kidemTavan !== onceki.kidemTavan;
      if (yapisal || fark > esikSiniri) {
        var s = sebep(onceki, p);
        esikler.push({
          tarih: d, kazanc: fark, kod: s.kod, ad: s.ad, aciklama: s.aciklama,
          kalanGun: Math.round((gun(d) - gun(bas)) / GUN),
          oncekiDeger: onceki.deger, yeniDeger: p.deger
        });
      }
      onceki = p;
    }

    return { esikler: esikler, ufuk: ufuk, uyarilar: uyarilar,
             taban: taban, gunlukArtis: gunlukArtis };
  }

  var api = { tara: tara, nokta: nokta, araMaaslar: araMaaslar, sonYil: sonYil };
  if (typeof module === "object" && module.exports) module.exports = api;
  else kok.CikisTakvimi = api;
})(typeof window !== "undefined" ? window : this);
