/* Google Analytics 4 — merkezi yükleyici
   Kurulum: aşağıdaki GA_ID değerini kendi GA4 Ölçüm Kimliğinizle değiştirin.
   Örnek: var GA_ID = "G-ABCD123456";
   Kimlik girilene kadar hiçbir dış istek yapılmaz ve çerez yüklenmez. */
(function () {
  "use strict";

  var GA_ID = "G-2GNZPW1LPT"; // <-- BURAYA GA4 Ölçüm Kimliğinizi yazın

  // Kimlik ayarlanmadıysa hiçbir şey yükleme (gizlilik korunur).
  if (!GA_ID || GA_ID.indexOf("G-") !== 0 || GA_ID === "G-XXXXXXXXXX") return;

  // "Do Not Track" tercihine saygı göster.
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, { anonymize_ip: true });
})();
