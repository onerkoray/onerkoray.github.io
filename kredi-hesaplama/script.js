/* Kredi Hesaplama — arayüz katmanı.
 *
 * Hesabın tamamı hesap.js'te ve testli; burada yalnızca form okuma ve çizim
 * var. Ayrım kasıtlı: bir kredi hesabının yanlışlığı ekranda hata vermez.
 */
(function () {
  "use strict";

  var K = window.Kredi;
  if (!K) return;

  function $(id) { return document.getElementById(id); }
  function el(t, s) { var d = document.createElement(t); if (s) d.className = s; return d; }

  var nfPara = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfOran = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function para(n) { return nfPara.format(isFinite(n) ? n : 0) + " TL"; }
  function oran(n) { return "%" + nfOran.format(isFinite(n) ? n : 0); }
  function deger(id) { return ($(id) || {}).value || ""; }

  /* --------------------------------------------------------------- girdi */
  function girdiOku() {
    return {
      anapara: deger("in-anapara"),
      aylikFaiz: deger("in-faiz"),
      vade: deger("in-vade"),
      kkdf: deger("in-kkdf"),
      bsmv: deger("in-bsmv"),
      tahsisOran: deger("in-tahsis"),
      sigortaPesin: deger("in-sigorta-pesin"),
      sigortaAylik: deger("in-sigorta-aylik"),
      digerMasraf: deger("in-diger")
    };
  }

  function kart(etiket, deger, not, vurgu) {
    var k = el("div", "sum-card" + (vurgu ? " sum-vurgu" : ""));
    var e = el("span", "sum-label"); e.textContent = etiket;
    var d = el("strong", "sum-value"); d.textContent = deger;
    k.appendChild(e); k.appendChild(d);
    if (not) { var n = el("span", "sum-note"); n.textContent = not; k.appendChild(n); }
    return k;
  }

  /* --------------------------------------------------------------- çizim */
  var sonPlan = null;

  function ciz() {
    var g = girdiOku();
    var p = K.plan(g);
    sonPlan = p;

    /* özet kartları */
    var kap = $("sonuc");
    kap.textContent = "";
    if (!p.gecerli) {
      var uyari = el("p", "alan-not");
      uyari.textContent = "Kredi tutarı ve vade girin.";
      kap.appendChild(uyari);
      $("ymo-vurgu").hidden = true;
      $("plan-tablo").textContent = "";
      return;
    }

    var izgara = el("div", "sum-grid");
    izgara.appendChild(kart("Aylık taksit", para(p.aylikOdeme),
      p.sigorta > 0 ? "sigorta dahil" : "eşit taksit", true));
    izgara.appendChild(kart("Toplam geri ödeme", para(p.toplamGeriOdeme),
      p.vade + " ayda"));
    izgara.appendChild(kart("Toplam maliyet", para(p.toplamMaliyet),
      "faiz + vergi + masraf"));
    izgara.appendChild(kart("Aylık maliyet oranı", oran(p.aylikMaliyetOrani),
      "faiz " + oran(p.aylikFaiz) + " + vergiler"));
    izgara.appendChild(kart("Toplam faiz", para(p.toplamFaiz), "vergiler hariç"));
    izgara.appendChild(kart("KKDF + BSMV", para(p.toplamVergi),
      p.toplamVergi > 0 ? "faiz üzerinden" : "bu kredide yok"));
    kap.appendChild(izgara);

    /* YMO vurgusu — aracın asıl iddiası */
    $("ymo-vurgu").hidden = false;
    $("ymo-basit").textContent = oran(p.basitYillik);
    $("ymo-gercek").textContent = oran(p.ymoYillik);
    $("ymo-aciklama").textContent = p.fark > 0.01
      ? "Aradaki " + nfOran.format(p.fark) + " puanı üreten üç şey: faize eklenen " +
        "KKDF ve BSMV, aylık faizin yıllık bileşik karşılığı ve peşin masrafların " +
        "krediyi küçültmesi."
      : "Bu kredide vergi ve masraf olmadığı için fark yalnızca bileşik faizden geliyor.";

    /* özet rozetleri */
    $("vergi-ozet").textContent = "KKDF " + oran(K.sayi(g.kkdf)) +
      " · BSMV " + oran(K.sayi(g.bsmv));
    var masrafToplam = p.pesinMasraf + p.aylikMasrafToplam;
    $("masraf-ozet").textContent = masrafToplam > 0 ? para(masrafToplam) : "yok";

    planCiz(p);
    erkenCiz();
    ekCiz();
    kiyasCiz();
  }

  /* ---------------------------------------------------------- ödeme planı */
  function planCiz(p) {
    var kap = $("plan-tablo");
    kap.textContent = "";
    var sar = el("div", "table-scroll");
    var t = el("table", "payroll");

    var bas = el("caption", "visually-hidden");
    bas.textContent = "Ay ay ödeme planı";
    t.appendChild(bas);

    var thead = el("thead");
    var tr = el("tr");
    var basliklar = ["Ay", "Taksit", "Faiz", "KKDF", "BSMV", "Anapara", "Kalan borç"];
    if (p.satirlar[0].sigorta > 0) basliklar.splice(5, 0, "Sigorta");
    basliklar.forEach(function (b) {
      var th = el("th"); th.scope = "col"; th.textContent = b; tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);

    var tbody = el("tbody");
    p.satirlar.forEach(function (s) {
      var r = el("tr");
      var h = el("th"); h.scope = "row"; h.textContent = String(s.ay); r.appendChild(h);
      var hucreler = [para(s.taksit), para(s.faiz), para(s.kkdf), para(s.bsmv)];
      if (p.satirlar[0].sigorta > 0) hucreler.push(para(s.sigorta));
      hucreler.push(para(s.anapara));
      hucreler.push(para(s.kalan));
      hucreler.forEach(function (x) {
        var td = el("td"); td.textContent = x; r.appendChild(td);
      });
      tbody.appendChild(r);
    });
    t.appendChild(tbody);
    sar.appendChild(t);
    kap.appendChild(sar);

    var not = el("p", "muted-note table-note");
    not.textContent = "Her satırda faiz + KKDF + BSMV + anapara = taksit; " +
      "anapara payları toplamı kuruşu kuruşuna kredi tutarına eşittir.";
    kap.appendChild(not);
  }

  /* --------------------------------------------------------- erken kapama */
  function erkenCiz() {
    if (!sonPlan || !sonPlan.gecerli) return;
    var kaydirac = $("in-erken-ay");
    kaydirac.max = String(sonPlan.vade);
    if (Number(kaydirac.value) > sonPlan.vade) kaydirac.value = String(sonPlan.vade);
    var ay = Number(kaydirac.value);
    $("erken-ay-etiket").textContent = ay + ". ay";

    var e = K.erkenKapama(sonPlan, ay, deger("in-tazminat"));
    var kap = $("erken-sonuc");
    kap.textContent = "";
    if (!e) return;

    var izgara = el("div", "sum-grid");
    izgara.appendChild(kart("Kapatmak için ödenecek", para(e.kapamaTutari),
      e.tazminat > 0 ? "tazminat dahil" : "kalan anapara", true));
    izgara.appendChild(kart("Kaçınılan maliyet", para(e.kacinilanMaliyet),
      "ödenmeyecek faiz ve vergi"));
    izgara.appendChild(kart("O güne kadar ödenen", para(e.odenmisTaksit),
      ay + " taksit"));
    izgara.appendChild(kart("Toplamda ödenen", para(e.toplamOdenen),
      "vadesinde: " + para(sonPlan.toplamGeriOdeme)));
    kap.appendChild(izgara);

    var not = el("p", "alan-not");
    not.textContent = "Tüketici kredilerinde erken ödemede kalan faizden indirim " +
      "yapılması zorunludur. Konut kredilerinde sabit faizli sözleşmelerde tazminat " +
      "istenebilir; yukarıdaki orana yazın.";
    kap.appendChild(not);
  }

  /* -------------------------------------------------------------- ek ödeme */
  function ekCiz() {
    if (!sonPlan || !sonPlan.gecerli) return;
    var e = K.ekOdeme(girdiOku(), deger("in-ek"));
    var kap = $("ek-sonuc");
    kap.textContent = "";
    if (!e || !e.gecerli) {
      var p = el("p", "alan-not");
      p.textContent = "Bir ek ödeme tutarı girin.";
      kap.appendChild(p);
      return;
    }
    var izgara = el("div", "sum-grid");
    izgara.appendChild(kart("Kredi ne zaman biter", e.yeniVade + " ay",
      e.kisalanAy + " ay erken", true));
    izgara.appendChild(kart("Tasarruf", para(e.tasarruf), "ödenmeyen faiz ve vergi"));
    izgara.appendChild(kart("Yeni toplam ödeme", para(e.yeniToplam),
      "eski: " + para(e.eskiToplam)));
    izgara.appendChild(kart("Aylık ödemeniz",
      para(sonPlan.aylikOdeme + e.aylikEk), "taksit + ek ödeme"));
    kap.appendChild(izgara);
  }

  /* --------------------------------------------------------- karşılaştırma */
  function kiyasCiz() {
    if (!sonPlan || !sonPlan.gecerli) return;
    var a = girdiOku();
    var b = {
      anapara: a.anapara,
      aylikFaiz: deger("in-b-faiz"),
      vade: deger("in-b-vade"),
      kkdf: a.kkdf, bsmv: a.bsmv,
      tahsisOran: deger("in-b-tahsis"),
      sigortaPesin: deger("in-b-sigorta")
    };
    var k = K.karsilastir(a, b);
    var kap = $("kiyas-sonuc");
    kap.textContent = "";
    if (!k) return;

    var sar = el("div", "table-scroll");
    var t = el("table", "payroll");
    var thead = el("thead");
    var tr = el("tr");
    ["", "A teklifi", "B teklifi"].forEach(function (x) {
      var th = el("th"); th.scope = "col"; th.textContent = x; tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);

    var tbody = el("tbody");
    function satir(ad, av, bv, vurgu) {
      var r = el("tr", vurgu ? "net-up" : "");
      var h = el("th"); h.scope = "row"; h.textContent = ad; r.appendChild(h);
      [av, bv].forEach(function (x) {
        var td = el("td"); td.textContent = x; r.appendChild(td);
      });
      tbody.appendChild(r);
    }
    satir("Aylık faiz", oran(k.a.aylikFaiz), oran(k.b.aylikFaiz));
    satir("Vade", k.a.vade + " ay", k.b.vade + " ay");
    satir("Aylık taksit", para(k.a.aylikOdeme), para(k.b.aylikOdeme));
    satir("Peşin masraf", para(k.a.pesinMasraf), para(k.b.pesinMasraf));
    satir("Toplam geri ödeme", para(k.a.toplamGeriOdeme), para(k.b.toplamGeriOdeme));
    satir("Yıllık maliyet oranı", oran(k.a.ymoYillik), oran(k.b.ymoYillik), true);
    t.appendChild(tbody);
    sar.appendChild(t);
    kap.appendChild(sar);

    var hukum = el("div", "legal-note verdict");
    var b3 = el("h3");
    b3.textContent = k.kazanan === null ? "İki teklif eşit"
      : (k.kazanan === "a" ? "A teklifi daha ucuz" : "B teklifi daha ucuz");
    hukum.appendChild(b3);
    var p1 = el("p");
    p1.textContent = k.kazanan === null
      ? "Yıllık maliyet oranları aynı."
      : "Yıllık maliyet oranı " + nfOran.format(k.ymoFarki) +
        " puan düşük; toplam geri ödemede " + para(k.maliyetFarki) + " fark var.";
    hukum.appendChild(p1);
    if (k.taksitYaniltiyor) {
      var p2 = el("p");
      p2.innerHTML = "<strong>Dikkat:</strong> taksiti düşük olan teklif, toplamda " +
        "daha pahalı. Karşılaştırmayı taksite göre yapmak burada yanlış sonuç verirdi.";
      hukum.appendChild(p2);
    }
    kap.appendChild(hukum);
  }

  /* --------------------------------------------------------------- kurulum */
  function kur() {
    var tur = $("in-tur");
    K.TURLER.forEach(function (t) {
      var o = el("option"); o.value = t.ad; o.textContent = t.etiket;
      tur.appendChild(o);
    });
    tur.value = "ihtiyac";

    /* Tür değişince vergi varsayılanları güncellenir; kullanıcı elle
       değiştirmişse bile tür seçimi kasıtlı bir eylemdir, üzerine yazılır. */
    tur.addEventListener("change", function () {
      var t = K.turBilgi(tur.value);
      $("in-kkdf").value = String(t.kkdf);
      $("in-bsmv").value = String(t.bsmv);
      ciz();
    });

    $("kredi-form").addEventListener("input", ciz);
    $("kredi-form").addEventListener("change", ciz);
    $("kredi-form").addEventListener("submit", function (e) { e.preventDefault(); });

    ["in-erken-ay", "in-tazminat"].forEach(function (id) {
      $(id).addEventListener("input", erkenCiz);
    });
    $("in-ek").addEventListener("input", ekCiz);
    ["in-b-faiz", "in-b-vade", "in-b-tahsis", "in-b-sigorta"].forEach(function (id) {
      $(id).addEventListener("input", kiyasCiz);
    });

    /* sekmeler */
    var sekmeler = Array.prototype.slice.call(document.querySelectorAll(".sekme"));
    sekmeler.forEach(function (s) {
      s.addEventListener("click", function () {
        sekmeler.forEach(function (x) {
          var acik = x === s;
          x.setAttribute("aria-selected", String(acik));
          $(x.getAttribute("data-hedef")).hidden = !acik;
        });
      });
    });

    ciz();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kur);
  } else {
    kur();
  }
})();
