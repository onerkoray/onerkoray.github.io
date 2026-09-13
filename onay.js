/*!
 * Ölçüm onayı — analitik ve konum isteği için rıza kapısı.
 *
 * NEDEN VAR: gizlilik sayfası ne toplandığını en baştan dürüstçe yazıyordu
 * (KVKK m.9 yurt dışı aktarımı dahil), ama BİLDİRİM RIZA DEĞİLDİR. Google
 * Analytics her sayfada, hiçbir şey sorulmadan yükleniyordu. Sitenin kendi
 * iddiası — "verileriniz cihazınızdan çıkmaz" — Finansal İkiz'le birlikte
 * çok daha ağır bir söz hâline geldi; o sözün altını, arka planda sessizce
 * çalışan bir ölçüm oyar.
 *
 * KURALLAR
 *
 * 1. ONAY GELENE KADAR HİÇBİR İSTEK GİTMEZ. Google Consent Mode'un
 *    "denied" varsayılanı bile Google'a çerezsiz bir sinyal gönderir;
 *    burada gtag betiği HİÇ yüklenmiyor. Karar verilmemişse ölçüm yok.
 *
 * 2. REDDETMEK KABUL ETMEK KADAR KOLAY. İki düğme aynı boyutta, aynı
 *    ağırlıkta, yan yana. Kapatma çarpısı yok — çünkü çarpı "sonra
 *    sorarım" mı yoksa "kabul" mü belli olmaz ve bu belirsizlik hep
 *    sitenin lehine yorumlanır.
 *
 * 3. GERİ ALMAK VERMEK KADAR KOLAY. Gizlilik sayfasındaki düğme kararı
 *    her iki yönde değiştirir; kabul geri alınınca Google'ın bıraktığı
 *    çerezler de silinir.
 *
 * 4. TARAYICI ZATEN "HAYIR" DİYORSA SORULMAZ. Global Privacy Control
 *    (ve Do Not Track) hukuken geçerli bir ret beyanıdır; o sinyal varken
 *    banner göstermek, kullanıcının verdiği cevabı yok saymak olur.
 *
 * 5. KARAR VERİLMEDEN SAYFA TAM ÇALIŞIR. Banner engelleyici değil; alt
 *    şeritte durur, içeriği itmez (sabit konum, düzen kayması yok).
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/gizlilik/
 */
