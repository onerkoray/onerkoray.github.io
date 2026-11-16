#!/usr/bin/env node
/*
 * Kasım 2026: emekli artışının yaşa ve prim gününe göre farklılaşması
 * gündemi için iki yazının gövdesi ve grafikleri:
 *   makaleler/emekli-yas-haritasi-2025        (yas.js, yas-2025.json)
 *   makaleler/prim-gunune-gore-emekli-artisi  (gun.js)
 * Rakamların hepsi modüllerden gelir. Kişi adı yazılmaz; yalnız kurum.
 *
 * Kullanım:
 *   node tools/emekli-farklilastirma-yazilari.js           # yaz
 *   node tools/emekli-farklilastirma-yazilari.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var Y = require(path.join(KOK, "makaleler", "emekli-yas-haritasi-2025", "yas.js"));
var I = require(path.join(KOK, "makaleler", "emekliye-ilave-iyilestirme-ocak-2027", "iyilestirme.js"));
var G = require(path.join(KOK, "makaleler", "prim-gunune-gore-emekli-artisi", "gun.js"));

function v1(x) { return x.toFixed(1).replace(".", ","); }
function y1(o) { return "%" + v1(o * 100); }
function tl(x) { return Math.round(x).toLocaleString("tr-TR"); }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarihAd(iso) { return AYLAR[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4); }
function mly(x) { return (Math.round(x / 1e8) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); } // TL → milyar, bir ondalık
function mln(x) { return (Math.round(x / 1e4) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } // kişi → milyon, iki ondalık
var KAPSAM_AD = { "4a": "4/a (SSK)", "4b": "4/b (Bağ-Kur)", "4c": "4/c (memur)" };

function tablo(baslik, basliklar, satirlar) {
  return '<div class="table-scroll"><table class="data-table">\n<caption>' + baslik + "</caption>\n<thead><tr>" +
    basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + b + "</th>"; }).join("") + "</tr></thead>\n<tbody>\n" +
    satirlar.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return i ? '<td class="num">' + c + "</td>" : '<th scope="row">' + c + "</th>"; }).join("") + "</tr>";
    }).join("\n") + "\n</tbody></table></div>";
}
function sekil(kimlik, baslik, alt, svg, dipnot) {
  return '<figure class="ed-grafik" aria-labelledby="' + kimlik + '-b">\n<p class="ed-grafik-baslik" id="' + kimlik + '-b">' + baslik + '</p>\n<p class="ed-grafik-alt">' + alt +
    '</p>\n<div class="ed-grafik-kap">' + svg + "</div>\n<figcaption>" + dipnot + "</figcaption>\n</figure>";
}
function kap(kimlik, W, H, baslik, tanim, govde) {
  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="' + kimlik + "-t " + kimlik + '-d"><title id="' + kimlik + '-t">' + baslik + '</title><desc id="' + kimlik + '-d">' + tanim + "</desc>" + govde + "</svg>";
}

/* ------------------------------------------------ grafikler */

/* Tek yaşa göre yaşlılık aylığı alanlar; renk tasarımın üç yaş kademesi. */
function yasGrafik() {
  var d = Y.yasDizisi(), W = 640, H = 300, SOL = 56, SAG = 620, UST = 20, ALT = 250, A0 = 30, A1 = 100, Y1 = 500000;
  var gen = (SAG - SOL) / (A1 - A0 + 1);
  function x(a) { return SOL + (a - A0) * gen; }
  function y(v) { return ALT - v / Y1 * (ALT - UST); }
  var g = "";
  [0, 100000, 200000, 300000, 400000, 500000].forEach(function (t) {
    g += '<path class="' + (t === 0 ? "sifir" : "izgara") + '" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + (t / 1000) + " bin</text>";
  });
  for (var a = A0; a <= A1; a++) {
    var sinif = a < 55 ? "seri-1" : a < 65 ? "seri-2" : "seri-3";
    g += '<rect class="' + sinif + '" x="' + (x(a) + 0.6).toFixed(1) + '" y="' + y(d[a]).toFixed(1) + '" width="' + (gen - 1.2).toFixed(1) + '" height="' + (ALT - y(d[a])).toFixed(1) + '"/>';
  }
  [30, 40, 50, 55, 60, 65, 70, 80, 90, 100].forEach(function (a) { g += '<text class="kucuk" x="' + (x(a) + gen / 2).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + a + "</text>"; });
  var med = Y.ortanca();
  g += '<path class="esik" d="M' + (x(med) + gen / 2).toFixed(1) + " " + UST + " V" + ALT + '"/><text class="esik-yazi" x="' + (x(med) + gen / 2 + 6).toFixed(1) + '" y="' + (UST + 12) + '">ortanca ' + med + "</text>";
  var K = Y.tasarimlar().kademeli.kademeler;
  g += '<text class="deger" x="' + x(36).toFixed(1) + '" y="' + (UST + 40) + '">55 altı ' + y1(K[0].oran) + '</text>';
  g += '<text class="deger" x="' + x(36).toFixed(1) + '" y="' + (UST + 58) + '">55–64 ' + y1(K[1].oran) + '</text>';
  g += '<text class="deger" x="' + x(36).toFixed(1) + '" y="' + (UST + 76) + '">65 ve üzeri ' + y1(K[2].oran) + "</text>";
  return kap("yas-dagilim", W, H, "Yaşlılık aylığı alanlar, tek yaşa göre, 2025 sonu",
    "Toplam " + tl(Y.toplam()) + " kişi; ortanca yaş " + med + "; 55 altı " + y1(K[0].oran) + ", 55–64 " + y1(K[1].oran) + ", 65 ve üzeri " + y1(K[2].oran) + ". En kalabalık yaş " + enKalabalik().yas + " (" + tl(enKalabalik().kisi) + " kişi).", g);
}
function enKalabalik() {
  var d = Y.yasDizisi(), m = 0;
  for (var a = 1; a <= 100; a++) if (d[a] > d[m]) m = a;
  return { yas: m, kisi: d[m] };
}

