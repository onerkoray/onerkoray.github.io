/*!
 * Ölçüm tercihi — analitiğin tek giriş kapısı.
 *
 * ÖLÇÜM VARSAYILAN OLARAK AÇIK. Site sahibinin kararı: arama görünürlüğü
 * öncelikli ve ölçüm hacminden bedel ödenmeyecek. Bu yüzden onay şeridi
 * yok; ziyaretçi hiçbir şeye tıklamadan ölçülür.
 *
 * Buna rağmen bu dosya duruyor, çünkü üç şeyi birden yapıyor ve üçü de
 * ölçüm hacmine dokunmuyor:
 *
 * 1. TARAYICININ RET BEYANINA UYAR. Global Privacy Control (bazı yargı
 *    alanlarında bağlayıcı) ya da Do Not Track gönderen bir tarayıcı
 *    ölçülmez. Bunlar ziyaretçilerin çok küçük bir azınlığı; karşılığında
 *    açıkça ifade edilmiş bir tercih çiğnenmemiş oluyor.
 *
 * 2. ÇIKIŞ TEK DÜĞME. Gizlilik sayfasındaki denetim ölçümü kapatır ve
 *    Google'ın bıraktığı çerezleri siler. "Google'ın eklentisini kurun"
 *    demek, çıkışı sitenin dışına havale etmekti.
 *
 * 3. ANALİTİK TEK YERDEN YÜKLENİR. Ölçüm kimliği ve yükleme mantığı 118
 *    sayfaya kopyalanmış satır içi bir blok değil, tek dosya. Satır içi
 *    blok gittiği için CSP'de script hash'i de kalmadı: script-src artık
 *    ne hash ne 'unsafe-inline' taşıyor.
 *
 * Kararı geri çevirmek isteyen için tek yer: VARSAYILAN sabiti.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/gizlilik/
 */
(function (root) {
  "use strict";

  var ANAHTAR = "korayoner.olcum-onayi";
  var OLCUM = "G-2GNZPW1LPT";
  var KABUL = "kabul";
  var RET = "ret";

  /* Kullanıcı bir şey seçmediyse ve tarayıcı da ret sinyali göndermiyorsa
     geçerli olan karar. "ret" yapmak ölçümü kapatır; tek değişiklik o. */
  var VARSAYILAN = KABUL;

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
    if (d === KABUL || d === RET) return d;      // ziyaretçinin açık kararı
    if (tarayiciRetDiyor()) return RET;          // tarayıcının ret beyanı
    return VARSAYILAN;
  }

  /* Ziyaretçi KENDİSİ bir seçim yaptı mı? Gizlilik sayfasındaki denetim
     "kapalı" ile "hiç dokunmadı"yı ayırt edebilsin diye ayrı duruyor. */
  function secimYapildi() {
    var d = oku();
    return d === KABUL || d === RET || !!oturumKarari;
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
    duyur();
  }

  var dinleyiciler = [];
  function dinle(f) { if (typeof f === "function") dinleyiciler.push(f); }
  function duyur() {
    dinleyiciler.forEach(function (f) {
      try { f(durum()); } catch (e) { /* bir dinleyici digerlerini engellemesin */ }
    });
  }

  /* ------------------------------------------------------- başlangıç */

  function baslat() {
    if (kabulEdildi()) olcumuBaslat();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat);
  } else {
    baslat();
  }

  root.Onay = {
    durum: durum,
    kabulEdildi: kabulEdildi,
    secimYapildi: secimYapildi,
    ver: ver,
    dinle: dinle,
    tarayiciRetDiyor: tarayiciRetDiyor,
    ANAHTAR: ANAHTAR
  };
})(typeof window !== "undefined" ? window : this);
