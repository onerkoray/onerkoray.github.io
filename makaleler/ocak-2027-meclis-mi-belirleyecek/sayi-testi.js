#!/usr/bin/env node
/*
 * "Ocak 2027'yi Meclis mi belirleyecek?" yazısının sayıları.
 * Kalem sayımı ve teklif taramaları kalemler.js'ten; emekli zammının kesin
 * kısmı TÜFE serisinden, memur oranı toplu sözleşme modülünden, MTV oranı
 * MTV tarifesinden, yeniden değerleme oranı endeksleme serisinden.
 * Yazıdaki tablo modülle satır satır karşılaştırılır.
 *
 * Kullanım: node makaleler/ocak-2027-meclis-mi-belirleyecek/sayi-testi.js
 */
"use strict";

var path = require("path");
var S = require("../../tools/makale-sayi.js");
var K = require("./kalemler.js");
var EZ = require(path.join(S.KOK, "finans", "emekli-zammi-motoru.js"));
var t = S.yazi(__dirname);

function yz(o, b) { return "%" + (o * 100).toFixed(b == null ? 2 : b).replace(".", ","); }
var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(iso) { var p = iso.split("-"); return +p[2] + " " + AY[+p[1] - 1] + " " + p[0]; }

/* 1 — Kalemler ve karar mercileri. */
var meclis = K.meclisSayisi(), disi = K.meclisDisi(), n = K.KALEMLER.length;
t.yakin("kalem sayısı 11", n, 11, 0);
t.yakin("Meclis oyu gereken 4", meclis, 4, 0);
t.gecsin("standfirst: 11 kalemin 7'si", n + " kalemin " + disi + "'si Meclis oyuna bağlı değil");
t.gecsin("standfirst: 4 başlık", "Meclis'in elindeki " + meclis + " başlıktan");
t.gecsin("tablo alt satırı", disi + " / " + n);
/* Tablodaki her kalem sayfada, Meclis kalemleri "TBMM" ile işaretli. */
var tablo = t.html.slice(t.html.indexOf('id="kalemler"'), t.html.indexOf('id="kesin"'));
var satirlar = tablo.match(/<tr><th scope="row">[\s\S]*?<\/tr>/g) || [];
t.yakin("tablo satırı = kalem sayısı", satirlar.length, n, 0);
K.KALEMLER.forEach(function (k, i) {
  var sat = satirlar[i] || "";
  var ad = (sat.match(/<th scope="row">([^<]*)<\/th>/) || [])[1];
  t.dogru("satır " + (i + 1) + " = " + k.ad, ad === k.ad, ad);
  t.dogru(k.ad + " dayanağı tabloda", sat.indexOf(k.dayanak.split(";")[0].split(" (")[0]) !== -1, k.dayanak);
  t.dogru(k.ad + " Meclis işareti", (sat.indexOf("<strong>TBMM</strong>") !== -1) === (k.merci === "meclis"));
});

/* 2 — Bütçe takvimi (Anayasa m.161). */
var son = K.butceSonGun(2027);
t.dogru("bütçe son günü 17 Ekim 2026", son === "2026-10-17", son);
t.gecsin("bütçe son günü metinde", "en geç " + tarih(son));
var d4 = K.dorduncuYil();
t.dogru("geçen yılın bütçe teklifi 1/280", d4.butceTeklifi && d4.butceTeklifi.esas === "1/280");
t.gecsin("geçen yıl bütçe tarihi", "(" + d4.butceTeklifi.esas + ") " + tarih(d4.butceTeklifi.gelis));
t.dogru("geçen yıl da süre içinde", d4.butceTeklifi.gelis <= K.butceSonGun(2026), d4.butceTeklifi.gelis);

/* 3 — Emekli zammının kesin kısmı: motorun kendi dönem hesabıyla aynı. */
var ka = K.kesinAylar();
t.gecsin("Temmuz TÜFE", "Temmuz " + yz(ka[0].oran));
t.gecsin("Ağustos TÜFE", "Ağustos " + yz(ka[1].oran));
var taban = K.emekliTaban();
var donem = EZ.donem(2027, 1);
var motorIki = donem.aylar.slice(0, 2).reduce(function (b, a) { return b * (1 + a.oran); }, 1) - 1;
t.yakin("taban = motorun Temmuz–Ağustos birikimi", taban, motorIki, 1e-12);
t.dogru("dönemin ilk iki ayı Temmuz ve Ağustos", donem.aylar[0].ay === 7 && donem.aylar[1].ay === 8);
t.gecsin("emekli en az", "en az " + yz(taban));
t.gecsin("SSS emekli", "SSK ve Bağ-Kur için en az " + yz(taban));

