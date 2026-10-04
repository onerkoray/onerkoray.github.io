/* Engelli araç ÖTV istisnası — sayfa katmanı.
   Hesap yapmaz: formu okur, EngelliArac çekirdeğine (hesap.js) verir,
   sonucu ve akış grafiğini (akis.js) çizer. Renkler --dv-* tokenlarından. */
(function () {
  "use strict";
  var E = window.EngelliArac, A = window.Akis;
  var form = document.getElementById("ea-form");
  if (!E || !A || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(v) { return nf.format(Math.round(v)) + " TL"; }
  function yuzde(v) { return "%" + (v * 100).toFixed(1).replace(".", ","); }
  function sayi(el) {
    var s = String(el.value).trim().replace(/\s/g, "");
    if (!s) return NaN;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tarih(s) { var p = s.split("-"); return +p[2] + " " + AY[+p[1] - 1] + " " + p[0]; }
  function bugunISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---- seçimler ------------------------------------------------------------ */
  var secim = { durum: "a", sinif: "binek", yakit: "icten", tip: "anahtar", mod: "istisna" };
  function baglaSecim(ozellik, sonra) {
    document.querySelectorAll("[data-" + ozellik + "]").forEach(function (b) {
      b.addEventListener("click", function () {
        secim[ozellik] = b.getAttribute("data-" + ozellik);
        document.querySelectorAll("[data-" + ozellik + "]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        if (sonra) sonra();
        hesapla();
      });
    });
  }
  baglaSecim("durum", alanlar);
  baglaSecim("sinif", alanlar);
  baglaSecim("yakit", alanlar);
  baglaSecim("tip", alanlar);
  baglaSecim("mod");

  function alanlar() {
    document.querySelectorAll("[data-gor]").forEach(function (x) {
      x.hidden = x.getAttribute("data-gor").split(" ").indexOf(secim.durum) < 0;
    });
    var hesapli = secim.sinif !== "kamyonet" && secim.sinif !== "motosiklet";
    var motorlu = secim.sinif !== "motosiklet";
    document.querySelectorAll("[data-arac='motor']").forEach(function (x) { x.hidden = !motorlu; });
    var ticari = secim.sinif === "yukyolcu" || secim.sinif === "dokuz";
    /* Ticari satırlarda (II) sayılı liste yalnız içten yanmalı ve elektrikliyi ayırır. */
    document.querySelectorAll("[data-yakit='hibrit'], [data-yakit='phev']").forEach(function (b) {
      b.hidden = secim.sinif !== "binek";
    });
    if (secim.sinif !== "binek" && (secim.yakit === "hibrit" || secim.yakit === "phev")) {
      secim.yakit = "icten";
      document.querySelectorAll("[data-yakit]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-yakit") === "icten")); });
    }
    document.querySelectorAll("[data-yakitgor]").forEach(function (x) {
      x.hidden = !motorlu || x.getAttribute("data-yakitgor").split(" ").indexOf(secim.yakit) < 0;
    });
    document.querySelectorAll("[data-ticari]").forEach(function (x) { x.hidden = !ticari; });
    document.querySelectorAll("[data-fiyat]").forEach(function (x) { x.hidden = !hesapli; });
    $("e-fiyat-etiket").textContent = secim.tip === "anahtar" ? "Anahtar teslim fiyat (TL)" : "Vergisiz fiyat (TL)";
    document.querySelectorAll("[data-onceki]").forEach(function (x) { x.hidden = $("e-onceki").value !== "evet"; });
  }
  $("e-onceki").addEventListener("change", alanlar);

  function girdi() {
    var d = secim.durum, kisi = {};
    if (d === "a" || d === "b") { kisi.oran = sayi($("e-oran")); kisi.sandalye = d === "b" && $("e-sandalye").value === "evet"; }
    if (d === "c1") { kisi.tertibat = $("e-tertibat").value === "evet"; kisi.ehliyetKodu = $("e-kod").value === "evet"; }
    if (d === "c2") { kisi.ortopedik = sayi($("e-orto")); kisi.ehliyetAlamaz = $("e-ehliyet").value === "evet"; }
    var otv = { tur: secim.yakit, hacim: sayi($("e-hacim")) };
    if (secim.yakit === "hibrit" || secim.yakit === "phev") otv.elektrikKw = sayi($("e-ekw"));
    if (secim.yakit === "elektrik") otv.kw = sayi($("e-kw"));
    if (secim.yakit === "phev") { otv.co2 = sayi($("e-co2")); otv.menzil = sayi($("e-menzil")); }
    return {
      bugun: $("e-tarih").value || bugunISO(), kisi: kisi,
      sonIstisna: $("e-onceki").value === "evet" ? $("e-onceki-tarih").value : null,
      arac: { sinif: secim.sinif, otv: otv, dortCeker: $("e-4x4").value === "evet", yerliKatki: $("e-yerli").value },
      fiyat: sayi($("e-fiyat")), fiyatTip: secim.tip
    };
  }

  /* ---- akış grafiği ---------------------------------------------------------- */
  var akis = A.kur($("o-akis"), { kaynak: "Liste fiyatı" });
  function akisCiz(r) {
    var h = r.hesap, kap = $("o-akis").closest(".ea-akis-kart");
    if (!h) { kap.hidden = true; return; }
    kap.hidden = false;
    var istisnaVar = r.durum !== "uygun-degil";
    var goster = secim.mod === "istisna" && istisnaVar;
    var n = h.normal, i = h.istisnali;
    var yollar = [
      { ad: "Araç bedeli", deger: n.matrah, sinif: "ak-1" },
      { ad: "ÖTV · %" + n.oran, deger: goster ? 0 : n.otv, sinif: "ak-2" },
      { ad: "KDV · %20", deger: goster ? i.kdv : n.kdv, sinif: "ak-3" },
      { ad: "Size kalan", deger: goster ? h.tasarruf : 0, sinif: "ak-4" }
    ];
    akis.ciz(yollar, n.toplam, "Liste fiyatı " + tl(n.toplam) + ": " + yollar.map(function (y) { return y.ad + " " + tl(y.deger); }).join(", "));
    var not = $("o-akis-not");
    if (secim.mod === "istisna" && !istisnaVar) not.textContent = "Şartlardan biri sağlanmadığı için istisna uygulanmaz: liste fiyatının tamamı ödenir.";
    else if (goster) not.textContent = "İstisnayla ÖTV kalkar; KDV yalnız araç bedeli üzerinden hesaplanır. Aradaki fark, ÖTV ve ÖTV'nin KDV'si, sizde kalır.";
    else not.textContent = "Normal alıcıda KDV, ÖTV dahil bedel üzerinden hesaplanır.";
  }

  /* ---- sonuç ------------------------------------------------------------------ */
  var DURUM = {
    "uygun": ["Uygun", "ea-iyi"],
    "belirsiz": ["Bir şart belirsiz", "ea-uyar"],
    "uygun-degil": ["Uygun değil", "ea-kotu"]
  };
  var son = null;
  function hesapla() {
    var hata = $("e-hata"), kutu = $("ea-sonuc"), g, r;
    try {
      g = girdi();
      r = E.hesapla(g);
    } catch (e) {
      hata.textContent = e.message;
      kutu.classList.add("ea-bayat");
      return;
    }
    hata.textContent = "";
    kutu.classList.remove("ea-bayat");
    son = r;

    var d = DURUM[r.durum];
    $("o-rozet").textContent = d[0];
    $("o-rozet").className = "ea-rozet " + d[1];
    var h = r.hesap;
    if (h) {
      $("ea-cevap-bas").textContent = r.durum === "uygun-degil" ? "Ödeyeceğiniz (istisnasız)" : "İstisnayla ödeyeceğiniz";
      A.sayac($("o-toplam"), r.odenecek, tl);
      $("o-alt").innerHTML = r.durum === "uygun-degil"
        ? "Liste fiyatı · istisna olsaydı " + esc(tl(h.istisnali.toplam)) + " olurdu"
        : "Liste fiyatı " + esc(tl(h.normal.toplam)) + " · <strong>" + esc(tl(h.tasarruf)) + "</strong> daha az (" + yuzde(h.indirimOrani) + ")";
    } else {
      $("ea-cevap-bas").textContent = "Uygunluk";
      $("o-toplam").textContent = d[0];
      $("o-toplam")._sayacKimlik = ($("o-toplam")._sayacKimlik || 0) + 1; $("o-toplam")._sayacGorunen = null;
      $("o-alt").textContent = r.not || "";
    }
    akisCiz(r);
    sinirCiz(r);

    $("o-kosullar").innerHTML = r.kosullar.map(function (k) {
      var isaret = k.durum === "tamam" ? "✓" : k.durum === "eksik" ? "✗" : "?";
      return '<li class="ea-k-' + k.durum + '"><span class="ea-isaret" aria-hidden="true">' + isaret + "</span><span><strong>" + esc(k.ad) +
        '</strong> <span class="ea-k-durum">' + (k.durum === "tamam" ? "sağlanıyor" : k.durum === "eksik" ? "sağlanmıyor" : "belirsiz") +
        "</span><br>" + esc(k.aciklama) + ' <span class="ea-dayanak">' + esc(k.dayanak) + "</span></span></li>";
    }).join("");

    var kal = [];
    function satir(dt, dd, sinif) { kal.push("<div" + (sinif ? ' class="' + sinif + '"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"); }
    if (h) {
      satir("Vergisiz fiyat (ÖTV matrahı)", tl(h.normal.matrah));
      satir("ÖTV satırı", esc(h.normal.satir) + " · %" + h.normal.oran);
      satir("İstisnanın kaldırdığı ÖTV", tl(h.tasarrufOtv));
      satir("ÖTV'nin KDV'si", tl(h.tasarrufKdv));
    }
    if (r.mtv) {
      satir("MTV, ilk yıl", r.mtv.muaf ? "muaf <span class=\"ea-kucuk\">(normal alıcı " + esc(tl(r.mtv.normalIlkYil)) + ")</span>" : tl(r.mtv.sizinIlkYil) +
        (r.mtv.sizinIlkYil < r.mtv.normalIlkYil ? ' <span class="ea-kucuk">(normal alıcı ' + esc(tl(r.mtv.normalIlkYil)) + ")</span>" : ""));
      satir("MTV, ilk beş yıl", r.mtv.muaf ? tl(0) + ' <span class="ea-kucuk">(' + esc(tl(r.mtv.normalBesYil)) + " muafiyet)</span>" : tl(r.mtv.sizinBesYil));
    }
    if (r.durum !== "uygun-degil") {
      satir("Beş yıl dolmadan satışta alıcının ödeyeceği ÖTV", h ? "≈ " + tl(r.takvim.erkenSatisOtv) : "ilk alıştaki matrahın ÖTV'si");
      satir("Satış serbest", esc(tarih(r.takvim.serbestSatis)));
      satir("Yeni istisna en erken", esc(tarih(r.takvim.yeniIstisna)), "ea-ana");
    }
    $("o-kalemler").innerHTML = kal.join("");
  }

  /* Sınır çubuğu: vergiler dahil bedel, sınırın neresinde? */
  function sinirCiz(r) {
    var kutu = $("o-sinir"), h = r.hesap;
    if (!h || !r.yolBilgi || !r.yolBilgi.sinirli || !r.sinir) { kutu.innerHTML = ""; kutu.hidden = true; return; }
    kutu.hidden = false;
    var olcek = Math.max(r.sinir * 1.25, h.normal.toplam * 1.05);
    var x = Math.min(100, h.normal.toplam / olcek * 100), s = r.sinir / olcek * 100;
    var asti = h.normal.toplam > r.sinir;
    kutu.innerHTML = '<div class="ea-sinir-ust"><span>Vergiler dahil bedel</span><strong>' + esc(tl(h.normal.toplam)) + "</strong></div>" +
      '<div class="ea-sinir-cubuk" role="img" aria-label="Bedel ' + esc(tl(h.normal.toplam)) + ", sınır " + esc(tl(r.sinir)) + '">' +
      '<span class="ea-sinir-dolu' + (asti ? " ea-asti" : "") + '" style="width:' + x.toFixed(1) + '%"></span>' +
      '<span class="ea-sinir-cizgi" style="left:' + s.toFixed(1) + '%"></span></div>' +
      '<div class="ea-sinir-alt"><span>0</span><span style="left:' + s.toFixed(1) + '%">Sınır ' + esc(tl(r.sinir)) + "</span></div>" +
      '<p class="ea-sinir-not">' + (asti
        ? "Sınırı <strong>" + esc(tl(-h.sinirKalan)) + "</strong> aşıyor: istisna hiç uygulanmaz. Bu motor sınıfında sınırın altında kalan en pahalı aracın vergisiz fiyatı " + esc(tl(h.sinirdakiMatrah)) + "."
        : "Sınıra <strong>" + esc(tl(h.sinirKalan)) + "</strong> var. Bu motor sınıfında sınırın altında kalabilecek en yüksek vergisiz fiyat " + esc(tl(h.sinirdakiMatrah)) + ".") + "</p>";
  }

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  var genislik = 0;
  window.addEventListener("resize", function () {
    var w = $("o-akis").clientWidth;
    if (Math.abs(w - genislik) > 24) { genislik = w; clearTimeout(zaman); zaman = setTimeout(hesapla, 150); }
  });
  /* Makale grafikleri: açılışta görünmeyenler ekrana girince bir kez çizilir.
     Görünür olanlar ve "hareketi azalt" son karede başlar. */
  var azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!azalt && typeof IntersectionObserver === "function") {
    var gozcu = new IntersectionObserver(function (gs) {
      gs.forEach(function (g) { if (g.isIntersecting) { g.target.classList.remove("ea-bekle"); gozcu.unobserve(g.target); } });
    }, { threshold: 0.35 });
    document.querySelectorAll(".ea-sekil").forEach(function (f) {
      if (f.getBoundingClientRect().top > window.innerHeight) { f.classList.add("ea-bekle"); gozcu.observe(f); }
    });
  }
  $("e-tarih").value = bugunISO();
  alanlar();
  hesapla();
})();
