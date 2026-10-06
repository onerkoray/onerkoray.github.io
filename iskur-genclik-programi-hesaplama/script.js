/* İŞKUR GÜÇ programları — sayfa katmanı.
   Hesap yapmaz: formu okur, IskurGuc çekirdeğine (hesap.js) verir, sonucu
   çizer. Renkler --dv-* tokenlarından (style.css). */
(function () {
  "use strict";
  var I = window.IskurGuc;
  var form = document.getElementById("ig-form");
  if (!I || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(v) { return nf.format(Math.round(v)) + " TL"; }
  function tl2(v) { return nf2.format(v) + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AYK = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function tarih(s) { var p = s.split("-"); return +p[2] + " " + AY[+p[1] - 1] + " " + p[0]; }

  var program = "genclik";
  document.querySelectorAll("[data-program]").forEach(function (b) {
    b.addEventListener("click", function () {
      program = b.getAttribute("data-program");
      document.querySelectorAll("[data-program]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      alanlar(); hesapla();
    });
  });
  function alanlar() {
    document.querySelectorAll("[data-genclik]").forEach(function (x) { x.hidden = program !== "genclik"; });
  }

  function grafik(t) {
    var kutu = $("o-grafik");
    var W = Math.max(300, Math.min(600, Math.round(kutu.clientWidth || 520)));
    var SOL = 44, SAG = W - 6, UST = 22, ALT = 168, H = 196;
    var enCok = Math.max(t.enYuksekAy, 19250);
    var tavan = Math.ceil(enCok / 5000) * 5000;
    function y(v) { return ALT - v / tavan * (ALT - UST); }
    var n = t.aylar.length, gen = (SAG - SOL) / n, w = Math.min(34, gen * 0.62);
    var p = ['<svg class="ig-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="ig-g-t ig-g-d">',
      '<title id="ig-g-t">Ay ay cep harçlığı</title>',
      '<desc id="ig-g-d">' + esc(t.aylar.map(function (a) { return AY[+a.ay.slice(5) - 1] + " " + a.ay.slice(0, 4) + ": " + a.gun + " gün, " + tl(a.tutar); }).join("; ")) + "</desc>"];
    for (var v = 0; v <= tavan; v += 5000) {
      p.push('<path class="ig-izgara" d="M' + SOL + " " + y(v).toFixed(1) + " H" + SAG + '"/>');
      p.push('<text class="ig-eksen" x="' + (SOL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v / 1000) + (v ? " bin" : "") + "</text>");
    }
    p.push('<path class="ig-referans" d="M' + SOL + " " + y(19250).toFixed(1) + " H" + SAG + '"/>');
    t.aylar.forEach(function (a, i) {
      var cx = SOL + gen * (i + 0.5);
      p.push('<rect class="' + (a.varsayim ? "ig-cubuk ig-varsayim" : "ig-cubuk") + '" x="' + (cx - w / 2).toFixed(1) + '" y="' + y(a.tutar).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (ALT - y(a.tutar)).toFixed(1) + '" rx="2"><title>' + esc(AY[+a.ay.slice(5) - 1] + " " + a.ay.slice(0, 4) + ": " + a.gun + " gün, " + tl(a.tutar)) + "</title></rect>");
      p.push('<text class="ig-eksen" x="' + cx.toFixed(1) + '" y="' + (ALT + 14) + '" text-anchor="middle">' + AYK[+a.ay.slice(5) - 1] + "</text>");
      p.push('<text class="ig-gun" x="' + cx.toFixed(1) + '" y="' + (ALT + 26) + '" text-anchor="middle">' + a.gun + "</text>");
    });
    p.push("</svg>");
    kutu.innerHTML = p.join("");
  }

  function hesapla() {
    var hata = $("i-hata"), kutu = $("ig-sonuc"), t, h;
    try {
      t = I.takvim({ program: program, baslangic: $("i-bas").value, haftalikGun: +$("i-gun").value, oncekiGun: sayi($("i-once")) });
      var yil = +$("i-bas").value.slice(0, 4), ay = +$("i-bas").value.slice(5, 7);
      h = I.haneUygun(program, sayi($("i-hane")), yil, ay, $("i-yurt").value === "evet");
    } catch (e) { hata.textContent = e.message; kutu.classList.add("ig-bayat"); return; }
    hata.textContent = ""; kutu.classList.remove("ig-bayat");

    var rozet = $("o-rozet");
    if (h.uygun === false) { rozet.textContent = "Hane geliri sınırı aşılıyor"; rozet.className = "ig-rozet ig-kotu"; }
    else { rozet.textContent = h.toplu ? "Hane şartı aranmaz" : "Hane şartı sağlanıyor"; rozet.className = "ig-rozet ig-iyi"; }

    $("o-toplam").textContent = tl(t.toplam);
    $("o-alt").textContent = nf.format(t.toplamGun) + " katılım günü × " + tl(t.gunluk) + " · " + (t.sinirDoldu ? "140 gün sınırının dolduğu gün: " + tarih(t.sinirDoldu) : "programın son günü: " + tarih(t.bitis));
    grafik(t);

    var k = [];
    function satir(dt, dd, s) { k.push("<div" + (s ? ' class="' + s + '"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"); }
    var ilk = t.aylar[0];
    satir("İlk ay (" + esc(AY[+ilk.ay.slice(5) - 1]) + ")", tl(ilk.tutar) + ' <span class="ig-kucuk">' + ilk.gun + " gün</span>");
    satir("En yüksek ay", tl(t.enYuksekAy));
    satir("Saat başına", tl2(t.saatlik) + ' <span class="ig-kucuk">günde 7,5 saat</span>');
    satir("Kalan İUP hakkı", nf.format(t.kalanHak) + " gün");
    satir("Hane geliri sınırı", h.sinir ? tl2(h.sinir) : "—");
    satir("Emeklilik prim gününe eklenen", "0 gün", "ig-ana");
    $("o-kalemler").innerHTML = k.join("");
    $("o-not").textContent = (t.tutarVarsayimi ? "2027 günleri, 2027 tutarı açıklanana kadar 2026'nın 1.375 TL'siyle gösterildi (açık renkli sütunlar). " : "") +
      "Sigorta: iş kazası, meslek hastalığı ve genel sağlık; primi İŞKUR öder (5510 s.K. m.5/1-e).";
  }

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  var genislik = 0;
  window.addEventListener("resize", function () {
    var w = $("o-grafik").clientWidth;
    if (Math.abs(w - genislik) > 24) { genislik = w; clearTimeout(zaman); zaman = setTimeout(hesapla, 150); }
  });
  alanlar();
  hesapla();
})();
