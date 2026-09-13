/*!
 * Erken Kapatma vs Yatırım — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Hesap
 * finans/erken-kapatma-motoru.js'te, o da kredi matematiğini
 * finans/zaman-motoru.js'ten alıyor — ikisi de testlerle korunuyor.
 *
 * ANLATIM KARARI: en büyük sayı kullanıcının girdiği getiriyle bulunan
 * servet farkı DEĞİL, başabaş eşiği. Çünkü girilen getiri bir tahmindir,
 * eşik ise verilen krediye ait bir olgudur. Kullanıcı tahminini değiştirse
 * bile eşik yerinde durur; akılda kalması gereken sayı odur.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var M = window.ErkenKapatmaMotoru;
  var F = window.Finans;
  if (!M || !F) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return para0.format(n || 0); }
  function yuzde(x, basamak) {
    if (x === null || !isFinite(x)) return "—";
    return "%" + (x * 100).toFixed(basamak === undefined ? 1 : basamak).replace(".", ",");
  }
  function deger(id) { return F.sayi($(id).value); }

  /* Tazminat kuralının kullanıcıya dönük anlatımı. Motor sayıyı üretiyor;
     burada yalnızca hangi maddenin neden uygulandığı yazılıyor. */
  var TAZMINAT_METNI = {
    ihtiyac: {
      madde: "6502 sayılı TKHK m.27",
      metin: "İhtiyaç ve taşıt kredilerinde <strong>erken ödeme tazminatı alınamaz</strong>. " +
             "Banka, erken kapattığınız kısma isabet eden faizi indirmek zorundadır. " +
             "Size ceza yansıtılıyorsa bu kanuna aykırıdır."
    },
    "konut-degisken": {
      madde: "6502 sayılı TKHK m.37",
      metin: "Değişken faizli konut kredilerinde <strong>erken ödeme tazminatı istenemez</strong>. " +
             "Tazminat yalnızca sabit faizli konut finansmanı sözleşmelerine özgüdür."
    },
    "konut-sabit": {
      madde: "6502 sayılı TKHK m.37",
      metin: "Sabit faizli konut kredisinde tazminat istenebilir: kalan vade 36 aydan " +
             "fazlaysa erken ödenen anaparanın en çok <strong>%2'si</strong>, 36 ay ve " +
             "altındaysa en çok <strong>%1'i</strong>."
    }
  };

  function girdiTopla() {
    return {
      kalanAnapara: deger("in-anapara"),
      aylikFaiz: deger("in-faiz") / 100,
      kalanVadeAy: deger("in-vade"),
      krediTuru: $("in-tur").value,
      tutar: deger("in-tutar"),
      yatirimNetYillik: deger("in-getiri") / 100,
      enflasyon: deger("in-enf") / 100
    };
  }

  function kararKarti(r, g) {
    var esik = r.basabasGetiri;
    var cumle;
    if (esik === null) {
      cumle = "Bu kredide erken kapatma, makul getiri aralığının tamamında " +
        (r.kazanan === "kapatma" ? "öne geçiyor" : "geride kalıyor") + ".";
    } else if (g.yatirimNetYillik > esik) {
      cumle = "Girdiğiniz " + yuzde(g.yatirimNetYillik) + " net getiri bu eşiğin " +
        "<strong>üstünde</strong>: bu varsayımla <strong>yatırım kazanıyor</strong>.";
    } else {
      cumle = "Girdiğiniz " + yuzde(g.yatirimNetYillik) + " net getiri bu eşiğin " +
        "<strong>altında</strong>: bu varsayımla <strong>krediyi kapatmak kazanıyor</strong>.";
    }

    /* Eşiğin nereden geldiği tek cümlede söyleniyor: tazminat yoksa eşik
       kredinin efektif yıllık faizidir. Bu bir tesadüf değil tanımdır ve
       kullanıcının sayıya güvenmesi için görünmesi gerekir. */
    var kaynak = r.tazminatYok
      ? "Eşik, kredinizin efektif yıllık faizine eşit (" + yuzde(r.kapatmaGetirisi, 2) +
        "): krediyi kapatmak, o faizi <em>risksiz ve vergisiz</em> kazanmaktır."
      : "Erken ödeme tazminatı (" + para(r.tazminat) + ") eşiği aşağı çekiyor; " +
        "tazminatsız olsaydı eşik kredinin efektif faizi olurdu: " + yuzde(r.kapatmaGetirisi, 2) + ".";

    /* Reel karşılık, nominal eşiğin ne kadarının enflasyon olduğunu gösterir.
       Çıkarma yaklaşımı değil bölme kullanılıyor (enflasyon motoru); %30'un
       üstündeki oranlarda iki yöntem puanlarca ayrışıyor. */
    var reelNot = "";
    if (esik !== null && window.EnflasyonMotoru) {
      reelNot = " Enflasyon " + yuzde(g.enflasyon, 0) + " varsayımıyla bu eşiğin " +
        "reel karşılığı " + yuzde(window.EnflasyonMotoru.reel(esik, g.enflasyon), 1) + ".";
    }

    return '<div class="ek-karar">' +
      '<p class="ek-etiket">Kararın döndüğü eşik</p>' +
      '<p class="ek-esik">' + (esik === null ? "aralıkta yok" : yuzde(esik, 2)) + "</p>" +
      '<p class="ek-cumle">Yatırımınız <strong>vergi sonrası yıllık ' +
      (esik === null ? "—" : yuzde(esik, 2)) + "</strong> getirinin üstünde kalırsa yatırım, " +
      "altında kalırsa krediyi kapatmak kazanır. " + cumle + "</p>" +
      '<p class="ek-not">' + kaynak + reelNot + "</p></div>";
  }

  function tazminatKutusu(r) {
    var t = TAZMINAT_METNI[r.krediTuru];
    var ek = "";
    if (r.tazminatTavaniUygulandi) {
      ek = "<p>Hesaplanan tazminat, sağlanan faiz indirimini aştığı için " +
        "<strong>indirime eşitlendi</strong>: kanunen tazminat, erken ödemenin " +
        "sağladığı faiz indirimini aşamaz.</p>";
    }
    return '<div class="ek-tazminat">' +
      "<p>" + t.metin + " <span class=\"ek-madde\">" + t.madde + "</span></p>" +
      "<p>Bu hesapta uygulanan tazminat: <strong>" + para(r.tazminat) + "</strong>" +
      (r.tazminatYok ? " (yok)" : "") + ".</p>" + ek + "</div>";
  }

  function yolKartlari(r, g) {
    var kapatmaOnde = r.kazanan === "kapatma";
    function kart(ad, tutar, onde, satirlar) {
      return '<div class="ek-yol' + (onde ? " onde" : "") + '">' +
        '<p class="ek-yol-ad">' + ad +
        (onde ? '<span class="ek-rozet">önde</span>' : "") + "</p>" +
        '<p class="ek-tutar">' + para(tutar) + "</p>" +
        "<dl>" + satirlar + "</dl></div>";
    }
    function s(k, v) { return "<dt>" + k + "</dt><dd>" + v + "</dd>"; }

    var kapatma = kart("Krediyi kapatmak", r.kapatmaServeti, kapatmaOnde,
      s("Ödenen anapara", para(r.odenen)) +
      s("Erken ödeme tazminatı", para(r.tazminat)) +
      s("Kurtarılan faiz", para(r.faizIndirimi)) +
      s("Kredi bitişi", r.yeniBitisAy + ". ay (" + r.kisalanAy + " ay erken)"));

    var yatirim = kart("Yatırıma koymak", r.yatirimServeti, !kapatmaOnde,
      s("Yatırılan tutar", para(g.tutar)) +
      s("Net yıllık getiri", yuzde(g.yatirimNetYillik)) +
      s("Ödenecek toplam faiz", para(r.tabanFaiz)) +
      s("Kredi bitişi", Math.round(g.kalanVadeAy) + ". ay (değişmez)"));

    return '<div class="ek-yollar">' + kapatma + yatirim + "</div>";
  }

  function ozetTablo(r, g) {
    function sat(k, v) { return "<tr><th scope=\"row\">" + k + "</th><td>" + v + "</td></tr>"; }
    return '<div class="ek-ozet"><table>' +
      "<caption class=\"visually-hidden\">Hesap özeti</caption><tbody>" +
      sat("Aylık taksit", para(r.taksit)) +
      sat("Erken ödenen anapara", para(r.odenen)) +
      (r.artan > 0 ? sat("Krediden artan ve yatırıma giden", para(r.artan)) : "") +
      sat("Tazminat sonrası net kazanç", para(r.netKazanc)) +
      sat("Vade sonunda iki yol arasındaki fark", (r.fark >= 0 ? "+" : "−") + para(Math.abs(r.fark))) +
      "</tbody></table>" +
      '<p class="muted-note">Her iki yolda da aynı para harcanır: krediyi kapatınca ' +
      "serbest kalan taksit aynı getiriyle yatırıma yönlendirilir. Karşılaştırma " +
      "orijinal vadenin sonunda (" + Math.round(g.kalanVadeAy) + ". ay) yapılır.</p></div>";
  }

  /* Isı haritası: iki parametre birbirini götürüyor — daha yüksek yatırım
     getirisi yatırım lehine, daha büyük erken ödeme kapatma lehine çalışıyor.
     Tek senaryo bu takası gösteremez; sınırı ancak yüzey gösterir. */
  function isiHaritasi(r, g) {
    if (!window.IsiHaritasi) return "";
    var B = g.kalanAnapara;
    var yler = [];
    for (var p = 1; p <= 6; p++) yler.push(Math.round(B * p / 6 / 1000) * 1000);
    var esik = r.basabasGetiri === null ? 0.35 : r.basabasGetiri;
    /* x ekseni eşiğin ETRAFINDA örnekleniyor: sabit 20–70 aralığı, eşik
       dışarıda kalırsa ızgarayı tek renge boyar ve sınır görünmez. */
    var xler = [];
    for (var k = -3; k <= 3; k++) {
      /* TAM YÜZDEYE yuvarlanıyor: eksen etiketi ile örneklenen oran
         birebir aynı olmalı. Aksi halde %34,49'da örneklenen sütun
         "%34" yazıp başka bir sayıyı gösteriyordu. */
      xler.push(Math.max(0, Math.round((esik + k * 0.06) * 100) / 100));
    }
    var izgara = M.duyarlilik(g, { x: xler, y: yler });
    return '<div class="ek-isi">' + window.IsiHaritasi.ciz({
      izgara: izgara,
      baslik: "Karar hangi noktada tersine döner?",
      xEtiket: "Yatırımın net yıllık getirisi",
      yEtiket: "Erken ödenen tutar",
      artiAd: "Kapatmak önde",
      eksiAd: "Yatırım önde",
      xBicim: function (v) { return yuzde(v, 0); },
      yBicim: function (v) {
        var b = Math.round(v / 1000);
        return b >= 1000 ? (b / 1000).toFixed(1).replace(".", ",") + "M" : b + "k";
      },
      bicim: function (v) {
        var b = Math.round(Math.abs(v) / 1000);
        if (b === 0) return "0";          /* "−0k" diye bir tutar yok */
        return (v < 0 ? "−" : "") + (b >= 1000
          ? (b / 1000).toFixed(1).replace(".", ",") + "M"
          : b + "k");
      },
      not: "Hücre değerleri vade sonundaki servet farkı (bin TL). Satırlar erken " +
           "ödenen tutarı, sütunlar yatırımın vergi sonrası yıllık getirisini gösterir; " +
           "diğer bütün girdiler formdaki değerlerinde sabit tutulur."
    }) + "</div>";
  }

  function hesapla() {
    var g = girdiTopla();
    var gecerli = isFinite(g.kalanAnapara) && isFinite(g.tutar) &&
      isFinite(g.aylikFaiz) && isFinite(g.kalanVadeAy) && g.kalanVadeAy >= 1;
    if (!gecerli) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = "Tutar, faiz ve vade alanlarını sayı olarak doldurun.";
      return;
    }
    var r = M.analiz(g);
    if (r.hata) {
      $("results").innerHTML = "";
      $("msg").hidden = false;
      $("msg").textContent = r.hata;
      return;
    }
    $("msg").hidden = true;
    $("results").innerHTML =
      kararKarti(r, g) + tazminatKutusu(r) + yolKartlari(r, g) +
      ozetTablo(r, g) + isiHaritasi(r, g);
  }

  document.querySelectorAll("#ek-form input, #ek-form select").forEach(function (el) {
    el.addEventListener("input", hesapla);
    el.addEventListener("change", hesapla);
  });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
