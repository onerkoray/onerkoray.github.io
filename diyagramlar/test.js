#!/usr/bin/env node
/*!
 * Diyagramlar sayfası — her iddia ikinci bir yoldan.
 *
 * hesap.js rakamları motordan alır. Burada aynı rakamlar motor ÇAĞRILMADAN,
 * parametre dosyasındaki oranlar ve tarifeyle kapalı formülden yeniden
 * kurulur:
 *   - yıllık gelir vergisi, aylık kümülatif hesabın toplamı olduğu için
 *     tarife(yıllık matrah) − tarife(yıllık asgari matrah)'a indirgenir;
 *   - kredi taksiti anüite formülüyle, anaparanın faizi geçtiği ay kalan
 *     borcun taksit ÷ (2 × maliyet oranı) eşiğinin altına indiği ayla;
 *   - SGK tavanı asgari ücret × tavan katsayısıyla.
 * Ayrıca akışların korunumu, sayfadaki kredi örneğinin kredi aracının açılış
 * örneğiyle aynı olması ve sayfanın hesaptan üretilmiş olması denetlenir.
 *
 * Kullanım: node diyagramlar/test.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var KOK = path.join(__dirname, "..");
var H = require("./hesap.js");
var C = require("./cizim.js");
var B = require(path.join(KOK, "bordro", "motor.js"));

var gecen = 0, kalan = 0;
function dogru(ad, kosul, detay) {
  if (kosul) { gecen++; console.log("  tamam      " + ad); }
  else { kalan++; console.error("  BASARISIZ  " + ad + (detay ? "  -- " + detay : "")); }
}
function yakin(a, b, tol) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }

var P = B.parametre(H.YIL);
var O = P.oranlar;
var D = P.donemler[0];
function tarife(m) {
  var v = 0, alt = 0;
  for (var i = 0; i < P.dilimler.length; i++) {
    var ust = P.dilimler[i][0], oran = P.dilimler[i][1];
    if (ust === null || m <= ust) return v + (m - alt) * oran;
    v += (ust - alt) * oran; alt = ust;
  }
  return v;
}
var CALISAN = O.sgkIsci + O.issizlikIsci;          // çalışan prim oranı
var ISVEREN = O.sgkIsveren + O.issizlikIsveren;    // işveren, indirimsiz

/* Yıl boyu sabit brütün yıllık bordrosu, kapalı formül (tavan altı ve üstü). */
function kapali(brut) {
  var pe = Math.min(Math.max(brut, D.asgariBrut), D.sgkTavan);
  var prim = 12 * pe * CALISAN;
  var matrah = 12 * (brut - pe * CALISAN);
  var asgariMatrah = 12 * D.asgariBrut * (1 - CALISAN);
  var gv = Math.max(0, tarife(matrah) - tarife(asgariMatrah));
  var damga = 12 * Math.max(0, brut - D.asgariBrut) * O.damga;
  return { brut: 12 * brut, prim: prim, gv: gv, damga: damga, net: 12 * brut - prim - gv - damga,
    isvPrim: 12 * pe * ISVEREN, matrah: matrah };
}

console.log("Parametreler");
dogru("SGK tavanı = asgari ücret × tavan katsayısı (" + P.tavanKatsayisi + ")", yakin(D.sgkTavan, D.asgariBrut * P.tavanKatsayisi, 0.01));
dogru("hesap.js yılın dönemini okuyor", H.donem(H.YIL).asgariBrut === D.asgariBrut && H.donem(H.YIL).sgkTavan === D.sgkTavan);

console.log("Şekil 1 — paranın yolu");
H.KATLAR.forEach(function (kat) {
  var u = H.ucret(kat), t = u.yillik, k = kapali(D.asgariBrut * kat);
  dogru("×" + kat + " korunum: işveren maliyeti = brüt + işveren primi", yakin(t.isverenMaliyeti, t.brut + t.isverenPrim, 0.01));
  dogru("×" + kat + " korunum: brüt = prim + vergi + net", yakin(t.brut, t.sgk + t.issizlik + t.gelirVergisi + t.damga + t.net, 0.01));
  dogru("×" + kat + " üç pay toplamı 1", yakin(u.netPay + u.vergiPay + u.primPay, 1, 1e-9));
  dogru("×" + kat + " işveren primi = brüt × " + ISVEREN, yakin(t.isverenPrim, k.isvPrim, 0.05));
  dogru("×" + kat + " çalışan primi kapalı formülle", yakin(t.sgk + t.issizlik, k.prim, 0.05));
  dogru("×" + kat + " gelir vergisi = tarife(yıllık matrah) − tarife(asgari matrah)", yakin(t.gelirVergisi, k.gv, 0.05),
    t.gelirVergisi.toFixed(2) + " ≠ " + k.gv.toFixed(2));
  dogru("×" + kat + " damga vergisi yalnız asgariyi aşan kısımdan", yakin(t.damga, k.damga, 0.05));
});
var u1 = H.ucret(1);
dogru("asgari ücrette çalışana kalan = (1 − " + CALISAN + ") ÷ (1 + " + ISVEREN + ")", yakin(u1.netPay, (1 - CALISAN) / (1 + ISVEREN), 1e-9));

