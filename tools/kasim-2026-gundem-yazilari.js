#!/usr/bin/env node
/*
 * 23 Kasım 2026 gündemi için iki yazının gövdesi:
 *   makaleler/torba-teklif-gss-borcu-istihdam-tesviki  (teklif.js)
 *   makaleler/enflasyon-raporu-2026-iv-reel-faiz       (oran.js)
 * Rakamların hepsi modüllerden gelir. Kişi ve parti adı yazılmaz; yalnız kurum.
 *
 * Kullanım:
 *   node tools/kasim-2026-gundem-yazilari.js           # yaz
 *   node tools/kasim-2026-gundem-yazilari.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var T = require(path.join(KOK, "makaleler", "torba-teklif-gss-borcu-istihdam-tesviki", "teklif.js"));
var R = require(path.join(KOK, "makaleler", "enflasyon-raporu-2026-iv-reel-faiz", "oran.js"));

function v1(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function v2(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function y1(x) { return "%" + v1(x); }
function y2(x) { return "%" + v2(x); }
function tl(x) { return Math.round(x).toLocaleString("tr-TR"); }
function tl2(x) { return v2(x); }
var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function gun(iso) { return +iso.slice(8, 10) + " " + AYLAR[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4); }
function tablo(baslik, basliklar, satirlar) {
  return '<div class="table-scroll"><table class="data-table">\n<caption>' + baslik + "</caption>\n<thead><tr>" +
    basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + b + "</th>"; }).join("") + "</tr></thead>\n<tbody>\n" +
    satirlar.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return i ? '<td class="num">' + c + "</td>" : '<th scope="row">' + c + "</th>"; }).join("") + "</tr>";
    }).join("\n") + "\n</tbody></table></div>";
}

/* ---------------------------------------------------------------- torba teklif */
function teklifGovde() {
  var b = T.ASGARI_BRUT, K = T.TEKLIF, out = [];
  var t = T.tesvikAylik(b, false), ti = T.tesvikAylik(b, true);
  var m0 = T.isverenMaliyeti(b, false, false), m1 = T.isverenMaliyeti(b, false, true);
  var kb = T.gssKisiBasi(), g60 = T.gss60gAylik();
  var en = T.SURELER[0].ay + T.ISKUR_EK_AY;

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Henüz kanun değil.</strong> " + K.esasNo + " esas numaralı teklif " + gun(K.gelis) + "'te TBMM'ye geldi; " + K.maddeSayisi + " maddenin çoğu enerjiyle ilgili. SGK'yı ilgilendiren üç madde var. Aşağıdaki hesaplar teklifin metnine göre; Genel Kurul'da değişebilir.</p>\n" +
    "<p><strong>Kadın ve genç istihdamı teşviki " + gun(K.tesvikBitisYeni) + "'e uzuyor.</strong> İşverenin sigorta primi hissesini İşsizlik Sigortası Fonu ödüyor. 2026 asgari ücretinde bu ayda <strong>" + tl2(t) + " TL</strong>; asgari ücretli bir çalışanın işverene maliyetini " + y1(T.maliyetDususu(b, false) * 100) + " düşürüyor. Mesleki belgeli bir kadın ya da genç İŞKUR'dan işe alınırsa destek " + en + " ay sürüyor.</p>\n" +
    "<p><strong>2017 öncesi GSS borcu siliniyor.</strong> Kapsam: başka yerden sağlık güvencesi olmadığı için prim borcu yazılan vatandaşlar (5510 m.60/1-g). Borcun aslı, gecikme cezası ve zammı tahsil edilmiyor; ama ödenmiş olan geri verilmiyor. Açıklanan rakamla kişi başı ortalama " + tl2(kb) + " TL; bu bugünkü GSS priminin " + v1(kb / g60) + " ayı.</p>\n</div>");

  out.push('<h2 id="teklif">Teklifte ne var?</h2>\n' +
    "<p>Teklifin adı yenilenebilir enerjiyle başlıyor; maddelerin çoğu rüzgâr ve güneş kapasitesi, doğal gaz ve kurumlar vergisiyle ilgili. Sosyal güvenliği ilgilendiren üç madde var:</p>\n" +
    tablo("Teklifin SGK maddeleri", ["Madde", "Ne değişiyor", "Yürürlük"], [
      ["Madde 3 — 4447 geçici 10", "İstihdam teşvikinin süresi " + gun(K.tesvikBitisEski) + " yerine " + gun(K.tesvikBitisYeni) + "; Cumhurbaşkanı " + gun(K.tesvikYetkiYeni) + "'e kadar uzatabilir", "Yayım tarihi"],
      ["Madde 10 — 5510 geçici 114", gun(K.gssKesim) + " öncesi 60/1-g GSS borcunun tamamının tahsilinden vazgeçilir; ödenen iade edilmez", "Yayım tarihi"],
      ["Madde 2 — 3308 geçici 12", "Çırak ve stajyer ücretine Devlet katkısını uzatma yetkisi her defasında bir eğitim yılı olmak üzere 15 eğitim yılına çıkar", gun(K.stajYuruluk) + "'ten geçerli"]]) + "\n" +
    "<p>Teklif " + gun(K.gelis) + " itibarıyla komisyon aşamasında. Kanunlaşması için Genel Kurul'da kabul edilmesi ve Resmî Gazete'de yayımlanması gerekiyor.</p>");

  out.push('<h2 id="tesvik">İstihdam teşviki işverene ne kazandırır?</h2>\n' +
    "<p>4447 sayılı Kanun'un geçici 10. maddesi 2011'den beri var; teklif yalnız süresini uzatıyor. Kural şu: işe alınan kişi önceki altı ayda sigortalı olmamalı ve işyerinin bir önceki yıl ortalamasına ek istihdam sağlamalı. O zaman işverenin sigorta primi hissesini fon öder. Önce herkese uygulanan genel indirim (5510 m.81/ı; 2026'da imalat dışında " + v1(T.ORANLAR.sgkIsverenIndirim * 100) + ", imalatta " + v1(T.ORANLAR.sgkIsverenIndirimImalat * 100) + " puan) düşülür, teşvik kalan işveren hissesini karşılar. İşsizlik sigortası işveren payı (" + y1(T.ORANLAR.issizlikIsveren * 100) + ") kapsam dışında.</p>\n" +
    tablo("2026 asgari ücretinde (" + tl2(b) + " TL brüt) aylık", ["", "İmalat dışı", "İmalat"], [
      ["İşverenin sigorta primi oranı (indirim sonrası)", y2(T.tesvikOrani(false) * 100), y2(T.tesvikOrani(true) * 100)],
      ["Fonun ödediği teşvik", tl2(t) + " TL", tl2(ti) + " TL"],
      ["İşverene toplam maliyet, teşviksiz", tl2(m0) + " TL", tl2(T.isverenMaliyeti(b, true, false)) + " TL"],
      ["İşverene toplam maliyet, teşvikli", tl2(m1) + " TL", tl2(T.isverenMaliyeti(b, true, true)) + " TL"],
      ["Maliyetteki düşüş", y1(T.maliyetDususu(b, false) * 100), y1(T.maliyetDususu(b, true) * 100)]]) + "\n" +
    "<p>Teşvik prime esas kazanç üzerinden hesaplanır: asgari ücretin iki katı ödenen birinde tutar da iki katına çıkar, oran değişmez. Fondan karşılanan tutar gelir ve kurumlar vergisinde gider yazılamaz.</p>");

  out.push('<h2 id="sure">Kaç ay sürer?</h2>\n' +
    "<p>Süre kişiye göre değişiyor. Kadınlar (18 yaş üstü) ile 18–29 yaş erkekler en uzun süreyi alıyor; belge sahibi olmak süreyi uzatıyor. Bu iki grup İŞKUR'a kayıtlı işsizler arasından alınırsa " + T.ISKUR_EK_AY + " ay daha ekleniyor. Toplamlar 2026 tutarı sabit tutularak hesaplandı; asgari ücret arttıkça gerçek tutar da büyür.</p>\n" +
    tablo("Destek süresi ve 2026 tutarıyla toplam (imalat dışı, asgari ücret)", ["Kim", "Süre", "Toplam", "İŞKUR kayıtlıysa"],
      T.SURELER.map(function (s, i) {
        var ekli = i < 4;
        return [s.grup, s.ay + " ay", tl(T.toplam(s.ay, b, false)) + " TL", ekli ? (s.ay + T.ISKUR_EK_AY) + " ay, " + tl(T.toplam(s.ay + T.ISKUR_EK_AY, b, false)) + " TL" : "—"];
      })) + "\n" +
    "<p>Destekten aynı sigortalı için bir kez yararlanılır. Süre dolmadan işten ayrılan kişi için kalan süre başka işverene geçmez. Kamu ihalesiyle yürüyen işyerleri ve kamu kurumları kapsam dışında. Kendi bordronuzun işverene maliyetini <a href=\"../../isveren-maliyeti-hesaplama/\">işveren maliyeti hesaplama</a> aracında görebilirsiniz.</p>");

  out.push('<h2 id="gss">2017 öncesi GSS borcu: kimin borcu, neden 2017?</h2>\n' +
    "<p>5510 m.60/1-(g), başka hiçbir kapsamda sağlık güvencesi olmayan vatandaşı genel sağlık sigortalısı sayar. Bu kişiler primi kendileri öder; aile içi geliri asgari ücretin üçte birinin altındaysa prim devletçe ödenir. Kanun bu kişiler için resen tescil öngördü; gelir testine başvurmayanlar için prim tahakkuk etti (5510 geçici m.53 bu durumdakilere 2014'te bir başvuru süresi tanımıştı).</p>\n" +
    "<p>Sınır tarih rastgele değil. 23 Şubat 2017 tarihli 6824 sayılı Kanun, bu kişilerin prim matrahını prime esas kazanç alt sınırına bağladı; teklif bu düzenlemeden önceki döneme ait borcu kapatıyor. Gerekçe, daha önceki yapılandırma kanunlarından yararlanamayan ya da yararlanıp ödeyemeyenlerin borç yükünü hafifletmek ve sağlık hizmetine erişimi kolaylaştırmak olarak yazılmış.</p>\n" +
    tablo("Açıklanan rakam ve bugünkü prim", ["", "Tutar"], [
      ["Kapsamdaki kişi (açıklama)", T.GSS_ACIKLAMA.kisi.toLocaleString("tr-TR")],
      ["Toplam borç (açıklama)", tl(T.GSS_ACIKLAMA.tutar) + " TL"],
      ["Kişi başı ortalama", tl2(kb) + " TL"],
      ["2026'da 60/g GSS primi (asgari ücretin " + y1(T.GSS_60G_ORANI * 100) + "'sı)", tl2(g60) + " TL/ay"],
      ["Ortalama borç kaç aylık prime denk", v1(kb / g60) + " ay"]]) + "\n" +
    "<p>Kişi sayısı ve tutar teklif metninde değil, teklif sahiplerinin açıklamasında. Ortalama, borçların çoğunun küçük olduğunu söylemez: dağılım yayımlanmadığı için kaç kişinin borcunun ortalamanın çok üstünde olduğu bilinmiyor. Ödemiş olan geri alamıyor; bu yüzden düzenleme borcunu ödeyenle ödemeyen arasında fark yaratıyor.</p>");

  out.push('<h2 id="staj">Stajyer ücretine Devlet katkısı</h2>\n' +
    "<p>3308 sayılı Kanun'un geçici 12. maddesine göre işletmelerde mesleki eğitim gören, staj ya da tamamlayıcı eğitim yapan öğrencilere ödenen ücretin bir bölümünü Devlet karşılıyor. Teklif, bu uygulamayı uzatma yetkisini her defasında bir eğitim yılı olmak üzere 15 eğitim yılına çıkarıyor ve usul belirleme yetkisini Cumhurbaşkanına veriyor. Madde " + gun(K.stajYuruluk) + "'ten geçerli olacak; katkının tutarını değiştirmiyor.</p>");

  out.push('<h2 id="varsayim">Varsayımlar ve sınırlar</h2>\n<ul>' +
    "<li>Metin <strong>teklif</strong>tir; Genel Kurul'da madde eklenebilir, çıkarılabilir ya da değiştirilebilir.</li>" +
    "<li>Teşvik hesabı 2026 brüt asgari ücreti, %21,75 işveren payı ve m.81/ı indirimiyle yapıldı (bordro parametreleri). Süre toplamları 2026 tutarını sabit tutar.</li>" +
    "<li>Kadın, genç ve belge koşullarının her biri kanunda ayrıca tanımlı; işverenin borcunun olmaması ve bildirgeleri zamanında vermesi de şart. Uygulamada SGK'nın kontrolüne bakın.</li>" +
    "<li>GSS kişi sayısı ve tutarı resmî metinde değil, açıklamadır; sitenin hesabı yalnız ortalamayı bölerek bulur.</li></ul>");

  out.push('<h2 id="kaynaklar">Kaynaklar</h2>\n<ul>' +
    '<li><a href="https://cdn.tbmm.gov.tr/KKBSPublicFile/D28/Y5/T2/WebOnergeMetni/489112eb-d4e7-408b-9b39-41654fa03c70.pdf" rel="noopener">Kanun teklifi ' + K.esasNo + ' ve gerekçesi</a>, TBMM, ' + gun(K.gelis) + ' (madde 2, 3, 10 ve 14)</li>' +
    '<li>4447 sayılı İşsizlik Sigortası Kanunu geçici madde 10: <a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4447&amp;MevzuatTur=1&amp;MevzuatTertip=5" rel="noopener">mevzuat.gov.tr</a>; uzatma için ' + K.cbKarari.no + ' sayılı Cumhurbaşkanı Kararı (RG ' + gun(K.cbKarari.rg) + ')</li>' +
    '<li>5510 sayılı Kanun m.60/1-(g) ve m.82: <a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=5510&amp;MevzuatTur=1&amp;MevzuatTertip=5" rel="noopener">mevzuat.gov.tr</a></li>' +
    '<li>Kişi sayısı ve tutar: teklif sahiplerinin açıklaması, <a href="https://www.aa.com.tr/tr/gundem/enerjiye-ve-sosyal-guvenlige-iliskin-duzenlemeleri-de-iceren-kanun-teklifi-tbmmde/4122582" rel="noopener">Anadolu Ajansı</a>, 12 Kasım 2026</li>' +
    "<li>Hesap: sitenin 2026 bordro parametreleri (asgari ücret, işveren payı, m.81/ı indirimi, 60/g GSS oranı)</li></ul>");

  out.push("<h2>Sık sorulan sorular</h2>\n" +
    "<details><summary>GSS borcum silindi mi?</summary><p>Henüz değil. Teklif kanunlaşırsa 1 Ocak 2017 öncesine ait, 60/1-(g) kapsamındaki ödenmemiş GSS primleri ile gecikme cezası ve zammının tahsilinden vazgeçilecek. Sonraki dönemin borcu bu maddenin kapsamında değil.</p></details>\n" +
    "<details><summary>Daha önce ödediğim GSS borcu geri verilecek mi?</summary><p>Hayır. Teklifin metni, maddenin yayımlandığı tarihe kadar o dönemler için ödenmiş primlerin iade ve mahsup edilmeyeceğini söylüyor.</p></details>\n" +
    "<details><summary>Kadın çalışan teşviki 2027'de var mı?</summary><p>Bugünkü kanunla 31 Aralık 2025'te bitiyordu; Cumhurbaşkanı Kararıyla 31 Aralık 2026'ya uzatıldı. Teklif kanunlaşırsa 31 Aralık 2028'e kadar sürecek ve 2029 sonuna kadar uzatılabilecek.</p></details>");
  return out.join("\n\n");
}

