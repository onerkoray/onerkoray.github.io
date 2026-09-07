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

  /* ------------------------------------------------------------ yerel depo */
  var ANAHTAR = {
    firma: "fatura:firma",
    musteriler: "fatura:musteriler",
    taslak: "fatura:taslak",
    ayar: "fatura:ayar",
    sayac: "fatura:sayac"
  };

  /* localStorage gizli sekmede ve site verisi kapalı tarayıcılarda okurken
     bile istisna atabiliyor; her erişim sarmalanıyor. */
  function depoOku(anahtar, varsayilan) {
    try {
      var s = localStorage.getItem(anahtar);
      return s ? JSON.parse(s) : varsayilan;
    } catch (e) { return varsayilan; }
  }
  function depoYaz(anahtar, deger) {
    try { localStorage.setItem(anahtar, JSON.stringify(deger)); return true; }
    catch (e) { return false; }
  }
  function depoSil(anahtar) {
    try { localStorage.removeItem(anahtar); } catch (e) { /* yoksay */ }
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

  /* ------------------------------------------------------------ form <-> nesne */
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

  /* ------------------------------------------------------------ taslak */
  var taslakZamanlayici = null;
  function taslakKaydet(b) {
    clearTimeout(taslakZamanlayici);
    taslakZamanlayici = setTimeout(function () { depoYaz(ANAHTAR.taslak, b); }, 400);
  }

  /* ------------------------------------------------------------ belge no */
  function sonrakiNo(tur) {
    var onek = BELGE_ONEK[tur] || "BLG";
    var yil = new Date().getFullYear();
    var sayaclar = depoOku(ANAHTAR.sayac, {});
    var anahtar = onek + yil;
    var deger = Number(sayaclar[anahtar] || 0) + 1;
    return { metin: anahtar + String(deger).padStart(6, "0"), anahtar: anahtar, deger: deger };
  }
  /* Numara ancak belge dışa aktarıldığında "kullanılmış" sayılır; her tuşta
     artsaydı sayaç boşuna şişerdi. */
  function noyuTuket() {
    var mevcut = $("in-belge-no").value.trim();
    var eslesme = /^([A-ZÇĞİÖŞÜ]+\d{4})(\d+)$/.exec(mevcut);
    if (!eslesme) return;
    var sayaclar = depoOku(ANAHTAR.sayac, {});
    sayaclar[eslesme[1]] = Math.max(Number(sayaclar[eslesme[1]] || 0), Number(eslesme[2]));
    depoYaz(ANAHTAR.sayac, sayaclar);
  }

  /* ------------------------------------------------------------ müşteri defteri */
  function musterileriListele(secili) {
    var s = $("in-musteri-kayitli");
    var defter = depoOku(ANAHTAR.musteriler, []);
    s.textContent = "";
    var ilk = el("option");
    ilk.value = "";
    ilk.textContent = defter.length ? "— Yeni müşteri —" : "— Kayıtlı müşteri yok —";
    s.appendChild(ilk);
    defter.forEach(function (m, i) {
      var o = el("option");
      o.value = String(i);
      o.textContent = m.unvan || "(isimsiz)";
      s.appendChild(o);
    });
    if (secili != null) s.value = String(secili);
  }

  /* ------------------------------------------------------------ dosya */
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
    var parcalar = [(b["belge-turu"] || "belge").replace(/\s+/g, "-")];
    if (b["belge-no"]) parcalar.push(b["belge-no"]);
    if (b.musteri && b.musteri.unvan) {
      parcalar.push(b.musteri.unvan.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, "-").replace(/^-|-$/g, ""));
    }
    return parcalar.join("-").slice(0, 90) + uzanti;
  }

  /* ------------------------------------------------------------ örnek */
  function ornekDoldur() {
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
      "belge-turu": "PROFORMA FATURA",
      "belge-no": sonrakiNo("PROFORMA FATURA").metin,
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
    ciz();
    durum("durum-genel", "Örnek fatura dolduruldu.", "basarili");
  }

  /* ------------------------------------------------------------ kurulum */
  function kur() {
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
      b.addEventListener("click", function () {
        rengiUygula(r.ad);
        depoYaz(ANAHTAR.ayar, { sablon: $("in-sablon").value, renk: r.ad });
        ciz();
      });
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

    /* kayıtlı ayar ve firma */
    var ayar = depoOku(ANAHTAR.ayar, { sablon: "klasik", renk: "yesil" });
    $("in-sablon").value = ayar.sablon || "klasik";
    rengiUygula(ayar.renk || "yesil");

    var taslak = depoOku(ANAHTAR.taslak, null);
    if (taslak) {
      belgeyiYaz(taslak);
    } else {
      var firma = depoOku(ANAHTAR.firma, null);
      if (firma) {
        FIRMA.forEach(function (k) {
          var e = $("in-firma-" + k);
          if (e) e.value = firma[k] || "";
        });
        logoyuUygula(firma.logo || "");
      }
      $("in-tarih").value = bugunIso();
      $("in-belge-no").value = sonrakiNo($("in-belge-turu").value).metin;
      kalemEkle({});
    }
    musterileriListele();

    /* --- olay bağlama --- */
    var form = $("fatura-form");
    form.addEventListener("input", ciz);
    form.addEventListener("change", ciz);
    form.addEventListener("submit", function (e) { e.preventDefault(); });

    $("in-para").addEventListener("change", function () {
      $("alan-kur").hidden = $("in-para").value === "TRY";
    });
    $("alan-kur").hidden = $("in-para").value === "TRY";

    $("in-sablon").addEventListener("change", function () {
      depoYaz(ANAHTAR.ayar, { sablon: $("in-sablon").value, renk: $("belge").getAttribute("data-renk") });
    });

    /* Belge türü değişince numara öneki de değişmeli; ama kullanıcı numarayı
       elle yazdıysa ona dokunulmaz. */
    $("in-belge-turu").addEventListener("change", function () {
      var mevcut = $("in-belge-no").value.trim();
      var otomatik = /^[A-ZÇĞİÖŞÜ]+\d{10}$/.test(mevcut);
      if (!mevcut || otomatik) {
        $("in-belge-no").value = sonrakiNo($("in-belge-turu").value).metin;
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

    /* --- firma --- */
    $("btn-firma-kaydet").addEventListener("click", function () {
      var kayit = {};
      FIRMA.forEach(function (k) { kayit[k] = ($("in-firma-" + k) || {}).value || ""; });
      kayit.logo = $("bl-logo").getAttribute("src") || "";
      var yazildi = depoYaz(ANAHTAR.firma, kayit);
      durum("durum-firma", yazildi
        ? "Firma bilgileriniz bu tarayıcıya kaydedildi."
        : "Kaydedilemedi — tarayıcınız site verisi saklamayı engelliyor olabilir.",
        yazildi ? "basarili" : "uyari");
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
      var m = depoOku(ANAHTAR.musteriler, [])[Number(ix)];
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
      var defter = depoOku(ANAHTAR.musteriler, []);
      /* Aynı ünvan yeniden kaydedilirse yeni kayıt açılmaz, mevcut güncellenir. */
      var mevcut = -1;
      for (var i = 0; i < defter.length; i++) {
        if ((defter[i].unvan || "").trim().toLocaleLowerCase("tr-TR") ===
            m.unvan.trim().toLocaleLowerCase("tr-TR")) { mevcut = i; break; }
      }
      if (mevcut > -1) defter[mevcut] = m; else defter.push(m);
      if (depoYaz(ANAHTAR.musteriler, defter)) {
        musterileriListele(mevcut > -1 ? mevcut : defter.length - 1);
        durum("durum-musteri", mevcut > -1 ? "Müşteri güncellendi." : "Müşteri deftere eklendi.", "basarili");
      } else {
        durum("durum-musteri", "Kaydedilemedi — tarayıcı site verisi saklamıyor.", "uyari");
      }
    });

    $("btn-musteri-sil").addEventListener("click", function () {
      var ix = $("in-musteri-kayitli").value;
      if (ix === "") { durum("durum-musteri", "Önce listeden bir müşteri seçin.", "uyari"); return; }
      var defter = depoOku(ANAHTAR.musteriler, []);
      defter.splice(Number(ix), 1);
      depoYaz(ANAHTAR.musteriler, defter);
      musterileriListele();
      durum("durum-musteri", "Müşteri defterden silindi.", "basarili");
    });

    /* --- dışa/içe aktarma --- */
    $("btn-json-kaydet").addEventListener("click", function () {
      var b = belgeyiOku();
      noyuTuket();
      dosyaIndir(dosyaAdi(b, ".json"), JSON.stringify(b, null, 2), "application/json");
      durum("durum-genel", "Fatura JSON olarak indirildi.", "basarili");
    });

    $("in-json-yukle").addEventListener("change", function (e) {
      var dosya = e.target.files && e.target.files[0];
      if (!dosya) return;
      var okuyucu = new FileReader();
      okuyucu.onload = function () {
        try {
          var b = JSON.parse(String(okuyucu.result));
          if (!b || typeof b !== "object") throw new Error("biçim");
          belgeyiYaz(b);
          ciz();
          durum("durum-genel", "Fatura yüklendi.", "basarili");
        } catch (hata) {
          durum("durum-genel", "Dosya okunamadı: bu araçla kaydedilmiş bir .json bekleniyor.", "uyari");
        }
        e.target.value = "";
      };
      okuyucu.readAsText(dosya);
    });

    /* --- PDF --- */
    $("btn-pdf").addEventListener("click", function () {
      var b = belgeyiOku();
      if (!b.firma.unvan.trim() || !b.musteri.unvan.trim()) {
        durum("durum-genel", "Firma ve müşteri ünvanı boşken de yazdırabilirsiniz; " +
          "ama belgede yer tutucu metin görünür.", "uyari");
      }
      noyuTuket();
      /* Tarayıcı "PDF olarak kaydet"te dosya adını sayfa başlığından türetir. */
      var eskiBaslik = document.title;
      document.title = dosyaAdi(b, "");
      window.print();
      setTimeout(function () { document.title = eskiBaslik; }, 500);
    });

    $("btn-ornek").addEventListener("click", ornekDoldur);

    $("btn-temizle").addEventListener("click", function () {
      if (!window.confirm(
        "Formdaki her şey ve bu tarayıcıda saklanan firma bilgisi, müşteri defteri " +
        "ve taslak silinecek. Devam edilsin mi?")) return;
      depoSil(ANAHTAR.firma);
      depoSil(ANAHTAR.musteriler);
      depoSil(ANAHTAR.taslak);
      depoSil(ANAHTAR.ayar);
      depoSil(ANAHTAR.sayac);
      FIRMA.forEach(function (k) { var e = $("in-firma-" + k); if (e) e.value = ""; });
      MUSTERI.forEach(function (k) { var e = $("in-musteri-" + k); if (e) e.value = ""; });
      ["odeme-kosulu", "referans", "notlar", "kosullar"].forEach(function (k) {
        var e = $("in-" + k); if (e) e.value = "";
      });
      $("in-genel-iskonto").value = "0";
      $("in-tevkifat").value = "0";
      $("in-vade").value = "";
      $("in-tarih").value = bugunIso();
      $("in-belge-no").value = sonrakiNo($("in-belge-turu").value).metin;
      logoyuUygula("");
      $("in-logo").value = "";
      $("kalem-listesi").textContent = "";
      kalemEkle({});
      musterileriListele();
      ciz();
      durum("durum-genel", "Her şey temizlendi.", "basarili");
    });

    ciz();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kur);
  } else {
    kur();
  }
})();