console.log("Şekil 2 — yıl içinde net");
H.KATLAR.forEach(function (kat) {
  var u = H.ucret(kat);
  var tutar = u.aylar.every(function (a) { return yakin(a.net + a.prim + a.gelirVergisi + a.damga, a.brut, 0.01); });
  dogru("×" + kat + " her ay katmanlar brüte eşit", tutar);
  var dip = Math.min.apply(null, u.aylar.map(function (a) { return a.net; }));
  var ilk = u.aylar.filter(function (a) { return a.net - dip < 1; })[0];
  dogru("×" + kat + " en düşük nete ilk inilen ay " + ilk.ayAdi, u.enDusuk.ay === ilk.ay);
  // dilim geçişi sayısı: yıllık matrahın aştığı eşik sayısı (ilk ay kendi dilimini başlatır)
  var matrahAy = D.asgariBrut * kat - Math.min(D.asgariBrut * kat, D.sgkTavan) * CALISAN;
  var ilkAyDilim = P.dilimler.filter(function (d) { return d[0] !== null && matrahAy > d[0]; }).length;
  var yilDilim = P.dilimler.filter(function (d) { return d[0] !== null && 12 * matrahAy > d[0]; }).length;
  var gecis = u.aylar.filter(function (a) { return a.dilimGecisi; }).length;
  dogru("×" + kat + " dilim geçişi sayısı " + (yilDilim - ilkAyDilim), gecis === yilDilim - ilkAyDilim, gecis + " geçiş");
});
var u2 = H.ucret(2);
var asgMatAy = D.asgariBrut * (1 - CALISAN);
var ilkEsik = P.dilimler[0][0];
dogru("Temmuz artışının sebebi: asgari matrah birikimi ilk eşiği 7. ayda geçiyor",
  6 * asgMatAy < ilkEsik && 7 * asgMatAy > ilkEsik && u2.temmuzArtisi > 0);
dogru("asgari ücrette net yıl boyu sabit", H.ucret(1).aylar.every(function (a) { return yakin(a.net, u1.aylar[0].net, 0.01); }));

console.log("Şekil 3 — kredi");
var k = H.kredi(), g = k.girdi;
var r = g.aylikFaiz / 100 * (1 + g.kkdf / 100 + g.bsmv / 100);
var T = g.anapara * r / (1 - Math.pow(1 + r, -g.vade));
dogru("taksit anüite formülüyle", yakin(k.taksit, T, 0.01), k.taksit + " ≠ " + T.toFixed(2));
var satirTutar = k.satirlar.every(function (s) { return yakin(s.anapara + s.faiz + s.kkdf + s.bsmv, s.taksit, 0.005); });
dogru("her satır: anapara + faiz + KKDF + BSMV = taksit", satirTutar);
dogru("anapara payları toplamı anapara (kuruşu kuruşuna)",
  Math.round(k.satirlar.reduce(function (t, s) { return t + s.anapara * 100; }, 0)) === Math.round(g.anapara * 100));
dogru("ilk taksitin maliyet payı = anapara × oran ÷ taksit", yakin(k.ilkMaliyetPay, g.anapara * r / T, 1e-4));
// anapara > maliyet ⇔ kalan borç < taksit ÷ (2r); kalan borç kapalı formülden
var esik = T / (2 * r), ay = null;
for (var m = 1; m <= g.vade; m++) {
  var kalanOnce = g.anapara * Math.pow(1 + r, m - 1) - T * (Math.pow(1 + r, m - 1) - 1) / r;
  if (kalanOnce < esik) { ay = m; break; }
}
dogru("anaparanın faiz + vergiyi geçtiği ay " + ay, k.kesisimAyi === ay, "hesap " + k.kesisimAyi);
dogru("toplam faiz + vergi = vade × taksit − anapara", yakin(k.toplamMaliyet, g.vade * T - g.anapara, 1));
var kh = fs.readFileSync(path.join(KOK, "kredi-hesaplama", "index.html"), "utf8");
function girdi(id) { var mm = kh.match(new RegExp('id="' + id + '"[^>]*value="([^"]+)"')); return mm ? +mm[1].replace(/\./g, "").replace(",", ".") : NaN; }
dogru("örnek kredi aracının açılış örneğiyle aynı",
  girdi("in-anapara") === g.anapara && girdi("in-vade") === g.vade && girdi("in-faiz") === g.aylikFaiz &&
  girdi("in-kkdf") === g.kkdf && girdi("in-bsmv") === g.bsmv,
  [girdi("in-anapara"), girdi("in-vade"), girdi("in-faiz"), girdi("in-kkdf"), girdi("in-bsmv")].join(" "));

