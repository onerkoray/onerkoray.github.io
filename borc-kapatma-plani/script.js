/* Borç Kapatma Planı — arayüz katmanı.
   Faiz tavanları ve asgari oranlar ../bordro/borc-parametreleri.js,
   simülasyon ../bordro/borc-motor.js içindedir. Bu dosya formu okur,
   satırları yönetir ve sonucu çizer. Parametre kopyası tutulmaz. */
(function () {
  "use strict";
  var M = window.BorcMotor, P = window.BORC_PARAMETRELERI;
  if (!M || !P) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function say(v) {
    var h = String(v == null ? "" : v).trim().replace(/\s/g, "");
    if (h === "") return NaN;
    if (h.indexOf(",") >= 0) h = h.replace(/\./g, "").replace(",", ".");
    else { var p = h.split("."); if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) h = p.join(""); }
    var n = parseFloat(h); return isFinite(n) ? n : NaN;
  }
  /* Ay sayısını takvime çevirir: "14 ay (Kasım 2027)" */
  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tarih(ay) {
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + ay);
    return AYLAR[d.getMonth()] + " " + d.getFullYear();
  }

  /* ---------------------------------------------------------- satır yönetimi */
  var VARSAYILAN = [
    { ad: "Kredi kartı", bakiye: "45000", faiz: "", tur: "kart", ek: "20" },
    { ad: "İhtiyaç kredisi", bakiye: "80000", faiz: "2,9", tur: "taksit", ek: "3500" }
  ];
  var sayac = 0;

  function satirEkle(v) {
    v = v || { ad: "Yeni borç", bakiye: "", faiz: "", tur: "kart", ek: "20" };
    var id = ++sayac;
    var tr = document.createElement("tr");
    tr.className = "bp-satir";
    tr.innerHTML =
      '<td data-l="Borç adı"><input type="text" class="bp-ad" value="' + esc(v.ad) + '" aria-label="Borç adı"></td>' +
      '<td data-l="Bakiye"><input type="text" inputmode="decimal" class="bp-bakiye" value="' + esc(v.bakiye) + '" aria-label="Bakiye"></td>' +
      '<td data-l="Aylık faiz"><input type="text" inputmode="decimal" class="bp-faiz" value="' + esc(v.faiz) + '" placeholder="TCMB" aria-label="Aylık faiz yüzdesi"></td>' +
      '<td data-l="Tür"><select class="bp-tur" aria-label="Borç türü">' +
        '<option value="kart"' + (v.tur === "kart" ? " selected" : "") + '>Kredi kartı</option>' +
        '<option value="taksit"' + (v.tur === "taksit" ? " selected" : "") + '>Taksitli kredi</option>' +
      "</select></td>" +
      '<td data-l="Asgari / Taksit"><input type="text" inputmode="decimal" class="bp-ek" value="' + esc(v.ek) + '" aria-label="Asgari oran veya taksit tutarı"><span class="bp-birim"></span></td>' +
      '<td><button type="button" class="bp-sil" aria-label="Bu borcu sil">×</button></td>';
    el("borc-govde").appendChild(tr);
    birimTazele(tr);
    return tr;
  }

  /* Tür değişince beşinci sütunun anlamı değişiyor: kartta yüzde, kredide TL. */
  function birimTazele(tr) {
    var tur = tr.querySelector(".bp-tur").value;
    tr.querySelector(".bp-birim").textContent = tur === "kart" ? "%" : "TL";
    tr.querySelector(".bp-ek").title = tur === "kart"
      ? "Asgari ödeme oranı (BDDK: limit ≤50.000 TL ise %20, üzerinde %40)"
      : "Aylık sabit taksit tutarı";
  }

  function borclariOku() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll(".bp-satir"), function (tr) {
      var bakiye = say(tr.querySelector(".bp-bakiye").value);
      if (!(bakiye > 0)) return;
      var tur = tr.querySelector(".bp-tur").value;
      var faizY = say(tr.querySelector(".bp-faiz").value);
      /* Faiz boşsa TCMB'nin o bakiye dilimi için tavanı varsayılır ve
         alan bilgilendirici bir yer tutucu gösterir. */
      var faiz = isFinite(faizY) ? faizY / 100 : P.kartTavani(bakiye).akdi;
      var ek = say(tr.querySelector(".bp-ek").value);
      out.push({
        ad: (tr.querySelector(".bp-ad").value || "Borç").slice(0, 40),
        bakiye: bakiye, faiz: faiz, tur: tur,
        asgariOran: tur === "kart" ? (isFinite(ek) ? ek / 100 : 0.20) : 0.20,
        /* Yuzde tabanli asgari matematiksel olarak sifirlanmaz: her ay
           kalanin %20'si odendiginde bakiye asimptotik olarak sifira
           yaklasir ve simulasyon onlarca ay suren anlamsiz bir kuyruk
           uretir. Gercek kartlarda asgari tutarin bir TABANI vardir;
           burada 100 TL varsayiliyor ve kuyruk boylece kapaniyor. */
        asgariTaban: tur === "kart" ? 100 : 0,
        taksit: tur === "taksit" ? (isFinite(ek) ? ek : 0) : 0
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ grafik */
  /* Üç strateji = üç seri, zaman içinde bakiye. Çizgi doğru form.
     Renkler dataviz doğrulayıcısından iki temada da tam PASS
     (tüm çiftler: CVD ΔE ≥ 13). Marka yeşili kategorik seri olarak
     kullanılmadı — kroma tabanının altında kalıyor. */
  function grafik(p) {
    var seriler = [
      { ad: "Asgari ödeme", s: p.asgari.seri, k: 1 },
      { ad: "Çığ", s: p.cig.seri, k: 2 },
      { ad: "Kartopu", s: p.kartopu.seri, k: 3 }
    ].filter(function (x) { return x.s && x.s.length; });
    if (!seriler.length) return "";

    var G = 620, Y = 200, sol = 8, sag = 8, ust = 12, alt = 26;
    var maxAy = Math.max.apply(null, seriler.map(function (x) { return x.s.length; }));
    var maxB = Math.max.apply(null, seriler.map(function (x) { return Math.max.apply(null, x.s); }));
    /* Asgari senaryosu 80 ayı bulabiliyor; eksen ona göre ölçekleniyor
       çünkü sıkışan diğer iki seri zaten "çok daha kısa" mesajını veriyor. */
    if (!(maxAy > 1) || !(maxB > 0)) return "";
    /* Ayni yolu izleyen seriler ust uste biner ve ustteki digerini
       tamamen gizler; grafik "bir seri cizilmemis" gibi gorunur. Ayniyi
       tespit edip lejantta birlestiriyoruz. */
    function ayniMi(a, b) {
      return a.length === b.length && a.every(function (v, i) { return Math.abs(v - b[i]) < 0.5; });
    }
    var ortusen = seriler.length === 3 && ayniMi(seriler[1].s, seriler[2].s);
    if (ortusen) {
      seriler[1].ad = "Çığ ve Kartopu (aynı yol)";
      seriler.splice(2, 1);
    }

    var icG = G - sol - sag, icY = Y - ust - alt;
    function X(i) { return sol + icG * (i / (maxAy - 1)); }
    function Yk(v) { return ust + icY * (1 - v / maxB); }

    var yollar = seriler.map(function (x) {
      var d = x.s.map(function (v, i) {
        return (i === 0 ? "M" : "L") + X(i).toFixed(1) + " " + Yk(v).toFixed(1);
      }).join(" ");
      return '<path class="bp-cizgi bp-seri-' + x.k + '" d="' + d + '"/>';
    }).join("");

    var izgara = [0.5, 1].map(function (f) {
      return '<line x1="' + sol + '" y1="' + Yk(maxB * f).toFixed(1) +
        '" x2="' + (G - sag) + '" y2="' + Yk(maxB * f).toFixed(1) + '"/>';
    }).join("");

    var lejant = seriler.map(function (x) {
      return '<span class="bp-lejant-oge"><span class="bp-nokta bp-seri-' + x.k +
        '" aria-hidden="true"></span>' + esc(x.ad) + "</span>";
    }).join("");

    var desc = seriler.map(function (x) {
      return x.ad + " " + x.s.length + " ayda bitiyor";
    }).join("; ");

    return '<figure class="bp-grafik-kutu">' +
      "<figcaption>Toplam borcun aya göre seyri</figcaption>" +
      '<svg class="bp-grafik" viewBox="0 0 ' + G + " " + Y + '" role="img" aria-label="' +
      esc(desc) + '">' +
      '<g class="bp-izgara">' + izgara + "</g>" + yollar +
      '<text x="' + sol + '" y="' + (Y - 6) + '" class="bp-eksen">bugün</text>' +
      '<text x="' + (G - sag) + '" y="' + (Y - 6) + '" text-anchor="end" class="bp-eksen">' +
      maxAy + ". ay</text>" +
      "</svg>" +
      '<div class="bp-lejant">' + lejant + "</div></figure>";
  }

  /* ----------------------------------------------------------------- sonuçlar */
  function stratejiKarti(s, ad, aciklama, kazanan) {
    var sure = s.kapandi
      ? '<p class="bp-tutar">' + s.ay + ' ay</p><p class="bp-alt">' + tarih(s.ay) + "</p>"
      : '<p class="bp-tutar bp-asla">Kapanmıyor</p><p class="bp-alt">Bu bütçeyle bitmiyor</p>';
    return '<div class="bp-strateji' + (kazanan ? " bp-kazanan" : "") + '">' +
      '<p class="bp-strateji-ad">' + esc(ad) +
      (kazanan ? ' <span class="bp-rozet">en az faiz</span>' : "") + "</p>" +
      sure +
      '<dl class="bp-dokum">' +
      "<div><dt>Toplam faiz</dt><dd>" + fmt(s.faizToplam) + " TL</dd></div>" +
      "<div><dt>Toplam ödeme</dt><dd>" + fmt(s.odemeToplam) + " TL</dd></div>" +
      "</dl>" +
      '<p class="bp-aciklama">' + esc(aciklama) + "</p></div>";
  }

  function recalc() {
    var results = el("results"), msg = el("msg");
    if (!results) return;
    var borclar = borclariOku();
    var butce = say(el("in-butce").value);

    if (!borclar.length) {
      results.innerHTML = ""; msg.hidden = false;
      msg.textContent = "Bakiyesi sıfırdan büyük en az bir borç girin."; return;
    }
    var p = M.planla(borclar, butce);
    if (p.hata) {
      results.innerHTML = ""; msg.hidden = false;
      msg.textContent = p.mesaj || p.hata; return;
    }
    msg.hidden = true;

    var enIyi = p.enIyi === "kartopu" ? p.kartopu : p.cig;
    var enIyiAd = p.enIyi === "kartopu" ? "Kartopu" : "Çığ";

    var hero = enIyi.kapandi
      ? '<div class="bp-hero"><p class="bp-hero-etiket">Borçsuz olma tarihi</p>' +
        '<p class="bp-hero-deger">' + tarih(enIyi.ay) + "</p>" +
        '<p class="bp-hero-not">' + enIyiAd + " yöntemiyle " + enIyi.ay +
        " ayda · toplam " + fmt(enIyi.faizToplam) + " TL faiz</p></div>"
      : "";

    var tasarruf = (p.tasarruf != null && p.tasarruf > 0)
      ? '<div class="bp-tasarruf"><p class="bp-tasarruf-etiket">Sadece asgari ödemeye kıyasla</p>' +
        '<p class="bp-tasarruf-deger">' + fmt(p.tasarruf) + " TL</p>" +
        '<p class="bp-tasarruf-not">daha az faiz · ' +
        (p.asgari.kapandi ? (p.asgari.ay - enIyi.ay) + " ay daha erken" : "ve borç gerçekten bitiyor") +
        "</p></div>"
      : "";

    var kartlar = '<div class="bp-stratejiler">' +
      stratejiKarti(p.asgari, "Sadece asgari", "Artan parayı borca koymazsanız.", false) +
      stratejiKarti(p.cig, "Çığ", "Artan para en yüksek faizli borca.", p.enIyi === "cig") +
      stratejiKarti(p.kartopu, "Kartopu", "Artan para en küçük bakiyeli borca.", p.enIyi === "kartopu") +
      "</div>";

    var fark = (p.kartopuFarki != null)
      ? '<p class="bp-fark">Kartopu yöntemi, çığa göre <strong>' + fmt(Math.abs(p.kartopuFarki)) +
        " TL</strong> " + (p.kartopuFarki > 0 ? "daha fazla" : "daha az") +
        " faiz ödetiyor. " + (Math.abs(p.kartopuFarki) < 2000
          ? "Fark küçük — ilk kapanışı öne çekmek için kartopunu seçmek makul."
          : "Fark belirgin — kartopunu seçecekseniz bunu bilerek seçin.") + "</p>"
      : "";

    var sira = enIyi.kapandi && enIyi.takvim.length
      ? '<div class="bp-takvim"><p class="bp-takvim-bas">' + enIyiAd + " sırası — hangi borç ne zaman kapanıyor</p><ol>" +
        enIyi.takvim.map(function (t, i) {
          return "<li><span class=\"bp-sira-no\">" + (i + 1) + "</span>" +
            "<span class=\"bp-sira-ad\">" + esc(t.ad) + "</span>" +
            "<span class=\"bp-sira-ay\">" + t.ay + ". ay · " + tarih(t.ay) + "</span></li>";
        }).join("") + "</ol></div>"
      : "";

    var uyari = "";
    if (p.asgari.buyuyenler.length) {
      uyari = '<p class="bp-uyari"><strong>Asgari ödeme tuzağı:</strong> ' +
        esc(p.asgari.buyuyenler.join(", ")) +
        " için asgari ödeme aylık faizi karşılamıyor. Yalnızca asgari ödediğinizde " +
        "bu borcun bakiyesi <strong>her ay büyür</strong> ve borç hiç kapanmaz.</p>";
    }

    results.innerHTML = hero + tasarruf + kartlar + fark + grafik(p) + sira + uyari;
  }

  /* -------------------------------------------------------------------- bağla */
  var govde = el("borc-govde");
  VARSAYILAN.forEach(satirEkle);

  el("ekle").addEventListener("click", function () {
    if (document.querySelectorAll(".bp-satir").length >= 8) return;
    satirEkle(); recalc();
  });
  govde.addEventListener("click", function (e) {
    if (!e.target.classList.contains("bp-sil")) return;
    if (document.querySelectorAll(".bp-satir").length <= 1) return;
    e.target.closest("tr").remove(); recalc();
  });
  govde.addEventListener("change", function (e) {
    if (e.target.classList.contains("bp-tur")) birimTazele(e.target.closest("tr"));
    recalc();
  });
  govde.addEventListener("input", recalc);
  el("in-butce").addEventListener("input", recalc);
  el("borc-form").addEventListener("submit", function (e) { e.preventDefault(); });

  recalc();
})();
