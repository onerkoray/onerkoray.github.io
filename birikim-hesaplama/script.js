/*!
 * Birikim ve BES Hesaplama — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Bütün
 * hesap hesap.js'te, çünkü orası testlerle korunuyor. Buradaki iş girdiyi
 * okumak, çekirdeği çağırmak ve sonucu yazmak.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var B = window.BIRIKIM;
  if (!B) return;

  function $(id) { return document.getElementById(id); }

  var paraBicim = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  var paraKurus = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  var yuzdeBicim = new Intl.NumberFormat("tr-TR", {
    style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  function para(n) { return paraBicim.format(n || 0); }
  function yuzde(o) { return yuzdeBicim.format(o || 0); }

  function deger(id) { return B.sayi($(id).value); }

  function uyariGoster(el, metin) {
    if (!metin) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = metin;
  }

  /* Kuruş kesinliği aşıldığında tek ve ortak uyarı metni. Çekirdek bunu
     bayrakla bildiriyor; sessiz geçmek yanlış sayıyı doğru göstermek olurdu. */
  var HASSASIYET =
    "Tutarlar JavaScript'in kuruş kesinliğini aştı (90 trilyon TL üzeri). " +
    "Sonuçlar yaklaşık; süreyi ya da oranları düşürün.";

  /* ------------------------------------------------------------------ *
   * Sekmeler
   * ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ *
   * 1) Birikim
   * ------------------------------------------------------------------ */
  function birikimHesapla() {
    var g = {
      baslangic: deger("b-baslangic"),
      aylikKatki: deger("b-katki"),
      katkiArtisYuzde: deger("b-artis"),
      yillikGetiriYuzde: deger("b-getiri"),
      yillikEnflasyonYuzde: deger("b-enflasyon"),
      yilSayisi: deger("b-yil"),
      stopajYuzde: deger("b-stopaj")
    };
    var s = B.buyut(g);

    var reel = s.reelYillikOran;
    $("b-reel-oran").textContent = yuzde(reel);
    $("b-reel-kart").classList.toggle("eksi", reel < 0);

    /* Kısayolun ne dediğini de yazıyoruz: aracın anlattığı şey tam olarak
       bu iki sayının farkı. */
    var kisayol = (g.yillikGetiriYuzde - g.yillikEnflasyonYuzde) / 100;
    $("b-reel-aciklama").textContent = reel < 0
      ? "Getiriniz enflasyonun altında: birikiminiz büyürken satın alma gücü eriyor."
      : "Nominal %" + g.yillikGetiriYuzde.toLocaleString("tr-TR") +
        " − enflasyon %" + g.yillikEnflasyonYuzde.toLocaleString("tr-TR") +
        " çıkarması " + yuzde(kisayol) + " derdi; doğrusu " + yuzde(reel) + ".";

    $("b-toplam-katki").textContent = para(s.toplamKatki);
    $("b-toplam-getiri").textContent = para(s.toplamGetiri);
    $("b-stopaj-tutar").textContent = para(s.stopaj);
    $("b-net").textContent = para(s.netBakiye);
    $("b-reel-net").textContent = para(s.reelNetBakiye);

    var uyari = "";
    if (s.hassasiyetAsildi) uyari = HASSASIYET;
    else if (s.reelNetBakiye < s.toplamKatki && s.yillar.length)
      uyari = "Bugünün parasıyla bakıldığında yatırdığınızdan azını geri alıyorsunuz. " +
              "Nominal tutar büyüse de bu bir kayıptır.";
    uyariGoster($("b-uyari"), uyari);

    var satirlar = s.yillar.map(function (y) {
      return "<tr><th scope=\"row\">" + y.yil + "</th><td>" + para(y.katki) +
             "</td><td>" + para(y.getiri) + "</td><td>" + para(y.bakiye) +
             "</td><td>" + para(y.reelBakiye) + "</td></tr>";
    }).join("");
    $("b-tablo").innerHTML = satirlar;
  }

  /* ------------------------------------------------------------------ *
   * 2) BES
   * ------------------------------------------------------------------ */
  function besHesapla() {
    var g = {
      aylikKatki: deger("e-katki"),
      katkiArtisYuzde: deger("e-artis"),
      yas: deger("e-yas"),
      yilSayisi: deger("e-yil"),
      yillikGetiriYuzde: deger("e-getiri"),
      fonKesintiYuzde: deger("e-kesinti"),
      yillikEnflasyonYuzde: deger("e-enflasyon"),
      devletKatkiYuzde: deger("e-dk"),
      brutAsgariAylik: deger("e-asgari")
    };
    var s = B.bes(g);

    $("e-dk-toplam").textContent = para(s.toplamDevletKatkisi);
    $("e-dk-aciklama").textContent = s.emekliOlabilir
      ? "Emeklilik şartını sağlıyorsunuz: tamamına hak kazanırsınız."
      : "Emeklilik şartı 56 yaş ve en az 10 yıl. Bu planla " +
        (g.yas + g.yilSayisi) + " yaşında ve " + g.yilSayisi +
        " yıllık olacaksınız — şartı sağlamıyorsunuz.";

    $("e-kendi-katki").textContent = para(s.toplamKendiKatki);
    $("e-kendi-bakiye").textContent = para(s.kendiBakiye);
    $("e-devlet-bakiye").textContent = para(s.devletBakiye);
    $("e-brut").textContent = para(s.brutToplam);

    var uyari = "";
    if (s.hassasiyetAsildi) uyari = HASSASIYET;
    else if (s.tavanNedeniyleAlinamayan > 0)
      uyari = "Katkınızın " + para(s.tavanNedeniyleAlinamayan) +
              " tutarındaki kısmı devlet katkısı tavanının üzerinde kaldı; bu tutar için " +
              "katkı alamıyorsunuz. Tavanı aşan parayı BES dışında değerlendirmek " +
              "genellikle daha verimli olur.";
    uyariGoster($("e-tavan-uyari"), uyari);

    var adlar = {
      emeklilik: "Emeklilik hakkıyla çıkış",
      onYil: "10 yıl sonra, emekli olmadan",
      simdi: g.yilSayisi + ". yılda ayrılma"
    };
    var sira = ["emeklilik", "onYil", "simdi"];
    var satirlar = sira.map(function (k) {
      var v = s.senaryolar[k];
      if (!v) return "";
      return "<tr><th scope=\"row\">" + adlar[k] + "</th><td>" +
             yuzdeBicim.format(v.hakKazanmaOrani) + "</td><td>" +
             para(v.devletEleGecen) + "</td><td>%" + v.stopajYuzde + " · " +
             para(v.stopaj) + "</td><td><strong>" + para(v.net) + "</strong></td><td>" +
             para(v.reelNet) + "</td></tr>";
    }).join("");
    $("e-senaryo").innerHTML = satirlar;
  }

  /* ------------------------------------------------------------------ *
   * 3) Hedef
   * ------------------------------------------------------------------ */
  function hedefHesapla() {
    var g = {
      hedefTutar: deger("h-hedef"),
      hedefBugunku: $("h-tur").value === "bugunku",
      baslangic: deger("h-baslangic"),
      yilSayisi: deger("h-yil"),
      yillikGetiriYuzde: deger("h-getiri"),
      yillikEnflasyonYuzde: deger("h-enflasyon"),
      katkiArtisYuzde: deger("h-artis"),
      stopajYuzde: 0
    };
    var s = B.hedef(g);

    $("h-nominal").textContent = para(s.hedefNominal);
    $("h-ulasilan").textContent = para(s.ulasilan);

    if (s.ulasilamaz) {
      $("h-aylik").textContent = "—";
      $("h-aciklama").textContent = "Bu hedefe bu koşullarla ulaşılamıyor.";
      uyariGoster($("h-uyari"),
        "Süreyi uzatmayı ya da hedefi düşürmeyi deneyin. Getiri enflasyonun altındaysa " +
        "hedefe ulaşmak katkıyı artırmakla da çözülmeyebilir.");
      return;
    }

    $("h-aylik").textContent = para(s.gerekliAylik);
    if (s.gerekliAylik === 0) {
      $("h-aciklama").textContent =
        "Başlangıç tutarınız tek başına bu hedefe ulaşıyor; ek katkı gerekmiyor.";
    } else {
      $("h-aciklama").textContent =
        "İlk yıl için. Katkınız her yıl %" + g.katkiArtisYuzde.toLocaleString("tr-TR") +
        " artacak varsayımıyla hesaplandı.";
    }

    uyariGoster($("h-uyari"), g.hedefBugunku
      ? "Hedefiniz bugünün parasıyla verildi; " + g.yilSayisi + " yıl sonra " +
        para(s.hedefNominal) + " tutarına karşılık geliyor."
      : "");
  }

  /* ------------------------------------------------------------------ *
   * 4) Tüketim
   * ------------------------------------------------------------------ */
  function tuketimHesapla() {
    var g = {
      baslangic: deger("t-baslangic"),
      aylikCekim: deger("t-cekim"),
      yillikGetiriYuzde: deger("t-getiri"),
      yillikEnflasyonYuzde: deger("t-enflasyon"),
      enAzYil: 50
    };
    var s = B.tuketim(g);

    var yil = Math.floor(s.dayandigiAy / 12), ay = s.dayandigiAy % 12;
    $("t-sure").textContent = s.tukendi
      ? (yil + " yıl" + (ay ? " " + ay + " ay" : ""))
      : "50 yıldan uzun";
    $("t-aciklama").textContent = s.tukendi
      ? "Çekim tutarı her yıl enflasyon kadar artırılarak hesaplandı."
      : "Bu çekimle birikiminiz tükenmiyor.";

    $("t-surdurulebilir").textContent = s.surdurulebilirAylik > 0
      ? para(s.surdurulebilirAylik) : "yok";
    $("t-reel").textContent = yuzde(s.reelYillikOran);

    uyariGoster($("t-uyari"), s.surdurulebilirAylik === 0
      ? "Reel getiriniz negatif: getiri enflasyonun altında kaldığı için anaparayı " +
        "koruyan bir çekim tutarı yok. Ne kadar az çekerseniz çekin birikim erir."
      : "");

    $("t-tablo").innerHTML = s.yillar.slice(0, 50).map(function (y) {
      return "<tr><th scope=\"row\">" + y.yil + "</th><td>" + para(y.aylikCekim) +
             "</td><td>" + para(y.bakiye) + "</td></tr>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * Bağlama — her girdi değişiminde ilgili bölüm yeniden hesaplanır.
   * ------------------------------------------------------------------ */
  function bagla(onek, fn) {
    document.querySelectorAll("#pan-" + onek + " input, #pan-" + onek + " select")
      .forEach(function (el) {
        el.addEventListener("input", fn);
        el.addEventListener("change", fn);
      });
    fn();
  }

  bagla("birikim", birikimHesapla);
  bagla("bes", besHesapla);
  bagla("hedef", hedefHesapla);
  bagla("tuketim", tuketimHesapla);

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
