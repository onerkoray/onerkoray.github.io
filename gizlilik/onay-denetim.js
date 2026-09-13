/*!
 * Gizlilik sayfasindaki olcum tercihi denetimi.
 *
 * CIKIS SITENIN ICINDE OLMALI. Eskiden bu sayfa "Google'in devre disi
 * birakma eklentisini kurun" diyordu; yani cikisi sitenin disina havale
 * ediyordu. Olcum varsayilan olarak acik oldugu icin cikisin tek dugme
 * uzaklikta olmasi daha da onemli.
 *
 * Betik ayri bir dosyada, cunku satir ici betik CSP hash'i gerektiriyor
 * ve o hash'teki tek bosluk degisikligi betigi SESSIZCE devre disi
 * birakir -- bu kod tabaninda bir kez yasandi.
 */
(function () {
  "use strict";
  var kap = document.getElementById("onay-denetim");
  var yazi = document.getElementById("onay-durum");
  if (!kap || !yazi || !window.Onay) return;

  var dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "onay-dugme";
  kap.appendChild(dugme);

  function tazele() {
    var acik = window.Onay.durum() === "kabul";
    if (acik) {
      /* Varsayilan ACIK oldugu icin "izin verdiniz" demek yanlis olurdu:
         cogu ziyaretci hicbir sey secmemis durumda. */
      yazi.textContent = window.Onay.secimYapildi()
        ? "Ölçümü açık bırakmayı seçtiniz."
        : "Ölçüm şu anda açık (varsayılan ayar).";
      dugme.textContent = "Ölçümü kapat";
    } else {
      yazi.textContent = window.Onay.tarayiciRetDiyor()
        ? "Tarayıcınız izleme karşıtı bir sinyal gönderiyor; ölçüm kapalı."
        : "Ölçümü kapattınız.";
      dugme.textContent = "Ölçümü aç";
    }
  }

  dugme.addEventListener("click", function () {
    window.Onay.ver(window.Onay.durum() !== "kabul");
    tazele();
  });
  window.Onay.dinle(tazele);
  tazele();
})();
