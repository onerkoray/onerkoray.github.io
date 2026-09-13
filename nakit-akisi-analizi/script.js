/*!
 * Nakit Akışı Analizi — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Hesap
 * finans/nakit-akisi-motoru.js'te, o da bordro motorunu, zaman motorunu ve
 * enflasyon motorunu çağırıyor — hepsi testlerle korunuyor.
 *
 * ANLATIM KARARI: beş eşit kutu yerine TEK birincil sayı — tasarruf oranı.
 * Sebebi, aracın cevapladığı sorunun tek olması: "bu akış sizi nereye
 * götürüyor?" Diğer metrikler o cevabı destekliyor, onunla yarışmıyor.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var N = window.NakitAkisiMotoru;
  var B = window.Bordro;
  var F = window.Finans;
  if (!N || !B || !F) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return para0.format(n || 0); }
  function kisa(n) {
    var b = Math.round(Math.abs(n) / 1000);
    if (b === 0) return "0";
    return (n < 0 ? "−" : "") + (b >= 1000
      ? (b / 1000).toFixed(1).replace(".", ",") + "M" : b + "k");
  }
  function yuzde(x, basamak) {
    if (x === null || !isFinite(x)) return "—";
    return "%" + (x * 100).toFixed(basamak === undefined ? 1 : basamak).replace(".", ",");
  }
  function deger(id) { return F.sayi($(id).value); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  (function yillariDoldur() {
    var s = $("in-yil");
    B.yillar().forEach(function (y) {
      var o = document.createElement("option");
      o.value = String(y); o.textContent = String(y);
      if (y === B.sonYil()) o.selected = true;
      s.appendChild(o);
    });
  }());

  /* ------------------------------ gider satırları ------------------------ */
  /* Varsayılanlar gerçekçi bir başlangıç durumu veriyor: araç boş bir
     formla değil, çalışır hâlde açılıyor ki ne yaptığı ilk bakışta
     görünsün. Rakamlar örnek; kullanıcı üzerine yazıyor. */
  var VARSAYILAN = [
    { ad: "Kira / konut", tutar: 22000, zorunlu: true },
    { ad: "Market ve mutfak", tutar: 14000, zorunlu: true },
    { ad: "Faturalar", tutar: 5500, zorunlu: true },
    { ad: "Ulaşım", tutar: 6000, zorunlu: true },
    { ad: "Abonelikler", tutar: 2500, zorunlu: false },
    { ad: "Dışarıda yemek ve keyif", tutar: 7000, zorunlu: false }
  ];

  function satirEkle(k) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="na-ad"><input type="text" value="' + esc(k.ad) +
      '" aria-label="Gider adı"></td>' +
      '<td class="na-tutar"><input type="text" inputmode="decimal" value="' +
      k.tutar + '" aria-label="Aylık tutar"></td>' +
      '<td><label class="na-onay"><input type="checkbox"' +
      (k.zorunlu ? " checked" : "") + ' aria-label="Zorunlu gider"></label></td>' +
      '<td><button type="button" class="na-sil" aria-label="Satırı sil">×</button></td>';
    tr.querySelector(".na-sil").addEventListener("click", function () {
      tr.remove(); hesapla();
    });
    tr.querySelectorAll("input").forEach(function (el) {
      el.addEventListener("input", hesapla);
      el.addEventListener("change", hesapla);
    });
    $("na-govde").appendChild(tr);
  }

  function giderleriOku() {
    return Array.prototype.map.call(
      $("na-govde").querySelectorAll("tr"), function (tr) {
        var g = tr.querySelectorAll("input");
        return {
          ad: g[0].value.trim() || "Gider",
          tutar: F.sayi(g[1].value),
          zorunlu: g[2].checked
        };
      }).filter(function (k) { return isFinite(k.tutar); });
  }

  function girdiTopla() {
    return {
      aylikBrut: deger("in-brut"),
      digerGelir: deger("in-diger"),
      yil: Number($("in-yil").value) || B.sonYil(),
      getiri: deger("in-getiri") / 100,
      enflasyon: deger("in-enf") / 100,
      ufukYil: deger("in-ufuk"),
      giderler: giderleriOku()
    };
  }

  /* -------------------------------- özet --------------------------------- */
  function kart(etiket, deger, alt, ana) {
    return '<div class="na-kart' + (ana ? " na-kart--ana" : "") + '">' +
      '<p class="na-etiket">' + etiket + "</p>" +
      '<p class="na-deger">' + deger + "</p>" +
      (alt ? '<p class="na-alt">' + alt + "</p>" : "") + "</div>";
  }

  function ozet(r) {
    var anaAlt;
    if (r.acikVarMi) {
      anaAlt = "Giderleriniz gelirinizi <strong>" + para(-r.tasarruf) +
        "</strong> aşıyor. Bu akış birikim üretmiyor; açığın kapandığı yer " +
        "ya borç ya mevcut birikimdir.";
    } else {
      anaAlt = "Her ay " + para(r.tasarruf) + " artıyor. Bu oran " + r.ufukYil +
        " yıl sürerse, bugünün parasıyla <strong>" + para(r.birikimUfukta) +
        "</strong> birikir — yatırımın yıllık reel getirisi " +
        yuzde(r.reelGetiri, 2) + " varsayımıyla.";
    }

    var dayanma = r.aylikZorunlu > 0
      ? kart("Zorunlu gider", para(r.aylikZorunlu),
          "Geliriniz kesilse durduramayacağınız aylık yük. " +
          '<a href="../finansal-emniyet-testi/">Dayanma sürenizi ölçün</a>.')
      : "";

    var kamaKart = r.ucret.isverenMaliyeti > 0
      ? kart("Vergi kaması", yuzde(r.vergiKamasi),
          "İşveren maliyetinin bu kadarı size ulaşmıyor: " +
          para(r.ucret.isverenMaliyeti - r.ucret.net) + " / ay.")
      : "";

    return '<div class="na-ozet">' +
      kart("Tasarruf oranınız", yuzde(r.tasarrufOrani), anaAlt, true) +
      kart("Harcanabilir gelir", para(r.netGelir),
        r.ucret.isverenMaliyeti > 0
          ? "12 ayın ortalaması; kümülatif tarifede net ücret yıl içinde düşer."
          : "Girdiğiniz diğer gelir.") +
      kart("Aylık gider", para(r.giderToplam),
        "Zorunlu " + para(r.zorunluToplam) + " · isteğe bağlı " +
        para(r.isteğeBagliToplam) + ".") +
      dayanma + kamaKart + "</div>";
  }

  /* ------------------------------- Sankey -------------------------------- */
  function diyagram(r) {
    if (!window.Sankey) return "";
    var a = N.akis(r);
    /* Diyagramdaki HER KOL AYLIK tutardır. Ufuktaki birikim bilinçli olarak
       buraya konmuyor: stok ile akışı aynı ölçekte çizmek olurdu. O sayı
       yukarıdaki karar kartında duruyor. */
    var not = "Kol kalınlıkları aylık tutarlarla orantılı; diyagramdaki her " +
      "kol aynı birimde. " +
      (r.tasarruf > 0
        ? "Tasarrufun " + r.ufukYil + " yıl sonunda ne ettiği yukarıdaki " +
          "kartta — bir stok değeri olduğu için aylık akışın içine çizilmiyor."
        : "Bu akışta tasarruf kolu yok; gelirin tamamı gidere gidiyor.") +
      " Sayıların tamamı tabloda.";
    return window.Sankey.ciz({
      dugumler: a.dugumler,
      baglantilar: a.baglantilar,
      baslik: "Paranız işveren maliyetinden başlayıp nereye gidiyor?",
      bicim: para,
      not: not,
      yukseklik: Math.max(360, 120 + r.giderler.length * 46)
    });
  }

  /* ---------------------------- ömür bedeli ------------------------------ */
  function omurTablosu(r) {
    if (!r.giderler.length) return "";
    var enBuyuk = r.giderler[0].tutar || 1;
    var satir = r.giderler.map(function (k) {
      var genislik = Math.max(4, Math.round(100 * k.tutar / enBuyuk));
      return "<tr><th scope=\"row\">" + esc(k.ad) +
        (k.zorunlu ? '<span class="na-rozet">zorunlu</span>' : "") + "</th>" +
        "<td>" + para(k.tutar) + "</td>" +
        '<td class="na-pay">' + yuzde(k.pay) +
        '<span class="na-pay-cubuk' + (k.zorunlu ? " na-zorunlu" : "") +
        '" style="width:' + genislik + '%"></span></td>' +
        "<td>" + para(k.omurBedeli) + "</td></tr>";
    }).join("");
    return '<div class="na-omur"><table>' +
      "<caption>Her kalemin " + r.ufukYil + " yıllık ömür bedeli — " +
      "o parayı ödemek yerine yatırsaydınız bugünün parasıyla ne birikirdi</caption>" +
      '<thead><tr><th scope="col">Kalem</th><th scope="col">Aylık</th>' +
      '<th scope="col">Gelirin payı</th><th scope="col">' + r.ufukYil +
      ' yıllık bedel</th></tr></thead><tbody>' + satir + "</tbody></table>" +
      '<p class="na-alt">Ömür bedeli bir kayıp değil, <strong>fırsat maliyeti</strong>: ' +
      "kira ödemeseydiniz sokakta kalırdınız. Tablo o kalemin gereksiz olduğunu " +
      "değil, neyin karşılığında vazgeçildiğini gösteriyor.</p></div>";
  }

  /* ----------------------------- ısı haritası ---------------------------- */
  function isi(g, r) {
    if (!window.IsiHaritasi || r.aylikZorunlu <= 0) return "";
    var iz = N.duyarlilik(g, r);
    return window.IsiHaritasi.ciz({
      izgara: iz,
      baslik: "Bu tasarruf oranı sizi kaç yıl taşır?",
      xEtiket: "Tasarruf oranı",
      yEtiket: "Süre",
      artiAd: "Bir yıllık giderden fazla",
      eksiAd: "Bir yıllık giderden az",
      xBicim: function (v) { return yuzde(v, 0); },
      yBicim: function (v) { return v + " yıl"; },
      bicim: function (v) {
        var y = v + 1;
        return y.toFixed(1).replace(".", ",") + "y";
      },
      not: "Hücre değerleri, o tasarruf oranıyla o süre sonunda birikenin " +
        "BUGÜNKÜ zorunlu giderinizin kaç yılını karşıladığı (" +
        para(r.aylikZorunlu * 12) + " / yıl). Sınır bir yıllık giderde: " +
        "altındaki hücreler bir yıllık masrafınızı bile karşılamıyor."
    });
  }

  /* --------------------------------- akış -------------------------------- */
  function hesapla() {
    var g = girdiTopla();
    if (!isFinite(g.aylikBrut) || !isFinite(g.digerGelir) ||
        !isFinite(g.getiri) || !isFinite(g.enflasyon) || !isFinite(g.ufukYil)) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = "Gelir, getiri, enflasyon ve ufuk alanlarını sayı olarak doldurun.";
      return;
    }
    var r = N.analiz(g);
    if (r.hata) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = r.hata;
      return;
    }
    $("msg").hidden = true;
    $("results").innerHTML =
      ozet(r) + diyagram(r) + omurTablosu(r) + isi(g, r);
  }

  VARSAYILAN.forEach(satirEkle);
  $("ekle").addEventListener("click", function () {
    satirEkle({ ad: "", tutar: 0, zorunlu: false });
    hesapla();
  });
  document.querySelectorAll("#na-form > .na-grid input, #na-form > .na-grid select")
    .forEach(function (el) {
      el.addEventListener("input", hesapla);
      el.addEventListener("change", hesapla);
    });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