/* Kanunun aradığı en az prim günü, ilk girişe göre (4/a tam aylık). */
function gunGrafik() {
  var W = 640, H = 300, SOL = 56, SAG = 620, UST = 20, ALT = 250, X0 = 1975, X1 = 2012, Y0 = 4500, Y1 = 7500;
  function x(v) { return SOL + (v - X0) / (X1 - X0) * (SAG - SOL); }
  function y(v) { return ALT - (v - Y0) / (Y1 - Y0) * (ALT - UST); }
  var g = "";
  [4500, 5000, 5500, 6000, 6500, 7000, 7500].forEach(function (t) {
    g += '<path class="izgara" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + tl(t) + "</text>";
  });
  [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010].forEach(function (t) { g += '<text class="kucuk" x="' + x(t).toFixed(1) + '" y="' + (ALT + 18) + '" text-anchor="middle">' + t + "</text>"; });
  function hat(cins) {
    var s = G.seri(cins, X0, X1), p = [];
    s.forEach(function (r, i) {
      var xx = x(+r.giris.slice(0, 4)), yy = y(r.tam);
      if (i) p.push("H" + xx.toFixed(1)); else p.push("M" + xx.toFixed(1) + " " + yy.toFixed(1));
      p.push("V" + yy.toFixed(1));
    });
    return p.join(" ");
  }
  g += '<path class="esik" d="M' + SOL + " " + y(G.ESIK).toFixed(1) + " H" + SAG + '"/><text class="esik-yazi" x="' + (SOL + 6) + '" y="' + (y(G.ESIK) - 6).toFixed(1) + '">Varsayımsal eşik ' + tl(G.ESIK) + " gün</text>";
  g += '<path class="cizgi-1" d="' + hat("erkek") + '"/><path class="cizgi-2" d="' + hat("kadin") + '"/>';
  g += '<path class="esik" d="M' + x(1999.69).toFixed(1) + " " + UST + " V" + ALT + '"/><text class="esik-yazi" x="' + (x(1999.69) - 6).toFixed(1) + '" y="' + (UST + 12) + '" text-anchor="end">8 Eylül 1999</text>';
  g += '<text class="yazi-1" x="' + x(1976).toFixed(1) + '" y="' + (y(5000) - 10).toFixed(1) + '">Erkek</text>';
  g += '<text class="yazi-2" x="' + x(1985.4).toFixed(1) + '" y="' + (y(5000) + 18).toFixed(1) + '">Kadın</text>';
  var s = G.sinirlar();
  return kap("gun-esik", W, H, "4/a tam aylık için kanunun aradığı en az prim günü, ilk girişe göre",
    "1999 öncesi girişte 5.000 ile 5.975 gün; 8 Eylül 1999'dan sonra " + tl(s[1].erkek.tam) + ", 1 Mayıs 2008'den sonra " + tl(s[3].erkek.tam) + " gün.", g);
}

/* ------------------------------------------------ yaş yazısı */

