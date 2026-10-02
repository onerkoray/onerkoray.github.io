/* Emekli Çalışan Maaş Hesaplama — arayüz katmanı.
   Hesap YAPMAZ: SGDP ve SGK oranları, tavan ve istisna ../bordro/parametreler.js
   içinde, hesap ../bordro/motor.js'tedir (secenekler.sgdp). Bu dosya formu
   okur, motoru iki kez çağırır (emekli ve emekli olmayan) ve yan yana çizer. */
(function () {
  "use strict";
  var B = window.Bordro;
  if (!B) return;

  function $(id) { return document.getElementById(id); }
  var form = $("ec-form"), cikti = $("ec-sonuc"), mesaj = $("ec-mesaj");
  if (!form || !cikti) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(n) { return nf.format(Math.round(n * 100) / 100) + " TL"; }
  function oran(o) { return "%" + String(Math.round(o * 10000) / 100).replace(".", ","); }
  function farkTl(n) { return (n >= 0 ? "+" : "−") + tl(Math.abs(n)); }

  /* Türkçe sayı girişi: "45.000" binlik, "45000,50" ondalık. */
  function sayi(id) {
    var ham = String($(id).value || "").trim().replace(/\s/g, "");
    if (ham === "") return null;
    if (ham.indexOf(",") >= 0) ham = ham.replace(/\./g, "").replace(",", ".");
    else {
      var p = ham.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) ham = p.join("");
    }
    var v = parseFloat(ham);
    return isFinite(v) ? v : NaN;
  }

  function aktifYil() {
    var y = new Date().getFullYear();
    return B.parametreler[y] ? y : B.sonYil();
  }

  /* Brüt asgari ücretin altına inilemez: netten bulunan brüt o ayın asgari
     ücretinden düşükse asgari ücrete çekilir. */
  function brutler(mod, tutar, yil, secenek) {
    var P = B.parametre(yil), liste, kirpildi = false;
    if (mod === "net") liste = B.nettenBruteYil(tutar, yil, secenek);
    else { liste = []; for (var i = 0; i < 12; i++) liste.push(tutar); }
    liste = liste.map(function (b, i) {
      var alt = B.donem(P, i + 1).asgariBrut;
      if (b < alt - 0.005) { kirpildi = true; return alt; }
      return b;
    });
    return { liste: liste, kirpildi: kirpildi };
  }

  function serit(ogeler) {
    return '<dl class="ec-olcu">' + ogeler.map(function (o) {
      return "<div><dt>" + o[0] + "</dt><dd>" + o[1] + "</dd></div>";
    }).join("") + "</dl>";
  }

  function etiketle(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll("table.ec-tablo"), function (t) {
      var bas = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (c, i) { if (c.tagName === "TD" && bas[i]) c.setAttribute("data-etiket", bas[i]); });
      });
    });
  }

  function calistir() {
    cikti.innerHTML = "";
    var tutar = sayi("ec-tutar"), mod = $("ec-mod").value, tesvik = $("ec-tesvik").value;
    if (tutar === null) { mesaj.textContent = "Tutarı girin; hesap otomatik çalışır."; return; }
    if (!(tutar > 0)) { mesaj.textContent = "Tutar sıfırdan büyük bir sayı olmalı."; return; }

    var yil = aktifYil(), P = B.parametre(yil), o = B.oranlarAy(P, 1);
    var sNormal = tesvik ? { tesvik: tesvik } : {};
    var bE = brutler(mod, tutar, yil, { sgdp: true }), bN = brutler(mod, tutar, yil, sNormal);
    var e = B.hesaplaYil(bE.liste, yil, { sgdp: true }), n = B.hesaplaYil(bN.liste, yil, sNormal);
    var e1 = e.aylar[0], n1 = n.aylar[0];
    var maliyetFarki = e.toplam.isverenMaliyeti - n.toplam.isverenMaliyeti;

    var h = [];
    if (mod === "brut") {
      h.push('<div class="ec-manset"><p>Emekli çalışanın ocak neti: <strong>' + tl(e1.net) + "</strong></p>" +
        "<p>Aynı brütle emekli olmayan çalışan " + tl(n1.net) + " alır; emekli ayda " + tl(e1.net - n1.net) +
        ", yılda " + tl(e.toplam.net - n.toplam.net) + " fazla eline geçirir. İşverene yıllık maliyet ise emeklide " +
        tl(Math.abs(maliyetFarki)) + (maliyetFarki >= 0 ? " daha yüksek." : " daha düşük.") + "</p></div>");
    } else {
      h.push('<div class="ec-manset"><p>Ayda ' + tl(tutar) + " net için işverene yıllık maliyet: <strong>" + tl(e.toplam.isverenMaliyeti) + "</strong></p>" +
        "<p>Emekli olmayan çalışana aynı neti vermek " + tl(n.toplam.isverenMaliyeti) + " tutar; emekli " +
        tl(Math.abs(maliyetFarki)) + (maliyetFarki <= 0 ? " daha ucuz." : " daha pahalı.") +
        " Ocak brütü emeklide " + tl(e1.brut) + ", emekli olmayanda " + tl(n1.brut) + ".</p></div>");
    }

    h.push(serit([
      ["Yıllık net, emekli", tl(e.toplam.net)],
      ["Yıllık net farkı", farkTl(e.toplam.net - n.toplam.net)],
      ["Yıllık maliyet, emekli", tl(e.toplam.isverenMaliyeti)],
      ["Yıllık maliyet farkı", farkTl(maliyetFarki)]
    ]));

    var isvE = e1.primEsas > 0 ? e1.isverenSgk / e1.primEsas : 0;
    var isvN = n1.primEsas > 0 ? n1.isverenSgk / n1.primEsas : 0;
    function satir(ad, a, b, isaret) {
      return '<tr><th scope="row">' + ad + '</th><td class="sayi">' + (isaret || "") + tl(a) +
        '</td><td class="sayi">' + (isaret || "") + tl(b) + "</td></tr>";
    }
    h.push('<div class="table-scroll"><table class="data-table ec-tablo"><caption>Ocak ayı bordrosu, ' + yil + "</caption>" +
      '<thead><tr><th scope="col">Kalem</th><th scope="col" class="sayi">Emekli (SGDP)</th><th scope="col" class="sayi">Emekli olmayan</th></tr></thead><tbody>' +
      satir("Brüt ücret", e1.brut, n1.brut) +
      '<tr><th scope="row">Prim kesintisi</th><td class="sayi">− ' + tl(e1.sgk) + " (" + oran(o.sgdpIsci) + ')</td><td class="sayi">− ' +
        tl(n1.sgk + n1.issizlik) + " (" + oran(o.sgkIsci + o.issizlikIsci) + ")</td></tr>" +
      satir("Gelir vergisi", e1.gelirVergisi, n1.gelirVergisi, "− ") +
      satir("Damga vergisi", e1.damga, n1.damga, "− ") +
      '<tr class="ec-vurgu"><th scope="row">Net ücret</th><td class="sayi">' + tl(e1.net) + '</td><td class="sayi">' + tl(n1.net) + "</td></tr>" +
      '<tr><th scope="row">İşveren primi</th><td class="sayi">+ ' + tl(e1.isverenSgk) + " (" + oran(isvE) + ')</td><td class="sayi">+ ' +
        tl(n1.isverenSgk + n1.isverenIssizlik) + " (" + oran(isvN + o.issizlikIsveren) + ")</td></tr>" +
      '<tr class="ec-vurgu"><th scope="row">İşverene maliyet</th><td class="sayi">' + tl(e1.isverenMaliyeti) + '</td><td class="sayi">' + tl(n1.isverenMaliyeti) + "</td></tr>" +
      "</tbody></table></div>");

    var aylar = e.aylar.map(function (a, i) {
      var b = n.aylar[i];
      return '<tr><th scope="row">' + a.ayAdi + '</th><td class="sayi">' + tl(a.brut) + '</td><td class="sayi">' + tl(a.net) +
        '</td><td class="sayi">' + tl(b.net) + '</td><td class="sayi">' + tl(a.isverenMaliyeti) + '</td><td class="sayi">' + tl(b.isverenMaliyeti) + "</td></tr>";
    }).join("");
    h.push('<div class="table-scroll"><table class="data-table ec-tablo"><caption>Ay ay: vergi dilimi ilerledikçe net değişir</caption>' +
      '<thead><tr><th scope="col">Ay</th><th scope="col" class="sayi">Brüt, emekli</th><th scope="col" class="sayi">Net, emekli</th>' +
      '<th scope="col" class="sayi">Net, emekli olmayan</th><th scope="col" class="sayi">Maliyet, emekli</th><th scope="col" class="sayi">Maliyet, emekli olmayan</th></tr></thead><tbody>' +
      aylar + "</tbody></table></div>");

    cikti.innerHTML = h.join("");
    etiketle(cikti);
    var not = [yil + " parametreleriyle hesaplandı."];
    if (bE.kirpildi || bN.kirpildi) not.push("Bu net bazı aylarda asgari ücretin altında bir brüte denk geliyor; brüt asgari ücrete çekildi ve net o aylarda girdiğinizden yüksek çıktı.");
    if (e1.primEsas < e1.brut - 0.5) not.push("Brüt prime esas kazanç tavanını aşıyor; primler tavandan hesaplandı.");
    not.push("Karşılaştırılan çalışanda prim indirimi: " + (tesvik ? oran(B.tesvikOrani(o, sNormal)).replace("%", "") + " puan." : "yok."));
    mesaj.textContent = not.join(" ");
  }

  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (ev) { ev.preventDefault(); calistir(); });

  var yr = $("year");
  if (yr) yr.textContent = new Date().getFullYear();
  calistir();
})();
