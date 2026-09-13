/*!
 * Gizlilik sayfasindaki olcum karari denetimi.
 *
 * GERI ALMAK VERMEK KADAR KOLAY OLMALI. Onay veren biri icin tek tik
 * yeten bir islem, geri almak isteyen biri icin tarayici ayarlarina
 * gomulu bir gorev haline gelirse, alinan onay hukuken de gecerli
 * sayilmaz. Bu yuzden karar burada tek dugmeyle her iki yone cevriliyor.
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
    var d = window.Onay.durum();
    if (d === "kabul") {
      yazi.textContent = "Şu anda ölçüme izin veriyorsunuz.";
      dugme.textContent = "Onayı geri al";
    } else if (d === "ret") {
      yazi.textContent = window.Onay.tarayiciRetDiyor()
        ? "Tarayıcınız izleme karşıtı bir sinyal gönderiyor; ölçüm kapalı."
        : "Şu anda ölçüme izin vermiyorsunuz.";
      dugme.textContent = "Ölçüme izin ver";
    } else {
      yazi.textContent = "Henüz karar vermediniz; ölçüm kapalı.";
      dugme.textContent = "Ölçüme izin ver";
    }
  }

  dugme.addEventListener("click", function () {
    window.Onay.ver(window.Onay.durum() !== "kabul");
    tazele();
  });
  window.Onay.dinle(tazele);
  tazele();
})();
