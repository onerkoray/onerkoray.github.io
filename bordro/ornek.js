/* Sayfadaki bordro incelemesi. Hesap için yalnızca ortak Bordro API'sini
   kullanır: bu dosya hiçbir oran ya da tutar bilmez, seçenekleri motora
   geçirir ve sonucu çizer. Renkler --dv-* veri tokenlarından (sayfa.css). */
(function () {
  "use strict";
  var B = window.Bordro;
  var form = document.getElementById("bordro-ornek");
  if (!B || !form) return;

  function $(id) { return document.getElementById(id); }
  var yil = $("ornek-yil"), ay = $("ornek-ay"), tutar = $("ornek-tutar");
  var giris = $("ornek-giris"), girisGun = $("ornek-giris-gun");
  var cikis = $("ornek-cikis"), cikisGun = $("ornek-cikis-gun");
  var engelli = $("ornek-engelli"), tesvik = $("ornek-tesvik"), bes = $("ornek-bes");
  var hata = $("ornek-hata"), sonuc = $("ornek-sonuc");
  var turButonlari = form.querySelectorAll("[data-tur]");
  var tur = "brut";

  var nf = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var yuzde = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
  function kisa(v) { return v >= 1e6 ? (v / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " mn" : nf0.format(Math.round(v / 100) / 10) + " bin"; }
  function yaz(id, metin) { $(id).textContent = metin; }
  function el(ad, sinif, metin) {
    var e = document.createElement(ad);
    if (sinif) e.className = sinif;
    if (metin != null) e.textContent = metin;
    return e;
  }
  function secim(s, deger, ad) { var o = document.createElement("option"); o.value = deger; o.textContent = ad; s.appendChild(o); }

  var AYDA = ["Ocak'ta", "Şubat'ta", "Mart'ta", "Nisan'da", "Mayıs'ta", "Haziran'da", "Temmuz'da", "Ağustos'ta", "Eylül'de", "Ekim'de", "Kasım'da", "Aralık'ta"];
  var AY_SONU = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  B.yillar().forEach(function (y) { secim(yil, y, y); });
  B.AY_ADLARI.forEach(function (ad, i) { secim(ay, i, ad); });
  secim(giris, 0, "Yılbaşından önce");
  B.AY_ADLARI.forEach(function (ad, i) { secim(giris, i + 1, AYDA[i]); });
  B.AY_ADLARI.forEach(function (ad, i) { secim(cikis, i + 1, AYDA[i]); });
  secim(cikis, 13, "Çıkış yok");
  cikis.value = "13";

  /* Ayın prim gün sayıları: girişten önce ve çıkıştan sonra 0. */
  function gunler() {
    var g = Number(giris.value), c = Number(cikis.value);
    var gg = Math.round(Number(girisGun.value)), cg = Math.round(Number(cikisGun.value));
    var d = [];
    for (var m = 1; m <= 12; m++) {
      var v = 30;
      if (m < g || m > c) v = 0;
      else if (m === g) v = gg;
      else if (m === c) v = cg;
      d.push(v);
    }
    return d;
  }
  function kistVar(d) { return d.some(function (v) { return v !== 30; }); }

  function secenekler(d) {
    var s = {};
    if (kistVar(d)) s.gun = d;
    if (Number(engelli.value)) s.engellilik = Number(engelli.value);
    if (tesvik.value) s.tesvik = tesvik.value;
    if (bes.checked) s.bes = 0.03;
    return s;
  }

  /* Yılın desteklediği seçenekler: kıst ay 2022+, engellilik tutarı tanımlı yıllar. */
  function yilKisitlari(P) {
    var kistOlur = P.istisnaRejimi === "asgari-ucret";
    [giris, girisGun, cikis, cikisGun].forEach(function (x) { x.disabled = !kistOlur; });
    if (!kistOlur) { giris.value = "0"; cikis.value = "13"; }
    yaz("ornek-kist-not", kistOlur
      ? "Kıst ayda ücret gün oranıyla ödenir; SGK alt ve üst sınırı güne iner, asgari ücret istisnası tam uygulanır."
      : P.yil + " AGİ yılı: kıst ay bu motorda hesaplanmaz (kaynakla doğrulanmadı).");
    engelli.disabled = !P.engellilik;
    if (!P.engellilik) engelli.value = "0";
    [1, 2, 3].forEach(function (d) {
      var o = engelli.querySelector('option[value="' + d + '"]');
      o.textContent = d + ". derece" + (P.engellilik ? " · " + nf0.format(P.engellilik[d - 1]) + " TL/ay" : "");
    });
  }

  function ozelSayisi(d) {
    var n = (kistVar(d) ? 1 : 0) + (Number(engelli.value) ? 1 : 0) + (tesvik.value ? 1 : 0) + (bes.checked ? 1 : 0);
    yaz("ornek-ozel-sayi", n ? "· " + n + " etkin" : "");
  }

  function hesapla(e) {
    if (e) e.preventDefault();
    var y = Number(yil.value), netMi = tur === "net";
    var P = B.parametre(y);
    yilKisitlari(P);
    var taban = Math.max.apply(null, P.donemler.map(function (d) { return netMi ? d.asgariNet : d.asgariBrut; }));
    tutar.min = taban;
    yaz("ornek-tutar-etiket", netMi ? "Aylık hedef net (TL)" : "Aylık brüt ücret (TL)");
    yaz("ornek-sinir", "Tam ay karşılığı, en az " + nf.format(taban) + ". Kıst ayda motor gün oranını uygular.");
    var d = gunler();
    ozelSayisi(d);
    var g = Number(tutar.value);
    var uygun = tutar.value.trim() !== "" && Number.isFinite(g) && g >= taban && g <= Number(tutar.max);
    tutar.setAttribute("aria-invalid", uygun ? "false" : "true");
    var gunHatasi = [girisGun, cikisGun].some(function (x) { var v = Number(x.value); return !(v >= 1 && v <= 30 && Math.round(v) === v); });
    var sira = Number(giris.value) > Number(cikis.value);
    if (!uygun || gunHatasi || sira) {
      hata.textContent = !uygun ? "Lütfen " + nf.format(taban) + " ile " + nf.format(Number(tutar.max)) + " arasında bir tutar girin."
        : gunHatasi ? "Gün sayısı 1 ile 30 arasında tam sayı olmalı." : "İşten çıkış, işe girişten önce olamaz.";
      sonuc.hidden = true;
      return;
    }
    hata.textContent = "";
    // Seçili ay çalışma döneminin dışındaysa en yakın çalışılan aya git.
    var calisilan = d.map(function (v, i) { return v > 0 ? i : -1; }).filter(function (i) { return i >= 0; });
    if (d[Number(ay.value)] === 0 && calisilan.length) {
      ay.value = String(calisilan.reduce(function (m, i) { return Math.abs(i - Number(ay.value)) < Math.abs(m - Number(ay.value)) ? i : m; }));
    }
    var s = secenekler(d);
    var brut;
    try {
      brut = netMi ? B.nettenBruteYil(d.map(function (v) { return g * v / 30; }), y, s) : d.map(function (v) { return g * v / 30; });
      var r = B.hesaplaYil(brut, y, s);
    } catch (x) {
      hata.textContent = x.message.replace(/^Bordro: /, "");
      sonuc.hidden = true;
      return;
    }
    var i = Number(ay.value), a = r.aylar[i];
    ciz(r, a, P, s, netMi, g, y, d);
    sonuc.hidden = false;
  }

  function ciz(r, a, P, s, netMi, g, y, d) {
    var besVar = !!s.bes;
    yaz("ornek-baslik", a.ayAdi + " " + y + " · " + (a.gun < 30 ? a.gun + " gün · " : "") + (netMi ? "sabit net sözleşme" : "sabit brüt ücret"));
    yaz("ornek-net-ad", "Ayın neti");
    yaz("ornek-net", nf.format(a.net));
    if (besVar) $("ornek-net").appendChild(el("span", "bi-ozet-alt", "BES sonrası ele geçen " + nf.format(a.eleGecen)));
    yaz("ornek-yillik", nf.format(r.toplam.net));
    yaz("ornek-maliyet", nf.format(a.isverenMaliyeti));

    // brütün dağılımı şeridi
    var serit = $("ornek-serit"), lej = $("ornek-lejant");
    serit.replaceChildren(); lej.replaceChildren();
    var parcalar = a.brut > 0 ? [
      ["bi-net", "Net", a.net], ["bi-vergi", "Gelir + damga vergisi", a.gelirVergisi + a.damga], ["bi-prim", "SGK + işsizlik", a.sgk + a.issizlik]
    ] : [];
    parcalar.forEach(function (p) {
      var sp = el("span", p[0]); sp.style.width = (p[2] / a.brut * 100).toFixed(2) + "%"; serit.appendChild(sp);
      var li = el("li", p[0]); li.appendChild(el("span", "", p[1])); li.appendChild(el("b", "", yuzde.format(p[2] / a.brut))); lej.appendChild(li);
    });

    // döküm
    var govde = $("ornek-kalemler");
    govde.replaceChildren();
    function grup(ad) { var tr = el("tr", "bi-grup"), th = el("th", "", ad); th.colSpan = 3; th.scope = "colgroup"; tr.appendChild(th); govde.appendChild(tr); }
    function satir(ad, v, adim, sinif) {
      var tr = el("tr", sinif || ""), th = el("th", "", ad), td = el("td", "sayi", nf.format(v)), ta = el("td", "bi-adim");
      th.scope = "row";
      if (adim) { var l = el("a", "", String(adim)); l.href = "#adim-" + adim; l.setAttribute("aria-label", "Yöntem adımı " + adim); ta.appendChild(l); }
      tr.appendChild(th); tr.appendChild(td); tr.appendChild(ta); govde.appendChild(tr);
    }
    var o = B.oranlarAy(P, a.ay);
    grup("Kazanç");
    satir("Brüt ücret" + (a.gun < 30 ? " (" + a.gun + " gün)" : ""), a.brut, 1);
    satir("Prime esas kazanç", a.primEsas, 1);
    grup("Kesintiler");
    satir("SGK işçi payı (" + yuzde.format(o.sgkIsci) + ")", a.sgk, 2);
    satir("İşsizlik işçi payı (" + yuzde.format(o.issizlikIsci) + ")", a.issizlik, 2);
    if (a.engellilik) satir("Engellilik indirimi (" + s.engellilik + ". derece)", a.engellilik, 4);
    satir("Aylık vergi matrahı", a.matrah, 3);
    satir("Kümülatif vergi matrahı", a.kumulatifMatrah, 5);
    satir("Tarifeye göre gelir vergisi", a.vergiTarife, 5);
    satir(P.istisnaRejimi === "agi" ? "Asgari geçim indirimi" : "Asgari ücret istisnası", a.istisna, 6);
    satir("Kesilen gelir vergisi", a.gelirVergisi, 6);
    satir("Damga vergisi", a.damga, 7);
    satir("Net ücret", a.net, 8, "bi-toplam");
    if (besVar) {
      satir("BES otomatik katılım (%3)", a.bes, 9);
      satir("Ele geçen", a.eleGecen, 9, "bi-toplam");
    }
    grup("İşveren");
    satir("SGK işveren payı" + (s.tesvik ? " (teşvikli)" : ""), a.isverenSgk, null);
    satir("İşsizlik işveren payı", a.isverenIssizlik, null);
    satir("İşveren maliyeti", a.isverenMaliyeti, null, "bi-toplam");

    aylariCiz(r, a, d);
    dilimleriCiz(r, a, P);

    var notlar = [];
    notlar.push(P.istisnaRejimi === "agi" ? "AGİ rejimi; geçmiş yıl sınırlarını aşağıda inceleyin." : "Asgari ücret istisnası uygulanır.");
    if (kistVar(d)) notlar.push("Kıst ayda istisna tam uygulanır (319 Seri No'lu GVGT m.6/2); damga istisnası da aylık asgari ücret tutarıyla.");
    notlar.push(s.tesvik ? "İşveren maliyeti seçilen m.81/ı indirimiyle." : "İşveren maliyeti teşviksiz.");
    notlar.push("Tek işveren. Tutarlar gösterimde kuruşa yuvarlanır.");
    yaz("ornek-rejim", notlar.join(" "));

    var secMetni = Object.keys(s).length ? ", " + JSON.stringify(s).replace(/"(\w+)":/g, "$1: ") : "";
    yaz("ornek-kod", (netMi
      ? "var brutler = Bordro.nettenBruteYil(" + (kistVar(d) ? "hedefler" : g) + ", " + y + secMetni + ");\nvar sonuc = Bordro.hesaplaYil(brutler, " + y + secMetni + ");"
      : "var sonuc = Bordro.hesaplaYil(" + (kistVar(d) ? "brutler" : g) + ", " + y + secMetni + ");") +
      "\nsonuc.aylar[" + (a.ay - 1) + "]; // " + a.ayAdi);
  }

  function aylariCiz(r, a, d) {
    var kap = $("ornek-aylar");
    kap.replaceChildren();
    var enYuksek = Math.max.apply(null, r.aylar.map(function (m) { return m.net; })) || 1;
    r.aylar.forEach(function (m, i) {
      var b = el("button", "bi-ay");
      b.type = "button";
      b.setAttribute("aria-pressed", String(m.ay === a.ay));
      b.disabled = d[i] === 0;
      b.setAttribute("aria-label", m.ayAdi + (d[i] === 0 ? ": bordro yok" : ": net " + nf.format(m.net) + (m.dilimGecisi ? ", yeni dilim %" + Math.round(m.dilim * 100) : "")));
      var ust = el("span", "bi-ay-deger", d[i] === 0 ? "—" : kisa(m.net));
      var kol = el("span", "bi-ay-kol"), dol = el("span", "bi-ay-dolgu");
      dol.style.height = (d[i] === 0 ? 0 : Math.max(4, m.net / enYuksek * 100)).toFixed(1) + "%";
      kol.appendChild(dol);
      if (m.dilimGecisi) { var t = el("span", "bi-ay-dilim", "%" + Math.round(m.dilim * 100)); kol.appendChild(t); }
      b.appendChild(ust); b.appendChild(kol); b.appendChild(el("span", "bi-ay-ad", m.ayAdi.slice(0, 3)));
      b.addEventListener("click", function () { ay.value = String(i); hesapla(); });
      kap.appendChild(b);
    });
    var calisan = r.aylar.filter(function (m, i) { return d[i] > 0 && d[i] === 30; });
    var metin = "Yıllık net " + nf.format(r.toplam.net) + ".";
    if (calisan.length > 1) {
      var yuk = calisan.reduce(function (x, m) { return m.net > x.net ? m : x; });
      var dus = calisan.reduce(function (x, m) { return m.net < x.net ? m : x; });
      if (yuk.net - dus.net >= 1) metin += " Tam aylarda en yüksek " + AYDA[yuk.ay - 1] + " " + nf.format(yuk.net) + ", en düşük " + AYDA[dus.ay - 1] + " " + nf.format(dus.net) + ".";
      else metin += " Tam aylarda net sabit.";
    }
    var gecis = r.aylar.filter(function (m) { return m.dilimGecisi; });
    if (gecis.length) metin += " Dilim geçişi: " + gecis.map(function (m) { return AY_SONU[m.ay - 1] + " (%" + Math.round(m.dilim * 100) + ")"; }).join(", ") + ".";
    yaz("ornek-yil-not", metin);
  }

  function dilimleriCiz(r, a, P) {
    var kap = $("ornek-dilimler");
    kap.replaceChildren();
    var K = a.kumulatifMatrah, D = P.dilimler;
    // Eksen: kümülatif matrahın içinde olduğu dilimin üst sınırına kadar (son dilimde matrahın 1,15 katı).
    var j = 0;
    while (j < D.length - 1 && D[j][0] !== null && K > D[j][0]) j++;
    var ustSinir = D[j][0] !== null ? D[j][0] : Math.max(K, D[j - 1][0]) * 1.15;
    var alt = 0, parca = el("div", "bi-dilim-serit");
    for (var k = 0; k <= j; k++) {
      var ust = D[k][0] !== null ? Math.min(D[k][0], ustSinir) : ustSinir;
      var s = el("div", "bi-dilim" + (k === j ? " bi-dilim-etkin" : ""));
      s.style.width = ((ust - alt) / ustSinir * 100).toFixed(3) + "%";
      s.appendChild(el("span", "bi-dilim-oran", "%" + Math.round(D[k][1] * 100)));
      var dolu = el("i", "bi-dilim-dolu");
      dolu.style.width = (Math.max(0, Math.min(1, (K - alt) / (ust - alt))) * 100).toFixed(2) + "%";
      s.appendChild(dolu);
      if (D[k][0] !== null && D[k][0] <= ustSinir) s.appendChild(el("span", "bi-dilim-sinir", kisa(D[k][0])));
      parca.appendChild(s);
      alt = ust;
    }
    kap.appendChild(parca);
    var metin = AY_SONU[a.ay - 1] + " sonunda kümülatif matrah " + nf.format(K) + ", %" + Math.round(a.dilim * 100) + " diliminde.";
    if (D[j][0] !== null && j < D.length - 1) metin += " Bir sonraki dilime (%" + Math.round(D[j + 1][1] * 100) + ") " + nf.format(D[j][0] - K) + " kaldı.";
    else metin += " Bu son dilim.";
    yaz("ornek-matrah-not", metin);
  }

  // ---- olaylar ------------------------------------------------------------
  turButonlari.forEach(function (b) {
    b.addEventListener("click", function () {
      var yeni = b.getAttribute("data-tur");
      if (yeni === tur) return;
      tur = yeni;
      turButonlari.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      hesapla();
    });
  });
  form.addEventListener("submit", hesapla);
  [yil, ay, giris, cikis, engelli, tesvik, bes].forEach(function (x) { x.addEventListener("change", hesapla); });
  [tutar, girisGun, cikisGun].forEach(function (x) { x.addEventListener("input", hesapla); });
  form.hidden = false;
  hesapla();
})();
