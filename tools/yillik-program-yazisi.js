#!/usr/bin/env node
/*
 * "2027 Yıllık Programı: emekli, maaş ve SGK" yazısının gövdesi ve grafikleri.
 * Program rakamları makaleler/yillik-program-2027/program.json'dan (sayfa
 * numaralı), hesaplar program.js'ten; TÜFE serisi gece güncellendikçe zam ve
 * gerçekleşme satırları değişir, --check bunu yakalar.
 *
 * Kullanım:
 *   node tools/yillik-program-yazisi.js           # yaz
 *   node tools/yillik-program-yazisi.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var KOK = path.dirname(__dirname);
var M = require(path.join(KOK, "makaleler", "yillik-program-2027", "program.js"));
var P = M.P;
var YAZI = path.join(KOK, "makaleler", "yillik-program-2027", "index.html");

function v1(x) { return x.toFixed(1).replace(".", ","); }
function v2(x) { return x.toFixed(2).replace(".", ","); }
function y1(o) { return "%" + v1(o * 100); }
function y2(o) { return "%" + v2(o * 100); }
function yy(x) { return x < 0 ? "%−" + v1(-x) : "%" + v1(x); }       // eksi işareti U+2212
function eksi(s) { return s.replace(/^-/, "−"); }
function mly(x) { return eksi((Math.round(x / 100) / 10).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })); } // milyon → milyar, bir ondalık
function trn(x) { return eksi((x / 1e6).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
function s(n) { return "s." + n; }

function tablo(baslik, basliklar, satirlar) {
  return '<div class="table-scroll"><table class="data-table">\n<caption>' + baslik + "</caption>\n<thead><tr>" +
    basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + b + "</th>"; }).join("") + "</tr></thead>\n<tbody>\n" +
    satirlar.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return i ? '<td class="num">' + c + "</td>" : '<th scope="row">' + c + "</th>"; }).join("") + "</tr>";
    }).join("\n") + "\n</tbody></table></div>";
}

/* ------------------------------------------------ grafikler */

/* Hedef ve gerçekleşen: her program yılı için iki çubuk. */
function isabetGrafik(ist) {
  var veri = ist.filter(function (r) { return r.gerceklesen != null || r.tahmin != null; });
  var W = 640, H = 270, SOL = 44, SAG = 620, UST = 24, ALT = 220, Y1 = 70;
  function y(v) { return ALT - v / Y1 * (ALT - UST); }
  var genis = (SAG - SOL) / veri.length, c = 46;
  var g = "";
  [0, 20, 40, 60].forEach(function (t) {
    g += '<path class="izgara" d="M' + SOL + " " + y(t).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">%' + t + "</text>";
  });
  var desc = [];
  veri.forEach(function (r, i) {
    var mx = SOL + genis * (i + 0.5), son = r.gerceklesen != null ? r.gerceklesen : r.tahmin;
    [[r.hedef, "seri-1", -c - 3], [son, "seri-2", 3]].forEach(function (b) {
      g += '<rect class="' + b[1] + '" x="' + (mx + b[2]).toFixed(1) + '" y="' + y(b[0]).toFixed(1) + '" width="' + c + '" height="' + (ALT - y(b[0])).toFixed(1) + '" rx="3"/>';
      g += '<text class="deger" x="' + (mx + b[2] + c / 2).toFixed(1) + '" y="' + (y(b[0]) - 6).toFixed(1) + '" text-anchor="middle">%' + v1(b[0]) + "</text>";
    });
    g += '<text x="' + mx.toFixed(1) + '" y="' + (ALT + 20) + '" text-anchor="middle">' + r.program + (r.tahmin != null ? " (tahmin)" : "") + "</text>";
    desc.push(r.program + ": hedef %" + v1(r.hedef) + ", " + (r.tahmin != null ? "programın kendi tahmini" : "gerçekleşen") + " %" + v1(son));
  });
  g += '<path class="sifir" d="M' + SOL + " " + ALT + " H" + SAG + '"/>';
  return '<figure class="ed-grafik" aria-labelledby="yp-isabet-b">\n<p class="ed-grafik-baslik" id="yp-isabet-b">Programın yıl sonu enflasyon hedefi ve gerçekleşen</p>\n' +
    '<p class="ed-grafik-alt">Her programın kendi yılı için koyduğu hedef (koyu) ve o yılın Aralık ayındaki yıllık TÜFE (açık).</p>\n' +
    '<div class="ed-grafik-kap"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="yp-isabet-t yp-isabet-d"><title id="yp-isabet-t">Yıllık Program enflasyon hedefleri ve gerçekleşme</title><desc id="yp-isabet-d">' +
    desc.join("; ") + "</desc>" + g + "</svg></div>\n" +
    "<figcaption>Hedefler 2022, 2024 ve 2026 Yıllık Programlarından; gerçekleşen TÜİK yıllık TÜFE (Aralık). 2026 yılı bitmediği için 2027 Programı'nın 2026 tahmini gösterildi. 2023 ve 2025 programlarının metnine ulaşılamadı.</figcaption>\n</figure>";
}

