/*!
 * Finansal Özgürlük (FIRE) — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Simülasyon
 * hesap.js'te, ağır çözücüler isci.js (Web Worker) içinde.
 *
 * İŞ BÖLÜMÜ ÖLÇÜMLE BELİRLENDİ:
 *   tek simülasyon (2000 yol) .....   66 ms  → ana iş parçacığı, anında
 *   guvenliCekim (~40 simülasyon)  . 1476 ms → Web Worker
 * Worker "mimari olsun diye" değil, ölçüm gerektirdiği için var.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var F = window.FIRE;
  if (!F) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  var yuzde1 = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 1, maximumFractionDigits: 1
  });
  function para(n) { return para0.format(n || 0); }
  function deger(id) { return F.sayi($(id).value); }

  function girdiTopla() {
    return {
      baslangic: deger("f-baslangic"),
      aylikKatki: deger("f-katki"),
      aylikCekim: deger("f-cekim"),
      emeklilikYili: deger("f-yil"),
      emeklilikSuresi: deger("f-sure"),
      getiriOrtYuzde: deger("f-getiri"),
      getiriSapmaYuzde: deger("f-getiri-sapma"),
      enflasyonOrtYuzde: deger("f-enflasyon"),
      enflasyonSapmaYuzde: deger("f-enflasyon-sapma"),
      korelasyon: deger("f-korelasyon"),
      dagilim: $("f-dagilim").value,
      yolSayisi: F.sayi($("f-yol").value)
    };
  }

  /* ------------------------------------------------------------------ *
   * Yelpaze grafiği — saf SVG, kütüphane yok.
   * İki bant: p10–p90 (açık) ve p25–p75 (koyu), üstünde ortanca çizgi.
   * ------------------------------------------------------------------ */
  function grafikCiz(bantlar) {
    var svg = $("f-grafik");
    if (!svg || !bantlar.length) return;
    var W = 720, H = 300, sol = 8, sag = 8, ust = 12, alt = 26;
    var gw = W - sol - sag, gh = H - ust - alt;

    var enBuyuk = 0;
    bantlar.forEach(function (b) { if (b.p90 > enBuyuk) enBuyuk = b.p90; });
    if (enBuyuk <= 0) enBuyuk = 1;

    function x(i) { return sol + (gw * i) / Math.max(1, bantlar.length - 1); }
    /* DİKEY EKSEN KAREKÖK ÖLÇEKLİ.
       Doğrusal ölçekte p90 bandı (yağlı kuyruk + bileşik getiri yüzünden)
       o kadar yükseğe çıkıyor ki ortanca çizgi tabana yapışıyor ve grafik
       asıl bilgiyi gizliyor. Karekök sıralamayı ve sıfırı korur, büyük
       değerleri sıkıştırır. Kesme yapmıyoruz — hiçbir senaryo gizlenmiyor;
       ölçek grafiğin altında açıkça yazılı. */
    function y(v) {
      var t = Math.sqrt(Math.max(0, v) / enBuyuk);
      return ust + gh - gh * t;
    }

    function alan(altAd, ustAd) {
      var ileri = bantlar.map(function (b, i) { return x(i) + "," + y(b[ustAd]); });
      var geri = bantlar.slice().reverse().map(function (b, i) {
        return x(bantlar.length - 1 - i) + "," + y(b[altAd]);
      });
      return "M" + ileri.concat(geri).join(" L") + " Z";
    }
    var cizgi = "M" + bantlar.map(function (b, i) { return x(i) + "," + y(b.p50); }).join(" L");

    /* Emeklilik yılı için dikey ayraç — yelpazenin kırıldığı yer orası. */
    var g = girdiTopla();
    var kirilma = Math.min(bantlar.length - 1, Math.max(0, Math.round(g.emeklilikYili) - 1));

    svg.innerHTML =
      '<path d="' + alan("p10", "p90") + '" class="bant-genis"/>' +
      '<path d="' + alan("p25", "p75") + '" class="bant-dar"/>' +
      '<path d="' + cizgi + '" class="ortanca" fill="none"/>' +
      (g.emeklilikYili > 0 && g.emeklilikYili < bantlar.length
        ? '<line class="kirilma" x1="' + x(kirilma) + '" y1="' + ust +
          '" x2="' + x(kirilma) + '" y2="' + (ust + gh) + '"/>' +
          '<text class="eksen" x="' + (x(kirilma) + 5) + '" y="' + (ust + 12) +
          '">bırakma</text>'
        : "") +
      '<line class="eksen-cizgi" x1="' + sol + '" y1="' + (ust + gh) +
      '" x2="' + (W - sag) + '" y2="' + (ust + gh) + '"/>' +
      '<text class="eksen" x="' + sol + '" y="' + (H - 8) + '">1. yıl</text>' +
      '<text class="eksen" x="' + (W - sag) + '" y="' + (H - 8) +
      '" text-anchor="end">' + bantlar.length + ". yıl</text>" +
      '<text class="eksen" x="' + sol + '" y="' + (ust + 10) + '">' +
      para(enBuyuk) + "</text>";
  }

  /* ------------------------------------------------------------------ *
   * Ağır çözücüler için Worker
   * ------------------------------------------------------------------ */
  var isci = null, isSayaci = 0, bekleyen = {};
  function isciKur() {
    if (isci || typeof Worker === "undefined") return;
    try {
      isci = new Worker("isci.js");
      isci.onmessage = function (e) {
        var d = e.data || {};
        var cb = bekleyen[d.id];
        if (cb) { delete bekleyen[d.id]; cb(d.hata ? null : d.sonuc); }
      };
      isci.onerror = function () { isci = null; };   // sessizce ana iş parçacığına düş
    } catch (_) { isci = null; }
  }

  /* Worker yoksa (eski tarayıcı, dosya protokolü) hesap ana iş
     parçacığında yapılır: yavaş ama ÇALIŞIR. Sessizce boş bırakmak
     kullanıcıya "hesaplanamadı" göstermekten kötü olurdu. */
  function coz(is, girdi, hedef, geri) {
    isciKur();
    if (!isci) {
      geri(is === "guvenliCekim" ? F.guvenliCekim(girdi, hedef)
                                 : F.gerekenBirikim(girdi, hedef));
      return;
    }
    var id = ++isSayaci;
    bekleyen[id] = geri;
    isci.postMessage({ id: id, is: is, girdi: girdi, hedef: hedef });
  }

  /* ------------------------------------------------------------------ *
   * Ana akış
   * ------------------------------------------------------------------ */
  var cozZaman = 0;

  function hesapla() {
    var g = girdiTopla();
    var s = F.calistir(g);

    var oran = s.basariOrani;
    $("f-basari").textContent = "%" + yuzde1.format(oran * 100);
    $("f-kart").classList.toggle("eksi", oran < 0.75);
    $("f-basari-alt").textContent =
      s.yolSayisi.toLocaleString("tr-TR") + " senaryonun " +
      (s.yolSayisi - s.basarisiz).toLocaleString("tr-TR") + " tanesinde birikim, " +
      "alım gücünü koruyan çekimi sonuna kadar karşıladı." +
      (s.basarisiz ? " Tutmayan senaryolarda birikim ortanca " +
        Math.round(s.medyanTukenmeYili) + ". yılda tükendi." : "");

    var birakma = Math.min(s.bantlar.length, Math.max(1, Math.round(g.emeklilikYili)));
    var b = s.bantlar[birakma - 1];
    $("f-emeklilikte").textContent = b ? para(b.p50) : "—";
    $("f-p10").textContent = para(s.sonReelP10);
    $("f-p90").textContent = para(s.sonReelP90);

    grafikCiz(s.bantlar);

    var satirlar = [];
    for (var i = 4; i < s.bantlar.length; i += 5) {
      var r = s.bantlar[i];
      satirlar.push("<tr><th scope=\"row\">" + r.yil + "</th><td>" + para(r.p10) +
        "</td><td>" + para(r.p50) + "</td><td>" + para(r.p90) + "</td></tr>");
    }
    var son = s.bantlar[s.bantlar.length - 1];
    if (son && son.yil % 5 !== 0) {
      satirlar.push("<tr><th scope=\"row\">" + son.yil + "</th><td>" + para(son.p10) +
        "</td><td>" + para(son.p50) + "</td><td>" + para(son.p90) + "</td></tr>");
    }
    $("f-tablo").innerHTML = satirlar.join("");

    var uyari = "";
    if (oran < 0.5) {
      uyari = "Bu plan senaryoların yarısından fazlasında tutmuyor. Çekimi düşürmek, " +
              "süreyi uzatmak ya da katkıyı artırmak gerekiyor.";
    } else if (oran < 0.75) {
      uyari = "Başarı olasılığı düşük. Planlamada genellikle %85–95 aralığı hedeflenir.";
    }
    if (g.enflasyonOrtYuzde >= g.getiriOrtYuzde) {
      uyari += (uyari ? " " : "") + "Beklenen getiriniz enflasyonun altında ya da ona " +
               "eşit: reel getiri pozitif değil, birikim alım gücü olarak erir.";
    }
    $("f-uyari").hidden = !uyari;
    $("f-uyari").textContent = uyari;

    /* Çözücüler pahalı; yazma bitince Worker'a gönderiliyor. */
    $("f-guvenli").textContent = "hesaplanıyor…";
    $("f-gereken").textContent = "hesaplanıyor…";
    clearTimeout(cozZaman);
    cozZaman = setTimeout(function () {
      var hafif = {}; for (var k in g) hafif[k] = g[k];
      hafif.yolSayisi = Math.min(1000, g.yolSayisi);   // çözücüde 1000 yol yeter
      coz("guvenliCekim", hafif, 0.90, function (r) {
        $("f-guvenli").textContent = (r && r.bulundu) ? para(r.aylik) : "yok";
      });
      coz("gerekenBirikim", hafif, 0.90, function (r) {
        $("f-gereken").textContent = (r && r.bulundu) ? para(r.tutar) : "—";
      });
    }, 250);
  }

  document.querySelectorAll("#hesapla input, #hesapla select").forEach(function (el) {
    el.addEventListener("input", hesapla);
    el.addEventListener("change", hesapla);
  });
  hesapla();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
