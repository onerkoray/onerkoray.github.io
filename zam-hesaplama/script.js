/*!
 * Zam Hesaplama — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir bordro formülü içermez. Hesap
 * hesap.js'te, bordronun kendisi bordro/motor.js'te — ikisi de testlerle
 * korunuyor.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var Z = window.ZAM;
  if (!Z) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  var yuzde2 = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 1, maximumFractionDigits: 1
  });
  function para(n) { return para0.format(n || 0); }
  function pct(n) { return "%" + yuzde2.format(n || 0); }
  function deger(id) { return Z.sayi($(id).value); }

  function uyari(el, metin) {
    el.hidden = !metin;
    el.textContent = metin || "";
  }

  /* Yıl seçenekleri motorun desteklediği yıllardan geliyor; sayfa
     kendi listesini tutmuyor ki yeni bir bordro yılı eklendiğinde
     burası da kendiliğinden güncellensin. */
  var yillar = Z.yillar();
  ["z-yil", "p-yil", "i-yil"].forEach(function (id) {
    var s = $(id);
    if (!s) return;
    s.innerHTML = yillar.map(function (y) {
      return '<option value="' + y + '"' + (y === Z.sonYil() ? " selected" : "") + ">" + y + "</option>";
    }).join("");
  });

  /* Bölge açıklamaları — aracın "tek kural yok" mesajı burada görünür. */
  var BOLGE = {
    "asgari-alti": "Brütünüz asgari ücretin altında. Net asgari ücret tabanı devreye " +
                   "girdiği için oranlar bu bölgede farklı davranır.",
    "normal": "Asgari ücret ile SGK tavanı arasındasınız. Net oranın brüt oranın " +
              "altında kalmasının sebebi artan oranlı tarife ve kümülatif matrah.",
    "tavan-asiyor": "Zam sizi SGK tavanının üstüne çıkarıyor. Tavanı aşan tutardan " +
                    "SGK primi kesilmediği için zammın net oranı beklenenden yüksek çıkıyor.",
    "tavan-ustu": "Maaşınız SGK tavanının üstünde. Zamdan SGK primi kesilmediği için " +
                  "net oran yükselir, brüt oranı bile geçebilir."
  };

  var sekmeler = [].slice.call(document.querySelectorAll(".sekme"));
  sekmeler.forEach(function (s) {
    s.addEventListener("click", function () {
      sekmeler.forEach(function (d) {
        var acik = d === s;
        d.classList.toggle("is-acik", acik);
        d.setAttribute("aria-selected", acik ? "true" : "false");
        $(d.getAttribute("aria-controls")).hidden = !acik;
      });
    });
  });

  /* ------------------------------------------------------------------ */
  function zamHesapla() {
    var z = Z.zam({
      eskiBrut: deger("z-eski"),
      zamYuzde: deger("z-oran"),
      zamAyi: Z.sayi($("z-ay").value),
      yil: Z.sayi($("z-yil").value)
    });

    $("z-brut-oran").textContent = yuzde2.format(z.brutArtisYuzde);
    $("z-net-oran").textContent = pct(z.netArtisYuzde);
    $("z-aciklama").textContent =
      "Brüt %" + yuzde2.format(z.brutArtisYuzde) + " zammın nete yansıması. " +
      "Aradaki fark " + yuzde2.format(z.farkPuan) + " puan.";

    $("z-yeni-brut").textContent = para(z.yeniBrut);
    $("z-aylik").textContent = para(z.eskiAylikNet) + " → " + para(z.yeniAylikNet);
    $("z-yillik").textContent = para(z.yillikNetFark);
    $("z-maliyet").textContent = para(z.isverenMaliyetiEski) + " → " + para(z.isverenMaliyetiYeni);

    var not = BOLGE[z.bolge] || "";
    if (z.zamAyi > 1) {
      not += " Zam " + z.zamAyi + ". ayda başladığı için yıllık artış, zammın tam yıl " +
             "geçerli olduğu duruma göre daha düşük; oran ise değişmez.";
    }
    uyari($("z-uyari"), not);

    $("z-tablo").innerHTML = z.aylar.map(function (a) {
      return "<tr" + (a.dilimGecisi ? ' class="gecis"' : "") + "><th scope=\"row\">" +
             a.ayAdi + (a.dilimGecisi ? " ●" : "") + "</th><td>" + para(a.brut) +
             "</td><td>" + para(a.gelirVergisi) + "</td><td>%" +
             Math.round(a.dilim * 100) + "</td><td>" + para(a.net) + "</td></tr>";
    }).join("");
  }

  /* ------------------------------------------------------------------ */
  function pazarlikHesapla() {
    var tur = $("p-tur").value;
    $("p-artis-alan").hidden = tur !== "artis";
    $("p-net-alan").hidden = tur !== "net";

    var g = {
      eskiBrut: deger("p-eski"),
      yil: Z.sayi($("p-yil").value)
    };
    if (tur === "artis") g.hedefNetArtisYuzde = deger("p-artis");
    else g.hedefAylikNet = deger("p-net");

    var s = Z.gerekliBrut(g);
    if (!s.gecerli) {
      $("p-sonuc").textContent = "—";
      $("p-aciklama").textContent = "Hedef girin.";
      ["p-brut", "p-aylik", "p-yillik", "p-maliyet"].forEach(function (id) {
        $(id).textContent = "—";
      });
      uyari($("p-uyari"), s.ulasilamaz ? "Bu hedefe ulaşılamıyor." : "");
      return;
    }

    $("p-sonuc").textContent = pct(s.gerekenZamYuzde) + " zam";
    $("p-brut").textContent = para(s.brut);
    $("p-aylik").textContent = para(s.aylikNet);
    $("p-yillik").textContent = para(s.yillikNet);
    $("p-maliyet").textContent = para(s.isverenMaliyeti);

    if (tur === "artis") {
      var hedef = deger("p-artis");
      $("p-aciklama").textContent =
        "Net gelirinizin %" + yuzde2.format(hedef) + " artması için brütte istemeniz " +
        "gereken oran. Aradaki fark " + yuzde2.format(s.gerekenZamYuzde - hedef) + " puan.";
      uyari($("p-uyari"),
        "Pazarlıkta net oran üzerinden anlaşmak yanıltıcı olabilir: brütte " +
        pct(s.gerekenZamYuzde) + " istemezseniz net hedefinize ulaşamazsınız.");
    } else {
      $("p-aciklama").textContent =
        "Hedef aylık net " + para(deger("p-net")) + " için gereken brüt zam oranı.";
      uyari($("p-uyari"),
        "Hedef yıllık toplam üzerinden çözülüyor. Kümülatif matrah yüzünden aylık " +
        "net yıl içinde düşer; ocak ayı neti hedefin üzerinde, aralık ayı altında olur.");
    }
  }

  /* ------------------------------------------------------------------ */
  function primHesapla() {
    var p = Z.prim({
      brut: deger("i-brut"),
      primBrut: deger("i-prim"),
      yil: Z.sayi($("i-yil").value)
    });

    $("i-net").textContent = para(p.enAzNet);
    $("i-aciklama").textContent = p.primBrut > 0
      ? para(p.primBrut) + " brüt primin net karşılığı — brütün " + pct(p.netOran) + "'i."
      : "Brüt prim girin.";

    uyari($("i-uyari"), p.ayFarkEdiyorMu
      ? "Bu senaryoda ay farkı var: " + para(p.ayFarki) + ". Sebep büyük ihtimalle " +
        "SGK tavanı; prim bazı aylarda tavanı aşıyor."
      : "\"Primi aralıkta alma, vergisi yüksek olur\" yaygın bir inanış ama doğru " +
        "değil. Aşağıdaki on iki satır ayrı ayrı hesaplandı ve hepsi aynı çıktı: " +
        "gelir vergisi kümülatif matrah üzerinden yıllık işliyor.");

    $("i-tablo").innerHTML = p.aylar.map(function (a) {
      return "<tr><th scope=\"row\">" + a.ayAdi + "</th><td>" + para(a.netKatki) + "</td></tr>";
    }).join("");
  }

  function bagla(secici, fn) {
    document.querySelectorAll(secici).forEach(function (el) {
      el.addEventListener("input", fn);
      el.addEventListener("change", fn);
    });
    fn();
  }

  bagla("#pan-zam input, #pan-zam select", zamHesapla);
  bagla("#pan-pazarlik input, #pan-pazarlik select", pazarlikHesapla);
  bagla("#pan-prim input, #pan-prim select", primHesapla);

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
