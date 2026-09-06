/* Fazla Mesai Ücreti — arayüz katmanı.
   Saat böleni (225), zam katsayıları ve yıllık 270 saat sınırı
   ../bordro/parametreler.js içindedir; bu dosya formu okur ve motorun
   döndürdüğünü çizer. Parametre kopyası burada tutulmaz.

   Aracın farkı: rakipler brüt tutarda durur. Fazla mesai o ayın brütüne
   eklendiği için vergisi kümülatif matrahtan hesaplanır; net katkı yıl
   ilerledikçe düşer. Burada net katkı, mesaili ve mesaisiz 12 aylık bordro
   FARKI olarak hesaplanıyor — yaklaşık bir oranla değil. */
(function () {
  "use strict";
  var B = window.Bordro;
  if (!B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }

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

  /* Mesai brütü seçilen aya eklenir; net katkı iki bordronun farkıdır. */
  function netKatki(brut, mesaiBrut, ayIndex, yil) {
    var dizi = [], i;
    for (i = 0; i < 12; i++) dizi.push(brut);
    var yalin = B.hesaplaYil(dizi, yil);
    dizi[ayIndex] = brut + mesaiBrut;
    var mesaili = B.hesaplaYil(dizi, yil);
    return {
      oncesi: yalin.aylar[ayIndex].net,
      sonrasi: mesaili.aylar[ayIndex].net,
      katki: mesaili.aylar[ayIndex].net - yalin.aylar[ayIndex].net
    };
  }

  function recalc() {
    var results = el("results");
    var msg = el("msg");

    var brut = num("in-brut");
    var s50 = num("in-s50"); if (isNaN(s50)) s50 = 0;
    var s25 = num("in-s25"); if (isNaN(s25)) s25 = 0;
    var ayIndex = parseInt(el("in-ay").value, 10) || 0;

    if (isNaN(brut) || brut <= 0) { results.innerHTML = ""; msg.hidden = true; return; }
    if (s50 < 0 || s25 < 0) { results.innerHTML = ""; msg.hidden = true; return; }
    if (s50 + s25 === 0) {
      results.innerHTML = "";
      msg.textContent = "Fazla çalışma saati girin.";
      msg.hidden = false; return;
    }
    msg.hidden = true;

    var yil = aktifYil();
    var P = B.parametre(yil);
    var F = P.fazlaMesai;

    var saatlik = brut / F.aylikSaat;
    var brut50 = saatlik * F.fazlaCalismaKat * s50;
    var brut25 = saatlik * F.fazlaSureliKat * s25;
    var mesaiBrut = brut50 + brut25;

    var r = netKatki(brut, mesaiBrut, ayIndex, yil);
    var oran = mesaiBrut > 0 ? r.katki / mesaiBrut : 0;
    var ayAdi = B.AY_ADLARI[ayIndex];

    var cards =
      sumCard("Fazla mesai brütü", fmt(mesaiBrut) + " TL",
        (s50 ? s50 + " saat %50" : "") + (s50 && s25 ? " + " : "") + (s25 ? s25 + " saat %25" : "")) +
      sumCard("Elinize geçen (net)", fmt(r.katki) + " TL", ayAdi + " ayı bordrosunda") +
      sumCard("Brütün ne kadarı", "%" + fmt(oran * 100), "Kalanı vergi ve prim") +
      sumCard("Saat ücreti", fmt(saatlik) + " TL", "Brüt ÷ " + F.aylikSaat);

    var kalemler = "";
    if (s50) {
      kalemler += "<tr><th>Fazla çalışma — " + s50 + " saat × %" +
        Math.round((F.fazlaCalismaKat - 1) * 100) + " zamlı</th><td>" + fmt(brut50) + " TL</td></tr>";
    }
    if (s25) {
      kalemler += "<tr><th>Fazla sürelerle çalışma — " + s25 + " saat × %" +
        Math.round((F.fazlaSureliKat - 1) * 100) + " zamlı</th><td>" + fmt(brut25) + " TL</td></tr>";
    }

    var rows =
      "<tr><th>Aylık brüt ücret</th><td>" + fmt(brut) + " TL</td></tr>" +
      "<tr><th>Saat ücreti (brüt ÷ " + F.aylikSaat + ")</th><td>" + fmt(saatlik) + " TL</td></tr>" +
      kalemler +
      '<tr class="net-up"><th><strong>Fazla mesai brütü</strong></th><td><strong>' +
        fmt(mesaiBrut) + " TL</strong></td></tr>" +
      "<tr><th>" + ayAdi + " neti — mesaisiz</th><td>" + fmt(r.oncesi) + " TL</td></tr>" +
      "<tr><th>" + ayAdi + " neti — mesaili</th><td>" + fmt(r.sonrasi) + " TL</td></tr>" +
      "<tr><th><strong>Net katkı</strong></th><td><strong>" + fmt(r.katki) + " TL</strong></td></tr>";

    /* Aynı mesainin 12 ayda ne bıraktığı — aracın asıl gösterdiği şey. */
    var enCok = 0, enAz = Infinity, satirlar = "";
    var aylik = [];
    for (var i = 0; i < 12; i++) {
      var k = netKatki(brut, mesaiBrut, i, yil).katki;
      aylik.push(k);
      if (k > enCok) enCok = k;
      if (k < enAz) enAz = k;
    }
    for (var j = 0; j < 12; j++) {
      var sinif = aylik[j] === enCok ? ' class="net-up"' : (aylik[j] === enAz ? ' class="bracket-jump"' : "");
      satirlar += "<tr" + sinif + "><th>" + B.AY_ADLARI[j] + "</th><td>" +
        fmt(aylik[j]) + " TL</td><td>%" + fmt((aylik[j] / mesaiBrut) * 100) + "</td></tr>";
    }
    var fark = enCok - enAz;

    var aySecimi =
      '<div class="table-scroll"><table class="payroll aylik">' +
      "<caption>Aynı fazla mesainin ay ay net karşılığı — brüt hep " + fmt(mesaiBrut) + " TL</caption>" +
      "<thead><tr><th>Ay</th><th>Net katkı</th><th>Brütün yüzdesi</th></tr></thead>" +
      "<tbody>" + satirlar + "</tbody></table></div>";

    var sinirNotu = "";
    if (s50 > F.yillikUstSinirSaat) {
      sinirNotu = '<p class="muted-note table-note"><strong>Dikkat:</strong> girilen fazla çalışma, ' +
        "yıllık üst sınır olan " + F.yillikUstSinirSaat + " saati tek başına aşıyor (4857 m.41).</p>";
    }

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<div class="table-scroll"><table class="payroll detail">' +
      '<caption class="visually-hidden">Fazla mesai dökümü</caption><tbody>' +
      rows + "</tbody></table></div>" +
      aySecimi + sinirNotu +
      '<p class="muted-note table-note"><strong>Aynı iş, farklı ay, farklı para:</strong> ' +
      "yukarıdaki mesai ocak ayında " + fmt(enCok) + " TL, aralık ayında " + fmt(enAz) +
      " TL net bırakıyor — aradaki " + fmt(fark) + " TL fark, gelir vergisinin " +
      '<a href="../makaleler/maasim-neden-dustu/">kümülatif matraha</a> uygulanmasından doğuyor. ' +
      "Zam oranı değişmiyor, verginiz değişiyor.</p>" +
      '<p class="muted-note table-note">' + yil + " yılı parametreleriyle hesaplandı. " +
      "Fazla çalışma yılda " + F.yillikUstSinirSaat + " saati aşamaz ve işçinin yazılı onayı gerekir. " +
      "İşçi dilerse ücret yerine her fazla saat için " + F.serbestZamanKat +
      " saat serbest zaman kullanabilir (4857 m.41).</p>" +
      '<p class="muted-note table-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a>. ' +
      'Aylık bordronuzun tamamı için <a href="../maas-hesaplama/">Brüt Net Maaş Hesaplama</a>, ' +
      'işveren tarafındaki karşılığı için <a href="../isveren-maliyeti-hesaplama/">İşveren Maliyeti</a> aracını kullanın.</p>';
  }

  ["in-brut", "in-s50", "in-s25", "in-ay"].forEach(function (id) {
    var e = el(id);
    if (e) { e.addEventListener("input", recalc); e.addEventListener("change", recalc); }
  });

  /* Ay seçeneklerini motordan doldur. */
  (function () {
    var sec = el("in-ay");
    if (!sec || sec.options.length) return;
    var simdi = new Date().getMonth();
    B.AY_ADLARI.forEach(function (ad, i) {
      var o = document.createElement("option");
      o.value = String(i); o.textContent = ad;
      if (i === simdi) o.selected = true;
      sec.appendChild(o);
    });
  })();

  var yr = el("year");
  if (yr) yr.textContent = new Date().getFullYear();

  recalc();
})();