function yasGovde() {
  var N = Y.toplam(), med = Y.ortanca(), T = Y.tasarimlar(), K = T.kademeli.kademeler, O = Y.kapsamOzeti(), F = Y.tutarFonksiyonlari();
  var maliyet = Y.yillikMaliyet(), hak = Y.aylikAlanlar() - N, ek = enKalabalik();
  var o = {}; O.forEach(function (r) { o[r.kapsam] = r; });
  var out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Kural henüz yok.</strong> Ek artışın yaşa ve prim ödeme gün sayısına göre ayrışabileceği TBMM Plan ve Bütçe Komisyonu'ndaki bütçe görüşmelerinde dile getirildi. Hangi yaşın ne alacağı, oran ya da tutar açıklanmadı. Çalışmanın Aralık'ta bitmesi bekleniyor.</p>\n" +
    "<p><strong>Yaş haritası belli.</strong> SGK'nın 2025 yıllığına göre yıl sonunda " + mln(N) + " milyon kişi yaşlılık aylığı alıyordu. Ortanca yaş " + med + ". Bu kişilerin " + y1(Y.altmisAlti()) + "'i 60 yaşın altında, " + y1(T.yalniz65.pay) + "'i 65 ve üzerinde.</p>\n" +
    "<p><strong>Yaş kuralı fonları kapsamlar arasında da kaydırır.</strong> 65 ve üzerinin payı 4/a'da " + y1(o["4a"].pay65) + ", 4/b'de " + y1(o["4b"].pay65) + ", 4/c'de " + y1(o["4c"].pay65) + ". Herkese eşit 1.000 TL'nin bütçesi yalnız 65 ve üzerine verilirse kişi başı " + tl(T.yalniz65.tutar) + " TL olur. O zaman SSK emeklisinin ortalaması " + tl(Y.kapsamOrtalamasi("4a", F.yalniz65)) + " TL'ye iner; Bağ-Kur'da " + tl(Y.kapsamOrtalamasi("4b", F.yalniz65)) + ", memurda " + tl(Y.kapsamOrtalamasi("4c", F.yalniz65)) + " TL'ye çıkar.</p>\n</div>");

  out.push('<h2 id="ne-soylendi">Ne söylendi, ne söylenmedi?</h2>\n' +
    "<p>2027 bütçesinin Komisyon görüşmelerinde iki kurum emekliler için konuştu. Çalışma ve Sosyal Güvenlik Bakanlığı 3 Kasım'da yasal zamların üstüne bir iyileştirme üzerinde çalışıldığını söyledi; bu konuyu <a href=\"../emekliye-ilave-iyilestirme-ocak-2027/\">ilave iyileştirme yazısında</a> ölçtük. Hazine ve Maliye Bakanlığı 5 Kasım'daki oturumda üç şey söyledi. Komisyonun <a href=\"https://www.tbmm.gov.tr/Tutanaklar/TutanakGoster/5487\">5 Kasım tutanağına</a> (s.74, incelenmemiş tutanak) göre düzenleme tüm emeklileri kapsayacak. Artışın yaşa ve prim ödeme gün sayısına göre farklılaşması daha adil bulunuyor. Artış seyyanen olsa bile bu ayrım gözetilecek. Rakam verilmedi; nihai çalışmanın büyük ihtimalle Aralık'ta yapılıp bütçeden hemen sonra Meclis'e getirileceği söylendi.</p>\n" +
    "<p>Söylenmeyenler daha çok: yaş sınırları, kademe sayısı, oran ya da tutar ve yürürlük tarihi. Bu yazı bunların hiçbirini tahmin etmiyor. Yaptığı şey, yaşa bağlanacak herhangi bir kuralın kime dokunacağını bugünkü veriyle göstermek.</p>");

  out.push('<h2 id="harita">Emekliler kaç yaşında?</h2>\n' +
    "<p>SGK İstatistik Yıllığı her kapsam için aylık alanları tek yaşa göre veriyor. Aşağıda yalnız yaşlılık aylığı alanlar var: 4/a, 4/b (tarım dahil) ve 4/c toplamı. En kalabalık tek yaş " + ek.yas + "; o yaşta " + tl(ek.kisi) + " kişi aylık alıyor.</p>\n" +
    tablo("Yaşlılık aylığı alanlar, yaş grubuna göre, 2025 sonu", ["Yaş", "Kişi", "Pay"],
      Y.bantlar().map(function (b) { return [b.alt === 0 ? "50 altı" : b.ust === 100 ? b.alt + " ve üzeri" : b.alt + "–" + b.ust, tl(b.kisi), y1(b.pay)]; }).concat([["Toplam", tl(N), "%100,0"]])) + "\n" +
    sekil("yas-dagilim", "Ortanca emekli " + med + " yaşında; 60 altı " + y1(Y.altmisAlti()), "Tek yaşa göre yaşlılık aylığı alan kişi. Renkler aşağıdaki kademeli tasarımın üç yaş grubu.", yasGrafik(),
      "Kaynak: SGK İstatistik Yıllığı 2025, Tablo 2.7, 2.21 ve 2.33; yalnız yaşlılık aylığı sütunları. 30 yaş altında yaşlılık aylığı alan yok.") + "\n" +
    "<p>Dağılımın sol omzu dikkat çekiyor: 43 ile 60 yaş arası, normalde emekli olunmayacak yaşlar. Bu, 1999 öncesi girişliler için yaş şartının 2023'te kaldırılmasının izi (5510 Geçici m.95). O kuşak yaşa göre bir artışta en genç grubu oluşturuyor. Aynı kuşağın kanunen daha az prim günüyle emekli olabildiği de doğru; bunu <a href=\"../prim-gunune-gore-emekli-artisi/\">prim günü yazısında</a> ayrıca hesapladık.</p>");

  out.push('<h2 id="kapsam">SSK, Bağ-Kur ve memur emeklisinin yaşı farklı</h2>\n' +
    "<p>Yaşa bağlanan bir kural, kapsamlar arasında da bir dağıtım kararıdır. Çünkü üç kapsamın yaş yapısı birbirinden çok farklı:</p>\n" +
    tablo("Kapsama göre yaşlılık aylığı alanlar, 2025 sonu", ["Kapsam", "Kişi", "Ortanca yaş", "55 altı", "65 ve üzeri"],
      O.map(function (r) { return [KAPSAM_AD[r.kapsam], tl(r.kisi), String(r.ortanca), y1(r.alti55), y1(r.pay65)]; })) + "\n" +
    "<p>4/a'da ortanca " + o["4a"].ortanca + ", 4/b ve 4/c'de " + o["4b"].ortanca + ". SSK emeklilerinin " + y1(o["4a"].alti55) + "'i 55'in altında; Bağ-Kur'da bu pay " + y1(o["4b"].alti55) + ", memurda " + y1(o["4c"].alti55) + ". Yaş eşiği yükseldikçe pay 4/b ve 4/c'ye kayar.</p>");

  out.push('<h2 id="tasarimlar">Aynı bütçe, üç dağıtım</h2>\n' +
    "<p>Karşılaştırmayı adil kılmak için bütçe sabit tutuldu: her yaşlılık aylığı alana ayda 1.000 TL eşit artış. Bunun yıllık maliyeti " + tl(N) + " kişi × 1.000 TL × 12 = <strong>" + mly(maliyet) + " milyar TL</strong>. 1.000 TL bir tahmin değil, ölçü birimi; gerçek tutar ne olursa oranlar aynı kalır. <a href=\"../emekliye-ilave-iyilestirme-ocak-2027/\">İlave iyileştirme yazısında</a> aynı 1.000 TL'yi yılda " + mly(I.seyyanenMaliyeti() * 1e6) + " milyar TL bulmuştuk; fark sayılan birimde. Orada malullük ve ölüm aylıkları dahil " + mln(I.dosya(2025)) + " milyon dosya, burada yalnız yaşlılık aylığı alan kişi sayıldı. Üç <strong>varsayımsal</strong> dağıtım:</p>\n<ul>" +
    "<li><strong>Eşit:</strong> herkese 1.000 TL.</li>" +
    "<li><strong>Yalnız 65 ve üzeri:</strong> aynı para yalnız " + tl(T.yalniz65.kisi) + " kişiye; kişi başı " + tl(T.yalniz65.tutar) + " TL. " + tl(T.yalniz65.disarida) + " kişi hiç almaz.</li>" +
    "<li><strong>Kademeli 1:2:3:</strong> 55 altı bir pay, 55–64 iki pay, 65 ve üzeri üç pay. Bir pay " + tl(T.kademeli.birim) + " TL.</li></ul>\n" +
    tablo("Kişi başı aylık artış, TL (aynı bütçe)", ["Yaş grubu", "Kişi", "Eşit", "Yalnız 65+", "Kademeli 1:2:3"],
      K.map(function (k) {
        var ad = k.alt === 0 ? "55 altı" : k.ust === 100 ? "65 ve üzeri" : "55–64";
        return [ad, tl(k.kisi), "1.000", k.alt >= 65 ? tl(T.yalniz65.tutar) : "0", tl(k.tutar)];
      })) + "\n" +
    tablo("Kapsamın ortalama aylık artışı, TL (aynı bütçe)", ["Kapsam", "Eşit", "Yalnız 65+", "Kademeli 1:2:3"],
      Y.KAPSAMLAR.map(function (k) { return [KAPSAM_AD[k], "1.000", tl(Y.kapsamOrtalamasi(k, F.yalniz65)), tl(Y.kapsamOrtalamasi(k, F.kademeli))]; })) + "\n" +
    "<p>Eşit dağıtımda her kapsamın ortalaması 1.000 TL. Yaş ağırlığı arttıkça 4/a'nın ortalaması düşer, 4/b ve 4/c'ninki yükselir. Bunun nedeni kapsamlara göre bir tercih değil, yaş yapısı. Ama sonuç, kuralın adı ne olursa olsun, kapsamlar arası bir aktarımdır.</p>");

  out.push('<h2 id="yasin-soylemedigi">Yaş neyi söylemez?</h2>\n<ul>' +
    "<li><strong>Aylığın düzeyini.</strong> Tabandaki emekli her yaşta var. Yaş, ihtiyacın değil, sigortalılık geçmişinin bir göstergesi. 65 yaşındaki yüksek aylıklı da, 50 yaşındaki taban aylıklı da kendi grubunun tutarını alır.</li>" +
    "<li><strong>Hak sahiplerini.</strong> Malullük ve ölüm aylığı alanlar bu tablolara girmedi. 2025 sonunda yaşlılık dışında aylık alan " + mln(hak) + " milyon kişi daha var; ölüm aylığı alanların bir kısmı çocuk. Yaşa bağlı bir kuralın onlara nasıl uygulanacağı ayrı bir karar.</li>" +
    "<li><strong>Dosya sayısını.</strong> Burada kişi sayıldı. Birden fazla aylığı olan kişi ödemede birden fazla dosya demek; bütçe hesabı dosya üzerinden yapılırsa rakam büyür.</li></ul>");

  out.push('<h2 id="takvim">Bundan sonra</h2>\n<ul>' +
    "<li><strong>Aralık:</strong> Çalışmanın tamamlanması ve bütçe sonrası bir kanun teklifi bekleniyor. Metin gelince bu yazı seçilen yaş sınırlarıyla yeniden hesaplanır.</li>" +
    "<li><strong>4 Ocak 2027:</strong> Aralık TÜFE'si ile yasal zam kesinleşir; <a href=\"../ocak-2027-emekli-zammi/\">Ocak 2027 emekli zammı</a> yazısı kendini günceller.</li>" +
    "<li><strong>Kendi aylığınız:</strong> <a href=\"../../emekli-zammi-hesaplama/\">emekli zammı hesaplama</a> aracı yalnız yasal zamı hesaplar; açıklanmamış bir iyileştirmeyi eklemez.</li></ul>");

  out.push('<h2 id="varsayim">Varsayımlar ve sınırlar</h2>\n<ul>' +
    "<li>Üç dağıtım da <strong>varsayımsaldır</strong>; hiçbiri açıklanmış bir kural değil. Ölçü birimi ayda 1.000 TL eşit artıştır.</li>" +
    "<li>Veri 2025 yıl sonu kişi sayısıdır. 2026'da bağlanan ve ölen emekliler dahil değil; oranlar yıl içinde yavaş değişir.</li>" +
    "<li>Yalnız yaşlılık aylığı alanlar sayıldı. Malullük ve ölüm aylığı alanlar ile vatani görev ödemeleri dışarıda.</li>" +
    "<li>Yaş, tablonun tek yaş satırıdır; kuralın yaşı hangi tarihe göre sayacağı bilinmiyor.</li></ul>");
  out.push('<h2 id="kaynaklar">Kaynaklar</h2>\n<ul>' +
    '<li><a href="https://www.sgk.gov.tr/Istatistik/Yillik/fcd5e59b-6af9-4d90-a451-ee7500eb1cb4/" rel="noopener">SGK İstatistik Yıllığı 2025</a>, Bölüm 2: Tablo 2.7 (4/a), 2.21 (4/b) ve 2.33 (4/c), yaşa ve cinsiyete göre aylık alanlar (16 Kasım 2026\'da indirildi)</li>' +
    '<li><a href="https://www.tbmm.gov.tr/Tutanaklar/TutanakGoster/5487" rel="noopener">TBMM Plan ve Bütçe Komisyonu tutanağı</a>, 5 Kasım 2026, Hazine ve Maliye Bakanlığı bütçesi, s.74 (incelenmemiş tutanak)</li>' +
    '<li><a href="https://www.csgb.gov.tr/cgm/haberler/03112026/" rel="noopener">Çalışma ve Sosyal Güvenlik Bakanlığı, 2027 bütçe sunumu</a>, TBMM Plan ve Bütçe Komisyonu, 3 Kasım 2026</li>' +
    '<li>5510 sayılı Kanun Geçici m.95: <a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=5510&amp;MevzuatTur=1&amp;MevzuatTertip=5" rel="noopener">mevzuat.gov.tr</a></li></ul>');
  out.push("<h2>Sık sorulan sorular</h2>\n" +
    "<details><summary>Emekli zammı yaşa göre mi verilecek?</summary><p>Henüz kural yok. Hazine ve Maliye Bakanlığı 5 Kasım 2026'da artışın yaşa ve prim ödeme gün sayısına göre farklılaşmasının doğru olacağını söyledi. Yaş sınırı, oran ve tutar açıklanmadı; metnin Aralık'ta gelmesi bekleniyor.</p></details>\n" +
    "<details><summary>Kaç emekli 65 yaşın üstünde?</summary><p>SGK'nın 2025 yıl sonu verisine göre " + tl(T.yalniz65.kisi) + " kişi. Bu, yaşlılık aylığı alanların " + y1(T.yalniz65.pay) + "'i.</p></details>\n" +
    "<details><summary>Yaşa göre artış Bağ-Kur ve memur emeklisine daha çok mu gider?</summary><p>Yaş yapısı nedeniyle evet. 65 ve üzerinin payı 4/a'da " + y1(o["4a"].pay65) + ", 4/b'de " + y1(o["4b"].pay65) + ", 4/c'de " + y1(o["4c"].pay65) + ". Yaşı yüksek kapsamın kişi başı ortalaması yükselir.</p></details>");

  return out.join("\n\n");
}