/* ---------------------------------------------------------------- enflasyon raporu */
function raporGovde() {
  var P = R.PPK, H = R.TAHMIN, A = R.ARA_HEDEF, out = [];
  var ex = R.ileriye(), ep = R.gerceklesen(), s = R.stopaj();
  var bb = R.basabasBrut(H[2027]), bb26 = R.basabasBrut(H[2026]);
  var fe = R.fiyatDuzeyi(A.eski), fy = R.fiyatDuzeyi(A.yeni);

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>TCMB'nin kendi tahminiyle reel faiz " + y1(ex) + ".</strong> Politika faizi " + y1(P.faiz) + "; Merkez Bankası 2027 sonu için " + y1(H[2027]) + " enflasyon tahmin ediyor. Bugünkü faiz bu tahmine göre ileriye dönük olarak enflasyonun " + y1(ex) + " üstünde. Geçmiş 12 ayın enflasyonuna (ekim " + y1(R.EKIM_TUFE) + ") göre ise yalnız " + y1(ep) + ".</p>\n" +
    "<p><strong>Hedef yolu yukarı kaydı.</strong> 2027 ara hedefi " + y1(A.eski[2027]) + "'ten " + y1(A.yeni[2027]) + "'e, 2028'inki " + y1(A.eski[2028]) + "'dan " + y1(A.yeni[2028]) + "'e çıktı. 2026 sonunda 100 TL olan bir sepet eski yola göre 2028 sonunda " + v2(fe) + " TL olacaktı, yeni yola göre " + v2(fy) + " TL: fiyat düzeyi " + y1(R.duzeyFarki()) + " daha yüksek.</p>\n" +
    "<p><strong>Mevduatta eşik " + y1(bb) + ".</strong> 6 ay vadeli, yılda iki kez yenilenen bir TL mevduatın %" + v1(s) + " stopajdan sonra 2027 tahmini kadar getiri sağlaması için brüt yıllık faiz en az " + y1(bb) + " olmalı.</p>\n</div>");

  out.push('<h2 id="rapor">Raporda ne değişti?</h2>\n' +
    "<p>TCMB yılda dört kez Enflasyon Raporu yayımlıyor; dördüncüsü " + gun(R.RAPOR.tarih) + "'de çıktı. Ekim ayında yıllık tüketici enflasyonu " + y1(R.EKIM_TUFE) + "'e geriledi ama bir önceki raporun öngördüğü seviyenin biraz üzerinde kaldı. Raporun gösterdiği sebep enerji fiyatları ve Türk lirası cinsinden ithalat fiyatları varsayımındaki artış.</p>\n" +
    tablo("TCMB enflasyon tahminleri ve ara hedefler, yıl sonu", ["Yıl", "Tahmin (ER 2026-IV)", "Ara hedef (yeni)", "Ara hedef (önceki)"], [
      ["2026", y1(H[2026]), y1(A.yeni[2026]), y1(A.eski[2026])],
      ["2027", y1(H[2027]), y1(A.yeni[2027]), y1(A.eski[2027])],
      ["2028", y1(H[2028]), y1(A.yeni[2028]), y1(A.eski[2028])],
      ["2029", y1(H[2029]), "—", "—"]]) + "\n" +
    "<p>2026 tahmini (" + y1(H[2026]) + ") hedefin (" + y1(A.yeni[2026]) + ") " + v1(H[2026] - A.yeni[2026]) + " puan üstünde; 2027 ve 2028'de tahmin ve yeni ara hedef aynı. Orta vadeli hedef değişmedi: " + y1(H.ortaVade) + ". TCMB ikinci rapordan beri tahmin aralığı paylaşmıyor; belirsizliği aralık yerine risklerin anlatımıyla veriyor. Bu yüzden tabloda tek bir sayı var, bir aralık değil.</p>");

  out.push('<h2 id="reel-faiz">Reel faiz hangi enflasyona göre?</h2>\n' +
    "<p>Reel faiz, nominal faizin enflasyondan arındırılmış hâlidir: (1 + faiz) / (1 + enflasyon) − 1. Sonuç hangi enflasyonun kullanıldığına göre çok değişiyor:</p>\n" +
    tablo("Politika faizi " + y1(P.faiz) + " ile reel faiz", ["Kullanılan enflasyon", "Enflasyon", "Reel faiz"], [
      ["Geçmiş 12 ay (ekim TÜFE)", y1(R.EKIM_TUFE), y1(ep)],
      ["2026 sonu tahmini", y1(H[2026]), y1(R.reel(P.faiz, H[2026]))],
      ["2027 sonu tahmini", y1(H[2027]), y1(ex)]]) + "\n" +
    "<p>Geçmişe göre ölçülen (<em>ex post</em>) reel faiz, bugünkü faizin geçen yılın enflasyonuna göre konumunu söyler. Para politikasının duruşu için bakılan ise ileriye dönük (<em>ex ante</em>) reel faizdir: borç alan ve verenin önündeki yıl için beklediği enflasyona göre. Enflasyon düşerken ikisi arasındaki fark büyür. Aylık seyri <a href=\"https://veri.korayoner.dev/hesap/reel-politika-faizi\">Türkiye Verisi'ndeki reel politika faizi</a> sayfasında BIS verisiyle izlenebilir.</p>\n" +
    "<p>Faiz " + gun(P.tarih) + "'de " + y1(P.onceki) + "'den " + y1(P.faiz) + "'ya indirildi; bir sonraki karar " + gun(P.sonraki) + "'da. TCMB, adımların enflasyonun gidişatına göre toplantı bazında belirleneceğini söylüyor. Faiz indirilirse ileriye dönük reel faiz, tahmin aynı kaldıkça aynı oranda daralır.</p>");

  out.push('<h2 id="hane">Hane bütçesi için ne demek?</h2>\n' +
    "<p><strong>Maaş.</strong> 2026 sonundan 2028 sonuna kadar alım gücünü korumak için gereken toplam artış eski ara hedeflere göre " + y1(fe - 100) + " idi; yeni ara hedeflere göre " + y1(fy - 100) + ". Bu, ücret ve emekli aylığı pazarlıklarında bakılacak eşiğin yükseldiği anlamına geliyor.</p>\n" +
    "<p><strong>Mevduat.</strong> Getirisinin enflasyonu karşılaması için gereken brüt faiz, stopaj ve vade yapısına bağlı:</p>\n" +
    tablo("6 ay vadeli TL mevduat, yılda iki kez yenilenir, stopaj %" + v1(s), ["Karşılanacak enflasyon", "Gereken brüt yıllık faiz"], [
      ["2027 sonu tahmini " + y1(H[2027]), y2(bb)],
      ["2026 sonu tahmini " + y1(H[2026]), y2(bb26)]]) + "\n" +
    "<p>Hesap, faizin her 6 ayda bir anaparaya eklendiğini ve stopajın her vadede kesildiğini varsayar. Kendi mevduatınızın net getirisini <a href=\"../../faiz-donusturucu/\">faiz dönüştürücü</a> ile, enflasyona göre gerçek değişimini <a href=\"../../enflasyon-hesaplama/\">enflasyon hesaplama</a> aracıyla bulabilirsiniz.</p>\n" +
    "<p><strong>Kredi.</strong> İleriye dönük reel faizin yüksek olması, bugün alınan TL kredinin geri ödemesinin TCMB'nin tahmini tutarsa alım gücü olarak pahalı kalacağını gösterir. Tahmin yukarı saparsa borçlu lehine, aşağı saparsa aleyhine işler.</p>");

  out.push('<h2 id="varsayim">Varsayımlar ve sınırlar</h2>\n<ul>' +
    "<li>Tahminler TCMB'nin; bu yazı yalnız aritmetiğini yapar. Tahmin aralığı yayımlanmadığı için sonuçlar tek senaryodur.</li>" +
    "<li>Reel faiz politika faiziyle hesaplandı; mevduat ve kredi faizleri politika faizinden farklıdır.</li>" +
    "<li>Mevduat hesabı 6 aya kadar vadeli TL mevduattaki stopaj oranını kullanır (GİB rehberi). Daha uzun vadede oran farklıdır.</li>" +
    "<li>Fiyat düzeyi karşılaştırması ara hedefleri tam tutturulmuş varsayar.</li></ul>");

  out.push('<h2 id="kaynaklar">Kaynaklar</h2>\n<ul>' +
    '<li><a href="https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu/2026/Enflasyon+Raporu+2026+-+IV" rel="noopener">TCMB Enflasyon Raporu 2026-IV</a>, Bölüm 3 "Orta Vadeli Öngörüler", s.' + R.RAPOR.sayfa + '</li>' +
    '<li><a href="https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+menu/duyurular/basin/2026/duy2026-45" rel="noopener">PPK basın duyurusu ' + P.duyuru + '</a>, ' + gun(P.tarih) + '</li>' +
    '<li><a href="https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Para+Politikasi/PPK/2026" rel="noopener">TCMB 2026 PPK takvimi</a></li>' +
    "<li>Mevduat stopajı: GİB, GVK geçici 67. madde rehberi (sitenin varlık karşılaştırma motoru)</li>" +
    '<li>Aylık reel politika faizi: <a href="https://veri.korayoner.dev/hesap/reel-politika-faizi">Türkiye Verisi</a> (BIS politika faizi ve TÜFE)</li></ul>');

  out.push("<h2>Sık sorulan sorular</h2>\n" +
    "<details><summary>TCMB 2027 sonu enflasyon tahmini kaç?</summary><p>" + gun(R.RAPOR.tarih) + " tarihli Enflasyon Raporu'nda 2027 sonu tahmini " + y1(H[2027]) + "; ara hedef de " + y1(A.yeni[2027]) + "'e yükseltildi. 2026 sonu tahmini " + y1(H[2026]) + ".</p></details>\n" +
    "<details><summary>Reel faiz pozitif mi?</summary><p>Evet. Politika faizi " + y1(P.faiz) + "; ekim TÜFE'sine göre reel faiz " + y1(ep) + ", TCMB'nin 2027 tahminine göre " + y1(ex) + ".</p></details>\n" +
    "<details><summary>Bir sonraki faiz kararı ne zaman?</summary><p>" + gun(P.sonraki) + ". Karar sonrasında bu yazının hesapları yeni faizle güncellenir.</p></details>");
  return out.join("\n\n");
}

