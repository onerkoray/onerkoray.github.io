#!/usr/bin/env node
/*
 * Bütçe yazısının akış diyagramı: 2027 merkezî yönetim bütçesinde paranın
 * nereden gelip nereye gittiği (finans/sankey.js).
 *
 * Tek mesajı: borçlanma (bütçe açığı) ile faiz gideri neredeyse aynı
 * kalınlıkta. İkisi vurgulu, diğer harcamalar nötr. Değerler
 * finans/butce.js'ten okunur; teklif girildiğinde diyagram teklifi çizer.
 * Giren ve çıkan toplamın tutmaması (OVP yuvarlaması 0,15 milyar TL'yi
 * aşarsa) hata sayılır.
 *
 * Kullanım:
 *   node tools/butce-diyagram.js           # yazıya yerleştir
 *   node tools/butce-diyagram.js --check   # güncel mi (CI)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var Bu = require(path.join(KOK, "finans", "butce.js"));
var Sankey = require(path.join(KOK, "finans", "sankey.js"));
var YAZI = path.join(KOK, "makaleler", "butce-2027-faiz-vergi", "index.html");
var BAS = "<!-- BUTCE-DIYAGRAM:BASLANGIC -->", BIT = "<!-- BUTCE-DIYAGRAM:BITIS -->";

function bir(x) { return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

function diyagram() {
  var teklif = Bu.teklifVar();
  var d = teklif ? Bu.yil(2027, "teklif") : Bu.yil(2027);
  var giris = d.vergi + d.digerGelir + (-d.denge);
  var kalemler = [
    ["faiz", "Faiz", d.faiz, "kesinti"],
    ["cari", "Cari transferler", d.cariTransfer, "gider"],
    ["personel", "Personel", d.personel, "gider"],
    ["malhizmet", "Mal ve hizmet alımı", d.malHizmet, "gider"],
    ["sermaye", "Sermaye giderleri", d.sermayeGideri, "gider"],
    ["sgk", "SGK devlet primi", d.sgkDevletPrimi, "gider"],
    ["stransfer", "Sermaye transferleri", d.sermayeTransferi, "gider"],
    ["borcverme", "Borç verme", d.borcVerme, "gider"],
    ["yedek", "Yedek ödenek", d.yedekOdenek, "gider"]
  ];
  var cikis = kalemler.reduce(function (t, k) { return t + k[2]; }, 0);
  if (Math.abs(giris - cikis) > 0.15) throw new Error("Bütçe diyagramı: giren " + giris + " ≠ çıkan " + cikis);
  if (Math.abs(cikis - d.harcamalar) > 0.15) throw new Error("Bütçe diyagramı: kalemler toplamı harcamalarla tutmuyor");

  var dugumler = [
    { id: "vergi", ad: "Vergi gelirleri", tur: "kaynak" },
    { id: "diger", ad: "Diğer gelirler", tur: "kaynak" },
    { id: "borc", ad: "Borçlanma (açık)", tur: "kesinti" },
    { id: "butce", ad: "Bütçe", tur: "ara" }
  ].concat(kalemler.map(function (k) { return { id: k[0], ad: k[1], tur: k[3] === "kesinti" ? "kesinti" : "zorunlu" }; }));
  var baglantilar = [
    { kaynak: "vergi", hedef: "butce", deger: d.vergi, tur: "akis" },
    { kaynak: "diger", hedef: "butce", deger: d.digerGelir, tur: "akis" },
    { kaynak: "borc", hedef: "butce", deger: -d.denge, tur: "acik" }
  ].concat(kalemler.map(function (k) { return { kaynak: "butce", hedef: k[0], deger: k[2], tur: k[3] }; }));

  var kaynak = teklif ? "2027 bütçe kanun teklifi" : "OVP (2027-2029) Tablo 1.6";
  var html = Sankey.ciz({
    dugumler: dugumler,
    baglantilar: baglantilar,
    baslik: "2027 bütçesi: borçlanma (" + bir(-d.denge) + " milyar TL) ile faiz gideri (" + bir(d.faiz) + " milyar TL) neredeyse aynı kalınlıkta",
    bicim: function (v) { return bir(v) + " mr TL"; },
    not: "Milyar TL, " + kaynak + ". Soldan gelen para (vergi, diğer gelirler ve borçlanma) bütçede toplanıp sağdaki harcama kalemlerine dağılır. Kalınlık tutarla orantılı." +
      (Math.abs(cikis - d.harcamalar) >= 0.05 ? " Kalemler tabloda yuvarlandığı için toplamları " + bir(cikis) + "; tablodaki toplam harcama " + bir(d.harcamalar) + "." : ""),
    yukseklik: 520
  });
  return '      <div class="ed-diyagram" id="akis">\n' + html + "\n      </div>";
}

function main() {
  var kontrol = process.argv.indexOf("--check") !== -1;
  var s = fs.readFileSync(YAZI, "utf8");
  var a = s.indexOf(BAS), b = s.indexOf(BIT);
  if (a < 0 || b < 0) { console.error("Bütçe yazısında diyagram işaretçileri yok."); return 1; }
  var yeni = s.slice(0, a + BAS.length) + "\n" + diyagram() + "\n      " + s.slice(b);
  if (yeni === s) { console.log("Bütçe diyagramı güncel."); return 0; }
  if (kontrol) { console.error("Bütçe diyagramı güncel değil: node tools/butce-diyagram.js"); return 1; }
  fs.writeFileSync(YAZI, yeni, "utf8");
  console.log("Bütçe diyagramı yazıldı.");
  return 0;
}

process.exit(main());
