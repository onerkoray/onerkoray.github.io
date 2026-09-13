/*!
 * Finansal İkiz — yaşam boyu projeksiyon motoru
 *
 * Profili alır, ay ay yürütür, yıl yıl rapor eder. Belirsizlik BURADA
 * DAĞILIM VARSAYARAK değil, ÜÇ İSİMLİ SENARYOYLA temsil ediliyor.
 *
 * NEDEN ÜÇ SENARYO, NEDEN MONTE CARLO DEĞİL
 *   P10/P50/P90 bantlı bir yelpazenin anlamlı olması için getirinin ve
 *   enflasyonun DAĞILIMINI bilmek gerekir. Türkiye'de o seri yok: son on
 *   yılda yıllık TÜFE tek haneden %60'ın üzerine çıkıp geri indi. Böyle
 *   bir seride bir dağılım uydurup ondan 360 aylık yollar üretmek,
 *   uydurmayı bilimsel görünen bir grafiğe çevirmek olur — ve grafik ne
 *   kadar iyi tasarlanırsa o kadar ikna edici, o kadar yanıltıcı olur.
 *
 *   Üç senaryoda bandın SAHİBİ MODEL DEĞİL KULLANICI. Varsayımlar
 *   görünür, değiştirilebilir ve kullanıcının kendi sözü. Daha az
 *   gösterişli, daha dürüst.
 *
 *   (Sitede dağılım temelli bir motor zaten var: finansal-ozgurluk
 *   aracındaki Monte Carlo. Orada belirsizlik emeklilik ÇEKİM
 *   sürdürülebilirliği için ölçülüyor ve varsayımları o sayfada açıkça
 *   yazılı. Buradaki tercih onu reddetmek değil, farklı bir soruya
 *   farklı bir araç kullanmak.)
 *
 * ÜCRET VERGİSİ İÇİN AÇIK VARSAYIM
 *   Gelecek yılların vergi tarifesi açıklanmadı ve bu motor uydurmuyor.
 *   Bunun yerine TARİFENİN ENFLASYONLA ENDEKSLENDİĞİ varsayılıyor —
 *   Türkiye'de fiilen olan budur (yeniden değerleme). Uygulaması şöyle:
 *   gelecekteki nominal maaş bugünün parasına indirgenir, net/brüt oranı
 *   BUGÜNKÜ tarifeyle o reel seviyede hesaplanır ve nominal maaşa
 *   uygulanır. Böylece sahte bir parametre tablosu üretilmiyor, yalnızca
 *   tek bir varsayım yapılıyor ve o varsayım yazılı.
 *
 *   Bu varsayımın yönü de belli: tarife enflasyonun ALTINDA endekslenirse
 *   (son yıllarda sık olduğu gibi) gerçek net, buradakinden DÜŞÜK çıkar.
 *   Yani bu tarafta model iyimser ve sayfa bunu söylüyor.
 *
 * GİDERİN ENDEKSLENMESİ AYRIMI: enflasyona endeksli olmayan bir gider
 * (sabit taksitli bir ödeme gibi) reel olarak her yıl ucuzlar. İkisini
 * ayırmadan yapılan uzun vadeli projeksiyon sistematik olarak yanlıştır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/finansal-ikiz/
 */
