/*!
 * maas-hesaplama/<tutar>-tl-brut-ne-kadar-net/ sayfalarini yonetir.
 *
 * NEDEN VAR:
 * Bu 28 sayfa sablondan uretilmisti ve aralarindaki tek fark rakamlardi.
 * Olculdugunde gorunur metinlerinin kelime ortusmesi 0,813 cikti; komsu iki
 * sayfa arasindaki 34 farkli kelimenin 34'u de rakamdi. Google bu kumeyi
 * "Kesfedildi - su anda dizine eklenmis degil" kovasina koydu: URL'leri
 * biliyor ama taramaya degmedigine karar veriyor.
 *
 * COZUM iki parcali:
 *   1) SECILI tutarlar (KALICI) o tutara OZGU, motordan uretilen bir bolum
 *      aliyor: dilim kirilmalarinin hangi ayda oldugu, asgari ucrete brut ve
 *      net oran farki, yillik efektif vergi yuku, SGK tavaninin devreye girip
 *      girmedigi, isveren maliyeti ve sabit net icin gereken brut. Bunlarin
 *      hepsi tutara gore gercekten degisiyor.
 *   2) Kalan tutarlar noindex aliyor ve sitemap'ten cikiyor. Silinmiyorlar;
 *      brut-net-tablosu'ndan erisilmeye ve kullaniciya hizmet etmeye devam
 *      ediyorlar, yalnizca dizine girmek icin yarismiyorlar.
 *
 * Kullanim:
 *   node tools/maas-sayfalari.js           # bloklari yaz, noindex uygula
 *   node tools/maas-sayfalari.js --check   # degisiklik gerekiyor mu (CI)
 *   node tools/maas-sayfalari.js --list    # hangi tutar ne durumda
 */
"use strict";

var fs = require("fs");
var path = require("path");
var B = require("../bordro/motor.js");

var KOK = path.resolve(__dirname, "..");
var YIL = 2026;

/* Dizine girmek icin yarisacak tutarlar. Secim iki olcute dayaniyor:
   yuvarlak ve aranan rakamlar olmalari, ve her birinin farkli bir hikayesi
   olmasi - dilim yolculuklari, kirilma aylari ve tavan durumlari ayri. */
var KALICI = [40000, 50000, 60000, 75000, 100000, 150000, 200000, 300000];

var BAS = "<!-- MAAS-DETAY:BASLANGIC -->";
var BIT = "<!-- MAAS-DETAY:BITIS -->";
var NOINDEX = '<meta name="robots" content="noindex, follow">';

/* ------------------------------------------------------------- yardimcilar */

