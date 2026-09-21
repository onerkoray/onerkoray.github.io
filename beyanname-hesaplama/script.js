/* Yıllık beyanname — arayüz katmanı.
   Bütün kurallar ../bordro/beyanname-motoru.js içinde; eşikler
   ../bordro/parametreler.js'teki tarifeden türüyor. Bu dosya formu okur
   ve sonucu çizer. Parametrelerin veya eşiklerin kopyası burada TUTULMAZ. */
(function () {
  "use strict";
  var M = window.BeyannameMotoru, B = window.Bordro;
  if (!M || !B) return;

  var nf = new Intl.NumberFormat("tr-TR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* Türkçe sayı girişi: "1.234,56" ve "1234.56" ikisi de kabul. */
  function num(id) {
    var e = el(id); if (!e) return 0;
    var h = String(e.value).trim().replace(/\s/g, "");
    if (h === "") return 0;
    if (h.indexOf(",") >= 0) h = h.replace(/\./g, "").replace(",", ".");
    else {
      var p = h.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) {
        h = p.join("");
      }
    }
    var v = parseFloat(h);
    return isFinite(v) ? v : 0;
  }
  function card(l, v, n, lead) {
    return '<div class="sum-card' + (lead ? " sum-card--lead" : "") +
      '"><span class="sum-label">' + esc(l) + '</span><strong class="sum-value">' +
      v + '</strong><span class="sum-note">' + n + "</span></div>";
  }

  var AYLAR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
               "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function aktifYil() {
    var y = new Date().getFullYear();
    return B.parametreler[y] ? y : B.sonYil();
  }

  function oku() {
    var ucretler = [];
    ["in-ucret1", "in-ucret2", "in-ucret3"].forEach(function (id) {
      var v = num(id);
      if (v > 0) ucretler.push({ aylikBrut: v });
    });
    return {
      yil: aktifYil(),
      ucretler: ucretler,
      konutKira: num("in-konut"),
      isyeriKira: num("in-isyeri"),
      gercekGider: num("in-gercek"),
      msiTevkifatli: num("in-msi"),
      msiStopaj: num("in-msi-stopaj"),
      tevkifatsizIrat: num("in-tevkifatsiz"),
      serbestMeslek: num("in-serbest"),
      serbestStopaj: num("in-serbest-stopaj"),
      ticariKazanc: num("in-ticari"),
      gecicVergi: num("in-gecici"),
      egitimSaglik: num("in-egitim"),
      bagis: num("in-bagis"),
      sahisSigorta: num("in-sigorta")
    };
  }

  /* Kullanici herhangi bir GELIR girdi mi? Indirim ve stopaj alanlari
     tek basina gelir sayilmaz: onlar bir gelirin yaninda anlamli. */
  function girdiVar(g) {
    if (g.ucretler && g.ucretler.length) return true;
    return ["konutKira", "isyeriKira", "msiTevkifatli", "tevkifatsizIrat",
            "serbestMeslek", "ticariKazanc"].some(function (k) {
      return g[k] > 0;
    });
  }

  /* Hangi gelir beyana girdi, hangisi girmedi — aracın asıl cevabı. */
  function kalemler(r) {
    var s = [];
    function satir(ad, tutar, girdi, aciklama) {
      s.push('<tr class="' + (girdi ? "bey-in" : "bey-out") + '">' +
        '<th scope="row">' + esc(ad) + "</th>" +
        "<td>" + fmt(tutar) + " TL</td>" +
        "<td>" + (girdi ? "beyana girer" : "girmez") + "</td>" +
        "<td>" + esc(aciklama) + "</td></tr>");
    }
    if (r.ucret && r.ucret.var) {
      satir("Ücret (" + r.ucret.isverenSayisi + " işveren)",
        r.ucret.safiToplam, r.ucret.beyanaGirer,
        r.ucret.beyanaGirer
          ? (r.ucret.toplamAsti ? "toplam 4. dilimi aştı" : "sonrakiler 2. dilimi aştı")
          : "tek/sınır altı — stopaj nihai");
    }
    if (r.kira && !r.kira.hata) {
      var sec = r.kira.avantajli === "gercek" ? r.kira.gercek : r.kira.goturu;
      if (r.kira.konut > 0) {
        satir("Konut kirası (istisna sonrası)", r.kira.konutKalan,
          r.kira.konutKalan > 0, r.kira.istisnaHakki
            ? "istisna uygulandı" : "istisna uygulanamadı");
      }
      if (r.kira.isyeri > 0) {
        satir("İşyeri kirası (brüt)", r.kira.isyeri, r.kira.isyeriBeyanaGirer,
          r.kira.isyeriBeyanaGirer
            ? "gelir toplamı sınırı aştı" : "gelir toplamı sınırın altında");
      }
      if (sec) s.push('<tr class="bey-alt"><th scope="row">— safi irat (' +
        esc(sec.ad.toLowerCase()) + ")</th><td>" + fmt(sec.safiIrat) +
        ' TL</td><td colspan="2">iki yöntemden avantajlı olan</td></tr>');
    }
    if (r.msi && r.msi.tutar > 0) {
      satir("Menkul sermaye iradı", r.msi.tutar, r.msi.beyanaGirer,
        r.msi.beyanaGirer ? "gelir toplamı sınırı aştı" : "gelir toplamı sınırın altında");
    }
    if (r.tevkifatsizIrat && r.tevkifatsizIrat.tutar > 0) {
      satir("Tevkifatsız irat", r.tevkifatsizIrat.tutar,
        r.tevkifatsizIrat.beyanaGirer,
        r.tevkifatsizIrat.beyanaGirer
          ? "ayrı haddi aştı (m.86/1-d)" : "ayrı haddin altında (m.86/1-d)");
    }
    if (r.serbestMeslek > 0) {
      satir("Serbest meslek kazancı", r.serbestMeslek, true, "her hâlde beyan (m.85)");
    }
    if (r.ticariKazanc > 0) {
      satir("Ticari kazanç", r.ticariKazanc, true, "her hâlde beyan (m.85)");
    }
    if (!s.length) return "";
    return '<table class="payroll bey-kalem"><caption>Gelirlerin beyanname karşısındaki durumu</caption>' +
      '<thead><tr><th scope="col">Gelir</th><th scope="col">Tutar</th>' +
      '<th scope="col">Durum</th><th scope="col">Gerekçe</th></tr></thead><tbody>' +
      s.join("") + "</tbody></table>";
  }

  function indirimTablosu(i) {
    var r = [];
    function sat(ad, o) {
      if (!o || (!o.talep && !o.indirilen)) return;
      r.push('<tr><th scope="row">' + esc(ad) + "</th><td>" + fmt(o.talep) +
        " TL</td><td>" + fmt(o.sinir) + " TL</td><td>" + fmt(o.indirilen) + " TL</td></tr>");
    }
    sat("Eğitim ve sağlık", i.egitimSaglik);
    sat("Bağış ve yardım", i.bagis);
    sat("Şahıs sigortası", i.sahisSigorta);
    if (!r.length) return "";
    return '<table class="payroll"><caption>İndirimler (GVK m.89)</caption>' +
      '<thead><tr><th scope="col">İndirim</th><th scope="col">Talep</th>' +
      '<th scope="col">Sınır</th><th scope="col">İndirilen</th></tr></thead><tbody>' +
      r.join("") + "</tbody></table>";
  }

  function ciz() {
    var g = oku();
    var r = M.hesapla(g);
    var kutu = el("results"), mesaj = el("msg");
    if (!kutu) return;

    if (r.hata) {
      kutu.innerHTML = "";
      if (mesaj) { mesaj.textContent = r.hata; mesaj.hidden = false; }
      return;
    }
    if (mesaj) mesaj.hidden = true;

    /* HIC GELIR GIRILMEMISSE KARAR VERILMEZ. Ilk surum bos formda
       dogrudan "beyanname vermeniz gerekmiyor" diyordu: hicbir veriye
       dayanmayan bir hukum. Once girdi istenir. */
    if (!girdiVar(g)) {
      kutu.innerHTML =
        '<div class="verdict verdict--bos"><h3>Gelirlerinizi girin</h3>' +
        "<p>Yukarıdaki alanlara yıl içinde elde ettiğiniz gelirleri yazın; " +
        "araç hangilerinin beyannameye girdiğini ve ne ödeyeceğinizi " +
        "söylesin.</p></div>";
      return;
    }

    if (!r.beyannameVar) {
      kutu.innerHTML =
        '<div class="verdict"><h3>Beyanname vermeniz gerekmiyor</h3>' +
        "<p>Girdiğiniz gelirlerin hiçbiri yıllık beyannameye girmiyor. " +
        "Kesilen vergiler nihai vergidir.</p></div>" +
        kalemler(r) + notlar(r) + kapsam(r);
      return;
    }

    var sonuc = r.odenecek > 0
      ? card("Ödenecek gelir vergisi", fmt(r.odenecek) + " TL",
          "mart ve temmuzda iki taksit", true)
      : card("İade alacağınız tutar", fmt(r.iade) + " TL",
          "kesilen vergi hesaplanandan fazla", true);

    var taksit = "";
    if (r.taksitler.length) {
      taksit = '<table class="payroll"><caption>Ödeme takvimi (GVK m.117)</caption>' +
        '<thead><tr><th scope="col">Taksit</th><th scope="col">Ay</th>' +
        '<th scope="col">Tutar</th></tr></thead><tbody>' +
        r.taksitler.map(function (t, i) {
          return "<tr><th scope=\"row\">" + (i + 1) + ". taksit</th><td>" +
            AYLAR[t.ay] + "</td><td>" + fmt(t.tutar) + " TL</td></tr>";
        }).join("") + "</tbody></table>";
    }

    kutu.innerHTML =
      '<div class="verdict verdict--warn"><h3>Beyanname vermeniz gerekiyor</h3>' +
      "<p>Aşağıdaki gelirler yıllık beyannameye giriyor.</p></div>" +
      '<div class="sum-grid">' +
      sonuc +
      card("Beyan edilen gelir", fmt(r.beyanGeliri) + " TL", "indirimlerden önce") +
      card("Vergi matrahı", fmt(r.matrah) + " TL", "indirimler düşülmüş") +
      card("Hesaplanan vergi", fmt(r.hesaplananVergi) + " TL",
        r.ucretTarifeFarki > 0
          ? "ücret tarife farkı " + fmt(r.ucretTarifeFarki) +
            " TL düşülmüş" + (r.ucretIstisnasi > 0
              ? "; asgari ücret istisnası " + fmt(r.ucretIstisnasi) + " TL düşülmüş" : "")
          : r.ucretIstisnasi > 0
          ? "tarife " + fmt(r.tarifeVergisi) + " − istisna " + fmt(r.ucretIstisnasi)
          : "tarifeye göre") +
      card("Mahsup edilen", fmt(r.mahsup) + " TL", "stopaj ve geçici vergi") +
      "</div>" +
      kalemler(r) + indirimTablosu(r.indirimler) + taksit +
      notlar(r) + kapsam(r);
  }

  function notlar(r) {
    if (!r.notlar || !r.notlar.length) return "";
    return '<div class="legal-note"><h3>Kararın gerekçesi</h3><ul>' +
      r.notlar.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") +
      "</ul></div>";
  }

  function kapsam(r) {
    return '<p class="muted-note">Kapsam dışı: ' +
      r.kapsamDisi.map(esc).join(", ") + ". Sonuç bilgilendirme amaçlıdır.</p>";
  }

  var form = el("bey-form");
  if (form) {
    form.addEventListener("input", ciz);
    form.addEventListener("change", ciz);
    form.addEventListener("submit", function (e) { e.preventDefault(); ciz(); });
  }
  ciz();
})();