(function (root, factory) {
  "use strict";
  var nodeMi = (typeof module === "object" && module.exports);
  var B = nodeMi ? require("../bordro/motor.js") : root.Bordro;
  var P = nodeMi ? require("./profil.js") : root.Profil;
  var E = nodeMi ? require("./enflasyon-motoru.js") : root.EnflasyonMotoru;
  var v = factory(B, P, E);
  if (nodeMi) module.exports = v;
  else root.IkizMotoru = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (B, P, E) {
  "use strict";

  function r2(n) { return Math.round(n * 100) / 100; }

  /* Bu türler yatırım getirisi KAZANMAZ: bir ev, bir yatırım fonu gibi
     bileşik büyümez. Reel değerini koruduğu varsayılıyor. */
  var LIKIT_OLMAYAN = { konut: true, arac: true };

  /**
   * Ücretin net/brüt oranı, BUGÜNKÜ tarifeyle ve REEL maaş seviyesinde.
   * (Tarifenin enflasyonla endekslendiği varsayımının uygulaması.)
   * Sonuç önbelleğe alınıyor: aynı reel seviye yılda bir kez hesaplanır.
   */
  function netOranUretici() {
    var bellek = {};
    var yil = B.sonYil();
    return function (reelAylikBrut) {
      if (!(reelAylikBrut > 0)) return 0;
      /* 100 TL'lik kovalara yuvarlanıyor: tarife basamaklı olduğu için
         bu çözünürlük yeterli ve 240 aylık döngüyü hızlandırıyor. */
      var kova = Math.round(reelAylikBrut / 100) * 100;
      if (bellek[kova] !== undefined) return bellek[kova];
      var t = B.hesaplaYil(kova, yil).toplam;
      var oran = t.brut > 0 ? t.net / t.brut : 0;
      bellek[kova] = oran;
      return oran;
    };
  }

  /**
   * @param {Object} profil  Profil.normalize()'dan geçmiş nesne
   * @param {string} senaryoAdi  "kotumser" | "baz" | "iyimser"
   */
  function projeksiyon(profil, senaryoAdi) {
    var p = P.normalize(profil);
    var v = P.senaryoVarsayimlari(p, senaryoAdi || "baz");
    var yilSayisi = v.ufukYil;
    var N = yilSayisi * 12;

    var enfAy = Math.pow(1 + v.enflasyon, 1 / 12) - 1;
    var getiriAy = Math.pow(1 + v.yatirimGetirisi, 1 / 12) - 1;
    var netOran = netOranUretici();

    /* ÜCRET YILDA BİR SIÇRAR, FİYATLAR HER AY ARTAR.
     *
     * İlk sürümde ücret de aylık bileşikleniyordu — yani maaş sürekli
     * artıyordu. Test yakaladı: ilk yılın geliri, bordro motorunun düz
     * bir yıl için verdiği netten belirgin biçimde yüksek çıkıyordu
     * (artış yolunun ortalaması kadar).
     *
     * Gerçek hayatta ikisi farklı ritimde: zam yılda bir (bazen iki) kez
     * gelir, market fiyatları her ay değişir. Aradaki bu faz farkı bir
     * ayrıntı değil — tasarruf oranının yıl içinde ERİMESİNİN sebebi
     * tam olarak budur ve modelin onu göstermesi gerekir. */
    function ucretKati(yilIdx) { return Math.pow(1 + v.ucretArtisi, yilIdx); }

    /* Başlangıç durumu */
    /* Getiri ÜRETEN varlıklar ile üretmeyenler ayrı tutuluyor.
       Satın alınan bir ev net değere girer ama yatırım getirisi kazanmaz;
       ikisini karıştırmak, konutu bir yatırım fonu gibi büyütür ve
       projeksiyonu sistematik olarak şişirirdi. Konut reel değerini
       koruyor varsayılıyor (nominal olarak enflasyonla büyür). */
    var varlik = p.varliklar.reduce(function (a, x) {
      return a + (LIKIT_OLMAYAN[x.tur] ? 0 : x.deger);
    }, 0);
    var likitOlmayan0 = p.varliklar.reduce(function (a, x) {
      return a + (LIKIT_OLMAYAN[x.tur] ? x.deger : 0);
    }, 0);
    var likitOlmayan = 0;
    var borclar = p.borclar.map(function (b) {
      return {
        ad: b.ad, kalan: b.kalanAnapara, faiz: b.aylikFaiz,
        odeme: b.aylikOdeme, kalanVade: b.kalanVadeAy, bittiAy: null
      };
    });

    var ucretBrut0 = p.gelirler.reduce(function (a, g) {
      return a + (g.tur === "ucret" ? g.aylikBrut : 0);
    }, 0);
    var digerNet0 = p.gelirler.reduce(function (a, g) {
      return a + (g.tur === "ucret" ? 0 : g.aylikNet);
    }, 0);

    /* YAŞAM OLAYLARI
     *
     * Tutarlar BUGÜNÜN PARASIYLA girilir ve olayın yılına taşınır.
     * Kullanıcı "2032'de peşinat 2.000.000" derken bugünün alım gücünü
     * kastediyor; nominal kabul etmek, yüksek enflasyonda olayı yıllar
     * geçtikçe görünmez kılardı.
     *
     * Olaylar ay ay değil, OLAYIN YILININ İLK AYINDA uygulanıyor: bir
     * yaşam olayının ayını tahmin etmek sahte bir hassasiyet olurdu. */
    var bugunYil = new Date().getFullYear();

    var olaylar = p.olaylar.map(function (o) {
      var yilIdx = o.yil - bugunYil;
      return { o: o, yilIdx: yilIdx, ay: yilIdx * 12, uygulandi: false };
    }).filter(function (x) { return x.yilIdx >= 0 && x.yilIdx < yilSayisi; });

    /* Ev alınca kira biter: duran gider kalemlerinin id'leri. */
    var duranGiderler = {};
    /* Emeklilikte 0, iş değişikliğinde 1,25 gibi. Olaylar biriktiği için
       çarpan ÇARPILARAK uygulanıyor, atanarak değil. */
    var ucretCarpani = 1;
    /* Olaylardan gelen aylık delta'lar: {baslangicAy, bitisAy, tutar}. */
    var ekGiderler = [];
    var ekGelirler = [];

    var yillar = [];
    var tukenmeAyi = null;
    var oYil = null;

    for (var ay = 0; ay < N; ay++) {
      var yilIdx = Math.floor(ay / 12);
      if (!oYil || oYil.idx !== yilIdx) {
        if (oYil) yillar.push(kapat(oYil));
        oYil = {
          idx: yilIdx, yil: bugunYil + yilIdx,
          gelir: 0, gider: 0, borcOdemesi: 0, faiz: 0,
          tasarruf: 0, getiri: 0
        };
      }

      /* İKİ FİYAT DÜZEYİ, VE HANGİSİNİN NEREDE KULLANILDIĞI ÖNEMLİ.
         enfKat    : ayın BAŞINDAKİ düzey — o ay içinde gerçekleşen akışlar
                     (gelir, gider, olay tutarları) buradan taşınır.
         enfKatSon : ayın SONUNDAKİ düzey — ay sonundaki STOK değerleri
                     (varlık, net değer) buradan bugüne indirgenir.
         İkisini karıştırmak bütün reel değerleri tam olarak bir aylık
         enflasyon kadar kaydırıyordu. Test yakaladı. */
      var enfKat = Math.pow(1 + enfAy, ay);
      var enfKatSon = enfKat * (1 + enfAy);

      /* --- olaylar: yılın ilk ayında uygulanır --- */
      for (var oi = 0; oi < olaylar.length; oi++) {
        var x = olaylar[oi];
        if (x.uygulandi || x.ay !== ay) continue;
        x.uygulandi = true;
        var e = x.o;
        /* Bugünün parasıyla girilen tutarlar o yılın parasına taşınıyor. */
        var kat = enfKat;

        if (e.pesinat > 0) varlik -= e.pesinat * kat;
        if (e.tekSeferlikGelir > 0) varlik += e.tekSeferlikGelir * kat;
        /* Likit OLMAYAN varlık (satın alınan ev/araç) toplam varlığa
           giriyor ama dayanma süresi hesabına değil; projeksiyonda da
           getiri üretmemesi gerekir — bu yüzden ayrı tutuluyor.
           BUGÜNÜN PARASIYLA saklanıyor: ilk sürümde satın alma anındaki
           nominal değer yazılıyordu ve o değer sabit kalıyordu, yani
           evin REEL değeri yıllar içinde eriyordu. Başlangıçtaki konutla
           aynı kurala tabi olmalı. */
        if (e.varlikEklemesi > 0) likitOlmayan += e.varlikEklemesi;

        if (e.borc) {
          borclar.push({
            ad: e.ad, kalan: e.borc.anapara * kat, faiz: e.borc.aylikFaiz,
            odeme: e.borc.aylikOdeme * kat, kalanVade: 360, bittiAy: null
          });
        }
        if (e.aylikGiderEtkisi !== 0) {
          ekGiderler.push({ bas: ay, bitis: e.sureYil ? ay + e.sureYil * 12 : Infinity,
            tutar: e.aylikGiderEtkisi });
        }
        if (e.aylikGelirEtkisi !== 0) {
          ekGelirler.push({ bas: ay, bitis: e.sureYil ? ay + e.sureYil * 12 : Infinity,
            tutar: e.aylikGelirEtkisi });
        }
        if (e.ucretCarpani !== null) ucretCarpani *= e.ucretCarpani;
        if (e.durdurulanGiderId) duranGiderler[e.durdurulanGiderId] = true;
      }

      /* --- gelir --- */
      var brut = ucretBrut0 * ucretKati(yilIdx) * ucretCarpani;
      /* Reel seviye, ücretin ZAMMI ALDIĞI AN'a göre ölçülüyor: tarifenin
         enflasyonla endekslendiği varsayımı yıl başında uygulanır, ay ay
         değil. Aksi halde aynı maaş yıl içinde farklı reel seviyelere
         düşer ve net oran her ay kayardı. */
      var reelBrut = brut / Math.pow(1 + v.enflasyon, yilIdx);
      var ucretNet = brut * netOran(reelBrut);
      /* Ücret dışı gelir (kira, serbest meslek) de yılda bir güncellenir:
         kira artışı sözleşmeyle yıllıktır (TBK m.344), serbest meslek
         fiyatı da sürekli değil dönemsel yenilenir. */
      var diger = digerNet0 * Math.pow(1 + v.enflasyon, yilIdx);
      /* Olay gelirleri (emekli aylığı, kira geliri) de bugünün parasıyla
         girilip o ayın parasına taşınıyor. */
      var olayGeliri = 0;
      for (var gi = 0; gi < ekGelirler.length; gi++) {
        var eg = ekGelirler[gi];
        if (ay >= eg.bas && ay < eg.bitis) olayGeliri += eg.tutar * enfKat;
      }
      var gelir = ucretNet + diger + olayGeliri;

      /* --- gider --- */
      var gider = 0;
      for (var i = 0; i < p.giderler.length; i++) {
        var k = p.giderler[i];
        if (k.bitisYili && bugunYil + yilIdx > k.bitisYili) continue;
        /* Ev alındıysa kira kalemi durur. */
        if (duranGiderler[k.id]) continue;
        gider += k.enflasyonaEndeksli ? k.aylik * enfKat : k.aylik;
      }
      for (var xi = 0; xi < ekGiderler.length; xi++) {
        var eg2 = ekGiderler[xi];
        if (ay >= eg2.bas && ay < eg2.bitis) gider += eg2.tutar * enfKat;
      }

      /* --- borçlar --- */
      var borcOdemesi = 0, aylikFaiz = 0;
      for (var j = 0; j < borclar.length; j++) {
        var b = borclar[j];
        if (b.kalan <= 0.005) continue;
        var f = b.kalan * b.faiz;
        var od = Math.min(b.odeme, b.kalan + f);
        if (od <= f) {
          /* Ödeme faizi karşılamıyor: borç büyüyor. Sessizce sonsuza
             kadar sürmemesi için kalan vade sonunda kapanmış sayılmıyor,
             gerçekten büyüdüğü gösteriliyor. */
          od = b.odeme;
        }
        b.kalan = b.kalan + f - od;
        if (b.kalan <= 0.005) { b.kalan = 0; b.bittiAy = ay + 1; }
        borcOdemesi += od;
        aylikFaiz += f;
      }

      /* --- artan / açık --- */
      var artan = gelir - gider - borcOdemesi;
      var getiri = varlik * getiriAy;
      varlik = varlik + getiri + artan;
      if (varlik < 0 && tukenmeAyi === null) tukenmeAyi = ay + 1;

      oYil.gelir += gelir;
      oYil.gider += gider;
      oYil.borcOdemesi += borcOdemesi;
      oYil.faiz += aylikFaiz;
      oYil.tasarruf += artan;
      oYil.getiri += getiri;
      /* Konut/araç nominal olarak enflasyonla taşınır (reel değeri sabit
         varsayılıyor); yatırım getirisi kazanmaz. Başlangıçtakiler ve
         olayla alınanlar AYNI kuralda. Ay SONU düzeyiyle taşınıyor ki
         yanındaki likit varlıkla ve deflatörle aynı ana denk gelsin. */
      oYil.sonVarlik = varlik + (likitOlmayan0 + likitOlmayan) * enfKatSon;
      oYil.sonBorc = borclar.reduce(function (a, x) { return a + Math.max(0, x.kalan); }, 0);
      oYil.enfKat = enfKatSon;
    }
    if (oYil) yillar.push(kapat(oYil));

    function kapat(y) {
      var net = y.sonVarlik - y.sonBorc;
      return {
        yil: y.yil,
        /* TÜKENDİKTEN SONRASI BİR TAHMİN DEĞİL.
           Varlık sıfırın altına indikten sonra model açığı biriktirmeye
           devam ediyor; gerçek hayatta kimse eksi bakiyeyle yaşamaz,
           harcamasını keser ya da borçlanır. O yüzden bu yıllar ayrıca
           işaretleniyor: çizilen şey servet değil, KAPATILMASI GEREKEN
           AÇIĞIN BÜYÜKLÜĞÜ. Arayüz bunu farklı gösterip söylemeli. */
        tukenmisSonrasi: tukenmeAyi !== null && (y.idx + 1) * 12 >= tukenmeAyi,
        yas: p.kisi.dogumYili ? y.yil - p.kisi.dogumYili : null,
        gelir: r2(y.gelir),
        gider: r2(y.gider),
        borcOdemesi: r2(y.borcOdemesi),
        faiz: r2(y.faiz),
        tasarruf: r2(y.tasarruf),
        getiri: r2(y.getiri),
        varlik: r2(y.sonVarlik),
        borc: r2(y.sonBorc),
        netDeger: r2(net),
        /* Reel değer, o yılın sonundaki enflasyon katsayısıyla bugüne
           indirgeniyor. Nominal tek başına 20 yıllık grafikte anlamsız. */
        reelNetDeger: r2(net / y.enfKat),
        reelVarlik: r2(y.sonVarlik / y.enfKat)
      };
    }

    var son = yillar[yillar.length - 1] || null;
    return {
      senaryo: senaryoAdi || "baz",
      varsayimlar: v,
      yillar: yillar,
      sonNetDeger: son ? son.netDeger : 0,
      sonReelNetDeger: son ? son.reelNetDeger : 0,
      borcBitisleri: borclar.filter(function (b) { return b.bittiAy; })
        .map(function (b) { return { ad: b.ad, ay: b.bittiAy,
          yil: bugunYil + Math.floor((b.bittiAy - 1) / 12) }; }),
      odenmemisBorc: borclar.some(function (b) { return b.kalan > 0.005; }),
      tukenmeAyi: tukenmeAyi,
      tukenmeYili: tukenmeAyi === null ? null : bugunYil + Math.floor((tukenmeAyi - 1) / 12)
    };
  }

  /**
   * Üç senaryo birlikte. Bandın alt ve üst sınırı buradan çıkıyor —
   * bir dağılımdan değil, kullanıcının kendi üç varsayımından.
   */
  function ucSenaryo(profil) {
    var k = projeksiyon(profil, "kotumser");
    var b = projeksiyon(profil, "baz");
    var i = projeksiyon(profil, "iyimser");
    var n = b.yillar.length;
    var bant = [];
    for (var y = 0; y < n; y++) {
      var kk = k.yillar[y], bb = b.yillar[y], ii = i.yillar[y];
      if (!kk || !bb || !ii) continue;
      bant.push({
        yil: bb.yil, yas: bb.yas,
        alt: Math.min(kk.reelNetDeger, ii.reelNetDeger),
        orta: bb.reelNetDeger,
        ust: Math.max(kk.reelNetDeger, ii.reelNetDeger)
      });
    }
    return {
      kotumser: k, baz: b, iyimser: i, bant: bant,
      /* Bandın genişliği belirsizliğin BÜYÜKLÜĞÜ: dar bant "plan
         sağlam", geniş bant "sonuç varsayıma çok duyarlı" demek.
         Oran (genişlik / medyan) mutlak genişlikten daha okunur bir
         ölçü: 20 yıllık projeksiyonda 3-4 kat normaldir ve bunun
         kullanıcıya söylenmesi gerekir — modelin kesinlik iddiası
         taşımadığını gösteren şey tam olarak budur. */
      bantGenisligi: bant.length
        ? (bant[bant.length - 1].ust - bant[bant.length - 1].alt) : 0,
      bantOrani: (bant.length && bant[bant.length - 1].orta !== 0)
        ? (bant[bant.length - 1].ust - bant[bant.length - 1].alt) /
          Math.abs(bant[bant.length - 1].orta) : null,
      hepsindeTukenme: !!(k.tukenmeYili && b.tukenmeYili && i.tukenmeYili),
      kotumserdeTukenme: k.tukenmeYili
    };
  }

  /**
   * Hangi varsayım sonucu en çok değiştiriyor?
   * Her varsayım tek tek oynatılıp fark ölçülüyor — yaklaşık türev değil,
   * tam yeniden koşum. "Neyi değiştirmeliyim?" sorusunun cevabı bu.
   */
  function duyarlilik(profil, sapma) {
    var d = sapma === undefined ? 0.05 : sapma;
    var p = P.normalize(profil);
    var taban = projeksiyon(p, "baz").sonReelNetDeger;

    function ile(degistir) {
      var kopya = JSON.parse(JSON.stringify(p));
      degistir(kopya);
      return projeksiyon(kopya, "baz").sonReelNetDeger - taban;
    }

    var kalemler = [
      { ad: "Yatırım getirisi", birim: "+5 puan",
        etki: ile(function (x) { x.varsayimlar.yatirimGetirisi += d; }) },
      { ad: "Enflasyon", birim: "+5 puan",
        etki: ile(function (x) { x.varsayimlar.enflasyon += d; }) },
      { ad: "Ücret artışı", birim: "+5 puan",
        etki: ile(function (x) { x.varsayimlar.ucretArtisi += d; }) },
      { ad: "Aylık gider", birim: "−%10",
        etki: ile(function (x) {
          x.giderler.forEach(function (k) { k.aylik *= 0.9; });
        }) },
      { ad: "Ücret geliri", birim: "+%10",
        etki: ile(function (x) {
          x.gelirler.forEach(function (g) {
            if (g.tur === "ucret") g.aylikBrut *= 1.1;
          });
        }) }
    ];

    kalemler.sort(function (a, b) { return Math.abs(b.etki) - Math.abs(a.etki); });
    return { taban: r2(taban), kalemler: kalemler.map(function (k) {
      return { ad: k.ad, birim: k.birim, etki: r2(k.etki),
        oran: taban !== 0 ? k.etki / Math.abs(taban) : null };
    }) };
  }

  return {
    projeksiyon: projeksiyon,
    ucSenaryo: ucSenaryo,
    duyarlilik: duyarlilik
  };
});
