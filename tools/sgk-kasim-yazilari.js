#!/usr/bin/env node
/*
 * Kasım 2026'nın iki sosyal güvenlik yazısının gövdesi ve grafikleri:
 *   makaleler/emekliye-ilave-iyilestirme-ocak-2027 (iyilestirme.js)
 *   makaleler/bir-yil-daha-calismak-aylik          (bir-yil.js)
 * Rakamların hepsi modüllerden gelir; TÜFE serisi en düşük aylık yazısının
 * veri ayına kesilidir, gece değişmez.
 *
 * Kullanım:
 *   node tools/sgk-kasim-yazilari.js           # yaz
 *   node tools/sgk-kasim-yazilari.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var I = require(path.join(KOK, "makaleler", "emekliye-ilave-iyilestirme-ocak-2027", "iyilestirme.js"));
var Y = require(path.join(KOK, "makaleler", "bir-yil-daha-calismak-aylik", "bir-yil.js"));

function v1(x) { return x.toFixed(1).replace(".", ","); }
function v2(x) { return x.toFixed(2).replace(".", ","); }
function y1(o) { return o < 0 ? "%−" + v1(-o * 100) : "%" + v1(o * 100); }
function y2(o) { return "%" + v2(o * 100); }
function y0(o) { return "%" + Math.round(o * 100); }
function tl(x) { return Math.round(x).toLocaleString("tr-TR"); }
function mly(x) { return (Math.round(x / 100) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); } // milyon → milyar
function mlyTam(x) { return tl(x / 1000); }

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

/* Açıklanamayan pay: üç yıl, 2027 için aralık. */
function kalintiGrafik(rows, ar) {
  var W = 640, H = 270, SOL = 50, SAG = 620, UST = 22, ALT = 222, Y0 = -2, Y1 = 12;
  function y(v) { return ALT - (v - Y0) / (Y1 - Y0) * (ALT - UST); }
  var g = "";
  [0, 4, 8, 12].forEach(function (t) {
    g += '<path class="' + (t === 0 ? "sifir" : "izgara") + '" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">%' + t + "</text>";
  });
  var genis = (SAG - SOL) / rows.length, c = 76;
  rows.forEach(function (r, i) {
    var mx = SOL + genis * (i + 0.5), v = r.kalinti * 100, ust = Math.max(v, 0), boy = Math.abs(v);
    var sinif = r.yil === 2027 ? "seri-2" : "seri-1";
    g += '<rect class="' + sinif + '" x="' + (mx - c / 2).toFixed(1) + '" y="' + y(ust).toFixed(1) + '" width="' + c + '" height="' + (y(ust - boy) - y(ust)).toFixed(1) + '" rx="2"/>';
    if (r.yil === 2027) {
      var a = ar.alt.kalinti * 100, b = ar.ust.kalinti * 100, wx = mx + c / 2 + 16;
      g += '<path class="sifir" d="M' + wx + " " + y(a).toFixed(1) + " V" + y(b).toFixed(1) + " M" + (wx - 5) + " " + y(a).toFixed(1) + " h10 M" + (wx - 5) + " " + y(b).toFixed(1) + ' h10"/>';
      g += '<text class="kucuk" x="' + (wx + 8) + '" y="' + (y(b) + 4).toFixed(1) + '">' + y1(ar.ust.kalinti) + '</text><text class="kucuk" x="' + (wx + 8) + '" y="' + (y(a) + 4).toFixed(1) + '">' + y1(ar.alt.kalinti) + "</text>";
    }
    g += '<text class="deger" x="' + mx.toFixed(1) + '" y="' + (v < 0 ? y(v) + 16 : y(v) - 7).toFixed(1) + '" text-anchor="middle">' + y1(r.kalinti) + "</text>";
    g += '<text x="' + mx.toFixed(1) + '" y="' + (ALT + 34) + '" text-anchor="middle">' + r.yil + (r.yil === 2027 ? " (Program)" : r.yil === 2026 ? " (tahmin)" : "") + "</text>";
  });
  return kap("iyi-kalinti", W, H, "Sigorta ödemesinde yasal zam ve dosya artışının açıklamadığı pay",
    rows.map(function (r) { return r.yil + ": " + y1(r.kalinti); }).join("; ") + "; 2027 aralığı " + y1(ar.alt.kalinti) + " ile " + y1(ar.ust.kalinti) + ".", g);
}

