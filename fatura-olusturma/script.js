/* Fatura Oluşturma — arayüz katmanı.
 *
 * Tutar hesabının tamamı fatura.js'te; burada yalnızca form okuma, belge çizme
 * ve yerel depo işleri var. Ayrım kasıtlı: hesap DOM'suz test edilebilsin diye.
 */
(function () {
  "use strict";

  var F = window.Fatura;
  if (!F) return;

  function $(id) { return document.getElementById(id); }
  function el(etiket, sinif) {
    var d = document.createElement(etiket);
    if (sinif) d.className = sinif;
    return d;
  }

  /* ------------------------------------------------------- çalışma alanı */
  var A = window.FaturaArsiv;

  /* Tek anahtar. Önceden beş ayrı anahtar vardı (firma, müşteriler, taslak,
     ayar, sayaç); belgeler, müşteriler ve sayaç birbirine bağlı olduğu için
     birinin yazılıp diğerinin yazılamadığı durumda (kota dolması) arşiv
     tutarsız kalıyordu. Artık hepsi tek bir nesne olarak yazılıyor. */
  var DEPO = "fatura:calisma";
  var ESKI = {
    firma: "fatura:firma", musteriler: "fatura:musteriler",
    taslak: "fatura:taslak", ayar: "fatura:ayar", sayac: "fatura:sayac"
  };

  /* localStorage gizli sekmede ve site verisi kapalı tarayıcılarda okurken
     bile istisna atabiliyor; her erişim sarmalanıyor. */
  function ham(anahtar, varsayilan) {
    try {
      var s = localStorage.getItem(anahtar);
      return s ? JSON.parse(s) : varsayilan;
    } catch (e) { return varsayilan; }
  }
  function hamYaz(anahtar, deger) {
    try { localStorage.setItem(anahtar, JSON.stringify(deger)); return true; }
    catch (e) { return false; }
  }

  var alan = null;              /* tek gerçeklik kaynağı */
  var acikBelgeId = null;       /* düzenlenen arşiv belgesi, yoksa yeni belge */

  function alaniYukle() {
    var kayit = ham(DEPO, null);
    if (kayit) return A.normalize(kayit);

    /* Eski sürümden taşıma. Eski anahtarlar SİLİNMİYOR: taşıma bir hata
       yaparsa kullanıcının elinde hâlâ orijinali dursun. */
    var a = A.bosCalismaAlani();
    var eskiFirma = ham(ESKI.firma, null);
    if (eskiFirma) a.firma = eskiFirma;
    var eskiMusteri = ham(ESKI.musteriler, null);
    if (Array.isArray(eskiMusteri)) a.musteriler = eskiMusteri;
    var eskiAyar = ham(ESKI.ayar, null);
    if (eskiAyar) a.ayar = { sablon: eskiAyar.sablon || "klasik", renk: eskiAyar.renk || "yesil" };
    var eskiSayac = ham(ESKI.sayac, null);
    if (eskiSayac) a.sayac = eskiSayac;
    var eskiTaslak = ham(ESKI.taslak, null);
    if (eskiTaslak && eskiTaslak.kalemler) {
      var d = A.iceAktar(eskiTaslak);
      if (d && d.belgeler.length) {
        a.belgeler = d.belgeler;
        if (!a.firma.unvan && d.firma) a.firma = d.firma;
      }
    }
    return a;
  }

  function alaniKaydet() {
    if (!hamYaz(DEPO, alan)) {
      durum("durum-genel", "Kaydedilemedi — tarayıcı depolaması dolu veya kapalı " +
        "olabilir. Verinizi kaybetmemek için yedek alın.", "uyari");
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ alan haritası */
  var FIRMA = ["unvan", "adres", "vd", "vkn", "tel", "eposta", "web", "mersis", "iban"];
  var MUSTERI = ["unvan", "adres", "vd", "vkn", "tel", "eposta"];
  var BELGE = ["belge-turu", "belge-no", "tarih", "vade", "odeme-kosulu",
    "referans", "para", "kur", "genel-iskonto", "tevkifat", "notlar", "kosullar"];

  var RENKLER = [
    { ad: "yesil", etiket: "Yeşil", renk: "#0e7c66" },
    { ad: "lacivert", etiket: "Lacivert", renk: "#1e3a8a" },
    { ad: "bordo", etiket: "Bordo", renk: "#8c1d3f" },
    { ad: "antrasit", etiket: "Antrasit", renk: "#334155" },
    { ad: "turuncu", etiket: "Turuncu", renk: "#b45309" },
    { ad: "mor", etiket: "Mor", renk: "#5b21b6" }
  ];

  var BELGE_ONEK = {
    "PROFORMA FATURA": "PRF",
    "FATURA": "FTR",
    "TEKLİF": "TKF",
    "ÖN BİLGİLENDİRME": "OBF",
    "MAKBUZ": "MKB"
  };

  var KDV_SECENEKLERI = [0, 1, 8, 10, 18, 20];

  var durumZamanlayici = {};

  /* Geçici durum mesajı: kaydedildi/silindi gibi geri bildirimler. */
  function durum(id, mesaj, tur) {
    var e = $(id);
    if (!e) return;
    e.textContent = mesaj;
    e.className = "alan-durum" + (tur ? " durum-" + tur : "");
    clearTimeout(durumZamanlayici[id]);
    if (mesaj) {
      durumZamanlayici[id] = setTimeout(function () {
        e.textContent = "";
        e.className = "alan-durum";
      }, 4000);
    }
  }

  /* ------------------------------------------------------------ biçimleme */
  function tarihTr(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return p[2] + "." + p[1] + "." + p[0];
  }
  function bugunIso() {
    var d = new Date();
    var ay = String(d.getMonth() + 1);
    var gun = String(d.getDate());
    return d.getFullYear() + "-" + (ay.length < 2 ? "0" + ay : ay) +
      "-" + (gun.length < 2 ? "0" + gun : gun);
  }
  /* Çok satırlı alanlar belgede satır sonlarını korumalı; innerHTML yerine
     düğüm kurarak yazıyoruz, böylece kullanıcı metni asla HTML olarak
     yorumlanmaz. */
  function satirlariYaz(hedef, metin) {
    hedef.textContent = "";
    /* Boş metin için boş metin düğümü bile eklenmemeli: eklenirse eleman
       :empty olmaktan çıkar, "boş alanları gizle" kuralı tutmaz ve belgede
       sebepsiz boşluk kalır. */
    if (!String(metin || "").trim()) return;
    var satirlar = String(metin).split(/\r?\n/);
    for (var i = 0; i < satirlar.length; i++) {
      if (i) hedef.appendChild(document.createElement("br"));
      hedef.appendChild(document.createTextNode(satirlar[i]));
    }
  }

  /* IBAN: mod-97 sağlaması. Yanlış IBAN, faturanın ödenmemesine yol açan ve
     gözle ayırt edilmesi imkânsız bir hata. */
  function ibanGecerli(s) {
    var t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (t.length < 15 || t.length > 34) return false;
    var yer = t.slice(4) + t.slice(0, 4);
    var sayisal = "";
    for (var i = 0; i < yer.length; i++) {
      var c = yer.charAt(i);
      sayisal += (c >= "A" && c <= "Z") ? String(c.charCodeAt(0) - 55) : c;
    }
    var kalan = 0;
    for (var j = 0; j < sayisal.length; j++) {
      kalan = (kalan * 10 + Number(sayisal.charAt(j))) % 97;
    }
    return kalan === 1;
  }
  function ibanBicim(s) {
    var t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return t.replace(/(.{4})/g, "$1 ").trim();
  }

  /* ------------------------------------------------------------ kalem satırları */
  function kalemSatiri(veri) {
    veri = veri || {};
    var satir = el("div", "kalem-satir");

    function kutu(sinif, etiket) {
      var p = el("span", "kalem-hucre " + sinif);
      p.setAttribute("data-etiket", etiket);
      return p;
    }

    var hAciklama = kutu("h-aciklama", "Açıklama");
    var iAciklama = el("input");
    iAciklama.type = "text";
    iAciklama.className = "k-aciklama";
    iAciklama.placeholder = "Ürün veya hizmet adı";
    iAciklama.value = veri.aciklama || "";
    iAciklama.setAttribute("aria-label", "Kalem açıklaması");
    hAciklama.appendChild(iAciklama);

    var hMiktar = kutu("h-miktar", "Miktar");
    var iMiktar = el("input");
    iMiktar.type = "text";
    iMiktar.className = "k-miktar";
    iMiktar.inputMode = "decimal";
    iMiktar.value = veri.miktar != null ? veri.miktar : "1";
    iMiktar.setAttribute("aria-label", "Miktar");
    hMiktar.appendChild(iMiktar);

    var hBirim = kutu("h-birim", "Birim");
    var sBirim = el("select");
    sBirim.className = "k-birim";
    sBirim.setAttribute("aria-label", "Birim");
    F.BIRIMLER.forEach(function (b) {
      var o = el("option");
      o.value = b; o.textContent = b;
      if (b === (veri.birim || "Adet")) o.selected = true;
      sBirim.appendChild(o);
    });
    hBirim.appendChild(sBirim);

    var hFiyat = kutu("h-fiyat", "Birim fiyat");
    var iFiyat = el("input");
    iFiyat.type = "text";
    iFiyat.className = "k-fiyat";
    iFiyat.inputMode = "decimal";
    iFiyat.value = veri.birimFiyat != null ? veri.birimFiyat : "";
    iFiyat.setAttribute("aria-label", "Birim fiyat");
    hFiyat.appendChild(iFiyat);

    var hIskonto = kutu("h-iskonto", "İskonto");
    var sarmal = el("span", "girdi-ikili");
    var iIskonto = el("input");
    iIskonto.type = "text";
    iIskonto.className = "k-iskonto";
    iIskonto.inputMode = "decimal";
    iIskonto.value = veri.iskonto != null ? veri.iskonto : "0";
    iIskonto.setAttribute("aria-label", "İskonto");
    var bTur = el("button", "birim-dugme k-iskonto-tur");
    bTur.type = "button";
    bTur.setAttribute("data-tur", veri.iskontoTur === "tutar" ? "tutar" : "oran");
    bTur.setAttribute("aria-label", "İskonto türünü değiştir");
    sarmal.appendChild(iIskonto);
    sarmal.appendChild(bTur);
    hIskonto.appendChild(sarmal);

    var hKdv = kutu("h-kdv", "KDV");
    var sKdv = el("select");
    sKdv.className = "k-kdv";
    sKdv.setAttribute("aria-label", "KDV oranı");
    KDV_SECENEKLERI.forEach(function (o) {
      var op = el("option");
      op.value = String(o);
      op.textContent = "%" + o;
      if (Number(veri.kdvOran != null ? veri.kdvOran : 20) === o) op.selected = true;
      sKdv.appendChild(op);
    });
    hKdv.appendChild(sKdv);

    var hTutar = kutu("h-tutar", "Tutar");
    var cTutar = el("span", "k-tutar");
    cTutar.textContent = "—";
    hTutar.appendChild(cTutar);

    var hIslem = kutu("h-islem", "");
    var bYukari = el("button", "satir-dugme");
    bYukari.type = "button"; bYukari.textContent = "↑";
    bYukari.title = "Yukarı taşı";
    bYukari.setAttribute("aria-label", "Kalemi yukarı taşı");
    var bAsagi = el("button", "satir-dugme");
    bAsagi.type = "button"; bAsagi.textContent = "↓";
    bAsagi.title = "Aşağı taşı";
    bAsagi.setAttribute("aria-label", "Kalemi aşağı taşı");
    var bSil = el("button", "satir-dugme satir-sil");
    bSil.type = "button"; bSil.textContent = "✕";
    bSil.title = "Kalemi sil";
    bSil.setAttribute("aria-label", "Kalemi sil");
    hIslem.appendChild(bYukari);
    hIslem.appendChild(bAsagi);
    hIslem.appendChild(bSil);

    [hAciklama, hMiktar, hBirim, hFiyat, hIskonto, hKdv, hTutar, hIslem]
      .forEach(function (h) { satir.appendChild(h); });

    bTur.addEventListener("click", function () {
      var yeni = bTur.getAttribute("data-tur") === "oran" ? "tutar" : "oran";
      bTur.setAttribute("data-tur", yeni);
      ciz();
    });
    bSil.addEventListener("click", function () {
      var liste = $("kalem-listesi");
      if (liste.children.length > 1) satir.remove();
      else { iAciklama.value = ""; iFiyat.value = ""; iMiktar.value = "1"; }
      ciz();
    });
    bYukari.addEventListener("click", function () {
      var onceki = satir.previousElementSibling;
      if (onceki) satir.parentNode.insertBefore(satir, onceki);
      ciz();
    });
    bAsagi.addEventListener("click", function () {
      var sonraki = satir.nextElementSibling;
      if (sonraki) satir.parentNode.insertBefore(sonraki, satir);
      ciz();
    });

    return satir;
  }

  function kalemEkle(veri) {
    $("kalem-listesi").appendChild(kalemSatiri(veri));
  }

  function kalemleriOku() {
    var cikti = [];
    var satirlar = $("kalem-listesi").querySelectorAll(".kalem-satir");
    for (var i = 0; i < satirlar.length; i++) {
      var s = satirlar[i];
      cikti.push({
        aciklama: s.querySelector(".k-aciklama").value,
        miktar: s.querySelector(".k-miktar").value,
        birim: s.querySelector(".k-birim").value,
        birimFiyat: s.querySelector(".k-fiyat").value,
        iskonto: s.querySelector(".k-iskonto").value,
        iskontoTur: s.querySelector(".k-iskonto-tur").getAttribute("data-tur"),
        kdvOran: s.querySelector(".k-kdv").value
      });
    }
    return cikti;
  }

  /* ------------------------------------------------------------ form <-> nesne
     Formdaki alan adları ("belge-turu") ile arşiv modelindeki adlar ("tur")
     farklı; ikisini burada eşliyoruz ki arşiv katmanı formu tanımak zorunda
     kalmasın. */
  var FORM_ARSIV = {
    "belge-turu": "tur", "belge-no": "no", "tarih": "tarih", "vade": "vade",
    "odeme-kosulu": "odemeKosulu", "referans": "referans", "para": "para",
    "kur": "kur", "genel-iskonto": "genelIskonto", "notlar": "notlar",
    "kosullar": "kosullar"
  };

  function belgeyiOku() {
    var b = { firma: {}, musteri: {}, kalemler: kalemleriOku() };
    FIRMA.forEach(function (k) { b.firma[k] = ($("in-firma-" + k) || {}).value || ""; });
    MUSTERI.forEach(function (k) { b.musteri[k] = ($("in-musteri-" + k) || {}).value || ""; });
    BELGE.forEach(function (k) { b[k] = ($("in-" + k) || {}).value || ""; });
    b.sablon = $("in-sablon").value;
    b.renk = $("belge").getAttribute("data-renk") || "yesil";
    b.genelIskontoTur = $("btn-genel-iskonto-tur").getAttribute("data-tur") || "oran";
    b.logo = $("bl-logo").getAttribute("src") || "";
    return b;
  }

  /** Formdaki hâli arşiv belgesi biçimine çevirir. */
  function formdanArsiv() {
    var f = belgeyiOku();
    var b = { firma: f.firma, musteri: f.musteri, kalemler: f.kalemler,
              genelIskontoTur: f.genelIskontoTur, sablon: f.sablon,
              renk: f.renk, logo: f.logo, tevkifat: tevkifatSec() };
    for (var k in FORM_ARSIV) {
      if (Object.prototype.hasOwnProperty.call(FORM_ARSIV, k)) b[FORM_ARSIV[k]] = f[k];
    }
    return b;
  }

  /** Arşiv belgesini forma yazar. */
  function arsivdenForma(b) {
    var f = { firma: b.firma, musteri: b.musteri, kalemler: b.kalemler,
              genelIskontoTur: b.genelIskontoTur, sablon: b.sablon,
              renk: b.renk, logo: b.logo };
    for (var k in FORM_ARSIV) {
      if (Object.prototype.hasOwnProperty.call(FORM_ARSIV, k)) f[k] = b[FORM_ARSIV[k]];
    }
    belgeyiYaz(f);
    var tv = $("in-tevkifat");
    var pay = (b.tevkifat && b.tevkifat.pay) || 0;
    for (var i = 0; i < F.TEVKIFAT_ORANLARI.length; i++) {
      if (F.TEVKIFAT_ORANLARI[i].pay === pay) { tv.value = String(i); break; }
    }
    $("alan-kur").hidden = (b.para || "TRY") === "TRY";
  }

  function belgeyiYaz(b) {
    if (!b) return;
    FIRMA.forEach(function (k) {
      var e = $("in-firma-" + k);
      if (e && b.firma) e.value = b.firma[k] || "";
    });
    MUSTERI.forEach(function (k) {
      var e = $("in-musteri-" + k);
      if (e && b.musteri) e.value = b.musteri[k] || "";
    });
    BELGE.forEach(function (k) {
      var e = $("in-" + k);
      if (e && b[k] != null && b[k] !== "") e.value = b[k];
    });
    if (b.sablon) $("in-sablon").value = b.sablon;
    if (b.renk) rengiUygula(b.renk);
    if (b.genelIskontoTur) turuUygula($("btn-genel-iskonto-tur"), b.genelIskontoTur);
    logoyuUygula(b.logo || "");

    var liste = $("kalem-listesi");
    liste.textContent = "";
    var kalemler = (b.kalemler && b.kalemler.length) ? b.kalemler : [{}];
    kalemler.forEach(kalemEkle);
  }

  function turuUygula(dugme, tur) {
    dugme.setAttribute("data-tur", tur);
  }

  function rengiUygula(renk) {
    $("belge").setAttribute("data-renk", renk);
    var dugmeler = $("renk-secim").querySelectorAll("button");
    for (var i = 0; i < dugmeler.length; i++) {
      dugmeler[i].setAttribute("aria-checked",
        String(dugmeler[i].getAttribute("data-renk") === renk));
    }
  }

  function logoyuUygula(veriUrl) {
    var img = $("bl-logo");
    if (veriUrl) {
      img.setAttribute("src", veriUrl);
      img.hidden = false;
      img.alt = "Firma logosu";
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      img.alt = "";
    }
  }

  /* ------------------------------------------------------------ belgeyi çiz */
  function ciz() {
    var b = belgeyiOku();
    var sonuc = F.hesapla({
      kalemler: b.kalemler,
      genelIskontoTur: b.genelIskontoTur,
      genelIskonto: b["genel-iskonto"],
      tevkifat: tevkifatSec(),
      paraBirimi: b.para,
      kur: b.kur
    });
    var pb = b.para || "TRY";
    var p = function (n) { return F.para(n, pb); };

    /* satır tutarları düzenleyicide de görünsün */
    var satirlar = $("kalem-listesi").querySelectorAll(".kalem-satir");
    for (var i = 0; i < satirlar.length; i++) {
      var hedef = satirlar[i].querySelector(".k-tutar");
      hedef.textContent = sonuc.satirlar[i] ? p(sonuc.satirlar[i].matrah) : "—";
      var tur = satirlar[i].querySelector(".k-iskonto-tur");
      tur.textContent = tur.getAttribute("data-tur") === "oran" ? "%" : F.PARALAR[pb].simge;
    }
    var gTur = $("btn-genel-iskonto-tur");
    gTur.textContent = gTur.getAttribute("data-tur") === "oran" ? "%" : F.PARALAR[pb].simge;

    /* --- şablon ve başlık --- */
    var belge = $("belge");
    belge.className = "belge sablon-" + (b.sablon || "klasik");
    $("bl-belge-turu").textContent = b["belge-turu"] || "PROFORMA FATURA";

    /* --- satıcı --- */
    $("bl-firma-unvan").textContent = b.firma.unvan || "Firma ünvanınız";
    satirlariYaz($("bl-firma-adres"), b.firma.adres);
    var vergi = [];
    if (b.firma.vd) vergi.push("V.D.: " + b.firma.vd);
    if (b.firma.vkn) vergi.push("VKN/TCKN: " + b.firma.vkn);
    $("bl-firma-vergi").textContent = vergi.join(" · ");
    var iletisim = [];
    if (b.firma.tel) iletisim.push(b.firma.tel);
    if (b.firma.eposta) iletisim.push(b.firma.eposta);
    if (b.firma.web) iletisim.push(b.firma.web);
    $("bl-firma-iletisim").textContent = iletisim.join(" · ");
    $("bl-firma-mersis").textContent = b.firma.mersis ? "MERSİS: " + b.firma.mersis : "";

    /* --- belge kimliği --- */
    $("bl-belge-no").textContent = b["belge-no"] || "—";
    $("bl-tarih").textContent = tarihTr(b.tarih) || "—";
    $("bl-vade").textContent = tarihTr(b.vade) || "—";
    $("bl-referans").textContent = b.referans || "—";
    belge.querySelector(".bl-satir-vade").hidden = !b.vade;
    belge.querySelector(".bl-satir-referans").hidden = !b.referans;

    /* --- alıcı --- */
    $("bl-musteri-unvan").textContent = b.musteri.unvan || "Müşteri ünvanı";
    satirlariYaz($("bl-musteri-adres"), b.musteri.adres);
    var mv = [];
    if (b.musteri.vd) mv.push("V.D.: " + b.musteri.vd);
    if (b.musteri.vkn) mv.push("VKN/TCKN: " + b.musteri.vkn);
    $("bl-musteri-vergi").textContent = mv.join(" · ");
    var mi = [];
    if (b.musteri.tel) mi.push(b.musteri.tel);
    if (b.musteri.eposta) mi.push(b.musteri.eposta);
    $("bl-musteri-iletisim").textContent = mi.join(" · ");

    /* --- ödeme --- */
    $("bl-odeme-kosulu").textContent = b["odeme-kosulu"] ? "Ödeme: " + b["odeme-kosulu"] : "";
    $("bl-iban").textContent = b.firma.iban ? "IBAN: " + ibanBicim(b.firma.iban) : "";
    $("bl-kur").textContent = pb !== "TRY"
      ? "Kur: 1 " + pb + " = " + F.miktarBicim(sonuc.kur) + " ₺" : "";

    /* --- kalemler --- */
    var govde = $("bl-kalemler");
    govde.textContent = "";
    if (!sonuc.satirlar.length) {
      var bosSatir = el("tr");
      var bosHucre = el("td");
      bosHucre.colSpan = 7;
      bosHucre.className = "belge-bos";
      bosHucre.textContent = "Henüz kalem eklenmedi.";
      bosSatir.appendChild(bosHucre);
      govde.appendChild(bosSatir);
    }
    /* İskonto sütunu hiç kullanılmıyorsa belgede yer kaplamasın. */
    var iskontoVar = sonuc.satirlar.some(function (s) {
      return s.iskonto > 0 || s.genelIskontoPayi > 0;
    });
    belge.setAttribute("data-iskonto", iskontoVar ? "var" : "yok");

    sonuc.satirlar.forEach(function (s, ix) {
      var tr = el("tr");
      function td(metin, sinif) {
        var d = el("td", sinif);
        d.textContent = metin;
        tr.appendChild(d);
        return d;
      }
      td(String(ix + 1), "s-no");
      var ac = td(s.aciklama || "—", "s-aciklama");
      if (!s.aciklama) ac.classList.add("belge-bos");
      td(F.miktarBicim(s.miktar) + " " + s.birim, "s-sayi");
      td(p(s.birimFiyat), "s-sayi");
      /* Satırın toplam indirimi: kendi iskontosu + genel iskontodan düşen
         pay. İkisi ayrı gösterilseydi satır kendi içinde doğrulanamazdı;
         böylece miktar × birim fiyat − iskonto = tutar her satırda tutuyor. */
      var toplamIskonto = s.iskonto + s.genelIskontoPayi;
      td(toplamIskonto > 0 ? "−" + p(toplamIskonto) : "—", "s-sayi s-iskonto");
      td("%" + F.miktarBicim(s.kdvOran), "s-sayi");
      td(p(s.matrah), "s-sayi s-tutar");
      govde.appendChild(tr);
    });

    /* --- toplamlar --- */
    var toplam = $("bl-toplam");
    toplam.textContent = "";
    function toplamSatiri(etiket, deger, sinif) {
      var tr = el("tr", sinif);
      var th = el("th");
      th.scope = "row";
      th.textContent = etiket;
      var td = el("td");
      td.textContent = deger;
      tr.appendChild(th);
      tr.appendChild(td);
      toplam.appendChild(tr);
    }

    toplamSatiri("Ara toplam", p(sonuc.araToplam + sonuc.satirIskontosu));
    if (sonuc.satirIskontosu > 0) toplamSatiri("Satır iskontosu", "−" + p(sonuc.satirIskontosu));
    if (sonuc.genelIskonto > 0) toplamSatiri("Genel iskonto", "−" + p(sonuc.genelIskonto));
    toplamSatiri("KDV matrahı", p(sonuc.matrah));
    sonuc.kdvDokumu.forEach(function (d) {
      if (d.matrah === 0 && d.kdv === 0) return;
      toplamSatiri("KDV %" + F.miktarBicim(d.oran), p(d.kdv));
    });
    toplamSatiri("Genel toplam", p(sonuc.genelToplam), "toplam-ara");
    if (sonuc.tevkifat > 0) {
      toplamSatiri("Tevkif edilen KDV (" + sonuc.tevkifatOrani + ")", "−" + p(sonuc.tevkifat));
      toplamSatiri("Tahsil edilecek KDV", p(sonuc.tahsilEdilecekKdv));
    }
    toplamSatiri("ÖDENECEK TUTAR", p(sonuc.odenecek), "toplam-odenecek");
    if (pb !== "TRY") {
      toplamSatiri("TL karşılığı", F.para(sonuc.odenecekTl, "TRY"), "toplam-tl");
    }

    /* --- yazıyla, notlar, dip --- */
    $("bl-yaziyla").textContent = F.yaziyla(sonuc.odenecek, pb);
    satirlariYaz($("bl-notlar"), b.notlar);
    satirlariYaz($("bl-kosullar"), b.kosullar);

    var uyari = (b["belge-turu"] === "FATURA")
      ? "Bu belge yasal e-Fatura / e-Arşiv Fatura değildir; taslak niteliğindedir."
      : "Bu belge bilgilendirme amaçlıdır, yasal fatura yerine geçmez.";
    $("bl-damga").textContent = uyari + " · korayoner.dev/fatura-olusturma ile hazırlandı.";

    /* --- doğrulama rozetleri --- */
    vergiDurumu("in-firma-vkn", "durum-firma-vkn");
    vergiDurumu("in-musteri-vkn", "durum-musteri-vkn");
    ibanDurumu();

    taslakKaydet(b);
  }

  function vergiDurumu(girdiId, durumId) {
    var girdi = $(girdiId), hedef = $(durumId);
    if (!girdi || !hedef) return;
    var d = F.vergiNoDurumu(girdi.value);
    hedef.textContent = d.durum === "yok" ? "" : d.mesaj;
    hedef.className = "alan-durum" +
      (d.durum === "gecerli" ? " durum-basarili" : d.durum === "hatali" ? " durum-uyari" : "");
  }

  function ibanDurumu() {
    var girdi = $("in-firma-iban"), hedef = $("durum-iban");
    if (!girdi || !hedef) return;
    var ham = girdi.value.replace(/\s/g, "");
    if (!ham) { hedef.textContent = ""; hedef.className = "alan-durum"; return; }
    var ok = ibanGecerli(ham);
    hedef.textContent = ok ? "IBAN sağlaması doğru." : "IBAN sağlamayı geçmiyor, kontrol edin.";
    hedef.className = "alan-durum " + (ok ? "durum-basarili" : "durum-uyari");
  }

  function tevkifatSec() {
    var s = $("in-tevkifat");
    var i = s ? Number(s.value) : 0;
    return F.TEVKIFAT_ORANLARI[i] || F.TEVKIFAT_ORANLARI[0];
  }

  /* --------------------------------------------------------- otomatik kayıt
     Açık belge arşivdeyse ona yazılır; değilse "üzerinde çalışılan belge"
     olarak arşive girmemiş halde tutulur. Her tuşta yazmak yerine kısa bir
     gecikme: uzun bir faturada her karakter için localStorage'a yazmak
     yazmayı gözle görülür biçimde ağırlaştırıyor. */
  var kayitZamanlayici = null;
  function taslakKaydet() {
    clearTimeout(kayitZamanlayici);
    kayitZamanlayici = setTimeout(function () {
      var b = formdanArsiv();
      if (acikBelgeId) {
        A.belgeGuncelle(alan, acikBelgeId, b);
      } else {
        alan.acikTaslak = b;
      }
      alan.firma = b.firma;
      alan.ayar = { sablon: b.sablon, renk: b.renk };
      hamYaz(DEPO, alan);
      arsiviCiz();
    }, 500);
  }

  /* ------------------------------------------------------------- belge no */
  function yeniNo(tur) {
    return A.sonrakiNo(alan, tur, new Date().getFullYear());
  }

  /* ------------------------------------------------------ müşteri defteri */
  function musterileriListele(secili) {
    var s = $("in-musteri-kayitli");
    s.textContent = "";
    var ilk = el("option");
    ilk.value = "";
    ilk.textContent = alan.musteriler.length ? "— Yeni müşteri —" : "— Kayıtlı müşteri yok —";
    s.appendChild(ilk);
    alan.musteriler.forEach(function (m, i) {
      var o = el("option");
      o.value = String(i);
      o.textContent = m.unvan || "(isimsiz)";
      s.appendChild(o);
    });
    if (secili != null) s.value = String(secili);
  }

  /* -------------------------------------------------------------- katalog */
  function katalogCiz() {
    var s = $("in-katalog");
    if (!s) return;
    s.textContent = "";
    var ilk = el("option");
    ilk.value = "";
    ilk.textContent = alan.katalog.length
      ? "— Katalogdan kalem ekle —" : "— Katalog boş —";
    s.appendChild(ilk);
    alan.katalog.forEach(function (k, i) {
      var o = el("option");
      o.value = String(i);
      o.textContent = k.aciklama + (k.birimFiyat ? " · " + F.para(F.sayi(k.birimFiyat), "TRY") : "");
      s.appendChild(o);
    });
  }

  /* --------------------------------------------------------------- dosya */
  function dosyaIndir(adi, icerik, tur) {
    var blob = new Blob([icerik], { type: tur });
    var url = URL.createObjectURL(blob);
    var a = el("a");
    a.href = url;
    a.download = adi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function dosyaAdi(b, uzanti) {
    var parcalar = [String(b.tur || b["belge-turu"] || "belge").replace(/\s+/g, "-")];
    var no = b.no || b["belge-no"];
    if (no) parcalar.push(no);
    if (b.musteri && b.musteri.unvan) {
      parcalar.push(b.musteri.unvan.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, "-").replace(/^-|-$/g, ""));
    }
    return parcalar.join("-").slice(0, 90) + uzanti;
  }

  /* --------------------------------------------------------------- arşiv */
  function durumEtiketi(d) {
    for (var i = 0; i < A.DURUMLAR.length; i++) if (A.DURUMLAR[i].ad === d) return A.DURUMLAR[i].etiket;
    return d;
  }

  function arsiviCiz() {
    var liste = $("arsiv-listesi");
    if (!liste) return;
    var suz = ($("in-arsiv-filtre") || {}).value || "";
    var ara = (($("in-arsiv-ara") || {}).value || "").trim().toLocaleLowerCase("tr-TR");

    var belgeler = alan.belgeler.filter(function (b) {
      if (suz === "teklif" && A.turBilgi(b.tur).fatura) return false;
      if (suz === "fatura" && !A.turBilgi(b.tur).fatura) return false;
      if (suz && suz !== "teklif" && suz !== "fatura" && b.durum !== suz) return false;
      if (ara) {
        var havuz = ((b.no || "") + " " + (b.musteri && b.musteri.unvan ? b.musteri.unvan : "") +
                     " " + b.tur).toLocaleLowerCase("tr-TR");
        if (havuz.indexOf(ara) === -1) return false;
      }
      return true;
    });

    $("arsiv-sayi").textContent = alan.belgeler.length
      ? alan.belgeler.length + " belge" : "henüz belge yok";

    liste.textContent = "";
    if (!belgeler.length) {
      var bos = el("p", "alan-not");
      bos.textContent = alan.belgeler.length
        ? "Bu süzgece uyan belge yok."
        : "Henüz kaydedilmiş belge yok. Aşağıda bir belge hazırlayıp " +
          "“Arşive kaydet” deyin.";
      liste.appendChild(bos);
      return;
    }

    belgeler.forEach(function (b) {
      var t = A.belgeToplami(b);
      var satir = el("div", "arsiv-satir" + (b.id === acikBelgeId ? " arsiv-acik" : ""));

      var sol = el("div", "arsiv-kimlik");
      var no = el("span", "arsiv-no");
      no.textContent = b.no || "(numarasız)";
      var tur = el("span", "arsiv-tur");
      tur.textContent = b.tur;
      var mus = el("span", "arsiv-musteri");
      mus.textContent = (b.musteri && b.musteri.unvan) ? b.musteri.unvan : "—";
      sol.appendChild(no); sol.appendChild(tur); sol.appendChild(mus);
      if (b.kaynakNo) {
        var kaynak = el("span", "arsiv-kaynak");
        kaynak.textContent = b.kaynakNo + " → dönüştürüldü";
        sol.appendChild(kaynak);
      }

      var orta = el("div", "arsiv-sayilar");
      var tarih = el("span", "arsiv-tarih");
      tarih.textContent = tarihTr(b.tarih);
      var tutar = el("span", "arsiv-tutar");
      tutar.textContent = F.para(t.odenecek, b.para);
      orta.appendChild(tarih); orta.appendChild(tutar);

      var rozet = el("span", "arsiv-durum durum-" + b.durum);
      rozet.textContent = durumEtiketi(b.durum);
      /* Vadesi geçmiş olan, bekleyenler arasında görünür olmalı. */
      if (b.durum === "gonderildi" && b.vade && b.vade < A.bugun()) {
        rozet.textContent += " · vadesi geçti";
        rozet.classList.add("durum-gecikmis");
      }
      orta.appendChild(rozet);

      var sag = el("div", "arsiv-islem");
      function dugme(metin, baslik, islev, sinif) {
        var d = el("button", "satir-dugme" + (sinif ? " " + sinif : ""));
        d.type = "button"; d.textContent = metin; d.title = baslik;
        d.setAttribute("aria-label", baslik + " — " + (b.no || b.tur));
        d.addEventListener("click", islev);
        sag.appendChild(d);
      }
      dugme("Aç", "Belgeyi düzenlemek için aç", function () { belgeyiAc(b.id); });
      if (!A.turBilgi(b.tur).fatura) {
        dugme("→ Fatura", "Faturaya çevir", function () { faturayaCevir(b.id); }, "satir-vurgu");
      }
      dugme("Kopyala", "Kopyasını oluştur", function () {
        var k = A.belgeKopyala(alan, b.id);
        alaniKaydet(); arsiviCiz();
        durum("durum-genel", k.no + " olarak kopyalandı.", "basarili");
      });
      dugme("✕", "Belgeyi sil", function () {
        if (!window.confirm((b.no || "Bu belge") + " silinecek. Emin misiniz?")) return;
        A.belgeSil(alan, b.id);
        if (acikBelgeId === b.id) acikBelgeId = null;
        alaniKaydet(); arsiviCiz(); acikBelgeCiz();
        durum("durum-genel", "Belge silindi.", "basarili");
      }, "satir-sil");

      satir.appendChild(sol); satir.appendChild(orta); satir.appendChild(sag);
      liste.appendChild(satir);
    });
  }

  function belgeyiAc(id) {
    var b = A.belgeBul(alan, id);
    if (!b) return;
    acikBelgeId = id;
    arsivdenForma(b);
    ciz();
    acikBelgeCiz();
    arsiviCiz();
    durum("durum-genel", (b.no || "Belge") + " açıldı; değişiklikler doğrudan kaydediliyor.", "basarili");
    var hedef = $("olustur");
    if (hedef && hedef.scrollIntoView) hedef.scrollIntoView({ block: "start" });
  }

  function faturayaCevir(id) {
    var kaynak = A.belgeBul(alan, id);
    if (!kaynak) return;
    var f = A.tekliftenFatura(alan, id, "FATURA");
    if (!f) {
      durum("durum-genel", "Bu belge zaten bir fatura.", "uyari");
      return;
    }
    alaniKaydet();
    belgeyiAc(f.id);
    durum("durum-genel", kaynak.no + " → " + f.no + " olarak faturaya çevrildi. " +
      "Teklif arşivde olduğu gibi duruyor.", "basarili");
  }

  /** Üstteki "açık belge" çubuğu: hangi belgedeyiz, durumu ne. */
  function acikBelgeCiz() {
    var cubuk = $("acik-belge");
    if (!cubuk) return;
    var b = acikBelgeId ? A.belgeBul(alan, acikBelgeId) : null;
    $("acik-belge-ad").textContent = b
      ? (b.no || b.tur) + " · arşivde"
      : "Yeni belge — henüz arşive kaydedilmedi";
    cubuk.setAttribute("data-arsivde", b ? "evet" : "hayir");
    var sec = $("in-acik-durum");
    sec.disabled = !b;
    if (b) sec.value = b.durum;
    $("btn-arsive-kaydet").textContent = b ? "Arşivdeki belgeyi güncelle" : "Arşive kaydet";
    $("btn-yeni-belge").hidden = !b;
  }

  /* ---------------------------------------------------------------- özet */
  function ozetCiz() {
    var kap = $("ozet-icerik");
    if (!kap) return;
    var yil = Number(($("in-ozet-yil") || {}).value || new Date().getFullYear());
    var o = A.ozet(alan, yil);

    kap.textContent = "";
    if (!o.belgeSayisi) {
      var bos = el("p", "alan-not");
      bos.textContent = yil + " yılında kayıtlı belge yok.";
      kap.appendChild(bos);
      return;
    }

    var izgara = el("div", "ozet-izgara");
    function kart(etiket, deger, not, vurgu) {
      var k = el("div", "ozet-kart" + (vurgu ? " ozet-vurgu" : ""));
      var e = el("span", "ozet-etiket"); e.textContent = etiket;
      var d = el("strong", "ozet-deger"); d.textContent = deger;
      k.appendChild(e); k.appendChild(d);
      if (not) { var n = el("span", "ozet-not"); n.textContent = not; k.appendChild(n); }
      izgara.appendChild(k);
    }
    var tl = function (n) { return F.para(n, "TRY"); };

    kart("Kesilen fatura", o.faturaSayisi + " belge", tl(o.faturaTutari), true);
    kart("Tahsil edilen", tl(o.tahsilEdilen),
         o.faturaTutari > 0
           ? "%" + Math.round(100 * o.tahsilEdilen / o.faturaTutari) + " tahsilat"
           : "");
    kart("Bekleyen", tl(o.bekleyen),
         o.vadesiGecen ? o.vadesiGecen + " belgenin vadesi geçti" : "vadesi geçen yok");
    kart("Teklif", o.teklifSayisi + " belge", tl(o.teklifTutari));
    kart("Teklif dönüşümü",
         o.donusumOrani == null ? "—" : "%" + o.donusumOrani,
         o.donusumOrani == null ? "teklif yok" : o.donusenTeklif + " / " + o.teklifSayisi + " teklif işe döndü");
    kart("Ortalama tahsilat",
         o.ortalamaTahsilatGunu == null ? "—" : o.ortalamaTahsilatGunu + " gün",
         o.ortalamaTahsilatGunu == null ? "ödenmiş fatura yok" : "fatura tarihinden ödemeye");
    kap.appendChild(izgara);

    /* Aylık dağılım — küçük bir çubuk şerit; ayrı bir kütüphane gerektirmiyor. */
    var enBuyuk = 0;
    o.aylik.forEach(function (a) { if (a.tutar > enBuyuk) enBuyuk = a.tutar; });
    if (enBuyuk > 0) {
      var basl = el("p", "ozet-alt-baslik");
      basl.textContent = yil + " aylık dağılım";
      kap.appendChild(basl);
      var serit = el("div", "ozet-aylik");
      var adlar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
      o.aylik.forEach(function (a, i) {
        var s = el("div", "ozet-ay");
        var c = el("div", "ozet-cubuk");
        c.style.height = Math.max(2, Math.round(52 * a.tutar / enBuyuk)) + "px";
        c.title = adlar[i] + ": " + tl(a.tutar) + " (" + a.sayi + " belge)";
        var ad = el("span", "ozet-ay-ad"); ad.textContent = adlar[i];
        s.appendChild(c); s.appendChild(ad);
        serit.appendChild(s);
      });
      kap.appendChild(serit);
    }

    if (o.musteriler.length) {
      var b2 = el("p", "ozet-alt-baslik");
      b2.textContent = "En çok iş yapılan müşteriler";
      kap.appendChild(b2);
      var ul = el("ul", "ozet-musteri");
      o.musteriler.forEach(function (m) {
        var li = el("li");
        var ad = el("span"); ad.textContent = m.unvan;
        var tt = el("strong"); tt.textContent = tl(m.tutar);
        li.appendChild(ad); li.appendChild(tt);
        ul.appendChild(li);
      });
      kap.appendChild(ul);
    }
  }

  function ozetYillariniListele() {
    var s = $("in-ozet-yil");
    if (!s) return;
    var yillar = {};
    yillar[new Date().getFullYear()] = true;
    alan.belgeler.forEach(function (b) {
      var y = String(b.tarih || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) yillar[y] = true;
    });
    var mevcut = s.value;
    s.textContent = "";
    Object.keys(yillar).sort().reverse().forEach(function (y) {
      var o = el("option"); o.value = y; o.textContent = y;
      s.appendChild(o);
    });
    if (mevcut && yillar[mevcut]) s.value = mevcut;
  }

  /* --------------------------------------------------------------- örnek */
  function ornekDoldur() {
    acikBelgeId = null;
    belgeyiYaz({
      firma: {
        unvan: "Örnek Yazılım ve Danışmanlık Ltd. Şti.",
        adres: "Kozyatağı Mah. Bilgi Sok. No: 12/4\nKadıköy / İstanbul",
        vd: "Kozyatağı", vkn: "1234567808",
        tel: "0216 000 00 00", eposta: "fatura@ornekyazilim.com",
        web: "ornekyazilim.com", mersis: "0123456789000001",
        iban: "TR330006100519786457841326"
      },
      musteri: {
        unvan: "Deneme Ticaret A.Ş.",
        adres: "Maslak Mah. Büyükdere Cad. No: 255\nSarıyer / İstanbul",
        vd: "Maslak", vkn: "9876543217",
        tel: "0212 000 00 00", eposta: "muhasebe@denemeticaret.com"
      },
      "belge-turu": "TEKLİF",
      "belge-no": yeniNo("TEKLİF"),
      tarih: bugunIso(),
      "odeme-kosulu": "Fatura tarihinden itibaren 30 gün",
      referans: "SIP-2026-0184",
      para: "TRY", kur: "1",
      "genel-iskonto": "5",
      genelIskontoTur: "oran",
      tevkifat: "0",
      notlar: "Teslim: sözleşmede belirtilen takvime göre.\nGaranti: 12 ay ücretsiz hata giderme.",
      kosullar: "Ödeme yukarıdaki IBAN'a yapılır. Gecikme halinde TTK m.1530 uyarınca temerrüt faizi uygulanır.",
      sablon: "klasik", renk: "yesil",
      kalemler: [
        { aciklama: "Kurumsal web sitesi tasarımı ve geliştirmesi", miktar: "1", birim: "Hizmet", birimFiyat: "180000", iskonto: "0", iskontoTur: "oran", kdvOran: "20" },
        { aciklama: "Teknik danışmanlık", miktar: "24", birim: "Saat", birimFiyat: "3500", iskonto: "10", iskontoTur: "oran", kdvOran: "20" },
        { aciklama: "Yıllık sunucu ve bakım paketi", miktar: "12", birim: "Ay", birimFiyat: "4750", iskonto: "0", iskontoTur: "oran", kdvOran: "20" },
        { aciklama: "Basılı kullanım kılavuzu", miktar: "50", birim: "Adet", birimFiyat: "180", iskonto: "0", iskontoTur: "oran", kdvOran: "1" }
      ]
    });
    $("in-tevkifat").value = "0";
    $("alan-kur").hidden = true;
    ciz();
    acikBelgeCiz();
    durum("durum-genel", "Örnek teklif dolduruldu. “Arşive kaydet” deyip " +
      "sonra “→ Fatura” ile faturaya çevirebilirsiniz.", "basarili");
  }

  /* ------------------------------------------------------------- kurulum */
  function kur() {
    alan = alaniYukle();

    /* renk seçicisi */
    var renkKap = $("renk-secim");
    RENKLER.forEach(function (r) {
      var b = el("button", "renk-nokta");
      b.type = "button";
      b.setAttribute("data-renk", r.ad);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.setAttribute("aria-label", r.etiket);
      b.title = r.etiket;
      b.style.setProperty("--nokta", r.renk);
      b.addEventListener("click", function () { rengiUygula(r.ad); ciz(); });
      renkKap.appendChild(b);
    });

    /* tevkifat listesi */
    var tv = $("in-tevkifat");
    F.TEVKIFAT_ORANLARI.forEach(function (t, i) {
      var o = el("option");
      o.value = String(i);
      o.textContent = t.pay ? t.ad + " tevkifat" : "Yok";
      tv.appendChild(o);
    });

    /* durum listesi */
    var ds = $("in-acik-durum");
    A.DURUMLAR.forEach(function (d) {
      var o = el("option"); o.value = d.ad; o.textContent = d.etiket;
      ds.appendChild(o);
    });

    $("in-sablon").value = alan.ayar.sablon || "klasik";
    rengiUygula(alan.ayar.renk || "yesil");

    /* Son bırakılan yere dön: arşivdeki bir belge açıksa o, değilse kaydedilmemiş taslak. */
    if (alan.acikTaslak) {
      arsivdenForma(A.normalize({ belgeler: [alan.acikTaslak] }).belgeler[0]);
    } else if (alan.belgeler.length) {
      belgeyiAc(alan.belgeler[0].id);
    } else {
      FIRMA.forEach(function (k) {
        var e = $("in-firma-" + k);
        if (e) e.value = (alan.firma && alan.firma[k]) || "";
      });
      logoyuUygula((alan.firma && alan.firma.logo) || "");
      $("in-tarih").value = bugunIso();
      $("in-belge-no").value = yeniNo($("in-belge-turu").value);
      kalemEkle({});
    }

    musterileriListele();
    katalogCiz();
    ozetYillariniListele();

    /* --- olay bağlama --- */
    var form = $("fatura-form");
    form.addEventListener("input", ciz);
    form.addEventListener("change", ciz);
    form.addEventListener("submit", function (e) { e.preventDefault(); });

    $("in-para").addEventListener("change", function () {
      $("alan-kur").hidden = $("in-para").value === "TRY";
    });
    $("alan-kur").hidden = $("in-para").value === "TRY";

    $("in-belge-turu").addEventListener("change", function () {
      var mevcut = $("in-belge-no").value.trim();
      if (!mevcut || /^[A-ZÇĞİÖŞÜ]+\d{10}$/.test(mevcut)) {
        $("in-belge-no").value = yeniNo($("in-belge-turu").value);
      }
      ciz();
    });

    $("btn-genel-iskonto-tur").addEventListener("click", function () {
      var d = $("btn-genel-iskonto-tur");
      turuUygula(d, d.getAttribute("data-tur") === "oran" ? "tutar" : "oran");
      ciz();
    });
    turuUygula($("btn-genel-iskonto-tur"), "oran");

    $("btn-kalem-ekle").addEventListener("click", function () {
      kalemEkle({});
      ciz();
      var son = $("kalem-listesi").lastElementChild;
      if (son) son.querySelector(".k-aciklama").focus();
    });

    /* --- açık belge çubuğu --- */
    $("btn-arsive-kaydet").addEventListener("click", function () {
      var b = formdanArsiv();
      if (acikBelgeId) {
        A.belgeGuncelle(alan, acikBelgeId, b);
        durum("durum-genel", "Arşivdeki belge güncellendi.", "basarili");
      } else {
        var yeni = A.belgeEkle(alan, b);
        acikBelgeId = yeni.id;
        delete alan.acikTaslak;
        durum("durum-genel", yeni.no + " arşive kaydedildi.", "basarili");
      }
      alaniKaydet();
      arsiviCiz(); acikBelgeCiz(); ozetYillariniListele(); ozetCiz();
    });

    $("btn-yeni-belge").addEventListener("click", function () {
      acikBelgeId = null;
      delete alan.acikTaslak;
      MUSTERI.forEach(function (k) { var e = $("in-musteri-" + k); if (e) e.value = ""; });
      ["odeme-kosulu", "referans", "notlar", "kosullar"].forEach(function (k) {
        var e = $("in-" + k); if (e) e.value = "";
      });
      $("in-genel-iskonto").value = "0";
      $("in-tevkifat").value = "0";
      $("in-vade").value = "";
      $("in-tarih").value = bugunIso();
      $("in-belge-no").value = yeniNo($("in-belge-turu").value);
      $("kalem-listesi").textContent = "";
      kalemEkle({});
      ciz(); acikBelgeCiz(); arsiviCiz();
      durum("durum-genel", "Yeni belge hazır.", "basarili");
    });

    $("in-acik-durum").addEventListener("change", function () {
      if (!acikBelgeId) return;
      A.durumDegistir(alan, acikBelgeId, $("in-acik-durum").value);
      alaniKaydet(); arsiviCiz(); ozetCiz();
      durum("durum-genel", "Durum güncellendi.", "basarili");
    });

    /* --- arşiv süzgeçleri --- */
    $("in-arsiv-filtre").addEventListener("change", arsiviCiz);
    $("in-arsiv-ara").addEventListener("input", arsiviCiz);

    /* --- özet --- */
    $("in-ozet-yil").addEventListener("change", ozetCiz);
    $("blok-ozet").addEventListener("toggle", function () {
      if ($("blok-ozet").open) { ozetYillariniListele(); ozetCiz(); }
    });

    /* --- katalog --- */
    $("in-katalog").addEventListener("change", function () {
      var ix = $("in-katalog").value;
      if (ix === "") return;
      var k = alan.katalog[Number(ix)];
      if (!k) return;
      kalemEkle({ aciklama: k.aciklama, birim: k.birim, birimFiyat: k.birimFiyat,
                  kdvOran: k.kdvOran, miktar: "1", iskonto: "0", iskontoTur: "oran" });
      $("in-katalog").value = "";
      ciz();
    });

    $("btn-katalog-ekle").addEventListener("click", function () {
      var kalemler = kalemleriOku().filter(function (k) { return String(k.aciklama || "").trim(); });
      if (!kalemler.length) {
        durum("durum-katalog", "Önce en az bir kalem açıklaması yazın.", "uyari");
        return;
      }
      kalemler.forEach(function (k) { A.katalogEkle(alan, k); });
      alaniKaydet(); katalogCiz();
      durum("durum-katalog", kalemler.length + " kalem kataloğa eklendi.", "basarili");
    });

    $("btn-katalog-temizle").addEventListener("click", function () {
      if (!alan.katalog.length) return;
      if (!window.confirm("Katalogdaki " + alan.katalog.length + " kalem silinecek.")) return;
      alan.katalog = [];
      alaniKaydet(); katalogCiz();
      durum("durum-katalog", "Katalog temizlendi.", "basarili");
    });

    /* --- firma --- */
    $("btn-firma-kaydet").addEventListener("click", function () {
      var kayit = {};
      FIRMA.forEach(function (k) { kayit[k] = ($("in-firma-" + k) || {}).value || ""; });
      kayit.logo = $("bl-logo").getAttribute("src") || "";
      alan.firma = kayit;
      durum("durum-firma", alaniKaydet()
        ? "Firma bilgileriniz bu tarayıcıya kaydedildi." : "Kaydedilemedi.",
        "basarili");
    });

    $("in-logo").addEventListener("change", function (e) {
      var dosya = e.target.files && e.target.files[0];
      if (!dosya) return;
      if (dosya.size > 1024 * 1024) {
        durum("durum-firma", "Logo 1 MB'tan büyük olamaz (seçilen: " +
          Math.round(dosya.size / 1024) + " KB).", "uyari");
        e.target.value = "";
        return;
      }
      var okuyucu = new FileReader();
      okuyucu.onload = function () {
        logoyuUygula(String(okuyucu.result));
        ciz();
        durum("durum-firma", "Logo eklendi. Kalıcı olması için firma bilgilerinizi kaydedin.", "basarili");
      };
      okuyucu.readAsDataURL(dosya);
    });

    $("btn-logo-sil").addEventListener("click", function () {
      logoyuUygula("");
      $("in-logo").value = "";
      ciz();
      durum("durum-firma", "Logo kaldırıldı.", "basarili");
    });

    /* --- müşteri defteri --- */
    $("in-musteri-kayitli").addEventListener("change", function () {
      var ix = $("in-musteri-kayitli").value;
      if (ix === "") return;
      var m = alan.musteriler[Number(ix)];
      if (!m) return;
      MUSTERI.forEach(function (k) {
        var e = $("in-musteri-" + k);
        if (e) e.value = m[k] || "";
      });
      ciz();
    });

    $("btn-musteri-kaydet").addEventListener("click", function () {
      var m = {};
      MUSTERI.forEach(function (k) { m[k] = ($("in-musteri-" + k) || {}).value || ""; });
      if (!m.unvan.trim()) {
        durum("durum-musteri", "Önce müşteri ünvanını yazın.", "uyari");
        return;
      }
      var mevcut = -1;
      for (var i = 0; i < alan.musteriler.length; i++) {
        if ((alan.musteriler[i].unvan || "").trim().toLocaleLowerCase("tr-TR") ===
            m.unvan.trim().toLocaleLowerCase("tr-TR")) { mevcut = i; break; }
      }
      if (mevcut > -1) alan.musteriler[mevcut] = m; else alan.musteriler.push(m);
      alaniKaydet();
      musterileriListele(mevcut > -1 ? mevcut : alan.musteriler.length - 1);
      durum("durum-musteri", mevcut > -1 ? "Müşteri güncellendi." : "Müşteri deftere eklendi.", "basarili");
    });

    $("btn-musteri-sil").addEventListener("click", function () {
      var ix = $("in-musteri-kayitli").value;
      if (ix === "") { durum("durum-musteri", "Önce listeden bir müşteri seçin.", "uyari"); return; }
      alan.musteriler.splice(Number(ix), 1);
      alaniKaydet();
      musterileriListele();
      durum("durum-musteri", "Müşteri defterden silindi.", "basarili");
    });

    /* --- yedekleme ---
       Bu aracın en büyük riski sunucusuz olmasının bedeli: tarayıcı verisi
       silinirse arşiv gider. Yedek almak bu yüzden ikincil bir özellik değil. */
    $("btn-yedek-al").addEventListener("click", function () {
      var ad = "fatura-merkezi-yedek-" + A.bugun() + ".json";
      dosyaIndir(ad, JSON.stringify(A.disaAktar(alan), null, 2), "application/json");
      durum("durum-genel", alan.belgeler.length + " belge yedeklendi: " + ad, "basarili");
    });

    $("in-yedek-yukle").addEventListener("change", function (e) {
      var dosya = e.target.files && e.target.files[0];
      if (!dosya) return;
      var okuyucu = new FileReader();
      okuyucu.onload = function () {
        var gelen = null;
        try { gelen = A.iceAktar(JSON.parse(String(okuyucu.result))); }
        catch (hata) { gelen = null; }
        if (!gelen) {
          durum("durum-genel", "Dosya okunamadı: bu araçla alınmış bir yedek bekleniyor.", "uyari");
          e.target.value = "";
          return;
        }
        if (alan.belgeler.length && !window.confirm(
            "Yüklenecek yedekte " + gelen.belgeler.length + " belge var. " +
            "Şu anki " + alan.belgeler.length + " belgelik arşivin YERİNE geçecek. " +
            "Devam edilsin mi?")) { e.target.value = ""; return; }
        alan = gelen;
        acikBelgeId = null;
        alaniKaydet();
        FIRMA.forEach(function (k) {
          var el2 = $("in-firma-" + k);
          if (el2) el2.value = (alan.firma && alan.firma[k]) || "";
        });
        logoyuUygula((alan.firma && alan.firma.logo) || "");
        musterileriListele(); katalogCiz(); ozetYillariniListele();
        if (alan.belgeler.length) belgeyiAc(alan.belgeler[0].id);
        else { $("kalem-listesi").textContent = ""; kalemEkle({}); ciz(); }
        arsiviCiz(); acikBelgeCiz(); ozetCiz();
        durum("durum-genel", gelen.belgeler.length + " belgelik yedek yüklendi.", "basarili");
        e.target.value = "";
      };
      okuyucu.readAsText(dosya);
    });

    /* --- tek belge dışa aktarma (paylaşmak için) --- */
    $("btn-json-kaydet").addEventListener("click", function () {
      var b = formdanArsiv();
      dosyaIndir(dosyaAdi(b, ".json"), JSON.stringify(b, null, 2), "application/json");
      durum("durum-genel", "Belge JSON olarak indirildi.", "basarili");
    });

    /* --- PDF --- */
    $("btn-pdf").addEventListener("click", function () {
      var b = formdanArsiv();
      var eskiBaslik = document.title;
      document.title = dosyaAdi(b, "");
      window.print();
      setTimeout(function () { document.title = eskiBaslik; }, 500);
    });

    $("btn-ornek").addEventListener("click", ornekDoldur);

    $("btn-temizle").addEventListener("click", function () {
      if (!window.confirm(
        "Bu tarayıcıdaki TÜM çalışma alanı silinecek: " + alan.belgeler.length +
        " belge, " + alan.musteriler.length + " müşteri, firma bilgileri ve katalog. " +
        "Bu işlem geri alınamaz. Önce yedek almak ister misiniz?\n\n" +
        "Yine de silmek için Tamam'a basın.")) return;
      try { localStorage.removeItem(DEPO); } catch (e) { /* yoksay */ }
      Object.keys(ESKI).forEach(function (k) {
        try { localStorage.removeItem(ESKI[k]); } catch (e) { /* yoksay */ }
      });
      alan = A.bosCalismaAlani();
      acikBelgeId = null;
      FIRMA.forEach(function (k) { var e = $("in-firma-" + k); if (e) e.value = ""; });
      MUSTERI.forEach(function (k) { var e = $("in-musteri-" + k); if (e) e.value = ""; });
      ["odeme-kosulu", "referans", "notlar", "kosullar"].forEach(function (k) {
        var e = $("in-" + k); if (e) e.value = "";
      });
      $("in-genel-iskonto").value = "0";
      $("in-tevkifat").value = "0";
      $("in-vade").value = "";
      $("in-tarih").value = bugunIso();
      $("in-belge-no").value = yeniNo($("in-belge-turu").value);
      logoyuUygula("");
      $("in-logo").value = "";
      $("kalem-listesi").textContent = "";
      kalemEkle({});
      musterileriListele(); katalogCiz(); ozetYillariniListele();
      ciz(); arsiviCiz(); acikBelgeCiz(); ozetCiz();
      durum("durum-genel", "Çalışma alanı temizlendi.", "basarili");
    });

    ciz();
    arsiviCiz();
    acikBelgeCiz();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kur);
  } else {
    kur();
  }
})();