/* 4 — Memur. */
t.gecsin("memur taban", "Memur zammı en az " + yz(K.memurTaban(), 0));
t.gecsin("2026 ikinci yarı oranı", "o dönemin " + yz(K.memurIkinciYari(), 0) + "'lik");
t.gecsin("fark eşiği", "birikiminin " + yz(K.farkEsigi()) + "'ü aşması");
t.yakin("fark eşiği tanımı", (1 + K.emekliTaban()) * (1 + K.farkEsigi()), 1 + K.memurIkinciYari(), 1e-12);

/* 5 — MTV 2026. */
t.gecsin("YDO 2026", "oranı " + yz(K.ydo2026()) + " iken");
t.gecsin("MTV oranı", "MTV tutarları " + yz(K.mtvOrani2026()) + " ile");
t.gecsin("MTV payı", "oranın " + yz(K.mtvYdoPayi(), 1) + "'üyle");
t.dogru("MTV payı Cumhurbaşkanı bandında (%20–%150)", K.mtvYdoPayi() >= 0.2 && K.mtvYdoPayi() <= 1.5);

/* 6 — 5. Yasama Yılı teklifleri (3 Ekim anlık görüntüsü). */
var o = K.teklifOzeti();
t.yakin("102 teklif", o.sayi, 102, 0);
t.gecsin("teklif sayısı metinde", "kayıtlı " + o.sayi + " kanun teklifi");
t.gecsin("geliş aralığı", tarih(o.ilkGelis).replace(" 2026", "") + " ile " + tarih(o.sonGelis).replace(" 2026", "") + " arasında");
t.dogru("hepsi komisyonda", o.komisyonda === o.sayi);
t.gecsin("tek imzalı", o.tekImzali + "'ü tek milletvekilinin teklifi");
t.gecsin("en çok imza", "biri " + o.enCokImza + " imzalı");
t.gecsin("mali teklifler", o.mali + "'u vergi, prim ya da emeklilik kanunlarına dokunuyor");
t.dogru("mali tekliflerin hepsi tek imzalı", o.maliEnCokImza === 1, o.maliEnCokImza);
t.gecsin("SSS mali", "102 teklifin " + o.mali + "'u");
t.gecsin("örnek torba imza", K.ORNEK_TORBA.esas + " esas numaralı torba teklif " + K.ORNEK_TORBA.imza + " imzayla");

/* 7 — 4. Yasama Yılı: imza sayısı ve kanunlaşma. */
t.yakin("4. yıl milletvekili teklifi", d4.toplam, 533, 0);
t.gecsin("4. yıl toplam", d4.toplam + " milletvekili teklifini");
t.gecsin("az imzalı", "Bir ya da iki imzalı " + d4.az.sayi + " tekliften yalnız " + d4.az.kanunlasti + "'i kanunlaştı: " + yz(d4.az.oran, 1));
t.gecsin("çok imzalı", "Yirmi ve daha fazla imzalı " + d4.cok.sayi + " tekliften " + d4.cok.kanunlasti + "'i kanunlaştı: " + yz(d4.cok.oran, 1));
t.dogru("çok imzalının oranı az imzalının 20 katından fazla", d4.cok.oran > 20 * d4.az.oran);

/* 8 — Kademeli emeklilik teklifi ve 5. yıl: kademeli düzenleyen teklif yok. */
t.gecsin("2/2755", "2/2755 esas numaralı teklif 6 Aralık 2024'ten beri");
t.dogru("5. yılda kademeli emeklilik teklifi yok",
  K.TEKLIFLER.filter(function (x) { return /kademeli emeklilik|8\/9\/1999/i.test(x.metin); }).length === 0);

t.bitir("Kalemler " + disi + "/" + n + ", emekli tabanı " + yz(taban) + ", teklif " + o.sayi + ".");
