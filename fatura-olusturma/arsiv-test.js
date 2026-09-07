/*!
 * Fatura & Teklif Merkezi — çalışma alanı testleri.
 *   node fatura-olusturma/arsiv-test.js
 *
 * Bu katmanın hatası, tutar hatasından daha kötüdür: yanlış tutar görülebilir,
 * kaybolan bir arşiv görülemez. Buradaki testler üç değişmezi koruyor:
 *   1. İki belge asla aynı numarayı almaz.
 *   2. Bir belge dönüştürüldüğünde kaynağı olduğu gibi kalır.
 *   3. Bozuk veri aracı çökertmez; kurtarılabilen kurtarılır.
 */
"use strict";
var A = require("./arsiv.js");

var gecen = 0, kalan = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ✓ " + ad); }
  else { kalan++; console.log("  ✗ " + ad + (ek ? "  → " + ek : "")); }
}
function yakin(a, b, t) { return Math.abs(a - b) <= (t || 0.005); }
function baslik(s) { console.log("\n" + s); }

function kalem(fiyat, kdv, miktar) {
  return { aciklama: "Hizmet", miktar: miktar || 1, birim: "Adet",
           birimFiyat: fiyat, iskonto: 0, iskontoTur: "oran", kdvOran: kdv == null ? 20 : kdv };
}

/* ------------------------------------------------------------------ 1 */
baslik("Boş çalışma alanı");
(function () {
  var a = A.bosCalismaAlani();
  ok("belgeler boş", Array.isArray(a.belgeler) && a.belgeler.length === 0);
  ok("varsayılan şablon var", a.ayar.sablon === "klasik");
  var o = A.ozet(a, 2026);
  ok("boş alanda özet çökmüyor", o.belgeSayisi === 0 && o.faturaTutari === 0);
  ok("teklif yokken dönüşüm oranı tanımsız", o.donusumOrani === null, String(o.donusumOrani));
})();

/* ------------------------------------------------------------------ 2 */
baslik("Belge numaraları");
(function () {
  var a = A.bosCalismaAlani();
  var t1 = A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-03-01", kalemler: [kalem(1000)] });
  var t2 = A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-03-02", kalemler: [kalem(1000)] });
  var f1 = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-03-03", kalemler: [kalem(1000)] });
  ok("ilk teklif TKF2026000001", t1.no === "TKF2026000001", t1.no);
  ok("ikinci teklif TKF2026000002", t2.no === "TKF2026000002", t2.no);
  ok("fatura ayrı diziden başlar", f1.no === "FTR2026000001", f1.no);
  ok("altı hane sabit", /^[A-ZÇĞİÖŞÜ]+\d{4}\d{6}$/.test(t1.no), t1.no);

  /* Sayaç bozulsa bile arşivdeki en büyük numara esas alınmalı. */
  a.sayac = {};
  var t3 = A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-03-04", kalemler: [kalem(1000)] });
  ok("sayaç silinse de numara tekrar etmiyor", t3.no === "TKF2026000003", t3.no);

  var numaralar = {}, cakisma = 0;
  for (var i = 0; i < 60; i++) {
    var b = A.belgeEkle(a, { tur: i % 2 ? "TEKLİF" : "FATURA", tarih: "2026-05-01", kalemler: [kalem(10)] });
    if (numaralar[b.no]) cakisma++;
    numaralar[b.no] = true;
  }
  ok("60 belgede numara çakışması yok", cakisma === 0, cakisma + " çakışma");

  var kimlikler = {}, kc = 0;
  a.belgeler.forEach(function (b) { if (kimlikler[b.id]) kc++; kimlikler[b.id] = true; });
  ok("kimlikler benzersiz", kc === 0, kc + " tekrar");
})();