/* Aralık aylığına göre yasal zamın üstüne ek tutar: üç biçim. */
function eklerGrafik() {
  var W = 640, H = 300, SOL = 56, SAG = 600, UST = 20, ALT = 254, X0 = 15000, X1 = 60000, Y1 = 2500;
  function x(v) { return SOL + (v - X0) / (X1 - X0) * (SAG - SOL); }
  function y(v) { return ALT - v / Y1 * (ALT - UST); }
  var g = "";
  [0, 500, 1000, 1500, 2000, 2500].forEach(function (t) {
    g += '<path class="' + (t === 0 ? "sifir" : "izgara") + '" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + tl(t) + "</text>";
  });
  [15000, 30000, 45000, 60000].forEach(function (t) { g += '<text x="' + x(t).toFixed(1) + '" y="' + (ALT + 20) + '" text-anchor="middle">' + tl(t) + "</text>"; });
  function hat(alan) {
    var p = [];
    for (var a = X0; a <= X1; a += 250) p.push((p.length ? "L" : "M") + x(a).toFixed(1) + " " + y(I.ekler(a)[alan]).toFixed(1));
    return p.join(" ");
  }
  g += '<path class="cizgi-1" d="' + hat("oran") + '"/><path class="cizgi-2" d="' + hat("seyyanen") + '"/><path class="normal" d="' + hat("taban") + '"/>';
  var o = I.ortalama(), s = I.ekler(60000);
  g += '<text class="yazi-1" x="' + (x(60000) - 6) + '" y="' + (y(s.oran) - 10).toFixed(1) + '" text-anchor="end">Ek oran ' + y2(o.esdegerOran) + "</text>";
  g += '<text class="yazi-2" x="' + (x(60000) - 6) + '" y="' + (y(1000) + 18).toFixed(1) + '" text-anchor="end">Seyyanen ' + tl(I.SEYYANEN) + " TL</text>";
  g += '<text class="deger" x="' + (x(21900)) + '" y="' + (y(2402) + 4).toFixed(1) + '">Taban zam kadar artarsa</text>';
  return kap("iyi-ekler", W, H, "Yasal zamın üstüne gelecek ek tutar, Aralık aylığına göre",
    "15.000 TL aylıkta ek oran 0, seyyanen 1.000, taban artışı " + tl(I.ekler(15000).taban) + " TL; 60.000 TL aylıkta ek oran " + tl(s.oran) + ", seyyanen 1.000, taban artışı 0.", g);
}

/* Prim gününe göre ödenen aylık, üç ortalama kazanç. */
function gunGrafik() {
  var W = 640, H = 300, SOL = 60, SAG = 610, UST = 20, ALT = 254, X0 = 7200, X1 = 10800, Y1 = 60000;
  function x(v) { return SOL + (v - X0) / (X1 - X0) * (SAG - SOL); }
  function y(v) { return ALT - v / Y1 * (ALT - UST); }
  var g = "";
  [0, 20000, 40000, 60000].forEach(function (t) {
    g += '<path class="' + (t === 0 ? "sifir" : "izgara") + '" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + tl(t) + "</text>";
  });
  [7200, 9000, 10800].forEach(function (t) { g += '<text x="' + x(t).toFixed(1) + '" y="' + (ALT + 20) + '" text-anchor="middle">' + tl(t) + " gün</text>"; });
  function hat(k, alan) {
    return [7200, 9000, 10800].map(function (d, i) { return (i ? "L" : "M") + x(d).toFixed(1) + " " + y(Y.aylik(d, k)[alan]).toFixed(1); }).join(" ");
  }
  var K = Y.KAZANCLAR;
  g += '<path class="cizgi-1" d="' + hat(K[2], "odenenAylik") + '"/><path class="cizgi-2" d="' + hat(K[1], "odenenAylik") + '"/><path class="normal" d="' + hat(K[0], "odenenAylik") + '"/><path class="calisma" d="' + hat(K[0], "kokAylik") + '"/>';
  g += '<text class="yazi-1" x="' + (x(9000) - 8) + '" y="' + (y(50000) - 10).toFixed(1) + '" text-anchor="end">Kazanç 100.000 TL</text>';
  g += '<text class="yazi-2" x="' + (x(9000) - 8) + '" y="' + (y(30000) - 10).toFixed(1) + '" text-anchor="end">Kazanç 60.000 TL</text>';
  g += '<text class="deger" x="' + (x(10800) - 4) + '" y="' + (y(Y.taban()) - 7).toFixed(1) + '" text-anchor="end">Asgari brüt: taban ' + tl(Y.taban()) + " TL</text>";
  g += '<text class="kucuk" x="' + (x(10800) - 4) + '" y="' + (y(Y.aylik(10800, K[0]).kokAylik) + 18).toFixed(1) + '" text-anchor="end">Hesaplanan aylık, ödenmez</text>';
  return kap("yil-gun", W, H, "Prim gününe göre ödenen aylık",
    "7.200 günde 100.000 TL kazançla 40.000 TL, 60.000 TL kazançla 24.000 TL, asgari brütle taban 23.552 TL; 10.800 günde sırasıyla 60.000, 36.000 ve yine 23.552 TL.", g);
}

