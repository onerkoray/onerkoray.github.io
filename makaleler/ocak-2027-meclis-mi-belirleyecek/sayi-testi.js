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
t.gecsin("bütçe son günü metinde", "son gün " + tarih(son));
/* 2027 bütçe teklifi sunuldu: tarih bütçe modülünün kaynağından. */
var BU = require(path.join(S.KOK, "finans", "butce.js"));
var sunus = BU.KAYNAK.teklifTarihi;
t.dogru("teklif son günden önce", sunus <= son, sunus);
t.gecsin("kısa cevap: teklif sunuldu", "teklif " + tarih(sunus) + "'da, son günden bir gün önce Meclis'e sunuldu");
t.gecsin("tablo: teklif sunuldu", "Teklif " + tarih(sunus) + "'da sunuldu");
t.gecsin("SSS: teklif sunuldu", "Teklif " + tarih(sunus) + "'da sunuldu; Anayasa m.161'e göre son gün 17 Ekim'di");
t.gecmesin("bayat 'en geç' cümlesi", "teklif en geç 17 Ekim 2026'da gelir");
t.dogru("gecerlilik ileri alındı", /name="gecerlilik" content="2026-11-04 \|/.test(t.html));
t.dogru("yayın tarihi korunuyor", /"datePublished": "2026-10-03"/.test(t.html));
t.gecsin("güncelleme satırı", "Güncelleme: 17 Ekim 2026");
var d4 = K.dorduncuYil();
t.dogru("geçen yılın bütçe teklifi 1/280", d4.butceTeklifi && d4.butceTeklifi.esas === "1/280");
t.gecsin("geçen yıl bütçe tarihi", "(" + d4.butceTeklifi.esas + ") " + tarih(d4.butceTeklifi.gelis));
t.dogru("geçen yıl da süre içinde", d4.butceTeklifi.gelis <= K.butceSonGun(2026), d4.butceTeklifi.gelis);

/* 3 — Emekli zammının kesin kısmı: motorun kendi dönem hesabıyla aynı.
 * Açıklanmış aylar KESIN_AYLAR'dan; motorun dönemi Temmuz'dan başlar. */
var ka = K.kesinAylar(), AYAD = { "07": "Temmuz", "08": "Ağustos", "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık" };
t.dogru("açıklanmış üç ay", ka.length === 3, ka.length);
ka.forEach(function (a) { t.gecsin(a.ay + " TÜFE", AYAD[a.ay.slice(5)] + " " + yz(a.oran)); });
var taban = K.emekliTaban();
var donem = EZ.donem(2027, 1);
var motorKesin = donem.aylar.slice(0, ka.length).reduce(function (b, a) { return b * (1 + a.oran); }, 1) - 1;
t.yakin("taban = motorun açıklanmış aylar birikimi", taban, motorKesin, 1e-12);
t.dogru("dönemin ilk ayları Temmuz–Eylül", donem.aylar[0].ay === 7 && donem.aylar[1].ay === 8 && donem.aylar[2].ay === 9);
t.gecsin("emekli en az", "SSK ve Bağ-Kur zammı en az " + yz(taban));
t.gecsin("üçünün bileşiği", "Üçünün bileşiği " + yz(taban) + ". Kalan üç ayın");
t.gecsin("SSS emekli", "SSK ve Bağ-Kur için en az " + yz(taban) + ". Ocak zammı");
t.gecsin("SSS emekli payı", "bunun " + yz(taban) + "'sını oluşturuyor");

/* 4 — Memur. */
t.gecsin("memur taban", "Memur zammı en az " + yz(K.memurTaban(), 0));
t.gecsin("2026 ikinci yarı oranı", "o dönemin " + yz(K.memurIkinciYari(), 0) + "'lik");
t.gecsin("fark eşiği", "Temmuz–Eylül'ün " + yz(taban) + "'sından sonra farkın doğması için Ekim–Aralık birikiminin " + yz(K.farkEsigi()) + "'yı aşması");
t.yakin("fark eşiği tanımı", (1 + K.emekliTaban()) * (1 + K.farkEsigi()), 1 + K.memurIkinciYari(), 1e-12);

/* 5 — MTV 2026. */
t.gecsin("YDO 2026", "oranı " + yz(K.ydo2026()) + " iken");
t.gecsin("MTV oranı", "MTV tutarları " + yz(K.mtvOrani2026()) + " ile");
t.gecsin("MTV payı", "oranın " + yz(K.mtvYdoPayi(), 1) + "'üyle");
t.dogru("MTV payı Cumhurbaşkanı bandında (%20–%150)", K.mtvYdoPayi() >= 0.2 && K.mtvYdoPayi() <= 1.5);

/* 6 — 5. Yasama Yılı teklifleri (3 Ekim anlık görüntüsü). */
var o = K.teklifOzeti();
t.yakin("102 teklif", o.sayi, 102, 0);
t.gecsin("teklif sayısı metinde", "Yasama Yılı'na kayıtlı " + o.sayi + " teklif var");
t.gecsin("geliş aralığı", tarih(o.ilkGelis).replace(" 2026", "") + " ile " + tarih(o.sonGelis).replace(" 2026", "") + " arasında");
t.dogru("hepsi komisyonda", o.komisyonda === o.sayi);
t.gecsin("tek imzalı", o.tekImzali + "'ü tek milletvekilinin teklifi");
t.gecsin("en çok imza", "biri " + o.enCokImza + " imzalı");
t.gecsin("mali teklifler", o.mali + "'u vergi, prim ya da emeklilik kanunlarına dokunuyor");
t.dogru("mali tekliflerin hepsi tek imzalı", o.maliEnCokImza === 1, o.maliEnCokImza);
t.gecsin("SSS mali", "102 teklifin " + o.mali + "'u");
t.gecsin("örnek torba imza", K.ORNEK_TORBA.esas + " esas numaralı torba teklif " + K.ORNEK_TORBA.imza + " imzayla");

/* 6b — 17 Ekim taraması: 3 Ekim'den sonra giren kayıtlar. */
var y = K.yeniTaramaOzeti();
t.yakin("liste toplamı 149", y.toplam, 149, 0);
t.dogru("eklenenler = milletvekili + bütçe", y.eklenen === y.milletvekili + 1);
t.dogru("bütçe teklifi 1/282, 16 Ekim", y.butce && y.butce.esas === "1/282" && y.butce.gelis === BU.KAYNAK.teklifTarihi);
t.dogru("yeni esaslar aralıksız", +y.sonEsas.split("/")[1] - +y.ilkEsas.split("/")[1] + 1 === y.milletvekili);
t.dogru("3 Ekim listesi yeni aralıktan önce biter", Math.max.apply(null, K.TEKLIFLER.map(function (x) { return +x.esas.split("/")[1]; })) + 1 === +y.ilkEsas.split("/")[1]);
t.dogru("hepsi komisyonda (17 Ekim)", y.komisyonda === y.eklenen);
var ucUstu = K.TEKLIFLER.filter(function (x) { return x.imza > 3; }).length + y.cokImzali.length;
t.gecsin("kısa cevap 17 Ekim", "listesinde " + y.toplam + " kayıt: " + (o.sayi + y.milletvekili) + " milletvekili teklifi ve 2027 bütçe teklifi");
t.yakin("üçten fazla imzalı iki", ucUstu, 2, 0);
t.gecsin("kısa cevap imza", "yalnız ikisi üçten fazla imzalı");
t.gecsin("güncelleme paragrafı", "kayıt sayısı " + y.toplam + "'a çıktı. 3 Ekim'den sonra giren " + y.eklenen + " kaydın " + y.milletvekili +
  "'sı milletvekili teklifi (" + y.ilkEsas + "–" + y.sonEsas + "), biri 16 Ekim'de gelen 2027 bütçe teklifi (" + y.butce.esas + ")");
t.gecsin("en fazla üç imzalı", y.milletvekili + " teklifin " + y.enFazlaUcImzali + "'i en fazla üç imzalı; başlığına göre " + y.mali + "'u vergi");
t.dogru("tek çok imzalı teklif", y.cokImzali.length === 1 && y.cokImzali[0].esas === "2/3939");
t.gecsin("2/3939", y.cokImzali[0].imza + " imzalı " + y.cokImzali[0].esas + " ve yalnız tasfiyesine karar verilen yatırım fonlarını");
t.dogru("2/3939 başlığı yatırım fonları", /Yatırım Fonları/.test(y.cokImzali[0].baslik));
t.gecsin("SSS yeni teklifler", "Sonra gelen " + y.milletvekili + " teklifin başlığına göre " + y.mali + "'u bu kanunlara dokunuyor; hepsi tek imzalı");
t.dogru("yeni mali tekliflerin hepsi tek imzalı", K.YENI_TEKLIFLER.filter(function (x) { return x.esas[0] === "2" && /Katma Değer|Sosyal Sigortalar|İşsizlik Sigortası|Harçlar/.test(x.baslik); }).every(function (x) { return x.imza === 1; }));

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
