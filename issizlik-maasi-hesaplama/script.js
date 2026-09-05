/* İşsizlik Maaşı — arayüz katmanı.
   Ödenek oranı, tavanı, süre kademeleri, SGK tavanı ve damga vergisi
   ../bordro/parametreler.js içindedir; bu dosya formu okur ve sonucu çizer.
   Parametrelerin kopyası burada tutulmaz. */
(function () {
  "use strict";
  var B = window.Bordro;
  var C = window.BordroCikis;
  if (!B || !C) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }

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

  /* Hesap, içinde bulunulan bordro yılının parametreleriyle yapılır. */
  function aktifYil() {
    var y = new Date().getFullYear();
    return B.parametreler[y] ? y : B.sonYil();
  }

  function recalc() {
    var results = el("results");
    var msg = el("msg");

    var avg = num("in-avg");
    var primGunu = parseInt(el("in-days").value, 10);

    if (isNaN(avg) || avg <= 0) {
      results.innerHTML = ""; msg.hidden = true; return;
    }
    msg.hidden = true;

    var yil = aktifYil();
    var P = B.parametre(yil);
    var issizlik = P.issizlik;
    var donem = B.donem(P, new Date().getMonth() + 1);
    var damgaOrani = P.oranlar.damga;

    var gun = C.odenekGunu(primGunu, issizlik);
    if (gun === 0) {
      results.innerHTML = "";
      msg.textContent = "Son 3 yılda en az 600 gün prim ödenmemişse işsizlik ödeneğine hak kazanılmaz.";
      msg.hidden = false;
      return;
    }
    var ay = gun / 30;

    // Prime esas kazanç SGK tavanıyla sınırlıdır.
    var pek = Math.min(avg, donem.sgkTavan);
    var ham = pek * issizlik.oran;
    var tavan = donem.asgariBrut * issizlik.tavanOrani;
    var brut = Math.min(ham, tavan);
    var tavanUygulandi = ham > tavan;
    var damga = brut * damgaOrani;
    var net = brut - damga;
    var toplam = net * ay;

    var oranYuzde = Math.round(issizlik.oran * 100);
    var tavanYuzde = Math.round(issizlik.tavanOrani * 100);

    var cards =
      sumCard("Net aylık ödenek", fmt(net) + " TL", "Damga vergisi düşülmüş") +
      sumCard("Ödeme süresi", ay + " ay", gun + " gün ödenek · " + primGunu + " gün prim") +
      sumCard("Toplam net ödeme", fmt(toplam) + " TL", ay + " ay boyunca") +
      sumCard("Brüt aylık ödenek", fmt(brut) + " TL",
        tavanUygulandi ? "Tavan uygulandı (asgari × %" + tavanYuzde + ")" : "Kazancın %" + oranYuzde + "'ı");

    var rows =
      "<tr><th>Hesaba esas kazanç (%" + oranYuzde + " öncesi)</th><td>" + fmt(pek) + " TL" +
        (avg > donem.sgkTavan ? " (SGK tavanı uygulandı)" : "") + "</td></tr>" +
      "<tr><th>Kazancın %" + oranYuzde + "'ı</th><td>" + fmt(ham) + " TL</td></tr>" +
      "<tr><th>Ödenek tavanı (asgari brüt × %" + tavanYuzde + ")</th><td>" + fmt(tavan) + " TL</td></tr>" +
      "<tr><th>Brüt aylık ödenek</th><td>" + fmt(brut) + " TL</td></tr>" +
      "<tr><th>Damga vergisi (binde 7,59)</th><td>− " + fmt(damga) + " TL</td></tr>" +
      "<tr><th><strong>Net aylık ödenek</strong></th><td><strong>" + fmt(net) + " TL</strong></td></tr>";

    results.innerHTML = '<div class="sum-grid">' + cards + "</div>" +
      '<div class="table-scroll"><table class="payroll detail">' +
      '<caption class="visually-hidden">İşsizlik ödeneği dökümü</caption><tbody>' +
      rows + "</tbody></table></div>" +
      '<p class="muted-note table-note">Ödenekten gelir vergisi ve SGK primi kesilmez. ' +
      yil + " yılı parametreleriyle hesaplandı; kesin tutar İŞKUR tarafından belirlenir.</p>" +
      '<p class="muted-note table-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a>. ' +
      'Ödeneğin ne zaman yatacağını ve çıkışta doğan diğer alacakları birlikte görmek için ' +
      '<a href="../isten-ayrilma-hesaplama/">İşten Ayrılma Paketi</a> aracını kullanın.</p>';
  }

  ["in-avg", "in-days"].forEach(function (id) {
    var e = el(id);
    if (e) { e.addEventListener("input", recalc); e.addEventListener("change", recalc); }
  });

  var y = el("year");
  if (y) y.textContent = new Date().getFullYear();

  recalc();
})();