/* ------------------------------------------------ ilave iyileştirme yazısı */

function iyilestirmeGovde() {
  var o = I.ocakSenaryolari(), rows = I.ayristirma(), ar = I.aralik(), r27 = rows[2];
  var sey = I.seyyanenMaliyeti(), ort = I.ortalama(), b = I.butce(), T0 = I.TB.BUGUNKU_TABAN;
  var olcek = I.SEYYANEN * r27.kalintiTl / sey;
  var out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Oran da tutar da henüz yok.</strong> Çalışma ve Sosyal Güvenlik Bakanlığı 3 Kasım 2026'da TBMM Plan ve Bütçe Komisyonu'nda, Ocak 2027'den geçerli olması hedeflenen ve yasal artışların üzerine ilave iyileştirme içeren bir çalışma yürüttüğünü açıkladı. Sonuç önce kamuoyuyla paylaşılacak, sonra Meclis'e gelecek.</p>\n" +
    "<p><strong>Kesin olan yasal zam.</strong> SSK ve Bağ-Kur için Temmuz–Ekim TÜFE'si " + y2(o.kesin) + " birikti; senaryolar Ocak zammını " + y2(o.ovp) + " ile " + y2(o.hiz) + " arasına koyuyor.</p>\n" +
    "<p><strong>Ölçtüğümüz fark:</strong> 2027 Yıllık Programı'ndaki aylık ve gelir ödemesi, yasal zam ve dosya artışının açıkladığından yaklaşık <strong>" + mlyTam(r27.kalintiTl) + " milyar TL</strong> yüksek. Aynı hesap 2025'te " + y1(rows[0].kalinti) + ", 2026'da " + y1(rows[1].kalinti) + " fark bırakmıştı; 2027'de " + y1(r27.kalinti) + ". Bu bir zam vaadi değil, Program'da yasal zamın dışında bir pay olabileceğinin işareti.</p>\n" +
    "<p><strong>Biçim rakam kadar önemli.</strong> Aynı parayla seyyanen tutar her dosyaya eşit, ek oran yüksek aylığa daha çok gider ve tabandakine hiç ulaşmaz.</p>\n</div>");

  out.push('<h2 id="bakanlik">Bakanlık ne söyledi, ne söylemedi?</h2>\n' +
    "<p>Bilgi Bakanlığın 2027 bütçe sunumundan. Söylenenler dört cümleye sığıyor:</p>\n<ul>" +
    "<li>Çalışma Ocak 2027'den geçerli olacak şekilde hedefleniyor.</li>" +
    "<li>Mevcut yasal artışlara ek bir iyileştirme içeriyor; yani m.55'teki enflasyon zammının yerine değil üstüne konuşuluyor.</li>" +
    "<li>Yaklaşım emekliler arasındaki gelir farklılıklarını gözetiyor.</li>" +
    "<li>Çalışma ilgili kamu kurumlarıyla sürüyor; bitince açıklanacak ve Meclis'in takdirine sunulacak.</li></ul>\n" +
    "<p>Söylenmeyenler ise okurun aradığı rakamlar: oran, tutar, en düşük aylığın yeni düzeyi, hangi dosyaların kapsanacağı ve tarih. 20 Ekim–3 Kasım arasındaki TBMM Gelen Kâğıtları'nı (14–22. sayılar) da okuduk. Bu çalışmaya ait bir metin yok; o listede gelen kanun teklifleri en çok dört imzalı tekil tekliflerdir.</p>");

  out.push('<h2 id="program">Program\'da fazladan pay var mı?</h2>\n' +
    "<p>Bakanlığın sözü rakam vermiyor, ama devletin 2027 hesabı bir hafta önce yayımlandı. 27 Ekim tarihli Yıllık Program'a göre aylık ve gelir ödemeleri 2026'da " + mly(I.P.sgk.sigortaOdemeleri[2]) + " milyar TL'den 2027'de " + mly(I.P.sgk.sigortaOdemeleri[3]) + " milyar TL'ye çıkıyor: " + y1(r27.artis) + " artış. Bu artışın ne kadarını bugünkü kanun açıklıyor?</p>\n" +
    "<p>Hesap üç adım. Yıl ortalaması aylık düzeyi, Ocak ve Temmuz zamlarından kurulur; 2027 için Ocak'ta geçen yılın ayları senaryosu (" + y2(o.gecenYil) + "), Temmuz'da Program'ın %21 hedefinden yılın ilk yarısına düşen pay (" + y1(I.temmuzMerkez()) + ") alınır. Üstüne dosya sayısı artışı (" + y1(rows[0].dosya) + ") eklenir. Kalan, yasal zamın ve dosya artışının açıklamadığı paydır. Yöntemi sınamak için aynı hesabı gerçekleşmiş iki yıla da uyguladık.</p>\n" +
    sekil("iyi-kalinti", "Yasal zamın ve dosya artışının açıklamadığı pay", "Sigorta ödemesi artışından yasal zam ve dosya etkisi çıkınca kalan, yüzde. Çizgi 2027'nin duyarlılık aralığı.", kalintiGrafik(rows, ar),
      "Kaynak: 2027 Yıllık Programı Tablo I:46 (s.72) ve Tablo II:1 (s.111); zam oranları TÜİK TÜFE'sinden sitenin motoruyla. 2026 Program'ın gerçekleşme tahmini.") + "\n" +
    tablo("Sigorta ödemesi artışının ayrıştırılması", ["Yıl", "Ödeme artışı", "Yasal zam etkisi", "Dosya artışı", "Açıklanamayan"],
      rows.map(function (r) { return [String(r.yil), y1(r.artis), y1(r.oran), y1(r.dosya) + (r.yil === 2025 ? "" : " (varsayım)"), y1(r.kalinti)]; })) + "\n" +
    "<p>Geçmiş iki yılda hesap ödemeyi bir buçuk puan içinde tutturuyor. 2026'daki küçük artıda taban yükseltmeleri de var. 2027'de ise fark " + mlyTam(r27.kalintiTl) + " milyar TL. Varsayımları oynattığımızda (üç Ocak senaryosu, Temmuz için %8–%12, dosya artışı için 2024 ve 2025 hızları; " + ar.adet + " bileşim) fark " + mlyTam(ar.alt.kalintiTl) + " ile " + mlyTam(ar.ust.kalintiTl) + " milyar TL arasında kalıyor. En düşük ucu bile geçmiş iki yılın üstünde.</p>\n" +
    "<p><strong>Bu farkı ne diye okumamalı?</strong> Program hiçbir yerde “ilave iyileştirme” kalemi yazmıyor. Yeni bağlanan aylıkların ortalamanın üstünde olması, dosya sayısının hızlanması ya da Program'ın daha yüksek bir ilk yarı enflasyonu varsayması da aynı farkı üretebilir. Ölçtüğümüz yalnız şu: Program'ın rakamı bugünkü kanunla kolay açıklanmıyor.</p>");

  out.push('<h2 id="olcek">Bin liranın faturası</h2>\n' +
    "<p>Program'daki 2025 sonu aylık dosyası " + tl(I.dosya(2025)) + ". Her dosyaya ayda " + tl(I.SEYYANEN) + " TL'nin bir yıllık maliyeti bu yüzden en az <strong>" + mly(sey) + " milyar TL</strong>; dosya sayısı arttıkça fatura büyür. Bakanlık bütçesinden SGK'ya ayrılan paraya oranı " + y1(sey / (b.sgk / 1000)) + ". " + mlyTam(r27.kalintiTl) + " milyar TL'lik fark dosya başına ayda yaklaşık " + tl(olcek) + " TL'ye denk düşer. Bu sayı bir tahmin değil, ölçektir: farkın ne kadarının iyileştirmeye ayrıldığını kimse söylemedi; hiç ayrılmamış da olabilir.</p>");

  var ornek = [15000, 21500, 23552, 30000, 40000, 60000];
  out.push('<h2 id="bicim">Aynı para, üç ayrı sonuç</h2>\n' +
    "<p>Bakanlığın “gelir farklılıklarını gözeten” ifadesi rastgele değil, çünkü iyileştirmenin biçimi kimin kazanacağını belirler. Ocak zammından sonra dosya başına ortalama ödeme yaklaşık " + tl(ort.ocak) + " TL. Bu yüzden herkese " + tl(I.SEYYANEN) + " TL seyyanen ile bütün aylıklara " + y2(ort.esdegerOran) + " ek oran aynı paraya mal olur. Sonuçları ise farklıdır:</p>\n" +
    sekil("iyi-ekler", "Yasal zamın üstüne ek tutar", "Ocak 2027, zam " + y2(o.gecenYil) + " senaryosu; yatayda Aralık'taki toplam aylık, dikeyde TL. Üç biçim varsayımsaldır.", eklerGrafik(),
      "Hesap: 5510 m.55 ve ek m.19; sitenin zam motoru. Seyyanenin tabana ek ödendiği varsayıldı. Rakamlar örnektir, açıklanmış bir düzenleme değildir.") + "\n" +
    tablo("Yasal zamın üstüne ek tutar, TL (varsayımsal)", ["Aralık'ta toplam aylık", "Ocak, yalnız yasal zam", "+" + tl(I.SEYYANEN) + " seyyanen", "+" + y2(ort.esdegerOran) + " ek oran", "Taban " + y2(o.gecenYil) + " artarsa"],
      ornek.map(function (A) {
        var e = I.ekler(A);
        function f(v) { return v < 0.5 ? "0" : "+" + tl(v); }
        return [tl(A), tl(e.yasal), f(e.seyyanen), f(e.oran), f(e.taban)];
      })) + "\n" +
    "<p><strong>Ek oran tabana ulaşmaz.</strong> Tabandaki dosyanın kendi aylığı " + tl(T0) + " TL'nin altında; oran kendi aylığı büyütür, tamamlama parası aynı ölçüde küçülür. 15.000 TL'lik dosyanın eline geçen değişmez.</p>\n" +
    "<p><strong>Seyyanen ortalamanın altına yarar.</strong> Aylığı yaklaşık " + tl(ort.ocak / (1 + o.gecenYil)) + " TL'nin altındaki dosya seyyaneni, üstündeki ek oranı tercih eder.</p>\n" +
    "<p><strong>Taban yalnız alttakine yarar ve keskindir.</strong> Tabanı zam kadar yükseltmek " + tl(I.TB.esik(o.gecenYil)) + " TL'nin altındakine " + tl(I.ekler(15000).taban) + " TL verir, " + tl(T0) + " TL'de ek sıfırlanır. Faturası tabandaki dosya sayısına bağlı ve bu sayıyı SGK'nın yayımladığı tablolarda bulamadık; bu yüzden üçüncü yolu eşit maliyetli göstermiyoruz. Tabanın kanunla nasıl yürüdüğü <a href=\"../en-dusuk-emekli-ayligi-ocak-2027/\">en düşük aylık yazısında</a>.</p>");

  out.push('<h2 id="butce">Bütçe sunumundaki rakamlar</h2>\n' +
    tablo("Çalışma ve Sosyal Güvenlik Bakanlığı 2027 bütçe teklifi", ["Kalem", "Milyar TL", "Pay"], [
      ["Sosyal Güvenlik Kurumu", mly(b.sgk / 1000), y1(b.sgkPay)],
      ["Türkiye İş Kurumu", mly(b.iskur / 1000), y1(b.iskurPay)],
      ["Merkez ve yurt dışı teşkilatı", mly(b.merkez / 1000), y1(b.merkezPay)],
      ["Toplam", mly(b.toplam / 1000), "%100,0"]]) + "\n" +
    "<p>Bakanlık bütçesinin her yüz lirasının yaklaşık " + Math.round(b.sgkPay * 100) + " lirası SGK'ya geçiyor. Program'ın 2027 için yazdığı bütçe transferi ise " + mly(b.programTransfer) + " milyar TL; Bakanlık rakamının ona oranı " + y1(b.sgkTransferPay) + ". Kalanın hangi tertipten geleceğini sunum söylemiyor, iki belge farklı kapsamla yazılmış olabilir. SGK dengesinin Program'daki hali <a href=\"../yillik-program-2027/\">Yıllık Program yazısında</a>.</p>\n" +
    "<p>Sunumda maaşa dokunan başka üç bilgi var. Asgari Ücret Tespit Komisyonu Aralık'ta toplanacak. Memur ve memur emeklisi için toplu sözleşmedeki %5 ve %4 ile olası enflasyon farkı teyit edildi; hesap <a href=\"../ocak-2027-memur-zammi/\">memur zammı yazısında</a>. Aktif işgücü programlarında cep harçlıklarının bazı alanlarda 2027'den itibaren %50'ye kadar artırımlı ödenebileceği açıklandı; oranın hangi programa nasıl uygulanacağı henüz ayrıntılı değil.</p>");

  out.push('<h2 id="takvim">Ocak\'a kadar neye bakılmalı?</h2>\n<ul>' +
    "<li><strong>3 Aralık:</strong> TÜİK Kasım TÜFE'si. <a href=\"../ocak-2027-emekli-zammi/\">Emekli zammı yazısı</a> gece kendini yeniler.</li>" +
    "<li><strong>Aralık:</strong> Asgari ücret görüşmeleri ve bütçenin Genel Kurul takvimi. İyileştirme metni bu dönemde bir kanun teklifiyle gelebilir; tarih açıklanmadı.</li>" +
    "<li><strong>4 Ocak 2027:</strong> Aralık TÜFE'si. Yasal zam kesinleşir.</li>" +
    "<li><strong>Metin gelirse:</strong> Bu yazıdaki üç biçimden hangisi seçildiğine bakılır. Taban ek m.19'da, zam kuralı m.55'te yazılı; ikisi de kanunla değişir.</li></ul>\n" +
    "<p>Kendi aylığınızın yasal zamla ne olacağını <a href=\"../../emekli-zammi-hesaplama/\">emekli zammı hesaplama</a> aracında görebilirsiniz. Araç yalnız yasal zamı hesaplar; açıklanmamış bir iyileştirmeyi eklemez.</p>");

  return out.join("\n\n");
}

