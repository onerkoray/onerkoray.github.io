#!/usr/bin/env node
/*
 * "2025 kesin hesabı" yazısının gövdesi. Rakamlar Sayıştay'ın
 * bildirimlerinden kesin-hesap.json'a alındı, hesaplar kesin.js'te.
 *
 * Kullanım:
 *   node tools/kesin-hesap-yazisi.js           # yaz
 *   node tools/kesin-hesap-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var K = require(path.join(KOK, "makaleler", "kesin-hesap-2025-sayistay", "kesin.js"));
var YAZI = path.join(KOK, "makaleler", "kesin-hesap-2025-sayistay", "index.html");

function v1(x) { return Math.abs(x).toFixed(1).replace(".", ","); }
function y1(o) { return (o < 0 ? "%−" : "%") + v1(o * 100); }
function y2(o) { return (o < 0 ? "%−" : "%") + Math.abs(o * 100).toFixed(2).replace(".", ","); }
function art(o) { return (o < 0 ? "%−" : "%+") + v1(o * 100); }
function mly(x) { return (x < 0 ? "−" : "") + (Math.round(Math.abs(x) / 1e8) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function trn(x) { return (x / 1e12).toFixed(2).replace(".", ","); }

function tablo(baslik, basliklar, satirlar) {
  return '<div class="table-scroll"><table class="data-table">\n<caption>' + baslik + "</caption>\n<thead><tr>" +
    basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + b + "</th>"; }).join("") + "</tr></thead>\n<tbody>\n" +
    satirlar.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return i ? '<td class="num">' + c + "</td>" : '<th scope="row">' + c + "</th>"; }).join("") + "</tr>";
    }).join("\n") + "\n</tbody></table></div>";
}

function govde() {
  var o = K.ozet(), L = K.limitler(), l25 = L[2], l23 = L[0], l24 = L[1], kr = K.kurumlar(), s = K.yirmiYedi();
  var out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Toplamda bütçe tuttu.</strong> 2025 için verilen " + trn(o.baslangic) + " trilyon TL başlangıç ödeneğine karşı " + trn(o.brutGider) + " trilyon TL harcandı, fark " + y1(o.giderSapma) + ". Genel bütçe açığı da kanundaki tahminin " + y1(o.acikSapma) + " üstünde kaldı.</p>\n" +
    "<p><strong>Borçlanma sınırı ise yıl içinde genişledi.</strong> Bütçe Kanunu'nun çizdiği net borçlanma limiti " + mly(l25.ham) + " milyar TL'ydi. İki kez %5 artırıldı, Aralık 2025'te çıkan kanunla geriye dönük " + mly(l25.ek) + " milyar TL eklendi ve " + mly(l25.son) + " milyar TL oldu. Gerçekleşen " + mly(l25.net) + " milyar TL. Sınır hukuken aşılmadı; son ek olmasaydı " + mly(l25.ekOlmadanAsim) + " milyar TL aşılacaktı.</p>\n" +
    "<p><strong>Sayıştay tutarları değiştirmedi, bulguları yazdı.</strong> Bildirim, ödenek ve gider tutarlarını değiştiren bir tespit olmadığını söylüyor. Aynı raporlar Meclis'e sunulan idarelerde " + K.V.bulgu.tbmm.toplam.toLocaleString("tr-TR") + " bulgu sayıyor.</p>\n</div>");

  out.push('<h2 id="nedir">Kesin hesap nedir, neden şimdi konuşuluyor?</h2>\n' +
    "<p>Bütçe kanunu bir yetkidir: Meclis yılbaşından önce ne kadar harcanabileceğini onaylar. Kesin hesap ise o yılın sonucudur ve yine Meclis'ten geçer (Anayasa m.161). Sayıştay arada bağımsız karşılaştırmayı yapar ve Genel Uygunluk Bildirimi'ni sunar. TBMM Plan ve Bütçe Komisyonu 2027 bütçe teklifini ve 2025 kesin hesap teklifini bu yüzden Sayıştay raporlarıyla birlikte görüşüyor: gelecek yılın yetkisi istenirken iki yıl önceki yetkinin nasıl kullanıldığı önde durur.</p>\n" +
    "<p>Bu yazı 2025'in rakamlarını Sayıştay'ın kendi tablolarından okur. <a href=\"../butce-2027-faiz-vergi/\">2027 bütçesinde faiz ve vergi</a> yazısı ise teklifin ileriye dönük tarafını anlatıyor.</p>");

  out.push('<h2 id="toplam">Toplamlar kanundaki rakama yakın</h2>\n' +
    tablo("2025 bütçesi: tahmin ve sonuç, milyar TL", ["Kalem", "Kanunda", "Sonuç", "Fark"], [
      ["Konsolide ödenek ve brüt gider", mly(o.baslangic), mly(o.brutGider), y1(o.giderSapma)],
      ["Genel bütçe gideri", mly(K.V.genelButce.odenek), mly(K.V.genelButce.gider), y1(o.gbGiderSapma)],
      ["Genel bütçe geliri", mly(K.V.genelButce.gelirTahmin), mly(K.V.genelButce.gelir), y1(o.gbGelirSapma)],
      ["Genel bütçe vergi geliri", mly(K.V.genelButce.vergiTahmin), mly(K.V.genelButce.vergi), y1(o.vergiSapma)],
      ["Genel bütçe açığı", mly(o.acikTahmin), mly(o.acik), y1(o.acikSapma)]]) + "\n" +
    "<p>Bu tablo ödeneklerin yerinde kaldığını söylemez. Yıl içinde ödenek toplamı " + mly(o.yilSonu) + " milyar TL'ye çıktı, " + mly(o.kullanilmayan) + " milyar TL'si kullanılmadı. Yedek ödenek " + mly(K.V.yedek.baslangic) + " milyar TL'den başlayıp aktarmalarla " + mly(K.V.yedek.toplam) + " milyar TL'ye ulaştı ve yedek ödenek hesabından toplam " + mly(K.V.yedek.aktarilan) + " milyar TL idarelere aktarıldı.</p>");

  out.push('<h2 id="kurumlar">Asıl hareket idareler arasında</h2>\n' +
    "<p>Toplam yerinde dururken idarelerin harcaması başlangıç ödeneğinden çok uzaklaşabiliyor. Sayıştay'ın genel bütçeli idareler cetvelinden, başlangıç ödeneği 30 milyar TL'nin üstündekiler arasında en büyük sapmalar:</p>\n" +
    tablo("Başlangıç ödeneği ve bütçe gideri, milyar TL", ["İdare", "Başlangıç", "Gider", "Sapma"],
      kr.secilen.map(function (r) { return [r.ad, mly(r.baslangic), mly(r.gider), art(r.sapma)]; })) + "\n" +
    "<p>Strateji ve Bütçe Başkanlığı satırı beklenen bir hareket: yedek ödenek bu idarenin bütçesinde durur ve yıl içinde başka idarelere aktarılır. Diğer sapmaların nedenini bildirim satır satır açıklamıyor; tablo yalnız tutarları verir. Bir not daha: kullanılmayan ödeneğin en büyük tek parçası " + mly(kr.enCokKullanilmayan.kullanilmayan) + " milyar TL ile " + kr.enCokKullanilmayan.ad + " satırında, genel bütçedeki toplamın " + y1(kr.kullanilmayanPay) + " kadarı.</p>");

  out.push('<h2 id="borc">Borç sınırı üç adımda genişledi</h2>\n' +
    "<p>Bütçe Kanunu'nun denge maddesi, ödenek ile gelir tahmini arasındaki farkı net borçlanma limiti yapar. 4749 sayılı Kanun bu limite iki kez %5 ekleme yetkisi tanır. 2025'te ikisi de kullanıldı: 7 Ağustos'ta Bakanlık onayıyla, 30 Ağustos'ta 10351 sayılı Kararla. Sonra 4 Aralık 2025 tarihli 7566 sayılı Kanun, 1 Ocak 2025'ten geçerli olmak üzere " + mly(l25.ek) + " milyar TL ekledi.</p>\n" +
    tablo("Net borçlanma limiti, milyar TL", ["Yıl", "Kanunda", "%5 + %5 ile", "Yıl sonu limiti", "Gerçekleşen", "Gerçekleşen / kanundaki"],
      L.map(function (r) { return [String(r.yil), mly(r.ham), r.artis ? mly(r.yuzdeli) : "artırılmadı", mly(r.son), mly(r.net), y1(r.kullanim)]; })) + "\n" +
    "<p>Üç yıl tek bir kalıp göstermiyor. 2024'te limit hiç artırılmadı, gerçekleşen kanundakinin " + y1(l24.kullanim) + " kadarı oldu. 2023'te 7456 sayılı Kanun limiti %5'li artışlardan sonraki tutarın üç katına çıkardı, gerçekleşen kanundakinin " + y1(l23.kullanim) + " kadarıydı. 2025'te ise borçlanma, %5'li iki artıştan sonraki sınırı da " + mly(l25.ekOlmadanAsim) + " milyar TL geçti ve onu karşılayan kanun yılın son ayında çıktı.</p>\n" +
    "<p>Sayıştay'ın sonucu net: limit aşılmamıştır. Bu yazı da aksini söylemiyor. Ölçtüğümüz şey, Bütçe Kanunu'ndaki rakamın bir tavan gibi okunamayacağı: gerçekleşen, kanundaki limitin " + y1(l25.kullanim) + " kadarı. Gerçekleşen net borçlanma genel bütçe açığından " + mly(o.borcAcikFarki) + " milyar TL büyük; bildirimin bu bölümü farkın kalemlerini dökmüyor.</p>\n" +
    "<p>Ölçek için: 2025'te her 100 TL net vergi tahsilatına karşılık " + o.vergiBasiBorc.toFixed(1).replace(".", ",") + " TL net borçlanma yapıldı. Yıl sonunda devlet borçları stoku " + trn(K.V.borcStoku["2025"]) + " trilyon TL, bir yıl öncesinden " + y1(o.stokArtis) + " fazla.</p>");

  out.push('<h2 id="sayistay">Sayıştay ne dedi, ne demedi?</h2>\n' +
    "<p>İki farklı soruya iki farklı cevap var, haberlerde ikisi sık karışıyor.</p>\n<ul>" +
    "<li><strong>Tutarlar doğru mu?</strong> Bildirim, denetim raporlarında ödenek ve gider tutarlarında “değişikliğe yol açan bir tespitin bulunmadığı” sonucuna varıyor ve kesin hesaptaki tutarların kabulünün uygun olacağını bildiriyor.</li>" +
    "<li><strong>İşlemler kusursuz mu?</strong> Hayır, bildirim bunu söylemiyor. Dış Denetim Genel Değerlendirme Raporu, Meclis'e sunulan idare raporlarında " + K.V.bulgu.tbmm.toplam.toLocaleString("tr-TR") + " bulgu sayıyor: " + K.V.bulgu.tbmm.mevzuat + " mevzuata uygunluk, " + K.V.bulgu.tbmm.mali + " mali tablo, " + K.V.bulgu.tbmm.icKontrol + " iç kontrol. Mahallî idareler ve şirketleri ile yatırım izleme birimleri ayrıca " + K.V.bulgu.mahalli.toplam.toLocaleString("tr-TR") + " bulgu taşıyor; bu rakam taslak raporlardan.</li></ul>\n" +
    "<p>Bulgu sayısı tek başına usulsüzlük tutarı değildir; bir bulgu kayıt hatası da olabilir. Rapor sayısı ve idare büyüklüğü değişirken yıllar arası kıyas da yanıltır.</p>\n" +
    "<p><strong>Çalışanı ilgilendiren başlık SGK alacakları.</strong> Rapor, SGK'nın bilgi sistemleri arasında entegrasyon sağlanmadığını ve alacaklara ilişkin işlemlerin tahakkuk esasına göre yapılmaması nedeniyle mali tabloların kurum alacağını tam yansıtmadığını yazıyor. Tahsilatların bir kısmı önce emanet hesabına alınıyor. Bu, sizin primlerinizin kaybolduğu anlamına gelmez; kurumun tablolarının eksik olduğu anlamına gelir. Kendi kaydınızı e-Devlet hizmet dökümünden <a href=\"../../bordro-denetim/\">bordronuzla karşılaştırabilirsiniz</a>.</p>");

  out.push('<h2 id="yirmiyedi">2027 teklifini okurken</h2>\n' +
    "<p>2027 teklifindeki açık " + mly(s.acik) + " milyar TL. Aynı %5 + %5 yetki kullanılırsa sınır yaklaşık " + mly(s.yuzdeli) + " milyar TL olur. Hesap yaklaşıktır: yasal limit genel bütçe ödenek ve gelirinden, buradaki açık merkezî yönetim tablosundan.</p>\n<ul>" +
    "<li>Kanundaki rakam bir yetki ve tahmindir. 2025, toplamların tutabildiğini ama idareler arası dağılımın ve borçlanma sınırının yıl içinde değişebildiğini gösteriyor.</li>" +
    "<li>Kesin sonuç sonradan okunur. Takvim aynı giderse 2027'nin kesin hesabı 2028'de Meclis'e gelir ve 2029 bütçesiyle görüşülür.</li>" +
    "<li>Bu rakamlar kendi maaş ya da vergi hesabınızı değiştirmez. Sizi etkileyen tarihler <a href=\"../../mali-takvim/\">mali takvimde</a>.</li></ul>");
  return out.join("\n\n");
}

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var bas = "<!-- KH-GOVDE:BASLANGIC -->", bit = "<!-- KH-GOVDE:BITIS -->";
  var sx = fs.readFileSync(YAZI, "utf8"), i = sx.indexOf(bas), j = sx.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: KH-GOVDE");
  var yeni = sx.slice(0, i + bas.length) + "\n" + govde() + "\n" + sx.slice(j);
  if (kontrol) {
    if (yeni !== sx) { console.log("Kesin hesap yazısı güncel değil: node tools/kesin-hesap-yazisi.js"); return 1; }
    console.log("Kesin hesap yazısı güncel.");
    return 0;
  }
  if (yeni !== sx) { fs.writeFileSync(YAZI, yeni, "utf8"); console.log("Yazı güncellendi."); } else console.log("Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { govde: govde };
