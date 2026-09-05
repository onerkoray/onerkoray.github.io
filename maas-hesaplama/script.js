/* Maaş Hesaplama — arayüz katmanı.
   Tüm bordro matematiği ../bordro/motor.js içindedir; bu dosya yalnızca
   formu okur, motoru çağırır ve sonucu çizer. */
(function () {
  "use strict";
  var B = window.Bordro;
  if (!B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function yuzde(o) { return "%" + String(Math.round(o * 100)); }
  function el(id) { return document.getElementById(id); }
  function num(id) {
    var e = el(id);
    return e ? parseFloat(String(e.value).replace(/\./g, "").replace(",", ".")) : NaN;
  }

  /* ---------- yıl ve seçenekler ---------- */

  var elYear = el("in-year");
  var elAgi = el("in-agi");
  var agiSarma = el("agi-row");

  function seciliYil() {
    var y = elYear ? parseInt(elYear.value, 10) : B.sonYil();
    return isNaN(y) ? B.sonYil() : y;
  }
  function secenekler() {
    var o = {};
    if (elAgi && elAgi.value) o.agiOrani = parseFloat(elAgi.value);
    return o;
  }

  function yilSecimiKur() {
    if (!elYear) return;
    elYear.innerHTML = B.yillar().map(function (y) {
      return '<option value="' + y + '">' + y + " bordro yılı</option>";
    }).join("");
    elYear.value = String(B.sonYil());
  }

  /* AGİ seçimi yalnızca AGİ rejiminin geçerli olduğu yıllarda anlamlıdır. */
  function agiGorunurlugu() {
    if (!agiSarma) return;
    agiSarma.hidden = B.parametre(seciliYil()).istisnaRejimi !== "agi";
  }

  /* ---------- çizim ---------- */

  function ozetKart(etiket, deger, not) {
    return '<div class="sum-card"><span class="sum-label">' + etiket +
      '</span><strong class="sum-value">' + deger +
      '</strong><span class="sum-note">' + not + "</span></div>";
  }

  function ozetCiz(hedef, sonuc) {
    var t = sonuc.toplam, P = sonuc.parametre;
    var d = P.donemler[P.donemler.length - 1];
    hedef.innerHTML = '<div class="sum-grid">' +
      ozetKart("Ocak net maaş", fmt(t.ilkAyNet) + " TL", "Yılın ilk ayı") +
      ozetKart("Aralık net maaş", fmt(t.sonAyNet) + " TL", "Kümülatif vergi ilerledikten sonra") +
      ozetKart("Aylık ortalama net", fmt(t.ortalamaNet) + " TL", "12 aylık ortalama") +
      ozetKart("Yıllık toplam net", fmt(t.net) + " TL", "12 ay toplamı") +
      ozetKart("Yıllık vergi + damga", fmt(t.gelirVergisi + t.damga) + " TL", "İstisna sonrası ödenen") +
      ozetKart("Yıllık istisna kazancı", fmt(t.istisna) + " TL",
        P.istisnaRejimi === "agi" ? "AGİ ile düşen vergi" : "Asgari ücret istisnası") +
      ozetKart("İşverene aylık maliyet", fmt(sonuc.aylar[0].isverenMaliyeti) + " TL", "Teşviksiz toplam") +
      ozetKart("Asgari ücret (" + sonuc.yil + ")", fmt(d.asgariBrut) + " TL", "brüt · net " + fmt(d.asgariNet) + " TL") +
      "</div>";
  }

  function tabloCiz(hedef, sonuc) {
    var P = sonuc.parametre;
    var html = '<div class="table-scroll"><table class="payroll">' +
      '<caption class="visually-hidden">' + sonuc.yil + " yılı 12 aylık bordro dökümü</caption>" +
      "<thead><tr><th>Ay</th><th>Brüt</th><th>SGK %14</th><th>İşsizlik %1</th>" +
      "<th>Gelir vergisi</th><th>İstisna</th><th>Damga</th><th>Dilim</th><th>Net maaş</th></tr></thead><tbody>";

    sonuc.aylar.forEach(function (a) {
      html += '<tr' + (a.dilimGecisi ? ' class="bracket-jump"' : "") + "><th>" + a.ayAdi +
        (a.dilimGecisi ? ' <span class="jump-flag" title="Bu ay üst vergi dilimine geçildi">▲</span>' : "") +
        "</th><td>" + fmt(a.brut) + "</td><td>" + fmt(a.sgk) + "</td><td>" + fmt(a.issizlik) +
        "</td><td>" + fmt(a.gelirVergisi) + "</td><td>" + fmt(a.istisna) + "</td><td>" + fmt(a.damga) +
        '</td><td class="rate">' + yuzde(a.dilim) + "</td><td><strong>" + fmt(a.net) + "</strong></td></tr>";
    });

    html += "</tbody></table></div>";

    var notlar = [];
    notlar.push(P.istisnaRejimi === "agi"
      ? "Bu yılda asgari geçim indirimi (AGİ) rejimi geçerlidir; damga vergisi brütün tamamı üzerinden alınır."
      : "Gelir vergisi sütunu, asgari ücret istisnası düşüldükten sonra fiilen ödenen tutardır.");
    if (P.donemler.length > 1) {
      notlar.push("Asgari ücret yıl içinde değiştiği için Temmuz'dan itibaren istisna, damga tabanı ve SGK tavanı yeni tutar üzerinden uygulanır.");
    }
    var gecis = sonuc.aylar.filter(function (a) { return a.dilimGecisi; });
    if (gecis.length) {
      notlar.push("▲ işaretli ay(lar) — " + gecis.map(function (a) { return a.ayAdi; }).join(", ") +
        " — kümülatif matrahın üst vergi dilimine geçtiği aylardır.");
    }
    if (P.notlar) notlar.push(P.notlar);

    html += '<p class="muted-note table-note">' + notlar.join(" ") + " Tutarlar TL cinsindendir.</p>" +
      '<p class="muted-note table-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a> ' +
      "· " + sonuc.yil + " dayanağı: " + P.dayanak + "</p>";

    hedef.innerHTML = html;
  }

  function sonucGoster(sonuc) {
    ozetCiz(el("summary"), sonuc);
    tabloCiz(el("table"), sonuc);
    el("results").hidden = false;
  }

  /* ---------- girişler ---------- */

  function brutHesapla() {
    var yil = seciliYil(), g = num("in-gross");
    if (isNaN(g) || g <= 0) return;
    var asgari = B.parametre(yil).donemler[0].asgariBrut;
    if (g < asgari) g = asgari;
    sonucGoster(B.hesaplaYil(g, yil, secenekler()));
  }

  function netHesapla() {
    var yil = seciliYil(), n = num("in-net"), cikti = el("net-out");
    if (isNaN(n) || n <= 0) { cikti.innerHTML = ""; return; }
    var asgariBrut = B.parametre(yil).donemler[0].asgariBrut;
    var asgariNet = B.hesaplaYil(asgariBrut, yil, secenekler()).aylar[0].net;
    if (n < asgariNet) n = asgariNet;
    var brut = B.nettenBrute(n, yil, 0, secenekler());
    cikti.innerHTML = "Gereken brüt maaş: " + fmt(brut) + " TL" +
      '<span class="muted-note">' + yil + " yılı Ocak ayı neti " + fmt(n) +
      " TL olacak şekilde çözüldü. Aşağıda 12 aylık döküm.</span>";
    sonucGoster(B.hesaplaYil(brut, yil, secenekler()));
  }

  function aktifSekme() {
    var t = document.querySelector('[role="tab"][aria-selected="true"]');
    return t && t.id === "tab-2" ? netHesapla : brutHesapla;
  }
  function yenile() { agiGorunurlugu(); aktifSekme()(); }

  yilSecimiKur();
  agiGorunurlugu();

  var elGross = el("in-gross"), elNet = el("in-net");
  if (elGross) elGross.addEventListener("input", brutHesapla);
  if (elNet) elNet.addEventListener("input", netHesapla);
  if (elYear) elYear.addEventListener("change", yenile);
  if (elAgi) elAgi.addEventListener("change", yenile);

  /* Sekmeler */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function sekmeSec(tab) {
    tabs.forEach(function (t) {
      var sec = t === tab;
      t.setAttribute("aria-selected", String(sec));
      t.tabIndex = sec ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sec;
    });
    if (tab.id === "tab-1") brutHesapla(); else netHesapla();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { sekmeSec(tab); });
    tab.addEventListener("keydown", function (e) {
      var idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); tabs[idx].focus(); sekmeSec(tabs[idx]); }
    });
  });

  brutHesapla();
})();