var YAZILAR = [
  { ad: "Torba teklif SGK", isaret: "TORBA-GOVDE", dosya: path.join(KOK, "makaleler", "torba-teklif-gss-borcu-istihdam-tesviki", "index.html"), govde: teklifGovde },
  { ad: "Enflasyon Raporu 2026-IV", isaret: "ER26IV-GOVDE", dosya: path.join(KOK, "makaleler", "enflasyon-raporu-2026-iv-reel-faiz", "index.html"), govde: raporGovde }
];

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0, kod = 0;
  YAZILAR.forEach(function (w) {
    var bas = "<!-- " + w.isaret + ":BASLANGIC -->", bit = "<!-- " + w.isaret + ":BITIS -->";
    var sx = fs.readFileSync(w.dosya, "utf8"), i = sx.indexOf(bas), j = sx.indexOf(bit);
    if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + w.isaret);
    var yeni = sx.slice(0, i + bas.length) + "\n" + w.govde() + "\n" + sx.slice(j);
    if (kontrol) {
      if (yeni !== sx) { console.log(w.ad + " yazısı güncel değil: node tools/kasim-2026-gundem-yazilari.js"); kod = 1; } else console.log(w.ad + " yazısı güncel.");
    } else if (yeni !== sx) { fs.writeFileSync(w.dosya, yeni, "utf8"); console.log(w.ad + " güncellendi."); } else console.log(w.ad + ": değişiklik yok.");
  });
  return kod;
}

if (require.main === module) process.exit(main());
module.exports = { teklifGovde: teklifGovde, raporGovde: raporGovde };
