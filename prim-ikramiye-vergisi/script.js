/*!
 * Prim ve İkramiye Vergisi — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir vergi formülü içermez. Hesap
 * bordro/ek-odeme-motoru.js'te, o da bordro motorunu çağırıyor — ikisi de
 * testlerle korunuyor.
 *
 * ANLATIM KARARI: sayfanın ilk sayısı "ne kadarı elinize geçer". Asıl tez
 * (ayın gelir vergisini değiştirmediği) ondan hemen sonra, ÖLÇÜLMÜŞ bir
 * sayıyla geliyor — iddia olarak değil. Bir sayfa yaygın bir inanışı
 * yanlışlıyorsa, kanıtı kullanıcının kendi rakamlarıyla göstermesi gerekir.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var E = window.EkOdemeMotoru;
  var B = window.Bordro;
  var F = window.Finans;
  if (!E || !B || !F) return;

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
  function puan(x) {
    return (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1).replace(".", ",") + " puan";
  }
  function deger(id) { return F.sayi($(id).value); }

  /* Yıl seçeneği motordan geliyor; sayfa yıl listesi tutmuyor. */
  (function yillariDoldur() {
    var s = $("in-yil");
    B.yillar().forEach(function (y) {
      var o = document.createElement("option");
      o.value = String(y); o.textContent = String(y);
      if (y === B.sonYil()) o.selected = true;
      s.appendChild(o);
    });
  }());

  function zamAcik() { return $("in-zam-var").checked; }

  function tabanMaas() {
    var m = deger("in-maas");
    if (!zamAcik()) return m;
    var zamAy = Number($("in-zam-ay").value) || 7;
    var yeni = deger("in-zam-brut");
    var a = [];
    for (var i = 1; i <= 12; i++) a.push(i < zamAy ? m : yeni);
    return a;
  }

  function girdiTopla() {
    return {
      aylikBrut: tabanMaas(),
      tutar: deger("in-tutar"),
      ay: Number($("in-ay").value) || 12,
      yil: Number($("in-yil").value) || B.sonYil()
    };
  }

  /* ------------------------------ karar kartı ---------------------------- */
  function kararKarti(r) {
    /* Ortalamayla karşılaştırma, kullanıcının kafasındaki sayıyı doğrudan
       hedef alıyor. Yönü sabit olmadığı için cümle iki halde de kuruluyor. */
    var fark = r.marjinalFarki;
    var kiyas;
    if (Math.abs(fark) < 0.005) {
      kiyas = "Bu, maaşınızın ortalama kesinti oranıyla (" +
        yuzde(r.ortalamaKesinti) + ") hemen hemen aynı.";
    } else if (fark > 0) {
      kiyas = "Maaşınızın ortalama kesinti oranı " + yuzde(r.ortalamaKesinti) +
        "; ek ödemede <strong>" + puan(fark) + " daha yüksek</strong> bir oran " +
        "uygulanıyor, çünkü artan oranlı tarifede üst dilimlere giriyor.";
    } else {
      kiyas = "Maaşınızın ortalama kesinti oranı " + yuzde(r.ortalamaKesinti) +
        "; ek ödemede <strong>" + puan(fark) + " daha düşük</strong>, çünkü " +
        "maaşınız SGK tavanını aştığı için bu ödemeden prim kesilmiyor.";
    }

    return '<div class="pi-karar">' +
      '<p class="pi-etiket">Elinize geçen</p>' +
      '<p class="pi-tutar">' + para(r.eleGecen) + "</p>" +
      '<p class="pi-cumle">' + para(r.tutar) + " brüt ödemeden <strong>" +
      yuzde(r.efektifKesinti) + "</strong> kesiliyor. " + kiyas + "</p>" +
      '<p class="pi-not">İşverene toplam maliyeti ' + para(r.isverenMaliyeti) +
      ". Aradaki fark " + para(r.isverenMaliyeti - r.eleGecen) +
      ' — <a href="../vergi-kamasi-hesaplama/">vergi kaması</a>.</p></div>';
  }

  /* --------------------------- kesinti dökümü ---------------------------- */
  function dokum(r) {
    var t = r.tutar || 1;
    function p(v) { return (100 * v / t).toFixed(2) + "%"; }
    var serit = '<div class="pi-serit" role="img" aria-label="' +
      "Ödemenin dağılımı: elinize geçen " + yuzde(r.eleGecen / t) +
      ", gelir vergisi " + yuzde(r.gelirVergisi / t) +
      ", SGK ve işsizlik " + yuzde(r.sgk / t) +
      ", damga " + yuzde(r.damga / t) + '">' +
      '<span class="pi-p-net" style="width:' + p(r.eleGecen) + '"></span>' +
      '<span class="pi-p-gv" style="width:' + p(r.gelirVergisi) + '"></span>' +
      '<span class="pi-p-sgk" style="width:' + p(r.sgk) + '"></span>' +
      '<span class="pi-p-damga" style="width:' + p(r.damga) + '"></span></div>';

    function kalem(sinif, ad, v) {
      return '<span class="pi-kalem"><span class="pi-kutu ' + sinif +
        '" aria-hidden="true"></span><span class="pi-kalem-ad">' + ad +
        '</span><span class="pi-kalem-deger">' + para(v) + "</span></span>";
    }
    return serit + '<div class="pi-dokum">' +
      kalem("pi-p-net", "Elinize geçen", r.eleGecen) +
      kalem("pi-p-gv", "Gelir vergisi", r.gelirVergisi) +
      kalem("pi-p-sgk", "SGK + işsizlik", r.sgk) +
      kalem("pi-p-damga", "Damga vergisi", r.damga) + "</div>";
  }

  /* -------------------------------- bulgular ----------------------------- */
  function bulgu(soru, cevap, sayi, yokMu) {
    return '<div class="pi-bulgu">' +
      '<p class="pi-bulgu-soru">' + soru + "</p>" +
      '<p class="pi-bulgu-sayi' + (yokMu ? " pi-yok" : "") + '">' + sayi + "</p>" +
      '<p class="pi-bulgu-cevap">' + cevap + "</p></div>";
  }

  function bulgular(r, b) {
    var ayCevap, aySayi, ayYok = false;
    if (!r.ayOnemliMi) {
      ayCevap = "Maaşınız yıl boyunca sabit olduğu için ödemenin ayı " +
        "<strong>hiçbir şeyi değiştirmiyor</strong>. 12 ayın tamamı hesaplandı; " +
        "gelir vergisi farkı " + para(r.vergiYayilimi) + ", elinize geçen farkı " +
        para(r.ayFarki) + ". Kümülatif tarifede yılın vergisi yalnızca yılın " +
        "toplam matrahına bağlıdır.";
      aySayi = "fark yok"; ayYok = true;
    } else {
      ayCevap = "En iyi ay <strong>" + r.enIyiAy.ayAdi + "</strong>, en kötüsü " +
        r.enKotuAy.ayAdi + ". Sebebi gelir vergisi değil <strong>SGK tavanı</strong>: " +
        "aylar arasındaki gelir vergisi farkı yalnızca " + para(r.vergiYayilimi) +
        " iken SGK farkı " + para(r.sgkYayilimi) + ". Taban maaşınızın yüksek " +
        "olduğu ayda ödemenin daha büyük kısmı tavanın üstünde kalıyor.";
      aySayi = para(r.ayFarki);
    }

    var bolCevap, bolSayi, bolYok = false;
    if (b.fark < 1) {
      bolCevap = "Bu tutarda fark etmiyor: ödeme bölünse de her parça SGK " +
        "tavanının altında kalıyor, yani her hâlükârda tamamından prim kesiliyor.";
      bolSayi = "fark yok"; bolYok = true;
    } else {
      bolCevap = "<strong>Tek seferde</strong> alın. " + b.enKotu.parca +
        " parçaya bölündüğünde SGK kesintisi " + para(b.enKotu.sgk - b.enIyi.sgk) +
        " artıyor, çünkü her parça tavanın altında kalıp tamamen prime tabi oluyor. " +
        "Karşılığında: tavan üstü kazanç emeklilik matrahınıza da girmez.";
      bolSayi = para(b.fark);
    }

    return '<div class="pi-bulgular">' +
      bulgu("Hangi ayda almalı?", ayCevap, aySayi, ayYok) +
      bulgu("Tek seferde mi, bölerek mi?", bolCevap, bolSayi, bolYok) +
      "</div>";
  }

  /* ------------------------------- ay tablosu ---------------------------- */
  function ayTablosu(r) {
    /* Ay önemsizken tablo ve ısı haritası çizilmiyor — olmayan bir farkı
       göstermek yanıltıcı olurdu. Ama aracın o yeteneği hiç görünmeden
       kalmasın diye nereye bakılacağı söyleniyor. */
    if (!r.ayOnemliMi) {
      return '<p class="pi-ipucu">Ay analizi ve karar yüzeyi, maaşınız yıl ' +
        "içinde değiştiğinde anlam kazanıyor. Yukarıdaki <strong>“Zam aldım”</strong> " +
        "kutusunu işaretleyin: 12 ayın karşılaştırması ve ay × tutar ısı haritası " +
        "burada açılır.</p>";
    }
    var satir = r.aylar.map(function (s) {
      var enIyi = s.ay === r.enIyiAy.ay;
      return '<tr class="' + (enIyi ? "pi-en-iyi" : "") + '">' +
        '<th scope="row">' + s.ayAdi + (enIyi ? " · en iyi" : "") + "</th>" +
        "<td>" + para(s.tabanBrut) + "</td><td>" + para(s.eleGecen) +
        "</td><td>" + para(s.sgk) + "</td><td>" + para(s.gelirVergisi) + "</td></tr>";
    }).join("");
    return '<div class="pi-tablo"><table>' +
      "<caption>Ödemenin ayına göre elinize geçen (diğer girdiler sabit)</caption>" +
      '<thead><tr><th scope="col">Ay</th><th scope="col">O ayki brüt maaş</th>' +
      '<th scope="col">Elinize geçen</th><th scope="col">SGK + işsizlik</th>' +
      '<th scope="col">Gelir vergisi</th></tr></thead><tbody>' + satir +
      "</tbody></table></div>";
  }

  /* --------------------------------- eğri -------------------------------- */
  function egri(g, r) {
    if (!window.Egri) return "";
    var e = E.tutarEgrisi(g);
    if (!e.egri.length) return "";
    var secilen = null;
    for (var i = 0; i < e.egri.length; i++) {
      if (Math.abs(e.egri[i].tutar - r.tutar) < 1) secilen = e.egri[i];
    }
    var not = e.tekYonluDegil
      ? "Eğri tek yönlü değil: ödeme büyüdükçe SGK yükü oransal olarak düşerken " +
        "gelir vergisi yükü artıyor. İkisinin yarıştığı tepe " +
        para(e.tepe.tutar) + " civarında."
      : "Bu aralıkta eğri tek yönlü ilerliyor; tepe noktası aralığın dışında kalıyor.";
    return window.Egri.ciz({
      noktalar: e.egri.map(function (n) { return { x: n.tutar, y: n.kalanOran }; }),
      baslik: "Ödeme büyüdükçe elinizde kalan oran",
      xEtiket: "Ek ödeme (brüt)",
      yEtiket: "Elinizde kalan oran",
      xBicim: function (v) { return kisa(v) + " TL"; },
      yBicim: function (v) { return yuzde(v, 0); },
      tepe: { x: e.tepe.tutar, y: e.tepe.kalanOran },
      tepeAd: "tepe " + yuzde(e.tepe.kalanOran),
      secilen: secilen ? { x: secilen.tutar, y: secilen.kalanOran } : null,
      secilenAd: secilen ? "sizin tutarınız " + yuzde(secilen.kalanOran) : "",
      not: not + " Her nokta için bordronun 12 ayı yeniden hesaplanır; " +
           "yaklaşık formül kullanılmaz."
    });
  }

  /* ----------------------------- ısı haritası ---------------------------- */
  /* Tutar ekseni EŞİĞİN ETRAFINA oturtuluyor.
     Ölçüm: zamanlama farkı, ödeme SGK tavanını aşmaya başlayana kadar tam
     sıfır; sonra hızla açılıp bir tavana oturuyor (ölçülen: 100k'da 0,
     150k'da 1.394, 200k'da 6.137, 300k ve üstünde sabit 5.850). Sabit bir
     "tutarın katları" merdiveni bu açılmayı tek satırda es geçiyordu.
     Eşik = tavan − o ayki taban maaş; iki uç, en yüksek ve en düşük maaşlı
     aydan geliyor. */
  function tutarEkseni(g, r) {
    var P = B.parametre(g.yil);
    var tavan = B.donem(P, 12).sgkTavan;
    var taban = E.tabanDizi(g.aylikBrut).filter(function (x) { return x > 0; });
    var enAz = Math.min.apply(null, taban);
    var enCok = Math.max.apply(null, taban);
    var alt = tavan - enCok;          // yüksek maaşlı ayda eşiğin aşıldığı tutar
    var ust = tavan - enAz;           // düşük maaşlı ayda
    var yler;
    if (alt > 0 && ust > alt) {
      var bas = alt * 0.6, son = ust * 1.45;
      yler = [];
      for (var i = 0; i < 5; i++) {
        yler.push(Math.round((bas + (son - bas) * i / 4) / 10000) * 10000);
      }
    } else {
      /* Maaş zaten tavanın üstündeyse eşik yok; tutarın katlarına dönülüyor. */
      yler = [];
      for (var p = 1; p <= 5; p++) yler.push(Math.round(r.tutar * p / 3 / 10000) * 10000);
    }
    var kendi = Math.round(r.tutar / 10000) * 10000;
    if (kendi > 0 && yler.indexOf(kendi) < 0) yler.push(kendi);
    return yler.filter(function (v) { return v > 0; })
      .sort(function (a, b) { return a - b; });
  }

  function isi(g, r) {
    if (!window.IsiHaritasi || !r.ayOnemliMi) return "";
    var izgara = E.duyarlilik(g, { y: tutarEkseni(g, r) });
    return window.IsiHaritasi.ciz({
      izgara: izgara,
      baslik: "Hangi aylar iyi, hangileri kötü?",
      xEtiket: "Ödemenin ayı",
      yEtiket: "Ödeme tutarı",
      artiAd: "Ortalamadan iyi",
      eksiAd: "Ortalamadan kötü",
      xBicim: function (v) { return B.AY_ADLARI[v - 1].slice(0, 3); },
      yBicim: function (v) { return kisa(v); },
      /* İşaret açıkça yazılıyor: bu bir FARK ölçeği, "3k" ile "−3k" arasında
         yalnızca renk tonuyla ayrım yapmak tek kanala yaslanmak olurdu. */
      bicim: function (v) {
        var s = kisa(v);
        return (v > 0 && s !== "0") ? "+" + s : s;
      },
      not: "Hücre değerleri, o ayda almanın 12 ay ortalamasına göre farkı (bin TL). " +
           "Bütün fark SGK tavanından gelir; gelir vergisi aya göre değişmez."
    });
  }

  /* --------------------------------- akış -------------------------------- */
  function hesapla() {
    var g = girdiTopla();
    var maasGecerli = Array.isArray(g.aylikBrut)
      ? g.aylikBrut.every(function (x) { return isFinite(x) && x >= 0; })
      : isFinite(g.aylikBrut);
    if (!maasGecerli || !isFinite(g.tutar)) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = "Maaş ve ek ödeme alanlarını sayı olarak doldurun.";
      return;
    }
    var r = E.analiz(g);
    if (r.hata) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = r.hata;
      return;
    }
    $("msg").hidden = true;
    var b = E.bolmeKarsilastirmasi(g);
    $("results").innerHTML =
      kararKarti(r) + dokum(r) + bulgular(r, b) + ayTablosu(r) + egri(g, r) + isi(g, r);
  }

  function zamAlanlari() {
    var acik = zamAcik();
    $("in-zam-ay").disabled = !acik;
    $("in-zam-brut").disabled = !acik;
    hesapla();
  }

  $("in-zam-var").addEventListener("change", zamAlanlari);
  document.querySelectorAll("#pi-form input[type=text], #pi-form select")
    .forEach(function (el) {
      el.addEventListener("input", hesapla);
      el.addEventListener("change", hesapla);
    });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
