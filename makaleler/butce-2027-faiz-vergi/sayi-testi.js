#!/usr/bin/env node
/*
 * "2027 bütçesinde faiz ve vergi" yazısının sayıları.
 * Tablo finans/butce.js'ten (OVP 2027-2029, Tablo 1.1 ve 1.6; 2027 için
 * bütçe teklifi, Bütçe Gerekçesi Tablo 1), bordro
 * örneği bordro/motor.js'ten. Önce tablonun kendi kimlikleri denetlenir:
 * elle girilen bir rakam yanlışsa toplam tutmaz.
 *
 * Kullanım: node makaleler/butce-2027-faiz-vergi/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var Bu = require(path.join(S.KOK, "finans", "butce.js"));
var B = S.bordro();
var t = S.yazi(__dirname);

function bir(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function oran(d) { return 100 * d.faiz / d.vergi; }

/* 1 — Tablonun kimlikleri (OVP yuvarlaması: 0,15 milyar TL). */
Bu.YILLAR.forEach(function (y) {
  var d = Bu.yil(y);
  var kalem = d.personel + d.sgkDevletPrimi + d.malHizmet + d.cariTransfer + d.sermayeGideri +
    d.sermayeTransferi + d.borcVerme + d.yedekOdenek;
  t.yakin(y + " kalemler = faiz hariç harcama", kalem, d.faizHaricHarcama, 0.15);
  t.yakin(y + " faiz hariç + faiz = harcamalar", d.faizHaricHarcama + d.faiz, d.harcamalar, 0.15);
  t.yakin(y + " vergi + diğer = gelirler", d.vergi + d.digerGelir, d.gelirler, 0.15);
  t.yakin(y + " denge = gelir − gider", d.gelirler - d.harcamalar, d.denge, 0.15);
  t.yakin(y + " faiz dışı denge = denge + faiz", d.denge + d.faiz, d.faizDisiDenge, 0.15);
  /* Tablonun GSYH'ya oran bölümüyle çapraz kontrol (bir ondalık). */
  var gsyhOran = { 2025: [3.2, 17.5], 2026: [3.3, 17.1], 2027: [3.6, 17.9], 2028: [3.5, 18.0], 2029: [3.4, 18.1] }[y];
  t.yakin(y + " faiz/GSYH tablodaki oranla", 100 * d.faiz / d.gsyh, gsyhOran[0], 0.05);
  t.yakin(y + " vergi/GSYH tablodaki oranla", 100 * d.vergi / d.gsyh, gsyhOran[1], 0.05);
});

/* 2 — Beş yılın tablosu ve zirve. */
Bu.YILLAR.forEach(function (y) {
  var d = Bu.yil(y);
  t.gecsin(y + " satırı", y + " " + bir(d.vergi) + " " + bir(d.faiz) + " " + S.tl(oran(d)) + " TL " + d.durum);
});
var zirve = Bu.YILLAR.reduce(function (m, y) { return oran(Bu.yil(y)) > oran(Bu.yil(m)) ? y : m; });
t.dogru("zirve 2027", zirve === 2027, String(zirve));

var a = Bu.yil(2025), b = Bu.yil(2026), c = Bu.yil(2027);
/* 2027 cümleleri teklife dayanır; teklif yoksa OVP. Makro (GSYH, istihdam,
 * nüfus) yalnız OVP'de var, teklif satırına oradan eklenir. */
var k = Bu.teklifVar() ? Object.assign({}, c, Bu.yil(2027, "teklif")) : c;
t.gecsin("standfirst", "Bütçe teklifine göre " + S.tl(oran(k)) + " TL. 16 Ekim 2026'da Meclis'e sunulan teklifte merkezî yönetimin 2027 faiz ödeneği " +
  bir(k.faiz) + " milyar TL, genel bütçe vergi gelirleri tahmini " + bir(k.vergi) + " milyar TL; ikisi de Eylül'deki Orta Vadeli Program'la aynı. Oran 2025'te " +
  S.tl(oran(a)) + ", 2026'da " + S.tl(oran(b)) + "'ydi");
t.gecsin("kısa cevap", "Her 100 TL vergiye karşılık " + S.tl(oran(k)) + " TL faiz ödeniyor");
t.dogru("teklifte faiz ve vergi OVP ile aynı", k.faiz === c.faiz && Math.abs(k.vergi - c.vergi) < 0.05);

/* 3 — Artış. */
t.gecsin("artış", "vergi gelirleri " + S.tl(c.vergi - b.vergi) + " milyar TL (%" + S.yuzde(c.vergi / b.vergi - 1, 1) + ") artıyor; faiz gideri " +
  S.tl(c.faiz - b.faiz) + " milyar TL (%" + S.yuzde(c.faiz / b.faiz - 1, 1) + ")");