/* SGK: prim tahsilatı ile aylık ve gelir ödemeleri yan yana; 2027'de çizgi aşılıyor. */
function sgkGrafik(rows) {
  var W = 640, H = 270, SOL = 52, SAG = 620, UST = 24, ALT = 220, Y1 = 8;
  function y(v) { return ALT - v / 1e6 / Y1 * (ALT - UST); }
  var genis = (SAG - SOL) / rows.length, c = 46, g = "", desc = [];
  [0, 2, 4, 6, 8].forEach(function (t) {
    g += '<path class="izgara" d="M' + SOL + " " + y(t * 1e6).toFixed(1) + " H" + SAG + '"/><text x="' + (SOL - 8) + '" y="' + (y(t * 1e6) + 4).toFixed(1) + '" text-anchor="end">' + t + "</text>";
  });
  rows.forEach(function (r, i) {
    var mx = SOL + genis * (i + 0.5);
    [[r.prim, "seri-1", -c - 3], [r.sigorta, "seri-2", 3]].forEach(function (b) {
      g += '<rect class="' + b[1] + '" x="' + (mx + b[2]).toFixed(1) + '" y="' + y(b[0]).toFixed(1) + '" width="' + c + '" height="' + (ALT - y(b[0])).toFixed(1) + '" rx="3"/>';
      g += '<text class="kucuk" x="' + (mx + b[2] + c / 2).toFixed(1) + '" y="' + (y(b[0]) - 6).toFixed(1) + '" text-anchor="middle">' + trn(b[0]) + "</text>";
    });
    g += '<text x="' + mx.toFixed(1) + '" y="' + (ALT + 20) + '" text-anchor="middle">' + r.yil + (r.durum === "program" ? " (program)" : r.durum === "gerçekleşme tahmini" ? " (tahmin)" : "") + "</text>";
    desc.push(r.yil + ": prim " + trn(r.prim) + ", aylık ve gelir ödemesi " + trn(r.sigorta) + " trilyon TL");
  });
  g += '<path class="sifir" d="M' + SOL + " " + ALT + " H" + SAG + '"/><text x="' + SOL + '" y="14">trilyon TL</text>';
  return '<figure class="ed-grafik" aria-labelledby="yp-sgk-b">\n<p class="ed-grafik-baslik" id="yp-sgk-b">SGK: prim tahsilatı ve aylık ödemeleri</p>\n' +
    '<p class="ed-grafik-alt">Prim tahsilatı (koyu) ve sigorta ödemeleri, yani emekli aylıkları ile gelirler (açık); cari fiyatlarla trilyon TL.</p>\n' +
    '<div class="ed-grafik-kap"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="yp-sgk-t yp-sgk-d"><title id="yp-sgk-t">SGK prim tahsilatı ve sigorta ödemeleri</title><desc id="yp-sgk-d">' +
    desc.join("; ") + "</desc>" + g + "</svg></div>\n" +
    "<figcaption>Kaynak: 2027 Yıllık Programı, Tablo I:46 (s." + P.sgk.sayfa + "). Sağlık giderleri ayrıca karşılanır; bu grafikte yalnız aylık ve gelir ödemeleri var.</figcaption>\n</figure>";
}

/* ------------------------------------------------ gövde */