/* ------------------------------------------------ bir yıl daha yazısı */

function birYilGovde() {
  var e = Y.yilEtkisi(), s = Y.eskiGiris(), esik = Y.tabanEsigi(7200), ag = Y.asgariGereken(), iy = Y.ikiYol(), T0 = Y.taban();
  var K = Y.KAZANCLAR, out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Az.</strong> 2008 Ekim sonrası sigortalıda 360 gün daha prim, aylık bağlama oranını 2 puan artırır. 7.200 günde " + y0(e[0].abo0) + "'tan " + y0(e[0].abo1) + "'ye çıkan oran aylığı " + y0(e[0].artis) + " büyütür. Bir yıl aylık almamanın bedeli 12 aylıktır; bu artışla o bedel <strong>" + Math.round(e[0].donus) + " yılda</strong> geri gelir.</p>\n" +
    "<p><strong>Düşük kazançta artış sıfır.</strong> 7.200 günde ortalama kazancı " + tl(esik) + " TL'nin altında kalanın aylığını zaten en düşük aylık belirliyor. Fazladan gün ödenen aylığı değiştirmez.</p>\n" +
    "<p><strong>Yeni bir kural yok.</strong> 2027 Yıllık Programı aylık bağlama sisteminin daha uzun çalışmayı teşvik edecek şekilde yeniden düzenleneceğini yazıyor, ama oran ya da tarih vermiyor. Bu yazı bugünkü teşviki ölçer, gelecek kuralı tahmin etmez.</p>\n</div>");

  out.push('<h2 id="neden">Soru neden şimdi soruluyor?</h2>\n' +
    "<p>Program'ın <strong>tedbir 406.2</strong>'si (s.112) aylık bağlama sisteminin kişilerin daha çok istihdamda kalmasını teşvik edecek ve mali yük getirmeyecek şekilde düzenleneceğini söylüyor. Bu hükmü 1 Kasım'da TRT Haber de aktardı. Metinde dört kurum sayılıyor: Çalışma ve Sosyal Güvenlik Bakanlığı, Hazine ve Maliye Bakanlığı, Strateji ve Bütçe Başkanlığı ve SGK. Gün sayısı, yaş ya da yeni oran yok.</p>\n" +
    "<p>Bir teşvikin nasıl değişeceğini anlamak için önce bugünkü teşviki bilmek gerekir. Onu kanun maddesinden doğrudan hesaplamak mümkün.</p>");

  out.push('<h2 id="tablo">Bugünkü kuralla gün ve aylık</h2>\n' +
    "<p>1 Ekim 2008'den sonra sigortalı olanda 5510 m.29 her 360 gün için %2 sayar; oranın tavanı %90. Aylık, güncellenmiş ortalama kazanç ile bu oranın çarpımıdır, en düşük aylığın altındaysa taban ödenir. Aşağıda kazanç sabit tutuldu; soru yalnız günün etkisi.</p>\n" +
    tablo("Prim günü ve ödenen aylık, TL (2009 girişli, ortalama kazanç sabit)", ["Prim günü", "Bağlama oranı", tl(K[0]) + " kazanç", tl(K[1]) + " kazanç", tl(K[2]) + " kazanç"],
      Y.tablo().map(function (r) { return [tl(r.gun), y1(r.abo)].concat(r.aylar.map(tl)); })) + "\n" +
    sekil("yil-gun", "Fazladan gün kime yansıyor?", "Yatayda prim günü, dikeyde ödenen aylık (TL). Asgari brütten prim ödeyen 10.800 günde bile tabanda.", gunGrafik(),
      "Hesap: sitenin emeklilik motoru, 5510 m.29; en düşük aylık " + tl(T0) + " TL. Ek ödeme motora dahil değil; dahil edilince eşikler bir miktar aşağı iner.") + "\n" +
    "<p>Asgari brüt " + tl(Y.ASGARI_BRUT) + " TL ile hesaplanan aylığın tabanı geçmesi için bağlama oranının " + y1(ag.abo) + " olması gerekir. Bu " + tl(ag.gun) + " gün demek, yani yaklaşık " + Math.round(ag.yil) + " yıl prim; 7.200 günün " + Math.round(ag.fazlaYil) + " yıl üstü. Düşük kazançlı çalışan için bugünkü kuralda ek çalışmanın aylığa görünür bir ödülü yok.</p>");

  out.push('<h2 id="geri-donus">Ertelenen aylık kaç yılda geri gelir?</h2>\n' +
    "<p>Emekli olabilecekken bir yıl beklemek 12 aylık kaybettirir ve sonraki her ay aylığı biraz yükseltir. Geri dönüş süresi kaybedilen 12 aylığın yıllık artışa bölümüdür. Zam iki aylığı da aynı oranda büyüttüğü için sonuç enflasyondan bağımsızdır.</p>\n" +
    tablo("Bir yıl beklemenin aylığa etkisi", ["Başlangıç", "Bağlama oranı", "Aylık artışı", "Geri dönüş"], [
      ["7.200 gün, 2009 girişli", y1(e[0].abo0) + " → " + y1(e[0].abo1), y1(e[0].artis), Math.round(e[0].donus) + " yıl"],
      ["9.000 gün, 2009 girişli", y1(e[1].abo0) + " → " + y1(e[1].abo1), y1(e[1].artis), Math.round(e[1].donus) + " yıl"],
      ["7.200 gün, 2005 girişli", y1(s.abo0) + " → " + y1(s.abo1), y1(s.artis), Math.round(s.donus) + " yıl"]]) + "\n" +
    "<p>Prim günü arttıkça oran büyüdüğü için aynı 2 puanın göreli etkisi küçülür: geri dönüş uzar. 2000–2008 arası girişlide eski dönemin kademeli oranları karıştığı için rakam biraz değişir ama büyüklük aynıdır.</p>");

  out.push('<h2 id="iki-yol">Aylığı bağlatıp çalışmak ne kazandırır?</h2>\n' +
    "<p>Özel sektörde 4/a'lı çalışan emekli olduktan sonra çalışmayı sürdürebilir; aylık kesilmez, ücretinden sosyal güvenlik destek primi kesilir. İşçi payı " + y1(Y.SGDP_ISCI) + ", normal çalışanınkinden düşüktür. Bu yüzden karşılaştırma ertelemeyle bağlatma arasında yapılınca fark açılıyor. Örnek: 7.200 günü dolmuş, " + tl(iy.brut) + " TL brüt kazanan biri, 2026 bordro parametreleriyle bir yıl:</p>\n" +
    tablo("Bir yılda eline geçen, TL", ["Yol", "Net ücret", "Aylık", "Toplam"], [
      ["Aylığı ertelemek", tl(iy.netNormal), "0", tl(iy.erteleme)],
      ["Bağlatıp çalışmak", tl(iy.netSgdp), tl(12 * iy.a0), tl(iy.baglatma)]]) + "\n" +
    "<p>Bağlatan o yıl " + tl(iy.fark) + " TL önde başlıyor. Erteleyenin aylığı ayda " + tl(iy.artisAy) + " TL yüksek, yani bu farkı yaklaşık " + Math.round(iy.donus) + " yılda kapatıyor. Üstelik emeklilikte ödenen destek primi aylığı büyütmez; karşılaştırma kamu görevine dönenler ve 4/b için geçerli değil, onlarda kural başka. Kendi rakamınız için <a href=\"../../emekli-calisan-maas-hesaplama/\">emekli çalışan maaş hesaplama</a> aracına bakın.</p>\n" +
    "<p>Program'ın “daha çok istihdamda kalma” hedefinin ölçülebilir karşılığı burası. Bugünkü kuralla kişi aylığa hak kazandığında bağlatmaya itiliyor.</p>");

  out.push('<h2 id="diger">Haberdeki öteki başlıklar</h2>\n' +
    "<p>Aynı Program bölümünde üç başlık daha var; hepsi yön belirtir, tarih ya da oran vermez. Yaşlı bakımının finansmanı için bir bakım sigortası kurulması, kapsam dışındaki gruplara mikro sigorta programları ve prime esas kazancı bir önceki aya göre %20'den fazla düşen sigortalıya kısa mesajla uyarı gönderilmesi. Sonuncusu çalışanın işine doğrudan yarar: bildirilen kazançtaki düşüş aylığa yansır. Bugünden e-Devlet hizmet dökümünüzü <a href=\"../../bordro-denetim/\">bordronuzla</a> karşılaştırabilirsiniz.</p>");

  return out.join("\n\n");
}