/* ------------------------------------------------------------------ 3 */
baslik("Teklifin faturaya dönüşmesi");
(function () {
  var a = A.bosCalismaAlani();
  var t = A.belgeEkle(a, {
    tur: "TEKLİF", tarih: "2026-04-10",
    musteri: { unvan: "Alıcı A.Ş." },
    kalemler: [kalem(50000), kalem(10000, 10)],
    notlar: "Teslim mayısta."
  });
  var f = A.tekliftenFatura(a, t.id);

  ok("fatura oluştu", !!f && f.tur === "FATURA", f && f.tur);
  ok("yeni numara aldı", f.no === "FTR2026000001", f.no);
  ok("kaynağa bağlandı", f.kaynakId === t.id && f.kaynakNo === t.no, f.kaynakNo);
  ok("kalemler taşındı", f.kalemler.length === 2 && f.kalemler[0].birimFiyat === 50000);
  ok("müşteri taşındı", f.musteri.unvan === "Alıcı A.Ş.");
  ok("notlar taşındı", f.notlar === "Teslim mayısta.");
  ok("durumu taslak", f.durum === "taslak", f.durum);

  /* Kayıt bütünlüğü: teklif olduğu gibi kalmalı. */
  var teklif = A.belgeBul(a, t.id);
  ok("kaynak teklif silinmedi", !!teklif);
  ok("kaynak teklifin numarası değişmedi", teklif.no === "TKF2026000001", teklif.no);
  ok("kaynak teklifin türü değişmedi", teklif.tur === "TEKLİF", teklif.tur);
  ok("arşivde iki belge var", a.belgeler.length === 2, String(a.belgeler.length));

  /* Aynı teklif ikinci kez dönüştürülürse ikinci fatura da ona bağlanır;
     bu meşru bir durum (kısmi faturalama). */
  var f2 = A.tekliftenFatura(a, t.id);
  ok("ikinci dönüşüm de mümkün", !!f2 && f2.no === "FTR2026000002", f2 && f2.no);

  /* Fatura yeniden faturaya çevrilemez. */
  ok("fatura tekrar dönüştürülemez", A.tekliftenFatura(a, f.id) === null);

  /* Kopyalama tam kopya üretir: kaynak bağı da taşınır (aynı teklifin ikinci
     faturası olduğu bilgisi kaybolmamalı). Değişen yalnızca kimlik, numara,
     tarih ve durumdur. */
  var k = A.belgeKopyala(a, f.id);
  ok("kopya yeni numara alır", k.no === "FTR2026000003", k.no);
  ok("kopya yeni kimlik alır", k.id !== f.id);
  ok("kopyanın durumu taslak", k.durum === "taslak", k.durum);
  ok("kopya kaynak bağını korur", k.kaynakId === f.kaynakId, k.kaynakId);
})();

/* ------------------------------------------------------------------ 4 */
baslik("Durum ve ödeme tarihi");
(function () {
  var a = A.bosCalismaAlani();
  var f = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-01-10", vade: "2026-02-10",
                           kalemler: [kalem(10000)] });
  ok("başlangıç durumu taslak", f.durum === "taslak");
  A.durumDegistir(a, f.id, "gonderildi");
  ok("gönderildi olarak işaretlendi", A.belgeBul(a, f.id).durum === "gonderildi");
  ok("gönderildide ödeme tarihi yok", A.belgeBul(a, f.id).odemeTarihi === "");

  A.durumDegistir(a, f.id, "odendi");
  var b = A.belgeBul(a, f.id);
  ok("ödendi işaretlenince ödeme tarihi doldu", !!b.odemeTarihi, b.odemeTarihi);

  /* Geri alınırsa ödeme tarihi de temizlenmeli; yoksa tahsilat süresi
     ortalaması sessizce yanlış çıkar. */
  A.durumDegistir(a, f.id, "gonderildi");
  ok("geri alınca ödeme tarihi temizlendi", A.belgeBul(a, f.id).odemeTarihi === "",
     A.belgeBul(a, f.id).odemeTarihi);

  ok("geçersiz durum kabul edilmiyor", A.durumDegistir(a, f.id, "sallama") === null);
  ok("olmayan belge için null", A.durumDegistir(a, "yok", "odendi") === null);
})();

