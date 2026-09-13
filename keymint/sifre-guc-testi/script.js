/* Şifre Güç Testi — arayüz.
 *
 * ÖNCEKİ SÜRÜMÜN HATASI DÜZELTİLDİ.
 * Eski hâl, kullanıcının YAZDIĞI parola için "uzunluk × log₂(havuz)"
 * hesaplıyordu. O formül yalnızca parola o havuzdan RASTGELE seçildiyse
 * geçerlidir. "Password123!" için 78,8 bit verip "Çok güçlü" diyordu;
 * oysa o parola saniyeler içinde kırılır.
 *
 * Artık iki sayı AYRI AYRI gösteriliyor ve hangisine bakıldığı yazılıyor:
 *   üst sınır  — "rastgele üretilmiş olsaydı" varsayımı
 *   kalıp      — bulunan kalıbı bilen bir saldırgan için kaba tahmin
 *
 * Hesabın tamamı keymint/sifre-motoru.js'te; burada yalnızca gösterim var.
 */
(function () {
  "use strict";
  var M = window.SifreMotoru;
  if (!M) return;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function sayi(x) {
    return x.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function sifirla() {
    el("meterBar").style.width = "0";
    el("meterBar").className = "meter-bar";
    el("strength").textContent = "Bir şifre yazın";
    el("strength").className = "strength-label";
    el("entropi").innerHTML = "";
    el("sureler").innerHTML = "";
    el("feedback").innerHTML = "";
  }

  function analizYaz(a) {
    var bit = a.degerlendirmeBit;
    var s = M.seviye(bit);

    el("meterBar").style.width = s.yuzde + "%";
    el("meterBar").className = "meter-bar s-" + s.sinif;
    el("strength").textContent = s.ad + " · ~" + Math.round(bit) + " bit";
    el("strength").className = "strength-label s-" + s.sinif;

    /* İKİ SAYI YAN YANA. Hangisinin değerlendirmede kullanıldığı açıkça
       yazılıyor; tek bir "güç puanı" göstermek, hangi varsayımla
       konuşulduğunu gizlerdi. */
    var kutular = [
      ["Uzunluk", a.uzunluk + " karakter", "Kullanılan havuz: " + a.havuz + " karakter"],
      ["Üst sınır", sayi(a.ustSinirBit) + " bit",
        "“Bu parola o havuzdan RASTGELE seçilmiş olsaydı.” Bir insan " +
        "seçtiyse bu varsayım yanlıştır ve gerçek güç bundan düşüktür."]
    ];
    if (a.kalipBit !== null) {
      kutular.push(["Kalıp bulundu", sayi(a.kalipBit) + " bit",
        "Aşağıdaki kalıbı bilen bir saldırgan için kaba tahmin. " +
        "Değerlendirmede bu sayı kullanıldı."]);
    } else {
      kutular.push(["Kalıp", "bulunamadı",
        "Bu araç küçük bir liste ve birkaç kalıp deniyor; gerçek bir " +
        "sözlük değil. “Bulunamadı”, “güvenli” demek değildir."]);
    }
    el("entropi").innerHTML = kutular.map(function (p) {
      return '<div><dt>' + esc(p[0]) + '</dt><dd><b>' + esc(p[1]) +
        '</b><span>' + esc(p[2]) + '</span></dd></div>';
    }).join("");

    var satir = M.tumSureler(bit).map(function (x) {
      return '<tr><th scope="row">' + esc(x.ad) +
        '<small>' + esc(x.aciklama) + '</small></th>' +
        '<td>' + esc(M.sureMetni(x.saniye)) + '</td></tr>';
    }).join("");
    el("sureler").innerHTML =
      '<table class="sure-tablo">' +
      '<caption>Ortalama kırılma süresi — ' +
      (a.kalipBit !== null ? "kalıp bilindiğinde" : "üst sınıra göre") +
      '</caption><tbody>' + satir + '</tbody></table>';

    var bulgular = a.kaliplar.map(function (k) {
      return '<li>' + esc(k.mesaj) + '</li>';
    });
    if (!bulgular.length) {
      bulgular.push('<li class="iyi">Bilinen bir kalıp bulunamadı. ' +
        'Parola gerçekten rastgele üretildiyse üst sınır geçerlidir.</li>');
    }
    if (a.uzunluk < 12) {
      bulgular.push('<li>NIST SP 800-63B kullanıcı parolaları için en az ' +
        '8 karakter şart koşuyor, 15 ve üzerini öneriyor. Uzunluk, ' +
        'karakter çeşitliliğinden daha çok iş görür.</li>');
    }
    el("feedback").innerHTML = bulgular.join("");
  }

  function calistir() {
    var pw = el("pw").value;
    if (!pw) { sifirla(); return; }
    analizYaz(M.analiz(pw));
  }

  el("pw").addEventListener("input", calistir);
  var goster = el("showPw");
  if (goster) {
    goster.addEventListener("change", function () {
      el("pw").type = goster.checked ? "text" : "password";
    });
  }

  /* Örnek düğmeleri: eski aracın neyi yanlış yaptığını göstermenin en
     hızlı yolu, o parolayı yazıp sonuca bakmak. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-ornek]"),
    function (b) {
      b.addEventListener("click", function () {
        el("pw").value = b.getAttribute("data-ornek");
        el("pw").type = "text";
        if (goster) goster.checked = true;
        calistir();
      });
    });

  sifirla();
})();
