/*!
 * Kişisel Enflasyon — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir endeks formülü içermez. Hesap
 * finans/kisisel-enflasyon-motoru.js'te, reel dönüşüm ise
 * finans/enflasyon-motoru.js'te — ikisi de testlerle korunuyor.
 *
 * ANLATIM KARARI: birincil sayı kişisel enflasyon oranı, ama hemen altında
 * ÜÇ SAYI eşit ağırlıkta duruyor (fiyat / harcama / sepet etkisi). Sebebi,
 * aracın asıl tezinin o ayrım olması: harcamanızın artması ile fiyatların
 * artması aynı şey değil.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var K = window.KisiselEnflasyonMotoru;
  var F = window.Finans;
  if (!K || !F) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return para0.format(n || 0); }
  function yuzde(x, basamak) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    /* Isaret yuzde isaretinin ONUNE: "%-30,0" degil "−%30,0". */
    var b = basamak === undefined ? 1 : basamak;
    var m = (Math.abs(x) * 100).toFixed(b).replace(".", ",");
    return (x < 0 ? "−" : "") + "%" + m;
  }
  function puan(x, basamak) {
    if (x === null || !isFinite(x)) return "—";
    var v = (Math.abs(x) * 100).toFixed(basamak === undefined ? 1 : basamak).replace(".", ",");
    return (x >= 0 ? "+" : "−") + v + " puan";
  }
  function deger(id) { return F.sayi($(id).value); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Varsayılan sepet: araç boş bir formla değil, çalışır hâlde açılıyor ki
     ne yaptığı ilk bakışta görünsün. Rakamlar örnek. */
  var VARSAYILAN = [
    { ad: "Kira / konut", once: 18000, simdi: 27000, miktarDegisti: false },
    { ad: "Market ve mutfak", once: 11000, simdi: 15400, miktarDegisti: false },
    { ad: "Faturalar", once: 4200, simdi: 6100, miktarDegisti: false },
    { ad: "Ulaşım / yakıt", once: 4500, simdi: 6300, miktarDegisti: false },
    { ad: "Sağlık ve bakım", once: 2000, simdi: 2900, miktarDegisti: false },
    { ad: "Dışarıda yemek", once: 5000, simdi: 3500, miktarDegisti: true }
  ];

  function satirEkle(k) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="ke-ad"><input type="text" value="' + esc(k.ad) +
      '" aria-label="Kalem adı"></td>' +
      '<td class="ke-tutar"><input type="text" inputmode="decimal" value="' +
      k.once + '" aria-label="Geçen yılki aylık tutar"></td>' +
      '<td class="ke-tutar"><input type="text" inputmode="decimal" value="' +
      k.simdi + '" aria-label="Bugünkü aylık tutar"></td>' +
      '<td><label class="ke-onay"><input type="checkbox"' +
      (k.miktarDegisti ? " checked" : "") +
      ' aria-label="Bu kalemde miktarım değişti"></label></td>' +
      '<td><button type="button" class="ke-sil" aria-label="Satırı sil">×</button></td>';
    tr.querySelector(".ke-sil").addEventListener("click", function () {
      tr.remove(); hesapla();
    });
    tr.querySelectorAll("input").forEach(function (el) {
      el.addEventListener("input", hesapla);
      el.addEventListener("change", hesapla);
    });
    $("ke-govde").appendChild(tr);
  }

  function kalemleriOku() {
    return Array.prototype.map.call(
      $("ke-govde").querySelectorAll("tr"), function (tr) {
        var g = tr.querySelectorAll("input");
        return {
          ad: g[0].value.trim() || "Kalem",
          once: F.sayi(g[1].value),
          simdi: F.sayi(g[2].value),
          miktarDegisti: g[3].checked
        };
      }).filter(function (k) { return isFinite(k.once) && isFinite(k.simdi); });
  }

  function girdiTopla() {
    var resmi = deger("in-resmi");
    return {
      kalemler: kalemleriOku(),
      gelirOnce: deger("in-gelir-once"),
      gelirSimdi: deger("in-gelir-simdi"),
      resmiOran: isFinite(resmi) ? resmi / 100 : null
    };
  }

  /* ------------------------------ karar kartı ---------------------------- */
  function kararKarti(r) {
    if (r.kisiselEnflasyon === null) {
      return '<div class="ke-karar">' +
        '<p class="ke-etiket">Fiyat endeksi hesaplanamadı</p>' +
        '<p class="ke-oran">—</p>' +
        '<p class="ke-cumle">Bütün kalemlerin miktarı değişmiş ya da geçen yıl ' +
        "yokmuş görünüyor. Saf fiyat artışını ölçmek için en az bir kalemin " +
        "sepette sabit kalması gerekiyor.</p></div>";
    }

    var cumle;
    if (r.gelirArtisi === null) {
      cumle = "Zammınızı görmek için yukarıya geçen yılki ve bugünkü gelirinizi girin.";
    } else if (r.gelirYetti) {
      cumle = "Geliriniz " + yuzde(r.gelirArtisi) + " arttı — bu oranın " +
        "<strong>üzerinde</strong>. Alım gücünüz reel olarak " +
        yuzde(r.reelDegisim) + " <strong>arttı</strong>.";
    } else {
      cumle = "Geliriniz " + yuzde(r.gelirArtisi) + " arttı — bu oranın " +
        "<strong>altında</strong>. Alım gücünüz reel olarak " +
        yuzde(Math.abs(r.reelDegisim)) + " <strong>azaldı</strong>. " +
        "Başabaş için geliriniz " + para(r.gerekenGelir) + " olmalıydı; " +
        "aradaki fark ayda " + para(r.gelirAcigi) + ".";
    }

    var resmiNot = "";
    if (r.resmiFark !== null) {
      var yon = r.resmiFark > 0 ? "üstünde" : "altında";
      resmiNot = "Girdiğiniz resmî oran " + yuzde(r.resmiOran) + "; sizin " +
        "oranınız onun <strong>" + puan(r.resmiFark) + "</strong> " + yon + ".";
      if (r.reelResmiyle !== null && r.reelDegisim !== null &&
          r.reelResmiyle >= 0 && r.reelDegisim < 0) {
        resmiNot += " Dikkat: aynı zam <em>resmî ölçütle</em> enflasyonun " +
          "üzerinde (" + yuzde(r.reelResmiyle) + " reel artış), <em>sizin " +
          "sepetinizle</em> altında. İkisi aynı anda doğru; cebinizi belirleyen " +
          "ikincisi.";
      }
    }

    var enBuyuk = "";
    if (r.enBuyukKatki && r.enBuyukKatki.katki > 0) {
      enBuyuk = " Bu oranın <strong>" + puan(r.enBuyukKatki.katki) +
        "</strong>'ı tek başına <strong>" + esc(r.enBuyukKatki.ad) +
        "</strong> kaleminden geliyor.";
    }

    return '<div class="ke-karar">' +
      '<p class="ke-etiket">Kişisel enflasyonunuz</p>' +
      '<p class="ke-oran">' + yuzde(r.kisiselEnflasyon) + "</p>" +
      '<p class="ke-cumle">' + cumle + enBuyuk + "</p>" +
      (resmiNot ? '<p class="ke-not">' + resmiNot + "</p>" : "") + "</div>";
  }

  /* ---------------------------- üç sayı, üç soru ------------------------- */
  function ucluk(r) {
    function kutu(ad, deg, alt) {
      return '<div class="ke-kutu"><p class="ke-kutu-ad">' + ad + "</p>" +
        '<p class="ke-kutu-deger">' + deg + "</p>" +
        '<p class="ke-kutu-alt">' + alt + "</p></div>";
    }
    var sepetAlt;
    if (r.sepetEtkisi === null) {
      sepetAlt = "Sabit sepet olmadan ayrıştırılamıyor.";
    } else if (Math.abs(r.sepetEtkisi) < 0.005) {
      sepetAlt = "Sepetiniz değişmemiş: harcamanızdaki artışın tamamı fiyat.";
    } else if (r.sepetEtkisi < 0) {
      sepetAlt = "Harcamanız, fiyatların artışından <strong>daha az</strong> " +
        "arttı — tüketiminizi kısmışsınız.";
    } else {
      sepetAlt = "Harcamanız, fiyatların artışından <strong>daha çok</strong> " +
        "arttı — sepetiniz büyümüş.";
    }
    return '<div class="ke-ucluk">' +
      kutu("Fiyat endeksi", yuzde(r.kisiselEnflasyon),
        "Sabit sepet üzerinden saf fiyat artışı. Sepetinizin " +
        yuzde(r.sabitSepetPayi, 0) + "'i endekse giriyor.") +
      kutu("Harcama değişimi", yuzde(r.harcamaDegisimi),
        "Cüzdanınıza gerçekte olan: " + para(r.tabanToplam) + " → " +
        para(r.simdiToplam) + " / ay.") +
      kutu("Sepet etkisi", r.sepetEtkisi === null ? "—" : puan(r.sepetEtkisi),
        sepetAlt) + "</div>";
  }

  /* ---------------------------- katkı tablosu ---------------------------- */
  function katkiTablosu(r) {
    if (!r.katkilar.length) return "";
    var enBuyukMutlak = r.katkilar.reduce(function (a, k) {
      return Math.max(a, Math.abs(k.katki));
    }, 0) || 1;

    var satir = r.katkilar.map(function (k) {
      /* Çubuk sıfırdan iki yöne: artı sağa, eksi sola. Yarım genişlik
         her yöne ayrılıyor ki sıfır çizgisi ortada dursun. */
      var oran = Math.abs(k.katki) / enBuyukMutlak;
      var gen = Math.max(1, Math.round(oran * 48));
      var stil = k.katki >= 0
        ? 'left:50%;width:' + gen + "%"
        : "right:50%;width:" + gen + "%";
      var rozet = "";
      if (k.yeniMi) rozet = '<span class="ke-rozet">yeni kalem</span>';
      else if (k.miktarDegisti) rozet = '<span class="ke-rozet">miktar değişti</span>';
      return '<tr class="' + (k.endekste ? "" : "ke-disarida") + '">' +
        '<th scope="row">' + esc(k.ad) + rozet + "</th>" +
        "<td>" + para(k.once) + "</td><td>" + para(k.simdi) + "</td>" +
        "<td>" + (k.degisim === null ? "—" : yuzde(k.degisim)) + "</td>" +
        "<td>" + (k.endekste ? yuzde(k.agirlik, 0) : "—") + "</td>" +
        "<td>" + (k.endekste ? puan(k.katki) : "—") + "</td>" +
        '<td class="ke-cubuk-hucre"><span class="ke-cubuk-yol">' +
        '<span class="ke-cubuk-sifir" style="left:50%"></span>' +
        (k.endekste
          ? '<span class="ke-cubuk ' + (k.katki >= 0 ? "ke-arti" : "ke-eksi") +
            '" style="' + stil + '"></span>'
          : "") +
        "</span></td></tr>";
    }).join("");

    return '<div class="ke-katki"><table>' +
      "<caption>Hangi kalem kaç puan ekledi? Katkıların toplamı tam olarak " +
      "fiyat endeksine eşittir — “miktar değişti” ve “yeni kalem” " +
      "işaretlileri endeksin dışındadır.</caption>" +
      '<thead><tr><th scope="col">Kalem</th><th scope="col">Geçen yıl</th>' +
      '<th scope="col">Bugün</th><th scope="col">Değişim</th>' +
      '<th scope="col">Endeks ağırlığı</th><th scope="col">Katkı</th>' +
      '<th scope="col"><span class="visually-hidden">Katkı çubuğu</span></th>' +
      "</tr></thead><tbody>" + satir + "</tbody>" +
      '<tfoot><tr><th scope="row">Toplam</th><td>' + para(r.tabanToplam) +
      "</td><td>" + para(r.simdiToplam) + "</td><td>—</td><td>%100</td><td>" +
      puan(r.kisiselEnflasyon) + "</td><td></td></tr></tfoot></table></div>";
  }

  /* ------------------------------ alım gücü ------------------------------ */
  function alimGucuEgrisi(r) {
    if (!window.Egri || r.kisiselEnflasyon === null || r.kisiselEnflasyon <= 0) return "";
    var taban = r.gelirSimdi > 0 ? r.gelirSimdi : 10000;
    var a = K.alimGucu(taban, r.kisiselEnflasyon, 10);
    var yari = a.yarilanma;
    return window.Egri.ciz({
      noktalar: a.seri.map(function (n) { return { x: n.yil, y: n.deger }; }),
      baslik: "Bu oran sürerse bugünkü " + para(taban) + " ne eder?",
      xEtiket: "Yıl",
      yEtiket: "Bugünün parasıyla",
      xTikler: [0, 2, 4, 6, 8, 10],
      xBicim: function (v) { return v === 0 ? "bugün" : v + ". yıl"; },
      yBicim: function (v) { return para(v); },
      secilen: { x: 10, y: a.sonDeger },
      secilenAd: "10. yıl " + para(a.sonDeger),
      not: "Bu bir TAHMİN DEĞİL: kişisel enflasyonunuzun aynı hızda sürmesi " +
        "varsayımıyla çizilmiş bir uzantı. " +
        (yari ? "Bu hızda alım gücü " + yari.toFixed(1).replace(".", ",") +
          " yılda yarıya iniyor." : "")
    });
  }

  /* --------------------------------- akış -------------------------------- */
  function hesapla() {
    var g = girdiTopla();
    if (!g.kalemler.length) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = "En az bir harcama kalemi girin.";
      return;
    }
    var r = K.analiz(g);
    if (r.hata) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = r.hata;
      return;
    }
    $("msg").hidden = true;
    $("results").innerHTML =
      kararKarti(r) + ucluk(r) + katkiTablosu(r) + alimGucuEgrisi(r);
  }

  /* PROFİL KÖPRÜSÜ. Burada bir incelik var: profil BUGÜNÜN gider
     tutarlarını tutuyor, bu araç ise GEÇEN YIL ile BUGÜNÜ karşılaştırıyor.
     Bu yüzden profilden gelen tutarlar "bugün" sütununa yazılıyor ve
     "geçen yıl" sütunu BOŞ bırakılıyor — uydurma bir geçmiş tutar
     üretmek, hesabın tamamını yanlış yapardı. */
  if (window.ProfilKopru) {
    window.ProfilKopru.bagla({
      hedef: $("pk-alan"),
      alanlar: ["gider"],
      yol: "../finansal-ikiz/",
      doldur: function (p) {
        var yapilan = [];
        if (p.giderler.length) {
          $("ke-govde").innerHTML = "";
          p.giderler.forEach(function (k) {
            satirEkle({ ad: k.ad, once: 0, simdi: Math.round(k.aylik),
              miktarDegisti: false });
          });
          yapilan.push(p.giderler.length + " kalemin BUGÜNKÜ tutarı " +
            "(geçen yıl sütununu siz doldurun)");
        }
        hesapla();
        return yapilan;
      }
    });
  }

  VARSAYILAN.forEach(satirEkle);
  $("ekle").addEventListener("click", function () {
    satirEkle({ ad: "", once: 0, simdi: 0, miktarDegisti: false });
    hesapla();
  });
  document.querySelectorAll("#ke-form > .ke-grid input").forEach(function (el) {
    el.addEventListener("input", hesapla);
    el.addEventListener("change", hesapla);
  });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