/* ------------------------------------------------------------------ 5 */
baslik("Yıllık özet");
(function () {
  var a = A.bosCalismaAlani();
  /* 3 teklif, 2'si faturaya döndü; 2 fatura ödendi, 1'i vadesi geçmiş bekliyor */
  var t1 = A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-01-05", kalemler: [kalem(100000)] });
  var t2 = A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-02-05", kalemler: [kalem(50000)] });
  A.belgeEkle(a, { tur: "TEKLİF", tarih: "2026-03-05", kalemler: [kalem(25000)] });

  var f1 = A.tekliftenFatura(a, t1.id);
  A.belgeGuncelle(a, f1.id, { tarih: "2026-01-10", vade: "2026-02-10",
                              musteri: { unvan: "Alfa Ltd." } });
  A.durumDegistir(a, f1.id, "odendi");
  A.belgeGuncelle(a, f1.id, { odemeTarihi: "2026-01-30" });   /* 20 gün */

  var f2 = A.tekliftenFatura(a, t2.id);
  A.belgeGuncelle(a, f2.id, { tarih: "2026-02-10", vade: "2026-03-10",
                              musteri: { unvan: "Beta A.Ş." } });
  A.durumDegistir(a, f2.id, "odendi");
  A.belgeGuncelle(a, f2.id, { odemeTarihi: "2026-02-20" });   /* 10 gün */

  var f3 = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-03-01", vade: "2026-03-15",
                            musteri: { unvan: "Alfa Ltd." }, kalemler: [kalem(30000)] });
  A.durumDegistir(a, f3.id, "gonderildi");

  var o = A.ozet(a, 2026, "2026-09-07");

  ok("3 teklif sayıldı", o.teklifSayisi === 3, String(o.teklifSayisi));
  ok("3 fatura sayıldı", o.faturaSayisi === 3, String(o.faturaSayisi));
  ok("2 teklif dönüştü", o.donusenTeklif === 2, String(o.donusenTeklif));
  ok("dönüşüm oranı %66,7", yakin(o.donusumOrani, 66.7, 0.05), String(o.donusumOrani));

  /* 100.000 + 50.000 = 150.000 matrah, %20 KDV -> 180.000 tahsil edilmiş */
  ok("tahsil edilen 180.000", yakin(o.tahsilEdilen, 180000), String(o.tahsilEdilen));
  /* 30.000 + %20 = 36.000 bekliyor */
  ok("bekleyen 36.000", yakin(o.bekleyen, 36000), String(o.bekleyen));
  ok("vadesi geçen 1 belge", o.vadesiGecen === 1, String(o.vadesiGecen));
  ok("vadesi geçen tutar 36.000", yakin(o.vadesiGecenTutar, 36000), String(o.vadesiGecenTutar));
  ok("ortalama tahsilat 15 gün", yakin(o.ortalamaTahsilatGunu, 15, 0.05),
     String(o.ortalamaTahsilatGunu));

  ok("en çok iş yapılan müşteri Alfa", o.musteriler[0].unvan === "Alfa Ltd.",
     JSON.stringify(o.musteriler));
  /* Alfa: 120.000 (ödenen) + 36.000 (bekleyen) = 156.000 */
  ok("Alfa toplamı 156.000", yakin(o.musteriler[0].tutar, 156000),
     String(o.musteriler[0].tutar));

  ok("ocak ayı dolu", o.aylik[0].sayi > 0 && o.aylik[0].tutar > 0);
  ok("aralık ayı boş", o.aylik[11].sayi === 0);

  /* İptal edilen belge hiçbir toplama girmemeli. */
  var iptal = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-04-01", kalemler: [kalem(999999)] });
  A.durumDegistir(a, iptal.id, "iptal");
  var o2 = A.ozet(a, 2026, "2026-09-07");
  ok("iptal fatura tutara girmiyor", yakin(o2.faturaTutari, o.faturaTutari),
     o2.faturaTutari + " ≠ " + o.faturaTutari);
  ok("iptal fatura aylık toplamda yok", o2.aylik[3].tutar === 0, String(o2.aylik[3].tutar));

  /* Başka yılın belgesi bu yılın özetine karışmamalı. */
  A.belgeEkle(a, { tur: "FATURA", tarih: "2025-06-01", kalemler: [kalem(777777)] });
  var o3 = A.ozet(a, 2026, "2026-09-07");
  ok("önceki yıl karışmıyor", yakin(o3.faturaTutari, o.faturaTutari), String(o3.faturaTutari));
})();

/* ------------------------------------------------------------------ 6 */
baslik("Dövizli belge TL karşılığıyla toplanıyor");
(function () {
  var a = A.bosCalismaAlani();
  var f = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-05-01", para: "USD", kur: 40,
                           kalemler: [kalem(1000)] });
  A.durumDegistir(a, f.id, "odendi");
  var o = A.ozet(a, 2026, "2026-09-07");
  /* 1000 + %20 = 1.200 USD; 40 kurdan 48.000 TL */
  ok("USD fatura TL olarak toplandı", yakin(o.tahsilEdilen, 48000), String(o.tahsilEdilen));
})();

/* ------------------------------------------------------------------ 7 */
baslik("Katalog");
(function () {
  var a = A.bosCalismaAlani();
  A.katalogEkle(a, { aciklama: "Danışmanlık", birim: "Saat", birimFiyat: 3500, kdvOran: 20 });
  A.katalogEkle(a, { aciklama: "Bakım", birim: "Ay", birimFiyat: 4750, kdvOran: 20 });
  ok("iki kalem eklendi", a.katalog.length === 2);
  A.katalogEkle(a, { aciklama: "danışmanlık", birim: "Saat", birimFiyat: 4000, kdvOran: 20 });
  ok("aynı ad tekrar eklenmiyor, güncelleniyor", a.katalog.length === 2, String(a.katalog.length));
  ok("fiyat güncellendi", a.katalog[0].birimFiyat === 4000, String(a.katalog[0].birimFiyat));
  ok("boş açıklama eklenmiyor", A.katalogEkle(a, { aciklama: "   " }) === null);
  ok("silme çalışıyor", A.katalogSil(a, 0) === true && a.katalog.length === 1);
  ok("olmayan sıra silinmiyor", A.katalogSil(a, 9) === false);
})();

