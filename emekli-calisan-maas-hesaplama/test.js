#!/usr/bin/env node
/*
 * Emekli çalışan (SGDP) — sayfadaki metin ve SSS rakamları motordan.
 * Rakam sayfaya elle yazılır, burada bordro motorundan yeniden üretilir;
 * parametre değişip sayfa güncellenmezse kırmızı.
 *
 * Kullanım: node emekli-calisan-maas-hesaplama/test.js
 */
"use strict";

var S = require("../tools/makale-sayi.js");
var B = S.bordro();
var t = S.yazi(__dirname);

var YIL = 2026, P = B.parametre(YIL), d = B.donem(P, 1), o = B.oranlarAy(P, 1);

/* Oranlar: metindeki yüzdeler parametrelerden. */
t.gecsin("işçi oranı", "prime esas kazanç × %" + S.yuzde(o.sgdpIsci, 1));
t.gecsin("işveren oranı", "(%" + S.yuzde(o.sgdpIsveren, 1) + " + %" + S.yuzde(o.kisaVadeli) + ") = %" + S.yuzde(o.sgdpIsveren + o.kisaVadeli));
t.gecsin("normal işveren", "%" + S.yuzde(o.sgkIsveren) + " SGK ve %" + S.yuzde(o.issizlikIsveren, 0) + " işsizlik, toplam %" + S.yuzde(o.sgkIsveren + o.issizlikIsveren));
t.gecsin("normal kesinti", "%" + S.yuzde(o.sgkIsci + o.issizlikIsci, 0) + "'tir (%" + S.yuzde(o.sgkIsci, 0) + " SGK, %" + S.yuzde(o.issizlikIsci, 0) + " işsizlik)");
t.dogru("indirim 2 ve 5 puan", B.tesvikOrani(o, { tesvik: "genel" }) === 0.02 && B.tesvikOrani(o, { tesvik: "imalat" }) === 0.05);

/* Asgari ücret örneği */
var ae = B.hesaplaYil(d.asgariBrut, YIL, { sgdp: true }).aylar[0];
var an = B.hesaplaYil(d.asgariBrut, YIL).aylar[0];
t.gecsin("asgari net", "Ocak ayında " + S.tl(ae.net) + " TL");
t.gecsin("asgari kesinti", "Brüt " + S.tam(d.asgariBrut) + " TL'den " + S.tl(ae.sgk) + " TL SGDP ve " + S.tl(ae.gelirVergisi) + " TL gelir vergisi");
t.gecsin("normal asgari net", "asgari ücretlinin neti " + S.tl(an.net) + " TL");
t.gecsin("asgari maliyet", "emeklide " + S.tl(ae.isverenMaliyeti) + " TL, emekli olmayanda teşviksiz " + S.tl(an.isverenMaliyeti) + " TL");

/* Brüt 80.000 örneği */
var b80e = B.hesaplaYil(80000, YIL, { sgdp: true }).aylar[0];
var b80g = B.hesaplaYil(80000, YIL, { tesvik: "genel" }).aylar[0];
t.gecsin("80.000 maliyet", "ayda " + S.tl(b80e.isverenMaliyeti) + " TL'ye mal olur; emekli olmayan aynı çalışan indirimle " + S.tl(b80g.isverenMaliyeti) + " TL'ye");
t.dogru("başlangıç değeri 80.000", /id="ec-tutar"[^>]*value="80\.000"/.test(t.html));

/* Net 60.000 örneği */
function net(h, sec) { return B.hesaplaYil(B.nettenBruteYil(h, YIL, sec), YIL, sec); }
var ne = net(60000, { sgdp: true }), nn = net(60000, {}), ng = net(60000, { tesvik: "genel" });
t.gecsin("60.000 brüt", "ocak brütü emeklide " + S.tl(ne.aylar[0].brut) + " TL, emekli olmayan çalışanda " + S.tl(nn.aylar[0].brut) + " TL");
t.gecsin("60.000 maliyet", "Yıllık maliyet emeklide " + S.tl(ne.toplam.isverenMaliyeti) + " TL, indirimli emekli olmayan çalışanda " + S.tl(ng.toplam.isverenMaliyeti) + " TL; fark " + S.tl(ng.toplam.isverenMaliyeti - ne.toplam.isverenMaliyeti) + " TL");
t.gecsin("SSS 60.000", "yıllık maliyet emeklide " + S.tl(ne.toplam.isverenMaliyeti) + " TL, indirimli emekli olmayan çalışanda " + S.tl(ng.toplam.isverenMaliyeti) + " TL");

/* Yapısal veri görünür SSS ile aynı rakamları söylüyor */
var ld = JSON.parse(t.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
var faq = ld["@graph"].filter(function (x) { return x["@type"] === "FAQPage"; })[0];
var faqMetin = faq.mainEntity.map(function (q) { return q.acceptedAnswer.text; }).join(" ");
[S.tl(ae.net), S.tl(ae.sgk), S.tl(ae.gelirVergisi), S.tl(an.net), S.tl(ne.toplam.isverenMaliyeti), S.tl(ng.toplam.isverenMaliyeti)].forEach(function (x) {
  t.dogru("yapısal SSS'de " + x, faqMetin.indexOf(x) !== -1);
});
t.bitir();
