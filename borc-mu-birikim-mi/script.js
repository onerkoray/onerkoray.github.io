/* Borç mu, Birikim mi — arayüz katmanı.
   Stopaj kademeleri ../finans/kurallar.js, dağıtım mantığı
   ../finans/dagitim-motor.js içindedir. Bu dosya formu okur ve sonucu
   çizer; parametre veya kural kopyası tutmaz. */
(function () {
  "use strict";
  var D = window.DagitimMotor;
  if (!D) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function pct(n) { return nf.format(Math.round(n * 1000) / 10); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function say(v) {
    var h = String(v == null ? "" : v).trim().replace(/\s/g, "");
    if (h === "") return NaN;
    if (h.indexOf(",") >= 0) h = h.replace(/\./g, "").replace(",", ".");
    else { var p = h.split("."); if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) h = p.join(""); }
    var n = parseFloat(h); return isFinite(n) ? n : NaN;
  }
  function n0(id) { var v = say(el(id).value); return isFinite(v) ? v : 0; }

  /* ---------------------------------------------------------- satırlar */
  var VARSAYILAN = [
    { ad: "Kredi kartı", bakiye: "40000", faiz: "3,75" },
    { ad: "Taşıt kredisi", bakiye: "150000", faiz: "1,9" }
  ];
  function satirEkle(v) {
    v = v || { ad: "Yeni borç", bakiye: "", faiz: "" };
    var tr = document.createElement("tr");
    tr.className = "dm-satir";
    tr.innerHTML =
      '<td data-l="Borç adı"><input type="text" class="dm-ad" value="' + esc(v.ad) + '" aria-label="Borç adı"></td>' +
      '<td data-l="Bakiye"><input type="text" inputmode="decimal" class="dm-bakiye" value="' + esc(v.bakiye) + '" aria-label="Bakiye"></td>' +
      '<td data-l="Aylık faiz"><input type="text" inputmode="decimal" class="dm-faiz" value="' + esc(v.faiz) + '" aria-label="Aylık faiz yüzdesi"></td>' +
      '<td><button type="button" class="dm-sil" aria-label="Bu borcu sil">×</button></td>';
    el("borc-govde").appendChild(tr);
  }
  function borclariOku() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll(".dm-satir"), function (tr) {
      var bak = say(tr.querySelector(".dm-bakiye").value);
      var fz = say(tr.querySelector(".dm-faiz").value);
      if (!(bak > 0) || !isFinite(fz)) return;
      out.push({
        ad: (tr.querySelector(".dm-ad").value || "Borç").slice(0, 40),
        bakiye: bak, aylikFaiz: fz / 100
      });
    });
    return out;
  }

  /* ------------------------------------------------------------- grafik
     Getiri karşılaştırması: yatay çubuk (büyüklük karşılaştırma).
     Mevduat neti ve enflasyon REFERANS ÇİZGİSİ olarak konuyor — asıl
     mesaj "hangisi daha yüksek" değil, "hangisi eşiği geçiyor".
     Çubuk rengi tek serilik bir vurgu olduğu için marka rengi uygun;
     kategorik seri yok, dolayısıyla kategorik palet gerekmiyor. */
  function getiriGrafigi(r) {
    var kalemler = r.borclar.map(function (b) {
      return { ad: b.ad + " kapatmak", oran: b.yillikGetiri, reel: b.reelGetiri, tur: "borc" };
    });
    kalemler.push({ ad: "Mevduat (net)", oran: r.mevduat.net, reel: r.mevduat.reel, tur: "mevduat" });
    if (!kalemler.length) return "";

    var maxO = Math.max.apply(null, kalemler.map(function (k) { return k.oran; }).concat([r.enflasyon]));
    if (!(maxO > 0)) return "";
    var enfPay = (r.enflasyon / maxO) * 100;

    var satirlar = kalemler.map(function (k) {
      var w = Math.max(0, (k.oran / maxO) * 100);
      var negatif = k.reel < 0;
      return '<li class="dm-bar-satir">' +
        '<span class="dm-bar-ad">' + esc(k.ad) + "</span>" +
        '<span class="dm-bar-yol"><span class="dm-bar' +
        (k.tur === "mevduat" ? " dm-bar-mevduat" : "") + '" style="--w:' + w.toFixed(2) + '%"></span></span>' +
        '<span class="dm-bar-deger">%' + pct(k.oran) +
        '<small class="' + (negatif ? "dm-negatif" : "") + '">reel %' + pct(k.reel) + "</small></span></li>";
    }).join("");

    return '<figure class="dm-grafik">' +
      "<figcaption>Yıllık getiri karşılaştırması — enflasyon çizgisinin solu reel kayıp</figcaption>" +
      /* --enf BIRIMSIZ veriliyor: CSS onu bir uzunlukla carpiyor ve
         yuzde birimi verilirse calc gecersiz olup kural tamamen dusuyor —
         ilk render'da cizgi en sola yapismisti. */
      '<div class="dm-bar-alan" style="--enf:' + enfPay.toFixed(2) + '">' +
      '<ul class="dm-barlar">' + satirlar + "</ul>" +
      '<span class="dm-enf-cizgi" aria-hidden="true"></span>' +
      "</div>" +
      '<p class="dm-enf-not">Kesikli çizgi: beklenen enflasyon %' + pct(r.enflasyon) +
      ". Soluna düşen her kalem satın alma gücü kaybettirir.</p></figure>";
  }

  /* ------------------------------------------------------------ sonuçlar */
  function recalc() {
    var results = el("results"), msg = el("msg");
    if (!results) return;
    var r = D.dagit({
      aylikFazla: n0("in-fazla"),
      acilFonMevcut: n0("in-fon"),
      aylikZorunluGider: n0("in-gider"),
      acilFonAy: Number(el("in-ay").value),
      borclar: borclariOku(),
      mevduatYillikBrut: n0("in-mevduat") / 100,
      vadeGun: Number(el("in-vade").value),
      enflasyon: n0("in-enf") / 100
    });
    if (r.hata) { results.innerHTML = ""; msg.hidden = false; msg.textContent = r.hata; return; }
    msg.hidden = true;

    /* Manşet: en yüksek getirili hedefi yeniden çerçeveleyerek göster.
       Aracın asıl payload'ı bu cümle. */
    var enIyi = r.borclar.length ? r.borclar[0] : null;
    var hero = enIyi && enIyi.yillikGetiri > r.mevduat.net
      ? '<div class="dm-hero"><p class="dm-hero-etiket">En yüksek getirili hamle</p>' +
        '<p class="dm-hero-deger">%' + pct(enIyi.yillikGetiri) + "</p>" +
        '<p class="dm-hero-not"><strong>' + esc(enIyi.ad) + "</strong> borcunu kapatmak, " +
        "yıllık bileşikte bu kadar getiri demek — risksiz, vergisiz ve anında. " +
        "Mevduatın net getirisi %" + pct(r.mevduat.net) + ".</p></div>"
      : '<div class="dm-hero"><p class="dm-hero-etiket">Mevduat net getirisi</p>' +
        '<p class="dm-hero-deger">%' + pct(r.mevduat.net) + "</p>" +
        '<p class="dm-hero-not">Brüt %' + pct(r.mevduat.brut) + " üzerinden %" +
        nf.format(r.mevduat.stopaj * 100) + " stopaj sonrası. Enflasyon sonrası reel: %" +
        pct(r.mevduat.reel) + ".</p></div>";

    var fon = r.acilFon;
    var fonKart = '<div class="dm-fon">' +
      '<p class="dm-fon-bas">Acil durum fonu</p>' +
      '<p class="dm-fon-durum">' + fmt(fon.mevcut) + " / " + fmt(fon.hedef) + " TL" +
      (fon.tamamMi ? ' <span class="dm-tamam">hedefe ulaşıldı</span>'
                   : ' <span class="dm-acik">' + fmt(fon.acik) + " TL açık</span>") + "</p>" +
      (fon.tamamMi ? "" : '<p class="dm-fon-not">Bu tempoyla yaklaşık <strong>' +
        fon.kacAyda + " ay</strong> içinde tamamlanır.</p>") + "</div>";

    var dagitim = '<div class="dm-dagitim"><p class="dm-dagitim-bas">Aylık ' +
      fmt(r.aylikFazla) + " TL nereye gitmeli?</p><ol>" +
      r.dagitim.map(function (d) {
        return '<li class="dm-kalem dm-tur-' + d.tur + '">' +
          '<span class="dm-kalem-ust"><span class="dm-kalem-ad">' + esc(d.hedef) + "</span>" +
          '<span class="dm-kalem-tutar">' + fmt(d.tutar) + " TL</span></span>" +
          '<span class="dm-kalem-gerekce">' + esc(d.gerekce) + "</span></li>";
      }).join("") + "</ol></div>";

    var kuyruk = r.kuyruk.length
      ? '<p class="dm-kuyruk"><strong>Sırada bekleyen:</strong> ' +
        r.kuyruk.map(function (k) {
          return esc(k.ad) + " (%" + pct(k.yillikGetiri) + ")";
        }).join(", ") + ". Bu ay bütçe yetişmedi; öndeki kalem bitince sıra bunlara gelir.</p>"
      : "";

    var ucuz = r.ucuzBorclar.length
      ? '<p class="dm-ucuz"><strong>Tercihe bırakılan:</strong> ' +
        r.ucuzBorclar.map(function (u) {
          return esc(u.ad) + " (yıllık %" + pct(u.yillikGetiri) + ")";
        }).join(", ") + " — getirisi mevduat netinin altında. Erken kapatmak matematiksel " +
        "olarak <strong>" + nf.format(r.ucuzBorclar[0].fark) + " puan</strong> pahalıya geliyor. " +
        "Borçsuz olmayı tercih etmek sizin kararınız; araç yalnızca bedelini söylüyor.</p>"
      : "";

    var kiyas = r.kiyas.fark > 0.5
      ? '<div class="dm-kiyas"><p class="dm-kiyas-bas">Bu dağılım vs hepsini mevduata koymak</p>' +
        '<p class="dm-kiyas-deger">+' + fmt(r.kiyas.fark) + " TL</p>" +
        '<p class="dm-kiyas-not">İlk 12 ayda yaklaşık fark. Aylık katkının yıl boyunca ' +
        "eşit dağıldığı varsayımıyla hesaplanan kaba bir karşılaştırmadır.</p></div>"
      : "";

    results.innerHTML = hero + getiriGrafigi(r) + dagitim + kuyruk + ucuz + fonKart + kiyas;
  }

  /* --------------------------------------------------------------- bağla */
  VARSAYILAN.forEach(satirEkle);
  el("ekle").addEventListener("click", function () {
    if (document.querySelectorAll(".dm-satir").length >= 6) return;
    satirEkle(); recalc();
  });
  el("borc-govde").addEventListener("click", function (e) {
    if (!e.target.classList.contains("dm-sil")) return;
    e.target.closest("tr").remove(); recalc();
  });
  el("borc-govde").addEventListener("input", recalc);
  el("dagitim-form").addEventListener("input", recalc);
  el("dagitim-form").addEventListener("change", recalc);
  el("dagitim-form").addEventListener("submit", function (e) { e.preventDefault(); });
  recalc();
})();