t.gecsin("yeni verginin payı", "her 100 TL verginin " + S.yuzde((c.faiz - b.faiz) / (c.vergi - b.vergi), 1) + " TL'si artan faize");
t.gecsin("GSYH artışı", "nominal GSYH %" + S.yuzde(c.gsyh / b.gsyh - 1, 1) + " büyüyor");
t.dogru("faiz vergiden, vergi GSYH'dan hızlı", c.faiz / b.faiz > c.vergi / b.vergi && c.vergi / b.vergi > c.gsyh / b.gsyh);

/* 4 — Açık (teklif; parantezde OVP). */
t.gecsin("açık", "Bütçe teklifi 2027 için " + bir(-k.denge) + " milyar TL bütçe açığı öngörüyor (OVP: " + bir(-c.denge) + ")");
t.gecsin("faiz dışı denge", "bütçe " + bir(k.faizDisiDenge) + " milyar TL fazla veriyor (faiz dışı denge, GSYH'nın %" + S.yuzde(k.faizDisiDenge / k.gsyh, 1) + "'i)");
t.dogru("faiz açıktan büyük", k.faiz > -k.denge);
t.gecsin("harcama ve gelir payı", "Faiz, toplam harcamaların %" + S.yuzde(k.faiz / k.harcamalar, 1) + "'sı, toplam gelirlerin %" + S.yuzde(k.faiz / k.gelirler, 1) + "'sı");

/* 5 — Çalışan ve kişi başına (milyar TL / bin kişi). */
var calisan = k.faiz * 1e9 / (k.istihdam * 1e3), kisi = k.faiz * 1e9 / (k.nufus * 1e3);
t.gecsin("istihdam", "istihdam varsayımı " + S.tam(k.istihdam) + " bin kişi");
t.gecsin("çalışan başına", "çalışan başına yılda " + S.tam(calisan) + " TL, ayda " + S.tam(calisan / 12) + " TL çıkıyor; nüfusa bölünce kişi başına " + S.tam(kisi) + " TL");

/* 6 — Bordro örneği: 2026 tarifesi, 80.000 TL brüt. */
var gv = B.hesaplaYil(80000, 2026).toplam.gelirVergisi;
t.gecsin("bordro", "ayda 80.000 TL brüt kazanan bir çalışan yılda " + S.tl(gv) + " TL gelir vergisi öder. 2027 oranıyla bunun " +
  S.tl(gv * k.faiz / k.vergi) + " TL'si, ayda " + S.tl(gv * k.faiz / k.vergi / 12) + " TL");

/* 7 — SSS. */
t.gecsin("SSS faiz", "Bütçe teklifine göre " + bir(k.faiz) + " milyar TL, GSYH'nın %" + S.yuzde(k.faiz / k.gsyh, 1) + "'sı; Orta Vadeli Program'la aynı. 2026 gerçekleşme tahmini " + bir(b.faiz) + " milyar TL");
t.gecsin("SSS oran", "genel bütçe vergi gelirlerinin %" + S.tl(oran(k)) + "'si");
t.gecsin("SSS sunuluş", "2027 bütçe teklifi ne zaman Meclis'e sunuldu? 16 Ekim 2026'da");

/* 8 — Akış diyagramı: başlıktaki iki tutar teklif tablosundan. */
t.gecsin("diyagram başlığı", "borçlanma (" + bir(-k.denge) + " milyar TL) ile faiz gideri (" + bir(k.faiz) + " milyar TL) neredeyse aynı kalınlıkta");
t.gecsin("diyagram faiz şeridi", "Bütçe → Faiz: " + bir(k.faiz) + " mr TL");
t.gecsin("diyagram borçlanma şeridi", "Borçlanma (açık) → Bütçe: " + bir(-k.denge) + " mr TL");
t.gecsin("diyagram vergi şeridi", "Vergi gelirleri → Bütçe: " + bir(k.vergi) + " mr TL");