/* ------------------------------------------------ prim günü yazısı */

function gunGovde() {
  var s = G.sinirlar(), a4 = G.yasAlti("4a"), b4 = G.yasAlti("4b"), E = G.ESIK, B = G.tablolar.b81;
  var enAzE = B.erkek.satirlar[0][1], enCokE = B.erkek.satirlar[B.erkek.satirlar.length - 1][1];
  var out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Gün eşiği de oran da belli değil.</strong> Artışın prim ödeme gün sayısına göre farklılaşması bir yaklaşım olarak dile getirildi; metin Aralık'ta bekleniyor.</p>\n" +
    "<p><strong>Kanun herkesten aynı günü istemedi.</strong> 4/a'da tam aylık için aranan gün ilk girişe göre değişiyor: 1999 öncesinde " + tl(enAzE) + " ile " + tl(enCokE) + ", 1999–2008 arasında " + tl(s[1].erkek.tam) + ", 2008 sonrasında " + tl(s[3].erkek.tam) + ". 1999 öncesi girişli yaş şartıyla " + tl(s[0].erkek.kismi) + " günle de bağlanabiliyordu.</p>\n" +
    "<p><strong>Bu kuralla emekli olan kalabalık.</strong> 2025 sonunda 4/a'da yaşlılık aylığı alanların " + mln(a4.toplam) + " milyonu (" + y1(a4.pay) + ") 58 (kadın) ve 60 (erkek) yaşın altındaydı. 1999 sonrası girişli, engellilik, maden, erken yaşlanma ve yıpranma gibi özel hükümler dışında, bu yaşta yaşlılık aylığı alamaz. Bu yüzden grubun büyük bölümü 1999 öncesi kurallarla bağlanmış. 7.200 gün şartıyla tam aylık alan ise henüz yok: 1 Mayıs 2008'de giren, yılda 360 gün ödese bile 7.200'e " + tarihAd(G.ilk7200()) + "'te ulaşır. " + tl(E) + " günlük bir eşik, kanunun en azını ödeyip emekli olanı " + tl(E - enCokE) + " ile " + tl(E - enAzE) + " gün geride bırakır.</p>\n</div>");

  out.push('<h2 id="gundem">Gündemde ne var?</h2>\n' +
    "<p>Hazine ve Maliye Bakanlığı, 2027 bütçesinin TBMM Plan ve Bütçe Komisyonu'ndaki 5 Kasım oturumunda ek artışın yaş ve prim ödeme gün sayısına göre ayrışmasını doğru bulduğunu söyledi. Komisyon tutanağına göre bu ayrım seyyanen bir artışta da gözetilecek. Gün sınırı, kademe ya da tutar verilmedi. Yaş boyutunu <a href=\"../emekli-yas-haritasi-2025/\">emeklilerin yaş haritası</a> yazısında SGK verisiyle ölçtük. Bu yazı prim gününe bakıyor.</p>\n" +
    "<p>Prim günü ilk bakışta adil bir ölçüt gibi görünür: çok prim ödeyen çok alsın. Ama bir emeklinin dosyasındaki gün sayısı yalnız ne kadar çalıştığını değil, hangi kurala tabi olduğunu da yansıtır.</p>");

  var satirlar = [
    ["1999 öncesi, tam aylık (EYT)", tl(enAzE) + "–" + tl(enCokE), "506 s.K. Geçici m.81/B; yaş şartı Geçici m.95 ile kalktı"],
    ["1999 öncesi, yaştan aylık", tl(s[0].erkek.kismi), "506 s.K. Geçici m.81/C; 15 yıl ve yaş"],
    ["8 Eylül 1999 – 30 Nisan 2008", tl(s[1].erkek.tam), "5510 s.K. Geçici m.9/1; kadın 58, erkek 60 yaş (ya da 25 yıl ve 4.500 gün)"],
    ["1 Mayıs 2008 ve sonrası", tl(s[3].erkek.tam), "5510 s.K. m.28/2; kadın 58, erkek 60 yaş, 2036'dan sonra kademeli 65"]
  ];
  out.push('<h2 id="kanun">Emekli olmak için kaç gün gerekti?</h2>\n' +
    "<p>4/a (SSK) sigortalısı için tam yaşlılık aylığının gün şartı, ilk sigorta girişinin tarihine bağlı. 1999 öncesinde gün sayısı, kişinin 23 Mayıs 2002'deki sigortalılık süresine göre kademelenir: o tarihte süresi uzun olan daha az gün öder.</p>\n" +
    tablo("4/a yaşlılık aylığı için en az prim günü, ilk girişe göre", ["İlk giriş", "En az gün", "Dayanak"], satirlar) + "\n" +
    sekil("gun-esik", "8 Eylül 1999'da şart bir günde " + tl(s[1].erkek.tam - enCokE) + " gün arttı", "İlk giriş yılına göre tam aylığın aradığı en az gün (her yılın 1 Haziran girişi). Kesikli çizgi varsayımsal bir 7.200 gün eşiği.", gunGrafik(),
      "Hesap: sitenin emeklilik tarihi çekirdeği (506 s.K. Geçici m.81, 5510 s.K. Geçici m.9 ve m.28). Kişi girişte 20 yaşında varsayıldı; 18 yaşından önce başlayanlarda süre 18. yaştan sayılır ve satır değişebilir.") + "\n" +
    "<p>Erkekte 1980'den önce girenler " + tl(enAzE) + " günle, 1999'da 8 Eylül'den önce girenler " + tl(enCokE) + " günle tam aylığa hak kazanıyor. 8 Eylül 1999'da sınır " + tl(s[1].erkek.tam) + " güne sıçrıyor, 2008 Mayıs'ında " + tl(s[3].erkek.tam) + "'e çıkıyor. 4/b'de (Bağ-Kur) 1999 öncesinin tam aylık şartı gün değil tam yıl: kadın 20, erkek 25 yıl, yani 7.200 ve 9.000 gün.</p>");

  out.push('<h2 id="kac-kisi">Bu kurallarla emekli olan kaç kişi?</h2>\n' +
    "<p>SGK prim gününe göre emekli dağılımı yayımlamıyor. Ama yaş tablosundan bir alt sınır çıkarılabilir. 1999 sonrası girişlinin yaşlılık aylığı için en erken yaşı kadında 58, erkekte 60. 2025 sonunda bu yaşların altında aylık alan biri, özel hükümler (engelli sigortalı, yeraltı maden, erken yaşlanma, fiili hizmet zammı) dışında, 1999 öncesi kurallarla bağlanmış olmalı.</p>\n" +
    tablo("58 (kadın) / 60 (erkek) yaşın altında yaşlılık aylığı alanlar, 2025 sonu", ["Kapsam", "Erkek", "Kadın", "Toplam", "Kapsam içindeki payı"], [
      ["4/a (SSK)", tl(a4.erkek), tl(a4.kadin), tl(a4.toplam), y1(a4.pay)],
      ["4/b (Bağ-Kur)", tl(b4.erkek), tl(b4.kadin), tl(b4.toplam), y1(b4.pay)]]) + "\n" +
    "<p>Bu bir tahmin ve iki yöne sapar. Özel hükümlerle erken bağlananlar sayıyı büyütür. 1999 öncesi girişli olup 2025'te 58/60'ı geçmiş emekliler ise aynı kurallarla bağlandığı hâlde tabloda ayırt edilemez ve sayıyı küçültür. Yine de 4/a yaşlılık aylıklarının yaklaşık yarısı, emekli olmak için 7.200'den az gün isteyen bir kurala tabiydi; geri kalanın çoğu da 7.000 günlük 1999–2008 kuralına.</p>\n" +
    "<p>4/b satırı ters okunur: 1999 öncesi Bağ-Kur'lunun tam aylık şartı kadında 7.200, erkekte 9.000 gündü. Bu grup 7.200 günlük bir eşiği kanun gereği zaten geçmiş olur.</p>");

  out.push('<h2 id="esik">Gün eşiği koyan bir kural ne yapar?</h2>\n' +
    "<p>Örnek olsun diye <strong>varsayımsal</strong> bir kural: " + tl(E) + " günü aşana ek artış, altında kalana yok. " + tl(E) + " bugün 4/a için tam aylığın şartı, o yüzden akla ilk gelen sınır. Kanunun en azını ödeyip emekli olan biri bu eşiğe göre şöyle durur:</p>\n" +
    tablo("Kanunun en azıyla emekli olan, " + tl(E) + " gün eşiğine göre", ["İlk giriş", "En az gün", "Eşiğe uzaklık"], [
      ["1980 öncesi, erkek", tl(enAzE), "−" + tl(E - enAzE)],
      ["1999 başı, erkek", tl(enCokE), "−" + tl(E - enCokE)],
      ["1999 öncesi, yaştan aylık", tl(s[0].erkek.kismi), "−" + tl(E - s[0].erkek.kismi)],
      ["1999–2008", tl(s[1].erkek.tam), "−" + tl(E - s[1].erkek.tam)],
      ["2008 sonrası", tl(s[3].erkek.tam), "0"]]) + "\n" +
    "<p>Gerçek emekliler en azla sınırlı değil; çoğu fazlasını ödedi. Ama kural, aynı kariyeri farklı yıllarda başlatan iki kişiyi farklı ödüllendirir. Erken girenin kanunen eksik ödediği gün yoktur; şart böyle konmuştu.</p>\n" +
    "<p>Eşik yerine her 360 gün için ek tutar veren kademeli bir kural da düşünülebilir. Onun da maliyeti dışarıdan hesaplanamaz: prim gününe göre emekli sayısı yayımlanmadığı için hangi kademede kaç kişi olduğu bilinmiyor. Yaş için bu hesap yapılabiliyor; prim günü için yapılamıyor.</p>");

  out.push('<h2 id="zaten-var">Prim günü aylığın içinde zaten var</h2>\n' +
    "<p>Bugünkü formül prim gününü zaten ödüllendiriyor: 2008 sonrası sigortalıda her 360 gün bağlama oranına 2 puan ekler. Prim gününe göre bir ek artış bu ödülü ikinci kez verir. Ancak yalnız aylığı en düşük aylığın üstünde olana; tabandakinde fazladan gün bugün de ödenen aylığı değiştirmiyor. Ayrıntısı <a href=\"../bir-yil-daha-calismak-aylik/\">bir yıl daha çalışmak</a> yazısında.</p>\n" +
    "<p>Kısacası prim günü kuralının sonucu üç seçime bağlı: eşik mi kademe mi, ek artış kendi aylığa mı ödenen aylığa mı uygulanır, ve 1999 öncesi kuralla emekli olanın günü kendi şartıyla mı yoksa bugünkü 7.200 ile mi karşılaştırılır. Metin geldiğinde bakılacak yer bu üçü.</p>");

  out.push('<h2 id="varsayim">Varsayımlar ve sınırlar</h2>\n<ul>' +
    "<li>Gün eşiği örneği <strong>varsayımsaldır</strong>; açıklanmış bir sınır değil.</li>" +
    "<li>Gün şartları 4/a tam yaşlılık aylığı içindir. Grafik her yılın 1 Haziran girişini ve girişte 20 yaşı varsayar. 18 yaşından önce başlayanda süre 18. yaştan sayılır ve satır kayabilir.</li>" +
    "<li>Yaş sınırının altında aylık alanlar bir tahmindir. Engelli sigortalı, yeraltı maden, erken yaşlanma ve fiili hizmet zammı hükümleriyle erken bağlanan 1999 sonrası girişliler ayrılamaz (sayıyı büyütür); 58/60'ı geçmiş 1999 öncesi girişliler de ayrılamaz (küçültür).</li>" +
    "<li>Kendi emeklilik tarihiniz ve gün şartınız için <a href=\"../../ne-zaman-emekli-olurum/\">ne zaman emekli olurum</a> aracına bakın.</li></ul>");
  out.push('<h2 id="kaynaklar">Kaynaklar</h2>\n<ul>' +
    '<li><a href="https://www.tbmm.gov.tr/Tutanaklar/TutanakGoster/5487" rel="noopener">TBMM Plan ve Bütçe Komisyonu tutanağı</a>, 5 Kasım 2026, s.74 (incelenmemiş tutanak)</li>' +
    '<li>506 sayılı Kanun Geçici m.81: <a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=506&amp;MevzuatTur=1&amp;MevzuatTertip=5" rel="noopener">mevzuat.gov.tr</a></li>' +
    '<li>5510 sayılı Kanun m.28, Geçici m.9 ve Geçici m.95: <a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=5510&amp;MevzuatTur=1&amp;MevzuatTertip=5" rel="noopener">mevzuat.gov.tr</a></li>' +
    '<li><a href="https://www.sgk.gov.tr/Istatistik/Yillik/fcd5e59b-6af9-4d90-a451-ee7500eb1cb4/" rel="noopener">SGK İstatistik Yıllığı 2025</a>, Tablo 2.7 ve 2.21 (16 Kasım 2026\'da indirildi)</li>' +
    "<li>Hesap: sitenin emeklilik tarihi çekirdeği, <a href=\"../../ne-zaman-emekli-olurum/\">ne zaman emekli olurum</a></li></ul>");
  out.push("<h2>Sık sorulan sorular</h2>\n" +
    "<details><summary>Emekli zammı prim gününe göre mi verilecek?</summary><p>Karar yok. 5 Kasım 2026'daki Komisyon oturumunda artışın yaş ve prim ödeme gün sayısına göre ayrışmasının doğru olacağı söylendi. Gün sınırı ve tutar açıklanmadı.</p></details>\n" +
    "<details><summary>EYT'li kaç günle emekli olabiliyordu?</summary><p>4/a'da 1999 öncesi girişli tam aylık için " + tl(enAzE) + " ile " + tl(enCokE) + " gün; sayı 23 Mayıs 2002'deki sigortalılık süresine göre değişir. 15 yıl ve yaş şartıyla " + tl(s[0].erkek.kismi) + " günle de bağlanılabiliyordu.</p></details>\n" +
    "<details><summary>Prim gününe göre kaç emekli var?</summary><p>SGK bu dağılımı yayımlamıyor. Bu yüzden prim gününe bağlı bir artışın maliyeti dışarıdan hesaplanamaz. Yaş tablosundan çıkan tahmin: 4/a'da " + tl(a4.toplam) + " kişinin büyük bölümü 1999 öncesi kurallarla bağlanmış.</p></details>");

  return out.join("\n\n");
}