/* ------------------------------------------------------------------ 8 */
baslik("Yedek dosyası: dışa ve içe aktarma");
(function () {
  var a = A.bosCalismaAlani();
  a.firma = { unvan: "Örnek Ltd." };
  A.belgeEkle(a, { tur: "FATURA", tarih: "2026-06-01", kalemler: [kalem(1000)] });
  A.katalogEkle(a, { aciklama: "Danışmanlık", birimFiyat: 3500 });

  var yedek = JSON.parse(JSON.stringify(A.disaAktar(a)));
  var geri = A.iceAktar(yedek);
  ok("yedek geri yüklendi", !!geri && geri.belgeler.length === 1);
  ok("firma korundu", geri.firma.unvan === "Örnek Ltd.");
  ok("katalog korundu", geri.katalog.length === 1);
  ok("belge numarası korundu", geri.belgeler[0].no === "FTR2026000001", geri.belgeler[0].no);

  /* Sarmalanmamış çalışma alanı da kabul edilmeli. */
  ok("çıplak çalışma alanı okunuyor", A.iceAktar(a).belgeler.length === 1);

  /* Eski sürümün tek belgelik dosyası da okunmalı. */
  var eski = {
    "belge-turu": "PROFORMA FATURA", "belge-no": "PRF2026000009",
    tarih: "2026-02-02", firma: { unvan: "Eski Ltd." }, musteri: { unvan: "Müşteri" },
    kalemler: [kalem(2500)], "genel-iskonto": 0, para: "TRY", kur: 1
  };
  var d = A.iceAktar(eski);
  ok("eski tek belgelik dosya okunuyor", !!d && d.belgeler.length === 1);
  ok("eski dosyanın numarası korundu", d.belgeler[0].no === "PRF2026000009", d.belgeler[0].no);
  ok("eski dosyanın türü korundu", d.belgeler[0].tur === "PROFORMA FATURA");

  ok("çöp veri null döner", A.iceAktar({ rastgele: 1 }) === null);
  ok("null güvenli", A.iceAktar(null) === null);
})();

/* ------------------------------------------------------------------ 9 */
baslik("Bozuk veri aracı çökertmiyor");
(function () {
  var bozuk = {
    belgeler: [
      null, 42, "metin",
      { id: "ayni", tur: "SAÇMA", durum: "uydurma", kalemler: "dizi değil" },
      { id: "ayni", tur: "FATURA", tarih: "2026-07-01", kalemler: [kalem(100)] }
    ],
    musteriler: [null, { unvan: "Geçerli" }, 5],
    katalog: "dizi değil",
    ayar: "nesne değil",
    sayac: 12
  };
  var a = A.normalize(bozuk);
  ok("bozuk girdiler ayıklandı", a.belgeler.length === 2, String(a.belgeler.length));
  ok("tanınmayan tür varsayılana düştü", a.belgeler[0].tur === "PROFORMA FATURA",
     a.belgeler[0].tur);
  ok("tanınmayan durum taslağa düştü", a.belgeler[0].durum === "taslak", a.belgeler[0].durum);
  ok("kalemler diziye çevrildi", Array.isArray(a.belgeler[0].kalemler));
  ok("aynı kimlik ikinci belgede yenilendi", a.belgeler[0].id !== a.belgeler[1].id);
  ok("geçersiz müşteriler ayıklandı", a.musteriler.length === 1, String(a.musteriler.length));
  ok("katalog diziye çevrildi", Array.isArray(a.katalog) && a.katalog.length === 0);
  ok("ayar nesnesi kurtarıldı", a.ayar.sablon === "klasik");
  ok("bozuk alanla özet çalışıyor", A.ozet(a, 2026).belgeSayisi >= 0);
})();

/* ----------------------------------------------------------------- 10 */
baslik("Silme ve güncelleme");
(function () {
  var a = A.bosCalismaAlani();
  var b = A.belgeEkle(a, { tur: "FATURA", tarih: "2026-08-01", kalemler: [kalem(100)] });
  ok("güncelleme kimliği değiştiremez",
     A.belgeGuncelle(a, b.id, { id: "hile", notlar: "not" }).id === b.id);
  ok("not güncellendi", A.belgeBul(a, b.id).notlar === "not");
  ok("silme çalışıyor", A.belgeSil(a, b.id) === true && a.belgeler.length === 0);
  ok("olmayan belge silinmiyor", A.belgeSil(a, "yok") === false);
})();

console.log("\n" + gecen + " geçti, " + kalan + " kaldı.");
process.exit(kalan ? 1 : 0);