console.log("Şekil 4 — kesinti eğrisi");
var e = H.egri();
function ort(b) { var q = kapali(b); return (q.prim + q.gv + q.damga) / q.brut; }
dogru("asgari ücrette ortalama kesinti = çalışan prim oranı", yakin(e.ilk.ortalama, CALISAN, 1e-9));
dogru("tepe noktası SGK tavanının kendisi", e.tepe.brutAy === D.sgkTavan);
dogru("tepe oranı kapalı formülle", yakin(e.tepe.ortalama, ort(D.sgkTavan), 1e-9));
dogru("tavan yerel tepe: %1 altı ve üstü daha düşük", ort(D.sgkTavan * 0.99) < e.tepe.ortalama && ort(D.sgkTavan * 1.01) < e.tepe.ortalama);
dogru("eğri noktaları kapalı formülle", e.noktalar.every(function (n) { return yakin(n.ortalama, ort(n.brutAy), 1e-9); }));
dogru("geri dönüş brütünde oran tepeye eşit", !!e.geriDonus && yakin(ort(e.geriDonus.brutAy), e.tepe.ortalama, 1e-6));
dogru("geri dönüşte yüzde 35 ve 40'lık dilimler devrede (yıllık matrah > son eşik)",
  !!e.geriDonus && kapali(e.geriDonus.brutAy).matrah > P.dilimler[P.dilimler.length - 2][0] &&
  P.dilimler[P.dilimler.length - 2][1] === 0.35 && P.dilimler[P.dilimler.length - 1][1] === 0.4);
dogru("dip tavanla geri dönüş arasında ve tepeden düşük",
  e.dip.brutAy > D.sgkTavan && e.dip.brutAy < e.geriDonus.brutAy && e.dip.ortalama < e.tepe.ortalama);
var n2 = H.ucretNoktasi(2);
var son2 = P.dilimler.filter(function (d) { return d[0] === null || kapali(D.asgariBrut * 2).matrah <= d[0]; })[0][1];
dogru("×2 son liradan kesilen = prim + (1 − prim) × dilim + damga", yakin(n2.marjinal, CALISAN + (1 - CALISAN) * son2 + O.damga, 1e-6),
  n2.marjinal + " ≠ " + (CALISAN + (1 - CALISAN) * son2 + O.damga));

console.log("Metin ve sayfa");
var ekler = { "Ocak": "'tan", "Şubat": "'tan", "Mart": "'tan", "Nisan": "'dan", "Mayıs": "'tan", "Haziran": "'dan",
  "Temmuz": "'dan", "Ağustos": "'tan", "Eylül": "'den", "Ekim": "'den", "Kasım": "'dan", "Aralık": "'tan" };
var mt = C.ucretMetin(u2, n2);
H.KATLAR.forEach(function (kat) {
  var u = H.ucret(kat), z = C.dipZamani(u);
  var beklenen = u.enDusuk.ay === 12 ? "Aralık'ta" : u.enDusuk.ayAdi + ekler[u.enDusuk.ayAdi] + " itibaren";
  dogru("×" + kat + " en düşük ayın zaman eki: " + beklenen, z === beklenen, z);
});
dogru("Şekil 2 başlığı en düşük ayı doğru ekle söylüyor",
  mt.aylikBaslik.indexOf(u2.enDusuk.ayAdi + ekler[u2.enDusuk.ayAdi] + " itibaren") >= 0, mt.aylikBaslik);
dogru("Şekil 2 başlığı Ocak ve en düşük neti söylüyor",
  mt.aylikBaslik.indexOf(C.tl(u2.aylar[0].net)) >= 0 && mt.aylikBaslik.indexOf(C.tl(u2.enDusuk.net)) >= 0);
dogru("asgari ücrette başlık 'net sabit' kalıbına dönüyor", C.ucretMetin(u1, H.ucretNoktasi(1)).aylikBaslik.indexOf("yıl boyu aynı") >= 0);
var cikti = cp.spawnSync(process.execPath, [path.join(KOK, "tools", "diyagramlar-sayfa.js"), "--check"], { encoding: "utf8" });
dogru("sayfa hesaptan üretilmiş (tools/diyagramlar-sayfa.js --check)", cikti.status === 0, (cikti.stderr || "").trim());

console.log("\n" + gecen + " gecti, " + kalan + " kaldi. (diyagramlar)");
process.exit(kalan ? 1 : 0);
