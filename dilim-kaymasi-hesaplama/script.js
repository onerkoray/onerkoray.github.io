/*!
 * Dilim kayması hesaplama — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar bordro/dilim-kaymasi.js'ten, o da bordro
 * motorundan gelir. Kesir payı cümlesi yeniden değerleme yazısının
 * modülünden (ydo.js) okunur; araç ile yazı aynı denetimi kullanır.
 */
(function () {
  "use strict";

  var D = window.DilimKaymasi, B = window.Bordro, Y = window.YDO;
  if (!D || !B) return;

  function $(id) { return document.getElementById(id); }
  var form = $("dk-form"), cikti = $("dk-sonuc"), mesaj = $("dk-mesaj");
  var grafikBlok = $("dk-grafik-blok");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var ESIK = 0.5;   /* yarım liradan küçük fark "etkisiz" sayılır */
  function tl(n) { return nf2.format(n) + " TL"; }
  function tl0(n) { return nf0.format(Math.round(n)) + " TL"; }
  function isaretli(n, bicim) {
    var s = (bicim || tl)(Math.abs(n));
    if (Math.abs(n) < ESIK) return (bicim || tl)(0);
    return (n > 0 ? "+" : "−") + s;
  }
  function yuzde(o, b) { return "%" + (o * 100).toFixed(b == null ? 2 : b).replace(".", ","); }
  function kacis(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Yıl ekleri son rakamın okunuşuna göre: 2025'ten, 2026'dan, 2026'ya. */
  var EK = {
    den: ["'dan", "'den", "'den", "'ten", "'ten", "'ten", "'dan", "'den", "'den", "'dan"],
    e:   ["'a", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"],
    de:  ["'da", "'de", "'de", "'te", "'te", "'te", "'da", "'de", "'de", "'da"]
  };
  function ek(yil, tur) { return yil + EK[tur][yil % 10]; }

  var IFADE = {
    ydo: "yeniden değerleme oranıyla, aşağı yuvarlanmadan",
    tufe: "tüketici enflasyonu kadar",
    asgari: "asgari ücret kadar"
  };

  function oku() {
    var t = String($("dk-brut").value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? v : null;
  }
  function secilenOlcut() {
    var s = form.querySelector('input[name="dk-olcut"]:checked');
    return s ? s.value : "ydo";
  }

  /* ---------------------------------------------------------- seçimler */
  var yilSec = $("dk-yil"), bazSec = $("dk-baz");
  D.yillar().slice().reverse().forEach(function (y) {
    var o = document.createElement("option");
    o.value = String(y); o.textContent = String(y);
    yilSec.appendChild(o);
  });
  function bazDoldur(istenen) {
    var yil = parseInt(yilSec.value, 10);
    var bazlar = D.bazYillari(yil);
    var secili = bazlar.indexOf(istenen) !== -1 ? istenen : yil - 1;
    bazSec.innerHTML = "";
    bazlar.slice().reverse().forEach(function (b) {
      var o = document.createElement("option");
      o.value = String(b);
      o.textContent = b === yil - 1 ? b + " (bir önceki yıl)" : String(b);
      if (b === secili) o.selected = true;
      bazSec.appendChild(o);
    });
  }

  /* Paylaşım bağlantısıyla gelen durum. Geçersiz değer sessizce atlanır. */
  (function adrestenOku() {
    var q = new URLSearchParams(window.location.search);
    var yil = parseInt(q.get("yil"), 10);
    if (D.yillar().indexOf(yil) !== -1) yilSec.value = String(yil);
    else yilSec.value = String(D.yillar()[D.yillar().length - 1]);
    bazDoldur(parseInt(q.get("baz"), 10));
    var brut = parseFloat(q.get("brut"));
    if (isFinite(brut) && brut > 0 && brut < 1e9) $("dk-brut").value = nf0.format(Math.round(brut));
    var o = q.get("olcut");
    if (o && IFADE[o]) {
      var r = form.querySelector('input[name="dk-olcut"][value="' + o + '"]');
      if (r) r.checked = true;
    }
  })();

  /* ---------------------------------------------------------- metinler */
  function manset(r) {
    var g = r.girdi, f = r.fark, h = [];
    var kim = g.baz === g.yil - 1
      ? g.yil + " tarifesinin dilimleri " + ek(g.baz, "den") + " bu yana"
      : "Dilimler " + ek(g.baz, "den") + " " + ek(g.yil, "e");
    h.push('<div class="dk-manset">');
    if (Math.abs(f) < ESIK) {
      var asgariUstu = g.brut > D.asgariBrut(g.yil) * 1.0001;
      h.push("<p><strong>Bu ücrette fark yok.</strong></p>");
      h.push("<p>" + (asgariUstu
        ? "Kaydırılan eşikler sizin vergi yolculuğunuza yansımıyor. Eşik tablosu nedenini gösteriyor."
        : "Asgari ücret düzeyinde gelir vergisi zaten sıfır; tarife ne olursa olsun fark çıkmaz.") + "</p>");
    } else {
      h.push("<p>" + kim.charAt(0).toUpperCase() + kim.slice(1) + " " + IFADE[g.olcut] +
        " büyütülseydi, bu ücretten yılda <strong>" + tl(Math.abs(f)) + " daha " +
        (f > 0 ? "az" : "fazla") + "</strong> gelir vergisi kesilecekti.</p>");
      h.push("<p>Ayda ortalama " + tl(Math.abs(r.aylikFark)) + ". " + (f > 0
        ? "Tarife bu ölçütün gerisinde kaldı."
        : "Tarife bu ölçütten hızlı büyüdü; bu ölçüte göre dilim kayması yok, tersine.") + "</p>");
    }
    h.push("</div>");
    return h.join("");
  }

  /* Yasal ölçütte fark bir ihlal değil, izin verilen yuvarlamanın bedeli.
     Bunu yeniden değerleme yazısının denetiminden okuyarak söylüyoruz. */
  function kesirNotu(r) {
    if (r.girdi.olcut !== "ydo" || !Y || !Y.tarifeDenetimi) return "";
    var enCok = 0, hepsiUygun = true;
    for (var y = r.girdi.baz + 1; y <= r.girdi.yil; y++) {
      var d;
      try { d = Y.tarifeDenetimi(y); } catch (e) { return ""; }
      d.dilimler.forEach(function (x) {
        enCok = Math.max(enCok, x.atilanOran);
        if (!x.uygun) hepsiUygun = false;
      });
    }
    if (!hepsiUygun) return "";
    var yillar = r.girdi.baz === r.girdi.yil - 1 ? ek(r.girdi.yil, "de")
      : ek(r.girdi.baz + 1, "den") + " " + ek(r.girdi.yil, "e") + " kadar her yıl";
    return '<div class="dk-not"><h3>Bu fark kanuna aykırı değil</h3>' +
      "<p>Gelir Vergisi Kanunu mükerrer 123, yeniden değerleme oranıyla bulunan " +
      "tutarın %" + Math.round(Y.KESIR_PAYI * 100) + "'i aşmayan kesirlerinin atılmasına izin veriyor. " +
      yillar + " bütün eşikler bu payın içinde (en çok " + yuzde(enCok) + " aşağı yuvarlandı). " +
      "Gördüğünüz fark, izin verilen aşağı yuvarlamanın sizin bordronuzdaki bedeli.</p></div>";
  }

  function kartlar(r, satir) {
    var h = ['<div class="dk-kartlar" role="group" aria-label="Üç ölçütte sonuç">'];
    satir.olcutler.forEach(function (o) {
      var bilgi = D.olcut(o.kod), secili = o.kod === r.girdi.olcut;
      var rozet = Math.abs(o.fark) < ESIK ? ["dk-rozet--notr", "Etkisiz"]
        : o.fark > 0 ? ["dk-rozet--fazla", "Fazla vergi"] : ["dk-rozet--lehine", "Lehinize"];
      var k = D.katsayi(o.kod, r.girdi.baz, r.girdi.yil);
      h.push('<button type="button" class="dk-kart' + (secili ? " dk-kart--secili" : "") +
        '" data-olcut="' + o.kod + '" aria-pressed="' + secili + '">' +
        '<span class="dk-kart-ad">' + kacis(bilgi.ad) + "</span>" +
        '<span class="dk-kart-deger">' + isaretli(o.fark) + "</span>" +
        '<span class="dk-rozet ' + rozet[0] + '">' + rozet[1] + "</span>" +
        '<span class="dk-kart-alt">Ölçüt ' + ek(r.girdi.baz, "den") + " bu yana " +
        yuzde(k - 1, 1) + " · ikinci eşik " + yuzde(r.tarifeArtisi - 1, 1) + "</span></button>");
    });
    h.push("</div>");
    return h.join("");
  }

  function esikTablosu(r) {
    var matrah = r.gercek.aylar[11].kumulatifMatrah;
    var asgariUstu = r.girdi.brut > D.asgariBrut(r.girdi.yil) * 1.0001;
    var h = ['<div class="table-wrap"><table class="data-table dk-tablo">',
      "<caption>Fark hangi eşikten geliyor?</caption>",
      '<thead><tr><th scope="col">Eşik</th><th scope="col">Gerçek tarife</th>' +
      '<th scope="col">Endekslenmiş</th><th scope="col">Eşik farkı</th>' +
      '<th scope="col">Size etkisi</th></tr></thead><tbody>'];
    var notlar = [];
    r.esikler.forEach(function (e) {
      var alt = r.gercekDilimler[e.sira - 1][1];
      var etiket = e.sira + ". eşik <small>" + yuzde(alt, 0) + " → " + yuzde(e.ustOran, 0) + "</small>";
      var cls = "";
      if (Math.abs(e.katki) < 0.005) {
        if (matrah < Math.min(e.gercek, e.karsi)) { cls = "dk-uzak"; }
        else if (asgariUstu && e.sira === 1) {
          cls = "dk-notr";
          notlar.push("1. eşiğin etkisi tam sıfır: asgari ücret istisnası aynı tarifeyle hesaplandığı " +
            "için bu eşik asgari ücret üstü bir ücretlinin vergisini değiştirmez.");
        }
      }
      h.push('<tr' + (cls ? ' class="' + cls + '"' : "") + '><th scope="row">' + etiket + "</th>" +
        "<td>" + tl0(e.gercek) + "</td><td>" + tl0(e.karsi) + "</td>" +
        "<td>" + isaretli(e.karsi - e.gercek, tl0) + "</td>" +
        "<td>" + isaretli(e.katki) + "</td></tr>");
    });
    h.push('<tr class="dk-toplam"><th scope="row">Toplam</th><td></td><td></td><td></td>' +
      "<td>" + isaretli(r.fark) + "</td></tr></tbody></table></div>");
    if (r.esikler.some(function (e) { return matrah < Math.min(e.gercek, e.karsi) && Math.abs(e.katki) < 0.005; })) {
      notlar.push("Yıllık matrahınızın (" + tl0(matrah) + ") ulaşmadığı eşikler vergiyi etkilemez.");
    }
    notlar.push(dilimAyi(r));
    h.push(notlar.map(function (n) { return '<p class="muted-note">' + n + "</p>"; }).join(""));
    return h.join("");
  }

  function dilimAyi(r) {
    var farklar = [];
    for (var i = 1; i < r.gercekDilimler.length; i++) {
      var g = r.gercekAylar[i], k = r.karsiAylar[i];
      if (g === k) continue;
      var oran = yuzde(r.gercekDilimler[i][1], 0);
      farklar.push(oran + " dilimine gerçek tarifede " + (g ? B.AY_ADLARI[g - 1] + " ayında" : "hiç") +
        ", endekslenmiş tarifede " + (k ? B.AY_ADLARI[k - 1] + " ayında" : "hiç") + " giriyorsunuz");
    }
    return farklar.length ? farklar.join("; ") + "."
      : "Dilim geçiş aylarınız iki tarifede aynı; fark ay değil tutar farkı.";
  }

  function matrisTablosu(r, m) {
    var h = ['<div class="table-wrap"><table class="data-table dk-tablo dk-matris">',
      "<caption>Sonuç başlangıç yılına ve ölçüte ne kadar bağlı?</caption><thead><tr>" +
      '<th scope="col">Başlangıç</th>'];
    D.OLCUTLER.forEach(function (o) { h.push('<th scope="col">' + kacis(o.ad) + "</th>"); });
    h.push("</tr></thead><tbody>");
    var hepsi = [];
    m.forEach(function (satir) {
      h.push('<tr><th scope="row">' + satir.baz + "</th>");
      satir.olcutler.forEach(function (o) {
        hepsi.push(o.fark);
        var sec = satir.baz === r.girdi.baz && o.kod === r.girdi.olcut;
        h.push("<td" + (sec ? ' class="dk-secili"' : "") + ">" + isaretli(o.fark, tl0) + "</td>");
      });
      h.push("</tr>");
    });
    h.push("</tbody></table></div>");
    var enAz = Math.min.apply(null, hepsi), enCok = Math.max.apply(null, hepsi);
    h.push('<p class="muted-note">Aynı ücret için sonuç ' + isaretli(enAz, tl0) + " ile " +
      isaretli(enCok, tl0) + " arasında değişiyor. Artı: tarife ölçütün gerisinde; eksi: önünde. " +
      "Tek bir “enflasyon vergisi” rakamı veren hesap, bu seçimlerden birini sizin yerinize yapmıştır.</p>");
    return h.join("");
  }

  function paylasimMetni(r) {
    var g = r.girdi;
    var adres = "https://korayoner.dev/dilim-kaymasi-hesaplama/?brut=" + Math.round(g.brut) +
      "&yil=" + g.yil + "&baz=" + g.baz + "&olcut=" + g.olcut;
    var cumle = Math.abs(r.fark) < ESIK
      ? ek(g.yil, "de") + " aylık " + tl0(g.brut) + " brütte dilim kayması yok."
      : ek(g.yil, "de") + " aylık " + tl0(g.brut) + " brütten, dilimler " + ek(g.baz, "den") +
        " bu yana " + IFADE[g.olcut] + " büyütülseydi yılda " + tl(Math.abs(r.fark)) + " daha " +
        (r.fark > 0 ? "az" : "fazla") + " gelir vergisi kesilirdi.";
    return { cumle: cumle, adres: adres };
  }

  function paylasim(r) {
    var p = paylasimMetni(r);
    return '<div class="dk-paylas"><p class="dk-paylas-cumle" id="dk-paylas-cumle">' + kacis(p.cumle) +
      "</p><p class=\"dk-paylas-satir\"><button type=\"button\" class=\"btn\" id=\"dk-kopyala\" data-metin=\"" +
      kacis(p.cumle + " " + p.adres).replace(/"/g, "&quot;") + "\">Sonucu kopyala</button>" +
      '<span class="dk-durum" id="dk-durum" role="status"></span></p></div>';
  }

  /* ---------------------------------------------------------- grafik */
  function grafik(r) {
    var svg = $("dk-grafik");
    if (!svg) return;
    var g = r.girdi, asgari = D.asgariBrut(g.yil);
    var ust = Math.min(1500000, Math.max(400000, g.brut * 1.3));
    var N = 60, brutler = [];
    for (var i = 0; i <= N; i++) brutler.push(asgari + (ust - asgari) * i / N);
    var seriler = D.OLCUTLER.map(function (o) {
      return { kod: o.kod, noktalar: D.tarama(g.yil, g.baz, o.kod, brutler) };
    });

    var W = 760, H = 330, sol = 64, sag = 16, ustP = 16, alt = 34;
    var gw = W - sol - sag, gh = H - ustP - alt;
    var ys = [0, r.fark];
    seriler.forEach(function (s) { s.noktalar.forEach(function (n) { ys.push(n.fark); }); });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pay = (y1 - y0) * 0.08 || 100; y0 -= pay; y1 += pay;
    function X(v) { return sol + (v - asgari) / (ust - asgari) * gw; }
    function Yk(v) { return ustP + gh - (v - y0) / (y1 - y0) * gh; }

    /* Okunur adım: 1, 2, 5 × 10^k. */
    function adim(aralik, hedef) {
      var ham = aralik / hedef, us = Math.pow(10, Math.floor(Math.log10(ham)));
      var b = ham / us;
      return (b <= 1 ? 1 : b <= 2 ? 2 : b <= 5 ? 5 : 10) * us;
    }
    function kisa(v) {
      var a = Math.abs(v);
      var s = a >= 1e6 ? (a / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " mn"
        : a >= 1000 ? (a / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " bin"
        : nf0.format(a);
      return (v < 0 ? "−" : v > 0 ? "+" : "") + s;
    }

    var p = [];
    var ya = adim(y1 - y0, 5);
    for (var t = Math.ceil(y0 / ya) * ya; t <= y1; t += ya) {
      p.push('<line class="' + (Math.abs(t) < ya / 1e6 ? "dk-sifir" : "eksen-cizgi") + '" x1="' + sol +
        '" y1="' + Yk(t).toFixed(1) + '" x2="' + (W - sag) + '" y2="' + Yk(t).toFixed(1) + '"/>' +
        '<text class="eksen" x="' + (sol - 8) + '" y="' + (Yk(t) + 4).toFixed(1) +
        '" text-anchor="end">' + kisa(Math.abs(t) < ya / 1e6 ? 0 : t) + "</text>");
    }
    var xa = adim(ust - asgari, 5);
    for (var xv = Math.ceil(asgari / xa) * xa; xv <= ust; xv += xa) {
      /* Kenara düşen etiket içeri hizalanır; yoksa kesiliyordu. */
      var hiza = X(xv) > W - sag - 24 ? "end" : "middle";
      p.push('<text class="eksen" x="' + X(xv).toFixed(1) + '" y="' + (H - 12) +
        '" text-anchor="' + hiza + '">' + kisa(xv).replace("+", "") + "</text>");
    }
    seriler.forEach(function (s) {
      var d = "M" + s.noktalar.map(function (n) {
        return X(n.brut).toFixed(1) + "," + Yk(n.fark).toFixed(1);
      }).join(" L");
      p.push('<path class="dk-seri dk-seri-' + s.kod + (s.kod === g.olcut ? " dk-seri-secili" : "") +
        '" d="' + d + '"/>');
    });
    if (g.brut >= asgari && g.brut <= ust) {
      p.push('<circle class="dk-nokta dk-nokta-' + g.olcut + '" cx="' + X(g.brut).toFixed(1) +
        '" cy="' + Yk(r.fark).toFixed(1) + '" r="6"/>');
    }
    svg.innerHTML = p.join("");
  }

  /* ---------------------------------------------------------- akış */
  function calistir() {
    var brut = oku();
    if (brut === null) {
      cikti.innerHTML = "";
      grafikBlok.hidden = true;
      mesaj.textContent = "Aylık brüt ücretinizi girin; hesap otomatik çalışır.";
      return;
    }
    try {
      var g = { brut: brut, yil: parseInt(yilSec.value, 10), baz: parseInt(bazSec.value, 10), olcut: secilenOlcut() };
      var r = D.hesapla(g);
      var m = D.matris(brut, g.yil);
      var satir = m.filter(function (x) { return x.baz === g.baz; })[0];
      cikti.innerHTML = manset(r) + kesirNotu(r) + kartlar(r, satir) + esikTablosu(r) +
        matrisTablosu(r, m) + paylasim(r);
      grafikBlok.hidden = false;
      grafik(r);
      mesaj.textContent = "Hesap tarayıcınızda yapıldı; girdiğiniz tutar hiçbir yere gönderilmedi.";
    } catch (e) {
      cikti.innerHTML = "";
      grafikBlok.hidden = true;
      mesaj.textContent = e.message;
    }
  }

  var bekle;
  function tetikle() { clearTimeout(bekle); bekle = setTimeout(calistir, 80); }

  form.addEventListener("input", tetikle);
  form.addEventListener("change", function (e) {
    if (e.target === yilSec) bazDoldur(parseInt(bazSec.value, 10));
    tetikle();
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });

  /* Kartlar ölçüt seçicisinin kısayolu. */
  cikti.addEventListener("click", function (e) {
    var kart = e.target.closest ? e.target.closest(".dk-kart") : null;
    if (kart) {
      var r = form.querySelector('input[name="dk-olcut"][value="' + kart.getAttribute("data-olcut") + '"]');
      if (r) { r.checked = true; calistir(); }
      return;
    }
    if (e.target.id === "dk-kopyala") {
      var metin = e.target.getAttribute("data-metin"), durum = $("dk-durum");
      var bitti = function (ok) { if (durum) durum.textContent = ok ? "Kopyalandı." : "Kopyalanamadı; metni seçip kopyalayın."; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(metin).then(function () { bitti(true); }, function () { bitti(false); });
      } else { bitti(false); }
    }
  });

  calistir();
})();