(function (root) {
  "use strict";

  var ANAHTAR = "korayoner.olcum-onayi";
  var OLCUM = "G-2GNZPW1LPT";
  var KABUL = "kabul";
  var RET = "ret";

  /* Depo erişimi gizli sekmede ya da site verisi kapalıyken PATLAR.
     Onay sorgusu patlarsa sayfa açılmaz; bu yüzden her erişim sarmalı. */
  function oku() {
    try { return root.localStorage.getItem(ANAHTAR); } catch (e) { return null; }
  }
  function yaz(v) {
    try {
      if (v === null) root.localStorage.removeItem(ANAHTAR);
      else root.localStorage.setItem(ANAHTAR, v);
      return true;
    } catch (e) { return false; }
  }

  /* Tarayıcının kendi ret beyanı. GPC bazı yargı alanlarında bağlayıcı;
     DNT bağlayıcı değil ama açıkça ifade edilmiş bir tercih ve burada
     ona da uyuluyor. İkisi de "sorma, cevap belli" anlamına geliyor. */
  function tarayiciRetDiyor() {
    var n = root.navigator || {};
    if (n.globalPrivacyControl === true) return true;
    return n.doNotTrack === "1" || root.doNotTrack === "1" ||
      n.msDoNotTrack === "1";
  }

  /* Bu oturumda verilen karar. Gizli sekmede localStorage'a YAZILAMAZ ve
     yalnızca depoya bakılırsa kullanıcının az önce verdiği cevap yok
     sayılır: "Ölçebilirsin" diyor, hiçbir şey olmuyor, şerit her sayfada
     yeniden çıkıyor. Karar saklanamıyor olabilir; ama VERİLMİŞ olması
     ayrı bir şey ve o oturumda uygulanmalı. */
  var oturumKarari = null;

  function durum() {
    if (oturumKarari) return oturumKarari;
    var d = oku();
    if (d === KABUL || d === RET) return d;
    return tarayiciRetDiyor() ? RET : null;   // null = henüz sorulmadı
  }

  function kabulEdildi() { return durum() === KABUL; }

  /* ---------------------------------------------------------- ölçüm */

  var yuklendi = false;

  function olcumuBaslat() {
    /* !kabulEdildi() SUANDA ULASILAMAZ: iki cagiran da (baslat, ver)
       zaten onayi kontrol ediyor, bu yuzden bir mutasyon testi bunu
       yakalayamiyor. Yine de duruyor -- bu satir, onaysiz olcum ile
       aramizdaki SON kapi; ileride korumasiz bir cagri eklenirse tek
       savunma o olur. "Test etmiyor, demek ki gereksiz" diye silmeyin. */
    if (yuklendi || !kabulEdildi()) return;
    yuklendi = true;
    root.dataLayer = root.dataLayer || [];
    root.gtag = function () { root.dataLayer.push(arguments); };
    root.gtag("js", new Date());
    root.gtag("config", OLCUM, { anonymize_ip: true });
    var e = document.createElement("script");
    e.async = true;
    e.src = "https://www.googletagmanager.com/gtag/js?id=" + OLCUM;
    document.head.appendChild(e);
  }

  /* Onay geri alınınca Google'ın bıraktığı çerezler de gider. Yalnızca
     "bir daha yükleme" demek, ORTADA DURAN veriyi bırakmak olurdu. */
  function cerezleriSil() {
    var host = (root.location || {}).hostname || "";
    var alanlar = [host, "." + host];
    var nokta = host.split(".");
    if (nokta.length > 2) alanlar.push("." + nokta.slice(-2).join("."));
    (document.cookie || "").split(";").forEach(function (c) {
      var ad = c.split("=")[0].trim();
      if (!/^(_ga|_gid|_gat)/.test(ad)) return;
      alanlar.forEach(function (a) {
        document.cookie = ad + "=; Max-Age=0; path=/; domain=" + a;
      });
      document.cookie = ad + "=; Max-Age=0; path=/";
    });
  }

  function ver(kabulMu) {
    oturumKarari = kabulMu ? KABUL : RET;
    yaz(oturumKarari);
    if (kabulMu) olcumuBaslat();
    else cerezleriSil();
    seridiKaldir();
    duyur();
  }

  var dinleyiciler = [];
  function dinle(f) { if (typeof f === "function") dinleyiciler.push(f); }
  function duyur() {
    dinleyiciler.forEach(function (f) {
      try { f(durum()); } catch (e) { /* bir dinleyici digerlerini engellemesin */ }
    });
  }

  /* ---------------------------------------------------------- şerit */

  var serit = null;

  function seridiKaldir() {
    if (serit && serit.parentNode) serit.parentNode.removeChild(serit);
    serit = null;
  }

  function seridiGoster() {
    if (serit || durum() !== null) return;

    serit = document.createElement("div");
    serit.className = "onay-serit";
    serit.setAttribute("role", "region");
    serit.setAttribute("aria-label", "Ölçüm onayı");

    var metin = document.createElement("p");
    metin.className = "onay-metin";
    metin.innerHTML = "Ziyaret istatistiklerini Google Analytics ile ölçmek " +
      "istiyoruz. <strong>Hesap araçlarına girdiğiniz veriler buna dâhil " +
      "değildir</strong> — onlar hiçbir zaman cihazınızdan çıkmaz. " +
      '<a href="/gizlilik/">Ayrıntılar</a>';

    var dugmeler = document.createElement("div");
    dugmeler.className = "onay-dugmeler";

    /* İKİ DÜĞME AYNI AĞIRLIKTA. Reddi soluk bir bağlantıya indirmek,
       teknik olarak "seçenek sunmak" ama pratikte yönlendirmektir. */
    var hayir = document.createElement("button");
    hayir.type = "button";
    hayir.className = "onay-dugme";
    hayir.textContent = "Ölçme";

    var evet = document.createElement("button");
    evet.type = "button";
    evet.className = "onay-dugme";
    evet.textContent = "Ölçebilirsin";

    hayir.addEventListener("click", function () { ver(false); });
    evet.addEventListener("click", function () { ver(true); });

    dugmeler.appendChild(hayir);
    dugmeler.appendChild(evet);
    serit.appendChild(metin);
    serit.appendChild(dugmeler);
    document.body.appendChild(serit);
  }

  /* ------------------------------------------------------- başlangıç */

  function baslat() {
    if (kabulEdildi()) olcumuBaslat();
    else seridiGoster();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat);
  } else {
    baslat();
  }

  root.Onay = {
    durum: durum,
    kabulEdildi: kabulEdildi,
    ver: ver,
    dinle: dinle,
    sor: seridiGoster,
    tarayiciRetDiyor: tarayiciRetDiyor,
    ANAHTAR: ANAHTAR
  };
})(typeof window !== "undefined" ? window : this);
