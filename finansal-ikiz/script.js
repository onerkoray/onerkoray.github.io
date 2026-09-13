/*!
 * Finansal İkiz — arayüz.
 *
 * Bu dosya SADECE arayüzdür: tek bir finansal formül içermez. Şema ve
 * saklama finans/profil.js'te, projeksiyon finans/ikiz-motoru.js'te,
 * ücret matematiği bordro motorunda — üçü de testlerle korunuyor.
 *
 * ANLATIM KARARI: birincil sayı 20 yıl sonundaki REEL net değer değil,
 * onun BANDI. Tek bir sayıyı büyük yazmak, modelin sahip olmadığı bir
 * kesinliği satmak olurdu. Kartta aralık var; bandın genişliği de ayrıca
 * söyleniyor.
 *
 * Lisans: MIT — Koray Öner
 */
(function () {
  "use strict";
  var P = window.Profil;
  var I = window.IkizMotoru;
  var F = window.Finans;
  if (!P || !I || !F) return;

  function $(id) { return document.getElementById(id); }

  var para0 = new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 0
  });
  function para(n) { return para0.format(n || 0); }
  function kisa(n) {
    var m = Math.abs(n);
    var s = m >= 1e9 ? (m / 1e9).toFixed(1).replace(".", ",") + " Mr"
      : m >= 1e6 ? (m / 1e6).toFixed(1).replace(".", ",") + " M"
      : m >= 1000 ? Math.round(m / 1000) + " B" : String(Math.round(m));
    return (n < 0 ? "−" : "") + "₺" + s;
  }
  function yuzde(x, b) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    var d = b === undefined ? 1 : b;
    var m = (Math.abs(x) * 100).toFixed(d).replace(".", ",");
    return (x < 0 ? "−" : "") + "%" + m;
  }
  function deger(id) { return F.sayi($(id).value); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Örnek profil: araç boş bir formla değil, çalışır hâlde açılıyor ki
     ne yaptığı ilk bakışta görünsün. Kullanıcı üzerine yazıyor. */
  var ORNEK = {
    kisi: { dogumYili: 1990 },
    gelirler: [{ ad: "Maaş", tur: "ucret", aylikBrut: 100000 }],
    giderler: [
      { ad: "Kira / konut", aylik: 22000, zorunlu: true, enflasyonaEndeksli: true },
      { ad: "Market ve mutfak", aylik: 14000, zorunlu: true, enflasyonaEndeksli: true },
      { ad: "Faturalar", aylik: 5500, zorunlu: true, enflasyonaEndeksli: true },
      { ad: "Ulaşım", aylik: 6000, zorunlu: true, enflasyonaEndeksli: true },
      { ad: "Keyif ve abonelik", aylik: 9000, zorunlu: false, enflasyonaEndeksli: true }
    ],
    varliklar: [
      { ad: "Mevduat", tur: "mevduat", deger: 300000 },
      { ad: "Altın", tur: "altin", deger: 150000 }
    ],
    borclar: [
      { ad: "İhtiyaç kredisi", tur: "ihtiyac", kalanAnapara: 120000,
        aylikFaiz: 0.032, kalanVadeAy: 24, aylikOdeme: 7000 }
    ]
  };

  var TUR_ADLARI = {
    nakit: "Nakit", mevduat: "Mevduat", fon: "Yatırım fonu", hisse: "Hisse",
    tahvil: "Tahvil", doviz: "Döviz", altin: "Altın", kripto: "Kripto",
    bes: "BES", konut: "Konut", arac: "Araç", diger: "Diğer"
  };

  /* --------------------------- satır üreticiler -------------------------- */
  function sil(tr) {
    tr.remove();
    hesapla();
  }
  function baglan(tr) {
    tr.querySelectorAll("input, select").forEach(function (el) {
      el.addEventListener("input", hesapla);
      el.addEventListener("change", hesapla);
    });
    tr.querySelector(".fi-sil").addEventListener("click", function () { sil(tr); });
    return tr;
  }

  function giderSatiri(k) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="fi-ad"><input type="text" value="' + esc(k.ad || "") + '" aria-label="Gider adı"></td>' +
      '<td class="fi-sayi"><input type="text" inputmode="decimal" value="' + (k.aylik || 0) + '" aria-label="Aylık tutar"></td>' +
      '<td><label class="fi-onay-h"><input type="checkbox"' + (k.zorunlu ? " checked" : "") + ' aria-label="Zorunlu gider"></label></td>' +
      '<td><label class="fi-onay-h"><input type="checkbox"' + (k.enflasyonaEndeksli === false ? "" : " checked") + ' aria-label="Enflasyona endeksli"></label></td>' +
      '<td><button type="button" class="fi-sil" aria-label="Satırı sil">×</button></td>';
    $("fi-giderler").appendChild(baglan(tr));
  }

  function varlikSatiri(v) {
    var secenekler = P.VARLIK_TURLERI.map(function (t) {
      return '<option value="' + t + '"' + (t === v.tur ? " selected" : "") + ">" +
        (TUR_ADLARI[t] || t) + "</option>";
    }).join("");
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="fi-ad"><input type="text" value="' + esc(v.ad || "") + '" aria-label="Varlık adı"></td>' +
      '<td class="fi-tur"><select aria-label="Varlık türü">' + secenekler + "</select></td>" +
      '<td class="fi-sayi"><input type="text" inputmode="decimal" value="' + (v.deger || 0) + '" aria-label="Değer"></td>' +
      '<td><button type="button" class="fi-sil" aria-label="Satırı sil">×</button></td>';
    $("fi-varliklar").appendChild(baglan(tr));
  }

  function borcSatiri(b) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="fi-ad"><input type="text" value="' + esc(b.ad || "") + '" aria-label="Borç adı"></td>' +
      '<td class="fi-sayi"><input type="text" inputmode="decimal" value="' + (b.kalanAnapara || 0) + '" aria-label="Kalan anapara"></td>' +
      '<td class="fi-sayi"><input type="text" inputmode="decimal" value="' + ((b.aylikFaiz || 0) * 100).toFixed(2).replace(".", ",") + '" aria-label="Aylık faiz yüzdesi"></td>' +
      '<td class="fi-sayi"><input type="text" inputmode="decimal" value="' + (b.aylikOdeme || 0) + '" aria-label="Aylık ödeme"></td>' +
      '<td><button type="button" class="fi-sil" aria-label="Satırı sil">×</button></td>';
    $("fi-borclar").appendChild(baglan(tr));
  }

  /* ------------------------------ okuma ---------------------------------- */
  function profiliOku() {
    var giderler = Array.prototype.map.call(
      $("fi-giderler").querySelectorAll("tr"), function (tr) {
        var g = tr.querySelectorAll("input");
        return { ad: g[0].value.trim() || "Gider", aylik: F.sayi(g[1].value),
          zorunlu: g[2].checked, enflasyonaEndeksli: g[3].checked };
      });
    var varliklar = Array.prototype.map.call(
      $("fi-varliklar").querySelectorAll("tr"), function (tr) {
        return { ad: tr.querySelectorAll("input")[0].value.trim() || "Varlık",
          tur: tr.querySelector("select").value,
          deger: F.sayi(tr.querySelectorAll("input")[1].value) };
      });
    var borclar = Array.prototype.map.call(
      $("fi-borclar").querySelectorAll("tr"), function (tr) {
        var g = tr.querySelectorAll("input");
        return { ad: g[0].value.trim() || "Borç", kalanAnapara: F.sayi(g[1].value),
          aylikFaiz: F.sayi(g[2].value) / 100, aylikOdeme: F.sayi(g[3].value),
          kalanVadeAy: 360 };
      });

    var brut = deger("in-brut");
    var diger = deger("in-diger");
    var gelirler = [];
    if (isFinite(brut) && brut > 0) gelirler.push({ ad: "Maaş", tur: "ucret", aylikBrut: brut });
    if (isFinite(diger) && diger > 0) gelirler.push({ ad: "Diğer gelir", tur: "diger", aylikNet: diger });

    return P.normalize({
      kisi: { dogumYili: deger("in-dogum") },
      gelirler: gelirler, giderler: giderler,
      varliklar: varliklar, borclar: borclar,
      varsayimlar: {
        enflasyon: deger("in-enf") / 100,
        ucretArtisi: deger("in-zam") / 100,
        yatirimGetirisi: deger("in-getiri") / 100,
        ufukYil: deger("in-ufuk")
      }
    });
  }

  function profiliYaz(p) {
    $("in-dogum").value = p.kisi.dogumYili || "";
    var ucret = p.gelirler.filter(function (g) { return g.tur === "ucret"; })[0];
    var diger = p.gelirler.filter(function (g) { return g.tur !== "ucret"; });
    $("in-brut").value = ucret ? ucret.aylikBrut : 0;
    $("in-diger").value = diger.reduce(function (a, g) { return a + g.aylikNet; }, 0);
    $("in-enf").value = (p.varsayimlar.enflasyon * 100).toFixed(0);
    $("in-zam").value = (p.varsayimlar.ucretArtisi * 100).toFixed(0);
    $("in-getiri").value = (p.varsayimlar.yatirimGetirisi * 100).toFixed(0);
    $("in-ufuk").value = p.varsayimlar.ufukYil;
    $("fi-giderler").innerHTML = "";
    $("fi-varliklar").innerHTML = "";
    $("fi-borclar").innerHTML = "";
    p.giderler.forEach(giderSatiri);
    p.varliklar.forEach(varlikSatiri);
    p.borclar.forEach(borcSatiri);
  }

  /* ------------------------------ çıktılar ------------------------------- */
  function reelSatiri(p) {
    var v = p.varsayimlar;
    var reel = (1 + v.yatirimGetirisi) / (1 + v.enflasyon) - 1;
    var ucretReel = (1 + v.ucretArtisi) / (1 + v.enflasyon) - 1;
    /* Uzun vadede serveti belirleyen şey nominal getiri değil REEL
       getiridir; üç nominal girdinin asıl sonucu bu ve girdilerin hemen
       altında durması gerekiyor. */
    return "Bu üç varsayımın anlamı: yatırımınız yılda reel <strong>" +
      yuzde(reel, 2) + "</strong>, ücretiniz reel <strong>" +
      yuzde(ucretReel, 2) + "</strong> " +
      (ucretReel >= 0 ? "kazanıyor" : "kaybediyor") +
      ". Uzun vadede serveti belirleyen sayı nominal değil, budur.";
  }

  function kutu(ad, d, alt) {
    return '<div class="fi-kutu"><p class="fi-kutu-ad">' + ad + "</p>" +
      '<p class="fi-kutu-deger">' + d + "</p>" +
      (alt ? '<p class="fi-kutu-alt">' + alt + "</p>" : "") + "</div>";
  }

  function bugun(p, o) {
    var dayanma = o.dayanmaAy === null ? "—"
      : o.dayanmaAy.toFixed(1).replace(".", ",") + " ay";
    return '<div class="fi-kutular">' +
      kutu("Net değer", para(o.netDeger),
        para(o.toplamVarlik) + " varlık − " + para(o.toplamBorc) + " borç.") +
      kutu("Likit varlık", para(o.likitVarlik),
        "Konut ve araç hariç; hemen nakde çevrilebilenler.") +
      kutu("Dayanma süresi", dayanma,
        "Geliriniz kesilse zorunlu gider ve borç ödemesiyle.") +
      kutu("Aylık zorunlu yük", para(o.aylikZorunluYuk),
        para(o.zorunluGider) + " gider + " + para(o.aylikBorcOdemesi) + " borç.") +
      "</div>";
  }

  function kararKarti(u, p) {
    var son = u.bant[u.bant.length - 1];
    if (!son) return "";
    var yil = son.yil;
    var oran = u.bantOrani;
    var genislikCumle = oran === null ? ""
      : " Bandın genişliği medyanın <strong>" +
        oran.toFixed(1).replace(".", ",") + " katı</strong> — " +
        (oran > 2.5
          ? "yani sonuç varsayımlarınıza çok duyarlı. Bu bir kusur değil; "
            + "yirmi yıllık bir projeksiyon gerçekten bu kadar belirsizdir."
          : "bu ufukta sonuç varsayımlara görece az duyarlı.");

    return '<div class="fi-karar">' +
      '<p class="fi-etiket">' + yil + " yılında reel net değeriniz</p>" +
      /* Ayrac "ile": negatif degerlerde tire, eksi isaretiyle karisiyor
         ("-30,2 M - -10,0 M" okunmuyor). */
      '<p class="fi-buyuk">' + kisa(son.alt) + " ile " + kisa(son.ust) + "</p>" +
      '<p class="fi-cumle">Baz senaryoda <strong>' + para(son.orta) +
      "</strong> (bugünün parasıyla). Bu bir tahmin değil: üç senaryonun " +
      "tamamı sizin varsayımlarınızdan çıkıyor." + genislikCumle + "</p>" +
      '<p class="fi-not">Değerler bugünün alım gücüne indirgenmiştir. ' +
      "Nominal rakamlar yirmi yıllık bir grafikte yanıltıcı olurdu.</p></div>";
  }

  function uyarilar(u, o) {
    var h = "";
    if (o.eksikler.length) {
      h += '<p class="fi-uyari fi-eksik"><strong>Model eksik:</strong> ' +
        o.eksikler.join(", ") + " girilmemiş. Sonuç bu eksiklerle " +
        "hesaplandı; tamamlamadan karar vermeyin.</p>";
    }
    if (u.kotumserdeTukenme) {
      h += '<p class="fi-uyari"><strong>Kötümser senaryoda varlıklarınız ' +
        u.kotumserdeTukenme + " yılında tükeniyor.</strong> Grafikte o " +
        "noktadan sonraki kesikli çizgi servet değil, kapatmanız gereken " +
        "açığın büyüklüğüdür. Bu senaryonun varsayımlarını gözden geçirin " +
        "ya da planı ona göre kurun.</p>";
    }
    if (u.baz.odenmemisBorc) {
      h += '<p class="fi-uyari"><strong>Bir borç ufuk sonunda kapanmıyor:</strong> ' +
        "aylık ödeme faizi karşılamıyor ve anapara büyüyor. Ödeme tutarını " +
        'kontrol edin ya da <a href="../borc-kapatma-plani/">borç kapatma ' +
        "planına</a> bakın.</p>";
    }
    return h;
  }

  function bandGrafigi(u, p) {
    if (!window.Bant) return "";
    var olaylar = [];
    u.baz.borcBitisleri.forEach(function (b) {
      olaylar.push({ yil: b.yil, ad: b.ad + " biter" });
    });
    if (p.kisi.dogumYili) {
      var emeklilikYili = p.kisi.dogumYili + p.kisi.emeklilikHedefYasi;
      var ilk = u.bant[0], son = u.bant[u.bant.length - 1];
      if (ilk && son && emeklilikYili > ilk.yil && emeklilikYili < son.yil) {
        olaylar.push({ yil: emeklilikYili, ad: "Emeklilik hedefi" });
      }
    }
    if (u.kotumserdeTukenme) {
      olaylar.push({ yil: u.kotumserdeTukenme, ad: "Kötümserde tükenme" });
    }
    olaylar.sort(function (a, b) { return a.yil - b.yil; });

    return window.Bant.ciz({
      bant: u.bant,
      tukenmeYili: u.kotumserdeTukenme || null,
      olaylar: olaylar,
      baslik: "Reel net değeriniz — üç senaryo",
      bicim: kisa,
      not: "Değerler bugünün parasıyla. Band, kötümser ve iyimser " +
        "senaryolarınız arasındaki aralık; ortadaki çizgi baz senaryo. " +
        "Bu bir olasılık dağılımı değil — üç varsayım kümesinin sonucu."
    });
  }

  function duyarlilikTablosu(p) {
    var d = I.duyarlilik(p);
    var enBuyuk = d.kalemler.reduce(function (a, k) {
      return Math.max(a, Math.abs(k.etki));
    }, 0) || 1;
    var satir = d.kalemler.map(function (k) {
      var gen = Math.max(1, Math.round(Math.abs(k.etki) / enBuyuk * 48));
      var stil = k.etki >= 0 ? "left:50%;width:" + gen + "%"
        : "right:50%;width:" + gen + "%";
      return "<tr><th scope=\"row\">" + esc(k.ad) + "</th><td>" + esc(k.birim) +
        "</td><td>" + (k.etki >= 0 ? "+" : "−") + kisa(Math.abs(k.etki)) +
        "</td><td>" + yuzde(k.oran) + "</td>" +
        '<td class="fi-cubuk-h"><span class="fi-cubuk-yol">' +
        '<span class="fi-cubuk-sifir"></span>' +
        '<span class="fi-cubuk ' + (k.etki >= 0 ? "fi-arti" : "fi-eksi") +
        '" style="' + stil + '"></span></span></td></tr>';
    }).join("");
    return '<div class="fi-duyarlilik"><table>' +
      "<caption>Hangi varsayım sonucu en çok değiştiriyor? Her satır, o " +
      "değişken tek başına oynatılıp modelin TAMAMI yeniden koşularak " +
      "ölçüldü — yaklaşık türev değil.</caption>" +
      '<thead><tr><th scope="col">Değişken</th><th scope="col">Değişim</th>' +
      '<th scope="col">Reel net değere etkisi</th><th scope="col">Oran</th>' +
      '<th scope="col"><span class="visually-hidden">Etki çubuğu</span></th>' +
      "</tr></thead><tbody>" + satir + "</tbody></table></div>";
  }

  /* -------------------------------- akış --------------------------------- */
  var zamanlayici = null;
  function hesapla() {
    $("fi-reel").innerHTML = "";
    clearTimeout(zamanlayici);
    /* Projeksiyon üç senaryo × 240 ay + beş duyarlılık koşumu. Her tuş
       vuruşunda koşturmak formu takardı; kısa bir gecikme yeterli. */
    zamanlayici = setTimeout(cizdir, 160);
  }

  function cizdir() {
    var p;
    try { p = profiliOku(); }
    catch (e) { return; }

    $("fi-reel").innerHTML = reelSatiri(p);

    var o = P.ozet(p);
    var u = I.ucSenaryo(p);
    $("sonuc").innerHTML =
      kararKarti(u, p) + bugun(p, o) + uyarilar(u, o) +
      bandGrafigi(u, p) + duyarlilikTablosu(p);

    if ($("in-sakla").checked) P.sakla(p);
  }

  /* ------------------------------ saklama -------------------------------- */
  function mesaj(m) {
    $("fi-dosya-mesaj").textContent = m || "";
  }

  $("in-sakla").addEventListener("change", function () {
    var acik = this.checked;
    P.onayVer(acik);
    if (acik) {
      var s = P.sakla(profiliOku());
      mesaj(s.yazildi ? "Profil bu cihaza kaydedildi."
        : "Kaydedilemedi (tarayıcı deposu kullanılamıyor).");
      if (!s.yazildi) this.checked = false;
    } else {
      mesaj("Saklama kapatıldı ve cihazdaki kayıt silindi.");
    }
  });

  $("fi-disa").addEventListener("click", function () {
    var veri = P.disaAktar(profiliOku());
    var bag = document.createElement("a");
    bag.href = URL.createObjectURL(new Blob([veri], { type: "application/json" }));
    bag.download = "finansal-ikiz-profil.json";
    document.body.appendChild(bag);
    bag.click();
    document.body.removeChild(bag);
    URL.revokeObjectURL(bag.href);
    mesaj("Profil dosyaya kaydedildi.");
  });

  $("fi-ice").addEventListener("change", function () {
    var dosya = this.files && this.files[0];
    if (!dosya) return;
    var okuyucu = new FileReader();
    okuyucu.onload = function () {
      var s = P.iceAktar(String(okuyucu.result));
      if (s.hata) { mesaj(s.hata); return; }
      profiliYaz(s.profil);
      mesaj("Profil dosyadan yüklendi.");
      hesapla();
    };
    okuyucu.readAsText(dosya);
    this.value = "";
  });

  $("fi-sifirla").addEventListener("click", function () {
    profiliYaz(P.normalize(ORNEK));
    mesaj("Örnek profile dönüldü.");
    hesapla();
  });

  document.querySelectorAll(".fi-ekle").forEach(function (d) {
    d.addEventListener("click", function () {
      var t = d.getAttribute("data-ekle");
      if (t === "gider") giderSatiri({ ad: "", aylik: 0, zorunlu: false });
      if (t === "varlik") varlikSatiri({ ad: "", tur: "mevduat", deger: 0 });
      if (t === "borc") borcSatiri({ ad: "", kalanAnapara: 0, aylikFaiz: 0.02, aylikOdeme: 0 });
      hesapla();
    });
  });

  document.querySelectorAll("#fi-form .fi-grid input").forEach(function (el) {
    el.addEventListener("input", hesapla);
    el.addEventListener("change", hesapla);
  });

  /* Açılış: saklanmış profil varsa o, yoksa örnek. */
  var saklanan = P.yukle();
  if (saklanan) {
    profiliYaz(saklanan);
    $("in-sakla").checked = true;
    mesaj("Bu cihazda saklanan profiliniz yüklendi.");
  } else {
    profiliYaz(P.normalize(ORNEK));
  }
  cizdir();

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
}());
