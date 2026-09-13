/*!
 * Ev Almak mı Kiralamak mı — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Hesap
 * hesap.js'te, taksit ise kredi çekirdeğinde — ikisi de testlerle
 * korunuyor.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var E = window.EVKIRA;
  if (!E) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return para0.format(n || 0); }
  function deger(id) { return E.sayi($(id).value); }

  function girdiTopla() {
    return {
      evFiyati: deger("ev-fiyat"),
      pesinatYuzde: deger("ev-pesinat"),
      aylikFaizYuzde: deger("ev-faiz"),
      vadeAy: deger("ev-vade"),
      aylikKira: deger("ev-kira"),
      kiraArtisYuzde: deger("ev-kira-artis"),
      evDegerArtisYuzde: deger("ev-artis"),
      yatirimGetiriYuzde: deger("ev-yatirim"),
      enflasyonYuzde: deger("ev-enflasyon"),
      yilSayisi: deger("ev-yil"),
      tapuHarciYuzde: deger("ev-tapu"),
      komisyonYuzde: deger("ev-komisyon"),
      satisKomisyonYuzde: deger("ev-satis"),
      emlakVergisiBinde: deger("ev-emlak"),
      bakimYuzde: deger("ev-bakim"),
      sigortaYillik: deger("ev-sigorta")
    };
  }

  var basabasZaman = 0;

  function uyariYaz(s, g, bk) {
    var uyari = "";
    if (!s.basabasYil) {
      uyari = "Seçtiğiniz sürede satın alma kiralamayı geçmiyor. Süreyi uzatmayı ya da " +
              "varsayımları gözden geçirmeyi deneyin.";
    } else if (bk.bulundu && bk.kira > g.aylikKira) {
      uyari = "Kiranız " + para(bk.kira) + " tutarını aşarsa satın almak öne geçer. " +
              "Şu anki kiranız bunun altında.";
    } else if (bk.bulundu) {
      uyari = "Kiranız başabaş kiranın üzerinde; satın almak bu varsayımlarla öne geçiyor.";
    }
    if (g.satisKomisyonYuzde > 0) {
      uyari += " Satış komisyonu düşülüyor: evi elde tutacaksanız o alanı sıfırlayın.";
    }
    $("ev-uyari").hidden = !uyari;
    $("ev-uyari").textContent = uyari;
  }

  function hesapla() {
    var g = girdiTopla();
    var s = E.karsilastir(g);
    var son = s.yillar[s.yillar.length - 1];
    if (!son) return;

    var alOnde = son.aliciServet > son.kiraciServet;

    /* Karar kartı: hangi yol önde ve NE KADAR. Fark bugünün parasıyla
       veriliyor çünkü yirmi yıl sonraki nominal fark büyüklüğü yanlış
       algılatıyor. */
    $("ev-karar").textContent = alOnde ? "Satın almak önde" : "Kiralamak önde";
    $("ev-karar-etiket").textContent = g.yilSayisi + " yıl sonunda";
    $("ev-karar-alt").textContent =
      "Fark " + para(Math.abs(son.aliciServetReel - son.kiraciServetReel)) +
      " (bugünün parasıyla). Bu hesap kiracının peşinatı ve aylık farkı " +
      "yatırdığını varsayar.";
    /* Karar karti RENK DEGISTIRMIYOR: kirmizi hata demek, oysa "kiralamak
       onde" iki gecerli cevaptan biri. Hangi yolun onde oldugu asagidaki
       iki kartin vurgusuyla anlatiliyor. */

    $("ev-servet-al").textContent = para(son.aliciServet);
    $("ev-reel-al").textContent = "bugünün parasıyla " + para(son.aliciServetReel);
    $("ev-servet-kira").textContent = para(son.kiraciServet);
    $("ev-reel-kira").textContent = "bugünün parasıyla " + para(son.kiraciServetReel);
    $("ev-kart-al").classList.toggle("onde", alOnde);
    $("ev-kart-kira").classList.toggle("onde", !alOnde);

    $("ev-ilkgun").textContent = para(s.ilkGunNakit);
    $("ev-taksit").textContent = para(s.aylikTaksit);
    $("ev-basabas").textContent = s.basabasYil
      ? s.basabasYil + ". yıl"
      : "bu sürede yok";

    /* Başabaş kira ikiye bölmeyle bulunuyor, yani onlarca tam
       karşılaştırma demek. Ana sonuç anında güncellenir; bu sayı yazmayı
       bıraktıktan kısa süre sonra hesaplanır ki form takılmasın. */
    $("ev-basabas-kira").textContent = "hesaplanıyor…";
    clearTimeout(basabasZaman);
    basabasZaman = setTimeout(function () {
      var bk = E.basabasKira(g);
      $("ev-basabas-kira").textContent = bk.bulundu ? para(bk.kira) : "—";
      uyariYaz(s, g, bk);
    }, 180);


    /* Karar yüzeyi. Başabaş YILI ve başabaş KİRASI tek boyutlu cevaplar;
       asıl soru iki boyutlu: ev değer artışı ile yatırım getirisi birbirini
       götürüyor. Izgara her hücrede TAM hesabı yeniden koşuyor (49 koşum),
       yaklaşık formül kullanılmıyor — masraflar ve kira tavanı doğrusal
       değil, enterpolasyon yanlış sınır çizdirirdi. */
    if (window.IsiHaritasi) {
      var izgara = E.duyarlilik(g, {
        x: [0, 10, 20, 30, 40, 50, 60],
        y: [0, 10, 20, 30, 40, 50, 60]
      });
      $("ev-isi").innerHTML = window.IsiHaritasi.ciz({
        izgara: izgara,
        baslik: "Karar hangi noktada tersine döner?",
        xEtiket: "Ev değeri yıllık artışı",
        yEtiket: "Yatırım getirisi (yıllık)",
        artiAd: "Satın alma önde",
        eksiAd: "Kiralama önde",
        bicim: function (v) {
          var m = Math.round(Math.abs(v) / 1000);
          return (v < 0 ? "−" : "") + (m >= 1000
            ? (m / 1000).toFixed(1).replace(".", ",") + "M"
            : m + "k");
        },
        not: "Hücre değerleri " + g.yilSayisi + ". yıl sonundaki reel servet farkı " +
             "(bugünün parasıyla, bin TL). Diğer bütün girdiler formdaki " +
             "değerlerinde sabit tutulur."
      });
    }

    $("ev-tablo").innerHTML = s.yillar.map(function (y) {
      var fr = y.aliciServetReel - y.kiraciServetReel;
      return "<tr><th scope=\"row\">" + y.yil + "</th><td>" + para(y.evDegeri) +
             "</td><td>" + para(y.kalanKredi) + "</td><td>" + para(y.aliciServetReel) +
             "</td><td>" + para(y.kiraciServetReel) + "</td><td>" +
             (fr >= 0 ? "+" : "−") + para(Math.abs(fr)).replace("₺", "₺") +
             "</td></tr>";
    }).join("");
  }

  document.querySelectorAll("#hesapla input").forEach(function (el) {
    el.addEventListener("input", hesapla);
    el.addEventListener("change", hesapla);
  });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
