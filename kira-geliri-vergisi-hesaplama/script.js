/* Kira Geliri Vergisi — arayüz katmanı.
   İstisna, beyan sınırları, gider oranı ve tarife ../bordro/parametreler.js
   içindedir; hesap ../bordro/gmsi-motor.js'de. Bu dosya formu okur ve
   sonucu çizer. Parametrelerin kopyası burada tutulmaz. */
(function () {
  "use strict";
  var M = window.GmsiMotor, B = window.Bordro;
  if (!M || !B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function yuzde(n) { return nf.format(Math.round(n * 10000) / 100); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(id) {
    var e = el(id); if (!e) return 0;
    var h = String(e.value).trim().replace(/\s/g, "");
    if (h === "") return 0;
    if (h.indexOf(",") >= 0) h = h.replace(/\./g, "").replace(",", ".");
    else { var p = h.split("."); if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) h = p.join(""); }
    var v = parseFloat(h); return isFinite(v) ? v : 0;
  }
  function card(l, v, n, lead) {
    return '<div class="sum-card' + (lead ? " sum-card--lead" : "") + '"><span class="sum-label">' +
      l + '</span><strong class="sum-value">' + v + '</strong><span class="sum-note">' + n + "</span></div>";
  }

  function aktifYil() {
    var y = new Date().getFullYear();
    return B.parametreler[y] ? y : B.sonYil();
  }

  /* İki yöntemi yan yana koyan karşılaştırma. Kazanan kart işaretleniyor;
     "hangisi avantajlı" sorusu bu aracın asıl varlık sebebi. */
  function karsilastirma(r) {
    function kutu(y, kod) {
      var kazanan = r.avantajli === kod;
      return '<div class="kg-yontem' + (kazanan ? " kg-kazanan" : "") + '">' +
        '<p class="kg-yontem-ad">' + esc(y.ad) +
        (kazanan ? ' <span class="kg-rozet">avantajlı</span>' : "") + "</p>" +
        '<p class="kg-tutar">' + fmt(y.odenecek) + " TL</p>" +
        '<p class="kg-alt">ödenecek vergi</p>' +
        "<dl class=\"kg-dokum\">" +
        "<div><dt>İndirilen gider</dt><dd>" + fmt(y.gider) + " TL</dd></div>" +
        "<div><dt>Safi irat</dt><dd>" + fmt(y.safiIrat) + " TL</dd></div>" +
        "<div><dt>Kiranın vergisi</dt><dd>" + fmt(y.kiraVergisi) + " TL</dd></div>" +
        "<div><dt>Efektif oran</dt><dd>%" + yuzde(y.efektifOran) + "</dd></div>" +
        "</dl>" + esc("") + '<p class="kg-aciklama">' + esc(y.aciklama) + "</p></div>";
    }
    return '<div class="kg-karsilastirma">' + kutu(r.goturu, "goturu") + kutu(r.gercek, "gercek") + "</div>";
  }

  function recalc() {
    var results = el("results"), msg = el("msg");
    if (!results) return;
    var r = M.hesapla({
      yil: aktifYil(),
      konutKira: num("in-konut"),
      isyeriKira: num("in-isyeri"),
      gercekGider: num("in-gercek"),
      digerGelir: num("in-diger")
    });
    if (r.hata) { results.innerHTML = ""; msg.hidden = false; msg.textContent = r.hata; return; }
    msg.hidden = true;

    var sec = r.avantajli === "gercek" ? r.gercek : r.goturu;
    var esitMi = r.avantajli === "esit";

    var kartlar =
      card("Ödenecek vergi", fmt(sec.odenecek) + " TL",
        esitMi ? "İki yöntem de aynı sonucu veriyor"
               : (r.avantajli === "gercek" ? "Gerçek gider yöntemiyle" : "Götürü gider yöntemiyle"), true) +
      card("Uygulanan istisna", fmt(r.istisna) + " TL",
        r.istisnaHakki ? "Mesken istisnası (GVK m.21)" : "İstisna hakkı yok") +
      card("Yöntem farkı", fmt(r.fark) + " TL",
        esitMi ? "Fark yok" : "Doğru yöntemi seçerek kazanılan") +
      card("Mahsup edilen stopaj", fmt(sec.mahsup) + " TL",
        r.isyeriBeyanaGirer ? "İşyeri kirasından kesilen %20" : "Beyana giren stopaj yok");

    var taksit = sec.odenecek / 2;
    var takvim = sec.odenecek > 0
      ? '<div class="kg-takvim"><p class="kg-takvim-bas">Ödeme takvimi</p>' +
        "<p>Vergi iki eşit taksitte ödenir: <strong>" + fmt(taksit) +
        " TL</strong> Mart sonuna, <strong>" + fmt(taksit) +
        " TL</strong> Temmuz sonuna kadar.</p></div>"
      : "";

    var notlar = r.notlar.length
      ? '<ul class="kg-notlar">' + r.notlar.map(function (n) {
          return "<li>" + esc(n) + "</li>";
        }).join("") + "</ul>"
      : "";

    var uyari = '<p class="kg-uyari">Götürü gider yöntemini seçenler <strong>iki yıl ' +
      "geçmeden</strong> gerçek gider yöntemine dönemez. Gerçek giderden götürüye " +
      "geçiş ise serbesttir.</p>";

    results.innerHTML = '<div class="sum-grid">' + kartlar + "</div>" +
      karsilastirma(r) + takvim + uyari + notlar;
  }

  var form = el("gmsi-form");
  if (form) {
    form.addEventListener("input", recalc);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  recalc();
})();
