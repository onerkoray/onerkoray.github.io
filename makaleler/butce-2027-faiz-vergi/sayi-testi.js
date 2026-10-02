#!/usr/bin/env node
/*
 * "2027 bütçesinde faiz ve vergi" yazısının sayıları.
 * Tablo finans/butce.js'ten (OVP 2027-2029, Tablo 1.1 ve 1.6), bordro
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
t.gecsin("standfirst", "Orta Vadeli Program'a göre " + S.tl(oran(c)) + " TL. Merkezî yönetimin 2027 faiz gideri " + bir(c.faiz) +
  " milyar TL, genel bütçe vergi gelirleri " + bir(c.vergi) + " milyar TL. Oran 2025'te " + S.tl(oran(a)) + ", 2026'da " + S.tl(oran(b)) + "'ydi");
t.gecsin("kısa cevap", "Her 100 TL vergiye karşılık " + S.tl(oran(c)) + " TL faiz ödeniyor");

/* 3 — Artış. */
t.gecsin("artış", "vergi gelirleri " + S.tl(c.vergi - b.vergi) + " milyar TL (%" + S.yuzde(c.vergi / b.vergi - 1, 1) + ") artıyor; faiz gideri " +
  S.tl(c.faiz - b.faiz) + " milyar TL (%" + S.yuzde(c.faiz / b.faiz - 1, 1) + ")");
t.gecsin("yeni verginin payı", "her 100 TL verginin " + S.yuzde((c.faiz - b.faiz) / (c.vergi - b.vergi), 1) + " TL'si artan faize");
t.gecsin("GSYH artışı", "nominal GSYH %" + S.yuzde(c.gsyh / b.gsyh - 1, 1) + " büyüyor");
t.dogru("faiz vergiden, vergi GSYH'dan hızlı", c.faiz / b.faiz > c.vergi / b.vergi && c.vergi / b.vergi > c.gsyh / b.gsyh);

/* 4 — Açık. */
t.gecsin("açık", "OVP 2027 için " + bir(-c.denge) + " milyar TL bütçe açığı");
t.gecsin("faiz dışı denge", "bütçe " + bir(c.faizDisiDenge) + " milyar TL fazla veriyor (faiz dışı denge, GSYH'nın %" + S.yuzde(c.faizDisiDenge / c.gsyh, 1) + "'i)");
t.dogru("faiz açıktan büyük", c.faiz > -c.denge);
t.gecsin("harcama ve gelir payı", "Faiz, toplam harcamaların %" + S.yuzde(c.faiz / c.harcamalar, 1) + "'sı, toplam gelirlerin %" + S.yuzde(c.faiz / c.gelirler, 1) + "'sı");

/* 5 — Çalışan ve kişi başına (milyar TL / bin kişi). */
var calisan = c.faiz * 1e9 / (c.istihdam * 1e3), kisi = c.faiz * 1e9 / (c.nufus * 1e3);
t.gecsin("istihdam", "istihdam varsayımı " + S.tam(c.istihdam) + " bin kişi");
t.gecsin("çalışan başına", "çalışan başına yılda " + S.tam(calisan) + " TL, ayda " + S.tam(calisan / 12) + " TL çıkıyor; nüfusa bölünce kişi başına " + S.tam(kisi) + " TL");

/* 6 — Bordro örneği: 2026 tarifesi, 80.000 TL brüt. */
var gv = B.hesaplaYil(80000, 2026).toplam.gelirVergisi;
t.gecsin("bordro", "ayda 80.000 TL brüt kazanan bir çalışan yılda " + S.tl(gv) + " TL gelir vergisi öder. 2027 oranıyla bunun " +
  S.tl(gv * c.faiz / c.vergi) + " TL'si, ayda " + S.tl(gv * c.faiz / c.vergi / 12) + " TL");

/* 7 — SSS ve teklif bölümü. */
t.gecsin("SSS faiz", "Orta Vadeli Program'a göre " + bir(c.faiz) + " milyar TL, GSYH'nın %" + S.yuzde(c.faiz / c.gsyh, 1) + "'sı. 2026 gerçekleşme tahmini " + bir(b.faiz) + " milyar TL");
t.gecsin("SSS oran", "genel bütçe vergi gelirlerinin %" + S.tl(oran(c)) + "'si");
t.gecsin("teklif karşılaştırması", "faiz ödeneği OVP'deki " + bir(c.faiz) + " milyar TL'den sapıyor mu, vergi geliri tahmini " + bir(c.vergi) + " milyar TL'den, ve ikisinin oranı " + S.tl(oran(c)) + "'den");

/* 8 — Teklif henüz yokken yazı teklif rakamı iddia etmemeli. */
if (!Bu.teklifVar()) {
  t.gecmesin("teklif rakamı yok", "Teklife göre");
  t.dogru("gecerlilik bildirimi teklif tarihine bağlı", /name="gecerlilik" content="2026-10-17 \|/.test(t.html));
  t.gecsin("okura güncelleme notu", "Bu yazı 17 Ekim 2026'da güncellenecek");
  t.gecsin("standfirst güncelleme", "en geç 17 Ekim 2026'da Meclis'e sunulacak bütçe teklifinin rakamlarıyla güncellenecek");
}
t.bitir(Bu.teklifVar() ? "Teklif girildi." : "Teklif bekleniyor; rakamlar OVP'den.");