function fm(n) {
  return Number(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function fm0(n) {
  return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}
function oran(n, basamak) {
  return Number(n).toLocaleString("tr-TR", {
    minimumFractionDigits: basamak === undefined ? 1 : basamak,
    maximumFractionDigits: basamak === undefined ? 1 : basamak
  });
}
function yuzde(x) {
  return "%" + Number(x * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

/* Turkce ek uyumu tahmin edilemiyor; 12 ay icin dogrusu tabloya yaziliyor.
   "Ekim'dır" ve "Şubat'dır" gibi hatalar uretilen metinde cok goze batiyor. */
var AY_DIR = {
  "Ocak": "Ocak'tır", "Şubat": "Şubat'tır", "Mart": "Mart'tır",
  "Nisan": "Nisan'dır", "Mayıs": "Mayıs'tır", "Haziran": "Haziran'dır",
  "Temmuz": "Temmuz'dur", "Ağustos": "Ağustos'tur", "Eylül": "Eylül'dür",
  "Ekim": "Ekim'dir", "Kasım": "Kasım'dır", "Aralık": "Aralık'tır"
};
var AY_DA = {
  "Ocak": "Ocak'ta", "Şubat": "Şubat'ta", "Mart": "Mart'ta",
  "Nisan": "Nisan'da", "Mayıs": "Mayıs'ta", "Haziran": "Haziran'da",
  "Temmuz": "Temmuz'da", "Ağustos": "Ağustos'ta", "Eylül": "Eylül'de",
  "Ekim": "Ekim'de", "Kasım": "Kasım'da", "Aralık": "Aralık'ta"
};

/* ELLE YAZILMIS yorumlar. Uretilmiyorlar ve uretilmemeliler: bu sayfalari
   birbirinden ayiran tek sey bunlar. KALICI listesine yeni bir tutar
   eklenirse buraya da bir paragraf yazilmalidir - yoksa --check patlar. */
var YORUM = {
  40000: "Bu bant, asgari ücretin hemen üstündeki ilk basamaktır ve buradaki " +
    "asıl belirleyici gelir vergisi tarifesi değil, asgari ücret istisnasıdır. " +
    "İstisna herkese aynı tutarda uygulandığı için, asgari ücrete yakın " +
    "maaşlarda verginin neredeyse tamamını karşılar; yıllık efektif yükün " +
    "yüzde üçlerde kalmasının sebebi budur. Pratik sonucu şudur: bu seviyede " +
    "brüt zammın nete yansıması, daha yüksek maaşlardakine göre çok daha " +
    "yüksek oranda gerçekleşir. Aynı 5.000 TL'lik brüt artış, bu bantta " +
    "cebinize üst bantlardakinden belirgin biçimde fazla para bırakır.",

  50000: "Elli bin lira, çalışanların büyük bölümünün ilk kez \"maaşım neden " +
    "düştü?\" sorusunu sorduğu eşiktir. Sebebi tutarın kendisi değil, " +
    "kümülatif matrahın yıl içinde iki kez dilim atlamaya yetecek hızda " +
    "birikmesidir: bordroda tek bir değişiklik olmadığı hâlde net, yılın " +
    "ikinci yarısında görünür biçimde azalır. Bu seviyede maaş pazarlığı " +
    "yaparken ocak netini referans almak yanıltıcıdır; on iki aylık ortalama " +
    "net, gerçek yıllık kazancınızı çok daha doğru anlatır.",

  60000: "Altmış bin lirada dilim değişimi yılın ilk üçte birine kadar iner. " +
    "Bunun pratik anlamı, yılın büyük bölümünü ilk dilimin dışında " +
    "geçirmenizdir; ocak ve şubat aylarındaki net, yılın geri kalanını " +
    "temsil etmez. Bu bant aynı zamanda yan hakların değeriyle vergi " +
    "arasındaki dengenin değiştiği yerdir: yemek ve ulaşım gibi istisna " +
    "kapsamındaki ödemeler brüte eklenmediği için, aynı maliyetle verilen " +
    "yan hak, brüt zamdan daha fazla net değer taşıyabilir.",

  75000: "Yetmiş beş bin lirada kümülatif matrah mart ayında ikinci dilime " +
    "ulaşır; yani yılın daha ilk çeyreğinde ocak neti geride kalır. Bu " +
    "seviyeden itibaren net üzerinden anlaşmak yaygınlaşır, çünkü brüt " +
    "üzerinden yapılan sözleşmede çalışan yıl boyunca azalan bir net " +
    "görürken, net üzerinden yapılan sözleşmede artan yükü işveren üstlenir. " +
    "İki sözleşme tipinin işverene toplam maliyeti aynı değildir; farkı " +
    "görmek için aşağıdaki sabit net hesabına bakın.",

  100000: "Yüz bin lira yuvarlak bir rakam olduğu için sık aranır, ama bordroda " +
    "yuvarlaklığın bir karşılığı yoktur. Bu tutarda brütün yaklaşık altıda " +
    "biri gelir ve damga vergisine, yedide biri SGK ve işsizlik primine " +
    "gider; geriye kalan kısım da yıl içinde sabit değildir. Altı haneli " +
    "brüt maaşın net karşılığının çoğu kişiye beklediğinden düşük gelmesinin " +
    "sebebi, tarifedeki oranın ilan edilen brütün tamamına değil, kümülatif " +
    "matraha uygulanmasıdır.",

  150000: "Yüz elli bin lira, on iki ay boyunca aynı brütle çalışıldığında " +
    "yüzde otuz beşlik dilime ulaşan ilk banttır. Yılın son ayında girilen " +
    "bu dilim, aralık netini yılın en düşük seviyesine indirir; prim ve ikramiye " +
    "gibi ek ödemeler de aynı kümülatif matraha eklendiği için, yıl sonunda " +
    "ödenen bir primin vergi yükü yılın başında ödenenden belirgin biçimde " +
    "ağırdır. Ek ödemenin takvimi, bu seviyede tutarı kadar önemlidir.",

  200000: "İki yüz bin lirada üst dilime geçiş yılın son çeyreğine değil, " +
    "eylül ayına denk gelir. Yılın son dört ayı bu yüzden en ağır dönemdir ve " +
    "yıllık gelirin önemli bir bölümü en yüksek oranla vergilenir. Bu " +
    "seviyede şirket ortaklığı, serbest meslek ve ücretli çalışma arasındaki " +
    "vergi farkı da anlamlı hale gelir; aynı maliyetin farklı çalışma " +
    "biçimlerinde ne bıraktığını görmek için çalışma biçimi karşılaştırmasına " +
    "bakmakta yarar var.",

  300000: "Üç yüz bin lira, SGK prime esas kazanç tavanının aşıldığı banttır ve " +
    "bu, bordronun mantığını değiştirir. Tavana kadar prim kesilir, tavanın " +
    "üstündeki kısımdan kesilmez; dolayısıyla bu noktadan sonra brüt arttıkça " +
    "prim kesintisi sabit kalır ve artan yükün tamamı gelir vergisinden gelir. " +
    "Aynı sebeple emeklilik aylığına esas kazanç da tavanda durur: brütteki " +
    "artış emeklilik hakkınıza yansımaz, yalnızca vergi matrahını büyütür."
};

function sayfalar() {
  var dizin = path.join(KOK, "maas-hesaplama");
  return fs.readdirSync(dizin)
    .filter(function (a) { return /^\d+-tl-brut-ne-kadar-net$/.test(a); })
    .map(function (a) {
      return { ad: a, tutar: Number(a.split("-")[0]), yol: path.join(dizin, a, "index.html") };
    })
    .filter(function (x) { return fs.existsSync(x.yol); })
    .sort(function (a, b) { return a.tutar - b.tutar; });
}

/* --------------------------------------------------------------- hesaplama */

function analiz(tutar) {
  var brutler = [];
  for (var i = 0; i < 12; i++) brutler.push(tutar);
  var yil = B.hesaplaYil(brutler, YIL);
  var P = B.parametre(YIL);
  var d1 = B.donem(P, 1);

  var aylar = yil.aylar;
  var kirilmalar = [];
  for (var m = 1; m < 12; m++) {
    if (aylar[m].dilim !== aylar[m - 1].dilim) {
      kirilmalar.push({
        ay: aylar[m].ayAdi,
        onceki: aylar[m - 1].dilim,
        yeni: aylar[m].dilim,
        net: aylar[m].net,
        dusus: aylar[m - 1].net - aylar[m].net,
        kumulatif: aylar[m].kumulatifMatrah
      });
    }
  }

  /* En sert dusus 12 ayin TAMAMINDAN bulunuyor. Yalnizca dilim degisim
     aylarina bakmak yanlis cevap veriyordu: gecis ayi kismi oldugu icin asil
     dusus cogu zaman ONU IZLEYEN ilk tam ayda gerceklesiyor. */
  var enSertDusus = null;
  var yukselis = null;
  for (var k = 1; k < 12; k++) {
    var fark = aylar[k].net - aylar[k - 1].net;
    if (fark < -0.005 && (!enSertDusus || fark < enSertDusus.fark)) {
      enSertDusus = { ay: aylar[k].ayAdi, fark: fark, net: aylar[k].net };
    }
    if (fark > 0.005 && (!yukselis || fark > yukselis.fark)) {
      yukselis = { ay: aylar[k].ayAdi, fark: fark, net: aylar[k].net };
    }
  }

  /* Dilim yolculugunun duraklari: her dilimde kac ay kalindigi ve o dilimdeki
     YERLESIK aylik net (gecis ayinin kismi neti degil, sonrasinda oturan tutar). */
  var duraklar = [];
  aylar.forEach(function (ay, ix) {
    var son = duraklar[duraklar.length - 1];
    if (!son || son.dilim !== ay.dilim) {
      duraklar.push({ dilim: ay.dilim, ilk: ay.ayAdi, son: ay.ayAdi, net: ay.net, adet: 1 });
    } else {
      son.son = ay.ayAdi;
      son.net = ay.net;
      son.adet += 1;
    }
  });

  /* Marjinal kalan: 1.000 TL brut zam elinize ne kadar net getirir?
     Cevap hem tutara hem AYA gore degisiyor; ocak ile aralik arasindaki fark
     bu sayfalarda gosterilmeye deger bir sey. */
  var zam = 1000;
  var zamli = [];
  for (var z = 0; z < 12; z++) zamli.push(tutar + zam);
  var zamliYil = B.hesaplaYil(zamli, YIL);
  var marjinalOcak = zamliYil.aylar[0].net - aylar[0].net;
  var marjinalAralik = zamliYil.aylar[11].net - aylar[11].net;

  var ocakNet = aylar[0].net;
  var aralikNet = aylar[11].net;
  var yillikVergi = yil.toplam.gelirVergisi + yil.toplam.damga;

  /* Ocak netini yil boyu korumak icin gereken brut: netten brute cozucu
     kumulatif matrahi da hesaba katarak her ay icin ayri brut buluyor. */
  var sabitNetBrutler = B.nettenBruteYil(ocakNet, YIL, {});

  return {
    tutar: tutar,
    aylar: aylar,
    kirilmalar: kirilmalar,
    ocakNet: ocakNet,
    aralikNet: aralikNet,
    ortalamaNet: yil.toplam.net / 12,
    yillikNet: yil.toplam.net,
    yillikVergi: yillikVergi,
    efektif: yillikVergi / (tutar * 12),
    ilkDilim: aylar[0].dilim,
    sonDilim: aylar[11].dilim,
    asgariBrut: d1.asgariBrut,
    asgariNet: d1.asgariNet,
    brutKat: tutar / d1.asgariBrut,
    netKat: ocakNet / d1.asgariNet,
    sgkTavan: d1.sgkTavan,
    tavandaMi: tutar > d1.sgkTavan,
    primEsas: aylar[0].primEsas,
    isverenMaliyeti: aylar[0].isverenMaliyeti,
    isverenIndirimli: aylar[0].isverenMaliyeti - aylar[0].primEsas * P.oranlar.sgkIsverenIndirim,
    sabitNetAralikBrut: sabitNetBrutler[11],
    enSertDusus: enSertDusus,
    marjinalOcak: marjinalOcak,
    marjinalAralik: marjinalAralik,
    yukselis: yukselis,
    duraklar: duraklar
  };
}

/* ------------------------------------------------------------------- metin */

function blok(a) {
  var basligiTutar = fm0(a.tutar);
  var s = [];

  s.push(BAS);
  s.push('<h3 id="kirilma">' + basligiTutar + " TL brütte yılın kırılma noktaları</h3>");

  if (a.kirilmalar.length === 0) {
    s.push("<p>" + basligiTutar + " TL brüt maaş yıl boyunca <strong>" + yuzde(a.ilkDilim) +
      "</strong> gelir vergisi diliminde kalır; kümülatif matrah bir üst dilime " +
      "ulaşmaz. Bu tutar aralığına özgü bir durumdur — daha yüksek maaşlarda " +
      "net, yıl içinde birkaç kez düşer.</p>");
  } else {
    var yol = a.duraklar.map(function (d) { return yuzde(d.dilim); }).join(" → ");
    s.push("<p>" + basligiTutar + " TL brüt maaş yıla <strong>" + yuzde(a.ilkDilim) +
      "</strong> gelir vergisi dilimiyle başlar ve yıl içinde " +
      (a.kirilmalar.length === 1 ? "bir kez" : a.kirilmalar.length + " kez") +
      " dilim değiştirir: <strong>" + yol + "</strong>. Brütünüz hiç değişmediği " +
      "hâlde net maaşınızın azalmasının sebebi, gelir vergisinin aylık kazanca " +
      "değil <a href=\"../../makaleler/maasim-neden-dustu/\">yıl başından beri " +
      "biriken kümülatif matraha</a> göre hesaplanmasıdır. Ocak'ta " +
      fm(a.ocakNet) + " TL olan net, Aralık'ta <strong>" + fm(a.aralikNet) +
      " TL</strong>'ye iner: yıl içinde " + fm(a.ocakNet - a.aralikNet) + " TL, " +
      "yani %" + oran((a.ocakNet - a.aralikNet) / a.ocakNet * 100) + " fark.</p>");

    s.push('<div class="table-scroll"><table class="payroll">');
    s.push('<caption class="visually-hidden">' + basligiTutar +
      " TL brüt maaşta gelir vergisi dilimi yolculuğu</caption>");
    s.push("<thead><tr><th>Dilim</th><th>Aylar</th><th>Ay sayısı</th>" +
      "<th>Yerleşik aylık net</th></tr></thead><tbody>");
    a.duraklar.forEach(function (d) {
      s.push("<tr><th>" + yuzde(d.dilim) + "</th><td>" +
        (d.ilk === d.son ? d.ilk : d.ilk + " – " + d.son) + "</td><td>" +
        d.adet + " ay</td><td><strong>" + fm(d.net) + "</strong></td></tr>");
    });
    s.push("</tbody></table></div>");
    s.push('<p class="muted-note table-note">Dilimin değiştiği ay kısmi bir aydır: ' +
      "matrahın bir bölümü eski, kalanı yeni oranla vergilenir. Tablodaki " +
      "<em>yerleşik aylık net</em>, o dilimde tam geçirilen ayların netidir.</p>");

    if (a.enSertDusus) {
      /* Bu cumle her tutarda ayni degil: kimi maasta en buyuk dusus dilimin
         degistigi ayda, kimisinde yeni dilimde tam gecirilen ILK ayda olur.
         Hangisi oldugunu iddia etmeden once kontrol ediyoruz. */
      var gecisAyiMi = a.kirilmalar.some(function (k) { return k.ay === a.enSertDusus.ay; });
      s.push("<p>Tek bir ayda görülen en büyük düşüş <strong>" +
        AY_DA[a.enSertDusus.ay] + "</strong> yaşanır: bir önceki aya göre <strong>" +
        fm(-a.enSertDusus.fark) + " TL</strong>. " +
        (gecisAyiMi
          ? "Bu, üst dilime geçilen aydır."
          : "Dikkat çekici olan şu: bu ay dilimin değiştiği ay değil, " +
            "<strong>yeni dilimde tam geçirilen ilk aydır</strong> — geçiş ayında " +
            "matrahın yalnızca bir bölümü yeni oranla vergilenir.") + "</p>");
    }
  }

  if (a.yukselis) {
    s.push("<p>Yıl boyunca net yalnızca düşmez: <strong>" + AY_DA[a.yukselis.ay] +
      "</strong> net " + fm(a.yukselis.fark) + " TL <strong>yükselir</strong>. " +
      "Sebebi bir zam değil — 2026'da yıl ortası asgari ücret artışı yoktur. " +
      "Asgari ücret istisnası, asgari ücretlinin ödeyeceği vergiye eşittir; " +
      "asgari ücretlinin kümülatif matrahı da üst dilime geçtiğinde bu istisna " +
      "büyür ve sizin verginizden düşülen tutar artar.</p>");
  }

  if (YORUM[a.tutar]) {
    s.push('<h3 id="bant">' + basligiTutar + " TL bandında ne değişir?</h3>");
    s.push("<p>" + YORUM[a.tutar] + "</p>");
  }

  s.push('<h3 id="okuma">Bu rakamlar ne anlatıyor?</h3>');
  s.push("<ul>");

  s.push("<li><strong>Asgari ücretle farkı, brütte göründüğü kadar değil.</strong> " +
    basligiTutar + " TL brüt, " + fm0(a.asgariBrut) + " TL brüt asgari ücretin <strong>" +
    oran(a.brutKat, 2) + " katı</strong>. Ama Ocak neti (" + fm(a.ocakNet) +
    " TL) net asgari ücretin (" + fm(a.asgariNet) + " TL) yalnızca <strong>" +
    oran(a.netKat, 2) + " katı</strong>. Aradaki daralma, asgari ücret " +
    "istisnasının düşük maaşlarda oransal olarak çok daha büyük bir koruma " +
    "sağlamasından kaynaklanır.</li>");

  s.push("<li><strong>Yıllık efektif vergi yükü: %" + oran(a.efektif * 100) +
    "</strong> — yıl boyunca ödenen " + fm(a.yillikVergi) +
    " TL gelir ve damga vergisinin, " + fm0(a.tutar * 12) +
    " TL yıllık brüte oranı. Tarifedeki " + yuzde(a.sonDilim) +
    " oranından düşüktür; çünkü tarife kademelidir ve asgari ücret istisnası " +
    "her ay matrahtan düşülür.</li>");

  if (a.tavandaMi) {
    s.push("<li><strong>SGK tavanı bu maaşta devreye girer.</strong> 2026 prime esas " +
      "kazanç üst sınırı " + fm0(a.sgkTavan) + " TL'dir. " + basligiTutar +
      " TL brütün yalnızca " + fm0(a.primEsas) + " TL'lik kısmından SGK ve işsizlik " +
      "primi kesilir; kalan " + fm0(a.tutar - a.primEsas) + " TL prime tabi değildir. " +
      "Bu aralıkta brüt arttıkça prim kesintisi sabit kalır, artan yükün tamamı " +
      "gelir vergisinden gelir.</li>");
  } else {
    s.push("<li><strong>SGK tavanının altındadır.</strong> 2026 prime esas kazanç üst " +
      "sınırı " + fm0(a.sgkTavan) + " TL; " + basligiTutar + " TL brüt bu sınırın " +
      "altında kaldığı için SGK ve işsizlik primi brütün tamamı üzerinden kesilir.</li>");
  }

  s.push("<li><strong>İşverene aylık maliyeti " + fm(a.isverenMaliyeti) +
    " TL.</strong> İşveren SGK payı ve işsizlik primi dahildir. İşveren 5 puanlık " +
    "prim indiriminden yararlanıyorsa maliyet <strong>" + fm(a.isverenIndirimli) +
    " TL</strong>'ye iner. Ayrıntı için <a href=\"../../isveren-maliyeti-hesaplama/\">" +
    "işveren maliyeti hesaplama</a> aracına bakabilirsiniz.</li>");

  s.push("<li><strong>1.000 TL brüt zam, elinize " +
    (Math.abs(a.marjinalOcak - a.marjinalAralik) < 0.01
      ? "<strong>" + fm(a.marjinalOcak) + " TL</strong> net getirir"
      : "Ocak'ta " + fm(a.marjinalOcak) + " TL, Aralık'ta " +
        fm(a.marjinalAralik) + " TL net getirir") +
    ".</strong> Aynı zam, yılın hangi ayında yapıldığına göre farklı para " +
    "bırakır; zammın konuşulduğu ay, oranı kadar önemlidir.</li>");

  if (a.kirilmalar.length > 0) {
    s.push("<li><strong>Net maaşı yıl boyu sabit tutmak isterseniz</strong> — yani her ay " +
      "elinize Ocak'taki gibi " + fm(a.ocakNet) + " TL geçsin isterseniz — brütün " +
      "Aralık ayında <strong>" + fm(a.sabitNetAralikBrut) + " TL</strong>'ye çıkması " +
      "gerekir. Net üzerinden anlaşan çalışanların sözleşmesinde brütün yıl içinde " +
      "artmasının sebebi budur.</li>");
  }

  s.push("</ul>");
  s.push(BIT);
  return s.join("\n");
}

/* --------------------------------------------------------------- uygulama */

function guncelle(icerik, yeniBlok, indexlensin) {
  var s = icerik;

  /* blok: varsa degistir, yoksa SSS basliginin oncesine ekle */
  if (s.indexOf(BAS) > -1 && s.indexOf(BIT) > -1) {
    s = s.slice(0, s.indexOf(BAS)) + yeniBlok + s.slice(s.indexOf(BIT) + BIT.length);
  } else if (yeniBlok) {
    var capa = "<h3>Sık sorulan sorular</h3>";
    var yer = s.indexOf(capa);
    if (yer === -1) throw new Error("SSS baslgi bulunamadi");
    s = s.slice(0, yer) + yeniBlok + "\n" + s.slice(yer);
  }

  /* noindex: yalnizca dizine girmeyecek sayfalarda bulunmali */
  var varMi = s.indexOf(NOINDEX) > -1;
  if (!indexlensin && !varMi) {
    var mCapa = '<link rel="canonical"';
    var y = s.indexOf(mCapa);
    if (y === -1) throw new Error("canonical bulunamadi");
    s = s.slice(0, y) + NOINDEX + "\n  " + s.slice(y);
  } else if (indexlensin && varMi) {
    s = s.replace(NOINDEX + "\n  ", "").replace(NOINDEX, "");
  }
  return s;
}

function main() {
  var kontrol = process.argv.indexOf("--check") > -1;
  var listele = process.argv.indexOf("--list") > -1;
  var liste = sayfalar();
  var degisen = [];

  if (listele) {
    console.log("tutar     durum      dilim yolculugu        kirilma aylari");
    liste.forEach(function (p) {
      var a = analiz(p.tutar);
      var yol = [yuzde(a.ilkDilim)].concat(a.kirilmalar.map(function (k) { return yuzde(k.yeni); }));
      console.log(String(fm0(p.tutar)).padStart(9) + "  " +
        (KALICI.indexOf(p.tutar) > -1 ? "dizinde " : "noindex ").padEnd(10) +
        yol.join(" -> ").padEnd(23) +
        a.kirilmalar.map(function (k) { return k.ay; }).join(", "));
    });
    return 0;
  }

  KALICI.forEach(function (t) {
    if (!YORUM[t]) {
      console.error("HATA: " + t + " KALICI listesinde ama YORUM metni yok.");
      console.error("Elle yazilmis yorum olmadan sayfa digerlerinin kopyasi olur.");
      process.exit(2);
    }
  });

  liste.forEach(function (p) {
    var indexlensin = KALICI.indexOf(p.tutar) > -1;
    var eski = fs.readFileSync(p.yol, "utf8");
    var yeni = guncelle(eski, indexlensin ? blok(analiz(p.tutar)) : "", indexlensin);
    if (yeni !== eski) {
      degisen.push(p.ad);
      if (!kontrol) fs.writeFileSync(p.yol, yeni, "utf8");
    }
  });

  /* sitemap: noindex sayfalar sitemap'te durmamali - celiskili sinyal olur */
  var smYol = path.join(KOK, "sitemap.xml");
  var sm = fs.readFileSync(smYol, "utf8");
  var sitemapSorun = [];
  liste.forEach(function (p) {
    var url = "https://korayoner.dev/maas-hesaplama/" + p.ad + "/";
    var icinde = sm.indexOf("<loc>" + url + "</loc>") > -1;
    var olmali = KALICI.indexOf(p.tutar) > -1;
    if (icinde !== olmali) sitemapSorun.push((olmali ? "eksik: " : "fazla: ") + p.ad);
  });

  if (kontrol) {
    if (degisen.length || sitemapSorun.length) {
      if (degisen.length) {
        console.error("Maas sayfalari guncel degil (" + degisen.length + "):");
        degisen.forEach(function (a) { console.error("  - " + a); });
      }
      if (sitemapSorun.length) {
        console.error("Sitemap ile noindex uyusmuyor:");
        sitemapSorun.forEach(function (a) { console.error("  - " + a); });
      }
      console.error("Duzeltmek icin: node tools/maas-sayfalari.js");
      return 1;
    }
    console.log("Maas sayfalari guncel (" + KALICI.length + " dizinde, " +
      (liste.length - KALICI.length) + " noindex).");
    return 0;
  }

  console.log(degisen.length + " sayfa guncellendi (" + KALICI.length + " dizinde, " +
    (liste.length - KALICI.length) + " noindex).");
  if (sitemapSorun.length) {
    console.log("\nSitemap elle duzeltilmeli:");
    sitemapSorun.forEach(function (a) { console.log("  - " + a); });
  }
  return 0;
}

process.exit(main());
