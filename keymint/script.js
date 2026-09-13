/* KeyMint şifre üreteci — arayüz.
 *
 * BU DOSYADA HESAP YOK. Rastgelelik, entropi ve kırılma süresi
 * keymint/sifre-motoru.js'te; burada yalnızca alanların okunması ve
 * sonucun yazılması var. Ayrım, motorun Node'da test edilebilmesi için:
 * bir parola üretecinde hatalar sessizdir ve ekrana bakarak görülmez.
 */
(function () {
  "use strict";
  var M = window.SifreMotoru;
  if (!M) return;

  function el(id) { return document.getElementById(id); }

  function secim() {
    return {
      uzunluk: parseInt(el("length").value, 10),
      buyuk: el("uppercase").checked,
      kucuk: el("lowercase").checked,
      rakam: el("numbers").checked,
      sembol: el("symbols").checked,
      karisanlariCikar: el("noAmbiguous").checked,
      herSiniftanBir: el("herSinif").checked
    };
  }

  function sayi(x, basamak) {
    return x.toLocaleString("tr-TR", {
      minimumFractionDigits: basamak === undefined ? 1 : basamak,
      maximumFractionDigits: basamak === undefined ? 1 : basamak
    });
  }

  function olcerYaz(bit) {
    var s = M.seviye(bit);
    var bar = el("meterBar"), etiket = el("strength");
    bar.style.width = s.yuzde + "%";
    bar.className = "meter-bar s-" + s.sinif;
    /* Seviye HER ZAMAN yazıyla da söyleniyor: renk tek başına anlam
       taşırsa renk körü bir ziyaretçi için gösterge boş kalır. */
    etiket.textContent = s.ad + " · ~" + Math.round(bit) + " bit entropi";
    etiket.className = "strength-label s-" + s.sinif;
  }

  function olcerSifirla(mesaj) {
    el("meterBar").style.width = "0";
    el("meterBar").className = "meter-bar";
    el("strength").textContent = mesaj;
    el("strength").className = "strength-label";
    el("entropi").innerHTML = "";
    el("sureler").innerHTML = "";
  }

  function entropiYaz(e, s) {
    var kutu = el("entropi");
    var parca = [
      ["Havuz", e.havuz + " karakter",
        "Seçili türlerin toplam karakter sayısı" +
        (s.karisanlariCikar ? "; karışanlar çıkarıldı" : "")],
      ["Uzunluk", s.uzunluk + " karakter", "Her karakter havuzdan bağımsız seçiliyor"],
      ["Entropi", sayi(e.bit) + " bit",
        "log₂(olası parola sayısı) — üretecin ölçüsü, parolanın değil"]
    ];
    if (e.duzeltme < 0) {
      /* AÇIKÇA YAZILIYOR: sınıf garantisi entropiyi DÜŞÜRÜR. Çoğu araç bu
         kuralı bir güvenlik artışı gibi sunar; aritmetik tersini söylüyor. */
      parca.push(["Garantinin bedeli", sayi(e.duzeltme, 2) + " bit",
        "“Her türden en az bir karakter” kuralı örnek uzayını daraltıyor, " +
        "yani entropiyi artırmıyor — azaltıyor"]);
    }
    kutu.innerHTML = parca.map(function (p) {
      return '<div><dt>' + esc(p[0]) + '</dt><dd><b>' + esc(p[1]) +
        '</b><span>' + esc(p[2]) + '</span></dd></div>';
    }).join("");
  }

  function sureYaz(bit) {
    var satir = M.tumSureler(bit).map(function (s) {
      return '<tr><th scope="row">' + esc(s.ad) +
        '<small>' + esc(s.aciklama) + '</small></th>' +
        '<td>' + esc(M.sureMetni(s.saniye)) + '</td></tr>';
    }).join("");
    el("sureler").innerHTML =
      '<table class="sure-tablo">' +
      '<caption>Ortalama kırılma süresi — varsayım, ölçüm değil</caption>' +
      '<tbody>' + satir + '</tbody></table>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function durum(mesaj) {
    var d = el("status");
    if (d) d.textContent = mesaj || "";
  }

  function uret() {
    var s = secim();
    var r = M.uret(s);
    if (r.hata) {
      el("password").value = "";
      olcerSifirla("—");
      durum(r.hata);
      return;
    }
    el("password").value = r.parola;
    olcerYaz(r.bit);
    entropiYaz(r.entropi, s);
    sureYaz(r.bit);
    durum("");
  }

  /* Ayar değişince parola ÜRETİLMİYOR, yalnızca ölçüler tazeleniyor:
     kullanıcı kopyalamak üzereyken kutunun altından parolayı çekmek
     sinir bozucu ve veri kaybettirici. */
  function onizle() {
    var s = secim();
    var e = M.entropi(s);
    if (!e.havuz) { olcerSifirla("En az bir karakter türü seçin"); return; }
    if (s.herSiniftanBir && M.kumeler(s).length > s.uzunluk) {
      olcerSifirla("Uzunluk, seçili tür sayısından küçük");
      return;
    }
    olcerYaz(e.bit);
    entropiYaz(e, s);
    sureYaz(e.bit);
  }

  /* ------------------------------------------------------------ bağlama */
  var uzunluk = el("length");
  uzunluk.addEventListener("input", function () {
    el("lengthValue").textContent = uzunluk.value;
    onizle();
  });

  ["uppercase", "lowercase", "numbers", "symbols", "noAmbiguous", "herSinif"]
    .forEach(function (id) {
      var k = el(id);
      if (k) k.addEventListener("change", onizle);
    });

  el("generateBtn").addEventListener("click", uret);

  el("copyBtn").addEventListener("click", function () {
    var v = el("password").value;
    if (!v) { durum("Önce bir şifre üretin."); return; }
    if (!navigator.clipboard) { durum("Tarayıcı kopyalamayı desteklemiyor."); return; }
    navigator.clipboard.writeText(v).then(function () {
      durum("Kopyalandı. Pano geçmişini tutan araçlar varsa dikkat edin.");
    }, function () {
      durum("Kopyalanamadı; metni elle seçebilirsiniz.");
    });
  });

  el("lengthValue").textContent = uzunluk.value;
  uret();
})();