function govde() {
  var h = P.hedefler, rows = M.sgk(), ist = M.isabet(), cap = M.capraz(), son3 = M.sonUcAy();
  var z21 = M.zam2027(h.tufeYilSonu["2027"] / 100), z26 = M.zam2027(h.tufeYilSonu["2026"] / 100);
  var r26 = rows[2], r27 = rows[3];
  var gercek = ist.filter(function (r) { return r.sapma != null; });
  var hepsiUstte = gercek.every(function (r) { return r.sapma > 0; });
  var ap = P.aktifPasif;
  var out = [];

  out.push('<div class="legal-note verdict">\n<h2 id="kisa-cevap">Kısa cevap</h2>\n' +
    "<p><strong>Program 2027 için yıl sonu enflasyon hedefini %" + v1(h.tufeYilSonu["2027"]) + ", büyümeyi %" + v1(h.buyume["2027"]) + " koyuyor.</strong> " +
    "Bu bir zam kararı değil; ama aylık ve maaş zammının girdisi olan enflasyonun hedefi. Hedef tutar ve yıl eşit ilerlerse Temmuz 2027'de SSK ve Bağ-Kur zammı " +
    y1(z21.emekliTemmuz) + ", memur zammı " + y2(z21.memurTemmuz) + " civarında olur.</p>\n" +
    "<p><strong>SGK tarafında kırılma 2027'de:</strong> prim tahsilatı, emekli aylıkları ve gelirlerin " + y1(r27.primSigorta) + "'ini karşılıyor (2026'da " + y1(r26.primSigorta) +
    "). Gelir-gider farkı " + mly(r27.fark) + " milyar TL'ye çıkıyor; devlet katkısının 1 Ağustos 2026'da kaldırılması bu tabloyu değiştiriyor.</p>\n" +
    "<p><strong>Hedefler geçmişte tutmadı:</strong> programların kendi yılları için koyduğu enflasyon hedefi " + gercek.map(function (r) { return r.program; }).join(", ") +
    " yıllarının " + (hepsiUstte ? "hepsinde" : "çoğunda") + " gerçekleşmenin altında kaldı. Program metninde \"kademeli emeklilik\" ifadesi geçmiyor.</p>\n</div>");

  out.push('<h2 id="hedefler">Programın 2027 hedefleri</h2>\n<p>Belgenin makro çerçevesi Orta Vadeli Program (2027–2029) ile aynı. Sitenin konusuna dokunan hedefler:</p>\n' +
    tablo("2027 Yıllık Programı: seçilmiş göstergeler", ["Gösterge", "2026 (tahmin)", "2027 (program)", "Sayfa"], [
      ["GSYH büyümesi", yy(h.buyume["2026"]), yy(h.buyume["2027"]), s(h.sayfa) + ", " + s(h.buyume.metinSayfa)],
      ["Yıl sonu TÜFE", yy(h.tufeYilSonu["2026"]), yy(h.tufeYilSonu["2027"]), s(h.sayfa) + ", " + s(h.tufeYilSonu.metinSayfa)],
      ["İstihdam artışı", "—", h.istihdamArtisBin["2027"] + " bin kişi", s(h.istihdamArtisBin.metinSayfa)],
      ["Genel devlet gelirleri / GSYH", yy(h.genelDevletGelir["2026"]), yy(h.genelDevletGelir["2027"]), s(h.genelDevletGelir.sayfa)],
      ["Genel devlet harcamaları / GSYH", yy(h.genelDevletHarcama["2026"]), yy(h.genelDevletHarcama["2027"]), s(h.genelDevletHarcama.sayfa)],
      ["Genel devlet dengesi / GSYH", yy(h.genelDevletDenge["2026"]), yy(h.genelDevletDenge["2027"]), s(h.genelDevletDenge.sayfa)]
    ]) + "\n<p>Gelirlerin GSYH'ya oranı düşerken harcamalarınki artıyor; genel devlet açığı GSYH'nın yüzde " + v1(-h.genelDevletDenge["2026"]) + "'sinden yüzde " + v1(-h.genelDevletDenge["2027"]) +
    "'üne genişliyor. Kamu sabit sermaye yatırımları 2027'de " + trn(h.kamuYatirimi2027MilyonTL.deger) + " trilyon TL (" + s(h.kamuYatirimi2027MilyonTL.sayfa) + ").</p>");

  out.push('<h2 id="isabet">Enflasyon hedefleri ne kadar tuttu?</h2>\n<p>Yıllık Program her yıl, kendi yılı için bir yıl sonu enflasyon hedefi koyar. Elimizdeki programların hedefini, TÜİK\'in o yılın Aralık ayındaki yıllık TÜFE\'siyle karşılaştırdım.</p>\n' +
    isabetGrafik(ist) + "\n" +
    tablo("Program hedefi ve gerçekleşen yıl sonu enflasyonu", ["Program yılı", "Hedef", "Gerçekleşen", "Fark"],
      ist.map(function (r) {
        return [String(r.program), "%" + v1(r.hedef), r.gerceklesen != null ? "%" + v2(r.gerceklesen) : (r.tahmin != null ? "%" + v1(r.tahmin) + " (tahmin)" : "—"),
          r.sapma != null ? "+" + v1(r.sapma).replace("-", "−") + " puan" : "—"];
      })) +
    "\n<p>Gerçekleşme her yıl hedefin üstünde kaldı. Bu, 2027 hedefinin bir alt sınır gibi okunması gerektiği anlamına gelmez; ama zam ve bütçe hesaplarında hedefi tek senaryo almamak için yeterli gerekçe.</p>");

  out.push('<h2 id="zam">%' + v1(h.tufeYilSonu["2027"]) + ' hedefi zamma nasıl yansır?</h2>\n<p>SSK ve Bağ-Kur aylıkları Temmuz 2027\'de Ocak–Haziran 2027 enflasyonu kadar artar; memur zammı aynı enflasyon ile toplu sözleşmedeki %4\'ten çıkar. ' +
    "Yıllık hedefin yılın iki yarısına eşit dağıldığını varsayarak:</p>\n" +
    tablo("2027'nin ilk yarısı ve Temmuz 2027 zammı, iki senaryo", ["Senaryo", "Aylık ortalama", "Ocak–Haziran 2027", "SSK ve Bağ-Kur", "Memur"], [
      ["Program hedefi tutarsa (%" + v1(z21.yillik * 100) + ")", y2(z21.aylik), y1(z21.yari), y1(z21.emekliTemmuz), y2(z21.memurTemmuz)],
      ["2026 hızı sürerse (%" + v1(z26.yillik * 100) + ")", y2(z26.aylik), y1(z26.yari), y1(z26.emekliTemmuz), y2(z26.memurTemmuz)]
    ]) +
    "\n<p>Hedef, ayda ortalama " + y2(z21.aylik) + " fiyat artışı demek. Son açıklanan üç ayın ortalaması " + y2(son3.aylik) + ". Ocak 2027 zammı ise 2026'nın ikinci yarısına bağlı; onun hesabı " +
    '<a href="../ocak-2027-emekli-zammi/">emekli</a> ve <a href="../ocak-2027-memur-zammi/">memur</a> zammı yazılarında.</p>');

  out.push('<h2 id="sgk">SGK: primler aylıkları artık karşılamıyor</h2>\n<p>Programın SGK tablosu (Tablo I:46) 2027 için ilk kez şunu gösteriyor: toplanan prim, ödenen emekli aylıkları ve gelirlerden az. ' +
    "Sağlık giderleri eklenince açık büyüyor.</p>\n" + sgkGrafik(rows) + "\n" +
    tablo("SGK gelir-gider dengesi (milyar TL, cari fiyatlarla)", ["Kalem"].concat(rows.map(function (r) { return r.yil; })), [
      ["Prim tahsilatı"].concat(rows.map(function (r) { return mly(r.prim); })),
      ["Toplam gelir"].concat(rows.map(function (r) { return mly(r.gelir); })),
      ["Aylık ve gelir ödemeleri"].concat(rows.map(function (r) { return mly(r.sigorta); })),
      ["Toplam gider"].concat(rows.map(function (r) { return mly(r.gider); })),
      ["Gelir-gider farkı"].concat(rows.map(function (r) { return mly(r.fark); })),
      ["Bütçeden transfer"].concat(rows.map(function (r) { return mly(r.transfer); })),
      ["Prim / aylık ödemeleri"].concat(rows.map(function (r) { return y1(r.primSigorta); })),
      ["Prim / toplam gider"].concat(rows.map(function (r) { return y1(r.primGider); }))
    ]) +
    "\n<p>Kırılmanın bir kaynağı gelir tarafında: program, 2026'da SGK gelirlerinin GSYH'ya oranındaki düşüşü açıkça \"devlet katkısının Ağustos ayından itibaren kaldırılması\"na bağlıyor (s." + P.sgk.devletKatkisiSayfa +
    "). Tabloda \"diğer gelirler\" " + mly(P.sgk.digerGelir[2]) + " milyar TL'den " + mly(P.sgk.digerGelir[3]) + " milyar TL'ye iniyor. Devlet katkısının ne olduğunu ve kalkmasının hesabını " +
    '<a href="../sgk-devlet-katkisi-kalkti/">SGK devlet katkısı</a> yazısında anlattım.</p>\n' +
    "<p>Öbür kaynak demografi. Program, çalışan sayısının aylık alan sayısına oranının 2022'de " + v1(ap["2022"]) + " iken 2025'te " + v2(ap["2025"]) + "'ye indiğini ve bunu 2023'teki emeklilik koşulu değişikliğine bağladığını yazıyor (s." + ap.sayfa +
    "). Çırak ve stajyerler hariç oran " + v2(ap.ciraksiz2022) + "'ten " + v2(ap.ciraksiz2025) + "'a geriledi. 2027 hedefi dosya bazında " + v1(ap.hedefDosyaBazinda["2027"]) + " (s." + ap.hedefDosyaBazinda.sayfa + ").</p>");

  var isf = P.isf;
  out.push('<h2 id="isf">İşsizlik Sigortası Fonu</h2>\n<p>Fon hâlâ fazla veriyor, ama fazla küçülüyor: giderler istihdam teşvikleri ve destek programlarıyla primden hızlı büyüyor.</p>\n' +
    tablo("İşsizlik Sigortası Fonu (milyar TL)", ["Kalem"].concat(isf.yillar), [
      ["Prim gelirleri"].concat(isf.prim.map(mly)),
      ["Toplam gelir"].concat(isf.gelirler.map(mly)),
      ["İşsizlik ödeneği ve benzeri"].concat(isf.sigortaGideri.map(mly)),
      ["Toplam gider"].concat(isf.giderler.map(mly)),
      ["Fon varlığı"].concat(isf.fonVarligi.map(mly))
    ]) + "\n<p>Kaynak: Tablo I:47 (s." + isf.sayfa + "). İşsizlik ödeneğinin kendisi giderlerin küçük bir kısmı; kimin ne kadar alacağını <a href=\"../../issizlik-maasi-hesaplama/\">işsizlik maaşı aracı</a> hesaplar.</p>");

  out.push('<h2 id="tedbirler">Programda ne var, ne yok?</h2>\n<p>Sosyal güvenlik ve vergi bölümlerinde ücretliyi ve emekliyi ilgilendiren tedbirler (tedbir numarası ve sayfasıyla):</p>\n<ul>' +
    P.tedbirler.map(function (t) { return "<li><strong>Tedbir " + t.no + "</strong> (s." + t.sayfa + "): " + t.metin + "</li>"; }).join("") + "</ul>\n" +
    "<p>Bunlar yön belirtir; oran, yaş ya da gün sayısı vermez. Programda <strong>gelir vergisi tarifesine, asgari ücrete ya da 2027 zam oranlarına ilişkin bir rakam yok</strong>. " +
    "468 sayfalık metinde \"kademeli emeklilik\" ifadesi de geçmiyor; tedbir 406.2 tersine \"daha çok istihdamda kalmayı\" teşvik eden bir aylık bağlama sistemi öngörüyor. Teklifin TBMM'deki durumu " +
    '<a href="../kademeli-emeklilik-son-durum/">kademeli emeklilik</a> yazısında.</p>');

  out.push('<h2 id="capraz">Programın 2026 rakamları sitenin hesaplarıyla aynı mı?</h2>\n<p>Program 2026\'da yürürlüğe giren düzenlemeleri sayıyor (s.' + P.yururluk2026.sayfa + "–109). Aynı rakamlar sitenin araçlarını besleyen parametrelerde:</p>\n" +
    tablo("Program metni ve sitenin parametreleri", ["Kalem", "Programda", "Sitede", "Sitedeki kaynak"],
      cap.map(function (c) {
        function f(x) { return typeof x === "number" ? (Number.isInteger(x) ? x.toLocaleString("tr-TR") : String(x).replace(".", ",")) : x; }
        return [c.ad, f(c.program), f(c.site) + (c.ayni ? "" : " ✗"), "<code>" + c.kaynak + "</code>"];
      })) +
    "\n<p>" + cap.filter(function (c) { return c.ayni; }).length + " kalemin " + cap.length + "'i aynı. Zam oranlarını program bir ondalıkla yazıyor; site TÜİK serisinden iki ondalıkla hesaplıyor.</p>");

  return out.join("\n\n");
}

function main() {
  var kontrol = process.argv.indexOf("--check") >= 0;
  var bas = "<!-- YP-GOVDE:BASLANGIC -->", bit = "<!-- YP-GOVDE:BITIS -->";
  var sx = fs.readFileSync(YAZI, "utf8"), i = sx.indexOf(bas), j = sx.indexOf(bit);
  if (i < 0 || j < 0) throw new Error("İşaretçi yok: YP-GOVDE");
  var yeni = sx.slice(0, i + bas.length) + "\n" + govde() + "\n" + sx.slice(j);
  if (kontrol) {
    if (yeni !== sx) { console.log("Yıllık Program yazısı güncel değil: node tools/yillik-program-yazisi.js"); return 1; }
    console.log("Yıllık Program yazısı güncel.");
    return 0;
  }
  if (yeni !== sx) { fs.writeFileSync(YAZI, yeni, "utf8"); console.log("Yazı güncellendi."); } else console.log("Değişiklik yok.");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { govde: govde };