if (Bu.teklifVar()) {
  var T = Bu.yil(2027, "teklif");
  /* 9 — Teklif tablosunun kimlikleri (milyon TL'den girildi: 0,005). */
  var kalemT = T.personel + T.sgkDevletPrimi + T.malHizmet + T.cariTransfer + T.sermayeGideri +
    T.sermayeTransferi + T.borcVerme + T.yedekOdenek;
  t.yakin("teklif kalemler = faiz hariç harcama", kalemT, T.faizHaricHarcama, 0.005);
  t.yakin("teklif faiz hariç + faiz = harcamalar", T.faizHaricHarcama + T.faiz, T.harcamalar, 0.005);
  t.yakin("teklif vergi + diğer = gelirler", T.vergi + T.digerGelir, T.gelirler, 0.005);
  t.yakin("teklif denge = gelir − gider", T.gelirler - T.harcamalar, T.denge, 0.005);
  t.yakin("teklif faiz dışı denge = denge + faiz", T.denge + T.faiz, T.faizDisiDenge, 0.005);

  /* 10 — Karşılaştırma tablosu: her satır iki kaynaktan, fark hesapla. */
  function fark(x, ond) {
    var r = Math.round(x * Math.pow(10, ond)) / Math.pow(10, ond);
    var m = Math.abs(r).toLocaleString("tr-TR", { minimumFractionDigits: ond, maximumFractionDigits: ond });
    return r > 0 ? "+" + m : r < 0 ? "−" + m : m;
  }
  [["Faiz gideri", "faiz"], ["Genel bütçe vergi gelirleri", "vergi"], ["Toplam gelirler", "gelirler"],
   ["Sermaye giderleri", "sermayeGideri"], ["Toplam harcamalar", "harcamalar"]].forEach(function (r) {
    t.gecsin("tablo " + r[0], r[0] + " " + bir(c[r[1]]) + " " + bir(T[r[1]]) + " " + fark(T[r[1]] - c[r[1]], 1));
  });
  t.gecsin("tablo açık", "Bütçe açığı " + bir(-c.denge) + " " + bir(-T.denge) + " " + fark(c.denge - T.denge, 1));
  t.gecsin("tablo faiz dışı", "Faiz dışı denge " + bir(c.faizDisiDenge) + " " + bir(T.faizDisiDenge) + " " + fark(T.faizDisiDenge - c.faizDisiDenge, 1));
  t.gecsin("tablo oran", "100 TL vergiye faiz " + S.tl(oran(c)) + " TL " + S.tl(oran(T)) + " TL " + fark(oran(T) - oran(c), 2));
  t.dogru("yuvarlanmış oran aynı", S.tl(oran(c)) === S.tl(oran(T)));

  /* 11 — Karşılaştırma paragrafı ve not. */
  var dSer = T.sermayeGideri - c.sermayeGideri;
  t.gecsin("paragraf sermaye", "Harcamalarda tek fark sermaye giderlerinde: " + bir(c.sermayeGideri) + " yerine " + bir(T.sermayeGideri) + " milyar TL. Bu " +
    bir(dSer) + " milyar TL, açığı " + bir(-T.denge) + " milyar TL'ye, faiz dışı fazlayı " + bir(T.faizDisiDenge) + " milyar TL'ye taşıyor");
  t.gecsin("paragraf vergi milyon", "vergi tahmini teklifte " + Math.round(T.vergi * 1000).toLocaleString("tr-TR") + " milyon TL, OVP bunu " + bir(c.vergi) + " milyar TL olarak yuvarlıyor");
  t.gecsin("not sermaye", "tek fark sermaye giderlerinde, " + bir(dSer) + " milyar TL");
  /* Teklifin dışında hiçbir kalem OVP'den sapmıyor (yalnız sermaye ve ondan türeyenler). */
  ["personel", "sgkDevletPrimi", "malHizmet", "cariTransfer", "sermayeTransferi", "borcVerme", "yedekOdenek", "digerGelir"].forEach(function (x) {
    t.yakin("teklif " + x + " OVP ile aynı", T[x], c[x], 0.15);
  });

  /* 12 — Tarihler: yayın korunur, güncelleme ayrı satır, bildirim kanunlaşmaya bağlı. */
  t.dogru("yayın tarihi korunuyor", /"datePublished": "2026-10-02"/.test(t.html));
  t.dogru("dateModified teklif okuma günü", /"dateModified": "2026-10-17"/.test(t.html));
  t.gecsin("görünür güncelleme satırı", "Güncelleme: 17 Ekim 2026");
  t.dogru("gecerlilik bildirimi kanunlaşmaya bağlı", /name="gecerlilik" content="2026-12-31 \|/.test(t.html));
  t.gecmesin("eski güncelleme vaadi", "Bu yazı 17 Ekim 2026'da güncellenecek");
  t.dogru("teklif tarihi kaynakta", Bu.KAYNAK.teklifTarihi === "2026-10-16");
} else {
  /* Teklif henüz yokken yazı teklif rakamı iddia etmemeli. */
  t.gecmesin("teklif rakamı yok", "Teklife göre");
  t.dogru("gecerlilik bildirimi teklif tarihine bağlı", /name="gecerlilik" content="2026-10-17 \|/.test(t.html));
  t.gecsin("okura güncelleme notu", "Bu yazı 17 Ekim 2026'da güncellenecek");
}
t.bitir(Bu.teklifVar() ? "Teklif girildi; 2027 cümleleri tekliften." : "Teklif bekleniyor; rakamlar OVP'den.");