var YAZILAR = [
  { ad: "İlave iyileştirme", isaret: "IYI-GOVDE", dosya: path.join(KOK, "makaleler", "emekliye-ilave-iyilestirme-ocak-2027", "index.html"), govde: iyilestirmeGovde },
  { ad: "Bir yıl daha", isaret: "BIRYIL-GOVDE", dosya: path.join(KOK, "makaleler", "bir-yil-daha-calismak-aylik", "index.html"), govde: birYilGovde }
];

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0, kod = 0;
  YAZILAR.forEach(function (w) {
    var bas = "<!-- " + w.isaret + ":BASLANGIC -->", bit = "<!-- " + w.isaret + ":BITIS -->";
    var sx = fs.readFileSync(w.dosya, "utf8"), i = sx.indexOf(bas), j = sx.indexOf(bit);
    if (i < 0 || j < 0) throw new Error("İşaretçi yok: " + w.isaret);
    var yeni = sx.slice(0, i + bas.length) + "\n" + w.govde() + "\n" + sx.slice(j);
    if (kontrol) {
      if (yeni !== sx) { console.log(w.ad + " yazısı güncel değil: node tools/sgk-kasim-yazilari.js"); kod = 1; } else console.log(w.ad + " yazısı güncel.");
    } else if (yeni !== sx) { fs.writeFileSync(w.dosya, yeni, "utf8"); console.log(w.ad + " güncellendi."); } else console.log(w.ad + ": değişiklik yok.");
  });
  return kod;
}

if (require.main === module) process.exit(main());
module.exports = { iyilestirmeGovde: iyilestirmeGovde, birYilGovde: birYilGovde };