var YAZILAR = [
  { ad: "Yaş haritası", isaret: "YASHARITA-GOVDE", dosya: path.join(KOK, "makaleler", "emekli-yas-haritasi-2025", "index.html"), govde: yasGovde },
  { ad: "Prim günü", isaret: "PRIMGUN-GOVDE", dosya: path.join(KOK, "makaleler", "prim-gunune-gore-emekli-artisi", "index.html"), govde: gunGovde }
];

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0, kod = 0;
  YAZILAR.forEach(function (w) {
    var bas = "<!-- " + w.isaret + ":BASLANGIC -->", bit = "<!-- " + w.isaret + ":BITIS -->";
    var sx = fs.readFileSync(w.dosya, "utf8"), i = sx.indexOf(bas), j = sx.indexOf(bit);
    if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + w.isaret);
    var yeni = sx.slice(0, i + bas.length) + "\n" + w.govde() + "\n" + sx.slice(j);
    if (kontrol) {
      if (yeni !== sx) { console.log(w.ad + " yazısı güncel değil: node tools/emekli-farklilastirma-yazilari.js"); kod = 1; } else console.log(w.ad + " yazısı güncel.");
    } else if (yeni !== sx) { fs.writeFileSync(w.dosya, yeni, "utf8"); console.log(w.ad + " güncellendi."); } else console.log(w.ad + ": değişiklik yok.");
  });
  return kod;
}

if (require.main === module) process.exit(main());
module.exports = { yasGovde: yasGovde, gunGovde: gunGovde, enKalabalik: enKalabalik };
