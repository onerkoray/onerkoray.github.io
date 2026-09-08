/*!
 * Finansal Emniyet Testi — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Bütün hesap
 * hesap.js'te, taksitler ise sitenin kredi çekirdeğinde.
 *
 * WEB WORKER YOK — ÇÜNKÜ GEREKMİYOR. Tam rapor (7 senaryo × 12 ay, güvenli
 * tutar için ~60 adımlık ikiye bölme ve 5 alternatif) ölçüldüğünde birkaç
 * milisaniye sürüyor. Ölçmeden worker eklemek mimari gösterisi olurdu.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var E = window.Emniyet;
  if (!E) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) {
    if (!isFinite(n)) return "—";
    return para0.format(Math.round(n));
  }
  function yuzde(x) {
    if (!isFinite(x)) return "—";
    return "%" + (x * 100).toFixed(1).replace(".", ",");
  }
  function ay(m) {
    if (!isFinite(m)) return "sınırsız";
    return (Math.round(m * 10) / 10).toString().replace(".", ",") + " ay";
  }
  function puanYaz(p) { return Math.round(p).toString(); }
  function deger(id) { return E.sayi($(id).value); }
  function isaretli(id) { return $(id).checked; }

  function durumTopla() {
    return {
      netGelir: deger("e-gelir"),
      digerGelir: deger("e-diger"),
      gelirTuru: $("e-gelir-turu").value,
      zorunluGider: deger("e-zorunlu"),
      istegeBagliGider: deger("e-istege"),
      nakit: deger("e-nakit"),
      yatirim: deger("e-yatirim"),
      altinDoviz: deger("e-altin"),
      illikit: deger("e-illikit"),
      enBuyukVarlikYuzde: deger("e-yogunlasma"),
      borcBakiye: deger("e-borc-bakiye"),
      borcServisi: deger("e-borc-servisi"),
      mevcutAylikFaiz: deger("e-faiz"),
      dovizliBorcYuzde: deger("e-doviz-pay"),
      degiskenFaizliBorcYuzde: deger("e-degisken-pay"),
      kidemAy: deger("e-kidem"),
      issizlikOdenegi: deger("e-odenek"),
      issizlikOdenegiAy: deger("e-odenek-ay"),
      saglikSigortasi: isaretli("e-saglik"),
      borcSigortasi: isaretli("e-borc-sigorta"),
      hedefAy: deger("e-hedef-ay"),
      harcamaKisintisi: deger("e-kisinti"),
      dsrEsigi: deger("e-dsr-esigi"),
      sokHedefi: deger("e-sok-hedefi"),
      yakinYukumluluk: 0
    };
  }

  function kararTopla() {
    return {
      tutar: deger("e-karar-tutar"),
      pesinat: deger("e-pesinat"),
      vade: deger("e-vade"),
      aylikFaiz: deger("e-kredi-faiz"),
      krediTuru: $("e-kredi-turu").value,
      aylikEkGider: deger("e-ek-gider"),
      tekSeferlikGider: deger("e-tek-gider")
    };
  }

  /* ------------------------------------------------------------------ *
   * Bileşen çubukları
   *
   * Tek skora indirgememenin arayüzdeki karşılığı. Karar öncesi seviye ince
   * bir işaretle çubuğun üstünde kalıyor: düşüşü tabloya bakmadan görün.
   * ------------------------------------------------------------------ */
  var BILESEN_AD = {
    likidite: "Likidite",
    nakitAkisi: "Nakit akışı",
    borc: "Borç",
    sok: "Şok dayanıklılığı",
    koruma: "Koruma"
  };

  function seviye(p) { return p < 40 ? "dusuk" : (p < 70 ? "orta" : ""); }

  function bilesenleriCiz(once, sonra) {
    var kap = $("e-bilesenler");
    var html = "";
    Object.keys(BILESEN_AD).forEach(function (k) {
      var o = once.bilesen[k];
      var s = sonra ? sonra.bilesen[k] : o;
      var isaret = (sonra && Math.abs(s - o) > 0.5)
        ? '<i class="bilesen-once" style="left:' + o.toFixed(1) + '%"></i>' : "";
      html +=
        '<div class="bilesen">' +
        '<dt class="bilesen-ad">' + BILESEN_AD[k] + " (%" +
          Math.round(E.AGIRLIK[k] * 100) + ")</dt>" +
        '<dd class="bilesen-ray"><span class="bilesen-dolgu ' + seviye(s) +
          '" style="inline-size:' + s.toFixed(1) + '%"></span>' + isaret + "</dd>" +
        '<dd class="bilesen-deger">' + puanYaz(s) + "</dd>" +
        "</div>";
    });
    kap.innerHTML = html;
  }

  /* ------------------------------------------------------------------ *
   * Nakit yolu grafiği — saf SVG, kütüphane yok
   *
   * Dikey eksen DOĞRUSAL ve negatifi de kapsıyor: sıfırın altına inen bir
   * senaryoyu tabana yapıştırıp göstermemek, aracın söylediği tek şeyi
   * gizlemek olurdu.
   * ------------------------------------------------------------------ */
  var seciliSenaryo = "birlesik";

  function grafikCiz(stres, taban) {
    var svg = $("e-grafik");
    if (!svg) return;
    var W = 720, H = 300, sol = 8, sag = 58, ust = 14, alt = 26;
    var gw = W - sol - sag, gh = H - ust - alt;

    var enB = taban, enK = 0;
    stres.yollar.forEach(function (y) {
      var dizi = [y.baslangicNakdi].concat(y.aylar);
      dizi.forEach(function (v) {
        if (v > enB) enB = v;
        if (v < enK) enK = v;
      });
    });
    if (enB <= enK) enB = enK + 1;
    var pay = (enB - enK) * 0.06;
    enB += pay; enK -= pay;

    var n = stres.yollar[0] ? stres.yollar[0].aylar.length : 12;
    function x(i) { return sol + (gw * i) / Math.max(1, n); }
    function y(v) { return ust + gh - gh * ((v - enK) / (enB - enK)); }

    function yolu(k) {
      var dizi = [k.baslangicNakdi].concat(k.aylar);
      return "M" + dizi.map(function (v, i) { return x(i) + "," + y(v); }).join(" L");
    }

    var parcalar = [];
    /* Sıfırın altı hafifçe boyanıyor: "burası batış bölgesi". */
    if (enK < 0) {
      parcalar.push('<rect class="bolge-eksi" x="' + sol + '" y="' + y(0) +
        '" width="' + gw + '" height="' + Math.max(0, ust + gh - y(0)) + '"/>');
    }
    parcalar.push('<line class="cizgi-taban" x1="' + sol + '" y1="' + y(taban) +
      '" x2="' + (W - sag) + '" y2="' + y(taban) + '"/>');
    parcalar.push('<line class="cizgi-sifir" x1="' + sol + '" y1="' + y(0) +
      '" x2="' + (W - sag) + '" y2="' + y(0) + '"/>');

    var secili = null;
    stres.yollar.forEach(function (k) {
      if (k.ad === seciliSenaryo) { secili = k; return; }
      parcalar.push('<path class="yol-soluk" d="' + yolu(k) + '"/>');
    });
    if (secili) {
      parcalar.push('<path class="' + (secili.hayattaKaldi ? "yol-secili" : "yol-batik") +
        '" d="' + yolu(secili) + '"/>');
    }

    parcalar.push('<text class="eksen" x="' + (W - sag + 4) + '" y="' + (y(taban) + 4) +
      '">taban</text>');
    parcalar.push('<text class="eksen" x="' + (W - sag + 4) + '" y="' + (y(0) + 4) +
      '">0 ₺</text>');
    parcalar.push('<text class="eksen" x="' + sol + '" y="' + (H - 8) + '">bugün</text>');
    parcalar.push('<text class="eksen" x="' + (W - sag) + '" y="' + (H - 8) +
      '" text-anchor="end">' + n + ". ay</text>");
    parcalar.push('<text class="eksen" x="' + sol + '" y="' + (ust + 10) + '">' +
      para(enB) + "</text>");

    svg.innerHTML = parcalar.join("");
  }

  function senaryoDugmeleri(stres) {
    var kap = $("e-senaryolar");
    kap.innerHTML = stres.yollar.map(function (y) {
      return '<button type="button" data-ad="' + y.ad + '"' +
        (y.hayattaKaldi ? "" : ' class="batik"') +
        ' aria-pressed="' + (y.ad === seciliSenaryo) + '">' + y.etiket + "</button>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * Ana akış
   * ------------------------------------------------------------------ */
  function hesapla() {
    var girdi = durumTopla();
    var karar = kararTopla();
    var r = E.rapor(girdi, karar);
    var once = r.once, sonra = r.sonra || r.once;
    var kararVar = !!r.sonra;

    /* Hedef tampon otomatikse türetimi kullanıcıya göster. */
    var d = r.durum;
    var not = $("e-hedef-not");
    if (d.hedefAyOtomatik) {
      not.textContent = "Durumunuzdan türetildi: " + d.hedefAy + " ay (" +
        d.hedefAyGerekce.map(function (p) { return p.neden; }).join(" + ") + ").";
    } else {
      not.textContent = "Sizin belirlediğiniz süre. Durumunuzdan türetilseydi " +
        d.hedefAyOnerilen + " ay olurdu.";
    }

    $("e-kopru").setAttribute("data-karar", kararVar ? "var" : "yok");
    $("e-puan-once").textContent = puanYaz(once.puan);
    $("e-segment-once").textContent = once.segment;
    $("e-yan-once").className = "kopru-yan kopru-once " + seviye(once.puan);
    $("e-puan-sonra").textContent = puanYaz(sonra.puan);
    $("e-segment-sonra").textContent = sonra.segment;
    $("e-yan-sonra").className = "kopru-yan kopru-sonra " + seviye(sonra.puan);

    var fark = sonra.puan - once.puan;
    var farkEl = $("e-fark");
    if (!kararVar) {
      farkEl.className = "kopru-fark";
      farkEl.textContent = "Bir karar tutarı girin; etkisini burada görürsünüz.";
    } else {
      farkEl.className = "kopru-fark " + (fark < -0.5 ? "eksi" : (fark > 0.5 ? "arti" : ""));
      farkEl.textContent = fark < -0.5
        ? "Bu karar emniyet skorunuzu " + Math.abs(Math.round(fark)) + " puan düşürüyor."
        : (fark > 0.5 ? "Bu karar skoru " + Math.round(fark) + " puan yükseltiyor."
                      : "Bu kararın skora etkisi ihmal edilebilir.");
    }

    bilesenleriCiz(once, kararVar ? sonra : null);

    function ikili(idOnce, id, bicim, oAl, sAl) {
      $(idOnce).textContent = kararVar ? bicim(oAl(once)) + " →" : "";
      $(id).textContent = bicim(sAl(sonra));
    }
    ikili("e-menzil-once", "e-menzil", ay,
      function (s) { return s.olcum.menzil; }, function (s) { return s.olcum.menzil; });
    ikili("e-pay-once", "e-pay", para,
      function (s) { return s.olcum.finansalPay; }, function (s) { return s.olcum.finansalPay; });
    ikili("e-taban-once", "e-taban", para,
      function (s) { return s.olcum.nakitTabani; }, function (s) { return s.olcum.nakitTabani; });
    ikili("e-fazla-once", "e-fazla", para,
      function (s) { return s.olcum.fazlaLikidite; }, function (s) { return s.olcum.fazlaLikidite; });
    ikili("e-dsr-once", "e-dsr", yuzde,
      function (s) { return s.olcum.dsr; }, function (s) { return s.olcum.dsr; });

    $("e-sok-once").textContent = kararVar
      ? once.stres.gecenSenaryo + "/" + once.stres.senaryoSayisi + " →" : "";
    $("e-sok").textContent = sonra.stres.gecenSenaryo + "/" + sonra.stres.senaryoSayisi;
    $("e-taksit").textContent = r.karar ? para(r.karar.taksit) : "—";

    var g = r.guvenliTutar;
    $("e-guvenli").textContent = !g ? "—"
      : (!g.guvenli ? "0 ₺" : (g.sinirBulunamadi ? para(g.tutar) + "+" : para(g.tutar)));

    /* Uyarılar: en ağır olan bir tane. Beş uyarıyı üst üste yığmak hiçbirini
       okutmaz. */
    var uyari = "", agir = false;
    if (r.kararAcigi > 0.5) {
      uyari = "Peşinat ve tek seferlik masraflar için " + para(r.kararAcigi) +
        " eksiğiniz var; bu tutar likit varlıklarınızdan karşılanamıyor.";
      agir = true;
    } else if (g && !g.guvenli) {
      uyari = "Mevcut durumunuz kısıtları zaten sağlamıyor, bu yüzden güvenle " +
        "verilebilecek bir karar büyüklüğü yok. Önce tamponu ve borç yükünü düzeltmek gerekiyor.";
      agir = true;
    } else if (g && kararVar && r.karar.tutar > g.tutar && !g.sinirBulunamadi) {
      uyari = "Girdiğiniz tutar, güvenli üst sınırın " +
        para(r.karar.tutar - g.tutar) + " üzerinde." +
        (g.engel.length ? " Sınırı belirleyen kısıt: " + engelAdi(g.engel[0]) + "." : "");
      agir = sonra.puan < 50;
    } else if (sonra.olcum.finansalPay <= 0) {
      uyari = "Zorunlu gider ve borç ödemeniz gelirinizi aşıyor; her ay birikim eriyor.";
      agir = true;
    }
    $("e-uyari").hidden = !uyari;
    $("e-uyari").className = "uyari" + (agir ? " agir" : "");
    $("e-uyari").textContent = uyari;

    /* Gerekçe */
    $("e-gerekce").innerHTML = (kararVar ? r.gerekce : [{
      alan: "yok", baslik: "Henüz bir karar girilmedi",
      metin: "Yukarıdaki karar alanlarını doldurun; skorun neden değiştiği burada satır satır çıkar."
    }]).map(function (x) {
      return '<li' + (x.alan === "yok" ? ' class="iyi"' : "") + "><strong>" +
        x.baslik + "</strong><span>" + x.metin + "</span></li>";
    }).join("");

    /* Grafik ve senaryo tablosu — karar sonrası duruma göre. */
    var stres = sonra.stres;
    if (!stres.yollar.some(function (y) { return y.ad === seciliSenaryo; })) {
      seciliSenaryo = stres.yollar[stres.yollar.length - 1].ad;
    }
    senaryoDugmeleri(stres);
    grafikCiz(stres, sonra.olcum.nakitTabani);

    $("e-senaryo-tablo").innerHTML = stres.yollar.map(function (y, i) {
      var o = once.stres.yollar[i];
      return "<tr><th scope=\"row\">" + y.etiket + "</th>" +
        '<td class="' + (o.hayattaKaldi ? "gecti" : "dustu") + '">' +
          (o.hayattaKaldi ? "geçti" : o.batisAyi + ". ay") + "</td>" +
        '<td class="' + (y.hayattaKaldi ? "gecti" : "dustu") + '">' +
          (y.hayattaKaldi ? "geçti" : y.batisAyi + ". ay") + "</td>" +
        "<td>" + para(y.enDusukNakit) + "</td>" +
        "<td>" + (y.batisAyi ? y.batisAyi + ". ay" : "—") + "</td></tr>";
    }).join("");

    /* Alternatifler */
    var enIyi = 0;
    r.alternatif.forEach(function (a, i) {
      if (a.fonlanabilir && a.puan > r.alternatif[enIyi].puan) enIyi = i;
    });
    $("e-alternatif-tablo").innerHTML = r.alternatif.map(function (a, i) {
      return "<tr" + (i === enIyi && i !== 0 ? ' class="oneri"' : "") +
        '><th scope="row">' + a.etiket +
        (a.not ? '<br><small class="muted">' + a.not + "</small>" : "") + "</th>" +
        "<td>" + puanYaz(a.puan) + "</td>" +
        "<td>" + ay(a.menzil) + "</td>" +
        "<td>" + yuzde(a.dsr) + "</td>" +
        "<td>" + a.gecen + "/" + a.senaryo + "</td>" +
        "<td>" + (a.taksit > 0 ? para(a.taksit) : "—") + "</td>" +
        "<td>" + (a.toplamGeriOdeme > 0 ? para(a.toplamGeriOdeme) : "—") + "</td></tr>";
    }).join("");

    /* Skora girmeyen riskler */
    var b = sonra.bayrak;
    $("e-bayraklar").innerHTML =
      bayrakSatiri("Yoğunlaşma riski", b.yogunlasma,
        "Yatırılabilir varlığınızın " + yuzde(b.yogunlasma.deger) +
        "'i tek bir yerde. Tek varlığın çökmesi tamponu birlikte götürür.") +
      bayrakSatiri("Kur riski", b.kur,
        "Net döviz açığınız " + para(sonra.olcum.kurAcikligi) +
        ", yıllık hane gelirinizin " + yuzde(b.kur.deger) + "'i kadar. " +
        "Geliri TL, borcu döviz olan hane kur yükselince iki kere kaybeder.");
  }

  function bayrakSatiri(ad, b, aciklama) {
    return '<li class="bayrak"><b>' + ad + '</b><span class="rozet ' +
      (b.seviye === "dusuk" ? "" : b.seviye) + '">' + b.etiket + "</span><em>" +
      aciklama + "</em></li>";
  }

  function engelAdi(k) {
    return {
      "nakit-tabani": "nakit tabanı",
      "borc-servisi": "borç servisi tavanı",
      "sok-dayanimi": "şok dayanımı hedefi",
      "pesinat-fonlanamiyor": "peşinatın karşılanamaması"
    }[k] || k;
  }

  var bekle = 0;
  function tetikle() {
    clearTimeout(bekle);
    bekle = setTimeout(hesapla, 90);
  }

  document.querySelectorAll("#hesapla input, #hesapla select").forEach(function (el) {
    el.addEventListener("input", tetikle);
    el.addEventListener("change", tetikle);
  });

  $("e-senaryolar").addEventListener("click", function (ev) {
    var d = ev.target.closest("button[data-ad]");
    if (!d) return;
    seciliSenaryo = d.getAttribute("data-ad");
    hesapla();
  });

  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
