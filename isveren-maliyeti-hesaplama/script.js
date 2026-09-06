/* İşveren Maliyeti — arayüz katmanı.
   SGK ve işsizlik oranları, prime esas kazanç tavanı, 5 puanlık indirim ve
   damga vergisi ../bordro/parametreler.js içindedir; bu dosya yalnızca formu
   okur ve motorun döndürdüğünü çizer. Parametre kopyası burada tutulmaz. */
(function () {
  "use strict";
  var B = window.Bordro;
  if (!B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function yuzde(o) { return nf2.format(Math.round(o * 10000) / 100); }

  /* Türkçe sayı girişi: "45.000" binlik, "45000,50" ondalık. */
  function num(id) {
    var e = el(id);
    if (!e) return NaN;
    var ham = String(e.value).trim().replace(/\s/g, "");
    if (ham === "") return NaN;
    if (ham.indexOf(",") >= 0) {
      ham = ham.replace(/\./g, "").replace(",", ".");
    } else {
      var p = ham.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) ham = p.join("");
    }
    return parseFloat(ham);
  }

  function sumCard(label, value, note) {
    return '<div class="sum-card"><span class="sum-label">' + label +
      '</span><strong class="sum-value">' + value +
      '</strong><span class="sum-note">' + note + "</span></div>";
  }

  function aktifYil() {
    var y = new Date().getFullYear();
    return B.parametreler[y] ? y : B.sonYil();
  }

  function recalc() {
    var results = el("results");
    var msg = el("msg");
    var tutar = num("in-tutar");
    var mod = el("in-mod").value;              // "brut" | "net"
    var tesvik = el("in-tesvik").checked;

    if (isNaN(tutar) || tutar <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }

    var yil = aktifYil();
    var P = B.parametre(yil);
    var o = P.oranlar;
    var secenek = { tesvik5Puan: tesvik };

    /* Net modda ocak ayının netini hedefleyen brüt bulunur. Neti sabit tutmak
       için brüt yıl içinde yükseldiğinden yıllık maliyet ay ay hesaplanır. */
    var brutler;
    if (mod === "net") {
      brutler = B.nettenBruteYil(tutar, yil, secenek);
    } else {
      brutler = [];
      for (var j = 0; j < 12; j++) brutler.push(tutar);
    }

    var y = B.hesaplaYil(brutler, yil, secenek);
    var ocak = y.aylar[0];
    var yillik = y.toplam;

    if (!ocak.net || ocak.net <= 0) {
      results.innerHTML = "";
      msg.textContent = "Bu tutarla anlamlı bir bordro çıkmıyor. Lütfen kontrol edin.";
      msg.hidden = false; return;
    }
    msg.hidden = true;

    var birNet = yillik.isverenMaliyeti / yillik.net;
    var tavanda = ocak.primEsas < ocak.brut - 0.5;
    var netDegisken = Math.abs(y.aylar[11].isverenMaliyeti - ocak.isverenMaliyeti) > 1;

    var cards =
      sumCard("Aylık toplam maliyet", fmt(ocak.isverenMaliyeti) + " TL",
        netDegisken ? "Ocak ayı · yıl içinde değişiyor" : "Her ay aynı") +
      sumCard("Yıllık toplam maliyet", fmt(yillik.isverenMaliyeti) + " TL", "12 ay") +
      sumCard("Çalışanın eline geçen", fmt(ocak.net) + " TL",
        mod === "net" ? "Anlaşılan net" : "Ocak ayı neti") +
      sumCard("1 TL net için maliyet", fmt(birNet) + " TL",
        "Yıllık maliyet ÷ yıllık net");

    var isvSgkOran = ocak.primEsas > 0 ? ocak.isverenSgk / ocak.primEsas : 0;

    var rows =
      "<tr><th>Brüt ücret</th><td>" + fmt(ocak.brut) + " TL</td></tr>" +
      "<tr><th>Prime esas kazanç</th><td>" + fmt(ocak.primEsas) + " TL" +
        (tavanda ? " <em>(SGK tavanı)</em>" : "") + "</td></tr>" +
      "<tr><th>İşveren SGK payı (%" + yuzde(isvSgkOran) + ")</th><td>+ " + fmt(ocak.isverenSgk) + " TL</td></tr>" +
      "<tr><th>İşveren işsizlik payı (%" + yuzde(o.issizlikIsveren) + ")</th><td>+ " + fmt(ocak.isverenIssizlik) + " TL</td></tr>" +
      '<tr class="net-up"><th><strong>İşverene toplam maliyet</strong></th><td><strong>' +
        fmt(ocak.isverenMaliyeti) + " TL</strong></td></tr>" +
      "<tr><th>Çalışan SGK payı (%" + yuzde(o.sgkIsci) + ")</th><td>− " + fmt(ocak.sgk) + " TL</td></tr>" +
      "<tr><th>Çalışan işsizlik payı (%" + yuzde(o.issizlikIsci) + ")</th><td>− " + fmt(ocak.issizlik) + " TL</td></tr>" +
      "<tr><th>Gelir vergisi (istisna sonrası)</th><td>− " + fmt(ocak.gelirVergisi) + " TL</td></tr>" +
      "<tr><th>Damga vergisi</th><td>− " + fmt(ocak.damga) + " TL</td></tr>" +
      "<tr><th><strong>Çalışanın eline geçen</strong></th><td><strong>" + fmt(ocak.net) + " TL</strong></td></tr>";

    var ayTablosu = "";
    if (netDegisken) {
      var satir = y.aylar.map(function (a) {
        return "<tr><th>" + a.ayAdi + "</th><td>" + fmt(a.brut) + " TL</td><td>" +
          fmt(a.isverenMaliyeti) + " TL</td><td>" + fmt(a.net) + " TL</td></tr>";
      }).join("");
      ayTablosu =
        '<div class="table-scroll"><table class="payroll aylik">' +
        "<caption>Net anlaşmada ay ay maliyet — neti sabit tutmak için brüt yükselir</caption>" +
        "<thead><tr><th>Ay</th><th>Brüt</th><th>İşveren maliyeti</th><th>Net</th></tr></thead>" +
        "<tbody>" + satir + "</tbody></table></div>";
    }

    var notlar =
      '<p class="muted-note table-note">' +
      (tesvik
        ? "5 puanlık indirim uygulandı: SGK işveren payı " + yuzde(isvSgkOran) +
          "'e düştü. İndirim 5510 sayılı Kanun m.81/ı kapsamındadır ve prim borcu bulunmaması, bildirgelerin süresinde verilmesi gibi şartlara bağlıdır."
        : "Teşviksiz hesap. Şartları sağlayan işverenler 5 puanlık indirimden yararlanabilir — yukarıdaki kutucuğu işaretleyerek farkı görebilirsiniz.") +
      "</p>" +
      (tavanda
        ? '<p class="muted-note table-note">Brüt ücret prime esas kazanç tavanını aştığı için primler tavan üzerinden hesaplandı; tavanın üstündeki kısım prime tabi değildir.</p>'
        : "") +
      '<p class="muted-note table-note">' + yil + " yılı parametreleriyle hesaplandı. " +
      "Kıdem, ihbar ve yıllık izin karşılıkları ile işveren tarafındaki diğer yükler bu tutara dahil değildir.</p>" +
      '<p class="muted-note table-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a>. ' +
      'Çalışanın 12 aylık net dökümü için <a href="../maas-hesaplama/">Brüt Net Maaş Hesaplama</a>, ' +
      'çıkışta doğan yükler için <a href="../isten-ayrilma-hesaplama/">İşten Ayrılma Paketi</a> aracını kullanın.</p>';

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<div class="table-scroll"><table class="payroll detail">' +
      '<caption class="visually-hidden">İşveren maliyeti dökümü</caption><tbody>' +
      rows + "</tbody></table></div>" + ayTablosu + notlar;
  }

  ["in-tutar", "in-mod", "in-tesvik"].forEach(function (id) {
    var e = el(id);
    if (e) { e.addEventListener("input", recalc); e.addEventListener("change", recalc); }
  });

  var yr = el("year");
  if (yr) yr.textContent = new Date().getFullYear();

  recalc();
})();
