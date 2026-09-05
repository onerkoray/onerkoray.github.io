/* İşten Ayrılma Paketi — arayüz katmanı.
   Bütün hukuki ve mali hesap ../bordro/cikis.js içindedir; bu dosya formu okur,
   motoru çağırır ve sonucu çizer. */
(function () {
  "use strict";
  var C = window.BordroCikis;
  if (!C) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }

  /* Türkçe sayı girişi: "60.000" binlik, "60000,50" ondalık. */
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

  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tarihTR(iso) {
    var p = String(iso).split("-");
    return Number(p[2]) + " " + AY[Number(p[1]) - 1] + " " + p[0];
  }

  /* ---------- fesih türü seçimi ---------- */

  var elFesih = el("in-fesih");
  elFesih.innerHTML = C.FESIH_TURLERI.map(function (t) {
    return '<option value="' + t.kod + '">' + t.ad + "</option>";
  }).join("");

  function seciliFesih() { return C.fesih(elFesih.value); }

  function fesihNotu() {
    var t = seciliFesih();
    el("fesih-note").textContent = t.aciklama + " (" + t.dayanak + ")";
    // İhbar süresi sorusu yalnızca ihbarın gündeme geldiği türlerde anlamlı.
    el("in-ihbar-calisildi").closest(".field-check").hidden = (t.ihbar === false);
  }

  /* ---------- çizim ---------- */

  function ozetKart(etiket, deger, not, durum) {
    return '<div class="sum-card' + (durum ? " sum-card--" + durum : "") + '">' +
      '<span class="sum-label">' + etiket + "</span>" +
      '<strong class="sum-value">' + deger + "</strong>" +
      '<span class="sum-note">' + not + "</span></div>";
  }

  function ozetCiz(r) {
    el("summary").innerHTML = '<div class="sum-grid">' +
      ozetKart("Çıkışta eline geçen", fmt(r.toplam.cikisOdemesi) + " TL",
        "Kıdem + ihbar + izin + son ay", "ana") +
      ozetKart("İşsizlik ödeneği toplamı", r.issizlik.hak ? fmt(r.toplam.issizlikToplam) + " TL" : "Yok",
        r.issizlik.hak ? Math.round(r.issizlik.ay) + " ay boyunca aylık " + fmt(r.issizlik.aylikNet) + " TL" : "Bu fesih türünde bağlanmaz") +
      ozetKart("Genel toplam", fmt(r.toplam.genelToplam) + " TL", "Çıkış ödemesi + ödenek", "ana") +
      ozetKart("Hizmet süresi", r.hizmet.yil + " yıl " + r.hizmet.ay + " ay " + r.hizmet.gun + " gün",
        r.hizmet.toplamGun + " gün") +
      "</div>";
  }

  /* Hak kartları: her kalem için "var / yok" ve gerekçe. */
  function hakKarti(baslik, hak, tutar, alt, gerekce) {
    return '<li class="right-card ' + (hak ? "is-yes" : "is-no") + '">' +
      '<span class="right-badge" aria-hidden="true">' + (hak ? "✓" : "✕") + "</span>" +
      '<div class="right-body"><h3>' + baslik + "</h3>" +
      (hak
        ? '<p class="right-amount">' + fmt(tutar) + " TL</p><p class=\"right-note\">" + alt + "</p>"
        : '<p class="right-none">Doğmuyor</p><p class="right-note">' + gerekce + "</p>") +
      "</div></li>";
  }

  function haklarCiz(r) {
    el("rights").innerHTML =
      '<h3 class="block-title">Bu fesihte hangi haklar doğuyor?</h3>' +
      '<ul class="rights-grid">' +
      hakKarti("Kıdem tazminatı", r.kidem.hak, r.kidem.net,
        "Brüt " + fmt(r.kidem.brut) + " TL · yalnızca damga vergisi kesildi", r.kidem.gerekce) +
      hakKarti("İhbar tazminatı", r.ihbar.hak, r.ihbar.net,
        r.ihbar.hafta + " haftalık ücret · gelir + damga vergisi kesildi", r.ihbar.gerekce) +
      hakKarti("Yıllık izin ücreti", r.izin.gun > 0, r.izin.net,
        r.izin.gun + " gün · çıplak ücret üzerinden", "Kullanılmayan izin günü girilmedi.") +
      hakKarti("Son ay ücreti", r.sonAy.gun > 0, r.sonAy.net,
        r.sonAy.gun + " günlük çalışma karşılığı", "Çıkış ayında çalışılan gün yok.") +
      hakKarti("İşsizlik ödeneği", r.issizlik.hak, r.issizlik.toplam,
        Math.round(r.issizlik.ay) + " ay × " + fmt(r.issizlik.aylikNet) + " TL net", r.issizlik.gerekce) +
      "</ul>";
  }

  function satir(baslik, deger, sinif) {
    return "<tr" + (sinif ? ' class="' + sinif + '"' : "") + "><th>" + baslik + "</th><td>" + deger + "</td></tr>";
  }

  function dokumCiz(r) {
    var s = [];
    s.push(satir("Giydirilmiş aylık brüt ücret", fmt(r.giydirilmisBrut) + " TL"));
    s.push(satir("Çıkış ayı marjinal gelir vergisi dilimi", "%" + Math.round(r.marjinalOran * 100)));

    if (r.kidem.hak) {
      s.push(satir("<em>Kıdem tazminatı</em>", "", "row-head"));
      s.push(satir("Uygulanan kıdem tavanı", fmt(r.kidem.tavan) + " TL" +
        (r.kidem.tavanUygulandi ? " <strong>(tavan uygulandı)</strong>" : " (ücret tavanın altında)")));
      s.push(satir("Kıdeme esas aylık ücret", fmt(r.kidem.esasUcret) + " TL"));
      s.push(satir("Brüt kıdem tazminatı", fmt(r.kidem.brut) + " TL"));
      s.push(satir("Damga vergisi (binde 7,59)", "− " + fmt(r.kidem.damga) + " TL"));
      s.push(satir("<strong>Net kıdem tazminatı</strong>", "<strong>" + fmt(r.kidem.net) + " TL</strong>"));
    }
    if (r.ihbar.hak) {
      s.push(satir("<em>İhbar tazminatı</em>", "", "row-head"));
      s.push(satir("İhbar süresi", r.ihbar.hafta + " hafta (" + (r.ihbar.hafta * 7) + " gün)"));
      s.push(satir("Brüt ihbar tazminatı", fmt(r.ihbar.brut) + " TL"));
      s.push(satir("Gelir vergisi (%" + Math.round(r.marjinalOran * 100) + ")", "− " + fmt(r.ihbar.gelirVergisi) + " TL"));
      s.push(satir("Damga vergisi", "− " + fmt(r.ihbar.damga) + " TL"));
      s.push(satir("<strong>Net ihbar tazminatı</strong>", "<strong>" + fmt(r.ihbar.net) + " TL</strong>"));
    }
    if (r.izin.gun > 0) {
      s.push(satir("<em>Kullanılmayan yıllık izin</em>", "", "row-head"));
      s.push(satir("İzin günü", r.izin.gun + " gün"));
      s.push(satir("Brüt izin ücreti", fmt(r.izin.brut) + " TL"));
      s.push(satir("Gelir vergisi", "− " + fmt(r.izin.gelirVergisi) + " TL"));
      s.push(satir("Damga vergisi", "− " + fmt(r.izin.damga) + " TL"));
      s.push(satir("<strong>Net izin ücreti</strong>", "<strong>" + fmt(r.izin.net) + " TL</strong>"));
    }
    if (r.issizlik.hak) {
      s.push(satir("<em>İşsizlik ödeneği</em>", "", "row-head"));
      s.push(satir("Hesaba esas kazanç", fmt(r.issizlik.esasKazanc) + " TL"));
      s.push(satir("Kazancın %40'ı", fmt(r.issizlik.hamOdenek) + " TL"));
      s.push(satir("Ödenek tavanı (asgari brüt × %80)", fmt(r.issizlik.tavan) + " TL" +
        (r.issizlik.tavanUygulandi ? " <strong>(tavan uygulandı)</strong>" : "")));
      s.push(satir("Brüt aylık ödenek", fmt(r.issizlik.aylikBrut) + " TL"));
      s.push(satir("Damga vergisi", "− " + fmt(r.issizlik.damga) + " TL"));
      s.push(satir("<strong>Net aylık ödenek</strong>", "<strong>" + fmt(r.issizlik.aylikNet) + " TL</strong>"));
      s.push(satir("Ödenek süresi", r.issizlik.gun + " gün (" + Math.round(r.issizlik.ay) + " ay)"));
    }

    el("detail").innerHTML =
      '<h3 class="block-title">Hesap dökümü</h3>' +
      '<div class="table-scroll"><table class="payroll detail"><caption class="visually-hidden">Çıkış paketi hesap dökümü</caption><tbody>' +
      s.join("") + "</tbody></table></div>" +
      (r.uyarilar.length
        ? '<p class="muted-note table-note"><strong>Dikkat:</strong> ' + r.uyarilar.join(" ") + "</p>"
        : "");
  }

  function takvimCiz(r) {
    var h = r.takvim.map(function (o) {
      return '<li class="tl-item">' +
        '<time class="tl-date" datetime="' + o.tarih + '">' + tarihTR(o.tarih) + "</time>" +
        '<div class="tl-body"><h4>' + o.olay + "</h4>" +
        (o.tutar > 0 ? '<p class="tl-amount">' + fmt(o.tutar) + " TL</p>" : "") +
        '<p class="tl-detail">' + o.detay + "</p></div></li>";
    }).join("");

    el("timeline").innerHTML =
      '<h3 class="block-title">Ödeme takvimi</h3>' +
      '<ol class="timeline">' + h + "</ol>" +
      '<p class="muted-note table-note">Kıdem, ihbar, izin ve son ay ücreti fesih tarihinde muaccel olur. ' +
      "İşsizlik ödeneği tarihleri İŞKUR uygulamasına göre yaklaşıktır.</p>";
  }

  /* ---------- hesap ---------- */

  function hesapla() {
    fesihNotu();

    var giris = el("in-giris").value;
    var cikis = el("in-cikis").value;
    var brut = num("in-brut");
    var msg = el("msg");

    function hata(metin) {
      el("results").hidden = true;
      msg.textContent = metin;
      msg.hidden = false;
    }

    if (!giris || !cikis) return hata("İşe giriş ve çıkış tarihlerini girin.");
    if (cikis <= giris) return hata("İşten çıkış tarihi, işe giriş tarihinden sonra olmalıdır.");
    if (isNaN(brut) || brut <= 0) return hata("Aylık çıplak brüt ücreti girin.");

    var yil = Number(cikis.slice(0, 4));
    if (!window.Bordro.parametreler[yil]) {
      return hata(yil + " yılı için bordro parametreleri tanımlı değil. Desteklenen yıllar: " +
        window.Bordro.yillar().join(", ") + ".");
    }

    msg.hidden = true;

    var r = C.hesapla({
      iseGiris: giris,
      cikis: cikis,
      ciplakBrut: brut,
      giydirmeEkleri: num("in-ekler") || 0,
      fesihTuru: elFesih.value,
      ihbarSuresiCalisildi: el("in-ihbar-calisildi").checked,
      kullanilmayanIzinGunu: num("in-izin") || 0,
      son4AyBrutOrtalama: num("in-ortalama") || brut,
      son3YilPrimGunu: num("in-prim") || 0
    });

    ozetCiz(r);
    haklarCiz(r);
    dokumCiz(r);
    takvimCiz(r);
    el("results").hidden = false;
  }

  ["in-giris", "in-cikis", "in-brut", "in-ekler", "in-izin", "in-ortalama", "in-prim"]
    .forEach(function (id) {
      var e = el(id);
      if (e) { e.addEventListener("input", hesapla); e.addEventListener("change", hesapla); }
    });
  elFesih.addEventListener("change", hesapla);
  el("in-ihbar-calisildi").addEventListener("change", hesapla);

  hesapla();
})();
