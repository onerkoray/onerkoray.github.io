/*!
 * Vergi Kaması — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir vergi formülü içermez. Bütün hesap
 * hesap.js'te, o da bordro motorunu çağırıyor.
 *
 * Worker yok, çünkü ölçüldü: 60 noktalık eğri (her nokta iki yıllık bordro
 * hesabı) birkaç milisaniye sürüyor. Ölçmeden worker eklemek mimari
 * gösterisi olurdu.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var K = window.Kama, B = window.Bordro;
  if (!K || !B) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return isFinite(n) ? para0.format(Math.round(n)) : "—"; }
  function yuzde(x, basamak) {
    if (!isFinite(x)) return "—";
    return "%" + (x * 100).toFixed(basamak === undefined ? 2 : basamak).replace(".", ",");
  }
  function deger(id) { return K.sayi($(id).value); }

  function girdiTopla() {
    return {
      yil: parseInt($("k-yil").value, 10),
      alt: deger("k-alt"),
      ust: deger("k-ust"),
      adet: deger("k-adet"),
      secenekler: $("k-tesvik").checked ? { tesvik5Puan: true } : {}
    };
  }

  /* ------------------------------------------------------------------ *
   * İki serili eğri — saf SVG, kütüphane yok.
   * Renk tek başına bilgi taşımıyor: çizgi deseni farklı, uçlarda doğrudan
   * etiket var ve aynı sayılar aşağıdaki tabloda tekrar ediyor.
   * ------------------------------------------------------------------ */
  function grafikCiz(e) {
    var svg = $("k-grafik");
    if (!svg || !e.noktalar.length) return;
    var W = 760, H = 320, sol = 8, sag = 56, ust = 16, alt = 30;
    var gw = W - sol - sag, gh = H - ust - alt;

    var xs = e.noktalar.map(function (n) { return n.aylikBrut; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var hepsi = [];
    e.noktalar.forEach(function (n) { hepsi.push(n.ortalamaKama, n.marjinalKama); });
    var y0 = Math.min.apply(null, hepsi), y1 = Math.max.apply(null, hepsi);
    var pay = (y1 - y0) * 0.12 || 0.02;
    y0 -= pay; y1 += pay;

    function X(v) { return sol + (v - x0) / Math.max(1e-9, x1 - x0) * gw; }
    function Y(v) { return ust + gh - (v - y0) / Math.max(1e-9, y1 - y0) * gh; }

    function yol(al) {
      return "M" + e.noktalar.map(function (n, i) {
        return X(n.aylikBrut).toFixed(1) + "," + Y(al(n)).toFixed(1);
      }).join(" L");
    }

    var parcalar = [];
    /* Yatay ızgara: yüzde çizgileri */
    var adimlar = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
    adimlar.forEach(function (t) {
      if (t < y0 || t > y1) return;
      parcalar.push('<line class="eksen-cizgi" x1="' + sol + '" y1="' + Y(t) +
        '" x2="' + (W - sag) + '" y2="' + Y(t) + '"/>' +
        '<text class="eksen" x="' + (W - sag + 5) + '" y="' + (Y(t) + 4) + '">' +
        yuzde(t, 0) + "</text>");
    });

    /* SGK tavanı — zirvenin yeri */
    if (e.sgkTavan > x0 && e.sgkTavan < x1) {
      parcalar.push('<line class="cizgi-tavan" x1="' + X(e.sgkTavan).toFixed(1) +
        '" y1="' + ust + '" x2="' + X(e.sgkTavan).toFixed(1) + '" y2="' + (ust + gh) + '"/>' +
        '<text class="eksen" x="' + (X(e.sgkTavan) + 5).toFixed(1) + '" y="' + (ust + 12) +
        '">SGK tavanı</text>');
    }

    parcalar.push('<path class="seri-marj" d="' +
      yol(function (n) { return n.marjinalKama; }) + '"/>');
    parcalar.push('<path class="seri-ort" d="' +
      yol(function (n) { return n.ortalamaKama; }) + '"/>');

    var z = e.zirve;
    parcalar.push('<circle class="zirve-nokta" cx="' + X(z.aylikBrut).toFixed(1) +
      '" cy="' + Y(z.ortalamaKama).toFixed(1) + '" r="6"/>');
    parcalar.push('<text class="eksen" x="' + X(z.aylikBrut).toFixed(1) + '" y="' +
      (Y(z.ortalamaKama) - 12).toFixed(1) + '" text-anchor="middle">zirve ' +
      yuzde(z.ortalamaKama, 1) + "</text>");

    parcalar.push('<text class="eksen" x="' + sol + '" y="' + (H - 8) + '">' +
      para(x0) + "</text>");
    parcalar.push('<text class="eksen" x="' + (W - sag) + '" y="' + (H - 8) +
      '" text-anchor="end">' + para(x1) + "</text>");

    svg.innerHTML = parcalar.join("");
  }

  /* ------------------------------------------------------------------ *
   * Kapalı form doğrulaması — araç kendi kendini denetliyor
   * ------------------------------------------------------------------ */
  function dogrulamaYaz(n, yil) {
    var el = $("k-dogrulama");
    var sonDilim = n.dilimler[n.dilimler.length - 1];
    var beklenen = K.kapaliForm(sonDilim, yil, n.tavanda);
    var sapma = Math.abs(n.marjinalCalisan - beklenen);
    var tamam = sapma < 0.012;
    el.innerHTML =
      "<b>Kapalı form kontrolü</b><br>" +
      (n.tavanda
        ? "Tavan üstü: marjinal = dilim + damga = "
        : "Tavan altı: marjinal = prim + (1 − prim) × dilim + damga = ") +
      "<strong>" + yuzde(beklenen) + "</strong> · ölçülen <strong>" +
      yuzde(n.marjinalCalisan) + "</strong> — " +
      (tamam ? '<span class="tamam">örtüşüyor</span>'
             : '<span class="sapma">sapma ' + yuzde(sapma) + "</span>") +
      "<br><span class=\"muted\">Dilim %" + (sonDilim * 100).toFixed(0) +
      " (yıl sonu). İki yol bağımsız hesaplanır; örtüşmezse motorda ya da " +
      "çekirdekte hata var demektir.</span>";
  }

  /* ------------------------------------------------------------------ *
   * Ana akış
   * ------------------------------------------------------------------ */
  function hesapla() {
    var g = girdiTopla();
    var e = K.egri(g);

    $("k-zirve").textContent = yuzde(e.zirve.ortalamaKama, 1);
    $("k-zirve-alt").textContent =
      "Zirve " + para(e.zirve.aylikBrut) + " aylık brütte — prime esas kazanç " +
      "tavanı (" + para(e.sgkTavan) + "). " +
      (e.zirveSonrasiDusuyor
        ? "Bu noktadan sonra ortalama kama düşüyor: tavanın üstündeki kazançtan prim alınmıyor."
        : "Seçilen aralıkta zirve sonrası düşüş görünmüyor; üst sınırı tavanın üstüne çıkarın.");

    /* İncelenen tek nokta */
    var n = K.nokta(deger("k-nokta"), g.yil, g.secenekler);
    $("k-n-kama").textContent = yuzde(n.ortalamaKama);
    $("k-n-calisan").textContent = yuzde(n.ortalamaCalisanOrani);
    $("k-n-marj-kama").textContent = yuzde(n.marjinalKama);
    $("k-n-marj-calisan").textContent = yuzde(n.marjinalCalisan);
    $("k-n-istisna").textContent = yuzde(n.istisnaOrani);
    $("k-n-maliyet").textContent = para(n.yillikMaliyet);
    $("k-n-net").textContent = para(n.yillikNet);
    $("k-n-gecis").textContent = n.dilimGecisAylari.length
      ? n.dilimGecisAylari.map(function (a) { return a + ". ay"; }).join(", ")
      : "yok";

    dogrulamaYaz(n, g.yil);
    grafikCiz(e);

    /* Bileşen tablosu — her satırın toplamı kamayı vermeli */
    var satir = e.noktalar.filter(function (x, i) {
      return i % Math.max(1, Math.round(e.noktalar.length / 14)) === 0 ||
             Math.abs(x.aylikBrut - e.sgkTavan) < 1;
    });
    $("k-tablo").innerHTML = satir.map(function (x) {
      var tavan = Math.abs(x.aylikBrut - e.sgkTavan) < 1;
      return "<tr" + (tavan ? ' class="tavan-satir"' : "") + "><th scope=\"row\">" +
        para(x.aylikBrut) + (tavan ? " (tavan)" : "") + "</th><td>" +
        yuzde(x.ortalamaKama, 1) + "</td><td>" + yuzde(x.marjinalKama, 1) +
        "</td><td>" + yuzde(x.marjinalCalisan, 1) + "</td><td>" +
        yuzde(x.istisnaOrani, 2) + "</td></tr>";
    }).join("");
  }

  /* Yıl listesi motordan geliyor; elle yazılan bir liste eskirdi. */
  (function yillariDoldur() {
    var sec = $("k-yil");
    var yillar = B.yillar().slice().sort(function (a, b) { return b - a; });
    sec.innerHTML = yillar.map(function (y) {
      return '<option value="' + y + '"' + (y === B.sonYil() ? " selected" : "") +
        ">" + y + "</option>";
    }).join("");
  }());

  var bekle = 0;
  function tetikle() { clearTimeout(bekle); bekle = setTimeout(hesapla, 80); }

  document.querySelectorAll("#hesapla input, #hesapla select").forEach(function (el) {
    el.addEventListener("input", tetikle);
    el.addEventListener("change", tetikle);
  });

  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
